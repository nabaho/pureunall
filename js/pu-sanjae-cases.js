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
   ⚠ 원문은 textContent 로만 넣는다(공단 글에 꺾쇠가 섞여 있어도 화면이 깨지지 않게).

   ■ 찾는 말 (2026-11-11 · 대표 「추천대로 진행」)
     띄어쓰기 = 모두 든 것 · "따옴표" = 그 구절 · -낱말 = 그 말이 든 것은 뺌.
     공단 본문 검색(cq)에는 «한 낱말»만 보내고, 나머지는 받은 쪽 안에서 거른다 — 그때는 한 번에 더 받아(SCAN) 살핀다.
   ■ 판례에는 «본문 검색이 없다» — 공공데이터포털 명세(15041878)의 요청변수는 kindA·kindB·kindC 뿐이다(2026-11-11 확인).
     옛 코드는 판례에도 cq 를 보냈는데, 명세에 없는 변수라 무엇을 넣어도 같은 목록이 왔을 것이다.
     그래서 판례는 cq 를 안 보내고, 받은 쪽 안에서만 거른다고 화면에 «밝힌다».
   ■ 결과 낱말은 «공단 처분 기준»이다 — 「취소」는 대개 근로자 쪽 승소지만, 사업주가 원고인 사건은 거꾸로다.
     판결문 머리에서 그렇게 보이면(짐작) 초록을 빼고 「⚠ 원고 확인」을 붙인다. 심사결정서 결과는 기각·취소·각하 갈래라
     「인정」으로는 걸리는 것이 없다 — 판례처럼 받은 쪽에서 취소 갈래를 거른다. */
