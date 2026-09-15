/* 「번호 없는 항목」이 표 전체를 «통째 저장»에 가두지 못하게 한다
   ─────────────────────────────────────────────────────────────────────────
   대표 지시 2026-09-16 「푸른이알피 멈춤관련오류 계속발생 완전 고쳐라」

   ■ 무엇이 있었나 (2026-09-16 서버 실측)
     자문수입 1,996칸 가운데 17건에 번호(id)가 없었다. 칸은 넷뿐이고
     (undoneBy·undoneDate·updatedAt·updatedBy) 모두 2026-08-13 16:19:07 —
     **똑같은 자국 5건이 17건까지 불어난 것**이었다.

   ■ 그 하나가 무엇을 망가뜨리나 — 세 개가 «동시에» 꺼진다
     ① 지도형 전환(arrayToIdMap)  : 모든 항목에 번호가 있어야 켜진다
     ② 칸별 저장(_recCanDirect)   : 지도형일 때만 켜진다
     ③ 안전 병합(_canMerge)       : 서버 항목이 모두 번호를 가져야 켜진다
     → 한 번 고칠 때마다 0.95MB 를 통째로 주고받는다(**멈춤의 뿌리**)
     → 병합이 꺼져 두 기기가 서로를 덮는다(실측: 건수가 1,785↔2,812 로 널뛰었다)

   ■ 왜 스스로 안 나았나
     겹침 자동정리는 번호로 짝을 짓는다 — **번호 없는 것은 건너뛴다.**
     그래서 겹침은 걷히는데 자국은 매번 살아남아 쌓이기만 했다.

   ★ 이 검사가 못 박는 것
     ① 지도 열쇠에 번호가 있으면 «본문에 없어도» 되살린다 (열쇠를 버리지 않는다)
     ② 되살릴 열쇠가 없으면 «내용으로» 한결같은 번호를 짓는다 (같은 내용 → 같은 번호)
     ③ 그래서 똑같은 자국은 여러 벌 들어와도 «한 벌»로 접힌다
     ④ 그 결과 표가 지도형으로 올라가 멈춤이 끝난다
     ⑤ 이름-열쇠 지도(사번키·연도키·납작한 설정)는 «손대지 않는다»
     ⑥ 진짜 기록은 한 건도 안 없어진다

   ⚠ 예시 이름은 늘 홍길동·임꺽정·가나상사다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 진짜 함수를 떠서 «돌린다» — 글자만 보면 조건이 뒤집혀도 통과한다.
   때(Date.now)와 주사위(Math.random)를 갈아 끼울 수 있게 해 둔다 —
   「같은 내용이면 늘 같은 번호」를 재려면 그 둘을 흔들어 봐야 한다. */
function load(흔들기) {
  const box = { console, Object, Array, String, Number, JSON, Math };
  vm.createContext(box);
  if (흔들기 && 흔들기.now != null) box.Date = { now: () => 흔들기.now };
  if (흔들기 && 흔들기.random != null) {
    box.Math = new Proxy(Math, { get: (t, p) => (p === 'random' ? () => 흔들기.random : t[p]) });
  }
  vm.runInContext([
    cutFn(SRC, 'function _fbStableId('),
    cutFn(SRC, 'function normalizeFbValue('),
    cutFn(SRC, 'function arrayToIdMap(')
  ].join('\n'), box);
  return box;
}
const B = load();
const 펴기 = v => Array.from(B.normalizeFbValue(v));

/* 실제로 나온 자국의 모양 */
const 자국 = { undoneBy:'A-003', undoneDate:'2026-08-13T07:19:07.872Z',
  updatedAt:1786605547872, updatedBy:'홍길동' };
const 진짜 = (id, co, amt) => ({ id:id, companyName:co, amount:amt, date:'2026-08-01' });

test('① 지도 열쇠에 번호가 있으면 «본문에 없어도» 되살린다', () => {
  const 지도 = {
    'fi-001': 진짜('fi-001', '가나상사', 110000),
    'fi-002': 진짜('fi-002', '다라산업', 220000),
    'fi-zzz': Object.assign({}, 자국)            /* 본문에 번호가 없다 */
  };
  const out = 펴기(지도);
  assert.strictEqual(out.length, 3, '자국을 버리지도, 표를 통째로 되돌리지도 않는다');
  const 살린것 = out.filter(x => x.id === 'fi-zzz');
  assert.strictEqual(살린것.length, 1,
    '열쇠를 버리면 번호가 «영영» 사라진다 — 그 한 건이 표 전체를 통째 저장에 가둔다');
  assert.strictEqual(살린것[0].undoneBy, 'A-003', '되살리면서 원래 칸을 잃으면 안 된다');
});

