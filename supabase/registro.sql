-- Registro directo: el código de alta pasa a ser opcional.
-- Sin código, cada cuenta puede crear un solo negocio (con su prueba de 7 días).
-- Con un código válido (o siendo administrador de la plataforma) no hay límite.
-- Se puede correr las veces que quieras.
create or replace function public.create_business(
  p_name text,
  p_owner_name text,
  p_shops text[],
  p_wholesale boolean,
  p_payments text[],
  p_code text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b uuid;
  i int;
  sc text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if btrim(coalesce(p_code, '')) <> '' then
    select code into sc from signup_codes
      where code = upper(btrim(p_code)) and used_by is null and expires_at > now()
      for update;
    if not found then raise exception 'invalid_signup_code'; end if;
  elsif not public.is_platform_admin()
        and exists (select 1 from members where user_id = auth.uid() and role = 'owner') then
    raise exception 'already_owner';
  end if;
  if coalesce(array_length(p_shops, 1), 0) = 0 then raise exception 'need_shop'; end if;
  if coalesce(array_length(p_payments, 1), 0) = 0 then raise exception 'need_payment'; end if;

  insert into businesses (name, created_by) values (btrim(p_name), auth.uid()) returning id into b;
  insert into members (business_id, user_id, role, display_name)
    values (b, auth.uid(), 'owner', coalesce(btrim(p_owner_name), ''));

  if sc is not null then
    update signup_codes set used_by = auth.uid(), used_at = now(), business_id = b where code = sc;
  end if;

  for i in 1 .. array_length(p_shops, 1) loop
    if btrim(p_shops[i]) <> '' then
      insert into shops (business_id, name, kind, position) values (b, btrim(p_shops[i]), 'retail', i);
    end if;
  end loop;
  if p_wholesale then
    insert into shops (business_id, name, kind, position) values (b, 'Mayorista', 'wholesale', 100);
  end if;

  for i in 1 .. array_length(p_payments, 1) loop
    if btrim(p_payments[i]) <> '' then
      insert into payment_methods (business_id, name, position, wholesale)
        values (b, btrim(p_payments[i]), i, btrim(p_payments[i]) not in ('QR', 'Posnet', 'Tarjeta'));
    end if;
  end loop;
  return b;
end $$;
revoke all on function public.create_business(text, text, text[], boolean, text[], text) from public, anon;
grant execute on function public.create_business(text, text, text[], boolean, text[], text) to authenticated;
