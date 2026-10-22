// Flujo de reserva del paciente: motivo → día → horario → datos → éxito.
// Los horarios libres se calculan en el navegador (slots.js) solo para mostrar;
// la regla definitiva (superposición, franjas, anticipación) la aplica la base de datos.
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY } from "./supabase.js";
import { calcularSlots, fechaArg, sumarDias, formatoDia, formatoHora, nombreMes } from "./slots.js";
import { armarMensaje, linkWhatsApp } from "./whatsapp.js";
import { descargarICS } from "./ics.js";

const raiz = document.getElementById("turnero-contenedor");
if (raiz) iniciar();

// ---------- Utilidades de DOM ----------
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

// ---------- Estado ----------
const PASOS = ["Motivo", "Día", "Horario", "Tus datos"];
const e = {
  paso: 1, cfg: null, motivos: [], horarios: [], bloqueos: [], ocupados: [],
  motivo: null, fecha: null, slot: null, mes: null, diasLibres: new Set(),
  form: { nombre: "", telefono: "", obra_social: "", comentario: "", acepta: false },
  token: null, widgetId: null, enviando: false, aviso: "", errores: {}, cargando: false,
};

// ---------- Carga de datos ----------
async function cargarBase() {
  const ahoraISO = new Date().toISOString();
  const [cfg, mot, hor, blo] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).single(),
    supabase.from("motivos").select("*").eq("activo", true).order("orden"),
    supabase.from("horarios").select("*"),
    supabase.from("bloqueos").select("*").gte("hasta", ahoraISO),
  ]);
  const fallo = cfg.error || mot.error || hor.error || blo.error;
  if (fallo) throw fallo;
  e.cfg = cfg.data;
  e.motivos = mot.data;
  e.horarios = hor.data;
  e.bloqueos = blo.data.map((b) => ({ desde: new Date(b.desde), hasta: new Date(b.hasta) }));
}

// Turnos ocupados (solo rangos, sin datos personales). Se vuelve a pedir en cada paso importante.
async function cargarOcupados() {
  const desde = new Date(fechaArg() + "T00:00:00-03:00");
  const hasta = new Date(desde.getTime() + (e.cfg.anticipacion_max_dias + 1) * 86400000);
  const { data, error } = await supabase.rpc("get_disponibilidad", {
    p_desde: desde.toISOString(), p_hasta: hasta.toISOString() });
  if (error) throw error;
  e.ocupados = data.map((r) => ({ desde: new Date(r.inicio), hasta: new Date(r.fin) }));
}

const slotsDelDia = (fecha) => calcularSlots({
  fecha, duracionMin: e.motivo.duracion_min, intervaloMin: e.cfg.intervalo_min, horarios: e.horarios,
  bloqueos: e.bloqueos, ocupados: e.ocupados, ahora: new Date(), maxDias: e.cfg.anticipacion_max_dias });

function recalcularDias() {
  e.diasLibres = new Set();
  const hoy = fechaArg();
  for (let i = 0; i <= e.cfg.anticipacion_max_dias; i++) {
    const f = sumarDias(hoy, i);
    if (slotsDelDia(f).length) e.diasLibres.add(f);
  }
  const primero = [...e.diasLibres].sort()[0];
  if (!e.mes || !e.diasLibres.has(e.fecha)) e.mes = (primero ?? hoy).slice(0, 7);
}

