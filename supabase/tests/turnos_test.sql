-- Prueba los turnos: la dueña los activa, todo el equipo los maneja y otro negocio no los ve.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000b1', 'pelu@p.com'), ('00000000-0000-0000-0000-0000000000b2', 'lu@p.com'), ('00000000-0000-0000-0000-0000000000b3', 'otra@o.com');

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.create_business('Peluquería Sol', 'Sol', array['Centro'], false, array['Efectivo'], '') as p_id \gset
select pg_temp.check(not (select turnos from businesses where id = :'p_id'), 'los turnos arrancan apagados');
update businesses set turnos = true where id = :'p_id';
select pg_temp.check((select turnos from businesses where id = :'p_id'), 'la dueña activa los turnos');
select id as shop from shops where business_id = :'p_id' \gset
reset role;
insert into members (business_id, user_id, role, display_name) values (:'p_id', '00000000-0000-0000-0000-0000000000b2', 'cashier', 'Lu');

-- La peluquera (cajera) anota, cambia y cobra turnos
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
update businesses set turnos = false where id = :'p_id';
select pg_temp.check((select turnos from businesses where id = :'p_id'), 'la cajera no puede apagar los turnos');
insert into turnos (id, business_id, day, hora, minutos, cliente, telefono, servicio, precio, atiende)
  values ('00000000-0000-0000-0000-00000000bb01', :'p_id', current_date, '10:00', 45, 'Ana', '3329 123456', 'Corte', 9000, 'Lu');
insert into turnos (business_id, day, hora, cliente) values (:'p_id', current_date, '11:30', 'Juli');
select pg_temp.check((select count(*) from turnos where business_id = :'p_id') = 2, 'la cajera anota turnos');
select pg_temp.falla(format($$insert into turnos (business_id, day, hora, cliente) values (%L, current_date, '25:00', 'X')$$, :'p_id'), 'check', 'una hora inválida no entra');
select pg_temp.falla(format($$insert into turnos (business_id, day, hora, cliente) values (%L, current_date, '09:00', '  ')$$, :'p_id'), 'check', 'sin nombre de cliente no entra');
insert into sales (id, business_id, shop_id, payment, amount) values ('00000000-0000-0000-0000-00000000bb10', :'p_id', :'shop', 'Efectivo', 9000);
update turnos set estado = 'atendido', sale_id = '00000000-0000-0000-0000-00000000bb10' where id = '00000000-0000-0000-0000-00000000bb01';
select pg_temp.check((select estado from turnos where id = '00000000-0000-0000-0000-00000000bb01') = 'atendido', 'al cobrarlo queda atendido y unido a la venta');
update turnos set estado = 'no_vino' where cliente = 'Juli';
select pg_temp.check((select estado from turnos where cliente = 'Juli') = 'no_vino', 'se marca que no vino');
select pg_temp.falla($$update turnos set created_by = '00000000-0000-0000-0000-0000000000b1'$$, 'permission', 'quién lo anotó no se cambia');
delete from turnos where cliente = 'Juli';
select pg_temp.check((select count(*) from turnos where business_id = :'p_id') = 1, 'la cajera borra un turno cancelado');
reset role;

-- Otro negocio no ve ni toca la agenda, ni puede unir sus turnos a ventas ajenas
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select public.create_business('Otra', 'Otra', array['A'], false, array['Efectivo'], '') as o_id \gset
select pg_temp.check((select count(*) from turnos) = 0, 'otro negocio no ve los turnos');
select pg_temp.falla(format($$insert into turnos (business_id, day, hora, cliente) values (%L, current_date, '10:00', 'Intrusa')$$, :'p_id'), 'row-level security', 'ni anota turnos en la agenda ajena');
update turnos set cliente = 'Cambiado';
delete from turnos;
select pg_temp.falla(format($$insert into turnos (business_id, day, hora, cliente, sale_id) values (%L, current_date, '10:00', 'Mía', '00000000-0000-0000-0000-00000000bb10')$$, :'o_id'), 'row-level security', 'ni une un turno propio a una venta ajena');
reset role;
select pg_temp.check((select cliente from turnos where id = '00000000-0000-0000-0000-00000000bb01') = 'Ana', 'la agenda ajena queda intacta');

-- Borrar la venta no borra el turno
delete from sales where id = '00000000-0000-0000-0000-00000000bb10';
select pg_temp.check((select sale_id is null from turnos where id = '00000000-0000-0000-0000-00000000bb01'), 'si se borra la venta, el turno queda sin venta');
