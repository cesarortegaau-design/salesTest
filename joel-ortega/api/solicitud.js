// GET  /api/solicitud           → solicitudes del usuario y datos para cooperar
// POST /api/solicitud (multipart) → crea o actualiza la solicitud de un libro, con comprobante opcional
import {
  json, error, sesion, leeJSON, guardaJSON, guardaArchivo, rutaSolicitud, rutaUsuario,
  llave, LIBROS, ajustes, archivoLibro,
} from './_lib/core.js';

const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
const MAX = 4 * 1024 * 1024;

const publica = (s, hayArchivo) =>
  s && {
    libro: s.libro,
    estado: s.estado,
    monto: s.monto,
    referencia: s.referencia,
    nota: s.nota,
    comprobante: s.comprobante ? { nombre: s.comprobante.nombre, fecha: s.comprobante.fecha } : null,
    creada: s.creada,
    actualizada: s.actualizada,
    mensajeJoel: s.mensajeJoel || '',
    descargable: s.estado === 'aprobada' && hayArchivo,
    dedicatoria: s.estado === 'aprobada' ? s.dedicatoria || '' : '',
    firma: s.estado === 'aprobada' ? s.firma || '' : '',
    dedicadaEn: s.estado === 'aprobada' ? s.dedicadaEn || null : null,
    nombre: s.nombre || '',
  };

export async function GET(request) {
  const s = sesion(request);
  // La página de pedido muestra los datos de cooperación antes de crear la cuenta.
  if (!s || s.soloAdmin) {
    if (new URL(request.url).searchParams.has('publico')) return json({ solicitudes: {}, ajustes: await ajustes(), libros: LIBROS });
    return error('Inicia sesión.', 401);
  }
  const filas = await Promise.all(
    Object.keys(LIBROS).map(async (id) => {
      const [sol, arch] = await Promise.all([leeJSON(rutaSolicitud(s.correo, id)), archivoLibro(id)]);
      return [id, publica(sol, !!arch)];
    }),
  );
  const a = await ajustes();
  return json({ solicitudes: Object.fromEntries(filas.filter(([, v]) => v)), ajustes: a, libros: LIBROS });
}

export async function POST(request) {
  const s = sesion(request);
  if (!s) return error('Inicia sesión para solicitar el libro.', 401);
  const usuario = await leeJSON(rutaUsuario(s.correo));
  if (!usuario) return error('Tu cuenta no existe. Regístrate de nuevo.', 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return error('No se pudo leer el formulario.');
  }
  const libro = String(form.get('libro') || '');
  if (!LIBROS[libro]) return error('Libro no válido.');

  const ruta = rutaSolicitud(s.correo, libro);
  const previa = await leeJSON(ruta);
  const ahora = new Date().toISOString();

  const montoTxt = String(form.get('monto') || '').replace(/[^\d.]/g, '');
  const monto = montoTxt ? Math.min(Math.round(Number(montoTxt) * 100) / 100, 1e6) : null;
  const referencia = String(form.get('referencia') || '').trim().slice(0, 80);
  const nota = String(form.get('nota') || '').trim().slice(0, 600);

  let comprobante = previa?.comprobante || null;
  const archivo = form.get('comprobante');
  if (archivo && typeof archivo === 'object' && archivo.size > 0) {
    if (archivo.size > MAX) return error('El comprobante pesa más de 4 MB. Sube una foto o PDF más ligero.');
    const ext = TIPOS[archivo.type];
    if (!ext) return error('El comprobante debe ser imagen (JPG, PNG, WEBP, HEIC) o PDF.');
    const b = await guardaArchivo(`comprobantes/${llave(s.correo)}/${libro}.${ext}`, archivo.stream(), archivo.type);
    comprobante = { pathname: b.pathname, tipo: archivo.type, nombre: String(archivo.name || `comprobante.${ext}`).slice(0, 120), fecha: ahora };
  }

  // Una solicitud aprobada no vuelve a revisión al subir otro comprobante.
  const estado = previa?.estado === 'aprobada' ? 'aprobada' : comprobante ? 'por_validar' : 'solicitada';

  const sol = {
    correo: s.correo,
    nombre: usuario.nombre || '',
    libro,
    estado,
    monto: monto ?? previa?.monto ?? null,
    referencia: referencia || previa?.referencia || '',
    nota: nota || previa?.nota || '',
    comprobante,
    mensajeJoel: previa?.mensajeJoel || '',
    dedicatoria: previa?.dedicatoria || '',
    firma: previa?.firma || '',
    dedicadaEn: previa?.dedicadaEn || null,
    creada: previa?.creada || ahora,
    actualizada: ahora,
    historial: [...(previa?.historial || []), { fecha: ahora, evento: comprobante && comprobante.fecha === ahora ? 'comprobante' : 'solicitud' }].slice(-30),
  };
  await guardaJSON(ruta, sol);
  const arch = await archivoLibro(libro);
  return json({ solicitud: publica(sol, !!arch) }, previa ? 200 : 201);
}
