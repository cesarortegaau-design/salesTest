// Estado de sesión en la barra: avatar con nombre y menú (Mis libros, Mi perfil, Panel, Salir) o botón Entrar.
(function () {
  var hueco = document.querySelector('[data-sesion]');
  var estado = { listo: false, usuario: null, admin: false };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function iniciales(u) {
    var base = (u.nombre || u.correo.split('@')[0]).trim();
    var p = base.split(/[\s._-]+/).filter(Boolean);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function pinta() {
    if (!hueco) return;
    var u = estado.usuario;
    if (!u) {
      hueco.innerHTML = estado.admin
        ? '<a class="btn btn--rojo btn--sm" href="/admin.html">Panel de Joel</a>'
        : '<button class="btn btn--rojo btn--sm" type="button" data-acceso="entrar">Entrar</button>';
      return;
    }
    var nombre = u.nombre ? u.nombre.split(' ')[0] : u.correo.split('@')[0];
    hueco.innerHTML =
      '<div class="perfil-menu">' +
        '<button type="button" class="perfil-btn" aria-haspopup="true" aria-expanded="false" title="' + esc(u.correo) + '">' +
          '<span class="avatar">' + esc(iniciales(u)) + '</span><span class="perfil-nombre">' + esc(nombre) + '</span><span aria-hidden="true">▾</span>' +
        '</button>' +
        '<div class="perfil-lista" role="menu" hidden>' +
          '<div class="perfil-cab"><b>' + esc(u.nombre || nombre) + '</b><small>' + esc(u.correo) + '</small></div>' +
          '<a role="menuitem" href="/cuenta.html#libros">Mis libros</a>' +
          '<a role="menuitem" href="/cuenta.html#perfil">Mi perfil</a>' +
          (estado.admin ? '<a role="menuitem" href="/admin.html">Panel de Joel</a>' : '') +
          '<button role="menuitem" type="button" data-salir>Cerrar sesión</button>' +
        '</div>' +
      '</div>';
  }
  function refresca() {
    return fetch('/api/auth', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (d) {
      estado.listo = true;
      estado.usuario = d.usuario || null;
      estado.admin = !!(d.admin || (d.usuario && d.usuario.admin));
      pinta();
      document.dispatchEvent(new CustomEvent('sesion', { detail: estado }));
      return estado;
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.perfil-btn');
    var lista = hueco && hueco.querySelector('.perfil-lista');
    if (b && lista) {
      var abrir = lista.hidden;
      lista.hidden = !abrir;
      b.setAttribute('aria-expanded', String(abrir));
      return;
    }
    if (lista && !e.target.closest('.perfil-menu')) { lista.hidden = true; }
    if (e.target.closest('[data-salir]')) {
      fetch('/api/auth?accion=salir', { method: 'POST' }).then(function () { location.href = '/'; });
    }
  });
  document.addEventListener('keydown', function (e) {
    var lista = hueco && hueco.querySelector('.perfil-lista');
    if (e.key === 'Escape' && lista && !lista.hidden) { lista.hidden = true; hueco.querySelector('.perfil-btn').focus(); }
  });
  window.sesionJO = { estado: estado, refresca: refresca, promesa: null };
  // Aviso breve tras entrar o crear cuenta
  window.avisoJO = function (texto) {
    var t = document.createElement('div');
    t.className = 'aviso-flotante'; t.setAttribute('role', 'status'); t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('fuera'); }, 2600);
    setTimeout(function () { t.remove(); }, 3200);
  };
  window.sesionJO.promesa = refresca();
})();
