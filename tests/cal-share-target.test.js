/* 푸른 캘린더 › 폰 «공유» 버튼으로 글·캡처 보내기 (2026-10-31 글 · 2026-11-15 캡처)
   ═══════════════════════════════════════════════════════════════════════════
   대표 요청 2026-10-31 「문자·메일에서 오는 업무 회의 등을 자동으로 입력하고 싶다」→ 조사 → 「진행」.
   대표 지시 2026-11-15 「사업장 방문 등이 문자·카톡·메일로 오면 구글캘린더에 넣고 싶다」→ 「공유 버튼 만들기」(캡처까지).
   문자·카톡은 폰 앱을 고치지 않고 «공유 버튼»으로 푸른 캘린더에 글·캡처를 보내 «말로 채우기»·«캡처로 채우기» 길로 읽는다.

   ★ 이 검사가 지키는 것
     ① 매니페스트의 share_target 은 POST(사진 + 글) — 받을 주소는 앱 범위 안이고, 화면이 «좁은 scope» 로 등록한 일꾼이 받는다
       (scope 를 안 좁히면 /pureunall/ 을 차지하는 다른 앱의 일꾼이 밀어내 공유가 죽는다)
     ② 공유된 글(title·text·url)이 «말로 채우기» 창에 올라오고, 사람이 «읽어서 채우기»를 눌러야 읽는다 — 저장은 안 한다(옛 GET 설치분)
     ★ 공유는 AI 를 «저절로» 부르지 않는다(2026-11-15 보안 검토) — 일꾼은 폰 공유와 남의 웹페이지가 몰래 보낸 전송을 못 가린다
     ③ 읽기 시작하면서 주소의 글·표를 지운다(새로고침이 같은 글을 또 AI 에 보내지 않게)
     ④ 공유와 상관없는 주소(출장 알림 등)는 건드리지 않는다
     ⑤ 공유 글 프롬프트는 «언제 받은 글인지 모른다»를 알리고 오늘 기준 계산을 check 로 남기게 한다 — 말 프롬프트는 그대로
     ⑥ 부팅·로그인이 끝난 뒤에 부른다(AI 호출에 로그인이 필요하다)
     ⑦ 일꾼: 사진만 담고(한도까지) 앞의 대기분을 비운 뒤 화면을 303 으로 연다 · 없으면 none · 실패하면 err · 캐시 안 씀
     ⑧ 화면: 공유함에서 꺼내면서 비우고, 사진이면 «캡처로 채우기» 길, 글이면 공유 글 길로 읽는다 · 오래된 것은 안 읽는다 */
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

/* 화면이 등록하는 일꾼 — 파일 이름과 scope 를 화면에서 읽는다(이름을 박지 않는다) */
const 등록 = (() => {
  const m = /navigator\.serviceWorker\.register\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*scope\s*:\s*['"]([^'"]+)['"]/.exec(캘린더);
  return m ? { 파일: m[1], scope: m[2] } : null;
})();
const 일꾼글 = 등록 && fs.existsSync(path.join(ROOT, 등록.파일)) ? fs.readFileSync(path.join(ROOT, 등록.파일), 'utf8') : '';
const 앱주소 = 'https://x.io/pureunall/';
const 받는주소 = 등록 ? new URL(매니페스트.share_target.action, 앱주소).href : '';
const 파일칸 = (((매니페스트.share_target || {}).params || {}).files || [{}])[0].name;

