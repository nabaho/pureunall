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
# ⚠★★ 「.git 이 있으면 저장소」로는 안 갈린다 (2026-09-18 대표 화면 둘째)
#    Documents\pu-deploy 는 거절했더니, 다음은 pureunall-deploy 가 잡혔다 — 이름부터
#    「배포」다. 배포 결과물도 .git 이 있을 수 있고(스스로 커밋해 올리는 자리일 수 있다),
#    배포 워크플로(deploy-pages.yml)는 올리기 «전에» scripts 폴더를 통째로 지운다.
#    그래서 진짜 조건은 «지금 찾는 그 파일이 실제로 있는가»다 — 짐작이 아니라 확인이다.
foreach ($root in @($env:USERPROFILE, 'C:\', 'D:\')) {
  if (-not (Test-Path $root)) { continue }
  $found = Get-ChildItem -Path $root -Filter 'pu-erp.html' -Recurse -File -ErrorAction SilentlyContinue |
           Where-Object {
             (Test-Path (Join-Path $_.DirectoryName '.git')) -and
             (Test-Path (Join-Path $_.DirectoryName 'scripts\nas-backup-deploy.js'))
           } |
           Select-Object -First 1
  if ($found) { break }
}

if ($found) {
  $dir = $found.DirectoryName
  Write-Host ("폴더을 찾았습니다: " + $dir) -ForegroundColor Green
} else {
  # ⚠ 「없다」고 사람에게 되돌리지 않는다 — 새로 내려받는 것까지 여기서 한다.
  #   이미 있던 자리(pu-deploy·pureunall-deploy 등 배포 사본)와 안 겹치는 새 이름을 쓴다.
  Write-Host '이 PC 에 «완전한» 저장소가 안 보입니다 (배포 사본만 있는 것 같습니다) — 새로 받습니다.' -ForegroundColor Yellow
  $dir = Join-Path $env:USERPROFILE 'Documents\pureunall-작업용'
  if (-not (Test-Path $dir)) {
    git clone https://github.com/nabaho/pureunall.git $dir
    if ($LASTEXITCODE -ne 0) {
      Write-Host '✗ 내려받지 못했습니다. 인터넷 연결과 git 설치를 확인하세요.' -ForegroundColor Red
      Read-Host '엔터를 누르면 닫힙니다'
      exit 1
    }
  }
  Write-Host ("폴더를 새로 만들었습니다: " + $dir) -ForegroundColor Green
}

Set-Location -LiteralPath $dir
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
