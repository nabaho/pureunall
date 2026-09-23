/* 원본 한글 «틀»에 기금 자료 채우기 — 첫 시범: 설립준비위원회 회의록
 *
 * 대표 결정 2026-09-23
 *   「편집하려고 하면 … 글자나 줄간격등이 계속 엉망이 된다 … 근본적으로 해결」
 *   → 「원래 있던 한글화일 기준으로 정리하면 안되나 다시 검토해라」
 *   → 틀은 «공용 비공개 저장소»(fund_erp/hwp_tpl)에.
 *
 * 틀 = 원본 .hwp 에서 채울 자리마다 «이름 붙은 누름틀»을 넣은 파일(「기금명#12」 — #앞이 뜻).
 * 여기서는 «이름 → 값» 과 «값을 넣는 차례»를 본다. 한글 엔진 자체는 흉내 낸 문서로 대신한다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름·금액은 전부 가짜다.
 *   틀 파일(.hwp)은 저장소에 넣지 않는다 — 원본에 남의 기금 자료가 박혀 있었다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
function grabLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + n);
  return m[0];
}

/* ── 실제 코드를 그대로 싣는다 — 사업계획·재무표는 «없음»으로 흉내(값이 비는지만 본다) ── */
const API = (() => {
  const box = {};
  new Function([
    'var S={year:2026};',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'function _bizTotals(){ return null; } function bizplanRows(){ return null; }',
    'function _bizFinOf(){ return null; } function isSetupFund(){ return false; } function _bizFinZero(){ return null; }',
    'function bizplanBS(){ return null; } var BIZ_BS_ROWS=[];',
    grabDecl('_K'),
    grabFn('_officersOf'), grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('_isCommittee'),
    grabFn('_siteCommittee'), grabFn('_prepCommittee'),
    grabFn('estabSites'), grabFn('siteContribOf'), grabFn('foundContribOf'), grabFn('foundContrib'),
    grabFn('partyNames'), grabFn('partyJoin'), grabFn('useRate'),
    grabDecl('FTYPE_PAIRS'), grabDecl('FTYPE_GONG_ONLY'),
    grabDecl('HWP_TPL_KINDS'),
    grabFn('_hwpTplBase'), grabFn('_bytesToB64'), grabFn('_b64ToBytes'),
    grabFn('_hwpTplValues'), grabFn('_hwpTypeSwap'), grabFn('_hwpFillDoc'),
    'this.base=_hwpTplBase; this.toB64=_bytesToB64; this.fromB64=_b64ToBytes; this.values=_hwpTplValues;',
    'this.swap=_hwpTypeSwap; this.fill=_hwpFillDoc; this.KINDS=HWP_TPL_KINDS;',
  ].join('\n')).call(box);
  return box;
})();

/* 한글 엔진 문서 흉내 — 누름틀 목록을 주고, 무엇을 어떤 차례로 불렀는지 적는다 */
function fakeDoc(names) {
  const calls = [];
  return {
    calls,
    getFieldList: () => JSON.stringify(names.map((n, i) => ({ fieldId: i + 1, name: n }))),
    setFieldValueByName: (n, v) => { calls.push(['set', n, v]); return JSON.stringify({ ok: true }); },
    replaceAll: (a, b) => { calls.push(['swap', a, b]); return JSON.stringify({ ok: true, count: 1 }); },
  };
}

const F = { name: '가나다공동근로복지기금', fund_type: '공동', address: '서울특별시 종로구 세종대로 1길 11',
  meeting_date: '2026-03-02', meeting_place: '가나기계 본사 회의실',
  officers: [{ role: '사용자측 이사', name: '최사측' }, { role: '근로자측 주임이사', name: '박노측' }, { role: '근로자측 감사', name: '정감사' }] };
const SITES = [
  { name: '가나기계 주식회사', ceo: '김대표', wrep_name: '박근로', urep_same: true, contrib: 100000000, status: 'active' },
  { name: '다라전자 주식회사', ceo: '이대표', wrep_name: '최근로', urep_same: true, contrib: 120000000, status: 'active' },
];

