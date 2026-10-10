'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 모듈 (2026-10-10)
 * ★ 지키는 것: 양식이 쓰는 칸만 · 밖으로 나가는 글은 가린다 · 사람이 쓴 칸은 덮지 않는다 · 지어낸 숫자는 경고
 * 공개 저장소다 — 합성 자료만(가나상사·홍길동·김가나·041-000-0000·example.com). */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/pu-gov-report-ai.js');
const R = require('../js/pu-gov-report.js');

const RK = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
const SK = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];

test('fieldsFor — 양식(파일)이 쓰는 칸만', () => {
  assert.deepEqual(A.fieldsFor('cci-north'), { rounds: RK, summary: ['inquiryDiag', 'review', 'action', 'etc'] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['visit']), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['report']), { rounds: [], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('cci-seosan'), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('techguard'), { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] });
  assert.deepEqual(A.fieldsFor('모르는양식'), { rounds: [], summary: [] });
});

test('fieldsFor — pu-gov-report buildValues 가 실제로 쓰는 칸과 같다(지도 대조)', () => {
  for (const fk of Object.keys(R.FORMS)) {
    const report = { company: {}, rounds: [{ date: '2025-09-04' }], summary: {} };
    RK.forEach((k) => { report.rounds[0][k] = 'R_' + k; });
    SK.forEach((k) => { report.summary[k] = 'S_' + k; });
    const out = JSON.stringify(R.buildValues(report, fk));
    const f = A.fieldsFor(fk);
    RK.forEach((k) => assert.equal(out.includes('R_' + k), f.rounds.includes(k), fk + ' 회차 ' + k));
    SK.forEach((k) => assert.equal(out.includes('S_' + k), f.summary.includes(k), fk + ' 종합 ' + k));
  }
});

test('mask — 개인정보 꼴은 [가림], 이름은 자리 표시로, unmask 는 이름만 되돌린다', () => {
  const names = [{ v: '(주)가나상사', as: '[해당 기업]' }, { v: '김가나', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }];
  const raw = '가나상사 홍길동 대리(041-000-0000, 010-0000-0000, 02-000-0000, 1588-0000, hong@example.com)'
    + ' · 사업자 123-45-67890 · 주민 900101-1234567 · 계좌 123-456789-01-234 · 김가나 대표 · 2025-09-04 3회 · 12명';
  const m = A.mask(raw, names);
  for (const bad of ['가나상사', '홍길동', '김가나', '041-000-0000', '010-0000-0000', '02-000-0000', '1588-0000',
    'hong@example.com', '123-45-67890', '900101-1234567', '123-456789-01-234']) {
    assert.ok(!m.text.includes(bad), bad + ' 이(가) 남았다: ' + m.text);
  }
  assert.match(m.text, /\[해당 기업\] \[담당자\] 대리/);
  assert.ok(m.text.includes('2025-09-04 3회 · 12명'), '날짜·작은 숫자는 남긴다');
  assert.deepEqual(m.back, [{ as: '[해당 기업]', v: '(주)가나상사' }, { as: '[대표자]', v: '김가나' }, { as: '[담당자]', v: '홍길동' }]);
  assert.equal(A.unmask('[해당 기업] [대표자] [담당자] [가림]', m.back), '(주)가나상사 김가나 홍길동 [가림]');
});

test('mask — 빈 이름·한 글자 이름은 건너뛴다(엉뚱한 글자를 지우지 않는다)', () => {
  const m = A.mask('가 나 다 홍길동', [{ v: '', as: '[담당자]' }, { v: '가', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }]);
  assert.equal(m.text, '가 나 다 [담당자]');
  assert.deepEqual(m.back, [{ as: '[담당자]', v: '홍길동' }]);
});

const rep = () => ({
  company: { name: '가나상사', ceo: '김가나', contact: '홍길동' },
  rounds: [
    { date: '2025-09-04', visit: true, inquiry: '', diagnosis: '', advice: '취업규칙 개정 요청 — 홍길동 대리 041-000-0000', result: '', next: '' },
    { date: '2025-10-02', visit: false, inquiry: '', diagnosis: '', advice: '', result: '', next: '' },
  ],
  summary: { inquiryDiag: '', review: '사람이 쓴 검토', action: '', etc: '', adviceAll: '', overall: '', outputs: [] },
});
const feed = () => [
  { d: '2025-09-02', kind: '받은 메일', text: '가나상사 취업규칙 검토 요청(hong@example.com)', att: [], priv: false, body: 'x'.repeat(2000) },
  { d: '2025-09-04', kind: '일정', text: '1회 · 방문 · 취업규칙 개정 요청', att: [], priv: false },
  { d: '2025-09-20', kind: '받은 메일', text: '9월 급여', att: [], priv: true },
  { d: '2025-10-02', kind: '보낸 서류', text: '임금체계 검토 의견서.hwp', att: [], priv: false },
];

