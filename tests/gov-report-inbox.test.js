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
  assert.equal(I.MSG.TECH, '기술보호 자료 · 상담 완료 후 반납·삭제 대상');
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
  assert.deepEqual(I.badges(t.list[2]), [{ txt: '개인 자료 · 목록에만', key: 'todo' }, { txt: '기술보호 자료 · 상담 완료 후 반납·삭제 대상', key: 'draft' }]);
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

/* ── 최종 검토 고침 (2026-10-11) ── 거울 이름은 60자로 잘린다(functions/mail-box.js attNames) · 서버는 온 이름(pickParts) */
const STEM = '가'.repeat(66);
const LONG_PDF = STEM + '.pdf', LONG_HWP = STEM + '.hwpx';   // 70·71자 — 앞 60자가 같다
const REF = { kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' };

test('mirrorName · mayBeCut — 거울 꼴(탭·줄바꿈 → 빈칸, 앞뒤 빈칸 떼고 60자) · 60자 이름은 잘렸을 수 있다', () => {
  assert.equal(I.NAME_CUT, 60);
  const cut = I.mirrorName(LONG_PDF);
  assert.equal(cut, '가'.repeat(60));
  assert.equal(I.kindOf(cut), '', '잘린 이름에는 확장자가 없다');
  assert.equal(I.mirrorName('  서명본\t최종\r\n.pdf '), '서명본 최종 .pdf');
  assert.equal(I.mirrorName('a.pdf'), 'a.pdf');
  assert.equal(I.mayBeCut(cut), true);
  assert.equal(I.mayBeCut('a.pdf'), false);
  const r = I.candidates([{ slug: 'B', uid: '1', out: false, from: 'dara@example.com', to: [], who: '', s: '긴 이름', d: 1,
    day: '2026-09-01', a: 2, an: [cut, 'a.pdf'] }], { addrs: DARA, win: WIN });
  assert.deepEqual(r.list[0].atts, [{ name: cut, kind: '', cut: true }, { name: 'a.pdf', kind: 'pdf' }], '잘린 이름은 cut 표시(형식을 아직 모른다)');
});

test('긴 이름 — 거울의 60자 이름으로 서버의 70자 이름을 찾아 받는다 · 돌려주는 이름은 서버의 온 이름', async () => {
  const f = fakeCall([{ i: 0, part: '2', name: '확인서.pdf', size: 10 }, { i: 1, part: '3', name: LONG_PDF, size: 10 }]);
  const found = await I.findAtt({ call: f.call, ref: REF, name: I.mirrorName(LONG_PDF) });
  assert.deepEqual(found, { name: LONG_PDF, idx: 1, part: '3', size: 10 });
  assert.equal(I.kindOf(found.name), 'pdf', '형식은 온 이름으로 정한다');
  assert.equal(f.calls.length, 1, '찾기는 목록만 부른다(바이트 안 받음)');
  const g = fakeCall([{ i: 0, part: '2', name: '확인서.pdf', size: 10 }, { i: 1, part: '3', name: LONG_PDF, size: 10 }]);
  const got = await I.fetchAtt({ call: g.call, ref: REF, name: I.mirrorName(LONG_PDF) });
  assert.deepEqual(got, { name: LONG_PDF, b64: 'UEsDBA==' });
  assert.deepEqual(g.calls[1], ['readMailAttachment', { slug: 'INBOX-0a1b2c3d', uid: '101', index: 1, part: '3' }]);
  const tab = fakeCall([{ i: 0, part: '2', name: '서명본\t최종.pdf', size: 10 }]);
  assert.equal((await I.findAtt({ call: tab.call, ref: REF, name: '서명본 최종.pdf' })).name, '서명본\t최종.pdf', '탭을 빈칸으로 바꾼 거울 이름도 맞춘다');
});

test('긴 이름 — 똑같은 이름이 먼저 · 앞 60자가 같은 것이 둘이면 잘린 이름으로는 고르지 않고 거절(엉뚱한 파일 금지)', async () => {
  const atts = [{ i: 0, part: '2', name: LONG_HWP, size: 10 }, { i: 1, part: '3', name: LONG_PDF, size: 10 }];
  const ex = fakeCall(atts);
  assert.deepEqual(await I.findAtt({ call: ex.call, ref: REF, name: LONG_PDF }), { name: LONG_PDF, idx: 1, part: '3', size: 10 },
    '온 이름을 알면 그 이름으로');
  const amb = fakeCall(atts);
  await assert.rejects(I.fetchAtt({ call: amb.call, ref: REF, name: I.mirrorName(LONG_PDF) }), (e) => e.code === 'ambig');
  assert.equal(amb.calls.length, 1, '바이트를 받지 않는다');
  assert.equal(I.errText(Object.assign(new Error('x'), { code: 'ambig', status: 409 })), I.MSG.AMBIG);
  assert.match(I.MSG.AMBIG, /여럿/);
  const dup = fakeCall([{ i: 0, part: '2', name: LONG_PDF, size: 10 }, { i: 1, part: '3', name: LONG_PDF, size: 10 }]);
  assert.equal((await I.findAtt({ call: dup.call, ref: REF, name: I.mirrorName(LONG_PDF) })).idx, 0, '이름까지 같은 둘은 똑같은 이름 규칙처럼 첫 것');
});

test('겹치는 거울 이름 — 똑같은 이름이 있어도 다른 첨부가 같은 거울 이름으로 줄면 두 줄 모두 거절(바이트 안 받음)', async () => {
  const X = '가'.repeat(60), Y = X + '나머지 열 글자.pdf';   // Y 를 거울 꼴로 줄이면 X
  assert.equal(I.mirrorName(Y), X);
  for (const pair of [[X, Y], ['a\tb.pdf', 'a b.pdf']]) {
    const atts = pair.map((n, i) => ({ i, part: String(i + 2), name: n, size: 10 }));
    for (const clicked of pair.map(I.mirrorName)) {
      const f = fakeCall(atts);
      await assert.rejects(I.fetchAtt({ call: f.call, ref: REF, name: clicked }), (e) => e.code === 'ambig', JSON.stringify([pair, clicked]));
      assert.equal(f.calls.length, 1, '목록만 — 바이트를 받지 않는다');
    }
  }
  /* 하나뿐이면 그대로 — 똑같은 이름 하나 · 거울 꼴 하나 */
  const one = fakeCall([{ i: 0, part: '2', name: X, size: 10 }, { i: 1, part: '3', name: '다른.pdf', size: 10 }]);
  assert.equal((await I.findAtt({ call: one.call, ref: REF, name: X })).idx, 0);
  const tab = fakeCall([{ i: 0, part: '2', name: 'a\tb.pdf', size: 10 }]);
  assert.deepEqual(await I.fetchAtt({ call: tab.call, ref: REF, name: 'a b.pdf' }), { name: 'a\tb.pdf', b64: 'UEsDBA==' });
});

test('긴 이름 — 개인 자료 말이 60자 뒤에 있으면(거울 딱지는 못 봄) 온 이름으로 다시 보고 받지 않는다', async () => {
  const name = '가'.repeat(62) + ' 9월 급여대장.xlsx';
  const cut = I.mirrorName(name);
  assert.ok(!I.PRIV_RE.test(cut), '거울 이름에는 그 말이 없다');
  const f = fakeCall([{ i: 0, part: '2', name, size: 10 }]);
  await assert.rejects(I.fetchAtt({ call: f.call, ref: REF, name: cut }), (e) => e.code === 'priv');
  assert.equal(f.calls.length, 1, '바이트를 받지 않는다');
  assert.equal(I.errText(Object.assign(new Error(''), { code: 'priv', status: 403 })), I.MSG.PRIV_OPEN);
});

test('긴 이름 — 온 이름도 열 수 없는 형식이면 받지 않는다(cant)', async () => {
  const f = fakeCall([{ i: 0, part: '2', name: STEM + '.zip', size: 10 }]);
  await assert.rejects(I.fetchAtt({ call: f.call, ref: REF, name: I.mirrorName(STEM + '.zip') }), (e) => e.code === 'cant');
  assert.equal(f.calls.length, 1);
  assert.equal(I.errText(Object.assign(new Error(''), { code: 'cant' })), I.MSG.CANT);
});

test('errText — 404 에 서버가 적어 보낸 까닭이 있으면 그 글(최근 400통 밖 등) · 없으면 「지워졌을 수 있습니다」 · 모듈이 낸 없음은 GONE', () => {
  const below = '메일 서버가 이 칸에서는 최근 400통만 열어 줍니다 — 이 메일은 그 밖입니다';
  assert.equal(I.errText(Object.assign(new Error(below), { status: 404 })), below);
  assert.equal(I.errText(Object.assign(new Error('서버가 거절했습니다'), { status: 404 })), I.MSG.GONE, 'makeCall 기본 문구는 까닭이 아니다');
  assert.equal(I.errText(Object.assign(new Error(''), { status: 404 })), I.MSG.GONE);
  assert.equal(I.errText(Object.assign(new Error('그 첨부가 없습니다'), { status: 404, code: 'gone' })), I.MSG.GONE);
  assert.equal(I.errText(Object.assign(new Error('가'.repeat(500)), { status: 404 })).length, 200, '너무 긴 글은 자른다');
});

/* ── 전역 받은 서류 확인(2026-10-12) ── */
test('sinceWindow — 오늘 − 45일 ~ 오늘 · 해를 넘어도 맞다 · 꼴이 틀리면 null · 상수', () => {
  assert.equal(I.GLOBAL_DAYS, 45);
  assert.equal(I.GLOBAL_MAX, 30);
  assert.deepEqual(I.sinceWindow('2026-10-12', I.GLOBAL_DAYS), { from: '2026-08-28', to: '2026-10-12' });
  assert.deepEqual(I.sinceWindow('2026-01-10', 45), { from: '2025-11-26', to: '2026-01-10' });
  assert.deepEqual(I.sinceWindow('2026-10-12', 0), { from: '2026-10-12', to: '2026-10-12' });
  assert.equal(I.sinceWindow('x', 45), null);
  assert.equal(I.sinceWindow('', 45), null);
  assert.equal(I.sinceWindow(null, 45), null);
  assert.equal(I.sinceWindow('2026/10/12', 45), null);
});

function pend(uid, day, o) {
  return Object.assign({ slug: 'B', uid: String(uid), out: false, who: '', s: '서류 ' + uid, d: Date.parse(day + 'T03:00:00Z'), day,
    a: 1, key: 'i:B:' + uid, priv: false, tech: false, atts: [{ name: uid + '.pdf', kind: 'pdf' }] }, o || {});
}

test('pending — 연결된 것·보낸 것·열쇠 없는 것은 빠진다 · 날짜 내림차순(같으면 열쇠 순) · 원본은 그대로', () => {
  const list = [pend(1, '2026-09-01'), pend(2, '2026-09-05'), pend(3, '2026-09-03', { out: true }), pend(4, '2026-09-04', { key: '' }),
    pend(5, '2026-09-05'), pend(6, '2026-09-02'), pend(7, '2026-09-06', { key: undefined })];
  const before = JSON.stringify(list), order = list.slice();
  const r = I.pending(list, { 'i:B:6': 1 }, {});
  assert.deepEqual(r.list.map((m) => m.uid), ['2', '5', '1'], '6 은 연결됨 · 3 은 보낸 것 · 4·7 은 열쇠 없음 · 2·5 는 같은 때라 열쇠 순');
  assert.equal(r.more, false);
  assert.equal(JSON.stringify(list), before, '원본 항목을 바꾸지 않는다');
  list.forEach((m, i) => assert.equal(m, order[i], '원본 배열 순서·항목 그대로'));
  assert.notEqual(r.list, list, '새 배열');
});

test('pending — seen 에 열쇠를 적어 두 번째 호출(다른 업체)에서 같은 메일을 건너뛴다', () => {
  const seen = {};
  const a = I.pending([pend(1, '2026-09-01'), pend(2, '2026-09-02')], {}, seen);
  assert.deepEqual(a.list.map((m) => m.uid), ['2', '1']);
  assert.deepEqual(Object.keys(seen).sort(), ['i:B:1', 'i:B:2']);
  const b = I.pending([pend(2, '2026-09-02'), pend(3, '2026-09-03')], {}, seen);
  assert.deepEqual(b.list.map((m) => m.uid), ['3'], '2 는 앞 업체에서 이미 나왔다');
  assert.ok(seen['i:B:3']);
  const c = I.pending([pend(1, '2026-09-01', { out: true })], {}, {});
  assert.deepEqual(c.list, []);
  const s2 = {};
  I.pending([pend(1, '2026-09-01', { out: true }), pend(2, '2026-09-02', { key: '' })], {}, s2);
  assert.deepEqual(s2, {}, '걸러진 것은 seen 에 적지 않는다');
});

test('pending — 30건까지 · 넘으면 more · 늦은 것이 위 · 자른 것은 seen 에 적지 않는다', () => {
  const many = [];
  for (let i = 1; i <= 31; i++) many.push(pend(i, '2026-09-' + String(Math.min(i, 28)).padStart(2, '0'), { d: Date.UTC(2026, 8, 1) + i * 60000 }));
  const seen = {};
  const r = I.pending(many, {}, seen);
  assert.deepEqual([r.list.length, r.more], [30, true]);
  assert.equal(r.list[0].uid, '31');
  assert.equal(r.list[29].uid, '2');
  assert.equal(Object.keys(seen).length, 30, '보이는 30건만 적는다');
  assert.equal(I.pending(many.slice(0, 30), {}, {}).more, false, '딱 30건이면 more 아님');
});

test('mailRows — DB 가 번호 촘촘한 폴더를 «배열»로 돌려줘도 읽는다(인덱스가 uid · null 칸은 건너뜀)', () => {
  const folders = { 'INBOX-0a1b2c3d': { path: 'INBOX', name: '받은메일함', kind: 'inbox' } };
  const row = (u) => ({ u, f: '가나', e: 'gana@example.com', t: 'office@pureun.kr', s: '제목', d: Date.UTC(2026, 9, 10, 1), a: 1, an: ['a.pdf'] });
  const fromArray = I.mailRows(folders, { 'INBOX-0a1b2c3d': [null, row(1), null, row(3), 'x', 5] });
  const fromObject = I.mailRows(folders, { 'INBOX-0a1b2c3d': { 1: row(1), 3: row(3) } });
  assert.deepEqual(fromArray.map((r) => r.uid), ['1', '3']);
  assert.deepEqual(fromArray, fromObject, '배열이든 객체든 같은 줄');
  assert.deepEqual(I.mailRows(folders, { 'INBOX-0a1b2c3d': [] }), []);
  assert.deepEqual(I.mailRows(folders, { 'INBOX-0a1b2c3d': 'x' }), []);
});

test('pending — list·linked·seen 이 null 이어도 오류 없다', () => {
  assert.deepEqual(I.pending(null, null, null), { list: [], more: false });
  assert.deepEqual(I.pending(undefined, {}, {}), { list: [], more: false });
  const r = I.pending([pend(1, '2026-09-01')], null, null);
  assert.deepEqual(r.list.map((m) => m.uid), ['1']);
  assert.deepEqual(I.pending([null, 5, pend(2, '2026-09-02')], undefined, undefined).list.map((m) => m.uid), ['2']);
});
