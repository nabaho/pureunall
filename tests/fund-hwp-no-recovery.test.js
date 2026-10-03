'use strict';
/* 한글 편집기의 「문서 복구」 창을 막는다 (대표 지시 2026-10-03 「문서복구창 막아」)
 *
 * 편집기(vendor/rhwp-studio)는 쓰는 중인 문서를 브라우저(IndexedDB)에 자동 저장했다가, 다음에 «아무» 문서나
 * 열면 「저장되지 않은 문서 복구본이 있습니다」를 띄운다 — [복구]하면 지금 연 서식 대신 «다른 문서»가 들어온다.
 * 「최근 문서」·「문서 이력」(문서 내용 24벌)도 같은 종류다. 셋 다 편집기를 열기 전·닫은 뒤에 비운다.
 * 브라우저로 재현(2026-10-03): 복구본 1개가 남은 채 — 예전 방식은 복구 창이 떴고, 고친 방식은 안 떴다.
 *   편집기의 인쇄·PDF로 인쇄·문서 비교·붙이기는 그대로 있었다(끼워 넣기 모드를 쓰지 않은 까닭).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; on = true; }
    else if (src[j] === '}') { d--; if (on && !d) return src.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const DBS_LINE = SRC.match(/var HWP_STUDIO_DBS=[^\n]*?;/)[0];

test('★★★ 편집기를 띄우기 «전»에 비운다 — 편집기가 시작하자마자 복구본을 찾는다', () => {
  const fn = grabFn(bare, '_openHwpBuf');
  const c = fn.indexOf('_hwpClearStudioStores()'), i = fn.indexOf("import('./vendor/rhwp-editor/index.js')");
  assert.ok(c >= 0, '★ 열기 전에 비우지 않는다 — 「문서 복구」 창이 뜬다');
  assert.ok(i > c, '★ 편집기를 부른 «뒤»에 비운다 — 이미 늦다');
  assert.match(fn, /_hwpClearStudioStores\(\)\.then\(function\(\)\{ return import\(/, '★ 비우기가 끝나기를 안 기다린다');
});

test('★★ 닫은 뒤에도 비운다 — 이 기금 서류가 브라우저에 남지 않게', () => {
  assert.match(grabFn(bare, 'closeHwp'), /_hwpClearStudioStores\(\)/);
});

test('★★ 비우는 저장소 이름이 편집기가 실제로 쓰는 이름과 같다 — 편집기 판이 바뀌면 여기서 걸린다', () => {
  const box = {}; new Function(DBS_LINE + ';this.D=HWP_STUDIO_DBS;').call(box);
  assert.deepEqual(box.D, ['rhwpStudioAutosave', 'rhwpStudioRecent', 'rhwpStudioDocHistory']);
  const dir = path.join(ROOT, 'vendor', 'rhwp-studio', 'assets');
  const bundle = fs.readdirSync(dir).filter((f) => /^index-.*\.js$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  box.D.forEach((n) => assert.ok(bundle.includes('`' + n + '`'), '★ 편집기에 «' + n + '» 저장소가 없다 — 이름이 바뀌었으면 여기도 바꾸세요'));
  assert.ok(bundle.includes('문서 복구'), '편집기의 복구 창 글이 바뀌었다 — 이 검사의 전제를 다시 보세요');
});

test('★ 끼워 넣기 모드(?chrome=embed)는 쓰지 않는다 — 편집기의 인쇄·PDF로 인쇄·문서 비교까지 없앤다', () => {
  assert.ok(!/chrome=embed/.test(bare), '★ 끼워 넣기 모드를 켰다 — 인쇄·문서 비교가 사라진다');
});

/* 실제로 돌려 본다 — 가짜 indexedDB 로 세 저장소를 다 지우는지, 막혀도·없어도 멈추지 않는지 */
function run(fakeIdb, opts) {
  const box = {}, calls = [];
  const idb = fakeIdb && {
    deleteDatabase(n) {
      calls.push(n);
      const r = {};
      if (fakeIdb === 'ok') setImmediate(() => r.onsuccess && r.onsuccess());
      if (fakeIdb === 'blocked') setImmediate(() => r.onblocked && r.onblocked());
      if (fakeIdb === 'throw') throw new Error('보안 오류');
      return r;                                  // 'never' — 아무 소식도 안 준다
    }
  };
  new Function('indexedDB', 'setTimeout', DBS_LINE + '\n' + grabFn(SRC, '_hwpClearStudioStores') + '\nthis.clear=_hwpClearStudioStores;')
    .call(box, idb, (opts && opts.fastTimer) ? (f) => setImmediate(f) : setTimeout);
  return { p: box.clear(), calls };
}

test('★★ 세 저장소를 모두 지운다', async () => {
  const r = run('ok'); await r.p;
  assert.deepEqual(r.calls, ['rhwpStudioAutosave', 'rhwpStudioRecent', 'rhwpStudioDocHistory']);
});

test('★★ 다른 탭이 잡고 있어도(막힘)·지우다 오류가 나도·소식이 없어도 편집기 열기가 멈추지 않는다', async () => {
  await run('blocked').p;
  await run('throw').p;
  await run('never', { fastTimer: true }).p;   // 1.5초 시한 — 여기서는 바로 넘긴다
  await run(null).p;                           // indexedDB 가 없는 브라우저
});
