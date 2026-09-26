'use strict';
/* 한글(HWPX) XML 에서 글자를 직접 찾아 바꾸는 엔진 — js/pu-hwpx-fill.js
 * (대표 지시 2026-09-26 「줄칸 간격등 정리가 계속 안된다 … 근본적 해결 … 기존서류와 같이 사용」)
 * 픽스처는 한글이 실제로 저장한 HWPX 의 모양을 줄인 것이다(값은 가짜). */
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/pu-hwpx-fill.js');

const LS = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"/></hp:linesegarray>';
const P = (inner, ls = LS) => '<hp:p id="0" paraPrIDRef="0">' + inner + ls + '</hp:p>';
const RUN = (t, c = 0) => '<hp:run charPrIDRef="' + c + '"><hp:t>' + t + '</hp:t></hp:run>';
const TC = (inner) => '<hp:tc><hp:subList>' + inner + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/></hp:tc>';
const TBL = (...cells) => '<hp:tbl><hp:tr>' + cells.join('') + '</hp:tr></hp:tbl>';
const SEC = (...ps) => '<hs:sec>' + ps.join('') + '</hs:sec>';

test('scan — 본문·표 칸·«표 안의 표»까지 문서 차례대로 주소를 매긴다', () => {
  const inner = TBL(TC(P(RUN('신한은행'))), TC(P(RUN('10,000'))));
  const xml = SEC(P(RUN('머리말')),
    P('<hp:run>' + TBL(TC(P(RUN('4. 기금예치 계획')) + P('<hp:run>' + inner + '</hp:run>'))) + '</hp:run>'),
    P(RUN('꼬리')));
  const ps = X.scan(xml).filter((p) => p.text);
  assert.deepEqual(ps.map((p) => p.addr + '=' + p.text),
    ['P0=머리말', 'T0.C0.P0=4. 기금예치 계획', 'T1.C0.P0=신한은행', 'T1.C1.P0=10,000', 'P2=꼬리']);
});

test('★ 한 낱말이 run 여럿에 쪼개져 있어도 찾아 바꾼다 — 첫 조각 자리에 새 글, 나머지 조각은 그만큼 지운다', () => {
  const xml = SEC(P(RUN('이비공동', 1) + RUN('근로복지기금의 정관', 2)));
  const r = X.replaceText(xml, [{ find: '이비공동근로복지기금', to: '{{기금명}}', all: true }]);
  assert.equal(r.hits[0], 1);
  assert.equal(X.textOf(r.xml), '{{기금명}}의 정관');
  assert.match(r.xml, /charPrIDRef="1"><hp:t>\{\{기금명\}\}<\/hp:t>/, '글자 모양은 첫 조각의 것');
  assert.match(r.xml, /charPrIDRef="2"><hp:t>의 정관<\/hp:t>/, '뒤 조각의 모양은 그대로');
});

test('★★ 표 칸 «통째로» 바꾸기(set) — 같은 문단에 겹친 찾아 바꾸기보다 먼저, 한 번만', () => {
  const xml = SEC(P('<hp:run>' + TBL(TC(P(RUN('2020년 04월 10일')))) + '</hp:run>'));
  const r = X.replaceText(xml, [{ find: '2020', to: '{{사업연도}}', all: true }, { at: 'T0.C0.P0', set: '{{작성일}}' }]);
  assert.equal(X.textOf(r.xml), '{{작성일}}', '「20262026년…」처럼 두 번 들어가면 안 된다(실제로 그랬다)');
});

