// Configuración → Motivos de consulta (nombre, descripción, duración, activo, orden).
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { ctx, cargarContexto } from "./estado.js";
import { toast, mensajeError, confirmar } from "./ui.js";

function formulario(m, alGuardar, alBorrar) {
  const nuevo = !m.id;
  const d = { nombre: m.nombre ?? "", descripcion: m.descripcion ?? "", duracion_min: m.duracion_min ?? 30, orden: m.orden ?? 0, activo: m.activo ?? true };
  const inp = (id, etiqueta, attrs) => {
    const c = h(id === "descripcion" ? "textarea" : "input", { rows: 2, ...attrs, oninput: (ev) => { d[id] = ev.target.type === "number" ? Number(ev.target.value) : ev.target.value; } });
    c.value = d[id];
    return h("div", { class: "campo" }, h("label", {}, etiqueta), c);
  };
  return h("form", { class: "form bloque", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (d.nombre.trim().length < 2) return toast("Escribí el nombre del motivo.", "error");
    if (!Number.isInteger(d.duracion_min) || d.duracion_min < 5 || d.duracion_min > 480) return toast("La duración tiene que estar entre 5 y 480 minutos.", "error");
    const fila = { nombre: d.nombre.trim(), descripcion: d.descripcion.trim() || null, duracion_min: d.duracion_min, orden: d.orden || 0, activo: d.activo };
    const q = nuevo ? supabase.from("motivos").insert(fila) : supabase.from("motivos").update(fila).eq("id", m.id);
    const { error } = await q;
    if (error) return toast(mensajeError(error), "error");
    toast(nuevo ? "Motivo creado" : "Guardado");
    alGuardar();
  } },
    h("h3", {}, nuevo ? "Nuevo motivo" : m.nombre),
    inp("nombre", "Nombre", { type: "text", maxlength: 80 }),
    inp("descripcion", "Descripción", { maxlength: 300 }),
    h("div", { class: "dos-col" },
      inp("duracion_min", "Duración (min)", { type: "number", min: 5, max: 480, step: 5, inputmode: "numeric" }),
      inp("orden", "Orden", { type: "number", step: 1, inputmode: "numeric" })),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: d.activo, onchange: (ev) => { d.activo = ev.target.checked; } }),
      h("span", {}, "Activo (se muestra en la web)")),
    h("div", { class: "hoja__acciones" },
      h("button", { type: "submit", class: "btn" }, nuevo ? "Crear motivo" : "Guardar"),
      nuevo ? null : h("button", { type: "button", class: "btn btn--peligro-borde", onclick: alBorrar }, "Eliminar")));
}

export async function montar(cont) {
  const recargar = async () => { await cargarContexto(); montar(cont); };
  const borrar = (m) => async () => {
    if (!(await confirmar({ titulo: "¿Eliminar este motivo?", peligro: true, boton: "Eliminar",
      texto: "Si ya tiene turnos asociados no se puede eliminar: en ese caso desactivalo." }))) return;
    const { error } = await supabase.from("motivos").delete().eq("id", m.id);
    if (error) return toast(mensajeError(error), "error");
    toast("Motivo eliminado");
    recargar();
  };
  reemplazar(cont, 
    h("p", { class: "ayuda" }, "Cada motivo define cuánto dura el turno. Los activos aparecen en la web."),
    ctx.motivos.map((m) => formulario(m, recargar, borrar(m))),
    formulario({}, recargar));
}
