// Estado compartido del panel: configuración, motivos, horarios y bloqueos ya cargados.
import { supabase } from "../supabase.js";

export const ctx = { cfg: null, motivos: [], horarios: [], bloqueos: [] };

// Etiqueta y clase de color de cada estado de turno
export const ESTADOS = {
  pendiente: { txt: "Pendiente", clase: "e-pendiente" },
  confirmado: { txt: "Confirmado", clase: "e-confirmado" },
  rechazado: { txt: "Rechazado", clase: "e-cancelado" },
  cancelado_paciente: { txt: "Cancelado por el paciente", clase: "e-cancelado" },
  cancelado_profesional: { txt: "Cancelado por vos", clase: "e-cancelado" },
  asistio: { txt: "Asistió", clase: "e-asistio" },
  ausente: { txt: "No vino", clase: "e-ausente" },
};

export async function cargarContexto() {
  const [cfg, mot, hor, blo] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).single(),
    supabase.from("motivos").select("*").order("orden"),
    supabase.from("horarios").select("*").order("dia_semana").order("hora_inicio"),
    supabase.from("bloqueos").select("*").order("desde"),
  ]);
  const fallo = cfg.error || mot.error || hor.error || blo.error;
  if (fallo) throw fallo;
  ctx.cfg = cfg.data;
  ctx.motivos = mot.data;
  ctx.horarios = hor.data;
  ctx.bloqueos = blo.data;
}

/** Cada pantalla escucha este evento para volver a pedir sus datos. */
export const refrescar = () => document.dispatchEvent(new Event("panel:refrescar"));
