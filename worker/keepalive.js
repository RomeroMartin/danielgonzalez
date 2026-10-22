// Cloudflare Worker "keepalive": una vez por día hace una consulta liviana a Supabase.
// El plan gratis de Supabase pausa los proyectos sin actividad durante una semana;
// este ping diario evita que el turnero de Daniel se caiga.
//
// No necesita configuración: usa la URL y la clave PÚBLICA (anon) del proyecto, que ya están
// en el frontend. Si algún día cambian, se pueden pisar con las variables SUPABASE_URL y
// SUPABASE_ANON_KEY del Worker.

const SUPABASE_URL = "https://clrylwrxqldqjxrvipdb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kf0ntcnppwZb5H50y134ug_WwFA9bz3";

async function ping(env) {
  const url = `${env.SUPABASE_URL ?? SUPABASE_URL}/rest/v1/config?select=id&limit=1`;
  const clave = env.SUPABASE_ANON_KEY ?? SUPABASE_ANON_KEY;
  const r = await fetch(url, { headers: { apikey: clave } });
  console.log(`keepalive: Supabase respondió ${r.status}`);
  if (!r.ok) throw new Error(`Supabase respondió ${r.status}`);
  return r.status;
}

export default {
  // Se ejecuta solo, con el cron diario
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(ping(env));
  },
  // Abrir la URL del Worker en el navegador sirve para probarlo a mano
  async fetch(_request, env) {
    try {
      return new Response(`OK: Supabase respondió ${await ping(env)}\n`);
    } catch (err) {
      return new Response(`ERROR: ${err.message}\n`, { status: 502 });
    }
  },
};
