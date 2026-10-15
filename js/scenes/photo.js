// 2.5D "living photo" scenes: a photoreal still + its depth map becomes a displaced mesh filmed by a moving camera,
// with sparkle glints found on the image's brightest points and per-scene atmospherics (rain, dust, fireworks, flares).
import * as THREE from 'three';
import { canvasTex } from '../common.js';

const TAU = Math.PI * 2;
const ASSET = 'assets/photo/';

// scene definitions; glints rect = [x0, y0, x1, y1] in 0..1 image space
export const PHOTO_DEFS = [
  { key: 'p_iced', name: 'Iced Out', energy: 'mid', variants: ['iced_a', 'iced_b', 'iced_c'], depth: 2.4, glints: { rect: [0.25, 0.5, 0.78, 0.95], n: 170, thresh: 0.985 }, sweep: true, rim: true },
  { key: 'p_neon', name: 'Neon Sokak', energy: 'mid', variants: ['neon'], depth: 3.2, rain: true, glints: { rect: [0, 0, 1, 1], n: 40, thresh: 0.995 } },
  { key: 'p_stage', name: 'Festival', energy: 'high', variants: ['stage'], depth: 2.6, dust: true, flare: true, strobe: true },
  { key: 'p_space', name: 'Yörüngede', energy: 'low', variants: ['space'], depth: 2.2, flare: true, stars: true },
  { key: 'p_car', name: 'Garaj', energy: 'mid', variants: ['car'], depth: 2.8, sweep: true, glints: { rect: [0, 0.3, 1, 1], n: 50, thresh: 0.99 } },
  { key: 'p_bosphorus', name: 'Boğaz · 29 Ekim', cat: 'tr', energy: 'low', variants: ['bosphorus'], depth: 2.6, fireworks: true },
  { key: 'p_velvet', name: 'Pırlanta Logo', energy: 'mid', variants: ['velvet'], depth: 1.6, sweep: true, glints: { rect: [0.05, 0.15, 0.95, 0.9], n: 230, thresh: 0.98 } }
];

let starTex, streakTex, dotTex;
function textures() {
  if (starTex) return;
  starTex = canvasTex(128, (g, n) => {
    const c = n / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.45);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    const ray = (w, h, a) => { const lg = g.createLinearGradient(c - w / 2, c - h / 2, c + w / 2, c + h / 2); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(c - w / 2, c - h / 2, w, h); };
    ray(n, 2.5, 1); ray(2.5, n, 1);
    g.save(); g.translate(c, c); g.rotate(Math.PI / 4); g.translate(-c, -c); ray(n * 0.5, 1.5, 0.6); ray(1.5, n * 0.5, 0.6); g.restore();
  });
  streakTex = canvasTex(256, (g, n) => {
    const lg = g.createLinearGradient(0, 0, n, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    const vg = g.createLinearGradient(0, n / 2 - 6, 0, n / 2 + 6);
    g.fillRect(0, n / 2 - 2, n, 4);
    g.globalAlpha = 0.35; g.fillRect(0, n / 2 - 7, n, 14);
  });
  dotTex = canvasTex(64, (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  });
}

