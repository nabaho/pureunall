#!/usr/bin/env node
/* kordoc 를 브라우저 한 벌로 묶는다 → vendor/kordoc/kordoc.browser.min.js (2026-09-30)

   kordoc(https://github.com/chrisryugj/kordoc, MIT)는 서버·PC(Node.js)용이라 브라우저 판이 없다.
   규정관리는 «원본을 서버로 보내지 않고 브라우저 안에서만» 읽으므로 우리가 묶는다.
   - Node 내장 모듈(fs·path·zlib·crypto…)은 대역으로 바꾼다. zlib 는 pako 로 «진짜» 돌고,
     path 는 문자열 처리, createRequire 는 cfb 만 돌려준다. 나머지는 부르면 「브라우저에서 못 씀」 을 던진다
     (파일 읽기·외부 프로그램 부르기 같은 CLI·MCP 기능이라 문서 읽기에는 안 쓰인다).
   - 선택 부품(PDF·OCR·그림·MCP)은 빈 대역 — 한글(.hwp·.hwpx)·워드·엑셀 읽기에는 필요 없다.

   ⚠ kordoc 판을 올릴 때마다 다시 묶고, tests/kordoc-browser.test.js 와
     «표준취업규칙을 실제로 읽혀 보기» 를 다시 할 것. 대역이 모자라면 묶을 때 이름이 나온다.

   쓰는 법(이 폴더에서):
     npm i --no-save kordoc@4.17.1 esbuild@0.24 pako@2 buffer@6 process@0.11
     node build.js            → ../../vendor/kordoc/kordoc.browser.min.js */
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const HERE = __dirname;
const DIST = path.join(HERE, 'node_modules', 'kordoc', 'dist');
const OUT = path.join(HERE, '..', '..', 'vendor', 'kordoc', 'kordoc.browser.min.js');
const VERSION = require(path.join(HERE, 'node_modules', 'kordoc', 'package.json')).version;

const BUILTIN = /^(node:)?(fs|fs\/promises|child_process|os|crypto|url|module|worker_threads|stream|stream\/promises|util|events|buffer|readline|http|https|net|tls|zlib|path|assert|string_decoder|perf_hooks|v8|vm|dns|querystring|timers|timers\/promises)$/;
const OPTIONAL = /^(pdfjs-dist|onnxruntime-node|onnxruntime-web|sharp|@huggingface\/transformers|@hyzyla\/pdfium|puppeteer-core|@modelcontextprotocol\/sdk|canvas)(\/.*)?$/;
const ZLIB = { inflateRawSync: 'inflateRaw', inflateSync: 'inflate', deflateRawSync: 'deflateRaw', deflateSync: 'deflate', gunzipSync: 'ungzip', gzipSync: 'gzip', unzipSync: 'inflate' };

