'use strict';
/* 🔍 업체 정보 대조 (대표 지시 2026-10-03 「대표·담당자가 제대로 연결이 안 되는 경우 — 근본적으로」 → 1단계)

   못 박는 것(규칙):
   ① 짝은 «사업자번호로만» — 이름이 같아도 번호가 없으면 짝짓지 않는다(같은 이름 다른 회사).
   ② 번호가 없거나 검산에 걸리면 «못 잇는 업체»로 따로 센다 — 조용히 빠지지 않는다.
   ③ 대표자는 사람 단위로 본다 — 공동대표 중 한 분만 겹쳐도 같다. ceo2 도 본다.
   ④ 상호는 같음 · 표기만 다름(한쪽이 품음) · 다름 셋으로 가른다.
   ⑤ 업체만 비었고 등록증엔 있으면 «빈칸»(다름과 따로).
   ⑥ 주소는 화면이 넘겨준 잣대(PuAddr.same) 그대로 — 「📍 주소 대조」와 같은 말을 한다.
   ⑦ 이관·종료된 계약의 옛 사본은 안 본다. 진행 중 계약의 사본만.
   ⑧ 이 창이 저장하는 것은 «빈칸 채우기» 하나 — props.onFill(=coUpsertMany) 한 길로만, 직접 저장 부름은 없다.
   ⑨ 빈칸 채우기(대표 지시 2026-10-03 「빈칸채우기 해라」)는 «저장 직전에도 비어 있는» 칸만 채우고,
      되돌리기는 «넣은 값 그대로»인 칸만 비운다 — 그사이 사람이 적은 값을 덮지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const M = require(path.join(ROOT, 'js', 'pu-co-mismatch.js'));
const K = require(path.join(ROOT, 'js', 'pu-cokey.js'));
const PA = require(path.join(ROOT, 'js', 'pu-addr.js'));
const norm = (s) => String(s || '').toLowerCase().replace(/\(\s*주\s*\)|㈜|주식회사/g, '').replace(/[\s\-()·.,]/g, '');

/* 검산을 통과하는 사업자번호를 앞 아홉 자리로 만든다(국세청 규칙 — pu-cokey.js 와 같은 셈) */
function bizNo(nine) {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let s = 0;
  for (let i = 0; i < 9; i++) s += (+nine[i]) * w[i];
  s += Math.floor((+nine[8]) * 5 / 10);
  const no = nine + ((10 - (s % 10)) % 10);
  assert.ok(K.bizNoOk(no), '검산 번호를 못 만들었다: ' + no);
  return no.slice(0, 3) + '-' + no.slice(3, 5) + '-' + no.slice(5);
}
const B1 = bizNo('123456789'), B2 = bizNo('220811234'), B3 = bizNo('105871111'), B4 = bizNo('314159265'), B5 = bizNo('271828182');
const bad = (no) => { const d = no.replace(/\D/g, ''); return d.slice(0, 9) + ((+d[9] + 1) % 10); };

function idx(list) { const o = {}; list.forEach((r, i) => { o['i' + i] = Object.assign({ k: 'biz' }, r); }); return o; }
function run(companies, certs, contracts) {
  return M.build(companies, contracts || [], idx(certs),
    { keyOf: K.key, looksLikeBizNo: K.looksLikeBizNo, normName: norm, addrSame: PA.same });
}
const row = (r, id) => r.rows.find((x) => x.co.id === id);

test('★★ 짝은 사업자번호로만 — 이름이 같아도 번호가 없으면 짝짓지 않고 «못 잇는 업체»로 센다', () => {
  const r = run(
    [{ id: 'a', name: '가나상사', ceo: '홍길동' },
     { id: 'b', name: '다라테크', bizNo: bad(B2), ceo: '김철수' }],
    [{ c: '가나상사', bz: B1, ceo: '이영희' }, { c: '다라테크', bz: B2, ceo: '최나래' }]);
  assert.equal(r.rows.length, 0, '번호 없이 이름으로 짝지었다');
  assert.equal(r.count.noKey, 2);
  assert.deepEqual(r.noKey.map((x) => x.why).sort(), ['bad', 'none']);
});

