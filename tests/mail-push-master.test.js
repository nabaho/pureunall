/* 📵 받은 메일 폰 알림의 «전체 스위치» (대표 지시 2026-10-20)
   「푸른메일함에 받은 메일 폰에서 자동으로 알림기능 중단시켜 달라. 그리고 다음에 활용할 수 있게
     기록해 두고 온오프 장치도 체크해 달라」
   ═══════════════════════════════════════════════════════════════════════════
   ★ 메일이 «들어올 때» 폰으로 알리는 길은 둘 — 📬 내 담당 메일(mail-owner, 담당자 폰)과
     📥 새 문의(mail-new-inquiry, 관리자 폰). 사람별 스위치(config/mailPush/{사번})는 앞의 것에만 있었고
     새 문의에는 아무 스위치도 없었다. 그 위에 «하나»(pucards/config/mailPushMaster)를 둔다.
   ★ off === true 일 «때만» 꺼진다 · 안 적혀 있으면 켜진 것 · 읽다 실패하면 «꺼진 것»(끄라고 하셨는데
     DB 가 흔들렸다고 폰이 울리면 안 된다) · 끄는 것은 «폰»뿐 — 띠·기록(mailbox/inq)은 그대로.
   이 검사는 두 길을 «실제로 돌려» 폰으로 가는지 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUSH = require('../functions/push-admins.js');
const OWN = require('../functions/mail-owner.js');
const NI = require('../functions/mail-new-inquiry.js');

const MASTER = PUSH.MAIL_PUSH_MASTER;

/* 가짜 DB — 경로별 값을 주고, 쓴 것을 모은다. master: undefined(안 적힘) | {off:..} | 'THROW' */
function fakeDb(master) {
  const writes = [];
  const reads = [];
  const snap = (v) => ({ val: () => (v === undefined ? null : v), forEach() {} });
  return {
    writes, reads,
    ref(p) {
      const path_ = p === undefined ? '' : String(p);
      return {
        once: async () => {
          reads.push(path_);
          if (path_ === MASTER) { if (master === 'THROW') throw new Error('DB 가 흔들립니다'); return snap(master); }
          return snap(null);
        },
        update: async (o) => { writes.push(o); },
      };
    },
  };
}
const R = (u, e, s, f) => ({ u, e, s, f: f || '', d: 1759500000000 + u });

/* ── 스위치 읽기 ── */
test('★★ off:true 일 때만 꺼진다 — 안 적혀 있거나 off:false 면 켜진 것', async () => {
  assert.equal(await PUSH.mailPushOff(fakeDb({ off: true })), true);
  assert.equal(await PUSH.mailPushOff(fakeDb(undefined)), false, '안 적혀 있는데 꺼졌다 — 만들어 놓고 아무 일도 안 하는 기능이 된다');
  assert.equal(await PUSH.mailPushOff(fakeDb({ off: false })), false);
  assert.equal(await PUSH.mailPushOff(fakeDb({})), false);
  assert.equal(await PUSH.mailPushOff(fakeDb({ off: 'true' })), false, '글자 「true」는 꺼짐이 아니다 — 정확히 true 만');
});

test('★★ 읽다가 실패하면 «꺼진 것»으로 본다 — 끄라고 하셨는데 DB 가 흔들렸다고 폰이 울리면 안 된다', async () => {
  assert.equal(await PUSH.mailPushOff(fakeDb('THROW')), true);
});

test('★ 스위치 자리는 pucards/config/mailPushMaster — 사람별 mailPush 와 겹치지 않는다', () => {
  assert.equal(MASTER, 'pucards/config/mailPushMaster');
  assert.notEqual(MASTER, OWN.PUSH_CFG);
  assert.ok(MASTER.indexOf(OWN.PUSH_CFG + '/') !== 0, 'mailPush 의 «아래»에 두면 사번 열쇠와 섞인다');
});

/* ── 📬 내 담당 메일 ── */
/* 담당표 읽기는 «멈춤 표시»로 막아 둔다 — 켜진 길이면 거기까지 «간다», 꺼진 길이면 «안 간다»를 가린다 */
async function runOwners(master) {
  let tablesRead = 0, messagingBuilt = 0;
  const db = fakeDb(master);
  let out = null, stopped = false;
  try {
    out = await OWN.notifyOwners(
      { getDatabase: () => db, getMessaging: () => { messagingBuilt++; return {}; } },
      { slug: 'box', rows: [{ u: '1', e: 'a@x.kr', f: '홍길동', s: '가', d: 1 }],
        readTables: async () => { tablesRead++; throw new Error('검사 멈춤 표시'); } });
  } catch (e) { stopped = /검사 멈춤 표시/.test(String(e && e.message)); if (!stopped) throw e; }
  return { out, tablesRead, messagingBuilt, stopped };
}

