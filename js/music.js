/* NAMEVERSE — 행성마다 고유한 주제가를 Web Audio로 실시간 작곡한다 */
(function () {
  'use strict';
  const NV = window.NV;

  const MODES = {
    ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class Music {
    constructor() { this.ctx = null; this.playing = false; this.level = 0; }

    _init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio 미지원');
      // iOS: 무음 스위치와 상관없이 음악처럼 재생
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 미지원 */ }
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
      this.master.connect(comp); comp.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);

      // 소리를 <audio> 요소로 내보내야 아이폰 제어센터·잠금 화면에 '지금 재생 중'으로 뜬다
      if (ctx.createMediaStreamDestination) {
        this.stream = ctx.createMediaStreamDestination();
        this.analyser.connect(this.stream);
        this.el = document.createElement('audio');
        this.el.setAttribute('playsinline', '');
        this.el.srcObject = this.stream.stream;
      } else {
        this.analyser.connect(ctx.destination);
      }

      // 잔향: 지수 감쇠 노이즈로 임펄스 응답을 직접 만든다
      this.reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      this.reverb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.55;
      this.reverb.connect(wet); wet.connect(this.master);

      // 핑퐁 느낌의 딜레이
      this.delay = ctx.createDelay(2);
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay);
      dlp.connect(this.master); dlp.connect(this.reverb);

      this.dry = ctx.createGain(); this.dry.gain.value = 0.8;
      this.dry.connect(this.master); this.dry.connect(this.reverb);
    }

    // <audio> 재생이 막히면 예전처럼 스피커로 바로 보낸다
    _direct() {
      if (!this.el) return;
      try { this.analyser.disconnect(this.stream); } catch (e) { /* 이미 끊김 */ }
      this.analyser.connect(this.ctx.destination);
      this.el = null;
    }

    async play(world) {
      if (!this.ctx) this._init();
      clearTimeout(this.pauseTimer);
      // 사용자 제스처가 살아 있을 때 곧바로 play()를 불러야 한다 (await 이전)
      if (this.el) {
        const pr = this.el.play();
        if (pr) pr.catch(() => this._direct());
      }
      await this.ctx.resume();
      const p = world.music;
      this.p = p;
      this.scale = MODES[p.mode] || MODES.aeolian;
      this.stepDur = 60 / p.bpm / 2;
      this.delay.delayTime.value = this.stepDur * 3;
      this.rand = NV.makeRng('music-live/' + p.seed);
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.9, t + 2.5);
      this.step = 0;
      this.nextTime = t + 0.08;
      this.playing = true;
      clearInterval(this.timer);
      this.timer = setInterval(() => this._schedule(), 40);
      this._schedule();
    }

    stop() {
      if (!this.ctx || !this.playing) return;
      this.playing = false;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 1.2);
      clearInterval(this.timer);
      const el = this.el;
      if (el) this.pauseTimer = setTimeout(() => el.pause(), 1300);
    }

    getLevel() {
      if (!this.ctx || !this.playing) { this.level *= 0.9; return this.level; }
      this.analyser.getByteTimeDomainData(this.buf);
      let s = 0;
      for (let i = 0; i < this.buf.length; i++) { const x = (this.buf[i] - 128) / 128; s += x * x; }
      const rms = Math.sqrt(s / this.buf.length);
      this.level += (Math.min(1, rms * 5) - this.level) * 0.2;
      return this.level;
    }

    _note(deg, oct) {
      const sc = this.scale, n = sc.length;
      const o = Math.floor(deg / n);
      return this.p.root + 12 * (oct + o) + sc[((deg % n) + n) % n];
    }
    _chord(deg) { return [0, 2, 4, 6].map((i) => this._note(deg + i, 0)); }

    _schedule() {
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        this._step(this.step, this.nextTime);
        this.nextTime += this.stepDur;
        this.step++;
      }
    }

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
