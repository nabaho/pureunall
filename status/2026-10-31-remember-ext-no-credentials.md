상태: 완료

# 리멤버 확장 — 목록 받기가 «Failed to fetch» 로 막히던 원인 (2026-10-31)

- 흔적(trace)이 찍혀 알아냈다: 단계 3(목록 받기)에서 `Failed to fetch`.
- 실측(같은 머리로 두 방식 비교, 대표 크롬 안): `credentials:'include'` → 실패 / 기본값 → HTTP 200.
- 고침: hook.js 에서 credentials 를 뺐다. remember-auto 검사가 다시 넣으면 걸린다.
- 이 한 줄은 10/24 첫 판부터 있었다 — 그래서 한 회차도 끝난 적이 없었다(status 가 늘 비어 있던 까닭).
- 확인법: 확장 새로고침 후 `firebase database:get /pucards/remember/trace` 에 `4 batch 끝` 이 나오고 status 에 cp 가 생기면 끝.