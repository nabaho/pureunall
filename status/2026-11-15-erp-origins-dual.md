# 2026-11-15 · ERP 주소 이사 1단계 — 서버가 옛·새 두 출처를 받는다 (claude/erp-origins-dual)

- 대표 지시 「ERP 를 erp.pureunlabor.co.kr 로 모두 옮겨달라」 → 계획 `docs/superpowers/plans/2026-11-15-ERP-주소-이사.md` 1단계(서버).
- 새 `functions/erp-origins.js` — 받아 주는 출처 한 자리: `https://nabaho.github.io`(0번)·`https://erp.pureunlabor.co.kr`(1번) + 개발용 localhost.
  요청 출처가 목록에 있으면 그 값 그대로 Allow-Origin + Vary. 목록 밖·와일드카드는 안 연다.
- 값 하나와만 견주던 7곳을 공용 목록으로: `index.js`(메일 창구 setCors · 자동화 setAutomationCors), `kakao.js`, `passkey.js`(CORS 만 — RP_ID 는 휴면이라 그대로), `gcal-link.js`, `gcal-proxy.js`(gcalEdit), `gcal-eum.js`(gcalEumBackfill).
- 돌아올 주소(OAuth redirect_uri) — 카카오(enter.html)·구글(pu-cal.html) 모두 «시작한 출처»의 것. 그 출처 번호를 state 에 서명해 싣고
  code 교환은 그 번호로 같은 주소를 다시 만든다(전환 순간 교환이 다른 출처에서 와도 어긋나지 않음). 전환 날 함수 재배포 불필요.
  - ⚠ 카카오 state 는 «4조각 그대로» — 화면(js/pu-kakao.js)이 4조각 정규식으로 검사한다. 번호는 셋째 조각 앞 두 글자(o0·o1, 34자).
  - 이 배포 전에 발급된 옛 꼴 state(번호 없음)는 옛 출처로 받는다.
- 소식지 그림 «우리 집» 목록 넷(mail-send IMG_HOST_OK · js/pu-news-tpl · js/pu-news-show · news-view CSP)에 새 출처 추가, 옛 주소 남김. news-lib 복사, `pu-news.html` ?v= 올림.
- 검사: 새 `tests/erp-origins-dual.test.js`(목록·되돌려주기·목록 밖 차단·7곳 공용 목록 사용·그림 목록 넷 같음), 카카오·구글 연결 검사에 «새 출처에서 시작→같은 주소로 교환»·옛 꼴 state·번호 바꿔치기·화면 정규식 통과·CORS. 관련 검사 4,504건 0 실패.
- 고장넣기 10개(새 출처 빼기·와일드카드·앞머리 일치·Vary 빼기·카카오 교환 옛 주소 고정·state 5조각·번호 무시·구글 교환 고정·gcal-proxy 되돌림·그림 목록 빼기) 모두 잡힘 → 원복.
- 남은 일: 합친 뒤 «Firebase 배포»로 함수 나눠 올리기(#3099 옛 홈페이지 정리와 함께), 배포 뒤 curl 로 두 출처·남의 출처 예비요청 확인.
  콘솔(카카오 Redirect URI·로그아웃 URI, 구글 OAuth 리디렉션 URI)에 새 주소 등록은 별도.
