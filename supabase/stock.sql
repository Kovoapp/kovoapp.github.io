-- Agrega el control de stock a una base que ya tenía schema.sql corrido.
-- Se puede correr más de una vez sin problema: SQL Editor -> pegar este archivo -> Run.

alter table public.products add column if not exists stock numeric(14, 3);

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
