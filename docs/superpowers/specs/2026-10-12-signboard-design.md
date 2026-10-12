# 전광판 컨트롤 앱 설계서

- 작성일: 2026-10-12
- 대상: 푸른통합시스템 포털 «영업관리» 줄의 새 앱 `signboard`(`pu-signboard.html`) + 이 PC에서 도는 심부름꾼
- 대표 요청: 「푸른노무법인 외부 전광판 영업 광고 자유롭게 바꾸는 기능연결시키려고 한다. 푸른통합시스템안에 심어달라」 →
  「여기에 전광판 컨트롤 앱만들어달라」(영업관리 줄 화면을 보이며)
- 경로: 건축급(architectural) — 새 앱 + 새 PC 프로그램 + 새 저장 규칙. 설계 승인(2026-10-12 「그대로」) → 이 설계서 → 계획서 순.

## 1. 합의된 것

| 항목 | 내용 | 정한 때 |
|---|---|---|
| 목표 | 포털에서 광고를 고치면 외부 전광판에 반영된다 | 대표 요청 |
| 띄울 것 | 글자 · 사진 · 동영상 | 대표 선택 |
| 트는 방식 | 여러 광고를 차례로 돌리고, 광고마다 «언제부터 언제까지» 기간 예약 | 대표 선택 |
| 올리는 사람 | 대표 + 관리직원(관리자·위임관리인) | 대표 선택 |
| 보내는 길 | 이 PC에서 늘 도는 심부름꾼이 灰度(휘도) 공식 통로로 전송 | 대표 선택(A안) |
| 포털 자리 | **«영업관리» 줄** (홈페이지·정부사업신청·뉴스레터·회생광고·정부지원금 옆) | 대표 2026-10-12 — 앞서 말한 «내외관리»에서 바꿈 |
| 올리기 | 고치는 즉시가 아니라 «전광판에 올리기» 단추 한 번 | 설계 |
| 기간 예약 | 전광판 장비 안에 넣는다(PC가 꺼져도 날짜·시간에 맞춰 나옴) | 설계 |
| 안전 | 올린 기록 남김 · 직전 판으로 되돌리기 · 심부름꾼 멈춤 경고 · 시험 모드 | 설계 |

## 2. 범위

넣는 것
- 광고 만들기·고치기·지우기(글자/사진/동영상 중 하나), 순서와 기간 정하기, 미리보기
- «전광판에 올리기», 올린 기록, 직전 판으로 되돌리기
- 전광판 상태 보기(심부름꾼 마지막 응답, 장비 해상도·시계·밝기, 마지막 전송 결과)
- 심부름꾼(시험 모드 / 실전 모드)

넣지 않는 것 (v1 제외)
- 한 광고 안에 글자와 사진을 겹쳐 놓기, 화면 분할(여러 영역), 시계·날씨 같은 동적 영역
- 전광판 여러 대, 음성 방송, 밝기·전원 켜고 끄기 조절 (※ 灰度 통로를 켜면 HDPlayer의 «정해진 시각 켜고 끄기»가 안 먹을 수 있다 — §7)
- 광고 문구 자동 추천(AI), 외부 광고 의뢰 접수
- 광고 내용의 적법성 판단 — 올리는 사람이 책임지고 확인한다. 시스템은 판단하지 않는다.

## 3. 전체 구조

```
포털 «전광판» 앱 (pu-signboard.html)            ← 대표·관리직원만
   │  광고 만들기 → 미리보기 → «전광판에 올리기»
   ▼
실시간DB  signboard/…        사진·동영상은 창고(Storage)  signboard/{파일}
   │  signboard/published (올린 판: 번호 + 광고 목록)
   ▼
이 PC의 심부름꾼 (scripts/signboard-agent/)   ← 1분마다 «새 판 있나?»
   │  ① 새 판이면 사진·동영상 내려받기(크기·md5 확인)
   │  ② 灰度 통로로 파일 올리기 → 프로그램 «전체 교체»(replace)
   │  ③ 결과·장비 정보를 signboard/state 에 기록
   ▼
전광판 장비 (사무실 안 주소 IP:30080)
```

