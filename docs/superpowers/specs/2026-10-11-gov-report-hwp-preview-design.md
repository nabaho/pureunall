# 컨설팅보고서 — 한글(rhwp) 미리보기 설계

- 작성일: 2026-10-11 · 대표 질문(2026-10-10): 「한글 rhwp 가 자동 장착되어 있어야 한글을 읽을 수 있다」 → 「남은 일 순서대로 진행」
- 사실: rhwp 는 이미 저장소 안에 있다(`vendor/rhwp-core`·`vendor/rhwp-studio`·`vendor/rhwp-editor`) — 공용 엔진 `js/pu-hwp-engine.js`(`window.PureunHwp`)가 `.hwp`·`.hwpx` 를 읽고 그린다. **정부사업일정·컨설팅보고서 앱만 아직 안 붙였다.**

## 1. 범위

한다 — **읽기 전용 미리보기**(편집기 아님)
- 새 공용 도우미 `js/pu-hwp-preview.js` → `window.PuHwpPreview.open(bytes, name)`: 전체 화면 창(머리줄 + 닫기)을 열어 `PureunHwp.renderPreview` 로 쪽마다 그림판(canvas)에 그린다. `.hwp`·`.hwpx` 둘 다.
- **정부사업일정 보고서 창**: 「⬇ HWPX」 옆에 **「👁 한글 미리보기」** — 내려받기와 같은 방식으로 양식에 지금 화면 값을 채운 HWPX 를 만들어(저장·다운로드는 하지 않고) 바로 미리 보여 준다. 채운 뒤 못 찾은 칸 등 기존 안내(`say`)는 미리보기 아래 줄에도 보인다.
- **컨설팅보고서 앱**: 목차 창에는 넣지 않고, 서류 칸 창(③ 업체 서명본 칸 등)에 **「📂 받은 한글 파일 열어 보기」**(파일 고르기 → 미리보기). 고른 파일은 브라우저 안에서만 읽는다 — 어디에도 올리지·저장하지 않는다.

하지 않는다
- 편집·저장(편집기 `createEditor`)은 붙이지 않는다(공용 엔진·기금관리가 이미 쓰는 길 — 필요하면 다음 단계).
- 서명 스캔(PDF·이미지) 열기 — 이번에는 한글 파일만. 한글이 아닌 파일을 고르면 「한글(.hwp·.hwpx) 파일만 열 수 있습니다」.
- 새 Firebase 자리·규칙 없음.

## 2. 안전 · 개인정보

- 문서는 **브라우저 밖으로 나가지 않는다**: 새 코드는 외부 주소를 쓰지 않고(`esm.sh`·`edwardkim.github.io` 금지), 편집기 iframe 도 만들지 않는다. 그림판 미리보기는 `PureunHwp.renderPreview`(엔진 코어는 엔진이 기존 방식대로 불러온다)만 쓴다.
- 엔진 코어(`rhwp.js`+wasm ≈10MB)는 **처음 미리볼 때만** 불러온다(지연 불러오기) — 페이지를 열 때는 `js/pu-hwp-engine.js`(작은 스크립트)와 `js/pu-hwp-preview.js` 만 싣는다.
- 닫을 때 그림판·이벤트를 정리한다(메모리 누수 방지). 한 번에 창은 하나만 연다(이미 열려 있으면 내용만 바꾼다).
- 뒤로가기(`PuBack`) 규칙: 창이 열려 있으면 뒤로가기가 «닫기»를 먼저 한다(`data-close` 단추 관례).

## 3. 동작

`PuHwpPreview.open(input, name, opts?)` → `Promise<{pageCount}>`
1. `PureunHwp` 가 없으면 「한글 엔진을 불러오지 못했습니다」 거절.
2. 창을 연다(제목 = 파일 이름, 「불러오는 중…」).
3. `PureunHwp.renderPreview(host, input, name)` 성공 → 「N쪽」 표시. 실패 → 창 안에 「미리보기를 열지 못했습니다 — <이유>」 + (opts.onFail 있으면 호출).
4. 닫기(단추·바깥 클릭·Esc·뒤로가기) → 정리.
- `PuHwpPreview.close()` · `PuHwpPreview.isOpen()` 도 내놓는다(검사·뒤로가기용).

## 4. 만들 것

- `js/pu-hwp-preview.js`(새) + `tests/pu-hwp-preview.test.js`: 가짜 `PureunHwp` 로 열기·실패·닫기·한 번에 하나·Esc·외부 주소 없음·편집기 호출 없음 검사. `hwp-engine-local-editor.test.js` 를 본보기로 «새 파일에 `esm.sh`·`edwardkim.github.io`·`createEditor` 없음» 도 지킨다.
- `gov-consulting.html`: 스크립트(`pu-hwp-engine.js?v=…` 뒤에 `pu-hwp-preview.js?v=1`; 이미 같은 `?v` 로 다른 앱이 쓰는 엔진 버전과 똑같이) + 「👁 한글 미리보기」 단추(`GRP_ACTS`) + `grpPreview(fileKey)`(내려받기 코드와 채우기 부분을 같이 쓴다 — 복사하지 말고 공통 함수로 뽑는다).
- `gov-report.html`: 스크립트 + 칸 창의 「📂 받은 한글 파일 열어 보기」.
- 검사: 기존 `tests/gov-report-ui.test.js`·`tests/gov-report-app.test.js` 에 단추·흐름 검사(가짜 `PuHwpPreview`). 페이지가 «쓰기는 `scal_docs` 한 줄뿐»인 기존 검사는 그대로 통과해야 한다.
- 기록: STATUS.md · `status/2026-10-11-gov-report-hwp-preview.md`.
