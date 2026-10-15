import * as THREE from 'three';
import { createContext, PALETTES, ENVS } from './common.js';
import { Compositor, TextLayer, TRANSITIONS, MIRRORS, EQ_LAYERS, TEXT_STYLES } from './fx.js';
import { AudioEngine } from './audio.js';
import { LogoScene, EmblemScene, Text29Scene } from './scenes/chrome.js';
import { ParticleScene } from './scenes/particles.js';
import { FlagScene } from './scenes/flag.js';
import { SpectrumScene } from './scenes/spectrum.js';
import { tunnelScene, ataScene, fireworksScene } from './scenes/shaders.js';
import { liquidScene, fractalScene, radialScene, ledScene, scopeScene, rainScene, synthScene, laserScene } from './scenes/more.js';
import { RingsScene, TerrainScene } from './scenes/more3d.js';
import { EarthScene, IcedScene, BlackHoleScene, NeonScene, VinylScene, BalloonScene, HologramScene } from './scenes/name.js';
import { BeatClock, CLOCK_MODES } from './clock.js';
import { CityScene, BustScene, TVWallScene, BUST_FIN } from './scenes/real.js';
import { PhotoScene, PHOTO_DEFS } from './scenes/photo.js';
import { Sting } from './sting.js';
import { IronScene, ParticleEntityScene } from './scenes/entity.js';

// ---------- settings ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('odv_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('odv_' + k, JSON.stringify(v)); } catch {} }
};
const DEFAULT_MSGS = ['ONLYDEMIR', '29 EKİM 1923', 'CUMHURİYET 103 YAŞINDA', 'NE MUTLU TÜRKÜM DİYENE', 'ONLYDEMIR', 'YURTTA SULH, CİHANDA SULH'];
const FONTS = [
  ['Minimal', '300 {s}px "Helvetica Neue", "SF Pro Display", Arial, sans-serif', 0.32],
  ['Anton', '{s}px Anton, Impact, sans-serif'],
  ['Exo İtalik', 'italic 900 {s}px Exo2, sans-serif'],
  ['Helvetica', '900 {s}px "Helvetica Neue", Arial, sans-serif'],
  ['Mono', '700 {s}px "SF Mono", Menlo, monospace'],
  ['Serif', 'italic 700 {s}px Didot, "Bodoni 72", Georgia, serif'],
  ['Unbounded', '900 {s}px Unbounded, sans-serif', 0.02],
  ['Monoton', '{s}px Monoton, sans-serif', 0.02],
  ['Bungee 3D', '{s}px "Bungee Shade", sans-serif', 0.02],
  ['Neon', '{s}px "Tilt Neon", sans-serif', 0.06],
  ['Glitch', '{s}px "Rubik Glitch", sans-serif', 0.03],
  ['Cinzel', '900 {s}px Cinzel, serif', 0.12],
  ['Syne', '800 {s}px Syne, sans-serif', 0.02],
  ['Kondanse', '900 {s}px "Big Shoulders Display", sans-serif', 0.05],
  ['Bodoni', 'italic 900 {s}px "Bodoni Moda", serif', 0.03],
  ['Michroma', '{s}px Michroma, sans-serif', 0.1]
];
const DEFAULTS = {
  scene: 0, name: 'ONLYDEMIR', msgs: DEFAULT_MSGS, textMode: 0, msgEvery: 8, font: 0, textSize: 0.7, textPlace: 0, corner: false, textGlow: 0.25,
  auto: 'director', autoEvery: 32, lock: false, off: ['tunnel', 'fireworks', 'led', 'scope', 'rain', 'synth', 'lasers'], palette: 'bayrak', c1: '#e30a17', c2: '#ffffff', bpm: 128,
  speed: 1, react: 1, beatSens: 1.3, bloom: 1, glitchAmt: 0.7, rgbAmt: 0.6, grain: 0.6, trails: 0, punch: 0.35, shake: 0.2, beatFlash: 0,
  hue: 0, sat: 1, contrast: 1, vignette: 1, scan: 0, mirror: 0, eq: 0, eqSize: 1, trans: 4, transDur: 1.5, textStyle: 0, textShine: 0.6, sc: {}, lensStreak: 0.6, lensGhost: 0.35, lensDirt: 0.5, flareTint: 0, sting: true, master: 1, quality: 1,
  clock: 'lock', offsetMs: 0, strobeDiv: 4, fb: 0, fbZoom: 1.02, fbRot: 0.004, fbHue: 0, astro: true, bustFin: 0, env: 'studio', icedVariant: 0, photoMotion: 1, photoCuts: true, cutEvery: 8, tone: 1, exposure: 1
};
const CFG_KEYS = Object.keys(DEFAULTS);
// one-time move of older saved settings to the new pro defaults (keeps name, messages and colours)
const CFG_VERSION = 3;
if (store.get('cfgVersion', 1) < CFG_VERSION) {
  const old = store.get('cfg', {});
  const keep = ['name', 'msgs', 'palette', 'c1', 'c2', 'bpm', 'clock', 'offsetMs', 'quality', 'master'];
  store.set('cfg', Object.fromEntries(keep.filter(k => k in old).map(k => [k, old[k]])));
  store.set('cfgVersion', CFG_VERSION);
}
const S = {
  ...structuredClone(DEFAULTS), ...store.get('cfg', {}),
  bass: 0, mid: 0, high: 0, beat: 0, energy: 0, phase: 'main', mode: 'demo',
  beatCount: 0, msgFlash: 0, drop: 0, dropCount: 0, travel: 0, barPos: 0, beatPhase: 0, clockPhase: 0,
  fade: 0, fadeTarget: 1, strobe: false, glitchHold: false, invert: false
};
const cfg = () => Object.fromEntries(CFG_KEYS.map(k => [k, S[k]]));
let saveTimer;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('cfg', cfg()), 300); };

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NoToneMapping;

const loading = document.getElementById('loading');
let ctx;
try {
  await Promise.all([document.fonts.load('100px Anton', 'AİŞ'), document.fonts.load('italic 900 100px Exo2', 'AİŞ')]);
  // the text canvas is only redrawn when its content changes, so every display font must be ready before the first frame
  await Promise.all(FONTS.map(f => document.fonts.load(f[1].replace('{s}', 100), 'ONLYDEMİRŞĞıçö1923').catch(() => {})));
  ctx = await createContext(renderer);
} catch (e) {
  loading.querySelector('small').textContent = 'Yüklenemedi: ' + e.message;
  throw e;
}
const fx = new Compositor(renderer);
const text = new TextLayer();
const sting = new Sting(ctx);
const audio = new AudioEngine(S);
const clock = new BeatClock(S);
audio.on('onset', () => clock.onset());
ctx.U.uSpec.value.image.data = audio.spec;
ctx.U.uWave.value.image.data = audio.wave;

