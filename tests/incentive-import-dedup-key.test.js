/* 인센티브 가져오기 — 같은 파일을 두 번 올려도 겹치지 않는다 (2026-10-11 검토 A-1 · 2026-11-11 통합엔진 연동)
   새 줄의 열쇠는 「입금일|업체명_유형|수령인」인데 있던 줄은 「입금일|유형|수령인」으로만 세면,
   항목에 밑줄(_)이 든 줄이 걸러지지 않는다 → 2026-06-18 264쌍(3억 325만 원)이 겹쳤다.
   규칙: 있던 줄(옛 sourceKind:'incentive' 및 신규 sourceKind:'perf-adjust')도 «업체명_유형» 모양으로 대조해
         두 번 올리면 already_synced 로 걸러내고 중복 생성하지 않는다. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sync = require('../js/pu-hr-excel-sync.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('있던 인센티브 줄을 «업체명_유형» 열쇠로도 센다 — 두 번 올리면 걸러진다', () => {
  assert.match(src, /<script src="js\/pu-hr-excel-sync\.js\?v=\d+"><\/script>/);

  const users = [{ sid: 'A-001', name: '가나다', status: 'active' }];
  const existing = [
    {
      id: 'fi-old-1',
      sourceKind: 'incentive',
      date: '2023-01-16',
      companyName: '가나상사',
      kind: '체당금수수료',
      perfShares: [{ sid: 'A-001', name: '가나다', amount: 150000 }]
    }
  ];
  const parsed = Sync.parseIncentiveSheet([
    ['상여구분', '입금일', '항목', '입금금액', '부가세 제외', '성과금 비율', '금액', '수령인'],
    ['1월', '2023-01-16', '가나상사_체당금수수료', 1100000, 1000000, '15%', 150000, '가나다']
  ], { fallbackYear: 2023 });

  assert.equal(parsed.rows.length, 1);
  const plans = Sync.planIncentiveSync(parsed.rows, {
    users,
    financeIncomes: existing,
    lockedPayrollMonths: []
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].status, 'already_synced', '두 번째 가져오기가 «업체명_유형» 줄을 이미 있음으로 봐야 한다');
  assert.equal(plans[0].checked, false);

  const built = Sync.buildIncentiveUpserts(plans, { users, financeIncomes: existing });
  assert.equal(built.upserts.length, 0, '이미 있는 줄은 중복 저장하면 안 된다');
});