test('★★ 빈 칸에 새로 넣는다 — 한글이 저장한 빈 칸의 run 은 스스로 닫혀 있다(<hp:run …/>): 반드시 run «안»에', () => {
  const xml = SEC(P('<hp:run>' + TBL(TC(P('<hp:run charPrIDRef="7"/>'))) + '</hp:run>'));
  const r = X.replaceText(xml, [{ at: 'T0.C0.P0', set: '{{대_비유동}}' }]);
  assert.equal(r.hits[0], 1);
  assert.match(r.xml, /<hp:run charPrIDRef="7"><hp:t>\{\{대_비유동\}\}<\/hp:t><\/hp:run>/);
  assert.doesNotMatch(r.xml, /\/><hp:t>/, 'run 이 닫힌 «뒤»에 글자를 붙이면 한글이 버린다(#1584)');
});

test('set 의 주소는 정확히 — «T13.C1.P0» 이 «T13.C10.P0» 까지 잡지 않는다 / 점으로 끝나면 그 아래 전부', () => {
  assert.equal(X.atMatch('T13.C10.P0', 'T13.C1.P0'), false);
  assert.equal(X.atMatch('T13.C1.P0', 'T13.C1.P0'), true);
  assert.equal(X.atMatch('T13.C10.P0', 'T13.C1.'), false);
  assert.equal(X.atMatch('T13.C1.P2', 'T13.C1.'), true);
  assert.equal(X.atMatch('P3', null), true);
});

test('★ 글자를 바꾼 문단만 옛 줄 정보를 걷는다 — 손대지 않은 문단은 원본 그대로', () => {
  const xml = SEC(P(RUN('{{기금명}}')), P(RUN('그대로')));
  const r = X.fill(xml, { 기금명: '아주 긴 기금 이름입니다 공동근로복지기금' });
  const ps = r.xml.split('</hp:p>');
  assert.doesNotMatch(ps[0], /linesegarray/);
  assert.match(ps[1], /<hp:linesegarray>/);
  const e = X.fill(xml.replace(LS, '<hp:linesegarray/>'), { 기금명: '가' });
  assert.doesNotMatch(e.xml.split('</hp:p>')[0], /linesegarray/, '빈 줄 정보 태그(<…/>)도 걷는다');
});

test('★★ 한 줄짜리 문단은 새 글이 그 줄 폭에 들어가면 줄 정보를 «둔다» — 앱 미리보기(rhwp)가 칸 안에서 새로 나눌 때 폭을 잘못 재 한 줄 제목을 꺾었다', () => {
  /* 10pt(textheight 1000) 글, 줄 폭 20000 → 한글 스무 자쯤 들어간다 */
  const one = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="20000" flags="393216"/></hp:linesegarray>';
  const two = one.replace('</hp:linesegarray>', '<hp:lineseg textpos="12" vertpos="1600" vertsize="1000" textheight="1000" horzsize="20000"/></hp:linesegarray>');
  const fit = X.fill(SEC(P(RUN('{{기금명}}'), one)), { 기금명: '가나다공동근로복지기금' });          // 11자 — 들어간다
  assert.match(fit.xml, /horzsize="20000"/, '들어가면 원본 줄 정보 그대로');
  const over = X.fill(SEC(P(RUN('{{기금명}}'), one)), { 기금명: '아주아주긴가나다라마바사아자차카타파하공동근로복지기금' });
  assert.doesNotMatch(over.xml, /linesegarray/, '넘치면 걷는다 — 두면 한글이 한 줄에 겹쳐 찍는다');
  const multi = X.fill(SEC(P(RUN('{{기금명}} 은 여러 줄'), two)), { 기금명: '가' });
  assert.doesNotMatch(multi.xml, /linesegarray/, '여러 줄 문단은 줄 자리가 밀리므로 늘 걷는다');
  const nums = X.fill(SEC(P(RUN('{{손1_계}}'), one)), { 손1_계: '178,200' });
  assert.match(nums.xml, /horzsize="20000"/, '표 칸 숫자도 폭 안이면 원본 줄 그대로');
});

