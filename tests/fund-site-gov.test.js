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

test('① 같은 지자체끼리 묶어 세고, 많은 곳부터 내놓는다', () => {
  const g = GOV()(사업장);
  assert.deepEqual(g.list.map((x) => x.sgg), ['예산군', '공주시', '보령시']);
  assert.deepEqual(g.list.map((x) => x.n), [3, 2, 1]);
  assert.equal(g.total, 6);
  assert.equal(g.unknown, 0);
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
  assert.match(grabFn('govPanel'), /govChips\(/, '기금 정보가 딱지를 안 씁니다.');
  assert.match(grabFn('infoForm'), /govPanel\(f\)/, '★ 기금 정보에 참여 지자체 줄이 안 붙었습니다.');
  assert.match(grabFn('sitesTab'), /_siteGovs\(arr\)/, '참여사업장 머리에 지자체 수가 없습니다.');
});

test('★★ ⑭ 참여사업장을 «아직 안 읽었을 때» 0곳이라 하지 않는다 — 모르는 것과 없는 것은 다르다', () => {
  const fn = grabFn('govPanel');
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
  /* ⚠ 서식에 자동으로 찍지 않는다고 «적어 두었는가» — 관할은 원본 서류를 봐야 한다 */
  assert.ok(help.slice(help.indexOf("'gov.join':{")).indexOf('서식에 자동으로 찍지 않습니다') >= 0,
    '★ 서식에 안 들어간다는 말이 없습니다 — 사람이 그런 줄 알고 관할을 안 확인합니다.');
});
