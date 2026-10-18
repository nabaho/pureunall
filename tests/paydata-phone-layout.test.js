'use strict';
/* 급여데이터함 — 폰에서 «옆으로 밀리는 페이지»·«세로로 깨진 이름»이 돌아오지 않게 (대표 지시 2026-10-18 「폰화면관리」)
   실행: node --test tests/paydata-phone-layout.test.js

   ⚠ 왜 이 검사가 생겼나 — 360·411px 로 로그인한 채 재 보니:
     · 머리줄(.dhead)의 단추가 화면 밖으로 나가 페이지 폭이 첫 화면 472px · 서랍 790px 로 벌어졌다.
       폰은 그 폭을 통째로 줄여 그리거나 옆으로 밀게 만든다 — 대표가 처음 본 「오른쪽으로 넘친 줄」이 이것이다.
     · 사업장 이름·파일 이름 칸이 좁아 «한 글자씩 세로로» 쌓였다(한 줄이 열 줄 높이).
     · 서랍 탭이 찾기 칸에 밀려 «한 칸에 하나씩» 세로로 쌓였다.
   그래서 폰 구간에서만: 머리줄은 접고, 줄은 «두 줄 카드»(1줄 ☐·№·이름, 2줄 나머지), 탭·달은 한 줄로 옆으로 민다.

   ⚠ 이 검사는 px 값을 박지 않는다 — «넘치면 접는가 / 한 줄인가 / ☐·번호가 첫 줄에 있는가 / PC 는 그대로인가» 를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
const store = fs.readFileSync(path.join(R, 'js', 'pu-paydata-store.js'), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

/* ── CSS 를 «폰 구간»과 «바탕»으로 가른다(중괄호 짝을 센다 — 정규식 하나로는 안쪽 } 에서 잘린다) ── */
function splitMedia() {
  const phone = [];
  let base = '', i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at < 0) { base += css.slice(i); break; }
    base += css.slice(i, at);
    const open = css.indexOf('{', at);
    const cond = css.slice(at, open);
    let depth = 0, k = open;
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') { depth--; if (!depth) break; }
    }
    /* 폰 구간 = max-width 만 있고 그 폭이 사이드 칸을 감추는 폭(이 앱의 폰 기준) 이하인 것 */
    const mw = cond.match(/max-width:\s*(\d+)px/);
    if (mw && !/min-width/.test(cond)) phone.push({ w: +mw[1], body: css.slice(open + 1, k) });
    i = k + 1;
  }
  return { phone, base };
}
const { phone, base } = splitMedia();
/* 사이드 칸(.colist)을 감추는 폭 — 폰 구간의 바깥 경계다. 숫자를 박지 않고 CSS 에서 읽는다. */
const SIDE_HIDE = (phone.filter(b => /\.colist[^{]*\{[^}]*display:none/.test(b.body)).map(b => b.w))[0];

function rulesOf(block) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(block))) out.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] });
  return out;
}
const PHONE_RULES = [].concat(...phone.filter(b => SIDE_HIDE && b.w <= SIDE_HIDE).map(b => rulesOf(b.body)));
const BASE_RULES = rulesOf(base);
/* 선택자 조각(정규식)에 걸리는 폰 규칙의 몸통을 모두 합친다 */
function phoneBody(selRe) {
  return PHONE_RULES.filter(r => r.sel.split(',').some(s => selRe.test(s.trim()))).map(r => r.body).join(';');
}

function cut(name) {
  const m = html.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}

test('폰 구간이 있다 — 사이드 칸을 감추는 폭을 CSS 에서 읽었다', () => {
  assert.ok(SIDE_HIDE > 0, '.colist 를 감추는 @media(max-width) 를 찾지 못했습니다');
  assert.ok(PHONE_RULES.length > 0);
});

