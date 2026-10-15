// Drop logo sting: an HDR chrome reveal of the artist name, composited over whatever scene is running.
// Fly-in from the lens with an overshoot-free settle, a light sweep across the polished faces with a flare riding its head
// (the lens pass turns that into an anamorphic streak), a spark burst on impact, then a quick push-through exit.
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const easeOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Unbounded Black: latin + latin-ext merged so İ, Ş, Ğ work
async function loadUnbounded() {
  const load = url => new Promise((res, rej) => new TTFLoader().load(url, res, undefined, rej));
  const [a, b] = await Promise.all([load('fonts/unbounded-latin-900-normal.woff'), load('fonts/unbounded-latin-ext-900-normal.woff').catch(() => null)]);
  if (b) for (const k in b.glyphs) if (!a.glyphs[k]) a.glyphs[k] = b.glyphs[k];
  return new Font(a);
}

// product-shot studio for chrome: black room, long white softbox strips and a palette-coloured rim strip,
// so the metal shows crisp bright/dark bands instead of a flat grey
function chromeStudio(renderer, rim) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x000000);
  const strip = (color, k, x, y, z, rx, ry, sx, sy) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.scale.set(sx, sy, 1);
    room.add(m);
  };
  strip(0xffffff, 9, 0, 9, 2, Math.PI / 2, 0, 26, 2.2);        // overhead strip
  strip(0xffffff, 6, -10, 1, 4, 0, Math.PI / 2, 3, 14);        // left vertical softbox
  strip(0xffffff, 4, 10, -1, 6, 0, -Math.PI / 2, 2, 12);       // right
  strip(0xffffff, 3, 0, -2, 14, 0, Math.PI, 30, 0.8);          // behind camera: the horizon line across the faces
  strip(rim, 7, 0, -6, -10, 0, 0, 30, 1.4);                    // coloured rim from below/behind
  // the big one: a graded softbox wall behind the camera that the front faces actually see —
  // bright sky fading down, a crisp dark horizon, then a dim floor (the classic chrome read)
  const gc = document.createElement('canvas'); gc.width = 4; gc.height = 256;
  const gg = gc.getContext('2d'), gr = gg.createLinearGradient(0, 0, 0, 256);
  // broad on purpose: the prefiltered (blurred) environment would wash out a thin horizon line
  [[0, '#ffffff'], [0.27, '#f2f5fa'], [0.45, '#8a93a5'], [0.6, '#1e2028'], [0.64, '#000000'], [0.72, '#4a3e34'], [0.8, '#2a221c'], [1, '#000000']].forEach(([o, c]) => gr.addColorStop(o, c));
  gg.fillStyle = gr; gg.fillRect(0, 0, 4, 256);
  const wt = new THREE.CanvasTexture(gc); wt.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ map: wt, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide }));
  // spans -45°..56° seen from the logo: white sky above ~40°, horizon just below 0°, a warm floor bounce at -20°
  wall.position.set(0, 4, 16); wall.rotation.y = Math.PI;
  room.add(wall);
  strip(0x9fb8ff, 0.2, 0, -8, 4, -Math.PI / 2, 0, 30, 18);     // faint cool floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.015).texture;
  pm.dispose();
  return env;
}

