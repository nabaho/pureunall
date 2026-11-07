# Puts one message into a KakaoTalk PC chat window (design doc 2026-10-31-consult-settle-design.md section 7).
#
# NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a .ps1 without a BOM as the
# ANSI code page, so Korean text in here would turn into garbage. The room name and the message come in
# a UTF-8 JSON job file instead ({"room": "...", "text": "..."}).
#
# Only window messages are used (WM_SETTEXT / WM_GETTEXT / PostMessage of the Enter key) - no mouse, no
# keyboard, no clipboard - so the person working on this PC is not disturbed.
#
# Modes:
#   -Mode probe   only checks that KakaoTalk is running and its windows can be found (sends nothing,
#                 opens nothing, prints no chat names)
#   -Mode send    opens the chat (if it is not open yet) through the chat-list search box, checks that the
#                 window title is EXACTLY the room name, puts the text in, presses Enter, and checks that
#                 the input box became empty
#
# Output: one line of JSON, ASCII only: {"ok":true} or {"ok":false,"code":"...","error":"...","locked":false}
param(
  [string]$JobFile = '',
  [string]$Mode = 'send'
)
$ErrorActionPreference = 'Stop'

function Out-Result($o) { Write-Output ($o | ConvertTo-Json -Compress) }

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class KakaoWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, StringBuilder l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string t);

  public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
  public static string Cls(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
  public static string Norm(string s) {
    if (s == null) return "";
    var t = s.Replace((char)0x00A0, (char)0x20).Trim();
    while (t.Contains("  ")) t = t.Replace("  ", " ");
    return t;
  }
  public static List<IntPtr> TopOf(uint pid, bool visibleOnly) {
    var r = new List<IntPtr>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid && (!visibleOnly || IsWindowVisible(h))) r.Add(h);
      return true;
    }, IntPtr.Zero);
    return r;
  }
  public static List<IntPtr> Kids(IntPtr parent, string cls) {
    var r = new List<IntPtr>();
    EnumChildWindows(parent, delegate (IntPtr h, IntPtr l) { if (Cls(h) == cls) r.Add(h); return true; }, IntPtr.Zero);
    return r;
  }
  public static string TextOf(IntPtr h) {
    int n = (int)SendMessage(h, 0x000E, IntPtr.Zero, IntPtr.Zero);
    var sb = new StringBuilder(n + 2);
    SendMessage(h, 0x000D, new IntPtr(n + 1), sb);
    return sb.ToString();
  }
  public static int TextLen(IntPtr h) { return (int)SendMessage(h, 0x000E, IntPtr.Zero, IntPtr.Zero); }
  public static void SetText(IntPtr h, string s) { SendMessage(h, 0x000C, IntPtr.Zero, s); }
  public static void Enter(IntPtr h) {
    PostMessage(h, 0x0100, new IntPtr(0x0D), IntPtr.Zero);
    PostMessage(h, 0x0101, new IntPtr(0x0D), new IntPtr(unchecked((int)0xC0000001)));
  }
}
'@

$WM_INPUT_CLASS = 'RICHEDIT50W'
$MAIN_CLASS = 'EVA_Window_Dblclk'

function Is-Locked { return [bool](Get-Process -Name LogonUI -ErrorAction SilentlyContinue) }

$proc = Get-Process -Name KakaoTalk -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Out-Result @{ ok = $false; code = 'not-running'; error = 'KakaoTalk is not running'; locked = (Is-Locked) }; exit 0 }
$procId = [uint32]$proc.Id

$all = [KakaoWin]::TopOf($procId, $false)
# The main window and the chat windows share the same class here - the main one is the window that holds the
# chat list: EVA_ChildWindow -> EVA_Window (friends) -> EVA_Window (chats).
$main = $null
foreach ($h in $all) {
  if ([KakaoWin]::Cls($h) -ne $MAIN_CLASS) { continue }
  $c = [KakaoWin]::FindWindowEx($h, [IntPtr]::Zero, 'EVA_ChildWindow', [NullString]::Value)
  if ($c -ne [IntPtr]::Zero -and [KakaoWin]::FindWindowEx($c, [IntPtr]::Zero, 'EVA_Window', [NullString]::Value) -ne [IntPtr]::Zero) { $main = $h; break }
}