// ---------- Navegación ----------
async function irA(paso) {
  if (paso === 2 || paso === 3) {
    // Datos frescos: otro paciente pudo haber reservado mientras tanto
    e.cargando = true; dibujar();
    try { await cargarOcupados(); recalcularDias(); }
    catch { e.aviso = "No pudimos cargar los horarios. Revisá tu conexión e intentá de nuevo."; }
    e.cargando = false;
    if (paso === 3 && !slotsDelDia(e.fecha).length) { paso = 2; e.aviso = "Ese día ya no tiene horarios libres. Elegí otro."; }
  }
  e.paso = paso;
  dibujar();
  raiz.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Dibujo ----------
function dibujar() {
  const tarjeta = h("div", { class: "turnero" }, progreso(), h("div", { class: "turnero__cuerpo" }, cuerpo()));
  raiz.replaceChildren(tarjeta);
  if (e.paso === 4 && !e.exito) montarTurnstile();
}

function progreso() {
  if (e.exito) return null;
  return h("ol", { class: "progreso", "aria-label": "Pasos de la reserva" },
    PASOS.map((nombre, i) => h("li", {
      class: "progreso__paso" + (i + 1 === e.paso ? " activo" : "") + (i + 1 < e.paso ? " hecho" : ""),
      "aria-current": i + 1 === e.paso ? "step" : null,
    }, h("span", { class: "progreso__num" }, i + 1 < e.paso ? "✓" : String(i + 1)), h("span", { class: "progreso__txt" }, nombre))));
}

function cuerpo() {
  if (e.exito) return pantallaExito();
  const avisoEl = e.aviso ? h("p", { class: "aviso-error", role: "alert" }, e.aviso) : null;
  if (e.cargando) return [h("p", { class: "cargando" }, "Cargando horarios…")];
  return [avisoEl, [paso1, paso2, paso3, paso4][e.paso - 1]()];
}

function volver(paso) {
  return h("button", { type: "button", class: "btn btn--borde btn--chico", onclick: () => { e.aviso = ""; irA(paso); } }, "← Volver");
}

// Paso 1: motivo
function paso1() {
  return h("div", {},
    h("h3", { class: "turnero__titulo" }, "¿Cuál es el motivo de tu consulta?"),
    h("div", { class: "opciones" }, e.motivos.map((m) => h("button", {
      type: "button", class: "opcion", "aria-pressed": e.motivo?.id === m.id ? "true" : "false",
      onclick: () => { e.motivo = m; e.aviso = ""; irA(2); },
    }, h("strong", {}, m.nombre), h("span", {}, m.descripcion || ""), h("em", {}, `${m.duracion_min} min`)))));
}

// Paso 2: calendario
function paso2() {
  const [y, m] = e.mes.split("-").map(Number);
  const hoy = fechaArg();
  const maxMes = sumarDias(hoy, e.cfg.anticipacion_max_dias).slice(0, 7);
  const minMes = hoy.slice(0, 7);
  const cambiarMes = (d) => { const f = new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7); e.mes = f; dibujar(); };
  const primerDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // semana desde el lunes
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const celdas = Array.from({ length: primerDow }, () => h("span", { class: "dia dia--vacio" }));
  for (let d = 1; d <= diasMes; d++) {
    const f = `${e.mes}-${String(d).padStart(2, "0")}`;
    const libre = e.diasLibres.has(f);
    celdas.push(h("button", {
      type: "button", class: "dia" + (libre ? " dia--libre" : ""), disabled: !libre,
      "aria-label": libre ? `${d} de ${nombreMes(m - 1)}, hay horarios` : `${d} de ${nombreMes(m - 1)}, sin horarios`,
      "aria-pressed": e.fecha === f ? "true" : null,
      onclick: () => { e.fecha = f; e.aviso = ""; irA(3); },
    }, String(d)));
  }

  const sinDias = e.diasLibres.size === 0;
  return h("div", {},
    h("h3", { class: "turnero__titulo" }, "Elegí el día"),
    resumenMotivo(),
    sinDias
      ? h("div", { class: "vacio" },
          h("p", {}, `No hay horarios disponibles en los próximos ${e.cfg.anticipacion_max_dias} días.`),
          h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener",
            href: linkWhatsApp(e.cfg.whatsapp, "Hola Daniel, quería consultarte por un turno.") }, "Escribile a Daniel por WhatsApp"))
      : h("div", { class: "cal" },
          h("div", { class: "cal__cabecera" },
            h("button", { type: "button", class: "cal__nav", disabled: e.mes <= minMes, "aria-label": "Mes anterior", onclick: () => cambiarMes(-1) }, "‹"),
            h("strong", {}, `${nombreMes(m - 1)} ${y}`),
            h("button", { type: "button", class: "cal__nav", disabled: e.mes >= maxMes, "aria-label": "Mes siguiente", onclick: () => cambiarMes(1) }, "›")),
          h("div", { class: "cal__grilla" },
            ["L", "M", "M", "J", "V", "S", "D"].map((x) => h("span", { class: "cal__dow", "aria-hidden": "true" }, x)), celdas),
          h("p", { class: "cal__ayuda" }, "Los días en azul tienen horarios libres.")),
    h("div", { class: "turnero__pie" }, volver(1)));
}

