/* 취업규칙(새) — 「📚 조별 문안」 그리기 (설계 §6-2 · 2026-10-04 목업 2 「추천대로」)

   왼쪽에서 조 주제(표준취업규칙 차례·장 머리)를 고르면, 오른쪽에 우리 사무소가 쓴 문안을
   «같은 글끼리» 묶어 보인다. 맨 위 덩어리는 전문, 아래 덩어리는 «맨 위와 다른 곳만» 칠한다.

   셈은 lib-topics.js(PuRulesV2Topics)·lib-order.js(PuRulesV2Order), 견주기는 pu-rules-filecmp.js,
   위반 의심은 pu-rules-criteria.js(규정관리와 «같은 한 벌») — 여기서는 모으고 그리기만 한다.
   그림(DOM)이 아니라 «글»을 돌려주는 함수(model·listHtml·topicHtml)로 나눴다 — 검사가 그린 글을 본다.

   ★ 지키는 것
     · 가린 글만 — 이 화면은 S.texts 가 준 «가린 글» 말고는 받지 않는다(이름이 든 원문은 없다).
     · 모델은 한 번만 — 글을 다 받은 뒤 한 번 셈하고, 주제를 바꿔도 다시 셈하지 않는다.
       단, 📥 에서 저장했다는 표시(markDirty)가 있으면 다시 들어올 때(enter) «한 번 더» 셈한다 — 글은 text-cache 에서 온다.
       (덩어리 견주기·위반 판정은 그 주제를 처음 열 때 한 번 하고 모델에 담아 둔다)
     · 한 줄 칸 — 주제·덩어리 머리·쓴 회사 줄·경고 줄은 넘치면 … 이고 title 에 전문.
     · 회사는 id 로 이름을 찾는다 — 사업장 미확정은 이름을 «지어내지 않고» 「(미확정)」. */
