// Panel de firma a mano: trazo suave con grosor según velocidad y presión, deshacer, limpiar y exportar PNG recortado.
export class PanelFirma {
  constructor(canvas, { tinta = '#14215a' } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.tinta = tinta;
    this.trazos = [];
    this.actual = null;
    this.alCambiar = () => {};
    this._ajusta = this._ajusta.bind(this);
    new ResizeObserver(this._ajusta).observe(canvas);
    this._ajusta();
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this._inicio(e));
    canvas.addEventListener('pointermove', (e) => this._mueve(e));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => canvas.addEventListener(t, () => this._fin()));
  }
  _ajusta() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (!r.width) return;
    this.c.width = Math.round(r.width * dpr);
    this.c.height = Math.round(r.height * dpr);
    this.esc = dpr;
    this.redibuja();
  }
  _punto(e) {
    const r = this.c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now(), p: e.pressure && e.pointerType === 'pen' ? e.pressure : 0.5 };
  }
  _inicio(e) {
    e.preventDefault();
    this.c.setPointerCapture?.(e.pointerId);
    this.actual = { tinta: this.tinta, puntos: [this._punto(e)] };
    this.trazos.push(this.actual);
    this.redibuja();
  }
  _mueve(e) {
    if (!this.actual) return;
    const pts = (e.getCoalescedEvents?.() || [e]).map((ev) => this._punto(ev));
    this.actual.puntos.push(...pts);
    this.redibuja();
  }
  _fin() {
    if (!this.actual) return;
    this.actual = null;
    this.alCambiar();
  }
  _ancho(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const v = d / Math.max(1, b.t - a.t);
    const base = 3.2 - Math.min(2.1, v * 1.4);
    return Math.max(1.1, base * (0.6 + b.p * 0.8));
  }
  dibujaTrazos(ctx, esc, trazos) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const tr of trazos) {
      const p = tr.puntos;
      ctx.strokeStyle = ctx.fillStyle = tr.tinta;
      if (p.length === 1) {
        ctx.beginPath(); ctx.arc(p[0].x * esc, p[0].y * esc, 1.6 * esc, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      let w = this._ancho(p[0], p[1]);
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i];
        const nuevo = this._ancho(a, b);
        w = w * 0.7 + nuevo * 0.3;
        const m1 = i > 1 ? { x: (p[i - 2].x + a.x) / 2, y: (p[i - 2].y + a.y) / 2 } : a;
        const m2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = w * esc;
        ctx.beginPath();
        ctx.moveTo(m1.x * esc, m1.y * esc);
        ctx.quadraticCurveTo(a.x * esc, a.y * esc, m2.x * esc, m2.y * esc);
        ctx.stroke();
      }
    }
  }
  redibuja() {
    const { ctx, c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    this.dibujaTrazos(ctx, this.esc || 1, this.trazos);
  }
  deshaz() { this.trazos.pop(); this.redibuja(); this.alCambiar(); }
  limpia() { this.trazos = []; this.redibuja(); this.alCambiar(); }
  vacia() { return !this.trazos.some((t) => t.puntos.length > 1); }
  // PNG transparente, recortado al área firmada, a 2x para buena nitidez en el PDF.
  png() {
    if (this.vacia()) return '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of this.trazos) for (const p of t.puntos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const pad = 8, esc = 2;
    const w = Math.ceil(x1 - x0 + pad * 2), h = Math.ceil(y1 - y0 + pad * 2);
    const out = document.createElement('canvas');
    out.width = w * esc; out.height = h * esc;
    const ctx = out.getContext('2d');
    ctx.translate((-x0 + pad) * esc, (-y0 + pad) * esc);
    this.dibujaTrazos(ctx, esc, this.trazos);
    return out.toDataURL('image/png');
  }
}
