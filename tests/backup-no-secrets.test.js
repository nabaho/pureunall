/* 백업 파일에 «비밀»이 담기면 안 된다 (대표 지시 2026-09-10 「나스 연결 검토」)

   ── 무슨 일이 있었나 ──
   푸른이알피가 NAS(시놀로지)에 붙어 백업을 올리기 시작했다. 그런데 그 백업을 만드는
   대목만 **비밀 거름망이 없었다.** 그래서 NAS 공유폴더에 놓이는
   `pureun_erp_latest.json` 안에 이 셋이 그대로 들어갔다:
       pureun_v6_nas_config     ← NAS 아이디 + **비밀번호(평문)**
       pureun_v6_nts_api_key    ← 국세청 API 키
       pureun_v6_custom_api_keys← 그 밖 API 열쇠들
   그 폴더를 볼 수 있는 사람은 곧 NAS 비밀번호를 얻는다. 그 계정은 쓰기 권한이 있어
   백업을 지우거나 바꿀 수도 있다.

   ⚠ 「고장」이 아니라 **한 자리만 안 고쳐진 것**이었다 — 같은 일을 하는 다른 두 자리는
     처음부터 거름망을 갖고 있었다. 이 저장소가 여러 번 밟은 자리다
     (사진첩 갈래 목록 2026-09-01 · 참고 서랍 2026-09-07).

   ── 이 검사가 지키는 것 ──
   ① 거름망이 **한 곳**이다 — 세 벌로 두면 또 한 벌만 고쳐진다
   ② 백업을 만드는 **모든** 자리가 그 하나를 쓴다
   ③ 실제로 돌려서 — 비밀이 든 자료를 넣으면 결과물에 안 담긴다
   ⚠ 「지금 값」을 박지 않는다 — 열쇠 이름이 늘어도 안 깨진다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* 화면에서 SECRET_KEYS 한 줄을 그대로 떼어 «실제로» 돌려 본다 —
   글자만 대조하면 정규식이 틀려도 통과한다. */
function secretRe() {
  const m = APP.match(/var SECRET_KEYS = (\/.+\/[a-z]*);/);
  assert.ok(m, '★ 비밀 거름망(SECRET_KEYS)을 못 찾았습니다');
  const ctx = { RegExp };
  vm.createContext(ctx);
  return vm.runInContext('(' + m[1] + ')', ctx);
}

test('★★ 비밀 거름망이 «한 곳»에 있다', () => {
  const n = (APP.match(/var SECRET_KEYS =/g) || []).length;
  assert.equal(n, 1,
    '★★ 거름망이 여러 벌이면 한 벌만 고쳐집니다 — 바로 그래서 NAS 백업만 비밀을 담았습니다');
});

test('★★ 같은 뜻의 거름망을 «따로» 적어 두지 않았다', () => {
  /* 옛 꼴(정규식을 그 자리에 직접 적기)이 되살아나면 또 갈라진다.
     ⚠ SECRET_KEYS 를 «세우는» 그 한 줄은 뺀다 — 그것이 바로 한 곳이다. */
  const 흩어진것 = APP.split('\n').filter(function (ln) {
    return /api_key/.test(ln) && /nas_config/.test(ln) && !/var SECRET_KEYS =/.test(ln)
      && /\/[a-z|_]*\/i\.test/.test(ln);
  });
  assert.deepEqual(흩어진것, [],
    '★★ 거름망을 그 자리에 또 적었습니다 — SECRET_KEYS 를 쓰십시오');
});

