'use strict';
/* store.js — 포털 데이터베이스(signboard/…)를 이 PC 의 firebase CLI 로 읽고 쓴다 (설계서 §6.4)
   선례: scripts/thebill-pull.js — 이 PC 에 로그인된 CLI 를 쓴다. 서비스 계정 키는 만들지 않는다.
   ⚠ CLI 쓰기는 관리자 권한이라 보안 규칙을 건너뛴다. 그래서 심부름꾼은 signboard/state «하나만» 쓴다. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* 진짜 CLI 호출. 윈도에서 firebase 는 .cmd 라 shell:true 가 필요하고, MSYS_NO_PATHCONV 는 «/signboard» 가 경로로 바뀌는 것을 막는다 */
function cliExec(args) {
  return execFileSync('firebase', args, { encoding: 'utf8', shell: true, timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
}

function createStore(o) {
  o = o || {};
  const exec = o.exec || cliExec;
  const proj = ['--project', o.project || 'pureun-erp'];
  function getJson(p) {
    const out = String(exec(['database:get', p].concat(proj)) || '').trim();
    if (!out || out === 'null') return null;
    return JSON.parse(out);
  }
  return {
    readVersion() { const v = getJson('/signboard/published/version'); return v == null ? null : Number(v); },
    readPublished() { return getJson('/signboard/published'); },
    readControl() { return getJson('/signboard/control') || {}; },
    /* state 한 곳만 «고쳐 쓴다»(update). 안 적은 칸은 그대로다 */
    writeState(obj) {
      const f = path.join(os.tmpdir(), 'signboard-state-' + process.pid + '.json');
      fs.writeFileSync(f, JSON.stringify(obj));
      try { exec(['database:update', '/signboard/state', '"' + f + '"', '--force'].concat(proj)); }
      finally { try { fs.unlinkSync(f); } catch (e) { /* 임시 파일 */ } }
    }
  };
}

module.exports = { createStore, cliExec };
