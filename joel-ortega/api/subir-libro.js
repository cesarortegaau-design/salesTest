// Emite tokens para que Joel suba el archivo del libro directo al almacén privado (archivos de cualquier tamaño).
import { handleUpload } from '@vercel/blob/client';
import { json, error, sesion, LIBROS } from './_lib/core.js';

export async function POST(request) {
  const s = sesion(request);
  if (!s?.admin) return error('Sin permiso.', 403);
  const body = await request.json();
  try {
    const r = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const libro = pathname.split('/')[1];
        if (!pathname.startsWith('libros/') || !LIBROS[libro]) throw new Error('Ruta no válida');
        return {
          allowedContentTypes: ['application/pdf', 'application/epub+zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return json(r);
  } catch (e) {
    return error(e.message || 'No se pudo subir.', 400);
  }
}
