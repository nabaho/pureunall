'use strict';
/* .mcp.json — 열쇠가 «적히지» 않는다 (2026-10-03 MCP 일곱 개 연결)
   ─────────────────────────────────────────────────────────────────────────
   대표 지시: 「이거 모두 찾아서 연결시켜 줄 수 있나 · 클로드팀의 다른 사람들에게도」
   법령·문서·통계·건축·특허·공시 여섯을 (학교는 10-03 뺐다) 이 파일 하나에 둔다 — 저장소를 받는
   사람은 누구나 같은 연결을 갖는다(그것이 «팀에 공유»다).

   ⚠ 그래서 이 파일은 «모두가 본다». 저장소가 공개이기도 하다.
     열쇠(LAW_OC·DART_API_KEY 등)를 값으로 적는 순간 세상에 나간다.
     → 환경변수 값은 반드시 ${…} 꼴이어야 한다. 그 밖의 글자는 열쇠로 본다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 환경변수 값은 전부 ${…} — 날것 열쇠가 하나도 없다
     ② 원격 주소에 열쇠를 붙이지 않는다(?oc=·?key=·?serviceKey= 같은 꼴)
     ③ 원격은 https 만
     ④ 모든 서버가 type 을 갖는다 — 없으면 클라이언트가 어림잡다 틀린다
     ⑤ npx 로 받는 꾸러미는 판(@x.y.z)을 고정한다 (2026-10-03 「학교 빼고 모두」)
        판 없는 npx 는 켤 때마다 새로 받다 캐시가 깨져 법령이 안 켜졌다(ENOTEMPTY).
        남의 새 판이 말없이 들어오는 길도 막힌다.
     ⑥ 학교(schoolinfo)는 대표가 뺐다 — 다시 들어오지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.mcp.json'), 'utf8'));
const S = conf.mcpServers || {};

test('①★★ 환경변수 값은 전부 ${…} — 날것 열쇠가 없다', () => {
  const 날것 = [];
  Object.keys(S).forEach(n => {
    Object.entries(S[n].env || {}).forEach(([k, v]) => {
      if (!/^\$\{[A-Z0-9_]+(:-[^}]*)?\}$/.test(String(v)) && !/^[01]$/.test(String(v))) 날것.push(n + '.' + k + '=' + v);
    });
  });
  assert.deepEqual(날것, [],
    '★★ 열쇠가 값으로 적혀 있다: ' + 날것.join(', ') + '\n' +
    '  이 파일은 모두가 보고 저장소는 공개다 — ${이름} 으로 환경변수에서 읽게 하라');
});

test('②★★ 원격 주소에 열쇠를 붙이지 않는다', () => {
  const 붙은것 = Object.keys(S).filter(n => S[n].url &&
    /[?&](oc|key|apikey|api_key|servicekey|token|crtfc_key)=/i.test(S[n].url));
  assert.deepEqual(붙은것, [], '★★ 주소에 열쇠가 붙었다: ' + 붙은것.join(', ') +
    ' — 법령 원격은 ?oc= 를 받지만, 붙이면 그 열쇠가 저장소에 남는다');
});

test('③ 원격은 https 만', () => {
  Object.keys(S).filter(n => S[n].url).forEach(n => {
    assert.match(S[n].url, /^https:\/\//, '★ ' + n + ' 이 https 가 아니다 — 오가는 질문이 그대로 보인다');
  });
});

test('④ 모든 서버가 type 을 갖는다', () => {
  Object.keys(S).forEach(n => {
    assert.ok(['http', 'stdio', 'sse'].includes(S[n].type), '★ ' + n + ' 에 type 이 없다');
    if (S[n].type === 'stdio') assert.ok(S[n].command, '★ ' + n + ' 에 command 가 없다');
  });
});

test('⑤ npx 꾸러미는 판을 고정한다', () => {
  const 안고정 = Object.keys(S).filter(n => S[n].command === 'npx').filter(n => {
    const 꾸러미 = (S[n].args || []).filter(a => !a.startsWith('-'))[0] || '';
    return !/^(@[^/]+\/)?[^@]+@\d+\.\d+\.\d+$/.test(꾸러미);
  });
  assert.deepEqual(안고정, [], '★ 판 없는 npx: ' + 안고정.join(', ') +
    ' — 켤 때마다 새로 받다 캐시가 깨진다. 이름@x.y.z 로 적어라');
});

test('⑥ 학교 MCP 는 뺐다 (대표 지시)', () => {
  const 학교 = Object.keys(S).filter(n => /school/i.test(n) || /\/school\b/.test(S[n].url || ''));
  assert.deepEqual(학교, [], '★ 대표가 「학교 빼고」라 했다: ' + 학교.join(', '));
});
