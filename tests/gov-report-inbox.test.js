'use strict';
/* 컨설팅보고서 앱 — 받은 서류함 순수 함수 (2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md)
 * ★ 지키는 것: 주소로만 업체 귀속(먼저 적힌 업체가 임자 · 우리 주소 뺌) · 첨부 있는 메일·기간 안·날짜 내림차순·50건 ·
 *   개인 자료 딱지(PRIV_RE 그대로) · 연결 열쇠 만들기/풀기(80자) · 첨부는 이름으로 집고 20MB 넘으면 받지 않는다
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/pu-gov-report-inbox.js');
const B = require('../js/pu-gov-report-build.js');
const Tr = require('../js/pu-gov-report-track.js');
const F = require('./helpers/gov-report-fixture.js');

const S = F.seed();
const ROWS = I.mailRows(S.mailbox.folders, S.mailbox.msgs);
const DARA = I.addrsFor({ companies: S.data.companies, cons: S.data.consultings.v.k2, name: '다라정밀' });
const WIN = I.windowOf('2026-08-10', '2026-09-14');

test('상수 — 50건 · 열쇠 80자(기록 모듈과 같다) · 20MB · 기간 −30/+90일 · 개인 자료 식은 보고서 모듈 것 그대로 · 문구', () => {
  assert.equal(I.MAX, 50);
  assert.equal(I.KEY_MAX, 80);
  assert.equal(I.KEY_MAX, Tr.LINK_KEY_MAX, '열쇠 한도는 규칙·기록 모듈과 같다');
  assert.equal(I.ATT_MAX, 20 * 1024 * 1024);
  assert.deepEqual([I.BEFORE, I.AFTER, I.SHEET_ROWS], [30, 90, 200]);
  assert.equal(I.PRIV_RE, B.PRIV_RE, 'PRIV_RE 를 복제하지 말고 가져다 쓴다');
  assert.deepEqual(I.BOX_KINDS, ['inbox', 'sent', 'archive', 'custom']);
  assert.equal(I.MSG.NO_ADDR, '메일 주소가 등록돼 있지 않아 후보를 못 찾았습니다 — 업체관리에서 주소를 넣어 주세요');
  assert.equal(I.MSG.LOAD_FAIL, '메일함을 불러오지 못했습니다');
  assert.equal(I.MSG.MORE, '50건만 보입니다');
  assert.equal(I.MSG.PRIV, '개인 자료 · 목록에만');
  assert.equal(I.MSG.TECH, '기술보호 자료');
  assert.equal(I.MSG.CANT, '이 형식은 앱에서 열 수 없습니다 — 메일함에서 받아 주세요');
  assert.equal(I.MSG.NO_REPLY, '메일 서버 응답이 없습니다 — 잠시 뒤 다시');
  assert.equal(I.MSG.LOGIN, '로그인을 확인해 주세요');
  assert.equal(I.MSG.GONE, '메일에서 그 첨부를 찾지 못했습니다(지워졌을 수 있습니다)');
  assert.equal(I.MSG.TOO_BIG, '20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요');
  assert.equal(I.MSG.WAIT_OLD, '불러오는 중… (지난 메일은 1분쯤 걸립니다)');
});

test('windowOf — 첫 회차 30일 전 ~ 마지막 회차 90일 뒤 (보고서 창 grpCollect 와 같다)', () => {
  assert.deepEqual(WIN, { from: '2026-07-11', to: '2026-12-13' });
  assert.deepEqual(I.windowOf('2026-01-15', ''), { from: '2025-12-16', to: '2026-04-15' }, '마지막이 없으면 첫 회차 기준');
  assert.equal(I.windowOf('', ''), null);
  assert.equal(I.windowOf('2026/01/15', '2026-02-01'), null);
});

test('addrsFor — 업체관리 세 칸 + 이알피 계약 연락처 · 먼저 적힌 업체가 임자 · 우리 주소 뺌', () => {
  assert.deepEqual(Object.keys(DARA).sort(), ['dara@example.com'], 'shared@ 는 먼저상사 것 · office@pureun.kr 은 우리 주소');
  const gana = I.addrsFor({ companies: S.data.companies, cons: S.data.consultings.v.k1, name: '가나상사' });
  assert.deepEqual(Object.keys(gana).sort(), ['gana.hong@example.com', 'gana@example.com'], '사업자번호로 업체관리 줄을 찾는다');
  const withErp = I.addrsFor({ companies: S.data.companies, name: '다라정밀',
    cons: { companyName: '다라정밀', contacts: [{ name: '김가나', email: 'dara.kim@example.com' }], company: { email: 'Dara.Office@Example.com' } } });
  assert.deepEqual(Object.keys(withErp).sort(), ['dara.kim@example.com', 'dara.office@example.com', 'dara@example.com']);
  assert.deepEqual(I.addrsFor({ companies: S.data.companies, cons: null, name: '마바산업' }), {}, '주소가 없는 업체');
  assert.deepEqual(Object.keys(I.addrsFor({ companies: null, cons: { contacts: [{ email: 'only@example.com' }] }, name: 'x' })), ['only@example.com'],
    '업체관리를 못 읽어도 계약 연락처로');
  assert.deepEqual(I.addrsFor({ companies: S.data.companies, cons: { contacts: [{ email: 'shared@example.com' }] }, name: '없는업체' }), {},
    '업체관리에서 다른 업체가 먼저 적은 주소는 뺀다');
  assert.deepEqual(I.addrsFor(null), {});
});

test('boxesOf · mailRows — 받은·보낸·보관·손 폴더만(스팸·휴지통 뺌) · 짧은 칸을 풀어 둔다 · 보낸 메일은 받는 주소 전부', () => {
  assert.deepEqual(I.boxesOf(S.mailbox.folders), ['INBOX-0a1b2c3d', 'Sent-1b2c3d4e']);
  assert.equal(ROWS.length, 8);
  const s = ROWS.filter((r) => r.uid === '201')[0];
  assert.deepEqual([s.out, s.from, s.to, s.who, s.day, s.a], [true, 'office@pureun.kr', ['x@example.org', 'dara@example.com'], '외부', '2026-10-01', 2]);
  const r = ROWS.filter((x) => x.uid === '101')[0];
  assert.deepEqual([r.slug, r.out, r.from, r.who, r.s, r.day, r.an],
    ['INBOX-0a1b2c3d', false, 'dara@example.com', '다라정밀 담당', '서명본 보내드립니다', '2026-09-25', ['서명본.hwpx', '확인서.pdf']]);
  assert.deepEqual(I.mailRows(null, null), []);
  assert.deepEqual(I.mailRows(JSON.parse('{"__proto__":{"kind":"inbox"}}'), JSON.parse('{"__proto__":{"1":{"d":1,"a":1}}}')), []);
  assert.deepEqual(I.mailRows({ X: { kind: 'inbox' } }, { X: { abc: { d: 1, a: 1 }, 12: 'x' } }), [], '열쇠가 숫자가 아니거나 줄이 아니면 버린다');
});

test('candidates — 주소 일치 · 첨부 있음 · 기간 안 · 날짜 내림차순 · 개인 자료 딱지 · 기술보호 딱지', () => {
  const r = I.candidates(ROWS, { addrs: DARA, win: WIN });
  assert.deepEqual(r.list.map((m) => m.uid), ['201', '107', '102', '101']);
  assert.deepEqual([r.total, r.more, r.noAddr], [4, false, false]);
  const m = r.list[3];
  assert.equal(m.key, 'i:INBOX-0a1b2c3d:101');
  assert.deepEqual(m.atts, [{ name: '서명본.hwpx', kind: 'hwp' }, { name: '확인서.pdf', kind: 'pdf' }]);
  assert.equal(m.priv, false);
  assert.equal(r.list[2].priv, true, '첨부 이름 「9월 급여대장.xlsx」');
  assert.deepEqual(I.badges(r.list[2]), [{ txt: '개인 자료 · 목록에만', key: 'todo' }]);
  assert.deepEqual(I.badges(r.list[3]), []);
  assert.equal(r.list[0].out, true);
  const t = I.candidates(ROWS, { addrs: DARA, win: WIN, tech: true });
  assert.deepEqual(I.badges(t.list[2]), [{ txt: '개인 자료 · 목록에만', key: 'todo' }, { txt: '기술보호 자료', key: 'draft' }]);
  const subj = I.candidates([{ slug: 'B', uid: '1', out: false, from: 'dara@example.com', to: [], who: '', s: '4대보험 명부', d: 1,
    day: '2026-09-01', a: 1, an: ['a.pdf'] }], { addrs: DARA, win: WIN });
  assert.equal(subj.list[0].priv, true, '제목으로도 가린다');
  assert.deepEqual(I.candidates(ROWS, { addrs: {}, win: WIN }), { list: [], total: 0, more: false, noAddr: true });
  assert.equal(I.candidates(ROWS, { addrs: DARA }).list.length, 5, '기간을 안 주면 기간으로 거르지 않는다(104 옛것 포함)');
});

test('candidates — 50건까지 · 넘으면 more · 늦은 것이 위', () => {
  const many = [];
  for (let i = 1; i <= 55; i++) many.push({ slug: 'B', uid: String(i), out: false, from: 'dara@example.com', to: [], who: '', s: '서류 ' + i,
    d: Date.UTC(2026, 8, 1) + i * 60000, day: '2026-09-01', a: 1, an: ['a' + i + '.pdf'] });
  const r = I.candidates(many, { addrs: DARA, win: WIN });
  assert.deepEqual([r.list.length, r.total, r.more], [50, 55, true]);
  assert.equal(r.list[0].uid, '55');
});

test('kindOf · imgType — 확장자로 우리가 정한다(메일이 적어 보낸 종류는 안 믿는다)', () => {
  assert.equal(I.kindOf('서명본.HWPX'), 'hwp');
  assert.equal(I.kindOf('a.hwp'), 'hwp');
  assert.equal(I.kindOf('a.pdf'), 'pdf');
  assert.equal(I.kindOf('사진.JPG'), 'img');
  assert.equal(I.kindOf('표.xlsx'), 'xls');
  assert.equal(I.kindOf('표.xls'), 'xls');
  assert.equal(I.kindOf('압축.zip'), '');
  assert.equal(I.kindOf('이름만.pdf.exe'), '');
  assert.equal(I.kindOf(''), '');
  assert.equal(I.imgType('a.jpg'), 'image/jpeg');
  assert.equal(I.imgType('a.png'), 'image/png');
  assert.equal(I.imgType('a.pdf'), '');
});

test('linkKey — 만들기·풀기 · 80자 · 경로 글자·프로토타입 이름 거절', () => {
  const k = I.linkKey.make({ slug: 'INBOX-0a1b2c3d', uid: '101' });
  assert.equal(k, 'i:INBOX-0a1b2c3d:101');
  assert.deepEqual(I.linkKey.parse(k), { kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' });
  assert.deepEqual(I.linkKey.parse('i:INBOX_1_자문사답변-abcd1234:7'), { kind: 'imap', slug: 'INBOX_1_자문사답변-abcd1234', uid: '7' });
  assert.equal(I.linkKey.make({ pop: 'AB12_x' }), 'o:AB12_x');
  assert.deepEqual(I.linkKey.parse('o:AB12_x'), { kind: 'pop', key: 'AB12_x' });
  assert.equal(I.linkKey.make({ slug: 'a'.repeat(80), uid: '1' }), '', '80자가 넘으면 만들지 않는다');
  assert.equal(I.linkKey.make({ slug: 'a/b', uid: '1' }), '');
  assert.equal(I.linkKey.make({ slug: '__proto__', uid: '1' }), '');
  assert.equal(I.linkKey.make({ slug: 'X', uid: '1a' }), '');
  assert.equal(I.linkKey.make({ pop: 'a b' }), '');
  assert.equal(I.linkKey.make(null), '');
  ['', 'x', 'i:', 'i:X:', 'i:X:abc', 'i:a/b:1', 'i:__proto__:1', 'o:', 'o:a b', 'q:X:1', 'i:' + 'a'.repeat(80) + ':1', null, 7]
    .forEach((bad) => assert.equal(I.linkKey.parse(bad), null, String(bad)));
});

test('linkFrom — 연결 꼴(src·key·name·date) · 열쇠를 못 만들었거나 이름이 없으면 null · 이름 100자', () => {
  const r = I.candidates(ROWS, { addrs: DARA, win: WIN });
  assert.deepEqual(I.linkFrom(r.list[3], '서명본.hwpx'), { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' });
  assert.equal(I.linkFrom(r.list[3], ''), null);
  assert.equal(I.linkFrom({ key: '', day: '2026-09-25' }, 'a.pdf'), null);
  assert.equal(I.linkFrom(r.list[3], '가'.repeat(150)).name.length, 100);
  assert.deepEqual(Tr.normLink(I.linkFrom(r.list[3], '서명본.hwpx')), I.linkFrom(r.list[3], '서명본.hwpx'), '기록 모듈이 그대로 받는다');
});

test('linkFrom — 개인 자료 후보는 모듈에서도 연결 꼴을 만들지 않는다(화면이 단추를 빼먹어도)', () => {
  const r = I.candidates(ROWS, { addrs: DARA, win: WIN });
  const priv = r.list.filter((c) => c.priv)[0];
  assert.ok(priv && priv.key, '개인 자료 후보가 합성 자료에 있어야 한다');
  assert.equal(I.linkFrom(priv, priv.atts[0].name), null);
  assert.equal(I.linkFrom(Object.assign({}, r.list[3], { priv: true }), '서명본.hwpx'), null);
});

test('errText — 시간 초과·끊김 / 로그인 / 없음 / 너무 큼 / 그 밖', () => {
  const e = (status, name, message) => Object.assign(new Error(message || ''), { status, name: name || 'Error' });
  assert.equal(I.errText(e(0, 'TimeoutError')), I.MSG.NO_REPLY);
  assert.equal(I.errText(new TypeError('Failed to fetch')), I.MSG.NO_REPLY);
  assert.equal(I.errText(e(504)), I.MSG.NO_REPLY);
  assert.equal(I.errText(e(401)), I.MSG.LOGIN);
  assert.equal(I.errText(e(403)), I.MSG.LOGIN);
  assert.equal(I.errText(e(404)), I.MSG.GONE);
  assert.equal(I.errText(e(413)), I.MSG.TOO_BIG);
  assert.equal(I.errText(e(500, '', '메일 계정이 설정되지 않았습니다.')), '열지 못했습니다 — 메일 계정이 설정되지 않았습니다.');
  assert.equal(I.errText(null), '열지 못했습니다 — 알 수 없는 오류');
});

/* 가짜 서버 부르기 — 화면이 makeCall 로 만드는 call(fn, body) 와 같은 꼴 */
function fakeCall(atts, o) {
  o = o || {};
  const calls = [];
  const call = async (fn, body) => {
    calls.push([fn, body]);
    if (o.fail) throw Object.assign(new Error('거절'), { status: o.fail });
    if (fn === 'readMailMessage' || (fn === 'readOldMail' && body.index == null)) return { ok: true, html: '<p>본문</p>', text: '본문', atts };
    const a = atts.filter((x) => x.i === body.index)[0];
    if (!a) throw Object.assign(new Error('그 첨부가 없습니다'), { status: 404 });
    return { ok: true, name: a.name, mime: 'text/html', b64: o.noB64 ? '' : 'UEsDBA==' };
  };
  return { call, calls };
}