(function (root) {
  'use strict';
  var BASE = 'https://apis.data.go.kr/B490001/';
  var KINDS = {
    pan: { label: '📜 판례', path: 'sjbPrecedentInfoService/getSjbPrecedentNaeyongPstate', kw: '', res: 'kindA' },
    sim: { label: '📋 심사결정서', path: 'simsaPstateInfoService/getSimsaResultNaeyongPstate', kw: 'cq', res: 'kinda' },
    jil: { label: '🩺 질병판정서', path: 'jilbyeongPstateInfoService/getJilbyeongResultNaeyongPstate', kw: 'cq', res: 'kinda' }
  };
  var PAGE = 20, SCAN = 100;   /* SCAN — 받은 쪽 안에서 거를 때 한 번에 살피는 건수 */

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
      v: verdict(it.kinda || it.kindA), chk: kind === 'pan' && employerSuit(txt), first: first, text: txt, kind: kind };
  }
  /* 판결문 머리에서 «원고가 사업주 쪽»으로 보이는가 (순수 로직 · 짐작이다 — 색을 빼고 확인을 청할 뿐, 결과를 뒤집지 않는다)
     근로자가 피고보조참가인으로 들어와 있거나, 원고 이름이 회사 꼴(주식회사 ○○ · ○○ 주식회사)일 때.
     ⚠ 「원고는 주식회사 ○○ 소속 근로자로서」 같은 본문 문장에 걸리지 않게 — 원고 바로 뒤가 가림표·회사 낱말일 때만 본다. */
  function employerSuit(text) {
    var t = String(text || '').slice(0, 1500).replace(/\s+/g, '');
    if (/피고보조참가인/.test(t)) return true;
    return /원고[:：]?[○◯〇●□△＊*A-Za-z]*(주식회사|유한회사|합자회사|㈜|\(주\))/.test(t);
  }
  /* 찾는 말 → 꼭 들어야 할 말(inc) · 빼는 말(exc) (순수 로직) */
  function parseQuery(q) {
    var inc = [], exc = [], m, re = /(-?)"([^"]+)"|(\S+)/g;
    q = String(q || '').replace(/[“”]/g, '"');
    while ((m = re.exec(q))) {
      var neg = m[1] === '-', w = m[2];
      if (w == null) { w = m[3]; if (w.length > 1 && w.charAt(0) === '-') { neg = true; w = w.slice(1); } }
      w = w.replace(/"/g, '').replace(/\s+/g, ' ').trim();
      if (!w || w === '-') continue;
      (neg ? exc : inc).push(w);
    }
    return { inc: inc, exc: exc };
  }
  /* 공단에 보낼 «한 낱말» — 띄어쓰기 없는 가장 긴 말(없으면 가장 긴 구절). 본문 검색이 없는 갈래(판례)는 빈 글자 (순수 로직) */
  function serverWord(kind, p) {
    if (!(KINDS[kind] || KINDS.jil).kw) return '';
    var best = '', phrase = '';
    ((p && p.inc) || []).forEach(function (w) {
      if (w.indexOf(' ') < 0) { if (w.length > best.length) best = w; }
      else if (w.length > phrase.length) phrase = w;
    });
    return best || phrase;
  }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  /* 받은 줄이 «나머지 말»에 맞는가 — 공단에 보낸 말은 공단이 이미 걸렀으니 빼고, 띄어쓰기는 무시하고 견준다 (순수 로직) */
  function rowMatch(r, p, sent) {
    var hay = squash([r.text, r.b, r.c, r.court, r.no].join(' '));
    var has = function (w) { return hay.indexOf(squash(w)) >= 0; };
    return ((p && p.inc) || []).every(function (w) { return w === sent || has(w); }) && !((p && p.exc) || []).some(has);
  }
  /* 이번 찾기의 «계획» — 공단에 보낼 말·결과 낱말, 받은 쪽에서 거를 것, 한 번에 받을 건수 (순수 로직)
     결과 거르기: 질병판정서는 공단이 「인정」·「불인정」으로 거른다. 판례·심사결정서의 인정 갈래는 취소·일부취소처럼
     낱말이 여럿이라 공단에 안 보내고 받은 쪽에서 거른다. 불인정 갈래는 「기각」으로 보낸다. */
  function plan(kind, q, res) {
    kind = KINDS[kind] ? kind : 'jil';
    var p = parseQuery(q), sent = serverWord(kind, p);
    var resWord = res === 'ok' ? (kind === 'jil' ? '인정' : '') : res === 'no' ? (kind === 'jil' ? '불인정' : '기각') : '';
    var rest = p.inc.some(function (w) { return w !== sent; }) || p.exc.length > 0;
    var scan = rest || (!!res && !resWord);
    return { kind: kind, p: p, sent: sent, res: res || '', resWord: resWord, rest: rest, scan: scan, size: scan ? SCAN : PAGE };
  }
  /* 받은 줄 → 보여 줄 줄 (순수 로직) — 공단이 「인정」에 「불인정」을 섞어 줘도 여기서 한 번 더 가른다 */
  function pick(rows, pl) {
    return (rows || []).filter(function (x) { return rowMatch(x, pl.p, pl.sent) && (!pl.res || x.v === pl.res); });
  }
  /* 요청 주소 — 열쇠·갈래·낱말·인정만/불인정만·쪽·한 번에 받을 건수 (순수 로직) */
  function url(key, kind, q, res, page, size) {
    var k = KINDS[kind] || KINDS.jil;
    var u = BASE + k.path + '?serviceKey=' + encodeURIComponent(key) + '&_type=json&numOfRows=' + (size || PAGE) + '&pageNo=' + (page || 1);
    if (q && k.kw) u += '&' + k.kw + '=' + encodeURIComponent(q);
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

  var st = null;     /* { kind, q, res, page, rows, total, got, pl, open, busy, err, onAttach } */
  var WARN_PLAINTIFF = '원고가 사업주 쪽으로 보입니다 — 결과는 «공단 처분 기준»이라 근로자에게는 거꾸로일 수 있습니다. 원고를 확인하세요.';
  /* 결과 거르기 단추의 이름 — 갈래마다 공단이 쓰는 낱말이 다르다 (순수 로직) */
  function resLabels(kind) { return kind === 'jil' ? { ok: '인정만', no: '불인정만' } : { ok: '취소만', no: '기각만' }; }
  /* 목록 위 안내 한 줄 — 무엇을 공단이 찾았고 무엇을 여기서 걸렀는지 «숨기지 않는다» (순수 로직) */
  function noteOf(pl) {
    var out = [];
    if (!pl) return out;
    if (pl.kind === 'pan') {
      out.push('판결결과는 «공단 처분 기준» — 「취소」는 대개 근로자 쪽 승소, 사업주가 원고면 거꾸로입니다(⚠ = 원고 확인).');
      if (pl.p.inc.length || pl.p.exc.length) out.push('판례는 공단 본문 검색이 없어 받은 ' + pl.size + '건 안에서만 거릅니다 — 「다음 ›」으로 이어서 살피세요.');
    } else if (pl.rest) {
      out.push((pl.sent ? '「' + pl.sent + '」(으)로 공단에서 찾고, ' : '') + '나머지 말은 받은 ' + pl.size + '건 안에서 거릅니다.');
    }
    return out;
  }
  /* 건수 글 — 받은 쪽에서 걸렀으면 «몇 건을 살펴 몇 건»인지까지 (순수 로직) */
  function countText(total, got, shown, pl) {
    if (total == null) return '';
    var t = Number(total).toLocaleString() + '건';
    return pl && pl.scan ? '공단 ' + t + ' · 이 쪽 ' + (got || 0) + '건을 살펴 ' + (shown || 0) + '건' : t;
  }
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
    var lab = resLabels(st.kind);
    var input = el('input', { value: st.q, placeholder: '예: 뇌출혈 야간근무 -당뇨 · "출퇴근 사고"', title: '띄어쓰기 = 모두 든 것 · "따옴표" = 그 구절 · -낱말 = 그 말이 든 것은 뺌', style: 'flex:1;min-width:200px;height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:16px',
      onkeydown: function (e) { if (e.key === 'Enter') { st.q = input.value.trim(); find(1); } } });
    var head = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid #e2e8f0;white-space:nowrap' }, [
      el('span', {}, '⚖'), el('b', { style: 'flex:1;font-size:15px' }, '산재 사례 찾기'),
      el('span', { style: 'cursor:pointer;color:#64748b;font-size:18px', title: '닫기', onclick: close }, '✕')]);
    var bar = el('div', { style: 'display:flex;gap:8px;padding:12px 16px 6px;align-items:center;flex-wrap:wrap' },
      Object.keys(KINDS).map(function (k) { return btn(st.kind === k, KINDS[k].label, function () { st.kind = k; find(1); }); })
        .concat([input, el('button', { style: 'height:34px;padding:0 14px;border-radius:8px;border:1px solid #2563eb;background:#2563eb;color:#ffffff;font-size:13px;cursor:pointer',
          onclick: function () { st.q = input.value.trim(); find(1); } }, '찾기')]));
    var cnt = st.busy ? '찾는 중…' : st.err ? '⚠ ' + st.err : countText(st.total, st.got, (st.rows || []).length, st.pl);
    var flt = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;align-items:center;font-size:12.5px;color:#64748b;white-space:nowrap' }, [
      '결과 ', btn(!st.res, '전체', function () { st.res = ''; find(1); }),
      btn(st.res === 'ok', lab.ok, function () { st.res = 'ok'; find(1); }),
      btn(st.res === 'no', lab.no, function () { st.res = 'no'; find(1); }),
      el('span', { style: 'margin-left:6px;flex:1 1 180px;min-width:0;overflow:hidden;text-overflow:ellipsis', title: cnt }, cnt)]);
    var notes = st.open == null ? noteOf(st.pl) : [];   /* 줄을 열어 읽는 동안은 접는다 — 폰에서 목록·원문 자리가 줄지 않게(열린 줄의 경고는 원문 위에 따로 뜬다) */
    var note = notes.length ? el('div', { style: 'padding:0 16px 8px;font-size:12px;line-height:1.5;color:#92400e' },
      notes.map(function (t) { return el('div', {}, 'ⓘ ' + t); })) : null;
    var list = el('div', { style: 'max-height:42vh;overflow:auto;border-top:1px solid #e2e8f0' });
    (st.rows || []).forEach(function (r, i) {
      var on = st.open === i;
      list.appendChild(el('div', { style: 'display:flex;gap:10px;padding:8px 16px;border-bottom:1px solid #f8fafc;cursor:pointer;white-space:nowrap;font-size:13px;' + (on ? 'background:#eff6ff' : ''),
        onclick: function () { st.open = on ? null : i; draw(); } }, [
        el('span', { style: 'width:150px;flex:none;overflow:hidden;text-overflow:ellipsis;color:#475569', title: r.no }, (r.court ? r.court + ' ' : '') + r.no),
        el('b', r.chk ? { style: 'width:60px;flex:none;color:#b45309', title: WARN_PLAINTIFF }
          : { style: 'width:60px;flex:none;color:' + (r.v === 'ok' ? '#166534' : r.v === 'no' ? '#dc2626' : '#475569') }, (r.res || '—') + (r.chk ? ' ⚠' : '')),
        el('span', { style: 'width:170px;flex:none;overflow:hidden;text-overflow:ellipsis', title: r.b }, r.b),
        el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#475569', title: r.c }, (r.c ? r.c + ' — ' : '') + r.first)]));
    });
    var more = (st.total || 0) > st.page * ((st.pl && st.pl.size) || PAGE);
    if (st.rows && !st.rows.length && !st.busy) list.appendChild(el('div', { style: 'padding:16px;color:#64748b;font-size:13px' },
      st.pl && st.pl.scan && more ? '이 쪽에는 맞는 사례가 없습니다 — 「다음 ›」으로 이어서 살피거나 낱말을 줄여 보세요.' : '찾은 사례가 없습니다 — 낱말을 줄이거나 다른 갈래에서 찾아보세요.'));
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
        [el('b', { style: 'display:block' }, cite(r)), r.chk ? el('div', { style: 'margin-top:4px;font-size:12.5px;color:#b45309' }, '⚠ ' + WARN_PLAINTIFF) : null,
          el('div', { style: 'margin-top:6px' }, acts), pre]);
    }
    var foot = el('div', { style: 'display:flex;gap:8px;align-items:center;padding:8px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b' }, [
      el('span', { style: 'flex:1' }, '근로복지공단 공개 자료(공공데이터포털)를 그 자리에서 읽습니다 — 저장하지 않습니다.'),
      st.page > 1 ? btn(false, '‹ 앞', function () { find(st.page - 1); }) : null,
      more ? btn(false, '다음 ›', function () { find(st.page + 1); }) : null]);
    box.appendChild(el('div', { style: 'position:fixed;inset:0;background:rgba(20,22,28,.34);z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px',
      onclick: function (e) { if (e.target === e.currentTarget) close(); } },
      [el('div', { style: 'background:#ffffff;color:#1e293b;border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.22);width:min(900px,100%);max-height:90vh;display:flex;flex-direction:column;overflow:hidden' },
        [head, bar, flt, note, list, full, foot])]));
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
    var pl = plan(st.kind, st.q, st.res);
    st.page = page || 1; st.busy = true; st.err = ''; st.open = null; st.pl = pl; draw();
    var my = st;
    fetch(url(kk, pl.kind, pl.sent, pl.resWord, st.page, pl.size)).then(function (r) {
      if (!r.ok) throw new Error('공단 답 ' + r.status);
      return r.json();
    }).then(function (j) {
      if (st !== my) return;
      var b = j && j.response && j.response.body;
      var items = b && b.items && b.items.item;
      var all = [].concat(items || []).map(function (it) { return row(it, pl.kind); });
      my.got = all.length; my.rows = pick(all, pl); my.total = Number(b && b.totalCount) || 0; my.busy = false; draw();
    }).catch(function (e) { if (st !== my) return; my.busy = false; my.rows = []; my.got = 0; my.err = (e && e.message) || '못 읽었습니다'; draw(); });
  }
  function open(opts) {
    opts = opts || {};
    st = { kind: KINDS[opts.kind] ? opts.kind : 'jil', q: String(opts.q || ''), res: '', page: 1, rows: null, total: null, got: 0, pl: null, open: null,
      busy: false, err: '', onAttach: typeof opts.onAttach === 'function' ? opts.onAttach : null };
    draw();
  }
  function close() { st = null; draw(); }
  function onKey(e) { if (st && e.key === 'Escape') close(); }
  if (root.document) root.document.addEventListener('keydown', onKey);

  root.PuSanjae = { open: open, close: close, verdict: verdict, row: row, url: url, guessQuery: guessQuery, KINDS: KINDS,
    parseQuery: parseQuery, serverWord: serverWord, rowMatch: rowMatch, plan: plan, pick: pick, employerSuit: employerSuit,
    resLabels: resLabels, noteOf: noteOf, countText: countText };
})(typeof window !== 'undefined' ? window : globalThis);