test('★★ 백업을 만드는 «모든» 자리가 그 하나를 쓴다', () => {
  /* 「백업을 만드는 자리」란 localStorage 를 훑어 **밖으로 나갈 꾸러미에 담는** 곳이다.
     ⚠ 크기를 세거나 메타를 지우려고 훑는 곳은 아니다 — 그런 곳은 담지 않으므로 안 샌다.
       그래서 «담는 줄»(data[k] = …)이 있는 되풀이만 고른다.
     ⚠ 개수를 박지 않는다 — 자리가 늘어도 «전부» 거름망을 쓰는지만 본다.
     ⚠ 이 검사가 처음에는 훑는 곳을 다 잡아 열 자리를 냈다. 그 가운데 넷이 진짜였고,
       그 넷 중 **셋이 안 고쳐진 채였다** — 특히 7일마다 저절로 도는 자동 NAS 백업. */
  const lines = APP.split('\n');
  const 담는곳 = [];
  lines.forEach(function (ln, i) {
    if (!/localStorage\.key\(/.test(ln)) return;
    const 몸통 = lines.slice(i, i + 8).join('\n');
    if (!/\bdata\[k\]\s*=/.test(몸통)) return;        // 담지 않으면 백업이 아니다
    담는곳.push({ line: i + 1, ok: /SECRET_KEYS\.test/.test(몸통) });
  });
  assert.ok(담는곳.length >= 4,
    '★ 이 검사의 전제가 깨졌습니다 — 백업을 만드는 자리를 ' + 담는곳.length + '곳밖에 못 찾았습니다.\n' +
    '  2026-09-10 실측으로 넷이었습니다(NAS 백업·NAS 자동백업·수동 내려받기·이사 전 백업).');
  const 샌곳 = 담는곳.filter(function (x) { return !x.ok; }).map(function (x) { return x.line; });
  assert.deepEqual(샌곳, [],
    '★★ localStorage 를 훑어 백업 꾸러미에 담으면서 비밀을 안 거르는 자리가 있습니다 (줄 ' + 샌곳 + ').\n' +
    '  그 파일이 NAS 공유폴더에 놓입니다 — 보는 사람이 곧 NAS 비밀번호를 얻습니다.');
});

/* ── 실제로 돌려 본다 — 이 셋이 «지금 이 앱에 실재하는» 열쇠다 ── */
test('★★ NAS 비밀번호·API 열쇠는 걸러진다', () => {
  const re = secretRe();
  ['pureun_v6_nas_config', 'pureun_v6_nts_api_key', 'pureun_v6_custom_api_keys']
    .forEach(function (k) {
      assert.ok(re.test(k), '★★ ' + k + ' 가 백업에 담깁니다 — 이것이 이번에 찾은 흠입니다');
    });
});

test('앞으로 만들 열쇠도 이름만 맞으면 저절로 걸린다', () => {
  const re = secretRe();
  ['pureun_v6_어떤_api_key', 'pureun_v6_x_token', 'pureun_v6_y_secret', 'pureun_v6_z_password']
    .forEach(function (k) {
      assert.ok(re.test(k),
        '★ 새 열쇠(' + k + ')가 안 걸립니다 — 이름 규칙으로 저절로 걸려야 합니다');
    });
});

test('★★ 업무 자료는 «안» 걸러진다 — 너무 넓으면 백업이 텅 빈다', () => {
  const re = secretRe();
  ['pureun_v6_companies', 'pureun_v6_contracts', 'pureun_v6_user_accounts',
   'pureun_v6_nas_archive', 'pureun_v6_contract_docs']
    .forEach(function (k) {
      assert.ok(!re.test(k),
        '★★ 업무 자료(' + k + ')까지 걸러집니다 — 되찾을 것이 안 담기면 백업이 아닙니다');
    });
});

/* ── 뺐으면 «말해 준다» ── */
test('★ 비밀을 뺐다는 것을 사람에게 말한다', () => {
  assert.match(APP, /비밀 .*개.*백업에 안 담았습니다|비밀.*안 담았습니다/,
    '★ 조용히 빼면 복원한 사람이 「설정이 왜 없지」로 헤맵니다 —\n' +
    '  무엇이 빠졌고 무엇을 다시 넣어야 하는지 말해야 합니다.');
});

/* ── 복원 안내가 «사실»과 같은가 ── */
test('★★ 복원 안내가 실제 동작과 어긋나지 않는다', () => {
  const i = APP.indexOf('NAS 최신 백업');
  assert.ok(i > 0, '★ NAS 복원 안내를 못 찾았습니다');
  const 안내 = APP.slice(i, i + 500);
  /* 복원은 백업에 «있는» 칸만 덮어쓴다 — 없는 칸은 남는다.
     그런데 「모두 교체됩니다」라고 적혀 있었다. 그 말을 읽으면 백업 뒤에 만든 자료가
     지워질까 봐 복원을 못 한다. 실제를 말에 맞추는 것이 아니라 말을 실제에 맞춘다. */
  assert.ok(!/모두 교체/.test(안내),
    '★★ 「모두 교체됩니다」는 사실이 아닙니다 — 백업에 없는 칸은 그대로 남습니다.\n' +
    '  거짓 안내는 없느니만 못합니다(읽은 사람이 안심하고 틀립니다).');
  assert.match(안내, /그대로 남습니다/,
    '★★ 「백업에 없는 것은 남는다」를 말해야 사람이 복원을 결정할 수 있습니다');
});
