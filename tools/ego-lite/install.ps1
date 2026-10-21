# 에고라이트(ego lite) 설치 — 대표 PC(윈도 x64)에서 한 번 돌린다 (대표 지시 2026-10-21 「내 컴퓨터에 설치해서 다 전부까지」)
#
# 사람이 누르는 것은 둘뿐이다:
#   ① 윈도 「PC 보호」 창이 뜨면 «추가 정보 → 실행»
#   ② 에고라이트 첫 화면(온보딩) — 「크롬 자료를 옮길까요?」는 «아니요»를 권한다
# 나머지(받기 · 서명 확인 · 실행 · 명령 등록 확인 · 작동 확인 · 스킬 확인)는 이 스크립트가 한다.
#
# ⚠ 받는 곳은 만든 쪽 GitHub README 가 가리키는 cdn.ego.app 설치 파일뿐이다.
#   주소 끝 글자(…-Y7MbxKIuhzFB.exe 같은 것)는 판마다 바뀌어서 박지 않고 README 에서 그때그때 읽는다.
# ⚠ 조용히 깔지 않는다(/S 같은 것 없음) — 크롬 자료를 옮길지는 사람이 고른다.
# ⚠ 서명이 Citro Labs 가 아니거나 서명이 깨졌으면(HashMismatch) 실행하지 않고 지운다.
# ⚠ BOM 을 지우지 말 것 — 윈도 PowerShell 5.1 은 BOM 없는 파일을 ANSI 로 읽어 한글이 깨진다.
# 검토·쓰는 규칙: docs/에고라이트-검토.md · CLAUDE.md 「에고라이트」 절

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # PS 5.1 은 진행 막대 때문에 받기가 몇 배 느려진다
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$README_URL     = 'https://raw.githubusercontent.com/citrolabs/ego-lite/main/README.md'
$SITE_URL       = 'https://lite.ego.app/'
$EXE_PATTERN    = 'https://cdn\.ego\.app/setup/windows/x64/egoliteSetup-[A-Za-z0-9]+\.exe'
$SIGNER_PATTERN = 'Citro'
$WAIT_MINUTES   = 20

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

# 설치·온보딩이 PATH 를 바꿔도 이미 떠 있는 창은 옛 PATH 를 쥐고 있다 — 레지스트리에서 다시 읽는다
function Update-PathFromRegistry {
  $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $u = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($m, $u) | Where-Object { $_ }) -join ';'
}

function Find-EgoBrowser {
  Update-PathFromRegistry
  $c = Get-Command ego-browser -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  # 맥은 온보딩이 ~/.local/bin 에 넣는다(만든 쪽 안내). 윈도도 그 자리에 두고 PATH 만 못 걸었을 때를 받친다
  $local = Join-Path $env:USERPROFILE '.local\bin'
  $hit = Get-ChildItem -Path $local -Filter 'ego-browser*' -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hit) { $env:Path = "$local;$env:Path"; return $hit.FullName }
  return $null
}

Say '=== 에고라이트(ego lite) 설치 ===' Cyan
Say ''

# 1. 이 PC 에서 되는가 — 만든 쪽은 윈도 x64 만 낸다(ARM 은 없다)
$arch = $env:PROCESSOR_ARCHITECTURE
if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
if ($arch -ne 'AMD64') { Stop-Here "에고라이트는 윈도 x64 만 됩니다 (이 PC: $arch)." }

