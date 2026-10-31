// 「새 사이트에 올리기」가 깃허브에 «한 번만 감싼» JSON 을 보내는지 — 실제 두 부품을 맞물려 돌린다.
// ★ 2026-10-31 대표가 「새 사이트에 올리기」를 누르자 「GitHub 400: Body should be a JSON object」.
//   site-publish.js 의 올리기가 몸통을 JSON 글자로 만들어 넘기고, githubRequest(dev-automation.js)가
//   그것을 «또» JSON 으로 감쌌다 — 깃허브는 객체 대신 글자 하나를 받았다.
//   두 부품을 따로 보면 둘 다 멀쩡해 보여서, 맞물린 채로 돌려 봐야 잡힌다.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { githubRequest } = require('./dev-automation');
const { 올리기 } = require('./site-publish');

function 가짜깃허브(받은것) {
  return async (url, opt) => {
    받은것.push({ url, method: opt.method, body: opt.body });
    const 읽기 = opt.method === 'GET';
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(읽기 ? { sha: 'abc123' } : { commit: { sha: 'def4567890' } })
    };
  };
}

test('★ 올리는 몸통이 깃허브에 «객체» JSON 으로 간다 (두 번 감싸지 않는다)', async (t) => {
  const 받은것 = [];
  const 원래 = global.fetch;
  global.fetch = 가짜깃허브(받은것);
  t.after(() => { global.fetch = 원래; });

  const 답 = await 올리기(githubRequest, 'test-token', 'owner/repo', 'people/index.html',
    '<p>안녕</p>', '올림', false);

  const 쓰기 = 받은것.find(x => x.method === 'PUT');
  assert.ok(쓰기, '★ 쓰기 요청이 안 나갔다');
  const 몸 = JSON.parse(쓰기.body);
  assert.strictEqual(typeof 몸, 'object', '★ 몸통이 글자로 감싸여 갔다 — 깃허브가 400 으로 거절한다');
  assert.strictEqual(몸.message, '올림');
  assert.strictEqual(Buffer.from(몸.content, 'base64').toString('utf8'), '<p>안녕</p>');
  assert.strictEqual(몸.sha, 'abc123', '★ 지금 파일의 sha 를 함께 보내야 갈아 끼울 수 있다');
  assert.strictEqual(답.commit.sha, 'def4567890');
});

test('★ 그림(base64)은 다시 감싸지 않고 그대로 간다', async (t) => {
  const 받은것 = [];
  const 원래 = global.fetch;
  global.fetch = 가짜깃허브(받은것);
  t.after(() => { global.fetch = 원래; });

  await 올리기(githubRequest, 'test-token', 'owner/repo', 'files/logo/a.png', 'iVBORw0KGgo=', '로고', true);
  const 몸 = JSON.parse(받은것.find(x => x.method === 'PUT').body);
  assert.strictEqual(몸.content, 'iVBORw0KGgo=');
});
