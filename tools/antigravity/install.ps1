# 구글 안티그래비티(Antigravity) + REA(Reverse Engineer Anything) 설치 — 대표 PC(윈도)에서 한 번 돌린다
# (대표 지시 2026-10-24 「구글 안티그래피티 최신 버전 … 깔고 REA 도 연결시켜줘」)
#
# 사람이 누르는 것:
#   ① 안티그래비티 설치 창 — 다음 → 설치 → 마침
#   ② (Node.js 가 없거나 낡았으면) Node.js 설치를 할지 y
#   ③ REA 설정이 보여 주는 «바꿀 내용» 을 보고 승인
# 나머지(최신 주소 찾기 · 받기 · 서명 확인 · 실행 · REA 등록 · 점검)는 이 스크립트가 한다.
#
# ⚠ 받는 곳은 Google 공식 다운로드 페이지(antigravity.google/download)가 가리키는 storage.googleapis.com 파일뿐이다.
#   주소 안의 판 번호(2.26.0-… 같은 것)는 판마다 바뀌어서 박지 않고 페이지에서 그때그때 읽는다.
# ⚠ 서명이 Google LLC 가 아니거나 서명이 깨졌으면(HashMismatch) 실행하지 않고 지운다.
# ⚠ 조용히 깔지 않는다(/S 같은 것 없음).
# ⚠ REA 는 공식 npm 꾸러미 rea-agents 의 setup 만 쓴다 — 바꿀 내용을 먼저 보여 주고 승인해야 기록한다.
# ⚠ BOM 을 지우지 말 것 — 윈도 PowerShell 5.1 은 BOM 없는 파일을 ANSI 로 읽어 한글이 깨진다.
# 쓰는 규칙: docs/안티그래비티-REA-설치.md

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # PS 5.1 은 진행 막대 때문에 받기가 몇 배 느려진다
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PAGE_URL       = 'https://antigravity.google/download'
$NODE_URL       = 'https://nodejs.org/'
$SIGNER_PATTERN = 'O=Google LLC'
# REA 가 요구하는 Node.js — 22.x(>=22.23.4) · 24.x(>=24.22.1) · 26.12.1 이상 (만든 쪽 README)
$NODE_MIN = @{ 22 = [version]'22.23.4'; 24 = [version]'24.22.1'; 26 = [version]'26.12.1' }

function Say([string]$msg, [string]$color) {
  if ($color) { Write-Host $msg -ForegroundColor $color } else { Write-Host $msg }
}
function Stop-Here([string]$msg) {
  Say ''
  Say "[멈춤] $msg" Red
  Say ''
  Read-Host '엔터를 누르면 닫힙니다' | Out-Null
  exit 1
}

# 설치가 PATH 를 바꿔도 이미 떠 있는 창은 옛 PATH 를 쥐고 있다 — 레지스트리에서 다시 읽는다
function Update-PathFromRegistry {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($m, $u) | Where-Object { $_ }) -join ';'
}

# 이미 깔린 안티그래비티 — 프로그램 추가/제거 목록에서 찾는다
function Find-Antigravity {
  $keys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like '*Antigravity*' } |
    Select-Object -First 1
}

function Test-NodeOk([string]$v) {
  $m = [regex]::Match($v, '(\d+)\.(\d+)\.(\d+)')
  if (-not $m.Success) { return $false }
  $ver = [version]$m.Value
  $major = $ver.Major
  if ($major -ge 27) { return $true }
  if ($NODE_MIN.ContainsKey($major)) { return ($ver -ge $NODE_MIN[$major]) }
  return $false   # 23·25 홀수판과 22 미만은 안 된다
}

Say '=== 구글 안티그래비티 + REA 설치 ===' Cyan
Say ''

# ── 1부. 안티그래비티 ──────────────────────────────────────────────
$arch = $env:PROCESSOR_ARCHITECTURE
if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
switch ($arch) {
  'AMD64' { $plat = 'windows-x64'; $file = 'Antigravity-x64\.exe' }
  'ARM64' { $plat = 'windows-arm'; $file = 'Antigravity-arm64\.exe' }
  default { Stop-Here "이 PC 는 안티그래비티 윈도판이 없는 종류입니다 ($arch)." }
}

Say '1/5 공식 다운로드 페이지에서 최신 주소를 찾는 중...'
$page = ''
try { $page = (Invoke-WebRequest -Uri $PAGE_URL -UseBasicParsing).Content } catch { }
$pattern = 'https://storage\.googleapis\.com/antigravity-public/antigravity-hub/([0-9.]+)-[0-9]+/' + $plat + '/' + $file
$found = [regex]::Match($page, $pattern)
if (-not $found.Success) {
  Start-Process $PAGE_URL
  Stop-Here '설치 파일 주소를 못 찾았습니다. 방금 연 공식 페이지에서 윈도용을 받아 설치한 뒤, 이 파일을 다시 실행해 주십시오(REA 연결은 그때 이어서 합니다).'
}
$url = $found.Value
$latest = $found.Groups[1].Value
Say "    최신 판: $latest"

$have = Find-Antigravity
$skip = $false
if ($have) {
  Say "    깔린 판: $($have.DisplayVersion) ($($have.DisplayName))"
  if ("$($have.DisplayVersion)" -eq $latest) {
    Say '[있음] 이미 최신 판입니다 — 받기를 건너뜁니다.' Green
    $skip = $true
  } else {
    $ans = Read-Host '최신 판으로 덮어 설치할까요? (y = 설치 / 엔터 = 건너뛰기)'
    if ($ans -ne 'y') { $skip = $true }
  }
}

