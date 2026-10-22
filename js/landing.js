// Lógica de la landing: lee config y motivos de Supabase y arma servicios, ubicación y
// enlaces de WhatsApp. Si Supabase no responde, usa los valores de respaldo para que
// la página nunca se vea vacía.
import { supabase } from "./supabase.js";

// ---------- Valores de respaldo (los mismos del seed.sql) ----------
const RESPALDO_CONFIG = {
  whatsapp: "5492210000000", // se reemplaza con el real que carga la base
  direccion: "Consultorios Delta, Cantilo e/ 13 A y 13 B #146, City Bell",
  maps_url: "https://www.google.com/maps/search/?api=1&query=Consultorios+Delta+Cantilo+146+City+Bell",
  horas_min_cancelacion: 12,
};
const RESPALDO_MOTIVOS = [
  { id: null, nombre: "Control visual", descripcion: "Evaluación completa de tu salud visual y actualización de tu graduación.", duracion_min: 30 },
  { id: null, nombre: "Adaptación de lentes de contacto", descripcion: "Evaluación, elección y entrenamiento en el uso de lentes de contacto.", duracion_min: 45 },
  { id: null, nombre: "Control visual infantil", descripcion: "Control de la visión de los más chicos, de forma amable y sin apuro.", duracion_min: 30 },
];

async function cargarDatos() {
  try {
    const [cfg, mot] = await Promise.all([
      supabase.from("config").select("*").eq("id", 1).single(),
      supabase.from("motivos").select("*").eq("activo", true).order("orden"),
    ]);
    if (cfg.error || mot.error) throw cfg.error || mot.error;
    return { config: { ...RESPALDO_CONFIG, ...cfg.data }, motivos: mot.data.length ? mot.data : RESPALDO_MOTIVOS };
  } catch (e) {
    console.warn("No se pudo leer Supabase, se usan los datos de respaldo.", e);
    return { config: RESPALDO_CONFIG, motivos: RESPALDO_MOTIVOS };
  }
}

// ---------- Servicios ----------
function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

function pintarServicios(motivos) {
  const lista = document.getElementById("servicios-lista");
  lista.replaceChildren(...motivos.map((m) => {
    const t = crear("article", "tarjeta reveal");
    t.append(crear("h3", "", m.nombre), crear("p", "", m.descripcion || ""),
             crear("div", "tarjeta__duracion", `Duración: ${m.duracion_min} min`));
    const b = crear("a", "btn btn--borde", "Reservar");
    b.href = "#turnero";
    b.addEventListener("click", () => {
      // El turnero (fase 3) escucha este evento para preseleccionar el motivo
      window.motivoPreseleccionado = m.id;
      document.dispatchEvent(new CustomEvent("reservar", { detail: { motivoId: m.id } }));
    });
    t.append(b);
    return t;
  }));
  observarReveal(lista);
}

// ---------- Ubicación, WhatsApp y textos que dependen de la config ----------
function pintarConfig(c) {
  document.getElementById("direccion").textContent = c.direccion;
  if (c.maps_url) document.getElementById("como-llegar").href = c.maps_url;
  document.querySelectorAll("[data-wsp]").forEach((a) => {
    a.href = `https://wa.me/${c.whatsapp}?text=${encodeURIComponent("Hola Daniel, quería hacerte una consulta.")}`;
    if (a.classList.contains("btn")) a.target = "_blank";
  });
  document.querySelectorAll("[data-horas-cancelacion]").forEach((s) => (s.textContent = c.horas_min_cancelacion));
}

// ---------- Animaciones de aparición ----------
let observador;
function observarReveal(raiz = document) {
  const items = raiz.querySelectorAll(".reveal:not(.visible)");
  if (!("IntersectionObserver" in window)) return items.forEach((e) => e.classList.add("visible"));
  observador ??= new IntersectionObserver((entradas) => {
    entradas.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("visible"); observador.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  items.forEach((e) => observador.observe(e));
}

// Con los respaldos la página ya se ve completa; luego se actualiza con lo que diga la base
pintarServicios(RESPALDO_MOTIVOS);
pintarConfig(RESPALDO_CONFIG);
observarReveal();
cargarDatos().then(({ config, motivos }) => { pintarServicios(motivos); pintarConfig(config); });
