/* 머리줄 한 줄로 + 담당·근로자 열 제목 정렬 (대표 지시 2026-09-09)
   「캡쳐1 2줄을 1줄로 정리해달라. 캡쳐23 은삭제 하고 캡쳐4 담당은 캡쳐5의 정렬과
    같이 정렬할 수 있게 해달라. 그리고 이렇게 정리되면 명함, 사업자 기업상세 근로자
    도 모두 같은 방식으로 항상 정렬 해달라.」

   ■ 무엇이 있었나
     ① 제목·탭·보기도구(#pcHead) «아래»에 조건 띠(#pcFilters)가 «따로» 한 줄을
        차지했다. 조건이 없을 땐 안 보이다가 하나(퇴사자 이어받기 등)라도 걸리면
        화면이 두 줄로 늘어났다 줄었다 했다.
     ② 「담당 전체」(고르기)와 「등록일」(정렬) 드롭다운 둘이 있었다 — 그런데
        「담당」 열 제목만은 다른 열(이름·회사·핸드폰·등록일)과 달리 눌러도
        정렬이 안 됐다.
     ③ 기업 상세(co)는 이미 «열 제목만으로» 정렬·거르기가 다 됐다(coSortBy) —
        그것이 본보기였다. 명함·사업자·근로자만 뒤처져 있었다.

   ★ 못 박는 것
     ① #pcFilters 는 #pcHead «안»(탭 뒤 · 도구 앞)에 있다 — 조건이 있을 때만
        같은 줄에서 자라고, 정말 좁을 때만 다음 줄로 넘어간다(늘 둘로 쪼개지 않는다).
     ② #pcMgrFilter·#pcSort 드롭다운은 «없다». 고르기는 담당 배지 클릭
        (filterErpMgr)이, 정렬은 열 제목 클릭이 대신한다 — 잃는 기능이 없다.
     ③ 명함·사업자 표의 「담당」 열 제목을 누르면 실제로 담당 이름순으로 정렬된다
        (listItems 의 'manager' 갈래).
     ④ 근로자 표에도 같은 방식(열 제목 클릭 · 화살표 · 다시 누르면 반대)이 새로
        생겼다 — 이름·사업장·담당·사건번호. 집단으로 접힌 줄은 «사건 대표값»을,
        혼자인 줄은 «그 사람 첫 사건»을 본다.
     ⑤ 기업 상세는 이미 되어 있었다 — 손대지 않았다(회귀 확인만).

     node --test tests/cards-header-oneline-sort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function fnBody(name) {
  const i = SRC.search(new RegExp('(?:^|\\n)(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, name + ' 을 찾지 못했습니다');
  const open = SRC.indexOf('{', i);
  let d = 0;
  for (let k = open; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

/* ══════ ① 머리줄이 «한 줄» — 마크업 순서로 못 박는다 ══════ */

test('★★★ #pcFilters 가 #pcHead «안»(탭 뒤 · 도구 앞)에 있다', () => {
  const a = SRC.indexOf('<div id="pcHead">');
  const bTools = SRC.indexOf('<div id="pcTools">', a);
  const bClose = SRC.indexOf('\n    </div>\n', bTools);   /* #pcHead 닫는 자리(대략) */
  assert.ok(a > 0 && bTools > a, '★ #pcHead 나 #pcTools 를 못 찾았다');
  const seg = SRC.slice(a, bTools);
  assert.match(seg, /<div id="pcErpTabs"><\/div>/, '★ 탭 자리가 없다');
  assert.match(seg, /<div id="pcFilters"/, '★★★ 조건 띠가 #pcHead 안에 없다 — 예전처럼 아래 «따로» 줄을 만든다');
  /* 차례도 본다 — 탭 «다음», 도구 «앞»이어야 한다(도구는 margin-left:auto 로
     늘 오른쪽 끝에 붙는다. 그 사이에 있어야 같은 줄에서 자연히 흐른다) */
  const iTabs = seg.indexOf('id="pcErpTabs"');
  const iFilt = seg.indexOf('id="pcFilters"');
  assert.ok(iTabs > 0 && iFilt > iTabs, '★★ 조건 띠가 탭보다 앞에 있다 — 차례가 어긋났다');
});

