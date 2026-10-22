// Pruebas de la lógica pura. Se corren con:  node tests/slots.test.mjs
import assert from "node:assert/strict";
import { calcularSlots, fechaArg, sumarDias, diaSemana, formatoDia, formatoHora, instante } from "../js/slots.js";
import { armarMensaje, linkWhatsApp } from "../js/whatsapp.js";
import { crearICS } from "../js/ics.js";

const lunes = "2026-10-26"; // es lunes
const ahora = new Date("2026-10-22T15:00:00Z");
const base = { fecha: lunes, duracionMin: 30, intervaloMin: 15, ahora, maxDias: 30, bloqueos: [], ocupados: [],
  horarios: [{ dia_semana: 1, hora_inicio: "09:00:00", hora_fin: "13:00:00" }] };
const horas = (s) => s.map(formatoHora);

assert.equal(diaSemana(lunes), 1);
assert.equal(sumarDias("2026-10-31", 1), "2026-11-01");
assert.equal(fechaArg(new Date("2026-10-23T02:30:00Z")), "2026-10-22"); // 23:30 en Argentina
assert.equal(formatoDia(instante(lunes, "09:00")), "lunes 26 de octubre");
assert.equal(formatoHora(instante(lunes, "09:15")), "09:15");

// Día completo: 09:00 a 12:30 cada 15 min con turnos de 30 → 15 horarios
let s = calcularSlots(base);
assert.equal(s.length, 15);
assert.equal(horas(s)[0], "09:00");
assert.equal(horas(s).at(-1), "12:30");

// Duración 45: el último arranca 12:15
s = calcularSlots({ ...base, duracionMin: 45 });
assert.equal(horas(s).at(-1), "12:15");

// Un turno ocupado 10:00–10:30 saca los horarios que lo pisan (09:45, 10:00, 10:15)
const ocupado = { desde: instante(lunes, "10:00"), hasta: instante(lunes, "10:30") };
s = horas(calcularSlots({ ...base, ocupados: [ocupado] }));
assert.ok(!s.includes("09:45") && !s.includes("10:00") && !s.includes("10:15"));
assert.ok(s.includes("09:30") && s.includes("10:30"));

// Bloqueo de 11:00 a 12:00
s = horas(calcularSlots({ ...base, bloqueos: [{ desde: instante(lunes, "11:00"), hasta: instante(lunes, "12:00") }] }));
assert.ok(!s.includes("11:00") && !s.includes("11:45") && s.includes("12:00") && s.includes("10:30"));

// Día sin franja, pasado, y fuera de anticipación
assert.equal(calcularSlots({ ...base, fecha: "2026-10-27" }).length, 0);
assert.equal(calcularSlots({ ...base, ahora: new Date("2026-10-26T13:00:00Z") }).filter((d) => formatoHora(d) < "10:00").length, 0);
assert.equal(calcularSlots({ ...base, fecha: "2026-12-14" }).length, 0);

// Franjas cortadas al mediodía
s = horas(calcularSlots({ ...base, horarios: [
  { dia_semana: 1, hora_inicio: "09:00:00", hora_fin: "12:00:00" },
  { dia_semana: 1, hora_inicio: "15:00:00", hora_fin: "18:00:00" }] }));
assert.ok(s.includes("11:30") && !s.includes("12:00") && s.includes("15:00") && s.includes("17:30") && !s.includes("17:45"));

// Mensajes
assert.equal(armarMensaje("Hola {nombre}, {dia} {x}", { nombre: "Ana", dia: "lunes" }), "Hola Ana, lunes {x}");
assert.equal(linkWhatsApp("5492210000000", "hola mundo ñ"), "https://wa.me/5492210000000?text=hola%20mundo%20%C3%B1");

// ICS
const ics = crearICS({ titulo: "Turno, prueba", inicio: instante(lunes, "09:00"), fin: instante(lunes, "09:30"),
  lugar: "City Bell", descripcion: "a;b", uid: "u1" });
assert.ok(ics.includes("DTSTART:20261026T120000Z") && ics.includes("DTEND:20261026T123000Z"));
assert.ok(ics.includes("SUMMARY:Turno\\, prueba") && ics.includes("\r\n"));

console.log("slots/whatsapp/ics: TODO OK");
