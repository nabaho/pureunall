'use strict';
/* 메일 속 입사·퇴사·급여자료를 급여데이터함 «할 일»로 (대표 승인 2026-10-03 ㉠)
   실행: node --test tests/hr-intake.test.js

   ⚠ 예시 이름·사업장은 모두 가짜다(홍길동·가나상사). 실제 메일로 맞춘 «꼴»만 옮겼다.
   ⚠ 기한 날짜는 «법이 정한 값»이라 박아 둔다 — 건강보험 14일 이내(국민건강보험법 제8조②·제10조②),
     고용·연금 다음 달 15일(고용보험법 시행령 제7조① · 국민연금법 시행규칙 제6조①). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const H = require(path.join(__dirname, '..', 'js', 'pu-hr-intake.js'));

const at = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0).getTime();
const row = (subject, preview, o) => Object.assign({
  subject: subject, preview: preview || '', at: at(2026, 10, 2), companyId: 'co-1', companyName: '가나상사', from: 'a@gana.example'
}, o || {});

/* ── 꼬리표 ─────────────────────────────────────────────────────────── */
test('제목에 「입사」·「퇴사」가 있으면 확정이다', () => {
  assert.deepEqual(H.kindsOf(row('10월 입사자 서류 송부')).kinds, ['in']);
  assert.equal(H.kindsOf(row('10월 입사자 서류 송부')).sure, true);
  assert.ok(H.kindsOf(row('9월 퇴사자 상실신고 요청')).kinds.includes('out'));
  assert.ok(H.kindsOf(row("4대보험 '상실' / '취득' 인원입니다")).kinds.includes('in'));
  assert.ok(H.kindsOf(row("4대보험 '상실' / '취득' 인원입니다")).kinds.includes('out'));
});

test('「신입사원」 속의 입사는 입사 신고가 아니다', () => {
  assert.ok(!H.kindsOf(row('신입사원 평가 프로세스 검토 요청')).kinds.includes('in'));
});

test('본문에만 있거나 여린 말이면 «짐작»으로 묻고, 할 일은 안 선다', () => {
  const k = H.kindsOf(row('문의드립니다', '이번 달에 한 명 그만둔다고 합니다'));
  assert.deepEqual(k.guess, ['out']);
  assert.equal(k.sure, false);
  assert.equal(H.tasksOf({ m1: row('문의드립니다', '이번 달에 한 명 그만둔다고 합니다') }, {}, {}, at(2026, 10, 3)).length, 0);
});

test('짐작은 «종류마다» 따로다 — 확실한 퇴사까지 묻히지 않는다', () => {
  const r = row('퇴사자 상실신고 요청', '새로 들어온 분도 다음 주에 보내드릴게요');
  const k = H.kindsOf(r);
  assert.deepEqual(k.guess, ['in']);
  const t = H.tasksOf({ m1: r }, {}, {}, at(2026, 10, 3));
  assert.deepEqual(t.map(x => x.kind), ['out']);
});

test('서류 회신·우리 메일에 단 답장은 꼬리표만 — 묻지도 할 일도 안 세운다', () => {
  for (const s of ['8월 중도퇴사 원천징수영수증', '퇴직소득원천징수영수증_홍길동.pdf',
                   '[RE][푸른노무법인] 가나상사_중도퇴사자 홍길동님 9월 급여대장']) {
    const k = H.kindsOf(row(s));
    assert.ok(k.kinds.includes('out'), s + ' — 꼬리표는 붙는다');
    assert.deepEqual(k.guess, [], s + ' — 묻지 않는다');
    assert.deepEqual(k.info, ['out'], s + ' — 알림 꼬리표');
    assert.equal(H.tasksOf({ m1: row(s) }, {}, {}, at(2026, 10, 3)).length, 0, s + ' — 할 일 없음');
  }
});

test('급여자료·확인요청은 꼬리표일 뿐 할 일이 안 선다', () => {
  const r = row('9월 근태내역 보내드립니다 확인 부탁드립니다');
  assert.ok(H.kindsOf(r).kinds.includes('pay'));
  assert.ok(H.kindsOf(r).kinds.includes('ask'));
  assert.equal(H.tasksOf({ m1: r }, {}, {}, at(2026, 10, 3)).length, 0);
});

/* ── 이름 제안 ──────────────────────────────────────────────────────── */
test('이름은 정해진 꼴에서만 집는다', () => {
  assert.equal(H.nameOf(row('입사자 홍길동 서류 송부'), 'in'), '홍길동');
  assert.equal(H.nameOf(row('가나상사 홍길동님 중도퇴사'), 'out'), '홍길동');
  assert.equal(H.nameOf(row('홍길동 퇴사.pdf'), 'out'), '홍길동');
  assert.equal(H.nameOf(row('[가나] 퇴사신고서 입니다.(홍길동, 김철수)'), 'out'), '홍길동·김철수');
});

