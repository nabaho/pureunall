'use strict';
/* 📥 메일로 업체 담당자 채우기 — 서버가 메일 들어올 때 (2026-10-07 기업정보함 점검 ③-A)
   ① 서버의 셈 사본(functions/mail-fill-core/)이 화면 원본(js/pu-mail-fill-core.js)과 «한 글자까지» 같다
   ② 이름 다듬개가 화면의 ErpMatch._norm·_nameHit 과 같다 — 다르면 거울 칸을 화면과 다르게 채운다
   ③ 서버가 찍는 도장이 화면의 업체 저장 관문(PuCompanyWrite.patch)과 «같은 결과»다
   ④ 무엇을 채우고 무엇을 안 채우는가 — 가짜 서버로 실제로 돌린다
   ⑤ 메일 동기화가 «새로 받은 받은메일»에서 부른다 · 화면은 같은 셈을 쓰고 서버 기록을 덮지 않는다
   ⚠ 예시는 가짜다(가나상사·홍길동·example 도메인). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것 } = require('../scripts/sync-mail-fill-core.js');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const app = 읽기(path.join(뿌리, 'pu-cards.html'));
const CORE = require('../js/pu-mail-fill-core.js');
const MF = require('../functions/mail-fill.js');

test('★★★ 서버 사본이 화면 원본과 같다 — 다르면 화면과 서버가 다른 업체에 채운다', () => {
  assert.ok(옮길것.indexOf('pu-mail-fill-core.js') >= 0);
  옮길것.forEach((이름) => {
    const 사본 = path.join(뿌리, 'functions', 'mail-fill-core', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-mail-fill-core.js 를 돌려 주세요');
    assert.ok(읽기(path.join(뿌리, 'js', 이름)) === 읽기(사본),
      '★★★ functions/mail-fill-core/' + 이름 + ' 이 js/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 sync 를 돌리고 syncMailbox 를 다시 올려 주세요');
  });
});

test('★★ 이름 다듬개가 화면(ErpMatch)과 «글자까지» 같다 — 다르면 거울 칸을 다르게 채운다', () => {
  const core = 읽기(path.join(뿌리, 'js', 'pu-mail-fill-core.js'));
  const body = (src, re) => { const m = src.match(re); assert.ok(m, '다듬개를 못 찾았다: ' + re); return m[1].replace(/\s+/g, ''); };
  assert.equal(body(core, /function norm\(s\)\{([\s\S]*?); \}\n/), body(app, /\n  _norm\(s\)\{([\s\S]*?); \},\n/),
    '★★ js/pu-mail-fill-core.js 의 norm 과 pu-cards.html 의 ErpMatch._norm 이 다릅니다 — 한쪽만 고치지 말 것');
  assert.equal(body(core, /function nameHit\(a,b\)\{([^\n]*)\}\n/), body(app, /\n  _nameHit\(a,b\)\{([^\n]*)\},\n/));
});

/* ── 가짜 서버 — 거래는 «찬 자리(null) 먼저 → 서버 판»으로 부른다(실제 SDK 처럼) ── */
function fakeDb(tree) {
  const writes = [];
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const put = (p, v) => { const ks = p.split('/'); let o = tree; ks.slice(0, -1).forEach((k) => { o = o[k] || (o[k] = {}); }); o[ks[ks.length - 1]] = v; };
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  return { writes, tree, ref: (p) => ({
    once: async () => ({ val: () => clone(get(p)) }),
    set: async (v) => { writes.push({ p, v }); put(p, clone(v)); },
    update: async (u) => { writes.push({ p, u }); },
    transaction: async (fn) => {
      const cold = fn(null);
      if (cold === undefined) return { committed: false };
      const v = fn(clone(get(p)));
      if (v === undefined) return { committed: false };
      writes.push({ p, v }); put(p, clone(v));
      return { committed: true, snapshot: { val: () => clone(v) } };
    },
  }) };
}
const 업체 = (o) => Object.assign({ id: 'co-1', name: '가나상사', status: 'active', email: 'boss@ganasangsa.example',
  primaryContactName: '', primaryContactEmail: '', contacts: [], memo: '이알피에서 적은 메모' }, o || {});
