import { upload } from '@vercel/blob/client';
import { PanelFirma } from './firma.js';

const ESTADOS = { solicitada: 'Sin comprobante', por_validar: 'Por validar', aprobada: 'Aprobada', rechazada: 'No aprobada' };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

let datos = null;
let filtro = 'por_validar';

async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opts });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
}

async function carga() {
  try {
    datos = await api('/api/admin');
  } catch {
    $('acceso-admin').hidden = false;
    $('cab-texto').textContent = 'Acceso solo con la clave de administración.';
    $('aa-clave').focus();
    return;
  }
  $('acceso-admin').hidden = true;
  $('panel').hidden = false;
  pinta();
}

function pinta() {
  const { solicitudes, libros, archivos, ajustes, usuarios } = datos;
  const cuenta = (e) => solicitudes.filter((s) => s.estado === e).length;
  const total = solicitudes.filter((s) => s.estado === 'aprobada').reduce((a, s) => a + (Number(s.monto) || 0), 0);
  $('metricas').innerHTML = [
    [usuarios, 'Cuentas'],
    [cuenta('por_validar'), 'Por validar'],
    [cuenta('solicitada'), 'Sin comprobante'],
    [cuenta('aprobada'), 'Libros compartidos'],
    ['$' + total.toLocaleString('es-MX'), 'Cooperación aprobada'],
  ].map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('');

  const lista = solicitudes.filter((s) => filtro === 'todas' || s.estado === filtro);
  $('filas').innerHTML = lista.length
    ? lista.map((s) => {
        const q = `correo=${encodeURIComponent(s.correo)}&libro=${encodeURIComponent(s.libro)}`;
        const asunto = encodeURIComponent(`Tu libro ${libros[s.libro]?.titulo || ''}`);
        const cuerpo = encodeURIComponent(`Hola${s.nombre ? ' ' + s.nombre : ''}:\n\nGracias por tu cooperación. Ya puedes descargar el libro desde tu cuenta: ${location.origin}/cuenta.html\n\nJoel Ortega Juárez`);
        return `<tr>
          <td><b>${esc(s.nombre || '—')}</b><br><small>${esc(s.correo)}</small>${s.nota ? `<br><small><i>“${esc(s.nota)}”</i></small>` : ''}</td>
          <td>${esc(libros[s.libro]?.titulo || s.libro)}</td>
          <td>${s.monto ? '$' + Number(s.monto).toLocaleString('es-MX') : '—'}${s.referencia ? `<br><small>Ref. ${esc(s.referencia)}</small>` : ''}</td>
          <td>${s.comprobante ? `<a class="enlace" href="/api/descarga?comprobante=${encodeURIComponent(s.correo)}&libro=${encodeURIComponent(s.libro)}" target="_blank" rel="noopener">Ver</a><br><small>${fecha(s.comprobante.fecha)}</small>` : '—'}</td>
          <td><span class="chip chip--${esc(s.estado)}">${esc(ESTADOS[s.estado] || s.estado)}</span><br><small>${fecha(s.actualizada)}</small>${s.estado === 'aprobada' ? `<br><small>${s.dedicatoria || s.firma ? '✍ Dedicado' : 'Sin dedicatoria'}</small>${s.firma ? `<img class="firmita" src="${esc(s.firma)}" alt="Firma">` : ''}` : ''}</td>
          <td><div class="acciones" data-q="${esc(q)}">
            ${s.estado !== 'aprobada'
              ? `<button class="si" data-dedicar>Aprobar, dedicar y firmar</button>`
              : `<button class="si" data-dedicar>${s.dedicatoria || s.firma ? 'Editar dedicatoria' : 'Dedicar y firmar'}</button><a href="mailto:${esc(s.correo)}?subject=${asunto}&body=${cuerpo}">Avisar por correo</a>`}
            ${s.estado !== 'rechazada' ? `<button class="no" data-estado="rechazada">No aprobar</button>` : ''}
            ${s.estado === 'aprobada' ? `<button data-estado="por_validar">Quitar acceso</button>` : ''}
          </div></td></tr>`;
      }).join('')
    : `<tr><td colspan="6" class="vacio">No hay solicitudes en esta vista.</td></tr>`;

  const opciones = Object.entries(libros).map(([id, l]) => `<option value="${esc(id)}">${esc(l.titulo)}</option>`).join('');
  if (!$('c-libro').options.length) $('c-libro').innerHTML = opciones;
  if (!$('s-libro').options.length) $('s-libro').innerHTML = opciones;

  $('archivos').innerHTML = Object.entries(libros).map(([id, l]) => {
    const a = archivos[id] || [];
    const nombre = (x) => (x.incluido ? 'PDF incluido en el sitio' : esc(x.pathname.split('/').pop()));
    return `<p style="margin:0 0 6px"><b>${esc(l.titulo)}:</b> ${a.length ? `${nombre(a[0])}${a[0].size ? ' · ' + kb(a[0].size) : ''}${a[0].subido ? ' · ' + fecha(a[0].subido) : ''} <a class="enlace" href="/leer.html?libro=${encodeURIComponent(id)}" target="_blank" rel="noopener">Abrir en el lector</a>` : '<span style="color:var(--rojo-700)">sin archivo todavía</span>'}</p>`;
  }).join('');

  const f = $('form-ajustes');
  if (!f.dataset.listo) {
    for (const [k, v] of Object.entries(ajustes)) if (f.elements[k]) f.elements[k].value = v ?? '';
    f.dataset.listo = '1';
  }
  document.querySelectorAll('#filtros button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filtro)));
}

document.addEventListener('click', async (e) => {
  const fb = e.target.closest('#filtros button');
  if (fb) { filtro = fb.dataset.f; pinta(); return; }
  const b = e.target.closest('[data-estado]');
  if (b) {
    const p = new URLSearchParams(b.parentElement.dataset.q);
    let mensaje;
    if (b.dataset.estado === 'rechazada') {
      mensaje = prompt('Mensaje para la persona (opcional):', '');
      if (mensaje === null) return;
    }
    b.disabled = true;
    try {
      await api('/api/admin?accion=estado', { method: 'POST', body: JSON.stringify({ correo: p.get('correo'), libro: p.get('libro'), estado: b.dataset.estado, mensaje }) });
      await carga();
    } catch (err) { alert(err.message); b.disabled = false; }
  }
  const d = e.target.closest('[data-dedicar]');
  if (d) {
    const p = new URLSearchParams(d.parentElement.dataset.q);
    abreDedicar(p.get('correo'), p.get('libro'));
    return;
  }
  if (e.target.closest('[data-cerrar-dedicar]') || e.target.id === 'dedicar') cierraDedicar();
  if (e.target.id === 'salir') { await fetch('/api/auth?accion=salir-admin', { method: 'POST' }); location.href = '/'; }
});

// ---------- Dedicatoria y firma ----------
let firma = null;
let dedicando = null;
const SUGERENCIAS = [
  (n) => `Para ${n}, con la memoria de quienes ganaron la calle.`,
  (n) => `A ${n}: el presente es de lucha, el futuro es nuestro. Con afecto y gratitud por tu cooperación.`,
  (n) => `Para ${n}, compañero de lectura, con un abrazo libertario.`,
  (n) => `A ${n}, para que estas semblanzas no se queden tras bambalinas.`,
];

function vista() {
  $('d-vista-texto').textContent = $('d-texto').value;
  const png = firma && !firma.vacia() ? firma.png() : '';
  $('d-vista-firma').hidden = !png;
  if (png) $('d-vista-firma').src = png;
  document.querySelector('.firma__lienzo').classList.toggle('firmado', !!(firma && !firma.vacia()));
}

function cargaFirmaImagen(dataUrl) {
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const c = $('d-canvas');
    const r = c.getBoundingClientRect();
    const esc = Math.min((r.width - 40) / img.width, (r.height - 30) / img.height, 1);
    firma.trazos = [];
    firma.redibuja();
    // La firma guardada se coloca como imagen de fondo editable: si Joel firma encima, se reemplaza.
    firma.imagenBase = { img, x: 20, y: (r.height - img.height * esc) / 2, w: img.width * esc, h: img.height * esc };
    pintaBase();
    vista();
  };
  img.src = dataUrl;
}
function pintaBase() {
  const b = firma.imagenBase;
  if (!b) return;
  const e = firma.esc || 1;
  firma.ctx.drawImage(b.img, b.x * e, b.y * e, b.w * e, b.h * e);
}

