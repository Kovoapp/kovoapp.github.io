-- Prueba pagar de a un mes y los pagos anotados a mano por el administrador.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-0000000000f1', 'flor@f.com');
insert into signup_codes (code) values ('FLOR0001');

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.create_business('Kiosco Flor', 'Flor', array['Uno'], false, array['Efectivo'], 'FLOR0001') as f_id \gset
select set_config('my.f_id', :'f_id', false);

-- La dueña no puede anotarse meses pagos
do $$ begin
  begin
    perform public.admin_mark_paid(current_setting('my.f_id')::uuid);
    raise exception 'FALLÓ: la dueña se anotó un mes pago';
  exception when raise_exception then
    if sqlerrm like 'FALLÓ%' then raise; end if;
    raise notice 'ok: la dueña no puede anotarse un mes pago';
  end;
end $$;
do $$ begin
  begin
    perform public.mp_pay_month(current_setting('my.f_id')::uuid, '1', 18000);
    raise exception 'FALLÓ: la dueña llamó a mp_pay_month';
  exception when insufficient_privilege then raise notice 'ok: ni simular un pago de Mercado Pago';
  end;
end $$;
reset role;

-- Vencida la prueba, un pago de Mercado Pago suma 30 días desde hoy
update businesses set trial_ends_at = now() - interval '1 day' where id = :'f_id';
select pg_temp.check(not public.can_sell(:'f_id'), 'Sin pagar, con la prueba vencida, no puede vender');
select pg_temp.check(public.mp_pay_month(:'f_id', '555', 15000), 'Anota el pago de Mercado Pago');
select pg_temp.check((select plan = 'active' and paid_until between now() + interval '29 days' and now() + interval '31 days' from businesses where id = :'f_id'),
  'Queda activo por 30 días');
select pg_temp.check(public.can_sell(:'f_id'), 'y puede vender');
select pg_temp.check((select price = 18000 and not intro_price from businesses where id = :'f_id'), 'Después del primer mes queda el precio normal');
select pg_temp.check(not public.mp_pay_month(:'f_id', '555', 15000), 'Si el aviso llega repetido no suma dos veces');
select pg_temp.check((select paid_until < now() + interval '31 days' from businesses where id = :'f_id'), 'y la fecha no cambia');

-- El administrador anota un mes pagado por transferencia: se suma al que ya tenía
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.admin_mark_paid(:'f_id') as hasta \gset
select pg_temp.check(:'hasta'::timestamptz between now() + interval '59 days' and now() + interval '61 days', 'El administrador suma otro mes después del que ya estaba pago');
select pg_temp.check((select count(*) = 2 and count(*) filter (where manual) = 1 from month_payments where business_id = :'f_id'), 'y ve los pagos');
select public.admin_set_free(:'f_id', true);
select public.admin_set_free(:'f_id', false);
reset role;
select pg_temp.check((select plan from businesses where id = :'f_id') = 'active', 'Al quitarle el acceso gratis sigue activo porque tiene meses pagos');

-- En prueba, el mes pago empieza cuando termina la prueba
update businesses set trial_ends_at = now() + interval '5 days', paid_until = null where id = :'f_id';
select public.mp_pay_month(:'f_id', '777', 18000);
select pg_temp.check((select paid_until between now() + interval '34 days' and now() + interval '36 days' from businesses where id = :'f_id'),
  'Si paga durante la prueba, el mes empieza cuando termina la prueba');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from month_payments) = 0, 'La dueña no ve la tabla de pagos');
reset role;
