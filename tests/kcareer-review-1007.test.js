'use strict';
/* 경력관리 전체 검토(대표 지시 2026-10-07 「전체적으로 모두 검토하고 코딩문제 있는지」)에서 고친 것들
   ① 목록 표·전체 검색·연도 고르기에 기록 글자를 «그대로» 끼워 넣었다 — 「<주>가나상사」면 글자가 사라지고,
      직원 전달함·ERP 동기화·판독으로 들어온 글자에 태그가 섞이면 화면에서 돈다
   ② 저장공간이 차면 고친 것이 곧바로 «옛 값»으로 돌아가고 경고도 안 떴다
   ③ 사업에서 뺀 서류를 되살려도 사업 서류 목록에 안 돌아왔다
   ④ 「☐ №」 머리를 누르면 고르기와 함께 정렬까지 됐다 · 사업 입력 창이 바깥 클릭에 닫혔다
   ⑤ 비용 동의서가 「가장 최근 건」을 글자 순으로 골랐다 · 홈 바로가기 숫자가 옆줄과 달랐다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = CODE.replace(/\/\*[\s\S]*?\*\//g, ' ');

function cutBlock(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다 — 이름이 바뀌었나요?');
  let i = src.indexOf('{', head + decl.length - 1), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}

test('★★ ① 목록 표(CAREER_CFG)는 기록 글자를 «감싸서» 넣는다 — 새 칸을 보태도 이 규칙을 지킨다', () => {
  const blk = cutBlock(bare, 'const CAREER_CFG={');
  /* ${…} 식 가운데 기록(r.)을 «감싸지 않고» 쓰는 것은 숫자·건수·색 고르기·고정 글자뿐이어야 한다 */
  const 안전 = [
    /^r\.\w+\s*(===|!==)\s*'[^']*'\s*\?\s*'[^']*'\s*:\s*'[^']*'$/,          /* 상태 → 색 이름 */
    /^r\.\w+\s*\?\s*(Number\(r\.\w+\)|escapeHtml\(r\.\w+\))[^]*:\s*'[^']*'$/, /* 숫자·감싼 값 */
    /^r\.\w+\|\|0$/,                                                       /* 건수 */
    /^\(r\.\w+\|\|\[\]\)\.length/,                                          /* 개수 */
    /^r\.\w+(&&!?r\.\w+)*\s*\?\s*'[^']*'\s*:\s*''$/,                         /* 고정 딱지 */
    /^_bizOfCase\(r\.\w+\)\s*\?\s*'[^']*'\s*:\s*''$/,
  ];
  const 위험 = [];
  const re = /\$\{/g; let m;
  while ((m = re.exec(blk))) {
    let j = m.index + 2, d = 1;
    for (; j < blk.length; j++) { if (blk[j] === '{') d++; else if (blk[j] === '}') { d--; if (!d) break; } }
    const e = blk.slice(m.index + 2, j).trim();
    if (!/\br\./.test(e)) continue;
    if (/^(escapeHtml|_jsAttr|rowActions|puNoTd|formatDate|workPeriod|workOnJob)\(/.test(e)) continue;
    if (안전.some((r) => r.test(e))) continue;
    위험.push(e.slice(0, 60));
  }
  assert.deepEqual(위험, [], '★ 기록 글자를 그대로 끼워 넣는 칸이 있다 — escapeHtml(…) 로 감쌀 것');
});

