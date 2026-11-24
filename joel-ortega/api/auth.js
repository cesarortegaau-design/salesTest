// /api/auth?accion=registro|entrar|salir|yo
import {
  json, error, normalizaCorreo, correoValido, hashContrasena, verificaContrasena,
  cookieSesion, cookieSalida, sesion, leeJSON, guardaJSON, rutaUsuario, cuerpoJSON, claveAdminValida, cookieAdmin, listaTodo, llave,
} from './_lib/core.js';

export async function GET(request) {
  const s = sesion(request);
  if (!s) return json({ usuario: null });
  if (s.soloAdmin) return json({ usuario: null, admin: true });
  const u = await leeJSON(rutaUsuario(s.correo));
  if (!u) return salida({ usuario: null });
  return json({ usuario: { correo: u.correo, nombre: u.nombre || '', admin: s.admin } });
}

export async function POST(request) {
  const accion = new URL(request.url).searchParams.get('accion');
  if (accion === 'salir') return salida({ ok: true });
  // Salir solo del panel de Joel, sin cerrar la sesión de lector.
  if (accion === 'salir-admin') return json({ ok: true }, 200, { 'set-cookie': cookieSalida()[1] });

  // Perfil: cambiar nombre y/o contraseña de la cuenta con sesión iniciada.
  if (accion === 'perfil') {
    const s = sesion(request);
    if (!s || s.soloAdmin) return error('Inicia sesión.', 401);
    const ruta = rutaUsuario(s.correo);
    const u = await leeJSON(ruta);
    if (!u) return error('Tu cuenta no existe.', 404);
    const b = await cuerpoJSON(request);
    const cambios = {};
    if (typeof b.nombre === 'string') cambios.nombre = b.nombre.trim().slice(0, 120);
    if (b.nueva) {
      if (!verificaContrasena(String(b.actual || ''), u.sal, u.hash)) return error('Tu contraseña actual no es correcta.', 401);
      if (String(b.nueva).length < 8 || String(b.nueva).length > 200) return error('La nueva contraseña debe tener al menos 8 caracteres.');
      Object.assign(cambios, hashContrasena(String(b.nueva)));
    }
    await guardaJSON(ruta, { ...u, ...cambios, actualizado: new Date().toISOString() });
    // El nombre nuevo también se usa en sus solicitudes (y por lo tanto en sus dedicatorias).
    if (cambios.nombre !== undefined && cambios.nombre !== u.nombre) {
      for (const bl of await listaTodo(`solicitudes/${llave(s.correo)}/`)) {
        const sol = await leeJSON(bl.pathname);
        if (sol) await guardaJSON(bl.pathname, { ...sol, nombre: cambios.nombre });
      }
    }
    return json({ usuario: { correo: u.correo, nombre: cambios.nombre ?? u.nombre ?? '', admin: s.admin }, contrasena: !!b.nueva });
  }

  // Acceso al panel solo con la clave de administración (ADMIN_KEY).
  if (accion === 'clave') {
    const b = await cuerpoJSON(request);
    if (!claveAdminValida(b.clave)) {
      await new Promise((r) => setTimeout(r, 1000));
      return error(process.env.ADMIN_KEY ? 'Clave incorrecta.' : 'Falta configurar ADMIN_KEY en Vercel.', 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': cookieAdmin() });
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
