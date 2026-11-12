'use strict';
/* 건의함 보안규칙의 «번호(키) 모양 · 모르는 칸 · 칸의 종류와 크기» (2026-11-12 「건의함 보안규칙: 키 모양·크기 검사 추가」)

   ■ 왜 필요한가
     건의함 세 자리(suggestions_private · suggestions_meta_private · suggestions_resolved_private)는 «직원이 쓸 수 있는 자리» 인데
     규칙이 키 모양도 칸도 크기도 안 봤다. 번호에 & | ^ % 따옴표(셸 글자)를 넣으면 대표 PC 의 감시 도구에서 명령으로 읽힐 수 있었고,
     아무 이름의 칸에 큰 글을 숨기면 대표가 건의함 목록을 열 때마다 내려받았다. 실제 엔진(에뮬레이터)에서 예전 규칙은 이런 나쁜
     쓰기 36개를 그대로 받았고 새 규칙은 막는다(tests/suggestion-rules.emulator.mjs — 84개).

   ■ 이 검사의 자리
     에뮬레이터 검사는 «진짜 엔진» 이지만 수동이라 평소 전체 검사에 안 돈다. 이 파일은 같은 규칙을 «저장소 안의 모의 평가기» 로
     늘 지킨다. ⚠ 모의 평가기는 엔진이 아니다 — .validate 만 본다(.write·읽기 권한은 안 본다). 규칙의 «뜻» 이 의심스러우면
     에뮬레이터 검사가 기준이다(와일드카드 우선순위·부분 갱신·기존 자료는 거기서 확인했다).

   ■ 지키는 것 — 값이 아니라 «규칙»
     ① 번호(키)는 푸시 번호 모양만 — 화면(enter.html _chatImpValidId)·감시 도구와 «같은 모양»
     ② 모르는 칸은 거절($other) — 서버가 쓰는 칸(assist·watchNotice)은 직원이 못 쓰게 규칙에 없다
     ③ 칸마다 종류·길이 한도(그림 한 장·개수, 글 길이), relatedId·source 모양
     ④ 화면이 실제로 쓰는 정상 쓰기는 하나도 막히지 않는다(건의 접수·재요청·채팅 접수·답변·건의자 확인)
   실행: node --test tests/suggestion-rules.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const RULES = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
const enter = fs.readFileSync(path.join(root, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const generator = fs.readFileSync(path.join(root, 'scripts', 'make-firebase-rules.js'), 'utf8').replace(/\r\n/g, '\n');

/* ── 모의 평가기: .validate 만 ──
   · 값(newData)이 있는 자리마다 그 자리의 .validate 를 평가하고, 자식은 «이름 붙은 칸 → $와일드카드» 순으로 규칙을 찾는다
   · 규칙이 없는 칸은 통과(실제 엔진도 .validate 가 없으면 막지 않는다)
   · 부분 갱신(patch)은 «쓴 칸» 만 자식 규칙으로 보고, 그 위 자리(.validate)는 «합친 값» 으로 본다 */
