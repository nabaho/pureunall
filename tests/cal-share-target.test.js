/* 푸른 캘린더 › 폰 «공유» 버튼으로 글 보내기 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   대표 요청 2026-10-31 「문자·메일에서 오는 업무 회의 등을 자동으로 입력하고 싶다」→ 조사 → 「진행」.
   문자·카톡은 폰 앱을 고치지 않고 «공유 버튼»으로 푸른 캘린더에 글을 보내 «말로 채우기» 길로 읽는다.

   ★ 이 검사가 지키는 것
     ① 매니페스트의 share_target 은 GET(글만) — 서비스 워커가 없는 이 앱에서 되는 길이고, 이 화면을 연다
     ② 공유된 글(title·text·url)이 «말로 채우기» 창에 채워져 열리고 곧바로 읽는다 — 저장은 안 한다
     ③ 읽기 시작하면서 주소의 글을 지운다(새로고침이 같은 글을 또 AI 에 보내지 않게)
     ④ 공유와 상관없는 주소(출장 알림 등)는 건드리지 않는다
     ⑤ 공유 글 프롬프트는 «언제 받은 글인지 모른다»를 알리고 오늘 기준 계산을 check 로 남기게 한다 — 말 프롬프트는 그대로
     ⑥ 부팅·로그인이 끝난 뒤에 부른다(AI 호출에 로그인이 필요하다) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 매니페스트 = JSON.parse(fs.readFileSync(path.join(ROOT, 'pu-cal-manifest.json'), 'utf8'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const CAP = require(path.join(ROOT, 'js', 'pu-cal-capture.js'));

/* ① 매니페스트 */
test('① share_target 은 GET 이고 title·text·url 을 받는다 — 파일(files)·POST 는 서비스 워커가 있어야 해서 쓰지 않는다', () => {
  const st = 매니페스트.share_target;
  assert.ok(st, 'share_target 이 없다');
  assert.strictEqual(st.method, 'GET');
  assert.deepStrictEqual(Object.keys(st.params).sort(), ['text', 'title', 'url']);
  assert.ok(!st.files && !st.enctype, '이미지 공유(POST)는 서비스 워커가 필요하다 — 이 앱엔 없다');
});

test('① 공유가 여는 주소는 이 앱의 시작 화면과 같은 파일이고, 앱 범위(scope) 안이며, 실제로 있는 파일이다', () => {
  const 대상 = path.posix.normalize(매니페스트.share_target.action);
  const 시작 = path.posix.normalize(매니페스트.start_url);
  assert.strictEqual(대상, 시작);
  assert.ok(fs.existsSync(path.join(ROOT, 대상)), '열 파일이 없다');
  assert.ok(대상.startsWith('pu-cal') && 매니페스트.scope === './', '앱 범위 밖이면 공유 대상으로 안 뜬다');
});

test('① 기존 매니페스트 칸이 그대로다 — 이름·아이콘·시작 화면', () => {
  assert.strictEqual(매니페스트.short_name, '푸른캘린더');
  assert.ok(Array.isArray(매니페스트.icons) && 매니페스트.icons.length >= 2);
  assert.strictEqual(매니페스트.display, 'standalone');
});

/* ⑤ 프롬프트 */
test('⑤ 공유 글 프롬프트 — 받은 날을 모른다고 알리고, 오늘 기준으로 계산했으면 check 에 남기게 한다', () => {
  const p = CAP.promptForText('2026-10-31', '내일 3시 서산 미팅', 'share');
  assert.ok(/공유한 글/.test(p) && p.includes('내일 3시 서산 미팅'));
  assert.ok(/언제 받은 글인지 알 수 없습니다/.test(p));
  assert.ok(/check 에/.test(p) && /오늘 기준으로 계산/.test(p));
  assert.ok(p.includes('2026-10-31'), '오늘 날짜가 들어가야 계산이 된다');
});

test('⑤ 말 프롬프트는 그대로다(받아쓰기 오류 안내) — 공유 문구가 섞이지 않는다', () => {
  const p = CAP.promptForText('2026-10-31', '다음 주 화요일 3시');
  assert.ok(/받아쓰기 오류/.test(p) && /말한 내용/.test(p));
  assert.ok(!/공유한 글|언제 받은 글인지/.test(p));
});