/* ① 매니페스트 · 등록 */
test('① share_target 은 POST·multipart 이고 title·text·url 과 사진 파일 칸을 받는다', () => {
  const st = 매니페스트.share_target;
  assert.ok(st, 'share_target 이 없다');
  assert.strictEqual(st.method, 'POST', '사진(파일)은 POST 로만 받을 수 있다');
  assert.strictEqual(st.enctype, 'multipart/form-data', '파일을 보내려면 이 값이어야 한다');
  ['title', 'text', 'url'].forEach((k) => assert.ok(st.params[k], k + ' 칸이 없다 — 글 공유가 죽는다'));
  const f = st.params.files;
  assert.ok(Array.isArray(f) && f.length >= 1 && f[0].name, '파일 칸이 없다');
  assert.ok(f[0].accept.some((a) => /^image\//.test(a)), '사진(image/*)을 받아야 캡처 공유가 된다');
});

test('① 화면이 일꾼을 «좁은 scope» 로 등록하고, 받는 주소가 그 scope 안이며, 앱 범위 안이다', () => {
  assert.ok(등록, '★ pu-cal.html 이 scope 를 준 일꾼 등록을 하지 않는다 — POST 공유를 받을 길이 없다');
  assert.ok(일꾼글, '등록한 일꾼 파일이 없다(배포하면 404): ' + (등록 && 등록.파일));
  const scope = new URL(등록.scope, 앱주소).href;
  assert.notStrictEqual(scope, 앱주소, '★ scope 를 앱 뿌리(/pureunall/)로 두면 pu-sw.js·pu-erp-sw.js 와 자리를 다퉈 밀려난다');
  assert.ok(받는주소.startsWith(scope), '받는 주소(' + 받는주소 + ')가 일꾼 scope(' + scope + ') 밖이다 — 일꾼이 못 받는다');
  assert.ok(받는주소.startsWith(new URL(매니페스트.scope, 앱주소).href), '앱 범위 밖이면 공유 대상으로 안 뜬다');
  assert.ok(new URL(등록.파일, 앱주소).href.startsWith(앱주소), '일꾼 파일이 scope 보다 깊은 곳에 있으면 등록이 거절된다');
});

test('① 등록은 https 에서만 · 화면이 뜬 뒤(load) — 실패해도 화면은 그대로', () => {
  const i = 캘린더.search(/navigator\.serviceWorker\.register\(\s*['"][^'"]+['"]\s*,\s*\{\s*scope/);
  assert.ok(i > 0, '등록 줄을 못 찾았다');
  const 앞 = 캘린더.slice(Math.max(0, i - 400), i);
  assert.ok(/location\.protocol\s*===\s*['"]https:['"]/.test(앞), 'https 확인이 없다');
  assert.ok(/addEventListener\(\s*['"]load['"]/.test(앞), 'load 뒤에 등록해야 첫 화면이 늦어지지 않는다');
  assert.ok(/\[['"]catch['"]\]|\.catch\(/.test(캘린더.slice(i, i + 200)), '등록 실패를 삼켜야 화면이 안 멈춘다');
});

test('① 기존 매니페스트 칸이 그대로다 — 이름·아이콘·시작 화면', () => {
  assert.strictEqual(매니페스트.short_name, '푸른캘린더');
  assert.ok(Array.isArray(매니페스트.icons) && 매니페스트.icons.length >= 2);
  assert.strictEqual(매니페스트.display, 'standalone');
  assert.ok(fs.existsSync(path.join(ROOT, path.posix.normalize(매니페스트.start_url))), '시작 화면 파일이 없다');
});

/* ⑦ 일꾼을 진짜로 켠다 */
function 일꾼켜기(옵션) {
  옵션 = 옵션 || {};
  const handlers = {};
  const 함 = { 열린이름: [], 지움: 0, 담음: [], 순서: [], 닫힘: 0 };
  const ctx = {
    URL, Response, Promise, String, Date, console: { warn() {} },
    caches: { open() { 함.캐시 = true; return Promise.resolve({ put() {} }); }, delete() { 함.캐시 = true; return Promise.resolve(true); } },
    indexedDB: {
      open(name, ver) {
        함.열린이름.push(name); 함.판 = ver;
        const req = {};
        setImmediate(() => {
          if (옵션.열기실패) { req.error = new Error('막힘'); req.onerror && req.onerror(); return; }
          req.result = {
            objectStoreNames: { contains() { return true; } },
            createObjectStore() {},
            transaction(store) {
              함.store = store;
              const tx = {};
              /* 중단: 용량 부족처럼 onerror 없이 onabort 만 오는 경우 */
              setImmediate(() => { if (옵션.중단) { tx.onabort && tx.onabort(); } else if (tx.oncomplete) tx.oncomplete(); });
              tx.objectStore = () => ({
                clear() { 함.지움++; 함.순서.push('clear'); 함.담음 = []; },
                add(v) { 함.순서.push('add'); 함.담음.push(v); },
              });
              return tx;
            },
            close() { 함.닫힘++; },
          };
          req.onsuccess && req.onsuccess();
        });
        return req;
      },
    },
  };
  ctx.self = {
    addEventListener(n, fn) { handlers[n] = fn; }, skipWaiting() {}, clients: { claim() {} },
    console: ctx.console, location: new URL(등록.파일, 앱주소),
  };
  vm.createContext(ctx);
  vm.runInContext(일꾼글, ctx);
  return { handlers, 함 };
}
function 폼(칸) {
  return { getAll: (k) => (k === 파일칸 ? (칸.files || []) : []), get: (k) => (k in 칸 ? 칸[k] : null) };
}
function 공유요청(url, 칸, 깨짐) {
  return { method: 'POST', mode: 'navigate', url, formData: async () => { if (깨짐) throw new Error('망가진 요청'); return 폼(칸); } };
}
function 사진(name, size, type) { return { name, size, type }; }
async function 보내기(handlers, request) {
  let 답 = null;
  handlers.fetch({ request, respondWith(p) { 답 = p; } });
  return 답 ? await 답 : null;
}
const 캘린더주소 = new URL(매니페스트.start_url, 앱주소).href;

test('⑦ ★ 캡처를 공유하면 담고 캘린더를 ?share=1 로 연다(303) — 앞의 대기분은 먼저 비운다', async () => {
  const w = 일꾼켜기();
  const 답 = await 보내기(w.handlers, 공유요청(받는주소, { files: [사진('카톡캡처.png', 120000, 'image/png')], text: '' }));
  assert.ok(답, '공유 POST 는 반드시 응답해야 한다');
  assert.strictEqual(답.status, 303, '303 이어야 새로고침해도 다시 안 보낸다');
  assert.strictEqual(답.headers.get('location'), 캘린더주소 + '?share=1');
  assert.strictEqual(w.함.담음.length, 1, '한 번의 공유는 한 건으로 담는다');
  assert.strictEqual(w.함.담음[0].files.length, 1);
  assert.ok(w.함.담음[0].files[0].blob, '사진 알맹이를 그대로 담아야 한다');
  assert.ok(typeof w.함.담음[0].at === 'number', '받은 때를 적어야 화면이 오래된 것을 거른다');
  assert.deepStrictEqual(w.함.순서, ['clear', 'add'], '옛 캡처가 새 공유에 섞이지 않게 먼저 비운다');
});

test('⑦ 사진이 아닌 것·0바이트·너무 큰 것은 거르고, 한도(캡처 읽기 한도)까지만 담는다', async () => {
  const w = 일꾼켜기();
  const 많이 = [];
  for (let i = 0; i < CAP.LIMIT.images + 3; i++) 많이.push(사진('c' + i + '.jpg', 1000, 'image/jpeg'));
  await 보내기(w.handlers, 공유요청(받는주소, {
    files: [사진('계약서.pdf', 5000, 'application/pdf'), 사진('빈.jpg', 0, 'image/jpeg'), 사진('큰.jpg', 200 * 1024 * 1024, 'image/jpeg'), null].concat(많이),
  }));
  const 담음 = w.함.담음[0].files;
  assert.ok(담음.length <= CAP.LIMIT.images, '한도보다 많이 담았다: ' + 담음.length);
  assert.ok(담음.every((f) => /^image\//.test(f.type)), '사진이 아닌 것이 섞였다');
  assert.ok(!담음.some((f) => f.name === '큰.jpg' || f.name === '빈.jpg'), '0바이트·너무 큰 사진을 걸러야 한다');
});

test('⑦ 글만 공유해도 담는다(새 설정의 글 공유) — title·text·url 칸 그대로', async () => {
  const w = 일꾼켜기();
  const 답 = await 보내기(w.handlers, 공유요청(받는주소, { title: '방문 안내', text: '11/20 오후 2시 방문', url: '' }));
  assert.strictEqual(답.headers.get('location'), 캘린더주소 + '?share=1');
  assert.strictEqual(w.함.담음[0].text, '11/20 오후 2시 방문');
  assert.strictEqual(w.함.담음[0].title, '방문 안내');
  assert.strictEqual(w.함.담음[0].files.length, 0);
});

test('⑦ 사진도 글도 없으면 담지 않고 ?share=none · 읽다 실패하면 ?share=err — 어느 쪽이든 화면으로 돌려보낸다', async () => {
  const a = 일꾼켜기();
  const 없음 = await 보내기(a.handlers, 공유요청(받는주소, { files: [사진('빈.jpg', 0, 'image/jpeg')], text: '   ' }));
  assert.strictEqual(없음.headers.get('location'), 캘린더주소 + '?share=none', '조용히 넘기면 «공유했는데 아무 일도 없다»가 된다');
  assert.strictEqual(a.함.담음.length, 0);
  const b = 일꾼켜기();
  const 깨짐 = await 보내기(b.handlers, 공유요청(받는주소, {}, true));
  assert.strictEqual(깨짐.headers.get('location'), 캘린더주소 + '?share=err', '실패하고 아무 데도 안 보내면 빈 화면에 갇힌다');
  const c = 일꾼켜기({ 열기실패: true });
  const 함실패 = await 보내기(c.handlers, 공유요청(받는주소, { files: [사진('a.jpg', 10, 'image/jpeg')] }));
  assert.strictEqual(함실패.headers.get('location'), 캘린더주소 + '?share=err');
});

test('⑦ 저장이 «중단(abort)»돼도(용량 부족) 멈추지 않고 ?share=err 로 돌려보낸다', async () => {
  const w = 일꾼켜기({ 중단: true });
  const 답 = await Promise.race([
    보내기(w.handlers, 공유요청(받는주소, { files: [사진('a.jpg', 10, 'image/jpeg')] })),
    new Promise((r) => setTimeout(() => r('멈춤'), 500)),
  ]);
  assert.notStrictEqual(답, '멈춤', '중단을 안 들으면 공유 화면이 멈춘 채 남는다');
  assert.strictEqual(답.headers.get('location'), 캘린더주소 + '?share=err');
});

test('⑦ 공유 주소가 아닌 요청은 손대지 않고, 공유 주소를 그냥 열면(GET) 캘린더로 돌려보낸다 · 캐시는 안 쓴다', async () => {
  const w = 일꾼켜기();
  assert.strictEqual(await 보내기(w.handlers, { method: 'GET', mode: 'navigate', url: 캘린더주소 }), null);
  assert.strictEqual(await 보내기(w.handlers, 공유요청(앱주소 + 'pu-erp.html', {})), null, '다른 앱의 공유를 가로채면 안 된다');
  const 열기 = await 보내기(w.handlers, { method: 'GET', mode: 'navigate', url: 받는주소 });
  assert.ok(열기 && 열기.headers.get('location') === 캘린더주소, '공유 주소를 그냥 열면 깃허브 404 대신 캘린더로');
  assert.ok(!w.함.캐시, '캐시를 두면 pu-version.js 의 새 버전 자동 적용과 싸운다');
  assert.ok(!/\bcaches\b/.test(일꾼글.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), '일꾼 코드가 캐시를 쓴다');
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

/* ②③④⑧ 공유받기 */
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
function 줄(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  return 캘린더.slice(i, 캘린더.indexOf('\n', i));
}
const 기다림 = async (n) => { for (let i = 0; i < (n || 2); i++) await new Promise((r) => setImmediate(r)); };

/* 화면 쪽 가짜 공유함 — 일꾼이 담아 둔 것을 흉내 낸다 */
function 가짜공유함(기록들) {
  const 상태 = { 이름: [], 비움: 0, 닫힘: 0, 남은: (기록들 || []).slice() };
  const idb = {
    open(name, ver) {
      상태.이름.push(name); 상태.판 = ver;
      const req = {};
      setImmediate(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          transaction(store, mode) {
            상태.store = store; 상태.mode = mode;
            const tx = {};
            tx.objectStore = () => ({
              getAll() {
                const g = {};
                setImmediate(() => { g.result = 상태.남은.slice(); g.onsuccess && g.onsuccess(); setImmediate(() => tx.oncomplete && tx.oncomplete()); });
                return g;
              },
              clear() { 상태.비움++; 상태.남은 = []; },
            });
            return tx;
          },
          close() { 상태.닫힘++; },
        };
        req.onsuccess && req.onsuccess();
      });
      return req;
    },
  };
  return { idb, 상태 };
}

function 상자(search, 옵션) {
  옵션 = 옵션 || {};
  const 기록 = { render: 0, toast: [], doSave: 0, replace: [], openNew: [], ai: [], 사진읽기: [], 닫기: 0 };
  const 요소 = {};
  const b = {
    console, String, Object, Array, JSON, Math, Date, Number, RegExp, Promise, Error, URLSearchParams,
    S: { modal: 옵션.창 || null, cap: null },
    location: { search, pathname: '/pureunall/pu-cal.html', hash: '#x' },
    history: { replaceState(...a) { if (옵션.교체실패) throw new Error('x'); 기록.replace.push(a); } },
    PuCalCapture: 옵션.모듈 === null ? undefined : CAP,
    PuAiCall: { ask: (parts, o) => { 기록.ai.push({ parts, o }); return Promise.resolve({ candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [{ title: '1500 가나상사 방문', date: '2026-11-02', time: '15:00', place: '서산', contact: '임꺽정 · 010-0000-0000', check: ['받은 날을 몰라 오늘 기준으로 계산함 — 날짜 확인'] }] }) }] } }] }); }, textOf: (r) => r.candidates[0].content.parts[0].text },
    firebase: { auth: () => ({ currentUser: {} }) },
    todayYMD: () => '2026-10-31',
    document: { getElementById: (id) => (id === 'capText' ? { value: b.S.cap ? b.S.cap.text : '' } : 요소[id] || null) },
    render() { 기록.render++; }, toast(t) { 기록.toast.push(t); }, confirm: () => false,
    openNew(ymd) { 기록.openNew.push(ymd); b.S.modal = { mode: 'new', kind: 'sch', date: ymd, endDate: '', title: '', note: '', timed: true, time: '10:00', endTime: '', place: '', contact: '' }; b.render(); },
    closeModal() { 기록.닫기++; b.S.modal = null; b.S.cap = null; },
    캡처사진읽기(파일들) { 기록.사진읽기.push(파일들); },
    doSave() { 기록.doSave++; },
    modalRead() {},
    esc: (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
  };
  if (옵션.함) b.indexedDB = 옵션.함.idb;
  vm.createContext(b);
  vm.runInContext('var 캡처듣기 = null;', b);
  vm.runInContext(줄('var 공유함 = '), b);
  ['function 캡처깔끔(){', 'function 캡처듣기끝(){', 'function 캡처정리(){', 'function 캡처묶음(manual){', 'function 캡처읽기(last, manual){',
    'function 캡처결과(r){', 'function 캡처채우기(d){', 'function 캡처글읽기(){', 'function 캡처누름(t){', 'function 캡처창Html(){',
    'function 공유글합치기(목록){', 'function 공유받기(){', 'function 공유창열기(){', 'function 공유글올리기(글){', 'function 공유사진올리기(사진){',
    'function 공유함꺼내기(){', 'function 공유함받기(){'].forEach((h) => vm.runInContext(함수몸(h), b));
  return { b, 기록, 실행: (코드) => vm.runInContext(코드, b), 누름: (뜻) => b.캡처누름({ getAttribute: (k) => (k === 'data-cap' ? 뜻 : null) }) };
}

test('② 공유된 글(옛 GET 설치분)이 펼친 새 일정 창 + «말로 채우기» 칸에 올라오고, «읽어서 채우기»를 눌러야 읽는다 — 저장은 안 한다', async () => {
  const t = 상자('?text=' + encodeURIComponent('11/2 오후 3시 가나상사 방문 서산 임꺽정 010-0000-0000'));
  assert.strictEqual(t.실행('공유받기()'), true);
  assert.deepStrictEqual(t.기록.openNew, ['2026-10-31']);
  assert.strictEqual(t.b.S.modal.full, true, '빠른 창(PC·태블릿)은 캡처 칸을 접어 숨긴다 — 펼친 창으로 열어야 보인다');
  assert.strictEqual(t.b.S.cap.mode, 'voice');
  assert.strictEqual(t.b.S.cap.src, 'share');
  assert.ok(t.b.S.cap.text.includes('가나상사 방문'), '받은 글이 칸에 올라와야 사람이 보고 고친다');
  assert.ok(!t.b.S.cap.busy && t.b.S.cap.msg, '읽는 중이 아니라 «눌러 주세요» 안내가 떠야 한다');
  await 기다림();
  assert.strictEqual(t.기록.ai.length, 0, '★ 저절로 AI 를 부르면 남의 웹페이지가 우리 AI 한도를 쓰게 할 수 있다');
  t.실행('캡처글읽기()');                 /* 사람이 «읽어서 채우기»를 누른다 */
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

test('② title·text·url 을 줄로 합치고 같은 글은 한 번만 — 길면 한도로 자른다', () => {
  const t = 상자('?title=' + encodeURIComponent('회의 안내') + '&text=' + encodeURIComponent('회의 안내') + '&url=' + encodeURIComponent('https://example.com/a'));
  t.실행('공유받기()');
  assert.strictEqual(t.b.S.cap.text, '회의 안내\nhttps://example.com/a');
  const 긴 = 상자('?text=' + encodeURIComponent('가'.repeat(5000)));
  긴.실행('공유받기()');
  assert.ok(긴.b.S.cap.text.length <= CAP.LIMIT.text);
});

test('④ 공유와 상관없는 주소(출장 알림·빈 주소·공백뿐)는 아무것도 안 한다 — 주소도 안 지운다', async () => {
  for (const q of ['', '?trip=1&d=2026-10-10', '?text=', '?text=%20%20&title=', '?foo=bar']) {
    const t = 상자(q);
    assert.strictEqual(t.실행('공유받기()'), false, q);
    await 기다림();
    assert.strictEqual(t.기록.openNew.length, 0, q);
    assert.strictEqual(t.기록.replace.length, 0, q + ' — 남의 주소 변수를 지우면 안 된다');
    assert.strictEqual(t.기록.ai.length, 0, q);
    assert.strictEqual(t.기록.toast.length, 0, q);
  }
});

test('② 주소 지우기가 실패해도 계속한다 · 모듈이 없으면 AI 를 안 부르고 false', async () => {
  const a = 상자('?text=' + encodeURIComponent('11/2 3시 방문'), { 교체실패: true });
  assert.strictEqual(a.실행('공유받기()'), true);
  assert.strictEqual(a.b.S.cap.text, '11/2 3시 방문');
  a.실행('캡처글읽기()');
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

/* ⑧ 일꾼이 담아 둔 것을 화면이 꺼내 읽는다 */
const 지금기록 = (덧) => Object.assign({ id: 1, at: Date.now(), title: '', text: '', url: '', files: [] }, 덧);
const 사진알맹이 = (type) => ({ blob: { type: type || 'image/png', size: 1000 }, name: 'a.png', type: type || 'image/png' });

test('⑧ ★ ?share=1 로 열리면 주소 표를 지우고, 공유함의 캡처를 펼친 새 일정 창에 올려 둔다 — 함은 꺼내면서 비운다', async () => {
  const 함 = 가짜공유함([지금기록({ files: [사진알맹이(), 사진알맹이('image/jpeg')] })]);
  const t = 상자('?share=1', { 함 });
  t.실행('공유받기()');
  assert.strictEqual(t.기록.replace.length, 1, '?share=1 표를 지워야 새로고침이 또 꺼내지 않는다');
  await 기다림(8);
  assert.deepStrictEqual(t.기록.openNew, ['2026-10-31'], '새 일정 창을 열어야 칸을 채운다');
  assert.strictEqual(t.b.S.modal.full, true, '펼친 창이어야 PC·태블릿에서도 캡처 칸이 보인다');
  assert.strictEqual(t.b.S.cap.mode, 'photo');
  assert.strictEqual(t.b.S.cap.shared.length, 2);
  assert.strictEqual(함.상태.비움, 1, '꺼낸 뒤 함을 비워야 사진이 폰에 남지 않는다');
  assert.strictEqual(함.상태.mode, 'readwrite');
  assert.strictEqual(t.기록.사진읽기.length, 0, '★ 사람이 누르기 전에는 캡처를 AI 로 보내지 않는다');
  assert.strictEqual(t.기록.ai.length, 0);
  t.누름('shared');                       /* 사람이 «📷 공유받은 캡처 읽기»를 누른다 */
  assert.strictEqual(t.기록.사진읽기.length, 1, '누르면 «캡처로 채우기»와 같은 길로 읽는다');
  assert.strictEqual(t.기록.사진읽기[0].length, 2);
  assert.ok(t.기록.사진읽기[0].every((x) => /^image\//.test(x.type)), '알맹이(blob)를 넘겨야 줄이고 읽는다');
  assert.strictEqual(t.기록.doSave, 0, '공유만으로 저장하면 안 된다');
});

test('⑧ 공유받은 캡처 칸에는 «공유받은 캡처 읽기» 단추와 몇 장인지가 보인다 — 평소 캡처 칸에는 그 단추가 없다', async () => {
  const 함 = 가짜공유함([지금기록({ files: [사진알맹이(), 사진알맹이()] })]);
  const t = 상자('?share=1', { 함 });
  t.실행('공유받기()');
  await 기다림(8);
  const 칸 = t.실행('캡처창Html()');
  assert.ok(/data-cap="shared"/.test(칸), '읽기 단추가 없다');
  assert.ok(칸.includes('2장'), '몇 장을 받았는지 알려야 한다');
  t.b.S.cap = { mode: 'photo', busy: false, drafts: null, msg: '' };
  assert.ok(!/data-cap="shared"/.test(t.실행('캡처창Html()')), '공유가 아닐 때 단추가 보이면 안 된다');
  t.b.S.cap = { mode: 'photo', busy: false, drafts: null, msg: '' };
  t.누름('shared');
  assert.strictEqual(t.기록.사진읽기.length, 0, '받은 캡처가 없으면 눌러도 아무 일도 없어야 한다');
});

test('⑧ 공유받은 캡처를 읽다 실패해도 «공유받은 캡처 읽기» 단추가 남는다 — 다시 공유하지 않고 다시 누른다', async () => {
  const 함 = 가짜공유함([지금기록({ files: [사진알맹이()] })]);
  const t = 상자('?share=1', { 함 });
  t.b.캡처사진읽기 = function () { t.b.S.cap = { mode: 'photo', busy: true, msg: '읽는 중', drafts: null }; };   /* 진짜처럼 S.cap 을 갈아 끼운다 */
  t.실행('공유받기()');
  await 기다림(8);
  t.누름('shared');
  t.실행('캡처결과({ ok:false, why:"연결이 끊겼습니다" })');
  assert.ok(/data-cap="shared"/.test(t.실행('캡처창Html()')), '실패 뒤에 다시 읽을 단추가 없다');
});

test('⑧ 일꾼과 화면이 «같은 함»을 쓴다 — 이름·판이 어긋나면 화면이 빈 함을 연다', async () => {
  const w = 일꾼켜기();
  await 보내기(w.handlers, 공유요청(받는주소, { files: [사진('a.png', 10, 'image/png')] }));
  const 함 = 가짜공유함([]);
  const t = 상자('?share=1', { 함 });
  t.실행('공유받기()');
  await 기다림(8);
  assert.deepStrictEqual(함.상태.이름, w.함.열린이름, '공유함 이름이 다르다');
  assert.strictEqual(함.상태.판, w.함.판, '공유함 판 번호가 다르다');
  assert.strictEqual(함.상태.store, w.함.store, '공유함 칸(store) 이름이 다르다');
});

test('⑧ 글만 담겼으면 «말로 채우기» 칸에 올리고, 누르면 공유 글 길(kind share)로 읽는다', async () => {
  const 함 = 가짜공유함([지금기록({ title: '방문 안내', text: '11/2 오후 3시 가나상사 방문' })]);
  const t = 상자('?share=1', { 함 });
  t.실행('공유받기()');
  await 기다림(10);
  assert.strictEqual(t.기록.사진읽기.length, 0);
  assert.strictEqual(t.b.S.cap.text, '방문 안내\n11/2 오후 3시 가나상사 방문');
  assert.strictEqual(t.기록.ai.length, 0, '★ 누르기 전에는 AI 를 부르지 않는다');
  t.누름('go');                            /* 사람이 «읽어서 채우기»를 누른다 */
  await 기다림(4);
  assert.strictEqual(t.기록.ai.length, 1);
  assert.ok(/공유한 글/.test(t.기록.ai[0].parts[0].text) && t.기록.ai[0].parts[0].text.includes('가나상사 방문'));
  assert.strictEqual(t.b.S.modal.title, '1500 가나상사 방문');
});

test('⑧ 오래된 대기분(10분 넘음)·빈 함·사진 아닌 알맹이는 읽지 않는다 — 그래도 함은 비운다', async () => {
  const 옛 = 가짜공유함([지금기록({ at: Date.now() - 11 * 60 * 1000, files: [사진알맹이()] })]);
  const a = 상자('', { 함: 옛 });
  a.실행('공유받기()');
  await 기다림(8);
  assert.strictEqual(a.기록.openNew.length, 0, '엉뚱한 때 옛 캡처를 읽으면 안 된다');
  assert.strictEqual(옛.상태.비움, 1, '옛 것도 지워야 폰에 안 남는다');
  const 빈 = 가짜공유함([]);
  const b = 상자('?share=1', { 함: 빈 });
  b.실행('공유받기()');
  await 기다림(8);
  assert.strictEqual(b.기록.openNew.length, 0);
  const 이상 = 가짜공유함([지금기록({ files: [사진알맹이('application/pdf')] })]);
  const c = 상자('?share=1', { 함: 이상 });
  c.실행('공유받기()');
  await 기다림(8);
  assert.strictEqual(c.기록.사진읽기.length, 0, '사진이 아닌 것을 AI 로 보내면 안 된다');
});

test('⑧ ?share=none·err 는 알리고 주소 표를 지운다 — 함에 남은 옛 것은 «읽지 않고» 비운다 · indexedDB 없는 기기는 조용히', async () => {
  const 옛 = 가짜공유함([지금기록({ files: [사진알맹이()] })]);
  const a = 상자('?share=none', { 함: 옛 });
  a.실행('공유받기()');
  assert.strictEqual(a.기록.toast.length, 1);
  assert.strictEqual(a.기록.replace.length, 1);
  await 기다림(8);
  assert.strictEqual(a.기록.openNew.length, 0, '«없다»고 한 직후 옛 캡처가 열리면 헷갈린다');
  assert.strictEqual(옛.상태.비움, 1, '옛 것은 비워야 폰에 안 남는다');
  const b = 상자('?share=err');
  b.실행('공유받기()');
  assert.ok(/실패/.test(b.기록.toast[0]));
  await 기다림();
  assert.strictEqual(b.기록.openNew.length, 0);
});

test('⑧ 다른 창이 열려 있으면 닫고 «새 일정 창»으로 — 있는 일정 창에 덮어쓰지 않는다', async () => {
  const 함 = 가짜공유함([지금기록({ files: [사진알맹이()] })]);
  const t = 상자('?share=1', { 함, 창: { mode: 'edit', title: '있는 일정' } });
  t.실행('공유받기()');
  await 기다림(8);
  assert.strictEqual(t.기록.닫기, 1);
  assert.strictEqual(t.b.S.modal.mode, 'new');
});

test('⑧ 창을 닫으면(closeModal) 캡처·말 상태도 정리한다 — 뒤늦은 AI 답이 다음 새 창을 채우지 않게', () => {
  const 몸 = 함수몸('function closeModal(){');
  assert.ok(/캡처정리\(\)/.test(몸), 'closeModal 이 캡처정리를 안 부른다');
  assert.ok(몸.indexOf('캡처정리()') < 몸.indexOf('render()'), '정리한 뒤에 다시 그려야 한다');
});

test('⑧ 폰 — 캡처 칸·확인 줄도 단추 줄처럼 왼쪽 들여쓰기가 없다', () => {
  assert.ok(/body\.mob \.gform \.gcap\{[^}]*margin-left:0/.test(캘린더), '폰에서 캡처 칸이 56px 들여 써져 좁아진다');
  assert.ok(/body\.mob \.gform \.gcapwarn\{[^}]*padding-left:0/.test(캘린더), '폰에서 확인 줄이 어긋난다');
});

/* ⑥ 부팅 */
test('⑥ 공유받기는 부팅·로그인이 끝난 뒤(내 정보·후보 받기 뒤)에 부르고, 캡처 구역 안에 있다', () => {
  const 부름 = 캘린더.indexOf('    공유받기();');
  const 로그인 = 캘린더.indexOf('    S.uid = user.uid;');
  const 후보 = 캘린더.indexOf('    후보바인드(); 후보받기();');
  assert.ok(부름 > 0 && 로그인 > 0 && 부름 > 로그인 && 부름 > 후보, '로그인 전에 부르면 AI 호출이 거절된다');
  const 구역 = 캘린더.slice(캘린더.indexOf('캡처·말로 채우기 시작'), 캘린더.indexOf('캡처·말로 채우기 끝'));
  ['function 공유받기(){', 'function 공유함받기(){'].forEach((h) =>
    assert.ok(구역.includes(h), h + ' 는 캡처 구역(저장 길을 안 부르는 구역) 안에 있어야 한다'));
  assert.ok(!/doSave\(|구글에넣기\(|createEvent\(/.test(함수몸('function 공유함받기(){')), '공유함받기가 저장 길을 부르면 안 된다');
});

test('⑧ 화면의 공유함 코드는 «꺼내고 비우기»만 한다 — 넣거나 고치는 길이 없다(사진을 남기지 않는다)', () => {
  const 몸 = 함수몸('function 공유함꺼내기(){').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.getAll\(/.test(몸) && /\.clear\(\)/.test(몸), '읽고 비워야 한다');
  assert.ok(!/\.(add|put)\(/.test(몸), '화면이 공유함에 넣으면 사진이 폰에 남는다');
  const a = 캘린더.indexOf('function 공유함꺼내기(){');
  const 끝 = 캘린더.indexOf('캡처·말로 채우기 끝');
  assert.ok(a > 끝, '저장소를 만지는 코드는 캡처 구역(«저장소에 안 남긴다» 검사 구역) 밖, 따로 이름 붙인 구역에 둔다');
});

test('③ 캐시 번호: 공용 규칙 파일에 번호가 붙어 있다', () => {
  assert.ok(/<script src="js\/pu-cal-capture\.js\?v=\d+"><\/script>/.test(캘린더));
});
