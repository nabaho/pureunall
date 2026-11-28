'use strict';
/* store.js — firebase CLI로 /kakao_room 과 참조 원장(/work_erp/items, /data/companies, /kakaoWork/rooms)을 읽고,
   5중 안전판별을 통과한 비식별 업무 레코드(/kakao_room/items/{id})와 감시기 상태(/kakao_room/watcher)만 기록한다. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ARCHIVE_ID_RE = /^kr_[a-z0-9_]{6,48}$/;
const DAY_RE = /^([0-9]{4}-[0-9]{2}-[0-9]{2})?$/;
const ALLOWED_ARCHIVE_KEYS = new Set([
  'id', 'entityType', 'schemaVersion', 'contractVersion', 'revision',
  'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'originSystem', 'originId',
  'room', 'day', 'senders', 'msgCount', 'domain', 'safety', 'redactedCount',
  'summary', 'caseNos', 'due', 'fileNames', 'matchBasis', 'workItemId', 'workLogId',
  'companyId', 'companyLinkStatus', 'companyHint', 'status', 'note',
  '_deleted', 'deletedBy', 'deletedAt'
]);
const ALLOWED_DOMAINS = new Set(['case', 'fund', 'consult', 'payroll', 'advisory', 'admin']);
const ALLOWED_SAFETIES = new Set(['safe', 'redacted']);
const ALLOWED_BASES = new Set(['sure', 'guess', 'newno', 'none', '']);
const ALLOWED_CO_STATUS = new Set(['linked', 'pending']);
const ALLOWED_STATUSES = new Set(['open', 'tracking', 'done']);

function assertStr(val, maxLen, field) {
  if (typeof val !== 'string' || val.length > maxLen) {
    throw new Error('올바르지 않은 문자열 칸: ' + field);
  }
}

function assertStrArr(arr, maxItemLen, field) {
  if (!Array.isArray(arr) || arr.length > 99) {
    throw new Error('올바르지 않은 배열 칸: ' + field);
  }
  arr.forEach((v) => assertStr(v, maxItemLen, field + '[]'));
}

function validateArchiveRecord(id, rec) {
  if (!ARCHIVE_ID_RE.test(String(id || ''))) throw new Error('올바르지 않은 kakao_room 아카이브 ID: ' + id);
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new Error('아카이브 레코드가 객체가 아닙니다');
  if (Object.prototype.hasOwnProperty.call(rec, 'companyName')) {
    throw new Error('companyName 필드는 온톨로지 규칙상 허용되지 않습니다');
  }
  for (const k of Object.keys(rec)) {
    if (!ALLOWED_ARCHIVE_KEYS.has(k)) throw new Error('허용되지 않은 아카이브 필드: ' + k);
  }
  if (rec.id !== id || rec.entityType !== 'KakaoWorkArchive') {
    throw new Error('온톨로지 규격이 올바르지 않습니다');
  }
  if (typeof rec.schemaVersion !== 'number' || rec.schemaVersion < 1 || rec.schemaVersion > 10) throw new Error('schemaVersion 오류');
  if (rec.contractVersion !== 1) throw new Error('contractVersion 오류');
  if (typeof rec.revision !== 'number' || rec.revision < 1) throw new Error('revision 오류');
  if (typeof rec.createdAt !== 'number' && (typeof rec.createdAt !== 'string' || rec.createdAt.length > 40)) throw new Error('createdAt 오류');
  if (typeof rec.updatedAt !== 'number' && (typeof rec.updatedAt !== 'string' || rec.updatedAt.length > 40)) throw new Error('updatedAt 오류');
  assertStr(rec.createdBy, 64, 'createdBy');
  assertStr(rec.updatedBy, 64, 'updatedBy');
  assertStr(rec.originSystem, 32, 'originSystem');
  assertStr(rec.originId, 64, 'originId');
  assertStr(rec.room, 120, 'room');
  if (typeof rec.day !== 'string' || !DAY_RE.test(rec.day)) throw new Error('day 형식 오류');
  if (rec.senders != null) assertStrArr(rec.senders, 80, 'senders');
  if (typeof rec.msgCount !== 'number' || rec.msgCount < 1 || rec.msgCount > 10000) throw new Error('msgCount 범위 오류');
  if (!ALLOWED_DOMAINS.has(rec.domain)) throw new Error('domain 오류');
  if (!ALLOWED_SAFETIES.has(rec.safety)) throw new Error('safety 오류');
  if (typeof rec.redactedCount !== 'number' || rec.redactedCount < 0 || rec.redactedCount > 10000) throw new Error('redactedCount 범위 오류');
  assertStr(rec.summary, 400, 'summary');
  if (rec.caseNos != null) assertStrArr(rec.caseNos, 80, 'caseNos');
  assertStr(rec.due, 20, 'due');
  if (rec.fileNames != null) assertStrArr(rec.fileNames, 240, 'fileNames');
  if (!ALLOWED_BASES.has(rec.matchBasis)) throw new Error('matchBasis 오류');
  assertStr(rec.workItemId, 80, 'workItemId');
  assertStr(rec.workLogId, 100, 'workLogId');
  assertStr(rec.companyId, 80, 'companyId');
  if (!ALLOWED_CO_STATUS.has(rec.companyLinkStatus)) throw new Error('companyLinkStatus 오류');
  assertStr(rec.companyHint, 120, 'companyHint');
  if (!ALLOWED_STATUSES.has(rec.status)) throw new Error('status 오류');
  assertStr(rec.note, 1000, 'note');

  /* 민감정보(주민번호) 잔여 패턴 차단 */
  const rawRrnRe = /\d{6}\s*-\s*[1-8]\d{6}|\d{6}[1-4]\d{6}/;
  const textPool = [rec.summary, rec.note, rec.companyHint]
    .concat(Array.isArray(rec.fileNames) ? rec.fileNames : [])
    .concat(Array.isArray(rec.senders) ? rec.senders : []);
  textPool.forEach((txt) => {
    if (typeof txt === 'string' && rawRrnRe.test(txt)) {
      throw new Error('마스킹되지 않은 주민번호 패턴이 남아 있어 저장을 차단했습니다');
    }
  });
}

function cliExec(args) {
  return execFileSync('firebase', args, {
    encoding: 'utf8',
    shell: true,
    timeout: 90000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' })
  });
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

  function setJson(p, obj) {
    const f = path.join(os.tmpdir(), 'kakao-watch-' + process.pid + '-' + Date.now() + '.json');
    fs.writeFileSync(f, JSON.stringify(obj), 'utf8');
    try {
      exec(['database:set', p, '"' + f + '"', '--force'].concat(proj));
    } finally {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  }

  return {
    readRooms() {
      const v = getJson('/kakaoWork/rooms');
      if (Array.isArray(v)) return v.map((s) => String(s || '').trim()).filter(Boolean);
      if (v && typeof v === 'object') return Object.keys(v).map((k) => String(v[k] || '').trim()).filter(Boolean);
      return [];
    },
    readWorkItems() { return getJson('/work_erp/items') || {}; },
    readCompanies() { return getJson('/data/companies') || {}; },
    readArchiveItem(id) {
      if (!ARCHIVE_ID_RE.test(String(id || ''))) return null;
      return getJson('/kakao_room/items/' + id);
    },
    writeArchiveItem(id, rec) {
      validateArchiveRecord(id, rec);
      setJson('/kakao_room/items/' + id, rec);
    },
    writeWatcher(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('watcher 상태가 객체가 아닙니다');
      setJson('/kakao_room/watcher', obj);
    }
  };
}

module.exports = { createStore, cliExec, validateArchiveRecord, ARCHIVE_ID_RE };
