// Utilidades compartidas: sesión firmada, contraseñas con scrypt y almacén privado en Vercel Blob.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';
import { LIBROS } from './libros.js';

export { LIBROS };

const COOKIE = 'jo_sesion';
const COOKIE_ADMIN = 'jo_admin';
const DIAS = 30;
const HORAS_ADMIN = 12;

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
    .replace(/["'<>]/g, ' ')
    .split(/[\s,;]+/)
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
export const cookieSalida = () => [
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  `${COOKIE_ADMIN}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
];

// Acceso al panel: solo con la clave de administración (variable ADMIN_KEY).
export function claveAdminValida(clave) {
  const ref = process.env.ADMIN_KEY;
  if (!ref || typeof clave !== 'string' || !clave) return false;
  const a = createHash('sha256').update(clave.trim()).digest();
  const b = createHash('sha256').update(ref.trim()).digest();
  return timingSafeEqual(a, b);
}
export function cookieAdmin() {
  const datos = Buffer.from(JSON.stringify({ e: 'admin', a: 1, x: Date.now() + HORAS_ADMIN * 36e5 })).toString('base64url');
  return `${COOKIE_ADMIN}=${datos}.${firma('admin:' + datos)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HORAS_ADMIN * 3600}`;
}

function leeCookie(request, nombre) {
  const cab = request.headers.get('cookie') || '';
  const m = cab.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return m ? m[1] : null;
}
function verifica(valor, prefijo = '') {
  if (!valor) return null;
  const [datos, f] = valor.split('.');
  if (!datos || !f) return null;
  const esperada = firma(prefijo + datos);
  if (esperada.length !== f.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(f))) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return s.e && s.x >= Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function sesion(request) {
  const s = verifica(leeCookie(request, COOKIE));
  const a = process.env.ADMIN_KEY ? verifica(leeCookie(request, COOKIE_ADMIN), 'admin:') : null;
  const admin = !!(a && a.a === 1);
  if (s) return { correo: s.e, admin, soloAdmin: false };
  if (admin) return { correo: 'panel@admin', admin: true, soloAdmin: true };
  return null;
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

// Archivo vigente de un libro: el último que Joel subió al almacén o, si no hay, el PDF incluido en el despliegue.
export async function archivoLibro(libro) {
  const blobs = await listaTodo(`libros/${libro}/`);
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  if (blobs[0]) return { ...blobs[0], origen: 'subido' };
  const inc = LIBROS[libro]?.incluido;
  if (inc) return { pathname: `incluido:${inc}`, size: LIBROS[libro].peso || null, uploadedAt: null, origen: 'incluido' };
  return null;
}
export const RUTA_FIRMA = 'ajustes/firma.json';

export async function cuerpoJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
