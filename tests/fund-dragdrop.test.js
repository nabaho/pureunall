'use strict';
/* 기금관리 파일 끌어다 놓기 (2026-10-10) — 틀은 공용 모듈(js/pu-dnd.js, tests/pu-dnd.test.js 가 본다), 여기는 «규칙과 배선». 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); const e = SRC.indexOf('\n};', i); return SRC.slice(i, e + 3); };
const T = require('../js/pu-dnd.js')._t;

const box = {};
new Function([varSrc('DND_RULES'), fnSrc('_pickGo'), 'this.rules=DND_RULES; this.go=_pickGo;'].join('\n')).call(box);
const F = (name) => ({ name });

test('★ 규칙 — 열한 곳, 덮어쓰는 것은 exact', () => {
  assert.deepEqual(Object.keys(box.rules).sort(), ['cmImportPick', 'hwpTplUpload', 'importBank', 'importFundsInfo', 'importSites', 'importSubsidy', 'pickHwp', 'pickHwpBulk', 'pickTpl', 'uploadSubDoc', 'wrepBulkPick']);
  /* 덮어쓰는 일(원본·틀 교체, 사업장 백업)은 화면 아무 데나가 아니라 단추 «위»에서만 */
  for (const k of ['pickTpl', 'pickHwp', 'hwpTplUpload', 'importSites']) assert.equal(box.rules[k].exact, true, k + ' 이 아무 데나 놓아도 덮어쓴다');
  assert.equal(box.rules.importBank.exact, undefined, '통장 가져오기는 더하기라 아무 데나도 괜찮다');
  /* 이 화면 단추의 onclick 글자를 모듈이 알아본다 */
  assert.equal(T.parse('importBank()', box.rules).fn, 'importBank');
  assert.deepEqual(T.parse("pickTpl('subsidy')", box.rules).args, ['subsidy']);
  assert.equal(T.parse('delTxn(1)', box.rules), null);
  assert.equal(T.fit({ ext: box.rules.importBank.ext, multi: false }, [F('안내.pdf')]).ok, false);
});

test('★ _pickGo — 끌어온 파일이 있으면 폴더 찾기 없이, 없으면 예전처럼', () => {
  let clicked = 0, got = null;
  global.window = { PuDnd: { pick(inp, d) { got = d; } } }; global.PuDnd = global.window.PuDnd;   // 브라우저에서는 window 속성이 곧 전역
  box.go({ click() { clicked++; } }, [F('a.xlsx')]); assert.equal(got[0].name, 'a.xlsx'); assert.equal(clicked, 0);
  box.go({ click() { clicked++; } }); box.go({ click() { clicked++; } }, []); assert.equal(clicked, 2);
  global.window = {}; delete global.PuDnd;   // 모듈이 못 실려도 폴더 찾기는 열린다
  box.go({ click() { clicked++; } }, [F('a.xlsx')]); assert.equal(clicked, 3);
  delete global.window;
});

test('★ 배선 — 열한 함수가 dropped 를 받고 _pickGo 로 끝난다, 인자 수가 규칙과 맞다, 단추가 있다', () => {
  for (const [name, r] of Object.entries(box.rules)) {
    const src = fnSrc(name);
    const params = /^function \w+\(([^)]*)\)/.exec(src)[1].split(',').map((x) => x.trim()).filter(Boolean);
    assert.equal(params.length, (r.argc || 0) + 1, name + ' 인자 수가 규칙과 안 맞는다(' + params + ')');
    assert.equal(params[params.length - 1], 'dropped', name + ' 이 dropped 를 마지막으로 안 받는다');
    assert.ok(src.includes('_pickGo(inp,dropped);') && !src.includes('inp.click();'), name + ' 이 폴더 찾기만 연다');
    assert.ok(SRC.includes('onclick="' + name + '(') || SRC.includes("'" + name + "(") || SRC.includes(name + "('"), name + ' 을 부르는 단추가 없다');
  }
});

test('★ 공용 모듈로 한 벌 — 모듈을 싣고 규칙으로 시작하며, 인라인 틀·옛 CSS 는 없다', () => {
  assert.ok(/<script src="js\/pu-dnd\.js\?v=\d+"><\/script>/.test(SRC), '공용 모듈을 안 싣는다');
  assert.ok(SRC.includes('PuDnd.init({ rules:DND_RULES, toast:'), '모듈을 시작하지 않는다');
  for (const gone of ['_dndInit', '_dndParse', '_dndFit', '_dndCands', '.dnd-ok{', '#dndbar{']) assert.ok(!SRC.includes(gone), '옛 인라인 틀이 남았다: ' + gone);
  /* 모듈이 먼저 실려야 첫 그리기 전에 시작한다 */
  assert.ok(SRC.indexOf('js/pu-dnd.js') < SRC.indexOf('PuDnd.init('), '모듈이 시작보다 늦게 실린다');
});