function abreDedicar(correo, libro) {
  const s = datos.solicitudes.find((x) => x.correo === correo && x.libro === libro);
  if (!s) return;
  dedicando = s;
  const nombre = s.nombre || correo.split('@')[0];
  $('d-titulo').textContent = s.estado === 'aprobada' ? 'Dedicar y firmar' : 'Aprobar, dedicar y firmar';
  $('d-para').innerHTML = `Para <b>${esc(nombre)}</b> · ${esc(correo)} · <i>${esc(datos.libros[libro]?.titulo || libro)}</i>`;
  $('d-libro').textContent = datos.libros[libro]?.titulo || '';
  $('d-nombre').textContent = 'Para ' + nombre;
  $('d-texto').value = s.dedicatoria || '';
  $('d-sug').innerHTML = SUGERENCIAS.map((f, i) => `<button type="button" data-sug="${i}">${esc(f(nombre).slice(0, 34))}…</button>`).join('');
  $('d-enviar').textContent = s.estado === 'aprobada' ? 'Guardar dedicatoria' : 'Aprobar y compartir';
  $('d-estado').textContent = '';
  $('d-previa').hidden = !(s.estado === 'aprobada' && (s.dedicatoria || s.firma));
  $('d-previa').href = `/api/descarga?libro=${encodeURIComponent(libro)}&para=${encodeURIComponent(correo)}&vista=1`;
  $('d-guardada').hidden = !datos.firmaGuardada;
  $('dedicar').hidden = false;
  document.body.style.overflow = 'hidden';
  if (!firma) {
    firma = new PanelFirma($('d-canvas'));
    const redibuja = firma.redibuja.bind(firma);
    firma.redibuja = () => { redibuja(); if (firma.trazos.length === 0) pintaBase(); };
    firma.alCambiar = () => { if (firma.trazos.length) firma.imagenBase = null; firma.redibuja(); vista(); };
  }
  firma.imagenBase = null;
  firma.trazos = [];
  requestAnimationFrame(() => {
    firma._ajusta();
    const previa = s.firma || datos.firmaGuardada;
    if (previa) cargaFirmaImagen(previa);
    vista();
    $('d-texto').focus();
  });
}
function cierraDedicar() {
  $('dedicar').hidden = true;
  document.body.style.overflow = '';
  dedicando = null;
}
function firmaActual() {
  if (firma && !firma.vacia()) return firma.png();
  if (firma?.imagenBase) return firma.imagenBase.img.src;
  return '';
}

