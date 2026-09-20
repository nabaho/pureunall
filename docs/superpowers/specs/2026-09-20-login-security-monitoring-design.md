# 로그인 보안 감지·경보 설계문서

- 작성일: 2026-09-20
- 대상: `enter.html` 포털 로그인(Firebase Auth 이메일/비밀번호) — 무단 로그인 시도 감지 및 관리자 경보
- 대표 요청: "푸른로그인보안" → "점검 및 제3자 무단로그인에 대한 대응 등" → "앞으로 무단 로그인을 잡아내는 장치 구축" + "둘 다"(현재 방식 점검도 포함)

## 1. 목적
현재 `enter.html`은 Firebase Auth `signInWithEmailAndPassword`만 쓰고, 로그인 성공/실패
기록·새 기기 감지·관리자 알림이 전혀 없다. 누군가 직원 계정으로 무단 로그인을 시도하거나
성공해도 아무도 모른다. **로그인 자체의 동작·속도를 바꾸지 않으면서**, 뒤에서 조용히
기록하고 의심스러운 패턴만 기존 관리자 경보 화면에 띄우는 장치를 만든다.

## 2. 범위
- ✅ 로그인 성공·실패 전부 기록 (감사 로그)
- ✅ 처음 보는 기기·브라우저에서 로그인 성공 감지
- ✅ 짧은 시간 내 비밀번호 반복 실패 감지
- ✅ 평소 접속 이력이 없는 국가에서 로그인 감지
- ✅ 위 세 판정을 기존 `systemAlerts` 관리자 경보 패널에 통합 표시
- ❌ (범위 밖, v1 제외) 로그인 자체를 차단하는 기능(Identity Platform 승격, blocking
  functions) — 32명 규모 직원의 일상 로그인이 걸리는 리스크가 새로 생기므로 넣지 않는다.
  의심 시 **알리기만** 하고, 계정 잠금 등 대응은 사람(관리자)이 판단한다.
- ❌ 이메일·카카오 등 즉시 연락 채널 — 대표가 "기존 관리자 경보 패널로 충분"이라 결정.
- ❌ 근로자 개체·기존 로그인 화면의 비밀번호 규칙 자체 재설계 — 이번 건은 감지·경보만.

## 3. 전체 구조
```
enter.html (로그인 성공/실패 직후, 기다리지 않고 fire-and-forget 호출)
   │  { email, ok, code, deviceId, ua } — 성공(ok:true) 보고에는
   │  Authorization: Bearer <Firebase ID 토큰> 도 함께 보낸다(2026-09-20 재검토 반영)
   ▼
functions/index.js 의 새 함수  logLoginAttempt (HTTPS)
   │  ok:true 는 증표(비밀번호 로그인 ID 토큰, 이메일 있는 것만)를 검증해야 받는다 —
   │  본문의 email 은 그 경우 절대 쓰지 않는다(익명 로그인 증표로도 못 속인다).
   │  ok:false 는 증표 없이 받되, 누적만 올리고 되돌리거나 기준을 세우지 못한다.
   │  요청 헤더에서 IP 추출 → 내장 지역 DB로 국가만 판별(외부 전송 없음)
   │  uid 는 증표에서 바로 쓰거나(성공), 실패 보고는 admin.auth().getUserByEmail(email) 로
   │  조회한다(실패해도 계속 진행)
   ▼
RTDB 기록 (Admin SDK — 규칙 우회, 클라이언트는 이 경로에 쓰기 권한 없음)
   login_events/{uid|unk_해시}/{push-id}      ← 성공/실패 전부, 무조건 기록
   login_devices/{uid}/{deviceId}             ← 이 계정이 이전에 본 기기 집합
   login_countries/{uid}/{countryCode}        ← 이 계정이 이전에 접속한 국가 집합
   login_fail_burst/{uid}                     ← 최근 실패 연속 카운터(짧은 창)
   │  (uid 를 못 찾았으면 devices/countries/burst 갱신은 건너뜀 — 비교 기준이 없음)
   ▼
의심 판정 3종 중 하나라도 걸리면 → systemAlerts/{uid}/{id} 에 한 건 추가
   (기존 js/pu-health.js 관리자 패널이 그대로 보여줌 — 새 화면 없음)
```

## 4. 데이터 모델
```
login_events/{key}/{pushId}:
  at: number(ms), ok: boolean, code: string(''|firebase auth 에러코드),
  email: string(마스킹 없이 그대로 — 관리자만 읽음), ip: string, country: string(''|'KR' 등),
  deviceId: string, deviceKnown: boolean, ua: string(150자 제한), page: 'enter.html'

login_devices/{uid}/{deviceId}: { firstSeenAt: number, ua: string }
login_countries/{uid}/{countryCode}: { firstSeenAt: number }
login_fail_burst/{uid}: { count: number, windowStartAt: number, alerted: boolean }
  (alerted: 이 반복 구간에서 이미 경보를 보냈는지 — 문턱을 «넘는 순간»에만 한 번 켜고,
   성공 또는 창 만료로 구간이 리셋되면 다시 꺼진다. 없으면 실패마다 계속 경보가 쌓인다.)

systemAlerts/{uid}/{id}:  (기존 스키마 그대로 재사용, js/pu-health.js 참고)
  uid, kind: 'security-device'|'security-country'|'security-burst',
  message: string, detail: string, page: 'enter.html', createdAt, status: 'new'
```
- `key`는 uid를 알면 uid, 모르면(존재하지 않는 이메일로 시도) `unk_` + 이메일 해시 —
  실재하지 않는 계정을 노린 시도도 통계로는 남기되, 그 어떤 실제 직원 계정과도 섞이지 않는다.
