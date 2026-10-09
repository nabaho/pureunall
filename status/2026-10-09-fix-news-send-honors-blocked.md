# 2026-10-09 · 반송 까닭 찾기 · 안 받는 곳 정리 · 자동 발송이 막은 주소를 지키게 (fix/news-send-honors-blocked)

## 반송 14곳 까닭 (2026-10-w1, 발송 서버가 돌려준 원문 전체로 가름)
- 없는 주소 7 — 550 No such user / Inactive mailbox / 553 5.1.1 → 이미 «안 보내는 곳»(자동)
- 받는 서버 거부 5 — 554 5.7.3, 다섯 곳 모두 메일 서버가 **메일플러그**(mailplug.com). 같은 회차 메일플러그
  가운데 옛 서버(m130) 한 곳은 나감. 우리 보내는 주소(hanmail.net)는 SPF·DMARC 갖춤 → 우리 설정 문제 아님.
- 국세청 1 — 553 Blocked Using Master Spam Pattern(홈택스 로그인 주소로 보임)
- 천리안 1 — chol.com 메일 서버(MX)가 없다
- 대표 지시 「더 이상 안 받는 곳은 안 보내는 곳으로」 → 위 7곳을 newsletter/blocked 에 넣고 반송 기록 «처리».
  업체관리 원장은 안 건드림. 허용 요청 뒤 다시 보내려면 앱 「반송·거부 › 명단에 되돌리기」.

## 고친 것
- 금요일 봉인 확정본은 월요일에 «그대로» 나가서, 봉인 뒤 막은 주소에도 갔다(w2 확정본에 방금 막은 7곳이 들어 있었다).
  weeklyNewsletterSend 가 걸기 직전 newsletter/blocked 로 받는 줄을 거른다(Core.막은주소거르기 · 명단다듬기와 같은 잣대).
- 함수 재배포: weeklyNewsletterSend · weeklyNewsletterPrepare.
