/* 방문 사업장 사전 안내 문자 — 컨설팅일정 화면의 «오늘 승인 띠» (2026-10-15)
   ═══════════════════════════════════════════════════════════════════════════
   서버(functions/visit-sms.js)가 매일 09:00 에 만들어 둔 오늘 목록
   (scal_env/visitSms/queue/{오늘})을 읽어 보여 주고, 사람이 «보내기»를 누르면
   서버 함수(visitSmsSend)를 부른다.

   ⚠ 이 화면은 «번호도 문구도 보내지 않는다» — 열쇠(queue 의 키)만 보낸다.
     진짜 번호와 문구는 서버가 그 자리에서 다시 만든다(문자 중계기가 되지 않게).
   ⚠ 화면에 보이는 번호는 가려진 것(010-****-1234)뿐이다 — 진짜 번호는 DB 에도 없다.
   ⚠ 원본(일정·사업장·업체)은 읽지도 고치지도 않는다. 이 띠는 queue 만 본다.
   ⚠ 색은 이 화면의 변수(var(--…))만 쓴다 — 새 색을 만들지 않는다. */
(function (root) {
  'use strict';

  var FN_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/visitSmsSend';
  var ROOT = 'scal_env/visitSms';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* queue(객체) → 줄 배열. 이 사람이 볼 수 있는 줄만(관리자는 전부, 아니면 자기 일정). */
  function rowsFor(queue, me) {
    var q = queue || {};
    var out = Object.keys(q).sort().map(function (k) { var r = q[k] || {}; r.key = k; return r; });
    if (me && me.isAdmin) return out;
    return out.filter(function (r) { return me && me.id && String(r.attId) === String(me.id); });
  }

  function countBy(rows) {
    var c = { ready: 0, approved: 0, sent: 0, failed: 0, skip: 0, sending: 0 };
    rows.forEach(function (r) { if (c[r.status] != null) c[r.status]++; });
    return c;
  }

  /* 눌러서 보낼 수 있는 것: 아직 안 보낸(ready) 것과 실패한(failed) 것 */
  function sendable(rows) { return rows.filter(function (r) { return r.status === 'ready' || r.status === 'failed'; }); }

  function statusLabel(r) {
    if (r.status === 'sent') return '✓ 발송됨';
    if (r.status === 'approved') return '⏳ 폰 대기';
    if (r.status === 'sending') return '… 폰이 보내는 중';
    if (r.status === 'failed') return '✕ 실패';
    if (r.status === 'skip') return '⚠ 확인 필요';
    return '대기';
  }

  /* 한 줄(= 표의 한 칸은 한 줄 — 넘치면 … 처리, 전문은 title) */
  function rowHtml(r, checked) {
    var can = r.status === 'ready' || r.status === 'failed';
    var who = [r.contactName, r.phoneMasked].filter(Boolean).join(' ');
    var note = r.status === 'skip' ? (r.why || '') : (r.status === 'failed' ? (r.error || '') : '');
    /* 연락처가 없는 줄(번호 확인 필요·실패)은 그 자리에 «이유»를 보인다 — 좁은 화면에서도 보이게 */
    var third = (r.status === 'skip' || r.status === 'failed') && note ? note : who;
    var full = [r.coName, who, statusLabel(r), note].filter(Boolean).join(' · ');
    return '<label class="vsms-row" title="' + esc(full) + '">'
      + '<input type="checkbox" class="vsms-ck" data-key="' + esc(r.key) + '"' + (can ? '' : ' disabled') + (can && checked ? ' checked' : '') + '>'
      + '<span class="vsms-st vsms-' + esc(r.status) + '">' + esc(statusLabel(r)) + '</span>'
      + '<span class="vsms-co">' + esc(r.coName) + '</span>'
      + '<span class="vsms-who">' + esc(third) + '</span>'
      + '</label>';
  }

  var CSS = '#visitSmsBar{margin:0 0 10px}'
    + '.vsms{border:1px solid var(--border);background:var(--surface);border-radius:10px;padding:10px 12px}'
    + '.vsms-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;font-size:13px;color:var(--text)}'
    + '.vsms-h .vsms-sub{font-weight:500;font-size:12px;opacity:.75}'
    + '.vsms-list{margin-top:8px;display:flex;flex-direction:column;gap:2px}'
    + '.vsms-row{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;padding:3px 0;cursor:pointer}'
    + '.vsms-st{flex:0 0 84px;white-space:nowrap;font-size:12px}'
    + '.vsms-co{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}'
    + '.vsms-who{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8}'
    + '.vsms-sent{color:var(--ok)}.vsms-failed{color:var(--danger)}.vsms-skip{opacity:.7}'
    + '.vsms-act{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
    + '.vsms .btn[disabled]{opacity:.45;cursor:default}'
    + '.vsms-msg{font-size:12px;opacity:.8}'
    + '.vsms-prev{margin-top:6px;font-size:12px;opacity:.8;word-break:keep-all}';

  var S = { cfg: null, queue: null, busy: false, msg: '', opts: null, off: [], unchecked: {} };

  function paint() {
    var host = root.document && root.document.getElementById('visitSmsBar');
    if (!host || !S.opts) return;
    /* 다시 그려도 사람이 «뺀» 체크는 그대로 둔다(자료가 바뀔 때마다 다시 그려진다) */
    [].slice.call(host.querySelectorAll('.vsms-ck')).forEach(function (el) { S.unchecked[el.getAttribute('data-key')] = !el.checked; });
    var mode = (S.cfg && S.cfg.mode) || 'approve';
    var rows = (mode === 'off') ? [] : rowsFor(S.queue, S.opts.me());
    if (!rows.length) { host.innerHTML = ''; return; }
    var c = countBy(rows);
    var can = sendable(rows);
    var auto = mode === 'auto';
    var head = '📨 오늘 방문 사업장 안내 문자 <span class="vsms-sub">보낼 곳 ' + (c.ready + c.failed) + (c.approved + c.sending ? ' · 폰 대기 ' + (c.approved + c.sending) : '') + ' · 발송됨 ' + c.sent
      + (c.skip ? ' · 번호 확인 필요 ' + c.skip : '') + (auto ? ' · 자동 발송 중' : '') + '</span>';
    var prev = rows[0] && rows[0].text ? '<div class="vsms-prev">문구: ' + esc(rows[0].text) + '</div>' : '';
    var act = auto ? '' : '<div class="vsms-act"><button type="button" class="btn btn-p" id="vsmsSend"' + ((S.busy || !can.length) ? ' disabled' : '') + '>선택한 곳에 보내기</button>'
      + '<span class="vsms-msg" id="vsmsMsg">' + esc(S.msg || (can.length ? '보내기 전에 번호와 문구를 확인하세요.' : '')) + '</span></div>';
    host.innerHTML = '<div class="vsms"><div class="vsms-h">' + head + '</div>' + prev
      + '<div class="vsms-list">' + rows.map(function (r) { return rowHtml(r, !S.unchecked[r.key]); }).join('') + '</div>' + act + '</div>';
    var btn = root.document.getElementById('vsmsSend');
    if (btn) btn.onclick = onSend;
  }

  async function onSend() {
    if (S.busy) return;
    var keys = [].slice.call(root.document.querySelectorAll('#visitSmsBar .vsms-ck:checked')).map(function (el) { return el.getAttribute('data-key'); });
    if (!keys.length) { S.msg = '보낼 곳을 고르세요.'; paint(); return; }
    if (!root.confirm(keys.length + '곳의 사업장 담당자에게 방문 안내 문자를 보냅니다. 보낼까요?')) return;
    S.busy = true; S.msg = '보내는 중…'; paint();
    try {
      var u = S.opts.auth().currentUser;
      var token = await u.getIdToken();
      var res = await fetch(FN_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: keys, date: todayKey() }),
      });
      var body = await res.json().catch(function () { return {}; });
      S.msg = body.ok ? ((body.queued ? ('폰에 맡겼습니다 ' + body.queued + '건 — 폰이 15분 안에 보냅니다') : ('발송 ' + body.sent + '건')) + (body.failed ? ' · 실패 ' + body.failed + '건' : '') + (body.skipped ? ' · 건너뜀 ' + body.skipped + '건' : ''))
        : ('보내지 못했습니다 — ' + (body.error || ('HTTP ' + res.status)));
    } catch (e) {
      S.msg = '보내지 못했습니다 — 연결을 확인하세요.';
    }
    S.busy = false; paint();
  }

  /* opts: { db: firebase.database(), auth: ()=>firebase.auth(), me: ()=>({id,isAdmin}) } */
  function init(opts) {
    S.opts = opts;
    try {
      if (root.document && !root.document.getElementById('vsmsCss')) {
        var st = root.document.createElement('style'); st.id = 'vsmsCss'; st.textContent = CSS; root.document.head.appendChild(st);
      }
      var cfgRef = opts.db.ref(ROOT + '/config');
      var qRef = opts.db.ref(ROOT + '/queue/' + todayKey());
      cfgRef.on('value', function (s) { S.cfg = s.val() || {}; paint(); }, function () {});
      qRef.on('value', function (s) { S.queue = s.val() || {}; paint(); }, function () {});
      S.off = [function () { cfgRef.off(); }, function () { qRef.off(); }];
    } catch (e) { /* 띠가 없어도 화면은 그대로 — 조용히 물러난다 */ }
  }

  var API = { init: init, paint: paint, rowsFor: rowsFor, countBy: countBy, sendable: sendable, statusLabel: statusLabel, rowHtml: rowHtml, todayKey: todayKey, FN_URL: FN_URL, ROOT: ROOT };
  root.PuVisitSms = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