전광판은 사무실 안 주소라 인터넷에서 직접 닿지 않는다. 그래서 PC 심부름꾼이 «새 판을 가져다 전달»한다.
클라우드 함수로는 장비에 닿을 수 없다 — 이 방식 외의 길(灰度 클라우드 경유)은 공식 문서에서 확인되지 않아 쓰지 않는다 [확인 필요].

## 4. 포털 앱

### 4.1 포털에 들어가는 자리 (govaid 선례를 따른다 — 실제로 걸렸던 자리)
- `enter.html` APPS: `{ key:'signboard', name:'전광판', desc:'외부 전광판 광고 바꾸기', icon:'📺', url:'pu-signboard.html', roles:null, perm:'signboard', row:'sales' }`
  - `perm` 방식을 쓰면 `portalAppPermOk` 가 관리자·위임관리인(`isAdmin`/`isSubAdmin`)을 알아서 통과시킨다. 다른 직원은 `uid_roles/{uid}/signboard` 가 `true` 일 때만 보인다(지금은 아무도 아님).
  - ⚠ `adminOnly` 는 쓰지 않는다 — `role==='admin'` 만 통과시켜 위임관리인이 빠진다. 타일을 «감추는 것»은 화면일 뿐이고, 진짜 잠금은 규칙(§5)이다.
- `js/pu-appbar.js` 앱 목록에 같은 key·row·name·icon·url·desc 한 줄 — **같은 커밋**에 넣는다(`ontology-registry` 가 «타일 없는 등록 프로그램»을 막는다).
- 화면에는 `pu-ontology.js` → `pu-ls-guard.js` → `pu-ontology-write.js`(`data-mode="observe"` 꼴) → `pu-gate` → `pu-appbar` → `pu-whoami` 순으로 싣는다(`pu-govaid.html:191-199` 기준).
- 앱 안 잠금: `uid_roles/{uid}` 에서 `status==='active'` 이고 `isAdmin` 또는 `isSubAdmin` 이 참이 아니면 «권한이 없습니다» 로 잠근다.

### 4.2 화면 (모양은 구현 전에 목업으로 먼저 확인받는다)
탭 넷. 각 목록은 «맨 왼쪽 ☐ + 번호», 표의 한 칸은 «한 줄»(`…` + `title`)로 그린다.

| 탭 | 내용 |
|---|---|
| ① 광고 | 광고 목록(순서·제목·종류·기간·상태). 위/아래 순서 바꾸기, 켜기/끄기, 복사, 지우기(휴지통 → 복구 가능). «+ 새 광고» |
| ② 광고 만들기 | 종류 선택(글자/사진/동영상). 글자: 문구·글자 크기·색·효과·속도·머무는 초. 사진·동영상: 파일 올리기·맞춤 방식. 공통: 시작일·종료일·요일·시간대(비우면 «늘»). 오른쪽에 전광판 비율의 **미리보기** |
| ③ 전광판 | 심부름꾼 마지막 응답, 장비 해상도·시계·밝기, 마지막 전송 결과, 지금 올라가 있는 판 번호. 어긋남 경고 |
| ④ 올린 기록 | 판 번호·올린 사람·시각·광고 수. «이 판으로 되돌리기» |

- 상단 «전광판에 올리기»: 누르면 확인 창(**「길거리 전광판에 그대로 보입니다」** + 올라갈 광고 목록·기간 요약) → 확인 시 `published` 새 판.
- 아직 올리지 않은 변경이 있으면 «올리지 않은 변경 N건» 띠를 띄운다.
- 수정 충돌: 한 광고를 고칠 때 서버 최신 `revision` 을 다시 비교하는 트랜잭션을 쓴다(공용 관문 규칙).

