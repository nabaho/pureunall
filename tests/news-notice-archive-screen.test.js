'use strict';
/* 뉴스레터 › 안내문 › «지난 안내문» 상세에 «원문 보관본»이 붙는다 (대표 지시 2026-10-12 「1」 — 본문·파일 보관)
   서버(newsletterNoticeArchive)가 메일 한 통을 받아 본문 글·첨부 파일·원본(.eml)을 지켜 둔 것을 화면이 보인다.

   ■ 이 검사가 지키는 «규칙»
     ① 상태가 말로 갈린다 — 보관됨(칩+본문 전체) · 읽는 중 · 읽지 못함(다시 열면 다시 읽는다) · 보관 못 함(까닭·횟수) · 보관 전
     ② 보관본은 «열 때만» 읽는다(한 번) — 목록을 열 때는 안 읽는다(본문 글이 들어 있어 무겁다). 읽기만 한다
     ③ 사람이 보낸 메일에서 온 글(본문·파일 이름·업체 이름·까닭)은 전부 걸러 그린다 — 본문은 «글자 그대로» 보인다
     ④ 내려받기 링크는 서버가 만든 «토큰 주소»뿐 — javascript:·다른 호스트·따옴표가 섞인 글은 링크가 안 된다(받는 쪽 창은 새 창, noopener)
     ⑤ 첨부는 보관본의 «전부» — 거울은 이름을 5개까지만 가진다. 줄 번호로 «파일별로 보기»를 눌러도 맞는 파일로 간다
     ⑥ «판» — 같은 이름·다른 내용이면 딱지로 가르고(파일 상세에 요약), 보관 안 된 안내문은 세지 않는다
     ⑦ 받은 곳은 원문 머리글로 «확인»했으면 그것(원문 기준)이고 8명 한계 경고는 빠진다 — 확인 못 한 안내문은 경고가 그대로
     ⑧ 목록에 📦 와 «보관 N/M건», 대장(CSV)에 «원문 보관» 열
   ⚠ 화면 코드는 vm 에 «실제로» 올려 돌린다. 업체·파일·주소는 전부 가짜. */

const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { 화면올리기 } = require('./helpers/news-screen-vm.js');

const 서울 = (s) => Date.parse(s + '+09:00');
const 복사 = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const 토큰주소 = (자리, 토큰) => 'https://firebasestorage.googleapis.com/v0/b/b-x.firebasestorage.app/o/' + encodeURIComponent(자리) + '?alt=media&token=' + 토큰;

const A1 = 'n20261002_a1b2c3d4', A2 = 'n20260928_b2c3d4e5', A3 = 'n20250820_c3d4e5f6', A4 = 'n20240301_d4e5f6a7';
const 항목 = (o) => Object.assign({ 구분: '공휴일 안내', 미리보기: '안녕하십니까, 푸른노무법인입니다.', 받는주소수: 24, 한통최대: 8, 업체미확인: 4,
  폴더들: [{ 이름: 'Sent Messages', 수: 3 }], 메일줄수: 3, 복사본수: 0 }, o);
