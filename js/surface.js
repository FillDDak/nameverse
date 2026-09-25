/* NAMEVERSE — 셰이더의 지형 노이즈를 JS로 그대로 옮겨, 클릭한 지점이 바다인지 산인지 알아낸다 */
(function () {
  'use strict';
  const NV = window.NV;
  /* 3D simplex noise — 셰이더(planet-gl.js)의 snoise와 같은 계산 */
  const floor = Math.floor;
  const mod289 = (x) => x - floor((x + 0.5) / 289) * 289;
  const permute = (x) => mod289((x * 34 + 10) * x);
  const step = (e, x) => (x < e ? 0 : 1);
  function snoise(vx, vy, vz) {
    const C1 = 1 / 6, C2 = 1 / 3;
    const s = (vx + vy + vz) * C2;
    let ix = floor(vx + s), iy = floor(vy + s), iz = floor(vz + s);
    const t = (ix + iy + iz) * C1;
    const x0 = vx - ix + t, y0 = vy - iy + t, z0 = vz - iz + t;
    const gx = step(y0, x0), gy = step(z0, y0), gz = step(x0, z0);
    const lx = 1 - gx, ly = 1 - gy, lz = 1 - gz;
    const i1 = [Math.min(gx, lz), Math.min(gy, lx), Math.min(gz, ly)];
    const i2 = [Math.max(gx, lz), Math.max(gy, lx), Math.max(gz, ly)];
    const X = [x0, x0 - i1[0] + C1, x0 - i2[0] + C2, x0 - 0.5];
    const Y = [y0, y0 - i1[1] + C1, y0 - i2[1] + C2, y0 - 0.5];
    const Z = [z0, z0 - i1[2] + C1, z0 - i2[2] + C2, z0 - 0.5];
    ix = mod289(ix); iy = mod289(iy); iz = mod289(iz);
    const oz = [0, i1[2], i2[2], 1], oy = [0, i1[1], i2[1], 1], ox = [0, i1[0], i2[0], 1];
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const p = permute(permute(permute(iz + oz[k]) + iy + oy[k]) + ix + ox[k]);
      const j = p - 49 * floor((p + 0.5) / 49);
      const xi = floor((j + 0.5) / 7), yi = j - 7 * xi;
      const gxk = xi * (2 / 7) + (0.5 / 7 - 1), gyk = yi * (2 / 7) + (0.5 / 7 - 1);
      const h = 1 - Math.abs(gxk) - Math.abs(gyk);
      const sh = h <= 0 ? -1 : 0;
      const ax = gxk + (floor(gxk) * 2 + 1) * sh, ay = gyk + (floor(gyk) * 2 + 1) * sh;
      const nrm = 1.79284291400159 - 0.85373472095314 * (ax * ax + ay * ay + h * h);
      const m = Math.max(0.5 - (X[k] * X[k] + Y[k] * Y[k] + Z[k] * Z[k]), 0);
      sum += m * m * m * m * nrm * (ax * X[k] + ay * Y[k] + h * Z[k]);
    }
    return 105 * sum;
  }
  // M3 회전 후 2.03배 (셰이더의 M3*p*2.03)
  const rot = (p) => [(-0.8 * p[1] - 0.6 * p[2]) * 2.03, (0.8 * p[0] + 0.36 * p[1] - 0.48 * p[2]) * 2.03, (0.6 * p[0] - 0.48 * p[1] + 0.64 * p[2]) * 2.03];
  function fbmN(p, oct) {
    let a = 0.5, s = 0;
    for (let i = 0; i < oct; i++) { s += a * snoise(p[0], p[1], p[2]); p = rot(p); a *= 0.5; }
    return s;
  }
  const HK = 0.53;
  const add = (p, k) => [p[0] + k, p[1] + k, p[2] + k];
  function height(v, lp) {
    const q = [lp[0] * v.scale + v.seedOff[0], lp[1] * v.scale + v.seedOff[1], lp[2] * v.scale + v.seedOff[2]];
    const w = [fbmN(q, 3), fbmN(add(q, 5.2), 3), fbmN(add(q, 9.1), 3)];
    const qw = [q[0] + v.warp * 0.5 * w[0], q[1] + v.warp * 0.5 * w[1], q[2] + v.warp * 0.5 * w[2]];
    let h = 0.5 + HK * fbmN(qw, 6);
    const r = 1 - Math.abs(snoise(qw[0] * 2.3 + 11, qw[1] * 2.3 + 11, qw[2] * 2.3 + 11));
    const t = Math.min(1, Math.max(0, (h - v.sea) / 0.15));
    h += 0.07 * r * r * t * t * (3 - 2 * t);
    return h;
  }

  function classify(world, lp) {
    const v = world.visual;
    if (v.type === 1) {
      const d = Math.hypot(lp[0] - v.storm[0], lp[1] - v.storm[1], lp[2] - v.storm[2]);
      if (d < v.stormSize * 0.7) return 'storm';
      return Math.abs(lp[1]) > 0.8 ? 'gaspole' : 'gas';
    }
    const hh = height(v, lp);
    if (v.type === 2) return hh < v.sea - 0.02 ? 'lava' : (hh > 0.62 ? 'fireHigh' : 'fireLand');
    const lat = Math.abs(lp[1]) + (hh - 0.5) * 0.35;
    if (lat > v.ice + 0.02) return 'ice';
    if (hh < v.sea) return (v.sea - hh) / v.sea > 0.12 ? 'deep' : 'coast';
    if (v.type === 3) return 'ice';
    return hh > 0.72 ? 'peak' : hh > 0.6 ? 'high' : 'land';
  }

  const PREFIX = ['속삭이는', '잠든', '노래하는', '유리', '은빛', '검은', '달빛', '천 개의', '무너진', '떠다니는', '거꾸로 흐르는', '잊혀진', '푸른 불꽃의', '끝없는', '작은', '두 번째', '별이 떨어진', '웃는', '안개 낀', '황금'];
  const KIND = {
    deep: { nouns: ['심연', '대양', '해구', '바다'], icon: '🌊', label: '깊은 바다', fact: (r) => `수심 ${r.int(2, 11)},${r.int(100, 999)}m` },
    coast: { nouns: ['만', '해협', '산호초', '석호', '해안'], icon: '🏝️', label: '얕은 바다', fact: (r) => `수온 ${r.int(4, 31)}°C` },
    land: { nouns: ['평원', '숲', '초원', '계곡', '화원', '분지'], icon: '🌿', label: '대지', fact: (r) => `해발 ${r.int(10, 900)}m` },
    high: { nouns: ['고원', '협곡', '구릉', '대지', '절벽'], icon: '⛰️', label: '고지대', fact: (r) => `해발 ${r.int(1, 4)},${r.int(100, 999)}m` },
    peak: { nouns: ['봉우리', '산맥', '첨탑', '설산'], icon: '🏔️', label: '산악 지대', fact: (r) => `해발 ${r.int(5, 14)},${r.int(100, 999)}m` },
    ice: { nouns: ['빙원', '얼음 성당', '설원', '빙하', '빙붕'], icon: '🧊', label: '얼음 지대', fact: (r) => `얼음 두께 ${r.int(40, 4000)}m` },
    gas: { nouns: ['구름대', '제트기류', '번개 띠', '구름 협곡'], icon: '🌪️', label: '구름 띠', fact: (r) => `풍속 초속 ${r.int(80, 520)}m` },
    gaspole: { nouns: ['극 소용돌이', '오로라 왕관', '육각 폭풍'], icon: '🌀', label: '극지방', fact: (r) => `오로라 발생률 ${r.int(60, 100)}%` },
    storm: { nouns: ['눈', '대적점', '영원한 폭풍'], icon: '🌀', label: '거대 폭풍', fact: (r) => `지속 ${r.int(300, 90000)}년째` },
    lava: { nouns: ['용암 호수', '불의 강', '마그마 바다'], icon: '🌋', label: '용암 지대', fact: (r) => `온도 ${r.int(900, 1600)}°C` },
    fireLand: { nouns: ['유리 사막', '흑요석 평원', '재의 들판'], icon: '🪨', label: '굳은 대지', fact: (r) => `지표 온도 ${r.int(120, 480)}°C` },
    fireHigh: { nouns: ['수정 산맥', '흑요석 탑', '결정 협곡'], icon: '💎', label: '결정 고원', fact: (r) => `결정 높이 ${r.int(30, 900)}m` },
  };

  function probe(world, lp) {
    const kind = classify(world, lp);
    const lat = Math.asin(Math.max(-1, Math.min(1, lp[1]))) * 180 / Math.PI;
    const lon = Math.atan2(lp[0], lp[2]) * 180 / Math.PI;
    const r = NV.makeRng(`${world.key}/place/${Math.round(lat / 4)}/${Math.round(lon / 4)}/${kind}`);
    const k = KIND[kind];
    return {
      kind, icon: k.icon, label: k.label,
      name: `${r.pick(PREFIX)} ${r.pick(k.nouns)}`,
      fact: k.fact(r),
      coord: `${lat >= 0 ? '북위' : '남위'} ${Math.abs(lat).toFixed(1)}° · ${lon >= 0 ? '동경' : '서경'} ${Math.abs(lon).toFixed(1)}°`,
    };
  }

  NV.probe = probe;
  NV._noise = { snoise, fbmN, height };
})();
