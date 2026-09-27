/* 한국어 OCR — PP-OCRv5(korean) 를 브라우저에서 (onnxruntime-web, wasm).
   대표 2026-09-27 「앱 안에 넣기」: 과거 고객 서류 스캔본 58개로 겨뤄 보니 kordoc 4.15.6 의 내장 OCR(같은 모델)이
   지금 쓰던 tesseract 보다 칸을 31% 더 읽고(231 대 176, 등기부는 57 대 31), 번호 검증 숫자도 한 번도 안 틀렸다
   (43개 중 0 — tesseract 는 26개 중 1). 한 건 2.7초 대 9.6초. 그래서 그 방식을 옮겨 왔다.

   옮겨 온 것(원 구현: kordoc src/ocr/engine.ts · line-split.ts — MIT, © chrisryugj, https://github.com/chrisryugj/kordoc):
     ① 글자 덩어리 찾기(DBNet det: 긴 변 960·평균/표준편차 정규화·확률 0.3 이상 이어진 덩어리·점수 0.6 이상·unclip 1.5)
     ② 덩어리마다 잘라 높이 48 로 맞추기(쌍선형) ③ 한국어 인식(rec) + CTC 탐욕 풀이 ④ 신뢰 0.5 미만·대비 없는 덩어리 버림
     ⑤ 흔한 오인 기호 되돌리기(○·△·천 단위 쉼표) ⑥ 위→아래·왼→오른 줄로 모으기(이 부분은 여기서 새로 썼다)
   뺀 것: 표 괘선 찾기·기울기 보정·세로 글 회전·점선 리더 나누기(판독 함수가 쓰지 않는다).
   모델: PaddleOCR PP-OCRv5 (Apache-2.0, © PaddlePaddle Authors) — 저장소에 넣지 않고 처음 쓸 때 huggingface 의
   «고정된 커밋» 주소에서 받아 sha256 을 맞춰 본 뒤 브라우저 캐시에 둔다. 서류는 브라우저 밖으로 나가지 않는다. */