## 5. 데이터 모델과 규칙

```
signboard/ads/{id}:
  id, entityType:'SignboardAd', schemaVersion, contractVersion, createdAt, updatedAt, revision,
  title, kind:'text'|'image'|'video', enabled:boolean, order:number, _deleted/deletedAt/deletedBy,
  text:{ string, size, color:'#RRGGBB', bold, effectType, effectSpeed, holdSec },     (kind=text)
  media:{ path, url, md5, size, fit:'fill'|'center'|'stretch'|'tile', holdSec },       (kind=image|video)
  period:{ start:'YYYY-MM-DD'|'', end:'YYYY-MM-DD'|'', weekdays:['Mon',…]|[], times:[{start,end}] }
signboard/published:
  version:number, publishedAt, publishedBy:sid, ads:[…광고 사본…], note
signboard/history/{version}:   올린 판 사본 (되돌리기 기준)
signboard/state:               심부름꾼이 쓴다
  agentSeenAt, mode:'dry-run'|'live', sentVersion, sentAt, result:'ok'|'fail', message,
  device:{ id, width, height, time, timeZone, luminance, fwVersion }, clockSkewSec,
  firstReplaceConfirmed:boolean, existingPrograms:[…]
```

- 새 레코드는 `id`·`entityType`·`schemaVersion`·`contractVersion`·생성/수정 시각·`revision` 을 갖춘다. 물리 삭제 대신 `_deleted`.
- **온톨로지** (`js/pu-ontology.js`): `TERMS` 에 개체 종류 `SignboardAd` 추가 · `PROGRAMS.signboard`(`primaryRoots:['signboard']`, `sharedRoots:['uid_roles']`, `writeContracts` 로 `signboard/ads/{id}`·`published`·`history/{version}` 선언) · `READ_ADAPTERS.signboard_core`(`strategy:'in_app'` — 광고 문구는 원본을 통합 화면에 열지 않는다). 사람·업체를 가리키는 칸은 `sid` 만 쓴다(`publishedBy`).
- **실시간DB 규칙** (`scripts/make-firebase-rules.js` 만들개에서만): `signboard` 최상위 칸. 읽기·쓰기 모두 `MGR`(관리자 또는 위임관리인 — `isAdmin`/`isSubAdmin`). `ads/$id` 는 `newData.child('id').val() === $id`, 지우기 금지(`newData.exists()`). `state` 는 심부름꾼이 쓴다(§6.4). 새 최상위 칸이라 **짝 검사 4개**(`tests/perf-rules.test.js` `allowTop`, `tests/photos-staff-share.test.js` `PENDING` 등)를 함께 고친다.
- **창고(Storage)** `pureun-erp-hrphotos` 버킷의 `signboard/{파일}` 칸 새로 — `docs/firebase-storage-전체(붙여넣기용).txt` 에 넣고 `storage-rules-deploy.js` 의 «쓰는자리» 목록에도 적는다. ⚠ 창고 규칙은 DB의 권한표를 못 읽는다 → 쓰기는 `isStaff()`(@pureun.kr)까지만 막을 수 있다. 그래도 «올리기»(`published` 쓰기)는 DB 규칙 `MGR` 이 막으므로 **파일이 올라가도 전광판에는 나가지 않는다.**
  - 사진 10MB(`okImage()`), 동영상 상한은 가안 **50MB** [확인 필요 — 장비 저장공간을 읽은 뒤 확정. 확정 전에는 동영상 상한을 이 값으로 둔다]. 올리기는 기존 선례대로 compat `ref.put()` + 진행률 표시. 동영상 업로드 선례는 저장소에 없다.
- 규칙은 «묻지 않고 내가 올린다»(CLAUDE.md) — 단 `rules-deploy.js` 의 «사라질 규칙 있으면 멈춤» 안전장치를 그대로 지키고, 보고에 «어느 칸이 누구에게 보이게 됐는지»를 적는다. 창고는 기준이 «대표님이 옮겨 주신 콘솔 사본»이라 약한 안전장치임을 보고에서 숨기지 않는다.

