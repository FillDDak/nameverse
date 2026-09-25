/* NAMEVERSE — 셰이더의 지형 노이즈를 JS로 그대로 옮겨, 클릭한 지점이 바다인지 산인지 알아낸다 */
(function () {
  'use strict';
  const NV = window.NV;
  const fract = (x) => x - Math.floor(x);

  function hash(x, y, z) {
    x = fract(x * 0.3183099 + 0.1) * 17; y = fract(y * 0.3183099 + 0.1) * 17; z = fract(z * 0.3183099 + 0.1) * 17;
    return fract(x * y * z * (x + y + z));
  }
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    return L(
      L(L(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), L(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
      L(L(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), L(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
      fz);
  }
  function fbm(x, y, z) {
    let a = 0.5, s = 0;
    for (let i = 0; i < 6; i++) { s += a * noise(x, y, z); x = x * 2.02 + 1.7; y = y * 2.02 + 9.2; z = z * 2.02 + 3.1; a *= 0.5; }
    return s;
  }
  function fbm3(x, y, z) {
    let a = 0.5, s = 0;
    for (let i = 0; i < 3; i++) { s += a * noise(x, y, z); x = x * 2.03 + 4.1; y = y * 2.03 + 2.3; z = z * 2.03 + 7.7; a *= 0.5; }
    return s / 0.875;
  }
  function height(v, lp) {
    const q = [lp[0] * v.scale + v.seedOff[0], lp[1] * v.scale + v.seedOff[1], lp[2] * v.scale + v.seedOff[2]];
    const w0 = fbm3(q[0], q[1], q[2]) - 0.5;
    const w1 = fbm3(q[0] + 5.2, q[1] + 5.2, q[2] + 5.2) - 0.5;
    const w2 = fbm3(q[0] + 9.1, q[1] + 9.1, q[2] + 9.1) - 0.5;
    return fbm(q[0] + v.warp * w0, q[1] + v.warp * w1, q[2] + v.warp * w2);
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
    const e = (hh - v.sea) / (1 - v.sea);
    if (v.type === 3) return 'ice';
    return e > 0.3 ? 'peak' : e > 0.12 ? 'high' : 'land';
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
  NV._noise = { hash, noise, fbm, fbm3, height };
})();
