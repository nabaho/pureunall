/* 조문번호 매김과 «인용 따라가기» — 신설·삭제로 번호가 어떻게 움직이나
   (대표 물음 2026-09-13 「신설의 경우 앞뒤 조문이 모두 움직여지지 않나?
    아니면 조문의 추가인 경우 제2항 또는 단서 추가등이 되어야 하지 않나」)

   ■ 답: 일부개정이면 «안 움직인다» — 신설은 가지번호(제15조의2)로 끼우고 기존 번호를
     그대로 둔다. 전부개정이면 제1조부터 다시 매기고, 본문 속 인용도 같이 고친다.
     ★ 그 잣대가 `numberedView`·`retargetRefs` 인데 **검사가 한 건도 없었다**(2026-09-13).
       조문 번호는 틀리면 신고 서류가 통째로 어긋나는 자리다. 여기서 못 박는다.

   ■ 재어 보다 찾은 결함
     `LAW_BEFORE` 에 「규칙」이 들어 있어 **「본 규칙 제26조」·「이 규칙 제26조」** 같은
     «우리 규칙 제 조문» 인용까지 건너뛰었다. 전부개정으로 번호를 다시 매기면 그 인용이
     옛 번호를 가리킨 채 남는다 — 노동청에 내는 서류에 어긋난 인용이 실린다.
     ⚠ 실제 파일 제4조에 「본 규칙 제26조 소정의 절차를 거쳐」가 있다.
   실행: node --test tests/rules-renumber.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');

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
function 문장(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  return RAW.slice(at, RAW.indexOf('\n', at));
}
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(문장('const LAW_BEFORE='), ctx);
  vm.runInContext(문장('const OUR_RULE_BEFORE='), ctx);
  ['function liveAnchor(', 'function computeOrdered(', 'function numberedView(',
   'function retargetRefs('].forEach(function (d) { vm.runInContext(cut(d), ctx); });
  return ctx;
}

const 조 = (id, num, title, over) =>
  Object.assign({ id: id, orig: 'x', num: num, sub: null, title: title }, over || {});
const 신설 = (id, title, after, over) =>
  Object.assign({ id: id, orig: '', title: title, insertAfter: after }, over || {});

/* ══════ ① 일부개정 — 뒤 조문이 «안» 밀린다 ══════ */

test('★★★ 신설을 끼워도 뒤 조문 번호가 «안» 움직인다 — 가지번호로 넣기 때문이다', () => {
  const c = 판();
  const v = c.numberedView([
    조('a', 15, '업무상 비밀 준수'), 조('b', 16, '겸업 금지'), 조('c', 17, '손해배상'),
    신설('n1', '개인정보의 보호', 'a')
  ], 'partial');
  const 번호 = {};
  v.forEach(function (x) { 번호[x.it.title] = x.no; });
  assert.equal(번호['개인정보의 보호'], '제15조의2', '가지번호로 안 넣습니다');
  assert.equal(번호['겸업 금지'], '제16조', '★★★ 뒤 조문이 밀렸습니다');
  assert.equal(번호['손해배상'], '제17조', '★★★ 뒤 조문이 밀렸습니다');
});

test('★ 가지번호는 «의2»부터다 — 본조가 의1이다', () => {
  const c = 판();
  const v = c.numberedView([조('a', 15, '본조'), 신설('n1', '새것', 'a')], 'partial');
  assert.equal(v.find(function (x) { return x.it.id === 'n1'; }).no, '제15조의2');
});

test('★ 같은 자리에 둘을 끼우면 의2·의3 으로 이어진다', () => {
  const c = 판();
  const v = c.numberedView([조('a', 15, '본조'), 신설('n1', '첫째', 'a'), 신설('n2', '둘째', 'a')], 'partial');
  const 번호 = {}; v.forEach(function (x) { 번호[x.it.title] = x.no; });
  assert.equal(번호['첫째'], '제15조의2');
  assert.equal(번호['둘째'], '제15조의3');
});

test('★ 이미 가지번호가 있으면 그 다음부터 — 있는 번호를 덮어쓰지 않는다', () => {
  const c = 판();
  const v = c.numberedView([
    조('a', 15, '본조'), 조('a2', 15, '이미 있는 가지', { sub: 2 }), 신설('n1', '새것', 'a')
  ], 'partial');
  assert.equal(v.find(function (x) { return x.it.id === 'n1'; }).no, '제15조의3',
    '이미 있는 제15조의2 를 덮어썼습니다');
});

