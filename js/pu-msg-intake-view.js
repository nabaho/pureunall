/* 푸른통합시스템 — 카카오톡 · 문자 컨설팅 자료수집 허브 (pu-msg-intake.html)
 * (브라우저 window.PuMsgIntakeView)
 *
 * 4개 탭:
 *   1. input    : 카톡 대화(.txt) 드래그 · 카톡/문자 붙여넣기 → 실시간 비식별 & 18개 사업 자동분류
 *   2. queue    : 수집·자동분류 대기함 (대상 사업 조정 · 각 컨설팅 앱으로 1클릭 배정 · 보관삭제)
 *   3. channels : 메일함(IMAP+POP3)·사내 카톡방·안드로이드 문자 통합 연동 현황
 *   4. bridge   : PC 카톡·휴대폰 문자 자동 전송(consultMsgIngest 웹훅) 연동 안내
 */
(function (global) {
  'use strict';

  var SESSION_EPOCH = 0;
  var fb = null;
  var fbDb = null;
  var ME = null;
  var gate = null;
  var PREVIEW_MODE = false;
  var DIFF_HIGHLIGHT = true;
  var CUR_TAB = 'input';
  var LAST_PREVIEW_PARSED = null;

  var D = {
    items: {},
    companies: []
  };
  var SEL = Object.create(null);

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssEsc(v) {
    var s = String(v == null ? '' : v);
    if (global.CSS && typeof global.CSS.escape === 'function') return global.CSS.escape(s);
    return s.replace(/["\\\]\[]/g, '\\$&');
  }
  function Cat() { return global.PuConsultCatalogs; }
  function Intake() { return global.PuConsultIntake; }
  function cleanText(raw) {
    var I = Intake();
    return I ? I.sanitizeText(str(raw)) : str(raw);
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = str(msg);
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function isLocalPreviewAllowed() {
    if (typeof location === 'undefined') return false;
    var h = str(location.hostname).toLowerCase();
    var isLocal = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
    if (!isLocal) return false;
    var sp = new URLSearchParams(location.search || '');
    return sp.get('preview') === '1' || sp.get('demo') === '1';
  }
  function appNameOf(key) {
    var C = Cat();
    var found = C && C.get(key);
    return found ? (found.icon + ' ' + found.name) : str(key || '미지정');
  }
  function allAppChoices() {
    var C = Cat();
    return C ? C.listAll() : [];
  }
  function itemsList() {
    return Object.keys(D.items || {}).map(function (k) {
      return Object.assign({ id: k }, D.items[k]);
    }).filter(function (it) { return it && !it._deleted; })
      .sort(function (a, b) { return (num(b.updatedAt, 0) - num(a.updatedAt, 0)) || str(b.msgDate).localeCompare(str(a.msgDate)); });
  }

  function wrapSnapGuard(rawGate) {
    if (!rawGate || typeof rawGate.save !== 'function') return rawGate;
    return {
      mode: rawGate.mode,
      save: function (ref, rec, ctx) {
        return rawGate.save(ref, rec, Object.assign({ allowPendingCompany: true }, ctx || {}));
      },
      remove: function (ref, prev, ctx) {
        return rawGate.remove(ref, prev, ctx || {});
      }
    };
  }

  async function ingestViaServerIfPossible(rec) {
    if (!fb || !fb.auth || !fb.auth().currentUser || typeof fetch !== 'function') return null;
    try {
      var tok = await fb.auth().currentUser.getIdToken();
      var resp = await fetch('https://asia-southeast1-pureun-erp.cloudfunctions.net/consultMsgIngest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({
          channel: str(rec.channel || 'kakao_export'),
          title: str(rec.title),
          text: str(rec.maskedBody || rec.summary),
          msgDate: str(rec.msgDate),
          attNames: Array.isArray(rec.attNames) ? rec.attNames : []
        })
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (_) { return null; }
  }

  async function saveMsgItem(id, rec) {
    var I = Intake();
    if (I && I.isSecretMessage(str(rec.title) + '\n' + str(rec.maskedBody || rec.summary))) {
      throw new Error('인증번호·OTP 포함 메시지는 저장할 수 없습니다.');
    }
    var safeTitle = cleanText(cleanText(rec.title));
    var safeBody = cleanText(cleanText(rec.maskedBody || rec.summary));
    var doc = Object.assign({ id: id, entityType: 'Document', schemaVersion: 1, contractVersion: 1 }, rec, {
      title: safeTitle,
      maskedBody: safeBody,
      summary: safeBody.slice(0, 240),
      createdBy: str(rec.createdBy || (ME && ME.uid) || 'bridge')
    });
    if (PREVIEW_MODE || !fbDb || !gate) {
      doc.updatedAt = Date.now();
      doc.createdAt = doc.createdAt || doc.updatedAt;
      doc.revision = num(doc.revision, 0) + 1;
      D.items[id] = doc;
      return doc;
    }
    if (!num(rec.revision, 0)) {
      var srvRes = await ingestViaServerIfPossible(doc);
      if (srvRes && srvRes.ok && srvRes.id) {
        var srvSnap = await safeVal('msg_intake/items/' + srvRes.id);
        if (srvSnap) { D.items[srvRes.id] = srvSnap; return srvSnap; }
      }
    }
    var ref = fbDb.ref('msg_intake/items/' + id);
    var res = await gate.save(ref, doc, { entityType: 'Document', expectedRevision: num(doc.revision, 0), allowPendingCompany: true });
    var saved = (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : doc;
    D.items[id] = saved;
    return saved;
  }

  async function softDeleteMsgItem(it) {
    if (!it || !it.id) return;
    if (PREVIEW_MODE || !fbDb || !gate) {
      D.items[it.id] = Object.assign({}, it, { _deleted: true, deletedAt: Date.now() });
      return;
    }
    var ref = fbDb.ref('msg_intake/items/' + it.id);
    await gate.remove(ref, it, { entityType: 'Document' });
    D.items[it.id] = Object.assign({}, it, { _deleted: true });
  }

  async function assignToAppWorkspace(it, targetAppKey) {
    var updated = Object.assign({}, it, { targetApp: targetAppKey, status: 'assigned' });
    await saveMsgItem(it.id, updated);
    if (!PREVIEW_MODE && fbDb && gate) {
      var cat = Cat() && Cat().get(targetAppKey);
      if (cat && cat.rtdbRoot && cat.rtdbRoot.indexOf('scal_') === 0) {
        var cid = 'cm_mi_' + it.id;
        var pid = 'inbox_msg';
        var commDoc = {
          id: cid, projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
          source: str(it.channel || 'msg_intake'),
          date: str(it.msgDate || ''),
          subject: cleanText(it.title || '카톡·문자 수취자료'),
          maskedPreview: cleanText(it.maskedBody || it.summary || ''),
          atts: Array.isArray(it.attNames) ? it.attNames : []
        };
        await gate.save(fbDb.ref(cat.rtdbRoot + '/comms/' + pid + '/' + cid), commDoc, { entityType: 'Document', allowPendingCompany: true });
      }
    }
  }

  function buildPreviewData() {
    var now = Date.now();
    D.items = {
      mi_pv_1: {
        id: 'mi_pv_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 7200e3, updatedAt: now - 3600e3,
        channel: 'kakao_export', msgDate: '2026-11-28',
        title: '[카톡:(주)푸른농원] 6차산업 현장코칭 농촌융복합 체크리스트 문의',
        maskedBody: '[담당자] 6차산업 현장코칭 인증 사전질의표.xlsx 와 계절근로 출근부 양식 검토 부탁드립니다. 연락처 010-0000-[가림]',
        summary: '6차산업 현장코칭 인증 사전질의표 및 계절근로 출근부 검토 요청',
        attNames: ['현장코칭_사전질의표.xlsx'],
        targetApp: 'sixthind', targetApps: ['sixthind', 'hrconsult'],
        matchedReasons: ['키워드: 6차산업 · 현장코칭 · 농촌융복합'],
        status: 'pending'
      },
      mi_pv_2: {
        id: 'mi_pv_2', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5, updatedAt: now - 43200e3,
        channel: 'sms_paste', msgDate: '2026-11-27',
        title: '[문자] 기술보호지원반 입사자 비밀유지서약서 및 직무발명 검토 요청',
        maskedBody: '대중소협력재단 통합 기술보호지원반 현장 방문 관련 입사 서약서 보완본 송부드립니다.',
        summary: '기술보호지원반 비밀유지서약서 및 직무발명 검토 요청',
        attNames: ['비밀유지서약서_초안.hwpx'],
        targetApp: 'techprotect', targetApps: ['techprotect'],
        matchedReasons: ['키워드: 기술보호지원반 · 비밀유지서약 · 직무발명'],
        status: 'assigned'
      }
    };
  }

  function safeVal(path) {
    if (!fbDb) return Promise.resolve(null);
    return fbDb.ref(path).once('value').then(function (s) { return s ? s.val() : null; }).catch(function () { return null; });
  }

  async function reload(epoch, uid) {
    if (PREVIEW_MODE) {
      buildPreviewData();
      draw();
      return;
    }
    if (!fbDb) return;
    if ($('syncStateChip')) { $('syncStateChip').style.display = ''; $('syncStateChip').textContent = '동기화 중…'; }
    var res = await Promise.all([
      safeVal('msg_intake/items'),
      safeVal('data/companies')
    ]);
    if (epoch !== SESSION_EPOCH || (ME && ME.uid !== uid)) return;
    D.items = res[0] || {};
    var co = res[1] && res[1].v !== undefined ? res[1].v : res[1];
    D.companies = Array.isArray(co) ? co : (co && typeof co === 'object' ? Object.values(co) : []);
    if ($('syncStateChip')) $('syncStateChip').textContent = '최신 동기화 완료';
    draw();
  }

  function renderRecentDiffBar() {
    var el = $('recentDiffBarWrap');
    if (!el) return;
    el.innerHTML = '<div id="recent-diff-bar" class="note ' + (DIFF_HIGHLIGHT ? 'code-diff-box' : '') + '" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<span class="chip c-blue">변경됨 · NEW</span>' +
      '<b>💬 카톡·문자 자료수집 허브 신규 구축:</b>' +
      '<span class="hint">카톡 대화 내보내기(.txt)·문자 붙여넣기·휴대폰 웹훅(consultMsgIngest)을 2중 비식별화해 18개 사업 앱으로 자동 배정합니다.</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-diff-tab="input">카톡·문자 즉시분류</button>' +
      '<button type="button" class="sm pri" data-diff-tab="queue">자동배정 대기함</button>' +
      '<button type="button" class="sm" data-diff-tab="bridge">폰·PC 연동규격</button>' +
      '<button type="button" class="sm" id="toggleDiffBtn">' + (DIFF_HIGHLIGHT ? '변경 강조 끄기' : '변경 강조 켜기') + '</button>' +
      '</div>';
    el.querySelectorAll('[data-diff-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-diff-tab')); };
    });
    if ($('toggleDiffBtn')) $('toggleDiffBtn').onclick = function () { DIFF_HIGHLIGHT = !DIFF_HIGHLIGHT; draw(); };
  }

  function renderKpis() {
    var box = $('kpiRow');
    if (!box) return;
    var list = itemsList();
    var pending = list.filter(function (x) { return x.status !== 'assigned'; }).length;
    var assigned = list.filter(function (x) { return x.status === 'assigned'; }).length;
    var kk = list.filter(function (x) { return str(x.channel).indexOf('kakao') >= 0; }).length;
    var sms = list.filter(function (x) { return str(x.channel).indexOf('sms') >= 0 || str(x.channel).indexOf('mobile') >= 0; }).length;
    box.innerHTML =
      '<div class="kpi k-blue"><span>수집된 톡·문자 전체</span><b>' + list.length + '건</b></div>' +
      '<div class="kpi k-amber"><span>배정 대기</span><b>' + pending + '건</b></div>' +
      '<div class="kpi k-green"><span>사업앱 배정완료</span><b>' + assigned + '건</b></div>' +
      '<div class="kpi"><span>카카오톡 유입</span><b>' + kk + '건</b></div>' +
      '<div class="kpi"><span>문자(SMS) 유입</span><b>' + sms + '건</b></div>';
  }

  function runLocalParsePreview() {
    var I = Intake();
    if (!I) return;
    var raw = str($('rawMsgInput') && $('rawMsgInput').value);
    var room = str($('roomNameInput') && $('roomNameInput').value);
    var ch = ($('msgChannelSel') && $('msgChannelSel').value) || 'kakao_export';
    if (!raw) { toast('카톡 대화나 문자 내용을 먼저 입력하거나 .txt 파일을 올려주세요.'); return; }
    var res = ch === 'kakao_export'
      ? I.parseKakaoExport(raw, { roomName: room })
      : I.parseSmsPaste(raw, { channel: ch });
    LAST_PREVIEW_PARSED = res;
    renderParsePreviewResult();
  }

  function renderParsePreviewResult() {
    var box = $('parsePreviewBox');
    if (!box) return;
    if (!LAST_PREVIEW_PARSED) {
      box.innerHTML = '<div class="empty">위 입력창에 카톡 대화 내보내기(.txt)나 문자를 넣고 [비식별·자동분류 미리보기]를 누르면 결과가 여기에 표시됩니다.</div>';
      return;
    }
    var items = LAST_PREVIEW_PARSED.items || [];
    var blocked = num(LAST_PREVIEW_PARSED.blockedCount, 0);
    if (!items.length) {
      box.innerHTML = '<div class="warn">추출된 업무 항목이 없습니다.' + (blocked ? ' (인증번호·OTP 등 민감 메시지 ' + blocked + '건 자동 차단됨)' : '') + '</div>';
      return;
    }
    var trs = items.map(function (it, idx) {
      return '<tr>' +
        '<td class="c"><input type="checkbox" data-ck="pv:' + idx + '" data-list="pv" checked aria-label="항목 선택"></td>' +
        '<td class="n">' + (idx + 1) + '</td>' +
        '<td class="ti" title="' + esc(it.title) + '">' + esc(it.title) + '</td>' +
        '<td data-k="badge" title="' + esc(appNameOf(it.targetApp)) + '"><span class="chip c-blue">' + esc(appNameOf(it.targetApp)) + '</span></td>' +
        '<td title="' + esc(it.msgDate) + '">' + esc(it.msgDate) + '</td>' +
        '<td class="wide" title="' + esc(it.maskedBody) + '">' + esc(it.maskedBody) + '</td>' +
        '<td data-k="act"><span class="chip">' + esc((it.matchedReasons || []).join(', ')) + '</span></td>' +
      '</tr>';
    }).join('');
    box.innerHTML =
      (blocked ? '<div class="warn">인증번호·OTP·비밀번호 포함 메시지 ' + blocked + '건은 보안 원칙에 따라 자동 제외되었습니다.</div>' : '') +
      '<div class="bar"><button type="button" class="ok" id="saveParsedItemsBtn">미리보기 ' + items.length + '건 수집함에 저장</button></div>' +
      '<div class="scroll"><table class="t" data-name="pv"><thead><tr><th class="c"><input type="checkbox" data-ckall="pv" checked aria-label="전체"></th><th class="n">№</th><th>제목(비식별)</th><th>자동분류 사업</th><th>일자</th><th class="wide">비식별 본문</th><th data-k="act">분류 근거</th></tr></thead><tbody>' + trs + '</tbody></table></div>';

    if ($('saveParsedItemsBtn')) {
      $('saveParsedItemsBtn').onclick = async function () {
        var btn = $('saveParsedItemsBtn');
        if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
        var count = 0;
        try {
          for (var i = 0; i < items.length; i++) {
            var cb = box.querySelector('[data-ck="pv:' + i + '"]');
            if (cb && !cb.checked) continue;
            await saveMsgItem(items[i].id, items[i]);
            count++;
          }
          toast(count + '건을 수집 대기함에 저장했습니다.');
          switchTab('queue');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = '미리보기 ' + items.length + '건 수집함에 저장'; }
          toast('저장 오류: ' + (err && err.message || err));
        }
      };
    }
  }

  function renderInputTab() {
    renderParsePreviewResult();
  }

  function renderQueueTab() {
    var box = $('queueBox');
    if (!box) return;
    var q = str($('queueSearch') && $('queueSearch').value).toLowerCase();
    var apps = allAppChoices();
    var list = itemsList().filter(function (it) {
      if (!q) return true;
      return (str(it.title) + ' ' + str(it.maskedBody) + ' ' + appNameOf(it.targetApp)).toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      box.innerHTML = '<div class="empty">수집된 카톡·문자 항목이 없습니다. ① [카톡·문자 입력/미리보기] 탭에서 자료를 올려보세요.</div>';
      return;
    }
    var trs = list.map(function (it, idx) {
      var optHtml = apps.map(function (a) {
        return '<option value="' + esc(a.key) + '"' + (a.key === it.targetApp ? ' selected' : '') + '>' + esc(a.icon + ' ' + a.name) + '</option>';
      }).join('');
      var statusChip = it.status === 'assigned'
        ? '<span class="chip c-green">배정완료</span>'
        : '<span class="chip c-amber">대기</span>';
      return '<tr>' +
        '<td class="c"><input type="checkbox" data-ck="q:' + esc(it.id) + '" data-list="q"' + (SEL['q:' + it.id] ? ' checked' : '') + ' aria-label="항목 선택"></td>' +
        '<td class="n">' + (idx + 1) + '</td>' +
        '<td class="ti" title="' + esc(it.title) + '">' + esc(it.title) + '</td>' +
        '<td data-k="badge" title="' + esc(it.channel) + '">' + statusChip + ' <span class="chip">' + esc(it.channel) + '</span></td>' +
        '<td title="' + esc(it.msgDate) + '">' + esc(it.msgDate) + '</td>' +
        '<td class="wide" title="' + esc(it.maskedBody) + '">' + esc(it.maskedBody) + '</td>' +
        '<td data-k="act">' +
          '<select data-assign-sel="' + esc(it.id) + '" aria-label="대상 사업">' + optHtml + '</select>' +
          '<button type="button" class="sm pri" data-assign-btn="' + esc(it.id) + '">앱 배정</button>' +
          '<button type="button" class="sm danger" data-del-msg="' + esc(it.id) + '">보관삭제</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    box.innerHTML = '<div class="scroll"><table class="t" data-name="q"><thead><tr><th class="c"><input type="checkbox" data-ckall="q" aria-label="전체"></th><th class="n">№</th><th>제목 · 방명</th><th>상태 · 채널</th><th>일자</th><th class="wide">비식별 요약</th><th data-k="act">배정 · 관리</th></tr></thead><tbody>' + trs + '</tbody></table></div>';

    box.querySelectorAll('[data-assign-btn]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-assign-btn');
        var it = D.items[id];
        var sel = box.querySelector('[data-assign-sel="' + cssEsc(id) + '"]');
        var appKey = sel ? sel.value : it.targetApp;
        b.disabled = true;
        try {
          await assignToAppWorkspace(it, appKey);
          draw();
          toast(appNameOf(appKey) + ' 으로 배정했습니다.');
        } catch (err) {
          b.disabled = false;
          toast('배정 오류: ' + (err && err.message || err));
        }
      };
    });
    box.querySelectorAll('[data-del-msg]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-del-msg');
        await softDeleteMsgItem(D.items[id]);
        draw();
        toast('보관삭제(_deleted) 처리했습니다.');
      };
    });
  }

  function renderChannelsTab() {
    var box = $('channelsBox');
    if (!box) return;
    box.innerHTML =
      '<div class="guide-grid">' +
        '<div class="ind-card">' +
          '<div class="ind-hd"><b>📧 푸른메일함 (IMAP + POP3) 통합 연동</b><span class="chip c-green">자동 동작</span></div>' +
          '<div style="font-size:12.5px;color:var(--ink2);line-height:1.6">각 컨설팅 전용 앱 상단 [메일·카톡 재스캔]을 누르면 푸른메일함 <code>mailbox/msgs</code>(IMAP)와 <code>mailbox/old/msgs</code>(POP3 2.3만여 통)를 동시에 검색하여 해당 사업의 미등록 후보 묶음을 즉시 찾아냅니다.</div>' +
        '</div>' +
        '<div class="ind-card">' +
          '<div class="ind-hd"><b>💬 사내 카톡방 · 안드로이드 하나문자 연결</b><span class="chip c-blue">서버 보안 분리</span></div>' +
          '<div style="font-size:12.5px;color:var(--ink2);line-height:1.6">사내 카톡방(<code>kakaoWork</code>) 및 휴대폰 하나문자(<code>hanaSmsBridge</code>) 원문은 서버 전용 권한(<code>kakaoList</code>)으로 보호됩니다. 컨설팅 업무 관련 카톡방 대화나 문자는 PC 대화 내보내기(.txt) 업로드 또는 <code>consultMsgIngest</code> 웹훅으로 2중 비식별 처리 후 <code>msg_intake</code>로 들어옵니다.</div>' +
        '</div>' +
      '</div>';
  }

  function renderBridgeTab() {
    var box = $('bridgeBox');
    if (!box) return;
    var samplePayload = JSON.stringify({
      channel: 'android_sms_bridge',
      title: '6차산업 현장코칭 사전질의 회신',
      text: '농업회사법인 OO 현장 방문 일정 확인 요청드립니다.',
      attNames: ['사전질의표.xlsx']
    }, null, 2);
    box.innerHTML =
      '<div class="card">' +
        '<div class="sec"><span>📱 안드로이드 · PC 자동수집 웹훅 규격 (consultMsgIngest)</span><span class="chip c-blue">인증 필수</span></div>' +
        '<div class="bar" style="flex-direction:column;align-items:stretch">' +
          '<div class="note"><b>엔트리포인트:</b> <code>POST https://asia-southeast1-pureun-erp.cloudfunctions.net/consultMsgIngest</code><br><b>인증 헤더:</b> <code>Authorization: Bearer &lt;Firebase ID Token&gt;</code> 또는 <code>Authorization: Device &lt;하나문자 기기 토큰&gt;</code> (미인증 요청 401/403 차단)</div>' +
          '<pre style="padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);overflow:auto;font-size:12px">' + esc(samplePayload) + '</pre>' +
          '<div class="hint">• PC 카카오톡에서는 대화방 [메뉴 → 대화 내용 내보내기(.txt)] 후 ① 탭 드롭존에 끌어다 놓으면 날짜·발신자별 스레드가 자동 분해·비식별화됩니다.<br>• 휴대폰에서는 푸른 웹앱을 홈화면에 추가하거나 Tasker/MacroDroid HTTP Request로 위 URL을 호출해 문자·알림을 자동 전달할 수 있습니다.</div>' +
        '</div>' +
      '</div>';
  }

  function switchTab(t) {
    CUR_TAB = t || 'input';
    document.querySelectorAll('.tabs button[data-t]').forEach(function (b) {
      var on = b.getAttribute('data-t') === CUR_TAB;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('main section.pane').forEach(function (sec) {
      sec.classList.toggle('on', sec.id === 'p-' + CUR_TAB);
    });
    draw();
  }

  function draw() {
    renderRecentDiffBar();
    renderKpis();
    if (CUR_TAB === 'input') renderInputTab();
    else if (CUR_TAB === 'queue') renderQueueTab();
    else if (CUR_TAB === 'channels') renderChannelsTab();
    else if (CUR_TAB === 'bridge') renderBridgeTab();
  }

  function bindEvents() {
    document.querySelectorAll('.tabs button[data-t]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-t')); };
    });
    if ($('parsePreviewBtn')) $('parsePreviewBtn').onclick = runLocalParsePreview;
    if ($('queueSearch')) $('queueSearch').oninput = function () { if (CUR_TAB === 'queue') renderQueueTab(); };
    if ($('reloadBtn')) $('reloadBtn').onclick = function () { reload(SESSION_EPOCH, ME && ME.uid); };
    if ($('outBtn')) $('outBtn').onclick = function () { if (fb && fb.auth) fb.auth().signOut(); };
    if ($('kakaoTxtDropZone') && $('kakaoTxtFileInput')) {
      $('kakaoTxtDropZone').onclick = function () { $('kakaoTxtFileInput').click(); };
      $('kakaoTxtDropZone').onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('kakaoTxtFileInput').click(); }
      };
      $('kakaoTxtDropZone').ondragover = function (e) { e.preventDefault(); };
      $('kakaoTxtDropZone').ondrop = async function (e) {
        e.preventDefault();
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        $('rawMsgInput').value = await f.text();
        $('msgChannelSel').value = 'kakao_export';
        runLocalParsePreview();
      };
      $('kakaoTxtFileInput').onchange = async function (e) {
        var f = e.target && e.target.files && e.target.files[0];
        if (!f) return;
        $('rawMsgInput').value = await f.text();
        $('msgChannelSel').value = 'kakao_export';
        runLocalParsePreview();
      };
    }
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'checkbox') return;
      var allList = t.getAttribute('data-ckall');
      if (allList) {
        document.querySelectorAll('input[type="checkbox"][data-list="' + allList + '"]').forEach(function (cb) {
          cb.checked = t.checked;
          var k = cb.getAttribute('data-ck');
          if (k) SEL[k] = t.checked;
        });
        return;
      }
      var k = t.getAttribute('data-ck');
      if (k) SEL[k] = t.checked;
    });
  }

  function lockScreen(why) {
    if ($('app')) $('app').style.display = 'none';
    if ($('lock')) $('lock').style.display = 'block';
    if ($('lockWhy')) $('lockWhy').textContent = why || '';
  }

  function boot(firebaseInstance) {
    fb = firebaseInstance;
    fbDb = fb && fb.database ? fb.database() : null;
    bindEvents();
    if (isLocalPreviewAllowed()) {
      PREVIEW_MODE = true;
      ME = { uid: 'preview', sid: 'P000', name: '점검미리보기' };
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      if ($('who')) $('who').textContent = '미리보기 모드(읽기전용)';
      reload(++SESSION_EPOCH, 'preview');
      return;
    }
    if (!fb || !fb.auth) { lockScreen('Firebase 인증을 초기화할 수 없습니다.'); return; }
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (e) {}
    fb.auth().onAuthStateChanged(async function (u) {
      var authUid = (u && u.uid) ? String(u.uid) : '';
      if ($('outBtn')) $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) { if (global.PuGate) global.PuGate.show(); return; }
      var epoch = ++SESSION_EPOCH;
      if (global.PuGate) global.PuGate.hide();
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (epoch !== SESSION_EPOCH) return;
      if (roleVal.status !== 'active' || !roleVal.sid) { lockScreen('재직 중인 직원 계정이 아닙니다.'); return; }
      ME = { uid: authUid, sid: String(roleVal.sid), name: String(roleVal.name || '') };
      gate = wrapSnapGuard(global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid }));
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      await reload(epoch, authUid);
    });
  }

  global.PuMsgIntakeView = { boot: boot, reload: reload, switchTab: switchTab };
})(typeof window !== 'undefined' ? window : globalThis);
