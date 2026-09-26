/* NAMEVERSE — 화면 흐름과 상호작용 */
(function () {
  'use strict';
  const NV = window.NV;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const EXAMPLES = ['세종대왕', '이순신', '고양이', '떡볶이', '사랑', 'Einstein', '우리 엄마', '월요일'];
  const DEFAULT_PREVIEW = 'NAMEVERSE';
  const ATLAS_KEY = 'nameverse.atlas.v1';
  const MODE_KO = { dorian: '도리안', lydian: '리디안', phrygian: '프리지안', mixolydian: '믹솔리디안', aeolian: '에올리안', ionian: '이오니안' };

  const el = {
    body: document.body, intro: $('#intro'), form: $('#form'), name: $('#name'), bday: $('#bday'), bdayBox: $('.bday'),
    hint: $('#live-hint'), examples: $('#examples'),
    scan: $('#scan'), scanName: $('#scan-name'), scanLine: $('#scan-line'), scanCoord: $('#scan-coord'),
    panel: $('#panel'), duoPanel: $('#duo-panel'), duoLabels: $('#duo-labels'),
    probe: $('#probe'), marker: $('#probe-marker'), atlas: $('#atlas'), atlasList: $('#atlas-list'), atlasCount: $('#atlas-count'),
    modalDuo: $('#modal-duo'), duoForm: $('#duo-form'), duoName: $('#duo-name'),
    toast: $('#toast'), hintDrag: $('#hint-drag'), sound: $('#btn-sound'), canvas: $('#planet'),
  };

  const S = {
    mode: 'intro', world: null, partner: null, harmony: null, preview: null,
    scanToken: 0, scale: Math.min(devicePixelRatio || 1, coarse ? 1 : 1.5), maxScale: Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.75),
  };

  /* ───────────── 엔진 ───────────── */
  const stars = new NV.Starfield($('#stars'));
  const music = new NV.Music();
  let renderer = null;
  try {
    renderer = new NV.PlanetRenderer(el.canvas);
    renderer.layout = layout;
  } catch (e) {
    console.error(e);
    setTimeout(() => toast('이 브라우저는 WebGL을 지원하지 않아 행성을 그릴 수 없어요. 기록은 계속 볼 수 있습니다.', 6000), 400);
  }

  function layout(W, H) {
    const cw = innerWidth, ch = innerHeight, mobile = cw <= 760;
    if (S.mode === 'intro') {
      const ext = S.preview ? S.preview.visual.extent : 1.3;
      const R = mobile ? 0.62 : 0.92;           // 지평선 행성의 반지름 (화면 높이 단위)
      const top = mobile ? -0.2 : -0.24;        // 행성 윗부분이 걸리는 높이
      return [{ x: 0, y: 0, w: W, h: H, shift: [0, top - R], fit: (R * ext) / 1.01 }];
    }
    if (S.mode === 'duo') {
      const half = Math.floor(W / 2);
      let cy, fit;
      if (mobile) {
        const area = ch * 0.5 - 60;
        cy = 60 + area / 2 + 20;
        fit = Math.min((0.8 * area) / 2 / ch, (0.42 * cw) / 2 / ch);
      } else {
        const panelH = el.duoPanel.offsetHeight || 320;
        const area = ch - panelH - 130;
        cy = 120 + area / 2;
        fit = Math.min(0.34, (0.98 * area) / 2 / ch, (0.44 * cw) / 2 / ch);
      }
      const shift = [0, 0.5 - cy / ch];
      return [
        { x: 0, y: 0, w: half, h: H, shift, fit },
        { x: half, y: 0, w: W - half, h: H, shift, fit },
      ];
    }
    // 단일 행성
    if (mobile) {
      const area = ch * 0.5 - 56;
      const cy = 56 + area / 2;
      return [{ x: 0, y: 0, w: W, h: H, shift: [0, 0.5 - cy / ch], fit: Math.min((0.92 * area) / 2 / ch, (0.46 * cw) / ch), sky: true }];
    }
    const panelW = Math.min(440, cw * 0.4) + 22;
    const avail = cw - panelW;
    return [{ x: 0, y: 0, w: W, h: H, shift: [-panelW / 2 / ch, -0.01], fit: Math.min(0.4, (0.44 * avail) / ch), sky: true }];
  }

  function resize() {
    stars.resize();
    if (renderer) renderer.resize(Math.round(innerWidth * S.scale), Math.round(innerHeight * S.scale));
  }
  addEventListener('resize', resize);

  /* ───────────── 렌더 루프 (적응형 해상도) ───────────── */
  const perf = { acc: 0, n: 0, cool: 0 };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    // 행성 화면에서는 별들을 행성과 같은 카메라로 하늘에 고정해 그린다
    stars.view = renderer && S.mode === 'world' ? renderer.skyView(now / 1000) : null;
    stars.frame(Math.min(0.3, (now - last) / 1000), now / 1000);
    last = now;
    if (renderer) {
      const d = renderer.drag;
      const c = renderer.cam;
      if (S.viewReset) {
        const k = Math.min(1, dt * 5);
        c.yaw += (0 - c.yaw) * k; c.pitch += (0 - c.pitch) * k; renderer.zoom += (1 - renderer.zoom) * k;
        c.vyaw = c.vpitch = 0;
        if (Math.abs(c.yaw) + Math.abs(c.pitch) + Math.abs(renderer.zoom - 1) < 0.002) { c.yaw = c.pitch = 0; renderer.zoom = 1; S.viewReset = false; }
      }
      if (!pointer.down) {
        c.yaw += c.vyaw * dt; c.pitch = Math.max(-1.35, Math.min(1.35, c.pitch + c.vpitch * dt));
        const cd = Math.pow(0.04, dt);
        c.vyaw *= cd; c.vpitch *= cd;
        d.x += d.vx * dt; d.y += d.vy * dt;
        const damp = Math.pow(0.04, dt);
        d.vx *= damp; d.vy *= damp;
        d.y += (0 - d.y) * Math.min(1, dt * 0.35);
        d.y = Math.max(-1.1, Math.min(1.1, d.y));
      }
      // 한동안 돌리지 않으면 시점이 천천히 행성 주위를 돈다(몇 초에 걸쳐 부드럽게 빨라짐).
      // 너무 높거나 낮은 시점은 알맞은 높이로 천천히 돌아온다. 확대·축소(휠, 핀치)는 회전을 끊지 않는다
      let auto = null;
      if (!S.viewReset && viewing() && !reducedMotion && !(pointer.down && pointers.size < 2)) {
        const x = Math.min(1, Math.max(0, ((now - S.idleAt) / 1000 - AUTO_DELAY) / AUTO_RAMP));
        const k = x * x * (3 - 2 * x);
        if (k > 0) {
          c.yaw += AUTO_YAW * S.autoDir * k * dt;
          // 높이가 범위를 벗어났으면 일정한 속도(PITCH_SPEED)로 돌아온다. 처음과 끝 PITCH_RAMP초만 부드럽게 가감속한다
          if (!S.pitchRet && Math.abs(c.pitch) > PITCH_BAND + 1e-3) {
            const to = Math.sign(c.pitch) * PITCH_BAND, dist = Math.abs(to - c.pitch);
            // 거리가 짧아 최고 속도에 못 미치면 가속하다 바로 감속한다
            const T = dist >= PITCH_SPEED * PITCH_RAMP ? PITCH_RAMP + dist / PITCH_SPEED : 2 * PITCH_RAMP;
            S.pitchRet = { from: c.pitch, to, t0: now, T, edge: PITCH_RAMP / T };
          }
          const R = S.pitchRet;
          if (R) {
            const u = (now - R.t0) / 1000 / R.T;
            c.pitch = R.from + (R.to - R.from) * pitchEase(u, R.edge);
            if (u >= 1) S.pitchRet = null;
          }
          // 거의 다 빨라졌으면 앞으로의 시점을 예측할 수 있다: 혜성이 이 회전을 따라 화면에 들어오게 한다
          if (k > 0.75) auto = { spin: AUTO_YAW * S.autoDir, pitch: R ? R.to : c.pitch };
        } else S.pitchRet = null;
      } else S.pitchRet = null; // 사용자가 조작하면 돌아오던 것을 멈춘다
      stars.auto = auto;
      renderer.pulse = music.getLevel();
      renderer.comet = stars.cometU;
      renderer.render(now / 1000);
      // 프레임이 느리면 해상도를 낮추고, 여유가 있으면 다시 높인다
      perf.acc += dt; perf.n++; perf.cool -= dt;
      if (perf.n >= 40) {
        const avg = perf.acc / perf.n;
        perf.acc = 0; perf.n = 0;
        if (perf.cool <= 0) {
          if (avg > 1 / 40 && S.scale > 0.5) { S.scale = Math.max(0.5, S.scale * 0.8); resize(); perf.cool = 1.5; }
          else if (avg < 1 / 57 && S.scale < S.maxScale) { S.scale = Math.min(S.maxScale, S.scale * 1.1); resize(); perf.cool = 4; }
        }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ───────────── 공통 UI ───────────── */
  let toastTimer;
  function toast(msg, ms = 2600) {
    el.toast.textContent = msg;
    el.toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('on'), ms);
  }

  function setAccent(w) {
    const root = document.documentElement.style;
    // 너무 어두운 대기색은 글자 강조색으로 쓰기 어려우니 밝게 끌어올린다
    const c = w.visual.atmo.map((x) => Math.min(1, x * 0.75 + 0.25));
    root.setProperty('--accent', NV.toCss(c));
    root.setProperty('--accent-rgb', c.map((x) => Math.round(x * 255)).join(','));
    stars.setTint(w.visual.atmo);
  }

  function setMode(m) {
    S.mode = m;
    el.body.className = 'mode-' + m;
  }

  /* ───────────── 라우팅: #n=이름&m=상대, 생일 행성은 #n=이름&p=행성 번호&k=몇 번째 생일&d=기준 날짜 ─────────────
   * 생일 자체는 주소에 담지 않는다. 이 세 값만으로 같은 행성과 설명이 그대로 재현된다 */
  function go(n, m, bd) {
    const p = new URLSearchParams();
    p.set('n', n);
    if (m) p.set('m', m);
    if (bd) { p.set('p', bd.p); p.set('k', bd.k); p.set('d', bd.d); }
    const h = '#' + p.toString();
    if (location.hash === h) route(); else location.hash = h;
  }
  function route() {
    const p = new URLSearchParams(location.hash.slice(1));
    const n = NV.normalizeName(p.get('n') || '');
    const m = NV.normalizeName(p.get('m') || '');
    closeOverlays();
    const bp = +p.get('p'), bk = +p.get('k'), bd = p.get('d');
    const bday = Number.isInteger(bp) && bp >= 0 && bp < NV.EXO.rows.length && bk >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(bd || '') ? { p: bp, k: bk, d: bd } : null;
    if (n && m) enterDuo(n, m);
    else if (n) enterWorld(n, bday);
    else showIntro();
  }
  addEventListener('hashchange', route);

  /* ───────────── 1. 입장 ───────────── */
  function showIntro() {
    S.scanToken++;
    setMode('intro');
    S.world = S.partner = null;
    el.intro.hidden = false;
    requestAnimationFrame(() => el.intro.classList.remove('leaving'));
    el.panel.hidden = el.duoPanel.hidden = el.duoLabels.hidden = el.scan.hidden = true;
    stars.warpTarget = 0;
    document.title = 'NAMEVERSE — 당신의 이름은 이미 하나의 행성입니다';
    updatePreview(true);
  }

  // 입력한 생일로 오늘 생일인 행성 → {p, k, d}. 비었거나 올바르지 않으면 null
  function bdayPick() {
    const r = el.bday.value ? NV.birthdayPlanet(el.bday.value) : null;
    return r && { p: r.index, k: r.n, d: r.date };
  }
  function makeWorld(n, bd) {
    const w = bd ? NV.genesis(n, bd.p, { n: bd.k, date: bd.d }) : null;
    return w && w.bday ? w : NV.genesis(n);
  }

  let previewTimer;
  function updatePreview(force) {
    const n = NV.normalizeName(el.name.value);
    const bd = bdayPick();
    const w = makeWorld(n || DEFAULT_PREVIEW, bd);
    if (!force && S.preview && S.preview.key === w.key) return;
    S.preview = w;
    if (renderer) {
      renderer.zoom = 1;
      Object.assign(renderer.cam, { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 });
      renderer.setWorlds([w], { grow: false });
    }
    setAccent(w);
    el.hint.innerHTML = w.bday
      ? `오늘은 <b>${esc(w.planet)}</b>에서 ${w.bday.n.toLocaleString('ko-KR')}번째 생일이에요`
      : n
        ? `지평선 너머에 <b>${esc(w.planet)}</b> 행성이 떠오르고 있어요 · ${esc(w.biome.name)}`
        : '이름과 생일을 넣으면 지평선 너머의 행성이 바뀝니다';
    // 입력 중에는 곡을 매번 새로 작곡하지 않도록 잠시 멈췄을 때만 바꾼다
    if (music.playing) { clearTimeout(musicTimer); musicTimer = setTimeout(() => playMusic(w).catch(() => {}), 800); }
  }
  let musicTimer;
  el.name.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => updatePreview(false), 90);
  });
  el.bday.max = NV.todayStr();
  el.bday.addEventListener('change', () => updatePreview(false));

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = NV.normalizeName(el.name.value);
    if (!n) {
      el.form.classList.remove('shake'); void el.form.offsetWidth; el.form.classList.add('shake');
      el.name.focus();
      return;
    }
    const bd = bdayPick();
    if (el.bday.value && !bd) {
      // 오늘이나 미래 날짜처럼 계산할 수 없는 생일
      el.bdayBox.classList.remove('shake'); void el.bdayBox.offsetWidth; el.bdayBox.classList.add('shake');
      toast('오늘 이전의 생일을 입력해 주세요');
      return;
    }
    el.name.blur(); el.bday.blur();
    go(n, null, bd);
  });

  el.examples.innerHTML = '<span class="lbl">이런 이름은 어때요?</span>' +
    EXAMPLES.map((n) => `<button type="button" data-name="${esc(n)}">${esc(n)}</button>`).join('');
  el.examples.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-name]');
    if (!b) return;
    el.name.value = b.dataset.name;
    updatePreview(false);
    setTimeout(() => go(b.dataset.name), 260);
  });

  /* ───────────── 2. 관측 연출 ───────────── */
  function scramble(node, finalText, ms) {
    const glyphs = '0123456789ABCDEF+−°′hm';
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      const fixed = Math.floor(finalText.length * k);
      node.textContent = finalText.slice(0, fixed) + [...finalText.slice(fixed)].map((ch) => (ch === ' ' || ch === '·' ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join('');
      if (k < 1 && !el.scan.hidden) requestAnimationFrame(tick);
    };
    tick();
  }

  async function scan(worlds) {
    const token = ++S.scanToken;
    setMode('scan');
    hideProbe();
    el.intro.classList.add('leaving');
    el.panel.hidden = el.duoPanel.hidden = el.duoLabels.hidden = true;
    if (renderer) renderer.setWorlds([]);
    setAccent(worlds[0]);
    stars.warpTarget = reducedMotion ? 0.15 : 1;
    el.scan.hidden = false;

    const title = worlds.map((w) => w.owner).join(' × ');
    el.scanName.innerHTML = [...title].map((ch, i) => `<span style="animation-delay:${i * 45}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    const w = worlds[0];
    scramble(el.scanCoord, `RA ${w.coords.ra} · DEC ${w.coords.dec} · ${w.catalog}`, 2000);
    const b = w.bday, num = (x) => x.toLocaleString('ko-KR');
    const lines = worlds.length > 1
      ? ['두 이름의 파동을 겹쳐 보는 중…', '두 행성의 궤도를 계산하는 중…', '중력의 공명을 측정하는 중…', '쌍성계 포착!']
      : b
        ? [`태어난 지 ${num(b.days)}일째`, `외계행성 ${num(NV.EXO.rows.length)}개의 1년 길이와 맞춰 보는 중…`,
          `오늘 생일인 행성 ${num(b.count)}개 발견`, '그중 1년이 가장 긴 행성 확인!']
        : ['이름을 우주 좌표로 바꾸는 중…', `${w.constellation}자리 방향을 관측하는 중…`, `${w.catalog} 주변을 살피는 중…`, '행성 확인!'];
    for (const line of lines) {
      if (token !== S.scanToken) return false;
      el.scanLine.textContent = line;
      await sleep(620);
    }
    if (token !== S.scanToken) return false;
    stars.warpTarget = 0;
    el.scan.hidden = true;
    el.intro.hidden = true;
    return true;
  }

  /* ───────────── 3. 행성 ───────────── */
  async function enterWorld(n, bd) {
    const w = makeWorld(n, bd);
    const same = S.world && S.world.key === w.key && (S.mode === 'world' || S.mode === 'duo');
    if (!same && !(await scan([w]))) return;
    S.world = w; S.partner = null;
    setMode('world');
    el.intro.hidden = true;
    el.duoPanel.hidden = el.duoLabels.hidden = true;
    setAccent(w);
    if (renderer) {
      renderer.zoom = 1;
      if (!same) Object.assign(renderer.cam, { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 });
      S.idleAt = performance.now(); // 도착하고 잠시 뒤부터 자동 회전
      renderer.setWorlds([w], { grow: !same });
    }
    renderPanel(w);
    saveAtlas(w);
    document.title = `${w.planet} — ${w.owner}의 행성 · NAMEVERSE`;
    if (music.playing) playMusic(w).catch(console.error);
    showDragHint();
  }

  const ICON = {
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    duo: '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4"/><circle cx="17" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10.5" ry="4" transform="rotate(-15 12 12)"/></svg>',
  };

  function rarityBadge(r) {
    const cls = { '신화': 'r-mythic', '전설': 'r-legendary', '희귀': 'r-rare' }[r.name] || '';
    return `<span class="rarity ${cls}">★ ${r.name} 등급 <small>· 상위 ${r.topPct}% · ${r.en}</small></span>`
      + (r.reason ? `<p class="rarity-why">${esc(r.reason)}</p>` : '');
  }

  // 오늘 생일 카드: 모든 숫자는 실제 공전 주기로 계산한 값이다
  function bdayCard(w) {
    const b = w.bday, num = (x) => x.toLocaleString('ko-KR');
    const P = b.period >= 1000 ? num(Math.round(b.period)) : b.period.toFixed(b.period >= 10 ? 1 : 2);
    const dt = (s) => { const [y, m, d] = s.split('-'); return `${y}년 ${+m}월 ${+d}일`; };
    return `<div class="p-bday reveal" style="animation-delay:.3s">
      <div class="k">오늘은 이 행성에서</div>
      <div class="n">${num(b.n)}번째 생일</div>
      <p>${esc(w.planet)}${NV.josa(w.planet, '은/는').slice(w.planet.length)} <b>${P}일</b>마다 별을 한 바퀴 돕니다.
        태어난 지 <b>${num(b.days)}일</b>째인 오늘, 이 행성의 달력으로 <b>${num(b.n)}번째 해</b>가 끝납니다.
        오늘 생일을 맞는 실제 외계행성 ${num(b.count)}개 중 1년이 가장 긴 행성이에요.<br>
        이 행성에서의 다음 생일은 <b>${dt(b.next)}</b>입니다.</p>
      <small>${dt(b.date)} 기준 · 태어난 시각은 모르므로 하루 단위로 계산했어요</small>
    </div>`;
  }

  function renderPanel(w) {
    let i = 0;
    const d = () => `style="animation-delay:${(i++ * 0.07 + 0.15).toFixed(2)}s"`;
    el.panel.innerHTML = `
      <div class="panel-inner">
        <div class="reveal" ${d()}>${rarityBadge(w.rarity)}</div>
        <h2 class="p-name reveal" ${d()}>${esc(w.planet)}</h2>
        <p class="p-sub reveal" ${d()}><b>${esc(w.owner)}</b>의 행성 · ${esc(w.biome.name)}</p>
        <p class="p-cat reveal" ${d()}>${esc(w.catalog)} · ${esc(w.constellation)}자리 · RA ${esc(w.coords.ra)} · DEC ${esc(w.coords.dec)}</p>
        ${w.bday ? bdayCard(w) : ''}
        <div class="p-actions reveal" ${d()}>
          <button class="act" data-act="music" aria-pressed="${music.playing}">${ICON.music}<span>${music.playing ? '노래 멈춤' : '행성의 노래'}</span></button>
          <button class="act" data-act="card">${ICON.card}<span>엽서 저장</span></button>
          <button class="act" data-act="share">${ICON.share}<span>공유하기</span></button>
          <button class="act" data-act="duo">${ICON.duo}<span>궁합 보기</span></button>
        </div>
        <h3 class="p-h reveal" ${d()}>관측 데이터 <small>NASA Exoplanet Archive</small></h3>
        <dl class="p-stats reveal" ${d()}>
          ${w.stats.map((s, k) => `<div class="${k === w.stats.length - 1 ? 'wide' : ''}"><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`).join('')}
        </dl>
        <div class="p-lore">
          ${w.lore.filter((s) => s.real).map((s) => `<section class="reveal" ${d()}><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></section>`).join('')}
        </div>
        <h3 class="p-h reveal" ${d()}>상상 기록 <small>실제 데이터에 상상을 더한 이야기</small></h3>
        <div class="p-tags reveal" ${d()}>${w.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <div class="p-role reveal" ${d()}>이 행성에서 당신의 직업은<br><b>${esc(w.role)}</b>입니다.</div>
        <div class="p-lore">
          ${w.lore.filter((s) => !s.real).map((s) => `<section class="reveal" ${d()}><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></section>`).join('')}
        </div>
        <blockquote class="p-proverb reveal" ${d()}><p>“${esc(w.proverb)}”</p><cite>— ${esc(w.planet)}에 전해지는 오래된 속담</cite></blockquote>
        <button class="ghost wide reveal" data-act="new" ${d()}>↺ 다른 이름의 행성 찾기</button>
        <p class="p-foot">${w.bday ? '같은 날 태어난 사람은 오늘 모두 이 행성에서 생일을 맞습니다.' : '같은 이름을 입력하는 사람은 누구나 이 행성을 발견합니다.'}<br>행성의 모습과 고리, 위성은 실제 수치를 바탕으로 그린 상상도입니다.<br>데이터: ${esc(NV.EXO.source)} · ${esc(NV.EXO.version)} 기준 ${NV.EXO.rows.length.toLocaleString('ko-KR')}개</p>
      </div>`;
    el.panel.hidden = false;
    el.panel.scrollTop = 0;
    // 애니메이션 재시작
    el.panel.style.animation = 'none'; void el.panel.offsetWidth; el.panel.style.animation = '';
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'music') toggleMusic();
    else if (act === 'card') savePostcard(b);
    else if (act === 'share') shareLink();
    else if (act === 'duo') openDuoModal();
    else if (act === 'new') { location.hash = ''; setTimeout(() => { el.name.value = ''; updatePreview(true); el.name.focus(); }, 50); }
    else if (act === 'back') go(S.world.owner);
    else if (act === 'other') go(S.partner.owner);
  });

  /* ───────────── 4. 궁합 ───────────── */
  function openDuoModal() {
    el.modalDuo.hidden = false;
    el.duoName.value = '';
    setTimeout(() => el.duoName.focus(), 50);
  }
  el.duoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = NV.normalizeName(el.duoName.value);
    if (!m) { el.duoName.focus(); return; }
    el.modalDuo.hidden = true;
    go(S.world ? S.world.owner : m, S.world ? m : '');
  });

  async function enterDuo(a, b) {
    const A = NV.genesis(a), B = NV.genesis(b);
    if (!(await scan([A, B]))) return;
    S.world = A; S.partner = B;
    S.harmony = NV.harmony(A, B);
    setMode('duo');
    el.panel.hidden = true;
    setAccent(A);
    renderDuo(A, B, S.harmony);
    if (renderer) { renderer.zoom = 1; Object.assign(renderer.cam, { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0 }); renderer.setWorlds([A, B]); }
    saveAtlas(B); saveAtlas(A);
    document.title = `${A.owner} × ${B.owner} 행성 궁합 ${S.harmony.score}% · NAMEVERSE`;
    if (music.playing) playMusic(A).catch(console.error);
  }

  function renderDuo(A, B, hm) {
    const link = (w) => `#${new URLSearchParams({ n: w.owner })}`;
    el.duoLabels.innerHTML = [A, B].map((w) => `<div><a href="${link(w)}"><b>${esc(w.planet)}</b><span>${esc(w.owner)}의 행성 · ${esc(w.biome.name)}</span></a></div>`).join('');
    el.duoLabels.hidden = false;
    el.duoPanel.innerHTML = `
      <p class="duo-score"><b id="score-num">0</b><small>%</small></p>
      <p class="duo-tier">${esc(hm.tier.name)}</p>
      <p class="duo-desc">${esc(hm.tier.desc)}</p>
      <ul class="duo-lines">${hm.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="duo-actions">
        <button class="ghost small" data-act="back">← ${esc(A.planet)}</button>
        <button class="ghost small" data-act="card">엽서 저장</button>
        <button class="ghost small" data-act="share">공유하기</button>
        <button class="ghost small" data-act="other">${esc(B.planet)} →</button>
      </div>`;
    el.duoPanel.hidden = false;
    const num = $('#score-num'), start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / 1800);
      num.textContent = Math.round(hm.score * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    setTimeout(tick, 500);
  }

  /* ───────────── 소리 ───────────── */
  // 아이폰 제어센터·잠금 화면의 '지금 재생 중': 제목, 부제, 앨범 아트
  const artCache = new Map();
  function nowPlaying(w) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    let art = artCache.get(w.key);
    if (!art && renderer) {
      try {
        art = NV.postcard.artwork(w, 12).toDataURL('image/jpeg', 0.9);
        artCache.set(w.key, art);
      } catch (e) { console.error(e); }
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: w.planet,
      artist: `${w.owner}의 행성 · ${w.biome.name}`,
      album: 'NAMEVERSE · 행성의 노래',
      artwork: [
        ...(art ? [{ src: art, sizes: '512x512', type: 'image/jpeg' }] : []),
        { src: new URL('apple-touch-icon.png', location.href).href, sizes: '180x180', type: 'image/png' },
      ],
    });
  }
  function playMusic(w) {
    nowPlaying(w);
    const p = music.play(w);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    return p;
  }
  music.onBusy = (on) => { if (on) toast('행성의 노래를 작곡하는 중…', 8000); else el.toast.classList.remove('on'); };
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => { if (!music.playing) toggleMusic(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (music.playing) toggleMusic(); });
    } catch (e) { /* 미지원 동작 */ }
  }

  async function toggleMusic() {
    if (music.playing) {
      music.stop();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    } else {
      const w = S.world || S.preview;
      const pr = playMusic(w); // 제스처 안에서 곧바로 재생을 시작해야 한다
      syncMusicUI();
      try {
        await pr;
        if (music.playing) toast(`♪ ${w.planet}의 노래 · ${MODE_KO[w.music.mode] || ''} 선법 · ${w.music.bpm} BPM`);
      } catch (e) {
        console.error(e);
        music.stop();
        toast('이 브라우저에서는 소리를 재생할 수 없어요');
      }
    }
    syncMusicUI();
  }
  function syncMusicUI() {
    const on = music.playing;
    el.sound.setAttribute('aria-pressed', on);
    el.sound.querySelector('.lbl').textContent = on ? '소리 켬' : '소리 끔';
    document.querySelectorAll('[data-act="music"]').forEach((b) => {
      b.setAttribute('aria-pressed', on);
      const s = b.querySelector('span'); if (s) s.textContent = on ? '노래 멈춤' : '행성의 노래';
    });
  }
  el.sound.addEventListener('click', toggleMusic);

  /* ───────────── 엽서 · 공유 ───────────── */
  async function savePostcard(btn) {
    if (!S.world) return;
    if (!renderer) { toast('WebGL이 없어 엽서를 만들 수 없어요'); return; }
    if (btn) btn.disabled = true;
    toast('엽서를 인화하는 중…');
    try {
      const t = performance.now() / 1000;
      const c = S.mode === 'duo' ? await NV.postcard.duo(S.world, S.partner, S.harmony, t) : await NV.postcard.single(S.world, t);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const fname = S.mode === 'duo' ? `NAMEVERSE_${S.world.owner}x${S.partner.owner}.png` : `NAMEVERSE_${S.world.owner}_${S.world.planet}.png`;
      const file = new File([blob], fname.replace(/\s+/g, '_'), { type: 'image/png' });
      if (coarse && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'NAMEVERSE' }); toast('엽서를 공유했어요'); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('엽서를 저장했어요 ✦');
    } catch (e) {
      console.error(e);
      toast('엽서를 만들지 못했어요');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function shareLink() {
    const url = location.href;
    const w = S.world;
    if (!w) return;
    const text = S.mode === 'duo'
      ? `${w.owner} × ${S.partner.owner} 행성 궁합 ${S.harmony.score}% — ${S.harmony.tier.name}`
      : w.bday
        ? `오늘은 실제 외계행성 「${w.planet}」에서 내 ${w.bday.n.toLocaleString('ko-KR')}번째 생일이에요 (이 행성의 1년 = ${Math.round(w.bday.period).toLocaleString('ko-KR')}일)`
        : `내 이름과 연결된 실제 외계행성 「${w.planet}」 — ${w.exo.dist != null ? Math.round(w.exo.dist).toLocaleString('ko-KR') + '광년 거리, ' : ''}${w.rarity.name} 등급 (상위 ${w.rarity.topPct}%)`;
    if (navigator.share && coarse) {
      try { await navigator.share({ title: 'NAMEVERSE', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await copyText(`${text}\n${url}`);
      toast('링크를 복사했어요. 친구에게 보내 보세요!');
    } catch (e) {
      toast('복사하지 못했어요. 주소창의 링크를 공유해 주세요');
    }
  }
  function copyText(s) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      ok ? res() : rej(new Error('copy failed'));
    });
  }

  /* ───────────── 조작: 드래그 = 행성 회전 · 오른쪽 드래그/두 손가락 = 시점 이동 · 핀치/휠 = 확대 ───────────── */
  // 확대 한계: 카메라와 행성 중심 거리 = 6 / zoom → 가장 가까이 2.5, 가장 멀리 100 (행성 반지름 = 1)
  const ZOOM_MIN = 0.06, ZOOM_MAX = 2.4;
  // 자동 회전: 마지막 조작 AUTO_DELAY초 뒤부터 AUTO_RAMP초에 걸쳐 AUTO_YAW(rad/s, 약 2.6분에 한 바퀴)까지 빨라진다.
  // 시점 높이는 ±PITCH_BAND(약 16°) 안으로 PITCH_SPEED(rad/s, 초당 약 11°)의 일정한 속도로 돌아온다
  const AUTO_DELAY = 5, AUTO_RAMP = 4, AUTO_YAW = 0.04, PITCH_BAND = 0.28, PITCH_SPEED = 0.2, PITCH_RAMP = 1.2;
  // 0→1 이동 곡선: 앞뒤 edge 구간에서만 속도가 사인 곡선으로 0↔최대로 바뀌고, 가운데는 일정한 속도
  const pitchEase = (u, edge) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const area = 1 - edge, ramp = (x) => x / 2 - (edge / (2 * Math.PI)) * Math.sin(Math.PI * x / edge);
    if (u < edge) return ramp(u) / area;
    if (u > 1 - edge) return 1 - ramp(1 - u) / area;
    return (edge / 2 + (u - edge)) / area;
  };
  S.idleAt = performance.now(); S.autoDir = 1; // +1: 별이 흐르는 방향(화면 왼쪽)과 같은 쪽으로 돈다
  const poke = () => { S.idleAt = performance.now(); };
  const pointers = new Map();   // pointerId → {x, y}
  const pointer = { down: false, mode: 'spin', x: 0, y: 0, moved: 0, t: 0, dist: 0 };
  const viewing = () => S.mode === 'world' || S.mode === 'duo';
  const centroid = () => {
    let x = 0, y = 0;
    for (const p of pointers.values()) { x += p.x; y += p.y; }
    return [x / pointers.size, y / pointers.size];
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  function beginGesture(mode) {
    pointer.mode = mode;
    [pointer.x, pointer.y] = centroid();
    pointer.dist = spread();
    pointer.t = performance.now();
    const d = renderer.drag, c = renderer.cam;
    d.vx = d.vy = c.vyaw = c.vpitch = 0;
  }
  el.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!renderer || S.mode === 'scan') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.canvas.setPointerCapture(e.pointerId);
    el.canvas.classList.add('grabbing');
    if (pointers.size === 1) {
      pointer.down = true; pointer.moved = 0; pointer.rot = false;
      const orbit = viewing() && (e.button === 2 || e.shiftKey);
      beginGesture(orbit ? 'orbit' : 'spin');
    } else if (viewing()) {
      beginGesture('orbit'); // 두 손가락
      pointer.moved = 99;    // 두 손가락 제스처는 탭(지표 탐사)으로 치지 않는다
    }
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [cx, cy] = centroid();
    const dx = cx - pointer.x, dy = cy - pointer.y;
    // 한 손가락(마우스) 드래그, 또는 두 손가락이 함께 움직일 때만 돌리는 조작으로 본다.
    // 두 손가락 사이만 벌어지고 좁혀지는 핀치(확대·축소)는 자동 회전을 끊지 않는다
    if (pointers.size < 2 || Math.abs(dx) + Math.abs(dy) > 2) { poke(); pointer.rot = true; }
    const now = performance.now(), dt = Math.max(0.001, (now - pointer.t) / 1000);
    pointer.x = cx; pointer.y = cy; pointer.t = now;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    if (pointer.mode === 'orbit') {
      const c = renderer.cam;
      c.yaw += dx * 0.006;
      c.pitch = Math.max(-1.35, Math.min(1.35, c.pitch + dy * 0.005));
      c.vyaw = (dx * 0.006) / dt * 0.6 + c.vyaw * 0.4;
      if (Math.abs(dx) > 2) S.autoDir = Math.sign(dx); // 자동 회전은 마지막으로 돌린 방향을 따른다
      c.vpitch = (dy * 0.005) / dt * 0.6 + c.vpitch * 0.4;
      if (pointers.size >= 2) {
        const dist = spread();
        if (pointer.dist > 0 && dist > 0) renderer.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, renderer.zoom * dist / pointer.dist));
        pointer.dist = dist;
      }
    } else {
      const d = renderer.drag;
      d.x += dx * 0.008;
      d.y = Math.max(-1.1, Math.min(1.1, d.y + dy * 0.006));
      d.vx = (dx * 0.008) / dt * 0.6 + d.vx * 0.4;
      d.vy = (dy * 0.006) / dt * 0.6 + d.vy * 0.4;
    }
    if (pointer.moved > 6) hideProbe();
  });
  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointer.rot || pointer.moved < 6) poke(); // 돌렸거나 탭(지표 탐사)했을 때
    if (pointers.size) { beginGesture(pointer.mode); return; } // 손가락 하나를 먼저 떼도 튀지 않게
    pointer.down = false;
    el.canvas.classList.remove('grabbing');
    if (performance.now() - pointer.t > 80) {
      renderer.drag.vx = renderer.drag.vy = 0;
      renderer.cam.vyaw = renderer.cam.vpitch = 0;
    }
    if (pointer.moved < 6 && pointer.mode === 'spin' && e.type === 'pointerup' && viewing()) doProbe(e.clientX, e.clientY);
  };
  el.canvas.addEventListener('pointerup', endPointer);
  el.canvas.addEventListener('pointercancel', endPointer);
  el.canvas.addEventListener('wheel', (e) => {
    if (!renderer || !viewing()) return;
    e.preventDefault();
    renderer.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, renderer.zoom * Math.exp(-e.deltaY * 0.0012)));
    hideProbe();
  }, { passive: false });
  // 더블클릭(더블탭): 처음 시점으로
  el.canvas.addEventListener('dblclick', () => { if (renderer && viewing()) resetView(); });
  function resetView() {
    // 자동 회전으로 여러 바퀴 돈 시점도 가까운 쪽으로 한 번에 돌아오게
    const c = renderer.cam;
    c.yaw = Math.atan2(Math.sin(c.yaw), Math.cos(c.yaw));
    S.viewReset = true; poke();
  }

  let probeTimer;
  function doProbe(x, y) {
    const k = el.canvas.width / innerWidth;
    const hit = renderer.pick(x * k, y * k, performance.now() / 1000);
    if (!hit) { hideProbe(); return; }
    const info = NV.probe(hit.world, hit.local);
    el.probe.innerHTML = `<div class="k">${info.icon} ${esc(info.label)}${S.mode === 'duo' ? ' · ' + esc(hit.world.planet) : ''}</div>
      <div class="n">${esc(info.name)}</div><div class="c">${esc(info.coord)}</div><div class="f">${esc(info.fact)}</div>`;
    el.marker.style.left = x + 'px'; el.marker.style.top = y + 'px';
    el.marker.hidden = false; el.probe.hidden = false;
    const pw = el.probe.offsetWidth, ph = el.probe.offsetHeight;
    let px = x + 18, py = y - ph / 2;
    if (px + pw > innerWidth - 12) px = x - pw - 18;
    py = Math.max(12, Math.min(innerHeight - ph - 12, py));
    el.probe.style.left = px + 'px'; el.probe.style.top = py + 'px';
    el.probe.style.animation = 'none'; void el.probe.offsetWidth; el.probe.style.animation = '';
    clearTimeout(probeTimer);
    probeTimer = setTimeout(hideProbe, 5000);
  }
  function hideProbe() { el.probe.hidden = true; el.marker.hidden = true; }

  function showDragHint() {
    if (sessionStorage.getItem('nv.hint')) return;
    sessionStorage.setItem('nv.hint', '1');
    el.hintDrag.hidden = false;
    setTimeout(() => { el.hintDrag.hidden = true; }, 6200);
  }

  /* ───────────── 은하 도감 ───────────── */
  function loadAtlas() {
    try { return JSON.parse(localStorage.getItem(ATLAS_KEY)) || []; } catch (e) { return []; }
  }
  function saveAtlas(w) {
    const v = w.visual;
    const list = loadAtlas().filter((x) => x.key !== w.key);
    list.unshift({
      key: w.key, owner: w.owner, planet: w.planet, biome: w.biome.name, rarity: w.rarity.name, top: w.rarity.topPct,
      c1: NV.toCss(v.type === 2 ? v.emit : v.type === 1 ? v.shallow : v.land),
      c2: NV.toCss(v.type === 2 ? v.deep : v.deep),
      glow: NV.toCss(v.atmo), ts: Date.now(),
      bd: w.bday ? { p: w.exoIndex, k: w.bday.n, d: w.bday.date } : null,
    });
    try { localStorage.setItem(ATLAS_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) { /* 저장 공간 없음: 무시 */ }
    el.atlasCount.textContent = Math.min(list.length, 60);
  }
  function renderAtlas() {
    const list = loadAtlas();
    el.atlasList.innerHTML = list.length
      ? list.map((x) => `<li><button data-owner="${esc(x.owner)}"${x.bd ? ` data-bd="${esc(JSON.stringify(x.bd))}"` : ''}>
          <span class="dot" style="background:radial-gradient(circle at 34% 32%, ${x.c1}, ${x.c2} 72%);box-shadow:0 0 14px ${x.glow}66, inset -6px -6px 12px rgba(0,0,0,.55)"></span>
          <span><span class="t">${esc(x.planet)}</span><br><span class="s">${esc(x.owner)} · ${esc(x.biome)} · ${esc(x.rarity)}</span></span>
        </button></li>`).join('')
      : '<li class="atlas-empty">아직 발견한 행성이 없어요.<br>이름을 하나 입력해 보세요.</li>';
  }
  $('#btn-atlas').addEventListener('click', () => { renderAtlas(); el.atlas.hidden = false; });
  el.atlasList.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-owner]');
    if (!b) return;
    el.atlas.hidden = true;
    let bd = null;
    try { bd = b.dataset.bd ? JSON.parse(b.dataset.bd) : null; } catch (err) { /* 옛 기록 */ }
    go(b.dataset.owner, null, bd);
  });
  $('#atlas-clear').addEventListener('click', () => {
    localStorage.removeItem(ATLAS_KEY);
    el.atlasCount.textContent = '0';
    renderAtlas();
    toast('도감을 비웠어요');
  });

  /* ───────────── 닫기 · 단축키 ───────────── */
  function closeOverlays() {
    el.modalDuo.hidden = true; el.atlas.hidden = true; hideProbe();
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (c) $('#' + c.dataset.close).hidden = true;
    if (e.target === el.modalDuo) el.modalDuo.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeOverlays(); return; }
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (typing) return;
    if (e.key === 'm' || e.key === 'M') toggleMusic();
    if (e.key === '/' && S.mode === 'intro') { e.preventDefault(); el.name.focus(); }
  });
  $('#brand').addEventListener('click', (e) => {
    e.preventDefault();
    if (location.hash) location.hash = ''; else showIntro();
  });

  /* ───────────── 시작 ───────────── */
  el.atlasCount.textContent = loadAtlas().length;
  resize();
  route();
  requestAnimationFrame(frame);
  if (!location.hash && !coarse) setTimeout(() => el.name.focus(), 300);

  // 디버그/테스트용
  NV.app = { S, go, renderer, music, stars };
})();
