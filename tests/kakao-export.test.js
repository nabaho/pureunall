/* 💬 카톡정리 — 대화 저장본 끌어 놓기 · 📎 받을 파일 (2026-10-24)
   대표 「카톡 대화와 다운받을 것을 위반 없이 자동 정리」 → 목업 승인 → 「목업대로 진행」.
   ⚠ 예시 이름은 모두 가짜다(홍길동·임꺽정·성춘향·가나상사·다라산업). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const K = require('../js/pu-kakao-work.js');
const W = require('../functions/kakao-work-server.js');

const KST = 9 * 3600 * 1000;
const at = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi) - KST;   /* 한국 시각 → ms */

/* ── 저장본 읽기 ─────────────────────────────────────────────────────── */
const PC = [
  '푸른 업무방 11 님과 카카오톡 대화',
  '저장한 날짜 : 2026-10-24 14:05:12',
  '',
  '--------------- 2026년 10월 24일 토요일 ---------------',
  '[홍길동] [오후 1:26] 파일: 가나상사_근무표.xlsx',
  '[홍길동] [오후 1:26] 범례 색 바꿔서',
  '다시 올립니다',
  '[임꺽정] [오전 12:05] 사진 3장',
  '성춘향님이 들어왔습니다.',
  '[대표] [오후 2:02] 주민 900101-1234567 확인',
].join('\r\n');

test('PC 저장본 — 여러 줄 글은 한 글로, 파일·사진은 따로, 들어옴 알림은 버린다', () => {
  const p = K.parseExport(PC);
  assert.ok(p.ok);
  assert.strictEqual(p.format, 'pc');
  assert.strictEqual(p.messages.length, 2);
  assert.strictEqual(p.messages[0].text, '범례 색 바꿔서\n다시 올립니다');
  assert.strictEqual(p.messages[0].sentAt, at(2026, 10, 24, 13, 26));
  assert.deepStrictEqual(p.files.map((f) => f.name), ['가나상사_근무표.xlsx']);
  assert.strictEqual(p.photos, 3);
  assert.ok(!p.messages.some((m) => /들어왔습니다/.test(m.text)), '들어옴 알림을 글로 넣었다');
});

test('오전 12시는 0시, 오후 12시는 12시다', () => {
  const p = K.parseExport('--- 2026년 10월 24일 토요일 ---\n[홍길동] [오전 12:05] 가\n[홍길동] [오후 12:05] 나');
  assert.strictEqual(p.messages[0].sentAt, at(2026, 10, 24, 0, 5));
  assert.strictEqual(p.messages[1].sentAt, at(2026, 10, 24, 12, 5));
});

test('안드로이드·아이폰·맥(CSV) 저장본도 읽는다', () => {
  const a = K.parseExport('푸른 업무방 님과 카카오톡 대화\n저장한 날짜 : 2026년 10월 24일 오후 2:05\n\n'
    + '2026년 10월 24일 오후 1:26\n2026년 10월 24일 오후 1:26, 홍길동 : 안녕하세요\n둘째 줄\n'
    + '2026년 10월 24일 오후 1:27, 임꺽정님이 들어왔습니다.\n2026년 10월 24일 오후 1:28, 임꺽정 : 파일: 가나.pdf');
  assert.strictEqual(a.format, 'android');
  assert.deepStrictEqual(a.messages.map((m) => m.text), ['안녕하세요\n둘째 줄']);
  assert.deepStrictEqual(a.files.map((f) => f.name), ['가나.pdf']);
  const i = K.parseExport('푸른 업무방 님과 카카오톡 대화\n\n2026년 10월 24일 토요일\n2026. 10. 24. 오후 1:26, 홍길동 : 안녕\n2026. 10. 24. 오후 1:29, 임꺽정 : 사진');
  assert.strictEqual(i.format, 'ios');
  assert.strictEqual(i.messages[0].sentAt, at(2026, 10, 24, 13, 26));
  assert.strictEqual(i.photos, 1);
  const m = K.parseExport('Date,User,Message\n2026-10-24 13:26:00,"홍길동","여러\n줄, 쉼표"\n2026-10-24 13:27:00,"임꺽정","사진"');
  assert.strictEqual(m.format, 'mac');
  assert.strictEqual(m.messages[0].text, '여러\n줄, 쉼표');
});

