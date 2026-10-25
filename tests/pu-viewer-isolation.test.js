'use strict';
/* 문서뷰어 «새는 길이 없다 · 나쁜 파일이 갇힌다» (2026-10-25, 설계 docs/폰-문서뷰어-설계.md 6절)
 *
 * ■ 왜 이 검사가 있나
 *   이 앱은 고객 급여대장·주민번호가 든 파일을 폰에서 연다. 두 가지가 구조로 지켜져야 한다.
 *   ① 파일이 기기 밖으로 안 나간다 — 서버·외부 주소·분석 코드가 «없다»
 *   ② 문서 해석기(pdf.js·SheetJS 0.18.5·rhwp)에 약점이 있어 나쁜 파일이 코드를 돌려도,
 *      모든 앱이 쓰는 같은 주소(nabaho.github.io)의 로그인 증표에 손이 안 닿는다 — 격리 iframe
 *   「구조로 막는다」 — 누가 «편해서» sandbox 에 allow-same-origin 을 주거나 fetch 를 붙이면 그 자리에서 걸린다.
 *
 * ■ 못 박는 것은 값이 아니라 규칙이다 (캐시 번호·글 문구는 안 본다)
 * node --test tests/pu-viewer-isolation.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs, stripComments } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const PAGE = read('pu-viewer.html');
const FRAME = read('pu-viewer-frame.html');
const JS = ['js/pu-viewer-app.js', 'js/pu-viewer-render.js', 'js/pu-viewer-kind.js', 'js/pu-viewer-recent.js'];
const code = (f) => stripJs(read(f));
const bare = (h) => stripComments(h, 'html');

function csp(html) {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/);
  assert.ok(m, 'CSP 가 없습니다');
  const o = {};
  m[1].split(';').forEach((d) => { const t = d.trim().split(/\s+/); if (t[0]) o[t[0]] = t.slice(1); });
  return o;
}

test('① 첫 화면·칸 모두 CSP 가 있고, 연결(connect-src)은 «이 사이트»뿐이다', () => {
  [PAGE, FRAME].forEach((h) => {
    const c = csp(h);
    assert.ok(c['connect-src'], 'connect-src 가 없으면 default-src 를 따라가 헐겁다');
    c['connect-src'].forEach((v) => assert.ok(["'self'", "'none'", 'blob:'].includes(v), 'connect-src 에 바깥 주소가 있습니다: ' + v));
    Object.keys(c).forEach((k) => c[k].forEach((v) => {
      assert.ok(!/^https?:/.test(v) && v !== '*', k + ' 에 바깥 주소가 허용돼 있습니다: ' + v);
    }));
  });
});

test('① 첫 화면은 스크립트를 «이 사이트 파일»로만 돌린다 — 인라인·eval 불허', () => {
  const c = csp(PAGE);
  assert.ok(c['script-src'] && c['script-src'].includes("'self'"));
  assert.ok(!c['script-src'].includes("'unsafe-inline'"), '인라인 스크립트가 열려 있습니다');
  assert.ok(!c['script-src'].includes("'unsafe-eval'"), '첫 화면에 eval 이 열려 있습니다');
  const b = bare(PAGE);
  const inline = [...b.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc=/.test(m[1]) && m[2].trim());
  assert.deepEqual(inline.map((m) => m[2].slice(0, 40)), [], '인라인 <script> 가 있습니다 — js/pu-viewer-app.js 로 옮기세요');
});

test('① 첫 화면·칸은 서버·분석·외부 스크립트를 싣지 않는다', () => {
  [PAGE, FRAME].forEach((h) => {
    const b = bare(h);
    assert.ok(!/firebase|gstatic|googleapis|google-analytics|googletagmanager|jsdelivr|unpkg|cdnjs/i.test(b), '서버·분석·외부 주소가 있습니다');
    [...b.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/gi)].forEach((m) => {
      assert.ok(!/^(https?:)?\/\//.test(m[1]) || /^data:/.test(m[1]), '바깥 주소를 부릅니다: ' + m[1]);
    });
  });
});

test('① 코드에 «새는 길»이 없다 — 외부 주소·XHR·소켓·비콘·firebase 불허, fetch 는 vendor/ 상대 경로만', () => {
  JS.forEach((f) => {
    const s = code(f);
    assert.ok(!/https?:\/\//.test(s), f + ': 외부 주소 글자가 있습니다');
    assert.ok(!/XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/.test(s), f + ': 바깥으로 나갈 수 있는 길이 있습니다');
    assert.ok(!/\bfirebase\b/i.test(s), f + ': firebase 를 부릅니다 — 이 앱은 서버를 쓰지 않습니다');
    [...s.matchAll(/\bfetch\s*\(\s*([^)]*)\)/g)].forEach((m) => {
      assert.match(m[1], /^'vendor\//, f + ': fetch 는 저장소 안 vendor/ 파일만 가져올 수 있습니다 → ' + m[0]);
    });
  });
});

test('① 서비스워커는 «공유받기» 때문에만 등록한다 — 캐시를 두지 않는 공용 파일(pu-sw.js)', () => {
  const s = code('js/pu-viewer-app.js');
  assert.match(s, /serviceWorker\.register\('pu-sw\.js'\)/);
  assert.ok(!/caches\.|Cache\b/.test(s), '화면이 캐시를 건드립니다 — 공용 서비스워커는 아무것도 캐시하지 않는다는 약속이 있습니다');
  assert.ok(!/pu-version\.js/.test(PAGE.replace(/<!--[\s\S]*?-->/g, '')), '문서를 읽는 중에 자동 새로고침이 돌면 열어 둔 문서가 닫힙니다');
});

test('② 문서를 그리는 칸(iframe)은 sandbox="allow-scripts" «만» 갖는다', () => {
  const b = bare(PAGE);
  const m = b.match(/<iframe\b[^>]*>/i);
  assert.ok(m, '문서 칸(iframe)이 없습니다');
  const sb = (m[0].match(/\bsandbox="([^"]*)"/) || [])[1];
  assert.ok(sb !== undefined, 'sandbox 속성이 없습니다 — 같은 주소의 로그인 증표에 손이 닿습니다');
  const flags = sb.trim().split(/\s+/).filter(Boolean);
  assert.ok(flags.includes('allow-scripts'));
  const 불허 = ['allow-same-origin', 'allow-top-navigation', 'allow-top-navigation-by-user-activation', 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-forms', 'allow-modals', 'allow-downloads'];
  flags.forEach((f) => assert.ok(!불허.includes(f), 'sandbox 에 ' + f + ' 를 주면 격리가 풀립니다'));
  assert.deepEqual(flags.filter((f) => f !== 'allow-scripts'), [], 'allow-scripts 말고 다른 허락을 주려면 설계서 6절부터 고치세요');
});

test('② 칸의 주소는 sandbox 가 걸린 «뒤에» 코드가 넣는다 — 마크업에 src 를 두지 않는다', () => {
  const m = bare(PAGE).match(/<iframe\b[^>]*>/i)[0];
  assert.ok(!/\bsrc=/.test(m), 'iframe 에 src 가 있으면 sandbox 보다 먼저 열릴 수 있습니다');
  assert.match(code('js/pu-viewer-app.js'), /frame\.src\s*=\s*'pu-viewer-frame\.html/);
});

test('② 칸(pu-viewer-frame.html)은 모든 것을 기본 거부(default-src none)에서 시작한다', () => {
  const c = csp(FRAME);
  assert.deepEqual(c['default-src'], ["'none'"]);
  assert.deepEqual(c['frame-src'], ["'none'"], '칸 안에서 또 칸을 못 열게');
  assert.deepEqual(c['form-action'], ["'none'"]);
  assert.deepEqual(c['base-uri'], ["'none'"]);
  assert.ok(!(c['img-src'] || []).some((v) => /^https?:/.test(v)), '그림으로도 새어 나가지 못해야 합니다');
});

test('② 서로 «아는 사이»끼리만 말한다 — 칸은 부모 말만, 부모는 자기 칸 말만 듣는다', () => {
  assert.match(code('js/pu-viewer-render.js'), /e\.source\s*!==\s*window\.parent/);
  assert.match(code('js/pu-viewer-app.js'), /e\.source\s*!==\s*frame\.contentWindow/);
});

test('② 한글 엔진은 «저장소 사본»만 쓴다 — 엔진 기본값은 cdn.jsdelivr.net 부터 부르므로 cdnBase 를 비운다', () => {
  assert.match(code('js/pu-viewer-render.js'), /cdnBase\s*:\s*''/, '비우지 않으면 서류가 남의 서버(CDN)를 거칩니다');
  assert.match(code('js/pu-viewer-render.js'), /coreUrl\s*:\s*'vendor\/rhwp-core\/rhwp\.js'/);
});

test('② pdf.js 는 isEvalSupported:false — 글꼴로 숨긴 스크립트가 돌지 못한다', () => {
  const s = code('js/pu-viewer-render.js');
  const calls = [...s.matchAll(/getDocument\s*\(([^)]*)\)/g)];
  assert.ok(calls.length >= 1);
  calls.forEach((m) => assert.match(m[1], /isEvalSupported\s*:\s*false/));
});

test('② 문서 안의 글은 «글자»로만 넣는다 — innerHTML·outerHTML·insertAdjacentHTML·document.write 불허', () => {
  ['js/pu-viewer-app.js', 'js/pu-viewer-render.js'].forEach((f) => {
    const s = code(f);
    /* innerHTML 을 «비우려고»(= '') 쓰는 것은 괜찮다 — 글을 «넣는» 것만 막는다 */
    const bad = [...s.matchAll(/\.(innerHTML|outerHTML)\s*=\s*([^;]*)/g)].filter((m) => !/^\s*(''|"")\s*$/.test(m[2]));
    assert.deepEqual(bad.map((m) => m[0]), [], f + ': HTML 로 해석해 넣는 곳이 있습니다');
    assert.ok(!/insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(s), f + ': 글을 코드로 돌릴 수 있는 길이 있습니다');
  });
});

