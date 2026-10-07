/* 사진첩 전수 점검(2026-10-07) — 화면 쪽 두 가지

   ① 옛 자리 → 창고 (pu-photos.html legacyHealSweep)
      창고가 막혀 실시간DB 로 물러난 사진 73장이 «돌아갈 길»이 없었다. 주인 기기가 사진첩을
      열 때 «자기 사진만» 몇 장씩 옮긴다. 저장 층(healToStorage)은 pu-photo-store.test.js 가 본다.
      ⚠ 여기서 지키는 것: «내 사진»을 제대로 골라 넘기는가. photoOwner 는 «내 자리»면
        undefined 를 줘서, 그것과 견주면 내 사진이 하나도 안 걸린다(만들다 실제로 밟았다).

   ② 정부사업일정 사진 고르기 (gov-consulting.html pkKindOf)
      안 읽은 사진(meta.kind:'doc' — 카메라 기본값)이 「기타서류」가 되어 증빙 칸 고르기에서
      빠졌다. 사진첩에서는 «사진 칸»에 보이는데 여기서는 안 보였다(박재원 노무사 현장 사진).
      ★ 규칙: 판독된 사진은 사진첩 laneOf 가 «사진»이라 하면 여기서도 «회의·현장»이다.
              안 읽은 사진은 «판독 전»으로 따로 보이고, 증빙 칸 고르기에서도 빠지지 않는다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PHOTOS = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
const GOV = fs.readFileSync(path.join(ROOT, 'gov-consulting.html'), 'utf8');

/* 함수 하나를 «원문 그대로» 뜬다 — 길이를 못 박지 않고 괄호를 센다 */
function grab(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 를 못 찾았다');
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(name + ' 끝을 못 찾았다');
}
const { stripComments, stripJs } = require('./strip-comments.js');

/* ══════════ ① 옛 자리 → 창고 ══════════ */