# chat-list search box: main -> EVA_ChildWindow -> 2nd EVA_Window (chats) -> Edit
function Find-ChatSearch($mainH) {
  if (-not $mainH) { return [IntPtr]::Zero }
  $child = [KakaoWin]::FindWindowEx($mainH, [IntPtr]::Zero, 'EVA_ChildWindow', [NullString]::Value)
  if ($child -eq [IntPtr]::Zero) { return [IntPtr]::Zero }
  $friends = [KakaoWin]::FindWindowEx($child, [IntPtr]::Zero, 'EVA_Window', [NullString]::Value)
  if ($friends -eq [IntPtr]::Zero) { return [IntPtr]::Zero }
  $chats = [KakaoWin]::FindWindowEx($child, $friends, 'EVA_Window', [NullString]::Value)
  if ($chats -eq [IntPtr]::Zero) { return [IntPtr]::Zero }
  return [KakaoWin]::FindWindowEx($chats, [IntPtr]::Zero, 'Edit', [NullString]::Value)
}

# visible top-level KakaoTalk windows that have a chat input box
function Get-ChatWindows {
  $r = @()
  foreach ($h in [KakaoWin]::TopOf($procId, $true)) {
    if ($h -eq $main) { continue }
    if ([KakaoWin]::Kids($h, $WM_INPUT_CLASS).Count -gt 0) { $r += $h }
  }
  return $r
}

if ($Mode -eq 'probe') {
  $search = Find-ChatSearch $main
  Out-Result @{ ok = $true; running = $true; mainWindow = [bool]$main; chatSearch = ($search -ne [IntPtr]::Zero); openChats = @(Get-ChatWindows).Count; locked = (Is-Locked) }
  exit 0
}

if (-not $JobFile -or -not (Test-Path -LiteralPath $JobFile)) { Out-Result @{ ok = $false; code = 'bad-job'; error = 'job file missing' }; exit 0 }
$job = [IO.File]::ReadAllText($JobFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$room = [KakaoWin]::Norm([string]$job.room)
$text = [string]$job.text
if (-not $room -or -not $text) { Out-Result @{ ok = $false; code = 'bad-job'; error = 'room or text empty' }; exit 0 }
$text = ($text -replace "`r`n", "`n") -replace "`n", "`r`n"

function Find-Room {
  foreach ($h in Get-ChatWindows) { if ([KakaoWin]::Norm([KakaoWin]::Title($h)) -ceq $room) { return $h } }
  return [IntPtr]::Zero
}

$win = Find-Room
if ($win -eq [IntPtr]::Zero) {
  $search = Find-ChatSearch $main
  if ($search -eq [IntPtr]::Zero) { Out-Result @{ ok = $false; code = 'no-search'; error = 'chat-list search box not found (is the KakaoTalk main window logged in?)'; locked = (Is-Locked) }; exit 0 }
  [KakaoWin]::SetText($search, $room)
  Start-Sleep -Milliseconds 900
  [KakaoWin]::Enter($search)
  for ($i = 0; $i -lt 10 -and $win -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 300; $win = Find-Room }
  [KakaoWin]::SetText($search, '')
  if ($win -eq [IntPtr]::Zero) {
    $other = @(Get-ChatWindows).Count
    Out-Result @{ ok = $false; code = $(if ($other -gt 0) { 'title-mismatch' } else { 'room-not-found' }); error = 'no chat window whose title is exactly the room name'; locked = (Is-Locked) }
    exit 0
  }
}

$inputs = [KakaoWin]::Kids($win, $WM_INPUT_CLASS)
if ($inputs.Count -lt 1) { Out-Result @{ ok = $false; code = 'no-input'; error = 'chat input box not found' }; exit 0 }
$box = $inputs[0]
if ([KakaoWin]::TextLen($box) -gt 0) { Out-Result @{ ok = $false; code = 'input-busy'; error = 'the chat input box already has text (someone is typing) - not touched' }; exit 0 }

[KakaoWin]::SetText($box, $text)
Start-Sleep -Milliseconds 300
if ([KakaoWin]::TextLen($box) -lt 1) { Out-Result @{ ok = $false; code = 'not-set'; error = 'could not put the text into the input box'; locked = (Is-Locked) }; exit 0 }
[KakaoWin]::Enter($box)
$cleared = $false
for ($i = 0; $i -lt 10 -and -not $cleared; $i++) { Start-Sleep -Milliseconds 300; $cleared = ([KakaoWin]::TextLen($box) -eq 0) }
if (-not $cleared) {
  [KakaoWin]::SetText($box, '')
  Out-Result @{ ok = $false; code = 'not-cleared'; error = 'the input box did not empty after Enter (send key setting?) - text removed again'; locked = (Is-Locked) }
  exit 0
}
Out-Result @{ ok = $true }