test('★★ 대표자 — 다르면 다름, 공동대표 한 분만 겹쳐도 같음, ceo2 도 본다', () => {
  const r = run(
    [{ id: 'x', name: '가나상사', bizNo: B1, ceo: '홍길동' },
     { id: 'y', name: '마바산업', bizNo: B2, ceo: '김철수' },
     { id: 'z', name: '사아물산', bizNo: B3, ceo: '박민수', ceo2: '이영희' }],
    [{ c: '가나상사', bz: B1, ceo: '김철수' },
     { c: '마바산업', bz: B2, ceo: '김철수, 최나래' },
     { c: '사아물산', bz: B3, ceo: '이영희' }]);
  assert.equal(row(r, 'x').f.ceo, 'diff', '대표가 다른데 못 잡았다');
  assert.equal(row(r, 'y'), undefined, '공동대표 한 분이 겹치는데 다르다고 했다');
  assert.equal(row(r, 'z'), undefined, '둘째 대표(ceo2)를 안 봤다');
  assert.equal(r.count.ceo, 1);
});

test('★ 상호 — ㈜ 표기 차이는 같음, 한쪽이 품으면 «표기만 다름», 아예 다르면 다름', () => {
  const r = run(
    [{ id: 'p', name: '㈜가나상사', bizNo: B1 },
     { id: 'q', name: '다라테크', bizNo: B2 },
     { id: 's', name: '마바산업', bizNo: B3 }],
    [{ c: '주식회사 가나상사', bz: B1 },
     { c: '다라테크 서울지점', bz: B2 },
     { c: '사아바이오', bz: B3 }]);
  assert.equal(row(r, 'p'), undefined, '㈜/주식회사 차이를 다르다고 했다');
  assert.equal(row(r, 'q').f.name, 'near');
  assert.equal(row(r, 'q').diffs.length, 0, '표기만 다른 것을 빨강(다름)에 넣었다');
  assert.equal(row(r, 's').f.name, 'diff');
  assert.equal(r.count.near, 1);
  assert.equal(r.count.name, 1);
});

test('★ 업체만 비었고 등록증엔 있으면 «빈칸» — 다름과 따로 센다', () => {
  const r = run([{ id: 'e', name: '가나상사', bizNo: B1 }],
    [{ c: '가나상사', bz: B1, ceo: '홍길동', ad: '서울특별시 마포구 월드컵로 1', ct: '02-123-4567' }]);
  const x = row(r, 'e');
  assert.deepEqual(x.empties.sort(), ['addr', 'ceo', 'tel']);
  assert.equal(x.diffs.length, 0);
  assert.equal(r.count.diff, 0);
  assert.equal(r.count.empty, 3);
});

test('★ 주소는 넘겨받은 잣대 그대로 — 도 표기만 다른 것은 같고, 도로명이 다르면 다름', () => {
  const r = run(
    [{ id: 'same', name: '가나', bizNo: B1, address: '충남 천안시 동남구 만남로 10' },
     { id: 'moved', name: '다라', bizNo: B2, address: '서울특별시 마포구 월드컵로 1' }],
    [{ c: '가나', bz: B1, ad: '충청남도 천안시 동남구 만남로 10' },
     { c: '다라', bz: B2, ad: '경기도 고양시 덕양구 화정로 2' }]);
  assert.equal(row(r, 'same'), undefined, '충남/충청남도 표기 차이를 다르다고 했다');
  assert.equal(row(r, 'moved').f.addr, 'diff');
  /* 잣대를 바꾸면 판정도 바뀐다 — 정말 넘겨받은 것을 쓰는지 */
  const r2 = M.build([{ id: 'moved', name: '다라', bizNo: B2, address: 'A' }], [], idx([{ c: '다라', bz: B2, ad: 'B' }]),
    { keyOf: K.key, looksLikeBizNo: K.looksLikeBizNo, normName: norm, addrSame: () => true });
  assert.equal(r2.rows.length, 0, '넘겨준 주소 잣대를 안 썼다');
});

