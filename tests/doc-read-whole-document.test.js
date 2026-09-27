/* 여러 쪽짜리 문서는 통째로 한 번 읽는다 — 대표 결정 2026-08-10
   "계약서는 어떻게 ocr 처리해야하나" → 「문서 통째로 한 번」

   계약서는 보수가 2조, 계약기간이 6조, 서명·날인이 마지막 쪽에 흩어져 있다.
   쪽마다 따로 읽으면 아무도 문서 전체를 못 봐서 조문만 있는 2쪽 이후가 죄다
   빈칸으로 돌아온다. AI 호출도 쪽수만큼 든다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'pu-doc-read.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'pu-photos.html'), 'utf8');
/* ⚠ readPhoto 는 **인자가 늘 수 있다**(2026-08-17: 가린 사본을 받는 자리가 붙었다).
   `function readPhoto\(id\)` 로 붙잡아 두었더니 그때 깨졌다 — 뜻은 그대로였는데도다.
   이름으로 찾고 중괄호 짝으로 자른다. */
const { cutFn } = require('./cut-fn');
const readPhotoFn = () => cutFn(app, 'function readPhoto(');

/* 판독기를 실제로 돌려 **AI 에 무엇을 보내는지** 들여다본다.
   글자 모양만 보면 그림을 한 장만 실어 보내도 통과한다. */
function sent(input) {
  let body = null;
  /* ⚠ 이 모듈은 window 가 있으면 거기에 붙는다 — ctx.PuDocRead 가 아니라
     ctx.window.PuDocRead 다(끝줄의 `typeof window !== 'undefined' ? window : globalThis`). */
  const ctx = { window: {}, console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const R = ctx.window.PuDocRead;
  R.init({
    fetch: function (url, init) {
      body = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            candidates: [{ content: { parts: [{ text: '{"kind":"contract"}' }] } }]
          });
        }
      });
    },
    getKey: function () { return 'KEY'; },
    delay: function (f) { f(); }
  });
  return R.read(input).then(function () { return body; });
}

const one = 'data:image/jpeg;base64,AAAA';
const two = 'data:image/jpeg;base64,BBBB';
const three = 'data:image/jpeg;base64,CCCC';

function images(body) {
  return body.contents[0].parts.filter(function (p) { return p.inline_data; });
}
function text(body) {
  return body.contents[0].parts.filter(function (p) { return p.text; })
    .map(function (p) { return p.text; }).join('');
}

test('★ 여러 쪽을 한 번의 요청에 함께 싣는다', async () => {
  const body = await sent([one, two, three]);
  assert.equal(images(body).length, 3,
    '쪽을 다 안 실으면 2조의 보수와 6조의 기간을 함께 볼 수 없습니다.');
});

test('★ 쪽 차례가 뒤바뀌지 않는다', async () => {
  const body = await sent([one, two, three]);
  const got = images(body).map(function (p) { return p.inline_data.data; });
  assert.deepEqual(got, ['AAAA', 'BBBB', 'CCCC'],
    '차례가 섞이면 「1쪽·2쪽」을 가리키는 조문을 잘못 읽습니다.');
});

/* ⚠ 2026-09-12 — 규칙이 «넓어졌다». 예전에는 「쪽마다 따로 답하지 말고 한 벌만」이었는데,
     한 묶음에 서로 다른 서류가 들어 있는 일이 흔해서(1쪽 계약서 + 2쪽 자동이체)
     **서류마다 한 벌**로 바꿨다. 지킬 것은 그대로다 —
     ① 한 묶음임을 알려 준다 ② «한 서류가 여러 쪽»이면 반드시 합쳐 읽는다. */
test('★ 한 묶음의 여러 쪽임을 말해 준다 — 안 그러면 쪽마다 제멋대로 답한다', async () => {
  const body = await sent([one, two]);
  const t = text(body);
  assert.ok(/여러 쪽/.test(t), '무엇을 보낸 것인지 안 알려 줍니다.');
  assert.ok(/쪽 순서대로/.test(t), '차례를 안 알려 주면 「1쪽·2쪽」을 잘못 가리킵니다.');
  /* ⚠ 「합쳐」라는 낱말 하나를 가까이서 찾지 않는다 — 말이 조금만 달라져도 깨진다.
     지킬 것은 «한 서류면 한 덩이로 읽으라»는 뜻이 있는가다(2026-09-12 에 말을 다듬으며 깨졌다). */
  assert.ok(/한 서류[\s\S]{0,200}(합치|한 칸)/.test(t),
    '★★ 「한 서류가 여러 쪽이면 한 덩이로 읽으라」가 빠지면 계약서 2쪽 이후가 죄다 빈칸이 됩니다.');
});

test('★ 한 장짜리에는 그 말을 안 붙인다', async () => {
  /* 한 장인데 「여러 쪽」이라고 하면 AI 가 없는 쪽을 지어낸다. */
  const body = await sent(one);
  assert.equal(images(body).length, 1);
  assert.ok(!/한 문서의 여러 쪽/.test(text(body)), '한 장인데 여러 쪽이라고 말합니다.');
});

test('빈 것이 섞여 있어도 있는 쪽으로 읽는다', async () => {
  const body = await sent([one, '', two]);
  assert.equal(images(body).length, 2, '못 받은 쪽 때문에 판독 전체가 멎으면 안 됩니다.');
});

