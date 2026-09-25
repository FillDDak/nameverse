/* NAMEVERSE — WebGL 행성 렌더러 (프래그먼트 셰이더 하나로 행성·대기·고리·위성·일식까지 레이트레이싱) */
(function () {
  'use strict';
  const NV = window.NV;

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform vec2 uOffset; uniform vec2 uShift;
uniform float uTime, uFocal, uCamDist, uAlpha, uPulse;
uniform mat3 uRot, uCloudRot;
uniform vec3 uLight, uSeedOff, uLightCol;
uniform int uType;
uniform vec3 uDeep, uShallow, uLand, uHigh, uPeak, uAtmo, uEmit, uCloudCol;
uniform float uSea, uClouds, uIce, uCity, uWarp, uScale, uAtmoStr, uSpec;
uniform float uBands, uTurb, uStormSize; uniform vec3 uStorm;
uniform float uRing, uRingSeed; uniform vec3 uRingN; uniform vec2 uRingR; uniform vec3 uRingCol;
uniform vec4 uMoon0, uMoon1, uMoon2; uniform vec3 uMoonCol0, uMoonCol1, uMoonCol2;

float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<6;i++){ s += a*noise(p); p = p*2.02 + vec3(1.7,9.2,3.1); a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<3;i++){ s += a*noise(p); p = p*2.03 + vec3(4.1,2.3,7.7); a *= 0.5; } return s/0.875; }

float iSphere(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c; float b = dot(oc, rd); float h = b*b - dot(oc,oc) + r*r;
  if(h < 0.0) return -1.0; return -b - sqrt(h);
}
vec3 rotAxis(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }

float ringDensity(float r){
  float x = (r - uRingR.x)/(uRingR.y - uRingR.x);
  if(x < 0.0 || x > 1.0) return 0.0;
  float band = noise(vec3(r*18.0, uRingSeed, 0.0))*0.6 + noise(vec3(r*55.0, uRingSeed, 1.0))*0.4;
  float gaps = smoothstep(0.22, 0.34, noise(vec3(r*6.0, uRingSeed, 2.0)));
  return clamp(band*gaps*smoothstep(0.0,0.06,x)*smoothstep(1.0,0.9,x)*1.35, 0.0, 0.95);
}
float ringShadow(vec3 p){
  if(uRing < 0.5) return 1.0;
  float dn = dot(uLight, uRingN); if(abs(dn) < 1e-4) return 1.0;
  float ts = -dot(p, uRingN)/dn; if(ts <= 0.0) return 1.0;
  return 1.0 - ringDensity(length(p + uLight*ts))*0.75;
}
float moonShadow(vec3 p, vec4 m){
  if(m.w <= 0.0) return 1.0;
  vec3 oc = p - m.xyz; float bb = dot(oc, uLight);
  if(bb > 0.0) return 1.0;
  float d = length(oc - bb*uLight);
  return mix(0.12, 1.0, smoothstep(m.w*0.75, m.w*1.25, d));
}