const CATS = { pro: 'Fotogerçekçi · 2.5D', ent: 'Sinematik 3D · Demir', name: 'İsim · Sahne', '3d': '3D · Logo', tr: '29 Ekim', eq: 'Ekolayzır', psy: 'Psikedelik' };
// photoreal 2.5D scenes come first; skip any whose image/depth pair is missing
const photoOk = await Promise.all(PHOTO_DEFS.map(d => fetch(`assets/photo/${d.variants[0]}_depth.png`, { method: 'HEAD' }).then(r => r.ok).catch(() => false)));
const scenes = [
  ...PHOTO_DEFS.filter((d, i) => photoOk[i]).map(d => new PhotoScene(ctx, d)),
  new LogoScene(ctx), new EmblemScene(ctx), new ParticleScene(ctx), new FlagScene(ctx), new Text29Scene(ctx),
  new SpectrumScene(ctx), tunnelScene(ctx), ataScene(ctx), fireworksScene(ctx),
  liquidScene(ctx), fractalScene(ctx), new RingsScene(ctx), radialScene(ctx), new TerrainScene(ctx),
  ledScene(ctx), scopeScene(ctx), rainScene(ctx), synthScene(ctx), laserScene(ctx),
  new CityScene(ctx), new BustScene(ctx), new TVWallScene(ctx),
  new EarthScene(ctx), new BlackHoleScene(ctx), new NeonScene(ctx), new VinylScene(ctx), new BalloonScene(ctx), new HologramScene(ctx),
  // appended last so existing keyboard / MIDI pad numbers keep pointing at the same scenes
  new IronScene(ctx), new ParticleEntityScene(ctx)
];
const DEFAULT_CAT = { logo: '3d', emblem: '3d', particles: '3d', flag: 'tr', 29: 'tr', spectrum: 'eq', tunnel: 'tr', ata: 'tr', fireworks: 'tr' };
scenes.forEach(s => { s.cat = s.cat || DEFAULT_CAT[s.key] || 'psy'; });
const byKey = k => scenes.findIndex(s => s.key === k);

let cur = Math.min(S.scene, scenes.length - 1), prev = -1, mix = 1, transDur = 1;

function setScene(i, dur = S.transDur) {
  i = (i + scenes.length) % scenes.length;
  if (i === cur) return;
  prev = cur; cur = i; mix = 0; transDur = Math.max(0.05, dur);
  S.scene = cur; save();
  refreshUI();
}
// next ticked scene in grid order (sequential loop)
function nextInLoop() {
  const n = scenes.length;
  for (let d = 1; d <= n; d++) { const i = (cur + d) % n; if (!S.off.includes(scenes[i].key)) return i; }
  return cur;
}
// random scene from the auto playlist, optionally limited to some energies
function pick(energies) {
  let opts = scenes.map((s, i) => i).filter(i => i !== cur && !S.off.includes(scenes[i].key));
  const byE = energies ? opts.filter(i => energies.includes(scenes[i].energy)) : opts;
  if (byE.length) opts = byE;
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : cur;
}

// ---------- show logic ----------
clock.onBeat(() => {
  // with a free-running clock the pulse follows the music's energy so breakdowns stay calm
  const free = S.mode === 'mic' && S.clock !== 'auto';
  S.beat = Math.min(1.5, S.react) * (free ? 0.35 + 0.65 * Math.min(1, S.energy * 1.6) : 1);
  S.beatCount++;
  if (S.beatCount % S.msgEvery === 0) S.msgFlash = 1;
  if (S.lock || S.beatCount % S.autoEvery) return;
  if (S.auto === 'seq') setScene(nextInLoop());
  else if (S.auto === 'timed') setScene(pick());
  else if (S.auto === 'director' && S.phase === 'main') setScene(pick(['mid', 'high']));
});
audio.on('break', () => { if (!S.lock && S.auto === 'director') setScene(pick(['low', 'mid']), Math.max(S.transDur, 2)); });
audio.on('drop', () => doDrop());
function doDrop() {
  S.phase = 'main';
  S.drop = 1;
  S.dropCount++;
  S.msgFlash = 1;
  if (S.sting) sting.fire(S);
  if (!S.lock && S.auto !== 'off') setScene(S.auto === 'seq' ? nextInLoop() : pick(['high']), 0.3);
  flashUI('dropBtn');
}

function currentMsg() {
  const list = S.msgs.filter(s => s.trim());
  return list.length ? list[Math.floor(S.beatCount / S.msgEvery) % list.length] : '';
}
function textLines(sc) {
  const lines = sc.extraText ? sc.extraText(S) : [];
  if (sc.textPos && S.textMode > 0) {
    const t = S.textMode === 3 ? currentMsg() : S.name;
    let [x, y, w] = sc.textPos;
    if (S.textPlace) { x = 0.5; y = [0, 0.14, 0.5, 0.86][S.textPlace]; w = 0.85; }
    if (t.trim()) lines.unshift({ t, x, y, s: 0.12 * S.textSize, w });
  }
  if (S.corner) lines.push({ t: S.name, x: 0.9, y: 0.07, s: 0.04, w: 0.17 });
  return lines;
}

// ---------- sizing ----------
let W = 0, H = 0, PR = 0;
function resize() {
  const w = innerWidth, h = innerHeight, pr = S.quality;
  if (w === W && h === H && pr === PR) return;
  W = w; H = h; PR = pr;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  fx.setSize(w, h, pr);
  text.setSize(w * pr, h * pr);
  ctx.U.uRes.value.set(w * pr, h * pr);
  scenes.forEach(s => s.resize(w * pr, h * pr));
  sting.resize(w * pr, h * pr);
}

