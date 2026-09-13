'use strict';
/* 참여 지자체 — 사업장 주소에서 셈한다 (대표 지시 2026-09-13)
 *
 *   「지역기금은 각기업들의 지자체가 같이 참여한다 … 기업들 주소를 검토하면
 *    기업주소가 있는 지자체가 같이 참여한 것이다. 이부분 확인하고 정보에 모두 표시해서 넣어달라」
 *
 * ★ 손으로 적는 칸을 두지 «않는다» — 사업장이 들고 나면 지자체도 함께 달라지는데,
 *   적어 두면 둘이 어긋난 채 굳는다. 그때그때 주소에서 센다.
 * ⚠ 못 읽은 주소를 «조용히 빼지 않는다» — 열여섯 곳 중 셋을 못 읽었으면 그렇다고 말해야 한다.
 *   조용히 빼면 「우리 기금은 세 지자체」라고 잘못 읽는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function load(parts) { const box = {}; new Function(parts.join('\n')).call(box); return box; }

const GOV = () => load([grabDecl('_SIDO_ABBR'), grabFn('_addrParts'), grabFn('_siteGovs'),
  'this.f=_siteGovs;']).f;

/* 실제 화면(충남 1호)의 주소 모양을 그대로 쓴다 — 상호는 가짜다 */
const 사업장 = [
  { name: '가나전자', address: '충남 예산군 응봉면 예당로 1703-38' },
  { name: '나다화학', address: '충남 예산군 삽교읍 산단2길 53' },
  { name: '다라정밀', address: '충남 예산군 고덕면 예당산단4길 80' },
  { name: '라마기계', address: '충남 공주시 정안면 정안농공단지길 32-32' },
  { name: '마바산업', address: '충남 공주시 신풍면 충의로 2466-38' },
  { name: '바사레미콘', address: '충남 보령시 오천면 교성리 산 221-46' },
];

test('① 같은 지자체끼리 묶어 센다', () => {
  const g = GOV()(사업장);
  assert.deepEqual(g.list.map((x) => x.sgg), ['예산군', '공주시', '보령시']);
  assert.deepEqual(g.list.map((x) => x.n), [3, 2, 1]);
  assert.equal(g.total, 6);
  assert.equal(g.unknown, 0);
});

/* ★★ 차례는 «명부 차례»다 — 대표 확인 2026-09-13:
     「예를 들어 1호기금은 예산군 공주시 보령시 참여이다. 이부분 확인하면 된다.」
   처음에는 «곳 수가 많은 순»으로 냈다. 그러면 충남 1호가 예산군7·보령시6·공주시3 이 되어
   대표님이 명부를 보고 부르는 차례와 어긋난다. 서류를 명부와 맞대 보는 사람이 바로
   짚을 수 있어야 하므로 연번을 따른다.
   ⚠ 아래 자료는 «곳 수 차례와 명부 차례가 다르게» 짰다 — 같으면 이 검사가 헛돈다. */
test('★★ ①-2 차례는 «명부(연번) 차례»다 — 곳 수가 많은 순이 아니다', () => {
  const 충남1호 = [
    { name: 'ㄱ', seq_label: '1-1', address: '충남 예산군 응봉면 1' },
    { name: 'ㄴ', seq_label: '1-2', address: '충남 예산군 삽교읍 2' },
    { name: 'ㄷ', seq_label: '1-3', address: '충남 예산군 고덕면 3' },
    { name: 'ㄹ', seq_label: '1-4', address: '충남 공주시 정안면 4' },
    { name: 'ㅁ', seq_label: '1-5', address: '충남 보령시 청소면 5' },
    { name: 'ㅂ', seq_label: '1-6', address: '충남 보령시 오천면 6' },
    { name: 'ㅅ', seq_label: '1-7', address: '충남 보령시 주교면 7' },
    { name: 'ㅇ', seq_label: '1-8', address: '충남 보령시 웅천읍 8' },
  ];
  const g = GOV()(충남1호);
  assert.deepEqual(g.list.map((x) => x.sgg), ['예산군', '공주시', '보령시'],
    '★ 명부 차례가 아닙니다 — 곳 수 순이면 보령시(4)가 예산군(3)보다 앞에 옵니다.');
  assert.deepEqual(g.list.map((x) => x.n), [3, 1, 4], '곳 수는 그대로 세야 합니다.');
});

