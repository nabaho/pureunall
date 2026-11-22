/* 시험용 «지연이 있는» 가짜 실시간DB — 시험 파일이 아니다(.test.js 가 아님). 둘 이상의 시험이 같이 쓴다.
   · 읽기·쓰기·트랜잭션이 «타이머 뒤에» 일어나 두 흐름이 뒤섞인다 — 탭 둘·브라우저 둘이 같은 사람을 동시에 처리하는 일을 흉내 낸다.
   · 트랜잭션은 그 순간 «한 덩어리»로 계산한다(진짜 DB 처럼) — 잠금이 잠금 노릇을 하는지 볼 수 있다.
   · tree 를 그대로 열어 두므로 시험이 «무엇이 쓰였는지» 직접 본다. */
'use strict';

function makeDb(seed) {
  const tree = JSON.parse(JSON.stringify(seed || {}));
  const keys = (p) => String(p).split('/').filter(Boolean);
  const get = (p) => keys(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
  function set(p, v) {
    const ks = keys(p); let o = tree;
    ks.slice(0, -1).forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
  }
  const snap = (v) => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null });
  let jitter = 0, n = 0;
  const later = (fn) => new Promise((ok) => setTimeout(() => ok(fn()), (jitter++ % 3)));
  return {
    tree,
    ref(p) {
      if (p === undefined) return { update: (u) => later(() => { Object.keys(u).forEach((k) => set(k, u[k])); }) };
      return {
        once: () => later(() => snap(get(p))),
        set: (v) => later(() => { set(p, v); }),
        update: (u) => later(() => { Object.keys(u).forEach((k) => set(p + '/' + k, u[k])); }),
        remove: () => later(() => { set(p, null); }),
        push: () => ({ key: 'id' + (++n) }),
        transaction: (fn) => later(() => {
          const cur = get(p);
          const next = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur)));
          if (next === undefined) return { committed: false, snapshot: snap(get(p)) };
          set(p, next);
          return { committed: true, snapshot: snap(get(p)) };
        }),
        orderByChild: (c) => ({ equalTo: (val) => ({ once: () => later(() => {
          const base = get(p) || {}, out = {};
          Object.keys(base).forEach((k) => { if (base[k] && base[k][c] === val) out[k] = base[k]; });
          return snap(Object.keys(out).length ? out : null);
        }) }) }),
      };
    },
  };
}

module.exports = { makeDb };
