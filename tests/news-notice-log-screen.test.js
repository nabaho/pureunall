'use strict';
/* 뉴스레터 › 안내문 › «지난 안내문» (다음메일 발송 대장) 화면
   (대표 지시 2026-10-11 「다음메일함에서 비정기적으로 자문사에 안내문을 보낸적이 많이 있다 … 파일이 언제 어떤내용으로
    보냈는지 확인이 되어야 한다」 → 목업 A(안내문별)·B(파일별) → 「추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① 안내문 탭을 열면 대장을 «한 번만» 읽는다 — 그리고 «읽기만» 한다(쓰기·지우기 0)
     ② 사람이 보낸 메일에서 온 글(제목·파일 이름·업체 이름·미리보기)은 전부 걸러 그린다 — 마크업으로 읽히지 않는다
     ③ onclick 안에는 사람이 쓴 글이 «들어가지 않는다» — 서버가 만든 열쇠나 줄 번호뿐 (따옴표 하나에 화면이 깨진다)
     ④ 받는 «주소»는 화면·대장(CSV)에 나오지 않는다 — 서버가 실수로 실어도 걸러진다
     ⑤ 안내문별 ⇄ 파일별, 연도·종류 칩, 더 보기, 상세, 파일 한 개의 «보낸 기록» — 서로 오가도 상태가 새지 않는다
     ⑥ 쓰던 초안이 있으면 초안이 먼저다 — 초안 편집 화면에는 폰에서 목록을 접는 칸(.det)을 걸지 않는다
        (초안 편집엔 ‹ 목록 단추가 없어, 접으면 돌아올 길이 사라진다)
     ⑦ 읽지 못했을 때·읽는 중·기록 없음 — 각각 말이 다르고, 읽지 못했을 땐 «다시 읽기»가 있다
     ⑧ 대장 내려받기 = BOM 이 있는 CSV · 메일함에서 찾기 = 제목 복사 + 푸른 메일 열기
     ⑨ 폰에서 상세는 뒤로가기 «한 층» — 뒤로가기는 앱을 나가지 않고 목록으로, ‹ 목록은 층을 빼고, 탭을 떠나면 걷는다
        (대표 지시 2026-08-30 「스마트폰 가장 아래 뒤로가기 버튼을 누르면 … 직전에 눌렀던 화면으로」)
     ⑩ 상세로 들어가면 «상세의 맨 위»가 보인다 — 폰은 맨 위로(돌아오면 보던 자리로), 넓은 화면은 맨 위가 «가려졌을 때만» 올린다
        (긴 목록을 내려 보다 줄을 눌렀는데 상세가 화면 밖이면 «아무 일도 없는 것»처럼 보인다)
   ⚠ 화면 코드는 vm 에 «실제로» 올려 돌린다 — 글자만 찾는 검사는 템플릿 안 코드가 지워져도 초록이다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 화면올리기 } = require('./helpers/news-screen-vm.js');
const { stripComments } = require('./strip-comments.js');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n');
const 화면글 = stripComments(원문);
const 서울 = (s) => Date.parse(s + '+09:00');
const 복사 = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/* 실시간DB 가 주는 꼴 그대로 — 빈 배열·빈 글자는 아예 없다 */
function 항목(o) {
  return Object.assign({ 구분: '기타 안내', 미리보기: '안녕하십니까, 푸른노무법인입니다.', 받는주소수: 10, 한통최대: 4, 업체미확인: 0,
    폴더들: [{ 이름: 'Sent Messages', 수: 1 }], 메일줄수: 1, 복사본수: 0 }, o);
}
const 기본항목 = () => ({
  n20261002_a1b2c3d4: 항목({ 제목: '[푸른노무법인] 10월 공휴일 안내', 날짜: '2026-10-02', 날짜들: ['2026-10-02'], 시각: 서울('2026-10-02T09:10:00'),
    구분: '공휴일 안내', 첨부: ['2026 공휴일 안내.pdf'], 받는주소수: 120, 한통최대: 6, 업체: ['가나상사', '다라상회'], 명함업체: ['마바상회'], 업체미확인: 5,
    폴더들: [{ 이름: 'Sent Messages', 수: 2 }, { 이름: 'Archive', 수: 1 }] }),
  n20260928_b2c3d4e5: 항목({ 제목: '[푸른노무법인] 판결 요약과 대응', 날짜: '2026-09-28', 날짜들: ['2026-09-28'], 시각: 서울('2026-09-28T10:00:00'),
    구분: '판결·법령 안내', 첨부: { 0: '2026 공휴일 안내.pdf', 1: '판결요약.hwp' }, 이름없는첨부: 1, 받는주소수: 150, 한통최대: 8, 업체: ['가나상사'] }),
  /* 사람이 쓴 «위험한 글» — 마크업·따옴표·수식 시작 글자·주소(서버가 실수로 실은 것) */
  n20250820_c3d4e5f6: 항목({ 제목: '<img src=x onerror=alert(1)> "판결" \'요약\'', 날짜: '2025-08-20', 날짜들: ['2025-08-20'], 시각: 서울('2025-08-20T11:00:00'),
    미리보기: '<script>alert(2)</script> 글', 첨부: ["O'Brien <b>표</b>.xlsx"], 업체: ['<b>굵은</b>상사'],
    사라짐: 서울('2026-10-05T03:40:00'), 주소: 'leak@example.com', 받는사람들: ['leak2@example.com'] }),
  n20241224_d4e5f6a7: 항목({ 제목: '[푸른노무법인 안내] 연말 인사', 날짜: '2024-12-24', 날짜들: ['2024-12-24'], 시각: 서울('2024-12-24T09:00:00'), 구분: '명절·새해 인사', 미리보기: '=HYPERLINK("http://x","눌러")' }),
  n20230301_e5f6a7b8: 항목({ 제목: '3월 노동법 개정 안내', 날짜: '2023-03-01', 날짜들: ['2023-03-01'], 시각: 서울('2023-03-01T09:00:00'), 첨부: ['개정 요약.pdf'] })
});

