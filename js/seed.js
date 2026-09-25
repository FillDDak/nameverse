/* NAMEVERSE — 결정론적 난수: 같은 이름은 전 세계 어디서나 같은 행성을 만든다 */
(function () {
  'use strict';

  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function makeRng(str) {
    const s = cyrb128(str);
    const r = sfc32(s[0], s[1], s[2], s[3]);
    for (let i = 0; i < 16; i++) r();
    return {
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (a, b) => Math.floor(a + (b - a + 1) * r()),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      weighted(items) {
        const total = items.reduce((s, it) => s + it.weight, 0);
        let x = r() * total;
        for (const it of items) { x -= it.weight; if (x <= 0) return it; }
        return items[items.length - 1];
      },
      // 중복 없이 n개 뽑기
      sample(arr, n) {
        const copy = arr.slice(), out = [];
        while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
        return out;
      },
      // 독립된 하위 스트림: 한 영역에 기능을 추가해도 다른 영역의 결과가 바뀌지 않는다
      fork: (label) => makeRng(str + '::' + label),
    };
  }

  function normalizeName(n) {
    return (n || '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function nameKey(n) {
    return normalizeName(n).toLowerCase();
  }

  window.NV = window.NV || {};
  Object.assign(window.NV, { makeRng, hash: cyrb128, normalizeName, nameKey });
})();
