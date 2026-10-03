'use strict';
/* ← 목록으로 (대표 승인 2026-09-30 목업 · 「데이터 입력을 하다가 저장 후 뒤로 또는 저장 없이 뒤로 가서
   다른 서류를 확인하고 싶은데 현재 화면에서는 직접 해결 방법이 없다」)
   못 박는 것:
     ① 기둥 맨 위에 단추 — 한글 편집 중에도 보인다(rh-noed 밖)
     ② 그냥 누르면 담고 나간다 · 「저장 안 하고」는 담지 않는다(그리고 한 번 묻는다)
     ③ 나가면 작업 모드가 풀린다 — 안 풀면 돌아갈 목록 줄이 감춰진 채다
     ④ 브라우저 뒤로 = 목록으로 · 발자국은 한 번만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 단추는 기둥 맨 위 · 한글 편집 중에도 보인다', () => {
  const 단추 = SRC.indexOf('id="rhBackWrap"');
  assert.ok(단추 > 0);
  const 맞춤 = SRC.indexOf('<div class="rh-noed">', SRC.indexOf('class="rc-bar"'));
  assert.ok(단추 < 맞춤, '«보기 맞춤»(rh-noed) 밖·위에 있어야 편집 중에도 보입니다');
  assert.match(SRC, /onclick="rhBackToList\('save'\)"[^>]*>← 목록으로/);
  assert.match(SRC, /onclick="rhBackAskDrop\(this\)"[^>]*>↩ 저장 안 하고 나가기/);
});

function 무대(처음) {
  const 일 = [];
  const 막 = { classList: { remove: () => {} } };
  let 편집중 = true;
  const 발자국 = [];
  const ctx = {
    toast: (m) => 일.push('toast:' + m), escapeHtml: String, _rhWhen: () => '3분 전',
    document: { getElementById: (id) => (id === 'rhDraftPanel' ? 막 : null) },
    window: { scrollTo: () => {}, addEventListener: (t, f) => { ctx.__pop = f; } },
    history: { state: null, pushState: (s) => { 발자국.push(s); ctx.history.state = s; }, back: () => { 일.push('back'); ctx.history.state = null; } },
    rhEditing: () => 편집중,
    rhDraftNow: async (q) => { 일.push('save:' + !!q); if (!ctx._rhDraftId) ctx._rhDraftId = 'd_new'; ctx.__목록 = [{ id: ctx._rhDraftId, at: 1 }]; },
    rhCloseDoc: async (o) => { 일.push('close:' + JSON.stringify(o)); 편집중 = false; ctx._rhDraftId = null; },
    rhDraftAll: () => ctx.__목록 || [],
    rhDraftDraw: () => 일.push('draw'),
    kcAskDelete: (b, o, yes) => { 일.push('ask:' + o.yes); ctx.__yes = yes; },
    _rhDraftId: 처음 || null, __목록: 처음 ? [{ id: 처음, at: 1 }] : [],
  };
  vm.createContext(ctx);
  const 조각 = SRC.slice(SRC.indexOf('var _rhJustBack=null'), SRC.indexOf('function rhBackGuard('));
  vm.runInContext(조각 + '\n' + 떼기('function rhBackGuard('), ctx);
  return { ctx, 일, 발자국, 켜기: () => { 편집중 = true; } };
}

test('② 그냥 누르면 «담고» 나간다 — 목록을 열고 방금 줄을 짚는다', async () => {
  const m = 무대('d1');
  await vm.runInContext("rhBackToList('save')", m.ctx);
  assert.deepEqual(m.일.slice(0, 2), ['save:true', 'close:{"silent":true,"nosave":true}'], '담기는 한 번만');
  assert.ok(m.일.includes('draw'));
  assert.equal(m.ctx._rhJustBack, 'd1', '방금 쓰던 줄에 표시해야 합니다');
});

test('② 저장 안 하고 나가기 — 먼저 묻고, 담지 않는다', async () => {
  const m = 무대('d1');
  vm.runInContext('rhBackAskDrop(null)', m.ctx);
  assert.deepEqual(m.일, ['ask:버리고 나가기'], '묻기 전에 나가면 안 됩니다');
  await m.ctx.__yes();
  assert.ok(!m.일.some((x) => x.startsWith('save')), '★★ 「저장 안 하고」인데 담으면 버리려던 것이 덮어씁니다');
  assert.ok(m.일.includes('close:{"silent":true,"nosave":true}'));
  assert.equal(m.ctx._rhJustBack, 'd1', '마지막으로 담은 것은 목록에 남습니다');
});

test('② 한 번도 안 담고 버리면 목록에 짚을 줄이 없다', async () => {
  const m = 무대(null);
  await vm.runInContext("rhBackToList('drop')", m.ctx);
  assert.equal(m.ctx._rhJustBack, null);
});

test('④ 브라우저 뒤로 = 목록으로(담고) — 공용 뒤로가기의 파수꾼으로', async () => {
  const m = 무대('d1');
  vm.runInContext(떼기('function rhBackGuard('), m.ctx);
  assert.equal(vm.runInContext('rhBackGuard()', m.ctx), true, '서식을 쓰는 중이면 «내가 처리했다»고 해야 앱 밖으로 안 나갑니다');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(m.일.includes('save:true'), '뒤로 가기도 담고 나가야 합니다');
  assert.equal(vm.runInContext('rhBackGuard()', m.ctx), false, '서식을 안 쓰면 비켜선다');
  assert.ok(!m.일.includes('back'));
});

test('④ 기록(history)을 따로 굴리지 않는다 — pu-back.js 와 겹치면 뒤로 한 번에 앱 밖으로 나간다', () => {
  const 본문 = SRC.slice(SRC.indexOf('var _rhJustBack=null'), SRC.indexOf('function rhBackGuard('));
  assert.doesNotMatch((본문 + 떼기('function rhWorkSet(')).replace(/\/\*[\s\S]*?\*\//g, ''), /pushState|popstate|history\.back/);
  const 달기 = SRC.indexOf('PuBack.guard(function(){ return rhBackGuard(); })');
  const 창닫기 = SRC.indexOf('PuBack.guard(function(){ return PuBack.closeTopVisible(); })');
  assert.ok(달기 > 0 && 창닫기 > 달기, '떠 있는 창 닫기가 나중에 달려야 «먼저» 물립니다');
});

test('③ 치우면 작업 모드가 풀린다 · 「저장 안 하고」면 담지 않는다', () => {
  const f = 떼기('async function rhCloseDoc(');
  assert.match(f, /rhWorkSet\(false\)/, '안 풀면 위 줄(양식 올리기·작성 중)이 감춰진 채 남습니다');
  assert.match(f, /if\(!o\.nosave\) await rhDraftNow\(\)/);
});
