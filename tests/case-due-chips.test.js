/* 달력에 «날짜로 뜨는» 것들 — 사건 마감일·단계 기한·휴직 (5걸음)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-21 「둘다」.

   ★ 왜 되살렸나
     4걸음에서 이알피 법인 대시보드를 걷어내며 그 달력의 층 셋이 함께 사라졌다.
     ①② 사건 마감일·단계 기한은 대표께서 되살리라 하셨고,
     ③ 휴직은 4걸음 보고에서 «빠뜨린» 것이라 같이 되살린다.

   ★ 이 검사가 지키는 다섯
     ① 끝난 사건은 안 그린다 (permanentArchived · closedDate)
     ② 보고 있는 달 범위 밖은 안 넣는다
     ③ 단계 기한은 «계산된 값»이라 끌어 옮길 수 없다(movable:false)
     ④ 확인 안 된 기한에 「(확인)」을 붙이고 색을 달리한다
     ⑤ 휴직은 시작일·종료일에만 — 같은 날이면 한 번만

   ⚠ 셈이 «한 곳»인지도 본다 — 이알피의 나의 업무 D-day 도 같은 셈을 쓴다.
     두 벌이 되면 법정 기한이 두 앱에서 하루 어긋날 수 있다. 그것은 사고다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const M = require(path.join(ROOT, 'js', 'pu-case-due.js'));

/* 「지노위 판정서 07-15 송달 → 10일 안에 중노위 재심」 */
const 단계표 = [
  { code: 'lrc-local', short: '지노위', name: '지노위 초심', dueDays: 10, dueFrom: 'notice', dueVerified: true },
  { code: 'wc-apply', short: '산재신청', name: '산재 신청', dueDays: 90, dueFrom: 'result', dueVerified: false },
  { code: 'no-due', short: '접수', name: '접수', dueDays: 0 }
];
const 사건하나 = (덧) => Object.assign({
  id: 'c1', title: '부당해고구제신청', caseNo: '부해-2026-001',
  companyName: '가나상사', managerMain: 'P-001'
}, 덧);

/* ── ① 끝난 사건 ── */

