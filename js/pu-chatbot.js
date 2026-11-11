/* ══════════════════════════════════════════════════════════════════════════
 * 💬 푸른포털 시스템 길잡이 채팅방 & 연결도 지도 UI (js/pu-chatbot.js)
 *
 * 기능:
 *   1. 상단 머리줄(건의하기 옆 #chatFab)에서 여는 드래그 이동형 인터랙티브 채팅방(#puChatWin)
 *   2. 4대 영역(의뢰인 업무·자료함·영업관리·내부관리) 사용법과 앱 간 데이터 연결도를
 *      화살표 흐름 카드(.puc-flow) + 꼬리질문 티키타카(.puc-fup) + 멀티턴 맥락 기억으로 안내
 *   3. 상단 [🔗 연결도] 전용 탭에서 6대 실무 흐름도와 24개 전체 앱 입출력(←/→) 지도 제공
 *   4. 노동법 실무 · 기업정부지원금 · 근로복지기금(fund_kb.js 지연 로드) 통합 질의응답 및 사전 검색
 *   5. 질문·대화맥락 전송 전 개인정보 자동 가림(maskPersonal) 및 권한 준수 앱 실행
 *
 * ⚠ 색상은 푸른 27색 팔레트(tests/lib-palette.js) 안의 색만 사용한다.
 * ⚠ 창은 backdrop-filter 영향을 받지 않도록 document.body 직계 자식으로 붙인다.
 * ══════════════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PuChatbotUI) return;

  var STATE = {
    cat: 'all',
    mode: 'chat',     // 'chat' | 'map' | 'dict'
    mapTab: 'flows',  // 'flows' | 'client' | 'store' | 'sales' | 'inside' | 'allrows'
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
      '#puChatWin{position:fixed;right:22px;bottom:24px;width:468px;max-width:calc(100vw - 16px);height:610px;max-height:calc(100vh - 84px);z-index:85;display:none;flex-direction:column;background:#ffffff;border:1px solid #bfdbfe;border-radius:16px;box-shadow:0 20px 50px rgba(30,41,59,.24);overflow:hidden;color:#1e293b;font-family:inherit;}',
      '#puChatWin.on{display:flex;}',
      '#puChatHead{display:flex;align-items:center;gap:5px;padding:10px 11px;background:#eff6ff;border-bottom:1px solid #bfdbfe;cursor:move;user-select:none;touch-action:none;flex-shrink:0;}',
      '#puChatHead .t{font-size:13.5px;font-weight:800;color:#1e40af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#puChatHead .sp{flex:1;}',
      '.puc-hbtn{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:8px;padding:4px 8px;min-height:28px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '.puc-hbtn:hover{border-color:#2563eb;color:#1e40af;}',
      '.puc-hbtn.on{background:#1e40af;border-color:#1e40af;color:#ffffff;}',
      '.puc-xbtn{border:none;background:transparent;color:#475569;font-size:15px;font-weight:800;min-width:28px;min-height:28px;padding:4px 7px;cursor:pointer;line-height:1;border-radius:6px;}',
      '.puc-xbtn:hover{background:#bfdbfe;color:#1e293b;}',
      '.puc-hbtn:focus-visible,.puc-xbtn:focus-visible,.puc-cat:focus-visible,.puc-chip:focus-visible,.puc-appbtn:focus-visible,.puc-qbtn:focus-visible,.puc-rowbtn:focus-visible,.puc-map-banner:focus-visible,.puc-fstep:focus-visible,.puc-fup:focus-visible,.puc-dict-item:focus-visible,#puChatSend:focus-visible{outline:2px solid #2563eb;outline-offset:1px;}',
      '#puChatCats{display:flex;align-items:center;gap:5px;padding:7px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;overflow-x:auto;flex-shrink:0;}',
      '.puc-cat{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:999px;padding:4px 10px;min-height:28px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none;}',
      '.puc-cat.on{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '#puChatBody{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;}',
      '.puc-msg-q{display:flex;justify-content:flex-end;margin-bottom:6px;}',
      '.puc-bub-q{max-width:85%;padding:8px 12px;border-radius:13px 13px 3px 13px;background:#1e40af;color:#ffffff;font-size:13px;line-height:1.5;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-msg-a{display:flex;justify-content:flex-start;margin-bottom:14px;}',
      '.puc-bub-a{max-width:96%;padding:11px 13px;border-radius:13px 13px 13px 3px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.65;color:#1e293b;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-wait{font-size:11.5px;color:#2563eb;font-weight:600;margin-top:6px;}',
      '.puc-mask-note{font-size:11px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:3px 7px;margin-top:6px;}',
      '.puc-warn-note{font-size:11px;color:#475569;margin-top:6px;}',
      /* 대화 말풍선 내부 및 연결도 탭 공용 시각적 화살표 흐름 카드 */
      '.puc-flow{margin-top:10px;padding:10px 11px;border-radius:11px;background:#eff6ff;border:1px solid #bfdbfe;}',
      '.puc-flow-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;flex-wrap:wrap;}',
      '.puc-flow-bdg{background:#1e40af;color:#ffffff;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;}',
      '.puc-flow-tt{font-size:12px;font-weight:800;color:#1e293b;line-height:1.35;}',
      '.puc-flow-chain{display:flex;flex-wrap:wrap;align-items:stretch;gap:5px;margin-top:6px;}',
      '.puc-fstep{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;border-radius:8px;border:1px solid #bfdbfe;background:#ffffff;color:#1e293b;cursor:pointer;font-family:inherit;text-align:left;min-width:92px;flex:1 1 96px;}',
      '.puc-fstep:hover{border-color:#2563eb;background:#f8fafc;}',
      '.puc-fstep b{font-size:11.5px;font-weight:800;color:#1e40af;line-height:1.25;}',
      '.puc-fstep span{font-size:10.5px;color:#475569;line-height:1.3;}',
      '.puc-farr{display:flex;align-items:center;justify-content:center;color:#2563eb;font-size:13px;font-weight:800;padding:0 1px;user-select:none;}',
      '.puc-flow-note{margin-top:7px;font-size:11px;line-height:1.45;color:#1e293b;background:#ffffff;border:1px dashed #bfdbfe;border-radius:7px;padding:5px 8px;}',
      /* 꼬리질문 티키타카 칩 */
      '.puc-fups{margin-top:9px;padding-top:8px;border-top:1px dashed #e2e8f0;}',
      '.puc-fups-lb{font-size:11px;font-weight:800;color:#1e40af;margin-bottom:5px;}',
      '.puc-fup-list{display:flex;flex-direction:column;gap:4px;}',
      '.puc-fup{border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;line-height:1.35;}',
      '.puc-fup:hover{border-color:#2563eb;background:#eff6ff;color:#1e40af;}',
      '.puc-links{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:7px;border-top:1px dashed #e2e8f0;}',
      '.puc-chip{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-chip:hover{background:#bfdbfe;}',
      '.puc-appbtn{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-appbtn:hover{border-color:#16a34a;}',
      /* 첫 화면 길잡이 카드 */
      '.puc-welcome{padding:12px 13px;border-radius:12px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.6;color:#475569;margin-bottom:10px;}',
      '.puc-welcome b{color:#1e293b;}',
      '.puc-oneline{margin-top:8px;padding:7px 9px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;font-size:11.5px;line-height:1.5;color:#1e293b;}',
      '.puc-row-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px;}',
      '.puc-rowbtn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 9px;border-radius:10px;border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;cursor:pointer;font-family:inherit;text-align:left;}',
      '.puc-rowbtn:hover{border-color:#2563eb;background:#eff6ff;}',
      '.puc-rowbtn b{font-size:12px;font-weight:800;color:#1e40af;}',
      '.puc-rowbtn span{font-size:10.5px;color:#475569;line-height:1.3;}',
      '.puc-map-banner{width:100%;margin-top:7px;padding:8px 11px;border-radius:10px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between;}',
      '.puc-map-banner:hover{background:#bfdbfe;}',
      '.puc-quick-grid{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}',
      '.puc-qbtn{border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:8px;padding:5px 9px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;width:100%;}',
      '.puc-qbtn:hover{border-color:#2563eb;background:#eff6ff;color:#1e40af;}',
      /* 연결도 전용 탭 */
      '.puc-map-principles{padding:9px 11px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#854d0e;font-size:11.5px;line-height:1.55;margin-bottom:9px;}',
      '.puc-map-principles b{color:#1e293b;}',
      '.puc-map-subbar{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;}',
      '.puc-row-card{padding:10px 11px;border-radius:11px;background:#ffffff;border:1px solid #e2e8f0;margin-bottom:10px;}',
      '.puc-app-io{padding:8px 10px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;margin-top:7px;font-size:11.5px;line-height:1.5;}',
      '.puc-app-io-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:4px;}',
      '.puc-io-line{font-size:11px;color:#475569;margin-top:2px;}',
      '.puc-io-line b{color:#1e293b;}',
      '#puChatFoot{display:flex;align-items:center;gap:6px;padding:9px 10px;background:#ffffff;border-top:1px solid #e2e8f0;flex-shrink:0;}',
      '#puChatInp,#puChatDictInp{flex:1;height:38px;padding:0 11px;border:1px solid #cbd5e1;border-radius:9px;background:#ffffff;color:#1e293b;font-size:14px;font-family:inherit;outline:none;}',
      '#puChatInp:focus,#puChatDictInp:focus{border-color:#1e40af;}',
      '#puChatSend{height:38px;padding:0 14px;border:none;border-radius:9px;background:#1e40af;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '#puChatSend:disabled{opacity:.55;cursor:not-allowed;}',
      '.puc-dict-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;}',
      '.puc-dict-item{padding:9px 11px;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;margin-bottom:7px;cursor:pointer;}',
      '.puc-dict-item:hover{border-color:#60a5fa;background:#eff6ff;}',
      '.puc-dict-top{display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;margin-bottom:3px;}',
      '.puc-dict-badge{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:999px;padding:1px 7px;font-size:10.5px;font-weight:700;}',
      '.puc-dict-t{font-size:12.5px;font-weight:700;color:#1e293b;line-height:1.4;}',
      '#puChatDocModal{display:none;position:fixed;inset:0;background:rgba(30,41,59,.52);z-index:92;align-items:center;justify-content:center;padding:16px;}',
      '#puChatDocModal.on{display:flex;}',
      '#puChatDocModal .box{background:#ffffff;border-radius:16px;width:640px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(30,41,59,.35);}',
      '#puChatDocModal .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
      '#puChatDocModal .bd{padding:16px 18px;overflow-y:auto;font-size:13px;line-height:1.7;color:#1e293b;}',
      '#puChatDocModal .ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;}',
      '@media (max-width:768px){#puChatInp,#puChatDictInp{font-size:16px;}}',
      '@media (max-width:520px){#puChatWin{left:8px!important;right:8px!important;top:auto!important;bottom:74px!important;width:auto;height:min(540px,calc(100vh - 96px));}.puc-row-grid{grid-template-columns:1fr;}}',
      '@media (max-width:420px){#puChatHead{gap:4px;padding:8px 8px;}#puChatHead .t{font-size:12px;}#puChatHead .puc-hbtn{padding:4px 6px;font-size:11px;}}'
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

  /* ── 시각적 화살표 연결도 카드 렌더링 (말풍선 안 & 연결도 탭 공용) ── */
  function renderFlowCard(flowId, inMapView) {
    if (!flowId || !w.PuChatbot || typeof w.PuChatbot.findFlowById !== 'function') return '';
    var flow = w.PuChatbot.findFlowById(flowId);
    if (!flow) return '';

    var chainHtml = (flow.steps || []).map(function (st, idx) {
      var stepBtn = '<button type="button" class="puc-fstep" data-chat-quick="' + esc(st.ask) + '" title="누르면 이 단계의 사용법·연결도를 채팅으로 설명합니다">'
        + '<b>' + esc(st.icon) + ' ' + esc(st.name) + '</b>'
        + '<span>' + esc(st.role) + '</span>'
        + '</button>';
      return (idx > 0 ? '<span class="puc-farr" aria-hidden="true">➔</span>' : '') + stepBtn;
    }).join('');

    var jumpMapBtn = inMapView
      ? ''
      : '<button type="button" class="puc-chip" data-chat-mode="map">🔗 전체 연결도 ›</button>';

    var mapFollows = '';
    if (inMapView && flow.followUps && flow.followUps.length) {
      mapFollows = '<div style="margin-top:7px;display:flex;flex-wrap:wrap;gap:4px">'
        + flow.followUps.slice(0, 2).map(function (fq) {
          return '<button type="button" class="puc-chip" data-chat-quick="' + esc(fq) + '">💬 ' + esc(fq) + '</button>';
        }).join('')
        + '</div>';
    }

    return '<div class="puc-flow">'
      + '<div class="puc-flow-hd">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      + '<span class="puc-flow-bdg">' + esc(flow.badge) + '</span>'
      + '<span class="puc-flow-tt">' + esc(flow.title) + '</span>'
      + '</div>'
      + jumpMapBtn
      + '</div>'
      + (inMapView && flow.summary ? '<div style="font-size:11.5px;color:#475569;margin-bottom:4px">' + esc(flow.summary) + '</div>' : '')
      + '<div class="puc-flow-chain">' + chainHtml + '</div>'
      + '<div style="font-size:10.5px;color:#1e40af;margin-top:5px">👆 각 앱 상자를 누르면 해당 단계의 자세한 사용법·연결도를 바로 대화로 알려드립니다.</div>'
      + (flow.note ? '<div class="puc-flow-note">' + esc(flow.note) + '</div>' : '')
      + mapFollows
      + '</div>';
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
      + '<button type="button" id="puChatDocCloseBtn" class="puc-hbtn on" data-doc-close="1" style="padding:6px 14px;font-size:12.5px">닫기</button></div>'
      + '</div>';
    m.addEventListener('click', function (e) {
      if (e.target === m || (e.target.closest && e.target.closest('[data-doc-close]'))) {
        closeDocModal();
      }
      var qBtn = e.target.closest && e.target.closest('[data-chat-quick]');
      if (qBtn) {
        var qq = qBtn.getAttribute('data-chat-quick');
        m.classList.remove('on');
        ask(qq);
        return;
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
    var flowHtml = it.flowId ? renderFlowCard(it.flowId, true) : '';
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
      + flowHtml
      + (appBtns ? '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">' + appBtns + '</div>' : '');
    m._returnFocus = d.activeElement || null;
    m.classList.add('on');
    var cb = $('puChatDocCloseBtn');
    if (cb && typeof cb.focus === 'function') cb.focus();
  }

  function closeDocModal() {
    var m = $('puChatDocModal');
    if (!m) return;
    m.classList.remove('on');
    if (m._returnFocus && typeof m._returnFocus.focus === 'function') {
      try { m._returnFocus.focus(); } catch (_) {}
    }
    m._returnFocus = null;
  }

  /* ── 첫 화면 길잡이 (4대 영역 원클릭 + 연결도 지도 + 실무 시나리오) ── */
  function renderWelcome() {
    var ex = (w.PuChatbot && w.PuChatbot.CHAT_EXAMPLES && w.PuChatbot.CHAT_EXAMPLES[STATE.cat]) || '';
    var acc = accessibleApps();
    var rowButtons = [
      ['🏢 의뢰인 업무 (8)', '이알피·기금·컨설팅·지원금·규정', '의뢰인 업무 줄에 있는 프로그램들은 각각 언제 어떻게 사용하고 서로 어떻게 연결되어 있나요?'],
      ['📂 자료함 (7)',      '사진첩·기업정보함·메일·업무관리', '자료함 줄에 있는 사진첩, 기업정보함, 계약서등관리, 업무관리, 푸른 메일, 캘린더는 어떻게 연결해서 쓰나요?'],
      ['📣 영업관리 (5)',    '뉴스레터·홈페이지·회생광고·공고', '영업관리 줄의 뉴스레터, 홈페이지, 회생광고, 전광판, 정부사업신청은 직원이 어떻게 사용하고 어디와 연결되어 있나요?'],
      ['🔐 내부관리 (4)',    '재무 입금·인사·컨설팅정산·경력',  '내부관리 줄(인사관리, 재무관리, 컨설팅정산, 경력관리)은 누구에게 보이고 다른 앱과 어떻게 연결되나요?']
    ];
    var rowHtml = rowButtons.map(function (r) {
      return '<button type="button" class="puc-rowbtn" data-chat-quick="' + esc(r[2]) + '">'
        + '<b>' + esc(r[0]) + '</b>'
        + '<span>' + esc(r[1]) + '</span>'
        + '</button>';
    }).join('');

    var quickList = [
      ['신입·실무 순서', '신규 거래처 자문계약이나 노동사건을 새로 맡았을 때 어떤 앱부터 어떤 순서로 입력하면 되나요?'],
      ['연결도 원리',    '푸른통합시스템에서 앱끼리 연결도가 어떻게 되어 있나요? 한 곳에서 고치면 다른 앱에도 반영되나요?'],
      ['정부컨설팅',     '정부사업일정·컨설팅보고서·정부사업신청 차이는?'],
      ['노동법 실무',    '재직조건 붙은 정기상여금도 통상임금에 들어가나요?'],
      ['근로복지기금',   '기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?']
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
      + '<b>푸른 시스템 길잡이 채팅방</b>에 오신 것을 환영합니다!<br>'
      + '궁금한 영역을 누르거나 편하게 질문하시면 <b>사용 순서</b>와 <b>앱 연결도(➔)</b>를 한눈에 풀어 드리고, <b>꼬리질문</b>으로 이어서 대화할 수 있습니다.'
      + '<div class="puc-oneline"><b>한 줄 핵심:</b> 📂 <b>자료함</b>(서류·명함·메일 수집) ➔ 🏢 <b>푸른이알피</b>(모든 업체·계약·사건 원본) ➔ 📣 <b>영업관리</b>(홍보·공고) · 🔐 <b>내부관리</b>(입금·정산)</div>'
      + '<div class="puc-row-grid">' + rowHtml + '</div>'
      + '<button type="button" class="puc-map-banner" data-chat-mode="map">'
      + '<span>🔗 전체 24개 앱 연결도 · 입출력(←/→) 지도 한눈에 보기</span><span>열기 ›</span>'
      + '</button>'
      + (ex ? '<div style="font-size:11.5px;color:#475569;margin-top:8px">' + esc(ex) + '</div>' : '')
      + '<div class="puc-quick-grid">' + qBtns + '</div>'
      + jumpRow
      + '</div>';
  }

  /* ── 대화 말풍선 렌더링 (화살표 연결도 카드 + 이어서 물어보기 꼬리질문 포함) ── */
  function renderTurn(turn) {
    var acc = accessibleApps();
    var ans = turn.aiText || turn.answer || '';
    var flowCardHtml = turn.flowId ? renderFlowCard(turn.flowId, false) : '';

    var followHtml = '';
    if (Array.isArray(turn.followUps) && turn.followUps.length) {
      followHtml = '<div class="puc-fups">'
        + '<div class="puc-fups-lb">💡 이어서 물어보기 (누르면 바로 연결 질문합니다)</div>'
        + '<div class="puc-fup-list">'
        + turn.followUps.slice(0, 3).map(function (fq) {
          return '<button type="button" class="puc-fup" data-chat-quick="' + esc(fq) + '">💬 ' + esc(fq) + ' ›</button>';
        }).join('')
        + '</div></div>';
    }

    var citeChips = (turn.cites || []).map(function (id) {
      var it = w.PuChatbot && w.PuChatbot.findById(id);
      if (!it) return '';
      return '<button type="button" class="puc-chip" data-chat-cite="' + esc(it.id) + '" title="' + esc(it.title) + '">📎 근거·상세: ' + esc(it.docNo || it.id) + '</button>';
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
      + flowCardHtml
      + (turn.aiLoading ? '<div class="puc-wait">🤖 AI가 대화 맥락과 근거자료를 바탕으로 답변을 다듬는 중…</div>' : '')
      + maskHtml
      + errHtml
      + (turn.aiText ? '<div class="puc-warn-note">⚠ AI 요약 답변 — 법적 효력·기한·수치는 원문 및 담당 노무사 확인</div>' : '')
      + followHtml
      + (links ? '<div class="puc-links">' + links + '</div>' : '')
      + '</div></div></div>';
  }

  /* ── [🔗 연결도] 전용 탭 렌더링 (6대 흐름도 + 4대 영역 24개 앱 입출력표) ── */
  function renderMapBody() {
    var C = w.PuChatbot;
    if (!C) return '';
    var acc = accessibleApps();
    var flows = C.PORTAL_FLOWS || [];
    var rows = C.PORTAL_ROWS_GUIDE || [];

    var subTabs = [
      ['flows',   '➔ 실무 흐름도 6선'],
      ['allrows', '전체 24개 앱 표'],
      ['client',  '의뢰인 업무(8)'],
      ['store',   '자료함(7)'],
      ['sales',   '영업관리(5)'],
      ['inside',  '내부관리(4)']
    ];
    var subBar = '<div class="puc-map-subbar" role="tablist" aria-label="연결도 보기 구분">' + subTabs.map(function (t) {
      var on = STATE.mapTab === t[0];
      return '<button type="button" role="tab" aria-selected="' + (on ? 'true' : 'false') + '" class="puc-cat' + (on ? ' on' : '') + '" data-map-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';

    var principles = '<div class="puc-map-principles">'
      + '<b>🧭 한번에 이해하는 푸른포털 3대 연결 원칙</b><br>'
      + '1. <b>원본 주인은 [푸른이알피] 하나:</b> 다른 앱은 명단 사본을 따로 두지 않고 실시간으로 빌려 읽습니다.<br>'
      + '2. <b>연결 열쇠는 고유번호:</b> 상호가 바뀌어도 끊기지 않게 <b>사업자등록번호</b>와 <b>업체 고유번호 몸통(10001)</b>으로 잇습니다.<br>'
      + '3. <b>원본 무변경 안전장치:</b> 사진첩·컨설팅정산·회생광고 등은 원본 장부를 멋대로 덮어쓰지 않습니다.'
      + '</div>';

    var contentHtml = '';
    if (STATE.mapTab === 'flows') {
      contentHtml = flows.map(function (f) {
        return renderFlowCard(f.id, true);
      }).join('');
    } else {
      var targetRows = STATE.mapTab === 'allrows'
        ? rows
        : rows.filter(function (r) { return r.id === STATE.mapTab; });
      contentHtml = targetRows.map(function (r) {
        var appsHtml = (r.apps || []).map(function (ap) {
          var canOpen = !!acc.map[ap.key];
          return '<div class="puc-app-io">'
            + '<div class="puc-app-io-hd">'
            + '<b style="font-size:12.5px;color:#1e40af">' + esc(ap.icon) + ' ' + esc(ap.name) + '</b>'
            + '<div style="display:flex;gap:4px;flex-wrap:wrap">'
            + '<button type="button" class="puc-chip" data-chat-quick="' + esc(ap.ask) + '">💬 채팅 질문</button>'
            + (canOpen ? '<button type="button" class="puc-appbtn" data-chat-app="' + esc(ap.key) + '">↗ 열기</button>' : '')
            + '</div></div>'
            + '<div class="puc-io-line"><b>• 언제 쓰나:</b> ' + esc(ap.when) + '</div>'
            + '<div class="puc-io-line"><b>← 받아오는 곳:</b> ' + esc(ap.from) + '</div>'
            + '<div class="puc-io-line"><b>→ 이어지는 곳:</b> ' + esc(ap.to) + '</div>'
            + '</div>';
        }).join('');

        return '<div class="puc-row-card">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">'
          + '<b style="font-size:13px;color:#1e293b">' + esc(r.title) + '</b>'
          + '<span class="puc-dict-badge">' + esc(r.badge) + '</span>'
          + '</div>'
          + '<div style="font-size:11.5px;color:#475569;margin-top:4px">' + esc(r.summary) + '</div>'
          + appsHtml
          + '</div>';
      }).join('');
    }

    return principles + subBar + contentHtml;
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
      + '<span style="font-size:11.5px;color:#475569;white-space:nowrap">' + hits.length + '건</span>'
      + '</div>'
      + (listHtml || '<div class="puc-welcome">검색어와 일치하는 사전 항목이 없습니다. 상단 [💬 채팅]에서 자유롭게 질문해 보세요.</div>');
  }

  function refreshView(scrollEnd) {
    var win = $('puChatWin');
    if (!win) return;
    var catsEl = $('puChatCats');
    if (catsEl && w.PuChatbot) {
      catsEl.style.display = STATE.mode === 'map' ? 'none' : 'flex';
      catsEl.innerHTML = w.PuChatbot.CHAT_CATS.map(function (c) {
        var isOn = STATE.cat === c[0];
        return '<button type="button" role="tab" aria-selected="' + (isOn ? 'true' : 'false') + '" class="puc-cat' + (isOn ? ' on' : '') + '" data-chat-cat="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
      }).join('');
    }

    var chatBtn = $('puChatTabChat');
    var mapBtn = $('puChatMapBtn');
    var dictBtn = $('puChatModeBtn');
    if (chatBtn) { chatBtn.classList.toggle('on', STATE.mode === 'chat'); chatBtn.setAttribute('aria-pressed', STATE.mode === 'chat' ? 'true' : 'false'); }
    if (mapBtn) { mapBtn.classList.toggle('on', STATE.mode === 'map'); mapBtn.setAttribute('aria-pressed', STATE.mode === 'map' ? 'true' : 'false'); }
    if (dictBtn) { dictBtn.classList.toggle('on', STATE.mode === 'dict'); dictBtn.setAttribute('aria-pressed', STATE.mode === 'dict' ? 'true' : 'false'); }

    var foot = $('puChatFoot');
    if (foot) foot.style.display = STATE.mode === 'dict' ? 'none' : 'flex';
    var sendBtn = $('puChatSend');
    if (sendBtn) sendBtn.disabled = !!STATE.busy;

    var body = $('puChatBody');
    if (!body) return;
    if (STATE.mode === 'map') {
      body.innerHTML = renderMapBody();
      if (scrollEnd) body.scrollTop = 0;
      return;
    }
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
          max_tokens: 1300,
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
      return hasLocalAnswer ? 'ℹ 오늘 AI 요약 한도가 차서 내장 근거 사전 답변을 그대로 보여드립니다.' : '오늘 AI 사용 한도가 찼습니다. 상단 [🔗 연결도] 또는 [📚 사전]에서 바로 찾아보실 수 있습니다.';
    }
    if (err && err.status === 401) return '로그인 인증을 다시 확인해 주세요.';
    return hasLocalAnswer ? '' : ('AI 연결이 원활하지 않습니다 (' + (msg || '응답 지연') + ')');
  }

  /* ── 질문 전송 (직전 대화 맥락 기억 + 연결도 카드 + 꼬리질문 자동 연결) ── */
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
      var historySnapshot = STATE.logs.slice(-3);
      var picked = w.PuChatbot.pick(q, { cat: STATE.cat, max: 3, history: historySnapshot });
      var loc = w.PuChatbot.localAnswer(picked, q);
      var pr = w.PuChatbot.makePrompt(picked, q, { apps: acc.list, history: historySnapshot });

      var turn = {
        q: q,
        picked: picked,
        answer: loc.answer,
        cites: loc.cites || [],
        apps: (loc.apps || []).filter(function (k) { return !!acc.map[k]; }),
        flowId: loc.flowId || '',
        followUps: loc.followUps || [],
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
        if (parsed && parsed.flowId) turn.flowId = parsed.flowId;
        if (parsed && parsed.followUps && parsed.followUps.length) turn.followUps = parsed.followUps;
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

  function setMode(nextMode) {
    if (nextMode !== 'chat' && nextMode !== 'map' && nextMode !== 'dict') return;
    STATE.mode = nextMode;
    if (nextMode === 'dict') {
      ensureFundKb().then(function () { refreshView(false); });
    }
    refreshView(nextMode === 'map');
  }

  /* ── 창 생성·열기·닫기·초기화 ── */
  function ensureWindow() {
    injectCss();
    var win = $('puChatWin');
    if (win) return win;
    win = d.createElement('div');
    win.id = 'puChatWin';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', '푸른 시스템 길잡이 채팅방');
    win.innerHTML = '<div id="puChatHead" title="머리줄을 마우스로 끌어 위치를 옮길 수 있습니다">'
      + '<span class="t">💬 시스템 길잡이</span>'
      + '<span class="sp"></span>'
      + '<button type="button" class="puc-hbtn on" id="puChatTabChat" data-chat-mode="chat" data-nodrag="1" title="상호 질문하며 배우는 대화방">💬 채팅</button>'
      + '<button type="button" class="puc-hbtn" id="puChatMapBtn" data-chat-mode="map" data-nodrag="1" title="의뢰인 업무·자료함·영업관리·내부관리 전체 앱 연결도 지도">🔗 연결도</button>'
      + '<button type="button" class="puc-hbtn" id="puChatModeBtn" data-chat-mode="dict" data-nodrag="1" title="내장 시스템·법령·유권해석 사전 검색">📚 사전</button>'
      + '<button type="button" class="puc-hbtn" data-chat-act="clear" data-nodrag="1" title="대화 비우기">지우기</button>'
      + '<button type="button" class="puc-xbtn" data-chat-act="close" data-nodrag="1" aria-label="챗봇 닫기" title="닫기 (Esc)">✕</button>'
      + '</div>'
      + '<div id="puChatCats" role="tablist" aria-label="질문 분야 선택"></div>'
      + '<div id="puChatBody"></div>'
      + '<div id="puChatFoot">'
      + '<input id="puChatInp" type="text" aria-label="푸른 시스템 길잡이 질문 입력" placeholder="앱 사용법·연결도·노동법·지원금·기금 무엇이든 이어서 물어보세요…" autocomplete="off">'
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
      var modeBtn = e.target.closest && e.target.closest('[data-chat-mode]');
      if (modeBtn) {
        var targetMode = modeBtn.getAttribute('data-chat-mode');
        setMode(STATE.mode === targetMode && targetMode !== 'chat' ? 'chat' : targetMode);
        return;
      }
      var mapTabBtn = e.target.closest && e.target.closest('[data-map-tab]');
      if (mapTabBtn) {
        STATE.mapTab = mapTabBtn.getAttribute('data-map-tab') || 'flows';
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
        closeDocModal();
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
    setMode: setMode,
    ask: ask,
    clear: clearChat,
    resetOnLogout: resetOnLogout,
    openDocDetail: openDocDetail,
    _state: STATE
  };
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
