'use strict';
/* 나스가 «받아 가는» 백업 내보내기 (2026-09-18 대표 지시 「자동화 설계해라」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇을 바꾸는 일인가
     여태는 브라우저가 나스에 «올렸다». 대표님 나스에는 브라우저가 요구하는 쪽지(CORS)를
     붙일 자리가 아예 없어 그 길이 막혔다(로그인 포털 세 탭 다 확인).
     그래서 방향을 뒤집는다 — 나스가 새벽에 «받아 간다». 나스의 wget 은 브라우저가
     아니므로 CORS 라는 것이 없다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 열쇠가 서버에 없으면 «연다»가 아니라 «멈춘다»
     ② 열쇠는 시간이 새지 않게 견준다
     ③ 날짜는 날짜 꼴만 받는다 — 경로를 글자로 잇는 자리다
     ④ 비밀은 «보내기 전에» 뺀다. 무엇을 뺐는지도 말한다
     ⑤ 브라우저용 쪽지(CORS)를 안 붙인다 — 열쇠가 새도 브라우저에서는 못 읽는다
     ⑥ 받아 간 흔적을 남긴다. 다만 흔적을 못 남겨도 자료는 준다
     ⑦ 목록은 «가벼운 쪽»에서 고른다 — 고르자고 본문 2~5MB 를 받으면 그것만으로 요금이 난다
     ⑧ 거르는 규칙이 이알피의 것과 같다 — 두 벌이면 한 벌만 고쳐진다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const M = require('./nas-backup-export.js');
const ROOT = path.join(__dirname, '..');

/* 가짜 요청·응답·데이터베이스 */
function 부르기(opts) {
  opts = opts || {};
  const 쓴것 = {};
  const 값 = opts.값 || {};
  /* 읽은 자리를 «어떻게» 읽었는지까지 적는다 — 「끝 몇 개만 받았나」를 재려면
     통째로 받은 것과 꼬리만 받은 것을 갈라 봐야 한다. */
  const 읽은것 = [];
  const db = () => ({
    ref(p) {
      function 마디(꼬리) {
        return {
          orderByKey() {
            if (opts.꼬리막힘) throw new Error('이 판에는 질의가 없습니다');
            return 마디(꼬리 === null ? Infinity : 꼬리);
          },
          limitToLast(n) { return 마디(n); },
          once: () => {
            읽은것.push(꼬리 === null ? p : p + ' 끝' + 꼬리);
            const v = (p in 값) ? 값[p] : null;
            if (꼬리 === null || !v || typeof v !== 'object') return Promise.resolve({ val: () => v });
            const ks = Object.keys(v).sort().slice(-꼬리);
            const 잘린것 = {};
            ks.forEach((k) => { 잘린것[k] = v[k]; });
            return Promise.resolve({ val: () => 잘린것 });
          },
          set: (nv) => { if (opts.흔적못씀) return Promise.reject(new Error('막힘')); 쓴것[p] = nv; return Promise.resolve(); },
        };
      }
      return 마디(null);
    },
  });
  const res = { _code: 200, _body: null, _head: {},
    status(c) { this._code = c; return this; },
    json(b) { this._body = b; return this; },
    send(b) { this._body = b; return this; },
    set(k, v) { this._head[k] = v; return this; } };
  const req = {
    method: opts.method || 'GET',
    query: opts.query || {},
    headers: Object.assign({ 'x-nas-key': opts.열쇠 }, opts.headers || {}),
    get(n) { return this.headers[String(n).toLowerCase()]; },
  };
  const h = M.핸들러만들기({ db, key: () => opts.참열쇠, now: () => 1700000000000 });
  return h(req, res).then(() => ({ res, 쓴것, 읽은것 }));
}

const 백업하나 = {
  savedAt: '2026-09-18T00:00:00.000Z', version: 'v6',
  data: { contracts: [{ id: 'c1' }], nas_config: { pass: '비밀' }, api_keys: { g: 'x' }, companies: [{ id: 'k1' }] },
};

test('①★★ 열쇠가 서버에 없으면 «연다»가 아니라 «멈춘다»', async () => {
  const { res } = await 부르기({ 참열쇠: '', 열쇠: '아무거나' });
  assert.equal(res._code, 500, '★★ 열쇠가 없을 때 그냥 내주면, 넣는 것을 잊은 채로 자료가 인터넷에 열린다');
  assert.match(res._body.error, /secrets:set NAS_BACKUP_KEY/,
    '★ 무엇을 하라는지 없으면 500 만 보고 사람은 멈춘다');
});

