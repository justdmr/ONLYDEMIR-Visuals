// Shared building blocks: environment, chrome materials, fonts, geometry helpers, shader preamble.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// colour palettes: [primary, secondary]
export const PALETTES = {
  bayrak: ['Bayrak', '#e30a17', '#ffffff'],
  altin: ['Altın', '#e30a17', '#ffc850'],
  y2k: ['Y2K', '#ff2bd6', '#e8e8ff'],
  buz: ['Buz', '#19c8ff', '#ffffff'],
  zehir: ['Zehir', '#7dff1a', '#ffffff'],
  gece: ['Gece', '#6a2bff', '#ff2bd6'],
  gunes: ['Güneş', '#ff5a00', '#ffe14d']
};
export const GLYPHS = 'ONLYDEMIR1923ATÜKCH';
// display-space rgb (0..1) from a #hex string, for the shader uniforms
export function hexVec(hex, v = new THREE.Vector3()) {
  const n = parseInt(hex.slice(1), 16);
  return v.set((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
}
// per-scene option (S.sc[sceneKey][name]) with a fallback to the old global setting
export const sceneOpt = (S, key, name, def) => S.sc?.[key]?.[name] ?? def;
export const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// ---------- GLSL ----------
export const SHADER_HEAD = `
uniform vec2 uRes; uniform float uTime, uBass, uMid, uHigh, uBeat, uTravel, uHasImg, uImgAsp, uDrop;
uniform vec3 uAccent, uC1;
uniform sampler2D uSpec, uImg, uWave, uGlyph;
varying vec2 vUv;
#define RED uC1
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
// five-point star, one tip pointing left (towards the crescent), outer radius R
float starD(vec2 p,float R){
  float sec=6.2831853/5.0;
  float a=atan(p.y,p.x)-3.14159265;
  a=abs(mod(a+sec*0.5,sec)-sec*0.5);
  vec2 q=length(p)*vec2(cos(a),sin(a));
  vec2 T=vec2(R,0.0);
  vec2 V=R*0.381966*vec2(cos(sec*0.5),sin(sec*0.5));
  vec2 e=V-T;
  return dot(q-T,normalize(vec2(e.y,-e.x)));
}
// official Turkish flag geometry in units of flag height G, hoist at x=0; <0 = white
float flagD(vec2 q){
  float outer=length(q-vec2(0.5,0.0))-0.25;
  float inner=length(q-vec2(0.5625,0.0))-0.2;
  return min(max(outer,-inner),starD(q-vec2(0.8208,0.0),0.125));
}
float emblemD(vec2 p,float s){ return flagD(p/s+vec2(0.598,0.0))*s; }
`;
// scene(p) is authored in display space; soft-clip, then linearise for the HDR pipeline
export const SHADER_MAIN = `
void main(){
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 c=max(scene(p),0.0);
  vec3 k=max(c-0.8,0.0);
  c=min(c,0.8)+0.2*(1.0-exp(-k*5.0));
  gl_FragColor=vec4(pow(c,vec3(2.2)),1.0);
}`;
const FS_VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }';

// full-screen shader quad; drawn first (behind everything) when used inside a 3D scene
export function backgroundQuad(ctx, src) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: ctx.U, vertexShader: FS_VERT, fragmentShader: SHADER_HEAD + src + SHADER_MAIN,
    depthTest: false, depthWrite: false
  }));
  m.frustumCulled = false;
  m.renderOrder = -1000;
  return m;
}

export class ShaderScene {
  constructor(ctx, def) {
    Object.assign(this, def);
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.scene.add(backgroundQuad(ctx, def.src));
  }
  resize() {}
  update() {}
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- textures ----------
export function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function grungeTex(repeat) {
  const t = canvasTex(512, (g, n) => {
    g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * n, y = Math.random() * n, r = 4 + Math.random() * 42;
      const v = Math.floor(90 + Math.random() * 165);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

// studio reflections with red light panels so the chrome picks up the flag colour
function makeEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(renderer);
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff1020).multiplyScalar(6), side: THREE.DoubleSide });
  const panel = (x, y, z, ry, sx, sy) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), red);
    m.position.set(x, y, z); m.rotation.y = ry; m.scale.set(sx, sy, 1);
    room.add(m);
  };
  panel(-15.5, 7, -3, Math.PI / 2, 12, 2.5);
  panel(15.5, 3, 5, -Math.PI / 2, 14, 1.5);
  panel(0, 1, -14, 0, 20, 1.2);
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return env;
}

