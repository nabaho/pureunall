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

test('ⓑ ERP 업체관리가 회사 원본이고 기업정보함은 담당자를 보충한다', () => {
  const companies = { v: { co1: { id: 'co1', name: '가나시험상사', bizNo: '123-45-67890', ceo: 'ERP대표',
    zipcode: '31000', address: '천안시 ERP로 1', phone: '041-111-2222', fax: '041-111-2223', email: 'erp@example.com',
    bizType: '서비스', bizCategory: '자문', companySize: '소기업', primaryContactName: '주담당', primaryContactPhone: '010-1111-2222' } } };
  const rows = CF.mergeRows(IDX, companies);
  const hit = CF.searchCompanies(rows, '가나')[0];
  assert.equal(hit.k, 'erp'); assert.equal(hit.companyId, 'co1'); assert.equal(hit.ceo, 'ERP대표');
  assert.equal(hit.ad, '(31000) 천안시 ERP로 1'); assert.equal(hit.bi, '자문');
  assert.equal(CF.searchCompanies(rows, 'ERP대표')[0].companyId, 'co1', 'ERP 대표자 이름으로도 찾아야 합니다');
  const contacts = CF.contactsOf(rows, hit);
  assert.ok(contacts.some((x) => x.n === '주담당'), 'ERP 주담당자가 빠졌습니다');
  assert.ok(contacts.some((x) => x.n === '김담당'), '기업정보함 명함 담당자가 빠졌습니다');
});

test('ⓑ 담당자 — 이름이 조금 달라도 같은 회사 명함', () => {
  const rows = CF.rowsOf(IDX);
  const co = CF.searchCompanies(rows, '가나')[0];
  assert.deepEqual(CF.contactsOf(rows, co).map((r) => r.n).sort(), ['김담당', '이사원']);
  assert.deepEqual(CF.searchPeople(rows, '박근').map((r) => r.n), ['박근로']);
  assert.deepEqual(CF.searchPeople(rows, '3333').map((r) => r.n), ['박근로']);
});

