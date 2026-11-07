'use strict';
/* 푸른노무법인 경력관리 — «발송 대기»: 기관이 보낸 같은 꼴의 서류를 채워 두고, 사람이 한 번 눌러 답장한다
   (브라우저 window.KcareerSendQ / Node module.exports 겸용 · 대표 지시 2026-11-05 「시안대로 만들어라」)

   ■ 원칙 — 어기면 안 되는 것
     · 자동으로 «보내지» 않는다. 채워서 «대기»에 올릴 뿐이고, 나가는 것은 사람이 누른 한 번이다.
       도장·주민번호가 든 서류라 한 번 잘못 나가면 되돌릴 수 없다.
     · 양식이 «지문과 정확히 같을 때만» 채운다. 한 칸이라도 다르면 채우지 않고 «확인 필요»로 돌린다.
       칸 자리가 바뀐 양식에 그대로 채우면 엉뚱한 곳에 ■ 이 찍히고 도장이 찍힌다.
     · 금액·교육일은 매번 다르다 — 지문에 넣지 않는다. 대신 카드에 그대로 보여 눈으로 확인하게 하고, 원천세 셈만 검산한다.
     · 이 파일은 DOM·창고·네트워크를 만지지 않는다(순수). 화면(kcareer.html)이 파일·창고·메일을 맡는다.

   ■ 비슷한 서류가 오면 (similarPolicy) — 문서 docs/kcareer-발송대기-비슷한서류.md
     같은 기관 + 같은 양식 → 대기 · 같은 기관 + 양식이 바뀜 → 확인 필요 · 다른 기관 + 같은 양식 → 확인 필요(+ «이 기관도 같은 규칙»)
     · 이미 채워져 온 것 → 확인 필요 · 같은 메일을 또 넣음 → 이미 있음 · 그 밖 → 무시 */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;

  /* ── 규칙 — 어느 기관의 어떤 서류를 알아보나. 저장·편집이 쉽도록 글자·배열만 쓴다 ── */
  /* ⚠ 여기에 실제 기관 이름·메일 주소를 적지 말 것 — 저장소는 공개다.
       보낸 곳은 사람이 «✔ 이 기관도 같은 규칙으로»를 눌러 더하고(addSender), 그 규칙은 비공개 클라우드(경력관리 자료)에만 남는다. */
  var DEFAULT_RULES = [{
    id: 'paycheck-consent-v1',
    label: '지급확인서 및 개인정보 수집·이용 동의서',
    org: '',
    senders: [],
    subjectAny: ['지급확인서', '서명 및 회신'],
    attachAll: ['지급확인서', '동의서'],
    kind: '개인정보 동의서'
  }];

  function str(v) { return v == null ? '' : String(v); }
  function isArr(v) { return Array.isArray(v); }

  /* "이름 <a@b.c>" · "a@b.c" → 소문자 주소. 없으면 '' */
  function addrOf(from) {
    var s = str(from), m = /<([^<>\s]+@[^<>\s]+)>/.exec(s) || /([^\s<>"',;]+@[^\s<>"',;]+)/.exec(s);
    return m ? m[1].toLowerCase() : '';
  }
  function hasAll(text, words) {
    var t = str(text).replace(/\s+/g, '');
    return (words || []).every(function (w) { return t.indexOf(str(w).replace(/\s+/g, '')) >= 0; });
  }
  function hasAny(text, words) {
    var t = str(text).replace(/\s+/g, '');
    return (words || []).some(function (w) { return t.indexOf(str(w).replace(/\s+/g, '')) >= 0; });
  }
  function isHwpName(n) { return /\.hwpx?$/i.test(str(n)); }

  /* ── ① 메일 한 통이 어느 규칙에 맞나 ──
     known   : 보낸 사람·첨부 이름·제목이 모두 맞는다
     similar : 일부만 맞는다(주소가 다른 기관 · 제목이 다르다 · 첨부 이름이 다르다) — 사람이 본다
     none    : 관계없는 메일 */
  function matchMail(mail, rules) {
    var m = mail || {}, from = addrOf(m.from), subject = str(m.subject);
    var atts = (isArr(m.atts) ? m.atts : []).map(str).filter(isHwpName);
    var best = { level: 'none', rule: null, att: '', why: [] };
    var rank = { none: 0, similar: 1, known: 2 };
    (isArr(rules) ? rules : DEFAULT_RULES).forEach(function (rule) {
      if (!rule) return;
      var senderOk = !!from && (rule.senders || []).map(function (x) { return str(x).toLowerCase(); }).indexOf(from) >= 0;
      var att = atts.filter(function (n) { return hasAll(n, rule.attachAll); })[0] || '';
      var subjOk = hasAny(subject, rule.subjectAny);
      var why = [], level = 'none';
      if (senderOk && att && subjOk) level = 'known';
      else if ((senderOk && att) || (senderOk && subjOk) || (att && subjOk)) {
        level = 'similar';
        if (!senderOk) why.push('보낸 곳이 등록된 기관이 아닙니다');
        if (!att) why.push('첨부 이름이 알던 서류와 다릅니다');
        if (!subjOk) why.push('제목이 알던 것과 다릅니다');
      }
      if (rank[level] > rank[best.level]) best = { level: level, rule: rule, att: att, why: why };
    });
    return best;
  }

  /* ── ② 양식 지문 — HWPX section0.xml 의 «보이는 글자»와 «칸 자리»로 같은 양식인지 본다 ── */
  function textOf(xml) {
    var out = [], re = /<hp:t>([^<]*)<\/hp:t>/g, m;
    while ((m = re.exec(str(xml)))) out.push(m[1]);
    return out.join('\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  /* 칸 자리를 잡는 식 — 연도는 해마다 바뀌므로 숫자를 박지 않는다 */
  var RE_CONSENT = /<hp:t>□ 동의\s+□ 동의하지 않음<\/hp:t>/g;
  var RE_SIGN = /<hp:t>확\s+인\s*:(\s*)\(서명\)<\/hp:t>/g;
  var RE_DATE = /<hp:t>\s*(\d{4})년\s+월\s+일\s*<\/hp:t>/g;
  var BASE_ITEMS = '성명, 주민등록번호, 주소, 입금계좌';
  var WATCH_WORDS = ['신분증', '통장사본', '사본', '여권', '제3자'];
  function count(re, s) { var m = str(s).match(re); return m ? m.length : 0; }

  function checkForm(xml, rule) {
    var r = rule || DEFAULT_RULES[0], text = textOf(xml), warn = [];
    var title = hasAll(text, ['지급확인서', '개인정보', '동의서']);
    var org = hasAll(text, [r.org || '']);
    var n = { consent: count(RE_CONSENT, xml), sign: count(RE_SIGN, xml), date: count(RE_DATE, xml) };
    var filled = /<hp:t>확\s+인\s*:\s*[^\s(<][^<]*\(서명\)<\/hp:t>/.test(str(xml)) || /<hp:t>■ 동의/.test(str(xml));
    var items = (/\[수집\/이용항목\]\s*([^\n]*)/.exec(text) || [])[1];
    if (items != null && str(items).replace(/\s+/g, '') !== BASE_ITEMS.replace(/\s+/g, '')) warn.push('수집하는 개인정보 항목이 알던 것과 다릅니다');
    WATCH_WORDS.forEach(function (w) { if (text.indexOf(w) >= 0) warn.push('「' + w + '」라는 말이 새로 들어 있습니다'); });
    var verdict;
    if (!title) verdict = 'different';
    else if (filled) verdict = 'filled';
    else if (org && n.consent === 2 && n.sign === 1 && n.date === 1 && !warn.length) verdict = 'same';
    else verdict = 'changed';
    if (verdict === 'changed' && !warn.length) {
      if (!org) warn.push('기관 이름이 알던 것과 다릅니다');
      if (n.consent !== 2) warn.push('동의 칸이 ' + n.consent + '곳입니다(알던 것은 2곳)');
      if (n.sign !== 1) warn.push('서명 줄이 ' + n.sign + '곳입니다(알던 것은 1곳)');
      if (n.date !== 1) warn.push('날짜 줄이 ' + n.date + '곳입니다(알던 것은 1곳)');
    }
    return { verdict: verdict, counts: n, warn: warn };
  }

  /* ── ③ 카드에 보일 사실 + 원천세 검산 ──
     ⚠ 세율 8.8% 는 «이 양식에 적힌 값»이다. 세법 판단이 아니라 양식 안의 셈이 맞는지만 본다.
       어긋나도 막지 않는다 — 경고로 보여 주고 사람이 판단한다. */
  function facts(xml) {
    var lines = textOf(xml).split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var keep = lines.filter(function (s) { return /교육일|교육기관|강사비|원천세|실지급액|지급금액/.test(s); });
    var all = lines.join(' ');
    function won(re) { var m = re.exec(all); return m ? Number(m[1].replace(/,/g, '')) : null; }
    var pay = { gross: won(/강사비[^\d]{0,30}([\d,]+)\s*원/), tax: won(/원천세\s*(?:\([^)]*\))?[^\d]{0,12}([\d,]+)\s*원/), net: won(/실지급액\s*:?\s*([\d,]+)\s*원/) };
    var date = (/교육일\s*:\s*([^\n*]+)/.exec(lines.join('\n')) || [])[1] || '';
    return { lines: keep.slice(0, 6), pay: pay, eduDate: str(date).trim(), payWarn: checkPay(pay) };
  }
  function checkPay(p) {
    var w = [];
    if (p.gross == null || p.tax == null || p.net == null) { w.push('금액을 읽지 못했습니다 — 눈으로 확인해 주세요'); return w; }
    if (Math.abs(p.tax - p.gross * 0.088) >= 10) w.push('원천세가 강사비의 8.8%와 다릅니다');
    if (p.net !== p.gross - p.tax) w.push('실지급액이 강사비 − 원천세와 다릅니다');
    return w;
  }

  /* ── ④ HWPX 채우기 — 동의 ■ · 성명 · 날짜 ──
     ⚠ 앵커가 «정확히 기대한 개수»가 아니면 던진다(err.code='anchor'). 부르는 쪽은 채우지 않고 확인 필요로 돌린다.
     ⚠ 글을 고친 문단의 줄 위치표(linesegarray)만 지운다 — 한글이 맞지 않는 표를 못 읽는다(한컴 실측 2026-11-05).
        그림이 든 문단은 도장 쪽에서 따로 다룬다. */
  function anchorErr(msg) { var e = new Error(msg); e.code = 'anchor'; return e; }
  function stripSegs(xml, re) {
    return str(xml).replace(/<hp:p [^>]*>(?:(?!<\/hp:p>)[\s\S])*?<\/hp:p>/g, function (p) {
      return (re.test(p) && p.length < 6000) ? p.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '') : p;
    });
  }
  function esc(s) { return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function todayKST(now) {
    var d = new Date((now == null ? Date.now() : now) + 9 * 3600e3);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  function fillConsent(xml, o) {
    o = o || {};
    var name = str(o.name).trim();
    if (!name) throw anchorErr('성명이 비어 있습니다');
    var gap = new Array((o.gap || 16) + 1).join(' ');
    var chk = checkForm(xml, o.rule);
    if (chk.verdict !== 'same') throw anchorErr('같은 양식이 아닙니다(' + chk.verdict + ')');
    var x = str(xml);
    x = x.replace(RE_CONSENT, '<hp:t>■ 동의       □ 동의하지 않음</hp:t>');
    x = x.replace(RE_SIGN, '<hp:t>확   인 : ' + esc(name) + gap + '(서명)</hp:t>');
    x = x.replace(RE_DATE, function (m, y) { return '<hp:t> ' + y + '년   ' + o.month + '월    ' + o.day + '일 </hp:t>'; });
    return stripSegs(x, /확   인 :|■ 동의|\d{4}년   \d+월/);
  }

  /* 도장 — Stamp 는 KcareerHwpStamp(js/kcareer-hwpstamp.js). 서명 자리가 «정확히 하나»일 때만 찍는다 */
  function stampSeal(xml, Stamp, o) {
    o = o || {};
    var spots = Stamp.findSpots(xml).filter(function (s) { return /서명/.test(s.label); });
    if (spots.length !== 1) throw anchorErr('서명 자리가 ' + spots.length + '곳입니다');
    return Stamp.insertPic(xml, Stamp.picXml({ id: o.imgId, orgPx: o.px, picId: 9100, showHU: o.size || 3400,
      offX: o.offX == null ? 3800 : o.offX, offY: o.offY == null ? -700 : o.offY }), spots[0]);
  }

  /* ── ⑤ 대기열 ── */
  function hash(s) { var h = 5381, t = str(s); for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return h.toString(36); }
  function itemId(mailKey, attName) { return 'sq_' + hash(str(mailKey) + '|' + str(attName)); }
  var STATUS = ['pending', 'review', 'hold', 'sent', 'dismissed'];
  function makeItem(o, now) {
    o = o || {}; var t = new Date(now == null ? Date.now() : now).toISOString();
    return { id: itemId(o.mailKey, o.attName), entityType: 'send_queue', schemaVersion: 1,
      status: o.status || 'pending', ruleId: str(o.ruleId), org: str(o.org), from: str(o.from), replyTo: addrOf(o.from),
      subject: str(o.subject), mailKey: str(o.mailKey), attName: str(o.attName), docName: str(o.docName),
      fileId: str(o.fileId), facts: o.facts || null, reasons: isArr(o.reasons) ? o.reasons.slice() : [],
      createdAt: t, updatedAt: t, sentAt: '', sentTo: '', recordId: '' };
  }
  var NEXT = {
    pending: { send: 'sent', hold: 'hold', dismiss: 'dismissed' },
    hold: { resume: 'pending', dismiss: 'dismissed' },
    review: { dismiss: 'dismissed', resolve: 'pending' },
    sent: {}, dismissed: {}
  };
  /* 되는 길만 열어 둔다 — 이미 보낸 것을 다시 보내는 길이 «없다» */
  function transition(item, action, now, info) {
    var to = item && NEXT[item.status] && NEXT[item.status][action];
    if (!to) { var e = new Error('「' + (item && item.status) + '」에서는 「' + action + '」을 할 수 없습니다'); e.code = 'state'; throw e; }
    var c = {}; Object.keys(item).forEach(function (k) { c[k] = item[k]; });
    c.status = to; c.updatedAt = new Date(now == null ? Date.now() : now).toISOString();
    if (to === 'sent') { c.sentAt = c.updatedAt; c.sentTo = str(info && info.to) || item.replyTo; c.recordId = str(info && info.recordId); }
    return c;
  }
  function stripRe(s) { return str(s).replace(/^\s*((re|회신)\s*:\s*)+/i, '').trim(); }
  function replyPayload(item, o) {
    o = o || {}; var f = item.facts || {};
    var edu = f.eduDate ? '(' + str(f.eduDate).replace(/\(.*$/, '').trim() + ')' : '';
    var body = '안녕하세요. ' + (item.org || '담당자') + ' 담당자님.\n'
      + '요청하신 지급확인서 및 개인정보 수집·이용 동의서' + (edu ? ' ' + edu : '') + '에 동의 표시와 서명(날인)하여 첨부합니다.\n'
      + '확인 부탁드립니다. 감사합니다.\n푸른노무법인 ' + str(o.name) + ' 드림';
    return { to: item.replyTo, subject: 'RE: ' + stripRe(item.subject), body: body,
      files: [{ name: str(o.fileName || item.docName), size: Number(o.size) || 0, path: str(o.path) }] };
  }

  /* ── ⑥ 비슷한 서류 정책 — «무엇을 할지»를 한 곳에서 정한다 ──
     match : matchMail 결과 · check : checkForm 결과(첨부를 읽었을 때만) · existing : 같은 id 의 기존 항목 */
  function similarPolicy(match, check, existing) {
    if (existing && (existing.status === 'sent' || existing.status === 'pending' || existing.status === 'hold')) {
      return { action: 'dup', label: '이미 있음', reasons: ['같은 메일의 같은 첨부가 이미 ' + ({ sent: '보냈습니다', pending: '대기 중입니다', hold: '보류 중입니다' })[existing.status]] };
    }
    if (!match || match.level === 'none') return { action: 'ignore', label: '관계없음', reasons: [] };
    var reasons = (match.why || []).slice();
    if (!check) return { action: 'review', label: '확인 필요', reasons: reasons.concat(['첨부를 읽지 못했습니다']) };
    if (check.verdict === 'filled') return { action: 'review', label: '확인 필요', reasons: reasons.concat(['이미 채워져 온 서류입니다 — 다시 채우지 않습니다']) };
    if (check.verdict === 'different') return { action: 'review', label: '확인 필요', reasons: reasons.concat(['알던 양식과 다른 서류입니다']) };
    if (check.verdict === 'changed') return { action: 'review', label: '확인 필요', reasons: reasons.concat(['양식이 바뀌었습니다']).concat(check.warn || []) };
    if (match.level === 'similar') {
      return { action: 'review', label: '확인 필요', reasons: reasons.concat(['양식은 같습니다']), learn: { type: 'addSender' } };
    }
    return { action: 'queue', label: '발송 대기', reasons: [] };
  }
  /* 사람이 «이 기관도 같은 규칙으로» 를 눌렀을 때 — 규칙 목록을 고친 «새 사본»을 돌려준다 */
  function addSender(rules, ruleId, email) {
    var a = addrOf(email); if (!a) return rules;
    return (rules || []).map(function (r) {
      if (r.id !== ruleId) return r;
      var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; });
      c.senders = (r.senders || []).slice(); if (c.senders.indexOf(a) < 0) c.senders.push(a);
      return c;
    });
  }

  var api = { DEFAULT_RULES: DEFAULT_RULES, STATUS: STATUS, addrOf: addrOf, matchMail: matchMail, textOf: textOf, checkForm: checkForm,
    facts: facts, checkPay: checkPay, fillConsent: fillConsent, stampSeal: stampSeal, todayKST: todayKST, itemId: itemId, makeItem: makeItem,
    transition: transition, replyPayload: replyPayload, similarPolicy: similarPolicy, addSender: addSender, stripRe: stripRe };
  if (isNode) module.exports = api; else root.KcareerSendQ = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