function resumenMotivo() {
  return h("p", { class: "resumen-linea" }, h("strong", {}, e.motivo.nombre), ` · ${e.motivo.duracion_min} min`);
}

// Paso 3: horario
function paso3() {
  const slots = slotsDelDia(e.fecha);
  return h("div", {},
    h("h3", { class: "turnero__titulo" }, "Elegí el horario"),
    h("p", { class: "resumen-linea" }, h("strong", {}, e.motivo.nombre), ` · ${formatoDia(slots[0] ?? new Date(e.fecha + "T12:00:00-03:00"))}`),
    h("div", { class: "horas" }, slots.map((s) => h("button", {
      type: "button", class: "hora", onclick: () => { e.slot = s; e.aviso = ""; irA(4); },
    }, formatoHora(s)))),
    h("div", { class: "turnero__pie" }, volver(2)));
}

// Paso 4: datos
function campo(id, etiqueta, opts = {}) {
  const err = e.errores[id];
  const ctrl = h(opts.area ? "textarea" : "input", {
    id: `f-${id}`, name: id, rows: opts.area ? 3 : null, type: opts.area ? null : (opts.type || "text"),
    inputmode: opts.inputmode, autocomplete: opts.autocomplete, maxlength: opts.max, placeholder: opts.ph,
    required: opts.req, "aria-invalid": err ? "true" : null, "aria-describedby": err ? `e-${id}` : null,
    oninput: (ev) => { e.form[id] = ev.target.value; },
  });
  ctrl.value = e.form[id];
  return h("div", { class: "campo" },
    h("label", { for: `f-${id}` }, etiqueta, opts.req ? "" : h("span", { class: "opcional" }, " (opcional)")),
    ctrl, err ? h("small", { id: `e-${id}`, class: "campo__error" }, err) : null);
}

function paso4() {
  return h("div", {},
    h("h3", { class: "turnero__titulo" }, "Tus datos"),
    h("div", { class: "resumen" },
      h("div", {}, h("span", {}, "Motivo"), h("strong", {}, e.motivo.nombre)),
      h("div", {}, h("span", {}, "Día"), h("strong", {}, formatoDia(e.slot))),
      h("div", {}, h("span", {}, "Hora"), h("strong", {}, `${formatoHora(e.slot)} hs`))),
    h("form", { class: "form", novalidate: true, onsubmit: enviar },
      campo("nombre", "Nombre y apellido", { req: true, autocomplete: "name", max: 100 }),
      campo("telefono", "WhatsApp", { req: true, type: "tel", inputmode: "tel", autocomplete: "tel", ph: "Ej: 221 555-1234", max: 25 }),
      campo("obra_social", "Obra social", { max: 100 }),
      campo("comentario", "Comentario", { area: true, max: 500 }),
      h("label", { class: "check" },
        h("input", { type: "checkbox", id: "f-acepta", checked: e.form.acepta, onchange: (ev) => { e.form.acepta = ev.target.checked; } }),
        h("span", {}, e.cfg.aviso_datos)),
      e.errores.acepta ? h("small", { class: "campo__error" }, e.errores.acepta) : null,
      h("div", { id: "caja-turnstile", class: "turnstile" }),
      e.errores.captcha ? h("small", { class: "campo__error" }, e.errores.captcha) : null,
      h("div", { class: "turnero__pie" }, volver(3),
        h("button", { type: "submit", class: "btn", disabled: e.enviando }, e.enviando ? "Enviando…" : "Solicitar turno"))));
}

