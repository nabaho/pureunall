'use strict';
/* 푸른노무법인 경력관리 — 🏢 푸른인사관리에서 증명서 당겨오기 (대표 지시 2026-11-12 「경력관리에 재직증명서 당겨오는 기능 만들어 달라」
   「경력증명서·재직증명서는 푸른인사관리에서 가지고 와라」)
   (브라우저 window.KcareerHrCert / Node module.exports 겸용 · DOM·파이어베이스를 쓰지 않는다 — «무엇을 넣을지»의 셈과 기록 모양만 정한다)

   인사관리(pu-erp.html?app=hr) › 증명서는 재직증명서·경력증명서를 발급할 때마다 발급 이력 한 줄을 남긴다(data/cert_log).
   여기는 그 줄 가운데 «내(로그인한 직원 sid) 것»만 골라 경력관리 서류 보관함(증명서)에 넣을 계획과 기록 한 줄을 짓는다.

   ■ 지키는 것
     · 읽기만 한다 — 인사관리 자료(cert_log)를 고치거나 지우지 않는다. 이 모듈은 읽은 값을 받아 셈만 한다.
     · 사람은 sid 로만 맞춘다 — 이름으로 «본인 것»을 찾지 않는다(이름이 같은 사람·바뀐 이름). sid 가 비면 아무것도 고르지 않는다.
     · 연봉증명서(kind:'salary')는 임금 정보라 당겨오지 않는다 — 재직·경력증명서만.
     · 인사관리에서 «취소» 표시한 줄은 새로 넣지 않는다. 이미 넣은 줄이 뒤늦게 취소되면 «취소됨»을 알린다(취소가 풀리면 지운다).
     · 같은 발급번호(PU-연도-순번)는 다시 넣지 않는다 — 보관함에 있는 줄도, 휴지통에 든 줄도(지운 줄이 말없이 되살아나지 않게).
     · 가져오는 것은 발급번호·종류·발급일·용도·제출처·발급 이력 번호뿐 — 이름·생년월일·주소·메일·담당자는 담지 않는다(필요 최소).
     · 인사관리는 증명서 «본문»을 남기지 않는다(발급 이력에는 메타데이터만). 그래서 만든 기록에는 원본 파일이 없다 —
       없는 본문을 다시 그려 «발급된 것처럼» 만들지 않는다. 인사관리에서 저장한 PDF 는 사람이 줄에 붙인다.
     · 발급일은 발급 이력에 남은 «발급한 때»(issuedAt)의 한국 날짜다. 종이에 찍은 발급일을 따로 고른 경우와 다를 수 있다. */
