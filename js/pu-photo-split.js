/* 푸른사진첩 — 한 사진 속 서류 여러 장 «찾기·나누기» 계산 (대표 지시 2026-10-08 「여러장이 될 수 있다」)
   사진 한 장에 신청서와 사업자등록증, 명함 여러 장이 함께 찍혀 들어온다. 그대로 두면 판독이
   한 장만 읽고 나머지는 «다른 서류의 칸»에 섞여 들어간다(실측: 신청서 글자가 등록증 소재지에 붙었다).
   그래서 서류마다 네모를 하나씩 쳐 «새 사진 여러 장»으로 담는다.

   ★ 이 파일은 «계산만» 한다 — 화면(DOM)도 저장도 모른다. 그래서 노드에서 그대로 검사한다.
     밝기 배열(0~255, 가로×세로)을 받아 네모 목록을 돌려준다. 네모는 0~1 비율 좌표다
     (사진을 줄여서 찾고, 자르는 것은 원본 크기에서 한다 — 비율이면 둘이 어긋나지 않는다).

   ★ 찾는 길 둘 (요금 0원 · 이 기기 안에서):
     ① 종이 덩어리 — 책상 위에 흩어 놓고 찍은 사진. 바탕이 종이보다 어둡다.
        밝은 칸끼리 이어진 덩어리마다 네모 하나.
     ② 하얀 틈    — 스캐너·흰 바탕에 나란히 놓인 것. 종이와 바탕이 똑같이 하얗다.
        글자가 없는 세로·가로 띠를 찾아 그 자리에서 가른다.
   ⚠ 못 찾으면 «못 찾았다»고 돌려준다(빈 목록). 억지로 반을 가르지 않는다 —
     잘못 가르면 서류가 반 토막 나고, 그것을 사람이 알아채기가 더 어렵다.
     그때는 사람이 네모를 그리거나 「세로로 2」 같은 칸 나누기를 쓴다.
   ⚠ 늘 사람이 보고 고친 뒤에 담는다 — 이 계산은 «처음 놓아 두는 자리»일 뿐이다. */
