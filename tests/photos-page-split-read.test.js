'use strict';
/* 한 묶음 안의 «서로 다른 서류»를 쪽마다 갈라 읽는다 (대표 지시 2026-09-12)
   실행: node --test tests/photos-page-split-read.test.js

   ■ 무엇이 잘못돼 있었나 — 실측 (2026-09-11, 운영 자료)
   1쪽 자문계약서 + 2쪽 「계좌/신용카드 자동출금 이용신청서」를 한 파일로 스캔했더니
   **두 쪽 다 kind=contract** 였고 은행·계좌·출금일이 **전부 빈 문자열**이었다.
   「판독은 문서 통째로 한 번」이라 한 벌의 답을 두 쪽에 그대로 복사했기 때문이다.

   ★ 자동이체를 기업정보함·푸른이알피로 보내는 길은 **이미 만들어져 있었다**
     (2026-08-28 · 09-03). 재료가 안 와서 한 번도 안 돌았을 뿐이다.

   ■ 함께 지켜야 하는 옛 규칙 (2026-08-10 대표 결정)
   «한 서류가 여러 쪽»이면 반드시 합쳐 읽는다 — 계약서는 보수가 2조, 기간이 6조,
   서명이 마지막 쪽에 흩어져 있어 가르면 2쪽 이후가 죄다 빈칸이 된다.
   **둘 다 지켜야 한다**: 한 서류면 합치고, 다른 서류면 가른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const READ_SRC = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');

/* ══════ ① 판독기 — docs[] 를 서류마다 다듬는다 ═══════════════════════════ */

function 판독기() {
  const box = { window: undefined, console, setTimeout, clearTimeout, fetch: undefined };
  box.globalThis = box;
  box.PuRrnMask = { maskRrnInText: function (s) { return s; } };
  vm.createContext(box);
  vm.runInContext(READ_SRC, box);
  return box.PuDocRead;
}
const D = 판독기();

const 두서류 = {
  docs: [
    { pages: [1], kind: 'contract',
      fields: { company: '아이행복어린이집', ceo: '양유정', fee: '200000' } },
    { pages: [2], kind: 'cms',
      fields: { bankName: '하나은행', bankAcct: '6779100 1708204',
                bankHolder: '양유정', payDay: '25', amount: '200000' } }
  ]
};

test('★★★ 서류가 둘이면 «갈라서» 준다 — 2쪽의 은행·계좌가 사라지지 않는다', async () => {
  const r = await D._afterReadForTest(두서류, 'image');
  assert.ok(Array.isArray(r.docs), '★★★ 갈라 주지 않습니다 — 2쪽 내용이 통째로 사라집니다');
  assert.equal(r.docs.length, 2);
  assert.equal(r.docs[0].kind, 'contract');
  assert.equal(r.docs[1].kind, 'cms',
    '★★★ 자동이체를 못 가립니다 — 기업정보함·푸른이알피로 갈 재료가 안 생깁니다');
  assert.equal(r.docs[1].fields.bankAcct, '6779100 1708204',
    '★★ 계좌번호가 안 실렸습니다(온전히 담아야 합니다 — 대표 결정 2026-08-28)');
  /* ⚠ vm 에서 온 배열은 realm 이 달라 deepStrictEqual 이 «모양이 같아도» 다르다고 한다
     — 이 저장소가 여러 번 밟은 자리다. Array.from 으로 이쪽 realm 으로 옮겨 견준다. */
  assert.deepEqual(Array.from(r.docs[1].pages), [2], '쪽 번호가 없으면 어느 쪽인지 못 적습니다');
});

/* ⚠ AI 가 쪽 번호를 «칸 안»에도 적어 보내는 일이 있다(적지 말라고 해도 섞인다).
     그것을 안 걸러 내면 화면에 「pages: 1」이 한 칸으로 뜨고 기업정보함까지 실려 간다. */
test('★★ 쪽 번호가 «칸»으로 새지 않는다 — pages 는 자리이지 서류 내용이 아니다', async () => {
  const r = await D._afterReadForTest({ docs: [
    { pages: [1], kind: 'contract', fields: { pages: [1], company: '아이행복어린이집' } },
    { pages: [2], kind: 'cms', fields: { pages: '2', bankName: '하나은행' } }
  ] }, 'image');
  r.docs.forEach(function (d, i) {
    assert.equal(d.fields.pages, undefined,
      '★★ ' + (i + 1) + '번째 서류의 칸에 pages 가 들어갔습니다 — 화면에 「pages: 1」이 뜨고\n' +
      '  기업정보함으로도 그대로 실려 갑니다(칸 이름이 아닙니다).');
  });
  assert.equal(r.fields.pages, undefined, '★★ 대표 칸에도 pages 가 새면 안 됩니다');
});

