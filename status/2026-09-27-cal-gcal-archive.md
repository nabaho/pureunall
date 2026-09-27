# 2026-09-27 · 구글 일정 보관함 — 매일 새벽 푸른 캘린더 쪽에 베껴 둔다

대표 지시 「푸른캘린더에는 이모든 일정을 모두 가지고 와서 저장하고 … 별도로 보관」 → 「추천대로」.

- 확인: 구글은 시간이 지나도 안 지운다(2017년부터 10,585건). 사라지는 것은 «누가 지운» 일정(8월 12·9월 17).
- 서버 함수 `gcalArchiveDaily`(asia-northeast3, 매일 03:00 서울) — `functions/gcal-archive.js`.
  처음은 전부, 그 뒤로는 updatedMin 으로 바뀐 것만. 지워짐(cancelled)은 있던 기록에 googleDeleted 표만(내용 보존).
  **배포 완료**(firebase deploy --only functions:gcalArchiveDaily). ⚠ 오늘 밤 첫 자동 실행 — 내일 data/gcal_archive_meta 의 lastRunAt 으로 확인할 것.
- 첫 채움: 서버 함수와 같은 셈으로 10,585건을 CLI 로 한 번 올렸다(data/gcal_archive, 약 7MB) + meta.
- 규칙: data/gcal_archive·gcal_archive_meta — 읽기 로그인 직원, 쓰기 false(서버만), date 색인. 콘솔에 올림(새로 2·바뀜 0·사라짐 0).
- 화면: 「🗄 지운 일정」 스위치 — 켜면 보는 달의 보관본 중 지워진 것을 점선·취소선으로. 구글을 못 받으면 보관본으로 달력을 채운다.
  보는 달만 받는다(orderByChild date) — 보관함 통째로 안 받는다.
