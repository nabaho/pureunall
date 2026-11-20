# 2026-11-18 — 인사관리(급여명세서·연차촉진·증명서) 발신 도메인을 새 법인 공식 도메인(`payroll@pureunlabor.co.kr`)으로 전환

## 한 일
1. **Resend 도메인 등록 및 가비아 DNS 발송 인증 반영 (`pureunlabor.co.kr`)**:
   - Resend(`Tokyo ap-northeast-1`)에 `pureunlabor.co.kr`을 추가하고 기존 발송 키(`All domains`) 범위를 확인했다.
   - 가비아 DNS(`pureunlabor.co.kr`)의 기존 홈페이지·ERP 레코드(`A @` 4개, `CNAME www`, `CNAME erp`, `TXT _github-pages-challenge-nabaho`, `TXT @` `v=spf1 -all`)는 그대로 유지하고 다음 4줄을 반영했다:
     - 신규 추가: `TXT resend._domainkey` (DKIM 공개키), `CNAME rsend` → `rsend-apne1.forge.rmta.net.`, `CNAME send` → `send.forge.rmta.net.`
     - 수정: `TXT _dmarc` → `v=DMARC1; p=none; adkim=r; aspf=r` (하위 도메인 반송 경로 `rsend`/`send`와의 SPF 정렬 허용)
   - 공개 DNS(`8.8.8.8`) 전파 및 Resend `rsend`·`send` 검증 완료 확인.
2. **서버 `sendPayslip` 발신 주소 전환 및 회신 유지 (`functions/index.js`)**:
   - 기본 발신 주소(`FROM`)를 `푸른노무법인 <payroll@pureunlabor.co.kr>`로 전환했다(급여명세서·연차 사용촉진·재직/경력증명서·급여OS 일괄 적용).
   - `pureunlabor.co.kr`에는 아직 수신 사서함(`MX`)을 연동하지 않았으므로, 근로자가 회신을 눌렀을 때 반송되지 않도록 회신 주소(`REPLY_TO`)는 실제 수신 중인 공용함(`370-6@daum.net`)을 그대로 유지했다.
   - DNS 최종 검증 전파 과도기에 Resend가 도메인 미인증 오류를 반환할 때만 기존 인증 도메인(`푸른노무법인 <payroll@fairrunlabor.com>`)으로 1회 자동 폴백해 발송 중단이 없도록 보호했다.
3. **규칙 문서 및 안전 검사 갱신**:
   - `docs/규칙/ERP-주소.md` 메일 도메인 표 갱신.
   - `tests/payslip-send-token.test.js` 발신 도메인(`payroll@pureunlabor.co.kr`)·과도기 예비 도메인·미연동 수신 도메인 회신 금지 검증 보강.

## 검증
- `node --check functions/index.js` 통과
- `node --test tests/payslip-send.test.js tests/payslip-send-token.test.js tests/test-pin-guard.test.js tests/antigravity-rules.test.js tests/no-hardcoded-old-erp-url.test.js tests/erp-origins-dual.test.js tests/erp-dual-origin.test.js tests/erp-move-finish.test.js` 통과 (`63/63`)
- `node scripts/erp-integrity-audit.js` 통과 (`blockerCount: 0`)
