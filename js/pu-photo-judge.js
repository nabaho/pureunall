/* 푸른사진첩 — 기기 안 0원 자동 판단 엔진 (Jev-style System One: Choice · 확률% · 품질점수 · 지각해시)
   ① 사진 종류 자동 분류: 현장·회의 사진(scene) / 명함(card) / 서류·문서(doc) / 구분 보류(unsure) + 확률(%)
   ② 품질·연사(중복) 선별: 흔들림(선명도 0~100)·어두움·빛반사 판정 + 64비트 dHash 유사 묶기 + ★ 베스트 컷 추천
   ③ 고객사·업무 매칭: 촬영일 정부사업·컨설팅 일정 + 판독/메모 상호·사업자번호 + 내 폴더 단서 결합 추천

   ⚠ 바깥 서버로 한 바이트도 보내지 않는다(요금 0원, 개인정보 유출 0).
   ⚠ 스스로 지우거나 덮어쓰지 않는다 — 순수 계산만 돌려주고 실제 반영은 사람이 확인해 누른다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuPhotoJudge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var JUDGE_MAX_EDGE = 160;
  var BLUR_SHARP_MAX = 22;
  var DARK_BRIGHT_MAX = 48;
  var BURST_WINDOW_MS = 90 * 1000;
  var BURST_HAMMING_NEAR = 10;
  var BURST_HAMMING_SAME = 5;

  var CHOICE_LABEL = {
    card: '명함',
    doc: '서류·문서',
    scene: '현장·회의 사진',
    unsure: '구분 보류'
  };

  var QUALITY_LABEL = {
    ok: '양호',
    blur: '흔들림·흐림',
    dark: '어두움',
    glare: '빛반사·흐림'
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function softmax3(a, b, c) {
    var m = Math.max(a, b, c);
    var ea = Math.exp(a - m);
    var eb = Math.exp(b - m);
    var ec = Math.exp(c - m);
    var sum = ea + eb + ec || 1;
    return { card: ea / sum, doc: eb / sum, scene: ec / sum };
  }

  /* ══════ ① 사진 종류 자동 분류 (Jev Choice + Calibrated Probability) ══════ */
  function classify(rgba, w, h, origW, origH) {
    var fallback = {
      choice: 'unsure',
      prob: 0.5,
      pct: 50,
      label: CHOICE_LABEL.unsure,
      scores: { card: 0.33, doc: 0.34, scene: 0.33 }
    };
    if (!rgba || !(w >= 4) || !(h >= 4) || rgba.length < w * h * 4) return fallback;

    var total = w * h;
    var cx0 = Math.floor(w * 0.18), cx1 = Math.max(cx0 + 1, Math.ceil(w * 0.82));
    var cy0 = Math.floor(h * 0.20), cy1 = Math.max(cy0 + 1, Math.ceil(h * 0.80));
    var rx0 = Math.floor(w * 0.12), rx1 = Math.ceil(w * 0.88);
    var ry0 = Math.floor(h * 0.14), ry1 = Math.ceil(h * 0.86);

    var paperAll = 0, paperCenter = 0, paperRing = 0;
    var colorAll = 0, colorCenter = 0;
    var nCenter = 0, nRing = 0;
    var lumCenterSum = 0, lumRingSum = 0;
    var strokeAll = 0, strokeCenter = 0, paperStrokeCenter = 0;
    var pairsAll = h * (w - 1), pairsCenter = 0;

    for (var y = 0; y < h; y++) {
      var inCy = y >= cy0 && y < cy1;
      var inRy = y < ry0 || y >= ry1;
      var prevL = -1;
      var prevPaper = false;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        var lum = (r * 77 + g * 150 + b * 29) >> 8;
        var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        var sat = mx - mn;

        var isPaper = lum >= 178 && sat <= 38;
        var isBrightSheet = lum >= 165 && sat <= 46;
        var isColor = sat >= 44;

        if (isPaper) paperAll++;
        if (isColor) colorAll++;

        var inCenter = inCy && x >= cx0 && x < cx1;
        var inRing = inRy || x < rx0 || x >= rx1;

        if (inCenter) {
          nCenter++;
          lumCenterSum += lum;
          if (isPaper) paperCenter++;
          if (isColor) colorCenter++;
        }
        if (inRing) {
          nRing++;
          lumRingSum += lum;
          if (isPaper) paperRing++;
        }

        if (x > 0) {
          var jump = Math.abs(lum - prevL) >= 25;
          if (jump) strokeAll++;
          if (inCenter && x > cx0) {
            pairsCenter++;
            if (jump) {
              strokeCenter++;
              if (isBrightSheet || prevPaper) paperStrokeCenter++;
            }
          }
        }
        prevL = lum;
        prevPaper = isBrightSheet;
      }
    }

    var pAll = paperAll / total;
    var pCenter = nCenter ? paperCenter / nCenter : pAll;
    var pRing = nRing ? paperRing / nRing : pAll;
    var cAll = colorAll / total;
    var cCenter = nCenter ? colorCenter / nCenter : cAll;
    var sAll = pairsAll ? strokeAll / pairsAll : 0;
    var psCenter = pairsCenter ? paperStrokeCenter / pairsCenter : 0;

    var islandPaper = Math.max(0, pCenter - pRing);
    var lumCenter = nCenter ? lumCenterSum / nCenter : 128;
    var lumRing = nRing ? lumRingSum / nRing : 128;
    var islandLum = Math.max(0, (lumCenter - lumRing) / 255);

    var ow = Number(origW) > 0 ? Number(origW) : w;
    var oh = Number(origH) > 0 ? Number(origH) : h;
    var ratio = Math.max(ow, oh) / Math.max(1, Math.min(ow, oh));
    var isCardRatio = ratio >= 1.52 && ratio <= 1.95;
    var isLandscape = ow > oh * 1.15;
    var isPortraitDoc = oh >= ow * 1.12 && ratio >= 1.22 && ratio <= 1.62;

    /* 서류·문서(A4 계약서·사업자등록증·신청서 등): 종이 면적이 넓고 글자 획이 촘촘함 */
    var docLogit =
      (pAll * 4.4) +
      (psCenter * 11.5) +
      (sAll * 2.5) +
      (isPortraitDoc ? 0.85 : 0) -
      (cAll * 4.2) -
      (islandPaper * 2.2) -
      1.65;

    /* 명함(책상 위 명함 섬 또는 가로 비율 명함 근접 촬영): 가운데 밝은 종이 + 적당한 글자 획 */
    var cardIsland = (islandPaper >= 0.24 && pCenter >= 0.34 && psCenter >= 0.025)
      ? (islandPaper * 4.8 + islandLum * 2.4 + 1.1)
      : 0;
    var cardCropped = (pAll >= 0.48 && psCenter >= 0.02 && psCenter <= 0.22 && isCardRatio && isLandscape)
      ? 2.15
      : (isCardRatio && pCenter >= 0.42 && psCenter >= 0.025 ? 0.95 : 0);
    var cardLogit =
      cardIsland +
      cardCropped +
      (pCenter * 1.8) +
      (psCenter >= 0.02 && psCenter <= 0.24 ? 1.05 : -0.6) -
      (cCenter * 3.4) -
      (isPortraitDoc && pRing >= 0.55 ? 1.5 : 0) -
      1.55;

    /* 현장·회의·일반 사진: 색채가 풍부하거나 종이+글자 획 조합이 없음 */
    var noPaperText = (psCenter < 0.018) ? 1.75 : (-psCenter * 7.5);
    var sceneLogit =
      (cAll * 5.0) +
      (cCenter * 1.6) +
      ((1 - pAll) * 2.5) +
      noPaperText -
      (pAll * 2.4) -
      (cardIsland * 0.7) -
      0.85;

    var scores = softmax3(cardLogit, docLogit, sceneLogit);
    var bestKey = 'doc';
    var bestProb = scores.doc;
    if (scores.card > bestProb) { bestKey = 'card'; bestProb = scores.card; }
    if (scores.scene > bestProb) { bestKey = 'scene'; bestProb = scores.scene; }

    var choice = bestProb >= 0.54 ? bestKey : 'unsure';
    var pct = Math.round(bestProb * 100);
    return {
      choice: choice,
      topChoice: bestKey,
      prob: Math.round(bestProb * 1000) / 1000,
      pct: pct,
      label: CHOICE_LABEL[choice] || CHOICE_LABEL.unsure,
      scores: {
        card: Math.round(scores.card * 1000) / 1000,
        doc: Math.round(scores.doc * 1000) / 1000,
        scene: Math.round(scores.scene * 1000) / 1000
      }
    };
  }

  /* ══════ ② 품질(흔들림·어두움·빛반사) 점수 & 64비트 dHash 연사 선별 ══════ */
  function assessQuality(rgba, w, h) {
    if (!rgba || !(w >= 4) || !(h >= 4) || rgba.length < w * h * 4) {
      return { sharp: 0, bright: 0, glare: 0, quality: 'blur', label: QUALITY_LABEL.blur };
    }
    var total = w * h;
    var lum = new Uint8Array(total);
    var sumL = 0, glarePix = 0;

    for (var i = 0, p = 0; i < total; i++, p += 4) {
      var r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      var l = (r * 77 + g * 150 + b * 29) >> 8;
      lum[i] = l;
      sumL += l;
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      if (l >= 250 && (mx - mn) <= 10) glarePix++;
    }

    /* 여백이 넓은 서류도 글자 획 자체의 또렷함으로 잴 수 있도록 상위 10% 윤곽 에너지를 구한다 */
    var hist = new Uint32Array(256);
    var innerN = 0;
    for (var y = 1; y < h - 1; y++) {
      var row = y * w;
      for (var x = 1; x < w - 1; x++) {
        var idx = row + x;
        var c = lum[idx];
        var lap = Math.abs(4 * c - lum[idx - 1] - lum[idx + 1] - lum[idx - w] - lum[idx + w]);
        if (lap > 255) lap = 255;
        hist[lap]++;
        innerN++;
      }
    }

    var topTarget = Math.max(1, Math.ceil(innerN * 0.10));
    var rem = topTarget, edgeSum = 0;
    for (var bin = 255; bin >= 0 && rem > 0; bin--) {
      var cnt = hist[bin];
      if (!cnt) continue;
      var take = cnt < rem ? cnt : rem;
      edgeSum += take * bin;
      rem -= take;
    }
    var top10Mean = edgeSum / topTarget;
    var sharp = clamp(Math.round(top10Mean * 0.65), 0, 100);
    var bright = clamp(Math.round(sumL / total), 0, 255);
    var glare = Math.round((glarePix / total) * 1000) / 1000;

    var quality = 'ok';
    if (bright < DARK_BRIGHT_MAX) quality = 'dark';
    else if (glare >= 0.55 && sharp < BLUR_SHARP_MAX) quality = 'glare';
    else if (sharp < BLUR_SHARP_MAX) quality = 'blur';

    return {
      sharp: sharp,
      bright: bright,
      glare: glare,
      quality: quality,
      label: QUALITY_LABEL[quality] || QUALITY_LABEL.ok
    };
  }

  /* 9×8 평균 밝기 격자 → 가로 이웃 비교 64비트 지각 해시 (16자리 16진수) */
  function dhash(rgba, w, h) {
    if (!rgba || !(w >= 2) || !(h >= 2) || rgba.length < w * h * 4) return '';
    var cols = 9, rows = 8;
    var grid = new Float64Array(cols * rows);
    for (var gy = 0; gy < rows; gy++) {
      var y0 = Math.floor((gy * h) / rows);
      var y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / rows));
      for (var gx = 0; gx < cols; gx++) {
        var x0 = Math.floor((gx * w) / cols);
        var x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / cols));
        var sum = 0, cnt = 0;
        for (var y = y0; y < y1 && y < h; y++) {
          for (var x = x0; x < x1 && x < w; x++) {
            var p = (y * w + x) * 4;
            sum += (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
            cnt++;
          }
        }
        grid[gy * cols + gx] = cnt ? sum / cnt : 0;
      }
    }
    var hex = '';
    for (var r = 0; r < rows; r++) {
      var byteVal = 0;
      for (var c = 0; c < 8; c++) {
        byteVal = (byteVal << 1) | (grid[r * cols + c] < grid[r * cols + c + 1] ? 1 : 0);
      }
      var s = byteVal.toString(16);
      hex += s.length < 2 ? '0' + s : s;
    }
    return hex;
  }

  var POP4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  function hamming(a, b) {
    var sa = String(a || ''), sb = String(b || '');
    if (sa.length !== 16 || sb.length !== 16) return Infinity;
    var dist = 0;
    for (var i = 0; i < 16; i++) {
      var va = parseInt(sa.charAt(i), 16);
      var vb = parseInt(sb.charAt(i), 16);
      if (isNaN(va) || isNaN(vb)) return Infinity;
      dist += POP4[va ^ vb];
    }
    return dist;
  }

  function localDay(ts) {
    var n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '';
    var d = new Date(n);
    var p = function (v) { return v < 10 ? '0' + v : String(v); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function isUsedMeta(m) {
    return !!(m && m.used && m.used.at);
  }

  function isFiledMeta(m) {
    var r = m && m.read;
    if (!r) return false;
    return !!((r.filed && r.filed.at) || (r.filedCo && r.filedCo.at) ||
              (r.filedInfo && r.filedInfo.at) || (r.filedWk && r.filedWk.at));
  }

  function itemJudgeOf(it, judgeMap) {
    if (judgeMap && it && judgeMap[it.id]) return judgeMap[it.id];
    var m = (it && it.meta) || {};
    var mj = m.judge;
    if (mj && mj.h) {
      return {
        choice: mj.c || 'unsure',
        prob: (Number(mj.p) || 50) / 100,
        pct: Number(mj.p) || 50,
        sharp: typeof mj.s === 'number' ? mj.s : (typeof m.sharp === 'number' ? m.sharp : 50),
        bright: typeof mj.b === 'number' ? mj.b : 140,
        quality: mj.q || 'ok',
        dhash: mj.h
      };
    }
    return null;
  }

  function rankShotScore(it, j) {
    var m = (it && it.meta) || {};
    var score = 0;
    if (isUsedMeta(m)) score += 100000;
    if (isFiledMeta(m)) score += 10000;
    if (m.company || (m.read && m.read.fields && (m.read.fields.company || m.read.fields.name))) score += 500;
    var sharp = j && typeof j.sharp === 'number' ? j.sharp : (typeof m.sharp === 'number' ? m.sharp : 50);
    var bright = j && typeof j.bright === 'number' ? j.bright : 140;
    var q = (j && j.quality) || 'ok';
    score += sharp * 2;
    if (q !== 'ok') score -= 40;
    score -= Math.abs(bright - 145) * 0.15;
    return score;
  }

  /* 연사·유사 사진 묶기 — ★ 베스트 컷 1장 + 여벌(extras) 분리.
     ⚠ 여러 쪽짜리 한 문서(meta.doc.group)의 형제 쪽은 절대 중복 연사로 묶지 않는다.
     ⚠ 증빙으로 쓴 사진(meta.used.at)은 절대 여벌(extras)에 넣지 않는다. */
  function groupBursts(items, judgeMap, opts) {
    var list = Array.isArray(items) ? items : [];
    var o = opts || {};
    var winMs = typeof o.windowMs === 'number' ? o.windowMs : BURST_WINDOW_MS;
    var nearDist = typeof o.maxDist === 'number' ? o.maxDist : BURST_HAMMING_NEAR;
    var sameDist = typeof o.sameDayDist === 'number' ? o.sameDayDist : BURST_HAMMING_SAME;

    var nodes = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || !it.id) continue;
      var m = it.meta || {};
      var j = itemJudgeOf(it, judgeMap);
      if (!j || !j.dhash || j.dhash.length !== 16) continue;
      var ts = Number(m.takenAt || m.upAt || 0);
      var owner = String(it.owner || m.__ownerUid || m.by || '');
      var docGroup = (m.doc && m.doc.group) ? String(m.doc.group) : '';
      nodes.push({ it: it, m: m, j: j, ts: ts, day: localDay(ts), owner: owner, docGroup: docGroup });
    }

    /* 주인+날짜별로 갈라 O(n²) 폭발을 막고, 최고 품질(★ 베스트) 기준 직접 비교(성형 묶기)로
       A~B · B~C 가 비슷하다고 멀리 떨어진 A~C 까지 전이적으로 엮이는 일을 차단한다. */
    var dayBuckets = {};
    for (var idx = 0; idx < nodes.length; idx++) {
      var nd = nodes[idx];
      /* 같은 다중 쪽 문서의 1쪽·2쪽 등 문서 묶음에 속한 쪽은 연사에서 아예 뺀다 */
      if (nd.docGroup) continue;
      var bk = nd.owner + '|' + (nd.day || ('ts_' + Math.floor((nd.ts || 0) / Math.max(1, winMs))));
      if (!dayBuckets[bk]) dayBuckets[bk] = [];
      dayBuckets[bk].push(nd);
    }

    function isDirectBurstPair(na, nb) {
      if (na.owner !== nb.owner) return false;
      var dist = hamming(na.j.dhash, nb.j.dhash);
      if (!Number.isFinite(dist)) return false;
      var dt = (na.ts > 0 && nb.ts > 0) ? Math.abs(na.ts - nb.ts) : Infinity;
      var sameDay = !!(na.day && na.day === nb.day);
      return (dt <= winMs && dist <= nearDist) || (sameDay && dist <= sameDist);
    }

    var groups = [];
    Object.keys(dayBuckets).forEach(function (bk) {
      var arr = dayBuckets[bk];
      if (arr.length < 2) return;
      /* 가장 점수가 높은(증빙·기업연결·선명도 순) 후보부터 닻(anchor)으로 삼는다 */
      arr.sort(function (x, y) {
        var sx = rankShotScore(x.it, x.j);
        var sy = rankShotScore(y.it, y.j);
        if (sy !== sx) return sy - sx;
        return (x.ts || 0) - (y.ts || 0);
      });
      var claimed = new Uint8Array(arr.length);
      for (var a = 0; a < arr.length; a++) {
        if (claimed[a]) continue;
        var anchor = arr[a];
        var grp = [anchor];
        for (var b = a + 1; b < arr.length; b++) {
          if (claimed[b]) continue;
          if (isDirectBurstPair(anchor, arr[b])) {
            grp.push(arr[b]);
            claimed[b] = 1;
          }
        }
        if (grp.length < 2) continue;
        claimed[a] = 1;
        var usedCnt = grp.filter(function (nd2) { return isUsedMeta(nd2.m); }).length;
        var bestNode = grp[0];
        if (usedCnt >= 2) {
          groups.push({
            best: bestNode.it,
            bestSharp: bestNode.j.sharp,
            members: grp.map(function (nd2) { return nd2.it; }),
            extras: [],
            skip: '증빙으로 쓴 사진이 ' + usedCnt + '장 들어 있어 건너뜁니다'
          });
          continue;
        }
        var extras = [];
        for (var g = 1; g < grp.length; g++) {
          if (!isUsedMeta(grp[g].m)) extras.push(grp[g].it);
        }
        groups.push({
          best: bestNode.it,
          bestSharp: bestNode.j.sharp,
          members: grp.map(function (nd2) { return nd2.it; }),
          extras: extras,
          skip: ''
        });
      }
    });

    groups.sort(function (a, b) {
      var ta = (a.best && a.best.meta && (a.best.meta.upAt || a.best.meta.takenAt)) || 0;
      var tb = (b.best && b.best.meta && (b.best.meta.upAt || b.best.meta.takenAt)) || 0;
      return tb - ta;
    });
    return groups;
  }

  /* ══════ ③ 고객사·정부사업 일정·폴더 자동 매칭 (Jev Ranked Target Recommendation) ══════ */
  function normCoKey(v) {
    return String(v == null ? '' : v)
      .replace(/\(주\)|\(유\)|\(사\)|\(재\)|주식회사|유한회사|유한책임회사|사단법인|재단법인|㈜|㈲/g, '')
      .replace(/[\s\-_·.,()[\]{}]/g, '')
      .toLowerCase();
  }

  function normBizDigits(v) {
    var d = String(v == null ? '' : v).replace(/\D+/g, '');
    return d.length >= 10 ? d.slice(0, 10) : '';
  }

  /* pu-photo-store.js 의 SENSITIVE_KINDS 10종과 동일하게 맞춘다 —
     민감 서류나 주민번호(rrn) 포함 사진은 자동 공유 대상(shareUids)에서 항상 뺀다. */
  var SENSITIVE_READ_KINDS = {
    contract: 1, wcontract: 1, timesheet: 1, payslip: 1, cms: 1,
    bankbook: 1, idcard: 1, resident: 1, mandate: 1, consent: 1
  };

  function isSensitiveReadMeta(r) {
    if (!r) return false;
    if (r.rrn) return true;
    return !!SENSITIVE_READ_KINDS[String(r.kind || '')];
  }

  function recommendTargets(item, judge, ctx) {
    var it = item || {};
    var m = it.meta || {};
    var r = m.read || {};
    var f = r.fields || {};
    var c = ctx || {};
    var owner = String(it.owner || m.__ownerUid || m.by || c.meUid || '');
    var hadShare = m.shareWith || {};
    var sensitive = isSensitiveReadMeta(r);

    var folderByKey = {};
    var folderList = [];
    var rawFolders = c.folders || {};
    Object.keys(rawFolders).forEach(function (fid) {
      var fo = rawFolders[fid];
      if (!fo || !fo.name) return;
      var k = normCoKey(fo.name);
      if (!k) return;
      folderByKey[k] = { id: fid, name: fo.name };
      folderList.push({ id: fid, name: fo.name, key: k });
    });

    var cands = {};
    function putCand(name, prob, why, extra) {
      var clean = String(name || '').trim();
      var baseKey = normCoKey(clean);
      if (!baseKey || baseKey.length < 2) return;
      var ex = extra || {};
      var slotKey = ex.groupKey || baseKey;
      var safeShares = sensitive ? [] : (ex.shareUids || []).slice();
      var cur = cands[slotKey];
      if (!cur) {
        var fHit = folderByKey[baseKey] || null;
        cands[slotKey] = {
          key: baseKey,
          groupKey: slotKey,
          name: clean,
          prob: prob,
          whys: [why],
          type: ex.type || 'client',
          folderId: ex.folderId || (fHit ? fHit.id : ''),
          folderName: ex.folderName || (fHit ? fHit.name : clean),
          shareUids: safeShares,
          shareWhy: safeShares.length ? (ex.shareWhy || '') : ''
        };
        return;
      }
      /* 단서가 두 갈래(예: 촬영일 일정 + 메모 상호)에서 겹치면 확률을 합산 보강한다 */
      var boosted = 1 - (1 - cur.prob) * (1 - prob * 0.55);
      cur.prob = Math.max(cur.prob, prob, Math.min(0.98, boosted));
      if (why && cur.whys.indexOf(why) < 0) cur.whys.push(why);
      if (ex.folderId && !cur.folderId) {
        cur.folderId = ex.folderId;
        cur.folderName = ex.folderName || cur.folderName;
      }
      if (safeShares.length) {
        safeShares.forEach(function (u) {
          if (u && cur.shareUids.indexOf(u) < 0) cur.shareUids.push(u);
        });
        if (ex.shareWhy && !cur.shareWhy) cur.shareWhy = ex.shareWhy;
      }
    }

    var metaCo = String(m.company || '').trim();
    var ocrCo = String(f.company || '').trim();
    var bizNo = normBizDigits(f.bizNo || f.bizno);
    var freeText = normCoKey([
      m.note || '',
      (m.doc && m.doc.name) || '',
      f.docName || '',
      f.title || '',
      f.summary || ''
    ].join(' '));

    /* 1) 업체관리(ERP) 명부와 사업자번호·상호·메모 대조
       ⚠ 같은 정규화 상호를 가진 서로 다른 법인·지점이 둘 이상이면 사업자번호 없이는
         담당자 자동 공유를 열지 않는다(동명 타 업체 유출 차단). */
    var clientRows = Array.isArray(c.clients) ? c.clients : [];
    var nameFreq = {};
    for (var nfi = 0; nfi < clientRows.length; nfi++) {
      var ncl = clientRows[nfi];
      if (!ncl || !ncl.name) continue;
      var nk = normCoKey(ncl.name);
      if (nk) nameFreq[nk] = (nameFreq[nk] || 0) + 1;
    }
    var uidBySid = c.uidBySid || {};
    function mgrUidsOf(cl) {
      if (sensitive) return [];
      var out = [];
      var sids = (cl && cl.mgrSids) || [];
      for (var i = 0; i < sids.length; i++) {
        var u = uidBySid[sids[i]];
        if (u && u !== owner && !hadShare[u] && out.indexOf(u) < 0) out.push(u);
      }
      return out;
    }

    for (var ci = 0; ci < clientRows.length; ci++) {
      var cl = clientRows[ci];
      if (!cl || !cl.name) continue;
      var clKey = normCoKey(cl.name);
      if (!clKey || clKey.length < 2) continue;
      var clBiz = normBizDigits(cl.bizNo);
      var dupName = (nameFreq[clKey] || 0) > 1;
      var distinctGroupKey = dupName ? (clKey + '#' + String(cl.id || clBiz || ci)) : clKey;
      var mUids = mgrUidsOf(cl);
      var sWhy = cl.name + ' 담당';

      if (bizNo && clBiz && bizNo === clBiz) {
        putCand(cl.name, 0.97, '사업자번호 일치', {
          type: 'client', groupKey: distinctGroupKey, shareUids: mUids, shareWhy: sWhy
        });
      } else if ((metaCo && normCoKey(metaCo) === clKey) || (ocrCo && normCoKey(ocrCo) === clKey)) {
        if (dupName && bizNo && clBiz && bizNo !== clBiz) continue;
        putCand(cl.name, dupName ? 0.88 : 0.95, (metaCo ? '입력 상호 일치' : '판독 상호 일치'), {
          type: 'client',
          groupKey: clKey,
          shareUids: dupName ? [] : mUids,
          shareWhy: dupName ? '' : sWhy
        });
      } else if (clKey.length >= 2 && freeText && freeText.indexOf(clKey) >= 0) {
        putCand(cl.name, dupName ? 0.82 : 0.87, '메모·문서명 포함', {
          type: 'client',
          groupKey: clKey,
          shareUids: dupName ? [] : mUids,
          shareWhy: dupName ? '' : sWhy
        });
      }
    }

    /* 판독 상호나 입력 상호가 ERP 명부에 아직 없더라도 폴더 추천 후보로는 살린다 */
    function hasBaseKey(bk) {
      return Object.keys(cands).some(function (ck) { return cands[ck] && cands[ck].key === bk; });
    }
    if (ocrCo && normCoKey(ocrCo).length >= 2 && !hasBaseKey(normCoKey(ocrCo))) {
      putCand(ocrCo, 0.90, '판독 상호', { type: 'ocr' });
    }
    if (metaCo && normCoKey(metaCo).length >= 2 && !hasBaseKey(normCoKey(metaCo))) {
      putCand(metaCo, 0.93, '지정 업체', { type: 'ocr' });
    }

    /* 2) 촬영일(takenAt) 정부사업·컨설팅 일정 대조 */
    var gov = c.gov;
    var day = localDay(m.takenAt);
    if (gov && day && owner && gov.staffOf && gov.staffOf[owner]) {
      var myStaff = gov.staffOf[owner];
      var dayScheds = (gov.scheds || []).filter(function (s) {
        return s && s.date === day &&
          (s.attId === myStaff || (s.coAttIds || []).indexOf(myStaff) >= 0);
      });
      if (dayScheds.length) {
        var byCo = {};
        dayScheds.forEach(function (s) {
          var coNm = (gov.coName && gov.coName[s.coId]) || '';
          if (!coNm) return;
          if (!byCo[coNm]) byCo[coNm] = [];
          [s.attId].concat(s.coAttIds || []).forEach(function (aid) {
            if (!aid || aid === myStaff) return;
            var u = gov.uidOf && gov.uidOf[aid];
            if (u && u !== owner && !hadShare[u] && byCo[coNm].indexOf(u) < 0) byCo[coNm].push(u);
          });
        });
        var coNames = Object.keys(byCo);
        var parts = day.split('-');
        var mdLabel = (+parts[1]) + '/' + (+parts[2]);
        var isSceneLike = (judge && judge.choice === 'scene') || r.kind === 'meeting' || m.kind === 'photo';
        var baseProb = coNames.length === 1 ? 0.90 : (coNames.length === 2 ? 0.68 : 0.50);
        if (isSceneLike) baseProb = Math.min(0.95, baseProb + 0.04);

        coNames.forEach(function (coNm) {
          var whyTxt = coNames.length === 1
            ? ('촬영일(' + mdLabel + ') 방문·회의 일정')
            : ('촬영일(' + mdLabel + ') 일정 ' + coNames.length + '곳 중 하나');
          putCand(coNm, baseProb, whyTxt, {
            type: 'gov',
            shareUids: byCo[coNm],
            shareWhy: coNm + ' ' + mdLabel + ' 일정 담당'
          });
        });
      }
    }

    /* 3) 내 폴더 이름이 메모·상호·문서명에 들어 있는 경우 */
    for (var fi = 0; fi < folderList.length; fi++) {
      var fo2 = folderList[fi];
      if (fo2.key.length < 2) continue;
      if ((ocrCo && normCoKey(ocrCo).indexOf(fo2.key) >= 0) ||
          (metaCo && normCoKey(metaCo).indexOf(fo2.key) >= 0) ||
          (freeText && freeText.indexOf(fo2.key) >= 0)) {
        putCand(fo2.name, 0.86, '내 폴더 이름 일치', {
          type: 'folder',
          folderId: fo2.id,
          folderName: fo2.name
        });
      }
    }

    var out = Object.keys(cands).map(function (k) {
      var x = cands[k];
      var needFolder = !m.folder || (x.folderId ? m.folder !== x.folderId : true);
      var needCo = !metaCo || normCoKey(metaCo) !== x.key;
      var needShare = x.shareUids.length > 0;
      return {
        name: x.name,
        groupKey: x.groupKey || x.key,
        type: x.type,
        prob: Math.round(x.prob * 1000) / 1000,
        pct: Math.round(x.prob * 100),
        why: x.whys.join(' · '),
        folderId: x.folderId || '',
        folderName: x.folderName || x.name,
        needFolder: needFolder,
        needCo: needCo,
        shareUids: x.shareUids,
        shareWhy: x.shareWhy,
        actionable: needFolder || needCo || needShare
      };
    }).filter(function (x) {
      return x.prob >= 0.48;
    });

    out.sort(function (a, b) { return b.prob - a.prob; });
    return out.slice(0, 3);
  }

  /* 픽셀 버퍼 한 번으로 ① 분류 + ② 품질 + 지각해시를 한꺼번에 계산 */
  function analyzePixels(rgba, w, h, origW, origH) {
    var cls = classify(rgba, w, h, origW, origH);
    var q = assessQuality(rgba, w, h);
    var hash = dhash(rgba, w, h);
    return {
      choice: cls.choice,
      topChoice: cls.topChoice,
      prob: cls.prob,
      pct: cls.pct,
      label: cls.label,
      scores: cls.scores,
      sharp: q.sharp,
      bright: q.bright,
      glare: q.glare,
      quality: q.quality,
      qualityLabel: q.label,
      dhash: hash
    };
  }

  /* 브라우저 그림 주소(data: / blob: / https:) → 160px 캔버스에서 5~10ms 안에 자동 판단 */
  function judgeImage(src) {
    if (!src || typeof document === 'undefined' || typeof Image === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      var timer = setTimeout(function () { finish(null); }, 4000);
      var img = new Image();
      if (/^https?:/i.test(String(src))) img.crossOrigin = 'anonymous';
      img.onload = function () {
        clearTimeout(timer);
        try {
          var ow = img.naturalWidth || img.width || JUDGE_MAX_EDGE;
          var oh = img.naturalHeight || img.height || JUDGE_MAX_EDGE;
          var scale = Math.min(1, JUDGE_MAX_EDGE / Math.max(ow, oh, 1));
          var cw = Math.max(16, Math.round(ow * scale));
          var ch = Math.max(16, Math.round(oh * scale));
          var c = document.createElement('canvas');
          c.width = cw;
          c.height = ch;
          var ctx2d = c.getContext('2d', { willReadFrequently: true });
          ctx2d.drawImage(img, 0, 0, cw, ch);
          var rgba = ctx2d.getImageData(0, 0, cw, ch).data;
          var res = analyzePixels(rgba, cw, ch, ow, oh);
          res.origW = ow;
          res.origH = oh;
          finish(res);
        } catch (_) {
          finish(null);
        }
      };
      img.onerror = function () { clearTimeout(timer); finish(null); };
      img.src = src;
    });
  }

  /* meta.judge 에 저장할 가벼운 요약(약 45바이트) */
  function packMetaJudge(j) {
    if (!j || !j.dhash) return null;
    return {
      c: j.choice || 'unsure',
      p: typeof j.pct === 'number' ? j.pct : Math.round((j.prob || 0.5) * 100),
      s: typeof j.sharp === 'number' ? j.sharp : 50,
      b: typeof j.bright === 'number' ? j.bright : 140,
      q: j.quality || 'ok',
      h: j.dhash
    };
  }

  function unpackMetaJudge(mj) {
    if (!mj || !mj.h) return null;
    var choice = mj.c || 'unsure';
    var pct = typeof mj.p === 'number' ? mj.p : 50;
    var quality = mj.q || 'ok';
    return {
      choice: choice,
      topChoice: choice,
      prob: pct / 100,
      pct: pct,
      label: CHOICE_LABEL[choice] || CHOICE_LABEL.unsure,
      sharp: typeof mj.s === 'number' ? mj.s : 50,
      bright: typeof mj.b === 'number' ? mj.b : 140,
      quality: quality,
      qualityLabel: QUALITY_LABEL[quality] || QUALITY_LABEL.ok,
      dhash: mj.h
    };
  }

  return {
    JUDGE_MAX_EDGE: JUDGE_MAX_EDGE,
    BLUR_SHARP_MAX: BLUR_SHARP_MAX,
    DARK_BRIGHT_MAX: DARK_BRIGHT_MAX,
    CHOICE_LABEL: CHOICE_LABEL,
    QUALITY_LABEL: QUALITY_LABEL,
    classify: classify,
    assessQuality: assessQuality,
    dhash: dhash,
    hamming: hamming,
    groupBursts: groupBursts,
    recommendTargets: recommendTargets,
    analyzePixels: analyzePixels,
    judgeImage: judgeImage,
    packMetaJudge: packMetaJudge,
    unpackMetaJudge: unpackMetaJudge,
    normCoKey: normCoKey,
    SENSITIVE_READ_KINDS: SENSITIVE_READ_KINDS,
    isSensitiveReadMeta: isSensitiveReadMeta
  };
});
