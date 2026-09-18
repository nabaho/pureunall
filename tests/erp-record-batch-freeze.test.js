'use strict';
/* 첫 로그인 때 건별 자료 수천 건이 와도 배열 전체 저장은 한 번이어야 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const code = ['_fbLocalArr','_fbWriteArr','_fbApplyMany','_fbLiveRecords']
  .map(name => cutFn(src, 'function ' + name + '(')).join('\n');

function world(initial) {
  const listeners = {}, timers = new Map(), writes = [], removals = [];
  let next = 1, complete;
  const ctx = {
    Promise, JSON, Object, Array, String, Number,
    KEY:'pureun_v6_', _dbCache:{ contracts: initial.slice() }, _fbServerU:{ contracts:42 },
    _FB_KEY_FIRST_TIMEOUT_MS:15000, _fbKeyLive:{}, _fbBytesIn:0,
    localStorage:{ getItem(){ return null; }, setItem(){} },
    _erpStoreSet(_k, json){ writes.push(JSON.parse(json)); },
    _erpStoreGet(){ return null; },
    _scheduleFbChanged(){},
    _fbRepairLedgerBatches(){ return Promise.resolve(0); },
    _fbRemoveOne(k, id){ removals.push(id); ctx._dbCache[k] = ctx._dbCache[k].filter(x => x.id !== id); },
    setTimeout(fn, ms){ const id=next++; timers.set(id,{fn,ms}); return id; },
    clearTimeout(id){ timers.delete(id); },
    fbDb:{ ref(){ return {
      on(ev, fn){ listeners[ev] = fn; },
      once(_ev, fn){ complete = fn; }, off(){}
    }; } }
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const snap = (id, value) => ({ key:id, val:() => value });
  return { ctx, listeners, writes, removals, snap,
    finish(){ complete({ val:() => ({}) }); },
    tick(){ const due=[...timers]; due.forEach(([id,t])=>{ timers.delete(id); if(t.ms<1000) t.fn(); }); }
  };
}

test('초기 6000건은 전체 배열을 건마다 쓰지 않고 한 번 병합한다', async () => {
  const w = world([{id:'local', amount:1}]);
  const p = w.ctx._fbLiveRecords('contracts', {});
  for(let i=0;i<6000;i++) w.listeners.child_added(w.snap('r'+i,{id:'r'+i,amount:i}));
  assert.equal(w.writes.length,0);
  w.finish(); await p;
  assert.equal(w.writes.length,1);
  assert.equal(w.ctx._dbCache.contracts.length,6001);
  assert.equal(w.ctx._dbCache.contracts[0].id,'local','서버에 없는 로컬 사본을 지우면 안 된다');
});

test('동일 id의 마지막 변경을 보존하고 삭제 전 대기분을 먼저 반영한다', async () => {
  const w = world([]);
  const p = w.ctx._fbLiveRecords('contracts', {});
  w.listeners.child_added(w.snap('r1',{id:'r1',amount:1}));
  w.listeners.child_changed(w.snap('r1',{id:'r1',amount:2}));
  w.listeners.child_removed(w.snap('r1',null));
  assert.equal(w.ctx._dbCache.contracts.length,0);
  assert.deepEqual(w.removals,['r1']);
  w.listeners.child_added(w.snap('r2',{id:'r2',amount:3}));
  w.finish(); await p;
  assert.equal(w.ctx._dbCache.contracts.length,1);
  assert.equal(w.ctx._dbCache.contracts[0].id,'r2');
});
