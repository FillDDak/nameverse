/* node tools/build-exoplanets.js — NASA Exoplanet Archive에서 확인된 외계행성 목록을 받아 js/exoplanets.js를 만든다.
 *
 * ⚠️ 이름 → 행성 연결은 이 파일이 만드는 목록의 '순서'에 달려 있다.
 *    다시 실행하면 목록이 바뀌어 이미 공유된 링크의 행성이 달라지므로, 데이터를 갱신할 때만 실행한다.
 */
const fs = require('fs');
const path = require('path');

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const COLS = 'pl_name,hostname,sy_dist,pl_rade,pl_bmasse,pl_bmassprov,pl_orbper,pl_orbsmax,pl_orbeccen,pl_eqt,pl_insol,'
  + 'st_teff,st_rad,st_mass,sy_snum,sy_pnum,disc_year,discoverymethod,disc_facility,ra,dec,pl_controv_flag';
// IAU 별자리 경계 (Roman 1987, B1875 좌표계)
const BOUNDS = 'https://cdsarc.cds.unistra.fr/ftp/VI/42/data.dat';

const CON_KO = {
  And: '안드로메다', Ant: '공기펌프', Aps: '극락조', Aqr: '물병', Aql: '독수리', Ara: '제단', Ari: '양', Aur: '마차부',
  Boo: '목동', Cae: '조각칼', Cam: '기린', Cnc: '게', CVn: '사냥개', CMa: '큰개', CMi: '작은개', Cap: '염소',
  Car: '용골', Cas: '카시오페이아', Cen: '켄타우루스', Cep: '케페우스', Cet: '고래', Cha: '카멜레온', Cir: '컴퍼스', Col: '비둘기',
  Com: '머리털', CrA: '남쪽왕관', CrB: '북쪽왕관', Crv: '까마귀', Crt: '컵', Cru: '남십자', Cyg: '백조', Del: '돌고래',
  Dor: '황새치', Dra: '용', Equ: '조랑말', Eri: '에리다누스', For: '화로', Gem: '쌍둥이', Gru: '두루미', Her: '헤라클레스',
  Hor: '시계', Hya: '바다뱀', Hyi: '물뱀', Ind: '인디언', Lac: '도마뱀', Leo: '사자', LMi: '작은사자', Lep: '토끼',
  Lib: '천칭', Lup: '이리', Lyn: '살쾡이', Lyr: '거문고', Men: '테이블산', Mic: '현미경', Mon: '외뿔소', Mus: '파리',
  Nor: '직각자', Oct: '팔분의', Oph: '뱀주인', Ori: '오리온', Pav: '공작', Peg: '페가수스', Per: '페르세우스', Phe: '봉황',
  Pic: '화가', Psc: '물고기', PsA: '남쪽물고기', Pup: '고물', Pyx: '나침반', Ret: '그물', Sge: '화살', Sgr: '궁수',
  Sco: '전갈', Scl: '조각가', Sct: '방패', Ser: '뱀', Sex: '육분의', Tau: '황소', Tel: '망원경', Tri: '삼각형',
  TrA: '남쪽삼각형', Tuc: '큰부리새', UMa: '큰곰', UMi: '작은곰', Vel: '돛', Vir: '처녀', Vol: '날치', Vul: '여우',
};

const METHOD_KO = {
  'Transit': '트랜싯', 'Radial Velocity': '시선속도', 'Microlensing': '미세중력렌즈', 'Imaging': '직접 촬영',
  'Transit Timing Variations': '트랜싯 시간 변화', 'Eclipse Timing Variations': '식 시간 변화', 'Pulsar Timing': '펄서 타이밍',
  'Orbital Brightness Modulation': '궤도 밝기 변화', 'Pulsation Timing Variations': '맥동 시간 변화', 'Astrometry': '위치 천문',
  'Disk Kinematics': '원반 운동학',
};

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split('\n')) {
    const out = []; let cur = '', q = false;
    for (const ch of line.replace(/\r$/, '')) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    rows.push(out);
  }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const num = (s) => (s === '' || s == null ? null : Number(s));

// J2000 → B1875 세차 (IAU 1976)
function toB1875(raDeg, decDeg) {
  const T = -1.25, as = Math.PI / 180 / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  const A = Math.cos(dec) * Math.sin(ra + zeta);
  const B = Math.cos(th) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(th) * Math.sin(dec);
  const C = Math.sin(th) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(th) * Math.sin(dec);
  let ra2 = (Math.atan2(A, B) + z) * 180 / Math.PI;
  ra2 = ((ra2 % 360) + 360) % 360;
  return [ra2 / 15, Math.asin(C) * 180 / Math.PI];
}
function constellation(bounds, raDeg, decDeg) {
  const [h, d] = toB1875(raDeg, decDeg);
  for (const b of bounds) if (d >= b.dec && h >= b.ra0 && h < b.ra1) return b.con;
  return 'Oct';
}

