'use strict';
/* 굳히개(scripts/freeze-homepage.js)가 «남의 것을 떠 오거나, 출력 폴더 밖에 쓰지» 않는다 — 2026-11-16 보안 검토(중간)
   ═══════════════════════════════════════════════════════════════════════════
   굳히개는 옛 홈페이지의 쪽을 내려받아 자산(그림·꾸밈·스크립트)을 site/ 에 담는다.
   ① 자산 주소를 «앞글자»로만 견주면 `https://xn--…kr.evil.example/…` 같은 남의 주소가 끼어든다.
   ② 자산 주소를 풀면(%2e%2e%2f → ../) 출력 폴더 밖, 곧 저장소의 코드·설정을 덮을 수 있다.
   ★ 함수를 떠서 «돌려» 본다(되풀이된 실수 2 — 글자만 보면 꺼진 기능도 통과한다).
   실행: node --test tests/freeze-homepage-safety.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 굳 = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'freeze-homepage.js'), 'utf8');
const 떠오기 = (이름) => {
  const m = new RegExp('function ' + 이름 + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}').exec(굳);
  assert.ok(m, '★ 굳히개에서 ' + 이름 + ' 함수를 못 찾았다');
  return m[0];
};
const ORIGIN = (/const ORIGIN = '([^']+)'/.exec(굳) || [, ''])[1];
const ASSET_RE = (/const ASSET_RE = (\/[\s\S]*?\/gi);/.exec(굳) || [, ''])[1];

test('★ 자산은 «출처가 정확히 같은» 것만 떠 온다 — 앞이 같은 남의 주소는 빼다', () => {
  assert.ok(ORIGIN && ASSET_RE, '★ ORIGIN·ASSET_RE 를 못 읽었다');
  const 자산주소들 = new Function('ORIGIN', 'ORIGIN_HANGUL', 'ASSET_RE',
    떠오기('자산주소들') + '\nreturn 자산주소들;')(ORIGIN, ORIGIN, eval(ASSET_RE));
  const 글 = '<img src="/files/a.png"><img src="' + ORIGIN + '.evil.example/x.js">'
    + '<link href="https://evil.example/' + ORIGIN + '/y.css"><img src="' + ORIGIN + '/files/b.jpg">';
  const 받음 = 자산주소들(글, ORIGIN + '/');
  assert.deepEqual(받음.sort(), [ORIGIN + '/files/a.png', ORIGIN + '/files/b.jpg'].sort(),
    '★ 남의 주소를 우리 자산으로 떠 왔다: ' + JSON.stringify(받음));
});

test('★ 넘김(302)도 우리 출처 https 안에서만 따라간다 — 남의 주소 응답을 우리 자산으로 담지 않게', async () => {
  /* 네트워크 없이 https.get 을 흉내 낸다: 주소별로 정해 둔 응답을 돌려주고, 부른 주소를 적는다 */
  const 부른 = [];
  const 응답표 = {
    [ORIGIN + '/a.js']: { statusCode: 302, headers: { location: 'https://evil.example/payload.js' } },
    [ORIGIN + '/b.js']: { statusCode: 302, headers: { location: '/files/b2.js' } },
    [ORIGIN + '/files/b2.js']: { statusCode: 200, headers: { 'content-type': 'text/javascript' }, 몸: '우리것' },
    [ORIGIN + '/c.js']: { statusCode: 302, headers: { location: 'http://' + new URL(ORIGIN).host + '/c2.js' } },
  };
  const 가짜https = { get(url, opts, cb) {
    부른.push(url);
    const r = 응답표[url] || { statusCode: 404, headers: {} };
    const res = { statusCode: r.statusCode, headers: r.headers, resume() {},
      on(ev, f) { if (ev === 'data' && r.몸) f(Buffer.from(r.몸)); if (ev === 'end') f(); return res; } };
    setImmediate(() => cb(res));
    return { on() { return this; }, destroy() {} };
  } };
  const fetchBin = new Function('https', 'ORIGIN', 'console', 'Buffer',
    떠오기('fetchBin') + '\nreturn fetchBin;')(가짜https, ORIGIN, { warn() {} }, Buffer);
  const 남 = await fetchBin(ORIGIN + '/a.js');
  assert.equal(남.code, 0, '★ 남의 주소로 넘김을 따라가 그 응답을 받았다');
  assert.ok(!부른.some(u => u.indexOf('evil.example') >= 0), '★ 남의 주소를 실제로 불렀다: ' + 부른.join(', '));
  const 우리 = await fetchBin(ORIGIN + '/b.js');
  assert.equal(우리.code, 200, '우리 출처 안의 넘김은 따라가야 한다');
  assert.equal(우리.buf.toString(), '우리것');
  const 평문 = await fetchBin(ORIGIN + '/c.js');
  assert.equal(평문.code, 0, '★ https 가 아닌 주소로 넘김을 따라갔다');
});

test('★ 출력 폴더 밖으로는 안 쓴다 — 풀린 ../ 는 건너뛴다', () => {
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'freeze-safety-'));
  const 쓴곳 = [];
  const 가짜fs = { mkdirSync() {}, writeFileSync(p) { 쓴곳.push(p); } };
  const 담기 = new Function('OUT', 'path', 'fs', 'console',
    떠오기('담기') + '\nreturn 담기;')(OUT, path, 가짜fs, { warn() {} });
  assert.equal(담기('files/a.png', Buffer.from('')), true, '정상 자리를 막았다');
  assert.equal(담기('../밖.js', Buffer.from('')), false, '★ ../ 로 출력 폴더 밖에 썼다');
  assert.equal(담기('files/../../밖.js', Buffer.from('')), false, '★ 섞인 ../ 로 출력 폴더 밖에 썼다');
  assert.equal(담기(path.resolve(OUT, '..', '밖.js'), Buffer.from('')), false, '★ 절대 경로로 출력 폴더 밖에 썼다');
  assert.equal(담기('', Buffer.from('')), false, '★ 출력 폴더 자체를 파일로 덮으려 했다');
  assert.ok(쓴곳.every(p => path.relative(OUT, p).split(path.sep)[0] !== '..'), '★ 출력 폴더 밖 쓰기가 있었다: ' + 쓴곳.join(', '));
  assert.equal(쓴곳.length, 1, '정상 한 건만 써야 한다');
  fs.rmSync(OUT, { recursive: true, force: true });
});
