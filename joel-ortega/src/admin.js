import { upload } from '@vercel/blob/client';

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
    const yo = await fetch('/api/auth').then((r) => r.json()).catch(() => ({}));
    muestraAcceso(yo.usuario);
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
          <td><span class="chip chip--${esc(s.estado)}">${esc(ESTADOS[s.estado] || s.estado)}</span><br><small>${fecha(s.actualizada)}</small></td>
          <td><div class="acciones" data-q="${esc(q)}">
            ${s.estado !== 'aprobada' ? `<button class="si" data-estado="aprobada">Aprobar y compartir</button>` : `<a href="mailto:${esc(s.correo)}?subject=${asunto}&body=${cuerpo}">Avisar por correo</a>`}
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
    return `<p style="margin:0 0 4px"><b>${esc(l.titulo)}:</b> ${a.length ? `${esc(a[0].pathname.split('/').pop())} · ${kb(a[0].size)} · ${fecha(a[0].subido)} <a class="enlace" href="/api/descarga?libro=${encodeURIComponent(id)}">Probar descarga</a>` : '<span style="color:var(--rojo-700)">sin archivo todavía</span>'}</p>`;
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
  if (e.target.id === 'salir') { await fetch('/api/auth?accion=salir', { method: 'POST' }); location.href = '/'; }
});

let sesionActual = null;
function muestraAcceso(u) {
  sesionActual = u || null;
  $('acceso-admin').hidden = false;
  $('cab-texto').textContent = 'Acceso solo para administración.';
  const aviso = $('aa-aviso');
  if (u?.adminPendiente) {
    aviso.innerHTML = `Sesión iniciada como <b>${esc(u.correo)}</b>. Solo falta la clave de administración.`;
    $('aa-cuenta').hidden = true; $('aa-pass-wrap').hidden = true;
    $('aa-clave').focus();
  } else if (u) {
    aviso.innerHTML = `Tienes sesión como <b>${esc(u.correo)}</b>, que <b>no</b> está en la lista de administradores (variable ADMIN_EMAILS). Entra con el correo de administrador:`;
    $('aa-cuenta').hidden = false; $('aa-pass-wrap').hidden = false;
  } else {
    aviso.textContent = 'Escribe tu correo y contraseña de administrador y la clave de administración.';
    $('aa-cuenta').hidden = false; $('aa-pass-wrap').hidden = false;
  }
}

$('form-admin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const st = $('aa-estado');
  st.className = 'estado'; st.textContent = 'Verificando…';
  try {
    if (!sesionActual?.adminPendiente) {
      await api('/api/auth?accion=entrar', { method: 'POST', body: JSON.stringify({ correo: $('aa-correo').value, contrasena: $('aa-pass').value }) });
      const yo = await fetch('/api/auth').then((r) => r.json());
      if (!yo.usuario?.adminPendiente && !yo.usuario?.admin) {
        muestraAcceso(yo.usuario);
        st.textContent = 'La contraseña es correcta, pero ese correo no está en ADMIN_EMAILS.';
        return;
      }
      sesionActual = yo.usuario;
    }
    await api('/api/auth?accion=clave', { method: 'POST', body: JSON.stringify({ clave: $('aa-clave').value }) });
    st.textContent = '';
    $('aa-clave').value = ''; $('aa-pass').value = '';
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
