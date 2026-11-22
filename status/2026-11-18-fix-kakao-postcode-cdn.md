# 2026-11-18 카카오 우편번호 CDN 도메인 전환 (`t1.daumcdn.net` → `t1.kakaocdn.net`)

## 배경 및 원인
- 카카오 우편번호 서비스(`kakao-postcode` 공지 #1562)에서 기존 `t1.daumcdn.net` 도메인을 **2026년 11월 30일**까지만 유지하고 12월 1일 이후 종료한다고 안내함에 따라, 주소 검색 창 상단에 도메인 종료 경고 배너가 노출되고 종료 후에는 스크립트·리소스 다운로드 실패로 주소 검색이 중단될 위험이 있었음.

## 변경 사항
1. **우편번호 스크립트 CDN 주소 전환 (`t1.kakaocdn.net`)**
   - `pu-erp.html`, `fund.html`, `kcareer.html`, `pu-cards.html` 네 곳의 `postcode.v2.js` 주소를 `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` 로 변경 (카카오 API 자체 파라미터 검증 `_validParam_` 규칙에 따라 쿼리 스트링 미부착 유지).
   - 홈페이지 약도(`ssl.daumcdn.net/.../roughmapLoader.js`)는 종료 대상(`t1.daumcdn.net`)이 아니며 내부적으로 이미 `t1.kakaocdn.net` 을 바라보고 있어 현행 유지, 폰 감사 허용 호스트(`tools/phone-audit/run.mjs`)에도 `t1.kakaocdn.net` 이 이미 등록돼 있음을 확인.
2. **검사 보강**
   - `tests/kcareer-firm-ocr.test.js`: 부팅 시 우편번호 스크립트 즉시 적재를 막는 검사가 `daumcdn` 뿐만 아니라 `postcode.v2.js` 태그 자체도 함께 잡도록 보강.
   - `tests/postcode-cdn-domain.test.js` 신설: 실행 코드 전반에서 종료 대상 도메인(`t1.daumcdn.net`, `spi.maps.daum.net`, `i1.daumcdn.net`, `s1.daumcdn.net`) 재유입과 `postcode.v2.js` 쿼리 파라미터 부착을 차단.
   - `fund-erp/STATUS.md` 변경 로그 갱신.

## 검증
- `node --test tests/postcode-cdn-domain.test.js tests/kcareer-firm-ocr.test.js tests/test-pin-guard.test.js` 및 전체 테스트 스위트 실행 확인.
