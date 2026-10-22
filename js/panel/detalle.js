// Detalle de un turno (hoja) con las acciones según su estado.
import { supabase } from "../supabase.js";
import { h } from "../dom.js";
import { formatoDia, formatoHora } from "../slots.js";
import { armarMensaje, linkWhatsApp } from "../whatsapp.js";
import { formatearTelefono } from "../telefono.js";
import { ctx, ESTADOS, refrescar } from "./estado.js";
import { hoja, confirmar, accionYAvisar, toast, mensajeError } from "./ui.js";

const MSG_CANCELA_PROFESIONAL =
  "Hola {nombre}, tengo que cancelar tu turno del {dia} a las {hora}. Disculpá las molestias. Podés elegir otro horario acá: {link_turnero}";

export function varsMensaje(t) {
  const inicio = new Date(t.inicio);
  return {
    nombre: t.nombre, dia: formatoDia(inicio), hora: formatoHora(inicio), motivo: t.motivos?.nombre ?? "",
    link_turno: `${location.origin}/turno.html?t=${t.token}`, link_turnero: `${location.origin}/#turnero`,
  };
}

async function cambiarEstado(id, estado) {
  const { error } = await supabase.from("turnos").update({ estado }).eq("id", id);
  if (error) throw error;
}

/** Confirmar un pendiente y avisar al paciente. */
export async function confirmarYAvisar(t) {
  try {
    await accionYAvisar({
      cambiar: () => cambiarEstado(t.id, "confirmado"),
      armarUrl: () => linkWhatsApp(t.telefono, armarMensaje(ctx.cfg.msg_confirmacion, varsMensaje(t))),
      titulo: "Turno confirmado ✓", aviso: `Avisale a ${t.nombre} que su turno está confirmado.`,
    });
  } catch (err) { toast(mensajeError(err), "error"); }
  refrescar();
}

/** Rechazar un pendiente (libera el horario) y avisar al paciente. */
export async function rechazarYAvisar(t) {
  const ok = await confirmar({ titulo: "¿Rechazar este turno?", peligro: true, boton: "Rechazar y avisar",
    texto: `Se libera el horario y se le avisa a ${t.nombre} por WhatsApp para que elija otro.` });
  if (!ok) return;
  try {
    await accionYAvisar({
      cambiar: () => cambiarEstado(t.id, "rechazado"),
      armarUrl: () => linkWhatsApp(t.telefono, armarMensaje(ctx.cfg.msg_rechazo, varsMensaje(t))),
      titulo: "Turno rechazado", aviso: `Avisale a ${t.nombre} que elija otro horario.`,
    });
  } catch (err) { toast(mensajeError(err), "error"); }
  refrescar();
}

async function cancelarConAviso(t) {
  const ok = await confirmar({ titulo: "¿Cancelar este turno?", peligro: true, boton: "Cancelar y avisar",
    texto: `Se libera el horario y se le avisa a ${t.nombre} por WhatsApp.` });
  if (!ok) return;
  try {
    await accionYAvisar({
      cambiar: () => cambiarEstado(t.id, "cancelado_profesional"),
      armarUrl: () => linkWhatsApp(t.telefono, armarMensaje(MSG_CANCELA_PROFESIONAL, varsMensaje(t))),
      titulo: "Turno cancelado", aviso: `Avisale a ${t.nombre} que cancelaste su turno.`,
    });
  } catch (err) { toast(mensajeError(err), "error"); }
  refrescar();
}

async function marcar(t, estado, texto, cerrar) {
  try { await cambiarEstado(t.id, estado); toast(texto); cerrar(); }
  catch (err) { toast(mensajeError(err), "error"); }
  refrescar();
}

const fila = (etiqueta, valor) => valor ? h("div", {}, h("span", {}, etiqueta), h("strong", {}, valor)) : null;

/** Abre el detalle de un turno (con el motivo incluido: select("*, motivos(nombre, duracion_min)")). */
export function abrirDetalle(t) {
  const inicio = new Date(t.inicio);
  const e = ESTADOS[t.estado] ?? { txt: t.estado, clase: "" };
  const vencido = inicio < new Date();
  let cerrar = () => {};

  const botones = [];
  if (t.estado === "pendiente") {
    botones.push(
      h("button", { type: "button", class: "btn", disabled: vencido, onclick: () => { cerrar(); confirmarYAvisar(t); } }, "Confirmar y avisar"),
      h("button", { type: "button", class: "btn btn--borde", onclick: () => { cerrar(); rechazarYAvisar(t); } }, "Rechazar y avisar"));
  }
  botones.push(h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener", href: `https://wa.me/${t.telefono}` }, "WhatsApp al paciente"));
  if (t.estado === "confirmado") {
    botones.push(
      h("button", { type: "button", class: "btn btn--borde", onclick: () => marcar(t, "asistio", "Marcado como asistió", cerrar) }, "Asistió"),
      h("button", { type: "button", class: "btn btn--borde", onclick: () => marcar(t, "ausente", "Marcado como no vino", cerrar) }, "No vino"),
      h("button", { type: "button", class: "btn btn--peligro-borde", onclick: () => { cerrar(); cancelarConAviso(t); } }, "Cancelar turno"));
  }

  ({ cerrar } = hoja({ titulo: t.nombre, contenido: [
    h("span", { class: `chip ${e.clase}` }, e.txt),
    vencido && t.estado === "pendiente" ? h("p", { class: "nota-vencido" }, "El horario de este turno ya pasó: solo podés rechazarlo.") : null,
    h("div", { class: "datos-turno" },
      fila("Motivo", t.motivos?.nombre), fila("Día", formatoDia(inicio)), fila("Hora", `${formatoHora(inicio)} hs`),
      fila("WhatsApp", formatearTelefono(t.telefono)), fila("Obra social", t.obra_social), fila("Comentario", t.comentario),
      fila("Origen", t.origen === "manual" ? "Cargado por vos" : "Web")),
    h("div", { class: "hoja__acciones" }, botones),
  ] }));
}

/** Para el link /panel/?turno=id */
export async function abrirPorId(id) {
  const { data, error } = await supabase.from("turnos").select("*, motivos(nombre, duracion_min)").eq("id", id).maybeSingle();
  if (error || !data) return toast("No encontramos ese turno.", "error");
  abrirDetalle(data);
}
