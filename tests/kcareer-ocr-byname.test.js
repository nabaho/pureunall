'use strict';
/* 판독이 «아예» 안 될 때 — 실적 네 화면·강의·비용 둘도 파일 이름으로 담는다 (2026-09-28)
   ─────────────────────────────────────────────────────────────
   ■ 무엇이 비어 있었나
     `3130e7e0`(2026-09-18)이 이 화면들에 «담을 자리»를 만들었지만 남긴 일이 있었다 —
     판독이 안 될 때 파일 이름으로라도 담는 길(quickParseFilename)에 이 일곱 화면 갈래가 없어
     「실패」로 세어졌다. 끌어놓은 파일이 «아무 데도» 없었다.
   ■ ⚠★ 이 길의 덫 — 중복 열쇠
     dupKey 는 «기관 10자 + 내용 6자 + 해»다. 파일 이름을 내용 칸에만 넣으면
     「2024 일터혁신 컨설팅 결과보고서_가장큰약국」과 「…_라온전자」가 «같은 서류»로 막힌다.
     → 파일 이름으로 담는 줄(_byName)은 «같은 파일 이름»일 때만 같은 서류로 본다.
   ⚠ 앱의 진짜 dupKey·quickParseFilename·saveOCRRecord 를 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
function 무대() {
  const 통 = {}, 알림 = [];
  const ctx = {
    console: { warn() {} }, Date, String, Number, Math, JSON, RegExp, parseInt,
    get: (k) => 통[k] || (통[k] = []),
    set: (k, v) => { 통[k] = v; },
    _safe: (f) => { try { return f(); } catch (e) { return null; } },
    toast: (m) => { 알림.push(String(m)); },
    kcIsStaff: () => false, hasOriginal: () => false,
    _isExternal: (r) => !!(r && r.agency) && !/직접/.test(String(r.agency)),
    saveFileUnified: async () => {},
    nextId: (pre, store) => pre + String((통[store] || []).length + 1).padStart(4, '0'),
    wiccokId: (t, y) => t + y + '-' + String((통.wiccok || []).length + 1).padStart(3, '0'),
    splitPeriod: () => ['', ''], termEnd: () => ''
  };
  vm.createContext(ctx);
  vm.runInContext(['const FORM_DEFS={', 'function dupKey(', 'function quickParseFilename(',
                   'async function saveOCRRecord(']
    .map(떼기).join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return {
    ctx, 통, 알림,
    이름: (name, page) => vm.runInContext('quickParseFilename(' + JSON.stringify(name) + ',' + JSON.stringify(page) + ')', ctx),
    담기: (page, name) => {
      ctx.__a = [page, name];
      return vm.runInContext('saveOCRRecord(__a[0], quickParseFilename(__a[1],__a[0]), {name:__a[1],size:9}, "pdf", "QUJD")', ctx);
    }
  };
}
const 일곱 = [['consult', 'consult', 'project'], ['case', 'case', 'project'], ['fund', 'fund', 'project'],
  ['etc', 'etc', 'project'], ['lecture', 'lecture', 'topic'], ['meetfee', 'meetfee', 'content'],
  ['etcfee', 'etcfee', 'content']];

test('★★★ 일곱 화면 모두 판독이 안 돼도 «담긴다» — 전에는 실패로 세어 아무 데도 없었다', async () => {
  for (const [page, store, 칸] of 일곱) {
    const m = 무대();
    const r = await m.담기(page, '2024 일터혁신 컨설팅 결과보고서_가장큰약국.pdf');
    assert.ok(r, '★★★ ' + page + ' 에 안 담깁니다 — 파일이 사라집니다');
    const 줄 = m.통[store][0];
    assert.ok(줄, page + ' 창고가 비었습니다');
    assert.match(String(줄[칸]), /일터혁신 컨설팅 결과보고서/, page + ': 파일 이름이 «내용» 칸에 안 들어갔습니다');
    assert.equal(String(줄.year), '2024', page + ': 파일 이름의 해를 안 씁니다');
    assert.equal(줄.fname, '2024 일터혁신 컨설팅 결과보고서_가장큰약국.pdf');
  }
});

test('★★ 파일 이름을 «고객사·기관» 칸에 넣지 않는다 — 문서에 대한 주장이 된다', () => {
  const m = 무대();
  for (const [page] of 일곱) {
    const p = m.이름('2024 가장큰약국 일터혁신.pdf', page);
    assert.equal(p.org, '', '★★ ' + page + ': 기관 칸에 파일 이름을 넣었습니다');
    assert.equal(p._byName, true, page + ': 파일 이름으로 담는 줄이라는 표시가 없습니다');
  }
});

test('★★ 유형은 «비워 둔다» — 지어내면 틀린 실적이 증명서로 나간다 · 상태만 서식 기본값', async () => {
  /* ⚠ 파일 이름에 «유형 낱말»이 들어 있어야 뜻이 있다 — 없으면 유형을 뽑게 고쳐도 빈칸이라
     통과한다(고장넣기로 확인했다). 이름에 「일터혁신」·「부당해고」가 있어도 유형은 비운다. */
  for (const [page, 이름] of [['consult', '2025 일터혁신 결과보고서.pdf'], ['case', '2025 부당해고 사건 결과.pdf']]) {
    const m = 무대();
    await m.담기(page, 이름);
    const 줄 = m.통[page][0];
    assert.equal(줄.type, '', '★★ ' + page + ': 파일 이름만 보고 유형을 지어 넣었습니다(' + 줄.type + ')');
    assert.equal(줄.status, '진행', page + ': 상태는 서식 기본값(진행)이어야 합니다');
  }
});

