// Audio analysis: live input or a demo track, beat onsets, BPM estimate, break/drop detection.
const SPEC_N = 64;

export class AudioEngine {
  constructor(S) {
    this.S = S;
    this.spec = new Uint8Array(SPEC_N);
    this.wave = new Uint8Array(256).fill(128);
    this.sb = 0; this.sm = 0; this.sh = 0;
    this.specS = new Float32Array(SPEC_N);
    this.specPeak = 80;
    this.peaks = { bass: 0.2, mid: 0.2, high: 0.2 };
    this.avgBass = 0;
    this.lastBeatT = 0;
    this.beatTimes = [];
    this.demoPhase = 0;
    this.demoIdx = -1;
    this.eShort = 0; this.eLong = 0; this.ePeak = 0.05;
    this.breakT = 0; this.inBreak = false; this.breakStart = 0; this.lastDrop = -1e9;
    this.taps = [];
    this.handlers = { onset: [], break: [], drop: [] };
  }
  on(ev, fn) { this.handlers[ev].push(fn); }
  emit(ev) { this.handlers[ev].forEach(f => f()); }

  async startMic(deviceId) {
    this.ac = this.ac || new AudioContext();
    await this.ac.resume();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    const c = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) c.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: c });
    this.analyser = this.ac.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.5;
    this.ac.createMediaStreamSource(this.stream).connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.td = new Uint8Array(this.analyser.fftSize);
    this.S.mode = 'mic';
    this.beatTimes = [];
  }
  useDemo() { this.S.mode = 'demo'; }
  async devices() {
    return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
  }

  tap(now) {
    const t = this.taps;
    if (t.length && now - t[t.length - 1] > 2000) t.length = 0;
    t.push(now);
    if (t.length > 8) t.shift();
    if (t.length >= 2) this.S.bpm = Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1)));
    this.demoPhase = Math.floor(this.demoPhase) + 1;
  }

  beat(now) {
    this.lastBeatT = now;
    if (this.S.mode === 'mic' && (this.S.clock === 'auto' || this.S.clock === 'lock')) {
      this.beatTimes.push(now);
      if (this.beatTimes.length > 24) this.beatTimes.shift();
      if (this.beatTimes.length >= 8) {
        const iv = [];
        for (let i = 1; i < this.beatTimes.length; i++) iv.push(this.beatTimes[i] - this.beatTimes[i - 1]);
        iv.sort((a, b) => a - b);
        let m = iv[iv.length >> 1] / 1000;
        while (m < 60 / 180) m *= 2;
        while (m > 60 / 75) m /= 2;
        const est = Math.round(60 / m);
        if (this.S.clock === 'auto' || Math.abs(est - this.S.bpm) > 3) this.S.bpm = est;
      }
    }
    this.emit('onset');
  }

  update(dt, now) {
    const S = this.S;
    let b, m, h, energy;
    if (S.mode === 'mic' && this.analyser) {
      const f = this.freq;
      this.analyser.getByteFrequencyData(f);
      const hz = this.ac.sampleRate / this.analyser.fftSize;
      const bin = x => Math.max(1, Math.min(f.length - 1, Math.round(x / hz)));
      const avg = (lo, hi) => { let s = 0; for (let i = lo; i <= hi; i++) s += f[i]; return s / ((hi - lo + 1) * 255); };
      const raw = { bass: avg(bin(40), bin(150)), mid: avg(bin(300), bin(2000)), high: avg(bin(4000), bin(12000)) };
      for (const k in raw) this.peaks[k] = Math.max(raw[k], this.peaks[k] - dt * 0.04, 0.05);
      b = raw.bass / this.peaks.bass; m = raw.mid / this.peaks.mid; h = raw.high / this.peaks.high;
      energy = raw.bass * 0.65 + raw.mid * 0.35;

      this.avgBass += (raw.bass - this.avgBass) * Math.min(1, dt * 2);
      this.analyser.getByteTimeDomainData(this.td);
      for (let i = 0; i < 256; i++) this.wave[i] = this.td[i * 8];
      if (raw.bass > this.avgBass * (S.beatSens || 1.3) && raw.bass > 0.12 && now - this.lastBeatT > 280) this.beat(now);

      const lo = bin(30), hi = bin(14000);
      let maxV = 0;
      for (let i = 0; i < SPEC_N; i++) {
        const a = Math.floor(lo * Math.pow(hi / lo, i / SPEC_N));
        const z = Math.max(a, Math.floor(lo * Math.pow(hi / lo, (i + 1) / SPEC_N)));
        let v = 0;
        for (let j = a; j <= z; j++) v = Math.max(v, f[j]);
        maxV = Math.max(maxV, v);
        this.specS[i] = Math.max(v, this.specS[i] - dt * 250);
      }
      this.specPeak = Math.max(maxV, this.specPeak - dt * 20, 40);
      for (let i = 0; i < SPEC_N; i++) this.spec[i] = Math.min(255, this.specS[i] / this.specPeak * 255);
    } else {
      // demo track: 64 beats of four-on-the-floor, then a 16 beat breakdown, then the drop
      this.demoPhase += dt * S.bpm / 60;
      const idx = Math.floor(this.demoPhase);
      const inBreak = idx % 80 >= 64;
      const fr = this.demoPhase % 1, t = now / 1000;
      if (idx !== this.demoIdx) { this.demoIdx = idx; if (!inBreak) this.beat(now); }
      b = inBreak ? 0.05 : Math.pow(1 - fr, 4);
      m = inBreak ? 0.35 + 0.15 * Math.sin(t * 2) : 0.45 + 0.25 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 3.7);
      h = inBreak ? 0.1 + 0.4 * ((idx % 80 - 64) / 16) * Math.random() : (fr > 0.5 && fr < 0.62) ? 0.9 : 0.15 + 0.1 * Math.random();
      energy = b * 0.65 + m * 0.35 * (inBreak ? 0.3 : 1);
      for (let i = 0; i < 256; i++) {
        const w = Math.sin(i * 0.11 + t * 23) * b * 0.7 + Math.sin(i * 0.43 + t * 9) * m * 0.25 + (Math.random() - 0.5) * h * 0.25;
        this.wave[i] = 128 + 127 * Math.max(-1, Math.min(1, w));
      }
      for (let i = 0; i < SPEC_N; i++) {
        const x = i / SPEC_N;
        const v = b * Math.exp(-x * 9) + m * 0.6 * Math.exp(-Math.pow((x - 0.35) * 4, 2)) + h * 0.5 * x + Math.random() * 0.12;
        this.specS[i] = Math.max(v * 230, this.specS[i] - dt * 250);
        this.spec[i] = Math.min(255, this.specS[i]);
      }
    }
    const follow = (cur, target, a, r) => cur + (target - cur) * Math.min(1, dt * (target > cur ? a : r));
    this.sb = follow(this.sb, Math.min(1, b), 30, 6);
    this.sm = follow(this.sm, Math.min(1, m), 12, 4);
    this.sh = follow(this.sh, Math.min(1, h), 30, 8);
    const R = S.react || 1;
    S.bass = Math.min(1.2, this.sb * R);
    S.mid = Math.min(1.2, this.sm * R);
    S.high = Math.min(1.2, this.sh * R);

    // song structure: short vs long energy
    this.eShort += (energy - this.eShort) * Math.min(1, dt * 1.5);
    this.eLong += (energy - this.eLong) * Math.min(1, dt * 0.1);
    this.ePeak = Math.max(this.eShort, this.ePeak - dt * 0.01, 0.05);
    S.energy = Math.min(1, this.eShort / this.ePeak);
    if (this.eShort < this.eLong * 0.55 && this.eLong > 0.02) this.breakT += dt; else this.breakT = Math.max(0, this.breakT - dt * 2);
    if (!this.inBreak && this.breakT > 2) {
      this.inBreak = true; this.breakStart = now; S.phase = 'break';
      this.emit('break');
    }
    if (this.inBreak && now - this.breakStart > 3000 && this.eShort > this.eLong * 1.05 && S.bass > 0.5) {
      this.inBreak = false; this.breakT = 0; S.phase = 'main';
      if (now - this.lastDrop > 8000) { this.lastDrop = now; this.emit('drop'); }
    }
  }
}
