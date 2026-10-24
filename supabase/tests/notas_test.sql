-- Prueba el anotador: lo usa todo el equipo y otro negocio no lo ve.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000c1', 'kiosco@k.com'), ('00000000-0000-0000-0000-0000000000c2', 'caje@k.com'), ('00000000-0000-0000-0000-0000000000c3', 'ajena@a.com');

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.create_business('Kiosco Notas', 'Kiko', array['Centro'], false, array['Efectivo'], '') as k_id \gset
update businesses set notas = true where id = :'k_id';
select pg_temp.check((select notas from businesses where id = :'k_id'), 'el dueño activa el anotador');
insert into notas (business_id, texto) values (:'k_id', 'Pedir yerba');
reset role;
insert into members (business_id, user_id, role, display_name) values (:'k_id', '00000000-0000-0000-0000-0000000000c2', 'cashier', 'Caje');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
update businesses set notas = false where id = :'k_id';
select pg_temp.check((select notas from businesses where id = :'k_id'), 'el cajero no apaga el anotador');
select pg_temp.check((select count(*) from notas) = 1, 'el cajero ve lo que anotó el dueño');
insert into notas (business_id, texto) values (:'k_id', 'Llamar al de las gaseosas');
update notas set hecha = true where texto = 'Pedir yerba';
select pg_temp.check((select hecha from notas where texto = 'Pedir yerba'), 'el cajero la tacha como hecha');
select pg_temp.falla(format($$insert into notas (business_id, texto) values (%L, '   ')$$, :'k_id'), 'check', 'una nota vacía no entra');
select pg_temp.falla($$update notas set created_by = '00000000-0000-0000-0000-0000000000c1'$$, 'permission', 'quién la anotó no se cambia');
delete from notas where hecha;
select pg_temp.check((select count(*) from notas) = 1, 'y borra las hechas');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
select pg_temp.check((select count(*) from notas) = 0, 'otro negocio no ve el anotador');
select pg_temp.falla(format($$insert into notas (business_id, texto) values (%L, 'Hola')$$, :'k_id'), 'row-level security', 'ni le anota cosas');
update notas set texto = 'cambiado'; delete from notas;
reset role;
select pg_temp.check((select texto from notas where business_id = :'k_id') = 'Llamar al de las gaseosas', 'el anotador ajeno queda intacto');
