// More 3D scenes: a chrome/neon gyroscope and a spectrum-history terrain.
import * as THREE from 'three';
import { backgroundQuad, makeDust, makeSparkles, Spinner } from '../common.js';
import { BG_DARK } from './shaders.js';

const BG_SUN = `
vec3 scene(vec2 p){
  vec3 c=mix(RED*0.22,vec3(0.0),clamp((p.y+0.05)*2.2,0.0,1.0));
  vec2 sc=vec2(0.0,0.08); float sr=0.22+uBass*0.02;
  float d=length(p-sc);
  vec3 sun=mix(RED*1.1,uAccent,clamp((p.y-sc.y+sr)/(2.0*sr),0.0,1.0));
  float k=fract(p.y*26.0-uTime*0.6);
  float gap=clamp((sc.y-p.y)/sr,0.0,1.0)*0.75;
  c+=sun*smoothstep(sr,sr-0.004,d)*step(gap,k);
  c+=sun*0.3*exp(-max(d-sr,0.0)*6.0)*smoothstep(sr-0.01,sr,d)*(0.7+uBeat*0.6);
  return c;
}`;

export class RingsScene {
  constructor(ctx) {
    Object.assign(this, { key: 'rings', cat: '3d', name: 'Neon Halkalar', energy: 'mid', textPos: [0.5, 0.9, 0.7] });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 1000);
    this.scene.add(backgroundQuad(ctx, BG_DARK));
    this.neon = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.4, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 2 });
    this.neon2 = this.neon.clone();
    this.rings = [];
    for (let i = 0; i < 7; i++) {
      const r = 5 + i * 1.9;
      const mat = i % 3 === 1 ? this.neon : i % 3 === 2 ? this.neon2 : ctx.mats.clean;
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, i % 3 ? 0.12 : 0.32, 24, 200), mat);
      const g = new THREE.Group();
      g.add(m);
      g.userData = { ax: new THREE.Vector3(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9)).normalize(), sp: (i % 2 ? -1 : 1) * (0.25 + i * 0.07) };
      this.rings.push(g);
      this.scene.add(g);
    }
    this.core = new THREE.Mesh(new THREE.SphereGeometry(3, 64, 32), ctx.mats.clean);
    this.scene.add(this.core);
    this.sparkles = makeSparkles(ctx, [[-0.9, 0.5, 0.2, 0.06, 0], [0.85, -0.45, 0.1, 0.05, 2], [0.7, 0.55, -0.3, 0.04, 4], [-0.7, -0.6, -0.2, 0.035, 1]]);
    this.scene.add(this.sparkles);
    this.dust = makeDust(900, [200, 120, 200], 0.25);
    this.scene.add(this.dust);
    this.spinner = new Spinner(16);
    this.q = new THREE.Quaternion();
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dist = w < h ? 70 : 42; }
  update(S, t, dt) {
    this.neon.emissive.copy(this.ctx.c1);
    this.neon2.emissive.copy(this.ctx.c2);
    this.neon.emissiveIntensity = 1.5 + S.beat * 3 + S.drop * 4;
    this.neon2.emissiveIntensity = 0.8 + S.high * 2;
    const boost = 1 + S.bass * 2 + S.drop * 6;
    this.rings.forEach(g => {
      this.q.setFromAxisAngle(g.userData.ax, g.userData.sp * dt * boost);
      g.quaternion.premultiply(this.q);
    });
    this.core.scale.setScalar(1 + S.beat * 0.12 + S.bass * 0.05);
    this.core.rotation.y = this.spinner.update(S, dt);
    this.sparkles.userData.update(t, S, 30);
    this.camera.position.set(Math.sin(t * 0.17) * 8, Math.sin(t * 0.13) * 5, this.dist - S.drop * 8);
    this.camera.lookAt(0, 0, 0);
    this.dust.userData.update(dt, 6 + S.bass * 30, 100);
  }
  render(r) { r.render(this.scene, this.camera); }
}

const COLS = 96, ROWS = 72, TW = 150, TD = 220;

export class TerrainScene {
  constructor(ctx) {
    Object.assign(this, { key: 'terrain', cat: 'eq', name: 'EQ Dağları', energy: 'high', textPos: [0.5, 0.16, 0.7] });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x000000, 70, 210);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    this.scene.add(backgroundQuad(ctx, BG_SUN));
    this.geo = new THREE.PlaneGeometry(TW, TD, COLS - 1, ROWS - 1);
    this.geo.rotateX(-Math.PI / 2);
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COLS * ROWS * 3), 3));
    const solid = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0x020001, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const wire = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true }));
    this.scene.add(solid, wire);
    this.hist = new Float32Array(COLS * ROWS);
    this.acc = 0;
    this.col = new THREE.Color();
    this.tmp = new THREE.Color();
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(S, t, dt) {
    const spec = this.ctx.U.uSpec.value.image.data;
    this.acc += dt;
    while (this.acc > 1 / 30) {
      this.acc -= 1 / 30;
      this.hist.copyWithin(COLS, 0, COLS * (ROWS - 1));
      for (let c = 0; c < COLS; c++) {
        const k = Math.abs(c - (COLS - 1) / 2) / ((COLS - 1) / 2);
        const v = spec[Math.min(63, Math.floor(k * 0.85 * 64))] / 255;
        this.hist[c] = v * 22 * (1 - 0.35 * k) * (1 + S.drop) + (Math.random() * 0.3);
      }
    }
    const pos = this.geo.attributes.position.array, col = this.geo.attributes.color.array;
    const c1 = this.ctx.c1, c2 = this.ctx.c2;
    for (let i = 0; i < COLS * ROWS; i++) {
      const h = this.hist[i];
      pos[i * 3 + 1] = h;
      const m = Math.min(1, h / 14);
      this.col.copy(c1).multiplyScalar(1.4).lerp(this.tmp.copy(c2).multiplyScalar(1.8), m * m);
      col[i * 3] = this.col.r; col[i * 3 + 1] = this.col.g; col[i * 3 + 2] = this.col.b;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.camera.position.set(Math.sin(t * 0.2) * 12, 16 + Math.sin(t * 0.3) * 3 + S.bass * 2, 100);
    this.camera.lookAt(0, 4, -40);
  }
  render(r) { r.render(this.scene, this.camera); }
}
