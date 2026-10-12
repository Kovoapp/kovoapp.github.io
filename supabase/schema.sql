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
  trial_ends_at timestamptz not null default now() + interval '30 days',
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
  code text not null default ''
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

create or replace function public.create_business(
  p_name text,
  p_owner_name text,
  p_shops text[],
  p_wholesale boolean,
  p_payments text[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b uuid;
  i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if coalesce(array_length(p_shops, 1), 0) = 0 then raise exception 'need_shop'; end if;
  if coalesce(array_length(p_payments, 1), 0) = 0 then raise exception 'need_payment'; end if;

  insert into businesses (name, created_by) values (btrim(p_name), auth.uid()) returning id into b;
  insert into members (business_id, user_id, role, display_name)
    values (b, auth.uid(), 'owner', coalesce(btrim(p_owner_name), ''));

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

revoke all on function public.create_business(text, text, text[], boolean, text[]) from public, anon;
revoke all on function public.join_business(text, text) from public, anon;
grant execute on function public.create_business(text, text, text[], boolean, text[]) to authenticated;
grant execute on function public.join_business(text, text) to authenticated;

-- ---------------------------------------------------------------
-- Actualización en vivo (si existe la publicación de Supabase Realtime)
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sales, public.expenses, public.openings;
  end if;
end $$;
