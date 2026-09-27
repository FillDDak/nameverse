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

  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // y축(자전축)을 중심으로 a만큼 돌린다: 뜨거운 목성의 가장 뜨거운 곳 (planet-gl.js의 uHot과 같은 회전)
  const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

  /* 셰이더(planet-gl.js shadePlanet)와 같은 식으로 그 지점이 무엇으로 그려졌는지 가른다.
   * L: 행성 로컬 좌표에서 모항성 방향 (조석 고정된 행성의 얼음·마그마 바다는 별을 마주한 정도로 정해진다) */
  function classify(world, lp, L) {
    const v = world.visual;
    const ndl = lp[0] * L[0] + lp[1] * L[1] + lp[2] * L[2];
    if (v.type === 1) {
      // 가스 행성의 온도는 가장 뜨거운 곳(동쪽으로 밀린 곳)을 마주한 정도로 정해진다
      const H = v.therm && v.therm.shift ? rotY(L, v.therm.shift) : L;
      const s = lp[0] * H[0] + lp[1] * H[1] + lp[2] * H[2];
      const id = world.biome.id;
      if (id === 'venus' || id === 'subneptune') return { kind: id === 'venus' ? 'cloud' : 'haze', ndl, s };
      const d = Math.hypot(lp[0] - v.storm[0], lp[1] - v.storm[1], lp[2] - v.storm[2]);
      if (d < v.stormSize * 0.65) return { kind: 'storm', ndl, s };
      return { kind: Math.abs(lp[1]) > 0.8 ? 'gaspole' : 'gas', ndl, s };
    }
    const hh = height(v, lp);
    const q = [lp[0] * v.scale + v.seedOff[0], lp[1] * v.scale + v.seedOff[1], lp[2] * v.scale + v.seedOff[2]];
    const out = (kind, s) => ({ kind, hh, ndl, s: s == null ? ndl : s });
    if (v.type === 2) {
      // 조석 고정된 용암 행성은 낮 쪽이 마그마 바다, 밤 쪽의 낮은 곳은 빛이 꺼진 채 식어 있다. 수정 행성의 낮은 곳은 빛나지 않는다
      const seaL = v.sea + (v.locked ? 0.3 * Math.max(ndl, 0) : 0);
      const lit = v.locked ? smooth(-0.45, 0.1, ndl) : 1;
      if (hh < seaL - 0.025 && lit > 0.5 && v.spec < 0.5) return out('lava');
      return out(hh > 0.62 ? 'fireHigh' : 'fireLand');
    }
    let ice, s = null;
    if (v.locked) {
      // 별을 마주한 정도(높은 땅일수록 먼저 언다)가 얼음 경계보다 작으면 얼음
      s = ndl - (hh - 0.5) * 0.25 + 0.05 * snoise(q[0] * 4, q[1] * 4, q[2] * 4);
      ice = s < (v.lockIce != null ? v.lockIce : -2) - 0.01;
    } else {
      const lat = Math.abs(lp[1]) + (hh - 0.5) * 0.35 + 0.03 * snoise(q[0] * 5, q[1] * 5, q[2] * 5);
      ice = lat > v.ice + 0.01;
    }
    if (ice) return out('ice', s);
    if (hh < v.sea) return out(v.type === 3 ? 'seaice' : (v.sea - hh) / v.sea > 0.12 ? 'deep' : 'coast', s);
    if (v.type === 3) return out('ice', s);
    return out(hh > 0.72 ? 'peak' : hh > 0.6 ? 'high' : 'land', s);
  }

  /* 그 지점의 추정 기온(K). genesis.js의 온도 분포(v.therm)를 그대로 쓴다 — 셰이더의 얼음 경계·열복사와 같은 식
   *   조석 고정: T⁴ = Tn⁴ + (Ts⁴ − Tn⁴)·s (s = 별을, 뜨거운 목성은 가장 뜨거운 곳을 마주한 정도. 밤 쪽은 Tn)
   *   자전: 위도별 연평균 햇빛 1.241 − 0.723·sin²(위도)의 ¼제곱 · 스스로 빛나는 행성: 고르게
   *   gh: 두꺼운 대기의 온실 효과 (지구 비율 1.13) */
  function surfaceTemp(world, lp, c) {
    const th = world.visual.therm;
    if (!th) return null;
    if (th.Tint) return th.Tint;
    if (th.locked) { const n4 = Math.pow(th.Tn, 4); return th.gh * Math.pow(n4 + (Math.pow(th.Ts, 4) - n4) * Math.max(c.s, 0), 0.25); }
    return th.gh * th.Tm * Math.pow(Math.max(0.05, 1.241 - 0.723 * lp[1] * lp[1]), 0.25);
  }

  const num = (m) => Math.round(m).toLocaleString('ko-KR');
  const degC = (k) => `${Math.round(k - 273.15)}°C`;

  const LIFE = new Set(['ocean', 'garden', 'alien', 'coral']); // 생명이 있을 수 있는 행성의 생물군계
  const PREFIX = ['속삭이는', '잠든', '노래하는', '유리', '은빛', '검은', '달빛', '천 개의', '무너진', '떠다니는', '거꾸로 흐르는', '잊혀진', '푸른 불꽃의', '끝없는', '작은', '두 번째', '별이 떨어진', '웃는', '안개 낀', '황금'];
  // 지명(nouns)은 상상이지만 수치(fact)는 그 행성의 온도·중력·지형으로 계산한다. x: probe()가 만든 값
  const temp = (x) => x.T != null && `${x.v.airless ? '지표 온도' : '기온'} 약 ${degC(x.T)}`; // 대기가 없으면 '기온'이라 할 수 없다
  // 드러난 바다의 수면은 −1.9°C보다 차가워지면 얼고, 끓는점(1기압 100°C)보다 뜨거워질 수 없다
  const water = (x) => x.T != null && `수온 약 ${degC(Math.min(Math.max(x.T, 271.3), 373.15))}`;
  const airTemp = (x) => x.T != null && `${x.v.therm && x.v.therm.Tint ? '스스로 내는 열' : '대기 온도'} 약 ${degC(x.T)}`;
  // 뜨거운 목성의 바람은 초속 수 km, 목성·해왕성은 초속 수백 m
  const wind = (x) => `바람 초속 약 ${num(x.hot ? x.r.int(10, 50) * 100 : x.r.int(10, 60) * 10)}m`;
  const KIND = {
    deep: { nouns: ['심연', '대양', '해구', '바다'], icon: '🌊', label: '깊은 바다', fact: (x) => [`수심 약 ${num(x.depth)}m`, water(x) && '표층 ' + water(x)] },
    coast: { nouns: ['만', '해협', '산호초', '석호', '해안'], icon: '🏝️', label: '얕은 바다', fact: (x) => [`수심 약 ${num(x.depth)}m`, water(x)] },
    // barren: 생명이 살기 어려운 행성의 지명 (숲·초원·설산 같은 이름은 쓰지 않는다)
    land: { nouns: ['평원', '숲', '초원', '계곡', '화원', '분지'], barren: ['평원', '분지', '계곡', '자갈 벌판', '먼지 평원'], icon: '🌿', label: '대지', fact: (x) => [x.elevText, temp(x)] },
    high: { nouns: ['고원', '협곡', '구릉', '대지', '절벽'], barren: ['고원', '협곡', '구릉', '대지', '절벽'], icon: '⛰️', label: '고지대', fact: (x) => [x.elevText, temp(x)] },
    peak: { nouns: ['봉우리', '산맥', '첨탑', '설산'], barren: ['봉우리', '산맥', '첨탑', '능선'], icon: '🏔️', label: '산악 지대', fact: (x) => [x.elevText, temp(x)] },
    ice: { nouns: ['빙원', '얼음 성당', '설원', '빙하', '빙붕'], icon: '🧊', label: '얼음 지대', fact: (x) => [x.onSea ? '바다를 덮은 얼음' : x.elevText, temp(x)] },
    seaice: { nouns: ['빙원', '빙붕', '얼음 바다', '유빙 지대'], icon: '🧊', label: '얼어붙은 바다', fact: (x) => ['바다를 덮은 얼음', temp(x)] },
    gas: { nouns: ['구름대', '제트기류', '번개 띠', '구름 협곡'], icon: '🌪️', label: '구름 띠', fact: (x) => [airTemp(x), wind(x)] },
    gaspole: { nouns: ['극 소용돌이', '오로라 왕관', '육각 폭풍'], icon: '🌀', label: '극지방', fact: (x) => [airTemp(x), wind(x)] },
    // 서브넵튠의 연무, 금성형 행성의 구름 (금성: 구름 꼭대기 약 −40°C, 지표 약 460°C)
    haze: { nouns: ['연무 바다', '안개 띠', '흐린 구름대'], icon: '🌫️', label: '짙은 연무층', fact: (x) => [x.T != null && `연무층 온도 약 ${degC(x.T)}`, wind(x)] },
    cloud: { nouns: ['구름 바다', '황산 구름대', '구름 협곡'], icon: '☁️', label: '두꺼운 구름층', fact: (x) => [x.T != null && `구름 꼭대기 약 ${degC(x.T)}`, '구름 아래 지표는 수백 °C로 추정'] },
    storm: { nouns: ['눈', '대적점', '영원한 폭풍'], icon: '🌀', label: '거대 폭풍', fact: (x) => [`지름 약 ${num(Math.round(NV.stormKm(x.v, x.p) / 100) * 100)}km`] },
    // 드러난 용암은 1,000°C 안팎에서 굳는다: 표면 온도가 그보다 낮게 계산되면(밤 쪽 경계 등) 용암 자체의 온도를 알려 준다
    lava: { nouns: ['용암 호수', '불의 강', '마그마 바다'], icon: '🌋', label: '용암 지대', fact: (x) => [`온도 약 ${degC(Math.max(x.T || 0, 1373))}`] },
    fireLand: { nouns: ['유리 사막', '흑요석 평원', '재의 들판'], icon: '🪨', label: '굳은 대지', fact: (x) => [x.elevText, x.T != null && `지표 온도 약 ${degC(x.T)}`] },
    fireHigh: { nouns: ['수정 산맥', '흑요석 탑', '결정 협곡'], icon: '💎', label: '결정 고원', fact: (x) => [x.elevText, x.T != null && `지표 온도 약 ${degC(x.T)}`] },
  };

  // light: 행성 로컬 좌표의 모항성 방향 (renderer.pick이 돌려준다)
  function probe(world, lp, light) {
    const v = world.visual, p = world.exo;
    const c = classify(world, lp, light || [0, 0, 1]); // 렌더러 없이 부르면(테스트) 모항성이 화면 쪽에 있다고 본다
    const kind = c.kind;
    const lat = Math.asin(Math.max(-1, Math.min(1, lp[1]))) * 180 / Math.PI;
    const lon = Math.atan2(lp[0], lp[2]) * 180 / Math.PI;
    const r = NV.makeRng(`${world.key}/place/${Math.round(lat / 4)}/${Math.round(lon / 4)}/${kind}`);
    const k = KIND[kind];
    const x = { r, v, p, hot: p.eqt != null && p.eqt > 1000, T: surfaceTemp(world, lp, c) };
    if (v.type !== 1) {
      // 산이 버틸 수 있는 높이와 바다의 깊이는 표면 중력에 반비례한다 (지구: 에베레스트 8.8km, 마리아나 해구 11km).
      // 화성(중력 0.38)의 올림푸스 산이 22km인 것과 맞는다. 아주 작은 천체에서는 이 비례가 깨지므로 25km에서 멈춘다
      const g = Math.max(0.05, p.masse / (p.rade * p.rade));
      const oceans = v.sea >= 0.2 && v.type !== 2;
      const ref = oceans || v.type === 2 ? v.sea : 0.5; // 바다(용암 호수)의 수면, 없으면 평균 지표면
      const up = (c.hh - ref) / Math.max(0.95 - ref, 0.2);
      const elev = Math.sign(up) * Math.min(8800 / g, 25000) * Math.pow(Math.min(Math.abs(up), 1), 1.3);
      x.elevText = `${oceans ? '해발' : '고도'} 약 ${num(Math.round(elev / 10) * 10 || 0)}m`; // −0은 0으로
      x.depth = Math.max(10, Math.round(Math.min(11000 / g, 25000) * Math.pow(Math.min(Math.max(v.sea - c.hh, 0) / 0.45, 1), 1.5) / 10) * 10);
      x.onSea = c.hh < v.sea;
      // 높이 올라갈수록 기온이 내려간다: 지구는 1km에 6.5°C, 중력에 비례
      if (x.T != null && elev > 0 && !x.onSea) x.T = Math.max(x.T - 6.5 * g * elev / 1000, 3);
    }
    // 현무암이 녹는 1,200°C보다 뜨거운 곳은 '굳은' 대지라고 할 수 없다
    const label = kind === 'fireLand' && x.T != null && x.T >= 1473 ? '달아오른 대지' : k.label;
    return {
      kind, icon: k.icon, label,
      name: `${r.pick(PREFIX)} ${r.pick(k.barren && !LIFE.has(world.biome.id) ? k.barren : k.nouns)}`,
      fact: k.fact(x).filter(Boolean).join(' · ') || k.label,
      coord: `${lat >= 0 ? '북위' : '남위'} ${Math.abs(lat).toFixed(1)}° · ${lon >= 0 ? '동경' : '서경'} ${Math.abs(lon).toFixed(1)}°`,
    };
  }

  NV.probe = probe;
  NV._noise = { snoise, fbmN, height };
})();
