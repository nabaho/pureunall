'use strict';
/* 참여사업장의 «사람 넷»과 중소기업확인서 (대표 지시 2026-09-13)
 *
 *   「참여사업장에는 대표자와 사업장 담당자가 있다 … 근로자 대표도 있는데 각각 모두 다른경우가 있다」
 *   「회의의 대표자와 사용자대표 근로자대표가 각각 다를수 있다 이부분은 좀 구분해야한다」
 *   「중소기업확인서도 ocr에서 찾아서 중소기업 여부 체크와 기간도 표시되게」
 *   「상시근로자 숫자만 있으면 된다」 · 「필터링 기능 넣어달라」
 *
 * ★ 한 사업장에 사람이 넷 나온다: 대표자 · 담당자 · 사용자대표 · 근로자대표.
 *   넷이 다 다른 사람인 일이 흔하고, 서식마다 «어느 사람»을 묻는지가 다르다.
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
/* 필요한 조각만 실어 «정말 돌려» 본다 */
function load(parts) {
  const box = {};
  new Function(parts.join('\n')).call(box);
  return box;
}

/* ══ 사람 넷을 가른다 ═══════════════════════════════════════════════ */

test('① 사용자대표 칸이 있고, 성명과 직위를 따로 받는다', () => {
  const b = load([grabDecl('UREP_FIELDS'), 'this.F=UREP_FIELDS;']);
  const keys = b.F.map((c) => c[0]);
  assert.deepEqual(keys, ['urep_name', 'urep_title']);
});

test('★ ② 사용자대표는 SITE_FIELDS 에 «섞이지 않는다» — 엑셀 붙여넣기 열 차례가 밀린다', () => {
  const b = load([grabDecl('SITE_FIELDS'), grabDecl('UREP_FIELDS'), grabDecl('WREP_FIELDS'),
    'this.S=SITE_FIELDS; this.U=UREP_FIELDS; this.W=WREP_FIELDS;']);
  const s = b.S.map((c) => c[0]);
  b.U.concat(b.W).forEach((c) => {
    assert.ok(s.indexOf(c[0]) < 0, '사람 칸이 SITE_FIELDS 에 들어갔다: ' + c[0]);
  });
});

test('★★ ③ 사용자대표가 비면 «대표자를 끌어다 쓰지 않는다» — 아무도 정하지 않은 이름이 관청에 나간다', () => {
  const b = load([grabFn('_siteUrep'), 'this.f=_siteUrep;']);
  const 빈것 = b.f({ ceo: '신동현', name: '한국벤토나이트' });
  assert.equal(빈것.name, '', '★ 대표자를 사용자대표로 끌어다 썼습니다.');
  assert.equal(빈것.title, '');
  const 적은것 = b.f({ ceo: '신동현', urep_name: '박공장', urep_title: '공장장' });
  assert.equal(적은것.name, '박공장');
  assert.equal(적은것.title, '공장장');
});

test('④ 넷이 «각각 다른 자리»에서 온다 — 한 곳을 고쳐도 나머지가 안 따라 움직인다', () => {
  const b = load([grabFn('_siteUrep'), 'this.u=_siteUrep;']);
  const s = { ceo: '가', urep_name: '나', wrep_name: '다' };
  assert.equal(b.u(s).name, '나');
  assert.notEqual(b.u(s).name, s.ceo);
  assert.notEqual(b.u(s).name, s.wrep_name);
});

/* ══ 중소기업확인서 ════════════════════════════════════════════════ */

function smeParser() {
  return load([grabFn('_flat'), grabFn('_cleanName'), grabFn('_loose'), grabFn('parseSmeCert'),
    'this.f=parseSmeCert;']);
}

test('⑤ 중소기업확인서에서 기업규모와 유효기간을 읽는다', () => {
  const o = smeParser().f('기업명 : 주식회사 가나  기업규모 : 중소기업\n유효기간 : 2026. 04. 01. ~ 2027. 03. 31.');
  assert.equal(o.sme_cert, '중소기업');
  assert.equal(o.sme_from, '2026-04-01');
  assert.equal(o.sme_to, '2027-03-31');
});

test('⑥ 「소기업」은 중소기업으로 뭉개지 않는다 — 확인서가 갈라 적어 준다', () => {
  const o = smeParser().f('기업규모 : 중소기업(소기업)\n유효기간 : 2026-04-01 ~ 2027-03-31');
  assert.equal(o.sme_cert, '소기업');
});