const 거울 = () => ({
  [A1]: 항목({ 제목: '[푸른노무법인] 10월 공휴일 안내', 날짜: '2026-10-02', 시각: 서울('2026-10-02T17:22:00'), 첨부: ['공휴일 안내.pdf'], 이름없는첨부: 2, 업체: ['가나상사'] }),
  [A2]: 항목({ 제목: '[푸른노무법인] 판결 요약', 날짜: '2026-09-28', 시각: 서울('2026-09-28T10:00:00'), 구분: '판결·법령 안내', 첨부: ['휴일대체합의서.hwp'], 업체: ['다라산업'] }),
  [A3]: 항목({ 제목: '<img src=x onerror=alert(1)> "판결"', 날짜: '2025-08-20', 시각: 서울('2025-08-20T11:00:00'), 업체: ['<b>굵은</b>상사'], 미리보기: '앞부분' }),
  [A4]: 항목({ 제목: '보관 전 안내', 날짜: '2024-03-01', 시각: 서울('2024-03-01T09:00:00'), 첨부: ['개정 요약.pdf'] })
});
const 파일7 = ['휴일대체합의서.hwp', '2026 공휴일 안내.pdf', '근로자대표선임서.hwp', '<img src=x onerror=alert(2)>.pdf', "O'Brien.xlsx", '여섯째.pdf', '일곱째.pdf'];
const 때 = Date.UTC(2026, 9, 11, 18, 55);                      /* 서울 2026-10-12 03:55 */
const 표지들 = () => ({
  [A1]: { 판: 1, 때, 방법: 'pop3', 본문: true, 첨부수: 7, 원본: true, 받은곳: true, 메일수: 3,
    해시들: 파일7.map((이름, i) => ({ 이름, 해시: i === 0 ? 'h2' : 'x' + i, 크기: 1024 * (i + 1) })) },
  [A2]: { 판: 1, 때, 방법: 'imap', 본문: true, 첨부수: 1, 원본: true, 받은곳: false, 메일수: 0,
    해시들: [{ 이름: '휴일대체합의서.hwp', 해시: 'h1', 크기: 15000 }] },
  [A3]: { 판: 1, 실패: { 때, 까닭: '<b>POP3</b> 에서 찾지 못했습니다', 횟수: 3 } }
});
const 본들 = () => ({
  [A1]: { 판: 1, 때, 방법: 'pop3', 메일: { 제목: '[푸른노무법인] 10월 공휴일 안내', 날짜: 때, 크기: 19160000, 칸: '다음메일(POP3)' },
    본문: '안녕하세요. 푸른노무법인입니다.\n\n10월 공휴일을 안내합니다.\n<script>alert(1)</script> & "인용"', 본문잘림: false, 본문길이: 70,
    첨부: 파일7.map((이름, i) => ({ 이름, 형식: 'application/octet-stream', 크기: 1024 * (i + 1), 해시: i === 0 ? 'h2' : 'x' + i, 주소: 토큰주소('newsletter_archive/files/ab/' + 이름, 'tok' + i) })),
    건너뜀: [{ 이름: '큰파일.zip', 크기: 99999999, 까닭: '너무 큼' }],
    원본: { 크기: 19160000, 주소: 토큰주소('newsletter_archive/eml/' + A1 + '.eml', 'tokE') },
    받은곳: { 받는주소수: 24, 한통최대: 8, 메일수: 3, 업체: Array.from({ length: 20 }, (_, i) => '가나' + i + '상사'), 명함업체: ['마바상회'], 업체미확인: 3 } },
  [A2]: { 판: 1, 때, 방법: 'imap', 메일: { 제목: '판결 요약', 날짜: 때, 크기: 700000, 칸: '예약편지함' }, 본문: '판결 요약 본문', 본문잘림: false, 본문길이: 8,
    첨부: [{ 이름: '휴일대체합의서.hwp', 형식: 'x', 크기: 15000, 해시: 'h1', 주소: 토큰주소('newsletter_archive/files/cd/휴일대체합의서.hwp', 'tokH1') }], 건너뜀: [], 원본: null, 받은곳: null }
});

function 짐세우기(o) {
  const x = o || {};
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면 스크립트가 올라가다 멈췄다: ' + (짐.올림오류 && 짐.올림오류.message));
  짐.__읽은것 = []; 짐.__쓴것 = []; 짐.__토스트 = []; 짐.__렌더 = 0; 짐.__읽기실패 = new Set();
  짐.__서버 = { 'newsletter/noticeLog': { items: 거울(), meta: { 확인한때: 때, 규칙판: 1 }, archiveIndex: x.표지들 || 표지들() } };
  Object.entries(x.본들 || 본들()).forEach(([id, 본]) => { 짐.__서버['newsletter/noticeArchive/' + id] = 본; });
  const 쓰기 = (경로) => async () => { 짐.__쓴것.push(경로); };
  짐.__대기 = {};
  짐.__db = { ref: (경로) => ({
    once: () => {
      짐.__읽은것.push(경로);
      if (짐.__읽기실패.has(경로)) return Promise.reject(new Error('permission_denied'));
      const 값 = () => ({ val: () => 복사(짐.__서버[경로]) });
      return 짐.__붙들기 && /noticeArchive/.test(경로) ? new Promise((끝) => { 짐.__대기[경로] = () => 끝(값()); }) : Promise.resolve(값());
    },
    set: 쓰기(경로), update: 쓰기(경로), remove: 쓰기(경로), push: 쓰기(경로), transaction: 쓰기(경로)
  }) };
  짐.setTimeout = () => 1;
  짐.matchMedia = () => ({ matches: false, addEventListener() {} });
  vm.runInContext(`db = __db; toast = function(m){ __토스트.push(String(m)); }; render = function(){ __렌더++; };
    App.tab = 'note'; App.설정 = {}; App.안내문들 = {};`, 짐);
  return 짐;
}
const 실행 = (짐, 글) => vm.runInContext(글, 짐);
const 읽기끝 = async (짐) => { await 실행(짐, '안내기록읽기()'); };
const 화면 = (짐) => String(실행(짐, '안내문화면()'));
const 말 = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const 열기 = async (짐, id) => { 실행(짐, `기록고르기('${id}')`); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); return 화면(짐); };