test('⑤ readText 는 deps.kind 를 프롬프트에 싣는다 — share 일 때만', async () => {
  const 보낸 = [];
  const ai = { ask: (parts) => { 보낸.push(parts[0].text); return Promise.resolve({ candidates: [{ content: { parts: [{ text: '{"events":[]}' }] } }] }); }, textOf: (r) => r.candidates[0].content.parts[0].text };
  await CAP.readText('내일 3시 미팅', { ai, auth: {}, today: '2026-10-31', kind: 'share' });
  await CAP.readText('내일 3시 미팅', { ai, auth: {}, today: '2026-10-31' });
  assert.ok(/공유한 글/.test(보낸[0]));
  assert.ok(!/공유한 글/.test(보낸[1]));
});

/* ②③④ 공유받기 */
function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
const 기다림 = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));

function 상자(search, 옵션) {
  옵션 = 옵션 || {};
  const 기록 = { render: 0, toast: [], doSave: 0, replace: [], openNew: [], ai: [] };
  const 요소 = {};
  const b = {
    console, String, Object, Array, JSON, Math, Date, Number, RegExp, Promise, Error, URLSearchParams,
    S: { modal: null, cap: null },
    location: { search, pathname: '/pureunall/pu-cal.html', hash: '#x' },
    history: { replaceState(...a) { if (옵션.교체실패) throw new Error('x'); 기록.replace.push(a); } },
    PuCalCapture: 옵션.모듈 === null ? undefined : CAP,
    PuAiCall: { ask: (parts, o) => { 기록.ai.push({ parts, o }); return Promise.resolve({ candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [{ title: '1500 가나상사 방문', date: '2026-11-02', time: '15:00', place: '서산', contact: '임꺽정 · 010-0000-0000', check: ['받은 날을 몰라 오늘 기준으로 계산함 — 날짜 확인'] }] }) }] } }] }); }, textOf: (r) => r.candidates[0].content.parts[0].text },
    firebase: { auth: () => ({ currentUser: {} }) },
    todayYMD: () => '2026-10-31',
    document: { getElementById: (id) => (id === 'capText' ? { value: b.S.cap ? b.S.cap.text : '' } : 요소[id] || null) },
    render() { 기록.render++; }, toast(t) { 기록.toast.push(t); }, confirm: () => false,
    openNew(ymd) { 기록.openNew.push(ymd); b.S.modal = { mode: 'new', kind: 'sch', date: ymd, endDate: '', title: '', note: '', timed: true, time: '10:00', endTime: '', place: '', contact: '' }; b.render(); },
    doSave() { 기록.doSave++; },
  };
  vm.createContext(b);
  vm.runInContext('var 캡처듣기 = null;', b);
  ['function 캡처깔끔(){', 'function 캡처듣기끝(){', 'function 캡처정리(){', 'function 캡처묶음(manual){', 'function 캡처읽기(last, manual){',
    'function 캡처결과(r){', 'function 캡처채우기(d){', 'function 캡처글읽기(){', 'function 공유받기(){'].forEach((h) => vm.runInContext(함수몸(h), b));
  return { b, 기록, 실행: (코드) => vm.runInContext(코드, b) };
}

test('② 공유된 글이 새 일정 창 + «말로 채우기» 창에 채워져 열리고 곧바로 읽는다 — 칸이 채워져도 저장은 안 한다', async () => {
  const t = 상자('?text=' + encodeURIComponent('11/2 오후 3시 가나상사 방문 서산 임꺽정 010-0000-0000'));
  assert.strictEqual(t.실행('공유받기()'), true);
  assert.deepStrictEqual(t.기록.openNew, ['2026-10-31']);
  assert.strictEqual(t.b.S.cap.mode, 'voice');
  assert.strictEqual(t.b.S.cap.src, 'share');
  assert.strictEqual(t.b.S.cap.busy, true, '읽는 중이어야 한다');
  await 기다림();
  assert.strictEqual(t.기록.ai.length, 1);
  assert.ok(/공유한 글/.test(t.기록.ai[0].parts[0].text), '공유 글 프롬프트로 불러야 한다');
  assert.ok(t.기록.ai[0].parts[0].text.includes('가나상사 방문'));
  assert.strictEqual(t.b.S.modal.title, '1500 가나상사 방문');
  assert.strictEqual(t.b.S.modal.date, '2026-11-02');
  assert.strictEqual(t.b.S.modal.time, '15:00');
  assert.ok(t.b.S.modal.capWarn.some((w) => /오늘 기준으로 계산/.test(w)), '오늘 기준으로 계산했다는 경고가 «확인하세요»로 떠야 한다');
  assert.strictEqual(t.기록.doSave, 0, '공유만으로 저장하면 안 된다 — 사람이 «저장»을 눌러야 한다');
  assert.strictEqual(t.b.S.cap, null, '채운 뒤 입력 칸은 닫힌다');
});

