/* 서고 올리기 — 개인정보 가림 화면 연결 (rules.html) · 2026-09-30 목업 ② 「추천대로」
   부품(redactFile)은 kordoc-redact.test.js 가 진짜 묶음으로 지키고, 여기서는 화면이 그 결과를
   «안전하게» 쓰는지 본다 — 가린 사본을 올리고, 한글이 아니면 원본을 안 담고, 남으면 안 올린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
const bare = html.replace(/\/\*[\s\S]*?\*\//g, ' ');
function fn(name) {
  const i = bare.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾지 못했습니다');
  let d = 0, j = bare.indexOf('{', i);
  for (; j < bare.length; j++) { if (bare[j] === '{') d++; else if (bare[j] === '}' && --d === 0) break; }
  return bare.slice(i, j + 1);
}

test('파일을 읽으면 올리기 전에 개인정보를 가려 보고, 그동안은 못 올린다', () => {
  assert.match(fn('cbRead'), /await cbPiiScan\(rows\)/, '★ 읽은 뒤 가려 보지 않는다');
  assert.match(bare, /\$\("cb-go"\)\.disabled=!sp\.ready\.length\|\|CB_PII\.busy/, '★ 살피는 동안에도 올릴 수 있다');
  assert.match(fn('cbUpload'), /if\(CB_PII\.busy\)\{ alert/);
});

test('올릴 때는 가린 사본 — 가린 글, 가린 한글 파일, 한글이 아니면 원본을 안 담는다', () => {
  const up = fn('cbUpload');
  const a = up.indexOf('rows=rows.map(cbPiiRow)'), b = up.indexOf('CB.uploadPlan(rows');
  assert.ok(a > 0 && b > a, '★ 가린 사본으로 바꾸기 «전에» 올릴 계획을 세운다');
  /* 행동으로 — cbPiiRow 를 떼어 돌린다 */
  const run = new Function('CB_PII', 'File', fn('cbPiiRow') + '; return cbPiiRow;');
  const FakeFile = function (parts, name) { this.parts = parts; this.name = name; };
  const on = run({ on: true }, FakeFile);
  const orig = { name: '가나상사.hwpx', text: '주민 900101-1234567', f: { type: 'x' } };
  const hwp = on(Object.assign({}, orig, { pii: { total: 1, text: '주민 900101-●●●●●●●', data: new Uint8Array([1]) } }));
  assert.equal(hwp.text, '주민 900101-●●●●●●●', '★ 가리지 않은 글이 올라간다');
  assert.ok(hwp.f instanceof FakeFile && hwp.f.parts[0][0] === 1, '★ 가린 파일이 아니라 원본이 올라간다');
  const pdf = on(Object.assign({}, orig, { name: '신고서.pdf', pii: { total: 2, text: '가린 글', data: null } }));
  assert.equal(pdf.f, null, '★ 한글이 아닌데 가리지 못한 원본 파일을 담는다');
  assert.equal(pdf.piiHeld, true);
  const clean = on(Object.assign({}, orig, { pii: { total: 0, text: 'x', data: null } }));
  assert.equal(clean.f, orig.f, '찾은 것이 없으면 원본 그대로');
  const off = run({ on: false }, FakeFile)(Object.assign({}, orig, { pii: { total: 1, text: '가린', data: new Uint8Array([1]) } }));
  assert.equal(off.text, orig.text, '가림을 끄면 원본 그대로 — 사람이 끈 것이다');
  assert.equal(orig.text, '주민 900101-1234567', '목록의 원본 줄은 건드리지 않는다');
});

test('가린 뒤에도 남았거나 살피다 실패했으면 «확인 필요» 로 — 올리지 않는다', () => {
  const run = new Function('CB_PII', fn('cbRecheck') + '; return cbRecheck;');
  const chk = run({ on: true });
  const r = { site: '가나상사', year: '2025', role: 'current', pii: { residual: 1, total: 3 } };
  chk(r);
  assert.equal(r.need, true);
  assert.ok(r.why.includes('개인정보 남음'));
  const r2 = { site: '가나상사', year: '2025', role: 'current', pii: { residual: 0, total: 3 } };
  chk(r2);
  assert.equal(r2.need, false);
  const r3 = { site: '가나상사', year: '2025', role: 'current', pii: { error: '엔진 실패', total: 0 } };
  chk(r3);
  assert.equal(r3.need, true, '★ 살피다 실패한 파일이 그대로 올라간다');
});

test('원래 번호는 화면에 안 그린다 — 가린 모양과 셈만', () => {
  const tag = fn('cbPiiTag'), row = fn('cbRowHtml');
  assert.match(tag, /PuKordocText\.countLabel\(p\.count\)/);
  assert.match(row, /s\.masked/);
  assert.doesNotMatch(tag + row, /r\.text|r\.pii\.text|p\.text/, '★ 가림 칸이 글(원래 번호가 든)을 그린다');
  assert.match(html, /<script src="js\/pu-kordoc-text\.js\?v=\d+"><\/script>/);
  assert.match(html, /id="cb-pii"/);
});
