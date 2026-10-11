'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서명 요청 · 보냄 찾기 · 회신 순서 · 제출 받는이 따라 쓰기
   (브라우저 window.PuGovReportSend / Node 겸용 · 대표 승인 2026-10-11 「추천대로」「승인진행」
    · 설계 docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md · 계획 docs/superpowers/plans/2026-10-11-gov-report-sign-submit.md)
   무엇을 지키나
     · 순수 함수만 — 읽기·쓰기·창 열기는 화면 몫. 메일 자동 발송·첨부 자동 붙이기 없음(쓰기 창에 값을 채워 열기까지).
     · 꼬리표 [서명요청:<rid>] · [제출:<rid>] 로 «보낸 메일»을 다시 찾는다(rid = typeId_year, 사람 이름 없음).
     · 본문에는 업체 이름·사업·보고서 이름·날짜만 — 전화·주소·주민번호 꼴을 넣지 않는다. 문구는 [노무사 확인] 초안.
     · 회신 후보는 보낸 날 이후 «받은» 메일만 reply. 개인 자료 딱지는 받은 서류함(PuGovReportInbox)이 그대로 달아 준다.
     · 제출 받는이는 «지난 제출 메일»에서 따라 오되 우리(@pureun.kr)·업체 주소는 뺀다. 어디에도 저장하지 않는다(화면에서만).
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Inbox = isNode ? require('./pu-gov-report-inbox.js') : root.PuGovReportInbox;

  var OWN_RE = /@pureun\.kr$/i;
  var MAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
  var RID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var TAG_KO = { sign: '서명요청', submit: '제출' };
  var TAG_RE = /\[(서명요청|제출):([A-Za-z0-9_-]{1,40})\]/;
  var HINT_RE = /서명|날인|스캔/;
  var MSG = {
    NO_ADDR: '업체관리에서 메일 주소를 넣어 주세요 — 받는 사람을 정할 수 없습니다',
    NO_TAG: '이 서류 줄은 메일 꼬리표를 만들 수 없습니다',
    NO_SUBMIT_TO: '지난 제출 메일을 못 찾았습니다 — 받는 사람을 직접 넣으세요',
    BODY_COPIED: '본문을 복사했습니다 — 메일 쓰기 창에 붙여 넣어 주세요',
    COPIED_ALL: '제목과 본문을 복사했습니다 — 메일 쓰기 창에 붙여 넣어 주세요',
    ATTACH: '확정본을 내려받아 «💻 내 PC 파일»로 붙인 뒤 보내세요 (8MB 이하)',
    DL_NOTE: '크롬이 이 사이트의 반복 내려받기를 막으면 사이트 설정에서 허용해 주세요',
    REPLY: '회신 도착?'
  };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(v) { return /^\d{4}-\d{2}-\d{2}$/.test(str(v)); }
  function dayKo(d) {
    var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(str(d));
    return m ? (+m[1]) + '월 ' + (+m[2]) + '일' : '';
  }

  function tagOf(kind, rid) {
    if (typeof kind !== 'string' || !has(TAG_KO, kind)) return '';
    var r = str(rid);
    return RID_RE.test(r) ? '[' + TAG_KO[kind] + ':' + r + ']' : '';
  }

  function draft(kind, o) {
    o = o || {};
    var tag = tagOf(kind, o.rid), co = str(o.co), biz = str(o.biz), nm = str(o.reportName);
    if (!tag || !co || !biz || !nm) return null;
    var subject, lines;
    if (kind === 'sign') {
      subject = tag + ' ' + biz + ' ' + nm + ' 서명·날인 요청 (' + co + ')';
      lines = ['안녕하세요.', biz + ' ' + nm + ' 확정본을 첨부해 보냅니다.',
        '내용을 확인하신 뒤 서명(날인)하여 스캔본을 이 메일에 회신해 주시기 바랍니다.'];
      if (isDay(o.due)) lines.push('회신 희망일: ' + dayKo(o.due) + '까지');
    } else {
      subject = tag + ' ' + biz + ' ' + nm + ' 제출 (' + co + ')';
      lines = ['안녕하세요.', biz + ' ' + nm + '을(를) 제출합니다.', '첨부를 확인해 주시기 바랍니다.'];
    }
    lines.push('', '감사합니다.');
    return { tag: tag, subject: subject, body: lines.join('\n') };
  }

  function toCc(addrMap) {
    var l = (addrMap && typeof addrMap === 'object') ? Object.keys(addrMap).filter(function (e) { return MAIL_RE.test(e); }) : [];
    return { to: l[0] || '', cc: l.slice(1) };
  }
  function composeParts(d, to, cc) {
    d = d || {};
    return { to: str(to), cc: (cc || []).map(str).filter(Boolean).join(','), subject: str(d.subject), body: d.body == null ? '' : String(d.body) };
  }
  /* 쓰기 창 값 채우기가 안 될 때의 되돌이 길 — 받는이·참조·제목만(본문은 주소창·기록에 남기지 않는다) */
  function composeUrl(base, p) {
    p = p || {};
    if (!str(p.to)) return '';
    return (str(base) || 'pu-cards.html') + '?view=mail&to=' + encodeURIComponent(p.to)
      + (str(p.cc) ? '&cc=' + encodeURIComponent(p.cc) : '') + '&subject=' + encodeURIComponent(str(p.subject));
  }

  /* 보낸편지함 줄 가운데 제목에 꼬리표가 든 가장 이른 것 */
  function findSent(rows, tag) {
    if (!tag || !Array.isArray(rows)) return null;
    var hits = rows.filter(function (m) { return m && m.out && m.day && str(m.s).indexOf(tag) >= 0; });
    if (!hits.length) return null;
    hits.sort(function (a, b) { return (a.d - b.d) || (Number(a.uid) - Number(b.uid)); });
    var f = hits[0];
    return { day: f.day, key: Inbox.linkKey.make({ slug: f.slug, uid: f.uid }), count: hits.length };
  }

  /* 후보 목록을 «회신 먼저»로 — reply = 받은 메일 · 보낸 날 이후, hint = 제목·첨부 이름에 서명·날인·스캔 */
  function rankReplies(list, sentDay) {
    if (!Array.isArray(list)) return [];
    var ok = isDay(sentDay);
    var out = list.map(function (m, i) {
      var c = Object.assign({}, m);
      c.reply = !!(ok && !m.out && m.day >= sentDay);
      c.hint = HINT_RE.test(str(m.s)) || (m.atts || []).some(function (a) { return HINT_RE.test(str(a && a.name)); });
      c._i = i;
      return c;
    });
    if (ok) out.sort(function (a, b) {
      var ra = a.reply ? (a.hint ? 0 : 1) : 2, rb = b.reply ? (b.hint ? 0 : 1) : 2;
      return (ra - rb) || (a._i - b._i);
    });
    out.forEach(function (c) { delete c._i; });
    return out;
  }

  /* 지난 제출 메일에서 받는이 따라 오기 — 사업 낱말이 제목에 든 가장 최근 «보낸» 메일, 우리·업체 주소는 뺀다 */
  function submitTo(rows, o) {
    o = o || {};
    var words = (o.words || []).map(str).filter(Boolean), co = (o.addrs && typeof o.addrs === 'object') ? o.addrs : {}, best = null;
    if (!words.length || !Array.isArray(rows)) return null;
    rows.forEach(function (m) {
      if (!m || !m.out || !m.day) return;
      if (!words.some(function (w) { return str(m.s).indexOf(w) >= 0; })) return;
      var to = (m.to || []).filter(function (e) { return e && !OWN_RE.test(e) && !has(co, e); });
      if (!to.length) return;
      if (!best || m.d > best.d) best = { d: m.d, day: m.day, to: to, s: str(m.s) };
    });
    return best ? { to: best.to, day: best.day, s: best.s } : null;
  }

  /* 「보냈음 기록」·「서명본으로 연결」 이 칸 창에 채우는 값 — 저장은 화면의 grSaveCell 한 곳 */
  function sentFields(step, day) {
    if (!isDay(day)) return null;
    if (step === 'sign') return { st: 'doing', sentAt: day };
    if (step === 'submit') return { st: 'done', gotAt: day, how: 'mail' };
    return null;
  }
  function gotFields(step, day) {
    return (step === 'sign' && isDay(day)) ? { st: 'done', gotAt: day } : null;
  }

  var api = { MSG: MSG, TAG_RE: TAG_RE, tagOf: tagOf, draft: draft, toCc: toCc, composeParts: composeParts, composeUrl: composeUrl,
    findSent: findSent, rankReplies: rankReplies, submitTo: submitTo, sentFields: sentFields, gotFields: gotFields };
  if (isNode) module.exports = api;
  root.PuGovReportSend = api;
})(typeof window !== 'undefined' ? window : globalThis);
