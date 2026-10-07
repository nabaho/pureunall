'use strict';
/* 전체 검토의 «남은 것» (대표 지시 2026-10-07 「남은것도 고쳐라」)
   화면: 정렬 덮어쓰기 · 어두운 화면 · 화면 이동 고리 · 비용 한눈에 · 직원 보기 수정 · 검색 비용 · 사업 되살리기 ·
         첫 자료 · 사업→실적 · 첨부 목록표 · 프로필 끌어놓기
   자료: 파일 저장 확인 · 5번 폴더 넣기 · 사업 서류 메모리 · 휴지통 창고 파일 · 긴 작업 덮어쓰기 · 직원 사본 · 첨부 조각 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = CODE.replace(/\/\*[\s\S]*?\*\//g, ' ');
function cut(decl) {
  const head = bare.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = bare.indexOf('{', head + decl.length - 1), d = 0;
  for (; i < bare.length; i++) { if (bare[i] === '{') d++; else if (bare[i] === '}') { d--; if (!d) break; } }
  return bare.slice(head, i + 1);
}

test('★★ 휴지통 30일 비우기도 창고 파일까지 — 사업에서 «빼기»만 한 서류 한 장도', () => {
  const 지움 = [], 이PC = [];
  const 통 = { kc_trash: [
    { tid: 'A', delAt: 1, files: ['f1'], rec: { stPath: 'kf/u/f1' } },
    { tid: 'B', delAt: 1, files: ['bzd_x'], fileOnly: 'bzd_x', bizDoc: { bizId: 'BZ1', doc: { id: 'bzd_x', stPath: 'kf/u/bzd_x' } } },
    { tid: 'C', delAt: Date.now(), files: ['f9'], rec: { stPath: 'kf/u/f9' } } ] };
  const ctx = { Date, Array, Object, JSON, TRASH_DAYS: 30, TRASH_STORE: 'kc_trash',
    get: (k) => JSON.parse(JSON.stringify(통[k] || [])), set: (k, v) => { 통[k] = v; },
    deleteFile: (id) => 이PC.push(id), kcFormStorage: () => ({ ref: (p) => ({ delete: () => { 지움.push(p); return Promise.resolve(); } }) }) };
  vm.createContext(ctx);
  vm.runInContext('function kcTrashList(){ return get(TRASH_STORE); }' + cut('function kcTrashDue(') + cut('function _kcTrashFree(') + cut('function kcTrashSweep('), ctx);
  assert.equal(vm.runInContext('kcTrashSweep()', ctx), 2);
  assert.deepEqual(이PC.sort(), ['bzd_x', 'f1']);
  assert.deepEqual(지움.sort(), ['kf/u/bzd_x', 'kf/u/f1'], '★ 30일 비우기가 창고를 안 비우면 아무도 못 꺼내는 파일에 요금만 나간다');
  assert.equal(통.kc_trash.length, 1, '아직 기한이 안 된 것은 남는다');
});

test('★★ 파일 저장은 «끝까지 기다릴 수» 있다 — 저장한 뒤 원본을 지우는 길은 기다린다', () => {
  assert.match(cut('function saveFileWait('), /tx\.onerror=tx\.onabort=/, '실패·중단을 잡아야 «못 담았다»를 안다');
  assert.match(cut('function saveFileUnified('), /saveFileWait\(id,file,o\)/, '한 길로 담는다');
  assert.match(bare, /moved=await saveFileWait\(primaryId/, '★ 중복 합치기는 옮긴 것이 «다 들어간 뒤»에만 나머지를 지운다');
});

test('★★ 5번 폴더 넣기 — 파일마다 따로 잡고, 열 개마다 중간 저장, 담는 동안 받아 오기 멈춤', () => {
  const f = cut('async function docImportResumeFolder(');
  assert.match(f, /catch\(err\)\{ console\.warn\('5번 폴더 넣기'/, '★ 한 파일 오류로 통째로 멈추면 담은 파일이 «주인 없는 파일»이 된다');
  assert.match(f, /if\(\(i\+1\)%10===0\) 중간저장\(\);/);
  assert.match(f, /finally \{\s*중간저장\(\);\s*window\._kcBusyImport=false;/);
  assert.match(f, /saveFileWait\([^;]*\{ noCache:true \}/, '대량은 기억 사본을 놓는다');
  assert.match(cut('function fbNewerSync('), /window\._kcBusyImport/, '담는 동안 새로고침하지 않는다');
});

test('★★ 사업 서류 담기 — 한 장씩 읽고 놓는다 · 안 읽히는 것은 건너뛰고 계속', async () => {
  const 통 = { bizapp: [] }, 담음 = [];
  const ctx = { Date, Math, JSON, Object, Array, String, Number, Uint8Array, console: { warn() {} },
    BIZ_STORE: 'bizapp', get: (k) => 통[k] || [], set: (k, v) => { 통[k] = v; }, toast() {},
    abToB64: (u) => 'B64:' + u.length, saveFileWait: async (id, f, o) => { 담음.push([f.name, !!(o && o.noCache)]); return true; },
    kcFormUpload: async (id) => 'kf/u/' + id, KcareerBiz: { guessDocKind: () => '기타' } };
  vm.createContext(ctx);
  vm.runInContext(cut('function _bizClean(') + cut('function _bizPut(') + cut('async function _bizAddFiles('), ctx);
  vm.runInContext('_bizCur={ id:"BZ1", docs:[] };', ctx);
  const 손잡이 = (n, 깨짐) => ({ getFile: async () => { if (깨짐) throw new Error('OneDrive 미내려받음'); return { arrayBuffer: async () => new Uint8Array(n).buffer }; } });
  ctx.목록 = [{ name: '가.hwpx', relPath: 'x/가.hwpx', size: 3, handle: 손잡이(3) },
              { name: '나.pdf', relPath: 'x/나.pdf', size: 5, handle: 손잡이(5, true) },
              { name: '다.pdf', relPath: 'x/다.pdf', size: 4, handle: 손잡이(4) }];
  const o = await vm.runInContext('_bizAddFiles(목록)', ctx);
  assert.equal(o.n, 2); assert.equal(o.fail, 1, '★ 한 장이 안 읽혀도 나머지는 담고, 못 넣은 수를 말한다');
  assert.deepEqual(담음, [['가.hwpx', true], ['다.pdf', true]], '폴더에서 읽은 것은 기억 사본을 놓는다');
  assert.doesNotMatch(cut('async function _bizReadDir('), /arrayBuffer/, '★ 폴더째 미리 읽으면 수백 MB 가 한꺼번에 올라 탭이 멎는다');
});

test('★ 긴 작업 뒤에는 «다시 읽어» 새 줄만 더한다 — 지난 건 넣기 · 꾸러미 신청서', () => {
  const c = cut('async function casePastGo(');
  assert.ok(c.lastIndexOf("get('submission')") > c.indexOf('await fsCaseFiles'), '★ 처음 읽은 목록으로 덮으면 그 사이 고친 제출서류가 사라진다');
  const p = cut('async function _pkKeepApplication(');
  assert.ok(p.lastIndexOf('arr=get(D.store)') > p.indexOf('await kcFormUpload'));
});

test('★★ 직원 보기 — 고칠 수 없다 · 같은 브라우저로 대표가 들어오면 사본을 올리지 않고 먼저 받아 온다', () => {
  assert.match(cut('function openEditDrawer('), /_kcReadOnly\(\)/);
  assert.match(cut('async function dropAttach('), /_kcReadOnly\(\)/);
  assert.match(cut('function saveForm('), /if\(editId && _kcReadOnly\(\)\) return;/);
  assert.match(cut('async function kcPubPull('), /_pubcopy/);
  const store = { cm3__pubcopy: '1', cm3__fbbase: '123', cm3__fbpending: 'x' }, 받기 = [];
  const ctx = { NS: 'cm3_', fbUid: 'u1', fbDb: {}, _fbBase: 123, _fbFirstTried: true, toast() {}, fbFirstSync: () => 받기.push(1),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), removeItem: (k) => { delete store[k]; } } };
  vm.createContext(ctx);
  vm.runInContext(cut('function kcPubCopyRecover('), ctx);
  assert.equal(vm.runInContext('kcPubCopyRecover()', ctx), true);
  assert.equal(store.cm3__fbbase, undefined, '★ 기준이 남아 있으면 직원 사본이 대표 클라우드로 올라간다');
  assert.equal(ctx._fbBase, null); assert.equal(받기.length, 1, '먼저 받아 온다');
  assert.equal(vm.runInContext('kcPubCopyRecover()', ctx), false, '한 번만');
  assert.match(cut('function kcApplyLock('), /kcPubCopyRecover/);
  assert.match(bare.match(/var FB_SKIP=\[[\s\S]*?\];/)[0], /'_pubcopy'[\s\S]*'_idb_migrated'/);
});

test('옛 첨부 조각(pf_)은 클라우드로 오가지 않는다', () => {
  assert.match(cut('function fbGatherLS('), /bare\.indexOf\('pf_'\)===0/);
  assert.match(cut('function kcApplyRestore('), /bare\.indexOf\('pf_'\)===0/);
});

test('화면 — 이동 고리 빗장 · 어두운 화면 남색 글자 · 비용 한눈에 · 검색 비용 · 사업 되살리기 · 첫 자료', () => {
  assert.match(cut('function syncGroupUI('), /!syncGroupUI\._busy/, '★ 담기가 실패하면 buildNav ↔ syncGroupUI 가 끝없이 돈다');
  assert.match(CODE, /html\.dark \[style\*="color:var\(--navy\)"\]/);
  assert.match(CODE, /html\.dark [^{]*\.modal-h[^{]*\{color:var\(--ink\)\}/);
  assert.match(cut('function set('), /feeDashSoon\(\)/);
  assert.match(cut('function feeDashSoon('), /page-feedash/);
  assert.match(cut('function gsGo('), /_gsPage\(page\)/);
  assert.match(cut('function _gsPage('), /etcfee/);
  assert.match(cut('function kcTrashRedraw('), /renderBizList/);
  assert.doesNotMatch(cut('function kcApplyLock('), /renderCareer\(\)/, '이름 없이 부르면 아무것도 안 그린다');
});

test('첨부 PDF 목록표는 «실제로 붙은 것»만 · 서식 끌어놓기는 보이는 편집기로', () => {
  const a = bare.slice(bare.indexOf('var 붙음=[];'), bare.indexOf('var pdf=await out.save();'));
  assert.ok(a.indexOf('붙음.push(x)') > 0 && a.indexOf('_attListPages(목록)') > a.indexOf('붙음.push(x)'), '★ 먼저 그리면 못 붙인 증빙까지 목록에 실린다');
  assert.match(a, /out\.insertPage\(a, A4\)/, '목록표는 맨 앞에');
  assert.match(bare, /c\.editor==='#rhwpEditor'\);\s*var f=e\.dataTransfer\.files\[0\]; if\(f\) importTemplateFile\(f, 보임\?m:'resume'\)/);
});
