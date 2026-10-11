/* 푸른 캘린더 — 🔒 나만 보기 일정 · 구글 꼴 넣기 창
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「개인일정 … 본인만 확인가능하고 다른사람은 확인안되게 … 일정저장시에 선택기능」
   · 「폰에서도 개인과 공용으로 나눠달라」 · 「데이터 입력 및 수정 변경의 양식 형태도 구글과 같이」
   · 「위의 추천대로 해라」(관리자도 못 본다).

   ★ 규칙
     ① 나만 보기는 최상위 cal_private/{uid} — 서버 규칙이 본인만 읽고 쓴다(관리자도 못 읽는다)
        ⚠ data 아래면 안 된다 — data 는 재무 권한자가 통째로 읽는다
     ② 저장·지우기는 온톨로지 관문(강제)을 지난다 — 지우기는 삭제표시
     ③ 거르개: 🔒 개인 = 나만 보기만, 👥 공용 = 나만 보기 뺀 전부
     ④ 창에 «누가 보나» 고르기가 있고, 나만 보기는 구글에 안 넣는다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
global.PuWork = require(path.join(ROOT, 'js', 'pu-work-core.js'));

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('① 서버 규칙 — cal_private 는 본인만 읽고 쓰고, data 아래가 아니다', () => {
  const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'rules-paste.json'), 'utf8')).rules;
  assert.ok(R.cal_private, 'cal_private 규칙이 없습니다');
  const r = R.cal_private.$uid;
  assert.match(r['.read'], /auth\.uid === \$uid/, '남도 읽을 수 있습니다');
  assert.match(r['.write'], /auth\.uid === \$uid/, '남도 쓸 수 있습니다');
  assert.strictEqual(R.cal_private['.read'], undefined, '위에서 통째로 읽게 열렸습니다(관리자가 봅니다)');
  assert.strictEqual(!!(R.data && R.data.cal_private), false, 'data 아래에 두면 재무 권한자가 읽습니다');
});

function 가짜서버() {
  const 서버 = {};
  return {
    서버,
    ref(p) {
      return {
        set(v) { 서버[p] = v; return Promise.resolve(); },
        update() { return Promise.resolve(); },
        transaction(fn) { let v = fn(null); if (서버[p] !== undefined) v = fn(JSON.parse(JSON.stringify(서버[p])));
          if (v === undefined) return Promise.resolve({ committed: false }); 서버[p] = v; return Promise.resolve({ committed: true }); }
      };
    }
  };
}

test('② 나만 보기 저장·지우기가 온톨로지 관문(강제)을 «실제로» 지난다 — 지우기는 삭제표시', async () => {
  const OW = require(path.join(ROOT, 'js', 'pu-ontology-write.js'));
  const 속 = 가짜서버();
  const fb = { database() { return { ref: (p) => 속.ref(p) }; } };
  OW.installFirebaseCompat(fb, { mode: 'enforce', program: 'cal' });
  W.attach(fb.database(), { lockedMonths: ['2026-10'], formOf: () => null, who: () => '홍길동' });
  const r = await W.savePrivate('UID1', { id: 'prv-1', date: '2026-10-05', title: '치과', time: '14:00', endTime: '15:00' }, null);
  assert.equal(r.ok, true, '관문이 나만 보기 저장을 거절합니다: ' + r.message);
  const 담긴 = 속.서버['cal_private/UID1/prv-1'];
  assert.ok(담긴 && 담긴.title === '치과' && 담긴.entityType === 'ScheduleEvent', '내 칸에 안 담겼습니다');
  /* 근태가 아니다 — 마감된 달이어도 개인 일정은 막지 않는다 */
  const d = await W.removePrivate('UID1', 'prv-1', 담긴);
  assert.equal(d.ok, true, d.message);
  assert.equal(속.서버['cal_private/UID1/prv-1']._deleted, true, '지우기가 삭제표시가 아닙니다');
  const 남 = await W.savePrivate('', { id: 'prv-2', date: '2026-10-05', title: 'x' }, null);
  assert.equal(남.ok, false, '누구인지 모르는데 저장했습니다');
});

