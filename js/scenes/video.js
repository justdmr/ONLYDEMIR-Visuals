// Real footage scenes: NASA Scientific Visualization Studio clips (public domain), played as textures with a quiet,
// filmic music response (slow push on the bar, breathing exposure on the bass, no flashes), plus "SİNYAL":
// a story sequence that chains the clips into one narrative with crossfades and small film-style chapter captions.
import * as THREE from 'three';
import { sceneOpt } from '../common.js';

const DIR = 'assets/video/';
// file, scene name, caption for the story
export const CLIPS = {
  aurora: ['Kuzey Işıkları', 'SİNYAL ALINDI — KUZEY KUTBU, 03:12'],
  moon_descent: ['Ay\'a İniş', 'AY — 384.400 KM'],
  earthrise: ['Dünya Doğuşu', 'GERİYE BAKIŞ'],
  earthrise_chase: ['Ay Yörüngesi', 'YÖRÜNGE — SESSİZLİK'],
  moon_earthrise: ['Ay ve Dünya', 'KARANLIK YÜZ'],
  moon_crater: ['Krater', 'KRATER — İZ YOK'],
  moon_sunrise: ['Ay\'da Gün Doğumu', 'AYDA ŞAFAK'],
  sun_gold: ['Güneş Koronası', 'KAYNAK: GÜNEŞ? — HAYIR'],
  sun_red: ['Kızıl Güneş', 'MANYETİK FIRTINA'],
  enceladus_orbit: ['Enceladus', 'ENCELADUS — SATÜRN YÖRÜNGESİ'],
  enceladus_geyser: ['Buz Gayzerleri', 'BUZUN ALTINDAN'],
  enceladus_ocean: ['Gizli Okyanus', 'OKYANUS. HAREKET VAR.'],
  nebula_a: ['Kedi Pençesi Bulutsusu', 'KEDİ PENÇESİ BULUTSUSU — 5.500 IŞIK YILI'],
  nebula_b: ['Bulutsu Derinliği', 'YILDIZ DOĞUMHANESİ'],
  pulsar: ['Pulsar', 'PULSAR — SİNYALİN KAYNAĞI'],
  nova1: ['Çift Yıldız', 'ÇİFT YILDIZ — DENGE BOZULUYOR'],
  nova2: ['Nova', 'MADDE AKIŞI'],
  nova3: ['Nova Patlaması', 'PATLAMA'],
  supernova: ['Süpernova', 'SÜPERNOVA']
};
export const STORY = ['aurora', 'moon_descent', 'earthrise', 'sun_gold', 'enceladus_orbit', 'enceladus_geyser', 'enceladus_ocean', 'nebula_a', 'pulsar', 'nova1', 'nova3', 'supernova', 'nebula_b'];

const VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
// cover-fit, slow push, a whisper of chromatic edge, exposure breathing; crossfade between two clips
const FRAG = `
uniform sampler2D tA, tB; uniform float uMix, uZoom, uAspect, uVidAsp, uExpo, uDriftX, uDriftY;
varying vec2 vUv;
vec2 cover(vec2 uv){
  vec2 p=uv-0.5;
  float r=uAspect/uVidAsp;
  if(r>1.0) p.y/=r; else p.x*=r;
  p/=uZoom; p+=vec2(uDriftX,uDriftY);
  return p+0.5;
}
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
void main(){
  vec2 uv=cover(vUv);
  vec3 a=lin(texture2D(tA,uv).rgb);
  vec3 c=a;
  if(uMix<1.0){ vec3 b=lin(texture2D(tB,uv).rgb); c=mix(b,a,smoothstep(0.0,1.0,uMix)); }
  gl_FragColor=vec4(c*uExpo,1.0);
}`;

function makeVideo(name) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.src = DIR + name + '.webm';
  const t = new THREE.VideoTexture(v);
  t.colorSpace = THREE.NoColorSpace;   // linearised in the shader
  t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return { v, t };
}

// videos only decode while their scene is on screen
const live = new Set();
setInterval(() => {
  const now = performance.now();
  live.forEach(s => { if (now - s.seen > 800) { s.pauseAll(); live.delete(s); } });
}, 400);

