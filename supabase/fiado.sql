-- Fiado: la cuenta corriente de cada cliente. Se activa por negocio en Ajustes.
-- Una venta con medio de pago "Fiado" suma a la cuenta del cliente; los pagos la bajan.
-- Se puede correr las veces que quieras.
alter table public.businesses add column if not exists fiado boolean not null default false;
grant update (fiado) on public.businesses to authenticated;

create table if not exists public.fiados (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  sale_id uuid unique references public.sales (id) on delete cascade,
  kind text not null check (kind in ('fiado', 'pago')),
  amount numeric(14, 2) not null check (amount > 0),
  payment text not null default '',
  shop_id uuid references public.shops (id),
  day date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);
create index if not exists fiados_business_idx on public.fiados (business_id, client_id);
alter table public.fiados enable row level security;

-- Todos los del negocio ven las cuentas (el cajero necesita saber cuánto debe cada uno).
drop policy if exists fiados_select on public.fiados;
create policy fiados_select on public.fiados for select using (public.is_member(business_id));
-- A mano solo se anotan pagos; lo fiado sale de las ventas.
drop policy if exists fiados_insert on public.fiados;
create policy fiados_insert on public.fiados for insert with check (
  public.is_member(business_id) and created_by = auth.uid() and kind = 'pago' and sale_id is null
  and shop_id is not null and public.shop_in_business(shop_id, business_id)
  and exists (select 1 from public.clients c where c.id = client_id and c.business_id = fiados.business_id));
-- Un pago mal anotado lo borra el dueño o un administrador. Lo fiado se borra borrando la venta.
drop policy if exists fiados_delete on public.fiados;
create policy fiados_delete on public.fiados for delete using (public.is_manager(business_id) and kind = 'pago');

-- Cada venta fiada se anota sola en la cuenta del cliente (si el cliente no existe, se crea).
create or replace function public.sales_fiado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  if new.payment <> 'Fiado' then return new; end if;
  if btrim(new.client_name) = '' then raise exception 'fiado_sin_cliente'; end if;
  insert into clients (business_id, name) values (new.business_id, btrim(new.client_name))
    on conflict (business_id, name) do nothing;
  select id into c from clients where business_id = new.business_id and name = btrim(new.client_name);
  insert into fiados (business_id, client_id, sale_id, kind, amount, shop_id, day, created_at, created_by)
    values (new.business_id, c, new.id, 'fiado', new.amount, new.shop_id, new.day, new.created_at, new.created_by);
  return new;
end $$;
revoke all on function public.sales_fiado() from public, anon, authenticated;
drop trigger if exists sales_fiado on public.sales;
create trigger sales_fiado after insert on public.sales
  for each row execute function public.sales_fiado();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'fiados') then
    alter publication supabase_realtime add table public.fiados;
  end if;
end $$;
