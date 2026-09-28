'use strict';
/* 서류 보관함 — № 넘버링 · ㅁ 고르기 · ⬇ 내려받은 기록 · 한글 원본 보기 (대표 지시 2026-09-28)
   ─────────────────────────────────────────────────────────────
   「ㅁ 표시와 넘버링해주고 다운받을경우 내용과 다운받은 날짜등이 저장되어야한다.」
   + 대표 화면: 「📎 원본」(한글)이 「이 형식은 미리보기를 지원하지 않습니다」로 막혔다.
   ⚠ 앱의 진짜 함수를 vm 에 올리고 가짜 화면에 대고 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}

/* 아주 작은 가짜 DOM — 보관함 몸통에 그린 글을 읽어 체크칸을 만들어 준다 */
function 칸(id) {
  const e = { id, value: '', style: {}, textContent: '', dataset: {}, checked: false, indeterminate: false, _html: '',
    _cls: new Set(), classList: { toggle: (c, on) => { if (on) e._cls.add(c); else e._cls.delete(c); }, contains: (c) => e._cls.has(c) },
    addEventListener() {} };
  Object.defineProperty(e, 'innerHTML', {
    get() { return e._html; },
    set(v) {
      e._html = v;
      /* 줄마다 체크칸 · 카드 · 전체 선택 */
      e._chk = [...String(v).matchAll(/<div class="card ds-card" data-id="([^"]+)"/g)].map((m) => {
        const card = { _cls: new Set(), classList: { toggle: (c, on) => { if (on) card._cls.add(c); else card._cls.delete(c); } } };
        return { value: m[1], checked: false, closest: () => card, card };
      });
      e._all = /class="ds-all"/.test(v) ? { checked: false, indeterminate: false } : null;
    }
  });
  e.querySelectorAll = (s) => (s === '.row-chk:checked' ? (e._chk || []).filter((c) => c.checked) : s === '.row-chk' ? (e._chk || []) : []);
  e.querySelector = (s) => (s === '.ds-all' ? e._all : null);
  return e;
}
function 세상(o) {
  o = o || {};
  const 통 = { resume: o.rows || [] }, 알림 = [], 받음 = [], 휴지통 = [], 뷰어 = [];
  const 칸들 = {};
  ['page-docbox', 'rsOrg', 'rsSearch', 'rsCnt', 'rsBody', 'dsSel-resume', 'dsSelCnt-resume'].forEach((k) => { 칸들[k] = 칸(k); });
  const 파일 = o.files || {};
  const ctx = {
    console: { warn() {} }, Date, String, Number, Math, JSON, RegExp, Array, Object, Set, Promise, Uint8Array, isNaN,
    DOMAINS: { resume: { page: 'page-docbox', store: 'resume', orgFilter: 'rsOrg', search: 'rsSearch', cnt: 'rsCnt', body: 'rsBody', label: '이력서', extra: [] } },
    get: (k) => JSON.parse(JSON.stringify(통[k] || [])), set: (k, v) => { 통[k] = JSON.parse(JSON.stringify(v)); },
    document: { getElementById: (id) => 칸들[id] || null,
      createElement: () => ({ click() { 받음.push(this.download); } }) },
    URL: { createObjectURL: () => 'blob:x' }, Blob: function () {},
    b64ToAb: () => new ArrayBuffer(1),
    getFile: (id) => 파일[id] || null, getFileAsync: async (id) => 파일[id] || null,
    setTimeout: (f) => { f(); return 1; },
    _safe: (f) => { try { return f(); } catch (e) { 알림.push('걸림:' + e.message); return null; } },
    toast: (m) => { 알림.push(String(m)); }, _logCv: () => {},
    escapeHtml: (s) => String(s == null ? '' : s).replace(/</g, '&lt;'), _jsAttr: (s) => String(s),
    _cdSrc: () => 'made', hasOriginal: () => true, bindDragSel: () => {},
    kcAskDelete: (btn, opt, ok) => { ctx._물음 = opt; if (!o.noConfirm) ok(); },
    kcTrashPut: (st, pg, r) => { 휴지통.push(r.id); return 1; }, kcTrashDone: (e, m) => { 알림.push(m || '지움'); },
    kcTrashLabel: (r) => r.kind + ' ' + r.org, TRASH_DAYS: 30,
    hideThumb: () => {}, fileExt: (id) => (파일[id] && 파일[id].ext) || '', fileURL: () => 'u',
    openHwpViewer: (b, n) => { 뷰어.push(n); }, showPDFInline: () => {}, _furl: {}
  };
  vm.createContext(ctx);
  vm.runInContext([SRC.match(/var DOC_DL_MAX=\d+;/)[0],
    ...['function renderDocStore(', 'function _docDlTag(', 'async function docDl(', 'function openDocDlLog(',
      'function _docSelBox(', 'function docSelIds(', 'function docSelSync(', 'function docSelAll(', 'async function docSelDl(',
      'function docSelDel(', 'function showBig('].map(떼기)].join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return { ctx, 통, 알림, 받음, 휴지통, 뷰어, 칸들, 돌려: (s) => vm.runInContext(s, ctx), 몸: 칸들.rsBody };
}
const 줄 = (id, year, extra) => Object.assign({ id, kind: '일반 이력서', org: '기관' + id, year, genFileId: 'G' + id, genName: '이력서_' + id + '.hwpx', savedAt: '2026-0' + id }, extra || {});

test('★★★ № 번호가 해를 «통틀어» 이어지고 줄마다 ㅁ 체크칸이 있다', () => {
  const w = 세상({ rows: [줄('1', '2026'), 줄('2', '2026'), 줄('3', '2025')] });
  w.돌려("renderDocStore('resume')");
  const h = w.몸.innerHTML;
  const 번호 = [...h.matchAll(/class="ds-no"[^>]*>(\d+)</g)].map((m) => +m[1]);
  assert.deepEqual(번호, [1, 2, 3], '★★★ 번호가 해마다 1부터 다시 시작하거나 없습니다: ' + JSON.stringify(번호));
  assert.equal((h.match(/class="row-chk"/g) || []).length, 3, '★★ 줄마다 ㅁ 체크칸이 없습니다');
  assert.match(h, /class="ds-all"/, '★ 전체 선택 칸이 없습니다');
});

test('★★ 고르면 선택 줄이 뜨고 세고, 전체 선택·해제가 된다', () => {
  const w = 세상({ rows: [줄('1', '2026'), 줄('2', '2026'), 줄('3', '2025')] });
  w.돌려("renderDocStore('resume')");
  assert.equal(w.칸들['dsSel-resume'].style.display, undefined);
  w.몸._chk[1].checked = true; w.돌려("docSelSync('resume')");
  assert.equal(w.칸들['dsSel-resume'].style.display, '', '★★ 골라도 선택 줄이 안 뜹니다');
  assert.equal(w.칸들['dsSelCnt-resume'].textContent, '1건 선택');
  assert.ok(w.몸._chk[1].card._cls.has('sel-on'), '고른 줄이 표가 안 납니다');
  assert.equal(w.몸._all.indeterminate, true);
  w.돌려("docSelAll('resume',true)");
  assert.equal(w.칸들['dsSelCnt-resume'].textContent, '3건 선택');
  assert.equal(w.몸._all.checked, true);
  w.돌려("docSelAll('resume',false)");
  assert.equal(w.칸들['dsSel-resume'].style.display, 'none', '해제해도 선택 줄이 남습니다');
});

test('★★★ 내려받으면 «무엇을·언제» 그 서류에 남는다 — 목록에 보인다', async () => {
  const w = 세상({ rows: [줄('1', '2026', { origFileId: 'O1', origName: '신청서.hwp' })],
    files: { G1: { name: '2026년 신청서 2026. 09. 28.hwpx', base64: 'QQ==' }, O1: { name: '신청서.hwp', base64: 'QQ==' } } });
  const 전 = Date.now();
  assert.equal(await w.돌려("docDl('resume','1','gen')"), true);
  await w.돌려("docDl('resume','1','orig')");
  const d = w.통.resume[0].downloads;
  assert.equal(d.length, 2, '★★★ 내려받은 기록이 안 남습니다');
  assert.equal(d[0].what, '원본 양식', '★★ 무엇을 내려받았는지(최근 것이 위) 틀립니다');
  assert.equal(d[1].what, '이력서');
  assert.equal(d[1].name, '2026년 신청서 2026. 09. 28.hwpx', '★★ 파일 이름을 안 남깁니다');
  assert.equal(d[1].about, '일반 이력서 · 기관1', '★ 어느 서류의 내용인지 안 남깁니다');
  assert.ok(Date.parse(d[0].at) >= 전 - 5, '★★★ 내려받은 날짜가 없습니다');
  assert.deepEqual(w.받음, ['2026년 신청서 2026. 09. 28.hwpx', '신청서.hwp'], '★ 실제로 내려받지 않았습니다');
  assert.match(w.몸.innerHTML, /⬇ 내려받음 2회 · 마지막 \d{4}\.\d{2}\.\d{2} \d{2}:\d{2} \(원본 양식\)/, '★★ 목록에서 기록이 안 보입니다');
});

test('★★ 파일이 없으면 «기록하지 않는다» — 거짓 기록 금지 · 50건까지만', async () => {
  const w = 세상({ rows: [줄('1', '2026')], files: {} });
  assert.equal(await w.돌려("docDl('resume','1','gen')"), false);
  assert.equal((w.통.resume[0].downloads || []).length, 0, '★★ 못 내려받았는데 기록이 남았습니다');
  const 많이 = Array.from({ length: 60 }, (_, i) => ({ at: '2026-01-01', what: '이력서', name: 'x' + i }));
  const w2 = 세상({ rows: [줄('1', '2026', { downloads: 많이 })], files: { G1: { name: 'a', base64: 'QQ==' } } });
  await w2.돌려("docDl('resume','1','gen')");
  assert.equal(w2.통.resume[0].downloads.length, 50, '★ 기록이 끝없이 쌓입니다');
});

test('★★ 골라 내려받기·골라 삭제 — 한 번 묻고, 휴지통으로, 기록도 남는다', async () => {
  const w = 세상({ rows: [줄('1', '2026'), 줄('2', '2026'), 줄('3', '2025')],
    files: { G1: { name: 'a', base64: 'QQ==' }, G3: { name: 'c', base64: 'QQ==' } } });
  w.돌려("renderDocStore('resume')");
  w.몸._chk[0].checked = true; w.몸._chk[1].checked = true; w.몸._chk[2].checked = true;
  await w.돌려("docSelDl('resume')");
  assert.equal(w.받음.length, 2, '파일 있는 것만 내려받습니다');
  assert.ok(w.알림.some((m) => /2건 내려받았습니다 \(1건은 파일이 없어 건너뜀\)/.test(m)), '★ 건너뛴 것을 말하지 않습니다');
  assert.equal(w.통.resume.filter((r) => (r.downloads || []).length).length, 2, '★★ 골라 내려받은 것에 기록이 안 남습니다');
  w.돌려("renderDocStore('resume')");
  w.몸._chk[0].checked = true; w.몸._chk[2].checked = true;
  w.돌려("docSelDel('resume',null)");
  assert.match(w.ctx._물음.title, /2건/, '★ 몇 건인지 묻지 않습니다');
  assert.equal(w.통.resume.length, 1, '★★ 골라 지우기가 안 됩니다');
  assert.equal(w.휴지통.length, 2, '★★★ 휴지통을 안 거치고 지웁니다 — 되살릴 수 없습니다');
  const w2 = 세상({ rows: [줄('1', '2026')], noConfirm: true });
  w2.돌려("renderDocStore('resume')"); w2.몸._chk[0].checked = true; w2.돌려("docSelDel('resume',null)");
  assert.equal(w2.통.resume.length, 1, '★★★ 묻지도 않고 지웁니다');
});

test('★★ 한글 원본은 «한글 뷰어»로 연다 — 「미리보기를 지원하지 않습니다」로 막지 않는다', async () => {
  const w = 세상({ files: { O1: { name: '신청서.hwp', ext: 'hwp', base64: 'QQ==' }, O2: { name: '양식.HWPX', ext: 'HWPX', base64: 'QQ==' } } });
  w.돌려("showBig('O1')"); w.돌려("showBig('O2')");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(w.뷰어, ['신청서.hwp', '양식.HWPX'], '★★ 한글 원본을 뷰어로 안 엽니다');
});

test('★ 내려받기 단추가 기록하는 길(docDl)을 쓴다 — 옛 downloadFile 로 곧장 가지 않는다', () => {
  const r = 떼기('function renderDocStore(');
  assert.ok(!/downloadFile\('\$\{r\.genFileId\}'\)/.test(r), '★★ 이력서 ⬇ 가 기록 없이 내려받습니다');
  assert.ok(!/downloadFile\('\$\{r\.origFileId\}'\)/.test(r), '★★ 원본 ⬇ 가 기록 없이 내려받습니다');
  assert.match(r, /docDl\('\$\{domain\}','\$\{r\.id\}','gen'\)/);
  assert.match(r, /docDl\('\$\{domain\}','\$\{r\.id\}','orig'\)/);
});
