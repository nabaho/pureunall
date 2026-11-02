# Registers the KakaoTalk agent as a "run at logon" scheduled task (design doc 2026-10-31-consult-settle-design.md section 7).
#
# NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a .ps1 without a BOM as the
# ANSI code page, so Korean text in here would turn into garbage.
#
# Usage (normal PowerShell window, no admin needed):
#   .\install-task.ps1 -RepoDir C:\path\to\a\STABLE\checkout\of\pureunall
#   .\install-task.ps1 -Remove
#
# Use a checkout that stays put (not a throw-away worktree) and keep it up to date with git pull.
# This script changes the PC's scheduled tasks - run it only after the representative approved it.
# The task must run in the logged-on user's session (it talks to the KakaoTalk PC window), so it uses
# an AtLogOn trigger for the current user and is not set to "run whether user is logged on or not".
param(
  [string]$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$Remove
)

$name = 'PureunKakaoAgent'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task $name"
  exit 0
}

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $RepoDir 'scripts\kakao-agent\main.js'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $RepoDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Pureun KakaoTalk agent (sends confirmed settlement messages through KakaoTalk PC)' | Out-Null
Write-Host "Registered task $name -> $node $script"
Write-Host "It starts at the next logon. To start now: Start-ScheduledTask -TaskName $name"
