'use strict';
/* 한글 편집기 — 열어 온 .hwp 원본을 «저장하기» 로 조용히 덮어쓰지 않는다 (2026-11-08, 대표 «막고 진행»)
   ■ 왜
     편집기가 .hwp 를 읽어 보여 주는 내용은 원본보다 적을 수 있다 — 큰 편람 한 파일에서 kordoc 이 읽은 글자의
     약 8% 만 가져왔고 «지원하지 않는 개체» 안내도 없었다. 큰 문서를 .hwp 로 다시 쓰면 그림도 빠진다.
     Ctrl+S 한 번으로 원본 .hwp 를 덮어쓰면 되돌릴 수 없다(저장소 이전 판은 .hwp 를 덮어쓰지 않고 .hwpx 로만 저장했다).
   ■ 지금
     - 열어 온 .hwp(핸들이 있고 저장 창으로 만든 것이 아님) → «저장하기» 는 덮어쓰지 않고 새 이름 저장 창(.hwpx 제안)을 연다.
     - .hwpx 는 전처럼 제자리 저장. 저장 창에서 사용자가 직접 고른 파일은 그 뒤 «저장하기» 로 제자리 저장해도 된다.
     - «다른 이름으로 저장하기» 는 그대로(사용자가 직접 고르고 운영체제가 덮어쓰기를 되묻는다).
     - 저장 창을 못 쓰는 브라우저는 «내려받기» 로만 저장(원본을 건드리지 않는다).
   함수를 떠서 «돌려» 본다(되풀이된 실수 ②).
   node --test tests/hangul-hwp-no-overwrite.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const SAVE = cutFn(strip(SRC), 'async function save(');

function mkHandle(name) {
  const h = { name, writes: [], closed: 0 };
  h.createWritable = async () => ({ write: async b => { h.writes.push(Array.from(b)); }, close: async () => { h.closed++; } });
  return h;
}
// 2026-11-20: save 는 «누른 문서(doc)» 를 붙잡고, 저장할 바이트를 buildChecked(fmt) 로 만든다(.hwp 면 다시 읽어 빠진 것 loss 도 셈).
//  loss 가 있으면 askHwpLoss 로 묻는다 — 'hwpx'(새 저장 창) · 'hwp'(그래도) · null(취소).
//  가짜 환경: cur 는 save 와 같은 자리의 let 이라 activate 가 바꿀 수 있다(탭 바뀜 흉내).
function harness({ cur, picker, pickerOk = true, loss = null, answer = null, onPick = null, onAsk = null }) {
  const log = { picked: [], toasts: [], downloads: [], built: [], asked: [], dropped: [], activated: [] };
  const win = {};
  const env = {};
  const showSaveFilePicker = async opts => { log.picked.push(opts); if (onPick) onPick(env, log.picked.length); return picker(opts, log.picked.length); };
  if (pickerOk) win.showSaveFilePicker = showSaveFilePicker;
  const docs = [cur];
  const made = new Function('env', 'guardRO', 'docs', 'renderTabs', 'document', 'toast', 'window', 'showSaveFilePicker', 'HWP_TYPE', 'HWPX_TYPE', 'safeName', 'download',
    'buildChecked', 'askHwpLoss', 'dropEmptyPick', 'log',
    'let cur = env.first;\nconst activate = d => { log.activated.push(d); cur = d; };\n' + SAVE + '\nreturn { save, setCur: d => { cur = d; }, getCur: () => cur };')(
    Object.assign(env, { first: cur }), () => false, docs, () => {}, { title: '' }, (m, bad) => log.toasts.push({ m, bad }), win, showSaveFilePicker,
    { id: 'hwp' }, { id: 'hwpx' }, n => n, (bytes, name, fmt) => log.downloads.push({ name, fmt, bytes: Array.from(bytes) }),
    async fmt => { log.built.push({ fmt, doc: env.api.getCur() }); return { bytes: new Uint8Array([fmt === 'hwp' ? 1 : 2]), loss: fmt === 'hwp' ? loss : null }; },
    async l => { log.asked.push(l); if (onAsk) onAsk(env); return answer; }, async h => { log.dropped.push(h); }, log);
  env.api = made;
  env.docs = docs;
  return { save: made.save, log, env };
}

test('★★★ 열어 온 .hwp 원본은 «저장하기» 로 덮어쓰지 않고, 새 이름(.hwpx 제안) 저장 창을 연다', async () => {
  const orig = mkHandle('원본.hwp'), fresh = mkHandle('새이름.hwpx');
  const cur = { name: '원본', format: 'hwp', handle: orig, dirty: true };
  const { save, log } = harness({ cur, picker: () => fresh });
  await save(false);
  assert.strictEqual(orig.writes.length, 0, '원본 .hwp 에 썼습니다 — 덮어쓰기가 막히지 않았습니다');
  assert.strictEqual(log.picked.length, 1, '새 이름 저장 창이 안 열렸습니다');
  assert.match(log.picked[0].suggestedName, /\.hwpx$/, '제안 이름은 .hwpx 여야 합니다(원본과 같은 이름을 권하지 않는다)');
  assert.deepStrictEqual(fresh.writes, [[2]], '새 파일에 .hwpx 로 써야 합니다');
  assert.strictEqual(cur.handle, fresh);
  assert.ok(log.toasts.some(t => /덮어쓰지/.test(t.m)), '왜 저장 창이 열리는지 안내해야 합니다');
  assert.strictEqual(cur.dirty, false);
});

test('★★ 새 이름으로 저장한 뒤에는 «저장하기» 가 그 파일에 제자리 저장한다 (저장 창을 또 열지 않는다)', async () => {
  const fresh = mkHandle('새이름.hwpx');
  const cur = { name: '원본', format: 'hwp', handle: mkHandle('원본.hwp'), dirty: true };
  const { save, log } = harness({ cur, picker: () => fresh });
  await save(false); await save(false);
  assert.strictEqual(log.picked.length, 1, '두 번째 저장에서 저장 창을 또 열었습니다');
  assert.strictEqual(fresh.writes.length, 2);
});

test('★★ 사용자가 저장 창에서 직접 고른 .hwp 는 그 뒤 «저장하기» 로 제자리 저장해도 된다', async () => {
  const mine = mkHandle('내가고른.hwp');
  const cur = { name: '원본', format: 'hwp', handle: mkHandle('원본.hwp'), dirty: true };
  const { save, log } = harness({ cur, picker: () => mine });
  await save(false);          // 원본 → 저장 창 → 사용자가 .hwp 를 고름
  await save(false);          // 이제 «내 파일» → 제자리
  assert.strictEqual(log.picked.length, 1);
  assert.deepStrictEqual(mine.writes, [[1], [1]], '.hwp 로 두 번 써야 합니다');
});

test('★★ .hwpx 는 전처럼 «저장하기» 가 제자리 저장한다', async () => {
  const x = mkHandle('문서.hwpx');
  const cur = { name: '문서', format: 'hwpx', handle: x, dirty: true };
  const { save, log } = harness({ cur, picker: () => { throw new Error('저장 창이 열리면 안 됩니다'); } });
  await save(false);
  assert.strictEqual(log.picked.length, 0);
  assert.deepStrictEqual(x.writes, [[2]]);
});

test('★★ «다른 이름으로 저장하기» 는 그대로 — 저장 창이 열리고 원본은 안 건드린다', async () => {
  const orig = mkHandle('원본.hwp'), other = mkHandle('복사본.hwp');
  const cur = { name: '원본', format: 'hwp', handle: orig, dirty: true };
  const { save, log } = harness({ cur, picker: () => other });
  await save(true);
  assert.strictEqual(orig.writes.length, 0);
  assert.strictEqual(log.picked.length, 1);
  assert.deepStrictEqual(other.writes, [[1]], '사용자가 저장 창에서 .hwp 를 직접 고르면 .hwp 로 쓴다');
  // 2026-11-20 점검: 열어 온 .hwp 의 «다른 이름으로» 도 원본 이름(.hwp)을 먼저 권하면 Enter 한 번에 원본을 덮어쓴다
  assert.match(log.picked[0].suggestedName, /\.hwpx$/, '열어 온 .hwp 는 다른 이름으로 저장할 때도 .hwpx 를 먼저 제안해야 합니다');
  assert.strictEqual(log.picked[0].types[0].id, 'hwpx', '저장 창의 첫 형식도 .hwpx 여야 합니다');
});

test('★★ «HWP 로 저장»(형식을 직접 고른 메뉴)은 .hwp 를 제안한다', async () => {
  const cur = { name: '원본', format: 'hwp', handle: mkHandle('원본.hwp'), dirty: true };
  const { save, log } = harness({ cur, picker: () => mkHandle('사본.hwp') });
  await save(true, 'hwp');
  assert.match(log.picked[0].suggestedName, /\.hwp$/);
});

// ---------- .hwp 로 쓰면 빠지는 것이 있을 때 (2026-11-20 점검: 편람 그림 24 → 3, 글자 약 1,100자) ----------
const LOSS = { chars: 1107, images: 21, shapes: 3 };

test('★★★ .hwp 로 쓰면 빠지는 것이 있으면 묻는다 — «.hwpx 로 저장» 을 고르면 .hwp 에 쓰지 않고 새 저장 창(.hwpx)을 연다', async () => {
  const picked = mkHandle('사본.hwp'), x = mkHandle('사본.hwpx');
  const cur = { name: '원본', format: 'hwpx', handle: null, dirty: true };
  const { save, log } = harness({ cur, loss: LOSS, answer: 'hwpx', picker: (o, n) => (n === 1 ? picked : x) });
  await save(true, 'hwp');
  assert.strictEqual(log.asked.length, 1, '빠지는 것이 있는데 묻지 않았습니다');
  assert.deepStrictEqual(log.asked[0], LOSS);
  assert.strictEqual(picked.writes.length, 0, '빠지는 .hwp 를 그대로 썼습니다');
  assert.deepStrictEqual(log.dropped, [picked], '저장 창이 만든 빈 .hwp 를 치워야 합니다');
  assert.strictEqual(log.picked.length, 2);
  assert.match(log.picked[1].suggestedName, /\.hwpx$/);
  assert.deepStrictEqual(x.writes, [[2]]);
  assert.strictEqual(cur.dirty, false);
});

test('★★ «그래도 .hwp 로 저장» 이면 쓴다 · «취소» 면 아무것도 쓰지 않고 «고침» 표시가 남는다', async () => {
  const a = mkHandle('a.hwp');
  const c1 = { name: 'a', format: 'hwpx', handle: null, dirty: true };
  const r1 = harness({ cur: c1, loss: LOSS, answer: 'hwp', picker: () => a });
  await r1.save(true, 'hwp');
  assert.deepStrictEqual(a.writes, [[1]]);
  const b = mkHandle('b.hwp');
  const c2 = { name: 'b', format: 'hwpx', handle: null, dirty: true };
  const r2 = harness({ cur: c2, loss: LOSS, answer: null, picker: () => b });
  await r2.save(true, 'hwp');
  assert.strictEqual(b.writes.length, 0);
  assert.strictEqual(r2.log.picked.length, 1, '취소했는데 저장 창을 또 열었습니다');
  assert.strictEqual(c2.dirty, true);
});

test('★★ 이미 고른 .hwp 에 «저장하기» 로 제자리 저장할 때도 빠지면 묻는다 (덮어쓰기 전에)', async () => {
  const mine = mkHandle('내가고른.hwp');
  const cur = { name: '내가고른', format: 'hwp', handle: mine, handleFromSave: true, dirty: true };
  const { save, log } = harness({ cur, loss: LOSS, answer: null, picker: () => { throw new Error('취소면 저장 창이 열리면 안 됩니다'); } });
  await save(false);
  assert.strictEqual(log.asked.length, 1);
  assert.strictEqual(mine.writes.length, 0, '묻기 전에 덮어썼습니다');
});

test('★★ 저장 창을 못 쓰는 브라우저에서도 빠지면 묻고, «.hwpx» 를 고르면 .hwpx 로 내려받는다', async () => {
  const cur = { name: '문서', format: 'hwpx', handle: null, dirty: true };
  const { save, log } = harness({ cur, pickerOk: false, loss: LOSS, answer: 'hwpx', picker: () => { throw new Error('없어야 함'); } });
  await save(true, 'hwp');
  assert.strictEqual(log.asked.length, 1);
  assert.strictEqual(log.downloads.length, 1);
  assert.match(log.downloads[0].name, /\.hwpx$/);
  assert.deepStrictEqual(log.downloads[0].bytes, [2]);
});

test('★★ «빠집니다» 묻는 창이 떠 있는 사이 탭이 바뀌어도 «.hwpx 로 저장» 은 처음 문서를 저장한다', async () => {
  const A = { name: '문서A', format: 'hwpx', handle: null, dirty: true };
  const B = { name: '문서B', format: 'hwpx', handle: null, dirty: true };
  const hwpA = mkHandle('문서A.hwp'), xA = mkHandle('문서A.hwpx');
  const { save, log } = harness({ cur: A, loss: LOSS, answer: 'hwpx', picker: (o, n) => (n === 1 ? hwpA : xA), onAsk: e => { e.docs.push(B); e.api.setCur(B); } });
  await save(true, 'hwp');
  assert.strictEqual(log.picked.length, 2);
  assert.match(log.picked[1].suggestedName, /^문서A\.hwpx$/, '두 번째 저장 창이 바뀐 탭(문서B) 이름을 제안했습니다');
  assert.deepStrictEqual(log.built.map(b => b.doc.name), ['문서A', '문서A'], '바뀐 탭의 내용을 저장했습니다');
  assert.strictEqual(A.handle, xA);
  assert.strictEqual(B.handle, null);
  assert.strictEqual(B.dirty, true);
});

test('★★★ 저장 창이 떠 있는 사이 다른 탭이 앞에 와도 «저장을 누른 문서» 를 저장한다', async () => {
  const A = { name: '문서A', format: 'hwpx', handle: null, dirty: true };
  const B = { name: '문서B', format: 'hwpx', handle: null, dirty: true };
  const fileA = mkHandle('문서A.hwpx');
  // 저장 창이 떠 있는 동안(기금 쪽지 등으로) 문서B 가 열려 앞에 온다
  const { save, log, env } = harness({ cur: A, picker: () => fileA, onPick: e => { e.docs.push(B); e.api.setCur(B); } });
  await save(true);
  assert.strictEqual(log.built.length, 1);
  assert.strictEqual(log.built[0].doc, A, '저장 창 뒤에 앞에 온 다른 문서(B)의 내용을 만들었습니다');
  assert.strictEqual(A.handle, fileA, '파일 연결이 다른 문서에 붙었습니다');
  assert.strictEqual(B.handle, null);
  assert.strictEqual(A.dirty, false);
  assert.strictEqual(B.dirty, true, '저장 안 된 다른 문서의 «고침» 표시가 꺼졌습니다');
  assert.ok(env.api.getCur() === A);
});

test('★★ 저장 창에서 «취소» 하면 아무것도 쓰지 않는다', async () => {
  const orig = mkHandle('원본.hwp');
  const cur = { name: '원본', format: 'hwp', handle: orig, dirty: true };
  const { save, log } = harness({ cur, picker: () => { const e = new Error('취소'); e.name = 'AbortError'; throw e; } });
  await save(false);
  assert.strictEqual(orig.writes.length, 0);
  assert.strictEqual(log.downloads.length, 0, '취소했는데 내려받기가 됐습니다');
  assert.strictEqual(cur.dirty, true, '저장이 안 됐으면 «고침» 표시가 남아야 합니다');
});

test('★★ 저장 창을 못 쓰는 브라우저: 원본 .hwp 는 건드리지 않고 .hwpx 로 «내려받기» 한다', async () => {
  const orig = mkHandle('원본.hwp');
  const cur = { name: '원본', format: 'hwp', handle: orig, dirty: true };
  const { save, log } = harness({ cur, pickerOk: false, picker: () => { throw new Error('없어야 함'); } });
  await save(false);
  assert.strictEqual(orig.writes.length, 0);
  assert.strictEqual(log.downloads.length, 1);
  assert.match(log.downloads[0].name, /\.hwpx$/);
});

test('★ 바뀐 동작은 소스에도 남아 있다 — 핸들 표시(handleFromSave)를 저장 창 경로에서 켠다', () => {
  assert.match(SAVE, /doc\.handleFromSave = true/);
  assert.match(SAVE, /hFmt === 'hwp' && !doc\.handleFromSave/);
});
