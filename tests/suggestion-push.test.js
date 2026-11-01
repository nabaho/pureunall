'use strict';
/* 건의함 폰 알림의 덧붙이 둘 (대표 지시 2026-11-01 「둘다」) — functions/suggestion-push.js
   ① 감시 알림(watchNotice): 예약 작업이 쓴 한 줄을 관리자 폰으로
   ② 알림 시험(pushTest): 건의함 [🔔 테스트] — 본인 기기로 시험 알림, 결과를 done 에 적는다

   ■ 지키는 것 — 값이 아니라 «규칙»
     · 쓴 사람을 본다: 관리자·관리 도구만. 직원도 쓸 수 있는 자리라 안 보면 대표 폰에 아무 글자나 울린다
     · 시험은 «본인 것만», 관리자만, 15초 안 연타는 거절, done 에 다시 깨어나도 «한 번만»
     · 알림 글: 분류·제목·한 줄이 폰 한 줄에 맞게 줄어든다, 누르면 건의함이 열린다(?sg=1)
     · 규칙·최상위 자리를 새로 만들지 않는다(이미 열린 자리만 쓴다)
   실행: node --test tests/suggestion-push.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SGP = require('../functions/suggestion-push.js');
const SW = require('../scripts/suggestion-watch.js');

const CEO = 'U-CEO', STAFF = 'U-STAFF';
/* 가짜 DB·메시지 — 보낸 것과 쓴 것을 모은다 */
function world(opt) {
  const o = opt || {};
  const sent = [], wrote = [];
  const roles = o.roles || { [CEO]: { isAdmin: true }, [STAFF]: { isAdmin: false } };
  const tokens = o.tokens || { [CEO]: { T1: { at: 1 }, T2: { at: 2 } } };
  const sug = o.sug || { title: '종료자문사 자동이체시 매칭 안되는 문제', cat: 'erp' };
  const snap = (v) => ({ val: () => (v === undefined ? null : v), forEach(cb) { Object.keys(v || {}).forEach((k) => cb({ key: k, val: () => v[k] })); } });
  const db = {
    ref(p) {
      return {
        once: async () => {
          let m;
          if (p === 'uid_roles') return snap(roles);
          if ((m = /^uid_roles\/(.+)$/.exec(p))) return snap(roles[m[1]]);
          if ((m = /^fcm_tokens\/(.+)$/.exec(p))) return snap(tokens[m[1]]);
          if ((m = /^suggestions_private\/[^/]+\/(title|cat)$/.exec(p))) return snap(sug[m[1]]);
          return snap(null);
        },
        update: async (u) => { wrote.push(['update', u]); },
      };
    },
  };
  const messaging = {
    sendEachForMulticast: async (msg) => {
      sent.push(msg);
      return { successCount: msg.tokens.length - (o.fail || 0), failureCount: o.fail || 0,
        responses: msg.tokens.map((t, i) => (i < (o.fail || 0) ? { error: { code: 'x' } } : { success: true })) };
    },
  };
  return { db, messaging, sent, wrote, catName: { erp: '푸른이알피', fund: '기금관리', etc: '기타' } };
}
const notice = (o) => ({ val: () => o });
const ctx = (id, auth, authType) => ({ params: { id, nid: 'N1' }, auth, authType });

/* ── ① 감시 알림 ── */
test('★★ ① 감시 알림은 관리자 폰으로 간다 — 분류·제목·한 줄, 누르면 건의함이 열린다', async () => {
  const w = world();
  const r = await SGP.onWatchNotice(notice({ kind: 'pr', text: '수정안 PR 2800 — 합치기 전에 한 번 봐 주세요' }), ctx('S1', null, 'ADMIN'),
    { db: w.db, messaging: w.messaging, catName: w.catName });
  assert.equal(r.sent, 2, '관리자 기기 둘에 가야 합니다');
  const d = w.sent[0].data;
  assert.match(d.title, /건의함 감시 · 수정안 준비됨/);
  assert.match(d.body, /^\[푸른이알피\] 종료자문사/, '분류와 제목이 맨 앞이어야 폰 한 줄에서 무슨 건인지 압니다');
  assert.match(d.body, /수정안 PR 2800/);
  assert.match(d.url, /\?sg=1$/, '알림을 누르면 건의함이 바로 열려야 합니다');
  assert.equal(w.sent[0].notification, undefined, '★ data 전용이어야 합니다 — notification 을 함께 실으면 알림이 두 번 뜹니다');
});

