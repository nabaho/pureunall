# 2026-09-28 · 사진첩 검사 — 고정 폭 자르기를 함수 전체로

- 알려 온 곳: 경력관리 방(전체 검사 중 main 에서 빨간 것을 봄)
- `tests/test-cut-truncation.test.js` 가 잡았다: `photos-gov-day-share.test.js` 의 「판독이 끝나는
  길목(saveRead)에서 걸린다」가 saveRead 를 앞에서 700자만 잘라 봤는데, 함수가 711자로 길어져
  끝 11자를 못 봤다(9fbecf1c 뒤).
- 고침: 창 숫자를 키우지 않고 `cutFn` 으로 함수 «전체»를 본다(자르개 검사의 권고대로).
- 이빨: saveRead 의 `govQueue(` 부르기를 빼면 검사가 운다 — 확인. 두 검사 25개 통과.