class Snap {
  constructor(v, parent) { this.v = v; this.p = parent; }
  parent() { return this.p || new Snap(undefined); }
  hasChild(k) { return this.child(k).exists(); }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = (c && typeof c === 'object') ? c[k] : undefined; return new Snap(c); }
  val() { return this.v === undefined ? null : this.v; }
  exists() { return this.v !== undefined && this.v !== null; }
  hasChildren(keys) { return keys ? keys.every((k) => this.child(k).exists()) : (this.v && typeof this.v === 'object' && Object.keys(this.v).length > 0); }
  isString() { return typeof this.v === 'string'; }
  isNumber() { return typeof this.v === 'number'; }
  isBoolean() { return typeof this.v === 'boolean'; }
}
const AUTH = { uid: 'U_STAFF' };
const ROOT = new Snap({ uid_roles: { U_ADMIN: { isAdmin: true, status: 'active' }, U_STAFF: { isAdmin: false, status: 'active' } } });
function evalExpr(expr, vars, newVal, parentVal) {
  /* 실제 엔진의 문자열에는 .matches() 가 있다 — 평가하는 동안만 붙인다 */
  const had = Object.prototype.hasOwnProperty.call(String.prototype, 'matches');
  if (!had) Object.defineProperty(String.prototype, 'matches', { value: function (re) { return re.test(String(this)); }, configurable: true });
  try {
    const names = Object.keys(vars).concat(['auth', 'root', 'newData', 'now']);
    const vals = Object.keys(vars).map((k) => vars[k]).concat([AUTH, ROOT, new Snap(newVal, new Snap(parentVal)), Date.now()]);
    return Boolean(Function(...names, `"use strict"; return (${expr});`)(...vals));
  } finally { if (!had) delete String.prototype.matches; }
}
/* 변수 이름에 $ 가 들어 있어 Function 인자 이름으로 쓸 수 있다($id·$uid·$i·$other) */
function validateValue(node, key, wildcardVars, value, errors, where, parentVal) {
  if (value === null || value === undefined) return;
  if (node && typeof node['.validate'] === 'string') {
    if (!evalExpr(node['.validate'], wildcardVars, value, parentVal)) errors.push(where + ' (.validate)');
  } else if (node && node['.validate'] === false) {
    errors.push(where + ' (.validate:false)');
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      const child = findChild(node, k);
      if (!child) return;
      validateValue(child.rule, k, Object.assign({}, wildcardVars, child.wild ? { [child.wild]: k } : {}), value[k], errors, where + '/' + k, value);
    });
  }
}
function findChild(node, k) {
  if (!node) return null;
  if (Object.prototype.hasOwnProperty.call(node, k) && !k.startsWith('.')) return { rule: node[k], wild: null };
  const w = Object.keys(node).find((x) => x.startsWith('$'));
  return w ? { rule: node[w], wild: w } : null;
}
/* set: nodeKey/…/id 자리에 value 를 «통째로» 쓴다 · patch: 그 자리에 «일부 칸» 만 갱신한다(existing 과 합쳐 위 자리를 본다) */
function writeErrors(segs, value, opts) {
  const o = opts || {};
  const errors = [];
  let node = RULES, vars = {};
  const trail = [];
  for (const s of segs) {            // 쓰는 자리까지 내려가며 «위 자리» 의 .validate 는 합친 값으로 본다
    const c = findChild(node, s);
    if (!c) return errors;           // 이 아래는 규칙이 없다
    vars = Object.assign({}, vars, c.wild ? { [c.wild]: s } : {});
    node = c.rule; trail.push({ node, vars: Object.assign({}, vars) });
  }
  const target = o.patch ? Object.assign({}, o.existing || {}, value) : value;
  // 위쪽 자리(쓰는 자리 포함)는 합친 값으로
  trail.forEach((t, i) => {
    const isTarget = i === trail.length - 1;
    if (typeof t.node['.validate'] === 'string' && isTarget) {
      if (!evalExpr(t.node['.validate'], t.vars, target)) errors.push(segs.join('/') + ' (.validate)');
    } else if (typeof t.node['.validate'] === 'string') {
      /* 위 자리(예: $uid) 는 값이 객체 한 겹 위라 «쓴 값이 있는 자리» 로 평가 */
      if (!evalExpr(t.node['.validate'], t.vars, { x: 1 })) errors.push(segs.slice(0, i + 1).join('/') + ' (.validate)');
    }
  });
  if (o.patch) {
    Object.keys(value).forEach((k) => {
      const c = findChild(node, k);
      if (!c) return;
      validateValue(c.rule, k, Object.assign({}, vars, c.wild ? { [c.wild]: k } : {}), value[k], errors, segs.join('/') + '/' + k, value);
    });
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      const c = findChild(node, k);
      if (!c) return;
      validateValue(c.rule, k, Object.assign({}, vars, c.wild ? { [c.wild]: k } : {}), value[k], errors, segs.join('/') + '/' + k, value);
    });
  }
  return errors;
}
const ok = (segs, v, o) => writeErrors(segs, v, o).length === 0;

