// Genera un archivo .ics ("agregar a mi calendario") y lo descarga.

const aUTC = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapar = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Devuelve el contenido del .ics (líneas separadas por CRLF, como pide el estándar). */
export function crearICS({ titulo, inicio, fin, lugar, descripcion, uid }) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daniel Gonzalez//Turnero//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@turnero-daniel-gonzalez`,
    `DTSTAMP:${aUTC(new Date())}`,
    `DTSTART:${aUTC(inicio)}`,
    `DTEND:${aUTC(fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    `LOCATION:${escapar(lugar)}`,
    `DESCRIPTION:${escapar(descripcion)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function descargarICS(datos, nombreArchivo = "turno-daniel-gonzalez.ics") {
  const blob = new Blob([crearICS(datos)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
