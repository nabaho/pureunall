'use strict';
/* 푸른사진첩 — 기기 안 0원 자동 판단 엔진(1·2·3 모두) 규칙·계산·안전 울타리 검증
   실행: node --test tests/photos-auto-judge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const PuPhotoJudge = require('../js/pu-photo-judge.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
const STORE_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-photo-store.js'), 'utf8');

/* ── 합성 픽셀 도우미 ── */
function makeCanvasRgba(w, h, painter) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = painter(x, y, w, h);
      const i = (y * w + x) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function boxBlur(rgba, w, h, radius) {
  let cur = new Uint8ClampedArray(rgba);
  const next = new Uint8ClampedArray(rgba.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const p = (yy * w + xx) * 4;
            sr += cur[p]; sg += cur[p + 1]; sb += cur[p + 2]; n++;
          }
        }
        const o = (y * w + x) * 4;
        next[o] = Math.round(sr / n);
        next[o + 1] = Math.round(sg / n);
        next[o + 2] = Math.round(sb / n);
        next[o + 3] = 255;
      }
    }
    cur = new Uint8ClampedArray(next);
  }
  return cur;
}

/* ══════ ① 사진 종류 자동 분류 (Jev Choice + 확률%) ══════ */

test('① A4 세로 흰 종이 위에 글자 줄이 있는 그림은 «서류·문서(doc)»로 분류한다', () => {
  const w = 100, h = 140;
  const docRgba = makeCanvasRgba(w, h, (x, y) => {
    const inMargin = x < 10 || x >= 90 || y < 12 || y >= 128;
    if (inMargin) return [244, 244, 242];
    const textRow = (y % 9 >= 2 && y % 9 <= 4);
    const charInk = textRow && ((x * 7 + y * 3) % 5 <= 1);
    return charInk ? [28, 32, 38] : [248, 248, 246];
  });
  const res = PuPhotoJudge.classify(docRgba, w, h, 1400, 1980);
  assert.equal(res.choice, 'doc');
  assert.ok(res.prob >= 0.70, '서류 확신도가 충분해야 합니다: ' + res.prob);
  const sum = res.scores.card + res.scores.doc + res.scores.scene;
  assert.ok(Math.abs(sum - 1) < 0.01, '세 갈래 확률 합은 1 이어야 합니다');
});

test('① 어두운 책상 한가운데 놓인 명함(일반 4:3 휴대폰 촬영)은 배경에 속지 않고 «명함(card)»으로 분류한다', () => {
  const w = 140, h = 105;
  const cardOnDesk = makeCanvasRgba(w, h, (x, y) => {
    const onCard = x >= 34 && x < 106 && y >= 30 && y < 75;
    if (!onCard) return [82, 58, 40]; // 나무 책상 배경 (테두리 비율이 넓음)
    const textLine = (y === 40 || y === 49 || y === 58 || y === 66) && x >= 42 && x < 98 && (x % 3 === 0);
    return textLine ? [25, 28, 35] : [246, 246, 244];
  });
  // 휴대폰 기본 4:3 카메라 비율(4032x3024 -> 1600x1200)에서도 책상 위 명함 섬(cardIsland)으로 잡아내야 한다.
  const res = PuPhotoJudge.classify(cardOnDesk, w, h, 1600, 1200);
  assert.equal(res.choice, 'card');
  assert.ok(res.prob >= 0.60, '책상 위 명함 확신도가 충분해야 합니다: ' + res.prob);
});

test('① 색채가 풍부하고 종이 글자 획이 없는 방문·회의 풍경은 «현장·회의 사진(scene)»으로 분류한다', () => {
  const w = 128, h = 96;
  const sceneRgba = makeCanvasRgba(w, h, (x, y) => {
    if (y < 40) return [65, 138, 218];                 // 파란 하늘/배경
    if (y < 70) return [62, 145, 78];                  // 초록 나무/실내 장식
    return [168, 122, 74 + ((x * 5) % 30)];            // 바닥·탁자
  });
  const res = PuPhotoJudge.classify(sceneRgba, w, h, 1600, 1200);
  assert.equal(res.choice, 'scene');
  assert.ok(res.prob >= 0.75, '현장 사진 확신도가 높아야 합니다: ' + res.prob);
});

