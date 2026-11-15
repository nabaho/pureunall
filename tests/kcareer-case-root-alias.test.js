'use strict';
/* 경력관리가 «7. 컨설턴트,위원신청등» 을 «번호 없는 이름(컨설턴트,위원신청등)»으로도 읽는다 + 정부사업신청이 공고가 정한 메일 제목을 «지원»으로 알아본다
   (대표 지시 2026-11-15 「네, 둘 다 고쳐 주세요」)

   까닭 ① 이 PC 의 서류 폴더는 «컨설턴트,위원신청등»(번호 없음)인데 경력관리는 정확히 «7. 컨설턴트,위원신청등» 만 찾았다 → 제출서류·새 지원 건 찾기가
        「폴더가 없습니다」. 폴더 이름을 바꾸게 하지 않고(OneDrive 사본·바로가기에 영향) 앱이 두 이름을 다 읽게 했다.
   까닭 ② 공고가 정한 제목 「…신청서 제출(이름, 분야)」를 정부사업신청의 «지원함 자동 기록»이 지원 메일로 못 알아봤다(APPLY 가 «신청서»를 안 봤다).

   규칙만 못 박는다:
     · 번호 있는 이름과 없는 이름은 «같은 폴더» — 먼저 정확한 이름, 없을 때만 번호 뗀 이름, 둘 다 없으면 그대로 실패(새로 만들지 않는다)
     · 기록에 적는 경로·건 키는 늘 «번호 있는 이름» 기준(두 PC 가 같은 기록)
     · 폴더를 «이름으로» 찾는 곳은 _fsDir 한 곳
     · 「신청서 제출」은 모집 대상 낱말(WHO)이 함께 있을 때만 지원, 고객 업무 낱말(CLIENT)이 있으면 지원이 아니다
   실행: node --test tests/kcareer-case-root-alias.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Scan = require('../js/kcareer-scan.js');
const Cases = require('../js/kcareer-cases.js');
const Gov = require('../js/gov-submit.js');
const KC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const GOV = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(src, 머리) {
  const i = src.indexOf(머리); assert.ok(i > 0, 머리 + ' 이(가) 없습니다');
  let d = 0, s = false;
  for (let p = i; p < src.length; p++) { if (src[p] === '{') { d++; s = true; } else if (src[p] === '}') { d--; if (s && !d) return src.slice(i, p + 1); } }
}
/* 가짜 폴더 핸들 — 이름이 없으면 NotFoundError(실제 브라우저처럼), create 를 줘야 만든다 */
class 폴더 {
  constructor(name, kids) { this.name = name; this.kind = 'directory'; this.kids = kids || {}; this.만든것 = []; }
  async getDirectoryHandle(n, opt) {
    if (this.kids[n]) return this.kids[n];
    if (opt && opt.create) { this.만든것.push(n); return (this.kids[n] = new 폴더(n)); }
    const e = new Error('없음: ' + n); e.name = 'NotFoundError'; throw e;
  }
  async getFileHandle(n) { if (this.파일 && this.파일[n]) return { getFile: async () => ({ name: n, 폴더: this.name }) }; const e = new Error('파일 없음'); e.name = 'NotFoundError'; throw e; }
  async *entries() { for (const k of Object.keys(this.kids)) yield [k, this.kids[k]]; }
  async *values() { for (const k of Object.keys(this.kids)) yield this.kids[k]; }
}

