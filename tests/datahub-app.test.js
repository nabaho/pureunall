/* 데이터관리(대표 전용) 화면 — pu-datahub.html · js/pu-datahub-view.js · js/pu-3d-lite.js (2026-11-21)
   ★ 값이 아니라 «규칙»을 본다 (CLAUDE.md 「검사는 규칙을 못 박는다」)
   ① 원본에 쓰지 않는다 — 쓰는 자리는 datahub/{uid}/settings 하나, 그것도 저장 관문(createGateway)으로만
   ② 화면 숫자는 PuDatahubCalc.build() 를 거친다 — 입금(amount)을 화면 파일에서 직접 더하지 않는다
   ③ 앱 안 대표 확인은 app_owner/uid 를 보고 «모르면 닫는다» — 확인 전에는 자료를 읽지 않는다
   ④ 범용 AI 창구(PuAiCall·readDoc)를 부르지 않는다 — 데이터관리 전용 함수(datahub*)만
   ⑤ 채팅에 보내는 것은 pseudonymize() 의 가명 숫자 — 실명표(back)는 보내거나 저장하지 않는다
   ⑥ 바깥 스크립트는 gstatic(파이어베이스)뿐 — CDN 금지
   ⑦ 비밀번호를 저장하지 않는다 — 칸에서 읽자마자 비우고 재인증에만 넘긴다
   ⑧ 보기 설정 저장 칸은 허용 목록만 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments, stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const FILES = ['pu-datahub.html', 'js/pu-datahub-view.js', 'js/pu-3d-lite.js'];
const code = (f) => (/\.html$/.test(f) ? stripComments(read(f)) : stripJs(read(f)));
const VIEW_RAW = read('js/pu-datahub-view.js');
const VIEW = code('js/pu-datahub-view.js');
const HTML = read('pu-datahub.html');
const fn = (decl) => { const s = cutFn(VIEW_RAW, decl); assert.ok(s, decl + ' 를 못 찾았다'); return s; };

/* 괄호 짝으로 호출 하나를 떼어 낸다 */
function callAt(src, i) {
  let d = 0;
  for (let j = src.indexOf('(', i); j < src.length; j++) {
    if (src[j] === '(') d++;
    else if (src[j] === ')') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return src.slice(i);
}

/* ── ① 원본 쓰기 없음 ── */
const REF_WRITE = /\.ref\([^)]*\)\s*\.\s*(?:set|update|remove|push|transaction|setWithPriority)\s*\(/;
const VAR_WRITE = /\b\w*[Rr]ef\w*\s*\.\s*(?:set|update|remove|push|transaction)\s*\(/;
test('①(이빨) 쓰기 찾개는 실제로 잡는다', () => {
  assert.ok(REF_WRITE.test("DB.ref('data/x').set(1)"));
  assert.ok(REF_WRITE.test("db.ref(p) .update({a:1})"));
  assert.ok(VAR_WRITE.test('myRef.remove()'));
  assert.ok(!VAR_WRITE.test("el.classList.remove('on')"), '화면 꾸밈(classList.remove)은 쓰기가 아니다');
  assert.ok(VAR_WRITE.test('settingsRef.transaction(fn)'));
});
test('①★ 데이터관리 파일은 파이어베이스 자리에 직접 쓰지 않는다 (set·update·remove·push·transaction)', () => {
  for (const f of FILES) {
    const s = code(f);
    assert.ok(!REF_WRITE.test(s), f + ': ref(...) 에 바로 쓰는 곳이 있다 — 원본은 읽기만 한다');
    assert.ok(!VAR_WRITE.test(s), f + ': ref 를 담은 이름으로 쓰는 곳이 있다');
  }
});
test('①★ 저장은 저장 관문 하나로, datahub/{uid}/settings 에만', () => {
  assert.match(VIEW, /createGateway\(\{\s*program:\s*'datahub',\s*mode:\s*'enforce'/, '저장 관문을 datahub · enforce 로 만들어야 한다');
  const saves = [];
  let i = -1;
  /* 캔버스 g.save() 처럼 인자 없는 것은 저장이 아니다 */
  while ((i = VIEW.indexOf('.save(', i + 1)) >= 0) { const c = callAt(VIEW, i); if (!/^\.save\(\s*\)$/.test(c)) saves.push(c); }
  assert.ok(saves.length >= 1, '저장하는 곳을 못 찾았다');
  saves.forEach((c) => assert.match(c, /\.ref\(\s*'datahub\/'\s*\+\s*ME\.uid\s*\+\s*'\/settings'\s*\)/, '저장 자리가 datahub/{uid}/settings 가 아니다: ' + c.slice(0, 120)));
  /* .once 말고 실시간 구독(on)도 쓰지 않는다 — 읽기는 한 번씩 */
  assert.ok(!/\.ref\([^)]*\)\s*\.on\(/.test(VIEW), '원본을 실시간 구독하지 않는다(once 로 읽기만)');
});

/* ── ② 숫자는 build 를 거친다 ── */
test('②★ 화면 숫자는 PuDatahubCalc.build() 결과로만 — 입금 금액을 화면 파일에서 더하지 않는다', () => {
  assert.match(VIEW, /\bC = global\.PuDatahubCalc\b/, '계산 모듈을 불러야 한다');
  assert.ok((VIEW.match(/\bC\.build\(/g) || []).length >= 1, 'C.build(…) 로 집계해야 한다');
  for (const f of ['js/pu-datahub-view.js', 'js/pu-3d-lite.js']) {
    const s = code(f);
    assert.ok(!/\.amount\b/.test(s), f + ': 입금 금액(amount)을 화면 파일에서 직접 다룬다 — 계산 모듈에 맡긴다');
    assert.ok(!/\.cardFee\b|perfShares|\.sourceKind\b/.test(s), f + ': 입금 줄의 칸을 화면 파일에서 직접 다룬다');
  }
  /* finance_income 은 «읽는 자리 이름»으로만 나온다 */
  const hits = VIEW.split('\n').filter((l) => /finance_income/.test(l));
  assert.ok(hits.length >= 1, '입금 자리를 읽어야 한다');
  hits.forEach((l) => assert.match(l, /rd\('fin',\s*'data\/finance_income'/, '입금 자리를 읽기 말고 다른 데 쓴다: ' + l.trim().slice(0, 100)));
});

/* ── ③ 모르면 닫는다 ── */
test('③★ 대표 확인은 app_owner/uid 와 내 uid 가 같을 때만 연다 — 없음·다름·못 읽음은 모두 닫는다', () => {
  const g = fn('function ownerGate(');
  assert.match(g, /\.ref\('app_owner\/uid'\)\.once\('value'\)/, 'app_owner/uid 를 읽어야 한다');
  assert.match(g, /owner\s*==\s*null\s*\|\|\s*owner\s*===\s*''/, '표지가 없을 때 닫아야 한다');
  assert.match(g, /typeof owner !== 'string'\s*\|\|\s*owner !== user\.uid/, '내 uid 와 다르면 닫아야 한다');
  assert.ok((g.match(/locked\(/g) || []).length >= 3, '없음·다름·못 읽음 세 갈래 모두 닫아야 한다');
  assert.match(g, /\},\s*function \(e\)\s*\{[\s\S]*locked\(/, '읽기에 실패하면(오류·권한) 닫아야 한다 — 모르면 닫는다');
  assert.ok(g.indexOf('openApp(') > g.indexOf('owner !== user.uid'), '확인을 마친 «뒤에만» 연다');
  assert.ok(!/isAdmin|role/.test(g), '대표 확인에 isAdmin·role 을 쓰지 않는다(관리자대행도 isAdmin)');
  /* 여는 곳은 ownerGate 하나뿐 */
  const calls = VIEW.split('\n').filter((l) => /openApp\(/.test(l) && !/function openApp\(/.test(l));
  assert.equal(calls.length, 1, 'openApp 을 부르는 곳은 대표 확인 한 곳뿐이어야 한다');
  assert.ok(g.includes(calls[0].trim()), 'openApp 은 ownerGate 안에서만 부른다');
});
test('③★ (돌려 보기) 표지 없음·빈 값·다름·글자 아님·못 읽음은 닫고, 내 uid 와 같을 때만 연다', async () => {
  const vm = require('vm');
  const src = fn('function ownerGate(');
  async function run(val, fail) {
    const log = [];
    const ctx = { EPOCH: 1, why: () => 'e', locked: () => log.push('닫음'), openApp: () => log.push('엶'),
      DB: { ref: () => ({ once: () => (fail ? Promise.reject(Object.assign(new Error('denied'), { code: 'PERMISSION_DENIED' })) : Promise.resolve({ val: () => val })) }) } };
    vm.runInNewContext(src + '\nres = ownerGate({ uid: "u1" }, 1);', ctx);
    await ctx.res;
    return log.join(',');
  }
  assert.equal(await run(null), '닫음', '표지가 없으면 닫는다');
  assert.equal(await run(''), '닫음', '빈 표지면 닫는다');
  assert.equal(await run('u2'), '닫음', '다른 uid 면 닫는다');
  assert.equal(await run({ uid: 'u1' }), '닫음', '글자가 아니면 닫는다');
  assert.equal(await run('u1', true), '닫음', '못 읽으면 닫는다(모르면 닫는다)');
  assert.equal(await run('u1'), '엶', '내 uid 와 같을 때만 연다');
});
test('③★ 자료 읽기는 대표 확인을 통과한 뒤에만 — 부팅·권한 확인 단계는 원본을 읽지 않는다', () => {
  const boot = fn('function boot(');
  assert.ok(!/loadAll\(|'data\/|work_erp|datahub_board|ontology\//.test(boot), '부팅 단계에서 원본을 읽는다');
  const load = fn('function loadAll(');
  assert.match(load, /if \(!GATE_OK\) return;/, '읽기 함수가 대표 확인 표시를 먼저 봐야 한다');
  assert.match(fn('function openApp('), /GATE_OK = true/, '대표 확인을 통과해야 표시가 켜진다');
  assert.match(fn('function wipe('), /GATE_OK = false/, '잠그거나 계정이 바뀌면 표시를 끈다');
  assert.ok(!/sid\s*===\s*'|name\s*===\s*'/.test(fn('function ownerGate(')), '사번·이름으로 대표를 못 박지 않는다');
});

/* ── ④ 범용 AI 창구 안 씀 ── */
test('④★ 범용 AI 창구(PuAiCall·readDoc)를 부르지 않고, 데이터관리 전용 함수만 부른다', () => {
  for (const f of FILES) assert.ok(!/PuAiCall|readDoc/.test(code(f)), f + ': 범용 AI 창구를 부른다');
  const names = [...VIEW.matchAll(/callFn\('([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 3, '서버 함수를 부르는 곳을 못 찾았다');
  names.forEach((nm) => assert.match(nm, /^datahub[A-Z]/, '데이터관리 전용이 아닌 함수를 부른다: ' + nm));
  assert.match(VIEW, /var FN_BASE = 'https:\/\/asia-northeast3-pureun-erp\.cloudfunctions\.net\/'/, '서버 함수 주소가 정해진 곳이 아니다');
  const fetches = VIEW.split('\n').filter((l) => /fetch\(/.test(l));
  fetches.forEach((l) => assert.match(l, /fetch\(FN_BASE \+ name/, '정해진 서버 함수 말고 다른 곳으로 보낸다: ' + l.trim().slice(0, 100)));
});

/* ── ⑤ 가명 숫자만 ── */
test('⑤★ 채팅에 보내는 본문은 pseudonymize() 의 ctx — 실명표(back)는 보내거나 저장하지 않는다', () => {
  const s = fn('function sendAsk(');
  assert.match(s, /C\.pseudonymize\(DS\)/, '가명 집계를 만들어야 한다');
  assert.match(s, /ctxJson = JSON\.stringify\(ps\.ctx\)/, '보내는 집계는 pseudonymize 의 ctx 여야 한다');
  const ask = callAt(s, s.indexOf("callFn('datahubAsk'"));
  assert.match(ask, /\{\s*nonce: nonce,\s*ts: ts,\s*q: qSend,\s*ctxJson: ctxJson,\s*sig: b64url\(sig\)\s*\}/, '보내는 칸이 정해진 다섯(nonce·ts·q·ctxJson·sig)이 아니다');
  assert.ok(!/back/.test(ask), '실명표(back)를 보낸다');
  assert.match(s, /qSend = C\.maskText\(q, ps\)/, '질문에 적은 실명·업체명도 «모든» 가명표로 바꿔 보낸다');
  /* 이 브라우저 기록에는 가명 글만 — 실명이 든 화면 글은 남기지 않는다(보안 검토 2026-11-21) */
  assert.match(s, /addMsg\('me', q, '', false\)/, '질문은 보내기 전에 기록하지 않는다(서버가 거절할 수 있다)');
  assert.match(s, /CHAT\.msgs\.push\(\{ who: 'me', text: qSend,/, '답을 받은 뒤 질문을 가명 글(qSend)로만 기록한다');
  assert.ok(s.indexOf("CHAT.msgs.push({ who: 'me', text: qSend,") > s.lastIndexOf('if (!res.ok) throw res;'), '질문 기록은 서버 답(res.ok)을 확인한 뒤에');
  assert.match(s, /addMsg\('ai', C\.unalias\(raw, back\), whyLine\(\), true, raw\)/, 'AI 답은 가명 그대로(raw)만 기록한다');
  assert.match(fn('function addMsg('), /typeof storeText === 'string'/, '기록할 글을 따로 받지 않으면 남기지 않는다');
  assert.match(s, /'datahub-ask\\n' \+ nonce \+ '\\n' \+ ts \+ '\\n' \+ h\[0\] \+ '\\n' \+ h\[1\]/, '서명할 글 꼴이 서버와 맞지 않는다');
  assert.match(s, /sha256hex\(qSend\), sha256hex\(ctxJson\)/, '보내는 본문 전체(질문·집계)가 서명 안에 들어가야 한다');
  assert.ok(!/idbPut\([^)]*back|setItem\(/.test(VIEW), '실명표를 저장하는 곳이 있다');
  /* 기기 열쇠는 꺼낼 수 없게 만든다 */
  assert.match(fn('function requestDevice('), /generateKey\(\{ name: 'ECDSA', namedCurve: 'P-256' \}, false, \['sign', 'verify'\]\)/, '비밀 열쇠는 꺼낼 수 없게(extractable:false) 만들어야 한다');
});

/* ── ⑥ 바깥 스크립트 ── */
test('⑥★ 바깥 스크립트는 gstatic 파이어베이스뿐 — CDN·웹 글꼴을 싣지 않는다', () => {
  const ext = [...HTML.matchAll(/<script[^>]+src="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.ok(ext.length >= 3, '파이어베이스를 싣지 않는다');
  ext.forEach((u) => assert.match(u, /^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-[a-z]+-compat\.js$/, '허용 밖 바깥 스크립트: ' + u));
  assert.ok(!/<link[^>]+href="https?:/.test(HTML), '바깥 스타일·글꼴을 싣는다');
  for (const f of ['js/pu-datahub-view.js', 'js/pu-3d-lite.js']) {
    const s = code(f);
    assert.ok(!/createElement\('script'\)|\bimport\(|importScripts/.test(s), f + ': 스크립트를 따로 끌어온다');
  }
  /* 사번 안전망은 파이어베이스보다 먼저 */
  assert.ok(HTML.indexOf('js/pu-sid-guard.js') >= 0 && HTML.indexOf('js/pu-sid-guard.js') < HTML.indexOf('firebase-app-compat'), '사번 안전망을 파이어베이스보다 먼저 싣는다');
});

/* ── ⑦ 비밀번호 ── */
test('⑦★ 비밀번호는 칸에서 읽자마자 비우고 재인증에만 넘긴다 — 어디에도 저장하지 않는다', () => {
  const r = fn('function reauth(');
  assert.match(r, /pw = el\.value;\s*\n\s*el\.value = '';/, '읽자마자 칸을 비워야 한다');
  assert.match(r, /EmailAuthProvider\.credential\(u\.email, pw\)/, '파이어베이스 재인증으로만 넘긴다');
  assert.match(r, /reauthenticateWithCredential\(cred\)/);
  assert.ok(!/setItem|idbPut|\.put\(|localStorage|sessionStorage|console\./.test(r), '비밀번호를 남길 수 있는 곳이 있다');
  for (const f of FILES) assert.ok(!/(localStorage|sessionStorage)[^\n]*(pw|password|비밀번호)/i.test(code(f)), f + ': 비밀번호를 브라우저 저장소에 둔다');
  const pws = [...HTML.matchAll(/<input[^>]+type="password"[^>]*>/g)].map((m) => m[0]);
  assert.ok(pws.length >= 1, '재인증 칸이 없다');
  pws.forEach((t) => assert.match(t, /autocomplete="current-password"/, '비밀번호 칸은 브라우저 비밀번호 관리자에 맡긴다'));
});

/* ── ⑧ 저장 칸 허용 목록 ── */
test('⑧ 보기 설정은 허용한 칸만 담는다 (서버 규칙이 그 밖을 막는다)', () => {
  const s = fn('function settingsRecord(');
  const body = s.slice(s.indexOf('var rec = {'), s.indexOf('};', s.indexOf('var rec = {')));
  const keys = [...body.matchAll(/(?:^|[{,\s])([A-Za-z]+):/g)].map((m) => m[1]);
  const OK = ['id', 'entityType', 'view', 'period', 'basis', 'net', 'vmode', 'aLines', 'cLines', 'thresholds', 'baseline'];
  assert.ok(keys.length >= 5, '저장 칸을 못 읽었다');
  keys.forEach((k) => assert.ok(OK.includes(k), '허용 밖 칸을 저장한다: ' + k));
  assert.match(body, /entityType: 'ViewState'/, '개체 종류는 ViewState');
  /* 서버 규칙(scripts/make-firebase-rules.js)의 settings 알려진 칸 안에 있는가 — 한쪽만 고치면 저장이 막힌다 */
  const R = read('scripts/make-firebase-rules.js');
  const at = R.indexOf('rules.datahub = {');
  if (at >= 0) {
    const blk = R.slice(R.indexOf('settings:', at), R.indexOf('$other', R.indexOf('settings:', at)));
    keys.forEach((k) => assert.match(blk, new RegExp('\\b' + k + ':'), '서버 규칙이 모르는 칸을 저장한다: ' + k));
  }
});
test('⑧ 저장 모양이 서버 규칙(묶음은 두 겹까지 · 빈 값 없음)과 맞는다', () => {
  const vm = require('vm');
  const src = ['function prune(', 'function thresholdsOut(', 'function settingsRecord('].map(fn).join('\n');
  const ctx = { VIEW: 'all', CUR: 12, DS: null, BASIS: 'cash', NET: false, GLOBAL_VMODE: 'both',
    SET: { aLines: { goal: 500 }, cLines: { warn: 12, over: null }, baseline: { adv: 1, case: null, cost: 70 },
      thresholds: { recWarn: 80, reconWarn: 2, reconBad: null, board: { erp: { w: 3, b: null }, work: { w: 5, b: 10 } } } } };
  vm.runInNewContext(src + '\nout = settingsRecord();', ctx);
  const r = ctx.out;
  assert.ok(!/null/.test(JSON.stringify(r)), '빈 값(null)을 보낸다');
  for (const [k, v] of Object.entries(r.thresholds || {})) {
    assert.ok(k.length <= 32, '현황판 기준 열쇠가 길다: ' + k);
    if (v && typeof v === 'object') Object.values(v).forEach((x) => assert.notEqual(typeof x, 'object', '현황판 기준이 세 겹이다: ' + k));
    else assert.equal(typeof v, 'number', k);
  }
  ['aLines', 'cLines', 'baseline'].forEach((k) => Object.values(r[k] || {}).forEach((x) => assert.notEqual(typeof x, 'object', k + ' 가 두 겹이 넘는다')));
  assert.equal(r.thresholds.work.b, 10, '앱별 주의 기준이 빠졌다');
});

/* ── 그 밖: 화면 규칙 ── */
test('표 왼쪽은 ☐ + 번호, 고르기만으로는 바뀌지 않는다(「3D에서 강조」를 눌러야)', () => {
  const t = fn('function renderTbl(');
  assert.ok(t.indexOf('class="ck"') >= 0 && t.indexOf('class="ck"') < t.indexOf('class="no"'), '맨 왼쪽은 ☐, 다음이 번호');
  assert.match(HTML, /data-act="focus">3D에서 강조</);
  assert.match(fn('function onPickChange('), /renderTbl\(\);\s*\n\s*\}/, '고르기는 표만 다시 그린다(3D 를 바꾸지 않는다)');
});
test('폰 구간에서 입력칸 16px · 3D 는 옆으로 끌기만(pan-y) · 확대를 막지 않는다', () => {
  assert.match(HTML, /@media \(max-width:600px\)\{[\s\S]*input,select,textarea\{font-size:16px\}/);
  assert.match(HTML, /\.stage canvas\{[^}]*touch-action:pan-y/);
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(HTML));
});
test('점검 씨앗: 대표 표지가 가짜 로그인 uid 와 같고, 지어낸 이름만 쓴다', () => {
  const seed = require('../tools/phone-audit/seed.js');
  const d = seed.apps.datahub;
  assert.ok(d && d.data, 'seeds/datahub.js 가 없다');
  assert.equal(d.data.app_owner.uid, seed.UID, '씨앗의 대표 표지가 가짜 로그인 uid 와 달라 화면이 잠긴다');
  d.data.data.user_dir.v.forEach((u) => assert.match(u.name, /^점검/, '점검 자료 이름은 «점검○○» 로 지어낸다: ' + u.name));
  d.data.data.companies.v.forEach((c) => assert.match(c.name, /점검/, '업체도 지어낸 이름만: ' + c.name));
});
