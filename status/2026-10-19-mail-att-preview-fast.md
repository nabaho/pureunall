# 2026-10-19 · 첨부 미리보기 빨리 (mail-att-preview-fast)

대표 「미리보기 화면 너무 늦게 읽힌다 — 제대로 정리해 달라」 (화면: .hwp 미리보기 창이 「가져오고 있습니다…」에 오래 머묾)

## 실측 — 늦은 곳이 둘이었다
- **서버**: 첨부 받기(`readMailAttachment`)는 메일 열기(`readMailMessage`)와 «다른 함수 = 다른 그릇»이라
  따뜻하게 두기(`mailKeepWarm`)가 안 닿았다. 서버 기록 `MB_TIME` — connect 428~542ms · `reused:false` · 전체 약 2초
  (10/18 08:16 · 10/19 21:39 두 건, 둘 다 새로 붙음).
- **화면**: 파일을 다 받은 «뒤에야» 판독기를 차례로 불렀다 — pako → hwp_extract.js → 옛 한글(.hwp = CFB)이면
  xlsx.full.min.js(약 900KB). 서버 2초 + 판독기 차례 싣기가 그대로 «기다림».

## 고친 것
- `readMailAttachment` 가 서명 붙은 두드림(`x-pu-warm`)을 문지기 앞에서 받고, `mailKeepWarm` 이 «메일 열기 + 첨부 받기 둘 다» 두드린다.
- 받기와 판독기 싣기를 **나란히**(`Promise.all([mbAttBytes, mbPvLibsFor])`).
- 「미리보기」 단추에 **올려놓고 150ms 머물면 미리 받는다**(`mbAttPeekHover`) — 판독기 + 파일 바이트. 누르면 이미 와 있다.
  3MB 넘는 것·못 그리는 종류·지난 메일(POP3, 한 첨부에 메일 통째)은 안 받는다. 받아 둔 것은 4개·8MB 이하만.
- 판독기는 한 번만 싣는다(`_mbPvLibWait`) — 올려놓기와 누르기가 겹쳐도 같은 `<script>` 를 두 번 안 단다.
- pdf.js 에는 바이트 «사본»을 건넨다(`buf.slice()`) — 받아 둔 것을 떼어 가면 두 번째 미리보기가 빈다.
- 검사 `tests/mail-att-preview-fast.test.js`(12) — 되돌려 우는지 12가지 모두 운다.

## 남은 일
- 배포: `readMailAttachment` · `mailKeepWarm` (이름 찍어서). 올린 뒤 `MB_TIME` 의 `reused:true`·connect 0 확인.
- 첨부 줄 정리(다음메일 모양) — 목업 대표 확인 대기.