test('★★ ⑦ 「해당하지 아니함」을 «거꾸로» 읽지 않는다 — 그 문장 속에도 중소기업 네 글자가 있다', () => {
  const o = smeParser().f('귀 기업은 중소기업에 해당하지 아니합니다.');
  assert.equal(o.sme_cert, '해당 없음',
    '★ 「중소기업」 네 글자에 걸려 거꾸로 읽었습니다 — 아님을 먼저 봐야 합니다.');
});

test('⑧ 유효기간이 없으면 «지어내지 않는다»', () => {
  const o = smeParser().f('기업규모 : 중소기업');
  assert.equal(o.sme_cert, '중소기업');
  assert.equal(o.sme_from, undefined);
  assert.equal(o.sme_to, undefined);
});

test('★ ⑨ 유효기간이 지났는지 «오늘»로 잰다 — 끝나는 날 당일은 아직 유효하다', () => {
  const b = load([grabFn('_siteSme'), 'this.f=_siteSme;']);
  assert.equal(b.f({ sme_to: '2027-03-31' }, '2027-03-31').expired, false, '끝나는 날 당일은 유효합니다.');
  assert.equal(b.f({ sme_to: '2027-03-31' }, '2027-04-01').expired, true);
  assert.equal(b.f({ sme_to: '' }, '2027-04-01').expired, false, '모를 때는 「지났다」고 하지 않습니다.');
});

test('⑩ 고르는 칸의 보기에 빈 값이 «맨 앞»이다 — 모르는 것을 「해당 없음」으로 적어 두면 안 된다', () => {
  const b = load([grabDecl('SME_OPTS'), 'this.O=SME_OPTS;']);
  assert.equal(b.O[0], '');
  assert.ok(b.O.indexOf('중소기업') > 0 && b.O.indexOf('소기업') > 0);
});

/* ══ 법인등록번호는 «기업정보함»에서 온다 ═══════════════════════════
   ★ 2026-09-13 대표 지시 「사업자등록증과 법인등기부등은 차라리 사진첩내용은 모두 빼라
     기업정보함에서 바로 가지고 오면된다」 — 등기부 «한 곳씩» 판독을 걷어냈다.
   ⚠ 걷어냈으면 «대신 오는 길»이 반드시 있어야 한다. 없으면 법인등록번호를 넣을 방법이
     통째로 사라진다 — 그것이 조용히 빈칸으로 등기신청서에 나간다. */
test('★★ ⑪ 등기부 판독을 뺀 자리에 «기업정보함 길»이 살아 있다 — 법인등록번호를 넣을 방법', () => {
  assert.ok(SRC.indexOf("['cno','corp_no']") >= 0,
    '★ 기업정보함 → 사업장 짝짓기에 법인등록번호가 없습니다.');
  assert.ok(SRC.indexOf("['corp_no','법인등록번호']") >= 0,
    '★ 일괄 채우기에 법인등록번호가 없습니다 — 열여섯 곳을 한꺼번에 채울 수 없습니다.');
  /* 걷어낸 길이 정말 사라졌는가(죽은 코드가 남으면 다음 사람이 살아 있는 줄 안다) */
  ['parseCorpRegSite', 'siteCorpAlbum', 'dz-sitecorp', 'siteDocAlbum', 'dz-sitebiz']
    .forEach((n) => assert.ok(SRC.indexOf(n) < 0, '걷어낸 것이 남아 있습니다: ' + n));
});

/* ══ 거르기 ════════════════════════════════════════════════════════ */

function filterBox() {
  return load([
    'var _siteQ="", _siteOnly="";',
    'function _siteContacts(s){ return (s&&s._c)||{}; }',
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('_siteSme'),
    grabFn('_siteHay'), grabFn('_digitsOnly'), grabFn('_siteFilter'),
    'this.set=function(q,o){ _siteQ=q; _siteOnly=o; };',
    'this.f=_siteFilter;']);
}
const 보기 = [
  { name: '한국벤토나이트', ceo: '신동현', biz_no: '412-81-12595', _c: { name: '이미정' }, partner: true },
  { name: '바이켐', ceo: '이선화', biz_no: '134-81-03880', _c: { name: '강동순' }, wrep_name: '김근로' },
  { name: '수양캠텍', ceo: '박범호', biz_no: '215-86-44206', _c: { name: '마지영' }, urep_name: '박공장',
    sme_to: '2020-03-31' }
];