test('★★ 맨 앞 서류를 «대표»로 그대로 둔다 — 이 값을 보는 곳이 열 군데가 넘는다', async () => {
  const r = await D._afterReadForTest(두서류, 'image');
  assert.equal(r.kind, 'contract', '★★ 대표 갈래가 비면 갈래 탭·보내기·다시읽기가 다 멎습니다');
  assert.equal(r.fields.company, '아이행복어린이집');
});

test('★★★ 서류가 «하나»면 예전과 한 글자도 다르지 않다 — docs 를 안 붙인다', async () => {
  const 한벌 = { kind: 'contract', company: '가나상사', ceo: '홍길동' };
  const r = await D._afterReadForTest(한벌, 'image');
  assert.equal(r.kind, 'contract');
  assert.equal(r.fields.company, '가나상사');
  assert.equal(r.docs, undefined,
    '★★★ 한 서류에까지 docs 를 붙이면 거의 모든 판독이 새 길로 흘러갑니다');
});

test('docs 가 한 칸만 와도 «한 서류»로 본다 — 쓸데없이 가르지 않는다', async () => {
  const r = await D._afterReadForTest({ docs: [{ pages: [1, 2, 3], kind: 'contract',
    fields: { company: '가나상사' } }] }, 'image');
  assert.equal(r.kind, 'contract');
  assert.equal(r.fields.company, '가나상사');
  assert.equal(r.docs, undefined);
});

test('쪽 번호가 이상해도 안 죽는다 — 못 알아보면 빈 자리로 둔다', async () => {
  const r = await D._afterReadForTest({ docs: [
    { pages: 'abc', kind: 'contract', fields: { company: '가' } },
    { pages: [2, 2, '3'], kind: 'cms', fields: { bankName: '하나은행' } }
  ] }, 'image');
  assert.deepEqual(Array.from(r.docs[0].pages), []);
  assert.deepEqual(Array.from(r.docs[1].pages), [2, 3], '겹친 쪽은 하나로, 글자는 숫자로');
});

/* ══ 물음이 «실제로 보내는 글»을 본다 — 글자를 눈으로 견주지 않고 돌려서 ══════════
   ⚠★ 2026-09-12 실측 — 첫 판은 「갈라 주세요」라고 **권하기만** 해서 안 먹혔다.
     같은 문서(1쪽 자문계약서 + 2쪽 자동출금 이용신청서)를 두 번 읽혔더니
       첫 번째 → 두 쪽 다 contract (은행·계좌가 통째로 사라짐)
       두 번째 → 두 쪽 다 cms      (계약기간·자문료가 통째로 사라짐)
     **갈리지 않고 한쪽이 늘 사라졌다.** 위 PROMPT_ALL 이 첫 줄부터 「이 이미지가
     어떤 서류인지」로 시작해 내내 «한 장·한 벌»을 전제로 쓰여 있어서다 —
     맨 끝 한 문단이 그 전체를 못 이긴다.
   ★ 그래서 **꼴을 못 박았는지**를 본다. 「갈라 달라」는 말이 있는가가 아니다. */
function 보낸글(고른길) {
  const box = { window: undefined, console, setTimeout, clearTimeout };
  box.globalThis = box;
  /* ⚠ 진짜 지우개는 {text,…} 를 돌려준다 — 글자만 돌려주는 대역을 쓰면 body 가
     undefined 가 되어 «물음이 안 붙은 것처럼» 보인다(그렇게 헛다리를 짚었다). */
  box.PuRrnMask = { maskRrnInText: function (s) { return { text: s }; } };
  vm.createContext(box);
  vm.runInContext(READ_SRC, box);
  let 본것 = null;
  box.PuDocRead.init({
    fetch: function (u, i) {
      본것 = JSON.parse(i.body);
      return Promise.resolve({ ok: true, status: 200, json: function () {
        return Promise.resolve({ ok: true, reply: { candidates: [{ content: { parts: [
          { text: '{"docs":[{"pages":[1],"kind":"contract","fields":{}}]}' }] } }] } });
      } });
    },
    readDocUrl: 'http://x', getToken: function () { return Promise.resolve('T'); }, app: 'photos'
  });
  return 고른길(box.PuDocRead).then(function () {
    return 본것 ? 본것.parts[본것.parts.length - 1].text : '';
  });
}
const 여러쪽글 = '--- 1쪽 ---\n자문계약서 제1조\n\n--- 2쪽 ---\n계좌/신용카드 자동출금 이용신청서';

