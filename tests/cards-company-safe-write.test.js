'use strict';
/* 기업정보함 → 업체관리(이알피) 쓰기는 «업체 한 건 · 서버의 지금 판 위에서» (2026-10-07 기업정보함 점검 ①)

   ■ 무엇이 문제였나
     기업정보함이 업체관리 업체를 고치는 곳 7곳(메일 담당자 채우기·되돌리기, 세무사무실 채우기,
     계산서 발급처 채우기(저절로 돎), 계약 종료, 퇴사 표시 하나·여럿)이 업체 목록을 «통째로» 읽어
     한 건을 합친 뒤 그 레코드를 «통째로» 다시 썼다. 그사이 이알피에서 고친 칸이 조용히 사라졌고,
     두 곳은 표의 시각(u)도 안 올려 이알피가 다시 읽지도 않았다.
   ■ 이제 — 공용 문 erpCoPatchMany 하나로: 업체 «한 건»만 읽고, 공용 저장 관문(PuCompanyWrite.patch)
     거래 안에서 서버의 지금 판으로 «다시 셈»해 바뀐 칸만 얹는다. 쓴 것이 있으면 시각(u)을 올린다.

   여기서 지키는 것 — 진짜 관문(js/pu-company-write.js · js/pu-ontology-write.js)으로 «실제로 돌린다».
   ⚠ 예시는 가짜다(홍길동·가나상사). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');
const { coFake, PCW } = require('./erp-co-fake.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function box(list, fakeOpt) {
  const fake = coFake(list, fakeOpt);
  const ctx = { console, Object, Array, String, Number, JSON, Date, Math, Promise,
    window: { PuCompanyWrite: fake.PuCompanyWrite },
    firebase: { auth: () => ({ currentUser: { email: 'me@pureun.kr' } }), database: fake.database },
    ErpMatch: { load() {}, _norm: (s) => String(s || '').replace(/\s/g, ''), _nameHit: (a, b) => !!a && a === b },
    mbWhoBust() {}, mbCardsRevBump() {}, fake };
  vm.createContext(ctx);
  /* 메일로 업체 담당자 채우기 셈은 js/pu-mail-fill-core.js «한 벌» — 서버(mailSync)와 같이 쓴다 */
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-mail-fill-core.js'), 'utf8') + ';var PuMailFill = this.PuMailFill || (typeof window !== "undefined" && window.PuMailFill);', ctx);
  ['async function erpCoPatchMany(', 'async function erpFillContact(', 'function erpFillContactPlan(',
    'async function erpUnfillContact('].forEach((h) => vm.runInContext(sliceFn(app, h), ctx));
  return ctx;
}
const 가나 = () => ({ id: 'co1', name: '가나상사', bizNo: '123-45-67890', phone: '02-100-0000',
  contacts: [{ id: 'm1', name: '김철수', email: 'kim@gana.example' }] });

test('★★★ 그사이 이알피에서 고친 칸이 «살아남는다» — 서버의 지금 판 위에 바뀐 칸만 얹는다', async () => {
  /* 기업정보함이 읽은 뒤·쓰기 직전에 이알피가 대표번호를 고치고 담당자 한 사람을 더했다 */
  const c = box([가나()], { beforeTx: (map) => {
    map.co1 = Object.assign({}, map.co1, { phone: '02-999-9999',
      contacts: map.co1.contacts.concat([{ id: 'm2', name: '이영희', email: 'lee@gana.example' }]) });
  } });
  const r = await c.erpFillContact({ coId: 'co1', email: 'hong@gana.example', name: '홍길동' });
  assert.equal(r.ok, true, r.why);
  const rec = c.fake.map.co1;
  assert.equal(rec.phone, '02-999-9999', '★★★ 이알피에서 고친 대표번호를 옛 값으로 되돌렸습니다');
  const emails = rec.contacts.map((x) => x.email).sort();
  assert.deepEqual(emails, ['hong@gana.example', 'kim@gana.example', 'lee@gana.example'],
    '★★★ 그사이 이알피에서 더한 담당자가 사라졌거나, 새 담당자가 안 들어갔습니다');
});

