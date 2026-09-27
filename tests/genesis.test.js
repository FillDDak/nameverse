/* node tests/genesis.test.js — 행성 생성기의 결정성·무결성 검사 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console, Math, JSON, String, Array, Object, Number };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['seed.js', 'exoplanets.js', 'genesis.js', 'surface.js', 'planet-gl.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
}
const NV = ctx.NV;
let fails = 0;
const assert = (cond, msg) => { if (!cond) { fails++; console.error('✗', msg); } };

// 1) 같은 이름 → 같은 행성 (대소문자·공백 무시)
const a = JSON.stringify(NV.genesis('세종대왕'));
assert(a === JSON.stringify(NV.genesis('세종대왕')), '결정성');
assert(NV.genesis('Alice').planet === NV.genesis('  alice ').planet, '대소문자/공백 정규화');

// 2) 대량 무결성 검사
const syl = '가나다라마바사아자차카타파하김이박최정강조윤장임한오서신권황안송류홍';
const counts = {}, rar = {};
const names = [];
for (let i = 0; i < 5000; i++) {
  let n = '';
  const len = 1 + (i % 4);
  for (let j = 0; j < len; j++) n += syl[(i * 7 + j * 13 + (i >> 3)) % syl.length];
  names.push(n + (i % 5 === 0 ? ' ' + i : ''), 'user' + i);
}
names.push('Einstein', 'BTS', '🐱', '!!!', '1', 'a'.repeat(40), '이순신', '홍길동');
for (const n of names) {
  const w = NV.genesis(n);
  const text = JSON.stringify([w.lore, w.stats, w.proverb, w.role, w.tags, w.planet, w.catalog]);
  assert(!/undefined|NaN|null|\{\w+/.test(text), `텍스트 오류 (${n}): ${text.slice(0, 300)}`);
  const v = w.visual;
  const nums = [v.sea, v.clouds, v.ice, v.city, v.warp, v.scale, v.atmoStr, v.spin, v.extent, v.tilt, ...v.seedOff, ...v.deep, ...v.atmo, ...v.emit];
  assert(nums.every(Number.isFinite), `시각 파라미터 NaN (${n})`);
  assert(v.moons.length <= 3, '위성 3개 이하');
  assert(v.extent >= 1.28 && v.extent <= 2.95, `extent 범위 (${n}) ${v.extent}`);
  counts[w.biome.id] = (counts[w.biome.id] || 0) + 1;
  rar[w.rarity.name] = (rar[w.rarity.name] || 0) + 1;
  const p = NV.probe(w, [0.3, 0.5, Math.sqrt(1 - 0.34)]);
  assert(p.name && p.coord && p.fact && !/undefined/.test(p.name + p.fact), `probe (${n})`);
}

// 3) 궁합: 대칭성
const h1 = NV.harmony(NV.genesis('철수'), NV.genesis('영희'));
const h2 = NV.harmony(NV.genesis('영희'), NV.genesis('철수'));
assert(h1.score === h2.score, '궁합 대칭');
assert(NV.harmony(NV.genesis('나'), NV.genesis('나')).score === 100, '거울 행성 100%');

// 4) 조사
assert(NV.josa('세종대왕', '이라는/라는') === '세종대왕이라는', '조사 받침');
assert(NV.josa('아이유', '이라는/라는') === '아이유라는', '조사 무받침');
assert(NV.josa('서울', '으로/로') === '서울로', '조사 ㄹ');
assert(NV.josa('에라 c', '이었습니다/였습니다') === '에라 c였습니다', '알파벳 글자 이름');
assert(NV.josa('벨로 m', '이라는/라는') === '벨로 m이라는', '알파벳 글자 이름 받침');
assert(NV.josa('Bob', '이라는/라는') === 'Bob이라는', '영단어 받침');
// 희귀도가 정직한지: '상위 1% 미만'은 대략 0.9%여야 한다 (테스트 이름은 중복이 많아 따로 뽑는다)
let myth = 0;
for (let i = 0; i < 40000; i++) if (NV.genesis('rarity-check-' + i).rarity.name === '신화') myth++;
const mythic = myth / 40000;
assert(mythic > 0.006 && mythic < 0.012, '신화 등급 비율 ≈0.9% (' + (mythic * 100).toFixed(2) + '%)');

// 5) 실제 외계행성 데이터
const E = NV.EXO;
assert(E.rows.length > 5000, '외계행성 목록 ' + E.rows.length + '개');
for (let i = 0; i < E.rows.length; i++) {
  const w = NV.genesis('데이터 검사', i);
  const text = JSON.stringify([w.lore, w.stats, w.planet, w.coords, w.constellation]);
  if (/undefined|NaN|null|\{\w+/.test(text)) { assert(false, `외계행성 텍스트 오류 (${E.rows[i][0]}): ${text.slice(0, 300)}`); break; }
  const v = w.visual;
  if (![...v.deep, ...v.atmo, ...v.lightCol, v.sea, v.ice].every(Number.isFinite)) { assert(false, `외계행성 시각 파라미터 (${E.rows[i][0]})`); break; }
}
const trap = E.rows.findIndex((r) => r[0] === 'TRAPPIST-1 e');
const tw = NV.genesis('x', trap);
assert(tw.constellation === '물병' && tw.rarity.name === '신화', 'TRAPPIST-1 e: 물병자리 · 신화');
assert(NV.genesis('홍길동').exoIndex === NV.genesis('홍길동').exoIndex, '같은 이름 → 같은 실제 행성');

// 6) 사실 오류 회귀 검사
const at = (name) => NV.genesis('x', E.rows.findIndex((r) => r[0] === name));
const sky = (w) => w.lore.find((l) => l.title === '하늘').text;
const env = (w) => w.lore.find((l) => l.title === '환경').text;
for (const n of ['KIC 7917485 b', 'V0391 Peg b']) {
  const w = at(n); // 맥동하는 별(펄서 아님)
  assert(w.biome.id !== 'crystal' && !/펄서/.test(w.rarity.reason + sky(w)), `${n}: 펄서로 다루지 않음`);
}
assert(at('PSR B1620-26 b').biome.id === 'gas', '목성만 한 펄서 행성은 가스 행성');
assert(at('PSR B1257+12 c').visual.starGlow < 0.5 && /펄서/.test(sky(at('PSR B1257+12 c'))), '펄서 하늘에는 밝은 해가 없음');
for (let i = 0; i < E.rows.length; i++) {
  const r = E.rows[i];
  if (r[3] >= 3.88 && r[3] < 6 && r[4] < 50 && /해왕성보다 작은/.test(env(NV.genesis('x', i)))) { assert(false, `${r[0]}: 해왕성보다 큰데 작다고 씀`); break; }
}
for (const n of ['HD 18438 b', 'HD 112300 b']) {
  const w = at(n); // 적색거성
  assert(!w.visual.flare && !/적색왜성/.test(sky(w)) && /적색거성/.test(sky(w)), `${n}: 적색거성, 플레어 없음`);
}
assert(at('AU Mic b').visual.flare, 'AU Mic(어린 적색왜성): 플레어');
assert(/백색왜성/.test(sky(at('DP Leo b'))) && !/0배/.test(sky(at('DP Leo b'))), 'DP Leo: 백색왜성, 크기 0배 아님');
assert(/준왜성/.test(sky(at('V0391 Peg b'))), 'V0391 Peg: 준왜성');
assert(/갈색왜성/.test(sky(at('CD-35 2722 B b'))), 'CD-35 2722 B: 갈색왜성');
assert(/K형 거성/.test(sky(at('tau Gem b'))), 'tau Gem: K형 거성');
// 폭풍 크기는 행성 크기를 넘지 않는다
for (let i = 0; i < E.rows.length; i++) {
  const w = NV.genesis('x', i);
  if (w.biome.id === 'gas' && NV.stormKm(w.visual, w.exo) > w.exo.rade * 12742 * 0.5) { assert(false, `${w.planet}: 폭풍이 너무 큼`); break; }
}
// 지표 탐사: 조석 고정된 눈알 행성은 별을 등진 쪽이 얼음, 마주한 쪽은 얼음이 아니다 (셰이더와 같은 판정)
const tr = at('TRAPPIST-1 e'), Ld = [0, 0, 1];
assert(NV.probe(tr, [0, 0, -1], Ld).kind === 'ice', 'TRAPPIST-1 e 밤 쪽 = 얼음');
assert(NV.probe(tr, [0, 0, 1], Ld).kind !== 'ice', 'TRAPPIST-1 e 별을 마주한 곳 ≠ 얼음');
// 7) 물리 판정: 관측으로 알려진 행성들
const bio = (n) => at(n).biome.id;
for (const n of ['TRAPPIST-1 b', 'LHS 3844 b', 'GJ 1132 b']) assert(bio(n) === 'airless', `${n}: 대기 없음 (JWST)`);
assert(bio('GJ 1214 b') === 'subneptune', 'GJ 1214 b: 연무에 싸인 서브넵튠');
assert(bio('LHS 1140 b') === 'ocean', 'LHS 1140 b: 물 행성 후보');
for (const n of ['55 Cnc e', 'Kepler-10 b', 'Kepler-78 b']) assert(bio(n) === 'lava', `${n}: 용암`);
const luma = (c) => 0.3 * c[0] + 0.5 * c[1] + 0.2 * c[2];
assert(luma(at('HD 189733 b').visual.shallow) < 0.25, 'HD 189733 b: 알칼리 금속이 빛을 삼켜 어둡다 (Sudarsky IV)');
assert(at('70 Vir b').visual.shallow[2] > at('70 Vir b').visual.shallow[0], '70 Vir b: 구름 없는 푸른 가스 행성 (Sudarsky III)');
assert(luma(at('47 UMa b').visual.shallow) > 0.8, '47 UMa b: 물 구름의 흰색 (Sudarsky II)');
const hj = at('HD 189733 b').visual;
assert(hj.locked && hj.spin === 0 && hj.therm.shift > 0, '뜨거운 목성: 조석 고정, 가장 뜨거운 곳이 동쪽으로');
assert(at('KELT-9 b').visual.thermMode === 1 && at('HR 8799 b').visual.thermMode === 3, '열복사: 초고온 목성은 낮 쪽이, 촬영된 젊은 행성은 스스로 빛남');
assert(at('HD 189733 b').visual.thermMode === 0 || Math.max(...at('HD 189733 b').visual.thermA) < 1e30, '열복사 계수 유한');
assert(/초저밀도/.test(env(at('Kepler-51 d'))), 'Kepler-51 d: 초저밀도 행성');
assert(/갈색왜성일 수도/.test(env(at('11 Com b'))), '11 Com b: 목성 13배 경계');
const ogle = at('OGLE-2005-BLG-390L b');
assert(ogle.exo.hostEst && ogle.exo.eqt < 100 && /어림/.test(sky(ogle)), '미세중력렌즈: 모항성을 질량으로 어림, 차가운 행성');
assert(/후보/.test(env(at('Kepler-442 b'))) && at('Kepler-442 b').lore.find((l) => l.title === '생명').text.startsWith('생명이 있다면'), 'Kepler-442 b: 생명 가능 영역의 암석 행성');
// 조석 고정 행성의 온도 분포는 에너지를 보존한다: 표면 전체의 T⁴ 평균 = 평형 온도⁴ (밤 쪽 최저 온도를 받친 행성은 조금 크다)
for (const n of ['TRAPPIST-1 e', 'Proxima Cen b', 'HD 189733 b', 'WASP-12 b']) {
  const th = at(n).visual.therm, n4 = th.Tn ** 4, d4 = th.Ts ** 4 - n4;
  const mean = n4 + d4 / 4; // 반구의 μ 평균 1/2, 낮 쪽은 표면의 절반
  assert(Math.abs(mean / th.Tm ** 4 - 1) < 0.01, `${n}: 온도 분포의 에너지 보존 (${(mean / th.Tm ** 4).toFixed(3)})`);
}
// 대기가 없으면 유성·오로라 현상이 없고, 지표 탐사는 '기온'이라 하지 않는다. 희귀도 이유는 생명 가능 영역 판정과 맞는다
for (let i = 0; i < E.rows.length; i++) {
  const w = NV.genesis('x', i), ph = w.lore.find((l) => l.title === '현상').text;
  if (w.visual.airless && /유성|오로라/.test(ph)) { assert(false, `${w.planet}: 대기 없는데 ${ph}`); break; }
  if (w.rarity.reason === '생명 가능 영역의 암석 행성' && !/생명 가능 영역\(?[^)]*\)? 안에/.test(env(w))) { assert(false, `${w.planet}: 희귀도 이유와 생명 가능 영역 판정이 다름`); break; }
}
assert(!/기온/.test(NV.probe(at('LHS 3844 b'), [0, 0, 1], [0, 0, 1]).fact), '대기 없는 행성의 지표 탐사: 지표 온도');

// 지표 탐사 수치는 행성과 맞아야 한다: 바다 −2~100°C, 얼음은 영하
let pseed = 7;
const prnd = () => { pseed = (pseed * 16807) % 2147483647; return pseed / 2147483647; };
const pdir = () => { const u = prnd() * 2 - 1, t = prnd() * 6.283, s = Math.sqrt(1 - u * u); return [s * Math.cos(t), u, s * Math.sin(t)]; };
for (let i = 0; i < E.rows.length; i += 3) {
  const w = NV.genesis('x', i), pr = NV.probe(w, pdir(), pdir());
  const m = /(?:기온|수온) 약 (-?\d+)°C/.exec(pr.fact), t = m && +m[1];
  if (t != null && ((pr.kind === 'coast' || pr.kind === 'deep') && (t < -2 || t > 100) || pr.kind === 'ice' && t > 5)) { assert(false, `${w.planet}: ${pr.label} ${pr.fact}`); break; }
}

// 하늘: 이 행성에서 본 태양 (프록시마 켄타우리에서 태양은 카시오페이아자리의 0.4등급 별)
{
  const w = at('Proxima Cen b');
  assert(Math.abs(w.visual.sun.mag - 0.4) < 0.1 && /카시오페이아자리 쪽/.test(w.lore.find((l) => l.sky).text), 'Proxima Cen b: 태양 0.4등급, 카시오페이아자리');
  // 트랜싯 순간 태양은 모항성 반대쪽(궤도 경사만큼 벗어남), 1/4 주기 뒤에는 옆쪽
  const PR = NV.PlanetRenderer.prototype, L = NV.LIGHT;
  for (const n of ['TRAPPIST-1 f', 'HD 189733 b']) {
    const v = at(n).visual, self = { skyQ: new WeakMap() };
    const sunDot = (k) => { const s = PR._sky.call(self, v, v.orbit.T0 - 2440587.5 + k * v.orbit.Pt), d = s.toW(v.sun.eq); return -(d[0] * L[0] + d[1] * L[1] + d[2] * L[2]); };
    const want = Math.sin(v.orbit.incl * Math.PI / 180);
    assert(Math.abs(sunDot(0) - want) < 1e-3 && Math.abs(sunDot(57) - want) < 1e-3 && Math.abs(sunDot(0.25)) < 0.02, `${n}: 트랜싯 시각의 태양 방향`);
  }
  // 레일리 산란: 붉은 별 아래 맑은 대기는 거의 무채색, 태양 같은 별 아래는 그대로
  const satOf = (c) => 1 - Math.min(...c) / Math.max(...c);
  for (let i = 0; i < E.rows.length; i++) {
    const w = NV.genesis('x', i), v = w.visual;
    if (!v.rayleigh) continue;
    if (E.rows[i][12] != null && E.rows[i][12] < 3300 && satOf(v.atmo) > 0.2) { assert(false, `${w.planet}: 적색왜성 아래 하늘색 채도 ${satOf(v.atmo).toFixed(2)}`); break; }
    if (Math.abs(E.rows[i][12] - 5772) < 150 && v.atmo.some((x, k) => Math.abs(x - v.atmoUI[k]) > 0.03)) { assert(false, `${w.planet}: 태양 같은 별인데 하늘색이 바뀜`); break; }
  }
}

console.log('생물군계 분포:', counts);
console.log('희귀도 분포:', rar);
const s = NV.genesis('세종대왕');
console.log('\n예시 —', s.planet, '/', s.biome.name, '/', s.rarity.name, s.rarity.topPct + '%');
s.lore.forEach((l) => console.log(' [' + l.title + ']', l.text));
console.log(fails ? `\n${fails}개 실패` : `\n✓ ${names.length}개 이름 모두 통과`);
process.exit(fails ? 1 : 0);
