/* 경력관리 «요청 메일» 모듈(js/kcareer-mailreq.js) — 알아보기 · 기한 · 셈 · 훑기(가짜 DB 에서 실제로 돌린다)
   ⚠ 메일은 모두 지어낸 것이다(저장소가 공개 — 실제 기관 이름·주소를 쓰지 않는다). 주소는 example.org·example.com 만. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../js/kcareer-mailreq.js');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const DAY = 864e5;
const NOW = new Date(2026, 10, 9, 15, 0).getTime();          // 2026-11-09 15:00 (이 컴퓨터의 시간대)
const at = (m, d, h) => new Date(2026, m - 1, d, h || 9, 0).getTime();
const SUBJ = '[가나사회경제연구원] 전문가(멘토) 인력풀 참여 사전동의서';
const FORM = '(양식)전문가 풀 참여 동의서.hwp';
const PREVIEW = '안녕하세요 가나사회경제연구원 담당자입니다. 평소 저희 기관의 지원 활동에 협력해 주셔서 감사드립니다.';
const BODY = '안녕하세요\n이에 인력풀 참여 의사를 여쭙고자 사전동의서를 첨부하여 송부드립니다.\n\n- 제출기한 : 2026년 11월 16일 월요일 18시까지\n- 회신방법 : 작성 후 이메일 reply@example.org 로 동의서 파일 회신\n\n감사합니다.';
const row = (o) => Object.assign({ s: SUBJ, an: [FORM], p: PREVIEW, f: '가나연구원', e: 'req@example.org', a: 1, d: at(11, 9, 13), r: 0, w: 0 }, o || {});

/* ── 알아보기 ── */
test('동의서 — 제목·양식 첨부만으로 알아본다(본문을 열기 전 — 기한은 아직 모름)', () => {
  const h = Q.detect(row());
  assert.ok(h, '요청으로 알아봐야 한다');
  assert.deepEqual(h.kinds, ['consent']);
  assert.equal(h.deadline, null, '본문을 안 열었으면 기한을 지어내지 않는다');
  assert.ok(h.why.length >= 2 && h.why.every((w) => typeof w === 'string'), '근거를 남긴다');
  assert.deepEqual(h.forms, [FORM]);
});
test('동의서 — 본문을 열면 기한(날짜+시각)과 회신 주소를 찾는다', () => {
  const h = Q.detect(row(), { text: BODY, refMs: at(11, 9, 13) });
  assert.deepEqual(h.deadline, { date: '2026-11-16', time: '18:00', text: h.deadline.text, guess: false });
  assert.equal(h.replyTo, 'reply@example.org');
});
test('경력 요청 — 제목에 «강사 이력서 제출»', () => {
  const h = Q.detect({ s: '강사 이력서 제출 요청', an: [], p: '', d: NOW });
  assert.ok(h); assert.deepEqual(h.kinds, ['career']);
});
test('경력 요청 — 첨부 이름만으로도(경력증명서 양식)', () => {
  const h = Q.detect({ s: '서류 안내', an: ['경력증명서 양식.hwpx'], p: '', d: NOW });
  assert.ok(h); assert.ok(h.kinds.includes('career'));
});
test('기타 요청 — 서류 말 + 요청 말투 + (기한 또는 양식)', () => {
  const h = Q.detect({ s: '교육 안내', an: ['신청서.hwp'], p: '참가 신청서를 11월 20일까지 작성하여 회신 바랍니다', d: NOW });
  assert.ok(h); assert.deepEqual(h.kinds, ['other']);
  assert.equal(h.deadline.date, '2026-11-20');
});
test('요청이 아닌 것 — 평범한 메일 · 광고 · 우리가 보낸 것', () => {
  assert.equal(Q.detect({ s: '회의 일정 공유', an: [], p: '내일 오후 회의입니다', d: NOW }), null);
  assert.equal(Q.detect({ s: '(광고) 개인정보 동의 안내', an: [FORM], p: '', d: NOW }), null, '광고 표시가 있으면 동의서라는 말이 있어도 아니다');
  assert.equal(Q.detect({ s: '개인정보 동의서', an: [FORM], p: '', e: 'staff@pureun.kr', d: NOW }), null, '우리 주소에서 온 것은 요청이 아니다');
  assert.equal(Q.detect({ s: '뉴스레터 11월호', an: [], p: '이번 달 소식 — 동의서 양식 변경 안내', d: NOW }), null);
});
test('본문에만 단서가 있으면 «요청 말투 + (양식 또는 기한)»까지 겹쳐야 한다 — 말만 스치면 아니다', () => {
  assert.equal(Q.detect({ s: '안내드립니다', an: [], p: '지난번 동의서 건 감사합니다', d: NOW }), null, '요청 말투도 기한도 없다');
  assert.equal(Q.detect({ s: '안내드립니다', an: [], p: '동의서 관련 문의 주세요', d: NOW }), null, '요청 말투만 있고 양식·기한이 없다');
  const h = Q.detect({ s: '안내드립니다', an: [], p: '', d: NOW }, { text: '개인정보 동의서를 11월 20일까지 작성해 회신 부탁드립니다.', refMs: NOW });
  assert.ok(h && h.kinds.includes('consent'), '본문 단서 + 요청 말투 + 기한이면 알아본다');
});
test('«첨부하여»만으로는 요청이 아니다 — 첨부 메일마다 있는 말이라 요청 말투에 넣지 않았다', () => {
  assert.equal(Q.ACT.test('자료를 첨부하여 보냅니다'), false);
  assert.equal(Q.detect({ s: '자료 공유', an: ['증빙자료.pdf'], p: '증빙자료를 첨부하여 공유합니다', d: NOW }), null);
});
test('답장(RE:)은 요청 말투나 새 기한이 없으면 요청이 아니다 — 서명해 돌려보낸 사본이 «새 요청»으로 울리면 안 된다', () => {
  assert.equal(Q.detect({ s: 'RE: 개인정보 동의서', an: ['동의서(서명본).hwp'], p: '서명하여 첨부합니다', d: NOW }), null, '사본만 돌려보낸 답장');
  assert.equal(Q.detect({ s: '회신: 동의서 건', an: ['동의서.pdf'], p: '', d: NOW }), null);
  const again = Q.detect({ s: 'RE: 개인정보 동의서', an: ['동의서(수정).hwp'], p: '양식이 바뀌어 다시 작성 후 회신 부탁드립니다', d: NOW });
  assert.ok(again && again.kinds.includes('consent'), '다시 요청하는 답장은 요청이다');
  const dl = Q.detect({ s: 'RE: 개인정보 동의서', an: ['동의서.hwp'], p: '', d: NOW }, { text: '제출기한이 2026-11-20 로 연장되었습니다', refMs: NOW });
  assert.ok(dl, '새 기한이 적힌 답장은 요청이다');
});
test('답장 제외는 «모든 종류»에 — 본문 단서·기타 요청도 RE: 이면 달라는 말이나 새 기한이 있어야 한다', () => {
  assert.equal(Q.detect({ s: 'RE: 사업자등록증 사본 제출', an: ['사업자등록증.pdf'], p: '첨부합니다', d: NOW }), null, '기타 요청(서류 말) 답장');
  assert.equal(Q.detect({ s: 'RE: 안내드립니다', an: ['동의서.hwp'], p: '', d: NOW }, { text: '개인정보 동의서를 작성하여 보냅니다', refMs: NOW }), null, '본문 단서 + 요청 말투 + 양식인데 달라는 말·새 기한이 없는 답장');
  assert.ok(Q.detect({ s: 'RE: 안내드립니다', an: [], p: '', d: NOW }, { text: '개인정보 동의서를 11월 20일까지 작성해 보냅니다', refMs: NOW }), '새 기한이 적힌 답장은 요청이다');
  const ask = Q.detect({ s: 'RE: 사업자등록증 사본 제출', an: ['사업자등록증.pdf'], p: '다시 제출 부탁드립니다', d: NOW });
  assert.ok(ask && ask.kinds.includes('other'), '달라는 말이 있는 답장은 요청이다');
});
test('첨부가 «있기만» 하다고 요청이 아니다 — 양식 파일이거나 요청 말투·기한이 있어야 한다', () => {
  assert.equal(Q.detect({ s: '경력확인서 관련', an: ['IMG_0001.jpg'], a: 1, p: '', d: NOW }), null, '사진 한 장 첨부');
  assert.equal(Q.detect({ s: '경력확인서 관련', an: [], a: 3, p: '', d: NOW }), null, '첨부 이름을 모르는 메일도 첨부 수만으로는 안 올린다');
});
test('알아본 종류는 정해진 차례로 나온다', () => {
  const h = Q.detect({ s: '동의서 및 경력증명서 제출', an: [], p: '', d: NOW });
  assert.deepEqual(h.kinds, ['consent', 'career']);
});

