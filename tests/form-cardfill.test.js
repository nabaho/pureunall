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
  /* 2026-09-28 — 채우기 창이 양식 «여러 개»를 받도록 넓어졌다(묶음 채우기). 한 장은 [fm] 으로 부른다 */
  assert.match(forms, /openFill\(\[fm\], host\)/, '[채워서 받기] 단추가 없습니다');
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

/* 2026-10-03 — 6종 엑셀 틀 검증 중 발견: 표지가 있는 틀에서도 이름표 짐작이 돌아
   「소 재 지」 병합 칸 안쪽(E12 등)에 값이 더 들어갔다. */
const XL_SHEET = (cells, merges) => '<worksheet><sheetData><row r="1">' + cells + '</row></sheetData>'
  + (merges ? '<mergeCells count="1"><mergeCell ref="' + merges + '"/></mergeCells>' : '') + '</worksheet>';
test('ⓓ 엑셀 — 표지가 하나라도 있으면 이름표 옆 빈칸을 짐작해 채우지 않는다', () => {
  const sheet = XL_SHEET('<c r="A1" t="inlineStr"><is><t>주소</t></is></c><c r="B1" s="1"/>'
    + '<c r="C1" t="inlineStr"><is><t>{{회사명}}</t></is></c>');
  const r = CF.xlsxFillParts(['xl/worksheets/sheet1.xml'], [sheet], { 회사명: '가나상사', 주소: '천안시 가나로 1' });
  assert.ok(r.xmls[0].includes('가나상사'), '표지는 채운다');
  assert.ok(!r.xmls[0].includes('가나로'), '표지가 있는 틀에서 이름표 짐작으로 주소를 넣었다');
  assert.deepStrictEqual(CF.xlsxMarkersParts(['xl/worksheets/sheet1.xml'], [sheet]), ['회사명']);
});
test('ⓓ 엑셀 — 표지 없는 옛 틀은 여전히 이름표로 채우되, 병합 칸 안쪽에는 안 쓴다', () => {
  const inner = XL_SHEET('<c r="A1" t="inlineStr"><is><t>주소</t></is></c><c r="B1" s="1"/>', 'A1:C1');
  const r1 = CF.xlsxFillParts(['xl/worksheets/sheet1.xml'], [inner], { 주소: '천안시 가나로 1' });
  assert.ok(!r1.xmls[0].includes('가나로'), 'B1 은 이름표 병합(A1:C1) 안쪽 — 쓰면 안 보이는 값이 남는다');
  const free = XL_SHEET('<c r="A1" t="inlineStr"><is><t>주소</t></is></c><c r="B1" s="1"/>');
  const r2 = CF.xlsxFillParts(['xl/worksheets/sheet1.xml'], [free], { 주소: '천안시 가나로 1' });
  assert.ok(r2.xmls[0].includes('가나로'), '병합이 아니면 예전처럼 채운다');
});