test('⑫ 상호·대표자·담당자 어느 것으로도 찾아진다', () => {
  const b = filterBox();
  b.set('바이켐', ''); assert.equal(b.f(보기).length, 1);
  b.set('박범호', ''); assert.equal(b.f(보기)[0].name, '수양캠텍');
  b.set('이미정', ''); assert.equal(b.f(보기)[0].name, '한국벤토나이트');
});

test('★ ⑬ 숫자만 쳐도 사업자번호가 찾아진다 — 명부는 412-81-12595, 손은 41281 로 친다', () => {
  const b = filterBox();
  b.set('41281', '');
  const r = b.f(보기);
  assert.equal(r.length, 1, '★ 붙임표를 빼고 친 번호를 못 찾습니다.');
  assert.equal(r[0].name, '한국벤토나이트');
});

test('⑭ 갈래 딱지 — 협력만 · 사용자대표 없음 · 근로자대표 없음 · 확인서 지남', () => {
  const b = filterBox();
  b.set('', 'partner'); assert.deepEqual(b.f(보기).map((x) => x.name), ['한국벤토나이트']);
  b.set('', 'nowrep');  assert.deepEqual(b.f(보기).map((x) => x.name), ['한국벤토나이트', '수양캠텍']);
  b.set('', 'nourep');  assert.deepEqual(b.f(보기).map((x) => x.name), ['한국벤토나이트', '바이켐']);
  b.set('', 'smeold');  assert.deepEqual(b.f(보기).map((x) => x.name), ['수양캠텍']);
});

test('⑮ 아무것도 안 걸면 다 보인다 — 거르기가 «기본으로 숨기지» 않는다', () => {
  const b = filterBox();
  b.set('', ''); assert.equal(b.f(보기).length, 3);
});

/* ══ ★★ 사람 보기를 «정말 그려» 본다 ═══════════════════════════════ */

test('★★ ⑯ 사람 보기를 정말 그리면 네 사람이 각각 제 칸에 선다', () => {
  const b = load([
    'function esc(s){ return String(s==null?"":s); }',
    'function _siteContacts(s){ return (s&&s._c)||{}; }',
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('_siteSme'), grabFn('_smeChip'),
    grabFn('sitesPeopleBody'),
    'this.f=sitesPeopleBody;']);
  const html = b.f([{ _id: 'S1', name: '한국벤토나이트', ceo: '신동현',
    _c: { name: '이미정', position: '부장' }, urep_name: '박공장', urep_title: '공장장',
    wrep_name: '김근로', wrep_title: '반장' }]);
  ['한국벤토나이트', '신동현', '이미정', '박공장', '공장장', '김근로', '반장']
    .forEach((t) => assert.ok(html.indexOf(t) >= 0, '화면에 안 나옵니다: ' + t));
  assert.ok(html.indexOf('사용자대표') >= 0 && html.indexOf('근로자대표') >= 0);
  /* 고치는 칸은 사용자대표·근로자대표뿐 — 대표자·담당자는 보여만 준다 */
  ['urep_name', 'urep_title', 'wrep_name', 'wrep_title']
    .forEach((f) => assert.ok(html.indexOf(f) >= 0, '고칠 칸이 없습니다: ' + f));
  assert.ok(html.indexOf("saveSitePerson('S1','ceo'") < 0, '대표자를 여기서 고치게 두었습니다.');
  /* ★ 서류를 읽는 길이 여기로 옮겨 왔다(편집 창에서 뺐으므로) — 없으면 읽을 방법이 없다 */
  assert.ok(html.indexOf("pplRepDoc('S1')") >= 0, '★ 재직증명서를 읽을 길이 없습니다.');
  assert.ok(html.indexOf("pplSmeDoc('S1')") >= 0, '★ 중소기업확인서를 읽을 길이 없습니다.');
  /* 줄을 눌러 창이 열리는 것과 «겹치지» 않아야 한다 — 단추가 줄 클릭을 삼켜야 한다 */
  assert.ok(html.indexOf('event.stopPropagation();pplRepDoc') >= 0,
    '★ 단추를 누르면 편집 창도 함께 열립니다 — 창이 겹쳐 뜹니다.');
});

test('★★ ⑰ 한 칸 저장이 «정해진 네 칸»만 받는다 — 아무 칸이나 쓰게 두지 않는다', () => {
  const src = grabFn('saveSitePerson');
  assert.match(src, /\['urep_name','urep_title','wrep_name','wrep_title'\]/,
    '허락하는 칸 목록이 없습니다.');
  assert.match(src, /indexOf\(field\)\s*<\s*0\)\s*return/, '목록에 없는 칸을 걸러내지 않습니다.');
  assert.match(src, /\.update\(/, '★ set 을 쓰면 재직증명서 연결 같은 나머지 칸이 지워집니다.');
});