/* ── 기한 ── */
test('기한 — «기한 말 가까이 있는 날짜»만 잡는다(행사일·옛 일정은 기한 모름)', () => {
  assert.equal(Q.deadlineOf('행사는 2026년 12월 3일에 열립니다.', NOW), null);
  assert.equal(Q.deadlineOf('지난 11월 2일 회의 결과입니다.', NOW), null);
  assert.equal(Q.deadlineOf('제출기한: 2026-11-18', NOW).date, '2026-11-18');
});
test('기한 — 날짜가 여럿이면 기한 말이 붙은 것, 범위(~)는 «끝 날짜»', () => {
  assert.equal(Q.deadlineOf('행사는 11월 20일입니다. 접수는 11월 10일 ~ 11월 16일까지 받습니다.', NOW).date, '2026-11-16');
  assert.equal(Q.deadlineOf('11월 12일 설명회, 제출 마감 11월 14일', NOW).date, '2026-11-14');
});
test('기한 — 시각 표현 세 가지(18시 · 오후 6시 · 18:00)', () => {
  assert.equal(Q.deadlineOf('마감 11월 16일 18시까지', NOW).time, '18:00');
  assert.equal(Q.deadlineOf('마감 11월 16일 오후 6시까지', NOW).time, '18:00');
  assert.equal(Q.deadlineOf('마감 2026.11.16 18:30', NOW).time, '18:30');
  assert.equal(Q.deadlineOf('마감 11월 16일까지', NOW).time, '', '시각이 없으면 비운다(그날 끝까지)');
});
test('기한 — 기한 말이 «범위 앞»에 붙어도 끝 날짜가 기한이다(시작일을 기한으로 잡지 않는다)', () => {
  assert.equal(Q.deadlineOf('제출기한: 2026.11.10 ~ 2026.11.16', NOW).date, '2026-11-16');
  assert.equal(Q.deadlineOf('신청기간: 11월 10일 ~ 11월 16일까지', NOW).date, '2026-11-16');
  assert.equal(Q.deadlineOf('접수 마감 2026-11-10 - 2026-11-16', NOW).date, '2026-11-16');
  assert.equal(Q.deadlineOf('제출 마감 11월 10일부터 11월 16일', NOW).date, '2026-11-16');
});
test('기한 — 「오후 6:00」은 18:00 · 「24시까지」는 그날 끝(하루 앞당기지 않는다) · 「24:30」 같은 없는 시각은 버리고 날짜만', () => {
  assert.equal(Q.deadlineOf('마감 11월 16일 오후 6:00', NOW).time, '18:00');
  assert.equal(Q.deadlineOf('마감 11월 16일 오전 12:30', NOW).time, '00:30');
  const e = Q.deadlineOf('마감 11월 16일 24시까지', NOW);
  assert.equal(e.date, '2026-11-16'); assert.equal(e.time, '23:59');
  const bad = Q.deadlineOf('마감 11월 16일 24:30', NOW);
  assert.equal(bad.date, '2026-11-16'); assert.equal(bad.time, '', '없는 시각은 시각 없이 날짜만');
});
test('기한 — 연도가 없으면 «받은 날 이후 가장 가까운» 해로(12월 말에 온 1월 기한은 다음 해)', () => {
  assert.equal(Q.deadlineOf('마감 1월 10일', at(12, 28)).date, '2027-01-10');
  assert.equal(Q.deadlineOf('마감 11월 20일', at(11, 9)).date, '2026-11-20');
  assert.equal(Q.deadlineOf('마감 11월 20일', at(11, 9)).guess, true, '연도를 «짐작했다»고 표시한다');
});
test('기한 — 없는 날짜(2월 30일)는 버린다', () => {
  assert.equal(Q.deadlineOf('마감 2026년 2월 30일', NOW), null);
});
test('기한 셈 — D-n · D-day · 기한 지남 (달력 날로 센다)', () => {
  const dl = { date: '2026-11-16', time: '18:00' };
  assert.equal(Q.ddayOf(dl, at(11, 9, 23)).label, 'D-7');
  assert.equal(Q.ddayOf(dl, at(11, 16, 1)).label, 'D-day');
  assert.equal(Q.ddayOf(dl, at(11, 18)).label, '기한 지남 2일');
  assert.equal(Q.ddayOf(null, NOW).label, '');
  assert.ok(isNaN(Q.dueMs({ date: '2026-02-xx' })));
});
test('회신 주소 — 「회신·송부·제출」 가까이 적힌 것, 우리 주소는 뺀다', () => {
  assert.equal(Q.replyOf('문의는 a@example.com, 서류는 이메일 b@example.org 로 회신 바랍니다'), 'b@example.org');
  assert.equal(Q.replyOf('서류 파일은 d@example.org 로 회신 바랍니다'), 'd@example.org', '주소 «뒤»의 단서(로 회신)만 있어도 찾는다');
  assert.equal(Q.replyOf('문의 a@example.com 입니다. 또 다른 안내입니다'), '', '단서 없는 주소는 회신처로 보지 않는다');
  assert.equal(Q.replyOf('회신: team@pureun.kr'), '', '우리 주소는 회신처가 아니다');
  assert.equal(Q.replyOf('주소가 없습니다'), '');
});

