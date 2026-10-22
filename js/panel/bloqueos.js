// Configuración → Bloqueos: días u horas sin atención (vacaciones, feriados, trámites).
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { fechaArg, sumarDias, instante, formatoDia, formatoHora } from "../slots.js";
import { ctx, cargarContexto } from "./estado.js";
import { toast, mensajeError } from "./ui.js";

export async function montar(cont) {
  const recargar = async () => { await cargarContexto(); montar(cont); };
  const hoy = fechaArg();
  const d = { desde: hoy, hasta: hoy, todoElDia: true, horaDesde: "09:00", horaHasta: "13:00", nota: "" };
  const vigentes = ctx.bloqueos.filter((b) => new Date(b.hasta) > new Date());

  const fechas = h("div", { class: "dos-col" },
    h("div", { class: "campo" }, h("label", { for: "b-desde" }, "Desde"),
      h("input", { id: "b-desde", type: "date", value: d.desde, min: hoy, onchange: (ev) => { d.desde = ev.target.value; if (d.hasta < d.desde) { d.hasta = d.desde; document.getElementById("b-hasta").value = d.hasta; } } })),
    h("div", { class: "campo" }, h("label", { for: "b-hasta" }, "Hasta"),
      h("input", { id: "b-hasta", type: "date", value: d.hasta, min: hoy, onchange: (ev) => { d.hasta = ev.target.value; } })));
  const horas = h("div", { class: "dos-col", hidden: true },
    h("div", { class: "campo" }, h("label", { for: "b-hd" }, "Hora de inicio"), h("input", { id: "b-hd", type: "time", value: d.horaDesde, onchange: (ev) => { d.horaDesde = ev.target.value; } })),
    h("div", { class: "campo" }, h("label", { for: "b-hh" }, "Hora de fin"), h("input", { id: "b-hh", type: "time", value: d.horaHasta, onchange: (ev) => { d.horaHasta = ev.target.value; } })));

  const form = h("form", { class: "form bloque", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    if (!d.desde || !d.hasta) return toast("Elegí las fechas.", "error");
    // Todo en hora argentina. "Todo el día" va de las 00:00 del primer día a las 00:00 del día siguiente al último.
    const desde = instante(d.desde, d.todoElDia ? "00:00" : d.horaDesde);
    const hasta = d.todoElDia ? instante(sumarDias(d.hasta, 1), "00:00") : instante(d.hasta, d.horaHasta);
    if (!(hasta > desde)) return toast("El fin tiene que ser posterior al inicio.", "error");
    const { error } = await supabase.from("bloqueos").insert({ desde: desde.toISOString(), hasta: hasta.toISOString(), nota: d.nota.trim() || null });
    if (error) return toast(mensajeError(error), "error");
    toast("Bloqueo agregado");
    recargar();
  } },
    h("h3", {}, "Nuevo bloqueo"),
    fechas,
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: true, onchange: (ev) => { d.todoElDia = ev.target.checked; horas.hidden = ev.target.checked; } }), h("span", {}, "Todo el día")),
    horas,
    h("div", { class: "campo" }, h("label", { for: "b-nota" }, "Nota (opcional)"), h("input", { id: "b-nota", type: "text", maxlength: 120, placeholder: "Ej: vacaciones", oninput: (ev) => { d.nota = ev.target.value; } })),
    h("button", { type: "submit", class: "btn" }, "Agregar bloqueo"));

  reemplazar(cont, 
    h("p", { class: "ayuda" }, "En los días u horas bloqueados la web no ofrece turnos."),
    form,
    h("h3", { class: "vista__subtitulo" }, "Bloqueos vigentes"),
    vigentes.length ? vigentes.map((b) => {
      const a = new Date(b.desde), z = new Date(b.hasta);
      return h("div", { class: "bloque bloqueo-fila" },
        h("div", {}, h("strong", {}, `${formatoDia(a)} ${formatoHora(a)} hs`), h("br"), h("span", {}, `hasta ${formatoDia(z)} ${formatoHora(z)} hs`),
          b.nota ? h("small", {}, b.nota) : null),
        h("button", { type: "button", class: "icono-borrar", "aria-label": "Eliminar bloqueo", onclick: async () => {
          const { error } = await supabase.from("bloqueos").delete().eq("id", b.id);
          if (error) return toast(mensajeError(error), "error");
          toast("Bloqueo eliminado"); recargar(); } }, "🗑"));
    }) : h("p", { class: "agenda-dia__vacio" }, "No hay bloqueos vigentes."));
}
