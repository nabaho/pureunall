'use strict';
/* 정부컨설팅 보고서 자리의 실시간DB 규칙 (2026-10-09, 2단계 Task 3)
   - scal_reports      : 다른 scal_* 과 같은 꼴 (읽기 로그인 · $k/$k2 쓰기 로그인 · 부모 지우기 관리자)
   - scal_rptForms,
     scal_rptFormsIndex: 읽기 로그인 · 쓰기 관리자 — 양식 등록은 관리자만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const out = cp.execFileSync('node', [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' });
const rules = JSON.parse(out).rules;
const Tr = require('../js/pu-gov-report-track.js');

test('세 자리가 생성기 출력에 있다', () => {
  for (const k of ['scal_reports', 'scal_rptForms', 'scal_rptFormsIndex']) {
    assert.ok(rules[k], k + ' 자리가 없습니다');
  }
});

test('scal_reports — 확정본(_v숫자)은 없을 때만 쓰기, 지우기는 관리자만 / 본기록은 직원 쓰기·관리자 삭제', () => {
  const r = rules.scal_reports;
  const login = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  const admin = rules.serverBackups['.read'];          /* ADMIN 식 그대로 */
  assert.equal(r['.read'], login, '읽기는 다른 scal_* 와 같은 로그인');
  /* 위쪽 칸이 열려 있으면 아래 확정본 잠금이 뚫린다 — 관리자 전용이어야 한다 */
  assert.equal(r['.write'], admin, '루트 쓰기는 관리자 전용');
  assert.equal(r.$co['.write'], admin, '$co 쓰기는 관리자 전용');
  const w = r.$co.$rid['.write'];
  assert.ok(w.startsWith('(' + login + ') && '), '로그인이 먼저 필요');
  assert.ok(w.includes("$rid.matches(/_v[0-9]+$/)"), '_v숫자 로 끝나는 rid 를 가린다');
  assert.ok(w.includes('!data.exists()'), '확정본은 «없을 때만» 쓴다(덮어쓰기 금지)');
  assert.ok(w.includes('(!newData.exists() && ' + admin + ')'), '확정본 지우기는 관리자만');
  assert.ok(w.includes('(newData.exists() || ' + admin + ')'), '본기록은 직원 쓰기, 지우기는 관리자');
  assert.deepEqual(Object.keys(r.$co).sort(), ['$rid', '.write']);
});

test('scal_rptForms·scal_rptFormsIndex — 읽기는 로그인, 쓰기는 관리자(양식 등록은 관리자만)', () => {
  const adminW = rules.serverBackups['.read'];          /* ADMIN 식 그대로 (읽기가 ADMIN 인 자리) */
  const loginR = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  for (const k of ['scal_rptForms', 'scal_rptFormsIndex']) {
    assert.equal(rules[k]['.write'], adminW, k + ' 쓰기가 관리자 식과 다릅니다');
    assert.equal(rules[k]['.read'], loginR, k + ' 읽기가 로그인 식과 다릅니다');
    assert.deepEqual(Object.keys(rules[k]).sort(), ['.read', '.write'], k + ' 에 군더더기가 있습니다');
  }
});

/* ═══ 서류 진행 기록 (2026-10-10, 설계 2026-10-10-gov-report-track-design.md §2-1) ═══ */

test('scal_docs — 위쪽 칸(루트·$co·$rid·items)은 관리자 전용 · 줄($key)만 직원 쓰기, 지우기는 관리자', () => {
  const r = rules.scal_docs;
  const login = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  const admin = rules.serverBackups['.read'];          /* ADMIN 식 그대로 */
  assert.ok(r, 'scal_docs 자리가 없습니다');
  assert.equal(r['.read'], login, '읽기는 로그인(재직 직원)');
  /* 위쪽 칸이 열려 있으면 아래 줄 단위 잠금·모양 검사를 «위에서 뚫는다» */
  assert.equal(r['.write'], admin, '루트 쓰기는 관리자 전용');
  assert.equal(r.$co['.write'], admin, '$co 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid['.write'], admin, '$rid 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid.items['.write'], admin, 'items 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid.items.$key['.write'], '(' + login + ') && (newData.exists() || ' + admin + ')',
    '줄 하나는 직원이 만들고 고치고, 지우기는 관리자');
  assert.deepEqual(Object.keys(r).sort(), ['$co', '.read', '.write']);
  assert.deepEqual(Object.keys(r.$co).sort(), ['$rid', '.write']);
  assert.deepEqual(Object.keys(r.$co.$rid).sort(), ['$other', '.write', 'items']);
  assert.equal(r.$co.$rid.$other['.validate'], false, 'rid 아래에는 items 말고 아무것도 못 쓴다');
});

test('scal_docs 줄 모양 — 키 꼴 · 상태 다섯 · 시각 숫자 · 날짜 꼴 · 이름 40자 · 메모 200자 · 방식 넷 · 접수 참거짓 · 다른 칸 거절', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  assert.ok(k['.validate'].includes('$key.matches(/^[a-z]+(:[0-9]+)?$/)'));
  assert.ok(k['.validate'].includes('$key.length <= 20'));
  assert.ok(k['.validate'].includes("newData.hasChildren(['st','at'])"));
  assert.ok(k.st['.validate'].includes('(none|doing|done|blocked|na)'));
  assert.equal(k.at['.validate'], 'newData.isNumber()');
  ['sentAt', 'gotAt'].forEach((f) => assert.ok(k[f]['.validate'].includes('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/'), f));
  assert.equal(k.by['.validate'], 'newData.isString() && newData.val().length <= 40');
  assert.equal(k.note['.validate'], 'newData.isString() && newData.val().length <= 200');
  assert.ok(k.how['.validate'].includes('(mail|platform|post|other)'));
  assert.equal(k.ack['.validate'], 'newData.isBoolean()');
  assert.equal(k.$other['.validate'], false);
  assert.deepEqual(Object.keys(k).sort(), ['$other', '.validate', '.write', 'ack', 'at', 'by', 'gotAt', 'how', 'note', 'sentAt', 'st']);
});

test('규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값을 쓴다', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  assert.ok(k.st['.validate'].includes('(' + Tr.STATES.join('|') + ')'), '상태');
  assert.ok(k.how['.validate'].includes('(' + Object.keys(Tr.HOW).join('|') + ')'), '제출 방식');
  assert.ok(k.note['.validate'].endsWith('<= ' + Tr.NOTE_MAX), '메모 길이');
  assert.ok(k.by['.validate'].endsWith('<= ' + Tr.BY_MAX), '이름 길이');
  assert.ok(k['.validate'].includes(Tr.KEY_RE.source), '줄 키 꼴');
});