/* ── 본문 다듬기 ── */
test('본문 — html 만 와도 글자로 바꾼다 · 답장 꼬리(인용)는 자른다', () => {
  assert.match(Q.bodyOf({ html: '<div>제출기한: <b>2026년 11월 16일</b><br>까지</div><script>x</script>' }), /2026년 11월 16일/);
  assert.doesNotMatch(Q.bodyOf({ html: '<script>var d="2026년 1월 1일 마감"</script><p>안녕</p>' }), /2026/);
  const t = Q.bodyOf({ text: '확인했습니다. 11월 20일까지 보내겠습니다.' + ' 감사합니다.'.repeat(12) + '\n-----Original Message-----\n제출기한: 2026년 1월 5일' });
  assert.doesNotMatch(t, /1월 5일/, '인용된 지난 메일의 날짜를 이 메일 것으로 읽지 않는다');
});

/* ── 한 건의 기록 ── */
test('기록 — id·엔티티·시각을 갖고, 본문은 담지 않는다', () => {
  const h = Q.detect(row(), { text: BODY, refMs: NOW });
  const it = Q.makeItem('INBOX', '123', row(), h, NOW);
  assert.equal(it.id, 'INBOX~123'); assert.equal(it.entityType, 'kcareer_mailreq');
  assert.equal(it.createdAt, NOW); assert.equal(it.updatedAt, NOW);
  assert.equal(it.st, 'new');
  assert.ok(!('p' in it) && !('text' in it) && !('body' in it), '본문·미리보기를 기록에 담지 않는다');
  assert.ok(!JSON.stringify(it).includes('감사드립니다'));
});
test('기록 — 이미 답장한 메일(w)은 «새 요청»으로 울리지 않고 확인함으로', () => {
  assert.equal(Q.makeItem('INBOX', '5', row({ w: 1 }), Q.detect(row()), NOW).st, 'doing');
});
test('기록 — 열쇠로 못 쓰는 폴더 이름이면 만들지 않는다', () => {
  assert.equal(Q.makeItem('a.b', '5', row(), Q.detect(row()), NOW), null);
  assert.equal(Q.makeItem('a/b', '5', row(), Q.detect(row()), NOW), null);
  assert.equal(Q.makeItem('INBOX', 'x5', row(), Q.detect(row()), NOW), null);
});

