'use strict';
/* 보낸메일함 사본은 «한 번에 한 통» — 실행: node --test tests/mail-one-copy.test.js
   (대표 지시 2026-10-12 「보낸메일함에 이렇게 모두 나오는데 너무 많이 정보가 나와서 과거정보 못 찾겠다.
    한번에 보내면 한번에 보낸 걸로 할 수 있나?」 → 「12」)

   ■ 이 검사가 지키는 «규칙»
     ① 배달은 그대로 «곳마다 한 통» — 바뀌는 것은 보낸함에 넣는 «사본»뿐이다(열람·클릭 번호·이름 넣기·반송 구분이 그 위에 있다)
     ② 뉴스레터·안내문 줄만 규칙을 단다 — 기업정보함 묶음 편지(회사마다 내용이 다른 업무 메일)는 곳별 사본 그대로
     ③ 앞쪽 «두 줄 이상»이 대표 사본 후보다 — 첫 줄이 못 나가도 사본이 통째로 없어지지 않는다. 나머지는 사본 없음
     ④ 대표 사본은 한 묶음에 «한 통» — 먼저 맡은 줄만 넣고, 실패하면 놓아서 다음 후보가 이어받는다
     ⑤ 대표 사본의 받는사람 칸에는 실제 주소를 적지 않는다(이름표 + 보내는 주소) — 전달·다시보내기로 서로의 주소가 새지 않게. 받는 곳 전체는 숨은참조
     ⑥ 대표 사본에는 열람·클릭 «추적이 꺼져 있다» — 대표님이 보낸함에서 열어 볼 때 첫 번째 받는 곳이 «열었다»로 찍히면 안 된다
     ⑦ 사본 규칙은 «대기열 줄 바깥»에서만 온다 — 화면이 보내는 body 로 사본 규칙을 바꿀 수 없다
     ⑧ 사본이 어떻게 되든 «배달 결과는 안 바뀐다» — 던지지 않고 값으로 알린다
     ⑨ 지난 안내문 대장이 이름표(「N곳에 한 곳씩 발송」)를 읽어 앱에서 보낸 안내문도 계속 잡는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const OC = require(path.join(R, 'functions', 'mail-one-copy.js'));
const MB = require(path.join(R, 'functions', 'mail-bulk.js'));
const MA = require(path.join(R, 'functions', 'mail-archive.js'));
const MD = require(path.join(R, 'functions', 'mail-deliver.js'));
const NL = require(path.join(R, 'functions', 'news-notice-log.js'));
const { 만들기: 가짜DB } = require('./helpers/fake-rtdb.js');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 서버 = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');
const 주소 = (n) => 'u' + n + '@fake-corp.test';
const 주소들 = (수) => Array.from({ length: 수 }, (_, i) => 주소(i + 1));

/* ══════════════════ 이름표 ══════════════════ */

test('이름표는 만들고 읽으면 제자리다 — 만드는 쪽과 읽는 쪽(지난 안내문 대장)이 한 벌', () => {
  [1, 5, 8, 177, 400].forEach((n) => assert.equal(OC.라벨읽기(OC.라벨(n)), n));
  assert.match(OC.라벨(177), /177곳/, '대표님 눈에 «몇 곳»이 바로 보여야 한다');
});

test('이름표가 아닌 것은 0 — 사람 이름·회사 이름·빈 값에 반응하지 않는다', () => {
  ['', '홍길동', '푸른노무법인', '5곳', '상사 5곳에 한 곳씩 발송'].forEach((s) => assert.equal(OC.라벨읽기(s), 0, s));
  assert.equal(OC.라벨읽기(undefined), 0);
  assert.equal(OC.라벨읽기(null), 0);
});

/* ══════════════════ 줄 규칙 (대기열에 다는 것) ══════════════════ */

const 한통 = (수, 묶음 = 'b1abc') => ({ 방식: 'one', 묶음, 주소들: 주소들(수) });

test('★ 방식을 안 주면 규칙이 없다 — 기업정보함 묶음 편지는 곳별 사본 그대로', () => {
  assert.equal(OC.줄규칙(0, null), null);
  assert.equal(OC.줄규칙(0, { 묶음: 'b1', 주소들: 주소들(5) }), null);
  assert.equal(OC.줄규칙(0, { 방식: 'each', 묶음: 'b1', 주소들: 주소들(5) }), null);
});

test('★★ 앞쪽 «두 줄 이상»이 대표 사본 후보다 — 첫 줄이 못 나가도 이어받을 줄이 있다', () => {
  assert.ok(OC.후보줄수 >= 2, '후보가 한 줄뿐이면 그 줄의 주소가 죽은 날 사본이 통째로 없다');
  const 규칙들 = Array.from({ length: 10 }, (_, i) => OC.줄규칙(i, 한통(10)));
  const 후보 = 규칙들.filter((r) => r.mode === 'one');
  const 건너뜀 = 규칙들.filter((r) => r.mode === 'skip');
  assert.equal(후보.length, OC.후보줄수);
  assert.equal(후보.length + 건너뜀.length, 10, '모든 줄이 둘 중 하나여야 한다 — 규칙 없는 줄이 끼면 그 곳은 곳별 사본이 쌓인다');
  assert.deepEqual(규칙들.slice(0, OC.후보줄수).map((r) => r.mode), Array(OC.후보줄수).fill('one'), '후보는 «앞쪽»이다');
});

