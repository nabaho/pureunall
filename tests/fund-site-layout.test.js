'use strict';
/* 참여사업장 편집 재구성 — 상자 구분 · 열맞춤 · 우편번호 검색
 * (대표 지시 2026-09-21 「참여사업장을 좀 정리하고 싶다. 기업정보, 대표자담당자,
 *   사용자대표근로자대표 화면상으로 구분해서 정리하고 싶다 … 항상 주소는 우편번호를
 *   찾을수 있게 셀 검색 셀 형태로 만들어라」 — 목업 9종을 거쳐 승인)
 *
 * ▣ 왜 표(reptable)로 만들었나 — 「대표자와 담당자 각각 열을 일치시켜라」
 *   「사용자 대표 근로자대표 성명 직위 생년월일 등도 열을 일치시켜라」. 대표자는 이름 하나뿐이라
 *   직위·연락처·이메일 자리가 빈다 — 자료를 지어내지 않고 빈 자리(rmiss)로 보여 준다.
 *   사용자대표·근로자대표는 원래 자료가 대칭(성명·직위·휴대폰·생년월일)이라 빈 자리가 없다.
 *
 * ▣ 왜 우편번호 검색을 pu-erp.html 에서 «그대로» 들여왔나 — 이미 검증된 것을 새로 만들지
 *   않는다. 다음(Daum) 우편번호 서비스는 사람이 «공개 주소»를 고르는 것뿐이라 개인정보·
 *   기금 자료를 어디로도 보내지 않는다.
 *
 * ▣ 왜 사업장 소재지는 「걷어두기→닫기→다시 열기」를 쓰나 — 이 파일의 기존 관례
 *   (openDocConfirm·applyDocFound)와 같다. 창은 겹쳐 뜨지 않는다(closeM 은 첫 #modalbg 만
 *   지운다) — 겹쳐 띄우면 뒤 창이 지워진다.
 *
 * ▣ 왜 기금 자체 소재지는 곧바로 채우나 — infoForm 은 모달이 아니라 페이지 안 폼이라
 *   겹쳐 띄워도 걷어둘 것이 없다. 관할 노동청·세무서·등기소 추정이 이 값을 읽으므로
 *   정확한 도로명주소일수록 낫다.
 *
 * ▣ 왜 SITE_FIELDS/FIELDS 배열 순서를 안 바꿨나 — SITE_FIELDS 는 엑셀 일괄 가져오기의
 *   «열 차례»다. zipcode 는 맨 뒤에 붙였다(2026-09-10 biz_item 등과 같은 규칙).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

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
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
/* grabDecl 은 "var NAME=[...];" 를 통째로 돌려준다 — 배열 «값»만 평가하려면 var/이름/= 를 걷어낸다 */
function declArray(name) {
  const decl = grabDecl(name);
  const eq = decl.indexOf('=');
  return new Function('return ' + decl.slice(eq + 1, -1))();
}

/* ══ ① SITE_FIELDS·FIELDS — 자리가 맞는가 ══════════════════════════ */

test('★★ ① zipcode 는 SITE_FIELDS 맨 뒤에 있다 — 가운데 끼우면 엑셀 열이 밀린다', () => {
  const arr = declArray('SITE_FIELDS');
  assert.equal(arr[arr.length - 1][0], 'zipcode', '★ zipcode 가 맨 뒤가 아닙니다.');
  assert.ok(!/wrep_|urep_/.test(grabDecl('SITE_FIELDS')), '★ 사람 칸이 SITE_FIELDS 에 섞였습니다 — 엑셀 열이 밀립니다.');
});

test('★ zipcode 는 FIELDS(기금 자체)에도 있다 — address 바로 옆', () => {
  const arr = declArray('FIELDS');
  const ai = arr.findIndex((c) => c[0] === 'address');
  const zi = arr.findIndex((c) => c[0] === 'zipcode');
  assert.ok(ai >= 0 && zi === ai + 1, '★ zipcode 가 address 바로 다음에 없습니다.');
});

/* ══ ② _repTable — 열맞춤 표 ══════════════════════════════════════ */

