'use strict';
/* 사건 관할기관 «메일에서 가져오기» 순수 함수 (2026-11-07, 계획 docs/superpowers/plans/2026-11-07-case-jur-mail.md)
 * ★ 지키는 것: 받은 칸만 읽는다 · 최근 DAYS 일 · 노동 쪽 거르기 · 네 칸 뽑기(인용·팩스·noreply 거르기) ·
 *   현재값과 견주기(fill/same/change/miss) · 합치기(빈 값으로 기존 값을 덮지 않는다, 바뀐 칸은 기본 «그대로 두기»)
 * 공개 저장소다 — 합성 자료만(실제 기관 직원 이름·번호 금지). */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pu-case-jur-mail.js');

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 7, 3, 0, 0);

function row(o) { return Object.assign({ slug: 'inbox', uid: '1', from: 'x@gmail.com', who: '', s: '', d: NOW - DAY, a: 0 }, o); }

test('상수 — 기간·줄 수는 한 자리, 칸 넷은 사건 judgment 와 같은 열쇠', () => {
  assert.ok(Number.isInteger(P.DAYS) && P.DAYS > 0);
  assert.ok(Number.isInteger(P.MAX_ROWS) && P.MAX_ROWS > 0);
  assert.deepEqual(P.FIELDS, ['org', 'officer', 'phone', 'email']);
  P.FIELDS.forEach(k => assert.ok(P.LABELS[k], k + ' 이름표'));
});

test('mailRows — 받은·보관·손으로 만든 폴더만, 보낸·스팸·휴지통·nomsg 는 안 나온다', () => {
  const folders = { inbox: { kind: 'inbox' }, arch: { kind: 'archive' }, cust: { kind: 'custom' },
    sent: { kind: 'sent' }, spam: { kind: 'spam' }, trash: { kind: 'trash' }, none: { kind: 'inbox', nomsg: true } };
  const one = (n) => ({ '5': { f: n, e: n + '@korea.kr', s: '제목', d: NOW, a: 0 } });
  const msgs = { inbox: one('a'), arch: one('b'), cust: one('c'), sent: one('d'), spam: one('e'), trash: one('f'), none: one('g') };
  const rows = P.mailRows(folders, msgs);
  assert.deepEqual(rows.map(r => r.slug).sort(), ['arch', 'cust', 'inbox']);
  const r = rows.find(x => x.slug === 'inbox');
  assert.equal(r.uid, '5');
  assert.equal(r.from, 'a@korea.kr');
  assert.equal(r.who, 'a');
  assert.equal(r.s, '제목');
  assert.equal(r.d, NOW);
});

test('mailRows — 배열로 돌아온 폴더(촘촘한 번호)의 빈 칸을 건너뛰고 번호를 지킨다 · 우리 주소 발신은 뺀다', () => {
  const folders = { inbox: { kind: 'inbox' } };
  const msgs = { inbox: [null, { f: '가', e: 'a@korea.kr', s: 's1', d: NOW }, null, { f: '나', e: 'me@pureun.kr', s: 's2', d: NOW }, { f: '다', e: 'c@korea.kr', s: 's3', d: NOW }] };
  const rows = P.mailRows(folders, msgs);
  assert.deepEqual(rows.map(r => r.uid), ['1', '4']);
});

test('mailRows — 이상한 입력에도 던지지 않는다', () => {
  assert.deepEqual(P.mailRows(null, null), []);
  assert.deepEqual(P.mailRows({ inbox: { kind: 'inbox' } }, {}), []);
  assert.deepEqual(P.mailRows({ inbox: { kind: 'inbox' } }, { inbox: 'x' }), []);
});

