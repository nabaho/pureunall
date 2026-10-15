상태: 이어하기 대기
작업폴더: C:\Users\fair0\Documents\pu-wt-security
가지: security/rrn-owner-only
이어하기시도: 0

# 사건·계약 근로자 주민번호 — 담당자만 (2026-10-15, security/rrn-owner-only)

대표 결정(2026-10-15): 「사건·계약에 들어 있는 근로자 주민번호를 담당자만」.
앞선 일: 사무실 보안 검토 #2629 (`status/2026-10-14-security-office-audit.md`).

## 지금 모양 (2026-10-15 실측, 개수만)
- `data/cases` 37건 · `data/contracts` 175건 — 각각 «한 덩어리» `{u, v}`. 재직 직원 전원이 통째로 읽는다.
- 근로자: 사건 `workers[]` 36명 · 계약 `company.workers[]` 43명. 주민번호 든 칸 사건 14 · 계약 14.
- 담당자: `managerMain`(사번) + `managerSubs`(사번 배열). 근로자마다 `id`.
- → 덩어리째 읽히므로 규칙으로 «칸 하나만» 막을 수 없다. 주민번호를 «다른 자리»로 옮겨야 한다.

## 대표 결정 (2026-10-15, 목업 https://claude.ai/artifact/JBQhMjPXxbFuuGn8pPtv6Z)
- 보는 사람: 대표(isAdmin) + 그 건의 managerMain·managerSubs. **위임관리인은 담당일 때만**
- 함께 옮김: 근로자 `rrn` + `account`(계좌번호) + `holder`(예금주)
- 담당 아닌 직원: 「🔒 담당자만」(있는지만), 없으면 「—」

## 단계
1. [x] 주민번호가 읽히고 쓰이는 모든 길 지도 — 입력(계약 창·사건 창 2곳)·붙여넣기·과거 회사 불러오기·
       회사묶음·이관 3길(계약→사건·계약→컨설팅/기금/기타·사건→계약)·서식 채우기(pu-contract-vars)·
       기업정보함 근로자 정보함(누구나 「보기」)·전자서명(docs-esign)·백업/복원·휴지통
2. [x] 설계 + 화면 목업 → 대표 승인
3. [ ] 구현 · 검사(돌려 보는 검사 + 고장넣기)
   - [x] 모듈 js/pu-worker-secret.js (+검사, 고장넣기 4)
   - [x] 규칙 worker_secret 게시(새로 1 · 사라짐 0)
   - [x] 옮기기 스크립트 scripts/worker-secret-migrate.js — **--copy 28칸 끝(되읽어 같음 28)**. 공개 덩어리는 아직 그대로
   - [x] 이알피 저장 입구 넷에서 떼기(dbUpsert·dbPatch·dbUpsertMany·dbSet + 휴지통) — 성공한 자리에서만 담당자 칸으로
   - [x] 계약 창·사건 창(칸 7, 붙여넣기 2, 통장 채우기) · 이관 3길(휴지통 «전») · 옛 건 가져오기 2 · 서식 채우기
   - [x] 기업정보함 근로자 정보함(「보기」 때 읽고 거절이면 🔒) · 계약서등관리 서식 채우기 · 온톨로지 등록부(?v=73)
   - [x] 백업 복원도 떼기(옛 백업 값은 담당자 칸으로)
4. [ ] 배포 순서 — **이 순서를 지킬 것**
   ① PR 합치기 → 사이트 배포 확인
   ② node scripts/worker-secret-migrate.js --copy  (그 사이 옛 화면이 넣은 값까지 한 번 더)
   ③ node scripts/worker-secret-migrate.js --clear (공개 덩어리에서 비움 — 같은 값이 담당자 칸에 있을 때만)
   ④ 규칙: 공개 덩어리 근로자 줄에 rrn·account·holder 쓰기 거절 → rules-deploy --deploy
   ⚠ ③ 전에 ④ 를 올리면 옛 값이 든 기록의 저장이 통째로 막힌다
5. [ ] PR

## 하지 말 것
- 주민번호 값을 화면·기록·커밋에 찍기
- 옮기기 전에 원본 칸 비우기 (옮긴 것을 되읽어 맞춘 «뒤»에만)
- 푸시·배포·규칙 게시는 이 방이 직접(감시 작업은 하지 않음)
