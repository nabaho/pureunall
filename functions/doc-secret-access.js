"use strict";
/* 🔒 서명본·견적서를 «누가 열 수 있나» — 서버 함수 puDocSecret 이 쓴다 (견적·계약 자동화 계획 1 · 작업 5)

   ■ 원래: 총괄관리자(isAdmin)만.
   ■ 더한 것: 견적 길로 올린 🔒 원본(원본 보관함 기록의 from.kind === 'quote')은
       · 재무(fin)  — 그 파일을 가리키는 견적 기록(pu_quotes/{qid}.fileId)이 있을 때
       · 그 건의 «확정» 담당자(pu_quote_amt/{qid}.owner === 내 uid)
     도 연다. 부관리자(isSubAdmin)·일반 직원·«추정» 담당(owner 가 빈칸)은 못 연다 — 대표 결정 2026-11-07.

   ⚠ 아무 🔒 파일이나 견적 기록에 끼워 열 수 없게 두 겹으로 막는다.
     ① 파일이 «견적 길로 올린 것»이어야 한다(서명본·EDI 위임장 같은 다른 🔒 파일은 총괄관리자만).
        원본 보관함 기록은 «새로 쓰기만»이라 이미 있는 파일에 견적 딱지를 뒤늦게 붙일 수 없다.
     ② 견적 기록이 그 파일(fileId)을 가리켜야 한다.
   ⚠ 순수 함수로 두었다 — DB 를 읽는 일은 puDocSecret 이 하고, 여기서는 «열어도 되나»만 가린다. */

const QID_RE = /^[-_A-Za-z0-9]{10,40}$/;

const DENY_MESSAGE = "🔒 이 파일은 대표·관리자·재무·담당자만 열 수 있습니다.";

/* 견적 번호 모양 — 이 글자만 DB 경로(pu_quotes/{qid})에 끼운다 */
function isQid(v) { return typeof v === "string" && QID_RE.test(v); }

/* 견적 길로 올린 원본인가 — 원본 보관함 기록의 from.kind */
function isQuoteFile(file) {
  return !!(file && file.from && file.from.kind === "quote");
}

function canOpenSecret(o) {
  o = o || {};
  const role = o.role || {};
  if (role.isAdmin === true) return true;
  const fileId = o.fileId, quote = o.quote, amt = o.amt, uid = o.uid;
  if (!isQuoteFile(o.file)) return false;
  if (!fileId || !quote || quote.fileId !== fileId) return false;
  if (role.fin === true) return true;
  /* uid 가 비면 owner 의 빈칸('')과 «같다»고 나오지 않게 uid 부터 본다 */
  return !!(uid && amt && typeof amt.owner === "string" && amt.owner && amt.owner === uid);
}

module.exports = { canOpenSecret, isQid, isQuoteFile, DENY_MESSAGE, QID_RE };
