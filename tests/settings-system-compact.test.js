'use strict';
/* 환경설정 › 시스템 — 한 화면에 짧게, 설명은 ⓘ 팝업으로 (대표 지시 2026-09-29
   「환경설정 화면이 좀 정리가 되었으면 좋겠다 컴팩트 하게 … 불필요한 설명은 팝업창 형태로만」,
   목업 settings-system-compact 승인)

   못 박는 것(규칙 — 탭 «이름» 이나 «개수» 를 글자 그대로 박지 않는다):
   ① 묶었어도 «빠진 화면이 없다» — 옛 탭 아홉의 화면이 모두 어딘가에서 열린다
   ② 시스템 탭 맨 위의 설명 줄·도구 단추 두 줄이 걷혔다(탭 줄이 맨 위)
   ③ 🔍 유실 데이터 검사·복원은 «데이터·백업» 안, 👤 입금자 별칭 관리는 «재무관리기준» 안
   ④ 설정 줄의 설명(hint)은 이름 옆 ⓘ 로 — 칸 밑 회색 글로 늘어놓지 않는다
   ⑤ 전체 리셋은 다른 탭과 같은 무게로 두지 않는다(오른쪽 끝·빨간 글씨) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const B = stripJs(ERP);
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };

test('① ★★ 묶었어도 빠진 화면이 없다 — 옛 탭 아홉의 화면이 모두 열린다', () => {
  const 시스템 = fn('SystemMasters');
  const 데이터 = fn('dataBackupSegs');
  const 모니터 = fn('monitorSegs');
  const 전부 = 시스템 + 데이터 + 모니터;
  ['AppSettingsSection', 'SystemMapSection', 'DataManagementSection', 'SystemMonitoringSection', 'BackupSection',
    'NasBackupSettings', 'HealthSection', 'PasswordChangeSection', 'AdminResetSection'].forEach((c) => {
    assert.match(전부, new RegExp('comp:\\s*' + c + '\\b'), '★★ ' + c + ' 화면으로 가는 길이 사라졌습니다');
  });
  assert.match(시스템, /comp:\s*DataBackupHub/, '데이터·백업 묶음이 탭에 없습니다');
  assert.match(시스템, /comp:\s*MonitorHealthHub/, '모니터링·헬스 묶음이 탭에 없습니다');
});

test('② ★ 시스템 탭 맨 위 — 설명 줄·도구 단추 줄이 걷혔다', () => {
  const 시스템 = fn('SystemMasters');
  assert.doesNotMatch(시스템, /className:'desc'/, '★ 맨 위 설명 줄이 돌아왔습니다');
  assert.doesNotMatch(시스템, /LostRecordsModal|PayerAliasModal/, '★ 도구 단추가 다시 시스템 탭 맨 위에 붙었습니다');
});

test('③ ★★ 도구 두 개는 «쓰임» 자리에 — 유실 검사는 데이터·백업, 입금자 별칭은 재무관리기준', () => {
  assert.match(fn('dataBackupSegs'), /comp:\s*DataBackupLost/, '★★ 유실 검사·복원이 데이터·백업에 없습니다');
  assert.match(fn('DataBackupLost'), /h\(LostRecordsModal/, '유실 검사 창을 여는 길이 없습니다');
  const 재무 = fn('FinanceMasters');
  assert.match(재무, /h\(PayerAliasModal/, '★★ 입금자 별칭 관리가 재무관리기준에 없습니다 — 찾을 곳이 사라졌습니다');
  assert.match(재무, /setAliasOpen\(true\)/, '입금자 별칭 창을 여는 단추가 없습니다');
});

test('④ ★★ 설정 줄 설명(hint)은 ⓘ 로 — 칸 밑 회색 글로 늘어놓지 않는다', () => {
  const 줄 = fn('PolicyRow');
  assert.match(줄, /props\.hint\s*&&\s*h\(InfoPop/, '★★ 설명이 다시 칸 밑에 늘어섭니다');
  const 팝 = fn('InfoPop');
  assert.match(팝, /title:/, '마우스를 올려도 짧은 설명이 안 보입니다');
  assert.match(팝, /className:'modal-bg'/, '누르면 뜨는 창이 없습니다');
  assert.match(팝, /whiteSpace:\s*'pre-line'/, '여러 줄 설명이 한 덩어리로 붙습니다');
});

test('⑤ 전체 리셋은 오른쪽 끝·빨간 글씨 — 다른 탭과 같은 무게로 두지 않는다', () => {
  const 시스템 = fn('SystemMasters');
  assert.match(시스템, /comp:\s*AdminResetSection[^}]*danger:\s*true/, '★ 전체 리셋이 여느 탭처럼 섞입니다');
  assert.match(시스템, /marginLeft:\s*t\.danger\s*\?\s*'auto'/, '전체 리셋이 오른쪽 끝으로 안 갑니다');
});