/* kordoc 가 내장·선택 부품에서 가져다 쓰는 이름을 모두 모은다 — 대역도 그 이름을 내놓아야 묶인다 */
const used = {};
for (const f of fs.readdirSync(DIST).filter(f => f.endsWith('.js'))) {
  const s = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of s.matchAll(/import\s*(?:[A-Za-z_$][\w$]*\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g)) {
    const mod = m[2].replace(/^node:/, '');
    if (!BUILTIN.test(m[2]) && !OPTIONAL.test(m[2])) continue;
    (used[mod] = used[mod] || new Set());
    if (m[1]) m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean).forEach(n => used[mod].add(n));
  }
}
function builtinStub(mod) {
  if (mod === 'path') return fs.readFileSync(path.join(HERE, 'shims', 'path.js'), 'utf8');
  if (mod === 'module') return fs.readFileSync(path.join(HERE, 'shims', 'module.js'), 'utf8');
  let src = mod === 'zlib' ? "import pako from 'pako';\nconst B = (u) => (typeof Buffer !== 'undefined' ? Buffer.from(u) : u);\n" : '';
  src += "const no = (n) => function () { throw new Error('브라우저에서는 쓸 수 없는 기능: " + mod + ".' + n); };\n";
  for (const n of used[mod] || []) {
    if (n === 'default') continue;
    if (mod === 'zlib' && ZLIB[n]) src += 'export function ' + n + '(b) { return B(pako.' + ZLIB[n] + '(b)); }\n';
    else if (n === 'platform' && mod === 'os') src += "export const platform = () => 'browser';\n";
    else if (n === 'existsSync') src += 'export const existsSync = () => false;\n';
    else if (n === 'constants' || n === 'promises') src += 'export const ' + n + ' = {};\n';
    else if (n === 'fileURLToPath') src += 'export const fileURLToPath = (u) => String(u);\n';
    else src += 'export const ' + n + ' = no(' + JSON.stringify(n) + ');\n';
  }
  return src + 'export default {};\n';
}
function optionalStub(id) {
  const names = [...(used[id] || [])].filter(n => n !== 'default');
  return 'const no=()=>{throw new Error("브라우저에서는 쓸 수 없는 부품: ' + id + '")};'
    + names.map(n => 'export const ' + n + '=new Proxy(function(){}, {get:()=>no, apply:no, construct:no});').join('')
    + 'export default new Proxy({}, {get:()=>no});';
}
const stubs = {
  name: 'pureun-stubs',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      const bare = a.path.replace(/^node:/, '');
      /* process 는 브라우저 판(process/browser.js)을 쓴다 — buffer-inject.js 가 넣는다 */
      if (BUILTIN.test(a.path) && bare !== 'buffer') return { path: bare, namespace: 'builtin-stub' };
      if (OPTIONAL.test(a.path)) return { path: a.path, namespace: 'optional-stub' };
      return null;
    });
    b.onLoad({ filter: /.*/, namespace: 'builtin-stub' }, (a) => ({ contents: builtinStub(a.path), loader: 'js', resolveDir: HERE }));
    b.onLoad({ filter: /.*/, namespace: 'optional-stub' }, (a) => ({ contents: optionalStub(a.path), loader: 'js' }));
  }
};

/* 파일째 개인정보 가림(redactDocument) — kordoc 가 공개 목록에는 안 올렸지만 dist 안에 있다(CLI 가 쓴다).
   조각 이름에 판마다 바뀌는 꼬리(redact-doc-XXXX.js)가 붙어 있어 찾아서 꺼낸다. 없으면 멈춘다 —
   서고 개인정보 가림(2026-09-30 ②)이 이것 없이는 원본 파일을 못 가린다. */
const REDACT = fs.readdirSync(DIST).find(f => /^redact-doc-[A-Z0-9]+\.js$/.test(f));
if (!REDACT) { console.error('✗ kordoc dist 에 redact-doc-*.js 가 없다 — 판이 바뀌어 파일 가림이 옮겨졌는지 볼 것'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
esbuild.build({
  stdin: { contents: "export * from 'kordoc';\nexport { redactDocument } from './node_modules/kordoc/dist/" + REDACT + "';", resolveDir: HERE, loader: 'js' },
  bundle: true, format: 'esm', platform: 'browser', minify: true, legalComments: 'none',
  outfile: OUT,
  plugins: [stubs],
  inject: [path.join(HERE, 'buffer-inject.js')],
  nodePaths: [path.join(HERE, 'node_modules')],
  /* KORDOC_OFFLINE=1 — kordoc 의 «바깥 통신 모두 막기» 스위치. 묶음 안에 인터넷에 닿는 곳은 판독 모델 받기
     한 곳뿐이고(폴더 만들기 대역에서 먼저 멈춘다), 이 스위치로 한 번 더 막는다. 문서는 브라우저 밖으로 안 나간다. */
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.KORDOC_OFFLINE': '"1"', global: 'globalThis' },
  banner: { js: '/* kordoc ' + VERSION + ' (MIT, github.com/chrisryugj/kordoc) — 브라우저 묶음: scripts/kordoc-browser/build.js */' },
  logLevel: 'error'
}).then(() => {
  fs.copyFileSync(path.join(HERE, 'node_modules', 'kordoc', 'LICENSE'), path.join(path.dirname(OUT), 'LICENSE'));
  fs.writeFileSync(path.join(path.dirname(OUT), 'VERSION'), VERSION + '\n');
  console.log('✓ kordoc ' + VERSION + ' → ' + path.relative(process.cwd(), OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + 'KB)');
}).catch(e => { console.error(String(e).slice(0, 3000)); process.exit(1); });