test('isLabor — 노동 직통 도메인은 늘, 정부 도메인은 노동 낱말이 있을 때만, 그 밖은 아니다', () => {
  assert.equal(P.isLabor(row({ from: 'x@moel.go.kr', s: '안내' })), true);
  assert.equal(P.isLabor(row({ from: 'x@comwel.or.kr', s: '안내' })), true);
  assert.equal(P.isLabor(row({ from: 'x@korea.kr', s: '임금체불 진정 출석 요구' })), true);
  assert.equal(P.isLabor(row({ from: 'x@korea.kr', who: '가나다/근로개선지도과', s: '자료 요청' })), true);
  assert.equal(P.isLabor(row({ from: 'x@korea.kr', s: '행사 안내' })), false);
  assert.equal(P.isLabor(row({ from: 'x@gmail.com', s: '임금체불 진정' })), false);
  assert.equal(P.isLabor(row({ from: '', s: '' })), false);
});

test('candidates — 기간 경계 · 날짜 내림차순 · 칩 · 찾기', () => {
  const rows = [
    row({ uid: '1', from: 'a@korea.kr', s: '체불 진정', d: NOW - (P.DAYS - 1) * DAY }),
    row({ uid: '2', from: 'b@korea.kr', s: '체불 진정', d: NOW - (P.DAYS + 1) * DAY }),
    row({ uid: '3', from: 'c@korea.kr', s: '체불 출석', d: NOW - 2 * DAY }),
    row({ uid: '4', from: 'd@gmail.com', s: '안부', d: NOW - 1 * DAY }),
    row({ uid: '5', from: 'e@korea.kr', s: '행사', d: NOW - 3 * DAY })
  ];
  const labor = P.candidates(rows, { now: NOW, chip: 'labor' });
  assert.deepEqual(labor.list.map(r => r.uid), ['3', '1'], '기간 밖은 빠지고 최근 것이 앞');
  const all = P.candidates(rows, { now: NOW, chip: 'all' });
  assert.deepEqual(all.list.map(r => r.uid), ['4', '3', '5', '1']);
  assert.equal(all.total, 4);
  assert.deepEqual(P.candidates(rows, { now: NOW, chip: 'all', query: '출석' }).list.map(r => r.uid), ['3']);
  assert.deepEqual(P.candidates(rows, { now: NOW, chip: 'all', query: 'D@GMAIL' }).list.map(r => r.uid), ['4'], '주소도 대소문자 없이');
});

test('candidates — 많으면 MAX_ROWS 까지만, more 로 알린다 · 날짜가 이상한 줄은 건너뛴다', () => {
  const rows = [];
  for (let i = 0; i < P.MAX_ROWS + 5; i++) rows.push(row({ uid: String(i + 1), from: 'a@moel.go.kr', d: NOW - (i + 1) * 1000 }));
  rows.push(row({ uid: '999', from: 'a@moel.go.kr', d: 'x' }));
  const r = P.candidates(rows, { now: NOW, chip: 'labor' });
  assert.equal(r.list.length, P.MAX_ROWS);
  assert.equal(r.more, true);
  assert.equal(r.total, P.MAX_ROWS + 5);
});

test('htmlToText — 태그를 걷고 줄바꿈을 살리고 글자 엔티티를 푼다', () => {
  const t = P.htmlToText('<style>p{color:red}</style><p>담당자&nbsp;: 가나다</p><p>전화 041-123-4567<br>팩스 041-123-4568</p><script>alert(1)</script>');
  assert.ok(!/[<>]/.test(t), '태그가 남지 않는다');
  assert.ok(!/color|alert/.test(t), 'style·script 안 글은 버린다');
  assert.ok(/담당자 : 가나다/.test(t));
  assert.ok(/전화 041-123-4567\n팩스 041-123-4568/.test(t), '<br> 는 줄바꿈');
  assert.equal(P.htmlToText(null), '');
});

