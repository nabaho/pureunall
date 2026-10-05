'use strict';
/* 기업별 계약 기록 — 엑셀 업체명단 가져오기 (설계 2026-10-03-계약서류-표준-기록 §3 (가))
   ⓐ 명단 읽기: 이름표 줄을 글자로 찾는다 · 날짜/금액/대표자 공백 · 표지 틀·빈 줄 건너뜀 · 근로자 명단은 안 읽는다
   ⓑ 맞추기: 사업자번호 먼저, 없으면 이름
   ⓒ 저장: 같은 회사·계약일·종류는 두 번 안 들어간다 · 회사 칸의 파일 수(n)를 지킨다 · 지워도 파일은 그대로
   ⓓ 배선·규칙: 화면이 모듈을 싣고, 규칙에 co_recs 자리가 있다
   ⚠ 가짜 회사만 쓴다(사업자번호 123-). 진짜 명단 파일은 저장소에 없다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const R = require('../js/pu-co-roster.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function loadStore() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-office-store.js'), box);
  return box.PuOfficeStore;
}
function fakeDb() {
  const store = {};
  let seq = 0;
  const get = (p) => {
    const pre = p + '/', o = {}; let any = false;
    Object.keys(store).forEach((k) => {
      if (k === p) { any = true; Object.assign(o, JSON.parse(JSON.stringify(store[k]))); }
      else if (k.indexOf(pre) === 0) { const head = k.slice(pre.length).split('/')[0]; o[head] = get(pre + head); any = true; }
    });
    if (store[p] !== undefined && (typeof store[p] !== 'object' || store[p] === null)) return store[p];
    return any ? o : null;
  };
  const put = (p, v) => {
    Object.keys(store).forEach((k) => { if (k === p || k.indexOf(p + '/') === 0) delete store[k]; });
    if (v !== null && v !== undefined) store[p] = JSON.parse(JSON.stringify(v));
  };
  const noUndef = (v, p) => { if (v === undefined) throw new Error('undefined at ' + p); if (v && typeof v === 'object') Object.keys(v).forEach((k) => noUndef(v[k], p + '/' + k)); };
  const db = {
    store,
    ref(p) {
      return {
        key: p.split('/').pop(),
        push() { seq++; return db.ref(p + '/r' + String(seq).padStart(4, '0')); },
        once() { return Promise.resolve({ val: () => get(p) }); },
        set(v) { noUndef(v, p); put(p, v); return Promise.resolve(); },
        update(v) { noUndef(v, p); Object.keys(v).forEach((k) => put(p + '/' + k, v[k])); return Promise.resolve(); },
        remove() { put(p, null); return Promise.resolve(); },
        transaction(fn) { const next = fn(get(p)); noUndef(next, p); put(p, next); return Promise.resolve({ committed: true }); }
      };
    }
  };
  return db;
}

/* 원본 「업체명단」 꼴(1줄 제목·2줄 이름표) — 가짜 회사 */
const SHEETS = {
  업체명단: [
    ['급여업체명단'],
    ['연번', '사업장명', '담당자', '계약체결일', '사업자등록번호', '업태', '종목', '대표자', '주소', '실무자/전화번호', '공급대가', '지급일', '세금계산서', 'EDI'],
    [1, '㈜가나시험상사', '시험담당', new Date(2024, 2, 21), '123-45-67890', '제조', '부품', '홍 길 동', '(31000) 천안시 시험로 1', '김담당 010-0000-1111', 33000, 5, 1, '○'],
    [2, '다라테스트', '시험담당', 45383, '1234511111', '음식점업', '한식', '이 학 자', '천안시 시험로 2', '', '110,000', 25, '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [3, '{{회사명}}', '', '', '', '', '', '', '', '', '', '', '', '']
  ],
  자문계약서: [['자문계약서'], ['연번', '아무거나']]
};

test('ⓐ 명단 읽기 — 이름표 줄을 찾고, 날짜·금액·대표자 공백을 다듬는다', () => {
  const p = R.parseRoster(SHEETS);
  assert.equal(p.sheet, '업체명단');
  assert.equal(p.rows.length, 2, '빈 줄·표지 틀 줄은 건너뛴다');
  assert.equal(p.skipped, 1);
  const a = p.rows[0], b = p.rows[1];
  assert.equal(a.name, '㈜가나시험상사'); assert.equal(a.date, '2024-03-21'); assert.equal(a.bizNo, '123-45-67890');
  assert.equal(a.amount, 33000); assert.equal(a.ceo, '홍길동', '「홍 길 동」의 글자 사이 빈칸을 걷는다');
  assert.equal(a.edi, '○'); assert.equal(a.staff, '시험담당'); assert.equal(String(a.payDay), '5');
  assert.equal(b.date, '2024-04-01', '엑셀 날짜 번호(45383)'); assert.equal(b.bizNo, '123-45-11111'); assert.equal(b.amount, 110000);
});

test('ⓐ 근로자 명단(체당금)·이름표 없는 시트는 업체명단으로 읽지 않는다', () => {
  const worker = { 명단: [['명단'], ['연번', '의뢰인 성명', '주소', '연락처', '가족연락처', '주민번호'], [1, '박근로', '천안시', '010-0000-3333', '', '900101-1000000']] };
  assert.equal(R.parseRoster(worker).rows.length, 0);
  assert.equal(R.parseRoster({}).rows.length, 0);
  assert.equal(R.toYmd('2024.3.5'), '2024-03-05');
  assert.equal(R.toAmount(33000.4), 33000);
});

test('ⓑ 맞추기 — 사업자번호 먼저, 없으면 이름(㈜·주식회사 무시)', () => {
  const refs = [{ k: 'erp', c: '주식회사 가나시험상사', bz: '1234567890', companyId: 'c1' }, { k: 'biz', c: '다라테스트', bz: '' }];
  const p = R.parseRoster(SHEETS);
  assert.deepEqual(R.matchOf(p.rows[0], refs), { kind: 'erp', label: '이알피 업체 ✓', companyId: 'c1' });
  assert.equal(R.matchOf(p.rows[1], refs).kind, 'card');
  assert.equal(R.matchOf({ name: '없는회사', bizNo: '' }, refs).kind, 'new');
});

test('ⓒ 저장 — 두 번 가져와도 겹치지 않고, 회사 칸의 파일 수(n)를 지킨다', async () => {
  const S = loadStore(), db = fakeDb();
  S.init({ db, storage: null, uid: 'u1', name: '시험' });
  db.ref('pu_docs/co/' + S.coKey('㈜가나시험상사')).set({ name: '㈜가나시험상사', n: 2, lastAt: 1 });
  const rows = R.parseRoster(SHEETS).rows.map((r) => ({ coName: r.name, bizNo: r.bizNo, date: r.date, kind: '급여관리', amount: r.amount, payDay: r.payDay, edi: r.edi, staff: r.staff, contact: r.contact, src: 'import' }));
  const x1 = await S.importCoRecs(rows);
  assert.deepEqual(JSON.parse(JSON.stringify(x1)), { added: 2, skipped: 0, cos: 2 });
  const x2 = await S.importCoRecs(rows);
  assert.equal(x2.added, 0); assert.equal(x2.skipped, 2, '같은 회사·계약일·종류는 건너뛴다');
  const k = S.coKey('㈜가나시험상사');
  const co = db.store['pu_docs/co/' + k];
  assert.equal(co.n, 2, '파일 수를 떨어뜨리면 안 된다'); assert.equal(co.r, 1); assert.equal(co.bz, '123-45-67890');
  const recs = await S.listCoRecs(k);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].src, 'import'); assert.equal(recs[0].amount, 33000); assert.equal(recs[0].by, 'u1');
  assert.ok(!('line' in recs[0]) && !('ceo' in recs[0]), '정해진 칸만 적는다(규칙 $other 거절)');
  await S.updateCoRec(k, recs[0].id, { amount: 44000, note: '시험 메모' });
  assert.equal((await S.listCoRecs(k))[0].amount, 44000);
  await S.removeCoRec(k, recs[0].id);
  assert.equal(db.store['pu_docs/co/' + k].r, 0); assert.equal(db.store['pu_docs/co/' + k].n, 2, '기록을 지워도 파일 수는 그대로');
});