vec3 shadePlanet(vec3 n, vec3 rd, vec3 p){
  vec3 lp = uRot * n;
  float diff = dot(n, uLight);
  float day = smoothstep(-0.12, 0.18, diff);
  vec3 base; float spec = 0.0; float land = 0.0; vec3 emit = vec3(0.0);
  vec3 q = lp*uScale + uSeedOff;

  if(uType == 1){
    vec3 sp = normalize(uStorm);
    float sd = distance(lp, sp);
    vec3 pp = rotAxis(lp, sp, 5.0*exp(-sd*sd/(uStormSize*uStormSize)));
    float warp = fbm(vec3(pp.x*2.0, pp.y*9.0, pp.z*2.0) + uSeedOff + vec3(uTime*0.01, 0.0, 0.0));
    float t = pp.y*uBands + warp*uTurb;
    float s1 = 0.5 + 0.5*sin(t*3.0);
    float s2 = 0.5 + 0.5*sin(t*7.3 + 1.7);
    base = mix(uDeep, uShallow, s1);
    base = mix(base, uLand, smoothstep(0.55, 0.95, s2)*0.8);
    base = mix(base, uHigh, smoothstep(0.62, 0.95, fbm3(pp*vec3(3.0,14.0,3.0) + uSeedOff))*0.6);
    float storm = smoothstep(uStormSize, uStormSize*0.35, sd);
    base = mix(base, uPeak, storm*0.85);
    base *= 0.9 + 0.2*smoothstep(1.0, 0.0, abs(lp.y));
  } else if(uType == 2){
    float hh = fbm(q + uWarp*(vec3(fbm3(q), fbm3(q+5.2), fbm3(q+9.1)) - 0.5));
    float rr = 1.0 - abs(fbm3(q*2.3 + 3.0)*2.0 - 1.0);
    float crack = smoothstep(0.86, 0.97, rr);
    float lakes = smoothstep(uSea, uSea - 0.06, hh);
    base = mix(uDeep, uShallow, smoothstep(0.3, 0.7, hh));
    base = mix(base, uLand, smoothstep(0.58, 0.75, hh)*0.7);
    float flick = 0.8 + 0.2*sin(uTime*1.7 + hh*30.0);
    float glow = max(crack*1.2, lakes);
    emit = uEmit*glow*flick*(1.0 + uPulse*0.6);
    base *= 1.0 - 0.85*min(glow, 1.0);
    spec = uSpec*(1.0 - lakes);
  } else {
    float hh = fbm(q + uWarp*(vec3(fbm3(q), fbm3(q+5.2), fbm3(q+9.1)) - 0.5));
    if(hh < uSea){
      float d = (uSea - hh)/max(uSea, 0.01);
      base = mix(uShallow, uDeep, smoothstep(0.0, 0.28, d));
      spec = 1.0;
    } else {
      float e = (hh - uSea)/max(1.0 - uSea, 0.01);
      base = mix(uLand, uHigh, smoothstep(0.02, 0.25, e));
      base = mix(base, uPeak, smoothstep(0.22, 0.45, e));
      land = 1.0;
    }
    float lat = abs(lp.y) + (hh - 0.5)*0.35;
    float ice = smoothstep(uIce, uIce + 0.04, lat);
    base = mix(base, vec3(0.92, 0.95, 1.0), ice);
    spec *= 1.0 - ice; land *= 1.0 - ice;
    if(uType == 3){
      float rr = 1.0 - abs(fbm3(q*3.1 + 7.0)*2.0 - 1.0);
      base = mix(base, uEmit, smoothstep(0.9, 0.98, rr)*0.75);
    }
    if(uCity > 0.0){
      float region = smoothstep(0.55, 0.75, noise(lp*9.0 + uSeedOff.yzx));
      float dots = smoothstep(0.72, 0.92, noise(lp*140.0 + uSeedOff));
      float cl = region*(dots + 0.08)*land*uCity;
      emit += vec3(1.0, 0.74, 0.4)*cl*(1.0 - day)*1.6;
    }
  }

  float cloud = 0.0;
  if(uClouds > 0.01){
    vec3 cq = (uCloudRot*n)*2.2 + uSeedOff*1.7;
    float w = fbm3(cq*1.3);
    float cv = fbm(cq + vec3(w*1.4, 0.0, w*1.1));
    float th = mix(0.66, 0.42, uClouds);
    cloud = smoothstep(th, th + 0.16, cv);
  }

  float sh = ringShadow(p)*moonShadow(p, uMoon0)*moonShadow(p, uMoon1)*moonShadow(p, uMoon2);
  float dl = max(diff, 0.0)*sh;
  vec3 lightCol = uLightCol;
  vec3 c = base*(dl*1.15 + 0.02)*lightCol;
  vec3 hv = normalize(uLight - rd);
  c += lightCol*spec*pow(max(dot(n, hv), 0.0), 70.0)*0.75*sh*step(0.0, diff)*(1.0 - cloud);
  c += emit*(1.0 - cloud*0.75);
  c = mix(c, uCloudCol*lightCol*(dl*1.2 + 0.025), cloud*0.95);
  float mu = max(dot(n, -rd), 0.0);
  float fres = pow(1.0 - mu, 2.6);
  float atmoL = smoothstep(-0.35, 0.6, diff);
  c += uAtmo*fres*atmoL*uAtmoStr*(0.85 + uPulse*0.8);
  c += uAtmo*0.05*atmoL*uAtmoStr;
  return c;
}

