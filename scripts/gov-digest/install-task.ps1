# Registers the daily government-support KakaoTalk digest as a scheduled task (runs every day at 08:30).
#
# NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a .ps1 without a BOM as the
# ANSI code page, so Korean text in here would turn into garbage.
#
# Usage (normal PowerShell window, no admin needed):
#   .\install-task.ps1 -RepoDir C:\path\to\a\STABLE\checkout\of\pureunall
#   .\install-task.ps1 -Time 09:00
#   .\install-task.ps1 -Remove
#
# Use a checkout that stays put (not a throw-away worktree) and keep it up to date with git pull.
# This script changes the PC's scheduled tasks - run it only after the representative approved it.
# The server collects notices at 07:20 / 07:40 KST, so the default time is 08:30.
# The task must run in the logged-on user's session (it talks to the KakaoTalk PC window), so it runs only
# while the user is logged on. If the PC was off at that time it runs at the next start (StartWhenAvailable).
param(
  [string]$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Time = '08:30',
  [switch]$Remove
)

$name = 'PureunGovDigest'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task $name"
  exit 0
}

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $RepoDir 'scripts\gov-digest\main.js'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '" --send') -WorkingDirectory $RepoDir
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Registered task $name (daily $Time) -> $node `"$script`" --send"
Write-Host "Test now:  node `"$script`"          (preview, sends nothing)"
Write-Host "Remove:    .\install-task.ps1 -Remove"
