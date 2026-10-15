// Chrome hero scenes: a centrepiece that flies forward/back and spins 360, with a halo ring, sparkles and dust.
import * as THREE from 'three';
import { chromeText, emblemGeometry, makeSparkles, makeDust, backgroundQuad, glowSprite, Spinner } from '../common.js';
import { BG_DARK, BG_RAYS, BG_LASERS } from './shaders.js';

const SPARK = [[-0.40, 0.25, 0.05, 0.055, 0], [-0.31, 0.36, -0.05, 0.035, 1.3], [0.36, -0.22, 0.06, 0.05, 2.1], [0.45, -0.14, -0.04, 0.04, 3.4], [0.52, 0.33, -0.2, 0.025, 4.2], [-0.55, -0.28, -0.15, 0.022, 5.1]];

class ChromeStage {
  constructor(ctx, { bg, ring = 0.56, ringTilt = 0.3, spinEvery = 16 }) {
    this.ctx = ctx;
    this.ringK = ring;
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 3000);
    this.scene.add(backgroundQuad(ctx, bg));
    this.root = new THREE.Group();
    this.hero = new THREE.Group();
    this.ringPivot = new THREE.Group();
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.011, 24, 256), ctx.mats.clean);
    this.ring.rotation.x = Math.PI / 2 - ringTilt;
    this.ringPivot.add(this.ring);
    this.ringPivot.rotation.z = 0.2;
    this.sparkles = makeSparkles(ctx, SPARK);
    this.haze = glowSprite(ctx, 0xe30a17, 0.1);
    this.haze.position.z = -25;
    this.root.add(this.hero, this.ringPivot, this.sparkles, this.haze);
    this.scene.add(this.root);
    this.dust = makeDust();
    this.scene.add(this.dust);
    this.spinner = new Spinner(spinEvery);
    this.w = 60; this.h = 10; this.aspect = 16 / 9;
  }
  setContent(obj, w, h) {
    this.hero.clear();
    this.hero.add(obj);
    this.w = w; this.h = h;
    this.haze.scale.set(w * 2.4, w * 1.1, 1);
    this.fit();
  }
  resize(w, h) { this.aspect = w / h; this.fit(); }
  fit() {
    const c = this.camera;
    c.aspect = this.aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
    const distW = (this.w * 1.45 / 2) / (t * this.aspect);
    const distH = (Math.max(this.h * 1.7, this.w * 0.6) / 2) / t;
    this.dist = Math.max(distW, distH) + 6;
    c.updateProjectionMatrix();
  }
  update(S, t, dt) {
    const w = this.w;
    const spin = this.spinner.update(S, dt);
    this.hero.rotation.y = Math.sin(t * 0.7) * 0.3 + spin;
    this.hero.rotation.x = Math.sin(t * 0.5) * 0.08;
    this.root.position.z = Math.sin(t * 0.9) * w * 0.14 + S.beat * w * 0.06 + S.drop * w * 0.12;
    this.root.position.y = Math.sin(t * 0.6) * w * 0.015;
    this.ringPivot.rotation.y = t * 0.55 + S.drop * 2;
    this.ringPivot.rotation.x = Math.sin(t * 0.4) * 0.15;
    this.ring.scale.setScalar(w * this.ringK * (1 + S.beat * 0.03));
    this.sparkles.userData.update(t, S, w);
    this.haze.material.opacity = 0.05 + S.bass * 0.1;
    this.haze.material.color.copy(this.ctx.c1);
    this.camera.position.set(Math.sin(t * 0.21) * w * 0.08, Math.sin(t * 0.17) * w * 0.03, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.dust.userData.update(dt, 12 + S.bass * 70 + S.drop * 200, this.camera.position.z);
  }
  render(r) { r.render(this.scene, this.camera); }
}

export class LogoScene extends ChromeStage {
  constructor(ctx) {
    super(ctx, { bg: BG_DARK });
    Object.assign(this, { key: 'logo', name: 'ONLYDEMIR 3D', energy: 'high', textPos: null });
    this.built = null;
  }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      const { mesh, width, height } = chromeText(this.ctx, S.name || ' ');
      this.setContent(mesh, Math.max(20, width), height);
    }
    super.update(S, t, dt);
  }
}

export class EmblemScene extends ChromeStage {
  constructor(ctx) {
    super(ctx, { bg: BG_RAYS, ring: 0.62, ringTilt: 0.45, spinEvery: 32 });
    Object.assign(this, { key: 'emblem', name: 'Ay Yıldız 3D', energy: 'mid', textPos: [0.5, 0.9, 0.7] });
    const s = 40;
    const mesh = new THREE.Mesh(emblemGeometry(), [ctx.mats.faceSmall, ctx.mats.edge]);
    mesh.scale.setScalar(s);
    this.setContent(mesh, 0.696 * s, 0.5 * s);
  }
}

export class Text29Scene extends ChromeStage {
  constructor(ctx) {
    super(ctx, { bg: BG_LASERS, ring: 0.75, ringTilt: 0.35 });
    Object.assign(this, { key: '29', name: '29 Ekim 3D', energy: 'high', textPos: null });
    const g = new THREE.Group();
    const big = chromeText(ctx, '29', { size: 16, depth: 4, shear: 0.06 });
    const small = chromeText(ctx, 'EKİM', { size: 5.5, depth: 1.6 });
    big.mesh.position.y = 3.2;
    small.mesh.position.y = -big.height / 2 - 1.2;
    g.add(big.mesh, small.mesh);
    this.setContent(g, Math.max(big.width, small.width) * 1.25, big.height + small.height + 3);
  }
  extraText(S) {
    return [
      { t: 'CUMHURİYET BAYRAMI · 1923 — 2026', x: 0.5, y: 0.86, s: 0.045, w: 0.8 },
      { t: S.name, x: 0.5, y: 0.94, s: 0.05, w: 0.5, c: '#ff3040' }
    ];
  }
}
