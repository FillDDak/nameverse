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
      id: 'ocean', name: '푸른 대양 행성', weight: 14, temp: [4, 28], life: [70, 99], mode: 'dorian', cat: 'surface',
      sky: ['맑은 날엔 옅은 청록빛, 해 질 녘엔 복숭앗빛으로 물드는 하늘', '구름 사이로 무지개가 하루에도 몇 번씩 걸리는 하늘'],
      weather: ['맑음 · 오후에 무지개', '잔잔한 해무', '따뜻한 소나기 후 쌍무지개'],
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
      id: 'garden', name: '에메랄드 정원 행성', weight: 12, temp: [12, 32], life: [88, 100], mode: 'lydian', cat: 'surface',
      sky: ['연둣빛 안개가 아침마다 낮게 깔리는 하늘', '꽃가루가 햇빛에 반짝이며 떠다니는 금빛 하늘'],
      weather: ['맑음 · 꽃가루 많음', '보슬비 · 숲 냄새 짙음', '따스한 바람 · 나비 떼 이동'],
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
      id: 'desert', name: '붉은 사막 행성', weight: 11, temp: [35, 90], life: [5, 40], mode: 'phrygian', cat: 'surface',
      sky: ['구릿빛 먼지가 떠도는 주황색 하늘', '해가 두 번 지는 것처럼 보이는 신기루의 하늘'],
      weather: ['모래 폭풍 후 쌍무지개', '작열하는 햇빛 · 신기루 주의', '맑음 · 밤에는 서리'],
      land: [
        '물은 모두 증발했고, 붉은 암석 평원과 모래 언덕이 끝없이 이어집니다.',
        '바람이 강한 계절에는 모래 폭풍이 대륙 하나를 통째로 덮습니다.',
        '오래전 바다였던 곳에 소금 평원이 하얗게 남아 있습니다.',
        '한낮의 바위는 손을 댈 수 없을 만큼 달궈져, 공기가 늘 아지랑이처럼 일렁입니다.',
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
      id: 'alien', name: '보랏빛 이계 행성', weight: 8, temp: [-20, 40], life: [50, 95], mode: 'lydian', cat: 'surface',
      sky: ['보랏빛 하늘에 초록 오로라가 낮에도 흐르는 하늘', '태양이 푸르게, 달이 붉게 보이는 뒤집힌 하늘'],
      weather: ['보랏빛 안개 · 중력 약간 불안정', '거꾸로 내리는 비', '오로라 폭풍 · 전파 두절'],
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
      id: 'coral', name: '산호빛 황혼 행성', weight: 7, temp: [18, 45], life: [60, 97], mode: 'mixolydian', cat: 'surface',
      sky: ['영원히 노을이 지는 분홍빛 하늘', '복숭아색 구름이 느리게 흘러가는 따뜻한 하늘'],
      weather: ['따뜻함 · 노을 지속', '분홍 안개 · 바다 발광', '맑음 · 산호 산란기'],
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
      id: 'gas', name: '줄무늬 가스 거인', weight: 12, temp: [-150, -80], life: [0, 12], mode: 'aeolian', cat: 'gas',
      sky: ['끝없이 소용돌이치는 호박색 구름층', '번개가 구름 띠 사이를 오가는 황금빛 대기'],
      weather: ['초속 400m 제트기류', '번개 폭풍 · 매우 흐림', '암모니아 눈'],
      land: [
        '단단한 땅이 없는 이 거대한 행성은 수천 킬로미터 두께의 구름층이 겹겹이 흐르는 하나의 바다입니다.',
        '거대한 폭풍 ‘{storm}’{stormJosa} 관측 이래 한 번도 멈춘 적이 없으며, 지구 {stormN}개가 들어갈 만큼 큽니다.',
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
      id: 'icegiant', name: '청록빛 얼음 거인', weight: 9, temp: [-220, -160], life: [0, 8], mode: 'dorian', cat: 'gas',
      sky: ['깊고 투명한 청록색 대기', '메탄 구름이 비단처럼 흐르는 푸른 대기'],
      weather: ['다이아몬드 비', '초음속 바람 · 매우 추움', '메탄 눈보라'],
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
      id: 'lava', name: '용암 대장간 행성', weight: 9, temp: [400, 1200], life: [0, 3], mode: 'phrygian', cat: 'fire',
      sky: ['화산재 때문에 늘 붉게 달아오른 하늘', '검은 연기 사이로 불티가 별처럼 떠다니는 하늘'],
      weather: ['용암 소나기', '화산재 · 가시거리 0', '뜨거움 · 매우 뜨거움'],
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
      id: 'crystal', name: '흑요석 수정 행성', weight: 6, temp: [-80, -10], life: [10, 45], mode: 'lydian', cat: 'fire',
      sky: ['별빛이 수정에 반사되어 낮에도 반짝이는 하늘', '빛의 기둥이 대지에서 하늘로 솟는 보랏빛 하늘'],
      weather: ['결정 폭풍 · 반짝임 주의', '고요함 · 수정 공명', '빛의 비'],
      land: [
        '대지 전체가 거대한 흑요석과 수정 결정으로 덮여 있고, 갈라진 틈 사이로 차가운 빛이 새어 나옵니다.',
        '수정 산맥에 별빛이 반사되면 이 행성의 밤은 낮보다 밝아집니다.',
        '결정은 아주 천천히 자라서, 가장 높은 수정탑은 {n}만 년 동안 자라 온 것으로 추정됩니다.',
      ],
      gen(r) {
        const eh = r.chance(0.5) ? r.range(170, 200) : r.range(280, 315);
        return {
          type: 2, deep: hsl(r.range(250, 270), 0.25, 0.07), shallow: hsl(r.range(240, 260), 0.3, 0.17),
          land: hsl(r.range(260, 280), 0.35, 0.32), high: [0, 0, 0], peak: [0, 0, 0],
          emit: hsl(eh, 1, 0.6), sea: r.range(0.34, 0.41), spec: 1,
          clouds: r.range(0, 0.15), ice: 0, city: 0, atmo: hsl(eh, 0.9, 0.66), atmoStr: r.range(1, 1.3),
          cloudCol: hsl(260, 0.3, 0.75),
        };
      },
    },
    {
      id: 'glacier', name: '고요한 빙하 행성', weight: 10, temp: [-90, -30], life: [5, 35], mode: 'aeolian', cat: 'cold',
      sky: ['오로라가 커튼처럼 드리운 하늘', '얼음 결정이 햇빛을 받아 무리해가 뜨는 하늘'],
      weather: ['은빛 눈', '오로라 주의보 · 매우 맑음', '고요함 · 바람 없음'],
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
  ];

  /* ───────────── 실제 외계행성 (NASA Exoplanet Archive) ───────────── */
  const EXO = NV.EXO;
  function exoPlanet(i) {
    const r = EXO.rows[i];
    const [method, methodKo] = EXO.methods[r[17]];
    return {
      name: r[0], host: r[1], dist: r[2], rade: r[3], masse: r[4], massEst: r[5], radEst: r[6],
      per: r[7], a: r[8], ecc: r[9], eqt: r[10], eqtEst: r[11], teff: r[12], srad: r[13], snum: r[14], pnum: r[15],
      year: r[16], method, methodKo, facility: EXO.facilities[r[18]], ra: r[19], dec: r[20],
      con: EXO.constellations[r[21]], top: r[22], reason: EXO.reasons[r[23]] || '', esi: r[24],
    };
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
  function starClass(t) {
    if (t == null) return null;
    if (t < 3900) return { cls: 'M', color: '붉은' };
    if (t < 5300) return { cls: 'K', color: '주황빛' };
    if (t < 6000) return { cls: 'G', color: '노란' };
    if (t < 7500) return { cls: 'F', color: '흰' };
    if (t < 10000) return { cls: 'A', color: '푸르스름한 흰' };
    return { cls: 'B', color: '푸른' };
  }

  /* 실제 크기와 온도로 생물군계를 고른다 */
  function pickBiome(p, r) {
    const T = p.eqt, R = p.rade;
    const by = (id) => BIOMES.find((b) => b.id === id);
    if (/Pulsar|Pulsation/.test(p.method)) return by('crystal');
    if (R >= 6 || p.masse >= 50) return by('gas');
    if (R >= 2.2) return T == null || T < 400 ? by('icegiant') : by('gas');
    if (T == null) return by(r.chance(0.5) ? 'glacier' : 'desert');
    if (T > 1000) return by('lava');
    if (T > 320) return by('desert');
    if (T >= 175) {
      if (R >= 1.8) return by('ocean');
      // 붉은 왜성 주위의 식물은 검붉거나 보랏빛일 수 있다는 가설
      if (p.teff != null && p.teff < 3900) return by(r.chance(0.6) ? 'alien' : 'coral');
      return by(r.pick(['ocean', 'garden', 'garden', 'coral']));
    }
    return by('glacier');
  }

  // 가스 행성의 색은 온도로 정한다
  function gasPalette(v, T, method, r) {
    if (T == null) T = method === 'Imaging' ? 1400 : 120;
    const set = (deep, shallow, land, high, peak, atmo) => Object.assign(v, { deep, shallow, land, high, peak, atmo });
    if (T < 150) {
      const h = r.range(38, 50);
      set(hsl(h, 0.35, 0.5), hsl(h + 6, 0.4, 0.78), hsl(h - 8, 0.3, 0.6), hsl(h + 8, 0.3, 0.9), hsl(h - 14, 0.4, 0.55), hsl(45, 0.5, 0.78));
    } else if (T < 900) {
      // 목성형: 기본 팔레트 유지
    } else if (T < 1800) {
      const h = r.range(8, 22);
      set(hsl(h, 0.45, 0.12), hsl(h + 10, 0.5, 0.3), hsl(h - 6, 0.55, 0.2), hsl(h + 18, 0.45, 0.42), hsl(h, 0.7, 0.35), hsl(15, 0.8, 0.55));
    } else {
      const h = r.range(18, 34);
      set(hsl(h - 10, 0.8, 0.28), hsl(h + 8, 0.95, 0.58), hsl(h, 0.9, 0.42), hsl(h + 20, 0.9, 0.72), hsl(h - 12, 0.95, 0.4), hsl(28, 1, 0.6));
    }
  }

  function tempC(k) { return Math.round(k - 273.15); }
  const num = (x, d = 1) => (x >= 100 ? fmt(x) : String(Number(x.toFixed(d))));
  function periodText(days) {
    if (days == null) return null;
    if (days < 1) return `${num(days * 24)}시간`;
    if (days > 730) return `${num(days / 365.25)}년`;
    return `${num(days)}일`;
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
    { t: '해마다 같은 시기에 유성우가 {n}시간 동안 쏟아집니다.' },
    { t: '별의 활동이 강해지는 시기에는 극지방의 오로라가 적도 가까이까지 내려옵니다.' },
    { t: '고리의 그림자가 적도를 지나는 계절에는 낮에도 하늘이 어둑합니다.', ring: true },
    { t: '고리 조각이 대기로 떨어지는 밤에는 유성이 평소보다 훨씬 많이 보입니다.', ring: true },
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
  function kindOf(p) {
    const R = p.rade, T = p.eqt;
    if (R >= 6 || p.masse >= 50) {
      if (T != null && T > 1000 && p.per != null && p.per < 10) return '별에 아주 가까이 붙어 도는 ‘뜨거운 목성’입니다. 단단한 표면이 없는 가스 행성입니다.';
      return R > 11.5 ? '목성보다도 큰 가스 행성입니다. 단단한 표면이 없습니다.' : '목성이나 토성처럼 단단한 표면이 없는 가스 행성입니다.';
    }
    if (R >= 2.2) return '지구보다 크고 해왕성보다 작은 행성입니다. 두꺼운 가스층에 싸여 있을 것으로 보이며, 태양계에는 이런 크기의 행성이 없습니다.';
    if (R >= 1.5) return '지구보다 큰 ‘슈퍼지구’입니다. 암석 행성인지, 물이나 가스층에 싸인 행성인지는 아직 확실하지 않습니다.';
    return R < 0.9 ? '지구보다 작은 암석 행성으로 보입니다.' : '지구와 비슷한 크기의 암석 행성으로 보입니다.';
  }
  function environment(p) {
    const out = [kindOf(p)];
    if (p.eqt != null) {
      const c = tempC(p.eqt);
      out.push(`평형 온도는 약 ${c}°C${p.eqtEst ? '로 추정됩니다' : '입니다'}. 대기의 온실 효과를 빼고 계산한 값이라, 실제 표면은 이보다 더 뜨거울 수 있습니다.`);
    }
    if (p.rade < 1.8 && p.eqt != null && p.eqt >= 175 && p.eqt <= 320) {
      out.push('크기와 받는 빛의 양이 지구와 비슷해서, 표면에 액체 상태의 물이 있을 수 있는 후보로 꼽힙니다.');
    }
    return out.join(' ');
  }
  function skyText(p) {
    const out = [];
    const sc = starClass(p.teff);
    if (sc && p.srad != null && p.a != null) {
      const k = (p.srad / p.a); // 지구에서 본 해 = 1
      const size = k >= 1.15 ? `지구에서 보는 해보다 ${num(k)}배 크게 보입니다`
        : k <= 0.87 ? `지구에서 보는 해의 ${num(k, 2)}배 크기로 작게 보입니다`
          : '지구에서 보는 해와 비슷한 크기로 보입니다';
      out.push(`이 행성의 하늘에서 모항성 ${josa(p.host, '은/는')} ${sc.color} ${sc.cls}형 별이며, ${size}.`);
    } else if (sc) {
      out.push(`모항성 ${josa(p.host, '은/는')} ${sc.color} ${sc.cls}형 별입니다.`);
    }
    if (/Pulsar/.test(p.method)) out.push('모항성은 초신성 폭발 뒤에 남은 펄서라서, 하늘에 보통의 해가 뜨지 않습니다.');
    const pt = periodText(p.per);
    if (pt) out.push(`이곳의 1년은 ${pt}입니다.`);
    if (p.a != null && p.a < 0.1 && p.rade < 6) out.push('별에 매우 가까워서 조석 고정되었을 가능성이 높습니다. 그렇다면 한쪽은 늘 낮, 반대쪽은 늘 밤입니다. 그림 속 행성도 자전하지 않고 늘 같은 면이 별을 향하도록 그렸습니다.');
    if (p.ecc != null && p.ecc > 0.4) out.push(`궤도가 많이 찌그러져 있어서(이심률 ${p.ecc}), 별에 가까워지는 계절과 멀어지는 계절의 차이가 큽니다.`);
    if (p.snum > 1) out.push(`이 항성계에는 별이 ${p.snum}개 있습니다.`);
    if (p.pnum > 1) out.push(`같은 항성계에서 행성이 ${p.pnum - 1}개 더 발견되었습니다.`);
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

    const biome = pickBiome(p, root.fork('biome'));
    const v = biome.gen(rv);
    if (biome.id === 'gas') gasPalette(v, p.eqt, p.method, root.fork('palette'));
    if (biome.id === 'desert') { v.sea = Math.min(v.sea, 0.12); v.city = 0; v.ice = 1.5; v.clouds = Math.min(v.clouds, 0.08); } // 뜨거운 행성: 바다·극관·도시 불빛 없음
    v.lightCol = starColor(p.teff).map((c) => 0.45 + 0.55 * c);
    // 행성에서 본 모항성의 실제 겉보기 반지름 (라디안, 태양 반지름 = 0.00465 AU)
    // 가까이 붙은 거대한 별도 '아주 멀리 있는 광원'으로 느껴지도록 큰 쪽은 눌러서 그린다 (태양 크기는 그대로)
    const realAng = /Pulsar/.test(p.method) ? 0.0025
      : p.srad != null && p.a != null ? 0.00465047 * p.srad / p.a : 0.0047;
    v.starAng = Math.max(0.0025, realAng <= 0.006 ? realAng : 0.006 + 0.003 * Math.log(1 + (realAng - 0.006) / 0.003));
    v.seedOff = [rv.range(-50, 50), rv.range(-50, 50), rv.range(-50, 50)];
    v.warp = rv.range(0.5, 1.15);
    v.scale = v.type === 1 ? 1 : rv.range(1.5, 2.5) * 0.62; // 작을수록 대륙이 크다
    v.spec = v.spec != null ? v.spec : 0;
    v.bands = v.bands || 0; v.turb = v.turb || 0; v.stormSize = v.stormSize || 0;
    const sy = rv.range(-0.55, 0.55), sa = rv.range(0, Math.PI * 2), sc = Math.sqrt(1 - sy * sy);
    v.storm = [Math.cos(sa) * sc, sy, Math.sin(sa) * sc];
    v.tilt = rv.range(-0.42, 0.42);
    v.spin = (v.type === 1 ? rv.range(0.14, 0.24) : rv.range(0.07, 0.15)) * (rv.chance(0.12) ? -1 : 1);
    // 조석 고정: 별에 매우 가까운(0.1 AU 미만) 작은 행성은 자전하지 않고 늘 같은 면이 별을 향한다(설명 문구와 같은 조건).
    // 열이 퍼지지 않는다고 보면 별을 마주한 곳은 평형 온도의 √2배, 거기서 θ만큼 떨어진 곳은 그 cos(θ)^¼배다.
    // 물이 어는 273K보다 차가운 곳은 얼음(눈알 행성), 마주한 곳이 900K를 넘으면 암석이 달아오른다
    v.locked = p.a != null && p.a < 0.1 && p.rade < 6;
    if (v.locked) {
      v.spin = 0; v.tilt *= 0.1; // 조석 고정된 행성은 자전축도 거의 기울지 않는다
      const Tsub = p.eqt != null ? p.eqt * Math.SQRT2 : null;
      const wet = (v.type === 0 || v.type === 3) && (p.eqt == null || p.eqt < 450); // 뜨거운 사막은 얼 물이 없다
      // 평형 온도에는 온실 효과가 빠져 있다: 지구 비율(실제 288K ÷ 평형 255K ≈ 1.13)을 곱해 '물이 있을 수 있는 행성' 분류와 맞춘다
      v.lockIce = wet ? (Tsub != null ? Math.min(1.5, Math.pow(273 / (Tsub * 1.13), 4)) : 0.5) : -2;
      v.lockGlow = v.type === 0 && Tsub != null ? Math.min(1, Math.max(0, (Tsub - 900) / 600)) : 0;
    }
    v.cloudSpeed = rv.range(0.008, 0.02);

    // 고리와 위성 (외계행성의 고리·위성은 아직 관측된 적이 없어서 상상으로 그린다)
    const ringChance = { gas: 0.75, icegiant: 0.6, crystal: 0.5 }[biome.id] || 0.22;
    const hasRing = rarity.topPct < 5 || rv.chance(ringChance);
    if (hasRing) {
      const inner = rv.range(1.35, 1.6);
      v.ring = {
        inner, outer: inner + rv.range(0.5, 1.05),
        color: v.type === 1 ? hsl(rv.range(25, 45), 0.35, 0.75) : hsl(rv.range(0, 360), rv.range(0.1, 0.35), rv.range(0.65, 0.8)),
        seed: rv.range(0, 100),
      };
    } else { rv.next(); v.ring = null; }

    const moonCount = rv.weighted([{ n: 0, weight: 28 }, { n: 1, weight: 35 }, { n: 2, weight: 23 }, { n: 3, weight: 14 }]).n;
    v.moons = [];
    const base = Math.max(v.ring ? v.ring.outer + 0.22 : 0, 1.6);
    for (let i = 0; i < moonCount; i++) {
      const dist = base + i * 0.34 + rv.range(0, 0.22);
      v.moons.push({
        r: rv.range(0.07, 0.15), dist,
        speed: (0.32 / Math.pow(dist, 1.5)) * rv.range(0.8, 1.2),
        phase: rv.range(0, Math.PI * 2), incl: rv.range(-0.28, 0.28),
        color: hsl(rv.range(0, 360), rv.range(0, 0.18), rv.range(0.55, 0.75)),
      });
    }
    const moonExt = v.moons.length ? v.moons[v.moons.length - 1].dist + 0.15 : 0;
    v.extent = Math.max(1.28, v.ring ? v.ring.outer * 1.03 : 0, Math.min(moonExt, 2.9));

    const planet = p.name;
    const moonNames = v.moons.map(() => moonName(rl));
    const vars = {
      owner, planet, seaPct: Math.round(Math.min(97, Math.max(3, (v.sea - 0.3) * 330))),
      lakes: rl.int(3, 99), n: rl.int(2, 12), stormN: rl.int(2, 9),
      storm: moonName(rl) + '의 눈',
    };
    vars.stormJosa = hasBatchim(vars.storm) ? '은' : '는';

    // 관측 기록 (실제 데이터)
    const distText = p.dist != null ? `지구에서 약 ${fmt(p.dist)}광년 떨어진 ${p.con}자리 방향에 있습니다.` : `${p.con}자리 방향에 있습니다. 정확한 거리는 아직 모릅니다.`;
    const discovery = `${p.year}년 ${p.methodKo} 방법으로 발견되었습니다(${p.facility}). ${METHOD_STORY[p.method] || ''} ${distText}`.replace(/\s+/g, ' ').trim();

    // 상상 기록
    const landSentences = rl.sample(biome.land, 2).map((s) => fill(s, vars));
    let moonLine;
    if (moonCount === 0) moonLine = '달은 없습니다.';
    else if (moonCount === 1) moonLine = `${josa(moonNames[0], '이라는/라는')} 달 하나가 곁을 돕니다.`;
    else moonLine = `달은 ${moonNames.join(', ')}, 모두 ${moonCount}개입니다.`;
    const habitable = p.rade < 1.8 && p.eqt != null && p.eqt >= 175 && p.eqt <= 320;
    const lifeCat = habitable || biome.cat === 'gas' ? biome.cat : p.eqt != null && p.eqt < 175 ? 'cold' : 'fire';
    const inh = rl.pick(INHABITANTS[lifeCat]);
    const habit = rl.pick(HABITS);
    const lifeText = habitable
      ? `생명이 있다면 ${josa(inh, '이/가')} 살고 있을지도 모릅니다. 이들은 ${habit}.`
      : `이 환경에서 생명체가 살기는 어렵습니다. 굳이 상상해 본다면 ${josa(inh, '이/가')} 버틸 수 있을 것 같습니다.`;
    const phenPool = PHENOMENA.filter((x) => (!x.moons || moonCount >= x.moons) && (!x.ring || v.ring) && (!x.cats || x.cats.includes(biome.cat)));
    const phenomenon = fill(rl.pick(phenPool).t, vars);
    const proverb = rl.pick(PROVERBS);
    const tags = rl.sample(TAGS, 3);
    const role = rl.pick(ROLES);

    const lore = [
      { title: '발견', text: discovery, real: true },
      { title: '환경', text: environment(p), real: true },
      { title: '하늘', text: skyText(p) || '모항성에 대한 자료가 아직 부족합니다.', real: true },
      { title: '풍경', text: `${landSentences.join(' ')} ${moonLine}` },
      { title: '생명', text: lifeText },
      { title: '현상', text: phenomenon },
    ];

    // 관측 데이터
    const est = (on) => (on ? ' (추정)' : '');
    const km = p.rade * 12742;
    const sc2 = starClass(p.teff);
    const massText = p.masse >= 100 ? `목성의 ${num(p.masse / 317.8, 2)}배` : `지구의 ${num(p.masse)}배`;
    const stats = [
      { k: '지름', v: `지구의 ${num(p.rade, 2)}배 · ${fmt(km)} km${est(p.radEst)}`, short: `${fmt(km)} km` },
      { k: '질량', v: `${p.massEst === 1 ? '최소 ' : ''}${massText}${est(p.massEst === 2)}` },
      { k: '공전 주기', v: periodText(p.per) || '미상' },
      { k: '궤도 반지름', v: p.a != null ? `${num(p.a, 3)} AU` : '미상' },
      { k: '평형 온도', v: p.eqt != null ? `${tempC(p.eqt)} °C${est(p.eqtEst)}` : '미상', short: p.eqt != null ? `${tempC(p.eqt)} °C` : '미상' },
      { k: '지구 유사도', v: p.esi != null ? p.esi.toFixed(2) : '미상' },
      { k: '모항성', v: [p.host, sc2 && `${sc2.cls}형`, p.teff != null && `${fmt(p.teff)} K`].filter(Boolean).join(' · ') },
      { k: '거리', v: p.dist != null ? `${fmt(p.dist)} 광년` : '미상' },
      { k: '발견', v: `${p.year}년 · ${p.methodKo} · ${p.facility}` },
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
      rarity, visual: v, stats, lore, proverb, tags, role, constellation: p.con, coords: { ra: raText(p.ra), dec: decText(p.dec) },
      moonNames, music, accent: toCss(v.atmo), accentRgb: v.atmo,
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
  NV.josa = josa;
  NV.hsl = hsl;
  NV.toCss = toCss;
  NV.BIOMES = BIOMES;
})();
