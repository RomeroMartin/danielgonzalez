// Cargar un turno a mano (llamada, mostrador, etc.). Nace confirmado, con origen "manual".
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { calcularSlots, fechaArg, sumarDias, formatoDia, formatoHora } from "../slots.js";
import { armarMensaje, linkWhatsApp } from "../whatsapp.js";
import { normalizarTelefono } from "../telefono.js";
import { ctx, refrescar } from "./estado.js";
import { hoja, toast, mensajeError } from "./ui.js";
import { varsMensaje } from "./detalle.js";

const f = { motivoId: null, fecha: fechaArg(), slot: null, nombre: "", telefono: "", obra_social: "", comentario: "" };

async function ocupados() {
  const desde = new Date(fechaArg() + "T00:00:00-03:00");
  const hasta = new Date(desde.getTime() + 366 * 86400000);
  const { data, error } = await supabase.rpc("get_disponibilidad", { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() });
  if (error) throw error;
  return data.map((r) => ({ desde: new Date(r.inicio), hasta: new Date(r.fin) }));
}

/** Deja elegido el día con el que se abre el formulario (viene de la agenda). */
export function preseleccionarDia(fecha) {
  if (fecha >= fechaArg()) { f.fecha = fecha; f.slot = null; }
}

export async function montar(cont) {
  const activos = ctx.motivos.filter((m) => m.activo);
  if (!activos.length) return reemplazar(cont, h("p", { class: "vacio-panel" }, "Primero cargá al menos un motivo activo (Configuración → Motivos)."));
  if (!activos.some((m) => m.id === f.motivoId)) f.motivoId = activos[0].id;
  const busy = await ocupados();
  const motivo = () => activos.find((m) => m.id === f.motivoId);

  const slotsDelDia = () => calcularSlots({
    fecha: f.fecha, duracionMin: motivo().duracion_min, intervaloMin: ctx.cfg.intervalo_min, horarios: ctx.horarios,
    bloqueos: ctx.bloqueos.map((b) => ({ desde: new Date(b.desde), hasta: new Date(b.hasta) })),
    ocupados: busy, ahora: new Date(), maxDias: 366 });

  const zonaHoras = h("div", { class: "horas" });
  const dibujarHoras = () => {
    const slots = slotsDelDia();
    if (f.slot && !slots.some((s) => s.getTime() === f.slot.getTime())) f.slot = null;
    zonaHoras.replaceChildren(...(slots.length
      ? slots.map((s) => h("button", { type: "button", class: "hora" + (f.slot?.getTime() === s.getTime() ? " hora--sel" : ""),
          "aria-pressed": String(f.slot?.getTime() === s.getTime()), onclick: () => { f.slot = s; dibujarHoras(); } }, formatoHora(s)))
      : [h("p", { class: "agenda-dia__vacio" }, "No hay horarios libres ese día.")]));
  };

  const campo = (id, etiqueta, attrs = {}, area = false) => {
    const ctrl = h(area ? "textarea" : "input", { id: `m-${id}`, rows: area ? 2 : null, ...attrs,
      oninput: (ev) => { f[id] = ev.target.value; } });
    ctrl.value = f[id];
    return h("div", { class: "campo" }, h("label", { for: `m-${id}` }, etiqueta), ctrl);
  };

  const form = h("form", { class: "form", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const tel = normalizarTelefono(f.telefono);
    if (f.nombre.trim().length < 2) return toast("Escribí el nombre del paciente.", "error");
    if (!tel) return toast("El WhatsApp no es válido: escribí la característica y el número.", "error");
    if (!f.slot) return toast("Elegí un horario.", "error");
    const m = motivo();
    const { data, error } = await supabase.from("turnos").insert({
      motivo_id: m.id, inicio: f.slot.toISOString(), fin: new Date(f.slot.getTime() + m.duracion_min * 60000).toISOString(),
      nombre: f.nombre.trim(), telefono: tel, obra_social: f.obra_social.trim() || null, comentario: f.comentario.trim() || null,
      estado: "confirmado", origen: "manual",
    }).select("*, motivos(nombre, duracion_min)").single();
    if (error) { toast(mensajeError(error), "error"); return montar(cont); }

    Object.assign(f, { slot: null, nombre: "", telefono: "", obra_social: "", comentario: "" });
    refrescar();
    const { cerrar } = hoja({ titulo: "Turno cargado ✓", contenido: [
      h("p", {}, `${data.nombre} · ${formatoDia(new Date(data.inicio))} a las ${formatoHora(new Date(data.inicio))} hs. Ya está confirmado.`),
      h("div", { class: "hoja__acciones" },
        h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener",
          href: linkWhatsApp(data.telefono, armarMensaje(ctx.cfg.msg_confirmacion, varsMensaje(data))) }, "Avisar al paciente"),
        h("button", { type: "button", class: "btn btn--borde", onclick: () => cerrar() }, "Listo")),
    ] });
  } },
    h("div", { class: "campo" }, h("label", { for: "m-motivo" }, "Motivo"),
      h("select", { id: "m-motivo", onchange: (ev) => { f.motivoId = Number(ev.target.value); dibujarHoras(); } },
        activos.map((m) => h("option", { value: m.id, selected: m.id === f.motivoId }, `${m.nombre} (${m.duracion_min} min)`)))),
    h("div", { class: "campo" }, h("label", { for: "m-fecha" }, "Día"),
      h("input", { id: "m-fecha", type: "date", value: f.fecha, min: fechaArg(), max: sumarDias(fechaArg(), 365),
        onchange: (ev) => { if (ev.target.value) { f.fecha = ev.target.value; dibujarHoras(); } } })),
    h("div", { class: "campo" }, h("span", { class: "etiqueta" }, "Horario"), zonaHoras),
    campo("nombre", "Nombre y apellido", { type: "text", autocomplete: "off", maxlength: 100 }),
    campo("telefono", "WhatsApp", { type: "tel", inputmode: "tel", placeholder: "Ej: 221 555-1234", maxlength: 25 }),
    campo("obra_social", "Obra social (opcional)", { type: "text", maxlength: 100 }),
    campo("comentario", "Comentario (opcional)", { maxlength: 500 }, true),
    h("button", { type: "submit", class: "btn" }, "Agendar turno"));

  reemplazar(cont, h("h2", { class: "vista__titulo" }, "Agendar turno"), h("p", { class: "ayuda" }, "Para pacientes que te piden turno por WhatsApp o por teléfono. Queda confirmado."), form);
  dibujarHoras();
}
