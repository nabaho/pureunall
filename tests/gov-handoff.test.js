'use strict';
/* 정부사업신청 → 경력관리 「서식 채우기」 넘기기 (대표 승인 2026-09-10)
   ⚠★ 서식 채우기 화면을 «두 곳에» 짓지 않기 위한 길이다. 이 검사가 그 약속을 지킨다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const kc = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const gov = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');

/* 경력관리의 «받는 문» 두 함수만 떼어 진짜로 돌린다 */
function runDoor(opt) {
  opt = opt || {};
  const log = { nav: [], tab: [], toast: [], replaced: [], timers: 0 };
  let lock = opt.lock || 'owner';
  const ctx = {
    console, String, Number, Object, Array, RegExp, URLSearchParams,
    location: { search: opt.search == null ? '?go=form&t=' + encodeURIComponent('노무자문 용역') : opt.search,
                pathname: '/kcareer.html' },
    history: { replaceState: (a, b, c) => log.replaced.push(c) },
    document: { querySelector: (s) => ({ sel: s }) },
    nav_to: (id, label, grp) => log.nav.push([id, label, grp]),
    rhTab: (id, btn) => log.tab.push(id),
    toast: (m) => log.toast.push(m),
    _safe: (f) => { try { return f(); } catch (e) { /* 화면 없는 곳에서도 돌게 */ } },
    kcApplyLock: () => lock,
    setTimeout: (f) => { log.timers++; if (log.timers < 30 && opt.tick) { lock = 'owner'; f(); } },
    setLock: (v) => { lock = v; }
  };
  const g = kc.match(/function goForm\(title\)\{[\s\S]*?\n\}/);
  const o = kc.match(/function kcOpenFromUrl\(tries\)\{[\s\S]*?\n\}/);
  assert.ok(g, 'kcareer.html 에서 goForm 을 못 찾았습니다');
  assert.ok(o, 'kcareer.html 에서 kcOpenFromUrl 을 못 찾았습니다');
  vm.runInNewContext(g[0] + '\n' + o[0] + '\n;globalThis.__d={goForm,kcOpenFromUrl};', ctx);
  return { api: ctx.__d, log, ctx };
}

/* ───────── 경력관리 쪽 «받는 문» ───────── */

test('★ 넘어오면 「기관 양식 채우기」 화면이 실제로 열린다', () => {
  const r = runDoor();
  r.api.kcOpenFromUrl(0);
  assert.equal(r.log.nav.length, 1);
  assert.equal(r.log.nav[0][0], 'page-resume-hub');
  assert.deepEqual(r.log.tab, ['rh-edit'], '「기관 양식 채우기」 탭이어야 합니다');
});

test('★ 어느 공고 때문에 왔는지 머리줄에 밝힌다', () => {
  const r = runDoor();
  r.api.kcOpenFromUrl(0);
  assert.match(r.log.nav[0][1], /노무자문 용역/);
  assert.equal(r.log.toast.length, 1, '무엇을 하면 되는지도 말해 줍니다');
});

test('★★ 신원 확인이 끝나기 «전»에는 열지 않는다 — 기다렸다 연다', () => {
  // nav_to 는 잠겨 있으면 아무 데도 안 옮긴다. 한 번 부르고 끝내면 «영영 안 열린다».
  const r = runDoor({ lock: 'checking' });
  r.api.kcOpenFromUrl(0);
  assert.equal(r.log.nav.length, 0, '확인 중인데 옮겼습니다');
  assert.ok(r.log.timers >= 1, '다시 열어 볼 채비를 해야 합니다');
});

test('★ 잠금이 풀리면 그때 열린다', () => {
  const r = runDoor({ lock: 'checking', tick: true });
  r.api.kcOpenFromUrl(0);
  assert.equal(r.log.nav.length, 1, '잠금이 풀렸는데도 안 열렸습니다');
});

test('★★ 주소에서 지운다 — 새로고침마다 다시 튀어 들어오면 하던 일을 잃는다', () => {
  const r = runDoor();
  r.api.kcOpenFromUrl(0);
  assert.deepEqual(r.log.replaced, ['/kcareer.html']);
});

test('★ 그냥 들어왔을 때는 아무 일도 하지 않는다', () => {
  const r = runDoor({ search: '' });
  r.api.kcOpenFromUrl(0);
  assert.equal(r.log.nav.length, 0);
  assert.equal(r.log.replaced.length, 0);
});

test('★ 제목이 아무리 길어도 머리줄을 뒤덮지 않는다', () => {
  const long = '가'.repeat(300);
  const r = runDoor({ search: '?go=form&t=' + encodeURIComponent(long) });
  r.api.kcOpenFromUrl(0);
  assert.ok(r.log.nav[0][1].length < 120, '제목을 잘라야 합니다: ' + r.log.nav[0][1].length);
});

test('★★ 이 문을 막지 말 것 — 막으면 정부사업신청 단추가 막다른 길이 된다', () => {
  assert.match(kc, /if\(typeof kcOpenFromUrl==='function'\)\{ try\{ kcOpenFromUrl\(0\); \}/,
    '로그인 뒤에 부르는 자리가 없어졌습니다');
});

/* ───────── 정부사업신청 쪽 «보내는 단추» ───────── */

test('★ 공고 줄에 「📝 서식 채우기」 단추가 있다', () => {
  assert.match(gov, /onclick="toForm\(/);
  assert.match(gov, /title="서식 채우기 — 경력관리에서 열립니다"/, '무엇인지 알려 줘야 합니다');
});

test('★ 넘길 때 공고명을 들려 보낸다', () => {
  const m = gov.match(/function toForm\(id\)\{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /kcareer\.html\?go=form&t=/);
  assert.match(m[0], /encodeURIComponent/, '주소에 그대로 붙이면 깨집니다');
  assert.match(m[0], /slice\(0, *80\)/, '너무 긴 제목은 잘라 보냅니다');
});

test('★★ 정부사업신청에 서식 채우기 «화면»을 짓지 않았다', () => {
  // 짓는 순간 같은 것이 두 곳이 되고, 한쪽만 고쳐지면 어느 쪽이 맞는지 알 수 없게 된다.
  ['rhwp', 'pu-hwp-engine', 'kcareer-hwpxfill', 'kcareer-formmap', 'kcareer-slotai']
    .forEach((n) => {
      assert.ok(gov.indexOf(n) < 0, '「' + n + '」 이 정부사업신청으로 넘어왔습니다');
    });
});
