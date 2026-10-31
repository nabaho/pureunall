/* 해마다 1월 정기 조사(B) 결과를 사전에 «초안»으로 넣는다.
   node scripts/govaid-refresh/load-yearly.js <결과폴더> [--go]
     · docs-*.json  — 기존 사업 갱신: {id, docs, laborPrep, sources, confidence, notes, cond?, summary?, baseYear?} (모양은 BRIEF-docs.md)
     · new-*.json   — 새 사업:       {name, agency, field, summary, baseYear, applicability, cond, docs, laborPrep, sources, confidence, notes}
   지키는 것:
   ⚠ 사람이 고친 것은 덮지 않는다 — 기존 사업은 «마지막 손질이 AI»(updatedBy ∈ AI_BY)일 때만 서류·조건을 바꾼다.
     사람이 손댄 사업은 조사 메모(aiDraft.yearly)만 붙여 «올해 바뀐 점»을 보게 한다.
   ⚠ 확정 사업의 조건은 바꾸지 않는다 — 해가 바뀌면 엔진이 «다시 확인»으로 돌린다(needsCheck). 사람이 원문과 맞춰 다시 확정한다.
   ⚠ 새 사업은 모두 draft. 이름이 운영 사업과 같으면(해·괄호·띄어쓰기 빼고) 만들지 않는다. id 는 gp-n### 를 이어 붙인다.
   ⚠ 쓰기 직전 다시 읽어 바뀐 사업이 있으면 멈춘다(종료코드 2), 조건·서류 낱말이 엔진 목록 밖이면 멈춘다(종료코드 3). */
'use strict';
const fs = require('fs'), path = require('path');
const { M, V, W, AI_BY, ACTOR, get, update, cut, sources } = require('./common.js');
const STAR_WHY = '공인노무사법 제2조제1항제1호 — 노동 관계 법령(시행령 별표 1: 고용보험법·고용정책기본법·장애인고용촉진법·산업안전보건법 등)에 따른 신청 대행 · AI 초안, 노무사 확인';
const dir = process.argv[2], GO = process.argv.includes('--go'), NOW = Date.now();
if (!dir) { console.log('쓰는 법: node load-yearly.js <결과폴더> [--go]'); process.exit(1); }
/* 조사 결과는 배열 파일만 — 남기는 *-plan.json(쓸 계획)은 건너뛴다 */
const read = (re) => fs.readdirSync(dir).filter((f) => re.test(f) && !/-plan\.json$/.test(f))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(Array.isArray).reduce((a, x) => a.concat(x), []);
const bad = [];
function docsOf(id, list) {
  return M.list(list).filter((d) => d && cut(d.label, 120)).slice(0, 60).map((d) => {
    if (!M.DOCS[d.key]) bad.push(id + ': 서류 낱말 ' + d.key);
    return { key: d.key, label: cut(d.label, 120), stage: cut(d.stage, 20), note: cut(d.note, 200) };
  });
}
function checkCond(id, c) {
  const L = M.list; c = c || {};
  Object.keys(c).forEach((k) => { if (['headcount', 'yearsInBiz', 'salesDropPct', 'sizes', 'regions', 'sigungu', 'industries', 'facts', 'manual'].indexOf(k) < 0) bad.push(id + ': 모르는 칸 ' + k); });
  L(c.sizes).forEach((s) => { if (M.SIZES.indexOf(s) < 0) bad.push(id + ': 규모 ' + s); });
  L(c.regions).forEach((s) => { if (M.REGIONS.indexOf(s) < 0) bad.push(id + ': 지역 ' + s); });
  /* 시·군(2026-10-31 지역 반복 사업) — «…시·…군·…구» 꼴이고, 시·도도 함께 있어야 한다 */
  L(c.sigungu).forEach((s) => { if (!/^[가-힣]{1,6}(시|군|구)$/.test(s)) bad.push(id + ': 시·군 ' + s); });
  if (L(c.sigungu).length && !L(c.regions).length) bad.push(id + ': 시·군만 있고 시·도가 없음');
  const ind = c.industries || {};
  L(ind.include).concat(L(ind.exclude)).forEach((s) => { if (!M.INDUSTRIES[s]) bad.push(id + ': 업종 ' + s); });
  L(c.facts).forEach((f) => { if (!f || !M.FACTS[f.key]) bad.push(id + ': 사실 ' + JSON.stringify(f)); });
}
function cleanCond(c) {
  c = c || {}; const o = {};
  ['headcount', 'yearsInBiz'].forEach((k) => { const r = c[k] || {}, v = {}; if (r.min != null) v.min = r.min; if (r.max != null) v.max = r.max; if (Object.keys(v).length) o[k] = v; });
  if (c.salesDropPct && c.salesDropPct.min != null) o.salesDropPct = { min: c.salesDropPct.min };
  ['sizes', 'regions', 'sigungu'].forEach((k) => { const a = M.list(c[k]).filter((x) => String(x).trim()); if (a.length) o[k] = a; });
  const man = M.list(c.manual).map((x) => cut(x, 300)).filter(Boolean).slice(0, 20); if (man.length) o.manual = man;
  const inc = M.list((c.industries || {}).include), exc = M.list((c.industries || {}).exclude);
  if (inc.length || exc.length) o.industries = Object.assign(inc.length ? { include: inc } : {}, exc.length ? { exclude: exc } : {});
  const f = M.list(c.facts).map((x) => ({ key: x.key, want: x.want !== false })); if (f.length) o.facts = f;
  return o;
}
const info = (r) => ({ confidence: r.confidence || '', notes: cut(r.notes, 1000), sources: sources(r.sources), at: NOW, by: ACTOR });

