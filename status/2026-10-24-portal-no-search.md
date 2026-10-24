상태: 완료
작업폴더: C:\Users\fair0\Documents\pu-wt-portal-fold
이어하기시도: 0

# 포털 앱 찾기 검색칸 걷기 (2026-10-24)

대표가 «자주 쓰는 앱» 줄의 검색칸(🔍 앱 이름으로 찾기)을 가리키며 「이부분 삭제 해달라」.
앱이 19개라 접힌 이름 칩으로 다 보인다 — 찾을 일이 없다.

## 바뀐 것 (`enter.html`)
- 검색칸 마크업(`#appSearch`)·「맞는 앱이 없습니다」(`#searchEmpty`) 걷음.
- 검색에만 쓰던 것 걷음: `_searchQ` · `markSearch` · `srch-miss`/`srch-empty`/`searching` 칸·CSS · `#foldAllBtn[hidden]` · 폰 검색칸 16px 규칙.
- 폰에서 「모두 펴기·접기」를 제 줄로 내리던 규칙(.fold-tools flex-basis:100%)도 걷음 — 단추 하나뿐이라 머리 줄 오른쪽에 둔다.

## 대표 질문 「자주 쓰는 앱을 삭제하려면」
- 자주 쓰는 앱 줄의 앱 아이콘 오른쪽 아래 노란 ★ 를 누르면 빠진다(아래 줄을 펴서 같은 앱의 ★ 를 눌러도 같다).

## 확인
- 검사 `tests/portal-fold-pins.test.js` — 검색 관련 기대를 걷고 「검색칸은 없다」를 새로(다시 붙지 않게).
- 확인 상자: PC 1100px·폰 375px 검색칸 없음, 화면 밖 0, 복제본 ★ 로 빼기 확인.
