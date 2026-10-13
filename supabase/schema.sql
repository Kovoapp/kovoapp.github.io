-- Caja Dietéticas: base de datos para varios negocios.
-- Cada negocio ve solo sus propios datos (Row Level Security).
-- Se corre una sola vez en Supabase: SQL Editor -> pegar este archivo -> Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  ticket_footer text not null default '¡Gracias por su compra!',
  plan text not null default 'trial' check (plan in ('trial', 'active', 'paused')),
  trial_ends_at timestamptz not null default now() + interval '7 days',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'cashier')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind text not null default 'retail' check (kind in ('retail', 'wholesale')),
  position int not null default 0,
  active boolean not null default true
);
create index shops_business_idx on public.shops (business_id);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  wholesale boolean not null default true,
  position int not null default 0,
  active boolean not null default true
);
create index payment_methods_business_idx on public.payment_methods (business_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  unique (business_id, name)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  unique (business_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  price numeric(14, 2) not null check (price > 0),
  unit text not null default 'u' check (unit in ('u', 'kg')),
  code text not null default '',
  stock numeric(14, 3) -- vacío = no se controla; en unidades o en kilos según "unit"
);
create index products_business_idx on public.products (business_id);
create unique index products_code_uq on public.products (business_id, code) where code <> '';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  shop_id uuid not null references public.shops (id),
  day date not null default current_date,
  created_at timestamptz not null default now(),
  client_name text not null default '',
  payment text not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_with numeric(14, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users (id)
);
create index sales_business_day_idx on public.sales (business_id, day);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  shop_id uuid references public.shops (id),
  kind text not null check (kind in ('supplier', 'tax', 'withdrawal')),
  name text not null default '',
  payment text not null default '',
  amount numeric(14, 2) not null check (amount > 0),
  day date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);
create index expenses_business_day_idx on public.expenses (business_id, day);

create table public.openings (
  business_id uuid not null references public.businesses (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  day date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, day)
);
create index openings_business_day_idx on public.openings (business_id, day);