test('종료·지운 업체는 안 본다 · 명함(card) 줄은 등록증으로 치지 않는다', () => {
  const r = run(
    [{ id: 'c1', name: '가나', bizNo: B1, ceo: '홍길동', status: 'closed' },
     { id: 'c2', name: '다라', bizNo: B2, ceo: '홍길동', _deleted: true },
     { id: 'c3', name: '마바', bizNo: B3, ceo: '홍길동' }],
    [{ c: '가나', bz: B1, ceo: '김철수' }, { c: '다라', bz: B2, ceo: '김철수' }]);
  const cards = idx([{ c: '마바', bz: B3, ceo: '김철수' }]);
  cards.i0.k = 'card';
  const r2 = M.build([{ id: 'c3', name: '마바', bizNo: B3, ceo: '홍길동' }], [], cards,
    { keyOf: K.key, looksLikeBizNo: K.looksLikeBizNo, normName: norm, addrSame: PA.same });
  assert.equal(r.rows.length, 0);
  assert.equal(r2.rows.length, 0, '명함 줄을 등록증으로 쳤다');
});

test('★★ 계약 — 진행 중 계약의 회사 사본만 본다(이관·종료·취소는 옛 기록)', () => {
  const cos = [{ id: 'co1', name: '가나상사', bizNo: B1, ceo: '홍길동', primaryContactName: '이영희',
    contacts: [{ name: '박민수' }], address: '서울특별시 마포구 월드컵로 1', phone: '02-123-4567' }];
  const company = { ceo: '홍길동', address: '서울특별시 마포구 월드컵로 1', phone: '02-123-4567', contacts: [{ name: '최나래' }] };
  const r = run(cos, [], [
    { id: 'k1', contractNo: 'C-1', companyId: 'co1', status: 'signed', company },
    { id: 'k2', contractNo: 'C-2', companyId: 'co1', status: 'transferred', transferredTo: 'co1', closedAt: 1, company },
    { id: 'k3', contractNo: 'C-3', bizNo: B1, status: 'cancelled', closedAt: 1, company },
    { id: 'k4', contractNo: 'C-4', bizNo: B1, status: 'progress', company: Object.assign({}, company, { contacts: [{ name: '박 민수' }] }) },
    /* 상태 글자는 「진행」인데 이미 이관·종료된 것 — 실데이터에 'progress+transferred' 가 있다(2026-10-03 실측) */
    { id: 'k5', contractNo: 'C-5', companyId: 'co1', status: 'progress', transferredTo: 'co1', company },
    { id: 'k6', contractNo: 'C-6', companyId: 'co1', status: 'signed', closedAt: 1, company },
  ]);
  assert.deepEqual(r.ctRows.map((x) => x.ct.id), ['k1'], '옛 계약을 봤거나 진행 계약을 놓쳤다');
  assert.deepEqual(r.ctRows[0].diffs, ['contact']);
  assert.equal(r.count.contract, 1);
});