/* ══════════ ① 이름 → 값 ══════════ */

test('누름틀 이름의 «#번호» 앞이 뜻이다', () => {
  assert.equal(API.base('기금명#12'), '기금명');
  assert.equal(API.base('회의일'), '회의일');
  assert.equal(API.base(null), '');
});

test('★★ 회의록 틀의 누름틀 27가지를 «모두» 안다 — 모르는 이름이 생기면 그 자리가 조용히 빈다', () => {
  /* 틀(회의록)에 실제로 든 이름들 — 틀을 만들 때 나온 목록 그대로. 틀이 늘면 여기도 는다. */
  const TPL = ['거래은행', '경과일', '근로자위원', '근로자측이사', '기금명', '기금사용비율', '기금사용액', '기금소재지',
    '목적사업비', '부채', '비용', '사업연도', '사용자위원', '사용자측이사', '수익', '수지차익', '이사수', '일정일',
    '자본', '자산', '참여회사', '출연금', '출연월', '회의일', '회의일짧게', '회의일한글', '회의장소'];
  const V = API.values(F, SITES);
  const missing = TPL.filter((k) => V[k] === undefined);
  assert.deepEqual(missing, [], '값을 모르는 누름틀: ' + missing.join(', '));
});

test('회의일은 세 가지 꼴로 — 원본이 자리마다 다르게 적었다', () => {
  const V = API.values(F, SITES);
  assert.equal(V.회의일, '2026. 3. 2.');
  assert.equal(V.회의일짧게, '‘26년 03월 02일');
  assert.equal(V.회의일한글, '2026년  3월  2일');
});

test('★ 회의일을 모르면 비운다 — 오늘 날짜로 지어내면 없던 회의가 생긴다', () => {
  const V = API.values(Object.assign({}, F, { meeting_date: '' }), SITES);
  assert.equal(V.회의일, ''); assert.equal(V.회의일짧게, ''); assert.equal(V.회의일한글, '');
});

test('참여회사·소재지·출연금 — HTML 서식과 같은 함수에서 온다', () => {
  const V = API.values(F, SITES);
  assert.equal(V.참여회사, '가나기계 주식회사 및 다라전자 주식회사');
  assert.equal(V.기금소재지, F.address);
  assert.equal(V.출연금, '220,000,000');
});

test('★ 기금사용 비율은 대표 규칙(useRate) — 공동 90%, 사내 중소 80%, 그 밖 50%', () => {
  assert.equal(API.values(F, SITES).기금사용비율, '90');
  assert.equal(API.values(F, SITES).기금사용액, '198,000,000');
  assert.equal(API.values(Object.assign({}, F, { fund_type: '사내', sme: '중소기업' }), SITES).기금사용비율, '80');
  assert.equal(API.values(Object.assign({}, F, { fund_type: '사내', sme: '중소기업 아님' }), SITES).기금사용비율, '50');
});

test('출연금이 없으면 금액 자리는 비운다 — 0원을 적어 넣지 않는다', () => {
  const V = API.values(F, SITES.map((s) => Object.assign({}, s, { contrib: 0 })));
  assert.equal(V.출연금, ''); assert.equal(V.기금사용액, ''); assert.equal(V.기금사용비율, '');
});

test('위원은 «사람 차례대로» 한 칸씩 — 별지 제7호와 같은 명단(명부 위원 + 사업장 대표)', () => {
  const V = API.values(F, SITES);
  assert.deepEqual(V.근로자위원, ['박노측', '박근로', '최근로']);
  assert.deepEqual(V.사용자위원, ['최사측', '김대표', '이대표']);
  assert.equal(V.이사수, '3', '양쪽 수가 같을 때만 「각 N 명」');
  const V2 = API.values(F, SITES.slice(0, 1));
  assert.equal(V2.이사수, '2');
  const V3 = API.values(Object.assign({}, F, { officers: [] }), SITES.map((s, i) => i ? Object.assign({}, s, { urep_same: false }) : s));
  assert.equal(V3.이사수, '', '양쪽 수가 다르면 「각 N 명」을 적지 않는다(HTML 회의록과 같다)');
});

