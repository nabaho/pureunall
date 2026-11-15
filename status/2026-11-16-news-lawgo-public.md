상태: 코드 완료 · 합친 뒤 함수 배포·규칙 게시·첫 모으기 확인
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall-wt-newslaw
가지: fix/news-lawgo-public

# 2026-11-16 · 뉴스레터 판례·행정해석·법령·AI 교정 조문 — 국가법령정보센터 «공개 쪽»으로 옮김

대표 「남은거 모두해라」(11-15 뉴스레터 경고 수정 뒤 남은 일 전부). 앞 기록: `status/2026-11-15-news-watch-lawgo.md`.

## 왜
- 법제처 DRF 가 공개 열쇠 `OC=test` 를 «200 + 사용자 정보 검증에 실패(서버 IP·도메인 등록)»로 거절한다(11-16 다시 재도 그대로).
  새 열쇠는 서버 IP 등록이 필요한데 클라우드 함수는 나가는 IP 가 고정이 아니다 → 열쇠 없이 열리는 사람용 쪽을 읽는다.
- 국가법령정보센터 robots.txt 는 «모두 허용». 날마다 목록 열 번 · 한 건 열두 번쯤이다.

## 실측한 공개 쪽 (2026-11-16)
- 판례 목록 `LSW/precSc.do?…&selSort1=2&selSort2=DESC&query=` — 선고일 내림차순, 한 줄에 `precView('번호')` + `[법원 날짜 선고 번호 판결]`
- 판례 한 건 `LSW/precInfoP.do?precSeq=` — `<h2>`사건명 · `ct_sub` 꼬리 · `<h4>【판시사항】【판결요지】【참조조문】【참조판례】【전문】`
- 해석 목록 `LSW/expcSc.do?…&query=`(기본 회신일 내림차순) · 한 건 `LSW/expcInfoP.do?expcSeq=` — 【질의요지】【회답】【이유】
- 법령 목록 `LSW/lsSc.do?…&selSort=20desc&query=` — `lawInfoPop('lsiSeq','공포일',…,'시행일')` + 칸 여덟
- 조문 `LSW/lsLinkProc.do?lsNm=`(숨은 칸 lsiSeq·frm_efYd·lsNm) → `LSW/lsInfoR.do` POST(lsiSeq·efYd) → 조마다 `<a name="J60:0">`

## 고친 것
- `functions/news-prec.js` ⑥ 공개 쪽 읽기 — 목록 둘 · 판결 꼬리 · 한 건을 «예전 XML 칸 모양»으로(공개쪽XML). 목록주소·한건주소 따위가 공개 쪽을 가리키고,
  목록읽기·한건읽기·해석* 은 공개 쪽 HTML 이면 그 길로, XML 이면 예전 길로(검사·지난 자료 그대로). 모양을 못 알아보면 빈손(지어내지 않음).
- `functions/index.js` — 판례·해석 모으개가 공개 쪽을 읽고, «모든 낱말이 빈손» 또는 «한 건 쪽을 하나도 못 읽음»이면 던져 탈로 남긴다.
  AI 교정 `법조문원문` 은 lsLinkProc → lsInfoR 로(이름이 정확히 같은 법만 · 같은 법은 한 번만 받음 · 아이콘 줄·「<개정 …>」 표지 뺌).
  브리핑 법령 소식은 공개 법령 검색으로. 포털 경고판의 회차 읽기에 숫자 열쇠 경계(endAt '9\uf8ff').
- `functions/news-full.js` — 전문 보기가 공개 쪽을 받아 «푸른 양식»(주문 맨 위 · 이유 접힘)으로 다시 편다. 못 펴면 예전처럼 공개 쪽으로 302.
- `functions/news-brief.js` — 공개 법령 목록 주소·읽기. 링크는 숫자 번호로 `/LSW/lsInfoP.do?lsiSeq=`.
- `js/pu-news-core.js`(+ `functions/news-lib` 사본) — `법제처사람주소` 가 옛 DRF 법령 주소(target=law·MST)도 공개 쪽으로. 화면 판 63.
- `pu-news.html` — 자동화 점검 화면의 회차 읽기에 숫자 열쇠 경계(서버와 같은 잣대).
- 보안규칙 `scripts/make-firebase-rules.js` + 적용본 — `homepage/newsBrief·newsDocs·newsPrec` 쓰기를 총괄관리자(+서버)로 좁힘.
  읽기는 그대로(재직 직원). 화면에서 그 자리에 쓰는 곳은 저장소에 없다(11-16 확인). 11-15 보안 검토 «낮음» 반영.
- 배포 작업 `.github/workflows/firebase-deploy.yml` + `scripts/firebase-deploy-verify.js` — 로그를 함수마다 대조, 안 올라간 것만 한 번 더, 그래도 남으면 빨갛게.
  11-15 실제 로그로 돌리면 그때 빠진 둘(weeklyNewsletterPrepare·newsletterSundayRefill)을 정확히 잡는다.

## 검사
- 새로: `tests/news-lawgo-public.test.js`(12) · `tests/firebase-deploy-verify.test.js`(7)
- 새 길에 맞춰 고침: `news-ai-review`(③ 조문) · `news-law-numbering`(공개 쪽 모양) · `news-lawgo-refused`(② 법령 주소 · ③ 빈손 세기) · `newsletter-full-text`(받는 주소)
- 실제 쪽으로 손 확인: 판례 목록 17줄 · 한 건(2024다206043) · 해석 목록·한 건 · 전문 보기 푸른 양식 · 조문 4개(제60조·제76조의2·남녀고용평등법 제18조의2·제55조) · 법령 목록 20줄

- 전체 검사 30,159 · 실패 0, 서버 쪽 411 · 실패 0. 보안규칙 에뮬레이터 짝 시험 7/7(옛 규칙에서는 직원 쓰기 셋이 통과 — 구멍 확인).
- 콘솔 대조(rules-deploy.js 보기): 새로 3(/homepage/newsBrief·newsDocs·newsPrec) · 바뀜 0 · 사라짐 0.
- 자동 검토(ow review): 기능 검증 antigravity:gemini-4-argon-high «통과»(높음·중간·낮음 0) · 보안 codex «발견 없음».

## 남은 일
- 합친 뒤 함수 배포: dailyDocsCollect · newsDocsPull · newsletterSundayRefill(모으개) · newsFull · newsFullPage(전문 보기) ·
  newsletterWatchSunday(AI 교정 조문·경고판) · 브리핑 법령을 쓰는 함수 · 경고판 갱신을 부르는 함수들. 규칙은 `node scripts/rules-deploy.js --deploy`.
- 첫 아침 모으기 뒤 `homepage/newsPrec` 의 새것날·탈 확인.
