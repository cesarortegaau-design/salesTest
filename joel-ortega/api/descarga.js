// GET /api/descarga?libro=ID → entrega el libro si Joel aprobó la solicitud (o si eres admin).
// GET /api/descarga?comprobante=CORREO&libro=ID → solo admin: ver comprobante.
import { error, sesion, leeJSON, rutaSolicitud, LIBROS, archivoLibro, abreArchivo } from './_lib/core.js';

const limpia = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');

export async function GET(request) {
  const s = sesion(request);
  if (!s) return error('Inicia sesión.', 401);
  const q = new URL(request.url).searchParams;
  const libro = q.get('libro') || '';
  if (!LIBROS[libro]) return error('Libro no válido.', 404);

  // Comprobante (solo administración)
  if (q.has('comprobante')) {
    if (!s.admin) return error('Sin permiso.', 403);
    const sol = await leeJSON(rutaSolicitud(q.get('comprobante'), libro));
    if (!sol?.comprobante) return error('Sin comprobante.', 404);
    const r = await abreArchivo(sol.comprobante.pathname);
    if (!r) return error('No se encontró el archivo.', 404);
    return new Response(r.stream, {
      headers: {
        'content-type': sol.comprobante.tipo || 'application/octet-stream',
        'content-disposition': `inline; filename="${limpia(sol.comprobante.nombre || 'comprobante')}"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  if (!s.admin) {
    const sol = await leeJSON(rutaSolicitud(s.correo, libro));
    if (sol?.estado !== 'aprobada') return error('Tu solicitud aún no ha sido aprobada.', 403);
  }
  const arch = await archivoLibro(libro);
  if (!arch) return error('Joel todavía no ha subido el archivo de este libro.', 404);
  const r = await abreArchivo(arch.pathname);
  if (!r) return error('No se encontró el archivo.', 404);
  const ext = (arch.pathname.match(/\.(\w+)$/) || [, 'pdf'])[1];
  return new Response(r.stream, {
    headers: {
      'content-type': r.blob?.contentType || 'application/octet-stream',
      'content-disposition': `attachment; filename="${limpia(LIBROS[libro].titulo)}.${ext}"`,
      'cache-control': 'private, no-store',
    },
  });
}