test('★ 이름이 아닌 것을 이름으로 집지 않는다', () => {
  assert.equal(H.nameOf(row('[가나] 입사신고서 입니다.'), 'in'), '', '「신고서」');
  assert.equal(H.nameOf(row('퇴사자 상실신고 관련 문의'), 'out'), '', '「퇴사자」의 「사자」');
  assert.equal(H.nameOf(row('가나상사 퇴사자 사무장 확인'), 'out'), '', '직함');
});

test('「○○님」과 「○○」는 한 사람이다', () => {
  assert.equal(H.nameOf(row('퇴사자 홍길동님 서류', '홍길동님 퇴사 처리 부탁'), 'out'), '홍길동');
});

test('사업장 이름 조각은 사람이 아니다', () => {
  assert.equal(H.nameOf(row('가나상사(나다점) 입사자 서류', '', { companyName: '가나상사(나다점)' }), 'in'), '');
});

/* ── 날짜 ───────────────────────────────────────────────────────────── */
test('날짜는 입사·퇴사 글에서, 받은 날 60일 안의 것만 믿는다', () => {
  assert.equal(H.dateOf(row('9/30 퇴사자 상실신고'), 'out'), '2026-09-30');
  assert.equal(H.dateOf(row('신규입사자 2026.10.05 입사'), 'in'), '2026-10-05');
  /* 본문에 옛 입사일이 같이 적힌 퇴사 메일 — 옛 날짜는 버리고 받은 날로 간다 */
  assert.equal(H.dateOf(row('외국인근로자 퇴사', '입사일 2025.06.04 근로자 퇴사 처리'), 'out'), '');
  /* 「24.10월 스케줄」 같은 것은 날이 아니다 — 입퇴사 글이 아니면 안 본다 */
  assert.equal(H.dateOf(row('24.10월 스케줄'), 'in'), '');
});

test('해를 넘나드는 날짜 — 1월에 받은 「12/28 퇴사」는 지난해다', () => {
  assert.equal(H.dateOf(row('12/28 퇴사자', '', { at: at(2027, 1, 5) }), 'out'), '2026-12-28');
});

/* ── 기한 (법이 정한 값) ────────────────────────────────────────────── */
test('입사 — 건강보험 14일 이내(그날 포함), 고용·연금 다음 달 15일', () => {
  const d = H.dueOf('in', '2026-10-01');
  assert.equal(d.health, '2026-10-14');   // 검사고정-허용 국민건강보험법 제8조② 취득일부터 14일
  assert.equal(d.monthly, '2026-11-15');  // 검사고정-허용 고용보험법 시행령 제7조① 다음 달 15일
  assert.equal(d.first, d.health, '가장 이른 것은 늘 건강보험이다');
});

test('퇴사 — 자격은 다음 날 바뀐다. 그날부터 14일, 다음 달 15일', () => {
  const d = H.dueOf('out', '2026-09-30');
  assert.equal(d.health, '2026-10-14');   // 검사고정-허용 같은 법 제9조①3 다음 날 변동 + 제10조② 14일
  assert.equal(d.monthly, '2026-11-15');  // 검사고정-허용 상실일(10/1)이 속한 달의 다음 달 15일
});

test('남은 날 — 오늘이 기한이면 0, 지나면 음수', () => {
  assert.equal(H.daysLeft('2026-10-14', at(2026, 10, 14)), 0);
  assert.ok(H.daysLeft('2026-10-14', at(2026, 10, 20)) < 0);
});

/* ── 할 일 세우기 ───────────────────────────────────────────────────── */
test('같은 메일은 언제 세어도 같은 번호 — 화면을 열어도 아무것도 안 쓴다', () => {
  const log = { 'k1_@gana_example': row('입사자 홍길동 서류') };
  const a = H.tasksOf(log, {}, {}, at(2026, 10, 3)), b = H.tasksOf(log, {}, {}, at(2026, 10, 9));
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].id, H.taskId('k1_@gana_example', 'in'));
});

test('사업장을 모르는 메일은 할 일로 안 세운다(붙일 줄이 없다)', () => {
  assert.equal(H.tasksOf({ m1: row('입사자 서류', '', { companyId: '' }) }, {}, {}, at(2026, 10, 3)).length, 0);
});

test('시작일 전 메일은 안 센다 — 사람이 확정한 것은 센다', () => {
  const old = row('입사자 서류', '', { at: H.START_MS - 864e5 });
  assert.equal(H.tasksOf({ m1: old }, {}, {}, at(2026, 10, 3)).length, 0);
  assert.equal(H.tasksOf({ m1: old }, { m1: { kinds: ['in'] } }, {}, at(2026, 10, 3)).length, 1);
});

