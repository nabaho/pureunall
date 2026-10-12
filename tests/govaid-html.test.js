/* 정부지원금 화면(pu-govaid.html) — 문법·싣는 순서·쓰는 자리·☐+번호 (2026-10-11)
   ★ 주석은 걷고 본다 — 주석에 적힌 글자로 통과하지 않게. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-govaid.html'), 'utf8');
const NOC = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('인라인 스크립트가 문법에 맞다', () => {
  const blocks = [...NOC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b, i) => assert.doesNotThrow(() => new vm.Script(b), 'inline script #' + i));
});

test('엔진·묶음·씨앗 모듈을 캐시 번호와 함께 싣는다', () => {
  ['pu-govaid-match', 'pu-govaid-view', 'pu-govaid-seed', 'pu-govaid-records'].forEach((n) =>
    assert.match(NOC, new RegExp('src="js/' + n + '\\.js\\?v=\\d+"'), n));
});

test('저장 관문을 Firebase 초기화 전에 싣고, 강제 모드 관문으로만 쓴다', () => {
  const gw = NOC.indexOf('js/pu-ontology-write.js'), init = NOC.indexOf('initializeApp(');
  assert.ok(gw > 0 && init > gw, '관문이 초기화보다 먼저여야 한다');
  assert.match(NOC, /createGateway\(\{\s*mode:'enforce'/);
  assert.doesNotMatch(NOC, /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove|transaction)\(/, '관문을 건너뛴 쓰기');
});

test('쓰는 자리는 govaid 아래 네 곳뿐이다', () => {
  const refs = [...NOC.matchAll(/gate\.(?:save|remove)\(fbDb\.ref\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(refs.length >= 1);
  refs.forEach((r) => assert.match(r, /^govaid\/(programs|prospects|extras|reviews)\//, r));
});

test('자료 표는 맨 왼쪽 ☐ + 번호 — 보기 전용 표만 예외(data-viewonly)', () => {
  const lines = NOC.split('\n').filter((l) => l.indexOf('<table') >= 0);
  assert.ok(lines.length >= 1);
  lines.forEach((l) => assert.ok((/data-all=/.test(l) && /번호/.test(l)) || /data-viewonly/.test(l), l.trim().slice(0, 140)));
});

test('예비 고객은 업체관리 원장(data/companies)에 쓰지 않는다 — 읽기만', () => {
  assert.doesNotMatch(NOC, /gate\.(?:save|remove)\(fbDb\.ref\('data\//);
});

test('잴 수 있는 조건이 없으면 확정하지 않는다 — 화면도 엔진과 같은 잣대(judge, «사람이 볼 조건»만은 안 됨)', () => {
  const has = NOC.slice(NOC.indexOf('function hasCond('), NOC.indexOf('function hasCond(') + 400);
  assert.match(has, /GovaidMatch\.judge\(/);
  assert.match(has, /!==\s*'manual'/);
  const fn = NOC.slice(NOC.indexOf('function confirmOne('), NOC.indexOf('function confirmOne(') + 600);
  assert.match(fn, /hasCond\(/);
});

test('찬 자리 거래에서 접히는 공용 gate.remove 를 쓰지 않고, 지우기·확정은 GovaidRecords 로 만든다', () => {
  assert.doesNotMatch(NOC, /gate\.remove\(/);
  assert.match(NOC, /GovaidRecords\.softDeleted\(/);
  assert.match(NOC, /GovaidRecords\.confirmed\(/);
});

test('회사·사업을 바꾸면 그 화면의 고르기(☐)를 푼다 — 안 보이는 쌍에 검토가 저장되지 않게', () => {
  const fn = NOC.slice(NOC.indexOf('function clickReview('), NOC.indexOf('function clickReview(') + 1400);
  const co = fn.slice(fn.indexOf("'[data-co]'"), fn.indexOf("'[data-co]'") + 200);
  const pg = fn.slice(fn.indexOf("'[data-pg]'"), fn.indexOf("'[data-pg]'") + 200);
  assert.match(co, /dropPicked\(\[[^\]]*'coCand'/);
  assert.match(pg, /dropPicked\(\[[^\]]*'progCand'/);
});

test('예비 고객을 업체와 이으면 그때 값을 업체 보충값의 빈 칸으로 옮긴다', () => {
  const fn = NOC.slice(NOC.indexOf('async function saveSubject('), NOC.indexOf('async function saveSubject(') + 3000);
  assert.match(fn, /GovaidRecords\.carryToCompany\(/);
});

test('예비 고객 → 업체 잇기는 사업자번호 10자리가 같아야 한다(이름만으로 잇지 않는다)', () => {
  const fn = NOC.slice(NOC.indexOf('function checkLink('), NOC.indexOf('function checkLink(') + 700);
  assert.match(fn, /length!==10/);
  assert.match(fn, /validateCompanyLink\(/);
});

test('검토 저장은 «그때의 판정»을 함께 남기고, 업체면 companyId · 예비 고객이면 원본 짝(sourceKind·sourceId)', () => {
  const fn = NOC.slice(NOC.indexOf('function saveReview('), NOC.indexOf('function saveReview(') + 1200);
  assert.match(fn, /snapshot:GovaidView\.snapshot\(/);
  assert.match(fn, /companyId=/);
  assert.match(fn, /sourceKind=/);
  assert.match(fn, /sourceId=/);
});

test('한 번에 고친 검토는 사유를 지우지 않는다(사유를 안 넘기면 앞 사유를 둔다)', () => {
  const fn = NOC.slice(NOC.indexOf('function saveReview('), NOC.indexOf('function saveReview(') + 1200);
  assert.match(fn, /reason==null\s*\?\s*\(prev\.reason\|\|''\)/);
});

test('조건 편집기는 AI 조사 초안의 확신도·메모를 보여 준다 — 확정하는 사람이 «확인 못 한 점»을 보고 정하게', () => {
  const fn = NOC.slice(NOC.indexOf('function drawEditor('), NOC.indexOf('function drawEditor(') + 4000);
  assert.match(fn, /aiDraft/);
  assert.match(fn, /esc\([^)]*notes/);
});

test('사업 중심 목록은 부처(관)로 묶고, 목록 칸이 넓다 — 사업 이름이 보이게 (대표 지시 2026-10-12)', () => {
  const body = SRC.match(/function drawProg\(\)\{[\s\S]*?\n\}/);
  assert.ok(body, 'drawProg 를 찾지 못함');
  assert.match(body[0], /GovaidView\.byMinistry\(/, '부처 묶음을 쓰지 않는다');
  assert.match(body[0], /GovaidView\.shortTitle\(/, '앞의 «2026년»을 떼지 않는다');
  assert.match(SRC, /id="p-prog">\s*<div class="split wide">/, '사업 중심 칸이 넓지 않다');
});
