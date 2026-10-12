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
const D = require('../js/pu-gov-report-docs.js');

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
  assert.deepEqual(Object.keys(k).sort(), ['$other', '.validate', '.write', 'ack', 'at', 'by', 'gotAt', 'how', 'link', 'note', 'rd', 'sentAt', 'st']);
});

test('규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값을 쓴다', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  assert.ok(k.st['.validate'].includes('(' + Tr.STATES.join('|') + ')'), '상태');
  assert.ok(k.how['.validate'].includes('(' + Object.keys(Tr.HOW).join('|') + ')'), '제출 방식');
  assert.ok(k.note['.validate'].endsWith('<= ' + Tr.NOTE_MAX), '메모 길이');
  assert.ok(k.by['.validate'].endsWith('<= ' + Tr.BY_MAX), '이름 길이');
  assert.ok(k['.validate'].includes(Tr.KEY_RE.source), '줄 키 꼴');
});

/* ═══ 받은 서류 연결 (2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md §3) ═══ */

test('scal_docs 줄의 link — src·key 필수 · src 는 mail 만 · key 1~80자 · name ≤100자 · date 꼴 · 다른 칸 거절 · 따로 쓰기 문 없음', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  const l = k.link;
  assert.ok(l, 'link 가지가 없습니다');
  assert.equal(l['.validate'], "newData.hasChildren(['src','key'])");
  assert.equal(l.src['.validate'], "newData.isString() && newData.val() === 'mail'");
  assert.equal(l.key['.validate'], 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 80');
  assert.equal(l.name['.validate'], 'newData.isString() && newData.val().length <= 100');
  assert.equal(l.date['.validate'], k.sentAt['.validate'], '날짜 꼴은 sentAt·gotAt 과 같은 식');
  assert.equal(l.$other['.validate'], false);
  assert.deepEqual(Object.keys(l).sort(), ['$other', '.validate', 'date', 'key', 'name', 'src']);
  assert.equal(l['.write'], undefined, 'link 에 따로 쓰기 문을 열지 않는다(줄 쓰기 규칙을 따른다)');
});

test('link 한계 — 규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값', () => {
  const l = rules.scal_docs.$co.$rid.items.$key.link;
  assert.ok(l.src['.validate'].includes("'" + Tr.LINK_SRC + "'"), '연결 갈래');
  assert.ok(l.key['.validate'].endsWith('<= ' + Tr.LINK_KEY_MAX), '열쇠 길이');
  assert.ok(l.name['.validate'].endsWith('<= ' + Tr.LINK_NAME_MAX), '이름 길이');
});

test('대형 3종의 모든 단계 키가 줄 키 규칙(소문자[:숫자] · 20자 이하)을 통과한다 — 새 규칙이 필요 없다', () => {
  const RULE = /^[a-z]+(:[0-9]+)?$/;
  const bigs = D.DOC_PLANS.filter((p) => p.kind === '대형');
  assert.ok(bigs.length >= 3);
  bigs.forEach((p) => p.items.forEach((x) => {
    const keys = Tr.keysForItem(p, x.id, 60, Array.from({ length: 36 }, (_, i) => '2026-' + String((i % 12) + 1).padStart(2, '0')));
    assert.ok(keys.length > 0, p.key + '.' + x.id);
    keys.forEach((k) => assert.ok(RULE.test(k.key) && k.key.length <= 20, p.key + ' ' + k.key));
  }));
});

/* ═══ 회차 기록 rd (2026-10-12, 설계 2026-10-12-gov-report-rounds-design.md §4) ═══ */

/* 규칙 문자열에서 숫자·열거를 읽는다 — 화면 모듈 RD_* 와 같은 값이어야 한다 */
const upperOf = (s) => { const m = /<= ([0-9]+)/.exec(s); return m ? Number(m[1]) : NaN; };
const enumOf = (s) => { const m = /matches\(\/\^\(([a-z|]+)\)\$\/\)/.exec(s); return m ? m[1].split('|') : null; };

