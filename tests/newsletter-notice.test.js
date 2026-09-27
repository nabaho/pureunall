/* 안내문 — 뉴스레터가 아닌 «한 건 집중» 편지 (대표 지시 2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   「뉴스레터 이외에 비정기적인 자료를 푸른노무법인 이름으로 뉴스레터가 아닌 내용으로
    집중해서 확인하라는 의미로 보내고 싶은데 이부분도 반영해라」
   대표 결정(목업): 그대로 · ✅ 확인 단추 «뺀다» · 문의는 «사업장별 담당 노무사».

   ■ 이 검사가 지키는 것
     ㉠ 뉴스레터와 «달라 보인다» — 꼭지·차림표가 없고, 제목이 [○○ 안내] 로 시작한다
     ㉡ 사람이 쓴 { } 가 «사라지지 않는다» — 발송기는 {무엇} 을 자리로 읽어 비운다
     ㉢ 담당은 «통마다» 끼워진다 — 모르면 비우고 대표 번호만 남는다(지어내지 않는다)
     ㉣ 두 번 보내기를 «서버가» 막는다 — 총괄관리자만, 번호 꼴만, 뉴스레터와 섞지 않는다
     ㉤ 자료는 «내려받기»로만 — 우리 주소 안에서 문서가 열리지 않는다
     ㉥ 확인 단추는 «없다»(대표 결정) — 누가 되살리면 여기서 걸린다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const N = require('../js/pu-news-notice.js');
const C = require('../js/pu-news-core.js');
const MB = require('../functions/mail-bulk.js');
const NV = require('../functions/news-view.js');
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), 'utf8');
const 화면 = 주석걷기(읽기('pu-news.html'));
const 서버 = 주석걷기(읽기('functions/index.js'));

const 설 = { 회사이름: '푸른노무법인', 회신주소: '370-6@daum.net', 전화: '041-000-0000' };
const 견본 = () => ({
  제목: '10월 1일부터 달라지는 육아휴직 급여',
  요점: ['9월 중 육아휴직을 신청한 근로자가 있는지', '시작일이 10월 1일 전인지 뒤인지'],
  기한: '2026-09-30',
  본문: '가나상사처럼 신청을 앞둔 곳은 시작일을 살펴보셔야 합니다.',
  첨부: [{ 이름: '안내 자료', 주소: 'https://asia-northeast3-pureun-erp.cloudfunctions.net/newsView?file='
    + 'a'.repeat(32) + '.pdf&n=x', 크기: 320000 }]
});
const 짓기 = (x, o) => N.안내짓기(x || 견본(), 설, Object.assign({ 범위: '자문중', 날짜: Date.UTC(2026, 8, 23) }, o || {}));

/* ═══ ㉠ 뉴스레터와 달라 보인다 ═════════════════════════════════════════ */
test('★★ 제목이 «[푸른노무법인 안내]»로 시작하고 기한이 붙는다 — 뉴스레터와 안 섞인다', () => {
  const r = 짓기();
  assert.match(r.제목, /^\[푸른노무법인 안내\] /);
  assert.ok(r.제목.includes('9월 30일(수)까지'), '기한이 제목에 없다');
  assert.ok(!/주간뉴스레터|뉴스레터/.test(r.제목), '제목에 뉴스레터 말이 섞였다');
});