test('후보 줄은 받는 곳 «전체»와 수를 들고 있다 — 그 줄이 사라져도 다른 후보가 같은 것을 안다', () => {
  const 목록 = 주소들(7);
  const a = OC.줄규칙(0, { 방식: 'one', 묶음: 'b7', 주소들: 목록 });
  const b = OC.줄규칙(1, { 방식: 'one', 묶음: 'b7', 주소들: 목록 });
  assert.deepEqual(a, b);
  assert.equal(a.n, 7);
  assert.deepEqual(a.to, 목록, '첫 줄의 주소도 목록에 있어야 한다 — 받는 곳 «전체»다');
  assert.equal(a.batch, 'b7');
});

test('묶음 이름이 이상하거나 주소가 없으면 규칙을 안 만든다 — 예전 그대로 곳별 사본이 낫다', () => {
  ['', 'a/b', 'a b', 'a.b', 'a#b', '한글', 'x'.repeat(121)].forEach((b) =>
    assert.equal(OC.줄규칙(0, { 방식: 'one', 묶음: b, 주소들: 주소들(3) }), null, '묶음 «' + b + '» 는 맡기기 표의 자리 이름이 된다'));
  assert.equal(OC.줄규칙(0, { 방식: 'one', 묶음: 'b1', 주소들: [] }), null);
});

/* ══════════════════ 규칙 거르기 (대기열에서 읽은 것을 믿을 수 있는 꼴로) ══════════════════ */

test('규칙이 없거나 알 수 없는 값은 «예전 그대로»(each)다', () => {
  [undefined, null, '', 'one', 7, [], {}, { mode: 'xyz' }, { mode: 'each' }].forEach((c) => assert.equal(OC.규칙(c).mode, 'each', JSON.stringify(c)));
});

test('skip 은 그대로 읽는다', () => {
  assert.deepEqual(OC.규칙({ mode: 'skip' }), { mode: 'skip' });
});

test('one 은 «쓸 수 있는 주소만» 걸러 읽고, 수는 목록에서 센다(적힌 n 을 믿지 않는다)', () => {
  const r = OC.규칙({ mode: 'one', batch: 'b1', n: 9999, to: ['a@x.kr', '  b@x.kr ', '', 'no-at', null, 7, 'c@x.kr'] });
  assert.equal(r.mode, 'one');
  assert.deepEqual(r.to, ['a@x.kr', 'b@x.kr', 'c@x.kr']);
  assert.equal(r.n, 3, '이름표의 곳 수가 실제 목록과 다르면 대표님이 거짓 숫자를 본다');
});

test('one 인데 묶음 이름이 틀렸거나 쓸 주소가 하나도 없으면 each', () => {
  assert.equal(OC.규칙({ mode: 'one', batch: 'a/b', to: ['a@x.kr'] }).mode, 'each');
  assert.equal(OC.규칙({ mode: 'one', batch: 'b1', to: [] }).mode, 'each');
  assert.equal(OC.규칙({ mode: 'one', batch: 'b1', to: ['no-at'] }).mode, 'each');
  assert.equal(OC.규칙({ mode: 'one', to: ['a@x.kr'] }).mode, 'each');
});

test('한 번에 걸 수 있는 곳 수의 상한(MAX_BULK)을 넘는 목록은 잘라 읽는다', () => {
  const r = OC.규칙({ mode: 'one', batch: 'b1', to: Array.from({ length: MB.MAX_BULK + 50 }, (_, i) => 'a' + i + '@x.kr') });
  assert.equal(r.to.length, MB.MAX_BULK);
  assert.ok(OC.줄수한도 >= MB.MAX_BULK, '한도가 대량 발송 상한보다 작으면 정상 발송 목록이 잘린다');
});

/* ══════════════════ 대기열 짓기에 어떻게 붙나 ══════════════════ */

function 짓기(수, 옵션) {
  const v = MB.validateBulk({
    to: 주소들(수).map((e, i) => ({ email: e, name: '이름' + i, company: '회사' + i, track: 't' + i })),
    subject: '푸른노무법인 주간뉴스레터 입니다.', body: '본문', html: '<p>서식</p>',
  });
  assert.equal(v.ok, true);
  return MB.buildQueue(v, 1000, 'me', 'bq1', 옵션);
}

test('★ 옵션을 안 주면 줄에 사본 칸이 «아예 없다» — 기업정보함 묶음 편지는 한 글자도 안 바뀐다', () => {
  짓기(8).forEach((줄) => assert.equal('copy' in 줄, false));
});

test('★ 한 통 옵션을 주면 모든 줄에 규칙이 붙는다 — 앞쪽 후보 · 나머지 skip', () => {
  const 줄들 = 짓기(10, { sentCopy: 'one' });
  assert.equal(줄들.length, 10);
  줄들.forEach((줄, i) => assert.ok(줄.copy && (줄.copy.mode === 'one' || 줄.copy.mode === 'skip'), (i + 1) + '번째 줄에 규칙이 없다'));
  assert.equal(줄들.filter((r) => r.copy.mode === 'one').length, OC.후보줄수);
  assert.equal(줄들[0].copy.mode, 'one');
  assert.equal(줄들[9].copy.mode, 'skip');
});

test('받는 곳 목록은 줄이 대신 «전체»를 들고 있다 — 곳마다 한 번씩, 순서대로', () => {
  const 줄들 = 짓기(6, { sentCopy: 'one' });
  assert.deepEqual(줄들[0].copy.to, 주소들(6));
  assert.equal(줄들[0].copy.n, 6);
  assert.equal(줄들[0].copy.batch, 'bq1');
});