$('d-texto').addEventListener('input', vista);
$('d-sug').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sug]');
  if (!b || !dedicando) return;
  $('d-texto').value = SUGERENCIAS[+b.dataset.sug](dedicando.nombre || dedicando.correo.split('@')[0]);
  vista();
});
$('d-deshacer').addEventListener('click', () => { if (firma.trazos.length) firma.deshaz(); else { firma.imagenBase = null; firma.redibuja(); vista(); } });
$('d-limpiar').addEventListener('click', () => { firma.imagenBase = null; firma.limpia(); vista(); });
$('d-guardada').addEventListener('click', () => { firma.trazos = []; cargaFirmaImagen(datos.firmaGuardada); });
document.querySelectorAll('[data-tinta]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tinta]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  firma.tinta = b.dataset.tinta;
  firma.trazos.forEach((t) => (t.tinta = b.dataset.tinta));
  firma.redibuja(); vista();
}));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('dedicar').hidden) cierraDedicar(); });

$('form-dedicar').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dedicando) return;
  const st = $('d-estado'), btn = $('d-enviar');
  const png = firmaActual();
  if (!png && !$('d-texto').value.trim()) { st.className = 'estado'; st.textContent = 'Escribe una dedicatoria o firma antes de enviar.'; return; }
  btn.disabled = true; st.className = 'estado'; st.textContent = 'Guardando…';
  try {
    const { correo, libro } = dedicando;
    await api('/api/admin?accion=dedicar', { method: 'POST', body: JSON.stringify({ correo, libro, dedicatoria: $('d-texto').value, firma: png, guardarFirma: $('d-guardar').checked }) });
    st.className = 'estado ok'; st.textContent = 'Listo. Ya aparece en la cuenta de la persona.';
    await carga();
    const previa = $('d-previa');
    previa.href = `/api/descarga?libro=${encodeURIComponent(libro)}&para=${encodeURIComponent(correo)}&vista=1`;
    previa.hidden = false;
    dedicando = datos.solicitudes.find((x) => x.correo === correo && x.libro === libro) || dedicando;
    btn.textContent = 'Guardar dedicatoria';
  } catch (err) { st.className = 'estado'; st.textContent = err.message; }
  finally { btn.disabled = false; }
});

