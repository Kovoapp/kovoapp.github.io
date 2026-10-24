-- Anotador: una lista de cosas para no olvidarse (pedir mercadería, llamar a alguien), al lado de la caja.
-- Se activa por negocio en Ajustes. Todos los del negocio la ven y la usan.
-- Se puede correr las veces que quieras.
alter table public.businesses add column if not exists notas boolean not null default false;
grant update (notas) on public.businesses to authenticated;

create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  texto text not null check (length(btrim(texto)) between 1 and 300),
  hecha boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);
create index if not exists notas_business_idx on public.notas (business_id, created_at);
alter table public.notas enable row level security;

drop policy if exists notas_select on public.notas;
create policy notas_select on public.notas for select using (public.is_member(business_id));
drop policy if exists notas_insert on public.notas;
create policy notas_insert on public.notas for insert with check (public.is_member(business_id) and created_by = auth.uid());
drop policy if exists notas_update on public.notas;
create policy notas_update on public.notas for update using (public.is_member(business_id)) with check (public.is_member(business_id));
drop policy if exists notas_delete on public.notas;
create policy notas_delete on public.notas for delete using (public.is_member(business_id));
revoke update on public.notas from authenticated;
grant update (texto, hecha) on public.notas to authenticated;
grant select, insert, delete on public.notas to authenticated;
