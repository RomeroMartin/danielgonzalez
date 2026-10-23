// Saca las capturas del manual con datos de ejemplo (pacientes ficticios).
// Uso:  node docs/manual/capturas.cjs     (necesita `playwright` y un servidor local en el puerto 8099:
//       python3 -m http.server 8099  desde la raíz del repo)
const path = require('path');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const { instalar } = require('./backend-simulado.cjs');
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();

const SALIDA = path.join(__dirname, 'img');
const BASE = 'http://localhost:8099';

(async () => {
  const { fechaArg, sumarDias, instante, diaSemana } = await import(pathToFileURL(path.join(__dirname, '../../js/slots.js')).href);

  // ---------- Datos de ejemplo, siempre relativos a hoy ----------
  const hoy = fechaArg();
  const lunesProx = sumarDias(hoy, ((8 - diaSemana(hoy)) % 7) || 7);              // próximo lunes
  const lunesActual = sumarDias(lunesProx, -7);
  const dia = (lunes, n) => sumarDias(lunes, n);                                    // 0 = lunes ... 5 = sábado
  const DUR = { 1: 30, 2: 45, 3: 30 };
  const ahoraISO = new Date().toISOString();
  const hace2d = new Date(Date.now() - 2 * 86400000).toISOString();
  const T = (id, motivo, fecha, hhmm, nombre, tel, estado, extra = {}) => {
    const inicio = instante(fecha, hhmm);
    return { id, motivo_id: motivo, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + DUR[motivo] * 60000).toISOString(),
      nombre, telefono: tel, obra_social: null, comentario: null, estado, token: crypto.randomUUID(), origen: 'web',
      created_at: ahoraISO, updated_at: ahoraISO, ...extra };
  };
  const db = {
    config: [{ id: 1, whatsapp: '5492215550000', direccion: 'Consultorios Delta, Cantilo e/ 13 A y 13 B #146, City Bell',
      maps_url: null, anticipacion_max_dias: 30, horas_min_cancelacion: 12, intervalo_min: 15,
      msg_solicitud: 'Hola Daniel, solicité un turno: {motivo}, {dia} {hora}. {nombre}, {obra_social}. Confirmalo acá: {link_panel}',
      msg_confirmacion: 'Hola {nombre}, tu turno del {dia} a las {hora} en Consultorios Delta (Cantilo e/ 13 A y 13 B #146, City Bell) está confirmado. Si necesitás cancelar: {link_turno}',
      msg_rechazo: 'Hola {nombre}, no puedo atenderte el {dia} a las {hora}. Podés elegir otro horario acá: {link_turnero}',
      msg_cancelacion: 'Hola Daniel, cancelé mi turno del {dia} a las {hora}. {nombre}',
      aviso_datos: 'Tus datos (nombre y teléfono) se usan únicamente para gestionar tu turno y contactarte por WhatsApp. No se comparten con terceros. Podés pedir su modificación o eliminación en cualquier momento (Ley 25.326 de Protección de Datos Personales).' }],
    motivos: [
      { id: 1, nombre: 'Control visual', descripcion: 'Evaluación completa de tu salud visual y actualización de tu graduación.', duracion_min: 30, activo: true, orden: 1 },
      { id: 2, nombre: 'Adaptación de lentes de contacto', descripcion: 'Evaluación, elección y entrenamiento en el uso de lentes de contacto.', duracion_min: 45, activo: true, orden: 2 },
      { id: 3, nombre: 'Control visual infantil', descripcion: 'Control de la visión de los más chicos, de forma amable y sin apuro.', duracion_min: 30, activo: true, orden: 3 }],
    horarios: [1, 2, 3, 4, 5].flatMap((d, i) => [
      { id: i * 2 + 1, dia_semana: d, hora_inicio: '09:00:00', hora_fin: '13:00:00' },
      { id: i * 2 + 2, dia_semana: d, hora_inicio: '15:00:00', hora_fin: '19:00:00' }]).concat([{ id: 20, dia_semana: 6, hora_inicio: '09:00:00', hora_fin: '13:00:00' }]),
    bloqueos: [{ id: 1, desde: instante(sumarDias(lunesProx, 14), '00:00').toISOString(), hasta: instante(sumarDias(lunesProx, 19), '00:00').toISOString(), nota: 'Vacaciones' }],
    turnos: [
      // Semana actual (con distintos estados)
      T('a1', 1, dia(lunesActual, 0), '09:00', 'Ana Torres', '5492215550101', 'asistio'),
      T('a2', 1, dia(lunesActual, 0), '10:00', 'Hugo Paz', '5492215550102', 'asistio'),
      T('a3', 2, dia(lunesActual, 1), '15:00', 'Elena Ríos', '5492215550103', 'ausente'),
      T('a4', 1, dia(lunesActual, 1), '16:00', 'Pablo Vega', '5492215550104', 'asistio'),
      T('a5', 1, dia(lunesActual, 2), '09:30', 'Irene Sosa', '5492215550105', 'cancelado_profesional'),
      T('a6', 3, dia(lunesActual, 3), '11:00', 'Marta Díaz', '5492215550106', 'cancelado_paciente', { updated_at: hace2d }),
      T('a7', 1, dia(lunesActual, 4), '09:00', 'Rosa Medina', '5492215550107', 'asistio'),
      T('a8', 1, dia(lunesActual, 4), '11:00', 'Beatriz López', '5492215550108', 'confirmado'),
      T('a9', 2, dia(lunesActual, 4), '15:00', 'Tomás Ibarra', '5492215550109', 'confirmado'),
      // Próxima semana
      T('p1', 1, dia(lunesProx, 0), '09:30', 'Lucía Fernández', '5492215550110', 'pendiente', { obra_social: 'OSDE', comentario: 'Necesito anteojos nuevos, veo borroso de lejos.' }),
      T('p2', 3, dia(lunesProx, 0), '11:00', 'Mateo Sosa', '5492215550111', 'pendiente', { comentario: 'Tiene 7 años, es su primera consulta.' }),
      T('p3', 2, dia(lunesProx, 1), '15:00', 'Carolina Ruiz', '5492215550112', 'pendiente', { obra_social: 'Swiss Medical' }),
      T('c1', 1, dia(lunesProx, 0), '10:00', 'Martín Acosta', '5492215550113', 'confirmado'),
      T('c2', 2, dia(lunesProx, 0), '12:00', 'Valeria Gómez', '5492215550114', 'confirmado'),
      T('c3', 1, dia(lunesProx, 0), '15:30', 'Sofía Peralta', '5492215550115', 'confirmado'),
      T('c4', 1, dia(lunesProx, 0), '17:00', 'Diego Luna', '5492215550116', 'confirmado', { origen: 'manual' }),
      T('x1', 1, dia(lunesProx, 4), '10:00', 'Jorge Benítez', '5492215550117', 'cancelado_paciente', { updated_at: ahoraISO }),
    ],
  };
  const turnoPaciente = db.turnos.find((t) => t.id === 'c1');

  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--lang=es-ES'], env: { ...process.env, LANG: 'es_ES.UTF-8', LANGUAGE: 'es_ES:es', LC_ALL: 'es_ES.UTF-8' } });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  await instalar(ctx, db, { email: 'daniel@ejemplo.com', password: 'demo1234' });
  const HOST = 'https://clrylwrxqldqjxrvipdb.supabase.co';
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(body) });
  const opciones = (route) => route.request().method() === 'OPTIONS' ? (route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }), true) : false;
  // Alta de turno desde la web y consulta del turno por link privado (simulados)
  await ctx.route(HOST + '/functions/v1/crear-turno', (r) => opciones(r) || json(r, 201, { ok: true, id: 'nuevo', token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }));
  await ctx.route(HOST + '/rest/v1/rpc/get_turno_por_token', (r) => opciones(r) || json(r, 200, [{ motivo: 'Control visual', inicio: turnoPaciente.inicio, fin: turnoPaciente.fin, nombre: 'Martín Acosta', estado: 'confirmado', puede_cancelar: true }]));
  // Verificación anti-spam simulada con aspecto de widget terminado
  await ctx.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.turnstile={render:(el,o)=>{el.innerHTML='<div style="display:flex;align-items:center;gap:12px;border:1px solid #d0d5db;border-radius:6px;background:#fafafa;padding:14px 16px;max-width:300px;font:500 14px Montserrat,sans-serif;color:#222"><span style="width:24px;height:24px;border-radius:50%;background:#1f9d55;color:#fff;display:grid;place-items:center;font-size:15px">✓</span>Verificación completada<span style="margin-left:auto;font-size:9px;color:#888;letter-spacing:.04em">CLOUDFLARE</span></div>';o.callback('token-demo');return 1}};` }));

  const p = await ctx.newPage();
  const esperar = (ms = 700) => p.waitForTimeout(ms);
  const aparecer = () => p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('visible')));
  const irA = (sel, margen = 72) => p.evaluate(([s, m]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - m); }, [sel, margen]);

  // Números rojos de referencia sobre la captura
  async function marcar(marcas) {
    await p.evaluate((ms) => {
      for (const { sel, n, nth = 0, pos = 'tl', dx = 0, dy = 0 } of ms) {
        const el = document.querySelectorAll(sel)[nth];
        if (!el) throw new Error('No existe ' + sel + ' [' + nth + ']');
        const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.className = '__marca'; d.textContent = n;
        const x = { tl: r.left - 8, tr: r.right - 14, tc: r.left + r.width / 2 - 13, ml: r.left - 10, mr: r.right - 14 }[pos];
        const y = { tl: r.top - 17, tr: r.top - 17, tc: r.top - 17, ml: r.top + r.height / 2 - 13, mr: r.top + r.height / 2 - 13 }[pos];
        Object.assign(d.style, { position: 'fixed', zIndex: 2147483647, left: Math.max(3, Math.min(x + dx, innerWidth - 29)) + 'px', top: Math.max(3, y + dy) + 'px',
          width: '26px', height: '26px', borderRadius: '50%', background: '#e8453c', color: '#fff', font: '700 14px Montserrat, sans-serif',
          display: 'grid', placeItems: 'center', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.4)', pointerEvents: 'none' });
        (el.closest('dialog') || document.body).append(d);
      }
    }, marcas);
  }
  async function captura(nombre, marcas = [], alto = 844) {
    if (alto !== 844) await p.setViewportSize({ width: 390, height: alto });
    await esperar(300);
    await marcar(marcas);
    await p.screenshot({ path: path.join(SALIDA, nombre + '.png') });
    await p.evaluate(() => document.querySelectorAll('.__marca').forEach((e) => e.remove()));
    if (alto !== 844) await p.setViewportSize({ width: 390, height: 844 });
    console.log('captura:', nombre);
  }

  // Elige en el calendario el próximo lunes (si cae en otro mes, avanza el mes)
  const elegirLunes = async () => {
    if (lunesProx.slice(0, 7) !== hoy.slice(0, 7)) await p.getByLabel('Mes siguiente').click();
    await p.locator(`.dia--libre[aria-label^="${Number(lunesProx.slice(8))} de"]`).click();
  };

  // =============== WEB DEL PACIENTE ===============
  await p.goto(BASE + '/index.html'); await p.waitForSelector('.opcion'); await aparecer(); await esperar(1200);
  await captura('web-1-inicio', [{ sel: '.encabezado .btn', n: 1, pos: 'tl' }, { sel: '.hero .btn', n: 2, pos: 'tl' }, { sel: '.wsp-flotante', n: 3, pos: 'tl' }]);
  await irA('#servicios', 60); await esperar(900);
  await captura('web-2-servicios', [{ sel: '#servicios-lista .tarjeta h3', n: 1, nth: 0 }, { sel: '#servicios-lista .tarjeta__duracion', n: 2, nth: 0 }, { sel: '#servicios-lista .tarjeta .btn', n: 3, nth: 0 }]);
  await p.addStyleTag({ content: '.wsp-flotante { display: none !important }' });
  await irA('#turnero .cabecera-seccion', 70); await esperar(900);
  await captura('web-3-motivo', [{ sel: '.progreso', n: 1, pos: 'tl' }, { sel: '.opcion', n: 2, nth: 0 }]);
  await p.locator('.opcion').first().click(); await p.waitForSelector('.cal'); await irA('#turnero .cabecera-seccion', 70); await esperar(700);
  await captura('web-4-dia', [{ sel: '.cal__cabecera', n: 1, pos: 'tc', dy: -8 }, { sel: '.dia--libre', n: 2, nth: 0 }, { sel: '.cal__ayuda', n: 3, pos: 'tl' }]);
  await elegirLunes(); await p.waitForSelector('.hora'); await irA('#turnero .cabecera-seccion', 70); await esperar(700);
  await captura('web-5-horario', [{ sel: '.hora', n: 1, nth: 3 }, { sel: '.turnero__pie .btn', n: 2, pos: 'tl' }]);
  await p.locator('.hora').nth(3).click(); await p.waitForSelector('#f-nombre');
  await p.fill('#f-nombre', 'Lucía Fernández'); await p.fill('#f-telefono', '221 555-0110'); await p.fill('#f-obra_social', 'OSDE');
  await p.fill('#f-comentario', 'Necesito anteojos nuevos.'); await p.check('#f-acepta'); await p.waitForFunction(() => document.getElementById('caja-turnstile').textContent.length > 2);
  await irA('#turnero .cabecera-seccion', 50); await esperar(500);
  await captura('web-6-datos', [{ sel: '.resumen', n: 1, pos: 'tl' }, { sel: '#f-nombre', n: 2, pos: 'tl' }, { sel: '#f-telefono', n: 3, pos: 'tl' }, { sel: '.check', n: 4, pos: 'tl' }, { sel: '#caja-turnstile', n: 5, pos: 'tl', dy: -4 }, { sel: 'button[type=submit]', n: 6, pos: 'tl' }], 1250);
  await p.locator('button[type=submit]').click(); await p.waitForSelector('.exito'); await irA('#turnero .cabecera-seccion', 50); await esperar(700);
  await captura('web-7-exito', [{ sel: '.exito__icono', n: 1, pos: 'tr' }, { sel: '.acciones .btn--wsp', n: 2, pos: 'tl' }, { sel: '.acciones .btn:nth-child(2)', n: 3, pos: 'tl' }, { sel: '.acciones .btn:nth-child(3)', n: 4, pos: 'tl' }]);
  await p.goto(BASE + '/turno.html?t=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'); await p.waitForSelector('.estado'); await esperar(800);
  await captura('web-8-mi-turno', [{ sel: '.estado', n: 1, pos: 'tl' }, { sel: '.datos-turno', n: 2, pos: 'tl' }, { sel: '.acciones .btn', n: 3, nth: 0, pos: 'tl' }]);

  // =============== PANEL ===============
  await p.goto(BASE + '/panel/'); await p.waitForSelector('#l-email'); await esperar(600);
  await p.fill('#l-email', 'daniel@ejemplo.com'); await p.fill('#l-pass', 'demo1234');
  await captura('panel-1-login', [{ sel: '#l-email', n: 1, pos: 'tl' }, { sel: '#l-pass', n: 2, pos: 'tl' }, { sel: 'button[type=submit]', n: 3, pos: 'tl' }]);
  await p.click('button[type=submit]');
  await p.waitForSelector('.tarjeta-turno', { timeout: 15000 }); await esperar(700);
  await captura('panel-2-pendientes', [{ sel: '.contador', n: 1, pos: 'tr' }, { sel: '.tarjeta-turno__cab', n: 2, nth: 0, pos: 'tl' }, { sel: '.tarjeta-turno .btn', n: 3, nth: 0, pos: 'tl' }, { sel: '.tarjeta-turno .btn--borde', n: 4, nth: 0, pos: 'tl' }, { sel: '.barra__btn', n: 5, nth: 0, pos: 'tr', dx: 6 }]);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await esperar(500);
  await captura('panel-3-cancelado', [{ sel: '.vista__subtitulo', n: 1, pos: 'tl' }, { sel: '.tarjeta-turno--cancelado', n: 2, pos: 'tr', dy: 10 }]);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('.tarjeta-turno__cab').first().click(); await p.waitForSelector('dialog[open]'); await esperar(500);
  await captura('panel-4-detalle-pendiente', [{ sel: 'dialog .chip', n: 1, pos: 'tl' }, { sel: 'dialog .datos-turno', n: 2, pos: 'tl' }, { sel: 'dialog .btn:nth-child(1)', n: 3, pos: 'tl' }, { sel: 'dialog .btn:nth-child(2)', n: 4, pos: 'tl' }, { sel: 'dialog .btn--wsp', n: 5, pos: 'tl' }]);
  await p.getByLabel('Cerrar').click(); await esperar(300);

  await p.locator('[data-tab=agenda]').click(); await p.waitForSelector('.agenda-nav'); await esperar(500);
  await p.getByText('Semana', { exact: true }).click(); await p.waitForSelector('.agenda-dia__titulo'); await esperar(500);
  await captura('panel-5-agenda-semana', [{ sel: '.segmentos', n: 1, pos: 'tl' }, { sel: '.agenda-nav__titulo', n: 2, pos: 'tc', dy: -6 }, { sel: '.agenda-dia__titulo', n: 3, nth: 0, pos: 'tl' }, { sel: '.turno-item .chip', n: 4, nth: 0, pos: 'tl' }]);
  await p.getByText('Día', { exact: true }).click(); await p.waitForSelector('.agenda-nav'); await esperar(300);
  for (let i = 0; i < 10; i++) { const t = await p.locator('.agenda-nav__titulo').innerText(); if (t.toLowerCase().includes(String(Number(lunesProx.slice(8))) + ' de')) break; await p.getByLabel('Siguiente').click(); await esperar(300); }
  await p.waitForSelector('.turno-item'); await esperar(500);
  await captura('panel-6-agenda-dia', [{ sel: '.btn--chico:not(.btn--borde)', n: 1, pos: 'tl' }, { sel: '.agenda-barra .btn--borde', n: 2, pos: 'tl' }, { sel: '.agenda-nav .cal__nav', n: 3, nth: 1, pos: 'tl' }, { sel: '.agenda-dia__horario', n: 4, pos: 'tl' }, { sel: '.turno-item', n: 5, nth: 0, pos: 'tl' }]);
  await p.locator('.turno-item', { hasText: 'Martín Acosta' }).click(); await p.waitForSelector('dialog[open]'); await esperar(500);
  await captura('panel-7-detalle-confirmado', [{ sel: 'dialog .btn--wsp', n: 1, pos: 'tl' }, { sel: 'dialog .btn--borde', n: 2, nth: 0, pos: 'tl' }, { sel: 'dialog .btn--borde', n: 3, nth: 1, pos: 'tl' }, { sel: 'dialog .btn--peligro-borde', n: 4, pos: 'tl' }]);
  await p.getByLabel('Cerrar').click(); await esperar(300);

  await p.getByRole('button', { name: '+ Agendar' }).click(); await p.waitForSelector('#m-fecha'); await p.waitForSelector('.hora'); await esperar(600);
  await p.locator('.horas .hora').nth(2).click();
  await p.fill('#m-nombre', 'Gabriela Núñez'); await p.fill('#m-telefono', '221 555-0188');
  await captura('panel-8-agendar', [{ sel: '#m-motivo', n: 1, pos: 'tl' }, { sel: '#m-fecha', n: 2, pos: 'tl' }, { sel: '.horas', n: 3, pos: 'tl' }, { sel: '#m-nombre', n: 4, pos: 'tl' }, { sel: '#m-telefono', n: 5, pos: 'tl' }, { sel: 'button[type=submit]', n: 6, pos: 'tl' }], 1250);

  await p.locator('[data-tab=config]').click(); await p.waitForSelector('.franja'); await esperar(600);
  await captura('panel-9-horarios', [{ sel: '.segmentos', n: 1, pos: 'tl' }, { sel: '.bloque__cab .btn', n: 2, nth: 0, pos: 'tl' }, { sel: '.franja input', n: 3, nth: 0, pos: 'tl' }, { sel: '.icono-borrar', n: 4, nth: 0, pos: 'tl' }]);
  await p.getByRole('tab', { name: 'Motivos' }).click(); await p.waitForSelector('form.bloque'); await esperar(500);
  await captura('panel-10-motivos', [{ sel: 'form.bloque input[type=text]', n: 1, nth: 0, pos: 'tl' }, { sel: 'form.bloque input[type=number]', n: 2, nth: 0, pos: 'tl' }, { sel: 'form.bloque .check', n: 3, nth: 0, pos: 'tl' }, { sel: 'form.bloque button[type=submit]', n: 4, nth: 0, pos: 'tl' }]);
  await p.getByRole('tab', { name: 'Bloqueos' }).click(); await p.waitForSelector('#b-desde'); await esperar(500);
  await captura('panel-11-bloqueos', [{ sel: '#b-desde', n: 1, pos: 'tl' }, { sel: '.check', n: 2, pos: 'tl' }, { sel: '#b-nota', n: 3, pos: 'tl' }, { sel: 'form button[type=submit]', n: 4, pos: 'tl' }, { sel: '.bloqueo-fila', n: 5, pos: 'tl' }], 1150);
  await p.getByRole('tab', { name: 'Ajustes' }).click(); await p.waitForSelector('#a-whatsapp'); await esperar(500);
  await captura('panel-12-ajustes', [{ sel: '#a-whatsapp', n: 1, pos: 'tl' }, { sel: '#a-anticipacion_max_dias', n: 2, pos: 'tl' }, { sel: '#a-horas_min_cancelacion', n: 3, pos: 'tl' }, { sel: '#a-intervalo_min', n: 4, pos: 'tl' }], 1150);
  await irA('#a-msg_solicitud', 140); await esperar(500);
  await captura('panel-13-mensajes', [{ sel: '#a-msg_solicitud', n: 1, pos: 'tl' }, { sel: '#a-msg_confirmacion', n: 2, pos: 'tl' }, { sel: '#a-msg_rechazo', n: 3, pos: 'tl' }], 1000);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await esperar(500);
  await captura('panel-14-cerrar-sesion', [{ sel: '.btn--peligro-borde', n: 1, pos: 'tl' }]);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
