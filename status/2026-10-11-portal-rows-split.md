상태: 완료
작업폴더: C:\Users\fair0\Documents\pu-wt-rows (가지 feat/portal-rows-split)
이어하기시도: 0

# 2026-10-11 · 포털 — 「내외관리」를 영업관리(위)·내부관리(아래)로 가름

- 대표 지시: 「캡쳐2 내부관리로 아랫줄로 내리고, 캡쳐3은 영업관리로 정리」.
- enter.html `APP_ROWS`: `inout` 한 줄 → `sales`(영업관리) · `inside`(내부관리), 이 순서.
  - 영업관리: 홈페이지·뉴스레터·정부사업신청·회생광고 (전부 adminOnly)
  - 내부관리: 경력관리·재무관리·인사관리 (재무·인사는 perm 권한자)
- ⚠ 옛 id `inout` 은 일부러 없앴다 — 예전에 타일을 끌어 `inout` 이 저장된 사람은 `savedRowOf` 가 «없던 일»로 쳐서 앱의 제자리로 간다.
  (저장된 타일 «순서»는 그대로 남는다 — 줄 안 순서는 유지.)
- 검사: portal-rows-inout · erp-three-apps · newsletter-app · portal-docs-row-store 를 새 줄 이름에 맞춰 고침. enter.html 을 읽는 검사 118개 1681건 통과.
