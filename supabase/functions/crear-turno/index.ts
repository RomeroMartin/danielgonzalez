// Edge Function: crear-turno
// Valida el token de Cloudflare Turnstile, normaliza el teléfono y llama a la
// función SQL crear_turno (que valida horarios, bloqueos y superposición).
//
// Secretos necesarios (supabase secrets set ...):
//   TURNSTILE_SECRET_KEY   clave secreta de Turnstile
//   ALLOWED_ORIGIN         (opcional) origen permitido para CORS, ej. https://danielgonzalez-8cc.pages.dev
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ORIGEN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": ORIGEN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Lleva cualquier teléfono argentino al formato de wa.me: 549 + característica + número (13 dígitos).
// Acepta: "221 555-1234", "0221 15 555 1234", "+54 9 221 555 1234", "11 15 5555 1234", etc.
// Devuelve null si no se puede interpretar.
export function normalizarTelefono(entrada: string): string | null {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  // Quita el "15" de celular que va después de la característica (11 → 2 dígitos; resto 3 o 4)
  if (d.length === 12) {
    const largos = d.startsWith("11") ? [2] : [3, 4];
    for (const a of largos) {
      if (d.slice(a, a + 2) === "15") {
        d = d.slice(0, a) + d.slice(a + 2);
        break;
      }
    }
  }
  return /^\d{10}$/.test(d) ? "549" + d : null;
}

async function validarTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secreto = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secreto) return false;
  const form = new FormData();
  form.append("secret", secreto);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const j = await r.json();
  return j.success === true;
}

// Mensajes de error que puede mostrar el frontend
const STATUS_POR_ERROR: Record<string, number> = {
  horario_ocupado: 409,
  pendiente_existente: 409,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return responder({ ok: false, error: "metodo_no_permitido" }, 405);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return responder({ ok: false, error: "datos_invalidos" }, 400);
  }

  const motivoId = Number(b.motivo_id);
  const inicio = new Date(String(b.inicio ?? ""));
  const nombre = String(b.nombre ?? "").trim();
  const telefono = normalizarTelefono(String(b.telefono ?? ""));
  const token = String(b.turnstile_token ?? "");

  if (!Number.isInteger(motivoId) || isNaN(inicio.getTime()) || nombre.length < 2 || nombre.length > 100) {
    return responder({ ok: false, error: "datos_invalidos" }, 400);
  }
  if (!telefono) return responder({ ok: false, error: "telefono_invalido" }, 400);
  if (!token) return responder({ ok: false, error: "captcha_invalido" }, 400);

  const ip = req.headers.get("cf-connecting-ip");
  if (!(await validarTurnstile(token, ip))) {
    return responder({ ok: false, error: "captcha_invalido" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.rpc("crear_turno", {
    p_motivo_id: motivoId,
    p_inicio: inicio.toISOString(),
    p_nombre: nombre,
    p_telefono: telefono,
    p_obra_social: b.obra_social ? String(b.obra_social).slice(0, 100) : null,
    p_comentario: b.comentario ? String(b.comentario).slice(0, 500) : null,
  });

  if (error) return responder({ ok: false, error: "error_interno" }, 500);
  if (!data.ok) return responder(data, STATUS_POR_ERROR[data.error] ?? 400);
  return responder(data, 201);
});
