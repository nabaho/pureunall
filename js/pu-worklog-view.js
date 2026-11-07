/* ══ 작업 기록 화면 — 총괄관리자만 (견적·계약 자동화 계획 1) ══
   ■ 위에 달 이동(‹ 2026년 11월 ›), 그 아래 사람 칩·종류 칩, 표(시각 · 사람 · 종류 · 대상 · 설명).
   ■ 읽기는 총괄관리자만 된다(DB 규칙). 거절되면 죽지 않고 짧은 안내만 그린다.
   ⚠ 사용자 값(이름·대상·설명)은 el(…, {text}) 로만 넣는다. innerHTML 은 비울 때('')만 쓴다. */
(function (w) {
  'use strict';

  var KST_MS = 9 * 3600 * 1000;
  var NO_NAME = '이름 없음';

  function pad(n) { return ('0' + n).slice(-2); }
  /* 달 이동 — '202601', -1 → '202512' */
  function shiftMonth(month, delta) {
    var y = parseInt(month.slice(0, 4), 10), m = parseInt(month.slice(4, 6), 10) - 1 + delta;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return String(y) + pad(m + 1);
  }
  function monthLabel(month) { return month.slice(0, 4) + '년 ' + parseInt(month.slice(4, 6), 10) + '월'; }
  /* 한국 시간 MM.DD HH:mm */
  function fmtTime(ms) {
    var d = new Date(ms + KST_MS);
    return pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function who(r) { return r.byName || NO_NAME; }
  function filterRows(rows, f) {
    f = f || {};
    return rows.filter(function (r) {
      return (!f.by || who(r) === f.by) && (!f.kind || r.kind === f.kind);
    });
  }
  /* 사람별 건수 — 많은 순(같으면 먼저 나온 순) */
  function people(rows) {
    var seen = {}, list = [];
    rows.forEach(function (r) {
      var n = who(r);
      if (!seen[n]) { seen[n] = { name: n, n: 0 }; list.push(seen[n]); }
      seen[n].n++;
    });
    return list.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return (b.p.n - a.p.n) || (a.i - b.i); })
      .map(function (x) { return x.p; });
  }

  function el(tag, attrs, kids) {
    var n = w.document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  var CSS = '.plv{font-size:13px}.plv-bar{display:flex;align-items:center;gap:10px;margin-bottom:8px}.plv-bar b{min-width:110px;text-align:center}'
    + '.plv button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit}'
    + '.plv .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.plv .chip.on{background:#bfdbfe;border-color:#1e40af;color:#1e40af;font-weight:700}'
    + '.plv-wrap{overflow-x:auto}.plv table{border-collapse:collapse;width:100%;min-width:560px}'
    + '.plv th,.plv td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}'
    + '.plv .empty{padding:18px;color:#64748b;text-align:center}.plv .auto{color:#64748b;font-size:12px;margin-left:6px}';

  function mount(root, o) {
    o = o || {};
    var kinds = o.kinds || {};
    var now = o.now || Date.now;
    var st = { month: monthOf(now()), rows: null, err: false, by: '', kind: '', seq: 0 };

    function monthOf(ms) {
      var d = new Date(ms + KST_MS);
      return String(d.getUTCFullYear()) + pad(d.getUTCMonth() + 1);
    }
    if (w.document && w.document.head && !(w.document.getElementById && w.document.getElementById('plv-css'))) {
      var s = w.document.createElement('style'); s.id = 'plv-css'; s.textContent = CSS; w.document.head.appendChild(s);
    }
    function load() {
      var seq = ++st.seq;
      st.rows = null; st.err = false; st.by = ''; st.kind = '';
      draw();
      var p;
      try { p = Promise.resolve(o.list(st.month)); } catch (e) { p = Promise.reject(e); }
      p.then(function (rows) { if (seq !== st.seq) return; st.rows = rows || []; draw(); },
        function () { if (seq !== st.seq) return; st.err = true; draw(); });
    }
    function chip(label, on, fn) {
      var b = el('button', { type: 'button', 'class': 'chip' + (on ? ' on' : ''), text: label });
      b.addEventListener('click', fn);
      return b;
    }
    function draw() {
      root.innerHTML = '';
      var box = el('div', { 'class': 'plv' });
      var prev = el('button', { type: 'button', text: '‹', 'aria-label': '앞 달' });
      var next = el('button', { type: 'button', text: '›', 'aria-label': '다음 달' });
      prev.addEventListener('click', function () { st.month = shiftMonth(st.month, -1); load(); });
      next.addEventListener('click', function () { st.month = shiftMonth(st.month, 1); load(); });
      box.appendChild(el('div', { 'class': 'plv-bar' }, [prev, el('b', { text: monthLabel(st.month) }), next]));
      if (st.err) {
        box.appendChild(el('div', { 'class': 'empty', text: '작업 기록은 총괄관리자만 볼 수 있습니다.' }));
      } else if (st.rows === null) {
        box.appendChild(el('div', { 'class': 'empty', text: '불러오는 중…' }));
      } else if (!st.rows.length) {
        box.appendChild(el('div', { 'class': 'empty', text: '이 달에는 기록이 없습니다' }));
      } else {
        var pc = el('div', { 'class': 'chips' }, [chip('전체 ' + st.rows.length, !st.by, function () { st.by = ''; draw(); })]);
        people(st.rows).forEach(function (p) {
          pc.appendChild(chip(p.name + ' ' + p.n, st.by === p.name, function () { st.by = st.by === p.name ? '' : p.name; draw(); }));
        });
        box.appendChild(pc);
        var used = {};
        st.rows.forEach(function (r) { used[r.kind] = 1; });
        var kc = el('div', { 'class': 'chips' }, [chip('모든 종류', !st.kind, function () { st.kind = ''; draw(); })]);
        Object.keys(used).forEach(function (k) {
          kc.appendChild(chip(kinds[k] || k, st.kind === k, function () { st.kind = st.kind === k ? '' : k; draw(); }));
        });
        box.appendChild(kc);
        var rows = filterRows(st.rows, { by: st.by, kind: st.kind });
        var tb = el('tbody', {});
        rows.forEach(function (r) {
          var note = el('td', { text: r.note || '' });
          if (r.auto) note.appendChild(el('span', { 'class': 'auto', text: '🤖 자동' }));
          tb.appendChild(el('tr', {}, [
            el('td', { text: fmtTime(r.at || 0) }), el('td', { text: who(r) }),
            el('td', { text: kinds[r.kind] || r.kind || '' }), el('td', { text: r.target || '' }), note
          ]));
        });
        var head = el('tr', {}, ['시각', '사람', '종류', '대상', '설명'].map(function (t) { return el('th', { text: t }); }));
        box.appendChild(el('div', { 'class': 'plv-wrap' }, [el('table', {}, [el('thead', {}, [head]), tb])]));
        if (!rows.length) box.appendChild(el('div', { 'class': 'empty', text: '조건에 맞는 기록이 없습니다' }));
      }
      root.appendChild(box);
    }
    load();
  }

  w.PuWorklogView = { mount: mount, shiftMonth: shiftMonth, filterRows: filterRows, people: people, fmtTime: fmtTime };
})(typeof window !== 'undefined' ? window : this);
