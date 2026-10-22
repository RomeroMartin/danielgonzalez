# Keepalive de Supabase

Evita que Supabase pause el proyecto por inactividad (plan gratis: pausa tras 7 días sin uso).

## Desplegar desde el panel de Cloudflare (sin instalar nada)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Nombre: `keepalive-turnero-daniel` → **Deploy** (queda con el código de ejemplo).
3. **Edit code** → borrar todo, pegar el contenido de `keepalive.js` → **Deploy**.
4. En el Worker: **Settings → Triggers → Cron Triggers → Add** → `0 12 * * *` (todos los días).
5. Probarlo: abrir la URL del Worker (`https://keepalive-turnero-daniel.<tu-usuario>.workers.dev`).
   Tiene que decir `OK: Supabase respondió 200`.

Para ver que el cron corre: Worker → **Observability / Logs** al día siguiente
(debe aparecer `keepalive: Supabase respondió 200`).
