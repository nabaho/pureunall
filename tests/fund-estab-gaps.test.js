/* 다섯 단계 묶음 + 「빈칸이 왜 비는가」
 *
 * 대표 지시 2026-09-19:
 *   「설립인가신청서 부터 기금정보와 참여사업장등을 모두 찾아 내용을 직접 넣어서 볼 수 있게 해라.
 *     … 인가 법인설립 고유번호증 운영 근복지원금등 필요서류에 내용 넣어라 확인할 수 있게」
 *
 * 화면은 「채울 자리 34곳」만 말할 뿐, 그것이 ①우리가 안 이어서인지 ②아직 안 적으셔서인지
 * 가려 주지 않았다. 이제 «자료 쪽»을 세어 무엇을 어디에 적으면 어느 서식이 따라오는지 말한다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름·번호는 전부 가짜다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

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

const API = (() => {
  const box = {};
  new Function([
    'function num(v){if(v===""||v==null)return "";var n=Number(String(v).replace(/,/g,""));return isFinite(n)?n:"";}',
    'function esc(s){ return String(s==null?"":s); }',
    grabFn('_officersOf'), grabFn('_siteWrep'),
    /* 2026-09-19: 출연금은 그 해 기록(연도별)까지 본다 — 그 길도 실어야 빈칸 표가 돈다.
       여기 없으면 「siteContribNow is not defined」로 이 검사가 통째로 죽는다.
       장부는 이 검사에서 안 읽으므로 _docRok 은 늘 null 을 돌려준다(약정액으로 내려간다). */
    'function _docRok(){ return null; }',
    grabFn('estabSites'), grabFn('siteContribOf'), grabFn('siteContribNow'),
    grabDecl('ESTAB_NEED'), grabDecl('ESTAB_NEED_SITE'),
    grabFn('estabGaps'), grabFn('estabGapHTML'),
    'this.gaps=estabGaps; this.html=estabGapHTML;',
  ].join('\n')).call(box);
  return box;
})();

/* 자료가 «다 있는» 기금 — 이 기금에서는 빈 곳이 없어야 한다 */
const FULL = {
  name: '가나공동근로복지기금', fund_type: '공동', chairman: '홍길동', rep_position: '이사장',
  address: '충남 어느시 어느로 1', phone: '041-000-0000',
  inka_no: '0000-0000-0', inka_date: '2026-01-02', corp_reg_no: '000000-0000000',
  tax_id_no: '000-00-00000', registry_office: '어느지방법원 등기소', labor_office: '어느지방고용노동청',
  meeting_date: '2026-01-05', lease_lessor: '어느빌딩',
  officers: [{ role: '이사장', name: '홍길동' }],
};
const FULLSITES = [
  { name: '가나기계', ceo: '김가나', wrep_name: '박근로', contrib: 6000000,
    biz_no: '123-45-67890', address: '어느시 어느로 2', status: 'active' },
];

test('자료가 다 있으면 빈 곳이 없다', () => {
  assert.deepEqual(API.gaps(FULL, FULLSITES), []);
});

test('★ 자료가 다 있으면 화면이 «다 채워졌다»고 말한다', () => {
  const h = API.html(FULL, FULLSITES);
  assert.match(h, /msg ok/);
  assert.match(h, /모두 채워져 있습니다/);
});

/* ══════════ 기금 쪽 ══════════ */

test('★ 비어 있는 기금 칸을 집어낸다 — «어디에 적는지»와 «어느 서식이 읽는지»까지', () => {
  const f = Object.assign({}, FULL, { chairman: '', labor_office: '' });
  const g = API.gaps(f, FULLSITES);
  const k = g.map((x) => x.k);
  assert.deepEqual(k.sort(), ['chairman', 'labor_office']);
  const c = g.filter((x) => x.k === 'chairman')[0];
  assert.equal(c.label, '대표자 성명');
  assert.match(c.where, /기금 정보/, '어디에 적는지 안 알려 준다');
  assert.match(c.docs, /별지7호/, '어느 서식이 읽는지 안 알려 준다');
});