/* ── 알림 셈 ── */
const it = (id, st, dl, extra) => Object.assign({ id, st, deadline: dl || undefined, d: NOW, s: id }, extra || {});
test('셈 — 새 요청 · 임박 · 지남을 «한 번씩만» 센다(알림 숫자)', () => {
  const items = [
    it('a~1', 'new'),                                                   // 새 요청(기한 모름)
    it('b~2', 'new', { date: '2026-11-10' }),                            // 새 + 임박 → 한 번
    it('c~3', 'doing', { date: '2026-11-11' }),                          // 확인함이어도 임박이면 알린다
    it('d~4', 'doing', { date: '2026-11-30' }),                          // 확인함 · 한참 남음 → 안 알린다
    it('e~5', 'doing', { date: '2026-11-08' }),                          // 지남
    it('f~6', 'done', { date: '2026-11-08' }), it('g~7', 'ignored'),     // 끝난 것은 안 센다
  ];
  const s = Q.summary(items, NOW);
  assert.equal(s.open, 5); assert.equal(s.newer, 2); assert.equal(s.soon, 2); assert.equal(s.overdue, 1);
  assert.equal(s.alarm, 4, 'a·b·c·e — b 는 «새 + 임박»이라도 한 번');
  assert.equal(s.done, 1); assert.equal(s.ignored, 1); assert.equal(s.tone, 'red');
});
test('셈 — 새 요청만 있으면 amber, 알릴 것이 없으면 조용하다', () => {
  assert.equal(Q.summary([it('a~1', 'new')], NOW).tone, 'amber');
  const quiet = Q.summary([it('a~1', 'done'), it('b~2', 'doing', { date: '2026-12-31' })], NOW);
  assert.equal(quiet.alarm, 0); assert.equal(quiet.tone, ''); assert.equal(Q.summaryText(quiet), '');
  assert.match(Q.summaryText(Q.summary([it('a~1', 'new')], NOW)), /요청 메일 1건/);
});
test('셈 — 목록(배열)도, 클라우드가 돌려주는 객체도 받는다 · 이상한 값은 건너뛴다', () => {
  assert.equal(Q.summary({ x: it('x~1', 'new'), y: null, z: 'text' }, NOW).total, 1);
  assert.equal(Q.summary(null, NOW).total, 0);
});
test('차례 — 지남 → 임박 → 새 것 → 확인함 → 끝난 것', () => {
  const items = [it('done~1', 'done', null, { updatedAt: 1 }), it('doing~2', 'doing', { date: '2026-12-30' }),
    it('new~3', 'new', null, { d: NOW - DAY }), it('soon~4', 'doing', { date: '2026-11-11' }), it('over~5', 'new', { date: '2026-11-08' })];
  assert.deepEqual(Q.sortItems(items, NOW).map((x) => x.id), ['over~5', 'soon~4', 'new~3', 'doing~2', 'done~1']);
});
test('탭 — 진행 중은 새 요청+확인함, 끝난 것은 따로', () => {
  const items = [it('a~1', 'new'), it('b~2', 'doing'), it('c~3', 'done'), it('d~4', 'ignored')];
  assert.deepEqual(Q.filterItems(items, 'open').map((x) => x.id), ['a~1', 'b~2']);
  assert.deepEqual(Q.filterItems(items, 'done').map((x) => x.id), ['c~3']);
  assert.deepEqual(Q.filterItems(items, 'ignored').map((x) => x.id), ['d~4']);
  assert.equal(Q.filterItems(items, 'all').length, 4);
});
test('상태 바꾸기 — 한 번에 쓰는 update 모양 · st 와 시각만 · 이상한 id 는 버린다', () => {
  const u = Q.stateUpdate([IN + '~1', 'bad id', 'a/b~2', IN + '~3'], 'done', NOW);
  assert.deepEqual(Object.keys(u).sort(), [IN + '~1/doneAt', IN + '~1/st', IN + '~1/updatedAt', IN + '~3/doneAt', IN + '~3/st', IN + '~3/updatedAt']);
  assert.equal(u[IN + '~1/st'], 'done'); assert.equal(u[IN + '~1/doneAt'], NOW);
  assert.equal(Q.stateUpdate([IN + '~1'], 'doing', NOW)[IN + '~1/doneAt'], null, '되돌리면 처리 시각을 지운다');
  assert.deepEqual(Q.stateUpdate([IN + '~1'], 'nope', NOW), {}, '모르는 상태는 쓰지 않는다');
});