## 6. 심부름꾼 (이 PC)

### 6.1 위치와 모양
- `scripts/signboard-agent/` — `scripts/` 는 이미 배포에서 지워지는 폴더라 새 폴더 규칙(`dev-tools-not-published`)에 걸리지 않는다(구현 때 검사로 확인).
- Node 표준 라이브러리만 쓴다(`crypto` 의 HMAC-MD5, `http`, `fs`). 새 의존성 없음.
- 순수 함수와 부딪히는 부분을 나눈다: ① **프로그램 만들기**(광고 → 灰度 JSON) ② **서명**(HMAC-MD5) ③ **장비 호출**(HTTP) ④ **포털 DB 읽기·쓰기** ⑤ **한 바퀴**(오케스트레이션). ①②는 검사로 박을 수 있고, ③④는 가짜로 갈아 끼운다.

### 6.2 설정과 비밀
- 설정은 **저장소 밖** `%APPDATA%\pureun-signboard\config.json` — `deviceHost`(IP:30080), `deviceId`, `sdkKey`, `sdkSecret`, `liveEnabled`.
- 저장소에는 빈 칸만 있는 `config.example.json` 만 둔다. 열쇠는 로그·화면·DB·채팅 어디에도 찍지 않는다. 값의 앞 4글자도 안 찍는다.

### 6.3 한 바퀴 (1분마다)
1. `signboard/published/version` 읽기. 로컬에 적어 둔 «마지막으로 보낸 판 번호»와 같으면 **장비 정보만 갱신**하고 끝.
2. 다르면 광고 목록을 받아 사진·동영상을 내려받는다(크기·md5 검증, 안 맞으면 **전송 중단**).
3. `liveEnabled` 가 아니거나 `--dry-run` 이면: 보낼 JSON 을 파일(`%APPDATA%\pureun-signboard\outbox\판번호.json`)에 기록하고 `state.mode='dry-run'` 으로 알린다. **장비에는 연결하지 않는다.**
4. 실전이면: 파일 올리기(`POST /api/file/{장비ID}`, 서명 규칙2) → 프로그램 전체 교체(`POST /api/program/{장비ID}`, `method:"replace"`, 서명 규칙1).
5. 결과를 `signboard/state` 에 쓰고, 성공이면 «마지막으로 보낸 판 번호»를 갱신한다.
6. 실패는 3회까지 간격을 늘려 재시도, 그래도 안 되면 `state.result='fail'` + 사유. 포털 ③탭에 빨간 띠.

### 6.4 포털과 주고받는 법 — 인증
- 이 PC에 로그인된 **firebase CLI** 로 읽고 쓴다(선례 `scripts/thebill-pull.js`). 서비스 계정 키는 만들지 않는다.
- CLI 호출은 매번 느리므로, 계획 단계에서 «CLI vs 같은 토큰의 REST»를 재서 정한다 [계획서에서 결정].
- CLI 쓰기는 관리자 권한이라 보안 규칙을 건너뛴다. 그래서 규칙은 포털 쪽(`MGR`)만 신경 쓰면 되고, 포털은 `state` 를 **읽기만** 한다. 다만 «규칙을 건너뛰는 쓰기»가 온톨로지 쓰기 관문(`functions/ontology-write-server.js` 관찰 관문)과 어떻게 만나는지는 계획 단계에서 확인한다 [확인 필요]. **로그인이 풀리면 심부름꾼이 멈추고**, 포털 ③탭이 «마지막 응답 N분 전» 경고를 띄운다(PC 꺼짐·로그인 풀림·인터넷 끊김을 한꺼번에 알아챈다).

