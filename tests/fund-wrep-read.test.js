/* 재직증명서 판독 — 참여사업장 근로자대표 이름이 손으로 치지 않고 들어온다
 *
 * 대표 지시 2026-09-11:
 *   「참여 기업 근로자·사용자 재직증명서 등을 OCR 해서 모두 자동으로 데이터가 입력되게」
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 상호·사람 이름·번호 금지. 여기 자료는 전부 가짜다.
 *
 * 이 검사가 지키는 것
 *  ① **주민등록번호를 읽지 않는다** — 재직증명서에 적혀 있어도 가져오지 않는다
 *  ② 못 읽은 칸은 «넣지 않는다» — 빈 칸이 틀린 이름보다 낫다
 *  ③ 판독값이 «근로자대표 칸»(sw-)으로 간다 — 사업장 칸(se-)도 기금 칸(fd-)도 아니다
 *  ④ 발급 회사는 «확인용»이다 — 사업장 상호를 증명서 글자로 덮어쓰지 않는다
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
    grabFn('_flat'), grabFn('_loose'), grabFn('_cleanCoName'), grabFn('_cleanBizWord'),
    grabDecl('WREP_STOP'), grabFn('_wrepStopRe'), grabFn('parseWrepDoc'),
    'this.parse=parseWrepDoc;',
  ].join('\n')).call(box);
  return box;
})();

/* 아래 글은 실제 재직증명서가 아니라 «판독기를 시험하려고 지어낸» 글이다.
   사람 이름·회사 이름·번호 모두 가짜다(이 저장소는 공개된다). */
const DOC = `재 직 증 명 서
성    명 : 김보람
생년월일 : 1985. 03. 12.
소    속 : 생산1팀
직    위 : 팀장
재직기간 : 2015. 03. 02. ~ 현재
위와 같이 재직하고 있음을 증명합니다.
2026년 9월 11일
주식회사 가나다산업
대표이사 홍길동 (인)`;

test('재직증명서에서 성명·직위·생년월일을 읽는다', () => {
  const o = API.parse(DOC);
  assert.equal(o.wrep_name, '김보람');
  assert.equal(o.wrep_title, '팀장');
  assert.equal(o.wrep_birth, '1985-03-12');
  assert.ok(/가나다산업/.test(o.wrep_co || ''), '발급 회사: ' + o.wrep_co);
});

test('★ 주민등록번호는 읽지 않는다 — 적혀 있어도 가져오지 않는다', () => {
  const withRrn = DOC.replace('생년월일 : 1985. 03. 12.', '주민등록번호 : 850312-1234567');
  const o = API.parse(withRrn);
  assert.equal(o.wrep_birth, undefined, '주민번호에서 생년월일을 캐냈다');
  const vals = Object.keys(o).map((k) => String(o[k]));
  vals.forEach((v) => {
    assert.ok(!/\d{6}\s*-\s*\d{7}/.test(v), '주민번호가 값에 섞여 나왔다: ' + v);
    assert.ok(!/1234567/.test(v), '주민번호 뒷자리가 새어 나왔다: ' + v);
  });
});

test('★ 주민번호와 생년월일이 «둘 다» 있어도 생년월일만 읽는다', () => {
  const both = DOC.replace('소    속 : 생산1팀', '주민등록번호 : 850312-1234567\n소    속 : 생산1팀');
  const o = API.parse(both);
  assert.equal(o.wrep_birth, '1985-03-12');
  assert.ok(!/1234567/.test(JSON.stringify(o)), '주민번호가 새어 나왔다');
});

test('판독기 어디에도 주민번호를 캐내는 규칙이 없다', () => {
  const fn = grabFn('parseWrepDoc');
  assert.doesNotMatch(fn, /\\d\{6\}\s*\\s\*-/, '주민번호 꼴을 찾는 규칙이 있다');
  assert.doesNotMatch(fn, /주민/, '주민등록번호를 읽는 규칙이 있다');
});

test('못 읽은 칸은 넣지 않는다 — 빈 칸이 틀린 이름보다 낫다', () => {
  const o = API.parse('재 직 증 명 서\n성    명 : 김보람');
  assert.equal(o.wrep_name, '김보람');
  assert.equal(o.wrep_title, undefined);
  assert.equal(o.wrep_birth, undefined);
});

