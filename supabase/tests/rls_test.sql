-- Prueba que cada negocio vea solo lo suyo y que los roles se respeten.
\set ON_ERROR_STOP on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'ana@a.com'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@b.com'),
  ('00000000-0000-0000-0000-00000000000c', 'caja@a.com'),
  ('00000000-0000-0000-0000-00000000000d', 'duenio@app.com');
-- El dueño de la app es administrador y entrega los códigos de alta
insert into platform_admins values ('00000000-0000-0000-0000-00000000000d');
insert into signup_codes (code, note) values ('ANA00001', 'Ana'), ('BETO0001', 'Beto');

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

-- Ana crea su negocio (sin código no puede)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    perform public.create_business('Sin código', 'Ana', array['X'], false, array['Efectivo']);
    raise exception 'FALLÓ: se creó un negocio sin código';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: sin código de alta no se crea un negocio';
  end;
end $$;
select pg_temp.check((select count(*) from signup_codes) = 0, 'Ana no ve los códigos de alta');
select pg_temp.check(public.admin_user_count() is null and (select count(*) from public.admin_overview()) = 0, 'Ana no ve el resumen del administrador');
select public.create_business('Dietética Ana', 'Ana', array['Centro','Norte'], true,
  array['Efectivo','Transferencia','QR'], 'ana00001') as a_id \gset
select pg_temp.check((select trial_ends_at::date from businesses) = current_date + 7, 'La prueba gratis dura 7 días');
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
do $$ begin
  begin
    perform public.create_business('Otro', 'Beto', array['X'], false, array['Efectivo'], 'ANA00001');
    raise exception 'FALLÓ: un código se usó dos veces';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: un código de alta sirve una sola vez';
  end;
end $$;
do $$ begin
  begin
    insert into signup_codes (code) values ('HACKEADO');
    raise exception 'FALLÓ: Beto creó un código de alta';
  exception when insufficient_privilege then raise notice 'ok: Beto no puede crear códigos de alta';
  end;
end $$;
select public.create_business('Almacén Beto', 'Beto', array['Único'], false, array['Efectivo'], 'BETO0001') as b_id \gset
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

-- Stock: la venta descuenta, borrarla devuelve, y nadie toca el stock de otro negocio
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into products (business_id, name, price, unit, stock) values (:'a_id', 'Maní', 100, 'u', 10) returning id as mani \gset
insert into products (business_id, name, price, unit, stock) values (:'a_id', 'Nueces', 5000, 'kg', 2) returning id as nuez \gset
insert into products (business_id, name, price, unit) values (:'a_id', 'Pasas', 300, 'u') returning id as pasas \gset
select set_config('my.mani', :'mani', false);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into sales (business_id, shop_id, payment, amount, items) values (:'a_id', :'centro', 'Efectivo', 1500, jsonb_build_array(
  jsonb_build_object('id', :'mani', 'name', 'Maní', 'qty', 3, 'unit', 'u', 'price', 100),
  jsonb_build_object('id', :'nuez', 'name', 'Nueces', 'qty', 250, 'unit', 'kg', 'price', 5000),
  jsonb_build_object('id', :'pasas', 'name', 'Pasas', 'qty', 1, 'unit', 'u', 'price', 300))) returning id as venta \gset
select pg_temp.check((select stock from products where id = :'mani') = 7, 'La venta de la cajera descuenta 3 unidades');
select pg_temp.check((select stock from products where id = :'nuez') = 1.75, 'Vender 250 g descuenta 0,25 kg');
select pg_temp.check((select stock from products where id = :'pasas') is null, 'Un producto sin stock cargado sigue sin control');
delete from sales where id = :'venta';
select pg_temp.check((select stock from products where id = :'mani') = 10, 'Borrar la venta devuelve el stock');
update products set stock = 999 where id = :'mani';
select pg_temp.check((select stock from products where id = :'mani') = 10, 'La cajera no puede cambiar el stock a mano');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into sales (business_id, shop_id, payment, amount, items)
  select :'b_id', id, 'Efectivo', 100, jsonb_build_array(jsonb_build_object('id', current_setting('my.mani'), 'qty', 5)) from shops limit 1;
reset role;
select pg_temp.check((select stock from products where id = :'mani') = 10, 'Una venta de Beto no toca el stock de Ana');

-- Suscripción: el dueño no puede tocar su plan; sin prueba ni pago no se venden
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    update businesses set plan = 'free', paid_until = now() + interval '10 years';
    raise exception 'FALLÓ: el dueño se regaló el plan';
  exception when insufficient_privilege then raise notice 'ok: el dueño no puede cambiar su plan ni su fecha de pago';
  end;
