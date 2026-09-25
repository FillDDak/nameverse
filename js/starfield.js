/* NAMEVERSE — 배경 별밭: 시차, 반짝임, 별똥별, 그리고 워프 */
(function () {
  'use strict';
  const NV = window.NV;

  // 행성 화면의 별 공간 (행성 반지름 = 1, 카메라는 행성 중심에서 6)
  const SKY_NEAR = 7, SKY_MIN = 9, SKY_FAR = 70;
  const SKY_SPIN = (Math.PI * 2) / 600; // 별 공간이 행성을 축으로 10분에 한 바퀴

  class Starfield {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.warp = 0; this.warpTarget = 0;
      this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      this.tint = [0.35, 0.45, 1]; this.tintTarget = this.tint.slice();
      this.shooting = [];
      this.view = null;  // 행성 화면의 카메라 {V, focal, shift}: 있으면 별들을 하늘에 고정한다
      this.sky = null;   // 하늘에 고정된 별들 (월드 방향)
      this.nebula = document.createElement('canvas');
      this.resize();
      window.addEventListener('pointermove', (e) => {
        this.mouse.tx = e.clientX / innerWidth - 0.5;
        this.mouse.ty = e.clientY / innerHeight - 0.5;
      });
    }

    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.w = this.c.width = Math.floor(innerWidth * dpr);
      this.h = this.c.height = Math.floor(innerHeight * dpr);
      const n = Math.min(1400, Math.floor(innerWidth * innerHeight / 1100));
      this.stars = Array.from({ length: n }, () => this._star(true));
      this._paintNebula();
    }

    _star(anyZ) {
      const hue = Math.random();
      return {
        x: (Math.random() * 2 - 1) * 1.6, y: (Math.random() * 2 - 1) * 1.6,
        z: anyZ ? Math.random() * 0.95 + 0.05 : 1,
        s: Math.random() * 1.2 + 0.3,
        tw: Math.random() * Math.PI * 2, tws: Math.random() * 2 + 0.5,
        col: hue < 0.15 ? '255,210,170' : hue < 0.3 ? '180,200,255' : '255,255,255',
      };
    }

    setTint(rgb) { this.tintTarget = rgb.slice(); }

    _paintNebula() {
      const nb = this.nebula, W = (nb.width = 480), H = (nb.height = Math.round(480 * this.h / this.w) || 270);
      const g = nb.getContext('2d');
      g.clearRect(0, 0, W, H);
      const [r, gg, b] = this.tint.map((x) => Math.round(x * 255));
      const blobs = [[0.2, 0.3, 0.55, 0.22], [0.8, 0.7, 0.6, 0.18], [0.65, 0.15, 0.35, 0.12], [0.3, 0.85, 0.4, 0.1]];
      blobs.forEach(([x, y, rad, a], i) => {
        const grd = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, rad * W);
        const mix = i % 2 ? `${Math.round(b * 0.8)},${Math.round(r * 0.6)},${Math.round(gg)}` : `${r},${gg},${b}`;
        grd.addColorStop(0, `rgba(${mix},${a})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
      });
    }

    /* 행성에 도착하면 지나온 별들을 행성 주변 공간(월드 좌표)의 점으로 바꾼다.
     * 행성 셰이더와 같은 카메라(시점 회전 V, 초점거리, 화면 이동)로 투영하므로 시점을 돌리면 함께 돌고,
     * 별 공간은 행성을 축으로 아주 천천히 돌아서, 가까운 별은 조금 빨리 먼 별은 느리게 옆으로 흘러간다(시차). */
    _enterSky(view) {
      const W = this.w, H = this.h, F = view.focal, V = view.V, [sx, sy] = view.shift, C = view.cam;
      const cx = W / 2, cy = H / 2, scale = Math.max(W, H) * 0.5;
      const sky = [];
      for (const s of this.stars) {
        const par = 1 / s.z;
        const x = cx + (s.x / s.z) * scale * 0.5 - this.mouse.x * 18 * par * this.dpr;
        const y = cy + (s.y / s.z) * scale * 0.5 - this.mouse.y * 18 * par * this.dpr;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        // 화면 위치 그대로, 가까웠던 별(작은 z)일수록 카메라 가까이에 둔다
        const ux = (x - cx) / H - sx, uy = (cy - y) / H - sy, l = Math.hypot(ux, uy, F);
        const t = SKY_NEAR + s.z * (SKY_FAR - SKY_NEAR);
        const pv = [ux / l * t, uy / l * t, C - F / l * t];
        sky.push(this._skyStar(this._toWorld(V, pv), s));
      }
      // 화면 밖의 나머지 공간도 같은 밀도로 채운다
      let hit = 0;
      const probe = [];
      for (let i = 0; i < 4000; i++) { const p = this._randPoint(); probe.push(p); if (this._project(p, view)) hit++; }
      const total = Math.min(40000, Math.round(sky.length / Math.max(hit / 4000, 0.004)));
      for (let i = 0; i < total; i++) {
        const p = i < probe.length ? probe[i] : this._randPoint();
        if (this._project(p, view)) continue; // 지나온 별들이 이미 있는 곳
        sky.push(this._skyStar(p, this._star(true)));
      }
      this.sky = sky;
    }

    _toWorld(V, p) { return [V[0] * p[0] + V[3] * p[1] + V[6] * p[2], V[1] * p[0] + V[4] * p[1] + V[7] * p[2], V[2] * p[0] + V[5] * p[1] + V[8] * p[2]]; }
    // 행성 중심에서 SKY_MIN~SKY_FAR 떨어진 곳에: 거리를 고르게 뽑아 가깝고 밝은 별도 충분히 섞이게 한다
    _randPoint() {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const R = SKY_MIN + Math.random() * (SKY_FAR - SKY_MIN);
      return [rr * Math.cos(th) * R, u * R, rr * Math.sin(th) * R];
    }
    _skyStar(p, s) { return { p, s: s.s, col: s.col, tw: s.tw, tws: s.tws }; }
    // 월드 좌표 → 화면 픽셀 (셰이더와 같은 식). 카메라 뒤나 화면 밖이면 null
    _project(p, view) {
      const V = view.V, F = view.focal, [sx, sy] = view.shift, H = this.h;
      const z = V[6] * p[0] + V[7] * p[1] + V[8] * p[2] - view.cam;
      if (z > -0.5) return null;
      const x = this.w / 2 + ((V[0] * p[0] + V[1] * p[1] + V[2] * p[2]) / -z * F + sx) * H;
      const y = H / 2 - ((V[3] * p[0] + V[4] * p[1] + V[5] * p[2]) / -z * F + sy) * H;
      if (x < -4 || x > this.w + 4 || y < -4 || y > H + 4) return null;
      return [x, y, -z];
    }

    _drawSky(dt) {
      const ctx = this.ctx, view = this.view;
      const c = Math.cos(SKY_SPIN * dt), s = Math.sin(SKY_SPIN * dt);
      for (const st of this.sky) {
        const p = st.p;
        const x = p[0] * c + p[2] * s;
        p[2] = -p[0] * s + p[2] * c; p[0] = x;
        st.tw += st.tws * dt;
        const q = this._project(p, view);
        if (!q) continue;
        const near = Math.max(0, Math.min(1, (SKY_FAR - q[2]) / (SKY_FAR - SKY_NEAR)));
        const a = Math.min(1, (0.35 + near * 0.9) * (0.75 + 0.25 * Math.sin(st.tw)));
        const size = Math.min(3.4 * this.dpr, st.s * (0.5 + near * 1.6) * this.dpr);
        ctx.fillStyle = `rgba(${st.col},${a})`;
        ctx.fillRect(q[0] - size / 2, q[1] - size / 2, size, size);
      }
    }

    frame(dt, t) {
      const ctx = this.ctx, W = this.w, H = this.h;
      this.warp += (this.warpTarget - this.warp) * Math.min(1, dt * 2.2);
      if (this.warpTarget === 0 && this.warp < 0.02) this.warp = 0;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * Math.min(1, dt * 3);
      this.mouse.y += (this.mouse.ty - this.mouse.y) * Math.min(1, dt * 3);
      let changed = false;
      for (let i = 0; i < 3; i++) {
        const d = this.tintTarget[i] - this.tint[i];
        if (Math.abs(d) > 0.004) { this.tint[i] += d * Math.min(1, dt * 1.5); changed = true; }
      }
      if (changed && ((this._nt = (this._nt || 0) + dt) > 0.1)) { this._nt = 0; this._paintNebula(); }

      // 행성에 도착하면(워프가 잦아들면) 지나온 별들을 그 자리 그대로 하늘에 고정한다
      if (this.view && !this.sky && this.warp < 0.08) this._enterSky(this.view);
      if (!this.view && this.sky) this.sky = null; // 다시 떠나면 멈춰 있던 자리에서 이어서 흐른다
      this.skyFade = this.sky ? Math.min(1, (this.skyFade || 0) + dt * 1.5) : 0;

      ctx.fillStyle = '#03030a';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = (0.9 - this.warp * 0.4) * (1 - this.skyFade * 0.75); // 성운은 은하수(셰이더)에게 자리를 내준다
      ctx.drawImage(this.nebula, -this.mouse.x * 30 * this.dpr - 20, -this.mouse.y * 30 * this.dpr - 20, W + 40, H + 40);
      ctx.globalAlpha = 1;
      if (this.sky) { this._drawSky(dt); ctx.restore(); return; }

      const cx = W / 2, cy = H / 2, scale = Math.max(W, H) * 0.5;
      const speed = 0.012 + this.warp * 2.4;
      ctx.lineCap = 'round';
      for (const s of this.stars) {
        s.z -= speed * dt;
        s.tw += s.tws * dt;
        if (s.z <= 0.03) { Object.assign(s, this._star(false)); continue; }
        const par = 1 / s.z;
        const x = cx + (s.x / s.z) * scale * 0.5 - this.mouse.x * 18 * par * this.dpr;
        const y = cy + (s.y / s.z) * scale * 0.5 - this.mouse.y * 18 * par * this.dpr;
        if (x < -50 || x > W + 50 || y < -50 || y > H + 50) {
          if (this.warp > 0.05) Object.assign(s, this._star(false));
          continue;
        }
        const near = 1 - s.z;
        const a = Math.min(1, (0.35 + near * 0.9) * (0.75 + 0.25 * Math.sin(s.tw)));
        const size = s.s * (0.5 + near * 1.6) * this.dpr;
        if (this.warp > 0.03) {
          // 꼬리 길이는 프레임 간격이 아니라 속도에 비례 → 느린 기기에서도 같은 모양
          const tz = Math.min(1.2, s.z + speed * 0.028);
          const px = cx + (s.x / tz) * scale * 0.5 - this.mouse.x * 18 * par * this.dpr;
          const py = cy + (s.y / tz) * scale * 0.5 - this.mouse.y * 18 * par * this.dpr;
          ctx.strokeStyle = `rgba(${s.col},${a * 0.75})`;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${s.col},${a})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }

      // 별똥별
      if (this.warp < 0.1 && Math.random() < dt * 0.25) {
        const ang = Math.PI * (0.15 + Math.random() * 0.2);
        this.shooting.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, vx: Math.cos(ang), vy: Math.sin(ang), life: 1, sp: (600 + Math.random() * 600) * this.dpr });
      }
      this.shooting = this.shooting.filter((m) => m.life > 0);
      for (const m of this.shooting) {
        m.x += m.vx * m.sp * dt; m.y += m.vy * m.sp * dt; m.life -= dt * 1.4;
        const len = 140 * this.dpr;
        const grd = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * len, m.y - m.vy * len);
        grd.addColorStop(0, `rgba(255,255,255,${Math.max(0, m.life)})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 1.6 * this.dpr;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * len, m.y - m.vy * len); ctx.stroke();
      }
      ctx.restore();
    }
  }

  NV.Starfield = Starfield;
})();