### 6.5 자동 시작
- 윈도 «작업 스케줄러 — 로그온 시» 등록 스크립트(`install-task.ps1`)를 제공한다. **등록은 사람이 확인한 뒤**에 한다(PC 설정 변경이므로 묻지 않고 하지 않는다).
- PC와 Claude 앱이 아니라 **심부름꾼만** 켜져 있으면 된다. PC가 꺼지면 이미 보낸 광고는 전광판 안에서 계속 돈다(§8).

## 7. 灰度 통로 — 확인된 것과 확인 필요한 것

출처: 灰度 공식 개발 문서(`gitee.com/szhuidu/cn.huidu.device.sdk`, 2026-07-10 판) — 우리가 직접 내려받아 읽었다.

확인된 것(문서 근거)
- 장비 번호 가운데에 `D` 가 있는 «공정 카드»만 2차 개발 가능(예: `C16L-D00-A000F`). 안드로이드 시리즈(A3L·A4L·A5L·A6L·H4K 등)는 최신 펌웨어면 됨.
- 호출 주소 `http://<장비IP>:30080/api/…`. 헤더 `requestId`·`sdkKey`·`date`·`sign`.
  서명 규칙1(일반) `sign = HMACMD5(body + sdkKey + date, sdkSecret)`, 규칙2(파일) `sign = HMACMD5(sdkKey + date, sdkSecret)`. `sdkSecret` 은 전송하지 않는다.
- 열쇠(sdkKey·sdkSecret)는 **灰度 기술지원에 요청**해 받는다(개발자 플랫폼 미공개). 장비 첫 사용 때 웹(`장비IP:30080/login/`) 또는 `/api/sdkkey/` 로 등록하며, **한 번 등록하면 다시 못 한다.**
- 구조: program(광고 1건 = 프로그램 1개) → area(자리·크기) → item(글자/사진/동영상). `playControl` 에 `duration`·`week`·`date[]`·`time[]` 로 기간 예약.
- 사진·동영상 `file` 은 «장비 안 파일 이름 또는 유효한 URL» + `fileMd5`·`fileSize`. 우리는 **PC가 받아서 장비에 파일 올리기**(`/api/file/`)로 넣는다 — 장비가 인터넷을 못 써도 되게.
- 효과 종류 0~30(직접 표시·이동·덮기·깜빡임 등), 속도 0(빠름)~8(느림), 머무는 시간 ms.
- 장비 정보 `getDeviceProperty` → `screen.width/height`, `time`, `time.timeZone`, `luminance`, `version.app` 등.

설계 결정
- 광고 1건 = program 1개, area 는 **화면 전체 한 칸**(`x:0,y:0,width:screen.width,height:screen.height`). 순서는 program 배열 순서.
- 광고의 `period` 는 `playControl` 로 번역한다. 비운 값은 «늘».
- «전체 교체(replace)»를 쓴다 — `published` 가 «전광판에 있어야 할 전부»이기 때문이다.

확인 필요
- ⚠★ **`replace` 는 장비에 이미 있는 프로그램(HDPlayer로 넣어 둔 것)을 지운다.** 첫 실전 전송 전에 `getAll` 로 기존 목록을 읽어 `state.existingPrograms` 에 보관하고, 포털 ③탭에서 대표가 «지워도 된다»를 눌러 `firstReplaceConfirmed` 가 켜져야만 첫 `replace` 를 보낸다.
- 灰度 문서의 서명 예시는 본문 원문이 없어 **우리 서명 함수와 대조할 수 없다.** 시험 벡터는 표준 HMAC-MD5 값(자체 계산)으로 두고, 장비가 서명을 받아 주는지는 **실제 장비 앞에서만** 최종 확인된다.
- 장비 시계가 한국 시간인지(중국 시간이면 기간 예약이 1시간 어긋남). 심부름꾼이 `time.timeZone`·`time` 을 읽어 어긋나면 ③탭에 경고한다.
- 장비 가용 저장공간(동영상 상한 확정에 필요) — 문서에서 읽는 방법을 못 찾았다.
- 灰度 통로를 켜면 HDPlayer의 «정해진 시각 켜고 끄기» 설정이 안 먹을 수 있다(문서 §2.2). 현재 쓰는 설정이 있는지 확인 필요.