/* ══════ ① 머리줄 — 넘치면 접는다(옆으로 밀리는 페이지를 만들지 않는다) ══════ */
test('★ 단추가 셋 넘는 머리줄(첫 화면·서랍)에는 폰에서 접는 손잡이(data-h)가 달려 있다', () => {
  ['screenSites', 'screenDrawer'].forEach(fn => {
    assert.match(cut(fn), /class="dhead" data-h="/,
      '★ ' + fn + ' 의 머리줄이 폰에서 안 접힙니다 — 단추가 화면 밖으로 나가 페이지가 옆으로 벌어집니다');
  });
});

test('★ 폰에서 그 머리줄은 줄을 바꾼다(flex-wrap) — 한 줄에 우겨넣지 않는다', () => {
  assert.match(phoneBody(/^\.dhead\[data-h\]$/), /flex-wrap:\s*wrap/,
    '★ 머리줄이 안 접히면 단추 묶음이 화면 밖으로 나갑니다(실측 790px)');
});

test('★ 폰에서 단추 묶음은 제 줄 폭을 넘지 않고, 넘치면 «그 안에서» 옆으로 민다', () => {
  const b = phoneBody(/\.dhead\[data-h[^\]]*\]\s+\.dacts$/);
  assert.match(b, /max-width:\s*100%|flex:\s*1\s+1\s+0/, '단추 묶음이 줄 폭을 넘을 수 있습니다');
  assert.match(b, /overflow-x:\s*(auto|scroll)/, '넘친 단추를 밀어서 볼 길이 없습니다');
  assert.match(phoneBody(/\.dhead\[data-h[^\]]*\]\s+\.dacts>\*$/), /white-space:\s*nowrap/,
    '단추 글자가 두 줄로 접힙니다');
});

test('★ 폰에서 제목은 남는 자리만 먹고(…로 줄고) 숫자·단추를 밀어내지 않는다', () => {
  const t = phoneBody(/^\.dhead\[data-h\]\s+\.dtitle$/);
  assert.match(t, /flex:\s*1\s+1\s+0/, '제목이 제 글자 폭을 고집하면 숫자가 다음 줄로 밀립니다');
  assert.match(base, /\.dtitle\{[^}]*text-overflow:ellipsis/, '제목이 …로 안 줄면 칸을 뚫고 나갑니다');
});