// ---------- Turnstile ----------
function cargarTurnstile() {
  return new Promise((ok, fallo) => {
    // OJO: no usar id="turnstile" en el HTML, porque crearía un window.turnstile falso
    if (typeof window.turnstile?.render === "function") return ok();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = ok; s.onerror = fallo;
    document.head.append(s);
  });
}

// El token es de un solo uso y se conserva mientras el formulario se redibuja (errores de
// validación, "Enviando…"). Si ya hay token no se vuelve a pedir el desafío.
async function montarTurnstile() {
  const cont = document.getElementById("caja-turnstile");
  if (!cont) return;
  if (e.token) { cont.textContent = "✓ Verificación anti-spam completada"; return; }
  try {
    await cargarTurnstile();
    if (!cont.isConnected) return;   // el formulario se volvió a dibujar mientras cargaba
    e.widgetId = window.turnstile.render(cont, {
      sitekey: TURNSTILE_SITE_KEY, language: "es",
      callback: (t) => { e.token = t; },
      "expired-callback": () => { e.token = null; },
      "error-callback": () => { e.token = null; },
    });
  } catch {
    e.errores.captcha = "No pudimos cargar la verificación anti-spam. Recargá la página e intentá de nuevo.";
  }
}

// ---------- Envío ----------
function validar() {
  const f = e.form, err = {};
  if (f.nombre.trim().length < 2) err.nombre = "Escribí tu nombre y apellido.";
  if (f.telefono.replace(/\D/g, "").length < 8) err.telefono = "Escribí un número de WhatsApp válido, con característica.";
  if (!f.acepta) err.acepta = "Tenés que aceptar el uso de tus datos para reservar.";
  if (!e.token) err.captcha = "Esperá a que se complete la verificación anti-spam.";
  return err;
}

const MENSAJES = {
  telefono_invalido: "Revisá el número de WhatsApp: tiene que ser un celular argentino con característica.",
  pendiente_existente: "Ya tenés una solicitud pendiente con ese teléfono. Esperá a que Daniel la confirme o escribile por WhatsApp.",
  captcha_invalido: "No pudimos verificar que sos una persona. Probá de nuevo.",
  datos_invalidos: "Revisá los datos que cargaste e intentá de nuevo.",
};

