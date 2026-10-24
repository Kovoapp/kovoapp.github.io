-- Prueba los turnos online: sin cuenta se ven los horarios libres y se pide turno, con todos los controles.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1', 'pelu@online.com');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
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
-- Un día que el negocio abre, dentro de una semana (siempre en el futuro)
create function pg_temp.dia_abierto() returns date language sql as $$
  select d::date from generate_series(public.reservas_hoy() + 7, public.reservas_hoy() + 14, interval '1 day') d where extract(isodow from d) between 1 and 5 limit 1
$$;
create function pg_temp.domingo() returns date language sql as $$
  select d::date from generate_series(public.reservas_hoy() + 1, public.reservas_hoy() + 8, interval '1 day') d where extract(isodow from d) = 7 limit 1
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select public.create_business('Peluquería Online', 'Ro', array['Centro'], false, array['Efectivo'], '') as b_id \gset
insert into products (business_id, name, price) values (:'b_id', 'Corte', 8000);
insert into products (business_id, name, price, stock) values (:'b_id', 'Shampoo', 9500, 5);
update businesses set turnos = true, reservas_slug = 'pelu-online',
  reservas_horario = '{"dias": [1, 2, 3, 4, 5], "desde": "09:00", "hasta": "12:00", "minutos": 30, "lugares": 1}' where id = :'b_id';
reset role;

select pg_temp.as_anon();
select pg_temp.check(public.reservas_info('pelu-online') is null, 'con los turnos online apagados el link no muestra nada');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:00', '', 'Ana', '3329412345')$$, 'reserva_cerrada', 'ni deja pedir turno');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
update businesses set reservas = true where id = :'b_id';
select pg_temp.falla(format($$update businesses set reservas_slug = 'Con Espacios' where id = %L$$, :'b_id'), 'check', 'el link solo lleva minúsculas, números y guiones');
reset role;

select pg_temp.as_anon();
select public.reservas_info('pelu-online') as info \gset
select pg_temp.check((:'info'::jsonb)->>'nombre' = 'Peluquería Online' and jsonb_array_length((:'info'::jsonb)->'servicios') = 1 and (:'info'::jsonb)->'servicios'->0->>'nombre' = 'Corte', 'el link muestra el nombre y los servicios, sin los productos con stock');
select pg_temp.check(public.reservas_info('PELU-ONLINE ') is not null, 'el link no distingue mayúsculas');
select pg_temp.check((select count(*) from businesses) = 0 and (select count(*) from products) = 0, 'sin cuenta no se leen las tablas directamente');
select pg_temp.check((select count(*) from turnos) = 0, 'ni la agenda');
select pg_temp.falla(format($$insert into turnos (business_id, day, hora, cliente) values (%L, current_date, '10:00', 'X')$$, :'b_id'), 'permission denied', 'ni anotar turnos sin pasar por el control');

select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:00', 'Corte', 'Ana López', '3329 41-2345') as t1 \gset
select pg_temp.check(:'t1' is not null, 'un cliente sin cuenta pide un turno libre');
select pg_temp.check((select count(*) from public.reservas_ocupado('pelu-online', pg_temp.dia_abierto()) where hora = '10:00' and minutos = 30) = 1, 'ese horario ya figura ocupado, sin el nombre');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:00', '', 'Otra', '3329000000')$$, 'reserva_ocupado', 'nadie más puede pedir el mismo horario');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:15', '', 'Otra', '3329000000')$$, 'reserva_horario', 'solo en los horarios de la grilla');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '12:00', '', 'Otra', '3329000000')$$, 'reserva_horario', 'ni pasado el cierre');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '08:30', '', 'Otra', '3329000000')$$, 'reserva_horario', 'ni antes de abrir');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.domingo(), '10:00', '', 'Otra', '3329000000')$$, 'reserva_horario', 'ni un día que no abre');
select pg_temp.falla($$select public.reservar_turno('pelu-online', public.reservas_hoy() - 1, '10:00', '', 'Otra', '3329000000')$$, 'reserva_horario', 'ni un día que ya pasó');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:30', '', '  ', '3329000000')$$, 'reserva_sin_nombre', 'pide el nombre');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:30', '', 'Otra', '123')$$, 'reserva_sin_telefono', 'y un WhatsApp de verdad');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:30', 'Shampoo', 'Otra', '3329000000')$$, 'reserva_servicio', 'solo los servicios del negocio');
select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:30', '', 'Ana López', '3329412345');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '11:00', '', 'Ana López', '(3329) 412345')$$, 'reserva_muchos', 'un mismo teléfono no acapara más de dos turnos');
select pg_temp.falla($$select public.reservar_turno('no-existe', pg_temp.dia_abierto(), '11:00', '', 'X', '3329000001')$$, 'reserva_cerrada', 'un link que no existe no anda');
reset role;

-- El negocio ve el turno en su agenda, con lo que eligió el cliente
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check((select origen = 'online' and servicio = 'Corte' and precio = 8000 and minutos = 30 and cliente = 'Ana López' and estado = 'pendiente' from turnos where id = :'t1'), 'el turno llega a la agenda como online, con servicio y precio');
update businesses set reservas_horario = jsonb_set(reservas_horario, '{lugares}', '2') where id = :'b_id';
update turnos set estado = 'no_vino' where hora = '10:30';
reset role;
select pg_temp.as_anon();
select pg_temp.check(public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:00', '', 'Juli', '3329000002') is not null, 'con dos lugares, entra un segundo turno a la misma hora');
select pg_temp.falla($$select public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:00', '', 'Tercera', '3329000003')$$, 'reserva_ocupado', 'pero no un tercero');
select pg_temp.check(public.reservar_turno('pelu-online', pg_temp.dia_abierto(), '10:30', '', 'Juli 2', '3329000004') is not null, 'el lugar de alguien que no vino queda libre');
reset role;
