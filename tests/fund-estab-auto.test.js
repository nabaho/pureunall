/* 설립 서류 자동화 — 사업장 한 번 정리 → 후속 서류가 따라온다
 *
 * 대표 지시 2026-09-10:
 *   「설립시 필요서류를 번호순서대로 둔 것처럼, 사업장 데이터를 사진첩에서 OCR 하고
 *    기업정보함에 저장된 자료를 번호순서대로 필요내용이 자동으로 입력되고
 *    입력된 것을 출력해서 날인할 수 있도록 자동화가 필요하다」
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 상호·번호·금액 금지. 여기 자료는 전부 가짜다.
 *
 * 이 검사가 지키는 것
 *  ① 출연금은 «한 줄기»다 — 한글본·엑셀본·합의서·회의록·등기가 같은 자를 쓴다
 *  ② 서식이 읽는 값은 «넣을 칸»이 있어야 한다 (배관 양 끝)
 *  ③ 자리표(○○주식회사)를 채우는 일은 걷어내기(stripBaked)보다 «먼저» 돈다
 *  ④ 사업장 판독 결과가 기금 칸이 아니라 «사업장 칸»으로 간다
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
/* 여러 조각을 한 그릇에 담아 돌린다 — fund.html 의 «진짜» 코드를 그대로 쓴다(옮겨 적지 않는다) */
function build(parts, extra) {
  return new Function('return (function(){' + (extra || '') + parts.join('\n') +
    ';return {' + PICK.join(',') + '};})()')();
}
const PICK = ['estabSites', 'siteContribOf', 'foundContribOf', 'foundContrib',
  'partyNames', 'partyJoin', '_blankCount', 'parseBizReg'];

const NUM = `function num(v){ if(v==null||v==='')return ''; if(typeof v==='number')return Math.round(v);
  var s=String(v).replace(/[,\\s원]/g,''); if(!s||isNaN(Number(s)))return ''; return Math.round(Number(s)); }`;

const API = build([
  NUM,
  grabFn('estabSites'), grabFn('siteContribOf'), grabFn('foundContribOf'), grabFn('foundContrib'),
  grabFn('partyNames'), grabFn('partyJoin'), grabFn('_blankCount'),
  grabFn('_flat'), grabFn('_loose'), grabFn('_cleanAddr'), grabFn('_cleanCoName'),
  grabFn('_cleanBizWord'), grabFn('parseBizReg'),
]);

/* ══════════ ① 출연금은 한 줄기 ══════════ */

test('사업장에 적어 둔 약정액이 먼저 — 손으로 적은 총액보다 앞선다', () => {
  const f = { contribution_total: '99000000' };
  const sites = [{ name: '가나다', contrib: '3000000' }, { name: '라마바', contrib: '2000000' }];
  const r = API.foundContribOf(f, sites);
  assert.equal(r.amt, 5000000, '사업장 합계를 써야 한다');
  assert.equal(r.from, 'sites');
  assert.equal(r.n, 2);
});

test('사업장에 약정액이 하나도 없으면 사람수 × 단가로 어림하고 «어림»이라고 말한다', () => {
  const f = { contrib_per_worker: '400000' };
  const sites = [{ name: '가나다', company_size: '10' }, { name: '라마바', company_size: '5' }];
  const r = API.foundContribOf(f, sites);
  assert.equal(r.amt, 6000000);
  assert.equal(r.from, 'rate', '어림한 값임을 알려야 한다');
});

test('사업장이 비어 있으면 손으로 적은 총액을 쓴다', () => {
  const r = API.foundContribOf({ contribution_total: '7000000' }, []);
  assert.equal(r.amt, 7000000);
  assert.equal(r.from, 'manual');
});

test('아무것도 없으면 0 — 지어내지 않는다', () => {
  const r = API.foundContribOf({}, []);
  assert.equal(r.amt, 0);
  assert.equal(r.from, 'none');
});