// ---------- loop ----------
let lastT = performance.now(), T = 0;
const follow = (c, t, dt, k) => c + (t - c) * Math.min(1, Math.max(0, dt * k));
function frame(now) {
  requestAnimationFrame(frame);
  // never negative: a timestamp that runs backwards would push every decay/follow the wrong way (black frames)
  const dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000));
  lastT = now;
  const sdt = dt * S.speed;
  T += sdt;
  resize();
  audio.update(dt, now);
  clock.update(dt, now);
  S.beat *= Math.exp(-dt * 6);
  S.msgFlash *= Math.exp(-dt * 5);
  S.drop *= Math.exp(-dt * 1.4);
  S.travel += sdt * (0.5 + S.bass * 1.5 + S.drop * 4);
  S.fade = follow(S.fade, S.fadeTarget, dt, 4);

  const U = ctx.U;
  U.uTime.value = T; U.uBass.value = S.bass; U.uMid.value = S.mid; U.uHigh.value = S.high;
  U.uBeat.value = S.beat; U.uTravel.value = S.travel; U.uDrop.value = S.drop;
  U.uSpec.value.needsUpdate = true;
  U.uWave.value.needsUpdate = true;
  ctx.update(S);

  if (mix < 1) { mix = Math.min(1, mix + dt / transDur); if (mix >= 1) prev = -1; }
  const A = scenes[cur], B = prev >= 0 ? scenes[prev] : null;
  A.update(S, T, sdt);
  if (B) B.update(S, T, sdt);

  const stingA = sting.update(S, dt);
  // text
  const lines = textLines(A);
  const font = FONTS[S.font] || FONTS[0];
  text.draw(lines, S.c1, font[1], font[2] ?? 0.04, S.textGlow, S.textStyle);
  const cu = fx.compose.uniforms;
  const onlyBeat = S.textMode === 2 && lines.length === 1 + (S.corner ? 1 : 0);
  cu.tText.value = text.tex;
  cu.uTextAlpha.value = (lines.length ? (onlyBeat ? Math.pow(Math.min(1, S.beat), 1.5) : 0.92 + S.beat * 0.08) : 0) * Math.min(1, mix * 1.5) * (1 - stingA);
  cu.uSting.value = stingA; cu.uStingDim.value = stingA * 0.72;
  cu.uTextScale.value = 1 + S.beat * 0.05 + S.drop * 0.1;
  if (lines[0]) cu.uTextCenter.value.set(lines[0].x, 1 - lines[0].y);
  // one light sweep across the letters every two bars, locked to the beat clock
  cu.uTextSweep.value = ((S.clockPhase || T * 2) / 8 % 1) * 2.6 - 0.5;
  cu.uTextShine.value = S.textShine * (1 + S.drop);
  const spike = S.beat > 0.8 && Math.random() < 0.12 ? 0.35 : 0;
  const glitch = S.glitchHold ? 1 : Math.max(S.drop * 0.7, spike, mix < 1 && S.trans === 0 ? (1 - Math.abs(mix * 2 - 1)) * 0.4 : 0) * S.glitchAmt;
  cu.uTextGlitch.value = Math.min(1, Math.max(S.msgFlash, glitch));
  cu.uMix.value = mix;
  cu.uTrans.value = S.trans;
  cu.uTime.value = T;
  cu.uMirror.value = S.mirror;
  cu.uPunch.value = (S.beat * 0.05 + S.drop * 0.12) * S.punch;
  const sh = (S.beat * 0.006 + S.drop * 0.025) * S.shake;
  cu.uShake.value.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  cu.uEQ.value = S.eq; cu.uEQSize.value = S.eqSize; cu.uBass.value = S.bass;
  cu.uSpec.value = U.uSpec.value; cu.uWave.value = U.uWave.value;
  cu.uC1.value.copy(U.uC1.value); cu.uC2.value.copy(U.uAccent.value);

  fx.feedback.enabled = S.fb > 0.01;
  fx.feedback.uniforms.uDecay.value = S.fb; fx.feedback.uniforms.uZoom.value = S.fbZoom;
  fx.feedback.uniforms.uRot.value = S.fbRot; fx.feedback.uniforms.uHue.value = S.fbHue;
  fx.trails.enabled = S.trails > 0.01;
  fx.trails.uniforms.damp.value = S.trails;
  // the drop logo stays crisp: bloom backs off while it is on screen
  fx.bloom.strength = (0.25 + S.beat * 0.25 + S.drop * 0.7) * S.bloom * (1 - stingA * 0.7);
  const lu = fx.lens.uniforms, lensKick = 1 + Math.min(1, S.beat) * 0.6 + S.drop * 1.5;
  fx.lens.enabled = S.lensStreak + S.lensGhost + S.lensDirt > 0.01;
  lu.uStreak.value = S.lensStreak * lensKick; lu.uGhost.value = S.lensGhost * (1 + S.drop); lu.uDirt.value = S.lensDirt;
  if (S.flareTint === 0) lu.uTint.value.set(0.42, 0.62, 1);
  else if (S.flareTint === 1) lu.uTint.value.copy(U.uC1.value).multiplyScalar(1.2).addScalar(0.08);
  else lu.uTint.value.set(0.85, 0.82, 0.78);
  const fu = fx.final.uniforms;
  fu.uTime.value = T; fu.uBeat.value = Math.min(1, S.beat); fu.uGlitch.value = glitch;
  fu.uRGB.value = S.rgbAmt; fu.uGrain.value = S.grain;
  fu.uFade.value = S.fade; fu.uMaster.value = S.master;
  fu.uInvert.value = S.invert ? 1 : 0;
  fu.uHue.value = S.hue * Math.PI / 180; fu.uSat.value = S.sat; fu.uContrast.value = S.contrast;
  fu.uVignette.value = S.vignette; fu.uScan.value = S.scan;
  fu.uTone.value = S.tone; fu.uExposure.value = S.exposure;
  fu.uStrobe.value = Math.max(S.strobe && (S.clockPhase * S.strobeDiv) % 1 < 0.5 ? 1 : 0, Math.pow(S.drop, 6) * 0.9, Math.pow(Math.min(1, S.beat), 4) * S.beatFlash * 0.7);

  fx.render(A, B, dt, sting.active ? sting : null);
  updateMeters();
}

