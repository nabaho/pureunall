상태: 완료
가지: fix/pkg-pill-erp-cors
작업폴더: C:/Users/fair0/Documents/pu-wt-pkg-fix

## 무엇을 했나
대표가 건넨 「수정본 패키지」(파일 통째 사본 7개)를 검토해, 고친 줄만 골라 최신 main(91813c53)에 손으로 옮겼다.
패키지는 f7d3bf98(#2920, 11-03 저녁) 기준 사본이라 **통째로 덮으면** 0cc38c73(#2921)의
`exports.govApplicationRead`(functions/index.js)·`pu-ontology.js?v=90`(pu-erp.html·rules.html)이 사라지고
enter.html 줄끝이 CRLF→LF 로 바뀐다(6,500줄 diff). 그래서 덮지 않았다.

| # | 파일 | 바꾼 것 | 까닭(실측) |
|---|---|---|---|
| 1 | enter.html | 접힌 칩의 `.tile-soon-pill` 을 칩 오른쪽 위 귀퉁이에 띄움(`position:absolute;right:6px;top:-7px`) + `.tx{min-width:0;overflow:hidden}` | 430px·920px 에서 「급여아웃소싱」 준비중 딱지가 칩 밖으로 12~14px 튀어나왔다(430px 은 화면 밖). 고친 뒤 둘 다 칩 안, 칩 높이는 그대로(폰 30px·PC 34px) |
| 5 | css/pu-erp.css + pu-erp.html `?v=40` | 480px 아래 공용 규칙 `[style*="display: flex"][style*="gap"]{flex-wrap:wrap}` 에서 `flex-direction: column` 상자는 `nowrap` | 세로 상자에 wrap 이 걸리면 여러 줄 상자가 되어 카드 폭이 «가장 긴 글자»가 된다 — 360px 에서 카드 386px·가로 스크롤. 고친 뒤 350px·스크롤 없음 |
| 6 | rules.html | `vendor/xlsx.full.min.js`·`pako.min.js`·`pdf.min.js` 에 `?v=1`, `xlsx_gen.js?v=3→15` | 다른 화면(payroll-os·pu-news `xlsx_gen.js?v=15`, gov-report·pu-cards vendor `?v=1`)과 맞춤 |
| 7 | functions/index.js | `rehabAuto` 의 `Access-Control-Allow-Origin: *` 를 공용 `setCors(req,res)` 로 | 회생광고 화면(rehab-ad.html)은 nabaho.github.io 에서만 부른다. 다른 발송 창구와 같은 문 |

**넣지 않은 것**: 칩 `min-height:34px/32px`(지금도 높이가 고르고 폰만 2px 길어짐) · 쉼표 줄바꿈(동작 같음) ·
`.portal{padding-bottom:112px}`(지금도 📷와 30px 떨어져 가림 재현 안 됨 — 대표 선택으로 뺌).

## 검사
- 전체 `node --test tests/*.test.js functions/*.test.js`(60개 묶음, 2026-11-05): 28,867건 중 통과 28,804 · 실패 0 · 건너뜀 63.
- `node scripts/check-cache-version.js --all` 통과, `node --check functions/index.js` 통과.
- 헤드리스 Edge 로 실제 enter.html `<style>`·실제 pu-erp.css 를 실어 위 표의 수치를 전/후 다시 쟀다(목업은 저장소에 안 둠).

## 남은 일
- `rehabAuto` 는 **함수 이름을 지정해** 배포해야 바뀐다(`--only functions:rehabAuto`) — 대표 승인 대기.
- 패키지의 8번: 홈페이지 저장소(pureun-site) `sitemap.xml` 에 `notice/140`(2026-11-02)이 빠져 있다.
  pureunall `site/sitemap.xml` 에는 있다(5e5cbc26). 그쪽 저장소에 올리는 것은 대표 승인 대기.
  근본: 매주 공지 자동 올리기가 pureun-site 사이트맵을 안 고쳐서 새 공지마다 다시 빠진다 — 따로 고칠 일.
