'use strict';
/* ══ 기업별 계약 기록 — 엑셀 업체명단 읽기 (설계 2026-10-03-계약서류-표준-기록 §3 (가), 목업 승인 「진행」) ══
   푸른문서양식\급여위임계약서_양식.xlsx 의 「업체명단」(연번·사업장명·담당자·계약체결일·사업자등록번호·업태·종목·
   대표자·주소·실무자/전화번호·공급대가·지급일·세금계산서·EDI)을 «계약 기록» 줄로 바꾼다.
   ⚠ 파일은 브라우저 안에서만 읽는다(올리지 않는다). 여기는 순수 함수 — 화면은 pu-office-docs.js,
     저장은 pu-office-store.js. Node 검사(tests/co-roster.test.js)가 그대로 싣는다.
   ⚠ 이름표 줄은 글자로 찾는다(열 위치를 박지 않는다) — 다른 판의 명단(체당금 명단 등)도 같은 길로 읽힌다. */
(function (root) {
  var COLS = {
    name: ['사업장명', '업체명', '회사명', '상호'],
    staff: ['담당자', '주담당'],
    date: ['계약체결일', '계약일'],
    bizNo: ['사업자등록번호', '사업자번호'],
    bizType: ['업태'], item: ['종목'], ceo: ['대표자', '대표'],
    addr: ['주소', '소재지'], contact: ['실무자/전화번호', '실무자', '연락처'],
    amount: ['공급대가', '계약금액', '월보수', '자문료'],
    payDay: ['지급일', '납부일'], tax: ['세금계산서'], edi: ['EDI']
  };
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase(); }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function pad2(n) { return String(n).padStart(2, '0'); }

  /* 이름표 줄 찾기 — 앞 10줄에서 「사업장명」과 「계약체결일」이 함께 있는 줄 */
  function headerOf(aoa) {
    for (var r = 0; r < Math.min(10, (aoa || []).length); r++) {
      var row = (aoa[r] || []).map(norm), map = {};
      Object.keys(COLS).forEach(function (k) {
        var i = -1;
        COLS[k].some(function (lab) { i = row.indexOf(norm(lab)); return i >= 0; });
        if (i >= 0) map[k] = i;
      });
      if (map.name != null && map.date != null) return { row: r, map: map };
    }
    return null;
  }
  /* 날짜 — Date · 엑셀 날짜 번호 · 「2024-03-21」「2024.3.21」 글자 */
  function toYmd(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad2(v.getMonth() + 1) + '-' + pad2(v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
    }
    var m = /^(\d{4})\s*[-.\/년]\s*(\d{1,2})\s*[-.\/월]\s*(\d{1,2})/.exec(String(v).trim());
    return m ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : '';
  }
  function toAmount(v) {
    if (typeof v === 'number' && isFinite(v)) return Math.round(v);
    var t = digits(v); return t && t.length < 13 ? +t : null;
  }
  function str(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 120); }
  function fmtBiz(s) { var d = digits(s); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : ''; }

  /* 시트들({이름: aoa}) 중 명단 시트를 골라 줄로. 표지 틀({{…}})·빈 줄·이름 없는 줄은 건너뛴다. */
  function parseRoster(sheets) {
    var names = Object.keys(sheets || {}), hit = null;
    names.some(function (n) { var h = headerOf(sheets[n]); if (h) { hit = { sheet: n, h: h }; return true; } return false; });
    if (!hit) return { sheet: '', rows: [], skipped: 0 };
    var aoa = sheets[hit.sheet], M = hit.h.map, rows = [], skipped = 0;
    var cell = function (r, k) { return M[k] == null ? '' : r[M[k]]; };
    for (var i = hit.h.row + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], name = str(cell(r, 'name'));
      if (!name) { if (r.some(function (x) { return x !== '' && x != null; })) skipped++; continue; }
      if (/\x7b\x7b/.test(name)) { skipped++; continue; }
      var edi = str(cell(r, 'edi'), 10);
      rows.push({
        line: i + 1, name: name, staff: str(cell(r, 'staff'), 30), date: toYmd(cell(r, 'date')),
        bizNo: fmtBiz(cell(r, 'bizNo')), bizType: str(cell(r, 'bizType'), 60), item: str(cell(r, 'item'), 60),
        ceo: str(cell(r, 'ceo'), 60).replace(/(\S) (?=\S( |$))/g, '$1'), addr: str(cell(r, 'addr'), 200),
        contact: str(cell(r, 'contact'), 80), amount: toAmount(cell(r, 'amount')),
        payDay: str(cell(r, 'payDay'), 10), tax: str(cell(r, 'tax'), 20), edi: edi === '○' || /^(O|Y|예|있음)$/i.test(edi) ? '○' : edi
      });
    }
    return { sheet: hit.sheet, rows: rows, skipped: skipped };
  }

  /* 같은 기록인지 — 회사 열쇠 + 계약일 + 종류 (두 번 가져와도 겹치지 않게) */
  function recKey(coKey, date, kind) { return [coKey, date || '-', kind || '-'].join('|'); }

  /* 이알피 업체·기업정보함(PuFormCardFill.mergeRows 줄)과 맞추기 — 사업자번호 먼저, 없으면 이름 */
  function sameCo(s) { return String(s || '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\s/g, '').toLowerCase(); }
  function matchOf(row, refs) {
    var b = digits(row.bizNo), n = sameCo(row.name), hit = null;
    (refs || []).some(function (x) { if (b && digits(x.bz) === b) { hit = x; return true; } return false; });
    if (!hit) (refs || []).some(function (x) { if (n && sameCo(x.c) === n) { hit = x; return true; } return false; });
    if (!hit) return { kind: 'new', label: '새 회사' };
    return { kind: hit.k === 'erp' ? 'erp' : 'card', label: hit.k === 'erp' ? '이알피 업체 ✓' : '기업정보함 ✓', companyId: hit.companyId || '' };
  }

  var KINDS = ['급여관리', '자문', '컨설팅', '사건', '기금', 'CMS', 'EDI', '제안서', '기타'];

  var api = { COLS: COLS, KINDS: KINDS, headerOf: headerOf, toYmd: toYmd, toAmount: toAmount, parseRoster: parseRoster, recKey: recKey, matchOf: matchOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuCoRoster = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
