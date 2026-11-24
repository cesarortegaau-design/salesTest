// Lectura de los libros (Blob o incluidos) y armado del PDF dedicado con firma.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { abreArchivo, listaTodo, guardaArchivo, LIBROS } from './core.js';

export async function bytesLibro(arch) {
  if (arch.pathname.startsWith('incluido:')) {
    const nombre = path.basename(arch.pathname.slice(9));
    try { return new Uint8Array(await readFile(path.join(process.cwd(), 'privado', nombre))); } catch { return null; }
  }
  const r = await abreArchivo(arch.pathname);
  if (!r) return null;
  return new Uint8Array(await new Response(r.stream).arrayBuffer());
}

// Respuesta en flujo por trozos: evita el límite de cuerpo de las funciones con archivos grandes.
export function respuestaPDF(bytes, nombre, disposicion = 'attachment') {
  const TROZO = 512 * 1024;
  let i = 0;
  const stream = new ReadableStream({
    pull(c) {
      if (i >= bytes.length) return c.close();
      c.enqueue(bytes.subarray(i, i + TROZO));
      i += TROZO;
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(bytes.length),
      'content-disposition': `${disposicion}; filename="${nombre}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => { const d = new Date(iso || Date.now()); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };

// Solo caracteres que las fuentes estándar del PDF pueden dibujar.
function limpio(font, t) {
  let out = '';
  for (const ch of String(t || '').replace(/\r/g, '')) {
    if (ch === '\n') { out += ch; continue; }
    const prueba = (c) => { try { font.widthOfTextAtSize(c, 10); return true; } catch { return false; } };
    if (prueba(ch)) out += ch;
    else { const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); out += base && prueba(base) ? base : ''; }
  }
  return out;
}
function envuelve(font, texto, size, ancho) {
  const lineas = [];
  for (const parrafo of texto.split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? linea + ' ' + palabra : palabra;
      if (font.widthOfTextAtSize(prueba, size) > ancho && linea) { lineas.push(linea); linea = palabra; }
      else linea = prueba;
    }
    lineas.push(linea);
  }
  return lineas;
}

export async function pdfDedicado(original, sol, libroId) {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const [w, h] = (() => { const p = doc.getPage(0); const { width, height } = p.getSize(); return [width, height]; })();
  const pag = doc.insertPage(0, [w, h]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const cursiva = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.HelveticaBold);
  const rojo = rgb(0.784, 0.063, 0.18);
  const negro = rgb(0.05, 0.05, 0.05);
  const gris = rgb(0.45, 0.42, 0.4);
  const m = Math.max(54, w * 0.12);
  const ancho = w - m * 2;
  let y = h - Math.max(m + 10, h * 0.2);

  pag.drawRectangle({ x: m, y, width: 46, height: 3, color: rojo });
  y -= 22;
  pag.drawText('EJEMPLAR DEDICADO', { x: m, y, size: 10, font: sans, color: rojo });
  y -= 30;
  const titulo = limpio(serif, LIBROS[libroId]?.titulo || '');
  for (const l of envuelve(serif, titulo, 24, ancho)) { pag.drawText(l, { x: m, y, size: 24, font: serif, color: negro }); y -= 28; }
  y -= 26;
  const para = limpio(cursiva, `Para ${sol.nombre || sol.correo}`);
  pag.drawText(para, { x: m, y, size: 18, font: cursiva, color: rojo });
  y -= 34;
  const texto = limpio(cursiva, sol.dedicatoria || '');
  for (const l of envuelve(cursiva, texto, 15, ancho)) {
    if (y < m + 190) break;
    pag.drawText(l, { x: m, y, size: 15, font: cursiva, color: negro, lineHeight: 21 });
    y -= 21;
  }
  y -= 18;
  if (sol.firma && /^data:image\/png;base64,/.test(sol.firma)) {
    try {
      const png = await doc.embedPng(Buffer.from(sol.firma.split(',')[1], 'base64'));
      const esc = Math.min(220 / png.width, 110 / png.height, 1.4);
      const fw = png.width * esc, fh = png.height * esc;
      y = Math.max(y - fh, m + 70);
      pag.drawImage(png, { x: m, y, width: fw, height: fh });
      y -= 8;
    } catch {}
  }
  pag.drawLine({ start: { x: m, y }, end: { x: m + 230, y }, thickness: 0.6, color: gris });
  y -= 16;
  pag.drawText('Joel Ortega Juárez', { x: m, y, size: 12, font: serif, color: negro });
  y -= 15;
  pag.drawText(limpio(serif, `Ciudad de México, ${fechaLarga(sol.dedicadaEn)}`), { x: m, y, size: 10, font: serif, color: gris });

  // Marca personal discreta al pie de cada página del libro.
  const marca = limpio(serif, `Ejemplar personal de ${sol.correo} · distribución directa del autor`);
  const paginas = doc.getPages();
  pag.drawText(marca, { x: m, y: 30, size: 7, font: serif, color: gris });
  for (let i = 1; i < paginas.length; i++) {
    const p = paginas[i];
    const { width } = p.getSize();
    const tw = serif.widthOfTextAtSize(marca, 6);
    p.drawText(marca, { x: (width - tw) / 2, y: 12, size: 6, font: serif, color: rgb(0.6, 0.58, 0.56), opacity: 0.8 });
  }
  doc.setTitle(`${LIBROS[libroId]?.titulo || ''} · Ejemplar dedicado`);
  doc.setAuthor('Joel Ortega Juárez');
  return doc.save({ useObjectStreams: true });
}

// PDF dedicado con caché en el almacén privado (se regenera si cambia la dedicatoria, la firma o el archivo).
export async function pdfDedicadoCache(arch, sol, libroId, llaveUsuario) {
  const huella = createHash('sha256').update([arch.pathname, arch.uploadedAt, sol.correo, sol.nombre, sol.dedicatoria, sol.firma, sol.dedicadaEn].join('|')).digest('hex').slice(0, 20);
  const prefijo = `dedicados/${llaveUsuario}/${libroId}-${huella}`;
  const hay = (await listaTodo(prefijo))[0];
  if (hay) {
    const r = await abreArchivo(hay.pathname);
    if (r) return new Uint8Array(await new Response(r.stream).arrayBuffer());
  }
  const original = await bytesLibro(arch);
  if (!original) return null;
  const bytes = await pdfDedicado(original, sol, libroId);
  try { await guardaArchivo(`${prefijo}.pdf`, Buffer.from(bytes), 'application/pdf'); } catch {}
  return bytes;
}
