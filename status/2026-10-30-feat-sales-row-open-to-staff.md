상태: 코드 완료 · 규칙·함수 게시 대기

# 2026-10-30 · 영업관리 다섯 앱을 재직 직원 모두에게 연다

대표 지시: 「영업관리 자료함 의뢰인업무는 모든 직원들에게 공개한다. 그렇게 정리해라」
→ 범위를 물으니 «완전 공개 (직원도 사용)» — 타일·앱 안의 잠금·서버 자료 권한 모두.
«모든 직원» = 재직 직원(규칙 `LOGIN` = 비번 로그인 + `uid_roles/{uid}.status==='active'`).

## 대상과 한 것

| 앱 | 타일(enter.html · pu-appbar.js) | 앱 안의 잠금 | 규칙 | 서버 함수 |
|---|---|---|---|---|
| 홈페이지 `pu-home.html` | adminOnly 뺌 | `App.isAdmin` → `App.isStaff`(status active + sid), «총괄관리자만» 글 12곳 | `homepage` 읽기·쓰기 ADMIN → LOGIN | readHomepage · homepageWrite · homepageAuto · publishSite |
| 뉴스레터 `pu-news.html` | adminOnly 뺌 | `App.isAdmin` → `App.isStaff`, 발송 단추·토스트 | `newsletter` 읽기·쓰기 ADMIN → LOGIN, `ilabor` 읽기 ADMIN → LOGIN | sendBulkMail(뉴스레터·안내문 갈래) · newsDocsPull · ilaborPull |
| 정부사업신청 `gov.html` | adminOnly 뺌 | `whoAmI` isAdmin → status active + sid, 「대표 전용 화면입니다」 | `gov_watch`·`gov_feed` 읽기 ADMIN → LOGIN (`gov/{uid}` 는 그대로 본인만 — 인증키) | 없음(서버 수집은 예약 함수) |
| 회생광고 `rehab-ad.html` | adminOnly 뺌 | `isAdmin()` → `isStaff()`, 「대표 전용입니다」 | `rehab_ad` 읽기 ADMIN → LOGIN, `rehab_ad/marks` 쓰기 ADMIN → LOGIN | rehabAuto · rehabEnrich |
| 전광판 `pu-signboard.html` | perm:'signboard' 뺌 | `managerSid` → `staffSid`(관리자·위임관리인 조건 뺌) | `signboard` 읽기·ads·published·history·control·log 쓰기 MGR → LOGIN (지우기 금지·log 덧붙이기 전용은 그대로) | 없음(심부름꾼은 관리자 CLI) |

- 서버 함수는 공용 문 `STAFF_GATE.assertActive`(또는 이미 거치던 `requireStaff`)로 «재직 직원»을 본다 — 못 읽으면 막는다.
- 주석: «⚠ 직원에게 열지 말 것» 등 닫아 둔 까닭을 지우지 않고 «2026-10-30 대표 지시로 열었다»를 덧붙였다
  (`scripts/make-firebase-rules.js`, `js/pu-ontology.js`, 창고 규칙 글 `docs/firebase-storage-전체(붙여넣기용).txt` 주석 2곳 — 창고 규칙 «내용»은 안 바꿨다, 이미 isStaff).
- 경력관리(내부관리 줄)는 그대로 관리자 전용. `off` 앱(취업규칙·급여관리·급여데이터함)은 손대지 않았다.

## 의뢰인 업무·자료함 줄 점검 (손대지 않음)
- 앱 단위로 관리자에게만 잠긴 앱은 없다(타일 roles:null, 앱 첫 화면 잠금 없음, 자료 규칙 대부분 LOGIN).
- 기능 단위의 관리자 문은 남아 있다 — 일부러 둔 것: 이알피 휴지통·전체 업로드, 서명본 열기·옮기기(주민번호·계좌), 이알피 「홈페이지 🔍 찾기」(findCompanyWebsite — 단추 자체를 감춰 둠, 열쇠 없음).

## 검사
- 새 `tests/sales-row-open-to-staff.test.js` — 타일·앱 잠금·규칙(재직 직원은 되고 퇴직자·익명·남·로그인 안 함은 안 됨)·서버 함수를 함께 본다.
- 관리자 전용을 못 박던 검사들을 «새 규칙»으로 고쳤다(지우지 않음): signboard-rules·signboard-html·signboard-ontology·newsletter-app·newsletter-notice·newsletter-no-practice-send·newsletter-send-lock·newsletter-preview-link·newsletter-docs-wired·ilabor-parse·homepage-auto-server·homepage-partner-logo·home-partner-pick·home-logo-paste·pu-home-screen·appbar-admin-only·portal-admin-tiles, 그리고 가짜 App 의 `isAdmin` → `isStaff`(home-auto-card·home-auto-labor·home-auto-newco·home-logo-no-clobber).
- `tests/photos-staff-share.test.js` 의 PENDING 에 게시 대기 15칸을 적었다.
- `node --test "tests/**/*.test.js"` 전부 통과.

## 남은 일
1. 규칙 게시: `node scripts/rules-deploy.js --deploy` (보여만 주기 결과: 새로 0 · 사라짐 0 · 바뀜 15). 게시 뒤 콘솔 원문 새 판이 생기면 `tests/photos-staff-share.test.js` PENDING 15줄을 뺀다.
2. 함수 배포(이름 찍어서): sendBulkMail · rehabAuto · rehabEnrich · readHomepage · homepageWrite · homepageAuto · newsDocsPull · ilaborPull · publishSite.
3. 배포 뒤 일반 직원 계정으로 다섯 앱을 한 번씩 열어 본다(로그인 필요 — 여기서는 못 해 봄).