const 줄 = (o) => Object.assign({ u: '1', e: 'hong@ganasangsa.example', f: '홍길동', s: '자료 보내드립니다', d: 100 }, o || {});
function 서버(cos, cfg) {
  const v = {}; cos.forEach((c) => { v[c.id] = c; });
  return fakeDb({ data: { companies: { v }, user_accounts: { v: { u1: { email: 'staff@purun.example' } } } },
    pucards: { config: Object.assign({ mailAutoFill: {}, mailNewSkip: {}, mailWho: {}, mailCo: {}, mailNotCo: {} }, cfg || {}) } });
}
async function 돌리기(db, rows) { MF._reset(); return MF.fillFromNewMail({ getDatabase: () => db }, { rows, now: 5000, fresh: true }); }

test('★★★ 서버 도장이 화면의 업체 저장 관문과 «같은 결과»다 — 다르면 이알피가 두 꼴을 받는다', async () => {
  const PCW = require('../js/pu-company-write.js');
  const O = require('../js/pu-ontology.js');
  assert.equal(MF.SCHEMA_VERSION, Number(O.VERSION) || 1, '★★★ 온톨로지 자료 구조 판이 바뀌었다 — functions/mail-fill.js 의 SCHEMA_VERSION 을 맞추고 syncMailbox 를 다시 올려 주세요');
  assert.equal(MF.CONTRACT_VERSION, require('../js/pu-ontology-write.js').CONTRACT_VERSION);
  const 판 = 업체({ revision: 3, createdAt: 10, createdBy: '처음 만든 이' });
  const fields = { contacts: [{ email: 'a@b.example' }], primaryContactEmail: 'a@b.example' };
  const 화면db = fakeDb({ data: { companies: { v: { 'co-1': JSON.parse(JSON.stringify(판)) } } } });
  await PCW.patch(화면db, 'co-1', 판, (cur) => Object.assign({}, cur, fields, { updatedAt: 5000 }), { actor: MF.ACTOR, now: 5000 });
  const 화면 = 화면db.tree.data.companies.v['co-1'];
  const 서버판 = MF.stamp(JSON.parse(JSON.stringify(판)), fields, 5000);
  assert.deepEqual(서버판, 화면, '★★★ 서버가 찍는 도장(entityType·schemaVersion·revision 등)이 관문과 다릅니다');
});

test('★★★ 회사 도메인이 업체 «한 곳»과 같으면 그 업체 담당자로 채운다 — 남의 칸은 그대로', async () => {
  const db = 서버([업체()]);
  const r = await 돌리기(db, [줄()]);
  assert.equal(r.added, 1);
  const co = db.tree.data.companies.v['co-1'];
  const c = co.contacts[co.contacts.length - 1];
  assert.equal(c.email, 'hong@ganasangsa.example');
  assert.equal(c.addedFrom, 'mail-auto', '★★ 되돌리기는 addedFrom:mail-auto 줄만 뺀다 — 이 표가 없으면 못 되돌린다');
  assert.equal(co.memo, '이알피에서 적은 메모', '★★★ 이알피에서 적은 칸이 사라졌다');
  assert.equal(co.primaryContactEmail, 'hong@ganasangsa.example');
  assert.equal(co.revision, 1);
  const log = db.tree.pucards.config.mailAutoFill['hong@ganasangsa,example'];
  assert.ok(log && log.added === true && log.co === 'co-1', '★★ 「정리한 것」 기록이 없으면 화면에서 되돌릴 수 없다');
  assert.ok(db.writes.some((w) => w.p === 'data/companies/u'), '★ 고친 시각(u)을 안 올리면 이알피가 다시 안 읽는다');
});

test('★★ 대표담당 이름이 «다른 사람»이면 거울 칸을 안 건드린다 — 한 줄이 두 사람을 섞는다', async () => {
  const db = 서버([업체({ primaryContactName: '김철수', primaryContactPhone: '010-0000-0000' })]);
  await 돌리기(db, [줄()]);
  const co = db.tree.data.companies.v['co-1'];
  assert.equal(co.primaryContactEmail, '');
  assert.equal(co.contacts.length, 1, '담당자 목록에는 들어간다 — 잃는 것은 없다');
});