test('① 깨진 픽셀이나 빈 입력이 들어와도 터지지 않고 «구분 보류(unsure)»를 돌려준다', () => {
  const res = PuPhotoJudge.classify(null, 0, 0);
  assert.equal(res.choice, 'unsure');
  assert.equal(res.pct, 50);
});

/* ══════ ② 품질(흔들림·어두움) & dHash 연사 베스트컷 선별 ══════ */

test('② 또렷한 서류는 양호(ok), 심하게 흔들린 같은 서류는 흐림(blur), 어두운 사진은 어두움(dark)으로 가른다', () => {
  const w = 120, h = 120;
  const crisp = makeCanvasRgba(w, h, (x, y) => {
    const line = (y % 10 === 4) && x >= 15 && x < 105 && (x % 3 !== 0);
    return line ? [20, 20, 20] : [245, 245, 245];
  });
  const blurry = boxBlur(crisp, w, h, 5);
  const dark = makeCanvasRgba(w, h, (x, y) => [22 + (x % 8), 20 + (y % 8), 24]);

  const qCrisp = PuPhotoJudge.assessQuality(crisp, w, h);
  const qBlur = PuPhotoJudge.assessQuality(blurry, w, h);
  const qDark = PuPhotoJudge.assessQuality(dark, w, h);

  assert.equal(qCrisp.quality, 'ok');
  assert.ok(qCrisp.sharp >= 50, '또렷한 서류 선명도가 낮게 나왔습니다: ' + qCrisp.sharp);
  assert.equal(qBlur.quality, 'blur');
  assert.ok(qBlur.sharp < PuPhotoJudge.BLUR_SHARP_MAX, '흐린 서류가 통과했습니다: ' + qBlur.sharp);
  assert.equal(qDark.quality, 'dark');
});

test('② dHash 지각 해시는 살짝 흔들린 같은 구도는 가깝고(<=6), 전혀 다른 구도는 멀다(>=20)', () => {
  const w = 96, h = 96;
  const shotA = makeCanvasRgba(w, h, (x, y) => [Math.min(255, x * 2), Math.min(255, y * 2), 120]);
  const shotA2 = makeCanvasRgba(w, h, (x, y) => [Math.min(255, Math.max(0, (x - 1) * 2)), Math.min(255, y * 2), 120]);
  const shotB = makeCanvasRgba(w, h, (x, y) => [Math.min(255, (w - x) * 2), 80, Math.min(255, x * 2)]);

  const hA = PuPhotoJudge.dhash(shotA, w, h);
  const hA2 = PuPhotoJudge.dhash(shotA2, w, h);
  const hB = PuPhotoJudge.dhash(shotB, w, h);

  assert.equal(hA.length, 16);
  assert.ok(PuPhotoJudge.hamming(hA, hA2) <= 6, '같은 구도 연사의 해시 거리가 너무 멉니다');
  assert.ok(PuPhotoJudge.hamming(hA, hB) >= 20, '반대 구도 사진의 해시 거리가 너무 가깝습니다');
});