test('scal_docs 줄의 rd — mode 필수 · 일곱 칸(mode·mins·people·photo·sign·md·kind) · 다른 칸 거절 · 따로 쓰기 문 없음', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  const r = k.rd;
  assert.ok(r, 'rd 가지가 없습니다');
  assert.ok(r['.validate'].includes("newData.hasChildren(['mode'])"), 'mode 필수');
  assert.equal(r.photo['.validate'], 'newData.isBoolean()');
  assert.equal(r.sign['.validate'], 'newData.isBoolean()');
  assert.equal(r.$other['.validate'], false, 'rd 아래 다른 칸은 거절');
  assert.deepEqual(Object.keys(r).sort(), ['$other', '.validate', 'kind', 'md', 'mins', 'mode', 'people', 'photo', 'sign']);
  assert.equal(r['.write'], undefined, 'rd 에 따로 쓰기 문을 열지 않는다(줄 쓰기 규칙을 따른다)');
  assert.ok(Object.keys(k).includes('rd'));
});

test('rd 한계 — 규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값(열거·상한을 규칙 문자열에서 읽는다)', () => {
  const r = rules.scal_docs.$co.$rid.items.$key.rd;
  assert.deepEqual(enumOf(r.mode['.validate']), Tr.RD_MODE, '회의 형태 열거');
  assert.deepEqual(enumOf(r.kind['.validate']), Tr.RD_KIND, '활동 종류 열거');
  assert.equal(upperOf(r.mins['.validate']), Tr.RD_MINS_MAX, '시간 상한');
  assert.equal(upperOf(r.people['.validate']), Tr.RD_PEOPLE_MAX, '인원 상한');
  assert.equal(upperOf(r.md['.validate']), Tr.RD_MD_MAX, 'MD 상한');
  assert.equal(Tr.RD_MINS_MAX, 600); assert.equal(Tr.RD_PEOPLE_MAX, 99); assert.equal(Tr.RD_MD_MAX, 5);
  /* 정수 칸 · 0.5 단위 칸 */
  assert.ok(r.mins['.validate'].includes('% 1 === 0') && r.people['.validate'].includes('% 1 === 0'));
  assert.ok(r.md['.validate'].includes('(newData.val() * 2) % 1 === 0'), 'MD 는 0.5 단위');
});

test('rd — 두 규칙 JSON(전체-적용본·rules-paste)이 같은 rd 를 가진다', () => {
  const fs = require('node:fs');
  const pick = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8')).rules.scal_docs.$co.$rid.items.$key.rd;
  const gen = rules.scal_docs.$co.$rid.items.$key.rd;
  assert.ok(gen, '생성기 출력에 rd');
  assert.deepEqual(pick('firebase-rules-전체-적용본.json'), gen, '적용본');
  assert.deepEqual(pick('rules-paste.json'), gen, 'rules-paste');
});

/* ═══ 사업 종결 표시 scal_bizState (2026-10-12, 설계 docs/superpowers/plans/2026-10-12-gov-report-nav-closed.md) ═══ */

const Nav = require('../js/pu-gov-report-nav.js');

test('scal_bizState — 읽기는 로그인 직원 · 루트 쓰기 문 없음 · $code 쓰기는 관리자·위임관리인(MGR) 식 그대로', () => {
  const r = rules.scal_bizState;
  const login = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  const admin = rules.serverBackups['.read'];          /* ADMIN 식 그대로 */
  const mgr = rules.serverBackups['.write'];           /* MGR 식 그대로(생성기의 MGR 상수) */
  assert.ok(r, 'scal_bizState 자리가 없습니다');
  assert.equal(r['.read'], login, '읽기는 로그인(재직 직원)');
  assert.equal(r['.write'], undefined, '루트에 쓰기 문을 열지 않는다(통째 지우기·덮어쓰기 방지)');
  assert.equal(r.$code['.write'], mgr, '종결 표시 쓰기·지우기는 관리자·위임관리인');
  assert.notEqual(mgr, admin, 'MGR 은 ADMIN 과 다른 식(위임관리인 포함)이어야 한다');
  assert.ok(mgr.includes(admin), 'MGR 은 ADMIN 을 포함한다');
  assert.deepEqual(Object.keys(r).sort(), ['$code', '.read']);
});