test('못 읽는 글은 지어내지 않고 «못 읽었다»와 첫 줄을 돌려준다', () => {
  const p = K.parseExport('아무 글이나\n두 번째 줄');
  assert.strictEqual(p.ok, false);
  assert.match(p.error, /못 읽었습니다/);
  assert.strictEqual(p.firstLine, '아무 글이나');
});

test('방 이름 — 첫 줄에서 뽑고 사람 수가 붙어도 받는 방과 «정확히» 같을 때만', () => {
  const rooms = K.parseExport(PC).rooms;
  assert.deepStrictEqual(rooms, ['푸른 업무방 11', '푸른 업무방']);
  assert.strictEqual(K.pickRoom(['푸른 업무방'], rooms), '푸른 업무방');
  assert.strictEqual(K.pickRoom(['푸른 업무방 2팀'], rooms), '', '비슷한 이름으로 넣었다');
  assert.strictEqual(K.pickRoom([], rooms), '', '받는 방이 비었는데 넣었다');
  assert.ok(K.exportRooms('', '가나상사 업무방_20261024_1405.txt').includes('가나상사 업무방'), '파일 이름에서 방을 못 뽑았다');
});

test('가리면서 센다 — 주민번호·계좌는 가리고 전화번호는 남긴다', () => {
  const r = K.maskCount('주민 900101-1234567 계좌 110-123-456789 폰 010-1111-2222');
  assert.strictEqual(r.rrn, 1);
  assert.strictEqual(r.account, 1);
  assert.ok(!/900101-1234567|110-123-456789/.test(r.text));
  assert.match(r.text, /010-1111-2222/);
  assert.strictEqual(r.text, K.maskSensitive('주민 900101-1234567 계좌 110-123-456789 폰 010-1111-2222'), '세는 가리개가 원래 가리개와 다르게 가린다');
});

/* ── 받을 파일 ───────────────────────────────────────────────────────── */
test('보낼 곳 짐작 — 급여·근로계약서는 PC에만, 우리 계약서는 기업별 계약서, 나머지는 사진첩', () => {
  const g = (n) => K.guessDest(n);
  assert.strictEqual(g('다라산업_9월_급여대장.xlsx'), 'pc');
  assert.strictEqual(g('가나상사_연차대장.xlsx'), 'pc');
  assert.strictEqual(g('다라산업_근로계약서_스캔.pdf'), 'pc', '고객사 직원 근로계약서를 우리 계약서로 보냈다');
  assert.strictEqual(g('가나상사_자문계약서.pdf'), 'co');
  assert.strictEqual(g('가나상사 급여관리 계약서.pdf'), 'co');
  assert.strictEqual(g('가나상사_사업자등록증.jpg'), 'photo');
  assert.strictEqual(g('마바물산_취업규칙_개정안.hwp'), 'photo');
});

test('남은 기간 — 보낸 날 + 14일(추정), 한국 날짜로 센다', () => {
  const now = at(2026, 10, 24, 14, 0);
  assert.strictEqual(K.fileLeft(at(2026, 10, 12, 9, 14), now), 2);
  assert.strictEqual(K.fileEnds(at(2026, 10, 12, 9, 14)), '10/26');
  assert.strictEqual(K.fileLeft(at(2026, 10, 10, 23, 59), now), 0, '오늘까지인 것');
  assert.ok(K.fileLeft(at(2026, 10, 6, 11, 2), now) < 0, '지난 것');
  assert.strictEqual(K.EXPIRE_DAYS, 14);
});

test('폴더의 같은 파일 — 큰작은 글자·「 (1)」 붙은 이름까지, 다른 이름은 아니다', () => {
  assert.ok(K.sameFileName('가나상사.xlsx', '가나상사.XLSX'));
  assert.ok(K.sameFileName('가나상사.xlsx', '가나상사 (1).xlsx'));
  assert.ok(K.sameFileName('가나상사.xlsx', '가나상사(12).xlsx'));
  assert.ok(!K.sameFileName('가나상사.xlsx', '가나상사 사본.xlsx'));
  assert.ok(!K.sameFileName('가나상사.xlsx', '가나상사.xls'));
});

