'use strict';
/* 푸른노무법인 경력관리 — «요청 메일»: 법인 메일함에 온 경력 요청·동의서·기타 서류 요청을 알아보고, 정리해 두고, 알린다
   (브라우저 window.KcareerMailReq / Node module.exports 겸용 · 대표 지시 2026-11-09
    「법인메일로 경력요청 및 동의서 등 기타 메일로 요청사항이 있을경우 자동으로 감지하고 경력관리에 정리하면서 알람으로 정리해달라」)

   ■ 원칙 — 어기면 안 되는 것
     · «알아보고 알릴 뿐» 채우거나 보내지 않는다. 메일 읽기(peek)만 한다 — 답장·서식 채우기는 사람이 한다.
     · 확실한 것만 올린다. 제목·첨부 이름에 단서가 있고 «요청 말투·양식 첨부·기한» 중 하나가 겹칠 때, 또는 본문에만 단서가 있으면
       «요청 말투 + (양식 첨부 또는 기한)»까지 겹칠 때. 올린 까닭(why)은 늘 남겨 사람이 맞는지 본다.
     · 못 찾으면 지어내지 않는다. 기한을 못 찾으면 «기한 모름» — 본문의 아무 날짜나 기한으로 잡지 않는다(기한 말 가까이 있는 날짜만).
     · 사람이 정한 상태(st)는 스캔이 «덮지 않는다». 새로 만들 때만 transaction 으로 쓰고(있으면 건드리지 않음),
       보강(기한·답장 주소)은 그 칸 몇 개만 update 한다.
     · DOM·화면을 만지지 않는다. 읽는 자리(mailbox 거울)와 쓰는 자리(kcareer/{uid}/mailreq)만 DB 로 만진다.

   ■ 어디에 두나 — kcareer/{uid}/mailreq/{items/<id> · cur/<폴더>}
     경력관리 자료 통(ls)과 «따로»다. 통은 at 이 바뀌면 다른 기기에 «새 저장» 띠가 뜨는데(fbWatch),
     이 칸은 at 을 건드리지 않으니 띠가 뜨지 않는다. 보안규칙은 kcareer/$uid 본인 읽기·쓰기 그대로 — 바꾸지 않았다.
     포털(enter.html)도 같은 모듈로 같은 자리를 읽고 쓴다 — 경력관리를 열어 두지 않아도 알림이 뜬다.
   ■ 문서: docs/kcareer-요청메일.md */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;

  /* ── 한도·기본값 (규칙이 아니라 «손잡이» — 문서 표와 검사가 «있는지»만 본다) ── */
  var WINDOW_DAYS = 21;      // 처음 훑을 때 거슬러 올라가는 날수 — 더 옛 메일은 알리지 않는다(이미 처리했을 가능성이 큼)
  var SOON_DAYS = 3;         // 기한이 이 안에 들면 «임박»
  var PER_FULL = 120;        // 폴더마다 처음엔 최근 이만큼
  var PER_POLL = 30;         // 이어 훑을 땐 최근 이만큼(그래도 다 새것이면 PER_FULL 로 늘린다)
  var BODY_MAX = 5;          // 한 번에 본문을 여는 최대 건수 — 메일 서버를 한꺼번에 두드리지 않는다
  var BODY_TRY = 3;          // 본문을 못 연 건은 이만큼만 다시 해 본다
  var POLL_MS = 5 * 60 * 1000;   // 화면을 켜 둔 동안 다시 훑는 간격(메일함 거울은 3분마다 갱신)
  var TEXT_MAX = 8000;       // 본문에서 앞쪽만 본다 — 아래에 인용된 지난 메일의 날짜를 기한으로 잡지 않게

  var KINDS = [
    { key: 'consent', icon: '📝', label: '동의서' },
    { key: 'career', icon: '📇', label: '경력 요청' },
    { key: 'other', icon: '📨', label: '기타 요청' }
  ];
  var STATES = { 'new': '새 요청', doing: '처리 중', done: '처리 완료', ignored: '요청 아님' };
  var ROOT_PATH = 'kcareer';   // kcareer/{uid}/mailreq
  /* 받은·손으로 만든 폴더만 — 보낸·보관·임시·스팸·휴지통은 «내게 온 요청»이 아니다 */
  var BOX_KINDS = ['inbox', 'custom'];
  var OWN_RE = /@pureun\.kr$/i;

  /* ── 말 — «단서»다. 늘릴 때는 docs/kcareer-요청메일.md 표와 같이 고친다(검사가 맞춰 본다) ── */
  var WORDS = {
    consent: /동의서|서약서|확약서|위임장|동의\s*(?:요청|여부)|개인정보\s*(?:수집|이용|제공|활용)[^\n]{0,12}동의/,
    career: /경력\s*(?:증명|확인|사항|서|자료|요청|조회)|이력\s*서|이력\s*사항|프로필|약력|강사\s*(?:이력|등록|프로필)|수행\s*실적|실적\s*(?:증명|확인|자료)|재직\s*증명|자격증\s*사본/,
    other: /서류|증빙|증명서|확인서|신청서|제출\s*자료|양식|서식|계획서|통장\s*사본|사업자\s*등록증|사본/
  };
  /* 요청하는 말투 — «첨부하여»는 넣지 않는다(요청이 아니어도 첨부 메일마다 있다) */
  var ACT = /제출|회신|회송|송부|작성|날인|서명|기재|보내\s*(?:주|드)|부탁|요청|바랍니다|바람|협조|의사\s*(?:확인|여쭙)|참여\s*의사/;
  /* 광고·소식지 — 제목·보낸이·미리보기에 있으면 요청이 아니다 */
  var ADS = /\(광고\)|\[광고\]|광고\s*\)|수신\s*거부|수신거부|unsubscribe|뉴스\s*레터|newsletter|웹진|webzine/i;
  /* 「부탁·바랍니다·주세요」 — «달라고 하는» 말. 답장(RE:)은 이것이나 새 기한이 있어야 요청이다(서명해 돌려보내며 «서명하여 첨부합니다»라 쓴 것은 요청이 아니다) */
  var ASK = /부탁|바랍니다|바람|요청|주시기|주세요|해\s*주/;
  var FORM_NAME = /양식|서식|신청서|동의서|확인서|서약서|제출|작성/;
  var FORM_EXT = /\.(hwp|hwpx|doc|docx|xls|xlsx|pdf)$/i;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function oneLine(s) { return str(s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' '); }
  function cut(s, n) { s = oneLine(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function okSlug(s) { return typeof s === 'string' && !!s && s !== '__proto__' && s !== 'constructor' && s !== 'prototype' && !/[\/.#$\[\]]/.test(s); }
  function mailOf(v) { var m = /([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/.exec(str(v)); return m ? m[1].toLowerCase() : ''; }

  /* ── 본문 다듬기 — html 만 오는 메일이 많다(실측: text 0자 · html 2만 자). DOM 없이 글자로 ── */
  function unentity(s) {
    return String(s || '')
      .replace(/&#(\d{1,7});/g, function (m, d) { var n = Number(d); try { return (n > 0 && n <= 0x10ffff) ? String.fromCodePoint(n) : ' '; } catch (e) { return ' '; } })
      .replace(/&#x([0-9a-f]{1,6});/gi, function (m, h) { var n = parseInt(h, 16); try { return (n > 0 && n <= 0x10ffff) ? String.fromCodePoint(n) : ' '; } catch (e) { return ' '; } })
      .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&amp;/gi, '&');
  }
  function htmlText(h) {
    return unentity(String(h || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '));
  }
  /* 답장·전달 꼬리를 자른다 — 아래에 인용된 지난 메일의 날짜·주소를 이 메일 것으로 읽지 않게 */
  function bodyOf(j) {
    var t = str(j && j.text) || str(htmlText(j && j.html));
    t = t.replace(/\r/g, '').replace(/[ \t ]+/g, ' ');
    var q = /\n\s*(?:-{2,}\s*)?(?:original message|원본\s*메시지|이전\s*메일)|\n\s*(?:보낸\s*사람|보낸\s*이|From)\s*:/i.exec(t);
    if (q && q.index >= 100) t = t.slice(0, q.index);
    return t.slice(0, TEXT_MAX);
  }

  /* ── 기한 — «기한 말 가까이 있는 날짜만» ──
     「제출기한 : 2026년 11월 16일 월요일 18시까지」 → 2026-11-16 18:00. 날짜가 여럿이면 기한 말이 붙은 것, 같으면 «이른 것»(일찍 알리는 쪽이 안전하다).
     ⚠ 기한 말이 가까이 없는 날짜(행사일·옛 일정)는 잡지 않는다 — 틀린 기한으로 알리느니 «기한 모름»이다. */
  var DATE_YEAR = /(^|[^\d])((?:19|20)\d{2})\s*(?:년|[.\-\/])\s*(\d{1,2})\s*(?:월|[.\-\/])\s*(\d{1,2})\s*일?/g;
  var DATE_NOYEAR = /(^|[^\d])(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  var AFTER_DATE = /^\s*(?:[(（]\s*[월화수목금토일]\s*[)）]|[월화수목금토일]요일)?\s*(?:(오전|오후)\s*)?(?:(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?|(\d{1,2})\s*:\s*(\d{2}))?/;
  function validYMD(y, m, d) { var t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }
  function dateHits(text, refMs) {
    var out = [], used = [], m, ref = new Date(refMs > 0 ? refMs : Date.now());
    function overlap(a, b) { return used.some(function (u) { return a < u[1] && b > u[0]; }); }
    function push(start, end, y, mo, d, hasYear) {
      if (overlap(start, end)) return;
      if (!hasYear) {
        y = ref.getFullYear();
        if (new Date(y, mo - 1, d, 23, 59).getTime() < ref.getTime() - 45 * 864e5) y++;     // 연도가 없으면 «받은 날 이후 가장 가까운» 해
      }
      if (!validYMD(y, mo, d)) return;
      var a = AFTER_DATE.exec(text.slice(end)) || [''], hh = null, mm = 0;
      if (a[2] != null) { hh = Number(a[2]); mm = a[3] != null ? Number(a[3]) : 0; if (a[1] === '오후' && hh < 12) hh += 12; if (a[1] === '오전' && hh === 12) hh = 0; }
      else if (a[4] != null) { hh = Number(a[4]); mm = Number(a[5]); if (a[1] === '오후' && hh < 12) hh += 12; if (a[1] === '오전' && hh === 12) hh = 0; }   // 「오후 6:00」도 18:00
      if (hh === 24 && mm === 0) { hh = 23; mm = 59; }            // 「24시까지」 = 그날 끝(그날 0시로 읽으면 기한이 하루 앞당겨진다)
      if (hh != null && (hh > 23 || mm > 59)) { hh = null; mm = 0; }
      var endAll = end + (hh != null ? a[0].length : (/^\s*(?:[(（]\s*[월화수목금토일]\s*[)）]|[월화수목금토일]요일)/.exec(text.slice(end)) || [''])[0].length);
      used.push([start, endAll]);
      out.push({ start: start, end: endAll, y: y, m: mo, d: d, hh: hh, mm: mm, hasYear: hasYear });
    }
    DATE_YEAR.lastIndex = 0;
    while ((m = DATE_YEAR.exec(text))) push(m.index + m[1].length, m.index + m[0].length, Number(m[2]), Number(m[3]), Number(m[4]), true);
    DATE_NOYEAR.lastIndex = 0;
    while ((m = DATE_NOYEAR.exec(text))) push(m.index + m[1].length, m.index + m[0].length, 0, Number(m[2]), Number(m[3]), false);
    return out.sort(function (a, b) { return a.start - b.start; });
  }
  function deadlineOf(text, refMs) {
    text = String(text || '');
    var hits = dateHits(text, refMs), best = null;
    var prios = hits.map(function (h) {
      var before = text.slice(Math.max(0, h.start - 16), h.start), after = text.slice(h.end, h.end + 8);
      if (/(?:제출|회신|접수|신청)\s*(?:기한|기간|마감)|마감\s*(?:일|기한)?|기한|데드라인/.test(before)) return 4;
      if (/^\s*(?:까지|이내|전까지)/.test(after)) return 3;
      return /기한|마감|까지|이내|회신|제출/.test(text.slice(Math.max(0, h.start - 20), h.end + 20)) ? 2 : 0;
    });
    /* 범위(「11월 10일 ~ 11월 16일」)는 «끝 날짜»가 기한이다 — 시작 날짜가 기한 말 바로 뒤에 있어도(「제출기한: 11월 10일 ~ 11월 16일」)
       그 말을 끝 날짜에 넘기고 시작 날짜는 버린다. 안 그러면 «이른 날짜 우선» 규칙이 시작일을 기한으로 잡는다 */
    hits.forEach(function (h, i) {
      var nx = hits[i + 1];
      if (nx && /^\s*(?:[~∼〜\-–—]|부터)\s*$/.test(text.slice(h.end, nx.start))) { prios[i + 1] = Math.max(prios[i + 1], prios[i]); prios[i] = 0; }
    });
    hits.forEach(function (h, i) {
      var prio = prios[i];
      if (!prio) return;
      var key = h.y * 1e8 + h.m * 1e6 + h.d * 1e4 + (h.hh == null ? 2359 : h.hh * 100 + h.mm);
      if (!best || prio > best.prio || (prio === best.prio && key < best.key)) best = { prio: prio, key: key, h: h };
    });
    if (!best) return null;
    var h = best.h;
    return { date: h.y + '-' + pad(h.m) + '-' + pad(h.d), time: h.hh == null ? '' : pad(h.hh) + ':' + pad(h.mm),
      text: cut(text.slice(h.start, h.end), 40), guess: !h.hasYear };
  }
  /* 기한 시각(ms) — 시간이 없으면 그날 끝(23:59). 못 읽으면 NaN */
  function dueMs(dl) {
    if (!dl || !dl.date) return NaN;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(dl.date)); if (!m) return NaN;
    var t = /^(\d{1,2}):(\d{2})$/.exec(str(dl.time));
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), t ? Number(t[1]) : 23, t ? Number(t[2]) : 59, 0).getTime();
  }
  /* 달력 날짜 차이로 «D-3 · D-day · 기한 지남 2일» — 시각이 아니라 날로 센다(사람이 그렇게 센다) */
  function ddayOf(dl, now) {
    var due = dueMs(dl); if (isNaN(due)) return { n: null, label: '' };
    var a = new Date(due), b = new Date(now > 0 ? now : Date.now());
    var n = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 864e5);
    return { n: n, label: n > 0 ? 'D-' + n : (n === 0 ? 'D-day' : '기한 지남 ' + (-n) + '일') };
  }
  /* 회신 주소 — 「회신·송부·제출·이메일」 가까이 적힌 주소. 없으면 '' (화면은 보낸 곳으로 답장한다고 말한다) */
  function replyOf(text) {
    text = String(text || '');
    var re = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, m, first = '';
    while ((m = re.exec(text))) {
      var a = m[0].toLowerCase();
      if (OWN_RE.test(a)) continue;
      /* 단서는 «주소 앞» 말(이메일 · 회신:)이나 «바로 뒤» 말(로 회신)만 — 넓게 보면 옆 주소의 단서를 훔친다 */
      if (/회신|송부|제출|보내|이메일|메일|e-?mail/i.test(text.slice(Math.max(0, m.index - 24), m.index)) || /^\s*(?:로|으로|로써)?\s*(?:회신|송부|제출|보내)/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 10))) return a;
      if (!first) first = a;
    }
    return '';
  }

  /* ── 알아보기 ──
     row = 메일함 거울 한 줄 { s 제목, an 첨부 이름들, p 미리보기(140자), f 보낸이 이름, e 보낸이 주소, a 첨부 수, d 받은 시각 }
     opt = { text: 본문 전체(있으면 «본문 단서»를 이것으로), refMs }
     돌려주는 것: null(요청 아님) 또는 { kinds, why, forms, deadline, replyTo } */
  function detect(row, opt) {
    row = row || {}; opt = opt || {};
    if (OWN_RE.test(mailOf(row.e))) return null;                   // 우리가 보낸 것
    var subj = oneLine(row.s), names = (Array.isArray(row.an) ? row.an : []).map(str).filter(Boolean);
    var pre = oneLine(row.p), body = oneLine(opt.text) || pre;
    if (ADS.test(subj + ' ' + str(row.f) + ' ' + str(row.e) + ' ' + pre) || /\(광고\)|\[광고\]/.test(body)) return null;
    var head = subj + ' ' + names.join(' ');                       // 제목·첨부 이름 = «강한» 단서
    var why = [], kinds = [], strong = {};
    ['consent', 'career'].forEach(function (k) {
      var m = WORDS[k].exec(subj);
      if (m) { strong[k] = 1; why.push('제목에 «' + cut(m[0], 14) + '»'); return; }
      names.some(function (n) { var mm = WORDS[k].exec(n); if (mm) { strong[k] = 1; why.push('첨부 «' + cut(n, 28) + '»'); return true; } return false; });
    });
    var act = ACT.exec(subj + ' ' + body), actInSubj = ACT.test(subj);
    var forms = names.filter(function (n) { return FORM_EXT.test(n) && (FORM_NAME.test(n) || WORDS.consent.test(n) || WORDS.career.test(n) || WORDS.other.test(n)); });
    var dl = deadlineOf(opt.text ? opt.text : (subj + '\n' + pre), opt.refMs || row.d);
    /* 「RE:」·「회신:」 — 우리가 보낸 것에 상대가 답한 메일. «달라는 말»(ASK)이나 새 기한이 없으면(서명해 돌려보낸 사본 등) 요청이 아니다 */
    var isReply = /^\s*(?:re|회신|답장)\s*[:：]/i.test(subj);
    if (isReply && !ASK.test(subj + ' ' + body) && !dl) return null;     // 모든 종류에 — 본문 단서·기타 요청도 답장이면 «달라는 말»이나 새 기한이 있어야 한다
    var weak = {};
    ['consent', 'career'].forEach(function (k) { if (!strong[k]) { var m = WORDS[k].exec(body); if (m) weak[k] = m[0]; } });
    ['consent', 'career'].forEach(function (k) {
      if (strong[k] && (act || forms.length || dl)) kinds.push(k);
      else if (weak[k] && act && (forms.length || dl)) { kinds.push(k); why.push('본문에 «' + cut(weak[k], 14) + '»'); }
    });
    if (!kinds.length && WORDS.other.test(head + ' ' + body) && act && (dl || forms.length || actInSubj)) {
      kinds.push('other'); var o = WORDS.other.exec(head + ' ' + body); why.push('서류 말 «' + cut(o[0], 14) + '»');
    }
    if (!kinds.length) return null;
    if (act && why.length < 4 && !actInSubj) why.push('요청 말투 «' + cut(act[0], 10) + '»'); else if (actInSubj && why.length < 4) why.push('제목에 요청 말투 «' + cut(ACT.exec(subj)[0], 10) + '»');
    if (forms.length && why.length < 4) why.push('양식 첨부 «' + cut(forms[0], 24) + '»');
    if (dl) why.push('기한 ' + dl.text);
    var order = KINDS.map(function (k) { return k.key; });
    kinds.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    return { kinds: kinds, why: why.slice(0, 5), forms: forms.slice(0, 5), deadline: dl, replyTo: opt.text ? replyOf(opt.text) : '' };
  }
  function kindMeta(key) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i].key === key) return KINDS[i]; return null; }
  function kindsLabel(kinds) { return (kinds || []).map(function (k) { var m = kindMeta(k); return m ? m.icon + ' ' + m.label : ''; }).filter(Boolean).join(' · '); }

  /* ── 한 건의 기록 — 클라우드(kcareer/{uid}/mailreq/items/<id>)에 그대로 간다 ──
     ⚠ 본문은 «담지 않는다»(제목·보낸이·첨부 이름·기한·근거 짧게뿐). 메일 원본은 메일함에 있다. */
  function idOf(slug, uid) { return (okSlug(slug) && /^[0-9]{1,12}$/.test(str(uid))) ? slug + '~' + str(uid) : ''; }
  function makeItem(slug, uid, row, hit, now) {
    var id = idOf(slug, uid); if (!id) return null;
    var rec = {
      id: id, entityType: 'kcareer_mailreq', createdAt: now, updatedAt: now,
      slug: slug, uid: str(uid), kinds: hit.kinds.slice(), st: Number(row.w) === 1 ? 'doing' : 'new',   // 이미 답장한 메일(w)은 «새 요청»으로 울리지 않는다
      s: cut(row.s, 120) || '(제목 없음)', f: cut(row.f, 40), e: mailOf(row.e).slice(0, 80),
      d: Number(row.d) || 0, an: (Array.isArray(row.an) ? row.an : []).map(function (n) { return cut(n, 50); }).filter(Boolean).slice(0, 3),
      why: hit.why.map(function (w) { return cut(w, 48); }).slice(0, 5)
    };
    if (hit.deadline) rec.deadline = hit.deadline;
    if (hit.replyTo) rec.replyTo = hit.replyTo;
    return rec;
  }

  /* ── 셈 — 알림에 쓰는 숫자 ──
     열린 것(open) = 새 요청 + 확인함. 임박 = 열린 것 중 기한이 SOON_DAYS 안. 지남 = 열린 것 중 기한이 지남.
     알림 숫자(alarm) = «새 요청이거나 임박이거나 지난 것»을 한 번씩만 센다 — 확인한 건도 기한이 코앞이면 계속 알린다. */
  function toList(items) { return (Array.isArray(items) ? items : (obj(items) ? Object.keys(items).map(function (k) { return items[k]; }) : [])).filter(obj); }
  function urgency(it, now) {
    if (!it || (it.st !== 'new' && it.st !== 'doing')) return '';
    var due = dueMs(it.deadline); if (isNaN(due)) return '';
    if (due < now) return 'overdue';
    return due - now <= SOON_DAYS * 864e5 ? 'soon' : '';
  }
  /* 알릴 것 — 새 요청이거나, 확인함이어도 기한이 임박·지난 것. 「닫기」를 기억하는 서명(어느 건들이었나)에도 쓴다 */
  function alarmItems(items, now) {
    now = now > 0 ? now : Date.now();
    return toList(items).filter(function (it) { return (it.st === 'new' || it.st === 'doing') && (it.st === 'new' || !!urgency(it, now)); });
  }
  function summary(items, now) {
    now = now > 0 ? now : Date.now();
    var s = { total: 0, open: 0, newer: 0, soon: 0, overdue: 0, alarm: 0, done: 0, ignored: 0, tone: '' };
    toList(items).forEach(function (it) {
      s.total++;
      if (it.st === 'done') { s.done++; return; }
      if (it.st === 'ignored') { s.ignored++; return; }
      s.open++;
      var u = urgency(it, now);
      if (it.st === 'new') s.newer++;
      if (u === 'overdue') s.overdue++; else if (u === 'soon') s.soon++;
    });
    s.alarm = alarmItems(items, now).length;
    s.tone = (s.overdue || s.soon) ? 'red' : (s.newer ? 'amber' : '');
    return s;
  }
  /* 알림 한 줄 — 「📬 요청 메일 3건 · 새 2 · 기한 임박 1 · 기한 지남 1」. 알릴 것이 없으면 '' */
  function summaryText(sm) {
    if (!sm || !sm.alarm) return '';
    var p = [];
    if (sm.newer) p.push('새 ' + sm.newer);
    if (sm.soon) p.push('기한 임박 ' + sm.soon);
    if (sm.overdue) p.push('기한 지남 ' + sm.overdue);
    return '📬 확인할 요청 메일 ' + sm.alarm + '건' + (p.length ? ' · ' + p.join(' · ') : '');
  }
  /* 목록 차례 — 기한 지난 것 → 임박 → 새 것(최근 먼저) → 확인함(기한 빠른 순) → 끝난 것(최근 처리 먼저) */
  function sortItems(items, now) {
    now = now > 0 ? now : Date.now();
    var rank = function (it) {
      var u = urgency(it, now);
      if (u === 'overdue') return 0; if (u === 'soon') return 1;
      if (it.st === 'new') return 2; if (it.st === 'doing') return 3; return it.st === 'done' ? 4 : 5;
    };
    return toList(items).slice().sort(function (a, b) {
      var ra = rank(a), rb = rank(b); if (ra !== rb) return ra - rb;
      if (ra <= 1 || ra === 3) { var da = dueMs(a.deadline), db = dueMs(b.deadline); if (!isNaN(da) && !isNaN(db) && da !== db) return da - db; if (isNaN(da) !== isNaN(db)) return isNaN(da) ? 1 : -1; }
      if (ra >= 4) return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
      return (Number(b.d) || 0) - (Number(a.d) || 0);
    });
  }
  /* 탭 — 진행 중(새 요청+확인함) · 완료 · 요청 아님 · 전체 */
  var TABS = [{ key: 'open', label: '진행 중' }, { key: 'done', label: '처리 완료' }, { key: 'ignored', label: '요청 아님' }, { key: 'all', label: '전체' }];
  function filterItems(items, tab) {
    return toList(items).filter(function (it) {
      if (tab === 'all') return true;
      if (tab === 'done') return it.st === 'done';
      if (tab === 'ignored') return it.st === 'ignored';
      return it.st === 'new' || it.st === 'doing';
    });
  }
  /* 상태 바꾸기 — 여러 건을 «한 번에 한 번 저장»하는 update 모양(경로 → 값). st 말고 다른 칸은 건드리지 않는다 */
  function stateUpdate(ids, st, now) {
    var u = {};
    if (!STATES[st]) return u;
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      if (typeof id !== 'string' || !/^[^\/.#$\[\]]+~[0-9]{1,12}$/.test(id)) return;
      u[id + '/st'] = st; u[id + '/updatedAt'] = now;
      u[id + '/doneAt'] = st === 'done' ? now : null;
    });
    return u;
  }

  /* 직접 고치기 — 팝업에서 사람이 종류·기한·메모를 고친다(대표 지시 2026-11-09 「팝업창 보고 고치게」).
     edit = { kinds?: ['consent', …], deadline?: { date:'YYYY-MM-DD', time:'HH:MM'|'' } | null, memo?: '글' } — 고친 칸만 넣는다.
     돌려주는 것: { ok:true, update: 한 번에 쓰는 update 모양 } 또는 { ok:false, error }.
     ⚠ 고친 칸에는 «fixed» 표시를 남긴다 — 본문 보강(enrich)이 사람이 고친 기한·종류를 다시 덮지 않게.
     ⚠ 상태(st)·제목·보낸이는 여기서 안 고친다(상태는 stateUpdate, 나머지는 메일에서 온 사실이다). */
  var MEMO_MAX = 300;
  function editUpdate(id, edit, now) {
    var fail = function (m) { return { ok: false, error: m }; };
    if (typeof id !== 'string' || !/^[^\/.#$\[\]]+~[0-9]{1,12}$/.test(id)) return fail('건을 찾을 수 없습니다');
    edit = obj(edit) ? edit : {};
    var u = {}, n = now > 0 ? now : Date.now();
    if (has(edit, 'kinds')) {
      var want = Array.isArray(edit.kinds) ? edit.kinds : [];
      var ks = KINDS.map(function (k) { return k.key; }).filter(function (k) { return want.indexOf(k) >= 0; });
      if (!ks.length) return fail('종류를 하나 이상 골라 주세요');
      u[id + '/kinds'] = ks; u[id + '/fixed/kinds'] = 1;
    }
    if (has(edit, 'deadline')) {
      var d = edit.deadline;
      if (d === null) u[id + '/deadline'] = null;                    // 「기한 없음」으로 고침
      else {
        var m = obj(d) ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d.date)) : null;
        if (!m) return fail('기한 날짜를 골라 주세요');
        if (!validYMD(Number(m[1]), Number(m[2]), Number(m[3]))) return fail('없는 날짜입니다');
        var tm = str(d.time);
        if (tm && !/^([01]\d|2[0-3]):[0-5]\d$/.test(tm)) return fail('시각은 «시:분»으로 적어 주세요');
        u[id + '/deadline'] = { date: str(d.date), time: tm, text: '직접 입력' };
      }
      u[id + '/fixed/deadline'] = 1;
    }
    if (has(edit, 'memo')) {
      var memo = str(edit.memo).replace(/\r/g, '');
      if (memo.length > MEMO_MAX) return fail('메모는 ' + MEMO_MAX + '자까지 적을 수 있습니다');
      u[id + '/memo'] = memo || null;
    }
    if (!Object.keys(u).length) return fail('바뀐 것이 없습니다');
    u[id + '/updatedAt'] = n;
    return { ok: true, update: u };
  }

  /* ── 폴더 고르기 ── */
  function boxesOf(folders) {
    if (!obj(folders)) return [];
    return Object.keys(folders).filter(function (slug) {
      var f = folders[slug];
      return okSlug(slug) && obj(f) && !f.nomsg && BOX_KINDS.indexOf(f.kind) >= 0;
    });
  }
  function numKeys(box) {
    if (!box || typeof box !== 'object') return [];
    return Object.keys(box).filter(function (k) { return /^[0-9]{1,12}$/.test(k) && obj(box[k]); })
      .sort(function (a, b) { return Number(a) - Number(b); });
  }

  /* ── 훑기 — 메일함 거울(mailbox/msgs)에서 «새로 온» 줄만 보고 요청을 알아본다 ──
     env = { db, uid, now?, readBody?(slug, uid) → 본문(text/html) , windowDays?, perFull?, perPoll?, bodyMax? }
     ⚠ 폴더마다 «어디까지 봤는지»(cur)를 클라우드에 적는다 — 다음 훑기는 새로 온 몇 통만 본다(거울 전체를 다시 내려받지 않는다).
     ⚠ 새 건은 transaction(없을 때만 쓴다)이라, 포털과 경력관리가 동시에 훑어도 겹치지 않고, 사람이 바꾼 상태를 되돌리지 않는다.
     ⚠ 폴더 하나를 못 읽어도 나머지는 계속 간다(errors 에 적는다). 못 읽은 폴더의 cur 는 올리지 않는다 — 다음에 다시 본다. */
  async function scan(env) {
    var db = env.db, uid = str(env.uid), now = env.now > 0 ? env.now : Date.now();
    var res = { folders: 0, scanned: 0, found: 0, created: [], enriched: [], bodyErr: 0, errors: [], bodyRead: 0 };
    if (!db || !uid) { res.errors.push('로그인 전'); return res; }
    var base = ROOT_PATH + '/' + uid + '/mailreq';
    var since = now - (env.windowDays > 0 ? env.windowDays : WINDOW_DAYS) * 864e5;
    var full = env.perFull > 0 ? env.perFull : PER_FULL, poll = env.perPoll > 0 ? env.perPoll : PER_POLL;
    var folders = (await db.ref('mailbox/folders').once('value')).val();
    var slugs = boxesOf(folders); res.folders = slugs.length;
    var cur = (await db.ref(base + '/cur').once('value')).val() || {};
    var hits = [], newCur = {};
    for (var i = 0; i < slugs.length; i++) {
      var slug = slugs[i], seen = has(cur, slug) ? Number(cur[slug]) || 0 : -1, limit = seen >= 0 ? poll : full, keys = [], box = null;
      try {
        for (var round = 0; round < 2; round++) {
          box = (await db.ref('mailbox/msgs/' + slug).orderByKey().limitToLast(limit).once('value')).val();
          keys = numKeys(box);
          /* 이어 훑는데 받은 줄이 «전부 새것»이면 더 있을 수 있다 — 한 번 크게 다시 */
          if (seen >= 0 && limit < full && keys.length >= limit && Number(keys[0]) > seen) { limit = full; continue; }
          break;
        }
      } catch (e) { res.errors.push(slug + ': ' + cut(e && e.message || e, 60)); continue; }
      var top = seen;
      keys.forEach(function (k) {
        var n = Number(k); if (n > top) top = n;
        if (seen >= 0 && n <= seen) return;
        var r = box[k]; res.scanned++;
        if (!(Number(r.d) >= since)) return;                          // 날짜를 모르거나 창보다 옛것은 알리지 않는다
        var h = detect(r); if (h) hits.push({ slug: slug, uid: k, row: r, hit: h });
      });
      newCur[slug] = top < 0 ? 0 : top;
    }
    for (var j = 0; j < hits.length; j++) {
      var x = hits[j], item = makeItem(x.slug, x.uid, x.row, x.hit, now); if (!item) continue;
      res.found++;
      try {
        var tr = await db.ref(base + '/items/' + item.id).transaction(function (c) { return c ? undefined : item; });
        if (tr && tr.committed) res.created.push(item);
      } catch (e) { res.errors.push(item.id + ': ' + cut(e && e.message || e, 60)); delete newCur[x.slug]; }
    }
    if (Object.keys(newCur).length) { try { await db.ref(base + '/cur').update(newCur); } catch (e) { res.errors.push('cur: ' + cut(e && e.message || e, 60)); } }
    if (typeof env.readBody === 'function') await enrich(env, db, base, now, since, res);
    return res;
  }
  /* 본문을 열어 기한·회신 주소를 채운다 — 아직 안 연 «진행 중» 건만, 한 번에 BODY_MAX 건씩.
     ⚠ 상태(st)는 건드리지 않는다. 못 열면 시도 횟수만 올려 BODY_TRY 번까지만 다시 한다. */
  async function enrich(env, db, base, now, since, res) {
    var all = toList((await db.ref(base + '/items').once('value')).val());
    var max = env.bodyMax > 0 ? env.bodyMax : BODY_MAX;
    var todo = all.filter(function (x) { return !x.bodyAt && (x.st === 'new' || x.st === 'doing') && Number(x.d) >= since && (Number(x.bodyTry) || 0) < BODY_TRY && okSlug(x.slug); })
      .sort(function (a, b) { return (Number(b.d) || 0) - (Number(a.d) || 0); }).slice(0, max);
    for (var i = 0; i < todo.length; i++) {
      var x = todo[i], p = base + '/items/' + x.id;
      try {
        var text = bodyOf(await env.readBody(x.slug, x.uid)), hit = detect({ s: x.s, an: x.an, f: x.f, e: x.e, a: (x.an || []).length, d: x.d }, { text: text, refMs: x.d });
        var patch = { bodyAt: now, bodyTry: null };
        if (hit) {
          /* ⚠ 사람이 팝업에서 직접 고친 칸(fixed)은 덮지 않는다 — 고쳐 둔 기한·종류가 다음 훑기에 되돌아오면 안 된다 */
          var fx = obj(x.fixed) ? x.fixed : {};
          if (!fx.deadline) patch.deadline = hit.deadline || x.deadline || null;      // 본문에서 못 찾아도 미리보기에서 찾은 기한은 지우지 않는다
          patch.replyTo = hit.replyTo || null;
          var order = KINDS.map(function (k) { return k.key; });
          if (!fx.kinds) patch.kinds = (x.kinds || []).concat(hit.kinds.filter(function (k) { return (x.kinds || []).indexOf(k) < 0; }))
            .sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
          patch.why = hit.why.map(function (w) { return cut(w, 48); });
        } else if (text) { patch.deadline = x.deadline || null; }
        await db.ref(p).update(patch);
        res.bodyRead++; res.enriched.push(x.id);
      } catch (e) {
        res.bodyErr++; res.errors.push(x.id + ': ' + cut(e && e.message || e, 60));
        try { await db.ref(p).update({ bodyTry: (Number(x.bodyTry) || 0) + 1 }); } catch (e2) { /* 시도 횟수를 못 적어도 다음에 다시 한다 */ }
      }
    }
  }
  /* 본문 열기 — 푸른메일함과 «같은» 서버 함수(readMailMessage, peek). 새로 만들지 않는다.
     call(함수이름, 본문) 은 화면이 준다(로그인 토큰을 붙여 POST) — 이 모듈은 통신을 모른다. */
  function makeReadBody(call) {
    return function (slug, uid) { return call('readMailMessage', { slug: slug, uid: uid, peek: 1 }); };
  }

  var api = {
    WINDOW_DAYS: WINDOW_DAYS, SOON_DAYS: SOON_DAYS, PER_FULL: PER_FULL, PER_POLL: PER_POLL, BODY_MAX: BODY_MAX, BODY_TRY: BODY_TRY,
    POLL_MS: POLL_MS, TEXT_MAX: TEXT_MAX, KINDS: KINDS, STATES: STATES, TABS: TABS, BOX_KINDS: BOX_KINDS, WORDS: WORDS, ACT: ACT, ADS: ADS,
    detect: detect, deadlineOf: deadlineOf, dueMs: dueMs, ddayOf: ddayOf, replyOf: replyOf, htmlText: htmlText, bodyOf: bodyOf,
    kindMeta: kindMeta, kindsLabel: kindsLabel, idOf: idOf, makeItem: makeItem,
    urgency: urgency, alarmItems: alarmItems, summary: summary, summaryText: summaryText, sortItems: sortItems, filterItems: filterItems, stateUpdate: stateUpdate,
    editUpdate: editUpdate, MEMO_MAX: MEMO_MAX,
    boxesOf: boxesOf, scan: scan, makeReadBody: makeReadBody, toList: toList
  };
  if (isNode) module.exports = api; else root.KcareerMailReq = api;
})(typeof window !== 'undefined' ? window : globalThis);
