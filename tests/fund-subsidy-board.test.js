'use strict';
/* 지원금 전체 보드 «기금별 진행 요약» (대표 지시 2026-10-31, 목업 승인 「추천대로」 — A안)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·금액은 전부 지어낸 것이다.
 * node --test tests/fund-subsidy-board.test.js */
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
function grabVar(name) {          // 줄 맨 앞 «var NAME=[ … ];»
  const i = SRC.indexOf('\nvar ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 var 가 없다: ' + name);
  const j = SRC.indexOf('\n];', i);
  assert.ok(j > i, 'var 끝을 못 찾음: ' + name);
  return SRC.slice(i + 1, j + 3);
}
const B = (() => {
  const box = {};
  new Function([
    grabFn('num'), grabFn('siteContribOf'), grabFn('subDueDate'), grabFn('subStepState'), grabFn('subRemitStatus'),
    grabVar('SUB_STEPS'), grabVar('SUB_REQ_DOCS'),
    "var SUB_SITE_DOCS=[['sme','중소기업확인서'],['reg','등기부등본'],['bizno','사업자등록증']];",
    grabFn('subProgress'), grabVar('SB_FILTERS'),
    'this.prog=subProgress; this.filters=SB_FILTERS; this.steps=SUB_STEPS;',
  ].join('\n')).call(box);
  return box;
})();

const F = (sub) => ({ years: { 2026: { subsidy: sub || {} } } });
const TODAY = '2026-10-31';
const run = (f, D) => B.prog(f, 2026, Object.assign({ steps: {}, remit: {}, sites: {}, sy: {}, chk: {} }, D || {}), TODAY);

test('기록이 하나도 없으면 «신청 전» — 첫 단계가 지금 할 차례', () => {
  const p = run(F());
  assert.equal(p.started, false);
  assert.equal(p.nDone, 0);
  assert.equal(p.total, B.steps.length);
  assert.equal(p.next.k, 'apply');
  assert.equal(p.cells[0], 'n');
  assert.equal(p.finished, false);
});

test('해당 없음(보완 요구·취소 이의)은 건너뛰고 다음 단계를 지금 차례로 본다', () => {
  const p = run(F({ request_amount: 1000 }), { steps: { 2026: { apply: { done: true }, attach: { done: true }, plan: { done: true } } } });
  assert.equal(p.nDone, 3);
  assert.equal(p.started, true);
  assert.equal(p.next.k, 'notice');
  // 보완(4번째)·취소 이의(9번째)는 점선(x), 결정 통지는 파랑(n), 나머지는 대기(w)
  assert.deepEqual(p.cells, ['d', 'd', 'd', 'x', 'n', 'w', 'w', 'w', 'x']);
});

test('기한 — 사람이 넣은 날짜에서만 계산하고, 지났으면 «기한 지남»이 먼저 나온다', () => {
  // 결정 통지 2026-09-01 → 지급신청 기한 +30일 = 2026-10-01, 오늘(10-31)은 지났다
  const steps = { 2026: { apply: { done: true }, attach: { done: true }, plan: { done: true }, notice: { done: true, date: '2026-09-01' } } };
  const p = run(F({ request_amount: 1000 }), { steps });
  assert.equal(p.next.k, 'payreq');
  assert.equal(p.next.late, true);
  assert.equal(p.next.due, '2026-10-01');
  assert.equal(p.late, true);
  assert.equal(p.cells[5], 'l');
  // 날짜를 모르면 지어내지 않는다 — 기한 없음, 지남도 아님
  const q = run(F({ request_amount: 1000 }), { steps: { 2026: { apply: { done: true }, attach: { done: true }, plan: { done: true }, notice: { done: true } } } });
  assert.equal(q.next.k, 'payreq'); assert.equal(q.next.due, ''); assert.equal(q.late, false);
});

test('칸에 값이 있으면 저절로 완료 — 결정액·입금일·집행액', () => {
  const steps = { 2026: { apply: { done: true }, attach: { done: true }, plan: { done: true } } };
  const p = run(F({ request_amount: 1000, decided_amount: 900, paid_date: '2026-06-01', spent_amount: 900 }), { steps });
  assert.equal(p.st.notice.done, true);
  assert.equal(p.st.paid.done, true);
  assert.equal(p.st.settle.done, true);
  assert.equal(p.next.k, 'payreq');       // 지급신청서(사람이 체크) 만 남았다
  const all = run(F({ request_amount: 1000, decided_amount: 900, paid_date: '2026-06-01', spent_amount: 900 }),
    { steps: { 2026: { apply: { done: true }, attach: { done: true }, plan: { done: true }, payreq: { done: true } } } });
  assert.equal(all.finished, true);
  assert.equal(all.next, null);
});

