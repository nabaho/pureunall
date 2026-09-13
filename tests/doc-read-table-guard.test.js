'use strict';
/* 무료 먼저 — «표가 뜻인 서류»는 글자로 바꾸지 않는다.
   실행: node --test tests/*.test.js

   대표 지시 2026-09-13: 「사진첩·기업정보함 켜라」

   ── 왜 이 빗장이 필요한가 ─────────────────────────────────────────
   경력관리는 읽는 서류가 정해져 있다(자격증·학력·위촉장…) — 전부 줄글이라 켜도 됐다.
   그런데 **사진첩은 판독 «전»에 서류 종류를 모른다.** 종류를 알아내는 것이 판독이다.
   통장·급여명세서가 섞여 들어오는데 그냥 켜면 «칸의 자리»가 풀려
     · 통장 — 계좌 한 자리가 틀리면 딴 데로 돈이 간다
     · 급여명세서 — 항목과 금액이 어긋나 엉뚱한 수당이 붙는다
   그래서 **무료로 뽑은 글자를 보고 먼저 가린다.** 글자 뽑기는 무료라 값이 안 든다.

   ── 이 검사가 못 박는 것 ──────────────────────────────────────────
     ① 표가 뜻인 서류는 «사진 그대로» 보낸다
     ② 줄글 서류는 글자로 바꾼다 (빗장이 너무 넓으면 아끼는 뜻이 없다)
     ③ 공백을 걷고 본다 (판독기가 「급 여 명 세 서」로 띄워 온다)
     ④ 위험한 서류가 목록에 빠지지 않았다
     ⑤ 사진첩이 실제로 켜 두었다                                                     */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');

function load(){
  const sandbox = { window: {}, console: console, setTimeout: setTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(src, { filename: 'pu-doc-read.js' }).runInContext(sandbox);
  return sandbox.window.PuDocRead;
}

/* ══════ ①④ 표가 뜻인 서류 ══════ */

test('★★ 돈이 걸린 서류는 «표가 뜻»으로 본다 — 글자로 바꾸면 안 된다', () => {
  const M = load();
  /* 값이 곧 규칙인 자리다 — 이 서류들이 목록에서 빠지면 그날로 틀린 값이 나간다.
     검사고정-허용: 아래는 «무엇이 위험한가»의 목록이지 지금 값이 아니다. */
  [['통장 사본 예금거래 내역', '통장'],
   ['2026년 9월 급여명세서', '급여명세서'],
   ['임금대장', '임금대장'],
   ['표준 근로계약서', '근로계약서'],
   ['원천징수영수증', '원천징수'],
   ['4대보험 사업장 가입자명부', '4대보험'],
   ['계좌번호 110-123-456789', '계좌번호']
  ].forEach(function (p) {
    assert.equal(M.tableLike(p[0]), true,
      '★★ 「' + p[1] + '」를 줄글로 봅니다 — 글자로 보내면 칸이 풀려 값이 어긋납니다');
  });
});

test('★★ 줄글 서류는 글자로 바꾼다 — 빗장이 너무 넓으면 아끼는 뜻이 없다', () => {
  const M = load();
  ['공인노무사 자격증', '위촉장 — 귀하를 위원으로 위촉합니다', '표창장',
   '수료증 교육과정을 이수하였음', '졸업증명서', '경력증명서'
  ].forEach(function (t) {
    assert.equal(M.tableLike(t), false,
      '★★ 「' + t + '」까지 사진으로 보냅니다 — 아끼는 뜻이 사라집니다');
  });
});

test('★★ 공백을 걷고 본다 — 판독기가 「급 여 명 세 서」로 띄워 온다', () => {
  const M = load();
  assert.equal(M.tableLike('급 여 명 세 서'), true,
    '★★ 띄어 온 글자를 못 알아봅니다 — 판독기는 괘선·도장 때문에 흔히 그렇게 읽습니다');
  assert.equal(M.tableLike('통\n장\n사\n본'), true, '줄바꿈으로 갈라져 와도 알아봐야 합니다');
});

test('★ 목록이 통째로 비지 않았다', () => {
  const M = load();
  assert.ok(Array.isArray(M.TABLE_DOC_WORDS) && M.TABLE_DOC_WORDS.length >= 10,
    '★★ 위험한 서류 목록이 ' + (M.TABLE_DOC_WORDS || []).length + '개뿐입니다');
  assert.equal(M.tableLike(''), false, '빈 글자를 위험하다고 하면 «전부» 사진으로 갑니다');
  assert.equal(M.tableLike(null), false);
});

/* ══════ 무료 길에 실제로 걸려 있나 ══════ */

test('★★ 무료 길이 그 빗장을 «실제로» 지난다', async () => {
  const M = load();
  const 길게 = function (s) { return s + 'ㄱ'.repeat(M.FREE_MIN_CHARS_PER_IMG + 50); };
  function 꾸민다(text) {
    M.init({
      fetch: function () {
        return Promise.resolve({ ok: true, status: 200,
          json: function () { return Promise.resolve({ ok: true, text: text }); } });
      },
      getToken: function () { return Promise.resolve('t'); },
      readDocUrl: 'https://x/readDoc'
    });
  }
  const parts = [{ text: '읽어라' }, { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } }];

  꾸민다(길게('급여명세서 '));
  const 표 = await M._slimByVisionForTest(parts, { freeFirst: true });
  assert.equal(표, parts,
    '★★ 급여명세서를 글자로 바꿔 보냈습니다 — 항목과 금액이 어긋납니다');

  꾸민다(길게('공인노무사 자격증 '));
  const 줄글 = await M._slimByVisionForTest(parts, { freeFirst: true });
  assert.notEqual(줄글, parts, '★★ 줄글 서류까지 사진으로 보냅니다 — 아끼는 뜻이 없습니다');
  assert.equal(줄글.filter(function (p) { return p.inline_data; }).length, 0,
    '★ 사진이 그대로 남아 있습니다');
});

/* ══════ ⑤ 켠 화면 ══════ */

test('★★ 사진첩이 실제로 켜 두었다 — 길만 만들고 아무도 안 쓰면 뜻이 없다', () => {
  const ph = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
  assert.match(ph, /freeFirst:\s*true/,
    '★★ 사진첩이 안 켰습니다');
  /* 여러 장·한 장 두 갈래가 다 켜져 있어야 한다 — 한쪽만 켜면 그 길만 비싸다 */
  const 켠곳 = (ph.match(/freeFirst:\s*true/g) || []).length;
  assert.ok(켠곳 >= 2,
    '★ 켠 자리가 ' + 켠곳 + '군데뿐입니다 — 여러 장 길과 한 장 길이 둘 다 있어야 합니다');
});

test('판독 층을 고쳤으니 «부르는 화면 전부»의 캐시 번호가 올라가 있다', () => {
  const 화면 = fs.readdirSync(R).filter(function (n) { return /\.html$/.test(n); })
    .map(function (n) {
      const m = fs.readFileSync(path.join(R, n), 'utf8').match(/js\/pu-doc-read\.js\?v=(\d+)/);
      return m ? { n: n, v: Number(m[1]) } : null;
    }).filter(Boolean);
  assert.ok(화면.length >= 5, '★ 판독 층을 부르는 화면이 ' + 화면.length + '개뿐입니다');
  화면.forEach(function (f) {
    assert.ok(f.v >= 43,   // 검사고정-허용: 이 변경이 들어간 판
      '★★ ' + f.n + ' 의 캐시 번호가 ' + f.v + ' 입니다 — 그 화면만 옛 판독 층을 씁니다');
  });
});