test('★★★ 「담당 전체」·「등록일」 드롭다운은 «없다»', () => {
  assert.ok(!/id="pcMgrFilter"/.test(SRC), '★★★ #pcMgrFilter 가 남아 있다');
  assert.ok(!/id="pcSort"/.test(SRC), '★★★ #pcSort 가 남아 있다');
  /* 그래도 「열」·「100개」는 남아야 한다 — 이번에 지우라고 한 것은 둘뿐이다 */
  assert.match(SRC, /id="colBtn"/, '★ 「열」 단추까지 지워졌다 — 요청 범위 밖이다');
  assert.match(SRC, /id="pcPageSize"/, '★ 「100개」 드롭다운까지 지워졌다 — 요청 범위 밖이다');
});

test('★★ 고르기(배지)·거르는 셈(_mgrGone)은 드롭다운 없이도 그대로다', () => {
  /* 담당 배지를 누르면 여전히 filterErpMgr 로 거른다 — 드롭다운만 없앴지
     「담당으로 고르는 길」 자체를 없앤 것이 아니다. */
  assert.match(SRC, /filterErpMgr\(/, '★ 배지로 거르는 길이 사라졌다');
  assert.match(fnBody('renderPCTable'), /_mgrGone = _allMgrs\.filter\(mbRetired\)/,
    '★★ 이어받기 띠의 셈이 사라졌다');
});

/* ══════ ②③ 담당 열 — 실제로 정렬해 본다 ══════ */

/* listItems 의 정렬 한 토막만 떠서, 진짜 배열을 정말 정렬하는지 돌려 본다.
   ⚠ 소스에 글자가 있는지만 보면 안 된다 — switch 문 하나 빠뜨려도 정규식은 안 잡는다.
   ⚠ 중괄호를 «세어» 뜬다 — 고정된 글자 수로 자르면 한 줄만 길어져도 어긋난다. */
function sliceBraces(startMark) {
  const i = SRC.indexOf(startMark);
  assert.ok(i >= 0, startMark + ' 을 찾지 못했습니다');
  const open = SRC.indexOf('{', i);
  let d = 0;
  for (let k = open; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  assert.fail(startMark + ' 의 끝을 찾지 못했습니다');
}
function runManagerSort(items, dir) {
  const switchSrc = sliceBraces('switch(state.sortKey){');
  const ctx = {
    console, String,
    ErpMatch: { mgrs: it => it._mgrs || [] },
    state: { sortKey: 'manager', sortDir: dir || 'asc' }
  };
  vm.createContext(ctx);
  vm.runInContext(
    'function val(it){ ' + switchSrc + ' }\n' +
    'globalThis.__sorted = items.slice().sort(function(a,b){' +
    '  var x=val(a), y=val(b), d = state.sortDir==="asc"?1:-1;' +
    '  return String(x).localeCompare(String(y),"ko")*d; });',
    Object.assign(ctx, { items })
  );
  return ctx.__sorted;
}

test('★★★ 담당 열 제목을 누르면 «진짜로» 담당 이름순이 된다', () => {
  const items = [
    { id: 'a', _mgrs: ['최기운'] },
    { id: 'b', _mgrs: ['김보람'] },
    { id: 'c', _mgrs: ['박재원'] }
  ];
  const asc = runManagerSort(items, 'asc').map(x => x.id);
  assert.equal(asc.join(','), 'b,c,a', '★★★ 가나다순 정렬이 안 된다');
  const desc = runManagerSort(items, 'desc').map(x => x.id);
  assert.equal(desc.join(','), 'a,c,b', '★ 다시 누르면(내림차순) 방향이 안 뒤집힌다');
});

test('★★ 부담당만 있고 주담당이 없어도, 배지·거르기와 «같은 이름»(mgrs[0])으로 정렬한다', () => {
  const items = [{ id: 'a', _mgrs: ['을'] }, { id: 'b', _mgrs: ['갑'] }];
  assert.equal(runManagerSort(items, 'asc').map(x => x.id).join(','), 'b,a');
});

test('★ 담당 열 제목이 다른 열처럼 눌러서 정렬된다(정적 확인)', () => {
  const fn = fnBody('renderPCTable');
  assert.match(fn, /onclick="sortBy\('manager'\)"/, '★ 담당 열 제목에 정렬 걸이가 없다');
  assert.match(fn, /담당\$\{sortArrow\('manager'\)\}/, '★ 정렬 화살표가 없다');
});

/* ══════ ④ 근로자 — 새로 연 정렬 ══════ */

function loadWkSort() {
  const ctx = { console, Object, String, Array, Math };
  ctx.state = { wkSortKey: null, wkSortDir: 'asc', wkPage: 3 };
  ctx.wkRepaint = () => { ctx._repainted = true; };
  ctx.wkSiteOf = p => p._site || '';
  vm.createContext(ctx);
  vm.runInContext([fnBody('wkFoldRows'), fnBody('wkSortBy'),
    SRC.slice(SRC.indexOf("const wkArrow = key =>"), SRC.indexOf('\n', SRC.indexOf("const wkArrow = key =>")))]
    .join('\n'), ctx);
  return ctx;
}

/* 사람 셋(제각각 회사·담당·사건번호가 다름) + 집단 진정 하나(둘이 걸림).
   ⚠ rank(최근 활동순)를 «가나다순과 일부러 어긋나게» 둔다 — 자모순이 30·15·5
     그대로 알파벳 앞뒤와 같이 가면, 정렬 걸이를 통째로 죽여도(기본값 rank순으로
     빠지면) 우연히 같은 차례가 나와 고장을 못 잡는다(2026-09-09 고장넣기에서
     실제로 샜다). 가장 앞선 이름(가나)이 rank 는 «가장 낮게». */
function wkSample() {
  const oneA = { key: 'p1', name: '다라', rank: 30, _site: '다회사',
    cases: [{ mgr: '최기운', caseNo: 'C-3' }] };
  const oneB = { key: 'p2', name: '가나', rank: 5, _site: '가회사',
    cases: [{ mgr: '김보람', caseNo: 'C-1' }] };
  const g1 = { key: 'p3', name: '집단1', rank: 10,
    cases: [{ group: true, caseKey: 'G', title: '나사건', company: '나회사',
              mgr: '박재원', caseNo: 'C-2' }], primaryOf: { G: true } };
  const g2 = { key: 'p4', name: '집단2', rank: 15,
    cases: [{ group: true, caseKey: 'G', title: '나사건', company: '나회사',
              mgr: '박재원', caseNo: 'C-2' }], primaryOf: {} };
  return [oneA, oneB, g1, g2];
}

test('★★★ 근로자 표도 «열 제목을 누르면» 실제로 정렬된다 — 집단은 사건값, 혼자는 첫 사건값', () => {
  const c = loadWkSort();
  c.state.wkSortKey = 'name';
  /* group 행은 사건 title(나사건), one 행은 사람 이름(가나·다라) — 가나다 순 */
  const rows = c.wkFoldRows(wkSample());
  const label = r => r.type === 'group' ? r.cs.title : r.p.name;
  assert.equal(rows.map(label).join(','), '가나,나사건,다라',
    '★★★ 이름(집단은 사건 제목)으로 안 정렬된다');
});

test('★★ 담당으로 정렬하면 집단 행도 «그 사건의 담당»으로 줄을 선다', () => {
  const c = loadWkSort();
  c.state.wkSortKey = 'manager';
  const rows = c.wkFoldRows(wkSample());
  const mgr = r => r.type === 'group' ? r.cs.mgr : r.p.cases[0].mgr;
  assert.equal(rows.map(mgr).join(','), '김보람,박재원,최기운', '★★ 담당순이 안 된다');
});

test('★ 사업장·사건번호로도 정렬된다', () => {
  const c = loadWkSort();
  c.state.wkSortKey = 'site';
  let rows = c.wkFoldRows(wkSample());
  assert.equal(rows.map(r => r.type === 'group' ? r.cs.company : c.wkSiteOf(r.p)).join(','),
    '가회사,나회사,다회사', '★ 사업장순이 안 된다');
  c.state.wkSortKey = 'caseNo';
  rows = c.wkFoldRows(wkSample());
  const cn = r => r.type === 'group' ? r.cs.caseNo : r.p.cases[0].caseNo;
  assert.equal(rows.map(cn).join(','), 'C-1,C-2,C-3', '★ 사건번호순이 안 된다');
});

test('★★★ 정렬을 «안 걸었으면» 예전 그대로(rank 내림차순)다', () => {
  const c = loadWkSort();
  /* wkSortKey 를 안 건드린다(null) */
  const rows = c.wkFoldRows(wkSample());
  /* rank: g1/g2 는 집단이라 max(10,15)=15, p1=30, p2=5 → 내림차순: p1(30) · group(15) · p2(5) */
  const key = r => r.type === 'group' ? 'group' : r.p.key;
  assert.equal(rows.map(key).join(','), 'p1,group,p2',
    '★★★ 정렬을 안 걸었는데 차례가 바뀌었다 — 예전 화면을 쓰던 사람이 놀란다');
});

test('★★★ wkSortBy — 같은 칸을 다시 누르면 방향이 뒤집히고, 다른 칸을 누르면 «오름차순»부터', () => {
  const c = loadWkSort();
  c.wkSortBy('manager');
  assert.equal(c.state.wkSortKey, 'manager');
  assert.equal(c.state.wkSortDir, 'asc', '★ 처음 누르면 오름차순부터가 아니다');
  c.wkSortBy('manager');
  assert.equal(c.state.wkSortDir, 'desc', '★★★ 같은 칸을 다시 눌러도 방향이 안 바뀐다');
  c.wkSortBy('site');
  assert.equal(c.state.wkSortDir, 'asc', '★ 다른 칸으로 옮기면 오름차순부터 다시 시작해야 한다');
  assert.equal(c.state.wkPage, 0, '★ 정렬을 바꿨는데 쪽이 안 돌아간다 — 빈 쪽에 갇힐 수 있다');
  assert.ok(c._repainted, '★ 화면을 다시 안 그린다');
});

test('★ 근로자 표 머리글 넷에 걸이·화살표·설명이 있다', () => {
  const fn = fnBody('wkListHtml');
  ['name', 'site', 'manager', 'caseNo'].forEach(k => {
    assert.match(fn, new RegExp("onclick=\"wkSortBy\\('" + k + "'\\)\""),
      '★ ' + k + ' 열에 정렬 걸이가 없다');
    assert.match(fn, new RegExp('\\$\\{wkArrow\\(\'' + k + '\'\\)\\}'),
      '★ ' + k + ' 열에 화살표가 없다');
  });
  /* 「걸린 사건」·「서류」·「해」는 정렬 대상이 아니다 — 안 건드렸는지도 본다 */
  assert.ok(!/onclick="wkSortBy\('docs'\)"/.test(fn) && !/onclick="wkSortBy\('cases'\)"/.test(fn),
    '★ 정렬 뜻이 없는 칸까지 걸었다');
});

/* ══════ ⑤ 기업 상세는 이미 되어 있었다 — 회귀만 확인 ══════ */

test('기업 상세는 손대지 않았다 — 여전히 열 제목만으로 정렬·거르기가 된다', () => {
  const fn = fnBody('coListHtml');
  assert.match(fn, /onclick="coSortBy\('mgr'\)"/, '기업 상세의 담당 정렬이 사라졌다');
  /* 기업 상세 쪽에는 원래도 드롭다운이 없었다 — 이번에 새로 생기지도 않아야 한다 */
  const tools = fnBody('coToolsHtml');
  assert.ok(!/<select/.test(tools), '★ 기업 상세에 없던 드롭다운이 새로 생겼다');
});
