'use strict';
/* 📦 꾸러미 때 신청서 완성본도 서류 보관함에 저절로 (대표 승인 2026-10-05 목업 ③)
   ① 담는다 — 기관 = 건 이름 · 종류 「위원·위촉 제출용」 · 창고 자리까지(다른 PC 에서도 열림)
   ② 같은 건으로 또 만들면 «한 줄만» — 파일만 새 것, 제출기록은 그대로
   ③ 회의·비용관리에서 왔으면 비용 서류로 · ④ «지금 쓰는 서류»를 넣은 꾸러미에서만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
function 상자(통, 담을곳) {
  const 저장 = {};
  const ctx = { console, JSON, Date, String, Array, Math, 통,
    document: { getElementById: (id) => (id === 'pkYear' ? { value: '2026' } : null) },
    exportEditedHwpx: async () => new Uint8Array([1, 2, 3]),
    rhSaveDomain: () => 담을곳 || 'resume', rhUploadName: () => '', rhNiceName: async () => 'x.hwpx',
    DOMAINS: { resume: { store: 'resume', label: '이력서' }, feedoc: { store: 'feedoc', label: '비용 서류' } },
    kindsOf: (d) => (d === 'resume' ? ['일반 이력서', '위원·위촉 제출용', '기타'] : ['수당 지급 신청서', '기타']),
    get: (k) => 통[k] || [], set: (k, v) => { 통[k] = v; },
    abToB64: (u) => 'B64:' + u.length, saveFileUnified: (id, f) => { 저장[id] = f; },
    kcFormUpload: async (id) => 'kcareer_forms/u1/' + id, renderDocStore() {}, _safe(f) { try { f(); } catch (e) {} } };
  vm.createContext(ctx);
  vm.runInContext(떼기('async function _pkKeepApplication('), ctx);
  return { ctx, 저장 };
}

test('① 담는다 — 기관은 건 이름, 종류는 위원·위촉 제출용, 창고 자리까지', async () => {
  const 통 = { resume: [] };
  const { ctx } = 상자(통);
  const r = await ctx._pkKeepApplication('2026 가나공사 고문노무사');
  assert.equal(통.resume.length, 1);
  const e = 통.resume[0];
  assert.equal(e.org, '2026 가나공사 고문노무사'); assert.equal(e.year, '2026'); assert.equal(e.kind, '위원·위촉 제출용');
  assert.ok(e.genStPath && e.genStPath.startsWith('kcareer_forms/'), '★ 창고 자리가 없으면 다른 PC 에서 「원본 없음」');
  assert.equal(r.replaced, false); assert.equal(r.label, '이력서');
});

test('② 같은 건으로 또 만들면 «한 줄만» — 파일은 새 것, 제출기록은 그대로', async () => {
  const 통 = { resume: [] };
  const { ctx } = 상자(통);
  await ctx._pkKeepApplication('2026 가나공사 고문노무사');
  통.resume[0].submits = [{ date: '2026-10-05', method: '메일' }];
  const r = await ctx._pkKeepApplication('2026 가나공사 고문노무사');
  assert.equal(통.resume.length, 1, '★ 판이 늘면 「같은 서류 n판」이 쌓인다');
  assert.equal(r.replaced, true);
  assert.equal(통.resume[0].submits.length, 1, '★ 사람이 적은 제출기록을 지우면 안 된다');
  await ctx._pkKeepApplication('2026 다라시 위원');
  assert.equal(통.resume.length, 2, '다른 건이면 새 줄');
});

test('③ 회의·비용관리에서 왔으면 비용 서류로', async () => {
  const 통 = { resume: [], feedoc: [] };
  const { ctx } = 상자(통, 'feedoc');
  const r = await ctx._pkKeepApplication('2026 가나시 회의');
  assert.equal(통.feedoc.length, 1); assert.equal(통.resume.length, 0); assert.equal(r.label, '비용 서류');
  assert.equal(통.feedoc[0].kind, '수당 지급 신청서', '그 보관함의 종류에서 고른다');
});

test('④ «지금 쓰는 서류»를 넣은 꾸러미에서만 — 그리고 zip 을 만든 뒤 알린다', () => {
  const b = 떼기('async function packBuild(').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = b.indexOf('_pkKeepApplication(');
  assert.ok(i > 0, '꾸러미가 신청서를 담지 않습니다');
  assert.match(b.slice(Math.max(0, i - 200), i), /f\.kind==='cur'/, '★ 신청서가 안 든 꾸러미까지 담으면 엉뚱한 서류가 보관함에 쌓인다');
  assert.match(b, /보관\?' · 📄 신청서 완성본을 서류 보관함/, '담았으면 알려야 한다');
});
