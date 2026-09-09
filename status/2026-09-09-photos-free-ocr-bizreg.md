# 2026-09-09 · 사진첩 — 사업자등록증 무료 판독

- PR: (열기 전)
- 무엇: 사진첩이 **사업자등록증만** AI 없이 먼저 읽는다. 제목(사업자등록증·고유번호증)과
  국세청 체크섬을 통과한 사업자등록번호가 **둘 다** 있을 때만 열리고, 하나라도 없으면
  지금처럼 AI(Gemini)로 간다. 글자는 Vision(월 1,000장 0원) → 안 되면 브라우저(Tesseract,
  무한·0원) 순으로 얻는다.
- 왜: 대표 물음 「ocr을 무료로 사용할 수 있는곳이 더 있나?」 →
  목업 `docs/mockups/photos-free-ocr-bizreg.html` 승인(「1추천대로, 2 자동보낸다. 3 추천대로」):
  ①㉮ 사업자등록증만 · ②㉯ 자동으로 기업 상세에 보낸다 · ③㉮ Vision 먼저.
- 판독 층(`js/pu-doc-read.js`)에 `bizregParse`·`bizregFields`·`bizregTitle`·`bizregNo`·
  `bizregLooks`·`browserRead`·`browserText`·`freeRead` 를 새로 두었다. 푸른이알피의
  `parseBizLicense`·`ocrWithTesseract`·`loadTesseract`·`preprocessImage`(도합 240줄)를
  거기로 «옮기고» 원래 자리엔 그 함수를 부르는 한 줄만 남겼다 — 사업자등록증을
  앱마다 다르게 읽지 않게. **푸른이알피가 그동안 판독 층(`js/pu-doc-read.js`)을
  안 싣고 있었다**(2026-09-08 확인) — `pu-erp.html:13845` 의 `PuDocRead.mapTo` 가
  조용히 헛돌고 있었다. 이번에 `?v=37` 로 실었다.
- 서버(`functions/index.js`·`doc-read.js`): Vision 무료 몫(달마다 1,000장)을 **부르기 전에**
  본다. 넘길 판이면 429 로 「브라우저 판독으로 대신합니다」라 답하고 실제로 안 부른다.
  셈을 못 읽었을 때도 안 부른다(모르는 채로 유료 구간에 들어가면 안 된다).
- 화면: 결과 칸에 파란 「0원」 딱지(비면 「N칸 비었음」+못 읽은 칸 나열),
  「🤖 AI 로 더 자세히 읽기」 단추(누르면 무료 길을 건너뛰고 곧장 AI),
  설정에 켜고 끄는 스위치 + 이달 Vision 셈. 판독 띠에 「· 무료 N장」을 곁들였다
  (긴 설명은 title 로).
- ⚠ 남긴 함정: 「법인명(단체명)」처럼 이름표가 겹으로 오면 한 겹만 걷으면 상호에
  찌꺼기가 남는다 — 없어질 때까지 걷어야 한다. 국세청 체크섬(`[1,3,7,1,3,7,1,3,5]`)을
  두 파일에 나란히 두면 검사(`co-bizno-audit.test.js`)가 깨진다 — 판독용은 판독 층
  하나, 입력창 테두리색용(`window.bizNoChecksum`)은 그대로 둔다.
- 검사: `tests/photos-free-ocr.test.js`(21) · `tests/free-ocr-month-cap.test.js`(11) 새로,
  `read-fence-apps`·`photos-mask-fence`·`photos-pdf-text-read`·`photos-rrn-mask`·
  `vision-proxy` 다섯을 새 길에 맞춰 고쳤다(값이 아니라 규칙을 다시 겨눔).
  뮤테이션 9/9 잡음. 전체 스위트 그린(윈도우 전용 기존 결함 `rc-open` 하나만 예외).