test('임원 명부가 비면 집어낸다 — 취임승낙서·등기·인감이 읽는다', () => {
  const g = API.gaps(Object.assign({}, FULL, { officers: [] }), FULLSITES);
  const o = g.filter((x) => x.k === 'officers')[0];
  assert.ok(o, '임원 명부가 비었는데 말하지 않는다');
  assert.match(o.docs, /취임승낙서/);
});

test('공백만 친 칸도 «비었다»고 본다 — 눈에는 안 보인다', () => {
  const g = API.gaps(Object.assign({}, FULL, { chairman: '   ' }), FULLSITES);
  assert.ok(g.some((x) => x.k === 'chairman'));
});

/* ══════════ 참여사업장 쪽 ══════════ */

test('★★ 참여사업장은 «몇 곳이» 비었는지 센다 — 한 곳만 비어도 그 회사 서류가 빈다', () => {
  const sites = [
    { name: '가나기계', ceo: '김가나', wrep_name: '박근로', contrib: 6000000, biz_no: '1', address: 'ㄱ', status: 'active' },
    { name: '다라전자', ceo: '이다라', contrib: 4000000, biz_no: '2', address: 'ㄴ', status: 'active' },
    { name: '마바산업', contrib: 3000000, biz_no: '3', address: 'ㄷ', status: 'active' },
  ];
  const g = API.gaps(FULL, sites);
  const w = g.filter((x) => x.k === 'wrep_name')[0];
  assert.ok(w, '근로자대표가 빈 곳을 안 센다');
  assert.equal(w.n, 2, '두 곳이 비었는데 ' + w.n + ' 로 셌다');
  assert.equal(w.of, 3);
  assert.equal(w.site, true);
  const c = g.filter((x) => x.k === 'ceo')[0];
  assert.equal(c.n, 1, '대표자가 빈 곳은 한 곳이다');
});

test('★ 탈퇴한 사업장은 세지 않는다 — 나간 회사는 설립 서류에 안 선다', () => {
  const sites = FULLSITES.concat([{ name: '닫은곳', status: 'closed' }]);
  assert.deepEqual(API.gaps(FULL, sites), []);
});

test('★ 출연 약정액은 1인당 단가로도 셈한다 — 적어 두지 않아도 셀 수 있으면 «있는» 것이다', () => {
  const sites = [{ name: '가나기계', ceo: '김', wrep_name: '박', company_size: 10,
    biz_no: '1', address: 'ㄱ', status: 'active' }];
  assert.ok(API.gaps(FULL, sites).some((x) => x.k === 'contrib'), '단가가 없으면 비어야 한다');
  const f2 = Object.assign({}, FULL, { contrib_per_worker: 100000 });
  assert.ok(!API.gaps(f2, sites).some((x) => x.k === 'contrib'), '사람수 × 단가로 셀 수 있으면 «있는» 것이다');
});

test('★★ 참여사업장이 아예 없으면 그것부터 말한다', () => {
  const g = API.gaps(FULL, []);
  const s = g.filter((x) => x.k === '_sites')[0];
  assert.ok(s, '사업장이 없는데 말하지 않는다');
  assert.match(s.where, /사업장 추가/);
  assert.match(s.docs, /설립합의서/);
});

/* ══════════ 화면 ══════════ */