/* 2026-10-03 기금 제안서 PR1 — 제안서 자동 값 (설계 2026-09-29 §5). 가짜 이름만 쓴다. */
test('ⓔ 제안서 값 — 기업: 수신자=회사명, 참조=부서 이름 직급님, 호칭=귀사', () => {
  const V = CF.valuesFrom({ co: { c: '가나상사(주)' }, contact: { n: '박담당', ti: '과장', d: '총무팀' } });
  const P = CF.proposalValues(V, { orgType: 'co', amount: '', vat: 'incl', staffName: '홍길동', today: new Date(2026, 8, 29) });
  assert.strictEqual(P.수신자, '가나상사(주)');
  assert.strictEqual(P.참조, '총무팀 박담당 과장님');
  assert.strictEqual(P.호칭, '귀사');
  assert.strictEqual(P.송부일자, '2026. 9. 29. (화)');
  assert.strictEqual(P.담당노무사, '홍길동');
  assert.strictEqual(P.노무사연락처, '041-556-0035');
  assert.strictEqual(P.견적금액, ''); assert.strictEqual(P.비용합계, '');
});
test('ⓔ 제안서 값 — 기관: 수신자에 부서·이름·직급님, 참조는 -, 호칭=귀 기관', () => {
  const V = CF.valuesFrom({ co: { c: '가나도청' }, contact: { n: '홍길동', ti: '주무관', d: '노동정책과' } });
  const P = CF.proposalValues(V, { orgType: 'org', today: new Date(2026, 9, 3) });
  assert.strictEqual(P.수신자, '가나도청 노동정책과 홍길동 주무관님');
  assert.strictEqual(P.참조, '-');
  assert.strictEqual(P.호칭, '귀 기관');
  assert.strictEqual(P.송부일자, '2026. 10. 3. (토)');
});
test('ⓔ 제안서 값 — 담당자를 모르면 참조는 「담당자」, 기관 수신자는 회사명만', () => {
  const V = CF.valuesFrom({ co: { c: '가나상사(주)' } });
  assert.strictEqual(CF.proposalValues(V, { orgType: 'co' }).참조, '담당자');
  assert.strictEqual(CF.proposalValues(V, { orgType: 'org' }).수신자, '가나상사(주)');
});
test('ⓔ 견적 — 포함이면 합계=금액, 별도면 ×1.1 반올림', () => {
  const V = CF.valuesFrom({});
  const a = CF.proposalValues(V, { amount: '5,000,000', vat: 'incl' });
  assert.deepStrictEqual([a.견적금액, a.부가세, a.비용합계], ['5,000,000원', '포함', '5,000,000원']);
  const b = CF.proposalValues(V, { amount: '1000000', vat: 'excl' });
  assert.deepStrictEqual([b.견적금액, b.부가세, b.비용합계], ['1,000,000원', '10% 별도', '1,100,000원']);
  const c = CF.proposalValues(V, { amount: '333,333', vat: 'excl' });
  assert.strictEqual(c.비용합계, '366,666원');
  assert.strictEqual(CF.proposalValues(V, { amount: '가나', vat: 'excl' }).견적금액, '');
});
test('ⓔ PROPOSAL_KEYS 는 9개 자리', () => {
  assert.deepStrictEqual(CF.PROPOSAL_KEYS, ['수신자', '참조', '호칭', '송부일자', '담당노무사', '노무사연락처', '견적금액', '부가세', '비용합계']);
});

/* 2026-10-03 기금 제안서 PR3 — 메일 기본값·보낸 기록 (설계 2026-09-29 §7) */
test('ⓕ 메일 기본값 — 담당자·대표 메일, 제목·본문 틀', () => {
  const V = Object.assign(CF.valuesFrom({ co: { c: '가나상사(주)', e: 'ceo@example.com' }, contact: { n: '박담당', ti: '과장', d: '총무팀', e: 'park@example.com' } }),
    { 수신자: '가나상사(주)', 참조: '총무팀 박담당 과장님', 호칭: '귀사', 담당노무사: '홍길동', 노무사연락처: '041-556-0035' });
  const m = CF.mailDefaults(V, '공동근로복지기금 제안서 및 견적서');
  assert.deepStrictEqual(m.to.map(x => x.v), ['park@example.com', 'ceo@example.com']);
  assert.match(m.to[0].label, /담당자 메일 · 박담당/);
  assert.strictEqual(m.subject, '[푸른노무법인] 공동근로복지기금 제안서 및 견적서 — 가나상사(주)');
  assert.match(m.body, /^총무팀 박담당 과장님, 안녕하십니까\./);
  assert.match(m.body, /푸른노무법인 홍길동 노무사입니다/);
  assert.match(m.body, /귀사의 공동근로복지기금 설립과 관련하여/);
  assert.match(m.body, /홍길동 드림 · 041-556-0035$/);
});
test('ⓕ 메일 기본값 — 참조가 「-」면 수신자, 같은 메일은 한 번, 회사 없으면 제목 꼬리 없음', () => {
  const V = { 수신자: '가나도청 노동정책과 홍길동 주무관님', 참조: '-', 담당자이메일: 'a@example.com', 대표이메일: 'a@example.com' };
  const m = CF.mailDefaults(V, '제안서');
  assert.deepStrictEqual(m.to.map(x => x.v), ['a@example.com']);
  assert.strictEqual(m.subject, '[푸른노무법인] 제안서');
  assert.match(m.body, /^가나도청 노동정책과 홍길동 주무관님, 안녕하십니까\./);
});
test('ⓕ 보낸 기록 열쇠 — 사업자번호 숫자와 이름 열쇠 둘 다(업무관리가 둘 다 읽는다)', () => {
  assert.deepStrictEqual(CF.sentKeys({ bz: '123-45-67890', c: '가나상사(주)' }, { 회사명: '가나상사(주)' }), ['1234567890', 'n' + CF.coNorm('가나상사(주)')]);
  assert.deepStrictEqual(CF.sentKeys({ c: '가나상사' }, {}), ['n' + CF.coNorm('가나상사')]);
  assert.deepStrictEqual(CF.sentKeys({}, {}), []);
});
test('ⓕ 보낸 기록 한 줄 — 받는 주소는 남기지 않는다', () => {
  const r = CF.sentRecord({ at: 5, by: 'p001@pureun.kr', kind: '제안서', names: ['a.hwp', '', 'a.pdf'], who: '박담당', to: 'park@example.com', cc: 'x@example.com' });
  assert.deepStrictEqual(r, { at: 5, by: 'p001@pureun.kr', kind: '제안서', names: ['a.hwp', 'a.pdf'], card: '', who: '박담당' });
  assert.ok(JSON.stringify(r).indexOf('@example.com') < 0);
  assert.strictEqual(CF.SENT_KIND_OF('제안서·견적서'), '제안서');
  assert.strictEqual(CF.SENT_KIND_OF('계약서'), '계약서');
  assert.strictEqual(CF.SENT_KIND_OF(''), '계약서');
});

