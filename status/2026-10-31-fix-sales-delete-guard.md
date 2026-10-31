# 2026-10-31 fix/sales-delete-guard — 영업관리 공개 뒤 위험 두 가지 막기

대표 지시 2026-10-31 「추천대로 위험 건은 막는장치설치해라」 (#2791 영업관리 전원 공개의 후속).

## 한 일
1. **통째 지우기 막기** — `homepage`·`newsletter` 맨 위 칸 쓰기는 총괄관리자만, 그 아래 갈래(`$part`)는 재직 직원이 쓰되
   갈래를 통째로 비우는 것(`newData` 없음)은 총괄관리자만. 편지 한 통·구성원 한 명 같은 «한 줄» 지우기는 그대로 된다.
   앱(pu-home·pu-news·pu-cards)이 맨 위 칸에 직접 set/remove 하는 곳이 없음을 확인했다(모두 갈래 아래 경로).
2. **ilaborPull 총괄관리자만으로 되돌림** — 대표의 공인노무사회 회원 계정으로 바깥 사이트에 들어가는 일이다.
   직원은 모아 둔 자료(ilabor 읽기)만 본다. 매일 아침 자동 모으기는 그대로.

## 게시
- 규칙: rules-deploy.js --deploy (새로 3 · 바뀜 2 · 사라짐 0, 다시 읽어 같음). 같이 대기 중이던 `rules_mgmt/library/auto`(취업규칙, 새 자리) 도 함께 올라갔다.
- 함수: ilaborPull 배포.

## 검사
node --test "tests/**/*.test.js" — fail 1: cards-detail-actions ⑤(명함 지도 창) — main 에서도 실패(이번 변경과 무관).

## 덧붙임 — 명함 지도 창 검사(⑤) 윈도우 실패 고침
- 원인: 이 PC 의 git autocrlf 로 pu-cards.html 이 CRLF 로 꺼내져, 검사가 찾는 `"...return;\n  /* 주소 지도 창"` 문구가 안 맞았다(저장소 원본은 LF 라 CI 에서는 통과).
- 고침: tests/cards-detail-actions.test.js 가 읽은 원문의 CRLF 를 LF 로 맞춘 뒤 검사. 규칙 자체는 그대로.
- 전체 검사: 통과 27744 / 실패 0.
