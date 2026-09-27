/* 푸른 캘린더 — 사람 칩을 날짜 칸에 «끌어 놓아» 이음센터 근무를 넣는다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「이음근무를 마우스로 드레그해서 넣을 수 있게 해달라」.

   ★ 규칙
     ① 「이음 근무」 탭의 사람 칩만 끌린다 — 캘린더 탭의 칩은 거르개일 뿐이다
     ② 내부 직원은 sid, 외부 노무사·변호사는 externalId(sid 없음) — 이알피가 담아 온 꼴 그대로
     ③ 같은 사람·같은 날이 이미 있으면 안 넣는다 — 두 번 들어가면 근무일이 두 배로 센다
     ④ 저장은 관문(PuCalWrite.save) 하나로, 거절되면 그대로 말한다
     ⑤ 넣은 뒤 외부 공유 뷰도 따라간다(발행예약) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

function 넣어본다(pk, 날, 있던것, 답) {
  const 저장 = [], 말 = [];
  let 발행 = 0;
  const 상자 = {
    console, String, Object, Array, JSON, Math, Date, Promise,
    S: { busy: false },
    D: { attendance_records: 있던것 || [] },
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    PuCalWrite: {
      newId: (p) => p + '-새번호',
      save: (t, item, prev) => { 저장.push({ t, item, prev }); return Promise.resolve(답 || { ok: true }); }
    },
    ieumPeople: () => [
      { pk: 'P-001', name: '홍길동', kind: 'in' },
      { pk: 'ex-1', name: '김외부', kind: 'ex' },
      { pk: 'P-009', name: '이퇴사', kind: 'in', left: true }
    ],
    arr: (v) => Array.isArray(v) ? v : [],
    toast: (t) => 말.push(t), render: () => {}, refreshOne: () => {}, 발행예약: () => { 발행++; }
  };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더, 'function 이음넣기(pk, 날){') + '\nvar __p = 이음넣기(' + JSON.stringify(pk) + ',' + JSON.stringify(날) + ');', 상자);
  return new Promise((r) => setTimeout(() => r({ 저장, 말, 발행: () => 발행 }), 10));
}

test('② 내부 직원은 sid 로, 이음센터 근무(eum-work)로 넣는다', async () => {
  const r = await 넣어본다('P-001', '2026-10-08');
  assert.equal(r.저장.length, 1, '저장을 안 불렀습니다');
  const { t, item, prev } = r.저장[0];
  assert.equal(t, 'attendance_records');
  assert.equal(item.type, 'eum-work');
  assert.equal(item.sid, 'P-001');
  assert.equal(item.date, '2026-10-08');
  assert.ok(!('externalId' in item), '내부 직원에 외부 번호가 붙었습니다');
  assert.ok(item.id && item.hours > 0, '번호·시간이 없습니다');
  assert.equal(prev, null, '새것인데 «고치기»로 보냈습니다');
  assert.equal(r.발행(), 1, '외부 공유 뷰를 안 따라가게 했습니다');
});

test('② 외부 노무사·변호사는 externalId 로 넣고 sid 를 안 붙인다', async () => {
  const r = await 넣어본다('ex-1', '2026-10-08');
  const { item } = r.저장[0];
  assert.equal(item.externalId, 'ex-1');
  assert.ok(!('sid' in item), '외부 사람에게 사번 칸이 붙었습니다 — 이알피가 직원으로 셉니다');
});

test('③ 같은 사람·같은 날이 이미 있으면 안 넣는다 — 근무일이 두 배로 센다', async () => {
  const 있던것 = [{ id: 'att-1', type: 'eum-work', date: '2026-10-08', sid: 'P-001' }];
  const r = await 넣어본다('P-001', '2026-10-08', 있던것);
  assert.equal(r.저장.length, 0, '같은 날 두 번 넣었습니다');
  assert.ok(r.말.length > 0, '안 넣은 까닭을 말하지 않았습니다');
  /* 다른 날은 넣는다 — 막는 잣대가 너무 넓으면 안 된다 */
  const r2 = await 넣어본다('P-001', '2026-10-09', 있던것);
  assert.equal(r2.저장.length, 1, '다른 날인데 막았습니다');
});

test('③ 그만둔 사람은 끌어도 안 넣는다', async () => {
  const r = await 넣어본다('P-009', '2026-10-08');
  assert.equal(r.저장.length, 0, '그만둔 사람을 배정했습니다');
});

test('④ 관문이 거절하면(마감된 달 등) «그대로 말한다»', async () => {
  const r = await 넣어본다('P-001', '2026-08-08', [], { ok: false, message: '2026-08 근태·휴가는 마감됐습니다' });
  assert.ok(r.말.some((x) => /마감/.test(x)), '거절 까닭을 말하지 않았습니다: ' + r.말.join(' / '));
  assert.equal(r.발행(), 0, '안 넣었는데 공유 뷰를 다시 냈습니다');
});

test('① 「이음 근무」 탭의 칩만 끌린다 — 캘린더 탭 칩은 거르개다', () => {
  const 칩 = 함수몸(캘린더, 'function chipsHtml(eumOnly){');
  assert.match(칩, /eumOnly \? ' draggable="true" data-dragp=/, '이음 근무 탭에서만 끌리게 갈라 두지 않았습니다');
});

test('★ 칩은 머리줄에 있다 — 끌기 시작을 «문서»에서 받고, 놓으면 이음넣기로 간다', () => {
  assert.match(캘린더, /document\.addEventListener\('dragstart'[\s\S]{0,200}data-dragp/,
    '머리줄 칩의 끌기 시작을 받는 곳이 없습니다(달력 판 손잡이는 머리줄을 못 듣는다)');
  const 판 = 함수몸(캘린더, 'function 끌기손잡이(){');
  assert.match(판, /eumnew:[\s\S]{0,120}이음넣기\(/, '놓았을 때 «새로 넣기»로 가르지 않습니다');
});