test('② ★★ 연사 묶기는 선명도가 가장 높은 컷을 ★ 베스트로 고르고, 증빙 사진과 다중 쪽 문서는 절대 여벌로 빼지 않는다', () => {
  const t0 = new Date('2026-11-11T10:00:00+09:00').getTime();
  const judgeMap = {
    s1: { sharp: 16, bright: 140, quality: 'blur', dhash: '0f0f0f0f0f0f0f0f' },
    s2: { sharp: 84, bright: 145, quality: 'ok',   dhash: '0f0f0f0f0f0f0f0e' }, // 1비트 차이
    s3: { sharp: 52, bright: 142, quality: 'ok',   dhash: '0f0f0f0f0f0f0f0c' },
    /* 다중 쪽 계약서 1·2쪽 — 해시가 똑같아도 절대 중복 연사로 묶이면 안 됨 */
    p1: { sharp: 80, bright: 150, quality: 'ok',   dhash: 'aaaa5555aaaa5555' },
    p2: { sharp: 78, bright: 150, quality: 'ok',   dhash: 'aaaa5555aaaa5555' },
    /* 다른 직원 사진 — 해시가 같아도 남의 사진과 묶지 않음 */
    other: { sharp: 95, bright: 145, quality: 'ok', dhash: '0f0f0f0f0f0f0f0f' }
  };
  const items = [
    { id: 's1', owner: 'u1', meta: { takenAt: t0, upAt: t0 } },
    { id: 's2', owner: 'u1', meta: { takenAt: t0 + 2000, upAt: t0 + 2000 } },
    { id: 's3', owner: 'u1', meta: { takenAt: t0 + 4000, upAt: t0 + 4000 } },
    { id: 'p1', owner: 'u1', meta: { takenAt: t0, doc: { group: 'docG', page: 1 } } },
    { id: 'p2', owner: 'u1', meta: { takenAt: t0, doc: { group: 'docG', page: 2 } } },
    { id: 'other', owner: 'u2', meta: { takenAt: t0 } }
  ];

  const groups = PuPhotoJudge.groupBursts(items, judgeMap);
  assert.equal(groups.length, 1, '다중 쪽 문서나 다른 직원 사진이 섞이지 않고 연사 1묶음만 나와야 합니다');
  assert.equal(groups[0].best.id, 's2', '가장 또렷한 s2 가 ★ 베스트여야 합니다');
  assert.deepEqual(groups[0].extras.map(x => x.id).sort(), ['s1', 's3']);

  /* 증빙(used) 보호 검증: s1·s3 둘 다 증빙으로 쓰였으면 extras 는 비우고 건너뛴다 */
  const usedItems = [
    { id: 's1', owner: 'u1', meta: { takenAt: t0, used: { at: t0 + 9000 } } },
    { id: 's2', owner: 'u1', meta: { takenAt: t0 + 2000 } },
    { id: 's3', owner: 'u1', meta: { takenAt: t0 + 4000, used: { at: t0 + 9500 } } }
  ];
  const gUsed = PuPhotoJudge.groupBursts(usedItems, judgeMap);
  assert.equal(gUsed[0].extras.length, 0, '★★ 증빙 사진이 둘 이상인 묶음은 한 장도 여벌로 빼면 안 됩니다');
  assert.match(gUsed[0].skip, /증빙/);
});

/* ══════ ③ 고객사·정부사업 일정·폴더 자동 매칭 ══════ */

