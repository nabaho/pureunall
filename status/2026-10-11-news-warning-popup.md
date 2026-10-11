상태: 이어하기 대기
작업폴더: C:\Users\fair0\Documents\pureunall-news-watch
가지: fix/news-law-dup-numbers
이어하기시도: 0

# 2026-10-11 · 포털 뉴스레터 ⚠ 경고 — 오탐 고치기 + 눌러서 까닭 보는 팝업

대표 지시(10/11 19시): 「경고표시 뭐냐 … 클릭하면 왜 경고가 나왔는지 팝업 나오게 해달라. 그리고 지금은 문제 해결해라」

## 경고의 정체 (서버 실측, 읽기만)
- `newsletter/watch/현재` = {경고수 1, 말들 [「🤖 근로기준법 제55조 조문 내용 반복」], 열쇠 2026-10-w2}
- 점검 기록(`newsletter/watch/2026-10-w2/점검`)의 그 줄 설명: 「법제처 원문 조문에서 '① ①', '② ②'와 같이 번호가 중복 기재되어 있습니다.」
- **편지는 정상이다**(우리글·안 전체에서 「① ①」 0건). 일요일 18시 AI 교정이 «편지 속 법 이름+조문»(기사 「주휴일」 글의 근로기준법 제55조)을
  법제처에서 받아 오는데, `functions/index.js 법조문원문` 이 XML 의 `<항번호>①</항번호>` 와 `<항내용>① 사용자는…</항내용>` 를
  둘 다 살려 «제55조(휴일) ① ① 사용자는 … ② ② …» 로 만들었고, AI 가 그것을 «번호 중복»으로 올린 **오탐**이다.
- 월요일 발송은 막지 않는 항목(you 수준)이다 — 보낸 뒤엔 점검 항목을 세지 않으므로 월 발송 뒤엔 저절로 사라진다.

## 할 일
1. [x] 변환 고치기: `법조문원문` 에서 «내용 맨 앞에 같은 번호가 있는 번호 칸»을 버린다(항·호·목) + 교정 지시에 «원문 쪽 글자 모양은 지적하지 마라»
2. [x] 검사 `tests/news-law-numbering.test.js` (실제 XML 모양 · 망가뜨린 5가지 모두 걸림) + index.js·뉴스레터를 읽는 검사 209파일 2,763개 통과
3. [x] PR #2506 합침(10/11 19:21) → `newsletterWatchSunday` 이름으로 배포(21:21 · 업데이트 성공)
4. [x] 점검을 «한 번 더» 돌림(21:22, 예약 작업 «지금 실행» 한 번) — 판정 이상 없음 · 🤖 AI 교정 「확인할 것 없음」 · 경고판 0건 · 점검표 메일 한 통 더 감
5. [x] 눌러서 까닭 보는 팝업 — 목업(가운데 팝업) → 대표 「추천대로」 → 구현·검사 (이 PR)
       - 서버 `경고판짓기`: 줄마다 {종류·말·까닭·때}(`줄들`) + 회차 이름. `말들`·`경고수`는 예전 그대로(줄들에서 뽑는다) — 옛 화면도 그대로 돈다
       - 포털 `enter.html`: ⚠ 를 누르면 `#nlWarnModal` 팝업(왜 떴나요 · 어떻게 하나요 · 시각 · 자동화 점검 열기). 타일의 다른 곳은 예전처럼 앱 열기.
         까닭 글은 AI 가 쓴 것 → textContent 로만. 옛 경고판(줄들 없음)은 말들로 그린다.
       - 검사 `tests/news-warning-popup.test.js`(17) + `tests/helpers/fake-dom.js`(새) · `tests/news-portal-alert.test.js` ④ 를 새 가짜 DOM 으로 · 망가뜨린 25가지 모두 걸림
       - 회귀: enter.html·index.js·뉴스레터를 읽는 검사 319파일 4,264개 통과. 실제 enter.html 의 CSS·HTML·JS 를 뽑아 진짜 브라우저(Edge)에서 눌러 본 화면 3장(실제값·여러 건·옛 형식) 확인

## 남은 일
- 이 PR 이 합쳐진 뒤 **서버 함수 6개를 이름으로 배포**(경고판을 쓰는 것 전부 — 안 올리면 옛 함수가 경고판을 옛 모양으로 다시 써서 팝업이 «까닭 없이» 그려진다):
  `weeklyNewsletterSend, newsletterWatchRetry, newsletterWatchSunday, newsletterBounceScan, newsletterWatchDelivery, newsletterSundayRefill`
  (`FUNCTIONS_DISCOVERY_TIMEOUT=180 firebase deploy --only functions:이름,functions:이름… --project pureun-erp`, 최신 origin/main 에서)
- 사이트(enter.html)는 합치면 저절로 배포된다 — `gh run list --workflow "Test and Deploy Pages"` 로 success 확인
- 지금은 경고가 0건이라 운영에서 팝업을 «눌러 볼» 수는 없다(경고를 일부러 만들지 않는다). 다음에 경고가 뜨면 그때 실제로 확인
