'use strict';
/* 📂 7번 폴더에서 사업 고르기 — 고른 것을 «누르기 전에» 알고, 잘못 골랐으면 멈춘다 (대표 화면 2026-10-06)
   「모든 건 폴더 보기」를 켠 채 머리 ☐ 를 누르면 개인 지원 236건이 통째로 골라졌고, 무엇을 올리는지
   단추에도 안 보였다. 파일 수천 개가 창고에 올라간 뒤에 알면 늦다.
   ① 사업 같음이 아닌 것이 섞이면 한 번 묻고, 아니라면 아무것도 안 읽는다
   ② 올리는 중 「닫기 · 멈추기」 — 지금 건까지 담고 멈춘다
   ③ 단추에 «고른 n건 (사업 같음 아닌 m건 포함)» · 「사업 같음」 표시는 이름 앞(… 에 안 잘리게) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 건 = (name, biz) => ({ d: { name, yearDir: '2025년', handle: {} }, caseDir: '7/2025년/' + name, biz, used: '', pre: { year: '2025', title: name, org: '' } });
function 상자(list, 고른번호, 답) {
  const 기록 = { 물음: 0, 읽음: [], 알림: [] };
  const 단추 = { disabled: false, textContent: '' };
  const ctx = { console, String, Date, toast: (m) => 기록.알림.push(m),
    confirm: () => { 기록.물음++; return 답; },
    document: { getElementById: (id) => (id === 'bizPickGo' ? 단추 : { classList: { remove() {} } }),
      querySelectorAll: () => 고른번호.map((k) => ({ value: String(k) })) },
    KcareerBiz: { KINDS: ['입찰·용역'], stageForImport: () => '모름' },
    _bizNew: (o) => Object.assign({ id: 'BZ1', docs: [] }, o), _bizPut() {}, bizPickDraw() {}, bizDraw() {},
    renderBizList() {}, renderBizDash() {}, renderBizDocs() {}, _safe(f) { try { f(); } catch (e) {} },
    _bizReadDir: async (h, p) => { 기록.읽음.push(p); return []; },
    _bizAddFiles: async () => ({ n: 0, cloud: 0, big: 0 }) };
  vm.createContext(ctx);
  vm.runInContext(['var _bizCur=null;', 떼기('function _bizPickChosen('), 떼기('function bizPickSum('), 떼기('function bizPickClose('), 떼기('async function bizPickGo(')].join('\n'), ctx);
  ctx._bizPick = { list, into: false, all: true, q: '' };
  return { ctx, 기록, 단추 };
}

test('★★ ① 사업 같음이 아닌 것이 섞이면 묻고 — 아니라고 하면 한 폴더도 안 읽는다', async () => {
  const list = [건('2025 가나 사업', true), 건('2025 다라시 위원 모집', false), 건('2025 마바 강사', false)];
  const { ctx, 기록 } = 상자(list, [0, 1, 2], false);
  await ctx.bizPickGo();
  assert.equal(기록.물음, 1);
  assert.equal(기록.읽음.length, 0, '★ 파일을 읽기 시작한 뒤에 물으면 늦다');
});

test('① 사업 같음만 골랐으면 묻지 않고 올린다', async () => {
  const list = [건('2025 가나 사업', true), 건('2025 다라 용역', true)];
  const { ctx, 기록 } = 상자(list, [0, 1], false);
  await ctx.bizPickGo();
  assert.equal(기록.물음, 0); assert.equal(기록.읽음.length, 2);
});

test('★ ② 올리는 중 「닫기 · 멈추기」 — 지금 건까지 담고 멈춘다', async () => {
  const list = [건('가', true), 건('나', true), 건('다', true)];
  const { ctx, 기록 } = 상자(list, [0, 1, 2], true);
  ctx._bizAddFiles = async () => { ctx.bizPickClose(); return { n: 1, cloud: 1, big: 0 }; };   /* 첫 건을 담는 동안 누른다 */
  await ctx.bizPickGo();
  assert.equal(기록.읽음.length, 1, '★ 멈추기를 눌렀는데 236건을 끝까지 올리면 안 된다');
  assert.ok(기록.알림.some((m) => /멈춤 — 남은 2건/.test(m)), '몇 건을 안 올렸는지 알린다');
  assert.equal(vm.runInContext('_bizPick.running', ctx), false, '끝나면 다시 고를 수 있게 풀린다');
});

test('③ 단추에 고른 수와 «사업 같음 아닌» 수 · 표시는 이름 앞', () => {
  const list = [건('가', true), 건('나', false)];
  const { ctx, 단추 } = 상자(list, [0, 1], true);
  ctx.bizPickSum();
  assert.match(단추.textContent, /고른 2건/); assert.match(단추.textContent, /사업 같음 아닌 1건/);
  assert.match(떼기('function bizPickDraw('), /사업 같음<\/span> ':''\)\+escapeHtml\(x\.d\.name\)/, '★ 이름 뒤에 두면 … 으로 잘릴 때 사라진다');
  assert.match(SRC, /onclick="bizPickClose\(\)"/);
});