/* ── 직접 고치기(팝업) ── */
test('직접 고치기 — 고친 칸만 쓰고, 고친 칸에는 fixed 표시 · 상태·제목·보낸이는 건드리지 않는다', () => {
  const r = Q.editUpdate('INBOX~1', { kinds: ['career', 'consent'], deadline: { date: '2026-11-30', time: '17:30' }, memo: ' 담당자에게 전화 ' }, NOW);
  assert.ok(r.ok);
  assert.deepEqual(r.update['INBOX~1/kinds'], ['consent', 'career'], '정해진 차례로');
  assert.deepEqual(r.update['INBOX~1/deadline'], { date: '2026-11-30', time: '17:30', text: '직접 입력' });
  assert.equal(r.update['INBOX~1/memo'], '담당자에게 전화'); assert.equal(r.update['INBOX~1/fixed/kinds'], 1); assert.equal(r.update['INBOX~1/fixed/deadline'], 1);
  assert.equal(r.update['INBOX~1/updatedAt'], NOW);
  Object.keys(r.update).forEach((k) => assert.ok(!/\/(st|s|f|e|d|an|why|replyTo|slug|uid|createdAt)$/.test(k), k + ' 은 고치지 않는다'));
  const only = Q.editUpdate('INBOX~1', { memo: '메모만' }, NOW);
  assert.deepEqual(Object.keys(only.update).sort(), ['INBOX~1/memo', 'INBOX~1/updatedAt'], '메모만 고치면 기한·종류에 fixed 가 안 붙는다');
});
test('직접 고치기 — 기한을 «없음»으로 고칠 수 있고(null) · 없는 날짜·잘못된 시각·빈 종류·긴 메모는 거절한다', () => {
  const none = Q.editUpdate('INBOX~1', { deadline: null }, NOW);
  assert.ok(none.ok); assert.equal(none.update['INBOX~1/deadline'], null); assert.equal(none.update['INBOX~1/fixed/deadline'], 1, '없음으로 고친 것도 fixed(다시 찾아 채우지 않게)');
  assert.equal(Q.editUpdate('INBOX~1', { deadline: { date: '2026-02-30', time: '' } }, NOW).ok, false, '없는 날짜');
  assert.equal(Q.editUpdate('INBOX~1', { deadline: { date: '', time: '10:00' } }, NOW).ok, false, '날짜 없이 시각만');
  assert.equal(Q.editUpdate('INBOX~1', { deadline: { date: '2026-11-30', time: '25:00' } }, NOW).ok, false, '없는 시각');
  assert.equal(Q.editUpdate('INBOX~1', { kinds: [] }, NOW).ok, false, '종류는 하나 이상');
  assert.equal(Q.editUpdate('INBOX~1', { kinds: ['x'] }, NOW).ok, false, '모르는 종류만이면 하나도 없는 것');
  assert.equal(Q.editUpdate('INBOX~1', { memo: 'ㄱ'.repeat(Q.MEMO_MAX + 1) }, NOW).ok, false, '긴 메모');
  assert.equal(Q.editUpdate('INBOX~1', {}, NOW).ok, false, '바뀐 것이 없다');
  assert.equal(Q.editUpdate('a b/c~1', { memo: 'x' }, NOW).ok, false, '이상한 건 번호');
  const empty = Q.editUpdate('INBOX~1', { memo: '   ' }, NOW); assert.equal(empty.update['INBOX~1/memo'], null, '빈 메모는 지운다');
});
test('직접 고치기 — 사람이 고친 기한·종류는 다음 본문 보강(훑기)이 덮지 않는다', async () => {
  const f = db(); await scan(f);                                                     // 101 이 올라옴(본문은 아직 안 읽음)
  const fix = Q.editUpdate(IN + '~101', { kinds: ['other'], deadline: { date: '2026-12-24', time: '09:00' } }, NOW + 1);
  await f.ref('kcareer/U1/mailreq/items').update(fix.update);
  await scan(f, { readBody: read(BODY) });                                           // 본문에는 다른 기한·동의서 단서가 있다
  const x = items(f)[IN + '~101'];
  assert.ok(x.bodyAt, '본문은 열었다(회신 주소 등은 채운다)'); assert.equal(x.replyTo, 'reply@example.org');
  assert.equal(x.deadline.date, '2026-12-24', '고친 기한이 그대로'); assert.deepEqual(x.kinds, ['other'], '고친 종류가 그대로');
  assert.equal(x.st, 'new');
});

