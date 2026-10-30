'use strict';
/* 지원금 신청·정산 — 출연 구성 확인 · 서류 진행표 · 연도별 (대표 지시 2026-10-30, 목업 승인 「추천대로」 = A안)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·금액은 전부 지어낸 것이다(목업의 가짜 자료 그대로).
 * node --test tests/fund-subsidy-ledger.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, '상수가 없다: ' + name);
  return SRC.slice(i, SRC.indexOf('];', i) >= 0 && SRC.slice(i, i + 20).includes('[') ? SRC.indexOf('];', i) + 2 : SRC.indexOf(';', i) + 1);
}
const B = (() => {
  const box = {};
  new Function([
    grabDecl('SUB_STEPS'), grabDecl('SUB_GOV_RE'),
    grabFn('num'), grabFn('subDueDate'), grabFn('subStepState'), grabFn('subNormCo'), grabFn('subRemitMatch'), grabFn('subRemitStatus'),
    'this.steps=SUB_STEPS; this.due=subDueDate; this.state=subStepState; this.norm=subNormCo; this.match=subRemitMatch; this.status=subRemitStatus;',
  ].join('\n')).call(box);
  return box;
})();
const D = (k) => B.steps.find((s) => s.k === k);

test('기한 — 날짜에 N일을 더하고, 날짜가 아니면 비운다(지어내지 않는다)', () => {
  assert.equal(B.due('2026-06-10', 30), '2026-07-10');
  assert.equal(B.due('2026-12-20', 30), '2027-01-19', '해를 넘긴다');
  assert.equal(B.due('2026-02-20', 7), '2026-02-27');
  assert.equal(B.due('', 30), '');
  assert.equal(B.due('2026-6-1', 30), '', '형식이 다르면 비운다');
  assert.equal(B.due(undefined, 7), '');
});

test('★ 지급신청 기한 = 결정 통지일 + 30일 — 통지일을 넣기 전에는 규칙 글만', () => {
  const none = B.state(D('payreq'), {}, {}, '2026-08-01');
  assert.equal(none.due, ''); assert.equal(none.late, false); assert.equal(none.label, '대기');
  const st = { notice: { date: '2026-06-10' } };
  const ok = B.state(D('payreq'), st, {}, '2026-07-01');
  assert.equal(ok.due, '2026-07-10'); assert.equal(ok.late, false); assert.equal(ok.label, '기한 2026-07-10');
  const late = B.state(D('payreq'), st, {}, '2026-07-11');
  assert.equal(late.late, true); assert.equal(late.label, '기한 지남'); assert.equal(late.kind, 'dg');
  const done = B.state(D('payreq'), { notice: { date: '2026-06-10' }, payreq: { done: true } }, {}, '2026-08-01');
  assert.equal(done.late, false, '끝낸 단계는 늦었다고 하지 않는다'); assert.equal(done.label, '완료');
});

test('칸에 값이 있으면 그 단계는 자동 완료 — 결정액·교부일·집행액, 0 은 값이다', () => {
  assert.equal(B.state(D('notice'), {}, { decided_amount: 174000000 }, 'x').auto, true);
  assert.equal(B.state(D('notice'), {}, { decided_amount: '' }, 'x').done, false);
  assert.equal(B.state(D('paid'), {}, { paid_date: '2026-07-20' }, 'x').done, true);
  assert.equal(B.state(D('settle'), {}, { spent_amount: 0 }, 'x').done, true, '0 도 입력한 값이다');
  assert.equal(B.state(D('settle'), {}, {}, 'x').done, false);
});

test('보완 요구 — 요구일+7일, 제출일을 넣으면 완료, 아무것도 없으면 «해당 없음»', () => {
  assert.equal(B.state(D('supp'), {}, {}, '2026-05-01').label, '해당 없음');
  const a = B.state(D('supp'), { supp: { date: '2026-05-01' } }, {}, '2026-05-05');
  assert.equal(a.due, '2026-05-08'); assert.equal(a.late, false);
  assert.equal(B.state(D('supp'), { supp: { date: '2026-05-01' } }, {}, '2026-05-09').late, true);
  assert.equal(B.state(D('supp'), { supp: { date: '2026-05-01', date2: '2026-05-06' } }, {}, '2026-05-30').done, true);
});

test('회사 이름 비교 — 법인 꼬리표·공백·괄호를 걷는다', () => {
  assert.equal(B.norm('㈜가나정밀'), '가나정밀');
  assert.equal(B.norm('주식회사 가나 정밀'), '가나정밀');
  assert.equal(B.norm('(주)가나정밀 '), '가나정밀');
  assert.equal(B.norm('가나정밀(주)'), '가나정밀');
});

test('★ 장부 입금 → 제안 — 이름이 맞는 입금만, 긴 이름 우선, 동률은 건너뜀, 지자체는 말로 찾음', () => {
  const sites = [{ id: 's1', name: '㈜가나정밀' }, { id: 's2', name: '㈜가나정밀기계' }, { id: 's3', name: '다라전기' }, { id: 's4', name: '라마' }];
  const tx = [
    { memo: '가나정밀 출연금', deposit: 16000000, date: '2026-03-12' },
    { memo: '가나정밀 2차', deposit: 400000, date: '2026-03-20' },
    { memo: '가나정밀기계(주) 출연', deposit: 5000000, date: '2026-03-15' },   // 더 긴 이름에 간다
    { memo: '다라전기', deposit: 10800000, date: '2026-03-14' },
    { memo: '다라전기', withdraw: 100, deposit: 0, date: '2026-03-15' },        // 출금은 무시
    { memo: '○○시청 보조금', deposit: 100000000, date: '2026-04-02' },
    { memo: '모르는 입금', deposit: 777, date: '2026-04-03' },
  ];
  const m = B.match(tx, sites);
  assert.deepEqual(m.s1, { amt: 16400000, date: '2026-03-20', n: 2 });
  assert.deepEqual(m.s2, { amt: 5000000, date: '2026-03-15', n: 1 });
  assert.deepEqual(m.s3, { amt: 10800000, date: '2026-03-14', n: 1 });
  assert.deepEqual(m.gov, { amt: 100000000, date: '2026-04-02', n: 1 });
  assert.equal(m.s4, undefined, '입금이 없으면 제안도 없다');
  assert.equal(Object.keys(m).length, 4, '모르는 입금은 어디에도 넣지 않는다');
  const tie = B.match([{ memo: '가나', deposit: 1 }], [{ id: 'a', name: '가나' }, { id: 'b', name: '(주)가나' }]);
  assert.deepEqual(tie, {}, '이름이 같아 가를 수 없으면 제안하지 않는다');
  assert.deepEqual(B.match([{ memo: 'x', deposit: 5 }], [{ id: 'a', name: '가' }]), {}, '한 글자 이름은 비교하지 않는다');
});

test('출연 한 줄의 상태 — 확인 전엔 «확인 전», 확인하면 약정과 견준다', () => {
  assert.deepEqual(B.status({ pledge: 100, remit: { amt: 100, ok: true } }), { k: 'ok', t: '입금 확인' });
  assert.deepEqual(B.status({ pledge: 100, remit: { amt: 60, ok: true } }), { k: 'warn', t: '40 부족' });
  assert.deepEqual(B.status({ pledge: 100, remit: { amt: 100 } }), { k: 'warn', t: '확인 전' });
  assert.deepEqual(B.status({ pledge: 100, remit: {} }), { k: 'dg', t: '미입금' });
  assert.deepEqual(B.status({ pledge: 0, remit: {} }), { k: '', t: '약정 없음' });
  assert.deepEqual(B.status({ pledge: 100, remit: { amt: 150, ok: true } }), { k: 'ok', t: '입금 확인' }, '약정보다 많이 내도 모자라지 않는다');
});

test('배선 — 신청·정산 화면에 붙고, 서식·저장 위치·도움말이 이어져 있다', () => {
  assert.match(grabFn('subsidyApplyPanel'), /subLedgerHTML\(f\)/, '신청·정산 패널 끝에 붙는다');
  const html = grabFn('subLedgerHTML');
  ['hlp(\'sub.ledger\')', 'subRemitFind()', 'subRemitApply(', 'subStepSet(', 'subStartNext()', 'changeYear('].forEach((k) => assert.ok(html.includes(k), '화면에 ' + k));
  assert.ok(/'sub\.ledger':\{t:/.test(SRC), '도움말 항목');
  // 단계마다 쓰는 서식이 서식 자료실에 실제로 있다
  const docSub = SRC.slice(SRC.indexOf('var DOC_SUB='), SRC.indexOf(']];', SRC.indexOf('var DOC_SUB=')) + 3);
  B.steps.forEach((d) => (d.forms || []).forEach((f) => assert.ok(docSub.includes("'" + f[0] + "'"), d.k + ': 서식 ' + f[0] + ' 가 DOC_SUB 에 없다')));
  // 저장은 새 두 곳뿐 — 신청액·결정액 같은 기존 칸은 patchSub(지자체 출연 한 칸)만 건드린다
  ['subStepSet', 'subRemitSet', 'subRemitApply'].forEach((n) => {
    const f = grabFn(n);
    assert.ok(!/years\/|\/funds\//.test(f), n + ': 기금 본문은 건드리지 않는다');
  });
  assert.match(grabFn('_subLedPut'), /subsidy_steps|NS\+'\/'\+node/, '저장 위치는 node 이름으로');
  assert.ok(SRC.includes("_subLedPut(L,'subsidy_steps'") && SRC.includes("_subLedPut(L,'subsidy_remit'"));
});

test('작년 값 불러오기 — 결정액·집행액·교부일은 올해 일이라 가져오지 않는다', () => {
  const f = grabFn('copyPrevSubsidy');
  assert.ok(f.includes("c[0]!=='decided_amount'") && f.includes("c[0]!=='spent_amount'") && f.includes("c[0]!=='paid_date'"));
  assert.ok(f.includes("['paid_date','decided_amount','spent_amount']"), '세 칸은 비운다');
});
