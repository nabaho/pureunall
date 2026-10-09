# 2026-10-09 · 뉴스레터 열람이 0이던 것 (fix/news-open-pixel)

대표 물음: 「안걸림은 뭐냐 그리고 상대방이 읽었는지 확인이 가능할까?」 (보낸 결과 10월 1주차: 나감 147 · 열람 0 · 링크 누름 4)

- 「안 걸림」 12 = 지금 받는 명단에는 있으나 10/5 발송 때 명단에 없던 주소(그 뒤 업체관리에 새로 들어온 담당자) — 실측으로 확인(newsletter/opens 의 보냄 164 에 없음). 고장 아님.
- 열람 0 의 원인: 편지 짓개는 열람 그림을 `추적밑주소`(https://news.fairrunlabor.com)/newsOpen 으로 그리는데,
  발송기 `functions/mail-send.js` 의 그림 허락 목록(IMG_HOST_OK)에 그 도메인이 없어 «말없이» 지웠다.
  newsOpen 이 불린 기록이 0건(로그 없음), newsClick 은 정상(링크는 그림이 아님). 주소 자체는 200 image/gif 로 살아 있다.
- 고침: `OPEN_PIXEL_OK` — 그 도메인의 `newsOpen?` 한 길만 따로 허락. IMG_HOST_OK 는 안 넓힘(화면·CSP·편지짓개와 같은 목록 유지).
- 검사: `tests/newsletter-letter.test.js` — 편지를 지어 «발송기까지 이어서» 통과시켜 열람 그림이 남는지(옛 검사는 편지에 들어가는지만 봤다). 되돌리면 운다.
- 10월 1주차 열람은 되살릴 수 없다(그림이 안 나갔다). 다음 발송부터 찍힌다.
- 배포: `sendScheduledMail,sendMaterialMail`
