// Pantalla de inicio: solicitudes pendientes y cancelaciones recientes de pacientes.
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { formatoDia, formatoHora } from "../slots.js";
import { formatearTelefono } from "../telefono.js";
import { abrirDetalle, confirmarYAvisar, rechazarYAvisar } from "./detalle.js";

const SEL = "*, motivos(nombre, duracion_min)";

/** Cantidad de pendientes (para el globo del menú). */
export async function contarPendientes() {
  const { data } = await supabase.from("turnos").select("id").eq("estado", "pendiente");
  return data?.length ?? 0;
}

function tarjeta(t, { cancelado = false } = {}) {
  const inicio = new Date(t.inicio);
  const vencido = inicio < new Date();
  return h("article", { class: "tarjeta-turno" + (cancelado ? " tarjeta-turno--cancelado" : "") },
    h("button", { type: "button", class: "tarjeta-turno__cab", onclick: () => abrirDetalle(t) },
      h("strong", {}, `${formatoDia(inicio)} · ${formatoHora(inicio)} hs`),
      h("span", {}, t.motivos?.nombre ?? "")),
    h("p", { class: "tarjeta-turno__dato" }, h("strong", {}, t.nombre), ` · ${formatearTelefono(t.telefono)}`),
    t.obra_social ? h("p", { class: "tarjeta-turno__dato" }, `Obra social: ${t.obra_social}`) : null,
    t.comentario ? h("p", { class: "tarjeta-turno__dato" }, `“${t.comentario}”`) : null,
    cancelado
      ? h("p", { class: "tarjeta-turno__aviso" }, "El paciente canceló este turno. El horario ya está libre.")
      : [vencido ? h("p", { class: "nota-vencido" }, "Este horario ya pasó.") : null,
         h("div", { class: "tarjeta-turno__acciones" },
           h("button", { type: "button", class: "btn", disabled: vencido, onclick: () => confirmarYAvisar(t) }, "Confirmar y avisar"),
           h("button", { type: "button", class: "btn btn--borde", onclick: () => rechazarYAvisar(t) }, "Rechazar y avisar"))]);
}

export async function montar(cont) {
  const hace24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [pend, canc] = await Promise.all([
    supabase.from("turnos").select(SEL).eq("estado", "pendiente").order("inicio"),
    supabase.from("turnos").select(SEL).eq("estado", "cancelado_paciente").gte("updated_at", hace24h).order("updated_at", { ascending: false }),
  ]);
  if (pend.error || canc.error) throw pend.error || canc.error;

  reemplazar(cont, 
    h("h2", { class: "vista__titulo" }, "Pendientes ", h("span", { class: "contador" }, String(pend.data.length))),
    pend.data.length
      ? pend.data.map((t) => tarjeta(t))
      : h("div", { class: "vacio-panel" }, h("p", {}, "No tenés solicitudes pendientes. 🎉")),
    canc.data.length ? [
      h("h3", { class: "vista__subtitulo" }, "Cancelados por pacientes (últimas 24 h)"),
      canc.data.map((t) => tarjeta(t, { cancelado: true })),
    ] : null);
  return pend.data.length;
}
