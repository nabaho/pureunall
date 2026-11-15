상태: 끝남(PR 합쳐진 뒤 서버 함수 배포 없음 — 화면 파일만)
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall\.claude\worktrees\mail-hwp-preview
가지: fix/mail-hwp-preview

# 📧 푸른메일함 — 첨부 미리보기 «한글(.hwp·.hwpx) 양식 그대로 그리기» + «PDF 고해상도·윗부분 잘림 보정» (대표 지시 2026-11-11)

지시 원문: 「푸른메일함인데 미리보기 화면 이상하다 한글 양식으로 제대로 보이던가 아니면 피디에프로 제대로 보이게 해야할것 같다.」

## ① 왜 깨져 보였나
- 기존 메일 첨부 미리보기(`mbPvDraw`)는 `.hwp`·`.hwpx` 파일도 워드(`.docx`·`.doc`)와 함께 `extractDocText` 로 **글자만 뽑아 `<pre>` 에 줄글로 부었다**(`글자만 뽑아 보여 드립니다(모양은 다릅니다)`).
- 동의서·신청서·계약서처럼 **표·체크박스(`□`/`☑`)·서명란**이 든 한글 양식은 칸마다 한 줄씩 세로로 흩어져 모양을 알아볼 수 없었다.

## ② 어떻게 고쳤나
- **공용 한글 엔진(`js/pu-hwp-engine.js` · `vendor/rhwp-core` WASM)으로 쪽마다 `<canvas>` 에 종이 모양 그대로 그린다** (`mbPvDraw` · `mbPvHwpDraw` · `mbPvHtml`).
  - `pu-cards.html` 은 이미 `js/pu-hwp-engine.js`(`PureunHwp`)를 싣고 있었으므로 새 외부 라이브러리·서버 변환 없이 저장소 안 WASM 사본(`cdnBase: '', coreUrl: 'vendor/rhwp-core/rhwp.js'`)만 쓴다(바깥 CDN 요청 0건, 문서 안 스크립트·매크로 실행 없음, 배포용 한글도 열림).
  - **확장자·바이트 어긋남 방어**: 메일 첨부는 속이 HWPX(`PK`)인데 이름만 `.hwp` 로 붙어 오거나 긴 이름 때문에 확장자가 잘리는 일이 잦다. `PureunHwp.detectFormat(buf)` 으로 바이트 머릿글을 먼저 확인해 `'document.' + hwpFmt` 로 열어 어긋남 오류를 막고, 가짜 확장자 파일은 거른다.
  - **사본 전달**: 받아 둔 첨부 바이트(`_mbAttBuf`)가 WASM 쪽에서 분리되지 않게 `buf.slice()` 사본을 넘긴다(두 번째 미리보기도 그대로 열린다).
  - **여러 쪽·폰 메모리 보호**: `#mbPvHwp` 안에 A4 쪽 상자(`.pvhwp-pg`)를 세로로 놓고 `IntersectionObserver`(`rootMargin: '1200px 0px'`)로 화면 근처 쪽만 고해상도(`devicePixelRatio` 최대 2배·8M 픽셀 상한)로 그리며, 스크롤 위치와 아래쪽 `◀ 1 / N ▶` 쪽 넘김 단추(`mbPvPage`)를 양방향으로 맞춘다.
  - **마우스 올려 미리 준비(`mbPvLibsFor`)**: `.hwp`·`.hwpx` 는 무거운 `xlsx.full.min.js`(900KB) 대신 `PureunHwp.loadCore` 로 WASM 엔진만 미리 깨운다(`js/pu-hwp-engine.js` 에 `loadCore` 내보내기 추가, `?v=22`).
  - **폴백 유지**: 엔진이 열지 못하는 아주 옛 형식(한글 3.0 등)·손상본과 워드(`.docx`·`.doc`·`.odt`·`.rtf`)는 기존 `extractDocText` 글자 추출로 조용히 물러난다.
  - **WASM 메모리·관찰기·픽셀 상한·접근성 보호(`mbPvRelease` / `mbPvReset` / `mbPvAfter`)**:
    - 미리보기 창 닫기(`mbPvClose`), 다른 첨부 열기(`mbAttPeek`), 닫은 뒤 늦게 도착한 응답(`_mbPvSeq` 토큰 대조), `openDoc` 이후 `pageCount`·`getPageInfo` 예외, 어느 쪽이든 캔버스 그리기 예외(한글·PDF 공통), 다른 메일 열기(`openMailMsg`), 메일 목록으로 나가기(`mbBack`)에서 모두 `doc.free()` / `pdf.destroy()` 와 관찰기를 해제하고, 그리기 실패 시 빈 종이 대신 오류 안내를 띄운다.
    - 비정상적으로 큰 쪽 치수(예: `100000×100000`)가 들어와도 배율을 자동으로 낮춰 캔버스 픽셀 수가 `8M`(`8,388,608`) 상한을 절대 넘지 않게 방어했다(한글·PDF 공통).
    - 미리보기 대화상자에 `role="dialog" aria-modal="true"`, 쪽·닫기 `aria-label` 및 32×32 누름 영역, WCAG AA 명도 대비(`#475569` 대 `#e8edf3`), 포커스 이동·가두기·재렌더링 뒤 원래 `[미리보기]` 단추 복귀, `Escape` 닫기를 붙였다.
