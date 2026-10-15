// 20k particles that morph between words and the crescent-star, swirling in between and exploding on drops.
import * as THREE from 'three';
import { backgroundQuad, ease } from '../common.js';
import { BG_DARK } from './shaders.js';

const N = 20000, CW = 1024, CH = 512, WORLD = 80;

function sample(draw) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g);
  const d = g.getImageData(0, 0, CW, CH).data;
  const pts = [];
  for (let y = 0; y < CH; y += 2) for (let x = 0; x < CW; x += 2) if (d[(y * CW + x) * 4 + 3] > 128) pts.push(x, y);
  const out = new Float32Array(N * 3);
  const n = pts.length / 2;
  for (let i = 0; i < N; i++) {
    if (!n) { out[i * 3] = (Math.random() - 0.5) * WORLD; out[i * 3 + 1] = (Math.random() - 0.5) * WORLD * 0.5; continue; }
    const j = (Math.random() * n | 0) * 2;
    out[i * 3] = (pts[j] + Math.random() * 2 - CW / 2) / CW * WORLD;
    out[i * 3 + 1] = -(pts[j + 1] + Math.random() * 2 - CH / 2) / CW * WORLD;
    out[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  return out;
}
const word = str => g => {
  let s = 300;
  g.font = `${s}px Anton, Impact, sans-serif`;
  const w = g.measureText(str).width;
  if (w > CW * 0.92) { s *= CW * 0.92 / w; g.font = `${s}px Anton, Impact, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(str, CW / 2, CH / 2);
};
const emblem = g => {
  const G = CH * 0.9, x0 = CW / 2 - 0.598 * G, y0 = CH / 2;
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(x0 + 0.5 * G, y0, 0.25 * G, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(x0 + 0.5625 * G, y0, 0.2 * G, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = Math.PI + k * Math.PI / 5, r = (k % 2 ? 0.125 * 0.381966 : 0.125) * G;
    const x = x0 + 0.8208 * G + Math.cos(a) * r, y = y0 - Math.sin(a) * r;
    k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.fill();
};

export class ParticleScene {
  constructor(ctx) {
    Object.assign(this, { key: 'particles', name: 'Partikül', energy: 'mid', textPos: null });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 1000);
    this.scene.add(backgroundQuad(ctx, BG_DARK));
    this.shapes = [null, emblem, word('29 EKİM'), word('1923'), word('CUMHURİYET'), emblem];
    this.targets = [];
    this.idx = 0;
    this.morph = 1;
    this.lastSwitch = -1;
    this.lastDrop = 0;
    this.explode = 0;

    const g = new THREE.BufferGeometry();
    const rand = new Float32Array(N);
    for (let i = 0; i < N; i++) rand[i] = Math.random();
    this.from = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    this.to = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aFrom', this.from);
    g.setAttribute('aTo', this.to);
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uMorph: { value: 1 }, uTime: { value: 0 }, uBass: { value: 0 }, uBeat: { value: 0 }, uExplode: { value: 0 },
        uPx: { value: 300 }, uCol1: { value: new THREE.Color() }, uCol2: { value: new THREE.Color(1, 1, 1) }
      },
      vertexShader: `
attribute vec3 aFrom; attribute vec3 aTo; attribute float aRand;
uniform float uMorph, uTime, uBass, uBeat, uExplode, uPx;
uniform vec3 uCol1, uCol2;
varying vec3 vCol; varying float vA;
void main(){
  float m=smoothstep(aRand*0.5,aRand*0.5+0.5,uMorph);
  vec3 p=mix(aFrom,aTo,m);
  float mid=sin(m*3.14159);
  p+=vec3(sin(aRand*91.0+uTime*1.7),cos(aRand*57.0+uTime*1.3),sin(aRand*33.0+uTime))*mid*9.0;
  vec3 dir=normalize(vec3(p.xy,(aRand-0.5)*30.0)+0.0001);
  p+=dir*uExplode*(8.0+aRand*45.0);
  p.z+=sin(p.x*0.25+uTime*2.0)*uBass*2.0;
  p.xy+=vec2(sin(uTime*0.7+aRand*6.28),cos(uTime*0.9+aRand*6.28))*0.12;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(0.5+aRand*1.2)*(1.0+uBeat*0.5)*uPx/(-mv.z);
  vCol=aRand>0.62?uCol2*1.3:uCol1*2.2;
  vA=0.55+0.45*sin(uTime*3.0+aRand*50.0);
}`,
      fragmentShader: `
varying vec3 vCol; varying float vA;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=smoothstep(0.5,0.0,d);
  gl_FragColor=vec4(vCol*a*vA,a);
}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }
  target(i, S) {
    if (i === 0) {
      if (this.nameBuilt !== S.name) { this.nameBuilt = S.name; this.targets[0] = sample(word(S.name || ' ')); }
    } else if (!this.targets[i]) this.targets[i] = sample(this.shapes[i]);
    return this.targets[i];
  }
  go(i, S) {
    const cur = this.to.array;
    // freeze where particles are now, then head for the next shape
    this.from.array.set(this.morph >= 1 ? cur : this.from.array.map((v, k) => v + (cur[k] - v) * ease(this.morph)));
    this.to.array.set(this.target(i, S));
    this.from.needsUpdate = this.to.needsUpdate = true;
    this.idx = i;
    this.morph = 0;
  }
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.mat.uniforms.uPx.value = h * 0.32;
  }
  update(S, t, dt) {
    if (!this.started) {
      this.started = true;
      this.to.array.set(this.target(0, S));
      this.from.array.set(this.target(1, S));
      this.morph = 0;
      this.from.needsUpdate = this.to.needsUpdate = true;
    }
    if (S.beatCount !== this.lastSwitch && S.beatCount % 16 === 0) { this.lastSwitch = S.beatCount; this.go((this.idx + 1) % this.shapes.length, S); }
    if (S.dropCount !== this.lastDrop) { this.lastDrop = S.dropCount; this.explode = 1; this.go(0, S); }
    this.morph = Math.min(1, this.morph + dt / 2.4);
    this.explode *= Math.exp(-dt * 1.6);
    const u = this.mat.uniforms;
    u.uMorph.value = this.morph;
    u.uTime.value = t;
    u.uBass.value = S.bass;
    u.uBeat.value = S.beat;
    u.uExplode.value = this.explode + S.beat * 0.04;
    u.uCol1.value.copy(this.ctx.c1);
    u.uCol2.value.copy(this.ctx.c2);
    this.camera.position.set(Math.sin(t * 0.15) * 18, Math.sin(t * 0.11) * 6, 78);
    this.camera.lookAt(0, 0, 0);
  }
  render(r) { r.render(this.scene, this.camera); }
}
