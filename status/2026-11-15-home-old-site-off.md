# 2026-11-15 · ERP 홈페이지 화면 — 옛 홈페이지(푸른노무법인.kr) 의존 끊기 (claude/home-old-site-off)

- 대표 결정 「푸른노무법인.kr 더이상 연장 안한다」(2026-11-27 만료) → 「옛 홈페이지 연결 정리 … 여기서 진행」.
- 스위치 둘(함께 바꾼다): 화면 `pu-home.html` `OLD_SITE_OFF = true` · 서버 `functions/homepage-fetch.js` `OLD_SITE_CLOSED = true`.

## 서버 — 옛 사이트로 «요청 자체»를 안 보낸다
- `홈부르기`·`홈로그인`·`홈자동정찰` 맨 앞에서 멈춘다 → 관리자 아이디·비밀번호가 만료 도메인(남이 다시 살 수 있음)으로 갈 길이 없다.
- `readHomepage`·`homepageWrite` — 재직 확인 뒤, 나가기·비밀값 꺼내기 «전»에 410(접음).
- `홈자동한번` — 옛 게시판 일(돌기·내리기·올리기·정찰) 통째로 건너뜀. 매달(`monthlyHomepageAuto`)의 «새 사이트 재게시»는 그대로 돈다(`config.off` 안 씀).
- ⚠ 서버 함수는 합쳐도 저절로 배포되지 않는다 — Actions 「Firebase 배포」 수동 실행: `readHomepage,homepageWrite,homepageAuto,monthlyHomepageAuto`. **12-01 08:00 매달 실행 전에** 올려야 옛 로그인을 안 한다.

## 화면 — 읽기·반영을 새 사이트로, 옛 전용 단추는 숨김
- 읽기(「다시 확인」·쪽 읽어오기) → 새 사이트 원본(SITE_BASE raw). 2026-11-15 견줘 보니 구성원 7명·글 번호·경력 24줄, 쪽 8개 글자·고칠 줄이 옛 사이트와 같게 읽혔다.
- 「저장하고 반영」 → `publishPeople`(구성원 쪽 다시 만들어 올림 — 먼저 보여 주고 묻는다). `homepageWrite` 안 부름.
- 쪽 고친 줄: 「홈페이지에 올리기」가 파란 단추, 옛 「채우기용 복사」 숨김. 좌우 두 칸·미리보기 바탕 = 우리 사본(site/ — text/css 로 옴. raw 는 text/plain 이라 꾸밈이 안 붙음).
- 보기 링크(사이트 열기·자문사 홈페이지 열기·이 쪽 열기) → `SITE_VIEW`(pureunlabor.co.kr).
- 숨김(지우지 않음): 사진 바꾸기·여러 장, 자동 연결 카드, 새로 올리기(구성원·자문사), 로고와 잇기, 비상용 복사, 관리자 화면에서 열기, 칸 살펴보기, 내리기(휴지통), 채우기 단추 넣기, 옛 자동 연결 할 일 넷, 화면 열 때 저절로 정찰.
- 퇴사자 할 일 → 「구성원 쪽 다시 올리기」(publishPeople)로.
- 함수 안에서는 `typeof OLD_SITE_OFF !== 'undefined' && OLD_SITE_OFF === true` 로 읽는다 — 검사 상자에 상수가 없으면 통째로 죽는다(첫 판에서 46건이 그렇게 죽었다). 상자 안에서는 옛 동작 그대로 = 대조군.

## 검사
- 새 `tests/home-old-site-off.test.js` 13건(서버 함수를 떠 돌려 요청 0건·비밀값 0회·돌기 0회, 화면 함수를 상자에서 돌려 새 길/옛 길 대조) + `tests/pu-home-screen.test.js` 5건(할 일·쪽 단추·줄 치는 길·📷 여러 장).
- 고장넣기 14가지(1차 11 + 검토 뒤 3) 모두 잡힘 → 원복. 전체 검사 30,058건 실패 0(검토 뒤 고침 전 기준 — 고친 뒤 관련 검사 180건 다시 통과).
- 화면: 가짜 파이어베이스(tools/phone-audit) + 지어낸 자료로 PC 1366·폰 360 확인 — 옆 넘침 없음(잘림 상자 안 개수 딱지 하나는 main 에서도 같음).

## 자동 검토(ow review) — 1차 «실패» → 고침 → 재검증
- 기능(antigravity gemini): 높음 1 — 접은 뒤 쪽 줄을 «칠 때»(다시 안 그리고 #pfixBtn 글만 갈아 끼우는 길) 올리기 단추가 안 나오고
  눌러도 안 되는 옛 복사 문구가 떴다(처음 화면에 올리기 단추를 안 그려 둔 탓). → 고친 줄 0 이어도 잠근 채 늘 그리고,
  pageRunEdit 가 접음이면 「홈페이지에 올리기 (N줄)」로 갈아 끼움. 중간 1 — 목록 머리 「📷 여러 장」 안 숨김 → 숨김.
  둘 다 검사 추가(치는 길을 상자에서 돌림) + 고장넣기 3 잡힘 + 실제 화면에서 글을 쳐서 확인.
  ⚠ 1차 때 화면 확인을 `App.render()` 를 손으로 불러 했기 때문에 «치는 길»을 놓쳤다 — 화면 확인은 «사람이 하는 그대로»(실제 입력) 할 것.
- 보안(antigravity claude-opus): 높음 0. 중간 1 은 «기존» — 미리보기 iframe(srcdoc·sandbox 없음)·openPreviewWindow(document.write)가
  쪽 HTML 의 script 를 ERP 출처에서 돌린다. 이번에 바탕이 같은 출처 사본으로 바뀌어 만료 도메인 위험은 줄었다. 이 PR 범위 밖 — 남은 일.
  낮음: HOME_ADMIN_ID/PW secrets 바인딩 떼기(11-27 뒤) · PuHomeExport.ORIGIN/editUrl 을 접음일 때 한곳에서 막기(지금은 숨김 가드에만 기댐).

## 남은 일(이 PR 밖)
- 미리보기 iframe 에 sandbox(allow-same-origin, allow-scripts 없음) 또는 script 걷기 — 보안 검토 «중간·기존».
- PuHomeExport.ORIGIN·editUrl 을 접음일 때 빈 값/SITE_VIEW 로 — 숨김 가드가 하나라도 풀리면 다시 산 도메인의 가짜 관리자 화면으로 갈 수 있다(낮음).
- 안내 문구 몇 곳이 숨긴 옛 단추를 아직 가리킨다(memberBandHtml·partnerEdit·pagePasteWhy·pageEdit 머리 — 낮음).
- 새 사이트용: 얼굴 사진 올리기 · 글 번호 없는 새 노무사 넣기 · 계약 끝난 자문사 로고 저절로 숨기기.
- 11-27 뒤 서버 비밀값 `HOME_ADMIN_ID/PW` 지우거나 바꾸기(대표 결정).
