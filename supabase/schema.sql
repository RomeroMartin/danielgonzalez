-- =====================================================================
-- Turnero Daniel Gonzalez - Esquema de base de datos (Supabase / Postgres)
-- Se ejecuta completo en el SQL Editor de Supabase. Es re-ejecutable.
-- Todas las fechas se guardan en timestamptz y se interpretan en
-- America/Argentina/Buenos_Aires.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Configuración general: siempre una única fila (id = 1)
create table if not exists public.config (
  id                     int primary key default 1 check (id = 1),
  whatsapp               text not null,               -- formato wa.me: 549 + característica + número
  direccion              text not null,
  maps_url               text,
  anticipacion_max_dias  int  not null default 30  check (anticipacion_max_dias between 1 and 365),
  horas_min_cancelacion  int  not null default 12  check (horas_min_cancelacion >= 0),
  intervalo_min          int  not null default 15  check (intervalo_min between 5 and 120),
  msg_solicitud          text not null,
  msg_confirmacion       text not null,
  msg_rechazo            text not null,
  msg_cancelacion        text not null,
  aviso_datos            text not null
);

-- Motivos de consulta (cada uno define su duración)
create table if not exists public.motivos (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  descripcion  text,
  duracion_min int  not null check (duracion_min between 5 and 480),
  activo       boolean not null default true,
  orden        int  not null default 0
);

-- Franjas de atención por día de la semana (0 = domingo ... 6 = sábado).
-- Puede haber varias filas por día para cortar al mediodía.
create table if not exists public.horarios (
  id          bigint generated always as identity primary key,
  dia_semana  int  not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin    time not null,
  check (hora_fin > hora_inicio)
);

-- Rangos sin atención (vacaciones, feriados, etc.)
create table if not exists public.bloqueos (
  id     bigint generated always as identity primary key,
  desde  timestamptz not null,
  hasta  timestamptz not null,
  nota   text,
  check (hasta > desde)
);

