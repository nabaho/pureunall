'use strict';
/* 안내문 발송 대장 — 화면 도우미(js/pu-news-noticelog.js)
   (대표 지시 2026-10-11 「파일이 언제 어떤내용으로 보냈는지 확인이 되어야 한다」 → 목업 A(안내문별)·B(파일별) → 「추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① 목록은 최근 것이 위 · 연도 칩은 «전체 · 최근 3개 연도 · 그 이전» (목업 「전체 23 · 2026 5 · 2025 6 · 2024 7 · 2023 이전 5」)
     ② 파일별 = 같은 «파일 이름»을 한 줄로 · 보낸 기록은 최근 것이 위 · «함께 보낸 파일»에 자기 자신은 없다 · 이름 없는 첨부는 파일로 안 센다
     ③ 한계(8명까지만 기록·이름 없는 첨부·사라짐)를 «말로» 알린다
     ④ 대장(CSV)은 엑셀로 열린다 — BOM · CRLF · 따옴표 · 수식으로 읽힐 글은 막는다 · 받는 «주소»는 없다
     ⑤ 실시간DB 가 비운 칸(빈 배열·빈 글자·객체 꼴 배열)과 값이 모자란 항목에도 던지지 않는다 */

const test = require('node:test');
const assert = require('node:assert');
const N = require('../js/pu-news-noticelog.js');

/* ── 가짜 대장 — 실제 분포(2018 2 · 2020 2 · 2023 1 · 2024 7 · 2025 6 · 2026 5)와 같은 23건 ── */
function 항목(날짜, 제목, 덧) {
  return Object.assign({ 제목, 날짜, 날짜들: [날짜], 시각: Date.parse(날짜 + 'T00:00:00Z'), 구분: '기타 안내', 미리보기: '안녕하세요. 푸른노무법인입니다.',
    첨부: [], 이름없는첨부: 0, 받는주소수: 24, 한통최대: 8, 업체: ['가나상사'], 명함업체: [], 업체미확인: 5,
    폴더들: [{ 이름: '예약편지함', 수: 3 }], 메일줄수: 3, 복사본수: 0, 참조: [{ 칸: 's', 번호: '1' }] }, 덧 || {});
}
function 대장23() {
  const 해별 = { 2018: 2, 2020: 2, 2023: 1, 2024: 7, 2025: 6, 2026: 5 };
  const o = {}; let i = 0;
  Object.keys(해별).forEach((y) => { for (let k = 0; k < 해별[y]; k++) { i++; o['n' + i] = 항목(y + '-0' + (1 + (k % 9)) + '-1' + (k % 9), '[푸른노무법인] ' + y + '년 안내 ' + (k + 1)); } });
  return o;
}

test('요일 말 — «10-02(금)» · 길게는 «2026-10-02(금)» · 이상한 날짜는 빈 글자', () => {
  assert.strictEqual(N.요일말('2026-10-02'), '10-02(금)');
  assert.strictEqual(N.요일말('2026-10-02', true), '2026-10-02(금)');
  assert.strictEqual(N.요일말('2024-08-01'), '08-01(목)');
  assert.strictEqual(N.요일말('2026-10-11'), '10-11(일)');
  ['', null, undefined, '2026-13-40', '2026-02-31', '10-02', 'abc'].forEach((v) => assert.strictEqual(N.요일말(v), '', String(v)));
});

test('짧은 제목 — 맨 앞 «[푸른노무법인] » 머리말만 걷는다', () => {
  assert.strictEqual(N.짧은제목('[푸른노무법인] 2026년 추석 인사드립니다.'), '2026년 추석 인사드립니다.');
  assert.strictEqual(N.짧은제목('[푸른노무법인 안내] 한 건 안내'), '한 건 안내');
  assert.strictEqual(N.짧은제목('[자율점검 관련 공지사항] 협조 요청'), '[자율점검 관련 공지사항] 협조 요청', '다른 머리말까지 걷었다');
  assert.strictEqual(N.짧은제목('[푸른노무법인]'), '[푸른노무법인]', '제목이 통째로 비면 원래 것을 둔다');
});