test('틀 만들 때(keep1)는 한 줄 문단의 줄 정보를 남긴다 — 들어갈지는 «채울 때» 실제 값으로 판단한다', () => {
  const one = '<hp:linesegarray><hp:lineseg textpos="0" textheight="1000" horzsize="3000"/></hp:linesegarray>';
  const r = X.replaceText(SEC(P(RUN('신한은행'), one)), [{ at: 'P0', set: '{{아주긴표지이름입니다}}' }], { lines: 'keep1' });
  assert.match(r.xml, /horzsize="3000"/);
  const a = X.replaceText(SEC(P(RUN('신한은행'), one)), [{ at: 'P0', set: '{{아주긴표지이름입니다}}' }]);
  assert.doesNotMatch(a.xml, /linesegarray/, '보통(auto)은 폭을 넘는 글이면 걷는다');
});

test('★★ 반복 묶음 {{#서명}}…{{/서명}} — 회사 수만큼 베끼고, 베낀 것마다 그 회사 값으로', () => {
  const xml = SEC(P(RUN('머리')), P(RUN('{{#서명}}{{회사}} 대표')), P(RUN('{{대표이사}} (인)')), P(RUN('{{/서명}}')), P(RUN('꼬리 {{기금명}}')));
  const e = X.expand(xml, { 기금명: '가나다', 서명: [{ 회사: 'A사', 대표이사: '김' }, { 회사: 'B사', 대표이사: '이' }] });
  const r = X.fill(e.xml, { 기금명: '가나다' });
  assert.equal(X.textOf(r.xml), '머리\nA사 대표\n김 (인)\nB사 대표\n이 (인)\n꼬리 가나다');
  assert.doesNotMatch(r.xml, /\{\{[#\/]/, '묶음 표시는 남지 않는다');
});

test('반복 묶음 — 한 문단 안에서 열고 닫아도 된다(정관 서명 줄) · 목록이 비면 «한 벌»을 빈 값으로 남긴다', () => {
  const xml = SEC(P(RUN('{{#서명}}{{회사}} {{대표이사}} (인){{/서명}}')));
  assert.equal(X.textOf(X.expand(xml, { 서명: [{ 회사: 'A', 대표이사: '김' }, { 회사: 'B', 대표이사: '이' }] }).xml), 'A 김 (인)\nB 이 (인)');
  assert.equal(X.textOf(X.expand(xml, { 서명: [] }).xml), X.BLANK + ' ' + X.BLANK + ' (인)', '서명란이 통째로 사라지면 날인받을 자리가 없다');
});

test('★★ 쪽 단위 반복 {{#쪽:확인서}} — 묶음을 품은 맨 바깥 문단째로 베끼고, 둘째부터 새 쪽 · 쪽 설정은 첫 장에만', () => {
  const first = '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:secPr id="">쪽설정</hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER"/></hp:ctrl>'
    + TBL(TC(P(RUN('{{#쪽:확인서}}{{회사}} 확인') + P(RUN('{{금액}}{{/쪽:확인서}}'))))) + '</hp:run>' + LS + '</hp:p>';
  const xml = SEC(first, P(RUN('')));
  const r = X.expand(xml, { 확인서: [{ 회사: 'A', 금액: '1원' }, { 회사: 'B', 금액: '2원' }, { 회사: 'C', 금액: '' }] });
  assert.equal(X.textOf(r.xml), 'A 확인\n1원\nB 확인\n2원\nC 확인\n' + X.BLANK);
  assert.equal((r.xml.match(/<hp:secPr/g) || []).length, 1, '구역 설정이 여러 번이면 한글이 새 구역으로 읽는다');
  assert.equal((r.xml.match(/<hp:colPr/g) || []).length, 1);
  assert.equal((r.xml.match(/pageBreak="1"/g) || []).length, 2, '둘째·셋째 장은 새 쪽에서');
});

test('drop — 문단을 통째로 없앤다(원본의 둘째 회사 서명 줄)', () => {
  const xml = SEC(P(RUN('남김')), P(RUN('둘째 회사 줄')), P(RUN('끝')));
  const r = X.replaceText(xml, [{ at: 'P1', drop: true }]);
  assert.equal(X.textOf(r.xml), '남김\n끝');
  assert.equal(r.xml.split('<hp:p ').length - 1, 2);
});

test('markers 는 반복 묶음 표시를 이름으로 세지 않는다', () => {
  assert.deepEqual(X.markers(SEC(P(RUN('{{#서명}}{{회사}}{{/서명}}')))), { 회사: 1 });
});

test('XML 특수 글자는 안전하게 — 값에 < > & 가 있어도 문서가 안 깨진다', () => {
  const r = X.fill(SEC(P(RUN('{{회사}}'))), { 회사: 'A&B <주>' });
  assert.match(r.xml, /<hp:t>A&amp;B &lt;주&gt;<\/hp:t>/);
  assert.equal(X.textOf(r.xml), 'A&B <주>');
  const s = X.replaceText(SEC(P(RUN('R&amp;D 팀'))), [{ find: 'R&D', to: '연구', all: true }]);
  assert.equal(X.textOf(s.xml), '연구 팀', '원본의 &amp; 도 글자로 읽어 찾는다');
});

test('fill — 목록 표지·밑줄·모르는 이름·몇 명 더', () => {
  const xml = SEC(P(RUN('{{근로자위원1}}|{{근로자위원2}}')), P(RUN('{{날짜}} {{새칸}}')));
  const r = X.fill(xml, { 근로자위원: ['가', '나', '다'], 날짜: '' });
  assert.equal(X.textOf(r.xml), '가|나\n' + X.BLANK + ' {{새칸}}');
  assert.deepEqual(r.unknown, ['새칸']);
  assert.deepEqual(r.over, { 근로자위원: 1 });
  assert.equal(r.filled, 2, '밑줄은 채운 것으로 세지 않는다');
});

test('fill — 번호로 끝나는 «제 이름»이 있으면 목록이 아니라 그 값 — 대_준비금1', () => {
  const r = X.fill(SEC(P(RUN('{{대_준비금1}}/{{대_준비금2}}'))), { 대_준비금1: '0', 대_준비금2: '440' });
  assert.equal(X.textOf(r.xml), '0/440');
  assert.deepEqual(r.unknown, []);
});

test('markers — 문서에 든 표지 이름과 개수(표 안까지)', () => {
  const xml = SEC(P(RUN('{{기금명}} {{회의일}}')), P('<hp:run>' + TBL(TC(P(RUN('{{기금명}}')))) + '</hp:run>'));
  assert.deepEqual(X.markers(xml), { 기금명: 2, 회의일: 1 });
});

test('★ 태그는 한 글자도 안 바뀐다 — 글자만 바뀐다(뼈대 개수 그대로)', () => {
  const xml = SEC(P(RUN('가') + RUN('{{a}}')), P('<hp:run>' + TBL(TC(P(RUN('{{b}}'))), TC(P('<hp:run charPrIDRef="1"/>'))) + '</hp:run>'));
  const r = X.fill(xml, { a: '에이', b: '비' });
  ['<hp:p ', '</hp:p>', '<hp:tc>', '</hp:tc>', '<hp:tbl>', '<hp:t>'].forEach((t) => {
    assert.equal(r.xml.split(t).length, xml.split(t).length, t + ' 개수가 달라졌다');
  });
});

/* ── 표 «줄» 반복·지우기 (② 법인설립 — 협의회 명부, 2026-09-26) ── */
const TR = (r, ...ts) => '<hp:tr>' + ts.map((t, c) => '<hp:tc><hp:subList>' + P(RUN(t)) + '</hp:subList><hp:cellAddr colAddr="' + c + '" rowAddr="' + r + '"/></hp:tc>').join('') + '</hp:tr>';
const RTBL = (n, ...rows) => SEC(P('<hp:run><hp:tbl id="1" rowCnt="' + n + '" colCnt="2">' + rows.join('') + '</hp:tbl></hp:run>'), P(RUN('꼬리')));
const rowAddrs = (xml) => [...xml.matchAll(/rowAddr="(\d+)"/g)].map((m) => +m[1]).filter((v, i, a) => i === 0 || v !== a[i - 1]);
const rowCnt = (xml) => +/rowCnt="(\d+)"/.exec(xml)[1];

test('★ 줄 반복 {{#행:…}} — 사람 수만큼 줄을 베끼고, 뒤 줄 번호와 표의 줄 수를 고친다', () => {
  const xml = RTBL(3, TR(0, '구분', '위원명'), TR(1, '{{#행:위원}}위원', '{{이름}}{{/행:위원}}'), TR(2, '　', '　'));
  const r = X.expand(xml, { 위원: [{ 이름: '갑' }, { 이름: '을' }, { 이름: '병' }] });
  assert.equal(X.textOf(r.xml), '구분\n위원명\n위원\n갑\n위원\n을\n위원\n병\n　\n　\n꼬리');
  assert.deepEqual(rowAddrs(r.xml), [0, 1, 2, 3, 4], '한글은 줄 번호가 이어지지 않으면 표를 못 그린다(빈 쪽)');
  assert.equal(rowCnt(r.xml), 5);
});

test('★★ 줄 지우기 둘 — 첫 지우기가 줄 수를 「10」→「9」로 줄여도 둘째 자리가 밀리지 않는다', () => {
  /* 실제로 그랬다: 줄 수 글자가 하나 줄어 둘째 지울 자리가 한 칸 밀렸고, 줄은 지워졌는데
     뒤 줄 번호·줄 수가 안 고쳐져 한글이 명부를 빈 쪽으로 그렸다 */
  const rows = []; for (let i = 0; i < 10; i++) rows.push(TR(i, 'r' + i, 'x' + i));
  const xml = RTBL(10, ...rows);
  const at = (t) => X.scan(xml).find((p) => p.text === t).addr;
  const r = X.dropRows(xml, [at('r5'), at('r7')]);
  assert.equal(r.hits, 2);
  assert.deepEqual(rowAddrs(r.xml), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(rowCnt(r.xml), 8);
  assert.ok(!/r5|r7/.test(X.textOf(r.xml)) && /r6/.test(X.textOf(r.xml)));
});

test('반복 값이 «숫자»면 그만큼 빈 벌 — 0 이면 묶음째 없앤다(명부의 여유 빈 줄·표 아래 빈 줄)', () => {
  const xml = RTBL(3, TR(0, '위원', '갑'), TR(1, '　{{#행:빈줄}}', '　{{/행:빈줄}}'), TR(2, '끝', '끝'));
  const two = X.expand(xml, { 빈줄: 2 }), none = X.expand(xml, { 빈줄: 0 });
  assert.equal(X.textOf(two.xml), '위원\n갑\n　\n　\n　\n　\n끝\n끝\n꼬리');
  assert.deepEqual(rowAddrs(two.xml), [0, 1, 2, 3]); assert.equal(rowCnt(two.xml), 4);
  assert.equal(X.textOf(none.xml), '위원\n갑\n끝\n끝\n꼬리');
  assert.deepEqual(rowAddrs(none.xml), [0, 1]); assert.equal(rowCnt(none.xml), 2);
  const para = X.expand(SEC(P(RUN('가')), P(RUN('{{#여백}}')), P(RUN('{{/여백}}')), P(RUN('나'))), { 여백: 0 });
  assert.equal(X.textOf(para.xml), '가\n나', '문단 묶음도 0 이면 없앤다');
  assert.equal(X.textOf(X.expand(xml, { 빈줄: [] }).xml).split('　').length - 1, 2, '빈 «목록»은 여전히 빈 한 벌(서명란)');
});