test('ⓒ 파일을 붙이거나 뗄 때도 기록 수(r)를 떨어뜨리지 않는다', () => {
  const S = loadStore();
  assert.deepEqual(JSON.parse(JSON.stringify(S.keepCo({ name: 'a', n: 1, r: 5, bz: '1' }, { name: 'a', n: 2, lastAt: 9 }))), { name: 'a', n: 2, lastAt: 9, r: 5, bz: '1' });
  const src = read('js/pu-office-store.js');
  assert.ok((src.match(/return keepCo\(cur, \{ name:/g) || []).length >= 2, 'addCoDoc·unlinkCoDoc 이 keepCo 를 거치지 않습니다');
});

test('ⓓ 배선·규칙 — 문서관리가 명단 모듈을 싣고, 규칙에 co_recs 자리가 있다', () => {
  const html = read('docs-esign.html');
  const a = html.indexOf('<script src="js/pu-co-roster.js'), b = html.indexOf('<script src="js/pu-office-docs.js');
  assert.ok(a > 0 && a < b, '명단 모듈을 화면보다 먼저 실어야 합니다');
  assert.match(html, /cards: formCards\(\),\s+\/\* 엑셀 명단/, '맞춰 볼 이알피·기업정보함 줄을 넘기지 않습니다');
  const docs = read('js/pu-office-docs.js');
  assert.match(docs, /openRosterImport/); assert.match(docs, /store\.importCoRecs\(pick/);
  assert.match(docs, /c\.n > 0 \|\| c\.r > 0/, '기록만 있는 회사도 목록에 나와야 합니다');
  const gen = read('scripts/make-firebase-rules.js');
  assert.match(gen, /co_recs: \{ \$k: \{ \$d: \{/);
  assert.match(gen, /src:\s+\{ '\.validate': "newData\.val\(\) === 'import' \|\| newData\.val\(\) === 'manual'( \|\| newData\.val\(\) === 'folder')?" \}/);
});

test('ⓔ PC 폴더 — 우리 계약서류만 고르고(직원 자료는 뺌), 회사·종류·날짜를 짐작한다', () => {
  assert.equal(R.guessKind('자문계약서-가나시험상사.hwp'), '자문');
  assert.equal(R.guessKind('고문계약서[2015년-가나].hwp'), '자문');
  assert.equal(R.guessKind('가나-cms.pdf'), 'CMS');
  assert.equal(R.guessKind('국민연금 EDI 업무대행 신청서.hwp'), 'EDI');
  assert.equal(R.guessKind('컨설팅계약서.hwp'), '컨설팅');
  assert.equal(R.guessKind('위임장(중노위).hwp'), '사건');
  ['근로계약서-가나.hwp', '가나-급여대장-급여내역서 2016.03.08.xls', '연봉계약서.xlsx', '퇴직금중간정산신청서.hwp', '비밀유지서약서.hwp', '촉탁계약서.jpg']
    .forEach((n) => assert.equal(R.guessKind(n), '', n + ' 는 고객사 직원 자료라 빼야 한다'));
  assert.equal(R.coFromPath('10. 자문사관리/1.자문관리/1.가나시험상사/자문계약서.hwp'), '가나시험상사');
  assert.equal(R.coFromPath('10. 자문사관리/0.종료자문사/3.다라테스트(안양)/기본서류/자문계약서.hwp'), '다라테스트', '번호·지역 괄호·흔한 폴더를 건너뛴다');
  assert.equal(R.coFromPath('x/마바테스트/충남2016부해123/위임장3-마바테스트.hwp'), '마바테스트', '사건번호 폴더는 회사가 아니다');
  assert.equal(R.coFromPath('10. 자문사관리/00자문사cms/권형하노무사사무소CMS/사아테스트-cms.pdf'), '사아테스트', '폴더가 흔하면 파일 이름에서');
  assert.deepEqual(R.guessDate('자문계약서_251016.hwp'), { date: '2025-10-16', from: 'name' });
  assert.deepEqual(R.guessDate('견적서20080731.xls'), { date: '2008-07-31', from: 'name' });
  assert.equal(R.guessDate('자문계약서.hwp', new Date(2023, 3, 19).getTime()).from, 'file');
  const rows = R.folderRows([{ name: '근로계약서-가나.hwp', path: 'a/가나/근로계약서-가나.hwp' }, { name: '자문계약서.hwp', path: 'a/가나시험상사/자문계약서.hwp' }]);
  assert.deepEqual(rows.map((r) => r.ours), [false, true]);
});

test('ⓔ 폴더 가져오기 배선 — 기본 🔒 서명본, 같은 파일은 다시 안 올림, 기록에 파일을 잇는다', () => {
  const docs = read('js/pu-office-docs.js');
  assert.match(docs, /function openFolderImport\(/);
  assert.match(docs, /secretCb = el\('input', \{ type: 'checkbox', checked: true \}\)/, '기본이 서명본이어야 한다');
  assert.match(docs, /store\.putOriginal\([\s\S]{0,200}\{ secret: secret \}\)/);
  assert.match(docs, /src: 'folder', docId: d\.docId/);
  assert.match(docs, /store\.hasHash/);
});

test('ⓒ 폴더 가져오기 줄 — docId(20자 푸시 열쇠)를 자르지 않고, 같은 날·같은 종류여도 다른 파일이면 둘 다 적는다', async () => {
  const S = loadStore(), db = fakeDb();
  S.init({ db, storage: null, uid: 'u1', name: '시험' });
  const A = '-AbCdEfGhIjKlMnOpQr1', B = '-AbCdEfGhIjKlMnOpQr2';
  const x1 = await S.importCoRecs([{ coName: '가나시험상사', date: '2016-12-22', kind: 'CMS', src: 'folder', docId: A }]);
  const x2 = await S.importCoRecs([{ coName: '가나시험상사', date: '2016-12-22', kind: 'CMS', src: 'folder', docId: B }]);
  const x3 = await S.importCoRecs([{ coName: '가나시험상사', date: '2016-12-22', kind: 'CMS', src: 'folder', docId: A }]);
  assert.equal(x1.added + x2.added, 2, '다른 파일은 같은 날·같은 종류여도 따로 적는다');
  assert.equal(x3.added, 0, '같은 파일은 다시 적지 않는다');
  const recs = await S.listCoRecs(S.coKey('가나시험상사'));
  assert.deepEqual(recs.map((r) => r.docId).sort(), [A, B], 'docId 가 잘리면 카드와 끊긴다');
});
