/* 🔍 무료 공공 기업검색 + 나이스비즈(폰 미러·웹) 연결 도구 — 기업정보함(pu-cards.html) 공용
   ═══════════════════════════════════════════════════════════════════════════
   ■ 서버 함수: asia-northeast3-pureun-erp.cloudfunctions.net/pubCompanySearch
     - 금융위 기업기본정보 + 국세청 사업상태 + 근로복지공단 고용·산재 (+ Open DART / NICE BizAPI 슬롯)
   ■ 나이스 비즈(파워기업검색) 연결:
     - 앱 내부 통신 우회·자동 조작은 하지 않는다.
     - 대신 「📱 파워기업검색용 복사」(PC·폰 미러 scrcpy 클립보드 공유 → Ctrl+V)와
       「🌐 나이스비즈라인」 바로 열기, 추후 공식 NICE BizAPI 연동 슬롯을 제공한다.
   ■ 기업정보함 반영 규칙:
     - RTDB 트랜잭션으로 현재 값을 읽어 빈 칸만 채운다(사람이 적어 둔 값은 덮어쓰지 않는다).
     - 동적 값은 인라인 onclick 문자열에 절대 끼워 넣지 않고 data-* + 이벤트 위임으로 처리한다. */
(function (root) {
  'use strict';

  var FN_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/pubCompanySearch';
  var NICE_WEB_URL = 'https://www.nicebizline.com/';
  var SRC_LABEL = '금융위 기업기본정보';
  var MODAL_ID = 'puPubSearchModal';

  var _state = {
    open: false,
    loading: false,
    query: '',
    error: '',
    warnings: [],
    items: [],
    integrations: null,
    detailLoading: {},
    applyLoading: {},
    applied: {},
    lastFocus: null,
  };
  var _bound = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function digits(s) {
    return String(s == null ? '' : s).replace(/[^0-9]/g, '');
  }

  function safeHttpUrl(u) {
    var s = String(u || '').trim();
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
  }

  function notify(msg, ms) {
    if (typeof root.toast === 'function') { root.toast(msg, ms || 4500); return; }
    try { console.log('[공공 기업검색]', msg); } catch (_) {}
  }

  /* 기업정보함(pucards/coInfo/{bizNo}) 반영용 패치 생성 — 순수 함수
     ⚠ 기존 값(existing)이 있는 칸은 절대 덮어쓰지 않는다. */
  function buildCoInfoPatch(item, existing, nowMs) {
    var it = item || {};
    var ex = existing || {};
    var bizNo = digits(it.bizNo);
    if (bizNo.length !== 10) return { bizNo: '', patch: {}, filled: [] };

    var map = [
      ['bizno', bizNo],
      ['company', it.name],
      ['ceo', it.ceo],
      ['corpno', it.corpNo],
      ['address', it.address],
      ['companyTel', it.phone],
      ['companyFax', it.fax],
      ['homepage', safeHttpUrl(it.homepage)],
      ['bizItem', it.industry],
      ['openDate', it.estDate],
    ];

    var patch = {};
    var filled = [];
    var src = Object.assign({}, ex.src || {});
    map.forEach(function (pair) {
      var k = pair[0], v = String(pair[1] || '').trim();
      if (!v) return;
      if (String(ex[k] || '').trim()) return;
      patch[k] = v;
      src[k] = SRC_LABEL;
      filled.push(k);
    });

    if (it.nts && it.nts.state) {
      var d = new Date((nowMs || Date.now()) + 9 * 3600000).toISOString().slice(0, 10);
      patch.ntsState = it.nts.state;
      patch.ntsAt = d;
      patch.ntsEndDt = it.nts.endDt ? String(it.nts.endDt) : null;
      filled.push('ntsState');
    }

    if (filled.length) {
      patch.src = src;
      patch.updatedAt = nowMs || Date.now();
    }
    return { bizNo: bizNo, patch: patch, filled: filled };
  }

  /* 클립보드 복사 (폰 미러 scrcpy 와 클립보드 공유 → 파워기업검색에 Ctrl+V) */
  async function copyForNicePhone(text) {
    var v = String(text || '').trim();
    if (!v) { notify('복사할 회사명이나 사업자번호가 없습니다', 3500); return false; }
    try {
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        await root.navigator.clipboard.writeText(v);
      } else {
        var ta = root.document.createElement('textarea');
        ta.value = v;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        root.document.body.appendChild(ta);
        ta.select();
        root.document.execCommand('copy');
        root.document.body.removeChild(ta);
      }
      notify('📱 「' + v + '」 복사됨 — 폰 미러(폰미러-켜기.bat) 창에서 Ctrl+V로 파워기업검색에 붙여넣으세요', 6000);
      return true;
    } catch (_) {
      notify('클립보드 복사에 실패했습니다: ' + v, 4000);
      return false;
    }
  }

  function openNiceBizline(text) {
    var v = String(text || '').trim();
    if (v) copyForNicePhone(v);
    try { root.open(NICE_WEB_URL, '_blank', 'noopener,noreferrer'); } catch (_) {}
  }

  /* 기업 상세 패널(#coInfoBox 아래) 한 줄 연결 바 — 인라인 onclick 없이 data-* 속성만 사용 */
  function detailBarHtml(o) {
    if (!o) return '';
    var name = String(o.name || '').trim();
    var biz = digits(o.bizno || '');
    var q = biz.length === 10 ? biz : name;
    var niceCopy = name || biz;
    if (!q) return '';
    return '<div class="pubco-bar" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">'
      + '<button type="button" class="pubco-btn" data-pubco-act="open" data-pubco-val="' + esc(q) + '" '
      + 'title="금융위·국세청·고용산재 무료 공공 기업정보를 조회합니다">🔍 공공정보 조회</button>'
      + '<button type="button" class="pubco-btn" data-pubco-act="copy" data-pubco-val="' + esc(niceCopy) + '" '
      + 'title="회사명을 복사해 폰 미러(scrcpy) 파워기업검색 창에 Ctrl+V로 바로 붙여넣습니다">📱 파워기업검색용 복사</button>'
      + '<button type="button" class="pubco-btn" data-pubco-act="nice" data-pubco-val="' + esc(niceCopy) + '" '
      + 'title="회사명을 복사하고 나이스비즈라인(PC 웹)을 새 탭으로 엽니다">🌐 나이스비즈라인</button>'
      + '</div>';
  }

  function bindGlobalEvents() {
    if (_bound || !root.document || !root.document.addEventListener) return;
    _bound = true;
    root.document.addEventListener('click', function (ev) {
      var t = ev && ev.target;
      var btn = t && typeof t.closest === 'function' ? t.closest('[data-pubco-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-pubco-act');
      var val = btn.getAttribute('data-pubco-val') || '';
      var idx = Number(btn.getAttribute('data-pubco-idx'));
      if (act === 'open') { open(val); }
      else if (act === 'close') { close(); }
      else if (act === 'copy') { copyForNicePhone(val); }
      else if (act === 'nice') { openNiceBizline(val); }
      else if (act === 'apply' && Number.isInteger(idx)) { applyToCoInfo(idx); }
      else if (act === 'ei' && Number.isInteger(idx)) { loadEiDetail(idx); }
    });
    root.document.addEventListener('keydown', function (ev) {
      if (!_state.open) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });
  }

  function ensureStyle() {
    if (!root.document || root.document.getElementById('puPubSearchStyle')) return;
    var st = root.document.createElement('style');
    st.id = 'puPubSearchStyle';
    st.textContent = ''
      + '.pubco-bar .pubco-btn{background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;min-height:32px;font-size:12px;font-weight:600;cursor:pointer;line-height:1.3}'
      + '.pubco-bar .pubco-btn:hover:not(:disabled){background:#eff6ff;border-color:#2563eb;color:#1d4ed8}'
      + '#' + MODAL_ID + ',#' + MODAL_ID + ' *{box-sizing:border-box}'
      + '#' + MODAL_ID + ' .pubco-btn{background:#111827;color:#f8fafc;border:1px solid #334155;border-radius:8px;padding:6px 11px;min-height:32px;font-size:12px;cursor:pointer;line-height:1.3}'
      + '#' + MODAL_ID + ' .pubco-btn:hover:not(:disabled){border-color:#60a5fa}'
      + '#' + MODAL_ID + ' .pubco-btn:disabled{opacity:.5;cursor:not-allowed}'
      + '#' + MODAL_ID + ' .pubco-btn.primary{background:#1d4ed8;border-color:#2563eb;color:#fff;font-weight:700}'
      + '#' + MODAL_ID + ' .pubco-btn.ok{background:#166534;border-color:#15803d;color:#fff}'
      + '#' + MODAL_ID + '{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:12px}'
      + '.pubco-dlg{width:100%;max-width:760px;max-height:90vh;display:flex;flex-direction:column;background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:14px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.55)}'
      + '.pubco-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid #1e293b}'
      + '.pubco-hd h3{margin:0;font-size:16px;font-weight:700}'
      + '.pubco-x{background:transparent;border:1px solid #334155;color:#f8fafc;border-radius:8px;width:36px;height:36px;flex:0 0 auto;font-size:16px;cursor:pointer}'
      + '.pubco-form{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid #1e293b}'
      + '.pubco-in{flex:1;min-width:0;width:100%;font-size:16px;padding:9px 12px;border-radius:8px;border:1px solid #334155;background:#111827;color:#f8fafc}'
      + '.pubco-meta{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px;font-size:12px;color:#94a3b8;border-bottom:1px solid #1e293b}'
      + '.pubco-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;border:1px solid #334155;font-size:11px}'
      + '.pubco-chip.on{border-color:#22c55e;color:#4ade80}'
      + '.pubco-chip.off{opacity:.75}'
      + '.pubco-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px;display:flex;flex-direction:column;gap:10px}'
      + '.pubco-card{border:1px solid #334155;border-radius:10px;padding:12px 14px;background:#111827;min-width:0;max-width:100%}'
      + '.pubco-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px;min-width:0}'
      + '.pubco-nm{font-size:15px;font-weight:700;word-break:break-word}'
      + '.pubco-tag{font-size:11px;padding:2px 7px;border-radius:999px;font-weight:700}'
      + '.pubco-tag.ok{background:#14532d;color:#86efac}'
      + '.pubco-tag.soon{background:#713f12;color:#fde047}'
      + '.pubco-tag.gone,.pubco-tag.none{background:#7f1d1d;color:#fca5a5}'
      + '.pubco-tag.dim{background:#1e293b;color:#cbd5e1}'
      + '.pubco-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px;font-size:13px}'
      + '.pubco-kv{display:flex;gap:6px;min-width:0}'
      + '.pubco-k{color:#94a3b8;flex:0 0 auto;min-width:62px}'
      + '.pubco-v{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.pubco-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid #1e293b}'
      + '.pubco-ei{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(30,41,59,.45);font-size:12px;word-break:break-word}'
      + '.pubco-err{padding:10px 12px;border-radius:8px;background:#7f1d1d;color:#fecaca;font-size:13px}'
      + '.pubco-warn{padding:8px 10px;border-radius:8px;background:#713f12;color:#fef08a;font-size:12px}'
      + '@media (max-width:640px){#' + MODAL_ID + '{padding:6px}.pubco-dlg{width:100%;max-width:100%}.pubco-hd,.pubco-form,.pubco-meta,.pubco-body{padding-left:12px;padding-right:12px}.pubco-grid{grid-template-columns:1fr}.pubco-v{white-space:normal;word-break:break-word}.pubco-form{flex-direction:column}#' + MODAL_ID + ' .pubco-btn,.pubco-bar .pubco-btn{min-height:36px}}';
    root.document.head.appendChild(st);
  }

  async function callApi(payload) {
    var auth = root.firebase && root.firebase.auth ? root.firebase.auth() : null;
    var u = auth && auth.currentUser;
    if (!u) throw new Error('로그인이 필요합니다.');
    var tok = await u.getIdToken();
    var res = await root.fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(payload || {}),
    });
    var j = null;
    try { j = await res.json(); } catch (_) {}
    if (!res.ok || !j || !j.ok) {
      throw new Error((j && j.error) || ('서버 응답 ' + res.status));
    }
    return j;
  }

  function renderChips() {
    var g = _state.integrations || {
      fsc: { configured: true, label: '금융위 기업기본정보' },
      nts: { configured: true, label: '국세청 사업상태' },
      ei: { configured: true, label: '고용·산재 상시인원' },
      dart: { configured: false, label: 'Open DART', hint: '서버 환경변수(DART_API_KEY) 등록 시 재무제표 자동 연동' },
      nice: { configured: false, label: 'NICE BizAPI', hint: '서버 환경변수(NICE_BIZAPI_KEY) 등록 시 자동 연동 (현재 폰 미러 복사·웹 연결)' },
    };
    return Object.keys(g).map(function (k) {
      var x = g[k];
      return '<span class="pubco-chip ' + (x.configured ? 'on' : 'off') + '" title="' + esc(x.hint || x.label) + '">'
        + (x.configured ? '● ' : '○ ') + esc(x.label) + '</span>';
    }).join('');
  }

  function renderCard(it, idx) {
    var ntsHtml = it.nts && it.nts.state
      ? '<span class="pubco-tag ' + esc(it.nts.cls || 'dim') + '">' + esc(it.nts.state)
        + (it.nts.endDt ? ' (' + esc(it.nts.endDt) + ')' : '') + '</span>'
      : '';
    var smeHtml = it.sme ? '<span class="pubco-tag dim">중소기업</span>' : '';
    var url = safeHttpUrl(it.homepage);
    var kv = function (k, v, isLink) {
      if (!v) return '';
      var body = isLink && url
        ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" style="color:#60a5fa">' + esc(v) + '</a>'
        : esc(v);
      return '<div class="pubco-kv"><span class="pubco-k">' + esc(k) + '</span><span class="pubco-v" title="' + esc(v) + '">' + body + '</span></div>';
    };
    var eiBox = '';
    if (it.ei) {
      var rowsHtml = (it.ei.rows || []).slice(0, 4).map(function (r) {
        return '<div style="margin-top:3px">· ' + esc(r.nm) + ' (' + (r.fg === 'gy' ? '고용' : '산재') + ' ' + Number(r.cnt || 0) + '명'
          + (r.ind ? ' · ' + esc(r.ind) : '') + ')</div>';
      }).join('');
      eiBox = '<div class="pubco-ei"><b>🏢 고용·산재 상시인원:</b> 고용 ' + Number(it.ei.gy || 0) + '명 · 산재 ' + Number(it.ei.sj || 0)
        + '명 (사업장 ' + Number(it.ei.n || 0) + '곳)' + rowsHtml + '</div>';
    }
    var niceCopy = it.name || it.bizNoFmt || it.bizNo || '';
    var applied = !!_state.applied[idx];
    var applying = !!_state.applyLoading[idx];
    var eiLoading = !!_state.detailLoading[idx];
    return '<div class="pubco-card">'
      + '<div class="pubco-top"><span class="pubco-nm">' + esc(it.name || it.bizNoFmt) + '</span>' + ntsHtml + smeHtml
      + '<span style="margin-left:auto;font-size:11px;color:var(--sub,#94a3b8)">' + esc(it.source || '') + '</span></div>'
      + '<div class="pubco-grid">'
      + kv('사업자번호', it.bizNoFmt || it.bizNo)
      + kv('법인번호', it.corpNo)
      + kv('대표자', it.ceo)
      + kv('설립일', it.estDate)
      + kv('업종', it.industry)
      + kv('종업원수', it.empCount ? Number(it.empCount).toLocaleString() + '명' : '')
      + kv('대표번호', it.phone)
      + kv('팩스', it.fax)
      + kv('소재지', it.address)
      + kv('홈페이지', it.homepage, true)
      + '</div>'
      + eiBox
      + '<div class="pubco-acts">'
      + (it.bizNo
        ? '<button type="button" class="pubco-btn ' + (applied ? 'ok' : 'primary') + '" data-pubco-act="apply" data-pubco-idx="' + idx + '" ' + (applying ? 'disabled' : '') + '>'
          + (applying ? '반영 중…' : (applied ? '✓ 기업정보함 반영됨' : '💾 기업정보함에 반영')) + '</button>'
          + '<button type="button" class="pubco-btn" data-pubco-act="ei" data-pubco-idx="' + idx + '" ' + (eiLoading ? 'disabled' : '') + '>'
          + (eiLoading ? '조회 중…' : '👥 고용·산재 상세') + '</button>'
        : '')
      + '<button type="button" class="pubco-btn" data-pubco-act="copy" data-pubco-val="' + esc(niceCopy) + '">📱 파워기업검색용 복사</button>'
      + '<button type="button" class="pubco-btn" data-pubco-act="nice" data-pubco-val="' + esc(niceCopy) + '">🌐 나이스비즈라인</button>'
      + '</div></div>';
  }

  function paint() {
    if (!root.document) return;
    bindGlobalEvents();
    var el = root.document.getElementById(MODAL_ID);
    if (!_state.open) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      if (_state.lastFocus && typeof _state.lastFocus.focus === 'function') {
        try { _state.lastFocus.focus(); } catch (_) {}
      }
      _state.lastFocus = null;
      return;
    }
    ensureStyle();
    if (!el) {
      el = root.document.createElement('div');
      el.id = MODAL_ID;
      el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
      root.document.body.appendChild(el);
    }

    var bodyHtml = '';
    if (_state.error) bodyHtml += '<div class="pubco-err" role="alert">' + esc(_state.error) + '</div>';
    if (_state.warnings && _state.warnings.length) {
      bodyHtml += '<div class="pubco-warn" role="alert">' + _state.warnings.map(esc).join('<br>') + '</div>';
    }
    if (_state.loading) {
      bodyHtml += '<div style="padding:24px;text-align:center;color:var(--sub,#94a3b8)">공공 기업정보를 불러오는 중입니다…</div>';
    } else if (_state.items.length) {
      bodyHtml += _state.items.map(renderCard).join('');
    } else if (_state.query && !_state.error) {
      bodyHtml += '<div style="padding:24px;text-align:center;color:var(--sub,#94a3b8)">검색 결과가 없습니다. 회사명 일부나 사업자번호 10자리로 다시 검색해 보세요.</div>';
    } else {
      bodyHtml += '<div style="padding:18px;color:var(--sub,#94a3b8);font-size:13px;line-height:1.6">'
        + '· <b>회사명</b>(예: 삼성전자) 또는 <b>사업자번호 10자리</b>(예: 124-81-00998)로 무료 공공 기업정보를 바로 조회합니다.<br>'
        + '· 조회 결과는 <b>기업정보함의 빈 칸만</b> 안전하게 채워 넣을 수 있습니다.<br>'
        + '· <b>파워기업검색(폰 앱)</b> 확인이 필요하면 결과 카드의 「📱 파워기업검색용 복사」를 누르고 PC 폰 미러(<code>폰미러-켜기.bat</code>) 창에서 <code>Ctrl+V</code>로 바로 검색하세요.'
        + '</div>';
    }

    el.innerHTML = '<div class="pubco-dlg" role="dialog" aria-modal="true" aria-label="무료 공공 기업검색">'
      + '<div class="pubco-hd"><h3>🔍 무료 공공 기업검색</h3><button type="button" class="pubco-x" data-pubco-act="close" aria-label="닫기" title="닫기 (Esc)">✕</button></div>'
      + '<form id="puPubSearchForm" class="pubco-form">'
      + '<input id="puPubSearchIn" class="pubco-in" type="search" aria-label="회사명 또는 사업자번호 10자리" value="' + esc(_state.query) + '" placeholder="회사명 또는 사업자번호 10자리 (예: 삼성전자, 124-81-00998)" autocomplete="off">'
      + '<button type="submit" class="pubco-btn primary" ' + (_state.loading ? 'disabled' : '') + '>' + (_state.loading ? '검색 중…' : '검색') + '</button>'
      + '</form>'
      + '<div class="pubco-meta">' + renderChips() + '</div>'
      + '<div class="pubco-body">' + bodyHtml + '</div>'
      + '</div>';

    var form = root.document.getElementById('puPubSearchForm');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); search(); });
    var inp = root.document.getElementById('puPubSearchIn');
    if (inp && !_state.loading) {
      try { inp.focus(); } catch (_) {}
    }
  }

  function open(initialQuery) {
    if (!_state.open && root.document) _state.lastFocus = root.document.activeElement || null;
    _state.open = true;
    _state.error = '';
    _state.warnings = [];
    if (typeof initialQuery === 'string' && initialQuery.trim()) {
      _state.query = initialQuery.trim();
      _state.items = [];
      _state.applied = {};
      _state.applyLoading = {};
      paint();
      search(_state.query);
    } else {
      paint();
    }
  }

  function close() {
    _state.open = false;
    paint();
  }

  async function search(qOverride) {
    var inp = root.document && root.document.getElementById('puPubSearchIn');
    var q = String(qOverride != null ? qOverride : (inp ? inp.value : _state.query) || '').trim();
    _state.query = q;
    if (!q) { _state.error = '회사명 또는 사업자번호 10자리를 입력해 주세요.'; paint(); return; }
    _state.loading = true;
    _state.error = '';
    _state.warnings = [];
    _state.applied = {};
    _state.applyLoading = {};
    _state.detailLoading = {};
    paint();
    try {
      var res = await callApi({ query: q });
      _state.items = Array.isArray(res.items) ? res.items : [];
      _state.warnings = Array.isArray(res.warnings) ? res.warnings : [];
      if (res.integrations) _state.integrations = res.integrations;
    } catch (e) {
      _state.items = [];
      _state.error = String((e && e.message) || e || '조회에 실패했습니다.');
    } finally {
      _state.loading = false;
      paint();
    }
  }

  async function loadEiDetail(idx) {
    var it = _state.items[idx];
    if (!it || !it.bizNo || _state.detailLoading[idx]) return;
    _state.detailLoading[idx] = true;
    paint();
    try {
      var res = await callApi({ detailBizNo: it.bizNo });
      if (res.ei) it.ei = res.ei;
      if (res.nts) it.nts = res.nts;
      if (res.warnings && res.warnings.length) _state.warnings = res.warnings;
    } catch (e) {
      notify('고용·산재 상세 조회 실패: ' + ((e && e.message) || e), 5000);
    } finally {
      _state.detailLoading[idx] = false;
      paint();
    }
  }

  async function applyToCoInfo(idx) {
    var it = _state.items[idx];
    if (!it || !it.bizNo) { notify('사업자번호가 없어 기업정보함에 반영할 수 없습니다', 4000); return; }
    if (_state.applyLoading[idx]) return;
    var db = (root.Store && root.Store.db) || (root.firebase && root.firebase.database ? root.firebase.database() : null);
    if (!db) { notify('데이터베이스에 연결되어 있지 않습니다', 4000); return; }
    var rootPath = typeof root.DB_ROOT === 'string' && root.DB_ROOT ? root.DB_ROOT : 'pucards';
    var ref = db.ref(rootPath + '/coInfo/' + it.bizNo);
    _state.applyLoading[idx] = true;
    paint();
    try {
      var filledCount = 0;
      if (typeof ref.transaction === 'function') {
        await ref.transaction(function (cur) {
          var existing = (cur && typeof cur === 'object') ? cur : {};
          var built = buildCoInfoPatch(it, existing, Date.now());
          filledCount = built.filled.length;
          if (!built.filled.length) return cur;
          var next = Object.assign({}, existing, built.patch);
          if (next.ntsEndDt === null) delete next.ntsEndDt;
          return next;
        });
      } else {
        var snap = await ref.once('value');
        var existing = (snap && snap.val && snap.val()) || {};
        var built = buildCoInfoPatch(it, existing, Date.now());
        filledCount = built.filled.length;
        if (built.filled.length) await ref.update(built.patch);
      }
      if (!filledCount) {
        notify('이미 기업정보함에 모든 항목이 채워져 있습니다 (기존 입력값을 보호했습니다)', 4500);
      } else {
        notify('💾 「' + (it.name || it.bizNoFmt) + '」 ' + filledCount + '개 항목을 기업정보함에 반영했습니다', 5000);
      }
      if (root.PuPubdata && typeof root.PuPubdata.ask === 'function') {
        root.PuPubdata.ask(it.bizNo, '', it.name || '').catch(function () {});
      }
      _state.applied[idx] = true;
    } catch (e) {
      notify('기업정보함 반영 실패: ' + ((e && e.message) || e), 5000);
    } finally {
      _state.applyLoading[idx] = false;
      paint();
    }
  }

  bindGlobalEvents();
  if (root.document) {
    if (root.document.head) ensureStyle();
    else if (root.document.addEventListener) root.document.addEventListener('DOMContentLoaded', ensureStyle);
    if (root.location && /(^|[?&])view=pubsearch(&|$)/.test(String(root.location.search || ''))) {
      var bootOpen = function () {
        setTimeout(function () {
          open();
          try {
            if (root.history && typeof root.history.replaceState === 'function') {
              var u = new URL(root.location.href);
              u.searchParams.delete('view');
              root.history.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
            }
          } catch (_) {}
        }, 350);
      };
      if (root.document.readyState === 'complete') bootOpen();
      else if (root.addEventListener) root.addEventListener('load', bootOpen, { once: true });
    }
  }

  var api = {
    FN_URL: FN_URL,
    NICE_WEB_URL: NICE_WEB_URL,
    buildCoInfoPatch: buildCoInfoPatch,
    copyForNicePhone: copyForNicePhone,
    openNiceBizline: openNiceBizline,
    detailBarHtml: detailBarHtml,
    open: open,
    close: close,
    search: search,
    loadEiDetail: loadEiDetail,
    applyToCoInfo: applyToCoInfo,
  };

  root.PuPubSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