test('★★ 사본 규칙은 payload «바깥»에 둔다 — payload 는 deliver 의 body 가 되어 화면 값이 사본 규칙을 바꿀 길이 된다', () => {
  짓기(5, { sentCopy: 'one' }).forEach((줄) => assert.equal('copy' in 줄.payload, false));
});

test('실시간DB 가 받는 꼴이다 — undefined 가 없고, 글자로 바꿨다 읽어도 같다', () => {
  const 줄들 = 짓기(6, { sentCopy: 'one' });
  assert.deepEqual(JSON.parse(JSON.stringify(줄들)), 줄들);
});

test('한 통 옵션은 곳별 발송 자체를 바꾸지 않는다 — 줄 수·받는 사람·간격·본문이 옵션 없을 때와 같다', () => {
  const 옛 = 짓기(6);
  const 새 = 짓기(6, { sentCopy: 'one' });
  assert.equal(새.length, 옛.length, '배달은 그대로 곳마다 한 통이다');
  새.forEach((줄, i) => {
    const 복사 = Object.assign({}, 줄); delete 복사.copy;
    assert.deepEqual(복사, 옛[i], (i + 1) + '번째 줄의 배달 내용이 달라졌다');
  });
});

/* ══════════════════ 추적 끄기 ══════════════════ */

const 열람 = '<img src="https://asia-northeast3-pureun-erp.cloudfunctions.net/newsOpen?i=2026-10-w2&amp;e=Abc123xyz" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">';
const 메일열람 = '<img src="https://asia-northeast3-pureun-erp.cloudfunctions.net/mailOpenPixel?t=deadbeef" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block">';
const 클릭 = '<a href="https://asia-northeast3-pureun-erp.cloudfunctions.net/newsClick?i=2026-10-w2&amp;e=Abc123xyz&amp;n=3" target="_blank">기사</a>';

test('★★ 추적 그림(뉴스레터·열람 확인)은 대표 사본에서 «빠진다»', () => {
  const 후 = OC.추적끄기('<p>글</p>' + 열람 + 메일열람);
  assert.doesNotMatch(후, /newsOpen/);
  assert.doesNotMatch(후, /mailOpenPixel/);
  assert.match(후, /<p>글<\/p>/, '본문은 그대로');
});

test('추적과 상관없는 그림(로고·기사 사진)은 남긴다', () => {
  const 그림 = '<img src="https://example.com/logo.png" width="120" alt="로고"><img src=\'https://example.com/a/newsOpen-guide.png\' alt="">';
  assert.equal(OC.추적끄기(그림), 그림);
});

test('★★ 추적 링크는 «가는 곳(i·n)은 그대로, 열쇠만 아무도 아닌 값»으로 바뀐다', () => {
  const 후 = OC.추적끄기(클릭);
  assert.doesNotMatch(후, /Abc123xyz/, '받는 곳의 열쇠가 남으면 대표님이 눌러 볼 때 그 곳이 «눌렀다»로 찍힌다');
  assert.match(후, /newsClick\?i=2026-10-w2&amp;e=sentcopy&amp;n=3/, '회차와 링크 번호는 그대로여야 링크가 제대로 간다');
  assert.equal(OC.추적끄기(클릭.replace(/&amp;/g, '&')).includes('e=sentcopy&n=3'), true, '&amp; 가 아닌 & 꼴도 읽는다');
});

test('남의 주소에 우연히 e= 가 있어도 건드리지 않는다', () => {
  const 남 = '<a href="https://example.com/search?q=1&amp;e=keepme">링크</a>';
  assert.equal(OC.추적끄기(남), 남);
});

test('추적끄기는 두 번 해도 같다 · 빈 값은 그대로', () => {
  const 한번 = OC.추적끄기(열람 + 클릭 + 메일열람);
  assert.equal(OC.추적끄기(한번), 한번);
  assert.equal(OC.추적끄기(''), '');
  assert.equal(OC.추적끄기(undefined), undefined);
});

/* ══════════════════ 대표 사본 편지 ══════════════════ */

function 원본편지() {
  return {
    from: '푸른노무법인 <370-6@hanmail.net>', replyTo: 'staff@pureun.kr', to: 'u1@fake-corp.test',
    subject: '푸른노무법인 2026년 10월 2주차 주간뉴스레터 입니다.',
    html: '<p>안녕하세요, 1번 회사 대표님</p>' + 클릭 + 열람 + 메일열람, text: '평문',
    attachments: [{ filename: '공문.pdf', content: 'AAAA', encoding: 'base64' }],
  };
}
const 규칙값 = (수 = 5) => OC.규칙({ mode: 'one', batch: 'bq1', to: 주소들(수) });

test('★ 대표 사본: 받는사람은 이름표+보내는 주소, 숨은참조는 받는 곳 «전체»', () => {
  const 편지 = OC.대표사본편지(원본편지(), 규칙값(5), '370-6@hanmail.net');
  assert.equal(편지.to.address, '370-6@hanmail.net');
  assert.equal(OC.라벨읽기(편지.to.name), 5, '받는사람 이름표에 «5곳에 한 곳씩 발송» 이 있어야 목록에서 한눈에 보이고 지난 안내문 대장이 읽는다');
  assert.deepEqual(편지.bcc, 주소들(5));
  assert.equal(편지.cc, undefined);
});

