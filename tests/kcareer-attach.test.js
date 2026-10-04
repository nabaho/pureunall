'use strict';
/* 📎 첨부서류 만들기 (대표 승인 2026-10-03 목업)
   못 박는 것:
     ① 신청서의 «실적 표»(기관 칸이 있는 표)만 읽고, 칸 뜻(기간·구분·기관·내용)을 머리 줄에서 안다
     ② 표 속 표는 따로 센다 — 바깥 표 줄에 안쪽 글자가 섞이지 않는다
     ③ 한 칸에 기관이 여럿(「A·B·C 등」)이어도 각각으로 짝을 찾는다
     ④★ 이름만으로 저절로 붙이지 않는다 — 미리 체크는 «기관도 기간도 맞는 후보가 딱 하나»일 때뿐
     ⑤ 번호는 고른 것만, 놓인 차례대로 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../js/kcareer-attach.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

const P = (t) => '<hp:p><hp:run><hp:t>' + t + '</hp:t></hp:run></hp:p>';
const TC = (...ps) => '<hp:tc><hp:subList>' + ps.map(P).join('') + '</hp:subList></hp:tc>';
const TR = (...cs) => '<hp:tr>' + cs.join('') + '</hp:tr>';
const TBL = (...rs) => '<hp:tbl>' + rs.join('') + '</hp:tbl>';
const 실적표 = TBL(
  TR(TC('기간'), TC('구분'), TC('기관'), TC('주요 내용')),
  TR(TC('2022~ 현재'), TC('공공기관 고문'), TC('서산시설관리공단', '아산시시설관리공단'), TC('고문노무사')),
  TR(TC('2021~2024'), TC('노사관계 자문'), TC('충청남도청 · 세종시교육청 등'), TC('단체협약 자문')),
  TR(TC(''), TC(''), TC(''), TC('')));

test('① 실적 표만 읽는다 · 칸 뜻은 머리 줄에서', () => {
  const 다른표 = TBL(TR(TC('성명'), TC('권형하')), TR(TC('주소'), TC('천안')));
  const rows = A.pickRows(A.readTables(다른표 + 실적표));
  assert.equal(rows.length, 2, '빈 줄과 기관 칸 없는 표는 빠진다');
  assert.equal(rows[0].period, '2022~ 현재');
  assert.equal(rows[0].kind, '공공기관 고문');
  assert.equal(rows[0].org, '서산시설관리공단 아산시시설관리공단');
  assert.equal(rows[0].content, '고문노무사');
});

test('② 표 속 표는 따로 — 바깥 줄에 안쪽 글자가 안 섞인다', () => {
  const 바깥 = TBL(TR(TC('기간'), TC('기관')),
    TR(TC('2023'), '<hp:tc><hp:subList>' + P('한국산업안전보건공단') + TBL(TR(TC('안쪽'), TC('표'))) + '</hp:subList></hp:tc>'));
  const t = A.readTables(바깥);
  assert.equal(t.length, 2);
  const rows = A.pickRows(t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].org, '한국산업안전보건공단');
});

test('③ 한 칸에 기관 여럿 — 각각으로 짝을 찾는다', () => {
  assert.deepEqual(A.orgTokens('충청남도청 · 세종시교육청 등'), ['충청남도청', '세종시교육청']);
  assert.equal(A.orgHit('충청남도청 · 세종시교육청 등', '세종시교육청'), true);
  assert.equal(A.orgHit('충청남도청 · 세종시교육청 등', '(재)세종시교육청'), true, '재단법인 머리말은 떼고 본다');
  assert.equal(A.orgHit('서산시설관리공단', '아산시시설관리공단'), false, '★ 비슷한 이름을 같은 곳으로 보면 남의 증빙이 붙는다');
});

test('④★ 미리 체크는 «기관·기간이 다 맞는 후보가 딱 하나»일 때만', () => {
  const row = A.pickRows(A.readTables(실적표))[0];
  const 하나 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2022' }, page: 'wiccok' }]);
  assert.equal(하나.length, 1); assert.equal(하나[0].먼저, true);
  const 둘 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2022' }, page: 'wiccok' }, { r: { org: '아산시시설관리공단', period: '2023~2024' }, page: 'advisory' }]);
  assert.equal(둘.length, 2);
  assert.ok(둘.every((c) => !c.먼저), '★ 맞는 후보가 둘이면 사람이 고른다');
  const 기간다름 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2015' }, page: 'wiccok' }]);
  assert.equal(기간다름.length, 0, '기간이 겹치지 않는 같은 기관 기록은 후보에서 뺀다');
  const 기간모름 = A.candidates(row, [{ r: { org: '서산시설관리공단' }, page: 'wiccok' }]);
  assert.equal(기간모름.length, 1); assert.ok(!기간모름[0].먼저, '기간을 모르면 체크하지 않는다');
  assert.deepEqual(A.years('2022~ 현재')[0], 2022);
  assert.equal(A.years('2022~ 현재')[1], new Date().getFullYear());
});

test('⑤ 번호 — 고른 것만, 놓인 차례대로', () => {
  const items = [{ on: true }, { on: false }, { on: true }, { on: true }];
  assert.equal(A.number(items), 3);
  assert.deepEqual(items.map((x) => x.label), ['첨부 1', '', '첨부 2', '첨부 3']);
});

test('화면 — 기둥 단추 · 창 · PDF 는 목록표+머리표 · 보관함에 담는다', () => {
  assert.match(SRC, /<script src="js\/kcareer-attach\.js\?v=\d+"><\/script>/);
  assert.match(SRC, /onclick="rhAttachOpen\(\)"[^>]*>📎 첨부서류 만들기</);
  assert.ok(SRC.indexOf('id="modalAttach"') > 0);
  const i = SRC.indexOf('async function rhAttachBuild('), f = SRC.slice(i, SRC.indexOf('\nfunction openPdfBlob', i));
  assert.match(f, /_attListPages\(/, '맨 앞 목록표');
  assert.match(f, /_attStamp\(/, '장마다 머리표');
  assert.match(f, /recFileAsync\(x\.r\)/, '원본은 앱 안·서류 폴더 어디든 한 길로 읽는다');
  assert.match(f, /kind:'첨부서류'/);
  assert.doesNotMatch(f, /embedFont\(/, '★ 한글 글꼴을 PDF 에 통째로 실으면 수 MB — 글자는 그림으로');
  const o = SRC.slice(SRC.indexOf('async function rhAttachOpen('));
  assert.match(o.slice(0, 2500), /hasOriginal\(x\.r\)/, '원본 파일이 있는 기록만 후보');
  assert.match(o.slice(0, 2500), /on:!!c\.먼저/, '미리 체크는 셈이 정한 «딱 하나»만');
});

/* ── 「(첨부 n)」 적기 (대표 «추천대로» 2026-10-04) ── */
test('⑥ 「(첨부 n)」은 그 줄 «내용» 칸 끝에 — 다른 칸·다른 줄은 안 건드린다', () => {
  const rows = A.pickRows(A.readTables(실적표));
  const r = A.markRows(실적표, [{ sig: rows[1].sig, text: '(첨부 2, 3)' }]);
  assert.equal(r.n, 1);
  const 다시 = A.pickRows(A.readTables(r.xml));
  assert.equal(다시[1].content, '단체협약 자문 (첨부 2, 3)');
  assert.equal(다시[0].content, '고문노무사', '다른 줄은 그대로');
  assert.equal(다시[1].org, '충청남도청 · 세종시교육청 등', '기관 칸은 그대로');
});

