# Lista de entrega (Martin)

## Una sola vez, antes de entregar
- [ ] **Supabase**: `schema.sql`, `seed.sql` y `tests.sql` ejecutados (ver `supabase/README.md`).
- [ ] **Supabase → Authentication**: registro público de usuarios **desactivado**.
- [ ] **Edge Function `crear-turno`** desplegada, con *Verify JWT* apagado y el secreto `TURNSTILE_SECRET_KEY` cargado.
- [ ] **Turnstile**: hostnames con el dominio final (y `localhost` si se prueba local).
- [ ] **Worker keepalive** desplegado y probado (ver `worker/README.md`).
- [ ] **Dominio** conectado a Cloudflare Pages y URLs actualizadas (ver `docs/DOMINIO.md`).
- [ ] **Logo real** (SVG/PNG) y **foto de Daniel** (`assets/daniel.jpg`) cargados.
- [ ] En la tabla `config`: **WhatsApp real de Daniel** (se cambia desde Panel → Config → Ajustes).

## Prueba completa con un turno real
- [ ] Reservar desde el celular con un WhatsApp propio → aparece en Pendientes.
- [ ] Confirmar y avisar → llega el WhatsApp con el link para cancelar.
- [ ] Cancelar desde el link del paciente → el horario vuelve a estar libre.
- [ ] Reservar dos veces con el mismo teléfono → aparece el aviso de turno pendiente.
- [ ] Borrar los turnos de prueba (Supabase → Table Editor → `turnos`).

## Con Daniel
- [ ] Crear su usuario (Authentication → Users → *Add user*, con *Auto Confirm User*).
- [ ] Cargar sus horarios reales y revisar los motivos y duraciones (Panel → Config).
- [ ] Instalarle el panel en el celular y hacerle probar Confirmar, Agendar y Bloquear.
- [ ] Mostrarle `docs/GUIA-DANIEL.md`.