test('③ 촬영일 방문 일정 + 내 폴더 + ERP 사업자번호/메모 단서를 합산해 사업장과 담당 공유 대상을 추천한다', () => {
  const visitTs = new Date(2026, 10, 11, 14, 30, 0).getTime(); // 2026-11-11
  const ctx = {
    meUid: 'uid_kim',
    gov: {
      staffOf: { uid_kim: 'st_1', uid_lee: 'st_2' },
      uidOf: { st_1: 'uid_kim', st_2: 'uid_lee' },
      coName: { co_maba: '(주)마바텍라인' },
      scheds: [
        { date: '2026-11-11', coId: 'co_maba', attId: 'st_1', coAttIds: ['st_2'] }
      ]
    },
    clients: [
      { name: '주식회사 마바텍라인', bizNo: '123-45-67890', mgrSids: ['P002'] },
      { name: '가나테크', bizNo: '222-33-44444', mgrSids: ['P003'] }
    ],
    uidBySid: { P002: 'uid_lee', P003: 'uid_park' },
    folders: {
      f_maba: { name: '마바텍라인' }
    }
  };

  /* 현장 사진: 글자가 없어도 촬영일 일정만으로 마바텍라인 + 기존 폴더(f_maba) + 부담당(uid_lee) 추천 */
  const sceneItem = {
    id: 'ph1',
    owner: 'uid_kim',
    meta: { takenAt: visitTs, kind: 'photo', note: '' }
  };
  const recs = PuPhotoJudge.recommendTargets(sceneItem, { choice: 'scene', prob: 0.92 }, ctx);
  assert.ok(recs.length >= 1, '촬영일 일정 기반 추천이 나와야 합니다');
  assert.match(recs[0].name, /마바텍라인/);
  assert.ok(recs[0].prob >= 0.88, '단독 방문일 현장사진 추천 확률이 높아야 합니다: ' + recs[0].prob);
  assert.equal(recs[0].folderId, 'f_maba', '같은 이름의 내 폴더를 자동으로 찾아 연결해야 합니다');
  assert.deepEqual(recs[0].shareUids, ['uid_lee'], '같은 일정 부담당에게 공유 추천이 잡혀야 합니다');

  /* 서류 사진: 사업자번호가 일치하면 95% 이상으로 해당 거래처를 짚는다 */
  const docItem = {
    id: 'ph2',
    owner: 'uid_kim',
    meta: { takenAt: visitTs, kind: 'doc', read: { kind: 'bizreg', fields: { bizno: '2223344444' } } }
  };
  const docRecs = PuPhotoJudge.recommendTargets(docItem, { choice: 'doc', prob: 0.96 }, ctx);
  assert.equal(docRecs[0].name, '가나테크');
  assert.ok(docRecs[0].prob >= 0.95);
});

test('③ 저장 층 loadMatchContext 는 명부·일정을 한 번만 읽어 캐시하고 로그아웃(clearIdentity) 시 비운다', async () => {
  let reads = 0;
  const fakeDb = {
    ref(p) {
      return {
        once() {
          reads++;
          const data = p === 'data/companies'
            ? { c1: { name: '(주)푸른솔', bizNo: '111-22-33333', managerMain: 'P-001' } }
            : (p === 'uid_roles' ? { u1: { sid: 'P-001', status: 'active', updatedAt: 1 } } : {});
          return Promise.resolve({ val: () => data });
        }
      };
    }
  };
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(STORE_SRC, sandbox);
  const store = sandbox.window.PuPhotoStore;
  store.init({ db: fakeDb, storage: null });

  const first = await store.loadMatchContext();
  assert.equal(first.clients.length, 1);
  assert.equal(first.clients[0].name, '(주)푸른솔');
  const readsAfterFirst = reads;

  await store.loadMatchContext();
  assert.equal(reads, readsAfterFirst, '두 번째 호출은 캐시를 써서 DB를 다시 읽지 않아야 합니다');

  store.clearIdentity();
  await store.loadMatchContext();
  assert.ok(reads > readsAfterFirst, 'clearIdentity 뒤에는 이전 계정 캐시를 비워야 합니다');
});

/* ══════ ④ 화면 연동: 스스로 지우지 않고 확인 뒤에만 휴지통(사람이 치움)으로 보낸다 ══════ */