/* ══ 새 칸이 «저장·되살리기»에 빠지지 않았는가 ═════════════════════ */

test('★★ ⑱ 새 묶음이 저장과 「걷어 두기」에 «둘 다» 들어 있다', () => {
  const save = grabFn('saveSite'), grab = grabFn('_siteDocGrab');
  ['UREP_FIELDS', 'SME_FIELDS'].forEach((n) => {
    assert.ok(save.indexOf(n) >= 0, '★ 저장에서 빠졌습니다: ' + n + ' — 쳐 넣어도 안 남습니다.');
    assert.ok(grab.indexOf(n) >= 0,
      '★ 걷어 두기에서 빠졌습니다: ' + n + ' — 사진첩에 다녀오면 쳐 둔 값이 말없이 사라집니다.');
  });
});

/* ══ ★★ 사용자대표가 «서식까지» 간다 ═══════════════════════════════
   자료를 모아 두기만 하면 아무 소용이 없다. 사용자대표가 실제로 서식에 닿는 길은 둘이다.
     ① 위원 고르기 → 임원 명부 → 위원 격자(별지 제7호)·회의록
     ② 설립합의서 별첨 명부
   ⚠ 이 둘이 끊기면 «조용히» 빈칸으로 관청에 나간다 — 화면은 멀쩡해 보인다. */

/* ⚠ 글자로 세지 «않는다» — 후보 줄을 통째로 지워도 「_siteUrep(st) 이 있다」로 통과했다
     (2026-09-13 되돌림이 그것을 잡았다). 후보를 «정말 만들어» 본다. */
function cands() {
  return load([grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('_sitePeopleCands'),
    'this.f=_sitePeopleCands;']).f;
}

test('★★ ⑳ 위원 후보로 사용자측에 «사용자대표와 대표자 둘 다» 선다', () => {
  const r = cands()({ name: '가나전자', ceo: '김대표', urep_name: '박공장', urep_title: '공장장', wrep_name: '이노측' });
  const 사측 = r.filter((x) => x[0] === '사용자대표').map((x) => x[1]);
  assert.deepEqual(사측, ['박공장', '김대표'],
    '★ 사용자측 후보가 둘이 아닙니다 — 협의회에 나오는 사람이 빠지거나, 대표이사가 빠집니다.');
  assert.equal(r.filter((x) => x[0] === '근로자대표').length, 1);
  /* ★ 소속 회사를 함께 들려 보낸다 — 공동기금은 위원이 여러 회사에서 나온다 */
  assert.deepEqual(r.map((x) => x[5]), ['가나전자', '가나전자', '가나전자'],
    '★ 소속 회사가 안 실립니다 — 명부에서 어느 회사 사람인지 알 수 없습니다.');
  /* 그 사업장에서 «어떤 자리»의 사람인지 화면에 적어 준다 */
  assert.deepEqual(r.map((x) => x[4]), ['근로자대표', '사용자대표', '대표자']);
});

test('★★ ㉑ 대표자와 사용자대표가 «같은 사람»이면 한 번만 — 두 줄이면 명부에 두 번 찍힌다', () => {
  const r = cands()({ ceo: '김대표', urep_name: '김대표', wrep_name: '이노측' });
  assert.equal(r.filter((x) => x[1] === '김대표').length, 1);
});

test('㉒ 빈 사람은 후보에 안 세운다 — 빈 줄을 골라 명부에 넣게 두지 않는다', () => {
  assert.deepEqual(cands()({}), []);
  assert.deepEqual(cands()({ ceo: '  ' }), []);
});

test('★★ ㉓ 고르기 창이 그 후보 함수를 «정말 쓴다» — 따로 짜 두면 화면과 검사가 갈린다', () => {
  assert.match(grabFn('openSitePeoplePick'), /_sitePeopleCands\(st\)/,
    '★ 고르기 창이 후보를 따로 만들고 있습니다 — 여기서 고친 것이 화면에 안 나타납니다.');
});

