-- Pagar de a un mes (sin suscripción) y pagos anotados a mano por el administrador.
-- Se puede correr más de una vez sin problema: SQL Editor -> pegar este archivo -> Run.

-- ---------------------------------------------------------------
-- Cada mes pagado: por Mercado Pago (el id del pago) o anotado a mano.
-- El id evita sumar dos veces el mismo pago si el aviso llega repetido.
-- ---------------------------------------------------------------
create table if not exists public.month_payments (
  payment_id text primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount numeric(12, 2),
  manual boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists month_payments_business_idx on public.month_payments (business_id, created_at desc);
alter table public.month_payments enable row level security;
drop policy if exists month_payments_admin on public.month_payments;
create policy month_payments_admin on public.month_payments for select using (public.is_platform_admin());

-- Suma un mes al negocio: desde hoy, desde que termina la prueba o desde lo que ya tenía pago.
-- El precio de lanzamiento es solo para el primer mes: después de este pago, queda el precio normal.
create or replace function public.add_paid_month(p_business uuid, p_payment text, p_amount numeric, p_manual boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into month_payments (payment_id, business_id, amount, manual)
  values (p_payment, p_business, p_amount, p_manual)
  on conflict (payment_id) do nothing;
  if not found then return false; end if;
  update businesses set
    paid_until = greatest(now(), coalesce(trial_ends_at, now()), coalesce(paid_until, now())) + interval '30 days',
    plan = case when plan = 'free' then plan else 'active' end,
    price = case when p_manual then price
                 when price is null or intro_price then (select regular_price from platform_settings where id = 1)
                 else price end,
    intro_price = case when p_manual then intro_price else false end
   where id = p_business;
  return found;
end $$;

-- Lo llama la función de Mercado Pago (con la clave de servicio) cuando se aprueba un pago.
create or replace function public.mp_pay_month(p_business uuid, p_payment text, p_amount numeric)
returns boolean language sql security definer set search_path = public as $$
  select public.add_paid_month(p_business, 'mp-' || p_payment, p_amount, false)
$$;

-- El administrador anota un mes pagado (por ejemplo, por transferencia).
create or replace function public.admin_mark_paid(p_business uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  hasta timestamptz;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  perform public.add_paid_month(p_business, 'manual-' || gen_random_uuid(), null, true);
  select paid_until into hasta from businesses where id = p_business;
  return hasta;
end $$;

-- Al quitar el acceso gratis, si tiene meses pagos sigue activo.
create or replace function public.admin_set_free(p_business uuid, p_free boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  update businesses set plan = case when p_free then 'free'
                                    when mp_status = 'authorized' or paid_until > now() then 'active'
                                    when mp_preapproval_id is not null then 'paused' else 'trial' end
   where id = p_business;
end $$;

revoke all on function public.add_paid_month(uuid, text, numeric, boolean) from public, anon, authenticated;
revoke all on function public.mp_pay_month(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.admin_mark_paid(uuid) from public, anon;
revoke all on function public.admin_set_free(uuid, boolean) from public, anon;
grant execute on function public.mp_pay_month(uuid, text, numeric) to service_role;
grant execute on function public.admin_mark_paid(uuid) to authenticated;
grant execute on function public.admin_set_free(uuid, boolean) to authenticated;
