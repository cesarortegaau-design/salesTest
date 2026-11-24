// Lector de la plataforma: páginas continuas con carga diferida, zoom, temas, índice, marcadores y última página leída.
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';

const $ = (id) => document.getElementById(id);
const libro = new URLSearchParams(location.search).get('libro') || '';
const CLAVE = `lector:${libro}`;
const lee = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const escena = $('lt-escena');
const cont = $('lt-paginas');
let pdf = null;
let base = { w: 612, h: 792 };
let escala = 1;
let modoAncho = true;
let paginas = [];
let actual = 1;
const renderizadas = new Map();
const TEMAS = ['claro', 'sepia', 'noche'];
let estado = lee(CLAVE, { pagina: 1, marcas: [], zoom: null });
let tema = lee('lector:tema', 'claro');

function mensaje(texto, error = false, html = false) {
  const box = document.querySelector('.lt-cargando');
  $('lt-estado').hidden = false;
  box.classList.toggle('error', error);
  if (html) $('lt-mensaje').innerHTML = texto; else $('lt-mensaje').textContent = texto;
}

function aplicaTema() {
  document.body.className = 'tema-' + tema;
  $('lt-tema').title = `Tema: ${tema} (cambiar)`;
}

async function datosLibro() {
  const r = await fetch('/api/solicitud', { credentials: 'same-origin' });
  if (r.status === 401) return { sinSesion: true };
  const d = await r.json();
  return { titulo: d.libros?.[libro]?.titulo, sol: d.solicitudes?.[libro] || null };
}

