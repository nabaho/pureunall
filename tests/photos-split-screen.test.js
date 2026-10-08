'use strict';
// 📑 여러 장으로 나누기 — 화면 쪽 · node --test tests/photos-split-screen.test.js
//
// 대표 지시 2026-10-08 「여러장이 될 수 있다」 — 찾는 계산은 tests/pu-photo-split.test.js 가 본다.
// 이 검사가 지키는 것
//   ①★★ 나눈 조각은 원본의 판독을 «물려받지 않는다» — 신청서가 등록증으로 붙던 바로 그 병
//   ②★★ 편집본·조각은 원본 «파일 주소·자리»를 물려받지 않는다 — 남에게 원본이 보이고 서류 주소가 남는다
//   ③★  체크한 조각만 담는다 · 원본 휴지통은 체크했을 때만, 다 담은 «뒤에»만
//   ④★  가다 끊기면 원본은 그대로, 담은 조각은 체크를 풀어 다시 눌러도 두 장이 안 생긴다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');

function grab(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = SRC.indexOf('{', i);
  for (; j < SRC.length; j++) { if (SRC[j] === '{') d++; else if (SRC[j] === '}' && --d === 0) { j++; break; } }
  const head = SRC.lastIndexOf('\n', i);
  return SRC.slice(head + 1, j);
}

function box(o) {
  const log = { saved: [], deleted: [], alerts: [], closed: 0, read: 0 };
  const ctx = {
    console: { warn() {}, log() {} }, Object, Date, String, Number, Promise, Array, JSON,
    viewerId: 'SRC',
    PuPhotoStore: {
      TRASH_DAYS: 30,
      n: 0,
      newId() { return 'N' + (++this.n); },
      savePhoto(p) {
        if (o.failAt && log.saved.length + 1 === o.failAt) return Promise.reject(new Error('막힘'));
        log.saved.push(p); return Promise.resolve();
      },
      deletePhoto(y, id, why, owner) { log.deleted.push({ y, id, why, owner }); return Promise.resolve(); }
    },
    shrinkDataUrl: (s) => Promise.resolve('thumb:' + s),
    photoYearOf: () => '2026', photoOwner: () => undefined, isMinePhoto: () => o.mine !== false,
    maskItem: () => null, renderReadPanel() {}, renderViewerEdit() {}, renderGrid() {}, renderGridBar() {},
    refreshTrashCount() {}, closeViewer() { log.closed++; }, toast() {}, autoReadSoon() { log.read++; },
    alert(m) { log.alerts.push(m); }
  };
  vm.createContext(ctx);
  vm.runInContext('var photoEd = null; var gridItems = [];\n' +
    ['edCopyMeta', 'splitPieceMeta', 'edSplitKeep'].map(grab).join('\n'), ctx);
  return { ctx, log };
}

const SRC_META = {
  takenAt: 111, upAt: 222, byName: '홍길동', folder: 'F1', kind: 'doc', note: '현장',
  read: { kind: 'bizreg', fields: { company: '가나상사' } }, company: '가나상사', customKind: 'bizreg',
  fullUrl: 'https://x/full?token=T', thumbUrl: 'https://x/thumb?token=T', loc: 'storage',
  used: { by: 'gov' }, doc: { group: 'g' }, shareWith: { U2: true }, shareBy: 'U1',
  __year: '2026', __ownerUid: 'U1', hasText: true, sharp: 0.9
};

function startWith(b, pieces, trash) {
  b.ctx.gridItems = [{ id: 'SRC', meta: JSON.parse(JSON.stringify(SRC_META)) }];
  b.ctx.photoEd = { id: 'SRC', status: 'ready', mode: 'split', split: { boxes: [] },
    pieces: pieces, splitTrash: !!trash };
}
const P = (n, on) => ({ full: 'data:image/jpeg;base64,P' + n, on: on !== false, w: 100 + n, h: 200 + n });

test('★★ 나눈 조각은 원본의 판독·업체·사람이 정한 갈래를 물려받지 않는다', async () => {
  const b = box({});
  startWith(b, [P(1), P(2)]);
  await b.ctx.edSplitKeep();
  assert.equal(b.log.saved.length, 2);
  b.log.saved.forEach((s) => {
    assert.equal(s.meta.read, undefined, '★★ 조각이 원본 판독(사업자등록증)을 물려받았습니다');
    assert.equal(s.meta.company, undefined);
    assert.equal(s.meta.customKind, undefined);
    assert.equal(s.meta.kind, 'doc');
  });
  const m = b.log.saved[0].meta;
  assert.equal(m.takenAt, 111, '찍은 날은 물려받습니다 — 같은 때 찍은 것입니다');
  assert.equal(m.byName, '홍길동');
  assert.equal(m.folder, 'F1');
  assert.equal(m.w, 101); assert.equal(m.h, 201);
  assert.equal(m.splitFrom.id, 'SRC', '어느 사진에서 나왔는지 남아야 합니다');
  assert.equal(m.splitFrom.of, 2);
});

