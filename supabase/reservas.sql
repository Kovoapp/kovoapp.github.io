-- Turnos online: un link público (appkovo.com/turno/?n=...) donde los clientes eligen día y hora libres.
-- Necesita turnos.sql. El negocio lo activa en Ajustes → Turnos, con sus días, horario y duración.
-- Quien entra al link no tiene cuenta: solo puede ver los horarios libres (sin nombres) y pedir un turno,
-- siempre a través de las funciones de abajo, que revisan todo.
-- Se puede correr las veces que quieras.
alter table public.businesses add column if not exists reservas boolean not null default false;
alter table public.businesses add column if not exists reservas_slug text;
alter table public.businesses add column if not exists reservas_horario jsonb not null
  default '{"dias": [1, 2, 3, 4, 5, 6], "desde": "09:00", "hasta": "19:00", "minutos": 30, "lugares": 1}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_reservas_slug_check') then
    alter table public.businesses add constraint businesses_reservas_slug_check check (reservas_slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$');
  end if;
end $$;
create unique index if not exists businesses_reservas_slug_uq on public.businesses (reservas_slug);
grant update (reservas, reservas_slug, reservas_horario) on public.businesses to authenticated;

alter table public.turnos add column if not exists origen text not null default 'local';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_origen_check') then
    alter table public.turnos add constraint turnos_origen_check check (origen in ('local', 'online'));
  end if;
end $$;

-- El horario se guarda así: {"dias": [1..7, lunes = 1], "desde": "HH:MM", "hasta": "HH:MM", "minutos": 30, "lugares": 1}
-- "lugares" es cuántos turnos a la vez se pueden dar (por ejemplo, dos peluqueros).
create or replace function public.reservas_hoy() returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;
create or replace function public.reservas_min(h text) returns int language sql immutable as $$
  select split_part(h, ':', 1)::int * 60 + split_part(h, ':', 2)::int
$$;

-- Lo que muestra la página: nombre del negocio, horario y servicios (lo que se vende por unidad y sin stock).
create or replace function public.reservas_info(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nombre', b.name, 'horario', b.reservas_horario, 'hoy', reservas_hoy(),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('nombre', p.name, 'precio', p.price) order by p.name)
                           from products p where p.business_id = b.id and p.unit = 'u' and p.stock is null), '[]'::jsonb))
  from businesses b where b.reservas and b.turnos and b.reservas_slug = lower(btrim(p_slug))
$$;

-- Los horarios ocupados de un día, sin decir de quién son.
create or replace function public.reservas_ocupado(p_slug text, p_day date)
returns table (hora text, minutos int) language sql stable security definer set search_path = public as $$
  select t.hora, t.minutos from turnos t join businesses b on b.id = t.business_id
  where b.reservas and b.turnos and b.reservas_slug = lower(btrim(p_slug)) and t.day = p_day and t.estado <> 'no_vino'
  order by t.hora
$$;

create or replace function public.reservar_turno(p_slug text, p_day date, p_hora text, p_servicio text, p_cliente text, p_telefono text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  b businesses; h jsonb; ini int; fin int; dur int; ahora int; ocupados int; tel text; id uuid; serv text := btrim(coalesce(p_servicio, '')); precio numeric;
begin
  select * into b from businesses where reservas and turnos and reservas_slug = lower(btrim(p_slug));
  if b.id is null then raise exception 'reserva_cerrada'; end if;
  h := b.reservas_horario; dur := coalesce((h->>'minutos')::int, 30);
  if length(btrim(coalesce(p_cliente, ''))) not between 1 and 80 then raise exception 'reserva_sin_nombre'; end if;
  tel := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if length(tel) not between 8 and 15 then raise exception 'reserva_sin_telefono'; end if;
  if p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'reserva_horario'; end if;
  ini := reservas_min(p_hora); fin := ini + dur;
  if p_day < reservas_hoy() or p_day > reservas_hoy() + 60
     or not (h->'dias') @> to_jsonb(extract(isodow from p_day)::int)
     or ini < reservas_min(h->>'desde') or fin > reservas_min(h->>'hasta')
     or (ini - reservas_min(h->>'desde')) % dur <> 0 then raise exception 'reserva_horario'; end if;
  ahora := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int * 60 + extract(minute from now() at time zone 'America/Argentina/Buenos_Aires')::int;
  if p_day = reservas_hoy() and ini <= ahora then raise exception 'reserva_horario'; end if;
  if serv <> '' then
    select p.price into precio from products p where p.business_id = b.id and p.unit = 'u' and p.stock is null and p.name = serv;
    if not found then raise exception 'reserva_servicio'; end if;
  end if;
  -- Uno a la vez por negocio y día, para que dos personas no se queden con el mismo lugar.
  perform pg_advisory_xact_lock(hashtext(b.id::text || p_day::text));
  if (select count(*) from turnos t where t.business_id = b.id and t.estado = 'pendiente' and t.origen = 'online'
        and t.day >= reservas_hoy() and regexp_replace(t.telefono, '\D', '', 'g') = tel) >= 2 then raise exception 'reserva_muchos'; end if;
  select count(*) into ocupados from turnos t where t.business_id = b.id and t.day = p_day and t.estado <> 'no_vino'
    and reservas_min(t.hora) < fin and ini < reservas_min(t.hora) + t.minutos;
  if ocupados >= greatest(coalesce((h->>'lugares')::int, 1), 1) then raise exception 'reserva_ocupado'; end if;
  insert into turnos (business_id, day, hora, minutos, cliente, telefono, servicio, precio, origen, created_by)
    values (b.id, p_day, p_hora, dur, btrim(p_cliente), left(btrim(p_telefono), 30), serv, precio, 'online', b.created_by)
    returning turnos.id into id;
  return id;
end $$;

revoke all on function public.reservas_info(text) from public;
revoke all on function public.reservas_ocupado(text, date) from public;
revoke all on function public.reservar_turno(text, date, text, text, text, text) from public;
grant execute on function public.reservas_info(text) to anon, authenticated;
grant execute on function public.reservas_ocupado(text, date) to anon, authenticated;
grant execute on function public.reservar_turno(text, date, text, text, text, text) to anon, authenticated;
