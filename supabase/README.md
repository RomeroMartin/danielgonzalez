# Supabase – puesta en marcha (Fase 1)

1. **SQL Editor** → pegar y ejecutar, en este orden:
   1. `schema.sql`
   2. `seed.sql` (antes, cambiar el WhatsApp de Daniel en la fila de `config`)
   3. `tests.sql` → debe terminar con `TODAS LAS PRUEBAS OK` (se deshace solo, no deja datos)
2. **Edge Function `crear-turno`**
   - Dashboard → Edge Functions → *Deploy a new function* → nombre `crear-turno` → pegar `functions/crear-turno/index.ts`.
   - Desactivar *Verify JWT* (la llama el público; la protege Turnstile).
   - Edge Functions → Secrets: agregar `TURNSTILE_SECRET_KEY` (y opcionalmente `ALLOWED_ORIGIN`
     = `https://danielgonzalez-8cc.pages.dev`).
3. **Authentication**: desactivar el registro público de usuarios y crear a mano el usuario de Daniel (fase 5).

Reglas críticas que viven en la base: antisuperposición (constraint `EXCLUDE`), un pendiente por
teléfono (índice parcial), horarios/bloqueos/anticipación (en `crear_turno`) y plazo de cancelación
(en `cancelar_turno_por_token`).