function 짐세우기(o) {
  const x = o || {};
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면 스크립트가 올라가다 멈췄다: ' + (짐.올림오류 && 짐.올림오류.message));
  짐.__토스트 = []; 짐.__읽은것 = []; 짐.__쓴것 = []; 짐.__예약 = []; 짐.__렌더 = 0; 짐.__복사 = []; 짐.__연것 = [];
  짐.__서버 = x.서버 === undefined
    ? { 'newsletter/noticeLog': { items: 복사(x.항목들 || 기본항목()), meta: { 확인한때: 서울('2026-10-11T03:40:00'), 규칙판: 1 } } }
    : x.서버;
  const 쓰기 = (경로) => async () => { 짐.__쓴것.push(경로); };
  짐.__db = { ref: (경로) => ({
    once: async () => { 짐.__읽은것.push(경로); if (짐.__읽기실패) throw new Error('permission_denied'); return { val: () => 복사(짐.__서버[경로]) }; },
    set: 쓰기(경로), update: 쓰기(경로), remove: 쓰기(경로), push: 쓰기(경로), transaction: 쓰기(경로)
  }) };
  짐.setTimeout = (f) => { 짐.__예약.push(f); return 1; };
  짐.open = (u, t) => { 짐.__연것.push({ u, t }); return {}; };
  짐.navigator = { clipboard: { writeText: (t) => { 짐.__복사.push(String(t)); return Promise.resolve(); } } };
  vm.runInContext(`db = __db; toast = function(m){ __토스트.push(String(m)); };
    ${x.진짜그리기 ? '안내검토미리보기그리기 = function(){};' : 'render = function(){ __렌더++; };'}
    App.tab = 'note'; App.설정 = {}; App.안내문들 = {};`, 짐);
  return 짐;
}
const 실행 = (짐, 글) => vm.runInContext(글, 짐);
const 읽기끝 = async (짐) => { await 실행(짐, '안내기록읽기()'); };
const 화면 = (짐) => String(실행(짐, '안내문화면()'));
const 말 = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const 클릭들 = (html) => [...html.matchAll(/onclick="([^"]*)"/g)].map((m) => m[1]);

/* ─────────────────────────── ① 읽기 ─────────────────────────── */

test('① 안내문 탭을 처음 열 때 «한 번만» 읽고 — 읽기만 한다(쓰기 0)', async () => {
  const 짐 = 짐세우기();
  /* 진짜 render() 가 부르는 한 줄(예약)을 그대로 따라 한다: 안 읽었으면 한 번 예약한다 */
  const 짧은 = 화면글.slice(화면글.indexOf('if(App.tab===\'note\' && App.안내기록 === undefined)'));
  assert.match(짧은.slice(0, 140), /setTimeout\(안내기록읽기, 0\)/, 'render() 가 안내문 탭에서 대장 읽기를 예약하지 않는다');
  await 읽기끝(짐);
  assert.deepStrictEqual(짐.__읽은것, ['newsletter/noticeLog'], '대장 한 자리만 읽어야 한다');
  await 읽기끝(짐); await 읽기끝(짐);
  assert.strictEqual(짐.__읽은것.length, 1, '이미 읽었는데 또 읽는다 — 안내문 탭을 열 때마다 서버를 두드린다');
  assert.deepStrictEqual(짐.__쓴것, [], '대장 화면이 서버에 «썼다» — 읽기 전용이어야 한다');
  assert.ok(짐.__렌더 >= 1, '읽고 나서 화면을 다시 그리지 않았다');
});