test('짧은 구분 — 목록 딱지의 이름과 뜻으로 가른 색 · 모르는 구분은 그대로 + 회색', () => {
  assert.deepStrictEqual(N.짧은구분('공휴일 안내'), { 이름: '공휴일', 색: 'b' });
  assert.deepStrictEqual(N.짧은구분('명절·새해 인사'), { 이름: '인사', 색: 'k' });
  assert.deepStrictEqual(N.짧은구분('지원사업·제도 안내'), { 이름: '지원·제도', 색: 'a' });
  assert.deepStrictEqual(N.짧은구분('새로 생긴 구분'), { 이름: '새로 생긴 구분', 색: 'g' });
  assert.deepStrictEqual(N.짧은구분(undefined), { 이름: '안내', 색: 'g' });
});

test('① 목록 — 최근 것이 위, 객체가 아닌 값은 건너뛰고, 열쇠를 id 로 붙인다', () => {
  const 줄 = N.목록({ a: 항목('2025-01-01', 'A'), b: 항목('2026-05-05', 'B'), c: 항목('2024-03-03', 'C'), d: null, e: 'x' });
  assert.deepStrictEqual(줄.map((x) => x.id), ['b', 'a', 'c']);
  assert.deepStrictEqual(N.목록(null), []);
  assert.strictEqual(N.목록({ a: 항목('2025-01-01', 'A') })[0].제목, 'A');
});

test('① 연도 칩 — 전체 · 최근 3개 연도 · «그 이전» (실제 분포 23건)', () => {
  const 줄 = N.목록(대장23());
  assert.strictEqual(줄.length, 23);
  assert.deepStrictEqual(N.연칩(줄).map((c) => [c.키, c.이름, c.수]),
    [['', '전체', 23], ['2026', '2026', 5], ['2025', '2025', 6], ['2024', '2024', 7], ['이전', '2023 이전', 5]]);
  /* 모자란 경우 */
  assert.deepStrictEqual(N.연칩([]).map((c) => c.이름), ['전체']);
  assert.deepStrictEqual(N.연칩([항목('2026-01-01', 'a')]).map((c) => c.이름), ['전체', '2026']);
  assert.deepStrictEqual(N.연칩([항목('2026-01-01', 'a'), 항목('2024-01-01', 'b')]).map((c) => c.이름), ['전체', '2026', '2024'], '안내문이 없는 해까지 칩이 생겼다');
});

test('① 연도로 거르기 — «이전»은 최신 연도 − 3 이하 전부', () => {
  const 줄 = N.목록(대장23());
  assert.strictEqual(N.연거르기(줄, '').length, 23);
  assert.strictEqual(N.연거르기(줄, '2025').length, 6);
  assert.strictEqual(N.연거르기(줄, '이전').length, 5);
  assert.ok(N.연거르기(줄, '이전').every((x) => Number(x.날짜.slice(0, 4)) <= 2023));
  assert.strictEqual(N.연거르기(줄, '1999').length, 0);
});

/* ───────────────────────── ② 파일별 ───────────────────────── */