/* ───────── ① 공용 규칙(kcareer-scan.js) ───────── */
test('① 번호 있는 이름과 없는 이름을 같은 폴더로 본다 — 정확한 이름이 먼저', () => {
  assert.deepEqual(Scan.dirNameChoices('7. 컨설턴트,위원신청등'), ['7. 컨설턴트,위원신청등', '컨설턴트,위원신청등']);
  assert.deepEqual(Scan.dirNameChoices('컨설턴트,위원신청등'), ['컨설턴트,위원신청등'], '번호가 없으면 후보가 하나');
  assert.deepEqual(Scan.dirNameChoices('2.충남노사민정 업무'), ['2.충남노사민정 업무', '충남노사민정 업무'], '점 뒤 띄어쓰기가 없어도');
  assert.deepEqual(Scan.dirNameChoices(''), ['']); assert.deepEqual(Scan.dirNameChoices(null), ['']);
  assert.ok(Scan.isCaseRootName('7. 컨설턴트,위원신청등') && Scan.isCaseRootName('컨설턴트,위원신청등'));
  assert.ok(!Scan.isCaseRootName('컨설턴트') && !Scan.isCaseRootName('8. 공동기금'), '다른 폴더는 7번이 아니다');
});
test('① 건 키는 첫 칸이 번호 없는 이름이어도 «번호 있는 이름»으로 통일된다 — 두 PC 가 같은 건을 같은 키로', () => {
  const 번호있음 = '7. 컨설턴트,위원신청등/2026년/2026 ○○기관 상담위원/접수서류/신청서.pdf';
  const 번호없음 = '컨설턴트,위원신청등/2026년/2026 ○○기관 상담위원/접수서류/신청서.pdf';
  assert.equal(Scan.caseKeyOf(번호있음), '7. 컨설턴트,위원신청등/2026년/2026 ○○기관 상담위원');
  assert.equal(Scan.caseKeyOf(번호없음), Scan.caseKeyOf(번호있음), '⚠ 키가 다르면 같은 건이 두 번 등록된다');
  assert.equal(Scan.caseKeyOf('8. 공동기금/2026년/x/접수서류/a.pdf'), null, '다른 폴더는 건이 아니다');
  assert.equal(Scan.caseKeyOf('컨설턴트,위원신청등/2026년/x.pdf'), null, '깊이가 모자라면 건이 아니다');
});

/* ───────── ② _fsDir — 폴더를 이름으로 찾는 한 곳 ───────── */
function 도구() {
  const ctx = { Promise, Error, KcareerScan: Scan, KcareerCases: Cases, toast: () => {}, console };
  vm.createContext(ctx);
  vm.runInContext([떼기(KC, 'async function _fsDir('), 떼기(KC, 'async function _fsHas(')].join('\n'), ctx);
  return ctx;
}
test('② _fsDir — 번호 있는 폴더만 있어도, 번호 없는 폴더만 있어도 찾는다', async () => {
  const c = 도구(), 있음 = new 폴더('서류', { '7. 컨설턴트,위원신청등': new 폴더('7. 컨설턴트,위원신청등') }), 없음 = new 폴더('서류', { '컨설턴트,위원신청등': new 폴더('컨설턴트,위원신청등') });
  assert.equal((await c._fsDir(있음, '7. 컨설턴트,위원신청등')).name, '7. 컨설턴트,위원신청등');
  assert.equal((await c._fsDir(없음, '7. 컨설턴트,위원신청등')).name, '컨설턴트,위원신청등', '⚠ 번호 없는 이름을 못 찾습니다 — 이 PC 에서 「폴더가 없습니다」가 뜹니다');
});
test('② _fsDir — 둘 다 있으면 정확한 이름이 이긴다', async () => {
  const c = 도구(), 부모 = new 폴더('서류', { '7. 컨설턴트,위원신청등': new 폴더('7. 컨설턴트,위원신청등'), '컨설턴트,위원신청등': new 폴더('컨설턴트,위원신청등') });
  assert.equal((await c._fsDir(부모, '7. 컨설턴트,위원신청등')).name, '7. 컨설턴트,위원신청등');
});
test('② _fsDir — 둘 다 없으면 실패한다 · 새로 만들지 않는다(create 를 줘야만 만든다)', async () => {
  const c = 도구(), 부모 = new 폴더('서류', { '8. 공동기금': new 폴더('8. 공동기금') });
  await assert.rejects(() => c._fsDir(부모, '7. 컨설턴트,위원신청등'));
  assert.deepEqual(부모.만든것, [], '⚠ 폴더를 새로 만들었습니다');
  assert.equal(await c._fsHas(부모, '7. 컨설턴트,위원신청등'), false);
  assert.equal(await c._fsHas(new 폴더('서류', { '컨설턴트,위원신청등': new 폴더('x') }), '7. 컨설턴트,위원신청등'), true, '_fsHas 도 번호 없는 이름을 본다(서류 폴더 연결 확인)');
});
test('② fsCaseDirs — 번호 없는 7번 폴더에서도 «연도 › 건» 목록을 읽는다', async () => {
  const ctx = { Promise, Error, KcareerScan: Scan, KcareerCases: Cases, console };
  vm.createContext(ctx);
  vm.runInContext([떼기(KC, 'async function _fsDir('), 떼기(KC, 'async function fsCaseDirs(')].join('\n'), ctx);
  const 건 = new 폴더('2026 ○○ 상담위원'), 해 = new 폴더('2026년', { '2026 ○○ 상담위원': 건, '안내.txt': Object.assign(new 폴더('안내.txt'), { kind: 'file' }) }), 해2 = new 폴더('기타', { x: new 폴더('x') });
  const 루트 = new 폴더('서류', { '컨설턴트,위원신청등': new 폴더('컨설턴트,위원신청등', { '2026년': 해, '기타': 해2 }) });
  const 목록 = await ctx.fsCaseDirs(루트);
  assert.deepEqual([...목록.map((x) => x.yearDir + '/' + x.name)], ['2026년/2026 ○○ 상담위원'], '연도 폴더 안의 건 폴더만');   /* 스프레드: vm 안에서 만든 배열을 이 쪽 배열로 옮겨 견준다 */
  assert.equal(await ctx.fsCaseDirs(new 폴더('서류', {})), null, '7번 폴더가 아예 없으면 null(기존 동작)');
});
test('② 파일 열기(_fsFileOf) — 기록의 경로는 «번호 있는 이름»이어도 번호 없는 폴더에서 열린다', async () => {
  const ctx = { Promise, Error, String, KcareerScan: Scan, console };
  const 건 = Object.assign(new 폴더('접수서류'), { 파일: { '신청서.pdf': 1 } });
  const 칸 = new 폴더('컨설턴트,위원신청등', { '2026년': new 폴더('2026년', { '2026 ○○': new 폴더('2026 ○○', { '접수서류': 건 }) }) });
  ctx.fsRoot = async () => new 폴더('서류', { '컨설턴트,위원신청등': 칸 });
  vm.createContext(ctx);
  vm.runInContext([떼기(KC, 'async function _fsDir('), 떼기(KC, 'async function _fsFileOf(')].join('\n'), ctx);
  const f = await ctx._fsFileOf('7. 컨설턴트,위원신청등/2026년/2026 ○○/접수서류/신청서.pdf');
  assert.equal(f.name, '신청서.pdf'); assert.equal(f.폴더, '접수서류');
});

