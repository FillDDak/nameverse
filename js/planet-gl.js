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
      float lakes = smoothstep(uSea, uSea - 0.05, hh);
      base = mix(uDeep, uShallow, smoothstep(0.3, 0.7, hh));
      base = mix(base, uLand, smoothstep(0.58, 0.75, hh)*0.7);
      base *= 0.8 + 0.4*(0.5 + 0.5*snoise(qw*7.0)*aa(7.0, fp));
      // 수정 행성(반사가 강한 쪽)은 호수 대신 결정 틈만 빛난다
      float glow = max(crack*1.1, lakes*(1.0 - 0.7*step(0.5, uSpec)));
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
        float region = smoothstep(0.05, 0.5, snoise(lp*9.0 + uSeedOff.yzx));
        float dots = mix(0.18, smoothstep(0.35, 0.8, snoise(lp*140.0 + uSeedOff)), aa(140.0, px));
        emit += vec3(1.0, 0.74, 0.4)*region*(dots + 0.06)*land*uCity*(1.0 - day)*1.6;
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
  }

  float sh = ringShadow(p)*moonShadow(p, uMoon0)*moonShadow(p, uMoon1)*moonShadow(p, uMoon2);
  float term = smoothstep(-0.1, 0.15, ndl);
  float dl = max(dot(nb, uLight), 0.0)*term*sh;
  vec3 lightCol = uLightCol;
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
  return starLayer(d, 70.0, ap, 0.28, 0.9) + starLayer(d, 160.0, ap, 0.08 + band*0.25, 0.4) + starLayer(d, 330.0, ap, 0.015 + band*0.2, 0.25) + mw;
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
  // 모항성과 하늘은 무한히 멀다: 행성을 확대(uFocal)해도 크기가 변하지 않도록 따로 정한 초점거리로 본다
  vec3 rdS = normalize(vec3(uv, -uSkyFocal));
  float apS = 1.0/(uRes.y*uSkyFocal);
  vec3 tint = clamp((uLightCol - 0.45)/0.55, 0.0, 1.0); // 별 본래 색 (uLightCol은 흰색 쪽에 섞은 조명용 값)
  float sd = 2.0*asin(clamp(length(rdS - uLight)*0.5, 0.0, 1.0));
  float sr = max(uStarR, apS*1.2);
  float disk = smoothstep(sr + apS, sr - apS, sd);
  float mu2 = sqrt(max(0.0, 1.0 - (sd*sd)/(sr*sr)));
  // 가운데는 하얗게 타오르고 가장자리로 갈수록 진한 색 (주연 감광)
  vec3 face = mix(tint, vec3(1.0), 0.35 + mu2*0.5)*(0.55 + 0.45*mu2);
  vec3 starC = 1.0 - exp(-face*3.0);
  col += starC*disk*(1.0 - alpha);
  alpha += disk*(1.0 - alpha);
  if(uSky > 0.5 && alpha < 0.999){
    vec3 sky = skyColor(uView*rdS, apS);
    col += sky*(1.0 - alpha);
    alpha += min(1.0, max(sky.r, max(sky.g, sky.b)))*(1.0 - alpha);
  }
  // 빛 번짐과 회절 빛줄기: 망원경·카메라로 밝은 별을 찍은 것처럼. 별이 행성 뒤로 숨으면 함께 사라진다
  if(uLight.z < 0.0){
    vec2 uvStar = uLight.xy/(-uLight.z)*uSkyFocal;
    vec2 dv = uv - uvStar;
    float rS = sr*uSkyFocal;
    vec3 rdc = normalize(vec3(uvStar, -uFocal));
    float bc = dot(ro, rdc);
    float dc = sqrt(max(dot(ro, ro) - bc*bc, 0.0));
    float m = sr*uCamDist + 0.004;
    float vis = smoothstep(1.0 - m, 1.0 + m, dc);
    float L = length(dv);
    float bloom = exp(-L/(rS*1.3 + 0.004))*0.9 + exp(-L/(rS*5.0 + 0.035))*0.14 + exp(-L/0.35)*0.03;
    float ang = 0.42;
    vec2 q = vec2(cos(ang)*dv.x - sin(ang)*dv.y, sin(ang)*dv.x + cos(ang)*dv.y);
    float pw = 1.0/uRes.y, sl = rS*3.5 + 0.025;
    float spikes = (exp(-abs(q.y)/pw)*exp(-abs(q.x)/sl) + exp(-abs(q.x)/pw)*exp(-abs(q.y)/sl))*0.22;
    vec3 flare = mix(tint, vec3(1.0), 0.45)*(bloom + spikes)*vis;
    col += flare;
    alpha = max(alpha, min(1.0, max(flare.r, max(flare.g, flare.b))));
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
      this.cam = { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 }; // 행성 주위를 도는 시점
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
      const focal = (vp.fit * CAM / v.extent) * this.zoom * (0.02 + 0.98 * ease);
      const moons = v.moons.map((m) => {
        const a = m.phase + time * m.speed;
        return M.vec(M.mul(V, M.mul(M.rx(pitch), M.rz(m.incl))), [Math.cos(a) * m.dist, 0, Math.sin(a) * m.dist]).concat(m.r);
      });
      return { R, RC, focal, alpha: Math.min(1, Math.max(0, (time - slot.fadeAt) / 0.6)), ringN: M.vec(tiltM, [0, 1, 0]), moons, light: M.vec(V, LIGHT), V, skyFocal: vp.fit * CAM / v.extent };
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
      f3('uLight', st.light); f1('uStarR', v.starAng || 0.006);
      f1('uSkyFocal', st.skyFocal); f1('uSky', vp.sky ? 1 : 0);
      gl.uniformMatrix3fv(u.uView, false, new Float32Array(st.V)); f3('uLightCol', v.lightCol || [1, 0.96, 0.9]); f3('uSeedOff', v.seedOff);
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
