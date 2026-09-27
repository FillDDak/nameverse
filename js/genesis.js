/* NAMEVERSE — 이름 하나로 행성의 모든 것을 창조한다 */
(function () {
  'use strict';
  const NV = window.NV;

  /* ───────────── 유틸 ───────────── */
  function hsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }
  const toCss = (c, a) => a == null
    ? `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
    : `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

  /* 한국어 조사: 받침 유무에 따라 '이라는/라는' 등을 고른다 */
  function hasBatchim(word) {
    const ch = (word || '').trim().slice(-1);
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0-9]/.test(ch)) return '0136780'.includes(ch);
    // 알파벳 한 글자는 글자 이름으로 읽는다 (b=비, c=씨, l=엘, m=엠, n=엔, r=알)
    if (/(^|[^a-z])[a-z]$/i.test(word.trim())) return /[lmnr]/i.test(ch);
    if (/[a-z]/i.test(ch)) return /[lmnkptbgcdq]/i.test(ch);
    return false;
  }
  function rieulFinal(word) {
    const ch = (word || '').trim().slice(-1);
    const code = ch.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
  }
  function josa(word, pair) {
    const [withB, withoutB] = pair.split('/');
    if (pair === '으로/로' && rieulFinal(word)) return word + '로';
    return word + (hasBatchim(word) ? withB : withoutB);
  }
  // 템플릿: {owner}, {planet} 등 치환 + {owner|이라는/라는} 조사 처리
  function fill(tpl, vars) {
    return tpl.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (_, key, pair) => {
      const v = vars[key] != null ? String(vars[key]) : '';
      return pair ? josa(v, pair) : v;
    });
  }

  /* ───────────── 생물군계 ───────────── */
  const BIOMES = [
    {
      id: 'ocean', name: '푸른 대양 행성', mode: 'dorian', cat: 'surface',
      land: [
        '행성 표면의 {seaPct}%가 바다로 덮여 있고, 가장 깊은 해구에서는 스스로 빛을 내는 해류가 천천히 흐릅니다.',
        '큰 대륙은 없고, 화산이 만든 작은 섬들이 적도를 따라 띠처럼 흩어져 있습니다.',
        '바다가 열을 오래 머금어서, 낮과 밤의 기온 차가 거의 없습니다.',
      ],
      gen(r) {
        const j = r.range(-14, 14);
        return {
          type: 0, deep: hsl(215 + j, 0.75, 0.14), shallow: hsl(192 + j, 0.7, 0.36),
          land: hsl(r.range(85, 125), 0.42, 0.28), high: hsl(r.range(28, 40), 0.3, 0.36), peak: hsl(30, 0.08, 0.82),
          sea: r.range(0.54, 0.6), clouds: r.range(0.5, 0.8), ice: r.range(0.78, 0.88),
          city: r.chance(0.55) ? r.range(0.6, 1) : 0, atmo: hsl(205 + j, 0.85, 0.62), atmoStr: r.range(1, 1.3),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'garden', name: '에메랄드 정원 행성', mode: 'lydian', cat: 'surface',
      land: [
        '대륙 대부분이 울창한 숲으로 덮여 있고, 가장 큰 나무는 수백 미터까지 자랍니다.',
        '봄이 되면 적도를 따라 꽃이 한꺼번에 피어나 우주에서도 초록 행성 위에 분홍 띠가 보입니다.',
        '밤이 되면 숲 바닥의 버섯과 이끼가 희미하게 빛을 냅니다.',
      ],
      gen(r) {
        const j = r.range(-12, 12);
        return {
          type: 0, deep: hsl(200 + j, 0.7, 0.18), shallow: hsl(175 + j, 0.6, 0.38),
          land: hsl(r.range(100, 140), 0.55, 0.24), high: hsl(r.range(70, 95), 0.5, 0.33), peak: hsl(r.range(40, 60), 0.35, 0.62),
          sea: r.range(0.44, 0.5), clouds: r.range(0.35, 0.6), ice: r.range(0.88, 0.95),
          city: r.chance(0.8) ? r.range(0.6, 1) : 0, atmo: hsl(175 + j, 0.7, 0.62), atmoStr: r.range(0.95, 1.25),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'desert', name: '붉은 사막 행성', mode: 'phrygian', cat: 'surface',
      land: [
        '물은 모두 증발했고, 붉은 암석 평원과 모래 언덕이 끝없이 이어집니다.',
        '바람이 강한 계절에는 모래 폭풍이 대륙 하나를 통째로 덮습니다.',
        '오래전 바다였던 곳에 소금 평원이 하얗게 남아 있습니다.',
        // 얇은 대기(화성형)의 사막은 뜨거울 수도, 차가울 수도 있다: hot/cold 표시가 있는 문장은 그 온도에서만 쓴다
        { t: '한낮의 바위는 손을 댈 수 없을 만큼 달궈져, 공기가 늘 아지랑이처럼 일렁입니다.', hot: true },
        { t: '얇은 대기가 열을 붙잡지 못해서, 해가 지면 기온이 순식간에 영하 수십 도까지 떨어집니다.', cold: true },
      ],
      gen(r) {
        const j = r.range(-10, 10);
        return {
          type: 0, deep: hsl(195, 0.5, 0.2), shallow: hsl(185, 0.45, 0.4),
          land: hsl(r.range(15, 30), 0.6, 0.42), high: hsl(r.range(8, 20), 0.55, 0.3), peak: hsl(r.range(30, 40), 0.5, 0.7),
          sea: r.range(0.28, 0.36), clouds: r.range(0.02, 0.25), ice: r.range(0.86, 0.94),
          city: r.chance(0.3) ? r.range(0.4, 0.8) : 0, atmo: hsl(25 + j, 0.8, 0.6), atmoStr: r.range(0.7, 1),
          cloudCol: hsl(30, 0.4, 0.88), emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'alien', name: '보랏빛 이계 행성', mode: 'lydian', cat: 'surface',
      land: [
        '붉은 별빛을 잘 흡수하는 조류가 퍼져 있어서, 바다가 보랏빛을 띱니다.',
        '식물은 대부분 검붉거나 보라색이라, 대륙 전체가 어둡게 보입니다.',
        '잎이 넓고 납작해서, 약한 별빛도 최대한 받아들입니다.',
      ],
      gen(r) {
        const h = r.range(280, 320);
        return {
          type: 0, deep: hsl(h - 45, 0.5, 0.16), shallow: hsl(h - 60, 0.45, 0.34),
          land: hsl(r.range(300, 330), 0.35, 0.24), high: hsl(r.range(270, 290), 0.22, 0.36), peak: hsl(r.range(30, 50), 0.2, 0.78),
          sea: r.range(0.45, 0.55), clouds: r.range(0.3, 0.65), ice: r.range(0.82, 0.92),
          city: r.chance(0.5) ? r.range(0.5, 1) : 0, atmo: hsl(h, 0.8, 0.66), atmoStr: r.range(1, 1.35),
          cloudCol: hsl(300, 0.5, 0.9), emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'coral', name: '산호빛 황혼 행성', mode: 'mixolydian', cat: 'surface',
      land: [
        '해안선 대부분이 산호초로 둘러싸여 있고, 산호가 자라면서 해안선이 조금씩 바뀝니다.',
        '황금빛 모래사장 위로 분홍 바다가 밀려오고, 저녁이면 바다 전체가 은은하게 빛납니다.',
        '얕은 바다가 넓게 펼쳐져 있어서, 썰물 때면 걸어서 건널 수 있는 섬이 많습니다.',
      ],
      gen(r) {
        const h = r.range(335, 355);
        return {
          type: 0, deep: hsl(h - 160, 0.45, 0.2), shallow: hsl(h + 10, 0.45, 0.52), // 깊은 곳은 청록, 얕은 산호초는 분홍
          land: hsl(r.range(58, 78), 0.32, 0.36), high: hsl(r.range(25, 35), 0.3, 0.36), peak: hsl(40, 0.25, 0.82),
          sea: r.range(0.45, 0.55), clouds: r.range(0.3, 0.6), ice: r.range(0.88, 0.96),
          city: r.chance(0.55) ? r.range(0.5, 1) : 0, atmo: hsl(r.range(10, 30), 0.9, 0.66), atmoStr: r.range(1, 1.3),
          cloudCol: hsl(20, 0.6, 0.92), emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'gas', name: '줄무늬 가스 거인', mode: 'aeolian', cat: 'gas',
      land: [
        '단단한 땅이 없는 이 거대한 행성은 수천 킬로미터 두께의 구름층이 겹겹이 흐르는 하나의 바다입니다.',
        '거대한 폭풍 ‘{storm}’{stormJosa} 관측 이래 한 번도 멈춘 적이 없으며, {stormCmp}',
        '구름 띠마다 바람의 방향이 반대라서, 띠의 경계에는 번개가 잦습니다.',
      ],
      gen(r) {
        const h = r.range(20, 35);
        return {
          type: 1, deep: hsl(h, 0.5, 0.35), shallow: hsl(h + 12, 0.6, 0.7),
          land: hsl(r.range(10, 25), 0.55, 0.45), high: hsl(r.range(40, 55), 0.4, 0.86), peak: hsl(r.range(5, 15), 0.7, 0.5),
          bands: r.range(2.5, 5), turb: r.range(1.5, 3.2), stormSize: r.range(0.14, 0.24),
          sea: 0, clouds: 0, ice: 0, city: 0, atmo: hsl(35, 0.7, 0.7), atmoStr: r.range(0.6, 0.9),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'icegiant', name: '청록빛 얼음 거인', mode: 'dorian', cat: 'gas',
      land: [
        '대기 깊은 곳에서는 엄청난 압력 때문에 다이아몬드 비가 내릴 수 있습니다.',
        '대기의 메탄이 붉은 빛을 흡수해서, 행성 전체가 청록색으로 보입니다.',
        '이 행성의 바람은 음속보다 빠르지만, 중심부는 이상할 만큼 고요합니다.',
      ],
      gen(r) {
        return {
          type: 1, deep: hsl(r.range(185, 205), 0.55, 0.35), shallow: hsl(r.range(175, 195), 0.5, 0.65),
          land: hsl(r.range(210, 230), 0.5, 0.5), high: hsl(r.range(180, 200), 0.3, 0.88), peak: hsl(r.range(225, 240), 0.6, 0.35),
          bands: r.range(1.5, 3), turb: r.range(0.8, 1.8), stormSize: r.range(0.1, 0.18),
          sea: 0, clouds: 0, ice: 0, city: 0, atmo: hsl(190, 0.8, 0.72), atmoStr: r.range(0.9, 1.2),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      id: 'lava', name: '용암 대장간 행성', mode: 'phrygian', cat: 'fire',
      land: [
        '지각의 갈라진 틈마다 용암이 흘러서, 밤 쪽에서는 붉은 균열이 그물처럼 드러납니다.',
        '용암 호수들은 {n}시간 주기로 부풀었다 가라앉습니다.',
        '식어서 굳은 용암은 검은 유리가 되어 대지 곳곳에 거울 같은 평원을 만들었습니다.',
      ],
      gen(r) {
        const eh = r.range(12, 28);
        return {
          type: 2, deep: hsl(r.range(0, 20), 0.15, 0.06), shallow: hsl(r.range(10, 25), 0.12, 0.15),
          land: hsl(r.range(15, 30), 0.15, 0.26), high: [0, 0, 0], peak: [0, 0, 0],
          emit: hsl(eh, 1, 0.55), sea: r.range(0.34, 0.41), spec: 0.2,
          clouds: r.range(0.1, 0.3), ice: 0, city: 0, atmo: hsl(15, 0.9, 0.55), atmoStr: r.range(0.8, 1.1),
          cloudCol: hsl(20, 0.08, 0.3),
        };
      },
    },
    {
      // 펄서를 도는 암석 행성: 보이는 빛은 거의 없고, 펄서가 내뿜는 고에너지 입자 바람을 맞는 어두운 암석 (크레이터).
      // 대기가 남아 있다면 입자 바람이 극지방에 늘 강한 오로라를 일으킨다 (Patruno & Kama 2017)
      id: 'crystal', name: '펄서 바람을 맞는 어두운 행성', mode: 'lydian', cat: 'barren',
      land: [
        '모항성인 펄서는 보이는 빛을 거의 내지 않아서, 대지는 한낮에도 해 질 녘처럼 어둡습니다.',
        '초신성 폭발 뒤에 남은 잔해가 다시 뭉쳐 생긴 행성이라, 땅속에는 무거운 원소가 유난히 많을 것으로 추정됩니다.',
        '펄서가 쉬지 않고 내뿜는 입자 바람 때문에, 극지방 하늘에는 {n}겹의 오로라가 밤낮없이 일렁입니다.',
      ],
      gen(r) {
        const h = r.chance(0.5) ? r.range(220, 240) : r.range(260, 280), s = r.range(0.04, 0.1);
        r.next(); r.next(); // 예전 모습과 같은 수(8개)의 난수를 써서 뒤따르는 모습(자전·폭풍 등)의 난수 순서를 지킨다
        return {
          type: 0, deep: hsl(r.range(220, 240), s, 0.1), shallow: hsl(h, s, 0.14),
          land: hsl(h, s, r.range(0.14, 0.2)), high: hsl(h, s * 0.8, 0.26), peak: hsl(h, s * 0.6, 0.34),
          sea: 0, clouds: 0, ice: 1.5, city: 0, atmo: hsl(265, 0.7, 0.62), atmoStr: r.range(0.25, 0.4),
          cloudCol: [1, 1, 1], emit: [0, 0, 0], crater: 1,
        };
      },
    },
    {
      id: 'glacier', name: '고요한 빙하 행성', mode: 'aeolian', cat: 'cold',
      land: [
        '두꺼운 빙하 아래에 따뜻한 바다가 숨어 있어서, 얼음이 갈라진 틈으로 푸른빛이 올라옵니다.',
        '얼음 평원에는 바람이 조각한 거대한 얼음 성당들이 끝없이 늘어서 있습니다.',
        '빙하가 움직이며 내는 낮은 진동이 얼음 평원 전체로 퍼집니다.',
      ],
      gen(r) {
        return {
          type: 3, deep: hsl(r.range(200, 215), 0.45, 0.45), shallow: hsl(r.range(190, 205), 0.4, 0.7),
          land: hsl(r.range(200, 215), 0.2, 0.82), high: hsl(205, 0.25, 0.92), peak: [0.98, 0.99, 1],
          sea: r.range(0.45, 0.55), ice: r.range(0.35, 0.55), emit: hsl(r.range(195, 215), 0.7, 0.35),
          clouds: r.range(0.2, 0.5), city: r.chance(0.2) ? 0.5 : 0, atmo: hsl(195, 0.7, 0.76), atmoStr: r.range(0.9, 1.2),
          cloudCol: [1, 1, 1],
        };
      },
    },
    {
      // 뜨거운 서브넵튠: 짙은 연무 때문에 띠가 흐릿한 원반으로 보인다 (GJ 1214 b, K2-18 b)
      id: 'subneptune', name: '연무에 싸인 서브넵튠', mode: 'dorian', cat: 'gas',
      land: [
        '대기 위층을 짙은 연무가 덮고 있어서, 망원경으로는 그 아래를 들여다볼 수 없습니다(GJ 1214 b가 그렇습니다).',
        '두꺼운 수소 대기 아래에는 엄청난 압력에 눌린 뜨거운 물이나 마그마 바다가 숨어 있을 수 있습니다.',
        '태양계에는 없는 크기지만, 우리 은하에서는 가장 흔한 종류의 행성으로 꼽힙니다.',
      ],
      gen(r) {
        const h = r.range(30, 45);
        return {
          type: 1, deep: hsl(h, 0.12, 0.62), shallow: hsl(h + 5, 0.1, 0.74), land: hsl(h - 5, 0.14, 0.56), high: hsl(h + 10, 0.08, 0.84), peak: hsl(h, 0.1, 0.6),
          bands: r.range(0.8, 1.6), turb: r.range(0.5, 1.1), stormSize: 0.001, // 연무가 폭풍을 가린다
          sea: 0, clouds: 0, ice: 0, city: 0, atmo: hsl(r.range(195, 215), 0.35, 0.8), atmoStr: r.range(1.3, 1.6),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      // 폭주 온실: 생명 가능 영역보다 안쪽에서 대기를 지킨 암석 행성. 금성처럼 황산 구름이 빈틈없이 덮는다
      id: 'venus', name: '짙은 구름의 금성형 행성', mode: 'phrygian', cat: 'fire',
      land: [
        '황산 구름이 행성 전체를 빈틈없이 덮고 있어서, 우주에서는 지표가 전혀 보이지 않습니다.',
        '두꺼운 이산화탄소 대기의 온실 효과 때문에, 구름 아래 지표는 납이 녹을 만큼 뜨거울 수 있습니다.',
        '구름 꼭대기에서는 바람이 며칠 만에 행성을 한 바퀴 돕니다. 행성의 자전보다 훨씬 빠른 ‘초회전’입니다.',
      ],
      gen(r) {
        const h = r.range(42, 52);
        return {
          type: 1, deep: hsl(h, 0.3, 0.7), shallow: hsl(h + 4, 0.35, 0.8), land: hsl(h - 6, 0.3, 0.66), high: hsl(h + 6, 0.25, 0.88), peak: hsl(h, 0.3, 0.72),
          bands: r.range(0.6, 1.2), turb: r.range(0.5, 1.0), stormSize: 0.001,
          sea: 0, clouds: 0, ice: 0, city: 0, atmo: hsl(45, 0.5, 0.8), atmoStr: r.range(1.2, 1.5),
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
    {
      // 우주 해안선 너머: 대기를 잃은 암석 행성. 수성·달처럼 크레이터투성이의 어두운 회색
      id: 'airless', name: '대기 없는 잿빛 암석 행성', mode: 'aeolian', cat: 'barren',
      land: [
        '대기가 없어서 하늘은 낮에도 검고, 해가 떠 있어도 별이 보입니다.',
        '운석을 막아 줄 대기가 없어서, 크고 작은 크레이터가 지표를 빈틈없이 덮고 있습니다.',
        '열을 붙잡아 둘 대기가 없어서, 낮과 밤의 온도 차가 수백 도에 이릅니다.',
        '별빛과 항성풍에 오랫동안 시달린 암석은 ‘우주 풍화’로 어둡게 변했습니다.',
      ],
      gen(r) {
        const h = r.range(25, 40), s = r.range(0.03, 0.1);
        return {
          type: 0, deep: hsl(h, s, 0.2), shallow: hsl(h, s, 0.26), land: hsl(h, s, r.range(0.26, 0.34)), high: hsl(h + 5, s * 0.8, r.range(0.42, 0.5)), peak: hsl(h + 5, s * 0.6, 0.58),
          sea: 0, clouds: 0, ice: 1.5, city: 0, atmo: hsl(h, 0.1, 0.6), atmoStr: 0, crater: 1,
          cloudCol: [1, 1, 1], emit: [0, 0, 0],
        };
      },
    },
  ];

  /* ───────────── 실제 외계행성 (NASA Exoplanet Archive) ───────────── */
  // 궤도 위의 시작 위치(실제 값을 모를 때): 행성 이름으로 정해 누구에게나 같다
  const orbitPhase = (name) => (NV.hash('orbit/' + name)[0] / 4294967296) * Math.PI * 2;
  const EXO = NV.EXO;
  const CB = new Set(EXO.cb || []); // 두 별을 함께 도는 행성
  /* 오늘의 궤도 위치를 계산할 궤도 요소. 트랜싯(시선속도 행성은 '합') 기준 시각 T0와 그때의 정밀한 주기 Pt가 있으면
   * 실제 위상을 알 수 있다. 없으면 행성 이름으로 정한 위상(h)을 쓴다. 이심률 e, 근점 인수 w(°), 궤도 경사 i(°) */
  const orbitEl = (r) => ({ P: r[7], e: r[9] || 0, w: r[29] != null ? r[29] : null, T0: r[28] != null ? r[28] : null,
    Pt: r[27] != null ? r[27] : null, incl: r[30] != null ? r[30] : null, h: orbitPhase(r[0]) });
  function exoPlanet(i) {
    const r = EXO.rows[i];
    const [method, methodKo] = EXO.methods[r[17]];
    const p = {
      name: r[0], host: r[1], dist: r[2], rade: r[3], masse: r[4], massEst: r[5], radEst: r[6],
      per: r[7], a: r[8], ecc: r[9], eqt: r[10], eqtEst: r[11], teff: r[12], srad: r[13], snum: r[14], pnum: r[15],
      year: r[16], method, methodKo, facility: EXO.facilities[r[18]], ra: r[19], dec: r[20],
      con: EXO.constellations[r[21]], top: r[22], reason: EXO.reasons[r[23]] || '', esi: r[24],
      insol: r[25] != null ? r[25] : null, smass: r[26] != null ? r[26] : null, hostEst: false,
      orb: orbitEl(r), sunCon: r[31] != null ? EXO.constellations[r[31]] : null,
    };
    // 미세중력렌즈 행성의 모항성은 빛이 아니라 중력으로만 보여서 온도·반지름이 없다. 대부분 적색왜성이라
    // 질량(없으면 흔한 값 0.4)으로 광도(질량-광도 관계)와 반지름을 어림하고, 온도와 받는 빛의 양을 계산한다
    if (p.teff == null && p.method === 'Microlensing' && p.a != null) {
      const m = p.smass != null ? p.smass : 0.4;
      const L = m < 0.43 ? 0.23 * Math.pow(m, 2.3) : Math.pow(m, 4), R = Math.pow(m, 0.9);
      Object.assign(p, { hostEst: true, teff: Math.round(5772 * Math.pow(L / (R * R), 0.25)), srad: R });
      if (p.insol == null) p.insol = L / (p.a * p.a);
      if (p.eqt == null) { p.eqt = p.teff * Math.sqrt((R * 0.00465047) / (2 * p.a)) * Math.pow(0.7, 0.25); p.eqtEst = 1; }
    }
    return p;
  }

  const METHOD_STORY = {
    'Transit': '행성이 별 앞을 지나갈 때 별빛이 아주 조금 어두워지는 것을 잡아냈습니다.',
    'Radial Velocity': '행성의 중력에 끌려 별이 앞뒤로 흔들리는 것을, 별빛의 색이 미세하게 바뀌는 것으로 알아냈습니다.',
    'Microlensing': '이 별이 더 먼 별 앞을 지나갈 때, 행성의 중력이 뒤쪽 별빛을 잠깐 더 밝게 휘게 만든 순간을 포착했습니다.',
    'Imaging': '밝은 별빛을 가리고, 행성이 스스로 내는 빛을 직접 사진으로 찍었습니다.',
    'Pulsar Timing': '빠르게 도는 죽은 별(펄서)의 신호가 규칙적으로 밀리고 당겨지는 것에서 행성을 찾아냈습니다.',
    'Transit Timing Variations': '이웃 행성이 별 앞을 지나는 시각이 조금씩 어긋나는 것에서 이 행성의 존재를 알아냈습니다.',
    'Eclipse Timing Variations': '서로를 가리는 두 별의 식 시각이 흔들리는 것에서 행성을 찾아냈습니다.',
    'Orbital Brightness Modulation': '행성이 돌면서 반사하는 빛의 양이 주기적으로 바뀌는 것을 측정했습니다.',
    'Pulsation Timing Variations': '규칙적으로 맥동하는 별의 박자가 조금씩 어긋나는 것에서 행성을 찾아냈습니다.',
    'Astrometry': '행성에 끌려 별의 위치가 하늘에서 아주 조금 흔들리는 것을 측정했습니다.',
    'Disk Kinematics': '젊은 별을 둘러싼 가스 원반의 흐름이 흐트러진 모양에서 행성을 찾아냈습니다.',
  };

  // 별 표면 온도 → 빛의 색 (흑체 근사)
  function starColor(t) {
    t = Math.max(2000, Math.min(12000, t || 5772)) / 100;
    const r = t <= 66 ? 1 : Math.min(1, 1.2929 * Math.pow(t - 60, -0.1332));
    const g = t <= 66 ? Math.min(1, 0.3901 * Math.log(t) - 0.6318) : Math.min(1, 1.1299 * Math.pow(t - 60, -0.0755));
    const b = t >= 66 ? 1 : t <= 19 ? 0 : Math.min(1, 0.5432 * Math.log(t - 10) - 1.1963);
    return [r, g, b];
  }
  /* 모항성의 종류: 표면 온도(분광형)에 반지름(태양 = 1)을 더해 왜성·거성·별의 잔해를 가른다.
   * kind: ms 보통 별(주계열성) · dwarf 적색왜성 · subgiant 준거성 · giant 거성 · wd 백색왜성 · sd 준왜성 · bd 갈색왜성.
   * 펄서는 온도로 가를 수 없어 따로 다룬다 */
  const STAR_COLOR = { M: '붉은', K: '주황빛', G: '노란', F: '흰', A: '푸르스름한 흰', B: '푸른' };
  const STAR_NOTE = {
    subgiant: '준거성은 중심의 수소를 거의 다 쓰고 부풀기 시작한 별입니다.',
    giant: '거성은 중심의 수소를 다 쓰고 크게 부풀어 오른 늙은 별입니다.',
    wd: '백색왜성은 별이 수명을 다하고 남은, 지구만 한 크기의 뜨거운 핵입니다.',
    sd: '준왜성은 바깥층을 대부분 잃고 뜨거운 속이 드러난 별입니다.',
    bd: '갈색왜성은 수소 핵융합을 일으키기에는 너무 가벼워서, 스스로 희미하게 빛나는 천체입니다.',
  };
  function starClass(t, r) {
    if (t == null) return null;
    if (r != null && r < 0.05) return { cls: 'D', kind: 'wd', desc: '백색왜성', short: '백색왜성' };
    // 2,400K보다 차가운 모항성은 모두 갈색왜성이다 (L 1,300~2,400K · T 500~1,300K · Y 500K 미만)
    if (t < 2400) {
      const c = t < 500 ? 'Y' : t < 1300 ? 'T' : 'L';
      return { cls: c, kind: 'bd', desc: `검붉은 ${c}형 갈색왜성`, short: `${c}형 갈색왜성` };
    }
    const cls = t < 3900 ? 'M' : t < 5300 ? 'K' : t < 6000 ? 'G' : t < 7500 ? 'F' : t < 10000 ? 'A' : 'B';
    const color = STAR_COLOR[cls];
    // 주계열의 B형 별은 태양보다 몇 배 크다. 이렇게 작고 뜨거운 별은 바깥층을 잃은 준왜성(sdB)이다
    if (cls === 'B' && r != null && r < 0.5) return { cls, kind: 'sd', desc: '푸른 B형 준왜성', short: 'B형 준왜성' };
    if (cls === 'M') {
      // 갓 태어난 적색왜성은 아직 수축 중이라 태양만 할 수도 있다 (AU Mic, CI Tau). 거성은 태양의 수십 배
      return r != null && r >= 2
        ? { cls, kind: 'giant', desc: 'M형 적색거성', short: 'M형 적색거성' }
        : { cls, kind: 'dwarf', desc: 'M형 적색왜성', short: 'M형 적색왜성' };
    }
    if (r != null && (cls === 'K' || cls === 'G')) {
      if (r >= 5) return { cls, kind: 'giant', desc: `${color} ${cls}형 거성`, short: `${cls}형 거성` };
      if (r >= 2) return { cls, kind: 'subgiant', desc: `${color} ${cls}형 준거성`, short: `${cls}형 준거성` };
    }
    if (cls === 'F' && r != null && r >= 2.5) return { cls, kind: 'subgiant', desc: `${color} ${cls}형 준거성`, short: `${cls}형 준거성` };
    return { cls, kind: 'ms', desc: `${color} ${cls}형 별`, short: `${cls}형` };
  }
  const isPulsar = (p) => p.method === 'Pulsar Timing';
  // 플레어가 잦은 적색왜성 (적색거성·갈색왜성은 뺀다)
  const flareStar = (p) => { const sc = starClass(p.teff, p.srad); return !!sc && sc.kind === 'dwarf' && !p.hostEst; };

  /* ───────────── 물리 판정: 대기 · 생명 가능 영역 · 분류 ─────────────
   * 모습(생물군계), 설명, 지표 탐사가 모두 이 판정을 따른다 */

  // 우주 해안선(Zahnle & Catling 2017): 받는 빛이 탈출 속도의 네제곱에 비례하는 경계를 넘으면 대기를 잃는다.
  // 경계 높이는 태양계에 맞췄다: 수성·달은 한참 넘고(대기 없음), 화성은 경계 가까이(얇은 대기), 지구·금성·타이탄은 안쪽.
  // 적색왜성은 어릴 때 X선·자외선을 훨씬 오래 쏟아 내서 경계가 10배 낮다 (JWST: TRAPPIST-1 b, LHS 3844 b, GJ 1132 b에 대기 없음)
  // x = 받는 빛 ÷ 경계. 1 이상이면 대기 없음, 0.3~1은 얇은 대기, 그 아래는 두꺼운 대기
  function atmosphere(p) {
    if (p.insol == null || p.rade >= 2.2 || p.masse >= 50) return { kind: 'thick', x: null };
    const I0 = p.teff != null && p.teff < 3900 && !(p.srad >= 2) ? 2.5 : 25;
    const x = p.insol / (I0 * Math.pow(p.masse / p.rade, 2)); // (탈출 속도 / 지구)⁴ = (M/R)²
    return { kind: x >= 1 ? 'none' : x >= 0.3 ? 'thin' : 'thick', x };
  }
  // 생명 가능 영역(Kopparapu et al. 2014, 낙관적 경계): 안쪽은 '최근 금성', 바깥쪽은 '초기 화성'이 받던 빛.
  // S = S₀ + aT + bT² + cT³ + dT⁴ (T = 별 온도 − 5780K, 2600~7200K에서 맞는 식)
  const HZ_IN = [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15];
  const HZ_OUT = [0.320, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16];
  const seff = (c, t) => c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * c[4])));
  function hzZone(p) {
    if (p.insol != null && p.teff != null) {
      const t = Math.max(2600, Math.min(7200, p.teff)) - 5780;
      return p.insol > seff(HZ_IN, t) ? 'hot' : p.insol < seff(HZ_OUT, t) ? 'cold' : 'hz';
    }
    if (p.eqt == null) return null; // 별 정보가 없으면 평형 온도로 어림한다 (태양 기준 경계의 평형 온도 약 290K·190K)
    return p.eqt > 290 ? 'hot' : p.eqt < 190 ? 'cold' : 'hz';
  }
  /* 물리적 분류. 암석 행성은 대기 → 생명 가능 영역 순으로 가른다
   *  gas 가스 거인 · subneptune 연무에 싸인 서브넵튠(뜨거운 것) · icegiant 얼음 거인 · lava 용암 · airless 대기 없는 암석
   *  desert 얇은 대기의 사막(화성형) · venus 폭주 온실(금성형) · temperate 온화한 암석 · ocean 물 행성 후보 · glacier 얼음
   *  crystal 펄서의 암석 행성 · null 온도를 알 수 없음 */
  function physClass(p) {
    const T = p.eqt, R = p.rade;
    if (isPulsar(p) && R < 2.2 && !(p.masse >= 50)) return 'crystal'; // 목성만 한 펄서 행성은 가스 행성
    if (R >= 6 || p.masse >= 50) return 'gas';
    // 해왕성(3.9)보다 작은 뜨거운 행성은 짙은 연무에 싸인 서브넵튠, 그보다 크면 토성보다 작은 가스 행성
    if (R >= 2.2) return T == null || T < 400 ? 'icegiant' : R < 4 ? 'subneptune' : 'gas';
    if (T == null) return null;
    if (T > 1000) return 'lava';
    const atm = atmosphere(p).kind;
    if (atm === 'none') return 'airless';
    if (atm === 'thin') return T < 150 ? 'glacier' : 'desert';
    const hz = hzZone(p);
    if (hz === 'hot') return 'venus';
    if (hz === 'cold') return 'glacier';
    // 반지름 1.6 이하만 암석 행성으로 본다 (Rogers 2015). 그보다 크면 두꺼운 대기나 깊은 바다를 가졌을 가능성이 크다
    return R > 1.6 ? 'ocean' : 'temperate';
  }

  /* 물리적 분류로 생물군계를 고른다. 온화한 암석 행성만 난수로 모습을 고른다 */
  function pickBiome(p, r) {
    const by = (id) => BIOMES.find((b) => b.id === id);
    const c = physClass(p);
    if (c == null) return by(r.chance(0.5) ? 'glacier' : 'desert');
    if (c === 'temperate') {
      // 붉은 왜성 주위의 식물은 검붉거나 보랏빛일 수 있다는 가설 (적색거성은 뺀다)
      if (p.teff != null && p.teff < 3900 && !(p.srad >= 2)) return by(r.chance(0.6) ? 'alien' : 'coral');
      return by(r.pick(['ocean', 'garden', 'garden', 'coral']));
    }
    return by(c);
  }

  /* 가스 거인의 색: 구름을 이루는 물질이 온도로 정해진다 (Sudarsky et al. 2000의 다섯 등급)
   *  I   150K 미만: 암모니아 구름 — 목성(110K), 더 차가우면 토성처럼 옅은 버터색
   *  II  150~350K: 물 구름 — 빛을 잘 되비추는 흰색
   *  III 350~800K: 구름이 없어 대기의 산란과 메탄 흡수로 푸른색
   *  IV  800~1,400K: 나트륨·칼륨이 빛을 삼켜 아주 어둡다 (HD 189733 b는 짙은 파란색으로 관측됐다)
   *  V   1,400~2,200K: 높이 뜬 규산염(암석 증기) 구름 — 회갈색
   *  2,200K 이상: 구름이 모두 증발하고 분자가 쪼개진다. 낮 쪽은 스스로 달아올라 빛난다(열복사는 셰이더가 따로 그린다) */
  function gasPalette(v, T, r) {
    if (T == null) T = 120; // 온도를 모르는 가스 행성은 대부분 먼 궤도(미세중력렌즈)의 차가운 행성이다
    const set = (deep, shallow, land, high, peak, atmo) => Object.assign(v, { deep, shallow, land, high, peak, atmo });
    const h = r.range(-6, 6);
    if (T < 90) {
      set(hsl(42 + h, 0.35, 0.55), hsl(46 + h, 0.4, 0.78), hsl(36 + h, 0.3, 0.62), hsl(50 + h, 0.3, 0.9), hsl(30 + h, 0.4, 0.55), hsl(45, 0.5, 0.78));
    } else if (T < 150) {
      // 목성형: 생물군계의 기본 팔레트 (황토색·크림색 띠와 붉은 폭풍)
    } else if (T < 350) {
      set(hsl(210 + h, 0.08, 0.76), hsl(40 + h, 0.1, 0.9), hsl(30 + h, 0.12, 0.8), hsl(200, 0.1, 0.96), hsl(25 + h, 0.2, 0.72), hsl(210, 0.4, 0.86));
    } else if (T < 800) {
      set(hsl(215 + h, 0.55, 0.34), hsl(205 + h, 0.5, 0.55), hsl(222 + h, 0.45, 0.42), hsl(200 + h, 0.35, 0.72), hsl(228 + h, 0.5, 0.3), hsl(205, 0.7, 0.65));
    } else if (T < 1400) {
      set(hsl(220 + h, 0.35, 0.1), hsl(214 + h, 0.3, 0.2), hsl(25 + h, 0.2, 0.14), hsl(210 + h, 0.25, 0.3), hsl(20 + h, 0.35, 0.18), hsl(215, 0.6, 0.45));
    } else if (T < 2200) {
      set(hsl(30 + h, 0.18, 0.34), hsl(35 + h, 0.2, 0.52), hsl(24 + h, 0.24, 0.4), hsl(40 + h, 0.15, 0.64), hsl(15 + h, 0.35, 0.34), hsl(25, 0.6, 0.55));
    } else {
      set(hsl(18 + h, 0.3, 0.1), hsl(24 + h, 0.3, 0.18), hsl(14 + h, 0.35, 0.14), hsl(30 + h, 0.3, 0.26), hsl(10 + h, 0.4, 0.14), hsl(20, 0.8, 0.5));
    }
  }
  // 서브넵튠의 연무 색: 따뜻하면 옅은 회베이지(광화학 연무), 뜨거울수록 그을음 같은 갈색에서 검붉은색으로
  function hazePalette(v, T, r) {
    const set = (deep, shallow, land, high, peak) => Object.assign(v, { deep, shallow, land, high, peak });
    const h = r.range(-5, 5);
    if (T >= 1200) set(hsl(20 + h, 0.3, 0.16), hsl(25 + h, 0.3, 0.24), hsl(18 + h, 0.32, 0.2), hsl(30 + h, 0.25, 0.3), hsl(20, 0.3, 0.2));
    else if (T >= 800) set(hsl(28 + h, 0.3, 0.38), hsl(32 + h, 0.3, 0.5), hsl(24 + h, 0.32, 0.44), hsl(36 + h, 0.25, 0.6), hsl(28, 0.3, 0.44));
  }

  function tempC(k) { return Math.round(k - 273.15); }
  const num = (x, d = 1) => (x >= 100 ? fmt(x) : String(Number(x.toFixed(d))));
  function periodText(days) {
    if (days == null) return null;
    if (days < 1) return `${num(days * 24)}시간`;
    if (days > 730) return `${num(days / 365.25)}년`;
    return `${num(days)}일`;
  }
  // 가스 행성 폭풍의 지름(km): 셰이더는 폭풍 중심에서 단위 구 위 거리 0.65·stormSize까지를 폭풍으로 그린다
  const stormKm = (v, p) => 2 * 0.65 * v.stormSize * p.rade * 6371;
  function stormText(km) {
    const k = km / 12742, d = `지름이 약 ${fmt(Math.round(km / 100) * 100)}km로`; // 지구 지름 = 12,742km
    if (k >= 2) return `${d}, 지구 ${Math.floor(k)}개를 나란히 놓을 수 있을 만큼 큽니다.`;
    if (k >= 1) return `${d}, 지구가 통째로 들어갈 만큼 큽니다.`;
    return `${d}, 지구 지름의 ${Math.max(10, Math.round(k * 10) * 10)}% 정도입니다.`;
  }
  function raText(deg) {
    const h = deg / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
  }
  function decText(deg) {
    const a = Math.abs(deg), d = Math.floor(a), m = Math.floor((a - d) * 60);
    return `${deg < 0 ? '−' : '+'}${d}° ${String(m).padStart(2, '0')}′`;
  }

  /* ───────────── 상상 텍스트 풀 ───────────── */
  const SYL_START = ['아', '에', '오', '이', '카', '케', '코', '루', '리', '노', '세', '소', '타', '테', '벨', '몬', '산', '엘', '바', '베', '제', '하', '펠', '미', '다', '시', '크', '프', '나', '라', '유', '레', '로', '티'];
  const SYL_MID = ['라', '리', '로', '노', '니', '베', '시', '타', '렌', '린', '딘', '몬', '미', '나', '도', '카', '엘', '온', '우', '디', '세', '르', '반', '살'];
  const SYL_END = ['스', '아', '온', '아나', '리스', '테라', '노스', '움', '엘', '아스', '린', '야', '토', '니아', '로스', '벨', '론', '시아'];

  const INHABITANTS = {
    surface: ['몸집이 작은 초식 생물', '빛의 깜빡임으로 신호를 주고받는 곤충 무리', '얕은 바다를 떠다니는 해조 군락', '긴 목으로 높은 잎을 뜯는 초식동물', '땅굴을 파고 사는 작은 동물', '바위에 붙어 사는 산호 같은 생물'],
    gas: ['대기층을 떠다니는 풍선 모양 생물', '상승 기류를 타고 나는 얇은 막 생물'],
    fire: ['뜨거운 바위 틈에 사는 내열성 미생물', '광물을 먹고 자라는 결정 모양 미생물'],
    cold: ['얼음 아래 바다에 사는 발광 생물', '얼음 틈에서 버티는 미생물 군락'],
    // 금성 구름 속 온화한 층(고도 50km 안팎)에 미생물이 있을 수 있다는 가설
    cloud: ['구름 속 온화한 층을 떠다니는 미생물', '황산 구름 방울 속에 사는 미생물 군락'],
  };
  const HABITS = [
    '해가 뜨는 방향으로 무리를 지어 이동합니다',
    '추운 계절에는 한데 모여 긴 잠을 잡니다',
    '천적이 다가오면 몸 색을 바꿔 숨습니다',
    '낮에는 숨어 있다가 밤에만 활동합니다',
    '한 번에 수천 개의 알을 낳고, 그중 일부만 살아남습니다',
  ];
  const PHENOMENA = [
    { t: '{n}년에 한 번 모든 위성이 일렬로 서는 날에는 일식이 연달아 일어납니다.', moons: 2 },
    { t: '두 달이 겹치는 밤에는 조수 간만의 차가 가장 커집니다.', moons: 2, cats: ['surface', 'cold'] },
    // air: 대기가 있어야 생기는 현상 (유성은 대기에서 타며 빛나고, 오로라는 대기의 기체가 빛나는 것)
    { t: '해마다 같은 시기에 유성우가 {n}시간 동안 쏟아집니다.', air: true },
    { t: '별의 활동이 강해지는 시기에는 극지방의 오로라가 적도 가까이까지 내려옵니다.', air: true },
    { t: '고리의 그림자가 적도를 지나는 계절에는 낮에도 하늘이 어둑합니다.', ring: true },
    { t: '고리 조각이 대기로 떨어지는 밤에는 유성이 평소보다 훨씬 많이 보입니다.', ring: true, air: true },
    { t: '낮과 밤의 경계선에서는 해가 뜨는 쪽과 지는 쪽의 온도 차가 수백 도에 이릅니다.', noAir: true },
  ];
  const PROVERBS = [
    '느린 별도 결국 궤도를 한 바퀴 돈다.', '가장 어두운 밤에 가장 먼 별이 보인다.', '바람의 이름을 알면 길을 잃지 않는다.',
    '중력은 보이지 않지만 모든 것을 붙잡는다.', '작은 달도 바다를 움직인다.', '오늘의 먼지가 내일의 행성이 된다.',
    '서두르는 혜성은 꼬리를 잃는다.', '구름 위에는 언제나 해가 있다.', '뜨거운 심장이 단단한 대지를 만든다.',
  ];
  const TAGS = ['#조용한_카리스마', '#새벽형_행성', '#은근한_중력', '#예측불가', '#호기심_폭발', '#느긋한_자전', '#첫인상_반전', '#의리의_위성', '#밤하늘_주인공', '#비밀이_많음', '#따뜻한_핵', '#자유로운_혜성', '#완벽주의_자전축', '#단단한_지각'];
  const ROLES = ['별빛 등대지기', '구름 우체부', '위성 정원사', '오로라 관측원', '유성 수집가', '은하 도서관 사서', '중력 제빵사', '혜성 길잡이', '폭풍 예보관', '별자리 지도 제작자', '궤도 정비사', '빙하 탐사대원'];
  const RARITY = [
    { max: 1, name: '신화', en: 'MYTHIC' },
    { max: 5, name: '전설', en: 'LEGENDARY' },
    { max: 20, name: '희귀', en: 'RARE' },
    { max: 50, name: '특별', en: 'UNCOMMON' },
    { max: 101, name: '평범', en: 'COMMON' },
  ];

  function moonName(r) {
    let n = r.pick(SYL_START) + r.pick(SYL_MID);
    if (r.chance(0.65)) n += r.pick(SYL_END);
    return n;
  }

  /* 관측 사실로 쓰는 문장 */
  /* 같은 항성계의 이웃 행성: 모항성 이름이 같은 행 */
  let HOSTS = null;
  function siblingRows(host, self) {
    if (!HOSTS) {
      HOSTS = new Map();
      EXO.rows.forEach((r, k) => { const a = HOSTS.get(r[1]); if (a) a.push(k); else HOSTS.set(r[1], [k]); });
    }
    return (HOSTS.get(host) || []).filter((k) => EXO.rows[k][0] !== self);
  }
  // 하늘에서 본 색: 이웃 행성도 같은 물리 판정으로 고른다 (셰이더 sibColor의 번호:
  // 0 가스, 1 얼음 거인, 2 용암, 3 사막, 4 온화, 5 얼음, 6 대기 없는 암석, 7 금성형, 8 서브넵튠)
  const SIB_KIND = { gas: 0, icegiant: 1, lava: 2, desert: 3, temperate: 4, ocean: 4, glacier: 5, airless: 6, crystal: 6, venus: 7, subneptune: 8 };
  const siblingKind = (k) => { const c = physClass(exoPlanet(k)); return c == null ? 3 : SIB_KIND[c]; };

  // 밀도(g/cm³), 표면 중력(지구 = 1), 탈출 속도(km/s)
  const bulk = (p) => ({ density: 5.514 * p.masse / Math.pow(p.rade, 3), g: p.masse / (p.rade * p.rade), vesc: 11.186 * Math.sqrt(p.masse / p.rade) });
  const MJ = 317.8; // 목성 질량 (지구 = 1)
  // 별빛만 받을 때의 평형 온도 (반사율 0.3)
  const starEqt = (p) => (p.teff != null && p.srad != null && p.a != null ? p.teff * Math.sqrt((p.srad * 0.00465047) / (2 * p.a)) * Math.pow(0.7, 0.25) : null);
  /* 직접 촬영된 거대 행성은 젊어서, 식으며 내놓는 열로 스스로 빛난다(그래서 찍힌다).
   * 기록된 온도가 별빛만으로는 설명되지 않을 만큼 높으면 그것이 행성 자체의 온도다. 아니면 이런 행성의 전형적인 값 1,000K를 쓴다 */
  function selfLum(p) {
    if (p.method !== 'Imaging' || !(p.rade >= 6 || p.masse >= 50)) return null;
    const star = starEqt(p);
    if (p.eqt != null && p.eqt > 400 && (star == null || p.eqt > 2 * star)) return { T: p.eqt, star, measured: true };
    return { T: 1000, star: star != null ? star : p.eqt, measured: false };
  }

  function kindOf(p) {
    const R = p.rade, T = p.eqt;
    if (R >= 6 || p.masse >= 50) {
      if (T != null && T > 1000 && p.per != null && p.per < 10) return '별에 아주 가까이 붙어 도는 ‘뜨거운 목성’입니다. 단단한 표면이 없는 가스 행성입니다.';
      return R > 11.5 ? '목성보다도 큰 가스 행성입니다. 단단한 표면이 없습니다.' : '목성이나 토성처럼 단단한 표면이 없는 가스 행성입니다.';
    }
    // 태양계 기준: 해왕성 3.88 · 천왕성 4.0 · 토성 9.14 (지구 반지름 = 1). 지구와 천왕성 사이, 천왕성과 토성 사이의 크기는 태양계에 없다
    if (R >= 4.4) return '해왕성보다 크고 토성보다 작은 행성입니다. 두꺼운 가스층에 싸여 있을 것으로 보이며, 태양계에는 이런 크기의 행성이 없습니다.';
    if (R >= 3.5) return '해왕성·천왕성과 비슷한 크기의 행성입니다. 두꺼운 가스층에 싸여 있을 것으로 보입니다.';
    if (R >= 2.2) return '지구보다 크고 해왕성보다 작은 행성입니다. 두꺼운 가스층에 싸여 있을 것으로 보이며, 태양계에는 이런 크기의 행성이 없습니다.';
    if (R >= 1.5) return '지구보다 큰 ‘슈퍼지구’입니다. 암석 행성인지, 물이나 가스층에 싸인 행성인지는 아직 확실하지 않습니다.';
    return R < 0.9 ? '지구보다 작은 암석 행성으로 보입니다.' : '지구와 비슷한 크기의 암석 행성으로 보입니다.';
  }
  function environment(p) {
    const out = [kindOf(p)];
    const b = bulk(p), cls = physClass(p), hz = hzZone(p), sl = selfLum(p);
    // 질량과 반지름을 둘 다 잰 행성은 밀도로 속을 짐작할 수 있다
    if (p.massEst === 0 && p.radEst === 0) {
      const d = num(b.density, 2);
      if (b.density < 0.3) out.push(`밀도가 ${d}g/cm³로 물(1)보다 훨씬 작습니다. 솜사탕처럼 부풀어 오른 ‘초저밀도 행성’입니다.`);
      else if (p.rade < 2 && p.masse <= 20) {
        const rock = Math.pow(p.masse, 1 / 3.7); // 지구와 같은 조성(철 핵 1/3, 암석 2/3)일 때의 반지름 (Zeng et al. 2016)
        out.push(p.rade < rock * 0.9 ? `밀도가 ${d}g/cm³로 같은 질량의 지구형 행성보다 무겁습니다. 수성처럼 철로 된 핵이 큰 행성일 수 있습니다.`
          : p.rade > rock * 1.15 ? `밀도가 ${d}g/cm³로 같은 질량의 암석 행성보다 가볍습니다. 물이나 가스를 많이 품고 있을 수 있습니다.`
            : `밀도가 ${d}g/cm³로, 지구처럼 철과 암석으로 이루어진 행성과 잘 맞습니다.`);
      }
    }
    // 목성 질량의 13배: 중수소 핵융합이 일어나는 경계. 행성과 갈색왜성을 가르는 흔한 기준이다
    if (p.masse >= 13 * MJ) {
      const m = p.massEst === 1 ? '최소 질량만 해도' : p.massEst === 2 ? '추정 질량이' : '질량이';
      out.push(`${m} 목성의 13배를 넘어, 중수소 핵융합이 일어날 수 있는 경계를 넘었습니다. 행성이 아니라 갈색왜성일 수도 있습니다.`);
    }
    if (sl) {
      out.push(sl.measured
        ? `직접 촬영된 젊은 행성이라, 별빛보다 행성이 식으며 내놓는 열(약 ${fmt(tempC(sl.T))}°C)로 스스로 빛납니다.` + (sl.T < 800 ? ' 이 온도에서는 빛이 대부분 적외선이라, 눈으로 보면 어둡습니다.' : '')
        : `직접 촬영된 젊은 행성이라 식으며 내놓는 열로 스스로 빛납니다. 그 온도는 알려져 있지 않아, 이런 행성에 흔한 약 ${tempC(sl.T)}°C로 그렸습니다.`);
      if (sl.star != null) out.push(`별빛만으로 데워지는 평형 온도는 약 ${tempC(sl.star)}°C입니다.`);
    } else if (p.eqt != null) {
      const c = tempC(p.eqt);
      out.push(p.hostEst
        ? `평형 온도는 약 ${c}°C로 추정됩니다(모항성을 질량으로 어림한 값). 대기의 온실 효과를 빼고 계산한 값입니다.`
        : physClass(p) === 'airless' || (physClass(p) === 'lava' && atmosphere(p).kind === 'none')
          ? `평형 온도는 약 ${c}°C${p.eqtEst ? '로 추정됩니다' : '입니다'}. 행성 전체의 평균이라, 열을 옮겨 줄 대기가 없으면 낮 쪽은 이보다 훨씬 뜨겁고 밤 쪽은 훨씬 차갑습니다.`
          : `평형 온도는 약 ${c}°C${p.eqtEst ? '로 추정됩니다' : '입니다'}. 대기의 온실 효과를 빼고 계산한 값이라, 실제 표면은 이보다 더 뜨거울 수 있습니다.`);
    }
    // 암석 행성: 대기를 지켰는지, 생명 가능 영역의 어디쯤인지
    const inHz = hz === 'hz' ? '생명 가능 영역(물이 액체로 있을 수 있는 거리) 안에 있지만, ' : '';
    if (cls === 'airless') out.push(`${inHz}받는 빛에 비해 중력이 약해서 대기를 붙잡아 두기 어렵습니다(‘우주 해안선’ 너머). 수성이나 달처럼 대기가 없을 가능성이 높습니다.`);
    else if (cls === 'desert') out.push(`${inHz}받는 빛에 비해 중력이 약한 편이라, 대기가 있더라도 화성처럼 얇을 것으로 보입니다.`);
    else if (cls === 'glacier' && atmosphere(p).kind === 'thin') out.push('대기가 있더라도 얇고, 몹시 추워서 물은 모두 얼어 있을 것입니다.');
    else if (cls === 'lava') out.push(atmosphere(p).kind === 'none'
      ? '별을 마주한 쪽은 암석이 녹을 만큼 뜨겁습니다. 대기는 거의 없고, 녹은 암석에서 피어오른 얇은 증기만 있을 것으로 보입니다.'
      : '별을 마주한 쪽은 암석이 녹을 만큼 뜨겁습니다.');
    else if (cls === 'venus') out.push('받는 빛이 생명 가능 영역의 안쪽 경계보다 강해서, 바다가 모두 증발하는 ‘폭주 온실’ 상태일 가능성이 높습니다. 그림은 금성처럼 짙은 구름에 덮인 모습으로 그렸습니다.');
    else if (cls === 'glacier') out.push('생명 가능 영역보다 바깥이라, 물이 있다면 대부분 얼어 있을 것입니다.');
    else if (cls === 'ocean') out.push('생명 가능 영역 안에 있지만 암석 행성이라기엔 커서, 깊은 바다나 두꺼운 대기로 덮인 행성일 수 있습니다.');
    else if (cls === 'temperate') out.push('생명 가능 영역 안에 있고 크기도 암석 행성 범위라, 표면에 액체 상태의 물이 있을 수 있는 후보로 꼽힙니다.');
    return out.join(' ');
  }
  /* 이 행성에서 본 우리 태양: 행성 방향의 정반대에, 거리로 정해지는 겉보기 등급(태양의 절대 등급 4.83)으로 보인다 */
  const sunMag = (p) => (p.dist != null ? 4.83 + 5 * Math.log10(p.dist / 3.26156 / 10) : null);
  function skyText(p, o = {}) {
    const out = [];
    const sc = isPulsar(p) ? null : starClass(p.teff, p.srad);
    if (sc && p.srad != null && p.a != null) {
      const k = (p.srad / p.a); // 지구에서 본 해 = 1
      // 겉보기 지름이 1′(해의 약 1/30)보다 작으면 사람 눈으로는 원반을 알아볼 수 없다
      const size = k >= 1.15 ? `지구에서 보는 해보다 ${num(k)}배 크게 보입니다`
        : k < 0.03 ? '너무 작아서 원반은 보이지 않고, 아주 밝은 별처럼 점으로 보입니다'
        : k <= 0.87 ? `지구에서 보는 해의 ${num(k, 2)}배 크기로 작게 보입니다`
          : '지구에서 보는 해와 비슷한 크기로 보입니다';
      out.push(`이 행성의 하늘에서 모항성 ${josa(p.host, '은/는')} ${sc.desc}이며, ${size}.`
        + (o.shrunk ? ' 그림에서는 큰 별을 줄여 그렸는데, 아래 버튼으로 실제 크기를 볼 수 있습니다. 별이 클수록 빛이 여러 방향에서 와서 낮과 밤의 경계가 넓게 번집니다.' : ''));
    } else if (sc) {
      out.push(`모항성 ${josa(p.host, '은/는')} ${sc.desc}입니다.`);
    }
    if (sc && STAR_NOTE[sc.kind]) out.push(STAR_NOTE[sc.kind]);
    if (p.hostEst) out.push('미세중력렌즈로 발견된 행성이라 모항성의 빛은 관측되지 않았습니다. 이런 모항성은 대부분 적색왜성이라, 질량으로 온도와 크기를 어림했습니다.');
    if (isPulsar(p)) out.push('모항성은 초신성 폭발 뒤에 남은 펄서(지름 20km 남짓의 중성자별)입니다. 보이는 빛을 거의 내지 않아서, 하늘에는 해 대신 희미한 점 하나만 떠 있습니다(그림에서는 행성이 보이도록 밝기를 크게 올렸습니다).'
      + (o.steady ? ' 대신 펄서가 내뿜는 고에너지 입자 바람이 쉬지 않고 쏟아져, 대기가 남아 있다면 극지방에 청보랏빛 오로라가 늘 일렁일 것으로 봅니다(그림은 대기가 옅게 남아 있다고 가정했습니다).' : ''));
    if (flareStar(p)) {
      // 오로라는 대기의 기체가 빛나는 것이라 대기가 없는 행성에는 생기지 않는다 (그림도 같다)
      const noAir = atmosphere(p).kind === 'none';
      out.push(noAir
        ? '적색왜성은 표면에서 플레어(갑작스러운 폭발)가 자주 일어나, 가끔 모항성이 순간적으로 밝아집니다. 이 행성에는 대기가 없어 오로라는 생기지 않습니다.'
        : `적색왜성은 표면에서 플레어(갑작스러운 폭발)가 자주 일어납니다. 가끔 모항성이 순간적으로 밝아지고, 뒤이어 행성의 극지방에 ${o.aurora ? o.aurora + ' ' : ''}오로라가 번집니다(실제로는 몇 시간에서 며칠 뒤이지만 화면에서는 몇 초로 줄였습니다).`
          + (o.aurora ? ` 오로라의 색은 대기의 기체가 정합니다(산소는 초록, 질소는 청보라, 수소는 분홍).` : ''));
    }
    // 레일리 산란: 짧은 파장일수록 강하게 흩어진다(λ⁻⁴). 붉은 별의 빛에는 푸른빛이 적어서 하늘이 덜 파랗다
    if (o.rayleigh && p.teff != null && p.teff < 4800) out.push('하늘빛은 별빛의 색을 따릅니다. 푸른빛을 거의 내지 않는 붉은 별 아래라서, 대기가 흩뜨리는 빛도 지구의 파란 하늘보다 희뿌연 색에 가깝습니다(그림의 대기 빛도 이 계산을 따랐습니다).');
    const pt = periodText(p.per);
    if (pt) out.push(`이곳의 1년은 ${pt}입니다.`);
    if (p.a != null && p.a < 0.1) {
      out.push('별에 매우 가까워서 조석 고정되었을 가능성이 높습니다. 그렇다면 한쪽은 늘 낮, 반대쪽은 늘 밤입니다. 그림 속 행성도 자전하지 않고 늘 같은 면이 별을 향하도록 그렸습니다.');
      // 뜨거운 목성: 적도의 강한 제트가 가장 뜨거운 곳을 동쪽으로 밀어낸다 (HD 189733 b 관측)
      if (p.rade >= 6 || p.masse >= 50) out.push('가장 뜨거운 곳은 적도를 따라 부는 강한 바람에 밀려 별을 마주한 곳보다 조금 동쪽에 있습니다.');
    }
    if (p.ecc != null && p.ecc > 0.4) out.push(`궤도가 많이 찌그러져 있어서(이심률 ${p.ecc}), 별에 가까워지는 계절과 멀어지는 계절의 차이가 큽니다.`);
    if (p.snum > 1) {
      out.push(CB.has(p.name) && isPulsar(p)
        ? '이 행성은 펄서와 그 짝별이 서로 도는 쌍성을 함께 돕니다. 하늘에는 짝별이 작고 밝은 점으로 보입니다.'
        : CB.has(p.name)
        ? `이 행성은 두 별을 함께 돌기 때문에 하늘에 해가 두 개 뜹니다. 두 해는 서로를 돌며 가까워졌다 멀어집니다(두 별 사이 거리는 알려져 있지 않아 궤도가 안정한 조건으로 추정했습니다).`
        : `이 항성계에는 별이 ${p.snum}개 있습니다. 하늘에는 모항성 말고도 유난히 밝은 별${p.snum > 2 ? '들이' : '이'} 보입니다(동반성까지의 거리는 알려져 있지 않아 이런 쌍성계에서 흔한 수백 AU로 가정했습니다).`);
    }
    if (p.pnum > 1) {
      const sib = siblingRows(p.host, p.name).map((k) => EXO.rows[k][0]);
      out.push(`같은 항성계에서 행성이 ${p.pnum - 1}개 더 발견되었습니다.` + (sib.length && p.a != null
        ? ` 이 행성의 하늘에는 ${josa(sib.join(', '), '이/가')} 초승달이나 밝은 점으로 떠 있습니다`
          + (p.orb.T0 != null && siblingRows(p.host, p.name).every((k) => EXO.rows[k][28] != null)
            ? '(실제 크기와 궤도, 관측된 트랜싯 시각으로 계산한 오늘의 위치).'
            : '(실제 크기와 궤도로 계산했지만, 일부 행성은 궤도 위의 현재 위치가 알려져 있지 않아 임의로 정했습니다).')
        : ''));
    }
    const m = sunMag(p);
    if (m != null && p.sunCon) {
      out.push(`이곳에서 보면 우리 태양은 ${p.sunCon}자리 쪽(지구 하늘의 별자리 기준)에서 ${m.toFixed(1)}등급으로 빛나는 별입니다. `
        + (m <= 6 ? (m <= 3 ? '맨눈으로도 또렷이 보입니다.' : '어두운 밤하늘에서는 맨눈으로 보입니다.') : '맨눈으로 볼 수 있는 한계(약 6등급)보다 어두워, 망원경이 있어야 보입니다.')
        + ' 그림 속 하늘에서도 태양과 은하수(가장 밝은 곳은 궁수자리 쪽 은하 중심)를 실제 방향에 두었습니다. 궤도면이 하늘에서 어느 쪽으로 누웠는지는 알 수 없어서, 그 방향만 은하수가 잘 보이도록 골랐습니다.');
    }
    return out.join(' ');
  }

  /* ───────────── 오늘 생일을 맞는 행성 ─────────────
   * 태어난 날부터 오늘까지 D일. 공전 주기가 P일인 행성에서 N번째 해가 끝나는 순간(태어난 지 N·P일)이
   * 오늘 하루 안(D ≤ N·P < D+1)에 있으면, 그 행성의 달력으로 오늘이 N번째 생일이다.
   * 그런 행성(날마다 800~900개) 중 1년이 가장 긴 행성, 즉 가장 드물게 찾아오는 생일을 고른다.
   * 태어난 시각은 모르므로 하루 단위로 세고, 공전 주기가 하루보다 짧은 행성(하루에도 생일이 여러 번)은 뺀다 */
  const dayNum = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null;
  };
  const dayStr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
  function todayStr() {
    const t = new Date(), p = (x) => String(x).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }
  function birthdayMatches(D) {
    const out = [];
    EXO.rows.forEach((r, i) => {
      const P = r[7];
      if (!(P >= 1)) return;
      const N = Math.ceil(D / P);
      if (N >= 1 && N * P < D + 1) out.push({ index: i, n: N, period: P });
    });
    return out;
  }
  // 생일(YYYY-MM-DD) → {index, n, date}. 오늘 이전의 날짜가 아니면 null
  function birthdayPlanet(birth, today) {
    const b = dayNum(birth), t = dayNum(today || todayStr());
    if (b == null || t == null || t - b < 1 || b < dayNum('1900-01-01')) return null;
    const m = birthdayMatches(t - b);
    if (!m.length) return null;
    const best = m.reduce((x, y) => (y.period > x.period ? y : x));
    return { index: best.index, n: best.n, date: dayStr(t) };
  }
  // 링크에 담긴 값(행성 번호, 몇 번째 생일, 기준 날짜)만으로 설명을 다시 만든다. 생일 자체는 필요 없다
  function birthdayInfo(index, n, date) {
    const row = EXO.rows[index], t = dayNum(date);
    const P = row && row[7];
    if (!(P >= 1) || !(n >= 1) || t == null) return null;
    const D = Math.floor(n * P); // 태어난 지 D일째 되는 날이 오늘
    return { n, period: P, days: D, date, count: birthdayMatches(D).length, next: dayStr(t + Math.floor((n + 1) * P) - D) };
  }

  /* ───────────── 창조 ───────────── */
  function genesis(rawName, forceIndex, bday) {
    const owner = NV.normalizeName(rawName) || '이름 없는 별';
    const key = NV.nameKey(owner) || owner;
    const root = NV.makeRng('nameverse/v1/' + key);
    const rv = root.fork('visual');
    const rl = root.fork('lore');

    // 이름 → 실제 행성 (균등 분포라서 희귀도 '상위 X%'가 그대로 참이다)
    const exoIndex = forceIndex != null ? forceIndex : root.fork('exo').int(0, EXO.rows.length - 1);
    const p = exoPlanet(exoIndex);
    const rarity = Object.assign({ topPct: p.top, reason: p.reason }, RARITY.find((t) => p.top < t.max));
    // 희귀도 순위는 예전 기준(평형 온도 175~320K인 작은 행성)으로 매겨졌다. 순위는 그대로 두고,
    // 새 판정(Kopparapu 생명 가능 영역 · 반지름 1.6 이하)으로 영역 밖이면 이유만 사실대로 바꾼다
    if (p.reason === EXO.reasons[0] && !(hzZone(p) === 'hz' && p.rade <= 1.6)) rarity.reason = '온화한 온도의 작은 행성';

    const biome = pickBiome(p, root.fork('biome'));
    const v = biome.gen(rv);
    const atm = atmosphere(p).kind, sl = selfLum(p);
    // 가스 행성의 색을 정하는 온도: 직접 촬영된 젊은 행성은 스스로의 온도
    if (biome.id === 'gas') gasPalette(v, sl ? sl.T : p.eqt, root.fork('palette'));
    if (biome.id === 'subneptune') hazePalette(v, p.eqt, root.fork('palette'));
    // 얇은 대기(화성형) 사막: 물은 액체로 남지 못하고, 구름은 드문 먼지구름뿐이다. 극관은 아래에서 온도로 정한다
    if (biome.id === 'desert') { v.sea = 0; v.city = 0; v.ice = 1.5; v.clouds = Math.min(v.clouds, 0.08); }
    // 대기가 없으면 대기 광륜·구름·도시 불빛·유성·오로라도 없다. 용암 행성에는 녹은 암석의 얇은 증기만 남는다
    v.airless = atm === 'none' && v.type !== 1;
    if (v.airless) { v.atmoStr = biome.id === 'lava' ? v.atmoStr * 0.15 : 0; v.clouds = 0; v.city = 0; }
    // 도시 불빛은 상상이다: 생명 가능한 행성에만 두고, 화면에서는 '상상 속 도시 불빛' 버튼을 눌렀을 때만 그린다
    if (!['temperate', 'ocean'].includes(physClass(p))) v.city = 0;
    else if (atm === 'thin' && v.type !== 1) { v.atmoStr *= 0.35; v.clouds = Math.min(v.clouds, 0.05); }
    v.lightCol = starColor(p.teff).map((c) => 0.45 + 0.55 * c);
    v.lightK = 1; v.starGlow = 1; // 행성을 비추는 빛의 세기, 하늘에 보이는 모항성의 밝기
    v.atmoUI = v.atmo.slice(); // 화면 강조색은 행성 종류의 색 그대로
    /* 레일리 산란(질소·산소·수소처럼 맑은 대기): 흩어진 빛 = 별빛 스펙트럼 × λ⁻⁴. 대기 색은 햇빛 아래 기준으로 만들었으므로
     * 세 파장(610·550·465nm)에서 이 별과 태양의 흑체 복사 비율을 곱한다. 셰이더가 이미 곱하는 조명색(uLightCol)만큼은 나눈다.
     * 붉은 별 아래에서는 푸른빛이 모자라 하늘이 희뿌옇게 된다. 곱하기만 하면 원래 색의 치우침(청록)이 남아 초록빛이 되므로,
     * 채도도 순수한 레일리 산란색의 채도 비율(이 별 ÷ 태양)만큼 줄인다 (3000K에서는 거의 무채색) */
    v.rayleigh = ['ocean', 'garden', 'glacier', 'icegiant'].includes(biome.id) && !v.airless && p.teff != null && !isPulsar(p);
    if (v.rayleigh) {
      const K = [23587, 26160, 30942], LAM = [610, 550, 465], sunL = starColor(5772).map((c) => 0.45 + 0.55 * c);
      const T = Math.max(2300, p.teff);
      // 레일리 산란색: 흑체 복사 B(λ) ∝ λ⁻⁵/(e^(hc/λkT) − 1) × λ⁻⁴
      const ray = (t) => K.map((k, i) => Math.pow(465 / LAM[i], 9) / Math.expm1(k / t));
      const sat = (c) => 1 - Math.min(...c) / Math.max(...c);
      const rs = ray(T), r0 = ray(5772);
      const w = rs.map((x, i) => (x / r0[i]) / (v.lightCol[i] / sunL[i]));
      const mx = Math.max(...v.atmo);
      let c = v.atmo.map((x, i) => x * w[i] / w[0]);
      const gray = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], ks = Math.min(1.2, sat(rs) / sat(r0));
      c = c.map((x) => gray + (x - gray) * ks);
      const cm = Math.max(...c);
      v.atmo = c.map((x) => Math.max(0, x) * mx / cm);
    }
    if (isPulsar(p)) {
      // 펄서는 보이는 빛을 거의 내지 않는다: 하늘에는 희미한 푸르스름한 점 하나, 행성은 어둡게(그래도 보이도록 밝게 보정)
      v.lightCol = starColor(12000).map((c) => 0.45 + 0.55 * c);
      v.lightK = 0.4; v.starGlow = 0.12;
    }
    // 적색왜성(M형)은 플레어가 잦다: 가끔 별이 확 밝아지고, 뒤이어 극지방에 오로라가 번진다.
    // 오로라 색은 대기의 기체가 정한다: 암석 행성은 산소의 초록빛, 가스 행성은 수소의 분홍빛
    v.flare = flareStar(p);
    v.aurora = !v.airless;
    /* 오로라 색은 대기의 기체가 정한다. 산소 원자의 초록(557.7nm): 산소가 많은 대기(생명이 있는 행성)와
     * 이산화탄소 대기(쪼개진 산소 원자 — 화성의 초록 오로라, 금성의 초록 대기광). 질소뿐인 대기는 N₂⁺의 청보라(391.4·427.8nm),
     * 수소 대기는 Hα·Hβ의 분홍, 용암 행성의 암석 증기는 나트륨의 주황 */
    const AUR = { h: [[1.0, 0.38, 0.8], '분홍빛'], o: [[0.35, 1.0, 0.55], '초록빛'], n: [[0.55, 0.42, 1.0], '청보랏빛'], na: [[1.0, 0.62, 0.25], '주황빛'] };
    const ak = biome.id === 'venus' ? 'o' : v.type === 1 ? 'h' : biome.id === 'lava' ? 'na' : biome.id === 'glacier' || biome.id === 'crystal' ? 'n' : 'o';
    v.auroraCol = AUR[ak][0]; v.auroraName = AUR[ak][1];
    // 펄서의 입자 바람은 쉬지 않으므로 오로라도 늘 켜져 있다
    if (biome.id === 'crystal') { v.airless = false; v.aurora = true; v.auroraSteady = 0.9; }
    // 행성에서 본 모항성의 실제 겉보기 반지름 (라디안, 태양 반지름 = 0.00465 AU)
    // 가까이 붙은 거대한 별도 '아주 멀리 있는 광원'으로 느껴지도록 큰 쪽은 눌러서 그린다 (태양 크기는 그대로).
    // 펄서(중성자별)는 지름이 수십 km라 점으로 그린다
    const realAng = p.srad != null && p.a != null ? 0.00465047 * p.srad / p.a : 0.0047;
    v.starAngReal = isPulsar(p) ? 0 : realAng; // '실제 크기로 보기'와 낮·밤 경계의 번짐(별 원반의 크기만큼)에 쓴다
    v.starAng = isPulsar(p) ? 0.0005
      : Math.max(0.0025, realAng <= 0.006 ? realAng : 0.006 + 0.003 * Math.log(1 + (realAng - 0.006) / 0.003));
    v.seedOff = [rv.range(-50, 50), rv.range(-50, 50), rv.range(-50, 50)];
    v.warp = rv.range(0.5, 1.15);
    v.scale = v.type === 1 ? 1 : rv.range(1.5, 2.5) * 0.62; // 작을수록 대륙이 크다
    v.spec = v.spec != null ? v.spec : 0;
    v.bands = v.bands || 0; v.turb = v.turb || 0; v.stormSize = v.stormSize || 0;
    const sy = rv.range(-0.55, 0.55), sa = rv.range(0, Math.PI * 2), sc = Math.sqrt(1 - sy * sy);
    v.storm = [Math.cos(sa) * sc, sy, Math.sin(sa) * sc];
    v.tilt = rv.range(-0.42, 0.42);
    v.spin = (v.type === 1 ? rv.range(0.14, 0.24) : rv.range(0.07, 0.15)) * (rv.chance(0.12) ? -1 : 1);
    // 조석 고정: 별에 매우 가까운(0.1 AU 미만) 행성은 자전하지 않고 늘 같은 면이 별을 향한다(설명 문구와 같은 조건). 뜨거운 목성도 마찬가지다
    v.locked = p.a != null && p.a < 0.1;
    if (v.locked) {
      v.spin = 0; v.tilt *= 0.1; // 조석 고정된 행성은 자전축도 거의 기울지 않는다
      // 공전 주기만큼 느리게 도는 가스 행성은 코리올리 힘이 약해 띠가 적고 넓다.
      // 띠의 수는 자전 속도의 제곱근에 비례한다(라인스 척도, 10시간에 한 바퀴 도는 목성 기준)
      if (v.type === 1 && p.per != null) v.bands = Math.max(0.8, v.bands * Math.min(1, Math.sqrt(10 / (p.per * 24))));
    }
    /* 온도 분포. 평형 온도 T에서, 낮 쪽이 받은 열 중 밤 쪽으로 옮겨 가는 몫 ε(0 안 옮김 ~ 1 고르게)에 따라
     *   조석 고정: T⁴(μ) = Tn⁴ + (Ts⁴ − Tn⁴)·μ (μ = 별을 마주한 정도, 밤 쪽은 Tn)
     *             Tn⁴ = ε·T⁴, Ts⁴ = Tn⁴ + 4(1−ε)·T⁴ → 낮·밤 전체가 내놓는 열이 받는 열과 같다. ε = 0이면 Ts = √2·T
     *   자전: 경도 방향으로는 고르고, 위도별 연평균 햇빛 1.241 − 0.723·sin²(위도)의 ¼제곱 (North 1975)
     * ε: 두꺼운 대기 0.7(조석 고정 행성의 기후 모델), 얇은 대기 0.2, 대기 없음 0, 금성형 0.95(금성은 밤낮 온도가 거의 같다),
     *    가스 행성은 뜨거울수록 열을 덜 옮긴다 1/(1 + (T/1400K)³) (뜨거운 목성의 낮·밤 온도 차 관측 경향)
     * 지표 기온에는 온실 효과를 더한다: 두꺼운 대기의 암석 행성은 지구 비율(실제 288K ÷ 평형 255K ≈ 1.13).
     * 셰이더(얼음 경계·열복사)와 지표 탐사(surface.js)가 모두 이 값을 쓴다 */
    v.therm = null;
    if (sl) v.therm = { Tint: sl.T };
    else if (p.eqt != null) {
      const T = p.eqt, gasLike = v.type === 1;
      const eps = biome.id === 'venus' ? 0.95 : gasLike ? 1 / (1 + Math.pow(T / 1400, 3))
        : atm === 'none' ? 0 : atm === 'thin' ? 0.2 : 0.7;
      v.therm = {
        // 빛이 닿지 않는 곳도 땅속에서 올라오는 열 때문에 절대영도까지 식지는 않는다 (달·수성 극지의 영구 음영 지역 약 25~50K)
        locked: v.locked, Tm: T, Tn: Math.max(T * Math.pow(eps, 0.25), Math.min(40, T / 2)), Ts: T * Math.pow(eps + 4 * (1 - eps), 0.25),
        gh: !gasLike && v.type !== 2 && atm === 'thick' ? 1.13 : 1,
        shift: gasLike && biome.id !== 'venus' && v.locked ? 0.6 * eps : 0, // 가장 뜨거운 곳이 동쪽으로 밀린 각도(rad)
      };
    }
    const th = v.therm;
    if (v.locked) {
      // 눈알 행성: 지표 기온이 물이 어는 273K보다 낮은 곳은 얼음. 별을 마주한 정도가 lockIce보다 작으면 얼음이다
      const wet = (v.type === 0 || v.type === 3) && !v.airless && (p.eqt == null || p.eqt < 450); // 뜨거운 사막은 얼 물이 없다
      if (!wet) v.lockIce = -2;
      else if (!th || !th.Ts) v.lockIce = 0.5; // 온도를 모르면 밤 쪽 절반쯤
      else {
        const Tf = 273 / th.gh, n4 = Math.pow(th.Tn, 4), d4 = Math.pow(th.Ts, 4) - n4;
        v.lockIce = th.Tn >= Tf ? -2 : Math.min(1.5, (Math.pow(Tf, 4) - n4) / Math.max(d4, 1e-9));
      }
    } else if (v.type === 0 && th && th.Tm && biome.id !== 'airless') {
      // 자전하는 행성의 극관: 연평균 기온이 문턱보다 낮은 위도부터 얼음으로 덮인다. 물이 많은 행성은 −10°C(263K),
      // 얇은 대기의 메마른 사막은 물이 적어 훨씬 추운 곳(180K)에만 남는다(화성의 극관). 지구라면 위도 약 60°부터
      const cap = biome.id === 'desert' ? 180 : 263;
      const S = Math.pow(cap / (th.Tm * th.gh), 4), x2 = (1.241 - S) / 0.723;
      v.ice = x2 <= 0 ? -1 : x2 >= 1 ? 1.5 : Math.sqrt(x2); // 모두 얼음 / 극관 없음 / 그 위도의 sin 값
    }
    /* 열복사: 뜨거운 곳은 스스로 빛난다. 셰이더가 흑체 복사를 세 파장(610·550·465nm)에서 계산한다:
     *   방출 = A / (e^(hc/λkT) − 1),  A = (e^(hc/λkT★) − 1) / (R★/a)² × 조명색
     * 이렇게 하면 별빛을 받는 흰 표면의 밝기가 1인 단위가 된다(빛의 세기와 색 모두 실제 비율).
     * 방출이 반사광보다 훨씬 밝으면(스스로 빛나는 젊은 행성, 가장 뜨거운 목성) 사진처럼 노출을 줄여 가장 밝은 곳에 맞춘다 */
    v.thermMode = 0; v.thermA = [0, 0, 0]; v.thermP = [0, 0, 0];
    if (th) {
      const K = [23587, 26160, 30942]; // hc/(λk) (K)
      const planck = (k, T) => 1 / Math.expm1(Math.min(k / T, 700));
      const ra = p.teff != null && p.srad != null && p.a != null && !isPulsar(p) ? 0.00465047 * p.srad / p.a : null;
      const mode = th.Tint ? 3 : th.locked ? 1 : 2; // 1 조석 고정 · 2 자전 · 3 스스로 빛남
      const Tmax = th.Tint || (th.locked ? th.Ts : th.Tm * Math.pow(1.241, 0.25));
      // 별을 모르는 촬영 행성은 낮빛(태양)에 맞춘 색만 쓰고, 별빛 반사는 거의 보이지 않게 한다
      let A = ra != null ? K.map((k, i) => Math.expm1(k / p.teff) / (ra * ra) * v.lightCol[i])
        : mode === 3 ? K.map((k) => Math.expm1(k / 5772)) : null;
      if (A) {
        const peak = Math.max(...K.map((k, i) => A[i] * planck(k, Tmax)));
        const expo = ra == null ? 1.2 / peak : Math.min(1, 1.2 / peak);
        v.lightK *= ra == null ? 0.05 : expo;
        A = A.map((x) => x * expo);
        if (peak * expo > 0.004) { // 눈에 띌 만큼 빛날 때만 셰이더가 계산한다
          const n4 = mode === 1 ? Math.pow(th.Tn, 4) : 0;
          v.thermMode = mode; v.thermA = A;
          v.thermP = mode === 1 ? [n4, Math.pow(th.Ts, 4) - n4, 0] : [0, 0, Math.pow(mode === 3 ? th.Tint : th.Tm, 4)];
        }
      }
    }
    // 하늘에 뜨는 이웃 행성: 실제 궤도 반지름(없으면 공전 주기 비율로 케플러 제3법칙)과 반지름
    v.orbit = p.a != null ? Object.assign({ a: p.a }, p.orb) : null;
    v.siblings = !v.orbit ? [] : siblingRows(p.host, p.name).map((k) => {
      const r = EXO.rows[k];
      const a = r[8] != null ? r[8] : r[7] != null && p.per != null ? p.a * Math.pow(r[7] / p.per, 2 / 3) : null;
      return a != null && r[3] != null ? Object.assign({ name: r[0], a, rade: r[3], kind: siblingKind(k) }, orbitEl(r)) : null;
    }).filter(Boolean).slice(0, 7);
    // 여러 별로 이루어진 항성계. 데이터에는 별의 개수만 있고 동반성의 거리·밝기는 없어서 전형적인 값으로 추정한다
    // (행성 모습의 난수를 건드리지 않도록 모항성 이름으로 만든 별도 난수를 쓴다)
    v.star2 = null; v.companions = [];
    if (p.snum > 1) {
      const hr = NV.makeRng('stars/' + p.host);
      if (CB.has(p.name)) {
        // 두 별을 함께 도는 행성: 두 별 사이 거리는 궤도가 안정한 한계(행성 궤도의 약 1/3.5, Kepler-16·47과 비슷),
        // 궤도가 아주 먼(10 AU 이상) 행성은 두 별이 훨씬 가까이 붙어 있다고 본다. 서로 도는 주기는 케플러 제3법칙
        const k = p.a != null && p.a < 10 ? 1 / 3.5 : 0.05;
        v.star2 = { sep: k, P: p.per != null ? p.per * Math.pow(k, 1.5) : 30, h: hr.range(0, Math.PI * 2), size: 0.5,
          col: starColor((p.teff || 5000) * 0.7).map((c) => 0.45 + 0.55 * c) }; // 보통 더 작고 차가운 별
        // 펄서의 짝별은 멀리서 보면 점이다 (PSR B1620-26의 짝은 백색왜성). 크기는 모항성(점) 기준이라 따로 줄일 필요가 없다
        if (isPulsar(p)) v.star2.col = starColor(9000).map((c) => 0.45 + 0.55 * c);
      } else {
        // 멀리 떨어진 동반성: 밝은 별처럼 보인다. 방향은 모항성 이름으로 정해 누구에게나 같다
        for (let i = 0; i < Math.min(2, p.snum - 1); i++) {
          const u = hr.range(-1, 1), th = hr.range(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
          v.companions.push({ dir: [s * Math.cos(th), u, s * Math.sin(th)], bright: hr.range(0.9, 1.5), col: starColor(hr.range(3200, 5600)) });
        }
      }
    }
    v.cloudSpeed = rv.range(0.008, 0.02);
    /* 하늘에 둘 우리 태양 (renderer가 궤도 위치에 맞춰 방향을 정한다).
     *   eq: 이 항성계에서 태양 쪽 방향(적도 좌표 단위 벡터), mag: 겉보기 등급
     *   트랜싯(또는 합) 시각을 아는 행성은 그 순간 행성이 별과 태양 사이에 있으므로 태양이 궤도 위 90° 경도에 있다.
     *   모르면 방향을 이름으로 정한다 (궤도 경사가 무작위일 때처럼 sin(고도)가 고르게) */
    {
      const ra = p.ra * Math.PI / 180, de = p.dec * Math.PI / 180, hs = NV.hash('sun/' + p.name);
      const known = p.orb.T0 != null;
      v.sun = {
        eq: [-Math.cos(de) * Math.cos(ra), -Math.cos(de) * Math.sin(ra), -Math.sin(de)],
        mag: sunMag(p),
        lon: known ? Math.PI / 2 : (hs[0] / 4294967296) * Math.PI * 2,
        lat: known && p.orb.incl != null ? (90 - p.orb.incl) * Math.PI / 180 : Math.asin((hs[1] / 4294967296) * 2 - 1) * (known ? 0.2 : 1),
      };
    }

    // 고리와 위성 (외계행성의 고리·위성은 아직 관측된 적이 없어서 상상으로 그린다)
    // 태양계의 거대 행성은 모두 고리가 있지만 눈에 띄게 밝은 것은 토성뿐이다. 암석 행성의 고리는 알려진 예가 없다
    const ringChance = { gas: 0.4, icegiant: 0.3, subneptune: 0.1 }[biome.id] || 0.04;
    // 예전에는 희귀도 상위 5%면 무조건 고리를 그렸다. 그 행성들은 rv를 쓰지 않았으므로(뒤따르는 난수 순서를 지키려고) 별도 스트림으로 뽑는다
    const hasRing = rarity.topPct < 5 ? root.fork('ring').chance(ringChance) : rv.chance(ringChance);
    if (hasRing) {
      const inner = rv.range(1.35, 1.6);
      v.ring = {
        inner, outer: inner + rv.range(0.5, 1.05),
        color: v.type === 1 ? hsl(rv.range(25, 45), 0.35, 0.75) : hsl(rv.range(0, 360), rv.range(0.1, 0.35), rv.range(0.65, 0.8)),
        seed: rv.range(0, 100),
      };
    } else { rv.next(); v.ring = null; }

    const moonDraw = rv.weighted([{ n: 0, weight: 28 }, { n: 1, weight: 35 }, { n: 2, weight: 23 }, { n: 3, weight: 14 }]).n;
    v.moons = [];
    /* 위성은 로슈 한계(행성의 조석에 부서지는 거리) 바깥에만 있을 수 있다: 2.44 × 행성 반지름 × (행성 밀도 ÷ 위성 밀도)^⅓.
     * 위성 밀도는 거대 행성의 얼음 위성 2 g/cm³, 암석 행성의 달 3.3 g/cm³ (달). 그림에서는 실제보다 훨씬 가깝게 그린다(달은 지구 반지름의 60배) */
    const rho = bulk(p).density, rhoM = v.type === 1 ? 2 : 3.3;
    const roche = Math.min(3.2, Math.max(2, 2.44 * Math.cbrt(rho / rhoM)));
    const base = Math.max(v.ring ? v.ring.outer + 0.22 : 0, roche);
    for (let i = 0; i < moonDraw; i++) {
      const dist = base + i * 0.34 + rv.range(0, 0.22);
      v.moons.push({
        // 거대 행성의 위성은 행성에 비해 아주 작다 (가니메데는 목성 반지름의 0.037배, 타이탄은 토성의 0.044배). 달은 지구의 0.27배
        r: rv.range(0.07, 0.15) * (v.type === 1 ? 0.3 : 1), dist,
        speed: (0.32 / Math.pow(dist, 1.5)) * rv.range(0.8, 1.2),
        phase: rv.range(0, Math.PI * 2), incl: rv.range(-0.28, 0.28),
        color: hsl(rv.range(0, 360), rv.range(0, 0.18), rv.range(0.55, 0.75)),
      });
    }
    // 조석 고정될 만큼 별에 가까우면 별의 조석 때문에 달은 궤도를 잃고(Barnes & O'Brien 2002), 고리는 별빛에 흩어진다.
    // 그 밖의 행성도 달은 힐 반경(행성의 중력이 별의 중력을 이기는 범위)의 약 절반 안쪽에서만 오래 돈다
    // (Domingos et al. 2006: 0.49 × (1 − 1.03e) × 힐 반경). (다른 행성의 모습이 바뀌지 않도록 난수는 똑같이 쓰고 결과만 지운다)
    const mStar = p.smass != null ? p.smass : p.teff != null && p.teff < 3900 && !(p.srad >= 2) ? 0.35 : 1;
    const hillR = p.a != null ? (p.a * 23455 / p.rade) * Math.cbrt(p.masse / 332946 / (3 * mStar)) : Infinity; // 행성 반지름 단위
    const moonMax = 0.49 * Math.max(0, 1 - 1.03 * (p.ecc || 0)) * hillR;
    const hadMoons = v.moons.length > 0;
    if (v.locked) { v.ring = null; v.moons = []; }
    v.moons = v.moons.filter((m) => m.dist < moonMax);
    v.moonLost = hadMoons && !v.moons.length;
    const moonCount = v.moons.length;
    const moonExt = v.moons.length ? v.moons[v.moons.length - 1].dist + 0.15 : 0;
    // 위성은 대부분 가로로 오가므로, 위성 때문에 행성이 너무 작아지지 않게 화면 범위는 2.3배까지만 넓힌다
    v.extent = Math.max(1.28, v.ring ? v.ring.outer * 1.03 : 0, Math.min(moonExt, 2.3));

    const planet = p.name;
    const moonNames = v.moons.map(() => moonName(rl));
    const vars = {
      owner, planet, seaPct: Math.round(Math.min(97, Math.max(3, (v.sea - 0.3) * 330))),
      lakes: rl.int(3, 99), n: rl.int(2, 12), stormN: rl.int(2, 9), // stormN은 더 쓰지 않지만 난수 순서를 지키려고 남겨 둔다
      storm: moonName(rl) + '의 눈',
    };
    vars.stormJosa = hasBatchim(vars.storm) ? '은' : '는';
    vars.stormCmp = stormText(stormKm(v, p));

    // 관측 기록 (실제 데이터)
    const distText = p.dist != null ? `지구에서 약 ${fmt(p.dist)}광년 떨어진 ${p.con}자리 방향에 있습니다.` : `${p.con}자리 방향에 있습니다. 정확한 거리는 아직 모릅니다.`;
    const discovery = `${p.year}년 ${p.methodKo} 방법으로 발견되었습니다(${p.facility}). ${METHOD_STORY[p.method] || ''} ${distText}`.replace(/\s+/g, ' ').trim();

    // 상상 기록
    // hot/cold 표시가 있는 문장은 그 온도의 행성에서만 쓴다 (뽑는 난수의 수는 같다)
    const landPool = biome.land.filter((s) => typeof s === 'string' || (s.hot ? p.eqt > 330 : s.cold ? p.eqt < 273 : true)).map((s) => s.t || s);
    const landSentences = rl.sample(landPool, 2).map((s) => fill(s, vars));
    let moonLine;
    if (moonCount === 0) moonLine = v.moonLost || v.locked ? '별에 너무 가까워 달을 붙잡아 둘 수 없어서 달은 없습니다.' : '달은 없습니다.';
    else if (moonCount === 1) moonLine = `${josa(moonNames[0], '이라는/라는')} 달 하나가 곁을 돕니다.`;
    else moonLine = `달은 ${moonNames.join(', ')}, 모두 ${moonCount}개입니다.`;
    // 생명 가능 영역 안에서 두꺼운 대기를 지킨 행성만 (물리 판정과 같은 조건)
    const pc = physClass(p), habitable = pc === 'temperate' || pc === 'ocean';
    const lifeCat = biome.id === 'venus' ? 'cloud' : habitable || biome.cat === 'gas' ? biome.cat : p.eqt != null && p.eqt < 175 ? 'cold' : 'fire';
    const inh = rl.pick(INHABITANTS[lifeCat]);
    const habit = rl.pick(HABITS);
    const lifeText = habitable
      ? `생명이 있다면 ${josa(inh, '이/가')} 살고 있을지도 모릅니다. 이들은 ${habit}.`
      : `이 환경에서 생명체가 살기는 어렵습니다. 굳이 상상해 본다면 ${josa(inh, '이/가')} 버틸 수 있을 것 같습니다.`;
    const phenPool = PHENOMENA.filter((x) => (!x.moons || moonCount >= x.moons) && (!x.ring || v.ring) && (!x.cats || x.cats.includes(biome.cat)) && (!x.air || !v.airless) && (!x.noAir || v.airless));
    const phenomenon = fill(rl.pick(phenPool).t, vars);
    const proverb = rl.pick(PROVERBS);
    const tags = rl.sample(TAGS, 3);
    const role = rl.pick(ROLES);

    const lore = [
      { title: '발견', text: discovery, real: true },
      { title: '환경', text: environment(p), real: true },
      { title: '하늘', text: skyText(p, { rayleigh: v.rayleigh, shrunk: v.starAngReal > v.starAng * 1.3, aurora: v.aurora && v.auroraName, steady: !!v.auroraSteady }) || '모항성에 대한 자료가 아직 부족합니다.', real: true, sky: true },
      { title: '풍경', text: `${landSentences.join(' ')} ${moonLine}` },
      { title: '생명', text: lifeText },
      { title: '현상', text: phenomenon },
    ];

    // 관측 데이터
    const est = (on) => (on ? ' (추정)' : '');
    const km = p.rade * 12742;
    const sc2 = isPulsar(p) ? { short: '펄서' } : starClass(p.teff, p.srad);
    const massText = p.masse >= 100 ? `목성의 ${num(p.masse / 317.8, 2)}배` : `지구의 ${num(p.masse)}배`;
    // 밀도·중력·탈출 속도는 질량과 반지름에서 나온다: 둘 중 하나라도 추정값이면 (추정), 질량이 최솟값이면 '최소'
    const bk = bulk(p), bMin = p.massEst === 1 ? '최소 ' : '', bEst = est(p.massEst === 2 || !!p.radEst);
    const sl2 = selfLum(p);
    // 직접 촬영된 젊은 행성은 '평형 온도'로 행성 자체의 온도가 기록된 경우가 있다: 별빛만 받을 때의 값을 따로 보여 준다
    const eqT = sl2 ? sl2.star : p.eqt;
    const eqTxt = eqT != null ? `${tempC(eqT)} °C${est(p.eqtEst || (sl2 && sl2.measured))}` : '미상';
    // 숫자를 오해하지 않도록 붙이는 설명 (관측 데이터 표 아래)
    const statNotes = [
      eqT != null && (p.eqtEst
        ? '평형 온도: 대기가 없다고 보고 받는 별빛만으로 계산한 온도로, 이 행성은 반사율 0.3을 가정해 계산했습니다. 실제 지표는 온실 효과로 더 따뜻할 수 있습니다.'
        : '평형 온도: 대기가 없다고 보고 받는 별빛만으로 계산한 온도입니다. NASA 값은 논문마다 가정한 반사율(0이나 0.3 등)과 열 분배가 달라 수십 도 차이가 날 수 있고, 실제 지표는 온실 효과로 더 따뜻할 수 있습니다.'),
      p.esi != null && '지구 유사도(ESI): 반지름과 받는 빛의 양 두 가지만으로 계산한 간이 지수(0~1)입니다. 대기나 물이 있는지는 반영하지 않습니다.',
    ].filter(Boolean);
    const stats = [
      { k: '지름', v: `지구의 ${num(p.rade, 2)}배 · ${fmt(km)} km${est(p.radEst)}`, short: `${fmt(km)} km` },
      { k: '질량', v: `${p.massEst === 1 ? '최소 ' : ''}${massText}${est(p.massEst === 2)}` },
      { k: '밀도', v: `${bMin}${num(bk.density, 2)} g/cm³${bEst}` },
      // 중력이 N배면 몸무게도 N배로 느껴진다. 가스 행성은 딛을 땅이 없어 구름 꼭대기(1기압) 높이의 값이다
      { k: '표면 중력', v: `${bMin}지구의 ${num(bk.g, 2)}배${bEst}`,
        sub: `${v.type === 1 ? '구름 꼭대기 기준 · ' : ''}몸무게 60kg → ${bMin}${fmt(60 * bk.g)}kg` },
      { k: '탈출 속도', v: `${bMin}초속 ${num(bk.vesc, 1)} km${bEst}` },
      { k: '공전 주기', v: periodText(p.per) || '미상' },
      // 궤도는 타원이라 '반지름'이 아니라 긴반지름(가장 먼 곳과 가장 가까운 곳 거리의 평균)이다
      { k: '궤도 긴반지름', v: p.a != null ? `${num(p.a, 3)} AU` : '미상' },
      { k: '평형 온도', v: eqTxt, short: eqT != null ? `${tempC(eqT)} °C` : '미상' },
      { k: '지구 유사도', v: p.esi != null ? p.esi.toFixed(2) : '미상' },
      { k: '거리', v: p.dist != null ? `${fmt(p.dist)} 광년` : '미상' },
      { k: '모항성', v: [p.host, sc2 && sc2.short, !isPulsar(p) && p.teff != null && `${fmt(p.teff)} K`].filter(Boolean).join(' · ') + est(p.hostEst), wide: true },
      { k: '발견', v: `${p.year}년 · ${p.methodKo} · ${p.facility}`, wide: true },
    ];

    // 음악
    const isGas = v.type === 1;
    const rm = root.fork('music');
    const music = {
      mode: biome.mode,
      root: 45 + rm.int(0, 9),
      bpm: Math.round(isGas ? rm.range(56, 72) : v.type === 2 ? rm.range(66, 84) : rm.range(64, 92)),
      progression: rm.pick([[0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3], [0, 2, 3, 4], [3, 4, 0, 0], [0, 6, 5, 4], [0, 3, 0, 4], [5, 4, 3, 4]]),
      padWave: rm.pick(['sawtooth', 'triangle', 'sawtooth']),
      arpWave: rm.pick(['sine', 'triangle', 'sine']),
      pattern: Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? rm.chance(0.9) : rm.chance(0.45)) ? rm.int(0, 5) : -1),
      bellChance: rm.range(0.03, 0.12),
      cutoff: rm.range(900, 2400),
      seed: rm.int(0, 1e9),
    };

    return {
      // 생일로 고른 행성은 같은 이름이라도 다른 행성이므로 구별한다
      owner, key: forceIndex != null ? `${key}@${exoIndex}` : key, planet, catalog: p.host, exo: p, exoIndex,
      bday: bday ? birthdayInfo(exoIndex, bday.n, bday.date) : null,
      biome: { id: biome.id, name: biome.name, cat: biome.cat },
      rarity, visual: v, stats, statNotes, lore, proverb, tags, role, constellation: p.con, coords: { ra: raText(p.ra), dec: decText(p.dec) },
      moonNames, music, accent: toCss(v.atmoUI), accentRgb: v.atmoUI,
    };
  }

  /* ───────────── 궁합 ───────────── */
  function xyz(p) {
    const ra = p.ra * Math.PI / 180, dec = p.dec * Math.PI / 180;
    return [p.dist * Math.cos(dec) * Math.cos(ra), p.dist * Math.cos(dec) * Math.sin(ra), p.dist * Math.sin(dec)];
  }
  function harmony(a, b) {
    const keys = [a.key, b.key].sort();
    const r = NV.makeRng('nameverse/duo/' + keys.join('♥'));
    const score = a.key === b.key ? 100 : Math.round(52 + 47 * Math.pow(r.next(), 0.65));
    const tiers = [
      { min: 100, name: '거울 쌍성', desc: '같은 이름, 같은 행성입니다.' },
      { min: 95, name: '쌍성계', desc: '서로의 중력에 묶여 함께 도는 사이입니다.' },
      { min: 85, name: '서로를 도는 연성', desc: '거리는 멀어도 리듬이 잘 맞는 사이입니다.' },
      { min: 70, name: '이웃 궤도', desc: '적당한 거리를 두고 잘 지내는 이웃입니다.' },
      { min: 55, name: '스쳐 가는 혜성', desc: '가끔 만나면 반가운 사이입니다.' },
      { min: 0, name: '평행 우주', desc: '서로 전혀 다른 법칙을 따르는 사이입니다.' },
    ];
    const tier = tiers.find((t) => score >= t.min);
    const A = a.exo, B = b.exo;
    const lines = [];
    let distance = null;
    if (A.name === B.name) lines.push('두 이름이 같은 행성을 가리킵니다.');
    else if (A.host === B.host) lines.push(`두 행성은 같은 별 ${josa(A.host, '을/를')} 도는 형제 행성입니다.`);
    else if (A.dist != null && B.dist != null) {
      const pa = xyz(A), pb = xyz(B);
      distance = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      lines.push(`두 행성은 서로 약 ${fmt(distance)}광년 떨어져 있습니다. 빛의 속도로도 ${fmt(distance)}년이 걸립니다.`);
    }
    if (A.per != null && B.per != null && A.name !== B.name) {
      const [fast, slow] = A.per <= B.per ? [A, B] : [B, A];
      const k = slow.per / fast.per;
      lines.push(k < 1.05
        ? '두 행성의 1년 길이가 거의 같습니다.'
        : `${slow.name}의 1년 동안 ${josa(fast.name, '은/는')} ${num(k)}번 공전합니다.`);
    }
    if (lines.length < 2) lines.push(`두 행성의 모항성은 각각 ${A.con}자리와 ${B.con}자리 방향에 있습니다.`);
    return { score, tier, lines: lines.slice(0, 2), distance };
  }

  NV.genesis = genesis;
  NV.birthdayPlanet = birthdayPlanet;
  NV.todayStr = todayStr;
  NV.harmony = harmony;
  NV.stormKm = stormKm;
  NV.josa = josa;
  NV.hsl = hsl;
  NV.toCss = toCss;
  NV.BIOMES = BIOMES;
})();