/* ───────── ③ 폴더를 이름으로 찾는 곳은 한 곳 ───────── */
test('③ kcareer.html 에서 폴더를 이름으로 찾는 곳은 _fsDir 하나 — 날것의 getDirectoryHandle(이름)이 남지 않는다', () => {
  const 코드 = strip(KC);
  const 날것 = 코드.match(/getDirectoryHandle\([^)]*\)/g) || [];
  /* 허락: _fsDir 안의 한 줄(후보[i]) + 새 건 폴더를 «만드는» create:true 호출(연도·건·접수서류) */
  const 허락 = 날것.filter((x) => /후보\[i\]/.test(x) || /create\s*:\s*true/.test(x));
  assert.deepEqual(날것.filter((x) => !허락.includes(x)), [], '⚠ 폴더를 «번호 있는 이름으로만» 찾는 곳이 남았습니다 — _fsDir 로 찾으세요(이름 접두어 규칙을 한 곳에 둔다)');
  assert.match(떼기(KC, 'async function _fsDir('), /KcareerScan\.dirNameChoices\(/);
  assert.match(KC, /<script src="js\/kcareer-scan\.js\?v=\d+"><\/script>/, '공용 규칙 파일에 캐시 번호가 붙어 있어야 고친 규칙이 받아진다');
});