test('★ ①-3 연번이 뒤죽박죽 들어와도 «연번 차례»로 센다 — 부르는 쪽 순서에 기대지 않는다', () => {
  const 뒤섞 = [
    { name: 'ㅁ', seq_label: '1-5', address: '충남 보령시 1' },
    { name: 'ㄱ', seq_label: '1-1', address: '충남 예산군 2' },
    { name: 'ㄹ', seq_label: '1-4', address: '충남 공주시 3' },
  ];
  assert.deepEqual(GOV()(뒤섞).list.map((x) => x.sgg), ['예산군', '공주시', '보령시']);
});

test('② 어느 회사가 그 지자체에 있는지 들고 있다 — 딱지에 올려 보여 준다', () => {
  const g = GOV()(사업장);
  const 예산 = g.list.find((x) => x.sgg === '예산군');
  assert.deepEqual(예산.sites, ['가나전자', '나다화학', '다라정밀']);
});

test('★★ ③ 주소를 못 읽은 곳을 «조용히 빼지 않는다» — 세어서 드러낸다', () => {
  const g = GOV()(사업장.concat([{ name: '사아상사', address: '' },
    { name: '자차공업', address: '어디인지 모를 주소' }]));
  assert.equal(g.unknown, 2, '★ 못 읽은 곳을 그냥 버렸습니다 — 지자체 수를 잘못 읽게 됩니다.');
  assert.equal(g.total, 8, '전체 수는 못 읽은 곳까지 셉니다.');
  assert.equal(g.list.reduce((a, b) => a + b.n, 0), 6);
});

test('★ ④ 탈퇴한 사업장은 «참여 지자체가 아니다»', () => {
  const g = GOV()(사업장.concat([{ name: '나간회사', address: '경기 화성시 어딘가로 1', status: 'closed' }]));
  assert.equal(g.list.length, 3, '★ 나간 회사의 지자체가 참여 중으로 남았습니다.');
  assert.deepEqual(g.sidos, ['충남']);
  assert.equal(g.total, 6);
});

test('★ ⑤ 정식 표기(충청남도)와 줄임(충남)을 «같은 곳»으로 본다', () => {
  const g = GOV()([{ name: 'ㄱ', address: '충청남도 아산시 음봉면 산동로 246-61' },
                   { name: 'ㄴ', address: '충남 아산시 둔포면 아산밸리로 1' }]);
  assert.equal(g.list.length, 1, '★ 같은 아산시가 둘로 갈렸습니다.');
  assert.equal(g.list[0].n, 2);
  assert.equal(g.list[0].sido, '충남');
});

test('★ ⑥ 시·도가 두 번 든 주소를 견딘다 — 실데이터의 13%가 그 꼴이었다', () => {
  const g = GOV()([{ name: 'ㄱ', address: '충남 충남 논산시 어딘가로 1' }]);
  assert.equal(g.list.length, 1);
  assert.equal(g.list[0].sgg, '논산시');
});

test('⑦ 여러 시·도에 걸치면 시·도를 모두 돌려준다', () => {
  const g = GOV()(사업장.concat([{ name: '경기회사', address: '경기 화성시 동탄대로 1' }]));
  assert.deepEqual(g.sidos.sort(), ['경기', '충남']);
});

test('⑧ 사업장이 없으면 0 — 지어내지 않는다', () => {
  const g = GOV()([]);
  assert.deepEqual(g.list, []);
  assert.equal(g.total, 0);
  assert.equal(g.unknown, 0);
});

/* ══ ★★ 화면을 «정말 그려» 본다 ═════════════════════════════════════ */

function chips() {
  return load([grabDecl('_SIDO_ABBR'), grabFn('_addrParts'), grabFn('_siteGovs'),
    'function esc(s){ return String(s==null?"":s); }',
    grabFn('govChips'), 'this.f=govChips;']).f;
}

test('★★ ⑨ 딱지에 지자체 이름과 «몇 곳»이 함께 선다', () => {
  const h = chips()(사업장);
  ['예산군 3', '공주시 2', '보령시 1'].forEach((t) => {
    assert.ok(h.indexOf(t) >= 0, '딱지가 없습니다: ' + t);
  });
  assert.ok(h.indexOf('가나전자') >= 0, '어느 회사인지 올림말에 없습니다.');
});

test('★★ ⑩ 못 읽은 주소가 있으면 «빨간 딱지»로 말한다', () => {
  const h = chips()(사업장.concat([{ name: 'ㅁ', address: '' }]));
  assert.ok(/주소 모름 1/.test(h), '★ 못 읽은 곳을 화면에서 숨겼습니다.');
  assert.ok(/chip dg/.test(h), '눈에 띄지 않는 딱지를 썼습니다.');
});

