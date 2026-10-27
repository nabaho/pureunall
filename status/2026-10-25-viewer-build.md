상태: 1판 완료 (포털 타일만 보류)

# 푸른 문서뷰어 1판 — 폰·PC 에서 한글·PDF·엑셀 «보기만» (2026-10-25)

대표 「폰용 문서 뷰어 설계해 줘」 → 설계(`docs/폰-문서뷰어-설계.md`) → 「추천대로」.
결정: PPT 는 글·그림 근사(2판) · 최근 파일은 이름만 · 포털 타일 + 독립 설치. (아이폰·사용 범위는 추천이 없어 «아이폰은 파일 열기 · 직원 누구나»로 가정)

## 한 것
- `pu-viewer.html` — 첫 화면(📂 파일 열기 · 최근 연 파일 ☐+번호) · 보는 화면(머리 한 줄 · 쪽 이동) · PC 끌어다 놓기 · 연결 프로그램(`launchQueue`) · 공유받기.
- `pu-viewer-frame.html` + `js/pu-viewer-render.js` — **격리된 칸**(`sandbox="allow-scripts"`, CSP `default-src 'none'`). 한글(공용 엔진 `PureunHwp.openDoc`, 쪽마다 «보일 때만» 그림) · PDF(pdf.js, `isEvalSupported:false`) · 엑셀(앞 500줄 + 더 보기).
- `js/pu-viewer-kind.js` — **파일 서명으로** 형식 가리기(확장자를 속여도 속지 않는다) · 크기 한도.
- `js/pu-viewer-recent.js` — 최근 목록은 이름·크기·형식·때만. 내용은 안 담는다.
- `pu-sw.js` — 공유받기 한 갈래(`/pu-viewer.html`, 칸 이름 `docs`, IndexedDB `pu-viewer-share`; 화면이 꺼내면서 «바로 지운다»).
- `pu-viewer-manifest.json`(share_target · file_handlers) · `icon-viewer-192/512.png`(`scripts/make-viewer-icon.js`).
- `js/pu-ontology.js` `EXCLUDED_SCREENS` 에 두 화면(사유 포함).
- 검사 3개 34건: `tests/pu-viewer-kind|recent|isolation.test.js` — 고장 10가지를 넣어 모두 잡는 것을 확인했다(sandbox 풀기·외부 fetch·CSP 외부·CDN 복구·pdf eval·innerHTML·공유 안 지우기·내용 칸·메시지 출처).

## 확인한 것
- 진짜 Chromium(411px)에서 hwpx·pdf·xlsx·xls·csv 를 그렸다. 바깥으로 나간 요청 0 · 콘솔 오류 0. PDF 30쪽에서 캔버스 2장만 살아 있다(멀어지면 비움).
- **진짜 폰에서는 아직 안 재 봤다** — 폰 글꼴·9.9MB 한글 엔진 첫 로딩·수만 줄 엑셀.

## 알려진 한계 (설계서 11절)
- 서비스워커가 캐시를 안 둔다 → **오프라인 약속 안 함**(공용 `pu-sw.js` 의 «캐시 없음» 원칙).
- SheetJS 0.18.5 는 알려진 보안 약점이 있는 옛 판 — 격리 칸에 갇히지만 판 올리기는 따로(다른 앱도 이 파일을 쓴다).
- pdf.js 한글 글꼴 지도가 없어 글꼴을 안 심은 한글 PDF 는 글자가 안 나올 수 있다.
- 워드(docx)·파워포인트(pptx)는 «다음 판» 안내만 한다.

## 남은 일 (대표 결정)
- **포털 타일**: 등록부가 «저장 자리 없는 프로그램»을 받도록 규칙(`ontology-contract` 의 primaryRoots 요구)을 고칠지 — 고치면 타일 + 공용 앱바·로그아웃 화면·내 자리 표시를 붙인다. 아니면 독립 설치 앱으로만.
- 2판: PPTX(㉮ jszip 으로 슬라이드 글·그림) · DOCX(kordoc).
