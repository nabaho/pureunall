'use strict';
/* 계약서 양식 → 문서관리 › 사무관리서류 › 계약서 양식 (대표 지시 2026-09-26)

   「환경설정 계약서 양식에 계약서 서식이 있다 이부분 그대로 빼서 문서관리에 넣어 줄수 있나
    제목은 사무관리서류 로해서 하위에 계약서 양식을 별도로 두는것이다」 → 「칸을없앤다」

   ■ 지키는 것
     ⓐ 양식을 «고치는» 화면은 문서관리 하나다 — 이알피 환경설정 칸은 없다.
     ⓑ 이알피 「📄 계약서 출력」은 여전히 같은 양식을 읽는다(자료 자리 data/contract_forms 그대로).
     ⓒ 칸 목록·기본 양식·기본 양식 채우기는 js/pu-contract-forms.js «한 곳»이다.
     ⓓ 문서관리는 서버 최신본 «위에» 한 건만 고친다 — 들고 있던 사본을 통째로 밀지 않는다.
     ⓔ 기본 양식을 지우면 «지웠다는 기록»을 남긴다 — 안 남기면 이알피가 도로 넣는다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments, stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8').replace(/\r\n/g, '\n');
const ERP = read('pu-erp.html');
const DOCS = read('docs-esign.html');
const CF = read('js/pu-contract-forms.js');

/* 공용 파일을 «그대로» 싣는다 — 베껴 적으면 견주는 뜻이 없다 */
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(CF, box);
  return box.PuContractForms;
}
/* 밖으로 꺼내 견준다 — 상자 안에서 만든 배열은 deepEqual 이 튕긴다 */
const out = (v) => JSON.parse(JSON.stringify(v));

/* 가짜 실시간DB — transaction 은 «서버 본문»을 넘겨주고 돌려받은 것을 적는다 */
function fakeDb(store) {
  return {
    store,
    ref(p) {
      return {
        once() { return Promise.resolve({ val: () => store[p] == null ? null : JSON.parse(JSON.stringify(store[p])) }); },
        transaction(fn, done) {
          const next = fn(store[p] == null ? null : JSON.parse(JSON.stringify(store[p])));
          store[p] = JSON.parse(JSON.stringify(next));
          done(null, true, { val: () => store[p] });
        }
      };
    }
  };
}

test('ⓐ ★★ 이알피 환경설정 › 사무관리기준에 「계약서 양식」 칸이 없다', function () {
  const src = stripComments(ERP);
  const biz = cutFn(src, 'function BizMasters(');
  assert.ok(biz.indexOf('계약서 양식') < 0, '★★ 사무관리기준에 계약서 양식 칸이 되살아났습니다');
  assert.ok(src.indexOf('function ContractFormMasters(') < 0,
    '★★ 이알피에 양식 관리 화면이 다시 생겼습니다 — 고치는 곳이 둘이 되면 서로 덮어씁니다');
  assert.ok(src.indexOf('function ContractFormModal(') < 0, '★★ 이알피에 양식 고치기 창이 남아 있습니다');
});

