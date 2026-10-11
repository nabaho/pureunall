'use strict';
/* 컨설팅보고서 앱 — 서명 요청·보냄 찾기·회신 순서·제출 받는이 (2026-10-11, 설계 2026-10-11-gov-report-sign-submit-design.md)
 * ★ 지키는 것: 꼬리표는 rid 전체 · 이상한 rid/kind 는 null · 문안에 개인정보 꼴 없음 · 보낸 메일은 가장 이른 것(+건수)
 *   회신은 보낸 날 이후 «받은» 메일만 · 제출 받는이는 우리·업체 주소 뺀 것 · 저장 칸 값은 기록 모듈 검사를 통과
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/pu-gov-report-send.js');
const I = require('../js/pu-gov-report-inbox.js');
const Tr = require('../js/pu-gov-report-track.js');

const DARA = { 'dara@example.com': 1, 'dara.sub@example.com': 1 };
function row(o) {
  const d = o.d || Date.UTC(2026, 8, 25, 1);
  return Object.assign({ slug: 'INBOX-0a1b2c3d', uid: '1', out: false, from: 'dara@example.com', to: ['office@pureun.kr'],
    who: '다라정밀 담당', s: '제목', d, day: new Date(d + 9 * 3600e3).toISOString().slice(0, 10), a: 1, an: ['a.pdf'] }, o);
}

test('tagOf — rid 전체를 쓰고 이상한 값은 빈 글', () => {
  assert.equal(S.tagOf('sign', 't4_2026'), '[서명요청:t4_2026]');
  assert.equal(S.tagOf('submit', 't4_2026'), '[제출:t4_2026]');
  assert.equal(S.tagOf('sign', ''), '');
  assert.equal(S.tagOf('sign', '__proto__'), '[서명요청:__proto__]', 'rid 는 글자 조각일 뿐 객체 키가 아니다');
  assert.equal(S.tagOf('sign', 'a b'), '');
  assert.equal(S.tagOf('sign', 'x'.repeat(41)), '');
  assert.equal(S.tagOf('__proto__', 't4_2026'), '');
  assert.equal(S.tagOf('constructor', 't4_2026'), '');
  assert.equal(S.tagOf('other', 't4_2026'), '');
  assert.ok(S.TAG_RE.test('[서명요청:t4_2026]') && S.TAG_RE.test('앞 [제출:t4_2026] 뒤'));
});

test('draft(sign) — 꼬리표·제목·본문, 개인정보 꼴 없음, 회신 희망일은 있을 때만', () => {
  const d = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: '충남북부상의 인사노무', reportName: '결과보고서' });
  assert.equal(d.tag, '[서명요청:t4_2026]');
  assert.equal(d.subject, '[서명요청:t4_2026] 충남북부상의 인사노무 결과보고서 서명·날인 요청 (다라정밀)');
  assert.ok(d.body.includes('스캔본을 이 메일에 회신'));
  assert.ok(!/회신 희망일/.test(d.body));
  assert.ok(!/\d{6}-?\d{7}|\d{2,3}-\d{3,4}-\d{4}|@/.test(d.body), '주민번호·전화·주소 꼴 없음');
  const d2 = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: 'B', reportName: 'R', due: '2026-10-09' });
  assert.ok(d2.body.includes('회신 희망일: 10월 9일까지'));
});

test('draft(submit) — 꼬리표 [제출:rid] · 필수값 없으면 null', () => {
  const d = S.draft('submit', { rid: 't4_2026', co: '다라정밀', biz: '서산상의', reportName: '결과보고서' });
  assert.equal(d.subject, '[제출:t4_2026] 서산상의 결과보고서 제출 (다라정밀)');
  assert.equal(S.draft('sign', { rid: '', co: 'c', biz: 'b', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: '', biz: 'b', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: 'c', biz: '', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: 'c', biz: 'b', reportName: '' }), null);
  assert.equal(S.draft('sign', null), null);
});

test('toCc · composeParts · composeUrl — 첫 주소가 받는이, 나머지는 참조, 본문은 URL 에 안 싣는다', () => {
  assert.deepEqual(S.toCc(DARA), { to: 'dara@example.com', cc: ['dara.sub@example.com'] });
  assert.deepEqual(S.toCc({ 'not-mail': 1, 'a@example.com': 1 }), { to: 'a@example.com', cc: [] });
  assert.deepEqual(S.toCc({}), { to: '', cc: [] });
  assert.deepEqual(S.toCc(null), { to: '', cc: [] });
  const d = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: 'B', reportName: 'R' });
  const p = S.composeParts(d, 'dara@example.com', ['dara.sub@example.com', 'x@example.com']);
  assert.equal(p.cc, 'dara.sub@example.com,x@example.com');
  assert.equal(p.subject, d.subject);
  assert.equal(p.body, d.body);
  const u = S.composeUrl('pu-cards.html', p);
  assert.ok(u.startsWith('pu-cards.html?view=mail&to=dara%40example.com&cc='));
  assert.ok(u.includes('&subject=' + encodeURIComponent(d.subject)));
  assert.ok(!/body=/.test(u), 'URL 에 본문을 싣지 않는다');
  assert.equal(S.composeUrl('pu-cards.html', { to: '', cc: '', subject: 's', body: 'b' }), '');
});

test('findSent — 보낸 메일(out)에서 꼬리표가 든 가장 이른 것 + 건수', () => {
  const tag = S.tagOf('sign', 't4_2026');
  const rows = [
    row({ slug: 'Sent-1b2c3d4e', uid: '12', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: tag + ' B R 서명·날인 요청 (다라정밀)', d: Date.UTC(2026, 8, 20, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '11', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: tag + ' B R 서명·날인 요청 (다라정밀)', d: Date.UTC(2026, 8, 18, 1) }),
    row({ slug: 'INBOX-0a1b2c3d', uid: '5', out: false, s: 'Re: ' + tag + ' 회신', d: Date.UTC(2026, 8, 19, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '9', out: true, to: ['x@example.org'], s: '[서명요청:t9_2026] 다른 건', d: Date.UTC(2026, 8, 17, 1) }),
  ];
  const f = S.findSent(rows, tag);
  assert.deepEqual(f, { day: '2026-09-18', key: 'i:Sent-1b2c3d4e:11', count: 2 });
  assert.equal(S.findSent(rows, S.tagOf('sign', 'nope')), null);
  assert.equal(S.findSent(rows, ''), null);
  assert.equal(S.findSent(null, tag), null);
});

test('rankReplies — 보낸 날 이후 «받은» 메일만 reply, 서명·날인 힌트가 앞, 보낸 날 이전·보낸 메일은 reply 아님', () => {
  const win = { from: '2026-07-01', to: '2026-12-31' };
  const rows = [
    row({ uid: '1', s: '기타 자료', d: Date.UTC(2026, 8, 25, 1) }),
    row({ uid: '2', s: '서명본 보냅니다', d: Date.UTC(2026, 8, 26, 1) }),
    row({ uid: '3', s: '옛 메일', d: Date.UTC(2026, 8, 10, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '4', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: '보낸 것', d: Date.UTC(2026, 8, 27, 1) }),
  ];
  const c = I.candidates(rows, { addrs: DARA, win });
  const r = S.rankReplies(c.list, '2026-09-20');
  assert.deepEqual(r.map((x) => x.uid), ['2', '1', '4', '3']);
  assert.deepEqual(r.map((x) => [x.reply, x.hint]), [[true, true], [true, false], [false, false], [false, false]]);
  assert.equal(c.list[0].reply, undefined, '원본 항목을 바꾸지 않는다');
  const same = S.rankReplies(c.list, '');
  assert.deepEqual(same.map((x) => x.uid), c.list.map((x) => x.uid), '보낸 날이 없으면 순서 그대로');
  assert.ok(same.every((x) => x.reply === false));
  assert.deepEqual(S.rankReplies(null, '2026-09-20'), []);
});

test('submitTo — 사업 낱말이 든 가장 최근 보낸 메일의 받는이, 우리·업체 주소는 뺀다', () => {
  const rows = [
    row({ slug: 'Sent-1b2c3d4e', uid: '1', out: true, from: 'office@pureun.kr', to: ['agency@example.org', 'dara@example.com', 'me@pureun.kr'], s: '서산상의 결과보고서 제출 (가나상사)', d: Date.UTC(2026, 3, 1, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '2', out: true, from: 'office@pureun.kr', to: ['agency2@example.org'], s: '서산상의 결과보고서 제출 (다라정밀)', d: Date.UTC(2026, 8, 1, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '3', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: '서산 안내', d: Date.UTC(2026, 9, 1, 1) }),
    row({ slug: 'INBOX-0a1b2c3d', uid: '4', out: false, s: '서산 받은 것', d: Date.UTC(2026, 9, 5, 1) }),
  ];
  assert.deepEqual(S.submitTo(rows, { words: ['서산'], addrs: DARA }),
    { to: ['agency2@example.org'], day: '2026-09-01', s: '서산상의 결과보고서 제출 (다라정밀)' });
  assert.equal(S.submitTo(rows, { words: ['없는사업'], addrs: DARA }), null);
  assert.equal(S.submitTo(rows, { words: [], addrs: DARA }), null);
  assert.equal(S.submitTo([row({ slug: 'S', uid: '1', out: true, to: ['dara@example.com', 'me@pureun.kr'], s: '서산 건' })], { words: ['서산'], addrs: DARA }), null,
    '우리·업체 주소뿐이면 제안하지 않는다');
});

test('sentFields · gotFields — 칸별 저장 값, 기록 모듈 검사를 통과', () => {
  assert.deepEqual(S.sentFields('sign', '2026-09-18'), { st: 'doing', sentAt: '2026-09-18' });
  assert.deepEqual(S.sentFields('submit', '2026-09-18'), { st: 'done', gotAt: '2026-09-18', how: 'mail' });
  assert.equal(S.sentFields('attach', '2026-09-18'), null);
  assert.equal(S.sentFields('sign', 'x'), null);
  assert.deepEqual(S.gotFields('sign', '2026-09-25'), { st: 'done', gotAt: '2026-09-25' });
  assert.equal(S.gotFields('submit', '2026-09-25'), null);
  assert.equal(S.gotFields('sign', ''), null);
  const base = { st: 'none', note: '', sentAt: '', gotAt: '', how: '', ack: false, link: null };
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('sign', '2026-09-18')), 'sign'), '');
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('sign', '2026-09-18'), S.gotFields('sign', '2026-09-25')), 'sign'), '');
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('submit', '2026-09-18')), 'submit'), '');
});

test('MSG — 화면 문구는 한 곳에서', () => {
  ['NO_ADDR', 'NO_TAG', 'NO_SUBMIT_TO', 'BODY_COPIED', 'COPIED_ALL', 'ATTACH', 'DL_NOTE', 'REPLY'].forEach((k) => assert.ok(S.MSG[k] && typeof S.MSG[k] === 'string', k));
});
