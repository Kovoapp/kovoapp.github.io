-- Turnos: la agenda del día, para peluquerías y cualquier negocio que trabaje con turnos. Se activa por negocio en Ajustes.
-- Todos los del negocio (dueño, administradores y cajeros) ven, anotan, cambian y borran turnos.
-- Se puede correr las veces que quieras.
alter table public.businesses add column if not exists turnos boolean not null default false;
grant update (turnos) on public.businesses to authenticated;

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  minutos int not null default 30 check (minutos between 5 and 600),
  cliente text not null check (length(btrim(cliente)) between 1 and 80),
  telefono text not null default '' check (length(telefono) <= 30),
  servicio text not null default '' check (length(servicio) <= 80),
  precio numeric(14, 2) check (precio is null or precio >= 0),
  atiende text not null default '' check (length(atiende) <= 60),
  nota text not null default '' check (length(nota) <= 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'atendido', 'no_vino')),
  sale_id uuid references public.sales (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);
create index if not exists turnos_business_day_idx on public.turnos (business_id, day, hora);
alter table public.turnos enable row level security;

-- La venta con la que se cobró un turno tiene que ser del mismo negocio.
create or replace function public.sale_in_business(s uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select s is null or exists (select 1 from sales where id = s and business_id = b);
$$;
revoke all on function public.sale_in_business(uuid, uuid) from public, anon;
grant execute on function public.sale_in_business(uuid, uuid) to authenticated;

drop policy if exists turnos_select on public.turnos;
create policy turnos_select on public.turnos for select using (public.is_member(business_id));
drop policy if exists turnos_insert on public.turnos;
create policy turnos_insert on public.turnos for insert with check (
  public.is_member(business_id) and created_by = auth.uid() and public.sale_in_business(sale_id, business_id));
drop policy if exists turnos_update on public.turnos;
create policy turnos_update on public.turnos for update using (public.is_member(business_id))
  with check (public.is_member(business_id) and public.sale_in_business(sale_id, business_id));
drop policy if exists turnos_delete on public.turnos;
create policy turnos_delete on public.turnos for delete using (public.is_member(business_id));
-- Quién lo anotó no se cambia.
revoke update on public.turnos from authenticated;
grant update (day, hora, minutos, cliente, telefono, servicio, precio, atiende, nota, estado, sale_id) on public.turnos to authenticated;
grant select, insert, delete on public.turnos to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'turnos') then
    alter publication supabase_realtime add table public.turnos;
  end if;
end $$;
