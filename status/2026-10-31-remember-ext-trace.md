상태: 완료

# 리멤버 확장 — 회차 진행 흔적(pucards/remember/trace) (2026-10-31)

- 증상: 확장이 푸른 받는 화면까지는 오지만(ping 있음) batch 가 한 번도 안 끝남(status 비어 있음). 멈춘 자리를 밖에서 볼 길이 없었다.
- 한 것: bg.js 가 단계마다 받는 화면에 `trace` 를 보내고, 받는 화면이 `pucards/remember/trace {step,why,at}` 에 적는다. 명함 내용은 없다.
- 확인법: `firebase database:get /pucards/remember/trace --project pureun-erp` — 확장을 `C:\pu-remember-ext` 에 새 판으로 덮고 chrome://extensions 새로고침 필요.
- 안 한 것: 원인 고침. 흔적을 보고 정한다.