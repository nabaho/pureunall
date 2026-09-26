/* 원본 한글 «틀»에 기금 자료 채우기 — 첫 시범: 설립준비위원회 회의록
 *
 * 대표 결정 2026-09-23
 *   「편집하려고 하면 … 글자나 줄간격등이 계속 엉망이 된다 … 근본적으로 해결」
 *   → 「원래 있던 한글화일 기준으로 정리하면 안되나 다시 검토해라」
 *   → 틀은 «공용 비공개 저장소»(fund_erp/hwp_tpl)에.
 *
 * 틀 = 원본 .hwp 에서 채울 자리마다 «글자 표지»({{기금명}}, 서명란은 {{근로자위원1}} …)를 넣은 파일.
 * 여기서는 «이름 → 값» 과 «값을 넣는 차례»를 본다. 한글 엔진 자체는 흉내 낸 문서로 대신한다.
 *
 * 2026-09-24 한글 프로그램으로 직접 열어 보고 바꾼 것 — 누름틀로 채우면 한글에서 그 자리와 뒤 글자가
 * 작은 글씨로 나왔고, 긴 글은 옛 줄 정보 때문에 겹쳐 나왔다. 그래서 글자 표지 + 줄 다시 나누기로 간다.
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
const X = require('../js/pu-hwpx-fill.js');
const API = (() => {
  const box = {};
  new Function('PuHwpxFill', [
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
    grabDecl('HWP_TPL_KINDS'), grabLine('HWP_TPL_BLANK'), grabLine('HWP_TPL_MAXLIST'),
    grabLine('HWP_MK_OPEN'), grabFn('_hwpMk'),
    grabFn('_hwpTplBase'), grabFn('_bytesToB64'), grabFn('_b64ToBytes'),
    grabFn('_hwpTplValues'), grabFn('_hwpTypeRules'), grabFn('_hwpFillXml'),
    grabFn('_hwpStripLinesegs'),
    'this.base=_hwpTplBase; this.toB64=_bytesToB64; this.fromB64=_b64ToBytes; this.values=_hwpTplValues;',
    'this.rules=_hwpTypeRules; this.fillXml=_hwpFillXml; this.strip=_hwpStripLinesegs;',
    'this.KINDS=HWP_TPL_KINDS; this.BLANK=HWP_TPL_BLANK;',
  ].join('\n')).call(box, X);
  return box;
})();

/* 한글(HWPX) 본문 흉내 — 문단 하나에 run 하나. 옛 줄 정보(linesegarray)도 붙여 둔다 */
const LS = '<hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray>';
const para = (t) => '<hp:p id="0"><hp:run charPrIDRef="3"><hp:t>' + t + '</hp:t></hp:run>' + LS + '</hp:p>';
const sec = (...ts) => '<hs:sec>' + ts.map(para).join('') + '</hs:sec>';
const textOf = (xml) => X.textOf(xml).split('\n').join(' / ');
const fill = (text, V, from, to) => { const r = API.fillXml(sec(...[].concat(text)), V, from, to); r.text = textOf(r.xml); return r; };

const F = { name: '가나다공동근로복지기금', fund_type: '공동', address: '서울특별시 종로구 세종대로 1길 11',
  meeting_date: '2026-03-02', meeting_place: '가나기계 본사 회의실',
  officers: [{ role: '사용자측 이사', name: '최사측' }, { role: '근로자측 주임이사', name: '박노측' }, { role: '근로자측 감사', name: '정감사' }] };
const SITES = [
  { name: '가나기계 주식회사', ceo: '김대표', wrep_name: '박근로', urep_same: true, contrib: 100000000, status: 'active' },
  { name: '다라전자 주식회사', ceo: '이대표', wrep_name: '최근로', urep_same: true, contrib: 120000000, status: 'active' },
];

/* ══════════ ① 이름 → 값 ══════════ */

test('목록 표지는 끝 번호를 떼면 뜻이다 — {{근로자위원2}} → 근로자위원', () => {
  assert.equal(API.base('근로자위원2'), '근로자위원');
  assert.equal(API.base('회의일'), '회의일');
  assert.equal(API.base(null), '');
});