/* ───────────────────────── ① 상태 ───────────────────────── */

test('① 보관됨 · 읽는 중 · 읽지 못함 · 보관 못 함 · 보관 전 — 말이 서로 다르다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  /* 읽는 중 — 서버 대답을 붙들어 둔다 */
  짐.__붙들기 = true;
  실행(짐, `기록고르기('${A1}')`);
  let html = 화면(짐), 글 = 말(html);
  assert.match(글, /원문 보관됨 2026-10-12/, '표지로 아는 «보관됨» 칩이 읽는 동안에도 보여야 한다');
  assert.match(글, /내용 \(메일 본문 전체\) 불러오는 중…/, '읽는 중인데 «불러오는 중»이 아니다');
  짐.__대기['newsletter/noticeArchive/' + A1](); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  글 = 말(화면(짐));
  assert.match(글, /내용 \(메일 본문 전체\)/); assert.ok(!/불러오는 중…/.test(글), '다 읽었는데 아직 「불러오는 중」이다');
  assert.match(글, /안녕하세요\. 푸른노무법인입니다\./);
  /* 읽지 못함 */
  const 못 = 짐세우기(); await 읽기끝(못); 못.__읽기실패.add('newsletter/noticeArchive/' + A1);
  글 = 말(await 열기(못, A1));
  assert.match(글, /보관된 원문을 읽지 못했습니다/); assert.match(글, /내용 \(메일 첫머리\)/, '읽지 못했는데 거울의 앞부분마저 숨겼다');
  /* 다시 열면 다시 읽는다 */
  못.__읽기실패.clear(); 실행(못, '기록닫기()');
  글 = 말(await 열기(못, A1));
  assert.match(글, /내용 \(메일 본문 전체\)/, '읽기에 한 번 실패하면 이 화면이 닫힐 때까지 영영 못 읽는다');
  assert.strictEqual(못.__읽은것.filter((p) => /noticeArchive/.test(p)).length, 2);
  /* 보관 못 함 — 까닭·횟수, 앞부분은 그대로 */
  글 = 말(await 열기(짐, A3));
  assert.match(글, /⚠ 원문 보관 못 함/); assert.match(글, /원문을 보관하지 못했습니다 — <b>POP3<\/b> 에서 찾지 못했습니다 \(3번 시도 · 매일 새벽 다시 시도합니다\)/, '까닭(걸러서 글자 그대로)·시도 횟수가 안 보인다');
  assert.match(글, /내용 \(메일 첫머리\) 앞부분/);
  /* 보관 전 */
  글 = 말(await 열기(짐, A4));
  assert.match(글, /📦 보관 전/); assert.match(글, /아직 원문 보관 전입니다/);
  assert.ok(!/불러오는 중|보관된 원문을 읽지 못했습니다/.test(글));
});

/* ───────────────────────── ② 보관본 ───────────────────────── */

