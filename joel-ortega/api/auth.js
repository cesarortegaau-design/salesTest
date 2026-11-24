// /api/auth?accion=registro|entrar|salir|yo
import {
  json, error, normalizaCorreo, correoValido, hashContrasena, verificaContrasena,
  cookieSesion, cookieSalida, sesion, leeJSON, guardaJSON, rutaUsuario, cuerpoJSON, claveAdminValida, cookieAdmin,
} from './_lib/core.js';

export async function GET(request) {
  const s = sesion(request);
  if (!s) return json({ usuario: null });
  const u = await leeJSON(rutaUsuario(s.correo));
  if (!u) return salida({ usuario: null });
  return json({ usuario: { correo: u.correo, nombre: u.nombre || '', admin: s.admin, adminPendiente: s.adminPendiente } });
}

export async function POST(request) {
  const accion = new URL(request.url).searchParams.get('accion');
  if (accion === 'salir') return salida({ ok: true });

  // Clave de administración: solo para un correo de administración con sesión iniciada.
  if (accion === 'clave') {
    const s = sesion(request);
    if (!s || !(s.admin || s.adminPendiente)) return error('Sin permiso.', 403);
    const b = await cuerpoJSON(request);
    if (!claveAdminValida(b.clave)) {
      await new Promise((r) => setTimeout(r, 800));
      return error('Clave de administración incorrecta.', 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': cookieAdmin(s.correo) });
  }

  const b = await cuerpoJSON(request);
  const correo = normalizaCorreo(b.correo);
  const pass = String(b.contrasena || '');
  if (!correoValido(correo)) return error('Escribe un correo electrónico válido.');
  if (pass.length < 8 || pass.length > 200) return error('La contraseña debe tener al menos 8 caracteres.');

  const ruta = rutaUsuario(correo);
  const existente = await leeJSON(ruta);

  if (accion === 'registro') {
    if (existente) return error('Ya existe una cuenta con ese correo. Entra con tu contraseña.', 409);
    const nombre = String(b.nombre || '').trim().slice(0, 120);
    const { sal, hash } = hashContrasena(pass);
    const usuario = { correo, nombre, sal, hash, creado: new Date().toISOString() };
    await guardaJSON(ruta, usuario);
    return json({ usuario: { correo, nombre, admin: false } }, 201, { 'set-cookie': cookieSesion(correo) });
  }

  if (accion === 'entrar') {
    if (!existente || !verificaContrasena(pass, existente.sal, existente.hash))
      return error('Correo o contraseña incorrectos.', 401);
    return json(
      { usuario: { correo, nombre: existente.nombre || '', admin: false } },
      200,
      { 'set-cookie': cookieSesion(correo) },
    );
  }

  return error('Acción no válida.');
}

function salida(data) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const c of cookieSalida()) h.append('set-cookie', c);
  return new Response(JSON.stringify(data), { status: 200, headers: h });
}