test('★ ① 전체 검색·연도 고르기도 감싼다', () => {
  const gs = cutBlock(bare, 'function runGlobalSearch(');
  assert.match(gs, /escapeHtml\(main\)/); assert.match(gs, /escapeHtml\(sub\)/);
  assert.doesNotMatch(gs, /'\+main\+'|'\+sub\+'/, '검색 결과에 글자를 그대로 넣는다');
  const 연도 = bare.match(/yrs\.map\(y=>`<option[^`]*`\)/g) || [];
  assert.ok(연도.length >= 2, '연도 고르기를 못 찾았다');
  연도.forEach((s) => assert.match(s, /\$\{escapeHtml\(y\)\}/, '연도 칸에 기록 글자를 그대로 넣는다: ' + s));
});

test('★★ ② 저장공간이 차도 «방금 고친 것»을 읽고, 못 담았다고 알린다', () => {
  const 알림 = [];
  const 꽉참 = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const store = { 'cm3_wiccok': '[{"id":"옛"}]' };
  const ctx = {
    console: { error() {}, warn() {}, log() {} }, JSON, Object, Array, String, Date, Error,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: () => { throw 꽉참; }, removeItem: (k) => { delete store[k]; } },
    toast: (m) => 알림.push(String(m)), checkStorageQuota: () => {},
    TOMB_KEY: '__tomb', TOMB_REV_KEY: '__tombrev', hasIDPin: () => false, _tombDiff: () => {}, navCountsSoon: () => {},
    fbScheduleAuto: () => { ctx._보냄 = (ctx._보냄 || 0) + 1; },
  };
  vm.createContext(ctx);
  vm.runInContext(bare.match(/const _mem=\{\};[^\n]*/)[0].replace(/^const /, 'var ').replace(/let STORAGE_OK/, 'var STORAGE_OK'), ctx);
  vm.runInContext(cutBlock(bare, 'const LS={').replace(/^const /, 'var '), ctx);
  vm.runInContext('var NS="cm3_"; function get(k){ try{ return JSON.parse(LS.get(NS+k)||"[]"); }catch(e){ return []; } }', ctx);
  vm.runInContext(cutBlock(bare, 'function set(key,arr){'), ctx);
  vm.runInContext('set("wiccok", [{id:"새"}])', ctx);
  assert.equal(vm.runInContext('get("wiccok")[0].id', ctx), '새', '★ 못 담은 뒤 읽기가 기기의 «옛 값»을 돌려줬다 — 고친 것이 곧바로 사라져 보인다');
  assert.ok(알림.some((m) => /저장공간/.test(m)), '★ 못 담았는데 아무 말이 없다');
  assert.equal(ctx._보냄, 1, '클라우드로는 그대로 보낸다');
  /* 다시 담을 수 있게 되면 기억은 놓는다 */
  ctx.localStorage.setItem = (k, v) => { store[k] = v; };
  vm.runInContext('set("wiccok", [{id:"셋째"}])', ctx);
  assert.equal(JSON.parse(store['cm3_wiccok'])[0].id, '셋째');
  assert.equal(vm.runInContext('Object.keys(_mem).length', ctx), 0, '담은 뒤에도 기억이 남으면 다음 읽기가 엇갈린다');
});

test('★★ ③ 사업에서 뺀 서류를 되살리면 그 사업 서류 목록에 다시 붙는다', async () => {
  const 통 = { bizapp: [{ id: 'BZ1', title: '가나 컨설팅', docs: [{ id: 'f2', name: '견적서.xlsx' }] }], kc_trash: [] };
  const ctx = {
    JSON, Object, Array, String, Date, Math, Number, console,
    get: (k) => JSON.parse(JSON.stringify(통[k] || [])), set: (k, a) => { 통[k] = JSON.parse(JSON.stringify(a)); },
    toast: () => {}, _safe: (f) => { try { f(); } catch (e) {} }, renderBizList: () => {}, bizDraw: () => {},
    BIZ_STORE: 'bizapp', TRASH_STORE: 'kc_trash', _bizCur: null,
  };
  vm.createContext(ctx);
  vm.runInContext('function kcTrashList(){ return get(TRASH_STORE); }', ctx);
  ['function kcTrashPutFile(', 'function _bizGet(', 'function _bizClean(', 'function _bizPut(', 'async function kcTrashRestore(']
    .forEach((d) => vm.runInContext(cutBlock(bare, d), ctx));
  /* 빼기 — bizDocDrop 이 하는 그대로 */
  const drop = cutBlock(bare, 'function bizDocDrop(');
  assert.match(drop, /kcTrashPutFile\(id, [^;]*bizDoc:\{ bizId:r\.id/, '★ 뺄 때 «어느 사업의 어느 줄»인지 안 담으면 되살릴 곳이 없다');
  const e = vm.runInContext('kcTrashPutFile("f1", "사업 서류", { bizDoc:{ bizId:"BZ1", doc:{ id:"f1", name:"신청서.hwpx" } } })', ctx);
  await vm.runInContext('kcTrashRestore("' + e.tid + '", true)', ctx);
  const ids = 통.bizapp[0].docs.map((d) => d.id).sort();
  assert.deepEqual(ids, ['f1', 'f2'], '★ 파일만 돌아오고 사업 서류 목록에는 안 붙었다');
  assert.equal(통.kc_trash.length, 0);
});

test('④ 「☐ №」 머리는 정렬하지 않는다 · 사업 입력 창은 바깥 클릭에 안 닫힌다', () => {
  /* 머리칸 정렬은 sortCol(전체 자료) 하나 — 보이는 줄만 정렬하며 머리 글자를 통째로 다시 쓰던 sortTable 로 덮어쓰지 않는다(2026-10-07) */
  const rc = cutBlock(bare, 'function renderCareer(');
  assert.doesNotMatch(rc, /th\.onclick=\(\)=>sortTable/, '★ sortTable 로 덮으면 ☐(전체 선택)가 지워지고 50줄만 정렬된다');
  assert.match(rc, /title="이 쪽 전체 선택"> №<\/th>/, '№ 머리에는 정렬을 달지 않는다');
  assert.match(rc, /onclick="sortCol\(/);
  /* 기본 정렬은 날짜 모양(점·줄표)을 맞춘 열쇠로 */
  const ctx = {}; vm.createContext(ctx); vm.runInContext(cutBlock(bare, 'function _rowDateKey('), ctx);
  assert.ok(vm.runInContext('_rowDateKey({date:"2026-09-18"}) > _rowDateKey({date:"2026.9.5"})', ctx), '★ 9월 18일이 9월 5일보다 나중이어야 한다');
  assert.match(bare, /KC_MODAL_NO_BACKDROP=\{[^}]*modalBiz:1/, '★ 칸이 많은 사업 입력 창이 바깥 한 번 클릭에 닫히면 친 것이 날아간다');
});

test('⑤ 비용 동의서는 날짜 열쇠로 최근 건을 · 홈 바로가기 숫자는 옆줄과 같은 셈', () => {
  const c = cutBlock(bare, 'function feeSettleConsent(');
  assert.match(c, /_feeKey\(b\)\.localeCompare\(_feeKey\(a\)\)/, '★ 「2026.9.5」와 「2026-09-18」을 글자 순으로 견주면 차례가 뒤집힌다');
  assert.match(cutBlock(bare, 'function renderHomeTiles('), /navCount\(id\)/, '홈 숫자가 옆줄 숫자와 다른 셈을 쓴다');
});
