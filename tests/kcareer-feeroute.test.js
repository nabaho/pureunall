'use strict';
/* 이력서 보관함에 잘못 들어온 «비용 서류»를 비용관리로 자동으로 보낸다 (대표 지시 2026-11-15)
   「회의 비용관리에 있어야 될 내용이 이력서 관리에 있다. 잘못 입력되면 자동으로 비용관리로 보내게 해달라」
   대표 결정(같은 날): Jev(외부 AI)는 쓰지 않고 «규칙으로 자동 분류» — 서류 글이 밖으로 나가지 않는다.

   규칙만 못 박는다(값·낱말 개수·문구 말고):
   ① 판정은 «협회 서류 + 돈 받은 확인 낱말», 이름이 이력서·프로필·증명서류면 제외, 사람이 정한 것(keep)이 이긴다, 확신 없으면 안 옮긴다
   ② 판정 결과에 본문 조각이 안 실린다(근거를 화면에 보일 때 개인정보가 새지 않게)
   ③ 입구가 아니라 «보관함에 쓰는 자리(set)»에서 잡는다 — 어느 입구로 들어와도 같은 판정 · 자동 대상은 이력서 보관함뿐
   ④ 자동은 «이 화면을 연 순간 이후에 담긴 것»만, 예전 것은 대표가 누르는 「🧾 비용 서류 찾기」로 목록을 보고 옮긴다(고르기만으로는 안 바뀐다)
   ⑤ 옮기기는 지우기가 아니다 — 새 번호로 새 자리에 «먼저» 쓰고, «이 기기에 담긴 것을 확인한 뒤에만» 옛 자리에서 뺀다. 되돌리면 «사람이 정함»(feeKeep)을 남긴다
      (검증 2026-11-15: 저장공간이 차서 못 담았는데 원본을 빼면 기록이 사라진다 · 기본 저장소(KV)는 받기만 하고 true · 같은 번호로 두 통에 걸치면 다른 기기 옛 사본과 합칠 때 양쪽에 남는다)
   ⑥ 이 일을 하는 코드는 서버·AI 를 부르지 않는다 · 글은 «이 기기에 있는 파일»만 읽는다(창고에서 내려받지 않는다)
   ⑦ 압축 파일(hwpx·docx)은 «푼 만큼»을 세어 상한에서 멈춘다(이름이 .hwp 여도 속이 압축이면 같은 길) · 훑기 창은 닫고 다시 열어도 옛 훑기가 새 목록에 안 섞인다 · 창 접근성(초점) · 폰·어두운 테마
   실행: node --test tests/kcareer-feeroute.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const F = require('../js/kcareer-feeroute.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const MOD = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-feeroute.js'), 'utf8');
const CSS = SRC.slice(0, SRC.indexOf('</style>'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 이(가) 없습니다');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
/* 이 일을 하는 코드 덩이 — 머리글(대표 지시 2026-11-15)부터 «renderRhDocList 를 되살리지 말 것» 앞까지 */
const 덩이 = (() => { const a = SRC.indexOf('var KC_FEE_SRC='), b = SRC.indexOf('⚠ renderRhDocList 를 되살리지 말 것'); assert.ok(a > 0 && b > a, '비용 서류 코드 덩이를 못 찾았습니다'); return SRC.slice(a, b); })();

/* ───────── ① 판정 규칙 ───────── */
test('① 협회 지급확인서(상담비)는 비용 서류 — 파일 이름이 비어 있어도 기관·본문으로 알아본다', () => {
  const j = F.judge({ name: '____________2026.10.12', kind: '기타', org: '○○지역협회', text: '지급확인서 및 개인정보 수집 이용 동의서 지급금액 상담비' });
  assert.equal(j.fee, true);
  assert.ok(F.KINDS.includes(j.kind), '비용 서류 종류 이름이어야 합니다');
});
test('① 협회가 아닌 곳의 지급확인서는 그대로 둔다(대표 지시 2026-10-12 「비용관리 한정 협회」)', () => {
  assert.equal(F.judge({ name: '지급확인서.hwpx', org: '(주)가나다', text: '지급확인서 노무 상담비' }).fee, false);
});
test('① 이름·종류가 이력서·프로필이면 본문 낱말이 있어도 비용 서류가 아니다', () => {
  for (const name of ['이력서-협회제출.hwpx', '프로필(강사료 포함)', '경력기술서', '자기소개서', '약력']) {
    assert.equal(F.judge({ name, org: '협회', text: '강사료 지급확인서' }).fee, false, name);
  }
  assert.equal(F.judge({ name: 'x', kind: '일반 이력서', org: '협회', text: '지급확인서' }).fee, false);
});
test('① 이름·종류가 «증명서·위촉장·활동확인서»류면 본문에 강사료가 있어도 비용 서류가 아니다(경력 증빙) — 지급확인서는 여전히 비용 서류', () => {
  for (const name of ['강의경력증명서.pdf', '재직증명서', '위촉장.pdf', '활동확인서', '위촉증명서', '강의확인서']) assert.equal(F.judge({ name, org: '협회', text: '강사료 지급확인서' }).fee, false, name);
  assert.equal(F.judge({ name: '지급확인서.pdf', org: '협회', text: '지급확인서' }).fee, true);
});
test('① 돈 받은 낱말이 없으면 옮기지 않는다 — 위촉장의 「수당을 지급한다」 한 줄로는 안 된다', () => {
  assert.equal(F.judge({ name: '위촉장.pdf', org: '한국공인노무사회협회', text: '위촉 수당을 지급한다' }).fee, false);
});
test('① 사람이 정한 것(keep)이 이긴다', () => {
  assert.equal(F.judge({ name: 'x', org: '협회', text: '지급확인서', keep: 1 }).fee, false);
});
test('① 띄어쓰기·줄바꿈이 끼어도 알아본다(「지급 확인서」)', () => {
  assert.equal(F.judge({ name: 'x', org: '협회', text: '지 급\n확인서' }).fee, true);
});
test('① 종류는 비용 서류 종류 안에서만 — kcareer.html 의 KIND_DEFAULTS.feedoc 과 같은 이름', () => {
  const m = SRC.match(/feedoc:\[([^\]]+)\]\s*\};/); assert.ok(m, 'KIND_DEFAULTS.feedoc 를 못 찾았습니다');
  const 화면 = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(F.KINDS, 화면, '규칙의 종류와 화면의 종류가 어긋났습니다 — 옮긴 서류가 엉뚱한 종류로 남습니다');
  for (const r of [{ text: '참석 확인서' }, { text: '지급확인서' }, { text: '수당 지급 신청서' }, { text: '개인정보 수집 동의서' }, { text: '' }]) assert.ok(F.KINDS.includes(F.kindOf(r.text)), JSON.stringify(r));
});

