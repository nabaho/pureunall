# 2026-11-18 · 급여아웃소싱 준비중 해제 · 재직 직원 전원 개방 및 대상 직원 드롭다운 선택·확인 전환

## 대표 지시
- 「급여아웃소싱 준비중을 풀어달라 다른직원이 모두 접근가능하게」 / 「급여아웃소싱 준비중은 실행하기해라」
- 「대상직원선택이 너무 나열되어 있다 드랍탑(드롭다운) 방식으로 사람을 선택하고 확인하는 방식으로」

## 바꾼 것
1. **포털(`enter.html`) · 앱 안쪽 문(`payroll-os.html`) 함께 해제 (짝)**
   - `enter.html` 의 `key:'payroll'`(`급여아웃소싱`) 타일에서 `soon:true` 를 걷어 모든 재직 직원 화면에서 흐림·막힘 없이 바로 실행되게 변경.
   - `payroll-os.html` 의 `PuGate.soonUnlessAdmin('급여아웃소싱')` 을 함께 걷어 주소 직접 진입도 일관되게 개방.
   - 카카오·패스키 로그인처럼 `me.email` 이 비어 있는 재직 직원도 `uid_roles/{uid}.sid` / `PuWhoami` 사번으로 `내 담당` 사업장이 정확히 이어지도록 보강.
2. **대상 직원 선택 UI — 알약 나열 대신 드롭다운(`<select>`) + `✔ 확인` + `◀ 이전 / 다음 ▶` 방식으로 전환**
   - `payroll-os.html` 원본비교(`renderEmpCompareStudio`), 1인 종합카드(`renderEmp360Card`), 퇴직(`screenSever`)에서 직원 수가 많을 때 여러 줄로 늘어지던 알약(`.mpill`) 나열을 걷어내고, 한 줄 드롭다운 선택 + `✔ 확인` 단추 + `◀ 이전 / 다음 ▶` 순차 이동 + 우측 현재 확인 중 요약 배지로 정리(1인 종합카드 하단 중복 선택바도 함께 제거).
3. **파이어베이스 실시간DB 규칙(`payroll_os`) 전 재직 직원(`LOGIN`) 개방 및 콘솔 게시 완료**
   - `scripts/make-firebase-rules.js` 의 `rules.payroll_os` 를 재무·관리자 전용에서 등록된 재직 직원 전원(`LOGIN`, 업무 칸 `workspace`)으로 전환하고 `node scripts/rules-deploy.js --deploy` 로 콘솔 게시 및 재조회 대조 완료(`docs/firebase-rules-콘솔원문-2026-11-18.json`, 사라진 규칙 0).
   - 보호 장치 유지·보강: 상위 묶음 통째 삭제 관리자 전용 · 사업장↔업체 이름표(`site_co_link`) 확정 쓰기 관리자 전용 · 주민번호 암호화 열쇠(`rrn_key/$v`) 덮어쓰기 차단 · 열람·확정 기록(`rrn_log`, `lock_log`) 덧붙이기 전용.
4. **검사 및 문서**
   - `tests/labor-screens.test.js` · `tests/app-soon-gate.test.js` ⑨ · `tests/portal-soon-locked.test.js` · `tests/firebase-rules-apply.test.js` · `tests/payroll-shell.test.js` 갱신 및 추가, `CLAUDE.md` · `docs/규칙/급여아웃소싱-2중로그인.md` · `payroll-STATUS.md` 반영.
