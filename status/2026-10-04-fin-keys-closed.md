# 2026-10-04 · 돈·급여 자리 아홉을 재무 권한자만으로 (sec/finance-keys-finonly)

대표 「다음」 — 남은 코드 일이 없어 보안 점검을 했다.

## 찾은 것 (서버, 읽기만)
- data 아래 153자리 중 **120자리**가 규칙에 이름이 없어 `$other`(재직 직원 누구나 읽고 쓰기)로 떨어진다.
  대부분은 화면 설정·옮기기 완료 표시라 괜찮다.
- 그 가운데 돈·급여 아홉 — 자문료 수입은 막혀 있는데 이것들은 열려 있었다:
  `accounts`(법인카드 6장 **전체 번호**·계좌) · `payroll_audit_log`(급여 바뀌기 전·후 값 870줄) · `cms_ledger` · `bank_processed` ·
  `ledger_held` · `ledger_picks` · `ledger_split_recipes` · `payer_aliases` · `finance_bank_fee_last`.
- `accounts` 에 **카드 비밀번호(pin) 칸**이 있었다 — 9장 모두 비어 있었다(새 나간 것 없음).

## 한 것
- `scripts/make-firebase-rules.js` 아홉 자리 `finOnly` → `rules-deploy.js` 미리 보기(새로 9 · 바뀜 0 · 사라짐 0) → **콘솔에 올림**(다시 읽어 같음 확인).
  새 기준 `docs/firebase-rules-콘솔원문-2026-10-04.json`. 적용본·rules-paste 도 새로 만듦.
- 이알피 `FB_FIN_KEYS`(규칙과 1:1, 재무 권한 없는 기기의 사본 지우기)에 아홉, `FB_FIN_GATED`(부팅 때 안 받기)에 넷 더함.
- 법인카드 「카드 비밀번호」 입력 칸을 걷었다 — 비밀번호는 어디에도 적지 않는다.

## 누가 무엇을 못 보게 됐나
- 재무 권한(fin) 없는 직원 → 위 아홉 자리를 못 읽고 못 쓴다. 쓰는 화면이 모두 이알피 재무·급여 화면뿐이라(코드 전수 확인) 일은 안 멈춘다.
- 재무 권한자·대표는 그대로.

## 남은 것 (일부러 안 함)
- `trash_bin`(지운 기록 통째 271건)·`audit_log`·`leave_ledger` 등도 열려 있다. 휴지통은 직원이 지울 때 «읽고-덧붙여-쓰기»를 해서,
  읽기를 막으면 통째로 덮어 지울 위험이 있다 — 구조를 바꿔야 해 따로.

## 검사
- 새 `tests/fin-keys-closed.test.js` — 되돌림 4개 모두 운다. 규칙 관련 90개 파일 1,640개 · 이알피 4,027개 통과.
