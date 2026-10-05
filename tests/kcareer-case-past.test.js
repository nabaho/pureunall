'use strict';
/* 📚 지난 지원 건 모두 넣기 (대표 지시 2026-10-05 「지난건 년도별로 넣어라」 — 목업 ①)
   ① 해마다 센다(최근 해 먼저) ② 고른 해만 넣는다 · 이미 넣은 건은 건너뛴다
   ③ 파일은 폴더에 그대로(이름·크기·수정일만) · 승격 없음 · 한 번에 저장
   ④ 지난 건은 «새로» 딱지를 안 단다 — 정말 새 건이 묻히지 않게 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/kcareer-cases.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 건 = (y, n) => ({ yearDir: y, name: n });

test('① 해마다 센다 — 최근 해 먼저, 연도 없는 폴더는 한 줄로', () => {
  const g = C.groupByYear([건('2024년', 'a'), 건('2026년', 'b'), 건('2024년', 'c'), 건('기타', 'd')]);
  assert.deepEqual(g.map((x) => x.year + ':' + x.n), ['2026:1', '2024:2', ':1']);
});

function 상자(통, 고른해) {
  let 저장횟수 = 0;
  const ctx = { console, JSON, Date, String, Number, Math, KcareerCases: C, NS: 'kc_',
    통, get: (k) => 통[k] || [], set: (k, v) => { 통[k] = v; 저장횟수++; },
    LS: { get: (k) => 통['LS:' + k] || '', set: (k, v) => { 통['LS:' + k] = v; } },
    kcNextNo: (p, w, s, extra) => p + String((extra || []).length + 1).padStart(w, '0'),
    fsCaseFiles: async (h, pre) => [{ name: '2-1. 자격증 사본.pdf', relPath: pre + '/2-1. 자격증 사본.pdf', size: 10, mtime: '2024-01-01T00:00:00Z' }],
    toast() {}, caseBannerDraw() {}, renderCareer() {},
    document: { getElementById: () => ({ classList: { remove() {} }, disabled: false, textContent: '' }),
      querySelectorAll: () => 고른해.map((v) => ({ value: v })) } };
  vm.createContext(ctx);
  vm.runInContext(['var _caseFound={fresh:[],changed:[]};', 떼기('function _caseDismissed('), 떼기('function _casePastYears('),
    'function casePastSum(){}', 떼기('async function casePastGo(')].join('\n'), ctx);
  return { ctx, 저장횟수: () => 저장횟수 };
}

test('★★ 고른 해만 · 파일은 자리만 · 승격 없음 · 한 번에 저장', async () => {
  const 통 = { submission: [{ id: 'SB0001', caseDir: C.caseDirOf('2025년', '이미 있는 건') }], 'LS:kc_case_dismissed': JSON.stringify([C.caseDirOf('2024년', '나중에로 미룬 건')]) };
  const 찾은 = [건('2025년', '이미 있는 건'), 건('2024년', '나중에로 미룬 건'), 건('2024년', '가나공단 위원'), 건('2019년', '다라시 강사')];
  const fresh = C.freshCases(찾은, 통.submission, [], { withDismissed: true });
  assert.equal(fresh.length, 3, '이미 있는 건은 빼고, 미룬 건은 다시 보인다');
  const { ctx, 저장횟수 } = 상자(통, ['2024']);
  const byKey = {}; 찾은.forEach((d) => { byKey[C.caseDirOf(d.yearDir, d.name)] = Object.assign({ handle: {} }, d); });
  ctx._casePast = { fresh, byKey, years: C.groupByYear(fresh) };
  await ctx.casePastGo();
  const 새 = 통.submission.filter((r) => r.pastImport);
  assert.deepEqual(새.map((r) => r.title).sort(), ['나중에로 미룬 건', '가나공단 위원'].sort(), '★ 고른 해(2024)만');
  assert.equal(저장횟수(), 1, '★ 한 번에 저장 — 나눠 저장하면 그때마다 클라우드로 올라간다');
  assert.ok(새.every((r) => r.files.length === 1 && !r.files[0].base64 && r.files[0].relPath), '파일은 자리만');
  assert.ok(새.every((r) => (r.promoted || []).length === 0), '★ 위촉장·자격증으로 올리지 않는다');
  assert.equal(new Set(통.submission.map((r) => r.id)).size, 통.submission.length, '번호가 겹치면 안 된다');
  assert.equal(JSON.parse(통['LS:kc_case_dismissed']).length, 0, '넣은 건은 «나중에» 목록에서도 뺀다');
});

test('④ 지난 건은 «새로» 딱지를 안 단다 · 단추와 창이 있다', () => {
  assert.match(SRC, /r\.autoCase&&!r\.pastImport&&!r\.sentAt&&!r\.result\?' <span class="tag navy"[^>]*>새로/);
  assert.match(SRC, /onclick="caseImportPast\(\)"[^>]*>📚 지난 건 모두 넣기/);
  assert.ok(SRC.indexOf('id="modalCasePast"') > 0);
  const imp = 떼기('async function caseImportPast(');
  assert.match(imp, /freshCases\(dirs, get\('submission'\), \[\], \{ withDismissed:true \}\)/, '★ 지난 건이니 «올해부터» 거르개를 안 쓴다');
  assert.ok(!/arrayBuffer/.test(떼기('async function casePastGo(')), '★ 파일 내용을 읽지 않는다(OneDrive 가 통째로 내려온다)');
});
