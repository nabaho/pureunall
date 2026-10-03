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
   ⑧ 이 창은 «읽기만» — 저장하는 부름이 하나도 없다. */
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

test('★★ 이 창은 읽기만 — 저장·고치기 부름이 하나도 없다', () => {
  const src = fnSrc('CoMismatchModal') + fnSrc('coMismatchBuild');
  for (const w of ['dbUpsert', 'dbSet', 'dbPatch', 'dbDel', 'coUpsertMany', '.update(', '.set(', '.remove(', '.push(', 'transaction(']) {
    const hit = w === '.push(' ? /\.ref\([^)]*\)\.push\(/.test(src) : src.includes(w);
    assert.ok(!hit, '읽기만 하는 창에 「' + w + '」 가 있다');
  }
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
