# 2026-10-12 · 나라장터 조회 날짜가 서버(UTC)에서 하루 밀리던 것

- 발견: 회생광고 PR(#2609) CI 가 `functions/gov-feed-collect.test.js` «지난 7일» 시험에서 실패 — 내 변경과 무관, #2610(정부사업신청 매일 수집)이 들여온 시험.
  내 PC(서울)에서는 통과, `TZ=UTC` 에서는 실패 → CI·Cloud Functions 모두 UTC.
- 원인: `js/gov-g2b.js` `stamp()` 가 `getFullYear/getMonth/getDate`(서버의 «지역 시간») 로 조회 구간 글자를 만든다.
  서울 07:40 은 UTC 로 «전날 22:40» 이라 실서버에서 조회 구간이 하루 일찍 잡힌다.
- 고침: 서울 시각(+9시간)으로 옮긴 뒤 UTC getter 로 읽는다. `js/gov-g2b.js` 와 `functions/vendor/gov-g2b.js` 두 사본 같이.
- 확인: gov 관련 검사 170건을 `TZ=UTC`·`Asia/Seoul`·`America/New_York` 세 곳에서 모두 통과.
- 이 방(회생광고)의 일이 아님 — CI 를 막고 있어 최소 수정으로 분리해 올림. 정부사업신청 쪽 방은 알아 둘 것.
