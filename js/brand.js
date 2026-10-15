// ONLYDEMIR brand layer: the name keeps coming and going over every scene, each time with a different
// motion-design reveal (light sweep, tracking-in, stroke draw-on, particle assemble, split-flap, hologram,
// mask rise, liquid chrome, 3D flip, anamorphic flare, split horizon, rack focus), a different typeface and a
// different place on screen. Drawn with Canvas2D into a texture that the compositor lays over the scene.
import * as THREE from 'three';

// [css font with {s} for the size, tracking in em]
const F = {
  jost: ['200 {s}px Jost', 0.45], jostB: ['600 {s}px Jost', 0.1], grotesk: ['300 {s}px "Space Grotesk"', 0.35],
  michroma: ['{s}px Michroma', 0.22], orbitron: ['800 {s}px Orbitron', 0.14], unbounded: ['900 {s}px Unbounded', 0.04],
  syne: ['800 {s}px Syne', 0.03], anton: ['{s}px Anton', 0.04], bebas: ['{s}px "Bebas Neue"', 0.08],
  shoulders: ['900 {s}px "Big Shoulders Display"', 0.06], cinzel: ['900 {s}px Cinzel', 0.2], cormorant: ['300 {s}px "Cormorant Garamond"', 0.32],
  bodoni: ['italic 900 {s}px "Bodoni Moda"', 0.02], playfair: ['italic 400 {s}px "Playfair Display"', 0.06], mono: ['400 {s}px "JetBrains Mono"', 0.12]
};
export const BRAND_FONTS = Object.values(F).map(f => f[0]);

const clamp = x => Math.max(0, Math.min(1, x));
const expoOut = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const quadIn = t => t * t;
const quartIO = t => t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2;
const smooth = t => t * t * (3 - 2 * t);
const backOut = (t, s = 1.2) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
// progress of letter i of n when the whole group runs over [0,1] with a stagger
const stag = (p, i, n, spread = 0.4) => clamp((p - spread * i / Math.max(1, n - 1)) / (1 - spread));
const WHITE = '#f4f2ee';

function silver(g, L) {
  const gr = g.createLinearGradient(0, L.y - L.asc, 0, L.y + L.desc);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#d9dde3'); gr.addColorStop(0.55, '#8d939c'); gr.addColorStop(1, '#eef0f3');
  return gr;
}
function letters(g, L, fn) { L.chars.forEach((c, i) => fn(c, i, L.chars.length)); }
function word(g, L, spread = 1, dy = 0) { letters(g, L, c => g.fillText(c.c, L.x + c.x * spread, L.y + dy)); }