test('scal_bizState 기록 모양 — 코드 키 꼴 · closedFrom 4자리 · closedAt 날짜 꼴 · reason·by ≤40자 · at 숫자 · 다른 칸 거절', () => {
  const c = rules.scal_bizState.$code;
  assert.ok(c['.validate'].includes('$code.matches(/^[A-Za-z0-9_-]{1,40}$/)'), '사업 코드 키 꼴');
  assert.ok(c['.validate'].includes("newData.hasChildren(['closedFrom','at'])"), 'closedFrom·at 필수');
  assert.ok(c.closedFrom['.validate'].includes('newData.isString()'));
  assert.ok(c.closedFrom['.validate'].includes('matches(/^[0-9]{4}$/)'), 'closedFrom 은 4자리 연도');
  assert.equal(c.closedAt['.validate'], rules.scal_docs.$co.$rid.items.$key.sentAt['.validate'], '종결일 날짜 꼴은 scal_docs 날짜 칸과 같은 식');
  assert.ok(c.closedAt['.validate'].includes('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/'));
  assert.equal(c.at['.validate'], 'newData.isNumber()');
  assert.equal(c.$other['.validate'], false, '다른 칸은 거절');
  assert.deepEqual(Object.keys(c).sort(), ['$other', '.validate', '.write', 'at', 'by', 'closedAt', 'closedFrom', 'reason']);
  /* 읽는 쪽이 쓰는 칸마다 따로 쓰기 문을 열지 않는다 */
  ['closedFrom', 'closedAt', 'reason', 'by', 'at'].forEach((f) => assert.equal(c[f]['.write'], undefined, f + ' 에 따로 쓰기 문 없음'));
});

test('scal_bizState 한계 — 규칙과 화면 모듈(js/pu-gov-report-nav.js)이 같은 값(숫자를 규칙 문자열에서 읽는다)', () => {
  const c = rules.scal_bizState.$code;
  assert.equal(upperOf(c.reason['.validate']), Nav.REASON_MAX, '사유 길이');
  assert.equal(Nav.REASON_MAX, 40);
  assert.equal(upperOf(c.by['.validate']), 40, '처리자 이름 길이');
  assert.ok(/^[0-9]{4}$/.test(Nav.ALL_FROM), '사업 전체 = 4자리 연도 — 규칙 정규식을 통과한다');
  const m = /matches\(\/(.+)\/\)/.exec(c.closedFrom['.validate']);
  assert.ok(m, 'closedFrom 정규식을 읽지 못했습니다');
  assert.ok(new RegExp(m[1]).test(Nav.ALL_FROM), 'ALL_FROM(' + Nav.ALL_FROM + ') 이 규칙 정규식을 통과한다');
  const e = Nav.closeEntry({ from: '2026', at: '2026-10-12', reason: 'x'.repeat(60), by: 'y'.repeat(60), now: 1760000000000 });
  assert.ok(e.reason.length <= upperOf(c.reason['.validate']), '모듈이 만든 사유가 규칙 한도 안');
  assert.ok(e.by.length <= upperOf(c.by['.validate']), '모듈이 만든 처리자가 규칙 한도 안');
  assert.ok(new RegExp(m[1]).test(e.closedFrom), '모듈이 만든 closedFrom 이 규칙 정규식을 통과');
  /* 모듈이 만드는 칸은 규칙이 아는 칸뿐이다($other:false) */
  Object.keys(e).forEach((k) => assert.ok(Object.prototype.hasOwnProperty.call(c, k), '규칙이 모르는 칸: ' + k));
});

test('scal_bizState — 두 규칙 JSON(전체-적용본·rules-paste)이 같은 블록을 가지고 생성기 출력과 같다', () => {
  const fs = require('node:fs');
  const pick = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8')).rules;
  const gen = rules.scal_bizState;
  assert.ok(gen, '생성기 출력에 scal_bizState');
  const a = pick('firebase-rules-전체-적용본.json');
  const p = pick('rules-paste.json');
  assert.deepEqual(a.scal_bizState, gen, '적용본');
  assert.deepEqual(p.scal_bizState, gen, 'rules-paste');
  assert.deepEqual(a, rules, '적용본 전체가 생성기 출력과 같다');
  assert.deepEqual(p, rules, 'rules-paste 전체가 생성기 출력과 같다');
});
