// Agenda: vista de un día o de una semana, con colores por estado.
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { fechaArg, sumarDias, diaSemana, instante, formatoDia, formatoHora } from "../slots.js";
import { ctx, ESTADOS } from "./estado.js";
import { abrirDetalle } from "./detalle.js";

const est = { modo: "dia", fecha: fechaArg() };

const lunesDe = (f) => sumarDias(f, -((diaSemana(f) + 6) % 7));
const noonDe = (f) => instante(f, "12:00");   // un instante cualquiera del día, para formatear

function franjasDelDia(f) {
  const fr = ctx.horarios.filter((x) => x.dia_semana === diaSemana(f));
  return fr.length ? fr.map((x) => `${x.hora_inicio.slice(0, 5)}–${x.hora_fin.slice(0, 5)}`).join(" y ") : null;
}

function bloqueosDelDia(f) {
  const d = instante(f, "00:00"), s = instante(sumarDias(f, 1), "00:00");
  return ctx.bloqueos.filter((b) => new Date(b.desde) < s && new Date(b.hasta) > d);
}

function item(t) {
  const inicio = new Date(t.inicio);
  const e = ESTADOS[t.estado] ?? { txt: t.estado, clase: "" };
  return h("button", { type: "button", class: `turno-item ${e.clase}`, onclick: () => abrirDetalle(t) },
    h("span", { class: "turno-item__hora" }, formatoHora(inicio)),
    h("span", { class: "turno-item__info" }, h("strong", {}, t.nombre), h("small", {}, t.motivos?.nombre ?? "")),
    h("span", { class: `chip ${e.clase}` }, e.txt));
}

function bloqueDia(f, turnos) {
  const fr = franjasDelDia(f);
  return h("section", { class: "agenda-dia" },
    est.modo === "semana" ? h("h3", { class: "agenda-dia__titulo" }, formatoDia(noonDe(f)), h("span", {}, `${turnos.length} turno${turnos.length === 1 ? "" : "s"}`)) : null,
    h("p", { class: "agenda-dia__horario" }, fr ? `Atendés: ${fr}` : "Día sin atención"),
    bloqueosDelDia(f).map((b) => h("p", { class: "bloqueo-aviso" }, `⛔ Bloqueado${b.nota ? `: ${b.nota}` : ""}`)),
    turnos.length ? turnos.map(item) : h("p", { class: "agenda-dia__vacio" }, "Sin turnos"));
}

export async function montar(cont) {
  const dias = est.modo === "dia" ? [est.fecha] : Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(est.fecha), i));
  const desde = instante(dias[0], "00:00"), hasta = instante(sumarDias(dias.at(-1), 1), "00:00");
  const { data, error } = await supabase.from("turnos").select("*, motivos(nombre, duracion_min)")
    .gte("inicio", desde.toISOString()).lt("inicio", hasta.toISOString()).order("inicio");
  if (error) throw error;

  const mover = (n) => { est.fecha = sumarDias(est.fecha, n * (est.modo === "dia" ? 1 : 7)); montar(cont); };
  const titulo = est.modo === "dia" ? formatoDia(noonDe(est.fecha))
    : `${formatoDia(noonDe(dias[0]))} – ${formatoDia(noonDe(dias[6]))}`;

  reemplazar(cont, 
    h("div", { class: "agenda-barra" },
      h("div", { class: "segmentos", role: "group", "aria-label": "Vista" },
        ["dia", "semana"].map((m) => h("button", { type: "button", class: est.modo === m ? "activo" : "",
          "aria-pressed": String(est.modo === m), onclick: () => { est.modo = m; montar(cont); } }, m === "dia" ? "Día" : "Semana"))),
      h("div", { class: "agenda-barra__acciones" },
        h("button", { type: "button", class: "btn btn--chico btn--borde", onclick: () => { est.fecha = fechaArg(); montar(cont); } }, "Hoy"),
        h("button", { type: "button", class: "btn btn--chico", onclick: () => document.dispatchEvent(new CustomEvent("panel:agendar", { detail: { fecha: est.fecha } })) }, "+ Agendar"))),
    h("div", { class: "agenda-nav" },
      h("button", { type: "button", class: "cal__nav", "aria-label": "Anterior", onclick: () => mover(-1) }, "‹"),
      h("strong", { class: "agenda-nav__titulo" }, titulo),
      h("button", { type: "button", class: "cal__nav", "aria-label": "Siguiente", onclick: () => mover(1) }, "›")),
    dias.map((f) => bloqueDia(f, data.filter((t) => fechaArg(new Date(t.inicio)) === f))));
}
