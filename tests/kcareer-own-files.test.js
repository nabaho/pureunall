'use strict';
/* 📷🖋 내 사진·도장·법인 서류가 «다른 브라우저에서 사라지던» 것 (대표 제보 2026-10-09)
   「환경설정에서 왜 사진과 도장이 사라졌나 · 법인정보에는 법인도장도 · 사업자등록증도 넣어두면 좋겠다」
   실측(대표 크롬): 사진 목록은 클라우드에 있는데 파일은 8/29 에 올린 브라우저에만 → 다른 곳에서 하얀 칸.
   도장은 목록·그림 모두 «이 브라우저에만» → 한쪽 4개, 다른 쪽 1개. 법인 서류는 「원본 없음」.
   못 박는 것:
     ① 도장 목록은 «합쳐» 받는다 — 받은 것이 빈 목록이어도 이 기기 것을 안 지우고, 지운 것은 안 되살린다
     ② 사진·도장·법인 서류 파일은 본인 창고 자리(stPath)로 오가고, 데려오는 곳은 _kcCloudRowOf 한 곳
     ③ 신분증(id_docs)은 어떤 경우에도 창고로 안 간다
     ④ 파일이 어디에도 없으면 하얀 칸 대신 까닭을 적는다
     ⑤ 법인 도장 — 도장 보관함 한 줄에 표시만(그림은 한 곳) · 이름으로 «권하기만» 하고 저절로 정하지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
/* 주석을 떼고 본다 — 주석에 적힌 말로 검사가 통과하면 안 된다 */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

/* 받기를 실제로 돌려 본다 — LS 는 가짜, 나머지는 kcareer.html 의 진짜 함수 */
function 받기틀(여기) {
  const store = {};
  Object.keys(여기).forEach((k) => { store['cm3_' + k] = 여기[k]; });
  const ctx = {
    NS: 'cm3_', TOMB_KEY: '_tomb', TOMB_REV_KEY: '_tombrev', JSON, Number, Date, Object, Array, String, console,
    LS: { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; return true; } },
  };
  vm.createContext(ctx);
  const 쓸것 = ['function _tombObj(', 'function tombLoad(', 'function tombRevLoad(', 'function tombSave(',
    'function tombRevSave(', 'function tombDead(', 'function tombPrune(', 'function _kcUnionRows(', 'function kcApplyRestore('];
  vm.runInContext('var TOMB_MAX=3000, TOMB_DAYS=400;\n' + SRC.match(/var FB_SKIP=\[[\s\S]*?\];/)[0] + '\n'
    + SRC.match(/var FB_UNION=\[[^\]]*\];/)[0] + '\n' + 쓸것.map(떼기).join('\n'), ctx);
  return { ctx, store };
}
const ids = (raw) => JSON.parse(raw).map((r) => r.id).sort();

test('① 도장 목록은 합쳐 받는다 — 1개인 기기가 4개인 기기를 지우지 않는다', () => {
  const 여기 = JSON.stringify([{ id: 'S1' }, { id: 'S2' }, { id: 'S3' }, { id: 'S4' }]);
  const { ctx, store } = 받기틀({ stamps: 여기 });
  ctx.kcApplyRestore({ stamps: JSON.stringify([{ id: 'S9', label: '저쪽' }]) }, 'pull');
  assert.deepEqual(ids(store.cm3_stamps), ['S1', 'S2', 'S3', 'S4', 'S9']);
  assert.equal(JSON.parse(store.cm3_stamps)[0].id, 'S9', '받은 것이 먼저');
});

test('① 받은 도장 목록이 «비어» 있어도 이 기기 것은 남는다', () => {
  const { ctx, store } = 받기틀({ stamps: JSON.stringify([{ id: 'S1' }]) });
  ctx.kcApplyRestore({ stamps: '[]' }, 'pull');
  assert.deepEqual(ids(store.cm3_stamps), ['S1']);
});

test('① 지운 도장은 합쳐도 되살아나지 않는다(어느 쪽에서 지웠든)', () => {
  const now = Date.now();
  const { ctx, store } = 받기틀({ stamps: JSON.stringify([{ id: 'S1' }, { id: 'S2' }]), _tomb: JSON.stringify({ S1: now }) });
  ctx.kcApplyRestore({ stamps: JSON.stringify([{ id: 'S1' }, { id: 'S3' }]), _tomb: JSON.stringify({ S2: now }) }, 'pull');
  assert.deepEqual(ids(store.cm3_stamps), ['S3']);
});

test('① 같은 번호는 받은 것이 이긴다 · 다른 목록은 예전처럼 덮는다', () => {
  const { ctx, store } = 받기틀({ stamps: JSON.stringify([{ id: 'S1', label: '옛' }]), cert: JSON.stringify([{ id: 'C1' }, { id: 'C2' }]) });
  ctx.kcApplyRestore({ stamps: JSON.stringify([{ id: 'S1', label: '새' }]), cert: JSON.stringify([{ id: 'C1' }]) }, 'pull');
  assert.equal(JSON.parse(store.cm3_stamps).length, 1);
  assert.equal(JSON.parse(store.cm3_stamps)[0].label, '새');
  assert.deepEqual(ids(store.cm3_cert), ['C1'], '합치기는 FB_UNION 에만 — 다른 목록까지 합치면 지운 것이 되돌아온다');
});

test('① 처음 받기의 «잃을 것» 셈에서도 합치는 목록은 뺀다', () => {
  const n = (SRC.match(/KcareerNotices\.firstPullLoss\(fbGatherLS\(\), v\.ls, FB_SKIP\.concat\(FB_UNION\), TOMB_KEY\)/g) || []).length;
  assert.ok(n >= 2, '받는 문 둘(fbFirstSync·fbNewerSync) 모두');
});