$ego = Find-EgoBrowser
if ($ego) {
  Say "[있음] 이미 깔려 있습니다 — 받기를 건너뜁니다: $ego" Green
} else {
  # 2. 설치 파일 주소 — 만든 쪽 README 에서 읽는다
  Say '1/4 공식 설치 파일 주소를 찾는 중...'
  $readme = ''
  try { $readme = (Invoke-WebRequest -Uri $README_URL -UseBasicParsing).Content } catch { }
  $found = [regex]::Match($readme, $EXE_PATTERN)
  if (-not $found.Success) {
    Start-Process $SITE_URL
    Stop-Here '설치 파일 주소를 못 찾았습니다. 방금 연 공식 사이트에서 윈도용을 받아 실행한 뒤, 이 파일을 다시 실행해 주십시오.'
  }
  $url = $found.Value

  # 3. 받기
  $dir = Join-Path $env:TEMP 'ego-lite-install'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $exe = Join-Path $dir 'egoliteSetup.exe'
  Say "2/4 받는 중... $url"
  try { Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing }
  catch { Stop-Here "받기에 실패했습니다 — 인터넷 연결을 보고 다시 실행해 주십시오. ($($_.Exception.Message))" }

  # 4. 서명 확인 — 실행하기 «전에» 한다
  Say '3/4 서명 확인 중...'
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
  if ($signer -and ($signer -notmatch $SIGNER_PATTERN)) {
    Remove-Item $exe -Force
    Stop-Here '서명한 곳이 Citro Labs 가 아닙니다. 실행하지 않고 지웠습니다.'
  }
  if ("$($sig.Status)" -ne 'Valid') {
    Say ''
    Say "[주의] 서명이 '유효(Valid)'가 아닙니다 ($($sig.Status)). 공식 주소에서 받은 파일이긴 합니다." Yellow
    $ans = Read-Host '그래도 실행할까요? (y = 실행 / 엔터 = 멈춤)'
    if ($ans -ne 'y') { Stop-Here "멈췄습니다. 받은 파일은 남겨 두었습니다: $exe" }
  }

  # 5. 실행 — 조용히 깔지 않는다(크롬 자료를 옮길지는 사람이 고른다)
  Say ''
  Say '4/4 설치 프로그램을 엽니다. 대표님이 누르실 것:' Cyan
  Say '   - 윈도 「PC 보호」 창이 뜨면 : 추가 정보 → 실행'
  Say '   - 「크롬 자료를 옮길까요?」   : 아니요 (권장 — 필요한 사이트만 에고라이트에서 따로 로그인)'
  Say '   - 오류 보고(crash report)     : 보이면 끄기'
  Say '   - 은행·홈택스·4대보험 EDI·푸른 대표 계정은 에고라이트에 로그인하지 않기'
  Say ''
  Start-Process -FilePath $exe
  # -Wait 를 쓰지 않는다 — 설치 프로그램은 앱을 띄우고 먼저 끝날 수 있다.
  # «다 됐다»의 진짜 신호는 온보딩이 ego-browser 명령을 등록하는 것이다(만든 쪽 안내).
  Say "첫 설정(온보딩)을 마치면 여기서 저절로 다음으로 넘어갑니다. (최대 $WAIT_MINUTES 분)"
  $deadline = (Get-Date).AddMinutes($WAIT_MINUTES)
  while ((-not $ego) -and ((Get-Date) -lt $deadline)) {
    Start-Sleep -Seconds 5
    $ego = Find-EgoBrowser
  }
  if (-not $ego) {
    Stop-Here "$WAIT_MINUTES 분 안에 ego-browser 명령이 생기지 않았습니다. 에고라이트를 다시 열어 첫 설정을 끝낸 뒤 이 파일을 다시 실행해 주십시오."
  }
  Say "[확인] ego-browser 명령이 생겼습니다: $ego" Green
  Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
}

# 6. 돌아가는가 — 만든 쪽 확인법 그대로(PowerShell 에는 heredoc 이 없어 -e)
Say ''
Say '작동 확인 중...'
# 'Stop' 인 채로 2>&1 을 걸면 PS 5.1 은 stderr 한 줄(새 판 알림 등)에도 멈춘다 — 이 줄만 'Continue'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$out = (& $ego nodejs -e "console.log('ego-browser ready')" 2>&1 | Out-String)
$ErrorActionPreference = $prevEap
if ($out -notmatch 'ego-browser ready') {
  Say $out
  Stop-Here '작동 확인이 안 됩니다. 에고라이트 앱을 열어 둔 채로 이 파일을 다시 실행해 주십시오.'
}
Say '[확인] ego-browser ready' Green

# 7. Claude Code 스킬 — 앱이 스스로 넣는다. 안 보이면 만든 쪽 공식 명령으로
$skill = Join-Path $env:USERPROFILE '.claude\skills\ego-browser\SKILL.md'
if (Test-Path $skill) {
  Say "[확인] Claude Code 스킬: $skill" Green
} else {
  Say "[주의] Claude Code 스킬이 아직 안 보입니다: $skill" Yellow
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    $ans = Read-Host '만든 쪽 공식 명령(npx skills add citrolabs/ego-lite)으로 넣을까요? (y = 넣기 / 엔터 = 건너뛰기)'
    if ($ans -eq 'y') { & npx -y skills add citrolabs/ego-lite }
  } else {
    Say '   Node.js(npx)가 없어 건너뜁니다. 에고라이트를 껐다 켠 뒤 이 파일을 다시 실행해 보십시오.'
  }
}

Say ''
Say '=== 끝났습니다 ===' Cyan
Say 'Claude Code 를 새로 켜고 이렇게 시키십시오:'
Say '  /ego-browser 고용24·기업마당에서 이번 달 고용 지원사업 공고를 모아 표로 정리해 줘'
Say ''
Say '맡기지 않는 것: 은행·홈택스·EDI · 로그인된 푸른 앱에서 저장/삭제 · 발송·제출 (CLAUDE.md 「에고라이트」 절)'
Say '지우기: 윈도 설정 → 앱 → ego lite 제거. 남으면 %USERPROFILE%\.claude\skills\ego-browser 폴더도 삭제'
Say ''
Read-Host '엔터를 누르면 닫힙니다' | Out-Null
