/* 📮 신고 완료 — 검토 완료한 회차에 «신고를 마쳤다»를 적는다 (대표 결정 2026-10-05 「나중에 따로 표시」)

   ■ 무엇이 있었나 (2026-09-13 발견)
     dashStage 가 filedAt 을 «읽기만» 하고 적는 곳이 규정관리 어디에도 없었다.
     그래서 모든 사업장이 영영 「검토완료」에 머물렀고 할 일 셈이 부풀었다.
   ■ 지키는 규칙
     ① 검토 완료한 회차(rev 있음)에만 적는다
     ② 신고일·관할 노동청은 꼭, 접수번호는 선택 · 신고일은 오늘보다 뒤일 수 없다
     ③ 지우기는 칸마다 null — update 가 그 자리를 지운다
     ④ 다시 저장해도 안 사라진다(putRecord)
     ⑤ 신고한 회차는 완료 해제를 막는다
     ⑥ 적으면 dashStage 가 「신고완료」로 읽고, 할 일에서 빠진다
   실행: node --test tests/rules-filed-mark.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) {
    if (RAW[i] === '{') d++;
    else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); }
  }
  throw new Error(decl + ' 의 끝을 못 찾았습니다');
}
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(RAW.match(/const FILED_F=\[[^\]]*\];/)[0] + '\nthis.FILED_F=FILED_F;', ctx);
  vm.runInContext(cut('function filedPatch('), ctx);
  vm.runInContext(cut('function dashStage('), ctx);
  return ctx;
}
const NOW = '2026-10-05T20:30:00.000Z';
const 완료 = { id: 'site_1@r1', rev: 'r1', site: '가나상사', asof: '2026-10-01' };

test('① 검토 완료한 회차에만 — 작업중이면 안 적는다', () => {
  const c = 판();
  const p = c.filedPatch({ id: 'site_1', rev: null }, { at: '2026-10-05', office: '천안고용노동지청' }, '담당', NOW);
  assert.equal(p.ok, false, '★ 작업중 기록에 신고를 적었다 — 무엇을 냈는지가 없다');
});

test('② 신고일·노동청은 꼭, 접수번호는 선택 · 미래 날짜는 안 된다', () => {
  const c = 판();
  const ok = c.filedPatch(완료, { at: '2026-10-05', office: ' 천안고용노동지청 ', no: '' }, '담당', NOW);
  assert.equal(ok.ok, true, ok.why.join(' / '));
  assert.equal(ok.patch.filedAt, '2026-10-05');
  assert.equal(ok.patch.filedOffice, '천안고용노동지청');
  assert.equal(ok.patch.filedNo, null, '빈 접수번호를 빈 글자로 담았다 — 「모른다」와 「없음」이 섞인다');
  assert.equal(ok.patch.filedBy, '담당');
  assert.equal(ok.patch.filedMark, '2026-10-05 20:30');
  assert.equal(c.filedPatch(완료, { at: '', office: '천안' }, '', NOW).ok, false, '신고일 없이 적었다');
  assert.equal(c.filedPatch(완료, { at: '2026-10-05', office: '' }, '', NOW).ok, false, '노동청 없이 적었다');
  assert.equal(c.filedPatch(완료, { at: '2026-10-06', office: '천안' }, '', NOW).ok, false, '★ 내일 신고를 «마쳤다»고 적었다');
  assert.equal(c.filedPatch(완료, { at: '2026-10-05', office: '천안', no: 'x'.repeat(41) }, '', NOW).ok, false);
});

test('③ 지우기는 칸마다 null', () => {
  const c = 판();
  const p = c.filedPatch(완료, null, '담당', NOW);
  assert.equal(p.ok, true);
  assert.equal(Object.keys(p.patch).length, c.FILED_F.length);
  c.FILED_F.forEach((k) => assert.equal(p.patch[k], null, k + ' 가 안 지워진다'));
});

test('⑥ 적으면 「신고완료」 — 할 일에서 빠진다', () => {
  const c = 판();
  assert.equal(c.dashStage(Object.assign({}, 완료, { filedAt: '2026-10-05' })).k, 'filed');
  assert.equal(c.dashStage(완료).k, 'reviewed');
  assert.ok(!/filed\s*:/.test(RAW.match(/const DASH_TODO_K=\{[^}]*\};/)[0]), '신고완료가 할 일에 든다');
});

test('④ 다시 저장해도 안 사라진다 — putRecord 가 FILED_F 를 지킨다', () => {
  const fn = cut('function putRecord(');
  assert.match(fn, /prev\.filedAt\)FILED_F\.forEach/, '★ 완료본을 다시 저장하면 신고 기록이 사라진다');
  assert.ok(RAW.indexOf('const FILED_F=') < RAW.indexOf('function putRecord('),
    'FILED_F 가 putRecord 아래에 있다 — 먼저 불린 저장이 멈춘다');
});

test('⑤ 신고한 회차는 완료 해제를 막는다', () => {
  const at = RAW.indexOf('$("save-done").addEventListener("click"');
  const seg = RAW.slice(at, RAW.indexOf('검토 완료를 해제할까요', at));
  assert.match(seg, /if\(cur&&cur\.filedAt\)\{ alert\([\s\S]*?\); return; \}/, '★ 신고한 회차를 풀어 고칠 수 있다 — 낸 것과 기록이 달라진다');
});

test('화면 — 단추·창이 있고, 저장은 그 회차 자리에 update 한다', () => {
  assert.match(RAW, /<button[^>]*id="save-filed"[^>]*disabled/, '신고 단추가 없거나 처음부터 켜져 있다');
  ['filed-at', 'filed-office', 'filed-no', 'filed-save', 'filed-clear'].forEach((id) =>
    assert.ok(RAW.indexOf('id="' + id + '"') > 0, id + ' 가 없다'));
  const fn = cut('async function saveFiled(');
  assert.match(fn, /FBDB\.ref\(path\)\.update\(p\.patch\)/, '그 회차 자리에 칸만 얹지 않는다(통째로 덮어쓴다)');
  assert.match(fn, /filedPatch\(/);
  assert.match(cut('function updateFiledBtn('), /isDone\(r\)&&isOwner\(r\)/, '남의 것·작업중에도 켜진다');
});