test('★ 읽은 것처럼 보이지 않게 «파일 이름으로 등록»이라 밝힌다', async () => {
  for (const page of ['consult', 'case', 'fund', 'etc', 'lecture']) {
    const m = 무대();
    await m.담기(page, '2025 결과.pdf');
    assert.match(String(m.통[page][0].note), /파일 이름으로 등록/, '★ ' + page + ': 확인하라는 말이 없습니다');
  }
});

test('★★★ 이름 앞이 같은 «다른 파일»은 따로 담긴다 — 중복 열쇠로 보면 한 건으로 막힌다', async () => {
  const m = 무대();
  const a = '2024 일터혁신 컨설팅 결과보고서_가장큰약국.pdf', b = '2024 일터혁신 컨설팅 결과보고서_라온전자.pdf';
  /* (준비) 이 둘은 «진짜 중복 열쇠»로는 같다 — 그래서 이 빗장이 필요하다 */
  const 열쇠 = (n) => { m.ctx.__r = m.이름(n, 'consult'); return vm.runInContext('dupKey(__r)', m.ctx); };
  assert.equal(열쇠(a), 열쇠(b), '(준비) 두 파일의 중복 열쇠가 다릅니다 — 이 검사가 뜻이 없어졌습니다');
  await m.담기('consult', a);
  await m.담기('consult', b);
  assert.equal(m.통.consult.length, 2, '★★★ 다른 파일 둘이 한 건으로 막혔습니다 — 하나가 사라집니다');
});

test('★★ «같은 파일»을 두 번 넣으면 한 건 — 되풀이해 올려도 쌓이지 않는다', async () => {
  const m = 무대();
  await m.담기('lecture', '2025 괴롭힘 예방 교육.pdf');
  await m.담기('lecture', '2025 괴롭힘 예방 교육.pdf');
  assert.equal(m.통.lecture.length, 1, '★★ 같은 파일이 두 건 쌓였습니다');
});

test('★ 비용 두 화면 — 구분은 서식 기본값 · 금액은 비움 · 내용이 파일 이름', async () => {
  const m = 무대();
  await m.담기('meetfee', '2026 참석확인서 가장큰약국.hwp');
  const 줄 = m.통.meetfee[0];
  assert.equal(줄.type, '회의', '회의비 기본 구분이 아닙니다');
  assert.equal(줄.amt, '', '★ 금액을 지어냈습니다');
  assert.match(줄.content, /참석확인서/);
  const m2 = 무대();
  await m2.담기('etcfee', '영수증.pdf');
  assert.equal(m2.통.etcfee[0].type, '기타');
});

test('★ 옛 화면(위촉장 등)의 되돌림은 그대로 — 이번 빗장은 새 일곱 화면에만', () => {
  const m = 무대();
  /* ⚠ 계좌(account)는 2026-09-28 에 따로 옮겼다 — 아래 검사가 본다(은행 칸에 파일 이름이 들어가던 것) */
  for (const page of ['wiccok', 'award', 'license', 'complete', 'edu', 'work', 'personal_doc', 'id_doc']) {
    const p = m.이름('2024 충청남도 위원.pdf', page);
    assert.ok(p, page + ' 되돌림이 사라졌습니다');
    assert.ok(!p._byName, '★ ' + page + ' 의 겹침 판정까지 바뀌었습니다 — 한 번에 하나씩');
  }
  assert.equal(m.이름('a.pdf', '없는화면'), null, '모르는 화면은 담지 않는다');
});

test('★★ 통장사본 판독이 안 되면 — 은행 칸을 «비우고» 파일 이름은 메모에, 겹침은 같은 파일로만', async () => {
  /* 대표 제보 2026-09-28 「통장사본 입력이 안된다」 뒤에 함께 고쳤다.
     예전에는 파일 이름이 «은행» 칸에 들어가 「은행: 통장사본 스캔」이 됐고,
     은행·번호가 비면 중복 열쇠(은행|번호)가 모두 같아져 둘째 통장부터 막힐 수 있었다. */
  const m = 무대();
  const p = m.이름('통장사본 농협.jpg', 'account');
  assert.equal(p.bank, '', '★★ 파일 이름을 은행 칸에 넣습니다 — 사실과 다른 은행이 적힙니다');
  assert.match(p.memo, /통장사본 농협/, '★ 파일 이름을 남기지 않습니다(무엇이었는지 모릅니다)');
  assert.match(p.memo, /확인해 주세요/, '★ 읽은 것처럼 보입니다 — 확인하라고 말해야 합니다');
  await m.담기('account', '통장사본 농협.jpg');
  await m.담기('account', '통장사본 국민.jpg');
  assert.equal(m.통.account.length, 2, '★★ 판독 못 한 통장 둘이 한 건으로 막혔습니다');
  await m.담기('account', '통장사본 농협.jpg');
  assert.equal(m.통.account.length, 2, '★ 같은 파일을 또 넣었는데 쌓였습니다');
});

test('★ 끌어놓기의 두 되돌림 자리가 모두 이 길을 쓴다 — 한글 · 그림/PDF', () => {
  const drop = 떼기('async function ocrDrop(');
  assert.ok((drop.match(/quickParseFilename\(file\.name,page\)/g) || []).length >= 2,
    '★ 한쪽 되돌림이 이 길을 안 씁니다');
});