test('★ 첨부서류는 진행표와 같은 셈 — 기금 필수 서류와 참여사 서류가 모두 체크되면 자동 완료', () => {
  const sites = { a: { name: '예시 가' }, b: { name: '예시 나' }, c: { name: '예시 다', status: 'closed' } };   // 탈퇴(c)는 세지 않는다
  const fund = {};
  const fneedKeys = ['apply', 'charter', 'bizplan', 'subplan', 'taxid', 'contrib', 'oath', 'chk'];
  fneedKeys.forEach((k) => { fund[k] = 1; });
  const site = { a: { sme: 1, reg: 1, bizno: 1 }, b: { sme: 1, reg: 1, bizno: 1 } };
  const ok = run(F({ request_amount: 1 }), { sites, chk: { 2026: { fund, site } } });
  assert.equal(ok.st.attach.done, true);
  // 한 장이라도 빠지면 완료가 아니다
  const miss = run(F({ request_amount: 1 }), { sites, chk: { 2026: { fund, site: { a: site.a, b: { sme: 1, reg: 1 } } } } });
  assert.equal(miss.st.attach.done, false);
  // 참여사 서류가 다 있어도 기금 필수 서류가 빠지면 완료가 아니다
  const nofund = run(F({ request_amount: 1 }), { sites, chk: { 2026: { fund: { apply: 1 }, site } } });
  assert.equal(nofund.st.attach.done, false);
});

test('출연 확인 — 약정이 있는 곳만 세고, 입금 확인(ok)한 곳이 몇 곳인지', () => {
  const sites = { a: { name: '예시 가', contrib: 100 }, b: { name: '예시 나' }, c: { name: '예시 다', contrib: 50 }, d: { name: '예시 라', status: 'closed', contrib: 70 } };
  const sy = { 2026: { b: { contrib: 200 } } };                                   // b 는 그 해 칸에 약정
  const remit = { 2026: { a: { amt: 100, ok: true }, b: { amt: 200 }, gov: { amt: 300, ok: true } } };   // b 는 «확인 전»
  const p = run(F({ gov_contrib: 300 }), { sites, sy, remit });
  assert.deepEqual(p.remit, { n: 4, ok: 2 });                                     // a·b·c + 지자체, 탈퇴 d 는 뺀다
  const none = run(F(), { sites: { z: { name: '예시 자' } } });                    // 약정이 하나도 없으면 센 곳이 없다
  assert.deepEqual(none.remit, { n: 0, ok: 0 });
});

test('위쪽 칩 — 기한 지남·결정 대기·입금 확인 전·정산 남음·완료', () => {
  const by = (k) => B.filters.find((x) => x[0] === k);
  assert.deepEqual(B.filters.map((x) => x[0]), ['late', 'wait', 'remit', 'settle', 'done']);
  const base = { apply: { done: true }, attach: { done: true }, plan: { done: true } };
  const wait = run(F({ request_amount: 1 }), { steps: { 2026: base } });
  assert.equal(by('wait')[3](wait), true);                  // 신청은 했고 결정 통지는 아직
  const decided = run(F({ request_amount: 1, decided_amount: 1 }), { steps: { 2026: base } });
  assert.equal(by('wait')[3](decided), false);
  assert.equal(by('settle')[3](decided, {}, { decided_amount: 1 }), true);   // 결정은 났고 정산은 남음
  assert.equal(by('settle')[3](decided, {}, {}), false);                      // 결정액이 없으면 정산할 것도 없다
  const rem = run(F(), { sites: { a: { name: '예시', contrib: 10 } } });
  assert.equal(by('remit')[3](rem), true);
  assert.equal(by('late')[3](rem), false);
});

test('배선 — 보드는 진행 계산을 쓰고, 탭에 들어올 때마다 새로 읽으며, 쓰기는 하지 않는다', () => {
  const panel = grabFn('subBoardPanel');
  assert.match(panel, /subProgress\(/);
  assert.match(panel, /_sbLoad\(\)/);
  assert.match(grabFn('goSubTab'), /t==='board'\)\s*SB\.data=null/);
  const load = grabFn('_sbLoad');
  assert.ok(!/\.(set|update|remove|push)\(/.test(load), '보드 읽기는 쓰지 않는다');
  assert.match(load, /subsidy_steps/); assert.match(load, /subsidy_remit/); assert.match(load, /subsidy_chk/);
  // 규칙은 SUB_STEPS 한 곳 — 보드가 단계·기한을 따로 들고 있지 않다
  assert.ok(!/SUB_STEPS\s*=\s*\[/.test(panel + grabFn('subProgress')));
  // 목록 맨 앞 체크칸·번호, 선택 일괄 단추(복사는 하되 보내지 않는다)
  assert.match(panel, /sbPick\(/); assert.match(panel, /sbCopy\(\)/);
  assert.match(grabFn('sbCopy'), /_copyText\(/);
  assert.ok(!/fetch\(|sendMail|mailto:/.test(grabFn('sbCopy')));
});