test('★★ 받는사람 칸에는 실제 받는 곳 주소가 «하나도» 없다 — 전달·다시보내기로 서로의 주소가 새지 않는다', () => {
  const 편지 = OC.대표사본편지(원본편지(), 규칙값(5), '370-6@hanmail.net');
  const 받는칸 = JSON.stringify([편지.to, 편지.cc]);
  주소들(5).forEach((a) => assert.equal(받는칸.includes(a), false, a + ' 이(가) 받는사람 칸에 적혔다'));
});

test('대표 사본은 «받은 편지 그대로»다 — 제목·평문·첨부·답장 받을 곳·보낸 사람 유지, 머리글에 묶음 번호', () => {
  const 원 = 원본편지();
  const 편지 = OC.대표사본편지(원, 규칙값(5), '370-6@hanmail.net');
  assert.equal(편지.subject, 원.subject, '제목이 달라지면 지난 안내문 대장이 같은 안내문으로 못 묶는다');
  assert.equal(편지.text, 원.text);
  assert.deepEqual(편지.attachments, 원.attachments);
  assert.equal(편지.from, 원.from);
  assert.equal(편지.replyTo, 원.replyTo);
  assert.equal(편지.headers['X-Pureun-Batch'], 'bq1');
  assert.equal(편지.headers['X-Pureun-Bulk'], '5');
});

test('참조(cc)가 있던 편지라도 대표 사본에는 참조를 안 남긴다 — 받는사람 칸처럼 읽히면 안 된다', () => {
  const 편지 = OC.대표사본편지(Object.assign(원본편지(), { cc: 'cc@fake-corp.test' }), 규칙값(5), '370-6@hanmail.net');
  assert.equal(편지.cc, undefined);
});

test('★★ 대표 사본에는 추적이 꺼져 있다 · 원본 편지 객체는 건드리지 않는다', () => {
  const 원 = 원본편지();
  const 사본 = JSON.stringify(원);
  const 편지 = OC.대표사본편지(원, 규칙값(5), '370-6@hanmail.net');
  assert.doesNotMatch(편지.html, /newsOpen|mailOpenPixel|Abc123xyz/);
  assert.equal(JSON.stringify(원), 사본, '원본을 고치면 «진짜 받는 곳 편지»에서 추적이 빠진다');
});

test('숨은참조 목록은 규칙의 배열을 «복사»해서 쓴다 — 나중에 편지를 고쳐도 규칙이 안 바뀐다', () => {
  const r = 규칙값(3);
  const 편지 = OC.대표사본편지(원본편지(), r, '370-6@hanmail.net');
  편지.bcc.push('x@y.kr');
  assert.equal(r.to.length, 3);
});

/* nodemailer 가 있는 PC 에서만 — CI 에는 없다. 진짜로 구워 봐야 «숨은참조가 실제 머리글로 나오는가»가 드러난다. */
test('진짜로 구우면: 숨은참조 머리글이 나오고, 기본(곳별 사본)은 여전히 숨은참조를 «뺀다»', async (t) => {
  try { require(path.join(R, 'functions', 'node_modules', 'nodemailer', 'lib', 'mail-composer')); }
  catch (e) { t.skip('nodemailer 가 없는 기기'); return; }
  const 편지 = OC.대표사본편지(원본편지(), 규칙값(5), '370-6@hanmail.net');
  const 구움 = (await MA.buildRaw(편지, { keepBcc: true })).toString('utf8');
  assert.match(구움, /^Bcc: /mi, '대표 사본에는 받는 곳 전체가 숨은참조로 남아야 한다');
  주소들(5).forEach((a) => assert.ok(구움.includes(a), a + ' 이 숨은참조에 없다'));
  assert.match(구움, /^X-Pureun-Batch: bq1/mi);
  assert.doesNotMatch(구움, /newsOpen|mailOpenPixel/);
  const 기본 = (await MA.buildRaw(Object.assign(원본편지(), { bcc: 'hidden@x.kr' }))).toString('utf8');
  assert.doesNotMatch(기본, /^Bcc:/mi, '기본 길은 숨은참조를 «뺀다» — 켜는 것은 대표 사본뿐이다');
});

/* ══════════════════ 맡기기 표 ══════════════════ */

test('★ 맡기기: 처음 온 줄만 맡고, 마친 뒤에는 아무도 못 맡는다', async () => {
  const db = 가짜DB();
  assert.equal(await OC.맡기(db, 'b1', 1000), true);
  assert.equal(await OC.맡기(db, 'b1', 1001), false, '넣는 중에 또 맡으면 사본이 두 통 쌓인다');
  await OC.마침(db, 'b1', 1002);
  assert.equal(await OC.맡기(db, 'b1', 1003 + OC.맡김유효ms * 10), false, '마친 표는 시간이 지나도 «마침»이다');
});

test('놓으면 다음 줄이 이어받는다 · 묶음이 다르면 서로 상관없다', async () => {
  const db = 가짜DB();
  assert.equal(await OC.맡기(db, 'b1', 1000), true);
  await OC.놓기(db, 'b1');
  assert.equal(await OC.맡기(db, 'b1', 1001), true);
  assert.equal(await OC.맡기(db, 'b2', 1001), true);
});

