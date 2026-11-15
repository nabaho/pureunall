#!/usr/bin/env node
/* 푸른이알피 종료·삭제·되돌림 불변성 및 중복/되살아남 방지 정적·스냅샷 점검기.
   ★ 읽기 전용(readOnly): 실서버·Firebase를 읽거나 쓰지 않는다.
   - 기본 실행: node scripts/erp-integrity-audit.js          (코드·문서 안전장치 정적 점검)
   - 스냅샷 점검: node scripts/erp-integrity-audit.js --snapshot <백업.json> */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const DIFF_KEYS = [
  'contracts', 'cases', 'consultings', 'funds', 'other_projects',
  'companies', 'finance_income', 'payroll_monthly', 'ledger_batches',
];

const SOURCE_STORE_MAP = {
  company: 'companies',
  case: 'cases',
  consulting: 'consultings',
  fund: 'funds',
  other: 'other_projects',
  other_project: 'other_projects',
  other_projects: 'other_projects',
};

function stripComments(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  if (head < 0) return '';
  let i = src.indexOf('{', head + decl.length);
  if (i < 0) return '';
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') {
      d--;
      if (!d) return src.slice(head, i + 1);
    }
  }
  return '';
}

function asRecords(val) {
  if (!val) return [];
  const raw = (val && typeof val === 'object' && !Array.isArray(val) && 'v' in val && Object.keys(val).length <= 3)
    ? val.v
    : val;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).map((k) => raw[k]).filter((x) => x && typeof x === 'object');
  }
  return [];
}

function rawContainer(val) {
  if (!val || typeof val !== 'object') return val;
  if (!Array.isArray(val) && 'v' in val && Object.keys(val).length <= 3) return val.v;
  return val;
}

