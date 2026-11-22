# 2026-11-22 · fix/edulib-strip-deploy — 강의자료 토큰 정리 트리거가 배포되게

## 무슨 일
- #3235 를 합친 뒤 대표 「합쳐지면 배포해」로 `firebase-deploy.yml`(functions=edulibMailSweep,runEdulibMailSweep,edulibTokenStrip)을 돌렸다.
- 배포 도구가 `Pass the --force option to deploy functions with a failure policy` 로 멈춰 **셋 다 안 올라갔다**(같은 배포 묶음이라 함께 멈춤).
  원인: 새 창고 트리거 `edulibTokenStrip` 에 «다시 시도»(`failurePolicy: true`)를 걸었다.

## 고친 것
- `functions/index.js` — `edulibTokenStrip` 에서 `failurePolicy` 를 뺐다. 실패는 기록만 남기고 끝낸다(던지지 않음) — 매일 밤 `edulibMailSweep` 의 토큰 정리가 메운다.
  한 시간 넘은 되풀이를 버리던 줄도 함께 뺐다(다시 시도가 없으니 필요 없다).
- 배포 작업에 `--force` 를 더하지 않았다 — 안전장치를 넓히는 길이라서. 검사가 지킨다.
- `tests/edulib-auth-open.test.js` ⑨ — 트리거에 failurePolicy 없음 · 배포 작업에 --force 없음 · 순서(다른 자리 곧바로 끝 → 지우기 → 실패는 기록만).

## 남은 일
- 합친 뒤 같은 세 이름으로 다시 배포하고 결과를 확인한다(STATUS.md 2절 강의자료 항목).