(function (root) {
  /* 당겨올 증명서 종류 — 인사관리 kind 값 → 서류 보관함(증명서) 종류 이름(KIND_DEFAULTS.certdoc 에 이미 있는 이름)
     ⚠ 'salary'(연봉증명서)는 일부러 없다. */
  var KINDS = { employment: '재직증명서', career: '경력증명서' };
  var ENTITY = 'Document';
  var SCHEMA = 1;
  var KST_MS = 9 * 3600 * 1000;

  function str(v) { return String(v == null ? '' : v).trim(); }

  /* data/cert_log 의 «벗긴 값»(배열이거나 {키:줄} 맵) → 줄 배열. 이상한 값은 빈 배열 */
  function rowsOf(v) {
    if (!v || typeof v !== 'object') return [];
    var list = Array.isArray(v) ? v : Object.keys(v).map(function (k) { return v[k]; });
    return list.filter(function (r) { return r && typeof r === 'object' && !Array.isArray(r); });
  }

  /* 발급 시각(ISO·UTC) → 한국 날짜 YYYY-MM-DD. 읽을 수 없으면 '' (지어내지 않는다) */
  function kstDate(iso) {
    var t = Date.parse(str(iso));
    if (isNaN(t)) return '';
    return new Date(t + KST_MS).toISOString().slice(0, 10);
  }

  function kindLabel(kind) { return Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : ''; }
  function isCanceled(row) { return !!(row && (row.canceled === true || row.canceled === 'true')); }
  function certNoOf(row) { return str(row && row.certNo); }
  function logIdOf(row) { return str(row && row.id); }

  /* 보관함에 이미 있는 기록이 «인사관리 발급분»인가 */
  function isHrRecord(rec) { return !!(rec && (rec.hrCertNo || rec.docSrc === 'hr')); }

  /* have = 서류 보관함(증명서) 기록들, gone = 휴지통에 든 기록들
     → { 발급번호: 기록 } · { 발급 이력 번호: 기록 } 두 색인 */
  function indexOf(list) {
    var byNo = {}, byLog = {};
    (list || []).forEach(function (r) {
      if (!r || !isHrRecord(r)) return;
      var n = str(r.hrCertNo), l = str(r.hrCertLogId);
      if (n && !byNo[n]) byNo[n] = r;
      if (l && !byLog[l]) byLog[l] = r;
    });
    return { byNo: byNo, byLog: byLog };
  }

  /* 계획 — rows: 인사관리 발급 이력 줄들(rowsOf 로 거른 것) · mySid: 로그인한 직원 sid · o: { have, gone }
     → { ok, reason, items:[…], fixes:[…], stat:{…} }
     reason: ''(정상) | 'nosid'(로그인한 직원을 모른다 → 아무것도 고르지 않는다) */
  function plan(rows, mySid, o) {
    o = o || {};
    var sid = str(mySid);
    var stat = { all: (rows || []).length, mine: 0, fresh: 0, have: 0, gone: 0, canceled: 0, otherKind: 0, noNo: 0, sameNo: 0 };
    if (!sid) return { ok: false, reason: 'nosid', items: [], fixes: [], stat: stat };

    var have = indexOf(o.have), gone = indexOf(o.gone);
    var mine = (rows || []).filter(function (r) { return r && str(r.targetSid) === sid; });
    stat.mine = mine.length;
    mine = mine.slice().sort(function (a, b) { return str(b.issuedAt).localeCompare(str(a.issuedAt)); });   /* 최근 발급이 위 */

    var items = [], seenNo = {}, fixes = [], seenFix = {};
    mine.forEach(function (r) {
      var no = certNoOf(r), lid = logIdOf(r), label = kindLabel(str(r.kind));
      var rec = (no && have.byNo[no]) || (lid && have.byLog[lid]) || null;
      /* 이미 넣은 줄의 «취소됨» 표시를 인사관리와 맞춘다 — 취소된 증명서를 그대로 제출하면 안 된다 */
      if (rec && rec.id && !seenFix[rec.id]) {
        seenFix[rec.id] = 1;
        var c = isCanceled(r);
        if (c !== !!rec.hrCanceled) fixes.push({ id: str(rec.id), hrCanceled: c, canceledAt: c ? str(r.canceledAt) : '', certNo: no });
      }
      if (!label) { stat.otherKind++; return; }
      if (isCanceled(r)) { stat.canceled++; return; }
      if (!no) { stat.noNo++; return; }
      if (seenNo[no]) { stat.sameNo++; return; }
      seenNo[no] = 1;
      var state = rec ? 'have' : ((gone.byNo[no] || (lid && gone.byLog[lid])) ? 'gone' : 'new');
      var it = { no: items.length + 1, state: state, pick: state === 'new',
        certNo: no, logId: lid, kind: str(r.kind), kindLabel: label,
        issuedAt: str(r.issuedAt), date: kstDate(r.issuedAt),
        purpose: str(r.purpose), submitTo: str(r.submitTo) };
      items.push(it);
      if (state === 'new') stat.fresh++; else if (state === 'have') stat.have++; else stat.gone++;
    });
    return { ok: true, reason: '', items: items, fixes: fixes, stat: stat };
  }

  /* 용도 / 제출처 — 인사관리 증명서 표의 한 칸(용도 / 제출처)과 같은 꼴 */
  function usageOf(it) {
    var p = str(it && it.purpose), s = str(it && it.submitTo);
    return p + (s ? (p ? ' / ' : '') + s : '');
  }

  /* 계획 한 줄 → 서류 보관함(증명서) 기록 한 건.
     o: { id(새 번호 — 부르는 쪽이 kcNextNo 로), now(ISO), sid(내 sid), issuer(발급기관 이름) }
     온톨로지: id·entityType·schemaVersion·createdAt·updatedAt · 사람은 sid · 원본은 sourceKind·sourceId(발급 이력 줄의 영구 id) */
  function toRecord(it, o) {
    o = o || {};
    var now = str(o.now) || new Date().toISOString();
    var issuer = str(o.issuer);
    return {
      id: str(o.id), entityType: ENTITY, schemaVersion: SCHEMA,
      kind: it.kindLabel, org: issuer, issuer: issuer,
      usage: usageOf(it), coverage: '',                  /* 증명 기간은 발급 이력에 없다 — 비워 둔다(지어내지 않는다) */
      year: it.date ? it.date.slice(0, 4) : '', date: it.date,
      memo: '🏢 푸른인사관리 발급 · 제 ' + it.certNo + ' 호',
      docSrc: 'hr', hrCertNo: it.certNo, hrCertLogId: it.logId, hrKind: it.kind,
      hrPurpose: it.purpose, hrSubmitTo: it.submitTo, hrIssuedAt: it.issuedAt,
      sid: str(o.sid), sourceKind: 'cert_log', sourceId: it.logId,
      submits: [], createdAt: now, updatedAt: now, savedAt: now
    };
  }

  /* 취소 표시를 보관함 기록에 맞춘다 → { list: 새 배열, n: 바뀐 줄 수 }. 입력 배열·기록은 건드리지 않는다.
     ⚠ 바꾸는 것은 hrCanceled·hrCanceledAt·updatedAt 뿐 — 종류·용도·제출 기록·파일은 그대로. */
  function applyFixes(list, fixes, now) {
    var by = {}; (fixes || []).forEach(function (f) { if (f && f.id) by[f.id] = f; });
    var n = 0;
    var out = (list || []).map(function (r) {
      var f = r && by[str(r.id)];
      if (!f || !isHrRecord(r)) return r;
      var next = Object.assign({}, r, { hrCanceled: !!f.hrCanceled, hrCanceledAt: f.hrCanceled ? str(f.canceledAt) : '', updatedAt: str(now) || new Date().toISOString() });
      n++;
      return next;
    });
    return { list: out, n: n };
  }

  /* 넣기 직전의 마지막 거름 — 고른 줄 중 «지금 보관함에 이미 있는» 발급번호는 뺀다(두 번 눌렀거나 다른 탭에서 먼저 넣은 경우) */
  function freshOnly(items, have) {
    var h = indexOf(have), seen = {};
    return (items || []).filter(function (it) {
      if (!it || !it.certNo) return false;
      if (seen[it.certNo]) return false;
      seen[it.certNo] = 1;
      return !(h.byNo[it.certNo] || (it.logId && h.byLog[it.logId]));
    });
  }

  var api = { KINDS: KINDS, rowsOf: rowsOf, kstDate: kstDate, kindLabel: kindLabel, isHrRecord: isHrRecord,
    plan: plan, toRecord: toRecord, usageOf: usageOf, applyFixes: applyFixes, freshOnly: freshOnly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHrCert = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