test('★★ ① 직원이 쓴 알림은 막는다 — 직원도 새 건의를 올리며 아래 칸을 함께 담을 수 있다', async () => {
  const w = world();
  const r = await SGP.onWatchNotice(notice({ kind: 'decide', text: '가짜' }), ctx('S1', { uid: STAFF }, undefined),
    { db: w.db, messaging: w.messaging, catName: w.catName });
  assert.equal(r.skipped, 'not-trusted');
  assert.equal(w.sent.length, 0, '★★ 직원이 쓴 글이 대표 폰에 울렸습니다');
  const r2 = await SGP.onWatchNotice(notice({ kind: 'decide', text: 'x' }), ctx('S1', null, undefined), { db: w.db, messaging: w.messaging, catName: w.catName });
  assert.equal(r2.skipped, 'not-trusted', '쓴 사람을 모르면 막아야 합니다');
  assert.equal(w.sent.length, 0);
});

test('① 관리자 계정이 쓴 것은 된다 · 퇴사한 관리자는 안 된다', async () => {
  const ok = world();
  assert.equal((await SGP.onWatchNotice(notice({ kind: 'human', text: '확인' }), ctx('S1', { uid: CEO }), { db: ok.db, messaging: ok.messaging, catName: ok.catName })).sent, 2);
  const gone = world({ roles: { [CEO]: { isAdmin: true, status: 'resigned' } } });
  assert.equal((await SGP.onWatchNotice(notice({ kind: 'human', text: '확인' }), ctx('S1', { uid: CEO }), { db: gone.db, messaging: gone.messaging, catName: gone.catName })).skipped, 'not-trusted');
});

test('① 모르는 종류·빈 알림은 안 보낸다 · 긴 글은 줄여 보낸다', async () => {
  const w = world();
  const d = { db: w.db, messaging: w.messaging, catName: w.catName };
  assert.equal((await SGP.onWatchNotice(notice({ kind: 'weird', text: 'x' }), ctx('S1', null, 'ADMIN'), d)).skipped, 'bad-kind');
  assert.equal((await SGP.onWatchNotice(notice(null), ctx('S1', null, 'ADMIN'), d)).skipped, 'empty');
  await SGP.onWatchNotice(notice({ kind: 'done', text: '가'.repeat(500) }), ctx('S1', null, 'ADMIN'), d);
  assert.ok(w.sent[0].data.body.length <= 140, '폰 알림 한 줄에 안 맞게 깁니다: ' + w.sent[0].data.body.length);
  assert.ok(SGP.KIND_LABEL.pr && SGP.KIND_LABEL.decide && SGP.KIND_LABEL.human && SGP.KIND_LABEL.done, '알림 종류 넷이 없습니다');
});

/* ── ② 알림 시험 ── */
function change(after, uid, auth, authType) {
  const done = [];
  const c = { after: { val: () => after, ref: { child: (k) => ({ set: async (v) => { done.push([k, v]); } }) } } };
  return { change: c, context: { params: { uid }, auth, authType }, done };
}

test('★★ ② 본인이 [🔔 테스트]를 누르면 본인 등록 기기 «모두»로 보내고 결과를 done 에 적는다', async () => {
  const w = world();
  const t = change({ req: 111 }, CEO, { uid: CEO });
  const r = await SGP.onPushTest(t.change, t.context, { db: w.db, messaging: w.messaging, now: () => 5000 });
  assert.equal(r.sent, 2);
  assert.match(w.sent[0].data.title, /테스트/);
  assert.equal(t.done.length, 1);
  assert.deepEqual([t.done[0][0], t.done[0][1].req, t.done[0][1].targets, t.done[0][1].sent, t.done[0][1].failed], ['done', 111, 2, 2, 0]);
});

test('★★ ② 남의 열쇠에 쓴 요청 · 직원의 요청은 못 본 척한다 — 대표 폰에 아무나 울리지 못한다', async () => {
  const w = world();
  const t1 = change({ req: 1 }, CEO, { uid: STAFF });                 // 직원이 대표 열쇠에 씀
  assert.equal((await SGP.onPushTest(t1.change, t1.context, { db: w.db, messaging: w.messaging })).skipped, 'not-self');
  assert.equal(w.sent.length, 0, '★★ 직원이 대표 폰에 시험 알림을 울렸습니다');
  assert.equal(t1.done.length, 0, '장난에 답을 쓰면 안 됩니다');
  const t2 = change({ req: 2 }, STAFF, { uid: STAFF });               // 직원이 제 열쇠에 씀 → 관리자가 아니라 거절
  const r2 = await SGP.onPushTest(t2.change, t2.context, { db: w.db, messaging: w.messaging });
  assert.match(r2.error, /관리자/);
  assert.equal(w.sent.length, 0);
});

