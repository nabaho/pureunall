'use strict';
/* 업체관리(data/companies) 가짜 서버 — 검사 공용 (2026-10-07 기업정보함 점검 ①)

   기업정보함은 이제 업체관리 업체를 «한 건씩» 읽고 공용 저장 관문의 거래로 쓴다
   (erpCoPatchMany → PuCompanyWrite.patch). 옛 검사들은 «목록 통째 읽기 + update» 를
   흉내 냈다 — 쓰는 길이 바뀌어 그 흉내를 이 한 벌로 모은다(일곱 검사에 따로 두면 한쪽만 낡는다).

   ★ 거래는 실시간DB 처럼 «찬 자리»로 먼저 null 을 한 번 부르고, 그다음 서버 판으로 부른다.
     null 에서 접어 버리는 셈이면(서버에 묻지도 않고 끝남) 여기서도 그대로 드러난다.
   ★ 쓴 것은 옛 검사가 보던 꼴 그대로 writes 에 { 'data/companies/v/{id}': 레코드 } 로 남는다.
     표의 시각(data/companies/u)은 uSets 에 따로 — writes 의 첫 줄이 늘 «그 업체»이게.
   opt.beforeTx(map) — 거래 직전에 «다른 사람이» 서버를 고친 것처럼 꾸민다. */
const PCW = require('../js/pu-company-write.js');

function coFake(list, opt) {
  const o = opt || {};
  const map = {};
  (Array.isArray(list) ? list : Object.values(list || {})).forEach((c) => { if (c && c.id) map[c.id] = c; });
  const writes = [], uSets = [], reads = { whole: 0, one: 0 };
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  function ref(p) {
    p = String(p == null ? '' : p);
    if (p === 'data/companies' || p === 'data/companies/v') {
      return { once: async () => { reads.whole++; const v = clone(map); return { val: () => (p === 'data/companies' ? { v } : v) }; } };
    }
    if (p === 'data/companies/u') return { set: async (v) => { uSets.push(v); } };
    const m = p.match(/^data\/companies\/v\/([^/]+)$/);
    if (m) {
      const id = m[1];
      return {
        once: async () => { reads.one++; return { val: () => (map[id] === undefined ? null : clone(map[id])) }; },
        transaction: async (fn) => {
          if (o.failTx) throw new Error(o.failTx);
          fn(null);
          if (o.beforeTx) o.beforeTx(map);
          const cur = map[id] === undefined ? null : clone(map[id]);
          const next = fn(cur);
          if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
          map[id] = clone(next);
          writes.push({ ['data/companies/v/' + id]: clone(next) });
          return { committed: true, snapshot: { val: () => clone(next) } };
        }
      };
    }
    return { once: async () => ({ val: () => null }), update: async (u) => { writes.push(u); },
      set: async (v) => { writes.push({ [p]: v }); } };
  }
  const database = () => ({ ref: (p) => (p === undefined ? { update: async (u) => { writes.push(u); } } : ref(p)) });
  return { map, writes, uSets, reads, database, PuCompanyWrite: PCW };
}

module.exports = { coFake, PCW };