test('③ 거르개 — 🔒 개인은 나만 보기만, 👥 공용은 나만 보기를 뺀다', () => {
  const b = { S: { filter: null } };
  vm.createContext(b);
  vm.runInContext(함수몸(캘린더, 'function passFilter(ev){'), b);
  const 개인 = { kind: 'priv', sid: 'P-1' }, 공용 = { kind: 'gcal', sid: 'P-1' };
  b.S.filter = 'priv';
  assert.equal(vm.runInContext('passFilter(' + JSON.stringify(개인) + ')', b), true);
  assert.equal(vm.runInContext('passFilter(' + JSON.stringify(공용) + ')', b), false);
  b.S.filter = 'shared';
  assert.equal(vm.runInContext('passFilter(' + JSON.stringify(개인) + ')', b), false, '공용 거르개에 나만 보기가 섞입니다');
  assert.equal(vm.runInContext('passFilter(' + JSON.stringify(공용) + ')', b), true);
});

test('④ 창에 «누가 보나» 고르기가 있고, 나만 보기는 구글에 안 넣는다', () => {
  const 창 = 함수몸(캘린더, 'function modalHtml(){');
  assert.match(창, /data-m=\\?"vis\\?"/, '누가 보나 고르기가 없습니다');
  assert.match(창, /value=\\?"private\\?"/, '나만 보기 고르기가 없습니다');
  const 저장 = 함수몸(캘린더, 'function doSave(){');
  const i = 저장.indexOf('m.vis === "private"'), j = 저장.indexOf('구글에넣기(m)');
  assert.ok(i >= 0 && j > i, '나만 보기를 가르기 전에 구글로 보냅니다(남이 봅니다)');
});

test('④ 폰 머리에 전체·공용·개인 고르기가 있다', () => {
  const 머리 = 함수몸(캘린더, 'function 폰머리Html(){');
  assert.match(머리, /data-mf/, '폰에서 개인·공용을 가를 수 없습니다');
});

/* ── 🔒 나만 보기 → 본인 구글 달력(primary)에도 (대표 지시 2026-09-27 「개인일정도 추천대로」) ── */
async function 구글부름(일) {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 3600e3;
  const 부름 = [];
  const f = (url, opt) => { 부름.push({ url, opt }); return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ id: 'g9' }) }); };
  await 일(A, f);
  return 부름;
}
test('⑤ 본인 구글 달력에는 «비공개»로 넣는다 — 그 달력을 나눠 봐도 내용은 «바쁨»', async () => {
  const 부름 = await 구글부름((A, f) => A.createEvent('primary', { date: '2026-10-05', time: '14:00', endTime: '15:00',
    summary: '치과', visibility: 'private' }, { fetch: f }));
  assert.match(부름[0].url, /\/calendars\/primary\/events/, '회사 공용 달력에 넣었습니다');
  assert.equal(JSON.parse(부름[0].opt.body).visibility, 'private');
});
test('⑤ 고치면 본인 구글 달력도 같이 고친다(PATCH), 번호로 잇는다', async () => {
  const 부름 = await 구글부름((A, f) => A.updateEvent('primary', 'g9', { date: '2026-10-06', summary: '치과(변경)', visibility: 'private' }, { fetch: f }));
  assert.equal(부름[0].opt.method, 'PATCH');
  assert.match(부름[0].url, /\/events\/g9\?/);
  assert.equal(JSON.parse(부름[0].opt.body).summary, '치과(변경)');
});
test('⑤ 화면 — 로그인돼 있을 때만 본인 달력으로, 지우면 거기서도 지운다', () => {
  const 보냄 = 함수몸(캘린더, 'function 내구글에(item, prev){');
  assert.match(보냄, /PuGcalAuth\.hasToken\(\)/, '로그인 여부를 안 봅니다');
  assert.match(보냄, /"primary"/, '본인 달력이 아닌 곳으로 보냅니다');
  assert.strictEqual(/GCAL_CAL_ID/.test(보냄), false, '나만 보기를 회사 공용 달력에 넣습니다 — 모두가 봅니다');
  assert.match(보냄, /ownGcalId/, '이어 둔 번호를 안 남깁니다 — 고치기·지우기가 못 따라갑니다');
  const 지움 = 함수몸(캘린더, 'function doDelete(){');
  assert.match(지움, /내구글에서지우기\(/, '지워도 본인 구글 달력에 남습니다');
});