test('② 보관된 안내문 — 본문 전체 · 첨부 «전부»(거울 한도 5개 넘게) · 내려받기 링크 · 원본 .eml · 건너뜀', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const html = await 열기(짐, A1), 글 = 말(html);
  assert.match(html, /class="nbody full"/, '본문 상자가 «전체 본문»용이 아니다(자르거나 가운데 정렬 등)');
  assert.match(글, /10월 공휴일을 안내합니다\.\s*<script>alert\(1\)<\/script> & "인용"/, '본문이 «글자 그대로» 보이지 않는다(마크업으로 읽혔거나 줄바꿈이 사라졌다)');
  assert.match(글, /첨부 파일 7개/, '보관본의 첨부 7개가 아니라 거울의 이름 한 개+이름 없는 둘로 보인다');
  파일7.forEach((이름) => assert.ok(글.includes(이름), '첨부가 빠졌다: ' + 이름));
  assert.match(글, /큰파일\.zip 보관하지 않았습니다 — 너무 큼/, '건너뛴 첨부를 숨겼다');
  assert.strictEqual((html.match(/📥 내려받기/g) || []).length, 7 + 1, '내려받기가 첨부 7개 + 원본 1개여야 한다');
  assert.match(글, /원본 메일\(\.eml\) 18\.3MB/, '원본 .eml 줄이 없거나 크기가 틀리다');
  assert.match(글, /보관 2026-10-12 · 다음메일\(POP3 — 창 밖이라 이 길로 받았습니다\) · 메일 18\.3MB/, '어디서·언제 보관했는지가 안 보인다');
  assert.ok(!/이름이 기록에 없는 첨부/.test(글), '보관본이 있는데 «이름 없는 첨부» 말이 남았다');
  /* 링크 모양 */
  const 링크들 = [...html.matchAll(/<a class="mini" href="([^"]+)" target="_blank" rel="noopener noreferrer">📥 내려받기<\/a>/g)].map((m) => m[1]);
  assert.strictEqual(링크들.length, 8);
  링크들.forEach((u) => assert.match(u, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/b-x\.firebasestorage\.app\/o\/[^"\s]+\?alt=media&amp;token=tok[E0-9]$/, '내려받기 주소가 서버 토큰 주소 꼴이 아니다: ' + u));
  /* 읽기만 */
  assert.deepStrictEqual(짐.__쓴것, [], '화면이 서버에 썼다');
});

test('③ 걸러 그리기 — 본문·파일 이름·업체 이름·까닭은 마크업이 되지 않고, 링크는 토큰 주소만', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  let html = await 열기(짐, A1);
  assert.ok(!/<script>alert\(1\)/.test(html), '본문 속 <script> 가 살아 있다'); assert.ok(!/<img src=x onerror=alert\(2\)>/.test(html), '파일 이름 속 <img> 가 살아 있다');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  html = await 열기(짐, A3);
  assert.ok(!/<b>POP3<\/b>/.test(html), '보관 못 한 까닭 속 <b> 가 마크업이 되었다'); assert.ok(!/<img src=x onerror=alert\(1\)>/.test(html));
  /* 못 믿을 주소 — 서버가 아닌 누군가가 DB 에 심었다고 해도 링크가 안 된다 */
  const 나쁜 = 본들(); 나쁜[A1].첨부[0].주소 = 'javascript:alert(1)'; 나쁜[A1].첨부[1].주소 = 'https://evil.test/v0/b/x/o/a?token=1'; 나쁜[A1].첨부[2].주소 = 토큰주소('a', 't') + '" onclick="x';
  나쁜[A1].원본.주소 = 'data:text/html,<b>x</b>';
  const 나쁜짐 = 짐세우기({ 본들: 나쁜 }); await 읽기끝(나쁜짐);
  const 나쁜html = await 열기(나쁜짐, A1);
  assert.strictEqual((나쁜html.match(/📥 내려받기/g) || []).length, 4, '못 믿을 주소(4개)가 링크가 되었다 — 첨부 7개 중 세 개와 원본이 막혀 4개만 남아야 한다');
  assert.ok(!/javascript:|evil\.test|data:text|onclick="x/.test(나쁜html), '못 믿을 주소의 글자가 화면에 남았다');
});

test('② 받은 곳 — 원문 머리글로 «확인»했으면 그것(원문 기준)·8명 한계 경고가 빠지고, 확인 못 한 안내문은 그대로', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  let 글 = 말(await 열기(짐, A1));
  assert.match(글, /받은 주소 24개 \(원문 기준\)/); assert.match(글, /받은 곳 — 업체 이름을 찾은 21곳/, '확인한 받은 곳(업체 20 + 명함 1)이 아니라 거울 값(1곳)이다');
  assert.match(글, /원문 머리글 기준 — 받은 주소 24개\(메일 3통 · 한 통 최대 8명\)/); assert.match(글, /숨은참조는 원문에도 없어 알 수 없습니다/);
  assert.ok(!/8명까지만 남아/.test(글), '원문 머리글로 확인했는데 «실제로는 더 많을 수 있다» 거짓 경고가 남았다');
  assert.match(글, /가나0상사/); assert.match(글, /\+3곳 ▾/, '업체 18곳까지만 먼저 보이고 나머지는 펼치게 해야 한다');
  실행(짐, `기록펼치기('${A1}')`); assert.match(말(화면(짐)), /마바상회\(명함\)/, '펼쳐도 명함으로 찾은 업체가 안 보인다');
  글 = 말(await 열기(짐, A2));                                          /* 보관은 됐지만 받은 곳은 확인 못 했다(받은곳 null) */
  assert.match(글, /8명까지만 남아/, '받은 곳을 확인 못 했는데 한계 경고를 뺐다'); assert.ok(!/원문 기준/.test(글));
  글 = 말(await 열기(짐, A4));
  assert.match(글, /8명까지만 남아/);
});

/* ───────────────────────── ② 읽는 때 ───────────────────────── */

test('② 보관본은 «열 때만» 한 번 읽는다 — 목록을 열 때는 안 읽는다 · 같은 안내문을 다시 열어도 다시 안 읽는다 · 보관 전 안내문은 아예 안 읽는다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  assert.deepStrictEqual(짐.__읽은것, ['newsletter/noticeLog'], '목록을 여는데 보관본(본문 글이 든 무거운 것)을 읽는다');
  assert.ok(화면(짐).length > 0);
  await 열기(짐, A1); await 열기(짐, A1);
  assert.deepStrictEqual(짐.__읽은것.filter((p) => /noticeArchive/.test(p)), ['newsletter/noticeArchive/' + A1], '같은 안내문의 보관본을 ' + 짐.__읽은것.filter((p) => /noticeArchive/.test(p)).length + '번 읽었다');
  await 열기(짐, A4); await 열기(짐, A3);
  assert.strictEqual(짐.__읽은것.filter((p) => /noticeArchive/.test(p)).length, 1, '보관 전·보관 못 함 안내문의 보관본을 읽으려 했다 — 없는 자리를 읽는 요금만 든다');
  await 열기(짐, A2);
  assert.strictEqual(짐.__읽은것.filter((p) => /noticeArchive/.test(p)).length, 2);
  assert.deepStrictEqual(짐.__쓴것, []);
});