test('①★ 끝난 사건은 안 그린다 — 지난 일이 달력을 덮는다', () => {
  const 단계 = [{ id: 's1', code: 'lrc-local', noticeDate: '2026-09-01' }];
  const 살아있음 = M.chips({ cases: [사건하나({ stages: 단계 })], stageCatalog: 단계표,
    from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(살아있음.length, 1, '살아 있는 사건이 안 뜹니다');

  ['closedDate', 'permanentArchived'].forEach((칸) => {
    const 덧 = { stages: 단계 }; 덧[칸] = (칸 === 'closedDate') ? '2026-09-05' : true;
    const r = M.chips({ cases: [사건하나(덧)], stageCatalog: 단계표,
      from: '2026-09-01', to: '2026-09-30' });
    assert.deepStrictEqual(r, [], '★ ' + 칸 + ' 인 사건이 아직 뜹니다');
  });
});

/* ── ② 범위 ── */

test('②★ 보고 있는 범위 밖은 안 넣는다 — 안 보이는 것을 세면 「+N개 더」가 거짓이 된다', () => {
  const c = 사건하나({ stages: [{ id: 's1', code: 'lrc-local', noticeDate: '2026-09-01' }] });  // 기한 09-11
  const 안 = M.chips({ cases: [c], stageCatalog: 단계표, from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(안.length, 1);
  assert.strictEqual(안[0].date, '2026-09-11', '기한을 잘못 셉니다(송달 09-01 + 10일)');

  const 밖 = M.chips({ cases: [c], stageCatalog: 단계표, from: '2026-10-01', to: '2026-10-31' });
  assert.deepStrictEqual(밖, [], '★ 다른 달 기한이 이 달에 뜹니다');
});

test('②-2★ 앞뒤 달에 걸친 줄도 받는다 — 1일~말일로 자르면 첫 줄이 빈다', () => {
  const c = 사건하나({ stages: [{ id: 's1', code: 'lrc-local', noticeDate: '2026-08-22' }] });  // 09-01
  const r = M.chips({ cases: [c], stageCatalog: 단계표, from: '2026-08-30', to: '2026-10-10' });
  assert.strictEqual(r.length, 1, '달력 첫 줄에 걸친 날이 빠졌습니다');
});

/* ── ③ 끌어 옮길 수 없다 ── */

test('③★ 셋 다 끌어 옮길 수 없다 — 계산된 값이거나 다른 화면이 주인이다', () => {
  const r = M.chips({
    cases: [사건하나({
      stages: [{ id: 's1', code: 'lrc-local', noticeDate: '2026-09-01' }],
      deadlines: [{ date: '2026-09-15', note: '서면 제출' }]
    })],
    loa: [{ sid: 'P-002', startDate: '2026-09-03', endDate: '2026-09-20', typeLabel: '질병휴직' }],
    stageCatalog: 단계표, from: '2026-09-01', to: '2026-09-30'
  });
  assert.strictEqual(r.length, 4, '네 가지(기한·마감·휴직 시작·종료)가 안 나왔습니다');
  r.forEach((c) => {
    assert.strictEqual(c.movable, false,
      '★ ' + c.kind + ' 를 끌어 옮길 수 있습니다 — 옮기면 주인 화면과 어긋납니다');
  });
});

/* ── ④ 확인되지 않은 기한 ── */

test('④★ 확인 안 된 기한은 «(확인)»을 붙이고 색이 다르다 — 그대로 믿으면 사고다', () => {
  const 확인됨 = M.chips({
    cases: [사건하나({ stages: [{ id: 's1', code: 'lrc-local', noticeDate: '2026-09-01' }] })],
    stageCatalog: 단계표, from: '2026-09-01', to: '2026-09-30'
  })[0];
  const 아직 = M.chips({
    cases: [사건하나({ stages: [{ id: 's2', code: 'wc-apply', resultDate: '2026-07-01' }] })],
    stageCatalog: 단계표, from: '2026-09-01', to: '2026-10-31'
  })[0];

  assert.ok(확인됨.text.indexOf('(확인)') < 0, '확인된 기한에 (확인) 이 붙었습니다');
  assert.ok(아직.text.indexOf('(확인)') >= 0, '★ 확인 안 된 기한에 (확인) 이 없습니다');
  assert.notStrictEqual(확인됨.color, 아직.color, '★ 확인 여부로 색이 안 갈립니다');
  assert.match(아직.tip, /법령을 직접 확인/, '무엇을 해야 하는지 안 알려 줍니다');
});

/* ── ⑤ 휴직 ── */

test('⑤★ 휴직은 시작일·종료일에만 — 사이를 다 칠하면 달력이 덮인다', () => {
  const r = M.chips({
    loa: [{ sid: 'P-002', startDate: '2026-09-03', endDate: '2026-09-20', typeLabel: '육아휴직' }],
    users: [{ sid: 'P-002', name: '홍길동' }],
    from: '2026-09-01', to: '2026-09-30'
  });
  assert.deepStrictEqual(r.map((x) => x.date), ['2026-09-03', '2026-09-20'],
    '★ 시작·종료 말고 다른 날에도 그립니다');
  assert.match(r[0].text, /🏠 육아휴직 홍길동 시작/);
  assert.match(r[1].text, /종료$/);
});

test('⑤-2 시작일과 종료일이 같으면 한 번만 그린다 — 한 칸에 같은 말이 두 줄 뜬다', () => {
  const r = M.chips({
    loa: [{ sid: 'P-002', startDate: '2026-09-03', endDate: '2026-09-03', typeLabel: '휴직' }],
    from: '2026-09-01', to: '2026-09-30'
  });
  assert.strictEqual(r.length, 1);
});

test('⑤-3 끝날이 아직 없는 휴직도 «시작»은 그린다 — 지금 쉬고 있는 사람이다', () => {
  const r = M.chips({
    loa: [{ sid: 'P-002', startDate: '2026-09-03', typeLabel: '질병휴직' }],
    from: '2026-09-01', to: '2026-09-30'
  });
  assert.strictEqual(r.length, 1);
  assert.match(r[0].tip, /\(미정\)/, '언제까지인지 모른다는 것을 안 알려 줍니다');
});

/* ── 셈 자체 ── */

test('★ 날짜 더하기를 UTC 로 센다 — 지역 시간으로 세면 하루 밀린다(그건 사고다)', () => {
  assert.strictEqual(M.addDays('2026-09-01', 10), '2026-09-11');
  assert.strictEqual(M.addDays('2026-02-28', 1), '2026-03-01', '평년 2월을 잘못 셉니다');
  assert.strictEqual(M.addDays('2024-02-28', 1), '2024-02-29', '윤년을 잘못 셉니다');
  assert.strictEqual(M.addDays('2026-12-31', 1), '2027-01-01', '해 넘김을 잘못 셉니다');
  assert.strictEqual(M.addDays('', 10), '', '날짜가 없으면 빈 값이어야 합니다');
  assert.strictEqual(M.addDays('2026-9-1', 10), '', '어정쩡한 꼴을 받아들이면 안 됩니다');
});

test('★ 기산일이 «없으면» 기한도 없다 — 없는 날짜로 셈하면 엉뚱한 날이 뜬다', () => {
  const 빈단계 = { id: 's1', code: 'lrc-local', noticeDate: '' };
  assert.strictEqual(M.stageDue(빈단계, 단계표[0]), null,
    '★ 송달일이 비었는데 기한을 만들어 냈습니다');
  assert.strictEqual(M.stageDue({ code: 'no-due' }, 단계표[2]), null,
    'dueDays 가 0 이면 기한이 없어야 합니다');
});

test('★ dueFrom 이 result 면 «판정일»로 센다 — 송달일로 세면 날짜가 통째로 다르다', () => {
  const d = M.stageDue({ code: 'wc-apply', noticeDate: '2026-01-01', resultDate: '2026-07-01' },
    단계표[1]);
  assert.strictEqual(d.due, '2026-09-29', '판정일(07-01) + 90일이 아닙니다');
  assert.strictEqual(d.basis, 'result');
});

/* ── 셈이 한 곳인가 ── */

test('★★ 이알피도 «같은 모듈»을 부른다 — 두 벌이면 법정 기한이 하루 어긋날 수 있다', () => {
  const erp = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  assert.match(erp, /<script src="js\/pu-case-due\.js\?v=\d+"><\/script>/,
    '이알피가 모듈을 안 싣습니다');
  const 몸 = erp.slice(erp.indexOf('function caseStageDue(stage, stageDef){'),
    erp.indexOf('function caseStagesOrdered('));
  assert.match(몸, /PuCaseDue\.stageDue\(/, '이알피가 제 손으로 다시 셉니다');
  assert.ok(!/parseInt\(stageDef\.dueDays/.test(몸), '★ 옛 셈이 아직 남아 있습니다');
});

test('★★ 푸른 캘린더도 같은 모듈을 부른다 — 제 손으로 셈하지 않는다', () => {
  const cal = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
  assert.match(cal, /<script src="js\/pu-case-due\.js\?v=\d+"><\/script>/,
    '푸른 캘린더가 모듈을 안 싣습니다');
  assert.match(cal, /PuCaseDue\.chips\(/, '푸른 캘린더가 모듈을 안 씁니다');
  assert.ok(!/dueDays/.test(cal), '★ 푸른 캘린더가 제 손으로 기한을 셉니다');
});

test('★ 푸른 캘린더가 세 자리를 읽는다 — 안 읽으면 층이 늘 비어 있다', () => {
  const cal = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
  ['cases', 'biz_case_stages', 'leave_of_absence'].forEach((k) => {
    assert.match(cal, new RegExp("'" + k + "'"), k + ' 를 안 읽습니다');
  });
});