## 8. 안전장치와 실패 처리

| 상황 | 어떻게 되나 |
|---|---|
| 고친 뒤 «올리기»를 안 누름 | 전광판은 그대로. 포털에 «올리지 않은 변경 N건» 띠 |
| 심부름꾼 PC가 꺼짐 | 이미 보낸 광고는 장비 안에서 계속 돎(기간 예약도 장비가 지킴). 포털은 «마지막 응답 N분 전» 경고 |
| 장비가 응답 없음 | 재시도 3회 → `state` 에 실패 사유 → ③탭 빨간 띠. 장비의 기존 광고는 건드리지 않음 |
| 파일 크기·md5 불일치 | 그 판 전송 중단, 장비의 기존 광고 유지 |
| 잘못 올림 | ④탭 «이 판으로 되돌리기» → 새 판 번호로 다시 `published` |
| 열쇠 분실·유출 | PC 설정 파일에만 있으므로 PC 점검. 灰度에 재발급 문의 |
| 직원이 몰래 올림 | 규칙 `MGR` 이 `published` 쓰기를 막음. 올린 기록에 `publishedBy` 남음 |

## 9. 검사 (규칙을 못 박는다 — 「지금 값」 아님)

`tests/signboard-*.test.js` (이름은 govaid 선례 `govaid-*` 를 따른다). 이 저장소의 검사 규칙대로 «지금 값»이 아니라 «규칙»을 못 박는다(`tests/test-pin-guard.test.js` 가 지킨다).

- `signboard-html` — 화면이 실제로 그려진다(하네스: 가짜 firebase), 권한 없으면 잠긴다, 표의 한 칸은 한 줄, 폰 입력칸 16px 이상.
- `signboard-program` — 광고 → 灰度 JSON: 기간·요일·시간대 번역, 글자/사진/동영상 모양, 순서, 화면 전체 area. (값이 규칙인 곳: 효과 번호·`playControl` 키 이름 → `검사고정-허용` + «灰度 공식 문서의 규칙» 이유 병기)
- `signboard-sign` — HMAC-MD5 규칙1·2가 표준 시험 벡터와 같다(값이 규칙이므로 박는 게 맞다 — `검사고정-허용` + 이유).
- `signboard-agent` — 한 바퀴를 **가짜 장비·가짜 DB**로 돌려 본다: 새 판일 때만 전송, 시험 모드는 장비 호출 0회, md5 불일치면 전송 중단, 첫 `replace` 는 `firstReplaceConfirmed` 없으면 안 보냄, 실패 재시도 3회, 열쇠가 로그에 안 찍힘. («모의는 한 걸음 앞에서 멈춘다» — 가짜가 «null 먼저» 같은 현실의 불편한 동작도 하게 한다.)
- `signboard-rules` — 규칙 만들개가 `signboard` 를 `MGR` 로 잠그고, 지우기를 막고, `allowTop`·`PENDING` 등록부에 올라 있다.
- `signboard-ontology` — `PROGRAMS.signboard`·`READ_ADAPTERS.signboard_core`·`TERMS.SignboardAd`·`writeContracts` 가 있고 `enter.html`·`pu-appbar.js` 타일과 짝이다.
- 뮤테이션: 위 검사가 «실제로 깨지는지» 일부러 망가뜨려 확인한다(앵커는 유일하게, CRLF/LF 주의).
- 하네스 `_harness-*.html` 는 확인이 끝나면 지운다(`ontology-registry` 「등록부에 없는 화면」).

## 10. 만드는 순서

