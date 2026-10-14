-- Prueba el registro sin código y el fiado (cuenta corriente de clientes).
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1', 'rosa@r.com'), ('00000000-0000-0000-0000-0000000000a2', 'caje@r.com');
insert into signup_codes (code) values ('ROSA0002');

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
create function pg_temp.falla(q text, err text, msg text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm like '%' || err || '%' then raise notice 'ok: %', msg; return; end if;
    raise exception 'FALLÓ: % (otro error: %)', msg, sqlerrm;
  end;
  raise exception 'FALLÓ: % (no dio error)', msg;
end $$;

-- Registro sin código: un negocio por cuenta
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.create_business('Almacén Rosa', 'Rosa', array['Centro'], false, array['Efectivo'], '') as r_id \gset
select set_config('my.r_id', :'r_id', false);
select pg_temp.check(exists (select 1 from businesses where id = :'r_id' and trial_ends_at > now() + interval '6 days'), 'se crea un negocio sin código, con 7 días de prueba');
select pg_temp.falla($$select public.create_business('Otro', 'Rosa', array['A'], false, array['Efectivo'])$$, 'already_owner', 'sin código no se puede crear un segundo negocio');
select pg_temp.falla($$select public.create_business('Otro', 'Rosa', array['A'], false, array['Efectivo'], 'NOEXISTE')$$, 'invalid_signup_code', 'un código que no existe sigue dando error');
select pg_temp.check(public.create_business('Segundo', 'Rosa', array['A'], false, array['Efectivo'], 'ROSA0002') is not null, 'con un código válido se puede crear otro');

-- Activar el fiado: lo hace la dueña
update businesses set fiado = true where id = :'r_id';
select pg_temp.check((select fiado from businesses where id = :'r_id'), 'la dueña activa el fiado');
select id as shop from shops where business_id = :'r_id' \gset
reset role;
insert into members (business_id, user_id, role, display_name) values (:'r_id', '00000000-0000-0000-0000-0000000000a2', 'cashier', 'Caje');

-- Una venta fiada: crea el cliente y suma a su cuenta
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update businesses set fiado = false where id = :'r_id';
select pg_temp.check((select fiado from businesses where id = :'r_id'), 'el cajero no puede apagar el fiado');
select pg_temp.falla(format($$insert into sales (business_id, shop_id, payment, amount) values (%L, %L, 'Fiado', 500)$$, :'r_id', :'shop'), 'fiado_sin_cliente', 'no se puede fiar sin cliente');
insert into sales (id, business_id, shop_id, payment, amount, client_name) values ('00000000-0000-0000-0000-00000000aa01', :'r_id', :'shop', 'Fiado', 3500, 'Doña Marta');
insert into sales (business_id, shop_id, payment, amount, client_name) values (:'r_id', :'shop', 'Fiado', 1500, 'Doña Marta');
select id as marta from clients where business_id = :'r_id' and name = 'Doña Marta' \gset
select pg_temp.check((select sum(amount) from fiados where client_id = :'marta' and kind = 'fiado') = 5000, 'las ventas fiadas quedan en la cuenta del cliente, que se crea solo');
insert into sales (business_id, shop_id, payment, amount) values (:'r_id', :'shop', 'Efectivo', 800);
select pg_temp.check((select count(*) from fiados where business_id = :'r_id') = 2, 'una venta en efectivo no toca el fiado');

-- Pagos: el cajero los anota, pero no puede inventar fiado
insert into fiados (business_id, client_id, kind, amount, payment, shop_id) values (:'r_id', :'marta', 'pago', 2000, 'Efectivo', :'shop');
select pg_temp.check((select sum(case kind when 'fiado' then amount else -amount end) from fiados where client_id = :'marta') = 3000, 'el pago baja lo que debe');
select pg_temp.falla(format($$insert into fiados (business_id, client_id, kind, amount, shop_id) values (%L, %L, 'fiado', 9999, %L)$$, :'r_id', :'marta', :'shop'), 'row-level security', 'a mano no se puede anotar fiado');
delete from fiados where kind = 'pago';
select pg_temp.check((select count(*) from fiados where kind = 'pago') = 1, 'el cajero no borra pagos');
reset role;

-- Otro negocio no ve ni toca las cuentas
insert into auth.users values ('00000000-0000-0000-0000-0000000000a3', 'otro@o.com');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.check((select count(*) from fiados) = 0, 'otro negocio no ve el fiado');
select pg_temp.falla(format($$insert into fiados (business_id, client_id, kind, amount, shop_id) values (%L, %L, 'pago', 1, %L)$$, :'r_id', :'marta', :'shop'), 'row-level security', 'ni le anota pagos');
reset role;

-- La dueña borra el pago; borrar la venta saca lo fiado; un cliente con cuenta no se borra
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
delete from fiados where kind = 'pago';
select pg_temp.check((select count(*) from fiados where kind = 'pago') = 0, 'la dueña borra un pago mal anotado');
delete from sales where id = '00000000-0000-0000-0000-00000000aa01';
select pg_temp.check((select sum(amount) from fiados where client_id = :'marta') = 1500, 'borrar la venta fiada la saca de la cuenta');
select pg_temp.falla(format($$delete from clients where id = %L$$, :'marta'), 'foreign key', 'no se borra un cliente que tiene fiado');
reset role;
