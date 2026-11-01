# 한글 편집기 휴대폰 화면 (2026-11-01)

가지: `feat/hangul-mobile-ui` (origin/main 에서 새로 땀)

## 한 일
- 폭 820px 이하에서만 `body.m` 을 켜는 휴대폰 화면을 `hangul/js/mobile.js` 로 추가. 컴퓨터 화면은 그대로.
- 보기(쪽 미리보기, 폭 맞춤·두 손가락 확대·두 번 누르기)가 기본, 상단 한 줄(메뉴·이름·저장·편집)과 하단 한 줄(쪽·확대 / 편집 서식줄), 모든 기능은 아래에서 올라오는 메뉴.
- 대화상자는 아래에서 올라오는 창, 서식 작업 창은 전체 화면, 빈 문서는 시작 화면.
- 리본 단추 중 펼침 목록을 돌려주는 것(표·붙이기·스타일·글자 색)이 눌러도 열리지 않던 오류 수정(`app.js`).
- 바뀐 파일: `hangul.html`(viewport, `mobile.js` 추가, `?v=` 올림), `hangul/app.css`(v2), `hangul/js/app.js`(v2), `hangul/js/editor.js`(v2), `hangul/js/mobile.js`(신규 v1).

## 확인
- 폭 375px 가상 화면, 포털 페이지(`hangul.html`)에서 시작 화면이 뜨고 콘솔 오류 없음.
- 관련 시험 104개 통과(logout-gate, html-inline-script-syntax, ls-guard, pair-guards, pdfjs-no-eval, ontology-registry, appcheck-off, app-soon-gate, authsync-global-logout, logout-why).
- 원본 편집기 프로젝트(`pureun-hangul`)에서는 서식 열기·편집 전환·글 입력·메뉴·대화상자까지 확인.

## 확인 못 한 것
- 실제 휴대폰의 두 손가락 확대, 한글 자판(IME) 입력, 키보드가 올라올 때 배치, 가로 방향.
- 포털의 «즐겨찾기» 옆 탭이 화면 오른쪽에 조금 겹쳐 보임([확인 필요]).

## 배포
푸시·병합은 승인 후.

## 추가 (같은 PR)
- 한글 파일(.hwpx·.hwp·.hwt)을 화면에 끌어다 놓으면 바로 연다(여러 개면 차례로). 끌고 오는 동안 안내 테두리, 다른 파일은 안내 문구. `app.js` v3·`app.css` v3. 가상 끌어놓기로 열림·안내 문구 확인, 실제 탐색기에서 끌기는 [확인 필요].
- `tests/cal-inbox.test.js` «이번 달 AI 요금 한도»: 시험이 10월 키를 박아 두어 11월부터 깨졌다. 코드가 읽는 «지금 달» 경로(`DR.aiMonthPath()`)로 바꿈(코드 변경 없음).
