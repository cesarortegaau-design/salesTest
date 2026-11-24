// GET /api/descarga?libro=ID              → PDF dedicado (con dedicatoria, firma y marca personal) para descargar
// GET /api/descarga?libro=ID&modo=leer    → PDF para el lector de la plataforma (en línea)
// GET /api/descarga?comprobante=CORREO&libro=ID → solo admin: ver comprobante
import { error, sesion, leeJSON, rutaSolicitud, LIBROS, archivoLibro, abreArchivo, llave } from './_lib/core.js';
import { bytesLibro, pdfDedicadoCache, respuestaPDF } from './_lib/archivo.js';

const limpia = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');

export async function GET(request) {
  const s = sesion(request);
  if (!s) return error('Inicia sesión.', 401);
  const q = new URL(request.url).searchParams;
  const libro = q.get('libro') || '';
  if (!LIBROS[libro]) return error('Libro no válido.', 404);

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

  // Joel puede revisar cualquier libro; la vista previa de una dedicatoria usa ?para=correo
  let sol = null;
  if (s.admin && q.get('para')) sol = await leeJSON(rutaSolicitud(q.get('para'), libro));
  else if (!s.soloAdmin) sol = await leeJSON(rutaSolicitud(s.correo, libro));
  if (!s.admin && sol?.estado !== 'aprobada') return error('Tu solicitud aún no ha sido aprobada.', 403);

  const arch = await archivoLibro(libro);
  if (!arch) return error('Joel todavía no ha subido el archivo de este libro.', 404);
  const titulo = limpia(LIBROS[libro].titulo);

  const esPDF = arch.pathname.startsWith('incluido:') || /\.pdf$/i.test(arch.pathname);
  if (q.get('modo') === 'leer' || !sol || !esPDF || !(sol.dedicatoria || sol.firma)) {
    if (!esPDF) {
      const r = await abreArchivo(arch.pathname);
      if (!r) return error('No se encontró el archivo.', 404);
      const ext = (arch.pathname.match(/\.(\w+)$/) || [, 'bin'])[1];
      return new Response(r.stream, { headers: { 'content-type': r.blob?.contentType || 'application/octet-stream', 'content-disposition': `attachment; filename="${titulo}.${ext}"`, 'cache-control': 'private, no-store' } });
    }
    const bytes = await bytesLibro(arch);
    if (!bytes) return error('No se encontró el archivo.', 404);
    return respuestaPDF(bytes, `${titulo}.pdf`, q.get('modo') === 'leer' ? 'inline' : 'attachment');
  }

  const bytes = await pdfDedicadoCache(arch, sol, libro, llave(sol.correo));
  if (!bytes) return error('No se encontró el archivo.', 404);
  return respuestaPDF(bytes, `${titulo}_dedicado.pdf`, q.get('vista') ? 'inline' : 'attachment');
}
