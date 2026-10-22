// Configuración → Horarios: franjas de atención por día de la semana.
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { ctx, cargarContexto } from "./estado.js";
import { toast, mensajeError } from "./ui.js";

const NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];   // la semana arranca el lunes
const hhmm = (t) => t.slice(0, 5);

export async function montar(cont) {
  const recargar = async () => { await cargarContexto(); montar(cont); };

  async function agregar(dia) {
    const previas = ctx.horarios.filter((x) => x.dia_semana === dia);
    const fin = previas.length ? hhmm(previas.at(-1).hora_fin) : null;
    // Si ya hay una franja, la nueva arranca 2 horas después de donde termina la última
    const ini = fin && fin < "20:00" ? `${String(Number(fin.slice(0, 2)) + 2).padStart(2, "0")}:${fin.slice(3)}` : "09:00";
    const fn = ini < "20:00" ? `${String(Number(ini.slice(0, 2)) + 3).padStart(2, "0")}:${ini.slice(3)}` : "23:00";
    const { error } = await supabase.from("horarios").insert({ dia_semana: dia, hora_inicio: ini, hora_fin: fn > "23:59" ? "23:59" : fn });
    if (error) return toast(mensajeError(error), "error");
    toast("Franja agregada");
    recargar();
  }

  async function guardar(franja, campo, valor, input) {
    const nueva = { ...franja, [campo]: valor };
    const otras = ctx.horarios.filter((x) => x.dia_semana === franja.dia_semana && x.id !== franja.id);
    const invalida = !valor || nueva.hora_fin <= nueva.hora_inicio;
    const pisa = otras.some((o) => hhmm(o.hora_inicio) < hhmm(nueva.hora_fin) && hhmm(o.hora_fin) > hhmm(nueva.hora_inicio));
    if (invalida || pisa) {
      input.value = hhmm(franja[campo]);
      return toast(invalida ? "La hora de fin tiene que ser posterior a la de inicio." : "Esa franja se superpone con otra del mismo día.", "error");
    }
    const { error } = await supabase.from("horarios").update({ [campo]: valor }).eq("id", franja.id);
    if (error) { input.value = hhmm(franja[campo]); return toast(mensajeError(error), "error"); }
    toast("Guardado");
    await cargarContexto();
  }

  async function borrar(franja) {
    const { error } = await supabase.from("horarios").delete().eq("id", franja.id);
    if (error) return toast(mensajeError(error), "error");
    toast("Franja eliminada");
    recargar();
  }

  reemplazar(cont, 
    h("p", { class: "ayuda" }, "Cargá las franjas en las que atendés. Si cortás al mediodía, agregá dos franjas el mismo día."),
    ORDEN.map((dia) => {
      const franjas = ctx.horarios.filter((x) => x.dia_semana === dia);
      return h("section", { class: "bloque" },
        h("div", { class: "bloque__cab" }, h("h3", {}, NOMBRES[dia]),
          h("button", { type: "button", class: "btn btn--chico btn--borde", onclick: () => agregar(dia) }, "+ Franja")),
        franjas.length ? franjas.map((fr) => {
          const ini = h("input", { type: "time", value: hhmm(fr.hora_inicio), "aria-label": `${NOMBRES[dia]} desde`,
            onchange: (ev) => guardar(fr, "hora_inicio", ev.target.value, ev.target) });
          const fin = h("input", { type: "time", value: hhmm(fr.hora_fin), "aria-label": `${NOMBRES[dia]} hasta`,
            onchange: (ev) => guardar(fr, "hora_fin", ev.target.value, ev.target) });
          return h("div", { class: "franja" }, ini, h("span", {}, "a"), fin,
            h("button", { type: "button", class: "icono-borrar", "aria-label": "Eliminar franja", onclick: () => borrar(fr) }, "🗑"));
        }) : h("p", { class: "agenda-dia__vacio" }, "No atendés este día"));
    }));
}
