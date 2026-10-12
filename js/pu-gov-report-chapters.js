'use strict';
/* 정부컨설팅 보고서 — 대형 사업 «장별» AI 초안 (브라우저 window.PuGovReportChapters / Node 겸용)
   (대표 지시 2026-10-12 · 계획 docs/superpowers/plans/2026-10-12-gov-report-chapters.md Task 1)
   무엇을 지키나
     · 밖(외부 AI)으로 나가는 글은 «통째로» 가린다 — 입력을 JSON 으로 묶은 뒤 PuGovReportAi.mask 로 한 번에.
       업체·대표자·담당자 이름은 대괄호 자리 표시([해당 기업]·[대표자]…)로 바꾸고 받은 글에서 되돌린다.
       전화·메일·주민·계좌·사업자번호는 [가림](되돌리지 않는다). 가리기 규칙은 PuGovReportAi 것을 그대로 쓴다(복제 없음).
     · 보내는 것은 회차 날짜·형태·메모, 서류 줄 메모, 회차 기록 요약(대면/비대면·시간·인원)뿐 — 급여·명부·첨부·메일 본문은 없다.
     · 재료(회차 메모 또는 서류 메모)가 하나도 없으면 부르지 않는다({empty:true}).
     · 받은 글은 «아는 장 키»의 글자만 옮긴다. 입력에 없던 숫자는 checkDraft 가 장별로 표시한다(경고만).
     · 이 모듈은 저장하지 않는다 — 초안은 화면 메모리에서만 산다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var Ai = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-ai.js') : root.PuGovReportAi;

  var CH_LIMIT = 900;
  var CH_MAX = 8;
  var MSG = {
    NO_MATERIAL: '재료가 부족합니다 — 회차 메모(정부사업일정)나 이 서류의 메모를 먼저 적어 주세요',
    NOT_SAVED: '저장되지 않습니다 — 읽고 고친 뒤 복사해 쓰세요(칸 창을 닫으면 사라집니다)',
    CHECK: '확인 필요 — 입력에 없던 숫자: ',
  };
  var KEY_RE = /^[a-z]+$/;
  /* 객체 기본 이름은 소문자 글자라 chaptersOf 를 지나가도 받은 글에서는 버린다(__proto__ 는 KEY_RE 가 이미 막는다) */
  var BAD_KEYS = { constructor: 1, prototype: 1 };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* 항목의 장 목록 — 올바른 것만(키는 소문자 글자, 제목은 비지 않은 글, 겹치는 키는 앞의 것, 최대 CH_MAX 장) */
  function chaptersOf(item) {
    var src = item && Array.isArray(item.chapters) ? item.chapters : [], out = [], seen = {};
    for (var i = 0; i < src.length && out.length < CH_MAX; i++) {
      var c = src[i];
      if (!c || typeof c !== 'object') continue;
      var k = typeof c.k === 'string' ? c.k : '', t = typeof c.t === 'string' ? c.t.trim() : '';
      if (!KEY_RE.test(k) || !t || own(seen, k)) continue;
      seen[k] = 1;
      out.push({ k: k, t: t });
    }
    return out;
  }

  /* 시스템 글 — ⚠ 노무사 확인 필요: 아래 문구·규칙은 정리본(§2-5~2-7) 기준으로 짠 «초안»이다. 기관 작성기준과 대조해 고친 뒤 확정한다 */
  function systemText(chs) {
    return [
      '당신은 공인노무사가 쓰는 정부 지원 인사노무 컨설팅 보고서의 «장별 초안»을 쓴다. 노무사가 읽고 고친 뒤 확정한다.',
      '입력(JSON)의 회차 메모·기록요약·메모에 적힌 사실만 바탕으로 쓴다.',
      '규칙',
      '- 입력에 없는 숫자·고유명사·법 조문을 지어내지 않는다.',
      '- 입력만으로 쓸 수 없는 내용은 지어내지 말고 「입력 필요」 라고만 쓴다.',
      '- 보고서 문체(~함, ~임)로 쓴다.',
      '- [해당 기업] [대표자] [담당자] 같은 대괄호 표시는 그대로 옮겨 쓴다. [가림] 의 원래 값을 짐작하지 않는다.',
      '- 입력의 「채울_장」에 있는 장만 쓴다. 장마다 ' + CH_LIMIT + '자 이내로 쓴다.',
      '채울 장(키 — 제목)',
      chs.map(function (c) { return '- ' + c.k + ' — ' + c.t + ' (' + CH_LIMIT + '자 이내)'; }).join('\n'),
      'JSON 만 답한다. 앞뒤에 다른 글을 붙이지 않는다. 꼴: {"chapters":{"<키>":"<글>"}}',
    ].join('\n');
  }

  /* 회차 기록(rd)을 «대면 130분 4명» · «비대면 보고서 1MD» 꼴 글로 — 없는 것은 건너뛴다 */
  function rdText(rd) {
    if (!rd || typeof rd !== 'object') return '';
    var p = [], num = function (v) { var n = Number(v); return (v !== '' && v != null && isFinite(n) && n > 0) ? n : 0; };
    if (rd.mode === 'face') p.push('대면'); else if (rd.mode === 'remote') p.push('비대면');
    if (str(rd.kind)) p.push(str(rd.kind));
    if (num(rd.md)) p.push(num(rd.md) + 'MD');
    if (num(rd.mins)) p.push(num(rd.mins) + '분');
    if (num(rd.people)) p.push(num(rd.people) + '명');
    return p.join(' ');
  }

  /* 보낼 글 — 입력을 JSON 으로 묶은 뒤 «통째로» 가린다(빠지는 글이 없게) */
  function buildRequest(o) {
    o = o || {};
    var chs = chaptersOf({ chapters: o.chapters });
    var rs = Array.isArray(o.rounds) ? o.rounds : [], ns = Array.isArray(o.notes) ? o.notes : [];
    var memo = rs.some(function (r) { return r && str(r.memo); }) || ns.some(function (n) { return n && str(n.text); });
    if (!memo) return { empty: true };
    if (!chs.length) return { empty: true, noChapters: true };
    var co = o.company || {};
    var input = { 사업: str(o.bizName), 서류: str(o.itemName) };
    var cobj = {};
    if (str(co.bizType)) cobj.업종 = str(co.bizType);
    if (str(co.workers)) cobj.근로자수 = str(co.workers);
    if (Object.keys(cobj).length) input.업체 = cobj;
    input.회차 = rs.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
      var x = { 날짜: str(r.date), 방식: r.visit === true ? '방문' : r.visit === false ? '사무' : '모름', 메모: str(r.memo) };
      var t = rdText(r.rd);
      if (t) x.기록요약 = t;
      return x;
    });
    input.메모 = ns.filter(function (n) { return n && str(n.text); }).map(function (n) { return { 이름: str(n.label), 글: str(n.text) }; });
    input.채울_장 = chs.map(function (c) { return { 키: c.k, 제목: c.t }; });
    var names = [{ v: co.name, as: '[해당 기업]' }].concat(Array.isArray(o.names) ? o.names : []);
    var m = Ai.mask(JSON.stringify(input, null, 1), names);
    return { system: systemText(chs), messages: [{ role: 'user', content: m.text }], sent: m.text, back: m.back,
      keys: chs.map(function (c) { return c.k; }) };
  }

  /* 받은 글 — 첫 { ~ 마지막 } 를 JSON 으로. chapters 객체에서 «아는 키»의 글자만 옮긴다 */
  function parseDraft(text, back, chapters) {
    var bad = function (why) { var e = new Error('AI 답을 읽지 못했습니다 — ' + why); e.parse = true; return e; };
    var s = String(text == null ? '' : text), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw bad('JSON 이 없습니다');
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw bad('JSON 이 깨졌습니다'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('꼴이 다릅니다');
    var ch = o.chapters;
    if (!ch || typeof ch !== 'object' || Array.isArray(ch)) throw bad('chapters 가 없습니다');
    var out = {}, n = 0;
    chaptersOf({ chapters: chapters }).forEach(function (c) {
      if (own(BAD_KEYS, c.k) || !own(ch, c.k) || typeof ch[c.k] !== 'string') return;
      var v = ch[c.k].replace(/\r\n?/g, '\n');
      v = String(back ? Ai.unmask(v, back) : v).trim();
      if (!v) return;
      out[c.k] = Array.from(v).slice(0, CH_LIMIT).join('');
      n++;
    });
    if (!n) throw bad('채운 장이 없습니다');
    return out;
  }

  /* 점검(경고만) — 낱말 단위 숫자(/\d+/g, 앞 0 을 뗀다: PuGovReportAi 의 numsOf 와 같은 규칙, 그 함수는 비공개라 여기 다시 씀) */
  function numsOf(t) {
    return (String(t == null ? '' : t).match(/\d+/g) || []).map(function (n) { return n.replace(/^0+(?=\d)/, ''); });
  }
  function checkDraft(draft, sentText) {
    var have = {}, out = {};
    numsOf(sentText).forEach(function (n) { have[n] = 1; });
    Object.keys(draft || {}).forEach(function (k) {
      var seen = {}, nu = numsOf(draft[k]).filter(function (n) { if (have[n] || seen[n]) return false; seen[n] = 1; return true; });
      if (nu.length) out[k] = nu;
    });
    return out;
  }

  var api = { CH_LIMIT: CH_LIMIT, CH_MAX: CH_MAX, MSG: MSG, chaptersOf: chaptersOf, buildRequest: buildRequest,
    parseDraft: parseDraft, checkDraft: checkDraft };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportChapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
