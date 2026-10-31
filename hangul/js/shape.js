// 그리기 개체(도형·글상자·묶음·그림·수식 등)
// 모델: 한글(OWPML)이 저장하는 요소 나무를 그대로 씀 { tag, attrs, kids, txt, text(글상자 문단), image(그림 자료) }
//  → HWPX 로 다시 저장할 때 잃는 것이 없고, 화면에는 SVG 로 그림
(function (g) {
  const HU_PER_MM = 7200 / 25.4;
  const PX_PER_HU = 96 / 7200; // 화면(96dpi) 1px = 75 HWPUNIT
  const TAGS = new Set(['rect', 'ellipse', 'line', 'arc', 'polygon', 'curve', 'container', 'pic', 'connectLine', 'textart', 'ole', 'equation', 'btn', 'radioBtn', 'checkBtn', 'comboBox', 'listBox', 'edit', 'scrollBar']);
  const FORM = new Set(['btn', 'radioBtn', 'checkBtn', 'comboBox', 'listBox', 'edit', 'scrollBar']);
  const isShapeTag = local => TAGS.has(local);

  const kid = (n, tag) => (n && n.kids ? n.kids.find(k => k.tag === tag) : undefined);
  const kidsOf = (n, tag) => (n && n.kids ? n.kids.filter(k => k.tag === tag) : []);
  const num = (v, d = 0) => (v === undefined || v === null || v === '' || isNaN(+v) ? d : +v);
  const a = (n, name, d) => num(n && n.attrs ? n.attrs[name] : undefined, d);
  const local = tag => tag.slice(tag.indexOf(':') + 1);
  const escA = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- 변환 행렬 (2×3: x' = e1·x + e2·y + e3, y' = e4·x + e5·y + e6) ----------
  const I = [1, 0, 0, 0, 1, 0];
  const matOf = n => (n ? [a(n, 'e1', 1), a(n, 'e2', 0), a(n, 'e3', 0), a(n, 'e4', 0), a(n, 'e5', 1), a(n, 'e6', 0)] : I.slice());
  const mul = (p, q) => [p[0] * q[0] + p[1] * q[3], p[0] * q[1] + p[1] * q[4], p[0] * q[2] + p[1] * q[5] + p[2],
    p[3] * q[0] + p[4] * q[3], p[3] * q[1] + p[4] * q[4], p[3] * q[2] + p[4] * q[5] + p[5]];
  const ap = (m, x, y) => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
  // 개체 행렬: 이동 × (회전 × 크기) 쌍 모두 — 점에는 크기 → 회전 → 이동 차례로 적용. 묶음 안 개체는 바깥 묶음들의 쌍도
  // 함께 저장되므로(바깥 → 자기 차례) 그 결과는 최상위 묶음의 크기(sz) 상자 좌표 → 묶음 행렬을 다시 곱하지 않음
  // (서식 392개의 최상위 묶음 70개 모두 자손 점이 묶음 크기 상자 안에 들어맞는 해석. 크기 × 회전 차례는 회전·뒤집은 묶음 21개가 어긋남)
  function localMatrix(n) {
    const ri = kid(n, 'hp:renderingInfo');
    if (!ri) { const o = kid(n, 'hp:offset'); return [1, 0, a(o, 'x'), 0, 1, a(o, 'y')]; }
    let m = matOf(kid(ri, 'hc:transMatrix'));
    const sca = kidsOf(ri, 'hc:scaMatrix'), rot = kidsOf(ri, 'hc:rotMatrix');
    for (let i = 0; i < sca.length; i++) { if (rot[i]) m = mul(m, matOf(rot[i])); m = mul(m, matOf(sca[i])); }
    return m;
  }

  // ---------- 크기·위치 속성 ----------
  function orgSize(n) { const o = kid(n, 'hp:orgSz'); return { w: a(o, 'width'), h: a(o, 'height') }; }
  // 화면에 차지하는 크기 (HWPUNIT): sz → curSz → 원래 크기에 행렬을 적용한 크기
  function sizeOf(n) {
    const sz = kid(n, 'hp:sz'), cs = kid(n, 'hp:curSz');
    let w = a(sz, 'width'), h = a(sz, 'height');
    if (!w && !h && cs) { w = a(cs, 'width'); h = a(cs, 'height'); }
    // 쪽·종이 등에 대한 비율 크기(widthRelTo PAGE 등, 값은 1/100 %)는 한글이 계산해 둔 실제 크기(curSz)로 (HOME36: 쪽 100% 글상자를 10000 HWPUNIT 으로 그리던 것)
    const rel = k => (sz && sz.attrs && sz.attrs[k]) || 'ABSOLUTE';
    if (cs && rel('widthRelTo') !== 'ABSOLUTE' && a(cs, 'width')) w = a(cs, 'width');
    if (cs && rel('heightRelTo') !== 'ABSOLUTE' && a(cs, 'height')) h = a(cs, 'height');
    if (!w && !h) { const b = bboxOf(n, localMatrix(n)); w = b.x1 - b.x0; h = b.y1 - b.y0; }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  }
  function posOf(n) {
    const p = kid(n, 'hp:pos') || { attrs: {} }, om = kid(n, 'hp:outMargin');
    const at = p.attrs || {};
    return {
      inline: at.treatAsChar === '1', vertRelTo: at.vertRelTo || 'PARA', horzRelTo: at.horzRelTo || 'COLUMN',
      vertAlign: at.vertAlign || 'TOP', horzAlign: at.horzAlign || 'LEFT', vertOffset: num(at.vertOffset), horzOffset: num(at.horzOffset),
      flowWithText: at.flowWithText === '1',
      wrap: (n.attrs && n.attrs.textWrap) || 'TOP_AND_BOTTOM', zOrder: num(n.attrs && n.attrs.zOrder),
      margin: { l: a(om, 'left'), r: a(om, 'right'), t: a(om, 'top'), b: a(om, 'bottom') },
    };
  }

  // 개체 경계 상자 (부모 좌표): 원래 크기 사각형의 네 모서리에 행렬 적용
  function bboxOf(n, m) {
    let { w, h } = orgSize(n);
    if (!w && !h) { const cs = kid(n, 'hp:curSz'); w = a(cs, 'width'); h = a(cs, 'height'); }
    const pts = [ap(m, 0, 0), ap(m, w, 0), ap(m, w, h), ap(m, 0, h)];
    return { x0: Math.min(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), x1: Math.max(...pts.map(p => p[0])), y1: Math.max(...pts.map(p => p[1])) };
  }

  // ---------- 선·채우기 ----------
  function colorOf(c) {
    if (!c || c === 'none') return null;
    if (/^#[0-9a-f]{8}$/i.test(c)) return /^#00/i.test(c) ? '#' + c.slice(3) : null; // 앞 두 자리가 0 이 아니면 '색 없음'
    return c;
  }
  const DASH = { DASH: [4, 2], DOT: [1, 2], DASH_DOT: [4, 2, 1, 2], DASH_DOT_DOT: [4, 2, 1, 2, 1, 2], LONG_DASH: [8, 3], CIRCLE: [0.1, 2] };
  function strokeOf(n) {
    const ls = kid(n, 'hp:lineShape');
    if (!ls) return null;
    const st = ls.attrs.style || 'SOLID', color = colorOf(ls.attrs.color);
    if (st === 'NONE' || !color) return null;
    const w = Math.max(a(ls, 'width', 33), 20); // 아주 가는 선도 보이게 (0.07mm 이상)
    return { color, w, dash: DASH[st] ? DASH[st].map(d => d * w) : null, double: /DOUBLE|SLIM_THICK|THICK_SLIM/.test(st), cap: ls.attrs.endCap === 'ROUND' ? 'round' : 'butt', head: ls.attrs.headStyle, tail: ls.attrs.tailStyle, alpha: a(ls, 'alpha') };
  }
  const strokeAttr = (s, k) => (s
    ? ` stroke="${s.color}" stroke-width="${Math.max(0.6, s.w * k)}" stroke-linecap="${s.cap}"${s.dash ? ` stroke-dasharray="${s.dash.map(d => (d * k).toFixed(2)).join(' ')}"` : ''}${s.alpha ? ` stroke-opacity="${1 - s.alpha / 255}"` : ''}`
    : ' stroke="none"');

  // ---------- SVG 만들기 ----------
  // ctx: { k: HWPUNIT→px, defs: [], px: [] (화면 px 좌표로 그린 조각: 글상자·화살표), uid, imgUrl(image) → URL }
  function fillOf(n, ctx) {
    const fb = kid(n, 'hc:fillBrush');
    if (!fb) return ' fill="none"';
    const gr = kid(fb, 'hc:gradation'), wb = kid(fb, 'hc:winBrush'), ib = kid(fb, 'hc:imgBrush');
    if (gr) {
      const id = 'gd' + (++ctx.uid);
      const cols = kidsOf(gr, 'hc:color').map(c => colorOf(c.attrs.value) || '#ffffff');
      const stops = (cols.length ? cols : ['#ffffff', '#000000']).map((c, i, l) => `<stop offset="${l.length > 1 ? i / (l.length - 1) : 0}" stop-color="${c}"/>`).join('');
      if (gr.attrs.type === 'RADIAL' || gr.attrs.type === 'SQUARE' || gr.attrs.type === 'CONICAL') {
        ctx.defs.push(`<radialGradient id="${id}" cx="${a(gr, 'centerX', 50) / 100}" cy="${a(gr, 'centerY', 50) / 100}" r="0.75">${stops}</radialGradient>`);
      } else {
        const ang = a(gr, 'angle', 0) * Math.PI / 180;
        const x = Math.cos(ang) / 2, y = Math.sin(ang) / 2;
        ctx.defs.push(`<linearGradient id="${id}" x1="${0.5 - x}" y1="${0.5 - y}" x2="${0.5 + x}" y2="${0.5 + y}">${stops}</linearGradient>`);
      }
      return ` fill="url(#${id})"`;
    }
    if (ib) {
      const img = kid(ib, 'hc:img');
      const url = img && img.image && ctx.imgUrl(img.image);
      if (url) {
        const id = 'ib' + (++ctx.uid);
        ctx.defs.push(`<pattern id="${id}" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${url}" width="1" height="1" preserveAspectRatio="none"/></pattern>`);
        return ` fill="url(#${id})"`;
      }
    }
    if (wb) {
      const c = colorOf(wb.attrs.faceColor);
      if (!c) return ' fill="none"';
      const al = a(wb, 'alpha');
      return ` fill="${c}"${al ? ` fill-opacity="${Math.max(0, 1 - al / 255)}"` : ''}`;
    }
    return ' fill="none"';
  }
  const svgMat = m => `matrix(${m[0]} ${m[3]} ${m[1]} ${m[4]} ${m[2]} ${m[5]})`;
  const pt = (n, tag) => { const p = kid(n, tag); return [a(p, 'x'), a(p, 'y')]; };

  // 한 개체를 그림. m: 이 개체 좌표 → 최상위 좌표(HWPUNIT)
  function draw(n, m, ctx) {
    const t = local(n.tag);
    const s = strokeOf(n);
    const k = ctx.k;
    const path = d => `<path d="${d}" transform="${svgMat(m)}"${fillOf(n, ctx)}${strokeAttr(s, k)} vector-effect="non-scaling-stroke"/>`;
    let out = '';
    if (t === 'container') {
      // 묶음 안 개체(겹친 묶음 포함)의 행렬은 이미 최상위 묶음의 크기 상자 좌표 → 편집기에서 크기를 바꾼 비율(cfit)만 곱함
      for (const c of n.kids || []) if (isShapeTag(local(c.tag))) out += draw(c, mul(ctx.cfit || I, localMatrix(c)), ctx);
      return out;
    }
    if (t === 'rect') {
      const p = ['hc:pt0', 'hc:pt1', 'hc:pt2', 'hc:pt3'].map(tag => pt(n, tag));
      const { w, h } = orgSize(n);
      if (!p.some(q => q[0] || q[1])) { p[1] = [w, 0]; p[2] = [w, h]; p[3] = [0, h]; }
      const ratio = a(n, 'ratio');
      if (ratio > 0 && !m[1] && !m[3]) {
        // 둥근 모서리: 화면 크기 기준 반지름 (한글처럼 늘린 뒤의 짧은 변 × 곡률%)
        const q0 = ap(m, ...p[0]), q2 = ap(m, ...p[2]);
        const x0 = Math.min(q0[0], q2[0]), y0 = Math.min(q0[1], q2[1]), x1 = Math.max(q0[0], q2[0]), y1 = Math.max(q0[1], q2[1]);
        const r = Math.min(x1 - x0, y1 - y0) * Math.min(50, ratio) / 100;
        out += `<path d="M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z"${fillOf(n, ctx)}${strokeAttr(s, k)} vector-effect="non-scaling-stroke"/>`;
      } else out += path(`M${p[0]}L${p[1]}L${p[2]}L${p[3]}Z`);
    } else if (t === 'ellipse' || t === 'arc') {
      const c = pt(n, 'hc:center'), p1 = pt(n, 'hc:ax1'), p2 = pt(n, 'hc:ax2');
      const u = [p1[0] - c[0], p1[1] - c[1]], v = [p2[0] - c[0], p2[1] - c[1]];
      const at = th => [c[0] + u[0] * Math.cos(th) + v[0] * Math.sin(th), c[1] + u[1] * Math.cos(th) + v[1] * Math.sin(th)];
      // 호: 첫 축 끝에서 둘째 축 끝까지 (90도). 타원: 한 바퀴
      const full = t === 'ellipse', end = full ? Math.PI * 2 : Math.PI / 2, steps = full ? 72 : 24;
      let d = '';
      for (let i = 0; i <= steps; i++) { const q = at(end * i / steps); d += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
      const type = n.attrs.type || n.attrs.arcType;
      if (full) d += 'Z'; else if (type === 'PIE') d += `L${c[0]} ${c[1]}Z`; else if (type === 'CHORD') d += 'Z';
      out += full || type === 'PIE' || type === 'CHORD' ? path(d) : path(d).replace(/ fill="[^"]*"( fill-opacity="[^"]*")?/, ' fill="none"');
    } else if (t === 'line' || t === 'connectLine') {
      const p0 = pt(n, 'hc:startPt'), p1 = pt(n, 'hc:endPt');
      out += `<path d="M${p0}L${p1}" transform="${svgMat(m)}" fill="none"${strokeAttr(s, k)} vector-effect="non-scaling-stroke"/>`;
      ctx.px.push(arrows(s, ap(m, ...p0), ap(m, ...p1), k));
    } else if (t === 'polygon') {
      const pts = kidsOf(n, 'hc:pt').map(q => [a(q, 'x'), a(q, 'y')]);
      if (pts.length) out += path('M' + pts.map(q => q.join(' ')).join('L'));
    } else if (t === 'curve') {
      out += path(curvePath(kidsOf(n, 'hp:seg')));
    } else if (t === 'pic') {
      const img = kid(n, 'hc:img');
      const url = img && img.image && ctx.imgUrl(img.image);
      const { w, h } = orgSize(n);
      const ir = kid(n, 'hp:imgRect');
      const q0 = ir ? pt(ir, 'hc:pt0') : [0, 0], q2 = ir ? pt(ir, 'hc:pt2') : [w, h];
      if (url) out += `<image href="${url}" x="${q0[0]}" y="${q0[1]}" width="${Math.max(1, q2[0] - q0[0])}" height="${Math.max(1, q2[1] - q0[1])}" preserveAspectRatio="none" transform="${svgMat(m)}"/>`;
      if (s) out += path(`M0 0H${w}V${h}H0Z`).replace(/ fill="[^"]*"/, ' fill="none"');
    } else if (FORM.has(t)) {
      // 양식 개체: 상자 + 글 (단추 이름 · 입력 내용 · 고른 값), 라디오·체크는 표시 기호
      const { w, h } = sizeOf(n), at = n.attrs || {};
      const W = Math.max(1, w * k), Hh = Math.max(1, h * k);
      const back = colorOf(at.backColor) || '#ffffff', fore = colorOf(at.foreColor) || '#000000';
      const txtNode = kid(n, 'hp:text');
      const label = t === 'edit' ? (txtNode && txtNode.txt) || '' : t === 'comboBox' ? at.selectedValue || '' : at.caption || '';
      const frame = at.drawFrame !== '0';
      let mark = '';
      if (t === 'radioBtn') mark = `<circle cx="${Hh / 2}" cy="${Hh / 2}" r="${Hh * 0.28}" fill="#fff" stroke="#555"/>${at.value === 'CHECKED' ? `<circle cx="${Hh / 2}" cy="${Hh / 2}" r="${Hh * 0.13}" fill="#222"/>` : ''}`;
      if (t === 'checkBtn') mark = `<rect x="${Hh * 0.22}" y="${Hh * 0.22}" width="${Hh * 0.56}" height="${Hh * 0.56}" fill="#fff" stroke="#555"/>${at.value === 'CHECKED' ? `<path d="M${Hh * 0.3} ${Hh * 0.5}L${Hh * 0.45} ${Hh * 0.66}L${Hh * 0.72} ${Hh * 0.32}" fill="none" stroke="#222"/>` : ''}`;
      const boxed = t !== 'radioBtn' && t !== 'checkBtn';
      const tx = mark ? Hh : 3, anchor = t === 'btn' ? 'middle' : 'start';
      ctx.px.push((boxed ? `<rect x="0" y="0" width="${W}" height="${Hh}" fill="${back}"${frame ? ' stroke="#7a7a7a"' : ''}/>` : '') + mark
        + (t === 'comboBox' ? `<path d="M${W - Hh * 0.75} ${Hh * 0.4}L${W - Hh * 0.5} ${Hh * 0.62}L${W - Hh * 0.25} ${Hh * 0.4}" fill="none" stroke="#444"/>` : '')
        + `<text x="${t === 'btn' ? W / 2 : tx}" y="${Hh / 2}" dominant-baseline="central" text-anchor="${anchor}" font-size="${Math.max(6, Hh * 0.5)}" fill="${fore}" font-family="'함초롬바탕','맑은 고딕',sans-serif">${escA(label)}</text>`);
    } else if (t === 'equation') {
      // 수식: 스크립트를 MathML 로 (글자 크기 = baseUnit/100 pt)
      const sc = kid(n, 'hp:script'), { w, h } = sizeOf(n);
      const ml = g.PureunEq ? g.PureunEq.toMathML(sc ? sc.txt || '' : '') : escA(sc ? sc.txt || '' : '');
      ctx.px.push(`<foreignObject x="0" y="0" width="${Math.max(1, w * k)}" height="${Math.max(1, h * k)}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" class="gso-eq" style="width:${Math.max(1, w * k)}px;height:${Math.max(1, h * k)}px;font-size:${a(n, 'baseUnit', 1000) / 100}pt;color:${(n.attrs && n.attrs.textColor) || '#000'}">${ml}</div></foreignObject>`);
    } else if (t === 'ole' || t === 'textart') {
      const { w, h } = orgSize(n);
      out += `<path d="M0 0H${w}V${h}H0Z" transform="${svgMat(m)}" fill="#f2f4f8" stroke="#9aa6bd" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>`;
    }
    ctx.px.push(textBox(n, m, ctx));
    return out;
  }
  // 한글의 곡선: 점들을 지나는 매끈한 선 (Catmull-Rom → 3차 베지어), 직선 구간은 그대로
  function curvePath(segs) {
    if (!segs.length) return '';
    const P = [[a(segs[0], 'x1'), a(segs[0], 'y1')]].concat(segs.map(sg => [a(sg, 'x2'), a(sg, 'y2')]));
    const closed = P.length > 2 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1];
    const get = i => (closed ? P[(i + P.length - 1) % (P.length - 1)] : P[Math.max(0, Math.min(P.length - 1, i))]);
    let d = `M${P[0][0]} ${P[0][1]}`;
    for (let i = 0; i < segs.length; i++) {
      const p0 = get(i - 1), p1 = P[i], p2 = P[i + 1], p3 = get(i + 2);
      if (segs[i].attrs.type === 'LINE') { d += `L${p2[0]} ${p2[1]}`; continue; }
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  // 화살표 (선의 시작·끝 모양)
  function arrows(s, p0, p1, k) {
    if (!s) return '';
    const one = (style, tip, from) => {
      if (!style || style === 'NORMAL') return '';
      const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
      const L = Math.max(s.w * 4, 160), W = L * 0.6;
      const rot = (x, y) => [tip[0] + x * Math.cos(ang) - y * Math.sin(ang), tip[1] + x * Math.sin(ang) + y * Math.cos(ang)];
      const P = (...q) => q.map(([x, y]) => rot(x, y)).map(q2 => q2.map(v => (v * k).toFixed(2)).join(' ')).join('L');
      const filled = !/EMPTY/.test(style);
      const paint = `fill="${filled ? s.color : '#fff'}" stroke="${s.color}" stroke-width="${Math.max(0.6, s.w * k)}"`;
      if (/DIAMOND/.test(style)) return `<path d="M${P([0, 0], [-L / 2, W / 2], [-L, 0], [-L / 2, -W / 2])}Z" ${paint}/>`;
      if (/CIRCLE/.test(style)) { const c = rot(-L / 2, 0); return `<circle cx="${c[0] * k}" cy="${c[1] * k}" r="${(L / 2) * k}" ${paint}/>`; }
      if (/BOX/.test(style)) return `<path d="M${P([0, -W / 2], [0, W / 2], [-L, W / 2], [-L, -W / 2])}Z" ${paint}/>`;
      if (style === 'CONCAVE_ARROW' || style === 'SPEAR') return `<path d="M${P([0, 0], [-L, W / 2], [-L * 0.7, 0], [-L, -W / 2])}Z" ${paint}/>`;
      return `<path d="M${P([0, 0], [-L, W / 2], [-L, -W / 2])}Z" ${paint}/>`;
    };
    return one(s.tail, p1, p0) + one(s.head, p0, p1);
  }
  // 글상자: 개체 경계 상자 안에 여백을 빼고 문단을 HTML 로
  function textBox(n, m, ctx) {
    const dt = kid(n, 'hp:drawText');
    if (!dt || !dt.text || !ctx.blocksHtml) return '';
    const b = bboxOf(n, m), tm = kid(dt, 'hp:textMargin'), k = ctx.k;
    const x = (b.x0 + a(tm, 'left')) * k, y = (b.y0 + a(tm, 'top')) * k;
    const w = Math.max(1, (b.x1 - b.x0 - a(tm, 'left') - a(tm, 'right')) * k), h = Math.max(1, (b.y1 - b.y0 - a(tm, 'top') - a(tm, 'bottom')) * k);
    const va = (dt.text.sub && dt.text.sub.vertAlign) || 'TOP';
    const just = va === 'CENTER' ? 'center' : va === 'BOTTOM' ? 'flex-end' : 'flex-start';
    // 세로쓰기 글상자 (VERTICAL: 영문 눕힘, VERTICALALL: 영문 세움 — HOME36 축하 글상자)
    const td = (dt.text.sub && dt.text.sub.textDirection) || '';
    const wm = /^VERTICAL/.test(td) ? `;writing-mode:vertical-rl${td === 'VERTICALALL' ? ';text-orientation:upright' : ''}` : '';
    return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" class="doc gso-text" style="width:${w}px;height:${h}px;justify-content:${just}${wm}">${ctx.blocksHtml(dt.text.blocks, td === 'VERTICALALL' ? 'upright' : wm ? 'mixed' : null)}</div></foreignObject>`;
  }

  // 최상위 개체 → <svg> (크기는 mm, 내부 좌표는 화면 px)
  function toSvg(n, opts = {}) {
    const { w, h } = sizeOf(n);
    const k = PX_PER_HU;
    const ctx = { k, defs: [], px: [], uid: opts.uidBase || 0, imgUrl: opts.imgUrl || (() => null), blocksHtml: opts.blocksHtml };
    // 최상위 개체: 자기 행렬로 그린 경계 상자를 (0,0)~(w,h) 에 맞춤
    let m0 = localMatrix(n);
    const b = bboxOf(n, m0);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    let fit = [1, 0, -b.x0, 0, 1, -b.y0];
    if (bw > 0 && bh > 0 && w > 0 && h > 0 && (Math.abs(bw - w) > 2 || Math.abs(bh - h) > 2)) fit = [w / bw, 0, -b.x0 * w / bw, 0, h / bh, -b.y0 * h / bh];
    m0 = mul(fit, m0);
    ctx.cfit = n.fit0 ? [n.fit0[0], 0, 0, 0, n.fit0[1], 0] : I;
    const body = draw(n, m0, ctx);
    const pw = Math.max(1, w * k), ph = Math.max(1, h * k);
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="gso-svg" viewBox="0 0 ${pw} ${ph}" width="${(w / HU_PER_MM).toFixed(2)}mm" height="${(h / HU_PER_MM).toFixed(2)}mm" overflow="visible">${ctx.defs.length ? '<defs>' + ctx.defs.join('') + '</defs>' : ''}<g transform="scale(${k})">${body}</g>${ctx.px.join('')}</svg>`, w, h, uid: ctx.uid };
  }

  // ---------- 새 개체 만들기 (입력 > 도형) ----------
  let seq = 0;
  const node = (tag, attrs, kids) => ({ tag, attrs: attrs || {}, kids: kids || [] });
  const rendering = () => node('hp:renderingInfo', {}, [node('hc:transMatrix', { e1: '1', e2: '0', e3: '0', e4: '0', e5: '1', e6: '0' }), node('hc:scaMatrix', { e1: '1', e2: '0', e3: '0', e4: '0', e5: '1', e6: '0' }), node('hc:rotMatrix', { e1: '1', e2: '0', e3: '0', e4: '0', e5: '1', e6: '0' })]);
  // kind: rect | ellipse | line | textbox, w·h: mm, place: { x, y }(mm, 문단 기준) , wrap
  function create(kind, wMm, hMm, opts = {}) {
    const w = Math.round(wMm * HU_PER_MM), h = Math.round(hMm * HU_PER_MM);
    const id = String(Date.now() % 1e9 + (++seq));
    const tag = kind === 'textbox' ? 'hp:rect' : 'hp:' + kind;
    const common = { id, zOrder: String(opts.zOrder || 0), numberingType: 'PICTURE', textWrap: opts.wrap || (kind === 'line' ? 'IN_FRONT_OF_TEXT' : 'TOP_AND_BOTTOM'), textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', href: '', groupLevel: '0', instid: id };
    if (kind === 'rect' || kind === 'textbox') common.ratio = '0';
    if (kind === 'ellipse') Object.assign(common, { intervalDirty: '0', hasArcPr: '0', arcType: 'NORMAL' });
    if (kind === 'line') common.isReverseHV = '0';
    const kids = [node('hp:offset', { x: '0', y: '0' }), node('hp:orgSz', { width: String(w), height: String(h) }), node('hp:curSz', { width: String(w), height: String(h) }),
      node('hp:flip', { horizontal: '0', vertical: '0' }), node('hp:rotationInfo', { angle: '0', centerX: String(w >> 1), centerY: String(h >> 1), rotateimage: '1' }), rendering(),
      node('hp:lineShape', { color: opts.line || '#000000', width: String(opts.lineWidth || 33), style: 'SOLID', endCap: 'FLAT', headStyle: 'NORMAL', tailStyle: opts.arrow ? 'ARROW' : 'NORMAL', headfill: '1', tailfill: '1', headSz: 'MEDIUM_MEDIUM', tailSz: 'MEDIUM_MEDIUM', outlineStyle: 'NORMAL', alpha: '0' })];
    if (kind !== 'line') kids.push(node('hc:fillBrush', {}, [node('hc:winBrush', { faceColor: opts.fill || (kind === 'textbox' ? '#FFFFFF' : 'none'), hatchColor: '#000000', alpha: '0' })]));
    kids.push(node('hp:shadow', { type: 'NONE', color: '#B2B2B2', offsetX: '0', offsetY: '0', alpha: '0' }));
    if (kind === 'textbox') {
      kids.push(Object.assign(node('hp:drawText', { lastWidth: String(w), name: '', editable: '0' }, [node('hp:textMargin', { left: '283', right: '283', top: '283', bottom: '283' })]),
        { text: { sub: { id: '', textDirection: 'HORIZONTAL', lineWrap: 'BREAK', vertAlign: 'TOP', linkListIDRef: '0', linkListNextIDRef: '0', textWidth: '0', textHeight: '0', hasTextRef: '0', hasNumRef: '0' }, blocks: opts.blocks || [{ type: 'p', runs: [] }] } }));
    }
    if (kind === 'rect' || kind === 'textbox') kids.push(node('hc:pt0', { x: '0', y: '0' }), node('hc:pt1', { x: String(w), y: '0' }), node('hc:pt2', { x: String(w), y: String(h) }), node('hc:pt3', { x: '0', y: String(h) }));
    if (kind === 'ellipse') kids.push(node('hc:center', { x: String(w >> 1), y: String(h >> 1) }), node('hc:ax1', { x: String(w), y: String(h >> 1) }), node('hc:ax2', { x: String(w >> 1), y: '0' }),
      node('hc:start1', { x: '0', y: '0' }), node('hc:end1', { x: '0', y: '0' }), node('hc:start2', { x: '0', y: '0' }), node('hc:end2', { x: '0', y: '0' }));
    if (kind === 'line') {
      // 한글처럼 100×100 기본 상자에 그리고 크기 행렬로 늘림 (높이 0 인 선도 한글이 그림)
      Object.assign(kids[1].attrs, { width: '100', height: '100' });
      Object.assign(kids[4].attrs, { centerX: String(w >> 1), centerY: String(h >> 1) });
      const sca = kids[5].kids[1];
      Object.assign(sca.attrs, { e1: String(w / 100), e5: String(h / 100) });
      kids.push(node('hc:startPt', { x: '0', y: '0' }), node('hc:endPt', { x: '100', y: '100' }));
    }
    kids.push(node('hp:sz', { width: String(w), widthRelTo: 'ABSOLUTE', height: String(h), heightRelTo: 'ABSOLUTE', protect: '0' }),
      node('hp:pos', { treatAsChar: opts.inline ? '1' : '0', affectLSpacing: '0', flowWithText: '1', allowOverlap: '1', holdAnchorAndSO: '0', vertRelTo: 'PARA', horzRelTo: 'COLUMN', vertAlign: 'TOP', horzAlign: 'LEFT', vertOffset: String(Math.round((opts.y || 0) * HU_PER_MM)), horzOffset: String(Math.round((opts.x || 0) * HU_PER_MM)) }),
      node('hp:outMargin', { left: '0', right: '0', top: '0', bottom: '0' }));
    return node(tag, common, kids);
  }

  // 속성 바꾸기 (개체 속성 대화상자): 크기(mm)·위치·선·채우기·배치
  function setAttr(n, tag, attrs) { const k = kid(n, tag); if (k) Object.assign(k.attrs, attrs); else (n.kids = n.kids || []).push(node(tag, attrs)); }
  function resize(n, wMm, hMm) {
    const old = sizeOf(n), w = Math.round(wMm * HU_PER_MM), h = Math.round(hMm * HU_PER_MM);
    if (!old.w || !old.h || (old.w === w && old.h === h)) return;
    const sx = w / old.w, sy = h / old.h;
    // 묶음: 자손은 처음 크기 상자 좌표 그대로이므로 바꾼 비율을 따로 쌓아 그릴 때 곱함
    if (local(n.tag) === 'container') n.fit0 = [(n.fit0 ? n.fit0[0] : 1) * sx, (n.fit0 ? n.fit0[1] : 1) * sy];
    // 크기 행렬에 비율을 곱해 원래 좌표는 그대로 두고 크기만 바꿈 (한글과 같은 방식)
    const ri = kid(n, 'hp:renderingInfo');
    const sca = ri && kidsOf(ri, 'hc:scaMatrix').pop();
    if (sca) { const mm = matOf(sca); Object.assign(sca.attrs, { e1: String(mm[0] * sx), e2: String(mm[1] * sx), e4: String(mm[3] * sy), e5: String(mm[4] * sy) }); }
    setAttr(n, 'hp:curSz', { width: String(w), height: String(h) });
    setAttr(n, 'hp:sz', { width: String(w), height: String(h) });
    const dt = kid(n, 'hp:drawText');
    if (dt) dt.attrs.lastWidth = String(w);
  }

  // 새 수식 (크기는 화면에서 잰 값, mm)
  function createEquation(script, wMm, hMm) {
    const id = String(Date.now() % 1e9 + (++seq));
    const w = Math.max(100, Math.round(wMm * HU_PER_MM)), h = Math.max(100, Math.round(hMm * HU_PER_MM));
    const sc = node('hp:script'); sc.txt = script;
    const cm = node('hp:shapeComment'); cm.txt = '수식입니다.';
    return node('hp:equation', { id, zOrder: '0', numberingType: 'EQUATION', textWrap: 'TOP_AND_BOTTOM', textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', version: 'Equation Version 60', baseLine: '86', textColor: '#000000', baseUnit: '1000', lineMode: 'CHAR', font: 'HancomEQN' }, [
      node('hp:sz', { width: String(w), widthRelTo: 'ABSOLUTE', height: String(h), heightRelTo: 'ABSOLUTE', protect: '0' }),
      node('hp:pos', { treatAsChar: '1', affectLSpacing: '0', flowWithText: '1', allowOverlap: '0', holdAnchorAndSO: '0', vertRelTo: 'PARA', horzRelTo: 'PARA', vertAlign: 'TOP', horzAlign: 'LEFT', vertOffset: '0', horzOffset: '0' }),
      node('hp:outMargin', { left: '56', right: '56', top: '0', bottom: '0' }), cm, sc]);
  }

  const clone = n => JSON.parse(JSON.stringify(n, (k, v) => (v instanceof Uint8Array ? { __bytes: Array.from(v) } : v)), (k, v) => (v && v.__bytes ? new Uint8Array(v.__bytes) : v));

  g.PureunShape = { isShapeTag, local, kid, kidsOf, sizeOf, posOf, toSvg, create, createEquation, resize, setAttr, clone, HU_PER_MM, PX_PER_HU, escA };
})(typeof window !== 'undefined' ? window : globalThis);