/* ── 서버 ───────────────────────────────────────────────────────────── */
function fakeDb(init) {
  const data = JSON.parse(JSON.stringify(init || {}));
  const parts = (p) => String(p).split('/').filter(Boolean);
  const get = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const put = (p, v) => {
    const ks = parts(p); let o = data;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const snap = (key, v) => ({
    key, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v !== undefined && v !== null,
    forEach: (cb) => { Object.keys(v || {}).sort().forEach((k) => cb(snap(k, v[k]))); },
  });
  function ref(p) {
    const q = { start: null, end: null, first: null };
    const r = {
      once: async () => {
        let v = get(p);
        if (v && typeof v === 'object' && (q.start !== null || q.end !== null || q.first !== null)) {
          let ks = Object.keys(v).sort();
          if (q.start !== null) ks = ks.filter((k) => k >= q.start);
          if (q.end !== null) ks = ks.filter((k) => k <= q.end);
          if (q.first !== null) ks = ks.slice(0, q.first);
          const o = {}; ks.forEach((k) => { o[k] = v[k]; }); v = o;
        }
        return snap(parts(p).pop(), v);
      },
      orderByKey: () => r,
      startAt: (x) => { q.start = x; return r; },
      endAt: (x) => { q.end = x; return r; },
      limitToFirst: (n) => { q.first = n; return r; },
      set: async (v) => put(p, v),
      update: async (o) => { Object.keys(o).forEach((k) => put(p + '/' + k, o[k])); },
      /* 진짜처럼 «손안의 값 = null» 로 먼저 부른다(구독 안 한 자리) — 거기서 접으면 끝난다 */
      transaction: async (fn) => {
        let next = fn(null);
        if (next === undefined) return { committed: false };
        const real = get(p);
        if (JSON.stringify(real === undefined ? null : real) !== 'null') next = fn(JSON.parse(JSON.stringify(real)));
        if (next === undefined) return { committed: false };
        put(p, next); return { committed: true };
      },
    };
    return r;
  }
  return { ref, data };
}

const NOW = at(2026, 10, 24, 14, 10);
async function seeded() {
  const db = fakeDb();
  await W.setRooms(db, ['푸른 업무방'], 'u1', NOW);
  /* 폰 알림으로 이미 온 글 하나 — 밀리초가 붙어 있다 */
  await W.ingest(db, { device: {} }, { room: '푸른 업무방', items: [{ sender: '홍길동', text: '범례 색 바꿔서\n다시 올립니다', time: at(2026, 10, 24, 13, 26) + 41234 }] }, NOW);
  return db;
}
function payload(over) {
  return Object.assign({
    room: '푸른 업무방',
    lines: [
      { sender: '홍길동', sentAt: at(2026, 10, 24, 13, 26), text: '범례 색 바꿔서\n다시 올립니다' },
      { sender: '대표', sentAt: at(2026, 10, 24, 14, 2), text: '주민 900101-1234567 확인' },
      { sender: '대표', sentAt: at(2026, 9, 1, 9, 0), text: '아주 옛 글' },
    ],
    files: [{ sender: '홍길동', sentAt: at(2026, 10, 24, 13, 26), name: '가나상사_근무표.xlsx' }],
    photos: 3,
  }, over || {});
}

test('서버: 받는 방이 아니면 «아무것도» 안 남긴다 — 미리보기여도, 방 이름조차', async () => {
  const db = await seeded();
  const before = JSON.stringify(db.data);
  const out = await W.importExport(db, 'u1', payload({ room: '가족 단톡' }), NOW);
  assert.strictEqual(out.ok, false);
  assert.strictEqual(JSON.stringify(db.data), before, '목록 밖 방 저장본이 무언가를 남겼다');
});

test('서버: 미리보기(dryRun)는 세기만 하고 쓰지 않는다', async () => {
  const db = await seeded();
  const before = JSON.stringify(db.data);
  const out = await W.importExport(db, 'u1', payload({ dryRun: true }), NOW);
  assert.strictEqual(JSON.stringify(db.data), before, '미리보기가 썼다');
  assert.strictEqual(out.fresh, 1, '대표 글 한 줄만 새것이어야 한다');
  assert.strictEqual(out.have, 1, '알림으로 이미 온 글을 또 넣으려 한다');
  assert.strictEqual(out.old, 1, '30일 넘은 줄을 넣으려 한다');
  assert.strictEqual(out.freshBy['대표'], 1);
  assert.deepStrictEqual(out.senders.find((s) => s.name === '홍길동').notified, true);
  assert.deepStrictEqual(out.senders.find((s) => s.name === '대표').notified, false, '알림에 없는 사람(=폰 주인) 짐작 재료가 없다');
  assert.strictEqual(out.files.fresh, 1);
});

test('서버: 넣기 — 가려서 담고, 출처는 저장본, 다시 넣어도 두 번 안 담는다', async () => {
  const db = await seeded();
  const a = await W.importExport(db, 'u1', payload({ meName: '대표' }), NOW);
  assert.strictEqual(a.fresh, 1);
  const day = db.data.kakaoWork.notes[W.dayKey(at(2026, 10, 24, 14, 2))];
  const mine = Object.values(day).filter((n) => n.src === 'export');
  assert.strictEqual(mine.length, 1);
  assert.ok(!mine[0].text.includes('900101-1234567'), '서버가 주민번호를 안 가렸다');
  assert.strictEqual(mine[0].entityType, 'Message');
  assert.strictEqual(mine[0].originSystem, 'kakaotalk');
  const b = await W.importExport(db, 'u1', payload(), NOW + 60000);
  assert.strictEqual(b.fresh, 0, '같은 저장본을 다시 넣었더니 또 담겼다');
  assert.strictEqual(b.files.fresh, 0, '같은 파일 줄이 또 담겼다');
  const meta = await W.readMeta(db);
  assert.strictEqual(meta.meName, '대표');
  assert.strictEqual(meta.lastImportAt, NOW + 60000);
  const listed = await W.list(db, 1, NOW);
  assert.ok(listed.items.some((x) => x.src === 'export') && listed.items.some((x) => x.src === 'notify'), '목록에 출처가 없다');
  assert.strictEqual(listed.meta.meName, '대표');
});

test('서버: 대표 이름은 저장본에 있는 사람일 때만 받는다', async () => {
  const db = await seeded();
  await W.importExport(db, 'u1', payload({ meName: '엉뚱한 사람' }), NOW);
  assert.strictEqual((await W.readMeta(db)).meName, '');
});

test('서버: 받을 파일 — 상태는 정한 값만, 끝내려면 보낼 곳이 있어야, 수정차수가 오른다', async () => {
  const db = await seeded();
  await W.importExport(db, 'u1', payload(), NOW);
  const l = await W.listFiles(db, NOW);
  assert.strictEqual(l.items.length, 1);
  const id = l.items[0].id;
  assert.strictEqual(l.items[0].status, 'todo');
  assert.strictEqual((await W.setFiles(db, 'u1', { ids: [id], status: 'deleted' }, NOW)).ok, false);
  assert.strictEqual((await W.setFiles(db, 'u1', { ids: [id], status: 'done' }, NOW)).ok, false, '보낼 곳 없이 끝냈다');
  assert.strictEqual((await W.setFiles(db, 'u1', { ids: [id], status: 'got' }, NOW)).changed, 1, '구독 안 한 자리에서 트랜잭션이 접혔다');
  const r = await W.setFiles(db, 'u1', { ids: [id], status: 'done', dest: 'pc' }, NOW + 1);
  assert.strictEqual(r.changed, 1);
  const f = db.data.kakaoWork.files[id];
  assert.strictEqual(f.status, 'done');
  assert.strictEqual(f.dest, 'pc');
  assert.strictEqual(f.revision, 3);
  assert.strictEqual(f.entityType, 'Document');
});

test('서버: 45일 지난 파일 줄은 치운다', async () => {
  const db = await seeded();
  db.data.kakaoWork.files = { aaaaaaaa: { id: 'aaaaaaaa', name: '옛.xlsx', sentAt: NOW - 50 * 86400000 } };
  const l = await W.listFiles(db, NOW);
  assert.strictEqual(l.items.length, 0);
  assert.strictEqual(db.data.kakaoWork.files.aaaaaaaa, undefined);
});

test('서버: 새 갈래(kakaoImport·kakaoFiles·kakaoFileSet)는 총괄관리자만', () => {
  const src = read('functions/index.js');
  for (const a of ['kakaoImport', 'kakaoFiles', 'kakaoFileSet']) {
    const i = src.indexOf(`if (action === "${a}")`);
    assert.ok(i > 0, a + ' 가 없다');
    assert.match(src.slice(i, i + 160), /requireTotalAdmin\(req\)/, a + ' 에 총괄관리자 검사가 없다');
  }
});

/* ── 화면 ──────────────────────────────────────────────────────────── */
const cut = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, head + ' 가 없다'); const j = src.indexOf('\nfunction ', i + 1); return src.slice(i, j > 0 ? j : undefined); };