test('넣는 중으로 굳어 버린 표(함수가 죽은 경우)는 일정 시간 뒤 다시 맡을 수 있다', async () => {
  const db = 가짜DB();
  assert.equal(await OC.맡기(db, 'b1', 1000), true);
  assert.equal(await OC.맡기(db, 'b1', 1000 + OC.맡김유효ms - 1), false, '아직 넣는 중일 수 있다');
  assert.equal(await OC.맡기(db, 'b1', 1000 + OC.맡김유효ms + 1), true, '영영 못 넣는 일이 없어야 한다');
  assert.ok(OC.맡김유효ms >= 60 * 1000, '너무 짧으면 느린 접속 중에 두 번째 줄이 또 넣는다');
});

test('표에는 주소 같은 개인 정보가 없다 — 상태와 시각뿐', async () => {
  const db = 가짜DB();
  await OC.맡기(db, 'b1', 1000);
  await OC.마침(db, 'b1', 1001);
  const 표 = (await db.ref(OC.표자리 + '/b1').once('value')).val();
  assert.deepEqual(Object.keys(표).sort(), ['at', 'state']);
});

/* ══════════════════ 대표 사본 넣기 ══════════════════ */

function 가짜MA(덧) {
  const 기록 = { 구움: [], 넣음: [] };
  const MAfake = Object.assign({
    ARCHIVE_MAX_BYTES: MA.ARCHIVE_MAX_BYTES,
    buildRaw: async (m, o) => { 기록.구움.push({ 편지: m, 옵션: o }); return Buffer.from('RAW'); },
    archiveSent: async (o) => { 기록.넣음.push(o); return { ok: true, put: o.raws.length, dropped: 0, box: '보낸메일함', why: '' }; },
  }, 덧 || {});
  return { MA: MAfake, 기록 };
}
const 넣기재료 = (db, MAfake, 덧) => Object.assign({
  db, MA: MAfake, 편지: 원본편지(), 규칙: 규칙값(5), 보낸주소: '370-6@hanmail.net',
  이름들: ['370-6'], 아이디: '370-6', 열쇠: 'pw', 바이트: 1024, 지금: 5000,
}, 덧 || {});

test('★ 대표 사본 넣기: 한 통만 구워 넣고, 숨은참조를 «켜서» 굽는다', async () => {
  const db = 가짜DB(); const { MA: m, 기록 } = 가짜MA();
  const r = await OC.대표사본넣기(넣기재료(db, m));
  assert.equal(r.did, 'put');
  assert.equal(기록.구움.length, 1);
  assert.equal(기록.구움[0].옵션.keepBcc, true, '숨은참조를 안 켜면 대표 사본에 받는 곳이 하나도 안 남는다');
  assert.equal(기록.넣음.length, 1);
  assert.equal(기록.넣음[0].raws.length, 1, '한 번에 한 통 — 두 통 넣으면 목적이 사라진다');
  assert.equal(기록.넣음[0].pass, 'pw');
  assert.equal(기록.구움[0].편지.bcc.length, 5);
  const 표 = (await db.ref(OC.표자리 + '/bq1').once('value')).val();
  assert.equal(표.state, 'done');
});

test('★★ 이미 다른 줄이 맡았으면 건너뛴다 — 구워 보지도, 접속해 보지도 않는다', async () => {
  const db = 가짜DB(); const { MA: m, 기록 } = 가짜MA();
  await OC.대표사본넣기(넣기재료(db, m));
  const 두번째 = await OC.대표사본넣기(넣기재료(db, m, { 편지: Object.assign(원본편지(), { to: 'u2@fake-corp.test' }) }));
  assert.equal(두번째.did, 'taken');
  assert.equal(기록.구움.length, 1);
  assert.equal(기록.넣음.length, 1, '같은 묶음의 대표 사본이 두 통이 되면 안 된다');
});

test('★★ 넣기가 실패하면 표를 «놓는다» — 다음 후보 줄이 이어받아 사본이 통째로 없어지지 않는다', async () => {
  const db = 가짜DB();
  const 실패 = 가짜MA({ archiveSent: async () => ({ ok: false, put: 0, dropped: 0, box: '', why: '접속이 끊겼습니다' }) });
  const r1 = await OC.대표사본넣기(넣기재료(db, 실패.MA));
  assert.equal(r1.did, 'fail');
  assert.match(r1.why, /접속/);
  const 표 = (await db.ref(OC.표자리 + '/bq1').once('value')).val();
  assert.equal(표, null, '실패한 줄이 표를 쥐고 있으면 다음 줄이 영영 못 한다');
  const 성공 = 가짜MA();
  const r2 = await OC.대표사본넣기(넣기재료(db, 성공.MA));
  assert.equal(r2.did, 'put', '다음 후보가 이어받아야 한다');
});

test('굽다가 터져도 던지지 않고 «실패»로 알리며 표를 놓는다', async () => {
  const db = 가짜DB();
  const 터짐 = 가짜MA({ buildRaw: async () => { throw new Error('mail-composer 없음'); } });
  const r = await OC.대표사본넣기(넣기재료(db, 터짐.MA));
  assert.equal(r.did, 'fail');
  assert.equal((await db.ref(OC.표자리 + '/bq1').once('value')).val(), null);
});

test('표를 못 읽어도(DB 가 터져도) 던지지 않는다 — 배달은 이미 끝난 뒤다', async () => {
  const 고장 = { ref: () => ({ transaction: async () => { throw new Error('DB 끊김'); }, set: async () => { throw new Error('DB 끊김'); } }) };
  const { MA: m, 기록 } = 가짜MA();
  const r = await OC.대표사본넣기(넣기재료(고장, m));
  assert.equal(r.did, 'fail');
  assert.equal(기록.넣음.length, 0);
});

