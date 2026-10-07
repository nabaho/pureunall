'use strict';
/* 서식 묶음 채우기 A 단계 — 세트 + 여러 양식 한 번에 (설계 docs/superpowers/specs/2026-09-28-서식-묶음-채우기-design.md §2)
   ■ 지키는 것
     ⓐ 세트는 통표·거래(changeSets) 한 길 — 서버 최신본 위에 한 건만 고친다.
     ⓑ 기본 세트(체당금 접수)는 들어오고, 지우면 다시 안 생긴다.
     ⓒ 채울 자리는 양식들의 합집합 — 겹치는 칸은 한 번, 어느 양식에 쓰이는지 모두.
     ⓓ 묶음 속 파일 이름은 번호가 붙어 겹치지 않고, 파일 이름에 못 쓰는 글자가 없다.
     ⓔ 묶음 창은 양식 «여러 개»를 받는다 — 한 장 창을 복제하지 않고 넓힌다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const CF = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(CF, box);
  return box.PuContractForms;
}
const out = (v) => JSON.parse(JSON.stringify(v));
function fakeDb(store) {
  return { store, ref(p) { return {
    once() { return Promise.resolve({ val: () => store[p] == null ? null : JSON.parse(JSON.stringify(store[p])) }); },
    transaction(fn, done) { const next = fn(store[p] == null ? null : JSON.parse(JSON.stringify(store[p]))); store[p] = JSON.parse(JSON.stringify(next)); done(null, true, { val: () => store[p] }); }
  }; } };
}

test('ⓑ 기본 세트 — 체당금 접수 세트가 들어오고, 지우면 안 돌아온다', () => {
  const P = loadCF();
  const a = out(P.setsOf(null));
  const ch = a.filter((s) => s.id === 'fs-chedang')[0];
  assert.ok(ch, '기본 세트가 없습니다');
  assert.deepEqual(ch.formIds, ['fm-case-cd-01', 'fm-case-cd-02', 'fm-case-cd-03', 'fm-case-cd-04']);
  assert.equal(ch.side, 'worker'); assert.equal(ch.groupName, '체당금');
  assert.ok(!out(P.setsOf({ v: [], rm: ['fs-chedang'] })).some((x) => x.id === 'fs-chedang'), '★ 지운 기본 세트가 되살아났습니다');
  /* 2026-10-07 업무별 기본 세트 — 자문·급여는 이알피 계약서 출력(CONTRACT_SETS)과 같은 양식 */
  assert.deepEqual(a.map((s) => s.id), ['fs-advisory', 'fs-payroll', 'fs-fund', 'fs-union', 'fs-chedang']);
  assert.deepEqual(a.filter((s) => s.id === 'fs-advisory')[0].formIds, out(P.CONTRACT_SETS.advisory));
  assert.deepEqual(a.filter((s) => s.id === 'fs-payroll')[0].formIds, out(P.CONTRACT_SETS.payroll));
  const mine = { id: 'fs-1', name: '부해 세트', formIds: ['x'] };
  assert.deepEqual(out(P.setsOf({ v: [mine], rm: [] })).map((s) => s.id), ['fs-1', 'fs-advisory', 'fs-payroll', 'fs-fund', 'fs-union', 'fs-chedang']);
  assert.deepEqual(out(P.setsOf({ v: { 0: mine }, rm: [] })).map((s) => s.id), ['fs-1', 'fs-advisory', 'fs-payroll', 'fs-fund', 'fs-union', 'fs-chedang'], '열쇠 지도 꼴도 읽는다');
});

test('ⓐ ★★ changeSets — 서버 최신본 위에 한 건만, u 를 올린다', async () => {
  const P = loadCF();
  const db = fakeDb({ 'data/contract_form_sets': { v: [{ id: 'fs-other', name: '남이 만든 세트', formIds: ['a'] }], rm: ['fs-x'], u: 5 } });
  const mine = { id: 'fs-new', name: '가나 세트', formIds: ['b'] };
  const list = out(await P.changeSets(db, (doc) => { doc.v.push(mine); return doc; }));
  const saved = db.store['data/contract_form_sets'];
  assert.deepEqual(saved.v.map((s) => s.id), ['fs-other', 'fs-new'], '★★ 그사이 남이 만든 세트를 지웠습니다');
  assert.deepEqual(saved.rm, ['fs-x'], '지운 기본 세트 기록을 잃었습니다');
  assert.ok(saved.u > 5);
  assert.ok(list.some((s) => s.id === 'fs-new') && list.some((s) => s.id === 'fs-chedang'), '돌려준 목록에 기본 세트가 빠졌습니다');
});

