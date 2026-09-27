/* 법 개정 감시(서버) — rules-lawwatch.js
   가짜 저장소로 돌린다. 네트워크를 안 쓴다.
   지키는 것: ① 날마다 도는 길은 GitHub API 를 안 부른다(시간당 60번 제한)
             ② 부칙 단서의 조별 시행일을 읽는다 ③ 이미 있는 사건을 덮지 않는다
             ④ 이력 조회가 막혀도 개정 표시로 바뀐 조를 찾되, 이력이 되면 «이력으로» 찾는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./rules-lawwatch');
const Gate = require('./ontology-write-server');

/* 조 번호 「5의2」 → 머리 「제5조의2」 */
function head(k) { const m = /^(\d+)(?:의(\d+))?$/.exec(k); return '제' + m[1] + '조' + (m[2] ? '의' + m[2] : ''); }
function md(o) {
  const arts = Object.keys(o.arts).map(k => '##### ' + head(k) + ' (' + o.arts[k][0] + ')\n\n' + o.arts[k][1] + '\n').join('\n');
  return '---\n제목: 가나법\n법령ID: \'' + (o.id || '009999') + '\'\n공포일자: ' + o.prom + '\n공포번호: \'' + o.no + '\'\n시행일자: ' + o.eff +
    '\n상태: 시행\n---\n\n# 가나법\n\n## 제1장 총칙\n\n' + arts + '\n## 부칙\n\n부칙 <제' + o.no + '호,' + o.prom.replace(/-0?/g, '.') + '>\n\n' +
    (o.add || '제1조(시행일) 이 법은 공포한 날부터 시행한다.') + '\n';
}
const LAW = { key: '가나법', id: '009999', src: '가나법', file: '법률.md', arts: ['3', '5', '5의2'] };
const LIST = { laws: [LAW] };
const V1 = md({ no: '100', prom: '2025-01-07', eff: '2025-01-07', arts: { 3: ['목적', '① 가나다.'], 5: ['휴게', '① 1시간 이상 준다.'], 7: ['기타', '마.'] } });
const V2 = md({ no: '200', prom: '2026-06-09', eff: '2027-06-10',
  add: '제1조(시행일) 이 법은 공포 후 1년이 경과한 날부터 시행한다. 다만, 제5조의 개정규정은 공포 후 6개월이 경과한 날부터 시행한다.',
  arts: { 3: ['목적', '① 가나다.'], 5: ['휴게', '① 1시간 이상 준다. 다만, 요청한 때에는 그러하지 아니하다. <개정 2026.6.9>'],
          '5의2': ['선택', '요청은 서면으로 한다. <신설 2026.6.9>'], 7: ['기타', '마. 바.'] } });

