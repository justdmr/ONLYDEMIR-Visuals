// Beat clock: turns audio onsets / tap / MIDI clock into a steady beat grid with phase.
//   auto   – every detected onset is a beat
//   manual – free-running at S.bpm (tap, nudge or type the tempo)
//   lock   – free-running, phase- and tempo-locked to the onsets (keeps the groove through breakdowns)
//   midi   – follows MIDI clock (24 ticks per beat) from DJ software or hardware
export const CLOCK_MODES = { auto: 'Otomatik', manual: 'Manuel', lock: 'Kilitli', midi: 'MIDI Clock' };

export class BeatClock {
  constructor(S) {
    this.S = S;
    this.phase = 0;
    this.fired = 0;
    this.handlers = [];
    this.ticks = 0; this.tickTimes = []; this.lastTick = 0; this.tickDt = 0; this.midiRunning = false;
  }
  onBeat(fn) { this.handlers.push(fn); }

  // phase as shown to the visuals, shifted by the latency offset
  get out() { return this.phase + (this.S.offsetMs || 0) / 1000 * this.S.bpm / 60; }

  onset() {
    const S = this.S;
    if (S.clock === 'auto') this.phase = Math.max(this.phase, Math.floor(this.phase) + 1);
    else if (S.clock === 'lock') {
      const err = this.phase - Math.round(this.phase);
      if (Math.abs(err) < 0.3) {
        this.phase -= err * 0.35;
        S.bpm = Math.min(200, Math.max(60, S.bpm - err * 0.8));
      }
    }
  }
  // the tapped beat is "now"
  tap() { this.phase = Math.floor(this.phase) + 1; }
  // the next beat becomes beat 1 of a bar
  downbeat() {
    this.phase = Math.ceil(this.phase / 4) * 4;
    this.fired = Math.floor(this.out) - 1;
  }
  midi(status, now) {
    if (status === 0xf8) {
      if (this.lastTick) {
        this.tickTimes.push(now - this.lastTick);
        if (this.tickTimes.length > 48) this.tickTimes.shift();
        this.tickDt = this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length;
        if (this.S.clock === 'midi' && this.tickDt > 0) this.S.bpm = Math.round(60000 / (this.tickDt * 24) * 10) / 10;
      }
      this.lastTick = now;
      this.ticks++;
      this.midiRunning = true;
    } else if (status === 0xfa) { this.ticks = 0; this.fired = -1; this.midiRunning = true; }
    else if (status === 0xfb) this.midiRunning = true;
    else if (status === 0xfc) this.midiRunning = false;
  }
  update(dt, now) {
    const S = this.S;
    const mode = S.clock;
    if (mode === 'manual' || mode === 'lock') this.phase += dt * S.bpm / 60;
    else if (mode === 'auto') this.phase = Math.min(this.phase + dt * S.bpm / 60, Math.floor(this.phase) + 0.98);
    else if (mode === 'midi') {
      if (this.midiRunning && this.tickDt) this.phase = (this.ticks + Math.min(1, (now - this.lastTick) / this.tickDt)) / 24;
    }
    const o = this.out;
    const b = Math.floor(o);
    if (b > this.fired) {
      // never fire a burst after a jump (e.g. mode switch); just resync
      if (b - this.fired > 2) this.fired = b - 1;
      this.fired = b;
      S.barPos = ((b % 4) + 4) % 4;
      this.handlers.forEach(f => f(S.barPos));
    }
    S.beatPhase = o - b;
    S.clockPhase = o;
  }
}
