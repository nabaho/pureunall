'use strict';
/* store.js — 포털 데이터베이스(settle/…)를 이 PC 의 firebase CLI 로 읽고 쓴다 (설계서 §7, 전광판 심부름꾼 store.js 선례)
   서비스 계정 키는 만들지 않는다 — 이 PC 에 로그인된 CLI 를 쓴다.
   ⚠ CLI 쓰기는 관리자 권한이라 보안 규칙을 건너뛴다. 그래서 심부름꾼이 쓰는 곳은 «두 곳뿐»이다:
     settle/kakaoQueue/<id>(그 줄의 상태 칸) · settle/agent(심부름꾼 마지막 응답). 정산표·규칙·방 이름은 읽기만 한다. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* 진짜 CLI 호출. 윈도에서 firebase 는 .cmd 라 shell:true 가 필요하고, MSYS_NO_PATHCONV 는 «/settle» 가 경로로 바뀌는 것을 막는다 */
function cliExec(args) {
  return execFileSync('firebase', args, { encoding: 'utf8', shell: true, timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
}

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function createStore(o) {
  o = o || {};
  const exec = o.exec || cliExec;
  const proj = ['--project', o.project || 'pureun-erp'];
  function getJson(p) {
    const out = String(exec(['database:get', p].concat(proj)) || '').trim();
    if (!out || out === 'null') return null;
    return JSON.parse(out);
  }
  function update(p, obj) {
    const f = path.join(os.tmpdir(), 'kakao-agent-' + process.pid + '-' + Date.now() + '.json');
    fs.writeFileSync(f, JSON.stringify(obj));
    try { exec(['database:update', p, '"' + f + '"', '--force'].concat(proj)); }
    finally { try { fs.unlinkSync(f); } catch (e) { /* 임시 파일 */ } }
  }
  return {
    readQueue() { return getJson('/settle/kakaoQueue') || {}; },
    readRooms() { return getJson('/settle/rooms') || {}; },
    readRunStatus(runId) {
      if (!ID_RE.test(String(runId || ''))) return '';
      const v = getJson('/settle/runs/' + runId + '/status');
      return v == null ? '' : String(v);
    },
    readRoles() { return getJson('/uid_roles') || {}; },
    /* 대기열 «그 줄»의 상태 칸만 고친다(update — 안 적은 칸은 그대로) */
    updateItem(id, patch) {
      if (!ID_RE.test(String(id || ''))) throw new Error('대기열 줄 번호가 올바르지 않습니다');
      update('/settle/kakaoQueue/' + id, patch);
    },
    writeAgent(obj) { update('/settle/agent', obj); }
  };
}

module.exports = { createStore, cliExec, ID_RE };
