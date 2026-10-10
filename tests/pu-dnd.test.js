'use strict';
/* 푸른 파일 끌어다 놓기 공용 모듈(js/pu-dnd.js)과 급여 프로그램 배선 (2026-10-10) — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const dnd = require('../js/pu-dnd.js');
const T = dnd._t;
const F = (name) => ({ name });

test('★ 받는 형식 — accept 에서 읽고, 종류(image/*)가 섞이면 제한 없음', () => {
  assert.deepEqual(T.acceptToExt('.hwp,.hwpx, .PDF'), ['hwp', 'hwpx', 'pdf']);
  assert.equal(T.acceptToExt('image/*'), null, '종류 표기인데 확장자 목록으로 읽는다');
  assert.equal(T.acceptToExt('.pdf,image/png'), null);
  assert.equal(T.acceptToExt(''), null);
  assert.equal(T.extOf(F('국민.2024.XLSX')), 'xlsx'); assert.equal(T.extOf(F('점없음')), '');
});

test('★ 단추 알아보기 — 규칙에 있고 인자 수가 맞을 때만', () => {
  const rules = { importPayroll: { argc: 0 }, pickTpl: { argc: 1 } };
  assert.equal(T.parse('importPayroll()', rules).fn, 'importPayroll');
  assert.deepEqual(T.parse("pickTpl('subsidy')", rules).args, ['subsidy']);
  assert.equal(T.parse('pickTpl()', rules), null); assert.equal(T.parse("importPayroll('x')", rules), null);
  assert.equal(T.parse('delAll()', rules), null, '다른 단추를 받는 곳으로 안다');
  assert.equal(T.parse("importPayroll();alert('x')", rules), null, '여러 문장');
  assert.equal(T.parse('constructor()', rules), null, '객체 기본 속성 이름이 통과');
});

test('★ 맞는 파일인가 — 형식·개수', () => {
  const one = { ext: ['json'], multi: false };
  assert.equal(T.fit(one, [F('a.JSON')]).ok, true);
  const bad = T.fit(one, [F('a.xlsx')]); assert.equal(bad.ok, false); assert.ok(bad.note.includes('.json') && bad.note.includes('a.xlsx'));
  const two = T.fit(one, [F('a.json'), F('b.json')]); assert.equal(two.files.length, 1); assert.ok(two.note.includes('첫 파일'));
  assert.equal(T.fit({ ext: null, multi: true }, [F('아무거나.zip'), F('b.png')]).files.length, 2);
  assert.equal(T.fit({ ext: ['pdf'], multi: true }, [F('a.pdf'), F('b.exe')]).ok, false, '섞인 형식을 받는다');
});

test('★ pick — 끌어온 파일이 있으면 폴더 찾기 없이 받는 코드가 그대로 돈다', () => {
  let clicked = 0, got = null;
  const inp = { click() { clicked++; }, onchange(ev) { got = ev.target.files; } };
  dnd.pick(inp, [F('a.json')]);
  assert.equal(clicked, 0); assert.equal(got[0].name, 'a.json'); assert.equal(inp.files[0].name, 'a.json');
  const inp2 = { click() { clicked++; }, onchange() { throw new Error('호출되면 안 됨'); } };
  dnd.pick(inp2); dnd.pick(inp2, []);
  assert.equal(clicked, 2);
});

test('★ 놓기 — exact 는 단추 «위»에서만, 아니면 받는 곳이 한 곳일 때만, 형식 틀리면 아무 일도', () => {
  const calls = []; global.importPayroll = (f) => calls.push(['payroll', f.map((x) => x.name)]); global.importBank = (f) => calls.push(['bank', f.map((x) => x.name)]);
  const msgs = []; T._cfg.toast = (m, t) => msgs.push((t || '') + ':' + m);
  const el = (n) => ({ textContent: n });
  const payroll = { el: el('급여 올리기'), kind: 'fn', fn: 'importPayroll', args: [], ext: ['json'], multi: false, exact: true };
  const bank = { el: el('통장'), kind: 'fn', fn: 'importBank', args: [], ext: ['xls', 'xlsx'], multi: false, exact: false };
  // 아무 데나 + exact 한 곳 → 안 받는다(덮어쓰기 방지)
  T.drop([F('a.json')], null, [payroll]); assert.equal(calls.length, 0, 'exact 인데 아무 데나 놓아도 받았다'); assert.ok(msgs.pop().includes('«위»'));
  // 그 단추 위 → 받는다
  T.drop([F('a.json')], payroll.el, [payroll]); assert.deepEqual(calls.pop(), ['payroll', ['a.json']]);
  // 아무 데나 + 받는 곳 한 곳(exact 아님)
  T.drop([F('b.xlsx')], null, [bank]); assert.deepEqual(calls.pop(), ['bank', ['b.xlsx']]);
  // 형식이 틀리면 아무 일도 안 한다
  T.drop([F('안내.pdf')], bank.el, [bank]); assert.equal(calls.length, 0); assert.ok(msgs.pop().includes('.xls .xlsx'));
  // 둘이 있으면 형식으로 가리고, 가려지지 않으면 안 받는다
  T.drop([F('c.json')], null, [payroll, bank]); assert.equal(calls.length, 0, 'exact 와 섞여 있어도 아무 데나로 덮어쓴다');
  T.drop([F('d.xlsx')], null, [payroll, bank]); assert.deepEqual(calls.pop(), ['bank', ['d.xlsx']], 'exact 가 아닌 한 곳이면 형식이 맞는 그쪽');
  T.drop([F('e.xlsx')], null, []); assert.ok(msgs.pop().includes('받는 곳이 없습니다'));
});

test('★ 배선 — 모듈 약속(막기·창·타임아웃)과 급여 프로그램 네 곳', () => {
  const m = fs.readFileSync(path.join(ROOT, 'js', 'pu-dnd.js'), 'utf8');
  assert.ok(m.includes("if (!has(e)) return; e.preventDefault();"), '드롭을 막지 않아 파일이 열린다');
  assert.ok(m.includes("root.document.getElementById('modalbg')") || m.includes("doc.getElementById('modalbg')"), '창 뒤의 단추가 켜진다');
  assert.ok(m.includes('root.setTimeout(end, 1500)'), '끌기를 그만둬도 켜진 채 남는다');
  assert.ok(!/\balert\(|\bconfirm\(/.test(m.replace(/\/\*[\s\S]*?\*\//g, '')), 'alert 는 끌어놓기를 막아 세운다');
  const p = fs.readFileSync(path.join(ROOT, 'payroll-os.html'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(/<script src="js\/pu-dnd\.js\?v=\d+"><\/script>/.test(p), '모듈을 안 싣는다');
  const init = p.slice(p.indexOf('PuDnd.init('), p.indexOf('PuDnd.init(') + 600);
  for (const k of ['importPayroll', 'importCards', 'importTaxTable', 'uploadRrn']) {
    assert.ok(new RegExp(k + ":\\{ext:\\['json'\\],argc:0,exact:true\\}").test(init), k + ' 이 exact 가 아니다(서버를 덮어쓴다)');
    assert.ok(new RegExp('function ' + k + '\\(dropped\\)').test(p), k + ' 이 dropped 를 안 받는다');
    assert.ok(p.includes('window.' + k + '=') || new RegExp('window\\.' + k + '\\s*=').test(p) || p.includes(k + '=' + k), k + ' 이 전역이 아니라 모듈이 못 부른다');
  }
  assert.equal((p.match(/PuDnd\.pick\(/g) || []).length, 4, '네 곳이 PuDnd.pick 으로 끝나지 않는다');
});
