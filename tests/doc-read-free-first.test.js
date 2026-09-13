'use strict';
/* 무료 먼저 — «서버»가 사진 대신 글자를 AI 에 넘긴다.
   실행: node --test tests/*.test.js

   대표 지시 2026-09-13
     ①「무료버전 먼저 사용하게 안 되나?」
     ②「사진첩·기업정보함 켜라」
     ③ 켜는 길 셋 가운데 **㉰ 서버가 맡는다** 를 고르셨다.

   ── 왜 서버인가 ────────────────────────────────────────────────
   부르는 층이 «둘»이다 — 판독 층(js/pu-doc-read.js, 148KB)은 사진첩·경력관리·
   푸른이알피가 쓰고, 얇은 층(js/pu-ai-call.js, 4KB)은 기업정보함·뉴스레터·
   업무관리가 쓴다. 브라우저에서 하면 같은 규칙이 «두 벌»이 되어 한쪽만 고쳐진다.
   서버는 모두가 지나는 문이라 한 번에 덮이고, 오가는 걸음도 하나 준다.
   ⚠ 그래서 2026-09-13 에 브라우저 쪽 같은 코드를 «걷어냈다». 다시 만들지 말 것.

   ── 이 검사가 못 박는 것 ──────────────────────────────────────────
     ① 표가 «뜻»인 서류는 사진 그대로 보낸다 (통장·급여명세서·근로계약서…)
     ② 줄글 서류는 글자로 바꾼다 (빗장이 너무 넓으면 아끼는 뜻이 없다)
     ③ 글자가 충분할 때만 바꾼다 · 물음(프롬프트)은 살린다
     ④ 무료가 넘어지면 «사진 그대로» 간다 — 판독을 세우지 않는다
     ⑤ 몫이 모자라면 부르지 않는다 (「0원」이라는 말이 거짓이 되면 안 된다)
     ⑥ 브라우저 쪽에 같은 것을 다시 만들지 않았다                                    */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const DR = require(path.join(R, 'functions', 'doc-read.js'));
const IDX = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const BROWSER = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8').replace(/\r\n/g, '\n');

const 사진 = (d) => ({ inline_data: { mime_type: 'image/jpeg', data: d || 'AAAA' } });
const 길게 = (s) => s + 'ㄱ'.repeat(DR.FREE_MIN_CHARS_PER_IMG + 50);

/* exports.이름 = ... 한 덩이를 떠 온다 */
function cutExport(src, name) {
  const at = src.indexOf('exports.' + name);
  assert.ok(at > 0, name + ' 을 못 찾았습니다');
  const end = src.indexOf('\nexports.', at + 1);
  return src.slice(at, end > at ? end : at + 12000);
}

/* ══════ ① 표가 뜻인 서류 ══════ */

test('★★ 돈이 걸린 서류는 «표가 뜻»으로 본다 — 글자로 바꾸면 안 된다', () => {
  /* 검사고정-허용: 아래는 «무엇이 위험한가»의 목록이지 지금 값이 아니다.
     이 서류들이 빠지면 그날로 틀린 값이 나간다. */
  [['통장 사본 예금거래 내역', '통장 — 계좌 한 자리가 틀리면 딴 데로 돈이 간다'],
   ['2026년 9월 급여명세서', '급여명세서 — 항목과 금액이 어긋난다'],
   ['임금대장', '임금대장'],
   ['표준 근로계약서', '근로계약서 — 근로시간·임금 칸이 섞인다'],
   ['원천징수영수증', '원천징수'],
   ['4대보험 사업장 가입자명부', '4대보험'],
   ['계좌번호 110-123-456789', '계좌번호']
  ].forEach(function (p) {
    assert.equal(DR.tableLike(p[0]), true, '★★ ' + p[1]);
  });
});

test('★★ 줄글 서류는 글자로 바꾼다 — 빗장이 너무 넓으면 아끼는 뜻이 없다', () => {
  ['공인노무사 자격증', '위촉장 — 귀하를 위원으로 위촉합니다', '표창장',
   '수료증 교육과정을 이수하였음', '졸업증명서', '경력증명서'
  ].forEach(function (t) {
    assert.equal(DR.tableLike(t), false, '★★ 「' + t + '」까지 사진으로 보냅니다');
  });
});