test('④ ★★ 연사 여벌 정리는 사용자 확인(confirm) 전에는 한 장도 지우지 않고, 확인 시에도 증빙 사진은 건너뛰며 사유에 «사람이 치움»을 남긴다', async () => {
  const deleted = [];
  let allowConfirm = false;
  const ctx = {
    console,
    Promise,
    Object,
    Array,
    String,
    PuPhotoJudge,
    PuPhotoStore: {
      TRASH_DAYS: 30,
      deletePhoto(year, id, reason, owner) {
        deleted.push({ year, id, reason, owner });
        return Promise.resolve();
      }
    },
    gridItems: [
      { id: 'drop_ok', meta: { upAt: 1000 } },
      { id: 'drop_used', meta: { upAt: 1000, used: { at: 2000 } } }
    ],
    _modalState: {
      burstDropIds: ['drop_ok', 'drop_used'],
      unreadSceneIds: [],
      targetGroups: []
    },
    mayTouch: () => true,
    isUsed: m => !!(m && m.used && m.used.at),
    blockedIfOther: () => false,
    photoYearOf: () => '2026',
    photoOwner: () => 'u1',
    confirm: () => allowConfirm,
    $: () => ({ disabled: false, textContent: '', style: {} }),
    renderKindTabs() {},
    renderGrid() {},
    renderGridBar() {},
    refreshTrashCount() {},
    toast() {},
    runAutoJudgeScan() {}
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(HTML, 'function applyModalBurstClean('), ctx);

  /* 1) 취소하면 0장 */
  ctx.applyModalBurstClean();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(deleted.length, 0, '★★ 사용자가 확인하지 않았는데 사진이 지워지면 안 됩니다');

  /* 2) 확인하면 증빙 아닌 여벌 1장만 휴지통으로 가고 사유에 사람이 치움이 적힌다 */
  allowConfirm = true;
  ctx.applyModalBurstClean();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(deleted.length, 1, '증빙 사진은 빼고 일반 여벌 1장만 휴지통으로 가야 합니다');
  assert.equal(deleted[0].id, 'drop_ok');
  assert.match(deleted[0].reason, /사람이 치움/);
});

test('② 연사 묶기는 최고 선명도(닻) 직접 비교를 써서 A~B · B~C 가 비슷해도 먼 A~C 를 전이적으로 묶지 않는다', () => {
  const baseTs = Date.UTC(2026, 9, 20, 3, 0, 0);
  const items = [
    { id: 'shotA', owner: 'u1', meta: { takenAt: baseTs, upAt: baseTs } },
    { id: 'shotB', owner: 'u1', meta: { takenAt: baseTs + 3000, upAt: baseTs + 3000 } },
    { id: 'shotC', owner: 'u1', meta: { takenAt: baseTs + 6000, upAt: baseTs + 6000 } }
  ];
  /* dist(A,B)=9, dist(B,C)=9 이지만 dist(A,C)=18 > maxDist(10) */
  const judgeMap = {
    shotA: { sharp: 92, quality: 'ok', dhash: '0000000000000000' },
    shotB: { sharp: 60, quality: 'ok', dhash: '00000000000001ff' },
    shotC: { sharp: 55, quality: 'ok', dhash: '000000000003ffff' }
  };
  const groups = PuPhotoJudge.groupBursts(items, judgeMap, { windowMs: 90000, maxDist: 10, sameDayDist: 5 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].best.id, 'shotA');
  const extraIds = groups[0].extras.map(x => x.id);
  assert.deepEqual(extraIds, ['shotB'], '닻(shotA)과 해밍 거리가 먼 shotC 가 전이적으로 여벌에 섞이면 안 됩니다');
});

test('③ 동명이인(동일 상호) 별개 사업장은 사업자번호 없이 자동 공유하지 않고, 민감 서류는 자동 공유 추천에서 제외한다', () => {
  const ctx = {
    meUid: 'u_me',
    uidBySid: { S01: 'u_seoul', S02: 'u_busan' },
    clients: [
      { id: 'c_seoul', name: '(주)한빛산업', bizNo: '111-11-11111', mgrSids: ['S01'] },
      { id: 'c_busan', name: '주식회사 한빛산업', bizNo: '222-22-22222', mgrSids: ['S02'] }
    ],
    folders: {},
    gov: null
  };

  /* 1) 상호만 있을 때는 어느 지점인지 단정할 수 없으므로 shareUids 를 비워 타 업체 유출을 막는다 */
  const nameOnlyRecs = PuPhotoJudge.recommendTargets({
    id: 'p_ambig',
    owner: 'u_me',
    meta: { read: { kind: 'card', fields: { company: '한빛산업' } } }
  }, null, ctx);
  assert.ok(nameOnlyRecs.length >= 1);
  assert.deepEqual(nameOnlyRecs[0].shareUids, [], '동명 사업장이 둘 이상이면 사업자번호 없이 공유 대상을 열면 안 됩니다');

  /* 2) 사업자번호가 일치하면 해당 지점 담당자만 정확히 추천한다 */
  const bizRecs = PuPhotoJudge.recommendTargets({
    id: 'p_busan',
    owner: 'u_me',
    meta: { read: { kind: 'bizreg', fields: { company: '한빛산업', bizNo: '222-22-22222' } } }
  }, null, ctx);
  assert.deepEqual(bizRecs[0].shareUids, ['u_busan']);

  /* 3) 민감 서류(근로계약서·급여서류·주민번호 포함)는 사업자번호가 맞아도 자동 공유 추천을 비운다 */
  const contractRecs = PuPhotoJudge.recommendTargets({
    id: 'p_contract',
    owner: 'u_me',
    meta: { read: { kind: 'contract', fields: { company: '한빛산업', bizNo: '222-22-22222' } } }
  }, null, ctx);
  assert.deepEqual(contractRecs[0].shareUids, [], '민감 서류는 자동 공유 대상에 넣으면 안 됩니다');
});

