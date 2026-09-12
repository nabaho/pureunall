'use strict';
/* 「✂ 떼기」와 「↩ 되돌리기」를 «실제로 돌려» 본다 (대표 지시 2026-09-12)
   ────────────────────────────────────────────────────────────────────────
   ⚠ 이 두 가지는 «자료를 고치는» 일이다 — 글자만 찾는 검사로는 안 된다.
     가짜 창고를 만들어 정말로 떼고, 정말로 되돌아오는지 본다.
   ⚠ 파일은 «절대» 지우지 않는다 — 연결만 뗀다(파일은 서류 폴더에 그대로 있다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const MIS = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-misattach.js'), 'utf8');

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

function 무대(창고, opts) {
  opts = opts || {};
  const 저장소 = {};                       /* localStorage 흉내 */
  const 지운파일 = [];
  const 알림 = [];
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    LS: { get: function (k) { return 저장소[k]; }, set: function (k, v) { 저장소[k] = v; } },
    NS: 'cm3_',
    get: function (k) { return JSON.parse(JSON.stringify(창고[k] || [])); },
    set: function (k, arr) { 창고[k] = JSON.parse(JSON.stringify(arr)); },
    CAREER_CFG: { wiccok: { store: 'wiccok' }, complete: { store: 'cert' } },
    BULK_PAGES: ['wiccok', 'complete'],
    confirm: function () { return opts.예 !== false; },
    toast: function (m) { 알림.push(m); },
    deleteFile: function (id) { 지운파일.push(id); },   /* 불리면 «안 된다» */
    _safe: function (f) { try { f(); } catch (e) {} },
    renderCareer: function () {},
    renderMisattach: function () {},
    $: function () { return null; },
    document: { getElementById: function () { return null; } },
    window: {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MIS, ctx);
  ctx.KcareerMisattach = ctx.KcareerMisattach || ctx.window.KcareerMisattach;
  const 코드 = [
    떼기('function misUndoStash('), 떼기('function misUndoGet('),
    떼기('function misDetach('), 떼기('function misUndo(')
  ].join('\n').replace(/^(\s*)const /gm, '$1var ');
  vm.runInContext(코드, ctx);
  return { ctx: ctx, 창고: 창고, 지운파일: 지운파일, 알림: 알림,
           줄: function (st, id) { return (창고[st] || []).filter(function (r) { return r.id === id; })[0]; } };
}

function 붙은줄() {
  return { id: '위촉장2024-008', org: '교육부', issueDate: '2024.03.01',
    src: 'fs', relPath: '1. 위촉장/2025 전담노무사 위촉장 (2025.12.26).pdf',
    fileSize: 534083, fileMtime: 1700000000000, attachedScanId: 'S-9',
    fname: '2025 전담노무사 위촉장 (2025.12.26).pdf' };
}

/* ══════ ★ 떼기 ══════ */

test('★★★ 떼면 연결만 사라진다 — 기록도 파일도 그대로', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  const r = m.줄('wiccok', '위촉장2024-008');
  assert.ok(r, '★★★ 기록이 통째로 사라졌습니다');
  assert.equal(r.src, undefined, '★★★ 연결이 안 떨어졌습니다');
  assert.equal(r.relPath, undefined);
  assert.equal(r.fileSize, undefined);
  assert.equal(r.attachedScanId, undefined);
  assert.equal(r.org, '교육부', '★★ 기록 내용까지 지웠습니다');
  assert.equal(r.issueDate, '2024.03.01');
  assert.equal(m.지운파일.length, 0, '★★★ 원본 파일을 지웠습니다 — 되돌릴 수 없습니다');
});

test('★★★ 틀린 «파일 이름»도 함께 지운다 — 안 지우면 그대로 다시 붙는다', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  assert.equal(m.줄('wiccok', '위촉장2024-008').fname, undefined,
    '★★★ 틀린 파일 이름이 남으면 「원본 없는 것 채우기」가 «확실»로 다시 붙입니다');
});

test('★★ 「등록 때 적어 둔 다른 이름」은 남겨 둔다 — 증거를 잃으면 안 된다', () => {
  const r = 붙은줄(); r.fname = '2024_직업계고등학교 현장_전담노무사_위촉장.pdf';  /* 파일과 다른 이름 */
  const m = 무대({ wiccok: [r] });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  assert.equal(m.줄('wiccok', '위촉장2024-008').fname, '2024_직업계고등학교 현장_전담노무사_위촉장.pdf',
    '★★ 붙은 파일과 «다른» 이름까지 지우면 짝을 다시 찾을 단서가 없어집니다');
});

