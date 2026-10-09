/* ══ ✍ 계약서 서명 요청 — 직원 화면·서명 화면이 함께 쓰는 순수 함수 (대표 「1단계부터 진행해라」 2026-10-09) ══
   자리: pu_sign/req/{요청}  — 직원만 읽는다(받는 사람·휴대폰·미리 채운 값·상태)
         pu_sign/open/{열쇠} — 열쇠(128비트, 링크에만 있다)를 아는 사람만 읽는다(문서 그림·적을 칸·제출)
   규칙: scripts/make-firebase-rules.js rules.pu_sign — 제출은 한 번·기한 안·끝 4자리가 맞을 때만.
   ⚠ 주민번호·생년월일 칸은 서명자에게 묻지 않는다(1단계). ⚠ 받는 주소·전화는 open 에 넣지 않는다. */
(function (root) {
  'use strict';

  /* 서명자가 적지 않는 표지 — 주민번호·생년월일(1단계에서 받지 않음), 법인 쪽 번호, 서명 자리 */
  var NOT_ASK = /주민|생년|외국인등록|계약번호|서명|법인등록|사업자번호/;
  var DAY = 864e5;

  function newToken(rand) {
    var u = new Uint8Array(16);
    (rand || (root.crypto && root.crypto.getRandomValues.bind(root.crypto)))(u);
    return Array.prototype.map.call(u, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function p4Of(phone) { var d = digits(phone); return d.length >= 4 ? d.slice(-4) : ''; }
  /* 「김가나 010-1234-5678」 한 줄에 한 사람. 쉼표·탭도 받는다. 휴대폰이 없으면 그 줄은 틀린 줄 */
  function parseRecipients(text) {
    var ok = [], bad = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var t = line.trim(); if (!t) return;
      var m = /(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4})/.exec(t);
      var name = t.replace(m ? m[1] : '', '').replace(/[,\t;]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!m || !name) { bad.push(t); return; }
      var d = digits(m[1]);
      ok.push({ name: name.slice(0, 30), phone: d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4) });
    });
    return { ok: ok, bad: bad };
  }
  /* 서명자가 적을 칸 — 문서의 표지 중 값이 비어 있고 묻지 않는 칸이 아닌 것(나온 차례, 겹침 없이) */
  function signerFields(markers, V) {
    var seen = {}, out = [];
    (markers || []).forEach(function (k) {
      if (!k || seen[k]) return; seen[k] = 1;
      if (NOT_ASK.test(k)) return;
      if (V && V[k] != null && String(V[k]).trim() !== '') return;
      out.push({ k: k, label: k });
    });
    return out.slice(0, 20);
  }
  /* 양식 갈래 → 계약 기록 종류(기업별 계약서 KINDS) */
  var KIND_OF_FORM = { company: '자문', 'case': '사건', consulting: '컨설팅', fund: '기금', consult: '제안서', other: '기타' };
  function recKindOf(forms) {
    var k = (forms || []).map(function (f) { return f && f.kind; }).filter(Boolean)[0] || 'other';
    return KIND_OF_FORM[k] || '기타';
  }
  /* 상태 — req(직원 칸) + open 의 seen/sub 시각. 반환 'void'|'saved'|'submitted'|'expired'|'seen'|'sent' */
  function statusOf(req, o, now) {
    req = req || {}; o = o || {}; now = now || Date.now();
    if (req.status === 'void' || o.void) return 'void';
    if (req.status === 'saved') return 'saved';
    if (o.subAt) return 'submitted';
    if (req.exp && req.exp < now) return 'expired';
    if (o.seen) return 'seen';
    return 'sent';
  }
  var STATUS_TXT = { sent: '안 열어 봄', seen: '열어 봄 · 작성 중', submitted: '제출됨 · 저장 기다림', saved: '🔒 서명본 저장됨', expired: '기한 지남', 'void': '취소함' };
  function linkOf(base, t) { return String(base || '').replace(/[^/]*$/, '') + 'sign-contract.html?t=' + t; }
  function expAt(now, days) { return (now || Date.now()) + Math.max(1, Math.min(60, Number(days) || 7)) * DAY; }
  /* 받는 사람에게 보낼 글 — 받는 주소·전화는 넣지 않는다 */
  function shareText(o) {
    o = o || {};
    return (o.name ? o.name + '님, ' : '') + '푸른노무법인입니다.\n「' + (o.title || '계약서') + '」 ' + (o.mode === 'agree' ? '확인·동의' : '서명')
      + ' 부탁드립니다.\n아래 링크에서 내용을 확인하시고 ' + (o.mode === 'agree' ? '동의' : '서명') + '해 주세요(휴대폰 끝 4자리로 본인 확인).\n'
      + (o.link || '') + (o.exp ? '\n기한: ' + ymd(o.exp) + '까지' : '');
  }
  function ymd(ts) { var d = new Date(ts); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  /* 서명 확인서 줄 — 마지막 쪽에 붙는다(누가·언제·무엇에·어떤 문서 지문) */
  function certLines(req, sub, docHash) {
    req = req || {}; sub = sub || {};
    var who = req.who || {};
    var lines = [
      ['문서', req.title || ''],
      ['서명자', (who.name || '') + (who.phone ? ' · 휴대폰 끝 ' + p4Of(who.phone) : '')],
      ['방식', req.mode === 'agree' ? '내용 확인 후 동의' : '내용 확인 후 손서명'],
      ['요청', ymdhm(req.at) + ' · ' + (req.byName || '')],
      ['제출', ymdhm(sub.at)],
      ['본인 확인', '링크(사람마다 하나) + 휴대폰 끝 4자리'],
      ['문서 지문', String(docHash || '').slice(0, 32) + '…'],
      ['기기', String(sub.ua || '').slice(0, 80)]
    ];
    Object.keys(sub.vals || {}).forEach(function (k) { lines.push(['적은 칸 · ' + k, String(sub.vals[k] || '(비움)')]); });
    return lines;
  }
  function ymdhm(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return ymd(ts) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function sha256Hex(str) {
    var c = root.crypto && root.crypto.subtle;
    if (!c) return Promise.reject(new Error('이 브라우저는 문서 지문(SHA-256)을 만들지 못합니다'));
    return Promise.resolve(c.digest('SHA-256', new TextEncoder().encode(String(str)))).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  var api = { newToken: newToken, p4Of: p4Of, parseRecipients: parseRecipients, signerFields: signerFields, recKindOf: recKindOf,
    statusOf: statusOf, STATUS_TXT: STATUS_TXT, linkOf: linkOf, expAt: expAt, shareText: shareText, certLines: certLines,
    sha256Hex: sha256Hex, ymd: ymd, ymdhm: ymdhm, NOT_ASK: NOT_ASK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PuSign = api;
})(typeof window !== 'undefined' ? window : this);
