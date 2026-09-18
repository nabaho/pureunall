#!/bin/sh
# ══════════════════════════════════════════════════════════════════════════
#  푸른이알피 — 나스가 스스로 백업을 받아 온다 (2026-09-18)
#
#  넣는 곳: DSM → 제어판 → 작업 스케줄러 → 생성 → 예약된 작업 → 사용자 정의 스크립트
#           사용자 : 백업 폴더에 «쓸 수 있는» 계정 (root 가 아니어도 된다)
#           일정   : 주 1회 · 월요일 · 새벽 3시
#           스크립트: 이 파일 전체를 붙여넣는다
#  ──────────────────────────────────────────────────────────────────────────
#  ⚠ 도커(Container Manager)가 «필요 없다». wget 하나면 된다.
#  ⚠ CORS 가 «없다» — CORS 는 브라우저가 지키는 울타리이고 wget 은 브라우저가 아니다.
#     2026-09-18 저녁 내내 막힌 그 벽이 이 길에는 아예 존재하지 않는다.
#  ⚠★ 가장 나쁜 고장은 «빈 파일로 지난 백업을 덮는 것»이다.
#     그래서 받은 것이 진짜 백업인지 본 «뒤에만» 파일을 바꾼다.
#  ⚠ 이름은 전부 영문이다 — 나스의 sh 는 한글 이름을 못 쓴다(말과 주석만 한글).
# ══════════════════════════════════════════════════════════════════════════

# ── 여기 둘만 고치면 된다 ──────────────────────────────────────────────────
NAS_KEY="여기에_NAS_BACKUP_KEY_를_넣으세요"
URL="https://us-central1-pureun-erp.cloudfunctions.net/nasBackupExport"
# ──────────────────────────────────────────────────────────────────────────

DIR="/volume1/업무자료/pureun_erp"      # 나스의 실제 공유폴더 경로 (File Station 에서 확인)
KEEP=30                                  # 날짜 파일을 몇 개까지 남길지
LOG="$DIR/pureun_erp_auto.log"
TODAY=$(date +%Y-%m-%d)
TMP="$DIR/.pureun_erp_downloading.json"
DATED="$DIR/pureun_erp_auto_$TODAY.json"
LATEST="$DIR/pureun_erp_latest.json"

note() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

mkdir -p "$DIR" || { echo "폴더를 못 만듭니다: $DIR"; exit 1; }
note "받기 시작"

# ① 받는다 — 임시 이름으로. 이 동안 지난 백업은 아직 안 건드린다
wget -q -O "$TMP" --header="X-Nas-Key: $NAS_KEY" "$URL"
RC=$?
if [ $RC -ne 0 ]; then
  note "✗ 못 받았습니다 (wget 코드 $RC) — 지난 백업은 그대로 둡니다"
  rm -f "$TMP"
  exit 1
fi

# ② 진짜 백업인지 본다 — 셋을 다 넘겨야 파일을 바꾼다
SIZE=$(wc -c < "$TMP" 2>/dev/null || echo 0)
if [ "$SIZE" -lt 1000 ]; then
  note "✗ 받은 것이 너무 작습니다 ($SIZE 바이트) — 오류 쪽지일 수 있어 덮지 않습니다"
  rm -f "$TMP"; exit 1
fi
if ! grep -q '"ok":true' "$TMP"; then
  note "✗ 받은 것이 백업이 아닙니다 — 앞부분: $(head -c 200 "$TMP")"
  rm -f "$TMP"; exit 1
fi
if ! grep -q '"data"' "$TMP"; then
  note "✗ 자료 칸이 없습니다 — 덮지 않습니다"
  rm -f "$TMP"; exit 1
fi

# ③ 이제야 바꾼다
mv -f "$TMP" "$DATED" || { note "✗ 날짜 파일로 못 옮겼습니다"; rm -f "$TMP"; exit 1; }
cp -f "$DATED" "$LATEST" 2>/dev/null
note "✓ 받았습니다 ($SIZE 바이트) → $(basename "$DATED")"

# ④ 오래된 날짜 파일 정리 — 새 것부터 $KEEP 개만 남긴다
#    ⚠ latest 는 건드리지 않는다. 날짜 이름인 것만 센다.
CNT=$(ls -1 "$DIR" 2>/dev/null | grep -c '^pureun_erp_auto_[0-9][0-9-]*\.json$')
if [ "$CNT" -gt "$KEEP" ]; then
  DROP=$((CNT - KEEP))
  ls -1 "$DIR" | grep '^pureun_erp_auto_[0-9][0-9-]*\.json$' | sort | head -n "$DROP" | while read -r OLD; do
    rm -f "$DIR/$OLD" && note "  정리: $OLD"
  done
fi

# ⑤ 로그가 끝없이 불지 않게 — 뒤 500 줄만 남긴다
tail -n 500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv -f "$LOG.tmp" "$LOG"

exit 0