void traceMoon(vec3 ro, vec3 rd, vec4 m, vec3 mc, float idx, inout float tBest, inout vec3 oc, inout float oa){
  if(m.w <= 0.0) return;
  float t = iSphere(ro, rd, m.xyz, m.w);
  if(t > 0.0 && t < tBest){
    vec3 p = ro + rd*t; vec3 n = normalize(p - m.xyz);
    float f = fbm3(n*3.0 + idx*7.0);
    vec3 col = mc*(0.55 + 0.7*f);
    col *= 1.0 - 0.3*smoothstep(0.55, 0.7, noise(n*5.0 + idx*3.0));
    float d = max(dot(n, uLight), 0.0);
    float sh = iSphere(p, uLight, vec3(0.0), 1.0) > 0.0 ? 0.04 : 1.0;
    oc = col*(d*sh*1.15 + 0.012);
    oa = 1.0; tBest = t;
  }
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uOffset - 0.5*uRes)/uRes.y - uShift;
  vec3 ro = vec3(0.0, 0.0, uCamDist);
  vec3 rd = normalize(vec3(uv, -uFocal));
  float px = uCamDist/(uRes.y*uFocal);

  float b = dot(ro, rd);
  float dist = sqrt(max(dot(ro, ro) - b*b, 0.0));
  vec3 cp = ro - rd*b;

  // 대기 광륜 (프리멀티플라이드 알파)
  float g = exp(-max(dist - 1.0, 0.0)*8.0)*smoothstep(0.96, 1.0, dist);
  float lightF = smoothstep(-0.6, 0.8, dot(normalize(cp), uLight));
  float glow = g*lightF*0.55*uAtmoStr*(1.0 + uPulse*0.9);
  vec3 col = uAtmo*glow;
  float alpha = glow;

  float tBest = 1e9; vec3 oc = vec3(0.0); float oa = 0.0;
  float h = b*b - dot(ro, ro) + 1.0;
  if(h > 0.0){
    float t = -b - sqrt(h);
    vec3 p = ro + rd*t;
    vec3 pc = shadePlanet(normalize(p), rd, p);
    oc = 1.0 - exp(-pc*1.25);
    oa = smoothstep(0.0, 1.5*px, 1.0 - dist);
    tBest = t;
  }
  traceMoon(ro, rd, uMoon0, uMoonCol0, 1.0, tBest, oc, oa);
  traceMoon(ro, rd, uMoon1, uMoonCol1, 2.0, tBest, oc, oa);
  traceMoon(ro, rd, uMoon2, uMoonCol2, 3.0, tBest, oc, oa);
  col = oc*oa + col*(1.0 - oa);
  alpha = oa + alpha*(1.0 - oa);

  if(uRing > 0.5){
    float dn = dot(rd, uRingN);
    if(abs(dn) > 1e-4){
      float tr = -dot(ro, uRingN)/dn;
      if(tr > 0.0 && tr < tBest){
        vec3 hp = ro + rd*tr;
        float d = ringDensity(length(hp));
        if(d > 0.0){
          vec3 rc = uRingCol*(0.75 + 0.5*noise(vec3(length(hp)*90.0, uRingSeed, 3.0)));
          float shadow = iSphere(hp, uLight, vec3(0.0), 1.0) > 0.0 ? 0.1 : 1.0;
          rc *= (0.3 + 0.7*abs(dot(uRingN, uLight)))*shadow;
          rc = 1.0 - exp(-rc*1.25);
          col = rc*d + col*(1.0 - d);
          alpha = d + alpha*(1.0 - d);
        }
      }
    }
  }
  alpha = clamp(alpha, 0.0, 1.0);
  col = min(col, vec3(alpha));
  gl_FragColor = vec4(col, alpha)*uAlpha;
}`;

  /* ───────────── 3x3 행렬 (행 우선) ───────────── */
  const M = {
    mul(a, b) {
      const o = new Array(9);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      return o;
    },
    vec(m, v) {
      return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
    },
    rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; },
    ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
    rz(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
    transpose(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; },
  };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  const LIGHT = norm([-0.8, 0.38, 0.62]);
  const CAM = 6.0;
  const BASE_PITCH = 0.3;

  /* ───────────── 렌더러 ───────────── */
  class PlanetRenderer {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: !!opts.preserve })
        || canvas.getContext('experimental-webgl');
      if (!gl) throw new Error('WebGL을 사용할 수 없습니다');
      this.gl = gl;
      this.slots = [];            // [{world, appearAt, fadeFrom}]
      this.drag = { x: 0, y: 0, vx: 0, vy: 0 };
      this.zoom = 1;
      this.pulse = 0;
      this.layout = () => [{ x: 0, y: 0, w: canvas.width, h: canvas.height, shift: [0, 0], fit: 0.4 }];
      this._build();
    }

    _build() {
      const gl = this.gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      gl.useProgram(p);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        this.u[info.name] = gl.getUniformLocation(p, info.name);
      }
      gl.enable(gl.SCISSOR_TEST);
    }

    // instant: 즉시 표시 / grow=false: 크기 애니메이션 없이 서서히 나타남
    setWorlds(worlds, { instant = false, grow = true } = {}) {
      const now = performance.now() / 1000;
      this.slots = worlds.map((w) => ({
        world: w,
        appearAt: instant || !grow ? now - 10 : now,
        fadeAt: instant ? now - 10 : now,
      }));
    }

    resize(w, h) {
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    }

    // 슬롯의 현재 기하 상태 (그리기와 클릭 판정이 같은 값을 쓰도록)
    _state(slot, time, vp) {
      const v = slot.world.visual;
      const pitch = BASE_PITCH + this.drag.y;
      const spinA = time * v.spin + this.drag.x;
      const tiltM = M.mul(M.rx(pitch), M.rz(v.tilt));
      const R = M.mul(tiltM, M.ry(spinA));
      const RC = M.mul(tiltM, M.ry(spinA * 1.2 + time * v.cloudSpeed));
      const age = time - slot.appearAt;
      const k = Math.min(1, Math.max(0, age / 1.6));
      const ease = 1 - Math.pow(1 - k, 4);
      const focal = (vp.fit * CAM / v.extent) * this.zoom * (0.02 + 0.98 * ease);
      const moons = v.moons.map((m) => {
        const a = m.phase + time * m.speed;
        return M.vec(M.mul(M.rx(pitch), M.rz(m.incl)), [Math.cos(a) * m.dist, 0, Math.sin(a) * m.dist]).concat(m.r);
      });
      return { R, RC, focal, alpha: Math.min(1, Math.max(0, (time - slot.fadeAt) / 0.6)), ringN: M.vec(tiltM, [0, 1, 0]), moons };
    }

    render(time) {
      const gl = this.gl;
      const W = this.canvas.width, H = this.canvas.height;
      gl.viewport(0, 0, W, H); gl.scissor(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!this.slots.length) return;
      const vps = this.layout(W, H, this.slots.length);
      this.slots.forEach((slot, i) => this._draw(slot, vps[i], time));
    }

    _draw(slot, vp, time) {
      const gl = this.gl, u = this.u, v = slot.world.visual;
      const st = this._state(slot, time, vp);
      gl.viewport(vp.x, vp.y, vp.w, vp.h);
      gl.scissor(vp.x, vp.y, vp.w, vp.h);
      const f1 = (n, x) => u[n] && gl.uniform1f(u[n], x);
      const f2 = (n, a) => u[n] && gl.uniform2fv(u[n], a);
      const f3 = (n, a) => u[n] && gl.uniform3fv(u[n], a);
      const f4 = (n, a) => u[n] && gl.uniform4fv(u[n], a);
      f2('uRes', [vp.w, vp.h]); f2('uOffset', [vp.x, vp.y]); f2('uShift', vp.shift);
      f1('uTime', time); f1('uFocal', st.focal); f1('uCamDist', CAM); f1('uAlpha', st.alpha * (vp.alpha == null ? 1 : vp.alpha));
      f1('uPulse', this.pulse);
      // 행 우선 R을 그대로 올리면 GLSL에서는 Rᵀ(월드→로컬)가 된다
      gl.uniformMatrix3fv(u.uRot, false, new Float32Array(st.R));
      gl.uniformMatrix3fv(u.uCloudRot, false, new Float32Array(st.RC));
      f3('uLight', LIGHT); f3('uLightCol', v.lightCol || [1, 0.96, 0.9]); f3('uSeedOff', v.seedOff);
      gl.uniform1i(u.uType, v.type);
      ['Deep', 'Shallow', 'Land', 'High', 'Peak', 'Atmo', 'Emit', 'CloudCol'].forEach((k) => {
        f3('u' + k, v[k.charAt(0).toLowerCase() + k.slice(1)] || [0, 0, 0]);
      });
      f1('uSea', v.sea); f1('uClouds', v.clouds); f1('uIce', v.ice); f1('uCity', v.city);
      f1('uWarp', v.warp); f1('uScale', v.scale); f1('uAtmoStr', v.atmoStr); f1('uSpec', v.spec);
      f1('uBands', v.bands); f1('uTurb', v.turb); f1('uStormSize', v.stormSize || 0.1); f3('uStorm', v.storm);
      f1('uRing', v.ring ? 1 : 0);
      if (v.ring) {
        f1('uRingSeed', v.ring.seed); f3('uRingN', st.ringN); f2('uRingR', [v.ring.inner, v.ring.outer]); f3('uRingCol', v.ring.color);
      }
      for (let i = 0; i < 3; i++) {
        const m = st.moons[i];
        f4('uMoon' + i, m || [0, 0, 0, 0]);
        f3('uMoonCol' + i, m ? v.moons[i].color : [0, 0, 0]);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 화면 좌표(캔버스 픽셀, 위쪽 원점) → 행성 표면의 로컬 좌표
    pick(cx, cy, time) {
      const W = this.canvas.width, H = this.canvas.height;
      if (!this.slots.length) return null;
      const vps = this.layout(W, H, this.slots.length);
      const fy = H - cy;
      for (let i = 0; i < this.slots.length; i++) {
        const vp = vps[i];
        if (cx < vp.x || cx > vp.x + vp.w || fy < vp.y || fy > vp.y + vp.h) continue;
        const st = this._state(this.slots[i], time, vp);
        const uvx = (cx - vp.x - 0.5 * vp.w) / vp.h - vp.shift[0];
        const uvy = (fy - vp.y - 0.5 * vp.h) / vp.h - vp.shift[1];
        const rd = norm([uvx, uvy, -st.focal]);
        const ro = [0, 0, CAM];
        const b = ro[2] * rd[2];
        const hh = b * b - CAM * CAM + 1;
        if (hh < 0) continue;
        const t = -b - Math.sqrt(hh);
        const n = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
        const local = M.vec(M.transpose(st.R), n);
        return { slot: i, world: this.slots[i].world, local, normal: n };
      }
      return null;
    }
  }

  NV.PlanetRenderer = PlanetRenderer;
  NV.LIGHT = LIGHT;
})();
