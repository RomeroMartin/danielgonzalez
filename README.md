# Turnero Daniel Gonzalez

Landing + turnero online para Daniel Gonzalez Cafaro (Lic. en Óptica Ocular y Optometría, UNLP, MP 264301), Consultorios Delta, City Bell.

HTML + CSS + JavaScript vanilla (sin build), Supabase (base de datos, login y Edge Function), Cloudflare Pages / Workers / Turnstile.

| Carpeta | Qué hay |
| --- | --- |
| `index.html`, `turno.html` | Landing con turnero · ver/cancelar un turno con link privado |
| `panel/` | Panel de Daniel (PWA instalable) |
| `js/`, `css/`, `assets/` | Código, estilos e imágenes |
| `supabase/` | `schema.sql`, `seed.sql`, `tests.sql` y la Edge Function `crear-turno` |
| `worker/` | Worker de Cloudflare que evita que Supabase se pause |
| `tests/` | Pruebas de la lógica pura: `node tests/slots.test.mjs` y `node tests/telefono.test.mjs` |
| `docs/` | `ENTREGA.md` (checklist), `DOMINIO.md`, `GUIA-DANIEL.md` |
