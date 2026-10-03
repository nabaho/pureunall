/* ══════════════════════════════════════════════════════════════════
   pu-kordoc-text.js — kordoc 로 원본을 읽어 «규정관리가 읽는 글» 로 (2026-09-30)

   kordoc(vendor/kordoc, MIT)는 한글·워드 문서를 문단·제목·표로 돌려준다. 표를 칸 그대로
   돌려주므로, 노동부 표준취업규칙처럼 «조문 칸 | 해설(작성시 착안사항) 칸» 인 큰 표에서
   조문 칸만 정확히 집을 수 있다 — 글줄 모양으로 해설을 짐작해 떼던 것(stripCommentary)보다 정확하다.

   ⚠ 브라우저 안에서만 읽는다(원본을 서버로 보내지 않는다). 묶음은 1.4MB 라 쓸 때 처음 한 번 싣는다.
   ⚠ 못 읽으면(PDF·RTF·ODT·엔진 실패) null — 부르는 쪽이 예전 읽개로 돌아간다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (!root || root.PuKordocText) return;

  var SRC = 'vendor/kordoc/kordoc.browser.min.js?v=2';
  var TAG = /^\s*(\[(?:필수|선택)(?:\s*[,·ㆍ]\s*(?:필수|선택))*\]|☞|◈)/;
  var mod = null;

  function load() {
    if (!mod) mod = import(new URL(SRC, root.location ? root.location.href : 'http://x/').href);
    return mod;
  }
  /* 한글(.hwp=OLE2)·ZIP(.hwpx·.docx·.xlsx) 만 — PDF 는 이 묶음에 PDF 부품이 없어 예전 읽개가 읽는다 */
  function canRead(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
    if (b.length < 8) return false;
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return true;
    return b[0] === 0x50 && b[1] === 0x4B;
  }
  function cellText(c) { return c ? String(c.text || '').replace(/\r/g, '') : ''; }

  /* 해설판 표인가 — 머리 줄에 「착안사항」 이 있거나, 둘째 칸이 [필수]·[선택]·☞ 로 시작하는 줄이 절반 넘을 때.
     해설 칸 번호를 돌려준다(없으면 -1) */
  function commentaryCol(t) {
    var rows = t.cells || [];
    for (var r = 0; r < Math.min(rows.length, 2); r++) {
      for (var c = 1; c < (rows[r] || []).length; c++) if (/착안\s*사항/.test(cellText(rows[r][c]))) return c;
    }
    if ((t.cols || 0) < 2) return -1;
    var body = rows.filter(function (row) { return row && row.length >= 2 && cellText(row[0]).trim(); });
    if (body.length < 2) return -1;
    var tagged = body.filter(function (row) { return TAG.test(cellText(row[1])); }).length;
    return tagged * 2 > body.length ? 1 : -1;
  }

  /* 블록 → 글. 문단·제목은 한 덩이씩(빈 줄로 가름), 표는 칸마다 한 덩이 —
     해설판 표는 조문 칸만. 머리 줄(「취업규칙(안)」 따위)은 뺀다 */
  function toText(blocks) {
    var out = [], cut = 0, tables = 0;
    (blocks || []).forEach(function (b) {
      if (!b) return;
      if (b.type === 'table' && b.table) {
        tables++;
        var t = b.table, cc = commentaryCol(t);
        (t.cells || []).forEach(function (row, r) {
          if (!row) return;
          if (cc >= 0) {
            if (r === 0 && (row[0] && row[0].isHeader || /착안\s*사항/.test(row.map(cellText).join(' ')))) return;
            if (row[cc] && cellText(row[cc]).trim()) cut++;
            row.forEach(function (c, i) { if (i !== cc && cellText(c).trim()) out.push(cellText(c)); });
            return;
          }
          row.forEach(function (c) { if (cellText(c).trim()) out.push(cellText(c)); });
        });
        return;
      }
      var s = String(b.text || '');
      if (s.trim()) out.push(s);
    });
    return { text: out.join('\n\n'), commentaryCells: cut, tables: tables };
  }

  /* 읽기 — 성공하면 { text, commentaryCells, tables, via:'kordoc' }, 못 읽으면 null */
  async function read(buf) {
    if (!canRead(buf)) return null;
    var K = await load();
    var r = await K.parse(new Uint8Array(buf instanceof ArrayBuffer ? buf.slice(0) : buf), { ocr: false });
    if (!r || !r.success || !Array.isArray(r.blocks)) return null;
    var o = toText(r.blocks);
    if (o.text.replace(/\s/g, '').length < 20) return null;
    o.via = 'kordoc';
    return o;
  }

  /* ══ 개인정보 가림 (2026-09-30 ② — 서고에 올릴 때) ══
     kordoc 의 가림 엔진을 브라우저 안에서 돌린다. 원래 번호는 «돌려주지도 적지도» 않는다 —
     kordoc 가 찾은 곳 보고에 가린 모양(「900101-●●●●●●●」)만 담기 때문이다.
     기본 규칙(대표 승인 「추천대로」): 주민·외국인번호 · 계좌·카드 · 전화 · 전자우편 · 여권·운전면허.
     사업자번호는 서고가 사업장을 가르는 열쇠라 두고, 이름·주소는 헛잡기가 많아 끈다(켤 수 있다). */
  var PII_GROUPS = [
    { key: 'rrn', label: '주민·외국인번호', rules: ['rrn'], on: true },
    { key: 'money', label: '계좌·카드', rules: ['account', 'card'], on: true },
    { key: 'phone', label: '전화번호', rules: ['phone'], on: true },
    { key: 'email', label: '전자우편', rules: ['email'], on: true },
    { key: 'id', label: '여권·운전면허', rules: ['passport', 'driver'], on: true },
    { key: 'brn', label: '사업자번호', rules: ['brn'], on: false, why: '사업장 열쇠' },
    { key: 'person', label: '이름·주소', rules: ['name', 'address'], on: false, why: '헛잡기 많음' }
  ];
  var RULE_LABEL = { rrn: '주민', account: '계좌', card: '카드', phone: '전화', email: '전자우편', passport: '여권', driver: '면허', brn: '사업자번호', name: '이름', address: '주소' };
  function rulesOf(groupKeys) {
    var on = groupKeys || PII_GROUPS.filter(function (g) { return g.on; }).map(function (g) { return g.key; });
    return PII_GROUPS.filter(function (g) { return on.indexOf(g.key) >= 0; })
      .reduce(function (a, g) { return a.concat(g.rules); }, []);
  }
  /* 찾은 곳 세기 — 같은 곳을 두 번(본문·미리보기 글) 세지 않게 규칙·가린 모양으로 한 번씩 */
  function tally(hits) {
    var count = {}, seen = {}, samples = [];
    (hits || []).forEach(function (h) {
      var k = h.rule + '|' + h.masked + '|' + (h.index != null ? h.index : '');
      if (seen[k]) return;
      seen[k] = 1;
      count[h.rule] = (count[h.rule] || 0) + 1;
      if (samples.length < 6) samples.push({ rule: h.rule, masked: String(h.masked || '') });
    });
    var total = Object.keys(count).reduce(function (a, r) { return a + count[r]; }, 0);
    return { count: count, total: total, samples: samples };
  }
  function countLabel(count) {
    return Object.keys(count || {}).map(function (r) { return (RULE_LABEL[r] || r) + ' ' + count[r]; }).join(' · ');
  }
  function isHwpBytes(b) {
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return true;
    var head = '';
    for (var i = 30; i < Math.min(b.length, 120); i++) head += String.fromCharCode(b[i]);
    return b[0] === 0x50 && b[1] === 0x4B && /^mimetype/.test(head) && head.indexOf('hwp+zip') > 0;
  }
  /* 한 파일 가리기.
     한글(.hwp·.hwpx) — 파일째 서식 그대로 가리고, 가린 파일을 다시 읽어 «남은 것» 까지 본다.
       돌려주는 것: { fileOk:true, data(가린 파일 바이트), text(가린 파일에서 읽은 글), residual(남은 수), … }
     그 밖(PDF·워드·글) — 파일째 가리는 기능이 없다. 글만 가린다: { fileOk:false, text, … }
     찾은 것이 없으면 data 는 null(원본 그대로 담는다). */
  async function redactFile(buf, text, groupKeys) {
    var K = await load();
    var rules = rulesOf(groupKeys);
    var bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf.slice(0) : buf || []);
    if (bytes.length > 8 && isHwpBytes(bytes)) {
      var r = await K.redactDocument(bytes, { rules: rules });
      var t = tally((r.markdownHits || []).length ? r.markdownHits : r.fileHits);
      var out = { fileOk: true, format: r.format, total: t.total, count: t.count, samples: t.samples,
        residual: (r.residual || []).length, unscanned: (r.unscanned || []).length, data: null, text: text };
      if (t.total && r.data && r.changed) {
        out.data = r.data;
        var back = await read(r.data);
        out.text = back ? back.text : text;
        if (!back) out.residual = Math.max(out.residual, 1);   // 가린 파일을 다시 못 읽으면 믿지 않는다
      }
      return out;
    }
    var p = K.redactText(String(text || ''), { rules: rules });
    var t2 = tally(p.hits);
    return { fileOk: false, format: '', total: t2.total, count: t2.count, samples: t2.samples,
      residual: 0, unscanned: 0, data: null, text: t2.total ? p.text : text };
  }

  root.PuKordocText = { SRC: SRC, load: load, canRead: canRead, toText: toText, commentaryCol: commentaryCol, read: read,
    PII_GROUPS: PII_GROUPS, rulesOf: rulesOf, tally: tally, countLabel: countLabel, redactFile: redactFile,
    /* 검사용 — node 에는 location 이 없어 묶음을 밖에서 넣는다 */
    _use: function (m) { mod = Promise.resolve(m); } };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).PuKordocText;
}
