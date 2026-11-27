/* ══════════════════════════════════════════════════════════════════════
   가벼운 3D·2D 그림 엔진 — js/pu-3d-lite.js (2026-11-21)
   데이터관리(pu-datahub.html) 목업(제미나이 다시 디자인 판)의 엔진을 그대로 떼어 냈다(계획서 결정 ⑦ «자작 가벼운 엔진»).

   ★ 바깥 라이브러리·CDN 없이 캔버스만 쓴다(대표 전용 돈 자료 화면에 남의 서버 스크립트를 싣지 않는다).
   ★ 자료를 모르는 «그리는 틀»이다 — 막대·구슬·면·선·이름표를 받아 그리고, 누르면 알려 줄 뿐이다.
   ★ 움직임 줄이기 설정(prefers-reduced-motion)이면 자라기·돌기·흐름을 멈춘다.

   쓰는 법
     var L3 = window.Pu3DLite;
     var sc = new L3.Scene(canvas, {dist:33, target:[0,1,0], yaw:-0.46, pitch:0.54, onPick:fn, onHover:fn});
     sc.items.push({type:'box', id, x, z, w, d, y0, h, color, tip}); sc.dirty = true;
     var ch = new L3.Chart2D(canvas, function(c, g){ ... c.hits.push({id, rect:[x,y,w,h], tip}) ... });
     L3.start();   // 한 번만 — 보이는 그림만 다시 그린다
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var ST = {
    dark: true,          /* 시네마 무대(어두운 무대) */
    cine: false,         /* 영상 브리핑 중이면 무대 빛이 계속 흐른다 */
    reduce: !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches)
  };

  /* ── 작은 도구 ── */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function hex2rgb(h) { h = String(h || '#64748b').replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; }
  function shade(c, k) { return k >= 0 ? c.map(function (v) { return v + (255 - v) * k; }) : c.map(function (v) { return v * (1 + k); }); }
  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function inPoly(x, y, P) { var c = false; for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var a = P[i], b = P[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) c = !c; } return c; }
  /* 색칸 위 작은 숫자 — 칸 색이 무엇이든 4.5:1 을 넘기게 흰 글자에 짙은 테두리를 두른다 */
  function haloText(g, t, x, y) { g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,41,59,.9)'; g.strokeText(t, x, y); g.fillStyle = '#ffffff'; g.fillText(t, x, y); }
  function sampleSmooth1D(arr, u) {
    var i = Math.floor(u), f = u - i;
    var a = arr[clamp(i, 0, arr.length - 1)] || 0, b = arr[clamp(i + 1, 0, arr.length - 1)] || 0;
    var mu = (1 - Math.cos(f * Math.PI)) * 0.5;
    return a * (1 - mu) + b * mu;
  }
  function smoothPts3D(pts, sub) {
    if (pts.length < 3) return pts;
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var s = 0; s < sub; s++) {
        var t = s / sub, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map(function (k) {
          return 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        }));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function strokeSpline2D(g, pts, col, lw, glowCol, dashed) {
    if (!pts || pts.length < 2) return;
    function pathSpline() {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 2) { g.lineTo(pts[1][0], pts[1][1]); return; }
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        var cp1x = p1[0] + (p2[0] - p0[0]) / 6, cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        var cp2x = p2[0] - (p3[0] - p1[0]) / 6, cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
    }
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (glowCol && !dashed) { g.strokeStyle = glowCol; g.lineWidth = (lw || 2.2) + 5; pathSpline(); g.stroke(); }
    if (dashed) g.setLineDash(dashed);
    g.strokeStyle = col; g.lineWidth = lw || 2.4;
    pathSpline(); g.stroke();
    g.restore();
  }

  /* ── 풍선 도움말 — 자리 하나를 모두 함께 쓴다. 넣는 글은 부르는 쪽이 이미 이스케이프한 것이다 ── */
  var tipEl = null;
  function tip() {
    if (tipEl) return tipEl;
    tipEl = document.getElementById('tip');
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.id = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    return tipEl;
  }
  /* 툴팁 글 — 부르는 쪽이 이름을 이스케이프해 주지만, 한 겹 더: <b>·<br> 말고는 모두 «글자»로 바꾸고 속성은 걷는다.
     template 안은 스크립트도 그림도 안 돈다(보안 검토 2026-11-21 «낮음»). */
  function safeTip(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html == null ? '' : html);
    (function clean(n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          if (c.tagName !== 'B' && c.tagName !== 'BR') { n.replaceChild(document.createTextNode(c.textContent || ''), c); return; }
          while (c.attributes.length) c.removeAttribute(c.attributes[0].name);
          clean(c);
        } else if (c.nodeType !== 3) n.removeChild(c);
      });
    })(tpl.content);
    return tpl.content;
  }
  function showTip(html, x, y) {
    var t = tip(); t.textContent = ''; t.appendChild(safeTip(html)); t.style.display = 'block';
    var w = t.offsetWidth, h = t.offsetHeight, L = x + 14, T = y + 14;
    if (L + w > global.innerWidth - 6) L = x - w - 14;
    if (T + h > global.innerHeight - 6) T = y - h - 14;
    t.style.left = Math.max(6, L) + 'px'; t.style.top = Math.max(6, T) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
  function tipShown() { return !!(tipEl && tipEl.style.display === 'block'); }

  var SCENES = [], CHARTS2D = [];
  var LIGHT = (function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })([-0.42, 0.84, -0.38]);
  var STARS = (function () {
    var seed = 7788, arr = [];
    function r() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 32; i++) arr.push({ u: r(), v: r() * 0.72, r: 0.7 + r() * 1.3, ph: r() * 6.28 });
    return arr;
  })();

  /* ══ 3D 무대 ══ */
  function Scene(cv, o) {
    o = o || {};
    this.cv = cv; this.g = cv.getContext('2d');
    this.yaw = o.yaw != null ? o.yaw : -0.48; this.pitch = o.pitch != null ? o.pitch : 0.54; this.dist = o.dist || 31;
    this.tYaw = this.yaw; this.tPitch = this.pitch; this.tDist = this.dist;
    this.vYaw = 0; this.vPitch = 0;
    this.minD = this.dist * 0.45; this.maxD = this.dist * 2.2; this.target = o.target || [0, 1.4, 0]; this.zoom = o.zoom || 1;
    this.home = [this.yaw, this.pitch, this.dist];
    this.items = []; this.under = []; this.over = []; this.labels = [];
    this.prevHeights = {};
    this.grow = 1; this.growT0 = null; this.growMs = 760; this.auto = !!o.auto; this.visible = false; this.grown = false;
    this.w = 0; this.h = 0; this.hits = []; this.hot = null; this.pin = null; this.dirty = true; this.dragging = false; this.tween = null;
    this.pulsePhase = 0;
    this.onPick = o.onPick || null;
    this.onHover = o.onHover || null;
    this.bind(); SCENES.push(this);
    var s = this;
    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (en) { s.visible = en[0].isIntersecting; if (s.visible) { s.fit(); if (!s.grown) { s.grown = true; s.startGrow(); } } }).observe(cv);
    } else { s.visible = true; }
    if ('ResizeObserver' in global) { new ResizeObserver(function () { s.fit(); }).observe(cv); }
  }
  var SP = Scene.prototype;
  SP.fit = function () {
    var r = this.cv.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
    if (r.width < 2 || r.height < 2) return;
    var W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.w = r.width; this.h = r.height; this.g.setTransform(dpr, 0, 0, dpr, 0, 0); this.dirty = true;
  };
  SP.startGrow = function () { if (ST.reduce) { this.grow = 1; this.dirty = true; return; } this.grow = 0; this.growT0 = performance.now(); this.dirty = true; };
  SP.cam = function () {
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), d = this.dist, t = this.target;
    this.c = [cy, sy, cp, sp];
    this.camPos = [t[0] - d * cp * sy, t[1] + d * sp, t[2] - d * cp * cy];
    this.f = Math.min(this.w * 1.02, this.h * 1.62) * this.zoom;
  };
  SP.proj = function (p) {
    var c = this.c, t = this.target, x = p[0] - t[0], y = p[1] - t[1], z = p[2] - t[2];
    var x1 = x * c[0] - z * c[1], z1 = x * c[1] + z * c[0];
    var y2 = y * c[2] + z1 * c[3], z2 = -y * c[3] + z1 * c[2];
    var dep = Math.max(0.6, z2 + this.dist), k = this.f / dep;
    return [this.w / 2 + x1 * k, this.h * 0.49 - y2 * k, dep];
  };
  SP.gy = function (y) { return y * this.grow; };
  SP.itemH = function (it) { var base = it.curH != null ? it.curH : it.h; return base * this.grow; };
  SP.center = function (it) {
    if (it.type === 'box') { var hh = this.itemH(it); return [it.x, this.gy(it.y0) + hh / 2, it.z]; }
    if (it.type === 'ball') return [it.p[0], this.gy(it.p[1]), it.p[2]];
    if (it.type === 'quad') { var a = [0, 0, 0]; it.v.forEach(function (v) { a[0] += v[0]; a[1] += v[1]; a[2] += v[2]; }); return [a[0] / 4, this.gy(a[1] / 4), a[2] / 4]; }
    return [0, 0, 0];
  };
  SP.render = function () {
    if (!this.w) return;
    var g = this.g, s = this; this.cam(); this.hits = [];
    if (ST.dark) {
      g.fillStyle = '#1e293b'; g.fillRect(0, 0, this.w, this.h);
      var glow = g.createRadialGradient(this.w * 0.5, this.h * 0.44, 10, this.w * 0.5, this.h * 0.48, Math.max(this.w, this.h) * 0.68);
      glow.addColorStop(0, 'rgba(37,99,235,.22)'); glow.addColorStop(0.52, 'rgba(30,64,175,.09)'); glow.addColorStop(1, 'rgba(30,41,59,0)');
      g.fillStyle = glow; g.fillRect(0, 0, this.w, this.h);
      /* 무대 위 은은한 조명 기둥 */
      var beam = g.createLinearGradient(this.w * 0.18, 0, this.w * 0.62, this.h * 0.88);
      beam.addColorStop(0, 'rgba(96,165,250,.13)'); beam.addColorStop(0.55, 'rgba(37,99,235,.05)'); beam.addColorStop(1, 'rgba(30,41,59,0)');
      g.fillStyle = beam;
      g.beginPath(); g.moveTo(this.w * 0.08, 0); g.lineTo(this.w * 0.46, 0); g.lineTo(this.w * 0.86, this.h); g.lineTo(this.w * 0.16, this.h); g.closePath(); g.fill();
      STARS.forEach(function (st) {
        var a = 0.15 + 0.14 * Math.sin(s.pulsePhase + st.ph);
        g.fillStyle = 'rgba(191,219,254,' + a.toFixed(3) + ')';
        g.beginPath(); g.arc(st.u * s.w, st.v * s.h, st.r, 0, 6.2832); g.fill();
      });
    } else {
      var bg = g.createLinearGradient(0, 0, 0, this.h);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.55, '#f8fafc'); bg.addColorStop(1, '#eff6ff');
      g.fillStyle = bg; g.fillRect(0, 0, this.w, this.h);
      var lg = g.createRadialGradient(this.w * 0.5, this.h * 0.35, 20, this.w * 0.5, this.h * 0.45, this.w * 0.65);
      lg.addColorStop(0, 'rgba(191,219,254,.28)'); lg.addColorStop(1, 'rgba(248,250,252,0)');
      g.fillStyle = lg; g.fillRect(0, 0, this.w, this.h);
    }
    this.items.forEach(function (it) {
      if (it.type === 'box' && it.y0 === 0 && !it.fade) s.drawBoxReflection(it);
      else if (it.type === 'ball' && !it.fade) s.drawBallReflection(it);
    });
    this.under.forEach(function (it) { s.draw(it, true); });
    this.items.forEach(function (it) {
      if (it.type === 'box' && it.y0 === 0) s.boxShadow(it);
      else if (it.type === 'ball') s.ballShadow(it);
    });
    var L = this.items.map(function (it) { return { it: it, d: s.proj(s.center(it))[2] }; });
    L.sort(function (a, b) { return b.d - a.d; });
    L.forEach(function (o) { s.draw(o.it, false); });
    this.over.forEach(function (it) { s.draw(it, true); });
    this.labels.forEach(function (l) { s.label(l); });
  };
  SP.path = function (pts) { var g = this.g; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  SP.drawBoxReflection = function (it) {
    var hh = Math.min(4.0, this.itemH(it) * 0.40); if (hh < 0.08) return;
    var x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2, cp = this.camPos, s = this, g = this.g;
    var rgb = hex2rgb(it.color); if (ST.dark) rgb = shade(rgb, 0.22);
    var F = [
      [[[x0, 0, z0], [x1, 0, z0], [x1, -hh, z0], [x0, -hh, z0]], [0, 0, -1], [it.x, -hh / 2, z0]],
      [[[x0, 0, z1], [x1, 0, z1], [x1, -hh, z1], [x0, -hh, z1]], [0, 0, 1], [it.x, -hh / 2, z1]],
      [[[x0, 0, z0], [x0, 0, z1], [x0, -hh, z1], [x0, -hh, z0]], [-1, 0, 0], [x0, -hh / 2, it.z]],
      [[[x1, 0, z0], [x1, 0, z1], [x1, -hh, z1], [x1, -hh, z0]], [1, 0, 0], [x1, -hh / 2, it.z]]
    ];
    for (var f = 0; f < F.length; f++) {
      var nn = F[f][1], c = F[f][2];
      if (nn[0] * (cp[0] - c[0]) + nn[2] * (cp[2] - c[2]) <= 0) continue;
      var pp = F[f][0].map(function (v) { return s.proj(v); });
      var topY = (pp[0][1] + pp[1][1]) * 0.5, botY = (pp[2][1] + pp[3][1]) * 0.5;
      var grd = g.createLinearGradient(0, topY, 0, botY);
      grd.addColorStop(0, rgba(rgb, it.holo ? (ST.dark ? 0.14 : 0.07) : (ST.dark ? 0.26 : 0.13)));
      grd.addColorStop(1, rgba(rgb, 0));
      this.path(pp); g.fillStyle = grd; g.fill();
    }
  };
  SP.drawBallReflection = function (it) {
    var g = this.g, y = this.gy(it.p[1]);
    var p = this.proj([it.p[0], -y * 0.28, it.p[2]]), r = it.r * this.f / p[2] * 0.9;
    var rgb = hex2rgb(it.color); if (ST.dark) rgb = shade(rgb, 0.25);
    var grd = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 1.4);
    grd.addColorStop(0, rgba(rgb, ST.dark ? 0.22 : 0.12)); grd.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grd; g.beginPath(); g.arc(p[0], p[1], r * 1.4, 0, 6.2832); g.fill();
  };
  SP.boxShadow = function (it) {
    if (it.fade) return;
    var s = this, g = this.g, pad = 0.16, x0 = it.x - it.w / 2 - pad, x1 = it.x + it.w / 2 + pad, z0 = it.z - it.d / 2 - pad, z1 = it.z + it.d / 2 + pad;
    var q = [[x0, 0.005, z0], [x1, 0.005, z0], [x1, 0.005, z1], [x0, 0.005, z1]].map(function (v) { return s.proj(v); });
    this.path(q);
    g.fillStyle = it.spot ? (ST.dark ? 'rgba(96,165,250,.22)' : 'rgba(37,99,235,.14)') : (ST.dark ? 'rgba(30,41,59,.45)' : 'rgba(30,41,59,.09)');
    g.fill();
  };
  SP.faceGrad = function (rgb, nrm, pp, hot, fade, spot) {
    var g = this.g;
    var base = ST.dark ? shade(rgb, 0.16) : rgb.slice();
    if (spot) base = shade(base, 0.14);
    if (hot) base = shade(base, 0.30);
    var alpha = fade ? (ST.dark ? 0.15 : 0.17) : 1;
    if (nrm[1] > 0.5) {
      var cTop = shade(base, ST.dark ? 0.36 : 0.24), cBot = shade(base, 0.06);
      var grdT = g.createLinearGradient(pp[0][0], pp[0][1], pp[2][0], pp[2][1]);
      grdT.addColorStop(0, rgba(cTop, alpha)); grdT.addColorStop(1, rgba(cBot, alpha));
      return grdT;
    }
    var k = nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2], lit = Math.max(0, k);
    var hi = shade(base, 0.10 * lit + (ST.dark ? 0.08 : 0.03));
    var lo = shade(base, -(0.36 - 0.18 * lit));
    var topY = Math.min(pp[0][1], pp[1][1], pp[2][1], pp[3][1]), botY = Math.max(pp[0][1], pp[1][1], pp[2][1], pp[3][1]);
    if (botY - topY < 2) return rgba(hi, alpha);
    var grd = g.createLinearGradient(0, topY, 0, botY);
    grd.addColorStop(0, rgba(hi, alpha)); grd.addColorStop(1, rgba(lo, alpha));
    return grd;
  };
  SP.draw = function (it, flat) {
    var g = this.g, s = this, P = function (p) { return s.proj([p[0], flat && !it.grow ? p[1] : s.gy(p[1]), p[2]]); };
    var hot = it.id != null && (this.hot === it.id || this.pin === it.id);
    if (it.type === 'line') {
      var a = P(it.a), b = P(it.b);
      var col = it.c || (ST.dark ? 'rgba(148,163,184,.22)' : 'rgba(148,163,184,.36)');
      if (ST.dark && it.wall) col = 'rgba(148,163,184,.34)';
      g.strokeStyle = col; g.lineWidth = it.lw || 1;
      if (it.dash) g.setLineDash(it.dash);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      return;
    }
    if (it.type === 'poly') {
      var pts = it.pts.map(P); if (pts.length < 2) return;
      if (it.glow) {
        g.strokeStyle = ST.dark ? 'rgba(96,165,250,.32)' : 'rgba(37,99,235,.20)';
        g.lineWidth = (it.lw || 2) + 4; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (var gi = 1; gi < pts.length; gi++) g.lineTo(pts[gi][0], pts[gi][1]);
        if (it.closed) g.closePath(); g.stroke();
      }
      g.strokeStyle = it.c; g.lineWidth = it.lw || 2; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      if (it.closed) g.closePath(); g.stroke();
      if (it.dots) {
        pts.forEach(function (p) {
          g.fillStyle = ST.dark ? '#60a5fa' : '#2563eb'; g.beginPath(); g.arc(p[0], p[1], 4.0, 0, 6.2832); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(p[0], p[1], 2.0, 0, 6.2832); g.fill();
        });
      }
      return;
    }
    if (it.type === 'quad') {
      var q = it.v.map(P); this.path(q);
      var qfill = it.fill;
      if (it.floorDeck) {
        var fy0 = Math.min(q[0][1], q[1][1], q[2][1], q[3][1]), fy1 = Math.max(q[0][1], q[1][1], q[2][1], q[3][1]);
        var fg = g.createLinearGradient(0, fy0, 0, fy1);
        if (ST.dark) { fg.addColorStop(0, 'rgba(71,85,105,.34)'); fg.addColorStop(1, 'rgba(30,41,59,.68)'); }
        else { fg.addColorStop(0, 'rgba(226,232,240,.52)'); fg.addColorStop(1, 'rgba(248,250,252,.88)'); }
        qfill = fg;
      } else if (it.spotBand) {
        qfill = ST.dark ? 'rgba(96,165,250,.16)' : 'rgba(37,99,235,.09)';
      }
      g.fillStyle = qfill; g.fill();
      var qstroke = it.floorDeck ? (ST.dark ? 'rgba(148,163,184,.32)' : 'rgba(203,213,225,.85)') : it.stroke;
      if (qstroke || hot) { g.strokeStyle = hot ? '#fbbf24' : qstroke; g.lineWidth = hot ? 2.2 : (it.lw || 0.65); g.stroke(); }
      if (!it.nohit) this.hits.push({ polys: [q], it: it });
      return;
    }
    if (it.type === 'box') {
      var y0 = this.gy(it.y0), hh = this.itemH(it), y1 = y0 + hh; if (y1 - y0 < 0.025) y1 = y0 + 0.025;
      var x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2, cp = this.camPos, ym = (y0 + y1) / 2;
      var F = [
        [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], [it.x, y1, it.z]],
        [[[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], [it.x, ym, z0]],
        [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [it.x, ym, z1]],
        [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [x0, ym, it.z]],
        [[[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], [x1, ym, it.z]]
      ];
      var rgb = hex2rgb(it.color), polys = [], topPoly = null;
      if (it.beacon && !it.fade) {
        var bp = this.proj([it.x, y1 + 0.15, it.z]), br = Math.max(8, it.w * this.f / bp[2] * (1.15 + 0.18 * Math.sin(this.pulsePhase * 2.2)));
        var bg2 = g.createRadialGradient(bp[0], bp[1], 1, bp[0], bp[1], br);
        bg2.addColorStop(0, 'rgba(251,191,36,.52)'); bg2.addColorStop(1, 'rgba(251,191,36,0)');
        g.fillStyle = bg2; g.beginPath(); g.arc(bp[0], bp[1], br, 0, 6.2832); g.fill();
      }
      for (var f = 0; f < F.length; f++) {
        var nn = F[f][1], c = F[f][2];
        if (nn[0] * (cp[0] - c[0]) + nn[1] * (cp[1] - c[1]) + nn[2] * (cp[2] - c[2]) <= 0) continue;
        var pp = F[f][0].map(function (v) { return s.proj(v); });
        this.path(pp);
        if (it.holo && !it.fade) {
          var hCol = shade(rgb, ST.dark ? 0.28 : 0.08);
          var hTopY = Math.min(pp[0][1], pp[1][1], pp[2][1], pp[3][1]), hBotY = Math.max(pp[0][1], pp[1][1], pp[2][1], pp[3][1]);
          var hGrd = g.createLinearGradient(0, hTopY, 0, hBotY);
          hGrd.addColorStop(0, rgba(hCol, hot ? 0.68 : (nn[1] > 0.5 ? 0.56 : 0.44)));
          hGrd.addColorStop(1, rgba(hCol, hot ? 0.32 : 0.14));
          g.fillStyle = hGrd; g.fill();
          g.strokeStyle = hot ? '#fbbf24' : (ST.dark ? 'rgba(191,219,254,.72)' : 'rgba(37,99,235,.58)');
          g.lineWidth = hot ? 2.3 : 1.15;
          if (nn[1] < 0.5 && !hot) g.setLineDash([4, 3]);
          g.stroke(); g.setLineDash([]);
        } else {
          g.fillStyle = this.faceGrad(rgb, nn, pp, hot, it.fade, it.spot);
          g.fill();
          g.strokeStyle = hot ? '#fbbf24' : (it.fade ? 'rgba(148,163,184,.06)' : (ST.dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.42)'));
          g.lineWidth = hot ? 2.2 : 0.7; g.stroke();
        }
        if (nn[1] > 0.5) topPoly = pp;
        polys.push(pp);
      }
      if (it.holo && !it.fade) {
        var cb0 = this.proj([it.x, y0, it.z]), cb1 = this.proj([it.x, y1, it.z]);
        g.strokeStyle = ST.dark ? 'rgba(191,219,254,.55)' : 'rgba(37,99,235,.40)';
        g.lineWidth = 1.4; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(cb0[0], cb0[1]); g.lineTo(cb1[0], cb1[1]); g.stroke(); g.setLineDash([]);
        var hpulse = 6 + 2.5 * Math.sin(this.pulsePhase * 2.0);
        var hrg = g.createRadialGradient(cb1[0], cb1[1], 1, cb1[0], cb1[1], hpulse * 1.8);
        hrg.addColorStop(0, ST.dark ? 'rgba(191,219,254,.65)' : 'rgba(37,99,235,.42)');
        hrg.addColorStop(1, 'rgba(96,165,250,0)');
        g.fillStyle = hrg; g.beginPath(); g.arc(cb1[0], cb1[1], hpulse * 1.8, 0, 6.2832); g.fill();
      }
      if (topPoly && !it.fade) {
        g.strokeStyle = hot ? '#fde68a' : (it.holo ? (ST.dark ? '#bfdbfe' : '#2563eb') : 'rgba(255,255,255,.64)');
        g.lineWidth = hot ? 2.5 : 1.25;
        g.beginPath(); g.moveTo(topPoly[3][0], topPoly[3][1]); g.lineTo(topPoly[2][0], topPoly[2][1]); g.lineTo(topPoly[1][0], topPoly[1][1]); g.stroke();
      }
      if (!it.fade) this.hits.push({ polys: polys, it: it });
      return;
    }
    if (it.type === 'ball') {
      var p = this.proj([it.p[0], this.gy(it.p[1]), it.p[2]]), r = Math.max(3, it.r * this.f / p[2]), rgb2 = hex2rgb(it.color);
      if (ST.dark) rgb2 = shade(rgb2, 0.18);
      if (!it.fade) {
        var halo = g.createRadialGradient(p[0], p[1], r * 0.7, p[0], p[1], r * 1.75);
        halo.addColorStop(0, rgba(rgb2, hot ? 0.55 : (ST.dark ? 0.34 : 0.18))); halo.addColorStop(1, rgba(rgb2, 0));
        g.fillStyle = halo; g.beginPath(); g.arc(p[0], p[1], r * 1.75, 0, 6.2832); g.fill();
      }
      var grd = g.createRadialGradient(p[0] - r * 0.34, p[1] - r * 0.38, r * 0.06, p[0], p[1], r);
      grd.addColorStop(0, rgba([255, 255, 255], it.fade ? 0.25 : 0.92));
      grd.addColorStop(0.26, rgba(shade(rgb2, 0.42), it.fade ? 0.25 : 1));
      grd.addColorStop(0.78, rgba(rgb2, it.fade ? 0.25 : 1));
      grd.addColorStop(1, rgba(shade(rgb2, -0.32), it.fade ? 0.25 : 1));
      g.fillStyle = grd; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill();
      g.strokeStyle = hot ? '#fbbf24' : 'rgba(255,255,255,.45)';
      g.lineWidth = hot ? 2.8 : 0.9; g.stroke();
      if (!it.fade) this.hits.push({ circle: [p[0], p[1], r], it: it });
    }
  };
  SP.ballShadow = function (it) {
    var g = this.g, p = this.proj([it.p[0], this.gy(it.p[1]), it.p[2]]), q = this.proj([it.p[0], 0, it.p[2]]), r = it.r * this.f / q[2];
    g.strokeStyle = ST.dark ? 'rgba(148,163,184,.34)' : 'rgba(71,85,105,.28)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle = ST.dark ? 'rgba(96,165,250,.20)' : 'rgba(30,41,59,.11)';
    g.beginPath(); g.ellipse(q[0], q[1], r * 1.05, r * 0.42, 0, 0, 6.2832); g.fill();
  };
  SP.label = function (l) {
    var g = this.g, p = this.proj([l.p[0], l.grow ? this.gy(l.p[1]) : l.p[1], l.p[2]]);
    if (p[0] < -70 || p[0] > this.w + 70 || p[1] < -24 || p[1] > this.h + 24) return;
    if (p[0] > this.w - 224 && p[1] > this.h - 48 && !l.forceShow) return;
    var txt = (this.w < 500 && l.short) ? l.short : l.t;
    g.font = (l.wt || 700) + ' ' + (l.sz || 11) + 'px Pretendard,"Malgun Gothic",sans-serif';
    g.textAlign = l.al || 'center'; g.textBaseline = 'middle';
    var tw = g.measureText(txt).width;
    var bx = l.al === 'right' ? p[0] - tw - 8 : (l.al === 'left' ? p[0] - 6 : p[0] - tw / 2 - 7);
    var pillBg = l.bg;
    var txtCol = l.c || (ST.dark ? '#f8fafc' : '#475569');
    if (ST.dark) {
      if (l.accentPill) { pillBg = 'rgba(37,99,235,.90)'; txtCol = '#ffffff'; }
      else if (l.bg || l.pill) { pillBg = 'rgba(30,41,59,.86)'; if (!l.keepDarkCol) txtCol = '#f8fafc'; }
      else { txtCol = l.darkC || '#e2e8f0'; }
    }
    if (pillBg) {
      g.fillStyle = pillBg;
      g.beginPath(); if (g.roundRect) g.roundRect(bx, p[1] - 9.5, tw + 14, 19, 999); else g.rect(bx, p[1] - 9.5, tw + 14, 19); g.fill();
      g.strokeStyle = ST.dark ? 'rgba(148,163,184,.28)' : 'rgba(203,213,225,.75)';
      g.lineWidth = 0.8; g.stroke();
      if (l.dotCol) { g.fillStyle = l.dotCol; g.beginPath(); g.arc(bx + 7, p[1], 3.2, 0, 6.2832); g.fill(); }
    } else if (ST.dark) {
      g.lineWidth = 3; g.strokeStyle = 'rgba(30,41,59,.88)'; g.strokeText(txt, p[0], p[1]);
    }
    g.fillStyle = txtCol;
    var txOff = (pillBg && l.dotCol) ? (l.al === 'right' ? -3 : (l.al === 'left' ? 8 : 4)) : 0;
    g.fillText(txt, p[0] + txOff, p[1]);
  };
  SP.pick = function (e, click) {
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = null;
    for (var i = this.hits.length - 1; i >= 0 && !hit; i--) {
      var h = this.hits[i];
      if (h.circle) { var dx = x - h.circle[0], dy = y - h.circle[1]; if (dx * dx + dy * dy <= h.circle[2] * h.circle[2]) hit = h.it; }
      else { for (var j = 0; j < h.polys.length; j++) { if (inPoly(x, y, h.polys[j])) { hit = h.it; break; } } }
    }
    var id = hit ? hit.id : null;
    if (id !== this.hot) { this.hot = id; this.dirty = true; if (this.onHover) this.onHover(hit); }
    if (click) { this.pin = (hit && this.pin !== id) ? id : null; this.dirty = true; if (this.onPick) this.onPick(hit); }
    if (hit && hit.tip) showTip(hit.tip, e.clientX, e.clientY); else if (!this.pin) hideTip();
  };
  SP.bind = function () {
    var s = this, cv = this.cv, last = null, moved = 0;
    cv.addEventListener('pointerdown', function (e) {
      s.dragging = true; s.vYaw = 0; s.vPitch = 0; last = [e.clientX, e.clientY]; moved = 0;
      cv.classList.add('drag'); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    });
    cv.addEventListener('pointermove', function (e) {
      if (s.dragging && last) {
        var dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 3) {
          s.auto = false; s.syncAuto();
          /* 손가락은 «옆으로 끌기»만 돌리기 — 위아래 끌기는 화면 내리기에 양보한다(touch-action: pan-y) */
          var wy = dx * 0.0075, wp = (e.pointerType !== 'touch') ? dy * 0.0055 : 0;
          s.tYaw += wy; s.vYaw = wy * 0.65;
          if (e.pointerType !== 'touch') { s.tPitch = clamp(s.tPitch + wp, 0.10, 1.42); s.vPitch = wp * 0.55; }
          s.dirty = true; hideTip();
        }
        return;
      }
      s.pick(e, false);
    });
    cv.addEventListener('pointerup', function (e) { if (s.dragging && moved <= 4) s.pick(e, true); s.dragging = false; last = null; cv.classList.remove('drag'); });
    cv.addEventListener('pointercancel', function () { s.dragging = false; last = null; cv.classList.remove('drag'); });
    cv.addEventListener('pointerleave', function () { if (!s.dragging) { s.hot = null; s.dirty = true; if (s.onHover) s.onHover(null); if (!s.pin) hideTip(); } });
    cv.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && document.activeElement !== cv) return;
      e.preventDefault(); s.tDist = clamp(s.tDist * (e.deltaY > 0 ? 1.09 : 0.92), s.minD, s.maxD); s.dirty = true;
    }, { passive: false });
    cv.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') s.tYaw -= 0.16; else if (k === 'ArrowRight') s.tYaw += 0.16;
      else if (k === 'ArrowUp') s.tPitch = clamp(s.tPitch + 0.09, 0.10, 1.42); else if (k === 'ArrowDown') s.tPitch = clamp(s.tPitch - 0.09, 0.10, 1.42);
      else if (k === '+' || k === '=') s.tDist = clamp(s.tDist * 0.88, s.minD, s.maxD); else if (k === '-') s.tDist = clamp(s.tDist * 1.12, s.minD, s.maxD);
      else used = false;
      if (used) { e.preventDefault(); s.dirty = true; }
    });
  };
  SP.syncAuto = function () { if (this.autoBtn) { this.autoBtn.classList.toggle('on', this.auto); this.autoBtn.setAttribute('aria-pressed', this.auto ? 'true' : 'false'); } };
  SP.controls = function (box) {
    var s = this, B = [
      ['↺', '왼쪽으로 돌리기', function () { s.tYaw -= 0.38; }],
      ['↻', '오른쪽으로 돌리기', function () { s.tYaw += 0.38; }],
      ['＋', '가까이', function () { s.tDist = clamp(s.tDist * 0.84, s.minD, s.maxD); }],
      ['－', '멀리', function () { s.tDist = clamp(s.tDist * 1.18, s.minD, s.maxD); }],
      ['⟲', '처음 자리로', function () { s.tYaw = s.home[0]; s.tPitch = s.home[1]; s.tDist = s.home[2]; s.vYaw = 0; s.vPitch = 0; s.pin = null; hideTip(); }],
      ['⏯', '저절로 돌기 켜기·끄기', function () { s.auto = !s.auto; s.syncAuto(); }]
    ];
    B.forEach(function (b) {
      var el = document.createElement('button'); el.type = 'button'; el.textContent = b[0]; el.title = b[1]; el.setAttribute('aria-label', b[1]);
      el.addEventListener('click', function () { b[2](); s.dirty = true; }); box.appendChild(el); if (b[0] === '⏯') s.autoBtn = el;
    });
    this.syncAuto();
  };
  /* 다시 짓기 전에 비운다 — 막대 높이는 기억해 두었다가 «자라듯» 옮겨 간다 */
  function clear(s) {
    var map = {};
    s.items.forEach(function (it) { if (it.id && it.type === 'box') map[it.id] = (it.curH != null ? it.curH : it.h); });
    s.prevHeights = map;
    s.items = []; s.under = []; s.over = []; s.labels = []; s.hot = null; hideTip();
  }

  /* ══ 2D 짝 차트 ══ */
  function Chart2D(cv, drawFn, o) {
    o = o || {};
    this.cv = cv; this.g = cv.getContext('2d'); this.drawFn = drawFn;
    this.w = 0; this.h = 0; this.hits = []; this.hot = null; this.pin = null; this.dirty = true; this.visible = false; this.scanX = null;
    this.onPick = o.onPick || null; this.onHover = o.onHover || null;
    var c = this;
    cv.addEventListener('pointermove', function (e) { c.pick(e, false); });
    cv.addEventListener('pointerup', function (e) { c.pick(e, true); });
    cv.addEventListener('pointerleave', function () { c.hot = null; c.dirty = true; if (c.onHover) c.onHover(null); if (!c.pin) hideTip(); });
    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (en) { c.visible = en[0].isIntersecting; if (c.visible) c.fit(); }).observe(cv);
    } else { c.visible = true; }
    if ('ResizeObserver' in global) { new ResizeObserver(function () { c.fit(); }).observe(cv); }
    CHARTS2D.push(this);
  }
  Chart2D.prototype.fit = SP.fit;
  Chart2D.prototype.render = function () {
    if (!this.w) return;
    var g = this.g; this.hits = [];
    if (ST.dark) {
      g.fillStyle = '#1e293b'; g.fillRect(0, 0, this.w, this.h);
      var rg = g.createRadialGradient(this.w * 0.5, this.h * 0.3, 10, this.w * 0.5, this.h * 0.5, this.w * 0.7);
      rg.addColorStop(0, 'rgba(37,99,235,.16)'); rg.addColorStop(1, 'rgba(30,41,59,0)');
      g.fillStyle = rg; g.fillRect(0, 0, this.w, this.h);
    } else {
      var bg = g.createLinearGradient(0, 0, 0, this.h);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#f8fafc');
      g.fillStyle = bg; g.fillRect(0, 0, this.w, this.h);
    }
    this.drawFn(this, g);
    if (this.scanX != null && this.scanX >= 0 && this.scanX <= this.w) {
      var sx = this.scanX;
      var sbg = g.createLinearGradient(sx - 26, 0, sx + 26, 0);
      sbg.addColorStop(0, 'rgba(96,165,250,0)'); sbg.addColorStop(0.5, ST.dark ? 'rgba(96,165,250,.22)' : 'rgba(37,99,235,.14)'); sbg.addColorStop(1, 'rgba(96,165,250,0)');
      g.fillStyle = sbg; g.fillRect(sx - 26, 48, 52, Math.max(10, this.h - 82));
      g.strokeStyle = ST.dark ? '#bfdbfe' : '#2563eb'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(sx, 48); g.lineTo(sx, Math.max(50, this.h - 34)); g.stroke();
    }
  };
  Chart2D.prototype.pick = function (e, click) {
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = null;
    for (var i = this.hits.length - 1; i >= 0 && !hit; i--) {
      var h = this.hits[i];
      if (h.rect && x >= h.rect[0] && x <= h.rect[0] + h.rect[2] && y >= h.rect[1] && y <= h.rect[1] + h.rect[3]) hit = h;
      else if (h.circle) { var dx = x - h.circle[0], dy = y - h.circle[1]; if (dx * dx + dy * dy <= h.circle[2] * h.circle[2]) hit = h; }
    }
    var id = hit ? hit.id : null;
    if (id !== this.hot) { this.hot = id; this.dirty = true; if (this.onHover) this.onHover(hit); }
    if (click) { this.pin = (hit && this.pin !== id) ? id : null; this.dirty = true; if (this.onPick) this.onPick(hit); }
    if (hit && hit.tip) showTip(hit.tip, e.clientX, e.clientY); else if (!this.pin) hideTip();
  };

  /* ══ 한 고리로 모두 돌린다 — 보이는 것 중 바뀐 것만 다시 그린다 ══ */
  var started = false, extraTicks = [];
  function loop(t) {
    SCENES.forEach(function (s) {
      if (!s.visible) return;
      if (!ST.reduce) {
        s.pulsePhase += 0.032;
        if (s.auto && !s.dragging) { s.tYaw += 0.0028; s.dirty = true; }
        if (!s.dragging && (Math.abs(s.vYaw) > 0.0002 || Math.abs(s.vPitch) > 0.0002)) {
          s.tYaw += s.vYaw; s.tPitch = clamp(s.tPitch + s.vPitch, 0.10, 1.42);
          s.vYaw *= 0.91; s.vPitch *= 0.88; s.dirty = true;
        }
        var dy = s.tYaw - s.yaw, dp = s.tPitch - s.pitch, dd = s.tDist - s.dist;
        if (Math.abs(dy) > 0.0003 || Math.abs(dp) > 0.0003 || Math.abs(dd) > 0.002) {
          s.yaw += dy * 0.22; s.pitch += dp * 0.22; s.dist += dd * 0.20; s.dirty = true;
        } else { s.yaw = s.tYaw; s.pitch = s.tPitch; s.dist = s.tDist; }
        var morphing = false;
        for (var i = 0; i < s.items.length; i++) {
          var it = s.items[i];
          if (it.curH != null && Math.abs(it.h - it.curH) > 0.004) { it.curH += (it.h - it.curH) * 0.18; morphing = true; }
          else if (it.curH != null) { it.curH = it.h; }
        }
        if (morphing) s.dirty = true;
        if (ST.dark && (s.auto || ST.cine)) s.dirty = true;
      } else {
        s.yaw = s.tYaw; s.pitch = s.tPitch; s.dist = s.tDist;
        s.items.forEach(function (it) { if (it.curH != null) it.curH = it.h; });
      }
      if (s.growT0 != null) { var k = Math.min(1, (t - s.growT0) / s.growMs); s.grow = 1 - Math.pow(1 - k, 3); if (k >= 1) s.growT0 = null; s.dirty = true; }
      if (s.tween) { if (!s.tween(t)) s.tween = null; s.dirty = true; }
      if (s.dirty) { s.dirty = false; s.render(); }
    });
    CHARTS2D.forEach(function (c) { if (c.visible && c.dirty) { c.dirty = false; c.render(); } });
    extraTicks.forEach(function (fn) { try { fn(t); } catch (e) {} });
    global.requestAnimationFrame(loop);
  }
  function start() { if (started) return; started = true; global.requestAnimationFrame(loop); }
  function onTick(fn) { extraTicks.push(fn); }
  function refit() {
    SCENES.forEach(function (s) { if (s.visible) s.fit(); });
    CHARTS2D.forEach(function (c) { if (c.visible) c.fit(); });
  }
  function dirtyAll() { SCENES.forEach(function (s) { s.dirty = true; }); CHARTS2D.forEach(function (c) { c.dirty = true; }); }
  function unpinAll() {
    SCENES.forEach(function (s) { if (s.pin != null || s.hot != null) { s.pin = null; s.hot = null; s.dirty = true; } });
    CHARTS2D.forEach(function (c) { if (c.pin != null || c.hot != null) { c.pin = null; c.hot = null; c.dirty = true; } });
    hideTip();
  }

  global.Pu3DLite = {
    state: ST, Scene: Scene, Chart2D: Chart2D, clear: clear, start: start, onTick: onTick, refit: refit, dirtyAll: dirtyAll, unpinAll: unpinAll,
    SCENES: SCENES, CHARTS2D: CHARTS2D, showTip: showTip, hideTip: hideTip, tipShown: tipShown,
    util: { clamp: clamp, hex2rgb: hex2rgb, rgba: rgba, shade: shade, mixRgb: mixRgb, inPoly: inPoly, haloText: haloText,
      sampleSmooth1D: sampleSmooth1D, smoothPts3D: smoothPts3D, strokeSpline2D: strokeSpline2D }
  };
})(typeof window !== 'undefined' ? window : this);
