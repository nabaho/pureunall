/* 사진첩 — «그림 모양»으로 서류·사진을 먼저 가른다 (대표 지시 2026-09-28)
 *
 *   「서류와 사진을 니가 자동으로 구분해서 분류하고 서류는 자동으로 ocr 하게 만들면 안되나?」
 *   → 「확실한 것만 저절로」(추천) 고르심
 *
 * ■ 왜 구글에 안 보내고 여기서 가르나
 *   2026-09-07 「단순 사진은 구글 판독에 안 들어가는게 좋은데」 — 그래서 10장 넘게 한꺼번에
 *   올린 뭉치는 「서류입니까?」로 멈춰 두었다(가르려면 보내 봐야 했다). 이 층은 브라우저
 *   «안»에서 미리보기 그림만 보고 가른다 — 사진이 밖으로 안 나가고 돈도 0원이다.
 *
 * ■ 셈법 — 실제 사진 383장(판독이 회의·현장 246 / 서류 137 로 정해 둔 것)으로 배웠다
 *   48×48 로 줄여 아홉 가지를 잰다(밝은 흰 칸·어두운 칸·중간·채도·글자 윤곽·줄 밝기 흩어짐·
 *   가운데/가장자리 흰 칸). 로지스틱 회귀 한 겹 — 5겹 교차 검증 세 번 평균(처음 보는 사진)으로:
 *     서류 확률 ≥ 0.9 → 서류   107장 중 0장 틀림
 *     서류 확률 ≤ 0.1 → 사진   204장 중 5장 틀림(모두 «책상 위에 놓고 찍은 명함»)
 *     그 사이        → 모름    약 19% — 지금처럼 사람에게 묻는다
 *   ⚠ 틀림의 무게가 다르다 — 사진을 서류로 보면 판독 한 번이 더 들 뿐이지만, 서류를 사진으로
 *     보면 «안 읽힌다». 그래서 문턱을 반반이 아니라 양 끝으로 벌려 두었다.
 *   ⚠ 숫자(평균·흩어짐·무게)를 손으로 고치지 말 것 — 다시 배울 때는 같은 방식으로 재서 통째로 바꾼다.
 *
 * ■ 이 파일은 셈만 한다 — 그림 받기·저장·화면은 부르는 쪽 일이다. 아무것도 안 쓴다.
 */
(function (global) {
  'use strict';
  var N = 48;
  var FEATURES = ['white', 'dark', 'mid', 'sat', 'edge', 'rowvar', 'cwhite', 'bwhite', 'cdiff'];
  /* ⚠ 브라우저 캔버스로 줄여 잰 숫자로 배웠다 — 처음엔 윈도우 그림 기능으로 배웠더니 줄이는
       방식이 달라 판정이 어긋났다(명함 틀림 2 → 9). 화면이 실제로 재는 길로 다시 배운 값이다. */
  var MODEL = {
    mu: { white: 0.30984, dark: 0.20598, mid: 0.48418, sat: 0.11538, edge: 0.06435, rowvar: 27.45383,
          cwhite: 0.46011, bwhite: 0.43786, cdiff: 0.02225 },
    sd: { white: 0.36275, dark: 0.17031, mid: 0.28205, sat: 0.08524, edge: 0.04394, rowvar: 18.32012,
          cwhite: 0.35552, bwhite: 0.34351, cdiff: 0.13832 },
    w:  { white: 0.838, dark: -0.837, mid: -0.573, sat: 0.09, edge: -3.32, rowvar: -0.026,
          cwhite: 1.043, bwhite: 0.845, cdiff: 0.581 },
    b: -0.617
  };
  var DOC_AT = 0.9, PIC_AT = 0.1;

  /* RGBA 픽셀(N×N) → 아홉 가지 숫자. 잰 방식은 배울 때(scratchpad kind-feat.ps1)와 같다. */
  function features(px, n) {
    var size = n || N, T = size * size;
    var L = new Array(T);
    var white = 0, dark = 0, mid = 0, sat = 0, i, x, y;
    for (i = 0; i < T; i++) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      var s = mx > 0 ? (mx - mn) / mx : 0;
      L[i] = lum; sat += s;
      if (lum > 200 && s < 0.15) white++; else if (lum < 80) dark++; else mid++;
    }
    var edge = 0, rowSum = new Array(size);
    for (y = 0; y < size; y++) {
      rowSum[y] = 0;
      for (x = 1; x < size; x++) {
        var a = L[y * size + x];
        if (Math.abs(a - L[y * size + x - 1]) > 50) edge++;
        rowSum[y] += a;
      }
    }
    var avg = 0; for (y = 0; y < size; y++) avg += rowSum[y]; avg /= size;
    var rv = 0; for (y = 0; y < size; y++) rv += (rowSum[y] - avg) * (rowSum[y] - avg);
    rv = Math.sqrt(rv / size) / size;
    var q1 = Math.floor(size / 4), q3 = Math.floor(size * 3 / 4), cw = 0, cn = 0, bw = 0, bn = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var w = L[y * size + x] > 170 ? 1 : 0;
      if (x >= q1 && x < q3 && y >= q1 && y < q3) { cw += w; cn++; } else { bw += w; bn++; }
    }
    var f = { white: white / T, dark: dark / T, mid: mid / T, sat: sat / T,
              edge: edge / (size * (size - 1)), rowvar: rv, cwhite: cw / cn, bwhite: bw / bn };
    f.cdiff = f.cwhite - f.bwhite;
    return f;
  }

  /* 서류일 확률 0~1 */
  function docChance(f) {
    var z = MODEL.b;
    FEATURES.forEach(function (k) { z += MODEL.w[k] * ((Number(f[k]) || 0) - MODEL.mu[k]) / MODEL.sd[k]; });
    return 1 / (1 + Math.exp(-z));
  }

  /* 'doc' | 'pic' | '' (모름 — 사람에게 묻는다) */
  function verdict(p) {
    if (typeof p !== 'number' || !isFinite(p)) return '';
    if (p >= DOC_AT) return 'doc';
    if (p <= PIC_AT) return 'pic';
    return '';
  }

  /* 브라우저 전용 — 그림(dataURL·주소) 하나를 받아 서류 확률을 낸다. 실패하면 null(= 모름). */
  function lookOf(src) {
    return new Promise(function (resolve) {
      var d = global.document;
      if (!d || !global.Image || !src) { resolve(null); return; }
      var im = new global.Image();
      /* 창고 주소면 CORS 로 받는다 — 안 그러면 캔버스가 «오염»돼 픽셀을 못 읽는다(→ 모름) */
      if (/^https?:/i.test(String(src))) im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var c = d.createElement('canvas'); c.width = N; c.height = N;
          var g = c.getContext('2d');
          g.imageSmoothingQuality = 'high';
          g.drawImage(im, 0, 0, N, N);
          resolve(docChance(features(g.getImageData(0, 0, N, N).data, N)));
        } catch (e) { resolve(null); }   // 남의 주소라 그림을 못 읽으면(오염된 캔버스) 모름
      };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  global.PuPhotoLook = { N: N, DOC_AT: DOC_AT, PIC_AT: PIC_AT,
    features: features, docChance: docChance, verdict: verdict, lookOf: lookOf };
})(typeof window !== 'undefined' ? window : globalThis);
