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

  /* 기록·원본 관리 권한 — 총괄관리자 · 재무 · 확정 담당자 · 직접 등록한 작성자 */
  function canManage(rec, amt, role, uid) {
    if (!rec) return false;
    role = role || {};
    if (role.isAdmin === true || role.fin === true) return true;
    if (uid && amt && amt.owner && amt.owner === uid) return true;
    if (uid && rec.by && rec.by === uid) return true;
    return false;
  }

  function filterRows(rows, f) {
    f = f || {};
    var q = String(f.text || '').trim().toLowerCase();
    return (rows || []).filter(function (r) {
      if (f.doc && r.doc !== f.doc) return false;
      if (f.type && (r.type || 'other') !== f.type) return false;
      if (f.review && r.review !== f.review) return false;
      if (!q) return true;
      return (String(r.co || '') + ' ' + String(r.scope || '') + ' ' + String(r.period || '')).toLowerCase().indexOf(q) >= 0;
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
      if (attrs[k] == null || attrs[k] === false) return;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* 금액 칸은 «4,000,000원 (부가세 별도)» 가 한 줄에 다 보이는 폭(176px) — 좁으면 부가세 말이 잘려 별도·포함이 안 보인다 */
  var COLS = '28px 36px 88px minmax(110px,1.1fr) 44px minmax(120px,2fr) 88px 52px 176px 130px 56px auto';
  var CSS = '.pqv{font-size:13px}.pqv button,.pqv select,.pqv input[type=search],.pqv input[type=text],.pqv input[type=date],.pqv textarea{font-family:inherit;font-size:13px}'
    + '.pqv-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}'
    + '.pqv-tchips{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px}'
    + '.pqv-tools input[type=search]{border:1px solid #cbd5e1;border-radius:7px;padding:5px 9px;min-width:180px}'
    + '.pqv-tools .chip,.pqv-tchips .chip,.pqv .btn{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:4px 10px;cursor:pointer}'
    + '.pqv .btn.pri{background:#1e40af;border-color:#1e40af;color:#fff;font-weight:700}'
    + '.pqv .btn.grn{background:#166534;border-color:#166534;color:#fff;font-weight:700}'
    + '.pqv .btn.sub{background:#eff6ff;border-color:#93c5fd;color:#1e40af;font-weight:600}'
    + '.pqv .chip.on{background:#bfdbfe;border-color:#1e40af;color:#1e40af;font-weight:700}'
    + '.pqv .btn:disabled{opacity:.5;cursor:default}'
    + '.pqv-selall{display:none}'
    + '.pqv-imp{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px;padding:8px 10px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc}'
    + '.pqv-sel{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:6px 10px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe}'
    + '.pqv-g{margin:12px 0 4px;font-weight:700;color:#1e293b}.pqv-g i{font-style:normal;font-weight:400;color:#64748b;margin-left:6px}'
    + '.pqv-wrap{overflow-x:auto}.pqv-list{min-width:1040px}'
    + '.pqv-row{display:grid;grid-template-columns:' + COLS + ';align-items:center;column-gap:6px;padding:5px 4px;border-bottom:1px solid #e2e8f0}'
    + '.pqv-row.clickable .c-co,.pqv-row.clickable .c-scope{cursor:pointer}.pqv-row.clickable:hover{background:#f8fafc}'
    + '.pqv-row>*{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pqv-head{font-weight:700;color:#475569;background:#f8fafc;border-bottom:1px solid #cbd5e1}'
    + '.pqv-no{font-variant-numeric:tabular-nums;color:#64748b;text-align:right}'
    + '.pqv-row input[type=checkbox]{width:16px;height:16px;margin:0}'
    + '.pqv-amt{font-variant-numeric:tabular-nums}.pqv-amt.lock{color:#94a3b8}.pqv-amt.chk{color:#b45309}'
    + '.pqv-meta{display:none}'
    + '.pqv .empty{padding:18px;color:#64748b;text-align:center}.pqv .msg{margin:6px 0;color:#334155}'
    + '.pqv-mbg{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px}'
    + '.pqv-modal{background:#fff;border-radius:12px;width:1060px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden}'
    + '.pqv-mh{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc}'
    + '.pqv-mh b{font-size:15px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pqv-mbar{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#eff6ff;align-items:center}'
    + '.pqv-mb{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.9fr);gap:14px;padding:14px 16px;overflow:auto;flex:1}'
    + '.pqv-prev{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;min-height:360px;max-height:66vh;overflow:auto;padding:10px}'
    + '.pqv-prev iframe{width:100%;height:60vh;border:none;background:#fff}.pqv-prev img{max-width:100%}'
    + '.pqv-form{display:flex;flex-direction:column;gap:8px}'
    + '.pqv-fg{display:flex;flex-direction:column;gap:3px}.pqv-fg label{font-size:11.5px;font-weight:700;color:#475569}'
    + '.pqv-fg input,.pqv-fg select,.pqv-fg textarea{border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px}'
    + '.pqv-frow2{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
    + '@media(max-width:700px){'
    + '.pqv input[type=search],.pqv select{font-size:16px}'
    + '.pqv input[type=text],.pqv input[type=date],.pqv textarea{font-size:16px}'
    + '.pqv-tools input[type=search]{min-width:0;flex:1 1 140px}'
    + '.pqv-tchips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.pqv-tchips .chip{flex:none}'
    + '.pqv-selall{display:inline-flex;align-items:center;gap:6px}.pqv-selall input[type=checkbox]{width:24px;height:24px;margin:0}'
    + '.pqv-wrap{overflow-x:visible}.pqv-list{min-width:0}.pqv-head{display:none}'
    /* 첫 줄: 의뢰처 · 금액 · (열기 그림 단추) / 둘째 줄: 날짜·구분·과업… 을 카드 «전체 폭»으로 — 금액에 밀려 일찍 잘리지 않게 */
    + '.pqv-row{grid-template-columns:28px 30px minmax(0,1fr) auto auto;grid-template-areas:"chk no co amt open" "chk no meta meta meta";row-gap:2px}'
    + '.pqv-row .c-amt{font-size:12px}'
    + '.pqv-row .c-open .btn{font-size:0;min-width:32px;min-height:32px;padding:0;line-height:1}.pqv-row .c-open .btn:before{content:"📂";font-size:16px}'
    + '.pqv-row .c-chk{grid-area:chk}.pqv-row .c-no{grid-area:no}.pqv-row .c-co{grid-area:co;font-weight:600}.pqv-row .c-amt{grid-area:amt;text-align:right}'
    + '.pqv-row .c-meta{grid-area:meta;display:block;color:#64748b}.pqv-row .c-open{grid-area:open}'
    + '.pqv-row .c-date,.pqv-row .c-doc,.pqv-row .c-scope,.pqv-row .c-period,.pqv-row .c-staff,.pqv-row .c-who,.pqv-row .c-act{display:none}'
    + '.pqv-row input[type=checkbox]{width:24px;height:24px}'
    + '.pqv-mb{grid-template-columns:1fr}'
    + '}';

  function mount(root, host) {
    host = host || {};
    var role = host.role || {};
    var canSeeAll = role.isAdmin === true || role.fin === true;
    var hasRich = !!(host.previewFile || host.editQuoteHwp || host.fillFromQuote || host.updateQuote);
    var toast = typeof host.toast === 'function' ? host.toast : function () {};
    var ask = typeof host.ask === 'function' ? host.ask : function (m) { return w.confirm ? w.confirm(m) : true; };
    var st = { rows: null, amts: {}, amtErr: false, names: {}, staff: [], staffAsked: false, err: false,
      text: '', doc: '', type: '', review: '', sel: {}, pick: '', busy: false, msg: '', impBusy: false, impMsg: '', seq: 0,
      watchOn: null, watchBusy: false, detailId: '' };

    if (w.document && w.document.head && !(w.document.getElementById && w.document.getElementById('pqv-css'))) {
      var s = w.document.createElement('style'); s.id = 'pqv-css'; s.textContent = CSS; w.document.head.appendChild(s);
    }

    function visible() { return filterRows(st.rows || [], { text: st.text, doc: st.doc, type: st.type, review: st.review }); }
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
    function runImportMode(fast) {
      var imp = host.importer;
      if (!imp || st.impBusy) return;
      var runner = fast && typeof imp.runFast === 'function' ? imp.runFast : imp.run;
      st.impBusy = true; st.impMsg = '가져올 메일을 찾는 중…'; draw();
      var cp;
      try { cp = typeof imp.count === 'function' ? Promise.resolve(imp.count()) : Promise.resolve(null); } catch (e) { cp = Promise.reject(e); }
      cp.then(function (n) {
        if (n === 0) { st.impBusy = false; st.impMsg = '새로 가져올 견적·계약이 없습니다'; draw(); return null; }
        var q = fast
          ? '보낸메일함에서 아직 안 가져온 견적·계약' + (typeof n === 'number' ? ' ' + n + '건' : '') + '의 원본 파일과 제목·날짜를 AI 판독 없이 빠르게 모두 가져옵니다(하루 한도와 무관, 금액은 나중에 고칠 수 있음). 진행할까요?'
          : '보낸메일함에서 지난 견적·계약' + (typeof n === 'number' ? ' ' + n + '건' : '') + '을 가져옵니다. 파일을 하나씩 받아 AI 가 읽으므로 시간이 걸립니다. 진행할까요?';
        if (!ask(q)) { st.impBusy = false; st.impMsg = ''; draw(); return null; }
        st.impMsg = '시작합니다…'; draw();
        var p;
        try { p = Promise.resolve(runner(function (step) { st.impMsg = String(step || ''); drawImpOnly(); })); } catch (e) { p = Promise.reject(e); }
        return p.then(function (r) {
          st.impBusy = false; st.impMsg = importResultText(r);
          load();
        });
      }).catch(function (e) {
        st.impBusy = false; st.impMsg = '가져오지 못했습니다 — ' + ((e && e.message) || e);
        draw();
      });
    }
    function runImport() { runImportMode(false); }
    var impEl = null;
    function drawImpOnly() { if (impEl) impEl.textContent = st.impMsg; }

    /* 📨 견적 자동 감지 스위치 — 켜는 길·끄는 길이 «이 한 단추»다(총괄관리자만, 서버 감지 훅과 같은 칸 pucards/config/quoteWatch/on).
       켜면 보낸메일함에 우리 견적서·계약서가 나갈 때마다 이알피에 «요청»이 올라간다(이알피를 사람이 열 때 반영). 금액은 올라가지 않는다. */
    function toggleWatch() {
      var wt = host.watch;
      if (!wt || st.watchBusy || st.watchOn === null) return;
      var next = !st.watchOn;
      var q = next
        ? '켜면 푸른메일 보낸메일함에 우리 견적서·계약서가 나갈 때마다 이알피 계약관리에 «요청»이 올라가고, 이알피를 열 때 «상담접수» 카드가 만들어지거나 «계약협의»로 옮겨집니다.\n금액은 올라가지 않습니다. 사업장을 못 찾으면 «걸린 요청»에 남아 사람이 고릅니다.\n\n켤까요?'
        : '끄면 새로 나가는 견적서·계약서는 더 이상 이알피에 요청으로 올라가지 않습니다. (이미 올라간 요청은 그대로 남습니다)\n\n끌까요?';
      if (!ask(q)) return;
      st.watchBusy = true; draw();
      Promise.resolve().then(function () { return wt.set(next); }).then(function () {
        st.watchBusy = false; st.watchOn = next; toast(next ? '📨 견적 자동 감지를 켰습니다' : '📨 견적 자동 감지를 껐습니다'); draw();
      }, function (e) {
        st.watchBusy = false; toast('바꾸지 못했습니다 — ' + ((e && e.message) || e)); draw();
      });
    }

    /* ══ 견적·계약 상세 미리보기 + 참고하여 한글 수정·표준양식 작성·정보 고치기 창 ══ */
    var escCleanup = null;
    function unbindDetailEsc() {
      if (escCleanup) { escCleanup(); escCleanup = null; }
    }
    function detailModal(r) {
      var amt = st.amts[r.id] || null;
      var allowed = canManage(r, amt, role, host.uid);
      var canEditInPlace = role.isAdmin === true || !!(host.uid && r.by && r.by === host.uid);
      var canFile = canOpen(r, amt, role, host.uid);
      var T = typesOf(host.types);
      function closeDetail() { unbindDetailEsc(); st.detailId = ''; draw(); }

      var barKids = [];
      if (canFile && typeof host.editQuoteHwp === 'function') {
        barKids.push(btn('✏ 한글 편집기로 고쳐 새 견적서 만들기', function () {
          Promise.resolve(host.editQuoteHwp(r, amt, function () { closeDetail(); load(); })).catch(function (e) {
            toast('한글 편집기를 열지 못했습니다 — ' + ((e && e.message) || e));
          });
        }, 'pri'));
      }
      if (typeof host.fillFromQuote === 'function') {
        barKids.push(btn('📝 표준 양식에 불러와 수정·작성', function () {
          var safeAmt = allowed ? amt : null;
          closeDetail();
          host.fillFromQuote(r, safeAmt);
        }, 'grn'));
      }
      if (allowed && typeof host.toContract === 'function') {
        barKids.push(btn('📑 확정 계약서로 전환·작성', function () {
          closeDetail();
          host.toContract(r, amt);
        }, 'sub'));
      }
      if (canFile && typeof host.registerForm === 'function') {
        barKids.push(btn('📄 공용 양식에 등록', function () {
          Promise.resolve(host.registerForm(r, amt)).then(function (ok) {
            if (ok) toast('📄 계약서 양식에 등록했습니다');
          }, function (e) { toast('양식 등록 실패 — ' + ((e && e.message) || e)); });
        }));
      }
      if (canFile) {
        barKids.push(btn('📥 원본 내려받기', function () { openFile(r); }));
      }

      var prevBox = el('div', { 'class': 'pqv-prev' });
      if (canFile && typeof host.previewFile === 'function') {
        prevBox.appendChild(el('div', { 'class': 'empty', text: '원본 문서를 불러오는 중…' }));
        Promise.resolve().then(function () { return host.previewFile(r, prevBox); }).catch(function (e) {
          prevBox.innerHTML = '';
          prevBox.appendChild(el('div', { 'class': 'empty', text: '미리보기를 불러오지 못했습니다 — ' + ((e && e.message) || e) }));
        });
      } else if (!r.fileId) {
        prevBox.appendChild(el('div', { 'class': 'empty', text: '원본 첨부 파일이 없는 기록입니다. 위 「📝 표준 양식에 불러와 수정·작성」으로 새 문서를 바로 만들 수 있습니다.' }));
      } else {
        prevBox.appendChild(el('div', { 'class': 'empty', text: '🔒 원본 파일 미리보기와 금액은 대표·총괄관리자·재무·확정 담당자만 볼 수 있습니다. 공개된 과업·기간 정보로 표준 양식을 채우려면 위 「📝 표준 양식에 불러와 수정·작성」을 누르세요.' }));
      }

      var formBox = el('div', { 'class': 'pqv-form' });
      if (allowed && typeof host.updateQuote === 'function') {
        var docSel = el('select', { 'aria-label': '문서 구분' }, [
          el('option', { value: 'quote', text: '견적서' }),
          el('option', { value: 'contract', text: '계약서' })
        ]);
        docSel.value = r.doc === 'contract' ? 'contract' : 'quote';
        var typeSel = el('select', { 'aria-label': '업무 종류' }, T.map(function (t) { return el('option', { value: t.code, text: t.label }); }));
        typeSel.value = r.type || 'other';
        var dateIn = el('input', { type: 'date', 'aria-label': '날짜' }); dateIn.value = r.date || '';
        var coIn = el('input', { type: 'text', placeholder: '의뢰처(고객사)', 'aria-label': '의뢰처' }); coIn.value = r.co || '';
        var scopeIn = el('textarea', { rows: '3', placeholder: '과업 내용 요약', 'aria-label': '과업 내용' }); scopeIn.value = r.scope || '';
        var periodIn = el('input', { type: 'text', placeholder: '예: 3개월 / 2026.11~2027.10', 'aria-label': '수행 기간' }); periodIn.value = r.period || '';
        var staffIn = el('input', { type: 'text', placeholder: '숫자만(예: 50)', 'aria-label': '대상 인원' }); staffIn.value = typeof r.staff === 'number' ? String(r.staff) : '';
        var amtIn = el('input', { type: 'text', placeholder: '숫자만(예: 5000000)', 'aria-label': '금액' });
        amtIn.value = (amt && typeof amt.amount === 'number' && isFinite(amt.amount)) ? String(amt.amount) : '';
        var vatSel = el('select', { 'aria-label': '부가세' }, [
          el('option', { value: '', text: '미지정' }),
          el('option', { value: 'excl', text: '부가세 별도' }),
          el('option', { value: 'incl', text: '부가세 포함' })
        ]);
        vatSel.value = (amt && amt.vat) || '';
        var revSel = el('select', { 'aria-label': '검토 상태' }, [
          el('option', { value: 'ok', text: '확인 완료' }),
          el('option', { value: 'check', text: '확인 필요' })
        ]);
        revSel.value = r.review === 'check' ? 'check' : 'ok';

        function fg(labelTxt, inputNode) { return el('div', { 'class': 'pqv-fg' }, [el('label', { text: labelTxt }), inputNode]); }
        formBox.appendChild(el('b', { text: '✎ 견적·계약 정보 바로 고치기' }));
        formBox.appendChild(el('div', { 'class': 'pqv-frow2' }, [fg('구분', docSel), fg('업무 갈래', typeSel)]));
        formBox.appendChild(el('div', { 'class': 'pqv-frow2' }, [fg('날짜', dateIn), fg('검토 상태', revSel)]));
        formBox.appendChild(fg('의뢰처(업체·기관)', coIn));
        formBox.appendChild(fg('과업 내용', scopeIn));
        formBox.appendChild(el('div', { 'class': 'pqv-frow2' }, [fg('기간', periodIn), fg('대상 인원(명)', staffIn)]));
        formBox.appendChild(el('div', { 'class': 'pqv-frow2' }, [fg('금액(원)', amtIn), fg('부가세', vatSel)]));

        function collectPatch() {
          var rawAmt = String(amtIn.value || '').replace(/[,\s원₩]/g, '');
          var numStaff = String(staffIn.value || '').replace(/[,\s명]/g, '');
          var recPatch = {
            doc: docSel.value,
            type: typeSel.value,
            date: dateIn.value,
            co: String(coIn.value || '').trim(),
            scope: String(scopeIn.value || '').trim(),
            period: String(periodIn.value || '').trim(),
            review: revSel.value,
            staff: /^\d{1,6}$/.test(numStaff) ? Number(numStaff) : undefined
          };
          var amtPatch = {
            amount: rawAmt === '' ? '' : Number(rawAmt),
            vat: vatSel.value
          };
          return { recPatch: recPatch, amtPatch: amtPatch };
        }

        var saveBtns = [];
        if (canEditInPlace) {
          saveBtns.push(btn('💾 수정사항 저장', function () {
            var p = collectPatch();
            Promise.resolve(host.updateQuote(r.id, p.recPatch, p.amtPatch, false)).then(function () {
              toast('✓ 견적·계약 정보를 고쳤습니다');
              closeDetail(); load();
            }, function (e) {
              toast('저장 실패 — ' + ((e && e.message) || e));
            });
          }, 'pri'));
        }
        saveBtns.push(btn('📋 새 수정 견적 기록으로 복제 저장', function () {
          var p = collectPatch();
          Promise.resolve(host.updateQuote(r.id, p.recPatch, p.amtPatch, true)).then(function () {
            toast('✓ 새 수정 견적 기록으로 복제 저장했습니다');
            closeDetail(); load();
          }, function (e) {
            toast('복제 저장 실패 — ' + ((e && e.message) || e));
          });
        }, canEditInPlace ? '' : 'pri'));
        if (!canEditInPlace) {
          formBox.appendChild(el('div', { 'class': 'msg', text: '※ 다른 담당자가 등록한 원본 기록은 보존되며, 고친 내용은 새 수정 견적 기록으로 복제 저장됩니다.' }));
        }
        formBox.appendChild(el('div', { 'class': 'pqv-tools' }, saveBtns));
      } else {
        formBox.appendChild(el('b', { text: '📋 공개 기본 정보' }));
        formBox.appendChild(el('div', { 'class': 'msg', text: '의뢰처: ' + (r.co || NONE) }));
        formBox.appendChild(el('div', { 'class': 'msg', text: '과업 내용: ' + (r.scope || NONE) }));
        formBox.appendChild(el('div', { 'class': 'msg', text: '수행 기간: ' + (r.period || NONE) }));
      }

      var mbg = el('div', { 'class': 'pqv-mbg', role: 'dialog', 'aria-modal': 'true', 'aria-label': '견적·계약 참고 및 수정' }, [
        el('div', { 'class': 'pqv-modal' }, [
          el('div', { 'class': 'pqv-mh' }, [
            el('b', { text: (r.doc === 'contract' ? '📑 계약 상세 · ' : '💼 견적 상세 · ') + (r.co || '(의뢰처 미입력)') + ' (' + (r.date || '') + ')' }),
            btn('닫기 ✕', closeDetail)
          ]),
          barKids.length ? el('div', { 'class': 'pqv-mbar' }, barKids) : null,
          el('div', { 'class': 'pqv-mb' }, [prevBox, formBox])
        ])
      ]);
      mbg.addEventListener('click', function (e) { if (e.target === mbg) closeDetail(); });
      if (w.document && w.document.addEventListener) {
        var onKey = function (e) { if (e && e.key === 'Escape') closeDetail(); };
        w.document.addEventListener('keydown', onKey);
        escCleanup = function () { w.document.removeEventListener('keydown', onKey); };
      }
      return mbg;
    }

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
      var act = el('span', { 'class': 'c-act' });
      var coCell = cell('c-co', r.co || NONE);
      var scCell = cell('c-scope', scope);
      if (hasRich) {
        var allowed = canManage(r, amt, role, host.uid);
        var openDetail = function () { st.detailId = r.id; draw(); };
        var ab = btn(allowed ? '✏ 참고·수정' : '📝 양식 참고', openDetail, allowed ? 'sub' : '');
        ab.setAttribute('title', allowed ? '원본 미리보기·한글 수정·양식 채우기·정보 고치기' : '공개 정보로 표준 양식 채우기');
        act.appendChild(ab);
        coCell.setAttribute('role', 'button');
        coCell.setAttribute('tabindex', '0');
        coCell.addEventListener('click', openDetail);
        coCell.addEventListener('keydown', function (e) {
          if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(); }
        });
        scCell.addEventListener('click', openDetail);
      }
      var row = el('div', { 'class': 'pqv-row' + (hasRich ? ' clickable' : ''), role: 'row' }, [
        chk, el('span', { 'class': 'c-no pqv-no', text: String(no) }),
        cell('c-date', r.date || NONE), coCell, cell('c-doc', docTxt),
        scCell, cell('c-period', period), cell('c-staff', staff),
        cell(amtCls, amtTxt), cell('c-who', o.text), open, act, cell('c-meta pqv-meta', meta)
      ]);
      return row;
    }

    function draw() {
      unbindDetailEsc();
      root.innerHTML = '';
      impEl = null;
      var box = el('div', { 'class': 'pqv' });

      /* 가져오기 줄 — 총괄관리자만, 가져오는 길(importer)이 연결돼 있을 때만 */
      if (host.importer && role.isAdmin === true) {
        var impKids = [];
        var ib = btn('📥 보낸메일에서 가져오기', runImport, 'pri'); if (st.impBusy) ib.setAttribute('disabled', 'disabled');
        impKids.push(ib);
        if (typeof host.importer.runFast === 'function') {
          var fb = btn('⚡ 파일만 빠르게 모두 가져오기(AI 없이)', function () { runImportMode(true); });
          if (st.impBusy) fb.setAttribute('disabled', 'disabled');
          impKids.push(fb);
        }
        impEl = el('span', { 'class': 'msg', text: st.impMsg || '' });
        impKids.push(impEl);
        box.appendChild(el('div', { 'class': 'pqv-imp' }, impKids));
      }
      /* 📨 견적 자동 감지 줄 — 총괄관리자만, 켜고 끄는 길(host.watch)이 연결돼 있을 때만. 읽는 중(null)이면 단추를 못 누른다 */
      if (host.watch && role.isAdmin === true) {
        var wbtn = btn(st.watchOn ? '📨 자동 감지 끄기' : '📨 자동 감지 켜기', toggleWatch);
        if (st.watchBusy || st.watchOn === null) wbtn.setAttribute('disabled', 'disabled');
        var wmsg = st.watchOn === null ? '켜짐 여부를 확인하는 중…'
          : (st.watchOn ? '켜짐 — 보낸메일함에 견적서·계약서가 나가면 이알피에 요청이 올라갑니다(이알피를 열 때 반영, 금액은 올라가지 않음)'
            : '꺼짐 — 지금은 자동으로 올리지 않습니다');
        box.appendChild(el('div', { 'class': 'pqv-imp pqv-watch' }, [wbtn, el('span', { 'class': 'msg', text: wmsg })]));
      }

      if (st.err) {
        box.appendChild(el('div', { 'class': 'empty', text: '지난 견적·계약을 불러오지 못했습니다.' }));
        box.appendChild(btn('다시 불러오기', load));
        root.appendChild(box); return;
      }
      if (st.rows === null) { box.appendChild(el('div', { 'class': 'empty', text: '불러오는 중…' })); root.appendChild(box); return; }
      if (!st.rows.length) {
        box.appendChild(el('div', { 'class': 'empty', text: '아직 모아 둔 견적·계약이 없습니다.' }));
        if (typeof host.createNew === 'function') {
          box.appendChild(el('div', { 'class': 'pqv-tools', style: 'justify-content:center' }, [btn('+ 새 견적서 작성·올리기', function () { host.createNew(load); }, 'pri')]));
        }
        root.appendChild(box); return;
      }

      /* 거르기 — 글자(의뢰처·과업 내용) · 견적/계약 · 확인 필요 · 업무 갈래 */
      var search = el('input', { type: 'search', placeholder: '의뢰처·과업 내용 찾기', 'aria-label': '의뢰처·과업 내용 찾기' });
      search.value = st.text;
      search.addEventListener('input', function () { st.text = search.value; redrawKeepFocus(); });
      var allOn = ordered().length > 0 && ordered().every(function (r) { return st.sel[r.id]; });
      var selAll = el('label', { 'class': 'pqv-selall' }, [checkbox(allOn, '보이는 것 모두 고르기', toggleAllVisible), el('span', { text: '모두 고르기' })]);
      function chip(label, on, fn) { var b = el('button', { type: 'button', 'class': 'chip' + (on ? ' on' : ''), text: label }); b.addEventListener('click', fn); return b; }
      var toolKids = [
        search,
        chip('전체', !st.doc && !st.review, function () { st.doc = ''; st.review = ''; draw(); }),
        chip('견적', st.doc === 'quote', function () { st.doc = st.doc === 'quote' ? '' : 'quote'; draw(); }),
        chip('계약', st.doc === 'contract', function () { st.doc = st.doc === 'contract' ? '' : 'contract'; draw(); }),
        canSeeAll ? chip('확인 필요', st.review === 'check', function () { st.review = st.review === 'check' ? '' : 'check'; draw(); }) : null,
        /* 목록은 열 때 한 번만 읽는다(비용 절감) — 다른 직원이 넣은 것은 눌러서 다시 받는다 */
        btn('🔄 새로고침', function () { st.sel = {}; load(); }),
        typeof host.createNew === 'function' ? btn('+ 새 견적서 작성·올리기', function () { host.createNew(load); }, 'grn') : null,
        selAll
      ];
      box.appendChild(el('div', { 'class': 'pqv-tools' }, toolKids));

      /* 업무 갈래 빠른 거르기 칩 — 괴롭힘 조사·산업안전·자문 등 원하는 갈래만 한 번에 모아 보기 */
      if (hasRich) {
        var baseGroups = groupByType(filterRows(st.rows || [], { text: st.text, doc: st.doc, review: st.review }), host.types);
        if (baseGroups.length > 1 || st.type) {
          var tchips = [chip('전체 갈래', !st.type, function () { st.type = ''; draw(); })];
          baseGroups.forEach(function (g) {
            tchips.push(chip(g.label + ' (' + g.rows.length + ')', st.type === g.code, function () { st.type = st.type === g.code ? '' : g.code; draw(); }));
          });
          box.appendChild(el('div', { 'class': 'pqv-tchips' }, tchips));
        }
      }
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
          el('span', { text: '기간' }), el('span', { text: '인원' }), el('span', { text: '금액' }), el('span', { text: '담당' }),
          el('span', { text: '' }), el('span', { text: hasRich ? '참고·수정' : '' })
        ]);
        var list = el('div', { 'class': 'pqv-list', role: 'table' }, [head]);
        groups.forEach(function (g) {
          list.appendChild(el('div', { 'class': 'pqv-g' }, [el('span', { text: g.label }), el('i', { text: g.rows.length + '건' })]));
          g.rows.forEach(function (r) { no++; list.appendChild(rowEl(r, no)); });
        });
        box.appendChild(el('div', { 'class': 'pqv-wrap' }, [list]));
      }
      if (st.detailId) {
        var curRow = (st.rows || []).filter(function (x) { return x.id === st.detailId; })[0];
        if (curRow) box.appendChild(detailModal(curRow));
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
    /* 자동 감지가 켜졌는지는 «화면을 열 때» 한 번 읽는다 — 총괄관리자에게만 보이는 줄이다 */
    if (host.watch && typeof host.watch.get === 'function' && role.isAdmin === true) {
      Promise.resolve().then(function () { return host.watch.get(); }).then(function (v) { st.watchOn = v === true; draw(); },
        function () { st.watchOn = null; draw(); });
    }
    return {
      reload: load,
      clearSelection: function () { if (selIds().length || st.detailId) { st.sel = {}; st.pick = ''; st.detailId = ''; draw(); } },
      selected: selIds
    };
  }

  w.PuQuotesView = { mount: mount, groupByType: groupByType, amountText: amountText, ownerInfo: ownerInfo, canOpen: canOpen, canManage: canManage,
    filterRows: filterRows, importResultText: importResultText };
})(typeof window !== 'undefined' ? window : this);