test('② 번호 없는 항목이 섞인 지도를 «통째로 되돌리지» 않는다', () => {
  const 지도 = { 'fi-001': 진짜('fi-001', '가나상사', 110000), 'fi-zzz': Object.assign({}, 자국) };
  const out = B.normalizeFbValue(지도);
  assert.ok(Array.isArray(out),
    '배열을 기대하는 화면에 객체를 돌려주면 그 자리에서 터진다 — 옛 코드가 그랬다');
});

test('③ 되살릴 열쇠가 없으면 «내용으로» 번호를 짓는다', () => {
  const out = 펴기([진짜('fi-001', '가나상사', 110000), Object.assign({}, 자국)]);
  assert.strictEqual(out.filter(x => !x.id).length, 0, '번호 없는 것이 남으면 아무것도 안 고쳐진다');
  assert.match(out[1].id, /^noid-/, '지어 준 번호임을 알아볼 수 있어야 한다');
});

test('④ 같은 내용이면 «늘 같은 번호» — 그래서 여러 벌이 한 벌로 접힌다', () => {
  /* 실제로 5건이 17건까지 불었다. 시각·무작위를 섞으면 접히지 않고 계속 분다. */
  const 열일곱 = [];
  for (let i = 0; i < 17; i++) 열일곱.push(Object.assign({}, 자국));
  const out = 펴기([진짜('fi-001', '가나상사', 110000)].concat(열일곱));
  assert.strictEqual(out.length, 2,
    '똑같은 자국 17벌이 한 벌로 안 접히면, 겹침 정리가 번호 없는 것을 건너뛰어 영영 쌓인다');
  assert.strictEqual(out.filter(x => x.id === 'fi-001').length, 1);
});

test('⑤ 그 결과 표가 «지도형»으로 올라갈 수 있다 — 멈춤이 끝나는 자리', () => {
  const out = 펴기([진짜('fi-001', '가나상사', 110000), Object.assign({}, 자국)]);
  assert.ok(out.every(x => x && x.id),
    '한 건이라도 번호가 없으면 arrayToIdMap·_canMerge·_recCanDirect 가 «동시에» 꺼진다');
  const 지도 = B.arrayToIdMap(out);
  assert.strictEqual(Object.keys(지도).length, out.length, '지도로 올릴 때 겹쳐 사라지면 안 된다');
  assert.strictEqual(펴기(지도).length, out.length, '올렸다 다시 읽어도 그대로여야 한다');
});

test('⑥ 진짜 기록은 한 건도 안 없어진다', () => {
  const 원본 = [진짜('fi-001', '가나상사', 110000), Object.assign({}, 자국),
    진짜('fi-002', '다라산업', 220000), Object.assign({}, 자국), 진짜('fi-003', '마바텍', 330000)];
  const out = 펴기(원본);
  ['fi-001', 'fi-002', 'fi-003'].forEach(id =>
    assert.strictEqual(out.filter(x => x.id === id).length, 1, id + ' 이 사라졌다'));
});

/* ── 손대면 «안 되는» 것들 ───────────────────────────────────────────── */

test('⑦ 사번 열쇠 지도(성과율·권한)는 배열로 펴지 않는다 — 열쇠가 곧 뜻이다', () => {
  const 성과율 = { 'A-001': 15, 'A-003': 12 };
  assert.deepStrictEqual(B.normalizeFbValue(성과율), 성과율);
  const 권한 = { 'A-001': { menus:['biz/case'] }, 'A-003': { menus:[] } };
  assert.deepStrictEqual(B.normalizeFbValue(권한), 권한,
    '번호가 하나도 없는 이름-열쇠 지도를 배열로 펴면 사번이 통째로 사라진다');
});

test('⑧ 번호가 있는데 «열쇠와 다르면» 이름-열쇠 지도다 — 그대로 둔다', () => {
  const 연도별 = { '2026': { id:'rate-2026', pension:4.5 }, '2025': { id:'rate-2025', pension:4.5 } };
  assert.deepStrictEqual(B.normalizeFbValue(연도별), 연도별);
});

