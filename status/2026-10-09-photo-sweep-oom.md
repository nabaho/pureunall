# 2026-10-09 · 사진첩 「세어 보기」가 Failed to fetch — 서버 함수가 메모리 초과로 죽던 것 (fix/photo-sweep-oom)

대표가 로그인한 뒤 사진첩 › 옛 서류 원본 주소 지우기 › 「세어 보기」 → 「❌ Failed to fetch」.

## 원인 (서버 기록)
`photoSensitiveSweep` 가 사진첩 뿌리(`puphotos`)를 «통째로» 읽었다. 뿌리에는 사진 항목 말고도 열람 기록(access_log)·
지운 기록(dellog) 같은 큰 묶음이 함께 있어, JSON 해석 중 힙 부족(512MB)으로 함수가 죽었다(22.9초, connection error).
응답이 아예 안 나가 화면에는 「Failed to fetch」만 떴다. ※ 10/8 의 405 두 번은 다른 프로그램의 GET — 대표 클릭이 아니었다.
실측: 사진 항목은 주인·연도별 1~326KB 뿐이다.

## 고친 것 (`functions/index.js`)
- `photoOwnerIds` — 주인 색인(`puphotos/owners`) ∪ 사진 칸 열쇠만(REST shallow). 둘 다 실패해야 멈춘다.
- 사진 항목(`puphotos/u/주인/items`)만 주인별로 나눠 읽어 센다 · 지우기도 같은 대상.
- 읽다 실패하면 500 + 까닭(「사진 목록을 읽지 못했습니다 — …」) — 화면이 까닭을 보인다.
- 세기 답에 `owners`(훑은 주인 수)를 함께 준다.
- 검사 `tests/photos-doc-url-sweep.test.js` +3(가짜 DB 로 함수를 실제로 돌림) — 일부러 망가뜨린 3가지 모두 운다.

## 남은 것
- 함수 다시 올리기(`firebase deploy --only functions:photoSensitiveSweep`) → 대표 「세어 보기」 → 847장 안팎이면 지우기.