/* 공동/사내 — 유형 하나를 고르면 서식 «전부»의 말이 함께 바뀐다
 *
 * 대표 지시 2026-09-11:
 *   「공동 사내 도 최초 사업진행시 모두 같이 동시에 바뀌게 만들어야 한다.」
 *
 * 왜 필요했나 — 원본 .hwp 들은 한 집에서 베껴 쓴 탓에 «제목은 공동인데 본문은 사내»라고
 * 적힌 자리가 흩어져 있었다. 설립합의서 2곳, 설립준비위 회의록 4곳, 사업계획서·등록면허세
 * 신고서·임대차계약서·재산변동보고서·협의회 회의록에 각각. 그대로 내면 관청에 나가는
 * 서류가 스스로 다른 말을 한다.
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 상호·사람 이름·번호 금지. 여기 자료는 전부 가짜다.
 *
 * 이 검사가 지키는 것
 *  ① 유형에 따라 «두 갈래 모두» 바뀐다 (공동→사내, 사내→공동)
 *  ② 정관·설립인가신청서·지원사업 서식은 «손대지 않는다»
 *  ③ 한 덩이에 두 유형이 나란히 적힌 곳(고르는 칸)은 비껴간다
 *  ④ 「기금법인」을 「공동기금법인」으로 «부풀리지» 않는다 — 원본에 없던 말을 늘리지 않는다
 *  ⑤ hwpFormHTML 이 말 고르기를 «걷어내기보다 먼저» 부른다
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

/* 줄째로 꺼내기 — grabDecl 은 {·[ 로 시작하는 값만 잡는다(글자 하나짜리 상수는 못 잡는다) */
function grabLine(name) {
  const m = SRC.match(new RegExp('var ' + name + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + name);
  return m[0];
}

const API = (() => {
  const box = {};
  new Function([
    grabDecl('FTYPE_SKIP'), grabDecl('FTYPE_PAIRS'), grabDecl('FTYPE_GONG_ONLY'),
    grabFn('ftypeSkipDoc'), grabLine('FTYPE_PICK_SRC'),
    grabFn('_ftypeSwap'), grabFn('_ftypeWords'), grabFn('_isTypePickBox'), grabFn('fillFundTypeWords'),
    'this.words=_ftypeWords; this.both=_isTypePickBox; this.skip=ftypeSkipDoc; this.fill=fillFundTypeWords;',
  ].join('\n')).call(box);
  return box;
})();

/* ══════════ ① 말 고르기 — 두 갈래 모두 ══════════ */

test('공동 기금이면 본문의 「사내」가 「공동」으로 바뀐다', () => {
  assert.equal(API.words('사내근로복지기금법인 설립준비위원회를 노사 각 2인 동수로 구성한다.', '공동'),
    '공동근로복지기금법인 설립준비위원회를 노사 각 2인 동수로 구성한다.');
  assert.equal(API.words('ㅇ 사내근로복지기금 설립 경과', '공동'), 'ㅇ 공동근로복지기금 설립 경과');
  assert.equal(API.words('제 1 차 (정기ㆍ임시) 사내근로복지기금협의회 회의록', '공동'),
    '제 1 차 (정기ㆍ임시) 공동근로복지기금협의회 회의록');
});

test('사내 기금이면 본문의 「공동」이 「사내」로 바뀐다', () => {
  assert.equal(API.words('공동근로복지기금법인 기본재산 총액 변경 내용 보고서', '사내'),
    '사내근로복지기금법인 기본재산 총액 변경 내용 보고서');
  assert.equal(API.words('공동근로복지기금 조성에 참여한 회사소속근로자', '사내'),
    '사내근로복지기금 조성에 참여한 회사소속근로자');
});

test('★ 긴 말부터 본다 — 짧은 말이 먼저 먹으면 「협의회」가 깨진다', () => {
  // 공동기금협의회(줄임말)는 사내에서 「협의회」로, 공동근로복지기금협의회는 「사내근로복지기금협의회」로
  assert.equal(API.words('공동기금협의회에서 의결한다', '사내'), '협의회에서 의결한다');
  assert.equal(API.words('공동근로복지기금협의회로 본다', '사내'), '사내근로복지기금협의회로 본다');
  // 짧은 말(공동기금)이 먼저 먹으면 「사내근로복지기금」 안이 한 번 더 깨져 겹말이 된다
  assert.doesNotMatch(API.words('공동근로복지기금협의회로 본다', '사내'), /기금기금/);
});

test('★ 「기금법인」을 「공동기금법인」으로 부풀리지 않는다', () => {
  // 공동 갈래에서는 줄임말을 건드리지 않는다 — 원본에 없던 말이 늘어난다
  assert.equal(API.words('기금법인 대표자 (서명 또는 인)', '공동'), '기금법인 대표자 (서명 또는 인)');
  assert.equal(API.words('협의회에서 의결하여 시행할 수 있으며', '공동'), '협의회에서 의결하여 시행할 수 있으며');
  // 사내 갈래에서는 공동 전용 줄임말만 «넓은 말»로 되돌린다
  assert.equal(API.words('공동기금법인은 제1조의 목적을 달성하기 위하여', '사내'),
    '기금법인은 제1조의 목적을 달성하기 위하여');
  assert.equal(API.words('공동기금설립 준비위원이 위의 정관을 작성하고', '사내'),
    '기금설립 준비위원이 위의 정관을 작성하고');
});

test('★ 기금 이름 뒤에 유형이 또 붙는 군더더기를 지운다', () => {
  // 원본은 「{{FUND}} 사내근로복지기금의 출연금」 — 이름을 넣으면 같은 말이 두 번 선다
  assert.equal(API.words('가나다공동근로복지기금 사내근로복지기금의 출연금 ＿＿＿＿＿원', '공동'),
    '가나다공동근로복지기금의 출연금 ＿＿＿＿＿원');
  assert.equal(API.words('가나다사내근로복지기금 공동근로복지기금의 출연금', '사내'),
    '가나다사내근로복지기금의 출연금');
  // 이름이 「근로복지기금」으로 끝나지 않으면 지우지 않는다 — 지우면 뜻이 사라진다
  assert.equal(API.words('가나다기금 사내근로복지기금의 출연금', '공동'), '가나다기금 공동근로복지기금의 출연금');
});

test('바꿀 것이 없으면 글자를 그대로 돌려준다', () => {
  const t = '이 정관은 근로복지기본법의 규정에 따라 효율적으로 관리·운영한다.';
  assert.equal(API.words(t, '공동'), t);
  assert.equal(API.words(t, '사내'), t);
});

/* ══════════ ② 손대지 않는 서식 ══════════ */

test('★ 정관은 손대지 않는다 — 공동본·사내본 원본이 따로 있다', () => {
  assert.equal(API.skip('charter'), true);
  assert.equal(API.skip('charter_sane'), true);
});

test('★ 설립인가신청서는 손대지 않는다 — 「[ ] 사내 / [V] 공동」 고르는 칸이다', () => {
  assert.equal(API.skip('inka'), true);
});

test('★ 지원사업 서식은 손대지 않는다 — 공동기금 전용이라 사내는 오지 않는다', () => {
  ['subsidy', 'sub_required', 'sub_checklist', 'sub_contrib', 'sub_oath',
    'sub_welfare_plan', 'sub_assets', 'sub_payment'].forEach((k) => {
    assert.equal(API.skip(k), true, k + ' 이 새어 들어온다');
  });
});

test('오염된 서식들은 «손대는» 쪽이다 — 아니면 이 일이 아무것도 안 한다', () => {
  ['agreement', 'minutes', 'bizplan', 'reg_apply', 'reg_license',
    'tax_lease', 'ops_asset_change', 'ops_minutes_scope'].forEach((k) => {
    assert.equal(API.skip(k), false, k + ' 이 빠져 있다');
  });
});

/* ══════════ ③ 고르는 칸은 비껴간다 ══════════ */

test('표 자리가 붙은 두 갈래여야 고르는 칸이다', () => {
  assert.equal(API.both('[ ] 사내근로복지기금법인[V] 공동근로복지기금법인'), true);
  assert.equal(API.both('[√] 사내근로복지기금법인 [ ] 공동근로복지기금법인'), true);
  assert.equal(API.both('□ 사내근로복지기금법인 ■ 공동근로복지기금법인'), true);
  assert.equal(API.both('사내근로복지기금 설립 경과'), false);
  assert.equal(API.both('공동근로복지기금 조성에 참여한 회사'), false);
});

test('★ 「둘 다 적혀 있으면 고르는 칸」으로 보면 안 된다 — 기금 «이름»에 유형이 들어 있다', () => {
  /* 가나공동근로복지기금이라는 이름이 든 칸은 늘 「공동」을 품는다. 이름 때문에
     설립합의서·사업계획서·협의회 회의록이 통째로 안 바뀌었다(렌더 검사가 잡았다). */
  assert.equal(API.both('가나공동근로복지기금 사내근로복지기금의 출연금'), false);
  assert.equal(API.both('가나공동근로복지기금 설립준비위원회 — 사내근로복지기금 설립 경과'), false);
});

test('★ 기금 «이름»은 고쳐 쓰지 않는다 — 아무도 시키지 않은 개명이 관청에 나간다', () => {
  const nm = '가나공동근로복지기금';
  const out = API.words(nm + ' 이사장은 공동근로복지기금법인 업무를 총괄한다', '사내', nm);
  assert.ok(out.indexOf(nm) >= 0, '이름이 바뀌었다: ' + out);
  assert.ok(out.indexOf('사내근로복지기금법인 업무') >= 0, '본문이 안 바뀌었다: ' + out);
  assert.ok(out.indexOf('가나사내') < 0, '이름 안까지 고쳐 썼다: ' + out);
});

/* ══════════ ④ «정말 그려» 본다 — 작은 가짜 DOM ══════════
   글자 규칙만 보면 걸러 내지 못하는 것이 있다: 덩이째 보는 규칙을 <br>로 갈라진
   마디마다 적용하면, 고르는 칸의 한쪽 줄만 바뀌어 「공동/공동」이 된다. */
function mkDoc(html) {
  /* <p>·<td> 한 겹 + <br> 로 갈라진 글 마디만 있으면 이 걷기에는 충분하다 */
  const blocks = html.split('|').map((chunk) => {
    const kids = chunk.split('<br>').map((s) => ({ nodeType: 3, nodeValue: s }));
    return {
      nodeType: 1, childNodes: kids,
      get textContent() { return this.childNodes.map((n) => n.nodeValue).join(''); },
    };
  });
  return { nodeType: 1, childNodes: blocks, get textContent() { return blocks.map((b) => b.textContent).join('|'); } };
}
const drawn = (html, ftype, kind) => { const d = mkDoc(html); API.fill(d, ftype, kind); return d.textContent; };
const flat = (html) => html.split('<br>').join('');      // 그린 글에는 <br> 가 없다

test('★ 고르는 칸은 «줄마다» 보지 않는다 — 한쪽만 바뀌면 「공동/공동」이 된다', () => {
  const box = '[ ] 사내근로복지기금법인<br>[V] 공동근로복지기금법인';
  // inka 밖(예: 재산변동보고서에 같은 칸이 섞여 와도) 덩이 규칙이 지켜야 한다
  assert.equal(drawn(box, '공동', 'ops_asset_change'), flat(box));
  assert.equal(drawn(box, '사내', 'ops_asset_change'), flat(box));
});

test('설립합의서를 그리면 제목과 본문이 «같은 말»을 한다', () => {
  const src = '공동근로복지기금법인 설립 합의서|사내근로복지기금법인 설립 건에 관하여 협의하고|'
    + '2. 사내근로복지기금법인 설립준비위원회를 노사 각 2인 동수로 구성한다.';
  const out = drawn(src, '공동', 'agreement');
  assert.ok(out.indexOf('사내') < 0, '설립합의서에 「사내」가 남았다: ' + out);
  assert.equal((out.match(/공동근로복지기금법인/g) || []).length, 3);
});

test('사내 기금이면 같은 서식이 통째로 「사내」로 나온다', () => {
  const src = '공동근로복지기금법인 설립 합의서|사내근로복지기금법인 설립 건에 관하여 협의하고';
  const out = drawn(src, '사내', 'agreement');
  assert.ok(out.indexOf('공동') < 0, '사내 기금 서류에 「공동」이 남았다: ' + out);
});

test('손대지 않는 서식은 그려도 한 글자도 안 바뀐다', () => {
  const src = '공동근로복지기금 지원사업 착안사항 자율 체크리스트';
  assert.equal(drawn(src, '사내', 'sub_checklist'), src);
  const charter = '00공동근로복지기금 정관|공동근로복지기금을 효율적으로 관리·운영함으로써';
  assert.equal(drawn(charter, '사내', 'charter'), charter);
});

/* ══════════ ⑤ 배선 ══════════ */

test('★ hwpFormHTML 이 말 고르기를 «걷어내기보다 먼저» 부른다', () => {
  const h = grabFn('hwpFormHTML');
  const a = h.indexOf('fillFundTypeWords(d,ftype,kind,f.name);');
  const b = h.indexOf('stripBaked(d);');
  assert.ok(a >= 0, 'hwpFormHTML 이 말 고르기를 아예 안 부른다 — 이름을 안 넘기면 이름까지 고쳐 쓴다');
  assert.ok(b > a, '걷어낸 뒤에 바꾸면 이미 밑줄이 된 자리를 못 찾는다');
});

test('★ jsdom 검사도 말 고르기를 실어야 한다 — 없으면 CI 에서만 통째로 죽는다', () => {
  ['check_derived.js', 'check_forms.js'].forEach((f) => {
    const t = fs.readFileSync(path.join(__dirname, '..', 'fund-erp', 'tools', f), 'utf8');
    assert.match(t, /gF\('fillFundTypeWords'\)/, f + ' 에 fillFundTypeWords 가 없다');
    assert.match(t, /gV\('FTYPE_PAIRS'\)/, f + ' 에 FTYPE_PAIRS 가 없다');
  });
});

/* ══════════ ⑥ 유형을 나중에 바꿀 때 ══════════ */

test('유형을 바꾸면 «저장해 둔 서식»을 세어 알린다', () => {
  const fn = grabFn('afterTypeChange');
  assert.match(fn, /var old=\(from==='사내'\)\?'사내근로복지기금':'공동근로복지기금'/);
  assert.match(fn, /doc_edits\/'\+fid/, '저장본을 보지 않는다');
  assert.match(fn, /dropStaleDocEdits\(/, '지울 길이 없다');
});

test('저장본 지우기가 «찾을 말»을 받는다 — 옛 이름 말고 옛 유형으로도 골라야 한다', () => {
  const fn = grabFn('dropStaleDocEdits');
  assert.match(fn, /function dropStaleDocEdits\(fid,needle\)/);
  assert.match(fn, /if\(!needle\)\{ var hist=nameHistOf\(f\)/, '이름 바꾸기 쪽 동작이 깨졌다');
});

test('★ saveInfo 가 유형 변경을 «저장 전» 값과 견준다', () => {
  const fn = grabFn('saveInfo');
  assert.match(fn, /var _typeFrom=patch\.hasOwnProperty\('fund_type'\)\?String\(cur\.fund_type\|\|'공동'\):''/);
  assert.match(fn, /else if\(_typeFrom&&_typeFrom!==_typeTo\) afterTypeChange\(_fid,_typeFrom,_typeTo\)/);
});

test('★ 이름과 유형을 한꺼번에 바꿔도 창은 «하나»만 뜬다 — 창은 겹쳐 뜨지 않는다', () => {
  const fn = grabFn('saveInfo');
  const a = fn.indexOf('if(!r.same) afterRename(');
  const b = fn.indexOf('else if(_typeFrom&&_typeFrom!==_typeTo) afterTypeChange(');
  assert.ok(a >= 0 && b > a, '두 창이 나란히 뜨면 뒤 창이 앞 창을 지운다');
});

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(help.indexOf("'ftype.words':{") >= 0, 'ftype.words 설명이 없다');
  assert.ok(SRC.indexOf("hlp('ftype.words')") >= 0, '어디서도 ⓘ 를 부르지 않는다');
});

test('설명은 ⓘ 에 있고 화면에는 «이번에 일어난 일»만 적는다 — 내 규칙이다', () => {
  const fn = grabFn('afterTypeChange');
  assert.match(fn, /hlp\('ftype\.words'\)/);
  // 안내 문단을 화면에 깔지 않는다(오류·결과 메시지는 msg 로)
  assert.doesNotMatch(fn, /<p class="muted"[^>]*>\s*원본/, '설명문을 창에 깔았다');
});
