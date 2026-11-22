'use strict';
/* 재무관리 › 🤖 자동 처리 — 「처음 보는 회원」 후보를 «사업자번호 먼저, 이름은 표기 차이를 걷고» 찾는다 (2026-11-22)

   무엇이 문제였나
     더빌 명세의 «처음 보는 회원» 131건(회원 26명이 달마다 되풀이)이 대부분 「후보 없음」이었다. 업체는 ERP 에 있는데도.
     ① 이 화면은 사업자번호를 넘기지 않았다 — 줄에는 번호가 있는데(회원 17명) «이름만» 견줬다.
     ② 업체 이름에는 괄호 설명(「○○(구 △△)」)·옛 상호(「옛이름→새이름」)가 붙는데, 이름 «전체»를 견주니 한 글자도 안 맞았다.
     ③ 같은 이름의 «종료» 업체가 따로 있으면 그쪽으로 «종료 업체» 라고 안내했다 — 번호는 활성 업체를 가리키는데도.

   못 박는 것 (값이 아니라 규칙)
     · 번호가 있으면 번호가 이름보다 먼저다. 번호가 서로 다르면 이름이 닮아도 «다른 업체»다.
     · 비슷한 이름은 «활성 업체만», «한 곳으로 좁혀질 때만» 후보로 낸다. 종료 업체는 이름만 알려 주고 붙이지 않는다.
     · 후보는 «제안»이다 — 잇는 것은 사람이 누를 때뿐. 한꺼번에 잇기는 «번호가 같은 활성 업체»만, 한 번 묻고, 잇기만 한다.
   ⚠ 이 파일의 업체 이름은 모두 지어낸 것이다(공개 저장소 — 실제 고객 이름을 쓰지 않는다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const ERP = stripComments(RAW);
const NEW = '회원코드가 어느 업체에도 이어져 있지 않음';

const CO = [
  { id: 'a-old', name: '(주)가나다산업(구 마바사상사)', status: 'active', bizNo: '123-81-00001', monthlyAdvisoryFee: 110000 },
  { id: 'a-same', name: '라마바 테크', status: 'active', bizNo: '123-81-00002', monthlyAdvisoryFee: 165000 },
  { id: 'a-typo', name: '㈜사아자웍스', status: 'active', bizNo: '123-81-00003', monthlyAdvisoryFee: 110000 },
  { id: 'a-ash', name: '카타파푸드 아산점', status: 'active', bizNo: '123-81-00004', monthlyAdvisoryFee: 220000 },
  { id: 'a-sea', name: '카타파푸드 서산점', status: 'active', bizNo: '123-81-00005', monthlyAdvisoryFee: 220000 },
  { id: 'a-arrow', name: '구이름식당 본점→새이름 칼국수', status: 'active', bizNo: '123-81-00006', monthlyAdvisoryFee: 88000 },
  { id: 'a-twin', name: '주식회사 아자차산업 (구 진영상사)', status: 'active', bizNo: '123-81-00008', monthlyAdvisoryFee: 150000 },
  { id: 'c-twin', name: '㈜아자차산업', status: 'closed', bizNo: '123-81-00007', monthlyAdvisoryFee: 150000 },
  { id: 'a-m1', name: '모두산업 1공장', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-m2', name: '모두산업 2공장', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-short', name: '타파테크', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-kim', name: '(주)감', status: 'active', bizNo: '', monthlyAdvisoryFee: 110000 },
  { id: 'c-close', name: '종료샘플상사', status: 'closed', bizNo: '123-81-00009', monthlyAdvisoryFee: 110000 },
  { id: 'a-dup1', name: '쌍둥이식품', status: 'active', bizNo: '123-81-00010', monthlyAdvisoryFee: 100000 },
  { id: 'a-dup2', name: '(주)쌍둥이식품', status: 'active', bizNo: '123-81-00011', monthlyAdvisoryFee: 100000 },
  { id: 'a-union', name: '파하산업 노동조합', status: 'active', bizNo: '', monthlyAdvisoryFee: 250000 },
  { id: 'a-three', name: '마바사', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  /* 자동 검토(2026-11-22)가 짚은 경계 */
  { id: 'a-bs-ash', name: '바사아식당 아산점(본점)', status: 'active', bizNo: '123-81-00012', monthlyAdvisoryFee: 100000 },
  { id: 'a-bs-sea', name: '바사아식당 서산점(본점)', status: 'active', bizNo: '123-81-00013', monthlyAdvisoryFee: 100000 },
  { id: 'a-share1', name: '공유번호 본점', status: 'active', bizNo: '123-81-00014', monthlyAdvisoryFee: 100000 },
  { id: 'a-share2', name: '공유번호 지점', status: 'active', bizNo: '123-81-00014', monthlyAdvisoryFee: 100000 },
  { id: 'a-digit', name: '사자차산업 1공장', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-branch', name: '아자카식당 아산점', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'c-tahapa', name: '㈜타하파산업', status: 'closed', bizNo: '123-81-00015', monthlyAdvisoryFee: 100000 },
  { id: 'a-tahapa', name: '주식회사 타하파산업 (구 진영상사)', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-dalama', name: '다라마(본점)', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  /* 2차 검토 — 충돌 판정은 현재 상호·예전 상호만 본다(흔한 괄호 설명은 안 본다) */
  { id: 'a-c1', name: '라바사식당', status: 'active', bizNo: '123-81-00022', monthlyAdvisoryFee: 100000 },
  { id: 'a-d1', name: '카파타식당(라바사식당)', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
  { id: 'a-c2', name: '바하사식당', status: 'active', bizNo: '123-81-00023', monthlyAdvisoryFee: 100000 },
  { id: 'a-e1', name: '카타파식당(구 바하사식당)', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000 },
];

function makeCtx(companies, extra) {
  const ctx = Object.assign({
    window: {}, dbGet: (k, d) => (k === 'companies' ? (companies || CO) : d),
    _erpNameCmp: (a, b) => ({ score: a === b ? 100 : (a && b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) ? 85 : 0) }),
    erpAliasCompany: () => null, erpCleanMemo: (x) => x, erpPrevList: () => [],
    Object, Array, String, parseInt, Date, Math, JSON,
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(ERP, 'function erpNormName(s)'),
    cutFn(ERP, 'function _nbDigits(v)'),
    cutFn(ERP, 'function erpNicebillCoIndex()'),
    cutFn(ERP, 'function erpNicebillMatchCo(idx, name, bizNo, out)'),
    cutFn(ERP, 'function _cmsKey(s)'),
    cutFn(ERP, 'function erpCmsNameKeys(name)'),
    cutFn(ERP, 'function _cmsEd1(a, b)'),
    cutFn(ERP, 'function _cmsTypoOk(a, b)'),
    cutFn(ERP, 'function _cmsLikeLevel(rk, ck)'),
    cutFn(ERP, 'function _cmsNameSame(rk, ck)'),
    cutFn(ERP, 'function erpCmsLikePool(ix)'),
    cutFn(ERP, 'function erpCmsNameClash(ix, name, exceptId)'),
    cutFn(ERP, 'function erpCmsLikeFind(ix, name, biz)'),
    cutFn(ERP, 'function erpCmsAutoCandidate(ix, name, bizNo, amount)'),
    cutFn(ERP, 'function erpCmsSureLinks(ix, items)'),
  ].join('\n'), ctx);
  return ctx;
}
const find = (c, name, bizNo, amount) => c.erpCmsAutoCandidate(c.erpNicebillCoIndex(), name, bizNo, amount);
const item = (k, name, code, bizNo, amount) => ({ row: { _k: k, name, code, bizNo: bizNo || '', wdate: '2026-11-05', amount: amount || 110000, status: 'ok' }, verdict: 'new_member', company: null, why: NEW });

/* ───────── ① 이름 열쇠 — 법인 표기·공백·기호를 걷고, 괄호 설명·옛 이름을 갈라 담는다 ───────── */
test('① 이름 열쇠 — 법인 표기·공백·기호는 걷고, 괄호 설명은 notes, 「구 …」·「옛이름→」은 olds 로 갈라 담는다', () => {
  const c = makeCtx();
  const k1 = c.erpCmsNameKeys('(주)가나다산업(구 마바사상사)');
  assert.deepEqual(Array.from(k1.mains), ['가나다산업']);
  assert.deepEqual(Array.from(k1.olds), ['마바사상사']);
  assert.deepEqual(Array.from(k1.notes), []);
  const k2 = c.erpCmsNameKeys('구이름식당 본점→새이름 칼국수');
  assert.deepEqual(Array.from(k2.mains), ['새이름칼국수']);
  assert.deepEqual(Array.from(k2.olds), ['구이름식당본점'], '화살표 왼쪽이 옛 이름');
  const k3 = c.erpCmsNameKeys('노노노감자탕&숯불갈비 배방점');
  assert.deepEqual(Array.from(k3.mains), ['노노노감자탕숯불갈비배방점'], '기호(&)·공백을 걷는다');
  const k4 = c.erpCmsNameKeys('자연샘플(광덕)');
  assert.deepEqual(Array.from(k4.mains), ['자연샘플']);
  assert.deepEqual(Array.from(k4.notes), [], '괄호 설명이 3글자 미만이면 담지 않는다(「본점」「광덕」 같은 흔한 설명으로 엉뚱한 업체가 이어지지 않게)');
  const k5 = c.erpCmsNameKeys('의료법인 가나다의료재단(바사아요양병원)');
  assert.deepEqual(Array.from(k5.mains), ['가나다의료재단']);
  assert.deepEqual(Array.from(k5.notes), ['바사아요양병원']);
  assert.deepEqual(Array.from(c.erpCmsNameKeys('(주)감').mains), [], '한 글자 이름은 이름 열쇠로 쓰지 않는다(꼭 같은 이름 갈래가 따로 본다)');
});

/* ───────── ② 사업자번호가 이름보다 먼저 ───────── */
test('②★ 번호가 있으면 이름이 한 글자 달라도 같은 업체를 가리킨다(오타·표기 차이)', () => {
  const c = makeCtx();
  const k = find(c, '㈜사아자윅스', '123-81-00003', 110000);          // 웍 → 윅
  assert.equal(k.co.id, 'a-typo');
  assert.equal(k.via, 'biz'); assert.equal(k.by, 'biz');
  assert.ok(k.evidence.indexOf('사업자번호가 같음') >= 0);
  assert.ok(k.evidence.indexOf('월 금액도 같음') >= 0, '월 금액이 같으면 근거에 적는다');
  assert.equal(k.conflict, '');
});

test('②★ 번호는 «활성 업체»를 가리키는데 같은 이름의 종료 업체가 따로 있으면 활성 업체로 간다(종료 업체로 안내하지 않는다)', () => {
  const c = makeCtx();
  const k = find(c, '주식회사아자차산업', '123-81-00008', 150000);
  assert.equal(k.co.id, 'a-twin', '★ 이름이 꼭 같은 종료 업체로 가면 안 된다');
  assert.equal(k.via, 'biz');
  assert.ok(k.evidence.some((t) => /같은 이름의 종료 업체/.test(t)), '둘이 있다는 것을 알린다');
  /* 이빨 — 번호가 없으면 예전처럼 이름이 꼭 같은 종료 업체로 안내된다 */
  const old = find(c, '㈜아자차산업', '', 150000);
  assert.equal(old.co.id, 'c-twin'); assert.equal(old.via, 'closed');
});

test('②★ 번호가 «종료 업체»를 가리키면 종료 업체로 안내한다(번호가 같음) — 비슷한 활성 업체로 새지 않는다', () => {
  const c = makeCtx();
  const k = find(c, '종료샘플 상사', '123-81-00009', 110000);
  assert.equal(k.co.id, 'c-close'); assert.equal(k.via, 'closed'); assert.equal(k.by, 'biz');
});

test('②★ 번호가 이름보다 먼저 — 이름은 한 지점인데 번호가 다른 지점이면 번호가 가리키는 쪽이다', () => {
  const c = makeCtx();
  const hit = find(c, '카타파푸드아산점', '123-81-00005', 220000);     // 이름은 아산점, 번호는 서산점
  assert.equal(hit.co.id, 'a-sea', '번호가 가리키는 쪽');
  assert.equal(hit.via, 'biz');
  assert.ok(hit.conflict && /카타파푸드 아산점/.test(hit.conflict), '이름이 꼭 같은 다른 활성 업체가 있으니 충돌로 알린다 — 한꺼번에 잇기에서 빠진다: ' + hit.conflict);
});

test('②★ 번호가 서로 다르면 이름이 닮아도 «다른 업체» — 비슷한 이름 후보로 내지 않는다(지점이 다른 같은 상호)', () => {
  const c = makeCtx();
  const noBiz = find(c, '카타파푸드서산', '', 220000);                  // 번호가 없으면 「서산점」이 이름 일부로 닮은 후보
  assert.equal(noBiz.co.id, 'a-sea'); assert.equal(noBiz.level, 'contains');
  const other = find(c, '카타파푸드서산', '123-81-09999', 220000);     // 번호가 어느 업체와도 안 맞고, 닮은 업체는 «다른 번호»를 가졌다
  assert.equal(other.co, null, '★ 번호가 서로 다른 업체를 이름이 닮았다고 후보로 냈다');
});

/* ───────── ③ 비슷한 이름 — 활성 업체만 · 한 곳으로 좁혀질 때만 ───────── */
test('③★ 괄호 설명·옛 상호가 붙은 업체 이름은 번호가 없어도 «이름이 같음» 후보가 된다', () => {
  const c = makeCtx();
  const a = find(c, '주식회사가나다산업', '', 110000);
  assert.equal(a.co.id, 'a-old'); assert.equal(a.via, 'like'); assert.equal(a.level, 'same');
  assert.ok(a.evidence.some((t) => /이름이 같음/.test(t)));
  const b = find(c, '새이름칼국수', '', 88000);                       // 「옛이름→새이름」 업체 — 새 이름으로 온 출금
  assert.equal(b.co.id, 'a-arrow'); assert.equal(b.level, 'same');
  const o = find(c, '마바사상사', '', 110000);                         // 더빌에 «옛 이름»으로 찍힌 경우
  assert.equal(o.co.id, 'a-old'); assert.equal(o.level, 'old');
});

test('③★ 이름이 한 글자 다르면(오타) «한 글자 다름»으로 한 곳일 때만 제안한다 — 4글자 미만은 안 한다', () => {
  const c = makeCtx();
  const t = find(c, '라마바테크', '', 165000);                         // 「라마바 테크」 — 공백만 다르면 «꼭 같은 이름»
  assert.equal(t.co.id, 'a-same'); assert.equal(t.via, 'name');
  const typo = find(c, '라마사테크', '', 165000);                      // 바 → 사
  assert.equal(typo.co.id, 'a-same'); assert.equal(typo.level, 'typo');
  assert.ok(typo.evidence.some((x) => /한 글자 다름/.test(x)));
  const shortName = find(c, '가나다', '', 110000);
  assert.equal(shortName.co, null, '세 글자 이하는 한 글자만 달라도 붙이지 않는다');
  const three = find(c, '마바자', '', 100000);                          // 「마바사」 — 세 글자 이름이 한 글자 다르다
  assert.equal(three.co, null, '★ 세 글자 이름은 한 글자만 달라도 다른 곳일 가능성이 더 크다 — 붙이지 않는다');
  const exact3 = find(c, '마바사', '', 100000);
  assert.equal(exact3.co.id, 'a-three'); assert.equal(exact3.via, 'name', '꼭 같은 세 글자 이름은 예전 그대로 붙는다');
});

test('③★ 일부만 같은 이름은 긴 쪽이 짧은 쪽(4글자 이상)을 품을 때만 — 짧은 이름은 아무 데나 붙지 않는다', () => {
  const c = makeCtx();
  const ok = find(c, '파하산업', '', 250000);                          // 「파하산업 노동조합」 안에 들어 있다
  assert.equal(ok.co.id, 'a-union'); assert.equal(ok.level, 'contains');
  assert.ok(ok.evidence.indexOf('월 금액도 같음') >= 0);
  const tooShort = find(c, '타파', '', 100000);                        // 「타파테크」 안에 있지만 두 글자 — 아무 데나 붙는다
  assert.equal(tooShort.co, null, '★ 두 글자가 남의 이름 안에 들어 있다고 붙이면 안 된다');
});

test('③★ 닮은 곳이 «둘 이상»이면 하나를 고르지 않는다 — 이름만 알려 주고 사람이 고른다', () => {
  const c = makeCtx();
  const k = find(c, '모두산업', '', 100000);
  assert.equal(k.co, null);
  assert.equal(k.alts.length, 2);
  assert.deepEqual(Array.from(k.alts).sort(), ['모두산업 1공장', '모두산업 2공장']);
  assert.equal(k.via, '');
});

test('③★ 종료 업체는 비슷한 이름으로 «붙이지» 않는다 — 이름만 알려 준다(이름·번호가 꼭 같을 때만 붙는다, 2026-10-27)', () => {
  const c = makeCtx();
  const k = find(c, '종료샘플상사2호점', '', 110000);
  assert.equal(k.co, null, '★ 비슷한 이름이 종료 업체에 붙었다');
  assert.deepEqual(Array.from(k.closedLike), ['종료샘플상사']);
  assert.equal(k.via, '');
});

test('③ 이름이 꼭 같은 활성 업체는 예전처럼 «이름이 꼭 같음» — 한 글자 이름도 그대로', () => {
  const c = makeCtx();
  const k = find(c, '주식회사감', '', 110000);
  assert.equal(k.co.id, 'a-kim'); assert.equal(k.via, 'name'); assert.equal(k.by, 'name');
  assert.deepEqual(Array.from(k.evidence), ['이름이 꼭 같음', '월 금액도 같음']);
});

/* ───────── ④ 충돌 — 번호와 이름이 서로 다른 업체를 가리킨다 ───────── */
test('④★ 번호는 한 업체인데 이름은 «다른 활성 업체»와 꼭 같으면 충돌로 알린다 — 번호가 이기되 사람이 한 번 더 본다', () => {
  const c = makeCtx();
  const k = find(c, '쌍둥이식품', '123-81-00011', 100000);             // 번호는 (주)쌍둥이식품(a-dup2), 이름은 쌍둥이식품(a-dup1)과 꼭 같다
  assert.equal(k.co.id, 'a-dup2');
  assert.ok(k.conflict && /쌍둥이식품/.test(k.conflict), '충돌을 글로 적는다: ' + k.conflict);
});

test('④★ 이름은 꼭 같은데 사업자번호가 다르면 충돌로 알린다(다른 업체일 수 있다)', () => {
  const c = makeCtx();
  const k = find(c, '라마바테크', '123-81-09999', 165000);
  assert.equal(k.co.id, 'a-same'); assert.equal(k.by, 'name');
  assert.equal(k.conflict, '이름은 같지만 사업자번호가 다름');
});

/* ───────── ⑤ 한꺼번에 잇기 대상 ───────── */
test('⑤★ 한꺼번에 잇기 대상 — 번호가 같은 활성 업체만, 같은 코드의 여러 줄은 한 건, 종료·이름·비슷한 이름·충돌은 뺀다', () => {
  const c = makeCtx();
  const ix = c.erpNicebillCoIndex();
  const items = [
    item('s1', '㈜사아자윅스', 'C-1', '123-81-00003'), item('s2', '㈜사아자윅스', 'C-1', '123-81-00003'),   // 같은 코드 두 줄 = 한 건
    item('s3', '주식회사아자차산업', 'C-2', '123-81-00008', 150000),                                        // 번호 → 활성(같은 이름 종료 업체가 따로 있다)
    item('x-closed', '종료샘플 상사', 'C-3', '123-81-00009'),                                                // 번호 → 종료
    item('x-name', '주식회사감', 'C-4', ''),                                                                  // 이름만 꼭 같음
    item('x-like', '주식회사가나다산업', 'C-5', ''),                                                          // 비슷한 이름
    item('x-conf', '쌍둥이식품', 'C-6', '123-81-00011'),                                                      // 충돌
    item('x-none', '아무도모르는곳', 'C-7', ''),
    Object.assign(item('x-dual', '㈜사아자윅스', 'C-8', '123-81-00003'), { why: '회원코드가 두 업체에 이어져 있음' }),
    Object.assign(item('x-auto', '㈜사아자윅스', 'C-9', '123-81-00003'), { verdict: 'auto' }),
  ];
  const sure = Array.from(c.erpCmsSureLinks(ix, items));
  assert.deepEqual(sure.map((s) => s.code + '>' + s.co.id), ['C-1>a-typo', 'C-2>a-twin']);
  assert.equal(sure[0].rows, 2, '같은 코드의 두 줄');
  assert.equal(sure[0].fee, true, '월 금액도 같다');
});

test('⑤★ 한 코드가 줄마다 다른 업체를 가리키면(번호가 다른 줄이 섞임) 빼고 사람이 본다', () => {
  const c = makeCtx();
  const ix = c.erpNicebillCoIndex();
  const sure = Array.from(c.erpCmsSureLinks(ix, [item('m1', '㈜사아자윅스', 'C-1', '123-81-00003'), item('m2', '라마바테크', 'C-1', '123-81-00002')]));
  assert.equal(sure.length, 0, '한 코드가 두 업체를 가리키면 둘 다 안 잇는다');
  const one = Array.from(c.erpCmsSureLinks(ix, [item('m1', '㈜사아자윅스', 'C-1', '123-81-00003'), item('m3', '라마바테크', 'C-3', '123-81-00002')]));
  assert.deepEqual(one.map((s) => s.code), ['C-1', 'C-3'], '코드가 다르면 각각 한 건');
});

/* ───────── ⑥ 화면 ───────── */
function render(items, opts) {
  opts = opts || {};
  const calls = { link: [], patch: [], income: [], nav: [], confirm: [], toast: [], run: [] };
  const win = {
    __erpCmsAutoLast: { items, status: {}, since: '2026-01-01' }, innerWidth: 1280,
    confirm: (m) => { calls.confirm.push(m); return opts.confirm !== false; },
    addEventListener() {}, removeEventListener() {},
  };
  const ctx = makeCtx(opts.companies, {
    window: win, CURRENT_USER: { sid: 'P-001' }, isAdminByUser: () => true,
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    usePersistedState: (k, v) => [opts.tab || v, () => {}],
    useEffect: () => {}, useFillHeight: () => ({ ref: null, max: '' }),
    h: (t, p, ...c) => ({ t, p: p || {}, c: [].concat(...c.map((x) => (Array.isArray(x) ? x : [x]))) }),
    dbPatch: (...a) => { calls.patch.push(a); return true; },
    dbSet: (...a) => { calls.patch.push(a); return true; },
    erpUpsertIncome: (...a) => { calls.income.push(a); return true; },
    erpAddCompanyIncome: (...a) => { calls.income.push(a); return true; },
    erpCmsLinkMember: (code, id) => { calls.link.push([code, id]); return opts.linkOk === undefined ? true : opts.linkOk(code); },
    erpCmsAutoRun: (o) => { calls.run.push(o); },
    erpCmsUndo: () => Promise.resolve(true),
    showToast: (m) => { calls.toast.push(m); },
    __nav: (r) => { calls.nav.push(r); },
  });
  vm.runInContext([cutFn(ERP, 'function FinanceAuto(props)'), 'this.tree = FinanceAuto({ onNavigate: function(r){ __nav(r); } });'].join('\n'), ctx);
  const rows = {}, buttons = [];
  const text = (n) => (n && typeof n === 'object' ? (n.c || []).map(text).join('') : (n == null ? '' : String(n)));
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'tr' && n.p.key) rows[n.p.key] = n;
    if (n.t === 'button') buttons.push(n);
    (n.c || []).forEach(walk);
  })(ctx.tree);
  const cells = (k) => rows[k].c.map(text);
  const rowButton = (k) => { let b = null; (function walk(n) { if (!n || typeof n !== 'object') return; if (n.t === 'button') b = n; (n.c || []).forEach(walk); })(rows[k]); return b; };
  const bulk = () => buttons.find((b) => text(b) === '한꺼번에 잇기');
  return { calls, cells, rowButton, bulk, text, keys: Object.keys(rows) };
}
const SCREEN_ITEMS = [
  item('r1', '㈜사아자윅스', 'C-1', '123-81-00003', 110000),
  item('r2', '㈜사아자윅스', 'C-1', '123-81-00003', 110000),
  item('r3', '주식회사아자차산업', 'C-2', '123-81-00008', 150000),
  item('r4', '종료샘플 상사', 'C-3', '123-81-00009', 110000),
  item('r5', '주식회사가나다산업', 'C-5', '', 110000),
  item('r6', '아무도모르는곳', 'C-7', '', 110000),
];

