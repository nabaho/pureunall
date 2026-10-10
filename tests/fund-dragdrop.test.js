'use strict';
/* 파일은 «끌어다 놓기»가 먼저 (2026-10-10 대표 지시) — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); const e = SRC.indexOf('\n};', i); return SRC.slice(i, e + 3); };

const box = {};
new Function([
  varSrc('DND_RULES'), fnSrc('_dndExt'), fnSrc('_dndParse'), fnSrc('_dndFit'), fnSrc('_pickGo'),
  'this.rules=DND_RULES; this.parse=_dndParse; this.fit=_dndFit; this.go=_pickGo; this.ext=_dndExt;',
].join('\n')).call(box);

const btn = (onclick) => ({ getAttribute: (k) => (k === 'onclick' ? onclick : null) });
const F = (name) => ({ name });

test('★ 단추 알아보기 — 규칙에 있는 것만, 인자 수가 맞을 때만', () => {
  assert.equal(box.parse(btn('importBank()')).fn, 'importBank');
  assert.deepEqual(box.parse(btn("pickTpl('subsidy')")).args, ['subsidy']);
  assert.equal(box.parse(btn("pickTpl('')")).args.length, 1);
  assert.equal(box.parse(btn('pickTpl()')), null, '인자가 모자란데 알아본다');
  assert.equal(box.parse(btn("importBank('x')")), null, '인자가 남는데 알아본다');
  assert.equal(box.parse(btn('delTxn(1)')), null, '다른 단추를 받는 곳으로 안다');
  assert.equal(box.parse(btn("importBank();alert('x')")), null, '여러 문장을 받는 곳으로 안다');
  assert.equal(box.parse(btn("pickHwp('a'+b)")), null, '식이 섞인 인자');
  assert.equal(box.parse(btn(null)), null);
  assert.equal(box.parse(btn('constructor()')), null, '객체 기본 속성 이름이 규칙으로 통과');
});

test('★ 맞는 파일인가 — 형식·개수', () => {
  const bank = box.parse(btn('importBank()'));
  assert.equal(box.fit(bank, [F('국민_2024.XLSX')]).ok, true, '대문자 확장자');
  const bad = box.fit(bank, [F('안내.pdf')]);
  assert.equal(bad.ok, false); assert.ok(bad.note.includes('.xls .xlsx') && bad.note.includes('안내.pdf'));
  const two = box.fit(bank, [F('a.xlsx'), F('b.xlsx')]);
  assert.equal(two.ok, true); assert.equal(two.files.length, 1, '한 개짜리에 여러 개를 다 넘긴다'); assert.ok(two.note.includes('첫 파일'));
  const bulk = box.fit(box.parse(btn('pickHwpBulk()')), [F('a.hwp'), F('b.hwpx')]);
  assert.equal(bulk.files.length, 2, '여러 개짜리가 한 개만 받는다');
  assert.equal(box.fit(bulk && box.parse(btn('pickHwpBulk()')), [F('a.hwp'), F('b.pdf')]).ok, false, '섞인 형식을 받는다');
  assert.equal(box.fit(box.parse(btn('uploadSubDoc()')), [F('아무거나.zip')]).ok, true, '형식 제한 없는 곳');
  assert.equal(box.ext(F('점없음')), '');
});

test('★ _pickGo — 끌어온 파일이 있으면 폴더 찾기 없이 받는 쪽 코드가 그대로 돈다', () => {
  let clicked = 0, got = null;
  const inp = { click() { clicked++; }, onchange(ev) { got = ev.target.files; } };
  box.go(inp, [F('a.xlsx')]);
  assert.equal(clicked, 0, '끌어왔는데 폴더 찾기를 연다'); assert.equal(got[0].name, 'a.xlsx'); assert.equal(inp.files[0].name, 'a.xlsx', 'inp.files 로 읽는 쪽이 못 읽는다');
  const inp2 = { click() { clicked++; }, onchange() { throw new Error('호출되면 안 됨'); } };
  box.go(inp2, undefined); box.go(inp2, []);
  assert.equal(clicked, 2, '끌어오지 않았을 때는 예전처럼 폴더 찾기');
});

test('★ 배선 — 규칙의 모든 함수가 dropped 를 받고 _pickGo 로 끝난다, 인자 수가 맞다', () => {
  for (const [name, r] of Object.entries(box.rules)) {
    const src = fnSrc(name);
    const params = /^function \w+\(([^)]*)\)/.exec(src)[1].split(',').map((x) => x.trim()).filter(Boolean);
    assert.equal(params.length, r.argc + 1, name + ' 인자 수가 규칙과 안 맞는다(' + params + ')');
    assert.equal(params[params.length - 1], 'dropped', name + ' 이 dropped 를 마지막으로 안 받는다');
    assert.ok(src.includes('_pickGo(inp,dropped);') && !src.includes('inp.click();'), name + ' 이 폴더 찾기만 연다');
    assert.ok(SRC.includes('onclick="' + name + '(') || SRC.includes("'" + name + "(") || SRC.includes(name + "('"), name + ' 을 부르는 단추가 없다');
  }
  /* 끌어놓기 전용 규칙에 «삭제·승인» 같은 위험한 함수가 끼면 안 된다 */
  assert.deepEqual(Object.keys(box.rules).sort(), ['cmImportPick', 'hwpTplUpload', 'importBank', 'importFundsInfo', 'importSites', 'importSubsidy', 'pickHwp', 'pickHwpBulk', 'pickTpl', 'uploadSubDoc', 'wrepBulkPick']);
});

test('★ 이벤트 — 놓을 곳이 없어도 브라우저가 파일을 열지 못하게, 창이 떠 있으면 그 안만, 끌기를 그만두면 꺼진다', () => {
  const init = SRC.slice(SRC.indexOf('(function _dndInit(){'), SRC.indexOf('function dzOver(e,on){'));
  const drop = init.slice(init.indexOf("document.addEventListener('drop'"));
  assert.ok(drop.includes('if(!has(e)) return; e.preventDefault();'), '드롭을 막지 않아 파일이 열린다');
  assert.ok(init.includes("document.addEventListener('dragover'") && init.includes('e.preventDefault()'));
  assert.ok(init.includes('setTimeout(_dndEnd,1500)'), '끌기를 그만둬도 켜진 채 남는다');
  assert.ok(fnSrc('_dndCands').includes("document.getElementById('modalbg')||document"), '창 뒤의 단추가 켜진다');
  assert.ok(fnSrc('_dndRun').includes('okc.length===1') && fnSrc('_dndRun').includes('cands.length===1'), '여러 곳일 때 아무 데나 놓으면 엉뚱한 곳으로 간다');
  assert.ok(fnSrc('dzOver').includes('e.stopPropagation()'), '기존 끌어놓기 칸이 이중으로 받는다');
  assert.ok(SRC.includes('.dnd-ok{outline:2px dashed #fbbf24!important'));
  assert.ok(/\.dnd-ok\{[^}]*color:var\(--ink\)!important/.test(SRC), '켜진 단추 글씨가 배경에 묻힌다');
});