test('탈퇴한 사업장은 빼고 센다 — 나간 회사의 출연 약정을 설립 서류에 적을 수 없다', () => {
  const sites = [{ name: '가나다', contrib: '3000000' },
                 { name: '라마바', contrib: '9000000', status: 'closed' }];
  assert.equal(API.foundContrib({}, sites), 3000000);
  assert.equal(API.estabSites(sites).length, 1);
});

test('사업장 한 곳 — 적어 둔 값이 먼저, 없으면 사람수 × 단가', () => {
  const f = { contrib_per_worker: '400000' };
  assert.equal(API.siteContribOf({ contrib: '1234000', company_size: '10' }, f), 1234000);
  assert.equal(API.siteContribOf({ company_size: '10' }, f), 4000000);
  assert.equal(API.siteContribOf({ company_size: '10' }, {}), 0, '단가가 없으면 0 — 지어내지 않는다');
  assert.equal(API.siteContribOf({}, f), 0);
});

test('한글본 확인서와 엑셀본 확인서가 «같은 자»를 쓴다', () => {
  const hwp = grabFn('fillFoundContribDoc');
  const xls = grabFn('fillContribXls');
  assert.match(hwp, /siteContribOf\(/, '한글본이 siteContribOf 를 써야 한다');
  assert.match(xls, /siteContribOf\(/, '엑셀본이 siteContribOf 를 써야 한다');
  assert.doesNotMatch(xls, /contrib_per_worker\)\|\|400000/,
    '엑셀본이 단가를 «따로» 셈하면 안 된다 — 두 확인서 금액이 갈린다');
});

test('설립 서류들이 f.contribution_total 을 «직접» 읽지 않는다 (한 줄기 우회 금지)', () => {
  const bad = [];
  ['charterGong', 'charterSane', 'fillDerived', 'docBody', 'fillSetup', 'fillSubsidy']
    .forEach((fn) => { if (/f\.contribution_total/.test(grabFn(fn))) bad.push(fn); });
  assert.deepEqual(bad, [], '이 함수들은 foundContrib(f,sites) 를 거쳐야 한다: ' + bad.join(', '));
});

/* ══════════ ② 서식이 읽는 값은 «넣을 칸»이 있어야 한다 (배관 양 끝) ══════════ */

const FIELD_KEYS = (() => {
  const keys = [];
  const re = /\['([a-z_0-9]+)','[^']*',(?:'text'|'date'|'select'|'num')\]/g;
  let m; const decl = grabDecl('FIELDS');
  while ((m = re.exec(decl))) keys.push(m[1]);
  return keys;
})();

test('설립 서식이 읽는 값 열 가지가 모두 기금 정보에 «칸»으로 있다', () => {
  /* 2026-09-10 이전에는 이 열 가지가 화면에도 일괄 가져오기에도 없어, 새로 세우는 기금에서
     합의서·회의록·정관·등기신청서·사업자등록신청서가 통째로 빈칸으로 나갔다. */
  ['contribution_total', 'contrib_per_worker', 'rep_org', 'estab_date', 'meeting_date',
   'meeting_place', 'rep_position', 'worker_rep', 'fy_start_md', 'fy_end_md']
    .forEach((k) => {
      assert.ok(FIELD_KEYS.includes(k), '넣을 칸이 없다: ' + k);
      assert.ok(new RegExp('f\\.' + k + '\\b').test(SRC) || new RegExp('\\)\\.' + k + '\\b').test(SRC),
        '읽는 곳이 없는 칸이다(죽은 칸): ' + k);
    });
});

test('저장·화면이 FIELDS 하나만 본다 — 칸을 늘리면 저절로 저장된다', () => {
  const save = grabFn('saveInfo'), form = grabFn('infoForm');
  assert.match(save, /FIELDS\.forEach/, 'saveInfo 가 FIELDS 를 돌아야 한다');
  assert.match(form, /FIELDS\.map/, 'infoForm 이 FIELDS 를 그려야 한다');
});

test('묶음 머리 「설립」이 실제 FIELDS 칸을 가리킨다', () => {
  const secs = grabDecl('INFO_SECS');
  assert.match(secs, /contribution_total:/, 'INFO_SECS 에 설립 묶음이 있어야 한다');
  assert.ok(FIELD_KEYS.includes('contribution_total'));
});

/* ══════════ ③ 참여사업장 자리표 채우기 ══════════ */

test('회사 이름 열거 — 「가, 나 및 다」', () => {
  assert.equal(API.partyJoin([]), '');
  assert.equal(API.partyJoin(['가나']), '가나');
  assert.equal(API.partyJoin(['가나', '다라']), '가나 및 다라');
  assert.equal(API.partyJoin(['가나', '다라', '마바']), '가나, 다라 및 마바');
});

test('열거 대상은 탈퇴하지 않은 사업장의 «이름 있는» 것만', () => {
  const sites = [{ name: '가나' }, { name: '' }, { name: '다라', status: 'closed' }, { name: '마바' }];
  assert.deepEqual(API.partyNames(sites), ['가나', '마바']);
});

test('자리표 채우기가 걷어내기보다 «먼저» 돈다', () => {
  const fn = grabFn('hwpFormHTML');
  const at = fn.indexOf('fillPartyList');
  const strip = fn.indexOf('stripBaked(d)');
  assert.ok(at >= 0, 'hwpFormHTML 이 fillPartyList 를 불러야 한다');
  assert.ok(at < strip, '걷어내기 뒤에 돌면 자리표가 이미 ＿＿＿ 로 바뀌어 못 찾는다');
});

test('정관과 설립합의서 «둘 다» 자리표를 채운다', () => {
  const fn = grabFn('hwpFormHTML');
  const line = fn.split('\n').filter((l) => l.includes('fillPartyList')).join(' ');
  assert.match(line, /charter/, '정관이 빠지면 제3조·제4조가 ○○ 로 나간다');
  assert.match(line, /agreement/, '설립합의서가 빠지면 서명란이 ○○ 로 나간다');
});

test('자리표를 알아보는 규칙이 ○○ 와 XX 를 모두 본다 — 원본이 둘 다 쓴다', () => {
  const src = SRC.match(/var PARTY_ONE_SRC='([^']+)'/);
  assert.ok(src, 'PARTY_ONE_SRC 가 있어야 한다');
  const re = new RegExp(src[1].replace(/\\\\/g, '\\'));   // 소스의 \\s 를 실제 \s 로
  assert.ok(re.test('○○주식회사'));
  assert.ok(re.test('XX주식회사'));
  assert.ok(re.test('○○회사'));
  assert.ok(!re.test('× × ×'), '이름 자리표(× × ×)를 회사로 보면 안 된다');
});