test('④ ★★ 일괄 사업장 연결은 사용자 확인(confirm)을 거치고, 같은 업체 그룹 안에서도 사진별 담당자(rowShareUids)만 따로 공유한다', async () => {
  const shareCalls = [];
  let allowConfirm = false;
  const htmlNow = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');

  const ctx = {
    console,
    Promise,
    Object,
    Array,
    String,
    PuPhotoJudge,
    PuPhotoStore: {
      setFolder: () => Promise.resolve(),
      saveNote: () => Promise.resolve(),
      addShare(year, id, uids, owner, why) {
        shareCalls.push({ id, uids: uids.slice(), why });
        return Promise.resolve(uids);
      }
    },
    FOLDERS: { f1: { name: '(주)마바텍라인' } },
    gridItems: [
      { id: 'p_day1', thumb: '', meta: { takenAt: Date.UTC(2026, 9, 15, 3, 0, 0), by: 'u_me' } },
      { id: 'p_day2', thumb: '', meta: { takenAt: Date.UTC(2026, 9, 16, 3, 0, 0), by: 'u_me' } }
    ],
    $: () => ({ innerHTML: '', style: {} }),
    esc: s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    safeSrc: s => (String(s || '').startsWith('data:image/') ? String(s) : ''),
    getCachedJudge: () => null,
    fullMatchCtx: () => ({
      meUid: 'u_me',
      clients: [],
      uidBySid: {},
      folders: { f1: { name: '(주)마바텍라인' } },
      gov: {
        staffOf: { u_me: 'st_me' },
        uidOf: { st_a: 'u_alice', st_b: 'u_bob' },
        coName: { gc1: '(주)마바텍라인' },
        scheds: [
          { id: 's1', coId: 'gc1', date: '2026-10-15', attId: 'st_me', coAttIds: ['st_a'] },
          { id: 's2', coId: 'gc1', date: '2026-10-16', attId: 'st_me', coAttIds: ['st_b'] }
        ]
      }
    }),
    mayTouch: () => true,
    isMinePhoto: () => true,
    isUsed: () => false,
    laneOf: () => 'photo',
    coNameOf: () => '',
    readLabel: () => '',
    photoOwner: () => 'u_me',
    photoYearOf: () => '2026',
    maskForced: () => false,
    autoShareByCo: () => Promise.resolve(),
    ensureFolderByName: () => Promise.resolve('f1'),
    renderFolders() {},
    renderGrid() {},
    toast() {},
    runAutoJudgeScan() {},
    confirm: () => allowConfirm,
    alert() {}
  };
  vm.createContext(ctx);
  vm.runInContext([
    'let _modalState = null; let _judgeMem = {};',
    cutFn(htmlNow, 'function judgeSafeImgSrc('),
    cutFn(htmlNow, 'function canAutoSharePhoto('),
    cutFn(htmlNow, 'function buildAndRenderAutoJudgeModal('),
    cutFn(htmlNow, 'async function applyModalTargetGroup(')
  ].join('\n'), ctx);

  ctx.buildAndRenderAutoJudgeModal(ctx.gridItems);

  /* 1) 취소 시 공유 0건 */
  await ctx.applyModalTargetGroup(0, { disabled: false, textContent: '' });
  assert.equal(shareCalls.length, 0, '일괄 연결 확인을 취소하면 공유가 실행되면 안 됩니다');

  /* 2) 승인 시 p_day1 은 [u_alice] 만, p_day2 는 [u_bob] 만 열려야 한다(합집합 전파 금지) */
  allowConfirm = true;
  await ctx.applyModalTargetGroup(0, { disabled: false, textContent: '' });
  assert.equal(shareCalls.length, 2);
  const byId = Object.fromEntries(shareCalls.map(c => [c.id, c.uids]));
  assert.deepEqual(byId.p_day1, ['u_alice'], '15일 사진에 16일 담당자(u_bob)가 섞이면 안 됩니다');
  assert.deepEqual(byId.p_day2, ['u_bob'], '16일 사진에 15일 담당자(u_alice)가 섞이면 안 됩니다');
});