function healBox(o) {
  const calls = [];
  let resolveHeal;
  const ctx = {
    Set, Object, console: { info() {}, warn() {} },
    gridOwner: o.gridOwner,
    gridYear: '2026', ALL_YEARS: '__years__', ALL_OWNERS: '__all__', SHARED_OWNER: '__shared__',
    gridItems: o.items,
    PuPhotoStore: {
      myUid: () => 'ME',
      getMode: () => o.mode || 'storage',
      healToStorage: (rows) => { calls.push(rows); return new Promise(r => { resolveHeal = r; }); }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(['isMinePhoto', 'photoOwner', 'photoYearOf', 'nowYear'].map(n => grab(PHOTOS, n)).join('\n') +
    '\nvar _healSwept = false;\n' + grab(PHOTOS, 'legacyHealSweep'), ctx);
  return { ctx, calls, finish: (r) => resolveHeal(r) };
}

const ITEMS = () => [
  { id: 'mine1', meta: { takenAt: 1 } },
  { id: 'mine2', meta: { takenAt: 1, loc: 'storage' } },
  { id: 'mine3', meta: { takenAt: 1, __year: '2025' } },
  { id: 'theirs', meta: { takenAt: 1, __ownerUid: 'U2' } },
  { id: 'shared', meta: { takenAt: 1, __ownerUid: 'U3', __sharedYear: '2026' } }
];

test('★ 내 화면에서 «내 사진·옛 자리 것»만 넘긴다 — 남의 것·받은 것·이미 창고인 것은 빼고', async () => {
  const b = healBox({ gridOwner: '', items: ITEMS() });
  b.ctx.legacyHealSweep();
  assert.equal(b.calls.length, 1, '내 옛 자리 사진이 있는데 옮기기를 안 불렀습니다(내 사진을 못 알아봤습니다)');
  const ids = Array.from(b.calls[0], r => r.id).sort();
  assert.deepEqual(ids, ['mine1', 'mine3']);
  const y = {}; Array.from(b.calls[0]).forEach(r => { y[r.id] = r.year; assert.equal(r.owner, 'ME'); });
  assert.equal(y.mine3, '2025', '사진이 놓인 해로 넘겨야 합니다 — 화면의 해로 넘기면 엉뚱한 자리를 찾습니다');
  assert.equal(y.mine1, '2026');
});

test('★ 옮겨진 장만 화면 정보를 «창고»로 고친다 — 실패한 장은 그대로', async () => {
  const b = healBox({ gridOwner: '', items: ITEMS() });
  b.ctx.legacyHealSweep();
  b.finish({ moved: 1, failed: 1, ids: ['mine1'] });
  await new Promise(r => setTimeout(r, 0));
  const by = {}; b.ctx.gridItems.forEach(it => { by[it.id] = it.meta.loc; });
  assert.equal(by.mine1, 'storage');
  assert.equal(by.mine3, undefined, '못 옮긴 장까지 «창고»로 적었습니다 — 열 때 없는 자리를 찾습니다');
});

test('한 판에 한 번만 — 다시 그려도 또 옮기지 않는다', () => {
  const b = healBox({ gridOwner: '', items: ITEMS() });
  b.ctx.legacyHealSweep();
  b.ctx.legacyHealSweep();
  assert.equal(b.calls.length, 1);
});

test('남의 사진만 보던 판(관리자가 다른 사람 보기)에서는 아무것도 안 하고, 내 판에서 돈다', () => {
  const b = healBox({ gridOwner: 'U2', items: [{ id: 'x', meta: { takenAt: 1 } }] });
  b.ctx.legacyHealSweep();
  assert.equal(b.calls.length, 0, '★ 남의 사진을 내 것처럼 넘겼습니다');
  b.ctx.gridOwner = '';
  b.ctx.gridItems = ITEMS();
  b.ctx.legacyHealSweep();
  assert.equal(b.calls.length, 1, '남의 판을 본 뒤로 내 판에서 영영 안 돕니다');
});

test('창고 방식이 아니면 아무것도 안 한다', () => {
  const b = healBox({ gridOwner: '', items: ITEMS(), mode: 'rtdb' });
  b.ctx.legacyHealSweep();
  assert.equal(b.calls.length, 0);
});

test('사진 목록을 다 읽은 «뒤»에 부른다', () => {
  const s = stripComments(PHOTOS);
  const gov = s.indexOf('govShareSweep();');
  assert.ok(gov > 0, '목록 읽은 뒤 훑기 자리를 못 찾았다');
  const fn = s.lastIndexOf('function ', gov);
  const end = s.indexOf('\nfunction ', gov);
  assert.ok(/legacyHealSweep\(\)/.test(s.slice(fn, end)), '목록을 읽은 뒤 옛 자리 옮기기를 안 부릅니다');
});

/* ══════════ ② 정부사업일정 사진 고르기 ══════════ */

function govBox() {
  const ctx = {};
  vm.createContext(ctx);
  const from = GOV.indexOf('const PK_KIND_NAME');
  const to = GOV.indexOf('function pkKindLabel(');
  assert.ok(from > 0 && to > from, '갈래 판정 표식을 못 찾았다');
  vm.runInContext(GOV.slice(from, to) + '\nthis.PK_KIND_NAME = PK_KIND_NAME;', ctx);
  return ctx;
}
function albumLane() {
  const ctx = {};
  vm.createContext(ctx);
  const at = PHOTOS.indexOf('const LANE_PIC_KINDS');
  assert.ok(at > 0);
  vm.runInContext(PHOTOS.slice(at, PHOTOS.indexOf('\n', at)) + '\n' +
    grab(PHOTOS, 'readAnyField') + '\n' + grab(PHOTOS, 'laneOf'), ctx);
  return ctx.laneOf;
}

/* 판독된 사진 — 여러 모양 */
const READ_SAMPLES = [
  { kind: 'doc', read: { kind: 'card', fields: { name: '홍길동' } } },
  { kind: 'doc', read: { kind: 'bizreg', fields: {} } },
  { kind: 'doc', read: { kind: 'contract', fields: { company: '가나상사' } } },
  { kind: 'photo', read: { kind: 'contract', fields: {} } },
  { kind: 'doc', read: { kind: 'other', fields: {} } },
  { kind: 'doc', read: { kind: 'other', fields: {}, ack: true } },
  { kind: 'doc', read: { kind: 'other', fields: { docName: '신청서' } } },
  { kind: 'doc', read: { kind: 'meeting' } },
  { kind: 'photo', read: { kind: 'meeting' } },
  { kind: 'photo', read: { kind: 'other', fields: {} } }
];

test('★ 판독된 사진은 사진첩과 같은 칸 — 사진첩이 «사진»이면 여기서는 «회의·현장»', () => {
  const g = govBox();
  const laneOf = albumLane();
  READ_SAMPLES.forEach(meta => {
    const it = { id: 'p', meta };
    const pic = laneOf(it) === 'pic';
    assert.equal(g.pkKindOf(it) === 'meeting', pic,
      '사진첩과 갈래가 어긋납니다: ' + JSON.stringify(meta) + ' → 사진첩 ' + laneOf(it) + ' / 여기 ' + g.pkKindOf(it));
  });
});

test('★ 안 읽은 사진은 «판독 전» — 카메라 기본값(doc)이라고 «기타서류»로 숨기지 않는다', () => {
  const g = govBox();
  assert.equal(g.pkKindOf({ meta: { kind: 'doc' } }), 'unread');
  assert.equal(g.pkKindOf({ meta: {} }), 'unread');
  assert.equal(g.pkKindOf({ meta: { kind: 'photo' } }), 'meeting', '사람이 «사진»이라 한 것은 회의·현장입니다');
  assert.ok(g.PK_KIND_NAME.unread, '「판독 전」 딱지 이름이 없습니다');
});

test('★ 증빙 칸 고르기(회의·현장만)에서도 «판독 전»은 들어오고, 서류는 빠진다', () => {
  const ctx = { PK: { onlyMeeting: true } };
  vm.createContext(ctx);
  const from = GOV.indexOf('const PK_KIND_NAME');
  const to = GOV.indexOf('function pkKindLabel(');
  vm.runInContext(GOV.slice(from, to) + '\n' + grab(GOV, 'pkMergeItems'), ctx);
  const out = ctx.pkMergeItems([
    { id: 'u', meta: { kind: 'doc', takenAt: 3 } },
    { id: 'm', meta: { kind: 'photo', takenAt: 2 } },
    { id: 'c', meta: { kind: 'doc', takenAt: 1, read: { kind: 'card', fields: { name: '홍길동' } } } }
  ], []);
  assert.deepEqual(Array.from(out, r => r.id).sort(), ['m', 'u']);
});

test('딱지 줄에는 갈래마다 칩 자리가 있다 — 이름만 있고 칩이 없으면 그 사진을 골라 볼 수 없다', () => {
  const g = govBox();
  const s = stripJs(grab(GOV, 'pkPaintChrome'));
  const m = s.match(/const order\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, '칩 차례 표를 못 찾았다');
  Object.keys(g.PK_KIND_NAME).forEach(k => {
    assert.ok(new RegExp("'" + k + "'").test(m[1]), '칩 차례에 「' + g.PK_KIND_NAME[k] + '」(' + k + ')가 없습니다');
  });
});
