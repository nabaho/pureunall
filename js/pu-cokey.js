/* 🔑 회사 열쇠 — 사업자번호 (온톨로지 1걸음, 대표 결정 2026-09-18 「추천대로」)
   ════════════════════════════════════════════════════════════════════════

   ■ 왜 사업자번호인가 (2026-09-18 서버 실측)
     「회사」가 여섯 군데에 따로 적혀 있고, 이름을 다듬어 합치면 493곳이다.
     영구번호(companyId)를 493곳에 새로 매기는 것은 큰 일이고, 매기는 동안
     «절반만 이어진» 상태가 오래 간다. 그런데 사업자번호는 이미 있다 —
     계약 78% · 컨설팅 95% · 업체관리 91% · 기업정보함 기업상세 100%.

   ■ 왜 «한 파일»인가
     기업정보함과 푸른이알피가 각자 검산·열쇠 만들기를 쓰면, 한쪽이 열 자리로
     끊고 다른 쪽이 열세 자리로 끊는 순간 같은 회사가 둘로 갈린다.
     그 조용한 어긋남은 화면에 「없습니다」로만 보인다 — 그래서 한 파일이다.
     (js/pu-contact.js · js/pu-co-xls.js 를 두 화면이 나눠 쓰는 것과 같은 결.)

   ⚠★ 이름으로는 잇지 «않는다». 「가나상사」가 두 곳일 수 있다.
     번호는 틀릴 수가 없고, 틀렸으면 검산에서 걸린다.
   ⚠ 검산을 통과하지 못한 번호는 «없는 것»으로 친다 — 흐리게 읽힌 번호로 이으면
     남의 회사에 붙는다(2026-09-18 CMS 오매칭과 같은 함정).
*/
(function (root) {
  'use strict';

  function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  /* 사업자등록번호 검산 — 국세청 규칙.
     가중치 1·3·7 을 되풀이해 앞 아홉 자리에 곱해 더하고,
     ⚠ 아홉째 자리는 ×5 한 뒤 «십의 자리»를 한 번 더 더한다.
       이 보정을 빼도 아홉째 자리가 0·1 인 번호는 그대로 통과한다 —
       2026-09-18 이빨 확인에서 실제로 구멍으로 잡혔다. 지우지 말 것. */
  function bizNoOk(v) {
    var d = digits(v);
    if (d.length !== 10) return false;
    var w = [1, 3, 7, 1, 3, 7, 1, 3, 5], s = 0, i;
    for (i = 0; i < 9; i++) s += (+d[i]) * w[i];
    s += Math.floor((+d[8]) * 5 / 10);
    return ((10 - (s % 10)) % 10) === (+d[9]);
  }

  /* 열쇠 = 앞 열 자리. 못 믿을 번호면 빈 문자열.
     ⚠ 열세 자리(뒤에 사업장 번호가 붙은 것)도 앞 열 자리로 끊는다 —
       업체관리에 「312-10-55163-0」 꼴이 실제로 있다. */
  function key(v) {
    var d = digits(v);
    if (d.length < 10) return '';
    var head = d.slice(0, 10);
    return bizNoOk(head) ? head : '';
  }

  /* 검산은 못 했지만 열 자리는 되는 번호 — 「있긴 한데 못 믿는다」를 가릴 때.
     화면에서 「번호를 다시 봐 주세요」라고 말할 근거다. */
  function looksLikeBizNo(v) { return digits(v).length >= 10; }

  /* 두 기록이 «같은 회사»인가. 번호가 없으면 판단하지 않는다(false 가 아니라 null). */
  function sameCo(a, b) {
    var ka = key(a), kb = key(b);
    if (!ka || !kb) return null;
    return ka === kb;
  }

  /* 기업정보함 기업상세 자리 — 열쇠를 한 곳에서만 만든다.
     ⚠ 이 경로를 손으로 이어 붙이지 말 것. 한쪽이 'pucards/coinfo' 로 적으면
       값은 쌓이는데 화면에는 영영 안 나온다. */
  function coInfoPath(v) { var k = key(v); return k ? ('pucards/coInfo/' + k) : ''; }

  var API = { digits: digits, bizNoOk: bizNoOk, key: key,
              looksLikeBizNo: looksLikeBizNo, sameCo: sameCo, coInfoPath: coInfoPath };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PuCoKey = API;
})(typeof window !== 'undefined' ? window : globalThis);