test('★★★ 전체가 꺼져 있으면 📬 내 담당 메일은 «담당 계산도 기기 찾기도» 안 한다', async () => {
  const r = await runOwners({ off: true });
  assert.equal(r.out.off, true, '꺼졌다고 알리지 않는다 — 로그에서 왜 안 갔는지 못 알아낸다');
  assert.equal(r.out.pushed, 0);
  assert.equal(r.tablesRead, 0, '꺼졌는데 담당표를 읽었다 — 10분마다 도는 자리라 헛일이 곧 요금이다');
  assert.equal(r.messagingBuilt, 0, '꺼졌는데 발송 도구를 만들었다');
});

test('★★ 안 적혀 있으면 📬 내 담당 메일은 «예전처럼» 돈다 — 스위치가 길을 막지 않는다', async () => {
  const r = await runOwners(undefined);
  assert.equal(r.tablesRead, 1, '켜진 것인데 담당 계산을 안 했다 — 스위치가 길을 막고 있다');
  assert.equal(r.stopped, true);
});

/* ── 📥 새 문의 ── */
async function runInq(master) {
  let pushed = 0;
  const db = fakeDb(master);
  const real = PUSH.pushAdmins;
  PUSH.pushAdmins = async () => { pushed++; return { targets: 1, sent: 1 }; };
  try {
    const out = await NI.notifyNewInquiries({ getDatabase: () => db, getMessaging: () => ({}) },
      { slug: 'INBOX', rows: [R(1, 'hong@new.kr', '상담 문의드립니다', '홍길동')] });
    const keys = Object.keys(Object.assign({}, ...db.writes)).filter((k) => k.indexOf('mailbox/inq/') === 0);
    return { out, pushed, keys };
  } finally { PUSH.pushAdmins = real; }
}

test('★★★ 전체가 꺼져 있어도 📥 새 문의 «기록(띠)»은 남고 «폰만» 안 울린다', async () => {
  const r = await runInq({ off: true });
  assert.equal(r.keys.length, 1, '꺼졌다고 기록까지 안 남겼다 — 화면의 새 문의 띠가 사라진다');
  assert.equal(r.pushed, 0, '꺼졌는데 관리자 폰으로 보냈다');
  assert.equal(r.out.off, true);
});

test('★★ 안 적혀 있으면 📥 새 문의는 «예전처럼» 폰으로 간다', async () => {
  const r = await runInq(undefined);
  assert.equal(r.keys.length, 1);
  assert.equal(r.pushed, 1, '켜진 것인데 폰으로 안 갔다');
});

test('★★ 읽다가 실패해도 📥 새 문의는 폰으로 안 간다(기록은 남는다)', async () => {
  const r = await runInq('THROW');
  assert.equal(r.keys.length, 1);
  assert.equal(r.pushed, 0);
});

/* ── 다른 알림은 건드리지 않는다 ── */
test('★★ «메일이 들어올 때» 알리는 길만 막는다 — 건의·방문 문자·출장 알림은 그대로', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const near = (needle) => { const i = idx.indexOf(needle); return i < 0 ? '' : idx.slice(i, i + 900); };
  assert.ok(!/mailPushOff/.test(idx), 'index.js(건의·방문 문자)가 메일 스위치를 본다 — 메일 말고 다른 알림까지 꺼진다');
  assert.ok(/PUSH\.pushAdmins/.test(idx), '건의 알림 길이 사라졌다');
  const push = fs.readFileSync(path.join(__dirname, '..', 'functions', 'push-admins.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const send = push.slice(push.indexOf('async function sendTo('), push.indexOf('async function pushAdmins('));
  assert.ok(!/mailPushOff|MAIL_PUSH_MASTER/.test(send), '보내는 한 자리(sendTo)에서 막으면 건의·출장·달력 알림까지 같이 멎는다');
});

test('★★ 두 길이 «함께» 본다 — 한쪽만 보면 다른 쪽이 계속 울린다', () => {
  const o = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-owner.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const n = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-new-inquiry.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(o, /PUSH\.mailPushOff\(db\)/);
  assert.match(n, /PUSH\.mailPushOff\(db\)/);
});