function fakeRepo(versions, opts) {
  const calls = { raw: 0, api: 0 };
  const bySha = {}; versions.forEach((v, i) => { bySha['sha' + i] = v; });
  return {
    calls,
    fetchText: async (u) => { calls.raw++; const m = /legalize-kr\/legalize-kr\/([^/]+)\//.exec(u); return m[1] === 'main' ? versions[0] : bySha[m[1]]; },
    fetchJson: async () => { calls.api++; if (opts && opts.apiFails) throw new Error('HTTP 500'); return versions.map((_, i) => ({ sha: 'sha' + i })); }
  };
}

test('마크다운 한 벌을 조·제목·부칙으로 푼다 — 장 머리는 조 본문이 아니다', () => {
  const p = W.parseLawMd(V2);
  assert.equal(p.no, '200');
  assert.equal(p.promulgated, '2026-06-09');
  assert.equal(p.arts['5'].title, '휴게');
  assert.equal(p.arts['5의2'].title, '선택');
  assert.doesNotMatch(p.arts['3'].text, /제1장/);
  assert.equal(p.addenda[0].no, '200');
});

test('부칙 단서의 조별 시행일 — 「공포 후 6개월이 경과한 날」은 초일 불산입', () => {
  const d = W.effectiveDates(W.parseLawMd(V2));
  assert.equal(d.base, '2027-06-10');
  assert.equal(d.byArt['5'], '2026-12-10');
  assert.equal(W.afterPeriod('2026-06-09', 1, '년'), '2027-06-10');
  /* 달 끝 — 8월 31일 + 6개월은 2월 말일에서 끝난다 */
  assert.equal(W.afterPeriod('2026-08-31', 6, '개월'), '2027-03-01');
  const many = W.parseLawMd(md({ no: '3', prom: '2026-01-02', eff: '2026-01-02', arts: { 3: ['a', 'b'] },
    add: '제1조(시행일) 이 법은 공포한 날부터 시행한다. 다만, 제3조 및 제5조의2의 개정규정은 2027년 1월 1일부터 시행한다.' }));
  const dm = W.effectiveDates(many);
  assert.equal(dm.byArt['3'], '2027-01-01');
  assert.equal(dm.byArt['5의2'], '2027-01-01');
  /* 못 읽는 단서는 날짜를 지어내지 않고 「확인」 으로 드러낸다 */
  const odd = W.parseLawMd(md({ no: '4', prom: '2026-01-02', eff: '2026-01-02', arts: { 3: ['a', 'b'] },
    add: '제1조(시행일) 이 법은 공포한 날부터 시행한다. 다만, 제3조의 개정규정은 대통령령으로 정하는 날부터 시행한다.' }));
  assert.deepEqual(W.effectiveDates(odd).unsure, ['3']);
});

test('날마다 도는 길 — 공포번호가 같으면 GitHub API 를 안 부르고 아무것도 안 쓴다', async () => {
  const repo = fakeRepo([V2]);
  const base = { '009999': W.baseOf(W.parseLawMd(V2), LAW.arts) };
  const r = await W.run(Object.assign({ list: LIST, base, today: '2026-09-26', nowIso: 't' }, repo));
  assert.equal(repo.calls.api, 0, '★ 날마다 API 를 부르면 시간당 60번 제한에 걸린다');
  assert.equal(repo.calls.raw, 1);
  assert.equal(r.events.length, 0);
  assert.deepEqual(r.base, {});
});

test('새 공포가 나오면 기준 판과 견준다 — 감시 조만 앞뒤 글자, API 없이', async () => {
  const repo = fakeRepo([V2]);
  const base = { '009999': W.baseOf(W.parseLawMd(V1), LAW.arts) };
  const r = await W.run(Object.assign({ list: LIST, base, today: '2026-09-26', nowIso: 't' }, repo));
  assert.equal(repo.calls.api, 0);
  assert.equal(r.events.length, 1);
  const e = r.events[0];
  assert.deepEqual(Object.keys(e.arts).sort(), ['5', '5의2']);
  assert.equal(e.arts['5'].kind, '개정');
  assert.equal(e.arts['5의2'].kind, '신설');
  assert.equal(e.arts['5'].before, '① 1시간 이상 준다.');
  assert.match(e.arts['5'].after, /그러하지 아니하다/);
  assert.equal(e.arts['5'].effective, '2026-12-10');
  assert.equal(e.arts['5의2'].effective, '2027-06-10');
  assert.equal(e.firstEffective, '2026-12-10');
  assert.equal(e.otherChanged, 1, '감시 안 하는 제7조는 개수만 센다');
  assert.equal(e.prevNo, '100');
  assert.equal(r.base['009999'].no, '200');
});

test('처음 도는 날 — 시행 전 개정만 이력으로 찾고, 현행 판에 닿으면 멈춘다', async () => {
  const OLD = md({ no: '50', prom: '2020-01-01', eff: '2020-01-01', arts: { 3: ['목적', '옛.'], 5: ['휴게', '옛.'] } });
  const repo = fakeRepo([V2, V1, OLD]);
  const r = await W.run(Object.assign({ list: LIST, base: {}, today: '2026-09-26', nowIso: 't' }, repo));
  assert.equal(repo.calls.api, 1);
  assert.equal(r.events.length, 1, '★ 이미 시행된 옛 개정(V1)까지 사건으로 쏟으면 안 된다');
  assert.equal(r.events[0].prevNo, '100', '★ 이력이 되는데 개정 표시로 떨어졌다 — 이력 쪽 코드가 조용히 깨졌을 수 있다');
  assert.equal(r.events[0].arts['5'].before, '① 1시간 이상 준다.');
});

test('처음 도는 날 이력이 막히면 「<개정 날짜>」 표시로 바뀐 조를 찾는다', async () => {
  const repo = fakeRepo([V2], { apiFails: true });
  const notes = [];
  const r = await W.run(Object.assign({ list: LIST, base: {}, today: '2026-09-26', nowIso: 't', onNote: n => notes.push(n) }, repo));
  assert.equal(r.errors.length, 0, '이력이 막힌 것은 오류가 아니다 — 다음 길이 있다');
  assert.equal(notes.length, 1, '막힌 사실은 조용히 삼키지 않고 알린다');
  const e = r.events[0];
  assert.deepEqual(Object.keys(e.arts).sort(), ['5', '5의2']);
  assert.equal(e.arts['5'].beforeUnknown, true);
  assert.equal(e.arts['5'].before, '');
});

test('처음 도는 날 시행 전 개정이 없으면 기준 판만 적는다', async () => {
  const repo = fakeRepo([V1]);
  const r = await W.run(Object.assign({ list: LIST, base: {}, today: '2026-09-26', nowIso: 't' }, repo));
  assert.equal(repo.calls.api, 0);
  assert.equal(r.events.length, 0);
  assert.ok(r.base['009999'].texts['5'], '다음 날 견줄 앞 판이 적혀야 한다');
  assert.equal(r.base['009999'].texts['7'], undefined, '감시 안 하는 조는 안 적는다');
});

test('법령ID 가 다른 파일은 받지 않는다 — 폐지된 옛 법을 감시하게 되는 것을 막는다', async () => {
  const repo = fakeRepo([md({ id: '001769', no: '5305', prom: '1997-03-13', eff: '1997-03-13', arts: { 3: ['a', 'b'] } })]);
  const r = await W.run(Object.assign({ list: LIST, base: {}, today: '2026-09-26', nowIso: 't' }, repo));
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /법령ID/);
});

test('적을 묶음 — 이미 있는 사건은 덮지 않는다', () => {
  const ev = { id: '009999_200', arts: {} };
  const upd = W.updatesOf({ events: [ev], base: { '009999': { no: '200' } }, errors: [], checked: 1 }, { '009999_200': { seen: 1 } }, 'now');
  assert.equal(upd['events/009999_200'], undefined, '★ 사람이 보던 사건이 다음 날 바뀌면 안 된다');
  assert.equal(upd['base/009999'].checkedAt, 'now');
  assert.equal(upd.lastRun.checked, 1);
});

test('사건은 서버 관찰 관문의 공통 칸을 갖춘다', async () => {
  const repo = fakeRepo([V2]);
  const base = { '009999': W.baseOf(W.parseLawMd(V1), LAW.arts) };
  const r = await W.run(Object.assign({ list: LIST, base, today: '2026-09-26', nowIso: '2026-09-26T21:00:00Z', contractVersion: Gate.CONTRACT_VERSION }, repo));
  const rv = Gate.reviewRecord(r.events[0]);
  assert.deepEqual(rv.issues, []);
  assert.equal(r.events[0].entityType, 'LegalProvision');
});