create table public.invites (
  code text primary key default upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

-- ---------------------------------------------------------------
-- Funciones de permisos
-- ---------------------------------------------------------------

create or replace function public.my_role(b uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.members where business_id = b and user_id = auth.uid()
$$;

create or replace function public.is_member(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where business_id = b and user_id = auth.uid())
$$;

create or replace function public.is_manager(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where business_id = b and user_id = auth.uid() and role in ('owner', 'admin'))
$$;

-- Comprueba que una fila hija apunte a un local del mismo negocio.
create or replace function public.shop_in_business(s uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select s is null or exists (select 1 from public.shops where id = s and business_id = b)
$$;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.shops enable row level security;
alter table public.payment_methods enable row level security;
alter table public.clients enable row level security;
alter table public.providers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.openings enable row level security;
alter table public.invites enable row level security;

-- Negocio: lo ven sus miembros; lo editan dueño y administradores. Se crea con create_business().
create policy businesses_select on public.businesses for select using (public.is_member(id));
create policy businesses_update on public.businesses for update
  using (public.is_manager(id)) with check (public.is_manager(id));

-- Equipo: lo ven los miembros; solo el dueño cambia roles o saca gente (no a sí mismo).
create policy members_select on public.members for select using (public.is_member(business_id));
create policy members_update on public.members for update
  using (public.my_role(business_id) = 'owner' and user_id <> auth.uid())
  with check (public.my_role(business_id) = 'owner' and role in ('admin', 'cashier'));
create policy members_delete on public.members for delete
  using (public.my_role(business_id) = 'owner' and user_id <> auth.uid());
create policy members_update_self_name on public.members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and role = public.my_role(business_id));

-- Locales, medios de pago, proveedores y productos: los ven todos, los editan dueño y admins.
create policy shops_select on public.shops for select using (public.is_member(business_id));
create policy shops_write on public.shops for all
  using (public.is_manager(business_id)) with check (public.is_manager(business_id));

create policy payment_methods_select on public.payment_methods for select using (public.is_member(business_id));
create policy payment_methods_write on public.payment_methods for all
  using (public.is_manager(business_id)) with check (public.is_manager(business_id));

create policy providers_select on public.providers for select using (public.is_member(business_id));
create policy providers_write on public.providers for all
  using (public.is_manager(business_id)) with check (public.is_manager(business_id));

create policy products_select on public.products for select using (public.is_member(business_id));
create policy products_write on public.products for all
  using (public.is_manager(business_id)) with check (public.is_manager(business_id));

-- Clientes mayoristas: cualquier miembro puede agregar; solo dueño y admins borran.
create policy clients_select on public.clients for select using (public.is_member(business_id));
create policy clients_insert on public.clients for insert with check (public.is_member(business_id));
create policy clients_delete on public.clients for delete using (public.is_manager(business_id));

-- Ventas: los cajeros anotan y ven las suyas; pueden borrar la suya durante 15 minutos.
create policy sales_select on public.sales for select
  using (public.is_manager(business_id) or (created_by = auth.uid() and public.is_member(business_id)));
create policy sales_insert on public.sales for insert
  with check (public.is_member(business_id) and created_by = auth.uid()
              and public.shop_in_business(shop_id, business_id));
create policy sales_delete on public.sales for delete
  using (public.is_manager(business_id)
         or (created_by = auth.uid() and public.is_member(business_id)
             and created_at > now() - interval '15 minutes'));

-- Pagos, retiros y caja inicial: solo dueño y admins.
create policy expenses_all on public.expenses for all
  using (public.is_manager(business_id))
  with check (public.is_manager(business_id) and public.shop_in_business(shop_id, business_id));
create policy openings_all on public.openings for all
  using (public.is_manager(business_id))
  with check (public.is_manager(business_id) and public.shop_in_business(shop_id, business_id));

-- Invitaciones: las manejan dueño y admins; se canjean con join_business().
create policy invites_select on public.invites for select using (public.is_manager(business_id));
create policy invites_insert on public.invites for insert
  with check (public.is_manager(business_id) and created_by = auth.uid()
              and (role = 'cashier' or public.my_role(business_id) = 'owner'));
create policy invites_delete on public.invites for delete using (public.is_manager(business_id));

-- ---------------------------------------------------------------
-- Alta de negocio y unión por invitación
-- ---------------------------------------------------------------

create or replace function public.join_business(p_code text, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into inv from invites
    where code = upper(btrim(p_code)) and used_by is null and expires_at > now()
    for update;
  if not found then raise exception 'invalid_invite'; end if;
  insert into members (business_id, user_id, role, display_name)
    values (inv.business_id, auth.uid(), inv.role, coalesce(btrim(p_name), ''))
    on conflict (business_id, user_id) do nothing;
  update invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.business_id;
end $$;

revoke all on function public.join_business(text, text) from public, anon;
grant execute on function public.join_business(text, text) to authenticated;

-- ---------------------------------------------------------------
-- Alta de negocios con código: el negocio nuevo necesita un código que da
-- un administrador de la plataforma (el dueño de la app).
-- ---------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
create table if not exists public.signup_codes (
  code text primary key default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  note text not null default '' check (length(note) <= 120),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_by uuid references auth.users (id),
  used_at timestamptz,
  business_id uuid references public.businesses (id) on delete set null
);
alter table public.platform_admins enable row level security;
alter table public.signup_codes enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

drop policy if exists platform_admins_self on public.platform_admins;
create policy platform_admins_self on public.platform_admins for select using (user_id = auth.uid());
drop policy if exists signup_codes_admin on public.signup_codes;
create policy signup_codes_admin on public.signup_codes for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- La prueba gratis dura una semana.
alter table public.businesses alter column trial_ends_at set default now() + interval '7 days';

drop function if exists public.create_business(text, text, text[], boolean, text[]);
create or replace function public.create_business(
  p_name text,
  p_owner_name text,
  p_shops text[],
  p_wholesale boolean,
  p_payments text[],
  p_code text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b uuid;
  i int;
  sc text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  -- Solo se crea un negocio con un código de alta (los administradores de la plataforma no lo necesitan).
  if not public.is_platform_admin() then
    select code into sc from signup_codes
      where code = upper(btrim(coalesce(p_code, ''))) and used_by is null and expires_at > now()
      for update;
    if not found then raise exception 'invalid_signup_code'; end if;
  end if;
  if coalesce(array_length(p_shops, 1), 0) = 0 then raise exception 'need_shop'; end if;
  if coalesce(array_length(p_payments, 1), 0) = 0 then raise exception 'need_payment'; end if;

  insert into businesses (name, created_by) values (btrim(p_name), auth.uid()) returning id into b;
  insert into members (business_id, user_id, role, display_name)
    values (b, auth.uid(), 'owner', coalesce(btrim(p_owner_name), ''));

  if sc is not null then
    update signup_codes set used_by = auth.uid(), used_at = now(), business_id = b where code = sc;
  end if;

  for i in 1 .. array_length(p_shops, 1) loop
    if btrim(p_shops[i]) <> '' then
      insert into shops (business_id, name, kind, position) values (b, btrim(p_shops[i]), 'retail', i);
    end if;
  end loop;
  if p_wholesale then
    insert into shops (business_id, name, kind, position) values (b, 'Mayorista', 'wholesale', 100);
  end if;

  for i in 1 .. array_length(p_payments, 1) loop
    if btrim(p_payments[i]) <> '' then
      insert into payment_methods (business_id, name, position, wholesale)
        values (b, btrim(p_payments[i]), i, btrim(p_payments[i]) not in ('QR', 'Posnet', 'Tarjeta'));
    end if;
  end loop;
  return b;
end $$;


-- Resumen para el administrador de la plataforma: a los demás no les devuelve nada.
drop function if exists public.admin_overview();
create function public.admin_overview()
returns table (business_id uuid, name text, created_at timestamptz, plan text, trial_ends_at timestamptz,
               owner_email text, members int, sales_30d int)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.created_at, b.plan, b.trial_ends_at,
         (select u.email::text from auth.users u where u.id = b.created_by),
         (select count(*)::int from members m where m.business_id = b.id),
         (select count(*)::int from sales s where s.business_id = b.id and s.day >= current_date - 30)
    from businesses b
   where public.is_platform_admin()
   order by b.created_at desc
$$;
create or replace function public.admin_user_count()
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_platform_admin() then (select count(*)::int from auth.users) end
$$;

revoke all on function public.create_business(text, text, text[], boolean, text[], text) from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_user_count() from public, anon;
grant execute on function public.create_business(text, text, text[], boolean, text[], text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_user_count() to authenticated;

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

-- ---------------------------------------------------------------
-- Stock: cada venta descuenta lo vendido y borrar la venta lo devuelve.
-- Solo toca productos del mismo negocio que tengan stock cargado.
-- ---------------------------------------------------------------
create or replace function public.sales_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.sales;
  sgn numeric;
begin
  if tg_op = 'INSERT' then s := new; sgn := -1; else s := old; sgn := 1; end if;
  update public.products p
     set stock = p.stock + sgn * (case when p.unit = 'kg' then x.q / 1000 else x.q end)
    from (select (i ->> 'id')::uuid as id, sum((i ->> 'qty')::numeric) as q
            from jsonb_array_elements(case when jsonb_typeof(s.items) = 'array' then s.items else '[]'::jsonb end) i
           where i ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             and i ->> 'qty' ~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
           group by 1) x
   where p.id = x.id and p.business_id = s.business_id and p.stock is not null;
  return null;
end $$;
revoke all on function public.sales_stock() from public, anon, authenticated;

drop trigger if exists sales_stock on public.sales;
create trigger sales_stock after insert or delete on public.sales
  for each row execute function public.sales_stock();

-- ---------------------------------------------------------------
-- Actualización en vivo (si existe la publicación de Supabase Realtime)
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sales, public.expenses, public.openings;
  end if;
end $$;