test('화면: 원본 .txt 는 브라우저 안에서만 읽고, 서버로는 가린 줄만 보낸다', () => {
  const w = read('work.html');
  const f = cut(w, 'function kkTxtFile(');
  assert.match(f, /K\.parseExport\(r\[0\]/, '저장본을 화면에서 읽지 않는다');
  assert.match(f, /K\.maskCount\(x\.text\)/, '보내기 전에 가리지 않는다');
  assert.match(f, /kkCall\('kakaoImport',\{room:room,lines:lines,files:fl,photos:p\.photos,dryRun:true\}\)/, '미리보기 없이 넣는다');
  assert.ok(!/kakaoImport',\{[^}]*\btext:\s*r\[0\]/.test(f), '원본 글 전체를 서버로 보낸다');
  assert.match(f, /K\.pickRoom\(r\[1\],p\.rooms\)/, '받는 방 목록과 견주지 않는다');
  assert.match(f, /if\(!room\) return kkImportFail\(/, '받는 방이 아닌데 멈추지 않는다');
});

test('화면: 보낼 곳은 미리 고를 뿐 — 보내기는 확인 뒤, 창은 앱바 한 길로 하나씩', () => {
  const w = read('work.html');
  const s = cut(w, 'function kkSend(');
  assert.match(s, /confirm\(/, '묻지 않고 보낸다');
  assert.match(s, /PuAppBar\.goApp\('pu-photos\.html\?take='/);
  assert.match(s, /PuAppBar\.goApp\('pu-cards\.html\?take='\+encodeURIComponent\(k\)\+'&to=co'\)/);
  assert.ok(!/window\.open\(/.test(s), '창을 따로 연다 — 창이 둘이 된다');
  assert.match(s, /by\.photo\.length&&by\.co\.length/, '두 창을 한 번에 열어 팝업이 막힌다');
  assert.ok(!/급여데이터함|pu-paydata/.test(s), '감춘 급여데이터함으로 보낸다');
  assert.match(w, /<script src="js\/pu-handoff\.js\?v=\d+"><\/script>/);
  assert.match(w, /<script src="js\/pu-kakao-work\.js\?v=\d+"><\/script>/);
});

test('화면: 받은 파일 폴더는 읽기만 하고, 다시 묻는 허락은 단추에서만', () => {
  const w = read('work.html');
  assert.match(cut(w, 'function kkDlPick('), /mode:'read'/);
  assert.match(cut(w, 'function kkDlAllow('), /requestPermission\(\{mode:'read'\}\)/);
  assert.ok(!/requestPermission/.test(cut(w, 'function kkDlInit(')), '열자마자 허락을 묻는다 — 사람이 누른 순간에만 된다');
  assert.ok(!/createWritable|removeEntry/.test(cut(w, 'function kkDlScan(')), '받은 파일 폴더를 고친다');
});

test('기업정보함: 카톡에서 건넨 파일은 메일 첨부와 «같은 창·같은 담기»로', () => {
  const c = read('pu-cards.html');
  const t = cut(c, 'function mbTakeToCo(');
  assert.match(t, /q\.get\('to'\) !== 'co'/);
  assert.match(t, /PuHandoff\.take\(k\)/);
  assert.match(t, /mbAttToCo\(0, \{ atts: \[/, '새 담기 창을 따로 지었다');
  assert.match(c, /hideCardsLogin\(\); ErpMatch\.load\(\); mbTakeToCo\(\);/, '로그인 뒤에 받지 않는다');
  assert.match(cut(c, 'function mbAttFetch('), /if\(a && a\.bytes\) return Promise\.resolve\(/, '건네받은 바이트를 서버에 다시 묻는다');
});

/* ── 📂 카톡 폴더에서 저장본 저절로 줍기 (2026-10-24) ─────────────────────── */
test('화면: 끌어 놓기·파일 고르기·폴더 줍기는 «같은 길»(kkTxtFile)로 읽는다', () => {
  const w = read('work.html');
  assert.match(cut(w, 'function kkTxtFiles('), /kkTxtFile\(f,\{\}\)/);
  assert.match(cut(w, 'function kkPickAuto('), /kkTxtFile\(f,\{auto:true\}\)/, '폴더에서 찾은 것을 다른 길로 넣는다');
  assert.match(cut(w, 'function kkPickOpen('), /kkTxtFile\(P\.found\[0\],\{auto:true\}\)/);
});

test('화면: 폴더에서 찾은 저장본도 받는 방이 아니면 «창 없이» 건너뛰고, 넣는 것은 사람이 누른다', () => {
  const w = read('work.html');
  const f = cut(w, 'function kkTxtFile(');
  assert.match(f, /if\(!room&&opt\.auto\)\{ kkPickMark\(f,'room'\); return; \}/, '다른 방 저장본에 오류 창을 띄우거나 넣는다');
  assert.match(f, /if\(!p\.ok\)\{ if\(opt\.auto\)\{ kkPickMark\(f,'skip'\); return; \} \}/, '카톡 저장본이 아닌 .txt 에 오류 창을 띄운다');
  assert.match(f, /dryRun:true/, '폴더에서 찾았다고 미리보기 없이 넣는다');
  const a = cut(w, 'function kkPickAuto(');
  assert.match(a, /\$\('modalbg'\)/, '다른 창이 떠 있는데 덮어 띄운다');
  assert.match(a, /KK\.pickAuto\[sig\]/, '같은 파일을 열 때마다 또 띄운다');
  assert.match(cut(w, 'function kkImportGo('), /if\(P\.file\) kkPickMark\(P\.file,'imp'\)/, '넣은 저장본을 다시 띄운다');
});

test('화면: 새 저장본 = 마지막으로 넣은 때 뒤 · 30일 안 · 이 PC 가 처리 안 한 것', () => {
  const w = read('work.html');
  const f = cut(w, 'function kkPickFind(');
  assert.match(f, /since=Math\.max\(Number\(KK\.meta\.lastImportAt\|\|0\),cut\)/);
  assert.match(f, /f\.lastModified>since&&!seen\[kkPickSig\(f\)\]/);
  assert.ok(!/createWritable|removeEntry|\.remove\(/.test(f), '카톡 폴더 파일을 고치거나 지운다');
});

test('화면: 카톡 폴더는 열 때 살피되, 허락을 다시 묻는 것은 단추에서만', () => {
  const w = read('work.html');
  assert.match(cut(w, 'function renderKakao('), /if\(!KK\.dlInit\) kkDlInit\(\);/);
  assert.match(cut(w, 'function kkPickHtml('), /onclick="kkDlAllow\(\)"/);
  assert.ok(!/requestPermission/.test(cut(w, 'function kkPickFind(')));
  assert.match(cut(w, 'function kkDlScan('), /if\(KK\.dlBusy\) return KK\.dlBusy;/, '폴더 살피기가 겹쳐 돈다');
});