create table if not exists public.turnos (
  id          uuid primary key default gen_random_uuid(),
  motivo_id   bigint not null references public.motivos(id),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  nombre      text not null check (char_length(nombre) between 2 and 100),
  telefono    text not null check (telefono ~ '^549[0-9]{10}$'),  -- ya normalizado
  obra_social text check (char_length(obra_social) <= 100),
  comentario  text check (char_length(comentario) <= 500),
  estado      text not null default 'pendiente'
              check (estado in ('pendiente','confirmado','rechazado',
                                'cancelado_paciente','cancelado_profesional',
                                'asistio','ausente')),
  token       uuid not null unique default gen_random_uuid(),     -- link privado del paciente
  origen      text not null default 'web' check (origen in ('web','manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (fin > inicio),

  -- Antisuperposición: dos turnos activos no pueden pisarse
  constraint turnos_sin_superposicion
    exclude using gist (tstzrange(inicio, fin) with &&)
    where (estado in ('pendiente','confirmado'))
);

-- Un solo turno pendiente por teléfono (antispam)
create unique index if not exists turnos_un_pendiente_por_telefono
  on public.turnos (telefono) where estado = 'pendiente';

create index if not exists turnos_inicio_idx on public.turnos (inicio);

-- Mantiene updated_at al día
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists turnos_updated_at on public.turnos;
create trigger turnos_updated_at before update on public.turnos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- config, motivos, horarios, bloqueos: lectura pública, escritura solo logueado.
-- turnos: sin acceso para anon; acceso total para el usuario logueado (Daniel).
-- ---------------------------------------------------------------------

alter table public.config   enable row level security;
alter table public.motivos  enable row level security;
alter table public.horarios enable row level security;
alter table public.bloqueos enable row level security;
alter table public.turnos   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['config','motivos','horarios','bloqueos'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "escritura profesional" on public.%I', t);
    execute format('create policy "escritura profesional" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "profesional todo" on public.turnos;
create policy "profesional todo" on public.turnos
  for all to authenticated using (true) with check (true);

-- Permisos de tabla: anon solo lee lo público; nunca toca turnos
revoke all on public.turnos from anon;
grant select on public.config, public.motivos, public.horarios, public.bloqueos to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Funciones públicas (RPC, security definer)
-- ---------------------------------------------------------------------

-- Rangos ocupados, sin datos personales. Rango máximo = anticipación configurada.
create or replace function public.get_disponibilidad(p_desde timestamptz, p_hasta timestamptz)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_max int;
begin
  select anticipacion_max_dias into v_max from config where id = 1;
  if p_hasta <= p_desde then
    raise exception 'rango_invalido';
  end if;
  if p_hasta - p_desde > make_interval(days => v_max + 1) then
    raise exception 'rango_demasiado_grande';
  end if;
  return query
    select t.inicio, t.fin from turnos t
    where t.estado in ('pendiente','confirmado')
      and tstzrange(t.inicio, t.fin) && tstzrange(p_desde, p_hasta)
    order by t.inicio;
end $$;

-- Crea un turno pendiente. Solo la llama la Edge Function (service_role).
-- Devuelve jsonb: {ok:true, id, token} o {ok:false, error:'codigo'}.
create or replace function public.crear_turno(
  p_motivo_id   bigint,
  p_inicio      timestamptz,
  p_nombre      text,
  p_telefono    text,
  p_obra_social text default null,
  p_comentario  text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cfg      config%rowtype;
  v_motivo   motivos%rowtype;
  v_fin      timestamptz;
  v_local    timestamp;           -- inicio en hora argentina
  v_local_fin timestamp;
  v_franja   horarios%rowtype;
  v_id       uuid;
  v_token    uuid;
begin
  select * into v_cfg from config where id = 1;
  select * into v_motivo from motivos where id = p_motivo_id and activo;
  if not found then return jsonb_build_object('ok', false, 'error', 'motivo_invalido'); end if;

  if p_inicio <= now() then
    return jsonb_build_object('ok', false, 'error', 'horario_pasado');
  end if;
  if p_inicio > now() + make_interval(days => v_cfg.anticipacion_max_dias) then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_anticipacion');
  end if;

  v_fin := p_inicio + make_interval(mins => v_motivo.duracion_min);
  v_local     := p_inicio at time zone 'America/Argentina/Buenos_Aires';
  v_local_fin := v_fin    at time zone 'America/Argentina/Buenos_Aires';

  -- El turno debe caber entero dentro de una franja del mismo día
  select * into v_franja from horarios
   where dia_semana = extract(dow from v_local)::int
     and v_local::time >= hora_inicio
     and v_local_fin::date = v_local::date
     and v_local_fin::time <= hora_fin
   limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'fuera_de_horario'); end if;

  -- Debe caer en la grilla de la franja (cada intervalo_min desde su inicio)
  if (extract(epoch from (v_local::time - v_franja.hora_inicio)) / 60)::int % v_cfg.intervalo_min <> 0 then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_horario');
  end if;

  if exists (select 1 from bloqueos where tstzrange(desde, hasta) && tstzrange(p_inicio, v_fin)) then
    return jsonb_build_object('ok', false, 'error', 'dia_bloqueado');
  end if;

  begin
    insert into turnos (motivo_id, inicio, fin, nombre, telefono, obra_social, comentario, origen)
    values (p_motivo_id, p_inicio, v_fin, trim(p_nombre), p_telefono,
            nullif(trim(p_obra_social), ''), nullif(trim(p_comentario), ''), 'web')
    returning id, token into v_id, v_token;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'error', 'horario_ocupado');
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'pendiente_existente');
    when check_violation then
      return jsonb_build_object('ok', false, 'error', 'datos_invalidos');
  end;

  return jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
end $$;

-- Datos del turno para el paciente que tiene el link privado
create or replace function public.get_turno_por_token(p_token uuid)
returns table (motivo text, inicio timestamptz, fin timestamptz, nombre text,
               estado text, puede_cancelar boolean)
language sql stable security definer set search_path = public as $$
  select m.nombre, t.inicio, t.fin, t.nombre, t.estado,
         (t.estado in ('pendiente','confirmado')
          and t.inicio - now() > make_interval(hours => c.horas_min_cancelacion))
  from turnos t
  join motivos m on m.id = t.motivo_id
  cross join config c
  where t.token = p_token and c.id = 1;
$$;

-- Cancelación por el paciente. Devuelve jsonb {ok:true} o {ok:false, error}.
create or replace function public.cancelar_turno_por_token(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_turno turnos%rowtype;
  v_horas int;
begin
  select * into v_turno from turnos where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrado'); end if;
  if v_turno.estado not in ('pendiente','confirmado') then
    return jsonb_build_object('ok', false, 'error', 'estado_no_cancelable');
  end if;
  select horas_min_cancelacion into v_horas from config where id = 1;
  if v_turno.inicio - now() <= make_interval(hours => v_horas) then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_termino');
  end if;
  update turnos set estado = 'cancelado_paciente' where id = v_turno.id;
  return jsonb_build_object('ok', true);
end $$;

-- Permisos de ejecución
revoke execute on function public.crear_turno(bigint, timestamptz, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.crear_turno(bigint, timestamptz, text, text, text, text) to service_role;

revoke execute on function public.get_disponibilidad(timestamptz, timestamptz)  from public;
revoke execute on function public.get_turno_por_token(uuid)                      from public;
revoke execute on function public.cancelar_turno_por_token(uuid)                 from public;
grant  execute on function public.get_disponibilidad(timestamptz, timestamptz)  to anon, authenticated;
grant  execute on function public.get_turno_por_token(uuid)                      to anon, authenticated;
grant  execute on function public.cancelar_turno_por_token(uuid)                 to anon, authenticated;