function 파일대장() {
  return N.목록({
    a: 항목('2026-10-02', '[푸른노무법인] 10월 공휴일 안내', { 구분: '공휴일 안내', 첨부: ['(공문) 10월 안내_261002.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'] }),
    b: 항목('2024-09-06', '[푸른노무법인] 임시공휴일 안내', { 구분: '공휴일 안내', 첨부: ['(공문) 10월 안내_240906.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'], 받는주소수: 24 }),
    c: 항목('2024-08-01', '[푸른노무법인] 08~09월 공휴일 안내', { 구분: '공휴일 안내', 첨부: ['(공문) 08~09월 안내.pdf', '휴일대체합의서.hwp'], 이름없는첨부: 1 }),
    d: 항목('2026-01-20', '[푸른노무법인] 달라지는 노동법', { 첨부: ['2026년 달라지는 노동법.pdf'], 이름없는첨부: 2 }),
    e: 항목('2025-12-31', '[푸른노무법인] 새해 인사', { 첨부: [] })
  });
}
test('② 파일별 — 같은 이름은 한 줄 · 최근 것이 위 · 처음·마지막·횟수 · 함께 보낸 파일(자기 자신 제외)', () => {
  const 줄 = 파일대장(), 파 = N.파일들(줄);
  assert.strictEqual(파.length, 6, '파일 이름 종류가 6 이어야 한다(이름 없는 첨부는 파일이 아니다)');
  assert.strictEqual(파[0].마지막, '2026-10-02');
  const 합의서 = 파.find((f) => f.이름 === '휴일대체합의서.hwp');
  assert.strictEqual(합의서.횟수, 3);
  assert.deepStrictEqual(합의서.보냄.map((b) => b.날짜), ['2026-10-02', '2024-09-06', '2024-08-01'], '보낸 기록은 최근 것이 위');
  assert.strictEqual(합의서.처음, '2024-08-01');
  assert.strictEqual(합의서.마지막, '2026-10-02');
  assert.deepStrictEqual(합의서.보냄[0].함께.sort(), ['(공문) 10월 안내_261002.pdf', '근로자대표선임서.hwp'].sort(), '함께 보낸 파일에 자기 자신이 들었거나 빠졌다');
  assert.deepStrictEqual(합의서.보냄[2].함께, ['(공문) 08~09월 안내.pdf']);
  assert.strictEqual(합의서.종류, '한글'); assert.strictEqual(합의서.아이콘, '📝');
  assert.strictEqual(파.find((f) => f.이름 === '(공문) 10월 안내_261002.pdf').아이콘, '📕');
  assert.strictEqual(N.이름없는첨부수(줄), 3, '이름 없는 첨부 수는 따로 센다');
});
test('② 파일 칩 · 거르기 — 종류별(있는 것만) · 여러 번 보낸 것', () => {
  const 파 = N.파일들(파일대장());
  assert.deepStrictEqual(N.파일칩(파).map((c) => [c.키, c.수]), [['', 6], ['PDF', 4], ['한글', 2], ['여럿', 2]]);
  assert.strictEqual(N.파일거르기(파, 'PDF').length, 4);
  assert.deepStrictEqual(N.파일거르기(파, '여럿').map((f) => f.이름).sort(), ['근로자대표선임서.hwp', '휴일대체합의서.hwp']);
  assert.strictEqual(N.파일거르기(파, '').length, 6);
});
test('② 확장자 · 종류 말', () => {
  assert.strictEqual(N.확장자('A.B.PDF'), 'pdf'); assert.strictEqual(N.확장자('이름없음'), ''); assert.strictEqual(N.확장자(''), '');
  assert.strictEqual(N.종류말('hwpx'), '한글'); assert.strictEqual(N.종류말('xlsx'), '엑셀'); assert.strictEqual(N.종류말('zzz'), '기타');
  assert.strictEqual(N.아이콘('zzz'), '📄');
});

/* ───────────────────────── ③ 한계 · 찾기 ───────────────────────── */

test('③ 한계 말 — 8명까지만 기록 · 이름 없는 첨부 · 사라짐', () => {
  assert.deepStrictEqual(N.한계말(항목('2026-01-01', 'a', { 한통최대: 3 })), []);
  assert.match(N.한계말(항목('2026-01-01', 'a'))[0], /8명까지만 남아/);
  assert.match(N.한계말(항목('2026-01-01', 'a', { 한통최대: 3, 이름없는첨부: 2 }))[0], /첨부 2개는 파일 이름이 기록에 없습니다/);
  assert.match(N.한계말(항목('2026-01-01', 'a', { 한통최대: 3, 사라짐: 1791728481226 }))[0], /더 이상 보이지 않습니다 — 이 기록은 그대로/);
});
test('③ 메일함에서 찾기 — 가장 많은 폴더 · «Sent Messages» 는 «보낸편지함» · 제목을 안내에 싣는다', () => {
  const x = 항목('2026-01-01', '[푸른노무법인] 정상 안내', { 폴더들: [{ 이름: '내게쓴편지함', 수: 1 }, { 이름: 'Sent Messages', 수: 3 }] });
  const r = N.찾기말(x);
  assert.strictEqual(r.칸, '보낸편지함');
  assert.strictEqual(r.제목, '[푸른노무법인] 정상 안내');
  assert.match(r.안내, /푸른 메일함 › 보낸편지함 에서 「\[푸른노무법인\] 정상 안내」/);
  /* 복사했는지는 «화면이» 안다(복사는 막힐 수 있다) — 안내 글이 복사를 단정하면 막혔을 때 거짓말이 된다 */
  assert.ok(!/복사/.test(r.안내), '찾는 법 안내가 «복사했다»고 단정한다 — 복사 결과는 화면이 따로 알린다');
  assert.strictEqual(N.기록위치(x), '내게쓴편지함 1통 · 보낸편지함 3통');
  assert.strictEqual(N.찾기말({ 제목: 'x' }).칸, '', '폴더를 모르면 칸 이름 없이 안내한다');
});

/* ───────────────────────── ④ 대장(CSV) ───────────────────────── */

