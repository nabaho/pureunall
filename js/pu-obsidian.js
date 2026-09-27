/* 푸른이알피 진행 업무를 옵시디언용 Markdown으로 자동 정리한다.
   주민번호·계좌·연락처·첨부·본문은 읽지 않고 업무 마스터의 경량 필드만 쓴다. */
(function (w, d) {
  'use strict';
  if (w.PuObsidian) return;

  var MAX = 4000;
  var STORE_DEF = [
    ['contracts', '계약'], ['cases', '사건'], ['consultings', '컨설팅'],
    ['funds', '기금'], ['other_projects', '기타사업'], ['companies', '자문']
  ];
  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, MAX);
  }
  function esc(v) { return clean(v).replace(/[|<>]/g, ' '); }
  function yaml(v) { return esc(v).replace(/[\n:#\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function day() {
    var now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }
  function arrayOf(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (!v || typeof v !== 'object') return [];
    return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return x && typeof x === 'object'; });
  }
  function readStore(key) {
    try { if (typeof w.dbGet === 'function') return arrayOf(w.dbGet(key, [])); } catch (_) {}
    try { return arrayOf(JSON.parse(w.localStorage.getItem('pureun_v6_' + key) || '[]')); } catch (_) { return []; }
  }
  function isClosed(x) {
    if (!x) return true;
    if (x._deleted || x.deletedAt || x.closedDate || x.closedAt || x.closeDate || x.completedAt) return true;
    return /종료|완료|해지|폐기|closed|done|cancel/i.test(String(x.status || x.state || ''));
  }
  function dueOf(x) {
    var dates = arrayOf(x.deadlines).map(function (z) { return z && z.date; }).filter(Boolean).sort();
    var future = dates.filter(function (z) { return z >= day(); });
    return clean(future[0] || dates[dates.length - 1] || x.due || x.dueDate || x.contractEndDate || x.endDate || '');
  }
  function mine(x, sid) {
    if (!sid) return false;
    var one = [x.managerMain, x.managerSid, x.assigneeSid, x.manager, x.ownerSid].filter(Boolean).map(String);
    var many = arrayOf(x.managerSubs || x.assignees || x.managers).map(String);
    return one.concat(many).indexOf(String(sid)) >= 0;
  }
  function taskOf(x, label, users) {
    var managerSid = clean(x.managerMain || x.managerSid || x.assigneeSid || x.manager || '');
    var company = clean(label === '자문' ? (x.name || x.companyName) : (x.companyName || x.company || x.fundName || x.targetName));
    var kind = clean(x.typeName || x.contractType || x.caseType || x.consultingType || x.fundType || x.programName || label);
    return {
      id: clean(x.id || x.no || x.contractNo || x.caseNo), label: label,
      company: company, kind: kind,
      title: clean(x.title || x.caseName || x.projectName || x.programName || kind),
      summary: clean(x.brief || x.summary || x.scope), due: dueOf(x),
      assignee: clean(users[managerSid] || managerSid),
      url: clean(w.location && w.location.href)
    };
  }
  function collect() {
    var me = w.CURRENT_USER || {};
    var users = {};
    readStore('user_accounts').forEach(function (u) { if (u && u.sid) users[String(u.sid)] = clean(u.name || u.sid); });
    var all = [], counts = {};
    STORE_DEF.forEach(function (def) {
      var live = readStore(def[0]).filter(function (x) { return !isClosed(x); });
      counts[def[1]] = live.length;
      live.filter(function (x) { return mine(x, me.sid); }).forEach(function (x) { all.push(taskOf(x, def[1], users)); });
    });
    all.sort(function (a, b) {
      var ad = a.due || '9999-99-99', bd = b.due || '9999-99-99';
      return ad < bd ? -1 : ad > bd ? 1 : (a.company || a.title).localeCompare(b.company || b.title, 'ko');
    });
    return { owner: clean(me.name || users[me.sid] || ''), sid: clean(me.sid), tasks: all, counts: counts };
  }
  function autoSummary(data) {
    var tasks = (data && data.tasks) || [];
    if (!tasks.length) return '현재 로그인 담당자로 연결된 진행 업무를 찾지 못했습니다. ERP의 담당자 지정을 확인해 주세요.';
    var next = tasks.filter(function (t) { return t.due; }).slice().sort(function (a, b) { return a.due.localeCompare(b.due); })[0];
    var kinds = {};
    tasks.forEach(function (t) { kinds[t.label] = (kinds[t.label] || 0) + 1; });
    var mix = Object.keys(kinds).map(function (k) { return k + ' ' + kinds[k] + '건'; }).join(' · ');
    return '진행 업무 ' + tasks.length + '건(' + mix + ')입니다.' + (next ? ' 가장 가까운 기한은 ' + next.due + '의 ' + (next.company || next.title) + ' 업무입니다.' : ' 등록된 기한이 없어 우선순위를 확인해야 합니다.');
  }
  function note(fields) {
    fields = fields || {};
    var data = fields.data || collect();
    var today = day();
    var title = esc(fields.title) || today + ' ' + (esc(data.owner) || '담당자') + ' ERP 업무 요약';
    var tasks = data.tasks || [];
    var body = [
      '---', 'source: 푸른이알피', 'created: ' + today, 'updated: ' + today,
      'status: ' + (yaml(fields.status) || '자동 생성 · 검토 전'),
      'owner: ' + (yaml(data.owner) || '미지정'), 'task_count: ' + tasks.length,
      'tags:', '  - 푸른이알피', '  - 업무요약', '---', '', '# ' + title, '',
      '## 오늘의 핵심', '', esc(fields.summary) || autoSummary(data), '',
      '## 진행 업무', ''
    ];
    if (!tasks.length) body.push('- 담당 업무 없음 또는 담당자 연결 필요', '');
    tasks.slice(0, 30).forEach(function (t) {
      var heading = t.company ? '[[' + esc(t.company).replace(/[\[\]]/g, '') + ']]' : (esc(t.title) || '이름 없는 업무');
      body.push('### ' + heading + ' · ' + esc(t.label),
        '- 업무: ' + (esc(t.summary || t.title || t.kind) || '내용 확인 필요'),
        '- 담당: ' + (esc(t.assignee || data.owner) || '미지정'),
        '- 기한: ' + (esc(t.due) || '미지정'),
        '- 구분: ' + (esc(t.kind || t.label) || '미지정'),
        '- [ ] 다음 조치 확인', '');
    });
    if (tasks.length > 30) body.push('> 나머지 ' + (tasks.length - 30) + '건은 ERP에서 확인하세요.', '');
    body.push('## 원본', '', '- [푸른이알피 열기](' + (esc(fields.url) || esc(w.location && w.location.href)) + ')', '',
      '> ERP의 경량 업무 정보로 자동 생성했습니다. 주민번호·계좌·연락처·첨부파일·문서 본문은 포함하지 않습니다.');
    return { title: title, file: '푸른업무/' + title + '.md', body: body.join('\n'), count: tasks.length };
  }
  function openNote(fields) {
    var n = note(fields);
    var uri = 'obsidian://new?file=' + encodeURIComponent(n.file) + '&content=' + encodeURIComponent(n.body) + '&overwrite=true';
    var a = d.createElement('a');
    a.href = uri; a.rel = 'noopener'; a.style.display = 'none';
    d.body.appendChild(a); a.click(); a.remove();
    return n;
  }
  function copy(text) {
    if (w.navigator.clipboard && w.navigator.clipboard.writeText) return w.navigator.clipboard.writeText(text);
    var ta = d.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    d.body.appendChild(ta); ta.select(); d.execCommand('copy'); ta.remove(); return Promise.resolve();
  }
  function show() {
    if (d.getElementById('pu-obsidian-modal')) return;
    var data = collect();
    var shade = d.createElement('div'); shade.id = 'pu-obsidian-modal';
    shade.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;';
    var box = d.createElement('div'); box.style.cssText = 'background:#fff;border-radius:12px;width:min(620px,100%);max-height:90vh;overflow:auto;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.28);font-family:system-ui,sans-serif;';
    box.innerHTML = '<h2 style="margin:0 0 4px">🪨 옵시디언 자동 업무요약</h2>'
      + '<p style="font-size:12px;color:#64748b;margin:0 0 10px">ERP에서 <b>' + data.tasks.length + '건</b>을 자동으로 불러왔습니다. 민감정보와 첨부는 읽지 않습니다.</p>'
      + '<label style="display:block;font-size:12px;color:#475569">자동 요약 미리보기</label>'
      + '<textarea name="summary" rows="5" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:7px"></textarea>';
    box.querySelector('[name="summary"]').value = autoSummary(data);
    var actions = d.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px;';
    var cancel = d.createElement('button'); cancel.type = 'button'; cancel.textContent = '닫기'; cancel.style.cssText = 'padding:8px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;'; cancel.onclick = function () { shade.remove(); };
    var send = d.createElement('button'); send.type = 'button'; send.textContent = '자동 요약 저장'; send.style.cssText = 'padding:8px 12px;border:0;border-radius:7px;background:#1e40af;color:#fff;font-weight:700;';
    send.onclick = function () {
      var n = openNote({ data: data, summary: box.querySelector('[name="summary"]').value, url: w.location.href });
      copy(n.body).then(function () { send.textContent = n.count + '건 저장 요청 완료'; setTimeout(function () { send.textContent = '자동 요약 저장'; }, 2200); });
    };
    actions.appendChild(cancel); actions.appendChild(send); box.appendChild(actions); shade.appendChild(box); d.body.appendChild(shade);
  }
  /* ⚠ 떠 있는 단추(왼쪽 아래 고정)는 «자리를 스스로 못 정하는 화면»에만 단다 (2026-09-27).
     푸른이알피에 붙인 날 이 단추가 왼쪽 메뉴 맨 아래 「⚙ 환경설정」을 통째로 덮어,
     대표가 「환경관리가 사라졌다」고 하셨다. 자리가 있는 화면은 PU_OBSIDIAN_NO_FAB 를
     참으로 두고 제 메뉴에서 PuObsidian.show() 를 부른다. */
  function mount() {
    if (w.PU_OBSIDIAN_NO_FAB) return;
    if (d.getElementById('pu-obsidian-button')) return;
    var b = d.createElement('button'); b.id = 'pu-obsidian-button'; b.type = 'button'; b.textContent = '🪨 옵시디언 자동요약';
    b.title = '내 진행 업무를 자동으로 정리해 오늘의 옵시디언 메모를 만들거나 갱신합니다'; b.onclick = show;
    b.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:1200;border:0;border-radius:999px;padding:10px 14px;background:#1e40af;color:#fff;font-weight:700;box-shadow:0 5px 14px rgba(15,23,42,.25);cursor:pointer;';
    d.body.appendChild(b);
  }
  w.PuObsidian = { clean: clean, arrayOf: arrayOf, isClosed: isClosed, dueOf: dueOf, mine: mine, taskOf: taskOf, collect: collect, autoSummary: autoSummary, note: note, openNote: openNote, show: show };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount); else mount();
})(window, document);
