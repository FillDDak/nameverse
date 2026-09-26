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
uniform float uStarR, uSkyFocal, uSky; uniform mat3 uView;
uniform vec4 uSib[7], uSibL[7]; // 이웃 행성: 방향(시점 좌표) + 보이는 반지름(rad), 이웃 행성에서 모항성 방향 + 색 번호
uniform vec4 uStar2; uniform vec3 uStar2Col; // 두 번째 해: 방향(시점 좌표) + 보이는 반지름
uniform vec4 uComp[2], uCompC[2];            // 멀리 떨어진 동반성: 방향 + 밝기, 색
uniform vec2 uFlare; uniform vec3 uAurora; // 플레어: x 모항성 밝아짐, y 오로라 세기 / 오로라 색
uniform vec3 uLock; // 조석 고정: x 여부, y 얼음 경계(별을 마주한 정도 cos θ가 이보다 작으면 얼음), z 낮 쪽 한가운데의 달아오름
uniform vec4 uCmH, uCmI, uCmD; uniform vec3 uCmCol; // 혜성: 머리(xy, 크기, 밝기), 이온 꼬리 끝(xy, 범위, 씨앗), 먼지 꼬리 베지어(조절점, 끝)
uniform vec4 uMetA0, uMetB0, uMetA1, uMetB1; // 유성: A.xyz 시작, A.w 머리 위치(0~1), B.xyz 끝, B.w 밝기

// 3D simplex noise (Ashima Arts / Ian McEwan, MIT) — 좌표가 커져도 격자 무늬나 정밀도 깨짐이 없다
vec3 mod289(vec3 x){ return x - floor((x + 0.5)*(1.0/289.0))*289.0; }
vec4 mod289(vec4 x){ return x - floor((x + 0.5)*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289((x*34.0 + 10.0)*x); }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - 0.5;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  // 정수 나눗셈은 +0.5로 반올림 오차를 피한다 (p/49가 0.99999로 떨어지는 문제)
  vec4 j = p - 49.0*floor((p + 0.5)*(1.0/49.0));
  vec4 x_ = floor((j + 0.5)*(1.0/7.0));
  vec4 y_ = j - 7.0*x_;
  vec4 x = x_*(2.0/7.0) + (0.5/7.0 - 1.0);
  vec4 y = y_*(2.0/7.0) + (0.5/7.0 - 1.0);
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 g0 = vec3(a0.xy, h.x), g1 = vec3(a0.zw, h.y), g2 = vec3(a1.xy, h.z), g3 = vec3(a1.zw, h.w);
  vec4 nrm = 1.79284291400159 - 0.85373472095314*vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3));
  g0 *= nrm.x; g1 *= nrm.y; g2 *= nrm.z; g3 *= nrm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m*m;
  return 105.0*dot(m*m, vec4(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3)));
}

const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
#define HK 0.53

// fp: 픽셀 하나가 덮는 노이즈 공간 크기. 픽셀보다 잘게 떨리는 옥타브는 흐리게 줄여서 반짝임(에일리어싱)을 없앤다
float aa(float freq, float fp){ return clamp(1.6 - freq*fp*2.4, 0.0, 1.0); }
float fbm(vec3 p, float fp){
  float a = 0.5, s = 0.0, f = 1.0;
  for(int i = 0; i < 6; i++){ s += a*aa(f, fp)*snoise(p); p = M3*p*2.03; f *= 2.03; a *= 0.5; }
  return s;
}
float fbm3(vec3 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 3; i++){ s += a*snoise(p); p = M3*p*2.03; a *= 0.5; }
  return s;
}
// 지형 높이: 대륙(fbm) + 산맥 능선
float terrain(vec3 qw, float fp){
  float h = 0.5 + HK*fbm(qw, fp);
  float r = 1.0 - abs(snoise(qw*2.3 + 11.0));
  return h + 0.07*r*r*aa(2.3, fp)*smoothstep(uSea, uSea + 0.15, h);
}

float iSphere(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c; float b = dot(oc, rd); float h = b*b - dot(oc,oc) + r*r;
  if(h < 0.0) return -1.0; return -b - sqrt(h);
}
vec3 rotAxis(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v*c + cross(k,v)*s + k*dot(k,v)*(1.0-c); }

float ringDensity(float r, float fr){
  float x = (r - uRingR.x)/(uRingR.y - uRingR.x);
  if(x < 0.0 || x > 1.0) return 0.0;
  float band = 0.5 + 0.5*(snoise(vec3(r*18.0, uRingSeed, 0.0))*0.65 + snoise(vec3(r*55.0, uRingSeed, 1.0))*0.35*aa(55.0, fr));
  float gaps = smoothstep(-0.5, -0.28, snoise(vec3(r*6.0, uRingSeed, 2.0)));
  return clamp(band*gaps*smoothstep(0.0, 0.06, x)*smoothstep(1.0, 0.9, x)*1.35, 0.0, 0.95);
}
float ringShadow(vec3 p){
  if(uRing < 0.5) return 1.0;
  float dn = dot(uLight, uRingN); if(abs(dn) < 1e-4) return 1.0;
  float ts = -dot(p, uRingN)/dn; if(ts <= 0.0) return 1.0;
  return 1.0 - ringDensity(length(p + uLight*ts), 0.02)*0.75;
}
float moonShadow(vec3 p, vec4 m){
  if(m.w <= 0.0) return 1.0;
  vec3 oc = p - m.xyz; float bb = dot(oc, uLight);
  if(bb > 0.0) return 1.0;
  float d = length(oc - bb*uLight);
  return mix(0.12, 1.0, smoothstep(m.w*0.75, m.w*1.25, d));
}