test('④ 대장(CSV) — BOM · CRLF · 머리 12칸 · 날짜 오름차순 번호 · 따옴표·쉼표·줄바꿈', () => {
  const 줄 = N.목록({
    b: 항목('2026-10-02', '둘째, 쉼표가 "따옴표"도 든 제목', { 첨부: ['a.pdf', 'b.hwp'], 업체: ['가나상사', '다라산업'], 미리보기: '첫줄\n둘째줄' }),
    a: 항목('2024-08-01', '첫째')
  });
  const 글 = N.대장글(줄);
  assert.strictEqual(글.charCodeAt(0), 0xFEFF, '엑셀이 한글을 못 읽는다(BOM 없음)');
  assert.ok(글.endsWith('\r\n'));
  const 줄들 = 글.slice(1).split('\r\n');
  assert.strictEqual(줄들[0].split(',').length, 12, '머리가 12칸이 아니다');
  assert.match(줄들[1], /^1,2024-08-01,/, '번호·날짜 오름차순이 아니다');
  assert.match(글, /"둘째, 쉼표가 ""따옴표""도 든 제목"/, '쉼표·따옴표를 못 감쌌다');
  assert.match(글, /"a\.pdf\nb\.hwp"/, '첨부를 한 칸에 줄바꿈으로 못 묶었다');
  assert.match(글, /"가나상사\n다라산업"/);
  assert.match(글, /"첫줄\n둘째줄"/);
  assert.ok(!/@/.test(글), '대장에 이메일 꼴이 있다');
});
test('④ 수식으로 읽힐 글(= + - @ 탭)은 앞에 \' 를 붙여 막는다', () => {
  const 글 = N.대장글(N.목록({ a: 항목('2026-01-01', '=HYPERLINK("http://x","y")'), b: 항목('2026-01-02', '+1 안내'), c: 항목('2026-01-03', '-2 안내'), d: 항목('2026-01-04', '@a 안내') }));
  ['"\'=HYPERLINK(""http://x"",""y"")"', "'+1 안내", "'-2 안내", "'@a 안내"].forEach((s) => assert.ok(글.indexOf(s) >= 0, '수식 막기가 없다: ' + s));
  assert.ok(!/(^|,)=HYPERLINK/m.test(글));
});

/* ───────────────────────── ⑤ 모자란 값 ───────────────────────── */

test('⑤ 실시간DB 가 비운 칸·객체 꼴 배열·모자란 항목에도 던지지 않는다', () => {
  const 빈 = { id: 'x' };
  const 객체꼴 = 항목('2026-01-01', 'a', { 첨부: { 0: 'a.pdf', 1: 'b.hwp' }, 업체: { 0: '가나상사' }, 폴더들: { 0: { 이름: 'Sent Messages', 수: 2 } } });
  assert.doesNotThrow(() => { N.파일들([빈]); N.한계말(빈); N.찾기말(빈); N.기록위치(빈); N.받은곳수(빈); N.대장글([빈]); N.연칩([빈]); N.목록({ a: {} }); });
  assert.deepStrictEqual(N.파일들([Object.assign({ id: 'o' }, 객체꼴)]).map((f) => f.이름).sort(), ['a.pdf', 'b.hwp'], '객체 꼴 배열(첨부)을 못 읽는다');
  assert.strictEqual(N.받은곳수(객체꼴), 1);
  assert.strictEqual(N.찾기말(객체꼴).칸, '보낸편지함');
  assert.deepStrictEqual(N.배열로(null), []); assert.deepStrictEqual(N.배열로('x'), []);
  assert.deepStrictEqual(N.배열로({ 2: 'c', 0: 'a', 1: 'b' }), ['a', 'b', 'c'], '번호 열쇠를 숫자 차례로 안 읽는다');
});

test('화면 전용 — 서버에 옮기는 파일이 아니다(sync-news-lib 대상 아님) · DOM·DB 를 부르지 않는다', () => {
  const fs = require('node:fs'), path = require('node:path');
  const 소스 = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-news-noticelog.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\bdocument\b|\bwindow\b|\blocalStorage\b|\bfirebase\b|\bfetch\(/.test(소스), '순수 도우미가 DOM·DB 를 부른다');
  const sync = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'sync-news-lib.js'), 'utf8');
  assert.ok(!/pu-news-noticelog/.test(sync), '화면 전용 파일이 서버 사본 목록에 들어 있다');
});
