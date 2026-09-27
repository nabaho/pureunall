'use strict';
/* 계약서 양식 › 📝 채워서 받기 — 기업정보함에서 회사·담당자·근로자를 골라 채운다 (대표 지시 2026-09-27)
   ⓐ 기업정보함 이름 다듬기가 pu-cards.html 의 _norm 과 «글자 하나까지» 같다 (다르면 coInfo 를 조용히 못 찾는다)
   ⓑ 회사·담당자·사람 찾기, 값 만들기, 글자 본문 채우기
   ⓒ 배선 — 문서관리가 모듈을 싣고, 기업정보함은 idx·coInfo 한 칸만 «읽기», items(사진)는 안 읽는다, 쓰기 없음 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const CF = require('../js/pu-form-cardfill.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 가짜 자료 — 실제 고객 이름·번호를 쓰지 않는다(사업자번호는 123- 으로 시작) */
const IDX = {
  b1: { k: 'biz', c: '㈜가나시험상사', bz: '1234567890', ceo: '홍길동', ad: '충남 천안시 시험로 1', ct: '041-000-0001', bt: '제조', bi: '부품' },
  c1: { k: 'card', c: '가나시험상사', n: '김담당', ti: '과장', m: '010-0000-1111', e: 'kim@example.com' },
  c2: { k: 'card', c: '(주)가나시험상사', n: '이사원', m: '010-0000-2222' },
  c3: { k: 'card', c: '다른회사', n: '박근로', m: '010-0000-3333', ad: '천안시 시험동 2' },
  c4: { k: 'card', c: '명함만회사', n: '최대리', m: '010-0000-4444' },
  x1: { k: 'memo', n: '버릴 줄' }
};

test('ⓐ coNorm 은 기업정보함 _norm 과 같다', () => {
  const src = read('pu-cards.html');
  const m = /const _norm = s => (String\(s\|\|''\)[^;]*);/.exec(src);
  assert.ok(m, 'pu-cards.html 에서 _norm 을 못 찾았습니다');
  const mine = CF.coNorm.toString();
  assert.ok(mine.replace(/\s+/g, '').indexOf(m[1].replace(/\s+/g, '').replace(/^String\(s\|\|''\)/, '')) >= 0,
    '이름 다듬기가 기업정보함과 다릅니다: ' + m[1]);
  assert.equal(CF.coNorm('㈜ 가나.상사'), '가나상사');
});

test('ⓐ coInfo 열쇠 — 번호 열쇠가 위, 옛 이름 열쇠가 아래', () => {
  assert.deepEqual(CF.coInfoKeys({ c: '㈜가나', bz: '123-45-67890' }), ['n가나', '1234567890']);
  assert.deepEqual(CF.coInfoKeys({ c: '가나' }), ['n가나']);
  assert.deepEqual(CF.coInfoKeys({}), []);
  assert.deepEqual(CF.mergeCoInfo([{ workers: '10', bizType: '옛' }, { bizType: '새' }]), { wk: '10', bt: '새' });
});

test('ⓑ 회사 찾기 — 등록증 먼저, 명함에만 있는 회사도 한 줄', () => {
  const rows = CF.rowsOf(IDX);
  assert.equal(rows.length, 5, 'biz·card 만 남아야 합니다');
  const hit = CF.searchCompanies(rows, '가나');
  assert.equal(hit.length, 1, '같은 회사는 한 줄');
  assert.equal(hit[0].k, 'biz');
  assert.equal(CF.searchCompanies(rows, '123456')[0].c, '㈜가나시험상사');
  assert.equal(CF.searchCompanies(rows, '홍길동')[0].c, '㈜가나시험상사');
  const only = CF.searchCompanies(rows, '명함만');
  assert.equal(only.length, 1); assert.equal(only[0].k, 'card-co');
  assert.deepEqual(CF.searchCompanies(rows, ''), []);
});

test('ⓑ 담당자 — 이름이 조금 달라도 같은 회사 명함', () => {
  const rows = CF.rowsOf(IDX);
  const co = CF.searchCompanies(rows, '가나')[0];
  assert.deepEqual(CF.contactsOf(rows, co).map((r) => r.n).sort(), ['김담당', '이사원']);
  assert.deepEqual(CF.searchPeople(rows, '박근').map((r) => r.n), ['박근로']);
  assert.deepEqual(CF.searchPeople(rows, '3333').map((r) => r.n), ['박근로']);
});