(function (global) {
  'use strict';

  var MAX_BOXES = 12;        // 한 번에 이보다 많으면 거의 잘못 찾은 것이다(대표 결정 2026-10-08)
  var MIN_SIDE = 0.04;       // 네모 한 변이 사진의 4% 보다 작으면 서류가 아니다(얼룩·도장)
  var DETECT_SIDE = 256;     // 찾을 때 줄이는 긴 변 — 화면이 하는 일이고 여기서는 받기만 한다

  /* RGBA → 밝기 (0~255) */
  function lumaOf(rgba, n) {
    var L = new Uint8Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      L[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
    }
    return L;
  }

  /* 오츠 문턱 — 밝은 것과 어두운 것을 가장 잘 가르는 값 */
  function otsu(L) {
    var hist = new Array(256).fill(0), n = L.length, i;
    for (i = 0; i < n; i++) hist[L[i]]++;
    var sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, t = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = n - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; t = i; }
    }
    return t;
  }

  function area(b) { return b.w * b.h; }

  /* b 가 a 안에 거의 다 들어가나 */
  function inside(b, a) {
    var x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
    var x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) return false;
    return (x1 - x0) * (y1 - y0) >= 0.85 * area(b);
  }

  /* 0~1 안으로 가두고, 너무 작은 것은 버린다 */
  function clampBox(b) {
    var x = Math.max(0, Math.min(1, b.x)), y = Math.max(0, Math.min(1, b.y));
    var w = Math.max(0, Math.min(1 - x, b.w)), h = Math.max(0, Math.min(1 - y, b.h));
    if (w < MIN_SIDE || h < MIN_SIDE) return null;
    return { x: x, y: y, w: w, h: h };
  }

  /* 읽는 차례 — 위에서 아래로, 같은 줄이면 왼쪽부터.
     ⚠ 「같은 줄」은 위쪽 끝이 아니라 «가운데 높이»가 겹치는가로 본다 — 조금 기울게
       놓인 명함 둘이 위쪽 끝만 살짝 달라도 차례가 뒤집히지 않게. */
  function sortBoxes(boxes) {
    return boxes.slice().sort(function (a, b) {
      var ac = a.y + a.h / 2, bc = b.y + b.h / 2;
      var sameRow = Math.abs(ac - bc) < Math.min(a.h, b.h) / 2;
      if (sameRow) return a.x - b.x;
      return ac - bc;
    });
  }

  /* 다듬기 — 가두기 · 안에 든 것 빼기 · 차례 · 장수 한도 */
  function tidy(boxes) {
    var list = boxes.map(clampBox).filter(Boolean);
    list.sort(function (a, b) { return area(b) - area(a); });
    var kept = [];
    list.forEach(function (b) {
      if (kept.some(function (a) { return inside(b, a); })) return;
      kept.push(b);
    });
    return sortBoxes(kept).slice(0, MAX_BOXES);
  }

  /* ── ① 종이 덩어리 ──
     밝은 칸을 한 칸 부풀려 표 테두리 같은 가는 선을 메운 뒤, 이어진 덩어리마다 네모.
     ⚠ 표 안쪽 칸도 저마다 덩어리가 되지만 바깥 여백 덩어리 «안에» 들므로 tidy 가 뺀다. */
  function byPapers(L, w, h, t) {
    var n = w * h, i, x, y;
    var bright = new Uint8Array(n);
    for (i = 0; i < n; i++) bright[i] = L[i] > t ? 1 : 0;
    var m = new Uint8Array(n);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (bright[i] || (x > 0 && bright[i - 1]) || (x < w - 1 && bright[i + 1]) ||
            (y > 0 && bright[i - w]) || (y < h - 1 && bright[i + w])) m[i] = 1;
      }
    }
    var seen = new Uint8Array(n), stack = [], out = [];
    var minPix = n * 0.008;
    for (var s = 0; s < n; s++) {
      if (!m[s] || seen[s]) continue;
      var x0 = w, y0 = h, x1 = -1, y1 = -1, cnt = 0;
      stack.length = 0; stack.push(s); seen[s] = 1;
      while (stack.length) {
        var p = stack.pop(), px = p % w, py = (p - px) / w;
        cnt++;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        if (px > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (px < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (py > 0 && m[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
        if (py < h - 1 && m[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
      }
      if (cnt < minPix) continue;
      out.push({ x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h });
    }
    return tidy(out.filter(function (b) { return area(b) >= 0.015; }));
  }

  /* 글자가 «없는» 띠 찾기 — 한 줄(가로 또는 세로)의 잉크 칸 수 목록을 받아 빈 띠의 [시작, 끝) 들 */
  function emptyRuns(ink, limit) {
    var runs = [], st = -1;
    for (var i = 0; i < ink.length; i++) {
      if (ink[i] <= limit) { if (st < 0) st = i; }
      else if (st >= 0) { runs.push([st, i]); st = -1; }
    }
    if (st >= 0) runs.push([st, ink.length]);
    return runs;
  }

  /* 한 방향으로 가르기 — 띠 범위 [a, b) 안의 «속» 빈 띠 가운데 충분히 넓은 것에서 자른다.
     axis 'x' 는 세로 띠(왼쪽·오른쪽으로 가름), 'y' 는 가로 띠(위·아래로 가름).
     ⚠ 가로로 가를 때는 더 깐깐하다 — 한 서류 안에도 문단 사이 빈 줄이 있다.
       그래서 «그 서류의 보통 줄 간격의 times 배보다 넓은» 띠에서만 자른다(times 0 이면 안 본다). */
  function splitAxis(ink, a, b, limit, minGap, times) {
    var seg = ink.slice(a, b);
    var runs = emptyRuns(seg, limit).filter(function (r) { return r[0] > 0 && r[1] < seg.length; });
    if (!runs.length) return null;
    var need = minGap;
    if (times) {
      var lens = runs.map(function (r) { return r[1] - r[0]; }).sort(function (p, q) { return p - q; });
      var med = lens[Math.floor(lens.length / 2)];
      need = Math.max(minGap, med * times);
    }
    var cuts = runs.filter(function (r) { return r[1] - r[0] >= need; });
    if (!cuts.length) return null;
    /* 조각이 너무 가늘면 그 자리에서는 안 자른다 — 왼쪽 제목 칸·도장 자리 같은 것이
       따로 떨어져 «서류 한 장»으로 잡히지 않게 */
    var minPart = seg.length * 0.12, parts = [], st = 0;
    cuts.forEach(function (r) {
      if (r[0] - st >= minPart) { parts.push([a + st, a + r[0]]); st = r[1]; }
    });
    if (seg.length - st < minPart && parts.length) parts[parts.length - 1][1] = b;
    else parts.push([a + st, b]);
    return parts.length >= 2 ? parts : null;
  }

  /* ── ② 하얀 틈 ── */
  function byGaps(L, w, h, t) {
    var ink = new Uint8Array(w * h), i, x, y;
    for (i = 0; i < w * h; i++) ink[i] = L[i] <= t ? 1 : 0;
    function colInk(y0, y1, x0, x1) {
      var c = new Array(x1 - x0).fill(0);
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) c[xx - x0] += ink[yy * w + xx];
      return c;
    }
    function rowInk(y0, y1, x0, x1) {
      var r = new Array(y1 - y0).fill(0);
      for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) r[yy - y0] += ink[yy * w + xx];
      return r;
    }
    /* 잉크가 있는 범위로 좁힌다 — 바깥 여백은 틈이 아니다 */
    function trim(x0, y0, x1, y1) {
      var c = colInk(y0, y1, x0, x1), r = rowInk(y0, y1, x0, x1), lim = 0;
      var a = 0, b = c.length; while (a < b && c[a] <= lim) a++; while (b > a && c[b - 1] <= lim) b--;
      var p = 0, q = r.length; while (p < q && r[p] <= lim) p++; while (q > p && r[q - 1] <= lim) q--;
      if (a >= b || p >= q) return null;
      return [x0 + a, y0 + p, x0 + b, y0 + q];
    }
    var all = trim(0, 0, w, h);
    if (!all) return [];
    /* ⚠ 왼쪽·오른쪽으로 갈랐으면 그 조각을 다시 위·아래로 안 가른다 — 등록증처럼 한 장 안에
         빈 줄이 넓은 서류가 반 토막 난다. 2×2 로 놓인 것은 「⊞ 2×2」 칸 나누기가 맡는다.
       ⚠ 위·아래 가르기는 사진 «전체»에서만, 그것도 넓은 틈(높이의 12% · 보통 줄 간격의 4배)에서만. */
    var regions = [];
    var c = colInk(all[1], all[3], all[0], all[2]);
    var cols = splitAxis(c, 0, c.length, Math.max(0, Math.floor((all[3] - all[1]) * 0.004)),
      Math.max(3, Math.round(w * 0.025)), 0);
    if (cols) {
      cols.forEach(function (p) { regions.push([all[0] + p[0], all[1], all[0] + p[1], all[3]]); });
    } else {
      var r = rowInk(all[1], all[3], all[0], all[2]);
      var rows = splitAxis(r, 0, r.length, Math.max(0, Math.floor((all[2] - all[0]) * 0.004)),
        Math.max(3, Math.round(h * 0.12)), 4);
      (rows || []).forEach(function (p) { regions.push([all[0], all[1] + p[0], all[2], all[1] + p[1]]); });
    }
    if (regions.length < 2) return [];
    var pad = 0.012, out = [];
    regions.forEach(function (g) {
      var tt = trim(g[0], g[1], g[2], g[3]);
      if (!tt) return;
      out.push({ x: tt[0] / w - pad, y: tt[1] / h - pad, w: (tt[2] - tt[0]) / w + 2 * pad, h: (tt[3] - tt[1]) / h + 2 * pad });
    });
    var res = tidy(out.filter(function (b) { return area(b) >= 0.02; }));
    return res.length >= 2 ? res : [];
  }

  /* 밝기 배열에서 서류 찾기 → { how:'paper'|'gap'|'none', boxes:[{x,y,w,h}] }
     ⚠ 종이 덩어리가 «둘 이상»일 때만 그것을 믿는다. 하나뿐이고 사진을 거의 다 덮으면
       흰 바탕 스캔이다(바탕 전체가 한 덩어리) — 그때는 하얀 틈으로 다시 본다. */
  function findBoxesInLuma(L, w, h) {
    if (!L || !w || !h || L.length < w * h) return { how: 'none', boxes: [] };
    var t = otsu(L), bright = 0;
    for (var i = 0; i < w * h; i++) if (L[i] > t) bright++;
    var frac = bright / (w * h);
    var papers = (frac >= 0.04 && frac <= 0.92) ? byPapers(L, w, h, t) : [];
    if (papers.length >= 2) return { how: 'paper', boxes: papers };
    var gaps = byGaps(L, w, h, t);
    if (gaps.length >= 2) return { how: 'gap', boxes: gaps };
    if (papers.length === 1 && area(papers[0]) < 0.7) return { how: 'paper', boxes: papers };
    return { how: 'none', boxes: [] };
  }

  /* 화면이 넘기는 그림(ImageData 모양)에서 찾기 */
  function findBoxes(img) {
    if (!img || !img.data || !img.width || !img.height) return { how: 'none', boxes: [] };
    return findBoxesInLuma(lumaOf(img.data, img.width * img.height), img.width, img.height);
  }

  /* 칸 나누기 — 반듯하게 나란히 찍힌 것을 한 번에 (세로 cols 칸 × 가로 rows 칸) */
  function gridBoxes(cols, rows) {
    var c = Math.max(1, Math.min(6, cols | 0)), r = Math.max(1, Math.min(6, rows | 0)), out = [];
    for (var y = 0; y < r; y++) for (var x = 0; x < c; x++) out.push({ x: x / c, y: y / r, w: 1 / c, h: 1 / r });
    return out.slice(0, MAX_BOXES);
  }

  /* 비율 네모 → 원본 크기의 자를 자리(정수, 사진 밖으로 안 나간다) */
  function pixelRect(b, W, H) {
    var sx = Math.max(0, Math.min(W - 1, Math.round(b.x * W)));
    var sy = Math.max(0, Math.min(H - 1, Math.round(b.y * H)));
    var ex = Math.max(sx + 1, Math.min(W, Math.round((b.x + b.w) * W)));
    var ey = Math.max(sy + 1, Math.min(H, Math.round((b.y + b.h) * H)));
    return { sx: sx, sy: sy, sw: ex - sx, sh: ey - sy };
  }

  global.PuPhotoSplit = {
    MAX_BOXES: MAX_BOXES, MIN_SIDE: MIN_SIDE, DETECT_SIDE: DETECT_SIDE,
    findBoxes: findBoxes, findBoxesInLuma: findBoxesInLuma,
    gridBoxes: gridBoxes, pixelRect: pixelRect, sortBoxes: sortBoxes, clampBox: clampBox, tidy: tidy,
    otsu: otsu
  };
})(typeof window !== 'undefined' ? window : globalThis);
