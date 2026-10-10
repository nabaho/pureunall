'use strict';
/* 💰 금액 붙여넣어 채우기 (대표 지시 2026-10-10)
   외부기관 실적(이알피 밖)은 금액이 비어 있다 — 엑셀의 «업체명 ⇥ 금액»을 붙여 채운다.
   못 박는 것:
     ① 줄 읽기 — 탭·두 칸 띄우기 · 쉼표 든 금액 · 과제명 칸 · 금액 없는 줄은 못 읽음
     ② 맞추기 — 이름이 같은 건만(포함은 3글자 이상) · 과제명으로 좁힘 · 저절로 정하지 않는다
     ③ 넣기 — 이알피 금액은 대상 아님 · 이미 금액 있으면 기본 꺼짐 · 넣은 금액은 «직접 적은 것»(amtFrom 없음) · 되돌리기 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

function 틀(stores) {
  const store = JSON.parse(JSON.stringify(stores || {}));
  const els = {}; const el = (id) => (els[id] = els[id] || { value: '', checked: false, style: {}, textContent: '', innerHTML: '', disabled: false, classList: { add() {}, remove() {} } });
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, window: {}, KcareerBiz: B, alerts: [],
    get: (k) => (store[k] || []).map((r) => Object.assign({}, r)),
    set: (k, arr) => { store[k] = arr; return true; },
    document: { getElementById: el },
    escapeHtml: (x) => String(x == null ? '' : x), toast: (m) => ctx.alerts.push(String(m)),
    _safe: (f) => { try { f(); } catch (e) { /* 화면 갱신은 이 검사 밖 */ } },
    CAREER_CFG: {}, renderCareer() {}, renderPuAgency() {}, renderBizDash() {},
  };
  ctx.window = ctx; vm.createContext(ctx);
  const 부품 = ['function _amtFlat(', 'function _amtNum(', 'function amtParseLine(', 'function amtMatch(', 'function openAmtPaste(', 'function amtPreview(',
    'function _amtFinal(', 'function amtRender(', 'function amtPick(', 'function amtToggle(', 'function amtVat(', 'function amtApply(', 'function amtUndoRun('];
  vm.runInContext("var AMT_STORES=[['consult','컨설팅'],['case','사건'],['fund','기금'],['etc','기타']]; var _amtCtx=null,_amtUndo=null;\n" + 부품.map(떼기).join('\n'), ctx);
  return { ctx, store, els, el };
}
const 실적 = {
  consult: [{ id: 'C1', org: '가나상사', type: '일터혁신', year: '2024', agency: '노사발전재단' },
    { id: 'C2', org: '가나상사', type: '구조혁신', year: '2026', agency: '진흥원' },
    { id: 'C3', org: '다라테크', type: '현장클리닉', year: '2025', amt: '1000000' },
    { id: 'C4', org: '마바산업', type: '현장클리닉', year: '2025', amt: '900000', amtFrom: 'erp' }],
  fund: [{ id: 'F1', org: '사아물산', year: '2023' }],
};

test('① 줄 읽기', () => {
  const { ctx } = 틀();
  const f = (l) => vm.runInContext('amtParseLine(' + JSON.stringify(l) + ')', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(f('가나상사\t3,300,000'))), { org: '가나상사', project: '', amt: 3300000, raw: '가나상사\t3,300,000' });
  assert.equal(f('가나상사\t일터혁신 과제\t2,200,000원').project, '일터혁신 과제');
  assert.equal(f('가나상사  3300000').amt, 3300000, '두 칸 띄우기');
  assert.equal(f('가나상사 3,300,000').amt, 3300000, '한 칸 띄우기 — 맨 끝 숫자');
  assert.equal(f('가나상사\t금액미정'), null, '금액이 없으면 못 읽음');
  assert.equal(f('   '), null);
});

test('② 맞추기 — 이름이 같은 건만 · 둘 이상이면 고르게 · 저절로 정하지 않는다', () => {
  const { ctx } = 틀(실적);
  vm.runInContext("document.getElementById('amtSrc').value='가나상사\\t3300000\\n다라테크\\t2200000\\n마바산업\\t5000000\\n사아물산\\t1100000\\n없는회사\\t100000\\n(주)가나상사 대리점\\t500000'; openAmtPaste(); document.getElementById('amtSrc').value='가나상사\\t3300000\\n다라테크\\t2200000\\n마바산업\\t5000000\\n사아물산\\t1100000\\n없는회사\\t100000'; amtPreview();", ctx);
  const rows = vm.runInContext('_amtCtx.rows', ctx);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].cands.length, 2, '같은 이름이 둘'); assert.equal(rows[0].pick, -1, '저절로 고르지 않는다'); assert.equal(rows[0].on, false);
  assert.equal(rows[1].cands.length, 1); assert.equal(rows[1].on, false, '이미 금액이 있으면 기본 꺼짐');
  assert.equal(rows[2].이알피만, true, '이알피 금액은 대상이 아니다'); assert.equal(rows[2].cands.length, 0);
  assert.equal(rows[3].on, true, '다른 통(기금)에서도 찾고, 한 건이고 금액이 비었으면 켠다');
  assert.equal(rows[4].후보.length, 0, '실적에 없음');
});

test('③ 넣기 — 직접 적은 금액으로 · 부가세 포함이면 ÷1.1 · 되돌리기', () => {
  const { ctx, store } = 틀(실적);
  vm.runInContext("openAmtPaste(); document.getElementById('amtSrc').value='사아물산\\t1100000'; amtVat(true); amtPreview(); amtApply();", ctx);
  assert.equal(store.fund[0].amt, '1000000', '공급가액으로');
  assert.ok(!('amtFrom' in store.fund[0]), '직접 적은 금액 — 이알피 동기화가 덮지 않는다');
  assert.equal(store.consult[3].amt, '900000', '이알피 금액은 안 건드린다');
  vm.runInContext('amtUndoRun()', ctx);
  assert.ok(!store.fund[0].amt, '되돌리면 비어 있던 대로');
  vm.runInContext("openAmtPaste(); document.getElementById('amtSrc').value='다라테크\\t2200000'; amtPreview(); amtToggle(0,true); amtApply();", ctx);
  assert.equal(store.consult[2].amt, '2200000', '이미 금액 있는 건은 사람이 켜면 덮어쓴다');
  vm.runInContext('amtUndoRun()', ctx);
  assert.equal(store.consult[2].amt, '1000000', '되돌리면 예전 금액');
});

test('④ 화면 — 외부기관 실적과 네 목록에 단추 · 직원 보기 전용에서는 감춘다 · 이름으로 저절로 잇지 않는다', () => {
  assert.ok((SRC.match(/onclick="openAmtPaste\(\)"/g) || []).length >= 5, '사건·컨설팅·기금·기타 + 외부기관 실적');
  assert.match(SRC, /body\.kc-staff \[data-act-amt\],/);
  const ap = strip(떼기('function amtApply('));
  assert.ok(/delete r\.amtFrom/.test(ap) && /r\.amtFrom==='erp'\) return;/.test(ap), '직접 적은 금액으로 · 이알피 금액은 안 덮는다');
  const pv = strip(떼기('function amtPreview('));
  assert.ok(/row\.pick=\(고칠수\.length===1\)\?0:-1;/.test(pv), '한 건일 때만 미리 고른다');
});
