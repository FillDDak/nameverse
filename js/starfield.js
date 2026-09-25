/* NAMEVERSE — 배경 별밭: 시차, 반짝임, 별똥별, 그리고 워프 */
(function () {
  'use strict';
  const NV = window.NV;

  class Starfield {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.warp = 0; this.warpTarget = 0;
      this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      this.tint = [0.35, 0.45, 1]; this.tintTarget = this.tint.slice();
      this.shooting = [];
      this.view = { yaw: 0, pitch: 0 }; // 행성 주위를 도는 시점 (라디안)
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

      ctx.fillStyle = '#03030a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.9 - this.warp * 0.4;
      ctx.drawImage(this.nebula, -this.mouse.x * 30 * this.dpr - 20, -this.mouse.y * 30 * this.dpr - 20, W + 40, H + 40);
      ctx.globalAlpha = 1;

      const cx = W / 2, cy = H / 2, scale = Math.max(W, H) * 0.5;
      // 시점을 돌리면 무한히 먼 별들은 모두 같은 만큼 흘러간다 (화면 밖으로 나가면 반대편에서 다시 들어온다)
      const k = H * 1.6, WW = W + 100, HH = H + 100;
      const vx = -this.view.yaw * k, vy = -this.view.pitch * k;
      const wrap = (v, m) => ((v % m) + m) % m - 50;
      const speed = 0.012 + this.warp * 2.4;
      ctx.lineCap = 'round';
      for (const s of this.stars) {
        s.z -= speed * dt;
        s.tw += s.tws * dt;
        if (s.z <= 0.03) { Object.assign(s, this._star(false)); continue; }
        const par = 1 / s.z;
        let x = cx + (s.x / s.z) * scale * 0.5 - this.mouse.x * 18 * par * this.dpr;
        let y = cy + (s.y / s.z) * scale * 0.5 - this.mouse.y * 18 * par * this.dpr;
        if (vx || vy) { x = wrap(x + vx, WW); y = wrap(y + vy, HH); }
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
    }
  }

  NV.Starfield = Starfield;
})();