test('사업장이 없으면 손대지 않는다 — 자리표가 틀린 이름보다 낫다', () => {
  const fn = grabFn('fillPartyList');
  assert.match(fn, /if\(!list\.length\) return 0/, '사업장이 없으면 곧바로 물러나야 한다');
  assert.match(fn, /if\(!names\.length\) return 0/, '이름이 없으면 곧바로 물러나야 한다');
});

test('설립 날짜 자리표는 «값이 있을 때만» 채운다 — 없던 회의를 만들지 않는다', () => {
  const fn = grabFn('fillPartyDates');
  assert.match(fn, /if\(dot\)/, '회의일이 없으면 그 자리는 건드리지 않아야 한다');
});

/* ══════════ ④ 번호 차례 묶음 · 빈칸 세기 ══════════ */

test('채울 자리 세기 — 밑줄·회사 자리표를 센다', () => {
  assert.equal(API._blankCount('금액 ＿＿＿＿＿ 원'), 1);
  assert.equal(API._blankCount('＿＿＿ 과 ＿＿＿'), 2);
  assert.equal(API._blankCount('주민등록번호 ______-_______'), 2);
  assert.equal(API._blankCount('○○주식회사와 ○○주식회사'), 2);
  assert.equal(API._blankCount('다 채워진 글'), 0);
  assert.equal(API._blankCount(''), 0);
  assert.equal(API._blankCount(null), 0);
});