/* ── 화면 쪽 ── */
test('★ 격자에서도 형제 쪽을 모아 한 번에 읽는다', () => {
  /* ⚠ 격자용(docPages)과 올리는 중용(docJobs) **둘 다** 본다. 하나만 보면
     다른 하나에서 차례가 무너져도 검사가 통과한다(실제로 그랬다). */
  ['docPages\\(id\\)', 'docJobs\\(job\\)'].forEach(function (name) {
    const fn = app.match(new RegExp('function ' + name + '[\\s\\S]*?\\n\\}'));
    assert.ok(fn, name + ' 를 찾지 못했습니다.');
    assert.ok(/doc\.group === g/.test(fn[0]), name + ' 이 묶음 번호로 모으지 않습니다.');
    assert.ok(/\.sort\(/.test(fn[0]) && /doc\.page/.test(fn[0]),
      name + ' 이 쪽 차례로 안 세웁니다 — 섞이면 조문을 잘못 읽습니다.');
  });
  const read = [readPhotoFn()];
  assert.ok(/docPages\(id\)/.test(read[0]), 'readPhoto 가 형제 쪽을 안 모읍니다.');
  /* ⚠ 2026-08-24: 쪽이 많으면 덩이로 나눠 읽으므로 「한 장이면 배열로 안 싼다」는
     규칙이 덩이를 만드는 층으로 옮겼다. 지킬 것은 그 규칙이지 적힌 자리가 아니다. */
  /* ⚠ 인자 개수는 안 박는다 — 2026-09-10 에 「사람이 눌렀나」가 하나 더 붙었다 */
  assert.ok(/imgChunkMakers\(imgs[,)]/.test(read[0]), 'readPhoto 가 덩이 층을 안 씁니다.');
  const mk = app.match(/function imgChunkMakers\([\s\S]*?\n\}/);
  assert.ok(mk, 'imgChunkMakers 를 찾지 못했습니다.');
  assert.ok(/g\.length > 1 \? g : g\[0\]/.test(mk[0]),
    '한 장짜리까지 배열로 보내면 「여러 쪽」이라고 잘못 말하게 됩니다.');
});

test('★ 읽은 답을 모든 쪽에 남긴다', () => {
  /* 한 쪽에만 쓰면 나머지는 「안 읽음」으로 남아, 화면을 열 때마다 같은 문서를
     또 읽으러 간다 — 한도를 쪽수만큼 더 쓴다. */
  const read = readPhotoFn();
  assert.ok(/pages\.reduce\(/.test(read), '쪽마다 저장하지 않습니다.');
  /* ⚠ 2026-09-05 — 해가 photoYearOf 로 바뀌었다. 지킬 것은 「쪽마다 주인을 본다」이다. */
  assert.ok(/saveRead\([\s\S]{0,80}?photoOwner\(p\.id\)\)/.test(read),
    '쪽마다 주인을 안 보고 저장합니다.');
  const start = app.match(/function startRead\(job\)[\s\S]*?\n\}/)[0];
  assert.ok(/sibs\.forEach\(/.test(start) && /sibs\.reduce\(/.test(start),
    '방금 올린 쪽들에 답을 안 남깁니다.');
});

test('★ 기업정보함·업체관리에는 «서류마다 하나»만 보낸다 — 쪽마다 보내지 않는다', () => {
  /* ⚠ 2026-09-12 — 「대표 쪽 하나」에서 「서류마다 하나」로 넓혔다.
       쪽마다 보내면 같은 업체가 쪽수만큼 쌓이고(그 까닭은 그대로다),
       맨 앞 하나만 보내면 2쪽 자동이체가 영영 안 간다.
     ⚠ 자리 이름(sibs[0]·pages[0])을 박지 않는다 — 그렇게 박아 두어서 이 검사가
       멀쩡한 고침에 깨졌다. 지킬 것은 «거르개를 지나는가»다. */
  [['다시 판독', readPhotoFn()],
   ['올린 뒤', app.match(/function startRead\(job\)[\s\S]*?\n\}/)[0]]].forEach(function (x) {
    assert.ok(/docLeads\(/.test(x[1]),
      '★★ ' + x[0] + ' 길이 «서류마다»로 안 거릅니다 — 2쪽 자동이체가 안 가거나 쪽수만큼 쌓입니다.');
    assert.ok(/sendCards\(/.test(x[1]) && /sendCompany\(/.test(x[1]),
      x[0] + ' 길에 보내는 자리가 없습니다.');
  });
});

test('★ 이미 올라간 문서도 문서마다 한 번만 대기열에 넣는다', () => {
  const fn = app.match(/function autoReadPending\(\)[\s\S]*?\n\}/);
  assert.ok(fn, 'autoReadPending 를 찾지 못했습니다.');
  /* 표식을 만들어 놓고 **보지 않으면** 아무 소용이 없다 — 둘 다 못 박는다. */
  assert.ok(/if \(seenDoc\[g\]\) return false;/.test(fn[0]),
    '이미 건 문서인지 안 보면, 첫 쪽이 문서 전체를 읽어 놓은 뒤에도 나머지가 또 읽습니다.');
  assert.ok(/seenDoc\[g\] = 1;/.test(fn[0]), '건 문서를 표시하지 않습니다.');
});

test('몇 쪽을 함께 보고 낸 답인지 남긴다', () => {
  /* 「2쪽인데 왜 같은 내용인가」에 답할 수 있어야 한다. */
  assert.ok(/read\.pagesRead = pages\.length/.test(app) &&
    /read\.pagesRead = sibs\.length/.test(app), '몇 쪽을 봤는지 안 남깁니다.');
});
