'use strict';
/* 📎 첨부파일함 (대표 지시 2026-10-07 전체 점검 — 다음메일에 있고 우리에게만 없던 칸)

   ★ 실측 2026-10-07 — 첨부가 붙은 메일 5,709통(첨부 10,593개). 그중 4,408통은 파일
     이름이 이미 거울에 있다(row.an · 7,354개). 그래서 요금 0원으로 목록이 된다.

   지키는 것
   ① 이름(an)이 있는 것만 담는다 · 이름 없는 첨부는 «수를 적어» 알린다
   ② 보낸 칸도 함께 본다 — 우리가 보낸 계약서·명세서가 거기 있다(실측 1,040통)
   ③ 내려받기를 여기 두지 않는다 — 조각 번호가 없어 «다른 파일»이 내려올 수 있다
   ④ 한 줄에 하나 · 종류는 확장자로만 가른다(판독 안 함)
   ⑤ 옆줄 칸에는 수를 안 적는다 — 그릴 때마다 7천 줄을 훑으면 그것이 곧 느림이다
   ⑥ 찾기는 목록만 다시 그린다 — 통째로 그리면 글자 칸에서 손이 떨어진다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

const 하루 = 86400000;
const 이제 = Date.UTC(2026, 9, 7, 3, 0, 0);
const 날 = (d) => 이제 - d * 하루;

function box(o) {
  o = o || {};
  const ctx = {
    Object, String, Number, Array, Math, Date, JSON, RegExp,
    esc: (s) => String(s == null ? '' : s),
    state: o.state || {},
    _mbMsgs: o.msgs || {},
    mbFolderBy: (s) => (o.folders || {})[s] || null,
    mbFolderLabel: (f) => String((f && (f.name || f.path)) || ''),
    mbTime: (d) => String(d || ''),
    mbMemoOf: () => (ctx._memo || (ctx._memo = {})),
    mbLoadingBox: () => !!o.loading,
    $: () => null,
  };
  vm.createContext(ctx);
  const m = app.match(/const MB_ATT_KINDS = \[[\s\S]*?\n\];/);
  assert.ok(m, 'MB_ATT_KINDS 를 앱에서 찾지 못했습니다');
  vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  ['MB_ATT_ID', 'MB_ATT_PAGE'].forEach((k) => {
    const g = app.match(new RegExp('const ' + k + ' = [^;]+;'));
    assert.ok(g, k + ' 를 앱에서 찾지 못했습니다');
    vm.runInContext('var ' + g[0].slice('const '.length), ctx);
  });
  ['mbAttExt', 'mbAttKindOf', 'mbAttScan', 'mbAttFiles', 'mbAttTally', 'mbAttRows',
    'mbAttShown', 'mbAttListHtml', 'mbAttCntText', 'mbAttBoxHtml']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}

const F = { IN: { name: '받은메일함' }, SENT: { name: '보낸메일함' } };
const 줄 = (u, o) => Object.assign({ u: u, e: 'a@b.kr', f: '홍길동', s: '제목', d: 날(1), a: 1 }, o);

test('★★★ 첨부 이름이 있는 줄만 담는다 — 이름 하나가 한 줄', () => {
  const c = box({ folders: F, msgs: { IN: {
    '1': 줄(1, { an: ['사업자등록증.pdf', '통장사본.jpg'], a: 2 }),
    '2': 줄(2, { an: ['급여대장.xlsx'] }),
  } } });
  const r = c.mbAttFiles();
  assert.equal(r.length, 3);
  assert.equal(r.map((x) => x.name).sort().join(','), '급여대장.xlsx,사업자등록증.pdf,통장사본.jpg');
});

test('★★★ 이름이 없는데 첨부는 있는 메일은 «수를 센다» — 안 적으면 「왜 안 보이나」가 된다', () => {
  const c = box({ folders: F, msgs: { IN: {
    '1': 줄(1, { an: ['가나상사 계약서.hwp'] }),
    '2': 줄(2, { a: 3 }),          /* 첨부는 셋인데 이름이 없다 */
    '3': 줄(3, { a: 0 }),          /* 첨부가 아예 없다 — 세지 않는다 */
  } } });
  const s = c.mbAttScan();
  assert.equal(s.files.length, 1);
  assert.equal(s.noName, 1, '이름 없는 «메일 수»다 — 첨부 개수가 아니다');
  assert.equal(s.mails, 1);
});