const ANIMS = [
  { name: 'Işık süpürme', fonts: ['michroma', 'jost', 'cinzel', 'grotesk'], small: true, inD: 1.5, outD: 0.7,
    draw(g, L, s) {
      const front = L.x - L.w / 2 + (L.w * 1.3) * quartIO(clamp((s.in - 0.25) / 0.75)) - L.w * 0.15;
      const back = s.out > 0 ? L.x + L.w / 2 - L.w * 1.3 * quartIO(s.out) + L.w * 0.15 : Infinity;
      g.globalAlpha = Math.min(1, s.in * 2) * (1 - quadIn(s.out));
      g.fillStyle = 'rgba(70,72,78,0.55)'; word(g, L, 1 + 0.12 * (1 - expoOut(s.in)));
      g.save(); g.beginPath(); g.rect(0, 0, Math.min(front, back), L.H); g.clip();
      g.fillStyle = silver(g, L); word(g, L, 1 + 0.12 * (1 - expoOut(s.in))); g.restore();
      // the specular band; while holding, a softer pass every two bars
      const hold = s.out === 0 && s.in >= 1 ? (s.bar / 2 % 1) : -1;
      const bx = s.in < 1 ? front : s.out > 0 ? back : L.x - L.w * 0.7 + L.w * 1.4 * hold;
      const k = s.in < 1 || s.out > 0 ? 1 : 0.45;
      g.globalCompositeOperation = 'source-atop';
      const bw = L.w * 0.12, gr = g.createLinearGradient(bx - bw, 0, bx + bw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,252,245,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(bx - bw, 0, bw * 2, L.H);
      g.globalCompositeOperation = 'source-over';
    } },
  { name: 'Tracking', fonts: ['cinzel', 'cormorant', 'jost', 'grotesk'], small: true, inD: 2.2, outD: 0.9,
    draw(g, L, s) {
      const e = expoOut(s.in), o = quadIn(s.out);
      const spread = 1 + 1.1 * (1 - e) - 0.04 * Math.min(1, s.hold / 8) + 0.15 * o;
      g.globalAlpha = clamp(s.in * 2.2) * (1 - o);
      g.filter = `blur(${(L.size * 0.12 * (1 - e) + L.size * 0.15 * o).toFixed(1)}px)`;
      g.fillStyle = WHITE; word(g, L, spread);
      g.filter = 'none';
    } },
  { name: 'Çizim', fonts: ['michroma', 'unbounded', 'orbitron', 'syne'], inD: 1.9, outD: 0.8,
    draw(g, L, s) {
      const n = L.chars.length, len = L.size * 6;
      g.lineWidth = Math.max(1.2, L.size * 0.012); g.strokeStyle = WHITE; g.lineJoin = 'round';
      g.globalAlpha = 1 - quadIn(clamp(s.out * 1.6 - 0.6));
      letters(g, L, (c, i) => {
        const p = s.out > 0 ? 1 - stag(clamp(s.out * 1.6), n - 1 - i, n) : stag(clamp(s.in / 0.75), i, n, 0.5);
        g.setLineDash([len, len]); g.lineDashOffset = len * (1 - quartIO(p));
        g.shadowColor = 'rgba(255,255,255,.6)'; g.shadowBlur = L.size * 0.08;
        g.strokeText(c.c, L.x + c.x, L.y);
      });
      g.setLineDash([]); g.shadowBlur = 0;
      // the fill rises inside the letters, and drops away first on the way out
      const f = s.out > 0 ? 1 - expoOut(clamp(s.out * 2)) : expoOut(clamp((s.in - 0.55) / 0.45));
      if (f > 0) {
        g.save(); g.beginPath(); g.rect(0, L.y + L.desc - (L.asc + L.desc) * f, L.W, L.H); g.clip();
        g.fillStyle = silver(g, L); word(g, L); g.restore();
      }
    } },
  { name: 'Parçacık', fonts: ['unbounded', 'syne', 'anton', 'jostB'], inD: 2.2, outD: 1.4, particles: true,
    draw(g, L, s, B) {
      const P = B.parts(L), n = P.tx.length;
      const crisp = s.out > 0 ? 1 - clamp(s.out * 5) : clamp((s.in - 0.82) / 0.18);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = WHITE;
      const r = Math.max(1, L.size * 0.018);
      if (crisp < 1) for (let i = 0; i < n; i++) {
        let x, y, a;
        if (s.out > 0) {
          const e = quadIn(clamp(s.out * 1.15 - P.d[i] * 0.15));
          x = P.tx[i] + e * (L.W * 0.35 * (0.4 + P.r[i]) ) + Math.sin(P.r[i] * 40 + s.t * 2) * e * L.size * 0.5;
          y = P.ty[i] - e * L.size * (0.6 + P.d[i]) * 1.4;
          a = (1 - e) * 0.9;
        } else {
          const e = expoOut(clamp((s.in - P.d[i] * 0.3) / 0.7)), k = (1 - e) * (1 - e);
          x = P.tx[i] + (P.sx[i] - P.tx[i]) * (1 - e) + Math.sin(P.r[i] * 30 + s.t * 3) * k * L.size;
          y = P.ty[i] + (P.sy[i] - P.ty[i]) * (1 - e) + Math.cos(P.r[i] * 20 + s.t * 2.5) * k * L.size;
          a = 0.25 + 0.65 * e;
        }
        g.globalAlpha = a * (1 - crisp);
        g.fillRect(x, y, r, r);
      }
      g.globalCompositeOperation = 'source-over';
      if (crisp > 0) {
        g.globalAlpha = crisp;
        const j = s.bass * L.size * 0.004;
        g.fillStyle = WHITE; word(g, L, 1, (Math.random() - 0.5) * j);
      }
    } },
  { name: 'Split-flap', fonts: ['mono'], small: true, inD: 1.8, outD: 0.9, upper: true,
    draw(g, L, s) {
      const n = L.chars.length, GL = 'ABCDEFGHIJKLMNOPRSTUVYZ0123456789';
      const tw = L.size * 0.78, th = L.size * 1.25;
      g.globalAlpha = s.out > 0 ? 1 - clamp((s.out - 0.55) / 0.45) : clamp(s.in * 6);
      letters(g, L, (c, i) => {
        const lock = s.out > 0 ? clamp((s.out * 1.4) - (n - 1 - i) / n * 0.6) < 0.5 : s.in * L.inD > 0.25 + 0.11 * i;
        const x = L.x + c.x, y = L.y - (L.asc - L.desc) / 2;
        g.fillStyle = '#0d0e10'; g.beginPath(); g.roundRect(x - tw / 2, y - th / 2, tw, th, L.size * 0.06); g.fill();
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x - tw / 2, y - th / 2, tw, th / 2);
        const ch = lock ? c.c : (s.out > 0 && clamp(s.out * 1.4 - (n - 1 - i) / n * 0.6) > 0.9) ? '' : GL[(Math.floor(s.t * 22) * 7 + i * 13) % GL.length];
        g.fillStyle = lock ? WHITE : '#9aa0a8';
        g.fillText(ch, x, L.y);
        g.fillStyle = 'rgba(0,0,0,.85)'; g.fillRect(x - tw / 2, y - Math.max(1, L.size * 0.012), tw, Math.max(1.5, L.size * 0.024));
      });
    } },
  { name: 'Hologram', fonts: ['mono', 'orbitron', 'michroma'], small: true, inD: 0.9, outD: 0.5, upper: true,
    draw(g, L, s) {
      const grow = expoOut(clamp(s.in / 0.25)), open = s.out > 0 ? 1 - expoOut(clamp(s.out / 0.6)) : expoOut(clamp((s.in - 0.2) / 0.8));
      const lineA = s.out > 0 ? 1 - clamp((s.out - 0.6) / 0.4) : 1;
      const cy = L.y - (L.asc - L.desc) / 2, hh = (L.asc + L.desc) * 0.62 * open, flick = 0.85 + 0.15 * Math.sin(s.t * 53) * Math.sin(s.t * 31);
      g.save(); g.beginPath(); g.rect(0, cy - hh - 2, L.W, hh * 2 + 4); g.clip();
      g.globalAlpha = flick;
      const off = Math.max(1, L.size * 0.02) * (1 - clamp(s.in));
      g.globalCompositeOperation = 'lighter';
      if (off > 0.5) { g.fillStyle = 'rgba(255,60,60,.6)'; word(g, L, 1, 0); g.save(); g.translate(off, 0); g.fillStyle = 'rgba(60,220,255,.6)'; word(g, L); g.restore(); }
      g.fillStyle = '#d6f6ff'; g.shadowColor = 'rgba(120,220,255,.8)'; g.shadowBlur = L.size * 0.15; word(g, L);
      g.shadowBlur = 0; g.globalCompositeOperation = 'source-atop';
      // scanlines rolling down, and two bands that slip sideways now and then
      g.fillStyle = 'rgba(0,0,0,.35)';
      const step = Math.max(3, L.size * 0.035), y0 = (s.t * L.size * 0.3) % step;
      for (let y = cy - hh - step + y0; y < cy + hh; y += step) g.fillRect(0, y, L.W, step * 0.4);
      g.restore();
      if (Math.sin(s.t * 3.1) > 0.93) {
        const by = cy + Math.sin(s.t * 17) * L.asc * 0.4, bh = L.size * 0.08;
        g.drawImage(g.canvas, 0, by, L.W, bh, Math.max(1, L.size * 0.02), by, L.W, bh);
      }
      g.globalAlpha = lineA * 0.9;
      g.fillStyle = '#d6f6ff';
      const lw = L.w * 1.1 * grow;
      g.fillRect(L.x - lw / 2, cy - hh - 1, lw, Math.max(1, L.size * 0.01));
      g.fillRect(L.x - lw / 2, cy + hh, lw, Math.max(1, L.size * 0.01));
    } },
  { name: 'Maske yükselme', fonts: ['anton', 'bebas', 'shoulders'], inD: 1.3, outD: 0.7, upper: true,
    draw(g, L, s) {
      const n = L.chars.length, h = L.asc + L.desc;
      g.save(); g.beginPath(); g.rect(0, L.y - L.asc - h * 0.08, L.W, h * 1.16); g.clip();
      g.fillStyle = WHITE;
      letters(g, L, (c, i) => {
        const dy = s.out > 0 ? -quartIO(stag(s.out, i, n, 0.3)) * h * 1.15 : (1 - backOut(stag(clamp(s.in / 0.8), i, n, 0.35), 0.6)) * h * 1.15;
        g.fillText(c.c, L.x + c.x, L.y + dy);
      });
      g.restore();
      const u = s.out > 0 ? 1 - expoOut(clamp(s.out * 1.5)) : expoOut(clamp((s.in - 0.45) / 0.55));
      g.fillStyle = WHITE;
      g.fillRect(L.x - L.w * 0.5 * u, L.y + L.desc + L.size * 0.12, L.w * u, Math.max(2, L.size * 0.025));
    } },
  { name: 'Sıvı krom', fonts: ['unbounded', 'syne', 'anton'], inD: 1.6, outD: 1.0,
    draw(g, L, s, B) {
      const spr = B.sprite(L, 'chrome'), amp = s.out > 0 ? L.size * 0.6 * quadIn(s.out) : L.size * 0.45 * (1 - expoOut(s.in));
      g.globalAlpha = Math.min(1, s.in * 2.5) * (1 - quadIn(s.out));
      const sh = Math.max(2, Math.round(L.size * 0.025));
      for (let y = 0; y < spr.height; y += sh) {
        const dx = Math.sin(y * 0.05 + s.t * 4) * amp, drip = s.out > 0 ? quadIn(s.out) * L.size * (0.5 + Math.sin(y * 0.3) * 0.5) : 0;
        g.drawImage(spr, 0, y, spr.width, sh, spr.ox + dx, spr.oy + y + drip, spr.width, sh);
      }
      // a slow specular glint running across the chrome
      g.globalCompositeOperation = 'source-atop';
      const gx = L.x - L.w + ((s.t * 0.35) % 1) * L.w * 2, gw = L.w * 0.2;
      const gr = g.createLinearGradient(gx - gw, 0, gx + gw, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(gx - gw, 0, gw * 2, L.H);
      g.globalCompositeOperation = 'source-over';
    } },
  { name: '3D dönüş', fonts: ['shoulders', 'bebas', 'unbounded', 'anton'], inD: 1.5, outD: 0.7, upper: true,
    draw(g, L, s) {
      const n = L.chars.length, depth = Math.max(4, Math.round(L.size * 0.08));
      letters(g, L, (c, i) => {
        const p = s.out > 0 ? 1 + quartIO(stag(s.out, i, n, 0.25)) : backOut(stag(clamp(s.in / 0.85), i, n, 0.45), 1.1);
        const th = (1 - p) * Math.PI / 2, sx = Math.cos(th);
        if (Math.abs(sx) < 0.02) return;
        g.save(); g.translate(L.x + c.x, L.y); g.scale(sx, 1);
        const dir = Math.sin(th) * 1.2 + 0.5;
        for (let k = depth; k >= 1; k--) { g.fillStyle = `rgb(${18 + 20 * (1 - k / depth)},${19 + 20 * (1 - k / depth)},${22 + 22 * (1 - k / depth)})`; g.fillText(c.c, k * dir, k * 0.9); }
        const lit = 0.55 + 0.45 * Math.abs(sx);
        const gr = g.createLinearGradient(0, -L.asc, 0, L.desc);
        gr.addColorStop(0, `rgba(255,255,255,${lit})`); gr.addColorStop(1, `rgba(150,156,166,${lit})`);
        g.fillStyle = gr; g.fillText(c.c, 0, 0);
        g.restore();
      });
    } },
  { name: 'Anamorfik', fonts: ['bodoni', 'playfair', 'cormorant', 'cinzel'], small: true, inD: 1.8, outD: 1.0,
    draw(g, L, s) {
      const p = quartIO(clamp(s.in / 0.9)), fx = L.x - L.w * 0.6 + L.w * 1.2 * p;
      const breathe = 1 + 0.1 * Math.sin(s.t * 2);
      g.save();
      if (s.in < 1) {
        const m = g.createLinearGradient(fx - L.w * 0.15, 0, fx + L.w * 0.02, 0);
        m.addColorStop(0, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = Math.sin(clamp(s.in) * Math.PI / 2);
        g.fillStyle = WHITE; word(g, L, 1.08 - 0.08 * smooth(clamp(s.in)));
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = m; g.fillRect(0, 0, Math.max(0, fx + L.w * 0.02), L.H);
        g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(Math.max(0, fx + L.w * 0.02), 0, L.W, L.H);
      } else {
        g.globalAlpha = 1 - smooth(s.out);
        g.filter = s.out > 0 ? `blur(${(s.out * L.size * 0.08).toFixed(1)}px)` : 'none';
        g.fillStyle = WHITE; word(g, L);
        g.filter = 'none';
      }
      g.restore();
      // the flare: a hot point riding the baseline and a thin blue-white streak across the screen
      const fa = s.in < 1 ? Math.sin(clamp(s.in) * Math.PI) : 0.18 * breathe * (1 - s.out) + 0.5 * Math.sin(clamp(s.out) * Math.PI) * 0.4;
      if (fa > 0.01) {
        const px = s.in < 1 ? fx : L.x + L.w * 0.42, py = L.y - L.asc * 0.1;
        g.globalCompositeOperation = 'lighter';
        const sg = g.createLinearGradient(0, 0, L.W, 0);
        sg.addColorStop(0, 'rgba(90,140,255,0)'); sg.addColorStop(px / L.W, `rgba(200,225,255,${0.7 * fa})`); sg.addColorStop(1, 'rgba(90,140,255,0)');
        g.fillStyle = sg; g.fillRect(0, py - Math.max(1, L.size * 0.008), L.W, Math.max(2, L.size * 0.016));
        const rg = g.createRadialGradient(px, py, 0, px, py, L.size * 0.5);
        rg.addColorStop(0, `rgba(255,255,255,${0.9 * fa})`); rg.addColorStop(0.15, `rgba(170,200,255,${0.35 * fa})`); rg.addColorStop(1, 'rgba(80,120,255,0)');
        g.fillStyle = rg; g.fillRect(px - L.size * 0.5, py - L.size * 0.5, L.size, L.size);
        g.globalCompositeOperation = 'source-over';
      }
    } },
  { name: 'Ufuk bölme', fonts: ['anton', 'bebas', 'jostB', 'orbitron'], inD: 1.3, outD: 0.7, upper: true,
    draw(g, L, s) {
      const line = s.out > 0 ? 1 - clamp((s.out - 0.5) * 2) : expoOut(clamp(s.in / 0.35));
      const e = s.out > 0 ? -quartIO(s.out) : expoOut(clamp((s.in - 0.2) / 0.8)) - 1;
      const mid = L.y - L.asc * 0.35, off = e * L.W * 0.5;
      g.fillStyle = WHITE;
      // top half arrives from the left, bottom half from the right
      g.save(); g.beginPath(); g.rect(0, 0, L.W, mid); g.clip(); g.translate(off, 0); word(g, L); g.restore();
      g.save(); g.beginPath(); g.rect(0, mid, L.W, L.H); g.clip(); g.translate(-off, 0); word(g, L); g.restore();
      g.globalAlpha = line * 0.85;
      const lw = L.w * 1.25 * line;
      g.fillRect(L.x - lw / 2, mid - Math.max(0.5, L.size * 0.004), lw, Math.max(1, L.size * 0.008));
    } },
  { name: 'Odak', fonts: ['bodoni', 'playfair', 'cinzel', 'jost'], small: true, inD: 1.6, outD: 0.9,
    draw(g, L, s) {
      const e = 1 - Math.pow(1 - clamp(s.in), 3), o = quadIn(s.out);
      const sc = 1.35 - 0.35 * e + 0.02 * Math.min(1, s.hold / 6) + 0.7 * o;
      g.globalAlpha = clamp(s.in * 1.6) * (1 - o);
      g.filter = `blur(${(L.size * 0.2 * (1 - e) + L.size * 0.18 * o).toFixed(1)}px)`;
      g.save(); g.translate(L.x, L.y); g.scale(sc, sc); g.translate(-L.x, -L.y);
      g.fillStyle = WHITE; word(g, L); g.restore();
      g.filter = 'none';
    } }
];
export const BRAND_ANIMS = ANIMS.map(a => a.name);

// places on screen: x, y, height fraction, max width fraction
const PLACES = {
  center: [0.5, 0.5, 0.15, 0.74], low: [0.5, 0.83, 0.075, 0.5], top: [0.5, 0.13, 0.06, 0.44],
  cornerR: [-1, 0.9, 0.042, 0.28], cornerL: [-2, 0.9, 0.042, 0.28]
};

export class Brand {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.tex = null;
    this.state = 'wait'; this.t = 0; this.wait = 2.5;
    this.recent = []; this.lastPlace = 'low'; this.alpha = 0;
  }
  setSize(w, h) {
    const k = Math.min(1, 1920 / w);
    this.canvas.width = Math.round(w * k); this.canvas.height = Math.round(h * k);
    if (this.tex) this.tex.dispose();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace; this.tex.generateMipmaps = false; this.tex.minFilter = THREE.LinearFilter;
    this.L = null;
  }
  // pick the next look: never one of the last four animations, a fresh font, and big / small places alternating
  start(S, ownName, force) {
    const pool = ANIMS.map((a, i) => i).filter(i => !this.recent.includes(i) && (!ownName || ANIMS[i].small));
    const ai = force ?? pool[Math.floor(Math.random() * pool.length)] ?? 0;
    this.recent = [...this.recent, ai].slice(-4);
    const A = ANIMS[ai];
    const fk = A.fonts.filter(f => f !== this.lastFont);
    this.lastFont = fk[Math.floor(Math.random() * fk.length)] || A.fonts[0];
    let place = 'center';
    if (A.small && (ownName || this.lastPlace === 'center' || S.brandSize < 0.5)) place = ['low', 'top', 'cornerR', 'cornerL', 'low'][Math.floor(Math.random() * 5)];
    this.lastPlace = place;
    this.A = A; this.state = 'show'; this.t = 0;
    this.hold = (place === 'center' ? 4 : 6.5) + Math.random() * 2.5;
    this.layout(S, place);
  }
  layout(S, place) {
    const { g, canvas: { width: W, height: H } } = this, A = this.A;
    const [fs, tr] = F[this.lastFont];
    const text = (S.name || 'ONLYDEMIR').trim();
    const t = A.upper || this.lastFont !== 'cormorant' ? text.toLocaleUpperCase('tr') : text;
    let [px, py, hs, mw] = PLACES[place];
    if (place === 'center') hs *= 0.6 + S.brandSize * 0.8;
    let size = H * hs;
    const measure = sz => {
      g.font = fs.replace('{s}', sz.toFixed(1)); g.letterSpacing = '0px';
      const trk = sz * tr * (A.name === 'Split-flap' ? 2.2 : 1);
      const xs = [...t].map((c, i) => g.measureText(t.slice(0, i)).width + i * trk);
      const ws = [...t].map(c => g.measureText(c).width);
      const w = xs.length ? xs[xs.length - 1] + ws[ws.length - 1] : 0;
      return { xs, ws, w };
    };
    let m = measure(size);
    if (m.w > W * mw) { size *= W * mw / m.w; m = measure(size); }
    const mt = g.measureText('M');
    const asc = mt.actualBoundingBoxAscent || size * 0.72, desc = mt.actualBoundingBoxDescent || size * 0.05;
    const x = px === -1 ? W * 0.965 - m.w / 2 : px === -2 ? W * 0.035 + m.w / 2 : W * px;
    this.L = {
      W, H, size, font: fs.replace('{s}', size.toFixed(1)), x, y: H * py + (asc - desc) / 2, w: m.w, inD: A.inD, asc, desc,
      chars: [...t].map((c, i) => ({ c, x: m.xs[i] + m.ws[i] / 2 - m.w / 2 }))
    };
    this.P = null; this.spr = null;
  }
  // particle targets sampled from the word, with a random start cloud and a delay that runs left to right
  parts(L) {
    if (this.P) return this.P;
    const o = this.off, pad = L.size * 0.2;
    o.width = Math.ceil(L.w + pad * 2); o.height = Math.ceil(L.asc + L.desc + pad * 2);
    const c = o.getContext('2d', { willReadFrequently: true });
    c.font = L.font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff';
    L.chars.forEach(ch => c.fillText(ch.c, o.width / 2 + ch.x, pad + L.asc));
    const d = c.getImageData(0, 0, o.width, o.height).data, step = Math.max(2, Math.round(L.size / 45));
    const pts = [];
    for (let y = 0; y < o.height; y += step) for (let x = 0; x < o.width; x += step) if (d[(y * o.width + x) * 4 + 3] > 128) pts.push(x, y);
    const n = pts.length / 2, P = { tx: new Float32Array(n), ty: new Float32Array(n), sx: new Float32Array(n), sy: new Float32Array(n), d: new Float32Array(n), r: new Float32Array(n) };
    const ox = L.x - o.width / 2, oy = L.y - L.asc - pad;
    for (let i = 0; i < n; i++) {
      P.tx[i] = ox + pts[i * 2]; P.ty[i] = oy + pts[i * 2 + 1];
      const a = Math.random() * Math.PI * 2, r = (0.3 + Math.random()) * L.W * 0.35;
      P.sx[i] = L.x + Math.cos(a) * r; P.sy[i] = L.y + Math.sin(a) * r * 0.6;
      P.d[i] = (P.tx[i] - (L.x - L.w / 2)) / Math.max(1, L.w); P.r[i] = Math.random();
    }
    return (this.P = P);
  }
  // the word pre-rendered once (for slice effects), with its top-left placement
  sprite(L, kind) {
    if (this.spr) return this.spr;
    const o = document.createElement('canvas'), pad = L.size * 0.15;
    o.width = Math.ceil(L.w + pad * 2); o.height = Math.ceil(L.asc + L.desc + pad * 2);
    const c = o.getContext('2d');
    c.font = L.font; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const y0 = pad, y1 = pad + L.asc + L.desc;
    const gr = c.createLinearGradient(0, y0, 0, y1);
    [[0, '#eef3ff'], [0.42, '#ffffff'], [0.5, '#1c1d22'], [0.56, '#6d6258'], [0.8, '#e9ecf0'], [1, '#9aa1ab']].forEach(([s, col]) => gr.addColorStop(s, col));
    c.fillStyle = gr;
    L.chars.forEach(ch => c.fillText(ch.c, o.width / 2 + ch.x, pad + L.asc));
    c.lineWidth = Math.max(1, L.size * 0.006); c.strokeStyle = 'rgba(255,255,255,.5)';
    L.chars.forEach(ch => c.strokeText(ch.c, o.width / 2 + ch.x, pad + L.asc - 1));
    o.ox = L.x - o.width / 2; o.oy = L.y - L.asc - pad;
    return (this.spr = o);
  }
  // returns the overlay strength for the compositor (0 = nothing on screen)
  update(S, dt, ownName) {
    if (!this.tex) return 0;
    if (!S.brand) { this.state = 'wait'; this.wait = 1; return 0; }
    this.t += dt;
    if (S.name !== this.lastName) { this.lastName = S.name; if (this.state === 'show') this.layout(S, this.lastPlace); }
    if (this.state === 'wait') {
      // the next appearance lands on a bar downbeat (or anyway after a while without beats)
      const down = S.beatCount !== this.lb && S.beatCount % 4 === 0;
      this.lb = S.beatCount;
      if (this.t > this.wait && (down || this.t > this.wait + 3)) this.start(S, ownName);
      else return 0;
    }
    const A = this.A, L = this.L, tIn = A.inD, tOut = A.outD, total = tIn + this.hold + tOut;
    if (this.t >= total) {
      this.state = 'wait'; this.t = 0;
      this.wait = S.brandGap * (0.6 + Math.random() * 0.8);
      this.g.clearRect(0, 0, L.W, L.H); this.tex.needsUpdate = true;
      return 0;
    }
    const st = {
      t: this.t, in: clamp(this.t / tIn), out: clamp((this.t - tIn - this.hold) / tOut), hold: Math.max(0, this.t - tIn),
      bar: (S.clockPhase || this.t * 2) / 4, bass: S.bass
    };
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, L.W, L.H);
    g.save();
    g.font = L.font; g.letterSpacing = '0px'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    A.draw(g, L, st, this);
    g.restore();
    this.tex.needsUpdate = true;
    return 1;
  }
  // jump straight to a given animation (UI preview)
  preview(S, i, ownName) { this.start(S, ownName, i); }
}
