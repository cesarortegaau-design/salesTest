// Modal de registro / acceso. Tras entrar, lleva a Mi cuenta (con el libro elegido).
(function () {
  var modal = document.getElementById('acceso');
  if (!modal) return;
  var form = document.getElementById('form-acceso');
  var estado = document.getElementById('a-estado');
  var enviar = document.getElementById('a-enviar');
  var pass = document.getElementById('a-pass');
  var modo = 'registro', libro = 'semblanzas', previo = null;

  function ponModo(m) {
    modo = m;
    modal.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === m)); });
    modal.querySelectorAll('[data-solo="registro"]').forEach(function (el) { el.hidden = m !== 'registro'; });
    enviar.textContent = m === 'registro' ? 'Crear cuenta' : 'Entrar';
    pass.setAttribute('autocomplete', m === 'registro' ? 'new-password' : 'current-password');
    estado.textContent = '';
  }
  function abre(m, l) {
    previo = document.activeElement;
    if (l) libro = l;
    ponModo(m || 'registro');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('a-correo').focus(); }, 30);
  }
  function cierra() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (previo) previo.focus();
  }
  function destino() { return '/cuenta.html?libro=' + encodeURIComponent(libro); }

  // Si ya hay sesión, los botones llevan directo a la cuenta.
  var conSesion = false;
  fetch('/api/auth', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
    conSesion = !!(d && d.usuario);
    if (conSesion) document.querySelectorAll('[data-cuenta]').forEach(function (a) { a.textContent = 'Mi cuenta'; });
  }).catch(function () {});

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acceso]');
    if (b) {
      e.preventDefault();
      if (b.dataset.libro) libro = b.dataset.libro;
      if (conSesion) { location.href = destino(); return; }
      abre(b.dataset.acceso, b.dataset.libro);
      return;
    }
    if (e.target.closest('[data-cerrar]') || e.target === modal) cierra();
    var t = e.target.closest('[data-tab]');
    if (t) ponModo(t.dataset.tab);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) cierra(); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var datos = Object.fromEntries(new FormData(form));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo || '')) { estado.textContent = 'Escribe un correo electrónico válido.'; return; }
    if ((datos.contrasena || '').length < 8) { estado.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
    enviar.disabled = true; estado.className = 'estado'; estado.textContent = modo === 'registro' ? 'Creando tu cuenta…' : 'Entrando…';
    try {
      var r = await fetch('/api/auth?accion=' + modo, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos), credentials: 'same-origin' });
      var d = await r.json();
      if (!r.ok) {
        estado.textContent = d.error || 'No se pudo continuar.';
        if (r.status === 409) ponModo('entrar'), (estado.textContent = d.error);
        return;
      }
      estado.className = 'estado ok'; estado.textContent = 'Listo. Abriendo tu cuenta…';
      location.href = destino();
    } catch (err) {
      estado.textContent = 'Sin conexión. Intenta de nuevo.';
    } finally { enviar.disabled = false; }
  });
})();
