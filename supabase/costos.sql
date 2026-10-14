-- Costo de los productos, ganancia del mes, aumento de precios, importar productos y sugerencias.
-- Se puede correr más de una vez sin problema: SQL Editor -> pegar este archivo -> Run.

-- ---------------------------------------------------------------
-- Costo de cada producto: aparte de "products" para que los cajeros no lo vean.
-- ---------------------------------------------------------------
create table if not exists public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  cost numeric(14, 2) not null check (cost >= 0)
);
create index if not exists product_costs_business_idx on public.product_costs (business_id);
alter table public.product_costs enable row level security;

create or replace function public.product_in_business(p uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products where id = p and business_id = b)
$$;

drop policy if exists product_costs_all on public.product_costs;
create policy product_costs_all on public.product_costs for all
  using (public.is_manager(business_id))
  with check (public.is_manager(business_id) and public.product_in_business(product_id, business_id));

-- ---------------------------------------------------------------
-- Costo de lo vendido: al anotar una venta se guarda cuánto costaban sus productos,
-- así la ganancia del mes no cambia cuando después se actualiza el costo.
-- "base" es lo cobrado por los productos que tienen costo cargado.
-- ---------------------------------------------------------------
create table if not exists public.sale_costs (
  sale_id uuid primary key references public.sales (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  base numeric(14, 2) not null,
  cost numeric(14, 2) not null
);
create index if not exists sale_costs_business_day_idx on public.sale_costs (business_id, day);
alter table public.sale_costs enable row level security;
drop policy if exists sale_costs_select on public.sale_costs;
create policy sale_costs_select on public.sale_costs for select using (public.is_manager(business_id));

create or replace function public.sales_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sale_costs (sale_id, business_id, day, base, cost)
  select new.id, new.business_id, new.day,
         round(sum(x.q * x.price / case when p.unit = 'kg' then 1000 else 1 end), 2),
         round(sum(x.q * c.cost / case when p.unit = 'kg' then 1000 else 1 end), 2)
    from (select (i ->> 'id')::uuid as id, (i ->> 'qty')::numeric as q, (i ->> 'price')::numeric as price
            from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) i
           where i ->> 'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             and i ->> 'qty' ~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
             and i ->> 'price' ~ '^[0-9]{1,12}(\.[0-9]{1,4})?$') x
    join public.products p on p.id = x.id and p.business_id = new.business_id
    join public.product_costs c on c.product_id = p.id
  having count(*) > 0;
  return null;
end $$;
revoke all on function public.sales_cost() from public, anon, authenticated;
drop trigger if exists sales_cost on public.sales;
create trigger sales_cost after insert on public.sales
  for each row execute function public.sales_cost();

-- ---------------------------------------------------------------
-- Aumentar precios por porcentaje (y, si se pide, también el costo).
-- p_step redondea el precio nuevo: 1, 10 o 100 pesos.
-- ---------------------------------------------------------------
create or replace function public.raise_prices(p_business uuid, p_ids uuid[], p_pct numeric, p_step numeric, p_cost boolean)
returns int language plpgsql security invoker set search_path = public as $$
declare
  n int;
begin
  if not public.is_manager(p_business) then raise exception 'not_allowed'; end if;
  if p_pct is null or p_pct <= -90 or p_pct > 1000 then raise exception 'bad_percent'; end if;
  if p_step is null or p_step not in (1, 10, 100) then raise exception 'bad_step'; end if;
  update public.products
     set price = greatest(p_step, round(price * (1 + p_pct / 100) / p_step) * p_step)
   where business_id = p_business and id = any (p_ids);
  get diagnostics n = row_count;
  if p_cost then
    update public.product_costs set cost = round(cost * (1 + p_pct / 100), 2)
     where business_id = p_business and product_id = any (p_ids);
  end if;
  return n;
end $$;

