/* 사업자등록증 «여러 장» → 참여사업장 여러 곳
 *
 * 대표 지시 2026-09-12 (남은 차례 ②): 「2번진행」
 *   — 사업자등록증 여러 장을 한꺼번에 읽어 참여사업장을 여러 곳 만든다.
 *
 * 공동기금은 참여사업장이 열 곳 스무 곳이다. 한 곳씩 창을 열어 읽히면 그 자체가 하루 일이다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 상호·사람 이름·번호는 전부 가짜다.
 *
 * 이 검사가 지키는 것
 *  ① «바로 만들지 않는다» — 표로 보여 주고 사람이 고친 뒤에 만든다
 *  ② 상호를 못 읽은 줄은 만들지 않는다 (빈 이름은 명부에서 못 찾는다)
 *  ③ 이미 있는 사업장은 꺼 둔다 (두 번 들어가면 출연금이 두 번 세어진다)
 *  ④ OCR 일꾼을 «한 번만» 만든다 (장마다 만들면 열 장에 몇 분이 걸린다)
 *  ⑤ 원본 잇기는 «곁다리»다 — 실패해도 사업장은 남는다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}

/* ══════════ ① 이미 있는 사업장 가리기 ══════════ */

const DUP = (() => {
  const box = {};
  new Function([grabFn('_digits'), grabFn('_coNorm'), grabFn('bizDupOf'), 'this.dup=bizDupOf;'].join('\n')).call(box);
  return box.dup;
})();

const SITES = {
  a: { name: '가나기계', biz_no: '123-45-67890', status: 'active' },
  b: { name: '다라전자', biz_no: '234-56-78901', status: 'active' },
  c: { name: '닫은곳', biz_no: '345-67-89012', status: 'closed' },
};

test('★ 사업자등록번호가 같으면 이미 있는 사업장이다 — 구분기호는 무시한다', () => {
  assert.equal(DUP({ name: '전혀다른이름', biz_no: '1234567890' }, SITES).name, '가나기계');
  assert.equal(DUP({ name: '전혀다른이름', biz_no: '123-45-67890' }, SITES).name, '가나기계');
});

test('★ 번호가 없으면 상호가 «완전히» 같을 때만 이미 있는 것으로 본다', () => {
  assert.equal(DUP({ name: '가나기계' }, SITES).name, '가나기계');
  assert.equal(DUP({ name: '㈜가나기계' }, SITES).name, '가나기계', '㈜·주식회사·공백은 무시한다');
  assert.equal(DUP({ name: '가나기계산업' }, SITES), null, '부분일치를 쓰면 다른 회사가 섞인다');
  assert.equal(DUP({ name: '가나' }, SITES), null);
});

test('탈퇴한 사업장과는 견주지 않는다 — 나갔다 다시 들어오는 회사가 있다', () => {
  assert.equal(DUP({ name: '닫은곳', biz_no: '345-67-89012' }, SITES), null);
});

test('읽은 것이 없으면 «이미 있다»고 하지 않는다', () => {
  assert.equal(DUP({}, SITES), null);
  assert.equal(DUP({ name: '', biz_no: '' }, SITES), null);
  assert.equal(DUP({ name: '가나기계' }, {}), null);
});

test('짧은 번호는 번호로 보지 않는다 — 잘못 읽은 번호가 남의 회사에 붙는다', () => {
  assert.equal(DUP({ name: '새회사', biz_no: '123-45' }, SITES), null);
});

/* ══════════ ② 여러 장 고르기 ══════════ */

test('★ 사진첩 창이 «여러 장 고르기»를 켤 수 있다', () => {
  assert.match(grabFn('openAlbumPick'), /function openAlbumPick\(zid,kind,sid,shelf,txn,wrepSid,multi\)/);
  assert.match(grabFn('openAlbumPick'), /multi:!!multi, sel:\{\}/);
  assert.match(grabFn('bizregBulkPick'), /openAlbumPick\('','bizreg','','','','',true\)/);
});

test('★ 여러 장 고르기에서는 사진을 눌러도 «고르기만» 한다 — 누르는 즉시 판독하면 안 된다', () => {
  const fn = grabFn('pickAlbumPhoto');
  const i = fn.indexOf('if(_pick.multi){ _pickToggle(id); return; }');
  assert.ok(i >= 0, '여러 장 갈래가 없다');
  ['_pick.shelf', '_pick.wrep', '_pick.sid', '_pick.txn'].forEach((k) => {
    assert.ok(fn.indexOf(k) > i, k + ' 갈래가 «여러 장» 갈래보다 앞선다 — 한 장이 그대로 연결돼 버린다');
  });
});