export class Sting {
  constructor(ctx) {
    this.ctx = ctx;
    this.envs = {};
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 500);
    this.camera.position.set(0, 0, 40);
    // uPersp exaggerates the reflection perspective (as if the lens were much closer) so every flat face shows the
    // sky -> horizon -> floor gradient of real chrome type instead of one flat colour
    this.U = { uSweep: { value: -100 }, uSweepAmt: { value: 0 }, uEdge: { value: new THREE.Color() }, uPersp: { value: 7 } };
    const U = this.U;
    this.face = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, envMapIntensity: 1.0 });
    this.side = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.22, envMapIntensity: 0.9, emissive: 0xffffff, emissiveIntensity: 0 });
    for (const m of [this.face, this.side]) {
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSwPos;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvSwPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSwPos; uniform float uSweep, uSweepAmt, uPersp; uniform vec3 uEdge;')
          .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>\ngeometryViewDir=normalize(vec3(vViewPosition.xy*uPersp,vViewPosition.z));')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float swd=vSwPos.x+vSwPos.y*0.45-uSweep;
  float sw=exp(-swd*swd*1.6);
  totalEmissiveRadiance+=vec3(1.0,0.97,0.92)*sw*uSweepAmt*(0.35+0.65*abs(normal.z));
  totalEmissiveRadiance+=uEdge*(1.0-abs(normal.z))*0.6;`);
      };
    }
    this.logo = new THREE.Group();
    this.scene.add(this.logo);
    // flare riding the sweep head: an HDR-bright soft dot the lens pass streaks horizontally
    const light = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthWrite: false };
    // hot pin-point core with a steep falloff; its brightness (not its size) is what the lens pass turns into a streak
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const r = Math.hypot(x - 63.5, y - 63.5) / 64, a = Math.min(1, Math.exp(-r * 9) * 1.4 + Math.exp(-r * 3.5) * 0.15) * (r < 1 ? 1 : 0);
      img.data.set([255, 255, 255, a * 255], (y * 128 + x) * 4);
    }
    g.putImageData(img, 0, 0);
    const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: new THREE.Color(1, 0.96, 0.9).multiplyScalar(5), depthTest: false, ...light }));
    this.scene.add(this.flare);
    // sparks
    const n = 360;
    this.sp = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 3) };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sp.col, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ map: ctx.glowTex, size: 0.22, vertexColors: true, ...light }));
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);
    this.t = -1; this.dur = 3; this.aspect = 16 / 9; this.built = null; this.w = 30;
    this.font = null;
    loadUnbounded().then(f => { this.font = f; }).catch(() => { this.font = ctx.font; });
  }
  get active() { return this.t >= 0; }
  build(name) {
    this.built = name;
    this.logo.children.forEach(o => o.geometry.dispose());
    this.logo.clear();
    const size = 4;
    const g = new TextGeometry(name.trim() || ' ', { font: this.font, size, height: size * 0.32, curveSegments: 12, bevelEnabled: true, bevelThickness: size * 0.09, bevelSize: size * 0.055, bevelSegments: 8 });
    g.computeBoundingBox();
    const b = g.boundingBox;
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
    this.w = b.max.x - b.min.x; this.h = b.max.y - b.min.y;
    this.logo.add(new THREE.Mesh(g, [this.face, this.side]));
    this.fit();
  }
  resize(w, h) { this.aspect = w / h; this.fit(); }
  fit() {
    const c = this.camera;
    c.aspect = this.aspect;
    c.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
    this.dist = Math.max((this.w / 0.72 / 2) / (t * this.aspect), (this.h * 3.2 / 2) / t);
  }
  // seconds; the reveal is paced to the music: ~6 beats
  fire(S) {
    if (!this.font) return;
    this.dur = Math.min(4.2, Math.max(2.2, 6 * 60 / (S.bpm || 128)));
    this.t = 0;
    this.burstDone = false;
  }
  burst() {
    const s = this.sp, c1 = this.ctx.c1;
    for (let i = 0; i < s.n; i++) {
      const x = (Math.random() - 0.5) * this.w, y = (Math.random() - 0.5) * this.h * 0.9;
      s.pos.set([x, y, 1], i * 3);
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 14;
      s.vel.set([Math.cos(a) * v + x * 0.3, Math.sin(a) * v * 0.7, (Math.random() - 0.3) * 8], i * 3);
      const hot = Math.random() < 0.6;
      const k = 0.6 + Math.random() * 1.1;
      s.col.set(hot ? [k, k * 0.9, k * 0.75] : [c1.r * k * 1.5, c1.g * k * 1.5, c1.b * k * 1.5], i * 3);
    }
  }
  update(S, dt) {
    if (S.name !== this.built && this.font) this.build(S.name);
    if (this.t < 0) return 0;
    this.t += dt / this.dur;
    if (this.t >= 1) { this.t = -1; return 0; }
    const u = this.t, w = this.w;
    const rim = '#' + this.ctx.c1.getHexString();
    this.scene.environment = this.envs[rim] || (this.envs[rim] = chromeStudio(this.ctx.renderer, this.ctx.c1.clone()));
    // fly-in from just in front of the lens, settle by 28%
    const fin = easeOutExpo(Math.min(1, u / 0.28));
    const exit = smooth(0.84, 1, u);
    this.logo.position.z = (1 - fin) * this.dist * 0.92 + exit * this.dist * 0.5;
    this.logo.rotation.y = (1 - fin) * -0.7 + Math.sin(u * 5) * 0.09 * fin;
    this.logo.rotation.x = this._rx ?? ((1 - fin) * 0.25 - 0.14 + Math.sin(u * 4.0 + 0.5) * 0.08);
    this.camera.position.set(Math.sin(u * 3) * w * 0.02, 0, this.dist);
    this.camera.lookAt(0, 0, 0);
    // light sweep left -> right across the faces, then a faster second pass
    const s1 = smooth(0.24, 0.6, u), s2 = smooth(0.62, 0.8, u);
    const span = w * 0.75 + 6;
    const sweep = u < 0.61 ? -span + s1 * span * 2 : -span + s2 * span * 2;
    this.U.uSweep.value = sweep;
    this.U.uSweepAmt.value = u < 0.61 ? Math.sin(s1 * Math.PI) * 1.1 : Math.sin(s2 * Math.PI) * 0.7;
    this.U.uEdge.value.copy(this.ctx.c1).multiplyScalar(0.4 + Math.min(1, S.beat) * 1.2 + S.drop);
    this.flare.position.set(sweep - this.h * 0.2, this.h * 0.5, this.logo.position.z + 1.5);
    const fl = u < 0.61 ? Math.sin(s1 * Math.PI) : Math.sin(s2 * Math.PI) * 0.7;
    this.flare.scale.setScalar(this.h * (0.5 + fl * 0.9));
    this.flare.material.opacity = fl;
    if (!this.burstDone && u > 0.2) { this.burstDone = true; this.burst(); }
    const s = this.sp;
    for (let i = 0; i < s.n * 3; i++) {
      s.vel[i] *= 1 - dt * 1.6;
      if (i % 3 === 1) s.vel[i] -= dt * 6;
      s.pos[i] += s.vel[i] * dt;
      s.col[i] *= 1 - dt * 1.4;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;
    // overlay strength: fade in fast, out with the push-through
    return smooth(0, 0.05, u) * (1 - exit);
  }
  render(r) { r.render(this.scene, this.camera); }
}