test('이사 — 명부의 그쪽 이사만, 「주임」이 적힌 사람만 (주임이사) — 감사는 이사가 아니다', () => {
  const V = API.values(F, SITES);
  assert.equal(V.사용자측이사, '최사측');
  assert.equal(V.근로자측이사, '박노측(주임이사)');
});

test('자료에 없는 날짜·은행은 비워 둔다 — 편집기에서 사람이 적는다', () => {
  const V = API.values(F, SITES);
  assert.equal(V.경과일, ''); assert.equal(V.일정일, ''); assert.equal(V.거래은행, ''); assert.equal(V.출연월, '');
});

/* ══════════ ② 값을 넣는 차례 ══════════ */

test('★★ 같은 뜻의 누름틀이 여럿이면 모두 채운다 — 「기금명」은 회의록에 아홉 번 나온다', () => {
  const d = fakeDoc(['기금명#0', '회의일#1', '기금명#2', '기금명#9']);
  const r = API.fill(d, { 기금명: '가나다', 회의일: '2026. 3. 2.' }, '공동', '공동');
  assert.equal(r.filled, 4);
  assert.deepEqual(d.calls.filter((c) => c[0] === 'set').map((c) => c[1]), ['기금명#0', '회의일#1', '기금명#2', '기금명#9']);
});

test('★ 위원 같은 «목록 값»은 나온 차례대로 한 사람씩', () => {
  const d = fakeDoc(['근로자위원#1', '근로자위원#2', '사용자위원#3']);
  API.fill(d, { 근로자위원: ['박근로', '최근로'], 사용자위원: ['김대표', '이대표'] }, '공동', '공동');
  assert.deepEqual(d.calls.map((c) => c[2]), ['박근로', '최근로', '김대표']);
});

test('★ 서명칸보다 사람이 많으면 «몇 명 더»인지 알려 준다 — 말없이 빠지면 날인을 못 받는다', () => {
  const d = fakeDoc(['근로자위원#1', '근로자위원#2']);
  const r = API.fill(d, { 근로자위원: ['가', '나', '다', '라'] }, '공동', '공동');
  assert.deepEqual(r.over, { 근로자위원: 2 });
});

test('빈 값은 넣지 않는다 — 누름틀이 비어 있어야 안내글이 보여 사람이 채운다', () => {
  const d = fakeDoc(['경과일#1', '기금명#2']);
  const r = API.fill(d, { 경과일: '', 기금명: '가나다' }, '공동', '공동');
  assert.equal(r.filled, 1);
  assert.deepEqual(d.calls.map((c) => c[1]), ['기금명#2']);
});

test('★ 틀에 있는데 앱이 모르는 이름은 «알린다» — 틀과 코드가 어긋났다는 뜻이다', () => {
  const d = fakeDoc(['기금명#1', '새칸#2']);
  const r = API.fill(d, { 기금명: '가나다' }, '공동', '공동');
  assert.deepEqual(r.unknown, ['새칸']);
});

/* ══════════ ③ 공동/사내 말 바꾸기 ══════════ */

test('★★ 말 바꾸기는 누름틀을 채우기 «전»에 — 뒤에 하면 기금 이름까지 바뀐다', () => {
  const d = fakeDoc(['기금명#1']);
  API.fill(d, { 기금명: '가나다공동근로복지기금' }, '공동', '사내');
  const firstSet = d.calls.findIndex((c) => c[0] === 'set');
  const lastSwap = d.calls.map((c) => c[0]).lastIndexOf('swap');
  assert.ok(lastSwap >= 0, '공동 틀을 사내 기금에 쓰면 말을 바꿔야 한다');
  assert.ok(lastSwap < firstSet, '바꾸기가 채우기보다 먼저여야 한다');
});

