'use strict';
// 사진첩 외부 예비 길의 지문(SRI) · node --test tests/photos-cdn-sri.test.js
//
// 대표 지시 2026-09-27 「나머지 해라」 — 사진첩 점검 ④
//   외부 서버가 털리면 신분증을 다루는 이 화면에서 남의 코드가 돈다.
//   지문을 달면 브라우저가 한 바이트라도 다른 파일은 «실행하지 않는다».
//
// 이 검사가 지키는 것
//   ①★★ 외부 주소마다 지문이 있다 — 하나라도 빠지면 그 길로 남의 코드가 들어온다
//   ②★★ 지문이 «진짜»다 — 저장소 사본으로 다시 셈해 견준다(인터넷 없이도 잰다)
//   ③★  싣는 세 곳(스크립트·CSS·글자인식)이 모두 지문을 단다
//   ④   지문을 달 때 교차 출처(anonymous)도 단다 — 없으면 맞는 지문이어도 막힌다
//   ⑤   저장소 사본에는 안 단다 — 같은 출처라 필요 없고, 달면 판을 올릴 때마다 막힌다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name) {
  const i = H.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (H[j] === '{') d++; else if (H[j] === '}') { d--; if (!d) { j++; break; } } }
  return H.slice(i, j);
}
const bare = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* 표를 «진짜 코드 그대로» 꺼낸다 */
function table() {
  const m = H.match(/const CDN_SRI = \{[\s\S]*?\n\};/);
  assert.ok(m, 'CDN_SRI 표가 없습니다');
  const b = {};
  vm.createContext(b);
  vm.runInContext(m[0].replace('const CDN_SRI', 'var CDN_SRI'), b);
  return b.CDN_SRI;
}
const SRI = table();
/* 화면이 쓰는 외부 주소 — const 이름_CDN = '...' 과 RRN_OCR_LIB */
const CDNS = {};
H.replace(/const (\w+_CDN|RRN_OCR_LIB) = '([^']+)'/g, (m, n, u) => { CDNS[n] = u; return m; });
const HERES = {};
H.replace(/const (\w+)_HERE = '([^']+)'/g, (m, n, u) => { HERES[n] = u; return m; });
/* pdf.js 가 new Worker 로 여는 일꾼 — 구조상 지문을 못 단다(머리말에 적었다) */
const CANNOT = ['PDF_WORKER_CDN'];

/* ══════════ ① 빠짐없이 ══════════ */

test('★★ 외부 주소마다 지문이 있다', () => {
  const miss = Object.keys(CDNS).filter(n => CANNOT.indexOf(n) < 0 && !SRI[CDNS[n]]);
  assert.deepEqual(miss, [], '지문이 없는 외부 주소: ' + miss.join(', ')
    + ' — 판을 올렸으면 지문도 새로 뽑아 표에 넣으세요');
  assert.ok(Object.keys(CDNS).length >= 9, '외부 주소를 못 읽었습니다 — 검사가 헛돌고 있습니다');
});

test('표에 쓰지 않는 주소가 남아 있지 않다 — 판을 올리고 옛 지문을 두면 헷갈린다', () => {
  const used = new Set(Object.values(CDNS));
  const stale = Object.keys(SRI).filter(u => !used.has(u));
  assert.deepEqual(stale, [], '아무도 안 쓰는 지문: ' + stale.join(', '));
});

test('지문 모양이 맞다 — sha384 에 base64 64자', () => {
  Object.keys(SRI).forEach(u => {
    assert.match(SRI[u], /^sha384-[A-Za-z0-9+/]{64}$/, '모양이 틀렸습니다: ' + u);
  });
});

/* ══════════ ② 진짜인가 — 저장소 사본으로 다시 셈한다 ══════════ */

/* 사본과 외부 파일은 «한 바이트까지 같다»(2026-09-27 확인). 그래서 사본의 지문이 곧 외부의 지문이다.
   ⚠ 윈도 작업 폴더는 git 이 줄 끝을 CRLF 로 바꿔 둘 수 있다 — 되돌려 셈한다(배포되는 것은 LF 원본). */
function sriOfFile(p) {
  let b = fs.readFileSync(path.join(R, p));
  const t = b.toString('latin1');
  if (t.indexOf('\r\n') >= 0) b = Buffer.from(t.replace(/\r\n/g, '\n'), 'latin1');
  return 'sha384-' + crypto.createHash('sha384').update(b).digest('base64');
}

test('★★ 지문이 저장소 사본과 맞는다 — 틀린 지문이면 예비 길이 막힌다', () => {
  let n = 0;
  Object.keys(HERES).forEach(name => {
    const cdn = CDNS[name + '_CDN'];
    if (!cdn || CANNOT.indexOf(name + '_CDN') >= 0) return;
    assert.ok(fs.existsSync(path.join(R, HERES[name])), '사본이 없습니다: ' + HERES[name]);
    assert.equal(SRI[cdn], sriOfFile(HERES[name]),
      name + ' — 표의 지문이 저장소 사본과 다릅니다. 사본을 바꿨으면 지문도, 판을 올렸으면 둘 다 바꾸세요');
    n++;
  });
  assert.ok(n >= 8, '사본으로 잰 것이 ' + n + '개뿐입니다 — 검사가 헛돌고 있습니다');
});

/* ══════════ ③④⑤ 싣는 곳 ══════════ */

test('★ 스크립트·CSS·글자인식 셋 다 싣기 «전»에 지문을 단다', () => {
  [['loadScriptOnce', 's.src'], ['loadCssOnce', 'l.href'], ['rrnOcrLoad', 'sc.src']].forEach(([fn, at]) => {
    const src = bare(grab(fn));
    const put = src.indexOf('sriPut(');
    const set = src.indexOf(at + ' =') >= 0 ? src.indexOf(at + ' =') : src.indexOf(at.split('.')[1] + ' =');
    assert.ok(put >= 0, fn + ' 이 지문을 안 답니다');
    assert.ok(set < 0 || put < set, fn + ' 이 주소를 넣은 «뒤»에 지문을 답니다 — 이미 받기 시작했을 수 있습니다');
  });
});

test('지문을 달 때 교차 출처도 단다 — 없으면 맞는 지문이어도 막힌다', () => {
  const b = { String };
  vm.createContext(b);
  vm.runInContext('var CDN_SRI = ' + JSON.stringify(SRI) + ';\n' + grab('sriOf') + '\n' + grab('sriPut'), b);
  const el = {};
  const u = Object.keys(SRI)[0];
  b.sriPut(el, u);
  assert.equal(el.integrity, SRI[u]);
  assert.equal(el.crossOrigin, 'anonymous');
});

test('저장소 사본에는 지문을 안 단다 — 같은 출처라 필요 없다', () => {
  const b = { String };
  vm.createContext(b);
  vm.runInContext('var CDN_SRI = ' + JSON.stringify(SRI) + ';\n' + grab('sriOf') + '\n' + grab('sriPut'), b);
  Object.values(HERES).forEach(p => {
    const el = {};
    b.sriPut(el, p);
    assert.equal(el.integrity, undefined, '사본에 지문을 달았습니다: ' + p);
  });
});

test('글자인식 도구(신분증 원본을 읽는 것)에 지문이 있다', () => {
  assert.ok(CDNS.RRN_OCR_LIB, 'RRN_OCR_LIB 를 못 찾았습니다');
  assert.ok(SRI[CDNS.RRN_OCR_LIB], '글자인식 도구에 지문이 없습니다 — 그 도구가 가리기 «전» 원본을 받습니다');
});
