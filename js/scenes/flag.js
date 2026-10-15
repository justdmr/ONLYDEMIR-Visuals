// Cloth Turkish flag (official proportions) waving on a chrome pole under stage lights.
import * as THREE from 'three';
import { canvasTex, backgroundQuad, makeDust, glowSprite } from '../common.js';
import { BG_STAGE } from './shaders.js';

const FW = 15, FH = 10, SX = 150, SY = 100;

function flagTexture() {
  const t = canvasTex(2048, (g, n) => {
    // canvas is square; the plane maps it 1.5:1 so draw in flag units with x scaled by 1/1.5
    const G = n, kx = n / (1.5 * G);
    g.fillStyle = '#e30a17'; g.fillRect(0, 0, n, n);
    g.save();
    g.scale(kx, 1);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0.5 * G, G / 2, 0.25 * G, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e30a17';
    g.beginPath(); g.arc(0.5625 * G, G / 2, 0.2 * G, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = Math.PI + k * Math.PI / 5, r = (k % 2 ? 0.125 * 0.381966 : 0.125) * G;
      const x = 0.8208 * G + Math.cos(a) * r, y = G / 2 - Math.sin(a) * r;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fill();
    g.restore();
  });
  t.anisotropy = 8;
  return t;
}

export class FlagScene {
  constructor(ctx) {
    this.ctx = ctx;
    Object.assign(this, { key: 'flag', name: 'Bayrak 3D', energy: 'low', textPos: [0.5, 0.9, 0.8] });
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 1000);
    this.scene.add(backgroundQuad(ctx, BG_STAGE));

    this.geo = new THREE.PlaneGeometry(FW, FH, SX, SY);
    this.base = this.geo.attributes.position.array.slice();
    this.flag = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.5 }));
    this.flag.position.set(FW / 2, 2.5, 0);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 30, 32), ctx.mats.clean);
    pole.position.set(-0.25, -5, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 16), ctx.mats.clean);
    knob.position.set(-0.25, 10.2, 0);
    this.rig = new THREE.Group();
    this.rig.add(this.flag, pole, knob);
    this.rig.position.x = -FW / 2;
    this.scene.add(this.rig);

    this.key1 = new THREE.DirectionalLight(0xffffff, 2.6);
    this.key1.position.set(-8, 10, 14);
    this.rim = new THREE.DirectionalLight(0xff2030, 3);
    this.rim.position.set(10, -4, -10);
    this.scene.add(this.key1, this.rim, new THREE.AmbientLight(0xffffff, 0.25));
    this.halo = glowSprite(ctx, 0xe30a17, 0.12);
    this.halo.scale.set(50, 30, 1);
    this.halo.position.set(0, 2, -15);
    this.scene.add(this.halo);
    this.dust = makeDust(700, [120, 70, 120], 0.12);
    this.scene.add(this.dust);
  }
  resize(w, h) {
    this.camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.dist = Math.max((FW * 1.35 / 2) / (t * this.camera.aspect), (FH * 1.6 / 2) / t);
    this.camera.updateProjectionMatrix();
  }
  update(S, t, dt) {
    const p = this.geo.attributes.position.array, b = this.base;
    const wind = 1 + S.bass * 0.7 + S.drop * 1.5;
    for (let i = 0; i < p.length; i += 3) {
      const x = b[i], y = b[i + 1];
      const u = (x + FW / 2) / FW;
      const k = u * (0.35 + 0.65 * u);
      p[i + 2] = (Math.sin(x * 0.55 - t * 3.2 + y * 0.18) * 0.9 + Math.sin(x * 1.3 - t * 4.7 + y * 0.4) * 0.25) * k * wind;
      p[i] = x - k * 0.25 * wind;
      p[i + 1] = y + Math.sin(x * 0.3 - t * 2) * 0.2 * k - u * u * 0.4;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.key1.intensity = 2.4 + S.beat * 1.2;
    this.rim.intensity = 2 + S.bass * 3;
    this.halo.material.opacity = 0.08 + S.bass * 0.12;
    this.halo.material.color.copy(this.ctx.c1);
    this.camera.position.set(Math.sin(t * 0.13) * 4, Math.sin(t * 0.09) * 1.5 - 0.5, this.dist);
    this.camera.lookAt(0, 2.2, 0);
    this.dust.userData.update(dt, 1 + S.bass * 6, this.camera.position.z);
  }
  render(r) { r.render(this.scene, this.camera); }
}