/* ───────── ② 근거에 본문이 안 실린다 ───────── */
test('② 판정 결과(why·words)에는 본문 조각·이름·번호가 담기지 않는다', () => {
  const 비밀 = '홍길동 800101-1234567 서울시 서초구 123-456-7890';   /* 가짜 — 진짜 이름·주민번호를 넣지 않는다(이 저장소는 공개, tests/kcareer-nopersonal.test.js) */
  const j = F.judge({ name: 'x', org: '협회', text: '지급확인서 ' + 비밀 });
  const 결과 = JSON.stringify(j);
  for (const 조각 of ['홍길동', '800101', '1234567', '서초구', '7890']) assert.ok(!결과.includes(조각), 조각 + ' 이(가) 결과에 실렸습니다');
});

/* ───────── ③ 입구가 아니라 쓰는 자리에서 ───────── */
test('③ set() 한 곳에서 이력서 보관함 쓰기를 잡는다 — 입구마다 따로 부르지 않는다 · 프로필·증명서 보관함은 자동 대상이 아니다', () => {
  const set = strip(떼기('function set(key,arr){'));
  assert.match(set, /key==='resume'\s*&&\s*typeof feeRouteSoon/);
  assert.ok(!/key==='profile'[^)]*feeRouteSoon|key==='certdoc'[^)]*feeRouteSoon/.test(set), '⚠ 경력 증빙에 강사료가 적혀 있다고 증명서·프로필 보관함의 서류를 자동으로 옮기면 안 된다(검증 2026-11-15)');
  assert.deepEqual(JSON.parse(strip(덩이).match(/var KC_FEE_AUTO=(\[[^\]]*\])/)[1].replace(/'/g, '"')), ['resume']);
  assert.match(set, /typeof feeRouteSoon==='function'/, '아직 안 정의됐을 때(부팅 순간) 터지면 안 된다');
});
test('③ 쓰는 자리 판정은 «기다렸다 한 번에»(디바운스)이고 같은 서류를 두 번 열지 않는다', () => {
  const 쓰기 = strip(떼기('function feeRouteSoon('));
  assert.match(쓰기, /if\(_feeT/); assert.match(쓰기, /setTimeout/);
  const f = strip(떼기('async function feeRouteFresh('));
  assert.match(f, /_feeDone\[/);
});

/* ───────── ④ 자동은 새로 들어온 것만, 예전 것은 대표가 눌러서 ───────── */
test('④ 자동 판정은 «이 화면을 연 순간 이후에 담긴 것»만 본다(savedAt) — 여유 시간을 두지 않는다', () => {
  const f = strip(떼기('function _feeFresh('));
  assert.match(f, /savedAt/); assert.match(f, />=\s*_feeBoot/); assert.match(f, /feeKeep/); assert.match(f, /feeFrom/);
  const 시작 = strip(덩이).match(/var _feeBoot=([^,;]+)/); assert.ok(시작, '_feeBoot 를 못 찾았습니다');
  assert.ok(!/-\s*\d/.test(시작[1]), '⚠ 화면을 연 시각에서 «빼면» 직전 화면에서 담은 예전 서류가 허락 없이 열려 옮겨집니다(검증 2026-11-15)');
});
test('④ 예전 서류는 「🧾 비용 서류 찾기」 단추 → 목록(☐+№) → 고른 것만 옮긴다 — 고르기만으로는 안 바뀐다', () => {
  assert.match(SRC, /onclick="feeSweepOpen\(\)"[^>]*>🧾 비용 서류 찾기</, '이력서 보관함 단추가 없습니다');
  assert.match(SRC, /id="modalFeeSweep"[\s\S]{0,300}role="dialog" aria-modal="true" aria-labelledby="feeSwTitle"/);
  const d = strip(떼기('function feeSweepDraw('));
  assert.match(d, /class="rownum-h"/); assert.match(d, /class="rownum"/); assert.match(d, /class="row-chk"/, '☐ + № 규칙(목록 맨 왼쪽)');
  assert.match(d, /id="feeSwAll"/, '머리줄 ☐');
  const 열기 = strip(떼기('async function feeSweepOpen('));
  assert.ok(!/feeMove\(/.test(열기) && !/set\(/.test(열기), '훑기만으로 옮기거나 저장하면 안 된다');
  const 가기 = strip(떼기('async function feeSweepGo('));
  assert.match(가기, /S\.on\[/, '고른 것만 옮긴다'); assert.match(가기, /feeMove\(/); assert.match(가기, /kcUndoBar\(/, '되돌리기');
  assert.match(strip(떼기('function feeSweepDraw(')), /건 선택/, '「N건 선택」을 띄운다');
});
test('④ 사람이 보관함을 직접 고른 서류는 feeKeep — 자동이 건드리지 않는다', () => {
  assert.match(SRC, /if\(_rhModeTouched && domain==='resume'\) entry\.feeKeep=1;/);
});

/* ───────── ⑤ 옮기기는 지우기가 아니다 — 가짜 보관함으로 돌려 본다 ───────── */
function 판() {
  const 저장 = { resume: [], profile: [], certdoc: [], feedoc: [] }; const 쓴순서 = [];
  const ctx = { Object, Date, Promise, console, Array, String, JSON, Math };
  ctx.실패 = {};                                                   /* 이 열쇠로 쓰면 «기기에 못 담았다»(저장공간 부족)를 흉내 낸다 */
  ctx.get = (k) => JSON.parse(JSON.stringify(저장[k] || []));
  ctx.set = function (k, v) { 쓴순서.push(k + ':' + (v || []).length); 저장[k] = JSON.parse(JSON.stringify(v)); ctx.set._lastOk = !ctx.실패[k]; };
  ctx.kindsOf = () => F.KINDS.slice(); ctx._safe = (fn) => { try { fn(); } catch (e) {} }; ctx.renderDocStore = () => {}; ctx.알림들 = [];
  ctx.toast = (m) => ctx.알림들.push(m);
  ctx.kcUndoBar = (msg, tid, fn) => { ctx.막대 = { msg, fn }; }; ctx.KcareerFeeRoute = F;
  ctx.KV = { errors: 0, flush: async () => { if (ctx.KV실패) ctx.KV.errors++; } };   /* 기본 저장소(KV): 쓰기를 받기만 하고, 못 담았으면 flush 뒤에 errors 가 는다 */
  Object.assign(ctx, { KC_FEE_SRC: ['resume', 'profile', 'certdoc'], KC_FEE_AUTO: ['resume'], FEE_SRC_LABEL: {}, _feeBoot: Date.now() - 60000, _feeT: null, _feeBusy: false, _feeDone: {}, _feeSeq: 0,
    읽은것: [], feeDocText: async (r) => { ctx.읽은것.push(r.id); return ctx.글[r.id] || ''; }, 글: {} });
  vm.createContext(ctx);
  vm.runInContext([떼기('function _feeFresh('), 떼기('function _feeJudgeRec('), 떼기('function _feeNewId('), 떼기('async function _feeSaved('), 떼기('function _feeKvErrors('), 떼기('async function feeMove('), 떼기('async function feeUndo('), 떼기('function _feeMovedNote('), 떼기('async function feeRouteFresh(')].join('\n'), ctx);
  return { ctx, 저장, 쓴순서 };
}
const 지금 = () => new Date().toISOString();
test('⑤ feeMove — 새 번호로 새 자리(비용 서류)에 «먼저» 쓰고 옛 보관함에서 뺀다 · 같은 파일 · 종류는 비용 서류 종류로', async () => {
  const { ctx, 저장, 쓴순서 } = 판();
  저장.resume = [{ id: 'resume_1', kind: '기타', org: '협회', genFileId: 'f1', genName: '지급확인서.hwpx', savedAt: 지금() }, { id: 'resume_2', kind: '일반 이력서', genFileId: 'f2' }];
  const 옮김 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  assert.equal(옮김.length, 1);
  assert.deepEqual(쓴순서.slice(0, 2).map((x) => x.split(':')[0]), ['feedoc', 'resume'], '⚠ 순서가 거꾸로면 지운 것으로 적혀 클라우드가 되살린다');
  assert.notEqual(저장.feedoc[0].id, 'resume_1', '⚠ 같은 번호로 두 통에 걸치면 다른 기기 옛 사본과 합칠 때 양쪽에 남는다 — 새 번호여야 옛 번호가 «지운 기록표»에 적힌다');
  assert.equal(저장.feedoc[0].feeOrigId, 'resume_1'); assert.equal(저장.feedoc[0].genFileId, 'f1', '파일은 그대로');
  assert.equal(저장.feedoc[0].kind, '지급조서·영수증'); assert.equal(저장.feedoc[0].feeFrom, 'resume'); assert.equal(저장.feedoc[0].feeFromKind, '기타');
  assert.deepEqual(저장.resume.map((r) => r.id), ['resume_2'], '옛 번호는 빠지고 다른 서류는 그대로');
  assert.equal(옮김[0].id, 저장.feedoc[0].id, '돌려주는 것은 새 번호(되돌리기가 이것으로 찾는다)');
});
test('⑤ feeMove — 새 번호는 겹치지 않는다(한꺼번에 여러 건)', async () => {
  const { ctx, 저장 } = 판();
  저장.resume = [1, 2, 3].map((i) => ({ id: 'resume_' + i, kind: '기타', savedAt: 지금() }));
  await ctx.feeMove('resume', [1, 2, 3].map((i) => ({ id: 'resume_' + i, kind: '기타' })));
  const ids = 저장.feedoc.map((r) => r.id); assert.equal(new Set(ids).size, 3);
});
test('⑤ feeMove — 모르는 종류는 «기타»로, 없는 id 는 아무것도 안 바꾼다', async () => {
  const { ctx, 저장, 쓴순서 } = 판();
  저장.resume = [{ id: 'resume_1', kind: 'x', savedAt: 지금() }];
  assert.equal((await ctx.feeMove('resume', [{ id: 'nope', kind: '기타' }])).length, 0); assert.equal(쓴순서.length, 0, '아무것도 안 썼어야 합니다');
  await ctx.feeMove('resume', [{ id: 'resume_1', kind: '없는 종류' }]);
  assert.equal(저장.feedoc[0].kind, '기타');
});
test('⑤★ feeMove — 새 자리에 «못 담았으면»(저장공간 부족) 원본을 빼지 않는다 · 새 자리도 원래대로 · 알린다 (검증 2026-11-15 높음)', async () => {
  const { ctx, 저장 } = 판();
  const 원 = { id: 'resume_1', kind: '기타', org: '협회', genFileId: 'f1', savedAt: 지금() };
  저장.resume = [원]; 저장.feedoc = [{ id: 'feedoc_old', kind: '기타' }];
  ctx.실패.feedoc = true;
  const 옮김 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  assert.equal(옮김.length, 0, '못 담았으면 옮기지 않았다고 돌려줘야 한다');
  assert.deepEqual(저장.resume.map((r) => r.id), ['resume_1'], '⚠ 원본이 빠졌습니다 — 기록이 사라집니다');
  assert.deepEqual(저장.feedoc.map((r) => r.id), ['feedoc_old'], '새 자리는 원래대로');
  assert.ok(ctx.알림들.some((m) => /저장하지 못해/.test(m)), '사람에게 알려야 합니다');
});
test('⑤★ feeMove — 기본 저장소(KV·IndexedDB)는 쓰기를 «받기만 하고 true» 라서 flush 뒤 오류 횟수로 확인한다 — 못 담았으면 원본을 빼지 않는다 (재검증 2026-11-15 중간)', async () => {
  const { ctx, 저장 } = 판();
  저장.resume = [{ id: 'resume_1', kind: '기타', org: '협회', genFileId: 'f1', savedAt: 지금() }]; 저장.feedoc = [];
  ctx.KV실패 = true;                                       /* set()._lastOk 는 true(받았다)인데, 실제 IndexedDB 쓰기는 실패 */
  const 옮김 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  assert.equal(옮김.length, 0);
  assert.deepEqual(저장.resume.map((r) => r.id), ['resume_1'], '⚠ 원본이 빠졌습니다 — 이 기기에서 기록이 사라집니다');
  assert.equal(저장.feedoc.length, 0, '새 자리는 원래대로');
  ctx.KV실패 = false;
  assert.equal((await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }])).length, 1, '정상일 때는 옮긴다');
});
test('⑤ feeMove — 다른 탭·기기가 이미 같은 서류를 옮겼으면(feeOrigId 가 같다) 또 만들지 않고 이 자리에서만 뺀다 — 같은 서류가 두 줄이 되지 않는다', async () => {
  const { ctx, 저장 } = 판();
  저장.resume = [{ id: 'resume_1', kind: '기타', org: '협회', savedAt: 지금() }];
  저장.feedoc = [{ id: 'feedoc_x', kind: '지급조서·영수증', feeFrom: 'resume', feeOrigId: 'resume_1' }];
  const 옮김 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  assert.equal(옮김.length, 0); assert.equal(저장.feedoc.length, 1, '두 줄이 되었습니다'); assert.equal(저장.resume.length, 0, '이 자리에서는 빠져야 합니다');
});
test('⑤ feeUndo — 원래 보관함에 «먼저» 쓰고 비용 서류에서 뺀다 · 종류를 되살리고 feeKeep 을 남긴다 · 새 번호', async () => {
  const { ctx, 저장, 쓴순서 } = 판();
  저장.resume = [{ id: 'resume_1', kind: '기타', org: '협회', genFileId: 'f1', savedAt: 지금() }];
  const 새 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  쓴순서.length = 0;
  assert.equal(await ctx.feeUndo([새[0].id]), 1);
  assert.deepEqual(쓴순서.slice(0, 2).map((x) => x.split(':')[0]), ['resume', 'feedoc']);
  const 돌아옴 = 저장.resume[0]; assert.equal(돌아옴.kind, '기타'); assert.equal(돌아옴.feeKeep, 1); assert.equal(돌아옴.genFileId, 'f1');
  assert.ok(!('feeFrom' in 돌아옴) && !('feeAt' in 돌아옴) && !('feeOrigId' in 돌아옴)); assert.equal(저장.feedoc.length, 0);
  assert.notEqual(돌아옴.id, 새[0].id, '되돌려도 새 번호 — 비용 서류의 번호는 «지운 기록표»에 적혀야 한다');
  assert.equal(ctx._feeFresh(돌아옴), false, '되돌린 서류는 다시 안 옮긴다(사람이 정함)');
});
test('⑤★ feeUndo — 원래 보관함에 «못 담았으면» 비용 서류에서 빼지 않는다', async () => {
  const { ctx, 저장 } = 판();
  저장.resume = [{ id: 'resume_1', kind: '기타', org: '협회', savedAt: 지금() }];
  const 새 = await ctx.feeMove('resume', [{ id: 'resume_1', kind: '지급조서·영수증' }]);
  ctx.실패.resume = true;
  assert.equal(await ctx.feeUndo([새[0].id]), 0);
  assert.deepEqual(저장.feedoc.map((r) => r.id), [새[0].id], '⚠ 비용 서류에서 빠졌습니다 — 기록이 사라집니다');
  assert.equal(저장.resume.length, 0, '원래 보관함은 원래대로(빈 채)');
});
test('⑤ feeUndo — 비용 서류에서 직접 만든 서류(feeFrom 없음)는 건드리지 않는다', async () => {
  const { ctx, 저장 } = 판();
  저장.feedoc = [{ id: 'feedoc_9', kind: '기타' }];
  assert.equal(await ctx.feeUndo(['feedoc_9']), 0); assert.equal(저장.feedoc.length, 1);
});
test('⑤ set() 은 방금 쓴 것이 «이 기기에 담겼나»를 set._lastOk 로 알린다 — 반환값은 안 바꾼다(기존 호출자는 === false 를 본다)', () => {
  const set = strip(떼기('function set(key,arr){'));
  assert.match(set, /set\._lastOk=false;[\s\S]{0,80}LS\.set\(/, '쓰기 전에 false 로 두고');
  assert.match(set, /set\._lastOk=\(_담김!==false\)/, '쓴 결과를 적는다');
  assert.ok(!/return\s+_담김/.test(set), '반환값을 바꾸면 기존 호출자(=== false)가 달라진다');
});

/* ───────── 자동 흐름 전체 ───────── */
test('자동 — 새로 담긴 협회 지급확인서만 비용관리로 가고 알림(되돌리기)이 뜬다 · 예전 것·이력서·keep·비협회는 그대로', async () => {
  const { ctx, 저장 } = 판();
  const 예전 = new Date(Date.now() - 3600 * 1000).toISOString();
  저장.resume = [
    { id: 'new_fee', kind: '기타', org: '○○지역협회', genName: '____2026.10.12', genFileId: 'a', savedAt: 지금() },
    { id: 'old_fee', kind: '기타', org: '협회', genName: 'x', genFileId: 'b', savedAt: 예전 },
    { id: 'new_cv', kind: '일반 이력서', org: '협회', genName: '이력서.hwpx', genFileId: 'c', savedAt: 지금() },
    { id: 'new_keep', kind: '기타', org: '협회', genName: 'k', genFileId: 'd', savedAt: 지금(), feeKeep: 1 },
    { id: 'new_other', kind: '기타', org: '(주)가나다', genName: 'o', genFileId: 'e', savedAt: 지금() }];
  ctx.글 = { new_fee: '지급확인서 상담비', old_fee: '지급확인서', new_cv: '강사료', new_keep: '지급확인서', new_other: '지급확인서' };
  await ctx.feeRouteFresh();
  assert.equal(저장.feedoc.length, 1); assert.equal(저장.feedoc[0].feeOrigId, 'new_fee');
  assert.deepEqual(저장.resume.map((r) => r.id).sort(), ['new_cv', 'new_keep', 'new_other', 'old_fee'].sort());
  assert.ok(ctx.막대 && typeof ctx.막대.fn === 'function', '되돌리기 알림이 떠야 합니다');
  assert.ok(!ctx.읽은것.includes('old_fee'), '예전 서류는 열지 않는다'); assert.ok(!ctx.읽은것.includes('new_keep'), '사람이 정한 서류는 열지 않는다');
  ctx.읽은것.length = 0; await ctx.feeRouteFresh();
  assert.equal(ctx.읽은것.length, 0, '같은 서류를 두 번 열면 안 된다');
  ctx.막대.fn(); await new Promise((r) => setTimeout(r, 20)); assert.equal(저장.feedoc.length, 0); assert.ok(저장.resume.some((r) => r.genFileId === 'a' && r.feeKeep === 1), '되돌리면 이력서 보관함에 사람이 정한 것으로 돌아온다');
});
test('자동 — 증명서·프로필 보관함에 새로 담긴 서류는 비용 서류 낱말이 있어도 자동으로 옮기지 않는다(훑기 단추로만)', async () => {
  const { ctx, 저장 } = 판();
  저장.certdoc = [{ id: 'cd1', kind: '기타', org: '○○협회', genName: '강의 활동 증빙', genFileId: 'z', savedAt: 지금() }];
  저장.profile = [{ id: 'pf1', kind: '기타', org: '○○협회', genName: 'x', genFileId: 'y', savedAt: 지금() }];
  ctx.글 = { cd1: '강사료 영수증 협회', pf1: '지급확인서 협회' };
  await ctx.feeRouteFresh();
  assert.equal(저장.feedoc.length, 0); assert.equal(저장.certdoc.length, 1); assert.equal(저장.profile.length, 1); assert.equal(ctx.읽은것.length, 0, '열어 보지도 않는다');
});

/* ───────── ⑥ 밖으로 안 나간다 ───────── */
test('⑥ 이 일을 하는 코드(규칙 모듈 + 화면 덩이)는 서버·AI 를 부르지 않는다', () => {
  const 금지 = /fetch\s*\(|XMLHttpRequest|sendBeacon|PuAiCall|PuTypeSafe|typeSafe|typesafe|Jev\(|kcFetch|firebase\.functions|cloudfunctions/;
  assert.ok(!금지.test(strip(MOD)), '규칙 모듈이 밖을 부릅니다');
  assert.ok(!금지.test(strip(덩이)), '화면 코드가 밖을 부릅니다 — 서류 글이 밖으로 나가면 안 됩니다(대표 결정 2026-11-15)');
});
test('규칙 모듈 script 가 화면에 붙어 있다(캐시 번호는 박지 않는다)', () => {
  assert.match(SRC, /<script src="js\/kcareer-feeroute\.js\?v=\d+"><\/script>/);
  assert.ok(SRC.indexOf('js/kcareer-feeroute.js') < SRC.indexOf('var KC_FEE_SRC='), '쓰기 전에 불러야 합니다');
});
test('⑥ 글 읽기는 «이 기기에 있는 파일»만 — 창고(클라우드)에서 내려받지 않는다 (재검증 2026-11-15)', () => {
  const 글 = strip(덩이);
  assert.ok(!/getFileAsync\(|kcFormFromCloud\(/.test(글), '⚠ 훑기가 이 기기에 없는 파일을 창고에서 내려받아 기기 저장소에 담습니다(폰 저장공간·데이터)');
  assert.match(strip(떼기('async function feeDocText(')), /_feeLocalFile\(/);
  const 기기만 = strip(떼기('async function _feeLocalFile('));
  assert.match(기기만, /_openIDB\(\)/); assert.ok(!/_cache\[[^\]]+\]\s*=/.test(기기만), '읽은 것을 기억 사본에 쌓지 않는다');
});

/* ───────── ⑦ 압축 폭탄 · 훑기 창 · 접근성 · 폰 · 어두운 테마 ───────── */
test('⑦ 압축 파일은 «푼 만큼»을 세어 상한에서 멈춘다 — 헤더의 크기 표시는 거짓일 수 있다', async () => {
  const 상한 = 1000;
  const ctx = { Promise, Math }; vm.createContext(ctx);
  vm.runInContext(떼기('function _feeEntryText('), ctx);
  let 멈춤 = 0, 보냄 = 0;
  const 흐름 = () => { const h = {}; h.on = (ev, fn) => { h[ev] = fn; return h; }; h.pause = () => { 멈춤++; }; h.resume = () => { for (let i = 0; i < 1e6; i++) { if (멈춤) break; 보냄++; h.data && h.data('가'.repeat(400)); } h.end && h.end(); }; return h; };
  const 결과 = await ctx._feeEntryText({ internalStream: () => 흐름() }, 상한);
  assert.ok(결과.length <= 상한, '상한을 넘게 풀었습니다'); assert.ok(멈춤 >= 1, '상한에서 흐름을 멈춰야 합니다'); assert.ok(보냄 < 100, '멈춘 뒤에도 계속 풀었습니다(' + 보냄 + ')');
  assert.equal(await ctx._feeEntryText({ internalStream: () => { throw new Error('x'); } }, 상한), '', '풀다 터져도 던지지 않는다');
});
test('⑦ 글 읽기에는 구역 수·글자 수 상한이 있고 압축은 «흐름으로» 푼다(통째로 풀지 않는다)', () => {
  const f = strip(떼기('async function feeDocText('));
  assert.match(f, /FEE_ZIP_MAX_ENTRIES/); assert.match(f, /FEE_ZIP_MAX_CHARS/); assert.match(f, /_feeEntryText\(/);
  assert.ok(!/\.async\('string'\)/.test(f), '⚠ async("string") 은 상한 없이 통째로 푼다(압축 폭탄)');
  assert.match(strip(떼기('function _feeEntryText(')), /internalStream/);
});
test('⑦ 이름은 .hwp 인데 속은 압축(PK)인 파일은 한글 엔진 길(상한 없이 통째로 푼다)로 보내지 않고 상한 있는 길로 보낸다 (재검증 2026-11-15)', async () => {
  let 한글엔진 = 0; const 글들 = [];
  const 압축본 = Buffer.from('PK\x03\x04 가짜 압축').toString('base64');
  const ctx = { Promise, Object, String, Array, Math, console, atob: (b) => Buffer.from(b, 'base64').toString('binary'), FEE_ZIP_MAX_CHARS: 1000, FEE_ZIP_MAX_ENTRIES: 20,
    _feeLocalFile: async () => ({ base64: 압축본, ext: 'hwp', name: 'x.hwp' }), b64ToAb: (b) => Buffer.from(b, 'base64'), _pkPdfText: async () => '', _ensureJSZip: async () => {},
    _hwpTextOf: async () => { 한글엔진++; return '엔진'; },
    JSZip: { loadAsync: async () => ({ files: { 'Contents/section0.xml': {}, 'Contents/header.xml': {} }, file: (n) => { 글들.push(n); return { internalStream: () => { const h = {}; h.on = (e, f) => { h[e] = f; return h; }; h.pause = () => {}; h.resume = () => { h.data('<t>지급확인서</t>'); h.end(); }; return h; } }; } }) } };
  vm.createContext(ctx);
  vm.runInContext(떼기('function _feeEntryText(') + '\n' + 떼기('async function feeDocText('), ctx);
  const 결과 = await ctx.feeDocText({ genFileId: 'f', genName: 'x.hwp' });
  assert.equal(한글엔진, 0, '⚠ 압축 파일이 한글 엔진 길로 갔습니다 — 압축 폭탄 상한을 비켜 갑니다');
  assert.deepEqual(글들, ['Contents/section0.xml']); assert.match(결과, /지급확인서/);
});
test('⑦ 기본 저장소(KV)는 못 담은 쓰기 횟수(errors)를 센다 — flush 뒤에 늘었으면 방금 쓴 것이 이 기기에 안 담겼다', async () => {
  const KVmod = require('../js/kcareer-kv.js');
  const ls = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  const idb = { fail: false, getAll: async () => ({ [KVmod.MARK]: '1' }), put: async () => { if (idb.fail) throw new Error('quota'); }, del: async () => {} };
  const kv = KVmod.create({ ns: 'cm3_', ls, idb, onError: () => {} }); await kv.boot();
  assert.equal(kv.errors, 0);
  kv.set('cm3_a', '1'); await kv.flush(); assert.equal(kv.errors, 0, '잘 담기면 그대로');
  idb.fail = true; assert.equal(kv.set('cm3_b', '2'), true, '받기만 하고 true — 그래서 errors 를 봐야 한다'); await kv.flush();
  assert.equal(kv.errors, 1, '못 담은 쓰기를 세지 않으면 feeMove 가 원본을 빼 버린다');
});
function 가짜창(ctx) {
  const 칸 = () => ({ classList: { add() {}, remove() {}, contains() { return true; } }, focus() {}, textContent: '', innerHTML: '', contains: () => false, querySelectorAll: () => [], getAttribute: () => null, id: '', disabled: false });
  const els = {}; ctx.document = { getElementById: (id) => (els[id] = els[id] || Object.assign(칸(), { id })), activeElement: null, addEventListener() {}, removeEventListener() {} };
}
test('⑦ 훑기 창을 닫고 «다시 열어도» 옛 훑기의 결과가 새 목록에 섞이지 않는다 (검증 2026-11-15)', async () => {
  const 저장 = { resume: [{ id: 'r1', kind: '기타', org: '협회', genName: 'a', genFileId: 'f1' }], profile: [], certdoc: [] };
  const 열쇠 = []; const ctx = { Promise, Object, Array, String, JSON, console, Math, KcareerFeeRoute: F, KC_FEE_SRC: ['resume', 'profile', 'certdoc'], FEE_SRC_LABEL: {}, _feeSw: null, _feeSwFrom: null,
    get: (k) => JSON.parse(JSON.stringify(저장[k] || [])), toast: () => {}, escapeHtml: (s) => String(s), _jsAttr: (s) => String(s), feeSweepKey: () => {}, feeSweepClose: () => {} };
  가짜창(ctx);
  ctx.feeDocText = () => new Promise((res) => 열쇠.push(res));              /* 읽기 끝나는 때를 우리가 정한다 */
  vm.createContext(ctx);
  vm.runInContext([떼기('async function feeSweepOpen('), 떼기('function feeSweepDraw('), 떼기('function _feeJudgeRec(')].join('\n'), ctx);
  const 첫째 = ctx.feeSweepOpen(); await Promise.resolve();
  const 둘째 = ctx.feeSweepOpen(); await Promise.resolve();                    /* 첫 훑기가 읽는 중에 다시 연다 */
  assert.equal(열쇠.length, 2, '둘째 훑기도 읽기를 시작해야 한다');
  열쇠[1]('지급확인서'); await 둘째;                                            /* 둘째가 먼저 끝난다 */
  열쇠[0]('지급확인서'); await 첫째;                                            /* 옛 훑기가 늦게 끝난다 — 새 목록에 끼면 안 된다 */
  assert.equal(ctx._feeSw.rows.length, 1, '⚠ 옛 훑기의 결과가 새 목록에 섞였습니다(같은 서류가 두 줄)');
  assert.equal(ctx._feeSw.done, true);
});
test('⑦ 훑기 창 접근성 — 열면 제목으로 초점을 옮기고, Tab 은 창 안에서만 돌고, 닫으면 열기 전 자리로 돌려준다 · 다시 그려도 초점을 잃지 않는다', () => {
  assert.match(SRC, /id="feeSwTitle" tabindex="-1"/);
  const 열기 = strip(떼기('async function feeSweepOpen('));
  assert.match(열기, /_feeSwFrom=document\.activeElement/); assert.match(열기, /feeSwTitle[\s\S]{0,40}focus\(\)/); assert.match(열기, /addEventListener\('keydown', feeSweepKey\)/);
  const 닫기 = strip(떼기('function feeSweepClose('));
  assert.match(닫기, /removeEventListener\('keydown', feeSweepKey\)/); assert.match(닫기, /back\.focus\(\)/);
  const 키 = strip(떼기('function feeSweepKey('));
  assert.match(키, /e\.key!=='Tab'/); assert.match(키, /preventDefault\(\)/);
  const 그리기 = strip(떼기('function feeSweepDraw('));
  assert.match(그리기, /data-fid=/, '칸마다 번호표가 있어야 다시 그린 뒤 같은 칸을 찾는다'); assert.match(그리기, /\.focus\(\)/);
  assert.match(그리기, /aria-label=/, '칸마다 읽어 주는 이름');
});
test('⑦ 훑기 창 — 아래 줄은 폰에서 줄을 바꾸고(요약 글이 한 줄 전체 폭), 비활성 단추는 흐리게, 어두운 테마에는 표 머리·본문·단추가 한 벌이다 (재검증 2026-11-15)', () => {
  const 바탕 = strip(CSS);
  const 폰 = [...바탕.matchAll(/@media\s*\(\s*max-width\s*:\s*520px\s*\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  assert.match(폰, /#modalFeeSweep \.modal-foot\{[^}]*flex-wrap:\s*wrap/); assert.match(폰, /#modalFeeSweep #feeSwSum\{[^}]*flex:\s*1 1 100%/);
  assert.match(바탕, /#modalFeeSweep \.btn:disabled\{[^}]*opacity/);
  assert.match(바탕, /html\.dark #feeSwTbl table\{[^}]*background/); assert.match(바탕, /html\.dark #feeSwTbl tbody td\{[^}]*color/);
  assert.match(바탕, /html\.dark #feeSwTbl thead th\{[^}]*background[^}]*color/); assert.match(바탕, /html\.dark #modalFeeSweep \.btn:not\(\.primary\)\{[^}]*background[^}]*color/);
  /* 어떤 @media(max-width) 에도 안 든 «바탕» CSS — PC 가 보는 것 */
  let 밖 = 바탕; for (;;) { const m = /@media\s*\(\s*max-width\s*:\s*\d+px\s*\)\s*\{/.exec(밖); if (!m) break; let d = 0, i = 밖.indexOf('{', m.index); for (; i < 밖.length; i++) { if (밖[i] === '{') d++; else if (밖[i] === '}' && --d === 0) break; } 밖 = 밖.slice(0, m.index) + 밖.slice(i + 1); }
  assert.ok(!/#modalFeeSweep \.modal-foot\{/.test(밖) && !/#modalFeeSweep #feeSwSum\{/.test(밖), '폰 규칙이 PC 로 샜습니다');
  const 머리 = strip(떼기('function feeSweepDraw(')).match(/<th[^>]*>[^<]*<\/th>/g).join('');
  assert.ok((머리.match(/white-space:nowrap/g) || []).length >= 5, '표 머리 칸은 한 줄(한 칸 한 줄 규칙)');
});
test('⑦ 비용 서류 줄에 「↩ 원래 자리로」 단추가 있다 — 알림 막대(8초)를 놓쳐도 되돌릴 길이 남는다', () => {
  assert.match(SRC, /r\.feeFrom\?`<button class="btn sm"[^`]*onclick="feeUndoOne\('\$\{_jsAttr\(r\.id\)\}'\)">↩ 원래 자리로<\/button>`:''/);
  const u = strip(떼기('async function feeUndoOne(')); assert.match(u, /feeUndo\(\[id\]\)/);
});
