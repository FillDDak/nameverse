/* NAMEVERSE — 배경 별밭: 시차, 반짝임, 별똥별, 그리고 워프 */
(function () {
  'use strict';
  const NV = window.NV;

  // 행성 화면의 별 공간 (행성 반지름 = 1, 카메라는 행성 중심에서 6)
  // 별의 거리 분포 (행성 중심 기준): 거리를 3배씩 늘린 구간마다 개수가 SKY_GROW배씩 늘어난다.
  // 가까운 구간(40~120)은 드물고, 멀어질수록 점점 많아져 가장 먼 곳은 셰이더가 그리는 무한히 먼 배경 별·은하수와 이어진다
  const SKY_NEAR = 40, SKY_FAR = 40 * 3 ** 7, SKY_GROW = 1.6; // 3배 구간 7개: 40~120, 120~360, … ~87,480
  const BANDS = Math.log(SKY_FAR / SKY_NEAR) / Math.log(3); // 구간 수 (7)
  const GROW_TOTAL = Math.pow(SKY_GROW, BANDS) - 1;
  // 거리 d까지의 누적 비율과 그 역함수
  const cdf = (d) => {
    const x = Math.log(Math.max(d, SKY_NEAR) / SKY_NEAR) / Math.log(3);
    return Math.min(1, (Math.pow(SKY_GROW, x) - 1) / GROW_TOTAL);
  };
  const invCdf = (u) => SKY_NEAR * Math.pow(3, Math.log(1 + u * GROW_TOTAL) / Math.log(SKY_GROW));
  const nearness = (d) => 1 - cdf(d);
  const SKY_DRIFT = 0.05; // 화면 왼쪽으로 흐르는 속도 (공간 단위/초): 가장 가까운 별도 초당 1픽셀 안팎

  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vscale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vnorm = (a) => vscale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

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
      this.comet = null;
      this.cometU = null; // 행성 셰이더가 그릴 혜성의 화면 좌표
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
     * 별들은 카메라 기준 항상 같은 방향(화면 왼쪽)으로 아주 천천히 평행이동한다. 시점을 돌려도 흐르는 방향은 그대로이고,
     * 먼 별일수록 느리게 움직인다(시차). */
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
        const t = invCdf(s.z); // 날아올 때 가까웠던 별(작은 z)은 가까이, 멀던 별은 아주 멀리
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
    // 방향은 고르게, 거리는 위의 분포대로
    _randPoint() {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const R = invCdf(Math.random());
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

    // _project와 같지만 화면 밖이어도 돌려준다 (혜성 꼬리가 화면 가장자리에 걸칠 때)
    _projectRaw(p, view) {
      const V = view.V, F = view.focal, [sx, sy] = view.shift, H = this.h;
      const z = V[6] * p[0] + V[7] * p[1] + V[8] * p[2] - view.cam;
      if (z > -1) return null;
      return [this.w / 2 + ((V[0] * p[0] + V[1] * p[1] + V[2] * p[2]) / -z * F + sx) * H,
        H / 2 - ((V[3] * p[0] + V[4] * p[1] + V[5] * p[2]) / -z * F + sy) * H, -z];
    }

    /* 혜성: 모항성을 향해 떨어지는 중이라 머리가 앞장서고, 꼬리는 늘 모항성 반대쪽으로 뻗는다(항성풍과 빛의 압력).
     * 여기서는 궤도와 3D 위치만 계산해 화면에 투영하고, 모양은 행성 셰이더(하늘)가 픽셀 단위로 그린다 */
    _spawnComet(view) {
      const W = this.w, H = this.h, F = view.focal, [sx, sy] = view.shift, V = view.V;
      const Ls = NV.LIGHT, a = vscale(Ls, -1);
      const D = 3000 + Math.random() * 6000; // 카메라에서의 거리 (가장 먼 별들 사이)
      // 화면에서 행성 근처의 한 점을 지나가도록 (정보 패널 뒤는 피한다)
      const mx = sx + (Math.random() - 0.5) * 0.8, my = sy + (Math.random() - 0.5) * 0.4;
      const M = this._toWorld(V, [(mx - sx) * D / F, (my - sy) * D / F, view.cam - D]);
      const e1 = vnorm(vcross(Ls, Math.abs(Ls[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = vcross(Ls, e1);
      // 모항성 쪽으로 25~60° 기울어 떨어지는 궤도 중, 화면에서 움직임이 잘 보이는 방향을 고른다
      let best = null;
      const q0 = this._projectRaw(M, view), eps = D * 0.01;
      for (let i = 0; i < 16; i++) {
        const al = (25 + Math.random() * 35) * Math.PI / 180, th = Math.random() * Math.PI * 2;
        const w = vadd(vscale(e1, Math.cos(th)), vscale(e2, Math.sin(th)));
        const u = vadd(vscale(Ls, Math.cos(al)), vscale(w, Math.sin(al)));
        const q1 = this._projectRaw(vadd(M, vscale(u, eps)), view);
        if (!q0 || !q1) continue;
        const pxu = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) / eps;
        if (!best || pxu > best.pxu) best = { u, w, pxu };
      }
      if (!best) { this.cometWait = 5; return; }
      const S = Math.min(Math.hypot(W, H) * 0.6 / Math.max(best.pxu, 1e-6), D * 0.45);
      const T = 70 + Math.random() * 30;
      const lc = view.lightCol || [1, 0.96, 0.9];
      this.comet = { p: vadd(M, vscale(best.u, -S)), vel: vscale(best.u, 2 * S / T), a, b: vscale(best.w, -1), t: 0, T,
        L: D * (0.4 + Math.random() * 0.25) / F, r: D * 0.0026 / F, bright: 0.8 + Math.random() * 0.4, seed: Math.random() * 100,
        dust: [lc[0], lc[1] * 0.93, lc[2] * 0.8] }; // 먼지 꼬리는 모항성 빛을 반사한다
    }

    // 궤도를 따라 움직이고, 셰이더에 넘길 화면 좌표(하늘 uv: 화면 높이 = 1, 행성 중심 기준)를 만든다
    _updateComet(dt, view) {
      const c = this.comet;
      c.t += dt;
      if (c.t > c.T) { this.comet = null; this.cometU = null; this.cometWait = 40 + Math.random() * 50; return; }
      const p = c.p;
      p[0] += c.vel[0] * dt; p[1] += c.vel[1] * dt; p[2] += c.vel[2] * dt;
      const W = this.w, H = this.h, [sx, sy] = view.shift;
      const uv = (w) => { const q = this._projectRaw(w, view); return q && [(q[0] - W / 2) / H - sx, (H / 2 - q[1]) / H - sy, q[2]]; };
      const h = uv(p);
      if (!h) { this.cometU = null; return; }
      // 꼬리 끝이 카메라 뒤로 넘어가면 짧게 자른다
      const tip = (f) => { for (let k = 1; k > 0.05; k *= 0.6) { const q = uv(f(k)); if (q) return q; } return h; };
      const BEND = 0.5, Ld = c.L, Li = c.L * 1.3;
      const ion = tip((k) => vadd(p, vscale(c.a, Li * k)));
      const dustAt = (s, k) => vadd(p, vscale(vadd(vscale(c.a, s), vscale(c.b, BEND * s * s)), Ld * k));
      let E = null, Mid = null;
      for (let k = 1; k > 0.05 && !E; k *= 0.6) { E = uv(dustAt(1, k)); Mid = E && uv(dustAt(0.5, k)); if (!Mid) E = null; }
      if (!E) { E = h; Mid = h; }
      const C = [2 * Mid[0] - 0.5 * (h[0] + E[0]), 2 * Mid[1] - 0.5 * (h[1] + E[1])]; // 중간점을 지나는 2차 베지어의 조절점
      const r = c.r / h[2] * view.focal;
      const ext = Math.max(Math.hypot(ion[0] - h[0], ion[1] - h[1]), Math.hypot(E[0] - h[0], E[1] - h[1]), Math.hypot(C[0] - h[0], C[1] - h[1])) + r * 30;
      const env = Math.min(1, c.t / 6, (c.T - c.t) / 6) * c.bright;
      this.cometU = { H: [h[0], h[1], r, env], I: [ion[0], ion[1], ext, c.seed], D: [C[0], C[1], E[0], E[1]], col: c.dust };
    }

    _drawSky(dt) {
      const ctx = this.ctx, view = this.view, V = view.V;
      // 카메라의 오른쪽 방향(월드 좌표)의 반대로 이동 → 화면에서는 늘 왼쪽으로 흐른다
      const k = SKY_DRIFT * dt, mx = -V[0] * k, my = -V[1] * k, mz = -V[2] * k;
      for (const st of this.sky) {
        const p = st.p;
        p[0] += mx; p[1] += my; p[2] += mz;
        // 흘러가다 행성에 너무 가까워진 별은 다른 곳에서 다시 (분포 유지)
        if (p[0] * p[0] + p[1] * p[1] + p[2] * p[2] < SKY_NEAR * SKY_NEAR * 0.5) st.p = this._randPoint();
        st.tw += st.tws * dt;
        const q = this._project(p, view);
        if (!q) continue;
        const near = nearness(q[2]);
        // 우주에는 대기가 없어 별이 거의 반짝이지 않는다
        const a = Math.min(1, (0.35 + near * 0.9) * (0.95 + 0.05 * Math.sin(st.tw)));
        const size = Math.min(3.4 * this.dpr, st.s * (0.5 + near * 1.6) * this.dpr);
        ctx.fillStyle = `rgba(${st.col},${a})`;
        if (size < 1.8 * this.dpr) ctx.fillRect(q[0] - size / 2, q[1] - size / 2, size, size);
        else { ctx.beginPath(); ctx.arc(q[0], q[1], size / 2, 0, Math.PI * 2); ctx.fill(); }
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
      if (this.view && !this.sky && this.warp < 0.08) { this._enterSky(this.view); this.comet = this.cometU = null; this.cometWait = 12 + Math.random() * 10; }
      if (!this.view && this.sky) { this.sky = null; this.comet = this.cometU = null; } // 다시 떠나면 멈춰 있던 자리에서 이어서 흐른다
      this.skyFade = this.sky ? Math.min(1, (this.skyFade || 0) + dt * 1.5) : 0;

      ctx.fillStyle = '#03030a';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = (0.9 - this.warp * 0.4) * (1 - this.skyFade * 0.75); // 성운은 은하수(셰이더)에게 자리를 내준다
      ctx.drawImage(this.nebula, -this.mouse.x * 30 * this.dpr - 20, -this.mouse.y * 30 * this.dpr - 20, W + 40, H + 40);
      ctx.globalAlpha = 1;
      if (this.sky) {
        this._drawSky(dt);
        // 도착하고 조금 뒤 첫 혜성, 그다음부터는 1~2분에 한 번꼴
        if (this.comet) this._updateComet(dt, this.view);
        else if ((this.cometWait -= dt) <= 0) this._spawnComet(this.view);
        ctx.restore(); return;
      }

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