- 판정용 세 집합(devices/countries/fail_burst)은 uid를 찾았을 때만 갱신·비교한다.

## 5. 판정 규칙 (문턱값은 조정 가능, 상수로 분리)
1. **새 기기**: `deviceId`가 `login_devices/{uid}`에 없고, 그 계정에 **이미 기록된 기기가
   하나 이상 있을 때만** 의심으로 본다. (계정의 첫 로그인 기록 자체는 비교 대상이 없으므로
   기준선으로만 저장하고 알리지 않는다 — 켜는 첫날 전 직원이 한꺼번에 "새 기기"로 뜨는
   것을 막는다.) **로그인이 실제로 성공했을 때만** `login_devices`에 기록해 다음부터는
   "아는 기기"가 되게 한다 — 실패한 시도로는 기준선을 세우지 않는다(최종 검토에서 발견:
   실패 뒤 성공하는 흔한 시도 순서가 새 기기 신호를 무력화하는 것을 막는다).
   - deviceId는 브라우저 `localStorage`에 저장하는 임의 문자열(최초 1회 생성) — 기기
     하드웨어 식별이 아니라 "이 브라우저를 전에 본 적 있는가"만 구분한다. 저장공간을
     지우면 다시 "새 기기"로 보일 수 있음(허용된 오탐).
2. **비밀번호 반복 실패**: 같은 계정(uid 조회 성공 기준)이 15분 창 안에 5회 이상 실패하면
   경보. 성공하거나 창이 만료되면 카운터 리셋.
3. **새 접속 국가**: 새 기기와 같은 원리 — 이미 기록된 국가가 있는 계정에서 처음 보는
   국가가 나오면 경보. 국가 판별 실패(사설 IP 등 알 수 없음)는 판정에서 제외한다(모르면
   의심하지 않는다).

## 6. 클라이언트(enter.html) 변경
- `signInWithEmailAndPassword` 성공/실패 콜백 각각에서 `logLoginAttempt`를 **결과를
  기다리지 않고** 호출한다(`.catch(function(){})`로 실패를 삼킴 — 기록 실패가 로그인
  경험에 영향을 주면 안 됨).
- `deviceId`는 최초 접속 시 생성해 `localStorage`(`pu_device_id`)에 저장, 이후 재사용.
- 기존에 사용자에게 보이는 에러 메시지(계정 존재 여부를 숨기는 문구 등, 2026-09-07 결정)는
  **그대로 유지** — 이 기능은 서버 쪽 기록·판정만 추가하고 화면 문구는 건드리지 않는다.

## 7. 국가 판별 방식 (개인정보 최소화)
- IP→국가 변환은 **외부 API를 호출하지 않고** 함수 안에 내장한 지역 DB(예: `geoip-lite`
  류의 로컬 라이브러리)로 처리한다. 직원 로그인 IP가 제3의 서비스로 나가지 않는다.
- IP 자체는 판정에만 쓰고 관리자 경보 문구에는 국가만 노출한다(IP 원문은
  `login_events`에만 남고, 관리자 화면에는 굳이 안 보여준다 — 필요하면 로그를 직접 조회).

## 8. 실패 격리 (Fail-safe)
- 기록 함수가 죽거나(쿼터, 배포 지연 등) 응답이 늦어도 **로그인 자체는 영향 없음**
  (client가 응답을 기다리지 않으므로).
- uid를 못 찾은 시도(존재하지 않는 이메일)는 새 기기/국가/실패반복 판정 없이 원시 기록만
  남긴다 — 계정 캐내기 방어(2026-09-07 결정)와 계속 호환.

## 9. Firebase 규칙 변경 (`scripts/make-firebase-rules.js`)
```
rules.login_events    = { '.read': MGR };   // 클라이언트 쓰기 없음 — Admin SDK 전용
rules.login_devices   = { '.read': MGR };
rules.login_countries = { '.read': MGR };
rules.login_fail_burst= { '.read': MGR };
```
CLAUDE.md 규칙에 따라 `node scripts/rules-deploy.js --deploy`로 사람 확인 없이 바로 올리고,
무엇이 새로 생겼는지 보고한다. `systemAlerts` 자체 규칙은 변경 없음(Admin SDK가 규칙을
우회하므로 기존 규칙 그대로 관리자만 읽는다).

## 10. 테스트 계획
- 판정 로직(새 기기/새 국가/반복실패 임계값)은 순수 함수로 분리해
  `tests/login-security-log.test.js`에서 Firebase 없이 단위테스트 (vm-realm 문제 회피,
  [[vm realm breaks deepEqual]] 메모 참고 — 실제 배열/객체로 직접 검증).
- `tests/firebase-access-matrix.test.js` 계열에 새 경로 4개의 읽기 권한(MGR만) 검사 추가.
- 규칙 고정 검사(`tests/test-pin-guard.test.js`) 위반 없도록 문턱값(15분/5회)은
  이유를 주석에 남기고 상수로 둔다.

## 11. 롤아웃 시 예상되는 소음
- 켜는 첫날, 각 직원이 두 번째로 쓰는 기기(폰 등)로 로그인하면 "새 기기" 경보가 한 번씩
  뜬다. 고장이 아니라 이 방식의 자연스러운 특성 — 관리자가 한 번씩 확인하고 넘기면 된다
  (기존 `systemAlerts`의 "해결" 처리 흐름 그대로 사용).

## 12. 범위 밖 (YAGNI, v1 제외)
- 로그인 차단/2단계 인증 강제 — 감지·경보까지만.
- 이메일/카카오 즉시 알림 — 필요해지면 후속 확장.
- 근로자 대상 "새 기기 로그인 알림" 본인 노출(현재는 관리자만 봄) — 필요 여부는 대표 판단 후.