// Exo 2 Black Italic; latin + latin-ext merged so Turkish letters (İ, Ş, Ğ) work in 3D text
async function loadFont() {
  const load = url => new Promise((res, rej) => new TTFLoader().load(url, res, undefined, rej));
  const [a, b] = await Promise.all([load('fonts/exo2-latin-900-italic.woff'), load('fonts/exo2-latin-ext-900-italic.woff').catch(() => null)]);
  if (b) for (const k in b.glyphs) if (!a.glyphs[k]) a.glyphs[k] = b.glyphs[k];
  return new Font(a);
}

// real CC0 HDRI environments (Poly Haven) used for reflections and, in some scenes, as the visible backdrop
export const ENVS = {
  studio: ['Stüdyo', 'assets/hdri/studio_small_09_2k.hdr'],
  neon: ['Neon stüdyo', 'assets/hdri/neon_photostudio_2k.hdr'],
  city: ['Şanghay gece', 'assets/hdri/shanghai_bund_4k.hdr'],
  rooftop: ['Çatı gecesi', 'assets/hdri/rooftop_night_2k.hdr'],
  classic: ['Klasik', null]
};

export async function createContext(renderer) {
  const ctx = { renderer };
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = {}, pm = {};
  ctx.classicEnv = makeEnv(renderer);
  // equirectangular HDR texture (for backgrounds)
  ctx.loadHDR = key => hdr[key] || (hdr[key] = new RGBELoader().loadAsync(ENVS[key][1]).then(t => { t.mapping = THREE.EquirectangularReflectionMapping; return t; }));
  // prefiltered environment (for reflections)
  ctx.envMap = key => key === 'classic' ? Promise.resolve(ctx.classicEnv) : pm[key] || (pm[key] = ctx.loadHDR(key).then(t => pmrem.fromEquirectangular(t).texture));
  ctx.env = await ctx.envMap('studio').catch(() => ctx.classicEnv);
  ctx.font = await loadFont();
  ctx.glowTex = canvasTex(128, (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  });
  ctx.mats = {
    face: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.28, map: grungeTex(0.05), envMapIntensity: 1.35 }),
    faceSmall: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.3, map: grungeTex(3), envMapIntensity: 1.1 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, emissive: 0xe30a17, emissiveIntensity: 0.3, envMapIntensity: 1.5 }),
    clean: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.5 })
  };
  const spec = new THREE.DataTexture(new Uint8Array(64), 64, 1, THREE.RedFormat, THREE.UnsignedByteType);
  spec.minFilter = spec.magFilter = THREE.LinearFilter;
  const wave = new THREE.DataTexture(new Uint8Array(256).fill(128), 256, 1, THREE.RedFormat, THREE.UnsignedByteType);
  wave.minFilter = wave.magFilter = THREE.LinearFilter;
  const img = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  img.needsUpdate = true;
  // glyph atlas for the digital rain scene
  const gc = document.createElement('canvas');
  gc.width = GLYPHS.length * 64; gc.height = 64;
  const gg = gc.getContext('2d');
  gg.fillStyle = '#fff'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.font = '54px Anton, Impact, sans-serif';
  [...GLYPHS].forEach((ch, i) => gg.fillText(ch, i * 64 + 32, 34));
  const glyph = new THREE.CanvasTexture(gc);
  glyph.minFilter = THREE.LinearFilter; glyph.generateMipmaps = false;
  ctx.U = {
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 },
    uBeat: { value: 0 }, uTravel: { value: 0 }, uDrop: { value: 0 },
    uC1: { value: new THREE.Vector3(0.89, 0.04, 0.09) }, uAccent: { value: new THREE.Vector3(1, 1, 1) },
    uSpec: { value: spec }, uWave: { value: wave }, uGlyph: { value: glyph }, uImg: { value: img }, uHasImg: { value: 0 }, uImgAsp: { value: 0.75 }
  };
  // primary / secondary as linear colours for the 3D materials
  ctx.c1 = new THREE.Color(0xe30a17);
  ctx.c2 = new THREE.Color(0xffffff);
  ctx.update = (S) => {
    ctx.c1.setStyle(S.c1); ctx.c2.setStyle(S.c2);
    hexVec(S.c1, ctx.U.uC1.value); hexVec(S.c2, ctx.U.uAccent.value);
    ctx.mats.edge.emissive.copy(ctx.c1);
    ctx.mats.edge.emissiveIntensity = 0.2 + S.beat * 1.1 + S.bass * 0.2 + S.drop * 1.5;
  };
  return ctx;
}