/* ══════ ② 줄 — 폰에서 «두 줄 카드»: 1줄 ☐·№·이름 / 2줄 나머지 ══════ */
function gridCard(rowSel, nameCls) {
  const sel = new RegExp('^' + rowSel.replace(/\./g, '\\.') + '$');
  const body = phoneBody(sel);
  assert.match(body, /display:\s*grid/, '★ ' + rowSel + ' 가 폰에서 카드가 아닙니다 — 이름이 세로로 깨집니다');
  const areas = (body.match(/grid-template-areas:\s*((?:"[^"]*"\s*)+)/) || [])[1];
  assert.ok(areas, rowSel + ' 에 칸 배치(grid-template-areas)가 없습니다');
  const lines = areas.match(/"[^"]*"/g).map(s => s.slice(1, -1).trim().split(/\s+/));
  assert.ok(lines.length >= 2, '★ ' + rowSel + ' 가 두 줄이 아닙니다 — 부가 정보가 이름 칸을 좁힙니다');
  const areaOf = child => {
    const b = phoneBody(new RegExp('^' + rowSel.replace(/\./g, '\\.') + '>' + child.replace(/\./g, '\\.') + '$'));
    return (b.match(/grid-area:\s*([\w-]+)/) || [])[1];
  };
  /* ☐·번호·이름이 «첫 줄»에 있어야 한다(CLAUDE.md 「☐ 고르기 칸 + 번호」·두 줄 카드의 본) */
  ['label', '.pkno', '.' + nameCls].forEach(ch => {
    const a = areaOf(ch);
    assert.ok(a, rowSel + '>' + ch + ' 의 자리가 없습니다');
    assert.ok(lines[0].indexOf(a) >= 0, '★ ' + ch + ' 가 첫 줄에 없습니다 — ☐·번호·이름은 늘 첫 줄입니다');
  });
  /* 한 칸은 한 줄 — 이름은 …로 줄인다(세로로 쌓이지 않는다) */
  const nm = phoneBody(new RegExp('^' + rowSel.replace(/\./g, '\\.') + '>\\.' + nameCls + '$'));
  assert.match(nm, /white-space:\s*nowrap/, '★ 이름이 줄을 바꿉니다 — 한 칸은 한 줄입니다');
  assert.match(nm, /text-overflow:\s*ellipsis/, '이름이 넘치면 …로 줄여야 합니다');
  assert.match(nm, /min-width:\s*0/, '이름 칸이 줄어들 수 없으면 카드를 뚫고 나갑니다');
}

test('★ 사업장 줄은 폰에서 두 줄 카드 — 1줄 ☐·№·이름', () => gridCard('.row.siterow', 'snm'));
test('★ 서랍 줄은 폰에서 두 줄 카드 — 1줄 ☐·№·파일 이름', () => gridCard('.row.drow', 'dnm'));

test('★ 줄인 이름의 전문은 title 로 남는다(눌러 보거나 길게 눌러 본다)', () => {
  assert.match(cut('screenSites'), /class="snm"[^>]*title="'/, '사업장 이름 전문이 사라집니다');
  assert.match(cut('screenDrawer'), /class="dnm"[^>]*title="'/, '파일 이름 전문이 사라집니다');
});

/* ⚠ PC 는 그대로여야 한다 — 두 줄 카드용 묶음 상자는 PC 에서 «상자가 없어야» 예전 한 줄과 같다 */
test('★ PC 는 그대로 — 폰에서 묶는 상자는 바탕 규칙에서 display:contents 다', () => {
  const wrappers = new Set();
  PHONE_RULES.forEach(r => r.sel.split(',').forEach(s => {
    const m = s.trim().match(/^\.row\.(?:siterow|drow)>\.([\w-]+)$/);
    if (m && /display:\s*flex/.test(r.body)) wrappers.add(m[1]);
  }));
  assert.ok(wrappers.size >= 2, '폰에서 묶는 상자를 찾지 못했습니다');
  wrappers.forEach(w => {
    const ok = BASE_RULES.some(r => r.sel.split(',').some(s => s.trim() === '.' + w) && /display:\s*contents/.test(r.body));
    assert.ok(ok, '★ .' + w + ' 가 PC 에서 상자로 그려집니다 — PC 줄 모양이 바뀝니다');
  });
});

/* 실제로 그려 본다 — 줄마다 ☐·번호·이름이 있고, 나머지는 묶음 상자 안에 들어간다 */
function loadSites() {
  const sb = { window: {}, console, Date };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(store, { filename: 'store.js' }).runInContext(sb);
  new vm.Script([
    'const S = window.PuPaydataStore; S.init({uid:"U1", name:"점검", isAdmin:true});',
    'const App = ' + JSON.stringify({
      month: '2026-10', pick: {}, pending: {}, me: { uid: 'U1', email: 'p001@pureun.kr' }, owners: {}, shares: {},
      myOrder: [], dir: null, sideView: 'all', colFilter: 'all', colQuery: '',
      companies: [
        { id: 'c1', name: '(주)가나다라마바사아자차카타파하 점검', managerMain: 'P001', managerSubs: [] },
        { id: 'c2', name: '점검상사', managerMain: 'P001', managerSubs: [] }],
      arrivals: { c1: { '202610': { attend: { a: 1 }, last: 1 } } }
    }) + ';',
    cut('esc'), cut('bannerHtml'), cut('jsq'), cut('thisMonth'), cut('coArrivedAt'),
    cut('pickOn'), cut('pickToggle'), cut('pickSetAll'), cut('pickList'),
    cut('pickAllOn'), cut('pickPrune'), cut('pickOf'), cut('pickPut'),
    cut('companyDocCount'), cut('sitesModel'), cut('sideCtx'), cut('guessTag'), cut('siteState'), cut('sideListModel'),
    cut('monthShift'), cut('monthCount'), cut('monthAhead'), "const WEEKDAY = ['일','월','화','수','목','금','토'];",
    cut('todayLabel'), cut('monthStripHtml'), cut('pickBar'), cut('mailBarHtml'), cut('screenSites'),
    'window.screenSites = screenSites;'
  ].join('\n'), { filename: 'sites.js' }).runInContext(sb);
  return sb.window;
}

test('★ 그린 사업장 줄마다 ☐·번호·이름이 있고, 상태 딱지는 이름 뒤에 온다', () => {
  const out = loadSites().screenSites();
  const rows = out.split('<div class="row siterow').slice(1);
  assert.equal(rows.length, 2, '사업장 줄이 카드 손잡이(siterow)를 안 달고 있습니다');
  rows.forEach(r => {
    const ck = r.indexOf('type="checkbox"'), no = r.indexOf('class="pkno"'), nm = r.indexOf('class="snm"');
    const pill = r.indexOf('class="stpill');
    assert.ok(ck >= 0 && no > ck && nm > no, '☐ → 번호 → 이름 차례가 아닙니다');
    assert.ok(pill > nm, '상태 딱지가 이름보다 앞섭니다');
  });
});

/* ══════ ③ 서랍 거르개 — 달·탭·찾기를 한 줄씩, 탭은 옆으로 민다 ══════ */
test('★ 폰에서 서랍 탭은 한 줄 — 세로로 쌓지 않고 옆으로 민다', () => {
  const b = phoneBody(/#tabsBar$/);
  assert.match(b, /flex-wrap:\s*nowrap/, '★ 탭이 한 칸에 하나씩 세로로 쌓입니다(찾기 칸에 밀려서)');
  assert.match(b, /overflow-x:\s*(auto|scroll)/, '넘친 탭을 밀어서 볼 길이 없습니다');
  assert.match(phoneBody(/#tabsBar \.foldbar$/), /flex-wrap:\s*nowrap/, '폴더 칩이 탭 줄 안에서 또 줄을 바꿉니다');
});

test('★ 폰에서 찾기 칸은 PC 의 최소 폭을 풀어 준다 — 안 풀면 탭을 밀어낸다', () => {
  assert.match(base, /\.dfind\{[^}]*min-width:\s*\d/, '(PC 규칙) 찾기 칸 최소 폭');
  assert.match(phoneBody(/\.dfind$/), /min-width:\s*0/, '★ 폰에서 찾기 칸이 최소 폭을 고집합니다');
});

test('★ 폰에서 달 줄은 한 줄 — 「직접 적기」 하나만 다음 줄로 떨어지지 않는다', () => {
  const b = phoneBody(/^\.mstrip$/);
  assert.match(b, /flex-wrap:\s*nowrap/);
  assert.match(b, /overflow-x:\s*(auto|scroll)/);
});

/* ══════ ④ 그 밖에 폰에서 두 줄로 접히던 단추·칸 ══════ */
test('★ 서류 보기 머리의 「← 돌아가기」는 접히지 않고, 긴 파일 이름이 …로 준다', () => {
  assert.match(phoneBody(/#viewer \.back$/), /white-space:\s*nowrap/);
  assert.match(phoneBody(/#viewer \.bar span$/), /text-overflow:\s*ellipsis/);
});

test('★ 이 달 값 표 — 옆으로 밀어도 근로자 이름 칸은 왼쪽에 붙어 있다', () => {
  const b = phoneBody(/td\.who$/);
  assert.match(b, /position:\s*sticky/, '★ 표를 밀면 누구 값인지 안 보입니다');
  assert.match(b, /white-space:\s*nowrap/, '이름이 세로로 깨집니다');
});

test('★ 폰에서 ☐ 는 손가락으로 누를 만큼 — 누르는 자리를 넓힌다', () => {
  const b = phoneBody(/^\.row\.siterow>label$/);
  assert.match(b, /padding:\s*\d/, '고르기 칸 누르는 자리가 체크 상자 크기뿐입니다');
});