/* ───────── ④ 정부사업신청 — 7번 폴더 찾기 ───────── */
function 정부도구() {
  const ctx = { Promise, console, REC_DIR: Cases.CASE_ROOT };
  vm.createContext(ctx);
  vm.runInContext('var REC_DIR=' + JSON.stringify(Cases.CASE_ROOT) + ';\n' + GOV.slice(GOV.indexOf('var REC_NAME_BARE='), GOV.indexOf('async function _recFind7(')) + '\n' + 떼기(GOV, 'async function _recFind7('), ctx);
  return ctx;
}
test('④ 정부사업신청 — 서류 폴더를 고르든 7번 폴더를 직접 고르든, 번호가 있든 없든 찾는다', async () => {
  const c = 정부도구();
  const 번호없는 = new 폴더('컨설턴트,위원신청등'), 번호있는 = new 폴더('7. 컨설턴트,위원신청등');
  assert.equal(await c._recFind7(new 폴더('서류', { '컨설턴트,위원신청등': 번호없는 })), 번호없는, '⚠ 번호 없는 7번 폴더를 못 찾습니다');
  assert.equal(await c._recFind7(번호없는), 번호없는, '7번 폴더를 직접 골라도');
  assert.equal(await c._recFind7(new 폴더('서류', { '7. 컨설턴트,위원신청등': 번호있는 })), 번호있는);
  assert.equal(await c._recFind7(번호있는), 번호있는);
  assert.equal(await c._recFind7(new 폴더('서류', { '8. 공동기금': new 폴더('8. 공동기금'), '컨설턴트': new 폴더('컨설턴트') })), null, '이름이 비슷한 다른 폴더는 7번이 아니다');
  assert.equal(await c._recFind7(null), null);
  const 둘 = new 폴더('서류', { '컨설턴트,위원신청등': 번호없는, '7. 컨설턴트,위원신청등': 번호있는 });
  assert.equal(await c._recFind7(둘), 번호있는, '둘 다 있으면 정확한 이름이 이긴다');
});
test('④ gov-submit.js 캐시 번호가 붙어 있다(고친 규칙이 받아지게)', () => {
  assert.match(GOV, /<script src="js\/gov-submit\.js\?v=\d+"><\/script>/);
});

/* ───────── ⑤ 공고가 정한 메일 제목을 «지원»으로 알아본다 ───────── */
const 분류 = (제목, 보냄) => Gov.classify({ s: 제목, u: '1', d: '2026-11-16', a: 3 }, { sent: 보냄, folder: '보낸편지함', matches: () => [] });
test('⑤ 「…신청서 제출(이름, 분야)」 — 보낸 메일도, 거기에 온 답장도 지원으로 알아본다', () => {
  const 제목 = '2027년 충남 비즈니스지원단 신청서 제출(권형하, 인사노무)';
  const 보냄 = 분류(제목, true); assert.ok(보냄 && 보냄.kind === 'submit', '⚠ 공고가 정한 제목을 지원으로 못 알아봅니다 — 보낸 뒤 «지원함»이 저절로 안 적힙니다');
  const 답장 = 분류('Re: ' + 제목, false); assert.ok(답장 && 답장.kind === 'submit' && 답장.viaReply === true);
});
test('⑤ 「신청서 제출」만으로는 지원이 아니다 — 모집 대상 낱말(WHO)이 있어야 하고, 고객 업무 낱말(CLIENT)이 있으면 지원이 아니다', () => {
  for (const 제목 of ['(주)가나다 산재 신청서 제출', '○○공단 신청서 제출', '상담위원 기업 참여신청서 제출', '근로자 상담위원 신청서 제출', '급여 컨설턴트 신청서 제출']) {
    assert.equal(분류(제목, true), null, '⚠ 지원이 아닌 메일을 지원으로 적습니다: ' + 제목);
  }
  assert.equal(분류('2027년 충남 비즈니스지원단 신청서 제출 안내', false), null, '받은 안내 메일(답장 아님)은 지원이 아니다');
});
test('⑤ 기존에 알아보던 제목은 그대로다(지원서·응모·이력서·프로필)', () => {
  for (const 제목 of ['한국기계연구원 고문노무사 지원서 제출', '평가위원 응모 서류', '컨설턴트 이력서 송부', '전문가 프로필 제출']) {
    assert.ok(분류(제목, true), 제목);
  }
});
test('⑤ 규칙은 한 곳(APPLY_FORM)이고 모집 대상 낱말·고객 낱말 거름은 그대로 걸려 있다', () => {
  const 코드 = strip(fs.readFileSync(path.join(__dirname, '..', 'js', 'gov-submit.js'), 'utf8'));
  assert.match(코드, /var APPLY_FORM\s*=\s*\/[^/]*신청서[^/]*제출[^/]*\//);
  const 줄 = 코드.match(/if \(\(sent \|\| reply\)[^\n]*\{/)[0];
  assert.match(줄, /APPLY_FORM\.test\(subj\)\s*&&\s*WHO\.test\(subj\)/); assert.match(줄, /!CLIENT\.test\(subj\)/);
});
