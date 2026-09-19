/* 정관 머리·제3조 손보기 · 서명란을 «번호 붙인 표»로
 *
 * 대표 지시 2026-09-19
 *   「별지 7도 확인」
 *   「정관이름은 기금법인 이름이다. 00으로 하지 말고 연결해라」
 *   「기금소재지는 이미 기금법인 주소와 같다. 기업주소는 필요없다. 제3조 아래 필요없다.」
 *   「년월일은 가운데 해야하고 줄간격을 조금 더 넓게 해달라」
 *   「캡쳐5는 모두 열을 좀 일치시켜라」
 *   「설립합의서에 기업하고 이름 열을 일치시키고 넘버링 해라」
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름·주소는 전부 가짜다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');

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
/* 줄째로 꺼내기 — 괄호를 세는 방식은 정규식 상수 안의 [ 에 걸려 엉뚱한 데서 잘린다 */
function grabLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + n);
  return m[0];
}

/* ══════════ ① 부르는 말은 «서식이 쓴 그대로» ══════════ */

const LAB = (() => {
  const box = {};
  new Function([
    grabLine('PARTY_ONE_SRC'), grabLine('PARTY_WHO_SRC'),
    grabLine('SIGN_L'), grabLine('SIGN_R'),
    grabFn('_signLabels'),
    'this.run=_signLabels;',
  ].join('\n')).call(box);
  return box;
})();

test('정관 서명 줄에서 부르는 말을 그대로 뽑는다', () => {
  assert.deepEqual(LAB.run('○○주식회사 근로자대표 ○○○ (인)               ○○주식회사 대표이사 ○○○ (인)'),
    { l: '근로자대표', r: '대표이사' });
});

test('설립합의서(이름이 다음 줄인 꼴)에서도 뽑는다', () => {
  assert.deepEqual(LAB.run('○○주식회사 근로자대표                ○○주식회사 대표이사'),
    { l: '근로자대표', r: '대표이사' });
});

test('★ 「사용자측대표」라 부른 서식은 그 말을 쓴다 — 한 가지로 박으면 없던 말이 찍힌다', () => {
  assert.deepEqual(LAB.run('○○주식회사 근로자측 대표 × × ×      ○○주식회사 사용자측 대표 × × ×'),
    { l: '근로자측 대표', r: '사용자측 대표' });
});

test('말을 못 알아보면 가장 흔한 말로 돌아간다 — 빈 머리를 내보내지 않는다', () => {
  assert.deepEqual(LAB.run(''), { l: '근로자대표', r: '대표이사' });
});

/* ══════════ ② 정관 머리·제3조 ══════════ */

