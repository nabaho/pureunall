// WMF(윈도 메타파일) 그림 → SVG. 한글 서식의 클립아트가 WMF 인 경우가 많아 화면 표시용으로 변환 (저장은 원본 그대로)
(function (g) {
  const dv = d => new DataView(d.buffer, d.byteOffset, d.byteLength);

  function toSvg(bytes) {
    const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const v = dv(d);
    let o = 0;
    let bbox = null;
    if (d.length >= 22 && v.getUint32(0, true) === 0x9ac6cdd7) {
      bbox = { l: v.getInt16(6, true), t: v.getInt16(8, true), r: v.getInt16(10, true), b: v.getInt16(12, true) };
      o = 22;
    }
    const headerWords = v.getUint16(o + 2, true) || 9;
    const nObj = v.getUint16(o + 10, true);
    o += headerWords * 2;
    const objs = new Array(Math.max(nObj, 1)).fill(null);
    const add = obj => { let i = objs.indexOf(null); if (i < 0) { i = objs.length; objs.push(null); } objs[i] = obj; };
    let st = { pen: { style: 0, w: 0, color: '#000' }, brush: { style: 0, color: '#fff' }, font: { h: 12, weight: 400, italic: false, face: '', esc: 0 },
      text: '#000', bk: '#fff', bkMode: 2, fill: 'evenodd', align: 0, x: 0, y: 0 };
    const stack = [];
    let win = { x: bbox ? bbox.l : 0, y: bbox ? bbox.t : 0, w: bbox ? bbox.r - bbox.l : 1000, h: bbox ? bbox.b - bbox.t : 1000 };
    let winSet = false;
    const out = [];
    const col = c => '#' + [c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map(x => x.toString(16).padStart(2, '0')).join('');
    const DASH = { 1: '18 6', 2: '3 3', 3: '9 6 3 6', 4: '9 3 3 3 3 3' };
    const stroke = () => {
      const p = st.pen;
      if ((p.style & 15) === 5) return ' stroke="none"';
      const w = p.w > 0 ? p.w : 1;
      return ` stroke="${p.color}" stroke-width="${w}"${p.w > 0 ? '' : ' vector-effect="non-scaling-stroke"'}${DASH[p.style & 15] ? ` stroke-dasharray="${DASH[p.style & 15]}"` : ''} stroke-linejoin="round"`;
    };
    const fill = () => (st.brush.style === 1 ? ' fill="none"' : ` fill="${st.brush.color}" fill-rule="${st.fill}"`);
    const pts = (k, n) => { const a = []; for (let i = 0; i < n; i++) a.push(v.getInt16(k + i * 4, true) + ',' + v.getInt16(k + i * 4 + 2, true)); return a; };
    let euckr = null;
    try { euckr = new TextDecoder('euc-kr'); } catch (e) { euckr = null; }
    const dec = bs => { try { return (euckr || new TextDecoder()).decode(bs); } catch (e) { return ''; } };
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const textAt = (x, y, s) => {
      if (!s.trim()) return;
      const f = st.font, h = Math.abs(f.h) || 12;
      const anchor = (st.align & 6) === 6 ? 'middle' : (st.align & 2) ? 'end' : 'start';
      const base = (st.align & 24) === 24 ? 'alphabetic' : (st.align & 8) ? 'text-after-edge' : 'text-before-edge';
      const rot = f.esc ? ` transform="rotate(${-f.esc / 10} ${x} ${y})"` : '';
      out.push(`<text x="${x}" y="${y}" font-size="${h}" font-family="${esc(f.face || '굴림')}" font-weight="${f.weight >= 600 ? 'bold' : 'normal'}"${f.italic ? ' font-style="italic"' : ''} fill="${st.text}" text-anchor="${anchor}" dominant-baseline="${base}"${rot}>${esc(s)}</text>`);
    };
    // DIB(비트맵) → BMP 파일 → data URL
    const dibUrl = (k, end) => {
      const dib = d.subarray(k, end);
      if (dib.length < 40) return null;
      const hv = dv(dib), hs = hv.getUint32(0, true), bits = hv.getUint16(14, true), clr = hv.getUint32(32, true);
      const pal = bits <= 8 ? (clr || (1 << bits)) * 4 : (hv.getUint32(16, true) === 3 ? 12 : 0);
      const bmp = new Uint8Array(14 + dib.length), bv = dv(bmp);
      bmp[0] = 0x42; bmp[1] = 0x4d; bv.setUint32(2, bmp.length, true); bv.setUint32(10, 14 + hs + pal, true);
      bmp.set(dib, 14);
      let s = '';
      for (let i = 0; i < bmp.length; i += 0x8000) s += String.fromCharCode.apply(null, bmp.subarray(i, i + 0x8000));
      return 'data:image/bmp;base64,' + btoa(s);
    };
    for (let guard = 0; o + 6 <= d.length && guard < 200000; guard++) {
      const size = v.getUint32(o, true), fn = v.getUint16(o + 4, true), p = o + 6, end = o + size * 2;
      if (size < 3 || end > d.length) break;
      const w = k => v.getInt16(p + k * 2, true), uw = k => v.getUint16(p + k * 2, true), dw = k => v.getUint32(p + k * 2, true);
      switch (fn) {
        case 0x0000: o = d.length; continue;
        case 0x020b: win.y = w(0); win.x = w(1); break; // SETWINDOWORG
        case 0x020c: win.h = w(0); win.w = w(1); winSet = true; break; // SETWINDOWEXT
        case 0x0102: st.bkMode = uw(0); break;
        case 0x0106: st.fill = uw(0) === 2 ? 'nonzero' : 'evenodd'; break;
        case 0x0201: st.bk = col(dw(0)); break;
        case 0x0209: st.text = col(dw(0)); break;
        case 0x012e: st.align = uw(0); break;
        case 0x02fa: add({ t: 'pen', style: uw(0), w: w(1), color: col(dw(3)) }); break;
        case 0x02fc: add({ t: 'brush', style: uw(0), color: col(dw(1)) }); break;
        case 0x02fb: { // CREATEFONTINDIRECT
          const face = d.subarray(p + 18, Math.min(end, p + 50)); const z = face.indexOf(0);
          add({ t: 'font', h: w(0), esc: w(2), weight: w(4), italic: !!d[p + 10], face: dec(face.subarray(0, z < 0 ? face.length : z)) }); break;
        }
        case 0x00f7: case 0x0142: case 0x01f9: case 0x06ff: add({ t: 'other' }); break; // 팔레트·무늬 붓·영역: 번호 자리만 차지
        case 0x012d: { const ob = objs[uw(0)]; if (ob) { if (ob.t === 'pen') st.pen = ob; else if (ob.t === 'brush') st.brush = ob; else if (ob.t === 'font') st.font = ob; } break; }
        case 0x01f0: objs[uw(0)] = null; break;
        case 0x001e: stack.push(JSON.parse(JSON.stringify(st))); break;
        case 0x0127: if (stack.length) st = stack.pop(); break;
        case 0x0214: st.y = w(0); st.x = w(1); break;
        case 0x0213: { const y = w(0), x = w(1); out.push(`<path d="M${st.x},${st.y}L${x},${y}" fill="none"${stroke()}/>`); st.x = x; st.y = y; break; }
        case 0x0324: { const n = uw(0); out.push(`<polygon points="${pts(p + 2, n).join(' ')}"${fill()}${stroke()}/>`); break; }
        case 0x0325: { const n = uw(0); out.push(`<polyline points="${pts(p + 2, n).join(' ')}" fill="none"${stroke()}/>`); break; }
        case 0x0538: { // POLYPOLYGON
          const np = uw(0), counts = []; for (let i = 0; i < np; i++) counts.push(uw(1 + i));
          let k = p + 2 + np * 2, dd = '';
          for (const n of counts) { dd += 'M' + pts(k, n).join('L') + 'Z'; k += n * 4; }
          out.push(`<path d="${dd}"${fill()}${stroke()}/>`); break;
        }
        case 0x041b: { const b = w(0), r = w(1), t = w(2), l = w(3); out.push(`<rect x="${Math.min(l, r)}" y="${Math.min(t, b)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}"${fill()}${stroke()}/>`); break; }
        case 0x061c: { const rh = w(0), rw = w(1), b = w(2), r = w(3), t = w(4), l = w(5); out.push(`<rect x="${Math.min(l, r)}" y="${Math.min(t, b)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" rx="${Math.abs(rw) / 2}" ry="${Math.abs(rh) / 2}"${fill()}${stroke()}/>`); break; }
        case 0x0418: { const b = w(0), r = w(1), t = w(2), l = w(3); out.push(`<ellipse cx="${(l + r) / 2}" cy="${(t + b) / 2}" rx="${Math.abs(r - l) / 2}" ry="${Math.abs(b - t) / 2}"${fill()}${stroke()}/>`); break; }
        case 0x0817: case 0x081a: case 0x0830: { // ARC · PIE · CHORD
          const ye = w(0), xe = w(1), ys = w(2), xs = w(3), b = w(4), r = w(5), t = w(6), l = w(7);
          const cx = (l + r) / 2, cy = (t + b) / 2, rx = Math.abs(r - l) / 2, ry = Math.abs(b - t) / 2;
          const at = (x, y) => Math.atan2((y - cy) / (ry || 1), (x - cx) / (rx || 1));
          const a0 = at(xs, ys), a1 = at(xe, ye);
          const P = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
          let sweep = a0 - a1; if (sweep <= 0) sweep += Math.PI * 2; // 시계 반대 방향
          const s0 = P(a0), s1 = P(a1), large = sweep > Math.PI ? 1 : 0;
          let dd = `M${s0[0]},${s0[1]}A${rx},${ry} 0 ${large} 0 ${s1[0]},${s1[1]}`;
          if (fn === 0x081a) dd += `L${cx},${cy}Z`; else if (fn === 0x0830) dd += 'Z';
          out.push(`<path d="${dd}"${fn === 0x0817 ? ' fill="none"' : fill()}${stroke()}/>`); break;
        }
        case 0x0521: { const n = uw(0), s = dec(d.subarray(p + 2, p + 2 + n)), k = p + 2 + ((n + 1) & ~1); textAt(v.getInt16(k + 2, true), v.getInt16(k, true), s); break; }
        case 0x0a32: { const y = w(0), x = w(1), n = uw(2), opt = uw(3); const k = p + 8 + (opt & 6 ? 8 : 0); textAt(x, y, dec(d.subarray(k, k + n))); break; }
        case 0x0f43: { // STRETCHDIB
          const dh = w(7), dwid = w(8), y = w(9), x = w(10), url = dibUrl(p + 22, end);
          if (url) out.push(`<image href="${url}" x="${Math.min(x, x + dwid)}" y="${Math.min(y, y + dh)}" width="${Math.abs(dwid)}" height="${Math.abs(dh)}" preserveAspectRatio="none"/>`); break;
        }
        case 0x0b41: { // DIBSTRETCHBLT
          const dh = w(6), dwid = w(7), y = w(8), x = w(9), url = size * 2 > 26 ? dibUrl(p + 20, end) : null;
          if (url) out.push(`<image href="${url}" x="${Math.min(x, x + dwid)}" y="${Math.min(y, y + dh)}" width="${Math.abs(dwid)}" height="${Math.abs(dh)}" preserveAspectRatio="none"/>`); break;
        }
        case 0x0940: { // DIBBITBLT
          const hh = w(4), ww = w(5), y = w(6), x = w(7), url = size * 2 > 22 ? dibUrl(p + 16, end) : null;
          if (url) out.push(`<image href="${url}" x="${x}" y="${y}" width="${ww}" height="${hh}" preserveAspectRatio="none"/>`); break;
        }
        default: break;
      }
      o = end;
    }
    if (!winSet && bbox) win = { x: bbox.l, y: bbox.t, w: bbox.r - bbox.l, h: bbox.b - bbox.t };
    // 창 크기가 음수면 뒤집힌 좌표계
    const sx = win.w < 0 ? -1 : 1, sy = win.h < 0 ? -1 : 1;
    const vb = [Math.min(win.x, win.x + win.w), Math.min(win.y, win.y + win.h), Math.abs(win.w) || 1, Math.abs(win.h) || 1];
    const flip = sx < 0 || sy < 0 ? ` transform="translate(${sx < 0 ? 2 * win.x + win.w : 0} ${sy < 0 ? 2 * win.y + win.h : 0}) scale(${sx} ${sy})"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" preserveAspectRatio="none"><g${flip}>${out.join('')}</g></svg>`;
  }

  const cache = new WeakMap();
  // 화면 표시용 URL: WMF 는 SVG 로 바꿔서, 그 밖은 그대로
  function displayUrl(img) {
    if (!img || !img.data) return null;
    if (cache.has(img)) return cache.get(img);
    let url;
    if (/wmf/i.test(img.mime || '')) {
      try { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toSvg(img.data)); } catch (e) { url = null; }
    }
    if (!url) {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) url = URL.createObjectURL(new Blob([img.data], { type: img.mime || 'image/png' }));
      else url = null;
    }
    cache.set(img, url);
    return url;
  }

  g.PureunWmf = { toSvg, displayUrl };
})(typeof window !== 'undefined' ? window : globalThis);