test('★★ 쓴 뒤 표의 시각(u)을 올린다 — 안 올리면 이알피가 다시 안 읽는다 (되돌리기도)', async () => {
  const c = box([Object.assign(가나(), { contacts: [{ email: 'hong@gana.example', addedFrom: 'mail-auto' }] })]);
  const r = await c.erpUnfillContact('co1', 'hong@gana.example');
  assert.equal(r.removed, true);
  assert.equal(c.fake.uSets.length, 1, '★★ 되돌리기가 시각(u)을 안 올립니다 — 예전에 빠져 있던 자리입니다');
});

test('★★ 바꿀 것이 없으면 «아무것도» 안 쓴다 — 시각도 안 올린다', async () => {
  const c = box([가나()]);
  const r = await c.erpFillContact({ coId: 'co1', email: 'kim@gana.example', name: '김철수' });
  assert.equal(r.added, false);
  assert.equal(c.fake.writes.length + c.fake.uSets.length, 0, '★ 바뀐 것이 없는데 썼습니다(헛쓰기는 요금이고 이알피 경고를 부릅니다)');
});

test('★★★ 없는 업체·지운 업체에는 쓰지 않는다 — 껍데기 업체가 되살아나면 안 된다', async () => {
  for (const [why, list] of [['없는 업체', []], ['지운 업체', [Object.assign(가나(), { _deleted: true })]]]) {
    const c = box(list);
    const r = await c.erpFillContact({ coId: 'co1', email: 'hong@gana.example', name: '홍길동' });
    assert.equal(r.ok, false, why + ' 인데 됐다고 합니다');
    assert.equal(c.fake.writes.length, 0, '★★★ ' + why + ' 에 썼습니다');
  }
});

test('★★ 목록을 통째로 읽지 않는다 — 업체 «한 건»만', async () => {
  const c = box([가나(), { id: 'co2', name: '다라산업', contacts: [] }]);
  await c.erpFillContact({ coId: 'co1', email: 'hong@gana.example', name: '홍길동' });
  assert.equal(c.fake.reads.whole, 0, '★ 업체 목록을 통째로 읽었습니다(378곳) — 한 건이면 됩니다');
});

test('★★★ 이 앱에서 업체관리에 쓰는 길은 공용 관문뿐 — 레코드·목록을 직접 쓰는 곳이 없다', () => {
  const s = strip(app);
  /* 업체 자리에 무엇을 «넣는» 줄: up['data/companies/v…'] = … · ref('data/companies/v…').set/update */
  const bad = s.split('\n').filter((ln) =>
    /\[\s*'data\/companies\/v[^\]]*\]\s*=/.test(ln) ||
    /ref\(\s*'data\/companies(\/v[^']*)?'\s*(\+[^)]*)?\)\s*\.(set|update|remove|transaction)\(/.test(ln));
  assert.deepEqual(bad, [], '★★★ 업체관리를 직접 씁니다 — erpCoPatchMany(또는 cardErpSync 의 W.save)로:\n' + bad.join('\n'));
});

test('★★ 공용 관문 patch — 찬 자리(null)로 먼저 불려도 접지 않는다', async () => {
  /* 실시간DB 거래는 먼저 null 로 부른다. 그때 undefined 를 돌려주면 서버에 묻지도 않고 끝난다 */
  const calls = [];
  const db = { ref: () => ({ transaction: async (fn) => {
    const a = fn(null); calls.push(a ? 'record' : 'undefined');
    const b = fn({ id: 'co1', name: '가나상사', phone: '1' });
    return { committed: true, snapshot: { val: () => b } };
  } }) };
  await PCW.patch(db, 'co1', { id: 'co1', name: '가나상사' }, (cur) => Object.assign(cur, { phone: '2' }), { actor: '홍길동' });
  assert.deepEqual(calls, ['record'], '★★ 찬 자리에서 접었습니다 — 서버에 묻지도 않고 끝납니다');
});

test('★ 누가 고쳤는지 — 이름을 넘기면 이름으로(이알피가 쓰는 꼴)', () => {
  const g = strip(sliceFn(app, 'async function erpCoPatchMany('));
  assert.match(g, /actor:\s*j\.by \|\| u\.email/, '★ 이름(by)을 넘겨도 로그인 메일로 찍힙니다 — 이알피 「누가 고쳤나」가 어긋납니다');
});
