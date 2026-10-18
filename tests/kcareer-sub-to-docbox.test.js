'use strict';
/* 제출서류의 「이 건에 낸 서류」 → 이력서관리 › 서류 보관함 (대표 지시 2026-10-18 「이부분 이력서 관리에 있어야 된다」)
   규칙: 이름과 상관없이 건 안의 서류를 담는다 · 같은 파일은 두 번 안 담는다 · 원본을 못 읽으면 «담은 척하지 않는다» · 단추가 서랍에 있다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

function 세상(o) {
  o = o || {};
  const 통 = { resume: o.resume || [], profile: [], submission: [{ id: 'SB1', year: '2026', org: '', title: '2026 건', caseDir: '7. 컨설턴트,위원신청등/2026',
    sentAt: '2026-10-14', sentHow: '메일', files: [
      { name: '2026 법원행정청지원서.hwp', relPath: '7/2026/a.hwp', size: 10, mtime: 't1' },
      { name: '2027 천안 평가위원 신청서_권형하.hwp', relPath: '7/2026/b.hwp', size: 10, mtime: 't2' },
      { name: '못 읽는 파일.zip', relPath: '7/2026/c.zip', size: 10, mtime: 't3' }] }] };
  const 알림 = [], 저장 = [];
  const ctx = {
    get: (k) => JSON.parse(JSON.stringify(통[k] || [])), set: (k, v) => { 통[k] = JSON.parse(JSON.stringify(v)); return true; },
    toast: (m) => 알림.push(String(m)), _safe: (f) => { try { return f(); } catch (e) { return null; } },
    kcBusy: () => {}, kindsOf: () => ['일반 이력서', '위원·위촉 제출용'], renderDocStore: () => {}, openSubmissionFiles: () => {},
    _fsFileOf: async (r) => (r === '7/2026/c.zip' ? null : { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
    _fsCloudFile: async () => null,
    abToB64: () => 'AAA', saveFileWait: async (id, f) => { 저장.push(f.name); return true; }, kcFormUpload: async () => 'st/' + 'x',
    _jsAttr: (s) => String(s), console: { warn() {}, log() {} }, Date, Uint8Array, JSON, Array, String, Number
  };
  vm.createContext(ctx);
  vm.runInContext(['function _subInDocbox(', 'async function subToDocbox('].map(떼기).join('\n'), ctx);
  return { ctx, 통, 알림, 저장 };
}

test('① 건의 서류를 «이름과 상관없이» 위원·위촉 제출용으로 담고, 제출 기록도 건에서 가져온다', async () => {
  const w = 세상();
  await w.ctx.subToDocbox('SB1');
  const r = w.통.resume;
  assert.equal(r.length, 2, '읽힌 둘만 담는다(신청서·지원서도)');
  assert.ok(r.every((x) => x.kind === '위원·위촉 제출용' && x.srcRel && x.genFileId && x.pastSubmit));
  assert.equal(r[0].submits[0].date, '2026-10-14'); assert.equal(r[0].submits[0].method, '메일');
  assert.deepEqual(w.저장.sort(), ['2026 법원행정청지원서.hwp', '2027 천안 평가위원 신청서_권형하.hwp']);
});

test('② 원본을 못 읽으면 담은 척하지 않는다 · 까닭을 말한다', async () => {
  const w = 세상();
  await w.ctx.subToDocbox('SB1');
  assert.ok(!w.통.resume.some((x) => /못 읽는/.test(x.genName)));
  assert.ok(w.알림.some((m) => /못 읽는 파일\.zip/.test(m) && /⚠/.test(m)), '못 담은 것을 알린다');
});

test('③ 같은 파일은 두 번 담지 않는다 · 한 개만 골라 담을 수도 있다', async () => {
  const w = 세상({ resume: [{ id: 'r0', srcRel: '7/2026/a.hwp' }] });
  await w.ctx.subToDocbox('SB1');
  assert.equal(w.통.resume.filter((x) => x.srcRel === '7/2026/a.hwp').length, 1);
  const v = 세상();
  await v.ctx.subToDocbox('SB1', '7/2026/b.hwp');
  assert.deepEqual(v.통.resume.map((x) => x.srcRel), ['7/2026/b.hwp']);
  await v.ctx.subToDocbox('SB1', '7/2026/b.hwp');
  assert.equal(v.통.resume.length, 1, '다시 눌러도 늘지 않는다');
});

test('④ 서랍에 단추가 있다 — 파일마다 · 건 전체 · 이미 있으면 «보관함에 있음»', () => {
  const f = strip(떼기('function openSubmissionFiles('));
  assert.ok(/subToDocbox\(\\'' \+ _jsAttr\(s\.id\) \+ '\\',\\'' \+ _jsAttr\(f\.relPath\)/.test(f), '파일마다');
  assert.ok(/subToDocbox\(\\'' \+ _jsAttr\(s\.id\) \+ '\\'\)/.test(f), '건 전체');
  assert.ok(/_subInDocbox\(f\.relPath\)/.test(f) && /보관함에 있음/.test(f), '이미 있으면 표시');
  const g = strip(떼기('async function subToDocbox('));
  assert.ok(/_fsFileOf/.test(g) && /_fsCloudFile/.test(g), '이 기기 폴더 → 클라우드 사본');
});
