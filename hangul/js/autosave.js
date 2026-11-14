/* 자동 저장 — 열어 둔 문서를 이 컴퓨터의 브라우저(IndexedDB)에 계속 복구용으로 저장.
   화면이 갑자기 꺼지거나 창을 잘못 닫아도 «파일 → 자동 저장된 문서…» 에서 다시 열 수 있다.
   원본 파일은 건드리지 않는다(다른 이름의 복구 사본만 저장). 배포용(읽기 전용) 문서는 보호를 우회하지 않도록 저장하지 않는다.
   사본은 같은 브라우저 안에만 있고, 20개·14일을 넘으면 오래된 것부터 지운다. */
(function () {
  'use strict';
  const DB = 'pureun-hangul', STORE = 'autosave', MAX_KEEP = 20, MAX_DAYS = 14, IDLE_MS = 2500;
  const { h, toast } = PureunUI;
  const A = () => window.PureunApp;
  let dbp = null, timer = null, saving = false, again = false, rev = 0;

  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'id' });
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  }));
  const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = t.onabort = () => rej(t.error);
  }));
  const put = rec => tx('readwrite', st => st.put(rec));
  const del = id => tx('readwrite', st => st.delete(id));
  const all = () => tx('readonly', st => st.getAll()).then(l => (l || []).sort((a, b) => b.savedAt - a.savedAt));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'd' + Date.now() + Math.random().toString(36).slice(2));
  const hhmmss = t => new Date(t).toLocaleTimeString('ko-KR', { hour12: false });
  const stamp = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const msg = t => { const m = document.getElementById('stMsg'); if (m) m.textContent = t; };

  async function prune() {
    const list = await all(), cut = Date.now() - MAX_DAYS * 864e5;
    for (const r of list.filter((r, i) => i >= MAX_KEEP || r.savedAt < cut)) await del(r.id);
  }

  // 지금 편집기에 올라 있는 문서를 저장 (수정된 문서만 저장하여 대용량 문서를 열자마자 멈추는 현상 방지)
  async function saveCurrent() {
    const app = A(), d = app && app.current();
    if (!d || d.readOnly || !d.dirty || d._savedRev === rev) return;
    if (saving) { again = true; return; }
    saving = true;
    const curRev = rev;
    try {
      const bytes = app.buildBytes();
      if (!d.autoId) d.autoId = uid();
      const buf = bytes.buffer && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
      await put({ id: d.autoId, name: d.name, savedAt: Date.now(), dirty: !!d.dirty, bytes: buf });
      d._savedRev = curRev;
      msg('자동 저장됨 ' + hhmmss(Date.now()));
      prune().catch(() => {});
    } catch (e) { msg('자동 저장 실패'); } finally {
      saving = false;
      if (again) { again = false; schedule(); }
    }
  }
  function schedule() {
    clearTimeout(timer);
    const pages = window.PureunEditor && PureunEditor.pageCount ? PureunEditor.pageCount() : 1;
    const wait = pages > 30 ? 12000 : IDLE_MS;
    timer = setTimeout(() => {
      if (typeof requestIdleCallback === 'function' && pages > 15) requestIdleCallback(() => saveCurrent(), { timeout: 5000 });
      else saveCurrent();
    }, wait);
  }
  function flush() { clearTimeout(timer); return saveCurrent(); }

  document.addEventListener('pu:dirty', () => { rev++; schedule(); });
  document.addEventListener('pu:doc', () => { const app = A(), d = app && app.current(); if (d && d.dirty) schedule(); });
  document.addEventListener('pu:leave', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);

  async function restore(rec, close) {
    const file = new File([rec.bytes], rec.name + '.hwpx');
    await A().openBlob(file, null);
    const d = A().current();
    if (d) { d.autoId = rec.id; A().setDirty(); } // 같은 자리에 이어서 저장, 파일로는 아직 저장 전
    if (close) close();
  }

  async function openList() {
    let list = [];
    try { list = await all(); } catch (e) { toast('자동 저장 목록을 읽지 못했습니다.', true); return; }
    const rows = h('div', { class: 'as-list' });
    let dlg;
    const render = items => {
      rows.innerHTML = '';
      if (!items.length) { rows.append(h('div', { class: 'tp-note' }, '자동 저장된 문서가 없습니다.')); return; }
      for (const r of items) {
        rows.append(h('div', { class: 'as-row' },
          h('div', { class: 'as-info' }, h('b', {}, r.name), h('span', {}, `${stamp(r.savedAt)} · ${(r.bytes.byteLength / 1024).toFixed(0)}KB${r.dirty ? ' · 저장 전 상태' : ''}`)),
          h('button', { class: 'btn', onclick: () => restore(r, () => dlg.close()) }, '열기'),
          h('button', { class: 'btn', onclick: async () => { await del(r.id); render(await all()); } }, '지우기')));
      }
    };
    render(list);
    dlg = PureunUI.dialog({
      title: '자동 저장된 문서', width: 520,
      body: h('div', {}, rows, h('div', { class: 'tp-note' }, '이 컴퓨터의 이 브라우저에만 저장된 복구용 사본입니다(원본 파일은 그대로). 20개·14일을 넘으면 오래된 것부터 지웁니다. 개인 정보가 든 문서는 쓰고 나서 «지우기»를 눌러 주세요.')),
      buttons: [{ label: '모두 지우기', stay: true, act: async () => { for (const r of await all()) await del(r.id); render([]); } }, { label: '닫기', cancel: true }],
    });
  }

  // 시작할 때: 복구할 문서가 있고 지금 빈 문서뿐이면 알려 줌
  async function offerOnStart() {
    try {
      const app = A(), d = app && app.current();
      if (!d || !(d.pristine && !d.dirty) || app.docs().length !== 1) return;
      const list = await all();
      if (!list.length) return;
      toast(`이전에 작업하던 문서 ${list.length}개가 자동 저장되어 있습니다 — 파일 → 자동 저장된 문서…`);
      const bar = document.getElementById('stMsg'); if (bar) bar.textContent = `자동 저장된 문서 ${list.length}개 있음`;
    } catch (e) { /* 저장소를 못 쓰는 환경(시크릿 창 등)은 조용히 건너뜀 */ }
  }

  window.PureunAutosave = { openList, saveNow: flush, list: all, offerOnStart };
  setTimeout(offerOnStart, 600);
})();
