# 2026-11-01 · 법령정보 앱 (feat/law-info)

상태: 이어하기 대기
작업폴더: C:\Users\fair0\Documents\pu-wt-law-info
이어하기시도: 0

- 설계서(대표 승인 2026-11-01): `docs/superpowers/specs/2026-11-01-law-info-design.md`
- 끝낸 것: 설계 합의·승인 · 서버 쪽 기존 방식 조사 · legalize-kr 실측.
- 남은 일(이어 할 것): **계획서만** 쓴다 — `docs/superpowers/plans/2026-11-01-law-info.md` (superpowers:writing-plans).
  ⚠ 화면 코드는 대표 시안 승인 전 금지. 푸시·배포·규칙 올리기 금지(감시 규칙).

## 계획서에 넣을 조사 결과 (다시 조사하지 말 것)
- legalize-kr: `kr/{법률명 띄어쓰기 제거}/` 아래 `법률.md`·`시행령.md`·`시행규칙.md`, 겹치면 `법률(법률).md`.
  노동 법령 30개 폴더 모두 있음(남녀고용평등법 폴더는 «ㆍ»(U+318D)). 전체 약 7.4MB.
  ⚠ 앞머리 `상태` 는 믿지 말 것(1997 폐지본도 «시행»). 같은 법령구분이면 공포일자 최신 파일을 고른다.
  ⚠★ 여러 파일이 **시행 전 판**이다(최저임금법·기간제법 2026-12-08, 산안법 2027-04-28, 장애인고용법 2028-05-27 등).
  현행판은 `commits?path=` 이력을 거슬러 «시행일자 ≤ 오늘»인 커밋의 raw 를 받는다(2026-11-01 이력 조회 됨, 시간당 60번 한도).
- 기존 부품: `functions/rules-lawwatch.js`(`parseLawMd`·`rawUrl`·`commitsUrl`·`effectiveDates`) 재사용.
- 인증: `requireReader(req)`(index.js) — 지문·카카오 직원도 받음. CORS `setCors` 는 POST·OPTIONS 만 → 모든 문은 POST.
- Gemini: `runWith({secrets:["GEMINI_KEY"]})` + `readGeminiKey()` + `DR.callGemini(fetch,key,[{text}],null,cfg)`(doc-read.js).
  셈은 `bumpReadTally("law")` — `functions/doc-read.js:88` APPS 와 `js/pu-doc-read.js:54` APP_KO 에 `law:'법령정보'` 추가.
  하루 50번은 `ai_read_tally/{ymd}/law/n` 으로 확인(새 RTDB 자리 불필요).
- 창고: 서울 `pureun-erp-hrphotos` 의 `law/` 아래에 원문·색인·상태(JSON). 서버만 읽고 씀.
- 예약 함수 하나 더하면 `tests/billing-auto-truth.test.js` 29→30, 하루 셈 +14→+15, enter.html 「하루 <b>N번</b>」과 설명 문구 함께.
- 검사: `node --test tests/*.test.js functions/*.test.js` — 검사 대상 모듈은 맨 위에서 firebase 꾸러미를 부르지 말 것.
- 설계서 §5 의 «geoip-lite 256MB» 는 옛 정보(지금은 함수 안에서만 부름).

## 화면 쪽 조사 결과 (2026-11-01, 다시 조사하지 말 것)
- 본보기: 골격은 `pu-govaid.html:332-354`(싣는 순서), 함수 호출은 `rehab-ad.html:485-503`
  (`getIdToken()` → `fetch(URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok}})`, 404 면 «서버 함수가 아직 안 올라감»).
- key `law` 를 적을 곳: `enter.html` APPS(한 줄·정해진 순서, row:'client') · `js/pu-appbar.js` APPS · `js/pu-ontology.js` PROGRAMS ·
  `tools/phone-audit/seeds/law.js` · 색 검사 `tests/color-palette-apps.test.js` DONE+EXCEPT(둘 다). `SG_CATS`(건의함 분류)에는 넣지 않는다.
- ⚠ 온톨로지: 저장 뿌리·쓰기 계약 없는 앱이 지금 검사를 통과하는 길은 `localOnly:true` 뿐인데 뜻이 «이 PC 안 도구»다.
  계획서에서 정할 것 — 새 표식(예: `serverOnly`)을 만들고 contract:31·91, write-gate:203, `pu-ontology-write.js:51` 을 함께 고칠지(그러면 ?v= 29곳).
  개체 종류 `LegalProvision:'법령 조문'` 은 TERMS 에 이미 있다.
- 새 페이지가 지켜야 할 검사: pu-sid-guard·pu-ls-guard·pu-gate(`PuGate.show(`)·pu-back(`PuBack.guard(`)·pu-active·pu-whoami(`mount`)·
  폰 입력 16px·`<head>` 필수·팔레트 27색·가짜 번호만. 타일 그림: 저울·두루마리는 이미 쓰임. 새 하위 폴더는 배포에서 공개되니 만들지 않는다.