test('★★★ 안 채우는 것 — 무료메일·두 업체가 쓰는 도메인·자동발송·직원·이미 정리한 주소', async () => {
  const 두곳 = [업체(), 업체({ id: 'co-2', name: '다라물류', email: 'x@ganasangsa.example' })];
  const 경우 = [
    ['무료메일', [업체()], {}, 줄({ e: 'hong@naver.com' })],
    ['두 업체가 쓰는 도메인', 두곳, {}, 줄()],
    ['자동발송', [업체()], {}, 줄({ e: 'no-reply@ganasangsa.example' })],
    ['깨진 글자', [업체()], {}, 줄({ s: '��' })],
    ['공공기관', [업체({ email: 'a@labor.go.kr' })], {}, 줄({ e: 'b@labor.go.kr' })],
    ['우리 직원 도메인', [업체({ email: 'boss@purun.example' })], {}, 줄({ e: 'other@purun.example' })],
    ['이미 채웠거나 되돌림', [업체()], { mailAutoFill: { 'hong@ganasangsa,example': { undone: 1 } } }, 줄()],
    ['「아니오」', [업체()], { mailNewSkip: { 'hong@ganasangsa,example': 1 } }, 줄()],
    ['사람이 정한 주소', [업체()], { mailWho: { 'hong@ganasangsa,example': 'P-1' } }, 줄()],
    ['자문사 아님(도메인)', [업체()], { mailNotCo: { '@ganasangsa,example': 1 } }, 줄()],
    ['끝난 업체', [업체({ status: 'terminated' })], {}, 줄()],
    ['지운 업체', [업체({ _deleted: true })], {}, 줄()],
  ];
  for (const [이름, cos, cfg, row] of 경우) {
    const db = 서버(cos, cfg);
    const r = await 돌리기(db, [row]);
    assert.equal(r.added, 0, '★★★ ' + 이름 + ' 인데 채웠다');
    assert.ok(!db.writes.some((w) => String(w.p).indexOf('data/companies') === 0), '★★★ ' + 이름 + ' 인데 업체 기록을 썼다');
  }
});

test('★★ 이미 적힌 주소면 «아무것도 안 쓴다» — 덮으면 남이 고친 것이 사라진다', async () => {
  const db = 서버([업체({ contacts: [{ email: 'hong@ganasangsa.example', name: '홍길동 부장' }] })]);
  const r = await 돌리기(db, [줄()]);
  assert.equal(r.added, 0);
  assert.ok(!db.writes.some((w) => String(w.p).indexOf('data/companies') === 0));
});

test('★ 메일 동기화가 «새로 받은 받은메일»에서 부른다 — 실패해도 동기화는 계속된다', () => {
  const src = 읽기(path.join(뿌리, 'functions', 'mail-sync.js'));
  assert.match(src, /require\('\.\/mail-fill'\)/);
  const i = src.indexOf('MAILFILL.fillFromNewMail(');
  assert.ok(i > 0, '★ mail-sync.js 가 채우기를 안 부른다');
  const blk = src.lastIndexOf("if (r.dir === 'fresh' && held.length && MB.folderKind(p.box) === 'inbox')", i);
  assert.ok(blk > 0 && src.indexOf('\n            }', blk) > i, '★ 새로 받은 받은메일 칸 안에서 불러야 한다 — 옛것 채우기에서 부르면 몇 달 전 메일로 채운다');
  assert.match(src.slice(i - 200, i + 300), /try \{[\s\S]*catch \(e\)/, '★ 던지면 메일 동기화가 멈춘다');
  assert.match(읽기(path.join(뿌리, 'functions', 'mail-fill.js')), /require\("\.\/mail-fill-core\/pu-mail-fill-core\.js"\)/, '서버는 사본(한 벌)을 써야 한다');
});

test('★★ 화면은 같은 셈을 쓰고, 서버가 남긴 기록을 «덮지 않는다»', () => {
  assert.match(app, /<script src="js\/pu-mail-fill-core\.js\?v=\d+"><\/script>/);
  assert.match(app, /function erpFillContactPlan\(cur, t, em, u\)\{[\s\S]{0,400}PuMailFill\.fillPlan\(/);
  assert.match(app, /function mnewDomTable\(\)\{[\s\S]{0,200}PuMailFill\.domTable\(/);
  const auto = app.slice(app.indexOf('async function mnewAutoFill('), app.indexOf('function mnewTickStart('));
  assert.match(auto, /transaction\(cur => cur \|\| rec\)/, '★★ 안 넣은 것(added:false)으로 서버 기록을 덮으면 「정리한 것」에서 못 되돌린다');
  assert.match(app, /function mnewLogLoad\(cb\)\{\n\s*if\(_mnewAutoLog !== null && Date\.now\(\) - _mnewLogAt < MNEW_LOG_TTL\)/,
    '★ 기록을 한 번만 읽으면 서버가 채운 것이 화면에 안 보인다');
  assert.ok(CORE.domCo('a@x.example', CORE.domTable([{ id: 'c', email: 'b@x.example' }]), () => false).id === 'c');
});
