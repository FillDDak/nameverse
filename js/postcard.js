/* NAMEVERSE — 공유용 행성 엽서 (1080×1350) */
(function () {
  'use strict';
  const NV = window.NV;
  const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
  let offscreen = null;

  function planetImage(worlds, w, h, time) {
    if (!offscreen) {
      const c = document.createElement('canvas');
      offscreen = new NV.PlanetRenderer(c, { preserve: true });
    }
    offscreen.resize(w, h);
    offscreen.setWorlds(worlds, { instant: true });
    offscreen.drag = { x: 0, y: 0, vx: 0, vy: 0 };
    offscreen.layout = (W, H, n) => n === 1
      ? [{ x: 0, y: 0, w: W, h: H, shift: [0, 0], fit: 0.5 }]
      : [{ x: 0, y: 0, w: W / 2, h: H, shift: [0, 0], fit: 0.38 }, { x: W / 2, y: 0, w: W / 2, h: H, shift: [0, 0], fit: 0.38 }];
    offscreen.render(time);
    return offscreen.canvas;
  }

  function wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return lines.length;
  }

  function spaced(ctx, text, x, y, spacing) {
    // 가운데 정렬된 자간 텍스트
    const chars = [...text];
    const total = chars.reduce((s, ch) => s + ctx.measureText(ch).width + spacing, -spacing);
    let cx = x - total / 2;
    ctx.textAlign = 'left';
    chars.forEach((ch) => { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; });
    ctx.textAlign = 'center';
  }

  function background(ctx, W, H, worlds) {
    ctx.fillStyle = '#04040b';
    ctx.fillRect(0, 0, W, H);
    worlds.forEach((w, i) => {
      const cx = worlds.length === 1 ? W / 2 : W * (0.25 + 0.5 * i);
      const g = ctx.createRadialGradient(cx, 480, 50, cx, 480, 720);
      g.addColorStop(0, NV.toCss(w.visual.atmo, 0.28));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    const r = NV.makeRng('postcard/' + worlds.map((w) => w.key).join('+'));
    for (let i = 0; i < 420; i++) {
      const s = r.range(0.4, 2.2);
      ctx.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.85)})`;
      ctx.fillRect(r.range(0, W), r.range(0, H), s, s);
    }
  }

  function frame(ctx, W, H, accent) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.globalAlpha = 1;
    // 모서리 표식
    ctx.lineWidth = 4;
    [[36, 36, 1, 1], [W - 36, 36, -1, 1], [36, H - 36, 1, -1], [W - 36, H - 36, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + 40 * dy); ctx.lineTo(x, y); ctx.lineTo(x + 40 * dx, y); ctx.stroke();
    });
  }

  function footer(ctx, W, H, left) {
    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'left'; ctx.fillText(left, 78, H - 66);
    ctx.textAlign = 'right'; ctx.fillText('NAMEVERSE · 이름의 우주', W - 78, H - 66);
    ctx.textAlign = 'center';
  }

  async function single(world, time) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    background(ctx, W, H, [world]);
    ctx.drawImage(planetImage([world], W, 820, time), 0, 80);
    frame(ctx, W, H, world.accent);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = world.accent; ctx.font = `700 22px ${FONT}`;
    spaced(ctx, 'CERTIFICATE OF DISCOVERY', W / 2, 104, 6);

    ctx.fillStyle = '#fff';
    let size = 92;
    do { ctx.font = `800 ${size}px ${FONT}`; size -= 4; } while (size > 40 && ctx.measureText(world.planet).width > W - 160);
    ctx.fillText(world.planet, W / 2, 940);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `500 34px ${FONT}`;
    ctx.fillText(`${world.owner}의 행성 · ${world.biome.name}`, W / 2, 994);

    // 희귀도 배지
    const badge = `★ ${world.rarity.name} 등급 · 상위 ${world.rarity.topPct}%`;
    ctx.font = `700 26px ${FONT}`;
    const bw = ctx.measureText(badge).width + 48;
    ctx.fillStyle = NV.toCss(world.visual.atmo, 0.18);
    ctx.strokeStyle = world.accent; ctx.lineWidth = 2;
    roundRect(ctx, W / 2 - bw / 2, 1022, bw, 48, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(badge, W / 2, 1055);

    // 핵심 수치
    const pick = ['지름', '평형 온도', '거리', '지구 유사도'].map((k) => world.stats.find((s) => s.k === k));
    pick.forEach((s, i) => {
      const x = 78 + (W - 156) * (i + 0.5) / pick.length;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `500 22px ${FONT}`; ctx.fillText(s.k, x, 1120);
      ctx.fillStyle = '#fff'; ctx.font = `700 30px ${FONT}`; ctx.fillText(s.short || s.v, x, 1160);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `italic 500 28px ${FONT}`;
    wrap(ctx, `“${world.proverb}”`, W / 2, 1218, W - 200, 38);
    footer(ctx, W, H, `${world.catalog} · ${world.constellation}자리 · RA ${world.coords.ra}`);
    return c;
  }

  async function duo(a, b, hm, time) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    background(ctx, W, H, [a, b]);
    ctx.drawImage(planetImage([a, b], W, 700, time), 0, 190);
    frame(ctx, W, H, a.accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = a.accent; ctx.font = `700 22px ${FONT}`;
    spaced(ctx, 'GRAVITATIONAL HARMONY', W / 2, 104, 6);

    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(a.planet, W * 0.25, 190); ctx.fillText(b.planet, W * 0.75, 190);
    ctx.font = `500 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${a.owner}의 행성`, W * 0.25, 226); ctx.fillText(`${b.owner}의 행성`, W * 0.75, 226);
    ctx.font = `300 60px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('×', W / 2, 210);

    ctx.fillStyle = '#fff'; ctx.font = `800 150px ${FONT}`;
    ctx.fillText(`${hm.score}%`, W / 2, 1020);
    ctx.fillStyle = a.accent; ctx.font = `700 40px ${FONT}`;
    ctx.fillText(hm.tier.name, W / 2, 1080);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `500 27px ${FONT}`;
    let y = 1134;
    y += wrap(ctx, hm.tier.desc, W / 2, y, W - 200, 38) * 38 + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `500 24px ${FONT}`;
    wrap(ctx, hm.lines[0], W / 2, y, W - 220, 34);
    footer(ctx, W, H, `${a.catalog} × ${b.catalog}`);
    return c;
  }

  // 제어센터·잠금 화면용 앨범 아트 (정사각형, 글자 없이 행성만)
  function artwork(world, time, S = 512) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#04040b';
    ctx.fillRect(0, 0, S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.7);
    g.addColorStop(0, NV.toCss(world.visual.atmo, 0.3));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const r = NV.makeRng('artwork/' + world.key);
    for (let i = 0; i < 90; i++) {
      const s = r.range(0.5, 1.8);
      ctx.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.7)})`;
      ctx.fillRect(r.range(0, S), r.range(0, S), s, s);
    }
    const img = planetImage([world], S, S, time);
    ctx.drawImage(img, 0, 0);
    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  NV.postcard = { single, duo, artwork };
})();