test('buildRequest — 보내는 글 전부 가림·이름 바꾸기, 개인 자료·일정 줄은 빼고, 본문은 1,500자까지', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north',
    { memos: ['취업규칙 개정 요청', ''], names: [{ v: '가나상사', as: '[해당 기업]' }] });
  const all = q.system + '\n' + q.messages.map((m) => m.content).join('\n');
  for (const bad of ['가나상사', '김가나', '홍길동', '041-000-0000', 'hong@example.com', '9월 급여']) {
    assert.ok(!all.includes(bad), bad + ' 이(가) 나간다');
  }
  assert.equal(q.messages.length, 1);
  assert.equal(q.messages[0].role, 'user');
  assert.equal(q.sent, q.messages[0].content);
  assert.ok(all.includes('임금체계 검토 의견서'), '보낸 서류 이름은 보낸다');
  assert.ok(all.includes('x'.repeat(1500)) && !all.includes('x'.repeat(1501)), '본문은 1,500자까지');
  assert.deepEqual(q.back.find((b) => b.as === '[담당자]'), { as: '[담당자]', v: '홍길동' });
  const body = JSON.parse(q.sent);
  assert.equal(body.회차[0].메모, '취업규칙 개정 요청');
  assert.equal(body.회차[0].방식, '방문');
  assert.equal(body.자료.length, 2, '받은 메일 1 + 보낸 서류 1 (priv·일정 제외)');
});

test('buildRequest — 채울 칸은 비었거나 AI 가 쓴 칸만, 사람이 쓴 칸은 맥락으로만', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north', { src: { 'summary.review': 'ai' } });
  assert.ok(q.want.includes('rounds.0.inquiry'));
  assert.ok(!q.want.includes('rounds.0.advice'), '메모가 든 자문은 사람이 쓴 칸');
  assert.ok(q.want.includes('summary.review'), '전에 AI 가 쓴 칸');
  assert.ok(!q.want.includes('summary.adviceAll'), '충남북부는 adviceAll 을 안 쓴다');
  const q2 = A.buildRequest(rep(), feed(), 'cci-north', {});
  assert.ok(!q2.want.includes('summary.review'));
  assert.equal(JSON.parse(q2.sent).이미_쓴_종합.review, '사람이 쓴 검토');
  assert.ok(JSON.parse(q2.sent).채울_칸.includes('rounds.1.next'));
});

test('buildRequest — 기술보호는 회차 날짜·메모만(메일·서류·이미 쓴 칸·방식 없음)', () => {
  const q = A.buildRequest(rep(), feed(), 'techguard', { techguard: true, memos: ['취업규칙 개정 요청', ''] });
  const body = JSON.parse(q.sent);
  assert.deepEqual(body.자료, []);
  assert.deepEqual(Object.keys(body.회차[0]).sort(), ['i', '날짜', '메모'].sort());
  assert.ok(!('이미_쓴_종합' in body));
  assert.ok(!q.sent.includes('의견서') && !q.sent.includes('취업규칙 검토 요청'));
  assert.ok(q.sent.includes('2025-09-04') && q.sent.includes('취업규칙 개정 요청'));
});

test('buildRequest — system: 지어내지 말 것·기록 없음 문구·칸별 한도·JSON 만', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north', {});
  assert.match(q.system, /만들지 않는다/);
  assert.ok(q.system.includes('기록 없음 — 입력 필요'));
  assert.match(q.system, /inquiry=문의 300자/);
  assert.match(q.system, /review=검토사항\(기존\) 600자/);
  assert.ok(!/adviceAll/.test(q.system), '안 쓰는 칸은 묻지 않는다');
  assert.match(q.system, /JSON 만/);
  assert.equal(q.limits.inquiry, 300);
  const q2 = A.buildRequest(rep(), feed(), 'cci-north', { limits: { inquiry: 120 } });
  assert.match(q2.system, /inquiry=문의 120자/);
  assert.match(A.buildRequest(rep(), feed(), 'techguard', { techguard: true }).system, /diagnosis=문제점/);
});

test('parseDraft — 앞뒤 군말을 잘라 읽고, 이름을 되돌리고, 모르는 칸·틀린 회차 번호는 버린다', () => {
  const back = [{ as: '[해당 기업]', v: '가나상사' }];
  const raw = '좋습니다.\n```json\n{"rounds":[{"i":0,"inquiry":"[해당 기업] 문의\\r\\n둘째 줄","bogus":"x"},'
    + '{"i":"a","inquiry":"버림"},{"i":-1,"inquiry":"버림"},{"i":1.5,"inquiry":"버림"}],'
    + '"summary":{"overall":" 총평 ","__proto__":{"x":1},"zzz":"버림","etc":3}}\n```';
  const d = A.parseDraft(raw, back);
  assert.deepEqual(d, { rounds: [{ i: 0, inquiry: '가나상사 문의\n둘째 줄' }], summary: { overall: '총평' } });
});

test('parseDraft — 못 읽으면 parse 표시가 있는 오류', () => {
  for (const t of ['', '답할 수 없습니다', '{"rounds": [', '[1,2]', '{"rounds":[],"summary":{}}']) {
    assert.throws(() => A.parseDraft(t), (e) => e.parse === true && /AI 답을 읽지 못했습니다/.test(e.message), JSON.stringify(t));
  }
});
