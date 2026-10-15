// Photoreal scenes built on real assets: AI-photo portrait + 3D chain, HDRI city panorama, scanned marble bust, wall of scanned TVs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { chromeText, makeSparkles, makeDust, glowSprite, canvasTex, Spinner, sceneOpt } from '../common.js';

const TAU = Math.PI * 2;
const gltf = new GLTFLoader();
const loadModel = url => gltf.loadAsync(url).then(g => g.scene);

// ---------- shared: iced chain helpers ----------
let starTex;
function sparkleTexture() {
  if (starTex) return starTex;
  starTex = canvasTex(128, (g, n) => {
    const c = n / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.fillStyle = '#fff';
    for (const [w, h] of [[n, 3], [3, n], [n * 0.5, 2], [2, n * 0.5]]) g.fillRect(c - w / 2, c - h / 2, w, h);
  });
  return starTex;
}
function sparkles(positions) {
  const n = positions.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) r[i] = Math.random();
  g.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uSize: { value: 30 }, uTex: { value: sparkleTexture() } },
    vertexShader: `attribute float aRand; uniform float uTime, uBeat, uSize; varying float vA;
void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  float tw=pow(max(0.0,sin(uTime*(1.2+aRand*2.5)+aRand*60.0)),18.0);
  vA=min(tw+min(uBeat,1.0)*0.7*step(0.8,aRand),1.3); gl_PointSize=uSize*(0.3+vA); }`,
    fragmentShader: `uniform sampler2D uTex; varying float vA;
void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(vec3(1.0)*a*vA*1.4,a*vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.userData.update = (t, S, px) => { mat.uniforms.uTime.value = t; mat.uniforms.uBeat.value = Math.min(1, S.beat) * 1.5 + S.drop * 2; mat.uniforms.uSize.value = px; };
  return p;
}
function sampleFront(g, count) {
  const p = g.attributes.position.array, nrm = g.attributes.normal.array;
  const tris = [], areas = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < p.length / 3; i += 3) {
    if (nrm[i * 3 + 2] < 0.7) continue;
    a.fromArray(p, i * 3); b.fromArray(p, i * 3 + 3); c.fromArray(p, i * 3 + 6);
    tris.push(i); areas.push(u.subVectors(b, a).cross(v.subVectors(c, a)).length() / 2);
  }
  const total = areas.reduce((s, x) => s + x, 0);
  const out = new Float32Array(count * 3);
  for (let k = 0; k < count && total; k++) {
    let r = Math.random() * total, t = 0;
    while (t < areas.length - 1 && r > areas[t]) r -= areas[t++];
    const i = tris[t];
    a.fromArray(p, i * 3); b.fromArray(p, i * 3 + 3); c.fromArray(p, i * 3 + 6);
    let s1 = Math.random(), s2 = Math.random();
    if (s1 + s2 > 1) { s1 = 1 - s1; s2 = 1 - s2; }
    a.addScaledVector(u.subVectors(b, a), s1).addScaledVector(v.subVectors(c, a), s2);
    out.set([a.x, a.y, a.z], k * 3);
  }
  return out;
}

// ---------- 1. Iced Out on a photoreal portrait ----------
// neck geometry per photo, in image pixels: chain hangs from (cx ± halfW, sideY) down to botY
export const PHOTOS = {
  a: { name: 'Model A', file: 'assets/photo/model_a.jpg', w: 1920, h: 1088, cx: 958, sideY: 700, halfW: 150, botY: 835 },
  b: { name: 'Model B', file: 'assets/photo/model_b.jpg', w: 1920, h: 1088, cx: 975, sideY: 790, halfW: 125, botY: 925 }
};
export class IcedPhotoScene {
  constructor(ctx) {
    Object.assign(this, { key: 'icedphoto', cat: 'name', name: 'Iced Out · Foto', energy: 'mid', textPos: null });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
    this.camera.position.z = 10;
    this.photoU = { tPhoto: { value: null }, uTime: { value: 0 }, uBeat: { value: 0 }, uDrop: { value: 0 }, uTint: { value: new THREE.Color() } };
    this.photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: this.photoU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
uniform sampler2D tPhoto; uniform float uTime, uBeat, uDrop; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec3 c=texture2D(tPhoto,vUv).rgb;
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  // slow light sweep across the frame and a beat-driven rim tint in the highlights
  float band=exp(-pow((vUv.x*0.7+vUv.y*0.3-fract(uTime*0.06)*1.8+0.4)*9.0,2.0));
  c+=c*band*0.45;
  c=mix(c,c*uTint*2.2,smoothstep(0.15,0.6,l)*(0.06+uBeat*0.12+uDrop*0.3));
  c*=1.0+uBeat*0.08+uDrop*0.25;
  gl_FragColor=vec4(c,1.0);
}`
    }));
    this.scene.add(this.photo);
    this.chain = new THREE.Group();
    this.scene.add(this.chain);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.ice = new THREE.MeshStandardMaterial({ color: 0xeceef2, metalness: 1, roughness: 0.16, envMapIntensity: 1.45 });
    this.silver = new THREE.MeshStandardMaterial({ color: 0xe8e9ee, metalness: 1, roughness: 0.16, envMapIntensity: 1.35 });
    this.swing = { z: 0, vz: 0 };
    this.spinner = new Spinner(32, 2.2);
    this.loader = new THREE.TextureLoader();
    this.cfgKey = '';
    this.aspect = 16 / 9;
  }
  photoCfg(S) { return S.icedPhoto === 'custom' && this.custom ? this.custom : PHOTOS[S.icedPhoto] || PHOTOS.a; }
  setCustom(img) {
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    this.custom = { name: 'Özel', tex: t, w: img.width, h: img.height, cx: img.width / 2, sideY: img.height * 0.6, halfW: img.width * 0.07, botY: img.height * 0.72 };
    this.cfgKey = '';
  }
  // pixel → world: the photo spans w/100 × h/100 units centred on the origin
  px(cfg, x, y) { return new THREE.Vector3((x - cfg.w / 2) / 100, (cfg.h / 2 - y) / 100, 0); }
  build(S) {
    const cfg = this.photoCfg(S);
    if (cfg.tex) this.photoU.tPhoto.value = cfg.tex;
    else {
      cfg.tex = cfg.tex || this.loader.load(cfg.file);
      cfg.tex.colorSpace = THREE.SRGBColorSpace;
      cfg.tex.anisotropy = 8;
      this.photoU.tPhoto.value = cfg.tex;
    }
    this.photo.scale.set(cfg.w / 100, cfg.h / 100, 1);
    this.cfg = cfg;
    this.fit();
    [this.chain, this.pivot].forEach(g => { g.traverse(o => o.geometry && o.geometry !== this.linkGeo && o.geometry !== this.stoneGeo && o.geometry.dispose()); g.clear(); });

    const cx = cfg.cx + S.chainX, sideY = cfg.sideY + S.chainY, halfW = cfg.halfW * S.chainW, botY = sideY + (cfg.botY - cfg.sideY) * S.chainDrop;
    const thM = 1.3, thEnd = thM + 0.45, N = 46;
    const P = th => {
      const s = Math.sign(th), a = Math.abs(th);
      if (a <= thM) return this.px(cfg, cx + halfW * Math.sin(th) / Math.sin(thM), sideY + (botY - sideY) * (Math.cos(th) - Math.cos(thM)) / (1 - Math.cos(thM)));
      const k = (a - thM) / (thEnd - thM);   // past the neck edge the chain climbs and tucks behind
      return this.px(cfg, cx + s * halfW * (1 - 0.12 * k * k), sideY - k * (botY - sideY) * 0.55);
    };
    const size = S.chainSize * halfW / 134;
    this.linkGeo = this.linkGeo || new THREE.TorusGeometry(0.15, 0.058, 12, 24).scale(1.45, 1, 1);
    this.stoneGeo = this.stoneGeo || new THREE.OctahedronGeometry(0.042);
    const links = new THREE.InstancedMesh(this.linkGeo, this.ice, N);
    const stones = new THREE.InstancedMesh(this.stoneGeo, this.ice, N * 6);
    const shadow = [], spark = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), tw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2.3);
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < N; i++) {
      const th = -thEnd + i / (N - 1) * 2 * thEnd;
      const p = P(th), p2 = P(th + 0.01);
      const back = Math.max(0, (Math.abs(th) - thM) / (thEnd - thM));
      p.z = 0.35 + 0.25 * Math.cos(Math.min(Math.abs(th), thM)) - back * 0.3;
      X.subVectors(p2, P(th)).normalize();
      Y.crossVectors(Z, X);
      q.setFromRotationMatrix(m.makeBasis(X, Y, Z));
      if (i % 2) q.multiply(tw);
      const sc = size * (1 - back * 0.5) * (0.92 + 0.08 * Math.cos(th));
      links.setColorAt(i, new THREE.Color().setScalar(1 - 0.85 * back * back));
      links.setMatrixAt(i, m.compose(p, q, new THREE.Vector3(sc, sc, sc)));
      for (let k = 0; k < 6; k++) {
        const off = new THREE.Vector3((k % 3 - 1) * 0.12, k < 3 ? 0.07 : -0.07, 0.06).multiplyScalar(sc).applyQuaternion(q);
        const sp = p.clone().add(off);
        stones.setMatrixAt(i * 6 + k, new THREE.Matrix4().compose(sp, q, new THREE.Vector3(sc, sc, sc)));
        stones.setColorAt(i * 6 + k, new THREE.Color().setScalar(1 - 0.9 * back));
        if (k % 2 === 0 && back < 0.5) spark.push(sp.x, sp.y, sp.z + 0.05);
      }
      shadow.push(p.x + 0.05 * size, p.y - 0.09 * size, 0.02, back);
    }
    // soft contact shadow of the chain on the skin
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shadow.filter((_, i) => i % 4 !== 3)), 3));
    this.shadowMat = new THREE.PointsMaterial({ map: this.ctx.glowTex, color: 0x000000, size: 10, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: false });
    this.shadowSize = 0.75 * size;
    const sh = new THREE.Points(shGeo, this.shadowMat);
    this.chainSpark = sparkles(new Float32Array(spark));
    this.chain.add(sh, links, stones, this.chainSpark);

    // pendant hangs from the lowest link
    const bottom = P(0);
    this.pivot.position.set(bottom.x, bottom.y - 0.08 * size, 0.62);
    const { mesh, width, height } = chromeText(this.ctx, S.name || ' ', { size: 0.34 * size, depth: 0.09 * size, shear: 0.06, face: 'clean' });
    mesh.material = [this.silver, this.silver];
    mesh.position.y = -0.3 * size - height / 2;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.11 * size, 0.035 * size, 12, 24), this.silver);
    bail.position.y = -0.12 * size;
    bail.rotation.y = Math.PI / 2;
    const ice = sampleFront(mesh.geometry, 520);
    for (let i = 1; i < ice.length; i += 3) ice[i] += mesh.position.y;
    const pst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.022 * size), this.ice, ice.length / 3);
    for (let i = 0; i < ice.length / 3; i++) pst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(ice[i * 3], ice[i * 3 + 1], ice[i * 3 + 2] + 0.01));
    const pShGeo = new THREE.PlaneGeometry(width * 1.05, height * 1.3);
    const pSh = new THREE.Mesh(pShGeo, new THREE.MeshBasicMaterial({ map: this.ctx.glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    pSh.position.set(0.06, mesh.position.y - 0.08, -0.55);
    this.pendSpark = sparkles(ice.slice(0, 3 * 90));
    this.pendant = new THREE.Group();
    this.pendant.add(pSh, mesh, bail, pst, this.pendSpark);
    this.pivot.add(this.pendant);
  }
  resize(w, h) { this.aspect = w / h; this.h = h; this.fit(); }
  // cover-fit the photo in the viewport
  fit() {
    if (!this.cfg) return;
    const pw = this.cfg.w / 100, ph = this.cfg.h / 100;
    let hw, hh;
    if (this.aspect > pw / ph) { hw = pw / 2; hh = hw / this.aspect; } else { hh = ph / 2; hw = hh * this.aspect; }
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
    this.pxPerUnit = (this.h || 1080) / (2 * hh);
  }
  update(S, t, dt) {
    const key = [S.icedPhoto, S.chainX, S.chainY, S.chainW, S.chainDrop, S.chainSize, S.name, !!this.custom].join('|');
    if (key !== this.cfgKey) { this.cfgKey = key; this.build(S); }
    const sw = this.swing;
    if (S.beatCount !== this.lastBeat) { this.lastBeat = S.beatCount; sw.vz += (Math.random() < 0.5 ? -1 : 1) * 0.55 * S.react; }
    if (S.dropCount !== this.lastDrop) { this.lastDrop = S.dropCount; sw.vz += 2.2; }
    const st = Math.min(dt, 1 / 30);
    sw.vz += (-16 * Math.sin(sw.z) - 2.4 * sw.vz) * st; sw.z += sw.vz * st;
    this.pendant.rotation.z = sw.z * 0.35;
    this.pendant.rotation.y = this.spinner.update(S, dt) + Math.sin(t * 0.8) * 0.12;
    this.chain.rotation.z = sw.z * 0.01;
    this.photoU.uTime.value = t; this.photoU.uBeat.value = Math.min(1, S.beat); this.photoU.uDrop.value = S.drop;
    this.photoU.uTint.value.copy(this.ctx.c1);
    // slow push-in, a little punch on the kick
    this.camera.zoom = 1.04 + 0.04 * Math.sin(t * 0.09) + S.beat * 0.012 + S.drop * 0.06;
    this.camera.position.x = Math.sin(t * 0.07) * 0.12;
    this.camera.position.y = Math.sin(t * 0.05) * 0.06;
    this.camera.updateProjectionMatrix();
    const unit = (this.pxPerUnit || 100) * this.camera.zoom;
    this.shadowMat.size = unit * this.shadowSize;
    const px = unit * 0.14;
    this.chainSpark.userData.update(t, S, px);
    this.pendSpark.userData.update(t, S, px);
  }
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- 2. Chrome name over a real night city panorama ----------
export class CityScene {
  constructor(ctx) {
    Object.assign(this, { key: 'city', ownEnv: true, cat: 'name', name: 'Gece Şehri', energy: 'mid', textPos: null });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2000);
    ctx.loadHDR('city').then(t => { this.scene.background = t; this.scene.backgroundIntensity = 0.3; });
    ctx.envMap('city').then(e => { this.scene.environment = e; });
    this.hero = new THREE.Group();
    this.scene.add(this.hero);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 24, 256), ctx.mats.clean);
    this.ringPivot = new THREE.Group();
    this.ringPivot.add(this.ring);
    this.ring.rotation.x = Math.PI / 2 - 0.3;
    this.sparkles = makeSparkles(ctx, [[-0.42, 0.24, 0.05, 0.05, 0], [0.4, -0.2, 0.05, 0.045, 2], [0.5, 0.3, -0.2, 0.03, 4], [-0.55, -0.25, -0.1, 0.025, 1]]);
    this.scene.add(this.ringPivot, this.sparkles);
    this.spinner = new Spinner(16);
    this.built = null;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      this.hero.clear();
      const { mesh, width } = chromeText(this.ctx, S.name || ' ', { size: 3.2, depth: 1.0 });
      this.hero.add(mesh);
      this.w = width;
    }
    this.scene.backgroundIntensity = (this.bgI ?? 0.3) * (1 + S.beat * 0.12);
    this.hero.position.y = 1.5 + Math.sin(t * 0.6) * 0.3;
    this.ringPivot.position.copy(this.hero.position);
    this.ringPivot.rotation.y = t * 0.5;
    this.ring.scale.setScalar(this.w * 0.58 * (1 + S.beat * 0.03));
    this.sparkles.position.copy(this.hero.position);
    this.sparkles.userData.update(t, S, this.w);
    // slow pan across the skyline, the name always in front
    const a = Math.PI * 0.62 + Math.sin(t * 0.04) * 0.5;
    const d = this.w * 1.25;
    this.camera.position.set(Math.cos(a) * d, 1.2 + Math.sin(t * 0.07) * 0.6, Math.sin(a) * d);
    this.camera.lookAt(0, 1.8, 0);
    this.hero.lookAt(this.camera.position.x, this.hero.position.y, this.camera.position.z);
    this.hero.rotateY(Math.sin(t * 0.35) * 0.35 + this.spinner.update(S, dt));
  }
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- 3. Scanned marble bust ----------
const BUST_FIN = ['Mermer', 'Krom', 'Siyah cam', 'Altın'];
export { BUST_FIN };
export class BustScene {
  constructor(ctx) {
    Object.assign(this, { key: 'bust', ownEnv: true, cat: 'name', name: 'Mermer Büst', energy: 'low', textPos: null });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 500);
    ctx.envMap('neon').then(e => { this.scene.environment = e; });
    ctx.loadHDR('neon').then(t => { this.scene.background = t; this.scene.backgroundBlurriness = 0.85; this.scene.backgroundIntensity = 0.12; });
    this.bust = new THREE.Group();
    this.scene.add(this.bust);
    this.fins = [
      null,
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08, envMapIntensity: 1.4 }),
      new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1 }),
      new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: 0.18, envMapIntensity: 1.3 })
    ];
    loadModel('assets/models/marble_bust_01/marble_bust_01_2k.gltf').then(root => {
      root.scale.setScalar(20);
      root.position.y = -4.6;
      root.traverse(o => { if (o.isMesh) { this.mesh = o; this.fins[0] = o.material; o.material.envMapIntensity = 0.8; } });
      this.bust.add(root);
    });
    this.ringPivot = new THREE.Group();
    this.ringPivot.position.y = 1.2;
    this.scene.add(this.ringPivot);
    this.rim = new THREE.DirectionalLight(0xff2030, 4); this.rim.position.set(6, 3, -6);
    const key = new THREE.DirectionalLight(0xfff0e0, 1.6); key.position.set(-5, 6, 7);
    this.scene.add(this.rim, key);
    this.dust = makeDust(500, [40, 30, 40], 0.06);
    this.scene.add(this.dust);
    this.spinner = new Spinner(32, 3);
    this.built = null;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      this.ringPivot.clear();
      // the name orbits the head like a halo, always readable from the front
      for (let k = 0; k < 2; k++) {
        const m = chromeText(this.ctx, S.name || ' ', { size: 0.85, depth: 0.25 }).mesh;
        m.userData.k = k;
        this.ringPivot.add(m);
      }
    }
    if (this.mesh) {
      const fin = this.fins[sceneOpt(S, 'bust', 'fin', S.bustFin || 0)] || this.fins[0];
      if (this.mesh.material !== fin) this.mesh.material = fin;
    }
    this.bust.rotation.y = t * 0.15 + this.spinner.update(S, dt);
    this.ringPivot.children.forEach(m => {
      const a = t * (S.bpm / 60) * TAU / 16 + m.userData.k * Math.PI;
      m.position.set(Math.sin(a) * 6.2, 0.8 + Math.sin(a * 2) * 0.3, Math.cos(a) * 6.2);
      m.lookAt(this.camera.position);
      m.scale.setScalar(m.position.z < 0 ? 0.8 : 1);
    });
    this.rim.color.copy(this.ctx.c1);
    this.rim.intensity = 3 + S.beat * 4 + S.drop * 6;
    this.dust.userData.update(dt, 0.5 + S.bass * 3, 20);
    this.camera.position.set(Math.sin(t * 0.1) * 2, 1.6 + Math.sin(t * 0.13) * 0.5, 17 - S.drop * 2);
    this.camera.lookAt(0, 0.6, 0);
  }
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- 4. Wall of scanned CRT TVs showing live channels ----------
const COLS = 6, ROWS = 4;
export class TVWallScene {
  constructor(ctx) {
    Object.assign(this, { key: 'tvwall', ownEnv: true, cat: 'name', name: 'TV Duvarı', energy: 'mid', textPos: null });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
    ctx.envMap('rooftop').then(e => { this.scene.environment = e; });
    this.scene.background = new THREE.Color(0x020102);
    this.nameCanvas = document.createElement('canvas');
    this.nameCanvas.width = 1024; this.nameCanvas.height = 512;
    this.nameTex = new THREE.CanvasTexture(this.nameCanvas);
    this.nameTex.colorSpace = THREE.SRGBColorSpace;
    this.screenU = { uTime: ctx.U.uTime, uBeat: ctx.U.uBeat, uBass: ctx.U.uBass, uSpec: ctx.U.uSpec, uC1: ctx.U.uC1, uC2: ctx.U.uAccent, tName: { value: this.nameTex } };
    this.wall = new THREE.Group();
    this.scene.add(this.wall);
    this.screens = [];
    loadModel('assets/models/Television_01/Television_01_2k.gltf').then(tv => {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const set = tv.clone();
        set.scale.setScalar(4);
        const x = (c - (COLS - 1) / 2) * 2.5, y = r * 1.86 - 2.6;
        set.position.set(x + (Math.random() - 0.5) * 0.15, y, (Math.random() - 0.5) * 0.4);
        set.rotation.y = (Math.random() - 0.5) * 0.18 - x * 0.03;
        set.rotation.z = (Math.random() - 0.5) * 0.04;
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.screenMaterial(r * COLS + c));
        scr.position.set(-0.045, 0.245, 0.214);
        scr.scale.set(0.4, 0.31, 1);
        set.add(scr);
        this.screens.push(scr);
        this.wall.add(set);
      }
    });
    this.glow = glowSprite(ctx, 0xffffff, 0.15);
    this.glow.scale.set(30, 16, 1);
    this.glow.position.z = 2;
    this.scene.add(this.glow);
    this.lastName = null;
  }
  screenMaterial(i) {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.screenU, uCh: { value: i % 5 }, uSeed: { value: Math.random() * 100 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `
uniform float uTime, uBeat, uBass, uCh, uSeed; uniform vec3 uC1, uC2; uniform sampler2D uSpec, tName; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv=vUv-0.5; uv*=1.0+dot(uv,uv)*0.35; uv+=0.5;           // CRT bulge
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ gl_FragColor=vec4(0.0,0.0,0.0,1.0); return; }
  float roll=fract(uTime*0.05+uSeed);
  uv.y=fract(uv.y+step(0.97,hash(vec2(floor(uTime*3.0),uSeed)))*0.2);
  vec3 c1=pow(uC1,vec3(2.2)), c2=pow(uC2,vec3(2.2));
  vec3 c;
  float ch=mod(uCh+floor(uTime*0.25+uSeed),5.0);
  if(ch<1.0){ vec4 t=texture2D(tName,uv); c=mix(c1*0.15,vec3(1.0),t.a)*(0.8+uBeat); }
  else if(ch<2.0){ float s=texture2D(uSpec,vec2(abs(uv.x-0.5)*1.6,0.5)).r; c=mix(c1,c2,uv.y)*step(uv.y,s*0.9+0.05)*step(0.3,fract(uv.x*24.0)); }
  else if(ch<3.0){ vec2 p=uv-0.5; p.x*=1.3; float d=length(p); c=mix(c1,c2,0.5+0.5*sin(d*30.0-uTime*6.0))*(0.6+uBass); }
  else if(ch<4.0){ c=vec3(step(0.5,fract(uv.x*7.0)),step(0.5,fract(uv.x*3.5)),step(0.5,fract(uv.x*1.75)))*0.8; }
  else { vec2 p=(uv-vec2(0.4,0.5))*vec2(1.3,1.0); float d=min(max(length(p)-0.25,-(length(p-vec2(0.06,0.0))-0.2)),length(p-vec2(0.3,0.0))-0.07); c=mix(c1,vec3(1.0),smoothstep(0.01,-0.01,d)); }
  c*=0.75+0.25*sin(uv.y*420.0);
  c+=(hash(uv*400.0+uTime)-0.5)*0.12;
  c*=1.0-smoothstep(0.0,0.03,abs(fract(uv.y-roll)-0.5)-0.47)*0.0+0.0;
  c*=1.0+smoothstep(0.02,0.0,abs(uv.y-roll))*0.6;
  gl_FragColor=vec4(c*1.6,1.0);
}`
    });
  }
  drawName(name, c1) {
    const g = this.nameCanvas.getContext('2d');
    g.clearRect(0, 0, 1024, 512);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = 200;
    g.font = `italic 900 ${s}px Exo2, Anton, sans-serif`;
    const w = g.measureText(name).width;
    if (w > 940) { s *= 940 / w; g.font = `italic 900 ${s}px Exo2, Anton, sans-serif`; }
    g.fillText(name, 512, 256);
    this.nameTex.needsUpdate = true;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.portrait = w < h; }
  update(S, t, dt) {
    if (S.name !== this.lastName) { this.lastName = S.name; this.drawName(S.name, S.c1); }
    // every bar, a few sets switch channel
    if (S.beatCount !== this.lb && S.beatCount % 4 === 0) {
      this.lb = S.beatCount;
      this.screens.forEach(s => { if (Math.random() < 0.3) s.material.uniforms.uCh.value = Math.floor(Math.random() * 5); });
    }
    if (S.dropCount !== this.ld) { this.ld = S.dropCount; this.screens.forEach(s => { s.material.uniforms.uCh.value = 0; }); }
    this.glow.material.color.copy(this.ctx.c1);
    this.glow.material.opacity = 0.08 + S.bass * 0.15;
    const d = this.portrait ? 30 : 17;
    this.camera.position.set(Math.sin(t * 0.09) * 4, 1.2 + Math.sin(t * 0.07) * 1.2, d - S.drop * 3 + Math.sin(t * 0.11) * 1.5);
    this.camera.lookAt(0, 1.2, 0);
  }
  render(r) { r.render(this.scene, this.camera); }
}