function auditCode(erpSource) {
  const src = String(erpSource || '').replace(/\r\n/g, '\n');
  const bare = stripComments(src);
  const blockers = [];

  // 1) erpSyncNow 가 data/<표> 를 날 배열 JSON.parse(raw) 로 통째 덮어쓰지 않는지
  const syncNowIdx = bare.indexOf('window.erpSyncNow = function');
  const syncNowSlice = syncNowIdx >= 0 ? bare.slice(syncNowIdx, syncNowIdx + 1200) : '';
  if (!syncNowSlice) blockers.push('missing_erpSyncNow');
  if (/updates\[['"]data\/['"]\s*\+\s*k\]\s*=\s*\{\s*v\s*:\s*JSON\.parse/.test(syncNowSlice)) {
    blockers.push('erpSyncNow_raw_whole_table_overwrite');
  }

  // 2) _fbUnknownBaseUpserts 가 _deleted / undoneDate / 종료 상태를 되살리지 않는지
  const unkFn = stripComments(cutFn(src, 'function _fbUnknownBaseUpserts('));
  if (!unkFn) blockers.push('missing_fbUnknownBaseUpserts');
  if (!/_deleted/.test(unkFn) || !/undoneDate/.test(unkFn)) {
    blockers.push('unknown_base_resurrection_unguarded');
  }

  // 3) dbSet 트랜잭션 병합이 서버 _deleted / undoneDate 되살아남을 막는지
  const dbSetFn = stripComments(cutFn(src, 'function dbSet('));
  if (!/_sv\._deleted/.test(dbSetFn) || !/_sv\.undoneDate/.test(dbSetFn)) {
    blockers.push('dbSet_txn_resurrection_unguarded');
  }

  // 4) TrashBin.restore 가 명시적 복원 시각(_restoredAt)을 남기는지
  const trashIdx = bare.indexOf('var TrashBin =');
  const trashSlice = trashIdx >= 0 ? bare.slice(trashIdx, trashIdx + 2400) : '';
  if (!/_restoredAt/.test(trashSlice)) {
    blockers.push('trash_restore_missing_intent_stamp');
  }

  // 5) 번호 재정렬이 _deleted 제외 + 종료/이관 번호 동결을 지키는지
  const reorderCons = stripComments(cutFn(src, 'function reorderConsultingNos('));
  if (!/item\._deleted/.test(reorderCons) || !/lockedNums/.test(reorderCons)) {
    blockers.push('reorderConsultingNos_mutates_deleted_or_closed');
  }
  const renumCt = stripComments(cutFn(src, 'function renumberContracts2026('));
  if (!/!c\._deleted/.test(renumCt) || !/lockedNums/.test(renumCt)) {
    blockers.push('renumberContracts2026_mutates_deleted_or_closed');
  }

  // 6) 입금 되돌림·일부입금이 other_projects 매핑을 빠뜨리지 않는지
  const undoFn = stripComments(cutFn(src, 'function erpUndoIncome('));
  if (!/erpIncomeSourceStore|other_projects/.test(undoFn)) {
    blockers.push('erpUndoIncome_missing_other_projects_store');
  }

  // 7) 주요 입금·성과 소비 화면이 삭제/되돌림 거르개를 쓰는지
  const incomeListFn = stripComments(cutFn(src, 'function IncomeListTab('));
  if (!/erpIncomeLive/.test(incomeListFn)) blockers.push('IncomeListTab_missing_erpIncomeLive');

  const incomeKindFn = stripComments(cutFn(src, 'function IncomeKindTab('));
  if (!/erpIncomeLive/.test(incomeKindFn)) blockers.push('IncomeKindTab_missing_erpIncomeLive');

  const unmatchedFn = stripComments(cutFn(src, 'function IncomeUnmatchedTab('));
  if (!/erpIncomeLive/.test(unmatchedFn)) blockers.push('IncomeUnmatchedTab_missing_erpIncomeLive');

  const perfMgmtFn = stripComments(cutFn(src, 'function PerfManagement('));
  if (!perfMgmtFn || !/undoneDate/.test(perfMgmtFn) || !/_deleted/.test(perfMgmtFn)) {
    blockers.push('PerfManagement_missing_undone_or_deleted_guard');
  }
  const unconfirmFn = perfMgmtFn ? stripComments(cutFn(perfMgmtFn, 'async function unconfirmPerfItem(')) : '';
  if (!unconfirmFn || !/erpUndoIncome\(/.test(unconfirmFn) || /dbRemove\s*\(\s*['"]finance_income['"]/.test(unconfirmFn)) {
    blockers.push('unconfirmPerfItem_bypasses_erpUndoIncome');
  }
  const recvFn = stripComments(cutFn(src, 'function FinanceReceivable('));
  if (!recvFn || !/erpIncomeLive/.test(recvFn)) {
    blockers.push('FinanceReceivable_missing_erpIncomeLive');
  }

  const perfCountsFn = stripComments(cutFn(src, 'function erpPerfCounts('));
  if (!/_deleted/.test(perfCountsFn) || !/undoneDate/.test(perfCountsFn)) {
    blockers.push('erpPerfCounts_missing_deleted_or_undone_guard');
  }

  // 8) 사진·메일 자동 계약 반영이 closed / cancelled 이력을 중복 방지 대상으로 보는지
  const photoCtFn = stripComments(cutFn(src, 'async function processPhotoContractRequest('));
  if (!/closed/.test(photoCtFn) || !/cancelled/.test(photoCtFn)) {
    blockers.push('processPhotoContractRequest_ignores_closed_or_cancelled');
  }

  return {
    readOnly: true,
    ok: blockers.length === 0,
    blockerCount: blockers.length,
    blockers,
  };
}

function auditDocs(rootDir) {
  const base = rootDir || ROOT;
  const requiredDocs = [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    '.agents/rules/pureun-rules.md',
    'docs/규칙/종료-삭제-되돌림-불변.md',
  ];
  const missing = [];
  const unlinked = [];
  for (const rel of requiredDocs) {
    const p = path.join(base, rel);
    if (!fs.existsSync(p)) {
      missing.push(rel);
      continue;
    }
    const txt = fs.readFileSync(p, 'utf8');
    if (rel !== 'docs/규칙/종료-삭제-되돌림-불변.md' && !/종료-삭제-되돌림-불변\.md|종료·삭제·되돌림/.test(txt)) {
      unlinked.push(rel);
    }
  }
  return {
    readOnly: true,
    ok: missing.length === 0 && unlinked.length === 0,
    missing,
    unlinked,
  };
}

function auditSnapshot(snapInput) {
  const rootData = (snapInput && snapInput.data && typeof snapInput.data === 'object')
    ? snapInput.data
    : (snapInput || {});
  const issues = [];

  // 1) DIFF_KEYS 안에 숫자 배열 인덱스 키와 ID 키가 섞여 있는지 점검
  for (const key of DIFF_KEYS) {
    if (!(key in rootData)) continue;
    const raw = rawContainer(rootData[key]);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const keys = Object.keys(raw);
      const numericKeys = keys.filter((k) => /^\d+$/.test(k));
      const idKeys = keys.filter((k) => !/^\d+$/.test(k));
      if (numericKeys.length > 0 && idKeys.length > 0) {
        issues.push({
          kind: 'mixed_numeric_and_id_keys',
          table: key,
          numericCount: numericKeys.length,
          idCount: idKeys.length,
        });
      }
    }
  }

  // 2) 살아 있는 레코드 중복 ID · 중복 관리번호 점검
  const noFieldByTable = {
    contracts: 'contractNo',
    cases: 'caseNo',
    consultings: 'no',
    funds: 'no',
    other_projects: 'no',
  };
  const byTableId = {};
  for (const key of DIFF_KEYS) {
    const rows = asRecords(rootData[key]);
    const idMap = {};
    const seenIds = new Set();
    const seenNos = new Map();
    const noField = noFieldByTable[key];
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      if (!r.id) {
        issues.push({ kind: 'missing_id', table: key });
        continue;
      }
      if (seenIds.has(r.id)) {
        issues.push({ kind: 'duplicate_id', table: key, id: r.id });
      }
      seenIds.add(r.id);
      idMap[r.id] = r;
      if (!r._deleted && noField && r[noField]) {
        const noVal = String(r[noField]).trim();
        if (noVal) {
          if (seenNos.has(noVal)) {
            issues.push({
              kind: 'duplicate_management_no',
              table: key,
              no: noVal,
              ids: [seenNos.get(noVal), r.id],
            });
          } else {
            seenNos.set(noVal, r.id);
          }
        }
      }
    }
    byTableId[key] = idMap;
  }

  // 3) 살아 있는 입금(finance_income)이 삭제된(_deleted) 원본을 가리키는지 + 되돌린 입금 미롤백 점검
  const incomes = asRecords(rootData.finance_income);
  const liveBySource = new Set();
  for (const fi of incomes) {
    if (!fi || fi._deleted || fi.undoneDate) continue;
    if (fi.sourceKind && fi.sourceId) {
      liveBySource.add(fi.sourceKind + '|' + fi.sourceId + '|' + String(fi.kind || ''));
      const st = SOURCE_STORE_MAP[fi.sourceKind];
      const target = st && byTableId[st] ? byTableId[st][fi.sourceId] : null;
      if (target && target._deleted) {
        issues.push({
          kind: 'live_income_points_to_deleted_source',
          incomeId: fi.id,
          sourceTable: st,
          sourceId: fi.sourceId,
        });
      }
    }
  }

  for (const fi of incomes) {
    if (!fi || fi._deleted || !fi.undoneDate) continue;
    if (!fi.sourceKind || !fi.sourceId || fi.sourceKind === 'company') continue;
    const st = SOURCE_STORE_MAP[fi.sourceKind];
    const target = st && byTableId[st] ? byTableId[st][fi.sourceId] : null;
    if (!target || target._deleted) continue;
    const sig = fi.sourceKind + '|' + fi.sourceId + '|' + String(fi.kind || '');
    if (liveBySource.has(sig)) continue;
    const k = String(fi.kind || '');
    let stillPaid = false;
    if (k.indexOf('착수') >= 0) stillPaid = !!target.retainerPaid;
    else if (k.indexOf('성공') >= 0) stillPaid = !!target.successPaid;
    else if (k.indexOf('계약금') >= 0) stillPaid = !!target.contractPaid;
    else if (k.indexOf('잔금') >= 0) stillPaid = !!target.balancePaid;
    else if (k !== '자문료') stillPaid = !!target.paid;
    if (stillPaid) {
      issues.push({
        kind: 'undone_income_source_still_marked_paid',
        incomeId: fi.id,
        sourceTable: st,
        sourceId: fi.sourceId,
        incomeKind: k,
      });
    }
  }

  // 4) 계약 이관(transferredTo) ↔ 업무 원본(sourceContractId) 끊김·휴지통 불일치 점검
  const contracts = asRecords(rootData.contracts);
  for (const ct of contracts) {
    if (!ct || ct._deleted || ct.status !== 'transferred' || !Array.isArray(ct.transferredTo)) continue;
    for (const link of ct.transferredTo) {
      if (!link || !link.kind || !link.id) continue;
      const st = SOURCE_STORE_MAP[link.kind];
      if (!st || !byTableId[st]) continue;
      const dst = byTableId[st][link.id];
      if (!dst) {
        issues.push({
          kind: 'transferred_contract_missing_target',
          contractId: ct.id,
          targetTable: st,
          targetId: link.id,
        });
      }
    }
  }

  return {
    readOnly: true,
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function compareTerminalImmutability(beforeSnap, afterSnap) {
  const bRoot = (beforeSnap && beforeSnap.data && typeof beforeSnap.data === 'object') ? beforeSnap.data : (beforeSnap || {});
  const aRoot = (afterSnap && afterSnap.data && typeof afterSnap.data === 'object') ? afterSnap.data : (afterSnap || {});
  const violations = [];

  for (const key of DIFF_KEYS) {
    const beforeRows = asRecords(bRoot[key]);
    const afterMap = {};
    for (const r of asRecords(aRoot[key])) {
      if (r && r.id) afterMap[r.id] = r;
    }
    for (const b of beforeRows) {
      if (!b || !b.id) continue;
      const a = afterMap[b.id];
      if (b._deleted) {
        if (!a) {
          violations.push({ kind: 'tombstone_physically_removed', table: key, id: b.id });
        } else if (!a._deleted && !a._restoredAt) {
          violations.push({ kind: 'deleted_record_resurrected', table: key, id: b.id });
        }
        continue;
      }
      if (b.undoneDate && (!a || !a.undoneDate)) {
        violations.push({ kind: 'undone_income_resurrected_or_removed', table: key, id: b.id });
        continue;
      }
      const st = String(b.status || '').toLowerCase();
      const isTerm = st === 'closed' || st === 'cancelled' || st === 'transferred'
        || !!b.closedAt || !!b.closedDate || !!b.closeDate || !!b.permanentArchived;
      if (isTerm) {
        if (!a) {
          violations.push({ kind: 'terminal_record_removed', table: key, id: b.id });
          continue;
        }
        for (const f of ['status', 'no', 'contractNo', 'caseNo']) {
          if (b[f] !== undefined && a[f] !== b[f]) {
            violations.push({ kind: 'terminal_record_mutated', table: key, id: b.id, field: f, before: b[f], after: a[f] });
          }
        }
      }
    }
  }
  return {
    readOnly: true,
    ok: violations.length === 0,
    violationCount: violations.length,
    violations,
  };
}

function runCli(argv) {
  const args = argv || process.argv.slice(2);
  const erpPath = path.join(ROOT, 'pu-erp.html');
  const code = auditCode(fs.readFileSync(erpPath, 'utf8'));
  const docs = auditDocs(ROOT);
  const out = { readOnly: true, code, docs };

  const snapIdx = args.indexOf('--snapshot');
  if (snapIdx >= 0 && args[snapIdx + 1]) {
    const snapPath = path.resolve(process.cwd(), args[snapIdx + 1]);
    const snapJson = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    out.snapshot = auditSnapshot(snapJson);
  }
  const beforeIdx = args.indexOf('--before');
  const afterIdx = args.indexOf('--after');
  if (beforeIdx >= 0 && args[beforeIdx + 1] && afterIdx >= 0 && args[afterIdx + 1]) {
    const bJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args[beforeIdx + 1]), 'utf8'));
    const aJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args[afterIdx + 1]), 'utf8'));
    out.diffCheck = compareTerminalImmutability(bJson, aJson);
  }

  out.ok = code.ok && docs.ok
    && (!out.snapshot || out.snapshot.ok)
    && (!out.diffCheck || out.diffCheck.ok);
  return out;
}

if (require.main === module) {
  const res = runCli();
  process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  if (!res.ok) process.exit(1);
}

module.exports = {
  DIFF_KEYS,
  auditCode,
  auditDocs,
  auditSnapshot,
  compareTerminalImmutability,
  runCli,
};
