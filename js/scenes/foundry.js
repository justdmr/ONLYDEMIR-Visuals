// "Dökümhane" (the foundry): a game-engine style hero shot. A monumental slab of rusted cast iron stands in a dark,
// hazy foundry hall; ONLYDEMIR is cast into it in relief and molten metal runs through the letters' edges, letter by
// letter, with the bars. One hard warm key from above (soft shadows), a cold rim, a visible light shaft in the haze,
// a wet concrete floor that mirrors the glow, embers, and slow crane / dolly shots that cut on the bar grid.
// Assets: Poly Haven (CC0) — industrial_workshop_foundry HDRI, rusty_metal_02 and concrete_floor_worn_001 textures.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { sceneOpt } from '../common.js';
import { haze, lightShaft } from './entity.js';

const TEX = 'assets/tex/';
const loader = new THREE.TextureLoader();
function pbr(name, repeat, srgbDiff = true) {
  const t = {};
  for (const m of ['diff', 'nor_gl', 'arm']) {
    const tex = loader.load(`${TEX}${name}_${m}_2k.jpg`);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = 8;
    if (m === 'diff' && srgbDiff) tex.colorSpace = THREE.SRGBColorSpace;
    t[m] = tex;
  }
  return t;
}

export class FoundryScene {
  constructor(ctx) {
    Object.assign(this, { key: 'foundry', cat: 'ent', name: 'Dökümhane', energy: 'mid', textPos: null, ownEnv: true });
    this.ctx = ctx;
    const r = ctx.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x000000);
    sc.fog = new THREE.FogExp2(0x040507, 0.042);
    ctx.envMap('foundry').then(env => { sc.environment = env; });
    ctx.loadHDR('foundry').then(t => { sc.background = t; sc.backgroundBlurriness = 0.5; sc.backgroundIntensity = 0.012; });
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 300);

    // the slab
    const W = 15, H = 6.6, D = 1.8;
    this.dims = { W, H, D };
    const iron = pbr('rusty_metal_02', [3.2, 1.4]);
    const ironMat = new THREE.MeshPhysicalMaterial({
      map: iron.diff, normalMap: iron.nor_gl, roughnessMap: iron.arm, metalnessMap: iron.arm, aoMap: iron.arm,
      color: 0x4c4744, roughness: 1, metalness: 1, envMapIntensity: 0.3, clearcoat: 0.15, clearcoatRoughness: 0.6
    });
    ironMat.normalScale.set(1.6, 1.6);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, H, D, 1, 1, 1), ironMat);
    slab.position.y = H / 2;
    slab.castShadow = slab.receiveShadow = true;
    sc.add(slab);
    // a plinth so it sits like a monument
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, 0.5, D + 1.4), ironMat);
    plinth.position.y = 0.25; plinth.castShadow = plinth.receiveShadow = true;
    slab.position.y += 0.5;
    sc.add(plinth);

    // molten pour: travels across the letters along x; hot sides, iron faces that warm up with the bass
    this.U = { uPour: { value: 0 }, uHeat: { value: 1 }, uC1: { value: new THREE.Color() }, uTime: { value: 0 } };
    const U = this.U;
    const molten = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.5, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 1 });
    molten.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp=position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp; uniform float uPour, uHeat, uTime; uniform vec3 uC1;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float front=exp(-pow((vLp.x-uPour)*0.55,2.0));                 // the hot front running through the letters
    float lit=smoothstep(uPour+0.6,uPour-2.5,vLp.x);               // letters already poured stay warm
    float flick=0.85+0.15*sin(uTime*7.0+vLp.x*3.0)*sin(uTime*3.3-vLp.y*5.0);
    float h=(0.35*lit+1.6*front)*uHeat*flick;
    vec3 hot=mix(vec3(0.6,0.05,0.0),vec3(1.0,0.38,0.06),clamp(h*0.6,0.0,1.0));
    hot=mix(hot,vec3(1.0,0.86,0.6),clamp(h*0.4-0.45,0.0,1.0));
    hot=mix(hot,uC1*vec3(1.4,0.6,0.5)+hot*0.4,0.25);
    totalEmissiveRadiance=hot*h*3.0;
  }`);
    };
    const faceMat = ironMat.clone();
    faceMat.color.set(0x24221f); faceMat.envMapIntensity = 0.8; faceMat.clearcoat = 0.5; faceMat.clearcoatRoughness = 0.3;
    const g = new TextGeometry('ONLYDEMIR', { font: ctx.font, size: 1.55, height: 0.32, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3 });
    g.computeBoundingBox();
    const b = g.boundingBox, tw = b.max.x - b.min.x;
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
    const s = Math.min(1, (W * 0.84) / tw);
    this.letters = new THREE.Mesh(g, [faceMat, molten]);
    this.letters.scale.set(s, s, 1);
    this.letters.position.set(0, 0.5 + H * 0.5, D / 2 - 0.02);
    this.letters.castShadow = this.letters.receiveShadow = true;
    sc.add(this.letters);
    this.textW = tw;

    // wet concrete floor
    const con = pbr('concrete_floor_worn_001', [22, 22]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshPhysicalMaterial({
      map: con.diff, normalMap: con.nor_gl, roughnessMap: con.arm, aoMap: con.arm, color: 0x45423f,
      roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.5
    }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    sc.add(floor);

    // lights: hard warm key from above, cold rims, molten glow, a faint fill so the shadows aren't dead black
    const key = this.keyL = new THREE.SpotLight(0xffc896, 1400, 70, 0.3, 0.7, 2);
    key.position.set(-2, 22, 9); key.target.position.set(0, 4, 0.5);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.camera.near = 5; key.shadow.camera.far = 60;
    sc.add(key, key.target);
    this.rimL = new THREE.DirectionalLight(0x9ab8ff, 2.2); this.rimL.position.set(-14, 9, -12);
    this.rimR = new THREE.DirectionalLight(0x9ab8ff, 1.6); this.rimR.position.set(14, 7, -10);
    this.glow = new THREE.PointLight(0xff5a1a, 40, 24, 2); this.glow.position.set(0, 3.8, 3.2);
    this.fill = new THREE.HemisphereLight(0x8090a8, 0x100806, 0.08);
    sc.add(this.rimL, this.rimR, this.glow, this.fill);
    // the key light's shaft through the haze
    this.shaft = lightShaft(0xffd9b0, 30, 7.5);
    this.shaft.position.copy(key.position);
    this.shaft.lookAt(key.target.position); this.shaft.rotateX(-Math.PI / 2);
    sc.add(this.shaft);
    this.dust = haze(700, [40, 18, 30], 0xffe2c0);
    sc.add(this.dust);

    // embers rising off the molten letters
    const n = 600;
    this.em = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), col: new Float32Array(n * 3) };
    for (let i = 0; i < n; i++) this.spawn(i, true);
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(this.em.pos, 3));
    eg.setAttribute('color', new THREE.BufferAttribute(this.em.col, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: ctx.glowTex, size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.embers.frustumCulled = false;
    sc.add(this.embers);

    // shot list (position, look-at), cut on the bar grid; each shot drifts slowly like a dolly / crane
    this.shots = [
      { p: [0, 1.6, 21], q: [0, 3.8, 0], d: [0, 0.6, -3] },        // low frontal push-in: monumental
      { p: [-11, 2.4, 11], q: [-1.5, 4, 0], d: [2, 0, -1.5] },     // three-quarter, slides right along the face
      { p: [4, 0.6, 8], q: [1, 3.9, 0.9], d: [-3, 0.3, 0] },        // close, from the floor: letters overhead
      { p: [0, 12, 19], q: [0, 3, 0], d: [0, -3, -2] },             // high crane down
      { p: [9, 4.5, 5.5], q: [0, 4.2, 0.9], d: [-1.5, 0, 1] }       // grazing along the letters
    ];
    this.shot = 0; this.shotT = 0; this.aspect = 16 / 9; this.pourT = 0;
  }
  spawn(i, any) {
    const e = this.em, { H } = this.dims;
    e.pos.set([(Math.random() - 0.5) * 13, 0.5 + H * 0.5 + (Math.random() - 0.5) * 1.6 + (any ? Math.random() * 6 : 0), 1 + Math.random() * 0.4], i * 3);
    e.vel.set([(Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 1.2, 0.2 + Math.random() * 0.5], i * 3);
    e.life[i] = 0.3 + Math.random() * 0.7;
  }
  resize(w, h) { this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(S, t, dt) {
    const beat = Math.min(1, S.beat), U = this.U, amp = sceneOpt(S, this.key, 'motion', 1);
    U.uTime.value = t; U.uC1.value.copy(this.ctx.c1);
    // the pour runs through the word once every 4 bars (and at once on a drop)
    const half = this.textW * this.letters.scale.x / 2 + 2;
    const bars = (S.clockPhase || t * 2) / 4;
    if (S.dropCount !== this.ld) { if (this.ld !== undefined) this.pourT = 0; this.ld = S.dropCount; }
    this.pourT += dt;
    const cyc = (bars / 4) % 1;
    U.uPour.value = (-half + cyc * 2 * half * 1.15) / this.letters.scale.x;
    U.uHeat.value = (0.75 + beat * 0.45 + S.bass * 0.4 + S.drop * 1.5) * sceneOpt(S, this.key, 'heat', 1);
    this.glow.intensity = (25 + beat * 35 + S.drop * 120) * U.uHeat.value;
    this.glow.position.x = THREE.MathUtils.clamp(U.uPour.value * this.letters.scale.x, -6, 6);
    this.keyL.intensity = 1300 + beat * 250;
    this.shaft.material.uniforms.uTime.value = t;
    this.shaft.material.uniforms.uK.value = 0.06 * (1 + beat * 0.4 + S.drop * 0.8) * (sceneOpt(S, this.key, 'beams', true) ? 1 : 0);
    // camera: cut every N beats, drop goes back to the hero shot
    const every = sceneOpt(S, this.key, 'every', 16);
    if (S.beatCount !== this.lb) {
      this.lb = S.beatCount;
      if (sceneOpt(S, this.key, 'cuts', true) && S.beatCount % every === 0) { this.shot = (this.shot + 1 + Math.floor(Math.random() * (this.shots.length - 1))) % this.shots.length; this.shotT = 0; }
    }
    if (S.dropCount !== this.ld2) { if (this.ld2 !== undefined) { this.shot = 0; this.shotT = 0; } this.ld2 = S.dropCount; }
    this.shotT += dt;
    const sh = this.shots[this.shot], k = 1 - Math.exp(-this.shotT * 0.05) ;
    const ar = Math.min(1, this.aspect / 1.6);
    const p = sh.p.map((v, i) => (v + sh.d[i] * k * 6 * amp) / (i === 1 ? 1 : ar));
    this.camera.position.set(p[0] + Math.sin(t * 0.21) * 0.15 * amp, p[1] + Math.sin(t * 0.17) * 0.08 * amp, p[2] - beat * 0.08 * amp);
    this.camera.lookAt(sh.q[0], sh.q[1], sh.q[2]);
    // embers
    const e = this.em, { H } = this.dims, c1 = this.ctx.c1;
    for (let i = 0; i < e.n; i++) {
      e.life[i] -= dt * 0.15;
      if (e.life[i] <= 0 || e.pos[i * 3 + 1] > H + 8) this.spawn(i, false);
      e.vel[i * 3] += Math.sin(t * 1.1 + i) * dt * 0.25;
      for (let a = 0; a < 3; a++) e.pos[i * 3 + a] += e.vel[i * 3 + a] * dt * (1 + S.drop * 2.5);
      const f = Math.min(1, e.life[i] * 2.5) * (0.5 + beat * 0.5 + S.drop);
      e.col[i * 3] = (1.5 + c1.r * 0.4) * f; e.col[i * 3 + 1] = 0.5 * f; e.col[i * 3 + 2] = 0.12 * f;
    }
    this.embers.geometry.attributes.position.needsUpdate = true;
    this.embers.geometry.attributes.color.needsUpdate = true;
    this.dust.userData.U.uTime.value = t; this.dust.userData.U.uK.value = 0.35 + beat * 0.25;
  }
  render(r) { r.render(this.scene, this.camera); }
}
