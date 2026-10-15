"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("./visit-sms");

/* 가짜 DB — once/update/transaction 만 흉내 낸다(경로는 / 로 쪼갠 중첩 객체) */
function fakeDb(seed) {
  const root = JSON.parse(JSON.stringify(seed || {}));
  const walk = (p, make) => {
    const parts = p.split("/").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { if (!make) return [null, null]; cur[parts[i]] = {}; }
      cur = cur[parts[i]];
    }
    return [cur, parts[parts.length - 1]];
  };
  const get = (p) => { const [c, k] = walk(p, false); return c ? c[k] : (p === "" ? root : undefined); };
  const set = (p, v) => { const [c, k] = walk(p, true); if (v === null) delete c[k]; else c[k] = v; };
  return {
    root,
    ref(p) {
      p = p || "";
      return {
        once: async () => ({ val: () => { const v = p === "" ? root : get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
        update: async (patch) => {
          Object.keys(patch).forEach((k) => {
            const full = p ? p + "/" + k : k;
            const v = patch[k];
            if (v !== null && typeof v === "object" && p && !k.includes("/")) { const cur = get(full); set(full, Object.assign({}, cur || {}, v)); }
            else set(full, v);
          });
        },
        transaction: async (fn) => {
          const cur = get(p);
          const next = fn(cur === undefined ? null : cur);
          if (next === undefined) return { committed: false };
          set(p, next); return { committed: true };
        },
      };
    },
  };
}

const NOW = Date.parse("2026-10-15T00:00:00.000Z");   // 서울 09:00
const DATE = "2026-10-15";

const SEED = {
  scal_staff: [{ id: "a1", name: "권형하" }, { id: "a3", name: "박한별" }],
  scal_cos: [
    { id: "c1", name: "광성산업", erpId: "E1" },
    { id: "c2", name: "연락처없는곳", erpId: "E2" },
    { id: "c3", name: "유선만", erpId: "E3" },
    { id: "c4", name: "연결안됨" },
  ],
  scal_scheds: [
    { id: "s1", date: DATE, attId: "a1", coId: "c1", isField: true },
    { id: "s1b", date: DATE, attId: "a1", coId: "c1", isField: true },   // 같은 사업장 두 건 → 한 통
    { id: "s2", date: DATE, attId: "a1", coId: "c2", isField: true },
    { id: "s3", date: DATE, attId: "a1", coId: "c3", isField: true },
    { id: "s4", date: DATE, attId: "a1", coId: "c4", isField: true },
    { id: "s5", date: DATE, attId: "a1", coId: "c1", isField: false },   // 사무실은 제외(위와 합쳐지지도 않음)
    { id: "s6", date: DATE, attId: "a3", coId: "c1", isField: true },    // 대상 아님
    { id: "s7", date: "2026-10-16", attId: "a1", coId: "c1", isField: true },   // 내일
  ],
  data: { companies: { v: [
    { id: "E1", primaryContactName: "김담당", primaryContactPhone: "010-1234-5678" },
    { id: "E2", primaryContactName: "", primaryContactPhone: "" },
    { id: "E3", primaryContactName: "이대리", primaryContactPhone: "041-123-4567" },
  ] } },
};

test("번호: 휴대폰만 받고 +82·하이픈은 정리, 유선은 거른다", () => {
  assert.equal(V.normMobile("010-1234-5678"), "01012345678");
  assert.equal(V.normMobile("+82 10-1234-5678"), "01012345678");
  assert.equal(V.normMobile("041-123-4567"), "");
  assert.equal(V.normMobile(""), "");
  assert.equal(V.normMobile(null), "");
  assert.equal(V.maskPhone("01012345678"), "010-****-5678");
});

test("서울 날짜: UTC 15시 이후는 서울에서 다음 날", () => {
  assert.equal(V.seoulDate(Date.parse("2026-10-14T15:30:00Z")), "2026-10-15");
  assert.equal(V.seoulDate(Date.parse("2026-10-14T14:59:00Z")), "2026-10-14");
});

test("오늘 방문(현장)·대상 담당자만, 사업장당 한 줄, 불확실하면 skip", () => {
  const rows = V.planToday({ date: DATE, config: {}, scheds: SEED.scal_scheds, cos: SEED.scal_cos, staff: SEED.scal_staff, companies: SEED.data.companies.v });
  const by = {}; rows.forEach((r) => { by[r.coId] = r; });
  assert.deepEqual(Object.keys(by).sort(), ["c1", "c2", "c3", "c4"]);
  assert.equal(by.c1.status, "ready");
  assert.equal(by.c1.phone, "01012345678");
  assert.deepEqual(by.c1.schedIds.sort(), ["s1", "s1b"]);
  assert.equal(by.c2.status, "skip");
  assert.match(by.c2.why, /연락처가 없음/);
  assert.equal(by.c3.status, "skip");
  assert.match(by.c3.why, /휴대폰이 아님/);
  assert.equal(by.c4.status, "skip");
  assert.match(by.c4.why, /연결되지 않은/);
  assert.match(by.c1.text, /10\/15/);
  assert.match(by.c1.text, /권형하/);
});

test("주담당 칸이 비면 contacts 의 주담당 휴대폰 한 명만 쓰고, 둘로 갈리면 안 보낸다", () => {
  const one = V.pickContact({ contacts: [{ name: "가", isPrimary: true, mobile: "010-1111-2222" }, { name: "나", mobile: "010-3333-4444" }] });
  assert.equal(one.phone, "01011112222");
  const two = V.pickContact({ contacts: [{ name: "가", isPrimary: true, mobile: "010-1111-2222" }, { name: "나", isPrimary: true, mobile: "010-3333-4444" }] });
  assert.equal(two.phone, "");
  assert.match(two.why, /둘 이상/);
  const left = V.pickContact({ contacts: [{ name: "가", isPrimary: true, left: true, mobile: "010-1111-2222" }] });
  assert.equal(left.phone, "");
});

test("queue 에는 번호를 가려서 적는다 — 진짜 번호가 없다", async () => {
  const db = fakeDb(SEED);
  const out = await V.prepare(db, { nowMs: NOW });
  assert.equal(out.mode, "approve");
  assert.equal(out.ready, 1);
  assert.equal(out.skip, 3);
  const q = db.root.scal_env.visitSms.queue[DATE];
  assert.equal(q[DATE + "_c1"].phoneMasked, "010-****-5678");
  assert.ok(!JSON.stringify(db.root.scal_env).includes("01012345678"));
  assert.ok(!JSON.stringify(db.root.scal_env).includes("1234-5678"));
});

test("승인 방식에서는 prepare 가 문자를 보내지 않는다", async () => {
  const db = fakeDb(SEED);
  let calls = 0;
  await V.prepare(db, { nowMs: NOW, cred: { apiKey: "k", apiSecret: "s", from: "01099998888" }, fetchImpl: async () => { calls++; return { ok: true, json: async () => ({}) }; } });
  assert.equal(calls, 0);
});

test("꺼짐(off)이면 아무것도 적지 않는다", async () => {
  const db = fakeDb(Object.assign({}, SEED, { scal_env: { visitSms: { config: { mode: "off" } } } }));
  const out = await V.prepare(db, { nowMs: NOW });
  assert.equal(out.mode, "off");
  assert.equal(db.root.scal_env.visitSms.queue, undefined);
});

function okFetch(log) {
  return async (url, init) => {
    log.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ messageId: "M1" }) };
  };
}
const CRED = { apiKey: "KEY", apiSecret: "SECRET", from: "01099998888" };