test('⑪ 사업장이 없으면 «0곳»이라 하지 않고 없다고 말한다', () => {
  const h = chips()([]);
  assert.ok(h.indexOf('참여사업장이 아직 없습니다') >= 0, h.slice(0, 120));
});

test('★ ⑫ 한 시·도뿐이면 시·도 딱지를 «안» 붙인다 — 늘 붙으면 눈이 지나친다', () => {
  assert.ok(!/chip warn/.test(chips()(사업장)));
  assert.ok(/chip warn/.test(chips()(사업장.concat([{ name: 'ㄱ', address: '경기 화성시 동탄대로 1' }]))));
});

/* ══ ★★ 배선 — 화면 두 곳이 «같은 셈»을 쓰는가 ══════════════════════ */

test('★★ ⑬ 기금 정보와 참여사업장이 같은 셈을 쓴다 — 따로 짜면 두 숫자가 갈린다', () => {
  assert.match(grabFn('govField'), /govChips\(/, '기금 정보가 딱지를 안 씁니다.');
  assert.match(grabFn('sitesTab'), /_siteGovs\(arr\)/, '참여사업장 머리에 지자체 수가 없습니다.');
});

/* ★★ 대표 지시 2026-09-13 「참여지자체를 지역 옆에 넣어라 하나씩」 —
   처음에는 맨 아래에 따로 두었더니 화면을 끝까지 내려야 보였다. 지역과 나란히 있어야
   「충남의 어느 시·군이 함께 들어왔나」가 한눈에 읽힌다. */
test('★★ ⑬-2 참여 지자체가 «지역 바로 옆»에 붙는다 — 맨 아래면 안 보인다', () => {
  const fn = grabFn('infoForm');
  assert.match(fn, /c\[0\]==='region'\?govField\(f\):''/,
    '★ 「지역」 칸 옆이 아닙니다 — 화면을 끝까지 내려야 보입니다.');
  /* 칸 묶음(gridw) «안»에 있어야 나란히 선다 — 밖에 두면 줄이 갈린다 */
  const g = fn.indexOf('govField(f)'), grid = fn.indexOf('gridw');
  assert.ok(g >= 0 && grid >= 0 && g < grid,
    '★ 칸 묶음 밖에 있습니다 — 지역과 나란히 안 섭니다.');
});

test('★★ ⑬-3 고칠 수 있는 «칸»으로 보이지 않는다 — 셈한 값이라 손으로 못 고친다', () => {
  const fn = grabFn('govField');
  assert.ok(!/<input/.test(fn) && !/<select/.test(fn),
    '★ 입력칸을 두었습니다 — 고칠 수 있는 줄 알고 쳐 넣으면 사업장과 어긋납니다.');
  assert.match(fn, /사업장 소재지에서 셈/, '어디서 온 값인지 말해 주지 않습니다.');
});

test('★★ ⑭ 참여사업장을 «아직 안 읽었을 때» 0곳이라 하지 않는다 — 모르는 것과 없는 것은 다르다', () => {
  const fn = grabFn('govField');
  assert.match(fn, /S\.sitesFor===S\.fundId && S\.sites/, '읽었는지를 안 봅니다.');
  assert.match(fn, /탭을 한 번 열면/, '★ 안 읽었는데 「없다」고 말합니다.');
});

test('★★ ⑮ 손으로 적는 칸을 만들지 않았다 — 적어 두면 사업장과 어긋난 채 굳는다', () => {
  assert.ok(SRC.indexOf("'gov_join'") < 0 && SRC.indexOf("'govs'") < 0,
    '★ 지자체를 저장하는 칸이 생겼습니다 — 사업장이 바뀌면 둘이 어긋납니다.');
  assert.ok(!/id="fd-gov/.test(SRC), '★ 기금 정보에 지자체 입력칸이 생겼습니다.');
});

test('⑯ 새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(SRC.includes("hlp('gov.join')"), '쓰는 곳이 없는 도움말입니다');
  assert.ok(help.includes("'gov.join':{"), '등록되지 않은 도움말 열쇠입니다');
  /* ★ 2026-09-13 대표 지시 「지자체도 서식 자동 들어가게」 — 하루 전 규칙을 뒤집었다.
     ⚠ 그래도 «관할»(세무서·등기소·노동청)은 다르다고 적어 두어야 한다. 참여 지자체와
       관할은 다른 것인데, 하나가 자동으로 들어가면 다른 것도 그런 줄 안다. */
  const 내것 = help.slice(help.indexOf("'gov.join':{"));
  assert.ok(내것.indexOf('서식에도 들어갑니다') >= 0, '어느 서식에 들어가는지 말해 주지 않습니다.');
  assert.ok(내것.indexOf('관할') >= 0 && 내것.indexOf('다릅니다') >= 0,
    '★ 관할은 다르다는 말이 없습니다 — 사람이 관할까지 자동인 줄 알고 확인을 건너뜁니다.');
});

/* ══ ★★ 서식에 «정말» 들어가는가 ═══════════════════════════════════
   대표 지시 2026-09-13 「지자체도 서식 자동 들어가게」.
   ⚠ 서식에 지자체를 묻는 자리는 «둘뿐»이다 — 정관·사내정관의 「국가, 지방자치단체가
     발행하는 유가증권」은 법조문이라 채우는 자리가 아니다(찾아서 확인했다). */

test('★★ ⑰ 지원사업 체크리스트의 「지역」에 시·군까지 들어간다', () => {
  const fn = grabFn('fillChecklistDoc');
  assert.match(fn, /_siteGovs\(act\)/, '★ 지역 칸이 아직 시·도만 적습니다.');
  assert.match(fn, /f\.region/, '시·도를 빼면 안 됩니다 — 「예산군」만으로는 어디인지 모릅니다.');
});

test('★★ ⑱ 주소를 못 읽은 곳이 있으면 체크리스트에는 «시·도만» — 반쪽을 전부인 양 내지 않는다', () => {
  const b = load([grabDecl('_SIDO_ABBR'), grabFn('_addrParts'), grabFn('_siteGovs'),
    /* 서식 채우기에서 「지역」을 셈하는 그 식만 떼어 와 돌린다 */
    'function 지역(f,act){ var sd=f.region||"", g=_siteGovs(act);' +
    ' if(!g.list.length||g.unknown) return sd;' +
    ' var 군=g.list.map(function(x){ return x.sgg; }).join("·");' +
    ' return sd?(sd+" "+군):군; }',
    'this.f=지역;']);
  /* 예산군 둘·공주시 하나 — 많은 곳부터 적히는지도 함께 본다(같은 수면 이름순) */
  const 온전 = [{ name: 'ㄱ', address: '충남 예산군 응봉면 1' }, { name: 'ㄴ', address: '충남 공주시 1' },
                { name: 'ㄷ', address: '충남 예산군 삽교읍 2' }];
  assert.equal(b.f({ region: '충남' }, 온전), '충남 예산군·공주시');
  const 모름 = 온전.concat([{ name: 'ㄷ', address: '' }]);
  assert.equal(b.f({ region: '충남' }, 모름), '충남',
    '★ 못 읽은 곳이 있는데 시·군 목록을 전부인 양 냈습니다.');
  /* 소스의 식과 여기 식이 «같은지» — 다르면 이 검사가 헛돕니다 */
  assert.match(grabFn('fillChecklistDoc'), /if\(!g\.list\.length\|\|g\.unknown\) return sd;/,
    '★ 서식 쪽 식이 달라졌습니다 — 이 검사가 딴 것을 재고 있습니다.');
});

test('★★ ⑲ 설립합의서 별첨 명부에 지자체 열이 선다', () => {
  const b = load([
    'function esc(s){ return String(s==null?"":s); }',
    'function dgV(v,n){ return v ? String(v) : "＿＿＿＿"; }',
    'function dgWon(n){ return String(n||0); }',
    'function dgToday(){ return "2026. 9. 13."; }',
    'function foundContrib(){ return 10000000; }',
    'function _officersOf(){ return []; }',
    'function hwpFormHTML(){ return ""; }',
    grabDecl('_SIDO_ABBR'), grabFn('_addrParts'),
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('docBody'), 'this.f=docBody;']);
  const html = b.f('agreement', { name: '가나공동근로복지기금', fund_type: '공동' },
    [{ name: '가나전자', ceo: '김대표', biz_no: '111-11-11111', address: '충남 예산군 응봉면 1' }]);
  assert.ok(html.indexOf('<th>지자체</th>') >= 0, '★ 지자체 열이 없습니다.');
  assert.ok(html.indexOf('충남 예산군') >= 0, '★ 지자체가 안 찍혔습니다.');
});

test('★★ ⑳ 주소가 없으면 별첨 명부의 지자체는 «밑줄»로 남는다 — 지어내지 않는다', () => {
  const b = load([
    'function esc(s){ return String(s==null?"":s); }',
    'function dgV(v,n){ return v ? String(v) : "＿＿＿＿"; }',
    'function dgWon(n){ return String(n||0); }',
    'function dgToday(){ return "2026. 9. 13."; }',
    'function foundContrib(){ return 10000000; }',
    'function _officersOf(){ return []; }',
    'function hwpFormHTML(){ return ""; }',
    grabDecl('_SIDO_ABBR'), grabFn('_addrParts'),
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('docBody'), 'this.f=docBody;']);
  const html = b.f('agreement', { name: '가나공동근로복지기금', fund_type: '공동' },
    [{ name: '가나전자', ceo: '김대표', biz_no: '111-11-11111' }]);
  assert.ok(html.indexOf('＿＿＿＿') >= 0, '빈 지자체 자리가 밑줄로 안 남았습니다.');
});

/* ══ 목록의 지자체 열 ═══════════════════════════════════════════════ */

const SHORT = () => load([grabDecl('_SIDO_ABBR'), grabFn('_addrParts'), grabFn('_siteGovs'),
  grabFn('govShort'), 'this.f=govShort;']).f;

/* ★★ 대표 지시 2026-09-13 「외 1 이렇게 하지 말고 모든 지자체 이름 바로 넣어라」 —
   처음에는 둘까지만 적고 줄였다. 그러면 어느 지자체가 빠졌는지 목록에서 알 수가 없어
   올림말을 열어 봐야 했다 — 한눈에 보려고 만든 칸인데 뜻이 없다. */
test('★★ ㉑ 목록 칸에 지자체 이름을 «다» 적는다 — 「외 n」으로 줄이지 않는다', () => {
  const r = SHORT()(사업장);
  assert.equal(r.text, '예산군·공주시·보령시');
  assert.ok(r.text.indexOf('외 ') < 0, '★ 아직 「외 n」으로 줄입니다: ' + r.text);
  /* 곳 수는 올림말에 — 칸에 적으면 폭이 두 배가 된다 */
  assert.ok(r.title.indexOf('예산군 3') >= 0 && r.title.indexOf('보령시 1') >= 0, r.title);
});

test('★ ㉑-2 지자체가 많아도 «다» 적는다 — 몇 곳이든 줄이지 않는다', () => {
  const 많이 = ['예산군', '공주시', '보령시', '아산시', '천안시', '서산시'].map((s, i) => (
    { name: '회사' + i, seq_label: '1-' + (i + 1), address: '충남 ' + s + ' 어딘가로 ' + i }));
  const r = SHORT()(많이);
  assert.equal(r.n, 6);
  assert.equal(r.text, '예산군·공주시·보령시·아산시·천안시·서산시');
});

test('★★ ㉑-3 칸이 좁으면 «접어서» 보인다 — 말줄임으로 자르면 「외 n」과 다를 것이 없다', () => {
  const row = grabFn('fundRow');
  assert.ok(row.indexOf('text-overflow:ellipsis') < 0 || row.indexOf('참여 지자체') < 0,
    '★ 지자체 칸을 말줄임으로 잘랐습니다 — 이름을 다 적기로 한 뜻이 사라집니다.');
  assert.match(row, /word-break:keep-all/,
    '★ 한국말을 낱말째 접지 않습니다 — 「예산군」이 「예산 / 군」으로 쪼개집니다.');
});

test('㉒ 사업장이 없으면 «—», 주소를 다 못 읽으면 그렇다고 적는다', () => {
  assert.equal(SHORT()([]).text, '—');
  assert.equal(SHORT()([{ name: 'ㄱ', address: '' }]).text, '주소 모름');
});

test('★★ ㉓ 목록이 사업장을 «한 번만» 읽는다 — 기금마다 읽으면 마흔세 번 오간다', () => {
  const fn = grabFn('loadAllSites');
  assert.match(fn, /_allSitesTried/, '★ 못 읽었을 때 매번 다시 매답니다 — 그릴 때마다 통신이 나갑니다.');
  assert.match(fn, /NS\+'\/sites'/, '전체를 한 번에 읽지 않습니다.');
  const cell = grabFn('fundGovCell');
  assert.match(cell, /if\(!_allSites\)/, '★ 다 읽기 전에 0곳이라 말합니다.');
  assert.match(cell, /…/, '읽는 중임을 보여 주지 않습니다.');
});

/* ★★★ 2026-09-13 실사고 — 읽고 나서 «다시 그리지» 않아 화면이 점 셋(…)에 영영 멈췄다.
   render() 를 불렀는데 «그런 함수가 없었다». catch 가 그 오류를 삼켜 아무 말도 없었다.
   목록을 그리는 것은 renderHome 이다. */
test('★★★ ㉓-2 읽고 나서 «정말 있는» 함수로 다시 그린다 — 없는 이름을 부르면 점 셋에 멈춘다', () => {
  /* ⚠ 주석을 «먼저 걷는다» — 이 함수는 주석에 「처음에 render() 를 불렀는데」라고 적어
     두었고, 그냥 훑으면 그 글에 걸려 있지도 않은 잘못을 잡는다(2026-09-13 에 실제로 그랬다).
     저장소 규칙이기도 하다: 소스를 글자로 보는 검사는 주석을 먼저 걷는다. */
  const fn = grabFn('loadAllSites')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const 부르는것 = [...fn.matchAll(/\b(render[A-Za-z]*)\s*\(/g)].map((m) => m[1]);
  assert.ok(부르는것.length, '★ 다시 그리지 않습니다 — 화면이 「…」에 멈춥니다.');
  부르는것.forEach((n) => {
    assert.ok(SRC.indexOf('function ' + n + '(') >= 0,
      '★ fund.html 에 없는 함수를 부릅니다: ' + n + '() — 조용히 죽고 화면은 「…」입니다.');
  });
  assert.match(fn, /typeof renderHome==='function'/, '있는지 보고 부르지 않습니다.');
});

test('★★ ㉓-3 못 읽으면 «다음에 한 번 더» 매단다 — 한 번 실패로 영영 점 셋이면 안 된다', () => {
  const fn = grabFn('loadAllSites');
  assert.match(fn, /catch\(function\(e\)\{[\s\S]*_allSitesTried=false/,
    '★ 한 번 실패하면 다시 안 읽습니다 — 화면이 영영 「…」입니다.');
  assert.ok(!/catch\(function\(\)\{\}\)/.test(fn),
    '★ 오류를 통째로 삼킵니다 — 이번 같은 일이 또 조용히 지나갑니다.');
  assert.match(fn, /if\(!fbDb\) return;/, '파이어베이스가 안 붙었을 때 헛돕니다.');
});

test('★★ ㉓-4 「정보 채우기」 표에도 참여 지자체가 «기금명 오른쪽»에 선다', () => {
  /* ⚠ 주석을 먼저 걷는다 — 바로 위 주석이 「참여 지자체」를 말하고 있어,
     그냥 훑으면 그 글이 <th>기금명</th> 보다 앞에 있다고 잡힌다(2026-09-13). */
  const t = grabFn('fundTable')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  const edit = t.slice(0, t.indexOf("if(mode==='trash')"));
  assert.ok(edit.indexOf('참여 지자체') >= 0, '★ 정보 채우기 표에 칸이 없습니다.');
  assert.ok(edit.indexOf('<th>기금명</th>') < edit.indexOf('참여 지자체'),
    '★ 기금명 오른쪽이 아닙니다.');
  const row = grabFn('fundEditRow');
  assert.match(row, /fundGovCell\(f\._id\)/, '줄에 값이 안 들어갔습니다.');
  /* 머리와 몸통 칸 수가 맞는가 — 어긋나면 값이 옆으로 밀린다 */
  assert.ok(row.indexOf("<td class=\"ph\"") >= 0, '몸통에 그 칸이 없습니다.');
});

test('★★ ㉔ 목록 열이 «기금명 바로 오른쪽»이고 폭이 못 박혀 있다 — 묶음마다 표가 따로다', () => {
  const fn = grabFn('fundTable');
  const i = fn.indexOf("['기금명','','']"), j = fn.indexOf("'참여 지자체'");
  assert.ok(i >= 0 && j > i, '★ 참여 지자체가 기금명 오른쪽에 없습니다.');
  assert.ok(fn.indexOf("['주담당','','132px']") > j, '★ 주담당보다 뒤에 있습니다.');
  assert.match(fn, /'참여 지자체','ph','\d+px'/, '★ 폭이 없습니다 — 충남 표와 경기 표의 열이 어긋납니다.');
  assert.match(grabFn('fundRow'), /fundGovCell\(f\._id\)/, '줄에 칸이 안 들어갔습니다.');
});
