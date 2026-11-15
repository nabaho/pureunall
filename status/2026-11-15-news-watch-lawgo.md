상태: 완료(코드) · 함수 배포 대기
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall-wt-newslaw
가지: fix/news-watch-lawgo

# 2026-11-15 · 뉴스레터 ⚠ 2 — 점검 화면이 비어 보이던 것 + 법제처가 OC=test 를 거절한 것

대표 「뉴스레터에 경고가 나왔다 뭔지 확인하고 개선해달라」(포털 ⚠ 2 → 자동화 점검 화면은 «기다림 · 아직 점검이 돌지 않았습니다»).

## 실측으로 확인한 것 (읽기만 함)
- 경고판 `newsletter/watch/현재` = 2건: ① 판례가 3주 넘게 새로 안 들어옴(2026-10-09 뒤로) ② 🤖 AI 교정 — 한마디의 「대법원 2024도5902 (2026. 6. 25.)」가 원문 목록에 없음.
- ② 는 지어낸 판례가 아니다 — 9/7 에 법제처에서 모아 둔 실제 판례(공개 쪽에서도 확인). 일요일 17시 보충이 «이미 보낸 판례»라 판례 꼭지에서 빼고 행정해석으로 바꿨는데, 금요일에 쓴 한마디가 그대로 인용해 생긴 어긋남.
- ① 의 까닭: 법제처 DRF 가 공개 열쇠 `OC=test` 를 «200 + 사용자 정보 검증에 실패 — 서버 IP·도메인 등록»으로 거절. 모으개는 0건으로 조용히 넘어가 탈 칸도 비어 있었다.
- 같은 까닭으로 편지의 「전문 보기」(newsFullPage)가 502 «받아 오지 못했습니다», 그 아래 «법제처에서 원문 보기»도 DRF 실패 쪽 — 10월 중순 뒤로 나간 편지의 판례 링크가 모두 막혀 있었을 수 있다. 일요일 링크 점검은 200 만 보고 «모두 열림».
- 점검 화면이 비어 보인 까닭: 화면이 `newsletter/watch` 의 맨 끝 열쇠를 읽었는데 그것이 회차가 아니라 «현재»(한글 열쇠가 숫자 뒤에 선다). 경고판을 만든 10-04 부터 그랬다.

## 고친 것
- `pu-news.html` 감시읽기 — 서버(뉴스레터경고판갱신)와 같은 회차 열쇠 잣대로 고른다.
- `js/pu-news-core.js` `법제처사람주소` — 옛 DRF 꼴 판례·해석 주소를 열쇠 없는 공개 쪽(`LSW/precInfoP.do?precSeq=`·`LSW/expcInfoP.do?expcSeq=`)으로. `실은열쇠` 도 이것을 거쳐 옛 꼴·새 꼴이 한 열쇠.
- `js/pu-news-tpl.js` — 판례한칸 손잡이·평문 링크를 공개 쪽으로, `_법제처짝` 이 새 꼴도 알아본다(우리 쪽 newsFullPage 그대로). 사본 `functions/news-lib/` 맞춤, 화면 판 번호 올림.
- `functions/news-prec.js` — 보는주소·해석보는주소 = 공개 쪽, `거절인가` 추가.
- `functions/index.js` — 판례·해석 목록을 `법제처목록받기` 로(거절이면 던짐, 모두 거절이면 모으기가 탈로 남김) · 일요일 점검이 `homepage/newsPrec/탈` 을 읽어 넘김 · newsFullPage 는 못 받으면 오류 쪽 대신 공개 쪽으로 302(숫자 번호로 우리가 지은 주소만).
- `functions/news-watch.js` — 링크 점검이 받는 분이 실제로 가는 주소를 재고, law.go.kr 은 몸을 읽어 실패 쪽이면 «깨짐» · 판례 경고에 «까닭»을 붙이고, 3주 전이라도 못 모으면 알린다.
- 검사: `tests/news-lawgo-refused.test.js`(9) 새로 · `newsletter-full-text`·`newsletter-dead-end` 의 «사람이 볼 주소 = DRF» 규칙을 «열쇠 없는 공개 쪽»으로 고침.
- 화면 확인: 지어낸 자료(«현재» + 회차 기록)로 1366px·375px — «보내기 전 점검 ⚠ 확인 2건» 과 두 줄이 보이고 가로 넘침 없음.
- 자동 검토(ow review): 기능 검증 antigravity:gemini-4-argon-high «통과», 보안 antigravity:claude-opus-5-5-high «높음·중간 없음».
  낮음 넷 가운데 둘을 반영 — ① 웹 전문 보기(functions/news-view.js)가 못 펴면 옛 href(DRF) 대신 우리 newsFullPage 로 물러서고 공개 쪽 꼴도 알아봄
  ② 링크 점검이 «넘겨받은 뒤 닿은 곳»이 법제처일 때만, 앞 64KB 만 읽음. 반영분은 검사로 확인(옛 코드로 되돌리면 둘 다 잡힘), 외부 재검토는 안 돌림.
  안 한 것 — watch 열쇠를 4개만 읽는 경계(서버와 같은 잣대, 지금 구조에선 문제없음) · homepage/newsPrec/탈 을 직원도 쓸 수 있는 규칙(출력은 모두 씻김, 규칙 좁히기는 따로).

## 남은 일
- 함수 배포(대표 승인 필요): newsFullPage · newsFull(받는 분 「전문 보기」) · newsletterWatchSunday · weeklyNewsletterPrepare · weeklyNewsletterSend · dailyDocsCollect · newsDocsPull · dailyRegionalNewsCollect.
- 판례를 다시 모으려면 결정이 필요하다 — 법제처 OPEN API 열쇠를 새로 받아 서버 IP 를 등록(클라우드 함수는 나가는 IP 가 고정이 아니라 고정 IP 장치가 필요) 하거나, 열쇠 없이 열리는 국가법령정보센터 공개 쪽을 읽는 길로 바꾸기. STATUS.md 「2. 지금 손이 필요한 것」.
- AI 교정이 쓰는 법제처 원문 조문 읽기(`functions/index.js` 같은 OC=test)도 같은 까닭으로 막혀 있다 — 위 결정에 함께 딸린다.