-- ---------------------------------------------------------------
-- Importar productos desde una planilla. Cada fila: name, price y, si vienen,
-- cost, code, stock y unit ('u' o 'kg'). Si el código o el nombre ya existen,
-- actualiza ese producto; si no, lo crea. Todo o nada.
-- ---------------------------------------------------------------
create or replace function public.import_products(p_business uuid, p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  pid uuid;
  v_code text;
  v_unit text;
  nuevos int := 0;
  actualizados int := 0;
begin
  if not public.is_manager(p_business) then raise exception 'not_allowed'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then raise exception 'bad_rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_code := coalesce(btrim(r ->> 'code'), '');
    v_unit := case when r ->> 'unit' in ('u', 'kg') then r ->> 'unit' end;
    pid := null;
    if v_code <> '' then
      select id into pid from public.products where business_id = p_business and code = v_code;
    end if;
    if pid is null then
      select id into pid from public.products
       where business_id = p_business and lower(btrim(name)) = lower(btrim(r ->> 'name'))
       order by (code = '') desc limit 1;
    end if;
    if pid is null then
      insert into public.products (business_id, name, price, unit, code, stock)
      values (p_business, btrim(r ->> 'name'), (r ->> 'price')::numeric, coalesce(v_unit, 'u'), v_code,
              (r ->> 'stock')::numeric)
      returning id into pid;
      nuevos := nuevos + 1;
    else
      update public.products set
        name = case when lower(btrim(name)) = lower(btrim(r ->> 'name')) then name else btrim(r ->> 'name') end,
        price = (r ->> 'price')::numeric,
        unit = coalesce(v_unit, unit),
        code = case when v_code <> '' then v_code else code end,
        stock = case when r ? 'stock' and r ->> 'stock' is not null then (r ->> 'stock')::numeric else stock end
      where id = pid;
      actualizados := actualizados + 1;
    end if;
    if r ->> 'cost' is not null then
      insert into public.product_costs (product_id, business_id, cost) values (pid, p_business, (r ->> 'cost')::numeric)
      on conflict (product_id) do update set cost = excluded.cost;
    end if;
  end loop;
  return jsonb_build_object('nuevos', nuevos, 'actualizados', actualizados);
end $$;

revoke all on function public.raise_prices(uuid, uuid[], numeric, numeric, boolean) from public, anon;
revoke all on function public.import_products(uuid, jsonb) from public, anon;
revoke all on function public.product_in_business(uuid, uuid) from public, anon;
grant execute on function public.raise_prices(uuid, uuid[], numeric, numeric, boolean) to authenticated;
grant execute on function public.import_products(uuid, jsonb) to authenticated;
grant execute on function public.product_in_business(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------
-- Sugerencias: cualquier usuario las manda; solo el administrador de la app las ve.
-- ---------------------------------------------------------------
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 3 and 2000),
  created_at timestamptz not null default now(),
  done boolean not null default false
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);
alter table public.suggestions enable row level security;
drop policy if exists suggestions_insert on public.suggestions;
create policy suggestions_insert on public.suggestions for insert
  with check (user_id = auth.uid() and not done and (business_id is null or public.is_member(business_id)));
drop policy if exists suggestions_admin on public.suggestions;
create policy suggestions_admin on public.suggestions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Para el panel del administrador: con el negocio y el email de quien la mandó.
drop function if exists public.admin_suggestions();
create function public.admin_suggestions()
returns table (id uuid, body text, created_at timestamptz, done boolean, business text, email text)
language sql stable security definer set search_path = public as $$
  select s.id, s.body, s.created_at, s.done,
         (select b.name from businesses b where b.id = s.business_id),
         (select u.email::text from auth.users u where u.id = s.user_id)
    from suggestions s
   where public.is_platform_admin()
   order by s.done, s.created_at desc
   limit 200
$$;
revoke all on function public.admin_suggestions() from public, anon;
grant execute on function public.admin_suggestions() to authenticated;
