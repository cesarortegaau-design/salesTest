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
  // Menú para celular: se arma con los enlaces de la barra.
  var nav = document.querySelector('.barra__nav');
  var ligas = nav ? [].slice.call(nav.querySelectorAll('ul li.sec a')) : [];
  if (nav && ligas.length) {
    var barra = nav.closest('.barra');
    var boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'barra__menu';
    boton.setAttribute('aria-label', 'Menú'); boton.setAttribute('aria-expanded', 'false');
    boton.innerHTML = '<i></i><i></i><i></i>';
    nav.appendChild(boton);
    var panel = document.createElement('div');
    panel.className = 'menu-movil'; panel.hidden = true;
    ligas.forEach(function (a) { var c = a.cloneNode(true); c.removeAttribute('id'); if (a.hidden) c.hidden = true; panel.appendChild(c); });
    barra.appendChild(panel);
    var abre = function (v) { panel.hidden = !v; boton.setAttribute('aria-expanded', String(v)); barra.classList.toggle('barra--abierta', v); };
    boton.addEventListener('click', function () { abre(panel.hidden); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) abre(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { abre(false); boton.focus(); } });
    document.addEventListener('sesion', function () { panel.querySelectorAll('a[href="#perfil"]').forEach(function (a) { a.hidden = !estado.usuario; }); });
  }
  // Botón fijo "Pedir el libro": aparece al pasar la portada.
  var fijo = document.getElementById('pedir-fijo');
  if (fijo) {
    var ve = function () { fijo.hidden = scrollY < innerHeight * 0.8; };
    addEventListener('scroll', ve, { passive: true }); ve();
  }
  window.sesionJO.promesa = refresca();
})();