test('스위치가 꺼져 있어 안 넣은 것은 «다시 해 볼 일»이 아니다 — 표는 마침으로 두어 다른 줄이 되풀이하지 않는다', async () => {
  const db = 가짜DB();
  const 꺼짐 = 가짜MA({ archiveSent: async () => ({ ok: true, put: 0, dropped: 0, box: '', why: '스위치가 꺼져 있습니다' }) });
  const r = await OC.대표사본넣기(넣기재료(db, 꺼짐.MA));
  assert.equal(r.did, 'off');
  assert.equal((await db.ref(OC.표자리 + '/bq1').once('value')).val().state, 'done');
});

test('첨부가 너무 커서 사본을 못 넣는 것도 «다음 후보가 해도 같다» — 접속하지 않고 마침으로 둔다', async () => {
  const db = 가짜DB(); const { MA: m, 기록 } = 가짜MA();
  const r = await OC.대표사본넣기(넣기재료(db, m, { 바이트: m.ARCHIVE_MAX_BYTES + 1 }));
  assert.equal(r.did, 'size');
  assert.equal(기록.구움.length, 0);
  assert.equal(기록.넣음.length, 0);
  const 다음 = await OC.대표사본넣기(넣기재료(db, m, { 바이트: m.ARCHIVE_MAX_BYTES + 1 }));
  assert.ok(['size', 'taken'].includes(다음.did));
  assert.equal(기록.구움.length, 0, '다음 후보 줄들이 큰 첨부를 또 구우면 메모리만 쓴다');
  assert.equal(기록.넣음.length, 0);
  assert.equal((await db.ref(OC.표자리 + '/bq1').once('value')).val().state, 'done');
});

/* ══════════════════ deliver 에 어떻게 붙었나 — 가짜 발송기·가짜 사본층으로 «실제로 돌린다» ══════════════════ */

function 발송기() {
  const 나감 = [];
  return { 나감, nodemailer: { createTransport: () => ({ sendMail: async (m) => { 나감.push(m.to); } }) } };
}
async function 보내기(옵션, 몸) {
  const 원 = { buildRaw: MA.buildRaw, archiveSent: MA.archiveSent };
  const 기록 = { 구움: [], 넣음: [] };
  MA.buildRaw = async (m, o) => { 기록.구움.push({ 편지: m, 옵션: o }); return Buffer.from('RAW'); };
  MA.archiveSent = async (o) => { 기록.넣음.push(o); return { ok: true, put: o.raws.length, dropped: 0, box: '보낸메일함', why: '' }; };
  const 발 = 발송기();
  const db = 옵션.db || 가짜DB();
  try {
    const r = await MD.deliver(Object.assign({
      db, nodemailer: 발.nodemailer, from: '370-6@hanmail.net', pass: 'pw',
      body: Object.assign({ to: 'u1@fake-corp.test', subject: '푸른노무법인 주간뉴스레터', body: '본문', html: '<p>서식</p>' }, 몸 || {}),
    }, 옵션));
    return { r, 기록, 발, db };
  } finally { MA.buildRaw = 원.buildRaw; MA.archiveSent = 원.archiveSent; }
}

test('★ 규칙을 안 주면 «예전 그대로» — 한 통 보내면 사본 한 통(곳별)', async () => {
  const { r, 기록, 발 } = await 보내기({});
  assert.equal(r.ok, true);
  assert.equal(발.나감.length, 1);
  assert.equal(기록.넣음.length, 1);
  assert.equal(기록.넣음[0].raws.length, 1);
  assert.equal(기록.구움[0].옵션, undefined, '곳별 사본은 숨은참조를 켜지 않는다');
});

test('★★ skip 줄: 배달은 나가고, 사본은 «하나도» 안 넣고, 맡기기 표도 안 건드린다', async () => {
  const db = 가짜DB();
  const { r, 기록, 발 } = await 보내기({ db, copy: { mode: 'skip' } });
  assert.equal(r.ok, true);
  assert.equal(발.나감.length, 1, '사본을 안 넣는다고 배달까지 막히면 안 된다');
  assert.equal(기록.넣음.length, 0);
  assert.equal(기록.구움.length, 0);
  assert.equal((await db.ref(OC.표자리).once('value')).val(), null, 'skip 줄 177개가 DB 를 두드리면 비용만 든다');
});

test('★★ one 줄(후보): 대표 사본 «한 통»만 넣는다 — 받는사람 이름표·숨은참조 전체·추적 꺼짐', async () => {
  const 규칙 = { mode: 'one', batch: 'bq9', n: 5, to: 주소들(5) };
  const { r, 기록, 발 } = await 보내기({ copy: 규칙 });
  assert.equal(r.ok, true);
  assert.equal(발.나감.length, 1);
  assert.equal(기록.넣음.length, 1);
  assert.equal(기록.넣음[0].raws.length, 1);
  const 편지 = 기록.구움[0].편지;
  assert.equal(OC.라벨읽기(편지.to.name), 5);
  assert.deepEqual(편지.bcc, 주소들(5));
  assert.equal(기록.구움[0].옵션.keepBcc, true);
  assert.equal(편지.headers['X-Pureun-Batch'], 'bq9');
});

