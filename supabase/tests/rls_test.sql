-- Prueba que cada negocio vea solo lo suyo y que los roles se respeten.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'ana@a.com'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@b.com'),
  ('00000000-0000-0000-0000-00000000000c', 'caja@a.com');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- Ana crea su negocio
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_business('Dietética Ana', 'Ana', array['Centro','Norte'], true,
  array['Efectivo','Transferencia','QR']) as a_id \gset
select pg_temp.check((select count(*) from shops) = 3, 'Ana ve sus 3 locales (2 + Mayorista)');
select pg_temp.check((select wholesale from payment_methods where name='QR') = false, 'QR no se ofrece en mayorista');
select id as centro from shops where name='Centro' \gset
insert into sales (business_id, shop_id, payment, amount) values (:'a_id', :'centro', 'Efectivo', 1500);
insert into expenses (business_id, shop_id, kind, name, payment, amount) values (:'a_id', :'centro', 'supplier', 'Granos', 'Efectivo', 900);
insert into invites (business_id, role) values (:'a_id', 'cashier') returning code as inv \gset
select set_config('my.a_id', :'a_id', false), set_config('my.centro', :'centro', false), set_config('my.inv', :'inv', false);
reset role;

-- Beto crea otro negocio y no ve nada de Ana
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.create_business('Almacén Beto', 'Beto', array['Único'], false, array['Efectivo']) as b_id \gset
select set_config('my.b_id', :'b_id', false);
select pg_temp.check((select count(*) from businesses) = 1, 'Beto ve solo su negocio');
select pg_temp.check((select count(*) from sales) = 0, 'Beto no ve ventas de Ana');
select pg_temp.check((select count(*) from expenses) = 0, 'Beto no ve pagos de Ana');
select pg_temp.check((select count(*) from shops where name='Centro') = 0, 'Beto no ve locales de Ana');
do $$ begin
  begin
    insert into sales (business_id, shop_id, payment, amount)
      values (current_setting('my.a_id')::uuid, current_setting('my.centro')::uuid, 'Efectivo', 10);
    raise exception 'FALLÓ: Beto pudo anotar en el negocio de Ana';
  exception when insufficient_privilege then raise notice 'ok: Beto no puede anotar ventas en el negocio de Ana';
  end;
end $$;
-- Beto no puede usar un local de Ana en su propio negocio
do $$ begin
  begin
    insert into sales (business_id, shop_id, payment, amount)
      values (current_setting('my.b_id')::uuid, current_setting('my.centro')::uuid, 'Efectivo', 10);
    raise exception 'FALLÓ: Beto usó un local ajeno';
  exception when insufficient_privilege then raise notice 'ok: Beto no puede usar un local de otro negocio';
  end;
end $$;
reset role;

-- La cajera se une a Ana con el código
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.join_business(:'inv', 'Caro') = :'a_id', 'La cajera se une con el código');
select pg_temp.check((select count(*) from sales) = 0, 'La cajera no ve las ventas de otros');
select pg_temp.check((select count(*) from expenses) = 0, 'La cajera no ve pagos a proveedores');
insert into sales (business_id, shop_id, payment, amount) values (:'a_id', :'centro', 'QR', 700);
select pg_temp.check((select count(*) from sales) = 1, 'La cajera ve su propia venta');
delete from sales;
select pg_temp.check((select count(*) from sales) = 0, 'La cajera puede deshacer su venta reciente');
insert into sales (business_id, shop_id, payment, amount) values (:'a_id', :'centro', 'QR', 800);
update shops set name = 'Hackeado';
select pg_temp.check((select count(*) from shops where name='Hackeado') = 0, 'La cajera no puede renombrar locales');
do $$ begin
  begin update members set role = 'owner'; exception when insufficient_privilege then null; end;
end $$;
select pg_temp.check(public.my_role(:'a_id') = 'cashier', 'La cajera no puede subirse de rol');
do $$ begin
  begin
    perform public.join_business(current_setting('my.inv'), 'Otra vez');
    raise exception 'FALLÓ: el código se pudo usar dos veces';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: el código de invitación sirve una sola vez';
  end;
end $$;
reset role;

-- Ana ve todo lo de su negocio
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from sales) = 2, 'Ana ve todas las ventas de su negocio');
select pg_temp.check((select count(*) from members) = 2, 'Ana ve a su equipo');
reset role;

-- Sin sesión no se ve nada
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check((select count(*) from businesses) = 0, 'Sin sesión no se ve ningún negocio');
select pg_temp.check((select count(*) from sales) = 0, 'Sin sesión no se ven ventas');
reset role;