test('★ 빈 곳이 있으면 표로 세운다 — 무엇·어디·어느 서식', () => {
  const h = API.html(Object.assign({}, FULL, { chairman: '' }), []);
  assert.match(h, /msg warn/);
  assert.match(h, /아직 안 적은 자료/);
  assert.match(h, /<th>비어 있는 것<\/th>/);
  assert.match(h, /<th>적는 곳<\/th>/);
  assert.match(h, /이 서식들이 읽습니다/);
  assert.ok(h.indexOf('대표자 성명') >= 0);
  assert.ok(!/\+[A-Za-z_$][\w$]*\+/.test(h), '보간되지 않은 변수가 새어 나왔다');
  assert.ok(!/undefined|\[object/.test(h), 'undefined 가 샜다');
});

test('사업장 쪽은 「몇/몇 곳」 딱지가 붙는다', () => {
  const sites = [{ name: 'ㄱ', ceo: '김', contrib: 1, biz_no: '1', address: 'ㄱ', status: 'active' },
    { name: 'ㄴ', ceo: '이', contrib: 1, biz_no: '2', address: 'ㄴ', status: 'active' }];
  const h = API.html(FULL, sites);
  assert.match(h, /2\/2곳/, '몇 곳이 비었는지 딱지에 안 적는다');
});

/* ══════════ 다섯 단계 묶음 ══════════ */

test('★★ 묶음이 다섯 단계를 «모두» 덮는다 — ④운영·⑤지원금이 빠져 있었다', () => {
  const p = grabDecl('ESTAB_PHASES');
  ['kinds', 'reg', 'tax', 'ops', 'sub'].forEach((k) => {
    assert.ok(p.indexOf("'" + k + "'") >= 0, k + ' 단계가 묶음에 없다');
  });
  assert.match(p, /DOC_OPS/);
  assert.match(p, /DOC_SUB/);
});

test('★ 다섯 단계 «모두» 화면에 묶음 단추가 있다 — 없으면 누를 곳이 없다', () => {
  /* 2026-09-20 줄 정리: 단계마다 따로 찍던 단추를 머리줄 하나(phaseHead)로 모았다.
     그래서 단추가 있는지는 «단계마다 phaseHead 를 부르는지»로 본다 — 다섯이 같은 모양이다. */
  assert.match(SRC, /function phaseHead\(title,helpKey,bundleKind,extraChip\)\{/, '머리줄 함수가 없다');
  assert.match(SRC, /estabBundle\(\\'\'\+bundleKind\+\'\\'\)/, '머리줄이 묶음 단추를 안 그린다');
  ['kinds', 'reg', 'tax', 'ops', 'sub'].forEach((k) => {
    assert.match(SRC, new RegExp("phaseHead\\('[^']*','[^']*','" + k + "'"), k + ' 단계에 단추가 없다');
  });
});

test('★★ 묶음이 장부를 «먼저» 읽는다 — ④⑤에는 장부 없이 못 그리는 서식이 있다', () => {
  const fn = grabFn('estabBundle');
  assert.match(fn, /DOC_NEEDS_LEDGER\[d\[0\]\]/, '장부가 필요한 서식인지 안 본다');
  assert.match(fn, /_docExtra\(/, '장부를 안 읽는다');
  const a = fn.indexOf('_docExtra(');
  const b = fn.indexOf('docBody(');
  assert.ok(a >= 0 && a < b, '장부를 그린 뒤에 읽으면 이미 빈 채로 그려진 뒤다');
  assert.match(fn, /_pre\.catch\(/, '장부를 못 읽으면 묶음이 통째로 안 나온다');
});

test('묶음이 빈 곳 표를 그린다', () => {
  const fn = grabFn('estabBundle');
  assert.match(fn, /bundleGap/);
  assert.match(fn, /estabGapHTML\(f,sites\)/);
});

test('ⓘ 가 새 표를 설명한다', () => {
  const i = SRC.indexOf("'estab.bundle':{");
  const h = SRC.slice(i, i + 2600);
  assert.ok(h.indexOf('아직 안 적은 자료') >= 0, 'ⓘ 가 새 표를 말하지 않는다');
  assert.ok(h.indexOf('④운영') >= 0 && h.indexOf('⑤근복지원금') >= 0, '다섯 단계라고 말하지 않는다');
});

test('같은 이름 함수를 두 번 선언하지 않았다', () => {
  ['estabGaps', 'estabGapHTML'].forEach((n) => {
    const c = (SRC.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있다');
  });
});