test('★★★ 여러 쪽이면 답의 «꼴»을 못 박는다 — 권하기만 하면 안 먹힌다(실측)', async () => {
  const t = await 보낸글(function (D) { return D.readDocText(여러쪽글); });
  assert.match(t, /반드시 이 꼴/,
    '★★★ 「이런 꼴로 주세요」라고 권하기만 하면, 더 길고 더 자주 되풀이된 위 설명을 따릅니다.\n' +
    '  실제로 같은 문서가 두 번 다 «한 벌»로 와서 한쪽이 통째로 사라졌습니다.');
  assert.match(t, /맨 바깥에 kind/,
    '★★★ «틀린 꼴»을 콕 집어 막지 않으면 그 꼴로 답합니다 — 그것이 예전 꼴입니다');
  assert.match(t, /이 규칙이 이깁니다/,
    '★★ 위 설명과 어긋날 때 어느 쪽이 이기는지 안 적으면 모델이 고릅니다');
});

test('★★ 한 서류여도 docs 배열 — 꼴이 하나뿐이어야 흔들리지 않는다', async () => {
  const t = await 보낸글(function (D) { return D.readDocText(여러쪽글); });
  assert.match(t, /서류가 하나뿐이어도 docs 배열/,
    '★★ 「여럿일 때만 docs」로 두면 모델이 매번 «몇 개인지»를 먼저 판단해야 합니다 —\n' +
    '  그 판단이 흔들리면 꼴이 흔들리고, 우리 쪽 갈래도 함께 흔들립니다');
});

test('★★ «한 서류가 여러 쪽»이면 합치라는 말이 남아 있다', async () => {
  const t = await 보낸글(function (D) { return D.readDocText(여러쪽글); });
  assert.match(t, /한 서류[\s\S]{0,120}한 칸/,
    '★★ 이 말이 빠지면 계약서 3쪽이 세 서류로 갈려 2쪽 이후가 죄다 빈칸이 됩니다');
  assert.match(t, /다른 서류의 값을 섞지/,
    '★ 섞지 말라고 안 하면 계약서 칸에 은행·계좌가 들어옵니다');
});

test('★★★ 한 쪽짜리에는 그 말을 «안» 붙인다 — 없는 쪽을 지어낸다', async () => {
  const t = await 보낸글(function (D) { return D.readDocText('자문계약서 제1조 갑은 을을'); });
  assert.doesNotMatch(t, /반드시 이 꼴/,
    '★★★ 한 쪽인데 「여러 쪽」이라고 하면 AI 가 없는 쪽을 지어냅니다');
});

test('★★ 그림 길과 글자 길이 «같은 규칙»을 보낸다 — 두 벌이면 한쪽이 옛 규칙으로 남는다', () => {
  const src = stripJs(READ_SRC);
  assert.match(src, /TEXT_MULTI_NOTE = MULTI_NOTE/,
    '★★ 글자 길이 제 말을 따로 쓰면, 그림 길만 고쳐 놓고 글자 길은 옛 규칙으로 남습니다');
  assert.ok(!/한 벌의 JSON/.test(src),
    '★★ 옛 말(「한 벌의 JSON 만 주세요」)이 남아 있으면 새 규칙과 정면으로 부딪힙니다');
});

/* ══════ ② 화면 — 쪽마다 제 서류의 답을 준다 ═══════════════════════════════ */

function 화면() {
  const ctx = { console, Object, Array, String, Number, Math, isFinite, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(APP, 'function pageReads('),
    cutFn(APP, 'function docLeads(')
  ].join('\n'), ctx);
  return ctx;
}
const S = 화면();
const 쪽들 = [{ id: 'p1' }, { id: 'p2' }];
const 읽음 = {
  kind: 'contract', fields: { company: '아이행복어린이집' }, auto: true, at: 1,
  docs: [
    { pages: [1], kind: 'contract', fields: { company: '아이행복어린이집' } },
    { pages: [2], kind: 'cms', fields: { bankName: '하나은행', bankAcct: '6779100 1708204' } }
  ]
};

