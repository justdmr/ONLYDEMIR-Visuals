// Stage-name hero scenes: Earth orbit, iced-out chain, black hole, neon sign, vinyl deck, foil balloons, hologram.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { chromeText, backgroundQuad, makeDust, makeSparkles, glowSprite, canvasTex, Spinner, ease } from '../common.js';

const TAU = Math.PI * 2;

// ---------- shared helpers ----------
const BG_BOKEH = `
vec3 scene(vec2 p){
  vec3 c=mix(vec3(0.015,0.008,0.01),RED*0.06,smoothstep(0.7,-0.6,p.y));
  for(float i=0.0;i<14.0;i++){
    vec2 o=vec2(hash(vec2(i,1.0))*2.2-1.1+sin(uTime*0.05+i)*0.08,hash(vec2(i,2.0))*1.2-0.6+cos(uTime*0.04+i*1.7)*0.05);
    float r=0.04+hash(vec2(i,3.0))*0.09;
    float d=length(p-o);
    vec3 col=hash(vec2(i,4.0))<0.5?RED:mix(uAccent,vec3(1.0,0.8,0.55),0.5);
    c+=col*(smoothstep(r,r*0.85,d)*0.10+smoothstep(r*1.1,r,d)*0.05)*(0.6+uBass*0.5);
  }
  return c;
}`;

const BG_SPACE = `
vec3 scene(vec2 p){
  vec3 c=vec3(0.0);
  for(float i=0.0;i<3.0;i++){
    vec2 g=p*(70.0+i*80.0)+i*13.7;
    vec2 id=floor(g);
    float h=hash(id);
    vec2 f=fract(g)-0.5-(vec2(hash(id+1.3),hash(id+7.1))-0.5)*0.6;
    c+=vec3(0.85,0.9,1.0)*smoothstep(0.09,0.0,length(f))*step(0.982,h)*(0.6+0.4*sin(uTime*2.0+h*50.0))*(1.0-i*0.25);
  }
  float n=sin(p.x*2.1+uTime*0.02)*sin(p.y*3.3-0.4)+0.6*sin(p.x*5.7+p.y*2.3);
  c+=RED*0.05*smoothstep(0.0,1.4,n)+vec3(0.08,0.12,0.35)*0.06*smoothstep(-0.4,1.0,-n);
  return c;
}`;