/* ── 훑기 — 가짜 DB 에서 실제로 돌린다 ──
   ⚠ 가짜 DB 는 열쇠를 «글자 차례»로 센다 → 번호는 세 자리로 맞춘다(진짜는 숫자 차례). 모듈은 숫자로 비교한다. */
/* 폴더 열쇠는 서버가 «안전한 이름-해시»로 만든다(functions/mail-box.js slugOf) — 점(.)이 없다 */
const IN = 'INBOX-a1b2c3d4', CU = '6_공공기관-e5f6a7b8', SENT = 'SENT-0a0a0a0a', SPAM = 'SPAM-0b0b0b0b';
function db(extra) {
  const msgs = { [IN]: {}, [CU]: {}, [SENT]: {}, [SPAM]: {} };
  msgs[IN]['101'] = row({ d: at(11, 9, 13) });                                    // 요청
  msgs[IN]['102'] = row({ s: '회의 일정', an: [], p: '내일 회의입니다', d: at(11, 9, 14) });   // 요청 아님
  msgs[IN]['103'] = row({ s: '오래된 동의서 요청', d: NOW - 60 * DAY });             // 창보다 옛것
  msgs[CU]['201'] = row({ s: '강사 이력서 제출 요청', an: [], d: at(11, 8, 10), e: 'c@example.com' });
  msgs[SENT]['301'] = row({ d: at(11, 9) });                                          // 보낸 메일함 — 훑지 않는다
  msgs[SPAM]['401'] = row({ d: at(11, 9) });
  return 만들기(Object.assign({
    mailbox: { folders: { [IN]: { kind: 'inbox', name: '받은메일함' }, [CU]: { kind: 'custom', name: '6.공공기관' },
      [SENT]: { kind: 'sent' }, [SPAM]: { kind: 'spam' } }, msgs },
  }, extra || {}));
}
const items = (fake) => fake.읽기('kcareer/U1/mailreq/items') || {};
const scan = (fake, o) => Q.scan(Object.assign({ db: fake, uid: 'U1', now: NOW }, o || {}));

