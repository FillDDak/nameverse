/* NAMEVERSE — 행성마다 고유한 주제가를 Web Audio로 작곡해 반복 재생되는 한 곡으로 만든다 */
(function () {
  'use strict';
  const NV = window.NV;

  const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const SR = 32000;       // 앰비언트라 32kHz면 충분하고 합성도 빠르다
  const CYCLES = 2;       // 화성 진행을 두 바퀴 돌면 한 곡이 끝나고 처음으로 이어진다
  const TAIL = 4.5;       // 잔향·딜레이 꼬리: 곡 앞부분에 겹쳐서 이음새 없이 반복되게 한다

  // Freeverb (Jezar): 콤 필터 8개 + 올패스 4개. ConvolverNode보다 훨씬 가볍다
  function freeverb(inp, n, sr, spread) {
    const k = sr / 44100, room = 0.84, damp = 0.25, out = new Float32Array(n);
    for (const t of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
      const len = Math.round((t + spread) * k), buf = new Float32Array(len);
      let idx = 0, st = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx];
        st = y * (1 - damp) + st * damp;
        buf[idx] = inp[i] + st * room;
        out[i] += y;
        if (++idx >= len) idx = 0;
      }
    }
    for (const t of [556, 441, 341, 225]) {
      const len = Math.round((t + spread) * k), buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const bo = buf[idx], x = out[i];
        out[i] = bo - x;
        buf[idx] = x + bo * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
    return out;
  }

  // 16비트 스테레오 WAV
  function wav(chs, n, sr) {
    const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 2; c++) { v.setInt16(o, Math.max(-1, Math.min(1, chs[c][i])) * 32767, true); o += 2; }
    }
    return new Blob([buf], { type: 'audio/wav' });
  }
  // iOS는 사용자가 누른 순간에 <audio>를 한 번 재생해 둬야 이후에 코드로 곡을 바꿔 틀 수 있다
  const SILENCE = URL.createObjectURL(wav([new Float32Array(800), new Float32Array(800)], 800, 8000));

  /* 행성의 노래를 미리 한 곡으로 합성해 <audio>로 튼다.
   * 실제 오디오 파일처럼 재생되므로 아이폰 무음 모드에서도 들리고, 제어센터·잠금 화면에도 뜬다. */
  class Music {
    constructor() { this.playing = false; this.level = 0; this.el = null; this.cache = new Map(); this.token = 0; }

    _element() {
      if (this.el) return this.el;
      // iOS 17+: 이 페이지의 소리를 '음악 재생'으로 취급
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 미지원 */ }
      const el = this.el = document.createElement('audio');
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      return el;
    }

    async play(world) {
      const el = this._element();
      const p = world.music;
      const tok = ++this.token;
      this.playing = true;
      // 같은 곡을 동시에 두 번 합성하지 않도록 진행 중인 합성도 캐시에 둔다
      let entry = this.cache.get(p.seed);
      if (!entry) {
        entry = { pr: this._render(p) };
        entry.pr.then((t) => { entry.track = t; }, () => this.cache.delete(p.seed));
        this.cache.set(p.seed, entry);
        for (const [k, old] of this.cache) {
          if (this.cache.size <= 3) break;
          if (k === p.seed) continue;
          this.cache.delete(k);
          if (old.track) URL.revokeObjectURL(old.track.url);
        }
      }
      if (!entry.track) {
        // 합성하는 동안 제스처가 끊기지 않도록 무음으로 먼저 재생을 시작해 둔다
        if (el.paused) { el.src = SILENCE; el.play().catch(() => {}); }
        if (this.onBusy) this.onBusy(true);
        try { await entry.pr; } finally { if (tok === this.token && this.onBusy) this.onBusy(false); }
        if (tok !== this.token || !this.playing) return;
      }
      this.track = entry.track;
      if (el.src !== entry.track.url) el.src = entry.track.url;
      await el.play();
    }

    stop() {
      this.playing = false;
      this.token++;
      if (this.el) this.el.pause();
    }

    getLevel() {
      const el = this.el, t = this.track;
      let target = 0;
      if (this.playing && el && !el.paused && t) target = t.env[Math.floor(el.currentTime * t.envRate) % t.env.length] || 0;
      this.level += (target - this.level) * 0.2;
      return this.level;
    }

    // 오프라인으로 한 곡을 합성: 끝부분의 잔향을 앞에 겹쳐 이음새 없는 반복 곡으로 만든다
    async _render(p) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) throw new Error('오프라인 오디오 미지원');
      const stepDur = 60 / p.bpm / 2;
      const steps = 16 * p.progression.length * CYCLES;
      const loopN = Math.round(steps * stepDur * SR), tailN = Math.round(TAIL * SR);
      // 채널 0·1: 원음, 2·3: 잔향으로 보낼 소리 (잔향은 아래에서 JS로 직접 계산한다)
      const ctx = new OAC(4, loopN + tailN, SR);
      const eng = Object.create(Music.prototype);
      eng._build(ctx);
      eng.p = p;
      eng.scale = MODES[p.mode] || MODES.aeolian;
      eng.stepDur = stepDur;
      eng.delay.delayTime.value = stepDur * 3;
      eng.rand = NV.makeRng('music-live/' + p.seed);
      // 곡 도입부 규칙(처음 몇 박은 아르페지오 없음)을 건너뛰도록 한 바퀴 뒤에서 시작한 것처럼 센다
      const offset = 16 * p.progression.length;
      for (let s = 0; s < steps; s++) eng._step(s + offset, s * stepDur);
      const out = await new Promise((res, rej) => {
        ctx.oncomplete = (e) => res(e.renderedBuffer);
        const pr = ctx.startRendering();
        if (pr && pr.catch) pr.catch(rej);
      });
      const chs = [out.getChannelData(0), out.getChannelData(1)];
      const N = loopN + tailN;
      [out.getChannelData(2), out.getChannelData(3)].forEach((send, c) => {
        const wet = freeverb(send, N, SR, c ? 23 : 0);
        for (let i = 0; i < N; i++) chs[c][i] += wet[i] * 0.0145;
      });
      let peak = 0;
      for (const d of chs) {
        for (let i = 0; i < tailN; i++) d[i] += d[loopN + i];
        for (let i = 0; i < loopN; i++) peak = Math.max(peak, Math.abs(d[i]));
      }
      const gain = peak > 0 ? 0.85 / peak : 1;
      for (const d of chs) for (let i = 0; i < loopN; i++) d[i] *= gain;
      // 행성 대기가 음악에 맞춰 숨 쉬도록 음량 곡선을 미리 계산해 둔다 (초당 20칸)
      const envRate = 20, win = SR / envRate, env = new Float32Array(Math.ceil(loopN / win));
      for (let k = 0; k < env.length; k++) {
        let s = 0; const a = k * win, b = Math.min(loopN, a + win);
        for (let i = a; i < b; i++) s += chs[0][i] * chs[0][i];
        env[k] = Math.min(1, Math.sqrt(s / Math.max(1, b - a)) * 4);
      }
      return { url: URL.createObjectURL(wav(chs, loopN, SR)), env, envRate };
    }

    _build(ctx) {
      this.ctx = ctx;
      const stereo = () => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = 'explicit'; return g; };
      const merger = ctx.createChannelMerger(4);
      ctx.destination.channelInterpretation = 'discrete';
      merger.connect(ctx.destination);
      const route = (node, ch) => { const sp = ctx.createChannelSplitter(2); node.connect(sp); sp.connect(merger, 0, ch); sp.connect(merger, 1, ch + 1); };
      this.master = stereo(); this.master.gain.value = 0.9;
      route(this.master, 0);
      // 잔향으로 보낼 소리 (합성이 끝난 뒤 freeverb로 처리)
      this.reverb = stereo();
      route(this.reverb, 2);

      // 핑퐁 느낌의 딜레이
      this.delay = ctx.createDelay(2);
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay);
      dlp.connect(this.master); dlp.connect(this.reverb);

      this.dry = ctx.createGain(); this.dry.gain.value = 0.8;
      this.dry.connect(this.master); this.dry.connect(this.reverb);
    }

    _note(deg, oct) {
      const sc = this.scale, n = sc.length;
      const o = Math.floor(deg / n);
      return this.p.root + 12 * (oct + o) + sc[((deg % n) + n) % n];
    }
    _chord(deg) { return [0, 2, 4, 6].map((i) => this._note(deg + i, 0)); }

    _step(step, t) {
      const p = this.p, r = this.rand;
      const barPair = Math.floor(step / 16);
      const deg = p.progression[barPair % p.progression.length];
      const local = step % 16;
      if (local === 0) {
        this._pad(this._chord(deg).slice(0, r.chance(0.5) ? 4 : 3), t, this.stepDur * 16);
        this._bass(this._note(deg, -1), t, this.stepDur * 7);
      }
      if (local === 8) this._bass(this._note(deg + (r.chance(0.5) ? 4 : 0), -1), t, this.stepDur * 7);
      const pat = p.pattern[local];
      if (pat >= 0 && step >= 8) {
        const tones = this._chord(deg);
        const midi = tones[pat % 4] + (pat >= 4 ? 12 : 0) + 12;
        this._pluck(midi, t, r.range(0.10, 0.2));
      }
      if (r.chance(p.bellChance) && step >= 16) this._bell(this._note(deg + r.pick([0, 2, 4, 7]), 2), t);
    }

    _pad(notes, t, dur) {
      const ctx = this.ctx;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(this.p.cutoff * 0.5, t);
      lp.frequency.linearRampToValueAtTime(this.p.cutoff, t + dur * 0.5);
      lp.frequency.linearRampToValueAtTime(this.p.cutoff * 0.6, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.04, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.15);
      lp.connect(g); g.connect(this.dry);
      notes.forEach((m) => {
        [-7, 7].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = this.p.padWave; o.frequency.value = mtof(m); o.detune.value = det;
          o.connect(lp); o.start(t); o.stop(t + dur * 1.2);
        });
      });
    }

    _bass(m, t, dur) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    }

    _pluck(m, t, vel) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = this.p.arpWave; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(this.dry); g.connect(this.delay);
      o.start(t); o.stop(t + 1);
    }

    _bell(m, t) {
      const ctx = this.ctx, car = ctx.createOscillator(), mod = ctx.createOscillator();
      const mg = ctx.createGain(), g = ctx.createGain();
      const f = mtof(m);
      car.frequency.value = f; mod.frequency.value = f * 3.5;
      mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 2);
      mod.connect(mg); mg.connect(car.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      car.connect(g); g.connect(this.reverb); g.connect(this.delay);
      car.start(t); mod.start(t); car.stop(t + 3.1); mod.stop(t + 3.1);
    }
  }

  NV.Music = Music;
})();