test('★★ 삭제한 조는 번호를 그대로 두고 «결번»으로 남긴다 — 뒤를 당기지 않는다', () => {
  const c = 판();
  const v = c.numberedView([
    조('a', 15, '살아있음'), 조('b', 16, '지울 것', { del: true }), 조('c', 17, '뒤')
  ], 'partial');
  const 번호 = {}; v.forEach(function (x) { 번호[x.it.title] = x.no; });
  assert.equal(번호['지울 것'], '제16조', '삭제한 조의 번호가 사라졌습니다');
  assert.equal(번호['뒤'], '제17조', '★★ 삭제 때문에 뒤 조문이 당겨졌습니다');
});

test('★ 「신설 안 함」은 가지번호를 «안 먹는다» — 안 만든 것이 번호를 쓰면 안 된다', () => {
  const c = 판();
  const v = c.numberedView([
    조('a', 15, '본조'), 신설('n1', '안 할 것', 'a', { optIn: false }), 신설('n2', '할 것', 'a')
  ], 'partial');
  const 번호 = {}; v.forEach(function (x) { 번호[x.it.title] = x.no; });
  assert.equal(번호['안 할 것'], '—');
  assert.equal(번호['할 것'], '제15조의2', '안 만든 것이 의2 를 먹었습니다');
});

test('맨 끝에 넣는 신설은 «새 본조번호»다 — 가지번호가 아니다', () => {
  const c = 판();
  const v = c.numberedView([조('a', 15, '끝조'), 신설('n1', '맨끝', '__end__')], 'partial');
  assert.equal(v.find(function (x) { return x.it.id === 'n1'; }).no, '제16조');
});

/* ══════ ② 전부개정 — 다시 매긴다 ══════ */

test('★ 전부개정은 제1조부터 다시 매기고 삭제는 「—」', () => {
  const c = 판();
  const v = c.numberedView([
    조('a', 15, '첫째'), 조('b', 16, '지울 것', { del: true }), 조('c', 17, '셋째'),
    신설('n1', '새것', 'a')
  ], 'full');
  const 번호 = {}; v.forEach(function (x) { 번호[x.it.title] = x.no; });
  assert.equal(번호['첫째'], '제1조');
  assert.equal(번호['새것'], '제2조');
  assert.equal(번호['셋째'], '제3조');
  assert.equal(번호['지울 것'], '—');
});

/* ══════ ③ 인용 따라가기 ══════ */

test('★★★ 「본 규칙 제26조」·「이 규칙 제26조」는 «우리» 조문이다 — 따라 고쳐야 한다', () => {
  /* 안 고치면 전부개정 뒤에 옛 번호를 가리킨 채 노동청에 나간다.
     실제 파일 제4조에 「본 규칙 제26조 소정의 절차를 거쳐」가 있다. */
  const c = 판();
  const map = { '제26조': '제20조' };
  ['본 규칙 제26조 소정의 절차를 거쳐', '이 규칙 제26조에 따라',
   '이 취업규칙 제26조에 따라', '동 규칙 제26조'].forEach(function (t) {
    const r = c.retargetRefs(t, map);
    assert.equal(r.n, 1, '★★★ 우리 규칙 인용을 안 고쳤습니다: ' + t);
    assert.match(r.text, /제20조/);
  });
});

test('★★★ 법령·협약 인용은 «안» 고친다 — 고치면 명백한 오류다', () => {
  const c = 판();
  const map = { '제93조': '제70조', '제37조': '제31조', '제15조': '제9조' };
  ['근로기준법 제93조에 따라', '단체협약 제37조', '근로기준법 시행규칙 제15조',
   '남녀고용평등법 제37조'].forEach(function (t) {
    const r = c.retargetRefs(t, map);
    assert.equal(r.n, 0, '★★★ 법령 인용을 고쳤습니다: ' + t + ' → ' + r.text);
  });
});

test('★ 딴 회사규정 인용은 «안» 고친다 — 우리 조문이 아니다', () => {
  const c = 판();
  const map = { '제5조': '제3조' };
  ['인사규칙 제5조', '복무규칙 제5조'].forEach(function (t) {
    assert.equal(c.retargetRefs(t, map).n, 0, '딴 규정 인용을 고쳤습니다: ' + t);
  });
});

test('맨몸 인용은 고친다 — 「제37조에 정한 바에 따라」', () => {
  const c = 판();
  const r = c.retargetRefs('제37조에 정한 바에 따라', { '제37조': '제31조' });
  assert.equal(r.n, 1);
  assert.match(r.text, /제31조에 정한/);
});

test('바뀔 번호가 없으면 «안 센다» — 고친 건수가 부풀면 안 된다', () => {
  const c = 판();
  assert.equal(c.retargetRefs('제99조에 따라', { '제37조': '제31조' }).n, 0);
  assert.equal(c.retargetRefs('', {}).n, 0);
});
