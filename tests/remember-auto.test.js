/* 📇 리멤버 → 사진첩·기업정보함 자동 (대표 「반드시 자동으로」 2026-10-24, 목업 승인)

   ★ 못 박는 것
     ① 리멤버 명함 한 장을 기업정보함 칸으로 바르게 옮긴다(성+이름, 전화 모양)
     ② 첫 회차는 기준만 잡고 아무것도 안 넣는다 — 옛 명함은 이미 다 들어와 있다
     ③ 기준 뒤에 바뀐 것만, 오래된 것부터, 같은 명함은 한 번
     ④ 같은 그림은 두 번 쌓지 않는다
     ⑤ 화면 안 조각(hook)은 기준까지만 넘기고, 리멤버 머리(authorization)를 밖으로 내보내거나 저장하지 않는다
     ⑥ 받는 화면은 같은 창 안·확장 표시가 붙은 말만 믿고, 저장은 사진첩·기업정보함 «같은 문»으로만
     ⑦ 그림은 리멤버 그림 창고 주소만 받는다 · 확장 폴더는 인터넷에 안 올라간다
   ⚠ 예시는 가짜다(가나상사·홍길동).
   node --test tests/remember-auto.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = require('../js/pu-remember.js');
const EXT = path.join(__dirname, '..', 'tools', 'remember-ext');
const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const stack = (id, upd, extra) => Object.assign({ id, created_at: '2026-10-20T10:00:00+09:00', updated_at: upd,
  main_card: { id: id * 10, updated_at: upd, requested_at: upd,
    image: { front: { original: 'https://remember-cdn.rememberapp.co.kr/production/uploads/namecards/x/' + id + '/preview.jpg?expires_at=1', empty: false }, back: { empty: true } },
    data: { default: { name: { first: '길동', last: '홍' }, mobile: { national_number: '010-1234-5678' }, tel: { normalized_number: '+82415551234' },
      fax: {}, email: 'hong@gana.example', company: '가나상사', department: '경영팀', position: '부장', address: { default: '가나시 다라로 1', detail: '2층' } } } } }, extra || {});

test('★★★ ① 명함 한 장 → 기업정보함 칸', () => {
  const c = R.fromApi(stack(7, '2026-10-24T11:56:00+09:00'));
  assert.equal(c.name, '홍길동', '한글 이름은 성+이름');
  assert.equal(c.mobile, '010-1234-5678'); assert.equal(c.tel, '041-555-1234', '+82 를 0 으로');
  assert.equal(c.address, '가나시 다라로 1 2층'); assert.equal(c.rid, '7');
  assert.deepEqual(Object.keys(R.toFields(c)).sort(), ['address', 'company', 'dept', 'email', 'mobile', 'name', 'tel', 'title'], '빈 칸(팩스)은 안 담는다');
  const rd = R.readOf(c, 5);
  assert.equal(rd.kind, 'card'); assert.equal(rd.via, 'remember'); assert.equal(rd.fields.name, '홍길동');
  assert.equal(R.phone({ national_number: '0212345678' }), '02-1234-5678');
  assert.equal(R.fromApi({ id: 1, main_card: { data: { default: { name: { first: 'Kim', last: 'Lee' } } } } }).name, 'Kim Lee');
});

test('★★★ ② 첫 회차는 기준만 · ③ 기준 뒤에 바뀐 것만, 오래된 것부터, 한 번', () => {
  const cards = [stack(1, '2026-10-24T10:00:00+09:00'), stack(2, '2026-10-23T10:00:00+09:00'), stack(3, '2026-10-20T10:00:00+09:00')].map(R.fromApi);
  const first = R.plan(cards, 0);
  assert.equal(first.first, true); assert.equal(first.todo.length, 0, '★★★ 첫 회차에 옛 명함을 넣으려 한다');
  assert.equal(first.cp, Date.parse('2026-10-24T10:00:00+09:00'));
  const p = R.plan(cards.concat([cards[1]]), Date.parse('2026-10-21T00:00:00+09:00'));
  assert.deepEqual(p.todo.map((c) => c.rid), ['2', '1'], '★★ 기준 뒤 것만 오래된 것부터, 같은 것은 한 번이 아니다');
  assert.equal(p.cp, Date.parse('2026-10-24T10:00:00+09:00'));
});

test('★★ ④ 같은 그림은 두 번 쌓지 않는다', () => {
  const c = R.fromApi(stack(1, '2026-10-24T10:00:00+09:00'));
  assert.equal(R.needPhoto(c, null), true);
  assert.equal(R.needPhoto(c, { front: c.front.split('?')[0] }), false, '★★ 서명 주소만 바뀌었는데 또 올린다');
  assert.equal(R.needPhoto(c, { front: 'https://remember-cdn.rememberapp.co.kr/other.jpg' }), true);
  assert.equal(R.okImageUrl('https://remember-cdn.rememberapp.co.kr/a/b.jpg?x=1'), true);
  assert.equal(R.okImageUrl('https://evil.example/a.jpg'), false);
});

test('★★★ ⑤ 화면 안 조각 — 기준까지만 넘기고, 머리를 내보내지 않는다', async () => {
  const calls = [];
  /* 쪽마다 50장 — 첫 쪽은 다 기준 뒤, 둘째 쪽 끝은 기준보다 옛것, 셋째 쪽도 있다 */
  const day = (n) => new Date(Date.parse('2026-10-24T10:00:00+09:00') - n * 3600000).toISOString();
  const pages = { 1: Array.from({ length: 50 }, (_, i) => day(i)), 2: Array.from({ length: 50 }, (_, i) => day(50 + i * 40)), 3: [day(5000)] };
  const listeners = [];
  const posted = [];
  const win = {
    location: { href: 'https://card.rememberapp.co.kr/book/groups', origin: 'https://card.rememberapp.co.kr' },
    fetch: async (url, init) => {
      calls.push({ url: typeof url === 'string' ? url : url.url, init });
      const body = init && init.body ? JSON.parse(init.body) : {};
      const ups = pages[body.page] || [];
      return { status: 200, json: async () => ({ data: { stacks: ups.map((u, i) => stack(body.page * 10 + i, u)), metainfo: { total_count: 6205 } } }) };
    },
    addEventListener: (t, f) => { if (t === 'message') listeners.push(f); },
    postMessage: (m) => posted.push(m),
  };
  win.window = win;
  const ctx = vm.createContext({ window: win, Headers, setTimeout, Date, JSON, Promise, String, Number, Object, location: win.location });
  vm.runInContext(read(path.join(EXT, 'hook.js')), ctx);
  /* 화면이 스스로 목록을 부른다 — 머리를 빌린다 */
  await win.fetch('https://api.rememberapp.co.kr/v2/stacks/list.json', { method: 'POST', headers: { authorization: 'Bearer SECRET-TOKEN', package: 'p' }, body: JSON.stringify({ page: 9 }) });
  const ask = (cp) => new Promise((ok) => {
    const before = posted.length;
    listeners.forEach((f) => f({ source: win, data: { __from: 'pu-rem-relay', __to: 'pu-rem-hook', cmd: 'pull', cp, seq: 1 } }));
    (function wait() { if (posted.length > before) ok(posted[posted.length - 1]); else setTimeout(wait, 5); })();
  });
  calls.length = 0;
  const r = await ask(Date.parse('2026-10-21T00:00:00+09:00'));
  assert.equal(r.stacks.length, 100, '두 쪽에서 멈춰야 한다(둘째 쪽 끝이 기준보다 옛것)');
  assert.deepEqual(calls.map((c) => JSON.parse(c.init.body).page), [1, 2], '★★ 기준을 넘겨 더 불렀다');
  assert.deepEqual(JSON.parse(calls[0].init.body).sort, [{ updated_at: 'desc' }], '수정순이어야 고친 명함도 잡힌다');
  assert.equal(calls[0].init.headers.authorization, 'Bearer SECRET-TOKEN', '화면이 쓴 머리를 빌려야 한다');
  assert.equal(r.total, 6205);
  assert.ok(!JSON.stringify(posted).includes('SECRET-TOKEN'), '★★★ 리멤버 머리(열쇠)를 밖으로 내보냈다');
  calls.length = 0;
  await ask(0);
  assert.equal(calls.length, 1, '첫 회차는 첫 쪽만');
  const code = strip(read(path.join(EXT, 'hook.js')));
  assert.ok(!/localStorage|sessionStorage|indexedDB|chrome\.storage|document\.cookie\s*=/.test(code), '★★★ 머리를 어딘가에 저장한다');
  assert.ok(!/method:\s*'(DELETE|PUT|PATCH)'/.test(code) && !/\/(delete|destroy|update)\b/.test(code), '★★ 리멤버에 쓰는 주소를 부른다');
});

