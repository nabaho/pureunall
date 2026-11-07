'use strict';
/* kakao.js — PC 카톡에 글 넣기 (설계서 §7). 실제 일은 send.ps1(PowerShell + Win32 창 메시지)이 한다.
   ★ 방 이름·글은 명령줄이 아니라 UTF-8 작업 파일로 넘긴다 — 윈도 PowerShell 5.1 명령줄의 한글이 깨지지 않게.
   ★ 결과는 send.ps1 이 찍는 JSON 한 줄: {ok} 또는 {ok:false, code, error, locked}.
     code: not-running(카톡이 꺼짐) · no-search(메인 창의 채팅 검색칸 없음) · room-not-found · title-mismatch(제목이 방 이름과 다름)
           · no-input · input-busy(누가 입력 중) · not-set · not-cleared(Enter 뒤에도 입력칸이 남음) · bad-job */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'send.ps1');

function psExec(args) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT].concat(args),
    { encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}
function lastJson(out) {
  const lines = String(out || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) { try { return JSON.parse(lines[i]); } catch (e) { /* 다음 줄 */ } }
  return { ok: false, code: 'no-output', error: 'send.ps1 printed nothing readable' };
}

function createKakao(o) {
  o = o || {};
  const exec = o.exec || psExec;
  return {
    /* 아무것도 보내거나 열지 않는다 — 카톡이 켜져 있고 창을 찾을 수 있는지만 */
    probe() { return lastJson(exec(['-Mode', 'probe'])); },
    send(room, text) {
      const f = path.join(os.tmpdir(), 'kakao-job-' + process.pid + '-' + Date.now() + '.json');
      fs.writeFileSync(f, JSON.stringify({ room: String(room || ''), text: String(text || '') }), 'utf8');
      try { return lastJson(exec(['-Mode', 'send', '-JobFile', f])); }
      catch (e) { return { ok: false, code: 'ps-error', error: String((e && e.message) || e).slice(0, 300) }; }
      finally { try { fs.unlinkSync(f); } catch (e) { /* 임시 파일 */ } }
    }
  };
}

module.exports = { createKakao, lastJson };