test('fetchAtt — 일반 폴더: 첨부 목록(peek, 읽음 표시 안 함) → 같은 이름 하나를 조각 이름으로 받는다', async () => {
  const f = fakeCall([{ i: 0, part: '2', name: '확인서.pdf', size: 10 }, { i: 1, part: '3', name: '서명본.hwpx', size: 10 }]);
  const got = await I.fetchAtt({ call: f.call, ref: { kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' }, name: '서명본.hwpx' });
  assert.deepEqual(got, { name: '서명본.hwpx', b64: 'UEsDBA==' });
  assert.deepEqual(f.calls, [['readMailMessage', { slug: 'INBOX-0a1b2c3d', uid: '101', peek: true }],
    ['readMailAttachment', { slug: 'INBOX-0a1b2c3d', uid: '101', index: 1, part: '3' }]]);
});

test('fetchAtt — 지난 메일: readOldMail 두 번(목록 → 번호)', async () => {
  const f = fakeCall([{ i: 0, part: '', name: '자료.pdf', size: 10 }]);
  const got = await I.fetchAtt({ call: f.call, ref: { kind: 'pop', key: 'AB12_x' }, name: '자료.pdf' });
  assert.equal(got.b64, 'UEsDBA==');
  assert.deepEqual(f.calls, [['readOldMail', { key: 'AB12_x' }], ['readOldMail', { key: 'AB12_x', index: 0 }]]);
});

test('fetchAtt — 이름이 없으면 404(받기는 안 부름) · 20MB 넘으면 413(받지 않는다) · 서버 거절은 그 상태 · 빈 바이트는 404', async () => {
  const ref = { kind: 'imap', slug: 'X', uid: '1' };
  const f = fakeCall([{ i: 0, part: '2', name: '다른.pdf', size: 10 }]);
  await assert.rejects(I.fetchAtt({ call: f.call, ref, name: '서명본.hwpx' }), (e) => e.status === 404);
  assert.equal(f.calls.length, 1, '첨부 받기는 부르지 않는다');
  const big = fakeCall([{ i: 0, part: '2', name: '큰.pdf', size: 21 * 1024 * 1024 }]);
  await assert.rejects(I.fetchAtt({ call: big.call, ref, name: '큰.pdf' }), (e) => e.status === 413);
  assert.equal(big.calls.length, 1);
  const no = fakeCall([], { fail: 401 });
  await assert.rejects(I.fetchAtt({ call: no.call, ref, name: 'a.pdf' }), (e) => e.status === 401);
  await assert.rejects(I.fetchAtt({ call: f.call, ref: null, name: 'a.pdf' }), (e) => e.status === 404);
  const empty = fakeCall([{ i: 0, part: '2', name: 'a.pdf', size: 1 }], { noB64: true });
  await assert.rejects(I.fetchAtt({ call: empty.call, ref, name: 'a.pdf' }), (e) => e.status === 404);
});