/* ── 화면(enter.html)이 실제로 쓰는 모양 ── */
const NOW = 1700000000000;
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
const rec = (o) => Object.assign({ cat: 'erp', title: '제목', content: '내용', images: [IMG, IMG, IMG], author: '홍', authorEmail: 'a@pureun.kr', authorUid: 'U_STAFF', status: 'new', reply: '', createdAt: NOW }, o || {});
const meta = (o) => Object.assign({ author: '홍', authorEmail: 'a@pureun.kr', authorUid: 'U_STAFF', status: 'new', cat: 'erp', title: '제목', createdAt: NOW }, o || {});
const own = (o) => Object.assign({ title: '제목', cat: 'erp', status: 'new', at: NOW, seen: true }, o || {});
const P = ['suggestions_private'], M = ['suggestions_meta_private'], R = (uid) => ['suggestions_resolved_private', uid];
const ID = '-NabcDEF1234567890xy';

test('★ ④ 화면이 실제로 쓰는 정상 쓰기는 하나도 막히지 않는다', () => {
  const cases = [
    ['새 건의', [...P, ID], rec()],
    ['새 건의 메타', [...M, ID], meta()],
    ['내 진행함 접수 기록', [...R('U_STAFF'), ID], own()],
    ['재요청(relatedId)', [...P, ID], rec({ title: '↩ 재요청: 제목', relatedId: '-NfirstID000000001' })],
    ['길잡이 채팅 접수(source·그림 없음)', [...P, ID], (() => { const r = rec({ source: 'chatbot' }); delete r.images; return r; })()],
    ['길잡이 채팅 내 진행함(source·relatedId)', [...R('U_STAFF'), ID], own({ source: 'chatbot', relatedId: '-NfirstID000000001' })],
    ['관리자가 직접 남긴 건의', [...P, ID], rec({ authorUid: 'U_STAFF' })]
  ];
  cases.forEach(([label, segs, v]) => assert.deepEqual(writeErrors(segs, v), [], '★ 정상 쓰기가 막힙니다 — ' + label));
});

test('★ ④ 부분 갱신(관리자 답변·건의자 확인)도 막히지 않는다 — 서버 칸이 붙은 옛 자료 위에서도', () => {
  const existingPrivate = Object.assign(rec(), { assist: { draft: 'x' }, watchNotice: { a: { kind: 'pr' } } });   // 서버가 쓴 칸이 있는 옛 건의
  assert.deepEqual(writeErrors([...P, ID], { status: 'done', reply: '고쳤습니다', replyImages: [IMG], repliedAt: NOW }, { patch: true, existing: existingPrivate }), [],
    '★ 서버 칸(assist·watchNotice)이 붙은 건의에 관리자 답변이 막힙니다');
  assert.deepEqual(writeErrors([...M, ID], { status: 'done' }, { patch: true, existing: meta() }), []);
  assert.deepEqual(writeErrors([...R('U_STAFF'), ID], { title: '제목', reply: '답', replyImages: [IMG], cat: 'erp', status: 'done', at: NOW, seen: false }, { patch: true, existing: own() }), []);
  assert.deepEqual(writeErrors([...R('U_STAFF'), ID], { seen: true, resolvedOk: true, resolvedAt: NOW }, { patch: true, existing: { title: '옛', cat: 'erp', at: NOW, seen: false, reply: '답' } }), [],
    '★ status 칸이 없는 옛 진행함에 건의자 확인이 막힙니다');
  assert.deepEqual(writeErrors([...R('U_STAFF'), ID], { seen: true, resolvedOk: false, feedback: '안 됩니다', feedbackAt: NOW }, { patch: true, existing: own() }), []);
});