test('★★★ 목록 아래에 그 수를 «실제로 그린다» — 글자만 적어 두면 가려도 모른다', () => {
  const c = box({ folders: F, msgs: { IN: {
    '1': 줄(1, { an: ['가.pdf'] }), '2': 줄(2, { a: 2 }), '3': 줄(3, { a: 1 }),
  } } });
  const h = c.mbAttBoxHtml();
  assert.ok(/이름이 없는 메일 2통/.test(h), '그려진 화면에 그 수가 있어야 한다: ' + h.slice(-400));
  assert.ok(/거르개/.test(h), '어디서 찾는지도 함께 알려야 한다');
});

test('★★ 이름 없는 메일이 없으면 그 안내도 없다 — 늘 켜진 등은 아무것도 못 알린다', () => {
  const c = box({ folders: F, msgs: { IN: { '1': 줄(1, { an: ['가.pdf'] }) } } });
  assert.ok(!/이름이 없는 메일/.test(c.mbAttBoxHtml()));
});

test('★★★ 보낸 칸도 함께 본다 — 우리가 보낸 계약서가 거기 있다', () => {
  const c = box({ folders: F, msgs: {
    IN: { '1': 줄(1, { an: ['문의서.pdf'] }) },
    SENT: { '9': 줄(9, { an: ['자문계약서.hwp'], d: 날(2) }) },
  } });
  assert.equal(c.mbAttFiles().map((x) => x.box).sort().join(','), '받은메일함,보낸메일함');
});

test('★★★ 읽어 올 칸도 «모든 칸»이다 — 받은 칸만 보면 보낸 첨부가 통째로 빠진다', () => {
  const src = strip(sliceFn(app, 'function mbNeedSlugs('));
  const i = src.indexOf('MB_ATT_ID');
  assert.ok(i > 0, 'mbNeedSlugs 가 첨부파일함을 알아야 한다');
  assert.ok(/mbFolders\(\)\.map/.test(src.slice(i, i + 140)), '모든 칸을 돌려줘야 한다');
  assert.ok(!/mbGotFolder/.test(src.slice(i, i + 140)), '받은 칸만 고르면 안 된다');
});

test('★★★ 새것이 위로 — 같은 날짜면 이름 차례', () => {
  const c = box({ folders: F, msgs: { IN: {
    '1': 줄(1, { an: ['나.pdf'], d: 날(5) }),
    '2': 줄(2, { an: ['가.pdf'], d: 날(5) }),
    '3': 줄(3, { an: ['최신.pdf'], d: 날(1) }),
  } } });
  assert.equal(c.mbAttFiles().map((x) => x.name).join(','), '최신.pdf,가.pdf,나.pdf');
});

/* ══ 종류 ══ */
test('★★★ 확장자로만 가른다 — 판독하지 않는다', () => {
  const c = box({});
  assert.equal(c.mbAttKindOf('사업자등록증.PDF'), 'pdf', '대문자도 같다');
  assert.equal(c.mbAttKindOf('급여대장.xlsx'), 'xls');
  assert.equal(c.mbAttKindOf('취업규칙.hwpx'), 'hwp');
  assert.equal(c.mbAttKindOf('명함.jpeg'), 'img');
  assert.equal(c.mbAttKindOf('묶음.zip'), 'zip');
  assert.equal(c.mbAttKindOf('이름없는것'), 'etc', '점이 없으면 그 밖');
  assert.equal(c.mbAttExt('a.b.tar.gz'), 'gz', '마지막 점 뒤가 확장자다');
  assert.equal(c.mbAttExt('.gitignore'), '', '앞의 점은 확장자가 아니다');
});

test('★★ 갈래마다 몇 개인지 센다 · 그 밖도 센다', () => {
  const c = box({ folders: F, msgs: { IN: {
    '1': 줄(1, { an: ['가.pdf', '나.pdf'], a: 2 }),
    '2': 줄(2, { an: ['다.xlsx'] }),
    '3': 줄(3, { an: ['라.알수없음'] }),
  } } });
  const t = c.mbAttTally(c.mbAttFiles());
  assert.equal(t.all, 4);
  assert.equal(t.pdf, 2);
  assert.equal(t.xls, 1);
  assert.equal(t.etc, 1);
});

