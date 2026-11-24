// Hero tipo carrusel, barra que se vuelve sólida, videos que se abren en su lugar y galería rotativa.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Barra
  var barra = document.getElementById('barra');
  function alBajar() { barra.classList.toggle('barra--solida', scrollY > innerHeight * 0.7); }
  addEventListener('scroll', alBajar, { passive: true }); alBajar();

  // Carrusel
  var reel = document.getElementById('reel');
  var laminas = [].slice.call(reel.querySelectorAll('.reel__lamina'));
  var cont = document.getElementById('reel-barras');
  var DUR = 8000, actual = 0, timer = null, pausa = false;
  laminas.forEach(function (l, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'reel__barra'; b.setAttribute('role', 'tab');
    b.innerHTML = '<span class="reel__pista"><i></i></span><small>' + l.dataset.titulo + '</small>';
    b.addEventListener('click', function () { ir(i); });
    cont.appendChild(b);
  });
  var barras = [].slice.call(cont.children);
  document.querySelector('.hero').style.setProperty('--dur', DUR + 'ms');
  function ir(i) {
    actual = (i + laminas.length) % laminas.length;
    laminas.forEach(function (l, k) {
      var on = k === actual;
      l.classList.toggle('reel__lamina--on', on);
      l.setAttribute('aria-hidden', String(!on));
      l.querySelectorAll('a,button').forEach(function (el) { el.tabIndex = on ? 0 : -1; });
      var b = barras[k];
      b.classList.remove('reel__barra--on'); b.classList.toggle('reel__barra--vista', k < actual);
      b.setAttribute('aria-selected', String(on));
    });
    void barras[actual].offsetWidth;
    barras[actual].classList.add('reel__barra--on');
    programa();
  }
  function programa() {
    clearTimeout(timer);
    if (reduce || pausa) return;
    timer = setTimeout(function () { ir(actual + 1); }, DUR);
  }
  var hero = document.querySelector('.hero');
  hero.addEventListener('mouseenter', function () { pausa = true; reel.classList.add('reel--pausa'); hero.classList.add('reel--pausa'); clearTimeout(timer); });
  hero.addEventListener('mouseleave', function () { pausa = false; hero.classList.remove('reel--pausa'); ir(actual); });
  document.querySelectorAll('[data-reel]').forEach(function (b) { b.addEventListener('click', function () { ir(actual + Number(b.dataset.reel)); }); });
  var x0 = null;
  hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1)); x0 = null; });
  ir(0);

  // Videos: se reproducen en su lugar
  document.addEventListener('click', function (e) {
    var v = e.target.closest('button.video[data-video], a.hito__media[data-video]');
    if (!v || v.querySelector('iframe')) return;
    e.preventDefault();
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + v.dataset.video + '?autoplay=1&rel=0';
    f.title = (v.querySelector('b') || {}).textContent || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    v.appendChild(f);
  });

  // Galería rotativa
  var show = [].slice.call(document.querySelectorAll('#galeria-show img'));
  if (show.length > 1 && !reduce) {
    var g = 0;
    setInterval(function () { show[g].classList.remove('on'); g = (g + 1) % show.length; show[g].classList.add('on'); }, 5000);
  }
})();