test('extract — 서명 끝에 있는 담당자·전화·기관은 «서명», 본문 가운데에 있으면 «본문»', () => {
  const sig = P.extract({ who: '', from: 'p@korea.kr', subject: '자료 제출 요청',
    text: '안녕하세요.\n자료를 보내 주시기 바랍니다.\n\n감사합니다.\n\n담당자 : 가나다\n전화 : 041-123-4567\n천안고용노동지청 근로개선지도과', html: '' });
  assert.equal(sig.officer, '가나다');
  assert.equal(sig.phone, '041-123-4567');
  assert.equal(sig.org, '천안고용노동지청');
  assert.equal(sig.email, 'p@korea.kr');
  assert.deepEqual(sig.src, { org: '서명', officer: '서명', phone: '서명', email: '보낸 주소' });

  const filler = Array.from({ length: 30 }, (_, i) => '본문 줄 ' + i).join('\n');
  const body = P.extract({ who: '', from: 'p@korea.kr', subject: '',
    text: '담당자 : 가나다\n전화 : 041-123-4567\n천안고용노동지청\n' + filler, html: '' });
  assert.equal(body.officer, '가나다');
  assert.equal(body.phone, '041-123-4567');
  assert.equal(body.org, '천안고용노동지청');
  assert.deepEqual(body.src, { org: '본문', officer: '본문', phone: '본문', email: '보낸 주소' });
});

test('extract — 본문에 단서가 없으면 보낸 사람 표시에서(담당자·기관), 이메일은 늘 보낸 주소', () => {
  const r = P.extract({ who: '가나다/천안지청', from: 'p@korea.kr', subject: '', text: '첨부 참조', html: '' });
  assert.equal(r.officer, '가나다');
  assert.equal(r.org, '천안지청');
  assert.equal(r.phone, '');
  assert.equal(r.email, 'p@korea.kr');
  assert.equal(r.src.officer, '보낸 사람 이름');
  assert.equal(r.src.org, '보낸 사람 표시');
  assert.equal(r.src.phone, '');
});

test('extract — 보낸 사람 이름이 직함·부서 꼴이면 담당자로 쓰지 않는다', () => {
  ['고용노동부', '근로개선지도과', '주무관', '천안고용노동지청', '노동위원회'].forEach(w => {
    assert.equal(P.extract({ who: w, from: 'p@korea.kr', subject: '', text: '', html: '' }).officer, '', w);
  });
  assert.equal(P.extract({ who: '가나다 주무관', from: 'p@korea.kr', subject: '', text: '', html: '' }).officer, '가나다');
  assert.equal(P.extract({ who: '가나다(고용노동부)', from: 'p@korea.kr', subject: '', text: '', html: '' }).officer, '가나다');
});

test('extract — noreply·자동발송·우리 주소는 이메일 칸을 비운다', () => {
  ['noreply@korea.kr', 'no-reply@x.go.kr', 'donotreply@x.go.kr', 'postmaster@x.go.kr', 'me@pureun.kr', ''].forEach(a => {
    const r = P.extract({ who: '', from: a, subject: '', text: '', html: '' });
    assert.equal(r.email, '', a);
    assert.equal(r.src.email, '', a);
  });
});

test('extract — 팩스 번호는 전화가 아니다 · 전화 라벨이 있는 줄을 먼저 · 구분 글자는 하이픈으로 맞춘다', () => {
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '팩스 041-123-4568\n전화 041-123-4567', html: '' }).phone, '041-123-4567');
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '팩스 041-123-4568', html: '' }).phone, '');
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '※ 문의: 041)123-4567', html: '' }).phone, '041-123-4567');
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: 'T. 041.123.4567', html: '' }).phone, '041-123-4567');
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '휴대폰 010-1234-5678', html: '' }).phone, '010-1234-5678');
  assert.equal(P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '자료는 031-111-2222 에 있습니다.\n문의 : 041-123-4567', html: '' }).phone, '041-123-4567', '라벨 없는 번호보다 라벨 있는 번호가 먼저');
});

