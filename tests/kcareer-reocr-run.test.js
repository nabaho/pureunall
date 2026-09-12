'use strict';
/* 「🔍 원본 다시 읽기」를 «실제로 돌려» 본다 (대표 지시 2026-09-12
   「원본을 ocr 하고 내용 넣고 수정 창으로 다시 보내고 싶다. 확인하고 진행해라」)
   ────────────────────────────────────────────────────────────────────────
   ■ 이 길이 하는 일
       원본(앱 안 첨부든 서류 폴더든) → OCR → «수정 창의 칸»을 채운다 → 사람이 [저장].
   ■ 여기서 못박는 두 가지
     ① ★★ 읽은 것이 지금 기록과 «다른 해»면 «먼저 묻는다».
        실측: 2024년 전담노무사 기록에 2025년 위촉장이 붙어 있었다. 그대로 채워 저장하면
        2024년 기록이 2025년으로 «덮이고» 2025년 줄과 겹쳐 한 해가 사라진다.
        ⚠ 막지는 않는다 — 정말 고치려는 때가 있다. 묻고 사람이 고른다.
     ② 위촉기간 셈은 «등록할 때와 같아야» 한다(splitPeriod + termYears).
        따로 쪼개고 termYears 를 버리고 있어서, 날짜가 안 적힌 위촉장은
        「다시 읽기」로는 기간이 영영 안 채워졌다.
   ⚠ 글자만 찾는 검사는 기능을 꺼도 통과한다 — 그래서 vm 에 올려 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
/* 함수를 «통째로» 뽑는다 — 고정 폭으로 자르면 함수가 자랄 때 뒤를 조용히 못 본다 */
const { cutFn } = require('./cut-fn');

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

/* 가짜 수정 창 — 위촉장 서식의 칸 그대로 */
function 무대(칸, parsed, opts) {
  opts = opts || {};
  const 칸들 = {};
  Object.keys(칸).forEach(function (k) { 칸들['ff-' + k] = { value: 칸[k] }; });
  const 기록 = { 물음: [], 알림: [] };
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    document: { getElementById: function (id) { return 칸들[id] || null; } },
    confirm: function (msg) { 기록.물음.push(msg); return opts.예 !== false; },
    toast: function (m) { 기록.알림.push(m); },
    _formCtx: { page: 'wiccok', editId: 'W-1' },
    PAGE_OCR_PROMPT: { wiccok: '(물음)' },
    getApiKey: function () { return ''; },
    getGVisionKey: function () { return ''; },
    aiReady: function () { return true; },
    _formFileAsync: async function () { return { name: 'a.pdf', ext: 'pdf', base64: 'QUJD' }; },
    _ocrPayload: async function (b64, ext) { return { asImage: true, mt: 'image/png', b64: b64 }; },
    _geminiOCR: async function () { return parsed ? { parsed: parsed } : { err: '없음' }; },
    kcFetch: async function () { return { ok: false, status: 0 }; },
  };
  vm.createContext(ctx);
  const 코드 = [
    떼기('function _ymd(x){'),
    떼기('function _ymdStr('),
    떼기('function termEnd(startStr, years){'),
    떼기('function splitPeriod(p){'),
    떼기('async function reOcrForm(){')
  ].join('\n').replace(/^(\s*)const /gm, '$1var ');
  vm.runInContext(코드, ctx);
  return { ctx: ctx, 칸: 칸들, 기록: 기록,
           값: function (k) { return (칸들['ff-' + k] || {}).value; } };
}

const 빈위촉장 = { type: '위촉장', org: '', issuer: '', titleVal: '', issueDate: '',
                   periodStart: '', periodEnd: '', note: '' };

/* ══════ ★★★ 다른 해 — 원본이 잘못 붙어 있을 때 ══════ */

test('★★★ 읽은 것이 «다른 해»면 먼저 묻는다 — 아니오면 «한 칸도» 안 바뀐다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { org: '교육부', titleVal: '전담노무사',
      issueDate: '2024.03.01' }),
    { org: '교육부', titleVal: '학교 전담 노무사', issueDate: '2025.12.26',
      period: '2025.03.01 ~ 2026.02.28', note: '직업교육 2025-409', year: '2025' },
    { 예: false });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.기록.물음.length, 1, '★★★ 다른 해인데 묻지 않았습니다 — 한 해가 덮입니다');
  assert.match(m.기록.물음[0], /2024/, '지금 기록의 해를 보여 줘야 합니다');
  assert.match(m.기록.물음[0], /2025/, '원본에서 읽은 해를 보여 줘야 합니다');
  /* ⚠ 「아니오」인데 일부라도 채워지면 사람이 모른 채 저장하게 된다 */
  assert.equal(m.값('issueDate'), '2024.03.01', '★★★ 아니오인데 발급일이 바뀌었습니다');
  assert.equal(m.값('titleVal'), '전담노무사', '★★★ 아니오인데 위촉내용이 바뀌었습니다');
  assert.equal(m.값('note'), '', '★★ 아니오인데 발급번호가 들어갔습니다');
  assert.equal(m.값('periodStart'), '', '★★ 아니오인데 기간이 들어갔습니다');
});