test('★★★ 쪽마다 «제 서류»의 답을 받는다', () => {
  S.__read = 읽음; S.__sibs = 쪽들;
  const out = vm.runInContext('pageReads(__read, __sibs)', S);
  assert.equal(out[0].kind, 'contract');
  assert.equal(out[1].kind, 'cms',
    '★★★ 2쪽이 아직 contract 입니다 — 자동이체가 그대로 사라집니다');
  assert.equal(out[1].fields.bankAcct, '6779100 1708204');
  assert.equal(out[0].fields.bankAcct, undefined, '1쪽에 2쪽 것이 섞이면 안 됩니다');
});

test('★★ 쪽마다 «서류 전부»를 담지 않는다 — 쪽수만큼 쌓인다', () => {
  S.__read = 읽음; S.__sibs = 쪽들;
  const out = vm.runInContext('pageReads(__read, __sibs)', S);
  out.forEach(function (r) {
    assert.ok(!r.docs, '★★ 쪽마다 전부를 담으면 pairs 가 쪽수만큼 겹쳐 쌓입니다');
    assert.ok(Array.isArray(r.docMap), '★ 가벼운 지도(docMap)가 없으면 쪽 띠가 갈래를 못 적습니다');
    assert.equal(r.docMap.length, 2);
    assert.ok(!r.docMap[0].fields, '★ 지도에는 «갈래 이름»만 — 칸을 담으면 가벼운 뜻이 없습니다');
  });
});

test('★★★ 서류가 하나면 예전 그대로 — 같은 답을 모든 쪽에 준다', () => {
  const 한벌 = { kind: 'contract', fields: { company: '가나상사' } };
  S.__read = 한벌; S.__sibs = 쪽들;
  const out = vm.runInContext('pageReads(__read, __sibs)', S);
  assert.equal(out.length, 2);
  assert.equal(out[0], out[1], '★★★ 한 서류인데 갈라 놓으면 2쪽 이후가 빈칸이 됩니다');
  assert.equal(out[0].kind, 'contract');
});

test('어느 서류에도 안 들어간 쪽은 «맨 앞 서류»에 붙인다 — 안 읽음으로 남기지 않는다', () => {
  S.__read = { kind: 'contract', fields: {}, docs: [
    { pages: [1], kind: 'contract', fields: { company: '가' } },
    { pages: [3], kind: 'cms', fields: { bankName: '하나은행' } }
  ] };
  S.__sibs = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const out = vm.runInContext('pageReads(__read, __sibs)', S);
  assert.equal(out[1].kind, 'contract', '★ 빠진 쪽이 「안 읽음」으로 남으면 같은 문서를 또 읽습니다');
  assert.equal(out[2].kind, 'cms');
});

/* ══════ ③ 보내기 — «서류마다 하나» (쪽마다도, 맨 앞 하나도 아니다) ══════════ */

test('★★★ 보내기는 «서류마다 하나» — 2쪽 자동이체가 제 길로 간다', () => {
  S.__read = 읽음; S.__sibs = 쪽들;
  const leads = vm.runInContext('docLeads(__read, __sibs)', S);
  assert.equal(leads.length, 2, '★★★ 하나만 보내면 2쪽 자동이체가 영영 안 갑니다');
  assert.equal(leads[0].job.id, 'p1');
  assert.equal(leads[1].job.id, 'p2');
  assert.equal(leads[1].read.kind, 'cms');
});

test('★★★ 서류가 하나면 «하나만» 보낸다 — 같은 업체가 쪽수만큼 쌓이면 안 된다', () => {
  S.__read = { kind: 'bizreg', fields: { company: '가나상사' }, auto: true };
  S.__sibs = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const leads = vm.runInContext('docLeads(__read, __sibs)', S);
  assert.equal(leads.length, 1,
    '★★★ 쪽마다 보내면 같은 업체가 쪽수만큼 쌓입니다(그래서 예전에 하나만 보냈습니다)');
  assert.equal(leads[0].job.id, 'p1');
});

test('★ 같은 서류의 여러 쪽은 «한 번만» 보낸다', () => {
  S.__read = { kind: 'contract', fields: {}, docs: [
    { pages: [1, 2, 3], kind: 'contract', fields: { company: '가' } },
    { pages: [4], kind: 'cms', fields: { bankName: '하나은행' } }
  ] };
  S.__sibs = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];
  const leads = vm.runInContext('docLeads(__read, __sibs)', S);
  assert.equal(leads.length, 2, '★ 3쪽짜리 계약서를 세 번 보내면 같은 계약이 셋으로 쌓입니다');
  assert.deepEqual(Array.from(leads).map(function (x) { return x.job.id; }), ['p1', 'p4']);
});

/* ══════ ③-2 쪽 띠 — 쪽을 «보이게» 한다 ══════════════════════════════════ */

