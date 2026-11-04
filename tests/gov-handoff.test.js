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

// 공고명 한 개를 URL로 넘기던 기능이 공고별 지원 준비로 확장됐다. 단추 문구 대신 전달 계약을 검사한다.
test('공고 줄에서 경력관리의 지원 준비로 이어지는 입구가 있다', () => {
  assert.match(gov, /onclick="toForm\(/);
  assert.match(gov, /title="[^"]*경력관리[^"]*"/);
});
test('공고의 ID·제목·원문 링크를 같은 탭의 임시 전달함으로 넘긴다', () => {
  const source={id:'qa-id',nm:'점검 지원 공고',org:'점검기관',url:'https://www.chungnam.go.kr/qa'};
  let handoff;
  const ctx={fbUid:'qa-owner',find:()=>({a:[source],i:0}),Date,Math,JSON,encodeURIComponent,location:{href:''},toast:()=>{},sessionStorage:{setItem:(k,v)=>{handoff=JSON.parse(v);}}};
  const door=gov.match(/function applicationHandoff\(source\)\{[\s\S]*?\n\}/);
  const send=gov.match(/function toForm\(id\)\{[\s\S]*?\n\}/);
  assert.ok(door&&send);vm.runInNewContext(door[0]+'\n'+send[0]+'\ntoForm("qa-id");',ctx);
  assert.equal(handoff.sourceId,source.id);assert.equal(handoff.title,source.nm);assert.equal(handoff.url,source.url);assert.equal(handoff.uid,ctx.fbUid);
  assert.match(ctx.location.href,/kcareer\.html\?go=form&application=/);assert.ok(!ctx.location.href.includes(source.nm));
});

test('★★ 정부사업신청에 서식 채우기 «화면»을 짓지 않았다', () => {
  // 짓는 순간 같은 것이 두 곳이 되고, 한쪽만 고쳐지면 어느 쪽이 맞는지 알 수 없게 된다.
  ['rhwp', 'pu-hwp-engine', 'kcareer-hwpxfill', 'kcareer-formmap', 'kcareer-slotai']
    .forEach((n) => {
      assert.ok(gov.indexOf(n) < 0, '「' + n + '」 이 정부사업신청으로 넘어왔습니다');
    });
});

/* ── ③ 「➕ 경력관리로 넘기기」 받는 문 (2026-10-05) ── */
function runAdd(h, opt) {
  opt = opt || {};
  const els = {}, log = { form: [], toast: [], replaced: [] };
  const store = h === undefined ? {} : { pu_kc_handoff: JSON.stringify(h) };
  const ctx = {
    console, String, Number, Object, Array, RegExp, JSON, Date, URLSearchParams,
    location: { search: '?go=add', pathname: '/kcareer.html' },
    history: { replaceState: (a, b, c) => log.replaced.push(c) },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), removeItem: (k) => { delete store[k]; } },
    document: { getElementById: (id) => els[id] || null, querySelector: () => null },
    openForm: (page, id) => { log.form.push([page, id]); ['ff-org', 'ff-titleVal', 'ff-periodStart', 'ff-periodEnd', 'ff-agency', 'ff-project', 'ff-year', 'ff-status', 'ff-note', 'ff-title', 'ff-joinDate', 'ff-leaveDate'].forEach((k) => { els[k] = { value: k === 'ff-status' ? '진행' : '' }; }); if (opt.pre) Object.assign(els['ff-org'], { value: opt.pre }); },
    toast: (m) => log.toast.push(m), kcApplyLock: () => 'owner', setTimeout: () => {}, nav_to: () => {}, goForm: () => {}, _safe: (f) => f()
  };
  const pick = (re) => { const m = kc.match(re); assert.ok(m, String(re)); return m[0]; };
  const code = [pick(/var KC_HANDOFF_FILL=\{[\s\S]*?\n\};/), pick(/function kcAddFromHandoff\(tries\)\{[\s\S]*?\n\}/), pick(/function kcOpenFromUrl\(tries\)\{[\s\S]*?\n\}/)].join('\n');
  vm.runInNewContext(code + '\n;globalThis.__a={kcOpenFromUrl};', ctx);
  ctx.__a.kcOpenFromUrl(0);
  return { els, log, store };
}
test('★★★ go=add — 넘겨받은 위촉 경력으로 등록 창을 «채워서» 연다(저장은 안 한다)', () => {
  const r = runAdd({ page: 'wiccok', org: '서산시', title: '서산시 노사민정협의회 위원', from: '2024.03', to: '현재', at: Date.now() });
  assert.deepEqual(r.log.form, [['wiccok', null]]);
  assert.equal(r.els['ff-org'].value, '서산시'); assert.equal(r.els['ff-titleVal'].value, '서산시 노사민정협의회 위원');
  assert.equal(r.els['ff-periodStart'].value, '2024.03'); assert.equal(r.els['ff-periodEnd'].value, '', '현재는 끝날을 비운다');
  assert.equal(r.store.pu_kc_handoff, undefined, '읽으면 곧바로 지운다');
  assert.deepEqual(r.log.replaced, ['/kcareer.html']);
  assert.match(r.log.toast[0], /확인하고 저장/);
  assert.ok(!/fbPush|set\(/.test(kc.match(/function kcAddFromHandoff\(tries\)\{[\s\S]*?\n\}/)[0]), '저장하지 않는다');
});
test('★★ 컨설팅·근무도 칸이 맞게 · 이미 친 칸은 덮지 않는다', () => {
  const c = runAdd({ page: 'consult', org: '충남경제진흥원', title: '일자리전환 컨설팅', from: '2020.08', to: '2023.10', at: Date.now() });
  assert.equal(c.els['ff-agency'].value, '충남경제진흥원'); assert.equal(c.els['ff-year'].value, '2023'); assert.equal(c.els['ff-project'].value, '일자리전환 컨설팅');
  assert.equal(c.els['ff-status'].value, '진행', '이미 값이 있는 칸(기본값)은 덮지 않는다');
  const w = runAdd({ page: 'work', org: '가나재단', title: '관리소장', from: '2018.01', to: '2019.02', at: Date.now() }, { pre: '먼저친값' });
  assert.equal(w.els['ff-org'].value, '먼저친값'); assert.equal(w.els['ff-joinDate'].value, '2018.01'); assert.equal(w.els['ff-leaveDate'].value, '2019.02');
});
test('★★ 넘긴 것이 없거나 10분 넘었거나 모르는 갈래면 열지 않고 말한다', () => {
  [undefined, { page: 'wiccok', org: 'x', title: 'y', from: '2020', at: Date.now() - 11 * 60000 }, { page: 'secret', at: Date.now() }].forEach((h) => {
    const r = runAdd(h);
    assert.deepEqual(r.log.form, []); assert.match(r.log.toast[0], /넘겨받은 내용이 없거나 오래됐습니다/);
  });
});
