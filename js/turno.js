// Pantalla privada del paciente: ver y cancelar su turno con el link /turno.html?t=código.
import { supabase } from "./supabase.js";
import { formatoDia, formatoHora } from "./slots.js";
import { armarMensaje, linkWhatsApp } from "./whatsapp.js";
import { descargarICS } from "./ics.js";

const cont = document.getElementById("turno-contenido");
const token = new URLSearchParams(location.search).get("t");

function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...hijos.flat().filter((x) => x != null && x !== false));
  return el;
}
const mostrar = (...nodos) => cont.replaceChildren(h("div", { class: "turnero__cuerpo" }, ...nodos));

const ESTADOS = {
  pendiente: ["Pendiente de confirmación", ""],
  confirmado: ["Confirmado", "estado--ok"],
  rechazado: ["No disponible", "estado--mal"],
  cancelado_paciente: ["Cancelado", "estado--mal"],
  cancelado_profesional: ["Cancelado por el consultorio", "estado--mal"],
  asistio: ["Asististe", "estado--ok"],
  ausente: ["No asististe", "estado--mal"],
};

function datos(t) {
  const inicio = new Date(t.inicio);
  return h("div", { class: "datos-turno" },
    h("div", {}, h("span", {}, "Paciente"), h("strong", {}, t.nombre)),
    h("div", {}, h("span", {}, "Motivo"), h("strong", {}, t.motivo)),
    h("div", {}, h("span", {}, "Día"), h("strong", {}, formatoDia(inicio))),
    h("div", {}, h("span", {}, "Hora"), h("strong", {}, `${formatoHora(inicio)} hs`)));
}

async function iniciar() {
  if (!/^[0-9a-f-]{36}$/i.test(token ?? "")) return noEncontrado();

  const [t, c] = await Promise.all([
    supabase.rpc("get_turno_por_token", { p_token: token }),
    supabase.from("config").select("*").eq("id", 1).single(),
  ]);
  if (t.error || c.error) {
    return mostrar(h("p", { class: "aviso-error" }, "No pudimos cargar tu turno. Revisá tu conexión e intentá de nuevo."));
  }
  const turno = t.data?.[0];
  if (!turno) return noEncontrado();
  dibujar(turno, c.data);
}

function noEncontrado() {
  mostrar(h("h3", { class: "turnero__titulo" }, "No encontramos tu turno"),
    h("p", {}, "El link no es válido o está incompleto. Revisá que lo hayas copiado entero."),
    h("a", { class: "btn", href: "index.html#turnero" }, "Reservar un turno"));
}

function dibujar(t, cfg) {
  const [txt, clase] = ESTADOS[t.estado] ?? [t.estado, ""];
  const inicio = new Date(t.inicio);
  const activo = t.estado === "pendiente" || t.estado === "confirmado";
  const vars = { nombre: t.nombre, dia: formatoDia(inicio), hora: formatoHora(inicio), motivo: t.motivo,
    link_turnero: `${location.origin}/index.html#turnero` };

  const acciones = [];
  if (activo) {
    acciones.push(h("button", { type: "button", class: "btn btn--borde", onclick: () => descargarICS({
      titulo: `Turno con Daniel Gonzalez – ${t.motivo}`, inicio, fin: new Date(t.fin), lugar: cfg.direccion,
      descripcion: `Ver o cancelar: ${location.href}`, uid: token }) }, "Agregar a mi calendario"));
    if (t.puede_cancelar) {
      acciones.unshift(h("button", { type: "button", class: "btn", onclick: () => cancelar(t, cfg, vars) }, "Cancelar turno"));
    } else {
      acciones.unshift(h("p", { class: "exito__nota" }, `Para cancelar comunicate con Daniel (los turnos se cancelan hasta ${cfg.horas_min_cancelacion} horas antes).`),
        h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener",
          href: linkWhatsApp(cfg.whatsapp, `Hola Daniel, necesito cancelar mi turno del ${vars.dia} a las ${vars.hora}. ${t.nombre}`) }, "Escribirle a Daniel"));
    }
  } else if (t.estado === "rechazado") {
    acciones.push(h("a", { class: "btn", href: "index.html#turnero" }, "Elegir otro horario"));
  } else {
    acciones.push(h("a", { class: "btn", href: "index.html#turnero" }, "Reservar un turno"));
  }

  mostrar(h("span", { class: `estado ${clase}` }, txt), h("h3", { class: "turnero__titulo" }, "Tu turno"), datos(t),
    t.estado === "pendiente" ? h("p", { class: "exito__nota" }, "Daniel todavía tiene que confirmarlo. Te avisa por WhatsApp.") : null,
    h("div", { class: "acciones" }, acciones),
    h("p", { class: "exito__nota" }, h("strong", {}, "Dirección: "), cfg.direccion));
}

async function cancelar(t, cfg, vars) {
  if (!confirm("¿Querés cancelar este turno? El horario se libera para otra persona.")) return;
  const { data, error } = await supabase.rpc("cancelar_turno_por_token", { p_token: token });
  if (error || !data?.ok) {
    const fuera = data?.error === "fuera_de_termino";
    mostrar(h("p", { class: "aviso-error", role: "alert" }, fuera
      ? `Ya no se puede cancelar online (faltan menos de ${cfg.horas_min_cancelacion} horas). Comunicate con Daniel.`
      : "No pudimos cancelar el turno. Probá de nuevo o escribile a Daniel."),
      h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener",
        href: linkWhatsApp(cfg.whatsapp, `Hola Daniel, necesito cancelar mi turno del ${vars.dia} a las ${vars.hora}. ${t.nombre}`) }, "Escribirle a Daniel"));
    return;
  }
  const aviso = linkWhatsApp(cfg.whatsapp, armarMensaje(cfg.msg_cancelacion, vars));
  mostrar(h("div", { class: "exito" },
    h("div", { class: "exito__icono", "aria-hidden": "true" }, "✓"),
    h("h3", {}, "Turno cancelado"),
    h("p", { class: "exito__nota" }, "El horario quedó libre. Avisale a Daniel por WhatsApp así se entera enseguida."),
    h("div", { class: "acciones" },
      h("a", { class: "btn btn--wsp", href: aviso, target: "_blank", rel: "noopener" }, "Avisar a Daniel"),
      h("a", { class: "btn btn--borde", href: "index.html#turnero" }, "Reservar otro turno"))));
}

iniciar();
