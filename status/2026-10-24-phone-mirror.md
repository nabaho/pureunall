# 2026-10-24 폰 미러 — 진짜 폰 화면을 PC 에서 보며 UI 고치기

대표 지시: 「내 컴퓨터에 폰을 미러링으로 연결하고 푸른 통합시스템 UI 고칠 수 있게 해 달라」

## 만든 것
- `폰미러-켜기.bat`(ASCII) → `tools/phone-mirror.js` (의존 꾸러미 없음, Node 22 fetch·WebSocket)
  1 미러 창(scrcpy) · 2 `--shot` 폰 갈무리(adb exec-out screencap) · 3 `--measure` 폰 크롬의 푸른 탭을 measure.js 로 재기 + 크롬 그림 ·
  4 `--check` 준비 점검 · 5 `--install` scrcpy(winget, 보이게).
- `docs/폰-미러.md` (폰 USB 디버깅 켜는 법 포함) · CLAUDE.md·AGENTS.md 에 쓰는 규칙.
- `.gitignore` 에 `tools/phone-mirror/out/` — 고객 화면 갈무리가 올라가지 않게.

## 지키는 것 (tests/phone-mirror.test.js, 돌연변이 셋 모두 걸림)
- 폰을 누르거나 치지 않는다(adb input·adb shell·CDP Input.*·click 없음). 누르는 것은 사람이 미러 창에서.
- 폰 크롬에 보내는 CDP 명령은 Runtime.evaluate(measure.js 만)·Page.captureScreenshot 둘뿐.
- 재기는 nabaho.github.io/pureunall · localhost 탭만(흉내 낸 주소·http 거절).

## 확인한 것 / 못 한 것
- 재기 길(CDP)은 이 클라우드 상자에서 «PC 크롬 + 시험 쪽»으로 끝까지 돌려 봤다 — 옆넘침·작은 단추를 잡고 값·그림을 남김.
- **adb·scrcpy·실제 폰은 못 돌려 봤다**(클라우드 상자에 폰이 없다). 대표 PC 에서 4번(점검)으로 처음 확인해야 한다.
- 전체 검사 실패 0.
