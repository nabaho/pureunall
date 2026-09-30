# 경력관리 — 입력 화면의 「작성 중 서류 보기」는 떠 있는 창 (2026-09-30)

- 대표 지적: 작성 중 서류 보기를 누르면 목록이 위에 펼쳐져 편집 화면이 밀려 내려간다 → 목업 A(떠 있는 창) 승인.
- 작업 모드(body.rh-work-on)에서 rhDraftShow → rhDraftFloatOpen: 같은 #rhDraftPanel 을 position:fixed 로 띄운다(기능 그대로).
- Esc·바깥 누름·이어서·작업 모드 끝에 닫힌다. 버리기 확인(#kcDelPop)·되살리기(#kcUndo)는 바깥으로 치지 않는다.
- 목록 화면에서는 예전처럼 위에 펼친다.
- 검사: tests/kcareer-draft-float.test.js