test('★ 같은 묶음의 두 번째 후보 줄은 사본을 안 넣는다 — 대표 사본은 한 묶음에 한 통', async () => {
  const db = 가짜DB();
  const 규칙 = { mode: 'one', batch: 'bq9', n: 5, to: 주소들(5) };
  const 첫 = await 보내기({ db, copy: 규칙 });
  const 둘 = await 보내기({ db, copy: 규칙 }, { to: 'u2@fake-corp.test' });
  assert.equal(첫.기록.넣음.length, 1);
  assert.equal(둘.r.ok, true, '사본을 안 넣어도 배달은 나간다');
  assert.equal(둘.발.나감.length, 1);
  assert.equal(둘.기록.넣음.length, 0);
});

test('★ 사본 층이 터져도 배달 결과는 «성공» 그대로다 (one 길)', async () => {
  const 원 = { buildRaw: MA.buildRaw, archiveSent: MA.archiveSent };
  MA.buildRaw = async () => { throw new Error('굽다 터짐'); };
  const 발 = 발송기();
  const w = console.warn; console.warn = () => {};
  try {
    const r = await MD.deliver({
      db: 가짜DB(), nodemailer: 발.nodemailer, from: '370-6@hanmail.net', pass: 'pw',
      copy: { mode: 'one', batch: 'bq9', n: 3, to: 주소들(3) },
      body: { to: 'u1@fake-corp.test', subject: '제목', body: '본문', html: '<p>서식</p>' },
    });
    assert.equal(r.ok, true, '사본 실패가 「안 나갔다」로 보이면 대표가 두 번 보낸다');
    assert.equal(발.나감.length, 1);
  } finally { console.warn = w; MA.buildRaw = 원.buildRaw; MA.archiveSent = 원.archiveSent; }
});

test('★★ 사본 규칙은 body(화면이 보낸 값)에서 읽지 않는다 — 오직 deliver 옵션으로만', async () => {
  const { 기록 } = await 보내기({}, { copy: { mode: 'skip' } });
  assert.equal(기록.넣음.length, 1, '화면 값으로 사본을 끌 수 있으면 아무나 사본 기록을 지울 수 있다');
});

test('알 수 없는 규칙 값은 곳별 사본(예전 그대로)으로 돌아간다', async () => {
  for (const 값 of [{ mode: 'zzz' }, { mode: 'one' }, { mode: 'one', batch: '!!', to: ['a@x.kr'] }, 'skip', 7]) {
    const { 기록 } = await 보내기({ copy: 값 });
    assert.equal(기록.넣음.length, 1, JSON.stringify(값) + ' 인데 사본이 안 남았다');
    /* 「한 통이 넣어졌다」만으로는 대표 사본 길로 잘못 들어간 것과 구분이 안 된다 — 길을 본다 */
    assert.equal(기록.구움[0].옵션, undefined, JSON.stringify(값) + ' 이 대표 사본 길(숨은참조)로 들어갔다');
    assert.equal(typeof 기록.구움[0].편지.to, 'string', JSON.stringify(값) + ' 인데 받는사람이 이름표로 바뀌었다 — 곳별 사본이어야 한다');
  }
});

/* ══════════════════ 부르는 쪽(index.js)이 실제로 쓰는가 — 주석을 걷고 본다 ══════════════════ */

function 몸(이름, 다음) {
  const i = 서버.indexOf(이름);
  assert.ok(i >= 0, 이름 + ' 을 못 찾았다');
  const j = 서버.indexOf(다음, i + 이름.length);
  return 주석걷기(서버.slice(i, j > i ? j : i + 20000));
}