test('ⓐ ★★ 문서관리에 「사무관리서류 › 계약서 양식」이 있고, 거기서 양식 화면을 연다', function () {
  const nav = DOCS.slice(DOCS.indexOf('<nav class="side"'), DOCS.indexOf('</nav>'));
  assert.match(nav, /사무관리서류/, '★★ 왼쪽 목록에 「사무관리서류」가 없습니다');
  const grp = nav.indexOf('사무관리서류'), item = nav.indexOf('계약서 양식');
  assert.ok(item > grp, '★★ 「계약서 양식」이 사무관리서류 «아래»에 있지 않습니다');
  assert.match(DOCS, /<script src="js\/pu-contract-forms\.js\?v=\d+"><\/script>/, '★ 공용 파일을 안 싣거나 캐시 번호가 없습니다');
  const show = cutFn(stripComments(DOCS), 'function showPane(');
  assert.match(show, /PuContractForms\.mount\(/, '★★ 계약서 양식 칸을 눌러도 양식 화면이 안 열립니다');
  assert.match(show, /!formsMounted/, '★ 칸을 오갈 때마다 양식을 다시 받습니다 — 처음 한 번만 싣습니다');
});

test('ⓐ ★ 뒤로가기로 칸을 바꾸면 «앱까지» 나가지 않는다', function () {
  /* js/pu-back.js 는 이 창이 스스로 처리했다고 알려야(__puBackNav) 비켜선다.
     안 알리면 계약서 양식에서 뒤로가기 한 번에 칸도 바뀌고 앱도 나간다. */
  const src = stripComments(DOCS);
  const at = src.indexOf("addEventListener('popstate'");
  assert.ok(at > 0, '★ 뒤로가기로 칸을 되돌리는 자리가 없습니다');
  assert.match(src.slice(at, at + 400), /__puBackNav = true/, '★ 뒤로가기 한 번에 앱까지 나갑니다');
  /* 이 창의 손잡이가 먼저 달려야 한다 — pu-back.js 는 </body> 앞에 싣는다 */
  assert.ok(src.indexOf("addEventListener('popstate'") < src.indexOf('js/pu-back.js'), '★ 뒤로가기 손잡이 차례가 바뀌었습니다');
});

test('ⓐ ★ 나오지 않는 걸음 — 칸이 그대로면 pushState 없이 다시 그린다', function () {
  /* 칸이 이미 그 칸이면(예: #forms:x 에서 「계약서 양식」을 다시 누름) showPane 만
     다시 부르고 pushState 는 안 한다 — 안 그러면 화면은 그대로인 채 걸음만
     하나 심겨, 뒤로가기가 popstate 만 일으키고 pu-back.js 가 앱을 나가 버린다. */
  const src = stripComments(DOCS);
  const nav = cutFn(src, "b.addEventListener('click', function ()");
  assert.match(nav, /paneFromHash\(\) === name/, '★ 칸이 그대로인지 안 가려 뒤로가기가 앱을 나가 버립니다');
});

test('ⓐ ★ popstate — 칸은 그대로여도 «고른 양식»이 바뀌었으면 맞춰 준다', function () {
  const src = stripComments(DOCS);
  const at = src.indexOf("addEventListener('popstate'");
  const pop = cutFn(src.slice(at), 'function ()');
  assert.match(pop, /formsUi\.select\(/, '★ #forms:x → #forms:y 뒤로가기에서 고른 양식을 안 맞춥니다');
});

test('ⓐ ★ onFormSelect — 다른 칸에 있을 때 null 선택 알림을 무시한다', function () {
  const src = stripComments(DOCS);
  const fn = cutFn(src, 'function onFormSelect(');
  assert.match(fn, /^\s*if \(!id && \$\('paneForms'\)\.hidden\) return;/m,
    '★ 양식이 지워지며 onSelect(null) 이 불려도 다른 칸을 보고 있으면 양식 칸으로 튕겨서는 안 됩니다');
});

test('ⓑ ★★ 이알피가 공용 파일을 싣고, 계약서 출력은 그 기본 양식을 쓴다', function () {
  const src = stripComments(ERP);
  const tag = src.search(/<script src="js\/pu-contract-forms\.js\?v=\d+"><\/script>/);
  assert.ok(tag > 0, '★★ 이알피가 공용 파일을 안 싣습니다 — 계약서 출력이 PuContractForms 를 못 찾아 멎습니다');
  /* 쓰기 «전에» 실어야 한다 — 이알피 본문 스크립트보다 앞 */
  assert.ok(tag < src.indexOf('function getContractForms('), '★ 공용 파일을 너무 늦게 싣습니다');
  const get = cutFn(src, 'function getContractForms(');
  assert.match(get, /PuContractForms\.mergeSeeds\(/, '★★ 기본 양식 채우기를 이알피가 따로 들고 있습니다 — 두 벌이면 둘이 다른 양식을 봅니다');
  ['var CONTRACT_FORM_SEED', 'var CASE_CHEDANG_FORMS', 'var CONTRACT_FORM_VARS'].forEach(function (n) {
    assert.ok(src.indexOf(n) < 0, '★★ 이알피에 「' + n + '」 사본이 남아 있습니다');
  });
});

test('ⓑ ★★ 이알피 getContractForms 를 «실제로» 돌려 본다 — 고친 것·지운 것은 그대로', function () {
  const PCF = loadCF();
  const seedIds = out(PCF.SEED.concat(PCF.CHEDANG)).map((s) => s.id);
  const store = {};
  const box = { PuContractForms: PCF, Array, Object,
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    dbSet: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; } };
  vm.createContext(box);
  vm.runInContext(cutFn(stripComments(ERP), 'function getContractForms('), box);

  /* ① 비어 있으면 기본 양식으로 채운다 */
  let got = out(box.getContractForms());
  assert.deepStrictEqual(got.map((f) => f.id), seedIds, '★★ 빈 표에 기본 양식이 안 들어갑니다');

  /* ② 사람이 고친 기본 양식·새로 넣은 양식은 그대로, 지운 기본 양식은 안 되살린다 */
  const edited = Object.assign({}, out(PCF.SEED[0]), { name: '가나상사 전용 자문계약서' });
  const mine = { id: 'fm-mine', kind: 'company', name: '홍길동 위임장', body: '{{회사명}}', attachments: [], enabled: true };
  store.contract_forms = [edited, mine];
  store.contract_forms_removed = [seedIds[1]];
  got = out(box.getContractForms());
  const byId = {}; got.forEach((f) => { byId[f.id] = f; });
  assert.strictEqual(byId[edited.id].name, '가나상사 전용 자문계약서', '★★ 사람이 고친 기본 양식을 기본값으로 덮었습니다');
  assert.ok(byId['fm-mine'], '★★ 사람이 넣은 양식이 사라졌습니다');
  assert.ok(!byId[seedIds[1]], '★★ 지운 기본 양식을 도로 넣었습니다');
  assert.strictEqual(got.length, seedIds.length + 1 - 1, '빠진 기본 양식만 더해져야 합니다');
});

test('ⓒ ★ 계약 종류가 이알피와 «같은 순서·같은 이름»이다', function () {
  const PCF = loadCF();
  const kinds = ERP.slice(ERP.indexOf('var CONTRACT_KINDS = ['), ERP.indexOf('function kindInfo('));
  const erp = [];
  kinds.replace(/\{ v:'(\w+)',\s*label:'([^']+)',\s*icon:'([^']+)'/g, function (_m, v, label, icon) { erp.push({ v, label, icon }); return _m; });
  assert.ok(erp.length >= 6, '이알피 계약 종류를 못 읽었습니다: ' + erp.length);
  assert.deepStrictEqual(out(PCF.KINDS).map((k) => ({ v: k.v, label: k.label, icon: k.icon })), erp,
    '★ 문서관리와 이알피의 계약 종류가 어긋납니다 — 한쪽에서 넣은 양식이 다른 쪽 탭에 안 보입니다');
});

test('ⓓ ★★ 저장은 «서버 최신본 위에» 한 건만 — 그사이 남이 넣은 것을 안 지운다', async function () {
  const PCF = loadCF();
  const db = fakeDb({
    'data/contract_forms': { v: [{ id: 'fm-other', kind: 'case', name: '임꺽정 사건 위임장', body: 'x' }], u: 5 }
  });
  const before = Date.now();
  const mine = { id: 'fm-new', kind: 'company', name: '가나상사 자문계약서', body: '{{계약금액}}' };
  await PCF.changeForms(db, [], (list) => list.concat([mine]));
  const saved = db.store['data/contract_forms'];
  const ids = saved.v.map((f) => f.id);
  assert.ok(ids.indexOf('fm-other') >= 0, '★★ 그사이 서버에 들어온 양식을 지웠습니다');
  assert.ok(ids.indexOf('fm-new') >= 0, '★★ 새 양식이 안 들어갔습니다');
  /* u 가 커져야 이알피가 «새것»으로 받는다(되돌림 방지는 u 로 가린다) */
  assert.ok(saved.u > 5 && saved.u >= before, '★★ u 를 안 올려 이알피가 옛 양식을 계속 씁니다');
  assert.ok(Array.isArray(saved.v), '이알피는 배열로 읽습니다');

  /* 서버가 「0,1,2…」 열쇠 지도로 돌려줘도 한 건도 안 잃는다 */
  db.store['data/contract_forms'] = { v: { 0: { id: 'a', kind: 'fund', name: 'a' }, 1: { id: 'b', kind: 'fund', name: 'b' } }, u: 9 };
  await PCF.changeForms(db, [], (list) => list);
  const ids2 = db.store['data/contract_forms'].v.map((f) => f.id);
  assert.ok(ids2.indexOf('a') >= 0 && ids2.indexOf('b') >= 0, '★★ 열쇠 지도 꼴의 서버 본문을 잃었습니다');
});

test('ⓓ ★★ 화면의 모든 저장이 그 한 길(changeForms)로만 간다 — 통째 set 금지', function () {
  const src = stripJs(CF);
  const m = cutFn(src, 'function mount(');
  assert.ok(!/\.set\(/.test(m), '★★ 양식 화면이 서버에 통째로 set 합니다 — 그사이 남이 고친 것이 사라집니다');
  assert.match(cutFn(m, 'function change('), /changeForms\(db, S\.removed/, '★★ 저장이 서버 최신본을 안 거칩니다');
});

test('ⓔ ★★ 기본 양식을 지우면 «지웠다는 기록»을 남기고, 되돌리기는 그 한 건만 되살린다', function () {
  const m = cutFn(stripJs(CF), 'function mount(');
  const del = cutFn(m, 'function del(');
  assert.match(del, /isSeedId\(fm\.id\)/, '★★ 기본 양식인지 안 가립니다');
  assert.match(del, /changeRemoved\(db, function \(rm\) \{ if \(rm\.indexOf\(fm\.id\) < 0\) rm\.push\(fm\.id\)/,
    '★★ 기본 양식을 지워도 기록을 안 남깁니다 — 이알피가 다음에 열 때 도로 넣습니다');
  /* 되돌리기 — 통째로 되돌리면 그사이 남이 고친 것을 지운다 */
  assert.match(del, /list\.concat\(\[fm\]\)/, '★★ 되돌리기가 «그 한 건»만 넣지 않습니다');
});

test('ⓔ ★ 지운 기록을 «실제로» 적는다 — 서버 최신본 위에', async function () {
  const PCF = loadCF();
  const db = fakeDb({ 'data/contract_forms_removed': { v: ['fm-1'], u: 3 } });
  await PCF.changeRemoved(db, (rm) => { rm.push('fm-2'); return rm; });
  const saved = db.store['data/contract_forms_removed'];
  assert.deepStrictEqual(saved.v, ['fm-1', 'fm-2'], '★ 앞서 지운 기록을 잃었습니다');
  assert.ok(saved.u > 3, '★ u 를 안 올렸습니다');
});

test('★★ 사무관리서류 아래에 계약서 양식 → 트리 칸 → 기업별 → 보관함 순서', function () {
  const nav = DOCS.slice(DOCS.indexOf('<nav class="side"'), DOCS.indexOf('</nav>'));
  const at = (s) => nav.indexOf(s);
  assert.ok(at('사무관리서류') < at('data-pane="forms"'), '계약서 양식이 사무관리서류 아래가 아닙니다');
  assert.ok(at('data-pane="forms"') < at('id="formsTree"'), '★ 트리 칸이 계약서 양식 아래가 아닙니다');
  assert.ok(at('id="formsTree"') < at('data-pane="co"') && at('data-pane="co"') < at('data-pane="arc"'), '★ 기업별·보관함 칸이 없거나 순서가 다릅니다');
});

test('★★ 칸마다 «처음 한 번만» 싣고, 양식 화면에 트리·보관함을 잇는다', function () {
  const show = cutFn(stripComments(DOCS), 'function showPane(');
  assert.match(show, /tree:\s*\$\('formsTree'\)/, '★ 트리 칸을 안 넘겨 왼쪽에 양식이 안 나옵니다');
  assert.match(show, /archive:\s*archiveOriginal/, '★★ 올린 원본이 보관함에 안 남습니다');
  assert.match(show, /!mounted\.co/); assert.match(show, /!mounted\.arc/);
  assert.match(show, /PuOfficeDocs\.mountCompanies\(/); assert.match(show, /PuOfficeDocs\.mountArchive\(/);
});

test('★ 주소 — #forms:{id}·#co·#arc 로 새로고침해도 보던 자리', function () {
  const src = stripComments(DOCS);
  const pf = cutFn(src, 'function paneFromHash(');
  assert.match(pf, /#forms:/); assert.match(pf, /'#co'/); assert.match(pf, /'#arc'/);
  assert.match(cutFn(src, 'function formFromHash('), /decodeURIComponent/);
});

test('★ 창고 SDK·보관함 버킷·새 파일을 싣는다', function () {
  assert.match(DOCS, /firebasejs\/9\.23\.0\/firebase-storage-compat\.js/, '★ 창고 SDK 가 없습니다 — 보관함이 늘 실패합니다');
  assert.match(DOCS, /storage\('gs:\/\/pureun-erp-hrphotos'\)/, '★ 보관함 버킷이 다릅니다 — 규칙이 있는 창고가 아닙니다');
  assert.match(DOCS, /<script src="js\/pu-office-store\.js\?v=\d+"><\/script>/);
  assert.match(DOCS, /<script src="js\/pu-office-docs\.js\?v=\d+"><\/script>/);
  assert.match(DOCS, /<script src="js\/pu-photo-store\.js\?v=\d+"><\/script>/);
  assert.match(DOCS, /<script src="js\/pu-contract-forms\.js\?v=([2-9]|\d{2,})"><\/script>/, '★ 캐시 번호를 안 올려 옛 화면이 뜹니다');
});

/* ── C안 뼈대 (대표 지적 2026-09-27 「왜 대시보드를 왼쪽끝으로 정리 안했나?」) ──
   틀(.shell)이 1360px 가운데 정렬이라 넓은 화면(1862px)에서 메뉴가 왼쪽 끝에서 250px 떠 있었다. */
test('★★ 왼쪽 메뉴는 화면 왼쪽 끝에 붙는다 — 틀을 가운데로 묶지 않는다', function () {
  const css = DOCS.slice(DOCS.indexOf('<style>'), DOCS.indexOf('</style>'));
  const shell = (css.match(/\.shell\{[^}]*\}/) || [''])[0];
  assert.ok(shell, '.shell 규칙이 없습니다');
  assert.ok(!/max-width\s*:\s*\d/.test(shell), '★★ 틀 폭을 묶었습니다 — 넓은 화면에서 메뉴가 왼쪽 끝에서 뜹니다: ' + shell);
  assert.ok(!/margin\s*:\s*0\s+auto/.test(shell), '★★ 틀을 가운데 정렬했습니다: ' + shell);
  const side = (css.match(/\.side\{[^}]*\}/) || [''])[0];
  assert.match(side, /background/, '메뉴 바탕이 없어 본문과 구분되지 않습니다');
  assert.match(side, /border-right/, '메뉴와 본문 사이 선이 없습니다');
});

test('★ 메뉴 묶음 — 전자송부 › 집단체불 위임장 / 사무관리서류 › 계약서 양식·서식집(검토 후)·기업별·보관함', function () {
  const nav = DOCS.slice(DOCS.indexOf('<nav class="side"'), DOCS.indexOf('</nav>'));
  const at = (s) => nav.indexOf(s);
  assert.ok(at('전자송부') >= 0 && at('전자송부') < at('data-pane="esign"'), '전자송부가 묶음 머리가 아닙니다');
  assert.ok(at('data-pane="esign"') < at('사무관리서류'));
  assert.ok(at('id="formsTree"') < at('서식집') && at('서식집') < at('data-pane="co"'), '서식집 자리가 없거나 순서가 다릅니다');
  assert.match(nav, /서식집[\s\S]{0,200}aria-disabled="true"|aria-disabled="true"[\s\S]{0,200}서식집/, '서식집은 검토 전이라 누를 수 없어야 합니다');
});

test('★ 누를 수 없는 메뉴(서식집)는 칸 오가기에 끼지 않는다', function () {
  const src = stripComments(DOCS);
  assert.ok(src.indexOf("querySelectorAll('.side .nav')") < 0, "data-pane 없는 메뉴까지 집어 '#null' 로 갑니다 — '.side .nav[data-pane]' 로 고르세요");
  assert.ok(src.indexOf("querySelectorAll('.side .nav[data-pane]')") >= 0);
});

test('★★ 뒤로가기 — 주소에 양식이 없으면(#forms) «다른 양식»으로 보지 않는다', function () {
  /* 첫 화면은 첫 양식을 «조용히» 보여 준다(주소는 #forms 그대로). 이것을 다른 양식으로 보면
     pu-back 의 첫 빈 걸음을 삼켜 뒤로가기가 한 번 헛돈다(검토 2026-09-27). */
  const src = stripComments(DOCS);
  const at = src.indexOf("addEventListener('popstate'");
  assert.match(src.slice(at, at + 500), /formFromHash\(\) != null/);
});
