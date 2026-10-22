// Piezas de interfaz del panel: avisos (toast), hojas/modales, confirmaciones y apertura de WhatsApp.
import { h } from "../dom.js";

// ---------- Toast ----------
export function toast(texto, tipo = "ok") {
  const t = h("div", { class: `toast toast--${tipo}`, role: "status" }, texto);
  document.body.append(t);
  setTimeout(() => t.classList.add("toast--sale"), 2600);
  setTimeout(() => t.remove(), 3100);
}

// ---------- Hoja (modal) ----------
/** Abre una hoja. `contenido` es un nodo o lista de nodos. Devuelve { cerrar }. */
export function hoja({ titulo, contenido }) {
  document.getElementById("hoja")?.remove();
  const dlg = h("dialog", { id: "hoja", class: "hoja", "aria-labelledby": "hoja-titulo" },
    h("div", { class: "hoja__caja" },
      h("div", { class: "hoja__cab" },
        h("h3", { id: "hoja-titulo" }, titulo),
        h("button", { type: "button", class: "hoja__x", "aria-label": "Cerrar", onclick: () => dlg.close() }, "×")),
      h("div", { class: "hoja__cuerpo" }, contenido)));
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return { cerrar: () => dlg.close() };
}

// ---------- Confirmación ----------
/** Pregunta sí/no. Resuelve true si se confirmó. */
export function confirmar({ titulo, texto, boton = "Confirmar", peligro = false }) {
  return new Promise((resolver) => {
    let resultado = false;
    const { cerrar } = hoja({ titulo, contenido: [
      h("p", {}, texto),
      h("div", { class: "hoja__acciones" },
        h("button", { type: "button", class: "btn " + (peligro ? "btn--peligro" : ""), onclick: () => { resultado = true; cerrar(); } }, boton),
        h("button", { type: "button", class: "btn btn--borde", onclick: () => cerrar() }, "Volver")),
    ] });
    document.getElementById("hoja").addEventListener("close", () => resolver(resultado));
  });
}

// ---------- Acción + aviso por WhatsApp ----------
/**
 * Hace un cambio (ej. confirmar un turno) y abre WhatsApp con el aviso al paciente.
 * La ventana se abre ANTES de esperar la base de datos, dentro del toque del usuario,
 * para que el celular no la bloquee; después se la lleva al link de wa.me.
 * Si igual la bloquean, se muestra un botón para avisar.
 */
export async function accionYAvisar({ cambiar, armarUrl, titulo, aviso }) {
  const ventana = window.open("", "_blank");
  try {
    await cambiar();
  } catch (err) {
    ventana?.close();
    throw err;
  }
  const url = armarUrl();
  if (ventana) {
    ventana.location.href = url;
    toast(titulo);
    return;
  }
  hoja({ titulo, contenido: [
    h("p", {}, aviso),
    h("div", { class: "hoja__acciones" },
      h("a", { class: "btn btn--wsp", href: url, target: "_blank", rel: "noopener",
        onclick: () => setTimeout(() => document.getElementById("hoja")?.close(), 300) }, "Avisar por WhatsApp"),
      h("button", { type: "button", class: "btn btn--borde", onclick: () => document.getElementById("hoja")?.close() }, "Ahora no")),
  ] });
}

/** Muestra un mensaje de error legible a partir de un error de Supabase. */
export function mensajeError(err, porDefecto = "No se pudo guardar. Probá de nuevo.") {
  if (!err) return porDefecto;
  if (err.code === "23P01") return "Ese horario ya está ocupado por otro turno.";
  if (err.code === "23503") return "No se puede eliminar porque tiene turnos asociados. Desactivalo en su lugar.";
  if (err.code === "23514") return "Algún dato no es válido. Revisalo.";
  if (/network|fetch/i.test(err.message ?? "")) return "Sin conexión. Revisá internet e intentá de nuevo.";
  return porDefecto;
}