function loadImage(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
function pixels(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

// brightest local maxima inside a rect, spread out (simple non-max suppression)
function findGlints(img, depth, cfg) {
  const W = 480, H = 272;
  const p = pixels(img, W, H), d = pixels(depth, W, H);
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = (0.2126 * p[i * 4] + 0.7152 * p[i * 4 + 1] + 0.0722 * p[i * 4 + 2]) / 255;
  const [x0, y0, x1, y1] = cfg.rect;
  const cand = [];
  for (let y = Math.floor(y0 * H) + 2; y < y1 * H - 2; y++) for (let x = Math.floor(x0 * W) + 2; x < x1 * W - 2; x++) {
    const v = lum[y * W + x];
    let isMax = true;
    for (let dy = -2; dy <= 2 && isMax; dy++) for (let dx = -2; dx <= 2; dx++) if (lum[(y + dy) * W + x + dx] > v) { isMax = false; break; }
    if (isMax) cand.push([v, x, y]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  const cut = cand[Math.floor(cand.length * (1 - cfg.thresh))]?.[0] ?? 0.9;
  const out = [];
  for (const [v, x, y] of cand) {
    if (v < Math.max(cut, 0.55) || out.length >= cfg.n) break;
    if (out.some(o => (o[0] - x) ** 2 + (o[1] - y) ** 2 < 25)) continue;
    out.push([x, y, d[(y * W + x) * 4] / 255, v]);
  }
  return out.map(([x, y, z, v]) => ({ u: x / W, v: y / H, z, b: v }));
}

// largest bright blob centre (for the lens flare)
function findSun(img) {
  const W = 240, H = 136;
  const p = pixels(img, W, H);
  let best = 0, bx = 0.5, by = 0.3;
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
    let s = 0;
    for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) { const i = ((y + dy) * W + x + dx) * 4; s += p[i] + p[i + 1] + p[i + 2]; }
    if (s > best) { best = s; bx = x / W; by = y / H; }
  }
  return { u: bx, v: by };
}

export class PhotoScene {
  constructor(ctx, def) {
    Object.assign(this, { cat: 'pro', textPos: null, ownEnv: true }, def);
    this.def = def;
    this.ctx = ctx;
    textures();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    this.U = {
      tImg: { value: null }, tDepth: { value: null }, uDepth: { value: def.depth }, uTime: { value: 0 }, uBeat: { value: 0 }, uDrop: { value: 0 },
      uTint: { value: new THREE.Color() }, uSweep: { value: def.sweep ? 1 : 0 }, uRim: { value: def.rim ? 1 : 0 }, uStrobe: { value: 0 }
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 384, 218), new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: `
uniform sampler2D tDepth; uniform float uDepth; varying vec2 vUv; varying float vD;
void main(){
  vUv=uv;
  float d=texture2D(tDepth,uv).r;
  vD=d;
  vec3 p=position; p.z+=d*uDepth;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`,
      fragmentShader: `
uniform sampler2D tImg; uniform float uTime, uBeat, uDrop, uSweep, uRim, uStrobe; uniform vec3 uTint; varying vec2 vUv; varying float vD;
void main(){
  vec3 c=texture2D(tImg,vUv).rgb;
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  // light sweep that rides over the nearest surfaces
  float band=exp(-pow((vUv.x*0.75+vUv.y*0.25-fract(uTime*0.055)*1.9+0.45)*7.0,2.0));
  c+=c*band*uSweep*(0.35+0.5*smoothstep(0.4,0.9,vD));
  // beat: lift the foreground a touch and push the highlights toward the palette colour
  c*=1.0+uBeat*0.07*(0.3+vD)+uDrop*0.3;
  c=mix(c,c*uTint*2.4,smoothstep(0.25,0.8,l)*uRim*(0.05+uBeat*0.12+uDrop*0.25));
  c+=vec3(uStrobe)*smoothstep(0.3,0.9,l);
  gl_FragColor=vec4(c,1.0);
}`
    }));
    this.scene.add(this.mesh);
    this.fx = new THREE.Group();
    this.scene.add(this.fx);
    this.variant = -1;
    this.aspectImg = 1920 / 1088;
    this.aspect = 16 / 9;
    this.kick = 0;
    this.loading = null;
  }

  async load(name) {
    const [img, depth] = await Promise.all([loadImage(ASSET + name + '.jpg'), loadImage(ASSET + name + '_depth.png')]);
    const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
    const dt = new THREE.Texture(depth); dt.needsUpdate = true;
    this.U.tImg.value?.dispose(); this.U.tDepth.value?.dispose();
    this.U.tImg.value = tex; this.U.tDepth.value = dt;
    this.aspectImg = img.width / img.height;
    this.pw = 10 * this.aspectImg; this.ph = 10;
    this.mesh.scale.set(this.pw, this.ph, 1);
    this.fx.children.forEach(o => o.geometry?.dispose());
    this.fx.clear();
    const def = this.def;
    const toWorld = (u, v, z) => new THREE.Vector3((u - 0.5) * this.pw, (0.5 - v) * this.ph, z * def.depth + 0.05);
    const gl = def.glints ? findGlints(img, depth, def.glints) : [];
    if (gl.length) this.addGlints(gl, toWorld);
    // framings for beat-synced cuts: wide, the jewellery (glint centroid), two offset close-ups
    const gc = gl.length ? gl.reduce((a, g) => [a[0] + g.u / gl.length, a[1] + g.v / gl.length], [0, 0]) : [0.5, 0.55];
    this.framings = [
      { u: 0.5, v: 0.5, z: 1 },
      { u: gc[0], v: gc[1], z: def.glints ? 1.9 : 1.5 },
      { u: 0.36, v: 0.42, z: 1.45 },
      { u: 0.64, v: 0.4, z: 1.45 }
    ];
    this.frame = { u: 0.5, v: 0.5, z: 1 };
    this.frameTo = this.framings[0];
    if (def.flare) this.addFlare(findSun(img), depth, toWorld);
    if (def.rain) this.addRain();
    if (def.dust) this.addDust(0xffffff, 500);
    if (def.stars) this.addDust(0xcfe0ff, 250);
    if (def.fireworks) this.addFireworks();
    this.fit();
  }

  addGlints(list, toWorld) {
    const n = list.length;
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n), br = new Float32Array(n);
    list.forEach((g, i) => { toWorld(g.u, g.v, g.z).toArray(pos, i * 3); rnd[i] = Math.random(); br[i] = g.b; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute('aB', new THREE.BufferAttribute(br, 1));
    this.glintMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uSize: { value: 40 }, uTex: { value: starTex } },
      vertexShader: `attribute float aRand, aB; uniform float uTime, uBeat, uSize; varying float vA;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
  float tw=pow(max(0.0,sin(uTime*(0.9+aRand*2.2)+aRand*80.0)),24.0);
  float kick=uBeat*step(0.55,fract(aRand*7.31));
  vA=min(1.4,tw*1.2+kick);
  gl_PointSize=uSize*(0.25+vA)*(0.7+aB*0.6)*(20.0/-mv.z); }`,
      fragmentShader: `uniform sampler2D uTex; varying float vA;
void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(vec3(1.0,0.98,0.95)*a*vA*1.6,1.0); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, this.glintMat);
    pts.frustumCulled = false;
    this.fx.add(pts);
  }

  addFlare(sun, depth, toWorld) {
    const p = toWorld(sun.u, sun.v, 0.2);
    this.flare = new THREE.Group();
    this.flare.position.copy(p);
    const mk = (tex, sx, sy, op, col) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, blending: THREE.AdditiveBlending, transparent: true, opacity: op, depthTest: false, depthWrite: false })); s.scale.set(sx, sy, 1); this.flare.add(s); return s; };
    this.flareGlow = mk(dotTex, 3, 3, 0.35, 0xfff1dd);
    this.flareStreak = mk(streakTex, 22, 1.2, 0.5, 0xbfd8ff);
    this.fx.add(this.flare);
  }

  addRain() {
    const n = 1400;
    const pos = new Float32Array(n * 6);
    this.rain = { n, pos, sp: new Float32Array(n) };
    for (let i = 0; i < n; i++) { this.resetDrop(i, true); this.rain.sp[i] = 14 + Math.random() * 10; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfcfe6, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.rainLines.frustumCulled = false;
    this.fx.add(this.rainLines);
  }
  resetDrop(i, any) {
    const p = this.rain.pos, x = (Math.random() - 0.5) * 20, z = 1 + Math.random() * 12, y = any ? (Math.random() - 0.5) * 12 : 6.5;
    p.set([x, y, z, x - 0.05, y - 0.45, z], i * 6);
  }

  addDust(color, n) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, 1 + Math.random() * 10], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTex, color, size: 0.09, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    this.dust = pts;
    this.fx.add(pts);
  }

  addFireworks() {
    const n = 2400;
    this.fw = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 3), life: new Float32Array(n), next: 0 };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.fw.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.fw.col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTex, size: 0.14, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    this.fwPts = pts;
    this.fx.add(pts);
  }
  burst(big) {
    const f = this.fw, c = new THREE.Vector3((Math.random() - 0.5) * 12, 1.5 + Math.random() * 3, 2 + Math.random() * 2);
    const cols = [[1.6, 0.15, 0.2], [1.6, 1.5, 1.4], [1.7, 1.2, 0.5]];
    const col = cols[Math.floor(Math.random() * cols.length)];
    const count = big ? 500 : 220;
    for (let k = 0; k < count; k++) {
      const i = (f.next++) % f.n;
      const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1), sp = (big ? 3.4 : 2.4) * (0.75 + Math.random() * 0.25);
      f.pos.set([c.x, c.y, c.z], i * 3);
      f.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp * 0.4], i * 3);
      f.col.set(col, i * 3);
      f.life[i] = 1;
    }
  }

  resize(w, h) { this.h = h; this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit(); }
  // cover-fit with a little overscan so the camera moves never show the edges
  fit() {
    if (!this.pw) return;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const over = 1.05;
    const dH = (this.ph / over / 2) / t;
    const dW = (this.pw / over / 2) / (t * this.aspect);
    this.dist = Math.min(dH, dW);
  }

  update(S, t, dt) {
    const v = this.def.variants;
    const want = Math.min(v.length - 1, this.key === 'p_iced' ? (S.icedVariant || 0) : 0);
    if (want !== this.variant && !this.loading) {
      this.variant = want;
      this.loading = this.load(v[want]).finally(() => { this.loading = null; });
    }
    if (!this.U.tImg.value) return;
    const U = this.U;
    U.uTime.value = t; U.uBeat.value = Math.min(1, S.beat); U.uDrop.value = S.drop;
    U.uTint.value.copy(this.ctx.c1);
    U.uStrobe.value = this.def.strobe ? Math.pow(Math.min(1, S.beat), 6) * 0.25 : 0;

    // camera: bar-synced sway, kick-in on beats, slow push, bigger move on drops
    if (S.beatCount !== this.lb) { this.lb = S.beatCount; this.kick = 1; }
    this.kick *= Math.exp(-dt * 7);
    const bar = (S.clockPhase || t * 2) * Math.PI / 4;
    const amp = (S.photoMotion ?? 1);
    const cx = Math.sin(bar) * 0.55 * amp + Math.sin(t * 0.13) * 0.25 * amp;
    const cy = Math.cos(bar * 0.5) * 0.22 * amp + Math.sin(t * 0.09) * 0.12 * amp;
    const push = (Math.sin(t * 0.07) * 0.5 + 0.5) * 0.45 * amp + this.kick * 0.25 * amp * S.react + S.drop * 1.4;
    // cut to a new framing every N beats (snap back wide on drops)
    if (S.photoCuts !== false && this.framings) {
      const every = S.cutEvery || 8;
      if (S.beatCount !== this.lcut && S.beatCount % every === 0) {
        this.lcut = S.beatCount;
        const opts = this.framings.filter(f => f !== this.frameTo);
        this.frameTo = opts[Math.floor(Math.random() * opts.length)];
      }
      if (S.dropCount !== this.ldrop) { this.ldrop = S.dropCount; this.frameTo = this.framings[0]; }
    } else if (this.framings) this.frameTo = this.framings[0];
    const f = this.frame, ft = this.frameTo || { u: 0.5, v: 0.5, z: 1 };
    const k = 1 - Math.exp(-dt * 14);   // fast whip, reads as a cut
    f.u += (ft.u - f.u) * k; f.v += (ft.v - f.v) * k; f.z += (ft.z - f.z) * k;
    // keep the framed window inside the photo
    const halfU = 0.5 / f.z * 0.95, halfV = 0.5 / f.z * 0.95;
    const fu = Math.min(1 - halfU, Math.max(halfU, f.u)), fv = Math.min(1 - halfV, Math.max(halfV, f.v));
    const tx = (fu - 0.5) * this.pw, ty = (0.5 - fv) * this.ph;
    const d = (this.dist || 20) / f.z - push / f.z;
    this.camera.position.set(tx + cx / f.z, ty + cy / f.z, d + this.def.depth * 0.5);
    this.camera.lookAt(tx + cx * 0.25 / f.z, ty + cy * 0.25 / f.z, this.def.depth * 0.5);
    this.camera.rotation.z = Math.sin(bar * 0.5) * 0.006 * amp;

    if (this.glintMat) {
      this.glintMat.uniforms.uTime.value = t;
      this.glintMat.uniforms.uBeat.value = Math.min(1, S.beat) * 1.1 + S.drop * 1.5;
      this.glintMat.uniforms.uSize.value = (this.h || 1080) * 0.04;
    }
    if (this.flare) {
      const k = 1 + Math.min(1, S.beat) * 0.5 + S.drop;
      this.flareGlow.scale.setScalar(3 * k);
      this.flareStreak.scale.set(22 * k, 1.2, 1);
      // the global lens pass draws real anamorphic streaks from the glow; the sprite streak is only a fallback
      this.flareStreak.visible = !(S.lensStreak > 0.05);
      this.flareStreak.material.color.copy(this.ctx.c1).lerp(new THREE.Color(0.75, 0.85, 1), 0.6);
    }
    if (this.rain) {
      const p = this.rain.pos;
      for (let i = 0; i < this.rain.n; i++) {
        const s = this.rain.sp[i] * dt * (1 + S.drop);
        p[i * 6 + 1] -= s; p[i * 6 + 4] -= s; p[i * 6] -= s * 0.1; p[i * 6 + 3] -= s * 0.1;
        if (p[i * 6 + 4] < -6.5) this.resetDrop(i, false);
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      this.rainLines.material.opacity = 0.22 + Math.min(1, S.beat) * 0.12;
    }
    if (this.dust) {
      const a = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { a[i + 1] += dt * (0.12 + S.bass * 0.4); a[i] += Math.sin(t * 0.3 + i) * dt * 0.05; if (a[i + 1] > 6) a[i + 1] = -6; }
      this.dust.geometry.attributes.position.needsUpdate = true;
      this.dust.material.opacity = 0.35 + Math.min(1, S.beat) * 0.4;
    }
    if (this.fw) {
      if (S.beatCount !== this.fwb && S.beatCount % 2 === 0) { this.fwb = S.beatCount; this.burst(false); }
      if (S.dropCount !== this.fwd) { this.fwd = S.dropCount; for (let k = 0; k < 4; k++) this.burst(true); }
      const f = this.fw;
      for (let i = 0; i < f.n; i++) {
        if (f.life[i] <= 0) { f.col[i * 3] = f.col[i * 3 + 1] = f.col[i * 3 + 2] = 0; continue; }
        f.life[i] -= dt * 0.55;
        f.vel[i * 3 + 1] -= dt * 1.2;
        for (let k = 0; k < 3; k++) { f.vel[i * 3 + k] *= 1 - dt * 0.9; f.pos[i * 3 + k] += f.vel[i * 3 + k] * dt; f.col[i * 3 + k] *= 0.985; }
      }
      this.fwPts.geometry.attributes.position.needsUpdate = true;
      this.fwPts.geometry.attributes.color.needsUpdate = true;
    }
  }
  render(r) { r.render(this.scene, this.camera); }
}
