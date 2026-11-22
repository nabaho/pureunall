<#
  푸른 경력관리 «요청 메일» — Laya 판단기 지우기 (install.ps1 의 반대)
    1) 켜져 있는 판단기를 끈다  2) 시작 프로그램 바로가기를 지운다  3) %LOCALAPPDATA%\PureunLaya 폴더를 지운다
  받아 둔 모델(약 650MB)은 Hugging Face 공용 저장소(%USERPROFILE%\.cache\huggingface\hub\models--convaiinnovations--laya)에 남는다 —
  -RemoveModel 을 주면 그것도 지운다.
  쓰는 법: powershell -ExecutionPolicy Bypass -File tools\laya-judge\uninstall.ps1 [-RemoveModel]
#>
param([switch]$RemoveModel)
$ErrorActionPreference = 'Stop'
$Dir = Join-Path $env:LOCALAPPDATA 'PureunLaya'
$Link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Pureun Laya 판단기.lnk'

Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*laya_judge.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false; Write-Host ('판단기를 껐습니다 (PID ' + $_.ProcessId + ')') }
if (Test-Path $Link) { Remove-Item -LiteralPath $Link -Force -Confirm:$false; Write-Host '시작 프로그램 바로가기를 지웠습니다' }
if (Test-Path $Dir) { Remove-Item -LiteralPath $Dir -Recurse -Force -Confirm:$false; Write-Host ('지웠습니다: ' + $Dir) }
if ($RemoveModel) {
  $m = Join-Path $env:USERPROFILE '.cache\huggingface\hub\models--convaiinnovations--laya'
  if (Test-Path $m) { Remove-Item -LiteralPath $m -Recurse -Force -Confirm:$false; Write-Host ('모델도 지웠습니다: ' + $m) }
}
Write-Host '끝 — 경력관리 화면의 «🧠 Laya 의견»은 꺼 두세요(켜 두면 10분마다 닿지 못했다고 쉽니다).'
