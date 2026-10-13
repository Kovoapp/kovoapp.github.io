-- Agrega el alta de negocios con código a una base que ya existía.
-- Se puede correr más de una vez: SQL Editor -> pegar este archivo -> Run.
-- Al final, cambiá el email por el tuyo para quedar como administrador.

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

-- Vos como administrador de la plataforma (usá el email con el que entrás a la caja):
insert into public.platform_admins (user_id)
  select id from auth.users where email = 'TU_EMAIL@ejemplo.com'
  on conflict do nothing;