(function (root) {
  'use strict';
  var ORT_VER = '1.30.0';
  var ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@' + ORT_VER + '/dist/';
  var HF = 'https://huggingface.co/PaddlePaddle/';
  var MODELS = {
    det: { url: HF + 'PP-OCRv5_mobile_det_onnx/resolve/e6f4fa85f00e168c862bc462aebca69eef9b3d3d/inference.onnx',
      sha: 'a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d', mb: 5 },
    rec: { url: HF + 'korean_PP-OCRv5_mobile_rec_onnx/resolve/5c6f574b8e2230adf4287b33e736d71b9fabd28e/inference.onnx',
      sha: '92f0b7785e64fc9090106a241cf4c1eb97472824558272751b88a2a4476d3a08', mb: 13 },
    dict: { url: HF + 'korean_PP-OCRv5_mobile_rec_onnx/resolve/5c6f574b8e2230adf4287b33e736d71b9fabd28e/inference.yml',
      sha: 'f757fa1c40e99edcf27e9cce879b93eb2a51fa46f5ef39095689b8c37dd75998', mb: 0.1 }
  };
  var CACHE = 'pu-ocr-kr-v1';
  var T = { detLongSide: 960, detThresh: 0.3, detBoxThresh: 0.6, detUnclip: 1.5, textScore: 0.5, minInkContrast: 35 };
  var DET_MIN = 3, DET_MAX_BOXES = 3000, REC_H = 48, REC_MIN_W = 320, REC_MAX_W = 3200, MIN_INK = 0.01;
  var MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

  /* ── 순수 함수(검사가 Node 에서 부른다) ── */
  function parseDict(yml) {                          // inference.yml 의 character_dict: 목록
    var lines = String(yml).split('\n'), out = [], on = false, ind = -1;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!on) { var m0 = /^(\s*)character_dict:\s*$/.exec(line); if (m0) { on = true; ind = m0[1].length; } continue; }
      var m = /^(\s*)- (.*)$/.exec(line);
      if (m && m[1].length >= ind) {
        var v = m[2];
        if (v.length >= 2 && ((v[0] === "'" && v[v.length - 1] === "'") || (v[0] === '"' && v[v.length - 1] === '"'))) v = v.slice(1, -1).replace(/''/g, "'");
        out.push(v); continue;
      }
      if (line.trim() !== '') break;
    }
    return out;
  }
  function grayCrop(rgba, pageW, b) {
    var out = new Uint8Array(b.w * b.h);
    for (var y = 0; y < b.h; y++) {
      var si = ((b.y + y) * pageW + b.x) * 4, di = y * b.w;
      for (var x = 0; x < b.w; x++, si += 4, di++) out[di] = (rgba[si] * 77 + rgba[si + 1] * 150 + rgba[si + 2] * 29) >> 8;
    }
    return out;
  }
  function inkStats(gray) {                          // 오츠 문턱으로 잉크/바탕 대비와 잉크 비율
    var hist = new Uint32Array(256), total = gray.length, i, v;
    for (i = 0; i < total; i++) hist[gray[i]]++;
    var sumAll = 0; for (v = 0; v < 256; v++) sumAll += v * hist[v];
    var wB = 0, sumB = 0, best = -1, thr = 127;
    for (var t = 0; t < 256; t++) {
      wB += hist[t]; if (wB === 0) continue;
      var wF = total - wB; if (wF === 0) break;
      sumB += t * hist[t];
      var mB = sumB / wB, mF = (sumAll - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    var nD = 0, sD = 0; for (v = 0; v <= thr; v++) { nD += hist[v]; sD += v * hist[v]; }
    var nL = total - nD, sL = sumAll - sD;
    if (nD === 0 || nL === 0) return { contrast: 0, inkRatio: 0 };
    var dark = nD <= nL;
    return { contrast: sL / nL - sD / nD, inkRatio: (dark ? nD : nL) / total };
  }
  function componentBoxes(prob, w, h, thresh, boxThresh) {   // 확률 지도에서 이어진 덩어리(4방향)
    var seen = new Uint8Array(w * h), boxes = [], st = [];
    for (var s = 0; s < w * h; s++) {
      if (seen[s] || prob[s] <= thresh) continue;
      var x1 = s % w, x2 = x1, y1 = (s / w) | 0, y2 = y1, sum = 0, n = 0;
      st.length = 0; st.push(s); seen[s] = 1;
      while (st.length) {
        var p = st.pop(), px = p % w, py = (p / w) | 0;
        sum += prob[p]; n++;
        if (px < x1) x1 = px; if (px > x2) x2 = px; if (py < y1) y1 = py; if (py > y2) y2 = py;
        if (px > 0 && !seen[p - 1] && prob[p - 1] > thresh) { seen[p - 1] = 1; st.push(p - 1); }
        if (px < w - 1 && !seen[p + 1] && prob[p + 1] > thresh) { seen[p + 1] = 1; st.push(p + 1); }
        if (py > 0 && !seen[p - w] && prob[p - w] > thresh) { seen[p - w] = 1; st.push(p - w); }
        if (py < h - 1 && !seen[p + w] && prob[p + w] > thresh) { seen[p + w] = 1; st.push(p + w); }
      }
      if (x2 - x1 + 1 < DET_MIN && y2 - y1 + 1 < DET_MIN) continue;
      boxes.push({ x1: x1, y1: y1, x2: x2, y2: y2, score: sum / n });
    }
    return boxes.filter(function (b) { return b.score >= boxThresh; })
      .sort(function (a, b) { return a.y1 - b.y1 || a.x1 - b.x1; });
  }
  /* 덩어리를 원래 그림 좌표로 되돌리며 unclip(가장자리 글자가 잘리지 않게 넓힘) */
  function scaleBoxes(raw, dw, dh, width, height, unclip) {
    var sx = width / dw, sy = height / dh, out = [];
    raw.slice(0, DET_MAX_BOXES).forEach(function (rb) {
      var bw = rb.x2 - rb.x1 + 1, bh = rb.y2 - rb.y1 + 1, d = bw * bh * unclip / (2 * (bw + bh));
      var x1 = Math.max(0, Math.floor((rb.x1 - d) * sx)), y1 = Math.max(0, Math.floor((rb.y1 - d) * sy));
      var x2 = Math.min(width, Math.ceil((rb.x2 + 1 + d) * sx)), y2 = Math.min(height, Math.ceil((rb.y2 + 1 + d) * sy));
      if (x2 - x1 >= DET_MIN && y2 - y1 >= DET_MIN) out.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    });
    return out;
  }
  function lineCrop(rgba, pageW, b) {               // 높이 48 로 쌍선형 축소·확대 → RGB
    var rw = Math.min(REC_MAX_W, Math.max(16, Math.round(b.w * REC_H / b.h)));
    var rgb = new Uint8Array(rw * REC_H * 3), fx = b.w / rw, fy = b.h / REC_H;
    for (var dy = 0; dy < REC_H; dy++) {
      var sy = (dy + 0.5) * fy - 0.5; if (sy < 0) sy = 0;
      var y0 = Math.min(b.h - 1, Math.floor(sy)), y1 = Math.min(b.h - 1, y0 + 1), wy = sy - y0;
      for (var dx = 0; dx < rw; dx++) {
        var sx = (dx + 0.5) * fx - 0.5; if (sx < 0) sx = 0;
        var x0 = Math.min(b.w - 1, Math.floor(sx)), x1 = Math.min(b.w - 1, x0 + 1), wx = sx - x0;
        var i00 = ((b.y + y0) * pageW + b.x + x0) * 4, i01 = ((b.y + y0) * pageW + b.x + x1) * 4;
        var i10 = ((b.y + y1) * pageW + b.x + x0) * 4, i11 = ((b.y + y1) * pageW + b.x + x1) * 4, o = (dy * rw + dx) * 3;
        for (var c = 0; c < 3; c++) {
          var top = rgba[i00 + c] * (1 - wx) + rgba[i01 + c] * wx, bot = rgba[i10 + c] * (1 - wx) + rgba[i11 + c] * wx;
          rgb[o + c] = Math.round(top * (1 - wy) + bot * wy);
        }
      }
    }
    return { rgb: rgb, w: rw };
  }
  function recInput(crop) {                          // BGR, [-1,1], 폭은 320 이상으로 채움(0)
    var bw = Math.max(REC_MIN_W, crop.w), p = REC_H * bw, a = new Float32Array(3 * p);
    for (var y = 0; y < REC_H; y++) for (var x = 0; x < crop.w; x++) {
      var s = (y * crop.w + x) * 3, d = y * bw + x;
      a[d] = crop.rgb[s + 2] / 127.5 - 1; a[d + p] = crop.rgb[s + 1] / 127.5 - 1; a[d + 2 * p] = crop.rgb[s] / 127.5 - 1;
    }
    return { data: a, w: bw };
  }
  function ctcDecode(data, T_, C, dict) {
    var text = '', cs = 0, cn = 0, prev = -1;
    for (var t = 0; t < T_; t++) {
      var off = t * C, best = 0, bv = data[off];
      for (var c = 1; c < C; c++) { var v = data[off + c]; if (v > bv) { bv = v; best = c; } }
      var rep = best === prev; prev = best;
      if (best === 0 || rep) continue;
      var p = bv;
      if (p > 1.0001 || p < 0) { var den = 0; for (var k = 0; k < C; k++) den += Math.exp(data[off + k] - bv); p = 1 / den; }
      cs += p; cn++;
      if (best >= 1 && best <= dict.length) text += dict[best - 1]; else if (best === dict.length + 1) text += ' ';
    }
    return text ? { text: text, confidence: cn ? cs / cn : 0 } : null;
  }
  function restoreSymbols(s) {                       // 흔한 오인 — 한글 앞 O→○, Δ→△, 「1, 000」→「1,000」
    s = String(s).replace(/^([Oo])(\s?)(?=[가-힣])/, '○$2').replace(/[∆Δ]/g, '△').replace(/\(cid:\d*\)/g, '');
    return s.replace(/(^|[^\d,])(\d{1,3}(?:, ?\d{3})+)(?!\d)/g, function (m, a, b) { return a + b.replace(/, /g, ','); });
  }
  /* 줄로 모으기 — 세로 가운데가 서로 반 줄 안에 드는 것끼리 한 줄, 줄 안은 왼→오른 */
  function assemble(items) {
    var its = items.slice().sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x; }), lines = [];
    its.forEach(function (it) {
      var cy = it.y + it.h / 2, L = lines[lines.length - 1];
      if (L && Math.abs(cy - L.cy) <= Math.min(L.h, it.h) * 0.5) { L.items.push(it); L.cy = (L.cy * (L.items.length - 1) + cy) / L.items.length; }
      else lines.push({ cy: cy, h: it.h, items: [it] });
    });
    return lines.map(function (L) { return L.items.sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.text; }).join(' '); }).join('\n');
  }

  /* ── 브라우저 쪽: 실행기·모델 불러오기 ── */
  var _ready = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('OCR 실행기를 내려받지 못했습니다(인터넷 확인)')); }; document.head.appendChild(s);
    });
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function getModel(spec, onStat) {
    var open = (typeof caches !== 'undefined') ? caches.open(CACHE).catch(function () { return null; }) : Promise.resolve(null);
    return open.then(function (c) {
      return (c ? c.match(spec.url) : Promise.resolve(null)).then(function (hit) {
        if (hit) return hit.arrayBuffer();
        onStat && onStat('한국어 OCR 모델 내려받는 중… (최초 1회, 약 ' + Math.ceil(spec.mb) + 'MB)');
        return fetch(spec.url).then(function (r) {
          if (!r.ok) throw new Error('OCR 모델을 내려받지 못했습니다(' + r.status + ')');
          return r.arrayBuffer();
        }).then(function (buf) {
          return crypto.subtle.digest('SHA-256', buf).then(function (d) {
            if (hex(d) !== spec.sha) throw new Error('OCR 모델 지문이 맞지 않습니다 — 받지 않았습니다');
            if (c) c.put(spec.url, new Response(buf.slice(0))).catch(function () {});
            return buf;
          });
        });
      });
    });
  }
  function ready(onStat) {
    if (_ready) return _ready;
    _ready = (typeof ort !== 'undefined' ? Promise.resolve() : loadScript(ORT_BASE + 'ort.wasm.min.js')).then(function () {
      ort.env.wasm.wasmPaths = ORT_BASE;
      /* 여러 줄기 실행은 교차 출처 격리 때만 된다(GitHub Pages 는 아니다) — 안 되면 한 줄기 */
      ort.env.wasm.numThreads = (typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      return Promise.all([getModel(MODELS.det, onStat), getModel(MODELS.rec, onStat), getModel(MODELS.dict, onStat)]);
    }).then(function (b) {
      onStat && onStat('한국어 OCR 준비 중…');
      var opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      return Promise.all([ort.InferenceSession.create(new Uint8Array(b[0]), opt), ort.InferenceSession.create(new Uint8Array(b[1]), opt),
        new TextDecoder().decode(b[2])]);
    }).then(function (r) {
      var dict = parseDict(r[2]);
      if (!dict.length) throw new Error('OCR 글자 사전을 읽지 못했습니다');
      return { det: r[0], rec: r[1], dict: dict };
    });
    _ready.catch(function () { _ready = null; });         // 실패하면 다음에 다시 시도
    return _ready;
  }
  /* 캔버스 한 장 → 글(줄마다 \n) */
  function recognizeCanvas(E, cv) {
    var W = cv.width, H = cv.height;
    if (W < DET_MIN || H < DET_MIN) return Promise.resolve('');
    var rgba = cv.getContext('2d').getImageData(0, 0, W, H).data;
    var ratio = T.detLongSide / Math.max(W, H);
    var dw = Math.max(32, Math.round(W * ratio / 32) * 32), dh = Math.max(32, Math.round(H * ratio / 32) * 32);
    var sm = document.createElement('canvas'); sm.width = dw; sm.height = dh;
    var g = sm.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, dw, dh);
    var px = g.getImageData(0, 0, dw, dh).data, plane = dw * dh, inp = new Float32Array(3 * plane);
    for (var i = 0; i < plane; i++) {
      var r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
      inp[i] = (b - MEAN[0]) / STD[0]; inp[plane + i] = (gg - MEAN[1]) / STD[1]; inp[2 * plane + i] = (r - MEAN[2]) / STD[2];
    }
    var feed = {}; feed[E.det.inputNames[0]] = new ort.Tensor('float32', inp, [1, 3, dh, dw]);
    return E.det.run(feed).then(function (out) {
      var prob = out[E.det.outputNames[0]].data;
      var boxes = scaleBoxes(componentBoxes(prob, dw, dh, T.detThresh, T.detBoxThresh), dw, dh, W, H, T.detUnclip)
        .filter(function (bx) { var s = inkStats(grayCrop(rgba, W, bx)); return s.contrast >= T.minInkContrast && s.inkRatio >= MIN_INK; });
      var items = [];
      return boxes.reduce(function (p, bx) {
        return p.then(function () {
          var ri = recInput(lineCrop(rgba, W, bx)), f = {};
          f[E.rec.inputNames[0]] = new ort.Tensor('float32', ri.data, [1, 3, REC_H, ri.w]);
          return E.rec.run(f).then(function (o) {
            var lg = o[E.rec.outputNames[0]], d = lg.dims;
            var res = ctcDecode(lg.data, d[1], d[2], E.dict);
            if (res && res.confidence >= T.textScore) {
              var tx = restoreSymbols(res.text.trim());
              if (tx) items.push({ text: tx, x: bx.x, y: bx.y, w: bx.w, h: bx.h, conf: res.confidence });
            }
          });
        });
      }, Promise.resolve()).then(function () { return assemble(items); });
    });
  }
  /* 캔버스 여러 장 → 합친 글. onStat 은 앱 화면의 진행 안내 */
  function recognize(cvs, onStat) {
    return ready(onStat).then(function (E) {
      var texts = [];
      return cvs.reduce(function (p, cv, i) {
        return p.then(function () {
          onStat && onStat((i + 1) + '/' + cvs.length + '쪽 인식 중… (한국어 OCR)');
          return recognizeCanvas(E, cv).then(function (t) { texts.push(t); });
        });
      }, Promise.resolve()).then(function () { return texts.join('\n'); });
    });
  }

  var api = { ready: ready, recognize: recognize, MODELS: MODELS, ORT_VER: ORT_VER,
    _t: { parseDict: parseDict, inkStats: inkStats, grayCrop: grayCrop, componentBoxes: componentBoxes, scaleBoxes: scaleBoxes,
      lineCrop: lineCrop, recInput: recInput, ctcDecode: ctcDecode, restoreSymbols: restoreSymbols, assemble: assemble } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuOcrKr = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