test('③ 공유받기 짝 — manifest 의 주소·칸 이름이 pu-sw.js 가 받는 것과 같다', () => {
  const mf = JSON.parse(read('pu-viewer-manifest.json'));
  const st = mf.share_target;
  assert.ok(st && st.method === 'POST' && /multipart/.test(st.enctype));
  const name = st.params.files[0].name;
  const sw = read('pu-sw.js');
  const act = st.action.replace(/^\.\//, '/');
  assert.ok(sw.includes("'" + act + "'"), 'pu-sw.js 가 ' + act + ' 로 오는 공유를 안 받습니다');
  assert.ok(sw.includes("fd.getAll('" + name + "')"), 'pu-sw.js 가 파일 칸 이름 ' + name + ' 을 안 읽습니다');
  assert.match(code('js/pu-viewer-app.js'), /indexedDB\.open\(SHARE_DB/);
  /* 두 쪽이 «같은 보관함 이름»을 쓴다 */
  const db = (code('js/pu-viewer-app.js').match(/SHARE_DB\s*=\s*'([^']+)'/) || [])[1];
  assert.ok(db && sw.includes("'" + db + "'"), '화면과 서비스워커의 보관함 이름이 다릅니다');
});

test('③ 공유로 받은 파일은 꺼내면서 «바로 지운다» — 내용을 남기지 않는다', () => {
  const s = code('js/pu-viewer-app.js');
  assert.match(s, /c\.delete\(\)/, '꺼낸 줄을 지우지 않으면 파일 내용이 기기에 남습니다');
});

test('설치 — manifest 의 아이콘 파일이 실제로 있다 · 연결 프로그램 확장자가 «그릴 수 있는 것»뿐이다', () => {
  const mf = JSON.parse(read('pu-viewer-manifest.json'));
  mf.icons.forEach((i) => assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src + ' 가 없습니다'));
  const K = require(path.join(ROOT, 'js', 'pu-viewer-kind.js'));
  const exts = [].concat.apply([], mf.file_handlers.map((h) => [].concat.apply([], Object.values(h.accept))));
  exts.forEach((e) => {
    const probe = K.extOf('x' + e);
    assert.ok(['hwp', 'hwpx', 'pdf', 'xlsx', 'xls', 'csv', 'tsv'].includes(probe), '그릴 수 없는 형식을 연결 프로그램에 올렸습니다: ' + e);
  });
});