function dedicatoria(titulo, sol) {
  if (!sol || !(sol.dedicatoria || sol.firma)) return;
  $('lt-ded-libro').textContent = titulo;
  $('lt-ded-para').textContent = 'Para ' + (sol.nombre || 'ti');
  $('lt-ded-texto').textContent = sol.dedicatoria || '';
  if (sol.firma) { $('lt-ded-firma').src = sol.firma; $('lt-ded-firma').hidden = false; }
  if (sol.dedicadaEn) { const d = new Date(sol.dedicadaEn); $('lt-ded-fecha').textContent = `Ciudad de México, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; }
  $('lt-dedicatoria').hidden = false;
}

function calculaEscala() {
  if (modoAncho) {
    const disp = Math.min(escena.clientWidth - 24, 980);
    escala = Math.max(0.3, disp / base.w);
  }
  $('lt-zoom').textContent = Math.round(escala * 100) + '%';
}

function maqueta() {
  calculaEscala();
  for (const p of paginas) {
    const w = (p.w || base.w) * escala, h = (p.h || base.h) * escala;
    p.el.style.width = w + 'px';
    p.el.style.height = h + 'px';
  }
  for (const [n, c] of renderizadas) { c.remove(); renderizadas.delete(n); paginas[n - 1].tarea?.cancel?.(); paginas[n - 1].tarea = null; }
  revisaVisibles();
}

function creaPaginas(total) {
  const frag = document.createDocumentFragment();
  paginas = [];
  for (let i = 1; i <= total; i++) {
    const el = document.createElement('div');
    el.className = 'lt-pagina';
    el.dataset.n = i;
    el.innerHTML = `<span class="num">${i}</span>`;
    frag.appendChild(el);
    paginas.push({ n: i, el, w: null, h: null });
  }
  cont.appendChild(frag);
  marcaVisual();
}

let cola = Promise.resolve();
function renderiza(n) {
  const p = paginas[n - 1];
  if (!p || renderizadas.has(n) || p.pendiente) return;
  p.pendiente = true;
  cola = cola.then(async () => {
    try {
      if (!visibleCerca(p.el)) return;
      const pag = await pdf.getPage(n);
      const vp1 = pag.getViewport({ scale: 1 });
      if (p.w !== vp1.width || p.h !== vp1.height) {
        p.w = vp1.width; p.h = vp1.height;
        p.el.style.width = p.w * escala + 'px';
        p.el.style.height = p.h * escala + 'px';
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = pag.getViewport({ scale: escala * dpr });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      p.tarea = pag.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp });
      await p.tarea.promise;
      p.tarea = null;
      p.el.prepend(c);
      renderizadas.set(n, c);
      libera();
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') console.warn(e);
    } finally { p.pendiente = false; }
  });
}

function visibleCerca(el) {
  const r = el.getBoundingClientRect();
  const margen = innerHeight * 1.5;
  return r.bottom > -margen && r.top < innerHeight + margen;
}
function libera() {
  if (renderizadas.size <= 14) return;
  for (const [n, c] of renderizadas) {
    if (!visibleCerca(paginas[n - 1].el)) { c.remove(); renderizadas.delete(n); }
    if (renderizadas.size <= 10) break;
  }
}
function revisaVisibles() {
  if (!pdf) return;
  // Primero la página actual y luego sus vecinas, alternando hacia abajo y hacia arriba.
  for (const d of [0, 1, -1, 2, -2, 3, 4, -3]) {
    const i = actual + d;
    if (i >= 1 && i <= paginas.length && visibleCerca(paginas[i - 1].el)) renderiza(i);
  }
}

function paginaActual() {
  const centro = escena.getBoundingClientRect().top + escena.clientHeight * 0.35;
  let lo = 0, hi = paginas.length - 1, res = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = paginas[mid].el.getBoundingClientRect();
    if (r.top <= centro) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res + 1;
}

let tic = null;
function alDesplazar() {
  if (!pdf) return;
  const n = paginaActual();
  if (n !== actual) {
    actual = n;
    if (document.activeElement !== $('lt-num')) $('lt-num').value = n;
    $('lt-marca').setAttribute('aria-pressed', String(estado.marcas.includes(n)));
    estado.pagina = n; guarda(CLAVE, estado);
  }
  revisaVisibles();
  clearTimeout(tic);
  tic = setTimeout(revisaVisibles, 120);
}

function ir(n, suave = false) {
  n = Math.max(1, Math.min(paginas.length, n | 0));
  const el = paginas[n - 1]?.el;
  if (!el) return;
  escena.scrollTo({ top: el.offsetTop - 12, behavior: suave ? 'smooth' : 'auto' });
  actual = n; $('lt-num').value = n;
  estado.pagina = n; guarda(CLAVE, estado);
  $('lt-marca').setAttribute('aria-pressed', String(estado.marcas.includes(n)));
  requestAnimationFrame(alDesplazar);
}

function zoom(nuevo) {
  const n = actual;
  const r = paginas[n - 1].el.getBoundingClientRect();
  const fr = (escena.getBoundingClientRect().top - r.top) / r.height;
  modoAncho = nuevo === 'ancho';
  if (!modoAncho) escala = Math.min(4, Math.max(0.3, nuevo));
  estado.zoom = modoAncho ? null : escala; guarda(CLAVE, estado);
  maqueta();
  const el = paginas[n - 1].el;
  escena.scrollTop = el.offsetTop + fr * el.offsetHeight;
  alDesplazar();
}

function marcaVisual() {
  for (const p of paginas) p.el.classList.toggle('marcada', estado.marcas.includes(p.n));
  $('lt-marca').setAttribute('aria-pressed', String(estado.marcas.includes(actual)));
  $('lt-marcas').innerHTML = estado.marcas.length
    ? estado.marcas.sort((a, b) => a - b).map((n) => `<a href="#" data-ir="${n}">Página ${n}<span>Ir →</span></a>`).join('')
    : '<p>Aún no tienes marcadores. Usa 🔖 en la barra para marcar la página que estás leyendo.</p>';
}

async function indice() {
  const caja = $('lt-indice');
  let items = [];
  try {
    const outline = await pdf.getOutline();
    const aplana = async (lista, nivel) => {
      for (const it of lista || []) {
        let pag = null;
        try {
          const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest;
          if (dest) pag = (await pdf.getPageIndex(dest[0])) + 1;
        } catch {}
        items.push({ t: it.title, n: pag, nivel });
        if (nivel < 3) await aplana(it.items, nivel + 1);
      }
    };
    await aplana(outline, 1);
  } catch {}
  if (items.length) {
    caja.innerHTML = items.map((i) => `<a href="#" class="n${i.nivel}" ${i.n ? `data-ir="${i.n}"` : ''}>${escapa(i.t)}<span>${i.n || ''}</span></a>`).join('');
  } else {
    const total = paginas.length, paso = total > 200 ? 25 : 10;
    let html = '<p>Este libro no trae índice interno. Salta por secciones:</p>';
    for (let i = 1; i <= total; i += paso) html += `<a href="#" data-ir="${i}">Páginas ${i}–${Math.min(total, i + paso - 1)}<span>${i}</span></a>`;
    caja.innerHTML = html;
  }
}
const escapa = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function panel(abrir) {
  const l = $('lt-lateral');
  const ab = abrir ?? l.hidden;
  l.hidden = !ab;
  $('lt-panel').setAttribute('aria-expanded', String(ab));
}

async function inicia() {
  aplicaTema();
  if (!libro) return mensaje('No se indicó qué libro abrir.', true);
  $('lt-descargar').href = `/api/descarga?libro=${encodeURIComponent(libro)}`;
  let info;
  try { info = await datosLibro(); } catch { info = {}; }
  if (info.sinSesion) return mensaje('Inicia sesión para leer tus libros. <a href="/cuenta.html">Ir a mi cuenta</a>', true, true);
  const titulo = info.titulo || 'Libro';
  document.title = `${titulo} · Lector`;
  $('lt-titulo').textContent = titulo;
  dedicatoria(titulo, info.sol);

  const tarea = pdfjs.getDocument({ url: `/api/descarga?libro=${encodeURIComponent(libro)}&modo=leer`, withCredentials: true, disableRange: true, isEvalSupported: false });
  tarea.onProgress = ({ loaded, total }) => {
    const pct = total ? Math.min(100, (loaded / total) * 100) : 0;
    $('lt-progreso').style.width = pct + '%';
    mensaje(total ? `Abriendo el libro… ${Math.round(pct)}%` : 'Abriendo el libro…');
  };
  try {
    pdf = await tarea.promise;
  } catch (e) {
    const st = e?.status;
    if (st === 403) return mensaje('Tu solicitud todavía no está aprobada. Cuando Joel la valide podrás leer el libro aquí. <a href="/cuenta.html">Volver a mi cuenta</a>', true, true);
    if (st === 401) return mensaje('Inicia sesión para leer tus libros. <a href="/cuenta.html">Ir a mi cuenta</a>', true, true);
    if (st === 404) return mensaje('El archivo de este libro todavía no está disponible.', true);
    return mensaje('No se pudo abrir el libro. Revisa tu conexión e inténtalo de nuevo.', true);
  }
  $('lt-progreso').style.width = '100%';
  setTimeout(() => { $('lt-progreso').style.width = '0'; }, 600);
  $('lt-estado').hidden = true;
  const p1 = await pdf.getPage(1);
  const vp = p1.getViewport({ scale: 1 });
  base = { w: vp.width, h: vp.height };
  $('lt-total').textContent = pdf.numPages;
  creaPaginas(pdf.numPages);
  if (estado.zoom) { modoAncho = false; escala = estado.zoom; }
  maqueta();
  indice();
  const inicio = Math.min(estado.pagina || 1, pdf.numPages);
  if (inicio > 1) ir(inicio); else alDesplazar();
}

// Eventos
escena.addEventListener('scroll', alDesplazar, { passive: true });
addEventListener('resize', () => { if (pdf && modoAncho) zoom('ancho'); });
$('lt-ant').addEventListener('click', () => ir(actual - 1, true));
$('lt-sig').addEventListener('click', () => ir(actual + 1, true));
$('lt-num').addEventListener('change', (e) => ir(parseInt(e.target.value, 10) || 1));
$('lt-num').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('lt-mas').addEventListener('click', () => zoom(escala * 1.15));
$('lt-menos').addEventListener('click', () => zoom(escala / 1.15));
$('lt-zoom').addEventListener('click', () => zoom('ancho'));
$('lt-tema').addEventListener('click', () => { tema = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length]; guarda('lector:tema', tema); aplicaTema(); });
$('lt-panel').addEventListener('click', () => panel());
$('lt-pantalla').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
$('lt-marca').addEventListener('click', () => {
  const i = estado.marcas.indexOf(actual);
  if (i >= 0) estado.marcas.splice(i, 1); else estado.marcas.push(actual);
  guarda(CLAVE, estado); marcaVisual();
});
document.querySelector('.lt-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  document.querySelectorAll('.lt-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $('lt-indice').hidden = b.dataset.tab !== 'indice';
  $('lt-marcas').hidden = b.dataset.tab !== 'marcas';
});
$('lt-lateral').addEventListener('click', (e) => {
  const a = e.target.closest('[data-ir]'); if (!a) return;
  e.preventDefault(); ir(+a.dataset.ir);
  if (innerWidth < 900) panel(false);
});
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); ir(actual + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); ir(actual - 1); }
  else if (e.key === '+' || e.key === '=') zoom(escala * 1.15);
  else if (e.key === '-') zoom(escala / 1.15);
  else if (e.key === 'Home') ir(1);
  else if (e.key === 'End') ir(paginas.length);
  else if (e.key === 'Escape') panel(false);
});

inicia();
