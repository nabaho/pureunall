# Registers the read-only PC KakaoTalk screen & popup OCR watcher as a run-at-logon scheduled task.
#
# NOTE: Pure ASCII only. Windows PowerShell 5.1 treats a .ps1 without BOM as ANSI.
# Usage (run only after the representative approves):
#   .\install-task.ps1 -RepoDir C:\path\to\pureunall
#   .\install-task.ps1 -Remove
param(
  [string]$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$Remove
)

$name = 'PureunKakaoWatchAgent'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task $name"
  exit 0
}

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $RepoDir 'scripts\kakao-watch-agent\main.js'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $RepoDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Pureun read-only KakaoTalk screen & popup offline-OCR watcher' | Out-Null
Write-Host "Registered task $name -> $node $script"
Write-Host "Starts at next logon. To run now: Start-ScheduledTask -TaskName $name"
