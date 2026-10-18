'use strict';
/* 재무관리(거래내역) 폰 화면 — 출금 표를 «카드 두 줄»로 (대표 지시 2026-10-17)
   「재무관리 폰 화면이다. 컴팩트하고 깔끔하게 한눈에 볼 수 있게 정리해달라」

   대표 폰 화면(약 412px)에서 본 것:
     ① 출금 표만 폰 손질이 없어 일곱 칸이 옆으로 밀렸다 — 금액·카드·적요 셋만 보였다
     ② 적요마다 뒤에 「0」이 붙어 있었다 — 은행 메모 0 이 아니라 `row._hint && …` 의 0 이었다
        (Preact 는 `0 && x` 의 0 을 글자로 그린다)
     ③ 목록이 화면 절반 아래에서야 시작했다 — 라디오 줄 2줄 · 단추 띠 3줄 · 머리 2줄
   덤으로 찾은 것:
     ④ 출금 표가 «달 거르기 전» 목록으로 그려졌다 — 10월을 골라도 모든 달이 섞였다
     ⑤ 「출금 N건 등록」이 이 달 N건을 묻고 «모든 달»을 등록했다

   ⚠ 값(px)이 아니라 규칙을 본다 — 여백을 더 다듬어도 안 깨지게.
   실측(Playwright · 가짜 묶음 · 412/390/360px): 가로 넘침 0 · 표 폭 = 화면 폭 ·
   목록 시작 277 → 174px · 줄 높이 57 → 59px(대신 일곱 칸이 다 보임) · 「0」 40줄 → 0줄. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
const FL = ERP.slice(ERP.indexOf('function FinanceLedger('), ERP.indexOf('function FinanceIncome'));
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const F = bare(FL);
const C = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 폰 구간(max-width:640px) 블록만 모은다 — 넓은 화면 규칙과 섞어 보면 「폰에서만」을 증명할 수 없다 */
function mediaBlocks(css, max) {
  const out = [];
  const re = new RegExp('@media \\(max-width:\\s*' + max + 'px\\)\\s*\\{', 'g');
  let m;
  while ((m = re.exec(css))) {
    let i = m.index + m[0].length, d = 1;
    for (; i < css.length && d > 0; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push(css.slice(m.index, i));
  }
  return out;
}
const PHONE_BLOCKS = mediaBlocks(C, 640);
const PHONE = PHONE_BLOCKS.join('\n');
const WIDE = (function () {
  let w = C;
  mediaBlocks(C, '\\d+').forEach(function (b) { w = w.replace(b, ''); });
  return w;
})();

/* 출금 표 몸통의 한 줄(tr) — tbody 에서 시작해 그 줄을 만드는 return h('tr' 를 자른다 */
function expRowSrc() {
  const at = F.search(/h\('tbody',null,expCardList\.slice\(0,ldShow\)/);
  assert.ok(at > 0, '출금 표 몸통을 못 찾았습니다');
  const r = F.indexOf("return h('tr',", at);
  assert.ok(r > 0, '출금 표의 줄을 못 찾았습니다');
  return F.slice(r, F.indexOf("h('tfoot'", r));
}

/* ══ ② 「0」 ══ */
test('★★ 「같은 결제」 표는 참/거짓이다 — 숫자 0 이면 Preact 가 글자 「0」을 그린다', () => {
  const builds = F.match(/_hint:\s*[^,}\n]+/g) || [];
  assert.ok(builds.length >= 2, '줄을 만드는 두 자리(쌓인 묶음·방금 올린 파일)를 못 찾았습니다');
  builds.forEach(function (b) {
    assert.match(b, /^_hint:\s*!!x\.dupHint\s*$/,
      '★★ ' + b + ' — 1/0 으로 두면 0 인 줄마다 적요 뒤에 「0」이 찍힌다(대표 화면 304줄 전부)');
  });
  assert.doesNotMatch(F, /[^!]row\._hint\s*&&/,
    '★★ «!!» 없이 row._hint && … 로 그리면 숫자 0 이 글자로 나온다');
});

/* ══ ④ 달·오늘 거르기 ══ */
test('★★ 출금 표는 «달·오늘을 거른 뒤» 목록으로 그린다', () => {
  const list = F.indexOf('var expCardList = expList.filter');
  const cnt = F.indexOf('var expCardCnt = ');
  const mon = F.search(/expList=expList\.filter\(function\(r\)\{return String\(r\.date\|\|''\)\.slice\(0,7\)===incMon;\}\)/);
  const today = F.indexOf('if(ldOnlyToday){');
  assert.ok(list > 0 && cnt > 0 && mon > 0 && today > 0, '목록·달 거르기·오늘 거르기 자리를 못 찾았습니다');
  assert.ok(list > mon && list > today,
    '★★ 달 거르기보다 앞에서 만들면 10월을 골라도 표에 모든 달이 섞인다(머리는 「10월 35건」인데 표는 304줄)');
  assert.ok(cnt > mon && cnt > today, '★ 카드별 건수도 고른 달 안에서 센다 — 「전체 N」과 어긋난다');
});

/* ══ ⑤ 묻는 건수 = 하는 일 ══ */
test('★★ 「출금 N건 등록」은 «센 그 목록»을 등록한다 — 묻는 건수와 하는 일이 같다', () => {
  const m = F.match(/var expReadyCnt\s*=\s*(\w+)\.filter/);
  assert.ok(m, 'expReadyCnt 를 못 찾았습니다');
  const btn = F.slice(F.indexOf("popConfirm('카테고리 선택된 출금 '+expReadyCnt"));
  assert.ok(btn.length < F.length, '「출금 N건 등록」 확인창을 못 찾았습니다');
  assert.match(btn.slice(0, 300), new RegExp('registerExpRows\\(' + m[1] + '\\)'),
    '★★ 확인창은 ' + m[1] + ' 로 센 건수를 묻는데 다른 목록을 등록하면 안 묻은 줄까지 들어간다');
});

test('★ 등록은 한 벌(registerExpRows) — 넘겨받은 줄 가운데 «카테고리 있고 미처리»만', () => {
  const at = FL.indexOf('function registerExpRows(');
  assert.ok(at > 0, 'registerExpRows 를 못 찾았습니다');
  let d = 0, i = FL.indexOf('{', at);
  for (; i < FL.length; i++) { if (FL[i] === '{') d++; else if (FL[i] === '}' && --d === 0) break; }
  const src = FL.slice(at, i + 1);
  const saved = [], learned = [], marked = [], removed = [], calls = { learn: 0, mark: 0 };
  const ctx = {
    expCat: { a: 'exp-salary', b: '', c: 'exp-rent', d: 'exp-rent' },
    EXP_CATS: [{ code: 'exp-salary', name: '급여' }, { code: 'exp-rent', name: '임차료' }],
    saveExpense: (r, c) => { if (r._k === 'd') throw new Error('저장 실패'); saved.push(r._k + ':' + c); },
    /* ★ 배우기·처리 표시는 «한 번»에 간다(2026-10-18 「동기화 충돌 의심」) — 줄마다 부르면 이 둘이 실패한다 */
    erpLearnExpenseCat: () => { throw new Error('줄마다 배우면 표가 줄 수만큼 바뀐다'); },
    erpMarkBankRowProcessed: () => { throw new Error('줄마다 표시하면 표가 줄 수만큼 바뀐다'); },
    erpLearnExpenseCatMany: (ps) => { calls.learn++; ps.forEach((p) => learned.push(p.memo + ':' + p.category)); return ps.length; },
    erpMarkBankRowsProcessed: (ms) => { calls.mark++; ms.forEach((m) => marked.push(m.row._k + ':' + m.kind + ':' + m.label)); return ms.length; },
    removeRow: (k) => removed.push(k),
    window: { _erpErrLog: () => {} },               // 저장 실패를 기록만 하고 다음 줄로 간다
  };
  vm.createContext(ctx);
  vm.runInContext(src + '; this.f = registerExpRows;', ctx);
  const n = ctx.f([
    { _k: 'a', memo: '급여 홍길동' },
    { _k: 'b', memo: '아직 안 고름' },             // 카테고리 없음 → 안 한다
    { _k: 'c', memo: '임대료', _dup: true },        // 이미 처리 → 안 한다
    { _k: 'd', memo: '임대료 10월' },               // 저장 실패 → 처리 표시도 안 한다(다시 등록할 길을 남긴다)
  ]);
  assert.equal(n, 1);
  assert.deepEqual(saved, ['a:exp-salary']);
  assert.deepEqual(learned, ['급여 홍길동:exp-salary'], '★ 등록하며 배우지 않으면 다음 달에 또 골라야 한다');
  assert.deepEqual(marked, ['a:expense:급여'], '★ 처리 표시가 없으면 같은 줄을 또 등록한다 · 저장 못 한 줄에 표시하면 다시 못 한다');
  assert.deepEqual(calls, { learn: 1, mark: 1 }, '★★ 배우기·처리 표시는 «한 번»씩이어야 한다');
  assert.deepEqual(removed, ['a']);
  /* 고르는 «그 자리»에서는 아직 화면에 안 들어간 새 값을 넘긴다(catMap) */
  saved.length = 0;
  assert.equal(ctx.f([{ _k: 'b', memo: '아직 안 고름' }], { b: 'exp-rent' }), 1);
  assert.deepEqual(saved, ['b:exp-rent'], 'catMap 을 안 쓴다');
  assert.equal(ctx.f(null), 0, '빈 목록에서 죽지 않는다');
  /* 두 단추가 모두 이 한 벌을 쓴다 — 저마다 등록하면 언젠가 한쪽만 고친다 */
  assert.ok((F.match(/registerExpRows\(/g) || []).length >= 3, '「출금 N건 등록」·「고른 것 등록」이 한 벌을 쓰지 않는다');
});

/* ══ ☐ + 번호 (CLAUDE.md 대표 지시 2026-10-05) ══ */
test('★★ 출금 표의 맨 왼쪽은 ☐, 그다음은 «보이는 순서» 번호', () => {
  const row = expRowSrc();
  const tds = [...row.matchAll(/h\('td',\{className:'(ld-x-[a-z]+)'/g)].map(function (m) { return m[1]; });
  assert.deepEqual(tds.slice(0, 2), ['ld-x-chk', 'ld-x-no'], '★★ 맨 왼쪽 두 칸이 ☐·번호가 아니다');
  assert.match(row, /h\('td',\{className:'ld-x-chk'[\s\S]{0,200}?type:'checkbox'/);
  assert.match(row, /className:'ld-x-no'[^)]*\)\},_re\+1\)/, '★ 번호는 지금 화면 순서(_re+1)다 — 저장하는 번호가 아니다');
  assert.match(row, /!row\._dup && h\('input',\{type:'checkbox'/, '이미 처리된 줄은 고를 것이 없다(입금 표와 같다)');
  /* 머리 칸 수 == 더보기 colSpan — ☐ 가 늘었으니 함께 늘어야 줄이 안 밀린다(erp-ledger-paging 이 센다) */
});

test('★★ 머리 ☐ 는 «지금 보이는 줄»만 고른다 — 걸러져 안 보이는 줄은 안 고른다', () => {
  assert.match(F, /var _expVisOk\s*=\s*expCardList\.slice\(0,ldShow\)\.filter\(function\(r\)\{ return !r\._dup; \}\)/,
    '★★ 거른 목록·그린 만큼(ldShow)이 아니면 안 보이는 줄까지 골라진다');
  assert.match(F, /var expChkVis\s*=\s*_expVisOk\.filter/, '★ 띠는 «보이는» 고른 줄만 센다');
  /* 머리 ☐ 는 한 벌(함수)을 두 자리에서 부른다 — 넓은 화면은 이름표 줄, 폰은 거르는 줄 */
  assert.ok((F.match(/expAllBox\(\)/g) || []).length >= 3, '머리 ☐ 가 한 벌이 아니다');
});

test('★★ 고르기만으로는 아무것도 안 바뀐다 — 띠의 단추를 눌러야 하고, 등록은 건수를 묻는다', () => {
  const at = F.indexOf("className:'ld-x-sel'");
  assert.ok(at > 0, '고른 것 띠를 못 찾았습니다');
  assert.match(F.slice(at - 80, at), /expChkVis\.length>0 && h\('div',\{$/, '★ 띠는 고른 것이 있을 때만 나온다');
  const bar = F.slice(at, F.indexOf("h('table',{className:'ld-xt'", at));
  assert.match(bar, /건 선택'/, '「N건 선택」이 없다');
  assert.match(bar, /popConfirm\([^;]*expChkReady[\s\S]{0,200}?registerExpRows\(expChkVis\)/,
    '★★ 고른 줄 등록은 건수를 묻고, 고른(보이는) 줄만 등록한다');
  assert.match(bar, /setExpChk\(\{\}\)/, '선택 풀기가 없다');
  /* 카테고리 한꺼번에 고르기는 «고르기만» — 거기서 저장하면 묻지 않고 돈 기록이 생긴다 */
  const pick = bar.slice(bar.indexOf("h('select'"), bar.indexOf("expChkReady>0 &&"));
  assert.doesNotMatch(pick, /saveExpense|registerExpRows|dbUpsert/, '★★ 한꺼번에 고르기가 곧바로 저장한다');
});

test('★ 고른 것은 «보이는 것이 바뀌면» 비운다 — 그리고 스스로를 비우는 고리를 만들지 않는다', () => {
  const m = F.match(/useEffect\(function\(\)\{\s*if\(Object\.keys\(expChk\)\.length\) setExpChk\(\{\}\);\s*\}, \[([^\]]*)\]\)/);
  assert.ok(m, '비우는 효과를 못 찾았습니다');
  const deps = m[1].split(',').map(function (s) { return s.trim(); });
  ['incMon', 'ldTabEff', '_ldSrc'].forEach(function (k) {
    assert.ok(deps.includes(k), '★ ' + k + ' 가 바뀌어도 고른 것이 남는다 — 안 보이는 줄이 골라진 채 남는다');
  });
  assert.ok(!deps.includes('expChk'), '★★ expChk 를 넣으면 고르자마자 스스로 비운다');
});

/* ══ ① 폰 카드 ══ */
test('★★ 폰에서 출금 표의 줄은 «두 줄 격자»다 — 칸을 없애지 않고 자리만 정한다', () => {
  assert.match(F, /h\('table',\{className:'ld-xt'/, '표에 손잡이가 없다');
  assert.match(PHONE, /\.ld-xt tbody tr\{ display:grid !important;/);
  const CELLS = ['chk', 'no', 'date', 'amt', 'card', 'memo', 'cat', 'act'];
  const row = expRowSrc();
  CELLS.forEach(function (k) {
    assert.match(row, new RegExp("className:'ld-x-" + k + "'"), '★ ld-x-' + k + ' 손잡이가 줄에 없다');
    const m = PHONE.match(new RegExp('\\.ld-xt \\.ld-x-' + k + '\\s*\\{([^}]*)\\}'));
    assert.ok(m, '★ ld-x-' + k + ' 의 폰 자리가 없다');
    const gr = (m[1].match(/grid-row:\s*([^;]+);/) || [])[1];
    assert.ok(gr, '★ ld-x-' + k + ' 가 몇째 줄인지 정해지지 않았다');
    assert.ok(/^(1|2|1 \/ 3)$/.test(gr.trim()), '★ ld-x-' + k + ' 가 셋째 줄 이상으로 내려간다(' + gr + ') — 두 줄이어야 한다');
    assert.doesNotMatch(m[1], /display:\s*none/, '★ ld-x-' + k + ' 를 접으면 그 값이 폰에서 사라진다');
  });
});

test('★★ 폰에서도 ☐·번호는 빼지 않는다 (CLAUDE.md 「폰에서도 빼지 않는다」)', () => {
  ['chk', 'no'].forEach(function (k) {
    assert.doesNotMatch(PHONE, new RegExp('\\.ld-x-' + k + '[^{]*\\{[^}]*display:\\s*none'),
      '★★ 폰에서 ld-x-' + k + ' 를 접었다');
  });
  /* 폰은 이름표 줄을 접으므로 «☐ 전체»가 거르는 줄에 선다 */
  assert.match(PHONE, /\.ld-xt \.ld-x-allm > input\{ display:inline-block; \}/);
  assert.match(F, /className:'ld-x-allm'[^)]*\},expAllBox\(\)\)/);
});

test('★ 폰에서 접는 것은 «다른 데 같은 말이 있는 것»뿐이다', () => {
  /* 「선택 필요」 = 옆 고르개가 말한다 · ✕ = 실수로 누르기 쉽고 기록이 안 남는다 ·
     카드 「승인」 = 거의 모든 줄이 같은 말이다(「취소」는 남는다) */
  const hid = PHONE.match(/\.ld-xt \.ld-x-need, \.ld-xt \.ld-act-x, \.ld-xt \.ld-x-cardst:not\(\.c\)\{ display:none !important; \}/);
  assert.ok(hid, '접는 규칙을 못 찾았습니다');
  assert.doesNotMatch(PHONE, /\.ld-x-cardst\.c[^{]*\{[^}]*display:\s*none/, '★★ 「취소」를 접으면 되돌린 결제를 못 알아본다');
});

test('★★ 칸 안은 «한 줄»이다 — 480px 아래 공용 줄바꿈 규칙을 이 표에서는 막는다', () => {
  /* [style*="display: flex"][style*="gap"]{flex-wrap:wrap} 이 「학습됨」을 고르개 아래로,
     「승인」을 카드 번호 아래로 내려 그 줄만 두 배로 키웠다(실측) */
  assert.match(C, /\[style\*="display: flex"\]\[style\*="gap"\]\s*\{\s*flex-wrap:\s*wrap/, '공용 규칙이 사라졌다면 이 검사를 다시 보세요');
  assert.match(PHONE, /\.ld-xt \.ld-x-memo > div, \.ld-xt \.ld-x-cat > div, \.ld-xt \.ld-x-card > div\{ flex-wrap:nowrap !important; \}/,
    '★★ 칸 안 flex 가 접혀 두 줄이 된다');
});

test('★ 줄 안 고르개는 공용 42px 보다 낮다 — 고르개 하나가 카드 키를 다 먹지 않게', () => {
  const m = PHONE.match(/\.ld-xt \.ld-x-cat select\{([^}]*)\}/);
  assert.ok(m, '줄 안 고르개 규칙이 없다');
  const h = Number((m[1].match(/min-height:\s*(\d+)px/) || [])[1]);
  assert.ok(h > 0 && h < 42, '★ 공용 42px 그대로면 줄마다 두 배로 높아진다(' + h + 'px)');
});

test('★★ 넓은 화면은 그대로다 — 폰 손잡이를 감추는 것 말고는 이 표 규칙이 없다', () => {
  const wideXt = (WIDE.match(/\.ld-xt[^{]*\{[^}]*\}/g) || []);
  assert.deepEqual(wideXt.map(function (r) { return r.replace(/\s+/g, ' ').trim(); }),
    ['.ld-xt .ld-x-allm > input{ display:none; }'],
    '★★ 넓은 화면에 ld-xt 규칙이 새어 나갔다 — PC 표가 바뀐다');
  assert.doesNotMatch(WIDE, /\.ld-lw\s*\{[^}]*display:\s*none/, '★★ 긴 말을 넓은 화면에서도 접는다');
  assert.match(PHONE, /\.ld-lw\{ display:none !important; \}/);
});

/* ══ 「한 칸은 한 줄」 — 넓은 화면에도 ══ */
test('★ 카테고리 칸 — 고르개와 「학습됨」이 한 줄에 선다(넓은 화면도)', () => {
  const at = F.indexOf("h('td',{className:'ld-x-cat'");
  assert.ok(at > 0, '카테고리 칸을 못 찾았습니다');
  const cell = F.slice(at, F.indexOf("h('td',{className:'ld-x-act'", at));
  assert.match(cell.slice(0, 200), /h\('div',\{style:\{display:'flex',alignItems:'center'/,
    '★ 고르개와 학습됨이 한 줄 상자에 없다');
  assert.doesNotMatch(cell, /marginTop:'2px'/, '★ 학습됨을 아래로 내려 그 줄만 두 줄이 된다');
});

/* ══ ③ 위쪽 줄 ══ */
test('★ 보는 종류(통장·카드·CMS)는 폰에서 알약 — 라디오는 «보이지만 않게» 둔다', () => {
  assert.equal((F.match(/className:'ld-src'\+\(fileType==='(?:bank|card|nicebill)'\?' on':''\)/g) || []).length, 3,
    '세 종류에 손잡이가 다 있어야 한다');
  const r = PHONE.match(/\.ld-src input\[type='radio'\]\{([^}]*)\}/);
  assert.ok(r, '라디오 감추기 규칙이 없다');
  assert.doesNotMatch(r[1], /display:\s*none/, '★ display:none 이면 자판·화면읽기로 못 고른다 — 투명하게만');
  /* 긴 말은 접되 뜻은 남는다 — 「통장」·「CMS」·「입금 83」 */
  assert.match(F, /'🏦 ',h\('span',\{className:'ld-lw'\},'은행 '\),'통장'/);
  assert.match(F, /'🏦 ',h\('span',\{className:'ld-lw'\},'나이스빌 '\),'CMS'/);
});

test('★ 「📆 오늘」은 0건일 때만 폰에서 접는다 — 있으면 숫자와 함께 선다', () => {
  assert.match(F, /className:'ld-bar-today'\+\(ldTodayCnt\?'':' off'\)/);
  assert.match(PHONE, /\.ld-bar:not\(\.on\) \.ld-bar-today\.off\{ display:none !important; \}/);
  assert.doesNotMatch(PHONE, /\.ld-bar-today(?!\.off)[^{,]*\{[^}]*display:\s*none/, '★ 오늘 것이 있는데도 접으면 아침에 볼 것을 못 본다');
});

test('★ 폰 띠에서 «설정·가끔 쓰는 것»은 ⚙ 뒤로, 주 단추는 통째 한 줄', () => {
  /* 카테고리 자동(배운 것은 열자마자 저절로 채워진다)·저절로 등록/확정 스위치는 한 번 정하면 그만이다 */
  assert.ok((F.match(/className:'ld-bar-auto'/g) || []).length >= 4, '접을 연장에 손잡이가 없다');
  assert.match(F, /ldTabEff==='exp' && expReadyCnt>0 && h\('button',\{className:'ld-bar-go'/,
    '★ 「출금 N건 등록」이 주 단추가 아니면 폰에서 칸 하나에 끼어 잘린다');
});

test('★ 폰 띠 첫 줄은 좁은 만큼 «그림·낱말»만 접는다 — 숫자는 끝까지 남는다', () => {
  const b440 = mediaBlocks(C, 440).join('\n');
  const b380 = mediaBlocks(C, 380).join('\n');
  assert.match(b440, /\.ld-tools-w/);
  assert.match(b440, /\.ld-tab-ico/);
  assert.match(b380, /\.ld-tab-todo-w\{ display:none; \}/);
  /* 탭 숫자(cnt·todo)는 접을 손잡이 «밖»에 있어야 한다 */
  assert.match(F, /\(sp>0 \? label\.slice\(sp\+1\) : label\)\+' '\+cnt,/);
  assert.match(F, /h\('span',\{className:'ld-tab-todo-w'\},'미처리 '\),todo\)/);
});

test('★ 떠 있는 공용 단추(즐겨찾기·최신)를 목록이 비켜 선다 — 줄 끝 금액·맨 끝 줄이 안 가린다', () => {
  /* 412px 실측: 오른쪽 「즐겨찾기」 손잡이(폭 25px)가 금액 끝 13px 를, 「● 최신」이 맨 끝 줄을 덮었다.
     두 단추는 24개 앱 공용이라 옮기지 않고 목록이 비킨다. 값이 아니라 «비키는 규칙이 있는가»를 본다. */
  const pr = PHONE.match(/\.ld-xt tbody tr, \.ld-tb tbody tr\{ padding-right:(\d+)px !important; \}/);
  assert.ok(pr && Number(pr[1]) > 8, '★ 줄 오른쪽 여백이 없어 즐겨찾기 손잡이가 금액을 가린다');
  assert.match(PHONE, /\.ld-xt tfoot, \.ld-tb tfoot\{ margin-bottom:\d+px; \}/, '★ 맨 끝 줄이 최신 단추 밑에 깔린다');
});
