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
function harness({ cur, picker, pickerOk = true }) {
  const log = { picked: [], toasts: [], downloads: [] };
  const win = {};
  const showSaveFilePicker = async opts => { log.picked.push(opts); return picker(opts); };
  if (pickerOk) win.showSaveFilePicker = showSaveFilePicker;
  const save = new Function('guardRO', 'cur', 'buildBytes', 'renderTabs', 'document', 'toast', 'window', 'showSaveFilePicker', 'HWP_TYPE', 'HWPX_TYPE', 'safeName', 'download',
    SAVE + '\nreturn save;')(
    () => false, cur, fmt => new Uint8Array([fmt === 'hwp' ? 1 : 2]), () => {}, { title: '' }, (m, bad) => log.toasts.push({ m, bad }), win, showSaveFilePicker,
    { id: 'hwp' }, { id: 'hwpx' }, n => n, (bytes, name, fmt) => log.downloads.push({ name, fmt, bytes: Array.from(bytes) }));
  return { save, log };
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
  assert.deepStrictEqual(other.writes, [[1]]);
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
  assert.match(SAVE, /cur\.handleFromSave = true/);
  assert.match(SAVE, /hFmt === 'hwp' && !cur\.handleFromSave/);
});