test('★★★ ⑥ 받는 화면 — 같은 창·확장 표시만 믿고, 저장은 같은 문으로만', () => {
  const html = read(path.join(__dirname, '..', 'remember-intake.html'));
  const js = strip(html.slice(html.lastIndexOf('<script>')));
  assert.match(js, /ev\.source !== window \|\| ev\.origin !== location\.origin/, '★★★ 다른 창·다른 곳에서 온 말을 받는다');
  assert.match(js, /m\.__from !== EXT \|\| m\.__to !== PAGE/);
  assert.match(js, /PuPhotoStore\.savePhoto\(/, '사진첩 저장 문이 아니다');
  assert.match(js, /PuDocFile\.sendToCards\(\{ kind: 'card'/, '★★ 기업정보함 «같은 문»(겹침 검사)을 안 쓴다');
  /* 메일 명함(2026-10-24)은 만든 뒤 «폴더 칸»만 붙인다 — 명함 자체는 여전히 sendToCards 로만 만든다 */
  const itemPaths = js.match(/'pucards\/items[^']*'(\s*\+\s*[\w.]+\s*\+\s*'[^']*')?/g) || [];
  assert.ok(itemPaths.every((p) => /'\/group'|'\/updatedAt'/.test(p)), '★★★ 기업정보함 명함에 직접 쓴다 — 둘째 저장 길이 생긴다: ' + itemPaths.join(' | '));
  assert.ok(!/pucards\/idx|\.ref\(['"]puphotos/.test(js), '★★★ 기업정보함 색인·사진첩에 직접 쓴다');
  assert.match(js, /PuRemember\.plan\(/); assert.match(js, /failed \? lastOk/, '★★ 못 넣은 것을 넘겨 기준을 앞당긴다');
  assert.match(html, /<script src="js\/pu-remember\.js\?v=\d+"><\/script>/);
});

test('★★ ⑦ 그림은 리멤버 창고만 · 확장은 좁은 권한 · 인터넷에 안 올라간다', () => {
  const man = JSON.parse(read(path.join(EXT, 'manifest.json')));
  assert.equal(man.manifest_version, 3);
  const hook = man.content_scripts.find((c) => c.js.includes('hook.js'));
  assert.equal(hook.world, 'MAIN', '화면 공간이어야 리멤버 목록 머리를 빌릴 수 있다');
  assert.deepEqual(man.permissions.sort(), ['alarms', 'tabs'], '★★ 필요 없는 권한이 붙었다');
  assert.ok(man.host_permissions.every((h) => /rememberapp\.co\.kr|nabaho\.github\.io\/pureunall\/remember-intake/.test(h)), '★★ 다른 집까지 권한을 받는다');
  const bg = strip(read(path.join(EXT, 'bg.js')));
  assert.match(bg, /IMG_OK\.test\(url/, '★★ 그림 주소를 거르지 않는다');
  const wf = read(path.join(__dirname, '..', '.github', 'workflows', 'deploy-pages.yml'));
  assert.match(wf, /for d in [^\n]*\btools\b/, '★★ tools/ 가 배포에서 빠지지 않는다');
  const onto = read(path.join(__dirname, '..', 'js', 'pu-ontology.js'));
  assert.match(onto, /remember_intake:\{ name:'리멤버 받기', file:'remember-intake\.html', program:'cards'/);
});

test('★★ 기업정보함 옆줄 — 로그인 풀림 ✕ · 3시간 넘게 소식 없음 ⚠ · 정상 ●', () => {
  const SRC = read(path.join(__dirname, '..', 'pu-cards.html'));
  const a = SRC.indexOf('\nfunction remStatusMark(');
  const ctx = vm.createContext({ Number, Date });
  vm.runInContext(SRC.slice(a, SRC.indexOf('\n}\n', a) + 2), ctx);
  const now = Date.UTC(2026, 9, 24, 3);
  assert.equal(ctx.remStatusMark({ at: now - 600000 }, now), '●');
  assert.equal(ctx.remStatusMark({ at: now - 4 * 3600000 }, now), '⚠', '★★ 확장이 멈췄는데 정상으로 보인다');
  assert.equal(ctx.remStatusMark({ at: now, err: 'login' }, now), '✕');
  assert.equal(ctx.remStatusMark(null, now), '');
  assert.match(SRC, /onclick="window\.open\('remember-intake\.html','pu-remember'\)"[^>]*>📇<em>리멤버<\/em>/, '옆줄 문이 없다');
});