$('form-admin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('aa-estado');
  st.className = 'estado'; st.textContent = 'Verificando…';
  try {
    await api('/api/auth?accion=clave', { method: 'POST', body: JSON.stringify({ clave: $('aa-clave').value }) });
    st.textContent = '';
    $('aa-clave').value = '';
    await carga();
  } catch (err) { st.textContent = err.message; }
});

$('form-compartir').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('c-estado');
  st.className = 'estado'; st.textContent = 'Compartiendo…';
  try {
    await api('/api/admin?accion=compartir', { method: 'POST', body: JSON.stringify({ correo: $('c-correo').value, libro: $('c-libro').value, mensaje: $('c-msg').value }) });
    st.className = 'estado ok'; st.textContent = 'Compartido. La persona ya puede descargarlo desde su cuenta.';
    e.target.reset();
    await carga();
  } catch (err) { st.textContent = err.message; }
});

$('form-archivo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('s-estado'), file = $('s-arch').files[0], libro = $('s-libro').value;
  if (!file) return;
  const btn = e.target.querySelector('button');
  btn.disabled = true; st.className = 'estado'; st.textContent = 'Subiendo… 0%';
  try {
    const nombre = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
    await upload(`libros/${libro}/${nombre}`, file, {
      access: 'private',
      handleUploadUrl: '/api/subir-libro',
      multipart: file.size > 8 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => { st.textContent = `Subiendo… ${Math.round(percentage)}%`; },
    });
    st.className = 'estado ok'; st.textContent = 'Archivo subido. Ya se entrega a las personas aprobadas.';
    e.target.reset();
    await carga();
  } catch (err) { st.textContent = 'No se pudo subir: ' + err.message; }
  finally { btn.disabled = false; }
});

$('form-temporal').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('t-estado');
  if (!confirm('Se reemplazará la contraseña actual de ' + $('t-correo').value + '. ¿Continuar?')) return;
  st.className = 'estado'; st.textContent = 'Generando…';
  $('t-resultado').hidden = true;
  try {
    const d = await api('/api/admin?accion=clave-temporal', { method: 'POST', body: JSON.stringify({ correo: $('t-correo').value }) });
    $('t-para').textContent = d.correo; $('t-clave').textContent = d.temporal; $('t-resultado').hidden = false;
    st.className = 'estado ok'; st.textContent = 'Lista. Compártela con la persona; no se volverá a mostrar.';
  } catch (err) { st.textContent = err.message; }
});
$('t-copiar').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('t-clave').textContent); $('t-copiar').textContent = 'Copiada'; } catch {} });

$('form-ajustes').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('j-estado');
  try {
    const d = await api('/api/admin?accion=ajustes', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    datos.ajustes = d.ajustes;
    st.className = 'estado ok'; st.textContent = 'Datos guardados.';
  } catch (err) { st.className = 'estado'; st.textContent = err.message; }
});

carga();
