상태: 목업 승인 대기
작업폴더: C:\Users\fair0\Documents\pu-wt-clinic-perf (가지 feat/clinic-perf-track)

# 2026-10-19 · 현장클리닉 «성과추적관리»는 연간 수행일수·건수에서 뺀다

대표 지시: 「현장클리닉에서 성과추적관리 사업의 경우 년간 수행일수에 포함되지 않는다
그부분 반영해주고 체크표시 할 수 있게하고 카운팅에 들어가지 않게 해달라.」
(캡처 = 중진공 현장클리닉 상세 「신청내용」 표 › 신청경로 = 「성과추적관리」)

목업: https://claude.ai/artifact/DN7amujqijNxJKpyDDNnDu

## 셈이 있는 곳 — 전부 `clinicDayCards` 한 함수
- 계약창 담당자 칸 «그 사람 올해 실적» 줄(`clinicContractHint`)
- 🏥 현장클리닉 띠(`ClinicDayCards`, 계약관리 «담당자별 한 해 목록»)
- 「⚠ 확인 필요」 창(`ClinicCheckModal`, 셈 결과의 check)
- gov-consulting.html·work.html 에는 연간 셈이 없다(확인함).

## 끝낸 것 (셈 로직 — 화면 모양과 상관없는 부분)
- `perfTrack:true` 칸 + `CLINIC_PERF_ROUTE='성과추적관리'` + `clinicIsPerf()` (현장클리닉 유형일 때만 뜻이 있다)
- `clinicDayCards`: 수행·예정 모두 셈에서 빼고 `perf` 로 따로 셈 · 목록에 `st:'perf'` 줄로 남김 · 확인 필요에서 뺌
- `clinicContractHint`: 성과추적관리 계약은 «이 계약까지»에 안 더함 (`perf` 돌려줌)
- `transferContract`: 컨설팅 이관 때 `perfTrack` 승계 · 빈 계약 서식에 `perfTrack:false`
- `ctReqHumanFill`: 중진공 요청의 `smes.route` 가 정확히 「성과추적관리」(띄어쓰기만 무시)일 때만 켬 + 비고
- `clinic-intake.html`: 북마클릿이 「신청경로」를 읽음(판 v:2) · 요청에 `smes.route` · 창에 꼬리표 · 옛 단추면 경고
- 검사 `tests/clinic-perf-track.test.js` 11개(되돌리기 12가지 모두 빨강 확인) · 옛 검사 3개는 새 함수만 싣게 고침

## 남은 일
- 목업 승인 뒤 화면: 계약창 알약(유형 옆) · 실적 줄 문구 · 컨설팅 수정창 체크 · 띠 칩/말풍선/목록 꼬리표
- 화면 검사 추가 → 전체 검사 → 커밋·푸시·PR

## 이미 들어 있는 건 (읽기만)
- 「성과추적」 글자가 든 현장클리닉 건 0건(컨설팅 26 · 계약 29 · 정부사업일정 사업장 57·일정 175)
- 올해 건 목록은 공용 쪽지 폴더 `성과추적관리-후보목록-2026-10-19.md` — 대표가 번호를 주시면 그때 표시(승인 뒤)

## 주의
- 중진공 즐겨찾기 단추는 코드가 즐겨찾기 안에 들어 있어 **옛 단추는 스스로 안 바뀐다** — 한 번 다시 끌어다 놓아야
  신청경로를 읽는다. 옛 단추로 누르면 보내기 창이 그렇다고 알린다.
