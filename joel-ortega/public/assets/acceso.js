// Modal de registro / acceso.
// - Si ya hay sesión, los botones no vuelven a pedir datos: llevan directo a lo que querías.
// - Al entrar se queda en la página (la barra muestra tu nombre); solo si pediste un libro te lleva a él.
// - Recuerda tu correo en este dispositivo y abre directo en "Entrar".
(function () {
  var modal = document.getElementById('acceso');
  if (!modal) return;
  var form = document.getElementById('form-acceso');
  var estado = document.getElementById('a-estado');
  var enviar = document.getElementById('a-enviar');
  var pass = document.getElementById('a-pass');
  var correoIn = document.getElementById('a-correo');
  var modo = 'registro', libro = null, previo = null;
  var CLAVE_CORREO = 'jo:correo';
  var correoGuardado = function () { try { return localStorage.getItem(CLAVE_CORREO) || ''; } catch (e) { return ''; } };
  var recuerda = function (c) { try { localStorage.setItem(CLAVE_CORREO, c); } catch (e) {} };

  function ponModo(m) {
    modo = m;
    modal.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === m)); });
    modal.querySelectorAll('[data-solo="registro"]').forEach(function (el) { el.hidden = m !== 'registro'; });
    modal.querySelectorAll('[data-solo="entrar"]').forEach(function (el) { el.hidden = m !== 'entrar'; });
    enviar.textContent = m === 'registro' ? 'Crear cuenta' : 'Entrar';
    pass.setAttribute('autocomplete', m === 'registro' ? 'new-password' : 'current-password');
    estado.textContent = '';
  }
  function abre(m) {
    previo = document.activeElement;
    var guardado = correoGuardado();
    // Si este dispositivo ya conoce tu correo, abre en "Entrar" con el correo listo: solo falta la contraseña.
    ponModo(guardado ? 'entrar' : (m || 'registro'));
    if (guardado && !correoIn.value) correoIn.value = guardado;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // Solo se enfoca el correo cuando está vacío: no se toca el campo de contraseña,
    // para no interferir con el gestor de contraseñas del navegador.
    if (!correoIn.value) setTimeout(function () { correoIn.focus(); }, 30);
  }
  function cierra() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (previo) previo.focus();
  }
  // Ver/ocultar contraseña y aviso de mayúsculas
  var envoltura = document.createElement('div');
  envoltura.className = 'pass-wrap';
  pass.parentNode.insertBefore(envoltura, pass);
  envoltura.appendChild(pass);
  var ojo = document.createElement('button');
  ojo.type = 'button'; ojo.className = 'pass-ojo'; ojo.textContent = 'Ver';
  ojo.setAttribute('aria-label', 'Mostrar contraseña'); ojo.setAttribute('aria-pressed', 'false');
  envoltura.appendChild(ojo);
  ojo.addEventListener('click', function () {
    var ver = pass.type === 'password';
    pass.type = ver ? 'text' : 'password';
    ojo.textContent = ver ? 'Ocultar' : 'Ver';
    ojo.setAttribute('aria-pressed', String(ver));
    ojo.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    pass.focus();
  });
  var mayus = document.createElement('p');
  mayus.className = 'ayuda pass-mayus'; mayus.hidden = true; mayus.textContent = 'Bloq Mayús está activado.';
  envoltura.parentNode.insertBefore(mayus, envoltura.nextSibling);
  pass.addEventListener('keyup', function (e) { if (e.getModifierState) mayus.hidden = !e.getModifierState('CapsLock'); });
  pass.addEventListener('input', function () { if (estado.className === 'estado') estado.textContent = ''; });

  var olvido = document.createElement('p');
  olvido.className = 'ayuda'; olvido.setAttribute('data-solo', 'entrar');
  olvido.textContent = '¿Olvidaste tu contraseña? Pídele a Joel una contraseña temporal y cámbiala después en Mi perfil.';
  form.appendChild(olvido);

  function sesionActiva() { return !!(window.sesionJO && window.sesionJO.estado.usuario); }
  function irA() { return libro ? '/cuenta.html?libro=' + encodeURIComponent(libro) : '/cuenta.html'; }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acceso]');
    if (b) {
      e.preventDefault();
      libro = b.dataset.libro || null;
      var decide = function () { if (sesionActiva()) location.href = irA(); else abre(b.dataset.acceso); };
      // Si la sesión aún se está verificando, espera un instante en vez de pedir datos de nuevo.
      if (window.sesionJO && !window.sesionJO.estado.listo && window.sesionJO.promesa) window.sesionJO.promesa.then(decide);
      else decide();
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
    datos.correo = (datos.correo || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) { estado.textContent = 'Escribe un correo electrónico válido.'; return; }
    if ((datos.contrasena || '').length < 8) { estado.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
    enviar.disabled = true; estado.className = 'estado'; estado.textContent = modo === 'registro' ? 'Creando tu cuenta…' : 'Entrando…';
    try {
      var r = await fetch('/api/auth?accion=' + modo, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos), credentials: 'same-origin' });
      var d = await r.json();
      if (!r.ok) {
        if (r.status === 409) ponModo('entrar');
        estado.textContent = r.status === 401
          ? 'Correo o contraseña incorrectos. Usa "Ver" para revisar lo que escribiste.'
          : d.error || 'No se pudo continuar.';
        return;
      }
      recuerda(datos.correo);
      pass.value = '';
      var nombre = (d.usuario && (d.usuario.nombre || d.usuario.correo.split('@')[0])) || '';
      // Pidió un libro: llévalo a él. En Mi cuenta: recarga sus datos. En cualquier otra página: quédate ahí.
      if (libro) { location.href = irA(); return; }
      if (/\/cuenta(\.html)?$/.test(location.pathname)) { location.reload(); return; }
      cierra();
      if (window.sesionJO) await window.sesionJO.refresca();
      if (window.avisoJO) window.avisoJO((modo === 'registro' ? 'Cuenta creada. ¡Bienvenido, ' : '¡Hola de nuevo, ') + nombre + '!');
    } catch (err) {
      estado.textContent = 'Sin conexión. Intenta de nuevo.';
    } finally { enviar.disabled = false; }
  });
})();
