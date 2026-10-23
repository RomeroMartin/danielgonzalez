# Manual de uso (PDF)

`docs/Manual-Turnero-Daniel-Gonzalez.pdf` es el manual para Daniel. Se genera solo, con capturas reales del sitio y del panel
sobre datos de ejemplo (pacientes ficticios), así que se puede rehacer cada vez que cambie algo.

## Regenerarlo
Requiere `playwright` (`npm i -g playwright`) y Chromium.

```bash
python3 -m http.server 8099 &              # desde la raíz del repo
node docs/manual/capturas.cjs              # saca las capturas con números de referencia → docs/manual/img/
node docs/manual/generar.cjs               # arma el PDF → docs/Manual-Turnero-Daniel-Gonzalez.pdf
```

- `capturas.cjs`: datos de ejemplo + recorrido por la web y el panel (usa `backend-simulado.cjs`, un Supabase falso; no toca la base real).
- `manual.html`: el texto y el diseño del manual (A4).
- `generar.cjs`: convierte `manual.html` a PDF.
- `img/` no se guarda en el repo (se regenera).

Antes de entregarlo: en la página 8 dice `tudominio.com.ar/panel/`; reemplazarlo por el dominio real en `manual.html` y regenerar.
