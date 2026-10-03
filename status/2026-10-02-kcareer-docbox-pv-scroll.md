# 경력관리 — 서류 보관함 미리보기: 모든 쪽 · 끌어 내려 보기 (2026-10-02)

- 대표 지시 「미리보기 화면 드레그 내려서 어떻게 되었는지 확인할 수 있게 해라」.
- dsPrevDraw: 첫 장만 → renderPreview 가 그린 모든 쪽을 잇달아 붙인다. 2쪽 이상이면 「N쪽 · 끌어 내려 보기」 딱지.
- .ds-pv-img: overflow 감춤 → 세로로 굴러감(높이 한도는 화면 높이에 맞춤).
- dsPvDragWire: 마우스로 끌어 내린다(3px 이하는 누름) · 문서 손잡이는 한 번만.
- 검사: tests/kcareer-docbox-pvscroll.test.js