async function enviar(ev) {
  ev.preventDefault();
  if (e.enviando) return;
  e.errores = validar();
  if (Object.keys(e.errores).length) { e.aviso = ""; dibujar(); return; }
  e.enviando = true; e.aviso = ""; dibujar();

  let r;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/crear-turno`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({
        motivo_id: e.motivo.id, inicio: e.slot.toISOString(), nombre: e.form.nombre, telefono: e.form.telefono,
        obra_social: e.form.obra_social, comentario: e.form.comentario, turnstile_token: e.token }),
    });
    r = await resp.json();
  } catch {
    r = { ok: false, error: "red" };
  }
  e.enviando = false;

  if (r.ok) { e.exito = r; e.slotConfirmado = e.slot; dibujar(); raiz.scrollIntoView({ behavior: "smooth" }); return; }

  // El token de Turnstile es de un solo uso: hay que pedir otro en cualquier error
  e.token = null;
  if (r.error === "horario_ocupado" || r.error === "fuera_de_horario" || r.error === "dia_bloqueado" ||
      r.error === "horario_pasado" || r.error === "fuera_de_anticipacion") {
    e.aviso = r.error === "horario_ocupado" ? "Ese horario se acaba de ocupar. Elegí otro." : "Ese horario ya no está disponible. Elegí otro.";
    e.errores = {};
    await irA(3);   // recarga los horarios frescos
    return;
  }
  e.aviso = MENSAJES[r.error] ?? "No pudimos registrar tu turno. Probá de nuevo en un momento o escribile a Daniel por WhatsApp.";
  e.errores = {};
  dibujar();
}

// ---------- Pantalla de éxito ----------
function pantallaExito() {
  const inicio = e.slotConfirmado;
  const origen = location.origin;
  const linkTurno = `${origen}/turno.html?t=${e.exito.token}`;
  const vars = {
    motivo: e.motivo.nombre, dia: formatoDia(inicio), hora: formatoHora(inicio), nombre: e.form.nombre.trim(),
    obra_social: e.form.obra_social.trim() || "sin obra social", link_panel: `${origen}/panel/?turno=${e.exito.id}`,
  };
  const linkWsp = linkWhatsApp(e.cfg.whatsapp, armarMensaje(e.cfg.msg_solicitud, vars));
  const fin = new Date(inicio.getTime() + e.motivo.duracion_min * 60000);

  return h("div", { class: "exito" },
    h("div", { class: "exito__icono", "aria-hidden": "true" }, "✓"),
    h("h3", {}, "¡Solicitud registrada!"),
    h("p", { class: "resumen-linea" }, h("strong", {}, `${formatoDia(inicio)} · ${formatoHora(inicio)} hs`), ` · ${e.motivo.nombre}`),
    h("p", { class: "exito__nota" }, "Tu turno queda ", h("strong", {}, "pendiente"),
      " hasta que Daniel lo confirme. Mandale la solicitud por WhatsApp para que lo vea enseguida."),
    h("div", { class: "acciones" },
      h("a", { class: "btn btn--wsp", href: linkWsp, target: "_blank", rel: "noopener" }, "Enviar solicitud a Daniel"),
      h("button", { type: "button", class: "btn btn--borde", onclick: () => descargarICS({
        titulo: `Turno con Daniel Gonzalez – ${e.motivo.nombre}`, inicio, fin, lugar: e.cfg.direccion,
        descripcion: `Turno pendiente de confirmación. Ver o cancelar: ${linkTurno}`, uid: e.exito.id }) }, "Agregar a mi calendario"),
      h("a", { class: "btn btn--borde", href: linkTurno }, "Ver o cancelar mi turno")),
    h("p", { class: "exito__nota" }, "Guardá el link de tu turno: es privado y es la única forma de verlo o cancelarlo."),
    h("button", { type: "button", class: "btn btn--chico btn--borde", onclick: reiniciar }, "Reservar otro turno"));
}

function reiniciar() {
  Object.assign(e, { paso: 1, motivo: null, fecha: null, slot: null, exito: null, token: null, aviso: "", errores: {},
    form: { nombre: "", telefono: "", obra_social: "", comentario: "", acepta: false } });
  dibujar();
}

// ---------- Inicio ----------
async function iniciar() {
  try {
    await cargarBase();
  } catch (err) {
    console.error(err);
    raiz.replaceChildren(h("div", { class: "turnero" }, h("div", { class: "turnero__cuerpo" },
      h("p", { class: "aviso-error" }, "No pudimos cargar el turnero en este momento. Podés pedir tu turno por WhatsApp."),
      h("a", { class: "btn btn--wsp", target: "_blank", rel: "noopener", "data-wsp": "", href: "#" }, "Pedir turno por WhatsApp"))));
    return;
  }
  // Si el paciente tocó "Reservar" en una tarjeta de servicios, arranca con ese motivo
  const elegir = (id) => {
    const m = e.motivos.find((x) => x.id === id);
    if (m && !e.exito) { e.motivo = m; irA(2); }
  };
  document.addEventListener("reservar", (ev) => elegir(ev.detail.motivoId));
  dibujar();
  if (window.motivoPreseleccionado) elegir(window.motivoPreseleccionado);
}
