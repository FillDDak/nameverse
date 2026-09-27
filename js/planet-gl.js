/* NAMEVERSE — WebGL 행성 렌더러 (프래그먼트 셰이더 하나로 행성·대기·고리·위성·일식까지 레이트레이싱)
 *
 * 셰이더 컴파일 비용: Windows의 Chrome은 WebGL 셰이더를 D3D11 HLSL로 바꿔 다시 컴파일하는데, 이 컴파일러는
 * 반복문과 함수를 모두 펼쳐서 셰이더가 클수록 시간이 가파르게 늘어난다. 모든 기능을 담은 셰이더 하나는 약 10초가 걸렸고,
 * 그동안 모든 탭이 함께 쓰는 GPU 프로세스가 멈춰 브라우저 전체가 굳었다(두 번째 방문부터는 디스크 캐시로 0.1초).
 * 그래서 행성 종류에 필요한 부분만 담은 변형(#define GAS · LAVA · CRATER)과 하늘(SKYPASS)을 따로 컴파일하고,
 * KHR_parallel_shader_compile로 끝났는지 확인만 하며 기다리지 않는다(행성은 준비되는 대로 나타난다).
 * 측정: tests/shader-timing.html */
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
uniform float uLightK, uStarGlow; // 행성을 비추는 빛의 세기, 하늘에 보이는 모항성의 밝기 (펄서: 둘 다 약하다)
uniform int uType;
uniform vec3 uDeep, uShallow, uLand, uHigh, uPeak, uAtmo, uEmit, uCloudCol;
uniform float uSea, uClouds, uIce, uCity, uWarp, uScale, uAtmoStr, uSpec;
uniform float uBands, uTurb, uStormSize; uniform vec3 uStorm;
uniform float uRing, uRingSeed; uniform vec3 uRingN; uniform vec2 uRingR; uniform vec3 uRingCol;
uniform vec4 uMoon[3]; uniform vec3 uMoonCol[3]; // 위성: 중심(시점 좌표) + 반지름(0이면 없음), 색
uniform float uStarR, uSkyFocal; uniform mat3 uView;
uniform vec4 uSib[7], uSibL[7]; // 이웃 행성: 방향(시점 좌표) + 보이는 반지름(rad), 이웃 행성에서 모항성 방향 + 색 번호
uniform vec4 uStar2; uniform vec3 uStar2Col; // 두 번째 해: 방향(시점 좌표) + 보이는 반지름
uniform vec4 uComp[2], uCompC[2];            // 멀리 떨어진 동반성: 방향 + 밝기, 색
uniform vec2 uFlare; uniform vec3 uAurora; // 플레어: x 모항성 밝아짐, y 오로라 세기 / 오로라 색
uniform vec3 uLock; // 조석 고정: x 여부, y 얼음 경계(별을 마주한 정도 cos θ가 이보다 작으면 얼음), z 모항성 원반의 실제 겉보기 반지름의 sin
uniform vec3 uGal, uGalC; uniform vec4 uSun; // 은하 북극·은하 중심 방향(월드 좌표), 우리 태양: 방향(시점 좌표) + 밝기
uniform vec4 uThP; uniform vec3 uThA, uHot; // 열복사 (genesis.js): 온도 분포 매개변수와 모드(w), 채널별 밝기 계수, 가장 뜨거운 곳의 방향
uniform float uCrater; // 크레이터 (대기 없는 암석 행성)
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

// snoise와 같은 값(w)에 기울기(xyz)를 함께 돌려준다. 각 꼭짓점의 기여 105·t⁴·(g·x) (t = 0.5 − |x|²)를 미분하면
// 105·(t⁴·g − 8·t³·(g·x)·x). 지형의 범프 음영을 위해 높이를 세 번 계산하던 것을 한 번으로 줄인다(컴파일 시간)
vec4 snoiseD(vec3 v){
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
  vec4 t = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  vec4 t2 = t*t, t4 = t2*t2;
  vec4 gx = vec4(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3));
  vec4 k = t2*t*gx;
  vec3 grad = t4.x*g0 + t4.y*g1 + t4.z*g2 + t4.w*g3 - 8.0*(k.x*x0 + k.y*x1 + k.z*x2 + k.w*x3);
  return vec4(105.0*grad, 105.0*dot(t4, gx));
}

const mat3 M3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
const mat3 M3T = mat3(0.00, -0.80, -0.60, 0.80, 0.36, -0.48, 0.60, -0.48, 0.64); // M3의 전치
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
// fbm과 같은 값에 기울기를 함께. 옥타브마다 좌표를 2.03·M3로 돌리므로 기울기는 (2.03·M3ᵀ)ᵏ로 되돌려 더한다
vec4 fbmD(vec3 p, float fp){
  float a = 0.5, f = 1.0; vec4 s = vec4(0.0); mat3 J = mat3(1.0);
  for(int i = 0; i < 6; i++){
    vec4 n = snoiseD(p);
    float w = a*aa(f, fp);
    s += w*vec4(J*n.xyz, n.w);
    p = M3*p*2.03; J = J*M3T*2.03; f *= 2.03; a *= 0.5;
  }
  return s;
}
// 지형 높이(w)와 기울기(xyz): 대륙(fbm) + 산맥 능선. 높이는 surface.js height()와 같은 식
vec4 terrainD(vec3 qw, float fp){
  vec4 f = fbmD(qw, fp);
  float h = 0.5 + HK*f.w; vec3 gh = HK*f.xyz;
  vec4 rn = snoiseD(qw*2.3 + 11.0);
  float r = 1.0 - abs(rn.w); vec3 gr = -sign(rn.w)*2.3*rn.xyz;
  float k = 0.07*aa(2.3, fp);
  float t = clamp((h - uSea)/0.15, 0.0, 1.0), S = t*t*(3.0 - 2.0*t), dS = 6.0*t*(1.0 - t)/0.15;
  return vec4(gh + k*(2.0*r*S*gr + r*r*dS*gh), h + k*r*r*S);
}