/* ══ 거르개 ══ */
test('★★★ 종류 칩 · 기간 · 찾는 말이 함께 걸린다', () => {
  const msgs = { IN: {
    '1': 줄(1, { an: ['가나상사 사업자등록증.pdf'], d: 날(3) }),
    '2': 줄(2, { an: ['가나상사 급여대장.xlsx'], d: 날(3) }),
    '3': 줄(3, { an: ['다라물산 사업자등록증.pdf'], d: 날(400) }),
  } };
  const kind = box({ folders: F, msgs: msgs, state: { mbAttKind: 'pdf' } });
  assert.equal(kind.mbAttRows(이제).length, 2);

  const 기간 = box({ folders: F, msgs: msgs, state: { mbAttDays: 90 } });
  assert.equal(기간.mbAttRows(이제).length, 2, '400일 전 것은 빠진다');

  const 찾기 = box({ folders: F, msgs: msgs, state: { mbAttQ: '가나상사' } });
  assert.equal(찾기.mbAttRows(이제).length, 2);

  const 둘다 = box({ folders: F, msgs: msgs, state: { mbAttKind: 'pdf', mbAttQ: '다라' } });
  assert.equal(둘다.mbAttRows(이제).length, 1);
});

test('★★ 빈칸은 «양쪽 다» 무시한다 — 파일 이름에만 띄어쓰기가 있는 때가 많다', () => {
  const msgs = { IN: { '1': 줄(1, { an: ['가나 상사 계약서.hwp'] }) } };
  /* 찾는 말에만 빈칸 */
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttQ: ' 가나 상사 ' } }).mbAttRows(이제).length, 1);
  /* 파일 이름에만 빈칸 — 거르는 쪽에서도 지워야 잡힌다 */
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttQ: '가나상사' } }).mbAttRows(이제).length, 1);
});

test('★★ 보낸 사람·메일 제목으로도 찾는다 — 파일 이름을 모를 때가 많다', () => {
  const msgs = { IN: { '1': 줄(1, { an: ['scan001.pdf'], f: '김노무', s: '체불 진정 관련' }) } };
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttQ: '김노무' } }).mbAttRows(이제).length, 1);
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttQ: '체불' } }).mbAttRows(이제).length, 1);
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttQ: '없는말' } }).mbAttRows(이제).length, 0);
});

/* ══ 그리기 ══ */
test('★★★ 한 번에 200개까지만 그린다 — 7천 줄을 한꺼번에 그리면 화면이 멎는다', () => {
  const m = {};
  for (let i = 1; i <= 260; i++) m[String(i)] = 줄(i, { an: ['파일' + i + '.pdf'], d: 날(i % 30) });
  const c = box({ folders: F, msgs: { IN: m } });
  assert.equal(c.mbAttShown(), 200);
  assert.equal((c.mbAttListHtml().match(/class="dm-att"/g) || []).length, 200);
  c.state.mbAttShow = 400;
  assert.equal((c.mbAttListHtml().match(/class="dm-att"/g) || []).length, 260);
});

test('★★★ 줄 하나는 «한 줄»이다 — 넓다고 두 줄로 쌓지 않는다', () => {
  const css = app.slice(app.indexOf('.dm-att{'), app.indexOf('.dm-att{') + 400);
  assert.ok(/white-space:nowrap/.test(css), '한 줄로 못 박아야 한다');
  assert.ok(/text-overflow:ellipsis/.test(app.slice(app.indexOf('.dm-att .nm{'),
    app.indexOf('.dm-att .nm{') + 160)), '길면 … 로 줄인다');
});

