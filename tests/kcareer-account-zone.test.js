'use strict';
/* 🏦 통장사본 끌어놓기가 «아무 일도 안 하던» 것 (대표 제보 2026-09-28 「통장사본 입력이 안된다.
   원본저장과 ocr 동시에 필요하다」)
   ─────────────────────────────────────────────────────────────
   ■ 뿌리 — 칸을 잇는 코드가 `#tab-account .ocr-zone` 을 찾았다. 계좌는 2026-08-29 에
     신분증 탭(tab-idmgr)으로 합쳐져 #tab-account 가 없어졌고, 그래서 그 칸은 «아무 데도»
     안 이어졌다(끌어놓아도·눌러도 아무 일이 없다). 판독과 원본 저장 길(ocrDrop › saveOCRRecord)은
     멀쩡했다 — 입구만 끊겨 있었다.
   ■ 같은 병 — 개인서류 칸 코드(`#tab-personal .ocr-zone`)는 옮겨진 칸 대신 «사진 보관함 칸»을
     잡고 있었다(바로 아래 코드가 덮어써서 드러나지 않았을 뿐).
   ⚠ 그래서 이 검사는 «이런 종류 전체»를 막는다 — 없어진 탭 패널을 찾는 코드가 있으면 걸린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const CODE = stripComments(RAW);

test('★★★ 없어진 탭 패널을 찾는 코드가 없다 — 있으면 그 칸은 «아무 데도» 안 이어진다', () => {
  const 있는패널 = new Set([...RAW.matchAll(/id="(tab-[\w-]+)"/g)].map((m) => m[1]));
  const 찾는곳 = [...CODE.matchAll(/querySelector(?:All)?\(\s*'#(tab-[\w-]+)[\s'.#\[]/g)].map((m) => m[1]);
  const 없는 = [...new Set(찾는곳.filter((t) => !있는패널.has(t)))];
  assert.deepEqual(없는, [], '★★★ 없어진 탭 패널을 찾습니다 — 그 칸은 아무것도 받지 않습니다: ' + 없는.join(', '));
});

test('★★★ 계좌 칸은 신분증 탭 «안»에 있고 id 로 이어진다', () => {
  const s = RAW.indexOf('id="tab-idmgr"'), e = RAW.indexOf('class="tabpanel"', s + 10);
  const 탭 = RAW.slice(s, e > 0 ? e : RAW.length);
  assert.match(탭, /<div class="ocr-zone" id="acOcrZone" data-store="account"/, '★★ 계좌 칸이 신분증 탭에 없거나 id 가 없습니다');
  assert.match(CODE, /const acZone=document\.getElementById\('acOcrZone'\);/, '★★★ 계좌 칸을 id 로 잇지 않습니다');
  assert.ok(!/#tab-account/.test(CODE), '★★ 없어진 #tab-account 를 아직 찾습니다');
});

test('★★ 끌어놓기·누르기가 «판독+원본 저장» 길(ocrDrop, account)로 간다', () => {
  const i = CODE.indexOf("const acZone=document.getElementById('acOcrZone');");
  const 줄 = CODE.slice(i, CODE.indexOf('\n', i));
  assert.match(줄, /acZone\.ondrop=async e=>\{[^}]*await ocrDrop\(e\.dataTransfer\.files,'account'\);/, '★★ 끌어놓은 파일을 판독 길로 안 보냅니다');
  assert.match(줄, /acZone\.onclick=\(\)=>\{ const inp=document\.getElementById\('acFileInput'\);/, '★ 눌러서 고르는 길이 없습니다');
  assert.match(CODE, /acFile\.onchange=async\(\)=>\{ await ocrDrop\(acFile\.files,'account'\);/, '★ 고른 파일을 판독 길로 안 보냅니다');
});

test('★★ 개인서류 칸 코드가 «사진 보관함 칸»을 잡지 않는다', () => {
  assert.ok(!/querySelector\('#tab-personal \.ocr-zone'\)/.test(CODE),
    '★★ 첫 번째 ocr-zone(= 사진 보관함)을 잡습니다 — 순서가 바뀌면 사진이 신분증으로 판독됩니다');
});

/* ── 판독한 값과 «원본»이 함께 담기는가 — saveOCRRecord 를 돌려 본다 ── */
function 떼기(src, 머리) {
  const i = src.indexOf(머리);
  let d = 0, started = false;
  for (let p = i; p < src.length; p++) {
    const c = src[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return src.slice(i, p + 1); }
  }
  throw new Error(머리);
}
test('★★★ 통장사본 한 장 → 계좌 기록 + 원본이 «함께» 담긴다', async () => {
  const 통 = {}, 파일 = {};
  const ctx = { console: { warn() {} }, Date, String, Number, Math, JSON, RegExp, parseInt,
    get: (k) => 통[k] || (통[k] = []), set: (k, v) => { 통[k] = v; },
    _safe: (f) => { try { return f(); } catch (e) { return null; } }, toast: () => {},
    kcIsStaff: () => false, hasOriginal: () => false, _isExternal: () => false,
    saveFileUnified: async (id, f) => { 파일[id] = f; },
    nextId: (pre, st) => pre + String((통[st] || []).length + 1).padStart(4, '0'),
    wiccokId: () => 'W', splitPeriod: () => ['', ''], termEnd: () => '' };
  vm.createContext(ctx);
  vm.runInContext(['const FORM_DEFS={', 'function dupKey(', 'async function saveOCRRecord(']
    .map((m) => 떼기(RAW, m)).join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  ctx.__a = [{ bank: '농협', number: '000-0000-0000-00', holder: '권형하' }, { name: '통장사본.jpg', size: 9 }];
  const id = await vm.runInContext('saveOCRRecord("account", __a[0], __a[1], "jpg", "QUJD")', ctx);
  assert.ok(id, '★★★ 계좌를 안 담았습니다');
  const 줄 = 통.account[0];
  assert.deepEqual([줄.bank, 줄.number, 줄.holder], ['농협', '000-0000-0000-00', '권형하'], '★★ 판독한 값이 안 담겼습니다');
  assert.ok(파일[id] && 파일[id].base64 === 'QUJD' && 파일[id].name === '통장사본.jpg', '★★★ 원본이 함께 안 담겼습니다');
});