// ---------- recording ----------
let rec, chunks = [];
function toggleRec() {
  if (rec) { rec.stop(); return; }
  const stream = canvas.captureStream(60);
  if (audio.stream) audio.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if (!mime) return status('Bu tarayıcı video kaydını desteklemiyor.');
  chunks = [];
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 24e6 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
    a.download = `onlydemir-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    rec = null;
    refreshUI();
  };
  rec.start(1000);
  refreshUI();
}

// ---------- Atatürk photo (IndexedDB) ----------
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('onlydemir', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async put(k, v) { const db = await this.open(); return new Promise(res => { const tr = db.transaction('f', 'readwrite'); v == null ? tr.objectStore('f').delete(k) : tr.objectStore('f').put(v, k); tr.oncomplete = res; }); },
  async get(k) { const db = await this.open(); return new Promise(res => { const r = db.transaction('f').objectStore('f').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
};
function loadImage(blob, save) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const tex = new THREE.Texture(img);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    ctx.U.uImg.value = tex;
    ctx.U.uHasImg.value = 1;
    ctx.U.uImgAsp.value = img.width / img.height;
    URL.revokeObjectURL(url);
    $('imgHint').textContent = 'Fotoğraf yüklendi ✓';
    if (save) idb.put('img', blob).catch(() => {});
  };
  img.src = url;
}
idb.get('img').then(b => b && loadImage(b, false)).catch(() => {});

// ---------- MIDI: pads from 36 = scenes, then drop, strobe, blackout, mirror, trails, glitch, lock; CC1/CC7 master, CC2 speed, CC3 bloom, CC4 hue ----------
let midiLast = '';
const MIDI_FX = ['drop', 'strobe', 'blackout', 'ayna', 'iz', 'glitch', 'kilit', 'logo'];
// MIDI clock (0xF8) from Traktor & co. drives the beat clock in 'MIDI Clock' mode
function onMidi(e) {
  const [st, d1, d2] = e.data;
  if (st >= 0xf8) { clock.midi(st, performance.now()); return; }
  const cmd = st & 0xf0;
  const n = d1 - 36, ns = scenes.length, f = n - ns;
  if (cmd === 0x90 && d2 > 0) {
    if (n >= 0 && n < ns) setScene(n);
    else if (f === 0) doDrop();
    else if (f === 1) S.strobe = true;
    else if (f === 2) S.fadeTarget = S.fadeTarget ? 0 : 1;
    else if (f === 3) S.mirror = (S.mirror + 1) % MIRRORS.length;
    else if (f === 4) S.trails = S.trails ? 0 : 0.88;
    else if (f === 5) S.glitchHold = true;
    else if (f === 6) S.lock = !S.lock;
    else if (f === 7) sting.fire(S);
    else setScene(cur + 1);
    midiLast = `Nota ${d1}`;
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    if (f === 1) S.strobe = false;
    if (f === 5) S.glitchHold = false;
  } else if (cmd === 0xb0) {
    const v = d2 / 127;
    if (d1 === 1 || d1 === 7) S.master = v;
    else if (d1 === 2) S.speed = 0.1 + v * 2.4;
    else if (d1 === 3) S.bloom = v * 3;
    else if (d1 === 4) S.hue = v * 360;
    midiLast = `CC${d1} = ${d2}`;
  }
  syncAll();
}
async function connectMidi() {
  if (!navigator.requestMIDIAccess) return status('Bu tarayıcı MIDI desteklemiyor (Chrome kullan).');
  try {
    const access = await navigator.requestMIDIAccess();
    const bind = () => {
      const names = [];
      access.inputs.forEach(i => { i.onmidimessage = onMidi; names.push(i.name); });
      $('midiState').textContent = names.length ? names.join(', ') : 'Cihaz yok';
    };
    bind();
    access.onstatechange = bind;
  } catch (e) { status('MIDI izni verilmedi: ' + e.message); }
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
const ui = $('ui');
function status(msg) { $('status').textContent = msg; }
function flashUI(id) { const el = $(id); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 300); }
const keyLabel = i => i >= 30 ? '·' : (i < 10 ? '' : i < 20 ? '⇧' : '⌥') + String((i % 10 + 1) % 10);

// tabs
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 'tab_' + b.dataset.t);
  store.set('tab', b.dataset.t);
});
(document.querySelector(`#tabs [data-t="${store.get('tab', 'live')}"]`) || document.querySelector('#tabs button')).click();

// ---------- per-scene settings (stored in S.sc[sceneKey]; the old global value is the default) ----------
function sceneOptions(s) {
  const k = s.key;
  const o = (d, def) => ({
    ...d,
    get: () => S.sc?.[k]?.[d.name] ?? def(),
    set: v => { S.sc = { ...S.sc, [k]: { ...(S.sc?.[k] || {}), [d.name]: v } }; },
    reset: () => { const c = { ...(S.sc?.[k] || {}) }; delete c[d.name]; S.sc = { ...S.sc, [k]: c }; }
  });
  const x = v => v.toFixed(2) + '×';
  const motion = def => o({ type: 'range', name: 'motion', label: 'Kamera hareketi', min: 0, max: 2, fmt: x }, def);
  const photo = [
    motion(() => S.photoMotion ?? 1),
    o({ type: 'toggle', name: 'cuts', label: 'BPM kurgu kesmeleri' }, () => S.photoCuts !== false),
    o({ type: 'seg', name: 'every', label: 'Kesme sıklığı (vuruş)', options: ['4', '8', '16', '32'], values: [4, 8, 16, 32] }, () => S.cutEvery || 8)
  ];
  if (k === 'p_iced') return [o({ type: 'seg', name: 'variant', label: 'Çekim', options: ['Yakın plan', 'Portre', 'Kolye'], values: [0, 1, 2] }, () => S.icedVariant || 0), ...photo];
  if (k.startsWith('p_')) return photo;
  if (k === 'bust') return [o({ type: 'seg', name: 'fin', label: 'Yüzey', options: BUST_FIN }, () => S.bustFin || 0)];
  if (k === 'iron') return [
    motion(() => 1),
    o({ type: 'range', name: 'heat', label: 'Erimiş damarların ısısı', min: 0, max: 2, fmt: x }, () => 1),
    o({ type: 'toggle', name: 'beams', label: 'Işık huzmeleri' }, () => true),
    o({ type: 'toggle', name: 'cuts', label: 'Kamera açısı değişimi' }, () => true),
    o({ type: 'seg', name: 'every', label: 'Açı değişimi (vuruş)', options: ['8', '16', '32'], values: [8, 16, 32] }, () => 16)
  ];
  if (k === 'ghost') return [
    motion(() => 1),
    o({ type: 'range', name: 'bright', label: 'Parlaklık', min: 0.3, max: 2, fmt: x }, () => 1),
    o({ type: 'seg', name: 'scan', label: 'Tarama çizgisi (vuruş)', options: ['Kapalı', '8', '16', '32'], values: [0, 8, 16, 32] }, () => 16)
  ];
  const list = [];
  if (k === 'earth') list.push(o({ type: 'toggle', name: 'astro', label: 'Astronot' }, () => S.astro !== false));
  // 3D scenes that use the shared chrome reflections can pick their own HDRI
  if (s.scene && !s.ownEnv && !s.src) list.push(o({ type: 'seg', name: 'env', label: 'Krom yansıması (gerçek HDRI)', options: Object.values(ENVS).map(e => e[0]), values: Object.keys(ENVS) }, () => S.env));
  return list;
}

// scene grid, grouped by category. The box on each scene = "in the loop" (auto modes only play ticked scenes);
// the gear opens that scene's own settings right under it.
const sceneBtns = [];
let openOpts = null, panelBindings = [];
function toggleLoop(key) { S.off = S.off.includes(key) ? S.off.filter(k => k !== key) : [...S.off, key]; save(); refreshUI(); }
function closeOpts() { if (openOpts) { openOpts.el.remove(); openOpts.btn.classList.remove('open'); openOpts = null; panelBindings = []; } }
function openSceneOpts(i, grid) {
  const was = openOpts && openOpts.i === i;
  closeOpts();
  if (was) return;
  const s = scenes[i], defs = sceneOptions(s), b = sceneBtns[i];
  const el = document.createElement('div');
  el.className = 'sopts';
  el.innerHTML = `<h3><span>⚙ ${s.name}</span><button class="mini" title="Bu sahnenin ayarlarını varsayılana döndür">Sıfırla</button></h3>`;
  el.querySelector('.mini').onclick = () => { const sc = { ...S.sc }; delete sc[s.key]; S.sc = sc; save(); syncAll(); };
  defs.forEach(d => el.appendChild(ctl(d, panelBindings)));
  // insert after the end of the clicked button's row so the panel sits right under it
  const items = [...grid.children].filter(c => c.classList.contains('scene'));
  const pos = items.indexOf(b);
  const rowEnd = items[Math.min(items.length - 1, pos | 1)];
  rowEnd.after(el);
  b.classList.add('open');
  openOpts = { i, el, btn: b };
  panelBindings.forEach(f => f());
}
for (const [cat, title] of Object.entries(CATS)) {
  const list = scenes.map((s, i) => i).filter(i => scenes[i].cat === cat);
  if (!list.length) continue;
  const h = document.createElement('div');
  h.className = 'cat';
  h.textContent = title;
  $('scenes').appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'grid';
  list.forEach(i => {
    const s = scenes[i];
    const b = document.createElement('button');
    b.className = 'scene';
    const gear = sceneOptions(s).length ? '<b class="gear" title="Bu sahnenin ayarları">⚙</b>' : '';
    b.innerHTML = `<i class="chk" title="Döngüde (otomatik geçiş sadece işaretli sahneleri çalar)"></i><kbd>${keyLabel(i)}</kbd><span>${s.name}</span>${gear}`;
    b.onclick = e => {
      if (e.target.classList.contains('chk')) toggleLoop(s.key);
      else if (e.target.classList.contains('gear')) openSceneOpts(i, grid);
      else setScene(i);
    };
    sceneBtns[i] = b;
    grid.appendChild(b);
  });
  $('scenes').appendChild(grid);
}
$('loopAll').onclick = () => { S.off = []; save(); refreshUI(); };
$('loopNone').onclick = () => { S.off = scenes.map(s => s.key); save(); refreshUI(); };
$('loopCat').onclick = () => { const c = scenes[cur].cat; S.off = scenes.filter(s => s.cat !== c).map(s => s.key); save(); refreshUI(); };

// generic controls; a def either names a global key (def.key) or brings its own get/set/def (per-scene options)
const bindings = [];
const getV = d => d.get ? d.get() : S[d.key];
const setV = (d, v) => { if (d.set) d.set(v); else S[d.key] = v; save(); };
function ctl(def, list = bindings) {
  const el = document.createElement('div');
  el.className = 'ctl';
  const label = def.label ? `<label>${def.label}${def.type === 'range' ? '<span></span>' : ''}</label>` : '';
  if (def.type === 'range') {
    el.innerHTML = `${label}<input type="range" min="${def.min}" max="${def.max}" step="${def.step || 0.01}">`;
    const inp = el.querySelector('input'), out = el.querySelector('span');
    const fmt = def.fmt || (v => v.toFixed(2));
    inp.oninput = () => { setV(def, +inp.value); out.textContent = fmt(+inp.value); };
    inp.ondblclick = () => { if (def.reset) def.reset(); else S[def.key] = DEFAULTS[def.key]; save(); syncAll(); };
    list.push(() => { const v = +getV(def); inp.value = v; out.textContent = fmt(v); });
  } else if (def.type === 'seg') {
    el.innerHTML = `${label}<div class="seg"></div>`;
    const seg = el.querySelector('.seg');
    const values = def.values || def.options.map((_, i) => i);
    const btns = def.options.map((o, i) => {
      const b = document.createElement('button');
      b.textContent = o;
      b.onclick = () => { setV(def, values[i]); syncAll(); };
      seg.appendChild(b);
      return b;
    });
    list.push(() => btns.forEach((b, i) => b.classList.toggle('on', getV(def) === values[i])));
  } else if (def.type === 'toggle') {
    el.innerHTML = `<button class="wide">${def.label}</button>`;
    const b = el.querySelector('button');
    b.onclick = () => { setV(def, !getV(def)); syncAll(); };
    list.push(() => b.classList.toggle('on', !!getV(def)));
  } else if (def.type === 'head') {
    el.className = 'sub';
    el.textContent = def.label;
  } else if (def.type === 'colors') {
    el.innerHTML = `<label>Renk paleti <kbd>C</kbd></label><div class="pal"></div><div class="row"><label class="cp">Ana renk <input type="color" data-k="c1"></label><label class="cp">İkinci renk <input type="color" data-k="c2"></label></div>`;
    const pal = el.querySelector('.pal');
    const btns = Object.entries(PALETTES).map(([k, [name, a, b]]) => {
      const btn = document.createElement('button');
      btn.innerHTML = `<b style="background:linear-gradient(135deg,${a} 50%,${b} 50%)"></b>${name}`;
      btn.onclick = () => { Object.assign(S, { palette: k, c1: a, c2: b }); save(); syncAll(); };
      pal.appendChild(btn);
      return [k, btn];
    });
    const inputs = el.querySelectorAll('input');
    inputs.forEach(inp => inp.oninput = () => { S[inp.dataset.k] = inp.value; S.palette = 'custom'; save(); syncAll(); });
    list.push(() => {
      btns.forEach(([k, b]) => b.classList.toggle('on', S.palette === k));
      inputs.forEach(inp => inp.value = S[inp.dataset.k]);
    });
  }
  return el;
}
const pct = v => Math.round(v * 100) + '%';
const mul = v => v.toFixed(2) + '×';
const GROUPS = {
  g_color: [
    { type: 'seg', key: 'tone', label: 'Ton eşleme', options: ['Klasik', 'Sinema (ACES)'], values: [0, 1] },
    { type: 'range', key: 'exposure', label: 'Pozlama', min: 0.4, max: 2, fmt: mul },
    { type: 'colors' },
    { type: 'range', key: 'hue', label: 'Renk tonu kaydır', min: 0, max: 360, step: 1, fmt: v => Math.round(v) + '°' },
    { type: 'range', key: 'sat', label: 'Doygunluk', min: 0, max: 2, fmt: pct },
    { type: 'range', key: 'contrast', label: 'Kontrast', min: 0.5, max: 1.6, fmt: pct },
    { type: 'range', key: 'master', label: 'Parlaklık', min: 0, max: 1, fmt: pct }
  ],
  g_motion: [
    { type: 'range', key: 'speed', label: 'Animasyon hızı', min: 0.1, max: 2.5, fmt: mul },
    { type: 'range', key: 'react', label: 'Müziğe tepki', min: 0.3, max: 2, fmt: mul },
    { type: 'range', key: 'punch', label: 'Vuruşta zoom', min: 0, max: 2, fmt: pct },
    { type: 'range', key: 'shake', label: 'Kamera sarsıntısı', min: 0, max: 2, fmt: pct },
    { type: 'range', key: 'beatFlash', label: 'Vuruşta flaş', min: 0, max: 1, fmt: pct }
  ],
  g_fx: [
    { type: 'head', label: 'Lens · sinema' },
    { type: 'range', key: 'bloom', label: 'Parlama (bloom)', min: 0, max: 3, fmt: mul },
    { type: 'range', key: 'lensStreak', label: 'Anamorfik flare <kbd>A</kbd>', min: 0, max: 2, fmt: mul },
    { type: 'seg', key: 'flareTint', label: 'Flare rengi', options: ['Sinema mavisi', 'Palet', 'Beyaz'] },
    { type: 'range', key: 'lensGhost', label: 'Lens hayaletleri + hale', min: 0, max: 2, fmt: mul },
    { type: 'range', key: 'lensDirt', label: 'Lens kiri (ışık vurunca)', min: 0, max: 2, fmt: mul },
    { type: 'head', label: 'Görüntü dokusu' },
    { type: 'range', key: 'glitchAmt', label: 'Glitch miktarı', min: 0, max: 2, fmt: mul },
    { type: 'range', key: 'rgbAmt', label: 'RGB kayma', min: 0, max: 3, fmt: mul },
    { type: 'range', key: 'grain', label: 'Film grain', min: 0, max: 2, fmt: mul },
    { type: 'range', key: 'scan', label: 'Tarama çizgileri', min: 0, max: 1, fmt: pct },
    { type: 'range', key: 'vignette', label: 'Kenar karartma', min: 0, max: 2, fmt: mul },
    { type: 'head', label: 'Ayna · EQ katmanı' },
    { type: 'seg', key: 'mirror', label: 'Ayna / Kaleydoskop <kbd>K</kbd>', options: MIRRORS },
    { type: 'seg', key: 'eq', label: 'EQ katmanı, her sahnenin üstüne <kbd>Q</kbd>', options: EQ_LAYERS },
    { type: 'range', key: 'eqSize', label: 'EQ boyutu', min: 0.4, max: 2, fmt: mul },
    { type: 'head', label: 'İz · feedback' },
    { type: 'range', key: 'trails', label: 'İz efekti <kbd>E</kbd>', min: 0, max: 0.97, fmt: pct },
    { type: 'range', key: 'fb', label: 'Feedback tüneli <kbd>J</kbd>', min: 0, max: 0.97, fmt: pct },
    { type: 'range', key: 'fbZoom', label: 'Feedback zoom', min: 0.9, max: 1.12, step: 0.002, fmt: mul },
    { type: 'range', key: 'fbRot', label: 'Feedback dönüş', min: -0.06, max: 0.06, step: 0.001, fmt: v => (v * 57.3).toFixed(1) + '°' },
    { type: 'range', key: 'fbHue', label: 'Feedback renk kayması', min: 0, max: 0.3, step: 0.005, fmt: v => (v * 57.3).toFixed(0) + '°' }
  ],
  g_trans: [
    { type: 'seg', key: 'trans', label: 'Geçiş tipi <kbd>W</kbd>', options: TRANSITIONS },
    { type: 'range', key: 'transDur', label: 'Geçiş süresi', min: 0.1, max: 4, fmt: v => v.toFixed(1) + ' sn' },
    { type: 'toggle', key: 'sting', label: 'Drop\'ta krom logo animasyonu (O ile elle)' }
  ],
  g_auto: [
    { type: 'seg', key: 'auto', label: 'Döngü / otomatik geçiş <kbd>␣</kbd>', options: ['Kapalı', 'Sıralı', 'Karışık', 'Director'], values: ['off', 'seq', 'timed', 'director'] },
    { type: 'seg', key: 'autoEvery', label: 'Kaç vuruşta bir', options: ['8', '16', '32', '64', '128'], values: [8, 16, 32, 64, 128] }
  ],
  g_audio: [
    { type: 'range', key: 'beatSens', label: 'Vuruş eşiği (düşük = daha hassas)', min: 1.05, max: 1.8, fmt: mul }
  ],
  g_tempo: [
    { type: 'seg', key: 'clock', label: 'Tempo kaynağı', options: Object.values(CLOCK_MODES), values: Object.keys(CLOCK_MODES) },
    { type: 'range', key: 'offsetMs', label: 'Gecikme düzeltme (ekran geç kalıyorsa +)', min: -200, max: 200, step: 1, fmt: v => Math.round(v) + ' ms' },
    { type: 'seg', key: 'strobeDiv', label: 'Strobe hızı (BPM\'e senkron)', options: ['1/4', '1/8', '1/16', '1/32'], values: [1, 2, 4, 8] }
  ],
  g_text: [
    { type: 'seg', key: 'textMode', label: 'Yazı modu <kbd>N</kbd>', options: ['Kapalı', 'İsim', 'Vuruşta', 'Mesajlar'] },
    { type: 'seg', key: 'font', label: 'Font', options: FONTS.map(f => f[0]) },
    { type: 'seg', key: 'textStyle', label: 'Yazı stili', options: TEXT_STYLES },
    { type: 'range', key: 'textShine', label: 'Işık süzmesi (2 barda bir)', min: 0, max: 1.5, fmt: pct },
    { type: 'seg', key: 'textPlace', label: 'Konum', options: ['Sahneye göre', 'Üst', 'Orta', 'Alt'] },
    { type: 'range', key: 'textSize', label: 'Boyut', min: 0.3, max: 2.5, fmt: mul },
    { type: 'range', key: 'textGlow', label: 'Hale', min: 0, max: 1, fmt: pct },
    { type: 'seg', key: 'msgEvery', label: 'Mesaj değişimi (vuruş)', options: ['4', '8', '16', '32'], values: [4, 8, 16, 32] },
    { type: 'toggle', key: 'corner', label: 'Köşede küçük logo' }
  ],
  g_quality: [
    { type: 'seg', key: 'quality', label: 'Görüntü kalitesi', options: ['Hız', 'Orta', 'Yüksek', 'Ultra'], values: [0.5, 0.75, 1, 1.5] }
  ]
};
for (const [id, defs] of Object.entries(GROUPS)) defs.forEach(d => $(id).appendChild(ctl(d)));

// ---------- one-click looks: colour, type, lens and effects (never tempo, audio, name or the loop) ----------
const fontIdx = n => Math.max(0, FONTS.findIndex(f => f[0] === n));
const CLEAN = { mirror: 0, eq: 0, trails: 0, fb: 0, hue: 0, tone: 1, exposure: 1 };
const PACKS = [
  ['29 Ekim', 'Bayrak · tören', ['p_bosphorus', 'flag'], { palette: 'bayrak', c1: '#e30a17', c2: '#ffffff', font: fontIdx('Cinzel'), textStyle: 0, textGlow: 0.35, textShine: 0.8, textMode: 3,
    lensStreak: 0.5, flareTint: 1, lensGhost: 0.25, lensDirt: 0.4, bloom: 1.1, glitchAmt: 0.4, rgbAmt: 0.4, grain: 0.5, scan: 0, vignette: 1, sat: 1.05, contrast: 1.05, punch: 0.35, shake: 0.15, beatFlash: 0, trans: 4, transDur: 1.5, sting: true }],
  ['Club', 'Neon · karanlık', ['p_neon', 'neon'], { palette: 'gece', c1: '#6a2bff', c2: '#ff2bd6', font: fontIdx('Monoton'), textStyle: 1, textGlow: 0.6, textShine: 0.4, textMode: 1,
    lensStreak: 0.9, flareTint: 1, lensGhost: 0.35, lensDirt: 0.6, bloom: 1.3, glitchAmt: 1, rgbAmt: 0.9, grain: 0.7, scan: 0.15, vignette: 1.1, sat: 1.15, contrast: 1.1, punch: 0.6, shake: 0.35, beatFlash: 0.25, trans: 0, transDur: 0.6, sting: true }],
  ['Luxury', 'Altın · pırlanta', ['p_velvet', 'p_iced'], { palette: 'custom', c1: '#ffc850', c2: '#ffffff', font: fontIdx('Bodoni'), textStyle: 3, textGlow: 0.2, textShine: 1.2, textMode: 1,
    lensStreak: 0.4, flareTint: 2, lensGhost: 0.2, lensDirt: 0.3, bloom: 0.9, glitchAmt: 0.15, rgbAmt: 0.15, grain: 0.35, scan: 0, vignette: 1.1, sat: 0.95, contrast: 1.08, punch: 0.15, shake: 0.05, beatFlash: 0, trans: 4, transDur: 2, sting: true }],
  ['Festival', 'Lazer · büyük sahne', ['p_stage'], { palette: 'bayrak', c1: '#e30a17', c2: '#ffffff', font: fontIdx('Unbounded'), textStyle: 2, textGlow: 0.3, textShine: 0.8, textMode: 1,
    lensStreak: 1, flareTint: 0, lensGhost: 0.5, lensDirt: 0.7, bloom: 1.3, glitchAmt: 0.7, rgbAmt: 0.6, grain: 0.5, scan: 0, vignette: 1, sat: 1.1, contrast: 1.05, punch: 0.5, shake: 0.3, beatFlash: 0.3, trans: 3, transDur: 0.8, sting: true }],
  ['Demir', 'Sinematik · monokrom', ['iron', 'ghost'], { palette: 'custom', c1: '#ff2a12', c2: '#dfe8ff', font: fontIdx('Michroma'), textStyle: 4, textGlow: 0.15, textShine: 0.6, textMode: 0,
    lensStreak: 0.7, flareTint: 0, lensGhost: 0.3, lensDirt: 0.6, bloom: 1, glitchAmt: 0.2, rgbAmt: 0.25, grain: 0.9, scan: 0, vignette: 1.3, sat: 0.85, contrast: 1.15, punch: 0.2, shake: 0.1, beatFlash: 0, trans: 4, transDur: 2.5, sting: true }],
  ['Minimal', 'Siyah-beyaz · sade', ['ghost', 'bust'], { palette: 'custom', c1: '#ffffff', c2: '#9aa4b2', font: fontIdx('Syne'), textStyle: 0, textGlow: 0.1, textShine: 0.5, textMode: 1,
    lensStreak: 0.25, flareTint: 2, lensGhost: 0.1, lensDirt: 0.2, bloom: 0.7, glitchAmt: 0.1, rgbAmt: 0.1, grain: 0.8, scan: 0, vignette: 1.2, sat: 0.2, contrast: 1.1, punch: 0.15, shake: 0, beatFlash: 0, trans: 4, transDur: 2, sting: false }]
];
PACKS.forEach(([name, sub, hero, look]) => {
  const b = document.createElement('button');
  b.innerHTML = `${name}<small>${sub}</small>`;
  b.onclick = () => {
    Object.assign(S, CLEAN, look);
    const h = hero.map(byKey).find(i => i >= 0);
    if (h !== undefined) setScene(h);
    save(); syncAll(); status(`Görünüm: ${name}`);
  };
  $('packs').appendChild(b);
});

// presets (F1–F6 loads)
const PRESETS = 6;
for (let i = 1; i <= PRESETS; i++) {
  const row = document.createElement('div');
  row.className = 'row preset';
  row.innerHTML = `<button class="load"><kbd>F${i}</kbd>Preset ${i}<small></small></button><button class="saveP" title="Mevcut ayarları bu yuvaya kaydet">💾</button>`;
  const info = row.querySelector('small');
  const refresh = () => { const p = store.get('preset' + i, null); info.textContent = p ? ' · ' + (scenes[p.scene]?.name || '') : ' · boş'; };
  row.querySelector('.load').onclick = () => {
    const p = store.get('preset' + i, null);
    if (!p) return status(`Preset ${i} boş. 💾 ile kaydet.`);
    Object.assign(S, p);
    setScene(p.scene ?? cur);
    save(); syncAll(); status(`Preset ${i} yüklendi.`);
  };
  row.querySelector('.saveP').onclick = () => { store.set('preset' + i, cfg()); refresh(); status(`Preset ${i} kaydedildi.`); };
  refresh();
  $('presets').appendChild(row);
}
$('resetBtn').onclick = () => {
  const keep = { name: S.name, msgs: S.msgs, scene: cur };
  Object.assign(S, structuredClone(DEFAULTS), keep);
  save(); syncAll(); status('Ayarlar sıfırlandı.');
};

// every chrome scene gets its own HDRI (per-scene setting, default = the global one); maps are cached per key
let envKey = 'studio';
function applyEnv() {
  if (S.env !== envKey) { envKey = S.env; ctx.envMap(envKey).then(e => { ctx.env = e; }).catch(() => {}); }
  scenes.forEach(s => {
    if (s.ownEnv || !s.scene) return;
    const want = S.sc?.[s.key]?.env ?? S.env;
    if (s.envKey === want) return;
    s.envKey = want;
    ctx.envMap(want).then(e => { if (s.envKey === want) s.scene.environment = e; }).catch(() => status('Ortam yüklenemedi.'));
  });
}
function syncAll() { bindings.forEach(f => f()); panelBindings.forEach(f => f()); applyEnv(); refreshUI(); }
function refreshUI() {
  sceneBtns.forEach((b, i) => {
    b.classList.toggle('on', i === cur);
    b.classList.toggle('prev', i === prev);
    b.classList.toggle('out', S.off.includes(scenes[i].key));
  });
  const inLoop = scenes.filter(s => !S.off.includes(s.key)).length;
  $('loopInfo').textContent = `${inLoop} / ${scenes.length} sahne döngüde`;
  $('lockBtn').classList.toggle('on', S.lock);
  $('lockBtn').innerHTML = S.lock ? `🔒 Kilitli: ${scenes[cur].name}` : '🔓 Sahneyi kilitle <kbd>L</kbd>';
  $('lockBadge').style.display = S.lock ? 'block' : 'none';
  $('micBtn').classList.toggle('on', S.mode === 'mic');
  $('demoBtn').classList.toggle('on', S.mode === 'demo');
  $('recBtn').classList.toggle('rec', !!rec);
  $('recBtn').textContent = rec ? '■ Kaydı bitir (R)' : '● Video kaydet (R)';
  $('recDot').style.display = rec ? 'block' : 'none';
  $('blackBtn').classList.toggle('on', S.fadeTarget === 0);
  $('midiLast').textContent = midiLast;
  $('sceneName').textContent = scenes[cur].name;
}
const meterEls = ['bass', 'mid', 'high', 'energy'].map(k => [k, $('m_' + k)]);
const barDots = [...document.querySelectorAll('#barDots i')];
let uiTick = 0, fpsAvg = 1 / 60, fpsLast = performance.now();
function updateMeters() {
  const n = performance.now();
  fpsAvg += ((n - fpsLast) / 1000 - fpsAvg) * 0.05;
  fpsLast = n;
  if (ui.classList.contains('hidden')) return;
  meterEls.forEach(([k, el]) => el.style.transform = `scaleX(${Math.min(1, S[k])})`);
  $('beatDot').style.opacity = 0.2 + Math.min(1, S.beat) * 0.8;
  barDots.forEach((d, i) => d.classList.toggle('on', i === S.barPos && S.beatPhase < 0.5));
  if (++uiTick % 10) return;
  $('bpm').textContent = S.bpm.toFixed(1);
  if (document.activeElement !== $('bpmIn')) $('bpmIn').value = S.bpm.toFixed(1);
  $('phase').textContent = S.phase === 'break' ? 'BREAK' : S.drop > 0.3 ? 'DROP!' : 'AKIŞ';
  $('phase').className = S.phase === 'break' ? 'break' : S.drop > 0.3 ? 'drop' : '';
  $('beatN').textContent = S.beatCount;
  $('fps').textContent = Math.round(1 / Math.max(0.001, fpsAvg)) + ' fps';
}

$('name').value = S.name;
$('msgs').value = S.msgs.join('\n');
$('name').oninput = e => { S.name = e.target.value.toUpperCase(); save(); };
$('msgs').oninput = e => { S.msgs = e.target.value.split('\n'); save(); };
$('midiMap').textContent = `Pad 36–${35 + scenes.length}: sahneler · ${36 + scenes.length}–${35 + scenes.length + MIDI_FX.length}: ${MIDI_FX.join(', ')} · CC1/CC7 parlaklık, CC2 hız, CC3 bloom, CC4 renk tonu`;

async function fillDevices(selected) {
  try {
    const devs = await audio.devices();
    $('dev').innerHTML = '<option value="">Varsayılan giriş</option>' + devs.map(d => `<option value="${d.deviceId}">${(d.label || 'Giriş').replace(/</g, '&lt;')}</option>`).join('');
    if (selected) $('dev').value = selected;
  } catch {}
}
async function startMic(id) {
  status('');
  try { await audio.startMic(id); await fillDevices(id); }
  catch (e) { status('Ses girişi açılamadı: ' + e.message); audio.useDemo(); }
  refreshUI();
}
$('micBtn').onclick = () => startMic($('dev').value);
$('demoBtn').onclick = () => { audio.useDemo(); refreshUI(); };
$('dev').onchange = e => startMic(e.target.value);
function tapTempo() { audio.tap(performance.now()); clock.tap(); syncAll(); }
function nudgeBpm(d) { S.bpm = Math.min(220, Math.max(50, Math.round((S.bpm + d) * 10) / 10)); save(); syncAll(); }
$('tapBtn').onclick = tapTempo;
$('bpmDown').onclick = () => nudgeBpm(-1);
$('bpmUp').onclick = () => nudgeBpm(1);
$('bpmDownF').onclick = () => nudgeBpm(-0.1);
$('bpmUpF').onclick = () => nudgeBpm(0.1);
$('bpmHalf').onclick = () => nudgeBpm(-S.bpm / 2);
$('bpmDouble').onclick = () => nudgeBpm(S.bpm);
$('downBtn').onclick = () => clock.downbeat();
$('bpmIn').onchange = e => { const v = parseFloat(e.target.value); if (v >= 50 && v <= 220) { S.bpm = v; save(); } syncAll(); };
$('dropBtn').onclick = doDrop;
$('lockBtn').onclick = () => { S.lock = !S.lock; save(); refreshUI(); };
$('recBtn').onclick = toggleRec;
$('midiBtn').onclick = connectMidi;
$('fsBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
$('blackBtn').onclick = () => { S.fadeTarget = S.fadeTarget ? 0 : 1; refreshUI(); };
$('hideBtn').onclick = () => ui.classList.add('hidden');
const hold = (id, key) => {
  const b = $(id);
  b.onpointerdown = () => { S[key] = true; b.classList.add('on'); };
  b.onpointerup = b.onpointerleave = () => { S[key] = false; b.classList.remove('on'); };
};
hold('strobeBtn', 'strobe'); hold('glitchBtn', 'glitchHold'); hold('invertBtn', 'invert');
$('imgBtn').onclick = () => $('imgFile').click();
$('imgFile').onchange = e => e.target.files[0] && loadImage(e.target.files[0], true);
$('imgClr').onclick = () => { ctx.U.uHasImg.value = 0; idb.put('img', null).catch(() => {}); $('imgHint').textContent = 'Fotoğraf kaldırıldı.'; };

const dropZone = $('dropZone');
addEventListener('dragover', e => { e.preventDefault(); dropZone.style.display = 'flex'; });
addEventListener('dragleave', e => { if (!e.relatedTarget) dropZone.style.display = 'none'; });
addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.display = 'none';
  const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (f) { loadImage(f, true); setScene(byKey('ata')); }
});

addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') { if (e.key === 'Escape') e.target.blur(); return; }
  if (tag === 'SELECT' && e.key.startsWith('Arrow')) return;
  if (e.repeat && !['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  const digit = e.code.startsWith('Digit') ? +e.code.slice(5) : -1;
  const fkey = /^F[1-6]$/.test(e.code) ? +e.code.slice(1) : 0;
  if (digit >= 0) {
    const i = (e.altKey ? 20 : e.shiftKey ? 10 : 0) + (digit === 0 ? 9 : digit - 1);
    if (i < scenes.length) setScene(i);
  }
  else if (e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') nudgeBpm((e.key === '[' || e.key === '{' ? -1 : 1) * (e.shiftKey ? 0.1 : 1));
  else if (k === 'v') clock.downbeat();
  else if (fkey) document.querySelectorAll('#presets .load')[fkey - 1].click();
  else if (e.key === 'ArrowRight') setScene(cur + 1);
  else if (e.key === 'ArrowLeft') setScene(cur - 1);
  else if (e.key === ' ') { const m = ['off', 'seq', 'timed', 'director']; S.auto = m[(m.indexOf(S.auto) + 1) % m.length]; status('Döngü: ' + { off: 'Kapalı', seq: 'Sıralı', timed: 'Karışık', director: 'Director' }[S.auto]); }
  else if (k === 'l') S.lock = !S.lock;
  else if (k === 'd') doDrop();
  else if (k === 'f') $('fsBtn').onclick();
  else if (k === 'h') ui.classList.toggle('hidden');
  else if (k === 't') tapTempo();
  else if (k === 's') S.strobe = true;
  else if (k === 'g') S.glitchHold = true;
  else if (k === 'i') S.invert = true;
  else if (k === 'b') S.fadeTarget = S.fadeTarget ? 0 : 1;
  else if (k === 'k') S.mirror = (S.mirror + 1) % MIRRORS.length;
  else if (k === 'q') S.eq = (S.eq + 1) % EQ_LAYERS.length;
  else if (k === 'w') S.trans = (S.trans + 1) % TRANSITIONS.length;
  else if (k === 'e') S.trails = S.trails ? 0 : 0.88;
  else if (k === 'j') S.fb = S.fb ? 0 : 0.82;
  else if (k === 'x') S.rgbAmt = S.rgbAmt ? 0 : 1;
  else if (k === 'a') S.lensStreak = S.lensStreak ? 0 : DEFAULTS.lensStreak;
  else if (k === 'o') sting.fire(S);
  else if (k === 'n') S.textMode = (S.textMode + 1) % 4;
  else if (k === 'c') { const ks = Object.keys(PALETTES); const n = ks[(ks.indexOf(S.palette) + 1) % ks.length]; Object.assign(S, { palette: n, c1: PALETTES[n][1], c2: PALETTES[n][2] }); }
  else if (k === 'r') toggleRec();
  else return;
  e.preventDefault();
  save();
  syncAll();
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 's') S.strobe = false;
  if (k === 'g') S.glitchHold = false;
  if (k === 'i') S.invert = false;
});

let idleTimer;
addEventListener('mousemove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
});

syncAll();
fillDevices();
loading.classList.add('done');
requestAnimationFrame(frame);
window.__odv = { S, scenes, setScene, doDrop, sting, fx, renderer, get cur() { return cur; }, get prev() { return prev; } };