test("승인 발송: 서버가 번호를 다시 읽어 보내고, 두 번째 요청은 막는다", async () => {
  const db = fakeDb(SEED);
  await V.prepare(db, { nowMs: NOW });
  const log = [];
  const r1 = await V.sendApproved(db, { keys: [DATE + "_c1"], by: "uid1", nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(r1.sent, 1);
  assert.equal(log.length, 1);
  const body = JSON.parse(log[0].init.body);
  assert.equal(body.message.to, "01012345678");
  assert.equal(body.message.from, "01099998888");
  assert.match(log[0].init.headers.Authorization, /^HMAC-SHA256 apiKey=KEY, date=.+, salt=.+, signature=[0-9a-f]{64}$/);
  assert.equal(db.root.scal_env.visitSms.queue[DATE][DATE + "_c1"].status, "sent");

  const r2 = await V.sendApproved(db, { keys: [DATE + "_c1"], by: "uid2", nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(r2.sent, 0);
  assert.equal(r2.skipped, 1);
  assert.equal(log.length, 1);           // 다시 안 나갔다
});

test("화면이 보낸 번호·문구는 믿지 않는다 — 열쇠만 받는다", async () => {
  const db = fakeDb(SEED);
  const log = [];
  await V.sendApproved(db, { keys: [DATE + "_c1"], to: "01000000000", text: "아무말", by: "u", nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  const body = JSON.parse(log[0].init.body);
  assert.equal(body.message.to, "01012345678");
  assert.doesNotMatch(body.message.text, /아무말/);
});

test("skip 줄은 열쇠를 줘도 안 나간다", async () => {
  const db = fakeDb(SEED);
  const log = [];
  const r = await V.sendApproved(db, { keys: [DATE + "_c2"], by: "u", nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(r.sent, 0);
  assert.equal(log.length, 0);
});

test("오늘이 아닌 날짜 요청은 거절", async () => {
  const db = fakeDb(SEED);
  await assert.rejects(() => V.sendApproved(db, { date: "2026-10-14", keys: ["x"], by: "u", nowMs: NOW, cred: CRED }), /오늘 날짜/);
});

test("발송 실패는 failed 로 남고 다시 시도할 수 있다", async () => {
  const db = fakeDb(SEED);
  const bad = async () => ({ ok: false, status: 400, json: async () => ({ errorCode: "X", errorMessage: "발신번호 미등록" }) });
  const r1 = await V.sendApproved(db, { keys: [DATE + "_c1"], by: "u", nowMs: NOW, cred: CRED, fetchImpl: bad });
  assert.equal(r1.failed, 1);
  assert.equal(db.root.scal_env.visitSms.queue[DATE][DATE + "_c1"].status, "failed");
  assert.match(db.root.scal_env.visitSms.queue[DATE][DATE + "_c1"].error, /발신번호/);
  const log = [];
  const r2 = await V.sendApproved(db, { keys: [DATE + "_c1"], by: "u", nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(r2.sent, 1);
});

test("열쇠·발신번호가 없으면 보내지 않고 failed 로 남긴다", async () => {
  const db = fakeDb(SEED);
  const r = await V.sendApproved(db, { keys: [DATE + "_c1"], by: "u", nowMs: NOW, cred: { apiKey: "", apiSecret: "", from: "" } });
  assert.equal(r.failed, 1);
  assert.match(db.root.scal_env.visitSms.queue[DATE][DATE + "_c1"].error, /설정/);
});

test("자동 방식은 9시 목록 만들기에서 바로 보낸다", async () => {
  const db = fakeDb(Object.assign({}, SEED, { scal_env: { visitSms: { config: { mode: "auto" } } } }));
  const log = [];
  const out = await V.prepare(db, { nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(out.sent, 1);
  assert.equal(log.length, 1);
  // 두 번째 9시 실행(재시도)에도 중복으로 안 나간다
  const out2 = await V.prepare(db, { nowMs: NOW, cred: CRED, fetchImpl: okFetch(log) });
  assert.equal(out2.sent, 0);
  assert.equal(log.length, 1);
});

test("원본(일정·사업장·업체)은 고치지 않는다", async () => {
  const db = fakeDb(SEED);
  const before = JSON.stringify({ a: db.root.scal_scheds, b: db.root.scal_cos, c: db.root.data, d: db.root.scal_staff });
  await V.prepare(db, { nowMs: NOW });
  await V.sendApproved(db, { keys: [DATE + "_c1"], by: "u", nowMs: NOW, cred: CRED, fetchImpl: okFetch([]) });
  const after = JSON.stringify({ a: db.root.scal_scheds, b: db.root.scal_cos, c: db.root.data, d: db.root.scal_staff });
  assert.equal(after, before);
});
