'use strict';
/* 예약 발송 우선순위 레인(priorityAt) 및 핫패스 RTDB 색인 보강 검증 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MB = require('../functions/mail-bulk.js');
const RA = require('../functions/rehab-automail.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('★ 대량 발송이 밀려 있어도 단건·회생 우선 레인이 먼저 정렬되고 중복 ID는 한 번만 남는다', () => {
  const standardMap = {};
  for (let i = 0; i < MB.DRAIN_BATCH; i++) {
    standardMap['bulk_' + i] = { at: 1000 + i * 100, state: 'waiting', bulk: 'b1' };
  }
  standardMap.overlap_id = { at: 500, priorityAt: 500, state: 'waiting' };

  const priorityMap = {
    prio_late: { at: 3000, priorityAt: 3000, state: 'waiting' },
    prio_early: { at: 2000, priorityAt: 2000, state: 'waiting' },
    overlap_id: { at: 500, priorityAt: 500, state: 'waiting' },
  };

  const merged = MB.mergeScheduledBatch(priorityMap, standardMap);
  assert.deepEqual(merged.ids.slice(0, 3), ['overlap_id', 'prio_early', 'prio_late']);
  assert.equal(merged.ids.filter((id) => id === 'overlap_id').length, 1);
  assert.equal(merged.ids.length, Object.keys(standardMap).length + 2);
});

test('★ 실패 재시도·중단 격리·옛 실패 파킹 시 우선순위 줄의 priorityAt도 함께 갱신하고 대량 줄은 오염시키지 않는다', () => {
  const now = 1_700_000_000_000;
  const prioRow = { state: 'sending', at: now - 1000, priorityAt: now - 1000 };
  const bulkRow = { state: 'sending', at: now - 1000, bulk: 'b1' };

  const pFail1 = MB.deliveryFailure(prioRow, now, 'timeout');
  assert.equal(pFail1.at, now + MB.RETRY_DELAY_MS);
  assert.equal(pFail1.priorityAt, now + MB.RETRY_DELAY_MS);

  const bFail1 = MB.deliveryFailure(bulkRow, now, 'timeout');
  assert.equal(bFail1.at, now + MB.RETRY_DELAY_MS);
  assert.equal(Object.prototype.hasOwnProperty.call(bFail1, 'priorityAt'), false);

  const pLast = MB.deliveryFailure(Object.assign({}, prioRow, { attemptCount: MB.MAX_DELIVERY_ATTEMPTS - 1 }), now, 'fail');
  assert.equal(pLast.at, MB.PARKED_AT);
  assert.equal(pLast.priorityAt, MB.PARKED_AT);

  const pUncertain = MB.uncertainDelivery(prioRow, now);
  assert.equal(pUncertain.priorityAt, MB.PARKED_AT);
  const bUncertain = MB.uncertainDelivery(bulkRow, now);
  assert.equal(Object.prototype.hasOwnProperty.call(bUncertain, 'priorityAt'), false);

  const pParked = MB.parkOldFailure({ state: 'failed', at: now - 5000, priorityAt: now - 5000 }, now);
  assert.equal(pParked.at, MB.PARKED_AT);
  assert.equal(pParked.priorityAt, MB.PARKED_AT);
  const bParked = MB.parkOldFailure({ state: 'failed', at: now - 5000 }, now);
  assert.equal(Object.prototype.hasOwnProperty.call(bParked, 'priorityAt'), false);
});

test('★ 단건 예약(sendMaterialMail)·회생 자동(queueRow)은 priorityAt을 싣고 sendScheduledMail은 병렬 조회·병합한다', () => {
  const idx = read('functions/index.js');
  const sendMat = idx.slice(idx.indexOf('exports.sendMaterialMail'), idx.indexOf('exports.sendScheduledMail'));
  assert.match(sendMat, /priorityAt:\s*at/);

  const sendSched = idx.slice(idx.indexOf('exports.sendScheduledMail'), idx.indexOf('exports.rulesLawWatch'));
  assert.match(sendSched, /orderByChild\("at"\)\.endAt\(now\)\.limitToFirst\(/);
  assert.match(sendSched, /orderByChild\("priorityAt"\)\.startAt\(1\)\.endAt\(now\)\.limitToFirst\(MB\.PRIORITY_BATCH\)/);
  assert.match(sendSched, /MB\.mergeScheduledBatch\(/);
  assert.match(sendSched, /row\.priorityAt != null/);

  const qRow = RA.queueRow({ name: '테스트', ceo: '대표', kind: 'rehab', email: 'a@b.co.kr', toName: '테스트' }, 1000, 2000);
  assert.equal(qRow.at, 2000);
  assert.equal(qRow.priorityAt, 2000);
});

test('★ RTDB 보안규칙에 핫패스 4개 색인(.indexOn)이 반영되었고 기존 권한이 보존된다', () => {
  for (const rel of ['docs/firebase-rules-전체-적용본.json', 'docs/rules-paste.json']) {
    const rules = JSON.parse(read(rel)).rules;
    assert.ok(rules.work_erp.items['.indexOn'].includes('coid'), rel + ': work_erp.items coid 색인 누락');
    assert.equal(rules.work_erp.items['.write'], rules.work_erp.$k['.write'], rel + ': work_erp.items 쓰기 권한 유지');
    assert.deepEqual(rules.work_erp.items.$k2, rules.work_erp.$k.$k2, rel + ': work_erp.items 하위 쓰기 권한 유지');

    assert.ok(rules.data.finance_income.v['.indexOn'].includes('sourceKind'), rel + ': finance_income.v sourceKind 색인 누락');
    assert.equal(rules.data.finance_income['.read'], rules.data.finance_expense['.read'], rel + ': finance_income 읽기 권한 유지');
    assert.equal(rules.data.finance_income['.write'], rules.data.finance_expense['.write'], rel + ': finance_income 쓰기 권한 유지');

    assert.ok(rules.hanaSmsBridge.inbox.$uid['.indexOn'].includes('rawHash'), rel + ': hanaSmsBridge.inbox rawHash 색인 누락');
    assert.equal(rules.hanaSmsBridge['.read'], undefined, rel + ': hanaSmsBridge 기본 비공개 유지');
    assert.equal(rules.hanaSmsBridge['.write'], undefined, rel + ': hanaSmsBridge 기본 비공개 유지');

    assert.ok(rules.pucards.scheduled['.indexOn'].includes('priorityAt'), rel + ': pucards.scheduled priorityAt 색인 누락');
  }
});