// bend a text geometry around the Y axis so it hugs a cylinder/sphere of radius R
function bend(g, R) {
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const a = p[i] / R, r = R + p[i + 2];
    p[i] = Math.sin(a) * r;
    p[i + 2] = Math.cos(a) * r;
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// one copy of the text every 2π/n around a ring of radius R
function textRing(ctx, str, R, size, depth) {
  const probe = chromeText(ctx, str, { size, depth });
  const gap = size * 1.6;
  const n = Math.max(1, Math.floor(TAU * R / (probe.width + gap)));
  const group = new THREE.Group();
  for (let k = 0; k < n; k++) {
    const g = probe.mesh.geometry.clone();
    g.translate(0, 0, depth / 2);
    bend(g, R);
    const m = new THREE.Mesh(g, probe.mesh.material);
    m.rotation.y = k * TAU / n;
    group.add(m);
  }
  probe.mesh.geometry.dispose();
  return group;
}

function disposeTree(o) { o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }

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
// twinkling cross-star sparkles at the given positions
function sparklePoints(positions) {
  const n = positions.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) r[i] = Math.random();
  g.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uSize: { value: 400 }, uTex: { value: sparkleTexture() }, uColor: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `
attribute float aRand; uniform float uTime, uBeat, uSize; varying float vA;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  float tw=pow(max(0.0,sin(uTime*(1.2+aRand*2.5)+aRand*60.0)),18.0);
  vA=min(tw+min(uBeat,1.0)*0.7*step(0.8,aRand),1.3);
  gl_PointSize=uSize*(0.3+vA)/(-mv.z);
}`,
    fragmentShader: `
uniform sampler2D uTex; uniform vec3 uColor; varying float vA;
void main(){ float a=texture2D(uTex,gl_PointCoord).a; gl_FragColor=vec4(uColor*a*vA*1.4,a*vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.update = (t, S, h) => { mat.uniforms.uTime.value = t; mat.uniforms.uBeat.value = Math.min(1, S.beat) * 1.5 + S.drop * 2; mat.uniforms.uSize.value = h * 0.45; };
  return pts;
}

// area-weighted random points on triangles whose normal passes `keep`
function sampleSurface(g, count, keep) {
  const p = g.attributes.position.array, nrm = g.attributes.normal.array;
  const tris = [], areas = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const idx = g.index ? g.index.array : null;
  const vcount = idx ? idx.length : p.length / 3;
  for (let i = 0; i < vcount; i += 3) {
    const i0 = idx ? idx[i] : i, i1 = idx ? idx[i + 1] : i + 1, i2 = idx ? idx[i + 2] : i + 2;
    if (!keep(nrm[i0 * 3], nrm[i0 * 3 + 1], nrm[i0 * 3 + 2])) continue;
    a.fromArray(p, i0 * 3); b.fromArray(p, i1 * 3); c.fromArray(p, i2 * 3);
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    tris.push(i0, i1, i2); areas.push(area);
  }
  const total = areas.reduce((s, x) => s + x, 0);
  const out = new Float32Array(count * 3);
  for (let k = 0; k < count && total > 0; k++) {
    let r = Math.random() * total, t = 0;
    while (t < areas.length - 1 && r > areas[t]) r -= areas[t++];
    a.fromArray(p, tris[t * 3] * 3); b.fromArray(p, tris[t * 3 + 1] * 3); c.fromArray(p, tris[t * 3 + 2] * 3);
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    a.addScaledVector(ab.subVectors(b, a), u).addScaledVector(ac.subVectors(c, a), v);
    out.set([a.x, a.y, a.z], k * 3);
  }
  return out;
}

class Base {
  constructor(ctx, meta, bg) {
    Object.assign(this, { cat: 'name', textPos: null }, meta);
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.scene.environment = ctx.env;
    this.camera = new THREE.PerspectiveCamera(meta.fov || 35, 16 / 9, 0.1, 3000);
    if (bg) this.scene.add(backgroundQuad(ctx, bg));
    this.spinner = new Spinner(16);
    this.h = 1080; this.aspect = 16 / 9;
  }
  resize(w, h) { this.h = h; this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit?.(); }
  render(r) { r.render(this.scene, this.camera); }
}

// ---------- 1. Earth orbit ----------
export class EarthScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'earth', name: 'Dünya Yörüngesi', energy: 'low', fov: 35 }, BG_SPACE);
    const L = new THREE.TextureLoader();
    const tex = (f, srgb = true) => { const t = L.load('assets/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    this.sun = new THREE.Vector3(1, 0.3, 0.45).normalize();
    this.earthU = {
      tDay: { value: tex('4k_earth_daymap.jpg') }, tNight: { value: tex('4k_earth_nightmap.jpg') }, tSpec: { value: tex('earth_specular_2048.jpg', false) },
      uSun: { value: this.sun }, uTint: { value: new THREE.Color() }, uBeat: { value: 0 }
    };
    const vert = `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(10, 128, 64), new THREE.ShaderMaterial({
      uniforms: this.earthU, vertexShader: vert,
      fragmentShader: `
uniform sampler2D tDay, tNight, tSpec; uniform vec3 uSun, uTint; uniform float uBeat;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n=normalize(vN), v=normalize(cameraPosition-vW);
  float l=dot(n,uSun), day=smoothstep(-0.15,0.25,l);
  vec3 d=texture2D(tDay,vUv).rgb, nt=texture2D(tNight,vUv).rgb;
  float sp=texture2D(tSpec,vUv).r;
  float spec=pow(max(dot(n,normalize(uSun+v)),0.0),60.0)*sp*1.6*day;
  vec3 col=d*max(l,0.0)*1.15+d*0.01+nt*vec3(1.0,0.72,0.42)*(2.4+uBeat*1.5)*(1.0-day)+vec3(1.0,0.95,0.85)*spec;
  float fr=pow(1.0-max(dot(n,v),0.0),3.0);
  col+=mix(vec3(0.3,0.6,1.0),uTint,0.3)*fr*0.9*(0.15+day);
  gl_FragColor=vec4(col,1.0);
}`
    }));
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(10.12, 96, 48), new THREE.ShaderMaterial({
      uniforms: { tC: { value: tex('4k_earth_clouds.jpg', false) }, uSun: { value: this.sun } }, vertexShader: vert,
      fragmentShader: `uniform sampler2D tC; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vec4 tc=texture2D(tC,vUv); float a=tc.a<0.99?tc.a:tc.r; float l=max(dot(normalize(vN),uSun),0.0); gl_FragColor=vec4(vec3(1.0)*(l*0.95+0.01),a*0.6); }`,
      transparent: true, depthWrite: false
    }));
    this.atmoU = { uSun: { value: this.sun }, uTint: { value: new THREE.Color() }, uK: { value: 1 } };
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(10.9, 96, 48), new THREE.ShaderMaterial({
      uniforms: this.atmoU,
      vertexShader: `varying vec3 vV; varying vec3 vNW; void main(){ vV=normalize(normalMatrix*normal); vNW=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uSun, uTint; uniform float uK; varying vec3 vV; varying vec3 vNW;
void main(){ float i=pow(max(0.78-dot(vV,vec3(0.0,0.0,1.0)),0.0),3.0); float s=0.3+0.7*smoothstep(-0.5,0.6,dot(vNW,uSun));
  gl_FragColor=vec4(mix(vec3(0.25,0.55,1.0),uTint,0.3)*i*s*uK*0.9,1.0); }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    }));
    this.globe = new THREE.Group();
    this.globe.add(earth, clouds);
    this.globe.rotation.z = 0.41;
    this.clouds = clouds;
    this.scene.add(this.globe, atmo);
    this.ring = new THREE.Group();
    this.ring.rotation.set(0.32, 0, -0.22);
    this.scene.add(this.ring);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3);
    sunLight.position.copy(this.sun).multiplyScalar(50);
    this.scene.add(sunLight, new THREE.AmbientLight(0x8899ff, 0.06));
    const flare = glowSprite(ctx, 0xfff2dd, 0.9);
    flare.position.copy(this.sun).multiplyScalar(400);
    flare.scale.setScalar(160);
    this.scene.add(flare);
    this.astro = this.astronaut();
    this.scene.add(this.astro);
    this.astroRim = new THREE.DirectionalLight(0x9fc4ff, 2.5);
    this.astroRim.position.set(4, 3, -10);
    this.scene.add(this.astroRim);
    this.built = null;
  }
  astronaut() {
    const suit = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 });
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
    add(new THREE.SphereGeometry(1.25, 48, 32), suit, 0, 2.05, -0.1);
    add(new THREE.TorusGeometry(0.95, 0.16, 16, 48), dark, 0, 1.25, -0.1, Math.PI / 2);
    add(new THREE.CapsuleGeometry(1.15, 1.3, 8, 24), suit, 0, 0, 0);
    add(new THREE.BoxGeometry(2.1, 2.5, 0.9), suit, 0, 0.35, 0.95);
    add(new THREE.BoxGeometry(1.5, 0.5, 0.2), dark, 0, 0.9, 1.45);
    add(new THREE.CapsuleGeometry(0.45, 1.7, 8, 16), suit, -1.5, -0.3, -0.1, 0.15, 0, -0.18);
    add(new THREE.CapsuleGeometry(0.45, 1.7, 8, 16), suit, 1.5, -0.3, -0.3, -0.35, 0, 0.18);
    this.led = add(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0.55, 1.45, 1.42);
    const patch = canvasTex(256, (c, n) => {
      c.fillStyle = '#e30a17'; c.fillRect(0, 0, n, n);
      const G = n * 0.66, ox = n * 0.0, oy = n / 2;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ox + 0.5 * G, oy, 0.25 * G, 0, TAU); c.fill();
      c.fillStyle = '#e30a17'; c.beginPath(); c.arc(ox + 0.5625 * G, oy, 0.2 * G, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath();
      for (let k = 0; k < 10; k++) { const a = Math.PI + k * Math.PI / 5, r = (k % 2 ? 0.0477 : 0.125) * G; const x = ox + 0.8208 * G + Math.cos(a) * r, y = oy - Math.sin(a) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.fill();
    });
    add(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshStandardMaterial({ map: patch, roughness: 0.8 }), -0.6, 1.45, 1.41);
    g.position.set(-4.0, -3.0, 29);
    g.scale.setScalar(0.6);
    g.rotation.y = 0.35;
    return g;
  }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      this.ring.children.forEach(disposeTree);
      this.ring.clear();
      this.ring.add(textRing(this.ctx, S.name || ' ', 10.75, 1.35, 0.45));
    }
    this.earthU.uTint.value.copy(this.ctx.c1);
    this.earthU.uBeat.value = Math.min(1, S.beat);
    this.atmoU.uTint.value.copy(this.ctx.c1);
    this.atmoU.uK.value = 1 + S.beat * 0.35 + S.drop;
    this.globe.children[0].rotation.y += dt * 0.04;
    this.clouds.rotation.y += dt * 0.012;
    // one full orbit every 32 beats, plus a fast spin on drops / every 16 beats
    this.orbit = (this.orbit || 0) + dt / S.speed * (S.bpm / 60) * TAU / 32 * S.speed;
    this.ring.children[0] && (this.ring.children[0].rotation.y = -this.orbit - this.spinner.update(S, dt));
    this.ring.scale.setScalar(1 + S.beat * 0.008);
    this.led.material.color.setScalar(S.beatPhase < 0.15 ? 2 : 0.15).multiply(this.ctx.c1);
    this.astro.visible = S.astro !== false;
    this.camera.position.set(Math.sin(t * 0.05) * 3, 2 + Math.sin(t * 0.07), 44 - S.drop * 4);
    this.camera.lookAt(1.5, 0, 0);
  }
}

// ---------- 2. Iced-out chain on a neck ----------
const CHAIN_N = 64;
// one smooth torso: elliptical sections that widen into shoulders, then slope up into the neck
function torsoGeometry(h0, h1, inflate) {
  const H = 4.3, y0 = -1.3;
  const g = new THREE.CylinderGeometry(1, 1, H * (h1 - h0), 128, 80, true);
  const p = g.attributes.position.array;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.length; i += 3) {
    const h = h0 + (p[i + 1] / (H * (h1 - h0)) + 0.5) * (h1 - h0);
    const a = Math.atan2(p[i + 2], p[i]);
    const W = (2.85 + 0.5 * ss(0.35, 0.72, h)) * (1 - 0.7 * ss(0.76, 1.0, h)) * inflate;
    const D = (1.5 - 0.3 * ss(0.5, 0.9, h)) * (1 - 0.25 * ss(0.85, 1.0, h)) * inflate;
    const front = Math.sin(a) > 0 ? 1 + 0.12 * ss(0.2, 0.6, h) * (1 - ss(0.75, 0.95, h)) : 1;
    p[i] = Math.cos(a) * W;
    p[i + 2] = Math.sin(a) * D * front - 0.25;
    p[i + 1] = y0 + h * H - 0.85 * ss(0.72, 1.0, h) * Math.pow(Math.abs(Math.cos(a)), 1.6);
  }
  g.computeVertexNormals();
  return g;
}
function chainPoint(t, v) {
  const front = Math.pow((1 + Math.cos(t)) / 2, 2.2);
  return v.set(1.62 * Math.sin(t), 3.05 - 1.2 * front, 1.25 * Math.cos(t) + 0.62 * front);
}
export class IcedScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'iced', name: 'Iced Out · 3D', energy: 'mid', fov: 30 }, BG_BOKEH);
    // body finishes: glossy black glass, chrome, marble, skin
    this.finishes = [
      new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1, envMapIntensity: 1.3 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf2efe9, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.6 }),
      new THREE.MeshPhysicalMaterial({ color: 0xc98f72, roughness: 0.62, sheen: 0.25, sheenColor: new THREE.Color(0xffc8b0), clearcoat: 0.08, clearcoatRoughness: 0.7, envMapIntensity: 0.25 })
    ];
    const skin = this.finishes[0];
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xe9c57d, roughness: 0.36, metalness: 0.12, envMapIntensity: 0.9 });
    const top = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.55, metalness: 0.2 });
    this.body = new THREE.Group();
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); this.body.add(m); return m; };
    const sph = new THREE.SphereGeometry(1, 96, 64);
    // neck, sloped trapezius, shoulders, collarbones, chest, black top, jaw and head
    add(new THREE.CylinderGeometry(0.8, 0.95, 3.9, 64), skin, 0, 4.4, 0.05, 1, 1, 0.92, 0.12);
    this.body.add(new THREE.Mesh(torsoGeometry(0, 1, 1), skin));
    this.body.add(new THREE.Mesh(torsoGeometry(0, 0.3, 1.025), top));
    add(sph, skin, 0, 6.45, 0.4, 1.22, 1.2, 1.35);
    add(sph, skin, 0, 7.5, 0, 1.7, 1.85, 1.8);
    // hair: a cap plus ~380 strands for a blonde bob with bangs
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.86, 64, 32, 0, TAU, 0, 1.95), hairMat);
    cap.position.set(0, 7.65, -0.06);
    this.body.add(cap);
    const strands = [];
    for (let i = 0; i < 380; i++) {
      const bang = i < 70;
      let a = bang ? (Math.random() - 0.5) * 1.5 : (Math.random() < 0.5 ? 1 : -1) * (0.85 + Math.random() * (Math.PI - 0.85));
      const j = () => (Math.random() - 0.5) * 0.12;
      const P = (r, y) => new THREE.Vector3(Math.sin(a) * r + j(), y + j(), Math.cos(a) * r + j());
      const pts = bang
        ? [P(1.55, 9.35), P(1.98, 8.75), P(2.02, 8.15), P(1.92, 7.75 + Math.random() * 0.2)]
        : [P(1.6, 9.3), P(2.02, 8.4), P(2.12, 7.2), P(2.05, 6.3), P(1.82 + Math.random() * 0.1, 5.55 + Math.random() * 0.35)];
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.03 + Math.random() * 0.02, 5, false));
    }
    this.hair = new THREE.Mesh(mergeGeometries(strands), hairMat);
    strands.forEach(s => s.dispose());
    this.body.add(this.hair);

    // Cuban chain: alternating flat / standing links with pavé diamonds
    const ice = new THREE.MeshStandardMaterial({ color: 0xd0d0d6, metalness: 1, roughness: 0.1, envMapIntensity: 0.75 });
    const link = new THREE.TorusGeometry(0.15, 0.055, 12, 24);
    link.scale(1.45, 1, 1);
    this.links = new THREE.InstancedMesh(link, ice, CHAIN_N);
    const stone = new THREE.OctahedronGeometry(0.04);
    this.stones = new THREE.InstancedMesh(stone, ice, CHAIN_N * 6);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), P2 = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), tw = new THREE.Quaternion();
    const sparkPos = [];
    for (let i = 0; i < CHAIN_N; i++) {
      const t = i / CHAIN_N * TAU;
      chainPoint(t, P); chainPoint(t + 0.01, P2);
      T.subVectors(P2, P).normalize();
      N.set(P.x, 0, P.z).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      B.crossVectors(N, T);
      m.makeBasis(T, B, N);
      q.setFromRotationMatrix(m);
      if (i % 2) q.multiply(tw.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2.3));
      m.compose(P, q, new THREE.Vector3(1, 1, 1));
      this.links.setMatrixAt(i, m);
      for (let k = 0; k < 6; k++) {
        const off = new THREE.Vector3((k % 3 - 1) * 0.12, (k < 3 ? 0.07 : -0.07), 0.055).applyQuaternion(q);
        const sp = P.clone().add(off);
        this.stones.setMatrixAt(i * 6 + k, new THREE.Matrix4().makeTranslation(sp.x, sp.y, sp.z));
        if (k % 2 === 0) sparkPos.push(sp.x, sp.y, sp.z);
      }
    }
    this.chain = new THREE.Group();
    this.chain.add(this.links, this.stones);
    this.chainSpark = sparklePoints(new Float32Array(sparkPos));
    this.chain.add(this.chainSpark);
    this.body.add(this.chain);

    // pendant pivot hangs from the front of the chain
    this.pivot = new THREE.Group();
    chainPoint(0, P);
    this.pivot.position.copy(P).add(new THREE.Vector3(0, -0.05, 0.12));
    this.pivot.rotation.x = -0.32;
    this.body.add(this.pivot);
    this.swing = { z: 0, vz: 0, x: 0, vx: 0 };
    this.built = null;

    this.scene.add(this.body);
    const key = new THREE.DirectionalLight(0xffe2c8, 1.1); key.position.set(-6, 6, 7);
    this.rim = new THREE.DirectionalLight(0xff2030, 3.5); this.rim.position.set(7, 3, -5);
    const rim2 = new THREE.DirectionalLight(0xb0c8ff, 1.2); rim2.position.set(-7, 4, -6);
    this.chainLight = new THREE.PointLight(0xffffff, 1.2, 9); this.chainLight.position.set(0, 2.6, 5);
    this.scene.add(key, this.rim, rim2, this.chainLight, new THREE.HemisphereLight(0x251818, 0x030303, 0.25));
  }
  buildPendant(name) {
    this.pivot.children.forEach(disposeTree);
    this.pivot.clear();
    const { mesh, width, height } = chromeText(this.ctx, name || ' ', { size: 0.62, depth: 0.16, shear: 0.06, face: 'clean' });
    this.silver = this.silver || new THREE.MeshStandardMaterial({ color: 0xcfd0d6, metalness: 1, roughness: 0.14, envMapIntensity: 0.7 });
    mesh.material = [this.silver, this.silver];
    mesh.position.y = -0.55 - height / 2;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 12, 24), this.silver);
    bail.position.y = -0.18;
    bail.rotation.y = Math.PI / 2;
    const ice = sampleSurface(mesh.geometry, 520, (x, y, z) => z > 0.7);
    for (let i = 1; i < ice.length; i += 3) ice[i] += mesh.position.y;
    const stones = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.028), this.links.material, ice.length / 3);
    for (let i = 0; i < ice.length / 3; i++) stones.setMatrixAt(i, new THREE.Matrix4().makeTranslation(ice[i * 3], ice[i * 3 + 1], ice[i * 3 + 2] + 0.01));
    this.pendSpark = sparklePoints(ice.slice(0, 3 * 90));
    this.pendant = new THREE.Group();
    this.pendant.add(mesh, bail, stones, this.pendSpark);
    this.pivot.add(this.pendant);
    this.pw = width;
  }
  update(S, t, dt) {
    if (S.name !== this.built) { this.built = S.name; this.buildPendant(S.name); }
    // pendulum: gravity + damping, kicked on every beat
    const sw = this.swing;
    if (S.beatCount !== this.lastBeat) {
      this.lastBeat = S.beatCount;
      sw.vz += (Math.random() < 0.5 ? -1 : 1) * 0.9 * S.react;
      sw.vx += 0.4 * S.react;
    }
    if (S.dropCount !== this.lastDrop) { this.lastDrop = S.dropCount; sw.vz += 3; }
    const step = Math.min(dt, 1 / 30);
    sw.vz += (-14 * Math.sin(sw.z) - 2.2 * sw.vz) * step; sw.z += sw.vz * step;
    sw.vx += (-14 * Math.sin(sw.x) - 3 * sw.vx) * step; sw.x = Math.max(-0.05, sw.x + sw.vx * step);
    this.pendant.rotation.z = sw.z * 0.6;
    this.pendant.rotation.x = -sw.x * 0.5;
    this.pendant.rotation.y = this.spinner.update(S, dt) + Math.sin(t * 0.9) * 0.15;
    const fin = this.finishes[S.icedSkin || 0];
    if (this.curFin !== fin) {
      this.curFin = fin;
      this.body.traverse(o => { if (o.isMesh && this.finishes.includes(o.material)) o.material = fin; });
    }
    this.body.rotation.y = Math.sin(t * 0.22) * 0.5;
    this.body.position.y = Math.sin(t * 1.4) * 0.03;
    this.hair.rotation.y = Math.sin(t * 0.8) * 0.01 + sw.z * 0.004;
    this.rim.color.copy(this.ctx.c1);
    this.rim.intensity = 3 + S.beat * 3 + S.drop * 5;
    this.chainLight.intensity = 0.8 + S.beat * 2.5;
    [this.chainSpark, this.pendSpark].forEach(p => p.userData.update(t, S, this.h));
    this.camera.position.set(Math.sin(t * 0.13) * 0.8, 2.6 + Math.sin(t * 0.17) * 0.2, 14 - S.drop * 1.5);
    this.camera.lookAt(0, 2.55, 0);
  }
}

// ---------- 3. Black hole ----------
const BG_BLACKHOLE = `
vec3 stars(vec3 d){
  vec2 uv=vec2(atan(d.z,d.x),asin(clamp(d.y,-1.0,1.0)))*45.0;
  vec2 id=floor(uv), f=fract(uv)-0.5;
  return vec3(0.9,0.92,1.0)*step(0.965,hash(id))*smoothstep(0.14,0.0,length(f))*1.5+RED*0.025*(0.5+0.5*sin(d.x*3.0+d.y*5.0));
}
vec3 scene(vec2 p){
  vec3 ro=vec3(0.0,1.7,11.0);
  vec3 fw=normalize(-ro), rt=normalize(cross(fw,vec3(0.0,1.0,0.0))), up=cross(rt,fw);
  vec3 rd=normalize(p.x*rt+p.y*up+1.374*fw);
  vec3 pos=ro, vel=rd, col=vec3(0.0);
  float a=0.0;
  for(int i=0;i<150;i++){
    float r=length(pos);
    if(r<1.0){ a=1.0; break; }
    float dt=0.035+0.05*r;
    vel=normalize(vel-pos*(1.7/(r*r*r))*dt);
    vec3 np=pos+vel*dt;
    if(pos.y*np.y<0.0){
      vec3 hp=mix(pos,np,pos.y/(pos.y-np.y));
      float hr=length(hp.xz);
      if(hr>1.8&&hr<6.0){
        float ang=atan(hp.z,hp.x), rr=(hr-1.8)/4.2;
        float spin=uTime*(2.4/hr);
        float streak=0.55+0.45*sin(ang*3.0+rr*30.0-spin*6.0)*sin(ang*7.0-rr*14.0+spin*3.0);
        vec3 hot=mix(vec3(1.5,1.35,1.2),RED*1.7,smoothstep(0.0,0.55,rr));
        hot=mix(hot,uAccent*0.5,smoothstep(0.6,1.0,rr));
        float dop=1.0+0.75*dot(normalize(vec3(-hp.z,0.0,hp.x)),-rd);
        float dens=smoothstep(0.0,0.06,rr)*smoothstep(1.0,0.65,rr)*(0.55+0.8*streak)*dop*(0.75+uBass*0.8+uBeat*0.4+uDrop);
        col+=hot*dens*(1.0-a);
        a+=dens*0.5*(1.0-a);
      }
    }
    pos=np;
    if(r>30.0) break;
  }
  col+=stars(vel)*(1.0-a);
  return col;
}`;
export class BlackHoleScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'blackhole', name: 'Kara Delik', energy: 'high', fov: 40 }, BG_BLACKHOLE);
    this.camera.position.set(0, 1.7, 11);
    this.camera.lookAt(0, 0, 0);
    this.orbiters = new THREE.Group();
    this.scene.add(this.orbiters);
    this.built = null;
    this.v = new THREE.Vector3();
  }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      this.orbiters.children.forEach(disposeTree);
      this.orbiters.clear();
      for (let k = 0; k < 2; k++) this.orbiters.add(chromeText(this.ctx, S.name || ' ', { size: 0.85, depth: 0.28 }).mesh);
    }
    // the names orbit the hole on a tilted ellipse (one lap per 16 beats) and always face the camera
    this.orbit = (this.orbit || 0) + dt * (S.bpm / 60) * TAU / 16;
    const spin = this.spinner.update(S, dt);
    this.orbiters.children.forEach((m, k) => {
      const a = this.orbit + k * Math.PI;
      this.v.set(Math.cos(a) * 7.4, 0, Math.sin(a) * 7.4).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.32).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.12);
      m.position.copy(this.v);
      m.lookAt(this.camera.position);
      m.rotateY(spin);
      const behind = this.v.z < 0 ? 0.75 : 1;
      m.scale.setScalar(behind * (1 + S.beat * 0.05));
    });
  }
}

// ---------- 4. Neon sign ----------
const BG_ALLEY = `
vec3 scene(vec2 p){
  vec3 c=mix(vec3(0.012,0.01,0.016),vec3(0.03,0.02,0.035),smoothstep(-0.5,0.5,p.y));
  c+=RED*0.18*exp(-length((p-vec2(0.0,0.12))*vec2(0.8,1.6))*2.2)*(0.7+uBass*0.5);
  vec2 b=p*vec2(9.0,18.0); b.x+=step(1.0,mod(b.y,2.0))*0.5;
  vec2 f=fract(b);
  float mortar=smoothstep(0.04,0.0,min(f.x,1.0-f.x))+smoothstep(0.06,0.0,min(f.y,1.0-f.y));
  c*=1.0-0.35*mortar*smoothstep(-0.2,0.5,p.y);
  return c;
}`;
export class NeonScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'neon', name: 'Neon Tabela', energy: 'mid', fov: 35 }, BG_ALLEY);
    this.sign = new THREE.Group();
    this.mirror = new THREE.Group();
    this.mirror.scale.y = -1;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.32, metalness: 0.3, envMapIntensity: 0.12, transparent: true, opacity: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.2;
    this.mirror.position.y = -8.4;
    this.scene.add(this.sign, this.mirror, floor, new THREE.AmbientLight(0xffffff, 0.15));
    this.glowLight = new THREE.PointLight(0xff2030, 60, 40);
    this.glowLight.position.set(0, 0, 3);
    this.scene.add(this.glowLight);
    this.built = null;
    this.letters = [];
  }
  build(name) {
    [this.sign, this.mirror].forEach(g => { g.children.forEach(disposeTree); g.clear(); });
    const font = this.ctx.font, size = 3, res = font.data.resolution;
    const tubes = [];
    let x = 0;
    this.letters = [];
    for (const ch of name || ' ') {
      const glyph = font.data.glyphs[ch];
      const adv = (glyph ? glyph.ha : res * 0.6) * size / res + size * 0.12;
      if (ch.trim()) {
        const geos = [];
        for (const shape of font.generateShapes(ch, size)) {
          for (const contour of [shape, ...shape.holes]) {
            const pts = contour.getPoints(10).map(v => new THREE.Vector3(v.x + x, v.y, 0));
            if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-3) pts.pop();
            if (pts.length < 3) continue;
            geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), Math.max(24, pts.length * 3), 0.075, 8, true));
          }
        }
        if (geos.length) {
          const g = mergeGeometries(geos);
          geos.forEach(q => q.dispose());
          const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          tubes.push(g);
          this.letters.push({ mat, on: 0, next: 0 });
          this.sign.add(new THREE.Mesh(g, mat));
          this.mirror.add(new THREE.Mesh(g, mat));
        }
      }
      x += adv;
    }
    const box = new THREE.Box3().setFromObject(this.sign);
    const c = box.getCenter(new THREE.Vector3());
    this.sign.children.forEach(m => m.position.sub(c));
    this.mirror.children.forEach(m => m.position.sub(c));
    this.w = box.max.x - box.min.x;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(this.w + 1.6, size * 1.25, 0.25), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.35, metalness: 0.8 }));
    plate.position.z = -0.45;
    this.sign.add(plate);
    this.mirror.add(plate.clone());
    this.fit();
    this.ignite();
  }
  ignite() { this.letters.forEach((l, i) => { l.on = 0; l.next = performance.now() / 1000 + 0.15 + i * 0.12 + Math.random() * 0.1; }); }
  fit() {
    if (!this.w) return;
    const tn = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.dist = Math.max((this.w * 1.35 / 2) / (tn * this.aspect), 9 / tn);
  }
  update(S, t, dt) {
    if (S.name !== this.built) { this.built = S.name; this.build(S.name); }
    if (S.dropCount !== this.lastDrop) { this.lastDrop = S.dropCount; this.ignite(); }
    const now = performance.now() / 1000;
    const hot = this.ctx.c1.clone().lerp(new THREE.Color(1, 1, 1), 0.25);
    this.letters.forEach(l => {
      if (now > l.next) {
        // flicker on while igniting, then mostly steady with rare dropouts
        l.on = l.on < 1 ? (Math.random() < 0.55 ? 1 : 0.05) : (Math.random() < 0.004 ? 0.1 : 1);
        l.next = now + (l.on < 1 ? 0.04 + Math.random() * 0.08 : 0.05);
        if (l.on === 1 && Math.random() < 0.4) l.next += 1;
      }
      l.mat.color.copy(hot).multiplyScalar(l.on * (2.6 + S.beat * 2 + S.drop * 3));
    });
    this.glowLight.color.copy(this.ctx.c1);
    this.glowLight.intensity = 40 + S.beat * 60;
    const rot = Math.sin(t * 0.4) * 0.3 + this.spinner.update(S, dt);
    this.sign.rotation.y = this.mirror.rotation.y = rot;
    this.sign.position.y = 0.6;
    this.mirror.position.y = -9;
    this.camera.position.set(Math.sin(t * 0.11) * 3, 0.5 + Math.sin(t * 0.09), (this.dist || 25) - S.drop * 3);
    this.camera.lookAt(0, -0.4, 0);
  }
}

// ---------- 5. Vinyl on a turntable ----------
export class VinylScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'vinyl', name: 'Plak', energy: 'mid', fov: 38 }, BG_BOKEH);
    const metal = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4, metalness: 0.85 });
    const deck = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(19, 1.4, 15), metal);
    plinth.position.y = -0.8;
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.1, 0.5, 128), ctx.mats.clean);
    platter.position.y = 0.15;
    deck.add(plinth, platter);
    // strobe dots around the platter edge, lit in time with the beat
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), this.dotMat, 4 * 120);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let row = 0; row < 4; row++) for (let i = 0; i < 120; i++) {
      const a = i / 120 * TAU;
      q.setFromEuler(new THREE.Euler(0, -a, Math.PI / 2));
      m.compose(new THREE.Vector3(Math.cos(a) * 7.12, 0.0 + row * 0.11, Math.sin(a) * 7.12), q, new THREE.Vector3(1, 1, 1));
      dots.setMatrixAt(row * 120 + i, m);
    }
    this.disc = new THREE.Group();
    this.disc.add(dots);
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = this.labelCanvas.height = 2048;
    this.labelTex = new THREE.CanvasTexture(this.labelCanvas);
    this.labelTex.colorSpace = THREE.SRGBColorSpace;
    this.labelTex.anisotropy = 8;
    const vinylTop = new THREE.MeshStandardMaterial({ map: this.labelTex, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.2 });
    const vinylSide = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3 });
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.08, 160), [vinylSide, vinylTop, vinylSide]);
    vinyl.position.y = 0.45;
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16), ctx.mats.clean);
    spindle.position.y = 0.6;
    this.disc.add(vinyl, spindle);
    this.disc.position.y = 0.0;
    deck.add(this.disc);
    // tonearm
    const arm = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.8, 32), ctx.mats.clean);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 8.6, 16), ctx.mats.clean);
    tube.rotation.z = Math.PI / 2; tube.position.set(-4.3, 0.9, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.7), metal);
    head.position.set(-8.6, 0.75, 0.15);
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 24), metal);
    weight.rotation.z = Math.PI / 2; weight.position.set(0.9, 0.9, 0);
    arm.add(base, tube, head, weight);
    arm.position.set(8, 0.2, -4.5);
    arm.rotation.y = -0.62;
    this.arm = arm;
    deck.add(arm);
    this.scene.add(deck);
    this.floatName = new THREE.Group();
    this.floatName.position.y = 3.2;
    this.scene.add(this.floatName);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 12, 8);
    this.rim = new THREE.DirectionalLight(0xff2030, 4); this.rim.position.set(8, 4, -10);
    this.scene.add(key, this.rim, new THREE.AmbientLight(0xffffff, 0.08));
    this.labelKey = '';
    this.built = null;
  }
  drawLabel(name, c1, c2) {
    const key = name + c1 + c2;
    if (key === this.labelKey) return;
    this.labelKey = key;
    const g = this.labelCanvas.getContext('2d'), n = 2048, c = n / 2;
    g.fillStyle = '#080808'; g.fillRect(0, 0, n, n);
    for (let r = c * 0.36; r < c; r += 2.2) {
      g.strokeStyle = `rgba(255,255,255,${0.025 + 0.03 * Math.random()})`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke();
    }
    for (const r of [0.52, 0.66, 0.8]) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, c * r, 0, TAU); g.stroke(); }
    g.fillStyle = c1; g.beginPath(); g.arc(c, c, c * 0.33, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(c, c, c * 0.1, 0, TAU); g.fill();
    g.fillStyle = c2; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `italic 900 ${c * 0.075}px Exo2, Anton, sans-serif`;
    g.fillText(name, c, c - c * 0.17);
    g.font = `700 ${c * 0.028}px -apple-system, Helvetica, sans-serif`;
    g.fillText('LIVE SET  ·  SIDE A  ·  33⅓ RPM', c, c + c * 0.17);
    g.font = `${c * 0.035}px Anton, sans-serif`;
    // curved tagline around the label
    const tag = '★ 29 EKİM ★ CUMHURİYET 103 ★ ' + name + ' ★';
    g.save(); g.translate(c, c);
    [...tag].forEach((ch, i) => { g.save(); g.rotate(-Math.PI / 2 + i / tag.length * TAU); g.translate(0, -c * 0.28); g.fillText(ch, 0, 0); g.restore(); });
    g.restore();
    this.labelTex.needsUpdate = true;
  }
  update(S, t, dt) {
    this.drawLabel(S.name, S.c1, S.c2);
    if (S.name !== this.built) {
      this.built = S.name;
      this.floatName.children.forEach(disposeTree);
      this.floatName.clear();
      const { mesh } = chromeText(this.ctx, S.name || ' ', { size: 1.4, depth: 0.4 });
      this.floatName.add(mesh);
    }
    // 33⅓-ish: one revolution per bar
    this.spinA = (this.spinA || 0) + dt * (S.bpm / 60) / 4 * TAU;
    this.disc.rotation.y = -this.spinA;
    this.dotMat.color.copy(this.ctx.c1).multiplyScalar((S.beatPhase < 0.12 ? 3 : 0.35) + S.drop * 2);
    this.floatName.rotation.y = t * 0.8 + this.spinner.update(S, dt);
    this.floatName.position.y = 3.2 + Math.sin(t * 1.2) * 0.25 + S.beat * 0.2;
    this.arm.rotation.y = -0.62 - Math.sin(t * 0.05) * 0.04;
    this.rim.color.copy(this.ctx.c1);
    const a = t * 0.12;
    this.camera.position.set(Math.sin(a) * 21, 9 + Math.sin(t * 0.2) * 2.5, Math.cos(a) * 21);
    this.camera.lookAt(0, 1, 0);
  }
}

// ---------- 6. Foil balloon letters with confetti ----------
const CONFETTI = 700;
export class BalloonScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'balloons', name: 'Balon Harfler', energy: 'mid', fov: 35 }, BG_BOKEH);
    this.foil = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 700], envMapIntensity: 1.7 });
    this.word = new THREE.Group();
    this.scene.add(this.word);
    const conf = new THREE.PlaneGeometry(0.22, 0.38);
    this.conf = new THREE.InstancedMesh(conf, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }), CONFETTI);
    this.cf = [];
    const col = new THREE.Color();
    for (let i = 0; i < CONFETTI; i++) {
      this.cf.push({ p: new THREE.Vector3((Math.random() - 0.5) * 60, Math.random() * 40 - 20, (Math.random() - 0.5) * 30), v: 1 + Math.random() * 2, r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: 1 + Math.random() * 3, k: i % 3 });
      this.conf.setColorAt(i, col.setRGB(1, 1, 1));
    }
    this.scene.add(this.conf);
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-5, 8, 10);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.2));
    this.dummy = new THREE.Object3D();
    this.built = null;
  }
  build(name) {
    this.word.children.forEach(disposeTree);
    this.word.clear();
    const font = this.ctx.font, size = 3, res = font.data.resolution;
    let x = 0;
    this.items = [];
    for (const ch of name || ' ') {
      const glyph = font.data.glyphs[ch];
      const adv = (glyph ? glyph.ha : res * 0.6) * size / res + size * 0.22;
      if (ch.trim()) {
        const g = new TextGeometry(ch, { font, size, height: 0.5, curveSegments: 16, bevelEnabled: true, bevelThickness: 0.95, bevelSize: 0.34, bevelSegments: 12 });
        g.computeBoundingBox();
        const b = g.boundingBox, c = b.getCenter(new THREE.Vector3());
        g.translate(-c.x, -c.y, -c.z);
        g.computeVertexNormals();
        const holder = new THREE.Group();
        holder.add(new THREE.Mesh(g, this.foil));
        const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 20 }, (_, i) => new THREE.Vector3(Math.sin(i * 0.9) * 0.15, -(b.max.y - b.min.y) / 2 - i * 0.6, 0))),
          new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.35 }));
        holder.add(str);
        holder.position.x = x + (b.max.x - b.min.x) / 2;
        this.word.add(holder);
        this.items.push(holder);
      }
      x += adv;
    }
    const box = new THREE.Box3().setFromObject(this.word);
    const c = box.getCenter(new THREE.Vector3());
    this.items.forEach(h => { h.position.x -= c.x; h.userData.x = h.position.x; });
    this.w = box.max.x - box.min.x;
    this.fit();
  }
  fit() {
    if (!this.w) return;
    const tn = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    this.dist = Math.max((this.w * 1.3 / 2) / (tn * this.aspect), 10 / tn);
  }
  update(S, t, dt) {
    if (S.name !== this.built) { this.built = S.name; this.build(S.name); }
    this.foil.color.copy(this.ctx.c1).lerp(new THREE.Color(1, 1, 1), 0.45);
    // a wave of 360 spins runs across the letters every 16 beats and on drops
    if ((S.beatCount !== this.lastB && S.beatCount % 16 === 0) || S.dropCount !== this.lastDrop) { this.lastB = S.beatCount; this.lastDrop = S.dropCount; this.wave = 0; }
    if (this.wave !== undefined) this.wave += dt;
    this.items.forEach((h, i) => {
      h.position.y = Math.sin(t * 1.1 + i * 0.7) * 0.35 + S.beat * 0.25 * Math.sin(i * 2.3);
      let spin = 0;
      if (this.wave !== undefined) { const k = (this.wave - i * 0.09) / 1.2; if (k > 0 && k < 1) spin = ease(k) * TAU; }
      h.rotation.y = Math.sin(t * 0.6 + i) * 0.22 + spin;
      h.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.06;
    });
    const cols = [this.ctx.c1, this.ctx.c2, new THREE.Color(1, 0.75, 0.25)];
    const burst = S.drop * 18;
    this.cf.forEach((c, i) => {
      c.p.y -= dt * (c.v + burst);
      c.p.x += Math.sin(t * c.s + i) * dt * 0.8;
      if (c.p.y < -22) { c.p.y = 22; c.p.x = (Math.random() - 0.5) * 60; }
      c.r.x += dt * c.s; c.r.y += dt * c.s * 0.7;
      this.dummy.position.copy(c.p);
      this.dummy.rotation.copy(c.r);
      this.dummy.updateMatrix();
      this.conf.setMatrixAt(i, this.dummy.matrix);
      this.conf.setColorAt(i, cols[c.k]);
    });
    this.conf.instanceMatrix.needsUpdate = true;
    this.conf.instanceColor.needsUpdate = true;
    this.camera.position.set(Math.sin(t * 0.15) * 6, 1 + Math.sin(t * 0.11) * 2, (this.dist || 30) - S.drop * 3);
    this.camera.lookAt(0, 0, 0);
  }
}

// ---------- 7. Hologram on a pedestal ----------
export class HologramScene extends Base {
  constructor(ctx) {
    super(ctx, { key: 'holo', name: 'Hologram', energy: 'mid', fov: 35 }, BG_SPACE);
    this.holoU = { uTime: { value: 0 }, uGlitch: { value: 0 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() } };
    this.holoMat = new THREE.ShaderMaterial({
      uniforms: this.holoU,
      vertexShader: `
uniform float uTime, uGlitch; varying vec3 vN; varying float vY; varying float vBack;
float hash(float n){ return fract(sin(n)*43758.5453); }
void main(){
  vec3 p=position;
  float row=floor(p.y*5.0+floor(uTime*12.0)*7.0);
  p.x+=(hash(row)-0.5)*uGlitch*step(0.7,hash(row*1.7))*1.2;
  vN=normalize(normalMatrix*normal);
  vBack=normal.z;
  vec4 w=modelMatrix*vec4(p,1.0);
  vY=w.y;
  gl_Position=projectionMatrix*viewMatrix*w;
}`,
      fragmentShader: `
uniform float uTime; uniform vec3 uC1, uC2; varying vec3 vN; varying float vY; varying float vBack;
void main(){
  if(vBack<0.5||!gl_FrontFacing) discard;
  float fr=pow(1.0-abs(vN.z),1.6);
  float scan=0.55+0.45*sin(vY*38.0-uTime*9.0);
  float band=smoothstep(0.985,1.0,sin(vY*1.6-uTime*2.5))*2.5;
  float flick=0.85+0.15*step(0.93,fract(sin(floor(uTime*24.0))*43758.5453));
  vec3 col=mix(uC1,uC2,0.35+0.35*fr);
  gl_FragColor=vec4(col*((0.22+fr*1.1)*scan+band)*flick*1.6,1.0);
}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide
    });
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.3, metalness: 0.9 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.3, 96), metal);
    ped.position.y = -4.4;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.06, 12, 128), this.ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = -3.74;
    this.coneU = { uC: { value: new THREE.Color() }, uK: { value: 1 } };
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 3.9, 9, 64, 1, true), new THREE.ShaderMaterial({
      uniforms: this.coneU,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uK; varying vec2 vUv; varying vec3 vN; void main(){ float f=pow(1.0-abs(vN.z),2.0); gl_FragColor=vec4(uC*(1.0-vUv.y)*(0.06+0.25*f)*uK,1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    }));
    cone.position.y = 0.8;
    this.hud = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const pts = [];
      const r = 5.2 + i * 0.9, seg = 90 + i * 30;
      for (let k = 0; k < seg; k++) if (k % 3 !== 2) { const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU; pts.push(new THREE.Vector3(Math.cos(a0) * r, 0, Math.sin(a0) * r), new THREE.Vector3(Math.cos(a1) * r, 0, Math.sin(a1) * r)); }
      const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
      l.rotation.set(0.2 + i * 0.5, 0, i * 0.4);
      this.hud.add(l);
    }
    this.text = new THREE.Group();
    this.scene.add(ped, ring, cone, this.hud, this.text);
    this.dust = makeDust(500, [14, 10, 14], 0.06);
    this.dust.position.set(0, -2, 7);
    this.scene.add(this.dust);
    this.scene.add(new THREE.DirectionalLight(0xffffff, 1.5).translateX(-4).translateY(8).translateZ(8));
    this.built = null;
  }
  update(S, t, dt) {
    if (S.name !== this.built) {
      this.built = S.name;
      this.text.children.forEach(disposeTree);
      this.text.clear();
      const { mesh, width } = chromeText(this.ctx, S.name || ' ', { size: 2.2, depth: 0.6 });
      mesh.material = this.holoMat;
      mesh.position.z = 0.32;
      const back = mesh.clone();
      back.position.z = -0.32;
      back.rotation.y = Math.PI;
      this.text.add(mesh, back);
      this.w = width;
    }
    const c1 = this.ctx.c1, c2 = this.ctx.c2;
    this.holoU.uC1.value.copy(c1); this.holoU.uC2.value.copy(c2);
    this.holoU.uTime.value = t;
    this.holoU.uGlitch.value = S.drop * 2 + (S.beat > 0.8 ? 0.4 : 0) + (S.glitchHold ? 1.5 : 0);
    this.ringMat.color.copy(c1).multiplyScalar(2 + S.beat * 3);
    this.coneU.uC.value.copy(c1).lerp(c2, 0.3); this.coneU.uK.value = 1 + S.beat + S.drop * 2;
    // one revolution per 8 beats
    this.rev = (this.rev || 0) + dt * (S.bpm / 60) * TAU / 8;
    this.text.rotation.y = this.rev + this.spinner.update(S, dt);
    this.text.position.y = Math.sin(t * 1.1) * 0.2;
    this.hud.children.forEach((l, i) => { l.rotation.y = t * (0.3 + i * 0.2) * (i % 2 ? -1 : 1); l.material.color.copy(c2); });
    this.dust.userData.update(dt, 1 + S.bass * 3, 14);
    const tn = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const dist = Math.max(((this.w || 18) * 1.5 / 2) / (tn * this.aspect), 9 / tn);
    this.camera.position.set(Math.sin(t * 0.13) * 4, 2 + Math.sin(t * 0.1), dist - S.drop * 3);
    this.camera.lookAt(0, -0.5, 0);
  }
}
