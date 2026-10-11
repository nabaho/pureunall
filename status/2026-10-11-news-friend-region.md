상태: 이어하기 대기
작업폴더: C:\Users\fair0\Documents\pureunall-news-watch
가지: news-friend-region
이어하기시도: 0

# 2026-10-11 · 지인·잠재 가져오기 — 회사 주소 열 · 지역 필터 · 주소 저장 · 지역 소식 연결

대표 지시: 「사업장 주소도 넣을 수 있나 지역별로도 필터링 하고 싶다. 필터링이 있어야 진행이 쉽다」 → 목업 → 「추천대로」
(1~5 전부, 4번 지역 소식 연결 포함). 사용 한도로 중간에 멈췄다 — **아직 푸시·PR·합치기·배포 전**이다(로컬 커밋만).

## 실측 (2026-10-11, 건수만)
- 메일 주소가 있는 명함 4,338장 중 회사 주소 있음 4,213 · 지역을 읽은 것 4,136 · 못 읽음 77 · 주소 없음 125
- 충남 2,592(천안시 1,281 · 아산시 505 · 서산시 209 · 홍성군 140) · 서울 506 · 경기 270 · 대전 227 · 세종 163 · 충북 127

## 끝낸 것 (커밋됨, 검사 36개 통과)
- Core(js/pu-news-core.js + functions/news-lib 동기화): 지인후보 줄에 `사업장주소`·`지역`·`시도`·`시군구`, 찾는글에 주소 포함,
  `지인후보거르기`에 시도/시군구(지역맞나), 신설·내보냄: `지역맞나` `지역나누기` `주소글씻기` `지인지역셈`,
  `지인담을값`에 `사업장주소`, `더한분들줄로`가 `사업장주소`·지역 코드를 붙임(명단다듬기는 주소 원문을 안 나른다 — 지역 코드만)
- pu-cards.html selToNewsletter 도 `사업장주소` 를 담는다(칸 모양 일치 검사 통과)
- tests/news-friend-import.test.js 기대 모양 갱신

## 남은 일 (순서대로)
1. **pu-news.html** (아직 손 안 댐)
   a. App 에 `지인시도:'', 지인시군:''`, `들여오기새것()` 에 `시도:'', 시군구:''`
   b. 도우미 `지역고르개옵션(셈, 시도, 시군)` — 시·도는 많은 순 + 「지역 미상」, 시·군·구는 둘째 칸, 고른 지역이 0 이어도 옵션 유지
   c. 가져오기 창: 표에 「회사 주소」 열(Core.주소글씻기, title 에 전문 · 한 줄 …), 지역 줄(`#frSido` `#frSigun` select + `#frAllWrap` 를 이 줄로),
      `들여오기시도(v)` `들여오기시군(v)`, `들여오기거른것(지역빼고)` — **「고른 분」 칩에서는 지역 무시**, 곁그리기에서 옵션 채움
      (숫자는 «지역을 뺀» 나머지 조건 기준), CSS: `#friendbox .qrow select{width:auto…}` · `.in` 폭 1180px · `table.fr` min-width ~940 · colgroup 8열
   d. 지인·잠재 탭: `지인줄들()` 에 시도/시군구/찾는글(사업장주소), `지인거른것(줄, 지역빼고)` + `Core.지역맞나`, 표에 「지역」 열(소속 뒤 → th/td 9칸),
      필터 줄에 select 둘(`#jnSido` `#jnSigun`), `지인시도` `지인시군` `지인표다시그리기` `지인지역칸고치기`(찾는 말 바꿀 때 select 숫자도 새로), 폰 16px
   e. 캐시 번호 `pu-news-core.js?v=56` → `57` (`node scripts/check-cache-version.js --all`)
2. **검사**: tests/news-friend-import.test.js 에 지역 검사 추가(Core 판정·거르기·셈·더한분들줄로 지역 연결·명단다듬기가 주소 원문을 안 나름 /
   화면 vm: 주소 열·select 옵션·좁히기·고른 분 칩 지역 무시·지인 탭 지역 열·필터), tests/news-recipients-groups.test.js ⑥ 칸 수(지인 표 9칸) 확인,
   망가뜨려 보기(예: 지역맞나 삭제 · 고른 분 칩 지역 무시 삭제 · 사업장주소 저장 삭제 · 지역 코드 연결 삭제),
   **뉴스레터 검사 전체(tests/news-*, newsletter-*) 다시** — Core 를 고쳤고 마지막 손질 뒤에도 다시 돌릴 것
3. 가짜 자료로 헤드리스 Edge 스크린샷 → PR → 서버 검사 통과·합침 확인
4. **배포(서버 함수 필요)** — `더한분들줄로` 가 서버 명단 만들기(news-friday)에 쓰이므로: origin/main 을 detached 로 받아
   `$env:FUNCTIONS_DISCOVERY_TIMEOUT=180; firebase deploy --only "functions:weeklyNewsletterPrepare,functions:weeklyNewsletterSend,functions:newsletterWatchRetry,functions:newsletterWatchSunday,functions:newsletterSundayRefill,functions:newsletterWatchDelivery,functions:newsletterBounceScan,functions:newsView,functions:newsFull,functions:newsFullPage" --project pureun-erp`
   (이어하기 감시는 푸시·배포를 안 한다 — 대표가 새 방에서 «이어서» 라고 하면 3·4 를 마무리)

## 조심할 것
- 새 도우미 이름이 Core·화면의 기존 이름과 겹치면 조용히 덮어쓴다 — tests/news-core-names.test.js 가 Core 는 잡는다(화면은 grep 으로 먼저 확인)
- 「주소」 는 메일 주소, 회사 주소는 「사업장주소」 — 섞지 말 것
- 고른 분이 많을 때 한도(Core.지인한번에한도) 규칙은 그대로