if (-not $skip) {
  $dir = Join-Path $env:TEMP 'antigravity-install'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $exe = Join-Path $dir 'AntigravitySetup.exe'
  Say "2/5 받는 중... (150MB 남짓) $url"
  try { Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing }
  catch { Stop-Here "받기에 실패했습니다 — 인터넷 연결을 보고 다시 실행해 주십시오. ($($_.Exception.Message))" }

  # 서명 확인 — 실행하기 «전에» 한다
  Say '3/5 서명 확인 중...'
  $sig = Get-AuthenticodeSignature -FilePath $exe
  $signer = ''
  if ($sig.SignerCertificate) { $signer = $sig.SignerCertificate.Subject }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $exe).Hash
  Say "    서명 상태 : $($sig.Status)"
  Say "    서명한 곳 : $signer"
  Say "    SHA256    : $hash"
  if ("$($sig.Status)" -eq 'HashMismatch') {
    Remove-Item $exe -Force
    Stop-Here '서명이 깨져 있습니다(받는 도중 바뀐 파일). 실행하지 않고 지웠습니다.'
  }
  if (-not $signer -or ($signer -notmatch $SIGNER_PATTERN)) {
    Remove-Item $exe -Force
    Stop-Here '서명한 곳이 Google LLC 가 아닙니다. 실행하지 않고 지웠습니다.'
  }
  if ("$($sig.Status)" -ne 'Valid') {
    Say ''
    Say "[주의] 서명이 '유효(Valid)'가 아닙니다 ($($sig.Status)). 공식 주소에서 받은 파일이긴 합니다." Yellow
    $ans = Read-Host '그래도 실행할까요? (y = 실행 / 엔터 = 멈춤)'
    if ($ans -ne 'y') { Stop-Here "멈췄습니다. 받은 파일은 남겨 두었습니다: $exe" }
  }

  Say ''
  Say '4/5 설치 창을 엽니다 — 다음 → 설치 → 마침 을 눌러 주십시오.' Cyan
  Say '   (설치 창을 닫으면 여기서 REA 연결로 넘어갑니다)'
  # 조용히 깔지 않는다. -Wait 대신 설치 프로그램 하나만 기다린다 — 마칠 때 앱을 띄우면 -Wait 가 앱까지 기다린다.
  $p = Start-Process -FilePath $exe -PassThru
  $p.WaitForExit()
  $have = Find-Antigravity
  if ($have) { Say "[확인] 안티그래비티 $($have.DisplayVersion) 이(가) 깔렸습니다." Green }
  else { Say '[주의] 프로그램 목록에서 안티그래비티를 못 찾았습니다. 설치를 끝냈는지 봐 주십시오. REA 연결은 이어서 합니다.' Yellow }
  Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
}

# ── 2부. REA 를 안티그래비티에 잇기 ──────────────────────────────────
Say ''
Say '5/5 REA(Reverse Engineer Anything) 연결' Cyan
Update-PathFromRegistry
$nodeV = ''
if (Get-Command node -ErrorAction SilentlyContinue) { $nodeV = & node -v }
if (-not (Test-NodeOk "$nodeV")) {
  if ($nodeV) { Say "    Node.js $nodeV — REA 에는 22.23.4+ · 24.22.1+ · 26.12.1+ 가 필요합니다." Yellow }
  else { Say '    Node.js 가 없습니다 — REA 는 Node.js 로 돌아갑니다.' Yellow }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $ans = Read-Host 'winget 으로 Node.js LTS 를 설치(또는 올리기)할까요? (y = 설치 / 엔터 = 멈춤)'
    if ($ans -ne 'y') { Stop-Here 'REA 연결을 멈췄습니다. 안티그래비티는 그대로 쓰실 수 있습니다.' }
    & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    Update-PathFromRegistry
    $nodeV = ''
    if (Get-Command node -ErrorAction SilentlyContinue) { $nodeV = & node -v }
  }
  if (-not (Test-NodeOk "$nodeV")) {
    Start-Process $NODE_URL
    Stop-Here "Node.js 를 맞추지 못했습니다(지금: '$nodeV'). 방금 연 nodejs.org 에서 LTS 를 깐 뒤 이 파일을 다시 실행해 주십시오."
  }
}
Say "[확인] Node.js $nodeV" Green

Say ''
Say 'REA 설정이 «바꿀 내용» 을 먼저 보여 줍니다 — 읽어 보시고 승인해 주십시오.' Cyan
# npx.ps1 대신 npx.cmd — 실행 정책에 걸리지 않게
& npx.cmd -y rea-agents@latest setup --client antigravity
if ($LASTEXITCODE -ne 0) { Stop-Here "REA 설정이 실패했습니다(종료코드 $LASTEXITCODE). 위 메시지를 그대로 알려 주십시오." }

Say ''
Say 'REA 점검 중...'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'   # 'Stop' 인 채로 stderr 를 받으면 PS 5.1 은 안내 한 줄에도 멈춘다
& npx.cmd -y rea-agents@latest doctor --client antigravity
$doc = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($doc -ne 0) { Say '[주의] 점검에 걸린 것이 있습니다 — 위 내용을 알려 주시면 이어서 봅니다.' Yellow }
else { Say '[확인] REA 가 안티그래비티에 등록됐습니다.' Green }

Say ''
Say '=== 끝났습니다 ===' Cyan
Say '안티그래비티를 껐다 다시 켜야 REA 가 보입니다.'
Say '맡기지 않는 것: 권리가 없는 남의 프로그램 분석 · 고객 자료(주민번호·임금대장)가 든 파일 분석'
Say '  (분석 결과는 안티그래비티가 쓰는 AI 회사로 넘어갑니다)'
Say '지우기: 윈도 설정 → 앱 → Antigravity 제거 · REA 는 npx rea-agents uninstall --client antigravity'
Say ''
Read-Host '엔터를 누르면 닫힙니다' | Out-Null
