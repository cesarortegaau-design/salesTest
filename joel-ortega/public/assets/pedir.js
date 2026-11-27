// Pedido en una sola pantalla: libro + cuenta (entra o se crea sola) + cooperación y comprobante.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DESCR = { semblanzas: 'Nuevo · medio centenar de retratos', 'diez-de-junio': 'Laberinto, 2021', 'adios-al-68': 'Grijalbo, 2018' };
  var ESTADOS = { solicitada: 'ya la pediste', por_validar: 'comprobante en revisión', aprobada: 'ya es tuyo', rechazada: 'no aprobada' };
  var elegido = new URLSearchParams(location.search).get('libro');
  var usuario = null, datos = null;
  var api = function (url, opts) { return fetch(url, Object.assign({ credentials: 'same-origin' }, opts)).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); }); };

  async function carga() {
    var yo = await api('/api/auth');
    usuario = yo.d.usuario || null;
    datos = (await api('/api/solicitud?publico=1')).d;
    $('pd-con-sesion').hidden = !usuario; $('pd-sin-sesion').hidden = !!usuario;
    if (usuario) $('pd-correo-sesion').textContent = usuario.correo;
    else { try { $('pd-correo').value = localStorage.getItem('jo:correo') || ''; } catch (e) {} }
    var libros = datos.libros || {}, sols = datos.solicitudes || {};
    if (!libros[elegido]) elegido = Object.keys(libros)[0];
    $('pd-libros').innerHTML = Object.keys(libros).map(function (id) {
      var s = sols[id];
      return '<label class="opcion"><input type="radio" name="libro" value="' + esc(id) + '"' + (id === elegido ? ' checked' : '') + '><span><b>' + esc(libros[id].titulo) + '</b><small>' + esc(s ? 'Estado: ' + (ESTADOS[s.estado] || s.estado) : DESCR[id] || '') + '</small></span></label>';
    }).join('');
    var a = datos.ajustes || {};
    $('pd-nota').textContent = a.nota || '';
    $('pd-monto').placeholder = a.montoSugerido || '';
    var filas = [['Monto sugerido', a.montoSugerido ? '$' + Number(a.montoSugerido).toLocaleString('es-MX') + ' MXN' : ''], ['Banco', a.banco], ['Titular', a.titular], ['CLABE', a.clabe], ['Cuenta / tarjeta', a.cuenta], ['Concepto', a.concepto]].filter(function (f) { return f[1]; });
    $('pd-datos').innerHTML = filas.map(function (f) {
      var copia = f[0] === 'CLABE' || f[0] === 'Cuenta / tarjeta';
      return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + (copia ? '<button class="copiar" type="button" data-copiar="' + esc(f[1]) + '">Copiar</button>' : '') + '</dd>';
    }).join('') + (!a.clabe && !a.cuenta ? '<dt>Datos</dt><dd>Joel publicará aquí los datos de transferencia muy pronto. Puedes enviar tu solicitud desde ahora.</dd>' : '');
  }

  document.addEventListener('click', async function (e) {
    var c = e.target.closest('[data-copiar]');
    if (c) { try { await navigator.clipboard.writeText(c.dataset.copiar); c.textContent = 'Copiado'; } catch (err) {} }
    if (e.target.id === 'pd-ojo') {
      var p = $('pd-pass'), ver = p.type === 'password';
      p.type = ver ? 'text' : 'password'; e.target.textContent = ver ? 'Ocultar' : 'Ver'; e.target.setAttribute('aria-pressed', String(ver));
    }
  });

  $('form-pedir').addEventListener('submit', async function (e) {
    e.preventDefault();
    var st = $('pd-estado'), btn = $('pd-enviar');
    var falla = function (t, campo) { st.className = 'estado'; st.textContent = t; if (campo) campo.focus(); };
    var libro = (document.querySelector('input[name=libro]:checked') || {}).value;
    if (!libro) return falla('Elige un libro.');
    var arch = $('pd-archivo').files[0];
    if (arch && arch.size > 4 * 1024 * 1024) return falla('El comprobante pesa más de 4 MB.', $('pd-archivo'));
    var correo = $('pd-correo').value.trim(), pass = $('pd-pass').value, nombre = $('pd-nombre').value.trim();
    if (!usuario) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return falla('Escribe un correo electrónico válido.', $('pd-correo'));
      if (pass.length < 8) return falla('La contraseña debe tener al menos 8 caracteres.', $('pd-pass'));
    }
    btn.disabled = true; st.className = 'estado'; st.textContent = 'Enviando…';
    try {
      if (!usuario) {
        var json = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo: correo, contrasena: pass, nombre: nombre }) };
        var r = await api('/api/auth?accion=registro', json);
        if (r.status === 409) {
          r = await api('/api/auth?accion=entrar', json);
          if (!r.ok) return falla('Ya existe una cuenta con ese correo y la contraseña no coincide. Si la olvidaste, pídele a Joel una contraseña temporal.', $('pd-pass'));
        } else if (!r.ok) return falla(r.d.error || 'No se pudo crear la cuenta.');
        usuario = r.d.usuario;
        try { localStorage.setItem('jo:correo', correo); } catch (err) {}
        if (window.sesionJO) window.sesionJO.refresca();
        $('pd-con-sesion').hidden = false; $('pd-sin-sesion').hidden = true; $('pd-correo-sesion').textContent = usuario.correo;
      }
      var fd = new FormData();
      fd.append('libro', libro); fd.append('monto', $('pd-monto').value); fd.append('referencia', $('pd-ref').value); fd.append('nota', $('pd-msg').value);
      if (arch) fd.append('comprobante', arch);
      var s = await api('/api/solicitud', { method: 'POST', body: fd });
      if (!s.ok) return falla(s.d.error || 'No se pudo enviar la solicitud.');
      var sol = s.d.solicitud, titulo = datos.libros[libro].titulo;
      $('form-pedir').hidden = true; $('pd-listo').hidden = false;
      $('pd-listo-titulo').textContent = sol.estado === 'aprobada' ? 'Este libro ya es tuyo' : 'Recibimos tu solicitud';
      $('pd-listo-texto').textContent = sol.estado === 'aprobada'
        ? 'Ya puedes leer o descargar “' + titulo + '” desde tu cuenta.'
        : sol.comprobante
          ? 'Joel validará tu comprobante y te compartirá “' + titulo + '”. Lo verás en tu cuenta, listo para leer o descargar.'
          : 'Joel revisará tu solicitud de “' + titulo + '”. Si cooperas después, sube tu comprobante desde tu cuenta.';
      $('pd-listo').scrollIntoView({ block: 'center' });
    } catch (err) { falla('Sin conexión. Intenta de nuevo.'); }
    finally { btn.disabled = false; }
  });

  carga();
})();