test('ⓑ 값 — 회사·담당자·근로자, 주민번호는 비운다', () => {
  const rows = CF.rowsOf(IDX);
  const co = Object.assign({ sme: '소기업' }, CF.searchCompanies(rows, '가나')[0]);
  const V = CF.valuesFrom({ co, contact: IDX.c1, worker: IDX.c3, today: new Date(2026, 8, 27) });
  assert.equal(V.회사명, '㈜가나시험상사');
  assert.equal(V.사업자번호, '123-45-67890');
  assert.equal(V.대표자, '홍길동');
  assert.equal(V.주소, '충남 천안시 시험로 1');
  assert.equal(V.업태, '제조'); assert.equal(V.규모, '소기업');
  assert.equal(V.담당자, '김담당'); assert.equal(V.담당자연락처, '010-0000-1111'); assert.equal(V.담당자이메일, 'kim@example.com');
  assert.equal(V.근로자명, '박근로'); assert.equal(V.근로자이름, '박근로'); assert.equal(V.근로자연락처, '010-0000-3333');
  assert.equal(V.근로자주소, '천안시 시험동 2');
  assert.equal(V.주민번호, ''); assert.equal(V.근로자주민, '');
  assert.equal(V.오늘날짜, '2026-09-27');
});

test('ⓑ 글자 본문 채우기 — 모르는 이름·빈 값은 밑줄', () => {
  const body = '성명 : ' + CF.BLANK.slice(0, 0) + '{{근로자명}} / 회사 {{회사명}} / {{주민번호}} / {{없는칸}} / {{회사명}}';
  assert.deepEqual(CF.markersIn(body), ['근로자명', '회사명', '주민번호', '없는칸']);
  const out = CF.fillText(body, { 근로자명: '박근로', 회사명: '가나', 주민번호: '' });
  assert.equal(out, '성명 : 박근로 / 회사 가나 / ' + CF.BLANK + ' / ' + CF.BLANK + ' / 가나');
  assert.deepEqual(CF.hwpValues(['회사명', '없는칸'], { 회사명: '가나' }), { 회사명: '가나', 없는칸: '' });
  assert.equal(CF.safeName('위임장_가/나'), '위임장_가_나');
});

test('ⓑ 기본 양식의 근로자·회사 표지는 모두 값 함수가 안다', () => {
  const src = read('js/pu-contract-forms.js');
  const V = CF.valuesFrom({});
  const need = ['회사명', '사업자번호', '대표자', '주소', '대표전화', '대표이메일', '담당자', '담당자연락처', '담당자이메일',
    '근로자명', '근로자이름', '근로자주소', '근로자연락처', '주민번호', '근로자주민', '오늘날짜'];
  need.forEach((k) => {
    assert.ok(src.indexOf('{{' + k + '}}') >= 0, k + ' 가 양식에 없습니다');
    assert.ok(k in V, k + ' 를 값 함수가 모릅니다');
  });
});

test('ⓒ 배선 — 문서관리가 모듈을 싣고 창에 연결한다', () => {
  const html = read('docs-esign.html');
  const a = html.indexOf('<script src="js/pu-form-cardfill.js'), b = html.indexOf('<script src="js/pu-contract-forms.js');
  assert.ok(a > 0 && a < b, '채우기 모듈을 양식 화면보다 먼저 실어야 합니다');
  ['cards: formCards()', 'hwpBytes: formHwpBytes', 'hwpMarkers: formHwpMarkers', 'hwpFill: formHwpFill', 'hwpShow: formHwpShow']
    .forEach((s) => assert.ok(html.indexOf(s) >= 0, s + ' 연결이 없습니다'));
  const forms = read('js/pu-contract-forms.js');
  assert.match(forms, /openFill\(fm, host\)/, '[채워서 받기] 단추가 없습니다');
  ['cards.rows()', 'cards.coInfo(', 'hwpBytes(', 'hwpMarkers(', 'hwpFill(', 'hwpShow('].forEach((s) =>
    assert.ok(forms.indexOf('host.' + s) >= 0, 'host.' + s + ' 를 부르지 않습니다'));
});

test('ⓒ 기업정보함은 읽기만 — idx·coInfo 한 칸, 사진(items)은 안 읽는다', () => {
  const html = read('docs-esign.html');
  const start = html.indexOf('function formCards()'), end = html.indexOf('function formHwpBytes');
  const fn = html.slice(start, end);
  assert.ok(fn.indexOf("'pucards/idx'") >= 0 && fn.indexOf("'pucards/coInfo/' + k") >= 0);
  assert.ok(!/\.(set|update|push|remove|transaction)\(/.test(fn), '기업정보함에 쓰면 안 됩니다');
  assert.ok(!/ref\(['"]pucards\/items/.test(html), '사진이 붙은 원본 카드(pucards/items)를 읽으면 안 됩니다');
  const forms = read('js/pu-contract-forms.js');
  const oStart = forms.indexOf('function openFill('), oEnd = forms.indexOf('function mount(');
  const ofn = forms.slice(oStart, oEnd);
  assert.ok(ofn.indexOf('db.ref') < 0 && ofn.indexOf('changeForms') < 0, '채운 값을 저장하면 안 됩니다');
});
