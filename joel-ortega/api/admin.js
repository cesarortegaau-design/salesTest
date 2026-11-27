// Panel de Joel.
// GET  /api/admin                     → todas las solicitudes, ajustes y archivos de libros
// POST /api/admin?accion=estado       → { correo, libro, estado: aprobada|rechazada|por_validar, mensaje }
// POST /api/admin?accion=compartir    → { correo, libro, mensaje } comparte directo con cualquier correo registrado
// POST /api/admin?accion=ajustes      → datos de la cooperación
// POST /api/admin?accion=borrar-libro → { pathname } elimina un archivo de libro
// POST /api/admin?accion=dedicar      → { correo, libro, dedicatoria, firma, guardarFirma } aprueba y dedica
// POST /api/admin?accion=firma        → { firma } guarda la firma de Joel para reutilizarla
import { randomInt } from 'node:crypto';
import {
  json, error, hashContrasena, sesion, leeJSON, guardaJSON, listaTodo, rutaSolicitud, rutaUsuario, normalizaCorreo,
  LIBROS, ajustes, RUTA_AJUSTES, AJUSTES_BASE, cuerpoJSON, del, archivoLibro, RUTA_FIRMA,
} from './_lib/core.js';

const ESTADOS = ['aprobada', 'rechazada', 'por_validar', 'solicitada'];
const MAX_FIRMA = 400 * 1024;
const firmaValida = (f) => typeof f === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(f) && f.length <= MAX_FIRMA;

function admin(request) {
  const s = sesion(request);
  return s?.admin ? s : null;
}

export async function GET(request) {
  if (!admin(request)) return error('Sin permiso.', 403);
  const blobs = await listaTodo('solicitudes/');
  const solicitudes = (await Promise.all(blobs.map((b) => leeJSON(b.pathname))))
    .filter(Boolean)
    .map(({ historial, ...s }) => ({ ...s, comprobante: s.comprobante ? { nombre: s.comprobante.nombre, tipo: s.comprobante.tipo, fecha: s.comprobante.fecha } : null }))
    .sort((a, b) => (b.actualizada || '').localeCompare(a.actualizada || ''));
  const usuarios = (await listaTodo('usuarios/')).length;
  const archivos = {};
  for (const id of Object.keys(LIBROS)) {
    archivos[id] = (await listaTodo(`libros/${id}/`))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map((b) => ({ pathname: b.pathname, size: b.size, subido: b.uploadedAt }));
    if (!archivos[id].length) {
      const a = await archivoLibro(id);
      if (a) archivos[id] = [{ pathname: a.pathname, size: a.size, subido: null, incluido: true }];
    }
  }
  const firmaGuardada = (await leeJSON(RUTA_FIRMA))?.firma || '';
  return json({ solicitudes, usuarios, archivos, ajustes: await ajustes(), libros: LIBROS, firmaGuardada });
}

export async function POST(request) {
  const s = admin(request);
  if (!s) return error('Sin permiso.', 403);
  const accion = new URL(request.url).searchParams.get('accion');
  const b = await cuerpoJSON(request);
  const ahora = new Date().toISOString();

  // Contraseña temporal para quien olvidó la suya: Joel se la comparte y la persona la cambia en Mi perfil.
  if (accion === 'clave-temporal') {
    const correo = normalizaCorreo(b.correo);
    const ruta = rutaUsuario(correo);
    const u = await leeJSON(ruta);
    if (!u) return error('No hay ninguna cuenta con ese correo.', 404);
    const ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
    let temporal = '';
    for (let i = 0; i < 10; i++) temporal += ABC[randomInt(ABC.length)];
    await guardaJSON(ruta, { ...u, ...hashContrasena(temporal), temporal: ahora });
    return json({ correo, temporal });
  }

  if (accion === 'firma') {
    if (b.firma && !firmaValida(b.firma)) return error('Firma no válida.');
    await guardaJSON(RUTA_FIRMA, { firma: b.firma || '', fecha: ahora });
    return json({ ok: true });
  }

  if (accion === 'estado' || accion === 'compartir' || accion === 'dedicar') {
    const correo = normalizaCorreo(b.correo);
    if (!LIBROS[b.libro]) return error('Libro no válido.');
    const estado = accion === 'estado' ? b.estado : 'aprobada';
    const dedica = accion === 'dedicar' || (estado === 'aprobada' && (b.dedicatoria !== undefined || b.firma !== undefined));
    if (dedica && b.firma && !firmaValida(b.firma)) return error('La firma no es válida o es demasiado grande.');
    if (!ESTADOS.includes(estado)) return error('Estado no válido.');
    const usuario = await leeJSON(rutaUsuario(correo));
    if (!usuario) return error('Ese correo no tiene cuenta. Pídele que se registre primero.', 404);
    const ruta = rutaSolicitud(correo, b.libro);
    const previa = await leeJSON(ruta);
    const sol = {
      correo,
      nombre: usuario.nombre || '',
      libro: b.libro,
      monto: null,
      referencia: '',
      nota: '',
      comprobante: null,
      creada: ahora,
      ...previa,
      estado,
      mensajeJoel: typeof b.mensaje === 'string' ? b.mensaje.slice(0, 600) : previa?.mensajeJoel || '',
      actualizada: ahora,
      historial: [...(previa?.historial || []), { fecha: ahora, evento: `${dedica ? 'dedicada y ' : ''}${estado} por ${s.soloAdmin ? 'Joel' : s.correo}` }].slice(-30),
    };
    if (dedica) {
      sol.dedicatoria = String(b.dedicatoria || '').trim().slice(0, 1200);
      sol.firma = b.firma || '';
      sol.dedicadaEn = ahora;
      if (b.guardarFirma && b.firma) await guardaJSON(RUTA_FIRMA, { firma: b.firma, fecha: ahora });
    }
    await guardaJSON(ruta, sol);
    return json({ ok: true, estado });
  }

  if (accion === 'ajustes') {
    const limpio = {};
    for (const k of Object.keys(AJUSTES_BASE)) {
      if (k === 'montoSugerido') limpio[k] = Math.max(0, Number(b[k]) || 0);
      else limpio[k] = String(b[k] ?? '').trim().slice(0, 400);
    }
    await guardaJSON(RUTA_AJUSTES, limpio);
    return json({ ajustes: limpio });
  }

  if (accion === 'borrar-libro') {
    if (!/^libros\/[\w-]+\//.test(b.pathname || '')) return error('Ruta no válida.');
    await del(b.pathname);
    return json({ ok: true });
  }

  return error('Acción no válida.');
}
