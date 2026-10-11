/* ⚖ 산재 사례 찾기 — 판례 · 심사결정서 · 질병판정서 (대표 「진행」 → 목업 ㉮ 2026-10-11)
   ═══════════════════════════════════════════════════════════════════════════
   근로복지공단이 공공데이터포털에 공개한 원문 셋을 «그 자리에서» 찾아 읽는다(10/11 활용신청 승인).
     📜 판례        sjbPrecedentInfoService/getSjbPrecedentNaeyongPstate   (약 3.5만 건)
     📋 심사결정서  simsaPstateInfoService/getSimsaResultNaeyongPstate     (약 3천 건)
     🩺 질병판정서  jilbyeongPstateInfoService/getJilbyeongResultNaeyongPstate (약 6.2만 건)
   ★ 우리 쪽에 저장하지 않는다 — 읽고 보여 줄 뿐이다(공단이 이미 개인정보를 ○○로 가린 공개 자료).
   ★ 쓰는 곳: 푸른이알피 사건 상세의 「⚖ 비슷한 산재 사례」(산재 사건). 사건 제목으로 미리 찾아 연다.
   ⚠ 열쇠는 국세청과 같은 공공데이터포털 열쇠(dbGet('nts_api_key') → PU_CFG.ntsKey).
   ⚠ 화면은 Preact 바깥(document.body)에 붙인다 — Preact 가 그린 자리를 손으로 고치지 않는다.
   ⚠ 원문은 textContent 로만 넣는다(공단 글에 꺾쇠가 섞여 있어도 화면이 깨지지 않게). */