test('ⓑ 위임계약서 고르기 값 — 위임사무·위임내용·부가세·기간 연장·성공보수 (설계 2026-10-03 §2.2·2.3)', () => {
  const v = CF.caseValues({ task: 'harass', wtask: 'arrears', vat: 'excl', ext: 'auto', succ: 'rate', succAmt: '10' });
  assert.equal(v.위임분야, '직장 내 괴롭힘 대응');
  assert.equal(v.위임사무, '1. 직장 내 괴롭힘 대응에 관한 일체의 사항');
  assert.match(v.위임내용, /^미지급임금 및 퇴직금 체불/);
  assert.equal(v.부가세처리, '부가세 별도');
  assert.match(v.기간연장, /자동 연장/);
  assert.equal(v.성공보수, '총 수령금액의 10%(부가세 별도)');
  const f = CF.caseValues({ vat: 'incl', succ: 'fixed', succAmt: '3,000,000' });
  assert.equal(f.성공보수, '금 3,000,000원(부가세 포함)');
  assert.match(f.기간연장, /합의로 위 기간을 연장/, '기본은 당사자 합의로 연장');
  assert.equal(f.위임분야, '', '고르지 않으면 비운다(지어내지 않는다)');
  /* 「…과 관련하여」 앞에 들어가므로 받침 있는 말로 끝나야 한다 */
  CF.CASE_TASKS.filter((t) => t.area).forEach((t) => {
    const c = t.area.charCodeAt(t.area.length - 1) - 0xAC00;
    assert.ok(c >= 0 && c % 28 !== 0, t.area + ' 은 받침이 없어 「…과」가 어색합니다');
  });
  CF.CASE_KEYS.forEach((k) => assert.ok(k in v, k + ' 를 값 함수가 모릅니다'));
});