test('① 화면 코드는 대장에 쓰는 길이 없다 — set·update·remove·push·transaction 이 «글자로도» 없다', () => {
  const 시작 = 화면글.indexOf('function 안내기록읽기(');
  const 끝 = 화면글.indexOf('function 안내끌기(', 시작);
  assert.ok(시작 > 0 && 끝 > 시작, '대장 블록을 못 찾았다');
  const 블록 = 화면글.slice(시작, 끝);
  /* db 를 «여는» 곳은 읽는 길뿐 — 대장(안내기록읽기)과 보관본(보관읽기). 열 때마다 «그 뒤는 once» 여야 하고,
     자리는 newsletter/noticeLog · newsletter/noticeArchive/<id> 둘뿐이다 — set·update·remove·push·transaction·on 이 이어지면 안 된다 */
  const 열림 = [...블록.matchAll(/\bdb\s*\.\s*ref\s*\(([^)]*)\)\s*(\.\s*\w+\s*\([^)]*\))?/g)];
  assert.ok(열림.length >= 1 && 열림.length <= 2, '대장 블록이 db 를 ' + 열림.length + '곳에서 연다 — 읽는 길은 둘(대장·보관본)이어야 한다');
  열림.forEach((m) => {
    assert.ok(/^\.\s*once\s*\(\s*['"]value['"]\s*\)$/.test((m[2] || '').trim()), '한 번 읽기(once)여야 한다 — 실시간 듣기(on)는 읽는 값만큼 요금이 든다: ' + m[0]);
    assert.ok(/^\s*['"]newsletter\/notice(Log|Archive\/)['"]?/.test(m[1]) || /^\s*['"]newsletter\/notice(Log['"]|Archive\/['"])/.test(m[1]), '읽는 자리가 대장·보관본 말고 다른 곳이다: ' + m[1]);
  });
  assert.ok(!/\.(set|update|push|transaction)\s*\(/.test(블록), '대장 블록에 쓰기 호출이 있다 — 대장은 서버(newsletterNoticeLogBuild)만 쓴다');
  assert.ok(!/\bdb\b[^;]*\.remove\s*\(/.test(블록), '대장 블록에서 db 를 지우는 호출이 있다');
});

/* ─────────────────────────── ② 안전 ─────────────────────────── */

test('② 사람이 쓴 글(제목·미리보기·파일·업체 이름)은 마크업으로 읽히지 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  /* 목록(안내문별) · 파일별 목록 · 상세 · 파일 상세 — 네 군데 모두 */
  const 곳들 = [];
  곳들.push(화면(짐));
  실행(짐, "기록고르기('n20250820_c3d4e5f6')"); 곳들.push(화면(짐));
  실행(짐, "기록닫기(); 기록보기바꿈('file')"); 곳들.push(화면(짐));
  const 파일 = 실행(짐, '기록현재파일줄()').findIndex((f) => /O'Brien/.test(f.이름));
  assert.ok(파일 >= 0, '위험한 이름의 파일이 파일별 목록에 없다');
  실행(짐, `파일고르기(${파일})`); 곳들.push(화면(짐));
  곳들.forEach((html, i) => {
    assert.ok(!/<img\b/i.test(html), `${i}번 화면: 제목 속 <img> 가 그대로 마크업이 되었다 — 걸러 쓰기(esc)가 빠졌다`);
    assert.ok(!/<script\b/i.test(html.replace(/<script[^>]*src=/g, '')), `${i}번 화면: 글 속 <script> 가 살아 있다`);
    assert.ok(!/<b>굵은<\/b>/.test(html) && !/<b>표<\/b>/.test(html), `${i}번 화면: 업체·파일 이름 속 <b> 가 마크업이 되었다`);
  });
  assert.ok(곳들[0].includes('&lt;img'), '목록에 제목의 « < » 가 글자로 보이지 않는다');
  assert.ok(곳들[1].includes('&lt;script&gt;') || 곳들[1].includes('&lt;script'), '상세에 미리보기의 « < » 가 글자로 보이지 않는다');
});

test('③ onclick 안에는 사람이 쓴 글이 없다 — 서버 열쇠나 줄 번호뿐', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 허용 = /^[가-힣A-Za-z]+\((?:'[가-힣A-Za-z0-9_·]*'|\d+)?\)(?:;\s*[가-힣A-Za-z]+\((?:'[가-힣A-Za-z0-9_·]*'|\d+)?\))*$/;
  /* 사람이 쓴 글 — 이것이 onclick 안에 있으면 안 된다(한글만으로 된 제목이 열쇠 꼴을 흉내 낼 수 있어 글자 모양만으론 못 잡는다) */
  const 사람글 = Object.values(기본항목()).flatMap((n) => [n.제목, n.미리보기, ...Object.values(n.첨부 || {}), ...(n.업체 || []), ...(n.명함업체 || [])])
    .filter((t) => String(t || '').length >= 2);
  const 곳들 = [화면(짐)];
  실행(짐, "기록고르기('n20250820_c3d4e5f6')"); 곳들.push(화면(짐));
  실행(짐, "기록닫기(); 기록보기바꿈('file')"); 곳들.push(화면(짐));
  const 파일 = 실행(짐, '기록현재파일줄()').findIndex((f) => /O'Brien/.test(f.이름));
  실행(짐, `파일고르기(${파일})`); 곳들.push(화면(짐));
  곳들.forEach((html, i) => 클릭들(html).forEach((c) => {
    /* 따옴표가 든 제목·파일 이름이 onclick 에 들어갔다면 &quot; 나 &#39; 가 보인다 */
    assert.ok(허용.test(c), `${i}번 화면: onclick 에 열쇠·번호 말고 다른 글이 들어 있다 → ${c.slice(0, 80)}`);
    사람글.forEach((t) => assert.ok(!c.includes(t) && !c.includes(String(t).replace(/"/g, '&quot;')), `${i}번 화면: 사람이 쓴 글이 onclick 에 들어갔다 → ${t.slice(0, 30)}`));
  }));
});

test('④ 받는 «주소»는 화면에도 대장(CSV)에도 없다 — 서버가 실수로 실어도 걸러진다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 모음 = [화면(짐)];
  실행(짐, "기록고르기('n20250820_c3d4e5f6')"); 모음.push(화면(짐));
  실행(짐, "기록닫기(); 기록보기바꿈('file')"); 모음.push(화면(짐));
  모음.forEach((html, i) => assert.ok(!/leak2?@example\.com/.test(html), `${i}번 화면에 서버가 실은 주소가 나왔다`));
  const csv = 실행(짐, 'window.PuNewsNoticeLog.대장글(window.PuNewsNoticeLog.목록(App.안내기록))');
  assert.ok(!/leak2?@example\.com/.test(csv), '대장(CSV)에 서버가 실은 주소가 나왔다 — 정해진 열만 내보내야 한다');
});

/* ─────────────────────────── ⑤ 안내문별·파일별·상세 ─────────────────────────── */

test('⑤ 목록 — 건수·세그·연도 칩이 서고, 최근 것이 위, 안내문 머리말은 걷어 보인다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const html = 화면(짐), 글 = 말(html);
  assert.match(글, /지난 안내문\s*다음메일 기록\s*5/, '제목·건수가 안 보인다');
  assert.match(글, /안내문별/); assert.match(글, /파일별\s*4/, '파일별 개수(이 자료의 서로 다른 파일 4개)가 안 보인다');
  const 칩 = 글.match(/전체 5.*?2026 2.*?2025 1.*?2024 1.*?2023 이전 1/);
  assert.ok(칩, '연도 칩(전체·최근 3개 연도·그 이전)이 안 보인다: ' + 글.slice(0, 300));
  /* 같은 연도 안에서도 «최근 것이 위» */
  const 순서 = ['10월 공휴일 안내', '판결 요약과 대응'].map((t) => 글.indexOf(t));
  assert.ok(순서[0] >= 0 && 순서[1] > 순서[0], '최근 안내문이 위에 오지 않는다');
  assert.ok(!/\[푸른노무법인\]\s*10월 공휴일/.test(글.slice(0, 글.indexOf('다음메일(예약'))), '목록에서 «[푸른노무법인]» 머리말이 안 걷혔다');
  assert.match(글, /메일함에서 사라짐/, '메일함에서 사라진 안내문 표시가 없다');
  /* 「언제 보냈는지」가 이 목록의 핵심이다 — 줄마다 발송일이 보여야 한다 */
  const 목록글 = 글.slice(0, 글.indexOf('다음메일(예약'));
  Object.values(기본항목()).forEach((n) => assert.ok(목록글.includes(n.날짜), '목록 줄에 발송일이 안 보인다: ' + n.날짜));
  assert.match(글, /읽기 전용/, '읽기 전용이라는 안내가 없다');
});

test('⑤ 연도 칩·종류 칩을 누르면 거른다 — 칩이 바뀌면 «더 보기»는 처음으로', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "기록칩('2026')");
  const 열쇠들 = [...화면(짐).matchAll(/기록고르기\('(n\d+_[a-z0-9]+)'\)/g)].map((m) => m[1]);
  assert.deepStrictEqual(열쇠들.sort(), ['n20260928_b2c3d4e5', 'n20261002_a1b2c3d4'], '2026 칩인데 다른 해가 섞이거나 빠졌다');
  실행(짐, "기록칩('이전')");
  const 이전 = [...화면(짐).matchAll(/기록고르기\('(n\d+_[a-z0-9]+)'\)/g)].map((m) => m[1]);
  assert.deepStrictEqual(이전, ['n20230301_e5f6a7b8'], '«2023 이전» 칩이 최근 3개 연도 밖만 보여야 한다');
  실행(짐, "기록보기바꿈('file')");
  assert.strictEqual(실행(짐, 'App.기록연'), '', '보기를 바꿨는데 연도 칩이 남아 있다 — 파일별 목록이 비어 보일 수 있다');
  실행(짐, "기록칩('여럿')");
  const 파일들 = 말(화면(짐));
  assert.match(파일들, /2026 공휴일 안내\.pdf/, '여러 번 보낸 파일이 보여야 한다');
  assert.ok(!/판결요약\.hwp/.test(파일들), '한 번만 보낸 파일이 «여러 번 보낸 것» 칩에 섞였다');
});

test('⑤ 처음엔 일부만 그리고 «더 보기»를 누르면 나머지가 모두 나온다 (건수는 서로 맞는다)', async () => {
  const 많이 = {};
  for (let i = 0; i < 12; i++) 많이['n2026' + String(i + 1).padStart(2, '0') + '15_x' + i] = 항목({ 제목: '안내 ' + i, 날짜: '2026-' + String(i + 1).padStart(2, '0') + '-15', 시각: 서울('2026-' + String(i + 1).padStart(2, '0') + '-15T09:00:00') });
  const 짐 = 짐세우기({ 항목들: 많이 }); await 읽기끝(짐);
  const 처음 = 화면(짐);
  const 처음수 = [...처음.matchAll(/기록고르기\(/g)].length;
  assert.ok(처음수 >= 1 && 처음수 < 12, '처음엔 «전부가 아니라 일부만» 그려야 한다(스물·서른 건이 쌓여도 화면이 길어지지 않게) — 처음 ' + 처음수 + '건');
  assert.match(말(처음), new RegExp('더 보기 \\(' + (12 - 처음수) + '건\\)'), '«더 보기 (남은 건수)» 가 안 맞는다');
  실행(짐, '기록더보기()');
  assert.strictEqual([...화면(짐).matchAll(/기록고르기\(/g)].length, 12, '더 보기를 눌렀는데 다 안 나온다');
  /* 칩을 바꾸면 «더 보기»가 처음으로 — 안 그러면 거른 목록이 한꺼번에 길게 펼쳐진다 */
  실행(짐, "기록칩('2026')");
  assert.strictEqual([...화면(짐).matchAll(/기록고르기\(/g)].length, 처음수, '칩을 바꿨는데 «더 보기» 상태가 남아 목록이 길게 펼쳐졌다');
  실행(짐, '기록더보기()'); 실행(짐, "기록보기바꿈('file')"); 실행(짐, "기록보기바꿈('note')");
  assert.strictEqual([...화면(짐).matchAll(/기록고르기\(/g)].length, 처음수, '보기를 바꿨는데 «더 보기» 상태가 남았다');
});

test('⑤ 고른 줄은 눈에 띄고(한 줄만), 폰에서만 상세로 들어가며 맨 위로 간다 — 넓은 화면은 보던 자리를 지킨다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  assert.ok(!/nlg-row sel/.test(화면(짐)), '고른 것이 없는데 고른 표시가 있다');
  let 올림 = 0; 짐.scrollTo = () => { 올림++; };
  짐.matchMedia = () => ({ matches: false, addEventListener() {} });
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual([...화면(짐).matchAll(/nlg-row sel/g)].length, 1, '고른 줄이 «한 줄만» 표시돼야 한다');
  assert.strictEqual(올림, 0, '넓은 화면에서 줄을 눌렀는데 맨 위로 튄다 — 긴 목록에서 보던 자리를 잃는다');
  짐.matchMedia = () => ({ matches: true, addEventListener() {} });
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.strictEqual(올림, 1, '폰(한 칸 화면)에서는 상세로 들어가며 맨 위로 가야 한다');
});

test('⑤ 상세 — 제목·구분·첨부(몇 번 보냈나)·받은 곳·한계·단추', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.strictEqual(실행(짐, 'App.지금기록'), 'n20260928_b2c3d4e5');
  const html = 화면(짐), 글 = 말(html);
  assert.match(html, /class="notegrid det"/, '상세를 열었는데 폰에서 목록을 접는 칸(.det)이 안 걸린다');
  assert.match(글, /\[푸른노무법인\] 판결 요약과 대응/, '상세 제목에는 머리말까지 그대로 보여야 한다');
  assert.match(글, /2026-09-28\(월\)/, '발송일 요일이 어긋났다(2026-09-28 은 월요일)');
  assert.match(글, /첨부 파일 3개/, '이름 있는 첨부 2 + 이름 없는 첨부 1 = 3개');
  assert.match(글, /2026 공휴일 안내\.pdf.*2번 보냈습니다.*2026-09-28 · 2026-10-02/, '같은 파일을 보낸 날들이 안 보인다');
  assert.match(글, /판결요약\.hwp.*이번 한 번/, '한 번만 보낸 파일 설명이 틀렸다');
  assert.match(글, /이름이 기록에 없는 첨부 1개/);
  assert.match(글, /메일 기록에는 한 통에 받는 사람이 8명까지만/, '8명 한계가 안 알려졌다 — 실제 받은 곳이 더 많을 수 있다');
  assert.match(글, /메일함에서 찾기/); assert.match(글, /대장 내려받기/); assert.match(글, /‹ 목록/);
  /* 화면 숫자는 서버가 적어 둔 값 그대로여야 한다 — 받은 주소 수·받은 곳 수·업체 이름을 못 찾은 주소 수가 서로 안 섞인다 */
  const 서버값 = 기본항목().n20260928_b2c3d4e5;
  assert.match(글, new RegExp('받은 주소 ' + 서버값.받는주소수 + '개'), '받은 주소 수가 서버 값과 다르다');
  assert.match(글, new RegExp('업체 이름을 찾은 ' + 서버값.업체.length + '곳'), '받은 곳 수(업체+명함)가 서버 값과 다르다');
});

test('⑤ 상세 — 업체 이름·명함 업체·못 찾은 주소 수·기록 위치가 서버 값 그대로 나온다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  const html = 화면(짐), 글 = 말(html), 서버값 = 기본항목().n20261002_a1b2c3d4;
  assert.match(글, new RegExp('받은 주소 ' + 서버값.받는주소수 + '개'));
  assert.match(글, new RegExp('업체 이름을 찾은 ' + (서버값.업체.length + 서버값.명함업체.length) + '곳'), '업체관리 기준 + 명함 기준을 더한 곳 수가 아니다');
  서버값.업체.forEach((n) => assert.ok(글.includes(n), '받은 곳에 업체 이름이 안 보인다: ' + n));
  assert.ok(글.includes(서버값.명함업체[0] + '(명함)'), '명함으로 찾은 업체는 «(명함)» 표시로 가려 보여야 한다 — 업체관리 원장과 섞이지 않게');
  assert.match(html, /class="card">마바상회\(명함\)/, '명함 업체 칩에 구분 칸(card)이 없다');
  assert.match(글, new RegExp('어느 쪽에도 없는 주소 ' + 서버값.업체미확인 + '개'), '업체 이름을 못 찾은 주소 수가 서버 값과 다르다');
  assert.match(글, /보낸편지함 2통 · 보관함 1통/, '기록 위치(어느 폴더에 몇 통)가 한글 이름으로 안 보인다');
  assert.ok(!/Sent Messages|Archive/.test(글), '영문 폴더 이름이 그대로 노출됐다');
});

test('⑤ 상세 → «파일별로 보기» → 그 파일 한 개의 보낸 기록(최근 것이 위) → 안내문 열기', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  /* 일부러 화면을 «그리지 않고» 누른다 — 누르는 쪽이 그릴 때 남긴 값에 기대면 여기서 걸린다 */
  실행(짐, '기록파일열기(0)');
  assert.strictEqual(실행(짐, 'App.기록보기'), 'file'); assert.strictEqual(실행(짐, 'App.지금파일'), '2026 공휴일 안내.pdf');
  assert.strictEqual(실행(짐, 'App.지금기록'), '', '파일 상세인데 안내문 상세 상태가 남았다');
  const 글 = 말(화면(짐));
  assert.match(글, /2번 보냈습니다/); assert.match(글, /처음 2026-09-28.*마지막 2026-10-02/);
  assert.ok(글.indexOf('2026-10-02(금)') < 글.indexOf('2026-09-28(월)'), '보낸 기록은 최근 것이 위여야 한다');
  assert.match(글, /함께 보낸 파일.*판결요약\.hwp/, '같이 붙어 간 다른 파일이 안 보인다');
  assert.match(글, /파일 «내용»은 아직 보관 전이라 이 기록에 없습니다/, '보관 전인데 내용이 없다는 한계를 숨겼다');
  /* 아래 큰 단추는 «가장 최근에 보낸» 안내문으로 간다 (보낸 기록은 최근 것이 맨 앞) */
  assert.match(화면(짐), /class="btn pri" onclick="기록고르기\('n20261002_a1b2c3d4'\)">최근 안내문 열기/, '파일 상세의 큰 단추가 가장 최근 안내문으로 안 간다');
  /* 이 안내문 열기 */
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.strictEqual(실행(짐, 'App.지금기록'), 'n20260928_b2c3d4e5'); assert.strictEqual(실행(짐, 'App.지금파일'), '');
});

test('⑤ 고른 항목이 기록에서 사라졌으면 빈 화면으로 돌아간다 — 깨지지 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "App.지금기록 = 'n_없는것'");
  assert.doesNotThrow(() => 화면(짐));
  assert.ok(!/class="notegrid det"/.test(화면(짐)), '없는 항목인데 상세 껍데기(.det)가 걸렸다');
  실행(짐, "App.지금기록 = ''; App.지금파일 = '없는 파일.pdf'");
  assert.doesNotThrow(() => 화면(짐));
  assert.ok(!/class="notegrid det"/.test(화면(짐)));
});

/* ─────────────────────────── ⑥ 초안이 먼저 ─────────────────────────── */

test('⑥ 쓰던 초안이 있으면 초안이 먼저 — 초안 화면에는 폰 «목록 접기»(.det)를 걸지 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, `App.안내문들 = { z1: { id: 'z1', 상태: '초안', 제목: '내 초안', 요점: [], 본문: '', 첨부: [], 받는곳: '전체', createdAt: 1 } };
    App.명단 = App.명단 || {};`);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.match(화면(짐), /class="notegrid det"/, '초안이 없을 땐 상세가 서야 한다');
  /* 초안을 고르면 기록 상태가 비워진다 */
  실행(짐, "안내고르기('z1')");
  assert.strictEqual(실행(짐, 'App.지금기록'), ''); assert.strictEqual(실행(짐, 'App.지금파일'), '');
  let html; try { html = 화면(짐); } catch (e) { assert.fail('초안 편집 화면을 그리다 멈췄다: ' + e.message); }
  assert.ok(!/class="notegrid det"/.test(html), '초안 편집 화면에 .det 가 걸렸다 — 폰에서 목록이 접혀 초안을 닫을 길이 없다');
  assert.match(html, /안내문 쓰기/, '초안 편집 화면이 오른쪽에 안 보인다');
  assert.ok(!/기록상세|nlg-detail/.test(html), '초안 편집 화면에 대장 상세가 섞였다');
  /* 대장 목록은 초안 곁에도 그대로 보인다 */
  assert.match(말(html), /지난 안내문/);
  /* 초안과 기록 상태가 «둘 다» 남아 있어도 초안이 먼저다 — 상태를 비우는 길을 놓쳐도 초안 화면이 가려지지 않게 */
  실행(짐, "App.지금기록 = 'n20261002_a1b2c3d4'");
  const 둘다 = 화면(짐);
  assert.ok(!/class="notegrid det"/.test(둘다), '초안·기록이 함께 서 있는데 .det 가 걸렸다');
  assert.match(둘다, /안내문 쓰기/, '초안·기록이 함께 서 있을 때 초안이 가려졌다');
  assert.ok(!/nlg-detail/.test(둘다), '초안·기록이 함께 서 있을 때 기록 상세가 초안 자리를 차지했다');
});

test('⑥ 새 안내문을 만들면 대장 상세 상태가 비워진다 — 초안을 지운 뒤 옛 상세가 되살아나지 않는다', () => {
  const 시작 = 화면글.indexOf('function 새안내문(');
  const 몸 = 화면글.slice(시작, 화면글.indexOf('\n}\n', 시작));
  assert.match(몸, /App\.지금안내 = id;[^\n]*App\.지금기록 = '';[^\n]*App\.지금파일 = '';/);
});

/* ─────────────────────────── ⑦ 상태 말 ─────────────────────────── */

test('⑦ 읽는 중 · 기록 없음 · 읽지 못함(다시 읽기) — 말이 다르다', async () => {
  const 짐 = 짐세우기({ 서버: {} });
  assert.match(말(화면(짐)), /불러오는 중/, '아직 안 읽었는데 «기록 없음»으로 보인다');
  await 읽기끝(짐);
  assert.match(말(화면(짐)), /아직 정리된 기록이 없습니다.*새벽 3시 40분/);
  assert.ok(!/안내문별/.test(화면(짐)), '기록이 없는데 보기 전환·칩이 나온다');
  const 실패 = 짐세우기(); 실패.__읽기실패 = true; await 읽기끝(실패);
  const 글 = 말(화면(실패));
  assert.match(글, /기록을 읽지 못했습니다 — permission_denied/); assert.match(글, /다시 읽기/);
  실패.__읽기실패 = false; 실행(실패, '기록다시읽기()');
  assert.strictEqual(실행(실패, 'App.안내기록'), undefined, '다시 읽기가 상태를 비우지 않는다');
  assert.ok(실패.__예약.length >= 0);
  await 읽기끝(실패);
  assert.match(말(화면(실패)), /지난 안내문\s*다음메일 기록\s*5/, '다시 읽었는데 목록이 안 나온다');
});

test('⑦ 읽다가 «그리기»에서 난 오류가 「읽지 못했습니다」로 둔갑하지 않는다', async () => {
  const 짐 = 짐세우기();
  실행(짐, 'render = function(){ throw new Error("그리다 멈춤"); };');
  await assert.rejects(() => 실행(짐, '안내기록읽기()'), /그리다 멈춤/, '그리기 오류가 삼켜졌다 — 숨은 고장이 된다');
  assert.strictEqual(실행(짐, 'App.안내기록오류'), '', '그리기 오류를 읽기 오류로 기록했다');
});

/* ─────────────────────────── ⑧ 내려받기 · 메일함에서 찾기 ─────────────────────────── */

test('⑧ 대장 내려받기 — 이름은 «안내문_발송대장_날짜.csv», 맨 앞 BOM, 전 건', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 받은 = [];
  짐.Blob = function (조각, 옵션) { this.조각 = 조각; this.옵션 = 옵션; };
  짐.URL = { createObjectURL: (b) => { 받은.push(b); return 'blob:x'; }, revokeObjectURL() {} };
  const 링크 = { click() { 받은.push('click'); }, remove() {}, set href(v) { this._h = v; }, get href() { return this._h; } };
  짐.document.createElement = () => 링크;
  짐.document.body.appendChild = (x) => x;
  실행(짐, '기록내려받기()');
  assert.match(링크.download, /^안내문_발송대장_\d{4}-\d{2}-\d{2}\.csv$/, '내려받는 파일 이름이 정해진 꼴이 아니다');
  const 글 = String(받은[0].조각[0]);
  assert.strictEqual(글.charCodeAt(0), 0xFEFF, '맨 앞 BOM 이 없다 — 엑셀이 한글을 깨뜨린다');
  assert.strictEqual(글.split('\r\n').length - 1, 5 + 1, '머리 1줄 + 안내문 5건이어야 한다(줄 끝 CRLF)');
  assert.ok(받은.includes('click'), '내려받기를 실제로 누르지 않았다');
  assert.match(짐.__토스트.join(' '), /안내문 대장을 내려받았습니다 \(5건\)/);
  assert.ok(!/leak2?@example\.com/.test(글), '대장에 서버가 실은 주소가 나왔다');
  assert.ok(/'=HYPERLINK/.test(글), '수식으로 읽힐 글(=)을 막지 않았다 — 엑셀에서 열면 실행된다');
});

test('⑧ 기록이 없으면 내려받지 않는다', async () => {
  const 짐 = 짐세우기({ 서버: {} }); await 읽기끝(짐);
  let 눌림 = false; 짐.document.createElement = () => ({ click() { 눌림 = true; }, remove() {} });
  실행(짐, '기록내려받기()');
  assert.strictEqual(눌림, false); assert.match(짐.__토스트.join(' '), /내려받을 기록이 없습니다/);
});

test('⑧ 메일함에서 찾기 — 제목을 복사하고, 푸른 메일을 열고, 어느 폴더에서 찾을지는 상세 «안에» 남긴다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.ok(!/폴더|찾아 열어 보십시오/.test(말(화면(짐)).replace(/기록 위치/g, '')), '누르기 전에 찾는 법 안내가 이미 떠 있다');
  실행(짐, "기록메일함찾기('n20261002_a1b2c3d4')");
  await new Promise((r) => setImmediate(r));          /* 복사(Promise)가 끝나길 기다린다 */
  assert.deepStrictEqual(짐.__복사, ['[푸른노무법인] 10월 공휴일 안내'], '제목이 복사되지 않았다');
  assert.strictEqual(짐.__연것.length, 1);
  assert.match(짐.__연것[0].u, /^pu-cards\.html\?view=mail$/, '푸른 메일(기업정보함 메일 보기)을 열어야 한다');
  assert.strictEqual(짐.__연것[0].t, '_blank');
  assert.match(짐.__토스트.join(' '), /복사/, '제목을 복사했다는 알림이 없다');
  /* ★ 안내는 토스트가 아니라 «상세 안에» — 새 탭으로 넘어가 있는 동안 토스트는 사라진다 */
  const 글 = 말(화면(짐));
  assert.match(글, /푸른 메일함 › 보낸편지함 에서 「\[푸른노무법인\] 10월 공휴일 안내」 를 찾아 열어 보십시오/, '어느 폴더에서 어떤 제목을 찾을지 안내가 상세에 안 남았다');
  assert.ok(!/Sent Messages/.test(글), '영문 폴더 이름이 그대로 노출됐다');
  /* 다른 안내문으로 건너가면 그 안내는 걷힌다 — 남의 안내문에 옛 안내가 붙어 있지 않게 */
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.ok(!/에서 「.*」 를 찾아 열어 보십시오/.test(말(화면(짐))), '다른 안내문으로 건넜는데 옛 «찾는 법» 안내가 남았다');
});

test('⑧ 복사가 막혀도(권한·옛 브라우저) 푸른 메일은 열리고 안내는 남는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  짐.navigator = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
  실행(짐, "기록고르기('n20261002_a1b2c3d4'); 기록메일함찾기('n20261002_a1b2c3d4')");
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(짐.__연것.length, 1, '복사가 막혔다고 메일함을 안 연다');
  assert.match(짐.__토스트.join(' '), /복사하지 못했습니다/, '복사 실패를 알리지 않았다');
  assert.match(말(화면(짐)), /를 찾아 열어 보십시오/, '복사가 막혔는데 직접 찾을 안내도 없다');
  짐.navigator = {};
  assert.doesNotThrow(() => 실행(짐, "기록메일함찾기('n20261002_a1b2c3d4')"), 'clipboard 가 없는 환경에서 멈춘다');
});

/* ─────────────────────────── 싣기 · 폰 ─────────────────────────── */

test('싣기 — 도우미 스크립트는 캐시 번호와 함께 «본 스크립트보다 먼저» 실린다', () => {
  const 태그 = 원문.match(/<script src="js\/pu-news-noticelog\.js\?v=\d+"><\/script>/);
  assert.ok(태그, '지난 안내문 도우미(js/pu-news-noticelog.js)가 캐시 번호(?v=)와 함께 실리지 않는다');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'js', 'pu-news-noticelog.js')), '실리는 파일이 저장소에 없다');
  const 본스크립트 = 원문.indexOf('firebase.initializeApp(');
  assert.ok(원문.indexOf(태그[0]) < 본스크립트, '도우미가 본 스크립트 뒤에 실린다 — 화면이 처음 열 때 PuNewsNoticeLog 가 없다');
});

test('폰 — 상세가 열리면 목록을 접고, 상세 맨 위에 «‹ 목록» 줄이 선다 (초안 화면은 안 접는다)', () => {
  const 폭 = 원문.match(/@media \(max-width:(\d+)px\)\{[^}]*\.notegrid\.det>\.nlist\{display:none\}[\s\S]*?\n\}/);
  assert.ok(폭, '폰 폭에서 상세가 열리면 목록을 접는 규칙이 없다');
  assert.ok(/\.nlg-sheetbar\{display:flex/.test(폭[0]), '폰 폭에서 «‹ 목록» 줄이 안 보인다');
  /* 규칙: 한 칸으로 쌓이는 폭에서만 접는다 — 두 칸일 때 접으면 옆 목록이 사라진다. 두 폭이 다르면 중간 폭에서 어긋난다 */
  const 한칸 = 원문.match(/@media \(max-width:(\d+)px\)\{\.notegrid\{grid-template-columns:1fr\}\}/);
  assert.ok(한칸, '안내문 칸이 한 줄로 쌓이는 폭 규칙을 못 찾았다');
  assert.strictEqual(폭[1], 한칸[1], '목록을 접는 폭(' + 폭[1] + ')과 한 칸으로 쌓이는 폭(' + 한칸[1] + ')이 다르다 — 중간 폭에서 목록이 사라지거나 상세가 목록 밑으로 밀린다');
  assert.ok(/\.nlg-sheetbar\{display:none\}/.test(원문), '넓은 화면에선 «‹ 목록» 줄을 숨겨야 한다(옆에 목록이 이미 보인다)');
  /* 접는 규칙은 .det 에만 걸려 있다 — 일반 안내문 탭(.notegrid)에는 걸지 않는다 */
  assert.ok(!/\.notegrid>\.nlist\{display:none\}/.test(원문));
});

test('화면이 말하는 «매일 새벽 N시 M분 정리» 는 서버 일정(newsletterNoticeLogBuild)과 같다', () => {
  const 서버 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
  const i = 서버.indexOf('exports.newsletterNoticeLogBuild');
  assert.ok(i > 0, '서버에 newsletterNoticeLogBuild 가 없다');
  const m = /schedule\("every day (\d{2}):(\d{2})"\)/.exec(서버.slice(i, i + 600));
  assert.ok(m, '서버 일정(every day HH:MM)을 못 찾았다');
  const 시 = Number(m[1]), 분 = Number(m[2]);
  const 말 = 분 ? 시 + '시 ' + 분 + '분' : 시 + '시';
  const 블록 = 화면글.slice(화면글.indexOf('function 기록구역('), 화면글.indexOf('function 기록위로('));
  assert.ok(블록.includes('새벽 ' + 말), '화면 안내(「매일 새벽 …에 정리」)가 서버 일정(' + m[1] + ':' + m[2] + ')과 어긋났다 — 일정을 바꿨으면 화면 말도 바꿀 것');
});

/* ─────────────────────────── ⑨ 폰 뒤로가기 층 ─────────────────────────── */

/* 가짜 PuBack — 층을 쌓고, 「뒤로가기」는 맨 위 층을 꺼내 그 닫는 함수를 부른다(js/pu-back.js 와 같은 약속) */
function 가짜뒤로(짐) {
  const 층 = []; let 번호 = 0; const 뺀것 = [];
  짐.PuBack = {
    open: (이름, 닫기) => { if (typeof 닫기 !== 'function') return null; const id = ++번호; 층.push({ id, 이름, 닫기 }); return id; },
    close: (id) => { 뺀것.push(id); const i = 층.findIndex((x) => x.id === id); if (i >= 0) 층.splice(i, 1); return i >= 0; }
  };
  return { 층, 뺀것, 뒤로가기: () => { const 맨위 = 층.pop(); if (맨위) 맨위.닫기(); return !!맨위; } };
}
const 폰으로 = (짐, 폰) => { 짐.matchMedia = () => ({ matches: !!폰, addEventListener() {} }); 짐.scrollTo = () => {}; };

test('⑨ 폰: 상세는 뒤로가기 «한 층» — 상세에서 상세로 가도 하나, 뒤로가기는 목록으로, ‹ 목록은 층을 뺀다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 뒤 = 가짜뒤로(짐); 폰으로(짐, true);
  assert.strictEqual(뒤.층.length, 0, '아무것도 안 열었는데 층이 있다');
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 1, '폰에서 상세를 열었는데 뒤로가기 층이 안 심어졌다 — 뒤로가기가 앱을 통째로 나간다');
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  실행(짐, '기록파일열기(1)');
  assert.strictEqual(뒤.층.length, 1, '상세에서 상세로 건넜는데 층이 또 쌓였다 — 뒤로가기를 여러 번 눌러야 나간다');
  /* 폰의 뒤로가기 */
  assert.strictEqual(뒤.뒤로가기(), true);
  assert.strictEqual(실행(짐, 'App.지금기록'), ''); assert.strictEqual(실행(짐, 'App.지금파일'), '', '뒤로가기를 눌렀는데 상세가 안 닫혔다');
  assert.deepStrictEqual(뒤.뺀것, [], '뒤로가기가 이미 층을 꺼냈는데 또 빼려 한다 — 한 걸음이 두 걸음이 된다');
  assert.ok(!/class="notegrid det"/.test(화면(짐)), '뒤로가기 뒤에도 목록이 접힌 채다');
  /* 다시 열면 층이 «새로» 선다(앞의 층 표가 남아 있으면 영영 안 심긴다) */
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 1, '뒤로가기로 닫은 뒤 다시 열었는데 층이 안 심어졌다');
  /* ‹ 목록 단추 */
  실행(짐, '기록닫기()');
  assert.strictEqual(뒤.층.length, 0, '‹ 목록을 눌렀는데 층이 남았다 — 다음 뒤로가기가 «아무 일 없이» 쓰인다');
  assert.strictEqual(뒤.뺀것.length, 1);
});

test('⑨ 넓은 화면은 «층»이 아니다 — 목록이 옆에 그대로 있어 뒤로가기 걸음을 심지 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 뒤 = 가짜뒤로(짐); 폰으로(짐, false);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 0, '넓은 화면에서 층을 심었다 — 뒤로가기를 한 번 눌러도 «아무 일 없이» 쓰인다');
  실행(짐, '기록닫기()');
  assert.deepStrictEqual(뒤.뺀것, []);
});

test('⑨ 초안을 고르거나 새로 만들면 상세 층을 걷는다 — 초안 화면에서 뒤로가기가 헛돌지 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  실행(짐, `App.안내문들 = { z1: { id: 'z1', 상태: '초안', 제목: '내 초안', 요점: [], 본문: '', 첨부: [], 받는곳: '전체', createdAt: 1 } };`);
  const 뒤 = 가짜뒤로(짐); 폰으로(짐, true);
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 1);
  실행(짐, "안내고르기('z1')");
  assert.strictEqual(뒤.층.length, 0, '초안을 골랐는데 상세 층이 남았다');
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 1);
  실행(짐, "db = { ref: () => ({ push: () => ({ key: 'kNew1' }), set: async () => {} }) }; 새안내문()");
  assert.strictEqual(뒤.층.length, 0, '새 안내문을 만들었는데 상세 층이 남았다');
});

test('⑨ 안내문 탭을 떠나면 상세 층을 걷는다 — 진짜 render() 를 돌려 본다', async () => {
  const 짐 = 짐세우기({ 진짜그리기: true });
  const 뒤 = 가짜뒤로(짐); 폰으로(짐, true);
  await 읽기끝(짐);                                    /* 안내문 탭(진짜 render)이 대장을 읽고 다시 그린다 */
  assert.match(String(짐.요소들.main.innerHTML), /지난 안내문/, '진짜 render() 가 안내문 탭에 대장을 안 그렸다');
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(뒤.층.length, 1);
  assert.match(String(짐.요소들.main.innerHTML), /class="notegrid det"/, '진짜 render() 가 상세를 안 그렸다');
  실행(짐, "App.tab = 'who'; render();");
  assert.strictEqual(뒤.층.length, 0, '다른 탭으로 갔는데 상세 층이 남았다 — 거기서 뒤로가기가 «아무 일 없이» 한 번 쓰인다');
  assert.strictEqual(실행(짐, 'App.지금기록'), '', '탭을 떠났는데 고른 상세가 남았다');
});

test('⑨ PuBack 이 없어도(옛 화면·시험) 상세는 멀쩡히 열리고 닫힌다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐); 폰으로(짐, true);
  assert.ok(!짐.PuBack, '시험 준비가 잘못됐다 — PuBack 이 이미 있다');
  assert.doesNotThrow(() => { 실행(짐, "기록고르기('n20261002_a1b2c3d4')"); 실행(짐, '기록닫기()'); });
  assert.strictEqual(실행(짐, 'App.지금기록'), '');
});

/* ─────────────────────────── ⑩ 상세로 들어갈 때의 스크롤 ─────────────────────────── */

/* 가짜 화면 틀 — 오른쪽 칸(.nlg-pane)의 «맨 위 높이»와 위를 덮는 것(붙는 머리·구르는 상자)을 정해 둔다 */
function 틀세우기(짐, o) {
  const 기록 = { 올림: [], 위로: [], 아래로: [] };
  const 굴림상자 = { getBoundingClientRect: () => ({ top: o.굴림위 || 0 }) };
  const 팬 = { getBoundingClientRect: () => ({ top: o.팬위 }), scrollIntoView: (a) => 기록.올림.push(a), closest: (sel) => (sel === '.wrap' ? 굴림상자 : null) };
  const 머리 = 짐.요소들.top = 짐.요소들.top || {};
  머리.offsetHeight = o.머리높이 || 0;
  짐.document.querySelector = (sel) => (sel === '.nlg-pane' ? 팬 : null);
  짐.getComputedStyle = (el) => (el === 머리 ? { position: o.머리붙음 ? 'sticky' : 'static' } : el === 굴림상자 ? { overflowY: o.굴림상자 ? 'auto' : 'visible' } : {});
  짐.scrollTo = (x, y) => 기록.위로.push([x, y]);
  짐.scrollBy = (x, y) => 기록.아래로.push([x, y]);
  짐.matchMedia = (q) => ({ matches: /max-width:760px/.test(q) ? !!o.폰 : false, addEventListener() {} });
  return 기록;
}

test('⑩ 넓은 화면(위가 얼린 구르는 상자): 상세 맨 위가 상자 밖으로 가려졌으면 올리고, 보이면 가만히 둔다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  let 기 = 틀세우기(짐, { 팬위: -250, 굴림상자: true, 굴림위: 99 });
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(JSON.stringify(기.올림), '[{"block":"start"}]', '목록을 내려 보다 줄을 눌렀는데 상세 맨 위로 안 올라간다 — 눌렀는데 아무 일도 없는 것처럼 보인다');
  assert.deepStrictEqual(기.위로, [], '넓은 화면에서 쪽 전체를 맨 위로 던졌다');
  기 = 틀세우기(짐, { 팬위: 130, 굴림상자: true, 굴림위: 99 });
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.deepStrictEqual(기.올림, [], '상세 맨 위가 이미 보이는데 굴렸다 — 보던 목록 자리를 잃는다');
  /* 상자 윗변(99)보다 위에 걸쳐 «잘린» 경우 — 화면 맨 위(0)보다는 아래여도 상자 밖이다 */
  기 = 틀세우기(짐, { 팬위: 50, 굴림상자: true, 굴림위: 99 });
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(기.올림.length, 1, '상자 윗변에 잘린 상세 맨 위를 «보인다»고 읽었다 — 구르는 상자의 윗변을 재야 한다');
});

test('⑩ 중간 폭(붙는 머리가 위를 덮는 폭): 머리 밑으로 내려서 맞춘다 — 머리 높이는 «재서» 뺀다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  let 기 = 틀세우기(짐, { 팬위: 60, 머리붙음: true, 머리높이: 95, 굴림상자: false });
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(기.올림.length, 1, '붙는 머리 밑에 가린 상세 맨 위를 «보인다»고 읽었다');
  assert.strictEqual(기.아래로.length, 1); assert.ok(기.아래로[0][1] < -95, '머리 높이(95)보다 더 내려 맞춰야 한다 — 안 그러면 상세 위가 머리 밑에 깔린다: ' + 기.아래로[0][1]);
  assert.ok(기.아래로[0][1] >= -(95 + 40), '머리 높이를 훨씬 넘게 내렸다 — 머리 높이를 재지 않고 큰 수를 박았다');
  기 = 틀세우기(짐, { 팬위: 140, 머리붙음: true, 머리높이: 95, 굴림상자: false });
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");
  assert.deepStrictEqual(기.올림, [], '머리 밑이 아니라 보이는 자리인데 굴렸다');
  /* 머리 높이가 달라도 따라간다 — 박은 숫자가 아니라 잰 값이다 */
  기 = 틀세우기(짐, { 팬위: 60, 머리붙음: true, 머리높이: 140, 굴림상자: false });
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.strictEqual(기.올림.length, 1);
  assert.ok(기.아래로[0][1] < -140, '머리가 더 높아졌는데 내리는 만큼이 그대로다 — 머리 높이를 박았다');
});

test('⑩ 폰: 상세에 들어가면 맨 위로, 닫거나 뒤로가기를 하면 «보던 자리»로 돌아온다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 뒤 = 가짜뒤로(짐);
  let 기 = 틀세우기(짐, { 팬위: -250, 폰: true });
  짐.pageYOffset = 640;
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  assert.deepStrictEqual(기.위로.pop(), [0, 0], '폰에서 상세에 들어갔는데 맨 위로 안 간다');
  assert.deepStrictEqual(기.올림, [], '폰에서 넓은 화면 방식으로 굴렸다');
  짐.pageYOffset = 0;                                /* 상세에서는 맨 위에 있다 */
  실행(짐, "기록고르기('n20260928_b2c3d4e5')");      /* 상세에서 상세로 — 처음 보던 자리를 덮어쓰면 안 된다 */
  기.위로.length = 0;
  실행(짐, '기록닫기()');
  assert.deepStrictEqual(기.위로, [[0, 640]], '‹ 목록을 눌렀는데 보던 자리(640)로 안 돌아온다 — 상세에서 상세로 건넌 뒤라면 처음 자리여야 한다: ' + JSON.stringify(기.위로));
  /* 뒤로가기도 같다 */
  짐.pageYOffset = 910;
  실행(짐, "기록고르기('n20261002_a1b2c3d4')"); 기.위로.length = 0;
  짐.pageYOffset = 0;
  뒤.뒤로가기();
  assert.deepStrictEqual(기.위로, [[0, 910]], '폰의 뒤로가기로 닫았는데 보던 자리로 안 돌아온다');
  /* 한 번 쓴 자리는 지운다 — 다음에 맨 위에서 열고 닫았는데 옛 자리로 튀면 안 된다 */
  짐.pageYOffset = 0;
  실행(짐, "기록고르기('n20261002_a1b2c3d4')"); 기.위로.length = 0;
  실행(짐, '기록닫기()');
  assert.deepStrictEqual(기.위로, [], '맨 위에서 열었다 닫았는데 옛 자리로 튀었다');
  /* 폰에서 저장한 자리가 한 번 쓰이고 «지워졌나» — 안 지우면 창을 돌려 넓어진 뒤(가로 보기) 옛 자리로 쪽이 튄다 */
  짐.pageYOffset = 777;
  실행(짐, "기록고르기('n20261002_a1b2c3d4')");
  뒤.뒤로가기();                                       /* 777 을 쓰고 지운다 */
  기 = 틀세우기(짐, { 팬위: 130, 굴림상자: true, 굴림위: 99 });   /* 이제 넓은 화면 */
  실행(짐, "기록고르기('n20261002_a1b2c3d4')"); 실행(짐, '기록닫기()');
  assert.deepStrictEqual(기.위로, [], '폰에서 쓴 «보던 자리»가 남았다가 넓은 화면에서 쪽이 튀었다');
});

test('⑩ 넓은 화면에서는 «보던 자리»를 저장하지도 되돌리지도 않는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 기 = 틀세우기(짐, { 팬위: 130, 굴림상자: true, 굴림위: 99 });
  짐.pageYOffset = 500;
  실행(짐, "기록고르기('n20261002_a1b2c3d4')"); 실행(짐, '기록닫기()');
  assert.deepStrictEqual(기.위로, [], '넓은 화면에서 쪽을 굴렸다');
  assert.ok(!실행(짐, 'App._기록스크롤'), '넓은 화면에서 보던 자리를 저장했다');
});