test('★★ 조각·편집본은 원본 «파일 주소·자리»와 공유·쓰임 표를 물려받지 않는다', async () => {
  const b = box({});
  startWith(b, [P(1)]);
  await b.ctx.edSplitKeep();
  const m = b.log.saved[0].meta;
  for (const k of ['fullUrl', 'thumbUrl', 'loc', 'shareWith', 'shareBy', 'used', 'doc', '__year', '__ownerUid']) {
    assert.equal(m[k], undefined, '★★ 원본의 ' + k + ' 를 물려받았습니다');
  }
  /* 편집본(✂️ 자르기·✨ 지우기)도 같은 길을 쓴다 */
  const e = b.ctx.edCopyMeta(JSON.parse(JSON.stringify(SRC_META)));
  assert.equal(e.fullUrl, undefined, '★★ 편집본이 원본 파일 주소를 물려받았습니다 — 남에게 고치기 전 원본이 보입니다');
  assert.equal(e.thumbUrl, undefined);
  assert.equal(e.loc, undefined);
  assert.equal(e.__year, undefined);
  assert.equal(e.read.kind, 'bizreg', '편집본은 판독을 물려받습니다(민감 여부가 거기 있다)');
});

test('★ 체크한 조각만 담고, 원본은 그대로 둔다(체크 안 함)', async () => {
  const b = box({});
  startWith(b, [P(1), P(2, false), P(3)]);
  await b.ctx.edSplitKeep();
  assert.deepEqual(b.log.saved.map((s) => s.full), ['data:image/jpeg;base64,P1', 'data:image/jpeg;base64,P3']);
  assert.equal(b.log.deleted.length, 0, '★ 체크도 안 했는데 원본을 휴지통으로 보냈습니다');
  assert.equal(b.ctx.photoEd, null);
  assert.ok(b.ctx.gridItems.some((x) => x.id === 'SRC'), '원본이 목록에서 사라졌습니다');
  assert.equal(b.log.read, 1, '새 조각은 판독 차례에 들어야 합니다');
});

test('★ 원본 휴지통 — 체크했을 때, 다 담은 뒤에, 까닭과 함께', async () => {
  const b = box({});
  startWith(b, [P(1), P(2)], true);
  await b.ctx.edSplitKeep();
  assert.equal(b.log.deleted.length, 1);
  assert.equal(b.log.deleted[0].id, 'SRC');
  assert.ok(/나눔/.test(b.log.deleted[0].why), '왜 지웠는지 남겨야 합니다');
  assert.ok(!b.ctx.gridItems.some((x) => x.id === 'SRC'));
  assert.equal(b.log.closed, 1, '지운 사진을 계속 보여 주면 안 됩니다');
});

test('★ 남의 사진이면 체크해도 원본을 안 치운다', async () => {
  const b = box({ mine: false });
  startWith(b, [P(1), P(2)], true);
  await b.ctx.edSplitKeep();
  assert.equal(b.log.deleted.length, 0);
});

test('★ 가다 끊기면 원본은 그대로, 담은 조각은 체크를 풀어 다시 눌러도 두 장이 안 생긴다', async () => {
  const b = box({ failAt: 2 });
  startWith(b, [P(1), P(2), P(3)], true);
  await b.ctx.edSplitKeep();
  assert.equal(b.log.saved.length, 1);
  assert.equal(b.log.deleted.length, 0, '★ 다 못 담았는데 원본을 휴지통으로 보냈습니다');
  assert.equal(b.log.alerts.length, 1);
  const ed = b.ctx.photoEd;
  assert.ok(ed && ed.pieces, '끊겼을 때 나눈 결과를 버리면 처음부터 다시 해야 합니다');
  assert.deepEqual(ed.pieces.map((p) => p.on), [false, true, true], '담은 조각의 체크를 안 풀었습니다');
  assert.equal(ed.splitBusy, null);
});

test('편집기 도구 — 자르기 칸 안에 나누기 들어가는 길이 있고, 계산 층을 싣는다', () => {
  assert.ok(/<script src="js\/pu-photo-split\.js\?v=\d+"><\/script>/.test(SRC), '계산 층을 안 실었습니다');
  assert.ok(/setEdMode\(\\'split\\'\)/.test(grab('edPanelHtml')), '자르기 칸에서 나누기로 가는 단추가 없습니다');
});
