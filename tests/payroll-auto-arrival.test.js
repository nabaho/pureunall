'use strict';
/* ══════════════════════════════════════════════════════════════════════════
 * 병목 해소 2단계 — 급여아웃소싱 paydata/arrivals 자동 도착 반영 검증
 *   1. afterLogin 은 .once('value') 로만 paydata/arrivals 를 읽고 .on( 구독을 늘리지 않는다
 *   2. 수동 «급여관리에 알리기»(payroll_os/inbox) 가 비어 있어도 paydata/arrivals 가 있으면 «도착» 표시
 *   3. arrivalFor 원본 계약을 유지하고, 자리 수(Object.keys.length)로 정확히 건수를 센다
 *   4. refreshPdArrivals 는 읽기만 수행하며 가짜 급여대장 행을 쓰지 않는다
 * ══════════════════════════════════════════════════════════════════════════ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'payroll-os.html'), 'utf8').replace(/\r\n/g, '\n');

function cut(name) {
  const m = html.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}

function loadSandbox(opts = {}) {
  const cache = {
    inbox: opts.inbox || {},
    pdArrivals: opts.pdArrivals || {},
    site_co_link: opts.links || {},
    site_cards: (opts.sites || []).map((s) => ({ 사업장: s, 담당자: '김노무', 급여일: '10일' })),
    mail_digest_2026: {}
  };
  const writes = [];
  const reads = [];
  let renderCount = 0;

  const sandbox = {
    Object, Array, String, Number, Boolean, Date, RegExp, Promise, console,
    ROOT: 'payroll_os',
    pay: null,
    App: { inboxMonth: opts.inboxMonth || '2026-11' },
    SIG: { green: '#166534', orange: '#b45309', red: '#b91c1c' },
    pdArrBusy: false,
    pdArrErr: '',
    cache,
    esc(s) { return String(s == null ? '' : s).replace(/'/g, '').replace(/"/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    fbDb: {
      ref(p) {
        return {
          once() {
            reads.push(p);
            if (opts.arrivalsErr && p === 'paydata/arrivals') return Promise.reject(opts.arrivalsErr);
            if (p === 'paydata/arrivals') return Promise.resolve({ val: () => opts.nextArrivals || cache.pdArrivals });
            return Promise.resolve({ val: () => null });
          },
          set(v) { writes.push([p, v]); return Promise.resolve(); },
          update(v) { writes.push([p, v]); return Promise.resolve(); }
        };
      }
    },
    dbGet(k, fb) { return cache[k] != null ? cache[k] : fb; },
    lmap(k) { return (cache[k] && typeof cache[k] === 'object') ? cache[k] : {}; },
    cardsView() { return (cache.site_cards || []).map((c) => ({ 원본: c, 사업장: c.사업장, 담당자: c.담당자, 급여일: c.급여일 })); },
    paySites() { return []; },
    inboxRoster() { return (cache.site_cards || []).map((c) => ({ site: c.사업장, 담당자: c.담당자, 급여일: c.급여일, card: c })); },
    siteReceived() { return null; },
    dueDayOf() { return 10; },
    rowMarkBox(_k, i) { return String(i); },
    render() { renderCount++; },
    window: {},
    PuSiteStaff: require('../js/pu-site-staff.js')
  };
  sandbox.window = sandbox;

  const code = [
    cut('monthNum'),
    cut('siteKey'),
    cut('inboxLog'),
    cut('arrivalFor'),
    cut('pdArrivalMonthParts'),
    cut('pdArrSlotCount'),
    cut('pdCoIdForSite'),
    cut('pdPickSlotForCo'),
    cut('pdArrivalInfo'),
    cut('pdArrivalTotals'),
    cut('refreshPdArrivals'),
    cut('screenInbox'),
    cut('inboxBridgeHtml')
  ].join('\n');

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { sandbox, reads, writes, getRenderCount: () => renderCount };
}

test('① afterLogin은 .on( 구독을 늘리지 않고 paydata/arrivals 를 .once( 로 읽는다', () => {
  const after = cut('afterLogin');
  assert.match(after, /fbDb\.ref\('paydata\/arrivals'\)\.once\('value'\)/);
  assert.match(after, /cache\.pdArrivals/);
  assert.doesNotMatch(after, /paydata\/arrivals'\)\.on\(/);
});

test('② 수동 알림이 비어 있어도 paydata/arrivals 도착 자료가 있으면 수신함에서 도착으로 자동 표시된다', () => {
  const { sandbox } = loadSandbox({
    inboxMonth: '2026-11',
    sites: ['가나다주식회사', '미도착기업'],
    links: {
      '가나다주식회사': { coId: 'co_a', coName: '(주)가나다' },
      '미도착기업': { coId: 'co_b', coName: '(주)미도착' }
    },
    pdArrivals: {
      co_a: {
        '202611': {
          attend: { a1: 1795000000000, a2: 1795000005000 },
          ledger: { l1: 1795000009000 },
          last: 1795000009000
        }
      }
    }
  });

  // 원본 arrivalFor 는 수동 inbox 가 비었으므로 false 를 유지해야 함
  assert.equal(sandbox.arrivalFor('가나다주식회사', '2026-11'), false);

  const info = sandbox.pdArrivalInfo('가나다주식회사', '2026-11');
  assert.ok(info);
  assert.equal(info.coId, 'co_a');
  assert.equal(info.total, 3);
  assert.equal(info.byKind.attend, 2);
  assert.equal(info.byKind.ledger, 1);
  assert.equal(sandbox.pdArrivalInfo('가나다주식회사', '2026년 11월').total, 3);
  assert.equal(sandbox.pdArrivalInfo('미도착기업', '2026-11'), null);

  const htmlOut = sandbox.screenInbox();
  assert.match(htmlOut, /도착 1/);
  assert.match(htmlOut, /데이터함 자동감지 3건/);
  assert.match(htmlOut, /데이터함 자동도착 1곳 · 3건/);
  assert.match(htmlOut, /근태 2 · 대장 1/);
});

test('③ 업체 아님(none) 제외 및 refreshPdArrivals 는 읽기만 수행하고 원장을 수정하지 않는다', async () => {
  const { sandbox, reads, writes, getRenderCount } = loadSandbox({
    inboxMonth: '11월',
    sites: ['폴더꼬리표'],
    links: { '폴더꼬리표': { none: true } },
    pdArrivals: {
      co_ignored: { '202611': { attend: { x: 1795000000000 }, last: 1795000000000 } }
    },
    nextArrivals: {
      co_new: { '202611': { contract: { c1: 1795000000000 }, last: 1795000000000 } }
    }
  });

  assert.equal(sandbox.pdArrivalInfo('폴더꼬리표', '11월'), null);
  await sandbox.refreshPdArrivals();
  assert.deepEqual(reads, ['paydata/arrivals']);
  assert.equal(writes.length, 0, 'arrivals 새로고침은 읽기만 수행해야 합니다');
  assert.ok(getRenderCount() >= 2);
  assert.equal(sandbox.pdArrivalTotals('11월').total, 1);
});

test('④ 연도 생략 시 작년 슬롯 대체 차단 · 비숫자 도착값 무시 · 새로고침 실패 안내 표시', async () => {
  const curYear = new Date().getFullYear();
  const prevSlot = String(curYear - 1) + '11';
  const curSlot = String(curYear) + '11';
  const { sandbox } = loadSandbox({
    inboxMonth: '11월',
    sites: ['작년만있는곳', '문자열섞인곳'],
    links: {
      '작년만있는곳': { coId: 'co_old', coName: '작년만있는곳' },
      '문자열섞인곳': { coId: 'co_mix', coName: '문자열섞인곳' }
    },
    pdArrivals: {
      co_old: {
        [prevSlot]: { attend: { a1: 1750000000000 }, last: 1750000000000 }
      },
      co_mix: {
        [curSlot]: {
          attend: { good: 1795000000000, badStr: '1795000000000', zero: 0, nope: true },
          last: 1795000000000
        }
      }
    },
    arrivalsErr: { code: 'NETWORK_ERROR' }
  });

  // 연도 생략('11월') 시 작년(curYear-1) 11월 자료를 올해 도착으로 오판하면 안 됨
  assert.equal(sandbox.pdArrivalInfo('작년만있는곳', '11월'), null);
  // 유효한 양의 숫자 타임스탬프만 집계해야 함
  const mixInfo = sandbox.pdArrivalInfo('문자열섞인곳', '11월');
  assert.ok(mixInfo);
  assert.equal(mixInfo.total, 1);
  assert.equal(mixInfo.byKind.attend, 1);

  await sandbox.refreshPdArrivals();
  const errHtml = sandbox.inboxBridgeHtml('11월');
  assert.match(errHtml, /role="alert"/);
  assert.match(errHtml, /새로고침하지 못했습니다/);
});

