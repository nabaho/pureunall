/* 모은 자료 전수 재검사 — 담긴 가린 글 전체에서 개인정보 «꼴»을 다시 찾는다 (설계 §4-9)

   쓰는 법:
     firebase database:get /rules_mgmt/library/text --project pureun-erp > text.json
     node scripts/rules-library-audit.js text.json
   (Git Bash 에서는 앞에 MSYS_NO_PATHCONV=1 — 안 붙이면 /rules_mgmt 가 윈도 경로로 바뀐다)

   ★ 가림 엔진(kordoc)과 «다른 잣대»다 — 단순한 꼴만 본다. 같은 잣대로 두 번 보면 같은 자리를 함께 놓친다.
   ⚠ 원래 번호를 화면에 찍지 않는다 — 어느 문서에 어느 꼴이 몇 개인지만.
   ⚠ 사업자번호(000-00-00000)는 가리지 않기로 한 것이다(사업장 열쇠) — 계좌 꼴에서 뺀다.
   걸린 것이 있으면 종료코드 1. */
'use strict';
const PAT = {
  주민: /(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/g,
  전화: /(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)/g,
  계좌: /(?<!\d)\d{3,6}-\d{2,6}-\d{4,8}(?!\d)/g,
  전자우편: /[\w.+-]+@[\w-]+\.[\w.]+/g,
};
const BRN = /^\d{3}-\d{2}-\d{5}$/;
/* 계좌 꼴은 넓다 — 전화(010-1234-5678)·주민 꼴도 받아 버린다. 한 번호를 두 꼴로 세지 않게 뺀다 */
const IS_PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;
const IS_RRN = /^\d{6}-[1-8]\d{6}$/;

function scan(texts) {
  const hits = [];
  Object.keys(texts || {}).forEach((id) => {
    const t = String((texts || {})[id] || '');
    Object.keys(PAT).forEach((k) => {
      let found = t.match(PAT[k]) || [];
      if (k === '계좌') found = found.filter((x) => !BRN.test(x) && !IS_PHONE.test(x) && !IS_RRN.test(x));
      if (found.length) hits.push({ id, kind: k, n: found.length });
    });
  });
  return { docs: Object.keys(texts || {}).length, hits };
}
module.exports = { scan };

if (require.main === module) {
  const r = scan(JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')));
  console.log('문서', r.docs, '· 걸린 곳', r.hits.length);
  r.hits.forEach((h) => console.log(' ', h.id, h.kind, h.n));
  process.exitCode = r.hits.length ? 1 : 0;
}
