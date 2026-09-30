# 경력관리 — 서류 만들기 「← 목록으로」 (2026-09-30)

- 입력 화면 왼쪽 기둥 맨 위에 「← 목록으로」 — 누르면 작성 중에 담고 나와 작성 중 목록을 연다(방금 줄에 「방금 담음」).
- ▾ › 「저장 안 하고 나가기」 — 한 번 묻고(kcAskDelete), 담지 않고 치운다. 마지막으로 담은 것은 목록에 남는다.
- 브라우저 뒤로(마우스 뒤로·Alt+←)도 같다 — 공용 js/pu-back.js 의 파수꾼(rhBackGuard)으로 단다.
  ⚠ history 를 따로 굴리면 pu-back 과 겹쳐 앱 밖으로 나간다(시험에서 실제로 나갔다).
- rhCloseDoc(o) — silent·nosave 선택, 치울 때 작업 모드도 푼다(안 풀면 위 줄이 감춰진 채였다).
- 검사: tests/kcareer-back-to-list.test.js · kcareer-formmap-ui 의 글자 수 자르기를 rc-actions 기준으로.
