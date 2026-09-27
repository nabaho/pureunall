/* 푸른이알피 업무 요약을 옵시디언으로 보내는 작은 연결층.
   원본 자료·개인식별번호·첨부파일은 보내지 않고 사람이 적은 요약만 Markdown으로 만든다. */
(function (w, d) {
  'use strict';
  if (w.PuObsidian) return;

  var MAX = 4000;
  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, MAX);
  }
  function esc(v) {
    return clean(v).replace(/[|<>]/g, ' ');
  }
  function note(fields) {
    var today = new Date().toISOString().slice(0, 10);
    var title = esc(fields.title) || '푸른 ERP 업무 요약';
    var body = [
      '---',
      'source: 푸른이알피',
      'created: ' + today,
      'status: ' + (esc(fields.status) || '검토 전'),
      '---',
      '',
      '# ' + title,
      '',
      '- 업체: ' + (esc(fields.company) || '미지정'),
      '- 담당자: ' + (esc(fields.assignee) || '미지정'),
      '- 기한: ' + (esc(fields.due) || '미지정'),
      '- ERP 원본: ' + (esc(fields.url) || location.href),
      '',
      '## 업무 요약',
      '',
      esc(fields.summary) || '요약을 입력해 주세요.',
      '',
      '## 다음 할 일',
      '',
      '- [ ] 담당자 확인',
      '',
      '> 이 메모는 푸른이알피에서 사람이 입력한 요약만 보낸 초안입니다. 원본 자료와 첨부파일은 포함하지 않습니다.',
    ].join('\n');
    return { title: title, body: body };
  }
  function openNote(fields) {
    var n = note(fields);
    var uri = 'obsidian://new?name=' + encodeURIComponent('푸른업무/' + n.title) + '&content=' + encodeURIComponent(n.body);
    var a = d.createElement('a');
    a.href = uri; a.rel = 'noopener'; a.style.display = 'none';
    d.body.appendChild(a); a.click(); a.remove();
    return n;
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = d.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    d.body.appendChild(ta); ta.select(); d.execCommand('copy'); ta.remove(); return Promise.resolve();
  }
  function field(label, placeholder, key) {
    var wrap = d.createElement('label'); wrap.style.display = 'block'; wrap.style.margin = '8px 0';
    var cap = d.createElement('span'); cap.textContent = label; cap.style.display = 'block'; cap.style.fontSize = '12px'; cap.style.color = '#475569';
    var input = d.createElement(key === 'summary' ? 'textarea' : 'input'); input.name = key; input.placeholder = placeholder; input.rows = 4;
    input.style.width = '100%'; input.style.boxSizing = 'border-box'; input.style.padding = '7px'; input.style.border = '1px solid #cbd5e1'; input.style.borderRadius = '6px';
    wrap.appendChild(cap); wrap.appendChild(input); return wrap;
  }
  function show() {
    if (d.getElementById('pu-obsidian-modal')) return;
    var shade = d.createElement('div'); shade.id = 'pu-obsidian-modal';
    shade.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;';
    var box = d.createElement('div'); box.style.cssText = 'background:#fff;border-radius:12px;width:min(520px,100%);max-height:90vh;overflow:auto;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.28);font-family:system-ui,sans-serif;';
    var h = d.createElement('h2'); h.textContent = '📝 옵시디언 업무요약'; h.style.margin = '0 0 4px'; box.appendChild(h);
    var p = d.createElement('p'); p.textContent = '원본·첨부파일 없이 요약과 ERP 링크만 새 메모로 보냅니다.'; p.style.cssText = 'font-size:12px;color:#64748b;margin:0 0 12px;'; box.appendChild(p);
    [['제목','예: 대흥중공업 계약 검토','title'],['업체','업체명','company'],['담당자','담당자명','assignee'],['기한','예: 2026-10-01','due'],['상태','예: 검토 전','status'],['업무 요약','핵심 업무 한 줄 또는 두세 문장','summary']].forEach(function (f) { box.appendChild(field(f[0], f[1], f[2])); });
    var actions = d.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:14px;';
    var cancel = d.createElement('button'); cancel.type = 'button'; cancel.textContent = '닫기'; cancel.style.cssText = 'padding:8px 12px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;'; cancel.onclick = function () { shade.remove(); };
    var send = d.createElement('button'); send.type = 'button'; send.textContent = '옵시디언으로 열기'; send.style.cssText = 'padding:8px 12px;border:0;border-radius:7px;background:#1e40af;color:#fff;font-weight:700;';
    send.onclick = function () {
      var values = {}; box.querySelectorAll('[name]').forEach(function (el) { values[el.name] = el.value; });
      var n = openNote(values);
      copy(n.body).then(function () { send.textContent = '열기 요청 완료 · 내용도 복사됨'; setTimeout(function () { send.textContent = '옵시디언으로 열기'; }, 2200); });
    };
    actions.appendChild(cancel); actions.appendChild(send); box.appendChild(actions); shade.appendChild(box); d.body.appendChild(shade);
    box.querySelector('[name="title"]').focus();
  }
  /* ⚠ 떠 있는 단추(왼쪽 아래 고정)는 «자리를 스스로 못 정하는 화면»에만 단다 (2026-09-27).
     푸른이알피에 붙인 날 이 단추가 왼쪽 메뉴 맨 아래 「⚙ 환경설정」을 통째로 덮어,
     대표가 「환경관리가 사라졌다」고 하셨다. 자리가 있는 화면은 PU_OBSIDIAN_NO_FAB 를
     참으로 두고 제 메뉴에서 PuObsidian.show() 를 부른다. */
  function mount() {
    if (w.PU_OBSIDIAN_NO_FAB) return;
    if (d.getElementById('pu-obsidian-button')) return;
    var b = d.createElement('button'); b.id = 'pu-obsidian-button'; b.type = 'button'; b.textContent = '📝 옵시디언 업무요약';
    b.title = '요약과 ERP 링크만 옵시디언 새 메모로 보냅니다'; b.onclick = show;
    b.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:1200;border:0;border-radius:999px;padding:10px 14px;background:#1e40af;color:#fff;font-weight:700;box-shadow:0 5px 14px rgba(15,23,42,.25);cursor:pointer;';
    d.body.appendChild(b);
  }
  w.PuObsidian = { clean: clean, note: note, openNote: openNote, show: show };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount); else mount();
})(window, document);
