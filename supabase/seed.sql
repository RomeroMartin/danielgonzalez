-- Datos iniciales de entrega. Daniel los ajusta después desde el panel.

insert into public.config (id, whatsapp, direccion, maps_url,
  anticipacion_max_dias, horas_min_cancelacion, intervalo_min,
  msg_solicitud, msg_confirmacion, msg_rechazo, msg_cancelacion, aviso_datos)
values (
  1,
  '5492210000000', -- TODO: reemplazar por el WhatsApp real de Daniel (549 + característica + número)
  'Consultorios Delta, Cantilo e/ 13 A y 13 B #146, City Bell',
  'https://www.google.com/maps/search/?api=1&query=Consultorios+Delta+Cantilo+146+City+Bell',
  30, 12, 15,
  'Hola Daniel, solicité un turno: {motivo}, {dia} {hora}. {nombre}, {obra_social}. Confirmalo acá: {link_panel}',
  'Hola {nombre}, tu turno del {dia} a las {hora} en Consultorios Delta (Cantilo e/ 13 A y 13 B #146, City Bell) está confirmado. Si necesitás cancelar: {link_turno}',
  'Hola {nombre}, no puedo atenderte el {dia} a las {hora}. Podés elegir otro horario acá: {link_turnero}',
  'Hola Daniel, cancelé mi turno del {dia} a las {hora}. {nombre}',
  'Tus datos (nombre y teléfono) se usan únicamente para gestionar tu turno y contactarte por WhatsApp. No se comparten con terceros. Podés pedir su modificación o eliminación en cualquier momento (Ley 25.326 de Protección de Datos Personales).'
) on conflict (id) do nothing;

insert into public.motivos (nombre, descripcion, duracion_min, orden)
select * from (values
  ('Control visual', 'Evaluación completa de tu salud visual y actualización de tu graduación.', 30, 1),
  ('Adaptación de lentes de contacto', 'Evaluación, elección y entrenamiento en el uso de lentes de contacto.', 45, 2),
  ('Control visual infantil', 'Control de la visión de los más chicos, de forma amable y sin apuro.', 30, 3)
) v(nombre, descripcion, duracion_min, orden)
where not exists (select 1 from public.motivos);

-- Horario de ejemplo (lunes 9 a 13). Se cargan los reales al entregar.
insert into public.horarios (dia_semana, hora_inicio, hora_fin)
select 1, '09:00', '13:00'
where not exists (select 1 from public.horarios);
