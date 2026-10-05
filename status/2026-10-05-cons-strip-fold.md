# 2026-10-05 · cons-strip-fold — 관리 대시보드 툴바 한 줄 · 클리닉 띠 접기 · 개수 기억 · 펼침창 Esc

- 컨설팅관리: 🏥 현장클리닉·🛡 기술보호 띠를 기본 «접힘», 툴바 「▸ 📊 클리닉·기술보호」 단추로 편다(기기에 기억).
- 컨설팅·기금·기타(공용)·사건관리 툴바: flexWrap nowrap — 검색칸·유형칸이 줄어든다. 「N개씩 보기」가 둘째 줄로 떨어지던 것.
- 사건관리 상태 고르개가 빈칸이던 것: 기본값 'open' 에 맞는 「종결 제외 전체」 고르개가 없었다 → 더함.
- 「N개씩 보기」: 업체·사건·컨설팅/기금/기타·입금 리스트·미입금·종료 — usePersistedState 로 마지막 고른 값 기억.
- 펼침창: 공용 usePopupDismiss(open, close) — 바깥 누르기·Esc 로 닫기. 업체관리 컬럼 설정·사건·공용 「⚙️ 컬럼」.
- 검사: tests/dash-toolbar-one-line.test.js(되돌리면 4개 실패). clinic-day-cards·project-list-freeze-guard 는 규칙 그대로 표현만 넓힘.
