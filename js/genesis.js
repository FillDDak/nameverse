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
        '섬들은 매년 조금씩 자리를 옮기는데, 사람들은 이를 ‘섬들의 산책’이라 부릅니다.',
        '파도는 언제나 같은 박자로 부서져서, 어느 해변에 서도 같은 노래가 들립니다.',
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
        '대륙 전체가 하나의 거대한 숲으로 이어져 있어서, 나무뿌리를 따라 소식이 대륙 반대편까지 하루 만에 전해집니다.',
        '봄이 되면 적도를 따라 꽃이 한꺼번에 피어나 우주에서도 초록 행성 위에 분홍 띠가 보입니다.',
        '이곳의 풀은 누군가 밟고 지나가면 잠시 은은하게 빛나며 발자국을 기억합니다.',
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
        '끝없는 붉은 모래 언덕 사이로 {lakes}개의 오아시스가 흩어져 있고, 여행자들은 그 위치를 노래로 외웁니다.',
        '바람이 모래 언덕을 넘을 때마다 낮은 첼로 같은 소리가 울려서, 사막 전체가 하나의 악기가 됩니다.',
        '한낮에는 모래가 유리처럼 반짝이고, 밤에는 기온이 뚝 떨어져 모래 위에 서리꽃이 핍니다.',
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
        '바다는 보랏빛 액체 수정으로 이루어져 있어서, 손을 담그면 잠시 자신의 기억이 물결 위에 비칩니다.',
        '청록빛 대지 위로 중력을 거스르는 바위들이 떠 있고, 그 사이로 거꾸로 자라는 나무들이 흔들립니다.',
        '이곳의 식물은 햇빛 대신 소리를 먹고 자라서, 조용한 곳일수록 황량합니다.',
      ],
      gen(r) {
        const h = r.range(280, 320);
        return {
          type: 0, deep: hsl(h, 0.6, 0.15), shallow: hsl(h + 18, 0.7, 0.4),
          land: hsl(r.range(160, 190), 0.5, 0.3), high: hsl(r.range(250, 280), 0.4, 0.42), peak: hsl(r.range(50, 70), 0.7, 0.75),
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
        '해안선 전체가 살아 있는 산호로 이루어져 있어서, 행성 지도를 매년 새로 그려야 합니다.',
        '황금빛 모래사장 위로 분홍 바다가 밀려오고, 저녁이면 바다 전체가 은은하게 빛납니다.',
        '하늘과 바다의 색이 너무 닮아서, 이곳의 새들은 가끔 물속을 날기도 합니다.',
      ],
      gen(r) {
        const h = r.range(335, 355);
        return {
          type: 0, deep: hsl(h, 0.55, 0.25), shallow: hsl(h + 12, 0.7, 0.55),
          land: hsl(r.range(38, 50), 0.6, 0.5), high: hsl(r.range(20, 30), 0.5, 0.4), peak: hsl(45, 0.3, 0.85),
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
        '구름 띠마다 바람의 방향이 반대라서, 띠의 경계에서는 번개가 쉬지 않고 춤을 춥니다.',
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
        '대기 깊은 곳에서는 엄청난 압력 때문에 다이아몬드 비가 내리고, 그 소리가 행성 전체에 은은하게 울립니다.',
        '청록색 대기는 메탄 구름으로 이루어져 있어서, 햇빛이 스치면 행성 전체가 보석처럼 빛납니다.',
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
        '지각의 갈라진 틈마다 용암이 흘러서, 밤이 되면 행성 전체에 붉은 거미줄 같은 빛의 지도가 드러납니다.',
        '용암 호수들은 {n}시간마다 한 번씩, 숨을 쉬듯 동시에 부풀어 오릅니다.',
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
        '빙하가 천천히 움직이며 내는 소리는 고래의 노래와 놀랍도록 닮았습니다.',
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

  /* ───────────── 텍스트 풀 ───────────── */
  const SYL_START = ['아', '에', '오', '이', '카', '케', '코', '루', '리', '노', '세', '소', '타', '테', '벨', '몬', '산', '엘', '바', '베', '제', '하', '펠', '미', '다', '시', '크', '프', '나', '라', '유', '레', '로', '티'];
  const SYL_MID = ['라', '리', '로', '노', '니', '베', '시', '타', '렌', '린', '딘', '몬', '미', '나', '도', '카', '엘', '온', '우', '디', '세', '르', '반', '살'];
  const SYL_END = ['스', '아', '온', '아나', '리스', '테라', '노스', '움', '엘', '아스', '린', '야', '토', '니아', '로스', '벨', '론', '시아'];
  const SUFFIX = [' 프라임', ' b', ' c', ' Ⅱ', ' Ⅲ', ' 7', ' 알파', ' 제로', ' 오메가'];

  const CONSTELLATIONS = ['오리온', '카시오페이아', '백조', '거문고', '페르세우스', '안드로메다', '용', '큰곰', '작은곰', '전갈', '사자', '쌍둥이', '물병', '궁수', '케페우스', '헤라클레스', '목동', '돌고래', '여우', '기린', '페가수스', '남쪽물고기', '고래', '외뿔소'];

  const DISCOVERY = [
    '{year}년 어느 맑은 밤, 누군가 ‘{owner}’{owner|이라고/라고} 조용히 불렀을 때 {const}자리 근처에서 한 번도 관측된 적 없는 빛이 깜빡였습니다. {dist}광년을 달려온 행성 {planet}의 신호였습니다.',
    '‘{owner}’{owner|이라는/라는} 이름의 글자들을 주파수로 바꾸자, {const}자리 방향에서 똑같은 파형을 가진 행성이 응답했습니다. 우리는 그 행성을 {planet|이라/라} 부르기로 했습니다.',
    '{planet}{planet|은/는} {dist}광년 떨어진 {const}자리 가장자리에서 발견되었습니다. 신기하게도 이 행성 자기장의 떨림은 ‘{owner}’{owner|이라는/라는} 이름을 발음할 때의 떨림과 정확히 같습니다.',
    '우주 전파 망원경이 {year}년에 수신한 수수께끼의 신호를 해독하자 단 한 단어가 나왔습니다. ‘{owner}’. 신호의 발신지는 {const}자리의 행성 {planet|이었습니다/였습니다}.',
  ];

  const INHABITANTS = {
    surface: ['빛을 먹고 사는 유리 사슴', '노래로 대화하는 이끼 부족', '꼬리가 두 개인 하늘고래', '기억을 모으는 작은 여우', '천 년을 사는 느림보 거인', '바람을 엮어 집을 짓는 새', '꿈을 교환하는 버섯 마을 주민', '별자리 무늬를 가진 수달', '하루에 한 번 색이 바뀌는 카멜레온 학자'],
    gas: ['대기 속을 떠다니는 해파리 비행선', '번개를 먹고 자라는 풍선 생물', '구름 사이를 헤엄치는 투명한 가오리', '수천 년째 같은 폭풍을 도는 떠돌이 고래'],
    fire: ['불꽃 속에서 태어나는 흑요석 도마뱀', '뜨거운 바위를 녹여 조각하는 용암 장인', '빛을 모아 노래하는 수정 정령', '열기로 대화하는 붉은 반딧불이'],
    cold: ['얼음 속에서 잠든 채 꿈을 꾸는 거대 생물', '눈송이 모양이 저마다 다른 서리 요정', '얼음 아래 바다를 비추는 등불 물고기', '빙하를 타고 여행하는 흰 펭귄 순례자'],
  };
  const HABITS = [
    '매일 해 질 녘 서로의 이름을 한 번씩 불러 줍니다',
    '슬픈 일이 생기면 작은 돌을 하나씩 쌓아 탑을 만듭니다',
    '태어난 날 밤의 별 배치를 평생 기억합니다',
    '거짓말을 하면 몸이 살짝 투명해집니다',
    '가장 소중한 기억을 선물로 주고받습니다',
    '일 년에 하루, 모두가 동시에 잠드는 날이 있습니다',
    '처음 만난 이에게 반드시 노래 한 소절을 들려줍니다',
    '‘{owner}’{owner|이라는/라는} 이름을 전설 속 창조자의 이름으로 기억합니다',
  ];
  const PHENOMENA = [
    { t: '{n}년에 한 번 모든 위성이 일렬로 서는 날이면, 하늘에서 은빛 비가 내립니다.', moons: 2 },
    { t: '두 달이 겹쳐지는 밤이면 바다가 잠시 숨을 멈춘 듯 잔잔해집니다.', moons: 2, cats: ['surface', 'cold'] },
    { t: '해마다 가장 긴 밤에는 유성우가 {n}시간 동안 쉬지 않고 쏟아집니다.' },
    { t: '자기장이 약해지는 계절이면 극지방의 오로라가 적도까지 내려옵니다.' },
    { t: '{n}일에 한 번, 행성 전체가 1분 동안 완벽하게 고요해집니다.' },
    { t: '해가 뜨기 직전 {n}초 동안 하늘이 초록빛으로 번쩍입니다.' },
    { t: '고리의 그림자가 적도를 지나는 계절에는 낮에도 별이 보입니다.', ring: true },
    { t: '고리 조각이 대기로 떨어지는 밤이면 하늘이 금가루처럼 반짝입니다.', ring: true },
  ];
  const PROVERBS = [
    '느린 별도 결국 궤도를 한 바퀴 돈다.', '빛은 늦게 도착해도 거짓말을 하지 않는다.', '가장 어두운 밤에 가장 먼 별이 보인다.',
    '바람의 이름을 알면 길을 잃지 않는다.', '중력은 보이지 않지만 모든 것을 붙잡는다.', '작은 달도 바다를 움직인다.',
    '오늘의 먼지가 내일의 행성이 된다.', '서두르는 혜성은 꼬리를 잃는다.', '이름을 불러 주는 이가 있는 한 별은 꺼지지 않는다.',
    '구름 위에는 언제나 해가 있다.', '얼음도 기억을 품는다.', '뜨거운 심장이 단단한 대지를 만든다.',
    '궤도가 다르다고 우주가 다른 것은 아니다.', '한 번 붙잡은 위성은 끝까지 곁에 둔다.',
  ];
  const TAGS = ['#조용한_카리스마', '#새벽형_행성', '#은근한_중력', '#감성_충만', '#예측불가', '#낭만주의', '#다정한_궤도', '#혼자서도_빛남', '#호기심_폭발', '#느긋한_자전', '#첫인상_반전', '#의리의_위성', '#밤하늘_주인공', '#비밀이_많음', '#따뜻한_핵', '#자유로운_혜성', '#완벽주의_자전축', '#웃음_많은_대기', '#단단한_지각', '#꿈꾸는_성운'];
  const ROLES = ['별빛 등대지기', '구름 우체부', '위성 정원사', '오로라 조율사', '유성 수집가', '은하 도서관 사서', '중력 제빵사', '행성 최초의 시인', '혜성 길잡이', '달빛 재단사', '폭풍 지휘자', '별자리 지도 제작자', '우주 고래 통역사', '시간 여행 안내원', '꿈 기상 캐스터'];
  const RARITY = [
    { max: 1, name: '신화', en: 'MYTHIC' },
    { max: 5, name: '전설', en: 'LEGENDARY' },
    { max: 20, name: '희귀', en: 'RARE' },
    { max: 50, name: '특별', en: 'UNCOMMON' },
    { max: 101, name: '평범', en: 'COMMON' },
  ];

  function planetName(r) {
    let n = r.pick(SYL_START) + r.pick(SYL_MID);
    if (r.chance(0.65)) n += r.pick(SYL_END);
    if (r.chance(0.28)) n += r.pick(SUFFIX);
    return n;
  }

  /* ───────────── 창조 ───────────── */
  function genesis(rawName) {
    const owner = NV.normalizeName(rawName) || '이름 없는 별';
    const key = NV.nameKey(owner) || owner;
    const root = NV.makeRng('nameverse/v1/' + key);
    const rv = root.fork('visual');
    const rl = root.fork('lore');
    const rs = root.fork('stats');

    // 희귀도 (상위 몇 %)
    const rr = root.fork('rarity');
    // 균등 분포라서 '상위 X%'가 문자 그대로 참이다
    const topPct = Math.max(0.1, Math.ceil(rr.next() * 1000) / 10);
    const rarity = Object.assign({ topPct }, RARITY.find((t) => topPct < t.max));

    const biome = rv.weighted(BIOMES);
    const v = biome.gen(rv);
    v.seedOff = [rv.range(-50, 50), rv.range(-50, 50), rv.range(-50, 50)];
    v.warp = rv.range(0.5, 1.15);
    v.scale = v.type === 1 ? 1 : rv.range(1.5, 2.5);
    v.spec = v.spec != null ? v.spec : 0;
    v.bands = v.bands || 0; v.turb = v.turb || 0; v.stormSize = v.stormSize || 0;
    const sy = rv.range(-0.55, 0.55), sa = rv.range(0, Math.PI * 2), sc = Math.sqrt(1 - sy * sy);
    v.storm = [Math.cos(sa) * sc, sy, Math.sin(sa) * sc];
    v.tilt = rv.range(-0.42, 0.42);
    v.spin = (v.type === 1 ? rv.range(0.14, 0.24) : rv.range(0.07, 0.15)) * (rv.chance(0.12) ? -1 : 1);
    v.cloudSpeed = rv.range(0.008, 0.02);

    // 고리
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

    // 위성
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

    // 이름과 목록 번호
    const planet = planetName(rl);
    const h = NV.hash(key);
    const catalog = 'NMV-' + (1000 + (h[0] % 9000)) + String.fromCharCode(97 + (h[1] % 26));
    const moonNames = v.moons.map(() => planetName(rl).replace(/ .*/, ''));
    const constellation = rl.pick(CONSTELLATIONS);
    const year = rl.int(1609, 2026);
    const dist = rl.int(4, 9800);

    // 수치
    const isGas = v.type === 1;
    const diameter = isGas ? rs.range(48000, 142000) : rs.range(3800, 19000);
    const gravity = isGas ? rs.range(0.9, 2.6) : rs.range(0.3, 1.9);
    const day = isGas ? rs.range(8, 17) : rs.range(6, 62);
    const yearDays = rs.range(40, 4200);
    const temp = rs.range(biome.temp[0], biome.temp[1]);
    const life = Math.round(rs.range(biome.life[0], biome.life[1]));
    const seaPct = Math.round(Math.min(97, Math.max(3, (v.sea - 0.3) * 330)));
    const ra = `${rs.int(0, 23)}h ${String(rs.int(0, 59)).padStart(2, '0')}m`;
    const dec = `${rs.chance(0.5) ? '+' : '−'}${rs.int(0, 89)}° ${String(rs.int(0, 59)).padStart(2, '0')}′`;

    const vars = {
      owner, planet, const: constellation, year, dist: fmt(dist), seaPct,
      lakes: rl.int(3, 99), n: rl.int(2, 12), stormN: rl.int(2, 9),
      storm: planetName(rl).replace(/ .*/, '') + '의 눈',
    };
    vars.stormJosa = hasBatchim(vars.storm) ? '은' : '는';

    const discovery = fill(rl.pick(DISCOVERY), vars);
    const landSentences = rl.sample(biome.land, 2).map((s) => fill(s, vars));
    let moonLine;
    if (moonCount === 0) moonLine = '밤하늘에는 달이 하나도 없어서 별빛이 유난히 선명합니다.';
    else if (moonCount === 1) moonLine = `${josa(moonNames[0], '이라는/라는')} 달 하나가 조용히 곁을 지킵니다.`;
    else moonLine = `${moonNames.join(', ')}. ${moonCount}개의 달이 번갈아 떠오릅니다.`;
    const sky = `이곳의 하늘은 ${rl.pick(biome.sky)}입니다. ${moonLine}`;
    const inh = rl.pick(INHABITANTS[biome.cat]);
    const habit = fill(rl.pick(HABITS), vars);
    const life1 = life >= 45
      ? `이곳에는 ${inh}들이 살고 있는데, 이들은 ${habit}.`
      : `아직 생명체는 확인되지 않았지만, 관측자들은 가끔 ${inh}의 흔적을 보았다고 말합니다.`;
    const phenPool = PHENOMENA.filter((p) => (!p.moons || moonCount >= p.moons) && (!p.ring || v.ring) && (!p.cats || p.cats.includes(biome.cat)));
    const phenomenon = fill(rl.pick(phenPool).t, vars);
    const proverb = rl.pick(PROVERBS);
    const tags = rl.sample(TAGS, 3);
    const role = rl.pick(ROLES);
    const weather = rl.pick(biome.weather);

    const lore = [
      { title: '발견', text: discovery },
      { title: '풍경', text: landSentences.join(' ') },
      { title: '하늘', text: sky },
      { title: '생명', text: life1 },
      { title: '현상', text: phenomenon },
    ];

    const stats = [
      { k: '지름', v: `${fmt(diameter)} km` },
      { k: '표면 중력', v: `${gravity.toFixed(2)} G` },
      { k: '하루', v: `${day.toFixed(1)} 시간` },
      { k: '1년', v: `${fmt(yearDays)} 일` },
      { k: '평균 기온', v: `${Math.round(temp)} °C` },
      { k: '생명 가능성', v: `${life}%` },
      { k: '위성', v: moonCount ? `${moonCount}개` : '없음' },
      { k: '고리', v: v.ring ? '있음' : '없음' },
      { k: '자전축 기울기', v: `${Math.abs(v.tilt * 57.3).toFixed(1)}°` },
      { k: '거리', v: `${fmt(dist)} 광년` },
      { k: '오늘의 날씨', v: weather },
    ];

    // 음악
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
      owner, key, planet, catalog, biome: { id: biome.id, name: biome.name, cat: biome.cat },
      rarity, visual: v, stats, lore, proverb, tags, role, constellation, coords: { ra, dec },
      moonNames, music, accent: toCss(v.atmo), accentRgb: v.atmo,
    };
  }

  /* ───────────── 궁합 ───────────── */
  function harmony(a, b) {
    const keys = [a.key, b.key].sort();
    const r = NV.makeRng('nameverse/duo/' + keys.join('♥'));
    let score = a.key === b.key ? 100 : Math.round(52 + 47 * Math.pow(r.next(), 0.65));
    const tiers = [
      { min: 100, name: '거울 쌍성', desc: '완전히 같은 궤도를 도는, 우주에 단 하나뿐인 거울 행성입니다.' },
      { min: 95, name: '운명의 쌍성계', desc: '서로의 중력이 완벽하게 맞물려 영원히 서로를 도는 쌍성입니다.' },
      { min: 85, name: '서로를 도는 연성', desc: '멀리 떨어져 있어도 같은 리듬으로 자전하는 특별한 사이입니다.' },
      { min: 70, name: '다정한 이웃 궤도', desc: '적당한 거리에서 서로의 밤하늘을 밝혀 주는 이웃입니다.' },
      { min: 55, name: '스쳐 가는 혜성', desc: '가끔 스칠 때마다 눈부신 꼬리를 남기는 사이입니다.' },
      { min: 0, name: '신비로운 평행 우주', desc: '서로 다른 법칙을 따르지만, 그래서 더 궁금한 사이입니다.' },
    ];
    const tier = tiers.find((t) => score >= t.min);
    const events = [
      `두 행성은 ${r.int(3, 400)}년마다 가장 가까워지고, 그날 밤에는 서로의 하늘에 상대 행성이 보름달보다 크게 떠오릅니다.`,
      `${a.planet}의 오로라와 ${b.planet}의 오로라는 같은 주파수로 떨립니다.`,
      `두 행성 사이에는 ${r.int(2, 40)}개의 떠돌이 소행성이 오가며 편지를 실어 나른다는 전설이 있습니다.`,
      `${a.planet}에서 보낸 빛은 ${r.int(1, 90)}년 뒤에 ${b.planet}의 바다에 닿아 하루 동안 반짝입니다.`,
      `두 행성의 자전 주기를 합치면 정확히 ${r.int(20, 48)}시간, 하나의 하루가 됩니다.`,
    ];
    return { score, tier, lines: r.sample(events, 2), distance: r.int(1, 99) / 10 };
  }

  NV.genesis = genesis;
  NV.harmony = harmony;
  NV.josa = josa;
  NV.hsl = hsl;
  NV.toCss = toCss;
  NV.BIOMES = BIOMES;
})();
