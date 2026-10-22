// Cálculo de horarios libres y utilidades de fecha.
// Todo se interpreta en hora argentina (America/Argentina/Buenos_Aires).
// Argentina no usa horario de verano desde 2009, así que su offset es siempre -03:00.

export const TZ = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";
const MS_DIA = 86400000;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
               "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ---------- Fechas como texto 'YYYY-MM-DD' (día calendario argentino) ----------

/** Día calendario argentino de un instante, como 'YYYY-MM-DD'. */
export function fechaArg(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}

function partes(fecha) { return fecha.split("-").map(Number); }

export function sumarDias(fecha, n) {
  const [y, m, d] = partes(fecha);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = domingo ... 6 = sábado (igual que la columna dia_semana de la base). */
export function diaSemana(fecha) {
  const [y, m, d] = partes(fecha);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Instante real de una fecha 'YYYY-MM-DD' y una hora 'HH:MM' argentinas. */
export function instante(fecha, hhmm) {
  return new Date(`${fecha}T${hhmm.slice(0, 5)}:00${OFFSET}`);
}

function aMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function aHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// ---------- Horarios libres ----------

const seSolapan = (inicio, fin, r) => inicio < r.hasta && fin > r.desde;

/**
 * Horarios libres de un día = franjas del día − bloqueos − turnos ocupados,
 * según la duración del motivo y el intervalo. Replica la validación de la base.
 *
 * @param {object}  o
 * @param {string}  o.fecha          'YYYY-MM-DD' (hora argentina)
 * @param {number}  o.duracionMin    duración del motivo
 * @param {number}  o.intervaloMin   cada cuántos minutos arranca un turno
 * @param {Array}   o.horarios       filas de la tabla horarios {dia_semana, hora_inicio, hora_fin}
 * @param {Array}   o.bloqueos       [{desde: Date, hasta: Date}]
 * @param {Array}   o.ocupados       [{desde: Date, hasta: Date}] turnos pendientes o confirmados
 * @param {Date}    o.ahora
 * @param {number}  o.maxDias        anticipación máxima en días
 * @returns {Date[]} inicios posibles, ordenados
 */
export function calcularSlots({ fecha, duracionMin, intervaloMin, horarios, bloqueos, ocupados, ahora, maxDias }) {
  const limite = new Date(ahora.getTime() + maxDias * MS_DIA);
  const dow = diaSemana(fecha);
  const libres = [];

  for (const franja of horarios.filter((h) => h.dia_semana === dow)) {
    const desdeMin = aMinutos(franja.hora_inicio);
    const hastaMin = aMinutos(franja.hora_fin);
    for (let t = desdeMin; t + duracionMin <= hastaMin; t += intervaloMin) {
      const inicio = instante(fecha, aHHMM(t));
      const fin = new Date(inicio.getTime() + duracionMin * 60000);
      if (inicio <= ahora || inicio > limite) continue;
      if (bloqueos.some((b) => seSolapan(inicio, fin, b))) continue;
      if (ocupados.some((o) => seSolapan(inicio, fin, o))) continue;
      libres.push(inicio);
    }
  }
  return libres.sort((a, b) => a - b);
}

// ---------- Formato en español (hora argentina) ----------

function campos(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  const fecha = fechaArg(date);
  return { dia: Number(p.day), mes: Number(p.month), dow: diaSemana(fecha), hora: p.hour, min: p.minute };
}

/** "lunes 26 de octubre" */
export function formatoDia(date) {
  const c = campos(date);
  return `${DIAS[c.dow]} ${c.dia} de ${MESES[c.mes - 1]}`;
}

/** "09:30" */
export function formatoHora(date) {
  const c = campos(date);
  return `${c.hora}:${c.min}`;
}

export const nombreMes = (mes0) => MESES[mes0];