test('②★ 열쇠가 다르면 안 준다 — 길이가 달라도 터지지 않는다', async () => {
  const a = await 부르기({ 참열쇠: '열쇠열쇠열쇠', 열쇠: '틀린것' });
  assert.equal(a._code || a.res._code, 403);
  const b = await 부르기({ 참열쇠: '열쇠열쇠열쇠', 열쇠: '' });
  assert.equal(b.res._code, 403, '★ 빈 열쇠가 통과하면 열쇠가 없는 것과 같다');
  /* 견주는 함수 자체 — 길이가 달라도 던지지 않아야 한다(던지면 500 으로 새어 나간다) */
  assert.equal(M.열쇠맞나('짧다', '아주아주긴열쇠'), false);
  assert.equal(M.열쇠맞나('같은열쇠', '같은열쇠'), true);
  assert.equal(M.열쇠맞나(undefined, '무엇'), false);
});

test('②-2 시간이 새지 않게 견준다 — 글자 대 글자로 비교하지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'nas-backup-export.js'), 'utf8');
  const f = src.slice(src.indexOf('function 열쇠맞나('), src.indexOf('function 최신날짜('));
  assert.match(f, /timingSafeEqual/,
    '★★ === 로 견주면 «몇 글자까지 맞았는지»가 시간으로 새어 나간다');
  assert.ok(!/받은것 === 참값|참값 === 받은것/.test(f), '★ 그냥 견주는 길이 남아 있다');
});

test('③★ 날짜는 날짜 꼴만 받는다 — 경로를 글자로 잇는 자리다', async () => {
  const { res } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', query: { date: '../backup_key' } });
  assert.equal(res._code, 400,
    '★★ 아무 글자나 받으면 serverBackups/ 뒤에 붙여 «남의 칸»을 읽힌다');
  assert.ok(M.DATE_RE.test('2026-09-18'));
  assert.ok(!M.DATE_RE.test('2026-9-18'));
  assert.ok(!M.DATE_RE.test('2026-09-18/..'));
});

test('④★★ 비밀은 «보내기 전에» 뺀다 — 그리고 무엇을 뺐는지 말한다', async () => {
  const { res } = await 부르기({
    참열쇠: 'k', 열쇠: 'k',
    값: { 'serverBackupsIndex': { '2026-09-18': { savedAt: 1 } }, 'serverBackups/2026-09-18': 백업하나 },
  });
  assert.equal(res._code, 200);
  const 몸통 = JSON.parse(res._body);
  assert.ok(!('nas_config' in 몸통.data), '★★ 나스 비밀번호가 나스로 내려가면 그 폴더를 보는 사람이 곧 열쇠를 얻는다');
  assert.ok(!('api_keys' in 몸통.data));
  assert.ok('contracts' in 몸통.data, '★ 거르다 업무 칸까지 버리면 백업이 아니다');
  assert.deepEqual(Array.from(몸통.droppedKeys).sort(), ['api_keys', 'nas_config'],
    '★ 조용히 빼면 다음 사람이 「왜 이 칸이 없지」를 한참 찾는다');
  assert.equal(몸통.sealed, true, '★ 받는 쪽이 「이게 잠긴 것인가」를 물을 필요가 없게 적어 둔다');
});

test('⑤★★ 브라우저용 쪽지(CORS)를 안 붙인다 — 열쇠가 새도 브라우저에서는 못 읽는다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'nas-backup-export.js'), 'utf8');
  assert.ok(!/Access-Control-Allow-Origin/.test(src),
    '★★ CORS 를 붙이면 열쇠 하나로 아무 웹페이지나 이 자료를 읽을 수 있게 된다.\n' +
    '  이것은 나스의 wget 이 부르는 길이고, wget 에는 CORS 가 필요 없다.');
  assert.ok(!/setCors/.test(src));
});

test('⑥ 흔적을 남긴다 — 다만 흔적을 못 남겨도 자료는 준다', async () => {
  const 값 = { 'serverBackupsIndex': { '2026-09-18': {} }, 'serverBackups/2026-09-18': 백업하나 };
  const a = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값 });
  const 흔적 = Object.keys(a.쓴것).find((k) => k.indexOf('nas_backup_log/') === 0);
  assert.ok(흔적, '★★ 누가 언제 받아 갔는지 모르면 열쇠가 샜을 때 알 길이 없다');
  assert.equal(typeof a.쓴것[흔적].bytes, 'number', '★ 크기가 없으면 「빈 것이 갔다」를 못 본다');
  /* 흔적이 막혀도 자료는 나간다 */
  const b = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값, 흔적못씀: true });
  assert.equal(b.res._code, 200, '★★ 흔적을 못 남겼다고 백업이 멎으면 안 된다');
});

