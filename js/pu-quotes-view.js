/* ══ 「지난 견적·계약」 화면 (견적·계약 자동화 계획 1 · 작업 6) ══
   ■ 업무 종류별로 묶어 한 건씩: 날짜 · 의뢰처 · 견적/계약 · 과업 내용 · 기간 · 인원 · 금액 · 담당 · 열기.
   ■ 금액은 대표·총괄관리자·재무, 그리고 그 건의 «확정» 담당자만 본다(DB 규칙이 막는다). 나머지는 「금액 비공개」.
     ⚠ 모르는 금액을 0원으로 그리지 않는다 — 못 읽었으면 「확인 필요」, 값이 없으면 「—」.
   ■ 맨 왼쪽은 ☐ 고르기 칸 + 번호(지금 보이는 순서, 거르면 다시 매긴다 — 저장하지 않는다). 고르기만으로는 아무것도 안 바뀐다.
     총괄관리자가 고르면 「N건 선택 · 담당 확정」이 뜬다(건수를 묻고 한 번에 저장). 화면을 떠나면 고른 것을 비운다(clearSelection).
   ■ 칸은 한 줄(…) — 길면 title 에 전문. 폰(700px 이하)에서는 줄마다 두 줄 카드(☐·№ 는 왼쪽 끝 유지).
   ⚠ 사용자 값(회사·내용·이름)은 textContent 로만 넣는다. innerHTML 은 비울 때('')만 쓴다. */