test('⑥ 두 번 지어도 한 번만 · 예전 번호는 떼고 새 번호', () => {
  const rows = A.pickRows(A.readTables(실적표));
  const 한번 = A.markRows(실적표, [{ sig: rows[0].sig, text: '(첨부 1)' }]).xml;
  const 두번 = A.markRows(한번, [{ sig: rows[0].sig, text: '(첨부 4)' }]).xml;
  assert.equal(A.pickRows(A.readTables(두번))[0].content, '고문노무사 (첨부 4)', '★ 번호가 쌓이면 「(첨부 1) (첨부 4)」가 됩니다');
});

test('⑥ 못 찾는 줄 · 빈 표지 → 손대지 않는다', () => {
  assert.equal(A.markRows(실적표, [{ sig: '1999|없는기관', text: '(첨부 9)' }]).xml, 실적표);
  assert.equal(A.markRows(실적표, []).xml, 실적표);
});

test('⑥ 화면 — 창에 「표에 적기」 · 지을 때마다 얹는 표시로 남긴다(도장과 같은 길)', () => {
  assert.match(SRC, /id="atMark"[^>]*checked/);
  assert.match(SRC, /function rhAttachMarkZip\(/);
  const fin = SRC.slice(SRC.indexOf('async function rhFinishZip('), SRC.indexOf('async function rhFinishZip(') + 600);
  assert.match(fin, /rhAttachMarkZip\(zip\)/, '짓는 길 한 곳에서 얹어야 다시 채워도 남는다');
  assert.match(SRC, /attachMarks:\(typeof _rhAttachMarks!=='undefined' && _rhAttachMarks\)\|\|null/, '작성 중에 담겨야 이어서 할 때 남는다');
  assert.match(SRC, /_rhAttachMarks=null;/, '바탕이 바뀌면 놓는다');
});

test('① 「기관명」 칸만 있는 일반 현황 표는 실적 표가 아니다 (2026-10-04 실측 — 35줄이 잡혔다)', () => {
  const 현황 = TBL(TR(TC('기 관 명'), TC('푸른노무법인'), TC('사업자 등록번호'), TC('312-81-52792')),
    TR(TC('대표자명'), TC('권형하'), TC('법인등록번호'), TC('000000-0000000')));
  assert.equal(A.pickRows(A.readTables(현황 + 실적표)).length, 2, '실적 표 두 줄만');
});