test('ⓒ 위임계약 칸 배선 — 표지가 있으면 고르기 칸이 열리고, 고른 값은 손댄 값보다 앞서지 않는다', () => {
  const forms = read('js/pu-contract-forms.js');
  assert.match(forms, /function drawCase\(/, '위임계약 고르기 칸이 없습니다');
  assert.match(forms, /CF\.CASE_KEYS\.indexOf\(x\.key\)/, '표지로 칸을 여닫지 않습니다');
  const vi = forms.indexOf('CF.caseValues(st.wi)'), ei = forms.indexOf("Object.keys(st.edits).forEach(function (k) { V[k] = st.edits[k]; });");
  assert.ok(vi > 0 && ei > vi, '사람이 고친 값(edits)이 고르기 값보다 나중에 와야 합니다');
  assert.match(forms, /\[propBox, caseBox, valBox\]/);
});

/* ══ 채우기 전 확인표 (대표 「추천대로」 2026-10-05, 목업 승인) ══ */
test('ⓓ 확인표 — 이알피 줄에 같은 회사 등록증을 붙이고, 다른 칸만 찾는다', () => {
  const idx = { b1: { k: 'biz', c: '㈜가나시험상사', bz: '1234567890', ceo: '김철수', ad: '충청남도 천안시 서북구 시험로 12, 3층(시험동)', ct: '041-000-0001' } };
  const rows = CF.mergeRows(idx, { v: { co1: { id: 'co1', name: '가나시험상사(천안)', bizNo: '123-45-67890', ceo: '홍길동',
    zipcode: '31000', address: '충남 천안시 서북구 시험로 12', phone: '010-0000-9999' } } });
  assert.equal(rows.length, 1, '등록증 줄이 검색목록에 다시 나오면 안 된다(한 회사 한 줄)');
  assert.equal(rows[0]._biz.ceo, '김철수');
  const c = CF.coConflicts(rows[0]);
  assert.deepEqual(c.map((x) => x.key), ['대표자'], '주소(시·도 줄임·층수)·이름(괄호)·전화(휴대폰↔사무실)는 같은 것으로 봐야 한다');
  assert.deepEqual(CF.coConflicts(CF.rowsOf(idx)[0]), [], '등록증 줄 자체는 견줄 것이 없다');
  assert.equal(CF.sameField('ad', '충남 천안시 동남구 남부대로 118', '충청남도 천안시 동남구 천안천변길 223'), false);
  assert.equal(CF.sameField('ad', '천안시 수신면 5산단로 253', '천안시 수신면 5 산단로 253'), true);
  assert.equal(CF.sameField('c', '주식회사코엘이엔지', '주식회사 코웰이엔지'), false, '한 글자 다른 상호는 잡아야 한다');
  assert.equal(CF.sameField('ceo', '홍길동, 김철수', '홍길동'), true, '공동대표');
});

test('ⓓ 확인표 — 칸마다 출처, 고른 쪽 표시', () => {
  const rows = CF.mergeRows({ b1: { k: 'biz', c: '가나시험상사', bz: '1234567890', ceo: '김철수', ad: '천안시 시험로 1' } },
    { v: { co1: { id: 'co1', name: '가나시험상사', bizNo: '1234567890', ceo: '홍길동', address: '천안시 시험로 1' } } });
  const co = rows[0], conflicts = CF.coConflicts(co);
  const src = (k, o) => CF.fieldSource(k, Object.assign({ co, conflicts }, o)).label;
  assert.equal(src('회사명'), '이알피·등록증');
  assert.equal(src('대표자'), '⚠ 다름'); assert.equal(src('대표자전체'), '⚠ 다름');
  assert.equal(src('대표자', { picks: { ceo: 'biz' } }), '등록증 (고름)');
  assert.equal(src('대표자', { edits: { 대표자: '직접' } }), '직접');
  assert.equal(src('계약금액', { contract: { 계약금액: '300,000' }, contractWins: true }), '이알피 계약');
  assert.equal(src('법인등록번호'), '없음');
  assert.equal(src('담당자', { contact: { k: 'card', n: '이영희' } }), '명함');
});

test('ⓓ 확인표 배선 — 고른 값이 채우기에 들어가고, 안 고르고 받으면 한 번 묻는다', () => {
  const s = read('js/pu-contract-forms.js');
  assert.match(s, /CF\.coConflicts\(st\.co\)\.forEach\(function \(c\) \{ if \(st\.srcPick\[c\.f\] === 'biz'\) co\[c\.f\] = c\.biz; \}\);\s*var V = CF\.valuesFrom/,
    '등록증을 고른 값이 valuesFrom 전에 들어가야 대표자전체·우편주소도 같이 바뀐다');
  ['doDownload', 'doMail', 'doEdit'].forEach((fn) => {
    const i = s.indexOf('function ' + fn + '()');
    assert.ok(i > 0 && s.slice(i, i + 600).indexOf('conflictsOkToGo()') > 0, fn + ' 가 다른 칸을 묻지 않습니다');
  });
  assert.match(s, /st\.srcPick = \{\}; st\.ok = \{\};/, '회사를 바꾸면 고른 것이 지워져야 한다');
});

/* ══ 🏛 국세청 상태 (대표 「추천대로」 2026-10-05) ══ */
test('ⓔ 국세청 — 기업정보함 coNtsCls 와 같은 답, 물어본 날과 함께', () => {
  const src = read('pu-cards.html');
  const m = /function coNtsCls\(word\)\{[\s\S]*?\n\}/.exec(src);
  assert.ok(m, 'pu-cards.html 에서 coNtsCls 를 못 찾았습니다');
  const theirs = new Function(m[0] + '; return coNtsCls;')();
  ['계속사업자', '휴업자', '폐업자', '국세청에 등록되지 않은 사업자등록번호입니다.', '', '알 수 없음'].forEach((w) =>
    assert.equal(CF.ntsCls(w), theirs(w), '「' + w + '」 판정이 기업정보함과 다릅니다'));
  assert.deepEqual(CF.mergeCoInfo([{ ntsState: '계속사업자', ntsAt: '2026-09-30' }]), { ns: '계속사업자', na: '2026-09-30' });
  const T = new Date(2026, 9, 5);
  const ok = CF.ntsView({ word: '계속사업자', at: '2026-09-30' }, T);
  assert.equal(ok.bad, false); assert.equal(ok.stale, false); assert.equal(ok.text, '국세청: 계속사업자 · 2026-09-30 확인');
  const old = CF.ntsView({ word: '계속사업자', at: '2026-01-02' }, T);
  assert.equal(old.stale, true, '90일 넘으면 다시 물어볼 것'); assert.match(old.text, /\(276일 전\)/);
  const gone = CF.ntsView({ word: '폐업자', at: '2026-10-01', end: '2025-03-01' }, T);
  assert.equal(gone.bad, true); assert.equal(gone.text, '국세청: 폐업자 (2025-03-01 폐업) · 2026-10-01 확인');
  assert.equal(CF.ntsView({}, T).text, '국세청 확인 기록 없음');
  assert.equal(CF.ntsView({ word: '국세청에 등록되지 않은 사업자등록번호입니다.', at: '2026-10-05' }, T).text, '국세청: 등록되지 않은 번호 · 2026-10-05 확인');
  assert.equal(CF.ntsView({}, T).stale, true);
  assert.equal(CF.ntsWordOf({ b_stt: '', tax_type: '국세청에 등록되지 않은 사업자등록번호입니다.' }), '국세청에 등록되지 않은 사업자등록번호입니다.');
  assert.equal(CF.ntsEndOf({ end_dt: '20250301' }), '2025-03-01');
});

test('ⓔ 국세청 배선 — 번호만 보내고 기업정보함에 쓰지 않으며, 휴·폐업이면 받기 전에 묻는다', () => {
  const html = read('docs-esign.html');
  const i = html.indexOf('function formNtsCheck');
  assert.ok(i > 0); const fn = html.slice(i, html.indexOf('\n}', i));
  assert.match(fn, /data\/app_config\/ntsKey/); assert.match(fn, /b_no: \[/);
  assert.ok(!/pucards|\.set\(|\.update\(/.test(fn), '기업정보함은 남의 자료 — 쓰면 안 된다');
  assert.match(html, /ntsCheck: formNtsCheck/);
  const s = read('js/pu-contract-forms.js');
  assert.match(s, /function conflictsOkToGo\(\) \{\s*var nv = ntsNow\(\);\s*if \(nv && nv\.bad && !w\.confirm/);
  assert.match(s, /st\.ntsLive = null;/, '회사를 바꾸면 방금 물어본 값이 지워져야 한다');
});
/* 2026-10-09 — 위임장·계약서에 「공동근로복지기금 설립과 관련하여」가 붙던 것 바로잡음 · 공단에 보낼 때 본문 */
test('ⓕ 메일 기본값 — 기금 서류만 기금 문장, 공단이면 「담당자님 … 제출합니다」', () => {
  const V = { 회사명: '가나상사(주)', 담당노무사: '홍길동' };
  const a = CF.mailDefaults(V, '건강보험 EDI 업무대행 위임장');
  assert.doesNotMatch(a.body, /공동근로복지기금/);
  assert.match(a.body, /가나상사\(주\) 관련 건강보험 EDI 업무대행 위임장을 보내드립니다/);
  const b = CF.mailDefaults({}, '위임장');
  assert.match(b.body, /요청하신 위임장을 보내드립니다/);
  const g = CF.mailDefaults(V, '고용·산재 보험사무대행 위임장', { agency: true });
  assert.match(g.body, /^담당자님, 안녕하십니까\./);
  assert.match(g.body, /가나상사\(주\) 사업장의 고용·산재 보험사무대행 위임장을 제출합니다\./);
  assert.match(CF.mailDefaults(V, '공동근로복지기금 제안서').body, /공동근로복지기금 설립과 관련하여/);
  assert.match(CF.mailDefaults({}, '자문계약서 (푸른 표준)').body, /자문계약서 \(푸른 표준\)를 보내드립니다/);
});