test('훑기 — 받은·손으로 만든 폴더의 새 메일에서 요청만 올리고, 보낸·스팸 폴더는 안 본다', async () => {
  const f = db(); const r = await scan(f);
  assert.deepEqual(Object.keys(items(f)).sort(), [CU + '~201', IN + '~101']);
  assert.equal(r.created.length, 2); assert.equal(r.folders, 2, '폴더 둘만');
  assert.ok(!(IN + '~103' in items(f)), '창보다 옛 메일은 알리지 않는다');
  assert.equal(items(f)[IN + '~101'].st, 'new');
});
test('훑기 — 두 번째는 새로 온 것만 본다 · 같은 것을 또 만들지 않는다 · 어디까지 봤는지(cur)를 적는다', async () => {
  const f = db(); await scan(f);
  assert.equal(f.읽기('kcareer/U1/mailreq/cur/' + IN), 103, '그 폴더에서 본 가장 큰 번호');
  const r2 = await scan(f);
  assert.equal(r2.scanned, 0, '새로 온 것이 없으면 아무것도 읽지 않는다');
  assert.equal(r2.created.length, 0);
  await f.ref('mailbox/msgs/' + IN + '/104').set(row({ s: '서약서 제출 요청', d: at(11, 9, 15) }));
  const r3 = await scan(f);
  assert.equal(r3.scanned, 1); assert.deepEqual(r3.created.map((x) => x.id), [IN + '~104']);
});
test('훑기 — 사람이 바꾼 상태를 되돌리지 않는다(처리 완료로 둔 건은 그대로)', async () => {
  const f = db(); await scan(f);
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'done', NOW + 1));
  await f.ref('kcareer/U1/mailreq/cur').set(null);                       // 다른 기기가 처음부터 다시 훑는 경우
  const r = await scan(f);
  assert.equal(r.created.length, 0, '있는 건은 transaction 이 건드리지 않는다');
  assert.equal(items(f)[IN + '~101'].st, 'done');
});
test('훑기 — 이어 훑는데 받은 줄이 전부 새것이면 한 번 크게 다시 본다(많이 온 날)', async () => {
  const f = db(); await scan(f);
  for (let n = 110; n < 120; n++) await f.ref('mailbox/msgs/' + IN + '/' + n).set(row({ s: '동의서 요청 ' + n, d: at(11, 9, 15) }));
  const r = await scan(f, { perPoll: 3 });
  assert.equal(r.created.length, 10, '한 번에 3통씩만 보고 끝내면 7통을 놓친다');
});
test('훑기 — 폴더 하나를 못 읽어도 나머지는 계속 가고, 못 읽은 폴더의 cur 는 올리지 않는다', async () => {
  const f = db(); const ref0 = f.ref;
  const broken = { ref: (p) => (p === 'mailbox/msgs/' + IN ? { orderByKey: () => ({ limitToLast: () => ({ once: async () => { throw new Error('읽기 거절'); } }) }) } : ref0(p)),
    읽기: f.읽기 };
  const r = await Q.scan({ db: broken, uid: 'U1', now: NOW });
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /읽기 거절/);
  assert.ok(CU + '~201' in (f.읽기('kcareer/U1/mailreq/items') || {}), '다른 폴더는 훑는다');
  assert.equal(f.읽기('kcareer/U1/mailreq/cur/' + IN), null, '못 읽은 폴더는 다음에 다시 본다');
  assert.notEqual(f.읽기('kcareer/U1/mailreq/cur/' + CU), null);
});
test('훑기 — 로그인 전(uid 없음)이면 아무것도 안 한다', async () => {
  const f = db(); const r = await Q.scan({ db: f, uid: '', now: NOW });
  assert.equal(r.created.length, 0); assert.equal(f.쓴것.length, 0, '아무 데도 쓰지 않았다');
});
test('훑기 — 자리: 경력관리 자료 통(ls)·at 은 건드리지 않는다(다른 기기 «새 저장» 띠가 뜨지 않게)', async () => {
  const f = db(); await scan(f);
  assert.ok(f.쓴것.length > 0);
  assert.ok(f.쓴것.every((w) => /^kcareer\/U1\/mailreq\//.test(w.자리)), '쓴 자리는 모두 kcareer/{uid}/mailreq 아래');
  assert.equal(f.읽기('kcareer/U1/at'), null); assert.equal(f.읽기('kcareer/U1/ls'), null);
});

/* ── 본문 열어 보강 ── */
const read = (text, calls) => async (slug, uid) => { if (calls) calls.push(slug + ':' + uid); return { text }; };
test('본문 보강 — 기한·회신 주소를 채우고, 상태는 건드리지 않는다', async () => {
  const f = db(); await scan(f, { readBody: read(BODY) });
  const x = items(f)[IN + '~101'];
  assert.equal(x.deadline.date, '2026-11-16'); assert.equal(x.deadline.time, '18:00');
  assert.equal(x.replyTo, 'reply@example.org'); assert.equal(x.st, 'new'); assert.ok(x.bodyAt > 0);
});
test('본문 보강 — 본문에서 기한을 못 찾아도 미리보기에서 찾은 기한은 지우지 않는다', async () => {
  const f = db(); await f.ref('mailbox/msgs/' + IN + '/105').set(row({ s: '서약서 제출 요청', an: [], a: 0, p: '제출기한: 2026-11-20 까지 회신 바랍니다', d: at(11, 9, 14) }));
  await scan(f, { readBody: read('내용 없음. 감사합니다.') });
  const x = items(f)[IN + '~105'];
  assert.ok(x.bodyAt, '본문은 열었다'); assert.equal(x.deadline && x.deadline.date, '2026-11-20');
});
test('본문 보강 — 본문에서 종류가 더해지면 정해진 차례(동의서 → 경력 → 기타)로 둔다', async () => {
  const f = db(); await f.ref('mailbox/msgs/' + IN + '/106').set(row({ s: '강사 이력서 제출 요청', an: [], a: 0, p: '', d: at(11, 9, 14) }));
  await scan(f, { readBody: read('개인정보 수집·이용 동의서도 작성 후 회신 바랍니다. 2026년 11월 20일까지') });
  assert.deepEqual(items(f)[IN + '~106'].kinds, ['consent', 'career']);
});
test('★ 본문을 «기다리는 사이» 사람이 팝업에서 고쳐 저장한 기한·종류를 뒤늦은 보강이 덮지 않는다(최신 기록에 원자적으로 적용)', async () => {
  const f = db(); await scan(f);
  const slow = async () => {                                                          // 본문이 오는 사이에 사람이 팝업에서 저장한다
    await f.ref('kcareer/U1/mailreq/items').update(Q.editUpdate(IN + '~101', { kinds: ['other'], deadline: { date: '2026-12-24', time: '09:00' }, memo: '내가 고침' }, NOW + 9).update);
    return { text: BODY };
  };
  await Q.scan({ db: f, uid: 'U1', now: NOW, readBody: slow });
  const x = items(f)[IN + '~101'];
  assert.equal(x.deadline.date, '2026-12-24', '기다리는 사이 고친 기한이 그대로'); assert.deepEqual(x.kinds, ['other'], '고친 종류가 그대로'); assert.equal(x.memo, '내가 고침');
  assert.ok(x.bodyAt, '본문 보강은 했다(회신 주소 등)'); assert.equal(x.replyTo, 'reply@example.org');
});
test('본문 보강 — 그새 지워진 건은 되살리지 않는다', async () => {
  const f = db(); await scan(f);
  const gone = async () => { await f.ref('kcareer/U1/mailreq/items/' + IN + '~101').set(null); return { text: BODY }; };
  const r = await Q.scan({ db: f, uid: 'U1', now: NOW, readBody: gone });
  assert.ok(!(IN + '~101' in items(f)), '지워진 건이 보강으로 되살아나면 안 된다'); assert.ok(!r.enriched.includes(IN + '~101'));
});
test('본문 보강 — 사람이 «확인함»으로 바꾼 뒤에 채워도 상태는 그대로', async () => {
  const f = db(); await scan(f);
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'doing', NOW + 5));
  await scan(f, { readBody: read(BODY) });
  assert.equal(items(f)[IN + '~101'].st, 'doing'); assert.equal(items(f)[IN + '~101'].deadline.date, '2026-11-16');
});
test('본문 보강 — 한 번에 열 건수에 한도가 있고, 열었으면 다시 열지 않는다', async () => {
  const f = db(); for (let n = 110; n < 118; n++) await f.ref('mailbox/msgs/' + IN + '/' + n).set(row({ s: '동의서 요청 ' + n, d: at(11, 9, 15) }));
  const calls = []; await scan(f, { readBody: read(BODY, calls), bodyMax: 3 });
  assert.equal(calls.length, 3, '한도(bodyMax)만큼만 연다');
  const again = []; await scan(f, { readBody: read(BODY, again), bodyMax: 3 });
  assert.equal(again.length, 3);
  assert.ok(!again.some((c) => calls.includes(c)), '이미 연 메일은 다시 열지 않는다');
});
test('본문 보강 — 못 열면 시도 횟수만 올리고, BODY_TRY 번 뒤에는 그만둔다 · 다른 건은 계속', async () => {
  const f = db(); let n = 0;
  const bad = async (slug, uid) => { n++; if (uid === '101') throw new Error('메일 서버 응답 없음'); return { text: BODY }; };
  const r = await scan(f, { readBody: bad });
  assert.equal(r.bodyErr, 1); assert.equal(items(f)[IN + '~101'].bodyTry, 1);
  assert.ok(items(f)[CU + '~201'].bodyAt, '다른 건은 계속 읽었다');
  for (let i = 0; i < Q.BODY_TRY + 2; i++) await scan(f, { readBody: bad });
  assert.equal(items(f)[IN + '~101'].bodyTry, Q.BODY_TRY, '더는 시도하지 않는다');
  assert.ok(!items(f)[IN + '~101'].bodyAt && !items(f)[IN + '~101'].deadline, '못 읽었으면 기한을 지어내지 않는다');
});
test('본문 보강 — 처리 완료·요청 아님 건은 열지 않는다(서버를 괜히 두드리지 않는다)', async () => {
  const f = db(); await scan(f);
  await f.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'ignored', NOW + 2));
  const calls = []; await scan(f, { readBody: read(BODY, calls) });
  assert.ok(!calls.includes(IN + ':101'));
});
test('본문 열기 도우미 — 푸른메일함과 같은 서버 함수 이름 readMailMessage, peek(읽음 표시 안 함)', async () => {
  const seen = []; const rb = Q.makeReadBody(async (fn, body) => { seen.push([fn, body]); return { text: 'x' }; });
  await rb('INBOX', '101');
  assert.deepEqual(seen, [['readMailMessage', { slug: 'INBOX', uid: '101', peek: 1 }]]);
});
