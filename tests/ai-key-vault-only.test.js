/* Gemini 열쇠는 «금고(GEMINI_KEY)» 하나뿐 — 대표 지시 2026-11-05 「유료 API 통제 2단계」
   실시간DB 의 열쇠 자리(pucards/config/geminiKey · data/app_config/geminiKey)는 규칙상
   로그인한 직원 모두가 읽는다. 판독이 유료 등급이 된 뒤로 거기 열쇠가 있으면 누구든
   꺼내 회사 한도 밖에서 쓸 수 있었다 — 그 갈래를 걷었다.
   ⚠ 걷은 대가: 금고를 runWith 에 안 건 함수는 「키 없음」으로 멎는다.
     그래서 «열쇠를 부르는 모든 서버 함수가 금고를 거는가»를 실제로 따라가며 본다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const IDX = stripJs(fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8'));

/* 맨 왼쪽에서 시작하는 선언마다 덩어리로 나눈다 */
function chunks(src) {
  const lines = src.split('\n');
  const out = [];
  let cur = null;
  lines.forEach(function (ln) {
    const m = /^(?:exports\.(\w+)\s*=|(?:async\s+)?function\s+([^\s(]+)|(?:const|let|var)\s+([^\s=]+)\s*=)/.exec(ln);
    if (m) {
      cur = { name: m[1] || m[2] || m[3], isExport: !!m[1], body: '' };
      out.push(cur);
    }
    if (cur) cur.body += ln + '\n';
  });
  return out;
}

test('★ readGeminiKey 는 실시간DB 를 읽지 않는다 — 금고 하나뿐', () => {
  const c = chunks(IDX).find(function (x) { return x.name === 'readGeminiKey'; });
  assert.ok(c, 'readGeminiKey 를 못 찾았습니다');
  assert.match(c.body, /process\.env\.GEMINI_KEY/);
  assert.doesNotMatch(c.body, /\.ref\(|geminiKey|getDatabase/,
    '★ 실시간DB 열쇠 자리를 다시 읽습니다 — 그 자리는 직원 모두가 읽습니다');
});

test('★ 열쇠를 쓰는 서버 함수는 모두 runWith secrets 에 GEMINI_KEY 를 건다', () => {
  const all = chunks(IDX);
  /* 열쇠를 «닿게 하는» 이름들을 끝까지 따라간다(도우미 → 도우미를 부르는 도우미 …) */
  const reach = new Set(['readGeminiKey']);
  let grew = true;
  while (grew) {
    grew = false;
    all.forEach(function (c) {
      if (c.isExport || reach.has(c.name)) return;
      const body = c.body.split('\n').slice(1).join('\n');
      for (const n of reach) {
        if (new RegExp('(^|[^\\w$])' + n.replace(/[$]/g, '\\$') + '([^\\w$]|$)').test(body)) {
          reach.add(c.name); grew = true; break;
        }
      }
    });
  }
  const users = all.filter(function (c) {
    if (!c.isExport) return false;
    for (const n of reach) {
      if (new RegExp('(^|[^\\w$])' + n.replace(/[$]/g, '\\$') + '([^\\w$]|$)').test(c.body)) return true;
    }
    return false;
  });
  assert.ok(users.length >= 3, '열쇠를 쓰는 함수를 거의 못 찾았습니다 — 따라가기가 고장났습니다: ' + users.map(u => u.name));
  const bad = users.filter(function (c) {
    const rw = /\.runWith\(\s*\{[^]*?\}\s*\)/.exec(c.body);
    return !rw || !/secrets\s*:\s*\[[^\]]*["']GEMINI_KEY["']/.test(rw[0]);
  }).map(function (c) { return c.name; });
  assert.deepStrictEqual(bad, [],
    '★ 이 함수들은 열쇠를 쓰는데 금고를 안 겁니다 — 배포하면 「AI 키 없음」으로 멎습니다: ' + bad.join(', '));
});

test('★ 포털 설정에 Gemini 키 칸이 없다 — 직원 모두가 읽는 자리에 다시 넣지 못하게', () => {
  const html = fs.readFileSync(path.join(R, 'enter.html'), 'utf8');
  const m = /var CFG_FIELDS = (\[[^\n]*\]);/.exec(html);
  assert.ok(m, 'CFG_FIELDS 를 못 찾았습니다');
  assert.doesNotMatch(m[1], /geminiKey/);
  assert.doesNotMatch(stripJs(html), /id="cfgGemini"/);
});