const live = get('/govaid/programs') || {};
const plan = {}, stat = { updated: 0, noteOnly: 0, created: 0, sameName: 0 };
/* ① 기존 사업 */
read(/^docs-.*\.json$/).forEach((r) => {
  const prev = live[r.id];
  if (!prev || prev._deleted) { bad.push(r.id + ': 운영에 없음'); return; }
  const aiOwned = AI_BY.indexOf(prev.updatedBy) >= 0, rec = Object.assign({}, prev);
  rec.aiDraft = Object.assign({}, prev.aiDraft || {}, { yearly: { at: NOW, baseYearSeen: r.baseYear || null, confidence: r.confidence || '', notes: cut(r.notes, 1000) } });
  if (aiOwned) {
    rec.docs = docsOf(r.id, r.docs); rec.laborPrep = cut(r.laborPrep, 300); rec.docsInfo = info(r);
    if (r.summary) rec.summary = cut(r.summary, 600);
    if (r.cond && prev.status !== 'confirmed') { checkCond(r.id, r.cond); rec.cond = cleanCond(r.cond); }
    stat.updated++;
  } else stat.noteOnly++;
  const p = W.prepareRecord(rec, { entityType: 'SupportProgram', previous: prev, expectedRevision: prev.revision, now: NOW, actor: ACTOR });
  if (!p.ok) { bad.push(r.id + ': 관문 ' + p.issues.map((i) => i.code).join(',')); return; }
  plan[r.id] = p.value;
});
/* ② 새 사업 */
const norm = (s) => String(s || '').replace(/\s|\(.*?\)|20\d\d년도?/g, '');
const names = Object.values(live).filter((p) => p && !p._deleted).map((p) => norm(p.name));
let seq = Object.keys(live).map((k) => (/^gp-n(\d+)$/.exec(k) || [])[1]).filter(Boolean).map(Number).reduce((a, b) => Math.max(a, b), 0);
read(/^new-.*\.json$/).forEach((r) => {
  if (names.indexOf(norm(r.name)) >= 0) { stat.sameName++; return; }
  names.push(norm(r.name));
  const id = 'gp-n' + String(++seq).padStart(3, '0');
  checkCond(id, r.cond);
  const src = sources(r.sources);
  const rec = { id, entityType: 'SupportProgram', name: cut(r.name, 200), agency: cut(r.agency, 200), fields: r.field ? [cut(r.field, 30)] : [],
    summary: cut(r.summary, 600), status: 'draft', baseYear: Number(r.baseYear) || new Date().getFullYear(), cond: cleanCond(r.cond),
    source: src[0] ? { title: src[0].title, no: '', page: src[0].page, url: src[0].url } : {},
    docs: docsOf(id, r.docs), laborPrep: cut(r.laborPrep, 300), docsInfo: info(r),
    aiDraft: { at: NOW, confidence: r.confidence || '', applicability: r.applicability || '', notes: cut(r.notes, 1000), baseYearSeen: r.baseYear || null } };
  if (r.applicability === 'individual') rec.applicability = 'individual';
  /* ★ 노무사 직접 사업(대표 지시 2026-10-13) — 고용노동부 계열 사업주 신청 사업은 처음부터 ★(AI 초안). 근거: 공인노무사법 제2조제1항제1호 */
  else if (V.ministryOf(rec.agency) === '고용노동부') rec.star = { on: true, why: STAR_WHY, by: ACTOR, at: NOW };
  if (live[id]) bad.push(id + ': 자리에 이미 무엇이 있음');
  const p = W.prepareRecord(rec, { entityType: 'SupportProgram', now: NOW, actor: ACTOR, expectedRevision: -1 });
  if (!p.ok) { bad.push(id + ': 관문 ' + p.issues.map((i) => i.code).join(',')); return; }
  plan[id] = p.value; stat.created++;
});
console.log(JSON.stringify(stat), '· 쓸 레코드', Object.keys(plan).length, '· 문제', bad.length);
if (bad.length) { bad.slice(0, 30).forEach((b) => console.log('  ✗', b)); process.exit(3); }
const file = path.join(dir, 'yearly-plan.json');
fs.writeFileSync(file, JSON.stringify(plan, null, 1));
if (!GO || !Object.keys(plan).length) { console.log(GO ? '쓸 것이 없습니다' : '마른 돌리기 — 쓰려면 --go'); process.exit(0); }
const again = get('/govaid/programs') || {};
const moved = Object.keys(plan).filter((k) => /^gp-n/.test(k) && !live[k] ? !!again[k] : (live[k] || {}).revision !== (again[k] || {}).revision);
if (moved.length) { console.log('✗ 그사이 바뀐 사업 — 멈춥니다:', moved.join(',')); process.exit(2); }
update('/govaid/programs', file);
const after = get('/govaid/programs') || {};
const ok = Object.keys(plan).filter((k) => after[k] && after[k].revision === plan[k].revision).length;
console.log('다시 읽음: 쓴', Object.keys(plan).length, '중 맞음', ok);
process.exit(ok === Object.keys(plan).length ? 0 : 1);