test('④ ★★ 비정상 따옴표·속성이 섞인 data:image 썸네일은 img 태그 속성으로 삽입되지 않는다', () => {
  const htmlNow = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
  const bodyBox = { innerHTML: '' };
  const malicious = 'data:image/png;base64,AAAA" onerror="alert(1)';
  const ctx = {
    Object,
    Array,
    String,
    PuPhotoJudge,
    $: id => (id === 'judgeModalBody' ? bodyBox : null),
    esc: s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    safeSrc: s => (String(s || '').startsWith('data:image/') ? String(s) : ''),
    getCachedJudge: () => ({ choice: 'doc', prob: 0.9, pct: 90, sharp: 12, quality: 'blur', qualityLabel: '흔들림·흐림', dhash: '0000000000000000' }),
    fullMatchCtx: () => ({ meUid: 'u1', clients: [], uidBySid: {}, folders: {}, gov: null }),
    mayTouch: () => true,
    isMinePhoto: () => true,
    isUsed: () => false,
    laneOf: () => 'doc',
    coNameOf: () => '테스트업체',
    readLabel: () => '서류',
    photoOwner: () => 'u1',
    maskForced: () => false
  };
  vm.createContext(ctx);
  vm.runInContext([
    'let _modalState = null; let _judgeMem = {};',
    cutFn(htmlNow, 'function judgeSafeImgSrc('),
    cutFn(htmlNow, 'function canAutoSharePhoto('),
    cutFn(htmlNow, 'function buildAndRenderAutoJudgeModal(')
  ].join('\n'), ctx);

  ctx.buildAndRenderAutoJudgeModal([
    { id: 'xss1', thumb: malicious, meta: { takenAt: 1000, kind: 'doc' } }
  ]);
  assert.equal(ctx.judgeSafeImgSrc(malicious), '', '공백·따옴표가 든 비정상 data URL은 빈 문자열로 차단해야 합니다');
  assert.ok(!/onerror\s*=/i.test(bodyBox.innerHTML), '모달 HTML에 onerror 이벤트 속성이 조립되면 안 됩니다');
});

