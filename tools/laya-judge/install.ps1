<#
  푸른노무법인 경력관리 «요청 메일» — Laya 판단기를 이 PC 에 깐다 (대표 지시 2026-11-19)

  하는 일
    1) %LOCALAPPDATA%\PureunLaya\.venv 에 따로 쓰는 파이썬 칸을 만들고 laya 를 «정해진 판»으로 깐다(다른 프로그램과 섞이지 않게).
    2) laya_judge.py 를 그 폴더로 옮기고, 못 박은 판의 다국어 모델(약 650MB)을 한 번 받아 둔다 — 인터넷은 이때만 쓴다.
    3) -AutoStart 를 주면 윈도우 «시작 프로그램»에 바로가기를 둔다 — 로그인할 때 창 없이(pythonw) 켜진다.
    4) 바로 켠다(-NoStart 를 주면 안 켠다).

  쓰는 법 (PowerShell)
    powershell -ExecutionPolicy Bypass -File tools\laya-judge\install.ps1 -AutoStart
  지우는 법
    powershell -ExecutionPolicy Bypass -File tools\laya-judge\uninstall.ps1

  지키는 것: 판단기는 127.0.0.1 에만 묶이고, 받은 제목·첨부 이름을 저장·기록하지 않는다(laya_judge.py 머리말).
#>
param([switch]$AutoStart, [switch]$NoStart)
$ErrorActionPreference = 'Stop'

$LayaVersion = '0.4.37'                                   # laya_judge.py LAYA_VERSION 과 같다
$Dir = Join-Path $env:LOCALAPPDATA 'PureunLaya'
$Venv = Join-Path $Dir '.venv'
$Py = Join-Path $Venv 'Scripts\python.exe'
$Pyw = Join-Path $Venv 'Scripts\pythonw.exe'
$Script = Join-Path $Dir 'laya_judge.py'
$Startup = [Environment]::GetFolderPath('Startup')
$Link = Join-Path $Startup 'Pureun Laya 판단기.lnk'

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$uv = Get-Command uv -ErrorAction SilentlyContinue

if (-not (Test-Path $Py)) {
  Write-Host '① 파이썬 칸 만들기'
  if ($uv) { & uv venv --python 3.13 $Venv } else { & py -3 -m venv $Venv }
  if ($LASTEXITCODE -ne 0) { throw '파이썬 칸을 만들지 못했습니다 — Python 3.10 이상이 필요합니다' }
}

Write-Host "② laya $LayaVersion 깔기"
if ($uv) { & uv pip install --python $Py "laya==$LayaVersion" } else { & $Py -m pip install "laya==$LayaVersion" }
if ($LASTEXITCODE -ne 0) { throw 'laya 를 깔지 못했습니다' }

Write-Host '③ 판단기 옮기기 · 모델 받기(처음 한 번 — 약 650MB)'
Copy-Item -Force -Path (Join-Path $PSScriptRoot 'laya_judge.py') -Destination $Script
$env:PYTHONUTF8 = '1'
& $Py $Script --download
if ($LASTEXITCODE -ne 0) { throw '모델을 받지 못했습니다' }

if ($AutoStart) {
  Write-Host '④ 로그인할 때 켜기 — 시작 프로그램에 바로가기'
  $sh = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut($Link)
  $lnk.TargetPath = $Pyw
  $lnk.Arguments = '"' + $Script + '"'
  $lnk.WorkingDirectory = $Dir
  $lnk.Description = '푸른 경력관리 요청 메일 — Laya 판단기(이 PC 안에서만, 127.0.0.1:18766)'
  $lnk.Save()
}

if (-not $NoStart) {
  # 이미 켜져 있으면 끄고 다시 켠다 — 옛 판단기가 옛 자리(2026-11-21 전 18765)를 계속 쥐고 있지 않게.
  # 끄는 것은 명령줄이 «이 폴더의 파이썬 칸 + 이 폴더의 laya_judge.py» 인 것만(다른 곳의 같은 이름 파일·다른 파이썬은 안 건드린다).
  # 실행 파일 경로로 거르지 않는다 — 파이썬 칸의 pythonw 는 바탕 파이썬을 자식으로 띄우고, 자리를 쥔 것은 그 자식이다(명령줄은 같다).
  $running = @(Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($Venv, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $_.CommandLine.IndexOf($Script, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
  if ($running.Count) {
    Write-Host '⑤ 켜져 있던 판단기를 끄고 새로 켜기'
    $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
  } else { Write-Host '⑤ 켜기' }
  $p = Start-Process -FilePath $Pyw -ArgumentList ('"' + $Script + '"') -WorkingDirectory $Dir -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 3
  if ($p.HasExited) { Write-Warning ('판단기가 켜지자마자 끝났습니다 — 기록을 보세요: ' + (Join-Path $Dir 'laya-judge.log')) }
}
Write-Host '끝 — 경력관리 «요청 메일» 화면에서 «🧠 Laya 의견 켜기»를 누르면 이 PC 의 판단기에게 묻습니다.'
