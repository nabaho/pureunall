/* ══════════════════════════════════════════════════════════════════════════
 * 🤖 푸른포털 통합 AI 챗봇 창 (js/pu-chatbot.js)
 *
 * 기능:
 *   1. 상단 머리줄(건의하기 옆 #chatFab)에서 여는 드래그 이동형 플로팅 메신저 창(#puChatWin)
 *   2. 푸른포털 전체 앱 사용법 + 노동법 + 정부지원금 + 근로복지기금(fund_kb.js 지연 로드) 통합 질의응답
 *   3. 질문 전송 전 개인정보·식별정보 자동 가림(PuChatbot.maskPersonal) 및 서버 AI(PuAiCall) 연동
 *   4. 근거 원문 열람 팝업(#puChatDocModal) 및 현재 사용자 권한을 지키는 관련 앱 바로 열기
 *
 * ⚠ 색상은 푸른 27색 팔레트(tests/lib-palette.js) 안의 색만 사용한다.
 * ⚠ 창은 backdrop-filter 영향을 받지 않도록 document.body 직계 자식으로 붙인다.
 * ══════════════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PuChatbotUI) return;

  var STATE = {
    cat: 'all',
    mode: 'chat',     // 'chat' | 'dict'
    dictQ: '',
    logs: [],
    busy: false,
    epoch: 0,
    winPos: null,
    fundKbLoaded: false,
    fundKbLoading: null
  };

  function $(id) { return d.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectCss() {
    if ($('pu-chatbot-css')) return;
    var st = d.createElement('style');
    st.id = 'pu-chatbot-css';
    st.textContent = [
      '#puChatWin{position:fixed;right:22px;bottom:24px;width:430px;max-width:calc(100vw - 16px);height:560px;max-height:calc(100vh - 84px);z-index:85;display:none;flex-direction:column;background:#ffffff;border:1px solid #bfdbfe;border-radius:16px;box-shadow:0 20px 50px rgba(30,41,59,.24);overflow:hidden;color:#1e293b;font-family:inherit;}',
      '#puChatWin.on{display:flex;}',
      '#puChatHead{display:flex;align-items:center;gap:6px;padding:10px 12px;background:#eff6ff;border-bottom:1px solid #bfdbfe;cursor:move;user-select:none;touch-action:none;flex-shrink:0;}',
      '#puChatHead .t{font-size:13.5px;font-weight:800;color:#1e40af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#puChatHead .sp{flex:1;}',
      '.puc-hbtn{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:8px;padding:4px 9px;min-height:28px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '.puc-hbtn:hover{border-color:#2563eb;color:#1e40af;}',
      '.puc-hbtn.on{background:#1e40af;border-color:#1e40af;color:#ffffff;}',
      '.puc-xbtn{border:none;background:transparent;color:#475569;font-size:15px;font-weight:800;min-width:28px;min-height:28px;padding:4px 7px;cursor:pointer;line-height:1;border-radius:6px;}',
      '.puc-xbtn:hover{background:#bfdbfe;color:#1e293b;}',
      '.puc-hbtn:focus-visible,.puc-xbtn:focus-visible,.puc-cat:focus-visible,.puc-chip:focus-visible,.puc-appbtn:focus-visible,.puc-qbtn:focus-visible,.puc-dict-item:focus-visible,#puChatSend:focus-visible{outline:2px solid #2563eb;outline-offset:1px;}',
      '#puChatCats{display:flex;align-items:center;gap:5px;padding:7px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;overflow-x:auto;flex-shrink:0;}',
      '.puc-cat{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:999px;padding:4px 10px;min-height:28px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none;}',
      '.puc-cat.on{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '#puChatBody{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;}',
      '.puc-msg-q{display:flex;justify-content:flex-end;margin-bottom:6px;}',
      '.puc-bub-q{max-width:85%;padding:8px 12px;border-radius:13px 13px 3px 13px;background:#1e40af;color:#ffffff;font-size:13px;line-height:1.5;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-msg-a{display:flex;justify-content:flex-start;margin-bottom:12px;}',
      '.puc-bub-a{max-width:94%;padding:10px 12px;border-radius:13px 13px 13px 3px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.65;color:#1e293b;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-wait{font-size:11.5px;color:#2563eb;font-weight:600;margin-top:6px;}',
      '.puc-mask-note{font-size:11px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:3px 7px;margin-top:6px;}',
      '.puc-warn-note{font-size:11px;color:#64748b;margin-top:6px;}',
      '.puc-links{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:7px;border-top:1px dashed #e2e8f0;}',
      '.puc-chip{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-chip:hover{background:#bfdbfe;}',
      '.puc-appbtn{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-appbtn:hover{border-color:#16a34a;}',
      '.puc-welcome{padding:11px 13px;border-radius:12px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.65;color:#475569;margin-bottom:10px;}',
      '.puc-welcome b{color:#1e293b;}',
      '.puc-quick-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '.puc-qbtn{border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;}',
      '.puc-qbtn:hover{border-color:#2563eb;background:#eff6ff;color:#1e40af;}',
      '#puChatFoot{display:flex;align-items:center;gap:6px;padding:9px 10px;background:#ffffff;border-top:1px solid #e2e8f0;flex-shrink:0;}',
      '#puChatInp,#puChatDictInp{flex:1;height:38px;padding:0 11px;border:1px solid #cbd5e1;border-radius:9px;background:#ffffff;color:#1e293b;font-size:14px;font-family:inherit;outline:none;}',
      '#puChatInp:focus,#puChatDictInp:focus{border-color:#1e40af;}',
      '#puChatSend{height:38px;padding:0 14px;border:none;border-radius:9px;background:#1e40af;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '#puChatSend:disabled{opacity:.55;cursor:not-allowed;}',
      '.puc-dict-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;}',
      '.puc-dict-item{padding:9px 11px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin-bottom:7px;cursor:pointer;}',
      '.puc-dict-item:hover{border-color:#60a5fa;background:#eff6ff;}',
      '.puc-dict-top{display:flex;align-items:center;gap:6px;font-size:11px;color:#64748b;margin-bottom:3px;}',
      '.puc-dict-badge{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:999px;padding:1px 7px;font-size:10.5px;font-weight:700;}',
      '.puc-dict-t{font-size:12.5px;font-weight:700;color:#1e293b;line-height:1.4;}',
      '#puChatDocModal{display:none;position:fixed;inset:0;background:rgba(30,41,59,.52);z-index:92;align-items:center;justify-content:center;padding:16px;}',
      '#puChatDocModal.on{display:flex;}',
      '#puChatDocModal .box{background:#ffffff;border-radius:16px;width:640px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(30,41,59,.35);}',
      '#puChatDocModal .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
      '#puChatDocModal .bd{padding:16px 18px;overflow-y:auto;font-size:13px;line-height:1.7;color:#1e293b;}',
      '#puChatDocModal .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;}',
      '@media (max-width:768px){#puChatInp,#puChatDictInp{font-size:16px;}}',
      '@media (max-width:520px){#puChatWin{left:8px!important;right:8px!important;top:auto!important;bottom:74px!important;width:auto;height:min(520px,calc(100vh - 96px));}}'
    ].join('\n');
    (d.head || d.documentElement).appendChild(st);
  }

  /* ── fund_kb.js 지연 로드 (포털 초기 진입 속도를 해치지 않도록 챗봇을 열 때 한 번만 불러온다) ── */
  function ensureFundKb() {
    if (w.FUND_KB && Array.isArray(w.FUND_KB)) {
      STATE.fundKbLoaded = true;
      return Promise.resolve(w.FUND_KB);
    }
    if (STATE.fundKbLoading) return STATE.fundKbLoading;
    STATE.fundKbLoading = new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; STATE.fundKbLoading = null; resolve(w.FUND_KB || []); }
      }, 1500);
      function done(val) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(val);
      }
      try {
        var s = d.createElement('script');
        s.src = 'fund_kb.js?v=1';
        s.async = true;
        s.onload = function () { STATE.fundKbLoaded = true; done(w.FUND_KB || []); };
        s.onerror = function () { STATE.fundKbLoading = null; done([]); };
        (d.head || d.body || d.documentElement).appendChild(s);
      } catch (_) {
        STATE.fundKbLoading = null;
        done([]);
      }
    });
    return STATE.fundKbLoading;
  }

  /* ── 현재 로그인한 사용자에게 실제로 열려 있는 포털 앱인지 점검 (권한·준비중·PC전용 우회 방지) ── */
  function accessibleApps() {
    var root = d.getElementById('appRows');
    var tiles = root ? root.querySelectorAll('.tile[data-key]') : d.querySelectorAll('.tile[data-key]');
    var map = {};
    var list = [];
    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      var key = t.dataset && t.dataset.key;
      if (!key || map[key]) continue;
      if (t.style && t.style.display === 'none') continue;
      if (t.getAttribute('aria-disabled') === 'true') continue;
      if (t.getAttribute('href') === '#') continue;
      var b = t.querySelector('.tx b');
      var name = b ? b.textContent.trim() : key;
      var title = t.getAttribute('title') || '';
      var desc = title.indexOf('—') >= 0 ? title.split('—').slice(1).join('—').trim() : '';
      map[key] = { key: key, name: name, desc: desc };
      list.push(map[key]);
    }
    return { map: map, list: list };
  }

  function launchPortalApp(key, extraQuery) {
    var acc = accessibleApps();
    if (!acc.map[key]) return false;
    if (typeof w.portalLaunchApp === 'function') {
      return !!w.portalLaunchApp(key, extraQuery || '');
    }
    var tile = d.querySelector('#appRows .tile[data-key="' + key + '"]') || d.querySelector('.tile[data-key="' + key + '"]');
    if (!tile || tile.style.display === 'none' || tile.getAttribute('aria-disabled') === 'true') return false;
    tile.click();
    return true;
  }

  function catLabel(catId) {
    var cats = (w.PuChatbot && w.PuChatbot.CHAT_CATS) || [];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i][0] === catId) return cats[i][1];
    }
    return catId || '기타';
  }

  /* ── 드래그 이동 (화면 밖 이탈 방지 포함) ── */
  function clampWinPos(win) {
    if (!win || !win.classList.contains('on')) return;
    if (w.matchMedia && w.matchMedia('(max-width:520px)').matches) return;
    if (!STATE.winPos) return;
    var W = w.innerWidth || d.documentElement.clientWidth || 1024;
    var H = w.innerHeight || d.documentElement.clientHeight || 768;
    var r = win.getBoundingClientRect();
    var nx = Math.max(8, Math.min(W - Math.min(r.width || 320, W - 16), STATE.winPos.left));
    var ny = Math.max(8, Math.min(H - 64, STATE.winPos.top));
    STATE.winPos = { left: nx, top: ny };
    win.style.left = nx + 'px';
    win.style.top = ny + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }

  function bindDrag(win, head) {
    if (!win || !head || head._puDragBound) return;
    head._puDragBound = true;
    var drag = null;
    head.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button,[data-nodrag]')) return;
      if (w.matchMedia && w.matchMedia('(max-width:520px)').matches) return;
      var r = win.getBoundingClientRect();
      drag = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    head.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var W = w.innerWidth || d.documentElement.clientWidth || 1024;
      var H = w.innerHeight || d.documentElement.clientHeight || 768;
      var nx = Math.max(8, Math.min(W - 140, Math.round(drag.ox + (e.clientX - drag.sx))));
      var ny = Math.max(8, Math.min(H - 64, Math.round(drag.oy + (e.clientY - drag.sy))));
      STATE.winPos = { left: nx, top: ny };
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
    });
    function endDrag() {
      if (!drag) return;
      try { head.releasePointerCapture(drag.pid); } catch (_) {}
      drag = null;
    }
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
    w.addEventListener('resize', function () { clampWinPos(win); });
  }

  /* ── 원문·상세 보기 모달 ── */
  function ensureDocModal() {
    var m = $('puChatDocModal');
    if (m) return m;
    m = d.createElement('div');
    m.id = 'puChatDocModal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', '근거·안내 상세 보기');
    m.innerHTML = '<div class="box">'
      + '<div class="hd"><b id="puChatDocTitle" style="font-size:15px;color:#1e293b">상세 보기</b>'
      + '<button type="button" class="puc-xbtn" data-doc-close="1" aria-label="닫기">✕</button></div>'
      + '<div class="bd" id="puChatDocBody"></div>'
      + '<div class="ft" id="puChatDocFoot">'
      + '<button type="button" class="puc-hbtn on" data-doc-close="1" style="padding:6px 14px;font-size:12.5px">닫기</button></div>'
      + '</div>';
    m.addEventListener('click', function (e) {
      if (e.target === m || (e.target.closest && e.target.closest('[data-doc-close]'))) {
        m.classList.remove('on');
      }
      var appBtn = e.target.closest && e.target.closest('[data-chat-app]');
      if (appBtn) {
        var key = appBtn.getAttribute('data-chat-app');
        var extra = appBtn.getAttribute('data-chat-extra') || '';
        m.classList.remove('on');
        launchPortalApp(key, extra);
      }
    });
    d.body.appendChild(m);
    return m;
  }

  function openDocDetail(id) {
    if (!w.PuChatbot) return;
    var it = w.PuChatbot.findById(id);
    if (!it) return;
    var m = ensureDocModal();
    var acc = accessibleApps();
    var pts = (it.points || []).map(function (p) { return '<li style="margin:4px 0">' + esc(p) + '</li>'; }).join('');
    var appBtns = (it.apps || []).filter(function (k) { return !!acc.map[k]; }).map(function (k) {
      return '<button type="button" class="puc-appbtn" data-chat-app="' + esc(k) + '">↗ ' + esc(acc.map[k].name) + ' 열기</button>';
    }).join(' ');
    if (it.cat === 'fund' && acc.map.fund) {
      appBtns += ' <button type="button" class="puc-appbtn" data-chat-app="fund" data-chat-extra="chat=1">💬 기금 전문 챗봇으로 열기</button>';
    }

    $('puChatDocTitle').textContent = it.title || '상세 안내';
    $('puChatDocBody').innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'
      + '<span class="puc-dict-badge">' + esc(catLabel(it.cat)) + '</span>'
      + '<span class="puc-dict-badge" style="background:#f8fafc;color:#475569;border-color:#cbd5e1">' + esc(it.source || '') + (it.docNo ? ' · ' + esc(it.docNo) : '') + '</span>'
      + '</div>'
      + '<div style="padding:8px 11px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:12px;margin-bottom:10px">'
      + '<b>관련 근거·범위:</b> ' + esc(it.law || '—') + (it.date ? ' (' + esc(it.date) + ')' : '') + '</div>'
      + '<div style="padding:9px 11px;border-left:3px solid #2563eb;background:#eff6ff;border-radius:6px;font-size:12.5px;font-weight:700;margin-bottom:10px;color:#1e293b">'
      + '❓ ' + esc(it.q || '') + '</div>'
      + '<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;white-space:pre-line;margin-bottom:10px">'
      + esc(it.a || '') + '</div>'
      + (pts ? '<div style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:12px"><b style="color:#1e40af">📌 실무 핵심 체크포인트</b><ul style="margin:6px 0 0;padding-left:18px">' + pts + '</ul></div>' : '')
      + (appBtns ? '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">' + appBtns + '</div>' : '');
    m.classList.add('on');
  }

  /* ── 대화창 렌더링 ── */
  function renderWelcome() {
    var ex = (w.PuChatbot && w.PuChatbot.CHAT_EXAMPLES && w.PuChatbot.CHAT_EXAMPLES[STATE.cat]) || '';
    var acc = accessibleApps();
    var quickList = [
      ['시스템', '서류·명함 찍어서 자동 판독하고 업체에 넣으려면?'],
      ['시스템', '정부사업일정·컨설팅보고서·정부사업신청 차이는?'],
      ['노동법', '재직조건 붙은 정기상여금도 통상임금에 들어가나요?'],
      ['지원금', '청년일자리도약장려금 기업·청년 요건과 신청 순서는?'],
      ['기금', '기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?']
    ];
    var qBtns = quickList.map(function (q) {
      return '<button type="button" class="puc-qbtn" data-chat-quick="' + esc(q[1]) + '"><b>[' + esc(q[0]) + ']</b> ' + esc(q[1]) + '</button>';
    }).join('');
    var jumpRow = '';
    if (acc.map.fund || acc.map.govaid) {
      jumpRow = '<div style="margin-top:9px;padding-top:8px;border-top:1px dashed #e2e8f0;display:flex;flex-wrap:wrap;gap:5px">'
        + (acc.map.fund ? '<button type="button" class="puc-appbtn" data-chat-app="fund" data-chat-extra="chat=1">💬 기금관리 법령·해석 챗봇 열기</button>' : '')
        + (acc.map.govaid ? '<button type="button" class="puc-appbtn" data-chat-app="govaid">🎯 기업정부지원금 열기</button>' : '')
        + '</div>';
    }
    return '<div class="puc-welcome">'
      + '안녕하세요! <b>푸른포털 시스템 사용법</b>부터 <b>노동법 실무 · 기업정부지원금 · 근로복지기금 법령/유권해석</b>까지 한곳에서 답해 드립니다.'
      + (ex ? '<div style="font-size:11.5px;color:#64748b;margin-top:5px">' + esc(ex) + '</div>' : '')
      + '<div class="puc-quick-grid">' + qBtns + '</div>'
      + jumpRow
      + '</div>';
  }

  function renderTurn(turn) {
    var acc = accessibleApps();
    var ans = turn.aiText || turn.answer || '';
    var citeChips = (turn.cites || []).map(function (id) {
      var it = w.PuChatbot && w.PuChatbot.findById(id);
      if (!it) return '';
      return '<button type="button" class="puc-chip" data-chat-cite="' + esc(it.id) + '" title="' + esc(it.title) + '">📎 근거 보기: ' + esc(it.docNo || it.id) + '</button>';
    }).filter(Boolean).join(' ');

    var appChips = (turn.apps || []).filter(function (k) { return !!acc.map[k]; }).map(function (k) {
      var extra = (k === 'fund' && /기금|출연|예규|공단/.test(turn.q)) ? 'chat=1' : '';
      return '<button type="button" class="puc-appbtn" data-chat-app="' + esc(k) + '"' + (extra ? ' data-chat-extra="' + esc(extra) + '"' : '') + '>↗ ' + esc(acc.map[k].name) + ' 열기</button>';
    }).join(' ');

    var maskHtml = (turn.maskedKinds && turn.maskedKinds.length)
      ? '<div class="puc-mask-note">🔒 개인·기업 식별정보(' + esc(turn.maskedKinds.join('·')) + ')는 가리고 질문했습니다.</div>'
      : '';

    var errHtml = turn.errNote
      ? '<div class="puc-warn-note">' + esc(turn.errNote) + '</div>'
      : '';

    var links = [citeChips, appChips].filter(Boolean).join(' ');
    return '<div>'
      + '<div class="puc-msg-q"><div class="puc-bub-q">' + esc(turn.q) + '</div></div>'
      + '<div class="puc-msg-a"><div class="puc-bub-a">'
      + '<div style="white-space:pre-line">' + esc(ans) + '</div>'
      + (turn.aiLoading ? '<div class="puc-wait">🤖 AI가 근거자료를 바탕으로 답변을 정리하는 중…</div>' : '')
      + maskHtml
      + errHtml
      + (turn.aiText ? '<div class="puc-warn-note">⚠ AI 요약 답변 — 법적 효력·기한·수치는 원문 및 담당 노무사 확인</div>' : '')
      + (links ? '<div class="puc-links">' + links + '</div>' : '')
      + '</div></div></div>';
  }

  function renderDictBody() {
    var C = w.PuChatbot;
    if (!C) return '';
    var hits = C.filter(STATE.cat, STATE.dictQ);
    var listHtml = hits.slice(0, 60).map(function (it) {
      return '<div class="puc-dict-item" role="button" tabindex="0" data-chat-cite="' + esc(it.id) + '">'
        + '<div class="puc-dict-top"><span class="puc-dict-badge">' + esc(catLabel(it.cat)) + '</span>'
        + '<span>' + esc(it.docNo || it.source || '') + '</span></div>'
        + '<div class="puc-dict-t">' + esc(it.title) + '</div>'
        + '</div>';
    }).join('');
    return '<div class="puc-dict-bar">'
      + '<input id="puChatDictInp" type="text" aria-label="통합사전 키워드 검색" value="' + esc(STATE.dictQ) + '" placeholder="🔍 사전 키워드·조문·문서번호·앱 이름 검색…">'
      + '<span style="font-size:11.5px;color:#64748b;white-space:nowrap">' + hits.length + '건</span>'
      + '</div>'
      + (listHtml || '<div class="puc-welcome">검색어와 일치하는 사전 항목이 없습니다. [💬 대화] 탭에서 자유롭게 질문해 보세요.</div>');
  }

  function refreshView(scrollEnd) {
    var win = $('puChatWin');
    if (!win) return;
    var catsEl = $('puChatCats');
    if (catsEl && w.PuChatbot) {
      catsEl.innerHTML = w.PuChatbot.CHAT_CATS.map(function (c) {
        var isOn = STATE.cat === c[0];
        return '<button type="button" role="tab" aria-selected="' + (isOn ? 'true' : 'false') + '" class="puc-cat' + (isOn ? ' on' : '') + '" data-chat-cat="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
      }).join('');
    }
    var dictBtn = $('puChatModeBtn');
    if (dictBtn) {
      dictBtn.classList.toggle('on', STATE.mode === 'dict');
      dictBtn.textContent = STATE.mode === 'dict' ? '💬 대화로' : '📚 통합사전';
    }
    var foot = $('puChatFoot');
    if (foot) foot.style.display = STATE.mode === 'dict' ? 'none' : 'flex';
    var sendBtn = $('puChatSend');
    if (sendBtn) sendBtn.disabled = !!STATE.busy;

    var body = $('puChatBody');
    if (!body) return;
    if (STATE.mode === 'dict') {
      body.innerHTML = renderDictBody();
      var di = $('puChatDictInp');
      if (di) {
        di.addEventListener('input', function () {
          STATE.dictQ = di.value || '';
          var pos = di.selectionStart || STATE.dictQ.length;
          refreshView(false);
          var di2 = $('puChatDictInp');
          if (di2) { di2.focus(); try { di2.setSelectionRange(pos, pos); } catch (_) {} }
        });
      }
      return;
    }
    body.innerHTML = STATE.logs.length ? STATE.logs.map(renderTurn).join('') : renderWelcome();
    if (scrollEnd) body.scrollTop = body.scrollHeight;
  }

  /* ── AI 호출 (서버 Gemini 대리인 PuAiCall 우선 → 설정된 Claude 프록시 보조) ── */
  function readProxyUrl() {
    try {
      var raw = (w.PU_CFG && w.PU_CFG.aiProxyUrl) || w.localStorage.getItem('pureun_v6_setting_ai_proxy_url') || '';
      if (!raw) return '';
      if (raw.charAt(0) === '"') { try { return JSON.parse(raw); } catch (_) { return raw.replace(/^"|"$/g, ''); } }
      return String(raw).trim();
    } catch (_) { return ''; }
  }

  function callAiBackend(systemPrompt, userPrompt) {
    var auth = (w.firebase && typeof w.firebase.auth === 'function') ? w.firebase.auth() : null;
    if (w.PuAiCall && typeof w.PuAiCall.ask === 'function' && auth && auth.currentUser) {
      return w.PuAiCall.ask(
        [{ text: systemPrompt + '\n\n' + userPrompt }],
        { auth: auth, app: 'portal', manual: true }
      ).then(function (reply) {
        return w.PuAiCall.textOf(reply);
      });
    }
    var proxy = readProxyUrl();
    if (proxy && typeof w.fetch === 'function') {
      var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ac ? setTimeout(function () { ac.abort(); }, 45000) : null;
      return w.fetch(proxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }),
        signal: ac ? ac.signal : undefined
      }).then(function (r) {
        if (timer) clearTimeout(timer);
        return r.json();
      }, function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      }).then(function (d) {
        if (d && d.error) throw new Error(d.error.message || 'AI 응답 오류');
        var t = (d && (d.reply || d.text)) || (((d && d.content) || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''));
        if (!t) throw new Error('AI 응답이 비어 있습니다');
        return t;
      });
    }
    return Promise.reject(new Error('NO_AI_BACKEND'));
  }

  function humanAiError(err, hasLocalAnswer) {
    var msg = String((err && err.message) || '');
    if (msg === 'NO_AI_BACKEND') return hasLocalAnswer ? '' : '로그인 상태를 확인해 주세요.';
    if (err && (err.status === 429 || err.overBudget || /quota|RESOURCE_EXHAUSTED|한도/i.test(msg))) {
      return hasLocalAnswer ? 'ℹ 오늘 AI 요약 한도가 차서 내장 근거 사전 답변을 그대로 보여드립니다.' : '오늘 AI 사용 한도가 찼습니다. 상단 [📚 통합사전]에서 키워드로 바로 찾아보실 수 있습니다.';
    }
    if (err && err.status === 401) return '로그인 인증을 다시 확인해 주세요.';
    return hasLocalAnswer ? '' : ('AI 연결이 원활하지 않습니다 (' + (msg || '응답 지연') + ')');
  }

  /* ── 질문 전송 ── */
  function ask(rawQ) {
    if (!w.PuChatbot || STATE.busy) return Promise.resolve();
    var inp = $('puChatInp');
    var q = String(rawQ != null ? rawQ : (inp ? inp.value : '')).trim();
    if (!q) {
      if (inp) inp.focus();
      return Promise.resolve();
    }
    if (inp && rawQ == null) inp.value = '';
    STATE.mode = 'chat';
    STATE.busy = true;
    var myEpoch = STATE.epoch;

    return ensureFundKb().then(function () {
      if (myEpoch !== STATE.epoch) { STATE.busy = false; return; }
      var acc = accessibleApps();
      var picked = w.PuChatbot.pick(q, { cat: STATE.cat, max: 3 });
      var loc = w.PuChatbot.localAnswer(picked, q);
      var pr = w.PuChatbot.makePrompt(picked, q, { apps: acc.list });

      var turn = {
        q: q,
        picked: picked,
        answer: loc.answer,
        cites: loc.cites || [],
        apps: (loc.apps || []).filter(function (k) { return !!acc.map[k]; }),
        maskedKinds: pr.maskedKinds || [],
        aiText: '',
        aiLoading: true,
        errNote: ''
      };
      STATE.logs.push(turn);
      if (STATE.logs.length > 30) STATE.logs.shift();
      refreshView(true);

      var validKeys = acc.list.map(function (a) { return a.key; });
      return callAiBackend(pr.system, pr.user).then(function (rawReply) {
        if (myEpoch !== STATE.epoch) return;
        var parsed = w.PuChatbot.parseReply(rawReply, picked, validKeys);
        turn.aiLoading = false;
        if (parsed && parsed.answer) turn.aiText = parsed.answer;
        if (parsed && parsed.cites && parsed.cites.length) turn.cites = parsed.cites;
        if (parsed && parsed.apps && parsed.apps.length) turn.apps = parsed.apps;
      }).catch(function (err) {
        if (myEpoch !== STATE.epoch) return;
        turn.aiLoading = false;
        turn.errNote = humanAiError(err, !loc.none);
      }).then(function () {
        if (myEpoch !== STATE.epoch) return;
        STATE.busy = false;
        refreshView(true);
      });
    });
  }

  /* ── 창 생성·열기·닫기·초기화 ── */
  function ensureWindow() {
    injectCss();
    var win = $('puChatWin');
    if (win) return win;
    win = d.createElement('div');
    win.id = 'puChatWin';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', '푸른 통합 AI 챗봇');
    win.innerHTML = '<div id="puChatHead" title="머리줄을 마우스로 끌어 위치를 옮길 수 있습니다">'
      + '<span class="t">🤖 푸른 통합 챗봇</span>'
      + '<span class="sp"></span>'
      + '<button type="button" class="puc-hbtn" id="puChatModeBtn" data-nodrag="1" title="내장 법령·유권해석·앱 안내 사전 전체 검색">📚 통합사전</button>'
      + '<button type="button" class="puc-hbtn" data-chat-act="clear" data-nodrag="1" title="대화 비우기">지우기</button>'
      + '<button type="button" class="puc-xbtn" data-chat-act="close" data-nodrag="1" aria-label="챗봇 닫기" title="닫기 (Esc)">✕</button>'
      + '</div>'
      + '<div id="puChatCats" role="tablist" aria-label="질문 분야 선택"></div>'
      + '<div id="puChatBody"></div>'
      + '<div id="puChatFoot">'
      + '<input id="puChatInp" type="text" aria-label="푸른 통합 챗봇 질문 입력" placeholder="시스템 사용법·노동법·지원금·기금 법령 무엇이든 물어보세요…" autocomplete="off">'
      + '<button type="button" id="puChatSend">전송</button>'
      + '</div>';

    win.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest) {
        var dictItem = e.target.closest('.puc-dict-item[data-chat-cite]');
        if (dictItem) {
          e.preventDefault();
          openDocDetail(dictItem.getAttribute('data-chat-cite'));
        }
      }
    });

    win.addEventListener('click', function (e) {
      var actBtn = e.target.closest && e.target.closest('[data-chat-act]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-chat-act');
        if (act === 'close') close();
        else if (act === 'clear') clearChat();
        return;
      }
      if (e.target.closest && e.target.closest('#puChatModeBtn')) {
        STATE.mode = STATE.mode === 'dict' ? 'chat' : 'dict';
        ensureFundKb().then(function () { refreshView(false); });
        refreshView(false);
        return;
      }
      var catBtn = e.target.closest && e.target.closest('[data-chat-cat]');
      if (catBtn) {
        STATE.cat = catBtn.getAttribute('data-chat-cat') || 'all';
        refreshView(false);
        return;
      }
      var quickBtn = e.target.closest && e.target.closest('[data-chat-quick]');
      if (quickBtn) {
        ask(quickBtn.getAttribute('data-chat-quick'));
        return;
      }
      var citeBtn = e.target.closest && e.target.closest('[data-chat-cite]');
      if (citeBtn) {
        openDocDetail(citeBtn.getAttribute('data-chat-cite'));
        return;
      }
      var appBtn = e.target.closest && e.target.closest('[data-chat-app]');
      if (appBtn) {
        launchPortalApp(appBtn.getAttribute('data-chat-app'), appBtn.getAttribute('data-chat-extra') || '');
      }
    });

    d.body.appendChild(win);
    bindDrag(win, $('puChatHead'));

    var inp = $('puChatInp');
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          ask();
        }
      });
    }
    var send = $('puChatSend');
    if (send) send.addEventListener('click', function () { ask(); });

    d.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var dm = $('puChatDocModal');
      if (dm && dm.classList.contains('on')) {
        dm.classList.remove('on');
        return;
      }
      if (win.classList.contains('on')) {
        close();
        var fab = $('chatFab');
        if (fab) fab.focus();
      }
    });

    return win;
  }

  function open(initQuestion) {
    var win = ensureWindow();
    win.classList.add('on');
    clampWinPos(win);
    var fab = $('chatFab');
    if (fab) fab.setAttribute('aria-expanded', 'true');
    ensureFundKb().then(function () {
      if (STATE.mode === 'dict') refreshView(false);
    });
    refreshView(true);
    if (initQuestion) {
      ask(initQuestion);
    } else {
      var inp = STATE.mode === 'dict' ? $('puChatDictInp') : $('puChatInp');
      if (inp) inp.focus();
    }
  }

  function close() {
    var win = $('puChatWin');
    if (win) win.classList.remove('on');
    var dm = $('puChatDocModal');
    if (dm) dm.classList.remove('on');
    var fab = $('chatFab');
    if (fab) fab.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    var win = $('puChatWin');
    if (win && win.classList.contains('on')) close();
    else open();
  }

  function clearChat() {
    STATE.epoch++;
    STATE.busy = false;
    STATE.logs = [];
    refreshView(false);
  }

  /* 로그아웃 시 대화 기록·열린 창 즉시 정리 (공용 PC 개인정보 잔류 방지) */
  function resetOnLogout() {
    clearChat();
    close();
    var fab = $('chatFab');
    if (fab) fab.style.display = 'none';
  }

  function bindTrigger() {
    var fab = $('chatFab');
    if (!fab || fab._puChatBound) return;
    fab._puChatBound = true;
    fab.addEventListener('click', toggle);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bindTrigger);
  else bindTrigger();

  w.PuChatbotUI = {
    open: open,
    close: close,
    toggle: toggle,
    ask: ask,
    clear: clearChat,
    resetOnLogout: resetOnLogout,
    openDocDetail: openDocDetail,
    _state: STATE
  };
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
