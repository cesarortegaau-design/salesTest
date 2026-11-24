// Utilidades compartidas: sesión firmada, contraseñas con scrypt y almacén privado en Vercel Blob.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';
import { LIBROS } from './libros.js';

export { LIBROS };

const COOKIE = 'jo_sesion';
const DIAS = 30;

// ---------- Respuestas ----------
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
export const error = (mensaje, status = 400) => json({ error: mensaje }, status);

// ---------- Correo ----------
export const normalizaCorreo = (e) => String(e || '').trim().toLowerCase();
export const correoValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;
export const llave = (correo) => createHash('sha256').update(normalizaCorreo(correo)).digest('hex').slice(0, 32);

export function esAdmin(correo) {
  const lista = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalizaCorreo)
    .filter(Boolean);
  return lista.includes(normalizaCorreo(correo));
}

// ---------- Contraseñas ----------
export function hashContrasena(pass) {
  const sal = randomBytes(16).toString('hex');
  const hash = scryptSync(pass, sal, 64).toString('hex');
  return { sal, hash };
}
export function verificaContrasena(pass, sal, hash) {
  const calc = scryptSync(pass, sal, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === calc.length && timingSafeEqual(calc, ref);
}

// ---------- Sesión ----------
function firma(texto) {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto) throw new Error('Falta SESSION_SECRET');
  return createHmac('sha256', secreto).update(texto).digest('base64url');
}
export function cookieSesion(correo) {
  const datos = Buffer.from(JSON.stringify({ e: normalizaCorreo(correo), x: Date.now() + DIAS * 864e5 })).toString('base64url');
  const valor = `${datos}.${firma(datos)}`;
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS * 86400}`;
}
export const cookieSalida = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function sesion(request) {
  const cab = request.headers.get('cookie') || '';
  const m = cab.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [datos, f] = m[1].split('.');
  if (!datos || !f) return null;
  const esperada = firma(datos);
  if (esperada.length !== f.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(f))) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (!s.e || s.x < Date.now()) return null;
    return { correo: s.e, admin: esAdmin(s.e) };
  } catch {
    return null;
  }
}

// ---------- Almacén (Blob privado, lectura sin caché) ----------
export async function leeJSON(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export async function guardaJSON(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}
export async function guardaArchivo(pathname, cuerpo, contentType) {
  return put(pathname, cuerpo, { access: 'private', addRandomSuffix: true, contentType });
}
export async function listaTodo(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}
export async function abreArchivo(pathname) {
  const r = await get(pathname, { access: 'private' });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  return r;
}
export { del };

// Rutas
export const rutaUsuario = (correo) => `usuarios/${llave(correo)}.json`;
export const rutaSolicitud = (correo, libro) => `solicitudes/${llave(correo)}/${libro}.json`;
export const RUTA_AJUSTES = 'ajustes/ajustes.json';

export const AJUSTES_BASE = {
  montoSugerido: 350,
  banco: '',
  titular: 'Joel Ortega Juárez',
  clabe: '',
  cuenta: '',
  concepto: 'SEMBLANZAS + tu nombre',
  nota: 'La cooperación es voluntaria: aporta lo que puedas. Si no puedes cooperar, solicita el libro de todas formas y Joel decidirá cómo compartirlo.',
};
export async function ajustes() {
  return { ...AJUSTES_BASE, ...((await leeJSON(RUTA_AJUSTES)) || {}) };
}

// Último archivo subido por Joel para un libro
export async function archivoLibro(libro) {
  const blobs = await listaTodo(`libros/${libro}/`);
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs[0] || null;
}

export async function cuerpoJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