test('★★ 「아니오」면 아무것도 안 한다', () => {
  const m = 무대({ wiccok: [붙은줄()] }, { 예: false });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  const r = m.줄('wiccok', '위촉장2024-008');
  assert.equal(r.src, 'fs', '★★ 취소했는데 뗐습니다');
  assert.ok(r.relPath);
});

test('★★★ 앱 안에 담긴 첨부는 여기서 건드리지 않는다 — 지우면 원본이 «없어진다»', () => {
  const m = 무대({ wiccok: [{ id: 'W-앱', org: '충청남도', issueDate: '2020.01.01',
    fname: '2024 엉뚱한 파일.pdf' }] });
  vm.runInContext('misDetach("wiccok","W-앱")', m.ctx);
  assert.equal(m.줄('wiccok', 'W-앱').fname, '2024 엉뚱한 파일.pdf', '★★★ 앱 첨부를 건드렸습니다');
  assert.equal(m.지운파일.length, 0);
  assert.match(m.알림.join(' '), /🗑원본/, '무엇을 쓰라고 알려 줘야 합니다');
});

test('없는 줄·없는 화면에 터지지 않는다', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  assert.doesNotThrow(function () { vm.runInContext('misDetach("wiccok","없는id")', m.ctx); });
  assert.doesNotThrow(function () { vm.runInContext('misDetach("없는화면","위촉장2024-008")', m.ctx); });
});

/* ══════ ★ 되돌리기 ══════ */

test('★★★ 되돌리면 연결이 그대로 살아난다 — 크기·수정일·스캔표까지', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  vm.runInContext('misUndo()', m.ctx);
  const r = m.줄('wiccok', '위촉장2024-008');
  assert.equal(r.src, 'fs', '★★★ 되돌아오지 않았습니다');
  assert.equal(r.relPath, '1. 위촉장/2025 전담노무사 위촉장 (2025.12.26).pdf');
  assert.equal(r.fileSize, 534083);
  assert.equal(r.fileMtime, 1700000000000);
  assert.equal(r.attachedScanId, 'S-9');
  assert.equal(r.fname, '2025 전담노무사 위촉장 (2025.12.26).pdf', '★★ 파일 이름도 되살려야 합니다');
});

test('★★ 두 줄을 떼고 한 번에 되돌린다 — 다른 화면(창고)도 함께', () => {
  const m = 무대({
    wiccok: [붙은줄()],
    cert: [{ id: 'C0037', title: '수료증', issueDate: '2015.03.17',
             src: 'fs', relPath: '2. 자격증 및 수료증/2025 한기대.pdf', fname: '2025 한기대.pdf' }]
  });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  vm.runInContext('misDetach("complete","C0037")', m.ctx);
  assert.equal(m.줄('wiccok', '위촉장2024-008').src, undefined);
  assert.equal(m.줄('cert', 'C0037').src, undefined);
  vm.runInContext('misUndo()', m.ctx);
  assert.equal(m.줄('wiccok', '위촉장2024-008').src, 'fs', '★★ 위촉장이 안 돌아왔습니다');
  assert.equal(m.줄('cert', 'C0037').src, 'fs', '★★ 다른 창고 줄이 안 돌아왔습니다');
});

test('★ 두 번 되돌려도 늘어나지 않는다 — 되돌린 뒤에는 되돌릴 것이 없다', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  vm.runInContext('misUndo()', m.ctx);
  const 전 = JSON.stringify(m.창고);
  vm.runInContext('misUndo()', m.ctx);
  assert.equal(JSON.stringify(m.창고), 전, '★ 두 번째 되돌리기가 자료를 바꿨습니다');
  assert.match(m.알림.join(' '), /되돌릴 것이 없습니다/);
});

test('되돌릴 것이 없는데 눌러도 터지지 않는다', () => {
  const m = 무대({ wiccok: [붙은줄()] });
  assert.doesNotThrow(function () { vm.runInContext('misUndo()', m.ctx); });
});

