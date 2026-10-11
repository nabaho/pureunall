/* pu-hwp-preview.js — 한글(.hwp·.hwpx) «읽기 전용» 미리보기 창 (2026-10-11)
   ------------------------------------------------------------------
   쓰는 법:  PuHwpPreview.open(바이트, '파일이름.hwpx', { onFail: function(e){} })
             → Promise<{pageCount}>   ·   PuHwpPreview.close()   ·   PuHwpPreview.isOpen()

   ★ 문서는 브라우저 밖으로 나가지 않는다 — 이 파일은 외부 주소를 쓰지 않고, 편집기도 만들지 않는다.
     그리는 일은 공용 엔진(js/pu-hwp-engine.js)의 PureunHwp.renderPreview 만 부른다(엔진 코어는 엔진이 알아서 지연 불러오기).
   ★ 파일 이름은 사람이 정한 «데이터» — 글자(textContent)로만 넣는다.
   ★ 한 번에 창은 하나. 이미 열려 있으면 같은 창의 제목·내용만 바꾼다(옛 요청이 늦게 끝나도 새 창을 건드리지 않는다).
   ★ 뒤로가기: PuBack 이 있으면 층으로 올려 «닫기»를 먼저 한다(js/pu-back.js 관례). 닫기 단추엔 data-close.
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var MSG_NO_ENGINE = '한글 엔진을 불러오지 못했습니다';
  var MSG_FAIL = '미리보기를 열지 못했습니다 — ';
  var MSG_LOADING = '불러오는 중…';

  var S = null;      /* 열려 있는 창 { root, title, status, host, token, onKey, backId } */
  var seq = 0;

  function doc() { return global.document; }
  function make(tag, css, text) {
    var e = doc().createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function reasonOf(e) { return (e && e.message) ? String(e.message) : String(e || '알 수 없는 오류'); }

  function build() {
    var root = make('div', 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:9000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:2vh 2vw');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', '한글 미리보기');
    var box = make('div', 'background:#ffffff;border-radius:12px;width:100%;max-width:980px;height:100%;display:flex;flex-direction:column;overflow:hidden');
    var top = make('div', 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b');
    var title = make('b', 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', '');
    var status = make('span', 'color:#64748b;font-size:13px', '');
    var close = make('button', 'border:1px solid #e2e8f0;background:#ffffff;color:#1e293b;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit', '닫기');
    close.setAttribute('type', 'button');
    close.setAttribute('data-close', '');
    close.addEventListener('click', close_);
    top.appendChild(title); top.appendChild(status); top.appendChild(close);
    box.appendChild(top);
    root.appendChild(box);
    /* 바깥(배경)만 눌렀을 때 닫는다 — 안쪽 클릭은 e.target 이 root 가 아니다 */
    root.addEventListener('click', function (e) { if (e && e.target === root) close_(); });
    doc().body.appendChild(root);
    var s = { root: root, box: box, title: title, status: status, host: null, token: 0, backId: null, onKey: null };
    s.onKey = function (e) { if (e && (e.key === 'Escape' || e.key === 'Esc')) close_(); };
    doc().addEventListener('keydown', s.onKey);
    if (global.PuBack && typeof global.PuBack.open === 'function') {
      try { s.backId = global.PuBack.open('한글 미리보기', close_); } catch (_) { s.backId = null; }
    }
    return s;
  }

  /* 내용 칸을 새로 만든다 — 옛 요청이 늦게 그려도 떼어 낸 옛 칸에만 그려진다 */
  function freshHost(s) {
    if (s.host && s.host.parentNode) s.host.parentNode.removeChild(s.host);
    s.host = make('div', 'flex:1;min-height:0;overflow:auto');
    s.box.appendChild(s.host);
    return s.host;
  }

  function close_() {
    var s = S;
    if (!s) return false;
    S = null;
    try { doc().removeEventListener('keydown', s.onKey); } catch (_) {}
    if (s.backId != null && global.PuBack && typeof global.PuBack.close === 'function') {
      try { global.PuBack.close(s.backId); } catch (_) {}
    }
    try { if (s.root.parentNode) s.root.parentNode.removeChild(s.root); } catch (_) {}
    s.host = null;
    return true;
  }

  function fail(opts, msg) {
    var err = new Error(msg);
    if (opts && typeof opts.onFail === 'function') { try { opts.onFail(err); } catch (_) {} }
    return Promise.reject(err);
  }

  function open(input, name, opts) {
    var eng = global.PureunHwp;
    if (!eng || typeof eng.renderPreview !== 'function' || !doc()) return fail(opts, MSG_NO_ENGINE);
    var s = S || (S = build());
    var mine = ++seq;
    s.token = mine;
    s.title.textContent = String(name == null ? '' : name);
    s.status.textContent = MSG_LOADING;
    var host = freshHost(s);
    var p;
    try { p = Promise.resolve(eng.renderPreview(host, input, name)); }
    catch (e) { p = Promise.reject(e); }
    return p.then(function (r) {
      if (S !== s || s.token !== mine) throw new Error('다른 파일을 열어 이 미리보기는 취소되었습니다');
      var n = r && r.pageCount != null ? r.pageCount : 0;
      s.status.textContent = n + '쪽';
      return { pageCount: n };
    }, function (e) {
      if (S !== s || s.token !== mine) throw new Error('다른 파일을 열어 이 미리보기는 취소되었습니다');
      var msg = MSG_FAIL + reasonOf(e);
      s.status.textContent = '';
      var note = make('div', 'padding:24px;color:#991b1b;text-align:center', msg);
      host.appendChild(note);
      return fail(opts, msg);
    });
  }

  var api = { open: open, close: close_, isOpen: function () { return !!S; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PuHwpPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