test('ⓑ 담당자 검색 — 회사 안팎의 명함과 ERP 주담당자를 기본정보로 찾는다', () => {
  const rows = CF.mergeRows(IDX, { v: { co1: { id:'co1', name:'가나시험상사', bizNo:'1234567890',
    primaryContactName:'ERP주담당', primaryContactPhone:'010-9999-8888', primaryContactEmail:'main@example.com' } } });
  const co = CF.searchCompanies(rows, '가나')[0];
  assert.deepEqual(CF.searchContacts(rows, '', co).map((r) => r.n).sort(), ['ERP주담당', '김담당', '이사원']);
  assert.equal(CF.searchContacts(rows, '과장', co)[0].n, '김담당');
  assert.equal(CF.searchContacts(rows, '다른회사', co)[0].n, '박근로', '다른 회사 담당자도 직접 검색할 수 있어야 합니다');
  assert.equal(CF.searchContacts(rows, '99998888', co)[0].n, 'ERP주담당');
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
  assert.equal(V.담당자직급, '과장'); assert.equal(V.담당자휴대폰, '010-0000-1111');
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

test('ⓑ 줄 정보는 «값을 넣은 문단만» 걷는다 — 꽉 찬 서식이 넘치지 않게', () => {
  const x = '<hp:p id="1"><hp:run><hp:t>회사 가나&amp;다</hp:t></hp:run><hp:linesegarray><hp:lineseg a="1"/></hp:linesegarray></hp:p>'
    + '<hp:p id="2"><hp:run><hp:t>그대로</hp:t></hp:run><hp:linesegarray><hp:lineseg a="2"/></hp:linesegarray></hp:p>';
  const out = CF.stripLinesegsFor(x, ['가나&다']);
  assert.ok(out.indexOf('a="1"') < 0, '값을 넣은 문단의 줄 정보가 남았습니다');
  assert.ok(out.indexOf('a="2"') >= 0, '손대지 않은 문단의 줄 정보까지 걷었습니다');
  assert.equal(CF.stripLinesegsFor(x, ['1']), x, '한 글자 값은 문단을 가리지 못한다 — 걷지 않는다');
  const html = read('docs-esign.html');
  assert.match(html, /PuFormCardFill\.stripLinesegsFor\(x, vals\)/, '채우기가 문단만 걷는 길을 쓰지 않습니다');
});

test('ⓑ 엑셀 — 표지 하나뿐인 칸은 숫자·날짜로, 섞인 글은 글자로, 공유 글자도 바꾼다', () => {
  const O = '{{', C = '}}', m = (k) => O + k + C;
  const sheet = '<row r="3"><c r="B3" s="5" t="inlineStr"><is><t xml:space="preserve">' + m('회사명') + '</t></is></c>'
    + '<c r="D3" s="6" t="inlineStr"><is><t>' + m('계약일') + '</t></is></c>'
    + '<c r="K3" t="inlineStr"><is><t>' + m('계약금액') + '</t></is></c>'
    + '<c r="J3" t="inlineStr"><is><t>' + m('담당자') + ' ' + m('담당자연락처') + '</t></is></c>'
    + '<c r="F3" t="inlineStr"><is><t>' + m('주민번호') + '</t></is></c></row>';
  const sst = '<sst><si><t>계약자 ' + m('회사명') + '</t></si></sst>';
  assert.deepEqual(CF.xlsxMarkers([sheet, sst]), ['회사명', '계약일', '계약금액', '담당자', '담당자연락처', '주민번호']);
  const V = { 회사명: '가나&상사', 계약일: '2026-09-27', 계약금액: '220,000', 담당자: '김', 담당자연락처: '010', 주민번호: '900101-1000000' };
  const r = CF.xlsxFill(sheet, V);
  assert.match(r.xml, /<c r="B3" s="5" t="inlineStr"><is><t xml:space="preserve">가나&amp;상사<\/t>/);
  assert.match(r.xml, /<c r="D3" s="6"><v>46292<\/v><\/c>/, '날짜는 엑셀 날짜 번호로 — 서식의 EDATE 가 셈한다');
  assert.match(r.xml, /<c r="K3"><v>220000<\/v><\/c>/, '금액은 숫자로');
  assert.match(r.xml, /김 010/);
  assert.match(r.xml, /900101-1000000/, '주민번호는 숫자로 바꾸지 않는다(- 가 있다)');
  assert.equal(CF.xlsxFill(sst, V).xml, '<sst><si><t>계약자 가나&amp;상사</t></si></sst>');
  assert.equal(CF.excelDate('2026년 9월 27일'), 46292);
  assert.equal(CF.valuesFrom({ co: { ad: '천안시' } }).우편주소, '(     ) 천안시', '엑셀 틀은 주소 앞 8글자를 우편번호로 자른다');
  assert.equal(CF.valuesFrom({ co: { ad: '(31000) 천안시' } }).우편주소, '(31000) 천안시');
});

test('ⓑ 엑셀 — 표시 없는 기존 서식도 항목명 오른쪽 빈칸을 자동으로 채운다', () => {
  const names = ['xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml'];
  const sheet = '<worksheet><sheetData><row r="1">'
    + '<c r="A1" t="s"><v>0</v></c><c r="B1" s="2"/>'
    + '<c r="C1" t="inlineStr"><is><t>사업자등록번호</t></is></c><c r="D1" s="3"></c>'
    + '<c r="E1" t="inlineStr"><is><t>계산식</t></is></c><c r="F1"><f>1+1</f><v>2</v></c>'
    + '</row></sheetData></worksheet>';
  const sst = '<sst><si><t>상호</t></si></sst>';
  assert.deepEqual(CF.xlsxMarkersParts(names, [sheet, sst]), ['회사명', '사업자번호']);
  const r = CF.xlsxFillParts(names, [sheet, sst], { 회사명: '가나&상사', 사업자번호: '123-45-67890' });
  assert.match(r.xmls[0], /r="B1" s="2" t="inlineStr"[\s\S]*가나&amp;상사/);
  assert.match(r.xmls[0], /r="D1" s="3" t="inlineStr"[\s\S]*123-45-67890/);
  assert.match(r.xmls[0], /<c r="F1"><f>1\+1<\/f><v>2<\/v><\/c>/, '수식은 건드리면 안 됩니다');
});

test('ⓑ 엑셀 — 글꼴·줄바꿈·행높이 XML을 보존하고 글자만 바꾼다', () => {
  const rich = '<worksheet><sheetData><row r="4" ht="31.5" customHeight="1"><c r="B4" s="9" t="inlineStr"><is>'
    + '<r><rPr><b/><sz val="11"/></rPr><t>{{회사명}}</t></r><r><rPr><i/></rPr><t> 귀중</t></r>'
    + '</is></c></row></sheetData></worksheet>';
  const out = CF.xlsxFill(rich, { 회사명:'가나상사' }).xml;
  assert.match(out, /<row r="4" ht="31\.5" customHeight="1">/, '행 높이를 바꾸면 안 됩니다');
  assert.match(out, /<c r="B4" s="9" t="inlineStr">/, '셀 스타일을 바꾸면 안 됩니다');
  assert.match(out, /<rPr><b\/><sz val="11"\/><\/rPr><t>가나상사<\/t>/, '첫 글꼴 꾸밈을 보존해야 합니다');
  assert.match(out, /<rPr><i\/><\/rPr><t> 귀중<\/t>/, '표지가 아닌 글자와 꾸밈을 보존해야 합니다');
});

test('ⓒ 엑셀 배선 — 양식 창이 xlsx 원본을 고르고, 문서관리가 엑셀 길로 보낸다', () => {
  const forms = read('js/pu-contract-forms.js'), html = read('docs-esign.html');
  assert.match(forms, /hwp\|hwpx\|xlsx/, '엑셀 원본을 채울 원본으로 고르지 않습니다');
  assert.match(forms, /accept: '\.hwpx,\.hwp,\.xlsx/, '엑셀을 올릴 수 없습니다');
  assert.match(html, /if \(formIsXlsx\(name\)\)/, '엑셀을 한글 엔진으로 엽니다');
  assert.match(read('js/pu-office-store.js'), /'xlsx', 'xls'/, '원본 보관함이 엑셀을 받지 않습니다');
});

test('ⓒ 문서관리는 ERP 업체관리와 기업정보함을 함께 읽고 원본 누락 시 다른 보관본을 찾는다', () => {
  const html = read('docs-esign.html'), forms = read('js/pu-contract-forms.js');
  assert.match(html, /ref\('data\/companies'\)/, 'ERP 업체관리를 읽지 않습니다');
  assert.match(html, /PuFormCardFill\.mergeRows/, 'ERP 업체와 명함을 한 검색목록으로 합치지 않습니다');
  assert.match(forms, /다른 보관본을 확인하는 중/, '선택한 원본이 없어질 때 대체본을 찾지 않습니다');
  assert.match(forms, /placeholder: '담당자 이름·회사·직급·전화·이메일'/, '담당자 검색칸이 없습니다');
  assert.match(forms, /CF\.searchContacts\(/, '기업정보함 담당자 검색을 실제로 부르지 않습니다');
  assert.match(forms, /찾는 명함이 없습니다 — 오른쪽 빈칸에 직접 적으세요/, '검색 결과가 없을 때 직접 입력 안내가 없습니다');
});