test('⑥★ 화면이 사업자번호·금액을 후보 찾기에 넘긴다 — 번호를 안 넘기던 것이 「후보 없음」의 뿌리였다', () => {
  const screen = cutFn(ERP, 'function FinanceAuto(props)');
  assert.match(screen, /erpCmsAutoCandidate\(ix, it\.row\.name, it\.row\.bizNo, it\.row\.amount\)/);
  assert.doesNotMatch(screen, /erpNicebillMatchCo\(/, '화면이 직접 찾으면 허용 규칙이 두 군데로 갈라진다');
});

test('⑥★ 후보 글 — 번호가 같은 곳·종료 업체·비슷한 이름·후보 없음이 각각 무엇을 보고 찾았는지 적는다', () => {
  const r = render(SCREEN_ITEMS);
  assert.match(r.cells('r1')[6], /^후보: ㈜사아자웍스 \(사업자번호가 같음 · 월 금액도 같음 — 누르기 전엔 안 이음\)$/);
  assert.match(r.cells('r3')[6], /^후보: 주식회사 아자차산업 \(구 진영상사\) \(사업자번호가 같음 · 월 금액도 같음 · 같은 이름의 종료 업체/);
  assert.ok(!r.cells('r3').some((t) => t === '종료 업체'), '★ 번호는 활성 업체인데 종료 업체로 안내했다');
  assert.match(r.cells('r4')[6], /^종료 업체 「종료샘플상사」 \(사업자번호가 같음\) — 거래내역에서/);
  assert.ok(r.cells('r4').some((t) => t === '종료 업체'));
  assert.match(r.cells('r5')[6], /^후보: \(주\)가나다산업\(구 마바사상사\) \(이름이 같음\(법인 표기·괄호 설명만 다름\) · 월 금액도 같음 — 누르기 전엔 안 이음\)$/);
  assert.equal(r.cells('r6')[6], '후보 없음');
  assert.equal(r.cells('r1').length, 8, '한 칸은 한 줄 — 칸 수가 늘지 않는다');
});

test('⑥★ 한 줄 잇기 — 확인창에 «무엇을 보고 맞췄는지»가 보이고, 이름만 닮은 곳은 경고가 붙는다', () => {
  const a = render(SCREEN_ITEMS);
  a.rowButton('r1').p.onClick();
  assert.equal(a.calls.confirm.length, 1);
  assert.match(a.calls.confirm[0], /사업자번호가 같음/);
  assert.deepEqual(a.calls.link, [['C-1', 'a-typo']]);
  const b = render(SCREEN_ITEMS);
  b.rowButton('r5').p.onClick();
  assert.match(b.calls.confirm[0], /이름만 닮았습니다/, '★ 이름만 닮은 후보는 경고가 붙는다');
  assert.match(b.calls.confirm[0], /사업자번호·대표자를 확인/);
});

test('⑥★ 「한꺼번에 잇기」 — 번호가 같은 활성 업체만, 한 번 묻고 코드마다 한 번씩만 잇는다(입금·저장·자동확정은 없다)', () => {
  const r = render(SCREEN_ITEMS);
  const b = r.bulk();
  assert.ok(b, '★ 단추가 없다');
  b.p.onClick();
  assert.equal(r.calls.confirm.length, 1, '한 번만 묻는다');
  const msg = r.calls.confirm[0];
  assert.match(msg, /활성 업체 2곳/);
  assert.match(msg, /「㈜사아자윅스」 → 「㈜사아자웍스」 \(월 금액도 같음\)/);
  assert.match(msg, /「주식회사아자차산업」 → 「주식회사 아자차산업 \(구 진영상사\)」/);
  assert.ok(msg.indexOf('종료샘플') < 0 && msg.indexOf('가나다산업') < 0, '★ 종료 업체·이름만 닮은 곳이 목록에 들어갔다');
  assert.match(msg, /잇기만 합니다/);
  assert.deepEqual(r.calls.link, [['C-1', 'a-typo'], ['C-2', 'a-twin']], '코드마다 한 번씩(같은 코드 두 줄도 한 번)');
  assert.equal(r.calls.income.length, 0, '★ 입금표시를 만들었다');
  assert.equal(r.calls.patch.length, 0, '이 화면이 저장소에 직접 쓰지 않는다(잇기는 erpCmsLinkMember 만)');
  assert.equal(r.calls.run.length, 1, '다시 읽기는 한 번');
  assert.equal(r.calls.run[0].write, false, '★ 다시 읽기는 «미리보기»로만 — 자동 확정을 한꺼번에 터뜨리지 않는다');
  assert.ok(r.calls.toast.some((m) => /2곳을 이었습니다/.test(m)));
});

test('⑥★ 한꺼번에 잇기 — 취소하면 아무것도 안 하고, 못 이은 곳은 이름으로 알린다', () => {
  const cancel = render(SCREEN_ITEMS, { confirm: false });
  cancel.bulk().p.onClick();
  assert.equal(cancel.calls.link.length, 0); assert.equal(cancel.calls.run.length, 0); assert.equal(cancel.calls.toast.length, 0);
  const part = render(SCREEN_ITEMS, { linkOk: (code) => code !== 'C-2' });
  part.bulk().p.onClick();
  assert.ok(part.calls.toast.some((m) => /1곳을 이었습니다/.test(m) && /못 이은 곳 1곳\(주식회사아자차산업\)/.test(m)), part.calls.toast.join('|'));
});

test('⑥★ 한꺼번에 잇기 단추는 대상이 있을 때·「확인할 것」 탭에서만 보인다', () => {
  assert.equal(render([SCREEN_ITEMS[3], SCREEN_ITEMS[4], SCREEN_ITEMS[5]]).bulk(), undefined, '번호가 같은 활성 업체가 없으면 단추가 없다');
  assert.equal(render(SCREEN_ITEMS, { tab: 'fail' }).bulk(), undefined, '다른 탭에는 없다');
  assert.ok(render(SCREEN_ITEMS).bulk());
});

test('⑥ 닮은 곳이 여럿이면 줄의 안내가 이름들을 알려 주고, 종료 업체만 닮으면 «자동으로는 안 붙입니다»', () => {
  const r = render([item('m', '모두산업', 'C-9', '', 100000), item('k', '종료샘플상사2호점', 'C-8', '', 110000)]);
  assert.match(r.cells('m')[6], /^후보 없음 — 비슷한 이름이 여러 곳: 모두산업 1공장 · 모두산업 2공장 \(직접 골라야 합니다\)$/);
  assert.match(r.cells('k')[6], /^후보 없음 — 비슷한 종료 업체: 「종료샘플상사」 \(자동으로는 안 붙입니다\)$/);
  const b = r.rowButton('m'); b.p.onClick();
  assert.equal(r.calls.link.length, 0, '고를 곳이 없으면 아무것도 안 잇는다');
  assert.ok(r.calls.toast.some((m) => /후보가 없습니다/.test(m)));
});

test('⑦ 소스 — 비슷한 이름 찾기는 종료 업체를 «붙이지» 않고(closedLike 로 이름만), 사업자번호 열 자리 미만은 열쇠로 안 쓴다', () => {
  const like = cutFn(ERP, 'function erpCmsLikeFind(ix, name, biz)');
  assert.match(like, /if\(p\.closed\)\{ cl\.push\(p\.co\.name\); return; \}/);
  assert.match(like, /biz\.length >= 10 && cb\.length >= 10 && cb !== biz/, '번호가 둘 다 있고 다르면 다른 업체');
  const cand = cutFn(ERP, 'function erpCmsAutoCandidate(ix, name, bizNo, amount)');
  assert.match(cand, /biz\.length >= 10/);
  assert.ok(cand.indexOf('ix.byBiz[biz]') < cand.indexOf('erpNicebillMatchCo(ix, name'), '번호를 이름보다 먼저 본다');
});

/* ───────── ⑧ 자동 검토(2026-11-22) 반영 — 경계 ───────── */
test('⑧★ 번호가 가리키는 업체와 «다른 활성 업체»가 괄호 설명만 다른 같은 이름이면 충돌 — 한꺼번에 잇기에서 빠진다', () => {
  const c = makeCtx();
  const k = find(c, '바사아식당 아산점', '123-81-00013', 100000);      // 이름은 「아산점(본점)」, 번호는 「서산점(본점)」
  assert.equal(k.co.id, 'a-bs-sea', '번호가 가리키는 쪽');
  assert.ok(k.conflict && /바사아식당 아산점\(본점\)/.test(k.conflict), '★ 괄호 설명이 붙어 «꼭 같은 이름»이 아니어도 충돌로 알려야 한다: ' + k.conflict);
  const ix = c.erpNicebillCoIndex();
  assert.equal(Array.from(c.erpCmsSureLinks(ix, [item('q1', '바사아식당 아산점', 'C-1', '123-81-00013', 100000)])).length, 0, '★ 충돌이 있는 회원이 한꺼번에 잇기에 들어갔다');
  /* 이빨 — 이름도 번호도 같은 업체를 가리키면 충돌이 아니다 */
  const ok = find(c, '바사아식당 서산점', '123-81-00013', 100000);
  assert.equal(ok.co.id, 'a-bs-sea'); assert.equal(ok.conflict, '');
});

test('⑧★ 같은 사업자번호를 쓰는 활성 업체가 여럿이면(본점·지점) 하나를 고르지 않는다 — 이름만 알려 주고 한꺼번에 잇기에서 뺀다', () => {
  const c = makeCtx();
  const k = find(c, '공유번호 지점', '123-81-00014', 100000);
  assert.equal(k.co, null, '★ 색인이 «첫 업체»만 들고 있어 엉뚱한 업체로 이어질 뻔했다');
  assert.equal(k.multiBiz, true);
  assert.deepEqual(Array.from(k.alts).sort(), ['공유번호 본점', '공유번호 지점']);
  const ix = c.erpNicebillCoIndex();
  assert.equal(Array.from(c.erpCmsSureLinks(ix, [item('d1', '공유번호 지점', 'C-1', '123-81-00014', 100000)])).length, 0);
});

test('⑧★ 한 글자 다름은 «숫자가 다르거나 같은 꼬리(점·공장…) 앞이 다르면» 오타가 아니다 — 다른 공장·다른 지점', () => {
  const c = makeCtx();
  assert.equal(find(c, '사자차산업 2공장', '', 100000).co, null, '★ 1공장과 2공장은 다른 곳이다');
  assert.equal(find(c, '아자카식당 예산점', '', 100000).co, null, '★ 아산점과 예산점은 다른 지점이다');
  /* 이빨 — 꼬리가 없는 진짜 오타는 그대로 제안된다 */
  assert.equal(find(c, '라마사테크', '', 165000).level, 'typo');
  assert.equal(c._cmsTypoOk('사아자윅스', '사아자웍스'), true);
  assert.equal(c._cmsTypoOk('가나다1호', '가나다2호'), false);
  assert.equal(c._cmsTypoOk('가나다아산점', '가나다예산점'), false);
  assert.equal(c._cmsTypoOk('가나다지점', '가나다지점'), false, '같은 글자는 오타가 아니다');
});

test('⑧★ 이름이 꼭 같은 «종료» 업체가 있어도 사업자번호가 다르면 그 업체가 아니다 — 활성 업체의 비슷한 이름을 막지 않는다', () => {
  const c = makeCtx();
  const k = find(c, '㈜타하파산업', '123-81-00016', 100000);        // 종료 업체와 이름이 같지만 번호가 다르다
  assert.equal(k.co.id, 'a-tahapa', '★ 종료 업체로 잡혀 활성 후보를 놓쳤다');
  assert.equal(k.via, 'like'); assert.equal(k.level, 'same');
  assert.ok(k.closedLike.indexOf('㈜타하파산업') >= 0, '번호가 다른 같은 이름의 종료 업체는 이름만 알려 준다');
  /* 이빨 — 번호가 없으면 예전처럼 이름이 꼭 같은 종료 업체로 안내된다 */
  const old = find(c, '㈜타하파산업', '', 100000);
  assert.equal(old.co.id, 'c-tahapa'); assert.equal(old.via, 'closed');
});

test('⑧ 「구」·「전」으로 시작하는 지점 이름의 첫 글자를 자르지 않는다 — 구분 글자(공백·점·줄표)가 있을 때만 예전 이름', () => {
  const c = makeCtx();
  const a = c.erpCmsNameKeys('가나다산업(구로지점)');
  assert.deepEqual(Array.from(a.olds), [], '★ 「구로지점」이 「로지점」이라는 예전 이름이 됐다');
  assert.deepEqual(Array.from(a.notes), ['구로지점']);
  assert.deepEqual(Array.from(c.erpCmsNameKeys('가나다산업(전주지점)').olds), []);
  assert.deepEqual(Array.from(c.erpCmsNameKeys('가나다산업(구 진영상사)').olds), ['진영상사']);
  assert.deepEqual(Array.from(c.erpCmsNameKeys('가나다산업(구.마하본점)').olds), ['마하본점']);
  assert.deepEqual(Array.from(c.erpCmsNameKeys('가나다산업(구-마바사상사, 사아자상사)').olds), ['마바사상사', '사아자상사']);
});

test('⑧ 후보 캐시는 이름을 «그대로» 키로 쓴다 — 괄호 유무가 다른 이름의 답이 섞이지 않는다', () => {
  const c = makeCtx();
  const ix = c.erpNicebillCoIndex();
  const a = c.erpCmsAutoCandidate(ix, '다라마(광덕)', '', 100000);
  const b = c.erpCmsAutoCandidate(ix, '다라마광덕', '', 100000);
  assert.equal(a.co.id, 'a-dalama');
  assert.equal(b.co, null, '★ 앞 조회의 답이 캐시에서 섞여 나왔다');
  assert.equal(c.erpCmsAutoCandidate(ix, '다라마(광덕)', '', 100000), a, '같은 이름은 캐시에서 그대로');
});

test('⑧★ 이름만 닮았거나 충돌이 있는 후보로 이으면 입금표시를 «바로» 만들지 않는다(미리보기로만 다시 읽는다) — 번호·이름이 확실하면 예전 그대로', () => {
  const like = render(SCREEN_ITEMS);
  like.rowButton('r5').p.onClick();                                     // 이름만 닮은 후보
  assert.equal(like.calls.link.length, 1);
  assert.equal(like.calls.run.length, 1); assert.equal(like.calls.run[0].write, false, '★ 이름만 닮은 후보를 잇자마자 자동 확정이 돈다');
  assert.ok(like.calls.toast.some((m) => /입금표시는 바로 만들지 않습니다/.test(m)));
  const conflict = render([item('cf', '쌍둥이식품', 'C-6', '123-81-00011', 100000)]);
  conflict.rowButton('cf').p.onClick();                                 // 번호와 이름이 다른 업체를 가리킴
  assert.equal(conflict.calls.run[0].write, false, '충돌이 있는 후보도 미리보기로만');
  const sure = render(SCREEN_ITEMS);
  sure.rowButton('r1').p.onClick();                                     // 번호가 같은 후보
  assert.equal(sure.calls.run[0].write, true, '확실한 후보는 예전 그대로 — 이은 뒤 다시 읽어 자동 확정까지');
});

test('⑧★ 한꺼번에 잇기는 누르는 «지금» 다시 확인한다 — 그사이 종료된 업체·다른 업체에 이어진 코드·이미 이어진 코드', () => {
  const copy = () => CO.map((x) => Object.assign({}, x));
  // ① 화면을 연 뒤 업체가 종료됐다
  const cos1 = copy();
  const r1 = render(SCREEN_ITEMS, { companies: cos1 });
  cos1.find((x) => x.id === 'a-twin').status = 'closed';
  r1.bulk().p.onClick();
  assert.deepEqual(r1.calls.link.map((l) => l.join('>')), ['C-1>a-typo'], '★ 종료된 업체에 이었다');
  assert.ok(r1.calls.toast.some((m) => /1곳을 이었습니다/.test(m) && /못 이은 곳 1곳\(주식회사아자차산업\)/.test(m)), r1.calls.toast.join('|'));
  // ② 그사이 코드가 다른 업체에 이어졌다 — 「옮길까요?」로 묻지 않고 건너뛴다
  const cos2 = copy();
  const r2 = render(SCREEN_ITEMS, { companies: cos2 });
  cos2.find((x) => x.id === 'a-old').cmsMemberCodes = ['C-1'];
  r2.bulk().p.onClick();
  assert.deepEqual(r2.calls.link.map((l) => l.join('>')), ['C-2>a-twin'], '★ 다른 업체에 이어진 코드를 가져왔다');
  assert.equal(r2.calls.confirm.length, 1, '한꺼번에 잇기 확인 한 번뿐 — 중간에 더 묻지 않는다');
  // ③ 이미 그 업체에 이어져 있다 — 다시 잇지 않고 이은 것으로 센다
  const cos3 = copy();
  const r3 = render(SCREEN_ITEMS, { companies: cos3 });
  cos3.find((x) => x.id === 'a-typo').cmsMemberCodes = ['C-1'];
  r3.bulk().p.onClick();
  assert.deepEqual(r3.calls.link.map((l) => l.join('>')), ['C-2>a-twin']);
  assert.ok(r3.calls.toast.some((m) => /2곳을 이었습니다/.test(m)));
});

test('⑧ 화면 — 같은 번호를 쓰는 활성 업체가 여럿이면 이름들을 알려 주고, 눌러도 아무것도 안 잇는다', () => {
  const r = render([item('dup', '공유번호 지점', 'C-9', '123-81-00014', 100000)]);
  assert.match(r.cells('dup')[6], /^후보 없음 — 사업자번호가 같은 활성 업체가 여러 곳: .*공유번호 본점.*공유번호 지점.* \(직접 골라야 합니다\)$/);
  r.rowButton('dup').p.onClick();
  assert.equal(r.calls.link.length, 0);
  assert.ok(r.calls.toast.some((m) => /후보가 없습니다/.test(m)));
  assert.equal(r.bulk(), undefined, '대상이 없으면 한꺼번에 잇기 단추도 없다');
});

/* ───────── ⑨ 2차 검토(2026-11-22) 반영 ───────── */
test('⑨★ 번호 없는 회원의 «꼭 같은 이름»이 활성 업체 여럿과 겹치면 첫 업체를 고르지 않는다 — 이름만 알려 주고 사람이 고른다', () => {
  const c = makeCtx();
  const k = find(c, '쌍둥이식품', '', 100000);                          // 「쌍둥이식품」「(주)쌍둥이식품」 — 정규화하면 같은 이름 둘
  assert.equal(k.co, null, '★ 색인의 첫 업체가 단독 후보로 나왔다 — 이으면 곧바로 자동 확정까지 간다');
  assert.equal(k.multiName, true);
  assert.deepEqual(Array.from(k.alts).sort(), ['(주)쌍둥이식품', '쌍둥이식품']);
  const ix = c.erpNicebillCoIndex();
  assert.equal(Array.from(c.erpCmsSureLinks(ix, [item('n1', '쌍둥이식품', 'C-1', '', 100000)])).length, 0);
  /* 이빨 — 이름이 하나뿐이면 예전 그대로 단독 후보 */
  const one = find(c, '주식회사감', '', 110000);
  assert.equal(one.co.id, 'a-kim'); assert.equal(one.via, 'name'); assert.equal(one.multiName, false);
  /* 화면 */
  const r = render([item('nm', '쌍둥이식품', 'C-9', '', 100000)]);
  assert.match(r.cells('nm')[6], /^후보 없음 — 이름이 같은 활성 업체가 여러 곳: .*쌍둥이식품.*쌍둥이식품.* \(직접 골라야 합니다\)$/);
  r.rowButton('nm').p.onClick();
  assert.equal(r.calls.link.length, 0); assert.equal(r.calls.run.length, 0);
});

test('⑨★ 한꺼번에 잇기는 누르는 «지금의 업체 목록»으로 대상을 다시 고른다 — 그사이 번호가 바뀌었거나 같은 번호의 활성 업체가 늘었으면 건너뛴다', () => {
  const copy = () => CO.map((x) => Object.assign({}, x));
  // ① 같은 번호의 활성 업체가 새로 생겼다 — 어느 쪽인지 모른다
  const cos1 = copy();
  const r1 = render(SCREEN_ITEMS, { companies: cos1 });
  cos1.push({ id: 'a-late', name: '늦게생긴지점', status: 'active', bizNo: '123-81-00003', monthlyAdvisoryFee: 1 });
  r1.bulk().p.onClick();
  assert.deepEqual(r1.calls.link.map((l) => l.join('>')), ['C-2>a-twin'], '★ 같은 번호가 둘이 된 회원을 첫 업체로 이었다');
  assert.ok(r1.calls.toast.some((m) => /1곳을 이었습니다/.test(m) && /못 이은 곳 1곳\(㈜사아자윅스\)/.test(m)), r1.calls.toast.join('|'));
  // ② 업체의 사업자번호가 바뀌어 더는 같지 않다
  const cos2 = copy();
  const r2 = render(SCREEN_ITEMS, { companies: cos2 });
  cos2.find((x) => x.id === 'a-typo').bizNo = '123-81-09999';
  r2.bulk().p.onClick();
  assert.deepEqual(r2.calls.link.map((l) => l.join('>')), ['C-2>a-twin'], '★ 번호가 바뀐 업체에 이었다');
  // ③ 이빨 — 아무것도 안 바뀌었으면 둘 다 잇는다
  const r3 = render(SCREEN_ITEMS);
  r3.bulk().p.onClick();
  assert.deepEqual(r3.calls.link.map((l) => l.join('>')), ['C-1>a-typo', 'C-2>a-twin']);
});

test('⑨ 충돌은 «현재 상호·예전 상호»로만 본다 — 흔한 괄호 설명이 다른 업체와 겹쳤다고 번호와 상호가 모두 맞는 후보를 막지 않는다', () => {
  const c = makeCtx();
  const k = find(c, '라바사식당', '123-81-00022', 100000);               // 다른 업체 「카파타식당(라바사식당)」의 «괄호 설명»이 같은 글자
  assert.equal(k.co.id, 'a-c1'); assert.equal(k.conflict, '', '★ 괄호 설명만 겹친 것을 충돌로 봤다');
  const ix = c.erpNicebillCoIndex();
  assert.deepEqual(Array.from(c.erpCmsSureLinks(ix, [item('s1', '라바사식당', 'C-1', '123-81-00022', 100000)])).map((s) => s.co.id), ['a-c1']);
  /* 이빨 — 다른 활성 업체의 «예전 상호»가 같으면 충돌이다 */
  const old = find(c, '바하사식당', '123-81-00023', 100000);
  assert.equal(old.co.id, 'a-c2');
  assert.ok(old.conflict && /카타파식당\(구 바하사식당\)/.test(old.conflict), '예전 상호가 같은 다른 활성 업체는 충돌: ' + old.conflict);
});

test('⑨ 괄호 설명 «안»에 법인 표기 「(주)」가 들어 있어도 갈라 담는다', () => {
  const c = makeCtx();
  const k = c.erpCmsNameKeys('(주)가나다(구 (주)마바사)');
  assert.deepEqual(Array.from(k.mains), ['가나다']);
  assert.deepEqual(Array.from(k.olds), ['마바사'], '★ 중첩된 (주) 때문에 바깥 괄호가 안 갈라졌다');
});

/* ───────── ⑩ 마지막 보안 재검증(2026-11-22) 반영 ───────── */
test('⑩★ 같은 «예전 상호»를 쓰는 활성 업체가 여럿이면 첫 업체를 고르지 않는다 — 색인(byPrev)은 첫 업체만 들고 있다', () => {
  const cos = [
    { id: 'p1', name: '가가산업', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000, prevNames: ['옛공통상호'] },
    { id: 'p2', name: '나나산업', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000, prevNames: ['옛공통상호'] },
    { id: 'p3', name: '다다산업', status: 'active', bizNo: '', monthlyAdvisoryFee: 100000, prevNames: ['옛단독상호'] },
  ];
  const c = makeCtx(cos, { erpPrevList: (co) => co.prevNames || [] });
  const dup = find(c, '옛공통상호', '', 100000);
  assert.equal(dup.co, null, '★ 모호한 예전 상호가 첫 업체로 단독 제시됐다 — 이으면 곧바로 자동 확정까지 간다');
  assert.equal(dup.multiName, true);
  assert.deepEqual(Array.from(dup.alts).sort(), ['가가산업', '나나산업']);
  /* 이빨 — 예전 상호가 한 업체뿐이면 예전 그대로 */
  const one = find(c, '옛단독상호', '', 100000);
  assert.equal(one.co.id, 'p3'); assert.equal(one.via, 'prev'); assert.equal(one.multiName, false);
  const ix = c.erpNicebillCoIndex();
  assert.equal(ix.prevList['옛공통상호'].length, 2, '색인이 같은 예전 상호의 업체를 모두 모아 둔다');
});

test('⑩★ 한 줄 잇기도 누르는 «지금의 업체 목록»으로 후보를 다시 구한다 — 다른 업체를 가리키거나 후보가 사라졌으면 잇지 않고 화면을 새로 읽는다', () => {
  const copy = () => CO.map((x) => Object.assign({}, x));
  // ① 그사이 같은 번호의 활성 업체가 생겼다 — 처음 보인 후보는 더는 «그 업체»가 아니다
  const cos1 = copy();
  const r1 = render(SCREEN_ITEMS, { companies: cos1 });
  cos1.push({ id: 'a-late', name: '늦게생긴지점', status: 'active', bizNo: '123-81-00003', monthlyAdvisoryFee: 1 });
  r1.rowButton('r1').p.onClick();
  assert.equal(r1.calls.link.length, 0, '★ 화면을 연 뒤 모호해진 후보를 그대로 이었다');
  assert.equal(r1.calls.confirm.length, 0, '확인창도 띄우지 않는다');
  assert.ok(r1.calls.toast.some((m) => /그사이 업체 정보가 바뀌어/.test(m)));
  assert.equal(r1.calls.run.length, 1); assert.equal(r1.calls.run[0].write, false, '화면만 새로 읽는다(미리보기)');
  // ② 업체의 사업자번호가 바뀌어 더는 같지 않다
  const cos2 = copy();
  const r2 = render(SCREEN_ITEMS, { companies: cos2 });
  cos2.find((x) => x.id === 'a-typo').bizNo = '123-81-09999';
  r2.rowButton('r1').p.onClick();
  assert.equal(r2.calls.link.length, 0, '★ 번호가 바뀐 업체에 이었다');
  // ③ 같은 업체이면 «지금의» 근거로 확인창을 띄우고 예전 그대로 잇는다 — 월 금액이 바뀌었으면 «월 금액도 같음»이 빠진다
  const cos3 = copy();
  const r3 = render(SCREEN_ITEMS, { companies: cos3 });
  cos3.find((x) => x.id === 'a-typo').monthlyAdvisoryFee = 1;
  r3.rowButton('r1').p.onClick();
  assert.equal(r3.calls.confirm.length, 1);
  assert.match(r3.calls.confirm[0], /사업자번호가 같음/);
  assert.ok(r3.calls.confirm[0].indexOf('월 금액도 같음') < 0, '★ 처음 보인 근거가 아니라 지금 근거로 보여 준다');
  assert.deepEqual(r3.calls.link, [['C-1', 'a-typo']]);
  assert.equal(r3.calls.run[0].write, true, '확실한 후보는 예전 그대로');
  // ④ 아무것도 안 바뀌었으면 예전과 똑같다
  const r4 = render(SCREEN_ITEMS);
  r4.rowButton('r1').p.onClick();
  assert.deepEqual(r4.calls.link, [['C-1', 'a-typo']]);
  assert.equal(r4.calls.toast.filter((m) => /그사이/.test(m)).length, 0);
});
