-- Pruebas de las reglas de negocio. Se corre en el SQL Editor (o con psql)
-- DESPUÉS de schema.sql y seed.sql. Es un único bloque: si algo no se comporta
-- como debe, falla con una excepción y no queda nada guardado. Si todo sale bien,
-- borra los datos de prueba (teléfonos 549221555000x y el bloqueo "prueba").
-- Asume el horario de ejemplo del seed (lunes 09:00-13:00) y el motivo 1 (30 min).

do $$
declare
  -- Próximo lunes a las 09:00 hora argentina
  l9 timestamptz := (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
        + ((8 - extract(isodow from now() at time zone 'America/Argentina/Buenos_Aires')::int) % 7 + 7) * interval '1 day'
        + interval '9 hours') at time zone 'America/Argentina/Buenos_Aires';
  r jsonb;
  tok uuid;
begin
  -- 1. Turno válido
  r := crear_turno(1, l9, 'Ana Prueba', '5492215550001');
  assert (r->>'ok')::boolean, '1: turno válido debería crearse: ' || r::text;
  tok := (r->>'token')::uuid;

  -- 2. Superposición rechazada (otro teléfono, mismo horario)
  r := crear_turno(1, l9, 'Beto Prueba', '5492215550002');
  assert r->>'error' = 'horario_ocupado', '2: superposición debería rechazarse: ' || r::text;

  -- 2b. Superposición parcial (09:15 pisa 09:00-09:30)
  r := crear_turno(1, l9 + interval '15 minutes', 'Beto Prueba', '5492215550002');
  assert r->>'error' = 'horario_ocupado', '2b: superposición parcial: ' || r::text;

  -- 3. Segundo pendiente con el mismo teléfono rechazado
  r := crear_turno(1, l9 + interval '1 hour', 'Ana Prueba', '5492215550001');
  assert r->>'error' = 'pendiente_existente', '3: segundo pendiente mismo teléfono: ' || r::text;

  -- 4. Fuera de franja (14:00) y fuera de grilla (09:10)
  r := crear_turno(1, l9 + interval '5 hours', 'Carla', '5492215550003');
  assert r->>'error' = 'fuera_de_horario', '4: fuera de franja: ' || r::text;
  r := crear_turno(1, l9 + interval '10 minutes', 'Carla', '5492215550003');
  assert r->>'error' = 'fuera_de_horario', '4b: fuera de grilla: ' || r::text;

  -- 4c. No puede terminar después del fin de la franja (12:45 + 30 min > 13:00)
  r := crear_turno(1, l9 + interval '3 hours 45 minutes', 'Carla', '5492215550003');
  assert r->>'error' = 'fuera_de_horario', '4c: excede la franja: ' || r::text;

  -- 5. Pasado y fuera de anticipación
  r := crear_turno(1, now() - interval '1 day', 'Carla', '5492215550003');
  assert r->>'error' = 'horario_pasado', '5: pasado: ' || r::text;
  r := crear_turno(1, l9 + interval '60 days', 'Carla', '5492215550003');
  assert r->>'error' = 'fuera_de_anticipacion', '5b: anticipación: ' || r::text;

  -- 6. Motivo inexistente
  r := crear_turno(999, l9 + interval '1 hour', 'Carla', '5492215550003');
  assert r->>'error' = 'motivo_invalido', '6: motivo inválido: ' || r::text;

  -- 7. Bloqueo
  insert into bloqueos (desde, hasta, nota) values (l9 + interval '2 hours', l9 + interval '3 hours', 'prueba');
  r := crear_turno(1, l9 + interval '2 hours 15 minutes', 'Carla', '5492215550003');
  assert r->>'error' = 'dia_bloqueado', '7: bloqueo: ' || r::text;

  -- 8. Teléfono mal formateado
  r := crear_turno(1, l9 + interval '1 hour', 'Carla', '12345');
  assert r->>'error' = 'datos_invalidos', '8: teléfono inválido: ' || r::text;

  -- 9. Disponibilidad: devuelve el rango ocupado y nada personal
  assert (select count(*) from get_disponibilidad(l9 - interval '1 day', l9 + interval '1 day')) = 1,
    '9: disponibilidad debería listar 1 rango';

  -- 10. get_turno_por_token: lunes lejano → se puede cancelar
  assert (select puede_cancelar from get_turno_por_token(tok)), '10: debería poder cancelarse';

  -- 11. Cancelación fuera de término rechazada (turno en 2 horas)
  update turnos set inicio = now() + interval '2 hours', fin = now() + interval '2 hours 30 minutes'
   where token = tok;
  assert not (select puede_cancelar from get_turno_por_token(tok)), '11: no debería poder cancelarse';
  r := cancelar_turno_por_token(tok);
  assert r->>'error' = 'fuera_de_termino', '11b: cancelación fuera de término: ' || r::text;

  -- 12. Cancelación en término ok y libera el horario
  update turnos set inicio = l9, fin = l9 + interval '30 minutes' where token = tok;
  r := cancelar_turno_por_token(tok);
  assert (r->>'ok')::boolean, '12: cancelación en término: ' || r::text;
  r := cancelar_turno_por_token(tok);
  assert r->>'error' = 'estado_no_cancelable', '12b: doble cancelación: ' || r::text;
  r := crear_turno(1, l9, 'Beto Prueba', '5492215550002');
  assert (r->>'ok')::boolean, '12c: el horario debería haberse liberado: ' || r::text;

  -- 13. Token inexistente
  r := cancelar_turno_por_token(gen_random_uuid());
  assert r->>'error' = 'no_encontrado', '13: token inexistente: ' || r::text;

  -- Limpieza de los datos de prueba
  delete from turnos where telefono like '549221555000%';
  delete from bloqueos where nota = 'prueba';

  raise notice 'TODAS LAS PRUEBAS OK';
end $$;