function loadRepTable() {
  const box = {};
  new Function(['function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    grabFn('_repTable'), 'this.t=_repTable;'].join('\n')).call(box);
  return box.t;
}

test('★★ ② 칸 수만큼 열을 만든다', () => {
  const t = loadRepTable();
  const html2 = t(['A', 'B'], [['줄1', ['<x/>', '<y/>']]]);
  const html3 = t(['A', 'B', 'C'], [['줄1', ['<x/>', '<y/>', '<z/>']]]);
  assert.match(html2, /grid-template-columns:64px repeat\(2,1fr\)/, '★ 2칸일 때 열 수가 다릅니다.');
  assert.match(html3, /grid-template-columns:64px repeat\(3,1fr\)/, '★ 3칸일 때 열 수가 다릅니다.');
});

test('★★ ③ 줄이름은 왼쪽 rl 칸, 머리글은 rh 칸에 들어간다', () => {
  const t = loadRepTable();
  const html = t(['대표자', '담당자'], [['이름', ['<input id="a">', '<input id="b">']]]);
  assert.match(html, /<div class="rh">대표자<\/div>/, '★ 머리글이 없습니다.');
  assert.match(html, /<div class="rl">이름<\/div>/, '★ 줄이름이 없습니다.');
  assert.match(html, /<input id="a">/, '★ 첫 칸 내용이 없습니다.');
  assert.match(html, /<input id="b">/, '★ 둘째 칸 내용이 없습니다.');
});

test('★ 머리글·줄이름은 esc() 를 거친다 — 남의 글자가 그대로 안 박힌다', () => {
  const t = loadRepTable();
  const html = t(['<b>x</b>'], [['<i>y</i>', ['z']]]);
  assert.ok(!html.includes('<b>x</b>'), '★ 머리글이 이스케이프되지 않았습니다.');
  assert.ok(!html.includes('<i>y</i>'), '★ 줄이름이 이스케이프되지 않았습니다.');
});

/* ══ ③ _addrStack — 소재지 위젯 ══════════════════════════════════ */

function loadAddrStack() {
  const box = {};
  new Function(['function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }',
    grabFn('_addrStack'), 'this.a=_addrStack;'].join('\n')).call(box);
  return box.a;
}

test('★★ ④ 우편번호는 읽기전용, 도로명주소는 이어 적을 수 있다 — A안(2줄)', () => {
  const a = loadAddrStack();
  const html = a('se-', { zipcode: '12345', address: '충남 예산군' }, 'siteAddrSearch');
  assert.match(html, /<input id="se-zipcode" type="text" value="12345" readonly/, '★ 우편번호 칸이 다릅니다.');
  const addrInput = /<input id="se-address"[^>]*>/.exec(html)[0];
  assert.ok(!/readonly/.test(addrInput), '★ 도로명주소를 읽기전용으로 막았습니다 — 이어 적을 수 없습니다.');
  assert.match(addrInput, /value="충남 예산군"/, '★ 도로명주소 값이 안 들어갑니다.');
});

test('★★ ⑤ [검색] 단추가 넘겨받은 함수 이름을 그대로 부른다', () => {
  const a = loadAddrStack();
  const html = a('fd-', {}, 'fdAddrSearch');
  assert.match(html, /onclick="fdAddrSearch\(\)"/, '★ 검색 단추가 다른 함수를 부릅니다.');
});

test('★ 접두(prefix)가 다르면 id 도 따라간다 — se-/fd- 가 섞이지 않는다', () => {
  const a = loadAddrStack();
  const h1 = a('se-', {}, 'x'), h2 = a('fd-', {}, 'x');
  assert.match(h1, /id="se-zipcode"/); assert.match(h1, /id="se-address"/);
  assert.match(h2, /id="fd-zipcode"/); assert.match(h2, /id="fd-address"/);
});

/* ══ ④ editSite — 상자·표를 실제로 그린다 ═══════════════════════ */

function renderEditSite(sid, s) {
  const out = { html: '' };
  const box = {};
  new Function('OUT', 'SITE', [
    grabDecl('SITE_FIELDS'), grabDecl('CONTACT_FIELDS'), grabDecl('WREP_FIELDS'),
    grabDecl('UREP_FIELDS'), grabDecl('SME_FIELDS'), grabDecl('SME_OPTS'),
    grabFn('_siteUrep'), grabFn('_siteSme'), grabFn('_smeChip'),
    'var _sitePrefill=null, _siteEditSid="";',
    'var S={fundId:"F1",sites:{S1:SITE}};',
    'function $(id){ return null; }',
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    'function showModal(h){ OUT.html=h; }',
    'function bindSiteDocIntake(){}',
    grabFn('dropZoneSlim'), grabFn('_primaryContact'), grabFn('_wrepDocRow'),
    grabFn('_repTable'), grabFn('_addrStack'), grabFn('editSite'),
    'this.run=editSite;',
  ].join('\n')).call(box, out, s || {});
  box.run(sid);
  return out.html;
}

test('★★ ⑥ 네 상자가 모두 그려진다', () => {
  const h = renderEditSite('S1', {});
  ['기업정보', '대표자', '담당자', '사용자 대표', '근로자 대표', '중소기업'].forEach((t) => {
    assert.ok(h.includes(t), '★ 「' + t + '」가 화면에 없습니다.');
  });
  const boxCount = (h.match(/class="secbox"/g) || []).length;
  assert.equal(boxCount, 4, '★ 상자가 4개가 아닙니다(기업정보·대표자담당자·사용자대표근로자대표·중소기업) — ' + boxCount + '개');
});

test('★★ ⑦ 대표자·담당자 — 대표자는 이름만, 나머지는 빈 자리(rmiss)로 보인다', () => {
  const h = renderEditSite('S1', { ceo: '홍길동' });
  assert.match(h, /<input id="se-ceo" type="text" value="홍길동">/, '★ 대표자 이름 칸이 다릅니다.');
  /* 대표자 열에는 직위·연락처·이메일 칸(su-/sc- 아닌 대표자 전용 id)이 없다 —
     rmiss 딱지가 대신 세 번 나와야 한다(직위·연락처·이메일). */
  const rmissCount = (h.match(/class="rmiss"/g) || []).length;
  assert.equal(rmissCount, 3, '★ 대표자의 빈 자리가 3개가 아닙니다 — ' + rmissCount + '개');
});

test('★★ ⑧ 담당자 값은 CONTACT_FIELDS 규칙 그대로(휴대폰 비면 옛 phone 을 보여준다)', () => {
  const h = renderEditSite('S1', { contacts: [{ name: '이담당', phone: '031-000-0000', isPrimary: true }] });
  assert.match(h, /<input id="sc-name" type="text" value="이담당">/, '★ 담당자 이름이 안 옮겨졌습니다.');
  assert.match(h, /<input id="sc-mobile" type="text" value="031-000-0000">/,
    '★ 휴대폰이 비었을 때 옛 phone 값을 보여주지 않습니다 — 종전 규칙이 깨졌습니다.');
});

test('★★ ⑨ 사용자대표·근로자대표 — 자료가 대칭이라 빈 자리(rmiss)가 없다', () => {
  const h = renderEditSite('S1', {
    urep_name: '김대표', urep_title: '실장', urep_mobile: '010-1', urep_birth: '1980-01-01',
    wrep_name: '박노측', wrep_title: '대리', wrep_mobile: '010-2', wrep_birth: '1990-02-02',
  });
  ['su-urep_name', 'su-urep_title', 'su-urep_mobile', 'su-urep_birth',
   'sw-wrep_name', 'sw-wrep_title', 'sw-wrep_mobile', 'sw-wrep_birth'].forEach((id) => {
    assert.ok(h.includes('id="' + id + '"'), '★ ' + id + ' 칸이 없습니다.');
  });
  assert.match(h, /<input id="sw-wrep_birth" type="date" value="1990-02-02">/,
    '★ 생년월일 칸 type 이 date 가 아니거나 값이 안 들어갑니다.');
});

test('★ 사용자대표 «성명» 줄이름은 필드 원래 라벨("사용자대표 성명")이 아니라 "성명"으로 줄인다', () => {
  const h = renderEditSite('S1', {});
  assert.ok(h.includes('<div class="rl">성명</div>'), '★ 줄이름이 "성명"으로 안 줄었습니다.');
  assert.ok(!h.includes('사용자대표 성명'), '★ 표 안에 원래 긴 라벨이 그대로 남았습니다 — 칸 폭을 잡아먹습니다.');
});

test('★★ ⑩ 대표자와 같은 사람 체크 — 성명 칸이 대표자를 따라가고 잠긴다', () => {
  const h = renderEditSite('S1', { ceo: '홍길동', urep_same: true });
  const m = /<input id="su-urep_name"[^>]*>/.exec(h)[0];
  assert.match(m, /value="홍길동"/, '★ 체크했는데 대표자 이름을 안 따라갑니다.');
  assert.match(m, /readonly/, '★ 체크했는데 칸이 안 잠깁니다.');
});

test('★★ ⑪ 소재지는 addrStack 위젯이고, se-address 가 sales 다음(원래 자리)에서 여전히 채워진다', () => {
  const h = renderEditSite('S1', { sales: '1000', address: '서울 강남구', zipcode: '06000' });
  assert.match(h, /id="se-zipcode"[^>]*value="06000"/, '★ 우편번호가 안 채워집니다.');
  assert.match(h, /id="se-address"[^>]*value="서울 강남구"/, '★ 도로명주소가 안 채워집니다.');
  assert.match(h, /onclick="siteAddrSearch\(\)"/, '★ 사업장 소재지 검색 단추가 다른 함수를 부릅니다.');
});

test('★★ ⑫ 기업규모·중소기업 확인서 출처 딱지는 그대로 남는다(회귀 방지)', () => {
  const h = renderEditSite('S1', {});
  assert.ok(h.includes('기업정보함</span>') && h.includes('확인서</span>'),
    '★ 두 칸의 출처 딱지가 사라졌습니다.');
});

/* ══ ⑤ CSS — 상자 안에서만 라벨이 작아진다 ═══════════════════════ */

test('★★ ⑬ .secbox 안에서만 라벨이 작다 — 전역 .fld label 은 그대로 둔다', () => {
  assert.match(SRC, /\.fld label\{font-size:11\.5px;color:var\(--sub\);font-weight:600\}/,
    '★ 전역 .fld label 크기가 바뀌었습니다 — 앱 전체 라벨이 다 작아집니다.');
  assert.match(SRC, /\.secbox \.fld label\{font-size:9\.5px/,
    '★ .secbox 안에서 라벨을 작게 하는 규칙이 없습니다.');
});

/* ══ ⑥ openAddressSearch — 계약(contract) ═══════════════════════ */

test('★★ ⑭ daum.Postcode 가 없으면 조용히 죽지 않고 안내한다', () => {
  /* new Function 이 만든 함수는 바깥 변수를 닫지(closure) 않는다 — toast 를 인자로 넘긴다 */
  const calls = [];
  const box = {};
  new Function('toast', ['var daum=undefined;',
    grabFn('openAddressSearch'), 'this.run=openAddressSearch;'].join('\n'))
    .call(box, function (m, t) { calls.push([m, t]); });
  let threw = false;
  try { box.run(function(){}); } catch (e) { threw = true; }
  assert.ok(!threw, '★ daum 이 없을 때 그냥 죽습니다.');
  assert.ok(calls.some((c) => c[1] === 'err'), '★ 네트워크 문제를 안내하지 않습니다.');
});

test('★★ ⑮ 고르면 zipcode·address·roadAddress·jibunAddress 를 콜백에 넘긴다', () => {
  let got = null;
  const box = {};
  new Function([
    'function toast(){}',
    'var document={ createElement:function(){ return { style:{}, appendChild:function(){}, }; }, body:{ appendChild:function(){} } };',
    'var daum={ Postcode:function(opt){ this._opt=opt; this.embed=function(){ opt.oncomplete({ zonecode:"12345", roadAddress:"서울 강남구", jibunAddress:"서울 강남구 1", address:"서울 강남구" }); }; } };',
    grabFn('openAddressSearch'),
    'this.run=openAddressSearch;'
  ].join('\n')).call(box);
  box.run(function(r) { got = r; });
  assert.deepEqual(got, { zipcode: '12345', address: '서울 강남구', roadAddress: '서울 강남구', jibunAddress: '서울 강남구 1' },
    '★ 콜백에 넘어온 값이 다릅니다: ' + JSON.stringify(got));
});

test('★ 건물명이 있고 아파트면 주소 뒤에 괄호로 덧붙인다', () => {
  let got = null;
  const box = {};
  new Function([
    'function toast(){}',
    'var document={ createElement:function(){ return { style:{}, appendChild:function(){} }; }, body:{ appendChild:function(){} } };',
    'var daum={ Postcode:function(opt){ this.embed=function(){ opt.oncomplete({ zonecode:"1", roadAddress:"주소", buildingName:"타워", apartment:"Y" }); }; } };',
    grabFn('openAddressSearch'), 'this.run=openAddressSearch;'
  ].join('\n')).call(box);
  box.run(function(r) { got = r; });
  assert.equal(got.address, '주소 (타워)', '★ 건물명을 안 붙입니다: ' + got.address);
});

/* ══ ⑦ siteAddrSearch / fdAddrSearch — 배선 ═══════════════════════ */

test('★★ ⑯ 사업장 소재지 검색 — 걷어두기 → 닫기 → 다시 열기 차례를 지킨다', () => {
  const src = 코드만(grabFn('siteAddrSearch'));
  const 걷기 = src.indexOf('_siteDocGrab()'), 닫기 = src.indexOf('closeM()'), 열기 = src.indexOf('editSite(');
  assert.ok(걷기 >= 0 && 닫기 > 걷기 && 열기 > 닫기,
    '★ 「걷어두기 → 닫기 → 다시 열기」 차례가 아닙니다 — 겹쳐 뜬 창이 지워지거나 값을 잃습니다.');
  assert.match(src, /openAddressSearch\(/, '★ 주소 검색을 안 엽니다.');
});

test('★★ ⑰ 기금 자체 소재지 검색 — 모달이 아니라 바로 채운다(걷어두기 불필요)', () => {
  const src = 코드만(grabFn('fdAddrSearch'));
  assert.ok(!/closeM\(\)|_siteDocGrab/.test(src),
    '★ 페이지 안 폼인데 모달 걷어두기·닫기를 흉내 냅니다 — 불필요한 코드입니다.');
  assert.match(src, /\$\('fd-zipcode'\)/); assert.match(src, /\$\('fd-address'\)/);
  assert.match(src, /markDirty\(\)/, '★ 채운 뒤 고침 표시를 안 합니다 — 저장 안 하고 나가도 모릅니다.');
});