function 띠(items, at) {
  const ctx = { console, Object, Array, String, Number, Math, JSON,
    gridItems: items,
    READ_LABEL: { contract: '계약서', cms: '자동이체 신청서', bizreg: '사업자등록증' },
    esc: function (s) { return String(s); },
    openViewer: function () { } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([cutFn(APP, 'function docPages('), cutFn(APP, 'function docStrip(')].join('\n'), ctx);
  ctx.__it = items.find(function (x) { return x.id === at; });
  return vm.runInContext('docStrip(__it)', ctx);
}
const 두쪽 = function (map) {
  const mk = function (n) {
    return { id: 'p' + n, meta: { doc: { group: 'g1', page: n, total: 2 },
      thumbUrl: 'https://x/' + n + '.jpg', read: map ? { docMap: map } : {} } };
  };
  return [mk(1), mk(2)];
};
const 지도 = [{ pages: [1], kind: 'contract' }, { pages: [2], kind: 'cms' }];

test('★★★ 쪽 띠가 «무엇이 있는지»까지 적는다 — 「2/2쪽」만으로는 못 찾는다', () => {
  const h = 띠(두쪽(지도), 'p1');
  assert.match(h, /pgstrip/, '★ 쪽 띠가 아예 안 그려집니다');
  assert.match(h, /1쪽/);
  assert.match(h, /2쪽/);
  assert.match(h, /자동이체 신청서/,
    '★★★ 쪽 번호만 적혀 있습니다 — 대표께서 못 찾으신 것이 바로 그 자리입니다');
});

test('★★ 지금 보는 쪽이 «표시»된다 — 어디 있는지 모르면 띠가 있으나 마나다', () => {
  const h1 = 띠(두쪽(지도), 'p1');
  const h2 = 띠(두쪽(지도), 'p2');
  assert.match(h1, /class="pg1 on"[\s\S]*?1쪽/, '★★ 1쪽을 보는데 표시가 1쪽에 없습니다');
  assert.equal((h1.match(/pg1 on/g) || []).length, 1, '★ 표시가 둘이면 어느 쪽인지 알 수 없습니다');
  assert.notEqual(h1, h2, '★★ 쪽을 넘겨도 띠가 똑같습니다');
});

test('★★★ 쪽이 하나면 띠를 «안» 그린다 — 늘 있는 띠는 곧 배경이 된다', () => {
  const 한장 = [{ id: 'p1', meta: { thumbUrl: 'https://x/1.jpg' } }];
  assert.equal(띠(한장, 'p1'), '', '★★★ 홑장에도 띠가 뜨면 판이 그만큼 길어집니다');
});

test('갈래 지도가 없으면(옛 기록) 쪽 번호만 적는다 — 없는 것을 지어내지 않는다', () => {
  const h = 띠(두쪽(null), 'p1');
  assert.match(h, /1쪽/);
  assert.doesNotMatch(h, /class="kd"/,
    '★ 갈래를 모르는데 빈 칸을 그리면 「읽었는데 종류가 없다」로 보입니다');
});

test('미리보기 그림을 띠에 건다 — 글씨만 있으면 눈으로 못 고른다', () => {
  const h = 띠(두쪽(지도), 'p1');
  assert.match(h, /background-image:url\(https:\/\/x\/1\.jpg\)/);
});

/* ══════ ④ 주민번호는 여전히 안 읽는다 ═══════════════════════════════════ */

test('★★★ 자동이체 서식의 «주민번호 앞 6자리»는 그대로 안 읽는다', () => {
  const 글 = stripJs(READ_SRC);
  assert.match(글, /kind=cms[\s\S]{0,400}?주민등록번호[\s\S]{0,80}?절대 읽지/,
    '★★★ 이 서식에는 「예금주 주민번호 앞 6자리」 칸이 있습니다 — 읽지 않는다는 말이 사라졌습니다');
  assert.doesNotMatch(/kind=cms 이면 키[^\n]*/.exec(글)[0] || '', /주민|rrn|ssn/i,
    '★★★ cms 가 담는 칸 목록에 주민번호가 들어갔습니다');
});

test('계좌번호는 «온전히» 담는다 — 가리지 않는다 (대표 결정 2026-08-28)', () => {
  const 글 = stripJs(READ_SRC);
  const 줄 = /kind=cms 이면 키[^\n]*/.exec(글)[0];
  assert.match(줄, /bankAcct\(계좌번호 — 적힌 그대로/,
    '★ 계좌를 가리면 「추후 cms 자동입력」이라는 쓰임이 없어집니다');
});
