// Configuración → Ajustes generales y textos de los mensajes de WhatsApp.
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { normalizarTelefono } from "../telefono.js";
import { ctx, cargarContexto } from "./estado.js";
import { toast, mensajeError } from "./ui.js";

export async function montar(cont) {
  const c = { ...ctx.cfg };
  const campo = (id, etiqueta, attrs = {}, ayuda, area = false) => {
    const ctrl = h(area ? "textarea" : "input", { id: `a-${id}`, rows: area ? 4 : null, ...attrs,
      oninput: (ev) => { c[id] = ev.target.type === "number" ? Number(ev.target.value) : ev.target.value; } });
    ctrl.value = c[id] ?? "";
    return h("div", { class: "campo" }, h("label", { for: `a-${id}` }, etiqueta), ctrl, ayuda ? h("small", { class: "ayuda" }, ayuda) : null);
  };

  const form = h("form", { class: "form", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const wsp = normalizarTelefono(c.whatsapp);
    if (!wsp) return toast("Tu WhatsApp no es válido: escribí la característica y el número.", "error");
    const enteros = [["anticipacion_max_dias", 1, 365], ["horas_min_cancelacion", 0, 720], ["intervalo_min", 5, 120]];
    for (const [k, min, max] of enteros) if (!Number.isInteger(c[k]) || c[k] < min || c[k] > max) return toast(`Revisá el valor de "${k.replaceAll("_", " ")}" (entre ${min} y ${max}).`, "error");
    for (const k of ["direccion", "msg_solicitud", "msg_confirmacion", "msg_rechazo", "msg_cancelacion", "aviso_datos"])
      if (!String(c[k] ?? "").trim()) return toast("Hay un campo vacío: completalo.", "error");
    const fila = { whatsapp: wsp, direccion: c.direccion.trim(), maps_url: c.maps_url?.trim() || null,
      anticipacion_max_dias: c.anticipacion_max_dias, horas_min_cancelacion: c.horas_min_cancelacion, intervalo_min: c.intervalo_min,
      msg_solicitud: c.msg_solicitud, msg_confirmacion: c.msg_confirmacion, msg_rechazo: c.msg_rechazo, msg_cancelacion: c.msg_cancelacion, aviso_datos: c.aviso_datos };
    const { error } = await supabase.from("config").update(fila).eq("id", 1);
    if (error) return toast(mensajeError(error), "error");
    toast("Ajustes guardados");
    await cargarContexto();
  } },
    h("h3", {}, "General"),
    campo("whatsapp", "Tu WhatsApp", { type: "tel", inputmode: "tel", placeholder: "Ej: 221 555-1234" }, "Es el número al que los pacientes te escriben."),
    campo("direccion", "Dirección", { type: "text" }),
    campo("maps_url", "Link de Google Maps (opcional)", { type: "url" }),
    h("h3", {}, "Turnos"),
    campo("anticipacion_max_dias", "Anticipación máxima (días)", { type: "number", min: 1, max: 365, inputmode: "numeric" }, "Hasta cuántos días adelante se puede reservar."),
    campo("horas_min_cancelacion", "Horas mínimas para cancelar", { type: "number", min: 0, max: 720, inputmode: "numeric" }, "El paciente puede cancelar solo hasta estas horas antes."),
    campo("intervalo_min", "Intervalo entre horarios (min)", { type: "number", min: 5, max: 120, step: 5, inputmode: "numeric" }, "Cada cuántos minutos arranca un turno (por ejemplo, cada 15)."),
    h("h3", {}, "Mensajes de WhatsApp"),
    h("p", { class: "ayuda" }, "Podés usar: {nombre} {dia} {hora} {motivo} {obra_social} {link_panel} {link_turno} {link_turnero}"),
    campo("msg_solicitud", "Solicitud (paciente → vos)", {}, null, true),
    campo("msg_confirmacion", "Confirmación (vos → paciente)", {}, null, true),
    campo("msg_rechazo", "Rechazo (vos → paciente)", {}, null, true),
    campo("msg_cancelacion", "Cancelación (paciente → vos)", {}, null, true),
    h("h3", {}, "Datos personales"),
    campo("aviso_datos", "Aviso que ve el paciente al reservar", {}, null, true),
    h("button", { type: "submit", class: "btn" }, "Guardar ajustes"));

  reemplazar(cont, form);
}