test('★★ 「예」를 고르면 그대로 채운다 — 막는 것이 아니라 «묻는» 것이다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { issueDate: '2024.03.01' }),
    { org: '교육부', titleVal: '학교 전담 노무사', issueDate: '2025.12.26',
      period: '2025.03.01 ~ 2026.02.28', note: '직업교육 2025-409' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.기록.물음.length, 1);
  assert.equal(m.값('issueDate'), '2025.12.26', '★★ 「예」인데 안 채웠습니다 — 막아 버리면 못 고칩니다');
  assert.equal(m.값('org'), '교육부');
});

test('★★ 같은 해면 «묻지 않는다» — 까닭 없이 물으면 사람이 확인창을 안 읽게 된다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { issueDate: '2025.03.01' }),
    { org: '교육부', issueDate: '2025.12.26' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.기록.물음.length, 0, '★★ 같은 해인데 물었습니다');
  assert.equal(m.값('issueDate'), '2025.12.26');
});

test('★ 해를 «모르면» 묻지 않는다 — 모르는 것을 가로막지 않는다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장), { org: '교육부', issueDate: '2025.12.26' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.기록.물음.length, 0, '빈 기록에 처음 채우는 길을 막으면 안 됩니다');
  assert.equal(m.값('issueDate'), '2025.12.26');
});

/* ══════ 채워 넣기 ══════ */

test('★★ 위촉장의 칸을 제자리에 채운다 — 발급기관·위촉내용·발급일·기간·발급번호', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { org: '직업계고등학교 현장실습 전담노무사' }),
    { org: '교육부', issuer: '교육부장관', titleVal: '학교 전담 노무사',
      issueDate: '2025.12.26', period: '2025.03.01 ~ 2026.02.28', note: '직업교육 2025-409' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.값('org'), '교육부', '★★ 발급기관 칸에 위촉내용이 남아 있습니다');
  assert.equal(m.값('issuer'), '교육부장관');
  assert.equal(m.값('titleVal'), '학교 전담 노무사');
  assert.equal(m.값('issueDate'), '2025.12.26');
  assert.equal(m.값('periodStart'), '2025.03.01');
  assert.equal(m.값('periodEnd'), '2026.02.28');
  /* ⚠ 위촉장 서식의 「발급번호」 칸 열쇠는 note 다 — num 이 아니다 */
  assert.equal(m.값('note'), '직업교육 2025-409', '★★ 문서번호를 읽어 놓고 버립니다');
});

test('★★ 「임기 2년」처럼 «햇수»만 적힌 위촉장도 기간이 채워진다', async () => {
  /* ⚠ 전에는 termYears 를 통째로 버려, 날짜 없는 위촉장은 「다시 읽기」로 기간이 영영 안 찼다.
     끝날은 «하루 뺀다» — 2020.03.01 부터 2년이면 2022.02.28 (만기일). */
  const m = 무대(Object.assign({}, 빈위촉장),
    { org: '충청남도', issueDate: '2020.03.01', period: '', termYears: '2' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.값('periodStart'), '2020.03.01', '시작이 비면 발급일을 씁니다');
  assert.equal(m.값('periodEnd'), '2022.02.28', '★★ 햇수만 적힌 위촉장의 기간이 안 채워집니다');
});

test('★★ 기간이 «아무 데도» 없으면 만들어 넣지 않는다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장),
    { org: '충청남도', issueDate: '2020.03.01', period: '', termYears: '' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.값('periodStart'), '', '★★ 없는 기간을 지어냈습니다');
  assert.equal(m.값('periodEnd'), '', '★★ 없는 기간을 지어냈습니다');
});

test('★ 손으로 넣어 둔 시작일은 존중한다 — 햇수는 «끝날»만 센다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { periodStart: '2020.05.01' }),
    { org: '충청남도', issueDate: '2020.03.01', termYears: '1' });
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.값('periodStart'), '2020.05.01', '사람이 넣은 값을 덮으면 안 됩니다');
  assert.equal(m.값('periodEnd'), '2021.04.30');
});

/* ══════ 못 읽었을 때 ══════ */

test('★ 못 읽으면 칸을 건드리지 않는다 — 반쯤 채우면 더 나쁘다', async () => {
  const m = 무대(Object.assign({}, 빈위촉장, { org: '충청남도', issueDate: '2020.03.01' }), null);
  await vm.runInContext('reOcrForm()', m.ctx);
  assert.equal(m.값('org'), '충청남도');
  assert.equal(m.값('issueDate'), '2020.03.01');
  assert.ok(m.기록.알림.join(' ').indexOf('읽기 실패') >= 0, '실패했다고 말해야 합니다');
});

test('★★ 원본을 «폴더에서도» 읽는다 — 첨부 창고만 뒤지지 않는다', async () => {
  /* _formFileAsync 하나로 앱 첨부·폴더 경로를 다 읽는다(2026-09-12). */
  /* ⚠ 고정 폭(2600자)으로 자르고 있었다 — 함수가 4,977자로 자라 «2,377자를 못 보고»
       있었다. 「없어야 한다」를 보는 줄이 아래에 있어 조용히 통과할 자리였다.
       tests/test-cut-truncation.test.js 가 이것을 잡아 배포까지 막았다(2026-09-12). */
  const fn = cutFn(SRC, 'async function reOcrForm(');
  assert.match(fn, /await _formFileAsync\(\)/);
  assert.ok(!/await getFileAsync\(_formCtx\.editId\)/.test(fn));
});