test('⑦★★ 목록은 «정말로» 가벼운 쪽에서 고른다 — 끝 몇 개만 받는다', async () => {
  /* ★ 예전에는 이 검사가 「serverBackupsIndex 를 먼저 읽는가」만 봤다. 그래서
       그 칸이 **900KB** 로 자란 것을 못 잡았다(실측 2026-09-19 — 한 벌마다
       사건·업체 이름표 31KB). 「어느 칸을 읽나」가 아니라 «얼마나 받나»를 본다. */
  const 목록 = {};
  for (let d = 1; d <= 20; d++) {
    const ymd = '2026-08-' + String(d).padStart(2, '0');
    목록[ymd] = { ids: 'x'.repeat(300) };
    목록[ymd + '-pm'] = { ids: 'x'.repeat(300) };
  }
  const 값 = { serverBackupsIndex: 목록, 'serverBackups/2026-08-20-pm': 백업하나 };
  const { res, 읽은것 } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값 });
  assert.equal(res._code, 200, '★ 가장 최근 백업을 못 골랐다');

  const 목록읽기 = 읽은것.filter((r) => r.indexOf('serverBackupsIndex') === 0);
  assert.ok(목록읽기.length > 0, '★ 목록을 아예 안 봤다 — 날짜를 어디서 골랐나');
  assert.ok(목록읽기.every((r) => /끝\d+$/.test(r)),
    '★★ 날짜 하나 고르자고 목록을 «통째로» 받고 있습니다 — 그 칸은 지금 900KB 입니다: ' + JSON.stringify(목록읽기));
  const 받은칸수 = Math.max.apply(null, 목록읽기.map((r) => Number(r.match(/끝(\d+)$/)[1])));
  assert.ok(받은칸수 <= 20 && 받은칸수 < Object.keys(목록).length,
    '★ 끝만 받는다더니 사실상 전부입니다(' + 받은칸수 + '칸 / ' + Object.keys(목록).length + '칸)');
});

test('⑦-2★★ 저녁 백업(-pm)도 «가장 최근»이다 — 반나절치가 조용히 빠지지 않게', async () => {
  /* 새벽에 나스가 받아 갈 때 어제 저녁 백업이 이미 있는데도 어제 «아침» 것을
     가져가고 있었다. 이름 끝의 -pm 을 날짜로 안 쳤기 때문이다. */
  const 값 = {
    serverBackupsIndex: { '2026-09-18': 1, '2026-09-18-pm': 1 },
    'serverBackups/2026-09-18': 백업하나,
    'serverBackups/2026-09-18-pm': 백업하나,
  };
  const { res } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값 });
  assert.equal(res._code, 200);
  assert.equal(JSON.parse(res._body).date, '2026-09-18-pm',
    '★★ 저녁 백업을 두고 아침 것을 가져갑니다 — 반나절이 보관에서 빠집니다');
  assert.equal(M.최신날짜({ '2026-09-18': 1, '2026-09-18-pm': 1, 'x': 1 }), '2026-09-18-pm');
  assert.equal(M.최신날짜({ '2026-09-18-pm': 1, '2026-09-19': 1 }), '2026-09-19',
    '★ 다음 날 아침이 어제 저녁보다 새것이다');
  assert.equal(M.최신날짜({ 'x': 1 }), null, '★ 날짜가 아닌 이름을 고르면 엉뚱한 칸을 읽는다');
  assert.equal(M.최신날짜(null), null);
});

test('⑦-3★ 끝만 받는 길이 막혀도 백업은 나간다 — 아끼려다 «못 받으면» 더 나쁘다', async () => {
  const 값 = { serverBackupsIndex: { '2026-09-18': 1 }, 'serverBackups/2026-09-18': 백업하나 };
  const { res, 읽은것 } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값, 꼬리막힘: true });
  assert.equal(res._code, 200, '★★ 질의가 막혔다고 백업이 멎으면 안 된다');
  assert.ok(읽은것.indexOf('serverBackupsIndex') >= 0, '★ 물러선 길(통째로 받기)이 안 돌았다');
});

test('⑧★★ 거르는 규칙이 이알피의 것과 «같다» — 두 벌이면 한 벌만 고쳐진다', () => {
  const erp = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const m = erp.match(/var SECRET_KEYS = (\/[^\n]*\/i);/);
  assert.ok(m, '★ 이알피의 SECRET_KEYS 를 못 찾았다 — 검사가 헛돈다');
  assert.equal(String(M.SECRET_KEY_RE), m[1],
    '★★ 두 곳의 규칙이 어긋났습니다. 한쪽에만 비밀을 더하면 다른 길로 그대로 새어 나갑니다.\n' +
    '  이알피: ' + m[1] + '\n  함수:   ' + String(M.SECRET_KEY_RE));
});

