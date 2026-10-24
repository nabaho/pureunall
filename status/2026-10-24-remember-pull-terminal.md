상태: 사람 확인 필요
작업폴더: C:\Users\fair0\Documents\pu-wt-remember2

# 리멤버·메일 → 명함·사진첩: 터미널 프로그램 (2026-10-24)

대표 「리멤버에 있는 것 피시는 켜져 있는데 자동으로 터미널에서 연결해서 가지고 올 수 없나」 → 「진행」

## 끝낸 것
- `tools/remember-pull/run.js` — puppeteer-core 로 전용 크롬 프로필을 띄워 리멤버 수정분을 받아 `remember-intake.html` 에 넘김. 메일 서명·첨부 처리도 같은 회차에.
- 이 PC: `C:\Users\fair0\Documents\pu-remember-pull` 에 설치, 예약 작업 `pu-remember-pull` 1시간마다(창 없이).
- 로그인 전 시험 회차: 「푸른 포털 로그인이 안 되어 있습니다」 로 바르게 멈춤.

## 남은 일 (사람)
- `node run.js login` 창에서 대표님이 리멤버·푸른 포털 로그인 → 다음 회차가 기준(cp)을 잡는지 `run.log` 확인
- 확장(tools/remember-ext)은 쓰지 않음 — 설치할 필요 없음