test('★★ 회의록 틀의 표지 27가지를 «모두» 안다 — 모르는 이름이 생기면 그 자리가 조용히 빈다', () => {
  /* 틀(회의록)에 실제로 든 이름들 — 틀을 만들 때 나온 목록 그대로. 틀이 늘면 여기도 는다. */
  const TPL = ['거래은행', '경과일', '근로자위원', '근로자측이사', '기금명', '기금사용비율', '기금사용액', '기금소재지',
    '목적사업비', '부채', '비용', '사업연도', '사용자위원', '사용자측이사', '수익', '수지차익', '이사수', '일정일',
    '자본', '자산', '참여회사', '출연금', '출연월', '회의일', '회의일짧게', '회의일한글', '회의장소'];
  const V = API.values(F, SITES);
  const missing = TPL.filter((k) => V[k] === undefined);
  assert.deepEqual(missing, [], '값을 모르는 표지: ' + missing.join(', '));
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

test('★★ 같은 표지가 여럿이면 모두 채운다 — 「기금명」은 회의록에 아홉 번 나온다', () => {
  const r = fill(['{{기금명}}의 회의 {{회의일}}', '{{기금명}}', '끝 {{기금명}}'], { 기금명: '가나다', 회의일: '2026. 3. 2.' }, '공동', '공동');
  assert.equal(r.text, '가나다의 회의 2026. 3. 2. / 가나다 / 끝 가나다');
  assert.equal(r.filled, 4);
});

test('★ 위원 같은 «목록 값»은 번호 표지에 차례대로 한 사람씩', () => {
  const r = fill('{{근로자위원1}}|{{근로자위원2}}|{{사용자위원1}}|{{사용자위원2}}', { 근로자위원: ['박근로', '최근로'], 사용자위원: ['김대표'] }, '공동', '공동');
  assert.equal(r.text, '박근로|최근로|김대표|' + API.BLANK, '사람이 모자란 칸은 밑줄');
});

test('★ 서명칸보다 사람이 많으면 «몇 명 더»인지 알려 준다 — 말없이 빠지면 날인을 못 받는다', () => {
  const r = fill('{{근로자위원1}} {{근로자위원2}}', { 근로자위원: ['가', '나', '다', '라'] }, '공동', '공동');
  assert.deepEqual(r.over, { 근로자위원: 2 });
});

test('★ 모르는 값은 밑줄로 — 빈 자리로 두면 무엇을 적어야 할지 안 보인다(HTML 서식과 같은 밑줄)', () => {
  const r = fill('◦ {{경과일}} : 노사협의회 · {{기금명}}', { 경과일: '', 기금명: '가나다' }, '공동', '공동');
  assert.equal(r.text, '◦ ' + API.BLANK + ' : 노사협의회 · 가나다');
  assert.equal(r.filled, 1, '밑줄은 «채운 것»으로 세지 않는다');
});

test('★ 틀에 있는데 앱이 모르는 표지는 «알린다» — 틀과 코드가 어긋났다는 뜻이다', () => {
  const r = fill('{{기금명}} {{새칸}} {{새칸}}', { 기금명: '가나다' }, '공동', '공동');
  assert.deepEqual(r.unknown, ['새칸']);
  assert.match(r.text, /\{\{새칸\}\}/, '모르는 표지는 지우지 않고 그대로 둔다(눈에 띄게)');
});

test('표지 찾기는 이름만 뽑는다 — 중괄호가 한쪽만 있는 글은 표지가 아니다', () => {
  assert.deepEqual(X.markers(sec('{{기금명}} {{회의일}} {{기금명}} {{ 깨짐 {{')), { 기금명: 2, 회의일: 1 });
});

/* ══════════ ③ 공동/사내 말 바꾸기 ══════════ */

test('★★ 말 바꾸기는 표지를 채우기 «전»에 — 뒤에 하면 기금 이름까지 바뀐다', () => {
  const r = fill('{{기금명}}은 공동근로복지기금협의회를 둔다', { 기금명: '가나다공동근로복지기금' }, '공동', '사내');
  assert.equal(r.text, '가나다공동근로복지기금은 사내근로복지기금협의회를 둔다',
    '기금 이름은 그대로, 틀의 말만 바뀌어야 한다');
});

test('사내 기금: HTML 서식과 같은 짝으로 바꾼다(공동 전용 말까지) — 긴 말 먼저', () => {
  const R = API.rules('공동', '사내').map((r) => r.find + '→' + r.to);
  assert.ok(R.includes('공동근로복지기금협의회→사내근로복지기금협의회'));
  assert.ok(R.includes('공동근로복지기금→사내근로복지기금'));
  assert.ok(R.includes('공동기금→기금'), '공동 전용 말(공동기금)도 바꿔야 한다');
  /* 긴 말을 먼저 — 「공동근로복지기금」을 먼저 바꾸면 「…협의회」 짝이 영영 안 맞는다 */
  assert.ok(R.indexOf('공동근로복지기금협의회→사내근로복지기금협의회') < R.indexOf('공동근로복지기금→사내근로복지기금'));
  const r = fill('공동기금협의회와 공동근로복지기금협의회', {}, '공동', '사내');
  assert.equal(r.text, '협의회와 사내근로복지기금협의회');
});

test('★★ 틀 유형과 상관없이 «기금 유형 쪽으로» 맞춘다 — 원본 공동 회의록에도 「사내…협의회 회의록」 제목이 박혀 있었다', () => {
  /* 한글로 열어 보고 알았다(2026-09-26): 틀도 공동, 기금도 공동이라 안 바꿨더니 공동 기금 회의록 별지 제목이 «사내» 로 나갔다.
     HTML 서식(_ftypeSwap)은 늘 기금 유형 쪽으로 맞춘다 — 한글 틀도 같게 */
  const r = fill('제 1 차 사내근로복지기금협의회 회의록', {}, '공동', '공동');
  assert.equal(r.text, '제 1 차 공동근로복지기금협의회 회의록');
  const s = fill('공동근로복지기금협의회', {}, '사내', '사내');
  assert.equal(s.text, '사내근로복지기금협의회');
});

/* ══════════ ③-2 줄 다시 나누기 (한글에서 직접 보고 고친 것) ══════════ */

test('★★ 표지를 채운 문단만 옛 줄 정보(linesegarray)를 걷는다 — 한글이 그것을 믿어 긴 글이 겹쳐 나왔다', () => {
  const r = API.fillXml(sec('{{기금명}}', '그대로 두는 문단'), { 기금명: '아주 긴 이름의 가나다라마바사 공동근로복지기금' }, '공동', '공동');
  const ps = r.xml.split('</hp:p>');
  assert.doesNotMatch(ps[0], /linesegarray/, '채운 문단은 걷는다');
  assert.match(ps[1], /linesegarray/, '손대지 않은 문단은 원본 그대로');
});

test('_hwpStripLinesegs — (AI 고치기의 줄 다시 나누기가 쓴다) 줄 정보를 모두 걷는다', () => {
  const x = '<hp:p id="1"><hp:run><hp:t>가나다</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0"/></hp:linesegarray></hp:p>'
    + '<hp:p id="2"><hp:run><hp:t>라마</hp:t></hp:run><hp:linesegarray/></hp:p>';
  const out = API.strip(x);
  assert.doesNotMatch(out, /linesegarray/);
  assert.match(out, /<hp:t>가나다<\/hp:t>/, '글은 그대로 남아야 한다');
  assert.match(out, /<hp:t>라마<\/hp:t>/);
});

test('★ 틀 채우기는 HWPX(XML)에서 한다 — 표 안의 표까지 닿게(rhwp 찾기·바꾸기는 겹친 표를 못 봤다)', () => {
  const fill = grabFn('hwpTplFill');
  assert.match(fill, /_hwpTplBytes\(t\)/);
  assert.match(fill, /_hwpxEach\(hx,function\(x\)\{ return _hwpFillXml\(x,V,from,to\); \}\)/);
  assert.doesNotMatch(fill, /replaceAll/, 'rhwp 의 replaceAll 길로 돌아가지 않는다');
  assert.match(grabFn('_hwpTplBytes'), /exportHwpx\(\)/, '옛 .hwp 틀도 HWPX 로 바꿔 같은 길을 탄다');
});

test('★ 표지 여닫는 중괄호를 소스에 «그대로» 쓰지 않는다 — 짝 없는 {{ 가 검사들의 함수 자르기를 깨뜨렸다', () => {
  ['_hwpFillXml', '_hwpTypeRules', 'hwpTplFill', '_hwpBizplanValues'].forEach((n) => {
    const fn = grabFn(n);    // 잘라 내는 것 자체가 검사다 — 짝이 안 맞으면 여기서 멈춘다
    const code = fn.replace(/\/\*[\s\S]*?\*\//g, ' ');
    assert.equal((code.match(/\{/g) || []).length, (code.match(/\}/g) || []).length, n + ' 의 중괄호 짝이 안 맞는다');
  });
});

test('zip 도구는 필요할 때 한 번만, 저장소 안의 것으로', () => {
  const fn = grabFn('_loadJsZip');
  assert.match(fn, /s\.src='vendor\/jszip\.min\.js'/);
  assert.ok(fs.existsSync(path.join(ROOT, 'vendor', 'jszip.min.js')));
});

test('★ 누름틀로 채우는 길은 다시 들이지 않는다 — 한글에서 그 자리와 뒤 글자가 작은 글씨로 나왔다', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.doesNotMatch(code, /setFieldValueByName\(/);
  assert.doesNotMatch(code, /insertClickHereField/);
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
  assert.equal(API.KINDS.bizplan, '공동', '둘째 — 사업계획서(표 안의 표가 있는 서식)');
});

test('★★ 틀이 있는 서식은 오른쪽에 «원본 한글 모양»으로 보인다 — HTML 흉내 화면을 거치지 않는다', () => {
  const side = grabFn('sidePreview');
  assert.match(side, /if\(hwpSidePreview\(kind\)\) return;/);
  const hp = grabFn('hwpSidePreview');
  assert.match(hp, /\(S\._hwpTplHas\|\|\{\}\)\[kind\]/, '틀이 올라가 있을 때만');
  assert.match(hp, /_hwpDocRef\(fid,kind\)\.once\('value'\)/, '이 기금에 고쳐 보관한 것이 있으면 그것을 보인다');
  assert.match(hp, /hwpTplFill\(kind,f,sites\)/);
  assert.match(hp, /PureunHwp\.renderPreview\(v,bytes/);
  assert.match(hp, /HTML로 보기/, '예전 화면으로 돌아가는 길은 남긴다');
});

test('서식마다 값 함수를 고른다 — 사업계획서는 사업계획서의 셈으로', () => {
  assert.match(grabDecl('HWP_TPL_VALUES'), /bizplan:_hwpBizplanValues/);
  assert.match(grabDecl('HWP_TPL_VALUES'), /minutes:_hwpTplValues/);
  assert.match(grabFn('_hwpValuesFor'), /HWP_TPL_VALUES\[kind\]/);
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