test('고른 수와 단추가 창 아래에 선다', () => {
  const fn = grabFn('renderPickBar');
  assert.match(fn, /장 고름/);
  assert.match(fn, /bizregBulkRun\(\)/);
  assert.match(fn, /n\?'':' disabled'/, '한 장도 안 골랐는데 읽기를 누를 수 있다');
});

test('한 장 고르기 창은 종전 그대로다 — 체크 표시가 끼어들지 않는다', () => {
  assert.match(grabFn('renderAlbumPick'), /_pick\.multi\?\(/, '여러 장일 때만 표시가 붙어야 한다');
});

/* ══════════ ③ 읽기 — 일꾼은 한 번만 ══════════ */

test('★★ OCR 일꾼을 «한 번만» 만든다 — 장마다 만들면 열 장에 몇 분이 걸린다', () => {
  const fn = grabFn('bizregBulkRead');
  assert.match(fn, /bulkOcrWorker\(/, '전용 일꾼을 안 만든다');
  assert.ok(fn.indexOf('ocrCanvases(') < 0, 'ocrCanvases 는 한 장짜리라 장마다 일꾼을 새로 만든다');
  assert.equal((fn.match(/bulkOcrWorker\(/g) || []).length, 1, '일꾼을 여러 번 만든다');
  assert.match(fn, /W\.recognize\(cv\)/, '만들어 둔 일꾼으로 읽지 않는다');
});

test('★ 실패해도 일꾼을 반드시 끝낸다 — 안 끝내면 WASM 메모리가 샌다', () => {
  const fn = grabFn('bizregBulkRead');
  assert.match(fn, /var W=null, fin=function\(\)\{[\s\S]{0,160}terminate\(\)/);
  assert.ok((fn.match(/fin\(\);/g) || []).length >= 2, '성공·실패 두 길에서 다 끝내야 한다');
});

test('한 장이 실패해도 나머지를 계속 읽는다 — 줄에 까닭을 남긴다', () => {
  assert.match(grabFn('bizregBulkRead'), /\.catch\(function\(err\)\{\s*\n?\s*B\.rows\.push\(\{_pick:pk, _err:/);
});

test('멈추기를 누르면 더 읽지 않는다 · 기금을 옮겨도 멈춘다', () => {
  const fn = grabFn('bizregBulkRead');
  assert.match(fn, /if\(B\.stop\|\|S\.fundId!==B\.fid\) return;/);
  assert.match(grabFn('bizregBulkStop'), /_bulkBiz\.stop=true/);
});

test('PDF 로 올린 사업자등록증도 읽는다', () => {
  // 소스 안에서는 정규식 리터럴이라 빗금이 이스케이프돼 있다(data:application\/pdf)
  assert.match(grabFn('_bulkCanvases'), /data:application\\\/pdf/);
  assert.match(grabFn('_bulkCanvases'), /pdfPageCanvases\(buf,1\)/);
});

/* ══════════ ④ 확인 표를 «정말 그려» 본다 ══════════ */

function drawReview(rows, sites) {
  const box = {}, out = { html: '' };
  new Function('ROWS', 'SITES', 'OUT', [
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    'function closeM(){ OUT.closed=true; }',
    'function toast(m,k){ OUT.toast=m; }',
    'function showModal(h){ OUT.html=h; }',
    'var S={sites:SITES};',
    'var _bulkBiz={rows:ROWS, picks:ROWS, fid:"F", yr:2026};',
    grabFn('_digits'), grabFn('_coNorm'), grabFn('bizDupOf'),
    grabDecl('BB_COLS'), grabFn('bizregBulkReview'),
    'this.run=function(){ bizregBulkReview(); return _bulkBiz.rows; };',
  ].join('\n')).call(box, rows, sites, out);
  const after = box.run();
  return { html: out.html, rows: after, out: out };
}

test('★ 확인 표를 «정말 그리면» 줄이 성한 채로 나온다 — 변수가 새지 않는다', () => {
  const { html } = drawReview([
    { name: '마바산업', ceo: '최마바', biz_no: '456-78-90123', biz_type: '제조업', address: '어느시 어느로 1', _pick: {} },
  ], SITES);
  assert.ok(html.includes('id="bb-on-0"'), '체크상자가 없다');
  assert.ok(html.includes('id="bb-name-0"'), '상호 입력칸이 없다');
  assert.ok(html.includes('bizregBulkSave()'), '만들기 단추가 없다');
  assert.ok(!/\+[A-Za-z_$][\w$]*\+/.test(html), '보간되지 않은 변수가 새어 나왔다');
  assert.ok(!/undefined|\[object/.test(html), 'undefined 가 샜다');
});

test('★★ 새 회사만 켜진다 — 이미 있는 곳과 못 읽은 줄은 꺼진다', () => {
  const { html, rows } = drawReview([
    { name: '마바산업', ceo: '최마바', _pick: {} },                 // 새 회사 → 켜짐
    { name: '가나기계', biz_no: '123-45-67890', _pick: {} },        // 이미 있음 → 꺼짐
    { ceo: '읽긴읽음', _pick: {} },                                  // 상호 없음 → 꺼짐
    { _err: '원본을 찾지 못했습니다', _pick: {} },                    // 못 읽음 → 꺼짐
  ], SITES);
  assert.deepEqual(rows.map((r) => !!r._on), [true, false, false, false]);
  assert.ok(html.includes('이미 있음'), '이미 있다고 말하지 않는다');
  assert.ok(html.includes('상호를 못 읽었습니다'));
  assert.ok(html.includes('못 읽음'));
  assert.ok(html.includes('새로 만듦'));
  assert.match(html, />1곳 만들기</, '켜진 줄 수를 단추에 안 적는다');
});

test('★ 「상호가 서식에 그대로 나간다」고 표 위에 적어 둔다', () => {
  const { html } = drawReview([{ name: '마바산업', _pick: {} }], SITES);
  assert.ok(html.includes('설립합의서'), '어디에 쓰이는 이름인지 안 알려 준다');
  assert.ok(html.includes('OCR'), 'OCR 로 읽었다는 표시가 없다');
});

test('읽은 것이 하나도 없으면 표를 안 띄운다', () => {
  const { out } = drawReview([], SITES);
  assert.equal(out.html, '');
  assert.ok(out.closed, '빈 창이 열린 채로 남는다');
});

/* ══════════ ⑤ 만들기 ══════════ */

function runSave(rows, form) {
  const box = {}, out = { wrote: [], asked: null, updates: [] };
  new Function('ROWS', 'FORM', 'OUT', [
    'function toast(m,k){ OUT.toast=m; }',
    'function closeM(){}',
    'function renderFund(){}',
    'function ymd(){ return "2026-09-12"; }',
    'function $(id){ return FORM[id]||null; }',
    'function confirmM(msg,o){ OUT.asked=msg; return Promise.resolve(true); }',
    'var NS="fund_erp"; var S={fundId:"F",view:"fund",sitesFor:"F"};',
    'var fbDb={ ref:function(p){ return {',
    '  push:function(){ var k="s"+(OUT.wrote.length+1); return { key:k,',
    '    set:function(o){ OUT.wrote.push({path:p,key:k,o:o}); return Promise.resolve(); } }; },',
    '  update:function(u){ OUT.updates.push({path:p,u:u}); return Promise.resolve(); } }; } };',
    'var _bulkBiz={rows:ROWS, fid:"F", yr:2026};',
    grabFn('bizregBulkSave'),
    'this.run=bizregBulkSave;',
  ].join('\n')).call(box, rows, form, out);
  box.run();
  return out;
}

test('★★ 켜진 줄만 만든다', async () => {
  const rows = [{ name: '마바산업', ceo: '최마바', biz_no: '456-78-90123', _pick: { year: '2026', id: 'p1', owner: '' } },
    { name: '사아전기', _pick: { year: '2026', id: 'p2', owner: '' } }];
  const out = runSave(rows, {
    'bb-on-0': { checked: true }, 'bb-name-0': { value: '마바산업' }, 'bb-ceo-0': { value: '최마바' },
    'bb-on-1': { checked: false }, 'bb-name-1': { value: '사아전기' }, 'bb-ceo-1': { value: '' },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(out.wrote.length, 1);
  assert.equal(out.wrote[0].o.name, '마바산업');
  assert.equal(out.wrote[0].o.ceo, '최마바');
  assert.equal(out.wrote[0].o.biz_no, '456-78-90123');
  assert.equal(out.wrote[0].o.status, 'active');
});

test('★★ 상호를 지우면 만들지 않는다 — 빈 이름은 명부에서 찾을 수도 없다', async () => {
  const rows = [{ name: '마바산업', _pick: { year: '2026', id: 'p1', owner: '' } }];
  const out = runSave(rows, { 'bb-on-0': { checked: true }, 'bb-name-0': { value: '   ' }, 'bb-ceo-0': { value: '' } });
  await new Promise((r) => setImmediate(r));
  assert.equal(out.wrote.length, 0);
  assert.match(String(out.toast || ''), /만들 사업장이 없습니다/);
});

test('★ 표에서 고친 상호·대표자가 «고친 대로» 들어간다', async () => {
  const rows = [{ name: '잘못읽은이름', ceo: '잘못', _pick: { year: '2026', id: 'p1', owner: '' } }];
  const out = runSave(rows, { 'bb-on-0': { checked: true }, 'bb-name-0': { value: '마바산업' }, 'bb-ceo-0': { value: '최마바' } });
  await new Promise((r) => setImmediate(r));
  assert.equal(out.wrote[0].o.name, '마바산업');
  assert.equal(out.wrote[0].o.ceo, '최마바');
});

test('★★ 확인을 «먼저» 묻는다 — 무엇이 안 들어오는지도 말한다', async () => {
  const rows = [{ name: '마바산업', _pick: { year: '2026', id: 'p1', owner: '' } }];
  const out = runSave(rows, { 'bb-on-0': { checked: true }, 'bb-name-0': { value: '마바산업' }, 'bb-ceo-0': { value: '' } });
  await new Promise((r) => setImmediate(r));
  assert.match(String(out.asked || ''), /마바산업/);
  assert.match(String(out.asked || ''), /출연 약정액/, '출연금이 안 들어온다는 말이 없다');
});

test('만들면서 사업자등록증 원본도 사업장마다 이어 준다', async () => {
  const rows = [{ name: '마바산업', _pick: { year: '2026', id: 'p1', owner: '' } }];
  const out = runSave(rows, { 'bb-on-0': { checked: true }, 'bb-name-0': { value: '마바산업' }, 'bb-ceo-0': { value: '' } });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const u = out.updates[0];
  assert.ok(u, '원본을 안 잇는다');
  assert.match(u.path, /subsidy_chk\/F\/2026/);
  assert.ok(u.u['scan/site/s1/bizno'], '참조를 안 남긴다');
  assert.equal(u.u['site/s1/bizno'], 1, '「받음」 표시를 안 켠다');
});

test('★ 원본 잇기는 «곁다리»다 — 실패해도 사업장은 남는다', () => {
  const fn = grabFn('bizregBulkSave');
  assert.match(fn, /\}\)\(\)\)\.catch\(function\(\)\{\}\);/,
    '잇기가 실패하면 만든 사업장까지 실패로 센다');
  // 사업장 만들기가 실패했을 때만 실패로 센다
  assert.match(fn, /\}\)\.catch\(function\(\)\{ fail\+\+; \}\);/);
});

/* ══════════ ⑥ 배선·설명 ══════════ */

test('참여사업장 화면에 단추가 있다', () => {
  assert.ok(SRC.indexOf('bizregBulkPick()') >= 0, '누를 곳이 없다');
  assert.ok(SRC.indexOf('📚 사업자등록증 여러 장') >= 0);
});

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(help.indexOf("'site.bulkdoc':{") >= 0, 'site.bulkdoc 설명이 없다');
  assert.ok(SRC.indexOf("hlp('site.bulkdoc')") >= 0, '어디서도 ⓘ 를 부르지 않는다');
});

test('ⓘ 가 «기업정보함이 먼저»라고 말한다 — 느린 길로 먼저 가게 두면 안 된다', () => {
  const i = SRC.indexOf("'site.bulkdoc':{");
  const help = SRC.slice(i, i + 2400);
  assert.ok(help.indexOf('기업정보함이 먼저') >= 0);
  assert.ok(help.indexOf('일괄 채우기') >= 0);
});

test('같은 이름 함수를 두 번 선언하지 않았다 — 나중 것이 이겨 조용히 깨진다', () => {
  ['bizregBulkPick', 'bizregBulkRun', 'bizregBulkRead', 'bizregBulkReview', 'bizregBulkSave',
    'bizDupOf', 'bulkOcrWorker', '_bulkCanvases', 'renderPickBar', '_pickToggle'].forEach((n) => {
    const c = (SRC.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있다');
  });
});
