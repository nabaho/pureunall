/* 푸른 파일 끌어다 놓기 — 파일을 받는 단추 위에 «끌어다 놓으면» 폴더 찾기 없이 바로 받는다 (2026-10-10)

   ── 왜 생겼나
     대표 지시: 「데이터 가지고 올 경우 마우스로 드래그하면 되게 — 모든 자료 받을 때 팝업창으로 폴더 찾기보다
     우선 마우스 드래그가 가능하게」. 기금관리(fund.html)는 안에 같은 틀을 두었고, 이 파일은 «다른 프로그램»이 쓰도록
     떼어 낸 것이다(급여 프로그램·규정관리). 이알피·경력관리는 이미 칸마다 끌어놓기 부품이 있어 싣지 않았다.

   ── 쓰는 법  PuDnd.init({ rules, inputs, toast })
     ① rules  — 단추가 onclick="이름('글','자')" 로 «함수»를 부르고, 그 함수가 폴더 찾기를 여는 곳.
          rules:{ importPayroll:{ext:['json'],argc:0,exact:true} }
          그 함수는 마지막 인자로 파일 배열(dropped)을 받고, 있으면 폴더 찾기 대신 그것을 쓴다(PuDnd.pick(inp,dropped)).
     ② inputs — 눈에 안 보이는 <input type=file> 을 «보이는 단추»가 대신 누르는 곳(규정관리).
          inputs:[{trigger:'#upBtn', input:'#upload-input'}]
          놓으면 그 입력 상자에 파일을 넣고 change 를 일으킨다 — 받는 쪽 코드를 하나도 안 고친다.
     ③ 공통: ext(받는 형식, 없으면 input 의 accept 에서 읽음)·multi(여러 개)·exact(true 면 «단추 위»에만 받는다).

   ── 약속
     · 파일을 끌어 오면 이 화면에서 받는 단추가 노란 점선으로 켜지고 아래에 안내 띠가 뜬다.
     · 받는 단추가 «한 곳»이고 exact 가 아니면 화면 아무 데나 놓아도 된다. exact 는 덮어쓰는 일(원본 교체·서버 저장)용 —
       실수로 아무 데나 놓아 자료를 덮지 않게 단추 위에서만 받는다.
     · 형식이 안 맞으면 무엇을 받는지 알리고 아무것도 안 한다. 한 개짜리에 여러 개를 놓으면 첫 파일만.
     · 놓을 곳이 없어도 브라우저가 파일을 «열어 버리지» 않게 늘 막는다. 창(#modalbg)이 떠 있으면 그 안만 본다.
     · 끌기를 그만두면(Esc·창 밖) 1.5초 뒤 저절로 꺼진다. 눌러서 폴더 찾기는 그대로다.
   ⚠ 이 파일은 «받을 자리를 알려 줄 뿐» 자료를 읽거나 저장하지 않는다 — 받는 함수가 한다. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuDnd = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var CFG = { rules: {}, inputs: [], toast: null }, S = { on: false, cands: [], hot: null, t: 0 }, started = false;

  function extOf(f) { var m = /\.([^.\\/]+)$/.exec(String(f && f.name || '')); return m ? m[1].toLowerCase() : ''; }
  /* accept="…" → 받는 확장자 목록. 확장자(.pdf)만 있으면 그것, image/* 같은 종류가 섞이면 null(제한 없음으로 본다) */
  function acceptToExt(acc) {
    var t = String(acc || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
    if (!t.length) return null;
    if (t.some(function (x) { return x.charAt(0) !== '.'; })) return null;
    return t.map(function (x) { return x.slice(1); });
  }
  /* onclick 글자 «이름('글','자')» → {fn,args}. 규칙에 있고 인자 수가 맞을 때만 */
  function parse(onclick, rules) {
    var m = /^\s*([A-Za-z_]\w*)\(((?:\s*'[^'\\]*'\s*,?)*)\s*\)\s*;?\s*$/.exec(String(onclick || ''));
    if (!m || !Object.prototype.hasOwnProperty.call(rules, m[1])) return null;
    var args = []; String(m[2] || '').replace(/'([^'\\]*)'/g, function (_, a) { args.push(a); return ''; });
    if (args.length !== (rules[m[1]].argc || 0)) return null;
    return { fn: m[1], args: args };
  }
  /* 놓은 파일이 이 받는 곳에 맞는가 → {ok, files, note} */
  function fit(c, files) {
    var bad = c.ext ? files.filter(function (f) { return c.ext.indexOf(extOf(f)) < 0; }) : [];
    if (bad.length) return { ok: false, note: '이 단추는 .' + c.ext.join(' .') + ' 파일만 받습니다 — ' + bad[0].name + (bad.length > 1 ? ' 외 ' + (bad.length - 1) + '개' : '') };
    if (!c.multi && files.length > 1) return { ok: true, files: [files[0]], note: '여러 개를 놓았습니다 — 첫 파일 «' + files[0].name + '»만 받습니다' };
    return { ok: true, files: files, note: '' };
  }
  /* 끌어온 파일을 «골라 준 것처럼» 입력 상자에 넣는다 — 받는 쪽 코드(ev.target.files / inp.files)가 그대로 돈다 */
  function pick(inp, dropped) {
    if (dropped && dropped.length) { Object.defineProperty(inp, 'files', { value: dropped, configurable: true }); if (inp.onchange) inp.onchange({ target: inp }); return; }
    inp.click();
  }
  /* 앱이 toast 를 안 주면(급여 프로그램은 alert 뿐) 스스로 4초짜리 알림을 띄운다 — alert 는 끌어놓기를 «막아 세우므로» 쓰지 않는다 */
  function say(msg, type) {
    try { if (CFG.toast) { CFG.toast(msg, type); return; } } catch (e) {}
    var d = root.document, o = d.getElementById('pudndmsg'); if (o) o.remove();
    o = d.createElement('div'); o.id = 'pudndmsg'; o.textContent = msg; if (type === 'warn') o.className = 'warn'; d.body.appendChild(o);
    root.setTimeout(function () { if (o.parentNode) o.remove(); }, 4000);
  }
  function label(el) { return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 24); }

  function cands() {
    var doc = root.document, mod = doc.getElementById('modalbg'), scope = mod || doc, out = [];
    Object.keys(CFG.rules).forEach(function (fn) {
      Array.prototype.forEach.call(scope.querySelectorAll('[onclick^="' + fn + '("]'), function (el) {
        var p = parse(el.getAttribute('onclick'), CFG.rules); if (!p || !visible(el)) return;
        var r = CFG.rules[fn]; out.push({ el: el, ext: r.ext || null, multi: !!r.multi, exact: !!r.exact, kind: 'fn', fn: p.fn, args: p.args });
      });
    });
    CFG.inputs.forEach(function (d) {
      var el = scope.querySelector(d.trigger), inp = doc.querySelector(d.input);
      if (!el || !inp || !visible(el)) return;
      out.push({ el: el, ext: d.ext !== undefined ? d.ext : acceptToExt(inp.accept), multi: d.multi !== undefined ? d.multi : !!inp.multiple, exact: !!d.exact, kind: 'input', inp: inp });
    });
    return out;
  }
  function visible(el) { return el.offsetParent !== null || root.getComputedStyle(el).position === 'fixed'; }
  function run(c, files) {
    if (c.kind === 'fn') { root[c.fn].apply(null, c.args.concat([files])); return; }
    var dt = new root.DataTransfer(); files.forEach(function (f) { dt.items.add(f); });
    c.inp.files = dt.files; c.inp.dispatchEvent(new root.Event('change', { bubbles: true }));
  }

  function bar(txt) { var d = root.document, b = d.getElementById('pudndbar'); if (!b) { b = d.createElement('div'); b.id = 'pudndbar'; d.body.appendChild(b); } b.textContent = txt; }
  function start() {
    if (S.on) return; S.on = true; S.cands = cands();
    S.cands.forEach(function (c) { c.el.classList.add('pudnd-ok'); });
    var n = S.cands.length, free = S.cands.filter(function (c) { return !c.exact; });
    bar(n === 0 ? '이 화면에는 끌어서 받는 곳이 없습니다 — 단추를 눌러 파일을 고르세요'
      : (n === 1 && free.length === 1) ? '📥 여기 아무 데나 놓으면 «' + label(S.cands[0].el) + '»'
      : '📥 노란 점선 단추 위에 놓으세요 (' + n + '곳)');
  }
  function end() {
    if (!S.on) return; S.on = false; root.clearTimeout(S.t);
    Array.prototype.forEach.call(root.document.querySelectorAll('.pudnd-ok,.pudnd-hot'), function (el) { el.classList.remove('pudnd-ok', 'pudnd-hot'); });
    var b = root.document.getElementById('pudndbar'); if (b) b.remove(); S.hot = null;
  }
  /* 놓았다 — 단추 위면 그 단추, 아니면 «exact 가 아닌 받는 곳이 한 곳»일 때만 그 한 곳 */
  function drop(files, hotEl, list) {
    files = Array.prototype.slice.call(files || []); if (!files.length) return;
    var c = null;
    if (hotEl) c = list.filter(function (x) { return x.el === hotEl; })[0] || null;
    else {
      var free = list.filter(function (x) { return !x.exact; }), okc = free.filter(function (x) { return fit(x, files).ok; });
      if (okc.length === 1) c = okc[0]; else if (free.length === 1 && list.length === 1) c = free[0];
      else { say(list.length ? (free.length ? '받는 곳이 여러 곳입니다 — 노란 점선 단추 위에 놓으세요' : '이 일은 실수로 덮어쓰지 않게 단추 «위»에 놓아야 합니다') : '이 화면에는 끌어서 받는 곳이 없습니다 — 단추를 눌러 파일을 고르세요', 'warn'); return; }
      if (c) say('«' + label(c.el) + '»(으)로 받습니다');
    }
    if (!c) { say('이 자리는 파일을 받지 않습니다', 'warn'); return; }
    var f = fit(c, files);
    if (!f.ok) { say(f.note, 'warn'); return; }
    if (f.note) say(f.note, 'warn');
    run(c, f.files);
  }

  function css() {
    var d = root.document, st = d.createElement('style');
    st.textContent = '.pudnd-ok{outline:2px dashed #fbbf24!important;outline-offset:2px;background-color:#fffbeb!important;color:#1e293b!important}'
      + '.pudnd-hot{outline-style:solid!important;background-color:#fde68a!important}'
      + '#pudndmsg{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483000;background:#1e293b;color:#fff;padding:9px 16px;border-radius:10px;font:600 13px/1.4 "Malgun Gothic",sans-serif;max-width:92vw}#pudndmsg.warn{background:#854d0e}'
      + '#pudndbar{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;background:#1e293b;color:#fff;padding:10px 18px;border-radius:999px;font:700 13px/1.4 "Malgun Gothic",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none;max-width:92vw}';
    d.head.appendChild(st);
  }
  function init(opts) {
    opts = opts || {};
    CFG.rules = opts.rules || {}; CFG.inputs = opts.inputs || []; CFG.toast = opts.toast || null;
    if (started || !root.document) return; started = true; css();
    var d = root.document, has = function (e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
    d.addEventListener('dragenter', function (e) { if (has(e)) start(); });
    d.addEventListener('dragover', function (e) {
      if (!has(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (!S.on) start();
      var hot = (e.target && e.target.closest) ? e.target.closest('.pudnd-ok') : null;
      if (hot !== S.hot) { if (S.hot) S.hot.classList.remove('pudnd-hot'); S.hot = hot; if (hot) hot.classList.add('pudnd-hot'); }
      root.clearTimeout(S.t); S.t = root.setTimeout(end, 1500);
    });
    d.addEventListener('dragleave', function (e) { if (S.on && e.relatedTarget === null) end(); });
    d.addEventListener('dragend', end);
    d.addEventListener('drop', function (e) {
      if (!has(e)) return; e.preventDefault();
      var hot = (e.target && e.target.closest) ? e.target.closest('.pudnd-ok') : null, list = S.cands.slice(), files = (e.dataTransfer && e.dataTransfer.files) || [];
      end(); drop(files, hot, list);
    });
  }
  return { init: init, pick: pick, _t: { extOf: extOf, acceptToExt: acceptToExt, parse: parse, fit: fit, drop: drop, _cfg: CFG } };
});
