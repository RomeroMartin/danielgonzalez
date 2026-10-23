// Supabase simulado: sirve para sacar las capturas del manual con datos de ejemplo (sin tocar la base real).
// Emula lo justo de PostgREST (filtros, order, embed de motivos, insert/update/delete) y Auth por contraseña.
const crypto = require('crypto');   // (el generador de datos de ejemplo está en capturas.cjs)
const HOST = 'https://clrylwrxqldqjxrvipdb.supabase.co';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };

function filtros(url) {
  const out = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    const m = v.match(/^(eq|neq|gte|gt|lte|lt|in|is)\.(.*)$/); if (m) out.push([k, m[1], m[2]]);
  }
  return out;
}
const aplica = (row, [col, op, val]) => {
  const a = row[col]; const A = String(a), V = val;
  if (op === 'eq') return A === V; if (op === 'neq') return A !== V;
  if (op === 'gte') return A >= V; if (op === 'gt') return A > V; if (op === 'lte') return A <= V; if (op === 'lt') return A < V;
  if (op === 'in') return V.replace(/[()]/g, '').split(',').includes(A);
  if (op === 'is') return (V === 'null') === (a == null);
};

function manejar(db, tabla, req, url) {
  const m = req.method();
  const fil = filtros(url);
  const quiereUno = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  const devolver = (filas) => quiereUno
    ? (filas.length === 1 ? [200, filas[0]] : [406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }])
    : [200, filas];
  const embed = (filas) => url.searchParams.get('select')?.includes('motivos(')
    ? filas.map((r) => ({ ...r, motivos: (({ nombre, duracion_min }) => ({ nombre, duracion_min }))(db.motivos.find((x) => x.id === r.motivo_id)) })) : filas;
  const filas = db[tabla];

  if (m === 'GET') {
    let r = filas.filter((x) => fil.every((f) => aplica(x, f)));
    const ord = url.searchParams.get('order');
    if (ord) for (const o of ord.split(',').reverse()) { const [c, d] = o.split('.'); r = [...r].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
    return devolver(embed(r));
  }
  if (m === 'POST') {
    let body = JSON.parse(req.postData()); const lista = Array.isArray(body) ? body : [body]; const nuevos = [];
    for (const b of lista) {
      const fila = { ...b };
      if (tabla === 'turnos') {
        Object.assign(fila, { id: crypto.randomUUID(), token: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        if (['pendiente', 'confirmado'].includes(fila.estado ?? 'pendiente') &&
          filas.some((t) => ['pendiente', 'confirmado'].includes(t.estado) && fila.inicio < t.fin && fila.fin > t.inicio))
          return [409, { code: '23P01', message: 'conflicting key value violates exclusion constraint' }];
      } else if (tabla !== 'config') fila.id = Math.max(0, ...filas.map((x) => x.id)) + 1;
      filas.push(fila); nuevos.push(fila);
    }
    return quiereUno ? [201, embed(nuevos)[0]] : [201, embed(nuevos)];
  }
  if (m === 'PATCH') {
    const r = filas.filter((x) => fil.every((f) => aplica(x, f)));
    const cambios = JSON.parse(req.postData());
    r.forEach((x) => Object.assign(x, cambios, tabla === 'turnos' ? { updated_at: new Date().toISOString() } : {}));
    return devolver(embed(r));
  }
  if (m === 'DELETE') {
    const r = filas.filter((x) => fil.every((f) => aplica(x, f)));
    if (tabla === 'motivos' && r.some((x) => db.turnos.some((t) => t.motivo_id === x.id)))
      return [409, { code: '23503', message: 'violates foreign key constraint' }];
    db[tabla] = filas.filter((x) => !r.includes(x));
    return [204, null];
  }
  return [405, {}];
}

async function instalar(ctx, db, { email = 'daniel@test.com', password = 'secreto123' } = {}) {
  const jwt = () => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: 'u1', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`; };
  const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  await ctx.route(HOST + '/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: body == null ? '' : JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') {
      const b = JSON.parse(req.postData() || '{}');
      if (b.email === email && b.password === password) { db.sesion = true; return json(200, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user }); }
      return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/logout') { db.sesion = false; return json(204, null); }
    if (url.pathname === '/auth/v1/user') return json(200, user);
    if (url.pathname === '/rest/v1/rpc/get_disponibilidad') {
      return json(200, db.turnos.filter((t) => ['pendiente', 'confirmado'].includes(t.estado)).map((t) => ({ inicio: t.inicio, fin: t.fin })));
    }
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (m && db[m[1]]) {
      const [status, body] = manejar(db, m[1], req, url);
      return json(status, body);
    }
    return json(404, { message: 'no simulado: ' + url.pathname });
  });
}
module.exports = { instalar };