class Base {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.U = { tA: { value: null }, tB: { value: null }, uMix: { value: 1 }, uZoom: { value: 1 }, uAspect: { value: 16 / 9 }, uVidAsp: { value: 16 / 9 },
      uExpo: { value: 1 }, uDriftX: { value: 0 }, uDriftY: { value: 0 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false }));
    m.frustumCulled = false;
    this.scene.add(m);
    this.push = 0; this.seen = 0;
  }
  resize(w, h) { this.U.uAspect.value = w / h; }
  // quiet music response shared by all footage
  breathe(S, t, dt) {
    this.seen = performance.now(); live.add(this);
    const amp = sceneOpt(S, this.key, 'motion', 1);
    if (S.beatCount !== this.lb) { this.lb = S.beatCount; if (S.beatCount % 4 === 0) this.push = 1; }
    this.push *= Math.exp(-dt * 1.2);
    const bar = (S.clockPhase || t * 2) / 4;
    this.U.uZoom.value = 1.04 + (Math.sin(t * 0.05) * 0.5 + 0.5) * 0.05 * amp + this.push * 0.012 * amp + S.drop * 0.03 * amp;
    this.U.uDriftX.value = Math.sin(t * 0.031 + bar * 0.2) * 0.012 * amp;
    this.U.uDriftY.value = Math.cos(t * 0.027) * 0.008 * amp;
    this.U.uExpo.value = (1 + S.bass * 0.08 * S.react + Math.min(1, S.beat) * 0.04) * sceneOpt(S, this.key, 'expo', 1);
  }
  play(v) { if (v.paused) v.play().catch(() => {}); }
}

export class VideoScene extends Base {
  constructor(ctx, name) {
    super(ctx);
    Object.assign(this, { key: 'v_' + name, name: CLIPS[name][0], cat: 'space', energy: 'low', textPos: null, ownEnv: true });
    this.clip = name;
  }
  pauseAll() { this.vid?.v.pause(); }
  update(S, t, dt) {
    if (!this.vid) {
      this.vid = makeVideo(this.clip);
      this.vid.v.addEventListener('loadedmetadata', () => { this.U.uVidAsp.value = this.vid.v.videoWidth / this.vid.v.videoHeight; });
      this.U.tA.value = this.vid.t;
    }
    this.play(this.vid.v);
    this.vid.v.playbackRate = sceneOpt(S, this.key, 'speed', 1);
    this.breathe(S, t, dt);
  }
  render(r) { r.render(this.scene, this.camera); }
}

// "SİNYAL": the clips as one story, a chapter every N bars, crossfaded, with a small caption per chapter
export class StoryScene extends Base {
  constructor(ctx) {
    super(ctx);
    Object.assign(this, { key: 'v_story', name: 'SİNYAL · Hikâye', cat: 'space', energy: 'mid', textPos: null, ownEnv: true });
    this.vids = {};
    this.i = 0; this.fade = 1; this.capT = 0;
  }
  get(name) { return this.vids[name] || (this.vids[name] = makeVideo(name)); }
  pauseAll() { Object.values(this.vids).forEach(o => o.v.pause()); }
  start(i) {
    this.prevName = STORY[this.i];
    this.i = (i + STORY.length) % STORY.length;
    const cur = this.get(STORY[this.i]);
    cur.v.currentTime = 0;
    this.U.tB.value = this.U.tA.value;
    this.U.tA.value = cur.t;
    this.fade = 0; this.capT = 0;
    this.get(STORY[(this.i + 1) % STORY.length]);   // warm the next chapter
  }
  update(S, t, dt) {
    if (!this.U.tA.value) this.start(0);
    const every = sceneOpt(S, this.key, 'bars', 8) * 4;
    if (S.beatCount !== this.lb2) {
      this.lb2 = S.beatCount;
      if (this.started && S.beatCount % every === 0) this.start(this.i + 1);
      this.started = true;
    }
    if (S.dropCount !== this.ld) { if (this.ld !== undefined) this.start(STORY.indexOf('supernova')); this.ld = S.dropCount; }
    this.fade = Math.min(1, this.fade + dt / 2.5);
    this.U.uMix.value = this.fade;
    const cur = this.get(STORY[this.i]);
    this.play(cur.v);
    const prev = this.vids[this.prevName];
    if (prev && prev !== cur) { if (this.fade < 1) this.play(prev.v); else prev.v.pause(); }
    this.U.uVidAsp.value = cur.v.videoWidth ? cur.v.videoWidth / cur.v.videoHeight : 16 / 9;
    this.capT += dt;
    this.breathe(S, t, dt);
  }
  // film-style chapter caption: small, low, fades in and out
  extraText(S) {
    if (!sceneOpt(S, this.key, 'captions', true)) return [];
    const a = Math.min(1, this.capT / 1.2) * (1 - Math.min(1, Math.max(0, this.capT - 6) / 1.5));
    if (a <= 0.01) return [];
    const n = String(this.i + 1).padStart(2, '0');
    const c = Math.round(a * 255);
    return [{ t: `${n}   ${CLIPS[STORY[this.i]][1]}`, x: 0.5, y: 0.9, s: 0.02, w: 0.8, c: `rgb(${c},${c},${c})`, f: '{s}px Michroma, sans-serif', plain: true }];
  }
  render(r) { r.render(this.scene, this.camera); }
}
