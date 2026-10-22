# Cambiar de dominio (de `danielgonzalez-8cc.pages.dev` a uno propio)

1. **Cloudflare Pages** → proyecto → **Custom domains** → *Set up a custom domain* → seguir los pasos
   (si el dominio está en Cloudflare, el DNS se configura solo).
2. Reemplazar `https://danielgonzalez-8cc.pages.dev` por el dominio nuevo en:
   - `index.html` (canonical, `og:url`, `og:image`, datos estructurados)
   - `robots.txt` y `sitemap.xml`
3. **Cloudflare Turnstile** → widget → agregar el dominio nuevo en *Hostnames*.
4. **Supabase** → Edge Functions → Secrets → `ALLOWED_ORIGIN` = `https://<dominio-nuevo>` (si se había cargado).
5. Volver a entrar al panel desde el dominio nuevo y reinstalar la app en el celular de Daniel
   (la sesión y la instalación están atadas al dominio).
6. Los links de turnos que ya recibieron pacientes (`/turno.html?t=…`) dejan de abrirse en el dominio viejo:
   conviene mantener el viejo activo unos días, o cambiar de dominio antes de la entrega.
