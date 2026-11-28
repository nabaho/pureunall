# 2026-11-28 · feat/kcareer-scan-import — 경력관리 «📥 스캔 가져오기»

대표 지시: 「경력 관리 앱 스캔하면 가져오기도 만들어줘」

## 한 일
- 사무실 복합기 → 대표 PC 바탕화면 `Scan` → PC 의 «푸른 스캔 도우미»(저장소 밖, `%LOCALAPPDATA%\PureunScan`)가
  글자를 읽어 이름을 짓고 대표 경력 서류면 `Scan\경력관리_권형하\<갈래>\` 에 한 벌 둔다.
- 경력관리 홈에 «📥 스캔 가져오기» 띠: 폴더를 한 번 지정(읽기 전용) → 「가져오기」를 누르면 새 서류만 갈래마다
  **이미 있는 OCR 등록 길(`ocrDrop`)** 로 넣는다(끌어다 놓기와 같은 판독·같은 중복 막이). 경력증명서는 서류 보관함
  보관 창(`openDocSaveModal('certdoc','existing')`)을 한 건씩 띄운다.
- 갈래→쪽: 위촉·위임→위촉장 · 자격·수료·표창→자격증/수료증/표창 · 실적→기타/강의/컨설팅 · 회의→비용관리 (`js/kcareer-scaninbox.js`)
- 가져온 것은 이 브라우저 localStorage(`cm3_scaninbox_known`)에만 적는다. 폴더 파일은 고치거나 지우지 않는다.

## 일부러 안 한 것
- 저절로 넣기: 폴더 권한은 «누른 순간»에만 묻고, 넣는 일은 AI 판독·실제 저장이라 단추로만.
- 새 저장 길·DB 경로·보안규칙 변경 없음(온톨로지 writeContracts 그대로).

## 검사
- `tests/kcareer-scaninbox.test.js` — 갈래 이름 약속·쪽 매핑·읽기 전용·판독 확인 전 «가져옴» 금지·폰 숨김
- 화면: `node tools/phone-audit/run.mjs career --widths=1366,375` 로 홈 띠가 한 줄로 그려지는 것 확인
