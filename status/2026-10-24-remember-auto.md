상태: 사람 확인 필요 (대표 확장 설치 대기 — 코드는 #2713 으로 합침)
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-remember2
가지: remember-auto

# 2026-10-24 · 📇 리멤버 → 사진첩·기업정보함 자동 (대표 「반드시 자동으로」, 목업 승인 — 옛 자료는 이미 다 들어옴, 새것만)

실측(10/24, 대표 로그인 크롬): 리멤버 웹이 `POST api.rememberapp.co.kr/v2/stacks/list.json`
`{group_ids:[],exclude_fields:['sub_cards'],master:false,page,per:50,sort:[{updated_at:'desc'}]}` (수정순도 됨, 전체 6,205장).
머리 authorization·package·content-type — 화면 공간(MAIN world)에서만 부를 수 있다(페이지 밖·격리 공간은 실패).
명함 main_card.data.default: name{first,last}·mobile/tel/fax{national_number}·address{default,detail}·email·company·department·position. image.front.original.

⚠ 10/12 다른 방의 `pu-wt-remember`(feat/remember-pull, 커밋 안 됨 — 새벽 예약·DOM 읽기·기업정보함 안 붙임)는 그때 결정 기준이라 손대지 않음. 이번 것은 새 가지.

1. [x] js/pu-remember.js — 명함→칸, 체크포인트(updated_at) 가르기 (순수 로직+검사)
2. [x] remember-intake.html — 받는 화면(사진첩 savePhoto + PuDocFile.sendToCards 겹침 검사), pucards/remember/status·seen
3. [x] tools/remember-ext — 크롬 확장(MV3): 1시간마다 리멤버 탭 새로 고침 → MAIN hook 이 머리 빌려 수정순으로 cp 까지 → 사진 받아 → 받는 화면으로
4. [x] 기업정보함 옆줄 「📇 리멤버」 상태 · 온톨로지 SATELLITES
5. [ ] 검사·PR·대표 설치 안내·실화면

## 끝낸 것 / 남은 일
- 1~4 코드·검사(remember-auto 7건, 관련 6,459+662건 통과). PR 올림.
- 남은 일: 합친 뒤 확장 폴더를 `C:\Users\fair0\Documents\pu-remember-ext` 로 복사 → 대표 설치(개발자 모드·압축해제 로드)
  → 첫 회차(기준만) 확인 → 새 명함 하나로 실제 확인.