test('빈 글·잡음에도 무너지지 않는다', () => {
  assert.deepEqual(API.parse(''), {});
  assert.deepEqual(API.parse(null), {});
  assert.ok(typeof API.parse('※ ▨ ▧ !!!') === 'object');
});

test('OCR 잡음(글자 사이 공백·점)이 껴도 읽는다', () => {
  const noisy = '재 직 증 명 서\n성 _ 명 : 김보람\n직 . 위 : 팀장\n생 년 월 일 : 1985.03.12';
  const o = API.parse(noisy);
  assert.equal(o.wrep_name, '김보람');
  assert.equal(o.wrep_title, '팀장');
  assert.equal(o.wrep_birth, '1985-03-12');
});

test('읽는 칸 이름이 «근로자대표 칸»과 같다', () => {
  const o = API.parse(DOC);
  const wrepKeys = [...grabDecl('WREP_FIELDS').matchAll(/\['([a-z_0-9]+)','/g)].map((m) => m[1]);
  Object.keys(o).forEach((k) => {
    if (k === 'wrep_co') return;                     // 확인용 — 칸이 아니다
    assert.ok(wrepKeys.includes(k), '근로자대표에 없는 칸으로 읽었다: ' + k);
  });
});

test('★ 발급 회사는 «칸이 아니다» — 근로자대표 칸 목록에 없다', () => {
  const wrepKeys = [...grabDecl('WREP_FIELDS').matchAll(/\['([a-z_0-9]+)','/g)].map((m) => m[1]);
  assert.ok(!wrepKeys.includes('wrep_co'), '확인용 값에 칸을 만들면 사업장 상호를 덮어쓴다');
  assert.match(grabDecl('DOC_EXTRA_LBL'), /wrep_co/, '이름표가 없으면 확인 창에 열쇠 이름이 그대로 뜬다');
});

test('★ 반영할 때 발급 회사는 «넣지 않는다»', () => {
  const fn = grabFn('applyDocFound');
  assert.match(fn, /if\(k!=='wrep_co'\) pre\[k\]=_docFound\[k\]/, '발급 회사를 사업장에 넣는다');
  assert.match(fn, /got=got\.filter\(function\(k\)\{ return k!=='wrep_co'; \}\)/,
    '넣지도 않은 것을 「채웠다」고 센다');
});

/* ══════════ 어디로 가는가 ══════════ */

test('판독값이 근로자대표 칸(sw-)으로 간다', () => {
  const fn = grabFn('_siteRepScope');
  assert.match(fn, /pre:'sw-'/);
  assert.match(fn, /fields:WREP_FIELDS/);
  assert.match(fn, /keep:false/, '재직증명서를 «기금» 서류로 매달면 안 된다');
});

test('사업장 창 갈래를 «둘 다» 본다 — 한쪽만 보면 재직증명서가 기금 칸을 찾는다', () => {
  const fn = grabFn('_isSiteScope');
  assert.match(fn, /'se-'/);
  assert.match(fn, /'sw-'/);
  ['openDocConfirm', 'applyDocFound'].forEach((n) => {
    assert.match(grabFn(n), /_isSiteScope\(\)/, n + ' 이 한쪽 갈래만 본다');
  });
});

test('DOC_PARSE 에 재직증명서가 등록돼 있다 — 없으면 판독 자체가 안 돈다', () => {
  assert.match(grabDecl('DOC_PARSE'), /wrep:\{label:'근로자대표 재직증명서',fn:parseWrepDoc\}/);
});

test('파일로 올리는 길과 사진첩 길이 «둘 다» 재직증명서 갈래를 켠다', () => {
  assert.match(grabFn('bindSiteDocIntake'), /dz-siterep'\]=function\(files\)\{ _siteRepScope\(\); readDocInto\('dz-siterep','wrep'/);
  assert.match(grabFn('siteRepAlbum'), /_siteRepScope\(\)/);
  assert.match(grabFn('pickWrepDoc'), /_siteRepScope\(\)/, '옛 단추가 갈래를 안 켜면 판독이 기금 칸으로 간다');
});

test('★ 사진첩 갈래가 원본을 잇고 «판독도» 한다 — 종전에는 잇기만 했다', () => {
  const fn = grabFn('pickAlbumPhoto');
  const i = fn.indexOf('if(_pick.wrep)');
  assert.ok(i >= 0);
  const seg = fn.slice(i, i + 1200);
  assert.match(seg, /saveWrepDocRef\(fid,_ws,\{owner:owner\|\|'',year:year,id:id\},true\)/, '원본을 안 잇는다');
  assert.match(seg, /readDocInto\(_wz,'wrep',file,true\)/, '판독을 안 한다');
});

test('★ 이을 때 편집 창을 다시 열지 않는다 — 창은 겹쳐 뜨지 않는다', () => {
  const fn = grabFn('saveWrepDocRef');
  assert.match(fn, /if\(!keepOpen\)\{ toast\([^)]*\); editSite\(sid\); \}/,
    'keepOpen 인데 편집 창을 다시 열면 확인 창이 뒤 창을 지운다');
});

test('아직 저장 전인 사업장도 «읽기»는 된다 — 이을 자리만 없다', () => {
  const fn = grabFn('_wrepDocRow');
  assert.doesNotMatch(fn, /if\(!sid\) return/, '저장 전이면 아예 못 읽게 막는다');
  assert.match(fn, /siteRepAlbum\(\)/);
  assert.match(fn, /dz-siterep/);
});

test('발급 회사가 이 사업장과 다르면 알리되 «막지는 않는다»', () => {
  const fn = grabFn('openDocConfirm');
  assert.match(fn, /k==='wrep_co'&&_siteNm&&_coNorm\(_docFound\[k\]\)!==_coNorm\(_siteNm\)/,
    '다른 회사의 증명서인지 알려 주지 않는다');
  assert.doesNotMatch(fn, /return;\s*\/\/ 회사 다름/, '막으면 안 된다 — 상호가 옛것인 증명서가 흔하다');
});

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(SRC.includes("hlp('wrep.read')"), '쓰는 곳이 없는 도움말이다');
  assert.ok(help.includes("'wrep.read':{"), '등록되지 않은 도움말 열쇠다');
});

test('도움말이 «주민번호를 안 읽는다»고 말한다 — 사람이 믿고 올릴 수 있어야 한다', () => {
  const help = SRC.slice(SRC.indexOf("'wrep.read':{"), SRC.indexOf("'name.temp':{"));
  assert.match(help, /주민등록번호는 읽지 않습니다/);
});

test('같은 이름 함수를 두 번 선언하지 않았다 — 나중 것이 이겨 조용히 깨진다', () => {
  const names = [...SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  names.forEach((n) => { if (seen.has(n)) dup.add(n); else seen.add(n); });
  assert.deepEqual([...dup], [], '중복 선언: ' + [...dup].join(', '));
});

/* ══════════ 「정말 그려」 본다 ══════════ */

test('사업장 편집 창을 정말 그리면 재직증명서 줄이 성하게 나온다', () => {
  const box = {}, out = { html: '' };
  new Function('OUT', [
    grabDecl('SITE_FIELDS'), grabDecl('CONTACT_FIELDS'), grabDecl('WREP_FIELDS'),
    'var _sitePrefill=null, _siteEditSid="";',
    'var S={fundId:"F1",sites:{}};',
    'function $(id){ return null; }',
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    'function showModal(h){ OUT.html+=h; }',
    'function bindSiteDocIntake(){}',
    grabFn('dropZoneSlim'), grabFn('_primaryContact'), grabFn('_wrepDocRow'), grabFn('editSite'),
    'this.run=editSite;',
  ].join('\n')).call(box, out);
  ['S1', ''].forEach((sid) => {
    out.html = '';
    box.run(sid);
    const h = out.html;
    assert.ok(h.includes('siteRepAlbum()'), sid + ': 사진첩 단추가 없다');
    assert.ok(h.includes('id="dz-siterep"'), sid + ': 파일 올리는 자리가 없다');
    assert.ok(h.includes('id="sw-wrep_name"'), sid + ': 근로자대표 이름 칸이 없다');
    assert.ok(!/\+[A-Za-z_$][\w$]*\+/.test(h), sid + ': 보간되지 않은 변수가 새어 나왔다');
    assert.ok(!/undefined/.test(h), sid + ': undefined 가 샜다');
  });
});