test('ⓐ 화면의 세트 저장도 그 한 길로 — 통째 set 금지', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  assert.ok(!/\.set\(/.test(m), '★★ 화면이 통째로 set 합니다');
  assert.match(m, /changeSets\(db,/, '세트를 거래로 저장하지 않습니다');
});

test('ⓒ 채울 자리 합집합 — 겹치는 칸은 한 번, 쓰이는 양식 모두', () => {
  const P = loadCF();
  const items = [
    { name: '위임약정서', markers: ['근로자명', '착수금', '계약일'] },
    { name: '위임장', markers: ['근로자명', '근로자연락처', '계약일'] },
    { name: '동의서', markers: ['근로자명', '근로자주소'] }
  ];
  assert.deepEqual(out(P.bundleMarkers(items)), [
    { key: '근로자명', forms: ['위임약정서', '위임장', '동의서'] },
    { key: '착수금', forms: ['위임약정서'] },
    { key: '계약일', forms: ['위임약정서', '위임장'] },
    { key: '근로자연락처', forms: ['위임장'] },
    { key: '근로자주소', forms: ['동의서'] }
  ]);
  assert.deepEqual(out(P.bundleMarkers([])), []);
});

test('ⓓ 묶음 파일 이름 — 번호, 겹침 없음, 못 쓰는 글자 없음', () => {
  const P = loadCF();
  const V = { 회사명: '가나/상사', 근로자명: '홍길동' };
  const names = out(P.bundleFileNames([
    { name: '위임장', ext: '.hwp' }, { name: '위임장', ext: '.hwp' }, { name: 'CMS: 신청서?', ext: '.xlsx' }, { name: '안내', ext: '.txt' }
  ], V));
  assert.deepEqual(names, ['01_위임장_가나_상사_홍길동.hwp', '02_위임장_가나_상사_홍길동.hwp', '03_CMS_ 신청서__가나_상사_홍길동.xlsx', '04_안내_가나_상사_홍길동.txt']);
  assert.equal(new Set(names).size, names.length);
  names.forEach((n) => assert.ok(!/[\\/:*?"<>|]/.test(n), n));
  assert.equal(P.zipName('체당금 접수 세트', V), '체당금 접수 세트_가나_상사_홍길동.zip');
  assert.equal(P.zipName('', {}), '서식묶음.zip');
});

test('ⓔ 묶음 창은 양식 여러 개를 받는다 — 한 장 창은 그 위에 얹힌다', () => {
  const s = stripJs(CF);
  assert.match(s, /function openFill\(fms, host, title\)/, '★ 채우기 창이 양식 하나만 받습니다');
  const f = cutFn(s, 'function openFill(');
  assert.match(f, /bundleMarkers\(/, '채울 자리를 양식들 합집합으로 모으지 않습니다');
  assert.match(f, /host\.zip\(/, '여러 양식을 압축으로 묶지 않습니다');
  const m = cutFn(s, 'function mount(');
  assert.match(m, /openFill\(\[fm\], host/, '한 장 「채워서 받기」가 같은 창을 쓰지 않습니다');
});

test('목록 체크·아래 막대·세트 고르기', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  assert.match(cutFn(m, 'function listCol('), /type: 'checkbox'/, '목록 줄에 체크 칸이 없습니다');
  assert.match(m, /function bundleBar\(/, '아래 막대가 없습니다');
  /* 2026-10-07 화면 개편 — 세트는 왼쪽 나무(넓은 화면)와 위 고르기 칸(휴대폰) */
  assert.match(cutFn(m, 'function drawTree('), /applySet\(st\.id\)/, '왼쪽 나무에 세트가 없습니다');
  assert.match(cutFn(m, 'function mobileSelects('), /setPicker\(\)/, '휴대폰에서 세트를 고를 길이 없습니다');
});

test('문서관리가 묶음 압축 함수를 양식 화면에 넘긴다 — 브라우저 안에서만 묶는다', () => {
  const html = fs.readFileSync(path.join(R, 'docs-esign.html'), 'utf8');
  assert.match(html, /zip: formZip[,\s}]/,'★ host.zip 이 연결되지 않아 묶음 받기가 늘 실패합니다');
  const fn = cutFn(stripJs(html), 'async function formZip(');
  assert.match(fn, /_esignLoadJsZip\(\)/);
  assert.ok(!/fetch\(|db\.ref|\.set\(|\.push\(/.test(fn), '채운 파일을 어디로도 보내면 안 됩니다');
});

/* ── 검토 반영 (2026-09-28) ── */
test('★★ 불러오기 안내는 양식마다 상태에서 — 멈춘 안내·숨은 실패가 없다', () => {
  const f = cutFn(stripJs(CF), 'function openFill(');
  const rf = cutFn(f, 'function refresh(');
  assert.match(rf, /btnDown\.disabled = n > 0 \|\| busy/, '★ 불러오는 중·묶는 중에 받기 단추가 잠기지 않습니다');
  assert.match(rf, /state === 'fail'/, '실패한 양식을 모아 알리지 않습니다');
  assert.ok(!/pending\s*[-+]{2}/.test(f), '★ 개수 세기가 남아 있습니다 — 늦게 끝난 옛 불러오기가 안내를 멈춰 둡니다');
  assert.match(cutFn(f, 'function loadAll('), /reduce\(/, '원본을 한꺼번에 엽니다 — 하나씩 차례로 열어야 메모리가 안 부풉니다');
  const dl = cutFn(f, 'function doDownload(');
  assert.ok(dl.indexOf("w.confirm(") < dl.indexOf('function next('), '★ 원본 못 찾은 양식을 채우기 «전에» 묻지 않습니다');
  assert.match(dl, /if \(busy\) return;/, '받기를 두 번 누르면 채우기가 겹쳐 돕니다');
});

test('파일 이름 — 방향 바꾸는 글자·앞 점·지나친 길이를 걷는다', () => {
  const P = loadCF();
  const long = '가'.repeat(100);
  const n = out(P.bundleFileNames([{ name: long + '‮', ext: '.hwp' }], { 회사명: long, 근로자명: '   ' }))[0];
  assert.ok(!/‮/.test(n), '방향 바꾸는 글자가 남았습니다');
  assert.ok(n.length <= 2 + 1 + 40 + 1 + 30 + 4, '이름이 너무 깁니다: ' + n.length);
  assert.ok(!/_\.hwp$|__/.test(n), '빈 근로자 이름이 빈 조각을 남겼습니다: ' + n);
  assert.equal(P.zipName('..숨김', {}), '숨김.zip');
});
