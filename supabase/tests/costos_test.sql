-- Prueba costos, ganancia, aumento de precios, importar productos y sugerencias.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000e1', 'eva@e.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'cajera@e.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'otro@o.com');
insert into signup_codes (code) values ('EVA00001'), ('OTRO0001');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_business('Almacén Eva', 'Eva', array['Centro'], false, array['Efectivo'], 'EVA00001') as e_id \gset
select set_config('my.e_id', :'e_id', false);
select id as centro from shops where business_id = :'e_id' \gset
insert into invites (code, business_id, role) values ('CAJAEVA1', :'e_id', 'cashier');

-- Importar: crea, y si el código o el nombre ya existen, actualiza
select public.import_products(:'e_id', '[
  {"name":"Yerba 1kg","price":3000,"cost":2000,"code":"779000000001","stock":10},
  {"name":"Almendras","price":12000,"cost":8000,"unit":"kg"},
  {"name":"Galletitas","price":1000}
]'::jsonb) as r1 \gset
select pg_temp.check((:'r1'::jsonb ->> 'nuevos')::int = 3, 'Importar crea los productos nuevos');
select public.import_products(:'e_id', '[
  {"name":"Yerba Playadito 1kg","price":3200,"code":"779000000001"},
  {"name":"almendras","price":12500,"cost":8500}
]'::jsonb) as r2 \gset
select pg_temp.check((:'r2'::jsonb ->> 'actualizados')::int = 2 and (select count(*) from products where business_id = :'e_id') = 3,
  'Importar de nuevo actualiza por código o por nombre, sin duplicar');
select pg_temp.check((select name = 'Yerba Playadito 1kg' and price = 3200 and stock = 10 from products where code = '779000000001'),
  'Actualiza nombre y precio y deja el stock si no viene');
select pg_temp.check((select c.cost = 8500 and p.unit = 'kg' from products p join product_costs c on c.product_id = p.id where p.name = 'Almendras'),
  'Actualiza el costo y deja la unidad si no viene');
do $$ begin
  begin
    perform public.import_products(current_setting('my.e_id')::uuid, '[{"name":"Bien","price":10},{"name":"Mal","price":0}]'::jsonb);
    raise exception 'FALLÓ: importó una fila con precio 0';
  exception when check_violation then raise notice 'ok: si una fila está mal no se importa nada';
  end;
end $$;
select pg_temp.check(not exists (select 1 from products where name = 'Bien'), 'y no queda nada a medias');

-- Ganancia: cada venta guarda el costo de lo vendido
select id as yerba from products where code = '779000000001' \gset
select id as almendras from products where name = 'Almendras' \gset
select id as galletitas from products where name = 'Galletitas' \gset
insert into sales (business_id, shop_id, payment, amount, items) values (:'e_id', :'centro', 'Efectivo', 10650,
  jsonb_build_array(
    jsonb_build_object('id', :'yerba', 'qty', 2, 'price', 3200),
    jsonb_build_object('id', :'almendras', 'qty', 250, 'price', 12500),
    jsonb_build_object('id', :'galletitas', 'qty', 1, 'price', 1000)))
  returning id as venta \gset
select pg_temp.check((select base = 9525 and cost = 6125 from sale_costs where sale_id = :'venta'),
  'La venta guarda lo cobrado y el costo de los productos con costo (kilos en gramos)');

-- Aumentar precios
select public.raise_prices(:'e_id', array[:'yerba', :'galletitas']::uuid[], 10, 10, true) as n \gset
select pg_temp.check(:n = 2, 'Aumenta los productos elegidos');
select pg_temp.check((select price from products where id = :'yerba') = 3520 and (select price from products where id = :'galletitas') = 1100,
  'Sube el porcentaje y redondea a $10');
select pg_temp.check((select cost from product_costs where product_id = :'yerba') = 2200, 'También sube el costo si se pide');
select pg_temp.check((select price from products where id = :'almendras') = 12500, 'No toca los que no se eligieron');
select pg_temp.check((select cost from sale_costs where sale_id = :'venta') = 6125, 'La ganancia de ventas viejas no cambia');

-- La cajera no ve costos ni puede cambiar precios
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select public.join_business('CAJAEVA1', 'Cajera');
select pg_temp.check((select count(*) from product_costs) = 0, 'La cajera no ve los costos');
insert into sales (business_id, shop_id, payment, amount, items) values (:'e_id', :'centro', 'Efectivo', 3520,
  jsonb_build_array(jsonb_build_object('id', :'yerba', 'qty', 1, 'price', 3520))) returning id as venta2 \gset
select pg_temp.check((select count(*) from sale_costs) = 0, 'ni el costo de lo que vende');
do $$ begin
  begin
    perform public.raise_prices(current_setting('my.e_id')::uuid, array[]::uuid[], 10, 1, false);
    raise exception 'FALLÓ: la cajera aumentó precios';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: la cajera no puede aumentar precios';
  end;
end $$;
do $$ begin
  begin
    perform public.import_products(current_setting('my.e_id')::uuid, '[{"name":"X","price":1}]'::jsonb);
    raise exception 'FALLÓ: la cajera importó productos';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: ni importar productos';
  end;
end $$;
insert into suggestions (business_id, body) values (:'e_id', 'Que se pueda fiar');
select pg_temp.check((select count(*) from suggestions) = 0, 'La cajera manda una sugerencia pero no ve las sugerencias');
select pg_temp.check((select count(*) from public.admin_suggestions()) = 0, 'ni el panel del administrador');
reset role;
select pg_temp.check((select cost = 2200 and base = 3520 from sale_costs where sale_id = :'venta2'), 'pero la venta de la cajera sí guarda el costo');

-- Otro negocio no ve ni toca nada de Eva
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select public.create_business('Kiosco Otro', 'Otro', array['Uno'], false, array['Efectivo'], 'OTRO0001') as o_id \gset
select pg_temp.check((select count(*) from product_costs) = 0 and (select count(*) from sale_costs) = 0, 'Otro negocio no ve costos ajenos');
do $$ begin
  begin
    perform public.raise_prices(current_setting('my.e_id')::uuid, array[]::uuid[], 10, 1, false);
    raise exception 'FALLÓ: otro negocio aumentó precios ajenos';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: otro negocio no puede aumentar precios ajenos';
  end;
end $$;
select set_config('my.yerba', :'yerba', false);
do $$ begin
  begin
    insert into product_costs (product_id, business_id, cost)
      values (current_setting('my.yerba')::uuid, (select id from businesses where name = 'Kiosco Otro'), 1);
    raise exception 'FALLÓ: le puso costo a un producto ajeno';
  exception when insufficient_privilege then raise notice 'ok: no le pone costo a un producto ajeno';
  end;
end $$;
do $$ begin
  begin
    insert into suggestions (business_id, body) values (current_setting('my.e_id')::uuid, 'Hola');
    raise exception 'FALLÓ: mandó una sugerencia a nombre de otro negocio';
  exception when insufficient_privilege then raise notice 'ok: no manda sugerencias a nombre de otro negocio';
  end;
end $$;
reset role;

-- El administrador de la app ve las sugerencias
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.admin_suggestions() where body = 'Que se pueda fiar' and business = 'Almacén Eva' and email = 'cajera@e.com') = 1,
  'El administrador ve la sugerencia, con el negocio y el email');
update suggestions set done = true;
select pg_temp.check((select done from public.admin_suggestions() limit 1), 'y la marca como leída');
reset role;