test('★★ 공백을 걷고 본다 — 판독기가 「급 여 명 세 서」로 띄워 온다', () => {
  assert.equal(DR.tableLike('급 여 명 세 서'), true,
    '★★ 띄어 온 글자를 못 알아봅니다 — 괘선·도장 때문에 흔히 그렇게 읽힙니다');
  assert.equal(DR.tableLike('통\n장\n사\n본'), true);
  assert.equal(DR.tableLike(''), false, '빈 글자를 위험하다 하면 «전부» 사진으로 갑니다');
  assert.equal(DR.tableLike(null), false);
  assert.ok(DR.TABLE_DOC_WORDS.length >= 10,
    '★★ 위험한 서류 목록이 ' + DR.TABLE_DOC_WORDS.length + '개뿐입니다');
});

/* ══════ ②③ 바꾸는 판단 ══════ */

test('★★ 표가 뜻인 서류면 «사진 그대로»(null) 준다', () => {
  assert.equal(DR.slimParts([{ text: '읽어라' }, 사진()], 길게('급여명세서 ')), null,
    '★★ 급여명세서를 글자로 바꿨습니다');
});

test('★★ 글자가 모자라면 «사진 그대로» 준다 — 흐린 사진을 못 읽게 된다', () => {
  assert.equal(DR.slimParts([{ text: '읽어라' }, 사진()], '짧다'), null);
  assert.equal(DR.slimParts([{ text: '읽어라' }, 사진()], ''), null);
});

test('★★ 사진 «장 수»만큼 글자가 있어야 한다 — 열 장에 한 장 분량이면 안 된다', () => {
  const 한장분 = 'ㄱ'.repeat(DR.FREE_MIN_CHARS_PER_IMG + 10);
  assert.ok(DR.slimParts([{ text: 'p' }, 사진('A')], 한장분), '한 장이면 통과해야 합니다');
  assert.equal(DR.slimParts([{ text: 'p' }, 사진('A'), 사진('B'), 사진('C')], 한장분), null,
    '★★ 석 장인데 한 장 분량 글자로 바꿨습니다');
});

test('★★ 물음(프롬프트)은 살려서 보낸다 — 사라지면 AI 가 무엇을 할지 모른다', () => {
  const out = DR.slimParts([{ text: '이 서류를 읽어라' }, 사진()], 길게('자격증 '));
  assert.ok(Array.isArray(out), '바꿔야 하는데 안 바꿨습니다');
  assert.ok(out.some(function (p) { return String(p.text || '').indexOf('이 서류를 읽어라') >= 0; }),
    '★★ 물음이 사라졌습니다');
  assert.ok(out.some(function (p) { return String(p.text || '').indexOf('자격증') >= 0; }),
    '★★ 뽑은 글자를 안 보냅니다');
  assert.equal(out.filter(function (p) { return p.inline_data; }).length, 0,
    '★★ 사진을 그대로 또 보냅니다 — 값이 안 내려갑니다');
});

test('★ 사진이 없으면 아무 일도 안 한다', () => {
  assert.equal(DR.slimParts([{ text: '이미 글자뿐' }], 길게('자격증 ')), null);
  assert.deepEqual(DR.imagesOf([{ text: 'x' }]), []);
  assert.deepEqual(DR.imagesOf([{ text: 'x' }, 사진('Z')]), ['Z']);
});

/* ══════ ④⑤ 서버가 어떻게 쓰나 ══════ */