test('③ 읽기 시작하면서 주소의 글을 지운다 — 새로고침·뒤로 가기가 같은 글을 또 보내지 않는다', () => {
  const t = 상자('?title=T&text=' + encodeURIComponent('회의 11/2 3시'));
  t.실행('공유받기()');
  assert.strictEqual(t.기록.replace.length, 1);
  assert.strictEqual(t.기록.replace[0][2], '/pureunall/pu-cal.html#x', '쿼리는 빠지고 주소·해시만 남는다');
});

test('② title·text·url 을 줄로 합치고 같은 글은 한 번만 — 길면 한도(2000자)로 자른다', () => {
  const t = 상자('?title=' + encodeURIComponent('회의 안내') + '&text=' + encodeURIComponent('회의 안내') + '&url=' + encodeURIComponent('https://example.com/a'));
  t.실행('공유받기()');
  assert.strictEqual(t.b.S.cap.text, '회의 안내\nhttps://example.com/a');
  const 긴 = 상자('?text=' + encodeURIComponent('가'.repeat(5000)));
  긴.실행('공유받기()');
  assert.ok(긴.b.S.cap.text.length <= CAP.LIMIT.text);
});

test('④ 공유와 상관없는 주소(출장 알림·빈 주소·공백뿐)는 아무것도 안 한다 — 주소도 안 지운다', () => {
  for (const q of ['', '?trip=1&d=2026-10-10', '?text=', '?text=%20%20&title=', '?foo=bar']) {
    const t = 상자(q);
    assert.strictEqual(t.실행('공유받기()'), false, q);
    assert.strictEqual(t.기록.openNew.length, 0, q);
    assert.strictEqual(t.기록.replace.length, 0, q + ' — 남의 주소 변수를 지우면 안 된다');
    assert.strictEqual(t.기록.ai.length, 0, q);
  }
});

test('② 주소 지우기가 실패해도 계속한다 · 모듈이 없으면 AI 를 안 부르고 false', async () => {
  const a = 상자('?text=' + encodeURIComponent('11/2 3시 방문'), { 교체실패: true });
  assert.strictEqual(a.실행('공유받기()'), true);
  await 기다림();
  assert.strictEqual(a.기록.ai.length, 1);
  const b = 상자('?text=' + encodeURIComponent('11/2 3시 방문'), { 모듈: null });
  assert.strictEqual(b.실행('공유받기()'), false);
  assert.strictEqual(b.기록.ai.length, 0);
});

test('② 캡처묶음 은 공유 창일 때만 kind:"share" 를 싣는다', () => {
  const t = 상자('');
  assert.strictEqual(t.실행('캡처묶음().kind'), '');
  t.b.S.cap = { src: 'share' };
  assert.strictEqual(t.실행('캡처묶음().kind'), 'share');
  t.b.S.cap = { mode: 'voice' };
  assert.strictEqual(t.실행('캡처묶음().kind'), '');
});

/* ⑥ 부팅 */
test('⑥ 공유받기는 부팅·로그인이 끝난 뒤(내 정보·후보 받기 뒤)에 부르고, 캡처 구역 안에 있다', () => {
  const 부름 = 캘린더.indexOf('    공유받기();');
  const 로그인 = 캘린더.indexOf('    S.uid = user.uid;');
  const 후보 = 캘린더.indexOf('    후보바인드(); 후보받기();');
  assert.ok(부름 > 0 && 로그인 > 0 && 부름 > 로그인 && 부름 > 후보, '로그인 전에 부르면 AI 호출이 거절된다');
  const 구역 = 캘린더.slice(캘린더.indexOf('캡처·말로 채우기 시작'), 캘린더.indexOf('캡처·말로 채우기 끝'));
  assert.ok(구역.includes('function 공유받기(){'), '캡처 구역(저장 길을 안 부르는 구역) 안에 있어야 한다');
});

test('③ 캐시 번호: 공용 규칙 파일을 고쳤으니 이 화면의 번호가 올랐다(붙어 있다)', () => {
  assert.ok(/<script src="js\/pu-cal-capture\.js\?v=\d+"><\/script>/.test(캘린더));
});