// ---------- geometry ----------
export function chromeText(ctx, str, { size = 8, depth = 2.4, shear = 0.08, stretch = 1.12, face = 'face' } = {}) {
  const g = new TextGeometry(str.trim() || ' ', {
    font: ctx.font, size, height: depth, curveSegments: 10,
    bevelEnabled: true, bevelThickness: size * 0.0875, bevelSize: size * 0.0375, bevelSegments: 5
  });
  g.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, shear, 0, 0, 0));
  g.scale(stretch, 1, 1);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  const mesh = new THREE.Mesh(g, [ctx.mats[face], ctx.mats.edge]);
  return { mesh, width: b.max.x - b.min.x, height: b.max.y - b.min.y };
}

// crescent and star in official proportions (flag height = 1), centred on the origin; width 0.696, height 0.5
export function emblemGeometry() {
  const cres = new THREE.Shape();
  const a1 = Math.atan2(0.13369, 0.21125);
  cres.absarc(0.5, 0, 0.25, a1, Math.PI * 2 - a1, false);
  const a2 = Math.atan2(0.13369, 0.14875);
  cres.absarc(0.5625, 0, 0.2, Math.PI * 2 - a2, a2, true);
  const star = new THREE.Shape();
  const R = 0.125, Ri = R * 0.381966;
  for (let k = 0; k < 10; k++) {
    const ang = Math.PI + k * Math.PI / 5, r = k % 2 ? Ri : R;
    const x = 0.8208 + Math.cos(ang) * r, y = Math.sin(ang) * r;
    k ? star.lineTo(x, y) : star.moveTo(x, y);
  }
  star.closePath();
  const g = new THREE.ExtrudeGeometry([cres, star], { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.008, bevelSegments: 4, curveSegments: 96 });
  g.translate(-0.598, 0, -0.03);
  return g;
}

let sparkGeo;
function sparkleGeometry() {
  if (sparkGeo) return sparkGeo;
  const s = new THREE.Shape(), r = 0.13;
  for (let k = 0; k <= 4; k++) {
    const a = Math.PI / 2 - k * Math.PI / 2;
    if (k === 0) { s.moveTo(Math.cos(a), Math.sin(a)); continue; }
    const m = a + Math.PI / 4;
    s.quadraticCurveTo(Math.cos(m) * r, Math.sin(m) * r, Math.cos(a), Math.sin(a));
  }
  sparkGeo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 3, curveSegments: 12 });
  sparkGeo.center();
  return sparkGeo;
}

// defs: [x, y, z (fractions of unit), size, phase]
export function makeSparkles(ctx, defs) {
  const group = new THREE.Group();
  const list = defs.map(([x, y, z, sz, ph]) => {
    const m = new THREE.Mesh(sparkleGeometry(), ctx.mats.clean);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    glow.scale.setScalar(1.4);
    m.add(glow);
    group.add(m);
    return { m, glow, x, y, z, sz, ph };
  });
  group.userData.update = (t, S, unit) => list.forEach(s => {
    const tw = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.3 + s.ph)) + S.high * 0.3 + S.beat * 0.35;
    s.m.position.set(s.x * unit, s.y * unit, s.z * unit);
    s.m.scale.setScalar(s.sz * unit * tw);
    s.m.rotation.z = Math.sin(t * 0.8 + s.ph) * 0.4;
    s.m.rotation.y = t * 0.9 + s.ph;
    s.glow.material.opacity = 0.15 + 0.35 * tw;
  });
  return group;
}

// drifting dust that flies toward the camera; speed follows the bass
export function makeDust(n = 900, spread = [400, 240, 420], size = 0.45) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
    pos[i * 3 + 2] = -Math.random() * spread[2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  pts.frustumCulled = false;
  pts.userData.update = (dt, speed, camZ) => {
    const a = g.attributes.position.array;
    for (let i = 2; i < a.length; i += 3) {
      a[i] += dt * speed;
      if (a[i] > camZ) a[i] -= spread[2];
    }
    g.attributes.position.needsUpdate = true;
  };
  return pts;
}

export function glowSprite(ctx, color, opacity) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTex, color, blending: THREE.AdditiveBlending, transparent: true, opacity, depthWrite: false }));
}

// full 360 spin every `period` beats and on every drop
export class Spinner {
  constructor(period = 16, dur = 1.7) { this.period = period; this.dur = dur; this.t = -1; this.last = -1; this.lastDrop = 0; this.d = dur; }
  update(S, dt) {
    if (S.beatCount !== this.last && S.beatCount % this.period === 0) { this.last = S.beatCount; this.t = 0; this.d = this.dur; }
    if (S.dropCount !== this.lastDrop) { this.lastDrop = S.dropCount; this.t = 0; this.d = 1.1; }
    if (this.t < 0) return 0;
    this.t += dt / this.d;
    if (this.t >= 1) { this.t = -1; return 0; }
    return ease(this.t) * Math.PI * 2;
  }
}
