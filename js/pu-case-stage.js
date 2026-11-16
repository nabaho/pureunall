'use strict';
/* 계약의 «심급·단계»(노동위원회·산재) 읽기 — 순수 함수
   (브라우저 window.PuCaseStage / Node 겸용 · 대표 승인 2026-11-15 «권고대로»
    · 계획 docs/superpowers/plans/2026-11-15-quote-auto-plan5-case-stage-marks.md · 검사 tests/case-stage-detect.test.js)

   무엇을 지키나
     · 읽기만 — 계약서에서 «이미 읽혀 요청에 실려 온 칸»(docName·scope·memo·메일 제목·첨부 이름)의 글자만 본다.
       본문 전체·금액·주민번호를 새로 읽지 않는다. 근거 글 조각에서도 숫자 덩어리를 지운다.
     · 단계 이름은 사건 단계 목록(pu-erp.html BIZ_CASE_STAGE_SEED)의 코드만 쓴다 — 목록에서 빠지면 검사가 깨진다.
     · 사건류 계약일 때만 읽는다. 컨설팅·자문 글에 «노동위원회» 낱말이 나와도 표시하지 않는다.
     · 읽은 것은 늘 'auto'(확인 필요)로 시작한다 — 사람이 ☑ 해야 'checked', ✕ 하면 'dismissed'(다시 안 띄움).
       기계는 사람이 정한 상태를 되돌리거나 지우지 않고, 계약 상태·금액·stageCode 도 건드리지 않는다.
     · AI 를 부르지 않는다 — 낱말표(정규식)뿐이다. ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;

  var MAX_TEXT = 4000;      // 칸 하나에서 보는 글자 수 — 정규식이 길어지지 않게
  var EVID_SIDE = 24;       // 근거 글 조각: 낱말 앞뒤
  var EVID_MAX = 90;        // 저장하는 근거 글 길이
  var NEAR = 20;            // 문맥을 보는 앞뒤 글자 수
  var STATES = ['auto', 'checked', 'dismissed'];

  /* 순서 = 사건 단계 목록의 sortOrder(지노위→중노위→행소 · 요양→심사→재심사).
     ⚠ 재심사청구는 «심사청구»를 품고 있다 — detect 가 재심사청구 자리를 먼저 지운 글로 심사청구를 본다. */
  var STAGES = [
    { code: 'lrc-local', name: '지방노동위원회', short: '지노위',
      re: /지방\s*노동\s*위원회|지노위|초심\s*(?:판정|신청|절차|단계)/g },
    { code: 'lrc-central', name: '중앙노동위원회', short: '중노위',
      re: /중앙\s*노동\s*위원회|중노위|재심\s*(?:신청|판정|절차)/g },
    { code: 'court-admin', name: '행정소송', short: '행소',
      re: /행정\s*소송|취소\s*소송|행정\s*법원/g },
    { code: 'wc-apply', name: '요양신청', short: '요양',
      re: /최초\s*요양|요양\s*(?:급여\s*)?(?:신청|청구)|산재\s*(?:요양\s*)?신청/g },
    { code: 'wc-review', name: '심사청구', short: '심사',
      re: /심사\s*청구|보험\s*심사\s*위원회/g },
    { code: 'wc-rereview', name: '재심사청구', short: '재심',
      re: /재\s*심사\s*(?:청구|위원회)|보험\s*재심사/g }
  ];
  var BY_CODE = {};
  STAGES.forEach(function (s, i) { s.order = i; BY_CODE[s.code] = s; });

  /* 문맥 낱말 — 수임·대리처럼 «맡는 일»이면 strong, 판정례·참고처럼 «언급»이면 weak */
  var DOING_RE = /수임|대리|선임|위임|포함|업무\s*범위|진행|신청|청구|제기|출석|조정|심판|구제/;
  var REF_RE = /판정례|판례|사례|예시|참고|참조|표준|양식|일반적으로|통상|안내|설명/;
  /* 내용 칸(계약서에서 읽은 것) · 메일 머리글 칸 */
  var CONTENT = { docName: 1, scope: 1, memo: 1 };

  function str(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
  function maskNum(s) { return s.replace(/\d{1,3}(?:,\d{3})+|\d{4,}/g, '…'); }
  function isCaseKind(hint) {
    var h = hint || {};
    var ks = Array.isArray(h.kinds) ? h.kinds : [];
    return ks.indexOf('case') >= 0 || h.inferredKind === 'case' || h.kind === 'case';
  }

  /* 글 한 칸에서 한 단계의 첫 낱말 자리 — 재심사청구 자리를 지운 사본에서 심사청구를 본다 */
  function firstHit(stage, text, rereviewMasked) {
    var src = stage.code === 'wc-review' ? rereviewMasked : text;
    stage.re.lastIndex = 0;
    var m = stage.re.exec(src);
    var count = 0, first = null;
    while (m) {
      if (!first) first = { at: m.index, len: m[0].length };
      count++;
      if (m.index === stage.re.lastIndex) stage.re.lastIndex++;
      m = stage.re.exec(src);
    }
    return first ? { at: first.at, len: first.len, count: count, text: src } : null;
  }

  /* detect(parts, hint) → [{ code, name, short, strength, where, evidence, hits }]
     parts: [{ where:'docName'|'scope'|'memo'|'subject'|'atts', text }] · hint: { kinds:[…], inferredKind } */
  function detect(parts, hint) {
    if (!isCaseKind(hint)) return [];
    var list = (Array.isArray(parts) ? parts : []).map(function (p) {
      return { where: str(p && p.where), text: str(p && p.text).slice(0, MAX_TEXT) };
    }).filter(function (p) { return p.text; });
    if (!list.length) return [];
    var rereview = BY_CODE['wc-rereview'];
    var out = [];
    STAGES.forEach(function (st) {
      var best = null, total = 0;
      list.forEach(function (p) {
        /* ⚠ «산재 심사청구» 의 «재 심사청구» 가 재심사청구로 읽히던 오탐(검사가 찾았다) —
           산재 낱말의 «재»를 지운 사본(길이 그대로)에서만 재심사청구를 본다. 근거 글 조각은 원문에서 뜬다. */
        var noSanjae = p.text.replace(/산재/g, '산ㅡ');
        rereview.re.lastIndex = 0;
        var masked = noSanjae.replace(rereview.re, function (m) { return new Array(m.length + 1).join(' '); });
        var h = firstHit(st, st.code === 'wc-rereview' ? noSanjae : p.text, masked);
        if (!h) return;
        total += h.count;
        var around = (h.text.slice(Math.max(0, h.at - NEAR), h.at) + ' ' + h.text.slice(h.at + h.len, h.at + h.len + NEAR));
        var isContent = !!CONTENT[p.where];
        var weak = !isContent || REF_RE.test(around) || !DOING_RE.test(around);
        var cand = { where: p.where, weak: weak, h: h, p: p };
        /* 내용 칸의 strong → 내용 칸 weak → 머리글 칸 */
        var rank = (isContent ? 2 : 0) + (weak ? 0 : 1);
        if (!best || rank > best.rank) { cand.rank = rank; best = cand; }
      });
      if (!best) return;
      var hit = best.h, t = best.p.text;   // 근거 글 조각은 «원문»에서 — 지운 사본이 아니라
      var from = Math.max(0, hit.at - EVID_SIDE), to = Math.min(t.length, hit.at + hit.len + EVID_SIDE);
      out.push({ code: st.code, name: st.name, short: st.short, strength: best.weak ? 'weak' : 'strong',
        where: best.where, evidence: maskNum(t.slice(from, to)).trim().slice(0, EVID_MAX), hits: total });
    });
    return out;
  }

  /* 저장된 stageMarks 를 믿기 전에 걸러 낸다 — 모르는 코드·상태·모양은 버린다(조용히 안 늘어나게) */
  function clean(marks) {
    var seen = {}, out = [];
    (Array.isArray(marks) ? marks : []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var code = str(m.code);
      if (!BY_CODE[code] || seen[code]) return;
      seen[code] = 1;
      var state = STATES.indexOf(m.state) >= 0 ? m.state : 'auto';
      var e = { code: code, state: state, strength: m.strength === 'strong' ? 'strong' : 'weak',
        evidence: str(m.evidence).slice(0, EVID_MAX), srcDoc: str(m.srcDoc).slice(0, 40), at: Number(m.at) || 0 };
      if (m.bySid) e.bySid = str(m.bySid).slice(0, 40);
      out.push(e);
    });
    return out;
  }

  /* merge(prev, found, opts) → { marks, added } — 새 코드만 'auto' 로 더한다.
     이미 있는 코드는 상태·근거 그대로(사람이 정한 것 · 다시 읽어도 안 바뀜) · 지우지 않는다. */
  function merge(prev, found, opts) {
    var o = opts || {};
    var marks = clean(prev), have = {}, added = [];
    marks.forEach(function (m) { have[m.code] = 1; });
    (Array.isArray(found) ? found : []).forEach(function (f) {
      if (!f || !BY_CODE[f.code] || have[f.code]) return;
      have[f.code] = 1; added.push(f.code);
      marks.push({ code: f.code, state: 'auto', strength: f.strength === 'strong' ? 'strong' : 'weak',
        evidence: str(f.evidence).slice(0, EVID_MAX), srcDoc: str(o.srcDoc).slice(0, 40), at: Number(o.now) || 0 });
    });
    marks.sort(function (a, b) { return BY_CODE[a.code].order - BY_CODE[b.code].order; });
    return { marks: marks, added: added };
  }

  /* 사람이 누른 것 — ☑(checked) · ✕(dismissed) · 되돌리기(auto). 없는 코드면 «직접 추가»로 checked 를 만든다. */
  function setState(prev, code, state, who, now) {
    if (!BY_CODE[code] || STATES.indexOf(state) < 0) return clean(prev);
    var marks = clean(prev), done = false;
    marks.forEach(function (m) {
      if (m.code !== code) return;
      m.state = state; m.at = Number(now) || m.at;
      if (state === 'auto') delete m.bySid; else m.bySid = str(who).slice(0, 40);
      done = true;
    });
    if (!done) {
      var e = { code: code, state: state, strength: 'weak', evidence: '', srcDoc: '', at: Number(now) || 0 };
      if (state !== 'auto') e.bySid = str(who).slice(0, 40);
      marks.push(e);
    }
    marks.sort(function (a, b) { return BY_CODE[a.code].order - BY_CODE[b.code].order; });
    return marks;
  }

  /* 카드·표에 그릴 칩 — 다시 안 띄우기로 한(dismissed) 것은 뺀다 */
  function summary(marks) {
    return clean(marks).filter(function (m) { return m.state !== 'dismissed'; }).map(function (m) {
      var s = BY_CODE[m.code];
      return { code: m.code, name: s.name, short: s.short, state: m.state, strength: m.strength };
    });
  }

  var api = { STAGES: STAGES, STATES: STATES, detect: detect, clean: clean, merge: merge,
    setState: setState, summary: summary, isCaseKind: isCaseKind,
    info: function (code) { var s = BY_CODE[code]; return s ? { code: s.code, name: s.name, short: s.short, order: s.order } : null; } };
  if (isNode) module.exports = api;
  else root.PuCaseStage = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