test('④ ★★ 민감 서류 10종·주민번호(rrn) 포함 사진과 동명 사업장은 autoShareByCo 우회 폴백으로도 공유가 열리지 않는다', async () => {
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-photo-store.js'), 'utf8');
  const m = storeSrc.match(/SENSITIVE_KINDS\s*=\s*\{([^}]+)\}/);
  assert.ok(m, 'pu-photo-store.js 의 SENSITIVE_KINDS 를 읽을 수 있어야 합니다');
  const storeKinds = [...m[1].matchAll(/([a-z_]+)\s*:\s*1/g)].map(x => x[1]).sort();
  const judgeKinds = Object.keys(PuPhotoJudge.SENSITIVE_READ_KINDS).sort();
  assert.deepEqual(judgeKinds, storeKinds, '자동 판단 민감 서류 목록이 저장 층 10종과 정확히 일치해야 합니다');

  const ctxData = {
    meUid: 'u_me',
    folders: {},
    uidBySid: { P002: 'u_mgr' },
    clients: [{ id: 'c1', name: '(주)마바텍라인', bizNo: '123-45-67890', mgrSids: ['P002'] }],
    gov: null
  };
  for (const kind of storeKinds) {
    const recs = PuPhotoJudge.recommendTargets(
      { id: 'sens_' + kind, owner: 'u_me', meta: { read: { kind, fields: { company: '(주)마바텍라인' } } } },
      null,
      ctxData
    );
    assert.deepEqual(recs[0].shareUids, [], `${kind} 서류는 자동 공유 대상이 비어야 합니다`);
  }

  /* 동명 별개 사업장일 때 applyModalTargetGroup / applyViewerTargetCo 가 autoShareByCo 를 부르지 않는지 확인 */
  const htmlNow = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
  let fallbackShareCalled = 0;
  const dupCtx = {
    meUid: 'u_me',
    folders: {},
    uidBySid: { P002: 'u_seoul', P003: 'u_busan' },
    clients: [
      { id: 'c1', name: '(주)한국물산', bizNo: '111-11-11111', mgrSids: ['P002'] },
      { id: 'c2', name: '(주)한국물산', bizNo: '222-22-22222', mgrSids: ['P003'] }
    ],
    gov: null
  };
  const vmCtx = {
    Object, Array, String, Promise, console, PuPhotoJudge,
    window: { PuPhotoJudge },
    gridItems: [{ id: 'p_dup', owner: 'u_me', meta: { note: '(주)한국물산 방문' } }],
    viewerId: 'p_dup',
    _viewerJudgeTargets: [],
    PuPhotoStore: {
      setFolder: () => Promise.resolve(),
      saveNote: () => Promise.resolve(),
      addShare: () => { fallbackShareCalled++; return Promise.resolve([]); }
    },
    $: () => ({ innerHTML: '' }),
    esc: s => String(s ?? ''),
    safeSrc: () => '',
    getCachedJudge: () => null,
    fullMatchCtx: () => dupCtx,
    mayTouch: () => true,
    isMinePhoto: () => true,
    isUsed: () => false,
    laneOf: () => 'photo',
    coNameOf: () => '',
    readLabel: () => '',
    photoOwner: () => 'u_me',
    photoYearOf: () => '2026',
    maskForced: () => false,
    autoShareByCo: () => { fallbackShareCalled++; return Promise.resolve(); },
    ensureFolderByName: () => Promise.resolve('f_dup'),
    renderFolders() {},
    renderGrid() {},
    renderReadPanel() {},
    toast() {},
    runAutoJudgeScan() {},
    confirm: () => true,
    alert() {}
  };
  vm.createContext(vmCtx);
  vm.runInContext([
    'let _modalState = null; let _judgeMem = {};',
    cutFn(htmlNow, 'function judgeSafeImgSrc('),
    cutFn(htmlNow, 'function canAutoSharePhoto('),
    cutFn(htmlNow, 'async function applyViewerTargetCo('),
    cutFn(htmlNow, 'function buildAndRenderAutoJudgeModal('),
    cutFn(htmlNow, 'async function applyModalTargetGroup(')
  ].join('\n'), vmCtx);

  vmCtx.buildAndRenderAutoJudgeModal(vmCtx.gridItems);
  await vmCtx.applyModalTargetGroup(0, { disabled: false, textContent: '' });
  vmCtx._viewerJudgeTargets = PuPhotoJudge.recommendTargets(vmCtx.gridItems[0], null, dupCtx);
  await vmCtx.applyViewerTargetCo(0, { disabled: false });
  assert.equal(fallbackShareCalled, 0, '동명 사업장에서 shareUids 가 비었을 때 autoShareByCo 우회 공유가 불리면 안 됩니다');
});
