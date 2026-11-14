/* 푸른등기 계산(js/pu-deungi-core.js) — 지어낸 법인으로 «규칙»을 본다 (2026-11-14)
   ⚠ 사람·주소·번호는 모두 지어낸 것이다(공개 저장소). 주민번호 뒷자리는 «뻔한 가짜»(1234567·2234567)만 쓴다.
   무엇을 못 박나: 지분 양도 금액이 사라지거나 생기지 않는다 · 대표사원이 없어지면 막는다 · 정관이 안 바뀌면 인가 서류를 빼고
   · 기한은 인가증 받은 날부터 2주일 · 3개월 지난 증명서를 알린다 · 주민번호 뒷자리는 «받은 것»만 서류에 들어간다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-deungi-core.js');

function 법인() {
  return {
    firm: { name: '가나 노무법인', regNo: '000000', hq: '점검도 점검시 점검로 1, 3층', hqCharter: '점검도 점검시', court: '점검지방법원 등기과', authority: '점검지방고용노동청장' },
    members: [
      { id: 'm1', name: '점검대표', birth: '700101', addr: '점검시 가로 1', invest: { cash: 15000000 }, rep: true },
      { id: 'm2', name: '점검노무', birth: '800101', addr: '점검시 나로 2', invest: { cash: 15000000 }, rep: true },
      { id: 'm3', name: '점검사원', birth: '900101', addr: '점검시 다로 3', invest: { labor: true } },
    ],
    branches: [
      { id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검시 가지로 1', no: 1 },
      { id: 'b3', name: '나무분사무소', alias: '나무지사', addr: '점검시 나무로 3', no: 3 },
    ],
  };
}
function 건(changes, extra) {
  return Object.assign({ id: 'DG-T1', title: '시험 등기', meeting: { date: '2026-11-20', time: '10:00' }, changes }, extra || {});
}
const 현금합 = (ms) => ms.reduce((s, m) => s + C.normInvest(m.invest).cash, 0);

test('★ 퇴사 사원 지분을 양도하면 출자 현금 합계가 그대로다 — 사라지거나 생기지 않는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { cash: 0 } },
    { id: 'l', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'new:j', amount: 10000000 }, { member: 'm1', amount: 5000000 }] } },
  ]));
  assert.deepEqual(a.errors, []);
  assert.equal(현금합(a.members), 현금합(법인().members), '양도 전후 현금 출자 합계가 달라졌다');
  assert.ok(a.left.some((m) => m.id === 'm2'), '퇴사 사원이 퇴사 목록에 없다');
  assert.ok(!a.members.some((m) => m.id === 'm2'), '퇴사 사원이 남아 있다');
  assert.ok(a.events.some((e) => e.type === 'repOut' && e.byLeave), '대표사원이 퇴사하면 대표사원 퇴임이 저절로 들어가야 한다');
  assert.ok(a.events.some((e) => e.type === 'share' && e.member === 'm1'), '지분을 양수한 기존 사원의 출자 변경이 등기할 사항에 없다');
});

test('양도 금액 합계가 출자금과 다르면 서류를 만들지 않는다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'l', type: 'leave', member: 'm1', share: { mode: 'transfer', to: [{ member: 'm2', amount: 1000 }] } }]));
  assert.ok(a.errors.length >= 1);
});

test('★ 변경 뒤 대표사원이 한 명도 없으면 막는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'o1', type: 'repOut', member: 'm1' }, { id: 'o2', type: 'repOut', member: 'm2' },
  ]));
  assert.ok(a.errors.some((e) => /대표사원/.test(e)));
});

test('사원이 2명 아래로 줄거나 사무소보다 적으면 경고한다(공인노무사법 사원 요건)', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'l1', type: 'leave', member: 'm3' },
    { id: 'l2', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'm1', amount: 15000000 }] } },
  ]));
  assert.ok(a.warnings.some((w) => /제7조의3/.test(w)), '사원 2명 요건 경고가 없다');
  assert.ok(a.warnings.some((w) => /제7조의7/.test(w)), '사무소마다 사원 상근 경고가 없다');
});

test('★ 대표사원만 바뀌면 정관은 그대로 — 인가 서류(신구대비·이유서·인가신청·변경정관)를 빼고, 기한은 총회일부터', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'r', type: 'repIn', member: 'm3' }]));
  assert.equal(a.charterChanged, false);
  const plan = C.docPlan(a, { today: '2026-11-21' });
  ['compare', 'reason', 'apply', 'charter'].forEach((k) => assert.equal(plan.find((d) => d.key === k).need, false, k + ' 는 필요 없어야 한다'));
  assert.equal(plan.find((d) => d.key === 'accept').need, true, '취임승낙서가 빠졌다');
  const dl = C.deadline(a, '2026-11-21');
  assert.equal(dl.due, C.addDays('2026-11-20', C.DEADLINE_DAYS));
});

test('★ 정관이 바뀌면 기한은 «인가증 받은 날 + 2주일» — 지나면 지연 사유서가 서류에 들어간다', () => {
  const ch = [{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }];
  const a1 = C.applyChanges(법인(), 건(ch));
  assert.equal(a1.charterChanged, true);
  assert.equal(C.deadline(a1, '2026-11-21').due, '', '인가증 날짜가 없으면 기한을 지어내지 않는다');
  const a2 = C.applyChanges(법인(), 건(ch, { dates: { approvalGet: '2026-12-01' } }));
  const d2 = C.deadline(a2, '2026-12-20');
  assert.equal(d2.due, C.addDays('2026-12-01', C.DEADLINE_DAYS));
  assert.equal(d2.overdue, true);
  assert.equal(C.docPlan(a2, { today: '2026-12-20' }).find((d) => d.key === 'delay').need, true);
  assert.equal(C.docPlan(a2, { today: '2026-12-02' }).find((d) => d.key === 'delay').need, false);
});

test('신·구조문 대비표는 실제로 글이 바뀐 조문만 싣는다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }]));
  const rows = C.compareRows(a);
  assert.deepEqual(rows.map((r) => r.no), [3]);
  assert.ok(rows[0].neu.length > rows[0].old.length, '새 분사무소 줄이 늘지 않았다');
});

test('★ 분사무소를 폐지해도 정관 제3조의 번호는 «삭제»로 남는다(번호를 당기지 않는다)', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'x', type: 'brClose', branch: 'b1' }]));
  const neu = C.articles(a)[3].neu.join('\n');
  assert.match(neu, /1\. - 삭 제 -/);
  assert.match(neu, /3\. 나무지사/);
});

test('★ 주민번호 뒷자리는 «받은 것»만 들어간다 — 안 받으면 빈칸, 등기부 미리보기는 가린다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'r', type: 'repIn', member: 'm3' }]));
  const masked = JSON.stringify(C.regItems(a));
  assert.doesNotMatch(masked, /\d{6}-\d{7}/, '번호를 받지 않았는데 뒷자리가 나왔다');
  const full = JSON.stringify(C.regItems(a, { m3: '1234567' }));
  assert.match(full, /900101-1234567/);
  assert.match(C.articles(a)[5].neu.join('\n'), /700101-_______/, '받지 않은 뒷자리는 손으로 적을 빈칸이어야 한다');
});

test('★ 등기 건·현황을 정리하면 주민번호 뒷자리·모르는 칸이 남지 않는다', () => {
  const b = C.normBase({ members: [{ id: 'm1', name: '점검', birth: '700101-1234567', addr: 'x', rrnBack: '1234567' }] });
  assert.equal(b.members[0].birth, '700101');
  assert.ok(!('rrnBack' in b.members[0]));
  const c = C.normCase({ id: 'DG-1', rrn: { m1: '1234567' }, changes: [{ id: 'j', type: 'join', name: '새', birth: '9501011234567', rrnBack: '1234567' }] });
  assert.ok(!('rrn' in c));
  assert.equal(c.changes[0].birth, '950101');
  assert.doesNotMatch(JSON.stringify(c), /1234567/);
});

test('정관 본문이 있으면 제3·5·6조만 갈아 끼우고 개정 연혁을 한 줄 더한다', () => {
  const 정관 = ['정 관', '(2001. 01. 01. 제정)', '제1조【명 칭】', '가나', '제3조【사무소의 소재지】', '옛 사무소', '', '제4조【공고방법】', '공고',
    '제 2 장 사원과 출자', '제5조【사원의 성명과 주소】', '옛 사원', '제6조【출자의 목적, 가격 및 이행】', '옛 출자', '제7조【준용법규】', '준용'].join('\n');
  const a = C.applyChanges(법인(), 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }]));
  const r = C.charterFull(정관, a, null, '2026-12-01');
  assert.deepEqual(r.replaced.sort(), [3, 5, 6]);
  assert.doesNotMatch(r.text, /옛 사무소|옛 사원|옛 출자/);
  assert.match(r.text, /제4조【공고방법】\n공고/, '바꾸지 않을 조문이 다쳤다');
  assert.match(r.text, /\(2026\. 12\. 01\. 개정\)/);
  assert.deepEqual(C.charterFull('제1조 명칭', a, null, '').missing, [3, 5, 6]);
});

test('★ 필요서류 — 법무사 안내 줄이 있고, 발급 3개월이 지나면 알린다', () => {
  const c = 건([{ id: 'l', type: 'leave', member: 'm3' }], { dates: { file: '2026-12-10' }, checks: { corpCert: { ok: true, issued: '2026-08-01' } } });
  const a = C.applyChanges(법인(), c);
  const items = C.checklist(a);
  assert.ok(items.filter((x) => x.src === '법무사').length >= 5, '법무사 안내 줄이 모자란다');
  const corp = items.find((x) => x.key === 'corpCert');
  assert.equal(C.staleCheck(corp, a.c.checks.corpCert, a, '2026-12-10').stale, true);
  assert.equal(C.staleCheck(corp, { issued: '2026-11-01' }, a, '2026-12-10').stale, false);
  assert.ok(items.some((x) => x.key === 'leaveCert:m3'), '퇴사 사원 인감증명서 줄이 없다');
  const p = C.checkProgress(a, '2026-12-10');
  assert.equal(p.done, 1); assert.equal(p.stale, 1);
});

test('등기 완료 반영 — 새 사원·분사무소는 영구 id 를 받고, 퇴사·폐지는 빠지고, 기록이 한 줄 는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } },
    { id: 'l', type: 'leave', member: 'm3' }, { id: 'x', type: 'brClose', branch: 'b1' },
  ], { dates: { done: '2026-12-15' } }));
  const nb = C.nextBase(a);
  assert.ok(nb.members.every((m) => !/^new:/.test(m.id)), '새 사원 id 에 new: 가 남았다');
  assert.equal(new Set(nb.members.map((m) => m.id)).size, nb.members.length, '사원 id 가 겹친다');
  assert.ok(!nb.members.some((m) => m.name === '점검사원'));
  assert.ok(!nb.branches.some((x) => x.id === 'b1'));
  assert.equal(nb.history.length, 1);
  assert.equal(nb.asOf, '2026-12-15');
});

test('같은 사원을 두 번 퇴사시키거나 이미 나간 사원을 고르면 막는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'l1', type: 'leave', member: 'm3' }, { id: 'l2', type: 'leave', member: 'm3' }, { id: 'ad', type: 'addr', member: 'm3', addr: 'y' },
  ]));
  assert.ok(a.errors.length >= 2);
});

test('날짜 도구 — 달 끝·윤년을 넘겨도 3개월이 맞다', () => {
  assert.equal(C.addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(C.addMonths('2027-11-30', 3), '2028-02-29');
  assert.equal(C.addDays('2026-12-25', 14), '2027-01-08');
  assert.equal(C.isDate('2026-02-30'), false);
});