test('② 사진·도장·법인 서류는 본인 창고 자리로 오간다 — 데려오는 곳은 한 곳', () => {
  const 목록 = SRC.match(/var KC_OWN_FILE_STORES=\[([^\]]*)\]/);
  assert.ok(목록, 'KC_OWN_FILE_STORES');
  ['gallery', 'stamps', 'firm_docs'].forEach((k) => assert.ok(목록[1].includes("'" + k + "'"), k));
  const row = strip(떼기('function _kcCloudRowOf('));
  assert.ok(/KC_OWN_FILE_STORES/.test(row) && /stPath/.test(row), '_kcCloudRowOf 가 내 파일 목록도 본다');
  assert.ok(/내\.fname\s*\|\|\s*내\.name/.test(row), '법인 서류의 name 은 법인명 — 파일 이름은 fname 이 먼저');
  const up = strip(떼기('async function kcOwnFilesUp('));
  assert.ok(/kcFormUpload\(/.test(up) && /KC_OWN_FILE_STORES/.test(up), '올리는 길은 공용 kcFormUpload');
  assert.ok(/!r\.stPath/.test(up) && /fileExists\(r\.id\)/.test(up), '자리 없고 이 기기에 파일이 있는 것만');
  assert.ok(/kcIsStaff\(\)/.test(up), '직원 보기 전용에서는 안 올린다');
  assert.ok(/get\(store\)/.test(up.slice(up.indexOf('kcFormUpload('))), '올린 뒤 목록을 «새로» 읽어 그 줄에만 적는다');
  ['function renderGallery(', 'function renderStamps(', 'function renderFirmDocs('].forEach((h) =>
    assert.ok(/_kcOwnUpSoon\(\)/.test(strip(떼기(h))), h + ' — 그릴 때 옛 파일도 옮긴다'));
  assert.ok(/fileExists\(id\)\s*\|\|\s*!!a\.stPath/.test(떼기('function renderFirmDocs(')), '창고에 있으면 「원본 없음」이 아니다');
});

test('② 창고 자리 규칙 — 본인만 읽고 쓴다', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8');
  const m = rules.match(/match \/kcareer_forms\/\{uid\}\/\{file\} \{([\s\S]*?)\n    \}/);
  assert.ok(m, 'kcareer_forms 규칙');
  assert.ok(/allow read:\s*if signedIn\(\) && request\.auth\.uid == uid;/.test(m[1]), '읽기는 본인만 — 도장 그림이 여기 간다');
});

test('③ 신분증은 어떤 경우에도 창고로 안 간다', () => {
  const 목록 = SRC.match(/var KC_OWN_FILE_STORES=\[([^\]]*)\]/)[1];
  assert.ok(!/id_docs/.test(목록));
  assert.ok(!/id_docs/.test(strip(떼기('async function kcOwnFilesUp('))));
});

test('④ 파일이 어디에도 없으면 하얀 칸 대신 까닭을 적는다 · data: 머리도 푼다', () => {
  ['function renderGallery(', 'function renderStamps('].forEach((h) =>
    assert.ok(/_kcNoFileHere\(img\)/.test(strip(떼기(h))), h));
  const u = strip(떼기('async function fileURLAsync('));
  assert.ok(/replace\(\/\^data:\[\^,\]\*,\/,''\)/.test(u), 'data: 머리를 떼고 푼다');
  assert.ok(/webp/.test(u), 'webp 사진도 사진으로');
});

test('⑤ 법인 도장 — 보관함 한 줄에 표시만 · 저절로 정하지 않는다', () => {
  assert.ok(/id="firmSealBox"/.test(SRC) && /id="firmSealInput"/.test(SRC), '법인정보 탭에 칸');
  const tab = SRC.slice(SRC.indexOf('id="tab-firm"'), SRC.indexOf('id="tab-staff"'));
  assert.ok(/firmSealBox/.test(tab), '법인정보 탭 «안»에');
  assert.ok(/renderFirmSeal\)/.test(strip(떼기('function renderFirmTab('))), '탭을 그릴 때 함께');
  const setF = strip(떼기('function setFirmSeal('));
  assert.ok(/set\('stamps'/.test(setF) && /firm:/.test(setF), '도장 보관함 한 줄에 firm 표시 — 그림을 따로 담지 않는다');
  const r = strip(떼기('function renderFirmSeal('));
  assert.ok(/_firmSealGuess\(\)/.test(r) && !/setFirmSeal\(권함/.test(r), '이름으로 권하기만 — 노무사 직인이 법인 도장으로 저절로 정해지면 안 된다');
  assert.ok(/font-size:16px/.test(r), '폰 입력칸 16px');
  const up = strip(떼기('async function firmSealUpload('));
  assert.ok(/addStamps\(/.test(up) && /setFirmSeal\(/.test(up), '새로 올린 것은 보관함으로 가고 법인 도장으로 정해진다');
});

test('① 2026-10-10 검토 — 합친 도장에도 기본·법인 도장은 하나씩', () => {
  const { ctx, store } = 받기틀({ stamps: JSON.stringify([{ id: 'S1', def: true, firm: true }]) });
  ctx.kcApplyRestore({ stamps: JSON.stringify([{ id: 'S2', def: true, firm: true }]) }, 'pull');
  const a = JSON.parse(store.cm3_stamps);
  assert.equal(a.filter((s) => s.def).length, 1, '기본 도장 하나');
  assert.equal(a.filter((s) => s.firm).length, 1, '법인 도장 하나');
  assert.equal(a.find((s) => s.def).id, 'S2', '받은 쪽이 남는다');
});