test('★★ ① 번호(키)는 푸시 번호 모양만 — 셸 글자가 든 번호는 막힌다(건의·메타·진행함 모두)', () => {
  const bad = ['x&calc&', 'a|b', 'a^b', '%PATH%', 'a b', 'a;b', 'a"b', "a'b", 'a`b', 'a(b)', 'a'.repeat(65)];
  bad.forEach((k) => {
    assert.equal(ok([...P, k], rec()), false, '★ 건의 번호 «' + k + '» 가 통과합니다');
    assert.equal(ok([...M, k], meta()), false, '★ 메타 번호 «' + k + '» 가 통과합니다');
    assert.equal(ok([...R('U_STAFF'), k], own()), false, '★ 진행함 번호 «' + k + '» 가 통과합니다');
  });
  assert.equal(ok([...P, 'a'.repeat(64)], rec()), true, '64자는 통과해야 한다(경계)');
  assert.equal(ok(['suggestions_resolved_private', 'a&b', ID], own()), false, '★ 진행함 uid 칸에 셸 글자가 통과합니다(관리자가 써도 막아야 한다)');
});

test('★ ① 번호 모양이 화면·규칙에서 «같은 모양» 이다 — 어긋나면 화면은 되는데 규칙이 막거나 그 반대가 된다', () => {
  const ui = enter.match(/function _chatImpValidId\(id\)\{[^\n]*?test\(id\)/);
  assert.ok(ui, '화면의 번호 검사(_chatImpValidId)를 찾지 못했다');
  const uiRe = (ui[0].match(/\/(\^\[A-Za-z0-9_-\]\{1,64\}\$)\//) || [])[1];
  assert.ok(uiRe, '화면의 번호 모양을 읽지 못했다');
  const gen = generator.match(/const SG_KEY_RE = '\/(\^\[A-Za-z0-9_-\]\{1,64\}\$)\/';/);
  assert.ok(gen, '규칙 생성기의 번호 모양(SG_KEY_RE)을 찾지 못했다');
  assert.equal(gen[1], uiRe, '★ 규칙의 번호 모양과 화면의 번호 모양이 다릅니다');
});

test('★ ② 모르는 칸은 거절 — 서버가 쓰는 칸(assist·watchNotice)은 직원이 못 쓴다', () => {
  assert.equal(ok([...P, ID], rec({ zzz: 'x'.repeat(5000) })), false, '★ 건의 원문에 모르는 칸이 통과합니다');
  assert.equal(ok([...P, ID], rec({ assist: { draft: 'x' } })), false, '★ 새 건의에 assist 를 담을 수 있습니다');
  assert.equal(ok([...P, ID], rec({ watchNotice: { a: { kind: 'pr', text: 'x' } } })), false, '★ 새 건의에 watchNotice 를 담을 수 있습니다');
  assert.equal(ok([...M, ID], meta({ blob: 'x' })), false, '★ 메타에 모르는 칸이 통과합니다');
  assert.equal(ok([...R('U_STAFF'), ID], own({ blob: 'x' })), false, '★ 진행함에 모르는 칸이 통과합니다');
  ['suggestions_private', 'suggestions_meta_private'].forEach((n) => {
    assert.equal(RULES[n].$id.$other['.validate'], false, n + ' 에 $other:false 가 없다');
    assert.ok(!('assist' in RULES[n].$id) && !('watchNotice' in RULES[n].$id), n + ' 의 규칙에 서버 전용 칸이 적혀 있다');
  });
  assert.equal(RULES.suggestions_resolved_private.$uid.$id.$other['.validate'], false);
});

test('③ 칸의 종류·길이·모양 — 한 군데만 나쁘면 막힌다', () => {
  const bad = (segs, good, mutate) => {
    assert.equal(ok(segs, good), true, '짝(정상)이 막힙니다');
    assert.equal(ok(segs, Object.assign(structuredClone(good), mutate)), false, '나쁜 값이 통과합니다: ' + JSON.stringify(mutate).slice(0, 60));
  };
  bad([...P, ID], rec({ relatedId: '-Nfirst000000001' }), { relatedId: 'a&b' });
  bad([...R('U_STAFF'), ID], own({ relatedId: '-Nfirst000000001' }), { relatedId: 'a&b' });
  bad([...P, ID], rec({ source: 'chatbot' }), { source: 'Chat!bot' });
  bad([...P, ID], rec({ images: ['x'.repeat(900000)] }), { images: ['x'.repeat(1000001)] });
  bad([...P, ID], rec(), { images: [IMG, IMG, IMG, IMG] });
  bad([...P, ID], rec({ reply: 'x'.repeat(20000) }), { reply: 'x'.repeat(20001) });
  bad([...P, ID], rec({ author: 'x'.repeat(100) }), { author: 'x'.repeat(101) });
  bad([...P, ID], rec(), { createdAt: '지금' });
  bad([...M, ID], meta({ title: 'x'.repeat(200) }), { title: 'x'.repeat(201) });
  bad([...R('U_STAFF'), ID], own({ resolvedOk: true }), { resolvedOk: 'true' });
  bad([...R('U_STAFF'), ID], own(), { seen: 'yes' });
  bad([...R('U_STAFF'), ID], own({ resolvedAt: NOW }), { resolvedAt: '어제' });
  bad([...R('U_STAFF'), ID], own({ feedback: 'x'.repeat(2000) }), { feedback: 'x'.repeat(2001) });
  bad([...R('U_STAFF'), ID], own({ reply: 'x'.repeat(20000) }), { reply: 'x'.repeat(20001) });
  bad([...R('U_STAFF'), ID], own({ status: 'ing' }), { status: 'whatever' });
  bad([...R('U_STAFF'), ID], own({ title: 'x'.repeat(200) }), { title: 'x'.repeat(201) });
});

test('③ 그림 한도는 «줄여 담은 그림이 실제로 들어가는 크기» 다 — 한도가 그림 줄이기보다 작아지면 건의가 막힌다', () => {
  /* 화면은 가로 1400px·JPEG 품질 0.7 로 줄여 담는다(sgCompress). 운영 실측 한 장 최대 약 33만 자 — 한도는 그 몇 배여야 한다. */
  assert.match(enter, /maxW = 1400/, '그림 줄이기 기준(가로 1400px)이 바뀌었다 — 규칙의 그림 한도를 다시 본다');
  assert.match(enter, /toDataURL\('image\/jpeg', 0\.7\)/, '그림 품질이 바뀌었다 — 규칙의 그림 한도를 다시 본다');
  const lim = Number((generator.match(/const SG_IMGS = [^\n]*?newData\.val\(\)\.length <= (\d+)[`"]/) || [])[1]);
  assert.ok(lim >= 600000, '그림 한 장 한도가 너무 작다(정상 그림이 막힌다): ' + lim);
  assert.ok(lim <= 3000000, '그림 한 장 한도가 너무 크다(큰 글을 숨길 수 있다): ' + lim);
});

test('이미 있는 자료는 건드리지 않는다 — 지우기는 번호가 이상해도 된다(.validate 는 새로 쓰는 값만 본다)', () => {
  /* 규칙 문장에 «삭제는 통과» 가 들어 있다: !newData.exists() || … */
  ['suggestions_private', 'suggestions_meta_private'].forEach((n) => assert.match(RULES[n].$id['.validate'], /^!newData\.exists\(\) \|\|/, n + ': 지우기 통과 문장이 없다'));
  assert.match(RULES.suggestions_resolved_private.$uid.$id['.validate'], /^!newData\.exists\(\) \|\|/);
  assert.match(RULES.suggestions_resolved_private.$uid['.validate'], /^!newData\.exists\(\) \|\|/);
});

test('규칙 «읽기·쓰기 권한» 은 그대로다 — 이 변경은 .validate 만 더한다', () => {
  assert.match(RULES.suggestions_private['.read'], /isAdmin/);
  assert.match(RULES.suggestions_private.$id['.write'], /authorUid/);
  assert.match(RULES.suggestions_resolved_private.$uid['.read'], /auth\.uid === \$uid/);
  assert.match(RULES.suggestions_resolved_private.$uid['.write'], /auth\.uid === \$uid/);
});

test('에뮬레이터 검사가 곁에 있다 — 규칙의 «뜻» 은 진짜 엔진으로 확인한다', () => {
  const emu = fs.readFileSync(path.join(root, 'tests', 'suggestion-rules.emulator.mjs'), 'utf8');
  assert.match(emu, /pureun-erp-default-rtdb/, '네임스페이스가 틀리면 규칙 없는 DB 에 가짜 성공이 난다');
  assert.match(emu, /나쁜 것/, '«막히는 경우» 는 «통과하는 짝» 과 함께 본다');
  assert.doesNotMatch(path.basename('suggestion-rules.emulator.mjs'), /\.test\.js$/, '에뮬레이터 검사는 .test.js 로 두면 평소 전체 검사가 에뮬레이터 없이 죽는다');
});

test('★★ 「객체가 아닌 값」 — 통짜 글자·숫자는 자식 규칙을 «평가하지 않으므로» 컨테이너 자리가 객체일 때만 받는다 (외부 검토 2026-11-12)', () => {
  const BIG = 'X'.repeat(2000000);
  /* 짝(정상)이 먼저 통과해야 «다른 이유로 막힌 것» 이 아니다 */
  assert.equal(ok([...P, ID], rec({ images: [IMG], replyImages: [IMG] })), true, '짝(정상)이 막힙니다');
  assert.equal(ok([...P, ID], rec({ images: BIG })), false, '★ images 에 200만 자 «글자» 가 통과합니다');
  assert.equal(ok([...P, ID], rec({ replyImages: BIG })), false, '★ replyImages 에 200만 자 «글자» 가 통과합니다');
  assert.equal(ok([...P, ID], rec({ images: 12345 })), false, '★ images 에 숫자가 통과합니다');
  assert.equal(ok([...R('U_STAFF'), ID], BIG), false, '★ 진행함 한 건 자리에 통짜 글자가 통과합니다');
  assert.equal(ok([...R('U_STAFF'), ID], true), false, '진행함 한 건 자리에 참/거짓이 통과합니다');
  assert.equal(ok(['suggestions_resolved_private', 'U_STAFF'], BIG), false, '★ 진행함 «칸 전체» 에 통짜 글자가 통과합니다');
  assert.equal(ok(['suggestions_resolved_private', 'U_STAFF'], { [ID]: own() }), true, '진행함 칸 전체에 정상 객체(짝)가 막힙니다');
  assert.equal(ok([...P, ID], BIG), false, '건의 한 건 자리에 통짜 글자가 통과합니다');
  assert.equal(ok([...M, ID], BIG), false, '메타 한 건 자리에 통짜 글자가 통과합니다');
  ['suggestions_private', 'suggestions_resolved_private'].forEach((n) => {
    const node = n === 'suggestions_private' ? RULES[n].$id.images : RULES[n].$uid;
    assert.match(String(node['.validate']), /hasChildren\(\)/, n + ' 의 컨테이너 자리에 객체 검사(hasChildren())가 없다');
  });
});

test('★ 그림은 0번부터 «빈틈 없이» 이어진다 — 빈틈이 있으면 배열이 아닌 객체로 돌아와 대표 화면의 images.map 이 죽는다', () => {
  assert.equal(ok([...P, ID], rec({ images: [IMG] })), true);
  assert.equal(ok([...P, ID], rec({ images: [IMG, IMG, IMG] })), true);
  assert.equal(ok([...P, ID], rec({ images: { 2: IMG } })), false, '★ 0번 없이 2번만 있는 그림이 통과합니다');
  assert.equal(ok([...P, ID], rec({ images: { 1: IMG } })), false, '0번 없이 1번만 있는 그림이 통과합니다');
  assert.equal(ok([...P, ID], rec({ images: { 0: IMG, 2: IMG } })), false, '1번이 빠진 그림이 통과합니다');
  assert.equal(ok([...R('U_STAFF'), ID], own({ replyImages: { 1: IMG } })), false, '진행함 답변 그림의 빈틈이 통과합니다');
  assert.equal(ok([...R('U_STAFF'), ID], own({ replyImages: [IMG, IMG] })), true);
});
