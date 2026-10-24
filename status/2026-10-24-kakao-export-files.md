상태: 이어하기 대기
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-kakao-export
가지: feat/kakao-export-files

# 2026-10-24 · 💬 카톡정리 — 대화 저장본 끌어 놓기 + 📎 받을 파일 (대표 「목업대로 진행」)

대표 물음(10/19) 「카톡 업무 대화와 다운받을 것을 위반 없이 자동 정리」 → 목업 두 번(10/24) → 승인.
목업은 저장소에 두지 않는다(scratchpad `mockup-kakao-export-files.html`, 대표께 파일로 보냄).

## 정한 것
- 카톡 프로그램을 조종·긁지 않는다(docs/카톡수집기-검토.md). 사람이 저장한 .txt·파일만 읽는다.
- 저장본(.txt)은 «이 PC 브라우저 안»에서만 읽는다(`PuKakaoWork.parseExport`). 서버로는 가린 줄만 간다.
  받는 방 목록에 없는 방이면 멈추고 아무것도 안 보낸다(서버도 같은 잣대로 또 막는다).
- 30일 넘은 줄은 안 넣는다(알림 글과 같은 보관 30일). 사진은 수만 보여 주고 안 넣는다.
- 출처 🔔알림 / 📄저장본. 같은 글은 한 줄만 — 알림(밀리초)과 저장본(분)은 «보낸 사람·분(앞뒤 1분)·글»로 견준다.
- 대표님 글은 저장본으로만 들어온다(카톡은 내 글에 알림 없음). 「카톡에서 대표님 이름」은 미리보기 창에서 고르고
  `kakaoWork/meta.meName` 에 남는다(짐작: 알림에 한 번도 안 나온 사람 중 글이 가장 많은 사람).
- 받을 파일: `kakaoWork/files/{id}`(Document · 이름·보낸 사람·때만, 알맹이 없음, 45일 뒤 물리 삭제).
  남은 기간은 «추정»(보낸 날+14일 — 카카오 비공개, 대표 캡처의 유효기간 값).
- 「받은 파일 폴더」를 브라우저가 연결(읽기만, 손잡이는 옵시디언 금고와 같은 IndexedDB 자리 · 열쇠 `kakaoDl`)해
  같은 이름이면 «받음». 폴더 못 쓰는 브라우저는 📂 띠에 파일을 끌어 놓는다.
- 보낼 곳: 📷사진첩(PuHandoff → pu-photos `?take=`) · 📑기업별 계약서(PuHandoff → pu-cards `?take=&to=co` →
  메일 첨부와 «같은» `mbAttToCo` 창) · 💻PC에만(끝 표시만). 이름으로 미리 고르고(`guessDest`) «확인하고 보내기»는 사람이.
  급여·근태·근로계약서는 PC에만(고객사 직원 개인정보). 급여데이터함은 10/20 감춤 → 그쪽 길 없음.
- 창은 한 번에 하나(팝업 막힘): 사진첩+기업별 계약서를 한 번에 못 보낸다, 기업별 계약서는 하나씩.

## 할 일
1. [x] js/pu-kakao-work.js — parseExport(PC·안드로이드·아이폰·맥 CSV) · exportRooms/pickRoom · maskCount · lineKey ·
       guessDest · fileLeft/fileEnds · sameFileName (+ functions/kakao-lib 사본)
2. [x] 서버 — kakao-work-server.js importExport(dryRun)·listFiles·setFiles(트랜잭션, 찬 자리 접힘 피함)·readMeta ·
       list 에 src·meta. index.js hanaMessageBridge 에 kakaoImport·kakaoFiles·kakaoFileSet(총괄관리자만)
3. [x] work.html — 💬대화/📎받을 파일 갈래, 끌어 놓기 띠·미리보기 창·저장하는 법, 출처 칸·대표 글, 받을 파일 표·폴더·보내기
4. [x] pu-cards.html — mbTakeToCo(카톡 파일 → 기업별 계약서 창), mbAttFetch 가 건네받은 바이트를 그대로 씀
5. [x] tests/kakao-export.test.js (23건)
6. [x] 전체 검사(2,229 파일 통과) · [ ] PR · 합치기 · **hanaMessageBridge 함수 배포**(화면만 새것이면 받을 파일이 「불러오지 못했습니다」)

## 남은 것 / 확인 필요
- ⚠ **실제 PC 카톡 저장본으로 한 번 시험해야 한다** — 모양은 알려진 판(블로그·공개 파서) 기준으로 맞췄다.
  첫 줄 「… 님과 카카오톡 대화」·「[이름] [오후 1:26] 글」·「파일: 이름」 꼴이 다르면 «못 읽었습니다 + 첫 줄»이 뜬다.
- PC 에 「카카오톡 받은 파일」 폴더가 없었다(10/24) — 카톡 설정의 받는 폴더를 대표님이 «폴더 연결»에서 고르면 된다.
- 폰 알림 0건(10/9~)은 이 일과 별개 — 폰에서 업무방 카톡 알림이 꺼져 있는지 봐야 한다(kakao-work-notes 메모).
- pu-ontology.js 의 work entityTypes 에 'Document' 를 아직 안 적었다(27개 화면 ?v= 를 함께 올려야 해서 미룸).
