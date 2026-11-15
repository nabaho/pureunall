"use strict";
/* ERP 가 열리는 «출처(origin)» — 서버 함수가 받아 주는 곳은 이 한 자리에서만 정한다.
   ═══════════════════════════════════════════════════════════════════════════
   2026-11-15 대표 지시 「ERP 를 erp.pureunlabor.co.kr 로 모두 옮겨라」.
   GitHub Pages 에서 도메인을 켜는 «순간» 옛 주소(nabaho.github.io/pureunall/…)는 301 로
   새 주소로 넘어간다 — 두 주소를 함께 띄워 두는 기간이 없다. 그래서 서버는 «먼저»
   두 출처를 다 받아 두어야 한다. 전에는 함수 7곳이 출처 «하나»와만 견줬다.

   ★ 지키는 것
     ① 목록에 있는 출처만 받는다 — 와일드카드(*) 금지. 메일 발송 창구는 예전에 "*" 라서
        주소만 알면 누구나 푸른노무법인 이름으로 메일을 보낼 수 있었다(index.js 머리말).
     ② Access-Control-Allow-Origin 에는 값이 «하나»만 들어간다 — 그래서 «요청 출처가
        목록에 있으면 그 값을 그대로» 돌려주고 Vary: Origin 을 붙인다(캐시가 섞이지 않게).
     ③ localhost·127.0.0.1(http)은 개발용으로 전처럼 받는다.
     ④ 돌아올 주소(OAuth redirect_uri)는 «요청이 온 출처»의 것을 쓴다 — 옛 출처면
        /pureunall/ 아래, 새 출처면 뿌리 아래. 전환 날 함수를 다시 올리지 않아도 된다.
   옛 출처는 이미 나간 링크·설치된 옛 앱 때문에 이사 뒤에도 한동안(약 3개월) 남긴다
   — 지우는 날은 docs/superpowers/plans/2026-11-15-ERP-주소-이사.md 5단계.
   ★ 전환: 2026-11-15 23:03 KST (Pages 도메인·인증서·HTTPS 강제). 옛 출처는 «2026-02-15 무렵까지»
     남겨 두고, 그 뒤 이 목록에서 빼는 PR 을 따로 낸다(빼기 전 옛 출처 호출이 남았는지 로그로 본다).

   ★ 사람에게 «내보내는» 링크(메일·문자·알림 본문)는 받아 주는 목록과 다르다 — 언제나 새 주소다.
     ERP 화면으로 가는 링크는 ERP_LINK_BASE, 바깥 사람(뉴스레터 받는 분)에게 «홈»으로 보내는
     링크는 PUBLIC_HOME(공개 홈페이지). 옛 주소로 내보내면 301 을 한 번 더 돌고, 옛 출처를
     목록에서 뺀 뒤에는 그 링크가 남의 주소처럼 보이게 된다. (tests/erp-move-finish.test.js) */

const ERP_OLD = "https://nabaho.github.io";
const ERP_NEW = "https://erp.pureunlabor.co.kr";

/* 사람에게 내보내는 ERP 링크의 뿌리 — 경로 앞머리(/pureunall) 없이 바로 화면 이름이 붙는다 */
const ERP_LINK_BASE = ERP_NEW;
/* 바깥 사람에게 보내는 «홈» — 공개 홈페이지(2026-11-15 정식 공개). ERP 로그인 문이 아니다. */
const PUBLIC_HOME = "https://pureunlabor.co.kr/";

/* 순서가 곧 번호다(OAuth state 에 «몇 번째 출처»로 싣는다) — 뒤에만 덧붙이고, 있는 것의 자리를 바꾸지 말 것. */
const ERP_ORIGINS = Object.freeze([ERP_OLD, ERP_NEW]);

/* 그 출처에서 ERP 화면들이 놓인 «뿌리» — 옛 출처는 저장소 이름(/pureunall)이 앞에 붙는다 */
const ERP_BASES = Object.freeze({
  [ERP_OLD]: ERP_OLD + "/pureunall",
  [ERP_NEW]: ERP_NEW,
});

const LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function originOf(req) {
  return String((req && req.headers && req.headers.origin) || "");
}

/* 목록에 있는 ERP 출처인가 (localhost 는 아니다) */
function isErpOrigin(origin) {
  return ERP_ORIGINS.indexOf(String(origin || "")) >= 0;
}

/* CORS 로 받아 줄 출처인가 — ERP 출처 + 개발용 localhost */
function isAllowedOrigin(origin) {
  const o = String(origin || "");
  return isErpOrigin(o) || LOCAL_RE.test(o);
}

/* 받아 줄 출처면 Allow-Origin(그 값 그대로)·Vary 를 단다. 받았는지 돌려준다. */
function allowOrigin(req, res) {
  const o = originOf(req);
  if (!isAllowedOrigin(o)) return false;
  res.set("Access-Control-Allow-Origin", o);
  res.set("Vary", "Origin");
  return true;
}

/* 출처 → 번호(목록 안 자리). ERP 출처가 아니면(localhost·빈 값) 0(옛 출처) — 전과 같은 동작. */
function originIndex(origin) {
  const i = ERP_ORIGINS.indexOf(String(origin || ""));
  return i >= 0 ? i : 0;
}

/* 번호 → 그 출처의 ERP 뿌리. 모르는 번호면 옛 출처. */
function baseAt(index) {
  const o = ERP_ORIGINS[Number(index)] || ERP_OLD;
  return ERP_BASES[o];
}

/* 요청 출처 기준 ERP 뿌리 */
function baseFor(origin) {
  return baseAt(originIndex(origin));
}

module.exports = {
  ERP_OLD, ERP_NEW, ERP_ORIGINS, ERP_BASES, LOCAL_RE, ERP_LINK_BASE, PUBLIC_HOME,
  originOf, isErpOrigin, isAllowedOrigin, allowOrigin, originIndex, baseAt, baseFor,
};
