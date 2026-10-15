// Cinematic "entity" scenes in the spirit of monumental techno shows (Afterlife / Anyma), but ONLYDEMIR's own:
// DEMİR = iron. A colossal scanned head forged in dark iron with molten veins that pulse with the bass, light shafts
// in haze, embers; and the same head as a living particle cloud that dissolves and reforms with the music.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sceneOpt } from '../common.js';

const BUST = 'assets/models/marble_bust_01/marble_bust_01_2k.gltf';
let bustPromise;
// one shared load; returns { geometry (world-scaled), material (the scan's maps), box }
function loadBust() {
  return bustPromise || (bustPromise = new GLTFLoader().loadAsync(BUST).then(g => {
    let mesh;
    g.scene.traverse(o => { if (o.isMesh) mesh = o; });
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().makeScale(20, 20, 20));
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox();
    return { geometry: geo, material: mesh.material, box: geo.boundingBox };
  }));
}

// floating haze motes: soft round points with a clamped size that fade out near the lens, so an orbiting
// camera never ends up with one mote filling the screen
function haze(n, spread, color = 0xffffff) {
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([(Math.random() - 0.5) * spread[0], Math.random() * spread[1], (Math.random() - 0.5) * spread[2]], i * 3); rnd[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(rnd, 1));
  const U = { uTime: { value: 0 }, uK: { value: 1 }, uColor: { value: new THREE.Color(color) }, uH: { value: spread[1] } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aR; uniform float uTime, uH; varying float vA;
void main(){ vec3 p=position; p.y=mod(p.y+uTime*(0.15+aR*0.35),uH); p.x+=sin(uTime*0.3+aR*30.0)*0.6;
  vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
  float z=-mv.z; vA=smoothstep(1.5,5.0,z)*(0.3+0.7*aR); gl_PointSize=clamp(60.0/z,1.0,5.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying float vA;
void main(){ vec2 c=gl_PointCoord-0.5; float a=exp(-dot(c,c)*14.0)*vA*uK; gl_FragColor=vec4(uColor*a,1.0); }`
  }));
  pts.frustumCulled = false;
  pts.userData.U = U;
  return pts;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NOISE = `
vec3 hash3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
// distance to the nearest Voronoi border (F2-F1): ~0 on the crack lines
float vedge(vec3 x){
  vec3 p=floor(x), f=fract(x); float d1=8.0, d2=8.0;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 b=vec3(float(i),float(j),float(k)); vec3 r=b+hash3(p+b)-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d;
  }
  return sqrt(d2)-sqrt(d1);
}
float vnoise(vec3 x){
  vec3 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  float n=mix(mix(mix(hash3(p).x,hash3(p+vec3(1,0,0)).x,f.x),mix(hash3(p+vec3(0,1,0)).x,hash3(p+vec3(1,1,0)).x,f.x),f.y),
              mix(mix(hash3(p+vec3(0,0,1)).x,hash3(p+vec3(1,0,1)).x,f.x),mix(hash3(p+vec3(0,1,1)).x,hash3(p+vec3(1,1,1)).x,f.x),f.y),f.z);
  return n;
}`;

// black room, one big overhead softbox, a cold rim strip behind and a low red strip: the iron reads as a dark sculpture
function darkStudio(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x000000);
  const strip = (color, k, x, y, z, rx, ry, sx, sy) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.scale.set(sx, sy, 1);
    room.add(m);
  };
  strip(0xffffff, 3, 0, 12, 0, Math.PI / 2, 0, 10, 10);
  strip(0xcfe0ff, 8, -9, 4, -8, 0, Math.PI / 4, 1.2, 16);
  strip(0xcfe0ff, 6, 9, 4, -8, 0, -Math.PI / 4, 1.2, 16);
  strip(0xff2020, 3, 0, -6, 9, Math.PI / 3, 0, 20, 1.5);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.02).texture;
  pm.dispose();
  return env;
}

// soft volumetric shaft in haze: an open cone, brightest at its apex, faded at the rim and drifting with noise
function lightShaft(color, len, rad) {
  const geo = new THREE.ConeGeometry(rad, len, 48, 1, true);
  geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: `uniform vec3 uColor; uniform float uK, uTime; varying vec2 vUv; varying vec3 vN, vV;
float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
void main(){
  float along=vUv.y;                       // 1 at the apex, 0 at the open end
  float edge=pow(abs(dot(vN,vV)),1.6);      // soft rim
  float n=0.75+0.25*sin(vUv.x*40.0+uTime*0.7)*sin(vUv.x*13.0-uTime*0.4);
  float a=smoothstep(1.0,0.82,along)*pow(along,1.2)*edge*n*uK;
  gl_FragColor=vec4(uColor*a,1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide
  });
  return new THREE.Mesh(geo, mat);
}

export class IronScene {
  constructor(ctx) {
    Object.assign(this, { key: 'iron', cat: 'ent', name: 'Demir Varlık', energy: 'mid', textPos: null, ownEnv: true });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.012);
    this.scene.environment = darkStudio(ctx.renderer);
    this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 400);
    this.U = { uTime: { value: 0 }, uHeat: { value: 1 }, uSpread: { value: 0 }, uC1: { value: new THREE.Color() }, uScale: { value: 0.55 } };
    const U = this.U;
    this.mat = new THREE.MeshPhysicalMaterial({ color: 0x6a6a70, metalness: 0.85, roughness: 0.4, envMapIntensity: 1.7, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    this.mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWp=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uTime, uHeat, uSpread, uScale; uniform vec3 uC1;\n' + NOISE)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    // molten veins: two scales of Voronoi cracks, revealed by a slowly drifting mask; the drop spreads them everywhere
    vec3 q=vWp*uScale+vec3(0.0,-uTime*0.03,0.0);
    float e=min(vedge(q*1.6)*1.4,vedge(q*4.2+7.1)*1.8+0.06);
    float mask=smoothstep(0.6-uSpread*0.55,0.88-uSpread*0.45,vnoise(vWp*0.35+vec3(uTime*0.05,0.0,uTime*0.03)));
    float core=1.0-smoothstep(0.0,0.026,e);
    float spill=exp(-e*18.0)*0.18;
    float heat=(core+spill)*mask*uHeat;
    // blackbody-ish ramp, pulled toward the palette red so the show colour carries through
    vec3 hot=mix(vec3(0.55,0.03,0.0),vec3(1.0,0.32,0.04),clamp(heat*0.6,0.0,1.0));
    hot=mix(hot,vec3(1.0,0.85,0.55),clamp(heat*0.35-0.5,0.0,1.0));
    hot=mix(hot,uC1*vec3(1.6,0.6,0.6)+hot*0.4,0.35);
    // more vein area -> less brightness per vein, so a full-head flare stays sculptural instead of a white-out
    totalEmissiveRadiance+=hot*heat*2.0/(1.0+uSpread*2.5);
    diffuseColor.rgb*=1.0-core*mask*0.8;     // the cracks themselves are holes in the iron skin
  }`);
    };
    this.head = new THREE.Group();
    this.scene.add(this.head);
    loadBust().then(({ geometry, material, box }) => {
      this.mat.normalMap = material.normalMap; this.mat.roughnessMap = material.roughnessMap;
      this.mat.normalScale.set(1.4, 1.4);
      this.mat.needsUpdate = true;
      this.mesh = new THREE.Mesh(geometry, this.mat);
      this.head.add(this.mesh);
      this.box = box;
      const h = box.max.y;
      this.faceY = h * 0.72;
      this.shafts.position.set(0, h * 2.8, -h * 1.8);
    });
    // light shafts behind/above the head
    this.shafts = new THREE.Group();
    [[-0.42, 0xdfe8ff, -6], [-0.15, 0xffffff, -2], [0.12, 0xffffff, 2], [0.4, 0xdfe8ff, 6]].forEach(([a, c, x], i) => {
      const s = lightShaft(c, 46, 3.2 + i % 2 * 1.6);
      s.position.x = x;
      s.rotation.set(-0.42, 0, a); s.userData.a = a; s.userData.i = i;
      this.shafts.add(s);
    });
    this.scene.add(this.shafts);
    // lights: cold rim from behind, red underlight, a weak key
    this.rimL = new THREE.DirectionalLight(0xdfe8ff, 3.5); this.rimL.position.set(-6, 8, -10);
    this.rimR = new THREE.DirectionalLight(0xdfe8ff, 2.5); this.rimR.position.set(7, 6, -9);
    this.under = new THREE.PointLight(0xff2010, 120, 0, 2); this.under.position.set(0, 1, 7);
    this.keyL = new THREE.DirectionalLight(0xe8eeff, 1.5); this.keyL.position.set(-5, 8, 8);
    this.scene.add(this.rimL, this.rimR, this.under, this.keyL);
    // embers
    const n = 900;
    this.em = { n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), col: new Float32Array(n * 3) };
    for (let i = 0; i < n; i++) this.spawn(i, true);
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(this.em.pos, 3));
    eg.setAttribute('color', new THREE.BufferAttribute(this.em.col, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: ctx.glowTex, size: 0.18, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.embers.frustumCulled = false;
    this.scene.add(this.embers);
    this.dust = haze(900, [50, 26, 50], 0xdfe8ff);
    this.scene.add(this.dust);
    // camera language: monumental low angle, profile, extreme close-up, high three-quarter; cuts on the bar grid
    this.shots = [
      { az: 0, el: -0.12, d: 1.0, ty: 0.62 },
      { az: 1.15, el: 0.02, d: 0.85, ty: 0.72 },
      { az: 0.35, el: 0.04, d: 0.45, ty: 0.8 },
      { az: -0.7, el: 0.22, d: 0.95, ty: 0.68 },
      { az: -1.25, el: -0.05, d: 0.7, ty: 0.75 }
    ];
    this.shot = 0; this.cam = { ...this.shots[0] };
    this.aspect = 16 / 9; this.spreadT = 0;
  }
  spawn(i, any) {
    const e = this.em, h = this.box ? this.box.max.y : 10;
    e.pos.set([(Math.random() - 0.5) * 14, any ? Math.random() * h * 1.4 : Math.random() * 2, (Math.random() - 0.5) * 10], i * 3);
    e.vel.set([(Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4], i * 3);
    e.life[i] = 0.4 + Math.random() * 0.6;
  }
  resize(w, h) { this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  update(S, t, dt) {
    const U = this.U, beat = Math.min(1, S.beat);
    U.uTime.value = t;
    U.uC1.value.copy(this.ctx.c1);
    if (this.ld === undefined) this.ld = this.ld2 = S.dropCount;
    if (S.dropCount !== this.ld) { this.ld = S.dropCount; this.spreadT = 1; for (let i = 0; i < this.em.n; i += 2) { this.spawn(i, true); this.em.vel[i * 3 + 1] += 3; } }
    this.spreadT = Math.max(0, this.spreadT - dt / 6);
    U.uSpread.value = smooth(0, 1, this.spreadT) * 0.6 + S.bass * 0.06;
    U.uHeat.value = (0.6 + 0.2 * Math.sin(t * 0.8) + beat * 0.7 + S.bass * 0.6 + S.drop * 1.2) * sceneOpt(S, 'iron', 'heat', 1);
    // shots: cut every 16 beats (follow the global cut setting), snap to the hero on drops
    if (sceneOpt(S, 'iron', 'cuts', true) && S.beatCount !== this.lb && S.beatCount % sceneOpt(S, 'iron', 'every', 16) === 0) { this.lb = S.beatCount; this.shot = (this.shot + 1 + Math.floor(Math.random() * (this.shots.length - 1))) % this.shots.length; }
    if (S.dropCount !== this.ld2) { this.ld2 = S.dropCount; this.shot = 0; }
    const target = this.shots[this.shot], c = this.cam, k = 1 - Math.exp(-dt * 2.2);
    for (const key of ['az', 'el', 'd', 'ty']) c[key] += (target[key] - c[key]) * k;
    const h = this.box ? this.box.max.y : 10;
    const amp = sceneOpt(S, 'iron', 'motion', 1);
    const az = c.az + Math.sin(t * 0.07) * 0.18 * amp, el = c.el + Math.sin(t * 0.05) * 0.04 * amp;
    const dist = h * 2.3 * c.d / Math.min(1, this.aspect / 1.6) - S.drop * h * 0.25 - beat * 0.15 * amp;
    const ty = h * c.ty;
    this.camera.position.set(Math.sin(az) * dist * Math.cos(el), ty + Math.sin(el) * dist, Math.cos(az) * dist * Math.cos(el));
    this.camera.lookAt(Math.sin(az) * 0.4, ty + 0.2, 0);
    this.head.rotation.y = Math.sin(t * 0.11) * 0.12;
    // light: rims breathe with the groove, the underlight follows the palette and kicks on beats
    this.rimL.intensity = 3 + beat * 2; this.rimR.intensity = 2 + beat * 1.5;
    this.under.color.copy(this.ctx.c1);
    this.under.intensity = 90 + beat * 140 + S.drop * 120;
    this.shafts.visible = sceneOpt(S, 'iron', 'beams', true);
    this.shafts.children.forEach(s => {
      s.material.uniforms.uTime.value = t;
      s.material.uniforms.uK.value = (0.05 + 0.025 * Math.sin(t * 0.6 + s.userData.i * 2)) * (1 + beat * 0.6 + S.drop);
      s.rotation.z = s.userData.a + Math.sin(t * 0.13 + s.userData.i) * 0.06;
    });
    // embers drift up through the heat
    const e = this.em, c1 = this.ctx.c1;
    for (let i = 0; i < e.n; i++) {
      e.life[i] -= dt * 0.12;
      if (e.life[i] <= 0 || e.pos[i * 3 + 1] > h * 1.6) this.spawn(i, false);
      e.vel[i * 3] += Math.sin(t * 1.3 + i) * dt * 0.3;
      e.vel[i * 3 + 1] *= 1 - dt * 0.15;
      for (let a = 0; a < 3; a++) e.pos[i * 3 + a] += e.vel[i * 3 + a] * dt * (1 + S.drop * 2);
      const f = Math.min(1, e.life[i] * 2) * (0.6 + beat * 0.6);
      e.col[i * 3] = (1.4 + c1.r * 0.6) * f; e.col[i * 3 + 1] = (0.45 + c1.g * 0.3) * f; e.col[i * 3 + 2] = 0.12 * f;
    }
    this.embers.geometry.attributes.position.needsUpdate = true;
    this.embers.geometry.attributes.color.needsUpdate = true;
    this.dust.userData.U.uTime.value = t; this.dust.userData.U.uK.value = 0.5 + beat * 0.4;
  }
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- the same head as a living particle cloud ----------
function sampleSurface(geo, n) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
  const tris = idx ? idx.count / 3 : pos.count / 3;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const cdf = new Float32Array(tris);
  let total = 0;
  const vi = (t, k) => idx ? idx.getX(t * 3 + k) : t * 3 + k;
  for (let t = 0; t < tris; t++) {
    A.fromBufferAttribute(pos, vi(t, 0)); B.fromBufferAttribute(pos, vi(t, 1)); C.fromBufferAttribute(pos, vi(t, 2));
    total += t1.subVectors(B, A).cross(t2.subVectors(C, A)).length() * 0.5;
    cdf[t] = total;
  }
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), R = new Float32Array(n);
  const NA = new THREE.Vector3(), NB = new THREE.Vector3(), NC = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = Math.random() * total;
    let lo = 0, hi = tris - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    A.fromBufferAttribute(pos, vi(lo, 0)); B.fromBufferAttribute(pos, vi(lo, 1)); C.fromBufferAttribute(pos, vi(lo, 2));
    NA.fromBufferAttribute(nor, vi(lo, 0)); NB.fromBufferAttribute(nor, vi(lo, 1)); NC.fromBufferAttribute(nor, vi(lo, 2));
    P.set([A.x * w + B.x * u + C.x * v, A.y * w + B.y * u + C.y * v, A.z * w + B.z * u + C.z * v], i * 3);
    t1.set(NA.x * w + NB.x * u + NC.x * v, NA.y * w + NB.y * u + NC.y * v, NA.z * w + NB.z * u + NC.z * v).normalize();
    N.set([t1.x, t1.y, t1.z], i * 3);
    R[i] = Math.random();
  }
  return { P, N, R };
}

export class ParticleEntityScene {
  constructor(ctx) {
    Object.assign(this, { key: 'ghost', cat: 'ent', name: 'Parçacık Varlık', energy: 'low', textPos: null, ownEnv: true });
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
    this.U = { uTime: { value: 0 }, uBeat: { value: 0 }, uDis: { value: 0 }, uScan: { value: -10 }, uC1: { value: new THREE.Color() }, uSize: { value: 2 }, uH: { value: 10 }, uBright: { value: 1 } };
    loadBust().then(({ geometry, box }) => {
      const { P, N, R } = sampleSurface(geometry, 140000);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('aN', new THREE.BufferAttribute(N, 3));
      g.setAttribute('aR', new THREE.BufferAttribute(R, 1));
      this.U.uH.value = box.max.y;
      this.box = box;
      this.pts = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec3 aN; attribute float aR; uniform float uTime, uBeat, uDis, uScan, uSize, uH; varying float vA, vScan;
vec3 flow(vec3 p){ return vec3(sin(p.y*0.9+uTime*0.6+cos(p.z*0.7)), sin(p.z*0.8-uTime*0.5+cos(p.x*0.9)), sin(p.x*0.85+uTime*0.4+cos(p.y*0.6))); }
void main(){
  vec3 p=position;
  // a dissolve front sweeps the head; above it the points are blown into a flow field
  float front=smoothstep(uScan-0.4,uScan+0.4,p.y)*(1.0-smoothstep(uScan+0.6,uScan+uH*0.35,p.y));
  float d=clamp(uDis+front*0.85,0.0,1.0)*(0.35+aR*0.65);
  vec3 q=p+aN*uBeat*0.12*(0.5+aR);
  q+=(flow(p*0.35+aR*3.0)*3.5+aN*1.5+vec3(0.0,2.5,0.0))*d*d;
  vec4 mv=modelViewMatrix*vec4(q,1.0);
  gl_Position=projectionMatrix*mv;
  vScan=exp(-abs(p.y-uScan)*2.5);
  vec3 n=normalize(mat3(modelMatrix)*aN);
  float lit=0.18+0.82*max(dot(n,normalize(vec3(-0.5,0.6,0.7))),0.0)+0.6*pow(1.0-abs(dot(normalize(cameraPosition-p),n)),3.0);
  vA=(0.55+0.45*aR)*(1.0-d*0.6)*lit;
  gl_PointSize=uSize*(0.6+aR*0.8+vScan*1.5)*(30.0/-mv.z);
}`,
        fragmentShader: `uniform vec3 uC1; uniform float uBright; varying float vA, vScan;
void main(){ vec2 c=gl_PointCoord-0.5; float r=dot(c,c); if(r>0.25) discard; float a=exp(-r*16.0)*vA;
  vec3 col=mix(vec3(0.78,0.85,1.0),uC1*2.5+0.3,vScan); gl_FragColor=vec4(col*a*(0.9+vScan*2.0)*uBright,1.0); }`
      }));
      this.pts.frustumCulled = false;
      this.scene.add(this.pts);
    });
    this.dust = haze(700, [50, 26, 50], 0xcfdcff);
    this.scene.add(this.dust);
    this.aspect = 16 / 9; this.disT = 0; this.scanT = -1;
  }
  resize(w, h) { this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.U.uSize.value = h / 540; }
  update(S, t, dt) {
    const U = this.U, h = this.box ? this.box.max.y : 10;
    U.uTime.value = t; U.uBeat.value = Math.min(1, S.beat); U.uC1.value.copy(this.ctx.c1);
    U.uBright.value = sceneOpt(S, 'ghost', 'bright', 1);
    // drop: the whole head blows apart and reforms over ~2 bars; every 16 beats a scan line sweeps it top to bottom
    if (this.ld === undefined) this.ld = S.dropCount;
    if (S.dropCount !== this.ld) { this.ld = S.dropCount; this.disT = 1; }
    this.disT = Math.max(0, this.disT - dt / 4);
    U.uDis.value = Math.pow(this.disT, 1.5) + S.bass * 0.05;
    const scanEvery = sceneOpt(S, 'ghost', 'scan', 16);
    if (scanEvery && S.beatCount !== this.lb && S.beatCount % scanEvery === 0) { this.lb = S.beatCount; this.scanT = 0; }
    if (this.scanT >= 0) { this.scanT += dt / 3; if (this.scanT > 1) this.scanT = -1; }
    U.uScan.value = this.scanT >= 0 ? h * 1.15 - this.scanT * h * 1.5 : 1000;
    const amp = sceneOpt(S, 'ghost', 'motion', 1);
    const az = Math.sin(t * 0.06) * 0.7 * amp + Math.sin(t * 0.13) * 0.15;
    const d = h * 1.75 / Math.min(1, this.aspect / 1.6) - S.drop * h * 0.3;
    this.camera.position.set(Math.sin(az) * d, h * 0.8 + Math.sin(t * 0.09) * h * 0.06, Math.cos(az) * d);
    this.camera.lookAt(0, h * 0.72, 0);
    this.dust.userData.U.uTime.value = t; this.dust.userData.U.uK.value = 0.35 + U.uBeat.value * 0.3;
  }
  render(r) { r.render(this.scene, this.camera); }
}