// 질량-반지름 관계 (Chen & Kipping 2017 근사): 둘 중 하나만 있을 때 나머지를 추정
const radiusFromMass = (m) => (m < 2 ? m ** 0.279 : m < 130 ? 0.808 * m ** 0.589 : 17.7 * m ** -0.044);
const massFromRadius = (r) => (r < 1.23 ? r ** (1 / 0.279) : r < 14 ? (r / 0.808) ** (1 / 0.589) : 318);

// 거의 균등한 결정론적 난수 (동점 순위 정리용)
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/* 희귀함: 실제로 드문 특징일수록 점수가 높다. 점수 순위가 곧 '상위 X%'가 된다 */
const REASONS = [
  '생명 가능 영역의 암석 행성', '태양계 가까이의 이웃', '직접 촬영된 행성', '펄서를 도는 행성',
  '극한의 뜨거움', '거대한 크기', '하루도 안 걸리는 1년', '10년이 넘는 1년', '찌그러진 궤도',
  '행성 대가족', '초창기 발견', '작은 암석 행성', '별이 여럿인 항성계', '지구와 비슷한 크기',
];
function rarityScore(p) {
  const s = []; // [점수, 이유 번호]
  const rocky = p.rade <= 1.8;
  if (rocky && p.eqt != null && p.eqt >= 175 && p.eqt <= 320) s.push([100 + (p.esi || 0) * 20, 0]);
  if (p.dist != null) { if (p.dist < 33) s.push([45, 1]); else if (p.dist < 65) s.push([22, 1]); else if (p.dist < 160) s.push([8, 1]); }
  if (p.method === 'Imaging') s.push([48, 2]);
  if (/Pulsar|Pulsation/.test(p.method)) s.push([55, 3]);
  if (p.eqt != null && p.eqt > 2200) s.push([28 + (p.eqt - 2200) / 60, 4]);
  if (p.rade > 17) s.push([26, 5]);
  if (p.per != null && p.per < 1) s.push([22 + (1 - p.per) * 20, 6]);
  if (p.per != null && p.per > 3650) s.push([24, 7]);
  if (p.ecc != null && p.ecc > 0.6) s.push([18 + (p.ecc - 0.6) * 60, 8]);
  if (p.pnum >= 5) s.push([12 + (p.pnum - 5) * 8, 9]);
  if (p.year < 2002) s.push([16, 10]);
  if (p.rade < 0.9) s.push([20, 11]);
  if (p.snum >= 2) s.push([10 + (p.snum - 2) * 6, 12]);
  if (!s.some((x) => x[1] === 0) && p.rade >= 0.8 && p.rade <= 1.25) s.push([14, 13]);
  if (!s.length) return { score: hash01(p.name), reason: -1 };
  s.sort((a, b) => b[0] - a[0]);
  // 가장 큰 특징 + 나머지 특징의 일부
  const score = s[0][0] + s.slice(1).reduce((t, x) => t + x[0] * 0.35, 0) + hash01(p.name);
  return { score, reason: s[0][1] };
}