test('★ 정관 제목은 «00» 이 아니라 기금법인 이름이다', () => {
  const t = grabLine('CHARTER_TITLE');
  const re = new RegExp(t.replace(/^var CHARTER_TITLE=\//, '').replace(/\/;$/, ''));
  assert.ok(re.test('00공동근로복지기금 정관'), '공동 정관 표지를 알아봐야 한다');
  assert.ok(re.test('사내근로복지기금 정관'), '사내 정관 표지(00 없음)도 알아봐야 한다');
  assert.ok(!re.test('가나다공동근로복지기금 정관 제3조'), '본문 줄을 제목으로 보면 안 된다');
});

test('속표지의 「00 사내근로복지기금」도 이름으로 바뀐다', () => {
  const m = grabLine('CHARTER_NAME').match(/=\/(.*)\/g;$/);
  assert.ok(m, 'CHARTER_NAME 은 g 표시가 붙은 정규식이어야 한다(줄에 여러 번 나올 수 있다)');
  const re = new RegExp(m[1]);
  assert.ok(re.test('00공동근로복지기금'));
  assert.ok(re.test('00 사내근로복지기금'));
});

test('★ 제3조 — 소재지는 기금법인 주소, 「아래와 같이 분사무소」는 여민다', () => {
  const fn = grabFn('fillCharterHead');
  assert.match(fn, /○○시\\s\*○○구\\s\*○○로\\s\*○○/, '소재지 자리표를 찾아야 한다');
  assert.match(fn, /addr/, '기금법인 주소를 써야 한다');
  assert.match(fn, /분사무소를\\s\*둔다/, '분사무소 예고 문장을 여며야 한다');
  assert.match(fn, /if\(addr\)/, '주소를 모르면 자리표를 그대로 둬야 한다 — 지어내지 않는다');
});

test('★ 제3조 아래 참여회사 소재지 목록은 «지운다» — 채우지 않는다', () => {
  const re = new RegExp(grabLine('CHARTER_BRANCH').replace(/^var CHARTER_BRANCH=\//, '').replace(/\/;$/, ''));
  assert.ok(re.test('“○○시 ○○로 ○○, ○○회사, ○○군 ○○면 ○○길 ○○, ○○회사”'), '공동 정관 줄');
  assert.ok(re.test('“○○시 ○○로 ○○, ○○공장, ○○군 ○○면 ○○길 ○○, ○○공장”'), '사내 정관 줄(공장)');
  assert.match(grabFn('fillCharterHead'), /removeChild\(p\)/, '줄을 통째로 지워야 한다');
  /* 옛 길(fillPartyList 가 «채우던» 규칙)이 남아 있으면 지운 자리에 주소가 되살아난다 */
  assert.ok(grabFn('fillPartyList').indexOf('○○군') < 0, 'fillPartyList 에 옛 채우기가 남아 있다');
});

test('★ 「년 월 일」은 가운데로, 줄간격은 더 넓게', () => {
  const re = new RegExp(grabLine('CHARTER_DATELINE').replace(/^var CHARTER_DATELINE=\//, '').replace(/\/;$/, ''));
  assert.ok(re.test('년     월     일'), '공동 정관의 날짜 줄');
  assert.ok(re.test('년      월    일'), '사내 정관의 날짜 줄(띄어쓰기가 다르다)');
  assert.ok(!re.test('2026년 9월 19일'), '이미 채워진 날짜는 건드리지 않는다');
  const fn = grabFn('fillCharterHead');
  assert.match(fn, /text-align:center/, '가운데로 놓아야 한다');
  const ls = fn.match(/line-height:(\d+)%/);
  assert.ok(ls && Number(ls[1]) > 200, '원본(160~200%)보다 넓어야 한다 — 지금 ' + (ls && ls[1]) + '%');
});

test('★ 날짜를 «지어내지» 않는다 — 정관을 작성한 날은 자료에 없다', () => {
  const fn = grabFn('fillCharterHead');
  assert.ok(!/new Date\(/.test(fn), '오늘 날짜를 끌어다 쓰면 없던 작성일이 생긴다');
});

/* ══════════ ③ 서명란을 표로 ══════════ */

test('★ 서명 줄을 알아보려면 근로자측·사용자측 말이 «둘 다» 있어야 한다', () => {
  const l = new RegExp(grabLine('SIGN_L').replace(/^var SIGN_L=\//, '').replace(/\/;$/, ''));
  const r = new RegExp(grabLine('SIGN_R').replace(/^var SIGN_R=\//, '').replace(/\/;$/, ''));
  const one = '○○주식회사 근로자대표 ○○○ (인)   ○○주식회사 대표이사 ○○○ (인)';
  assert.ok(l.test(one) && r.test(one));
  /* 머리줄은 「위 원」이라 부른다 — 서명 줄로 보면 표가 엉뚱한 데 선다 */
  const head = '각 참여회사 근로자측 위 원                   각 참여회사 사용자측 위원';
  assert.ok(!(l.test(head) && r.test(head)), '머리줄을 서명 줄로 보면 안 된다');
});

test('머리줄은 띄어쓰기를 걷어낸 «글자»로 알아본다 — 원본이 제각각 벌려 놨다', () => {
  const re = new RegExp(grabLine('SIGN_HEAD').replace(/^var SIGN_HEAD=\//, '').replace(/\/;$/, ''));
  assert.ok(re.test('각 참여회사 근로자측 위 원                   각 참여회사 사용자측 위원'.replace(/\s/g, '')));
});

test('★ 참여사업장이 없으면 손대지 않는다 — 자리표가 틀린 이름보다 낫다', () => {
  assert.match(grabFn('fillSignTable'), /if\(!list\.length\) return 0/);
});

test('★ 모르는 이름은 밑줄로 둔다 — 관청 서류에 이름을 지어낼 수 없다', () => {
  const fn = grabFn('fillSignTable');
  assert.match(fn, /＿{3,}/, '빈자리를 밑줄로 그려야 한다');
  assert.ok(!/\|\|\s*'미정'/.test(fn), '없는 이름을 말로 메우면 안 된다');
});

test('사용자측 칸은 서식이 「대표이사」라 부르므로 회사 대표자가 먼저다', () => {
  assert.match(grabFn('fillSignTable'), /String\(s\.ceo\|\|''\)\.trim\(\)\|\|u\.name/,
    '대표자가 없을 때만 사용자대표로 내려가야 한다');
});

test('★ 표 머리와 줄에 번호가 붙는다', () => {
  const fn = grabFn('fillSignTable');
  assert.match(fn, /번호/, '번호 칸이 있어야 한다');
  assert.match(fn, /\(i\+1\)/, '줄마다 번호를 매겨야 한다');
});

test('★ 본문까지 한 마디에 든 서식(설립합의서)은 표를 그 마디 «뒤»에 붙인다', () => {
  const fn = grabFn('fillSignTable');
  assert.match(fn, /host\.nextSibling/, '앞에 놓으면 설립합의서 맨 위에 표가 얹힌다');
  assert.match(fn, /rest>40/, '무엇이 남았는지로 갈라야 한다');
});

/* ══════════ ③-2 사내 정관의 서명 격자 ══════════
   원본 charter_sane 은 이미 두 칸 «표»라 열은 맞아 있다 — 빈 것은 이름이었다. */

test('★ 벌어진 자리표(○ ○ ○ · □ □ □)를 알아본다 — 공동 정관 규칙으로는 안 잡혔다', () => {
  const nm = new RegExp(grabLine('GRID_NAME').replace(/^var GRID_NAME=\//, '').replace(/\/;$/, ''));
  const ti = new RegExp(grabLine('GRID_TITLE').replace(/^var GRID_TITLE=\//, '').replace(/\/;$/, ''));
  assert.ok(nm.test('근로자대표 ○ ○ ○ 인'), '사이가 벌어진 이름 자리표');
  assert.ok(ti.test('□ □ □ ○ ○ ○ 인'), '사이가 벌어진 직책 자리표');
  /* 공동 정관용 자리표 규칙으로는 못 잡는다 — 이 격자가 여태 빈 채로 나간 까닭이다 */
  const old = new RegExp(grabLine('PARTY_WHO_SRC').replace(/^var PARTY_WHO_SRC='/, '').replace(/';$/, '').replace(/\\\\/g, '\\'));
  assert.ok(!old.test('○ ○ ○'), 'PARTY_WHO_SRC 가 벌어진 자리표까지 잡으면 이 함수가 필요 없다');
});

test('★ 첫 줄은 서식이 부르는 말을 따른다 — 명단 차례대로 채우면 안 된다', () => {
  const fn = grabFn('fillSignGrid');
  assert.match(fn, /_siteWrep\(s0\)\.name/, '「근로자대표」 자리는 사업장 근로자대표다');
  assert.match(fn, /String\(s0\.ceo\|\|''\)\.trim\(\)/, '「대표이사」 자리는 회사 대표자다');
});

test('★ 위원이 줄보다 적으면 남는 줄을 지우고, 많으면 늘린다', () => {
  const fn = grabFn('fillSignGrid');
  assert.match(fn, /removeChild\(rm\)/, '남는 날인란이 관청에 가면 안 된다');
  assert.match(fn, /cloneNode\(true\)/, '사람마다 날인을 받아야 한다');
  assert.match(fn, /1\+Math\.max\(L\.length,R\.length\)/, '많은 쪽에 맞춰야 한다');
});

test('★ 아무도 모르면 손대지 않는다', () => {
  assert.match(grabFn('fillSignGrid'), /if\(!hl&&!hr&&!L\.length&&!R\.length\) return 0/);
});

test('위원 명단은 별지 제7호가 보는 그 명단에서 온다 — 한 곳만 본다', () => {
  assert.match(grabFn('fillSignGrid'), /_prepCommittee\(f,side,sites\)/);
});

test('격자 줄에 data-cm 을 달아 라벨 채우기가 덮지 않게 한다', () => {
  assert.match(grabFn('fillSignGrid'), /setAttribute\('data-cm','1'\)/);
});

/* ══════════ ④ 차례 ══════════ */

test('★ 차례 — 말 고치기 → 표로 짜기 → 자리표 채우기 → 걷어내기', () => {
  const h = grabFn('hwpFormHTML');
  const a = h.indexOf('fillWrepLabel(d)');
  const g = h.indexOf('fillSignGrid(d,f,sites)');
  const b = h.indexOf('fillSignTable(d,f,sites)');
  const c = h.indexOf('fillPartyList(d,f,sites)');
  const d = h.indexOf('stripBaked(d)');
  assert.ok(a >= 0 && g >= 0 && b >= 0 && c >= 0 && d >= 0, '다섯 다 불러야 한다');
  assert.ok(a < g, '말을 먼저 고쳐야 격자에도 「근로자대표」로 실린다');
  assert.ok(g < b, '사내 격자를 먼저 채운다 — 공동 표 짜기와 서로 안 걸린다');
  assert.ok(b < c, '표를 나중에 짜면 자리표가 이미 회사 이름이라 서명 줄을 못 알아본다');
  assert.ok(c < d, '걷어내기 뒤에 채우면 자리표가 이미 ＿＿＿ 로 바뀌어 못 찾는다');
});

test('★ 사내 격자 채우기는 정관에서만 돈다', () => {
  assert.match(grabFn('hwpFormHTML'), /if\(kind==='charter'\) fillSignGrid\(d,f,sites\);/);
});

test('★ 정관 머리 손보기는 정관에서만 돈다', () => {
  assert.match(grabFn('hwpFormHTML'), /if\(kind==='charter'\)\{\s*fillCharterHead\(d,f\);/);
});

/* ══════════ ⑤ 검사기에도 실렸는가 ══════════ */

test('★★ jsdom 검사도 새 함수를 실어야 한다 — 없으면 CI 에서만 통째로 죽는다', () => {
  ['check_derived.js', 'check_forms.js'].forEach((f) => {
    const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', f), 'utf8');
    ["gF('_signLabels')", "gF('fillSignTable')", "gF('fillCharterHead')",
      "gS('SIGN_L')", "gS('SIGN_R')", "gS('SIGN_HEAD')", "gS('SIGN_WHO_ONLY_SRC')",
      "gS('CHARTER_TITLE')", "gS('CHARTER_NAME')", "gS('CHARTER_BRANCH')", "gS('CHARTER_DATELINE')",
      "gS('GRID_NAME')", "gS('GRID_TITLE')", "gS('GRID_BLANK')", "gF('_gridCell')", "gF('fillSignGrid')",
    ].forEach((k) => assert.ok(t.indexOf(k) >= 0, f + ' 에 ' + k + ' 가 없다'));
  });
});

test('같은 이름 함수를 두 번 선언하지 않았다', () => {
  ['fillSignTable', 'fillCharterHead', '_signLabels', 'fillSignGrid', '_gridCell'].forEach((n) => {
    const c = (SRC.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있다');
  });
});

/* ══════════ ⑥ 실제로 그려 본다 (jsdom 이 있을 때만) ══════════ */

let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

/* 서식 채우기 전체를 실어야 hwpFormHTML 이 돈다 — 검사기와 같은 목록을 쓴다 */
function boot() {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.window = dom.window; global.document = dom.window.document;
  (0, eval)(fs.readFileSync(path.join(ROOT, 'fund_forms.js'), 'utf8'));
  const gS = (n) => grabLine(n);
  const gF = (n) => grabFn(n);
  const gV = (n) => {
    const i = SRC.indexOf('var ' + n + '=');
    let d = 0;
    for (let k = SRC.indexOf('=', i); k < SRC.length; k++) {
      const c = SRC[k];
      if (c === '{' || c === '[') d++;
      else if (c === '}' || c === ']') { d--; if (!d) return SRC.slice(i, SRC.indexOf(';', k) + 1); }
    }
    throw new Error('상수 끝을 못 찾음: ' + n);
  };
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  global.num = (v) => { if (v === '' || v == null) return ''; const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? n : ''; };
  global.BAKE_BLANK = (SRC.match(/var BAKE_BLANK='([^']*)'/) || [])[1];
  global.S = { fundId: 'X', year: 2026 };
  global.funds = {};
  (0, eval)([gV('OFFICER_ROLES'), gV('FORM_FILL'), gV('BIZ_BS_ROWS'), gV('BUDGET_KEYS'),
    gV('_KOR_D'), gV('_KOR_P'), gV('_KOR_U'),
    gF('_officersOf'), gF('_boss'), gF('_isBlankCell'), gF('_isLabelCell'), gF('_bakeText'),
    gF('_isRateRow'), gF('stripBaked'), gF('korWon'), gF('_docRok'),
    gF('_dotDate'), gF('fillContribDoc'), gF('fillChecklistDoc'), gF('budgetOf'), gF('_hasBudget'),
    gF('_reserveRate'), gF('_bizFinOf'),
    gV('BIZ_SPLIT'), gS('BIZ_RATE_DEFAULT'),
    gF('useRate'), gF('bizRate'), gF('autoBudget'), gF('planBudget'),
    gF('isSetupFund'), gF('_bizFinZero'), gF('fillBizplanHead'),
    gF('bizplanRows'), gF('bizplanBS'), gF('fillBizplanDoc'), gF('fillCommittee'),
    gV('_K'), gF('_siteWrep'), gF('_isCommittee'),
    gF('_siteUrep'), gF('_siteCommittee'), gF('_prepCommittee'),
    (/var COMMITTEE_ROWS=\d+;/.exec(SRC) || [''])[0],
    gF('_cmOver'), gF('_cmAnnexNeeded'), gF('_cmSeeAnnex'), gF('committeeAnnexHTML'),
    gV('_SIDO_ABBR'), gF('_addrParts'), gF('_siteGovs'), gF('_dashPhone'), gF('_prepDirectors'), gF('_bizTotals'),
    gS('PARTY_ONE_SRC'), gS('PARTY_RUN_SRC'),
    gF('estabSites'), gF('siteContribOf'), gF('foundContribOf'), gF('foundContrib'),
    gF('partyNames'), gF('partyJoin'), gF('_fillWho'), gF('fillPartyList'), gF('fillPartyDates'),
    gS('PARTY_WHO_SRC'), gS('FLOW_MIN'), gS('FLOW_KEEP'), gS('FLOW_TAIL'), gF('_flowText'), gF('fillFlowText'),
    gS('DATE_CTX'), gF('_dateSlot'), gV('WREP_LBL'), gF('fillWrepLabel'), gF('_stripSample'),
    gS('MINUTES_AGENDA'), gF('fillMinutesPages'),
    gS('SIGN_L'), gS('SIGN_R'), gS('SIGN_WHO_ONLY_SRC'), gS('SIGN_HEAD'),
    gF('_signLabels'), gF('fillSignTable'),
    gS('CHARTER_TITLE'), gS('CHARTER_NAME'), gS('CHARTER_BRANCH'), gS('CHARTER_DATELINE'),
    gF('fillCharterHead'),
    gS('GRID_NAME'), gS('GRID_TITLE'), gS('GRID_BLANK'), gF('_gridCell'), gF('fillSignGrid'),
    gV('FTYPE_SKIP'), gV('FTYPE_PAIRS'), gV('FTYPE_GONG_ONLY'),
    gF('ftypeSkipDoc'), gS('FTYPE_PICK_SRC'), gF('_ftypeSwap'), gF('_ftypeWords'), gF('_isTypePickBox'), gF('fillFundTypeWords'),
    gF('fillDerived'), gF('fillFoundContribDoc'),
    gF('fillRoster'), gF('fillSubsidyDoc'), gF('hwpFormHTML')].join('\n'));
  return dom;
}

const F = { _id: 'X', name: '가나다공동근로복지기금', fund_type: '공동',
  address: '서울특별시 종로구 세종대로 1길 11', chairman: '홍길동', meeting_date: '2026-03-02' };
const SITES = [
  { name: '가나기계', ceo: '김가나', wrep_name: '박근로', address: '서울특별시 종로구 1길 1', status: 'active' },
  { name: '다라전자', ceo: '이다라', wrep_name: '', address: '경기도 수원시 2로 2', status: 'active' },
];

test('★ 그려 보기 — 정관 표지·제3조·서명표', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('charter', F, SITES);
  const txt = String(d.textContent || '').replace(/\s+/g, ' ');
  assert.ok(txt.indexOf('가나다공동근로복지기금 정관') >= 0, '표지가 기금 이름이어야 한다');
  assert.ok(txt.indexOf('00공동') < 0, '「00」 이 남아 있다');
  assert.ok(txt.indexOf('주된 사무소는 서울특별시 종로구 세종대로 1길 11에 둔다.') >= 0,
    '제3조 소재지 — ' + (txt.match(/제3조.{0,90}/) || [''])[0]);
  assert.ok(txt.indexOf('분사무소') < 0, '제3조 아래 분사무소 줄이 남아 있다');
  assert.ok(txt.indexOf('서울특별시 종로구 1길 1') < 0, '참여회사 주소가 정관에 남아 있다');
  const tb = d.querySelector('table');
  assert.ok(tb, '서명표가 서야 한다');
  const rows = [].map.call(tb.querySelectorAll('tr'),
    (tr) => [].map.call(tr.children, (c) => (c.textContent || '').replace(/\s+/g, ' ').trim()));
  assert.equal(rows.length, 3, '머리 한 줄 + 사업장 두 줄');
  assert.deepEqual(rows[0], ['번호', '각 참여회사 근로자대표', '각 참여회사 대표이사']);
  assert.equal(rows[1][0], '1');
  assert.ok(rows[1][1].indexOf('가나기계 근로자대표') === 0 && rows[1][1].indexOf('박근로') > 0, rows[1][1]);
  assert.ok(rows[1][2].indexOf('김가나') > 0, rows[1][2]);
  assert.equal(rows[2][0], '2');
  assert.ok(/＿{3,}/.test(rows[2][1]), '근로자대표를 모르면 밑줄 — ' + rows[2][1]);
  /* 「년 월 일」 줄이 가운데·넓은 줄간격으로 남아야 한다 */
  const dt = [].filter.call(d.querySelectorAll('p'),
    (p) => /^\s*년\s+월\s+일\s*$/.test(p.textContent || ''))[0];
  assert.ok(dt, '「년 월 일」 줄이 사라졌다');
  assert.match(dt.getAttribute('style') || '', /text-align:center/);
});

test('★ 그려 보기 — 설립합의서는 표가 «본문 뒤»에 선다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('agreement', F, SITES);
  const tb = d.querySelector('table');
  assert.ok(tb, '서명표가 서야 한다');
  const head = String(d.textContent || '').indexOf('설립 합의서');
  const body = String(d.textContent || '').indexOf('가나기계 근로자대표');
  assert.ok(head >= 0 && head < body, '표가 맨 위에 얹히면 안 된다');
  assert.equal(tb.querySelectorAll('tr').length, 3);
  assert.ok(String(d.textContent || '').indexOf('×') < 0, '이름 자리표가 남아 있다');
  assert.ok(String(d.textContent || '').indexOf('○○주식회사') < 0, '회사 자리표가 남아 있다');
});

test('★ 그려 보기 — 사업장이 없으면 원본 그대로 둔다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('agreement', F, []);
  assert.equal(d.querySelector('table'), null, '표를 세우면 안 된다');
  assert.ok(String(d.textContent || '').indexOf('○○주식회사') >= 0, '자리표가 그대로 남아야 한다');
});

/* 사내 정관 — 회사 한 곳, 노사 위원 각 2인(설립합의서가 말하는 「노사 각 2인 동수」) */
const FS = { _id: 'Y', name: '가나기계 사내근로복지기금', fund_type: '사내',
  address: '서울특별시 종로구 세종대로 1길 11', chairman: '홍길동' };
const SSITE = [{ name: '가나기계 주식회사', ceo: '김대표', wrep_name: '박근로',
  urep_same: true, status: 'active' }];

test('★ 그려 보기 — 사내 정관 서명 격자에 이름이 선다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('charter', FS, SSITE);
  const tb = [].filter.call(d.querySelectorAll('table'),
    (x) => /근\s*로\s*자\s*측\s*위\s*원/.test(x.textContent || ''))[0];
  assert.ok(tb, '사내 정관 서명 격자를 못 찾았다');
  const rows = [].map.call(tb.querySelectorAll('tr'),
    (tr) => [].map.call(tr.children, (c) => (c.textContent || '').replace(/\s+/g, ' ').trim()));
  assert.equal(rows.length, 2, '머리줄 + 위원 한 줄 (남는 자리표 줄은 지운다) — ' + JSON.stringify(rows));
  assert.ok(rows[1][0].indexOf('박근로') >= 0, rows[1][0]);
  assert.ok(rows[1][1].indexOf('김대표') >= 0, rows[1][1]);
  const txt = String(d.textContent || '');
  assert.ok(!/○\s*○\s*○/.test(txt), '이름 자리표가 남아 있다');
  assert.ok(!/□\s*□\s*□/.test(txt), '직책 자리표가 남아 있다');
});

test('★ 그려 보기 — 위원이 많으면 줄이 늘어난다 (날인은 사람마다)', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const f2 = Object.assign({}, FS, { officers: [
    { name: '최근로', role: '근로자측 이사', title: '생산부장' },
    { name: '윤근로', role: '근로자측 이사', title: '기술부장' },
    { name: '이사측', role: '사용자측 이사', title: '관리부장' },
  ] });
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('charter', f2, SSITE);
  const tb = [].filter.call(d.querySelectorAll('table'),
    (x) => /근\s*로\s*자\s*측\s*위\s*원/.test(x.textContent || ''))[0];
  const rows = [].map.call(tb.querySelectorAll('tr'),
    (tr) => [].map.call(tr.children, (c) => (c.textContent || '').replace(/\s+/g, ' ').trim()));
  assert.equal(rows.length, 4, '머리줄 + 근로자측 세 명 — ' + JSON.stringify(rows));
  const all = rows.join(' ');
  ['박근로', '최근로', '윤근로', '김대표', '이사측'].forEach((n) =>
    assert.ok(all.indexOf(n) >= 0, n + ' 이 격자에 없다'));
  assert.ok(all.indexOf('생산부장') >= 0, '직책도 적어야 한다');
  /* 한쪽만 아는 줄은 그쪽만 적고 반대쪽은 밑줄 — 이름을 지어내지 않는다 */
  assert.ok(/＿{3,}/.test(rows[3][1]), '사용자측이 모자란 줄은 밑줄이어야 한다 — ' + rows[3][1]);
});

test('★ 그려 보기 — 사내 정관도 사업장·명부가 비면 원본 그대로 둔다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('charter', FS, []);
  assert.ok(/○\s*○\s*○/.test(String(d.textContent || '')), '자리표가 그대로 남아야 한다');
});

test('★ 그려 보기 — 별지 제7호 위원 격자에 노사 양쪽 이름이 선다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음 (npm i jsdom --no-save)');
  const dom = boot();
  const same = SITES.map((s) => Object.assign({}, s, { urep_same: true, wrep_name: s.wrep_name || '최근로' }));
  const d = dom.window.document.createElement('div');
  d.innerHTML = hwpFormHTML('inka', F, same);
  const txt = String(d.textContent || '').replace(/\s+/g, ' ');
  ['박근로', '최근로', '김가나', '이다라'].forEach((n) => {
    assert.ok(txt.indexOf(n) >= 0, '별지7호 위원 격자에 ' + n + ' 이 없다');
  });
  assert.ok(txt.indexOf('가나다공동근로복지기금') >= 0, '기금 명칭이 없다');
  assert.ok(txt.indexOf('서울특별시 종로구 세종대로 1길 11') >= 0, '주사무소 소재지가 없다');
});
