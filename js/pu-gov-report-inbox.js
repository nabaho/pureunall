'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 받은 서류함: 메일 첨부 후보 · 서류 줄 연결 열쇠 · 첨부 받기 순서
   (브라우저 window.PuGovReportInbox / Node 겸용 · 대표 지시 2026-10-11 「남은 일 순서대로 진행」
    · 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md · 계획 docs/superpowers/plans/2026-10-11-gov-report-inbox.md)
   무엇을 지키나
     · 읽기만 — 메일함 거울(mailbox/msgs/{폴더}/{uid}, functions/mail-box.js msgRow 의 짧은 칸 f·e·t·tn·s·d·a·an)의 머리글만 본다.
       본문·첨부 바이트는 후보 단계에서 읽지 않는다. 지난 메일 거울(mailbox/old/msgs)은 첨부 정보(a·an)가 없어 후보가 될 수 없다.
     · 업체 귀속은 «주소»로만 — PuCoThread.addrsOf(업체관리 email·primaryContactEmail·contacts[].email)와 이알피 계약 연락처.
       한 주소가 여러 업체에 적혀 있으면 업체관리에 먼저 적힌 쪽 것(functions/mail-owner.js 와 같은 규칙). 우리 주소(@pureun.kr)는 안 본다.
     · 개인 자료(PuGovReportBuild.PRIV_RE — 복제하지 않고 가져다 쓴다)는 목록에만: 딱지를 달고 연결·열어 보기를 막는다(화면 몫).
     · 연결 열쇠: 일반 폴더 'i:<폴더 slug>:<uid>' · 지난 메일 'o:<popKey>' — 80자 이내(규칙·기록 모듈 LINK_KEY_MAX 와 같다).
       거울에 조각 번호가 없어 첨부는 «이름»으로 집는다(fetchAtt: 목록 peek → 같은 이름의 i·part 로 받기).
     · 첨부 받기는 «부르는 함수(call)»를 받아서만 한다 — 화면이 js/rules-v2/mail-orig.js 의 makeCall 로 만든다.
       받은 것(b64)은 돌려주기만 하고 어디에도 담지 않는다. 20MB(서버 ATT_MAX) 넘으면 받지 않는다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Build = isNode ? require('./pu-gov-report-build.js') : root.PuGovReportBuild;
  if (isNode && !root.PuCoThread) require('./pu-co-thread.js');
  function CT() { return root.PuCoThread; }

  var MAX = 50, KEY_MAX = 80, ATT_MAX = 20 * 1024 * 1024, BEFORE = 30, AFTER = 90, SHEET_ROWS = 200;
  /* 받은·보낸·보관·손으로 만든 폴더만 — 임시·예약·내게쓴·스팸·휴지통은 서류가 오간 자리가 아니다 */
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom'];
  var PRIV_RE = Build.PRIV_RE;
  var OWN_RE = /@pureun\.kr$/i;
  var IMG = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  var MSG = {
    NAME_NOTE: '첨부 파일 이름에 사람 이름이 들어 있을 수 있습니다 — 연결하면 그 이름이 기록에 남습니다',
    NO_ADDR: '메일 주소가 등록돼 있지 않아 후보를 못 찾았습니다 — 업체관리에서 주소를 넣어 주세요',
    NONE: '이 기간에 이 업체 주소로 오간 첨부 메일이 없습니다',
    LOAD_FAIL: '메일함을 불러오지 못했습니다',
    MORE: '50건만 보입니다',
    CLIPPED: '메일함 폴더마다 최근 메일만 봅니다 — 오래된 메일은 메일함에서 찾아 주세요',
    PRIV: '개인 자료 · 목록에만',
    TECH: '기술보호 자료',
    WAIT: '불러오는 중…',
    WAIT_OLD: '불러오는 중… (지난 메일은 1분쯤 걸립니다)',
    CANT: '이 형식은 앱에서 열 수 없습니다 — 메일함에서 받아 주세요',
    NO_REPLY: '메일 서버 응답이 없습니다 — 잠시 뒤 다시',
    LOGIN: '로그인을 확인해 주세요',
    GONE: '메일에서 그 첨부를 찾지 못했습니다(지워졌을 수 있습니다)',
    TOO_BIG: '20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요',
    FAIL: '열지 못했습니다 — '
  };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  /* 이알피 표({u,v:[…]})·배열·객체 모두 줄 목록으로 (functions/mail-owner.js arr 와 같은 꼴) */
  function rowsOf(v) {
    var x = obj(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(obj);
    if (obj(x)) return Object.keys(x).map(function (k) { return x[k]; }).filter(obj);
    return [];
  }
  function dayOf(ms) { var n = Number(ms); return (isFinite(n) && n > 0) ? new Date(n + 9 * 3600e3).toISOString().slice(0, 10) : ''; }
  function shift(day, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(day));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10) : '';
  }
  function windowOf(first, last) {
    var a = shift(first, -BEFORE), b = shift(str(last) || first, AFTER);
    return (a && b) ? { from: a, to: b } : null;
  }

  /* ── 업체 주소 ── 주소 → 업체관리에 «먼저» 적은 업체의 자리 */
  function ownerIndex(list) {
    var ix = {};
    list.forEach(function (c, i) { Object.keys(CT().addrsOf(c)).forEach(function (e) { if (!has(ix, e)) ix[e] = i; }); });
    return ix;
  }
  function coIndexFor(list, bizNo, name) {
    var b = digits(bizNo), n = CT().norm(name), i;
    if (b.length >= 10) for (i = 0; i < list.length; i++) if (digits(list[i].bizNo) === b) return i;
    if (n) for (i = 0; i < list.length; i++) if (CT().norm(list[i].name) === n) return i;
    return -1;
  }
  function addrsFor(o) {
    o = o || {};
    var list = rowsOf(o.companies), cons = obj(o.cons) ? o.cons : null;
    var cc = (cons && obj(cons.company)) ? cons.company : {};
    var at = coIndexFor(list, str(cc.bizNo) || str(cons && cons.bizNo) || str(o.bizNo),
      str(cc.name) || str(cons && cons.companyName) || str(o.name));
    var owner = ownerIndex(list), out = {};
    function add(src) {
      Object.keys(CT().addrsOf(src)).forEach(function (e) {
        if (OWN_RE.test(e)) return;                       // 우리 주소
        if (has(owner, e) && owner[e] !== at) return;      // 업체관리에 다른 업체가 먼저 적은 주소
        out[e] = 1;
      });
    }
    if (at >= 0) add(list[at]);
    if (cons) { add(cons); add(cc); }
    return out;
  }

  /* ── 거울 → 평평한 줄 ── */
  function boxesOf(folders) {
    if (!obj(folders)) return [];
    return Object.keys(folders).filter(function (slug) {
      var f = folders[slug];
      return okId(slug) && obj(f) && !f.nomsg && BOX_KINDS.indexOf(f.kind) >= 0;
    });
  }
  function mailRows(folders, msgs) {
    var out = [];
    if (!obj(msgs)) return out;
    boxesOf(folders).forEach(function (slug) {
      var box = has(msgs, slug) ? msgs[slug] : null, sent = folders[slug].kind === 'sent';
      if (!obj(box)) return;
      Object.keys(box).forEach(function (k) {
        var r = box[k];
        if (!obj(r) || !/^[0-9]{1,12}$/.test(k)) return;
        out.push({ slug: slug, uid: k, out: sent, from: CT().mailOf(r.e),
          to: str(r.t).split(',').map(function (x) { return CT().mailOf(x); }).filter(Boolean),
          who: sent ? (str(r.tn) || str(r.t)) : (str(r.f) || str(r.e)), s: str(r.s), d: Number(r.d) || 0, day: dayOf(r.d),
          a: Number(r.a) || 0, an: Array.isArray(r.an) ? r.an.map(str).filter(Boolean).slice(0, 5) : [] });
      });
    });
    return out;
  }

  function kindOf(name) {
    var m = /\.([a-z0-9]+)$/.exec(str(name).toLowerCase()), e = m ? m[1] : '';
    if (e === 'hwp' || e === 'hwpx') return 'hwp';
    if (e === 'pdf') return 'pdf';
    if (has(IMG, e)) return 'img';
    if (e === 'xlsx' || e === 'xls') return 'xls';
    return '';
  }
  function imgType(name) { var m = /\.([a-z0-9]+)$/.exec(str(name).toLowerCase()); return (m && has(IMG, m[1])) ? IMG[m[1]] : ''; }
  function privOf(m) { return PRIV_RE.test(m.s) || m.an.some(function (n) { return PRIV_RE.test(n); }); }

  /* ── 연결 열쇠 ── */
  var POP_RE = /^[A-Za-z0-9_+=@:~-]{1,120}$/;   // 서버 readOldMail 이 받는 열쇠 꼴
  function okSlug(s) { return okId(s) && !/[\/.#$\[\]]/.test(s); }
  var linkKey = {
    make: function (p) {
      p = p || {};
      var k = '';
      if (p.pop != null) { if (POP_RE.test(str(p.pop))) k = 'o:' + str(p.pop); }
      else if (okSlug(str(p.slug)) && /^[0-9]{1,12}$/.test(str(p.uid))) k = 'i:' + str(p.slug) + ':' + str(p.uid);
      return k.length <= KEY_MAX ? k : '';
    },
    parse: function (k) {
      if (typeof k !== 'string' || !k || k.length > KEY_MAX) return null;
      var m = /^i:(.+):([0-9]{1,12})$/.exec(k);
      if (m) return okSlug(m[1]) ? { kind: 'imap', slug: m[1], uid: m[2] } : null;
      m = /^o:(.+)$/.exec(k);
      return (m && POP_RE.test(m[1])) ? { kind: 'pop', key: m[1] } : null;
    }
  };

  function candidates(rows, o) {
    o = o || {};
    var addrs = obj(o.addrs) ? o.addrs : {}, win = o.win, out = [];
    if (!Object.keys(addrs).length) return { list: [], total: 0, more: false, noAddr: true };
    (rows || []).forEach(function (m) {
      if (!m || !(m.a > 0) || !m.day) return;
      if (win && (m.day < win.from || m.day > win.to)) return;
      var hit = m.out ? m.to.some(function (e) { return has(addrs, e); }) : has(addrs, m.from);
      if (!hit) return;
      out.push({ slug: m.slug, uid: m.uid, out: m.out, who: m.who, s: m.s, d: m.d, day: m.day, a: m.a,
        key: linkKey.make({ slug: m.slug, uid: m.uid }), priv: privOf(m), tech: !!o.tech,
        atts: m.an.map(function (n) { return { name: n, kind: kindOf(n) }; }) });
    });
    out.sort(function (a, b) { return (b.d - a.d) || (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)); });
    return { list: out.slice(0, MAX), total: out.length, more: out.length > MAX, noAddr: false };
  }
  /* 화면 딱지(.st-*) — 개인 자료 빨강 · 기술보호 노랑 */
  function badges(c) {
    var b = [];
    if (c && c.priv) b.push({ txt: MSG.PRIV, key: 'todo' });
    if (c && c.tech) b.push({ txt: MSG.TECH, key: 'draft' });
    return b;
  }
  function linkFrom(c, name) {
    var nm = str(name);
    if (!c || !c.key || !nm) return null;
    var o = { src: 'mail', key: c.key, name: nm.slice(0, 100) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(str(c.day))) o.date = c.day;
    return o;
  }

  /* ── 열기 ── */
  function fail(status, msg) { var e = new Error(msg || ''); e.status = status; return e; }
  function errText(e) {
    var st = Number(e && e.status) || 0, nm = str(e && e.name), msg = str(e && e.message);
    if (nm === 'TimeoutError' || st === 408 || st === 503 || st === 504 || /Failed to fetch|NetworkError|network/i.test(msg)) return MSG.NO_REPLY;
    if (st === 401 || st === 403) return MSG.LOGIN;
    if (st === 404) return MSG.GONE;
    if (st === 413) return MSG.TOO_BIG;
    return MSG.FAIL + (msg || '알 수 없는 오류');
  }
  /* 첨부 하나 — 목록(peek: 읽음 표시를 건드리지 않는다)에서 같은 이름을 찾아 그 번호·조각 이름으로 받는다.
     ⚠ readMailMessage 는 본문도 함께 돌려준다 — 여기서 버린다(돌려주지 않는다). */
  async function fetchAtt(o) {
    o = o || {};
    var ref = o.ref, call = o.call, name = str(o.name);
    if (!ref || !name || typeof call !== 'function') throw fail(404, '그 첨부가 없습니다');
    var imap = ref.kind === 'imap';
    var head = imap ? await call('readMailMessage', { slug: ref.slug, uid: ref.uid, peek: true })
                    : await call('readOldMail', { key: ref.key });
    var atts = (head && Array.isArray(head.atts)) ? head.atts : [], a = null, idx = -1;
    for (var i = 0; i < atts.length; i++) {
      if (atts[i] && atts[i].name === name) { a = atts[i]; idx = a.i == null ? i : a.i; break; }
    }
    if (!a) throw fail(404, '그 첨부가 없습니다');
    if (Number(a.size || 0) > ATT_MAX) throw fail(413, '너무 큽니다');
    var got = imap ? await call('readMailAttachment', { slug: ref.slug, uid: ref.uid, index: idx, part: String(a.part || '') })
                   : await call('readOldMail', { key: ref.key, index: idx });
    if (!got || !got.b64) throw fail(404, '그 첨부가 없습니다');
    return { name: name, b64: got.b64 };
  }

  var api = { windowOf: windowOf, addrsFor: addrsFor, boxesOf: boxesOf, mailRows: mailRows, candidates: candidates, badges: badges,
    kindOf: kindOf, imgType: imgType, linkKey: linkKey, linkFrom: linkFrom, errText: errText, fetchAtt: fetchAtt,
    MAX: MAX, KEY_MAX: KEY_MAX, ATT_MAX: ATT_MAX, BEFORE: BEFORE, AFTER: AFTER, SHEET_ROWS: SHEET_ROWS,
    BOX_KINDS: BOX_KINDS, PRIV_RE: PRIV_RE, MSG: MSG };
  if (isNode) module.exports = api;
  else root.PuGovReportInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
