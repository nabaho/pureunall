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
  assert.equal(rows[0].org, '서산시설관리공단 / 아산시시설관리공단', '문단마다 적은 기관은 « / » 로 갈라 둔다');
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

test('④★ 미리 체크 — 줄에 적힌 기관마다 하나, 기간·내용이 맞을 때만', () => {
  const row = A.pickRows(A.readTables(실적표))[0];   // 2022~현재 · 서산시설관리공단 / 아산시시설관리공단 · 고문노무사
  const 하나 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2022', titleVal: '고문노무사' }, page: 'wiccok' }]);
  assert.equal(하나.length, 1); assert.equal(하나[0].먼저, true);
  /* 기관이 둘이면 «기관마다» 하나씩 */
  const 둘 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2022', titleVal: '고문노무사' }, page: 'wiccok' },
    { r: { org: '아산시시설관리공단', period: '2023~2024', titleVal: '고문노무사' }, page: 'advisory' }]);
  assert.equal(둘.filter((c) => c.먼저).length, 2, '기관마다 하나씩');
  /* 같은 기관에 «다른» 위촉이 둘 — 줄 내용과 낱말이 다 맞는 쪽만 체크(「설립심의」는 줄에 없는 말) */
  const 갈래 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2022', titleVal: '고문노무사' }, page: 'wiccok' },
    { r: { org: '서산시설관리공단', year: '2023', titleVal: '고문노무사 설립심의' }, page: 'wiccok' }]);
  assert.deepEqual(갈래.filter((c) => c.먼저).map((c) => c.r.titleVal), ['고문노무사'], '★ 줄에 없는 일(설립심의)은 사람이 보고 고른다');
  const 기간다름 = A.candidates(row, [{ r: { org: '서산시설관리공단', year: '2015', titleVal: '고문노무사' }, page: 'wiccok' }]);
  assert.equal(기간다름.length, 0, '기간이 겹치지 않는 같은 기관 기록은 후보에서 뺀다');
  const 기간모름 = A.candidates(row, [{ r: { org: '서산시설관리공단', titleVal: '고문노무사' }, page: 'wiccok' }]);
  assert.equal(기간모름.length, 1); assert.ok(!기간모름[0].먼저, '기간을 모르면 체크하지 않는다');
  assert.deepEqual(A.years('2022~ 현재')[0], 2022);
  assert.equal(A.years('2022~ 현재')[1], new Date().getFullYear());
});

/* ── 짝짓기 다듬기 (대표 «추천대로» 2026-10-04 — 캡처: 후보 37개 · 해마다 받은 위촉장 8개) ── */
test('⑦ 같은 곳 — 이름이 같거나 지사·본부·지청·청 꼬리만 다를 때', () => {
  assert.equal(A.samePlace('충청남도', '충청남도청'), true);
  assert.equal(A.samePlace('한국전력공사', '한국전력공사경기본부'), true);
  assert.equal(A.samePlace('대전지방고용노동청', '대전지방고용노동청서산지청'), true);
  assert.equal(A.samePlace('충청남도', '충청남도경제진흥원'), false, '★ 이것을 같게 보면 「충청남도」 줄에 후보가 37개 붙는다');
  assert.equal(A.samePlace('서산시', '서산시시설관리공단'), false);
  assert.equal(A.orgHit('충청남도', '충남연구원'), false);
});

test('⑦ 내용 낱말이 맞는 위촉장이 위로 · 해마다 받은 같은 위촉은 가장 최근 하나만 체크', () => {
  const row = { period: '2018~현재', org: '충청남도', content: '노사분쟁 조정·중재단 위원' };
  const c = A.candidates(row, [
    { r: { org: '충청남도', year: '2022', titleVal: '제4기 노사분쟁 조정·중재단 위원' }, page: 'wiccok' },
    { r: { org: '충청남도', year: '2024', titleVal: '제5기 노사분쟁 조정·중재단 위원' }, page: 'wiccok' },
    { r: { org: '충청남도청', year: '2023', titleVal: '공무직 인사위원회 위원' }, page: 'wiccok' },
    { r: { org: '충청남도경제진흥원', year: '2023', titleVal: '노사분쟁 자문' }, page: 'consult' }]);
  assert.equal(c.length, 3, '진흥원은 다른 곳');
  assert.match(c[0].r.titleVal, /노사분쟁/, '내용이 맞는 것이 위');
  const 체크 = c.filter((x) => x.먼저);
  assert.equal(체크.length, 1);
  assert.match(체크[0].r.titleVal, /제5기/, '★ 해마다 받은 같은 위촉은 가장 최근 것');
  /* 한 줄에 맡은 일이 둘이면 «일마다» 가장 최근 하나 */
  const 두일 = A.candidates({ period: '2018~현재', org: '충청남도', content: '노사분쟁 조정·중재단 위원, 공무직 인사위원회 위원' }, [
    { r: { org: '충청남도', year: '2026', titleVal: '제5기 충청남도 노사분쟁 조정·중재단 위원' }, page: 'wiccok' },
    { r: { org: '충청남도', year: '2022', titleVal: '제4기 노사분쟁 조정·중재단 위원' }, page: 'wiccok' },
    { r: { org: '충청남도청', year: '2023', titleVal: '공무직 인사위원회 위원' }, page: 'wiccok' }]);
  assert.deepEqual(두일.filter((x) => x.먼저).map((x) => x.r.year).sort(), ['2023', '2026']);
});

test('⑦ 이름 변형 — 가운데 몇 자만 다른 같은 곳', () => {
  assert.equal(A.samePlace('서산시비정규직지원센터', '서산시비정규직근로자지원센터'), true);
  assert.equal(A.samePlace('서산시시설관리공단', '아산시시설관리공단'), false);
  assert.equal(A.samePlace('충청남도', '충청남도경제진흥원'), false);
  assert.equal(A.samePlace('한국전력공사', '한국가스공사'), false);
  assert.equal(A.samePlace('청소년상담복지센터협의회', '한국청소년상담복지센터협의회'), true, '머리의 「한국」만 다른 이름');
  assert.equal(A.samePlace('전력공사', '한국전력공사'), false, '다섯 자 안 되는 이름은 머리 떼기로 맞추지 않는다');
});

test('⑦ 경력(재직) 표 줄은 표시가 붙는다 — 화면이 맨 아래에 접어 둔다', () => {
  const 인적 = TBL(TR(TC('성 명'), TC('권형하')), TR(TC('경 력')), TR(TC('연 도'), TC('기 관 명'), TC('직 위')),
    TR(TC('2017.10～현재'), TC('푸른노무법인'), TC('대표')));
  const rows = A.pickRows(A.readTables(인적 + 실적표));
  assert.equal(rows[0].career, true);
  assert.ok(rows.slice(1).every((r) => !r.career), '실적 표 줄은 경력이 아니다');
  const SRCs = SRC.slice(SRC.indexOf('function rhAttachDraw('));
  assert.match(SRCs.slice(0, 4000), /showCareer/, '경력 줄은 접었다 펼친다');
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