test('★★ 무료가 넘어지면 «사진 그대로» 간다 — 판독을 세우지 않는다', () => {
  const fn = cutFn(IDX, 'async function freeFirstSlim(parts, app)');
  assert.match(fn, /try \{/, '★★ 넘어짐을 안 받습니다 — 무료가 죽으면 판독이 통째로 죽습니다');
  assert.match(fn, /catch \(e\) \{[^]*return null;/,
    '★★ 넘어졌을 때 null(=사진 그대로)을 안 줍니다');
  /* 부르는 쪽이 null 을 「사진 그대로」로 다뤄야 한다 */
  const doc = cutExport(IDX, 'readDoc');
  assert.match(doc, /let parts = v\.parts;/, '★ 원래 것을 기본으로 두어야 합니다');
  assert.match(doc, /if \(줄인것\) parts = 줄인것;/,
    '★★ 바꿀 것이 없을 때도 덮어씁니다 — 사진이 사라집니다');
});

test('★★ Vision 몫이 모자라면 부르지 않는다 — 「0원」이 거짓이 되면 안 된다', () => {
  const fn = cutFn(IDX, 'async function freeFirstSlim(parts, app)');
  assert.match(fn, /visionMonthLeft\(\)/, '★★ 몫을 안 봅니다');
  assert.match(fn, /남은것\.left < imgs\.length/, '★★ 장 수와 견주지 않습니다');
  assert.match(fn, /bumpReadTally\([^)]*vision/, '★★ 쓴 만큼 안 셉니다 — 다음 판단이 틀립니다');
  assert.match(fn, /r\.pages/, '★ Vision 은 «장 수»로 값을 받습니다 — 1 씩 더하면 셈이 틀립니다');
});

test('★★ readDoc 이 VISION_KEY 를 함께 받는다 — 없으면 늘 조용히 넘어진다', () => {
  const at = IDX.indexOf('exports.readDoc');
  const 머리 = IDX.slice(at, at + 600);
  assert.match(머리, /secrets:\s*\[[^\]]*VISION_KEY/,
    '★★ 무료 글자 뽑기가 «늘» 넘어져 옛날처럼 사진만 보냅니다 — 값은 그대로인데 아낀 줄 압니다');
});

test('★ 화면이 «끌» 수 있다 — 표가 뜻인 화면을 위한 길', () => {
  const doc = cutExport(IDX, 'readDoc');
  assert.match(doc, /body\.freeFirst !== false/,
    '★ 끄는 길이 없습니다 — 표가 뜻인 화면이 스스로 물러설 수 없습니다');
  assert.match(BROWSER, /freeFirst: !\(opts && opts\.freeFirst === false\)/,
    '★ 판독 층이 그 뜻을 서버에 안 전합니다');
});

/* ══════ ⑥ 브라우저에 두 벌로 만들지 않았다 ══════ */

test('★★ 브라우저 쪽에 같은 것을 다시 만들지 않았다 — 두 벌이면 한쪽만 고쳐진다', () => {
  const bare = BROWSER.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  ['slimByVision', 'TABLE_DOC_WORDS', 'FREE_MIN_CHARS_PER_IMG'].forEach(function (w) {
    assert.equal(bare.indexOf(w), -1,
      '★★ 브라우저에 「' + w + '」가 되살아났습니다 — 판단은 서버 한 곳입니다');
  });
  /* 판독 문은 바로 서버로 가야 한다 */
  const fn = cutFn(BROWSER, 'function askProxy(parts, opts)');
  assert.match(fn, /askProxyNet\(parts, opts\)/, '★★ 판독 문이 서버로 바로 안 갑니다');
});

test('판독 층을 고쳤으니 «부르는 화면 전부»의 캐시 번호가 올라가 있다', () => {
  const 화면 = fs.readdirSync(R).filter(function (n) { return /\.html$/.test(n); })
    .map(function (n) {
      const m = fs.readFileSync(path.join(R, n), 'utf8').match(/js\/pu-doc-read\.js\?v=(\d+)/);
      return m ? { n: n, v: Number(m[1]) } : null;
    }).filter(Boolean);
  assert.ok(화면.length >= 5, '★ 판독 층을 부르는 화면이 ' + 화면.length + '개뿐입니다');
  화면.forEach(function (f) {
    assert.ok(f.v >= 44,   // 검사고정-허용: 이 변경이 들어간 판
      '★★ ' + f.n + ' 의 캐시 번호가 ' + f.v + ' 입니다 — 그 화면만 옛 판독 층을 씁니다');
  });
});
