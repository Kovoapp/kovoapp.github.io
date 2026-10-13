-- Agrega la suscripción con Mercado Pago a una base que ya existía.
-- Se puede correr más de una vez: SQL Editor -> pegar este archivo -> Run.

-- ---------------------------------------------------------------
-- Suscripción con Mercado Pago.
-- Un negocio puede anotar ventas mientras dure la prueba, mientras tenga
-- pago hasta "paid_until" (fecha del próximo cobro + 3 días de gracia) o si
-- el administrador le dio acceso gratis (plan 'free').
-- ---------------------------------------------------------------
alter table public.businesses add column if not exists price numeric(12, 2);
alter table public.businesses add column if not exists paid_until timestamptz;
alter table public.businesses add column if not exists mp_preapproval_id text;
alter table public.businesses add column if not exists mp_status text;
alter table public.businesses drop constraint if exists businesses_plan_check;
alter table public.businesses add constraint businesses_plan_check check (plan in ('trial', 'active', 'paused', 'free'));

-- Los dueños solo pueden cambiar el nombre y el pie del ticket; el plan y las fechas los maneja el sistema.
revoke update on public.businesses from anon, authenticated;
grant update (name, ticket_footer) on public.businesses to authenticated;

-- Precios: los primeros "founder_slots" negocios que se suscriben pagan founder_price para siempre.
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  founder_price numeric(12, 2) not null default 15000,
  regular_price numeric(12, 2) not null default 18000,
  founder_slots int not null default 10
);
insert into public.platform_settings (id) values (1) on conflict do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings for select using (auth.uid() is not null);
drop policy if exists platform_settings_admin on public.platform_settings;
create policy platform_settings_admin on public.platform_settings for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.can_sell(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses
    where id = b and (plan = 'free' or trial_ends_at > now() or paid_until > now()))
$$;

-- Precio que paga (o pagaría) un negocio: el que tiene guardado, o el que le toca hoy.
create or replace function public.subscription_price(b uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select price from businesses where id = b),
    (select case when (select count(*) from businesses where price is not null) < s.founder_slots
                 then s.founder_price else s.regular_price end
       from platform_settings s where s.id = 1))
$$;

-- Lo llaman las funciones de Mercado Pago (con la clave de servicio), nunca la app.
create or replace function public.mp_attach(p_business uuid, p_preapproval text, p_price numeric)
returns void language sql security definer set search_path = public as $$
  update businesses set mp_preapproval_id = p_preapproval, mp_status = 'pending', price = coalesce(price, p_price)
   where id = p_business
$$;
create or replace function public.mp_apply(p_business uuid, p_preapproval text, p_status text, p_next timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update businesses set
    mp_status = p_status,
    plan = case when plan = 'free' then plan
                when p_status = 'authorized' then 'active'
                when p_status in ('paused', 'cancelled') then 'paused'
                else plan end,
    paid_until = case when p_status = 'authorized' and p_next is not null
                      then greatest(coalesce(paid_until, p_next), p_next + interval '3 days')
                      else paid_until end
   where id = p_business and mp_preapproval_id = p_preapproval;
  return found;
end $$;

-- El administrador puede dar acceso gratis a un negocio (o sacárselo).
create or replace function public.admin_set_free(p_business uuid, p_free boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  update businesses set plan = case when p_free then 'free'
                                    when mp_status = 'authorized' then 'active'
                                    when mp_preapproval_id is not null then 'paused' else 'trial' end
   where id = p_business;
end $$;

drop function if exists public.admin_overview();
create function public.admin_overview()
returns table (business_id uuid, name text, created_at timestamptz, plan text, trial_ends_at timestamptz,
               owner_email text, members int, sales_30d int, price numeric, paid_until timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.created_at, b.plan, b.trial_ends_at,
         (select u.email::text from auth.users u where u.id = b.created_by),
         (select count(*)::int from members m where m.business_id = b.id),
         (select count(*)::int from sales s where s.business_id = b.id and s.day >= current_date - 30),
         b.price, b.paid_until
    from businesses b
   where public.is_platform_admin()
   order by b.created_at desc
$$;

-- Ventas: solo con la suscripción al día.
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert
  with check (public.is_member(business_id) and created_by = auth.uid()
              and public.shop_in_business(shop_id, business_id) and public.can_sell(business_id));

revoke all on function public.mp_attach(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.mp_apply(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_set_free(uuid, boolean) from public, anon;
grant execute on function public.mp_attach(uuid, text, numeric) to service_role;
grant execute on function public.mp_apply(uuid, text, text, timestamptz) to service_role;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_set_free(uuid, boolean) to authenticated;
grant execute on function public.can_sell(uuid), public.subscription_price(uuid) to authenticated;