test('★★★ 내려받기를 여기 두지 않는다 — 조각 번호가 없어 다른 파일이 내려올 수 있다', () => {
  const src = strip(sliceFn(app, 'function mbAttListHtml('));
  assert.ok(!/mbAtt\(|mbAttFetch|mbAttPeek|mbAttReq/.test(src),
    '목록에서 바로 받는 길을 만들면 안 된다: ' + src.slice(0, 200));
  assert.ok(/mbOpenMsg\('\$\{esc\(f\.slug\)\}','\$\{esc\(f\.u\)\}'\)/.test(src),
    '메일을 여는 길 하나여야 한다');
});

test('★★ 아직 받아 오는 중이면 「읽고 있습니다」 — 「없습니다」와 가른다', () => {
  const 중 = box({ folders: F, msgs: {}, loading: true });
  assert.ok(/읽고 있습니다/.test(중.mbAttListHtml()));
  const 끝 = box({ folders: F, msgs: {}, loading: false });
  assert.ok(/없습니다/.test(끝.mbAttListHtml()));
  assert.ok(!/읽고 있습니다/.test(끝.mbAttListHtml()));
});

test('★★ 걸러서 0개면 「찾은 첨부가 없습니다」 — 받아 오는 중이라 하지 않는다', () => {
  const c = box({ folders: F, msgs: { IN: { '1': 줄(1, { an: ['가.pdf'] }) } },
    loading: true, state: { mbAttQ: '없는말' } });
  assert.ok(/찾은 첨부가 없습니다/.test(c.mbAttListHtml()));
});

test('★★ 머리줄 수는 «거른 수 / 모두»를 함께 말한다', () => {
  const msgs = { IN: { '1': 줄(1, { an: ['가.pdf'] }), '2': 줄(2, { an: ['나.xlsx'] }) } };
  assert.equal(box({ folders: F, msgs: msgs }).mbAttCntText(), '2개');
  assert.equal(box({ folders: F, msgs: msgs, state: { mbAttKind: 'pdf' } }).mbAttCntText(),
    '1개 / 모두 2개');
});

/* ══ 자리·속도 ══ */
test('★★★ 옆줄 칸에는 수를 안 적는다 — 그릴 때마다 7천 줄을 훑으면 그것이 곧 느림이다', () => {
  const i = app.indexOf("openMailBox('${MB_ATT_ID}')");
  assert.ok(i > 0, '옆줄에 첨부파일함 줄이 있어야 한다');
  const near = app.slice(i, i + 460);
  assert.ok(!/mbAttFiles\(|mbAttScan\(|class="n"/.test(near),
    '그리는 자리에서 세면 안 된다: ' + near.slice(0, 160));
  assert.ok(/첨부파일함/.test(near));
});

test('★★★ 그리는 동안 «한 번»만 훑는다', () => {
  const src = strip(sliceFn(app, 'function mbAttScan('));
  assert.ok(/mbMemoOf\(\)/.test(src), '그리는 동안만 사는 셈에 담아야 한다');
  assert.ok(/m\.attScan/.test(src));
  const c = box({ folders: F, msgs: { IN: { '1': 줄(1, { an: ['가.pdf'] }) } } });
  assert.equal(c.mbAttScan(), c.mbAttScan(), '두 번 불러도 같은 것이어야 한다');
});

test('★★★ 찾기는 목록만 다시 그린다 — 통째로 그리면 글자 칸에서 손이 떨어진다', () => {
  const src = strip(sliceFn(app, 'function mbAttFind('));
  assert.ok(/\$\('mbAttList'\)/.test(src), '목록 칸을 집어 그려야 한다');
  assert.ok(/mbAttListHtml\(\)/.test(src));
  assert.ok(/mbMemoClear\(\)/.test(src), '셈을 안 버리면 옛 목록이 그대로 나온다');
});

test('★★★ 메일을 열면 읽는 화면이 뜬다 — 첨부 목록이 가로채면 안 된다', () => {
  const src = strip(sliceFn(app, 'function mbBoxHtml('));
  assert.ok(/mbNow\(\) === MB_ATT_ID && !state\.mbOpen/.test(src),
    '메일을 안 열었을 때만 첨부 목록이다: ' + src.slice(0, 200));
});

test('★★ 돌아갈 자리 이름이 있다 — 없으면 「메일함」이라 적혀 어디로 가는지 모른다', () => {
  const src = strip(sliceFn(app, 'function mbBoxName('));
  assert.ok(/MB_ATT_ID\) return '📎 첨부파일함'/.test(src));
});