test('같은 건의 답장은 한 건 — «답장 n» 으로 붙는다', () => {
  const log = {
    a: row('가나상사 홍길동 퇴사', '', { at: at(2026, 10, 1) }),
    b: row('RE: 가나상사 홍길동 퇴사', '', { at: at(2026, 10, 2) })
  };
  const t = H.tasksOf(log, {}, {}, at(2026, 10, 3));
  assert.equal(t.length, 1);
  assert.equal(t[0].mailKey, 'a', '먼저 온 메일이 할 일이 된다');
  assert.equal(t[0].replies, 1);
});

test('사람이 확정한 꼬리표가 이긴다 — 「해당 없음」이면 할 일이 사라진다', () => {
  const log = { m1: row('퇴사자 상실신고 요청') };
  assert.equal(H.tasksOf(log, { m1: { kinds: [] } }, {}, at(2026, 10, 3)).length, 0);
  assert.equal(H.tasksOf({ m2: row('문의', '그만둔다고 합니다') }, { m2: { kinds: ['out'] } }, {}, at(2026, 10, 3)).length, 1);
});

test('★ 「해당 없음」은 «글자»로 적힌다 — 파이어베이스가 빈 배열을 버려도 안 되살아난다', () => {
  const log = { m1: row('퇴사자 상실신고 요청') };
  assert.equal(H.kindsText([]), '');
  assert.equal(H.tasksOf(log, { m1: { kinds: H.kindsText([]) } }, {}, at(2026, 10, 3)).length, 0,
    '빈 글자도 «사람이 고른 것»이다');
  assert.deepEqual(H.confirmedKinds({ kinds: 'in,out' }), ['in', 'out']);
  assert.equal(H.confirmedKinds({}), null, '칸이 없으면 자동 꼬리표로');
});

test('처리함·이름·날짜 고침은 상태 칸이 이긴다', () => {
  const log = { m1: row('입사자 홍길동 서류') };
  const id = H.taskId('m1', 'in');
  const t = H.tasksOf(log, {}, { [id]: { doneAt: 1, doneBy: '가', name: '김철수', date: '2026-10-05' } }, at(2026, 10, 3))[0];
  assert.equal(t.done, true);
  assert.equal(t.name, '김철수');
  assert.equal(t.nameGuess, false, '사람이 고친 이름은 제안이 아니다');
  assert.equal(t.date, '2026-10-05');
  assert.equal(H.tasksOf(log, {}, { [id]: { removed: true } }, at(2026, 10, 3)).length, 0);
});

test('안 끝난 것이 먼저, 기한이 이른 것이 먼저', () => {
  const log = {
    a: row('입사자 서류', '', { at: at(2026, 10, 2) }),
    b: row('9/25 퇴사자 상실', '', { at: at(2026, 9, 26) }),
    c: row('나다 입사자 서류', '', { at: at(2026, 9, 25) })
  };
  const t = H.tasksOf(log, {}, { [H.taskId('c', 'in')]: { doneAt: 1 } }, at(2026, 10, 3));
  assert.equal(t[t.length - 1].mailKey, 'c', '끝난 것은 맨 뒤');
  assert.equal(t[0].mailKey, 'b', '기한이 이른 것이 맨 앞');
});

test('사업장별로 접어 센다 — 끝난 것은 안 센다', () => {
  const log = {
    a: row('입사자 서류', '', { companyId: 'co-1' }),
    b: row('퇴사자 서류', '', { companyId: 'co-1' }),
    c: row('퇴사자 상실', '', { companyId: 'co-2' })
  };
  const m = H.byCompany(H.tasksOf(log, {}, { [H.taskId('c', 'out')]: { doneAt: 1 } }, at(2026, 10, 3)));
  assert.equal(m['co-1'].in, 1);
  assert.equal(m['co-1'].out, 1);
  assert.equal(typeof m['co-1'].left, 'number');
  assert.equal(m['co-2'], undefined);
});

test('사업장 메일 — 그 사업장·그 기간만, 새것이 위', () => {
  const log = {
    a: row('9월 근태', '', { at: at(2026, 9, 3) }),
    b: row('10월 근태', '', { at: at(2026, 10, 2) }),
    c: row('남의 것', '', { companyId: 'co-2' })
  };
  const m = H.mailsOf(log, {}, 'co-1', at(2026, 9, 1), at(2026, 11, 1));
  assert.deepEqual(m.map(x => x.key), ['b', 'a']);
  assert.ok(Array.isArray(m[0].guess) && Array.isArray(m[0].info));
});
