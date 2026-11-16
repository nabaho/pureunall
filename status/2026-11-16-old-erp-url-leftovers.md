# 2026-11-16 · claude/old-erp-url-leftovers

대표 지시 「추가 더검토 있는지 모두 확인해서 알려달라」 → 「둘 다 고쳐라」(코드에 남은 옛 주소 + 구글 동의 화면 링크).

## 고친 것 (코드)
- `pu-erp-manifest.json`·`pu-photos-manifest.json` — `related_applications` 가 옛 주소였다. 새 주소에 깐 앱을 «진짜 앱»으로 못 알아봐(사진첩 `getInstalledRelatedApps`) 공유받기 판단이 어긋날 수 있었다 → 새 주소.
- `pu-cal.html`·`pu-erp.html` — 구글 OAuth «https 아닐 때» 대체값, 이음 보기 링크 뿌리(`IEUM_VIEW_BASE`, 두 화면 같은 값), 하나 문자 다리 apk 주소, file:// 경고의 안내 주소 → 새 주소.
- `fund-erp/static/index.html` — 포털로 돌아가는 `PORTAL_URL` → 새 주소.
- `tools/remember-ext/bg.js`·`tools/remember-pull/run.js` — 받는 화면을 새 주소로 연다. 확장은 옛 주소 탭도 계속 찾는다(2027-02-15 무렵 뺀다). 이미 깔린 확장은 `sync-ext.js` 로 디스크에 옮겨야 새 값이 돈다.
- `tests/no-hardcoded-old-erp-url.test.js` — 범위에 뿌리 `*.json`·`fund-erp/static`·`tools/**` 를 더하고(전에는 못 봐서 남았다), 0 이 된 pu-cal·pu-erp 를 허용 목록에서 뺐다. 범위가 다시 줄면 실패하게 했다.
- `tests/hana-apk-reach.test.js` — file:// 때의 «올려 둔 곳»을 옛 도메인으로 박아 두었던 것을 `functions/erp-origins.js` 의 `ERP_LINK_BASE` 와 견주게 바꿈.
- `docs/규칙/ERP-주소.md` — 콘솔 등록 자리에 App Check 키·동의 화면 링크, 검사 범위.

## 고친 것 (콘솔, 코드 밖)
- 구글 OAuth 동의 화면(tactile-timer «My First Project» › 브랜딩): 홈페이지·개인정보처리방침·약관 링크가 없어진 `pureun-erp.netlify.app`(404) → `https://erp.pureunlabor.co.kr`·`/policy/privacy.html`·`/policy/terms.html`. 저장 뒤 다시 읽어 확인. 승인 도메인은 그대로 둠. 로그인 돌아올 주소 목록에 netlify 는 없다(가로채기 위험 없음).

## 검사
- 바꾼 파일을 읽는 검사 655개 파일 6,713건 통과. 고장넣기 2가지(앱 설명 파일에 옛 주소 되돌리기 · 검사 범위에서 tools 빼기) 모두 실패로 잡힘.