test('⑨ 납작한 설정(회사정보)은 손대지 않는다', () => {
  const 회사 = { name:'가나노무법인', bizNo:'123-45-67890', ceo:'홍길동' };
  assert.deepStrictEqual(B.normalizeFbValue(회사), 회사);
});

test('⑩ 「0,1,2…」 자리번호는 번호로 되살리지 «않는다» — 뜻이 없는 수다', () => {
  const out = 펴기({ '0': 진짜('fi-001', '가나상사', 110000), '1': Object.assign({}, 자국) });
  assert.strictEqual(out[0].id, 'fi-001');
  assert.ok(!/^1$/.test(String(out[1].id)),
    '자리번호를 번호로 삼으면 자리가 바뀔 때마다 «다른 기록»이 된다');
  assert.match(String(out[1].id), /^noid-/);
});

test('⑪ 번호를 원래 «안 쓰는» 표는 그대로 둔다 — 직원계정은 사번이 열쇠다', () => {
  const 직원 = [{ sid:'A-001', name:'홍길동' }, { sid:'A-003', name:'임꺽정' }];
  const out = 펴기(직원);
  assert.strictEqual(out.filter(x => x.id).length, 0,
    '전부 번호가 없으면 고장이 아니라 «생김새»다 — 억지로 번호를 붙이면 표가 달라진다');
});

/* ── 멈춤의 사슬이 «정말» 끊겼나 (소스로 확인) ────────────────────────── */

test('⑫ 세 자리가 모두 「번호가 다 있는가」 하나에 매여 있다', () => {
  const s = stripJs(SRC);
  assert.match(s, /DIFF_KEYS\.indexOf\(k\) >= 0 && Array\.isArray\(v\) && v\.every\(function\(x\)\{return x&&x\.id;\}\)/,
    '지도형 전환 조건이 바뀌었다 — 이 검사의 전제를 다시 봐야 한다');
  assert.match(s, /_srvArr\.every\(function\(x\)\{ return x && x\.id; \}\)/,
    '안전 병합 조건이 바뀌었다');
  assert.match(s, /_fbObjForm\[k\] === true/,
    '칸별 저장 조건이 바뀌었다');
});

test('⑭★ 지어 주는 번호에 «시각·주사위»를 섞지 않는다 — 날이 바뀌면 안 접힌다', () => {
  /* ⚠ 이것이 ④ 만으로는 안 잡히던 구멍이다. 한 번 돌리는 동안에는 시각이 같아서,
       Date.now() 를 섞어도 그 자리에서는 멀쩡히 접힌다. 탈은 «다음 날, 다른 기기»에서
       난다 — 같은 자국이 다른 번호를 받아 접히지 않고 쌓인다.
       실제로 5건이 17건까지 불었다. 그래서 때와 주사위를 흔들어 놓고 잰다. */
  const 같은자국 = () => Object.assign({}, 자국);
  const 낸다 = 흔들기 => {
    const b = load(흔들기);
    const out = b.normalizeFbValue([진짜('fi-001', '가나상사', 110000), 같은자국()]);
    return out[1].id;
  };
  const 어제 = 낸다({ now: 1000, random: 0.11 });
  const 오늘 = 낸다({ now: 1789999999999, random: 0.97 });
  assert.strictEqual(어제, 오늘,
    '같은 내용인데 번호가 달라진다 — 그러면 여러 벌이 영영 안 접히고 쌓이기만 한다');
  assert.ok(!/^noid--?\d{9,}/.test(어제), '번호에 밀리초가 그대로 박혀 있다');
});

test('⑮ 내용이 «다르면» 번호도 달라야 한다 — 다른 것을 한 벌로 접으면 자료를 잃는다', () => {
  const a = 펴기([진짜('fi-001', '가나상사', 110000), Object.assign({}, 자국)]);
  const b = 펴기([진짜('fi-001', '가나상사', 110000),
    Object.assign({}, 자국, { undoneBy: 'A-009' })]);
  assert.notStrictEqual(a[1].id, b[1].id);
});

test('⑬ 겹침 정리는 번호 없는 것을 «건너뛴다» — 그래서 위 ④ 가 꼭 필요하다', () => {
  const f = cutFn(stripJs(SRC), 'function normalizeFbValue(');
  assert.match(f, /if\(typeof i !== 'string' \|\| !i\) return true;/,
    '이 줄 때문에 번호 없는 자국은 영영 안 걷힌다 — 번호를 지어 주는 쪽으로 푼다');
});