test('묶음 세 단계가 실제 서식 목록을 가리킨다', () => {
  const decl = grabDecl('ESTAB_PHASES');
  ['DOC_KINDS', 'DOC_REG', 'DOC_TAX'].forEach((n) => {
    assert.ok(decl.includes(n), 'ESTAB_PHASES 가 ' + n + ' 을 가리켜야 한다');
  });
  ['kinds', 'reg', 'tax'].forEach((k) => assert.ok(decl.includes("'" + k + "'")));
});

test('묶음 화면이 번호와 채울 자리 수를 함께 보여 준다 — 날인 전에 봐야 한다', () => {
  const fn = grabFn('estabBundle');
  assert.match(fn, /docBlanks\(/, '서류마다 빈칸을 세야 한다');
  assert.match(fn, /\(i\+1\)/, '번호 차례를 매겨야 한다');
  assert.match(fn, /printDoc\(\)/, '그대로 인쇄해 날인할 수 있어야 한다');
});

test('묶음 단계에 «장부가 필요한» 서식을 넣지 않았다 — 넣으면 빈 숫자가 찍힌다', () => {
  const need = grabDecl('DOC_NEEDS_LEDGER');
  ['DOC_KINDS', 'DOC_REG', 'DOC_TAX'].forEach((n) => {
    const decl = grabDecl(n);
    const keys = [...decl.matchAll(/\['([a-z_0-9]+)',/g)].map((m) => m[1]);
    keys.forEach((k) => {
      /* 이름 «전체»가 맞아야 한다 — contrib 로 sub_contrib 를 잡으면 안 된다 */
      assert.ok(!new RegExp('[{,]\\s*' + k + ':1').test(need),
        n + ' 의 ' + k + ' 는 장부를 읽는 서식이라 묶음에 넣으면 안 된다');
    });
  });
});

/* ══════════ ⑤ 사업자등록증 판독 ══════════ */

/* 아래 글은 실제 사업자등록증이 아니라 «판독기를 시험하려고 지어낸» 글이다.
   상호·번호·사람 이름 모두 가짜다(이 저장소는 공개된다). */
const BIZ_TXT = `사 업 자 등 록 증
( 법인사업자 )
등록번호 : 123-81-45678
법 인 명 ( 단 체 명 ) : 주식회사 가나다산업
대 표 자 : 홍길동
개 업 연 월 일 : 2019 년 03 월 15 일
법인등록번호 : 110111-1234567
사업장 소재지 : 충청남도 아산시 배방읍 희망로 100
업 태 : 제조업
종 목 : 자동차부품
발급사유 : 신규`;

test('사업자등록증에서 여덟 칸을 읽는다', () => {
  const o = API.parseBizReg(BIZ_TXT);
  assert.equal(o.biz_no, '123-81-45678');
  assert.equal(o.corp_no, '110111-1234567');
  assert.equal(o.ceo, '홍길동');
  assert.equal(o.open_date, '2019-03-15');
  assert.equal(o.biz_type, '제조업');
  assert.equal(o.biz_item, '자동차부품');
  assert.ok(/아산시/.test(o.address || ''), '소재지: ' + o.address);
  assert.ok(/가나다산업/.test(o.name || ''), '상호: ' + o.name);
});

test('읽히지 않은 칸은 «넣지 않는다» — 빈 칸이 틀린 값보다 낫다', () => {
  const o = API.parseBizReg('사 업 자 등 록 증\n등록번호 : 123-81-45678');
  assert.equal(o.biz_no, '123-81-45678');
  assert.equal(o.ceo, undefined);
  assert.equal(o.open_date, undefined);
  assert.equal(o.biz_item, undefined);
});

test('빈 글·잡음에도 무너지지 않는다', () => {
  assert.deepEqual(API.parseBizReg(''), {});
  assert.deepEqual(API.parseBizReg(null), {});
  assert.ok(typeof API.parseBizReg('※ ▨ ▧ ▩ !!!') === 'object');
});

test('판독한 칸 이름이 «사업장 칸»과 같다 — 기금 칸 이름과 다르다', () => {
  const o = API.parseBizReg(BIZ_TXT);
  const siteKeys = [...grabDecl('SITE_FIELDS').matchAll(/\['([a-z_0-9]+)','/g)].map((m) => m[1]);
  Object.keys(o).forEach((k) => {
    assert.ok(siteKeys.includes(k),
      '사업장에 없는 칸으로 읽었다: ' + k + ' (기금 칸은 corp_reg_no, 사업장 칸은 corp_no)');
  });
});

/* ══════════ ⑥ 판독 결과가 «어디로» 가는가 ══════════ */

test('사업장 판독은 기금 칸(fd-)이 아니라 사업장 칸(se-)으로 간다', () => {
  const fn = grabFn('_siteDocScope');
  assert.match(fn, /pre:'se-'/);
  assert.match(fn, /fields:SITE_FIELDS/);
  assert.match(fn, /keep:false/, '사업자등록증을 «기금» 서류로 매달면 안 된다');
});

test('기금 정보 화면으로 돌아오면 넣을 자리를 되돌린다 — 안 되돌리면 조용히 실패한다', () => {
  assert.match(grabFn('bindDocIntake'), /_docScopeFund\(\)/);
  assert.match(grabFn('_docScopeFund'), /pre:'fd-'/);
});

test('반영은 _docScope 를 따른다 — 자리를 못 박아 두지 않는다', () => {
  const fn = grabFn('applyDocFound');
  assert.doesNotMatch(fn, /\$\('fd-'\+k\)/, "'fd-' 를 못 박으면 사업장 갈래가 죽는다");
  assert.match(fn, /_docScope\.pre\+k/);
});

test('사업장 갈래는 편집 창을 «다시 연다» — 창은 겹쳐 뜨지 않기 때문이다', () => {
  const fn = grabFn('applyDocFound');
  assert.match(fn, /editSite\(/, '닫힌 편집 창의 칸에 넣을 수는 없다');
  assert.match(fn, /_siteDocKeep/, '치던 값을 잃으면 안 된다');
});

/* ══════════ ⑦ 기업정보함에서 받는 칸 ══════════ */

test('기업정보함의 종목·개업일·기업규모·회사전화를 이제 받는다', () => {
  const map = grabDecl('SITE_CARD_MAP');
  [['bi', 'biz_item'], ['od', 'open_date'], ['sme', 'sme_type'], ['ct', 'company_tel']]
    .forEach(([from, to]) => {
      assert.ok(map.includes("['" + from + "','" + to + "']"), '안 받는 칸: ' + from + '→' + to);
    });
});

test('받은 칸이 사업장에 «자리»가 있다 (배관 양 끝)', () => {
  const siteKeys = [...grabDecl('SITE_FIELDS').matchAll(/\['([a-z_0-9]+)','/g)].map((m) => m[1]);
  ['biz_item', 'open_date', 'sme_type', 'company_tel']
    .forEach((k) => assert.ok(siteKeys.includes(k), '받아 놓고 넣을 자리가 없다: ' + k));
});

test('기업정보함 짝 목록의 오른쪽은 모두 사업장 칸이거나 담당자 칸이다', () => {
  const siteKeys = [...grabDecl('SITE_FIELDS').matchAll(/\['([a-z_0-9]+)','/g)].map((m) => m[1]);
  const pairs = [...grabDecl('SITE_CARD_MAP').matchAll(/\['([a-z]+)','([a-z_0-9]+)'\]/g)];
  pairs.forEach(([, , to]) => {
    assert.ok(to.startsWith('_c_') || siteKeys.includes(to), '갈 곳이 없는 짝: ' + to);
  });
});

test('일괄 채우기 목록도 새 칸 넷을 함께 채운다 — 한쪽만 늘리면 어긋난다', () => {
  const bulk = grabDecl('SITE_BULK');
  ['biz_item', 'open_date', 'sme_type', 'company_tel']
    .forEach((k) => assert.ok(bulk.includes("'" + k + "'"), '일괄에서 빠진 칸: ' + k));
});

/* ══════════ ⑧ ⓘ 규칙 (내 규칙을 내가 어기지 않게) ══════════ */

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  ['estab.bundle', 'site.doc'].forEach((k) => {
    assert.ok(SRC.includes("hlp('" + k + "')"), '쓰는 곳이 없는 도움말: ' + k);
    assert.ok(help.includes("'" + k + "':{"), '등록되지 않은 도움말 열쇠: ' + k);
  });
});

/* ══════════ ⑨ «정말 그려» 본다 ══════════
   글자로 찾는 검사는 변수 누출을 못 잡는다 — 종전에 '+Q+' 가 소스에 그대로 실려 나가
   그 창을 여는 순간 브라우저가 멈춘 적이 있다. 그래서 실제로 그려 보고 결과를 본다. */
function renderBundle(phase) {
  const box = {}, host = { innerHTML: '' };
  const code = [
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    'function loadingHTML(m){ return String(m||""); }',
    'function $(id){ return id==="formSide"?HOST:null; }',
    'function curForm(){ return {_sample:true, fund_type:"공동", name:"(샘플) 가나다공동근로복지기금", short_name:"가나다"}; }',
    'function _loadSites(){ return Promise.resolve([]); }',
    'function docBody(){ return "<p>몸통 ＿＿＿＿＿</p>"; }',
    'function _showDocHTML(h){ HOST.body=h; }',
    'function docBlanks(h){ return 1; }',
    'var S={};',
    grabDecl('DOC_KINDS'), grabDecl('DOC_REG'), grabDecl('DOC_TAX'),
    grabFn('docsFor'), grabDecl('ESTAB_PHASES'), grabFn('estabBundle'),
    'this.run=estabBundle;',
  ].join('\n');
  new Function('HOST', code).call(box, host);
  box.run(phase);
  return host.innerHTML;
}

test('묶음 화면을 «정말 그리면» 단추가 성한 채로 나온다 — 변수가 새지 않는다', () => {
  ['kinds', 'reg', 'tax'].forEach((p) => {
    const html = renderBundle(p);
    assert.ok(html.includes('printDoc()'), p + ': 인쇄 단추가 없다');
    assert.ok(html.includes('id="docwrap"'), p + ': 서류 자리가 없다');
    assert.ok(html.includes('id="bundleSum"'), p + ': 요약 자리가 없다');
    /* 누출 자국 — 소스의 변수 이름이 «글자로» 실려 나오면 여기 걸린다 */
    assert.ok(!/\+[A-Za-z_$][\w$]*\+/.test(html), p + ': 보간되지 않은 변수가 새어 나왔다');
    assert.ok(!/undefined|\[object/.test(html), p + ': undefined 가 샜다');
  });
});

test('묶음 화면 제목이 단계마다 다르다 — 어느 단계를 보는지 알 수 있어야 한다', () => {
  assert.match(renderBundle('kinds'), /① 노동부 설립인가/);
  assert.match(renderBundle('reg'), /② 법인 설립등기/);
  assert.match(renderBundle('tax'), /③ 고유번호증/);
  // 모르는 이름을 주면 첫 단계로 — 빈 화면을 내지 않는다
  assert.match(renderBundle('없는단계'), /① 노동부 설립인가/);
});

test('사업장 편집 창을 «정말 그리면» 사업자등록증에서 채우기 줄이 성하게 나온다', () => {
  const box = {}, out = { html: '' };
  const code = [
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
  ].join('\n');
  new Function('OUT', code).call(box, out);
  box.run('S1');
  const html = out.html;
  assert.ok(html.includes('siteDocAlbum()'), '사진첩 단추가 없다');
  assert.ok(html.includes('id="dz-sitebiz"'), '파일 올리는 자리가 없다');
  assert.ok(html.includes('id="siteDocOut"'), '판독 결과 자리가 없다');
  assert.ok(!/\+[A-Za-z_$][\w$]*\+/.test(html), '보간되지 않은 변수가 새어 나왔다');
  assert.ok(!/undefined/.test(html), 'undefined 가 샜다');
});

test('같은 이름 함수를 두 번 선언하지 않았다 — 나중 것이 이겨 조용히 깨진다', () => {
  const names = [...SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  names.forEach((n) => { if (seen.has(n)) dup.add(n); else seen.add(n); });
  assert.deepEqual([...dup], [], '중복 선언: ' + [...dup].join(', '));
});
