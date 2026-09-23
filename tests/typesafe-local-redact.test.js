'use strict';
/* TypeSafe(Jev) 검토 — «우리가 아는» 이름·업체명 가리기 (2026-09-20 대표 결정 「우리 목록만」)

   ■ 2026-09-23 자리가 바뀌었다 — 대표 지시 「푸른통합시스템 전체로 적용해서 캡쳐3화면
   (포털)으로 옮기고 연결해줘」, 목업 ①안 「빼고 포털로만」.
   예전에는 이알피(pu-erp.html)의 typeSafeLocalRedact 가 «이미 들고 있는» 명부로 가렸다.
   포털은 명부를 안 들고 있어서, 가리는 셈을 공용 부품(js/pu-typesafe.js redactNames)으로
   옮기고 부품이 「제안 받기」를 누를 때 목록을 스스로 한 번 읽게 했다.

   ■ 왜 서버가 아니라 화면에서 하나
   서버(functions/typesafe-evaluate.js)는 번호(주민번호·전화·계좌 등)만 가린다. 이름·회사
   이름은 모양이 없어 서버 혼자 못 가린다 — 그렇다고 명부를 서버로 넘기면 가리려던
   명부 자체가 새는 셈이라 화면에서 끝낸다.

   ■ 여기서 보는 것 — «값»이다
   가리기는 값이 틀리면 곧바로 새는 정보라 구조만 봐서는 부족하다. 진짜 js/pu-typesafe.js 를
   가짜 창에 올려 돌리고, 마지막에는 «업체로 실제로 나가는 글»까지 붙잡아 본다.
   ⚠ «완벽히 가린다»는 검사하지 않는다 — 목록에 없는 이름은 원래 못 잡는다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-typesafe.js'), 'utf8');

/* 손으로 지은 최소 DOM — tests/typesafe-consent-gate.test.js 와 같은 길이다.
   opts.db   : { 'data/user_accounts/v': 값, ... } — 없는 자리는 null
   opts.dbFail: true 면 목록 읽기가 실패한다
   opts.reads: 읽은 자리를 담을 배열 / opts.sent: 업체로 보낸 body 를 담을 배열 */