test('★ ② 한 번만 — done 을 쓰는 것에 다시 깨어나도 또 보내지 않는다', async () => {
  const w = world();
  const t = change({ req: 7, done: { req: 7, at: 100 } }, CEO, { uid: CEO });
  assert.equal((await SGP.onPushTest(t.change, t.context, { db: w.db, messaging: w.messaging })).skipped, 'already');
  assert.equal(w.sent.length, 0);
  assert.equal((await SGP.onPushTest(change(null, CEO, { uid: CEO }).change, { params: { uid: CEO }, auth: { uid: CEO } }, { db: w.db, messaging: w.messaging })).skipped, 'empty');
});

test('② 15초 안 연타는 보내지 않고 «말해 준다» · 15초가 지나면 다시 된다', async () => {
  const w = world();
  const quick = change({ req: 8, done: { req: 7, at: 10000 } }, CEO, { uid: CEO });
  const r = await SGP.onPushTest(quick.change, quick.context, { db: w.db, messaging: w.messaging, now: () => 10000 + SGP.TEST_MIN_GAP_MS - 1 });
  assert.equal(r.limited, true);
  assert.equal(w.sent.length, 0, '연타에 계속 울립니다');
  assert.equal(quick.done[0][1].req, 8, '화면이 기다리지 않게 요청 번호로 답해야 합니다');
  const slow = change({ req: 9, done: { req: 8, at: 10000 } }, CEO, { uid: CEO });
  assert.equal((await SGP.onPushTest(slow.change, slow.context, { db: w.db, messaging: w.messaging, now: () => 10000 + SGP.TEST_MIN_GAP_MS + 1 })).sent, 2);
});

test('② 등록된 기기가 없으면 «없다»고 알려 준다(조용히 끝내지 않는다)', async () => {
  const w = world({ tokens: {} });
  const t = change({ req: 5 }, CEO, { uid: CEO });
  const r = await SGP.onPushTest(t.change, t.context, { db: w.db, messaging: w.messaging, now: () => 1 });
  assert.equal(r.targets, 0);
  assert.equal(t.done[0][1].targets, 0, '화면이 「기기 없음」을 보여 주려면 done 에 0 이 적혀야 합니다');
});

/* ── 새 자리를 안 만든다 ── */
test('★ 새 최상위 자리·새 규칙이 없다 — 이미 열린 자리(suggestions_private 아래 · pucards/config 아래)만 쓴다', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.match(idx, /\.ref\("\/suggestions_private\/\{id\}\/watchNotice\/\{nid\}"\)/);
  assert.match(idx, /\.ref\("\/pucards\/config\/pushTest\/\{uid\}"\)/);
  assert.match(idx, /exports\.notifySuggestionWatch/);
  assert.match(idx, /exports\.pushSelfTest/);
  const rules = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'make-firebase-rules.js'), 'utf8');
  assert.ok(!/watchNotice|pushTest/.test(rules), '규칙에 새 자리를 만들었습니다 — 이 기능은 규칙을 올리지 않는 것이 약속입니다');
});

/* ── 감시 도구의 notify ── */
test('③ notify 의 알림 한 줄 — 종류는 넷뿐, 글은 비면 거절, 120자까지만, 공백은 정리', () => {
  assert.deepEqual(SW.NOTICE_KINDS, ['pr', 'decide', 'human', 'done']);
  assert.deepEqual(Object.keys(SGP.KIND_LABEL).sort(), SW.NOTICE_KINDS.slice().sort(), '도구와 서버 함수의 알림 종류가 어긋납니다');
  assert.throws(() => SW.buildNotice({ kind: 'x', text: 'a' }), /kind/);
  assert.throws(() => SW.buildNotice({ kind: 'pr', text: '   ' }), /비어/);
  const n = SW.buildNotice({ kind: 'pr', text: '  수정안   있음 ' + '가'.repeat(300), now: 42 });
  assert.equal(n.at, 42);
  assert.equal(n.text.length, 120);
  assert.match(n.text, /^수정안 있음/, '연속 공백이 안 접힙니다');
});
