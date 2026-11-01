# 한글 편집기 단축키 연결 (2026-11-01)

가지: `feat/hangul-shortcuts` (origin/main 에서 새로 땀)

## 한 일
- 한/글 도움말(`Hwp.chm` → «단축키 일람»)을 원본으로, 우리 편집기에 있는 기능의 단축키를 모두 연결. 표(`SHORTCUTS`)로 두고 키 처리와 F1 목록이 같은 표를 쓴다.
- 겹글쇠 일반화: Ctrl+N·K·Q·G·M 뒤 1.5초 안에 다음 글쇠(예 Ctrl+K,H 하이퍼링크, Ctrl+M,R 빨강 글자 색, Ctrl+G,P 쪽 맞춤).
- 지우기·커서 이동(Ctrl+E, Ctrl+Y 한 줄 지우기, Alt+Y, 단어 지우기, 문단·화면·문서 이동), F3 블록, 문단 위·아래 이동, 찾기 다시/거꾸로, 찾아가기(Alt+G), 글자 모양(진하게·기울임·밑줄·크기·자간·글꼴·색), 문단 모양(여백·들여쓰기·줄 간격), 표(Alt+방향키, Alt+Insert/Delete, Ctrl+Enter 줄 추가), 보기, 입력, 기타(F1·F10·Shift+F10·F11).
- 한/글과 다른 점: Ctrl+Y 는 «한 줄 지우기»(다시 실행은 Ctrl+Shift+Z). Ctrl+O 는 «불러오기»(한/글은 문서 끼워 넣기).
- 바뀐 파일: `hangul/js/app.js`(v4), `hangul/app.css`(v4), `hangul.html`.

## 추가
- 빠른 내어쓰기(Shift+Tab, 표 안에서는 앞 셀 이동)와 Ctrl+1~0 스타일 적용(스타일 목록 순서; 한/글은 사용자가 지정한 스타일이라 목록 순서는 [확인 필요])도 연결.

## 확인 (폭 1200px 가상 화면, 스크립트로 보낸 글쇠)
Ctrl+Y·Alt+Y·Ctrl+E·Ctrl+Delete·Ctrl+Backspace 지우기, Alt+Shift+↑↓ 문단 이동, F3 3단계 블록, Ctrl+B·Alt+Shift+B, Ctrl+M,R 빨강, Alt+Shift+E·Ctrl+[ 글씨 크기, Ctrl+Shift+G·Ctrl+F6 여백, Alt+Shift+Z 줄 간격, Alt+Space·Ctrl+Shift+- 빈칸·하이픈, Ctrl+K,D 날짜, Ctrl+G,T 문단 부호, Ctrl+G,Q·Shift+Num+ 확대, F1 목록, F6 스타일 메뉴, F10 파일 메뉴, Ctrl+N,T 표 만들기, 표 안 Ctrl+Enter·Alt+→·Alt+Delete, Ctrl+L 찾기.

## 연결하지 못한 것 (편집기에 기능이 없음)
조판 부호, 한자 입력, 상용구, 스크립트 매크로, 차례·색인, 책갈피·상호 참조, 셀 블록 모드 글쇠, 장평, 표 나누기·붙이기, 쉬운 계산식, 단·구역 나누기·감추기.

## [확인 필요]
- 자간 증감 폭(1%), 초록 #00ff00 등 글자 색 값, 고정폭·묶음 빈칸을 같은 문자로 처리한 것은 한/글과 대조하지 못했다.
- 브라우저가 가로채는 Ctrl+N·T·W·Q·Tab 은 «앱으로 설치»한 창에서만 듣는다. 실제 키보드 입력(스크립트가 아닌)은 못 해 봤다.