test('★ 예약 발송기는 줄의 사본 규칙을 deliver 에 «실어 준다»', () => {
  const 발송 = 몸('exports.sendScheduledMail', '\nexports.');
  assert.match(발송, /MD\.deliver\(\{[\s\S]*?\bcopy\s*:\s*row\.copy\b/, 'row.copy 를 안 넘기면 줄에 규칙을 달아도 곳별 사본이 그대로 쌓인다');
});

test('★★ 손으로 거는 대량 발송: 뉴스레터·안내문만 «한 통», 기업정보함 묶음 편지는 규칙 없음', () => {
  const 걸기 = 몸('exports.sendBulkMail', 'exports.sendScheduledMail');
  const 호출 = 걸기.match(/MB\.buildQueue\(([\s\S]*?)\);/);
  assert.ok(호출, 'buildQueue 호출을 못 찾았다');
  assert.match(호출[1], /sentCopy\s*:\s*["']one["']/);
  assert.match(호출[1], /newsletterSend/, '뉴스레터는 한 통');
  assert.match(호출[1], /noticeSend/, '안내문은 한 통');
  assert.match(호출[1], /\?[\s\S]*:\s*undefined/, '둘 다 아닌 묶음 편지는 옵션이 «없어야» 한다(곳별 사본)');
});

test('★ 자동 발송(금요일 준비 → 월요일)도 같은 규칙이다', () => {
  const 자동 = 몸('exports.weeklyNewsletterSend', '\nexports.');
  const 호출 = 자동.match(/MB\.buildQueue\(([\s\S]*?)\);/);
  assert.ok(호출, 'buildQueue 호출을 못 찾았다');
  assert.match(호출[1], /sentCopy\s*:\s*["']one["']/, '손으로 건 것과 자동으로 나간 것의 사본이 다르면 보낸함이 또 묻힌다');
});

test('새 모듈은 무거운 짐(파이어베이스·메일 서버·nodemailer)을 맨 위에서 부르지 않는다', () => {
  const 원 = fs.readFileSync(path.join(R, 'functions', 'mail-one-copy.js'), 'utf8');
  const 코드 = 주석걷기(원);
  assert.doesNotMatch(코드, /require\(['"](firebase-admin|firebase-functions|imapflow|nodemailer)/, '검사 기기에는 그 짐이 없을 수 있다');
  assert.doesNotMatch(코드, /require\(['"]\.\/(index|mail-archive|mail-deliver)/, '순환으로 물리면 안 된다');
});

/* ══════════════════ 지난 안내문 대장 — 이름표를 읽는다 ══════════════════ */

const 날 = (y, m, d) => Date.UTC(y, m - 1, d, 0);
const 대표줄 = (제목, 곳수, 덧) => Object.assign({
  u: 1, f: '푸른노무법인', e: '370-6@hanmail.net', t: '370-6@hanmail.net', tn: OC.라벨(곳수),
  s: 제목, d: 날(2026, 10, 19), r: 1, a: 1, an: ['(공문) 안내.pdf'], z: 1000, p: '안녕하세요. 푸른노무법인입니다.',
}, 덧 || {});
const 칸 = (줄들, 종류 = 'sent') => ({ slug: 'Sent', 이름: '보낸메일함', 종류, 줄들 });
const 짓는다 = (칸들, 업체들) => NL.짓기({ 칸들, 업체들: 업체들 || {}, 명함들: {} });

test('★ 앱이 보낸 안내문(대표 사본 한 통)도 지난 안내문 대장에 잡힌다 — 받은 곳 수는 이름표에서', () => {
  const 대장 = 짓는다([칸({ 1: 대표줄('[푸른노무법인] 공휴일 안내 공문', 177) })]).안내문들;
  const 항목 = Object.values(대장);
  assert.equal(항목.length, 1, '한 통만 남겼다고 안내문이 대장에서 사라지면 «언제 무엇을 보냈나»를 못 본다');
  assert.equal(항목[0].받는주소수, 177);
  assert.equal(항목[0].한통최대, 1, '«한 통에 8명까지만 기록» 한계 안내가 이 안내문에 붙으면 거짓이다');
  assert.equal(항목[0].업체미확인, 0, '보내는 우리 주소를 «모르는 받는 곳»으로 세면 안 된다');
});

test('이름표 수가 5 미만이면(몇 곳에만 보낸 것) 일괄 안내문이 아니다 — 옛 문턱 그대로', () => {
  const 대장 = 짓는다([칸({ 1: 대표줄('[푸른노무법인] 공휴일 안내 공문', 3) })]).안내문들;
  assert.equal(Object.keys(대장).length, 0);
});

test('뉴스레터 대표 사본은 안내문이 아니다 — 대장에 안 들어간다', () => {
  const 대장 = 짓는다([칸({ 1: 대표줄('푸른노무법인 2026년 10월 3주차 주간뉴스레터 입니다.', 177) })]).안내문들;
  assert.equal(Object.keys(대장).length, 0);
});

test('옛 꼴(곳마다 한 통)과 대표 사본이 섞여도 «가장 큰 수»를 쓴다 — 다시 보낸 곳은 앞 묶음에 이미 들어 있다', () => {
  const 제목 = '[푸른노무법인] 공휴일 안내 공문';
  const 줄들 = { 1: 대표줄(제목, 170) };
  for (let i = 0; i < 6; i++) 줄들[10 + i] = { u: 10 + i, f: '푸른노무법인', e: '370-6@hanmail.net', t: 주소(i + 1), tn: '', s: 제목, d: 날(2026, 10, 19) + 1000 * i, r: 1, a: 0, z: 1, p: '' };
  const 항목 = Object.values(짓는다([칸(줄들)]).안내문들);
  assert.equal(항목.length, 1);
  assert.equal(항목[0].받는주소수, 170, '합(176)으로 세면 다시 보낸 곳을 두 번 센다');
});

test('★ 같은 안내문의 대표 사본이 둘(처음 묶음 + 실패한 곳만 다시 보낸 묶음)이어도 «합»이 아니라 가장 큰 수', () => {
  const 제목 = '[푸른노무법인] 공휴일 안내 공문';
  const 줄들 = { 1: 대표줄(제목, 170), 2: 대표줄(제목, 3, { u: 2, d: 날(2026, 10, 19) + 3600e3 }) };
  const 항목 = Object.values(짓는다([칸(줄들)]).안내문들);
  assert.equal(항목.length, 1, '같은 제목·가까운 날짜는 한 안내문이다');
  assert.equal(항목[0].받는주소수, 170, '다시 보낸 3곳은 앞 묶음 170곳 안에 이미 있다 — 합(173)으로 세면 거짓이다');
});

test('이름표가 없는 보통 줄의 셈은 그대로다 — 3통 × 8명 = 24명', () => {
  const 제목 = '[푸른노무법인] 공휴일 안내 공문';
  const 줄들 = {};
  [0, 8, 16].forEach((시작, k) => {
    줄들[k + 1] = { u: k + 1, f: '푸른노무법인', e: '370-6@daum.net', tn: '홍길동', s: 제목, d: 날(2026, 10, 2) + 1000 * k, r: 1, a: 0, z: 1, p: '',
      t: Array.from({ length: 8 }, (_, i) => 주소(시작 + i + 1)).join(',') };
  });
  const 항목 = Object.values(짓는다([칸(줄들)]).안내문들);
  assert.equal(항목[0].받는주소수, 24);
  assert.equal(항목[0].한통최대, 8);
});