vec3 shadePlanet(vec3 n, vec3 rd, vec3 p, float px){
  vec3 lp = uRot*n;
  float ndl = dot(n, uLight);
  float day = smoothstep(-0.12, 0.18, ndl);
  vec3 base; vec3 nb = n; vec3 emit = vec3(0.0);
  float spec = 0.0, land = 0.0, water = 0.0;
  vec3 q = lp*uScale + uSeedOff;
  float fp = px*uScale;

  if(uType == 1){
    // 가스 행성: 위도 띠 + 흐름 난류 + 소용돌이 폭풍
    vec3 sp = normalize(uStorm);
    float sd = distance(lp, sp), ss = uStormSize;
    vec3 pp = rotAxis(lp, sp, 4.5*exp(-sd*sd/(ss*ss)));
    float w1 = fbm(vec3(pp.x*1.6, pp.y*8.0, pp.z*1.6) + uSeedOff + vec3(uTime*0.012, 0.0, 0.0), px*8.0);
    float t = pp.y*uBands + w1*uTurb*0.5;
    float b1 = 0.5 + 0.5*sin(t*3.0);
    float b2 = 0.5 + 0.5*sin(t*7.3 + 1.7);
    float b3 = 0.5 + 0.5*sin(t*17.0 + 0.6);
    base = mix(uDeep, uShallow, smoothstep(0.12, 0.88, b1));
    base = mix(base, uLand, smoothstep(0.55, 0.92, b2)*0.75);
    float fine = fbm(vec3(pp.x*4.0, pp.y*22.0, pp.z*4.0) + uSeedOff*1.3 + vec3(uTime*0.02, 0.0, 0.0), px*22.0);
    base = mix(base, uHigh, smoothstep(0.1, 0.5, fine)*0.3);
    base *= 0.93 + 0.07*mix(0.5, b3, aa(17.0*uBands, px));
    float storm = smoothstep(ss, ss*0.3, sd);
    float swirl = 0.5 + 0.5*sin(sd/ss*14.0);
    base = mix(base, uPeak, storm*(0.7 + 0.25*swirl));
    base *= 0.9 + 0.2*smoothstep(1.0, 0.0, abs(lp.y));
  } else {
    // 암석 행성: 도메인 워핑 지형 + 기울기로 입체 음영(범프)
    vec3 wv = vec3(fbm3(q), fbm3(q + 5.2), fbm3(q + 9.1));
    vec3 qw = q + uWarp*0.5*wv;
    float hh = terrain(qw, fp);
    vec3 t1 = normalize(cross(lp, abs(lp.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(lp, t1);
    float el = max(px*1.5, 0.0025);
    float h1 = terrain(qw + t1*el*uScale, fp);
    float h2 = terrain(qw + t2*el*uScale, fp);
    vec2 gr = vec2(h1 - hh, h2 - hh)/el;
    float bump = 0.0;

    if(uType == 2){
      // 용암·수정: 식은 지각 사이로 빛나는 균열과 호수
      float rr = 1.0 - abs(snoise(qw*2.3 + 3.0));
      float crack = smoothstep(0.88, 0.985, rr)*aa(2.3*6.0, fp)*(1.0 - smoothstep(0.55, 0.75, hh));
      // 조석 고정된 용암 행성: 별을 마주한 낮 쪽은 넓은 마그마 바다, 밤 쪽은 식어 굳은 지각
      float seaL = uSea + (uLock.x > 0.5 ? 0.3*max(ndl, 0.0) : 0.0);
      float lakes = smoothstep(seaL, seaL - 0.05, hh);
      base = mix(uDeep, uShallow, smoothstep(0.3, 0.7, hh));
      base = mix(base, uLand, smoothstep(0.58, 0.75, hh)*0.7);
      base *= 0.8 + 0.4*(0.5 + 0.5*snoise(qw*7.0)*aa(7.0, fp));
      // 수정 행성(반사가 강한 쪽)은 호수 대신 결정 틈만 빛난다
      float glow = max(crack*1.1, lakes*(1.0 - 0.7*step(0.5, uSpec)));
      if(uLock.x > 0.5) glow *= smoothstep(-0.45, 0.1, ndl);
      float flick = 0.85 + 0.15*sin(uTime*1.7 + hh*30.0);
      vec3 hot = mix(uEmit, vec3(1.0, 0.93, 0.65), 0.55);
      emit = mix(uEmit, hot, glow*glow)*glow*flick*(1.0 + uPulse*0.6)*1.15;
      base *= 1.0 - 0.85*min(glow, 1.0);
      spec = uSpec*(1.0 - lakes);
      bump = 0.35*(1.0 - lakes);
    } else {
      if(hh < uSea){
        float d = (uSea - hh)/max(uSea, 0.01);
        base = mix(uShallow, uDeep, smoothstep(0.0, 0.3, d));
        base = mix(base, uShallow*1.2, smoothstep(0.05, 0.0, d)*0.5);
        spec = 1.0; water = 1.0;
      } else {
        // 고도는 절대값으로 본다: 바다가 거의 없는 행성에서도 산꼭대기는 드물게
        float lo = max(uSea, 0.4);
        float m = 0.5 + 0.5*snoise(q*0.9 + 17.0);
        vec3 lowC = mix(uLand, uLand*vec3(1.12, 1.04, 0.85) + vec3(0.03, 0.02, 0.0), (1.0 - m)*0.5);
        base = mix(lowC, uHigh, smoothstep(lo + 0.03, 0.68, hh + (1.0 - m)*0.02));
        base = mix(base, uPeak, smoothstep(0.7, 0.82, hh));
        base = mix(base, mix(uPeak, uLand, 0.4)*1.08, smoothstep(uSea + 0.012, uSea, hh)*step(0.25, uSea)*0.5);
        base = mix(base, uHigh*0.8, clamp(length(gr)*0.1, 0.0, 1.0)*0.4);
        land = 1.0; bump = 0.28;
      }
      float lat = abs(lp.y) + (hh - 0.5)*0.35 + 0.03*snoise(q*5.0);
      float ice = smoothstep(uIce - 0.015, uIce + 0.035, lat);
      if(uLock.x > 0.5){
        // 조석 고정: 극지방 대신, 별을 마주한 한가운데에서 멀어져 물이 어는 온도보다 차가워진 곳부터 얼어붙는다.
        // 높은 땅이 먼저 얼고, 경계는 조금 들쭉날쭉하게
        float s = ndl - (hh - 0.5)*0.25 + 0.05*snoise(q*4.0);
        ice = smoothstep(uLock.y + 0.03, uLock.y - 0.05, s);
        // 별을 마주한 곳이 900K를 넘으면 암석이 붉게 달아오른다
        emit += vec3(1.0, 0.36, 0.12)*uLock.z*pow(max(ndl, 0.0), 1.5)*(0.7 + 0.3*(1.0 - hh))*0.5;
      }
      base = mix(base, vec3(0.9, 0.94, 1.0), ice);
      spec *= 1.0 - ice; land *= 1.0 - ice; water *= 1.0 - ice;
      bump = mix(bump, 0.12, ice);
      if(uType == 3){
        // 빙하 행성의 바다는 얼어붙은 해빙처럼
        base = mix(base, vec3(0.86, 0.92, 1.0), water*0.4);
        spec *= 0.3;
        float rr = 1.0 - abs(snoise(qw*3.1 + 7.0));
        base = mix(base, uEmit, smoothstep(0.9, 0.99, rr)*0.3*aa(3.1*6.0, fp));
        bump = 0.15;
      }
      if(uCity > 0.0){
        // 밤의 도시 불빛: 인구는 해안과 저지대에 몰리고, 멀리서는 은은한 빛, 가까이 보면 점점이 흩어진 불빛
        float coast = smoothstep(0.08, 0.0, hh - uSea);
        float lowland = smoothstep(0.66, 0.5, hh);
        float reg = fbm3(lp*3.5 + uSeedOff.yzx*0.3);
        float dens = smoothstep(-0.05, 0.4, reg + coast*0.3)*lowland*land;
        float n1 = snoise(lp*55.0 + uSeedOff), n2 = snoise(lp*170.0 + uSeedOff.zxy);
        float sp = mix(0.22, smoothstep(0.15, 0.7, n1), aa(55.0, px))*mix(0.3, smoothstep(0.2, 0.85, n2), aa(170.0, px));
        emit += vec3(1.0, 0.68, 0.34)*dens*(sp*3.2 + 0.04)*uCity*(1.0 - day)*1.5;
      }
    }
    vec3 nl = normalize(lp - bump*(gr.x*t1 + gr.y*t2)*0.11);
    nb = nl*uRot;
  }

  float cloud = 0.0;
  if(uClouds > 0.01){
    // 위도 방향으로 눌러서 바람을 따라 길게 늘어진 구름
    vec3 cn = uCloudRot*n;
    vec3 cq = vec3(cn.x, cn.y*1.7, cn.z)*2.0 + uSeedOff*1.7;
    float cw = fbm3(cq*1.2);
    float cb = fbm(cq + vec3(cw*0.9, cw*0.2, cw*0.7), px*2.0);
    float cd = fbm3(cq*5.0 + 3.0)*aa(5.0*2.0, px*2.0);
    float cv = 0.5 + HK*(cb + cd*0.22);
    float th = mix(0.72, 0.5, uClouds);
    cloud = smoothstep(th, th + 0.2, cv)*0.92;
    // 조석 고정된 행성에서는 별을 마주한 곳에 두꺼운 구름이 뭉친다(강한 상승 기류)
    if(uLock.x > 0.5) cloud = max(cloud, smoothstep(0.55, 0.95, ndl + 0.3*(cv - 0.5))*0.75*min(1.0, uClouds*2.0));
  }

  float sh = ringShadow(p)*moonShadow(p, uMoon0)*moonShadow(p, uMoon1)*moonShadow(p, uMoon2);
  float term = smoothstep(-0.1, 0.15, ndl);
  float dl = max(dot(nb, uLight), 0.0)*term*sh;
  vec3 lightCol = uLightCol*(1.0 + 0.5*uFlare.x); // 플레어가 일어나면 행성도 잠깐 더 밝게 비춘다
  vec3 c = base*(dl*1.15 + 0.015)*lightCol*(1.0 - cloud*0.3);
  float mu = max(dot(n, -rd), 0.0);
  if(uType == 1) c *= mix(0.55, 1.0, sqrt(mu));
  vec3 hv = normalize(uLight - rd);
  float nh = max(dot(n, hv), 0.0);
  float fres = 0.02 + 0.98*pow(1.0 - mu, 5.0);
  c += lightCol*spec*(pow(nh, 90.0)*1.1 + pow(nh, 12.0)*0.06)*sh*term*(1.0 - cloud);
  c += uAtmo*water*fres*0.12*term;
  c += emit*(1.0 - cloud*0.75);
  c = mix(c, uCloudCol*lightCol*(max(ndl, 0.0)*1.15*sh + 0.02), cloud*0.95);
  if(uFlare.y > 0.001){
    // 오로라: 자전축 극 둘레의 고리(구름보다 높은 곳). 활동이 셀수록 적도 쪽으로 내려오고 커튼처럼 일렁인다. 밤 쪽에서 잘 보인다
    vec3 lq = uRot*n;
    float colat = acos(clamp(abs(lq.y), 0.0, 1.0));
    float wob = 0.06*snoise(vec3(lq.x*3.0, lq.z*3.0, uTime*0.15 + step(0.0, lq.y)*7.0));
    float dd = colat - (0.3 + 0.28*uFlare.y) - wob;
    float band = exp(-dd*dd/0.0035) + 0.35*exp(-dd*dd/0.03);
    float curtain = 0.5 + 0.5*snoise(vec3(lq.x*16.0, lq.z*16.0, uTime*0.45));
    c += uAurora*band*(0.35 + 0.65*curtain)*uFlare.y*(1.0 - day*0.8)*1.4;
  }

  // 대기: 가장자리로 갈수록 두꺼워지고, 낮과 밤 경계는 노을빛
  float path = 1.0/(mu*0.9 + 0.1);
  float haze = 1.0 - exp(-0.05*uAtmoStr*path);
  float atmL = smoothstep(-0.3, 0.45, ndl);
  vec3 sunset = mix(vec3(1.0, 0.55, 0.35), vec3(1.0), smoothstep(-0.05, 0.3, ndl));
  float fwdS = pow(max(dot(rd, uLight), 0.0), 6.0);
  vec3 air = uAtmo*lightCol*(sunset*atmL + fwdS*1.4)*(1.0 + uPulse*0.8);
  c = c*(1.0 - haze*0.5) + air*haze*1.2;
  return c;
}

// 유성: 밤 쪽 대기에 잠깐 그어지는 빛줄기. 머리가 A→B로 달리고 뒤로 짧은 꼬리가 남는다
vec3 meteor(vec3 n, float px, vec4 A, vec4 B){
  if(B.w <= 0.0) return vec3(0.0);
  vec3 hd = mix(A.xyz, B.xyz, A.w);
  vec3 tl = mix(A.xyz, B.xyz, max(A.w - 0.5, 0.0));
  vec3 ab = hd - tl;
  float s = clamp(dot(n - tl, ab)/max(dot(ab, ab), 1e-9), 0.0, 1.0);
  vec3 dv = n - tl - ab*s;
  float w = max(px*0.6, 0.0008);
  float d2 = dot(dv, dv)/(w*w);
  float h2 = dot(n - hd, n - hd)/(w*w);
  // 꼬리는 주황빛으로 식어 가고, 머리는 금속이 타는 초록빛 흰색
  vec3 tc = mix(vec3(1.0, 0.5, 0.2), vec3(0.8, 1.0, 0.85), s*s);
  return (tc*exp(-d2)*pow(s, 1.5)*2.4 + vec3(0.85, 1.0, 0.9)*(exp(-h2*0.6)*1.8 + exp(-h2*0.05)*0.12))*B.w;
}

void traceMoon(vec3 ro, vec3 rd, vec4 m, vec3 mc, float idx, inout float tBest, inout vec3 oc, inout float oa){
  if(m.w <= 0.0) return;
  float t = iSphere(ro, rd, m.xyz, m.w);
  if(t > 0.0 && t < tBest){
    vec3 p = ro + rd*t; vec3 n = normalize(p - m.xyz);
    float f = 0.5 + 0.5*fbm3(n*3.0 + idx*7.0);
    vec3 col = mc*(0.55 + 0.7*f);
    col *= 1.0 - 0.28*smoothstep(0.3, 0.6, snoise(n*5.0 + idx*3.0));
    float d = max(dot(n, uLight), 0.0);
    float sh = iSphere(p, uLight, vec3(0.0), 1.0) > 0.0 ? 0.04 : 1.0;
    oc = col*(d*sh*1.15 + 0.012);
    oa = 1.0; tBest = t;
  }
}

// 하늘: 무한히 먼 별 (천구 위 격자마다 별 하나) + 은하수
float h31(vec3 p){ p = fract(p*vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y)*p.z); }
vec3 starLayer(vec3 d, float sc, float ap, float dens, float gain){
  vec3 c = floor(d*sc);
  float h = h31(c);
  if(h > dens) return vec3(0.0);
  vec3 sdir = normalize(c + vec3(h31(c + 17.1), h31(c + 31.7), h31(c + 47.3))*0.7 + 0.15);
  float a = length(cross(d, sdir));
  float w = ap*0.85;
  float b = h31(c + 71.9); b = b*b*b*b*b*b;
  vec3 tint = mix(vec3(1.0), mix(vec3(1.0, 0.8, 0.62), vec3(0.7, 0.8, 1.0), h31(c + 93.1)), 0.6);
  float tw = 0.85 + 0.15*sin(uTime*(1.0 + 3.0*h) + h*40.0);
  return tint*exp(-a*a/(w*w))*(0.1 + 2.2*b)*gain*tw;
}
vec3 skyColor(vec3 d, float ap){
  float gl = dot(d, normalize(vec3(0.25, 0.92, 0.3)));
  float band = exp(-gl*gl/0.018);
  float cl = 0.5 + 0.5*fbm3(d*3.2 + 7.0);
  float dust = smoothstep(0.35, 0.75, 0.5 + 0.5*fbm3(d*7.0 + 3.0));
  vec3 mw = mix(vec3(0.5, 0.48, 0.62), vec3(0.78, 0.64, 0.5), cl)*band*(0.3 + 0.7*cl)*(1.0 - 0.65*dust)*0.06;
  // 무한히 먼 배경 별 두 겹(하늘 전체) + 은하수 띠의 별 먼지. 가까운 또렷한 별은 2D 별밭이 그린다
  return starLayer(d, 120.0, ap, 0.09, 0.5) + starLayer(d, 240.0, ap, 0.07 + band*0.2, 0.3) + starLayer(d, 330.0, ap, band*0.35, 0.25) + mw;
}

// 멀리 떨어진 동반성: 하늘에서 가장 밝은 별처럼 (또렷한 점 + 옅은 번짐)
vec3 companions(vec3 d, float ap){
  vec3 c = vec3(0.0);
  for(int i = 0; i < 2; i++){
    vec4 s = uComp[i];
    if(s.w <= 0.0) break;
    float x = length(d - s.xyz)/ap;
    if(x > 80.0) continue;
    c += uCompC[i].rgb*s.w*(exp(-x*x/1.3)*1.8 + 0.1*pow(1.0 + x/2.5, -2.2));
  }
  return c;
}

// 이웃 행성: 모항성 빛을 받아 초승달~보름달로 보이는 원반. 너무 작으면 밝은 점
vec3 sibColor(float k){
  return k < 0.5 ? vec3(0.86, 0.76, 0.6) : k < 1.5 ? vec3(0.62, 0.8, 0.92) : k < 2.5 ? vec3(0.42, 0.24, 0.18)
       : k < 3.5 ? vec3(0.8, 0.6, 0.42) : k < 4.5 ? vec3(0.55, 0.7, 0.88) : vec3(0.92, 0.95, 1.0);
}
vec3 siblings(vec3 d, float ap){
  vec3 c = vec3(0.0);
  for(int i = 0; i < 7; i++){
    vec4 s = uSib[i];
    if(s.w <= 0.0) break;
    float cd = dot(d, s.xyz);
    if(cd < 0.995) continue;
    vec3 x = d - s.xyz*cd;
    float rr = length(x), rho = s.w;
    vec3 L = uSibL[i].xyz, col = sibColor(uSibL[i].w)*uLightCol;
    if(rho > ap*1.5){
      // 원반: 보는 쪽 반구의 법선으로 모항성 빛을 받는 정도를 계산 (가장자리는 한 픽셀에 걸쳐 부드럽게)
      float r = rr/rho;
      float edge = smoothstep(1.0, 1.0 - ap/rho, r);
      vec3 n = x/rho - s.xyz*sqrt(max(0.0, 1.0 - r*r));
      c += col*max(dot(n, L), 0.0)*1.15*edge;
    } else {
      // 점: 밝은 면이 보이는 비율만큼. 아주 작아도 밝은 별처럼은 보이게 한다
      float ph = 0.5 + 0.5*dot(L, -s.xyz);
      float b = max(rho*rho/(ap*ap)*1.3, 0.35)*ph;
      c += col*b*exp(-rr*rr/(ap*ap*0.9))*1.8;
    }
  }
  return c;
}

// 혜성 (하늘 uv 공간). 모항성 반대쪽으로 곧게 뻗는 푸른 이온 꼬리 가닥들과, 궤도 뒤로 휘며 넓게 퍼지는 먼지 꼬리
float hash1(float n){ return fract(sin(n)*43758.5453); }
vec3 comet(vec2 uv, float ap){
  vec2 h = uCmH.xy, d0 = uv - h;
  if(uCmH.w <= 0.0 || dot(d0, d0) > uCmI.z*uCmI.z) return vec3(0.0);
  float r = max(uCmH.z, ap*0.8), sd = uCmI.w;
  // 꼬리 근처가 아닌 픽셀은 바로 건너뛴다 (이온 꼬리 선분, 먼지 꼬리 현에서 휜 정도 + 최대 폭보다 멀면)
  vec2 ia = uCmI.xy - h, da = uCmD.zw - h;
  float di = length(d0 - ia*clamp(dot(d0, ia)/max(dot(ia, ia), 1e-9), 0.0, 1.0));
  float dd = length(d0 - da*clamp(dot(d0, da)/max(dot(da, da), 1e-9), 0.0, 1.0)) - length(uCmD.xy - 0.5*(h + uCmD.zw));
  if(min(di - r*18.0, dd - r*45.0) > ap*4.0 && length(d0) > r*16.0) return vec3(0.0);
  vec3 c = vec3(0.0);
  // 이온 꼬리: 항성풍에 흔들리는 가는 가닥 여러 개. 물결과 밝은 매듭이 천천히 바깥으로 흘러간다
  vec2 ax = uCmI.xy - h; float L = max(length(ax), 1e-5);
  vec2 dir = ax/L, nr = vec2(-dir.y, dir.x);
  float u = dot(d0, dir)/L, v = dot(d0, nr);
  if(u > 0.0 && u < 1.0){
    float fade = pow(1.0 - u, 1.3)*smoothstep(0.0, 0.05, u);
    float ion = 0.0;
    for(int k = 0; k < 5; k++){
      float fk = float(k), hk = hash1(sd*1.7 + fk*13.1);
      float spread = k == 0 ? 0.0 : (hk - 0.5)*0.16;
      float wave = sin(u*(3.0 + 3.0*hk)*6.2832 - uTime*(0.35 + 0.25*hk) + hk*30.0)*(0.008 + 0.012*hk)*u;
      float off = (spread*u + wave)*L;
      float w = r*(0.3 + u*1.6) + ap*0.7;
      float knot = 0.55 + 0.45*sin(u*(7.0 + 5.0*hk) - uTime*(0.6 + 0.4*hk) + fk*2.1);
      float x = (v - off)/w;
      ion += exp(-x*x)*(k == 0 ? 1.0 : 0.3 + 0.45*hk)*knot*(ap*0.7/w + 0.3);
    }
    float gw = r*(1.0 + u*7.0) + ap;
    c += vec3(0.32, 0.58, 1.0)*(ion*0.9 + exp(-v*v/(gw*gw))*0.12)*fade;
  }
  // 먼지 꼬리: 2차 베지어 중심선을 따라 넓어지는 부채꼴. 휘어진 바깥쪽이 또렷하고, 안쪽은 흐리게 번진다. 옅은 줄무늬
  vec2 C = uCmD.xy, E = uCmD.zw, ch = E - h;
  float Ld = max(length(ch), 1e-5);
  float t0 = dot(d0, ch)/(Ld*Ld), t = clamp(t0, 0.0, 1.0);
  vec2 B = mix(mix(h, C, t), mix(C, E, t), t);
  vec2 Bt = (1.0 - t)*(C - h) + t*(E - C);
  vec2 bn = normalize(vec2(-Bt.y, Bt.x) + 1e-6);
  float side = dot(uv - B, bn)*sign(dot(C - 0.5*(h + E), bn) + 1e-6); // 양수: 이온 꼬리 쪽(덜 휜 가장자리)
  float w = r*(1.0 + t*15.0) + ap;
  float prof = side > 0.0 ? exp(-pow(side/(w*0.4), 2.0)) : exp(-pow(side/(w*1.3), 2.0));
  float stri = 0.8 + 0.2*sin(side/w*5.0 - t*4.0 + sd);
  float fadeD = pow(1.0 - t, 1.6)*smoothstep(0.0, 0.03, t0)*smoothstep(1.0, 0.9, t0);
  c += uCmCol*prof*stri*fadeD*0.9*min(1.0, 3.0*r/w + 0.25);
  // 코마(모항성 쪽으로 부푼 초록빛 기체)와 핵
  float dc = length(uv - (h - dir*r*0.9)), dn = length(d0);
  c += vec3(0.5, 1.0, 0.68)*(exp(-pow(dc/(r*2.4), 2.0))*0.7 + exp(-pow(dn/(r*7.0), 2.0))*0.14);
  c += exp(-pow(dn/max(r*0.45, ap*0.9), 2.0))*1.4;
  return (1.0 - exp(-c))*uCmH.w;
}

// 별의 빛번짐과 회절 빛줄기 (렌즈에서 생기므로 행성 위에도 겹친다). 별이 행성 뒤로 숨으면 함께 사라진다. k: 세기
vec3 starFlare(vec3 sdir, float r0, vec3 hue, vec2 uv, vec3 ro, float k){
  if(sdir.z >= 0.0) return vec3(0.0);
  vec2 uvStar = sdir.xy/(-sdir.z)*uSkyFocal;
  vec2 dv = uv - uvStar;
  float rS = r0*uSkyFocal;
  vec3 rdc = normalize(vec3(uvStar, -uFocal));
  float bc = dot(ro, rdc);
  float dc = sqrt(max(dot(ro, ro) - bc*bc, 0.0));
  float m = r0*uCamDist + 0.004;
  float vis = smoothstep(1.0 - m, 1.0 + m, dc);
  float L = length(dv);
  float wing = 0.35*pow(1.0 + L/(rS*1.5 + 0.002), -1.8) + 0.03*pow(1.0 + L/0.05, -1.5);
  float ang = 0.42;
  vec2 q = vec2(cos(ang)*dv.x - sin(ang)*dv.y, sin(ang)*dv.x + cos(ang)*dv.y);
  float pw = 0.9/uRes.y;
  vec3 sl = (rS*2.0 + 0.004)*vec3(1.12, 1.0, 0.88);
  vec2 aq = abs(q);
  float wx = pw*pw/((aq.y + pw)*(aq.y + pw)), wy = pw*pw/((aq.x + pw)*(aq.x + pw));
  vec3 spikes = (wx*pow(1.0 + aq.x/sl, vec3(-1.25))*exp(-aq.x/(sl*18.0)) + wy*pow(1.0 + aq.y/sl, vec3(-1.25))*exp(-aq.y/(sl*18.0)))*0.6;
  return 1.0 - exp(-(hue*wing + spikes*mix(hue, vec3(1.0), 0.5))*vis*k);
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
  float g = exp(-max(dist - 1.0, 0.0)*11.0)*smoothstep(0.97, 1.0, dist);
  float ldot = dot(normalize(cp), uLight);
  float lightF = smoothstep(-0.6, 0.8, ldot);
  vec3 haloCol = uAtmo*mix(vec3(1.0, 0.6, 0.4), vec3(1.0), smoothstep(-0.2, 0.4, ldot))*uLightCol;
  float fwd = pow(max(dot(rd, uLight), 0.0), 6.0);
  float glow = g*(lightF*0.6 + fwd*1.6)*uAtmoStr*(1.0 + uPulse*0.9);
  vec3 col = haloCol*glow;
  float alpha = glow;

  float tBest = 1e9; vec3 oc = vec3(0.0); float oa = 0.0;
  float h = b*b - dot(ro, ro) + 1.0;
  if(h > 0.0){
    float t = -b - sqrt(h);
    vec3 p = ro + rd*t;
    vec3 pc = shadePlanet(normalize(p), rd, p, px);
    pc += meteor(normalize(p), px, uMetA0, uMetB0) + meteor(normalize(p), px, uMetA1, uMetB1);
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
        float r = length(hp);
        float fr = px/max(abs(dn), 0.08);
        float d = ringDensity(r, fr);
        if(d > 0.0){
          vec3 rc = uRingCol*(0.75 + 0.5*mix(0.5, 0.5 + 0.5*snoise(vec3(r*90.0, uRingSeed, 3.0)), aa(90.0, fr)));
          float shadow = iSphere(hp, uLight, vec3(0.0), 1.0) > 0.0 ? 0.1 : 1.0;
          rc *= (0.3 + 0.7*abs(dot(uRingN, uLight)))*shadow*uLightCol;
          rc = 1.0 - exp(-rc*1.25);
          col = rc*d + col*(1.0 - d);
          alpha = d + alpha*(1.0 - d);
        }
      }
    }
  }
  // 모항성과 하늘은 무한히 멀다: 카메라가 다가가도(확대) 크기와 위치가 변하지 않는다
  vec3 rdS = normalize(vec3(uv, -uSkyFocal));
  float apS = 1.0/(uRes.y*uSkyFocal);
  vec3 tint = clamp((uLightCol - 0.45)/0.55, 0.0, 1.0); // 별 본래 색 (uLightCol은 흰색 쪽에 섞은 조명용 값)
  // 모항성: 망원경 사진 속 별처럼 (Moffat 분포). 가운데는 하얗게 포화되고, 바깥으로 갈수록 별 색이 드러나며 퍼진다
  float sd = 2.0*asin(clamp(length(rdS - uLight)*0.5, 0.0, 1.0));
  float r0 = max(uStarR, apS*1.5);
  float rf = r0*(1.0 + 0.8*uFlare.x); // 플레어 때는 포화된 빛이 번져 별이 커 보인다
  float q2 = sd*sd/(rf*rf);
  // 빛의 파장마다 퍼짐이 조금씩 달라서 가장자리에 옅은 색 테가 생긴다
  // 플레어: 별이 확 밝아지며 푸르스름한 흰색으로 (플레어는 표면보다 훨씬 뜨겁다)
  vec3 core = vec3(pow(1.0 + q2/1.1, -2.4), pow(1.0 + q2, -2.4), pow(1.0 + q2/0.9, -2.4))*6.0*(1.0 + 2.0*uFlare.x);
  vec3 hue = mix(mix(tint, vec3(1.0), 0.2), vec3(0.85, 0.92, 1.0), uFlare.x*0.6);
  vec3 coreC = 1.0 - exp(-core*hue);
  float coreA = min(1.0, max(coreC.r, max(coreC.g, coreC.b)));
  col += coreC*(1.0 - alpha);
  alpha += coreA*(1.0 - alpha);
  vec3 hue2 = mix(clamp((uStar2Col - 0.45)/0.55, 0.0, 1.0), vec3(1.0), 0.2);
  if(uStar2.w > 0.0){
    // 두 번째 해 (두 별을 함께 도는 행성의 하늘): 모항성과 같은 모양, 더 작고 차가운 별
    float sd2 = 2.0*asin(clamp(length(rdS - uStar2.xyz)*0.5, 0.0, 1.0));
    float r2 = max(uStar2.w, apS*1.5), qq = sd2*sd2/(r2*r2);
    vec3 c2 = vec3(pow(1.0 + qq/1.1, -2.4), pow(1.0 + qq, -2.4), pow(1.0 + qq/0.9, -2.4))*5.0 + 0.12*pow(1.0 + sd2/(r2*3.0), -1.8);
    c2 = 1.0 - exp(-c2*hue2);
    col += c2*(1.0 - alpha);
    alpha += min(1.0, max(c2.r, max(c2.g, c2.b)))*(1.0 - alpha);
  }
  if(uSky > 0.5 && alpha < 0.999){
    vec3 sky = skyColor(uView*rdS, apS) + comet(uv, apS) + siblings(rdS, apS) + companions(rdS, apS);
    col += sky*(1.0 - alpha);
    alpha += min(1.0, max(sky.r, max(sky.g, sky.b)))*(1.0 - alpha);
  }
  // 넓게 번지는 빛과 회절 빛줄기는 렌즈에서 생기므로 행성 위에도 겹친다. 두 번째 해가 있으면 더 약하게 함께
  vec3 flare = starFlare(uLight, r0*(1.0 + 2.5*uFlare.x), hue, uv, ro, 1.0 + 2.0*uFlare.x);
  if(uStar2.w > 0.0) flare = 1.0 - (1.0 - flare)*(1.0 - starFlare(uStar2.xyz, max(uStar2.w, apS*1.5), hue2, uv, ro, 0.5));
  // 멀리 떨어진 동반성: 어떤 별보다도 훨씬 밝아서(보름달급) 약한 빛줄기가 생긴다
  for(int i = 0; i < 2; i++){
    if(uComp[i].w <= 0.0) break;
    flare = 1.0 - (1.0 - flare)*(1.0 - starFlare(uComp[i].xyz, apS*1.5, mix(uCompC[i].rgb, vec3(1.0), 0.3), uv, ro, 0.28*uComp[i].w));
  }
  col += flare*(1.0 - col);
  alpha = max(alpha, min(1.0, max(flare.r, max(flare.g, flare.b))));

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
  // 확대/축소는 카메라가 실제로 다가가고 물러나는 것(달리 줌). 별 공간에서는 그 이동을 STAR_DOLLY배로 키워
  // 가까운 별은 크게, 먼 별은 조금, 은하수와 모항성(무한히 멂)은 전혀 움직이지 않는 연속된 깊이감을 만든다
  const STAR_DOLLY = 7;
  // 단, 물러날 때는 별 공간의 카메라가 가장 가까운 별들(행성에서 36~40 이상) 안쪽에 머물도록 한다.
  // 별들은 행성을 중심으로 흩어져 있어서, 그 바깥까지 나가면 별 무리를 밖에서 보게 되어 행성 주변에 몰려 보인다.
  // 축소 배율의 로그에 대해 처음엔 빠르게, 끝으로 갈수록 천천히(멈추지는 않게) 물러나 최대 축소(0.06)에서 약 25에 이른다
  const starCam = (zoom, camDist) => (zoom >= 1 ? CAM + (camDist - CAM) * STAR_DOLLY : CAM + 8 * Math.log(1 + 3.75 * Math.log(1 / zoom)));
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
      this.cam = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 }; // 행성 주위를 도는 시점
      this.meteors = []; this.metNext = 0;
      this.comet = null; // 별밭(Starfield)이 계산한 혜성의 화면 좌표
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
      // 시점 회전 V: 카메라를 돌리는 대신 장면 전체(행성·고리·위성·빛)를 반대로 돌린다
      const V = M.mul(M.rx(this.cam.pitch), M.ry(this.cam.yaw));
      const tiltM = M.mul(V, M.mul(M.rx(pitch), M.rz(v.tilt)));
      const R = M.mul(tiltM, M.ry(spinA));
      const RC = M.mul(tiltM, M.ry(spinA * 1.2 + time * v.cloudSpeed));
      const age = time - slot.appearAt;
      const k = Math.min(1, Math.max(0, age / 1.6));
      const ease = 1 - Math.pow(1 - k, 4);
      const camDist = CAM / this.zoom;
      const focal = (vp.fit * CAM / v.extent) * (0.02 + 0.98 * ease);
      const moons = v.moons.map((m) => {
        const a = m.phase + time * m.speed;
        return M.vec(M.mul(V, M.mul(M.rx(pitch), M.rz(m.incl))), [Math.cos(a) * m.dist, 0, Math.sin(a) * m.dist]).concat(m.r);
      });
      return { R, RC, focal, alpha: Math.min(1, Math.max(0, (time - slot.fadeAt) / 0.6)), ringN: M.vec(tiltM, [0, 1, 0]), moons, light: M.vec(V, LIGHT), V,
        // 하늘은 무한히 멀어 카메라가 움직여도 그대로다. 도착할 때 행성이 커지는 연출도 따라가지 않는다
        skyFocal: vp.fit * CAM / v.extent, camDist };
    }

    render(time) {
      const gl = this.gl;
      const W = this.canvas.width, H = this.canvas.height;
      gl.viewport(0, 0, W, H); gl.scissor(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!this.slots.length) return;
      const vps = this.layout(W, H, this.slots.length);
      if (vps[0] && vps[0].sky) { this._updateMeteors(this.slots[0], vps[0], time); this._updateFlare(this.slots[0], time); }
      else { this.meteors = []; this.flareNow = [0, 0]; }
      this.slots.forEach((slot, i) => this._draw(slot, vps[i], time, i === 0 && vps[i].sky));
    }

    /* 적색왜성의 플레어: 실제 광도 곡선처럼 빠르게(0.6초) 치솟고 몇 초에 걸쳐 천천히 식는다.
     * 뒤이어 오로라가 번졌다가 20초쯤에 걸쳐 사라진다. 도착 10~25초 뒤 처음, 이후 45~120초마다 */
    _updateFlare(slot, time) {
      const v = slot.world.visual;
      if (this.flareWorld !== slot.world.key) { this.flareWorld = slot.world.key; this.flareAt = null; this.flareNext = time + 10 + Math.random() * 15; }
      if (!v.flare) { this.flareNow = [0, 0]; return; }
      if (time > this.flareNext) { this.flareAt = time; this.flareAmp = 0.55 + Math.random() * 0.45; this.flareNext = time + 45 + Math.random() * 75; }
      if (this.flareAt == null) { this.flareNow = [0, 0]; return; }
      const t = time - this.flareAt, A = this.flareAmp;
      const star = t < 0.6 ? (t / 0.6) * (t / 0.6) : Math.exp(-(t - 0.6) / 2.8);
      const x = Math.min(1, Math.max(0, (t - 2.5) / 3)), aur = x * x * (3 - 2 * x) * Math.exp(-Math.max(0, t - 5.5) / 9);
      this.flareNow = [A * star, A * aur];
    }

    /* 유성: 카메라에서 보이는 행성의 밤 쪽 대기에 드물게 그어진다.
     * 실제 유성 자국보다는 조금 길게(반지름의 3~7%) 그렸고, 가끔 더 밝고 긴 화구(fireball)가 떨어진다 */
    _updateMeteors(slot, vp, time) {
      const st = this._state(slot, time, vp);
      if (st.alpha < 1) { this.metNext = time + 3; return; }
      if (time > this.metNext) {
        this.metNext = time + 2 + Math.random() * 5;
        const L = st.light;
        for (let k = 0; k < 16; k++) {
          const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
          const n = [rr * Math.cos(th), rr * Math.sin(th), u];
          // 카메라를 향한 쪽(가장자리 제외)이면서 해가 진 쪽
          if (n[2] < 0.3 || n[0] * L[0] + n[1] * L[1] + n[2] * L[2] > -0.12) continue;
          const fire = Math.random() < 0.1;
          const r = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
          const tg = norm([n[1] * r[2] - n[2] * r[1], n[2] * r[0] - n[0] * r[2], n[0] * r[1] - n[1] * r[0]]);
          const len = fire ? 0.09 + Math.random() * 0.07 : 0.03 + Math.random() * 0.04;
          const b = norm([n[0] + tg[0] * len, n[1] + tg[1] * len, n[2] + tg[2] * len]);
          const Vt = M.transpose(st.V); // 시점을 돌려도 행성에 붙어 있도록 월드 좌표로 저장
          this.meteors.push({ a: M.vec(Vt, n), b: M.vec(Vt, b), t0: time,
            dur: fire ? 1.1 + Math.random() * 0.7 : 0.35 + Math.random() * 0.45, bright: fire ? 2.2 : 0.7 + Math.random() * 0.6 });
          break;
        }
      }
      this.meteors = this.meteors.filter((m) => time - m.t0 < m.dur + 0.4).slice(-2);
    }

    _draw(slot, vp, time, meteors) {
      const gl = this.gl, u = this.u, v = slot.world.visual;
      const st = this._state(slot, time, vp);
      gl.viewport(vp.x, vp.y, vp.w, vp.h);
      gl.scissor(vp.x, vp.y, vp.w, vp.h);
      const f1 = (n, x) => u[n] && gl.uniform1f(u[n], x);
      const f2 = (n, a) => u[n] && gl.uniform2fv(u[n], a);
      const f3 = (n, a) => u[n] && gl.uniform3fv(u[n], a);
      const f4 = (n, a) => u[n] && gl.uniform4fv(u[n], a);
      f2('uRes', [vp.w, vp.h]); f2('uOffset', [vp.x, vp.y]); f2('uShift', vp.shift);
      f1('uTime', time); f1('uFocal', st.focal); f1('uCamDist', st.camDist); f1('uAlpha', st.alpha * (vp.alpha == null ? 1 : vp.alpha));
      f1('uPulse', this.pulse);
      // 행 우선 R을 그대로 올리면 GLSL에서는 Rᵀ(월드→로컬)가 된다
      gl.uniformMatrix3fv(u.uRot, false, new Float32Array(st.R));
      gl.uniformMatrix3fv(u.uCloudRot, false, new Float32Array(st.RC));
      f3('uLight', st.light); f1('uStarR', v.starAng || 0.006);
      f1('uSkyFocal', st.skyFocal); f1('uSky', vp.sky ? 1 : 0);
      gl.uniformMatrix3fv(u.uView, false, new Float32Array(st.V)); f3('uLightCol', v.lightCol || [1, 0.96, 0.9]); f3('uSeedOff', v.seedOff);
      gl.uniform1i(u.uType, v.type);
      ['Deep', 'Shallow', 'Land', 'High', 'Peak', 'Atmo', 'Emit', 'CloudCol'].forEach((k) => {
        f3('u' + k, v[k.charAt(0).toLowerCase() + k.slice(1)] || [0, 0, 0]);
      });
      f1('uSea', v.sea); f1('uClouds', v.clouds); f1('uIce', v.ice); f1('uCity', v.city);
      f3('uLock', [v.locked ? 1 : 0, v.lockIce != null ? v.lockIce : -2, v.lockGlow || 0]);
      f2('uFlare', meteors && this.flareNow ? this.flareNow : [0, 0]); f3('uAurora', v.auroraCol || [0.35, 1, 0.55]);
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
      // 이웃 행성 (행성 화면에서만)
      const sib = meteors ? this._siblings(v, st.V) : [];
      // 여러 별로 이루어진 항성계: 두 번째 해, 멀리 떨어진 동반성
      const s2 = meteors ? this._star2(v, st.V) : null;
      f4('uStar2', s2 || [0, 0, 1, 0]);
      if (s2) f3('uStar2Col', v.star2.col);
      const comps = meteors ? (v.companions || []).map((c) => ({ name: '동반성', dir: M.vec(st.V, c.dir), rho: 0, c })) : [];
      const ca = new Float32Array(8), cc = new Float32Array(8);
      comps.forEach((o, i) => { ca.set([...o.dir, o.c.bright], i * 4); cc.set([...o.c.col, 0], i * 4); });
      if (u['uComp[0]']) gl.uniform4fv(u['uComp[0]'], ca);
      if (u['uCompC[0]']) gl.uniform4fv(u['uCompC[0]'], cc);
      this.sibLabels = meteors ? sib.concat(comps) : null;
      const sa = new Float32Array(28), sl = new Float32Array(28);
      sib.forEach((b, i) => { sa.set([...b.dir, b.rho], i * 4); sl.set([...b.light, b.kind], i * 4); });
      if (u['uSib[0]']) gl.uniform4fv(u['uSib[0]'], sa);
      if (u['uSibL[0]']) gl.uniform4fv(u['uSibL[0]'], sl);
      const cm = meteors && this.comet;
      f4('uCmH', cm ? cm.H : [0, 0, 0, 0]);
      if (cm) { f4('uCmI', cm.I); f4('uCmD', cm.D); f3('uCmCol', cm.col); }
      for (let i = 0; i < 2; i++) {
        const m = meteors && this.meteors[i];
        if (!m) { f4('uMetA' + i, [0, 0, 1, 0]); f4('uMetB' + i, [0, 0, 1, 0]); continue; }
        const age = time - m.t0, prog = Math.min(1, age / m.dur);
        // 순식간에 밝아지고, 머리가 멈춘 뒤 자국이 잠깐 남았다 사라진다
        const env = age < m.dur ? Math.min(1, age / 0.06) : Math.max(0, 1 - (age - m.dur) / 0.35);
        f4('uMetA' + i, M.vec(st.V, m.a).concat(prog));
        f4('uMetB' + i, M.vec(st.V, m.b).concat(m.bright * env));
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* 두 번째 해: 모항성과 같은 궤도면 위에서, 두 별이 서로 도는 주기(오늘 날짜)에 따라 모항성 옆으로 벌어졌다 좁혀진다.
     * 간격(라디안) ≈ 두 별 사이 거리 ÷ 행성 궤도 반지름 */
    _star2(v, V) {
      if (!v.star2) return null;
      const s = v.star2, L = LIGHT, k = L[1];
      const N = norm([-L[0] * k, 1 - L[1] * k, -L[2] * k]);
      const u2 = [N[1] * -L[2] - N[2] * -L[1], N[2] * -L[0] - N[0] * -L[2], N[0] * -L[1] - N[1] * -L[0]];
      const dl = s.sep * Math.sin((Date.now() / 864e5 / s.P) * Math.PI * 2 + s.h);
      const dir = norm([L[0] * Math.cos(dl) + u2[0] * Math.sin(dl), L[1] * Math.cos(dl) + u2[1] * Math.sin(dl), L[2] * Math.cos(dl) + u2[2] * Math.sin(dl)]);
      return [...M.vec(V, dir), (v.starAng || 0.006) * s.size];
    }

    /* 이웃 행성의 위치: 모든 행성이 같은 평면에서 원 궤도를 돈다고 보고, 오늘 날짜의 궤도 위치로 계산한다.
     * 모항성을 원점, 이 행성을 모항성 반대쪽(-LIGHT) 방향에 둔다. 결과는 시점 좌표의 방향과 보이는 반지름 */
    _siblings(v, V) {
      if (!v.orbit || !v.siblings.length) return [];
      const days = Date.now() / 864e5;
      const L = LIGHT, up = [0, 1, 0], k = L[1];
      const N = norm([up[0] - L[0] * k, up[1] - L[1] * k, up[2] - L[2] * k]);
      const u1 = [-L[0], -L[1], -L[2]];
      const u2 = [N[1] * u1[2] - N[2] * u1[1], N[2] * u1[0] - N[0] * u1[2], N[0] * u1[1] - N[1] * u1[0]];
      const ang = (o) => (o.P ? (days / o.P) * Math.PI * 2 : 0) + o.h;
      const t0 = ang(v.orbit), X = [u1[0] * v.orbit.a, u1[1] * v.orbit.a, u1[2] * v.orbit.a];
      const R_EARTH_AU = 4.2635e-5;
      return v.siblings.map((s) => {
        const dt = ang(s) - t0, c = Math.cos(dt) * s.a, sn = Math.sin(dt) * s.a;
        const Y = [u1[0] * c + u2[0] * sn, u1[1] * c + u2[1] * sn, u1[2] * c + u2[2] * sn];
        const d = [Y[0] - X[0], Y[1] - X[1], Y[2] - X[2]], dist = Math.hypot(d[0], d[1], d[2]);
        return { name: s.name, kind: s.kind, rho: (s.rade * R_EARTH_AU) / dist,
          dir: M.vec(V, norm(d)), light: M.vec(V, norm([-Y[0], -Y[1], -Y[2]])) };
      });
    }

    // 2D 별밭이 행성과 같은 카메라로 하늘을 그리도록: 시점 회전, 하늘 초점거리, 화면 이동
    skyView(time) {
      if (!this.slots.length) return null;
      const vp = this.layout(this.canvas.width, this.canvas.height, this.slots.length)[0];
      if (!vp || !vp.sky) return null;
      const st = this._state(this.slots[0], time, vp);
      const v = this.slots[0].world.visual;
      return { V: st.V, yaw: this.cam.yaw, pitch: this.cam.pitch, focal: st.skyFocal, shift: vp.shift, cam: starCam(this.zoom, st.camDist),
        lightCol: v.lightCol || [1, 0.96, 0.9] };
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
        const ro = [0, 0, st.camDist];
        const b = ro[2] * rd[2];
        const hh = b * b - st.camDist * st.camDist + 1;
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