test('공동 틀 → 사내 기금: HTML 서식과 같은 짝으로 바꾼다(공동 전용 말까지)', () => {
  const d = fakeDoc([]);
  API.swap(d, '공동', '사내');
  const swaps = d.calls.map((c) => c[1] + '→' + c[2]);
  assert.ok(swaps.includes('공동근로복지기금협의회→사내근로복지기금협의회'));
  assert.ok(swaps.includes('공동근로복지기금→사내근로복지기금'));
  assert.ok(swaps.includes('공동기금→기금'), '공동 전용 말(공동기금)도 바꿔야 한다');
  /* 긴 말을 먼저 — 「공동근로복지기금」을 먼저 바꾸면 「…협의회」 짝이 영영 안 맞는다 */
  assert.ok(swaps.indexOf('공동근로복지기금협의회→사내근로복지기금협의회') < swaps.indexOf('공동근로복지기금→사내근로복지기금'));
});

test('사내 틀 → 공동 기금은 거꾸로, 같은 유형이면 손대지 않는다', () => {
  const d = fakeDoc([]);
  API.swap(d, '사내', '공동');
  assert.ok(d.calls.map((c) => c[1] + '→' + c[2]).includes('사내근로복지기금→공동근로복지기금'));
  const e = fakeDoc([]);
  assert.equal(API.swap(e, '공동', '공동'), 0);
  assert.equal(e.calls.length, 0);
});

/* ══════════ ④ 저장 ══════════ */

test('틀·보관본은 base64 로 — 오가도 한 바이트도 안 바뀐다', () => {
  const bytes = new Uint8Array(70000); for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) & 255;
  const back = API.fromB64(API.toB64(bytes));
  assert.equal(back.length, bytes.length);
  assert.ok(back.every((b, i) => b === bytes[i]));
});

test('★ 틀은 fund_erp 아래 비공개 자리에 — 규칙을 새로 열지 않는다', () => {
  assert.match(grabFn('_hwpTplRef'), /NS\+'\/hwp_tpl\/'\+kind/);
  assert.match(grabFn('_hwpDocRef'), /NS\+'\/hwp_docs\/'\+fid\+'\/'\+kind/);
  assert.match(grabFn('_hwpTplIdxRef'), /NS\+'\/hwp_tpl_index'/);
});

test('★★ 틀 파일(.hwp)을 저장소에 넣지 않았다 — 원본에 남의 기금 자료가 박혀 있었다', (t) => {
  let files = '';
  try { files = execSync('git ls-files -- "*.hwp" "*.hwpx" "*.HWP" "*.HWPX"', { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { return t.skip('git 없음'); }
  assert.equal(files.trim(), '', '저장소에 한글 파일이 있습니다: ' + files.trim());
});

/* ══════════ ⑤ 화면 배선 ══════════ */

test('서식 줄에 [한글로 채워 열기]·[한글 틀 올리기]가 틀 받는 서식에만 뜬다', () => {
  const fn = SRC.slice(SRC.indexOf('function formRow('), SRC.indexOf('function formRow(') + 2600);
  assert.match(fn, /HWP_TPL_KINDS\[kind\]/);
  assert.match(fn, /hwpOpenFilled\(/);
  assert.match(fn, /hwpTplUpload\(/);
  assert.equal(API.KINDS.minutes, '공동', '첫 시범은 공동 회의록 틀');
});

test('틀이 «있는지»만 먼저 읽는다 — 틀 서른 개를 서식 목록 열 때마다 받지 않게', () => {
  assert.match(grabFn('renderForms'), /_hwpTplIdxRef\(\)\.once\('value'\)/);
  assert.match(grabFn('hwpTplUpload'), /_hwpTplIdxRef\(\)\.child\(kind\)\.set\(meta\)/, '올릴 때 목록도 같이 적어야 한다');
});

test('★ 보관본이 있으면 새로 채우기 전에 묻는다 — 고친 것을 잃지 않게', () => {
  const fn = grabFn('hwpOpenFilled');
  assert.match(fn, /_hwpDocRef\(fid,kind\)\.once\('value'\)/);
  assert.match(fn, /보관본 열기/);
});

test('⒤ 도움말이 있다', () => {
  assert.match(SRC, /'forms\.hwptpl':\{t:/);
});
