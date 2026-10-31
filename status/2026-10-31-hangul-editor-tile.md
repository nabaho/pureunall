상태: 완료
작업폴더: C:\Users\fair0\Documents\pu-wt-hangul (브랜치 feat/hangul-editor-tile)

# 한글 편집기를 포털 «의뢰인 업무» 줄에 타일로 넣음 (대표 지시 2026-10-31)

- `hangul.html` + `hangul/` — 한글(.hwp/.hwpx)을 브라우저 안에서 열고 고치고 저장하는 편집기(원본: 바탕화면\한글\pureun-hangul).
  파이어베이스에 쓰지 않는다 — 파일은 이 PC 에서만 열린다.
- `enter.html` APPS · `js/pu-appbar.js` APPS 에 같은 이름의 타일(`hangul`) 추가.
- `js/pu-ontology.js` PROGRAMS 에 `hangul` 등록 — 저장 뿌리가 없어 `localOnly:true` + `note` 로 밝힘.
- 검사 세 곳을 «localOnly 만» 좁게 풀었다: ontology-contract(저장뿌리·읽기 어댑터), ontology-write-gate(전수조사기),
  `js/pu-ontology-write.js` auditProgramContracts(쓰기 계약). localOnly 는 저장뿌리가 비어 있고 note 가 있어야 한다.
- 공용 스크립트를 고쳐 `?v=` 를 올렸다: pu-ontology 81→82, pu-ontology-write 6→7, pu-appbar 36→37.
- 관련 검사 156개 통과. **푸시·배포는 하지 않았다** — GitHub Pages 가 저장소를 통째로 올리므로 합치면 공개된다.