test('extract — 인용된 답장 속 번호·이름은 뽑지 않는다', () => {
  const quoted = P.extract({ who: '', from: 'p@korea.kr', subject: '', html: '',
    text: '확인했습니다.\n> 푸른 담당자 : 라마바\n> 전화 041-000-0000\n-----Original Message-----\n담당자 : 사아자\n전화 041-111-2222' });
  assert.equal(quoted.phone, '');
  assert.equal(quoted.officer, '');
  const on = P.extract({ who: '', from: 'p@korea.kr', subject: '', html: '',
    text: '확인했습니다.\n\nOn Mon, 3 Nov 2026 at 10:00, 누구 <a@b.c> wrote:\n전화 041-111-2222' });
  assert.equal(on.phone, '');
});

test('extract — 본문이 html 뿐이어도(text 가 빔) 뽑는다', () => {
  const r = P.extract({ who: '', from: 'p@korea.kr', subject: '', text: '',
    html: '<p>담당자&nbsp;:&nbsp;가나다</p><p>전화&nbsp;<b>041-123-4567</b></p>' });
  assert.equal(r.officer, '가나다');
  assert.equal(r.phone, '041-123-4567');
});

test('extract — 아무 단서도 없으면 네 칸이 모두 빈 글이다(채움 글자를 넣지 않는다)', () => {
  const r = P.extract({ who: '', from: '', subject: '', text: '', html: '' });
  P.FIELDS.forEach(k => { assert.equal(r[k], '', k); assert.equal(r.src[k], '', k); });
  assert.doesNotThrow(() => P.extract(null));
  assert.doesNotThrow(() => P.extract({}));
});

test('diff — fill·same·change·miss, 전화는 숫자만·이메일은 소문자·나머지는 공백 정리로 견준다', () => {
  const cur = { org: '', officer: '가나다', phone: '041-123-4567', email: 'A@Korea.kr' };
  const next = { org: '천안지청', officer: '라마바', phone: '0411234567', email: 'a@korea.kr' };
  const d = {};
  P.diff(cur, next).forEach(x => { d[x.k] = x; });
  assert.equal(d.org.state, 'fill');
  assert.equal(d.officer.state, 'change');
  assert.equal(d.phone.state, 'same');
  assert.equal(d.email.state, 'same');
  assert.equal(d.org.label, P.LABELS.org);
  assert.deepEqual(P.diff(cur, { org: '', officer: '', phone: '', email: '' }).map(x => x.state), ['miss', 'miss', 'miss', 'miss']);
  assert.equal(P.diff({ org: ' 천안  지청 ' }, { org: '천안 지청' }).find(x => x.k === 'org').state, 'same');
  assert.equal(P.diff(null, null).length, 4);
});

test('merge — 빈 칸은 채우고, 바뀐 칸은 기본 «그대로 두기», 새 값이 비면 안 덮는다, 다른 키는 가져간다, 원본은 안 바뀐다', () => {
  const cur = { org: '', officer: '가나다', phone: '', email: 'a@korea.kr', extra: 'x' };
  const next = { org: '천안지청', officer: '라마바', phone: '', email: '' };
  const out = P.merge(cur, next);
  assert.equal(out.org, '천안지청');
  assert.equal(out.officer, '가나다', '바뀐 칸은 기본으로 안 쓴다');
  assert.equal(out.phone, '');
  assert.equal(out.email, 'a@korea.kr', '새 값이 비어도 기존 값은 남는다');
  assert.equal(out.extra, 'x');
  assert.deepEqual(cur, { org: '', officer: '가나다', phone: '', email: 'a@korea.kr', extra: 'x' });
  assert.equal(P.merge(cur, next, { officer: 'new' }).officer, '라마바');
  assert.equal(P.merge(cur, next, { org: 'keep' }).org, '', '빈 칸도 «그대로 두기»를 고르면 채우지 않는다');
  assert.equal(P.merge(cur, next, { email: 'new' }).email, 'a@korea.kr', '새 값이 빈 칸으로는 «새 값 쓰기»를 골라도 안 지운다');
});