/* ───────────────────────── ⑤ ⑥ 파일·판 ───────────────────────── */

test('⑤ «파일별로 보기»는 보관본의 줄 번호로 맞는 파일에 간다 — 거울 이름(5개 한도)이 아니라', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  await 열기(짐, A1);
  실행(짐, '기록파일열기(3)');                                          /* 보관본의 넷째 = <img> 이름 */
  assert.strictEqual(실행(짐, 'App.지금파일'), 파일7[3], '다른 파일로 갔다');
  실행(짐, "기록닫기(); 기록고르기('" + A1 + "'); 기록파일열기(0)");
  assert.strictEqual(실행(짐, 'App.지금파일'), '휴일대체합의서.hwp');
  /* 보관 전 안내문은 거울 이름으로 — 예전 그대로 */
  await 열기(짐, A4);
  실행(짐, '기록파일열기(0)');
  assert.strictEqual(실행(짐, 'App.지금파일'), '개정 요약.pdf');
});

test('⑥ 판 — 같은 이름·다른 내용을 딱지로 가르고 · 같은 내용은 «같은 내용으로 N번» · 파일 상세에 요약 · 보관 안 된 안내문은 안 센다', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  let html = await 열기(짐, A1), 글 = 말(html);
  assert.match(글, /휴일대체합의서\.hwp 판 ② 1KB/, '내용이 달라진 파일(판 ②)의 딱지·크기가 안 보인다');
  assert.match(글, /같은 이름의 파일이 내용이 달라진 적\s*이 있습니다\(판 2개\) — 이 파일은 «판 ②»입니다/);
  assert.match(html, /<button class="mini" onclick="기록파일열기\(0\)">파일별로 보기 ›<\/button>/, '이름이 같은 파일이 여러 번 나갔는데 파일별로 보기가 없다');
  글 = 말(await 열기(짐, A2));
  assert.match(글, /휴일대체합의서\.hwp 판 ① 15KB/); assert.match(글, /이 파일은 이번 한 번 보냈습니다 — 2026-09-28/, '판 ①은 이 안내문에서 한 번 나갔다(판 ②는 다른 안내문)');
  /* 파일 상세 */
  실행(짐, "기록파일열기(0)");
  const 파일 = 화면(짐), 파일글 = 말(파일);
  assert.match(파일글, /내용이 다른 판 2개/); assert.match(파일글, /같은 이름 · 내용이 다른 판 2개 \(보관된 안내문 기준\)/);
  assert.match(파일글, /판 ① 2026-09-28 · 1번 · 15KB/); assert.match(파일글, /판 ② 2026-10-02 · 1번 · 1KB/);
  assert.strictEqual((파일.match(/class="ver">판 [①②]<\/span>/g) || []).length >= 4, true, '타임라인과 요약에 판 딱지가 없다');
  assert.match(파일글, /보관된 안내문\(📦\)에서는 파일 «내용»까지 내려받을 수 있습니다/);
  assert.strictEqual((파일.match(/title="원문 보관됨">📦/g) || []).length, 2, '보관된 안내문 둘에 📦 가 붙어야 한다');
  /* 보관된 곳이 한 곳도 없는 파일 */
  실행(짐, "App.지금파일 = '개정 요약.pdf'"); const 안 = 말(화면(짐));
  assert.match(안, /파일 «내용»은 아직 보관 전이라 이 기록에 없습니다/); assert.ok(!/내용이 다른 판/.test(안));
  /* 실패한 안내문(A3)의 파일은 판으로 안 센다 */
  const 실패짐 = 짐세우기({ 표지들: Object.assign(표지들(), { [A3]: { 판: 1, 실패: { 때, 횟수: 1, 까닭: 'x' }, 해시들: [{ 이름: '휴일대체합의서.hwp', 해시: 'h9', 크기: 1 }] } }) });
  await 읽기끝(실패짐); 실행(실패짐, "App.지금파일 = '휴일대체합의서.hwp'");
  assert.match(말(화면(실패짐)), /내용이 다른 판 2개/, '보관 못 한 안내문의 해시를 판으로 셌다 — 3개가 된다');
});