test('★★ ㉔ 설립합의서 별첨 명부에 사용자대표 열이 선다 — 없으면 누가 회의에 나오는지 안 남는다', () => {
  const b = load([
    'function esc(s){ return String(s==null?"":s); }',
    'function dgV(v,n){ return String(v||("＿".repeat(n||4))); }',
    'function dgWon(n){ return String(n||0); }',
    'function dgToday(){ return "2026. 9. 13."; }',
    'function foundContrib(){ return 10000000; }',
    'function _officersOf(){ return []; }',
    'function hwpFormHTML(){ return ""; }',   /* 원본 .hwp 는 없다 — 자동생성 쪽을 잰다 */
    grabDecl('_SIDO_ABBR'), grabFn('_addrParts'),
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('docBody'),
    'this.f=docBody;']);
  const html = b.f('agreement', { name: '가나공동근로복지기금', chairman: '홍길동', fund_type: '공동' },
    [{ name: '가나전자', ceo: '김대표', biz_no: '111-11-11111', urep_name: '박공장', wrep_name: '이노측' }]);
  assert.ok(html.indexOf('사용자대표') >= 0, '★ 별첨 명부에 사용자대표 열이 없습니다.');
  ['김대표', '박공장', '이노측'].forEach((n) => {
    assert.ok(html.indexOf(n) >= 0, '명부에 안 나옵니다: ' + n);
  });
  /* 대표자 열도 남아 있어야 한다 — 도장을 찍는 사람은 여전히 대표자다 */
  assert.ok(html.indexOf('대표자') >= 0, '★ 대표자 열이 사라졌습니다 — 날인할 사람이 서류에서 빠집니다.');
});

test('★★ ㉕ 사용자대표가 비면 밑줄로 남는다 — 대표자를 끌어다 쓰지 않는다', () => {
  const b = load([
    'function esc(s){ return String(s==null?"":s); }',
    'function dgV(v,n){ return v ? String(v) : "＿＿＿＿"; }',
    'function dgWon(n){ return String(n||0); }',
    'function dgToday(){ return "2026. 9. 13."; }',
    'function foundContrib(){ return 10000000; }',
    'function _officersOf(){ return []; }',
    'function hwpFormHTML(){ return ""; }',   /* 원본 .hwp 는 없다 — 자동생성 쪽을 잰다 */
    grabDecl('_SIDO_ABBR'), grabFn('_addrParts'),
    grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('docBody'),
    'this.f=docBody;']);
  const html = b.f('agreement', { name: '가나공동근로복지기금', fund_type: '공동' },
    [{ name: '가나전자', ceo: '김대표', biz_no: '111-11-11111' }]);
  /* 대표자 「김대표」가 «한 번만» 나와야 한다 — 두 번이면 사용자대표 칸에도 들어간 것이다 */
  assert.equal((html.match(/김대표/g) || []).length, 1,
    '★ 대표자를 사용자대표 칸에도 찍었습니다 — 아무도 정하지 않은 이름이 관청에 나갑니다.');
  assert.ok(html.indexOf('＿＿＿＿') >= 0, '빈 사용자대표 자리가 밑줄로 남지 않았습니다.');
});

test('★★ ⑲ 판독한 값이 갈 칸을 «갈래»가 정한다 — 중소기업은 sm-, 사용자대표는 사업장 칸이 아니다', () => {
  const sme = grabFn('_siteSmeScope');
  assert.match(sme, /pre:'sm-'/, '중소기업 판독값이 엉뚱한 칸으로 갑니다.');
  assert.match(sme, /fields:SME_FIELDS/);
  const bind = grabFn('bindSiteDocIntake');
  assert.match(bind, /dz-sitesme/, '중소기업확인서 끌어놓기 칸이 안 이어졌습니다.');
  assert.match(bind, /dz-siterep/, '재직증명서 끌어놓기 칸이 안 이어졌습니다.');
  /* ★ [👤 사람] 보기에서 여는 두 길도 «갈래를 먼저» 세워야 한다 —
     안 세우면 직전 갈래의 칸으로 값이 가서 조용히 아무 일도 안 일어난다. */
  assert.match(grabFn('pplSmeDoc'), /_siteSmeScope\(\)[\s\S]*openAlbumPick/, '사람 보기의 확인서 길이 갈래를 안 세웁니다.');
  assert.match(grabFn('pplRepDoc'), /_siteRepScope\(\)[\s\S]*openAlbumPick/, '사람 보기의 재직증명서 길이 갈래를 안 세웁니다.');
  /* 걷어 둔 값을 비운다 — 안 비우면 «직전 사업장»의 값이 딸려 들어간다 */
  assert.match(grabFn('pplSmeDoc'), /_siteDocKeep\s*=\s*null/, '★ 직전 사업장 값이 딸려 들어갑니다.');
  assert.match(grabFn('pplRepDoc'), /_siteDocKeep\s*=\s*null/, '★ 직전 사업장 값이 딸려 들어갑니다.');
});