function load(opts) {
  opts = opts || {};
  const byId = {};
  function makeEl(tag) {
    return {
      tagName: tag, style: {}, children: [],
      setAttribute() {}, addEventListener() {}, removeEventListener() {}, focus() {}, remove() {},
      appendChild(child) { this.children.push(child); return child; },
      _id: '',
      get id() { return this._id; },
      set id(v) { this._id = v; if (v) byId[v] = this; }
    };
  }
  const body = makeEl('body'); body.classList = { toggle() {} };
  const head = makeEl('head');
  const doc = {
    createElement: makeEl, getElementById: (id) => byId[id] || null, addEventListener() {},
    body, head, documentElement: head, readyState: 'complete'
  };
  const fb = {
    auth: () => ({
      currentUser: { uid: 'u1', getIdToken: async () => 'tok' },
      onAuthStateChanged() {}
    }),
    database: () => ({
      ref: (p) => ({
        once: () => {
          if (opts.reads) opts.reads.push(p);
          if (opts.dbFail) return Promise.reject(new Error('일부러 못 읽는다'));
          return Promise.resolve({ val: () => ((opts.db || {})[p] === undefined ? null : opts.db[p]) });
        }
      })
    })
  };
  const win = { firebase: fb };
  const ctx = {
    console, window: win, document: doc, firebase: fb, setTimeout, clearTimeout, AbortController: undefined,
    fetch: async (url, o) => {
      if (opts.sent) opts.sent.push(JSON.parse(o.body).text);
      return { ok: true, status: 200, json: async () => ({ ok: true, answers: {} }) };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { win, byId };
}
function 훑기(el, tag) {
  if (!el || !Array.isArray(el.children)) return null;
  if (el.tagName === tag) return el;
  for (const c of el.children) { const hit = 훑기(c, tag); if (hit) return hit; }
  return null;
}
/* 창을 열고 확인란에 체크한 뒤 글을 넣어 「제안 받기」를 누른다 — 사람이 하는 순서 그대로 */
async function 누르기(env, 글) {
  env.win.PuTypeSafe.open();
  const ack = env.byId['pu-typesafe-ack'];
  ack.checked = true; ack.onchange();
  훑기(env.byId['pu-typesafe-review'], 'textarea').value = 글;
  await env.byId['pu-typesafe-run-btn'].onclick();
}

const 직원 = ['홍길동', '가나다'];
const 업체 = ['가나상사'];
const 가리기 = (t, s, c) => load().win.PuTypeSafe.redactNames(t, s || [], c || []);

/* ══ 셈 자체 — redactNames ══ */

test('목록에 있는 직원 이름은 확실히 가려진다', () => {
  const got = 가리기('홍길동 님이 계약 마감을 물었습니다.', 직원);
  assert.doesNotMatch(got.text, /홍길동/);
  assert.match(got.text, /\[직원1\]/);
});

test('목록에 있는 업체 이름도 가려진다', () => {
  const got = 가리기('가나상사와 계약이 곧 끝납니다.', [], 업체);
  assert.doesNotMatch(got.text, /가나상사/);
  assert.match(got.text, /\[업체1\]/);
});

test('같은 이름은 같은 표(placeholder)로 — 문맥이 유지된다', () => {
  const got = 가리기('홍길동이 물었는데 홍길동에게 아직 답장을 못 했습니다.', 직원);
  assert.equal((got.text.match(/\[직원1\]/g) || []).length, 2,
    '같은 사람인데 다른 번호로 갈라지면 Jev 가 두 사람으로 착각합니다.');
  assert.doesNotMatch(got.text, /\[직원2\]/, '한 사람만 나왔는데 두 번째 번호가 생겼습니다.');
});

test('긴 이름부터 바꾼다 — 짧은 이름이 긴 이름(업체명)을 먼저 망가뜨리지 않는다', () => {
  /* ⚠ 목록에는 «짧은 것을 먼저» 넣는다 — 이미 긴 것부터면 정렬을 지워도 우연히 통과한다. */
  const got = 가리기('가나상사 소속 가나 대리점 문의입니다.', [], ['가나', '가나상사']);
  assert.doesNotMatch(got.text, /가나상사/, '업체명 전체가 안 가려졌습니다.');
  /* ⚠ \b 는 한글 앞뒤에서 못 믿는다 — 손상된 «정확한 모양»(]상사)을 직접 짚는다. */
  assert.doesNotMatch(got.text, /\]상사/, '짧은 이름을 먼저 바꿔 «상사» 글자가 반쪽으로 남았습니다.');
});

test('두 사람·두 업체가 섞이면 번호가 갈라진다', () => {
  const got = 가리기('홍길동과 가나다가 가나상사 건으로 통화했습니다.', 직원, 업체);
  assert.match(got.text, /\[직원1\]/);
  assert.match(got.text, /\[직원2\]/);
  assert.match(got.text, /\[업체1\]/);
});

test('가린 항목 표는 몇 건 가렸는지 사람 말로 알려 준다', () => {
  const got = 가리기('홍길동과 가나다가 가나상사 건으로 통화했습니다.', 직원, 업체);
  assert.ok(got.localMaskedKinds.some((k) => /직원 이름 2건/.test(k)));
  assert.ok(got.localMaskedKinds.some((k) => /업체명 1건/.test(k)));
});

test('목록에 없으면 그대로 둔다 — «목록에 있는 것만» 가린다는 뜻을 지킨다', () => {
  const got = 가리기('외부인 김철수 씨가 문의했습니다.', 직원, 업체);
  assert.match(got.text, /김철수/, '이 검사는 «목록에 없으면 못 잡는다»는 한계를 확인하는 것입니다.');
  /* ⚠ vm 상자 안에서 만든 배열은 deepEqual 이 튕긴다 — 길이로 본다. */
  assert.equal(got.localMaskedKinds.length, 0);
});

test('목록이 비었거나 이상한 모양이어도 죽지 않는다', () => {
  const pt = load().win.PuTypeSafe;
  assert.doesNotThrow(() => pt.redactNames('아무 문의나 넣어 봅니다.', [], []));
  assert.doesNotThrow(() => pt.redactNames('아무 문의나 넣어 봅니다.', null, undefined));
  assert.doesNotThrow(() => pt.redactNames('아무 문의나', [null, 3, ''], ['가나상사']));
});

test('한 글자짜리 이름은 후보에서 뺀다 — 아무 문장에나 나오는 흔한 글자를 지우면 안 된다', () => {
  const got = 가리기('이 문의는 이번 주 안에 처리해야 합니다.', ['이']);
  assert.match(got.text, /^이 문의는 이번/, '한 글자 이름까지 후보로 삼으면 문장 전체가 망가집니다.');
});

/* ══ 포털 — 목록을 «스스로» 읽어 가리고, 업체로 나가는 글에는 이름이 없다 ══ */

test('★ 포털(호스트가 안 가려 줌)에서는 직원·업체 목록을 스스로 읽어 가린 뒤에 보낸다', async () => {
  const reads = [], sent = [];
  /* 서버 저장 모양은 {번호: 항목} 지도(업체)와 배열(직원) 둘 다 있다 — 둘 다 읽어야 한다 */
  const env = load({
    reads, sent,
    db: {
      'data/user_accounts/v': [{ name: '홍길동', sid: 'X-001' }],
      'data/companies/v': { 'co-1': { id: 'co-1', name: '가나상사' } }
    }
  });
  await 누르기(env, '홍길동 님이 가나상사 계약 건을 물었습니다.');
  assert.equal(sent.length, 1, '업체를 한 번 불러야 합니다.');
  assert.doesNotMatch(sent[0], /홍길동/, '★ 직원 이름이 그대로 미국 서버로 나갔습니다.');
  assert.doesNotMatch(sent[0], /가나상사/, '★ 업체명이 그대로 미국 서버로 나갔습니다.');
  assert.match(sent[0], /\[직원1\]/);
  assert.match(sent[0], /\[업체1\]/);
  assert.ok(reads.includes('data/user_accounts/v'), '직원 명부를 안 읽었습니다.');
  assert.ok(reads.includes('data/companies/v'), '업체관리 목록을 안 읽었습니다.');
});

test('목록은 한 번만 읽는다 — 누를 때마다 0.4MB 를 다시 받지 않는다', async () => {
  const reads = [];
  const env = load({ reads, db: { 'data/user_accounts/v': [], 'data/companies/v': [] } });
  await 누르기(env, '첫 번째 문의입니다.');
  await 누르기(env, '두 번째 문의입니다.');
  assert.equal(reads.length, 2, '두 번 눌렀는데 목록을 다시 읽었습니다(직원·업체 한 번씩이면 2).');
});

test('★ 목록을 못 읽어도 검토는 막지 않되, 「이름은 못 가렸다」를 결과에 밝힌다', async () => {
  const reads = [], sent = [];
  const env = load({ reads, sent, dbFail: true });
  await 누르기(env, '홍길동 관련 문의입니다.');
  assert.equal(sent.length, 1, '목록을 못 읽었다고 검토 자체가 죽으면 안 됩니다(2026-09-20 결정).');
  const 결과 = 훑기(env.byId['pu-typesafe-review'], 'section').children
    .map((c) => c.innerHTML || '').join(' ');
  assert.match(결과, /이름은 가리지 못했습니다/,
    '★ 이름을 못 가렸는데 말없이 넘어가면 «가렸다»고 착각합니다.');
  /* 실패는 기억하지 않는다 — 다음에 누르면 다시 읽어 본다 */
  const 전 = reads.length;
  await 누르기(env, '다시 눌러 봅니다.');
  assert.ok(reads.length > 전, '한 번 실패했다고 다음부터 아예 안 읽으면 영영 이름이 안 가려집니다.');
});

test('호스트가 가려 주면(PU_TYPESAFE_LOCAL_REDACT) 목록을 따로 읽지 않는다', async () => {
  const reads = [], sent = [];
  const env = load({ reads, sent, db: { 'data/user_accounts/v': [{ name: '홍길동' }] } });
  env.win.PU_TYPESAFE_LOCAL_REDACT = (t) => ({ text: t.replace('임꺽정', '[직원9]'), localMaskedKinds: ['직원 이름 1건'] });
  await 누르기(env, '임꺽정 관련 문의입니다.');
  assert.equal(reads.length, 0, '호스트가 이미 아는데 목록을 또 읽었습니다.');
  assert.match(sent[0], /\[직원9\]/);
});