(function (root) {
  'use strict';
  var BASE = 'https://apis.data.go.kr/B490001/';
  var KINDS = {
    pan: { label: '📜 판례', path: 'sjbPrecedentInfoService/getSjbPrecedentNaeyongPstate', kw: 'cq', res: 'kindA' },
    sim: { label: '📋 심사결정서', path: 'simsaPstateInfoService/getSimsaResultNaeyongPstate', kw: 'cq', res: 'kinda' },
    jil: { label: '🩺 질병판정서', path: 'jilbyeongPstateInfoService/getJilbyeongResultNaeyongPstate', kw: 'cq', res: 'kinda' }
  };
  var PAGE = 20;

  /* 결과 낱말 → 인정/불인정 갈래 (순수 로직) */
  function verdict(w) {
    w = String(w || '');
    if (/불인정|기각|각하|패소/.test(w)) return 'no';
    if (/인정|취소|승소|인용/.test(w)) return 'ok';
    return '';
  }
  /* 공단 답 한 줄 → 화면 줄 (순수 로직) */
  function row(it, kind) {
    it = it || {};
    var txt = String(it.noncontent || '');
    var first = txt.replace(/\s+/g, ' ').replace(/^\s*주\s*문\s*/, '').trim().slice(0, 80);
    return { no: String(it.accnum == null ? '' : it.accnum), court: String(it.courtname || ''),
      res: String(it.kinda || it.kindA || ''), b: String(it.kindb || it.kindB || ''), c: String(it.kindc || it.kindC || ''),
      v: verdict(it.kinda || it.kindA), first: first, text: txt, kind: kind };
  }
  /* 요청 주소 — 열쇠·갈래·낱말·인정만/불인정만·쪽 (순수 로직) */
  function url(key, kind, q, res, page) {
    var k = KINDS[kind] || KINDS.jil;
    var u = BASE + k.path + '?serviceKey=' + encodeURIComponent(key) + '&_type=json&numOfRows=' + PAGE + '&pageNo=' + (page || 1);
    if (q) u += '&' + k.kw + '=' + encodeURIComponent(q);
    if (res) u += '&' + k.res + '=' + encodeURIComponent(res);
    return u;
  }
  /* 사건 → 처음 찾을 낱말 — 제목에서 회사·사람 이름처럼 보이는 앞머리를 덜어 낸다 (순수 로직) */
  function guessQuery(c) {
    var t = String((c && (c.title || c.judgment)) || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
    t = t.replace(/산재|산업재해|사건|신청|청구|건$/g, ' ').replace(/\s+/g, ' ').trim();
    return t.split(' ').filter(function (w) { return w.length >= 2; }).slice(0, 2).join(' ');
  }
  function key() {
    try { if (typeof dbGet === 'function') { var v = dbGet('nts_api_key', null); if (v) return String(v).trim(); } } catch (_) {}
    return String((root.PU_CFG && root.PU_CFG.ntsKey) || '').trim();
  }

  var st = null;     /* { kind, q, res, page, rows, total, open, busy, err, onAttach } */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (a) {
      if (a === 'style') e.style.cssText = attrs[a];
      else if (a.slice(0, 2) === 'on') e.addEventListener(a.slice(2), attrs[a]);
      else e.setAttribute(a, attrs[a]);
    });
    [].concat(kids || []).forEach(function (k) { if (k != null) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }
  function draw() {
    var box = document.getElementById('puSanjaeBox');
    if (!st) { if (box) box.remove(); return; }
    if (!box) { box = el('div', { id: 'puSanjaeBox' }); document.body.appendChild(box); }
    box.innerHTML = '';
    var btn = function (on, label, fn) {
      return el('button', { onclick: fn, style: 'height:30px;padding:0 12px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid ' +
        (on ? '#bfdbfe;background:#eff6ff;color:#1e40af;font-weight:700' : '#e2e8f0;background:#ffffff;color:#475569') }, label);
    };
    var input = el('input', { value: st.q, placeholder: '예: 뇌출혈 야간근무, 출퇴근 사고', style: 'flex:1;min-width:200px;height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:16px',
      onkeydown: function (e) { if (e.key === 'Enter') { st.q = input.value.trim(); find(1); } } });
    var head = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #e2e8f0;white-space:nowrap' }, [
      el('span', {}, '⚖'), el('b', { style: 'flex:1;font-size:15px' }, '산재 사례 찾기'),
      el('span', { style: 'cursor:pointer;color:#64748b;font-size:18px', title: '닫기', onclick: close }, '✕')]);
    var bar = el('div', { style: 'display:flex;gap:8px;padding:12px 16px 6px;align-items:center;flex-wrap:wrap' },
      Object.keys(KINDS).map(function (k) { return btn(st.kind === k, KINDS[k].label, function () { st.kind = k; find(1); }); })
        .concat([input, el('button', { style: 'height:34px;padding:0 14px;border-radius:8px;border:1px solid #2563eb;background:#2563eb;color:#ffffff;font-size:13px;cursor:pointer',
          onclick: function () { st.q = input.value.trim(); find(1); } }, '찾기')]));
    var flt = el('div', { style: 'display:flex;gap:6px;padding:0 16px 10px;align-items:center;font-size:12.5px;color:#64748b;white-space:nowrap' }, [
      '결과 ', btn(!st.res, '전체', function () { st.res = ''; find(1); }),
      btn(st.res === 'ok', '인정만', function () { st.res = 'ok'; find(1); }),
      btn(st.res === 'no', '불인정·기각만', function () { st.res = 'no'; find(1); }),
      el('span', { style: 'margin-left:6px' }, st.busy ? '찾는 중…' : st.err ? '⚠ ' + st.err : (st.total != null ? st.total.toLocaleString() + '건' : ''))]);
    var list = el('div', { style: 'max-height:42vh;overflow:auto;border-top:1px solid #e2e8f0' });
    (st.rows || []).forEach(function (r, i) {
      var on = st.open === i;
      list.appendChild(el('div', { style: 'display:flex;gap:10px;padding:8px 16px;border-bottom:1px solid #f8fafc;cursor:pointer;white-space:nowrap;font-size:13px;' + (on ? 'background:#eff6ff' : ''),
        onclick: function () { st.open = on ? null : i; draw(); } }, [
        el('span', { style: 'width:150px;flex:none;overflow:hidden;text-overflow:ellipsis;color:#475569', title: r.no }, (r.court ? r.court + ' ' : '') + r.no),
        el('b', { style: 'width:60px;flex:none;color:' + (r.v === 'ok' ? '#166534' : r.v === 'no' ? '#dc2626' : '#475569') }, r.res || '—'),
        el('span', { style: 'width:170px;flex:none;overflow:hidden;text-overflow:ellipsis', title: r.b }, r.b),
        el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#475569', title: r.c }, (r.c ? r.c + ' — ' : '') + r.first)]));
    });
    if (st.rows && !st.rows.length && !st.busy) list.appendChild(el('div', { style: 'padding:16px;color:#64748b;font-size:13px' }, '찾은 사례가 없습니다 — 낱말을 줄이거나 다른 갈래에서 찾아보세요.'));
    var full = null;
    if (st.open != null && st.rows[st.open]) {
      var r = st.rows[st.open];
      var acts = [el('button', { style: 'margin-right:6px;cursor:pointer', onclick: function () {
        var t = cite(r) + '\n\n' + r.text;
        try { navigator.clipboard.writeText(t); toastSoft('📋 복사했습니다'); } catch (_) { toastSoft('복사하지 못했습니다'); }
      } }, '📋 복사')];
      if (st.onAttach) acts.push(el('button', { style: 'cursor:pointer', onclick: function () { st.onAttach(cite(r)); toastSoft('🔗 사건 메모에 붙였습니다'); } }, '🔗 사건 메모에 붙이기'));
      var pre = el('div', { style: 'white-space:pre-wrap;font-size:13px;line-height:1.7;margin-top:6px' });
      pre.textContent = r.text;
      full = el('div', { style: 'border-top:1px solid #e2e8f0;padding:12px 16px;max-height:34vh;overflow:auto;background:#f8fafc' },
        [el('b', { style: 'display:block' }, cite(r)), el('div', { style: 'margin-top:6px' }, acts), pre]);
    }
    var foot = el('div', { style: 'display:flex;gap:8px;align-items:center;padding:8px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b' }, [
      el('span', { style: 'flex:1' }, '근로복지공단 공개 자료(공공데이터포털)를 그 자리에서 읽습니다 — 저장하지 않습니다.'),
      st.page > 1 ? btn(false, '‹ 앞', function () { find(st.page - 1); }) : null,
      (st.total || 0) > st.page * PAGE ? btn(false, '다음 ›', function () { find(st.page + 1); }) : null]);
    box.appendChild(el('div', { style: 'position:fixed;inset:0;background:rgba(20,22,28,.34);z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px',
      onclick: function (e) { if (e.target === e.currentTarget) close(); } },
      [el('div', { style: 'background:#ffffff;color:#1e293b;border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.22);width:min(900px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden' },
        [head, bar, flt, list, full, foot])]));
    if (!st.rows && !st.busy) find(1);
  }
  function cite(r) {
    var k = KINDS[r.kind] || {};
    return '[' + String(k.label || '').replace(/^\S+\s/, '') + '] ' + (r.court ? r.court + ' ' : '') + r.no + ' · ' + (r.res || '') + (r.b ? ' · ' + r.b : '') + (r.c ? ' · ' + r.c : '') + ' (근로복지공단 공개 자료)';
  }
  function toastSoft(m) { try { if (typeof root.toast === 'function') return root.toast(m); } catch (_) {} try { console.info(m); } catch (_) {} }
  function find(page) {
    var kk = key();
    if (!kk) { st.err = '공공데이터 열쇠가 없습니다 — 포털 환경설정의 「국세청 사업자번호 조회 키」'; st.rows = []; draw(); return; }
    st.page = page || 1; st.busy = true; st.err = ''; st.open = null; draw();
    var resWord = st.res === 'ok' ? (st.kind === 'pan' ? '' : '인정') : st.res === 'no' ? (st.kind === 'jil' ? '불인정' : '기각') : '';
    var my = st;
    fetch(url(kk, st.kind, st.q, resWord, st.page)).then(function (r) {
      if (!r.ok) throw new Error('공단 답 ' + r.status);
      return r.json();
    }).then(function (j) {
      if (st !== my) return;
      var b = j && j.response && j.response.body;
      var items = b && b.items && b.items.item;
      var rows = [].concat(items || []).map(function (it) { return row(it, my.kind); });
      if (my.res) rows = rows.filter(function (x) { return x.v === my.res; });
      my.rows = rows; my.total = Number(b && b.totalCount) || 0; my.busy = false; draw();
    }).catch(function (e) { if (st !== my) return; my.busy = false; my.rows = []; my.err = (e && e.message) || '못 읽었습니다'; draw(); });
  }
  function open(opts) {
    opts = opts || {};
    st = { kind: KINDS[opts.kind] ? opts.kind : 'jil', q: String(opts.q || ''), res: '', page: 1, rows: null, total: null, open: null,
      busy: false, err: '', onAttach: typeof opts.onAttach === 'function' ? opts.onAttach : null };
    draw();
  }
  function close() { st = null; draw(); }
  function onKey(e) { if (st && e.key === 'Escape') close(); }
  if (root.document) root.document.addEventListener('keydown', onKey);

  root.PuSanjae = { open: open, close: close, verdict: verdict, row: row, url: url, guessQuery: guessQuery, KINDS: KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