test('⑨ 받아 가는 길만 있다 — 쓰는 길을 열지 않는다', async () => {
  const { res } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', method: 'POST' });
  assert.equal(res._code, 405, '★ POST 를 받으면 언젠가 누군가 여기에 쓰는 길을 붙인다');
});

test('⑩ 백업이 하나도 없으면 그렇다고 말한다 — 빈 것을 «성공»으로 주지 않는다', async () => {
  const { res } = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: { 'serverBackupsIndex': null } });
  assert.equal(res._code, 404,
    '★★ 빈 것을 200 으로 주면 나스가 그것으로 지난 백업을 덮는다 — 가장 나쁜 고장이다');
});

/* ⑨ 앱별로 따로 받기 — ?app=hr|fin|erp (대표 지시 2026-10-09 「파이어베이스와 나스 등 … 각자 데이터를 잘 관리」)
   어느 표가 어느 앱 것인지는 «백업에 함께 적힌 목차»(apps)를 따른다 — 여기에 표 이름을 따로 적지 않는다. */
const 목차백업 = {
  savedAt: '2026-10-09T00:00:00.000Z', version: 'v6',
  apps: { erp: ['contracts', 'companies'], hr: ['payroll_monthly', 'user_accounts'], fin: ['finance_income'] },
  data: { contracts: [{ id: 'c1' }], companies: [{ id: 'co1' }], payroll_monthly: [{ id: 'p1' }],
    user_accounts: [{ sid: 'P-001' }], finance_income: [{ id: 'f1' }], new_table: [{ id: 'n1' }], api_keys: { x: 1 } },
};
const 목차값 = { serverBackupsIndex: { '2026-10-09': {} }, 'serverBackups/2026-10-09': 목차백업 };
test('⑨★ 앱별 받기 — 그 앱의 표만 준다 · 이알피는 «남의 것이 아닌 것 전부»', async () => {
  const hr = JSON.parse((await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 목차값, query: { app: 'hr' } })).res._body);
  assert.deepEqual(Object.keys(hr.data).sort(), ['payroll_monthly', 'user_accounts']);
  assert.equal(hr.app, 'hr');
  const fin = JSON.parse((await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 목차값, query: { app: 'fin' } })).res._body);
  assert.deepEqual(Object.keys(fin.data), ['finance_income']);
  const erp = JSON.parse((await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 목차값, query: { app: 'erp' } })).res._body);
  assert.deepEqual(Object.keys(erp.data).sort(), ['companies', 'contracts', 'new_table'],
    '★ 목차 뒤에 새로 생긴 표(new_table)가 어느 폴더에도 안 가면 안 된다 — 이알피 폴더가 받는다');
  assert.ok(!('api_keys' in erp.data), '★★ 앱별로 받아도 비밀은 빠진다');
  const all = JSON.parse((await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 목차값 })).res._body);
  assert.equal(Object.keys(all.data).length, 6, '통째 받기(app 없이)는 예전 그대로 전부');
});
test('⑨★ 목차가 없는 옛 백업은 앱별로 «안» 준다(409) · 통째는 준다 · 모르는 앱은 400', async () => {
  const 옛값 = { serverBackupsIndex: { '2026-09-18': {} }, 'serverBackups/2026-09-18': 백업하나 };
  const a = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 옛값, query: { app: 'hr' } });
  assert.equal(a.res._code, 409, '★ 어림으로 갈라 주면 빠진 표를 모른 채 보관하게 된다');
  const b = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 옛값 });
  assert.equal(b.res._code, 200);
  const c = await 부르기({ 참열쇠: 'k', 열쇠: 'k', 값: 목차값, query: { app: '../x' } });
  assert.equal(c.res._code, 400);
});
test('⑨ 나스 스크립트 — 통째 백업은 그대로 두고, 세 앱을 제 폴더로 한 벌씩 더 받는다', () => {
  const sh = fs.readFileSync(path.join(ROOT, 'docs', '나스-백업-스크립트.sh'), 'utf8');
  assert.match(sh, /wget -q -O "\$TMP" --header="X-Nas-Key: \$NAS_KEY" "\$URL"/, '★ 통째 받기가 사라지면 안 된다');
  assert.match(sh, /"\$URL\?app=\$APP"/);
  assert.match(sh, /for A in erp hr fin; do fetch_app "\$A"; done/);
  assert.match(sh, /ADIR="\$DIR\/\$APP"/, '앱마다 제 폴더');
  assert.match(sh, /grep -q '"ok":true' "\$ATMP"/, '★ 받은 것이 백업인지 본 «뒤에만» 바꾼다');
});
