'use strict';
/* 정부컨설팅 보고서 2단계 — 기관의 빈 양식 HWPX(바이트)를 PuGovReport.fillForm 으로 채워 다시 묶는다
   (브라우저 window.PuGovReportPack / Node 겸용 · 계획 docs/superpowers/plans/2026-10-09-gov-report-step2-ui.md Task 2)
   무엇을 지키나
     · 묶음 첫 항목은 mimetype, 무압축(STORE). 나머지는 DEFLATE.
     · 채우는 것은 Contents/section0.xml 하나(지도는 section0 기준). 나머지 항목은 그대로 둔다.
     · 지난 업체 흔적을 지운다: 미리보기 그림·글, content.hpf 의 제목·메타 값. 그림을 지웠으니 더는 아무 데서도
       안 쓰는 BinData 와 content.hpf 의 opf:item 도 지운다(쓰는 것은 그대로).
     · JSZip 은 인자로 받는다(전역에 기대지 않는다).
   ⚠ 저장소는 공개다 — 실제 양식·업체 자료를 넣지 않는다(검사는 합성 XML). */
(function (root) {
  var G = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report.js') : root.PuGovReport;
  var SEC = 'Contents/section0.xml', HPF = 'Contents/content.hpf';

  function b64ToBytes(s) {
    var bin = atob(String(s || '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesToB64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  }
  function attr(tag, name) {
    var m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag);
    return m ? m[1] : null;
  }
  function normHref(h) { return String(h || '').replace(/^\.\//, ''); }

  /* content.hpf — 제목·메타 값을 비우고, 지워진 파일(gone)과 안 쓰이는 BinData 의 opf:item 을 뺀다 */
  function scrubHpf(hpf, gone, refs) {
    var dropped = [];
    hpf = hpf.replace(/(<opf:title\b[^>]*>)[^<]*(<\/opf:title>)/g, '$1$2')
      .replace(/(<opf:meta\b[^>]*>)[^<]*(<\/opf:meta>)/g, '$1$2')
      .replace(/<opf:item\b[^>]*\/>/g, function (tag) {
        var href = normHref(attr(tag, 'href')), id = attr(tag, 'id');
        if (gone[href]) { dropped.push(href); return ''; }
        if (/^BinData\//i.test(href) && !(id && refs.ids[id]) && !refs.text.some(function (t) { return t.indexOf(href) >= 0; })) {
          dropped.push(href); return '';
        }
        return tag;
      });
    return { hpf: hpf, dropped: dropped };
  }

  /* 포장을 새로 묶는다. fill = null 이면 채우지 않고 닦기만 한다 */
  async function repack(bytes, JSZip, fill) {
    var zin = await JSZip.loadAsync(bytes), names = Object.keys(zin.files).filter(function (n) { return !zin.files[n].dir; });
    var data = {}, result = null;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      data[n] = /\.(xml|hpf|txt|rdf)$/i.test(n) || n === 'mimetype' ? await zin.file(n).async('string') : await zin.file(n).async('uint8array');
    }
    if (fill && data[SEC] != null) { result = fill(data[SEC]); data[SEC] = result.xml; }
    var gone = {};
    names.forEach(function (n) { if (/^Preview\/PrvImage/i.test(n)) { gone[n] = true; delete data[n]; } });
    if (data['Preview/PrvText.txt'] != null) data['Preview/PrvText.txt'] = '';
    /* 쓰이는 BinData 확인 — Contents 안 xml(section·header)의 binaryItemIDRef / href */
    var refs = { ids: {}, text: [] };
    Object.keys(data).forEach(function (n) {
      if (!/^Contents\/.*\.xml$/i.test(n) || typeof data[n] !== 'string') return;
      refs.text.push(data[n]);
      data[n].replace(/\bbinaryItemIDRef="([^"]*)"/g, function (_, id) { refs.ids[id] = true; return _; });
    });
    if (data[HPF] != null) {
      var sc = scrubHpf(data[HPF], gone, refs);
      data[HPF] = sc.hpf;
      sc.dropped.forEach(function (h) { delete data[h]; });
    }
    var zout = new JSZip();
    if (data.mimetype != null) zout.file('mimetype', data.mimetype, { compression: 'STORE' });
    Object.keys(data).forEach(function (n) {
      if (n === 'mimetype') return;
      zout.file(n, data[n], { compression: 'DEFLATE' });
    });
    var out = await zout.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { bytes: out, result: result, sections: names.filter(function (n) { return /^Contents\/section\d+\.xml$/i.test(n); }).length };
  }

  async function fillHwpx(bytes, formKey, fileKey, report, JSZip) {
    var r = await repack(bytes, JSZip, function (xml) { return G.fillForm(xml, formKey, fileKey, report); });
    if (!r.result) throw new Error('양식에 ' + SEC + ' 이(가) 없습니다');
    var res = {}; Object.keys(r.result).forEach(function (k) { if (k !== 'xml') res[k] = r.result[k]; });
    return { bytes: r.bytes, result: res };
  }

  /* 서고 등록 대조 — 빈 자료로 돌려 «지도 칸이 양식에 없는지(missing)» 만 본다 */
  async function checkTemplate(bytes, formKey, fileKey, JSZip) {
    var zin = await JSZip.loadAsync(bytes), xml = await (zin.file(SEC) ? zin.file(SEC).async('string') : Promise.resolve(null));
    var sections = Object.keys(zin.files).filter(function (n) { return /^Contents\/section\d+\.xml$/i.test(n); }).length;
    if (xml == null) return { missing: [SEC], sections: sections };
    var r = G.fillForm(xml, formKey, fileKey, { company: {}, rounds: [], summary: {} });
    return { missing: r.missing, sections: sections };
  }

  var api = { fillHwpx: fillHwpx, checkTemplate: checkTemplate, b64ToBytes: b64ToBytes, bytesToB64: bytesToB64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportPack = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);