# ══════════════════════════════════════════════════════════════════════════
#  푸른이알피 — 폴더를 «찾아서» 나스 자동 백업을 올린다 (2026-09-18)
#
#  쓰는 법: 명령 프롬프트에 아래 한 줄을 붙여넣습니다.
#    powershell -NoProfile -ExecutionPolicy Bypass -File "이 파일 경로"
#  또는 이 파일을 오른쪽 클릭 → 「PowerShell에서 실행」
#
#  ⚠ 이것은 «처음 한 번»을 위한 것이다. 폴더를 모르실 때 쓴다.
#    한 번 돌리면 폴더 경로가 찍히고, 다음부터는 scripts\나스-올리기.bat 을 두 번 누르면 된다.
#  ⚠ 사람에게 폴더를 찾게 하지 않는다 — 2026-09-18 대표님이 C:\Users\fair0 에서
#    git pull 을 치시고 「not a git repository」를 보신 자리가 그것이다.
# ══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'
Write-Host ''
Write-Host '═══ 푸른이알피 — 나스 자동 백업 올리기 ═══' -ForegroundColor Cyan
Write-Host '이알피 폴더를 찾는 중입니다 (조금 걸립니다) …'

$found = $null
# 흔한 자리부터 본다 — 대개 여기서 바로 나온다
foreach ($root in @($env:USERPROFILE, 'C:\', 'D:\')) {
  if (-not (Test-Path $root)) { continue }
  # ⚠★ «.git 이 있는» 폴더만 본다 (2026-09-18 대표 화면)
  #    처음에는 scripts 가 옆에 있는지만 봤다 — 그러자 배포 결과물 폴더
  #    (Documents\pu-deploy)가 잡혔다. 거기에도 pu-erp.html 과 scripts 가 있다.
  #    우리는 git pull 을 할 자리가 필요하므로 «저장소인가»가 진짜 조건이다.
  $found = Get-ChildItem -Path $root -Filter 'pu-erp.html' -Recurse -File -ErrorAction SilentlyContinue |
           Where-Object { Test-Path (Join-Path $_.DirectoryName '.git') } |
           Select-Object -First 1
  if ($found) { break }
}

if (-not $found) {
  Write-Host '✗ 이알피 폴더를 못 찾았습니다.' -ForegroundColor Red
  Write-Host '  이 PC 에 저장소(.git 이 있는 폴더)가 없는 것 같습니다.'
  Write-Host '  내려받으려면:  git clone https://github.com/nabaho/pureunall.git'
  Write-Host '  그래도 안 되면 클로드에게 이 화면을 보여 주세요.'
  Read-Host '엔터를 누르면 닫힙니다'
  exit 1
}

$dir = $found.DirectoryName
Set-Location -LiteralPath $dir
Write-Host ("폴더: " + $dir) -ForegroundColor Green
Write-Host '  (다음부터는 이 폴더의 scripts\나스-올리기.bat 을 두 번 누르시면 됩니다)'
Write-Host ''

Write-Host '[1/2] 최신으로 맞춥니다...'
git pull
if ($LASTEXITCODE -ne 0) {
  Write-Host '✗ git pull 이 안 됐습니다. 위 메시지를 그대로 클로드에게 보여 주세요.' -ForegroundColor Red
  Read-Host '엔터를 누르면 닫힙니다'
  exit 1
}

Write-Host ''
Write-Host '[2/2] 올립니다...'
node scripts/nas-backup-deploy.js --deploy
Write-Host ''
Read-Host '엔터를 누르면 닫힙니다'
