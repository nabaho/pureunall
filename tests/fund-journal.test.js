'use strict';
/* 📜 작업 일지 · 묶음째 되돌리기 (자동화 확인 목업 7, 2026-10-09) — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';\n', i) + 1); };

const box = {};
new Function([
  "var funds={'F-1':{short_name:'가람 1호'},'F-2':{short_name:'나래 2호'}};",
  varSrc('JL'), varSrc('JL_ROOT'), fnSrc('_jlPath'), fnSrc('_jlSame'), fnSrc('_jlMachine'), fnSrc('_jlRows'), fnSrc('_jlCells'), fnSrc('_jlState'),
  'this.JL=JL; this.path=_jlPath; this.same=_jlSame; this.rows=_jlRows; this.cells=_jlCells; this.state=_jlState;',
].join('\n')).call(box);

const D = {
  audit: {
    'F-1': { a1: { at: '2026-10-09 09:00:00', by: '김가람', what: '기금 정보 저장', detail: '2칸', bid: 'b1' },
             a2: { at: '2026-09-20 10:00:00', by: '김가람', what: '결산 확정', detail: '2025년' } },
    'F-2': { a3: { at: '2026-10-08 11:00:00', by: '이나래', what: '재직증명서 한꺼번에 읽기', bid: 'b2' } },
  },
  batches: {
    b1: { meta: { at: '2026-10-09 09:00:00', by: '김가람', what: '기금 정보 저장', src: '', n: 2 },
          cells: { 'F-1|f|manager': { b: '가', a: '나' }, 'F-1|f|phone': { a: '000-0000' } } },
    b2: { meta: { at: '2026-10-08 11:00:00', by: '이나래', what: '재직증명서 한꺼번에 읽기', src: 'scan:wrep', n: 3 },
          cells: { 'F-2|s|S1|wrep_name': { a: '최한결' }, 'F-1|s|S9|wrep_title': { b: '대리', a: '과장' }, 'F-2|s|S2|x': { x: 1 } } },
  },
};

test('★ 칸 열쇠 → 자료 경로', () => {
  assert.deepEqual(box.path('F-1|f|manager'), { fid: 'F-1', key: 'f|manager', path: 'funds/F-1/manager' });
  assert.deepEqual(box.path('F-1|y|2025|S1|contrib'), { fid: 'F-1', key: 'y|2025|S1|contrib', path: 'site_years/F-1/2025/S1/contrib' });
  assert.equal(box.path('F-1|z|a'), null);
  assert.equal(box.path('F-1|f'), null);
});

test('★ 줄 — 변경 기록 + 기록 없는 묶음(기금마다 한 줄) · 기간·기계/사람·찾기 · 최근이 위', () => {
  const now = '2026-10-09 12:00:00';
  let r = box.rows(D, { range: 'all', who: 'all' }, now);
  assert.deepEqual(r.map((x) => x.fid + ':' + x.what.slice(0, 4) + ':' + (x.bid || '-')),
    ['F-1:기금 정:b1', 'F-2:재직증명:b2', 'F-1:재직증명:b2', 'F-1:결산 확:-'],'묶음이 기록에 없는 기금 줄이 빠졌거나 겹쳤다');
  assert.equal(box.rows(D, { range: 'today' }, now).length, 1);
  assert.equal(box.rows(D, { range: 'week' }, now).length, 3, '이번 주 = 오늘 포함 7일');
  assert.deepEqual(box.rows(D, { range: 'all', who: 'm' }, now).map((x) => x.bid), ['b2', 'b2']);
  assert.equal(box.rows(D, { range: 'all', who: 'h' }, now).length, 2);
  assert.equal(box.rows(D, { range: 'all', q: '나래' }, now).length, 2, '기금 이름으로 못 찾는다');
});

test('★ 펼친 칸 — 그 기금 칸만 · 빈 표시(x)는 뺀다 · 상태는 «지금 값이 이 묶음 값 그대로»일 때만 되돌림', () => {
  box.JL.data = D;
  const c = box.cells('b2', 'F-2');
  assert.deepEqual(c.map((x) => x.ck), ['F-2|s|S1|wrep_name']);
  assert.equal(box.state(c[0], { v: '최한결', p: { m: 1, src: 'scan:wrep' } }), 'back');
  assert.equal(box.state(c[0], { v: '최한결', p: { m: 1, ok: { by: '김가람', at: 'x' } } }), 'okd', '사람이 확인한 칸을 묻지 않고 되돌린다');
  assert.equal(box.state(c[0], { v: '최한결', p: { m: 1, ok: { by: '자동 확정', at: 'x', rule: 'p~scan:wrep~wrep_name' } } }), 'back');
  assert.equal(box.state(c[0], { v: '최한별', p: null }), 'moved', '그 뒤 바뀐 칸을 되돌린다');
  assert.equal(box.state(c[0], undefined), 'unk');
  assert.ok(box.same(null, '') && box.same(['a'], ['a']) && !box.same(1, 2));
});

test('★ 배선 — 되돌리기는 대표·관리자만 · 바뀐 칸 안 건드림 · 되돌린 것도 _track 으로 · □·# · ⓘ', () => {
  const u = fnSrc('jlUndo');
  assert.match(u, /if\(!_isBoss\(\)\)/);
  assert.match(u, /if\(st==='back'\) back\.push\(c\); else if\(st==='okd'\) okd\.push\(c\); else moved\+\+;/);
  assert.match(u, /var list=back\.concat\(withOk\?okd:\[\]\)/, '사람이 확인한 칸을 묻지 않고 섞는다');
  assert.match(u, /_track\(list\.map\(function\(c\)\{ return \{path:c\.P\.path, a:_provEmpty\(c\.b\)\?null:c\.b, b:c\.a, m:0, src:'undo'/);
  assert.match(fnSrc('renderJournal'), /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  assert.match(fnSrc('renderJournal'), /hlp\('journal\.log'\)/);
  assert.match(SRC, /'journal\.log':\{t:'작업 일지/);
  assert.match(fnSrc('renderReview'), /rvPage\(\\'journal\\'\)/);
});

test('★ 되돌리기 — 원본 옆 확인·그 뒤 사람이 다시 쓴 칸도 «사람 확인», Esc 는 아무것도 안 함 (코드 검토 2026-10-09)', () => {
  box.JL.data = D;
  const c = box.cells('b2', 'F-2')[0];
  assert.equal(box.state(c, { v: '최한결', p: { m: 1, how: 'dialog', bid: 'b2' } }, 'b2'), 'okd', '원본 옆에서 보고 넣은 값을 묻지 않고 되돌린다');
  assert.equal(box.state(c, { v: '최한결', p: { m: 0, bid: 'b9' } }, 'b2'), 'okd', '그 뒤 사람이 다시 쓴 값을 묻지 않고 되돌린다');
  assert.equal(box.state(c, { v: '최한결', p: { m: 0, bid: 'b2' } }, 'b2'), 'back', '사람이 한 묶음 자체는 되돌릴 수 있어야 한다');
  const u = fnSrc('jlUndo');
  assert.ok(u.includes('<button onclick="JL.pend=null;closeM()">취소</button>'), '세 갈래 창에 취소가 없다');
  assert.doesNotMatch(u, /cancel:'빼고 되돌리기'/, 'Esc 가 «빼고 되돌리기»로 먹던 옛 길이 남았다');
});
