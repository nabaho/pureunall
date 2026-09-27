'use strict';
/* 파이어베이스 실시간DB 흉내 — «저장할 때 버리는 것»까지 흉내 낸다 (2026-09-27)
   ⚠ 진짜 DB 는 null · 빈 목록([]) · 빈 객체({})를 저장하지 않는다. 이것을 흉내 내지 않으면
     «기억 속 값»과 «DB 에서 읽은 값»이 늘 같아 보여, 그 차이로 나는 고장이 검사에서 숨는다
     (확정본 도장이 hr:[] 하나로 매주 어긋날 판이었다 — tests/news-friday.test.js).
   쓰는 것: ref(p).once('value') · set · update(여러 자리 'a/b') · transaction · child · push().key */

function 다듬기(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) {
    const a = v.map(다듬기);
    if (!a.some((x) => x !== undefined)) return undefined;
    /* 진짜 DB 는 구멍 난 배열을 번호 객체로 돌려줄 수도 있지만, 여기서는 null 만 걷는다 */
    return a.map((x) => (x === undefined ? null : x));
  }
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach((k) => { const x = 다듬기(v[k]); if (x !== undefined) o[k] = x; });
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}
const 복사 = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const 조각 = (p) => String(p || '').split('/').filter(Boolean);

function 만들기(처음) {
  let 뿌리 = 다듬기(복사(처음 || {})) || {};
  const 쓴것 = [];
  function 읽기(p) {
    let v = 뿌리;
    for (const k of 조각(p)) { if (v == null || typeof v !== 'object') return undefined; v = v[k]; }
    return v;
  }
  function 쓰기(p, 값) {
    const ks = 조각(p);
    const 새 = 다듬기(복사(값));
    if (!ks.length) { 뿌리 = 새 || {}; return; }
    let v = 뿌리;
    for (let i = 0; i < ks.length - 1; i++) {
      if (v[ks[i]] == null || typeof v[ks[i]] !== 'object') v[ks[i]] = {};
      v = v[ks[i]];
    }
    if (새 === undefined) delete v[ks[ks.length - 1]];
    else v[ks[ks.length - 1]] = 새;
    뿌리 = 다듬기(뿌리) || {};
  }
  let 번호 = 0;
  function ref(p) {
    const 자리 = 조각(p).join('/');
    return {
      once: async () => { const v = 읽기(자리); return { val: () => (v === undefined ? null : 복사(v)) }; },
      set: async (v) => { 쓴것.push({ 자리, 값: 복사(v) }); 쓰기(자리, v); },
      update: async (o) => {
        쓴것.push({ 자리, 값: 복사(o), update: true });
        Object.keys(o || {}).forEach((k) => 쓰기(자리 ? 자리 + '/' + k : k, o[k]));
      },
      transaction: async (fn) => {
        const 옛 = 읽기(자리);
        const 새 = fn(옛 === undefined ? null : 복사(옛));
        if (새 === undefined) return { committed: false, snapshot: { val: () => 복사(옛) } };
        쓰기(자리, 새);
        return { committed: true, snapshot: { val: () => 복사(읽기(자리)) } };
      },
      child: (k) => ref(자리 + '/' + k),
      push: () => ({ key: 'k' + (++번호) })
    };
  }
  return { ref, 읽기: (p) => 복사(읽기(p)), 쓴것 };
}

module.exports = { 만들기, 다듬기 };
