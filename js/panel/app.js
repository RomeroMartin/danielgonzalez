// Panel de Daniel: login, navegación y arranque. Pensado para el celular (PWA).
import { supabase } from "../supabase.js";
import { h, reemplazar } from "../dom.js";
import { cargarContexto } from "./estado.js";
import { abrirPorId } from "./detalle.js";
import * as pendientes from "./pendientes.js";
import * as agenda from "./agenda.js";
import * as manual from "./manual.js";
import * as horarios from "./horarios.js";
import * as motivos from "./motivos.js";
import * as bloqueos from "./bloqueos.js";
import * as ajustes from "./ajustes.js";

const app = document.getElementById("app");
const estado = { tab: "pendientes", sub: "horarios", timer: null, escuchando: false };
let promptInstalar = null;
window.addEventListener("beforeinstallprompt", (ev) => { ev.preventDefault(); promptInstalar = ev; });

// ---------- Íconos (SVG de línea) ----------
const ICONOS = {
  pendientes: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  nuevo: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  config: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
};
function icono(nombre) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONOS[nombre];
  return s;
}

const TABS = [["pendientes", "Pendientes"], ["agenda", "Agenda"], ["nuevo", "Agendar"], ["config", "Config"]];
const SUBS = [["horarios", "Horarios", horarios], ["motivos", "Motivos", motivos], ["bloqueos", "Bloqueos", bloqueos], ["ajustes", "Ajustes", ajustes]];

// ---------- Login ----------
function mostrarLogin(mensaje = "") {
  clearInterval(estado.timer);
  const error = h("p", { class: "aviso-error", role: "alert", hidden: !mensaje }, mensaje);
  reemplazar(app, h("main", { class: "login" },
    h("div", { class: "login__caja" },
      h("img", { src: "../assets/favicon.svg", alt: "", width: 64, height: 64 }),
      h("h1", {}, "Panel de turnos"),
      h("p", { class: "lead" }, "Daniel Gonzalez · Consultorio Optométrico"),
      h("form", { class: "form", onsubmit: async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const btn = ev.target.querySelector("button");
        btn.disabled = true; btn.textContent = "Ingresando…";
        const { error: err } = await supabase.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
        if (err) {
          btn.disabled = false; btn.textContent = "Ingresar";
          error.hidden = false;
          error.textContent = /network|fetch/i.test(err.message) ? "Sin conexión. Revisá internet e intentá de nuevo." : "Email o contraseña incorrectos.";
          return;
        }
        entrar();
      } },
        error,
        h("div", { class: "campo" }, h("label", { for: "l-email" }, "Email"),
          h("input", { id: "l-email", name: "email", type: "email", autocomplete: "username", required: true })),
        h("div", { class: "campo" }, h("label", { for: "l-pass" }, "Contraseña"),
          h("input", { id: "l-pass", name: "password", type: "password", autocomplete: "current-password", required: true })),
        h("button", { type: "submit", class: "btn" }, "Ingresar")))));
}

async function salir() {
  await supabase.auth.signOut();
  mostrarLogin();
}

// ---------- Estructura ----------
const nodos = {};

function armarEstructura() {
  nodos.vista = h("main", { id: "vista", class: "vista", tabIndex: -1 });
  nodos.globo = h("span", { class: "globo", hidden: true });
  nodos.nav = h("nav", { class: "barra", "aria-label": "Secciones" },
    TABS.map(([id, texto]) => h("button", { type: "button", class: "barra__btn", "data-tab": id, onclick: () => ir(id) },
      icono(id), h("span", {}, texto), id === "pendientes" ? nodos.globo : null)));
  reemplazar(app, 
    h("header", { class: "cabecera" },
      h("img", { src: "../assets/favicon.svg", alt: "", width: 32, height: 32 }),
      h("strong", {}, "Daniel Gonzalez"),
      h("button", { type: "button", class: "cabecera__btn", "aria-label": "Actualizar", onclick: () => refrescarTodo() }, "⟳")),
    nodos.vista, nodos.nav);
}