async function main() {
  const q = `select ${COLS} from pscomppars`;
  const url = `${TAP}?query=${encodeURIComponent(q)}&format=csv`;
  console.log('NASA Exoplanet Archive에서 받는 중…');
  const csv = await (await fetch(url)).text();
  if (!csv.startsWith('pl_name')) throw new Error('예상하지 못한 응답: ' + csv.slice(0, 300));
  const bounds = (await (await fetch(BOUNDS)).text()).trim().split('\n').map((l) => {
    const [ra0, ra1, dec, con] = l.trim().split(/\s+/);
    return { ra0: +ra0, ra1: +ra1, dec: +dec, con };
  });

  const methods = [], facilities = [], cons = [];
  const idx = (arr, v) => { let i = arr.indexOf(v); if (i < 0) { i = arr.length; arr.push(v); } return i; };

  const planets = [];
  for (const r of parseCsv(csv)) {
    if (r.pl_controv_flag === '1') continue; // 존재가 논란인 행성은 뺀다
    let rade = num(r.pl_rade), masse = num(r.pl_bmasse);
    if (rade == null && masse == null) continue;
    const method = r.discoverymethod;
    // 반지름은 트랜싯으로만 직접 잰다. 나머지는 NASA가 질량에서 추정한 값이다
    let radEst = /Transit|Eclipse|Brightness/.test(method) ? 0 : 1;
    let massEst = r.pl_bmassprov === 'Msini' ? 1 : /M-R|relationship/i.test(r.pl_bmassprov) ? 2 : 0;
    if (rade == null) { rade = radiusFromMass(masse); radEst = 1; }
    if (masse == null) { masse = massFromRadius(rade); massEst = 2; }

    const teff = num(r.st_teff), srad = num(r.st_rad), smass = num(r.st_mass);
    let per = num(r.pl_orbper), a = num(r.pl_orbsmax);
    if (a == null && per != null && smass != null) a = Math.cbrt(smass * (per / 365.25) ** 2);
    let eqt = num(r.pl_eqt), eqtEst = 0;
    if (eqt == null && teff != null && srad != null && a != null) {
      eqt = teff * Math.sqrt((srad * 0.00465047) / (2 * a)) * 0.7 ** 0.25; // 반사율 0.3 가정
      eqtEst = 1;
    }
    let insol = num(r.pl_insol);
    if (insol == null && teff != null && srad != null && a != null) insol = srad ** 2 * (teff / 5772) ** 4 / a ** 2;
    // 지구 유사도 지수 (반지름 + 받는 빛의 양)
    const esi = insol != null
      ? 1 - Math.sqrt(0.5 * (((rade - 1) / (rade + 1)) ** 2 + ((insol - 1) / (insol + 1)) ** 2))
      : null;

    const ra = +r.ra, dec = +r.dec;
    const p = {
      name: r.pl_name, host: r.hostname, dist: num(r.sy_dist), rade, masse, massEst, radEst, per, a,
      ecc: num(r.pl_orbeccen), eqt, eqtEst, teff, srad, snum: +r.sy_snum, pnum: +r.sy_pnum,
      year: +r.disc_year, method, facility: r.disc_facility, ra, dec, esi,
      con: constellation(bounds, ra, dec),
    };
    Object.assign(p, rarityScore(p));
    planets.push(p);
  }

  // 순서 고정: 이름순 (NASA 응답 순서가 바뀌어도 같은 데이터면 같은 결과)
  planets.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  // 희귀도 순위 → 상위 %
  const ranked = planets.slice().sort((x, y) => y.score - x.score);
  ranked.forEach((p, i) => { p.top = Math.max(0.1, Math.ceil(((i + 1) / planets.length) * 1000) / 10); });

  const g = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(d)));
  const rows = planets.map((p) => [
    p.name, p.host, g(p.dist != null ? p.dist * 3.26156 : null, 4), g(p.rade), g(p.masse), p.massEst, p.radEst,
    g(p.per, 4), g(p.a), g(p.ecc, 2), g(p.eqt), p.eqtEst, g(p.teff, 4), g(p.srad), p.snum, p.pnum, p.year,
    idx(methods, p.method), idx(facilities, p.facility), g(p.ra, 5), g(p.dec, 5), idx(cons, p.con),
    p.top, p.reason, g(p.esi, 2),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const out = `/* NAMEVERSE — NASA Exoplanet Archive 확인된 외계행성 (${today} 기준, ${rows.length}개)
 * tools/build-exoplanets.js가 만든 파일입니다. 직접 고치지 마세요.
 * 행: [이름, 모항성, 거리(광년), 반지름(지구=1), 질량(지구=1), 질량구분(0 측정·1 최소·2 추정), 반지름추정,
 *      공전주기(일), 궤도반지름(AU), 이심률, 평형온도(K), 온도추정, 항성온도(K), 항성반지름(태양=1), 별 수, 행성 수,
 *      발견연도, 발견방법, 발견시설, 적경(°), 적위(°), 별자리, 희귀도 상위%, 희귀 이유, 지구유사도] */
(function () {
  'use strict';
  window.NV = window.NV || {};
  window.NV.EXO = {
    version: '${today}',
    source: 'NASA Exoplanet Archive (Planetary Systems Composite Parameters)',
    methods: ${JSON.stringify(methods.map((m) => [m, METHOD_KO[m] || m]))},
    facilities: ${JSON.stringify(facilities)},
    constellations: ${JSON.stringify(cons.map((c) => CON_KO[c] || c))},
    reasons: ${JSON.stringify(REASONS)},
    rows: [
${rows.map((r) => '      ' + JSON.stringify(r)).join(',\n')},
    ],
  };
})();
`;
  const file = path.join(__dirname, '..', 'js', 'exoplanets.js');
  fs.writeFileSync(file, out);
  const unknownCon = cons.filter((c) => !CON_KO[c]);
  console.log(`✓ ${rows.length}개 행성 → js/exoplanets.js (${(out.length / 1024).toFixed(0)}KB)`);
  if (unknownCon.length) console.warn('한국어 이름이 없는 별자리:', unknownCon);
  const tiers = { 신화: 1, 전설: 5, 희귀: 20 };
  for (const [k, t] of Object.entries(tiers)) {
    const list = ranked.filter((p) => p.top <= t).slice(0, 4).map((p) => `${p.name}(${REASONS[p.reason] || '-'})`);
    console.log(`  ${k} 예:`, list.join(', '));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
