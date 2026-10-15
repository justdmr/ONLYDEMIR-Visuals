// Circular 3D spectrum (mirrored halves) with a reflection, orbiting camera and a chrome crescent-star in the middle.
import * as THREE from 'three';
import { emblemGeometry, backgroundQuad, makeDust, Spinner } from '../common.js';
import { BG_DARK } from './shaders.js';

const BARS = 128, RADIUS = 22;

export class SpectrumScene {
  constructor(ctx) {
    Object.assign(this, { key: 'spectrum', name: 'Spektrum 3D', energy: 'high', textPos: [0.5, 0.12, 0.7] });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 1000);
    this.scene.add(backgroundQuad(ctx, BG_DARK));

    const box = new THREE.BoxGeometry(0.7, 1, 0.7);
    box.translate(0, 0.5, 0);
    this.bars = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), BARS);
    this.refl = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }), BARS);
    this.scene.add(this.bars, this.refl);
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    this.tmp = new THREE.Color();
    this.h = new Float32Array(BARS);

    const floor = new THREE.Mesh(new THREE.RingGeometry(RADIUS - 0.15, RADIUS + 0.15, 256), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2;
    this.floor = floor;
    this.scene.add(floor);

    this.emblem = new THREE.Mesh(emblemGeometry(), [ctx.mats.faceSmall, ctx.mats.edge]);
    this.emblem.scale.setScalar(26);
    this.emblem.position.y = 9;
    this.scene.add(this.emblem);
    this.dust = makeDust(900, [200, 120, 200], 0.25);
    this.scene.add(this.dust);
    this.spinner = new Spinner(16);
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.portrait = w < h; }
  update(S, t, dt) {
    const spec = this.ctx.U.uSpec.value.image.data;
    const c1 = this.ctx.c1, c2 = this.ctx.c2;
    this.floor.material.color.copy(c1).multiplyScalar(1.3);
    for (let i = 0; i < BARS; i++) {
      const k = i < BARS / 2 ? i : BARS - 1 - i;
      const v = spec[Math.min(63, Math.floor(k / (BARS / 2) * 64))] / 255;
      this.h[i] += (v - this.h[i]) * Math.min(1, dt * 18);
      const hgt = 0.3 + this.h[i] * 16 * (1 + S.drop);
      const a = i / BARS * Math.PI * 2 + Math.PI / 2;
      const d = this.dummy;
      d.position.set(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
      d.rotation.set(0, -a, 0);
      d.scale.set(1, hgt, 1);
      d.updateMatrix();
      this.bars.setMatrixAt(i, d.matrix);
      d.scale.set(1, -hgt * 0.6, 1);
      d.updateMatrix();
      this.refl.setMatrixAt(i, d.matrix);
      const m = Math.pow(Math.min(1, this.h[i]), 2);
      this.col.copy(c1).multiplyScalar(1.3).lerp(this.tmp.copy(c2).multiplyScalar(1.4), m);
      this.bars.setColorAt(i, this.col);
      this.refl.setColorAt(i, this.col);
    }
    [this.bars, this.refl].forEach(b => { b.instanceMatrix.needsUpdate = true; b.instanceColor.needsUpdate = true; });

    this.emblem.rotation.y = Math.sin(t * 0.5) * 0.5 + this.spinner.update(S, dt);
    this.emblem.scale.setScalar(26 * (1 + S.beat * 0.05));
    const r = (this.portrait ? 95 : 58) - S.drop * 15;
    const a = t * 0.12;
    this.camera.position.set(Math.sin(a) * r, 16 + Math.sin(t * 0.3) * 6, Math.cos(a) * r);
    this.camera.lookAt(0, 5, 0);
    this.dust.userData.update(dt, 4 + S.bass * 20, 100);
  }
  render(r) { r.render(this.scene, this.camera); }
}
