/* 📚 서식집 — 노무사가 승인한 서식(forms/*.json)을 골라 보고, 빈칸을 채워 인쇄·PDF·HTML 로 받는다.
   설계 docs/superpowers/specs/2026-08-06-법인-서식집-design.md §5.1(저장)·§5.4(채우기)·§6 Phase 4.
   대표 「서식집 노무사 검토한다」(2026-10-04). 실리는 길은 tools/forms_publish.js(승인 O 만, 개인정보 다시 검사).

   ⚠ 채운 값은 어디에도 저장하지 않는다 — 내려받는 파일·인쇄에만 들어간다(문서관리의 원칙).
   ⚠ 본문은 우리 파이프라인이 만든 HTML 이지만, 화면에 넣기 전에 한 번 더 거른다(script·on…·javascript:).
   ⚠ 채우는 값은 반드시 글자로만 넣는다(esc) — 값에 든 <…> 가 마크업이 되면 안 된다.
   ES5 — 문서관리 다른 파일과 같다. */
(function (w) {
  'use strict';
  var DOMAINS = [
    ['wageArrears', '임금체불'], ['laborCommission', '노동위원회'], ['industrialAccident', '산재'],
    ['consulting', '컨설팅'], ['fund', '기금'], ['bargaining', '교섭'], ['other', '기타']
  ];
  function domainLabel(d) { for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i][0] === d) return DOMAINS[i][1]; return d || '기타'; }
  function domainRank(d) { for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i][0] === d) return i; return DOMAINS.length; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* 본문 거르기 — 우리 HTML 이라도 화면에 넣기 전에 한 번 더 */
  function cleanBody(html) {
    return String(html || '')
      .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<(script|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  }
  /* {{이름}} 채우기 — 값은 글자로만. 빈 값은 밑줄(손으로 쓸 자리), mark 면 빈칸을 눈에 띄게 */
  var VAR_RE = /\{\{([^{}\n]{1,30})\}\}/g;
  function fillHtml(html, vals, mark) {
    vals = vals || {};
    return cleanBody(html).replace(VAR_RE, function (m, k) {
      var v = vals[k];
      if (v == null || String(v).trim() === '') return mark ? '<span class="pfl-blank" title="' + esc(k) + '">' + esc(k) + '</span>' : '__________';
      return esc(v).replace(/\n/g, '<br>');
    });
  }
  function varsIn(html) {
    var out = [], seen = {}, m;
    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(String(html || '')))) if (!seen[m[1]]) { seen[m[1]] = 1; out.push(m[1]); }
    return out;
  }
  /* 목록 거르기 — 분야·검색(제목·트랙) */
  function filterForms(list, domain, q) {
    q = String(q || '').replace(/\s+/g, '').toLowerCase();
    return (list || []).filter(function (f) {
      if (domain && domain !== 'all' && f.domain !== domain) return false;
      if (!q) return true;
      return (String(f.title || '') + ' ' + (f.track || []).join(' ')).replace(/\s+/g, '').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      return domainRank(a.domain) - domainRank(b.domain) || String(a.title).localeCompare(String(b.title), 'ko');
    });
  }
  /* 인쇄·HTML 받기용 한 장 */
  function pageHtml(title, bodyHtml) {
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title>'
      + '<style>@page{size:A4;margin:18mm 16mm}body{font:12pt/1.7 "맑은 고딕","Malgun Gothic",sans-serif;color:#111;margin:0}'
      + 'table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #333;padding:4px 6px;vertical-align:top}p{margin:3px 0}</style>'
      + '</head><body>' + bodyHtml + '</body></html>';
  }

  /* 실린 서식 목록 — 없으면(404·빈 목록) 빈 배열. 메뉴를 열지 말지가 이것으로 갈린다 */
  function loadIndex(fetchFn) {
    var f = fetchFn || (w.fetch && w.fetch.bind(w));
    if (!f) return Promise.resolve([]);
    return f('forms/index.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return [];
      return r.json().then(function (j) { return (j && Array.isArray(j.forms)) ? j.forms.filter(function (x) { return x && x.review && x.review.status === 'approved'; }) : []; });
    }, function () { return []; });
  }

  var CSS = ''
    + '.pfl{display:flex;gap:12px;align-items:flex-start;min-height:60vh}'
    + '.pfl-l{width:300px;flex:none}.pfl-r{flex:1;min-width:0}'
    + '.pfl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}'
    + '.pfl-chip{border:1px solid #cbd5e1;background:#fff;border-radius:99px;padding:3px 10px;font-size:12px;cursor:pointer;color:#475569}'
    + '.pfl-chip.on{background:#1e40af;border-color:#1e40af;color:#fff}'
    + '.pfl-q{width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;margin-bottom:8px;box-sizing:border-box}'
    + '.pfl-list{max-height:65vh;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px}'
    + '.pfl-it{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #f1f5f9;background:#fff;padding:8px 10px;cursor:pointer;font-size:13px}'
    + '.pfl-it:hover{background:#eff6ff}.pfl-it.on{background:#dbeafe}'
    + '.pfl-it small{display:block;color:#64748b;font-size:11.5px;margin-top:2px}'
    + '.pfl-paper{background:#fff;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(15,23,42,.08);padding:28px 32px;max-width:794px;margin:0 auto;font-size:13px;line-height:1.7}'
    + '.pfl-paper table{border-collapse:collapse;width:100%;margin:6px 0}.pfl-paper td,.pfl-paper th{border:1px solid #475569;padding:4px 6px;vertical-align:top}'
    + '.pfl-paper p{margin:3px 0}'
    + '.pfl-blank{background:#fffbeb;border-bottom:1px dashed #d97706;color:#d97706;padding:0 3px;border-radius:3px}'
    + '.pfl-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}'
    + '.pfl-b{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:6px 12px;font-size:12.5px;cursor:pointer}'
    + '.pfl-b.p{background:#1e40af;border-color:#1e40af;color:#fff}'
    + '.pfl-vars{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px}'
    + '.pfl-vars label{display:block;font-size:12px;color:#475569}.pfl-vars input{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px}'
    + '.pfl-tag{display:inline-block;font-size:11px;border-radius:99px;padding:1px 7px;background:#f1f5f9;color:#475569;margin-right:4px}'
    + '.pfl-empty{color:#64748b;padding:24px;text-align:center}'
    + '@media(max-width:760px){.pfl{display:block}.pfl-l{width:auto;margin-bottom:12px}.pfl-list{max-height:35vh}.pfl-paper{padding:16px}}';
  function css() {
    if (w.document.getElementById('pfl-css')) return;
    var s = w.document.createElement('style'); s.id = 'pfl-css'; s.textContent = CSS; w.document.head.appendChild(s);
  }
  function el(tag, attrs, kids) {
    var n = w.document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'style') n.style.cssText = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? w.document.createTextNode(c) : c); });
    return n;
  }
  function saveBlob(blob, name) {
    var a = el('a', { href: w.URL.createObjectURL(blob), download: name });
    w.document.body.appendChild(a); a.click();
    setTimeout(function () { w.URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function safeName(s) { return String(s || '서식').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || '서식'; }

  /* host: { index:[…], fetchJson(path)→Promise, toast(msg) }
     PDF 는 인쇄 창의 「PDF로 저장」으로 — 여러 쪽 서식을 한 장 그림으로 줄이지 않는다(esign-docs htmlPagesToPdf 는 한 쪽짜리용) */
  function mount(root, host) {
    css();
    var S = { dom: 'all', q: '', sel: null, vals: {}, bodies: {} };
    var toast = host.toast || function () {};
    var list = host.index || [];
    function bodyOf(f) {
      if (S.bodies[f.id] != null) return Promise.resolve(S.bodies[f.id]);
      return host.fetchJson('forms/' + f.file + '.json').then(function (j) {
        ((j && j.forms) || []).forEach(function (x) { S.bodies[x.id] = x.body || ''; });
        if (S.bodies[f.id] == null) throw new Error('서식 본문을 찾지 못했습니다');
        return S.bodies[f.id];
      });
    }
    function draw() {
      root.innerHTML = '';
      if (!list.length) { root.appendChild(el('div', { 'class': 'pfl-empty', text: '아직 노무사가 승인한 서식이 없습니다.' })); return; }
      var doms = DOMAINS.filter(function (d) { return list.some(function (f) { return f.domain === d[0]; }); });
      var chips = el('div', { 'class': 'pfl-chips' }, [el('button', { type: 'button', 'class': 'pfl-chip' + (S.dom === 'all' ? ' on' : ''), text: '전체 ' + list.length, onclick: function () { S.dom = 'all'; draw(); } })]
        .concat(doms.map(function (d) {
          var n = list.filter(function (f) { return f.domain === d[0]; }).length;
          return el('button', { type: 'button', 'class': 'pfl-chip' + (S.dom === d[0] ? ' on' : ''), text: d[1] + ' ' + n, onclick: function () { S.dom = d[0]; draw(); } });
        })));
      var q = el('input', { type: 'search', 'class': 'pfl-q', placeholder: '서식 이름 찾기', 'aria-label': '서식 찾기', value: S.q });
      var box = el('div', { 'class': 'pfl-list' });
      function drawList() {
        box.innerHTML = '';
        var rows = filterForms(list, S.dom, S.q);
        if (!rows.length) { box.appendChild(el('div', { 'class': 'pfl-empty', text: '맞는 서식이 없습니다' })); return; }
        rows.forEach(function (f) {
          box.appendChild(el('button', { type: 'button', 'class': 'pfl-it' + (S.sel && S.sel.id === f.id ? ' on' : ''), onclick: function () { pick(f); } }, [
            f.title, el('small', { text: domainLabel(f.domain) + ((f.track || []).length ? ' · ' + f.track.join(', ') : '') + (f.esign ? ' · 서명' : '') })]));
        });
      }
      q.addEventListener('input', function () { S.q = q.value; drawList(); });
      drawList();
      var right = el('div', { 'class': 'pfl-r', id: 'pflRight' });
      root.appendChild(el('div', { 'class': 'pfl' }, [el('div', { 'class': 'pfl-l' }, [chips, q, box]), right]));
      drawRight(right);
    }
    function pick(f) { S.sel = f; S.vals = {}; draw(); }
    function drawRight(right) {
      if (!S.sel) { right.appendChild(el('div', { 'class': 'pfl-empty', text: '왼쪽에서 서식을 고르세요' })); return; }
      var f = S.sel;
      right.appendChild(el('div', { 'class': 'pfl-empty', text: '서식을 여는 중…' }));
      bodyOf(f).then(function (body) {
        if (S.sel !== f) return;
        right.innerHTML = '';
        var keys = varsIn(body);
        var paper = el('div', { 'class': 'pfl-paper' });
        function render() { paper.innerHTML = fillHtml(body, S.vals, true); }
        var inputs = keys.map(function (k) {
          var inp = el('input', { type: 'text', 'aria-label': k, value: S.vals[k] || '' });
          inp.addEventListener('input', function () { S.vals[k] = inp.value; render(); });
          return el('label', null, [k, inp]);
        });
        function filled() { return pageHtml(f.title, fillHtml(body, S.vals, false)); }
        right.appendChild(el('div', { 'class': 'pfl-bar' }, [
          el('b', { style: 'flex:1;font-size:15px', text: f.title }),
          el('span', { 'class': 'pfl-tag', text: domainLabel(f.domain) }),
          f.review && f.review.reviewedAt ? el('span', { 'class': 'pfl-tag', title: '노무사 승인', text: '✔ 승인 ' + f.review.reviewedAt }) : null,
          el('button', { type: 'button', 'class': 'pfl-b p', title: '인쇄 창에서 「PDF로 저장」을 고르면 PDF 로 받습니다', text: '🖨 인쇄 · PDF', onclick: function () {
            var win = w.open('', '_blank');
            if (!win) { toast('팝업이 막혀 인쇄 창을 못 열었습니다'); return; }
            win.document.open(); win.document.write(filled()); win.document.close();
            setTimeout(function () { try { win.focus(); win.print(); } catch (_) {} }, 300);
          } }),
          el('button', { type: 'button', 'class': 'pfl-b', text: '📄 HTML 받기', onclick: function () {
            saveBlob(new Blob([filled()], { type: 'text/html;charset=utf-8' }), safeName(f.title) + '.html');
          } }),
]));
        if (keys.length) {
          right.appendChild(el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:6px', text: '빈칸 ' + keys.length + '곳 — 적으면 아래 서식에 바로 들어갑니다. 비워 두면 밑줄로 나옵니다(손으로 쓸 자리). 적은 값은 저장하지 않습니다.' }));
          right.appendChild(el('div', { 'class': 'pfl-vars' }, inputs));
        }
        right.appendChild(paper);
        render();
      }, function (e) { right.innerHTML = ''; right.appendChild(el('div', { 'class': 'pfl-empty', text: '열지 못했습니다 — ' + ((e && e.message) || e) })); });
    }
    draw();
    return { redraw: draw };
  }

  w.PuFormLibrary = { DOMAINS: DOMAINS, cleanBody: cleanBody, fillHtml: fillHtml, varsIn: varsIn, filterForms: filterForms, pageHtml: pageHtml, loadIndex: loadIndex, mount: mount };
})(typeof window !== 'undefined' ? window : this);
