// /api/auth?accion=registro|entrar|salir|yo
import {
  json, error, normalizaCorreo, correoValido, hashContrasena, verificaContrasena,
  cookieSesion, cookieSalida, sesion, leeJSON, guardaJSON, rutaUsuario, cuerpoJSON, esAdmin,
} from './_lib/core.js';

export async function GET(request) {
  const s = sesion(request);
  if (!s) return json({ usuario: null });
  const u = await leeJSON(rutaUsuario(s.correo));
  if (!u) return json({ usuario: null }, 200, { 'set-cookie': cookieSalida() });
  return json({ usuario: { correo: u.correo, nombre: u.nombre || '', admin: s.admin } });
}

export async function POST(request) {
  const accion = new URL(request.url).searchParams.get('accion');
  if (accion === 'salir') return json({ ok: true }, 200, { 'set-cookie': cookieSalida() });

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
    return json({ usuario: { correo, nombre, admin: esAdmin(correo) } }, 201, { 'set-cookie': cookieSesion(correo) });
  }

  if (accion === 'entrar') {
    if (!existente || !verificaContrasena(pass, existente.sal, existente.hash))
      return error('Correo o contraseña incorrectos.', 401);
    return json(
      { usuario: { correo, nombre: existente.nombre || '', admin: esAdmin(correo) } },
      200,
      { 'set-cookie': cookieSesion(correo) },
    );
  }

  return error('Acción no válida.');
}