| 단계 | 내용 | 기계가 필요한가 |
|---|---|---|
| M0 | 화면 목업을 대표께 보여 확인(저장소에 안 둠 — SendUserFile 로 전달) | 아니오 |
| M1 | 포털 앱 + 규칙 + 온톨로지 + 창고 규칙 + 검사. 배포 | 아니오 |
| M2 | 심부름꾼 — 시험 모드(보낼 JSON 기록만) + 灰度 JSON 만들기·서명 검사 | 아니오 |
| M3 | 실전 연결: 장비 번호·열쇠·네트워크 확인 → 시험 전송 1건 → 기존 프로그램 확인 → 전체 교체 | **예** |

M1·M2 는 기계 없이 끝낼 수 있다. M3 만 대표님 준비물이 필요하다.

## 11. 대표님 준비물 (제가 대신 못 하는 것)
1. 전광판 **모델명·장비 번호** (HDPlayer 장비 목록 또는 제어기 스티커). 번호 가운데에 `D` 가 있어야 한다.
2. **灰度 기술지원에 sdkKey·sdkSecret 요청.** 장비 번호를 알면 요청 문구는 이 쪽에서 쓴다.
3. 전광판이 **사무실 인터넷에 연결돼 있는지**, 자체 와이파이만 쓰는지. 이 PC가 속한 사무실 망(`192.168.0.x`)에서는 2026-10-12 현재 전광판 응답이 없었다(응답한 기기: 공유기·샤오미 기기·인터넷전화·NAS 4대). 자체 와이파이만 쓴다면 심부름꾼을 둘 PC를 다시 정해야 할 수 있다.
4. 전광판에 **지금 들어 있는 광고**가 있는지(첫 전체 교체 때 지워진다).
5. HDPlayer로 **«정해진 시각 켜고 끄기»** 를 걸어 두었는지.
6. (원하시면) HDPlayer 설치. 받으신 `HDPlayer.7.11.8.0.exe` 는 디지털 서명이 없는 설치 파일이라 설치하지 않았다. 灰度 공식 사이트 최신 판을 권한다 [확인 필요].

## 12. 이 설계가 따라야 하는 저장소 규칙 (체크리스트)
- [ ] `PROGRAMS` 등록과 포털 타일(`enter.html`·`pu-appbar.js`)은 **한 커밋** · 사전에만 있는 관계어는 `PREDICATES_PLANNED` 에 사유
- [ ] 저장은 `PuOntologyWrite.createGateway({ mode:'enforce', actor:sid })` 관문으로만. `gate.remove` 는 거래 첫 null 에서 접히므로 «null 에도 id 가진 레코드를 돌려주는 함수»로 `gate.save` (govaid 선례)
- [ ] 앱끼리 창은 `PuAppBar.goApp` 만 — `_blank` 금지
- [ ] 공용 js 를 고치면 싣는 화면 전부의 `?v=` 를 올린다(훅은 막기만 한다). 리베이스 뒤 main 이 같은 번호로 올렸는지 다시 본다
- [ ] 색은 27색 팔레트 안에서만. 새 폴더는 배포에서 지우는 목록에 있는지 확인
- [ ] 한 줄 규칙: 표 칸은 한 줄, 빈 값은 안 그린다(`erpNoteWorth`)
- [ ] 예시·검사·문서에 실제 사람 이름·전화번호를 쓰지 않는다
- [ ] 끝낼 때 `status/날짜-가지이름.md` 에 «새 파일 하나»로 기록 — `STATUS.md` 표에 덧붙이지 않는다
- [ ] 규칙·창고 규칙 올리기는 구현이 끝나고 검사가 통과한 뒤에만

## 13. 남은 질문 (설계는 이 답과 무관하게 진행 가능)
- 동영상 상한(가안 50MB)과 장비 저장공간
- CLI vs REST (§6.4) — 계획서에서 속도로 결정
- 전광판 해상도와 비율 — 미리보기 비율에 쓴다. 장비를 읽어야 안다. 그 전에는 **128×64**(灰度 문서 예시 값)를 «자리표시»로만 쓰고 이 값을 확정값으로 취급하지 않는다 [확인 필요]