/* ── 화면 ─────────────────────────────────────────────────────────── */
const HTML = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
function fnSrc(name) {
  const at = HTML.indexOf('function ' + name + '(');
  assert.ok(at > 0, name + ' 를 못 찾았다');
  let i = HTML.indexOf('{', at), d = 0;
  for (; i < HTML.length; i++) { if (HTML[i] === '{') d++; else if (HTML[i] === '}') { d--; if (d === 0) break; } }
  return HTML.slice(at, i + 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
}

test('★★ 창은 직접 저장하지 않는다 — 저장은 props.onFill 한 길, 업체관리가 coUpsertMany 로 잇는다', () => {
  const src = fnSrc('CoMismatchModal') + fnSrc('coMismatchBuild');
  for (const w of ['dbUpsert', 'dbSet', 'dbPatch', 'dbDel', 'coUpsertMany', '.update(', '.set(', '.remove(', '.push(', 'transaction(']) {
    const hit = w === '.push(' ? /\.ref\([^)]*\)\.push\(/.test(src) : src.includes(w);
    assert.ok(!hit, '창 안에 직접 저장하는 「' + w + '」 가 있다');
  }
  /* props.onFill 에 넘기는 것은 fillRecs / undoRecs 가 만든 recs 뿐 */
  const calls = src.match(/props\.onFill\(([^)]*)\)/g) || [];
  assert.ok(calls.length >= 2, '채우기·되돌리기가 props.onFill 을 안 쓴다');
  calls.forEach((c) => assert.match(c, /props\.onFill\((plan|u)\.recs\)/, '판정 파일이 만든 것이 아닌 것을 저장한다: ' + c));
  /* 계산은 «저장 직전»의 업체 목록으로 — 창을 띄운 때의 옛 목록이 아니다 */
  assert.match(fnSrc('doFill'), /fillRecs\(rows,\s*dbGet\('companies'/, '채우기가 저장 직전 목록으로 다시 계산하지 않는다');
  assert.match(fnSrc('undoFill'), /undoRecs\([^,]+,\s*dbGet\('companies'/, '되돌리기가 저장 직전 목록으로 다시 보지 않는다');
  assert.match(fnSrc('CompanyManagement'), /onFill\s*:\s*function\(recs\)\{\s*return coUpsertMany\(recs\);/, '업체관리가 저장 길을 coUpsertMany 로 안 잇는다');
});

test('★★ 빈칸 채우기 — 저장 직전에도 빈 칸만, 등록증 값으로, 상호는 안 채운다', () => {
  const co = { id: 'e', name: '가나상사', bizNo: B1 };
  const r = run([co], [{ c: '가나상사', bz: B1, ceo: '홍길동', ad: '서울특별시 마포구 월드컵로 1', ct: '02-123-4567' }]);
  const fresh = [{ id: 'e', name: '가나상사', bizNo: B1, ceo: '', address: '', phone: '010-9999-0000', memo: '그대로' }];
  const p = M.fillRecs(r.rows, fresh);
  assert.equal(p.recs.length, 1);
  assert.equal(p.recs[0].ceo, '홍길동');
  assert.equal(p.recs[0].address, '서울특별시 마포구 월드컵로 1');
  assert.equal(p.recs[0].phone, '010-9999-0000', '그사이 사람이 적은 전화를 덮었다');
  assert.equal(p.recs[0].memo, '그대로', '다른 칸을 잃었다(업체 전체를 넘겨야 한다)');
  assert.equal(p.cells, 2);
  assert.deepEqual(p.undo, [{ id: 'e', put: { ceo: '홍길동', address: '서울특별시 마포구 월드컵로 1' } }]);
  /* 다른(diff) 칸은 채우기가 건드리지 않는다 */
  const r2 = run([{ id: 'd', name: '다라', bizNo: B2, ceo: '김철수' }], [{ c: '다라', bz: B2, ceo: '최나래' }]);
  assert.equal(M.fillRecs(r2.rows, [{ id: 'd', name: '다라', bizNo: B2, ceo: '김철수' }]).recs.length, 0, '다른 값을 등록증 값으로 덮었다');
  /* 판정 때 «다름»이던 칸은, 그사이 누가 비웠어도 채우기가 넣지 않는다 — 사람은 그 줄을 «다름»으로 봤다 */
  assert.equal(M.fillRecs(r2.rows, [{ id: 'd', name: '다라', bizNo: B2, ceo: '' }]).recs.length, 0, '«다름»으로 보인 칸을 빈칸처럼 채웠다');
  /* 지운 업체·없어진 업체는 건너뛴다 */
  assert.equal(M.fillRecs(r.rows, [Object.assign({}, fresh[0], { _deleted: true })]).recs.length, 0);
  assert.equal(M.fillRecs(r.rows, []).recs.length, 0);
});

test('★ 되돌리기 — 넣은 값 그대로인 칸만 비우고, 그사이 고친 칸은 둔다', () => {
  const undo = [{ id: 'e', put: { ceo: '홍길동', address: '서울특별시 마포구 월드컵로 1' } }];
  const u = M.undoRecs(undo, [{ id: 'e', name: '가나상사', ceo: '홍길동', address: '부산광역시 해운대구 센텀로 3', memo: '그대로' }]);
  assert.equal(u.recs.length, 1);
  assert.equal(u.recs[0].ceo, '');
  assert.equal(u.recs[0].address, '부산광역시 해운대구 센텀로 3', '그사이 사람이 고친 주소를 지웠다');
  assert.equal(u.recs[0].memo, '그대로');
  assert.equal(u.cells, 1);
  assert.equal(M.undoRecs(undo, [{ id: 'e', ceo: '김철수', address: 'x' }]).recs.length, 0);
});

test('★ 판정은 공용 파일 한 곳 — 화면이 열쇠·주소 잣대를 넘겨 쓴다', () => {
  const b = fnSrc('coMismatchBuild');
  assert.match(b, /PuCoMismatch/);
  assert.match(b, /keyOf\s*:\s*K\.key/, '사업자번호 열쇠를 공용 파일에서 안 가져온다');
  assert.match(b, /addrSame\s*:\s*PA\.same/, '「📍 주소 대조」와 다른 주소 잣대를 쓴다');
  assert.match(HTML, /<script src="js\/pu-co-mismatch\.js\?v=\d+"><\/script>/, '판정 파일을 안 싣는다(캐시 번호 포함)');
});

test('★ 업체관리 툴바(폰·PC 둘 다)에 단추가 있고, 창이 업체관리 안에 뜬다', () => {
  const comp = fnSrc('CompanyManagement');
  const btns = comp.match(/setMisOpen\(true\)/g) || [];
  assert.ok(btns.length >= 2, '툴바 두 곳 중 한 곳에 단추가 없다');
  assert.match(comp, /misOpen && h\(CoMismatchModal/);
  assert.match(comp, /onOpenCo\s*:\s*function\(co\)\{\s*setDetailModal\(co\)/, '「업체 열기」가 업체 상세로 안 간다');
});

/* ★★ 2026-10-07 대표 결정 「빈칸만 채우기」(기업정보함 점검 4절) — 되돌릴 기록이 «업체 기록 안»에 남는다.
     예전에는 화면 상태에만 있어 창을 닫으면 되돌릴 길이 사라졌다. */
test('★★ 채운 것은 업체 기록(coFill)에 남고, 창을 닫았다 열어도 «마지막 채우기»를 다시 찾는다', () => {
  const co = { id: 'e', name: '가나상사', bizNo: B1 };
  const r = run([co], [{ c: '가나상사', bz: B1, ceo: '홍길동', ad: '서울특별시 마포구 월드컵로 1' }]);
  const fresh = [{ id: 'e', name: '가나상사', bizNo: B1, ceo: '', address: '' }];
  const p = M.fillRecs(r.rows, fresh, { at: 1000, by: '대표' });
  assert.deepEqual(p.recs[0].coFill, { at: 1000, by: '대표', put: { ceo: '홍길동', address: '서울특별시 마포구 월드컵로 1' } });
  const saved = p.recs.concat([{ id: 'x', coFill: { at: 500, put: { ceo: '옛것' } } }]);
  const last = M.pendingFill(saved);
  assert.equal(last.at, 1000, '가장 최근 채우기를 찾아야 한다');
  assert.equal(last.cells, 2);
  assert.deepEqual(last.undo, [{ id: 'e', put: { ceo: '홍길동', address: '서울특별시 마포구 월드컵로 1' } }]);
  /* 되돌리면 «되돌렸음»을 찍고 지우지 않는다 — 다음엔 그 앞 채우기가 «마지막»이 된다 */
  const u = M.undoRecs(last.undo, saved, { at: 2000, by: '대표' });
  assert.equal(u.recs[0].ceo, '');
  assert.equal(u.recs[0].coFill.undoneAt, 2000);
  assert.equal(u.recs[0].coFill.at, 1000, '기록을 지웠다 — 언제 무엇을 넣었는지 남아야 한다');
  assert.equal(M.pendingFill(u.recs.concat([saved[1]])).at, 500);
  assert.equal(M.pendingFill([{ id: 'z' }]), null);
});

test('★ 이알피 창은 마지막 채우기를 «업체 기록에서» 센다 — 화면 상태(useState)에 두면 닫는 순간 사라진다', () => {
  const src = fnSrc('CoMismatchModal');
  assert.match(src, /pendingFill\(dbGet\('companies'/);
  assert.ok(!/setLastFill/.test(src), '되돌릴 기록을 화면 상태에 둔다');
  assert.match(fnSrc('undoFill'), /confirm\(/, '며칠 뒤에도 누르는 단추라 한 번 물어야 한다');
});
