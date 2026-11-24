(function () {
  var PORTADAS = { semblanzas: 'p3', 'diez-de-junio': 'p1', 'adios-al-68': 'p2' };
  var DESCR = {
    semblanzas: 'Nuevo libro. Medio centenar de retratos de militantes de las izquierdas y de algunos hombres del poder.',
    'diez-de-junio': 'Ajuste con el echeverrismo de entonces y ahora. Laberinto Ediciones, 2021.',
    'adios-al-68': 'Ensayo a contracorriente a medio siglo del movimiento estudiantil. Grijalbo, 2018.',
  };
  var ESTADOS = {
    solicitada: ['Solicitada', 'Joel revisará tu solicitud. Si cooperaste, sube tu comprobante para agilizarla.'],
    por_validar: ['Comprobante por validar', 'Recibimos tu comprobante. Joel lo validará y te compartirá el libro.'],
    aprobada: ['Aprobada', '¡Listo! Joel te compartió este libro.'],
    rechazada: ['No aprobada', 'Joel no pudo validar tu solicitud. Revisa su mensaje o sube otro comprobante.'],
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fecha = function (iso) { try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  var preferido = new URLSearchParams(location.search).get('libro');

  async function carga() {
    var me = await fetch('/api/auth').then(function (r) { return r.json(); }).catch(function () { return {}; });
    if (!me.usuario) {
      document.getElementById('saludo').textContent = 'Entra para cooperar, enviar tu comprobante y descargar los libros que Joel te comparta.';
      document.getElementById('sin-sesion').hidden = false;
      return;
    }
    var u = me.usuario;
    document.getElementById('saludo').textContent = 'Hola' + (u.nombre ? ', ' + u.nombre : '') + '. Sesión iniciada como ' + u.correo + '.';
    document.getElementById('liga-perfil').hidden = false;
    document.getElementById('p-correo').value = u.correo;
    document.getElementById('p-nombre').value = u.nombre || '';
    document.getElementById('con-sesion').hidden = false;
    var d = await fetch('/api/solicitud').then(function (r) { return r.json(); });
    pintaAjustes(d.ajustes);
    pintaLibros(d.libros, d.solicitudes || {}, d.ajustes);
  }

  function pintaAjustes(a) {
    document.getElementById('c-nota').textContent = a.nota || '';
    var filas = [
      ['Monto sugerido', a.montoSugerido ? '$' + Number(a.montoSugerido).toLocaleString('es-MX') + ' MXN' : 'Lo que puedas'],
      ['Banco', a.banco], ['Titular', a.titular], ['CLABE', a.clabe], ['Cuenta / tarjeta', a.cuenta], ['Concepto', a.concepto],
    ].filter(function (f) { return f[1]; });
    var dl = document.getElementById('c-datos');
    dl.innerHTML = filas.map(function (f) {
      var copiable = f[0] === 'CLABE' || f[0] === 'Cuenta / tarjeta';
      return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + (copiable ? '<button class="copiar" type="button" data-copiar="' + esc(f[1]) + '">Copiar</button>' : '') + '</dd>';
    }).join('');
    if (!a.clabe && !a.cuenta) dl.insertAdjacentHTML('beforeend', '<dt>Datos</dt><dd>Joel publicará aquí los datos de transferencia muy pronto. Mientras, solicita tu libro.</dd>');
  }

  function pintaLibros(libros, sols, a) {
    var ids = Object.keys(libros);
    if (preferido && libros[preferido]) ids.sort(function (x, y) { return (y === preferido) - (x === preferido); });
    document.getElementById('lista-libros').innerHTML = ids.map(function (id) {
      var L = libros[id], s = sols[id], e = s ? ESTADOS[s.estado] || ESTADOS.solicitada : null;
      var cab = '<div class="fila-libro"><div class="portada ' + (PORTADAS[id] || 'p1') + '" aria-hidden="true"><span class="t">' + esc(L.titulo) + '</span><span class="a">J. Ortega</span></div><div>' +
        (L.nuevo ? '<span class="chip" style="background:var(--rojo);color:#fff">Nuevo</span> ' : '') +
        (s ? '<span class="chip chip--' + esc(s.estado) + '">' + esc(e[0]) + '</span>' : '') +
        '<h3 style="margin-top:10px">' + esc(L.titulo) + '</h3><p style="margin:0 0 8px">' + esc(DESCR[id] || '') + '</p>';
      var cuerpo = '';
      if (s) {
        cuerpo += '<p class="ayuda">' + esc(e[1]) + ' · Actualizada el ' + fecha(s.actualizada) + (s.comprobante ? ' · Comprobante: ' + esc(s.comprobante.nombre) : '') + (s.monto ? ' · Cooperación: $' + Number(s.monto).toLocaleString('es-MX') : '') + '</p>';
        if (s.mensajeJoel) cuerpo += '<p style="border-left:4px solid var(--rojo);padding:8px 12px;background:var(--papel);margin:10px 0"><b>Joel:</b> ' + esc(s.mensajeJoel) + '</p>';
        if (s.estado === 'aprobada') {
          if (s.dedicatoria || s.firma) {
            cuerpo += '<div class="dedicatoria"><small>Dedicatoria de Joel</small>' +
              (s.dedicatoria ? '<p class="manuscrita">' + esc(s.dedicatoria) + '</p>' : '') +
              (s.firma ? '<img src="' + esc(s.firma) + '" alt="Firma de Joel Ortega Juárez">' : '') +
              '<span>Joel Ortega Juárez' + (s.dedicadaEn ? ' · ' + fecha(s.dedicadaEn) : '') + '</span></div>';
          }
          cuerpo += s.descargable
            ? '<div class="acciones-libro"><a class="btn btn--rojo" href="/leer.html?libro=' + encodeURIComponent(id) + '">Leer en la plataforma</a>' +
              '<a class="btn btn--linea" href="/api/descarga?libro=' + encodeURIComponent(id) + '">Descargar PDF' + (s.dedicatoria || s.firma ? ' dedicado' : '') + '</a></div>'
            : '<p class="ayuda">Joel está preparando el archivo. Vuelve pronto para leerlo.</p>';
        }
      }
      var muestraForm = !s || s.estado !== 'aprobada';
      if (muestraForm) {
        cuerpo += '<form class="form-sol" data-libro="' + esc(id) + '" style="display:grid;gap:12px;margin-top:14px;max-width:620px">' +
          '<div class="rejilla-2" style="gap:12px"><div><label for="m-' + id + '">Cooperación (MXN)</label><input id="m-' + id + '" name="monto" inputmode="decimal" placeholder="' + (a.montoSugerido || '') + '" value="' + (s && s.monto ? esc(s.monto) : '') + '"></div>' +
          '<div><label for="r-' + id + '">Referencia o folio</label><input id="r-' + id + '" name="referencia" value="' + (s ? esc(s.referencia) : '') + '"></div></div>' +
          '<div><label for="f-' + id + '">Comprobante de transferencia</label><input id="f-' + id + '" name="comprobante" type="file" accept="image/*,application/pdf"><p class="ayuda">Foto o PDF, máximo 4 MB. Opcional si no cooperaste.</p></div>' +
          '<div><label for="n-' + id + '">Mensaje para Joel (opcional)</label><textarea id="n-' + id + '" name="nota" style="min-height:80px">' + (s ? esc(s.nota) : '') + '</textarea></div>' +
          '<div><button class="btn btn--negro" type="submit">' + (s ? 'Actualizar solicitud' : 'Solicitar este libro') + '</button></div>' +
          '<p class="estado" role="status"></p></form>';
      }
      return '<article class="tarjeta" id="libro-' + esc(id) + '">' + cab + cuerpo + '</div></div></article>';
    }).join('');
    if (preferido && document.getElementById('libro-' + preferido)) document.getElementById('libro-' + preferido).scrollIntoView({ block: 'start' });
  }

  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('.form-sol');
    if (!f) return;
    e.preventDefault();
    var st = f.querySelector('.estado'), btn = f.querySelector('button[type=submit]');
    var arch = f.querySelector('input[type=file]').files[0];
    if (arch && arch.size > 4 * 1024 * 1024) { st.textContent = 'El comprobante pesa más de 4 MB.'; return; }
    var fd = new FormData(f); fd.append('libro', f.dataset.libro);
    if (!arch) fd.delete('comprobante');
    btn.disabled = true; st.className = 'estado'; st.textContent = 'Enviando…';
    try {
      var r = await fetch('/api/solicitud', { method: 'POST', body: fd });
      var d = await r.json();
      if (!r.ok) { st.textContent = d.error || 'No se pudo enviar.'; return; }
      preferido = f.dataset.libro;
      await carga();
      var nuevo = document.querySelector('#libro-' + preferido + ' .estado');
      if (nuevo) { nuevo.className = 'estado ok'; nuevo.textContent = 'Solicitud enviada. Joel la revisará.'; }
    } catch (err) { st.textContent = 'Sin conexión. Intenta de nuevo.'; }
    finally { btn.disabled = false; }
  });

  document.addEventListener('click', async function (e) {
    var c = e.target.closest('[data-copiar]');
    if (c) { try { await navigator.clipboard.writeText(c.dataset.copiar); c.textContent = 'Copiado'; } catch (err) {} }

  });

  async function perfil(datos, st) {
    st.className = 'estado'; st.textContent = 'Guardando…';
    try {
      var r = await fetch('/api/auth?accion=perfil', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) });
      var d = await r.json();
      if (!r.ok) { st.textContent = d.error || 'No se pudo guardar.'; return null; }
      st.className = 'estado ok';
      return d;
    } catch (e) { st.textContent = 'Sin conexión. Intenta de nuevo.'; return null; }
  }
  document.getElementById('form-perfil').addEventListener('submit', async function (e) {
    e.preventDefault();
    var st = document.getElementById('p-estado');
    var d = await perfil({ nombre: document.getElementById('p-nombre').value }, st);
    if (d) { st.textContent = 'Nombre guardado.'; if (window.sesionJO) window.sesionJO.refresca(); document.getElementById('saludo').textContent = 'Hola' + (d.usuario.nombre ? ', ' + d.usuario.nombre : '') + '. Sesión iniciada como ' + d.usuario.correo + '.'; }
  });
  document.getElementById('form-pass').addEventListener('submit', async function (e) {
    e.preventDefault();
    var st = document.getElementById('pp-estado');
    var nueva = document.getElementById('p-nueva').value;
    if (nueva.length < 8) { st.className = 'estado'; st.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'; return; }
    var d = await perfil({ actual: document.getElementById('p-actual').value, nueva: nueva }, st);
    if (d) { st.textContent = 'Contraseña actualizada.'; e.target.reset(); }
  });

  carga();
})();
