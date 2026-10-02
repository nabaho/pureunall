const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHealth() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-health.js'), 'utf8');
  const window = {
    document: {},
    setTimeout: function (fn) { fn(); },
    console: { warn: function () {} }
  };
  vm.runInNewContext(source, { window, Promise, Date, JSON, String });
  return window.PUHealth;
}

function fakeApp(outcomes, counters) {
  const db = {
    goOnline: function () { counters.online += 1; },
    ref: function (name) {
      assert.equal(name, 'systemAlerts');
      return {
        once: function (event) {
          assert.equal(event, 'value');
          counters.reads += 1;
          const next = outcomes.shift();
          return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
        }
      };
    }
  };
  return {
    database: function () { return db; },
    auth: function () {
      return {
        currentUser: {
          getIdToken: function (force) {
            assert.equal(force, true);
            counters.refreshes += 1;
            return Promise.resolve('fresh-token');
          }
        }
      };
    }
  };
}

test('장애 알림 첫 조회 실패는 토큰과 연결을 복구한 뒤 한 번 재시도한다', async function () {
  const health = loadHealth();
  const snapshot = { val: function () { return {}; } };
  const counters = { reads: 0, refreshes: 0, online: 0 };
  const result = await health._readAdminAlerts(fakeApp([new Error('temporary'), snapshot], counters));
  assert.equal(result, snapshot);
  assert.deepEqual(counters, { reads: 2, refreshes: 1, online: 1 });
});

test('재시도도 실패하면 조용히 성공한 척하지 않고 호출자에게 오류를 돌려준다', async function () {
  const health = loadHealth();
  const counters = { reads: 0, refreshes: 0, online: 0 };
  await assert.rejects(
    health._readAdminAlerts(fakeApp([new Error('first'), new Error('second')], counters)),
    /second/
  );
  assert.deepEqual(counters, { reads: 2, refreshes: 1, online: 1 });
});