- **PDF 미리보기도 전체 쪽 연속 스크롤 + 상단 잘림 완전 제거로 맞췄다** (`mbPvDraw` · `mbPvPdfDraw` · `mbPvHtml` · `.pvstage`, 2026-11-13 추가 보강):
  - 기존 PDF 미리보기(`mbPvPdfDraw`)는 한 번에 1쪽만 그려 `1 / 19` 문서에서 `▶`를 19번 눌러야 했고, `.pvstage` 의 `align-items:center` 때문에 세로로 긴 용지 윗부분이 잘려 스크롤을 맨 위로 올려도 제목·윗줄이 보이지 않았다.
  - 한글과 똑같이 `#mbPvPdf.pvhwp` 안에 **전체 쪽(`1 ~ N`쪽)을 한 번에 세로로 이어 펼쳐** 스크롤만으로 처음부터 끝까지 끊김 없이 읽을 수 있게 바꿨고, `IntersectionObserver`(`rootMargin: '2400px 0px'`) + 현재·이웃 쪽 유지 보호(`|idx - cur| <= 1`)로 긴 문서에서도 폰·브라우저 메모리 한도(`8M` 픽셀 상한)를 넘지 않게 했다.
  - `.pvstage` 에 팔레트 승인 배경(`#e2e8f0`), `align-items:flex-start`, `min-height:0` 을 적용하고 `.mck.pvbox` 높이를 `90vh`(`max-height:92vh`)로 확보해 어느 화면 크기에서도 1쪽 맨 윗줄부터 마지막 쪽 맨 아랫줄까지 잘림 없이 보이도록 고쳤다.
  - `js/pu-hwp-engine.js?v=22` 캐시 번호를 이를 불러 쓰는 전체 10개 HTML 화면에 일괄 동기화했다.
- 기존 메일 미리보기 하단 기능(`→ 급여데이터함`, `→ 기업별 계약서`, `📥 내려받기`, `닫기`)은 그대로 유지했다.

## 검사
- 새 검사 `tests/mail-att-preview-hwp.test.js` 12건 추가 + 고장넣기(변이 3곳: ① `mbPvClose` 에서 `mbPvRelease` 누락 ② 확장자 그대로 `openDoc` 전달 ③ 원본 버퍼 그대로 전달) 모두 검사가 잡아냄 확인.
- 메일·한글·기업정보함·폰 화면·핀 가드 묶음 검사: 6,642건 중 통과 6,639 · 건너뜀 3 · **실패 0**, `tests/test-pin-guard.test.js` **10 통과 / 0 실패**.
- 헤드리스 Chrome 실제 렌더링 점검(가짜 파이어베이스 + 지어낸 동의서 양식 표·체크박스 2쪽 문서):
  - PC `1366×864` (`dpr=2`): `157KB · 한글 양식 2쪽`, 캔버스 `1761×2490` 픽셀 그림 확인(`inkSamples: 15339`), 상단 잘림 `false`, 가로 넘침 `false`, `◀ 1 / 2 ▶` 다음 쪽 이동 및 닫기 시 `doc.free()` 호출 확인, 외부 CDN 요청 `0`.
  - 폰 `375×812` (`dpr=2`): 캔버스 `655×925`, `tools/phone-audit/measure.js` 기준 `overflowX: 0 · offscreenN: 0 · verticalN: 0 · squeezedN: 0 · wrapBtnN: 0`.
- 진짜 서버·진짜 자료는 건드리지 않았다. 서버 함수 변경 없음.

## 남은 일
- [ ] 대표 확인: 실제 받은메일함의 한글 양식 첨부(`(양식)전문가 풀 참여 동의서.hwp` 등)에서 `[미리보기]` 를 눌렀을 때 표·체크박스·쪽 넘김이 원하는 모양으로 잘 보이는지 확인.
