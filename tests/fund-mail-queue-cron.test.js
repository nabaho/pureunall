'use strict';
/* 📬 기금 메일 큐 직렬화 + 정각 크론 분산 검증 (2026-11-28 병목 해소 2단계) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const FMC = require('../functions/fund-mail-collect');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function fakeDb(initialTree) {
  const tree = JSON.parse(JSON.stringify(initialTree || {}));
  function parts(p) { return String(p || '').split('/').filter(Boolean); }
  function getAt(p) {
    let cur = tree;
    for (const k of parts(p)) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[k];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(p, val) {
    const ks = parts(p);
    if (!ks.length) return;
    let cur = tree;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!cur[ks[i]] || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    if (val === null) delete cur[ks[ks.length - 1]];
    else cur[ks[ks.length - 1]] = JSON.parse(JSON.stringify(val));
  }
  return {
    getAt,
    ref(p) {
      if (p === undefined) {
        return {
          async update(patch) {
            Object.keys(patch).forEach((k) => setAt(k, patch[k]));
          }
        };
      }
      return {
        async once() { return { val: () => getAt(p) }; },
        orderByKey() {
          return {
            limitToFirst(n) {
              return {
                async once() {
                  const raw = getAt(p);
                  if (!raw || typeof raw !== 'object') return { val: () => null };
                  const out = {};
                  Object.keys(raw).sort().slice(0, n).forEach((k) => { out[k] = raw[k]; });
                  return { val: () => out };
                }
              };
            }
          };
        },
        async set(v) { setAt(p, v); },
        async update(patch) {
          const cur = getAt(p) || {};
          Object.keys(patch).forEach((k) => {
            if (patch[k] === null) delete cur[k];
            else cur[k] = JSON.parse(JSON.stringify(patch[k]));
          });
          setAt(p, cur);
        },
        async transaction(fn) {
          const cur = getAt(p);
          const next = fn(cur);
          if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
          setAt(p, next);
          return { committed: true, snapshot: { val: () => next } };
        }
      };
    }
  };
}

test('① makeMailQueueTicket 은 preview(p)·발신자·제목·첨부수를 보존한다', () => {
  const t = FMC.makeMailQueueTicket('INBOX', '99', {
    s: '기금 출연서류', f: '담당자', e: 'a@example.com', p: '미리보기', d: 1700000000000, a: 2
  }, 1700000005000);
  assert.equal(t.slug, 'INBOX');
  assert.equal(t.uid, '99');
  assert.equal(t.attempts, 0);
  assert.equal(t.queuedAt, 1700000005000);
  assert.equal(t.msg.p, '미리보기');
  assert.equal(t.msg.a, 2);
});

test('② 큐가 비어 있으면 IMAP 연결 0회로 즉시 반환한다', async () => {
  const db = fakeDb({});
  let imapCalls = 0;
  const res = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async () => { imapCalls += 1; }
  }, { now: 1700000000000 });
  assert.equal(res.processed, 0);
  assert.equal(res.imapSessions, 0);
  assert.equal(imapCalls, 0);
});

test('③ 같은 폴더(INBOX) 3건은 단일 IMAP 세션(withFolder 1회)으로 직렬 처리된다', async () => {
  const k1 = FMC.makeMailSeenKey('INBOX', '101');
  const k2 = FMC.makeMailSeenKey('INBOX', '102');
  const k3 = FMC.makeMailSeenKey('INBOX', '103');
  const db = fakeDb({
    fund_erp: {
      funds: { F1: { id: 'F1', name: '테스트사내근로복지기금' } },
      sites: { F1: { S_1: { id: 'S_1', name: '테스트법인', contacts: [{ email: 'trust@example.com' }] } } }
    },
    fund_mail_queue: {
      [k1]: FMC.makeMailQueueTicket('INBOX', '101', { s: '자료1', e: 'trust@example.com', a: 1, d: 1700000000000 }, 100),
      [k2]: FMC.makeMailQueueTicket('INBOX', '102', { s: '자료2', e: 'trust@example.com', a: 1, d: 1700000001000 }, 200),
      [k3]: FMC.makeMailQueueTicket('INBOX', '103', { s: '자료3', e: 'trust@example.com', a: 1, d: 1700000002000 }, 300)
    }
  });
  let withFolderCalls = 0;
  let fetchedUids = [];
  const res = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async (slug, fn) => {
      withFolderCalls += 1;
      assert.equal(slug, 'INBOX');
      return fn({ clientId: 'imap-session-' + withFolderCalls });
    },
    fetchWithClient: async (client, slug, uid) => {
      fetchedUids.push(client.clientId + ':' + uid);
      return {
        atts: [{ name: '문서_' + uid + '.pdf', part: '2', mime: 'application/pdf', buf: Buffer.from('test-' + uid) }],
        authResults: 'Authentication-Results: daum.net; spf=pass header.from=example.com'
      };
    }
  }, { now: 1700000010000 });

  assert.equal(withFolderCalls, 1, '같은 폴더 메일 3건이면 IMAP 세션은 1회만 열려야 합니다');
  assert.equal(res.imapSessions, 1);
  assert.equal(res.processed, 3);
  assert.deepEqual(fetchedUids, ['imap-session-1:101', 'imap-session-1:102', 'imap-session-1:103']);
  assert.equal(db.getAt('fund_mail_queue/' + k1), null);
  assert.equal(db.getAt('fund_mail_queue/' + k2), null);
  assert.equal(db.getAt('fund_mail_queue/' + k3), null);
});

test('④ 미매칭 스킵만 있는 폴더는 withFolder 를 한 번도 열지 않는다', async () => {
  const k1 = FMC.makeMailSeenKey('INBOX', '201');
  const db = fakeDb({
    data: { funds: { v: {} }, companies: { v: {} } },
    fund_mail_queue: {
      [k1]: FMC.makeMailQueueTicket('INBOX', '201', { s: '광고메일', e: 'unknown@spam.test', a: 1 }, 100)
    }
  });
  let withFolderCalls = 0;
  const res = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async () => { withFolderCalls += 1; }
  }, { now: 1700000010000 });
  assert.equal(withFolderCalls, 0);
  assert.equal(res.imapSessions, 0);
  assert.equal(res.processed, 1);
  assert.equal(db.getAt('fund_mail_queue/' + k1), null);
});

test('⑤ 반복 오류 티켓은 3회 실패 시 failed 로 격리 파킹되고 7일 경과 후 정리된다', async () => {
  const k1 = FMC.makeMailSeenKey('INBOX', '301');
  const kExpired = FMC.makeMailSeenKey('INBOX', '303');
  const nowBase = 1700000020000;
  const db = fakeDb({
    fund_erp: {
      funds: { F1: { id: 'F1', name: '테스트사내근로복지기금' } },
      sites: { F1: { S_1: { id: 'S_1', name: '테스트법인', contacts: [{ email: 'trust@example.com' }] } } }
    },
    fund_mail_queue: {
      [k1]: {
        slug: 'INBOX',
        uid: '301',
        msg: { s: '실패테스트', e: 'trust@example.com', a: 1, d: 1700000000000 },
        queuedAt: 100,
        attempts: FMC.MAX_QUEUE_ATTEMPTS - 1
      },
      [kExpired]: {
        slug: 'INBOX',
        uid: '303',
        st: 'failed',
        failedAt: nowBase - (FMC.MAX_FAILED_QUEUE_AGE_MS + 60000),
        attempts: FMC.MAX_QUEUE_ATTEMPTS
      }
    }
  });
  const res = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async () => { throw new Error('IMAP connection reset'); }
  }, { now: nowBase });
  assert.equal(res.errors, 1);
  assert.equal(res.failed, 1);
  const ticket = db.getAt('fund_mail_queue/' + k1);
  assert.equal(ticket.st, 'failed');
  assert.equal(ticket.attempts, FMC.MAX_QUEUE_ATTEMPTS);
  assert.equal(db.getAt('fund_mail_queue/' + kExpired), null, '7일 경과된 failed 티켓은 자동 정리되어야 합니다');

  let calledOnSecond = false;
  const res2 = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async () => { calledOnSecond = true; }
  }, { now: nowBase + 9000000 });
  assert.equal(calledOnSecond, false);
  assert.equal(res2.processed, 0);

  // seenRef 에러 쿨다운(cooldown_after_error) 중인 티켓은 큐에서 삭제되지 않고 보존되어야 함
  const kCool = FMC.makeMailSeenKey('INBOX', '302');
  const nowCool = Date.now();
  await db.ref('fund_erp/mail_auto_seen/msgs/' + kCool).set({ st: 'error', at: nowCool });
  await db.ref('fund_mail_queue/' + kCool).set(
    FMC.makeMailQueueTicket('INBOX', '302', { s: '쿨다운보존', e: 'trust@example.com', a: 1 }, nowCool - 1000)
  );
  const resCool = await FMC.drainFundMailQueueBatch({
    db,
    getSelfEmail: async () => 'self@hanmail.net',
    withFolder: async () => { throw new Error('should not open IMAP during seen cooldown'); }
  }, { now: nowCool });
  assert.equal(resCool.processed, 0);
  assert.ok(db.getAt('fund_mail_queue/' + kCool), '쿨다운 중인 티켓은 큐에서 삭제되면 안 됩니다');
});

test('⑥ collectFundMailOnNew 경량화·drainFundMailQueue 추가·크론 9곳 분산 및 규칙 잠금 검증', () => {
  const idx = read('functions/index.js');
  const ms = read('functions/mail-sync.js');
  const mw = read('functions/mgr-watch.js');
  const sc = read('functions/staff-claim.js');
  const mfr = read('scripts/make-firebase-rules.js');

  const onNew = idx.slice(idx.indexOf('exports.collectFundMailOnNew'), idx.indexOf('exports.drainFundMailQueue'));
  assert.ok(!/DAUM_MAIL_PASSWORD/.test(onNew), 'collectFundMailOnNew 는 IMAP 비밀을 직접 들고 있지 않아야 합니다');
  assert.ok(!/MS\.withFolder/.test(onNew), 'collectFundMailOnNew 는 직접 IMAP 에 붙지 않고 큐만 적재해야 합니다');
  assert.match(onNew, /MAIL_QUEUE_PATH/);

  const drain = idx.slice(idx.indexOf('exports.drainFundMailQueue'), idx.indexOf('exports.drainFundMailQueue') + 650);
  assert.match(drain, /\.pubsub\.schedule\("4-59\/10 \* \* \* \*"\)/);
  assert.match(drain, /drainFundMailQueueBatch/);

  assert.match(ms, /mailKeepWarm: F[\s\S]{0,400}\.pubsub\.schedule\('1-59\/3 8-19 \* \* 1-6'\)/);
  assert.match(mw, /\.pubsub\.schedule\("2-59\/10 7-21 \* \* \*"\)/);
  assert.match(idx, /exports\.mailContractSweep[\s\S]{0,300}\.pubsub\.schedule\("7 0,9,11,13,15,17,18 \* \* \*"\)/);
  assert.match(idx, /exports\.visitSmsPrepare[\s\S]{0,300}\.pubsub\.schedule\("every day 09:05"\)/);
  assert.match(idx, /exports\.govReportAuto[\s\S]{0,300}\.pubsub\.schedule\("13 \* \* \* \*"\)/);
  assert.match(idx, /exports\.datahubBoardTally[\s\S]{0,300}\.pubsub\.schedule\("23 \* \* \* \*"\)/);
  assert.match(sc, /\.pubsub\.schedule\('37 \* \* \* \*'\)\.timeZone\('Asia\/Seoul'\)/);
  assert.match(idx, /exports\.dailyDocsCollect[\s\S]{0,300}\.pubsub\.schedule\("every day 07:14"\)/);
  assert.match(idx, /exports\.dailyIlaborCollect[\s\S]{0,300}\.pubsub\.schedule\("every day 07:26"\)/);

  assert.equal(FMC.MAIL_QUEUE_PATH, 'fund_mail_queue');
  assert.match(mfr, /rules\.fund_mail_queue\s*=\s*\{\s*'\.read':\s*false,\s*'\.write':\s*false\s*\}/);
});
