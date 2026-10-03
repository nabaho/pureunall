'use strict';
/* 📥 메일에서 온 연락처 (대표 승인 목업 2026-10-03)
   「메일함에 스팸이 아닌 새로운 메일이 들어올 경우 거래처 또는 신규고객일 수 있다 …
    자동으로 기업정보함으로 연결해서 보낼수 있을까? 어떻게 해야 스펨과 문제 없이」

   지키는 것
   ① 갈래 셋 — 회사 도메인이 업체 «한 곳»과 같음(dom) · 우리가 답장한 상대(replied) · 문의 제목 미답장(inq)
   ② 스팸과 안 섞인다 — 광고 갈래·숨긴 칸·우리 스팸 판정·공공기관·기계발신·보낸 칸은 안 센다
   ③ 무료메일·공공기관 도메인, 둘 이상 업체가 쓰는 도메인, 끝난 업체는 «저절로» 안 잇는다
   ④ 저절로 채우기는 관리자만 · dom 만 · 한 건씩 · 실패는 안 적는다 · 한 번에 MNEW_AUTO_MAX 까지
   ⑤ 되돌리기는 «저절로 넣은 줄»만 빼고, 기록을 남겨 다시 안 채운다
   ⑥ 이름으로는 저절로 안 잇는다 — 잇기는 사람이 누르고, 업체 열쇠(id)로만
   ⑦ 🆕 딱지는 문의 미답장 줄에만 · 보낸 칸·원본 칸에는 안 붙는다
   ⑧ 메일 창·기업정보함 «둘 다»에서 들어갈 수 있다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');
const consts = ['MNEW_INQ', 'MNEW_AD', 'MNEW_AUTO_MAX', 'MB_PUB_TAIL', 'MB_BOT_RE', 'MB_NEW_DAYS']
  .map((n) => { const m = app.match(new RegExp('^const ' + n + '\\s*=[^\\n]*;', 'm')); assert.ok(m, n); return m[0].replace(/^const /, 'var '); })
  .join('\n');

const D = Date.now();
const COS = [
  { id: 'co1', name: '가나상사', email: 'office@ganasa.co.kr', contacts: [] },
  { id: 'co2', name: '다라물류', contacts: [{ email: 'boss@dara.co.kr' }] },
  /* 둘이 같은 도메인을 쓴다 — 그룹사 · 이 도메인으로는 안 짚는다 */
  { id: 'co3', name: '마바1공장', email: 'a@maba.co.kr' },
  { id: 'co4', name: '마바2공장', email: 'b@maba.co.kr' },
  /* 끝난 업체 */
  { id: 'co5', name: '사아무역', email: 'x@saa.co.kr', status: 'closed' },
  /* 담당자가 네이버를 쓴다 — 무료메일 도메인으로 짚으면 온 세상 네이버가 여기로 온다 */
  { id: 'co6', name: '자차상회', contacts: [{ email: 'jacha@naver.com' }] },
];
const FOLDERS = {
  IN: { name: 'INBOX', kind: 'inbox' }, B1: { name: '1.자문사답변', kind: 'custom' },
  AD: { name: '기타광고', kind: 'custom' }, HID: { name: '개인메일', kind: 'custom' },   /* 광고 이름이 아닌데 «숨긴» 칸 */
  SENT: { name: 'Sent Messages', kind: 'sent' }, TR: { name: '휴지통', kind: 'trash' },
};
const M = (e, s, d, extra) => Object.assign({ e, f: e.split('@')[0], s, d: d || D - 3600000, r: 1 }, extra || {});
function world(o) {
  o = o || {};
  return Object.assign({
    IN: { 1: M('hong@ganasa.co.kr', '산업재해조사표 검토 요청'), 2: M('lee.yh@naver.com', '[다라물류] 9월 급여대장'),
      3: M('kim@mabatech.co.kr', '노무 자문 계약 관련 문의드립니다'), 4: M('choi77@gmail.com', '취업규칙 송부의 건'),
      5: M('noreply@shop.co.kr', '견적 문의 이벤트'), 6: M('min@korea.go.kr', '상담 안내'),
      7: M('one@maba.co.kr', '견적 요청'), 8: M('z@saa.co.kr', '계약 종료 문의'), 9: M('n2@naver.com', '안녕하세요') },
    B1: { 1: M('yoon@gaon.co.kr', '[상담] 취업규칙 문의') },
    AD: { 1: M('ad@promo.kr', '상담 문의 할인') },
    HID: { 1: M('sns@sns.kr', '견적 문의') },
    TR: { 1: M('t@trash.kr', '문의') },
    SENT: { 1: M('370-6@daum.net', 'RE', D, { t: 'LEE.YH@naver.com, other@x.kr' }), 2: M('370-6@daum.net', 'RE', D, { t: 'choi77@gmail.com' }) },
  }, o.msgs || {});
}
function box(o) {
  o = o || {};
  const ctx = {
    Object, String, Number, Array, Date, RegExp, Math, JSON, WeakMap, Promise,
    console: { log() {}, warn() {} },
    _mbMsgs: world(o), _mbCo: {}, _mbOwner: {}, _memo: {}, _mnewLs: null, _mnewSig: '',
    _mnewAutoLog: o.log === undefined ? {} : o.log,
    state: { isAdmin: o.admin !== false, view: 'mail' },
    myEmail: 'p001@pureun.kr', DB_ROOT: 'pucards', MB_OLD_ID: '*old', MB_RAW_P: '~',
    MB_PUB_DOM: ['naver.com', 'gmail.com', 'hanmail.net', 'daum.net', 'nate.com'],
    ErpMatch: { ready: true, companies: COS, nameByEmail: { 'p001@pureun.kr': '권형하' } },
    mbNow: () => (o.now || 'IN'), mbSentBox: (id) => id === 'SENT',
    mbMemoOf: () => ctx._memo,
    mbFolderBy: (s) => FOLDERS[s] || null,
    mbGotFolder: (f) => !!f && !{ sent: 1, drafts: 1, tome: 1, sched: 1 }[f.kind] && f.kind !== 'trash',
    mbHidden: (s) => s === 'HID',
    mbIsSpam: (v) => /깨진/.test(String(v.s || '')),
    mbWhoKey: (s) => String(s || '').toLowerCase().replace(/[.#$\[\]/]/g, ','),
    mbDomOf: (e) => { const i = String(e).lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1).toLowerCase(); },
    mbNewSkipSet: () => o.skip || {},
    mbWhoIndex: () => ({ coAddr: o.coAddr || {} }),
    mbCoOf: () => '', mbMyAddr: () => '370-6@daum.net',
    /* 이름 짚기 — 제목에 「다라물류」 가 있으면 그 업체(짐작) */
    mbNewCoOf: (e, hay) => (/다라물류/.test(hay) ? { co: COS[1], why: '이름' } : null),
    toast: (t) => { ctx._toast = t; }, renderPCSide() {}, renderMailPage() {}, mbNewBust() {},
    confirm: () => true,
  };
  vm.createContext(ctx);
  vm.runInContext(consts, ctx);
  ['mbNewAskable', 'mnewSentTo', 'mnewSkipFolder', 'mnewDomCo', 'mnewDomTable', 'mnewRows', 'mnewBust',
    'mnewInqTag', 'mnewAutoFill', 'erpUnfillContact', 'mnewUndo', 'mnewLink', 'mnewRow']
    .forEach((n) => vm.runInContext(sliceFn(app, (/^(mnewAutoFill|erpUnfillContact|mnewUndo|mnewLink)$/.test(n) ? 'async ' : '') + 'function ' + n + '('), ctx));
  vm.runInContext('var _mnewAutoBusy = false;', ctx);
  return ctx;
}
const kinds = (c) => Array.prototype.map.call(c.mnewRows(), (r) => r.kind + ':' + r.em).sort();

test('★★★ 갈래 셋 — 도메인 · 답장한 상대 · 문의 미답장, 나머지는 안 나온다', () => {
  const c = box();
  assert.deepEqual(kinds(c), [
    'dom:hong@ganasa.co.kr',
    /* 끝난 업체 도메인의 문의도 «문의»로는 나온다 — 저절로 잇지만 않는다 */
    'inq:kim@mabatech.co.kr', 'inq:one@maba.co.kr', 'inq:yoon@gaon.co.kr', 'inq:z@saa.co.kr',
    'replied:choi77@gmail.com', 'replied:lee.yh@naver.com',
  ]);
});

test('★★★ 스팸과 안 섞인다 — 광고 갈래·숨긴 칸·휴지통·스팸 판정·공공기관·기계발신은 안 센다', () => {
  const c = box({ msgs: { B1: { 1: M('spam@x.kr', '깨진 제목 문의') } } });
  const all = kinds(c).join(' ');
  ['ad@promo.kr', 'sns@sns.kr', 't@trash.kr', 'spam@x.kr', 'min@korea.go.kr', 'noreply@shop.co.kr']
    .forEach((e) => assert.ok(all.indexOf(e) < 0, '★★★ ' + e + ' 가 목록에 섞였습니다'));
});

test('★★★ 저절로 잇는 도메인은 «업체 한 곳»만 — 무료메일·그룹사·끝난 업체는 안 된다', () => {
  const c = box({ msgs: { IN: { 1: M('new@naver.com', '안녕'), 2: M('x2@maba.co.kr', '안녕'), 3: M('y@saa.co.kr', '안녕') } } });
  const dom = Array.prototype.filter.call(c.mnewRows(), (r) => r.kind === 'dom');
  assert.equal(dom.length, 0, '★★★ ' + dom.map((r) => r.em).join(',') + ' 를 도메인으로 저절로 잇습니다');
});

test('★★ 답장 여부는 보낸메일함 «받는 사람 전부»에서, 대소문자 없이', () => {
  const c = box();
  const lee = Array.prototype.filter.call(c.mnewRows(), (r) => r.em === 'lee.yh@naver.com')[0];
  assert.equal(lee.kind, 'replied');
  assert.equal(lee.co && lee.co.id, 'co2', '(대조) 이름 짚기는 «권하기»로 붙는다');
});

test('★★ 이미 채웠거나 되돌린 주소, 「넘어가기」 한 주소는 안 나온다', () => {
  const c = box({ log: { 'hong@ganasa,co,kr': { em: 'hong@ganasa.co.kr', added: true } }, skip: { 'choi77@gmail,com': 1 } });
  const all = kinds(c).join(' ');
  assert.ok(all.indexOf('hong@') < 0, '★★ 채운 주소를 또 내놓습니다');
  assert.ok(all.indexOf('choi77@') < 0, '★★ 넘어간 주소를 또 내놓습니다');
});

test('★★★ 🆕 딱지는 «문의 미답장» 줄에만 — 답장한 상대·보낸 칸·원본 칸에는 없다', () => {
  const c = box();
  assert.match(c.mnewInqTag({ e: 'kim@mabatech.co.kr', s: '노무 자문 계약 관련 문의드립니다' }), /🆕 신규 문의\?/);
  assert.equal(c.mnewInqTag({ e: 'kim@mabatech.co.kr', s: '자료 보냅니다' }), '', '★ 문의 아닌 메일에도 붙습니다');
  assert.equal(c.mnewInqTag({ e: 'lee.yh@naver.com', s: '견적 문의' }), '', '★★ 답장한 상대에 붙습니다');
  assert.equal(box({ now: 'SENT' }).mnewInqTag({ e: 'kim@mabatech.co.kr', s: '문의' }), '');
  assert.equal(box({ now: '~raw' }).mnewInqTag({ e: 'kim@mabatech.co.kr', s: '문의' }), '');
});

function fillBox(o) {
  const c = box(o);
  c.calls = [];
  c.erpFillContact = async (t) => { c.calls.push(t.coId + ':' + t.email + ':' + t.from); return (o && o.fail) ? { ok: false, why: 'x' } : { ok: true, added: true }; };
  c.wrote = [];
  c.firebase = { database: () => ({ ref: (p) => ({ set: async (v) => { c.wrote.push(p); }, once: async () => ({ val: () => null }) }) }) };
  c._mbFolders = {};
  return c;
}

test('★★★ 저절로 채우기 — 관리자만 · dom 만 · 업체 열쇠로 · 기록을 남긴다', async () => {
  const c = fillBox();
  vm.runInContext('var _mbFolders = {};', c);
  await c.mnewAutoFill();
  assert.deepEqual(c.calls.slice(), ['co1:hong@ganasa.co.kr:mail-auto'], '★★★ 도메인 줄 말고 다른 것까지 채웁니다');
  assert.ok(c.wrote.some((p) => /\/config\/mailAutoFill\/hong@ganasa,co,kr$/.test(p)), '★★ 무엇을 채웠는지 안 남깁니다');
  const n = box({ admin: false });
  let called = 0;
  n.erpFillContact = async () => { called++; return { ok: true, added: true }; };
  vm.runInContext('var _mbFolders = {};', n);
  await n.mnewAutoFill();
  assert.equal(called, 0, '★★★ 관리자가 아닌데 채웁니다 — 두 PC 가 같은 업체를 동시에 고치면 한쪽이 사라집니다');
});

test('★★ 실패한 것은 적지 않는다 — 다음 차례에 다시 해 본다', async () => {
  const c = fillBox({ fail: true });
  vm.runInContext('var _mbFolders = {};', c);
  await c.mnewAutoFill();
  assert.equal(c.calls.length, 1);
  assert.equal(c.wrote.length, 0, '★★ 실패를 기록해 다시는 안 채웁니다');
});

test('★★ 한 번에 MNEW_AUTO_MAX 까지만 — 나머지는 다음 차례에', async () => {
  const many = {};
  for (let i = 0; i < 30; i++) many[i] = M('u' + i + '@ganasa.co.kr', '안녕');
  const c = fillBox({ msgs: { IN: many } });
  vm.runInContext('var _mbFolders = {};', c);
  await c.mnewAutoFill();
  assert.equal(c.calls.length, vm.runInContext('MNEW_AUTO_MAX', c));
});

test('★★★ 되돌리기는 «저절로 넣은 줄»만 뺀다 — 사람이 넣은 줄은 그대로', async () => {
  const c = box({ log: { k1: { em: 'hong@ganasa.co.kr', co: 'co1', coName: '가나상사', added: true } } });
  const company = { id: 'co1', name: '가나상사', primaryContactEmail: 'hong@ganasa.co.kr', primaryContactName: '홍길동',
    contacts: [{ email: 'hong@ganasa.co.kr', addedFrom: 'mail-auto', isPrimary: true },
      { email: 'hong@ganasa.co.kr', addedFrom: 'mail-read' }, { email: 'boss@ganasa.co.kr' }] };
  let up = null; const sets = [];
  c.firebase = { database: () => ({
    ref: (p) => ({ once: async () => ({ val: () => (p === 'data/companies' ? { v: [company] } : null) }),
      set: async (v) => { sets.push(p + '=' + v); }, update: async (u) => { up = u; } }) }) };
  c.mbWhoBust = () => {}; c.mbCardsRevBump = () => {};
  vm.runInContext('ErpMatch.load = function(){};', c);
  await c.mnewUndo('k1');
  assert.ok(up, '★★★ 되돌리기가 아무것도 안 씁니다');
  const merged = up['data/companies/v/0'];
  assert.equal(merged.contacts.length, 2);
  assert.ok(merged.contacts.some((x) => x.addedFrom === 'mail-read'), '★★★ 사람이 넣은 줄까지 뺍니다');
  assert.equal(merged.primaryContactEmail, '', '★★ 대표 담당자 칸에 뺀 주소가 남습니다');
  assert.ok(c._mnewAutoLog.k1.undone, '★★★ 되돌린 표를 안 남겨 다음 차례에 또 채웁니다');
  assert.ok(sets.some((s) => /mailAutoFill\/k1\/undone=/.test(s)));
});

test('★★★ 이름으로는 저절로 안 잇는다 — 잇기는 사람이 누르고 업체 열쇠(id)로만', () => {
  const auto = strip(sliceFn(app, 'async function mnewAutoFill('));
  assert.match(auto, /r\.kind === 'dom'/, '★★★ 도메인 말고(이름 짐작까지) 저절로 잇습니다');
  const link = strip(sliceFn(app, 'async function mnewLink('));
  assert.match(link, /erpFillContact\(\{\s*coId:co\.id/);
  const html = strip(sliceFn(app, 'function mnewHtml('));
  assert.match(html, /mnewLink\('\$\{esc\(r\.key\)\}','\$\{esc\(String\(r\.co\.id\)\)\}'\)/, '★★ 잇기 단추가 업체 열쇠를 안 씁니다');
});

test('★★ 메일 창·기업정보함 «둘 다»에서 들어간다 · 주소로도 온다', () => {
  assert.match(app, /: state\.mailSent==='mnew' \? mnewHtml\(\)/, '★★ 메일 창이 이 화면을 안 그립니다');
  assert.match(app, /onclick="openMnewPage\(\)"[\s\S]{0,300}메일에서 온 연락처/, '★★ 메일 창 옆줄에 자리가 없습니다');
  assert.match(app, /onclick="openMnewWindow\(\)"[^>]*>📥<em>메일 연락처<\/em>/, '★★ 기업정보함 옆줄에 자리가 없습니다');
  assert.match(strip(sliceFn(app, 'function openMnewWindow(')), /view=mail&mail=mnew/);
  const ctx = { String, RegExp };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mailMnewFromUrl('), ctx);
  assert.equal(ctx.mailMnewFromUrl('?view=mail&mail=mnew'), true);
  assert.equal(ctx.mailMnewFromUrl('?view=mail&mail=mnewx'), false);
  assert.equal(ctx.mailMnewFromUrl('?view=mail&mail=succ'), false);
  assert.match(app, /if\(mailMnewFromUrl\(\)\)\{ openMnewPage\(\); return; \}/, '★★ 주소로 건너와도 이 화면을 안 엽니다');
});

test('★★ 저절로 채우기는 «그리기 밖»에서 돈다 — 시계만 한 번 건다', () => {
  assert.match(app, /mnewTickStart\(\); \/\* 📥/);
  const tick = strip(sliceFn(app, 'function mnewTickStart('));
  assert.match(tick, /if\(_mnewTick/, '★ 그릴 때마다 시계를 또 겁니다');
  assert.match(tick, /state\.isAdmin/);
  const html = strip(sliceFn(app, 'function mnewHtml('));
  assert.doesNotMatch(html, /mnewAutoFill\(|erpFillContact\(/, '★★ 그리는 자리에서 업체를 고칩니다');
});

test('★★ 한 줄로 — 넘치면 「…」', () => {
  const css = (app.match(/\.mn-r\{[^}]*\}/) || [''])[0];
  assert.match(css, /white-space:nowrap/);
  assert.match((app.match(/\.mn-r \.sj\{[^}]*\}/) || [''])[0], /text-overflow:ellipsis/);
  assert.match((app.match(/\.mn-sec\{white-space[^}]*\}/) || [''])[0], /text-overflow:ellipsis/);
});
