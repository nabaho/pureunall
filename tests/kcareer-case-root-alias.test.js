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
  assert.deepEqual(Scan.dirNameChoices('컨설턴트,위원신청등'), ['컨설턴트,위원신청등', '7. 컨설턴트,위원신청등'], '반대 방향: 번호 없는 7번 폴더 이름으로 적힌 옛 기록을 번호 있는 PC 에서도 연다');
  assert.deepEqual(Scan.dirNameChoices('임금체불'), ['임금체불'], '다른 폴더는 번호를 짐작하지 않는다');
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
  const 허락 = 날것.filter((x) => /후보\[(i|0)\]/.test(x) || /create\s*:\s*true/.test(x));   /* _fsDir 안: 있는지 보는 줄(후보[i]) + 어느 쪽도 없을 때 정확한 이름으로 만드는 줄(후보[0]) */
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
  const 제목 = '2027년 충남 비즈니스지원단 신청서 제출(홍길동, 인사노무)';   /* 가짜 이름 — 시험 자료에 진짜 이름을 넣지 않는다 */
  const 보냄 = 분류(제목, true); assert.ok(보냄 && 보냄.kind === 'submit', '⚠ 공고가 정한 제목을 지원으로 못 알아봅니다 — 보낸 뒤 «지원함»이 저절로 안 적힙니다');
  const 답장 = 분류('Re: ' + 제목, false); assert.ok(답장 && 답장.kind === 'submit' && 답장.viaReply === true);
});
test('⑤ 「신청서 제출」만으로는 지원이 아니다 — 모집 대상 낱말(WHO)이 있어야 하고, 고객 업무 낱말(CLIENT)이 있으면 지원이 아니다', () => {
  for (const 제목 of ['(주)가나다 산재 신청서 제출', '○○공단 신청서 제출(홍길동, 금융)', '상담위원 기업 참여신청서 제출(홍길동, 금융)', '근로자 상담위원 신청서 제출(홍길동, 금융)', '급여 컨설턴트 신청서 제출(홍길동, 금융)', '상담위원 신청서 제출']) {
    assert.equal(분류(제목, true), null, '⚠ 지원이 아닌 메일을 지원으로 적습니다: ' + 제목);
  }
  assert.equal(분류('2027년 충남 비즈니스지원단 신청서 제출 안내', false), null, '받은 안내 메일(답장 아님)은 지원이 아니다');
});
test('⑤ 고객 대행 메일 — 기업 괄호·상담 신청서·선임은 지원이 아니다(재검증 2026-11-15 실측 4건) · 공고 꼴은 «(사람 이름, 분야)»일 때만', () => {
  for (const 제목 of ['충남 비즈니스지원단 상담 신청서 제출(㈜가나)', '노무사 선임 신청서 제출', '전문가 컨설팅 지원 신청서 제출(가나㈜)', '코칭 프로그램 신청서 제출(가나산업)',
    '충남 비즈니스지원단 신청서 제출(주식회사 가나, 컨설팅)', '컨설턴트 상담 신청서 제출(홍길동, 금융)']) {
    assert.equal(분류(제목, true), null, '⚠ 고객 대행 메일을 지원으로 적습니다: ' + 제목);
  }
  for (const 제목 of ['2027년 충남 비즈니스지원단 신청서 제출(홍길동,금융)', '2027년 충남 비즈니스지원단 신청서 제출( 홍길동 , 인사노무 )']) {
    assert.ok(분류(제목, true), '공고 꼴인데 지원으로 못 알아봅니다: ' + 제목);
  }
});
test('⑤ 기존에 알아보던 제목은 그대로다(지원서·응모·이력서·프로필)', () => {
  for (const 제목 of ['한국기계연구원 고문노무사 지원서 제출', '평가위원 응모 서류', '컨설턴트 이력서 송부', '전문가 프로필 제출']) {
    assert.ok(분류(제목, true), 제목);
  }
});
test('⑤ 규칙은 한 곳(APPLY_FORM)이고 모집 대상 낱말·고객 낱말 거름은 그대로 걸려 있다', () => {
  const 코드 = strip(fs.readFileSync(path.join(__dirname, '..', 'js', 'gov-submit.js'), 'utf8'));
  assert.match(코드, /var APPLY_FORM\s*=\s*\/[^/]*신청서[^/]*제출[^/]*\//);
  assert.match(코드, /var CLIENT_FORM\s*=\s*\/[^/]*상담[^/]*신청서[^/]*\//);
  const 줄 = 코드.match(/if \(\(sent \|\| reply\)[^\n]*\{/)[0];
  assert.match(줄, /APPLY_FORM\.test\(subj\)\s*&&\s*WHO_FORM\.test\(subj\)\s*&&\s*!CLIENT_FORM\.test\(subj\)/); assert.match(줄, /!CLIENT\.test\(subj\)/);
  assert.match(코드, /var WHO_FORM\s*=\s*\/[^/]*지원단[^/]*\//, '이 길의 모집 대상 낱말은 WHO(노무사·임원·강사까지 넓다)보다 좁다');
});

/* ───────── ⑥ 재검증(2026-11-15) 지적 — 기록의 경로는 어느 길로 들어와도 «번호 있는 이름» ───────── */
test('⑥ 기록의 경로(relPath)도 «번호 있는 이름»으로 통일된다 — 건 키(caseDir)만 바뀌고 경로가 그대로면 두 PC 가 어긋나고 같은 파일이 두 번 등록된다', () => {
  assert.equal(Scan.canonRelPath('컨설턴트,위원신청등/2026년/2026 ○○/접수서류/a.pdf'), '7. 컨설턴트,위원신청등/2026년/2026 ○○/접수서류/a.pdf');
  assert.equal(Scan.canonRelPath('7. 컨설턴트,위원신청등/2026년/x/a.pdf'), '7. 컨설턴트,위원신청등/2026년/x/a.pdf', '이미 번호가 있으면 그대로');
  assert.equal(Scan.canonRelPath('8. 공동기금/x.pdf'), '8. 공동기금/x.pdf', '다른 폴더는 건드리지 않는다');
  assert.equal(Scan.canonRelPath('컨설턴트,위원신청등'), '컨설턴트,위원신청등', '경로 한 칸뿐이면 그대로');
  const 입력 = [{ name: '2026 위촉장.pdf', relPath: '컨설턴트,위원신청등/2026년/2026 충남청/접수서류/2026 위촉장.pdf', size: 100, mtime: '2026-11-15T00:00:00.000Z' }];
  const 결과 = Scan.buildRecords(입력, { scanId: 'T1' });
  assert.equal(결과.submissions.length, 1);
  const 건 = 결과.submissions[0];
  assert.equal(건.caseDir, '7. 컨설턴트,위원신청등/2026년/2026 충남청');
  assert.ok(건.files.every((f) => f.relPath.startsWith(Scan.CASE_ROOT + '/')), '⚠ 건 파일 경로가 번호 없는 이름으로 남았습니다');
  assert.ok(결과.promotions.concat(결과.maybes).every((p) => !p.relPath || p.relPath.startsWith(Scan.CASE_ROOT + '/')), '⚠ 승격 후보 경로가 번호 없는 이름으로 남았습니다');
  assert.equal(입력[0].relPath.startsWith('컨설턴트'), true, '입력 자료는 바꾸지 않는다(복사본만)');
});
test('⑥ 전체 스캔(fsScanAll) — 서류 폴더 바로 아래의 번호 없는 7번 폴더는 경로가 «번호 있는 이름»으로 적힌다 · 다른 폴더는 그대로', async () => {
  const 파일 = (n) => ({ kind: 'file', name: n, getFile: async () => ({ size: 5, lastModified: 0 }) });
  const 건 = new 폴더('접수서류'); 건.kids = { '신청서.pdf': 파일('신청서.pdf') };
  const 칸 = new 폴더('컨설턴트,위원신청등', { '2026년': new 폴더('2026년', { '2026 ○○': new 폴더('2026 ○○', { '접수서류': 건 }) }) });
  const 이름 = new 폴더('1. 컨설팅자료', { '메모.txt': 파일('메모.txt') });
  const 루트 = new 폴더('서류', { '컨설턴트,위원신청등': 칸, '1. 컨설팅자료': 이름 });
  const ctx = { Promise, Date, String, console, KcareerScan: Scan, KcareerCases: Cases, toast: () => {}, fsRoot: async () => 루트 };
  vm.createContext(ctx); vm.runInContext(떼기(KC, 'async function fsScanAll('), ctx);
  const 목록 = [...(await ctx.fsScanAll())].map((f) => f.relPath).sort();
  assert.deepEqual(목록, ['1. 컨설팅자료/메모.txt', '7. 컨설턴트,위원신청등/2026년/2026 ○○/접수서류/신청서.pdf'], '⚠ 번호 없는 7번 폴더 경로가 그대로 적혔습니다 — 건 등록 경로와 달라 같은 파일이 두 번 올라갑니다');
});
test('⑥ 번호 있는 PC 에서 «번호 없는 경로»로 적힌 옛 기록도 열린다 — _fsDir 가 번호 있는 이름을 후보로 둔다', async () => {
  const c = 도구(), 있는 = new 폴더('서류', { '7. 컨설턴트,위원신청등': new 폴더('7. 컨설턴트,위원신청등') });
  assert.equal((await c._fsDir(있는, '컨설턴트,위원신청등')).name, '7. 컨설턴트,위원신청등');
});
test('⑥ _fsDir — create 를 줘도 «이미 있는 폴더»가 있으면 새로 만들지 않는다 · 어느 쪽도 없을 때만 정확한 이름으로 만든다', async () => {
  const c = 도구();
  const 번호없음만 = new 폴더('서류', { '컨설턴트,위원신청등': new 폴더('컨설턴트,위원신청등') });
  const 찾음 = await c._fsDir(번호없음만, '7. 컨설턴트,위원신청등', { create: true });
  assert.equal(찾음.name, '컨설턴트,위원신청등'); assert.deepEqual(번호없음만.만든것, [], '⚠ 번호 없는 폴더가 이미 있는데 번호 있는 폴더를 새로 만들었습니다');
  const 빈 = new 폴더('서류', {});
  const 만듦 = await c._fsDir(빈, '7. 컨설턴트,위원신청등', { create: true });
  assert.equal(만듦.name, '7. 컨설턴트,위원신청등'); assert.deepEqual(빈.만든것, ['7. 컨설턴트,위원신청등'], '어느 쪽도 없으면 정확한 이름으로 한 번 만든다');
});
test('⑥ 전체 스캔이 올린 파일은 건 등록(fsCaseFiles) 경로와 같은 키 — 이미 등록한 것을 «새 파일»로 또 올리지 않는다', () => {
  const 건등록경로 = Cases.caseDirOf('2026년', '2026 ○○') + '/접수서류/신청서.pdf';
  const 스캔경로 = Scan.canonRelPath('컨설턴트,위원신청등/2026년/2026 ○○/접수서류/신청서.pdf');
  assert.equal(스캔경로, 건등록경로, '⚠ 두 길의 경로가 다르면 fsKnownKeys(경로|크기|수정일)가 어긋나 같은 파일이 두 번 등록됩니다');
});

/* ───────── ⑦ 재검증 1회차(2026-11-15) 지적 ───────── */
test('⑦ 이 고침 전에 번호 없는 PC 에서 저장한 옛 기록(번호 없는 경로)도 «이미 등록한 파일»로 알아본다 — 새 스캔이 또 올리지 않는다', () => {
  const 옛 = { id: 'W-1', src: 'fs', relPath: '컨설턴트,위원신청등/2024년/2024 ○○/접수서류/위촉장.pdf', fileSize: 10, fileMtime: '2024-01-01T00:00:00.000Z' };
  const 건 = { id: 'S-1', files: [{ relPath: '컨설턴트,위원신청등/2025년/2025 ○○/접수서류/신청서.pdf', size: 20, mtime: '2025-01-01T00:00:00.000Z' }] };
  const ctx = { KcareerScan: Scan, get: (k) => (k === 'wiccok' ? [옛] : k === 'submission' ? [건] : []) };
  vm.createContext(ctx); vm.runInContext(떼기(KC, 'function fsKnownKeys('), ctx);
  const 키 = ctx.fsKnownKeys();
  /* 새 스캔은 경로를 «번호 있는 이름»으로 만든다 */
  assert.ok(키['7. 컨설턴트,위원신청등/2024년/2024 ○○/접수서류/위촉장.pdf|10|2024-01-01T00:00:00.000Z'], '⚠ 옛 기록(번호 없는 경로)을 통일해서 견주지 않아 같은 파일이 «새 파일»로 또 올라갑니다');
  assert.ok(키['7. 컨설턴트,위원신청등/2025년/2025 ○○/접수서류/신청서.pdf|20|2025-01-01T00:00:00.000Z'], '건 안의 파일도 같다');
  assert.ok(키['컨설턴트,위원신청등/2024년/2024 ○○/접수서류/위촉장.pdf|10|2024-01-01T00:00:00.000Z'], '적힌 그대로의 키도 둔다');
  assert.equal(옛.relPath.startsWith('컨설턴트'), true, '기록 자체는 고치지 않는다(견주는 키만 늘린다)');
  const 증명서 = strip(떼기(KC, 'async function cdScanNow('));
  assert.match(증명서, /known\[KcareerScan\.canonRelPath\(r\.relPath\)\]\s*=\s*true/, '증명서 스캔의 «이미 등록한 경로»도 같은 규칙');
});
test('⑦ 서류 폴더 바로 아래에 «7. …»과 번호 없는 폴더가 둘 다 있으면 번호 없는 쪽은 건너뛰고 알린다 — 기록의 경로는 늘 번호 있는 이름이라 번호 없는 쪽 파일은 열 수 없는 기록이 된다', async () => {
  const 파일 = (n) => ({ kind: 'file', name: n, getFile: async () => ({ size: 5, lastModified: 0 }) });
  const 건 = (이름) => new 폴더(이름, { '2024년': new 폴더('2024년', { '2024 ○○': new 폴더('2024 ○○', { '접수서류': new 폴더('접수서류', { [이름 + '.pdf']: 파일(이름 + '.pdf') }) }) }) });
  const 알림 = [];
  const ctx = { Promise, Date, String, console, KcareerScan: Scan, KcareerCases: Cases, toast: (m) => 알림.push(m),
    fsRoot: async () => new 폴더('서류', { '7. 컨설턴트,위원신청등': 건('번호있는쪽'), '컨설턴트,위원신청등': 건('번호없는쪽') }) };
  vm.createContext(ctx); vm.runInContext(떼기(KC, 'async function fsScanAll('), ctx);
  const 파일들 = [...(await ctx.fsScanAll())];
  assert.deepEqual(파일들.map((f) => f.name), ['번호있는쪽.pdf'], '⚠ 번호 없는 쪽 파일까지 «번호 있는 폴더» 경로로 기록되면 열 때 못 엽니다');
  assert.ok(파일들.every((f) => f.relPath.startsWith('7. 컨설턴트,위원신청등/')));
  assert.equal(알림.length, 1, '건너뛴 사실을 한 번 알린다');
  assert.match(알림[0], /둘 다 있어/); assert.ok(알림[0].includes('컨설턴트,위원신청등'));
  /* 번호 없는 폴더만 있을 때는 건너뛰지 않고 번호 있는 이름으로 적는다 */
  const 알림2 = [], ctx2 = { Promise, Date, String, console, KcareerScan: Scan, KcareerCases: Cases, toast: (m) => 알림2.push(m), fsRoot: async () => new 폴더('서류', { '컨설턴트,위원신청등': 건('번호없는쪽') }) };
  vm.createContext(ctx2); vm.runInContext(떼기(KC, 'async function fsScanAll('), ctx2);
  const 하나 = [...(await ctx2.fsScanAll())];
  assert.equal(하나.length, 1); assert.ok(하나[0].relPath.startsWith('7. 컨설턴트,위원신청등/')); assert.equal(알림2.length, 0);
});
test('⑦ 폴더에 원본이 없을 때 클라우드 사본 찾기 — 번호 없는 이름으로 적힌 옛 기록도 번호 있는 경로로 물으면 찾는다', async () => {
  const 옛 = { id: 'W-1', src: 'fs', relPath: '컨설턴트,위원신청등/2024년/2024 ○○/접수서류/위촉장.pdf', fsCloud: 'kcareer/W-1.pdf' };
  const 받은 = [];
  const ctx = { KC_FS_STORES: ['wiccok'], KcareerScan: Scan, get: (k) => (k === 'wiccok' ? [옛] : []),
    kcFormStorage: () => ({ ref: (자리) => ({ getDownloadURL: async () => { 받은.push(자리); return '주소-' + 자리; } }) }),
    kcFetch: async () => ({ arrayBuffer: async () => new ArrayBuffer(3) }), String, console };
  vm.createContext(ctx); vm.runInContext(떼기(KC, 'async function _fsCloudFile('), ctx);
  const 찾음 = await ctx._fsCloudFile('7. 컨설턴트,위원신청등/2024년/2024 ○○/접수서류/위촉장.pdf');
  assert.ok(찾음, '⚠ 번호 없는 이름으로 적힌 옛 기록의 클라우드 사본을 못 찾습니다');
  assert.deepEqual(받은, ['kcareer/W-1.pdf']); assert.equal(찾음.name, '위촉장.pdf');
  assert.equal(await ctx._fsCloudFile('7. 컨설턴트,위원신청등/2024년/다른 건/접수서류/위촉장.pdf'), null, '경로가 다르면 찾지 않는다');
});
test('⑦ 지원 메일 — 이 길의 모집 대상 낱말은 «지원단·상담위원·전문위원·자문위원·평가위원·심사위원·컨설턴트·인력풀»뿐, 고객 노무 업무(대지급금·등기·직업훈련 …)와 회사 꼴 괄호는 지원이 아니다', () => {
  for (const 제목 of ['공인노무사 신청서 제출(김가나, 대지급금)', '임원 변경 신청서 제출(가나상사, 등기)', '강사 신청서 제출(가나기업, 직업훈련)', '충남 비즈니스지원단 신청서 제출(가나산업, 컨설팅)',
    '충남 비즈니스지원단 신청서 제출(홍길동, 대지급금)', '충남 비즈니스지원단 신청서 제출(홍길동, 실업급여)']) {
    assert.equal(분류(제목, true), null, '⚠ 고객 노무 업무를 지원으로 적습니다: ' + 제목);
  }
  assert.ok(분류('○○ 평가위원 신청서 제출(홍길동, 경영)', true), '평가위원 모집도 같은 꼴이면 지원이다');
});
