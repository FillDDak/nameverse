/* node tests/genesis.test.js — 행성 생성기의 결정성·무결성 검사 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console, Math, JSON, String, Array, Object, Number };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['seed.js', 'genesis.js', 'surface.js']) {
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
// 희귀도가 정직한지: '상위 1%'는 대략 1%여야 한다
const mythic = (rar['신화'] || 0) / names.length;
assert(mythic > 0.004 && mythic < 0.02, '신화 등급 비율 ≈1% (' + (mythic * 100).toFixed(2) + '%)');

console.log('생물군계 분포:', counts);
console.log('희귀도 분포:', rar);
const s = NV.genesis('세종대왕');
console.log('\n예시 —', s.planet, '/', s.biome.name, '/', s.rarity.name, s.rarity.topPct + '%');
s.lore.forEach((l) => console.log(' [' + l.title + ']', l.text));
console.log(fails ? `\n${fails}개 실패` : `\n✓ ${names.length}개 이름 모두 통과`);
process.exit(fails ? 1 : 0);