(function (root) {
  'use strict';

  /* 화면에서는 전역에서, node 검사에서는 require 로 — 부품이 두 벌이면 판정이 갈린다 */
  function lib(name, rel) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') { try { return require(rel); } catch (e) { /* 화면에서는 위에서 찾는다 */ } }
    return null;
  }
  function T() { return lib('PuRulesV2Topics', './lib-topics.js'); }
  function O() { return lib('PuRulesV2Order', './lib-order.js'); }
  function FC() { return lib('PuRulesFileCmp', '../pu-rules-filecmp.js'); }
  function CR() { return lib('PuRulesCriteria', '../pu-rules-criteria.js'); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 한국 시간 연월 — 메일 날짜(ms) */
  function ym(ms) {
    var n = Number(ms || 0);
    if (!n) return '날짜 모름';
    return new Date(n + 9 * 3600e3).toISOString().slice(0, 7);
  }
  function todayKst() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }

  /* 「같은 글」 비교용 글은 줄바꿈이 다 걷혀 있다 — 읽을 때는 ①②… 앞에서 줄을 바꿔 준다 */
  function lines(s) {
    return String(s || '').replace(/ ?([①-⑳])/g, function (m, c, off) { return off === 0 ? c : '\n' + c; });
  }

  /* 표준에 장 머리가 없는 맨 앞 조들(목적·적용범위 …) — 표준 글에 「제1장 총칙」 줄이 빠져 있다 */
  var FIRST_CHAPTER = '제1장 총칙';
  var OTHER_CHAPTER = '그 밖의 조';
  var SIZE = '10인이상';

  /* «곳» 세기 — 사업장이 확정된 것은 회사 하나로, 미확정 문서는 문서 하나를 한 곳으로 센다.
     (같은 회사의 중간 판·최종본이 두 곳으로 부풀지 않게. 미확정은 누구인지 몰라 따로 센다) */
  function places(entries) {
    var seen = {};
    (entries || []).forEach(function (e) { seen[e.companyId ? 'co:' + e.companyId : 'doc:' + e.docId] = 1; });
    return Object.keys(seen).length;
  }

  /* ── 모델 — 한 번만 셈한다 ──
     data      : S.load() 의 {docs, human, rounds}
     texts     : S.texts() 의 {docId: 가린 글}
     companies : [{id, name}]   stdText : STD_2026.text   today : 'YYYY-MM-DD'
     criteria  : PuRulesCriteria(검사가 넣는다 — 없으면 전역) */
  function model(data, texts, companies, stdText, today, criteria) {
    var d = data || {}, tx = texts || {};
    var items = O().merge(d.docs || {}, d.human || {}).filter(function (it) { return it.kind === '규칙본문' && it.status === '담김'; });
    // ★최종본 — 회차 레코드의 finalDocId 만(실제 RTDB 는 null 칸을 버린다 — 없으면 없는 것)
    var finals = {};
    Object.keys(d.rounds || {}).forEach(function (k) { var r = d.rounds[k] || {}; if (r.finalDocId) finals[r.finalDocId] = 1; });
    var coName = {};
    (companies || []).forEach(function (c) { if (c && c.id) coName[c.id] = String(c.name || c.id); });

    var byKey = Object.create(null), keys = [], docs = 0;   // 열쇠가 「constructor」 같아도 안전하게
    items.forEach(function (it) {
      if (tx[it.id] == null) return;                         // 못 받은 글은 빼고 나머지로
      docs++;
      T().splitArticles(tx[it.id]).forEach(function (a) {
        var k = T().topicKey(a.title);
        if (!k) return;                                       // 제목 없는 조는 주제로 못 모은다
        if (!byKey[k]) { byKey[k] = []; keys.push(k); }
        byKey[k].push({ docId: it.id, companyId: it.companyId || '',
          companyName: it.companyId ? (coName[it.companyId] || '') : '',
          final: !!finals[it.id], date: it.date, label: a.label, title: a.title, body: a.body });
      });
    });

    var topics = [], inStd = {};
    T().topicOrder(stdText).forEach(function (s) {
      inStd[s.key] = 1;
      if (!byKey[s.key]) return;
      topics.push({ key: s.key, title: s.title, chapter: s.chapter || FIRST_CHAPTER, count: places(byKey[s.key]), other: false });
    });
    keys.filter(function (k) { return !inStd[k]; }).map(function (k) {
      return { key: k, title: byKey[k][0].title, chapter: OTHER_CHAPTER, count: places(byKey[k]), other: true };
    }).sort(function (a, b) { return b.count - a.count || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0); })
      .forEach(function (t) { topics.push(t); });

    var byTopic = Object.create(null);
    topics.forEach(function (t) {
      // ★ 덩어리 차례는 «곳»(회사) 수로 — groupVariants 는 문서(조) 수로 세므로, 한 회사의 판 셋이
      //   회사 둘을 앞서게 된다. 보이는 «N곳»과 같은 잣대로 다시 줄 세운다(★최종본 → 곳 → 최근).
      byTopic[t.key] = T().groupVariants(byKey[t.key]).map(function (g) { g.places = places(g.members); return g; })
        .sort(function (a, b) { return b.finals - a.finals || b.places - a.places || b.last - a.last; });
    });
    return { topics: topics, byTopic: byTopic, docs: docs, today: today || todayKst(), criteria: criteria || CR(), prepared: Object.create(null) };
  }

  /* 덩어리 하나에 검토 기준 — 대표 문서의 그 조를 «한 조짜리 문서»로 판정한다.
     size 는 «그 회사 규모»('5인미만'…) — 없으면 SIZE('10인이상'). 📚 는 안 넘겨 늘 10인이상.
     ⚠ 자리표시({근로자}·{회사})가 든 비교용 글이 아니라 대표 문서의 가린 글 그대로를 쓴다 —
       기준의 낱말(근로자대표·사원 …)이 자리표시에 가려 못 맞는 일이 없게. 같은 덩어리는 낱말이 같다. */
  function warnsOf(g, M, size) {
    var C = M.criteria;
    if (!C || !C.evaluate || !g.members.length) return [];
    try { return judgeWarns(g, M, size); } catch (e) { return []; }
  }
  /* 판정 그 자체 — 못 하면 «던진다». warnsOf 는 이것을 [] 로 삼키고(📚·💡 는 판정이 없으면 띠를 안 그릴 뿐이다),
     ✨ AI 다듬기는 이것을 바로 불러 «0건» 과 «판정 못 함» 을 가른다(못 했는데 0 이라고 하면 안 된다). */
  function judgeWarns(g, M, size) {
    var C = M && M.criteria;
    if (!C || !C.evaluate) throw new Error('검토 기준을 싣지 못했습니다');
    if (!g || !g.members || !g.members.length) return [];
    var rep = g.members[0], body = String(rep.body || '');
    var art = { label: rep.label, title: rep.title, body: body, bodyNs: body.replace(/\s+/g, '') };
    // ⚠ 한 조짜리 문서라 loc 는 늘 이 조다 — 그것만으로는 «다른 조의 기준»(출산전후휴가 조에 임신기 근로시간 단축)이 붙는다.
    //   기준의 낱말(규칙집의 낱말 넓히기 그대로)이 이 조의 «제목»에 있을 때만 이 조의 기준으로 본다.
    var tNs = String(rep.title || '').replace(/\s+/g, '');
    return C.evaluate([art], size || SIZE, new Set(), M.today).filter(function (f) {
      if (f.status !== '위반의심' || f.loc !== rep.label) return false;
      var ks = C.expandKw ? C.expandKw(f.rule.keywords || []) : (f.rule.keywords || []);
      return ks.some(function (k) { k = String(k || '').replace(/\s+/g, ''); return k && tNs.indexOf(k) >= 0; });
    });
  }
  /* 그 주제를 처음 열 때 한 번 — 아래 덩어리 견주기와 위반 판정을 모델에 담아 둔다 */
  function prepare(M, key) {
    if (M.prepared[key]) return;
    var gs = M.byTopic[key] || [], top = gs[0];
    gs.forEach(function (g, i) {
      if (i) { g.segs = FC().wordDiff(top.text, g.text); g.summary = T().diffSummary(g.segs); }
      g.warns = warnsOf(g, M);
    });
    M.prepared[key] = true;
  }

  /* ── 왼쪽 — 주제 목록. 찾기 글은 주제 «이름»만 거른다 ── */
  function listHtml(M, sel, q) {
    var qq = String(q || '').replace(/\s+/g, '').toLowerCase();
    var shown = (M.topics || []).filter(function (t) {
      return !qq || String(t.title).replace(/\s+/g, '').toLowerCase().indexOf(qq) >= 0 || String(t.key).toLowerCase().indexOf(qq) >= 0;
    });
    if (!shown.length) return '<div class="none">' + (M.topics && M.topics.length ? '맞는 조 주제가 없습니다' : '아직 조별 문안이 없습니다') + '</div>';
    var out = '', ch = null;
    shown.forEach(function (t) {
      if (t.chapter !== ch) { ch = t.chapter; out += '<div class="ch" title="' + esc(ch) + '">' + esc(ch) + '</div>'; }
      out += '<button class="tp' + (t.key === sel ? ' on' : '') + '" data-act="topic" data-k="' + esc(t.key) + '" title="' + esc(t.title + ' · ' + t.count + '곳') + '">'
        + '<span>' + esc(t.title) + '</span><i>' + t.count + '곳</i></button>';
    });
    return out;
  }

  function letter(i) { return i < 26 ? String.fromCharCode(65 + i) : String(i + 1); }
  function diffHtml(segs) {
    return lines((segs || []).map(function (s) {
      return s.t === '+' ? '<ins>' + esc(s.s) + '</ins>' : s.t === '-' ? '<del>' + esc(s.s) + '</del>' : esc(s.s);
    }).join(''));
  }
  function warnHtml(g) {
    if (!g.warns || !g.warns.length) return '';
    var t = g.warns.map(function (f) { return '⚠ 검토 기준 ' + f.rule.id + ' ' + f.rule.name + ' — ' + f.rule.law + ' 위반 의심'; }).join(' · ');
    var why = g.warns.map(function (f) { return f.rule.id + ': ' + (f.note || ''); }).join(' / ');
    return '<div class="warn" title="' + esc(t + (why ? ' — ' + why : '')) + '">' + esc(t) + '</div>';
  }
  function whoHtml(g) {
    return '<div class="who">' + g.members.map(function (e) {
      var nm = e.companyId ? (e.companyName || '(지운 업체)') : '(미확정)';
      var l = (e.final ? '★ ' : '') + nm + ' · ' + e.label, r = ym(e.date) + ' ' + (e.final ? '★최종본' : '중간 판');
      return '<div title="' + esc(l + ' · ' + r) + '"><span>' + esc(l) + '</span><span class="w">' + esc(r) + '</span></div>';
    }).join('') + '</div>';
  }

  /* ── 오른쪽 — 한 주제의 문안 덩어리 ── */
  function topicHtml(M, key, openSet) {
    var t = (M.topics || []).filter(function (x) { return x.key === key; })[0];
    if (!t) return '<div class="msg">왼쪽에서 조 주제를 고르세요</div>';
    prepare(M, key);
    var gs = M.byTopic[key] || [], open = openSet || new Set();
    var cards = gs.map(function (g, i) {
      var L = letter(i), on = open.has(key + '|' + i);
      var diff = i ? 'A 와 다른 곳: ' + (g.summary || '') : '';
      return '<div class="card' + (i ? '' : ' top1') + '">'
        + '<div class="ch2"><b>문안 ' + L + '</b><span class="n">' + g.places + '곳</span>'
        + (g.finals ? '<span class="fin">★최종본 ' + g.finals + '</span>' : '')
        + '<span class="n">최근 ' + esc(ym(g.last)) + '</span>'
        + (diff ? '<span class="diff" title="' + esc(diff) + '">' + esc(diff) + '</span>' : '')
        + '<span class="r"><button class="btn" data-act="copy" data-k="' + esc(key) + '" data-g="' + i + '"'
        + ' title="이 문안을 복사합니다 — 회사 이름·호칭은 {회사}·{근로자} 자리표시로 들어 있으니 붙여 넣은 뒤 바꾸세요">📋 복사</button>'
        + '<button class="btn" data-act="who" data-k="' + esc(key) + '" data-g="' + i + '" title="곳 = 회사 수(미확정 문서는 한 건이 한 곳) · 건 = 펼치면 보이는 조 줄 수">쓴 회사 ' + g.places + '곳 · ' + g.members.length + '건 ' + (on ? '▾' : '▸') + '</button></span></div>'
        + '<div class="txt">' + (i ? diffHtml(g.segs) : esc(lines(g.text))) + '</div>'
        + warnHtml(g)
        + (on ? whoHtml(g) : '')
        + '</div>';
    }).join('');
    return '<div class="head"><h2>' + esc(t.title) + '</h2><small>' + t.count + '곳이 쓴 문안 → ' + gs.length + '가지로 묶임</small></div>'
      + '<div class="lead">같은 글끼리 묶었습니다(회사 이름·「사원/근로자/직원」·띄어쓰기·조 번호 차이는 같은 글로 봅니다). '
      + '맨 위가 가장 많이 쓴 문안이고, 아래 문안은 <b>그것과 다른 곳만</b> 칠했습니다.</div>'
      + cards;
  }

  /* 복사할 글 — 덩어리 대표 글(자리표시 그대로), ①② 앞에서 줄을 바꾼다 */
  function copyText(M, key, gi) {
    var g = (M.byTopic[key] || [])[gi];
    return g ? lines(g.text) : '';
  }

  /* ── 꽂기 ──
     ctx: { S, cache, companies, stdText, criteria?, loadFix?:()=>Promise(fix), today? }
     돌려주는 것: { ready, select(key), search(q), toggle(key,gi), state } — 검사가 손잡이로 쓴다 */
  function mount(el, ctx) {
    var st = { M: null, sel: '', q: '', open: new Set(), failed: [], done: 0, total: 0, loaded: false, err: '', dirty: false };
    var C = ctx.criteria || CR();

    function part(role) { return el.querySelector ? el.querySelector('[data-role="' + role + '"]') : null; }
    function msgHtml() {
      if (st.err) return '<div class="msg">' + esc(st.err) + '</div>';
      // 자료 목록을 받기 전(또는 받을 글이 아직 없을 때)은 «몇 개 중 몇 개»가 뜻이 없다
      if (!st.loaded || !st.total) return '<div class="msg">불러오는 중…</div>';
      return '<div class="msg">글 읽는 중 ' + st.done + '/' + st.total + '</div>';
    }
    function mainHtml() {
      return (st.failed.length ? '<div class="fail" title="이 문서들은 빼고 나머지로 묶었습니다">글을 못 읽은 문서 ' + st.failed.length + '건 — 빼고 묶었습니다</div>' : '')
        + topicHtml(st.M, st.sel, st.open);
    }
    function drawAll() {
      if (!st.M) { el.innerHTML = msgHtml(); return; }
      el.innerHTML = '<div class="tpx"><div class="left">'
        + '<input class="tq" data-role="tq" placeholder="🔍 조 주제 찾기 (예: 연차)" value="' + esc(st.q) + '">'
        + '<div data-role="tlist">' + listHtml(st.M, st.sel, st.q) + '</div></div>'
        + '<div class="main" data-role="tmain">' + mainHtml() + '</div></div>';
    }
    // 찾기 칸은 그대로 두고 목록·본문만 바꾼다 — 통째로 다시 그리면 글을 치던 칸이 손을 놓친다
    function draw(listOnly) {
      var L = part('tlist'), Mn = part('tmain');
      if (!st.M || !L || !Mn) { drawAll(); return; }
      L.innerHTML = listHtml(st.M, st.sel, st.q);
      if (!listOnly) Mn.innerHTML = mainHtml();
    }
    var api2 = {
      state: st,
      select: function (k) { st.sel = String(k || ''); draw(); },
      search: function (q) { st.q = String(q || ''); draw(true); },
      toggle: function (k, gi) { var id = k + '|' + gi; if (st.open.has(id)) st.open.delete(id); else st.open.add(id); draw(); }
    };

    el.onclick = function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('[data-act]');
      if (!b || !el.contains(b) || !st.M) return;
      var a = b.dataset.act;
      if (a === 'topic') api2.select(b.dataset.k);
      else if (a === 'who') api2.toggle(b.dataset.k, +b.dataset.g);
      else if (a === 'copy') copy(copyText(st.M, b.dataset.k, +b.dataset.g), b);
    };
    el.oninput = function (ev) { var t = ev.target; if (t && t.dataset && t.dataset.role === 'tq') api2.search(t.value); };

    drawAll();
    // 사람이 고친 조문 연결(교정 기억) — 규정관리와 같은 판정이 되게 한 번 읽어 넘긴다. 못 읽으면 교정 없이.
    var fix = (ctx.loadFix ? Promise.resolve().then(ctx.loadFix) : Promise.resolve({})).then(function (f) { return f || {}; }, function () { return {}; });
    // 모델을 만든다(처음 한 번 + 📥 에서 저장한 뒤 다시 들어올 때). 글은 text-cache 에 남아 있어 다시 받지 않는다.
    function build(first) {
      return Promise.all([ctx.S.load(), fix]).then(function (v) {
        var data = v[0] || {}, f = v[1];
        if (C && C.useMatchFix) C.useMatchFix(function () { return f; });
        var docs = {};
        O().merge(data.docs || {}, data.human || {}).forEach(function (it) {
          if (it.kind === '규칙본문' && it.status === '담김') docs[it.id] = it.doc;
        });
        if (first) { st.loaded = true; st.total = Object.keys(docs).length; drawAll(); }
        return ctx.S.texts(docs, ctx.cache, function (n, m) { if (first) { st.done = n; st.total = m; if (!st.M) drawAll(); } }).then(function (r) {
          st.failed = r.failed || [];
          var keep = st.sel;
          st.M = api.model(data, r.texts, ctx.companies, ctx.stdText, ctx.today, C);   // ★ 한 번만(저장 표시가 없으면 다시 셈하지 않는다)
          st.sel = st.M.topics.some(function (t) { return t.key === keep; }) ? keep : (st.M.topics.length ? st.M.topics[0].key : '');
          draw();
        });
      });
    }
    api2.ready = build(true).catch(function (e) { st.err = '조별 문안을 못 만들었습니다: ' + ((e && e.message) || e); drawAll(); });
    // 📥 에서 사업장·★최종본·갈래·회차를 저장하면 이 모델은 낡았다 — 표시만 해 두고, 다시 들어올 때 새로 셈한다
    api2.markDirty = function () { st.dirty = true; };
    api2.enter = function () {
      if (!st.dirty) return api2.ready;
      st.dirty = false;
      // 다시 셈하다 실패하면 옛 화면을 그대로 두고 다음 진입에서 또 시도한다(화면을 에러 글로 갈아엎지 않는다)
      api2.ready = api2.ready.then(function () { return build(false); }).catch(function () { st.dirty = true; });
      return api2.ready;
    };
    return api2;
  }

  function copy(text, btn) {
    function done(ok) {
      if (!btn) return;
      var was = btn.textContent; btn.textContent = ok ? '✓ 복사함' : '복사 못 함';
      setTimeout(function () { btn.textContent = was; }, 1400);
    }
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
        return;
      }
    } catch (e) { /* 아래 옛 길로 */ }
    done(fallback(text));
  }
  // 클립보드 API 가 막힌 곳(오래된 브라우저·권한 거절)의 옛 길
  function fallback(text) {
    try {
      var ta = root.document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      root.document.body.appendChild(ta); ta.select();
      var ok = root.document.execCommand('copy');
      root.document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  var api = { model: model, listHtml: listHtml, topicHtml: topicHtml, copyText: copyText, mount: mount,
    places: places, warnsOf: warnsOf, judgeWarns: judgeWarns, esc: esc, FIRST_CHAPTER: FIRST_CHAPTER, OTHER_CHAPTER: OTHER_CHAPTER };
  if (root) root.PuRulesV2TopicsView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