/* ───────────────────────── ⑧ 목록·CSV ───────────────────────── */

test('⑧ 목록에 📦 · «원문 보관 N/M건» · 못 한 것 수 · 대장(CSV)에 «원문 보관» 열', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const html = 화면(짐), 글 = 말(html);
  assert.strictEqual((html.match(/class="nlg-ar" title="원문\(본문·파일\)이 보관돼 있습니다">📦/g) || []).length, 2, '보관된 두 안내문 줄에만 📦 가 붙어야 한다');
  assert.match(글, /원문\(본문·파일\) 보관 2\/4건 · 못 한 것 1건\(자동으로 다시 시도\)/);
  /* CSV */
  const 받은 = [];
  짐.Blob = function (조각) { this.조각 = 조각; }; 짐.URL = { createObjectURL: (b) => { 받은.push(b); return 'blob:x'; }, revokeObjectURL() {} };
  짐.document.createElement = () => ({ click() {}, remove() {}, set href(v) {}, get href() { return ''; } }); 짐.document.body.appendChild = (x) => x;
  실행(짐, '기록내려받기()');
  const csv = String(받은[0].조각[0]), 행 = csv.slice(1).split('\r\n');
  assert.match(행[0], /원문 보관/); assert.ok(/보관됨 2026-10-12/.test(csv)); assert.ok(/보관 못 함/.test(csv));
  assert.strictEqual(csv.split('보관됨 2026-10-12').length - 1, 2);
});