function marcarTab() {
  nodos.nav.querySelectorAll(".barra__btn").forEach((b) => {
    const activo = b.dataset.tab === estado.tab;
    b.classList.toggle("activo", activo);
    if (activo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

async function actualizarGlobo(n) {
  try { n ??= await pendientes.contarPendientes(); } catch { return; }
  nodos.globo.hidden = n === 0;
  nodos.globo.textContent = String(n);
  navigator.setAppBadge?.(n).catch?.(() => {});
  if (n === 0) navigator.clearAppBadge?.();
}

async function pintar() {
  const v = nodos.vista;
  try {
    if (estado.tab === "pendientes") actualizarGlobo(await pendientes.montar(v));
    else if (estado.tab === "agenda") await agenda.montar(v);
    else if (estado.tab === "nuevo") await manual.montar(v);
    else await pintarConfig();
  } catch (err) {
    console.error(err);
    reemplazar(v, h("div", { class: "vacio-panel" },
      h("p", {}, "No pudimos cargar los datos. Revisá tu conexión."),
      h("button", { type: "button", class: "btn", onclick: pintar }, "Reintentar")));
  }
}

function ir(tab) {
  estado.tab = tab;
  marcarTab();
  reemplazar(nodos.vista, h("p", { class: "cargando" }, "Cargando…"));
  pintar();
  window.scrollTo({ top: 0 });
}

async function refrescarTodo() {
  try { await cargarContexto(); } catch { /* si falla, la pantalla mostrará el error */ }
  pintar();
  if (estado.tab !== "pendientes") actualizarGlobo();
}

// ---------- Configuración ----------
async function pintarConfig() {
  const cuerpo = h("div", { class: "config__cuerpo" });
  const [, , modulo] = SUBS.find(([id]) => id === estado.sub);
  reemplazar(nodos.vista, 
    h("h2", { class: "vista__titulo" }, "Configuración"),
    h("div", { class: "segmentos segmentos--scroll", role: "tablist" },
      SUBS.map(([id, texto]) => h("button", { type: "button", role: "tab", class: estado.sub === id ? "activo" : "",
        "aria-selected": String(estado.sub === id), onclick: () => { estado.sub = id; pintarConfig(); } }, texto))),
    cuerpo,
    h("div", { class: "bloque" },
      h("h3", {}, "Esta app"),
      promptInstalar ? h("button", { type: "button", class: "btn btn--borde", onclick: async () => { promptInstalar.prompt(); promptInstalar = null; pintarConfig(); } }, "Instalar en el celular") : null,
      h("p", { class: "ayuda" }, "Para instalarla: en Chrome, menú ⋮ → «Instalar app» o «Agregar a pantalla principal». En iPhone (Safari): Compartir → «Agregar a inicio»."),
      h("button", { type: "button", class: "btn btn--peligro-borde", onclick: salir }, "Cerrar sesión")));
  await modulo.montar(cuerpo);
}

// ---------- Arranque ----------
async function entrar() {
  reemplazar(app, h("p", { class: "cargando" }, "Cargando…"));
  try {
    await cargarContexto();
  } catch (err) {
    console.error(err);
    reemplazar(app, h("div", { class: "vacio-panel" },
      h("p", {}, "No pudimos cargar la configuración. Revisá tu conexión."),
      h("button", { type: "button", class: "btn", onclick: entrar }, "Reintentar"),
      h("button", { type: "button", class: "btn btn--borde", onclick: salir }, "Cerrar sesión")));
    return;
  }
  armarEstructura();
  ir("pendientes");

  // Link que recibe Daniel por WhatsApp: /panel/?turno=ID
  const id = new URLSearchParams(location.search).get("turno");
  if (id) { history.replaceState(null, "", location.pathname); abrirPorId(id); }

  if (!estado.escuchando) {
    // Desde la agenda: "+ Agendar" abre el formulario con el día que se estaba mirando
    document.addEventListener("panel:agendar", (ev) => { manual.preseleccionarDia(ev.detail.fecha); ir("nuevo"); });   // los listeners se registran una sola vez, aunque se vuelva a iniciar sesión
    estado.escuchando = true;
    document.addEventListener("panel:refrescar", () => { pintar(); if (estado.tab !== "pendientes") actualizarGlobo(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.getElementById("hoja")) pintar(); });
  }
  clearInterval(estado.timer);
  estado.timer = setInterval(() => {
    if (document.hidden || document.getElementById("hoja")) return;
    if (estado.tab === "pendientes") pintar(); else actualizarGlobo();
  }, 60000);
}

async function iniciar() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  supabase.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") mostrarLogin(); });
  const { data: { session } } = await supabase.auth.getSession();
  if (session) entrar(); else mostrarLogin();
}

iniciar();