/* ══════ 화면 그리기 — 터지면 빈 창만 뜬다 ══════ */

function 화면무대(창고) {
  const m = 무대(창고);
  const 칸 = { misBody: { innerHTML: '' }, misUndoBtn: { style: {} } };
  m.ctx.document.getElementById = function (id) { return 칸[id] || null; };
  m.ctx.$ = function (id) { return 칸[id] || null; };
  m.ctx.escapeHtml = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  m.ctx._jsAttr = function (s) { return String(s).replace(/'/g, "\\'"); };
  m.ctx.BULK_LABEL = { wiccok: '위촉장', complete: '수료증' };
  m.ctx.window = { KcareerMisattach: m.ctx.KcareerMisattach };
  vm.runInContext(떼기('function _misGather(').replace(/^(\s*)const /gm, '$1var '), m.ctx);
  vm.runInContext(떼기('function renderMisattach(').replace(/^(\s*)const /gm, '$1var '), m.ctx);
  m.칸 = 칸;
  return m;
}

test('★★★ 어긋난 줄을 화면에 그린다 — 터지면 빈 창만 뜬다', () => {
  const m = 화면무대({ wiccok: [붙은줄()] });
  assert.doesNotThrow(function () { vm.runInContext('renderMisattach()', m.ctx); });
  const h = m.칸.misBody.innerHTML;
  assert.match(h, /위촉장2024-008/, '★★★ 어긋난 줄이 화면에 안 나옵니다');
  assert.match(h, /강함/, '확신 등급을 보여 줘야 합니다');
  assert.match(h, /2025 전담노무사 위촉장/, '★★ 어떤 파일이 붙었는지 보여 줘야 합니다');
  assert.match(h, /2024\.03\.01/, '★★ 기록의 날짜를 함께 보여 줘야 견줄 수 있습니다');
  assert.match(h, /misDetach\(/, '★★ 뗄 수 있어야 합니다');
  assert.match(h, /openLocalOriginal\(/, '★★ 눈으로 확인할 길이 있어야 합니다');
  assert.match(h, /지우지 않습니다|그대로 있습니다/, '★★ 무슨 일이 생기는지 말해야 합니다');
});

test('★★ 어긋난 것이 없으면 «없다»고 말한다 — 빈 칸은 고장으로 읽힌다', () => {
  const m = 화면무대({ wiccok: [{ id: 'W1', org: '충청남도', issueDate: '2020.05.01',
    src: 'fs', relPath: '1. 위촉장/2020 충청남도 위촉장 (2020.05.01).pdf' }] });
  vm.runInContext('renderMisattach()', m.ctx);
  const h = m.칸.misBody.innerHTML;
  assert.match(h, /없습니다/, '★★ 아무 말도 없으면 고장으로 읽힙니다');
  assert.match(h, /1개 줄/, '몇 개를 살펴봤는지 말해야 믿을 수 있습니다');
});

test('★ 앱 안 첨부 줄에는 「떼기」를 내놓지 않는다 — 누르면 원본이 없어진다', () => {
  const m = 화면무대({ wiccok: [{ id: 'W-앱', org: '충청남도', issueDate: '2015.01.01',
    fname: '2025 엉뚱한 파일.pdf' }] });
  vm.runInContext('renderMisattach()', m.ctx);
  const h = m.칸.misBody.innerHTML;
  assert.match(h, /W-앱/, '걸리기는 해야 합니다');
  assert.ok(h.indexOf('misDetach(') < 0, '★★ 앱 첨부에 떼기 단추를 내놓았습니다');
  assert.match(h, /앱 첨부/, '왜 못 떼는지 밝혀야 합니다');
});

test('★ 되돌릴 것이 있을 때만 되돌리기 단추를 보여 준다', () => {
  const m = 화면무대({ wiccok: [붙은줄()] });
  vm.runInContext('renderMisattach()', m.ctx);
  assert.equal(m.칸.misUndoBtn.style.display, 'none', '뗀 것이 없으면 숨깁니다');
  vm.runInContext('misDetach("wiccok","위촉장2024-008")', m.ctx);
  vm.runInContext('renderMisattach()', m.ctx);
  assert.equal(m.칸.misUndoBtn.style.display, '', '★ 뗀 뒤에는 되돌릴 길이 보여야 합니다');
});
