/* ══ 문서관리 › 사무관리서류 — 원본 보관함 · 기업별 계약서 화면 (대표 지시 2026-09-26) ══
   설계: docs/superpowers/specs/2026-09-27-사무관리서류-개편-design.md §3-3·§3-4·§5
   저장은 js/pu-office-store.js 가 한다 — 이 파일은 그리기만 한다.
   ⚠ 사용자 값(파일명·회사명·제목)은 el(…, {text}) 로만 넣는다. innerHTML 은 비울 때('')만 쓴다. */
(function (w) {
  'use strict';

  function el(tag, attrs, kids) {
    var n = w.document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'style') n.style.cssText = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? w.document.createTextNode(c) : c);
    });
    return n;
  }
  var _toastT = null;
  function toast(msg) {
    var old = w.document.querySelector('.pod-toast'); if (old) old.remove();
    clearTimeout(_toastT);
    var t = el('div', { 'class': 'pod-toast', role: 'status', text: msg });
    w.document.body.appendChild(t);
    _toastT = setTimeout(function () { t.remove(); }, 3500);
  }
  function fmtSize(n) { n = n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function ymd(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function msg(e) { return (e && e.message) || String(e); }
  /* ══ 회사 맞추기·합치기 (설계 2026-09-27 사무관리서류 §8 후속, 대표 「진행」 2026-10-04) — 순수 함수 ══
     기업별 계약서의 회사(pu_docs/co/{열쇠})는 «이름»으로만 묶여 있다 — 「가나상사」와 「가나상사(천안)」은 다른 회사가 된다.
     ① 사업자번호가 없는 회사에 이알피 업체·기업정보함 사업자등록증의 번호를 «이름이 같을 때» 짐작해 넣는다(사람이 확인).
     ② 사업자번호가 같은 회사들은 하나로 합칠 수 있다. 회사 화면에서 손으로 고른 회사와도 합칠 수 있다. */
  function bzDigits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function fmtBz(s) { var d = bzDigits(s); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : d; }
  function nameKey(s) {
    return String(s || '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').replace(/\s+/g, '').toLowerCase();
  }
  /* cos: listCo 줄, refs: PuFormCardFill.mergeRows 줄({k:'erp'|'biz'|'card', c, bz}) → 사업자번호 짐작.
     state: 'have'(이미 있음) | 'found'(이름이 같은 이알피·사업자등록증 줄) | 'none' */
  function linkPlan(cos, refs) {
    var byName = {};
    (refs || []).forEach(function (r) {
      if (!r || (r.k !== 'erp' && r.k !== 'biz') || bzDigits(r.bz).length !== 10) return;
      var n = nameKey(r.c);
      if (n && (!byName[n] || (byName[n].k !== 'erp' && r.k === 'erp'))) byName[n] = r;
    });
    return (cos || []).map(function (c) {
      if (bzDigits(c.bz).length === 10) return { key: c.key, name: c.name, bz: bzDigits(c.bz), state: 'have' };
      var hit = byName[nameKey(c.name)];
      if (!hit) return { key: c.key, name: c.name, bz: '', state: 'none' };
      return { key: c.key, name: c.name, bz: bzDigits(hit.bz), state: 'found', refName: String(hit.c || ''), from: hit.k === 'erp' ? '이알피 업체' : '사업자등록증' };
    });
  }
  /* 사업자번호 → 이알피 업체 이름(없으면 사업자등록증 이름) — 합칠 때 «남길 이름»의 기준 */
  function refNames(refs) {
    var out = {};
    (refs || []).forEach(function (r) {
      var d = r && bzDigits(r.bz);
      if (!d || d.length !== 10 || (r.k !== 'erp' && r.k !== 'biz')) return;
      if (!out[d] || (r.k === 'erp' && out[d].k !== 'erp')) out[d] = { k: r.k, c: String(r.c || '') };
    });
    Object.keys(out).forEach(function (d) { out[d] = out[d].c; });
    return out;
  }
  /* 사업자번호가 같은 회사 묶음(둘 이상). 묶음 맨 앞 = 합칠 때 남는 쪽:
     ⓐ 이름이 이알피 업체 이름과 같은 회사(앞으로 앱에서 보내고 올리는 서류는 그 이름으로 들어온다 — 다른 쪽을 남기면 다시 따로 생긴다)
     ⓑ 그다음 줄이 많은 회사 */
  function bzGroups(cos, names) {
    var by = {};
    names = names || {};
    (cos || []).forEach(function (c) { var d = bzDigits(c.bz); if (d.length === 10) (by[d] = by[d] || []).push(c); });
    return Object.keys(by).filter(function (d) { return by[d].length > 1; }).map(function (d) {
      var official = nameKey(names[d] || '');
      function rank(c) { return official && nameKey(c.name) === official ? 1 : 0; }
      return { bz: d, official: names[d] || '', cos: by[d].slice().sort(function (a, b) {
        return rank(b) - rank(a) || ((b.n || 0) + (b.r || 0)) - ((a.n || 0) + (a.r || 0)) || String(a.name).localeCompare(String(b.name)); }) };
    });
  }
  /* 합치기 한 번에 — pu_docs 아래 «여러 자리 한 번 쓰기»(update) 모양. 반쯤 합쳐진 채로 남지 않게 한 번에 쓴다.
     ⚠ 규칙상 줄의 by 는 «지금 쓰는 사람»이어야 한다 — 옮긴 줄은 합친 사람 이름으로 바뀐다(at·나머지 값은 그대로).
     ⚠ 파일(originals)은 건드리지 않는다. 계약 기록의 docId(파일 줄 번호)는 줄 번호를 그대로 쓰므로 이어진다. */
  var DOC_FIELDS = ['fileId', 'title', 'date', 'src', 'secret', 'kind', 'at'];
  var REC_FIELDS = ['date', 'kind', 'amount', 'payDay', 'tax', 'edi', 'staff', 'contact', 'bizNo', 'note', 'docId', 'src', 'at'];
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o && o[k] != null && o[k] !== '') r[k] = o[k]; }); return r; }
  function mergePlan(fromKey, toKey, d, me, now) {
    if (!fromKey || !toKey || fromKey === toKey) throw new Error('합칠 두 회사가 같습니다');
    d = d || {}; me = me || {};
    if (!d.to) throw new Error('남길 회사를 찾지 못했습니다');
    if (!me.uid) throw new Error('로그인한 계정을 알 수 없습니다');
    var up = {}, by = { by: me.uid, byName: String(me.name || '').slice(0, 60) };
    var fd = d.fromDocs || {}, fr = d.fromRecs || {};
    Object.keys(fd).forEach(function (id) {
      if (!fd[id] || !fd[id].fileId) return;
      var x = Object.assign(pick(fd[id], DOC_FIELDS), by);
      if (x.secret !== true) delete x.secret;
      up['co_docs/' + toKey + '/' + id] = x;
    });
    Object.keys(fr).forEach(function (id) { if (fr[id]) up['co_recs/' + toKey + '/' + id] = Object.assign(pick(fr[id], REC_FIELDS), by); });
    up['co_docs/' + fromKey] = null;
    up['co_recs/' + fromKey] = null;
    up['co/' + fromKey] = null;
    var n = Object.keys(d.toDocs || {}).length + Object.keys(fd).filter(function (id) { return fd[id] && fd[id].fileId; }).length;
    var r = Object.keys(d.toRecs || {}).length + Object.keys(fr).filter(function (id) { return fr[id]; }).length;
    var co = { name: String(d.name || d.to.name || toKey).slice(0, 120), n: n, r: r, lastAt: now || Date.now() };
    var bz = bzDigits(d.to.bz) || bzDigits(d.from && d.from.bz);
    if (bz) co.bz = bz.slice(0, 12);
    up['co/' + toKey] = co;
    return up;
  }
  /* ══ 파일 골라 다시 보내기 (대표 「파일 골라 다시 보내기」 2026-10-04 — 2026-09-23 미뤄 둔 「계약서/견적서 찾아 메일로 보내기」) ══ */
  /* 받는 사람 후보 — 기업정보함·이알피 줄(PuFormCardFill.mergeRows)에서 그 회사의 명함(메일 있는 사람)과 대표 메일 */
  function mailTargets(rows, coName, bz) {
    rows = rows || [];
    var d = bzDigits(bz), nk = nameKey(coName), co = null;
    if (d.length === 10) co = rows.filter(function (r) { return (r.k === 'erp' || r.k === 'biz') && bzDigits(r.bz) === d; })[0] || null;
    if (!co && nk) co = rows.filter(function (r) { return (r.k === 'erp' || r.k === 'biz') && nameKey(r.c) === nk; })[0] || null;
    var keys = {}; keys[nk] = 1; if (co) keys[nameKey(co.c)] = 1;
    var to = [], seen = {};
    function add(v, label, who) {
      v = String(v || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || seen[v.toLowerCase()]) return;
      seen[v.toLowerCase()] = 1; to.push({ v: v, label: label + ' · ' + v, who: who || '' });
    }
    rows.forEach(function (r) {
      if (r.k === 'card' && r.n && keys[nameKey(r.c)]) add(r.e, r.n + (r.ti ? ' ' + r.ti : ''), r.n);
    });
    if (co) add(co.e, '대표 메일', '');
    return { co: co, to: to };
  }
  /* 보낸 기록의 종류 — 기업정보함 「보낸 서류」 종류(SENT_KINDS) 안에서 */
  function sentKindOf(titles) {
    var t = (titles || []).join(' ');
    if (/제안서|견적서/.test(t)) return '제안서';
    if (/계약|약정|위임|CMS|EDI|신청서/i.test(t)) return '계약서';
    return '그 밖';
  }
  function resendMail(coName, who, titles) {
    var list = (titles || []).filter(Boolean);
    return {
      subject: '[푸른노무법인] ' + (list.length <= 1 ? (list[0] || '서류') : list[0] + ' 외 ' + (list.length - 1) + '건') + (coName ? ' — ' + coName : ''),
      body: [(who ? who + '님' : '담당자님') + ', 안녕하십니까.', '푸른노무법인입니다.', '', '요청하신 서류를 보내드립니다.']
        .concat(list.map(function (t) { return '- ' + t; }))
        .concat(['', '검토하시고 궁금하신 점은 편하게 연락 주십시오.', '', '푸른노무법인 드림']).join('\n')
    };
  }
  /* 보낸 서류 — 열쇠(사업자번호·이름)마다 읽은 줄을 합친다. 한 번 보낼 때 열쇠마다 같은 at 으로 적으므로
     at·종류·서류 이름이 같으면 한 줄. 최근 위, 50줄까지 */
  function sentRows(lists) {
    var seen = {}, out = [];
    (lists || []).forEach(function (l) {
      (l || []).forEach(function (r) {
        if (!r || !r.at) return;
        var names = Array.isArray(r.names) ? r.names.map(String) : [];
        var k = r.at + '|' + (r.kind || '') + '|' + names.join('/');
        if (seen[k]) return;
        seen[k] = 1;
        out.push({ at: +r.at, kind: String(r.kind || '그 밖'), names: names, who: String(r.who || ''), by: String(r.by || '').split('@')[0] });
      });
    });
    return out.sort(function (a, b) { return b.at - a.at; }).slice(0, 50);
  }

  /* ══ 📬 서명본 대기 (대표 「추천대로」 2026-10-07, 목업 승인) — 순수 함수 ══
     list: PuOfficeStore.listAwait 줄. 대기 = got 없음(오래된 것 위), 최근 회수 = got 이 30일 안(최근 위).
     days = 보낸 날부터 지난 날수(달력 날짜로), late = 14일 넘음(빨강) */
  var AWAIT_LATE = 14, AWAIT_DONE_DAYS = 30;
  function dayNo(ts) { var d = new Date(ts); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
  function awaitView(list, now) {
    now = now || Date.now();
    var wait = [], done = [];
    (list || []).forEach(function (a) {
      if (!a || !a.at) return;
      var days = Math.max(0, dayNo(now) - dayNo(a.at));
      var r = { key: a.key, name: a.name, bz: a.bz || '', at: a.at, how: a.how || '메일', names: a.names || [], byName: a.byName || '',
        remindAt: a.remindAt || 0, got: a.got || 0, gotDoc: a.gotDoc || '', days: days, late: days > AWAIT_LATE };
      if (!a.got) wait.push(r);
      else if (dayNo(now) - dayNo(a.got) <= AWAIT_DONE_DAYS) done.push(r);
    });
    wait.sort(function (x, y) { return x.at - y.at; });
    done.sort(function (x, y) { return y.got - x.got; });
    return { wait: wait, done: done };
  }
  /* 보낸 서류 이름 → 계약 기록 종류(KINDS) 짐작. 묶음은 «가장 앞선» 계약서 이름으로 — 사람이 고친다 */
  var AWAIT_KIND_RE = [[/급여/, '급여관리'], [/기금/, '기금'], [/컨설팅/, '컨설팅'], [/위임|사건/, '사건'], [/자문|노동조합|노조/, '자문'], [/사무\s*(대행|위탁)|EDI/i, 'EDI'], [/CMS|자동\s*출금|자동\s*이체/i, 'CMS']];
  function awaitKindOf(names) {
    var list = names || [];
    for (var i = 0; i < AWAIT_KIND_RE.length; i++) {
      for (var j = 0; j < list.length; j++) if (AWAIT_KIND_RE[i][0].test(String(list[j] || ''))) return AWAIT_KIND_RE[i][1];
    }
    return '자문';
  }
  function remindText(a) {
    return { subject: '[푸른노무법인] 계약서 서명본 회신 부탁드립니다' + (a.name ? ' — ' + a.name : ''),
      body: ['담당자님, 안녕하십니까.', '푸른노무법인입니다.', '', ymd(a.at) + '에 보내드린 계약서류의 서명(날인)본을 아직 받지 못하여 연락드립니다.']
        .concat((a.names || []).slice(0, 8).map(function (t) { return '- ' + t; }))
        .concat(['', '서명하신 서류를 스캔(또는 사진)하여 회신 메일로 보내 주시면 감사하겠습니다.', '', '푸른노무법인 드림']).join('\n') };
  }

  var CSS = ''
    + '.pod,.pod *{box-sizing:border-box}.pod{font-size:13px;color:#1e293b}'
    + '.pod-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}'
    + '.pod-bar b{flex:1 1 auto;font-size:15px;white-space:nowrap}'
    + '.pod-bar input[type=search]{padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;width:200px;max-width:100%}'
    + '.pod-b{border:1px solid #cbd5e1;background:#f8fafc;color:#475569;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.pod-b.p{background:#1e40af;color:#fff;border-color:#1e40af}.pod-b.g{background:#f0fdf4;color:#166534;border-color:#bbf7d0}'
    + '.pod-note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;padding:9px 12px;font-size:12.5px;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '.pod-warn{background:#fffbeb;border:1px solid #fde68a;color:#854d0e}'
    + '.pod table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + '.pod th,.pod td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pod th{background:#f8fafc;color:#475569;font-size:11.5px}'
    + '.pod td.gone{color:#b45309}'
    /* 원본 보관함 — 틀 고정(머리는 그대로, 표만 스크롤·표 머리줄 고정)·☐·#·오른쪽 미리보기 (대표 2026-10-07) */
    + '.pod-arc{display:flex;gap:12px;align-items:flex-start}'
    + '.pod-arc-l{flex:1;min-width:0}'
    + '.pod-arc-scroll{max-height:calc(100vh - 300px);min-height:240px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px}'
    + '.pod-arc-scroll thead th{position:sticky;top:0;z-index:1;box-shadow:0 1px 0 #e5e7eb}'
    + '.pod-arc-scroll tbody tr{cursor:pointer}.pod-arc-scroll tbody tr:hover td{background:#f8fafc}'
    + '.pod-arc-scroll tbody tr.on td{background:#dbeafe}'
    + '.pod-arc-r{width:46%;flex:none;position:sticky;top:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;display:flex;flex-direction:column;max-height:calc(100vh - 180px)}'
    + '.pod-arc-rh{display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #e5e7eb}'
    + '.pod-arc-rh b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}'
    + '.pod-arc-rb{flex:1;overflow:auto;padding:10px;background:#f8fafc;min-height:300px}'
    + '.pod-arc-rb img{max-width:100%}.pod-arc-rb iframe{width:100%;height:calc(100vh - 260px);border:none;background:#fff}'
    /* 기업별 계약서 — 위 단추 줄·회사 이름은 그대로, 회사 목록·내용은 그 안에서 스크롤(표 머리줄 고정) (2026-10-07) */
    + '.pod-co-l{max-height:calc(100vh - 240px);display:flex;flex-direction:column}.pod-co-l .pod-co-ls{flex:1;overflow-y:auto}'
    + '.pod-co-r{flex:1;min-width:0;max-height:calc(100vh - 240px);overflow:auto;padding-right:2px}'
    + '.pod-co-r .pod-rt thead th{position:sticky;top:0;z-index:1;box-shadow:0 1px 0 #e5e7eb}'
    + '.pod-co-r tr.pick{cursor:pointer}.pod-co-r tr.pick:hover td{background:#f8fafc}.pod-co-r tr.pick.on td{background:#dbeafe}'
    + '.pod-co .pod-arc-r{width:40%}'
    + '@media(max-width:900px){.pod-co-l,.pod-co-r{max-height:none}.pod-co .pod-arc-r{width:auto}}'
    + '.pod-fil{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:12px;color:#475569}'
    + '.pod-fil select{padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff}'
    + '@media(max-width:900px){.pod-arc{display:block}.pod-arc-r{width:auto;position:static;margin-top:12px;max-height:none}.pod-arc-scroll{max-height:60vh}}'
    + '.pod-empty{color:#94a3b8;text-align:center;padding:40px;border:1px dashed #e2e8f0;border-radius:8px}'
    + '.pod-co{display:flex;gap:12px;align-items:flex-start}'
    + '.pod-cl{width:220px;flex:none;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff}'
    + '.pod-cl button{display:flex;justify-content:space-between;gap:8px;width:100%;border:none;border-bottom:1px solid #f1f5f9;background:none;padding:8px 10px;cursor:pointer;font-family:inherit;font-size:12.5px;text-align:left}'
    + '.pod-cl button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pod-cl button i{font-style:normal;color:#94a3b8;font-size:11px}'
    + '.pod-cl button:hover{background:#eff6ff}.pod-cl button.on{background:#bfdbfe;color:#1e40af;font-weight:700}'
    + '.pod-grid{flex:1;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}'
    + '.pod-card{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;cursor:pointer;text-align:left;padding:0;font-family:inherit}'
    + '.pod-card:hover{border-color:#93c5fd}'
    + '.pod-th{height:110px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;color:#94a3b8;overflow:hidden}'
    + '.pod-th img{width:100%;height:100%;object-fit:cover}'
    + '.pod-cm{padding:7px 9px}.pod-cm b{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pod-cm span{font-size:11px;color:#94a3b8}'
    + '.pod-tag{display:inline-block;border-radius:9px;padding:0 6px;font-size:10.5px;font-weight:700;margin-left:4px}'
    + '.pod-tag.ph{background:#fae8ff;color:#86198f}.pod-tag.up{background:#e0f2fe;color:#075985}.pod-tag.done{background:#dcfce7;color:#166534}'
    + '.pod-mbg{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.pod-m{background:#fff;border-radius:12px;width:860px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden}'
    + '.pod-mh{padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;font-weight:700}'
    + '.pod-mh span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pod-mb{padding:14px 16px;overflow-y:auto;flex:1}.pod-mf{padding:10px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}'
    + '.pod-mb label{display:block;font-size:12px;font-weight:700;color:#475569;margin:10px 0 4px}'
    + '.pod-mb input[type=text],.pod-mb input[type=date]{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit}'
    + '.pod-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}'
    + '.pod-pick .pod-card.sel{outline:3px solid #2563eb}'
    /* 계약 기록 표 (2026-10-03) */
    + '.pod .pod-rt,.pod-m .pod-rt{width:100%;border-collapse:collapse;table-layout:auto;margin-bottom:12px}'
    + '.pod-rt th,.pod-rt td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12.5px;text-align:left;white-space:nowrap}'
    + '.pod-rt th{color:#64748b;font-weight:600;background:#f8fafc}'
    + '.pod-rt tr.click td{cursor:pointer}.pod-rt tr.click:hover td{background:#eff6ff}'
    + '.pod-rt td.amt{text-align:right}.pod-rt .muted{color:#94a3b8}'
    + '.pod-kd{display:inline-block;background:#eff6ff;color:#1e40af;border-radius:9px;padding:0 8px;font-size:11.5px;font-weight:600}'
    + '.pod-imp{max-height:52vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px}'
    + '.pod-imp .ok{color:#166534}.pod-imp .new{color:#854d0e}.pod-imp .dup{color:#94a3b8}'
    + '.pod-mb select{padding:7px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit}'
    /* 📬 서명본 대기 (2026-10-07) */
    + '.pod-tabs{display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid #e2e8f0}'
    + '.pod-tabs button{border:none;background:none;padding:8px 14px;font:inherit;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}'
    + '.pod-tabs button.on{color:#1e40af;border-bottom-color:#1e40af}'
    + '.pod-tabs i{font-style:normal;background:#fee2e2;color:#991b1b;border-radius:9px;padding:0 7px;margin-left:5px;font-size:11px}'
    + '.pod-aw td.late{color:#dc2626;font-weight:700}.pod-aw td.nm{white-space:normal;min-width:160px;word-break:keep-all;overflow-wrap:anywhere}'
    + '.pod-drop{border:2px dashed #93c5fd;border-radius:10px;background:#eff6ff;color:#1e40af;text-align:center;padding:22px 12px;cursor:pointer;font-size:13px}'
    + '.pod-drop.on{background:#dbeafe;border-color:#2563eb}'
    /* 갈래별 정리 (2026-10-09) */
    + '.pod-kchips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px}'
    + '.pod-kchip{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:14px;padding:3px 11px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.pod-kchip.on{background:#1e40af;color:#fff;border-color:#1e40af}.pod-kchip.g{color:#166534;border-color:#bbf7d0}.pod-kchip.r{color:#b91c1c;border-color:#fecaca}.pod-kchip.a{color:#92400e;border-color:#fde68a}'
    + '.pod-kchip.on.g,.pod-kchip.on.r,.pod-kchip.on.a{color:#fff}'
    + '.pod-kbox{display:grid;gap:8px;margin-bottom:12px}'
    + '.pod-kcard{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;background:#fff}.pod-kcard.dim{opacity:.55}'
    + '.pod-kh{display:flex;gap:8px;align-items:center;margin-bottom:4px}.pod-kh b{flex:1;font-size:13px}.pod-kh span{font-size:11.5px;color:#64748b}'
    + '.pod-krow{display:flex;gap:8px;align-items:center;padding:3px 0;border-top:1px dashed #f1f5f9;font-size:12.5px}'
    + '.pod-kt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pod-ks{font-size:11.5px;white-space:nowrap}.pod-ks.ok{color:#166534}.pod-ks.missing{color:#b91c1c}.pod-ks.norec,.pod-ks.none{color:#92400e}'
    + '.pod-krow .pod-b{padding:2px 8px;font-size:11px}'
    + '.pod-sgst{display:inline-block;border-radius:9px;padding:0 8px;font-size:11.5px;font-weight:600;background:#f1f5f9;color:#475569}'
    + '.pod-sgst.seen{background:#dbeafe;color:#1e40af}.pod-sgst.submitted{background:#ede9fe;color:#5b21b6}.pod-sgst.saved{background:#dcfce7;color:#166534}'
    + '.pod-sgst.expired,.pod-sgst.void{background:#fee2e2;color:#991b1b}'
    + '.pod-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:1400}'
    + '@media(max-width:700px){.pod-co{display:block}.pod-cl{width:auto;margin-bottom:10px;max-height:30vh;overflow-y:auto}.pod-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pod th:nth-child(5),.pod td:nth-child(5){display:none}}';
  function css() {
    if (w.document.getElementById('pod-css')) return;
    var st = w.document.createElement('style'); st.id = 'pod-css'; st.textContent = CSS; w.document.head.appendChild(st);
  }
  function deniedBanner() {
    return el('div', { 'class': 'pod-note pod-warn' }, ['⚠ 파일 창고 규칙이 아직 게시되지 않았습니다 — 대표님이 규칙을 게시하시면 이 화면이 열립니다. (계약서 양식 화면은 지금도 그대로 쓰실 수 있습니다)']);
  }

  /* ── 보관함 줄 모양 (화면 없이 검사한다) ── */
  function archiveRows(originals, forms) {
    var byId = {};
    (forms || []).forEach(function (f) { byId[f.id] = f; });
    return (originals || []).slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).map(function (r) {
      var fr = r.from || {}, link = '', gone = false;
      if (fr.kind === 'form') {
        var f = byId[fr.formId];
        link = f ? f.name : (fr.formName || '양식');
        gone = !f;
        if (gone) link += ' — 양식 삭제됨 · 사본만 남음';
      } else if (fr.kind === 'co') link = '기업 · ' + (fr.coName || '');
      else if (fr.kind === 'photo') link = '기업 · ' + (fr.coName || '') + ' (사진첩)';
      else if (fr.kind === 'folder') link = '기업 · ' + (fr.coName || '') + ' (PC 폴더)';
      return { id: r.id, name: r.name, size: r.size, at: r.at, byName: r.byName || '', link: link, gone: gone, rec: r,
        kind: fr.kind || '', type: fileType(r.name), secret: !!r.secret };
    });
  }
  /* 파일 형식 — 걸러 보기·미리보기 갈래 */
  function fileType(name) {
    var n = String(name || '').toLowerCase();
    if (/\.pdf$/.test(n)) return 'pdf';
    if (/\.(hwp|hwpx)$/.test(n)) return 'hwp';
    if (/\.(xlsx|xls|xlsm|csv)$/.test(n)) return 'xlsx';
    if (/\.(jpe?g|png|gif|webp|heic|bmp)$/.test(n)) return 'img';
    if (/\.(docx?|pptx?)$/.test(n)) return 'doc';
    return 'etc';
  }
  var ARC_KINDS = [['form', '계약서 양식'], ['co', '기업별 계약서'], ['photo', '사진첩'], ['folder', 'PC 폴더']];
  var ARC_TYPES = [['pdf', 'PDF'], ['hwp', '한글'], ['xlsx', '엑셀'], ['img', '그림'], ['doc', '워드·PPT'], ['etc', '그 밖']];
  /* 원본 보관함 걸러 보기 — f: { q, kind, type, by } (빈 값 = 전체) */
  function filterArchive(rows, f) {
    f = f || {};
    var q = String(f.q || '').trim().toLowerCase();
    return (rows || []).filter(function (r) {
      if (f.kind && r.kind !== f.kind) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.by && r.byName !== f.by) return false;
      return !q || (r.name + ' ' + r.link).toLowerCase().indexOf(q) >= 0;
    });
  }
  /* 기업별 계약서 — 회사 목록 거르기(f: ''|'recs'|'files'|'nobz') · 파일 거르기(src: ''|'upload'|'photo'|'folder') */
  var CO_FILTERS = [['recs', '계약 기록 있음'], ['files', '파일 있음'], ['nobz', '사업자번호 없음']];
  /* ══ 갈래별 정리 (대표 2026-10-09 「기업별 계약서 사무관리의 내용대로 분류하고 정리 … 사건 컨설팅등 각각 구분」) ══
     계약 기록 종류(PuCoRoster.KINDS) → 사무관리 갈래(계약서 양식 왼쪽 나무와 같은 말).
     파일 종류: 이어진 계약 기록 > 파일에 정해 둔 종류(kind) > 제목 짐작(PuCoRoster.guessKind) > 미분류.
     상태: ok(기록+파일) · missing(기록만 — 서명본 회수 필요) · norec(파일만 — 기록 만들기) */
  var KIND_GROUPS = [
    { v: 'company', label: '업체계약', icon: '🏢', kinds: ['자문', '급여관리', 'CMS', 'EDI'] },
    { v: 'case', label: '사건계약', icon: '⚖️', kinds: ['사건'] },
    { v: 'consulting', label: '컨설팅계약', icon: '📊', kinds: ['컨설팅'] },
    { v: 'fund', label: '기금관리', icon: '🏦', kinds: ['기금'] },
    { v: 'consult', label: '상담·제안', icon: '📞', kinds: ['제안서'] },
    { v: 'other', label: '기타사업', icon: '📋', kinds: ['기타'] }];
  function groupOfKind(k) {
    for (var i = 0; i < KIND_GROUPS.length; i++) if (KIND_GROUPS[i].kinds.indexOf(k) >= 0) return KIND_GROUPS[i].v;
    return '';
  }
  function guessDocKind(title) { return (w.PuCoRoster && w.PuCoRoster.guessKind) ? (w.PuCoRoster.guessKind(title) || '') : ''; }
  function asList(o) { return Object.keys(o || {}).map(function (id) { var x = Object.assign({}, o[id]); x.id = id; return x; }); }
  /* 한 회사 — recs/docs 는 배열(id 있음). 반환 { items:[{type, group, kind, date, title, state, rec, doc}], n:{ok,missing,norec,none}, groups:{v:개수} } */
  function coSort(recs, docs) {
    var byId = {}, used = {}, items = [], n = { ok: 0, missing: 0, norec: 0, none: 0 }, groups = {};
    (docs || []).forEach(function (d) { if (d && d.id) byId[d.id] = d; });
    (recs || []).forEach(function (r) {
      if (!r) return;
      var d = r.docId && byId[r.docId], g = groupOfKind(r.kind) || 'other';
      if (d) used[d.id] = 1;
      var st = d ? 'ok' : 'missing';
      items.push({ type: 'rec', group: g, kind: r.kind || '기타', date: r.date || '', title: d ? (d.title || '계약서') : (r.kind || '계약') + ' 계약', state: st, rec: r, doc: d || null });
      n[st]++; groups[g] = (groups[g] || 0) + 1;
    });
    (docs || []).forEach(function (d) {
      if (!d || used[d.id]) return;
      var k = d.kind || guessDocKind(d.title), g = groupOfKind(k);
      items.push({ type: 'doc', group: g, kind: k, guessed: !d.kind && !!k, date: d.date || '', title: d.title || '계약서', state: g ? 'norec' : 'none', rec: null, doc: d });
      n[g ? 'norec' : 'none']++; if (g) groups[g] = (groups[g] || 0) + 1;
    });
    items.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return { items: items, n: n, groups: groups };
  }
  /* 「+ 기록 만들기」 전에 — 같은 종류의 «✗ 파일 없음» 기록이 있으면 그 기록(같은 날짜 먼저, 아니면 가장 가까운 날짜).
     ⚠ 예전엔 늘 새 기록을 만들어, 파일 없는 기록 옆에 같은 계약이 한 줄 더 생겼다(검토 2026-10-09) */
  function linkableRec(items, it) {
    if (!it || !it.doc) return null;
    var dayOf = function (d) { var t = Date.parse(d); return isFinite(t) ? t : null; };
    var c = (items || []).filter(function (x) { return x && x.state === 'missing' && x.rec && x.rec.id && x.kind === (it.kind || '기타'); });
    if (!c.length) return null;
    var same = c.filter(function (x) { return x.date && x.date === it.date; })[0];
    if (same) return same;
    var t0 = dayOf(it.date);
    if (t0 == null) return c.length === 1 ? c[0] : null;
    return c.slice().sort(function (a, b) {
      var da = dayOf(a.date), db = dayOf(b.date);
      return (da == null ? Infinity : Math.abs(da - t0)) - (db == null ? Infinity : Math.abs(db - t0));
    })[0];
  }
  /* 모든 회사 — { 열쇠: coSort 결과 } (pu_docs/co_recs·co_docs 원본 모양) */
  function coIndex(allRecs, allDocs) {
    var out = {}, keys = {};
    Object.keys(allRecs || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(allDocs || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { out[k] = coSort(asList((allRecs || {})[k]), asList((allDocs || {})[k])); });
    return out;
  }
  /* 갈래·대조 칩으로 회사 거르기 — grp: 갈래 v, chk: 'ok'|'missing'|'norec'|'none' */
  function filterCosBy(cos, idx, grp, chk) {
    return (cos || []).filter(function (c) {
      if (!idx) return true;
      var x = idx[c.key]; if (!x) return !grp && !chk;
      if (grp && !x.groups[grp]) return false;
      if (chk && !x.n[chk]) return false;
      return true;
    });
  }
  var DOC_SRCS = [['upload', '업로드'], ['photo', '사진첩'], ['folder', 'PC 폴더']];
  function filterCos(cos, q, f) {
    q = String(q || '').trim().toLowerCase();
    return (cos || []).filter(function (c) {
      if (f === 'recs' && !(c.r > 0)) return false;
      if (f === 'files' && !(c.n > 0)) return false;
      if (f === 'nobz' && String(c.bz || '').replace(/\D/g, '').length === 10) return false;
      return !q || String(c.name || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  function filterDocs(docs, src) {
    return (docs || []).filter(function (d) { return !src || (d.src || 'upload') === src; });
  }
  /* 양식 첨부 중 아직 보관함에 없는 것 (자료가 있는 것만) */
  function pendingBackfill(forms, attKey) {
    var outp = [];
    (forms || []).forEach(function (f) {
      var done = {};
      (f.originals || []).forEach(function (o) { if (o.attId) done[o.attId] = 1; });
      (f.attachments || []).forEach(function (a) {
        if (!(a.data || a.dataUrl)) return;
        if (done[attKey(a)]) return;
        outp.push({ formId: f.id, formName: f.name, formKind: f.kind, att: a });
      });
    });
    return outp;
  }

  /* 사진첩의 계약서 사진 → 가져올 후보 (화면 없이 검사한다)
     회사명은 사람이 붙인 것(meta.company)이 판독값(read.fields.company)보다 앞선다 */
  function photoCandidates(byYear, importedIds) {
    var outp = [];
    Object.keys(byYear || {}).forEach(function (y) {
      var items = byYear[y] || {};
      Object.keys(items).forEach(function (id) {
        var m = items[id] || {}, r = m.read || {};
        if (r.kind !== 'contract') return;
        var f = r.fields || {};
        var ts = m.upAt || m.takenAt || 0;
        outp.push({ year: String(y), id: id, company: String(m.company || f.company || '').trim(),
          title: String(f.docName || '').trim() || '계약서', date: ymdUtc(ts), ts: ts,
          imported: !!(importedIds && importedIds[id]), loc: m.loc || null });
      });
    });
    return outp.sort(function (a, b) { return b.ts - a.ts; }).map(function (x) { delete x.ts; return x; });
  }
  function ymdUtc(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  /* ══ 원본 보관함 ══ — 지우는 단추는 없다(영구 보관) */
  function mountArchive(root, host) {
    css();
    var store = host.store;
    var S = { rows: [], pend: [], q: '', kind: '', type: '', by: '', picked: {}, sel: null, loaded: false, err: null, denied: false, busy: false };

    function load() {
      S.err = null;
      return store.probe().then(function (p) {
        if (p === 'denied') { S.denied = true; S.loaded = true; draw(); return; }
        return Promise.all([store.listOriginals(), host.loadForms()]).then(function (r) {
          S.rows = archiveRows(r[0], r[1]);
          S.pend = pendingBackfill(r[1], host.attKey);
          var ids = {}; S.rows.forEach(function (x) { ids[x.id] = 1; });
          Object.keys(S.picked).forEach(function (k) { if (!ids[k]) delete S.picked[k]; });
          if (S.sel && !ids[S.sel.id]) S.sel = null;
          S.loaded = true; draw();
        });
      }).catch(function (e) { S.err = msg(e); S.loaded = true; draw(); });
    }
    function backfill() {
      if (S.busy) return;
      S.busy = true; draw();
      var ok = 0, fail = 0, why = '';
      var finish = function () {
        S.busy = false;
        toast('보관함에 ' + ok + '개 담았습니다' + (fail ? ' · ' + fail + '개 실패 — ' + why : ''));
        load();
      };
      S.pend.reduce(function (p, it) {
        return p.then(function () {
          return Promise.resolve().then(function () {
            var bytes = store.dataUrlToBytes(it.att.data || it.att.dataUrl);
            return store.putOriginal({ name: it.att.name || '첨부', size: bytes.length, type: it.att.type || '', bytes: bytes },
              { kind: 'form', formId: it.formId, formName: it.formName || '', formKind: it.formKind || '' })
              .then(function (r) {
                var entry = { fileId: r.fileId, name: it.att.name || '첨부', size: bytes.length, attId: host.attKey(it.att) };
                return host.linkOriginal(it.formId, entry);
              });
          }).then(function () { ok++; }, function (e) { fail++; why = msg(e); });
        });
      }, Promise.resolve()).then(finish, finish);
    }
    /* 고른 것 묶어 받기 — 브라우저 안에서 .zip 하나로(🔒 서명본은 서버가 대표·관리자에게만 내준다) */
    function zipPicked() {
      var list = S.rows.filter(function (r) { return S.picked[r.id]; });
      if (!list.length || S.busy || !host.fileBytes || !host.zip) return;
      S.busy = true; draw();
      var files = [], fail = 0, used = {};
      list.reduce(function (p, r, i) {
        return p.then(function () {
          toast('파일 가져오는 중… (' + (i + 1) + '/' + list.length + ')');
          return host.fileBytes(r.id).then(function (f) {
            var nm = f.name || r.name, k = nm, n = 2;
            while (used[k]) k = nm.replace(/(\.[^.]+)?$/, '(' + (n++) + ')$1');
            used[k] = 1; files.push({ name: k, bytes: f.bytes });
          }, function () { fail++; });
        });
      }, Promise.resolve()).then(function () {
        if (!files.length) throw new Error('받은 파일이 없습니다');
        return host.zip(files);
      }).then(function (u8) {
        saveBytes(u8, '원본보관함_' + ymd(Date.now()) + '_' + files.length + '개.zip', 'application/zip');
        toast('📦 ' + files.length + '개를 묶었습니다' + (fail ? ' · ' + fail + '개는 못 받음(🔒 서명본은 대표·관리자만)' : ''));
      }).catch(function (e) { toast('❌ 묶지 못했습니다 — ' + msg(e)); })
        .then(function () { S.busy = false; draw(); });
    }
    function saveBytes(u8, name, type) {
      var a = el('a', { href: w.URL.createObjectURL(new Blob([u8], { type: type || 'application/octet-stream' })), download: name });
      w.document.body.appendChild(a); a.click();
      setTimeout(function () { w.URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
    }
    /* 오른쪽 미리보기 — PDF·그림은 그대로, 한글·엑셀은 문서 엔진(host.hwpShow) */
    var prevUrl = null, prevBytes = null;  /* 미리보기 파일은 고른 줄이 바뀔 때만 다시 받는다(☐ 누를 때마다 🔒 를 서버에서 다시 열던 것) */
    function drawPreview(box) {
      if (prevUrl) { try { w.URL.revokeObjectURL(prevUrl); } catch (_) {} prevUrl = null; }
      var r = S.sel; box.innerHTML = '';
      if (!r) return;
      var body = el('div', { 'class': 'pod-arc-rb' }, [el('div', { 'class': 'pod-empty', style: 'border:none', text: '여는 중…' })]);
      box.appendChild(el('div', { 'class': 'pod-arc-rh' }, [el('b', { title: r.name, text: (r.secret ? '🔒 ' : '') + r.name }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📥 내려받기', onclick: function () { host.download(r.id, r.name); } }),
        el('button', { type: 'button', 'class': 'pod-b', 'aria-label': '미리보기 닫기', text: '×', onclick: function () { S.sel = null; draw(); } })]));
      if (r.link) box.appendChild(el('div', { style: 'padding:4px 10px 6px;font-size:11.5px;color:#64748b;border-bottom:1px solid #f1f5f9', text: '연결 · ' + r.link }));
      box.appendChild(body);
      if (r.type === 'doc' || r.type === 'etc') { body.innerHTML = ''; body.appendChild(el('div', { 'class': 'pod-empty', style: 'border:none', text: '이 형식은 미리보기가 없습니다 — 📥 내려받아 여세요' })); return; }
      if (!host.fileBytes) { body.textContent = '미리보기 길이 연결되지 않았습니다'; return; }
      var want = r;
      var got = prevBytes && prevBytes.id === r.id ? Promise.resolve(prevBytes.f)
        : host.fileBytes(r.id).then(function (f) { prevBytes = { id: r.id, f: f }; return f; });
      got.then(function (f) {
        if (S.sel !== want) return;
        body.innerHTML = '';
        if (r.type === 'pdf' || r.type === 'img') {
          prevUrl = w.URL.createObjectURL(new Blob([f.bytes], { type: r.type === 'pdf' ? 'application/pdf' : (r.rec && r.rec.type) || 'image/jpeg' }));
          body.appendChild(r.type === 'pdf' ? el('iframe', { src: prevUrl, title: r.name }) : el('img', { src: prevUrl, alt: r.name }));
          return;
        }
        if (!host.hwpShow) { body.textContent = '한글·엑셀 미리보기 도구가 없습니다 — 내려받아 여세요'; return; }
        var host2 = el('div', { style: 'background:#fff' });
        body.appendChild(host2);
        return host.hwpShow(host2, f.bytes, f.name || r.name);
      }).catch(function (e) {
        if (S.sel !== want) return;
        body.innerHTML = '';
        body.appendChild(el('div', { 'class': 'pod-empty', style: 'border:none;color:#991b1b', text: '열지 못했습니다 — ' + msg(e) }));
      });
    }
    function draw() {
      root.innerHTML = '';
      var wrap = el('div', { 'class': 'pod' });
      var search = el('input', { type: 'search', placeholder: '파일명·연결 이름', 'aria-label': '보관함 검색', value: S.q,
        oninput: function () { S.q = search.value; drawTable(); } });
      wrap.appendChild(el('div', { 'class': 'pod-bar' }, [el('b', { text: '🗄 원본 보관함' }),
        el('span', { style: 'font-size:12px;color:#64748b', text: '올린 원본은 지워지지 않습니다' }), search,
        el('button', { type: 'button', 'class': 'pod-b', text: '🔄 새로고침', onclick: load })]));
      if (S.denied) { wrap.appendChild(deniedBanner()); root.appendChild(wrap); return; }
      if (S.err) { wrap.appendChild(el('div', { 'class': 'pod-empty', style: 'color:#991b1b', text: '불러오지 못했습니다 — ' + S.err })); root.appendChild(wrap); return; }
      if (!S.loaded) { wrap.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); root.appendChild(wrap); return; }
      if (S.pend.length) {
        wrap.appendChild(el('div', { 'class': 'pod-note' }, [
          el('span', { style: 'flex:1', text: '계약서 양식에 붙어 있는 기존 첨부 ' + S.pend.length + '개가 아직 보관함에 없습니다.' }),
          el('button', { type: 'button', 'class': 'pod-b p', text: S.busy ? '담는 중…' : '보관함에 담기', onclick: backfill })]));
      }
      /* 걸러 보기 — 연결 · 형식 · 올린 사람 */
      function sel(label, val, opts, set) {
        var se = el('select', { 'aria-label': label }, [el('option', { value: '', text: label + ' 전체' })].concat(opts.map(function (o) {
          return el('option', { value: o[0], text: o[1] });
        })));
        se.value = val;
        se.addEventListener('change', function () { set(se.value); drawTable(); });
        return se;
      }
      var people = {};
      S.rows.forEach(function (r) { if (r.byName) people[r.byName] = 1; });
      var countEl = el('span', { style: 'margin-left:auto' });
      var actBox = el('span', { style: 'display:inline-flex;gap:6px' });
      wrap.appendChild(el('div', { 'class': 'pod-fil' }, [
        sel('연결', S.kind, ARC_KINDS, function (v) { S.kind = v; }),
        sel('형식', S.type, ARC_TYPES, function (v) { S.type = v; }),
        sel('올린 사람', S.by, Object.keys(people).sort().map(function (n) { return [n, n]; }), function (v) { S.by = v; }),
        actBox, countEl]));
      var tableBox = el('div', { 'class': 'pod-arc-l' });
      var prevBox = el('div', { 'class': 'pod-arc-r' });
      if (!S.sel) prevBox.hidden = true;
      wrap.appendChild(el('div', { 'class': 'pod-arc' }, [tableBox, prevBox]));
      root.appendChild(wrap);
      function drawActs() {
        actBox.innerHTML = '';
        var n = Object.keys(S.picked).filter(function (k) { return S.picked[k]; }).length;
        if (!n) return;
        actBox.appendChild(el('button', { type: 'button', 'class': 'pod-b p', text: S.busy ? '묶는 중…' : '📦 선택 ' + n + '개 묶어 받기', onclick: zipPicked }));
        actBox.appendChild(el('button', { type: 'button', 'class': 'pod-b', text: '선택 풀기', onclick: function () { S.picked = {}; drawTable(); } }));
      }
      function drawTable() {
        tableBox.innerHTML = '';
        var rows = filterArchive(S.rows, { q: S.q, kind: S.kind, type: S.type, by: S.by });
        countEl.textContent = rows.length === S.rows.length ? S.rows.length + '개' : rows.length + '개 / 전체 ' + S.rows.length;
        drawActs();
        if (!rows.length) { tableBox.appendChild(el('div', { 'class': 'pod-empty', text: S.rows.length ? '찾는 파일이 없습니다' : '아직 보관된 원본이 없습니다 — 계약서 양식이나 기업별 계약서에 파일을 올리면 여기 쌓입니다' })); return; }
        var all = el('input', { type: 'checkbox', 'aria-label': '보이는 것 모두 고르기', checked: rows.every(function (r) { return S.picked[r.id]; }) });
        all.addEventListener('change', function () { rows.forEach(function (r) { S.picked[r.id] = all.checked; }); drawTable(); });
        /* 미리보기가 열려 있으면 표가 좁아진다 — 칸을 줄이고 «연결»은 파일 이름 밑 작은 줄로 */
        var compact = !!S.sel;
        tableBox.appendChild(el('div', { 'class': 'pod-arc-scroll' }, [el('table', null, [
          el('thead', null, [el('tr', null, compact
            ? [el('th', { style: 'width:34px' }, [all]), el('th', { style: 'width:38px', text: '#' }), el('th', { text: '파일 · 연결' }),
              el('th', { style: 'width:88px', text: '올린 날' }), el('th', { style: 'width:52px', text: '' })]
            : [el('th', { style: 'width:34px' }, [all]), el('th', { style: 'width:42px', text: '#' }),
              el('th', { style: 'width:34%', text: '파일' }), el('th', { text: '연결' }),
              el('th', { style: 'width:70px', text: '크기' }), el('th', { style: 'width:92px', text: '올린 날' }), el('th', { style: 'width:80px', text: '올린 사람' }), el('th', { style: 'width:52px', text: '' })])]),
          el('tbody', null, rows.map(function (r, i) {
            var cb = el('input', { type: 'checkbox', 'aria-label': r.name + ' 고르기', checked: !!S.picked[r.id] });
            cb.addEventListener('click', function (e) { e.stopPropagation(); });
            cb.addEventListener('change', function () { S.picked[r.id] = cb.checked; all.checked = rows.every(function (x) { return S.picked[x.id]; }); drawActs(); });
            var dl = el('button', { type: 'button', 'class': 'pod-b', title: '내려받기', 'aria-label': r.name + ' 내려받기', text: '📥' });
            dl.addEventListener('click', function (e) { e.stopPropagation(); host.download(r.id, r.name); });
            var pick = function () { S.sel = r; draw(); };
            if (compact) return el('tr', { 'class': S.sel.id === r.id ? 'on' : null, title: '눌러서 오른쪽에 미리보기', onclick: pick }, [
              el('td', { style: 'overflow:visible' }, [cb]), el('td', { style: 'color:#94a3b8', text: String(i + 1) }),
              el('td', { title: r.name + (r.link ? '\n' + r.link : '') }, [el('div', { style: 'overflow:hidden;text-overflow:ellipsis', text: (r.secret ? '🔒 ' : '📄 ') + r.name }),
                r.link ? el('div', { 'class': r.gone ? 'gone' : null, style: 'overflow:hidden;text-overflow:ellipsis;font-size:11px;color:' + (r.gone ? '#b45309' : '#94a3b8'), text: r.link }) : null]),
              el('td', { text: ymd(r.at) }), el('td', { style: 'overflow:visible' }, [dl])]);
            return el('tr', { title: '눌러서 오른쪽에 미리보기', onclick: pick }, [
              el('td', { style: 'overflow:visible' }, [cb]), el('td', { style: 'color:#94a3b8', text: String(i + 1) }),
              el('td', { title: r.name, text: (r.secret ? '🔒 ' : '📄 ') + r.name }),
              el('td', { 'class': r.gone ? 'gone' : null, title: r.link, text: r.link }),
              el('td', { text: fmtSize(r.size) }), el('td', { text: ymd(r.at) }), el('td', { text: r.byName }),
              el('td', { style: 'overflow:visible' }, [dl])
            ]);
          }))
        ])]));
      }
      drawTable();
      if (S.sel) drawPreview(prevBox);
    }
    draw(); load();
    return { reload: load };
  }

  /* ══ 기업별 계약서 ══
     사진첩은 «사람별 잠금»이라 남의 사진을 모아 볼 수 없다 — 그래서 «가져오기 = 공유 보관함으로 사본 복사»다.
     사진첩 원본은 읽기만 한다. 「이 회사에서 빼기」는 연결만 끊고 파일은 보관함에 남는다. */
  function mountCompanies(root, host, opts) {
    css();
    var store = host.store;
    var S = { cos: [], sel: null, docs: [], recs: [], sent: [], recsDenied: false, picked: {}, q: '', loaded: false, err: null, denied: false,
      tab: opts && (opts.tab === 'await' || opts.tab === 'sign') ? opts.tab : 'co', aw: null, awErr: null, awPicked: {}, idx: null, grp: '', chk: '', sg: null, sgErr: null, sgNote: '', sgBusy: false };

    function load(keepSel) {
      S.err = null;
      return store.probe().then(function (p) {
        if (p === 'denied') { S.denied = true; S.loaded = true; draw(); return; }
        loadAwait(); loadIndex(); if (S.tab === 'sign') loadSign();
        return store.listCo().then(function (cos) {
          S.cos = cos.filter(function (c) { return c.n > 0 || c.r > 0; });
          if (!keepSel || !S.cos.some(function (c) { return c.key === S.sel; })) S.sel = S.cos.length ? S.cos[0].key : null;
          S.loaded = true;
          return loadDocs();
        });
      }).catch(function (e) { S.err = msg(e); S.loaded = true; draw(); });
    }
    function loadDocs() {
      var key = S.sel;
      if (!key) { S.docs = []; S.recs = []; S.sent = []; draw(); return Promise.resolve(); }
      S.picked = {};
      if (S.dkey !== key) { S.dpicked = {}; S.dsel = null; S.dkey = key; }
      /* 보낸 서류는 곁들이 — 못 읽어도 파일·계약 기록은 그대로 보인다 */
      var co = S.cos.filter(function (c) { return c.key === key; })[0] || {};
      var sentP = host.sentFor ? host.sentFor(co.name || '', co.bz || '').then(sentRows, function () { return []; }) : Promise.resolve([]);
      /* 계약 기록은 규칙이 아직 없으면 막힌다 — 그래도 파일 카드는 보인다 */
      var recsP = store.listCoRecs ? store.listCoRecs(key).then(function (r) { S.recsDenied = false; return r; },
        function (e) { S.recsDenied = !!(store.isDenied && store.isDenied(e)); return []; }) : Promise.resolve([]);
      return Promise.all([store.listCoDocs(key), recsP, sentP]).then(function (r) { if (key !== S.sel) return; S.docs = r[0]; S.recs = r[1]; S.sent = r[2]; draw(); },
        function (e) { if (key !== S.sel) return; S.docs = []; S.recs = []; S.sent = []; draw(); toast('❌ 이 회사 계약서를 불러오지 못했습니다 — ' + msg(e)); });
    }
    /* ✍ 서명 요청 (2026-10-09) — 목록을 읽고, 제출된 것은 이 화면이 차례로 🔒 서명본으로 저장한다(사람이 따로 누르지 않아도) */
    function loadSign(auto) {
      if (!host.sign) return Promise.resolve();
      return host.sign.list().then(function (l) {
        S.sg = l; S.sgErr = null; draw();
        if (auto !== false) return saveSubmitted();
      }, function (e) { S.sg = []; S.sgErr = store.isDenied && store.isDenied(e) ? '규칙이 아직 게시되지 않았습니다' : msg(e); draw(); });
    }
    function saveSubmitted() {
      var W = w.PuSign; if (!W || S.sgBusy) return Promise.resolve();
      var todo = (S.sg || []).filter(function (r) { return W.statusOf(r, r.o) === 'submitted'; });
      if (!todo.length) return Promise.resolve();
      S.sgBusy = true; var done = 0, bad = [];
      return todo.reduce(function (p, r) {
        return p.then(function () {
          S.sgNote = '🔒 제출된 서명본을 저장하는 중… (' + (done + 1) + '/' + todo.length + ') ' + ((r.who && r.who.name) || ''); draw();
          return host.sign.finalize(r).then(function (x) { done++; if (!x.hashOk) bad.push((r.who && r.who.name) + '(문서 지문 다름)');
              if (x.warn && x.warn.length) bad.push(((r.who && r.who.name) || '') + ' — ' + x.warn.join(', ')); },
            function (e) { if (e && e.code === 'busy') return; bad.push(((r.who && r.who.name) || '') + ' — ' + msg(e)); });
        });
      }, Promise.resolve()).then(function () {
        S.sgBusy = false; S.sgNote = '✅ ' + done + '건을 🔒 서명본으로 저장했습니다' + (bad.length ? ' · ⚠ ' + bad.join(', ') : '');
        loadIndex(); return loadSign(false);
      });
    }
    function signPane() {
      var W = w.PuSign, box = el('div', { 'class': 'pod-aw' });
      box.appendChild(el('div', { 'class': 'pod-note' }, ['계약서 양식 › 「📝 찾아서 채우기」 › 「✍ 서명 받기」로 만든 링크입니다. 받는 사람이 폰에서 제출하면 이 화면을 열 때 🔒 서명본으로 저장되고 기업별 계약서·계약 기록·서명본 대기에 들어갑니다.']));
      if (S.sgNote) box.appendChild(el('div', { 'class': 'pod-note', style: 'background:#f0fdf4;border-color:#bbf7d0;color:#166534', text: S.sgNote }));
      if (S.sg == null) { box.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); return box; }
      if (S.sgErr) { box.appendChild(el('div', { 'class': 'pod-note pod-warn', text: '⚠ 서명 요청을 읽지 못했습니다 — ' + S.sgErr })); return box; }
      if (!S.sg.length) { box.appendChild(el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '아직 서명 요청이 없습니다' })); return box; }
      var tb = el('tbody');
      S.sg.forEach(function (r, i) {
        var st = W.statusOf(r, r.o), link = host.sign.link(r);
        var txt = W.shareText({ name: r.who && r.who.name, title: r.title, mode: r.mode, link: link, exp: r.exp });
        var acts = [];
        if (st === 'sent' || st === 'seen' || st === 'expired') {
          acts.push(el('button', { type: 'button', 'class': 'pod-b', text: '📋 안내 글 복사', onclick: function () {
            (w.navigator.clipboard ? w.navigator.clipboard.writeText(txt) : Promise.reject(new Error('복사 기능이 없습니다'))).then(function () { toast('복사했습니다 — 카톡·문자에 붙이세요'); }, function (e) { toast('❌ ' + msg(e)); });
          } }));
          if (st !== 'expired') acts.push(el('button', { type: 'button', 'class': 'pod-b', text: '취소', title: '이 링크로 더는 제출하지 못하게 합니다', onclick: function () {
            if (!w.confirm((r.who && r.who.name) + ' 님의 서명 요청을 취소할까요?\n(링크로 더는 제출할 수 없습니다)')) return;
            host.sign.void(r).then(function () { toast('취소했습니다'); loadSign(false); }, function (e) { toast('❌ ' + msg(e)); });
          } }));
        }
        if (st === 'submitted') acts.push(el('button', { type: 'button', 'class': 'pod-b p', text: '🔒 지금 저장', onclick: function () { saveSubmitted(); } }));
        if (st === 'saved' && r.coKey) acts.push(el('button', { type: 'button', 'class': 'pod-b', text: '회사 보기', onclick: function () { S.tab = 'co'; S.sel = r.coKey; load(true); } }));
        tb.appendChild(el('tr', null, [el('td', { style: 'color:#94a3b8', text: String(i + 1) }), el('td', { text: W.ymd(r.at) }),
          el('td', null, [el('b', { text: (r.who && r.who.name) || '' }), el('div', { style: 'font-size:11px;color:#94a3b8', text: r.co || '(회사 없음)' })]),
          el('td', { 'class': 'nm', text: r.title || '' }), el('td', { text: r.mode === 'agree' ? '동의' : '서명' }),
          el('td', { text: W.ymd(r.exp) }),
          el('td', null, [el('span', { 'class': 'pod-sgst ' + st, text: W.STATUS_TXT[st] + (st === 'saved' && r.hashOk === false ? ' ⚠지문' : '') })]),
          el('td', { style: 'overflow:visible;white-space:nowrap' }, acts)]));
      });
      box.appendChild(el('div', { style: 'overflow-x:auto' }, [el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { text: '#' }), el('th', { text: '보낸 날' }),
        el('th', { text: '서명자' }), el('th', { text: '서류' }), el('th', { text: '방식' }), el('th', { text: '기한' }), el('th', { text: '상태' }), el('th', { text: '' })])]), tb])]));
      return box;
    }
    /* 갈래별 정리 — 기록·파일 연결 전체(작다)를 한 번 읽어 회사마다 나눈다. 못 읽어도 화면은 그대로(칩만 안 나온다) */
    function loadIndex() {
      if (!store.listAllCoData) return Promise.resolve();
      return store.listAllCoData().then(function (a) { S.idx = coIndex(a.recs, a.docs); draw(); }, function () { S.idx = null; });
    }
    /* 📬 서명본 대기 — 작은 목록(pu_docs/await) 하나만 읽는다. 기업정보함 보낸 서류를 통째로 읽지 않는다 */
    function loadAwait() {
      if (!store.listAwait) return Promise.resolve();
      return store.listAwait().then(function (l) { S.aw = l; S.awErr = null; draw(); },
        function (e) { S.aw = []; S.awErr = store.isDenied && store.isDenied(e) ? '규칙이 아직 게시되지 않았습니다' : msg(e); draw(); });
    }
    function coName(key) { var c = S.cos.filter(function (x) { return x.key === key; })[0]; return c ? c.name : ''; }
    function coList() { return el('datalist', { id: 'pod-cos' }, S.cos.map(function (c) { return el('option', { value: c.name }); })); }
    function isImg(name) { return /\.(jpe?g|png|heic)$/i.test(name || ''); }

    /* fileId → {rec,url} 을 마운트 동안 캐시한다 — 다시 그릴 때마다 getOriginal+getDownloadURL 을 되풀이하지 않는다.
       단, 실패는 캐시하지 않는다 — 한 번 어긋난 요청 때문에 마운트가 살아 있는 내내 썸네일이 죽으면 안 된다. */
    var urlCache = {};
    function urlFor(fileId, secret) {
      if (secret) return Promise.resolve({ rec: null, url: null, secret: true });
      if (!urlCache[fileId]) {
        urlCache[fileId] = store.getOriginal(fileId).then(function (r) {
          if (!r) return { rec: null, url: null };
          return store.fileUrl(r).then(function (url) { return { rec: r, url: url }; });
        }).catch(function (e) { delete urlCache[fileId]; throw e; });
      }
      return urlCache[fileId];
    }

    function modalShell(title, bodyKids, footKids) {
      var bg = el('div', { 'class': 'pod-mbg' });
      function close() { w.document.removeEventListener('keydown', onKey); bg.remove(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      w.document.addEventListener('keydown', onKey);
      bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
      bg.appendChild(el('div', { 'class': 'pod-m', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
        el('div', { 'class': 'pod-mh' }, [el('span', { text: title }), el('button', { type: 'button', 'class': 'pod-b', 'aria-label': '닫기', text: '×', onclick: close })]),
        el('div', { 'class': 'pod-mb' }, bodyKids),
        el('div', { 'class': 'pod-mf' }, footKids(close))
      ]));
      w.document.body.appendChild(bg);
      return close;
    }

    /* ── 직접 올리기 ── */
    function openUpload() {
      var fileIn = el('input', { type: 'file', accept: '.hwp,.hwpx,.pdf,.doc,.docx,.jpg,.jpeg,.png,.heic' });
      var coIn = el('input', { type: 'text', list: 'pod-cos', placeholder: '회사 이름', value: S.sel ? coName(S.sel) : '' });
      var tIn = el('input', { type: 'text', placeholder: '예: 자문계약서' });
      var dIn = el('input', { type: 'date', value: ymd(Date.now()) });
      fileIn.addEventListener('change', function () { var f = fileIn.files[0]; if (f && !tIn.value) tIn.value = f.name.replace(/\.[^.]+$/, ''); });
      modalShell('기업별 계약서 올리기', [
        el('label', { text: '파일 (한글·PDF·워드·사진 · 25MB 미만)' }), fileIn,
        el('label', { text: '회사 *' }), coIn, coList(),
        el('label', { text: '제목' }), tIn,
        el('label', { text: '계약일' }), dIn
      ], function (close) {
        var go = el('button', { type: 'button', 'class': 'pod-b p', text: '올리기', onclick: function () {
          var f = fileIn.files[0], co = coIn.value.trim();
          if (!f) { toast('파일을 고르세요'); return; }
          if (!co) { toast('회사 이름을 넣으세요'); coIn.focus(); return; }
          var chk = store.okDocFile(f.name, f.size); if (!chk.ok) { toast('❌ ' + chk.why); return; }
          go.disabled = true; go.textContent = '올리는 중…';
          readBytes(f).then(function (bytes) {
            return store.putOriginal({ name: f.name, size: f.size, type: f.type || '', bytes: bytes }, { kind: 'co', coKey: store.coKey(co), coName: co });
          }).then(function (r) {
            return store.addCoDoc({ coName: co, fileId: r.fileId, title: tIn.value.trim() || f.name, date: dIn.value, src: 'upload' });
          }).then(function (r) {
            close(); toast('✅ ' + co + ' 에 올렸습니다'); S.sel = r.coKey; load(true);
          }).catch(function (e) { go.disabled = false; go.textContent = '올리기'; toast('❌ 올리지 못했습니다 — ' + msg(e)); });
        } });
        return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }), go];
      });
    }

    /* ── 📎 서명본 올리기 (2026-10-07 목업 승인) — 끌어다 놓기 · 종류(보낸 서류로 짐작) · 계약일 · 이알피 계약 ──
       🔒 저장: 서명본 창고(대표·관리자만 연다) + 회사 카드(co_docs) + 계약 기록(co_recs, 파일과 이어짐) + 대기에서 회수로 */
    function openSigned(a) {
      var file = null;
      var fileIn = el('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.heic,.hwp,.hwpx', style: 'display:none' });
      var dropTxt = el('div', { text: '서명본 PDF·사진을 여기로 끌어 놓거나 눌러서 고르세요' });
      var drop = el('div', { 'class': 'pod-drop', role: 'button', tabindex: '0', 'aria-label': '서명본 파일 고르기' }, [el('div', { style: 'font-size:24px', text: '📎' }), dropTxt]);
      function setFile(f) {
        if (!f) return;
        var chk = store.okDocFile(f.name, f.size); if (!chk.ok) { toast('❌ ' + chk.why); return; }
        file = f; dropTxt.textContent = '✅ ' + f.name + ' (' + fmtSize(f.size) + ')';
      }
      drop.addEventListener('click', function () { fileIn.click(); });
      drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('on'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('on'); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('on'); setFile(e.dataTransfer && e.dataTransfer.files[0]); });
      fileIn.addEventListener('change', function () { setFile(fileIn.files[0]); });
      var kSel = el('select', null, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = awaitKindOf(a.names);
      var dIn = el('input', { type: 'date', value: ymd(Date.now()) });
      var ctSel = el('select', { 'aria-label': '이알피 계약' }, [el('option', { value: '', text: host.contractList ? '불러오는 중…' : '(이알피 계약 목록 없음)' })]);
      if (host.contractList) host.contractList().then(function (ls) {
        var nk = nameKey(a.name), mine = (ls || []).filter(function (c) { return nameKey(c.companyName) === nk; });
        ctSel.innerHTML = '';
        ctSel.appendChild(el('option', { value: '', text: mine.length ? '(연결 안 함)' : '(이 회사 이름의 이알피 계약이 없습니다)' }));
        mine.forEach(function (c) { ctSel.appendChild(el('option', { value: c.contractNo || c.id, text: (c.contractNo || c.id) + (c.signDate ? ' · ' + c.signDate : '') + (c.status ? ' · ' + c.status : '') })); });
        if (mine.length === 1) ctSel.value = mine[0].contractNo || mine[0].id;
      }, function () { ctSel.innerHTML = ''; ctSel.appendChild(el('option', { value: '', text: '(이알피 계약을 읽지 못했습니다)' })); });
      modalShell('📎 서명본 올리기 — ' + a.name, [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '보낸 서류: ' + ((a.names || []).join(', ') || '—') + ' · ' + ymd(a.at) + ' ' + a.how }),
        drop, fileIn,
        el('label', { text: '계약 종류 (보낸 서류로 짐작 — 고치세요)' }), kSel,
        el('label', { text: '계약일' }), dIn,
        el('label', { text: '이알피 계약 연결' }), ctSel,
        el('div', { style: 'font-size:12px;color:#854d0e;margin-top:10px', text: '🔒 서명본으로 저장합니다 — 목록 줄(회사·종류·날짜)은 직원 모두 보고, 파일 열기는 대표·관리자만(연 기록이 남습니다).' })
      ], function (close) {
        var go = el('button', { type: 'button', 'class': 'pod-b p', text: '🔒 저장', onclick: function () {
          if (!file) { toast('서명본 파일을 고르세요'); return; }
          if (!dIn.value) { toast('계약일을 넣으세요'); dIn.focus(); return; }
          go.disabled = true; go.textContent = '저장하는 중…';
          var co = a.name, kind = kSel.value, ct = ctSel.value, f = file;
          readBytes(f).then(function (bytes) {
            return store.putOriginal({ name: f.name, size: f.size, type: f.type || '', bytes: bytes }, { kind: 'co', coKey: store.coKey(co), coName: co }, { secret: true });
          }).then(function (r) {
            if (r.secret === false) toast('⚠ 같은 파일이 일반 원본으로 이미 있어 🔒 가 아닙니다 — 「🔒 서명본으로 옮기기」로 옮기세요');
            return store.addCoDoc({ coName: co, fileId: r.fileId, title: kind + ' 계약서 (서명본)', date: dIn.value, src: 'upload', secret: r.secret !== false });
          }).then(function (r) {
            return store.importCoRecs([{ coName: co, bizNo: a.bz || '', date: dIn.value, kind: kind, docId: r.docId, note: ct ? '이알피 계약 ' + ct : '' }])
              .then(function () { return store.gotAwait(a.key, r.docId); }).then(function () { return r; });
          }).then(function (r) {
            close(); toast('✅ ' + co + ' 서명본을 저장했습니다 — 최근 회수로 옮겼습니다'); S.sel = r.coKey; load(true);
          }).catch(function (e) { go.disabled = false; go.textContent = '🔒 저장'; toast('❌ 저장하지 못했습니다 — ' + msg(e)); });
        } });
        return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }), go];
      });
    }
    /* ⏰ 다시 알림 — 메일은 보내지 않는다(받는 주소를 남기지 않으므로). 알림 글을 복사해 주고 «알린 날»만 적는다 */
    function remind(list) {
      list = [].concat(list);
      var txt = list.map(function (a) { var t = remindText(a); return '제목: ' + t.subject + '\n\n' + t.body; }).join('\n\n────────\n\n');
      var cp = w.navigator.clipboard ? w.navigator.clipboard.writeText(txt) : Promise.reject(new Error('복사 기능이 없습니다'));
      return cp.then(function () { return Promise.all(list.map(function (a) { return store.remindAwait(a.key); })); })
        .then(function () { toast('⏰ 알림 글 ' + list.length + '곳을 복사했습니다 — 메일·문자에 붙여 보내세요'); S.awPicked = {}; loadAwait(); },
          function (e) { toast('❌ ' + msg(e)); });
    }
    function awaitPane() {
      var box = el('div', { 'class': 'pod-aw' });
      if (S.aw == null) { box.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); return box; }
      if (S.awErr) { box.appendChild(el('div', { 'class': 'pod-note pod-warn', text: '⚠ 서명본 대기 목록을 읽지 못했습니다 — ' + S.awErr })); return box; }
      var v = awaitView(S.aw);
      box.appendChild(el('div', { 'class': 'pod-note' }, ['계약서등관리에서 계약서를 ✉ 보내거나 📥 받으면 여기에 오릅니다. 서명본이 돌아오면 「📎 서명본 올리기」 — '
        + AWAIT_LATE + '일이 넘으면 빨갛게 보입니다.']));
      if (!v.wait.length) box.appendChild(el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '서명본을 기다리는 회사가 없습니다' }));
      else {
        var tb = el('tbody');
        var picked = v.wait.filter(function (a) { return S.awPicked[a.key]; });
        var all = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: picked.length === v.wait.length });
        all.addEventListener('change', function () { v.wait.forEach(function (a) { S.awPicked[a.key] = all.checked; }); draw(); });
        v.wait.forEach(function (a, i) {
          var cb = el('input', { type: 'checkbox', 'aria-label': a.name + ' 고르기', checked: !!S.awPicked[a.key] });
          cb.addEventListener('change', function () { S.awPicked[a.key] = cb.checked; draw(); });
          tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { style: 'color:#94a3b8', text: String(i + 1) }),
            el('td', null, [el('b', { text: a.name }), a.bz ? el('div', { style: 'font-size:11px;color:#94a3b8', text: fmtBz(a.bz) }) : null]),
            el('td', { 'class': 'nm', text: (a.names || []).join(', ') || '—' }),
            el('td', null, [ymd(a.at) + ' ', el('span', { 'class': 'pod-tag ' + (a.how === '받기' ? 'ph' : 'up'), text: a.how })]),
            el('td', { 'class': a.late ? 'late' : null, text: a.days + '일' + (a.remindAt ? ' · 알림 ' + ymd(a.remindAt).slice(5) : '') }),
            el('td', { style: 'overflow:visible;white-space:nowrap' }, [
              el('button', { type: 'button', 'class': 'pod-b p', text: '📎 서명본 올리기', onclick: function () { openSigned(a); } }), ' ',
              el('button', { type: 'button', 'class': 'pod-b', text: '⏰ 다시 알림', title: '알림 글을 복사하고 알린 날을 적습니다(메일은 보내지 않습니다)', onclick: function () { remind(a); } })])]));
        });
        box.appendChild(el('div', { 'class': 'pod-bar', style: 'margin-bottom:6px' }, [el('b', { style: 'font-size:13px', text: '📬 서명본 대기 ' + v.wait.length + '곳' }),
          picked.length ? el('button', { type: 'button', 'class': 'pod-b', text: '선택 ' + picked.length + '곳 알림 글 복사', onclick: function () { remind(picked); } }) : null]));
        box.appendChild(el('div', { style: 'overflow-x:auto' }, [el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { style: 'width:34px' }, [all]), el('th', { style: 'width:36px', text: '#' }),
          el('th', { text: '회사' }), el('th', { text: '보낸 서류' }), el('th', { text: '보낸 날' }), el('th', { text: '지남' }), el('th', { text: '' })])]), tb])]));
      }
      if (v.done.length) {
        var dtb = el('tbody');
        v.done.forEach(function (a) {
          dtb.appendChild(el('tr', { 'class': 'click', title: '이 회사 계약서 보기', onclick: function () { S.tab = 'co'; S.sel = a.key; S.cos.some(function (c) { return c.key === a.key; }) ? loadDocs() : load(true); } }, [
            el('td', null, [el('b', { text: a.name })]), el('td', { 'class': 'nm', text: (a.names || []).join(', ') || '—' }),
            el('td', { text: ymd(a.at) }), el('td', { text: ymd(a.got) }), el('td', { 'class': 'muted', text: '🔒 서명본' })]));
        });
        box.appendChild(el('b', { style: 'display:block;font-size:13px;margin:8px 0 6px', text: '✅ 최근 회수 (' + AWAIT_DONE_DAYS + '일)' }));
        box.appendChild(el('div', { style: 'overflow-x:auto' }, [el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { text: '회사' }), el('th', { text: '보낸 서류' }),
          el('th', { text: '보낸 날' }), el('th', { text: '받은 날' }), el('th', { text: '' })])]), dtb])]));
      }
      return box;
    }

    /* ── 사진첩에서 가져오기 ──
       ⚠ 2026-10-03 사진첩의 보호(서버 경유·열람 기록)를 지키려고 기본은 🔒 서명본(대표·관리자만 연다) —
       PC 폴더·메일 첨부와 같은 기본값. 끄면 예전처럼 전 직원이 연다. */
    function openPhotoImport() {
      var photos = host.photos;
      if (!photos) { toast('사진첩을 불러오지 못했습니다'); return; }
      var grid = el('div', { 'class': 'pod-pick' }, [el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1', text: '내 사진첩에서 계약서를 찾는 중…' })]);
      var coIn = el('input', { type: 'text', list: 'pod-cos', placeholder: '회사 이름' });
      var tIn = el('input', { type: 'text', placeholder: '예: 자문계약서' });
      var dIn = el('input', { type: 'date' });
      var secretCb = el('input', { type: 'checkbox', checked: true });
      var pick = null;
      var close = modalShell('사진첩에서 가져오기 — 내 사진첩의 «계약서»', [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '사진첩 원본은 그대로 두고, 사본을 원본 보관함에 담아 회사에 붙입니다.' }),
        grid, el('label', { text: '회사 *' }), coIn, coList(), el('label', { text: '제목' }), tIn, el('label', { text: '계약일' }), dIn,
        el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12.5px;color:#854d0e' },
          [secretCb, '🔒 서명본으로 가져옴 — 목록 줄(회사·제목·날짜)은 직원 모두 보고, 파일 열기는 대표·관리자만'])
      ], function (cl) {
        var go = el('button', { type: 'button', 'class': 'pod-b p', text: '가져오기', onclick: function () {
          if (!pick) { toast('사진을 고르세요'); return; }
          var co = coIn.value.trim();
          if (!co) { toast('회사 이름을 넣으세요'); coIn.focus(); return; }
          if (pick.imported && !w.confirm('이미 가져온 사진입니다. 한 번 더 붙일까요?')) return;
          go.disabled = true; go.textContent = '가져오는 중…';
          var it = pick, secret = secretCb.checked;
          photos.loadFull(it.year, it.id).then(function (dataUrl) {
            var bytes = store.dataUrlToBytes(dataUrl);
            var type = (/^data:([^;,]+)/.exec(dataUrl) || [])[1] || 'image/jpeg';
            var ext = type === 'image/png' ? '.png' : (type === 'image/heic' ? '.heic' : '.jpg');
            var title = tIn.value.trim() || it.title;
            return store.putOriginal({ name: store.safeFileName(title) + ext, size: bytes.length, type: type, bytes: bytes },
              { kind: 'photo', owner: String(host.uid || ''), year: String(it.year), photoId: String(it.id), coKey: store.coKey(co), coName: co }, { secret: secret })
              .then(function (r) { return store.addCoDoc({ coName: co, fileId: r.fileId, title: title, date: dIn.value, src: 'photo', secret: secret }); });
          }).then(function (r) {
            cl(); toast('✅ ' + co + ' 에 가져왔습니다' + (secret ? ' (🔒 서명본)' : '')); S.sel = r.coKey; load(true);
          }).catch(function (e) { go.disabled = false; go.textContent = '가져오기'; toast('❌ 가져오지 못했습니다 — ' + msg(e)); });
        } });
        return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: cl }), go];
      });
      Promise.resolve(host.photosReady).then(function () {
        return Promise.all([photos.listYears(), store.listOriginals()]);
      }).then(function (r) {
        var imported = {};
        r[1].forEach(function (o) { if (o.from && o.from.kind === 'photo' && o.from.photoId) imported[o.from.photoId] = true; });
        return Promise.all(r[0].map(function (y) { return photos.listYear(y).then(function (items) { return [y, items]; }, function () { return [y, {}]; }); }))
          .then(function (pairs) { var by = {}; pairs.forEach(function (p) { by[p[0]] = p[1]; }); return photoCandidates(by, imported); });
      }).then(function (cands) {
        grid.innerHTML = '';
        if (!cands.length) { grid.appendChild(el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1', text: '내 사진첩에 «계약서»로 분류된 사진이 없습니다' })); return; }
        cands.forEach(function (c) {
          var th = el('div', { 'class': 'pod-th', text: '🖼' });
          var card = el('button', { type: 'button', 'class': 'pod-card', onclick: function () {
            pick = c;
            Array.prototype.forEach.call(grid.querySelectorAll('.pod-card'), function (x) { x.classList.remove('sel'); });
            card.classList.add('sel');
            if (c.company) coIn.value = c.company;
            tIn.value = c.title; dIn.value = c.date;
          } }, [th, el('div', { 'class': 'pod-cm' }, [
            el('b', null, [c.company || '(회사 모름)', c.imported ? el('span', { 'class': 'pod-tag done', text: '가져옴' }) : null]),
            el('span', { text: c.title + ' · ' + c.date })])]);
          grid.appendChild(card);
          photos.loadThumb(c.year, c.id, undefined, c.loc).then(function (src) {
            if (!src) return; th.textContent = ''; th.appendChild(el('img', { src: src, alt: '' }));
          }, function () {});
        });
      }).catch(function (e) {
        grid.innerHTML = '';
        grid.appendChild(el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1;color:#991b1b', text: '사진첩을 읽지 못했습니다 — ' + msg(e) }));
      });
      return close;
    }

    /* ── 계약 기록 고치기·더하기 (설계 2026-10-03 §3) — 지워도 파일은 남는다 ── */
    var KINDS = (w.PuCoRoster && w.PuCoRoster.KINDS) || ['급여관리', '자문', '컨설팅', '사건', '기금', 'CMS', 'EDI', '제안서', '기타'];
    function won(n) { return n == null || n === '' ? '' : String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function openRec(r, pre) {
      var key = S.sel, isNew = !r; r = r || Object.assign({ kind: '자문', date: ymd(Date.now()) }, pre || {});
      var dIn = el('input', { type: 'date', value: r.date || '' });
      var kSel = el('select', null, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = r.kind || '기타';
      var aIn = el('input', { type: 'text', inputmode: 'numeric', placeholder: '예: 220,000', value: won(r.amount) });
      var pIn = el('input', { type: 'text', placeholder: '예: 25 · 말일', value: r.payDay || '' });
      var eIn = el('input', { type: 'text', placeholder: '○ 또는 빈칸', value: r.edi || '' });
      var sIn = el('input', { type: 'text', placeholder: '우리 담당', value: r.staff || '' });
      var nIn = el('input', { type: 'text', placeholder: '메모(200자)', value: r.note || '' });
      modalShell((coName(key) || '') + ' · 계약 기록' + (isNew ? ' 더하기' : ''), [
        el('label', { text: '계약일' }), dIn, el('label', { text: '종류' }), kSel, el('label', { text: '금액(원)' }), aIn,
        el('label', { text: '지급일' }), pIn, el('label', { text: 'EDI' }), eIn, el('label', { text: '담당' }), sIn, el('label', { text: '메모' }), nIn,
        r.src === 'import' ? el('div', { style: 'font-size:12px;color:#64748b;margin-top:8px', text: '엑셀 명단에서 가져온 기록입니다' + (r.byName ? ' · ' + r.byName : '') }) : null
      ], function (close) {
        var patch = function () {
          var a = String(aIn.value).replace(/\D/g, '');
          return { date: dIn.value, kind: kSel.value, amount: a === '' ? null : +a,
            payDay: pIn.value.trim(), edi: eIn.value.trim(), staff: sIn.value.trim(), note: nIn.value.trim() };
        };
        return [
          isNew ? null : el('button', { type: 'button', 'class': 'pod-b', text: '이 기록 지우기', title: '기록만 지웁니다 — 파일은 그대로', onclick: function () {
            if (!w.confirm('이 계약 기록을 지울까요?\n(계약서 파일은 그대로 남습니다)')) return;
            store.removeCoRec(key, r.id).then(function () { close(); toast('지웠습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); });
          } }),
          el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }),
          el('button', { type: 'button', 'class': 'pod-b p', text: '저장', onclick: function () {
            var p = isNew ? store.importCoRecs([Object.assign({ coName: coName(key) }, patch(), r.docId ? { docId: r.docId } : {})]).then(function (x) { if (!x.added) throw new Error('같은 날짜·종류 기록이 이미 있습니다'); })
              : store.updateCoRec(key, r.id, patch());
            p.then(function () { close(); toast('저장했습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); });
          } })
        ];
      });
    }
    function removePicked() {
      var key = S.sel, ids = Object.keys(S.picked).filter(function (k) { return S.picked[k]; });
      if (!ids.length) return;
      if (!w.confirm('계약 기록 ' + ids.length + '건을 지울까요?\n(계약서 파일은 그대로 남습니다)')) return;
      ids.reduce(function (p, id) { return p.then(function () { return store.removeCoRec(key, id); }); }, Promise.resolve())
        .then(function () { toast(ids.length + '건 지웠습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); load(true); });
    }

    /* ── 📥 엑셀 업체명단 가져오기 (설계 2026-10-03 §3 (가), 목업 승인) ──
       파일은 브라우저에서만 읽는다(SheetJS). 이알피 업체·기업정보함(host.cards)과 사업자번호·이름으로 맞춰 본다.
       같은 회사·계약일·종류가 이미 있으면 저장 함수가 건너뛴다(두 번 가져와도 겹치지 않는다). */
    function openRosterImport() {
      var R = w.PuCoRoster, X = w.XLSX;
      if (!R || !X) { toast('엑셀 읽기 도구를 불러오지 못했습니다'); return; }
      var fileIn = el('input', { type: 'file', accept: '.xlsx,.xls,.xlsm' });
      var kSel = el('select', { 'aria-label': '종류' }, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = '급여관리';
      var info = el('div', { style: 'font-size:12px;color:#64748b;margin:8px 0', text: '푸른문서양식의 「급여위임계약서_양식.xlsx」처럼 「업체명단」 시트가 있는 파일을 고르세요. 파일은 이 브라우저에서만 읽습니다.' });
      var box = el('div', { 'class': 'pod-imp', hidden: true });
      var st = { rows: [], on: {}, dup: {}, refs: [] };
      var go = null;
      function count() { return st.rows.filter(function (r, i) { return st.on[i]; }).length; }
      function syncGo() { if (go) { var n = count(); go.disabled = !n; go.textContent = n ? '선택 ' + n + '곳 가져오기' : '가져올 줄을 고르세요'; } }
      function drawRows() {
        box.innerHTML = ''; box.hidden = false;
        var all = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: st.rows.every(function (r, i) { return st.on[i] || st.dup[i]; }) });
        all.addEventListener('change', function () { st.rows.forEach(function (r, i) { if (!st.dup[i]) st.on[i] = all.checked; }); drawRows(); syncGo(); });
        var tb = el('tbody');
        st.rows.forEach(function (r, i) {
          var m = R.matchOf(r, st.refs), cb = el('input', { type: 'checkbox', 'aria-label': r.name, checked: !!st.on[i], disabled: !!st.dup[i] });
          cb.addEventListener('change', function () { st.on[i] = cb.checked; syncGo(); });
          tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { text: String(i + 1) }), el('td', { text: r.name }), el('td', { text: r.bizNo || '' }),
            el('td', { text: r.date || '' }), el('td', { 'class': 'amt', text: won(r.amount) }),
            el('td', { text: [r.payDay ? r.payDay + '일' : '', r.edi ? 'EDI ' + r.edi : ''].filter(Boolean).join(' · ') }),
            el('td', { 'class': st.dup[i] ? 'dup' : m.kind === 'new' ? 'new' : 'ok', text: st.dup[i] ? '이미 있음 (건너뜀)' : m.label })]));
        });
        box.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [all]), el('th', { text: '#' }), el('th', { text: '사업장명' }),
          el('th', { text: '사업자번호' }), el('th', { text: '계약일' }), el('th', { text: '공급대가' }), el('th', { text: '지급일·EDI' }), el('th', { text: '맞춤' })])]), tb]));
      }
      function readFile() {
        var f = fileIn.files[0]; if (!f) return;
        info.textContent = '읽는 중…';
        readBytes(f).then(function (u8) {
          var wb = X.read(u8, { type: 'array', cellDates: true }), sheets = {};
          wb.SheetNames.forEach(function (n) { sheets[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
          var p = R.parseRoster(sheets);
          if (!p.rows.length) { info.textContent = '⚠ 「사업장명」·「계약체결일」 이름표가 있는 명단 시트를 찾지 못했습니다.'; box.hidden = true; st.rows = []; syncGo(); return; }
          var have = {}; S.cos.forEach(function (c) { if (c.r > 0) have[c.key] = 1; });
          var dupP = Promise.all(Object.keys(have).filter(function (k) { return p.rows.some(function (r) { return store.coKey(r.name) === k; }); })
            .map(function (k) { return store.listCoRecs(k).then(function (rs) { return [k, rs]; }, function () { return [k, []]; }); }));
          return Promise.all([dupP, host.cards ? host.cards.rows().catch(function () { return []; }) : []]).then(function (got) {
            var seen = {}; got[0].forEach(function (kv) { kv[1].forEach(function (x) { seen[R.recKey(kv[0], x.date, x.kind)] = 1; }); });
            st.rows = p.rows; st.on = {}; st.dup = {}; st.refs = got[1] || [];
            p.rows.forEach(function (r, i) { st.dup[i] = !!seen[R.recKey(store.coKey(r.name), r.date, kSel.value)]; st.on[i] = !st.dup[i]; });
            info.textContent = '「' + p.sheet + '」 ' + p.rows.length + '줄' + (p.skipped ? ' (빈 줄·표지 ' + p.skipped + '줄 건너뜀)' : '') + ' — 종류를 확인하고 가져오세요.';
            drawRows(); syncGo();
          });
        }).catch(function (e) { info.textContent = '❌ 읽지 못했습니다 — ' + msg(e); });
      }
      fileIn.addEventListener('change', readFile);
      kSel.addEventListener('change', function () { if (fileIn.files[0]) readFile(); });
      modalShell('📥 엑셀 업체명단 가져오기 — 계약 기록', [el('label', { text: '엑셀 파일' }), fileIn, el('label', { text: '계약 종류' }), kSel, info, box],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '가져올 줄을 고르세요', disabled: true, onclick: function () {
            var pick = st.rows.filter(function (r, i) { return st.on[i]; }).map(function (r) {
              return { coName: r.name, bizNo: r.bizNo, date: r.date, kind: kSel.value, amount: r.amount, payDay: r.payDay, tax: r.tax, edi: r.edi, staff: r.staff, contact: r.contact, src: 'import' };
            });
            if (!pick.length) return;
            go.disabled = true;
            store.importCoRecs(pick, function (i, n) { go.textContent = '가져오는 중… ' + i + '/' + n; }).then(function (x) {
              close(); toast('✅ ' + x.cos + '곳 · 기록 ' + x.added + '건 가져왔습니다' + (x.skipped ? ' (이미 있던 ' + x.skipped + '건 건너뜀)' : '')); load(true);
            }, function (e) { go.disabled = false; syncGo(); toast('❌ 가져오지 못했습니다 — ' + msg(e)); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: close }), go];
        });
    }

    /* ── ✉ 파일 골라 보내기 — 이 회사 계약서 파일을 메일로. 보내는 길·보낸 기록은 계약서 양식 보내기와 같은 것(host.mail) ──
       ⚠ 「✉ 보내기」를 누르기 전엔 아무것도 나가지 않는다. 받는 주소는 기록하지 않는다.
       ⚠ 🔒 서명본은 서버가 대표·관리자에게만 내준다 — 그 밖의 사람은 붙이지 못한다. 붙이면 한 번 더 묻는다. */
    function openResend(pre) {
      if (!host.mail || !host.fileBytes) { toast('메일 보내는 길이 연결되지 않았습니다'); return; }
      var key = S.sel, co = S.cos.filter(function (c) { return c.key === key; })[0] || {};
      var docs = S.docs.slice(), on = {}, busy = false, mode = 'auto', targets = { co: null, to: [] };
      Object.keys(pre || {}).forEach(function (k) { if (pre[k]) on[k] = true; });   /* 표에서 고른 것을 미리 체크 */
      var MAX = 18 * 1024 * 1024;
      var listBox = el('div', { style: 'max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px' });
      docs.forEach(function (d) {
        var cb = el('input', { type: 'checkbox', 'aria-label': d.title || '파일', checked: !!on[d.id], onchange: function () { on[d.id] = cb.checked; fill(); } });
        listBox.appendChild(el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:12.5px;padding:3px 0' }, [cb,
          el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: d.title || '(제목 없음)' }),
          el('span', { 'class': 'muted', style: 'color:#94a3b8;font-size:11.5px', text: d.date || '' }),
          d.secret ? el('span', { 'class': 'pod-tag', text: '🔒 서명본' }) : null]));
      });
      var toSel = el('select', { 'aria-label': '받는 사람', style: 'width:100%' }, [el('option', { value: '', text: '직접 적기…' })]);
      var toIn = el('input', { type: 'email', placeholder: '받는 메일 주소', 'aria-label': '받는 메일 주소', style: 'width:100%;margin-top:4px' });
      toSel.addEventListener('change', function () { toIn.hidden = !!toSel.value; fill(true); });
      var ccIn = el('input', { type: 'text', placeholder: '(선택) 참조 메일', 'aria-label': '참조 메일', style: 'width:100%' });
      var subIn = el('input', { type: 'text', 'aria-label': '제목', style: 'width:100%' });
      var bodyIn = el('textarea', { 'aria-label': '본문', rows: 8, style: 'width:100%;font:inherit;font-size:12.5px' });
      var note = el('div', { style: 'font-size:12px;color:#64748b;min-height:16px;margin-top:6px' });
      var touched = false;
      subIn.addEventListener('input', function () { touched = true; }); bodyIn.addEventListener('input', function () { touched = true; });
      function picked() { return docs.filter(function (d) { return on[d.id]; }); }
      function who() { var t = targets.to.filter(function (x) { return x.v === toSel.value; })[0]; return t ? t.who : ''; }
      /* 제목·본문은 손대기 전까지만 고른 파일·받는 사람을 따라간다 */
      function fill() {
        if (!touched) { var m = resendMail(co.name || '', who(), picked().map(function (d) { return d.title || '서류'; })); subIn.value = m.subject; bodyIn.value = m.body; }
        if (go) { var n = picked().length; go.disabled = busy || !n; go.textContent = n ? '✉ ' + n + '개 보내기' : '보낼 파일을 고르세요'; }
      }
      function addr() { return String(toSel.value || toIn.value || '').trim(); }
      function gather() {
        var list = picked(), out = [];
        return list.reduce(function (p, d, i) {
          return p.then(function () {
            note.textContent = '파일 가져오는 중… (' + (i + 1) + '/' + list.length + ')';
            return host.fileBytes(d.fileId).then(function (f) { out.push(f); });
          });
        }, Promise.resolve()).then(function () { return out; });
      }
      function record(fs) {
        return Promise.resolve().then(function () {
          return host.mail.record({ bz: co.bz || '' }, { 회사명: co.name || '', 사업자번호: co.bz || '' },
            { kind: sentKindOf(picked().map(function (d) { return d.title; })), names: fs.map(function (f) { return f.name; }), who: who() });
        }).then(function () { return ''; }, function (e) { return msg(e); });
      }
      var go = null;
      modalShell('✉ 파일 골라 보내기 — ' + (co.name || ''), [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:6px', text: '이 회사 계약서 파일을 골라 메일로 보냅니다. 보내면 「✉ 보낸 서류」에 남습니다(받는 주소는 남기지 않음).' }),
        el('b', { style: 'display:block;font-size:12.5px;margin:4px 0', text: '보낼 파일' }), docs.length ? listBox : el('div', { 'class': 'pod-empty', text: '올린 계약서 파일이 없습니다' }),
        el('label', { text: '받는 사람' }), toSel, toIn, el('label', { text: '참조' }), ccIn, el('label', { text: '제목' }), subIn, el('label', { text: '본문' }), bodyIn, note],
        function (cl) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '보낼 파일을 고르세요', disabled: true, onclick: function () {
            if (busy) return;
            var to = addr(), list = picked();
            if (!list.length) return;
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { note.textContent = '⚠ 받는 메일 주소를 확인하세요'; return; }
            if (!subIn.value.trim() || !bodyIn.value.trim()) { note.textContent = '⚠ 제목과 본문을 적어 주세요'; return; }
            var sec = list.filter(function (d) { return d.secret; });
            if (sec.length && !w.confirm('🔒 서명본 ' + sec.length + '개를 회사 밖(' + to + ')으로 보냅니다.\n주민번호·계좌가 들어 있을 수 있습니다. 받는 주소가 맞습니까?')) return;
            busy = true; fill();
            gather().then(function (fs) {
              var total = fs.reduce(function (n, f) { return n + f.bytes.length; }, 0);
              if (total > MAX) throw new Error('첨부가 18MB를 넘어 보낼 수 없습니다 — 파일을 나눠 보내세요');
              if (mode !== 'auto') {
                fs.forEach(function (f) {
                  var a = w.document.createElement('a'); a.href = w.URL.createObjectURL(new Blob([f.bytes])); a.download = f.name;
                  w.document.body.appendChild(a); a.click(); setTimeout(function () { w.URL.revokeObjectURL(a.href); a.remove(); }, 1500);
                });
                w.location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subIn.value) + '&body=' + encodeURIComponent(bodyIn.value);
                if (!w.confirm('메일 창에서 보내셨으면 「보낸 서류」에 기록을 남길까요?')) return 'none';
                return record(fs).then(function (err) { return err ? '기록 실패: ' + err : 'mailto'; });
              }
              note.textContent = '보내는 중…';
              return host.mail.send({ to: to, cc: ccIn.value.trim(), subject: subIn.value.trim(), body: bodyIn.value, toName: who() }, fs)
                .then(function () { return record(fs).then(function (err) { return err ? 'sent-noted:' + err : 'sent'; }); });
            }).then(function (r) {
              busy = false; cl();
              if (r === 'sent') toast('✉ 보냈습니다 — 보낸 서류에 기록했습니다');
              else if (String(r).indexOf('sent-noted:') === 0) toast('✉ 보냈습니다 — ⚠ 기록 저장 실패: ' + String(r).slice(11));
              else if (r === 'mailto') toast('기록했습니다');
              loadDocs();
            }, function (e) { busy = false; fill(); note.textContent = '⚠ ' + msg(e); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: function () { if (!busy) cl(); } }), go];
        });
      fill();
      host.mail.mode().then(function (md) {
        mode = md;
        if (md !== 'auto') note.textContent = '회사 메일 자동 발송이 꺼져 있습니다 — 파일을 받아 메일 창에서 붙여 보냅니다.';
      }, function () {});
      (host.cards ? host.cards.rows().catch(function () { return []; }) : Promise.resolve([])).then(function (rows) {
        targets = mailTargets(rows, co.name || '', co.bz || '');
        targets.to.forEach(function (t) { toSel.insertBefore(el('option', { value: t.v, text: t.label }), toSel.lastChild); });
        if (targets.to.length) { toSel.value = targets.to[0].v; toIn.hidden = true; }
        fill();
      });
    }

    /* ── 🔗 이알피 업체와 맞추기 — ① 사업자번호 넣기 ② 같은 번호 회사 합치기 ── */
    function openLink() {
      if (!host.coLink) { toast('맞추기 길이 연결되지 않았습니다'); return; }
      var box = el('div', { 'class': 'pod-empty', text: '이알피 업체·기업정보함과 맞춰 보는 중…' });
      var st = { plan: [], on: {}, names: {}, busy: false }, go = null;
      function draw2() {
        box.innerHTML = ''; box.className = '';
        var found = st.plan.filter(function (p) { return p.state === 'found'; });
        var have = st.plan.filter(function (p) { return p.state === 'have'; }).length, none = st.plan.filter(function (p) { return p.state === 'none'; }).length;
        box.appendChild(el('div', { style: 'font-size:12.5px;color:#475569;margin-bottom:8px', text: '회사 ' + st.plan.length + '곳 — 사업자번호 있음 ' + have + ' · 이름으로 찾음 ' + found.length + ' · 못 찾음 ' + none }));
        if (found.length) {
          var tb = el('tbody');
          found.forEach(function (p) {
            var cb = el('input', { type: 'checkbox', 'aria-label': p.name, checked: !!st.on[p.key], onchange: function () { st.on[p.key] = cb.checked; sync(); } });
            tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { text: p.name }), el('td', { text: p.refName }), el('td', { text: fmtBz(p.bz) }), el('td', { 'class': 'muted', text: p.from })]));
          });
          box.appendChild(el('b', { style: 'display:block;font-size:13px;margin:6px 0', text: '① 사업자번호 넣기 — 이름이 같은 곳' }));
          box.appendChild(el('div', { style: 'overflow-x:auto' }, [el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { text: '' }), el('th', { text: '기업별 계약서' }),
            el('th', { text: '찾은 이름' }), el('th', { text: '사업자번호' }), el('th', { text: '어디서' })])]), tb])]));
        }
        var groups = bzGroups(S.cos, st.names);
        box.appendChild(el('b', { style: 'display:block;font-size:13px;margin:10px 0 6px', text: '② 사업자번호가 같은 회사 — 하나로 합치기' }));
        if (!groups.length) box.appendChild(el('div', { 'class': 'pod-empty', style: 'padding:10px', text: '사업자번호가 겹치는 회사가 없습니다.' + (found.length ? ' (① 을 넣은 뒤 다시 봅니다)' : '') }));
        groups.forEach(function (g) {
          var keepSel = el('select', { 'aria-label': '남길 회사' }, g.cos.map(function (c, i) {
            return el('option', { value: String(i), text: c.name + ' (' + ((c.n || 0) + (c.r || 0)) + ')' + (g.official && nameKey(c.name) === nameKey(g.official) ? ' · 이알피 이름' : '') });
          }));
          var b = el('button', { type: 'button', 'class': 'pod-b', text: '이 이름으로 합치기', onclick: function () {
            if (st.busy) return;
            var keep = g.cos[+keepSel.value || 0], rest = g.cos.filter(function (c) { return c !== keep; });
            if (!w.confirm(rest.map(function (c) { return '「' + c.name + '」'; }).join(', ') + ' 의 계약 기록·파일 줄을 「' + keep.name + '」로 옮기고 그 회사들은 목록에서 없앱니다.\n(파일은 원본 보관함에 그대로 남습니다)\n합칠까요?')) return;
            st.busy = true; b.disabled = true; b.textContent = '합치는 중…';
            rest.reduce(function (p, c) { return p.then(function () { return host.coMerge(c.key, keep.key); }); }, Promise.resolve()).then(function () {
              toast('✅ 「' + keep.name + '」로 합쳤습니다'); st.busy = false; return load(true).then(refresh);
            }, function (e) { st.busy = false; toast('❌ 합치지 못했습니다 — ' + msg(e)); load(true).then(refresh); });
          } });
          box.appendChild(el('div', { 'class': 'pod-note', style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px' }, [
            el('span', { style: 'flex:1;min-width:200px', text: fmtBz(g.bz) + (g.official ? ' · 이알피 「' + g.official + '」' : '') + ' — ' + g.cos.map(function (c) { return c.name; }).join(' · ') }),
            el('span', { style: 'font-size:12px;color:#64748b', text: '남길 이름' }), keepSel, b]));
        });
        sync();
      }
      function picked() { return st.plan.filter(function (p) { return p.state === 'found' && st.on[p.key]; }); }
      function sync() { if (!go) return; var n = picked().length; go.disabled = st.busy || !n; go.textContent = n ? '① 사업자번호 ' + n + '곳 넣기' : '① 넣을 곳 없음'; }
      modalShell('🔗 이알피 업체와 맞추기', [el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '기업별 계약서의 회사는 이름으로만 묶여 있습니다. 사업자번호를 넣어 두면 같은 회사가 다른 이름으로 들어온 것을 찾아 합칠 수 있습니다. 짐작은 «이름이 같을 때»만 합니다 — 확인하고 넣으세요.' }), box],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '맞춰 보는 중…', disabled: true, onclick: function () {
            var list = picked(); if (!list.length) return;
            st.busy = true; sync();
            list.reduce(function (p, x) { return p.then(function () { return host.coLink(x.key, x.bz); }); }, Promise.resolve()).then(function () {
              toast('✅ 사업자번호 ' + list.length + '곳 넣었습니다'); st.busy = false;
              return load(true).then(function () { return refresh(); });
            }, function (e) { st.busy = false; sync(); toast('❌ ' + msg(e)); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: function () { if (!st.busy) close(); } }), go];
        });
      function refresh() {
        return (host.cards ? host.cards.rows().catch(function () { return []; }) : Promise.resolve([])).then(function (refs) {
          st.plan = linkPlan(S.cos, refs); st.on = {}; st.names = refNames(refs);
          st.plan.forEach(function (p) { if (p.state === 'found') st.on[p.key] = true; });
          draw2();
        });
      }
      refresh().catch(function (e) { box.textContent = msg(e); });
    }
    /* 이 회사로 다른 회사 합치기 — 이름이 달라 사업자번호로 못 묶이는 경우(지점명·옛 이름) */
    function openMerge() {
      var key = S.sel, me = S.cos.filter(function (c) { return c.key === key; })[0];
      if (!me || !host.coMerge) return;
      var others = S.cos.filter(function (c) { return c.key !== key; });
      if (!others.length) { toast('합칠 다른 회사가 없습니다'); return; }
      var sel = el('select', { style: 'width:100%' }, [el('option', { value: '', text: '— 합칠 회사를 고르세요 —' })].concat(others.map(function (c) {
        return el('option', { value: c.key, text: c.name + (c.bz ? ' · ' + fmtBz(c.bz) : '') + ' (기록 ' + (c.r || 0) + ' · 파일 ' + (c.n || 0) + ')' });
      })));
      modalShell('🔗 「' + me.name + '」로 합치기', [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '고른 회사의 계약 기록·파일 줄을 「' + me.name + '」로 옮기고, 고른 회사는 목록에서 없앱니다. 파일은 원본 보관함에 그대로 남습니다. 옮긴 줄의 «올린 사람»은 합친 사람으로 바뀝니다.' }),
        el('label', { text: '합칠 회사' }), sel],
        function (close) {
          var go = el('button', { type: 'button', 'class': 'pod-b p', text: '합치기', onclick: function () {
            var from = others.filter(function (c) { return c.key === sel.value; })[0];
            if (!from) { toast('합칠 회사를 고르세요'); return; }
            if (from.bz && me.bz && bzDigits(from.bz) !== bzDigits(me.bz) && !w.confirm('사업자번호가 다릅니다 (' + fmtBz(from.bz) + ' ≠ ' + fmtBz(me.bz) + ').\n그래도 합칠까요?')) return;
            if (!w.confirm('「' + from.name + '」를 「' + me.name + '」로 합칠까요?')) return;
            go.disabled = true; go.textContent = '합치는 중…';
            host.coMerge(from.key, key).then(function () { close(); toast('✅ 「' + me.name + '」로 합쳤습니다'); load(true); },
              function (e) { go.disabled = false; go.textContent = '합치기'; toast('❌ 합치지 못했습니다 — ' + msg(e)); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }), go];
        });
    }

    /* ── 🔒 이미 올린 것 서명본으로 옮기기 (2026-10-04 대표 「네」) ──
       2026-10-03 전에 사진첩에서 가져온 계약서, 줄은 🔒 인데 원본은 보통 자리인 것(같은 파일 다시 쓰기)이 후보.
       후보 고르기·옮기기는 서버(puDocSecretMove, 총괄관리자만)가 한다 — 화면은 목록을 보여 주고 번호만 넘긴다.
       옮기면 보통 자리 파일은 지워진다(예전 내려받기 주소도 죽는다). 20개씩 나눠 보낸다. */
    function openSecretMove() {
      if (!host.secretMove) { toast('서명본으로 옮기는 길이 연결되지 않았습니다'); return; }
      var box = el('div', { 'class': 'pod-empty', text: '옮길 것을 찾는 중…' });
      var go = null, items = [], on = {}, busy = false;
      function drawItems() {
        box.innerHTML = ''; box.className = '';
        if (!items.length) { box.className = 'pod-empty'; box.textContent = '옮길 것이 없습니다 — 보통 자리에 남은 사진첩 계약서가 없습니다.'; go.disabled = true; return; }
        items.forEach(function (c) {
          var cb = el('input', { type: 'checkbox', checked: !!on[c.fileId], onchange: function () { on[c.fileId] = cb.checked; count(); } });
          box.appendChild(el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:12.5px;padding:3px 0;border-bottom:1px solid #f1f5f9' }, [cb,
            el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: (c.coName ? c.coName + ' · ' : '') + (c.title || c.name) }),
            el('span', { 'class': 'pod-tag', text: c.why === 'photo' ? '사진첩' : '줄만 🔒' })]));
        });
        count();
      }
      function picked() { return items.filter(function (c) { return on[c.fileId]; }).map(function (c) { return c.fileId; }); }
      function count() { var n = picked().length; go.disabled = busy || !n; go.textContent = n ? '🔒 ' + n + '개 서명본으로 옮기기' : '옮길 것을 고르세요'; }
      modalShell('🔒 이미 올린 것 서명본으로 옮기기 (대표·관리자)', [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '사진첩에서 가져와 직원 누구나 열 수 있는 계약서를 🔒 서명본 자리로 옮깁니다. 옮기면 목록 줄은 그대로 보이고, 파일 열기는 대표·관리자만 됩니다. 예전 자리의 파일과 내려받기 주소는 없어집니다.' }),
        box],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '찾는 중…', disabled: true, onclick: function () {
            var ids = picked();
            if (!ids.length || !w.confirm(ids.length + '개를 🔒 서명본으로 옮길까요?\n(직원은 더 이상 파일을 열 수 없습니다)')) return;
            busy = true; count();
            var moved = 0, failed = 0, oldLeft = 0, chunks = [];
            for (var i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
            chunks.reduce(function (p, ch) {
              return p.then(function () {
                go.textContent = '옮기는 중… ' + moved + '/' + ids.length;
                return host.secretMove({ mode: 'move', fileIds: ch }).then(function (j) {
                  moved += (j.moved || []).length; failed += (j.failed || []).length;
                  (j.moved || []).forEach(function (m) { if (!m.oldGone) oldLeft++; });
                });
              });
            }, Promise.resolve()).then(function () {
              close(); urlCache = {}; load(true);
              toast('✅ ' + moved + '개를 🔒 서명본으로 옮겼습니다' + (failed ? ' · 못 옮김 ' + failed + '개' : '') + (oldLeft ? ' · 예전 자리 파일 ' + oldLeft + '개는 못 지움(다시 시도하세요)' : ''));
            }, function (e) { busy = false; count(); urlCache = {}; toast('❌ ' + msg(e) + (moved ? ' (' + moved + '개는 옮겼습니다)' : '')); load(true); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: function () { if (!busy) close(); } }), go];
        });
      host.secretMove({ mode: 'list' }).then(function (j) {
        items = j.items || [];
        items.forEach(function (c) { on[c.fileId] = true; });
        drawItems();
      }, function (e) { box.textContent = msg(e); go.textContent = '옮길 수 없습니다'; });
    }

    /* ── 📂 PC 폴더 가져오기 (설계 2026-10-03 §3 (나), 목업 승인) ──
       폴더를 끌어다 놓거나 고르면 파일 이름·폴더 이름으로 «우리와 맺은 계약서류»만 고르고 회사·종류·날짜를 짐작한다(PuCoRoster.folderRows).
       고객사 직원 자료(근로계약서·급여대장 등)는 기본으로 뺀다. 기본은 🔒 서명본으로 올린다(대표·관리자만 연다).
       같은 파일(해시)은 원본 보관함에 다시 올리지 않는다. 올린 파일은 그 회사의 계약 기록에도 한 줄씩 붙는다. */
    function walkEntry(entry, prefix, out) {
      return new Promise(function (res) {
        if (entry.isFile) { entry.file(function (f) { out.push({ file: f, path: prefix + f.name }); res(); }, function () { res(); }); return; }
        if (!entry.isDirectory) { res(); return; }
        var rd = entry.createReader(), all = [];
        (function more() {
          rd.readEntries(function (ents) {
            if (!ents.length) { Promise.all(all.map(function (e) { return walkEntry(e, prefix + entry.name + '/', out); })).then(function () { res(); }); return; }
            all = all.concat(Array.prototype.slice.call(ents)); more();
          }, function () { res(); });
        })();
      });
    }
    function openFolderImport() {
      var R = w.PuCoRoster;
      if (!R || !R.folderRows) { toast('폴더 읽기 도구를 불러오지 못했습니다'); return; }
      var st = { rows: [], files: [], on: {}, dup: {}, showOthers: false, busy: false };
      var dirIn = el('input', { type: 'file', multiple: true, webkitdirectory: true, style: 'display:none' });
      var drop = el('label', { 'class': 'pod-note', style: 'display:block;text-align:center;cursor:pointer;border-style:dashed' },
        ['📂 폴더를 여기에 끌어다 놓거나 눌러서 고르세요 · 예: 바탕 화면\\10. 자문사관리', dirIn]);
      var secretCb = el('input', { type: 'checkbox', checked: true });
      var info = el('div', { style: 'font-size:12px;color:#64748b;margin:8px 0' });
      var box = el('div', { 'class': 'pod-imp', hidden: true });
      var go = null;
      function picked() { return st.rows.filter(function (r, i) { return st.on[i] && !st.dup[i]; }); }
      function syncGo() { if (go && !st.busy) { var n = picked().length; go.disabled = !n; go.textContent = n ? '선택 ' + n + '개 올리기' : '올릴 파일을 고르세요'; } }
      function drawRows() {
        box.innerHTML = ''; box.hidden = !st.rows.length;
        var idx = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.showOthers || st.rows[i].ours; });
        var all = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: idx.length && idx.every(function (i) { return st.on[i] || st.dup[i]; }) });
        all.addEventListener('change', function () { idx.forEach(function (i) { if (!st.dup[i]) st.on[i] = all.checked; }); drawRows(); syncGo(); });
        var tb = el('tbody');
        idx.forEach(function (i, n) {
          var r = st.rows[i];
          var cb = el('input', { type: 'checkbox', 'aria-label': r.name, checked: !!st.on[i], disabled: !!st.dup[i] });
          cb.addEventListener('change', function () { st.on[i] = cb.checked; syncGo(); });
          var coIn = el('input', { type: 'text', list: 'pod-cos', value: r.co, placeholder: '회사 이름', style: 'width:150px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px' });
          coIn.addEventListener('input', function () { r.co = coIn.value.trim(); });
          var kSel = el('select', { style: 'font-size:12px;padding:2px 4px' }, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = r.kind;
          kSel.addEventListener('change', function () { r.kind = kSel.value; });
          var dIn = el('input', { type: 'date', value: r.date, style: 'font-size:12px;padding:2px 4px;border:1px solid #cbd5e1;border-radius:5px' });
          dIn.addEventListener('change', function () { r.date = dIn.value; r.dateFrom = 'name'; });
          tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { text: String(n + 1) }),
            el('td', { title: r.path, text: r.name }), el('td', null, [coIn]), el('td', null, [kSel]),
            el('td', { title: r.dateFrom === 'file' ? '파일 이름에 날짜가 없어 파일 날짜로 짐작했습니다' : '' }, [dIn, r.dateFrom === 'file' ? el('span', { 'class': 'new', text: ' 파일날짜' }) : null]),
            el('td', { 'class': st.dup[i] ? 'dup' : r.ours ? 'ok' : 'new', text: st.dup[i] ? '이미 보관함에 있음' : r.ours ? '새 파일' : '계약서류 아님(뺌)' })]));
        });
        box.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [all]), el('th', { text: '#' }), el('th', { text: '파일' }),
          el('th', { text: '회사' }), el('th', { text: '종류' }), el('th', { text: '계약일' }), el('th', { text: '상태' })])]), tb]));
      }
      function take(list) {
        var ok = list.filter(function (x) { return store.okDocFile(x.file.name, x.file.size).ok; });
        st.files = ok; st.rows = R.folderRows(ok.map(function (x) { return { name: x.file.name, size: x.file.size, lastModified: x.file.lastModified, path: x.path }; }));
        st.on = {}; st.dup = {};
        st.rows.forEach(function (r, i) { st.on[i] = r.ours; });
        var ours = st.rows.filter(function (r) { return r.ours; }).length;
        info.innerHTML = '';
        info.appendChild(el('span', { text: list.length + '개 파일 중 계약서류 ' + ours + '개를 골랐습니다 · 근로계약서·급여대장 등 ' + (st.rows.length - ours) + '개는 뺐습니다 ' }));
        info.appendChild(el('button', { type: 'button', 'class': 'pod-b', text: st.showOthers ? '뺀 것 숨기기' : '뺀 것 보기', onclick: function () { st.showOthers = !st.showOthers; take(list); } }));
        drawRows(); syncGo();
        /* 이미 보관함에 있는지 — 고른 것만 해시로 본다(넷씩) */
        var todo = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.rows[i].ours; }), k = 0;
        function next() {
          if (k >= todo.length) return Promise.resolve();
          var i = todo[k++];
          return readBytes(st.files[i].file).then(function (u8) { return store.sha256Hex(u8); })
            .then(function (h) { return store.hasHash ? store.hasHash(h) : false; })
            .then(function (have) { if (have) { st.dup[i] = true; st.on[i] = false; } }, function () {})
            .then(next);
        }
        Promise.all([next(), next(), next(), next()]).then(function () { if (!st.busy) { drawRows(); syncGo(); } });
      }
      dirIn.addEventListener('change', function () {
        take(Array.prototype.map.call(dirIn.files || [], function (f) { return { file: f, path: f.webkitRelativePath || f.name }; }));
      });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        var items = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.items) || []), out = [];
        Promise.all(items.map(function (it) { var en = it.webkitGetAsEntry && it.webkitGetAsEntry(); return en ? walkEntry(en, '', out) : Promise.resolve(); }))
          .then(function () { take(out); });
      });
      modalShell('📂 PC 폴더 가져오기 — 기업별 계약서', [drop,
        el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12.5px;color:#854d0e' },
          [secretCb, '🔒 서명본으로 올림 — 목록 줄(회사·종류·날짜)은 직원 모두 보고, 파일 열기는 대표·관리자만']),
        info, box, coList()],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '올릴 파일을 고르세요', disabled: true, onclick: function () {
            var list = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.on[i] && !st.dup[i]; });
            var noCo = list.filter(function (i) { return !st.rows[i].co; });
            if (noCo.length) { toast('회사 이름이 빈 줄이 ' + noCo.length + '개 있습니다 — 적거나 빼 주세요'); return; }
            st.busy = true; go.disabled = true;
            var done = 0, reused = 0, fail = 0, secret = secretCb.checked;
            list.reduce(function (p, i) {
              return p.then(function () {
                var r = st.rows[i], f = st.files[i].file;
                go.textContent = '올리는 중… ' + (done + 1) + '/' + list.length;
                return readBytes(f).then(function (bytes) {
                  return store.putOriginal({ name: f.name, size: f.size, type: f.type || '', bytes: bytes },
                    { kind: 'folder', coKey: store.coKey(r.co), coName: r.co, path: String(r.path).slice(0, 200) }, { secret: secret });
                }).then(function (o) {
                  if (o.reused) reused++;
                  return store.addCoDoc({ coName: r.co, fileId: o.fileId, title: r.name.replace(/\.[^.]+$/, ''), date: r.date, src: 'folder', secret: secret });
                }).then(function (d) {
                  return store.importCoRecs([{ coName: r.co, date: r.date, kind: r.kind, src: 'folder', docId: d.docId }]);
                }).then(function () { done++; }, function (e) { fail++; done++; if (fail === 1) toast('❌ ' + r.name + ' — ' + msg(e)); });
              });
            }, Promise.resolve()).then(function () {
              close(); toast('✅ ' + (done - fail) + '개 올렸습니다' + (reused ? ' (이미 있던 파일 ' + reused + '개는 다시 안 올림)' : '') + (fail ? ' · 실패 ' + fail + '개' : '')); load(true);
            });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: close }), go];
        });
    }

    /* ── 큰 보기 ── */
    function openDoc(d) {
      var key = S.sel;
      var view = el('div', { style: 'min-height:320px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:8px', text: '불러오는 중…' });
      var tIn = el('input', { type: 'text', value: d.title || '' });
      var dIn = el('input', { type: 'date', value: d.date || '' });
      var g0 = guessDocKind(d.title);
      var kSel = el('select', { 'aria-label': '계약 종류' }, [el('option', { value: '', text: g0 ? '(제목으로 짐작: ' + g0 + ')' : '(정하지 않음 — 미분류)' })]
        .concat(KINDS.map(function (k) { return el('option', { value: k, text: k }); })));
      kSel.value = d.kind || '';
      var rec = null;
      modalShell((coName(key) || '') + ' · ' + (d.title || '계약서'), [view,
        el('label', { text: '제목' }), tIn, el('label', { text: '계약일' }), dIn,
        el('label', { text: '종류 (갈래별 정리에 쓰입니다)' }), kSel
      ], function (close) {
        return [
          el('button', { type: 'button', 'class': 'pod-b', text: '이 회사에서 빼기', title: '연결만 끊습니다 — 파일은 원본 보관함에 남습니다', onclick: function () {
            if (!w.confirm('이 회사 목록에서 뺄까요?\n(파일은 원본 보관함에 그대로 남습니다)')) return;
            store.unlinkCoDoc(key, d.id).then(function () { close(); toast('뺐습니다 — 파일은 보관함에 남아 있습니다'); load(true); },
              function (e) { toast('❌ ' + msg(e)); });
          } }),
          el('button', { type: 'button', 'class': 'pod-b', text: '📥 내려받기', onclick: function () { host.download(d.fileId, rec ? rec.name : d.title); } }),
          el('button', { type: 'button', 'class': 'pod-b p', text: '저장', onclick: function () {
            store.updateCoDoc(key, d.id, { title: tIn.value.trim() || d.title, date: dIn.value, kind: kSel.value }).then(function () { close(); toast('저장했습니다'); loadDocs(); loadIndex(); },
              function (e) { toast('❌ ' + msg(e)); });
          } })
        ];
      });
      if (d.secret) {
        view.textContent = '';
        var openBtn = el('button', { type: 'button', 'class': 'pod-b p', text: '🔒 서명본 열기 (대표·관리자)', onclick: function () {
          openBtn.disabled = true; openBtn.textContent = '여는 중…';
          store.secretBlob(d.fileId).then(function (blob) {
            var url = w.URL.createObjectURL(blob); view.textContent = '';
            if (/^image\//.test(blob.type)) view.appendChild(el('img', { src: url, alt: d.title || '', style: 'max-width:100%;max-height:60vh' }));
            else if (/pdf/.test(blob.type)) view.appendChild(el('iframe', { src: url, title: d.title || 'PDF', style: 'width:100%;height:60vh;border:none' }));
            else view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '📄' }), el('div', { text: '미리보기가 없는 종류입니다 — [📥 내려받기]로 여세요' })]));
          }, function (e) { view.textContent = msg(e); });
        } });
        view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '🔒' }),
          el('div', { style: 'margin:6px 0 10px', text: '서명본입니다 — 대표·관리자만 열 수 있습니다(연 기록이 남습니다).' }), openBtn]));
        return;
      }
      urlFor(d.fileId).then(function (u) {
        rec = u.rec;
        if (!u.rec) { view.textContent = '보관함에서 파일을 찾지 못했습니다'; return; }
        var url = u.url, r = u.rec;
        view.textContent = '';
        if (isImg(r.name)) view.appendChild(el('img', { src: url, alt: d.title || '', style: 'max-width:100%;max-height:60vh' }));
        else if (/\.pdf$/i.test(r.name)) view.appendChild(el('iframe', { src: url, title: d.title || 'PDF', style: 'width:100%;height:60vh;border:none' }));
        else view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '📄' }), el('div', { text: r.name }), el('div', { style: 'font-size:12px;color:#94a3b8', text: '미리보기가 없는 종류입니다 — 내려받아 여세요' })]));
      }).catch(function (e) { view.textContent = '불러오지 못했습니다 — ' + msg(e); });
    }

    /* 갈래 칩(회사 수) · 대조 칩(줄 수) — 누르면 회사 목록을 거른다. 다시 누르면 푼다 */
    function kindChips() {
      var idx = S.idx || {}, keys = S.cos.map(function (c) { return c.key; });
      var cnt = function (fn) { return keys.filter(function (k) { return idx[k] && fn(idx[k]); }).length; };
      var sum = function (st) { return keys.reduce(function (a, k) { return a + (idx[k] ? idx[k].n[st] : 0); }, 0); };
      var chip = function (on, text, title, fn, tone) {
        return el('button', { type: 'button', 'class': 'pod-kchip' + (on ? ' on' : '') + (tone ? ' ' + tone : ''), title: title, 'aria-pressed': on ? 'true' : 'false', text: text, onclick: fn });
      };
      var row = [chip(!S.grp && !S.chk, '전체 ' + S.cos.length, '거르기 풀기', function () { S.grp = ''; S.chk = ''; draw(); })];
      KIND_GROUPS.forEach(function (g) {
        var n = cnt(function (x) { return x.groups[g.v]; });
        if (n) row.push(chip(S.grp === g.v, g.icon + ' ' + g.label + ' ' + n, g.label + ' 계약이 있는 회사', function () { S.grp = S.grp === g.v ? '' : g.v; draw(); }));
      });
      row.push(el('span', { style: 'width:1px;height:18px;background:#cbd5e1;margin:0 4px' }));
      [['ok', '✓ 맞음', '기록과 파일이 이어진 줄', 'g'], ['missing', '✗ 파일 없음', '계약 기록은 있는데 서명본 파일이 없는 줄 — 회수 필요', 'r'],
        ['norec', '△ 기록 없음', '파일만 있고 계약 기록이 없는 줄 — 기록 만들기', 'a'], ['none', '❓ 미분류 파일', '종류를 알 수 없는 파일 — ✏ 로 종류를 정하세요', 'a']].forEach(function (c) {
        var n = sum(c[0]);
        if (n) row.push(chip(S.chk === c[0], c[1] + ' ' + n, c[2], function () { S.chk = S.chk === c[0] ? '' : c[0]; draw(); }, c[3]));
      });
      return el('div', { 'class': 'pod-kchips', role: 'group', 'aria-label': '갈래·대조로 거르기' }, row);
    }
    /* △ 기록 없는 파일 — 같은 종류의 «파일 없음» 기록이 있으면 거기에 잇기를 먼저 묻는다(취소하면 새 기록) */
    function recForDoc(items, it) {
      var to = linkableRec(items, it), key = S.sel;
      if (to && w.confirm('「' + to.kind + ' · ' + (to.date || '날짜 없음') + '」 계약 기록(✗ 파일 없음)에 이 파일을 이을까요?\n\n'
          + '파일: ' + (it.title || '계약서') + (it.date ? ' (' + it.date + ')' : '') + '\n[취소] 를 누르면 새 기록을 만듭니다')) {
        store.updateCoRec(key, to.rec.id, { docId: it.doc.id }).then(function () { toast('기록에 파일을 이었습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); });
        return;
      }
      openRec(null, { kind: it.kind || '기타', date: it.date || ymd(Date.now()), docId: it.doc.id });
    }
    /* 고른 회사 — 갈래마다 한 묶음: 기록·파일을 한 줄씩, 상태와 할 일 */
    function kindBox() {
      var x = S.idx && S.idx[S.sel];
      if (!x || !x.items.length) return null;
      var by = {};
      x.items.forEach(function (it) { (by[it.group || '_none'] = by[it.group || '_none'] || []).push(it); });
      var order = KIND_GROUPS.map(function (g) { return g.v; }).concat(['_none']);
      var stTxt = { ok: '✓ 서명본', missing: '✗ 파일 없음', norec: '△ 기록 없음', none: '❓ 종류 모름' };
      return el('div', { 'class': 'pod-kbox' }, order.filter(function (v) { return by[v]; }).map(function (v) {
        var g = KIND_GROUPS.filter(function (z) { return z.v === v; })[0] || { icon: '❓', label: '미분류 파일' };
        var list = by[v], c = { ok: 0, missing: 0, norec: 0, none: 0 };
        list.forEach(function (it) { c[it.state]++; });
        return el('div', { 'class': 'pod-kcard' + (S.grp && S.grp !== v ? ' dim' : '') }, [
          el('div', { 'class': 'pod-kh' }, [el('b', { text: g.icon + ' ' + g.label }),
            el('span', { text: '기록 ' + list.filter(function (i) { return i.type === 'rec'; }).length + ' · 파일 ' + list.filter(function (i) { return i.doc; }).length })]),
          el('div', null, list.slice(0, 12).map(function (it) {
            var act = it.state === 'norec' || it.state === 'none'
              ? [el('button', { type: 'button', 'class': 'pod-b', text: it.state === 'none' ? '✏ 종류 정하기' : '+ 기록 만들기',
                  title: it.state === 'none' ? '이 파일의 계약 종류를 정합니다' : '이 파일에 이어진 계약 기록을 만듭니다(종류·날짜는 짐작값 — 고치세요)',
                  onclick: function () { if (it.state === 'none') openDoc(it.doc); else recForDoc(x.items, it); } })]
              : [];
            return el('div', { 'class': 'pod-krow' }, [
              el('span', { 'class': 'pod-kd', text: it.kind || '—' }),
              el('span', { 'class': 'pod-kt', title: it.title, text: (it.date ? it.date + ' · ' : '') + it.title + (it.guessed ? ' (짐작)' : '') }),
              el('span', { 'class': 'pod-ks ' + it.state, text: stTxt[it.state] })].concat(act));
          }).concat(list.length > 12 ? [el('div', { style: 'font-size:11px;color:#94a3b8', text: '외 ' + (list.length - 12) + '줄 — 아래 표에서' })] : []))]);
      }));
    }

    function draw() {
      root.innerHTML = '';
      var wrap = el('div', { 'class': 'pod' });
      wrap.appendChild(el('div', { 'class': 'pod-bar' }, [el('b', { text: '🏢 기업별 계약서' }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📥 엑셀 명단 가져오기', title: '「업체명단」 시트가 있는 엑셀에서 계약 기록을 가져옵니다', onclick: openRosterImport }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📂 PC 폴더 가져오기', title: '회사별 폴더에서 계약서류만 골라 올립니다(기본 🔒 서명본)', onclick: openFolderImport }),
        el('button', { type: 'button', 'class': 'pod-b g', text: '🖼 사진첩에서 가져오기', onclick: openPhotoImport }),
        host.coLink ? el('button', { type: 'button', 'class': 'pod-b', text: '🔗 이알피 업체와 맞추기', title: '사업자번호를 넣고, 같은 회사가 다른 이름으로 들어온 것을 합칩니다', onclick: openLink }) : null,
        host.secretMove ? el('button', { type: 'button', 'class': 'pod-b', text: '🔒 서명본으로 옮기기', title: '이미 올린 사진첩 계약서 중 직원 누구나 여는 것을 🔒 서명본으로 옮깁니다(대표·관리자)', onclick: openSecretMove }) : null,
        el('button', { type: 'button', 'class': 'pod-b p', text: '📎 업로드', onclick: openUpload })]));
      if (S.denied) { wrap.appendChild(deniedBanner()); root.appendChild(wrap); return; }
      if (S.err) { wrap.appendChild(el('div', { 'class': 'pod-empty', style: 'color:#991b1b', text: '불러오지 못했습니다 — ' + S.err })); root.appendChild(wrap); return; }
      if (!S.loaded) { wrap.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); root.appendChild(wrap); return; }
      /* 탭 — 🏢 회사별 · 📬 서명본 대기(기다리는 곳 수) */
      var nWait = S.aw ? awaitView(S.aw).wait.length : 0;
      wrap.appendChild(el('div', { 'class': 'pod-tabs', role: 'tablist' }, [
        el('button', { type: 'button', role: 'tab', 'aria-selected': S.tab === 'co' ? 'true' : 'false', 'class': S.tab === 'co' ? 'on' : null, text: '🏢 회사별', onclick: function () { S.tab = 'co'; draw(); } }),
        el('button', { type: 'button', role: 'tab', 'aria-selected': S.tab === 'await' ? 'true' : 'false', 'class': S.tab === 'await' ? 'on' : null, onclick: function () { S.tab = 'await'; draw(); loadAwait(); } },
          ['📬 서명본 대기', nWait ? el('i', { text: String(nWait) }) : null]),
        host.sign ? el('button', { type: 'button', role: 'tab', 'aria-selected': S.tab === 'sign' ? 'true' : 'false', 'class': S.tab === 'sign' ? 'on' : null, onclick: function () { S.tab = 'sign'; draw(); loadSign(); } },
          ['✍ 서명 요청', S.sg && S.sg.filter(function (r) { var t = w.PuSign && w.PuSign.statusOf(r, r.o); return t === 'sent' || t === 'seen' || t === 'submitted'; }).length
            ? el('i', { style: 'background:#ede9fe;color:#5b21b6', text: String(S.sg.filter(function (r) { var t = w.PuSign.statusOf(r, r.o); return t === 'sent' || t === 'seen' || t === 'submitted'; }).length) }) : null]) : null]));
      if (S.tab === 'await') { wrap.appendChild(awaitPane()); root.appendChild(wrap); return; }
      if (S.tab === 'sign') { wrap.appendChild(signPane()); root.appendChild(wrap); return; }
      if (!S.cos.length) {
        wrap.appendChild(el('div', { 'class': 'pod-empty' }, ['엑셀 업체명단을 가져오거나, 사진첩의 계약서·파일을 올리면 회사별로 모입니다.']));
        root.appendChild(wrap); return;
      }
      if (S.idx) wrap.appendChild(kindChips());
      var search = el('input', { type: 'search', placeholder: '회사 검색', 'aria-label': '회사 검색', value: S.q, style: 'width:100%;border:none;border-bottom:1px solid #e2e8f0;padding:8px 10px;font-size:12.5px' });
      var coFil = el('select', { 'aria-label': '회사 거르기', style: 'width:100%;border:none;border-bottom:1px solid #e2e8f0;padding:6px 8px;font-size:12px;font-family:inherit;background:#f8fafc;color:#475569' },
        [el('option', { value: '', text: '회사 전체 ' + S.cos.length })].concat(CO_FILTERS.map(function (o) { return el('option', { value: o[0], text: o[1] }); })));
      coFil.value = S.cof || '';
      coFil.addEventListener('change', function () { S.cof = coFil.value; drawList(); });
      var listBox = el('div', { 'class': 'pod-co-ls' });
      function drawList() {
        listBox.innerHTML = '';
        var shownCos = filterCosBy(filterCos(S.cos, S.q, S.cof), S.idx, S.grp, S.chk);
        if (!shownCos.length) listBox.appendChild(el('div', { style: 'padding:12px;color:#94a3b8;font-size:12px', text: '맞는 회사가 없습니다' }));
        shownCos.forEach(function (c, i) {
          listBox.appendChild(el('button', { type: 'button', 'class': c.key === S.sel ? 'on' : null, 'aria-current': c.key === S.sel ? 'true' : null,
            onclick: function () { S.sel = c.key; loadDocs(); } }, [el('span', { text: (i + 1) + '. ' + c.name }),
              S.idx && S.idx[c.key] ? el('b', { style: 'font-weight:400;font-size:11px;margin-left:auto;padding-right:4px', title: KIND_GROUPS.filter(function (g) { return S.idx[c.key].groups[g.v]; }).map(function (g) { return g.label; }).join(' · '),
                text: KIND_GROUPS.filter(function (g) { return S.idx[c.key].groups[g.v]; }).map(function (g) { return g.icon; }).join('') }) : null,
              el('i', { title: '계약 기록 ' + (c.r || 0) + ' · 파일 ' + (c.n || 0), text: String((c.n || 0) + (c.r || 0)) })]));
        });
      }
      search.addEventListener('input', function () { S.q = search.value; drawList(); });
      drawList();
      /* 계약서 파일 — 원본 보관함과 같은 표(대표 2026-10-07 「기업별계약서도 같은방식」): ☐·#·제목·계약일·출처, 줄을 누르면 오른쪽 미리보기 */
      var docRows = filterDocs(S.docs, S.dsrc);
      var dPicked = Object.keys(S.dpicked || {}).filter(function (k) { return S.dpicked[k]; });
      var dAll = el('input', { type: 'checkbox', 'aria-label': '보이는 파일 모두 고르기', checked: docRows.length > 0 && docRows.every(function (d) { return S.dpicked[d.id]; }) });
      dAll.addEventListener('change', function () { docRows.forEach(function (d) { S.dpicked[d.id] = dAll.checked; }); draw(); });
      var dtb = el('tbody');
      docRows.forEach(function (d, i) {
        var cb = el('input', { type: 'checkbox', 'aria-label': (d.title || '계약서') + ' 고르기', checked: !!S.dpicked[d.id] });
        cb.addEventListener('click', function (e) { e.stopPropagation(); });
        cb.addEventListener('change', function () { S.dpicked[d.id] = cb.checked; draw(); });
        var ed = el('button', { type: 'button', 'class': 'pod-b', title: '제목·계약일 고치기 · 이 회사에서 빼기', 'aria-label': (d.title || '계약서') + ' 고치기', text: '✏' });
        ed.addEventListener('click', function (e) { e.stopPropagation(); openDoc(d); });
        var dl = el('button', { type: 'button', 'class': 'pod-b', title: '내려받기', 'aria-label': (d.title || '계약서') + ' 내려받기', text: '📥' });
        dl.addEventListener('click', function (e) { e.stopPropagation(); host.download(d.fileId, d.title); });
        dtb.appendChild(el('tr', { 'class': 'pick' + (S.dsel && S.dsel.id === d.id ? ' on' : ''), title: '눌러서 오른쪽에 미리보기', onclick: function () { S.dsel = d; draw(); } }, [
          el('td', { style: 'overflow:visible' }, [cb]), el('td', { style: 'color:#94a3b8', text: String(i + 1) }),
          el('td', { title: d.title, text: (d.secret ? '🔒 ' : d.src === 'photo' ? '🖼 ' : '📄 ') + (d.title || '계약서') }),
          el('td', { text: d.date || '날짜 없음' }),
          el('td', null, [el('span', { 'class': 'pod-tag ' + (d.src === 'photo' ? 'ph' : 'up'), style: 'margin-left:0', text: d.src === 'photo' ? '사진첩' : d.src === 'folder' ? 'PC 폴더' : '업로드' })]),
          el('td', { style: 'overflow:visible;white-space:nowrap' }, [ed, dl])]));
      });
      var srcSel = el('select', { 'aria-label': '출처', style: 'padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff' },
        [el('option', { value: '', text: '출처 전체' })].concat(DOC_SRCS.map(function (o) { return el('option', { value: o[0], text: o[1] }); })));
      srcSel.value = S.dsrc || '';
      srcSel.addEventListener('change', function () { S.dsrc = srcSel.value; draw(); });
      var grid = el('div', null, [
        el('div', { 'class': 'pod-fil' }, [srcSel,
          dPicked.length && host.zip ? el('button', { type: 'button', 'class': 'pod-b p', text: S.zbusy ? '묶는 중…' : '📦 선택 ' + dPicked.length + '개 묶어 받기', onclick: zipDocs }) : null,
          dPicked.length && host.mail ? el('button', { type: 'button', 'class': 'pod-b', text: '✉ 선택 ' + dPicked.length + '개 보내기', onclick: function () { openResend(S.dpicked); } }) : null,
          dPicked.length ? el('button', { type: 'button', 'class': 'pod-b', text: '선택 풀기', onclick: function () { S.dpicked = {}; draw(); } }) : null,
          el('span', { style: 'margin-left:auto', text: docRows.length === S.docs.length ? S.docs.length + '개' : docRows.length + '개 / 전체 ' + S.docs.length })]),
        docRows.length ? el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { style: 'width:34px' }, [dAll]), el('th', { style: 'width:40px', text: '#' }),
          el('th', { text: '제목' }), el('th', { style: 'width:96px', text: '계약일' }), el('th', { style: 'width:76px', text: '출처' }), el('th', { style: 'width:90px', text: '' })])]), dtb])
          : el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '맞는 파일이 없습니다' })]);
      var selCo = S.cos.filter(function (c) { return c.key === S.sel; })[0] || {};
      wrap.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px' }, [el('b', null, [coName(S.sel)]),
        selCo.bz ? el('span', { 'class': 'pod-tag', title: '사업자번호', text: fmtBz(selCo.bz) }) : null,
        el('span', { style: 'flex:1;min-width:160px;font-weight:400;color:#64748b;font-size:12px', text: '계약 기록 ' + S.recs.length + '건 · 보낸 서류 ' + S.sent.length + '건 · 계약서 파일 ' + S.docs.length + '건' }),
        host.coMerge ? el('button', { type: 'button', 'class': 'pod-b', text: '🔗 다른 회사를 여기로 합치기', onclick: openMerge }) : null]));
      /* 계약 기록 표 — ☐·# 맨 앞, 선택 지우기 (목록 관례) */
      var recBox = el('div');
      if (S.recsDenied) recBox.appendChild(el('div', { 'class': 'pod-note pod-warn', text: '⚠ 계약 기록 규칙이 아직 게시되지 않았습니다 — 파일 카드만 보입니다.' }));
      else {
        var picked = Object.keys(S.picked).filter(function (k) { return S.picked[k]; }).length;
        recBox.appendChild(el('div', { 'class': 'pod-bar', style: 'margin-bottom:6px' }, [el('b', { style: 'font-size:13px', text: '계약 기록' }),
          picked ? el('button', { type: 'button', 'class': 'pod-b', text: '선택 ' + picked + '건 지우기', onclick: removePicked }) : null,
          el('button', { type: 'button', 'class': 'pod-b', text: '+ 기록 더하기', onclick: function () { openRec(null); } })]));
        if (S.recs.length) {
          var allCb = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: S.recs.every(function (r) { return S.picked[r.id]; }) });
          allCb.addEventListener('change', function () { S.recs.forEach(function (r) { S.picked[r.id] = allCb.checked; }); draw(); });
          var tb = el('tbody');
          S.recs.forEach(function (r, i) {
            var cb = el('input', { type: 'checkbox', 'aria-label': (r.date || '') + ' ' + (r.kind || ''), checked: !!S.picked[r.id] });
            cb.addEventListener('click', function (e) { e.stopPropagation(); });
            cb.addEventListener('change', function () { S.picked[r.id] = cb.checked; draw(); });
            tb.appendChild(el('tr', { 'class': 'click', onclick: function () { openRec(r); } }, [el('td', null, [cb]), el('td', { text: String(i + 1) }),
              el('td', { text: r.date || '날짜 없음' }), el('td', null, [el('span', { 'class': 'pod-kd', text: r.kind || '기타' })]),
              el('td', { 'class': 'amt', text: won(r.amount) || '—' }),
              el('td', { text: [r.payDay ? '매월 ' + String(r.payDay).replace(/일$/, '') + '일' : '', r.edi ? 'EDI ' + r.edi : ''].filter(Boolean).join(' · ') || '—' }),
              el('td', { text: r.staff || '' }), el('td', { 'class': 'muted', text: r.src === 'import' ? '엑셀 명단' : r.src === 'folder' ? 'PC 폴더' : '손으로' })]));
          });
          recBox.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [allCb]), el('th', { text: '#' }), el('th', { text: '계약일' }),
            el('th', { text: '종류' }), el('th', { text: '금액' }), el('th', { text: '지급일·EDI' }), el('th', { text: '담당' }), el('th', { text: '출처' })])]), tb]));
        } else recBox.appendChild(el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '계약 기록이 없습니다' }));
      }
      /* ✉ 보낸 서류 (설계 2026-10-03 §3 (라)) — 이 앱·기업정보함에서 보낸 것. 받는 주소는 기록에 없다(원칙) */
      var sentBox = null;
      if (S.sent.length) {
        var stb = el('tbody');
        S.sent.forEach(function (r) {
          var d = new Date(r.at);
          stb.appendChild(el('tr', null, [el('td', { style: 'overflow:visible', text: ymd(r.at) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) }),
            el('td', { style: 'overflow:visible' }, [el('span', { 'class': 'pod-kd', text: r.kind })]),
            el('td', { style: 'white-space:normal;min-width:160px;word-break:keep-all;overflow-wrap:anywhere', text: r.names.join(', ') || '—' }),
            el('td', { text: r.who || '' }), el('td', { 'class': 'muted', text: r.by })]));
        });
        sentBox = el('div', null, [el('b', { style: 'display:block;font-size:13px;margin:4px 0 6px', text: '✉ 보낸 서류' }),
          el('div', { style: 'overflow-x:auto' }, [el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', { text: '보낸 때' }), el('th', { text: '종류' }),
            el('th', { text: '서류' }), el('th', { text: '받는 분' }), el('th', { text: '보낸 이' })])]), stb])])]);
      }
      var right = el('div', { 'class': 'pod-co-r' }, [kindBox(), recBox, sentBox, el('div', { 'class': 'pod-bar', style: 'margin:4px 0 6px' }, [el('b', { style: 'font-size:13px', text: '계약서 파일' }),
        host.mail && S.docs.length ? el('button', { type: 'button', 'class': 'pod-b', text: '✉ 파일 골라 보내기', onclick: function () { openResend(S.dpicked); } }) : null]),
        S.docs.length ? grid : el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '올린 계약서 파일이 없습니다' })]);
      var prev = el('div', { 'class': 'pod-arc-r' });
      if (!S.dsel) prev.hidden = true;
      wrap.appendChild(el('div', { 'class': 'pod-co' }, [el('div', { 'class': 'pod-cl pod-co-l' }, [search, coFil, listBox]), right, prev]));
      root.appendChild(wrap);
      if (S.dsel) drawDocPreview(prev);
    }
    /* 오른쪽 미리보기 — 원본 보관함과 같다(PDF·그림 그대로, 한글·엑셀은 문서 엔진, 🔒 은 서버가 대표·관리자에게만) */
    var dPrevUrl = null, dPrevBytes = null;  /* 미리보기 파일은 고른 줄이 바뀔 때만 다시 받는다 */
    function drawDocPreview(box) {
      if (dPrevUrl) { try { w.URL.revokeObjectURL(dPrevUrl); } catch (_) {} dPrevUrl = null; }
      var d = S.dsel; box.innerHTML = '';
      if (!d) return;
      var body = el('div', { 'class': 'pod-arc-rb' }, [el('div', { 'class': 'pod-empty', style: 'border:none', text: '여는 중…' })]);
      box.appendChild(el('div', { 'class': 'pod-arc-rh' }, [el('b', { title: d.title, text: (d.secret ? '🔒 ' : '') + (d.title || '계약서') }),
        el('button', { type: 'button', 'class': 'pod-b', title: '제목·계약일 고치기 · 이 회사에서 빼기', text: '✏', onclick: function () { openDoc(d); } }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📥', title: '내려받기', onclick: function () { host.download(d.fileId, d.title); } }),
        el('button', { type: 'button', 'class': 'pod-b', 'aria-label': '미리보기 닫기', text: '×', onclick: function () { S.dsel = null; draw(); } })]));
      box.appendChild(el('div', { style: 'padding:4px 10px 6px;font-size:11.5px;color:#64748b;border-bottom:1px solid #f1f5f9', text: (d.date || '날짜 없음') + ' · ' + (d.src === 'photo' ? '사진첩' : d.src === 'folder' ? 'PC 폴더' : '업로드') }));
      box.appendChild(body);
      if (!host.fileBytes) { body.textContent = '미리보기 길이 연결되지 않았습니다'; return; }
      var want = d;
      var got = dPrevBytes && dPrevBytes.id === d.fileId ? Promise.resolve(dPrevBytes.f)
        : host.fileBytes(d.fileId).then(function (f) { dPrevBytes = { id: d.fileId, f: f }; return f; });
      got.then(function (f) {
        if (!S.dsel || S.dsel.fileId !== want.fileId) return;
        body.innerHTML = '';
        var t = fileType(f.name || d.title);
        if (t === 'pdf' || t === 'img') {
          dPrevUrl = w.URL.createObjectURL(new Blob([f.bytes], { type: t === 'pdf' ? 'application/pdf' : 'image/jpeg' }));
          body.appendChild(t === 'pdf' ? el('iframe', { src: dPrevUrl, title: d.title || 'PDF' }) : el('img', { src: dPrevUrl, alt: d.title || '' }));
          return;
        }
        if ((t === 'hwp' || t === 'xlsx') && host.hwpShow) {
          var h2 = el('div', { style: 'background:#fff' }); body.appendChild(h2);
          return host.hwpShow(h2, f.bytes, f.name || d.title);
        }
        body.appendChild(el('div', { 'class': 'pod-empty', style: 'border:none', text: '이 형식은 미리보기가 없습니다 — 📥 내려받아 여세요' }));
      }).catch(function (e) {
        if (S.dsel !== want) return;
        body.innerHTML = '';
        body.appendChild(el('div', { 'class': 'pod-empty', style: 'border:none;color:#991b1b', text: '열지 못했습니다 — ' + msg(e) }));
      });
    }
    /* 고른 파일 묶어 받기 — 브라우저 안에서 .zip 하나로 */
    function zipDocs() {
      var list = S.docs.filter(function (d) { return S.dpicked[d.id]; });
      if (!list.length || S.zbusy || !host.fileBytes || !host.zip) return;
      S.zbusy = true; draw();
      var files = [], fail = 0, used = {};
      list.reduce(function (p, d, i) {
        return p.then(function () {
          toast('파일 가져오는 중… (' + (i + 1) + '/' + list.length + ')');
          return host.fileBytes(d.fileId).then(function (f) {
            var nm = f.name || d.title || '계약서', k = nm, n = 2;
            while (used[k]) k = nm.replace(/(\.[^.]+)?$/, '(' + (n++) + ')$1');
            used[k] = 1; files.push({ name: k, bytes: f.bytes });
          }, function () { fail++; });
        });
      }, Promise.resolve()).then(function () {
        if (!files.length) throw new Error('받은 파일이 없습니다');
        return host.zip(files);
      }).then(function (u8) {
        var a = el('a', { href: w.URL.createObjectURL(new Blob([u8], { type: 'application/zip' })), download: (coName(S.sel) || '기업') + '_계약서_' + files.length + '개.zip' });
        w.document.body.appendChild(a); a.click();
        setTimeout(function () { w.URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
        toast('📦 ' + files.length + '개를 묶었습니다' + (fail ? ' · ' + fail + '개는 못 받음(🔒 서명본은 대표·관리자만)' : ''));
      }).catch(function (e) { toast('❌ 묶지 못했습니다 — ' + msg(e)); })
        .then(function () { S.zbusy = false; draw(); });
    }
    draw(); load();
    return { reload: load };
  }
  function readBytes(file) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function (ev) { res(new Uint8Array(ev.target.result)); };
      rd.onerror = function () { rej(new Error('파일을 읽지 못했습니다')); };
      rd.readAsArrayBuffer(file);
    });
  }

  w.PuOfficeDocs = {
    archiveRows: archiveRows, pendingBackfill: pendingBackfill, photoCandidates: photoCandidates, sentRows: sentRows,
    filterArchive: filterArchive, fileType: fileType, filterCos: filterCos, filterDocs: filterDocs,
    linkPlan: linkPlan, bzGroups: bzGroups, refNames: refNames, mergePlan: mergePlan, fmtBz: fmtBz,
    KIND_GROUPS: KIND_GROUPS, groupOfKind: groupOfKind, coSort: coSort, coIndex: coIndex, filterCosBy: filterCosBy, linkableRec: linkableRec,
    mailTargets: mailTargets, sentKindOf: sentKindOf, resendMail: resendMail, awaitView: awaitView, awaitKindOf: awaitKindOf, remindText: remindText,
    mountArchive: mountArchive, mountCompanies: mountCompanies,
    _el: el, _toast: toast, _fmtSize: fmtSize, _ymd: ymd, _css: css, _deniedBanner: deniedBanner
  };
})(typeof window !== 'undefined' ? window : this);