(function (w) {
  'use strict';

  var NONE = '—';
  var FALLBACK_TYPES = [{ code: 'other', label: '기타' }];

  function typesOf(types) { return types || (w.PuQuotes && w.PuQuotes.TYPES) || FALLBACK_TYPES; }

  /* 업무 종류 묶음 — types 순서, 빈 묶음은 뺀다. 모르는 종류 값은 «기타» 로 모은다 */
  function groupByType(rows, types) {
    var T = typesOf(types), known = {}, out = [];
    T.forEach(function (t) { known[t.code] = []; });
    var other = known.other ? 'other' : T[T.length - 1].code;
    (rows || []).forEach(function (r) {
      var c = known[r && r.type] ? r.type : other;
      known[c].push(r);
    });
    T.forEach(function (t) { if (known[t.code].length) out.push({ code: t.code, label: t.label, rows: known[t.code] }); });
    return out;
  }

  function won(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }

  /* 금액 글자 — canSeeAll: 대표·총괄·재무(전체를 읽을 수 있는 사람).
     금액 칸(amt)을 읽었다는 것은 그 건을 볼 권한이 있다는 뜻이다(확정 담당자) — 규칙이 그 사람에게만 읽게 해 준다. */
  function amountText(rec, amt, canSeeAll) {
    if (amt && typeof amt.amount === 'number' && isFinite(amt.amount)) {
      var v = amt.vat === 'excl' ? ' (부가세 별도)' : amt.vat === 'incl' ? ' (부가세 포함)' : '';
      return won(amt.amount) + v;
    }
    if (amt || canSeeAll) return (rec && rec.review === 'check') ? '확인 필요' : NONE;
    return '금액 비공개';
  }

  /* 담당 — 확정된 사람이 있으면 이름(아이디는 안 적는다), 아니면 «추정»(메일에서 짐작한 사람) */
  function ownerInfo(rec, amt, names) {
    if (amt && amt.owner) return { text: (names && names[amt.owner]) || '담당 확정됨', confirmed: true };
    if (rec && rec.ownerGuess) return { text: '담당(추정) ' + rec.ownerGuess, confirmed: false };
    return { text: NONE, confirmed: false };
  }

  /* 원본 열기 — 서버(puDocSecret)와 같은 기준: 총괄관리자 · 재무 · 그 건의 확정 담당자 */
  function canOpen(rec, amt, role, uid) {
    if (!rec || !rec.fileId) return false;
    role = role || {};
    if (role.isAdmin === true || role.fin === true) return true;
    return !!(uid && amt && amt.owner && amt.owner === uid);
  }

  function filterRows(rows, f) {
    f = f || {};
    var q = String(f.text || '').trim().toLowerCase();
    return (rows || []).filter(function (r) {
      if (f.doc && r.doc !== f.doc) return false;
      if (!q) return true;
      return (String(r.co || '') + ' ' + String(r.scope || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  /* 가져오기 결과 한 문장 — done·skipped·failed·left, stopped(멈춘 까닭) */
  function importResultText(r) {
    r = r || {};
    var p = [(r.done || 0) + '건을 가져왔습니다'];
    if (r.check) p.push('확인 필요 ' + r.check + '건');
    if (r.skipped) p.push('이미 있어 건너뜀 ' + r.skipped + '건');
    if (r.failed) p.push('가져오지 못함 ' + r.failed + '건');
    if (r.left) p.push('남은 ' + r.left + '건');
    var s = p.join(' · ');
    if (r.stopped) s += ' — 멈춤: ' + r.stopped;
    return s;
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

  /* 금액 칸은 «4,000,000원 (부가세 별도)» 가 한 줄에 다 보이는 폭(176px) — 좁으면 부가세 말이 잘려 별도·포함이 안 보인다 */
  var COLS = '28px 36px 88px minmax(110px,1.1fr) 44px minmax(120px,2fr) 88px 52px 176px 140px 56px';
  var CSS = '.pqv{font-size:13px}.pqv button,.pqv select,.pqv input[type=search]{font-family:inherit;font-size:13px}'
    + '.pqv-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}'
    + '.pqv-tools input[type=search]{border:1px solid #cbd5e1;border-radius:7px;padding:5px 9px;min-width:180px}'
    + '.pqv-tools .chip,.pqv .btn{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:4px 10px;cursor:pointer}'
    + '.pqv .chip.on{background:#bfdbfe;border-color:#1e40af;color:#1e40af;font-weight:700}'
    + '.pqv .btn:disabled{opacity:.5;cursor:default}'
    + '.pqv-selall{display:none}'
    + '.pqv-imp{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px;padding:8px 10px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc}'
    + '.pqv-sel{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:6px 10px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe}'
    + '.pqv-g{margin:12px 0 4px;font-weight:700;color:#1e293b}.pqv-g i{font-style:normal;font-weight:400;color:#64748b;margin-left:6px}'
    + '.pqv-wrap{overflow-x:auto}.pqv-list{min-width:990px}'
    + '.pqv-row{display:grid;grid-template-columns:' + COLS + ';align-items:center;column-gap:6px;padding:5px 4px;border-bottom:1px solid #e2e8f0}'
    + '.pqv-row>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pqv-head{font-weight:700;color:#475569;background:#f8fafc;border-bottom:1px solid #cbd5e1}'
    + '.pqv-no{font-variant-numeric:tabular-nums;color:#64748b;text-align:right}'
    + '.pqv-row input[type=checkbox]{width:16px;height:16px;margin:0}'
    + '.pqv-amt{font-variant-numeric:tabular-nums}.pqv-amt.lock{color:#94a3b8}.pqv-amt.chk{color:#b45309}'
    + '.pqv-meta{display:none}'
    + '.pqv .empty{padding:18px;color:#64748b;text-align:center}.pqv .msg{margin:6px 0;color:#334155}'
    + '@media(max-width:700px){'
    + '.pqv input[type=search],.pqv select{font-size:16px}.pqv-tools input[type=search]{min-width:0;flex:1 1 140px}'
    + '.pqv-selall{display:inline-flex;align-items:center;gap:6px}.pqv-selall input[type=checkbox]{width:24px;height:24px;margin:0}'
    + '.pqv-wrap{overflow-x:visible}.pqv-list{min-width:0}.pqv-head{display:none}'
    /* 첫 줄: 의뢰처 · 금액 · (열기 그림 단추) / 둘째 줄: 날짜·구분·과업… 을 카드 «전체 폭»으로 — 금액에 밀려 일찍 잘리지 않게 */
    + '.pqv-row{grid-template-columns:28px 30px minmax(0,1fr) auto auto;grid-template-areas:"chk no co amt open" "chk no meta meta meta";row-gap:2px}'
    + '.pqv-row .c-amt{font-size:12px}'
    + '.pqv-row .c-open .btn{font-size:0;min-width:32px;min-height:32px;padding:0;line-height:1}.pqv-row .c-open .btn:before{content:"📂";font-size:16px}'
    + '.pqv-row .c-chk{grid-area:chk}.pqv-row .c-no{grid-area:no}.pqv-row .c-co{grid-area:co;font-weight:600}.pqv-row .c-amt{grid-area:amt;text-align:right}'
    + '.pqv-row .c-meta{grid-area:meta;display:block;color:#64748b}.pqv-row .c-open{grid-area:open}'
    + '.pqv-row .c-date,.pqv-row .c-doc,.pqv-row .c-scope,.pqv-row .c-period,.pqv-row .c-staff,.pqv-row .c-who{display:none}'
    + '.pqv-row input[type=checkbox]{width:24px;height:24px}'
    + '}';

  function mount(root, host) {
    host = host || {};
    var role = host.role || {};
    var canSeeAll = role.isAdmin === true || role.fin === true;
    var toast = typeof host.toast === 'function' ? host.toast : function () {};
    var ask = typeof host.ask === 'function' ? host.ask : function (m) { return w.confirm ? w.confirm(m) : true; };
    var st = { rows: null, amts: {}, amtErr: false, names: {}, staff: [], staffAsked: false, err: false,
      text: '', doc: '', sel: {}, pick: '', busy: false, msg: '', impBusy: false, impMsg: '', seq: 0 };

    if (w.document && w.document.head && !(w.document.getElementById && w.document.getElementById('pqv-css'))) {
      var s = w.document.createElement('style'); s.id = 'pqv-css'; s.textContent = CSS; w.document.head.appendChild(s);
    }

    function visible() { return filterRows(st.rows || [], { text: st.text, doc: st.doc }); }
    function ordered() {
      var out = [];
      groupByType(visible(), host.types).forEach(function (g) { g.rows.forEach(function (r) { out.push(r); }); });
      return out;
    }
    function selIds() { return Object.keys(st.sel).filter(function (k) { return st.sel[k]; }); }

    function load() {
      var seq = ++st.seq;
      st.rows = null; st.err = false; st.amtErr = false; st.amts = {};
      draw();
      var p;
      try { p = Promise.resolve(host.list()); } catch (e) { p = Promise.reject(e); }
      p.then(function (rows) {
        if (seq !== st.seq) return null;
        st.rows = rows || [];
        var ids = st.rows.map(function (r) { return r.id; });
        draw();
        var ap;
        try { ap = Promise.resolve(host.amounts ? host.amounts(ids) : {}); } catch (e) { ap = Promise.reject(e); }
        return ap.then(function (a) { if (seq === st.seq) st.amts = a || {}; },
          function () { if (seq === st.seq) st.amtErr = true; });
      }, function () { if (seq === st.seq) { st.err = true; st.rows = []; } return null; })
        .then(function () { if (seq === st.seq) { draw(); loadNames(); } });
    }
    /* 담당 이름 — 확정된 담당이 하나라도 있거나, 총괄관리자가 담당을 확정하려 할 때만 읽는다 */
    function loadNames() {
      if (st.staffAsked || typeof host.staff !== 'function') return;
      var need = role.isAdmin === true || Object.keys(st.amts).some(function (k) { return st.amts[k] && st.amts[k].owner; });
      if (!need) return;
      st.staffAsked = true;
      var p;
      try { p = Promise.resolve(host.staff()); } catch (e) { p = Promise.reject(e); }
      p.then(function (list) {
        st.staff = list || [];
        st.names = {};
        st.staff.forEach(function (x) { if (x && x.uid && x.name) st.names[x.uid] = x.name; });
        draw();
      }, function () { st.staff = []; draw(); });
    }

    function btn(label, fn, extra) {
      var b = el('button', { type: 'button', 'class': 'btn' + (extra ? ' ' + extra : ''), text: label });
      b.addEventListener('click', fn);
      return b;
    }
    function toggle(id, on) { if (on) st.sel[id] = true; else delete st.sel[id]; }
    function toggleAllVisible() {
      var rows = ordered(), all = rows.length > 0 && rows.every(function (r) { return st.sel[r.id]; });
      rows.forEach(function (r) { toggle(r.id, !all); });
      draw();
    }
    function checkbox(checked, label, fn) {
      var c = el('input', { type: 'checkbox', 'aria-label': label });
      c.checked = !!checked;
      c.addEventListener('change', function () { fn(!!c.checked); });
      return c;
    }

    function openFile(rec) {
      if (st.busy) return;
      st.busy = true;
      var p;
      try { p = Promise.resolve(host.openFile(rec)); } catch (e) { p = Promise.reject(e); }
      p.then(function () { st.busy = false; }, function (e) {
        st.busy = false;
        toast('파일을 열지 못했습니다 — ' + ((e && e.message) || e));
      });
    }

    function confirmOwners() {
      var ids = selIds();
      if (!ids.length || !st.pick || st.busy) return;
      var who = st.names[st.pick] || '선택한 직원';
      if (!ask(ids.length + '건의 확정 담당자를 「' + who + '」(으)로 정합니다. 이 사람이 그 견적의 금액과 원본 파일을 볼 수 있게 됩니다. 진행할까요?')) return;
      st.busy = true; draw();
      var p;
      try { p = Promise.resolve(host.confirmOwners(ids, st.pick, who)); } catch (e) { p = Promise.reject(e); }
      p.then(function () {
        st.busy = false; st.sel = {}; st.pick = '';
        toast(ids.length + '건의 담당을 「' + who + '」(으)로 확정했습니다');
        load();
      }, function (e) {
        st.busy = false;
        toast('담당을 확정하지 못했습니다 — ' + ((e && e.message) || e));
        draw();
      });
    }

    /* 건수는 «누를 때» 센다 — 메일 줄을 천 통 넘게 읽어야 알 수 있어서, 화면을 열 때마다 하지 않는다(비용 절감).
       importer.count() 가 «새로 가져올 건수»를 돌려주고, 0 이면 물을 것도 없다. 없으면 건수 없이 묻는다. */
    function runImport() {
      var imp = host.importer;
      if (!imp || st.impBusy) return;
      st.impBusy = true; st.impMsg = '가져올 메일을 찾는 중…'; draw();
      var cp;
      try { cp = typeof imp.count === 'function' ? Promise.resolve(imp.count()) : Promise.resolve(null); } catch (e) { cp = Promise.reject(e); }
      cp.then(function (n) {
        if (n === 0) { st.impBusy = false; st.impMsg = '새로 가져올 견적·계약이 없습니다'; draw(); return null; }
        var q = '보낸메일함에서 지난 견적·계약' + (typeof n === 'number' ? ' ' + n + '건' : '') + '을 가져옵니다. 파일을 하나씩 받아 AI 가 읽으므로 시간이 걸립니다. 진행할까요?';
        if (!ask(q)) { st.impBusy = false; st.impMsg = ''; draw(); return null; }
        st.impMsg = '시작합니다…'; draw();
        var p;
        try { p = Promise.resolve(imp.run(function (step) { st.impMsg = String(step || ''); drawImpOnly(); })); } catch (e) { p = Promise.reject(e); }
        return p.then(function (r) {
          st.impBusy = false; st.impMsg = importResultText(r);
          load();
        });
      }).catch(function (e) {
        st.impBusy = false; st.impMsg = '가져오지 못했습니다 — ' + ((e && e.message) || e);
        draw();
      });
    }
    var impEl = null;
    function drawImpOnly() { if (impEl) impEl.textContent = st.impMsg; }

    function rowEl(r, no) {
      var amt = st.amts[r.id] || null;
      var o = ownerInfo(r, amt, st.names);
      var amtTxt = st.amtErr && canSeeAll ? '금액을 읽지 못했습니다' : amountText(r, amt, canSeeAll);
      var amtCls = 'c-amt pqv-amt' + (amtTxt === '금액 비공개' ? ' lock' : (amtTxt === '확인 필요' ? ' chk' : ''));
      var docTxt = r.doc === 'contract' ? '계약' : '견적';
      var period = r.period || NONE, scope = r.scope || NONE;
      var staff = typeof r.staff === 'number' ? r.staff + '명' : NONE;
      /* 폰 카드의 둘째 줄 — 데스크톱에서는 숨는다(.pqv-meta). 빈 값은 그리지 않는다 */
      var meta = [r.date || NONE, docTxt, scope === NONE ? '' : scope, period === NONE ? '' : period, typeof r.staff === 'number' ? staff : '', o.text === NONE ? '' : o.text]
        .filter(Boolean).join(' · ');
      function cell(cls, text) { var c = el('span', { 'class': cls, text: text }); c.setAttribute('title', text); return c; }
      var chk = el('span', { 'class': 'c-chk' }, [checkbox(!!st.sel[r.id], no + '번 고르기', function (on) { toggle(r.id, on); draw(); })]);
      var open = el('span', { 'class': 'c-open' });
      if (canOpen(r, amt, role, host.uid)) {
        var ob = btn('열기', function () { openFile(r); });
        ob.setAttribute('title', '원본 열기'); ob.setAttribute('aria-label', '원본 열기');   /* 폰에서는 📂 그림만 보인다 */
        open.appendChild(ob);
      }
      var row = el('div', { 'class': 'pqv-row', role: 'row' }, [
        chk, el('span', { 'class': 'c-no pqv-no', text: String(no) }),
        cell('c-date', r.date || NONE), cell('c-co', r.co || NONE), cell('c-doc', docTxt),
        cell('c-scope', scope), cell('c-period', period), cell('c-staff', staff),
        cell(amtCls, amtTxt), cell('c-who', o.text), open, cell('c-meta pqv-meta', meta)
      ]);
      return row;
    }

    function draw() {
      root.innerHTML = '';
      impEl = null;
      var box = el('div', { 'class': 'pqv' });

      /* 가져오기 줄 — 총괄관리자만, 가져오는 길(importer)이 연결돼 있을 때만 */
      if (host.importer && role.isAdmin === true) {
        var ib = btn('📥 보낸메일에서 가져오기', runImport); if (st.impBusy) ib.setAttribute('disabled', 'disabled');
        impEl = el('span', { 'class': 'msg', text: st.impMsg || '' });
        box.appendChild(el('div', { 'class': 'pqv-imp' }, [ib, impEl]));
      }

      if (st.err) {
        box.appendChild(el('div', { 'class': 'empty', text: '지난 견적·계약을 불러오지 못했습니다.' }));
        box.appendChild(btn('다시 불러오기', load));
        root.appendChild(box); return;
      }
      if (st.rows === null) { box.appendChild(el('div', { 'class': 'empty', text: '불러오는 중…' })); root.appendChild(box); return; }
      if (!st.rows.length) {
        box.appendChild(el('div', { 'class': 'empty', text: '아직 모아 둔 견적·계약이 없습니다.' }));
        root.appendChild(box); return;
      }

      /* 거르기 — 글자(의뢰처·과업 내용) · 견적/계약 */
      var search = el('input', { type: 'search', placeholder: '의뢰처·과업 내용 찾기', 'aria-label': '의뢰처·과업 내용 찾기' });
      search.value = st.text;
      search.addEventListener('input', function () { st.text = search.value; redrawKeepFocus(); });
      var allOn = ordered().length > 0 && ordered().every(function (r) { return st.sel[r.id]; });
      var selAll = el('label', { 'class': 'pqv-selall' }, [checkbox(allOn, '보이는 것 모두 고르기', toggleAllVisible), el('span', { text: '모두 고르기' })]);
      function chip(label, on, fn) { var b = el('button', { type: 'button', 'class': 'chip' + (on ? ' on' : ''), text: label }); b.addEventListener('click', fn); return b; }
      box.appendChild(el('div', { 'class': 'pqv-tools' }, [
        search,
        chip('전체', !st.doc, function () { st.doc = ''; draw(); }),
        chip('견적', st.doc === 'quote', function () { st.doc = st.doc === 'quote' ? '' : 'quote'; draw(); }),
        chip('계약', st.doc === 'contract', function () { st.doc = st.doc === 'contract' ? '' : 'contract'; draw(); }),
        /* 목록은 열 때 한 번만 읽는다(비용 절감) — 다른 직원이 넣은 것은 눌러서 다시 받는다 */
        btn('🔄 새로고침', function () { st.sel = {}; load(); }),
        selAll
      ]));
      if (st.msg) box.appendChild(el('div', { 'class': 'msg', text: st.msg }));

      /* 고른 것이 있으면 «N건 선택» 과 할 일 */
      var ids = selIds();
      if (ids.length) {
        var kids = [el('b', { text: ids.length + '건 선택' })];
        if (role.isAdmin === true && typeof host.confirmOwners === 'function') {
          if (st.staff.length) {
            var sel = el('select', { 'aria-label': '확정 담당자' });
            var o0 = el('option', { value: '', text: '담당 확정할 직원 고르기' }); sel.appendChild(o0);
            st.staff.forEach(function (x) { sel.appendChild(el('option', { value: x.uid, text: x.name })); });
            sel.value = st.pick;
            sel.addEventListener('change', function () { st.pick = sel.value; draw(); });
            kids.push(sel);
            var go = btn('담당 확정', confirmOwners); if (!st.pick || st.busy) go.setAttribute('disabled', 'disabled');
            kids.push(go);
          } else {
            kids.push(el('span', { 'class': 'msg', text: st.staffAsked ? '직원 목록을 읽지 못했습니다.' : '직원 목록을 불러오는 중…' }));
          }
        }
        kids.push(btn('선택 해제', function () { st.sel = {}; draw(); }));
        box.appendChild(el('div', { 'class': 'pqv-sel' }, kids));
      }

      var groups = groupByType(visible(), host.types);
      if (!groups.length) {
        box.appendChild(el('div', { 'class': 'empty', text: '조건에 맞는 견적·계약이 없습니다.' }));
      } else {
        var no = 0, head = el('div', { 'class': 'pqv-row pqv-head', role: 'row' }, [
          el('span', { 'class': 'c-chk' }, [checkbox(allOn, '보이는 것 모두 고르기', toggleAllVisible)]), el('span', { 'class': 'pqv-no', text: '№' }),
          el('span', { text: '날짜' }), el('span', { text: '의뢰처' }), el('span', { text: '구분' }), el('span', { text: '과업 내용' }),
          el('span', { text: '기간' }), el('span', { text: '인원' }), el('span', { text: '금액' }), el('span', { text: '담당' }), el('span', { text: '' })
        ]);
        var list = el('div', { 'class': 'pqv-list', role: 'table' }, [head]);
        groups.forEach(function (g) {
          list.appendChild(el('div', { 'class': 'pqv-g' }, [el('span', { text: g.label }), el('i', { text: g.rows.length + '건' })]));
          g.rows.forEach(function (r) { no++; list.appendChild(rowEl(r, no)); });
        });
        box.appendChild(el('div', { 'class': 'pqv-wrap' }, [list]));
      }
      root.appendChild(box);
    }
    /* 글자를 치는 동안 입력칸을 다시 그리면 커서를 잃는다 — 그린 뒤 같은 칸에 돌려 놓는다 */
    function redrawKeepFocus() {
      draw();
      var f = root.querySelector && root.querySelector('input[type=search]');
      if (f && f.focus) { f.focus(); try { var n = f.value.length; f.setSelectionRange(n, n); } catch (e) { /* 일부 종류는 못 한다 */ } }
    }

    load();
    return {
      reload: load,
      clearSelection: function () { if (selIds().length) { st.sel = {}; st.pick = ''; draw(); } },
      selected: selIds
    };
  }

  w.PuQuotesView = { mount: mount, groupByType: groupByType, amountText: amountText, ownerInfo: ownerInfo, canOpen: canOpen,
    filterRows: filterRows, importResultText: importResultText };
})(typeof window !== 'undefined' ? window : this);