end $$;
update businesses set name = 'Dietética Ana' where id = :'a_id';
select pg_temp.check((select count(*) from businesses where name = 'Dietética Ana') = 1, 'pero sí el nombre del negocio');
select pg_temp.check(public.subscription_price(:'a_id') = 15000, 'Los primeros negocios pagan 15000');
do $$ begin
  begin
    perform public.mp_apply(current_setting('my.a_id')::uuid, 'x', 'authorized', now() + interval '1 year');
    raise exception 'FALLÓ: la app pudo marcar un pago';
  exception when insufficient_privilege then raise notice 'ok: la app no puede marcar pagos (solo Mercado Pago)';
  end;
end $$;
do $$ begin
  begin
    perform public.mp_set_price(current_setting('my.a_id')::uuid, 1);
    raise exception 'FALLÓ: la app cambió su precio';
  exception when insufficient_privilege then raise notice 'ok: la app no puede cambiar su precio';
  end;
end $$;
do $$ begin
  begin
    perform public.admin_set_free(current_setting('my.a_id')::uuid, true);
    raise exception 'FALLÓ: el dueño se dio acceso gratis';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: solo el administrador da acceso gratis';
  end;
end $$;
reset role;
update businesses set trial_ends_at = now() - interval '1 day' where id = :'a_id';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    insert into sales (business_id, shop_id, payment, amount) values (current_setting('my.a_id')::uuid, current_setting('my.centro')::uuid, 'Efectivo', 100);
    raise exception 'FALLÓ: se vendió con la prueba vencida';
  exception when insufficient_privilege then raise notice 'ok: con la prueba vencida no se anotan ventas';
  end;
end $$;
reset role;
set role service_role;
select public.mp_attach(:'a_id', 'pre-1', public.subscription_price(:'a_id'));
select pg_temp.check(not public.mp_apply(:'a_id', 'otro', 'authorized', now() + interval '30 days'), 'Un aviso de otra suscripción no cambia nada');
select pg_temp.check(public.mp_apply(:'a_id', 'pre-1', 'authorized', now() + interval '30 days'), 'Mercado Pago confirma la suscripción');
reset role;
select pg_temp.check((select plan = 'active' and price = 15000 and intro_price and paid_until::date = current_date + 33 from businesses where id = :'a_id'), 'queda activa, con precio de lanzamiento y 3 días de gracia');
set role service_role;
select public.mp_set_price(:'a_id', 18000);
reset role;
select pg_temp.check((select price = 18000 and not intro_price from businesses where id = :'a_id'), 'Pasado el primer mes queda en el precio normal');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into sales (business_id, shop_id, payment, amount) values (:'a_id', :'centro', 'Efectivo', 100);
select pg_temp.check(true, 'Con la suscripción al día se vuelve a vender');
reset role;
set role service_role;
select public.mp_apply(:'a_id', 'pre-1', 'cancelled', null);
reset role;
select pg_temp.check((select plan = 'paused' and public.can_sell(id) from businesses where id = :'a_id'), 'Si cancela, puede vender hasta el fin del período pagado');
update businesses set paid_until = now() - interval '1 minute' where id = :'a_id';
select pg_temp.check(not public.can_sell(:'a_id'), 'Pasado el período pagado, ya no');

-- El administrador ve el resumen y crea códigos
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.admin_overview()) = 2, 'El administrador ve los 2 negocios');
select pg_temp.check((select owner_email from public.admin_overview() where name = 'Dietética Ana') = 'ana@a.com', 'y el email de cada dueño');
select pg_temp.check(public.admin_user_count() = 4, 'y cuántos usuarios hay');
insert into signup_codes (note) values ('Dietética Sol');
select public.admin_set_free(current_setting('my.a_id')::uuid, true);
select pg_temp.check(public.can_sell(current_setting('my.a_id')::uuid), 'El administrador puede dar acceso gratis');
update platform_settings set founder_slots = 0;
select pg_temp.check(public.subscription_price(current_setting('my.b_id')::uuid) = 18000, 'Pasados los primeros negocios el precio es 18000');
select pg_temp.check((select count(*) from signup_codes where used_by is null) = 1, 'El administrador crea códigos nuevos');
reset role;

-- Sin sesión no se ve nada
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.check((select count(*) from businesses) = 0, 'Sin sesión no se ve ningún negocio');
select pg_temp.check((select count(*) from sales) = 0, 'Sin sesión no se ven ventas');
reset role;