test('★★ 꼭지·차림표·영문 딱지가 «없다» — 한 건만', () => {
  const h = 짓기().서식;
  C.꼭지들.forEach((g) => assert.ok(!h.includes(g.이름), '꼭지 이름 «' + g.이름 + '» 이 들어 있다'));
  assert.ok(!/data-stick|id="g-/.test(h), '차림표·꼭지 자리표가 들어 있다');
  assert.ok(h.includes('확인 요청'), '「확인 요청」 딱지가 없다');
  assert.ok(h.includes('이것만 확인해 주십시오'), '확인할 것 상자가 없다');
  assert.ok(h.includes('①') && h.includes('②'), '확인할 것에 번호가 없다');
  assert.ok(h.includes('회신 기한'), '기한이 없다');
});

test('실을 것이 없으면 «안 짓는다»', () => {
  assert.strictEqual(짓기({ 제목: '' }), null);
  assert.strictEqual(짓기({ 제목: '제목만' }), null, '제목만으로는 안내문이 아니다');
  assert.ok(짓기({ 제목: '제목', 본문: '본문' }), '본문만 있어도 지어진다');
  assert.ok(짓기({ 제목: '제목', 요점: ['하나'] }), '확인할 것만 있어도 지어진다');
});

test('글자는 씻긴다 — 태그가 편지로 새지 않는다', () => {
  const r = 짓기({ 제목: '<b>제</b>', 본문: '<script>x</script>' });
  assert.ok(!r.서식.includes('<script>x'), '본문 태그가 살아났다');
  assert.ok(!r.서식.includes('<b>제</b>'), '제목 태그가 살아났다');
});

test('기한 꼴이 틀리면 «안 쓴다» — 지어내지 않는다', () => {
  assert.strictEqual(N.기한글('2026-02-30'), '');
  assert.strictEqual(N.기한글('내일'), '');
  assert.strictEqual(N.기한글('2026-09-30'), '9월 30일(수)');
});

/* ═══ ㉡ 사람이 쓴 { } ═════════════════════════════════════════════════
   ⚠⚠ 발송기의 fill 은 {무엇} 을 «모두» 자리로 읽고 모르는 것은 빈 글자로 바꾼다.
     안 막으면 「{주의}」라고 쓴 글자가 편지에서 조용히 사라진다. */
test('★★★ 사람이 쓴 { } 가 발송기를 지나도 «살아 있다» — 제목·서식·평문 모두', () => {
  const r = 짓기({ 제목: '{육아}휴직', 요점: ['{가}'], 본문: '본문 {주의} 끝' });
  const vals = { 담당문의: '' };
  const 통 = [r.제목, r.서식, r.본문].map((s) => MB.fill(s, vals));
  assert.ok(통[0].includes('육아') && /[｛{]육아[｝}]|&#123;육아&#125;/.test(통[0] + 통[1]),
    '제목의 중괄호 글자가 사라졌다');
  assert.ok(/&#123;주의&#125;/.test(통[1]), '서식에서 {주의} 가 사라졌다');
  assert.ok(통[2].includes('｛주의｝'), '평문에서 {주의} 가 사라졌다');
  /* 그리고 «우리 자리»는 딱 하나 — {담당문의} */
  const 자리들 = (r.서식.match(/\{[^{}]{1,20}\}/g) || []);
  assert.deepStrictEqual(자리들, ['{담당문의}'], '서식에 발송기가 읽을 자리가 따로 있다: ' + 자리들);
});

/* ═══ ㉢ 담당은 통마다 ══════════════════════════════════════════════════ */
test('★★★ 발송기가 «통마다» 담당을 끼운다 — 모르면 빈 글자(대표 번호만 남는다)', () => {
  const r = 짓기();
  const v = MB.validateBulk({ subject: r.제목, body: r.본문, html: r.서식,
    to: [{ email: 'a@x.test', staff: '홍길동' }, { email: 'b@x.test' }] });
  assert.ok(v.ok, v.error);
  const 줄 = MB.buildQueue(v, 1000, 'me', 'b1');
  assert.ok(줄[0].payload.html.includes('문의 · 담당 홍길동 · 푸른노무법인'), '담당이 안 끼워졌다');
  assert.ok(줄[0].payload.body.includes('문의 · 담당 홍길동 · 푸른노무법인'), '평문에 담당이 안 끼워졌다');
  assert.ok(줄[1].payload.html.includes('문의 · 푸른노무법인'), '담당을 모르는 곳이 대표 번호로 안 갔다');
  assert.ok(!줄[1].payload.html.includes('담당 '), '모르는 담당을 지어냈다');
  assert.ok(!줄.some((x) => x.payload.html.includes('{담당문의}')), '자리가 글자 그대로 남았다');
});

test('★★ 담당 이름에 섞인 태그·중괄호는 걷힌다 — 서식에 그대로 끼워지는 값이다', () => {
  const v = MB.validateBulk({ subject: 's', body: 'b', html: '{담당문의}',
    to: [{ email: 'a@x.test', staff: '<b>홍{길}동</b>' }] });
  const h = MB.buildQueue(v, 1, 'me', 'b')[0].payload.html;
  assert.ok(h.startsWith('담당 '), '담당이 아예 안 끼워졌다: ' + h);
  assert.ok(!/[<>{}]/.test(h.replace(/^담당 /, '')), '담당 값의 태그·중괄호가 남았다: ' + h);
});

test('★ 미리 보기·시험의 담당 끼우기가 발송기와 «같은 글자»다', () => {
  const r = 짓기();
  const v = MB.validateBulk({ subject: r.제목, body: r.본문, html: r.서식, to: [{ email: 'a@x.test', staff: '홍길동' }] });
  const 발 = MB.buildQueue(v, 1, 'me', 'b')[0].payload.html;
  assert.strictEqual(N.담당채우기(r.서식, '홍길동'), 발, '시험 편지가 진짜와 다르다');
  assert.strictEqual(N.담당채우기(r.서식, ''), MB.fill(r.서식, { 담당문의: '' }));
});

test('★★ 화면은 담당을 «업체관리 주담당 사번 → 명부 이름»으로 잇는다(이름으로 안 찾는다)', () => {
  const 몸 = 함수몸(화면, '안내담당');
  assert.ok(몸, '안내담당 이 없다');
  assert.ok(/managerMain/.test(몸), '주담당(managerMain)으로 안 잇는다');
  assert.ok(/App\.명부/.test(몸), '명부(사번 → 이름)로 안 찾는다');
  assert.ok(!/노무사/.test(몸), '직함을 지어 붙인다 — 주담당이 노무사가 아닐 수 있다');
  const 받 = 함수몸(화면, '안내받을곳');
  assert.ok(받 && /staff:\s*안내담당/.test(받), '보낼 명단에 담당을 안 싣는다');
  assert.ok(/명단셈\(\)\.전체/.test(받), '뉴스레터 명단(수신거부·계약 끝 거르기)을 안 쓴다');
});

/* ═══ ㉣ 서버의 잠금 ════════════════════════════════════════════════════ */
/* 안내문 갈래 — `const noticeSend` 부터 뉴스레터 갈래의 대기열 쓰기 «앞»까지.
   ⚠ 줄끝·주석으로 자르지 않는다(주석은 걷혔고, 줄끝은 윈도·CI 가 다르다). */
function 안내갈래() {
  const i = 서버.indexOf('exports.sendBulkMail');
  const 몸 = 서버.slice(i, 서버.indexOf('exports.sendScheduledMail', i));
  const a = 몸.indexOf('const noticeSend');
  const b = 몸.indexOf('upd[newsletterSend ? (MD.CARDS_ROOT');
  assert.ok(a > 0, 'sendBulkMail 에 안내문 갈래가 없다');
  assert.ok(b > a, '안내문 갈래가 뉴스레터 대기열 쓰기보다 «앞»에 있어야 한다(끝나면 return)');
  return 몸.slice(a, b);
}
test('★★★ 안내문 발송은 총괄관리자만 · 서버 잠금 · 번호 꼴만', () => {
  const g = 안내갈래();
  assert.ok(/role\.isAdmin !== true/.test(g), '총괄관리자 확인이 없다');
  /* ⚠ «잠글까·transaction 글자가 어딘가 있다»로는 부족하다 — 되돌림 검사에서 헛돌았다.
       잠금의 답(noticeClaim)이 «잠글까를 부른 트랜잭션»에서 나오고, 못 잡으면 409 로 서야 한다. */
  assert.match(g, /noticeClaim = await lockRef\.transaction\(\s*\(cur\) => NL\.잠글까\(/,
    '서버 잠금(트랜잭션)이 없다 — 두 관리자가 같은 순간에 누르면 두 번 나간다');
  assert.match(g, /if \(!noticeClaim\.committed\) \{\s*res\.status\(409\)/, '잠금을 못 잡아도 그대로 건다');
  assert.ok(/NL\.이미마친내요청인가/.test(g), '같은 요청을 다시 물을 때 «그때 결과»를 안 준다 — 두 번 나간다');
  assert.ok(/"newsletter\/notices\/"\s*\+\s*noticeId/.test(g), '안내문 자리가 notices 가 아니다');
  assert.ok(/\/\^-\?\[A-Za-z0-9_-\]\{8,40\}\$\//.test(g), '번호 꼴을 안 본다 — ../ 로 남의 자리를 쓴다');
  assert.ok(/newsletterSend\)\s*\{[\s\S]{0,200}한 번에 보낼 수 없습니다/.test(g), '뉴스레터와 한 요청에 섞인다');
});

test('★★ 안내문 갈래는 뉴스레터 추적 자리(받는이·보냄표·링크들)를 «안 건드린다»', () => {
  const g = 안내갈래();
  assert.ok(!/받는이|보냄표|링크들|newsletter\/issues/.test(g), '안내문 갈래가 뉴스레터 추적 자리를 쓴다');
  /* 그리고 제 일을 마치면 «돌아선다» — 안 돌아서면 뉴스레터 갈래가 대기열을 한 번 더 건다 */
  /* ⚠ 「return 이 어딘가 있다」가 아니라 «안내문 걸기의 맨 끝이 return» 이어야 한다 —
       바로 뒤가 뉴스레터 갈래의 대기열 쓰기라, 안 돌아서면 같은 통이 한 번 더 걸린다. */
  assert.match(g, /\breturn;\s*\}\s*try\s*\{\s*const upd = \{\};\s*rows\.forEach\(\(row\) => \{\s*const key = [^;]+;\s*$/,
    '안내문을 걸고 돌아서지 않는다 — 뉴스레터 갈래가 대기열을 한 번 더 건다');
});

/* ═══ ㉤ 자료는 내려받기로만 ════════════════════════════════════════════ */
test('★★★ 자료 문은 «우리가 지은 열쇠»만 받고, 이름이 종류를 못 바꾼다', () => {
  const 좋 = NV.파일열쇠('0123456789abcdef0123456789abcdef.pdf', '안내 자료');
  assert.ok(좋, '제대로 된 열쇠가 막혔다');
  assert.strictEqual(좋.자리, 'newsletter_files/0123456789abcdef0123456789abcdef.pdf');
  assert.strictEqual(좋.이름, '안내 자료.pdf');
  assert.strictEqual(NV.파일열쇠('0123456789abcdef0123456789abcdef.pdf', '악성.exe').이름, '악성.pdf',
    '이름의 확장자가 파일 종류를 바꾼다');
  assert.ok(!/[\r\n"]/.test(NV.파일열쇠('0'.repeat(32) + '.pdf', 'a"\r\nSet-Cookie: x').이름),
    '이름으로 머리를 끼워 넣을 수 있다');
  ['../x.pdf', '0'.repeat(32) + '.html', '0'.repeat(32) + '.svg', '0'.repeat(32) + '.js',
   '0'.repeat(32) + '.zip', '0'.repeat(31) + '.pdf', 'A'.repeat(32) + '.pdf', '', null]
    .forEach((k) => assert.strictEqual(NV.파일열쇠(k, 'n'), null, JSON.stringify(k) + ' 가 통과했다'));
});

test('★★★ 자료 갈래는 DB 를 안 열고 «내려받기(attachment)»로 준다', () => {
  const i = 서버.indexOf('exports.newsView');
  const 몸 = 서버.slice(i, 서버.indexOf('exports.', i + 10));
  const a = 몸.indexOf('req.query.file != null');
  const b = 몸.indexOf('NV.읽기(req.query)');
  assert.ok(a > 0 && b > a, '자료 갈래가 없거나 회차 읽기보다 뒤에 있다');
  const 갈 = 몸.slice(a, b);
  assert.ok(!/getDatabase|db\.ref/.test(갈), '자료 갈래가 실시간DB 를 연다');
  assert.ok(/NV\.파일열쇠/.test(갈), '열쇠를 안 씻고 창고를 연다');
  assert.ok(/Content-Disposition/.test(갈) && /NV\.내려받기머리/.test(갈), '내려받기로 안 준다 — 우리 주소에서 문서가 열린다');
  assert.ok(/octet-stream/.test(갈) && /nosniff/.test(갈), '종류를 짐작하게 둔다');
  assert.match(NV.내려받기머리('안내.pdf'), /^attachment;/);
});

test('★★ 화면이 받는 확장자와 서버가 받는 확장자가 «같다»', () => {
  const m = /const 안내파일끝들\s*=\s*\[([^\]]*)\]/.exec(화면);
  assert.ok(m, '화면의 확장자 목록을 못 찾았다');
  const 화 = (m[1].match(/'([a-z]+)'/g) || []).map((s) => s.slice(1, -1)).sort();
  assert.deepStrictEqual(화, NV.파일끝들.slice().sort(), '올려 놓고 못 받거나, 막을 것을 올린다');
});

test('★★ 창고 규칙 newsletter_files — 읽기는 막고, 크기를 막는다', () => {
  const 규칙 = 읽기('docs/firebase-storage-전체(붙여넣기용).txt');
  const m = /match \/newsletter_files\/\{file\}\s*\{([\s\S]*?)\n\s*\}/.exec(규칙);
  assert.ok(m, '창고 규칙에 newsletter_files 칸이 없다 — 자료 올리기가 막힌다');
  assert.match(m[1], /allow read:\s*if false;/, '창고 주소로 바로 읽힌다');
  assert.match(m[1], /request\.resource\.size < 20 \* 1024 \* 1024/, '크기 한도가 없다');
});

test('자료 링크는 https 만 — javascript: 같은 것은 버린다', () => {
  const r = 짓기({ 제목: 't', 본문: 'b', 첨부: [{ 이름: '나쁨', 주소: 'javascript:alert(1)' },
    { 이름: '좋음', 주소: 'https://www.moel.go.kr/x' }] });
  assert.ok(!r.서식.includes('javascript:'), 'javascript: 링크가 실렸다');
  assert.ok(r.서식.includes('moel.go.kr'), '좋은 링크가 빠졌다');
  assert.strictEqual(r.첨부수, 1);
});

/* ═══ ㉥ 확인 단추는 없다 ═══════════════════════════════════════════════ */
test('★ 「확인했습니다」 단추는 «없다» — 대표 결정 2026-09-23 「뺀다」', () => {
  const h = 짓기().서식;
  assert.ok(!/확인했습니다/.test(h), '뺀 확인 단추가 되살아났다');
  assert.ok(!/newsOpen|newsClick|\{추적열쇠\}/.test(h), '추적이 들어 있다 — 안내문은 추적하지 않기로 했다');
});

/* ═══ (광고) 잣대는 뉴스레터와 같다 ═════════════════════════════════════ */
test('★★ (광고) 표기 잣대가 뉴스레터와 «같다» — 범위를 넓히면 켜진다', () => {
  assert.ok(!짓기().제목.startsWith('(광고)'), '자문중인데 (광고)가 붙었다');
  const 넓 = 짓기(null, { 범위: '명함전부' });
  assert.ok(넓.제목.startsWith('(광고) '), '범위를 넓혔는데 (광고)가 안 붙었다');
  assert.ok(넓.서식.includes('광고성 정보'), '꼬리에 광고 안내가 없다');
});

/* ═══ 화면 ═════════════════════════════════════════════════════════════ */
test('★ 화면에 「안내문」 탭이 있고 짓개를 싣는다(캐시 번호와 함께)', () => {
  assert.match(화면, /data-t="note"/, '안내문 탭이 없다');
  assert.match(화면, /<script src="js\/pu-news-notice\.js\?v=\d+"/, '안내문 짓개를 안 싣거나 캐시 번호가 없다');
  const 보내기 = 함수몸(화면, '안내보내기');
  assert.ok(보내기 && /noticeSend:\s*\{\s*id:/.test(보내기), '서버 잠금(noticeSend) 없이 보낸다');
  assert.ok(/App\.isAdmin/.test(보내기), '총괄관리자 확인이 없다');
  assert.ok(/안내저장\(x\)/.test(보내기), '저장 전에 보낸다 — 서버가 «없는 안내문»이라 거절한다');
});
