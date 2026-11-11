/* ══════════════════════════════════════════════════════════════════════════
 * 💬 푸른포털 시스템 길잡이 채팅방 · 연결도 지도 · 개선요청-답변-승인 폐루프 UI
 *    (js/pu-chatbot.js)
 *
 * 기능:
 *   1. 우측 하단 단추(● 최신 · 📷 카메라)와 절대 겹치지 않는 간결한 대화방(#puChatWin)
 *   2. 스크롤 없는 깔끔한 첫 화면 + 2~4문장 대화형 티키타카 + 6턴 맥락 기억(maskPersonal 적용)
 *   3. 대화 중 코딩·오류 해결이 필요하면 자동(또는 원클릭)으로 개선요청 접수(portalChatImprove)
 *   4. 개선 결과 답변 도착 시 채팅방 안 실시간 결과 안내 + 채팅자 확인 후 「승인(최종 완성)」 또는 「보완 재요청」
 *   5. 상단 [🔗 연결도] 지도 · [📚 사전] 검색 · [🛠 요청] 내 개선 진행함 제공
 *
 * ⚠ 색상은 푸른 27색 팔레트(tests/lib-palette.js) 안의 색만 사용한다.
 * ⚠ 창은 backdrop-filter 영향을 받지 않도록 document.body 직계 자식으로 붙인다.
 * ══════════════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (w.PuChatbotUI) return;

  var STATE = {
    cat: 'all',
    mode: 'chat',       // 'chat' | 'map' | 'dict' | 'req'
    mapTab: 'flows',    // 'flows' | 'client' | 'store' | 'sales' | 'inside' | 'allrows'
    dictQ: '',
    logs: [],
    busy: false,
    epoch: 0,
    winPos: null,
    fundKbLoaded: false,
    fundKbLoading: null,
    uid: '',
    impMap: {},
    sessionTicketIds: {},
    announcedKeys: {},
    lastAutoImp: null,
    reopenOpenId: '',
    reopenDrafts: {},
    impBusyIds: {},
    impUnsub: null
  };

  function $(id) { return d.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeImgUrl(u) {
    var s = String(u || '');
    return /^(https:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(s) && !/[\u0000-\u001f"'<>]/.test(s) ? s : '';
  }

  function fmtShortTime(ts) {
    if (!ts) return '';
    var dt = new Date(Number(ts));
    if (isNaN(dt.getTime())) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return (dt.getMonth() + 1) + '-' + p(dt.getDate()) + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes());
  }

  function injectCss() {
    if ($('pu-chatbot-css')) return;
    var st = d.createElement('style');
    st.id = 'pu-chatbot-css';
    st.textContent = [
      '#puChatWin{position:fixed;right:22px;bottom:88px;width:400px;max-width:calc(100vw - 16px);height:500px;max-height:calc(100vh - 108px);z-index:94;display:none;flex-direction:column;background:#ffffff;border:1px solid #bfdbfe;border-radius:16px;box-shadow:0 18px 42px rgba(30,41,59,.22);overflow:hidden;color:#1e293b;font-family:inherit;}',
      '#puChatWin.on{display:flex;}',
      '#puChatHead{display:flex;align-items:center;gap:3px;padding:8px 9px;background:#eff6ff;border-bottom:1px solid #bfdbfe;cursor:move;user-select:none;touch-action:none;flex-shrink:0;}',
      '#puChatHead .t{font-size:13px;font-weight:800;color:#1e40af;white-space:nowrap;flex-shrink:0;}',
      '#puChatHead .sp{flex:1;min-width:2px;}',
      '.puc-hbtn{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:8px;padding:4px 6px;min-height:26px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;gap:2px;}',
      '.puc-hbtn:hover{border-color:#2563eb;color:#1e40af;}',
      '.puc-hbtn.on{background:#1e40af;border-color:#1e40af;color:#ffffff;}',
      '.puc-hcnt{background:#dc2626;color:#ffffff;border-radius:999px;padding:0 5px;font-size:10px;font-weight:800;line-height:15px;}',
      '.puc-xbtn{border:none;background:transparent;color:#475569;font-size:14px;font-weight:800;min-width:26px;min-height:26px;padding:3px 6px;cursor:pointer;line-height:1;border-radius:6px;flex-shrink:0;}',
      '.puc-xbtn:hover{background:#bfdbfe;color:#1e293b;}',
      '.puc-hbtn:focus-visible,.puc-xbtn:focus-visible,.puc-cat:focus-visible,.puc-chip:focus-visible,.puc-wchip:focus-visible,.puc-appbtn:focus-visible,.puc-impbtn:focus-visible,.puc-fstep:focus-visible,.puc-fup:focus-visible,.puc-dict-item:focus-visible,.puc-okbtn:focus-visible,.puc-rebtn:focus-visible,.puc-reopen-send:focus-visible,#puChatSend:focus-visible{outline:2px solid #2563eb;outline-offset:1px;}',
      '#puChatCats{display:none;align-items:center;gap:5px;padding:6px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;overflow-x:auto;flex-shrink:0;}',
      '.puc-cat{border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:999px;padding:3px 9px;min-height:26px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex:none;}',
      '.puc-cat.on{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '#puChatBody{flex:1;overflow-y:auto;padding:11px;background:#f8fafc;}',
      '.puc-msg-q{display:flex;justify-content:flex-end;margin-bottom:6px;}',
      '.puc-bub-q{max-width:85%;padding:7px 11px;border-radius:12px 12px 3px 12px;background:#1e40af;color:#ffffff;font-size:12.5px;line-height:1.48;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-msg-a{display:flex;justify-content:flex-start;margin-bottom:11px;}',
      '.puc-bub-a{max-width:96%;padding:10px 12px;border-radius:12px 12px 12px 3px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.58;color:#1e293b;word-break:keep-all;overflow-wrap:anywhere;}',
      '.puc-wait{font-size:11px;color:#2563eb;font-weight:600;margin-top:5px;}',
      '.puc-mask-note{font-size:10.5px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:3px 7px;margin-top:5px;}',
      '.puc-warn-note{font-size:10.5px;color:#64748b;margin-top:5px;}',
      /* 간결한 첫 화면 (스크롤 없이 한눈에) */
      '.puc-welcome{padding:11px 12px;border-radius:12px;background:#ffffff;border:1px solid #e2e8f0;font-size:12px;line-height:1.55;color:#475569;margin-bottom:8px;}',
      '.puc-welcome b{color:#1e293b;}',
      '.puc-wchips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}',
      '.puc-wchip{border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:999px;padding:5px 10px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;line-height:1.2;}',
      '.puc-wchip:hover{border-color:#2563eb;background:#eff6ff;color:#1e40af;}',
      '.puc-wchip.hi{border-color:#bfdbfe;background:#eff6ff;color:#1e40af;}',
      /* 대화 말풍선 안 압축 연결도 & 연결도 탭 확장 카드 */
      '.puc-flow{margin-top:8px;padding:8px 9px;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;}',
      '.puc-flow-hd{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:5px;flex-wrap:wrap;}',
      '.puc-flow-bdg{background:#1e40af;color:#ffffff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;}',
      '.puc-flow-tt{font-size:11.5px;font-weight:800;color:#1e293b;line-height:1.3;}',
      '.puc-flow-chain{display:flex;flex-wrap:wrap;align-items:center;gap:4px;}',
      '.puc-fstep{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:5px 7px;border-radius:8px;border:1px solid #bfdbfe;background:#ffffff;color:#1e293b;cursor:pointer;font-family:inherit;text-align:left;min-width:86px;flex:1 1 88px;}',
      '.puc-flow.compact .puc-fstep{flex:0 1 auto;min-width:0;padding:3px 8px;border-radius:999px;flex-direction:row;align-items:center;}',
      '.puc-fstep:hover{border-color:#2563eb;background:#f8fafc;}',
      '.puc-fstep b{font-size:11px;font-weight:800;color:#1e40af;line-height:1.25;}',
      '.puc-fstep span{font-size:10px;color:#475569;line-height:1.25;}',
      '.puc-farr{color:#2563eb;font-size:11px;font-weight:800;user-select:none;}',
      '.puc-flow-note{margin-top:6px;font-size:10.5px;line-height:1.45;color:#1e293b;background:#ffffff;border:1px dashed #bfdbfe;border-radius:7px;padding:4px 7px;}',
      /* 연속 대화 꼬리질문 알약 칩 */
      '.puc-fups{margin-top:8px;padding-top:7px;border-top:1px dashed #e2e8f0;}',
      '.puc-fups-lb{font-size:10.5px;font-weight:800;color:#1e40af;margin-bottom:4px;}',
      '.puc-fup-list{display:flex;flex-wrap:wrap;gap:4px;}',
      '.puc-fup{border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;line-height:1.3;}',
      '.puc-fup:hover{border-color:#2563eb;background:#eff6ff;color:#1e40af;}',
      '.puc-links{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;padding-top:6px;border-top:1px dashed #e2e8f0;}',
      '.puc-chip{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-chip:hover{background:#bfdbfe;}',
      '.puc-appbtn{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-appbtn:hover{border-color:#16a34a;}',
      '.puc-impbtn{border:1px solid #fde68a;background:#fffbeb;color:#854d0e;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-impbtn:hover{border-color:#d97706;}',
      /* 🛠 개선요청 접수 · 결과 답변 · 채팅자 승인 완성 카드 */
      '.puc-imp-card{margin-top:8px;padding:9px 10px;border-radius:10px;border:1px solid #bfdbfe;background:#f8fafc;font-size:11.5px;line-height:1.5;color:#1e293b;}',
      '.puc-imp-card.wait-approve{border-color:#fbbf24;background:#fffbeb;}',
      '.puc-imp-card.approved{border-color:#bbf7d0;background:#f0fdf4;}',
      '.puc-imp-card.reopened{border-color:#fecaca;background:#fef2f2;}',
      '.puc-imp-top{display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;margin-bottom:4px;}',
      '.puc-imp-st{border-radius:999px;padding:1px 8px;font-size:10.5px;font-weight:800;}',
      '.puc-imp-st.s-new{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;}',
      '.puc-imp-st.s-ing{background:#fffbeb;color:#854d0e;border:1px solid #fde68a;}',
      '.puc-imp-st.s-wait{background:#854d0e;color:#ffffff;}',
      '.puc-imp-st.s-ok{background:#166534;color:#ffffff;}',
      '.puc-imp-st.s-re{background:#991b1b;color:#ffffff;}',
      '.puc-imp-tt{font-size:12px;font-weight:800;color:#1e293b;margin-bottom:3px;}',
      '.puc-imp-reply{margin-top:5px;padding:7px 9px;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;white-space:pre-line;font-size:11.5px;color:#1e293b;}',
      '.puc-imp-acts{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;}',
      '.puc-okbtn{flex:1;min-width:128px;border:none;border-radius:8px;padding:6px 10px;background:#166534;color:#ffffff;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;}',
      '.puc-okbtn:hover{background:#16a34a;}',
      '.puc-rebtn{border:1px solid #cbd5e1;border-radius:8px;padding:6px 9px;background:#ffffff;color:#475569;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.puc-rebtn:hover{border-color:#dc2626;color:#991b1b;}',
      '.puc-reopen-box{margin-top:6px;display:flex;gap:5px;align-items:center;}',
      '.puc-reopen-inp{flex:1;height:32px;padding:0 9px;border:1px solid #fecaca;border-radius:7px;background:#ffffff;color:#1e293b;font-size:12px;font-family:inherit;outline:none;}',
      '.puc-reopen-send{height:32px;padding:0 10px;border:none;border-radius:7px;background:#991b1b;color:#ffffff;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '.puc-okbtn:disabled,.puc-rebtn:disabled,.puc-reopen-send:disabled{opacity:.55;cursor:not-allowed;}',
      /* 연결도 전용 탭 & 사전 */
      '.puc-map-principles{padding:8px 10px;border-radius:9px;background:#fffbeb;border:1px solid #fde68a;color:#854d0e;font-size:11px;line-height:1.5;margin-bottom:8px;}',
      '.puc-map-principles b{color:#1e293b;}',
      '.puc-map-subbar{display:flex;gap:4px;overflow-x:auto;padding-bottom:5px;margin-bottom:7px;}',
      '.puc-row-card{padding:9px 10px;border-radius:10px;background:#ffffff;border:1px solid #e2e8f0;margin-bottom:9px;}',
      '.puc-app-io{padding:7px 9px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;margin-top:6px;font-size:11px;line-height:1.45;}',
      '.puc-app-io-hd{display:flex;align-items:center;justify-content:space-between;gap:5px;flex-wrap:wrap;margin-bottom:3px;}',
      '.puc-io-line{font-size:10.5px;color:#475569;margin-top:2px;}',
      '.puc-io-line b{color:#1e293b;}',
      '#puChatFoot{display:flex;align-items:center;gap:6px;padding:8px 9px;background:#ffffff;border-top:1px solid #e2e8f0;flex-shrink:0;}',
      '#puChatInp,#puChatDictInp{flex:1;height:36px;padding:0 10px;border:1px solid #cbd5e1;border-radius:9px;background:#ffffff;color:#1e293b;font-size:13px;font-family:inherit;outline:none;}',
      '#puChatInp:focus,#puChatDictInp:focus,.puc-reopen-inp:focus{border-color:#1e40af;}',
      '#puChatSend{height:36px;padding:0 13px;border:none;border-radius:9px;background:#1e40af;color:#ffffff;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
      '#puChatSend:disabled{opacity:.55;cursor:not-allowed;}',
      '.puc-dict-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;}',
      '.puc-dict-item{padding:8px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#ffffff;margin-bottom:6px;cursor:pointer;}',
      '.puc-dict-item:hover{border-color:#60a5fa;background:#eff6ff;}',
      '.puc-dict-top{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#475569;margin-bottom:2px;}',
      '.puc-dict-badge{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;}',
      '.puc-dict-t{font-size:12px;font-weight:700;color:#1e293b;line-height:1.38;}',
      '#puChatDocModal{display:none;position:fixed;inset:0;background:rgba(30,41,59,.52);z-index:98;align-items:center;justify-content:center;padding:16px;}',
      '#puChatDocModal.on{display:flex;}',
      '#puChatDocModal .box{background:#ffffff;border-radius:16px;width:620px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(30,41,59,.35);}',
      '#puChatDocModal .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}',
      '#puChatDocModal .bd{padding:15px 16px;overflow-y:auto;font-size:12.5px;line-height:1.65;color:#1e293b;}',
      '#puChatDocModal .ft{display:flex;justify-content:flex-end;gap:8px;padding:11px 16px;border-top:1px solid #e2e8f0;background:#f8fafc;}',
      '@media (max-width:768px){#puChatInp,#puChatDictInp,.puc-reopen-inp{font-size:16px;}}',
      '@media (max-width:520px){#puChatWin{left:8px!important;right:8px!important;top:auto!important;bottom:74px!important;width:auto;height:min(470px,calc(100vh - 96px));}}',
      '@media (max-width:420px){#puChatHead{gap:3px;padding:8px 7px;}#puChatHead .t{font-size:12px;}#puChatHead .puc-hbtn{padding:3px 5px;font-size:10.5px;}}'
    ].join('\n');
    (d.head || d.documentElement).appendChild(st);
  }

  /* ── fund_kb.js 지연 로드 ── */
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

  /* ── 개선요청 상태 판정 및 실시간 동기화 (자동 접수 ➔ 결과 답변 ➔ 채팅자 승인 완성) ── */
  function isAwaitingApproval(id, v) {
    if (!v || typeof v !== 'object') return false;
    if ((v.status || 'done') !== 'done') return false;
    if (v.resolvedOk === true || v.resolvedOk === false) return false;
    return (!v.seen || v.source === 'chatbot' || !!STATE.sessionTicketIds[id]);
  }

  function countAwaitingApproval() {
    var n = 0;
    Object.keys(STATE.impMap || {}).forEach(function (id) {
      if (isAwaitingApproval(id, STATE.impMap[id])) n++;
    });
    return n;
  }

  function syncBadges() {
    var waitCnt = countAwaitingApproval();
    var fabBadge = $('chatFabBadge');
    if (fabBadge) {
      fabBadge.style.display = waitCnt > 0 ? 'inline-flex' : 'none';
      fabBadge.textContent = waitCnt > 99 ? '99+' : String(waitCnt);
    }
    var reqCntEl = $('puChatReqCnt');
    if (reqCntEl) {
      if (waitCnt > 0) {
        reqCntEl.style.display = 'inline-block';
        reqCntEl.textContent = String(waitCnt);
      } else {
        reqCntEl.style.display = 'none';
        reqCntEl.textContent = '';
      }
    }
  }

  function hasUserQuestions() {
    return STATE.logs.some(function (t) { return !!(t && t.q); });
  }

  function isTicketRenderedInLogs(id) {
    if (!id) return false;
    return STATE.logs.some(function (t) {
      if (!t) return false;
      if (t.kind === 'imp_notice' && t.impId === id) return true;
      if (t.improveTicket && t.improveTicket.id === id) return true;
      return false;
    });
  }

  function hasInlineTicketAtBottom(id) {
    if (!STATE.logs.length) return false;
    var last = STATE.logs[STATE.logs.length - 1];
    if (last.kind === 'imp_notice' && last.impId === id) return true;
    if (last.improveTicket && last.improveTicket.id === id) return true;
    return false;
  }

  function handleImproveMap(nextMap, uid) {
    STATE.uid = uid || '';
    STATE.impMap = nextMap && typeof nextMap === 'object' ? Object.assign({}, nextMap) : {};
    var shouldScroll = false;
    var activeChat = hasUserQuestions();

    /* 1. 이미 찍힌 턴 카드의 상태 갱신 */
    STATE.logs.forEach(function (turn) {
      if (turn && turn.improveTicket && STATE.impMap[turn.improveTicket.id]) {
        var live = STATE.impMap[turn.improveTicket.id];
        var nextSt = live.status || turn.improveTicket.status || 'new';
        var nextRep = live.reply || '';
        if (nextSt !== turn.improveTicket.status || nextRep !== (turn.improveTicket.reply || '')) {
          shouldScroll = true;
        }
        turn.improveTicket.status = nextSt;
        turn.improveTicket.reply = nextRep;
        turn.improveTicket.resolvedOk = live.resolvedOk;
      }
    });

    /* 2. 개선 진행 답변(ing + reply) 또는 개선 완료 결과(done · 미승인) 도착 시 진행 중인 채팅창에 자동 알림 말풍선 투입 */
    Object.keys(STATE.impMap).forEach(function (id) {
      var v = STATE.impMap[id];
      if (!v || typeof v !== 'object') return;
      var st = v.status || 'done';
      var tracked = (v.source === 'chatbot' || !!STATE.sessionTicketIds[id]);

      if (st === 'ing' && v.reply && tracked) {
        var ingKey = id + ':ing:' + String(v.reply).slice(0, 80);
        if (!STATE.announcedKeys[ingKey]) {
          STATE.announcedKeys[ingKey] = true;
          if (activeChat && !hasInlineTicketAtBottom(id)) {
            shouldScroll = true;
            STATE.logs.push({ kind: 'imp_notice', impId: id, at: Date.now() });
          }
        }
      } else if (isAwaitingApproval(id, v)) {
        var doneKey = id + ':done:' + String(v.reply || '').slice(0, 80);
        if (!STATE.announcedKeys[doneKey]) {
          STATE.announcedKeys[doneKey] = true;
          shouldScroll = true;
          /* 이미 사용자 질문 로그가 있는 상태에서 결과가 도착했고 인라인 카드가 아니라면 새 답변 말풍선으로 띄운다 */
          if (activeChat && !hasInlineTicketAtBottom(id) && !isTicketRenderedInLogs(id)) {
            STATE.logs.push({ kind: 'imp_notice', impId: id, at: Date.now() });
          }
        }
      }
    });

    if (STATE.logs.length > 40) STATE.logs = STATE.logs.slice(-40);
    syncBadges();

    var win = $('puChatWin');
    if (win && win.classList.contains('on')) {
      refreshView(shouldScroll);
    }
  }

  function bindImproveBridge() {
    if (STATE.impUnsub || !w.portalChatImprove || typeof w.portalChatImprove.subscribe !== 'function') return;
    STATE.impUnsub = w.portalChatImprove.subscribe(handleImproveMap);
  }

  function triggerImproveForTurn(turn, aiImprove, forceManual) {
    if (!turn || turn.improveTicket || turn.improveSubmitting) return Promise.resolve(null);
    bindImproveBridge();
    if (!w.portalChatImprove || typeof w.portalChatImprove.submit !== 'function') {
      turn.errNote = '개선요청 연결은 포털 로그인 후 사용할 수 있습니다.';
      refreshView(false);
      return Promise.resolve(null);
    }

    var payload = w.PuChatbot.buildImprovePayload(turn.q, turn._histBefore || [], turn.picked || [], aiImprove);
    var normKey = payload.cat + '|' + payload.title;
    if (!forceManual && STATE.lastAutoImp && STATE.lastAutoImp.key === normKey && (Date.now() - STATE.lastAutoImp.at < 60000)) {
      return Promise.resolve(null);
    }
    STATE.lastAutoImp = { key: normKey, at: Date.now() };
    turn.improveSubmitting = true;
    refreshView(false);

    var myEpoch = STATE.epoch;
    return w.portalChatImprove.submit(payload).then(function (res) {
      if (myEpoch !== STATE.epoch) return null;
      turn.improveSubmitting = false;
      if (res && res.id) {
        STATE.sessionTicketIds[res.id] = true;
        var itemRec = {
          title: res.title || payload.title,
          cat: res.cat || payload.cat,
          status: 'new',
          at: res.at || Date.now(),
          seen: true,
          source: 'chatbot'
        };
        if (!STATE.impMap[res.id]) STATE.impMap[res.id] = itemRec;
        turn.improveTicket = {
          id: res.id,
          title: itemRec.title,
          cat: itemRec.cat,
          catName: res.catName || '',
          status: 'new',
          at: itemRec.at
        };
      }
      syncBadges();
      refreshView(true);
      return res;
    }).catch(function (err) {
      if (myEpoch !== STATE.epoch) return null;
      turn.improveSubmitting = false;
      turn.errNote = '개선요청 접수 실패: ' + ((err && err.message) || '잠시 후 다시 시도해 주세요');
      refreshView(false);
      return null;
    });
  }

  function approveTicket(id) {
    if (!id || STATE.impBusyIds[id] || !w.portalChatImprove || typeof w.portalChatImprove.approve !== 'function') return Promise.resolve();
    var target = STATE.impMap[id] || {};
    STATE.impBusyIds[id] = true;
    refreshView(false);
    return w.portalChatImprove.approve(id).then(function () {
      delete STATE.impBusyIds[id];
      STATE.impMap[id] = Object.assign({}, target, {
        seen: true,
        resolvedOk: true,
        resolvedAt: Date.now()
      });
      if (STATE.reopenOpenId === id) STATE.reopenOpenId = '';
      STATE.logs.push({
        kind: 'imp_notice',
        sysText: '🎉 「' + (target.title || '개선 요청') + '」 결과를 확인·승인해 주셔서 최종 완성되었습니다!\n더 궁금한 점이나 추가로 손볼 곳이 있으면 이어서 말씀해 주세요.'
      });
      syncBadges();
      refreshView(true);
    }).catch(function (err) {
      delete STATE.impBusyIds[id];
      STATE.logs.push({
        kind: 'imp_notice',
        sysText: '⚠ 승인 저장에 실패했습니다: ' + ((err && err.message) || '다시 시도해 주세요')
      });
      refreshView(true);
    });
  }

  function reopenTicket(id, rawText) {
    if (id && STATE.impBusyIds[id]) return Promise.resolve();
    var txt = String(rawText || '').trim();
    if (!txt) {
      var inpEl = $('puImpReopenInp_' + id);
      if (inpEl) inpEl.focus();
      return Promise.resolve();
    }
    if (!id || !w.portalChatImprove || typeof w.portalChatImprove.reopen !== 'function') return Promise.resolve();
    var target = STATE.impMap[id] || {};
    STATE.impBusyIds[id] = true;
    refreshView(false);
    return w.portalChatImprove.reopen(id, txt).then(function (res) {
      delete STATE.impBusyIds[id];
      STATE.impMap[id] = Object.assign({}, target, {
        seen: true,
        resolvedOk: false,
        feedback: txt,
        feedbackAt: Date.now()
      });
      if (res && res.id) {
        STATE.sessionTicketIds[res.id] = true;
        STATE.impMap[res.id] = {
          title: res.title || ('↩ 재요청: ' + (target.title || '')),
          cat: res.cat || target.cat || 'portal',
          status: 'new',
          at: Date.now(),
          seen: true,
          source: 'chatbot',
          relatedId: id
        };
      }
      STATE.reopenOpenId = '';
      delete STATE.reopenDrafts[id];
      STATE.logs.push({
        kind: 'imp_notice',
        sysText: '↩ 보완 재요청을 접수했습니다. 수정 결과가 준비되면 이 채팅방에서 다시 답변드리겠습니다.'
      });
      syncBadges();
      refreshView(true);
    }).catch(function (err) {
      delete STATE.impBusyIds[id];
      STATE.logs.push({
        kind: 'imp_notice',
        sysText: '⚠ 재요청 접수 실패: ' + ((err && err.message) || '다시 시도해 주세요')
      });
      refreshView(true);
    });
  }

  function renderImproveCard(id, fallbackRec) {
    var v = (id && STATE.impMap[id]) ? STATE.impMap[id] : (fallbackRec || {});
    var st = v.status || 'new';
    var waitApprove = isAwaitingApproval(id, v) || (st === 'done' && v.resolvedOk == null);
    var isApproved = v.resolvedOk === true;
    var isReopened = v.resolvedOk === false;
    var isBusy = !!(id && STATE.impBusyIds[id]);
    var disAttr = isBusy ? ' disabled' : '';

    var cardCls = 'puc-imp-card'
      + (waitApprove ? ' wait-approve' : '')
      + (isApproved ? ' approved' : '')
      + (isReopened ? ' reopened' : '');

    var stBadge = '';
    if (isApproved) stBadge = '<span class="puc-imp-st s-ok">🎉 승인 완료 · 최종 완성</span>';
    else if (isReopened) stBadge = '<span class="puc-imp-st s-re">↩ 보완 재요청됨</span>';
    else if (waitApprove) stBadge = '<span class="puc-imp-st s-wait">🔔 개선 결과 도착 · 승인 대기</span>';
    else if (st === 'ing') stBadge = '<span class="puc-imp-st s-ing">🔧 검토·개선 진행중</span>';
    else stBadge = '<span class="puc-imp-st s-new">🛠 개선요청 접수됨 · 대기중</span>';

    var isAdmin = !!(w.portalChatImprove && typeof w.portalChatImprove.isAdmin === 'function' && w.portalChatImprove.isAdmin());
    var adminBtn = (isAdmin && id)
      ? '<button type="button" class="puc-chip" data-imp-admin="' + esc(id) + '">⚙ 건의함·자동개발</button>'
      : '';

    var imgsHtml = '';
    if (Array.isArray(v.replyImages) && v.replyImages.length) {
      imgsHtml = v.replyImages.map(function (u) {
        var su = safeImgUrl(u);
        return su ? '<img src="' + esc(su) + '" alt="개선 결과 캡처" style="max-width:100%;border-radius:7px;margin-top:5px;display:block;border:1px solid #e2e8f0">' : '';
      }).join('');
    }

    var bodyHtml = '';
    if (waitApprove) {
      bodyHtml = '<div class="puc-imp-reply">'
        + esc(v.reply || '요청하신 사항이 개선 반영되었습니다. 화면을 확인하신 뒤 개선되었다고 판단되시면 아래 [개선 확인 · 승인]을 눌러 최종 완성해 주세요.')
        + imgsHtml
        + '</div>'
        + '<div class="puc-imp-acts">'
        + '<button type="button" class="puc-okbtn" data-imp-approve="' + esc(id) + '"' + disAttr + '>' + (isBusy ? '처리 중…' : '✅ 개선 확인 · 승인 (완성)') + '</button>'
        + '<button type="button" class="puc-rebtn" data-imp-reopen-toggle="' + esc(id) + '"' + disAttr + '>🔄 미해결 · 보완 재요청</button>'
        + '</div>';
      if (STATE.reopenOpenId === id) {
        var draft = STATE.reopenDrafts[id] || '';
        bodyHtml += '<div class="puc-reopen-box">'
          + '<input type="text" class="puc-reopen-inp" id="puImpReopenInp_' + esc(id) + '" data-reopen-inp="' + esc(id) + '" value="' + esc(draft) + '"' + disAttr + ' placeholder="아직 안 되는 부분이나 추가 수정할 점을 적어주세요…">'
          + '<button type="button" class="puc-reopen-send" data-imp-reopen-send="' + esc(id) + '"' + disAttr + '>↩ 재요청</button>'
          + '</div>';
      }
    } else if (isApproved) {
      bodyHtml = (v.reply ? '<div class="puc-imp-reply">' + esc(v.reply) + imgsHtml + '</div>' : '')
        + '<div style="font-size:11px;color:#166534;font-weight:700;margin-top:4px">✔ 채팅자가 개선 결과를 확인하여 최종 완성되었습니다.</div>';
    } else if (isReopened) {
      bodyHtml = (v.feedback ? '<div class="puc-imp-reply">↩ 재요청 사유: ' + esc(v.feedback) + '</div>' : '')
        + '<div style="font-size:11px;color:#991b1b;margin-top:4px">보완 작업 후 결과가 도착하면 다시 승인 요청이 표시됩니다.</div>';
    } else if (st === 'ing') {
      bodyHtml = (v.reply ? '<div class="puc-imp-reply">' + esc(v.reply) + imgsHtml + '</div>' : '')
        + '<div style="font-size:11px;color:#854d0e;margin-top:3px">개선이 완료되면 이 채팅방에 결과와 승인 단추가 나타납니다.</div>';
    } else {
      bodyHtml = '<div style="font-size:11px;color:#475569">개선 파이프라인에 등록되었습니다. 처리되면 이 방에서 결과를 답해 드리고 승인 시 최종 완성됩니다.</div>';
    }

    return '<div class="' + cardCls + '" data-imp-card="' + esc(id || '') + '">'
      + '<div class="puc-imp-top">' + stBadge
      + '<div style="display:flex;align-items:center;gap:4px">'
      + (v.at ? '<span style="font-size:10px;color:#64748b">' + esc(fmtShortTime(v.at)) + '</span>' : '')
      + adminBtn
      + '</div></div>'
      + '<div class="puc-imp-tt">' + esc(v.title || '시스템 개선 요청') + '</div>'
      + bodyHtml
      + '</div>';
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

  /* ── 시각적 화살표 연결도 렌더링 (말풍선 안에서는 1줄 압축 칩 · 연결도 탭에서는 상세 카드) ── */
  function renderFlowCard(flowId, inMapView) {
    if (!flowId || !w.PuChatbot || typeof w.PuChatbot.findFlowById !== 'function') return '';
    var flow = w.PuChatbot.findFlowById(flowId);
    if (!flow) return '';

    var chainHtml = (flow.steps || []).map(function (st, idx) {
      var stepBtn = '<button type="button" class="puc-fstep" data-chat-quick="' + esc(st.ask) + '" title="' + esc(st.role) + ' — 누르면 이어서 질문합니다">'
        + '<b>' + esc(st.icon) + ' ' + esc(st.name) + '</b>'
        + (inMapView ? '<span>' + esc(st.role) + '</span>' : '')
        + '</button>';
      return (idx > 0 ? '<span class="puc-farr" aria-hidden="true">➔</span>' : '') + stepBtn;
    }).join('');

    if (!inMapView) {
      return '<div class="puc-flow compact">'
        + '<div class="puc-flow-hd">'
        + '<span class="puc-flow-bdg">' + esc(flow.badge) + '</span>'
        + '<button type="button" class="puc-chip" data-chat-mode="map">🔗 지도 ›</button>'
        + '</div>'
        + '<div class="puc-flow-chain">' + chainHtml + '</div>'
        + '</div>';
    }

    var mapFollows = '';
    if (flow.followUps && flow.followUps.length) {
      mapFollows = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">'
        + flow.followUps.slice(0, 2).map(function (fq) {
          return '<button type="button" class="puc-chip" data-chat-quick="' + esc(fq) + '">💬 ' + esc(fq) + '</button>';
        }).join('')
        + '</div>';
    }

    return '<div class="puc-flow">'
      + '<div class="puc-flow-hd">'
      + '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">'
      + '<span class="puc-flow-bdg">' + esc(flow.badge) + '</span>'
      + '<span class="puc-flow-tt">' + esc(flow.title) + '</span>'
      + '</div></div>'
      + (flow.summary ? '<div style="font-size:11px;color:#475569;margin-bottom:4px">' + esc(flow.summary) + '</div>' : '')
      + '<div class="puc-flow-chain">' + chainHtml + '</div>'
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
      + '<div class="hd"><b id="puChatDocTitle" style="font-size:14.5px;color:#1e293b">상세 보기</b>'
      + '<button type="button" class="puc-xbtn" data-doc-close="1" aria-label="닫기">✕</button></div>'
      + '<div class="bd" id="puChatDocBody"></div>'
      + '<div class="ft" id="puChatDocFoot">'
      + '<button type="button" id="puChatDocCloseBtn" class="puc-hbtn on" data-doc-close="1" style="padding:6px 14px;font-size:12px">닫기</button></div>'
      + '</div>';
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !m.classList.contains('on')) return;
      var box = m.querySelector && m.querySelector('.box');
      if (!box || !box.querySelectorAll) return;
      var nodes = box.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])');
      var list = [];
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].offsetParent !== null || !('offsetParent' in nodes[i])) list.push(nodes[i]);
      }
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (d.activeElement === first || d.activeElement === m)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && d.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
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
    $('puChatDocBody').innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px">'
      + '<span class="puc-dict-badge">' + esc(catLabel(it.cat)) + '</span>'
      + '<span class="puc-dict-badge" style="background:#f8fafc;color:#475569;border-color:#cbd5e1">' + esc(it.source || '') + (it.docNo ? ' · ' + esc(it.docNo) : '') + '</span>'
      + '</div>'
      + '<div style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:11.5px;margin-bottom:9px">'
      + '<b>관련 근거·범위:</b> ' + esc(it.law || '—') + (it.date ? ' (' + esc(it.date) + ')' : '') + '</div>'
      + '<div style="padding:8px 10px;border-left:3px solid #2563eb;background:#eff6ff;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:9px;color:#1e293b">'
      + '❓ ' + esc(it.q || '') + '</div>'
      + '<div style="padding:11px 13px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;white-space:pre-line;margin-bottom:9px">'
      + esc(it.a || '') + '</div>'
      + (pts ? '<div style="padding:9px 11px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:11.5px"><b style="color:#1e40af">📌 실무 핵심 체크포인트</b><ul style="margin:5px 0 0;padding-left:18px">' + pts + '</ul></div>' : '')
      + flowHtml
      + (appBtns ? '<div style="margin-top:11px;display:flex;flex-wrap:wrap;gap:6px">' + appBtns + '</div>' : '');
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

  /* ── 간결한 첫 화면 (스크롤 없이 한눈에 + 미승인 개선 결과 즉시 표시) ── */
  function renderPendingApprovals() {
    var pendingHtml = Object.keys(STATE.impMap || {})
      .filter(function (id) { return isAwaitingApproval(id, STATE.impMap[id]) && !isTicketRenderedInLogs(id); })
      .sort(function (a, b) { return ((STATE.impMap[b] && STATE.impMap[b].at) || 0) - ((STATE.impMap[a] && STATE.impMap[a].at) || 0); })
      .map(function (id) { return renderImproveCard(id, STATE.impMap[id]); })
      .join('');
    return pendingHtml ? '<div class="puc-pending-list" style="margin-bottom:9px">' + pendingHtml + '</div>' : '';
  }

  function renderWelcomeBox() {
    var chips = [
      ['🏢 의뢰인 업무', '의뢰인 업무 줄에 있는 프로그램들은 각각 언제 어떻게 사용하고 서로 어떻게 연결되어 있나요?'],
      ['📂 자료함',      '자료함 줄에 있는 사진첩, 기업정보함, 계약서등관리, 업무관리, 푸른 메일, 캘린더는 어떻게 연결해서 쓰나요?'],
      ['📣 영업관리',    '영업관리 줄의 뉴스레터, 홈페이지, 회생광고, 전광판, 정부사업신청은 직원이 어떻게 사용하고 어디와 연결되어 있나요?'],
      ['🔐 내부관리',    '내부관리 줄(인사관리, 재무관리, 컨설팅정산, 경력관리)은 누구에게 보이고 다른 앱과 어떻게 연결되나요?'],
      ['🚀 신규수임 순서', '신규 거래처 자문계약이나 노동사건을 새로 맡았을 때 어떤 앱부터 어떤 순서로 입력하면 되나요?'],
      ['⚖️ 통상임금·연차', '재직조건 붙은 정기상여금도 통상임금에 들어가나요?'],
      ['🪙 복지기금',    '기금 감사가 복지기금협의회 위원이나 이사를 겸직할 수 있나요?']
    ].map(function (c) {
      return '<button type="button" class="puc-wchip" data-chat-quick="' + esc(c[1]) + '">' + esc(c[0]) + '</button>';
    }).join('');

    return '<div class="puc-welcome">'
      + '<b>안녕하세요! 무엇이 궁금하신가요?</b><br>'
      + '대화하듯 이어서 질문해 보세요. 질문 중 <b>코딩·오류 해결</b>이 필요하면 자동으로 <b>개선요청 접수 ➔ 결과 답변 ➔ 확인·승인</b>까지 완료됩니다.'
      + '<div class="puc-wchips">'
      + '<button type="button" class="puc-wchip hi" data-chat-mode="map">🔗 전체 연결도</button>'
      + chips
      + '</div>'
      + '</div>';
  }

  /* ── 대화 말풍선 렌더링 ── */
  function renderTurn(turn, idx) {
    if (turn.kind === 'imp_notice') {
      if (turn.impId && STATE.impMap[turn.impId]) {
        return '<div class="puc-msg-a"><div class="puc-bub-a">'
          + '<b style="font-size:12px;color:#1e40af">🔧 요청하신 개선 사항 업데이트가 도착했습니다</b>'
          + renderImproveCard(turn.impId, STATE.impMap[turn.impId])
          + '</div></div>';
      }
      if (turn.sysText) {
        return '<div class="puc-msg-a"><div class="puc-bub-a"><div style="white-space:pre-line">' + esc(turn.sysText) + '</div></div></div>';
      }
      return '';
    }

    var acc = accessibleApps();
    var ans = turn.aiText || turn.answer || '';
    var flowCardHtml = turn.flowId ? renderFlowCard(turn.flowId, false) : '';

    var impHtml = '';
    if (turn.improveSubmitting) {
      impHtml = '<div class="puc-wait">🛠 대화 내용을 바탕으로 개선요청을 자동 접수하는 중…</div>';
    } else if (turn.improveTicket && turn.improveTicket.id) {
      impHtml = renderImproveCard(turn.improveTicket.id, turn.improveTicket);
    }

    var followHtml = '';
    if (Array.isArray(turn.followUps) && turn.followUps.length) {
      followHtml = '<div class="puc-fups">'
        + '<div class="puc-fups-lb">💬 이어서 물어보기</div>'
        + '<div class="puc-fup-list">'
        + turn.followUps.slice(0, 3).map(function (fq) {
          return '<button type="button" class="puc-fup" data-chat-quick="' + esc(fq) + '">' + esc(fq) + ' ›</button>';
        }).join('')
        + '</div></div>';
    }

    var citeChips = (turn.cites || []).map(function (id) {
      var it = w.PuChatbot && w.PuChatbot.findById(id);
      if (!it) return '';
      return '<button type="button" class="puc-chip" data-chat-cite="' + esc(it.id) + '" title="' + esc(it.title) + '">📎 상세: ' + esc(it.docNo || it.id) + '</button>';
    }).filter(Boolean).join(' ');

    var appChips = (turn.apps || []).filter(function (k) { return !!acc.map[k]; }).map(function (k) {
      var extra = (k === 'fund' && /기금|출연|예규|공단/.test(turn.q)) ? 'chat=1' : '';
      return '<button type="button" class="puc-appbtn" data-chat-app="' + esc(k) + '"' + (extra ? ' data-chat-extra="' + esc(extra) + '"' : '') + '>↗ ' + esc(acc.map[k].name) + '</button>';
    }).join(' ');

    var manualImpBtn = (!turn.improveTicket && !turn.improveSubmitting && !turn.aiLoading)
      ? '<button type="button" class="puc-impbtn" data-chat-imp-idx="' + idx + '" title="이 대화 내용으로 코딩·기능 개선을 요청합니다">🛠 개선요청</button>'
      : '';

    var maskHtml = (turn.maskedKinds && turn.maskedKinds.length)
      ? '<div class="puc-mask-note">🔒 개인·기업 식별정보(' + esc(turn.maskedKinds.join('·')) + ') 가림 적용</div>'
      : '';

    var errHtml = turn.errNote
      ? '<div class="puc-warn-note">' + esc(turn.errNote) + '</div>'
      : '';

    var links = [citeChips, appChips, manualImpBtn].filter(Boolean).join(' ');
    return '<div>'
      + '<div class="puc-msg-q"><div class="puc-bub-q">' + esc(turn.q) + '</div></div>'
      + '<div class="puc-msg-a"><div class="puc-bub-a">'
      + '<div style="white-space:pre-line">' + esc(ans) + '</div>'
      + flowCardHtml
      + impHtml
      + (turn.aiLoading ? '<div class="puc-wait">🤖 답변 다듬는 중…</div>' : '')
      + maskHtml
      + errHtml
      + (turn.aiText ? '<div class="puc-warn-note">⚠ AI 요약 — 법적 효력·수치는 원문 및 담당 노무사 확인</div>' : '')
      + followHtml
      + (links ? '<div class="puc-links">' + links + '</div>' : '')
      + '</div></div></div>';
  }

  /* ── [🛠 요청] 내 개선요청 진행·승인 탭 렌더링 ── */
  function renderReqBody() {
    var keys = Object.keys(STATE.impMap || {});
    keys.sort(function (a, b) {
      var va = STATE.impMap[a] || {}, vb = STATE.impMap[b] || {};
      var wa = isAwaitingApproval(a, va) ? 1 : 0;
      var wb = isAwaitingApproval(b, vb) ? 1 : 0;
      if (wa !== wb) return wb - wa;
      return (vb.at || 0) - (va.at || 0);
    });

    var intro = '<div class="puc-map-principles">'
      + '<b>🛠 대화형 개선요청 ➔ 결과 답변 ➔ 채팅자 승인 완성</b><br>'
      + '채팅 중 코딩·오류 해결이 필요하면 자동 접수되며, 개선 완료 답변이 오면 직접 확인 후 <b>[승인]</b>하셔야 최종 완성됩니다.'
      + '</div>';

    if (!keys.length) {
      return intro + '<div class="puc-welcome">아직 접수된 개선요청이 없습니다.<br>채팅창에서 불편한 점이나 필요한 기능을 말씀하시면 바로 접수됩니다.</div>';
    }
    return intro + keys.slice(0, 30).map(function (id) {
      return renderImproveCard(id, STATE.impMap[id]);
    }).join('');
  }

  /* ── [🔗 연결도] 전용 탭 렌더링 ── */
  function renderMapBody() {
    var C = w.PuChatbot;
    if (!C) return '';
    var acc = accessibleApps();
    var flows = C.PORTAL_FLOWS || [];
    var rows = C.PORTAL_ROWS_GUIDE || [];

    var subTabs = [
      ['flows',   '➔ 흐름도 6선'],
      ['allrows', '전체 24개 앱'],
      ['client',  '의뢰인(8)'],
      ['store',   '자료함(7)'],
      ['sales',   '영업(5)'],
      ['inside',  '내부(4)']
    ];
    var subBar = '<div class="puc-map-subbar" role="tablist" aria-label="연결도 보기 구분">' + subTabs.map(function (t) {
      var on = STATE.mapTab === t[0];
      return '<button type="button" role="tab" aria-selected="' + (on ? 'true' : 'false') + '" class="puc-cat' + (on ? ' on' : '') + '" data-map-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';

    var principles = '<div class="puc-map-principles">'
      + '<b>🧭 3대 연결 원칙:</b> ① 원본 주인은 <b>[푸른이알피]</b> 하나 · ② 연결 열쇠는 <b>사업자번호·고유번호 몸통(10001)</b> · ③ 파생 앱은 원본 무변경'
      + '</div>';

    var contentHtml = '';
    if (STATE.mapTab === 'flows') {
      contentHtml = flows.map(function (f) { return renderFlowCard(f.id, true); }).join('');
    } else {
      var targetRows = STATE.mapTab === 'allrows' ? rows : rows.filter(function (r) { return r.id === STATE.mapTab; });
      contentHtml = targetRows.map(function (r) {
        var appsHtml = (r.apps || []).map(function (ap) {
          var canOpen = !!acc.map[ap.key];
          return '<div class="puc-app-io">'
            + '<div class="puc-app-io-hd">'
            + '<b style="font-size:12px;color:#1e40af">' + esc(ap.icon) + ' ' + esc(ap.name) + '</b>'
            + '<div style="display:flex;gap:4px;flex-wrap:wrap">'
            + '<button type="button" class="puc-chip" data-chat-quick="' + esc(ap.ask) + '">💬 질문</button>'
            + (canOpen ? '<button type="button" class="puc-appbtn" data-chat-app="' + esc(ap.key) + '">↗ 열기</button>' : '')
            + '</div></div>'
            + '<div class="puc-io-line"><b>• 용도:</b> ' + esc(ap.when) + '</div>'
            + '<div class="puc-io-line"><b>← 받아오는 곳:</b> ' + esc(ap.from) + '</div>'
            + '<div class="puc-io-line"><b>→ 이어지는 곳:</b> ' + esc(ap.to) + '</div>'
            + '</div>';
        }).join('');

        return '<div class="puc-row-card">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">'
          + '<b style="font-size:12.5px;color:#1e293b">' + esc(r.title) + '</b>'
          + '<span class="puc-dict-badge">' + esc(r.badge) + '</span>'
          + '</div>'
          + '<div style="font-size:11px;color:#475569;margin-top:3px">' + esc(r.summary) + '</div>'
          + appsHtml
          + '</div>';
      }).join('');
    }

    return principles + subBar + contentHtml;
  }

  function renderDictListHtml(hits) {
    var listHtml = hits.slice(0, 60).map(function (it) {
      return '<div class="puc-dict-item" role="button" tabindex="0" data-chat-cite="' + esc(it.id) + '">'
        + '<div class="puc-dict-top"><span class="puc-dict-badge">' + esc(catLabel(it.cat)) + '</span>'
        + '<span>' + esc(it.docNo || it.source || '') + '</span></div>'
        + '<div class="puc-dict-t">' + esc(it.title) + '</div>'
        + '</div>';
    }).join('');
    return listHtml || '<div class="puc-welcome">일치하는 사전 항목이 없습니다. 상단 [채팅]에서 자유롭게 물어보세요.</div>';
  }

  function renderDictBody() {
    var C = w.PuChatbot;
    if (!C) return '';
    var hits = C.filter(STATE.cat, STATE.dictQ);
    return '<div class="puc-dict-bar">'
      + '<input id="puChatDictInp" type="text" aria-label="통합사전 키워드 검색" value="' + esc(STATE.dictQ) + '" placeholder="🔍 사전 키워드·조문·문서번호·앱 검색…">'
      + '<span id="puChatDictCnt" style="font-size:11px;color:#475569;white-space:nowrap">' + hits.length + '건</span>'
      + '</div>'
      + '<div id="puChatDictList">' + renderDictListHtml(hits) + '</div>';
  }

  function updateDictResults() {
    var C = w.PuChatbot;
    if (!C) return;
    var hits = C.filter(STATE.cat, STATE.dictQ);
    var cntEl = $('puChatDictCnt');
    if (cntEl) cntEl.textContent = hits.length + '건';
    var listEl = $('puChatDictList');
    if (listEl) listEl.innerHTML = renderDictListHtml(hits);
  }

  function saveReopenDraft() {
    if (!STATE.reopenOpenId) return;
    var el = $('puImpReopenInp_' + STATE.reopenOpenId);
    if (el && typeof el.value === 'string') STATE.reopenDrafts[STATE.reopenOpenId] = el.value;
  }

  function restoreReopenFocus(reopenId, selStart, selEnd) {
    if (!reopenId) return;
    var restored = $('puImpReopenInp_' + reopenId);
    if (restored && typeof restored.focus === 'function') {
      restored.focus();
      if (selStart != null) {
        try { restored.setSelectionRange(selStart, selEnd != null ? selEnd : selStart); } catch (_) {}
      }
    }
  }

  function refreshView(scrollEnd) {
    var win = $('puChatWin');
    if (!win) return;
    var activeEl = d.activeElement;
    var activeReopenId = (activeEl && activeEl.getAttribute) ? (activeEl.getAttribute('data-reopen-inp') || '') : '';
    var reopenSelStart = (activeReopenId && typeof activeEl.selectionStart === 'number') ? activeEl.selectionStart : null;
    var reopenSelEnd = (activeReopenId && typeof activeEl.selectionEnd === 'number') ? activeEl.selectionEnd : null;
    saveReopenDraft();

    var catsEl = $('puChatCats');
    if (catsEl && w.PuChatbot) {
      /* 화면 간소화: 범주 알약 줄은 [사전] 검색 모드에서만 펼친다 */
      catsEl.style.display = STATE.mode === 'dict' ? 'flex' : 'none';
      if (STATE.mode === 'dict') {
        catsEl.innerHTML = w.PuChatbot.CHAT_CATS.map(function (c) {
          var isOn = STATE.cat === c[0];
          return '<button type="button" role="tab" aria-selected="' + (isOn ? 'true' : 'false') + '" class="puc-cat' + (isOn ? ' on' : '') + '" data-chat-cat="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
        }).join('');
      }
    }

    var chatBtn = $('puChatTabChat');
    var mapBtn = $('puChatMapBtn');
    var dictBtn = $('puChatModeBtn');
    var reqBtn = $('puChatReqBtn');
    if (chatBtn) { chatBtn.classList.toggle('on', STATE.mode === 'chat'); chatBtn.setAttribute('aria-pressed', STATE.mode === 'chat' ? 'true' : 'false'); }
    if (mapBtn) { mapBtn.classList.toggle('on', STATE.mode === 'map'); mapBtn.setAttribute('aria-pressed', STATE.mode === 'map' ? 'true' : 'false'); }
    if (dictBtn) { dictBtn.classList.toggle('on', STATE.mode === 'dict'); dictBtn.setAttribute('aria-pressed', STATE.mode === 'dict' ? 'true' : 'false'); }
    if (reqBtn) { reqBtn.classList.toggle('on', STATE.mode === 'req'); reqBtn.setAttribute('aria-pressed', STATE.mode === 'req' ? 'true' : 'false'); }
    syncBadges();

    var foot = $('puChatFoot');
    if (foot) foot.style.display = (STATE.mode === 'dict' || STATE.mode === 'req') ? 'none' : 'flex';
    var sendBtn = $('puChatSend');
    if (sendBtn) sendBtn.disabled = !!STATE.busy;

    var body = $('puChatBody');
    if (!body) return;
    if (STATE.mode === 'map') {
      body._renderedMode = 'map';
      body.innerHTML = renderMapBody();
      if (scrollEnd) body.scrollTop = 0;
      return;
    }
    if (STATE.mode === 'req') {
      body._renderedMode = 'req';
      body.innerHTML = renderReqBody();
      if (scrollEnd) body.scrollTop = 0;
      restoreReopenFocus(activeReopenId, reopenSelStart, reopenSelEnd);
      return;
    }
    if (STATE.mode === 'dict') {
      var existingDi = $('puChatDictInp');
      var existingList = $('puChatDictList');
      if (body._renderedMode === 'dict' && existingDi && existingList) {
        updateDictResults();
        return;
      }
      body._renderedMode = 'dict';
      body.innerHTML = renderDictBody();
      var di = $('puChatDictInp');
      if (di && !di._puDictBound) {
        di._puDictBound = true;
        di.addEventListener('input', function () {
          STATE.dictQ = di.value || '';
          updateDictResults();
        });
      }
      return;
    }
    body._renderedMode = 'chat';
    var logsHtml = STATE.logs.map(renderTurn).join('');
    body.innerHTML = hasUserQuestions()
      ? (renderPendingApprovals() + logsHtml)
      : (renderPendingApprovals() + renderWelcomeBox() + logsHtml);
    if (scrollEnd) body.scrollTop = body.scrollHeight;
    restoreReopenFocus(activeReopenId, reopenSelStart, reopenSelEnd);
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
          max_tokens: 1100,
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
      return hasLocalAnswer ? 'ℹ 오늘 AI 요약 한도가 차서 내장 근거 사전 답변을 그대로 보여드립니다.' : '오늘 AI 사용 한도가 찼습니다. 상단 [🔗 연결도] 또는 [📚 사전]에서 찾아보실 수 있습니다.';
    }
    if (err && err.status === 401) return '로그인 인증을 다시 확인해 주세요.';
    return hasLocalAnswer ? '' : ('AI 연결이 원활하지 않습니다 (' + (msg || '응답 지연') + ')');
  }

  /* ── 질문 전송 (6턴 연속 대화 맥락 + 코딩·문제해결 필요 시 자동 개선요청 접수) ── */
  function ask(rawQ) {
    if (!w.PuChatbot || STATE.busy) return Promise.resolve();
    bindImproveBridge();
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
      var historySnapshot = STATE.logs.filter(function (x) { return x && x.q; }).slice(-6);
      var picked = w.PuChatbot.pick(q, { cat: STATE.cat, max: 3, history: historySnapshot });
      var loc = w.PuChatbot.localAnswer(picked, q);
      var localImp = w.PuChatbot.detectImproveIntent(q, picked, historySnapshot);
      var pr = w.PuChatbot.makePrompt(picked, q, { apps: acc.list, history: historySnapshot });

      var turn = {
        q: q,
        picked: picked,
        _histBefore: historySnapshot,
        answer: localImp.needed
          ? '말씀하신 내용은 코딩·문제 해결이 필요한 건으로 확인되어 바로 개선요청으로 접수합니다.\n개선 처리 결과가 도착하면 이 채팅방에서 답을 드리고, 직접 확인 후 [승인]하시면 최종 완성됩니다.'
          : loc.answer,
        cites: loc.cites || [],
        apps: (loc.apps || []).filter(function (k) { return !!acc.map[k]; }),
        flowId: loc.flowId || '',
        followUps: loc.followUps || [],
        maskedKinds: pr.maskedKinds || [],
        improveTicket: null,
        improveSubmitting: false,
        aiText: '',
        aiLoading: true,
        errNote: ''
      };
      STATE.logs.push(turn);
      if (STATE.logs.length > 40) STATE.logs.shift();
      refreshView(true);

      var validKeys = acc.list.map(function (a) { return a.key; });
      var aiImprove = null;

      return callAiBackend(pr.system, pr.user).then(function (rawReply) {
        if (myEpoch !== STATE.epoch) return;
        var parsed = w.PuChatbot.parseReply(rawReply, picked, validKeys);
        turn.aiLoading = false;
        if (parsed && parsed.answer) turn.aiText = parsed.answer;
        if (parsed && parsed.cites && parsed.cites.length) turn.cites = parsed.cites;
        if (parsed && parsed.apps && parsed.apps.length) turn.apps = parsed.apps;
        if (parsed && parsed.flowId) turn.flowId = parsed.flowId;
        if (parsed && parsed.followUps && parsed.followUps.length) turn.followUps = parsed.followUps;
        if (parsed && parsed.improve && parsed.improve.needed) aiImprove = parsed.improve;
      }).catch(function (err) {
        if (myEpoch !== STATE.epoch) return;
        turn.aiLoading = false;
        turn.errNote = humanAiError(err, !loc.none || localImp.needed);
      }).then(function () {
        if (myEpoch !== STATE.epoch) return;
        STATE.busy = false;
        refreshView(true);
        if ((aiImprove && aiImprove.needed) || localImp.needed) {
          return triggerImproveForTurn(turn, aiImprove, false);
        }
      });
    });
  }

  function setMode(nextMode) {
    if (nextMode !== 'chat' && nextMode !== 'map' && nextMode !== 'dict' && nextMode !== 'req') return;
    STATE.mode = nextMode;
    if (nextMode === 'dict') {
      ensureFundKb().then(function () { refreshView(false); });
    }
    refreshView(nextMode === 'map' || nextMode === 'req');
  }

  /* ── 창 생성·열기·닫기·초기화 ── */
  function ensureWindow() {
    injectCss();
    bindImproveBridge();
    var win = $('puChatWin');
    if (win) return win;
    win = d.createElement('div');
    win.id = 'puChatWin';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', '푸른 시스템 길잡이 채팅방');
    win.innerHTML = '<div id="puChatHead" title="머리줄을 마우스로 끌어 위치를 옮길 수 있습니다">'
      + '<span class="t">💬 길잡이</span>'
      + '<span class="sp"></span>'
      + '<button type="button" class="puc-hbtn on" id="puChatTabChat" data-chat-mode="chat" data-nodrag="1" title="대화형 질문·개선요청·승인">채팅</button>'
      + '<button type="button" class="puc-hbtn" id="puChatMapBtn" data-chat-mode="map" data-nodrag="1" title="전체 앱 연결도 지도">연결도</button>'
      + '<button type="button" class="puc-hbtn" id="puChatModeBtn" data-chat-mode="dict" data-nodrag="1" title="시스템·법령·기금 사전 검색">사전</button>'
      + '<button type="button" class="puc-hbtn" id="puChatReqBtn" data-chat-mode="req" data-nodrag="1" title="내 개선요청 진행·결과 확인·승인">요청<span class="puc-hcnt" id="puChatReqCnt" style="display:none"></span></button>'
      + '<button type="button" class="puc-hbtn" data-chat-act="clear" data-nodrag="1" title="대화 비우기">비움</button>'
      + '<button type="button" class="puc-xbtn" data-chat-act="close" data-nodrag="1" aria-label="챗봇 닫기" title="닫기 (Esc)">✕</button>'
      + '</div>'
      + '<div id="puChatCats" role="tablist" aria-label="사전 분야 선택"></div>'
      + '<div id="puChatBody" aria-live="polite"></div>'
      + '<div id="puChatFoot">'
      + '<input id="puChatInp" type="text" aria-label="푸른 시스템 길잡이 질문 입력" placeholder="이어서 질문하거나 고칠 점·오류를 편하게 적어주세요…" autocomplete="off">'
      + '<button type="button" id="puChatSend">전송</button>'
      + '</div>';

    win.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest) {
        var dictItem = e.target.closest('.puc-dict-item[data-chat-cite]');
        if (dictItem) {
          e.preventDefault();
          openDocDetail(dictItem.getAttribute('data-chat-cite'));
          return;
        }
      }
      if (e.key === 'Enter' && !e.isComposing && e.target && e.target.getAttribute) {
        var reopenId = e.target.getAttribute('data-reopen-inp');
        if (reopenId) {
          e.preventDefault();
          reopenTicket(reopenId, e.target.value);
        }
      }
    });

    win.addEventListener('input', function (e) {
      if (e.target && e.target.getAttribute) {
        var rid = e.target.getAttribute('data-reopen-inp');
        if (rid) STATE.reopenDrafts[rid] = e.target.value || '';
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
      var approveBtn = e.target.closest && e.target.closest('[data-imp-approve]');
      if (approveBtn) {
        approveTicket(approveBtn.getAttribute('data-imp-approve'));
        return;
      }
      var reopenToggleBtn = e.target.closest && e.target.closest('[data-imp-reopen-toggle]');
      if (reopenToggleBtn) {
        var tid = reopenToggleBtn.getAttribute('data-imp-reopen-toggle');
        STATE.reopenOpenId = STATE.reopenOpenId === tid ? '' : tid;
        refreshView(false);
        if (STATE.reopenOpenId) {
          var rinp = $('puImpReopenInp_' + STATE.reopenOpenId);
          if (rinp) rinp.focus();
        }
        return;
      }
      var reopenSendBtn = e.target.closest && e.target.closest('[data-imp-reopen-send]');
      if (reopenSendBtn) {
        var sid = reopenSendBtn.getAttribute('data-imp-reopen-send');
        var sinp = $('puImpReopenInp_' + sid);
        reopenTicket(sid, sinp ? sinp.value : (STATE.reopenDrafts[sid] || ''));
        return;
      }
      var adminImpBtn = e.target.closest && e.target.closest('[data-imp-admin]');
      if (adminImpBtn) {
        if (w.portalChatImprove && typeof w.portalChatImprove.openAdminDetail === 'function') {
          w.portalChatImprove.openAdminDetail(adminImpBtn.getAttribute('data-imp-admin'));
        }
        return;
      }
      var manualImp = e.target.closest && e.target.closest('[data-chat-imp-idx]');
      if (manualImp) {
        var idx = Number(manualImp.getAttribute('data-chat-imp-idx'));
        if (STATE.logs[idx]) triggerImproveForTurn(STATE.logs[idx], null, true);
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
    STATE.reopenOpenId = '';
    refreshView(false);
  }

  /* 로그아웃 시 대화 기록·개선 구독·열린 창 즉시 정리 (공용 PC 개인정보 잔류 방지) */
  function resetOnLogout() {
    STATE.epoch++;
    STATE.busy = false;
    STATE.logs = [];
    STATE.uid = '';
    STATE.impMap = {};
    STATE.sessionTicketIds = {};
    STATE.announcedKeys = {};
    STATE.lastAutoImp = null;
    STATE.reopenOpenId = '';
    STATE.reopenDrafts = {};
    STATE.impBusyIds = {};
    if (typeof STATE.impUnsub === 'function') {
      try { STATE.impUnsub(); } catch (_) {}
      STATE.impUnsub = null;
    }
    if (w.portalChatImprove && typeof w.portalChatImprove.stop === 'function') {
      try { w.portalChatImprove.stop(); } catch (_) {}
    }
    syncBadges();
    close();
    var fab = $('chatFab');
    if (fab) fab.style.display = 'none';
  }

  function bindTrigger() {
    bindImproveBridge();
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
    approveTicket: approveTicket,
    reopenTicket: reopenTicket,
    clear: clearChat,
    resetOnLogout: resetOnLogout,
    openDocDetail: openDocDetail,
    _state: STATE
  };
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
