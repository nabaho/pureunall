# 2026-10-19 · 이알피 옵시디언 업무요약을 «옵시디언 자동 정리» 보관함으로 합침

- 대표 「추천대로」(이알피 업무요약과 AI 기록을 같은 보관함으로).
- `js/pu-obsidian.js?v=3`: 노트 자리 `푸른업무/…` → `raw/erp/…`, 주소에 `vault=`(기본 `푸른업무`, 바꾸려면 localStorage `pu_obsidian_vault`). 주소 조립은 `noteUri` 하나로.
- `tools/obsidian-sync`: `raw/erp/` 노트를 하루 목록·위키 대기 목록에 건다(읽기만). 위키 틀 구조표에 한 줄.
- 검사: `tests/obsidian-work-summary.test.js`(자리·보관함 이름·주소 한 벌) · `tests/obsidian-sync.test.js`(erp 가 하루/대기 목록에 잡힘).
- ⚠ 못 본 것: 로그인한 이알피에서 단추를 눌러 실제로 옵시디언이 열리는지, 보관함 이름이 `푸른업무` 인지. 대표 PC 확인 필요.