// 크레이터: 격자 칸마다 하나씩(일부 칸은 비움) 흩어 놓은 사발 모양 구덩이와 솟은 테두리. 결과는 높이
vec3 hash33(vec3 p){
  p = fract(p*vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx)*p.zyx);
}
// 높이(w)와 기울기(xyz)를 함께 돌려준다
vec4 craterField(vec3 p, float fill){
  vec3 i = floor(p), f = fract(p);
  vec4 h = vec4(0.0);
  for(int z = -1; z <= 1; z++) for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 k = hash33(i + g + 71.3);
    if(k.y > fill) continue;
    float rad = 0.15 + 0.3*k.x*k.x; // 작은 구덩이가 훨씬 많다
    vec3 r = g + hash33(i + g) - f; // 지금 점에서 구덩이 중심으로
    float lr = length(r), d = lr/rad;
    if(d < 1.8){
      float bowl = d < 1.0 ? d*d - 1.0 : 0.0, dbowl = d < 1.0 ? 2.0*d : 0.0;
      float rim = exp(-(d - 1.0)*(d - 1.0)*10.0), drim = -20.0*(d - 1.0)*rim;
      h.w += (bowl*0.7 + rim*0.3)*rad;
      // d = |중심 − 점|/rad 이므로 ∂d/∂점 = −r/(|r|·rad). 높이에 rad가 곱해져 있어 rad는 지워진다
      h.xyz -= (dbowl*0.7 + drim*0.3)*r/max(lr, 1e-5);
    }
  }
  return h;
}
// 큰 크레이터 한 층 + 작은 크레이터 한 층 (a: 작은 층이 픽셀보다 작아지면 줄인다)
// (반복문으로 써야 컴파일러가 craterField를 두 벌 펼치지 않는다)
vec4 craters(vec3 p, float a){
  vec4 s = vec4(0.0);
  for(int k = 0; k < 2; k++){
    float small = float(k), sc = mix(1.0, 2.7, small);
    vec4 c = craterField(p*sc + 5.3*small, mix(0.55, 0.8, small));
    s += vec4(c.xyz*sc, c.w)*mix(1.0, 0.4*a, small);
  }
  return s;
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
  float thMod = 1.0; // 열복사의 밝기 무늬 (가스 행성은 구름 띠를 따라)
  float spec = 0.0, land = 0.0, water = 0.0;
  vec3 q = lp*uScale + uSeedOff;
  float fp = px*uScale;

#ifdef GAS
  {
    // 가스 행성: 위도 띠 + 흐름 난류 + 소용돌이 폭풍
    vec3 sp = normalize(uStorm);
    float sd = distance(lp, sp), ss = uStormSize;
    vec3 pp = rotAxis(lp, sp, 4.5*exp(-sd*sd/(ss*ss)));
    float w1 = fbm(vec3(pp.x*1.6, pp.y*8.0, pp.z*1.6) + uSeedOff + vec3(uTime*0.012, 0.0, 0.0), px*8.0);
    float t = pp.y*uBands + w1*uTurb*0.5;
    float b1 = 0.5 + 0.5*sin(t*3.0);
    float b2 = 0.5 + 0.5*sin(t*7.3 + 1.7);
    float b3 = 0.5 + 0.5*sin(t*17.0 + 0.6);
    thMod = 0.8 + 0.4*b1;
    base = mix(uDeep, uShallow, smoothstep(0.12, 0.88, b1));
    base = mix(base, uLand, smoothstep(0.55, 0.92, b2)*0.75);
    float fine = fbm(vec3(pp.x*4.0, pp.y*22.0, pp.z*4.0) + uSeedOff*1.3 + vec3(uTime*0.02, 0.0, 0.0), px*22.0);
    base = mix(base, uHigh, smoothstep(0.1, 0.5, fine)*0.3);
    base *= 0.93 + 0.07*mix(0.5, b3, aa(17.0*uBands, px));
    float storm = smoothstep(ss, ss*0.3, sd);
    float swirl = 0.5 + 0.5*sin(sd/ss*14.0);
    base = mix(base, uPeak, storm*(0.7 + 0.25*swirl));
    base *= 0.9 + 0.2*smoothstep(1.0, 0.0, abs(lp.y));
  }
#else
  {
    // 암석 행성: 도메인 워핑 지형 + 기울기로 입체 음영(범프)
    // vec3(fbm3(q), fbm3(q + 5.2), fbm3(q + 9.1))와 같다. 반복문으로 써야 컴파일러가 fbm3을 세 벌 펼치지 않는다
    vec3 wv = vec3(0.0);
    for(int k = 0; k < 3; k++){
      vec3 e = vec3(equal(ivec3(k), ivec3(0, 1, 2)));
      wv += e*fbm3(q + dot(e, vec3(0.0, 5.2, 9.1)));
    }
    vec3 qw = q + uWarp*0.5*wv;
    vec4 td = terrainD(qw, fp);
    float hh = td.w;
    vec3 t1 = normalize(cross(lp, abs(lp.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(lp, t1);
    vec2 gr = uScale*vec2(dot(td.xyz, t1), dot(td.xyz, t2)); // 표면을 따라 t1·t2 방향의 높이 기울기
    float bump = 0.0;

#ifdef LAVA
    {
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
    }
#else
    {
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
#endif
#ifdef CRATER
    {
      // 크레이터는 음영과 밝기에만 넣는다(지표 탐사의 높이 판정은 그대로). 바닥은 조금 어둡고 테두리는 밝다
      vec4 cr = craters(lp*3.2 + uSeedOff*0.13, aa(3.2*2.7, px*1.5));
      gr += 3.2*vec2(dot(cr.xyz, t1), dot(cr.xyz, t2))*0.8;
      bump = max(bump, 0.3);
      base *= clamp(1.0 + 1.4*cr.w, 0.72, 1.25);
    }
#endif
    vec3 nl = normalize(lp - bump*(gr.x*t1 + gr.y*t2)*0.11);
    nb = nl*uRot;
  }
#endif

  float cloud = 0.0;
#ifndef GAS
  if(uClouds > 0.01){
    // 위도 방향으로 눌러서 바람을 따라 길게 늘어진 구름
    vec3 cn = uCloudRot*n;
    vec3 cq = vec3(cn.x, cn.y*1.7, cn.z)*2.0 + uSeedOff*1.7;
    // cw = fbm3(cq*1.2), cd = fbm3(cq*5 + 3): 반복문 하나로 (컴파일러가 fbm3을 두 벌 펼치지 않도록)
    vec2 f2 = vec2(0.0);
    for(int k = 0; k < 2; k++){ float s = float(k); f2 += vec2(1.0 - s, s)*fbm3(cq*mix(1.2, 5.0, s) + 3.0*s); }
    float cw = f2.x;
    float cb = fbm(cq + vec3(cw*0.9, cw*0.2, cw*0.7), px*2.0);
    float cd = f2.y*aa(5.0*2.0, px*2.0);
    float cv = 0.5 + HK*(cb + cd*0.22);
    float th = mix(0.72, 0.5, uClouds);
    cloud = smoothstep(th, th + 0.2, cv)*0.92;
    // 조석 고정된 행성에서는 별을 마주한 곳에 두꺼운 구름이 뭉친다(강한 상승 기류)
    if(uLock.x > 0.5) cloud = max(cloud, smoothstep(0.55, 0.95, ndl + 0.3*(cv - 0.5))*0.75*min(1.0, uClouds*2.0));
  }
#endif

  float sh = ringShadow(p);
  for(int i = 0; i < 3; i++) sh *= moonShadow(p, uMoon[i]);
  // 낮·밤 경계: 별은 점이 아니라 원반(겉보기 반지름 α)이라, 별의 일부만 지평선 위에 있는 곳(|cos| < sin α)은 반그늘이다.
  // 그 부분의 밝기는 구 광원의 근사식 (cos + sin α)²/(4 sin α). 가까이 붙은 큰 별일수록 경계가 넓게 번진다
  float sa = uLock.z;
  float term = smoothstep(-0.1 - sa, 0.15 + 0.5*sa, ndl);
  float nl0 = dot(nb, uLight);
  float dl = (nl0 >= sa ? nl0 : nl0 > -sa ? (nl0 + sa)*(nl0 + sa)/(4.0*sa) : 0.0)*term*sh;
  vec3 lightCol = uLightCol*uLightK*(1.0 + 0.5*uFlare.x); // 플레어가 일어나면 행성도 잠깐 더 밝게 비춘다
  vec3 c = base*(dl*1.15 + 0.015)*lightCol*(1.0 - cloud*0.3);
  float mu = max(dot(n, -rd), 0.0);
#ifdef GAS
  c *= mix(0.55, 1.0, sqrt(mu));
#endif
  vec3 hv = normalize(uLight - rd);
  float nh = max(dot(n, hv), 0.0);
  float fres = 0.02 + 0.98*pow(1.0 - mu, 5.0);
  c += lightCol*spec*(pow(nh, 90.0)*1.1 + pow(nh, 12.0)*0.06)*sh*term*(1.0 - cloud);
  c += uAtmo*water*fres*0.12*term;
  c += emit*(1.0 - cloud*0.75);
  c = mix(c, uCloudCol*lightCol*(max(ndl, 0.0)*1.15*sh + 0.02), cloud*0.95);
  if(uThP.w > 0.5){
    // 열복사: 그 자리의 온도 T에서 흑체가 내는 빛 = uThA / (e^(hc/λkT) − 1), 세 파장(610·550·465nm).
    // 온도 분포 — 1 조석 고정: T⁴ = Tn⁴ + (Ts⁴ − Tn⁴)·(가장 뜨거운 곳을 마주한 정도) · 2 자전: 위도별 · 3 스스로 빛남: 고르게
    float T4 = uThP.w < 1.5 ? uThP.x + uThP.y*max(dot(n, uHot), 0.0)
             : uThP.w < 2.5 ? uThP.z*max(1.241 - 0.723*lp.y*lp.y, 0.05) : uThP.z;
    float Tk = sqrt(sqrt(max(T4, 1.0)));
    vec3 e = exp(-min(vec3(23587.0, 26160.0, 30942.0)/Tk, vec3(80.0)));
    c += uThA*(e/(1.0 - e))*thMod*(1.0 - cloud*0.6);
  }
  if(uFlare.y > 0.001){
    // 오로라: 자전축 극 둘레의 고리(구름보다 높은 곳). 활동이 셀수록 적도 쪽으로 내려오고 커튼처럼 일렁인다. 밤 쪽에서 잘 보인다
    vec3 lq = uRot*n;
    float colat = acos(clamp(abs(lq.y), 0.0, 1.0));
    float wob = 0.06*snoise(vec3(lq.x*3.0, lq.z*3.0, uTime*0.15 + step(0.0, lq.y)*7.0));
    float dd = colat - (0.3 + 0.28*uFlare.y) - wob;
    float band = exp(-dd*dd/0.0035) + 0.35*exp(-dd*dd/0.03);
    float curtain = 0.5 + 0.5*snoise(vec3(lq.x*16.0, lq.z*16.0, uTime*0.45));
    // 낮 쪽에서는 햇빛에 묻혀 흐리다. 빛이 거의 없는 펄서 행성에서는 낮에도 보인다
    c += uAurora*band*(0.35 + 0.65*curtain)*uFlare.y*(1.0 - day*0.8*min(uLightK*1.5, 1.0))*1.4;
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
    oc = col*(d*sh*1.15 + 0.012)*uLightK;
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
  // 우주에는 대기가 없어 별이 반짝이지 않는다
  return tint*exp(-a*a/(w*w))*(0.1 + 2.2*b)*gain;
}
vec3 skyColor(vec3 d, float ap){
  // 은하수: 실제 은하면을 따라(uGal: 은하 북극). 은하 중심(uGalC, 궁수자리) 쪽이 가장 밝고 두꺼우며 누런빛이고,
  // 반대쪽(마차부자리)은 희미하다. 가운데를 가르는 어두운 먼지 띠(대균열)는 중심 쪽 절반에서 뚜렷하다
  float gl = dot(d, uGal), cen = dot(d, uGalC);
  float bulge = exp(-(1.0 - cen)*7.0);
  float band = exp(-gl*gl/(0.018 + 0.035*bulge));
  float cl = 0.5 + 0.5*fbm3(d*3.2 + 7.0);
  float dust = smoothstep(0.35, 0.75, 0.5 + 0.5*fbm3(d*7.0 + 3.0));
  float rift = 1.0 - 0.6*exp(-(gl + 0.012)*(gl + 0.012)/0.0012)*smoothstep(-0.3, 0.6, cen);
  vec3 tone = mix(mix(vec3(0.5, 0.48, 0.62), vec3(0.78, 0.64, 0.5), cl), vec3(0.95, 0.74, 0.5), bulge*0.6);
  vec3 mw = tone*band*(0.3 + 0.7*cl)*(1.0 - 0.65*dust)*rift*(0.7 + 0.5*cen + 1.4*bulge)*0.06;
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
  // 0 가스, 1 얼음 거인, 2 용암, 3 사막, 4 온화, 5 얼음, 6 대기 없는 암석, 7 금성형, 8 서브넵튠 (genesis.js SIB_KIND)
  return k < 0.5 ? vec3(0.86, 0.76, 0.6) : k < 1.5 ? vec3(0.62, 0.8, 0.92) : k < 2.5 ? vec3(0.42, 0.24, 0.18)
       : k < 3.5 ? vec3(0.8, 0.6, 0.42) : k < 4.5 ? vec3(0.55, 0.7, 0.88) : k < 5.5 ? vec3(0.92, 0.95, 1.0)
       : k < 6.5 ? vec3(0.5, 0.47, 0.44) : k < 7.5 ? vec3(0.92, 0.86, 0.66) : vec3(0.78, 0.78, 0.74);
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
    vec3 L = uSibL[i].xyz, col = sibColor(uSibL[i].w)*uLightCol*uLightK;
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

#ifdef SKYPASS
/* 하늘 (행성 화면에서만): 무한히 먼 별·은하수, 혜성, 이웃 행성, 두 번째 해, 동반성.
 * 행성을 먼저 그린 뒤 그 '뒤로' 섞는다(ONE_MINUS_DST_ALPHA, ONE). 행성 셰이더와 따로 컴파일되어 둘 다 가벼워진다 */
void main(){
  vec2 uv = (gl_FragCoord.xy - uOffset - 0.5*uRes)/uRes.y - uShift;
  vec3 ro = vec3(0.0, 0.0, uCamDist);
  vec3 rd = normalize(vec3(uv, -uFocal));
  float px = uCamDist/(uRes.y*uFocal);
  float b = dot(ro, rd);
  if(sqrt(max(dot(ro, ro) - b*b, 0.0)) < 1.0 - 2.0*px) discard; // 행성에 완전히 가려진 곳
  vec3 rdS = normalize(vec3(uv, -uSkyFocal));
  float apS = 1.0/(uRes.y*uSkyFocal);
  vec3 col = vec3(0.0); float alpha = 0.0;
  vec3 hue2 = mix(clamp((uStar2Col - 0.45)/0.55, 0.0, 1.0), vec3(1.0), 0.2);
  if(uStar2.w > 0.0){
    // 두 번째 해 (두 별을 함께 도는 행성의 하늘): 모항성과 같은 모양, 더 작고 차가운 별
    float sd2 = 2.0*asin(clamp(length(rdS - uStar2.xyz)*0.5, 0.0, 1.0));
    float r2 = max(uStar2.w, apS*1.5), qq = sd2*sd2/(r2*r2);
    vec3 c2 = vec3(pow(1.0 + qq/1.1, -2.4), pow(1.0 + qq, -2.4), pow(1.0 + qq/0.9, -2.4))*5.0 + 0.12*pow(1.0 + sd2/(r2*3.0), -1.8);
    col = 1.0 - exp(-c2*hue2);
    alpha = min(1.0, max(col.r, max(col.g, col.b)));
  }
  vec3 sky = skyColor(uView*rdS, apS) + comet(uv, apS) + siblings(rdS, apS) + companions(rdS, apS);
  if(uSun.w > 0.0){
    // 우리 태양: 노란빛이 도는 흰 별 하나 (겉보기 등급으로 정한 밝기)
    float x = length(rdS - uSun.xyz)/apS;
    sky += vec3(1.0, 0.94, 0.84)*uSun.w*(exp(-x*x/1.3)*1.8 + 0.06*pow(1.0 + x/2.5, -2.2));
  }
  col += sky*(1.0 - alpha);
  alpha += min(1.0, max(sky.r, max(sky.g, sky.b)))*(1.0 - alpha);
  // 두 번째 해와 동반성의 빛번짐
  vec3 flare = vec3(0.0);
  if(uStar2.w > 0.0) flare = starFlare(uStar2.xyz, max(uStar2.w, apS*1.5), hue2, uv, ro, 0.5);
  for(int i = 0; i < 2; i++){
    if(uComp[i].w <= 0.0) break;
    flare = 1.0 - (1.0 - flare)*(1.0 - starFlare(uComp[i].xyz, apS*1.5, mix(uCompC[i].rgb, vec3(1.0), 0.3), uv, ro, 0.28*uComp[i].w));
  }
  col += flare*(1.0 - col);
  alpha = clamp(max(alpha, max(flare.r, max(flare.g, flare.b))), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(alpha)), alpha)*uAlpha;
}
#else
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
  vec3 haloCol = uAtmo*mix(vec3(1.0, 0.6, 0.4), vec3(1.0), smoothstep(-0.2, 0.4, ldot))*uLightCol*uLightK;
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
  // 반복문 하나로 부른다: 세 번 따로 부르면 컴파일러가 함수를 세 벌 펼쳐 컴파일이 크게 느려진다
  for(int i = 0; i < 3; i++) traceMoon(ro, rd, uMoon[i], uMoonCol[i], float(i + 1), tBest, oc, oa);
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
          rc *= (0.3 + 0.7*abs(dot(uRingN, uLight)))*shadow*uLightCol*uLightK;
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
  vec3 core = vec3(pow(1.0 + q2/1.1, -2.4), pow(1.0 + q2, -2.4), pow(1.0 + q2/0.9, -2.4))*6.0*(1.0 + 2.0*uFlare.x)*uStarGlow;
  vec3 hue = mix(mix(tint, vec3(1.0), 0.2), vec3(0.85, 0.92, 1.0), uFlare.x*0.6);
  vec3 coreC = 1.0 - exp(-core*hue);
  float coreA = min(1.0, max(coreC.r, max(coreC.g, coreC.b)));
  col += coreC*(1.0 - alpha);
  alpha += coreA*(1.0 - alpha);
  // 넓게 번지는 빛과 회절 빛줄기는 렌즈에서 생기므로 행성 위에도 겹친다
  vec3 flare = starFlare(uLight, min(r0, 0.03)*(1.0 + 2.5*uFlare.x), hue, uv, ro, (1.0 + 2.0*uFlare.x)*uStarGlow);
  col += flare*(1.0 - col);
  alpha = max(alpha, min(1.0, max(flare.r, max(flare.g, flare.b))));

  alpha = clamp(alpha, 0.0, 1.0);
  col = min(col, vec3(alpha));
  gl_FragColor = vec4(col, alpha)*uAlpha;
}
#endif`;

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
  // 축 k(단위 벡터)를 중심으로 v를 a만큼 돌린다 (로드리게스, 셰이더 rotAxis와 같은 식)
  const rotAxis = (v, k, a) => {
    const c = Math.cos(a), s = Math.sin(a), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c);
    return [v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * d, v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * d, v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * d];
  };

  const LIGHT = norm([-0.8, 0.38, 0.62]);
  const DEG = Math.PI / 180;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const eqVec = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];
  const GAL_N = eqVec(192.85948, 27.12825), GAL_C = eqVec(266.40499, -28.93617); // 은하 북극, 은하 중심 (적도 좌표, J2000)
  const JD_UNIX = 2440587.5; // 1970-01-01의 율리우스일
  const MW_VIEW = norm([0.25, 0.92, 0.3]); // 은하수가 가장 보기 좋게 지나가는 방향의 은하 북극 (시점 좌표)

  /* 오늘 궤도 위의 위치 (케플러 방정식). o: genesis.js orbitEl + 궤도 긴반지름 a.
   * 트랜싯 시각 T0를 알면 그 순간 행성은 별과 관측자(태양) 사이, 즉 궤도 경도(ν + ω) 90°에 있다.
   * 모르면 이름으로 정한 위상. lon: 궤도면 위 경도, r: 별까지 거리(AU) */
  function kepler(o, days) {
    const e = Math.min(0.95, o.e || 0), w = o.w != null ? o.w * DEG : Math.PI / 2;
    let M;
    if (o.T0 != null && o.Pt) {
      const nt = Math.PI / 2 - w, Et = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nt / 2));
      M = Et - e * Math.sin(Et) + 2 * Math.PI * (((days + JD_UNIX - o.T0) / o.Pt) % 1);
    } else M = o.h + (o.P ? 2 * Math.PI * ((days / o.P) % 1) : 0);
    let E = M;
    for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    return { lon: nu + w, r: o.a * (1 - e * Math.cos(E)) };
  }
  const CAM = 6.0;
  // 확대/축소는 카메라가 실제로 다가가고 물러나는 것(달리 줌). 별 공간에서는 그 이동을 STAR_DOLLY배로 키워
  // 가까운 별은 크게, 먼 별은 조금, 은하수와 모항성(무한히 멂)은 전혀 움직이지 않는 연속된 깊이감을 만든다
  const STAR_DOLLY = 7;
  // 단, 물러날 때는 별 공간의 카메라가 가장 가까운 별들(행성에서 36~40 이상) 안쪽에 머물도록 한다.
  // 별들은 행성을 중심으로 흩어져 있어서, 그 바깥까지 나가면 별 무리를 밖에서 보게 되어 행성 주변에 몰려 보인다.
  // 축소 배율의 로그에 대해 처음엔 빠르게, 끝으로 갈수록 천천히(멈추지는 않게) 물러나 최대 축소(0.06)에서 약 25에 이른다
  const starCam = (zoom, camDist) => (zoom >= 1 ? CAM + (camDist - CAM) * STAR_DOLLY : CAM + 8 * Math.log(1 + 3.75 * Math.log(1 / zoom)));
  const BASE_PITCH = 0.3;
  const ARRIVE = 1.6; // 행성이 다가와 멈추기까지(초). 크기는 1 − (1 − t/ARRIVE)⁴로 커진다

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
      // 화면을 덮는 삼각형 하나. 모든 셰이더 변형에서 aPos를 0번 속성으로 묶어 함께 쓴다
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.SCISSOR_TEST);
      this.progs = new Map(); // 변형 이름 → { p, vs, fs, u(준비되면 유니폼 위치), failed }
      this.skyQ = new WeakMap(); // 행성 → 하늘(적도 좌표)을 궤도면 좌표로 돌리는 행렬
      this.par = gl.getExtension('KHR_parallel_shader_compile');
    }

    // 행성 하나를 그리는 셰이더 변형: G 가스 · L 용암 · C 크레이터가 있는 암석 · R 암석. 하늘은 따로 'K'
    static variant(world) {
      const v = world.visual;
      return v.type === 1 ? 'G' : v.type === 2 ? 'L' : v.crater ? 'C' : 'R';
    }

    /* 변형 프로그램. 처음 부르면 컴파일을 시작만 하고 null을 돌려준다. 그 뒤로는 끝났는지 확인만 하고,
     * 끝나면 유니폼 위치를 모아 돌려준다. 결과를 묻는 호출(LINK_STATUS 등)은 컴파일이 끝날 때까지 GPU를 붙잡으므로
     * KHR_parallel_shader_compile이 '끝났다'고 할 때만 묻는다 (확장이 없는 브라우저는 예전처럼 여기서 기다린다) */
    _program(key) {
      const gl = this.gl;
      let pr = this.progs.get(key);
      if (!pr) {
        const DEF = { G: 'GAS', L: 'LAVA', C: 'CRATER', K: 'SKYPASS' };
        const head = [...key].map((c) => `#define ${DEF[c]}\n`).join('');
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const p = gl.createProgram(), vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, head + FRAG);
        gl.attachShader(p, vs); gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, 'aPos');
        gl.linkProgram(p);
        pr = { p, vs, fs, u: null, failed: false };
        this.progs.set(key, pr);
        if (this.par) return null;
      }
      if (pr.u) return pr;
      if (pr.failed || (this.par && !gl.getProgramParameter(pr.p, this.par.COMPLETION_STATUS_KHR))) return null;
      if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) {
        pr.failed = true;
        console.error(`행성 셰이더(${key})를 만들지 못했습니다:`, gl.getShaderInfoLog(pr.fs) || gl.getProgramInfoLog(pr.p));
        return null;
      }
      pr.u = {};
      const n = gl.getProgramParameter(pr.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(pr.p, i);
        pr.u[info.name] = gl.getUniformLocation(pr.p, info.name);
      }
      return pr;
    }

    // 곧 그릴 행성의 셰이더를 미리 컴파일해 둔다 (sky: 행성 화면처럼 하늘까지 그릴 때)
    prepare(worlds, sky = false) {
      worlds.forEach((w) => this._program(PlanetRenderer.variant(w)));
      if (sky) this._program('K');
    }

    // 필요한 셰이더가 모두 준비되면(또는 실패하면) 풀린다. 엽서처럼 한 번에 그려야 할 때 쓴다
    ready(worlds, sky = false) {
      const keys = worlds.map((w) => PlanetRenderer.variant(w)).concat(sky ? ['K'] : []);
      return new Promise((resolve) => {
        const check = () => (keys.every((k) => this._program(k) || this.progs.get(k).failed) ? resolve() : setTimeout(check, 30));
        check();
      });
    }

    // instant: 즉시 표시 / grow=false: 크기 애니메이션 없이 서서히 나타남.
    // 셰이더가 아직 컴파일 중이면 나타나는 연출은 처음 그려지는 순간부터 시작한다 (_draw의 pending)
    setWorlds(worlds, { instant = false, grow = true } = {}) {
      const now = performance.now() / 1000;
      this.realStar = false; // 모항성을 실제 크기로 보기 (행성 화면의 버튼)
      this.imagine = false;  // 상상 속 도시 불빛 (행성 화면의 버튼)
      this.slots = worlds.map((w) => ({
        world: w,
        appearAt: instant || !grow ? now - 10 : now,
        fadeAt: instant ? now - 10 : now,
        setAt: now, pending: true,
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
      const k = Math.min(1, Math.max(0, age / ARRIVE));
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
      // 펄서의 입자 바람은 쉬지 않아 오로라가 늘 켜져 있다 (천천히 세졌다 약해졌다)
      if (v.auroraSteady) { this.flareNow = [0, v.auroraSteady * (0.75 + 0.25 * Math.sin(time * 0.35))]; return; }
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
      if (slot.world.visual.airless) { this.meteors = []; return; } // 유성은 대기에서 타며 빛난다
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
      const gl = this.gl, v = slot.world.visual;
      const pr = this._program(PlanetRenderer.variant(slot.world));
      if (!pr) return; // 아직 컴파일 중
      const skyPr = meteors ? this._program('K') : null; // 하늘 셰이더가 준비되기 전에는 행성만 그린다
      if (slot.pending) {
        // 기다린 만큼 나타나는 연출을 미룬다
        const d = Math.max(0, time - slot.setAt);
        slot.appearAt += d; slot.fadeAt += d; slot.pending = false;
      }
      const st = this._state(slot, time, vp);
      gl.viewport(vp.x, vp.y, vp.w, vp.h);
      gl.scissor(vp.x, vp.y, vp.w, vp.h);
      // 하늘의 방향(은하수·태양)과 이웃 행성 (행성 화면에서만)
      const sky = meteors ? this._sky(v, Date.now() / 864e5) : null;
      const sib = sky ? this._siblings(v, st.V, sky) : [];
      const sunW = sky && v.sun && v.sun.mag != null ? sky.toW(v.sun.eq) : null;
      // 여러 별로 이루어진 항성계: 두 번째 해, 멀리 떨어진 동반성
      const s2 = meteors ? this._star2(v, st.V) : null;
      const comps = meteors ? (v.companions || []).map((c) => ({ name: '동반성', dir: M.vec(st.V, c.dir), rho: 0, c })) : [];
      this.sibLabels = meteors ? sib.concat(comps, sunW ? [{ name: `태양 ${v.sun.mag.toFixed(1)}등급`, dir: M.vec(st.V, sunW), rho: 0 }] : []) : null;
      const starR = this.starAngle(v);
      // 행성 셰이더와 하늘 셰이더에 같은 유니폼을 올린다 (각 셰이더에 없는 유니폼은 건너뛴다)
      const apply = (u) => {
      const f1 = (n, x) => u[n] && gl.uniform1f(u[n], x);
      const f2 = (n, a) => u[n] && gl.uniform2fv(u[n], a);
      const f3 = (n, a) => u[n] && gl.uniform3fv(u[n], a);
      const f4 = (n, a) => u[n] && gl.uniform4fv(u[n], a);
      f2('uRes', [vp.w, vp.h]); f2('uOffset', [vp.x, vp.y]); f2('uShift', vp.shift);
      f1('uTime', time); f1('uFocal', st.focal); f1('uCamDist', st.camDist); f1('uAlpha', st.alpha * (vp.alpha == null ? 1 : vp.alpha));
      f1('uPulse', this.pulse);
      // 행 우선 R을 그대로 올리면 GLSL에서는 Rᵀ(월드→로컬)가 된다
      // 변형에 따라 빠진 유니폼(가스 행성의 구름 회전, 하늘이 없는 화면의 시점)은 위치가 없다
      gl.uniformMatrix3fv(u.uRot || null, false, new Float32Array(st.R));
      gl.uniformMatrix3fv(u.uCloudRot || null, false, new Float32Array(st.RC));
      f3('uLight', st.light); f1('uStarR', starR);
      if (sky) { f3('uGal', sky.toW(GAL_N)); f3('uGalC', sky.toW(GAL_C)); }
      // 겉보기 등급 m → 밝기: 6등급(맨눈 한계)이 가장 희미한 배경 별 정도가 되도록
      f4('uSun', sunW ? [...M.vec(st.V, sunW), Math.min(2.2, 0.3 * Math.pow(10, -0.4 * (v.sun.mag - 4)))] : [0, 0, 1, 0]);
      f1('uSkyFocal', st.skyFocal);
      gl.uniformMatrix3fv(u.uView || null, false, new Float32Array(st.V)); f3('uLightCol', v.lightCol || [1, 0.96, 0.9]); f3('uSeedOff', v.seedOff);
      f1('uLightK', v.lightK != null ? v.lightK : 1); f1('uStarGlow', v.starGlow != null ? v.starGlow : 1);
      gl.uniform1i(u.uType || null, v.type);
      ['Deep', 'Shallow', 'Land', 'High', 'Peak', 'Atmo', 'Emit', 'CloudCol'].forEach((k) => {
        f3('u' + k, v[k.charAt(0).toLowerCase() + k.slice(1)] || [0, 0, 0]);
      });
      f1('uSea', v.sea); f1('uClouds', v.clouds); f1('uIce', v.ice); f1('uCity', this.imagine && meteors ? v.city : 0);
      f3('uLock', [v.locked ? 1 : 0, v.lockIce != null ? v.lockIce : -2, Math.sin(Math.min(v.starAngReal || 0, 1.3))]);
      // 대기가 없으면 플레어가 일어나도 오로라가 생기지 않는다
      f2('uFlare', meteors && this.flareNow ? [this.flareNow[0], v.aurora === false ? 0 : this.flareNow[1]] : [0, 0]); f3('uAurora', v.auroraCol || [0.35, 1, 0.55]);
      f4('uThP', (v.thermP || [0, 0, 0]).concat(v.thermMode || 0)); f3('uThA', v.thermA || [0, 0, 0]);
      // 뜨거운 목성의 가장 뜨거운 곳: 별을 마주한 곳에서 자전축을 중심으로 동쪽(자전 방향)으로 돌린 방향
      const shift = v.therm && v.therm.shift ? v.therm.shift : 0;
      f3('uHot', shift ? rotAxis(st.light, st.ringN, shift) : st.light);
      f1('uCrater', v.crater ? 1 : 0);
      f1('uWarp', v.warp); f1('uScale', v.scale); f1('uAtmoStr', v.atmoStr); f1('uSpec', v.spec);
      f1('uBands', v.bands); f1('uTurb', v.turb); f1('uStormSize', v.stormSize || 0.1); f3('uStorm', v.storm);
      f1('uRing', v.ring ? 1 : 0);
      if (v.ring) {
        f1('uRingSeed', v.ring.seed); f3('uRingN', st.ringN); f2('uRingR', [v.ring.inner, v.ring.outer]); f3('uRingCol', v.ring.color);
      }
      const moonA = new Float32Array(12), moonC = new Float32Array(9);
      for (let i = 0; i < 3; i++) {
        const m = st.moons[i];
        moonA.set(m || [0, 0, 0, 0], i * 4);
        moonC.set(m ? v.moons[i].color : [0, 0, 0], i * 3);
      }
      if (u['uMoon[0]']) gl.uniform4fv(u['uMoon[0]'], moonA);
      if (u['uMoonCol[0]']) gl.uniform3fv(u['uMoonCol[0]'], moonC);
      f4('uStar2', s2 || [0, 0, 1, 0]);
      if (s2) f3('uStar2Col', v.star2.col);
      const ca = new Float32Array(8), cc = new Float32Array(8);
      comps.forEach((o, i) => { ca.set([...o.dir, o.c.bright], i * 4); cc.set([...o.c.col, 0], i * 4); });
      if (u['uComp[0]']) gl.uniform4fv(u['uComp[0]'], ca);
      if (u['uCompC[0]']) gl.uniform4fv(u['uCompC[0]'], cc);
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
      };
      gl.useProgram(pr.p); apply(pr.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (skyPr) {
        // 하늘은 이미 그린 행성 '뒤로': 남은 투명도만큼만 비친다
        gl.useProgram(skyPr.p); apply(skyPr.u);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
      }
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
      return [...M.vec(V, dir), this.starAngle(v) * s.size];
    }

    // 하늘에 그리는 모항성의 겉보기 반지름: 보통은 genesis.js가 줄인 크기, '실제 크기로 보기'에서는 실제 크기
    starAngle(v) {
      const a = v.starAng || 0.006;
      return this.realStar && v.starAngReal > a ? Math.min(v.starAngReal, 1.0) : a;
    }

    /* 하늘의 방향. 월드 좌표에서 모항성은 늘 LIGHT 쪽, 이 행성의 궤도면은 LIGHT를 품고 법선 N이 위쪽에 가깝다.
     * 궤도면 좌표(경도 λ, 고도)는 이 행성의 오늘 경도 λ₀가 u1(= 별 반대쪽)에 오도록 돌린다.
     * 적도 좌표(별자리·은하수·태양)는 태양 방향(v.sun: 트랜싯 행성은 경도 90°·고도 90°−i)을 맞추고, 남은 한 가지 자유도
     * (궤도면이 하늘에서 누운 방향, 관측으로 알 수 없다)는 은하수가 잘 보이도록(은하 북극이 MW_VIEW에 가깝게: 행성 뒤를 비스듬히 지나며 자동 회전하는 동안 늘 보인다. 되도록 은하 중심 쪽) 고른다.
     * 행성이 공전하면 별자리가 궤도 주기에 맞춰 천천히 돈다 */
    _sky(v, days) {
      const o = v.orbit || { a: 1, e: 0, w: null, T0: null, Pt: null, P: null, h: 0 };
      const self = kepler(o, days);
      const L = LIGHT, k = L[1];
      const N = norm([-L[0] * k, 1 - L[1] * k, -L[2] * k]);
      const u1 = [-L[0], -L[1], -L[2]], u2 = cross(N, u1);
      const dirW = (lon, lat = 0) => {
        const c = Math.cos(lon - self.lon) * Math.cos(lat), s = Math.sin(lon - self.lon) * Math.cos(lat), z = Math.sin(lat);
        return [u1[0] * c + u2[0] * s + N[0] * z, u1[1] * c + u2[1] * s + N[1] * z, u1[2] * c + u2[2] * s + N[2] * z];
      };
      const fromI = (q) => { const a = dirW(0), b = dirW(Math.PI / 2); return [0, 1, 2].map((i) => a[i] * q[0] + b[i] * q[1] + N[i] * q[2]); };
      let Q = this.skyQ.get(v);
      if (!Q) {
        const s = v.sun || { eq: [1, 0, 0], lon: 0, lat: 0 };
        const a1 = s.eq, a2 = norm(cross(GAL_N, a1)), a3 = cross(a1, a2);
        const b1 = [Math.cos(s.lat) * Math.cos(s.lon), Math.cos(s.lat) * Math.sin(s.lon), Math.sin(s.lat)];
        const f2 = Math.abs(b1[2]) > 0.999 ? [1, 0, 0] : norm(cross([0, 0, 1], b1)), f3 = cross(b1, f2);
        const make = (ps) => {
          const b2 = [0, 1, 2].map((i) => Math.cos(ps) * f2[i] + Math.sin(ps) * f3[i]), b3 = cross(b1, b2);
          return (x) => { const p = [dot(a1, x), dot(a2, x), dot(a3, x)]; return [0, 1, 2].map((i) => b1[i] * p[0] + b2[i] * p[1] + b3[i] * p[2]); };
        };
        let best = -1;
        for (let i = 0; i < 180; i++) {
          const q = make((i / 180) * Math.PI * 2);
          const gp = fromI(q(GAL_N)), gc = fromI(q(GAL_C));
          const sc = Math.abs(dot(gp, MW_VIEW)) + 0.3 * Math.max(0, -gc[2]);
          if (sc > best) { best = sc; Q = q; }
        }
        this.skyQ.set(v, Q);
      }
      return { self, dirW, u1, toW: (x) => fromI(Q(x)) };
    }

    // '실제 크기로 보기'에서 모항성이 행성 왼쪽 위로 보이도록 돌릴 시점 (yaw, pitch)
    starView(world) {
      const v = world.visual, r = Math.min(this.realStar ? v.starAngReal : v.starAng, 1.0);
      const off = Math.min(0.9, 0.19 + 0.6 * r); // 큰 별은 일부가 행성 뒤로 숨어 크기를 견주어 볼 수 있다
      const T = norm([-0.55 * Math.sin(off), 0.83 * Math.sin(off), -Math.cos(off)]);
      let best = { yaw: 0, pitch: 0, d: -2 };
      for (let yi = 0; yi < 360; yi++) for (let pi = -65; pi <= 65; pi++) {
        const yaw = (yi / 360) * Math.PI * 2 - Math.PI, pitch = pi / 50;
        const d = dot(M.vec(M.mul(M.rx(pitch), M.ry(yaw)), LIGHT), T);
        if (d > best.d) best = { yaw, pitch, d };
      }
      return best;
    }

    /* 이웃 행성의 위치: 모든 행성이 같은 평면에서 돈다고 보고, 오늘 날짜의 궤도 위치(케플러 방정식)로 계산한다.
     * 모항성을 원점에 둔다. 결과는 시점 좌표의 방향과 보이는 반지름 */
    _siblings(v, V, sky) {
      if (!v.orbit || !v.siblings.length) return [];
      const X = sky.u1.map((x) => x * sky.self.r);
      const R_EARTH_AU = 4.2635e-5;
      return v.siblings.map((s) => {
        const o = kepler(s, Date.now() / 864e5), dw = sky.dirW(o.lon);
        const Y = dw.map((x) => x * o.r);
        const d = [Y[0] - X[0], Y[1] - X[1], Y[2] - X[2]], dist = Math.hypot(d[0], d[1], d[2]);
        return { name: s.name, kind: s.kind, rho: (s.rade * R_EARTH_AU) / dist,
          dir: M.vec(V, norm(d)), light: M.vec(V, norm([-Y[0], -Y[1], -Y[2]])) };
      });
    }

    /* 첫 행성이 다가오는 진행도 0~1 (별밭이 같은 움직임으로 감속하도록). 셰이더가 준비되어 처음 그려지기 전에는 0 */
    arrival(time) {
      const s = this.slots[0];
      if (!s) return null;
      return s.pending ? 0 : Math.min(1, Math.max(0, (time - s.appearAt) / ARRIVE));
    }

    // 2D 별밭이 행성과 같은 카메라로 하늘을 그리도록: 시점 회전, 하늘 초점거리, 화면 이동
    skyView(time) {
      if (!this.slots.length) return null;
      const vp = this.layout(this.canvas.width, this.canvas.height, this.slots.length)[0];
      if (!vp || !vp.sky) return null;
      const st = this._state(this.slots[0], time, vp);
      const v = this.slots[0].world.visual;
      return { V: st.V, yaw: this.cam.yaw, pitch: this.cam.pitch, focal: st.skyFocal, shift: vp.shift, cam: starCam(this.zoom, st.camDist),
        lightCol: (v.lightCol || [1, 0.96, 0.9]).map((c) => c * (v.lightK != null ? v.lightK : 1)) }; // 혜성의 먼지 꼬리가 반사하는 빛
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
        const Rt = M.transpose(st.R);
        // light: 셰이더의 ndl = dot(n, uLight)를 로컬 좌표에서 같게 계산하도록 모항성 방향도 로컬로 돌려 준다
        return { slot: i, world: this.slots[i].world, local: M.vec(Rt, n), light: M.vec(Rt, st.light), normal: n };
      }
      return null;
    }
  }

  NV.PlanetRenderer = PlanetRenderer;
  PlanetRenderer.FRAG = FRAG; PlanetRenderer.VERT = VERT; // 개발용 (tests/shader-timing.html)
  NV.LIGHT = LIGHT;
})();
