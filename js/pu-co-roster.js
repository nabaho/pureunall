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

  /* ══ PC 폴더 가져오기 (설계 §3 (나)) — 파일 이름·폴더 이름으로 «우리와 맺은 계약서류»만 고르고 회사·종류·날짜를 짐작 ══
     ⚠ 고객사 직원 자료(근로계약서·급여대장·명세서·연봉계약서·퇴직금…)는 기본으로 뺀다 — 직원 개인정보다.
     ⚠ 짐작은 짐작이다 — 확인 화면에서 사람이 고친다. */
  var DOC_KINDS = [
    [/급여\s*관리|급여\s*위임|급여\s*아웃소싱/, '급여관리'],
    [/자문\s*계약|고문\s*계약|자문\s*약정/, '자문'],
    [/cms|자동\s*이체|자동출금/i, 'CMS'],
    [/edi|업무\s*대행|사무\s*위탁|보험\s*사무/i, 'EDI'],
    [/컨설팅\s*(위임|계약|위탁)|위탁\s*계약/, '컨설팅'],
    [/기금/, '기금'],
    [/제안서|견적서/, '제안서'],
    [/위임\s*계약|위임\s*약정|약정서|위임장/, '사건']
  ];
  var NOT_OURS = /근로\s*계약|연봉\s*계약|촉탁\s*계약|급여\s*대장|임금\s*대장|급여\s*내역|명세서|연차\s*대장|퇴직금|정산|서약서|이력서|출근부|취업\s*규칙|검토\s*의견/;
  function guessKind(name) {
    var n = String(name || '');
    if (NOT_OURS.test(n)) return '';
    for (var i = 0; i < DOC_KINDS.length; i++) if (DOC_KINDS[i][0].test(n)) return DOC_KINDS[i][1];
    return '';
  }
  var GENERIC_DIR = /^(\d+[.\s]*)*$|종료|과거|자문\s*관리|자문사\s*관리|자문사\s*명단|기본\s*서류|구비\s*서류|계약서$|^계약서|서류$|자료$|^\d{4}년|규정\s*개정|cms$|현황$|^사진$|^스캔|카카오톡|받은\s*파일|바탕\s*화면|^문서$|^내\s*문서$|^downloads?$|중노위|지노위|노동위|소송|답변서|이유서|진정|산재|부해\d|부당\s*(해고|정직)|계약서\s*등|기초\s*계약서|사건$/i;
  function cleanCo(seg) {
    return String(seg || '').replace(/^[\d\s.\-_]+/, '').replace(/\((?!주\)|유\))[가-힣]{2,4}\)$/, '').replace(/[_-]+$/, '').trim();
  }
  /* relPath: 「10. 자문사관리/1.자문관리/1.티앤에스/자문계약서.hwp」 → 파일에서 가까운 폴더부터, 흔한 이름은 건너뛴다 */
  function coFromPath(relPath) {
    var segs = String(relPath || '').split('\\').join('/').split('/').filter(Boolean);
    var file = segs.pop() || '';
    for (var i = segs.length - 1; i >= 1; i--) {
      var c = cleanCo(segs[i]);
      if (c.length >= 2 && !GENERIC_DIR.test(segs[i]) && !GENERIC_DIR.test(c) && !/[,]/.test(c)) return c;
    }
    /* 폴더가 다 흔하면 파일 이름을 「-」「_」로 쪼개 서류 이름·숫자·흔한 말을 뺀 가장 긴 조각 */
    var parts = file.replace(/\.[a-z0-9]+$/i, '').split(/[-_\[\]]+/).map(function (t) { return cleanCo(t.replace(/\(\d+\)$/, '')); })
      .filter(function (t) { return t.length >= 2 && !guessKind(t) && !/cms|표준|샘플|최종|수정|^\d+$|\d{4,}/i.test(t) && !NOT_OURS.test(t) && !GENERIC_DIR.test(t); });
    parts.sort(function (x, y) { return y.length - x.length; });
    return parts[0] || '';
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  /* 파일 이름 속 날짜 → 없으면 파일 날짜(lastModified) */
  function guessDate(name, lastModified) {
    var n = String(name || ''), m;
    if ((m = /(20\d{2})[.\-_ ]?(0[1-9]|1[0-2])[.\-_ ]?(0[1-9]|[12]\d|3[01])(?!\d)/.exec(n))) return { date: m[1] + '-' + m[2] + '-' + m[3], from: 'name' };
    if ((m = /(?:^|[^\d])([12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/.exec(n))) return { date: '20' + m[1] + '-' + m[2] + '-' + m[3], from: 'name' };
    if (lastModified) { var d = new Date(lastModified); return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), from: 'file' }; }
    return { date: '', from: '' };
  }
  function folderRows(files) {
    return (files || []).map(function (f) {
      var name = String(f.name || ''), kind = guessKind(name), dt = guessDate(name, f.lastModified);
      return { path: f.path || name, name: name, size: f.size || 0, kind: kind || '기타', ours: !!kind, co: coFromPath(f.path || name), date: dt.date, dateFrom: dt.from };
    });
  }

  var api = { COLS: COLS, KINDS: KINDS, guessKind: guessKind, coFromPath: coFromPath, guessDate: guessDate, folderRows: folderRows, headerOf: headerOf, toYmd: toYmd, toAmount: toAmount, parseRoster: parseRoster, recKey: recKey, matchOf: matchOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuCoRoster = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