test('④ 소스 규칙 — 보관 링크는 «안전주소»를 거친 값만 href 에 넣는다 · 새 창은 noopener', () => {
  const fs = require('node:fs'), path = require('node:path');
  const { stripComments } = require('./strip-comments.js');
  const 글 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
  const 시작 = 글.indexOf('function 기록첨부줄('), 끝 = 글.indexOf('function 기록메일함찾기(', 시작);
  const 블록 = 글.slice(시작, 끝);
  const hrefs = [...블록.matchAll(/href="'\s*\+\s*([^+]+?)\s*\+\s*'"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 2, '내려받기 링크를 못 찾았다');
  assert.ok(블록.includes('NL.안전주소(a.주소)') && 블록.includes('NL.안전주소(본.원본.주소)'), '링크 주소가 안전주소를 안 거친다');
  assert.ok(/esc\(a\.주소\)/.test(블록) && /esc\(NL\.안전주소\(본\.원본\.주소\)\)/.test(블록), '주소를 걸러(esc) 넣지 않는다');
  assert.strictEqual((블록.match(/target="_blank"/g) || []).length, (블록.match(/rel="noopener noreferrer"/g) || []).length, '새 창을 여는데 noopener 가 빠진 링크가 있다');
});

test('⑤ 보관한 안내문은 목록의 📎 수·파일별 목록이 «보관본의 이름 전부»를 쓴다 — 거울이 이름을 못 가진 첨부까지', async () => {
  const 짐 = 짐세우기(); await 읽기끝(짐);
  const 글 = 말(화면(짐));
  assert.match(글, /2026-10-02 · 📎 7 · 📦/, '보관한 안내문의 첨부 수가 거울 값(이름 1 + 이름 없는 2 = 3)에 머문다');
  assert.match(글, /2026-09-28 · 📎 1 · 📦/); assert.match(글, /2024-03-01 · 📎 1(?! ·)/, '보관 전 안내문은 거울 값 그대로');
  실행(짐, "기록보기바꿈('file')");
  const 파일글 = 말(화면(짐));
  ['근로자대표선임서.hwp', '여섯째.pdf', '일곱째.pdf', '개정 요약.pdf'].forEach((이름) => assert.ok(파일글.includes(이름), '파일별 목록에 이 파일이 없다: ' + 이름));
  /* 서로 다른 파일 이름: 보관본 7(휴일대체합의서는 판결 요약 안내문에도 붙어 한 파일) + 보관 전 «개정 요약» 1 = 8 */
  assert.match(파일글, /파일별\s*8/, '파일별 개수가 서로 다른 파일 이름 수(8)와 다르다');
  assert.match(파일글, /2번 📝 휴일대체합의서\.hwp/, '두 안내문에 붙은 같은 이름이 한 파일(2번)로 안 묶였다');
});

test('② 긴 글은 «잘렸다»고 알린다 — 몇 자까지 보관했고 전체가 몇 자인지, 나머지는 원본(.eml)에 있다는 것', async () => {
  const 긴 = 본들(); 긴[A1].본문 = '가'.repeat(1234); 긴[A1].본문잘림 = true; 긴[A1].본문길이 = 45678;
  const 짐 = 짐세우기({ 본들: 긴 }); await 읽기끝(짐);
  const 글 = 말(await 열기(짐, A1));
  assert.match(글, /※ 긴 글이라 앞 1,234자만 보관했습니다\(전체 45,678자\) — 나머지는 원본 메일\(\.eml\)에 있습니다/, '잘렸는데 «전문이 아니다»를 안 알린다 — 읽는 사람이 이것이 전부인 줄 안다');
  const 보통 = 짐세우기(); await 읽기끝(보통);
  const 안 = 말(await 열기(보통, A2));
  assert.ok(!/긴 글이라 앞/.test(안), '잘리지 않은 글에 «잘렸다»를 적었다');
});

test('⑫ 다시 가져올 수 없는 안내문 — «다시 시도하지 않습니다»·직접 저장 안내 · 목록 아래 요약 · CSV (거짓으로 «매일 새벽 다시 시도»라 하지 않는다)', async () => {
  const 영구표 = 표지들(); 영구표[A3] = { 판: 2, 실패: { 때, 까닭: '보낸편지함 메일이 창 밖입니다', 횟수: 1, 영구: true } };
  let 짐 = 짐세우기({ 표지들: 영구표 }); await 읽기끝(짐);
  let 글 = 말(await 열기(짐, A3));
  assert.match(글, /원문을 보관하지 못했습니다 — 보낸편지함 메일이 창 밖입니다 \(다시 시도하지 않습니다 · 원문이 필요하면 다음메일 웹 «보낸편지함»에서 이 메일을 직접 저장해 두십시오\)/);
  assert.ok(!/매일 새벽 다시 시도합니다/.test(글), '영구 실패인데 «매일 새벽 다시 시도합니다»라고 한다');
  실행(짐, '기록닫기()'); 글 = 말(화면(짐));
  assert.match(글, /못 한 것 1건\(다시 가져올 수 없음\)/, '목록 아래 요약이 영구 실패를 «자동으로 다시 시도»라 한다');
  /* 섞이면 — 그중 몇 건 */
  영구표[A4] = { 판: 2, 실패: { 때, 까닭: '일시적', 횟수: 2 } };
  짐 = 짐세우기({ 표지들: 영구표 }); await 읽기끝(짐);
  assert.match(말(화면(짐)), /못 한 것 2건\(그중 1건은 다시 가져올 수 없음 · 나머지는 자동으로 다시 시도\)/);
  /* 보통 실패는 예전 그대로 */
  짐 = 짐세우기(); await 읽기끝(짐);
  assert.match(말(화면(짐)), /못 한 것 1건\(자동으로 다시 시도\)/);
  assert.match(말(await 열기(짐, A3)), /3번 시도 · 매일 새벽 다시 시도합니다/);
  /* CSV */
  짐 = 짐세우기({ 표지들: 영구표 }); await 읽기끝(짐);
  const 받은 = [];
  짐.Blob = function (조각) { this.조각 = 조각; }; 짐.URL = { createObjectURL: (b) => { 받은.push(b); return 'blob:x'; }, revokeObjectURL() {} };
  짐.document.createElement = () => ({ click() {}, remove() {}, set href(v) {}, get href() { return ''; } }); 짐.document.body.appendChild = (x) => x;
  실행(짐, '기록내려받기()');
  assert.ok(/보관 못 함\(다시 가져올 수 없음\)/.test(String(받은[0].조각[0])), 'CSV 가 영구 실패를 구별하지 않는다');
});

test('② 받은 곳 — 이름 목록이 서버 한도에서 잘렸으면 «진짜 수»를 쓰고 «이름은 앞 N곳까지만»을 알린다 · 수가 맞으면 말이 없다', async () => {
  const 본 = 본들(); 본[A1].받은곳.업체수 = 520; 본[A1].받은곳.명함수 = 30;
  let 짐 = 짐세우기({ 본들: 본 }); await 읽기끝(짐);
  let 글 = 말(await 열기(짐, A1));
  assert.match(글, /받은 곳 — 업체 이름을 찾은 550곳 \(이름은 앞 21곳까지만 적어 둡니다\)/, '서버가 이름을 잘랐는데 «21곳»으로 보인다 — 사실과 다르다');
  짐 = 짐세우기(); await 읽기끝(짐);
  글 = 말(await 열기(짐, A1));
  assert.match(글, /받은 곳 — 업체 이름을 찾은 21곳/); assert.ok(!/까지만 적어 둡니다/.test(글), '진짜 수가 없는(옛) 보관본에 «잘렸다»를 적었다');
  const 맞음 = 본들(); 맞음[A1].받은곳.업체수 = 20; 맞음[A1].받은곳.명함수 = 1;
  짐 = 짐세우기({ 본들: 맞음 }); await 읽기끝(짐);
  글 = 말(await 열기(짐, A1));
  assert.match(글, /받은 곳 — 업체 이름을 찾은 21곳/); assert.ok(!/까지만 적어 둡니다/.test(글), '이름이 다 보이는데 «잘렸다»를 적었다');
});
