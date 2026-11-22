/* 🔍 공공 기업검색 독립 프로그램 (pu-pubsearch.html)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 포털 ② 자료함의 독립 프로그램으로 동작한다.
   ■ 연동 원천:
     - 금융위 기업기본정보 · 금융위 요약재무제표 · 국세청 사업상태
     - 근로복지공단 고용·산재 상시인원 · 국민연금 가입자 수(보험료 제외)
     - 금융감독원 DART 전자공시 · 우리 기업정보함(pucards/coInfo) 등록 여부
     - 연간회원용 파워기업검색(폰 복사·나이스비즈라인 바로가기) + 추후 NICE BizAPI 슬롯
   ■ 검색 기록 · 즐겨찾기:
     - 브라우저 localStorage 에 자동 저장(최대 40건), 클릭 한 번으로 재검색.
   ■ 보안 규칙:
     - 동적 문자열은 인라인 onclick 에 넣지 않고 data-ps-* 속성 + 위임 이벤트로만 처리한다. */
(function (root) {
  'use strict';

  var FN_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/pubCompanySearch';
  var NICE_WEB_URL = 'https://www.nicebizline.com/';
  var DART_SEARCH_BASE = 'https://dart.fss.or.kr/dsab007/main.do?option=corp&textCrpNm=';
  var HIST_KEY = 'pu_pubsearch_history_v1';
  var PIN_KEY = 'pu_pubsearch_pins_v1';
  var HIST_MAX = 40;
  var PIN_MAX = 30;
  var SRC_LABEL = '금융위 기업기본정보';

  var _rootEl = null;
  var _bound = false;
  var _reqSeq = 0;
  var _state = {
    user: null,
    uid: '',
    query: '',
    loading: false,
    error: '',
    warnings: [],
    items: [],
    integrations: null,
    sideTab: 'hist',
    history: [],
    pins: [],
    detailLoading: {},
    applyLoading: {},
    applied: {},
    toastMsg: '',
    toastTimer: null,
  };

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

  function fmtWon(v) {
    if (v == null || !Number.isFinite(Number(v))) return '-';
    var n = Number(v);
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1e12) return sign + (abs / 1e12).toFixed(1) + '조원';
    if (abs >= 1e8) return sign + Math.round(abs / 1e8).toLocaleString() + '억원';
    if (abs >= 1e4) return sign + Math.round(abs / 1e4).toLocaleString() + '만원';
    return sign + abs.toLocaleString() + '원';
  }

  function fmtTime(ms) {
    if (!ms) return '';
    var d = new Date(ms);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return mm + '.' + dd + ' ' + hh + ':' + mi;
  }

  /* ── 검색 기록 · 즐겨찾기 순수 헬퍼 ── */
  function scopedKey(base) {
    return _state.uid ? (base + ':' + _state.uid) : '';
  }

  function loadStore(base) {
    try {
      var key = scopedKey(base);
      if (!key || !root.localStorage) return [];
      var raw = root.localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function saveStore(base, arr) {
    try {
      var key = scopedKey(base);
      if (key && root.localStorage) root.localStorage.setItem(key, JSON.stringify(arr || []));
    } catch (_) {}
  }

  function pinKeyOf(it) {
    var b = digits(it && it.bizNo);
    if (b) return b;
    var c = digits(it && it.corpNo);
    if (c) return 'cr:' + c;
    var nm = String((it && it.name) || '').trim();
    if (!nm) return '';
    return 'nm:' + nm + '|' + String((it && it.address) || '').trim().slice(0, 12);
  }

  function pushHistoryList(list, entry, maxLen) {
    var q = String((entry && entry.query) || '').trim();
    if (!q) return [].concat(list || []);
    var next = [Object.assign({ query: q, at: Date.now(), count: 0, topName: '', topBizNo: '' }, entry)]
      .concat((list || []).filter(function (x) { return x && x.query !== q; }));
    return next.slice(0, maxLen || HIST_MAX);
  }

  function togglePinList(list, item, maxLen) {
    var it = item || {};
    var key = pinKeyOf(it);
    if (!key) return [].concat(list || []);
    var exists = (list || []).some(function (x) { return x && x.key === key; });
    if (exists) return (list || []).filter(function (x) { return x && x.key !== key; });
    var entry = {
      key: key,
      name: String(it.name || it.bizNoFmt || key),
      bizNo: digits(it.bizNo),
      bizNoFmt: String(it.bizNoFmt || it.bizNo || ''),
      ceo: String(it.ceo || ''),
      at: Date.now(),
    };
    return [entry].concat(list || []).slice(0, maxLen || PIN_MAX);
  }

  /* 기업정보함(pucards/coInfo/{bizNo}) 반영용 패치 — 기존 값 보호 */
  function buildCoInfoPatch(item, existing, nowMs) {
    if (root.PuPubSearch && typeof root.PuPubSearch.buildCoInfoPatch === 'function') {
      return root.PuPubSearch.buildCoInfoPatch(item, existing, nowMs);
    }
    var it = item || {};
    var ex = existing || {};
    var bizNo = digits(it.bizNo);
    if (bizNo.length !== 10) return { bizNo: '', patch: {}, filled: [] };
    var map = [
      ['bizno', bizNo], ['company', it.name], ['ceo', it.ceo], ['corpno', it.corpNo],
      ['address', it.address], ['companyTel', it.phone], ['companyFax', it.fax],
      ['homepage', safeHttpUrl(it.homepage)], ['bizItem', it.industry], ['openDate', it.estDate],
    ];
    var patch = {};
    var filled = [];
    var src = Object.assign({}, ex.src || {});
    map.forEach(function (pair) {
      var k = pair[0], v = String(pair[1] || '').trim();
      if (!v || String(ex[k] || '').trim()) return;
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

  function showToast(msg, ms) {
    _state.toastMsg = String(msg || '');
    if (_state.toastTimer) clearTimeout(_state.toastTimer);
    renderToastOnly();
    _state.toastTimer = setTimeout(function () {
      _state.toastMsg = '';
      renderToastOnly();
    }, ms || 4500);
  }

  function renderToastOnly() {
    if (!root.document) return;
    var el = root.document.getElementById('psToast');
    if (!el) return;
    el.textContent = _state.toastMsg || '';
    el.style.display = _state.toastMsg ? 'block' : 'none';
  }

  async function copyText(text, label) {
    var v = String(text || '').trim();
    if (!v) { showToast('복사할 값이 없습니다.'); return false; }
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
      showToast(label || ('📱 「' + v + '」 복사됨 — 폰 파워기업검색 앱 또는 PC 폰 미러 창에서 바로 붙여넣으세요'), 5500);
      return true;
    } catch (_) {
      showToast('클립보드 복사에 실패했습니다: ' + v);
      return false;
    }
  }

  function openExternal(url) {
    var u = safeHttpUrl(url);
    if (!u) return;
    try { root.open(u, '_blank', 'noopener,noreferrer'); } catch (_) {}
  }

  async function callApi(payload) {
    var auth = root.firebase && root.firebase.auth ? root.firebase.auth() : null;
    var u = (auth && auth.currentUser) || _state.user;
    if (!u || typeof u.getIdToken !== 'function') throw new Error('로그인이 필요합니다.');
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

  async function runSearch(qOverride) {
    var inp = root.document && root.document.getElementById('psQueryIn');
    var q = String(qOverride != null ? qOverride : (inp ? inp.value : _state.query) || '').trim();
    _state.query = q;
    if (!q) { _state.error = '회사명 또는 사업자번호 10자리를 입력해 주세요.'; paint(); return; }
    var seq = ++_reqSeq;
    _state.loading = true;
    _state.error = '';
    _state.warnings = [];
    _state.applied = {};
    _state.applyLoading = {};
    _state.detailLoading = {};
    paint();
    try {
      var res = await callApi({ query: q });
      if (seq !== _reqSeq) return;
      _state.items = Array.isArray(res.items) ? res.items : [];
      _state.warnings = Array.isArray(res.warnings) ? res.warnings : [];
      if (res.integrations) _state.integrations = res.integrations;
      var top = _state.items[0] || {};
      _state.history = pushHistoryList(_state.history, {
        query: q,
        at: Date.now(),
        count: _state.items.length,
        topName: top.name || '',
        topBizNo: top.bizNoFmt || top.bizNo || '',
      }, HIST_MAX);
      saveStore(HIST_KEY, _state.history);
    } catch (e) {
      if (seq !== _reqSeq) return;
      _state.items = [];
      _state.error = String((e && e.message) || e || '조회에 실패했습니다.');
    } finally {
      if (seq === _reqSeq) {
        _state.loading = false;
        paint();
      }
    }
  }

  async function loadFullDetail(idx) {
    var it = _state.items[idx];
    if (!it || (!it.bizNo && !it.corpNo) || _state.detailLoading[idx]) return;
    var seq = _reqSeq;
    _state.detailLoading[idx] = true;
    paint();
    try {
      var res = await callApi({
        detailBizNo: it.bizNo || '',
        detailCorpNo: it.corpNo || '',
        detailName: it.name || '',
      });
      if (seq !== _reqSeq) return;
      if (res.ei) it.ei = res.ei;
      if (res.nts) it.nts = res.nts;
      if (res.nps) it.nps = res.nps;
      if (Array.isArray(res.fin)) it.fin = res.fin;
      if (res.dart != null) it.dart = res.dart;
      if (res.warnings && res.warnings.length) _state.warnings = res.warnings;
      it._detailLoaded = true;
    } catch (e) {
      if (seq === _reqSeq) showToast('통합 상세 조회 실패: ' + ((e && e.message) || e), 5000);
    } finally {
      if (seq === _reqSeq) {
        _state.detailLoading[idx] = false;
        paint();
      }
    }
  }

  /* 서버(pubCompanySearch action:applyToCoInfo) 트랜잭션으로 기업정보함 빈 칸 안전 반영 */
  async function applyToCoInfo(idx) {
    var it = _state.items[idx];
    if (!it || !it.bizNo) { showToast('사업자번호가 없어 기업정보함에 반영할 수 없습니다.'); return; }
    if (_state.applyLoading[idx]) return;
    var seq = _reqSeq;
    _state.applyLoading[idx] = true;
    paint();
    try {
      var res = await callApi({ action: 'applyToCoInfo', item: it });
      if (seq !== _reqSeq) return;
      var filledCount = Number(res.filledCount || 0);
      if (!filledCount) {
        showToast('이미 기업정보함에 모든 항목이 채워져 있습니다 (기존 입력값 보호됨).');
      } else {
        showToast('💾 「' + (it.name || it.bizNoFmt) + '」 ' + filledCount + '개 항목을 기업정보함에 반영했습니다.');
      }
      it.ourCard = Object.assign({}, it.ourCard || {}, { exists: true });
      _state.applied[idx] = true;
    } catch (e) {
      if (seq === _reqSeq) showToast('기업정보함 반영 실패: ' + ((e && e.message) || e), 5000);
    } finally {
      if (seq === _reqSeq) {
        _state.applyLoading[idx] = false;
        paint();
      }
    }
  }

  function renderChips() {
    var g = _state.integrations || {
      fsc: { configured: true, label: '금융위 기업기본정보' },
      fin: { configured: true, label: '금융위 재무제표' },
      nts: { configured: true, label: '국세청 사업상태' },
      ei: { configured: true, label: '고용·산재 상시인원' },
      nps: { configured: true, label: '국민연금 가입자' },
      dart: { configured: false, label: 'Open DART', hint: 'DART 전자공시 바로가기 지원 (서버 DART_API_KEY 등록 시 자동 공시 조회)' },
      nice: { configured: false, label: 'NICE BizAPI', hint: '연간회원용 파워기업검색 복사·나이스비즈라인 연결 (NICE_BIZAPI_KEY 등록 시 자동 합산)' },
    };
    return Object.keys(g).map(function (k) {
      var x = g[k];
      return '<span class="ps-chip ' + (x.configured ? 'on' : 'off') + '" title="' + esc(x.hint || x.label) + '">'
        + (x.configured ? '● ' : '○ ') + esc(x.label) + '</span>';
    }).join('');
  }

  function renderDetailBlocks(it) {
    var blocks = [];
    if (it.ei) {
      var eiRows = (it.ei.rows || []).slice(0, 4).map(function (r) {
        return '<div class="ps-subrow">· ' + esc(r.nm) + ' (' + (r.fg === 'gy' ? '고용' : '산재') + ' ' + Number(r.cnt || 0) + '명'
          + (r.ind ? ' · ' + esc(r.ind) : '') + (r.since ? ' · 성립 ' + esc(r.since) : '') + ')</div>';
      }).join('');
      blocks.push('<div class="ps-det-box"><b>🏢 고용·산재 상시인원:</b> 고용 ' + Number(it.ei.gy || 0) + '명 · 산재 '
        + Number(it.ei.sj || 0) + '명 (사업장 ' + Number(it.ei.n || 0) + '곳)' + eiRows + '</div>');
    }
    if (it.nps) {
      var npsBody = '';
      if (it.nps.detail) {
        npsBody = '<b>💳 국민연금 가입자:</b> ' + esc(it.nps.detail.nm) + ' · <b>' + Number(it.nps.detail.cnt || 0).toLocaleString() + '명</b>'
          + (it.nps.detail.ym ? ' (' + esc(it.nps.detail.ym) + ' 기준)' : '')
          + (it.nps.detail.ind ? ' · ' + esc(it.nps.detail.ind) : '');
      } else if (it.nps.cands && it.nps.cands.length) {
        npsBody = '<b>💳 국민연금 앞6자리 후보 ' + it.nps.cands.length + '곳:</b> '
          + it.nps.cands.slice(0, 3).map(function (c) { return esc(c.nm) + (c.on ? '' : '(탈퇴)'); }).join(', ');
      } else {
        npsBody = '<b>💳 국민연금:</b> 공개 사업장 정보 없음 (3인 미만 법인·10인 미만 개인사업장은 비공개)';
      }
      blocks.push('<div class="ps-det-box">' + npsBody + '</div>');
    }
    if (Array.isArray(it.fin) && it.fin.length) {
      var finRows = it.fin.map(function (f) {
        return '<tr><td>' + esc(f.year) + '</td><td>' + esc(fmtWon(f.revenue)) + '</td><td>' + esc(fmtWon(f.opProfit))
          + '</td><td>' + esc(fmtWon(f.netIncome)) + '</td><td>' + esc(fmtWon(f.assets)) + '</td><td>' + esc(fmtWon(f.equity)) + '</td></tr>';
      }).join('');
      blocks.push('<div class="ps-det-box"><b>💰 금융위 요약재무제표</b><div class="ps-tbl-wrap"><table class="ps-tbl">'
        + '<thead><tr><th>연도</th><th>매출액</th><th>영업이익</th><th>당기순이익</th><th>자산총계</th><th>자본총계</th></tr></thead>'
        + '<tbody>' + finRows + '</tbody></table></div></div>');
    } else if (it._detailLoaded && it.corpNo) {
      blocks.push('<div class="ps-det-box ps-muted">💰 금융위 요약재무제표: 등록된 재무 자료가 없거나 비외감 법인입니다.</div>');
    }
    if (Array.isArray(it.dart) && it.dart.length) {
      var dRows = it.dart.map(function (d) {
        var link = 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=' + encodeURIComponent(d.rceptNo);
        return '<div class="ps-subrow">· ' + esc(d.rceptDt) + ' <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(d.reportNm) + '</a></div>';
      }).join('');
      blocks.push('<div class="ps-det-box"><b>📑 DART 최근 공시</b>' + dRows + '</div>');
    }
    return blocks.join('');
  }

  function renderCard(it, idx) {
    var ntsHtml = it.nts && it.nts.state
      ? '<span class="ps-tag ' + esc(it.nts.cls || 'dim') + '">' + esc(it.nts.state)
        + (it.nts.endDt ? ' (' + esc(it.nts.endDt) + ')' : '') + '</span>'
      : '';
    var smeHtml = it.sme ? '<span class="ps-tag dim">중소기업</span>' : '';
    var ourHtml = it.ourCard && it.ourCard.exists ? '<span class="ps-tag our">🏢 우리 기업정보함 등록</span>' : '';
    var key = pinKeyOf(it);
    var pinned = _state.pins.some(function (p) { return p && p.key === key; });
    var url = safeHttpUrl(it.homepage);
    var kv = function (k, v, isLink) {
      if (!v) return '';
      var body = isLink && url
        ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(v) + '</a>'
        : esc(v);
      return '<div class="ps-kv"><span class="ps-k">' + esc(k) + '</span><span class="ps-v" title="' + esc(v) + '">' + body + '</span></div>';
    };
    var niceCopy = it.name || it.bizNoFmt || it.bizNo || '';
    var applied = !!_state.applied[idx];
    var applying = !!_state.applyLoading[idx];
    var detLoading = !!_state.detailLoading[idx];
    return '<article class="ps-card">'
      + '<div class="ps-card-top">'
      + '<button type="button" class="ps-pin ' + (pinned ? 'on' : '') + '" data-ps-act="pin" data-ps-idx="' + idx + '" aria-label="' + esc((it.name || '사업장') + (pinned ? ' 즐겨찾기 해제' : ' 즐겨찾기 고정')) + '" aria-pressed="' + (pinned ? 'true' : 'false') + '" title="즐겨찾기 사업장 고정">' + (pinned ? '★' : '☆') + '</button>'
      + '<h3 class="ps-nm">' + esc(it.name || it.bizNoFmt) + '</h3>'
      + ntsHtml + smeHtml + ourHtml
      + '<span class="ps-src">' + esc(it.source || '') + '</span>'
      + '</div>'
      + '<div class="ps-grid">'
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
      + renderDetailBlocks(it)
      + '<div class="ps-acts">'
      + ((it.bizNo || it.corpNo)
        ? '<button type="button" class="ps-btn accent" data-ps-act="detail" data-ps-idx="' + idx + '" ' + (detLoading ? 'disabled' : '') + '>'
          + (detLoading ? '조회 중…' : '📊 재무·고용·연금·DART 상세') + '</button>'
        : '')
      + (it.bizNo
        ? '<button type="button" class="ps-btn ' + (applied ? 'ok' : 'primary') + '" data-ps-act="apply" data-ps-idx="' + idx + '" ' + (applying ? 'disabled' : '') + '>'
          + (applying ? '반영 중…' : (applied ? '✓ 기업정보함 반영됨' : '💾 기업정보함에 반영')) + '</button>'
        : '')
      + '<button type="button" class="ps-btn" data-ps-act="copy" data-ps-val="' + esc(niceCopy) + '">📱 파워기업검색용 복사</button>'
      + '<button type="button" class="ps-btn" data-ps-act="nice" data-ps-val="' + esc(niceCopy) + '">🌐 나이스비즈라인</button>'
      + '<button type="button" class="ps-btn" data-ps-act="dart" data-ps-val="' + esc(it.name || niceCopy) + '">📑 DART 공시</button>'
      + (it.bizNo
        ? '<button type="button" class="ps-btn" data-ps-act="openCards" data-ps-val="' + esc(it.bizNo) + '">📇 기업정보함</button>'
        : '')
      + '</div></article>';
  }

  function renderSide() {
    var isHist = _state.sideTab !== 'pins';
    var listHtml = '';
    if (isHist) {
      if (!_state.history.length) {
        listHtml = '<div class="ps-empty-side">아직 검색 기록이 없습니다.<br>회사명이나 사업자번호를 검색하면 여기에 자동 기록됩니다.</div>';
      } else {
        listHtml = _state.history.map(function (h, i) {
          return '<div class="ps-hrow">'
            + '<button type="button" class="ps-hbtn" data-ps-act="reSearch" data-ps-val="' + esc(h.query) + '">'
            + '<div class="ps-hq">' + esc(h.query) + '</div>'
            + '<div class="ps-hmeta">' + esc(fmtTime(h.at)) + ' · ' + Number(h.count || 0) + '건'
            + (h.topBizNo ? ' · ' + esc(h.topBizNo) : '') + '</div>'
            + '</button>'
            + '<button type="button" class="ps-hdel" data-ps-act="delHist" data-ps-idx="' + i + '" aria-label="기록 삭제" title="기록 삭제">✕</button>'
            + '</div>';
        }).join('');
      }
    } else {
      if (!_state.pins.length) {
        listHtml = '<div class="ps-empty-side">별표(☆)를 눌러 자주 찾는 사업장을 고정해 두세요.</div>';
      } else {
        listHtml = _state.pins.map(function (p, i) {
          return '<div class="ps-hrow">'
            + '<button type="button" class="ps-hbtn" data-ps-act="reSearch" data-ps-val="' + esc(p.bizNo || p.name) + '">'
            + '<div class="ps-hq">★ ' + esc(p.name) + '</div>'
            + '<div class="ps-hmeta">' + esc(p.bizNoFmt || '') + (p.ceo ? ' · ' + esc(p.ceo) : '') + '</div>'
            + '</button>'
            + '<button type="button" class="ps-hdel" data-ps-act="delPin" data-ps-idx="' + i + '" aria-label="고정 해제" title="고정 해제">✕</button>'
            + '</div>';
        }).join('');
      }
    }
    return '<aside class="ps-side">'
      + '<div class="ps-stabs" role="tablist" aria-label="검색 기록 및 즐겨찾기">'
      + '<button type="button" role="tab" aria-selected="' + (isHist ? 'true' : 'false') + '" class="ps-stab ' + (isHist ? 'on' : '') + '" data-ps-act="sideTab" data-ps-val="hist">🕒 최근 검색 (' + _state.history.length + ')</button>'
      + '<button type="button" role="tab" aria-selected="' + (!isHist ? 'true' : 'false') + '" class="ps-stab ' + (!isHist ? 'on' : '') + '" data-ps-act="sideTab" data-ps-val="pins">★ 즐겨찾기 (' + _state.pins.length + ')</button>'
      + '</div>'
      + (isHist && _state.history.length
        ? '<div class="ps-sact"><button type="button" class="ps-linkbtn" data-ps-act="clearHist">기록 전체 비우기</button></div>'
        : '')
      + '<div class="ps-slist">' + listHtml + '</div>'
      + '</aside>';
  }

  function paint() {
    if (!_rootEl) return;
    var mainHtml = '';
    if (_state.error) mainHtml += '<div class="ps-err" role="alert">' + esc(_state.error) + '</div>';
    if (_state.warnings && _state.warnings.length) {
      mainHtml += '<div class="ps-warn" role="alert">' + _state.warnings.map(esc).join('<br>') + '</div>';
    }
    if (_state.loading) {
      mainHtml += '<div class="ps-loading">공공기관 기업정보(금융위·국세청·고용산재·국민연금)를 조회하고 있습니다…</div>';
    } else if (_state.items.length) {
      mainHtml += '<div class="ps-count">검색 결과 <b>' + _state.items.length + '건</b>'
        + ' <span class="ps-muted">· 각 카드의 「📊 재무·고용·연금·DART 상세」를 누르면 재무제표·상시인원·국민연금까지 한 번에 당겨옵니다.</span></div>'
        + _state.items.map(renderCard).join('');
    } else if (_state.query && !_state.error) {
      mainHtml += '<div class="ps-empty">「' + esc(_state.query) + '」에 대한 공공 기업정보가 없습니다.<br>회사명 일부나 사업자번호 10자리로 다시 검색해 보세요.</div>';
    } else {
      mainHtml += '<div class="ps-welcome">'
        + '<h2>사업장 공공정보 통합 검색</h2>'
        + '<p>회사명(예: 샘플기업) 또는 사업자번호 10자리(예: 123-45-67890)를 입력하면 <b>금융위 기업기본정보 · 요약재무제표 · 국세청 사업상태 · 고용산재 상시인원 · 국민연금 · DART 공시</b>를 한 화면에서 바로 확인합니다.</p>'
        + '<ul>'
        + '<li><b>검색 기록 자동 저장:</b> 왼쪽 최근 검색 목록에서 클릭 한 번으로 이전 검색 사업장을 다시 조회할 수 있습니다.</li>'
        + '<li><b>기업정보함 바로 연동:</b> 조회된 기업이 우리 기업정보함에 등록되어 있는지 자동 표시되며, <b>빈 칸만</b> 안전하게 채워 넣을 수 있습니다.</li>'
        + '<li><b>연간회원 파워기업검색 연결:</b> 「📱 파워기업검색용 복사」를 눌러 폰 앱이나 PC 폰 미러(<code>폰미러-켜기.bat</code>) 창에 바로 붙여넣거나, 「🌐 나이스비즈라인」으로 즉시 이동할 수 있습니다.</li>'
        + '</ul></div>';
    }

    _rootEl.innerHTML = ''
      + '<header class="ps-hd">'
      + '<div class="ps-hd-left"><span class="ps-logo">🔍</span><div><h1>공공 기업검색</h1><div class="ps-sub">금융위 · 재무제표 · 국세청 · 고용·산재 · 국민연금 · DART · 나이스 연결</div></div></div>'
      + '<div class="ps-hd-right"><span id="who"></span><a class="ps-navbtn" href="pu-cards.html">📇 기업정보함</a><a class="ps-navbtn" href="enter.html">🏠 포털</a></div>'
      + '</header>'
      + '<section class="ps-searchbar">'
      + '<form id="psForm" class="ps-form">'
      + '<input id="psQueryIn" class="ps-in" type="search" aria-label="회사명 또는 사업자번호 10자리" value="' + esc(_state.query) + '" placeholder="회사명 또는 사업자번호 10자리 입력 (예: 샘플기업, 123-45-67890)" autocomplete="off">'
      + '<button type="submit" class="ps-btn primary ps-submit" ' + (_state.loading ? 'disabled' : '') + '>' + (_state.loading ? '검색 중…' : '🔍 통합 검색') + '</button>'
      + '</form>'
      + '<div class="ps-chips">' + renderChips() + '</div>'
      + '</section>'
      + '<div class="ps-layout">'
      + renderSide()
      + '<main class="ps-main">' + mainHtml + '</main>'
      + '</div>'
      + '<div id="psToast" class="ps-toast" role="status" style="display:' + (_state.toastMsg ? 'block' : 'none') + '">' + esc(_state.toastMsg) + '</div>';

    var form = root.document.getElementById('psForm');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); runSearch(); });
    if (root.PuWhoami && root.document.getElementById('who')) {
      try { root.PuWhoami.mount('#who'); } catch (_) {}
    }
  }

  function bindEvents() {
    if (_bound || !root.document || !root.document.addEventListener) return;
    _bound = true;
    root.document.addEventListener('click', function (ev) {
      var t = ev && ev.target;
      var btn = t && typeof t.closest === 'function' ? t.closest('[data-ps-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-ps-act');
      var val = btn.getAttribute('data-ps-val') || '';
      var idx = Number(btn.getAttribute('data-ps-idx'));
      if (act === 'reSearch') { runSearch(val); }
      else if (act === 'sideTab') { _state.sideTab = val === 'pins' ? 'pins' : 'hist'; paint(); }
      else if (act === 'delHist' && Number.isInteger(idx)) {
        _state.history.splice(idx, 1);
        saveStore(HIST_KEY, _state.history);
        paint();
      } else if (act === 'clearHist') {
        _state.history = [];
        saveStore(HIST_KEY, []);
        paint();
      } else if (act === 'delPin' && Number.isInteger(idx)) {
        _state.pins.splice(idx, 1);
        saveStore(PIN_KEY, _state.pins);
        paint();
      } else if (act === 'pin' && Number.isInteger(idx) && _state.items[idx]) {
        _state.pins = togglePinList(_state.pins, _state.items[idx], PIN_MAX);
        saveStore(PIN_KEY, _state.pins);
        paint();
      } else if (act === 'detail' && Number.isInteger(idx)) { loadFullDetail(idx); }
      else if (act === 'apply' && Number.isInteger(idx)) { applyToCoInfo(idx); }
      else if (act === 'copy') { copyText(val); }
      else if (act === 'nice') { copyText(val, '🌐 「' + val + '」 복사됨 — 나이스비즈라인을 엽니다'); openExternal(NICE_WEB_URL); }
      else if (act === 'dart') { openExternal(DART_SEARCH_BASE + encodeURIComponent(val)); }
      else if (act === 'openCards') {
        try { root.open('pu-cards.html?q=' + encodeURIComponent(val), '_blank', 'noopener'); } catch (_) {}
      }
    });
  }

  function mount(el) {
    _rootEl = el;
    bindEvents();
    paint();
  }

  function setAuthUser(u) {
    var nextUid = u && u.uid ? String(u.uid) : '';
    if (!nextUid) {
      _reqSeq++;
      _state.user = null;
      _state.uid = '';
      _state.query = '';
      _state.loading = false;
      _state.error = '';
      _state.warnings = [];
      _state.items = [];
      _state.history = [];
      _state.pins = [];
      _state.applied = {};
      _state.applyLoading = {};
      _state.detailLoading = {};
      paint();
      return;
    }
    var changed = _state.uid !== nextUid;
    _state.user = u;
    _state.uid = nextUid;
    if (changed) {
      _state.history = loadStore(HIST_KEY);
      _state.pins = loadStore(PIN_KEY);
      paint();
      try {
        var q = new URLSearchParams(root.location.search).get('q');
        if (q && q.trim() && !_state.query) runSearch(q.trim());
      } catch (_) {}
    }
  }

  var api = {
    FN_URL: FN_URL,
    HIST_KEY: HIST_KEY,
    PIN_KEY: PIN_KEY,
    fmtWon: fmtWon,
    pushHistoryList: pushHistoryList,
    togglePinList: togglePinList,
    buildCoInfoPatch: buildCoInfoPatch,
    mount: mount,
    setAuthUser: setAuthUser,
    runSearch: runSearch,
  };

  root.PuPubSearchApp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
