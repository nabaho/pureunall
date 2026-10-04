'use strict';
// 서식집 Phase 1·2 — 노무사가 승인(O)한 서식만 익명화된 채로 forms/*.json 에 싣는다.
// 실행: node tools/forms_publish.js [--by 노무사] [검토표.xlsx ...]
//   · 검토표를 안 주면 _forms_out/서식집_검토*.xlsx 를 모두 읽는다(1차·2차… 차수별 파일 포함).
//   · 서식 본문은 «검토표를 만든 그 묶음»(_forms_out/forms_snapshot.json)에서 가져온다.
//     corpus 를 다시 돌린 뒤 실으면 검토한 것과 싣는 것이 어긋날 수 있다.
//
// ⚠★ 개인정보 — 최대 리스크(설계 2026-08-06 §7). forms/ 는 GitHub Pages 로 «공개»된다.
//   ① 원본 경로(source.file·cluster)는 싣지 않는다 — 사건 폴더 이름에 고객사·사람 이름이 들어 있다.
//   ② 실기 직전에 scanPii 를 다시 돌린다. 하나라도 걸리면 «그 서식은 안 싣고» 이름을 알려 준다.
//      (상세주소처럼 «사람이 보고 정할 것»도 안 싣는다 — 노무사 O 는 문구 승인이지 익명화 확인이 아니다.)
//   ③ tests/forms-published-pii.test.js 가 커밋된 forms/*.json 을 같은 잣대로 한 번 더 본다(CI).
// ※ X(반려)는 이미 실린 것이면 내린다. 빈 칸은 손대지 않는다(아직 안 본 것).
const fs = require('fs');
const path = require('path');
const L = require('./forms_lib.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '_forms_out');
const PUB_DIR = path.join(ROOT, 'forms');

const DOMAIN_FILE = {
  wageArrears: 'wage-arrears', laborCommission: 'labor-commission', industrialAccident: 'industrial-accident',
  consulting: 'consulting', fund: 'fund', bargaining: 'bargaining', other: 'other',
};
const ID_RE = /^[a-z]{2}-[0-9a-z]{6,40}$/;

// 검토표(시트 하나 = 2차원 배열) → { id: 'O'|'X' }. 머리줄은 «승인»·«ID» 가 함께 있는 첫 줄.
function approvalsFromRows(aoa) {
  const out = {};
  const rows = aoa || [];
  const h = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c).trim() === '승인') && r.some(c => String(c).trim() === 'ID'));
  if (h < 0) return out;
  const iA = rows[h].findIndex(c => String(c).trim() === '승인');
  const iId = rows[h].findIndex(c => String(c).trim() === 'ID');
  rows.slice(h + 1).forEach(r => {
    if (!Array.isArray(r)) return;
    const id = String(r[iId] == null ? '' : r[iId]).trim();
    const v = String(r[iA] == null ? '' : r[iA]).trim().toUpperCase().replace(/[○◯ㅇ0]/g, 'O').replace(/[×ㅌ]/g, 'X');
    if (!ID_RE.test(id)) return;
    if (v === 'O' || v === 'X') out[id] = v;
  });
  return out;
}

// 실릴 모양 — 원본 경로를 걷는다
function publicForm(f, review) {
  return {
    id: f.id, title: f.title, domain: f.domain, track: f.track || [], category: f.category,
    esign: !!f.esign, signer: f.signer || '', jurisdiction: f.jurisdiction || '',
    vars: (f.vars || []).map(v => ({ key: v.key, label: v.label || v.key, type: v.type || 'text', required: !!v.required })),
    signFields: f.signFields || [],
    body: f.body,
    source: { hash: f.source && f.source.hash || '', pickedBy: f.source && f.source.pickedBy || '' },
    review: { status: 'approved', reviewedAt: review.at, reviewedBy: review.by },
  };
}

// 싣기 계획 — 순수 함수(검사가 붙는다)
//   forms: 묶음 사본의 서식들, approvals: {id:'O'|'X'}, existing: 이미 실린 서식들(배열)
function publishPlan(forms, approvals, existing, review) {
  const byId = {};
  (forms || []).forEach(f => { byId[f.id] = f; });
  const keep = {};
  (existing || []).forEach(f => { keep[f.id] = f; });
  const added = [], removed = [], refused = [];
  Object.keys(approvals || {}).forEach(id => {
    const v = approvals[id];
    if (v === 'X') { if (keep[id]) { delete keep[id]; removed.push(id); } return; }
    const f = byId[id];
    if (!f) { refused.push({ id, title: '', why: '묶음 사본에 없는 ID — 검토표와 묶음이 어긋났습니다' }); return; }
    const pii = L.scanPii(f.body || '');
    if (pii.length) {
      refused.push({ id, title: f.title, why: '개인정보 의심: ' + pii.map(p => p.label + (p.kind === 'review' ? '(사람 확인)' : '')).join(', ') });
      return;
    }
    if (!keep[id]) added.push(id);
    keep[id] = publicForm(f, review);
  });
  const all = Object.keys(keep).map(id => keep[id]).sort((a, b) => String(a.domain).localeCompare(String(b.domain)) || String(a.title).localeCompare(String(b.title), 'ko'));
  const files = {};
  all.forEach(f => { const k = DOMAIN_FILE[f.domain] || 'other'; (files[k] = files[k] || []).push(f); });
  const index = all.map(f => {
    const x = Object.assign({}, f); delete x.body;
    x.file = DOMAIN_FILE[f.domain] || 'other';
    return x;
  });
  return { index, files, added, removed, refused };
}

function readExisting() {
  if (!fs.existsSync(PUB_DIR)) return [];
  const out = [];
  fs.readdirSync(PUB_DIR).filter(n => n.endsWith('.json') && n !== 'index.json').forEach(n => {
    try { (JSON.parse(fs.readFileSync(path.join(PUB_DIR, n), 'utf8')).forms || []).forEach(f => out.push(f)); } catch (_) { /* 깨진 파일은 다시 쓴다 */ }
  });
  return out;
}

function main(argv) {
  const args = argv.slice(2);
  let by = '노무사';
  const iBy = args.indexOf('--by');
  if (iBy >= 0) { by = String(args[iBy + 1] || by).slice(0, 30); args.splice(iBy, 2); }
  const snapPath = path.join(OUT_DIR, 'forms_snapshot.json');
  if (!fs.existsSync(snapPath)) { console.error('묶음 사본이 없습니다 — 먼저: node tools/forms_report.js'); process.exit(1); }
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));
  const sheets = args.length ? args : fs.readdirSync(OUT_DIR).filter(n => /^서식집_검토.*\.xlsx$/.test(n)).map(n => path.join(OUT_DIR, n));
  const approvals = {};
  sheets.forEach(p => {
    const wb = XLSX.readFile(p);
    wb.SheetNames.forEach(sn => {
      const a = approvalsFromRows(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }));
      Object.keys(a).forEach(id => { approvals[id] = a[id]; });
    });
  });
  const nO = Object.keys(approvals).filter(k => approvals[k] === 'O').length;
  const nX = Object.keys(approvals).length - nO;
  console.log('검토표 %d개 · 승인 O %d · 반려 X %d', sheets.length, nO, nX);
  const plan = publishPlan(snap.forms, approvals, readExisting(), { at: new Date().toISOString().slice(0, 10), by });
  if (!fs.existsSync(PUB_DIR)) fs.mkdirSync(PUB_DIR);
  fs.readdirSync(PUB_DIR).filter(n => n.endsWith('.json')).forEach(n => fs.unlinkSync(path.join(PUB_DIR, n)));
  Object.keys(plan.files).forEach(k => {
    fs.writeFileSync(path.join(PUB_DIR, k + '.json'), JSON.stringify({ domain: k, forms: plan.files[k] }, null, 1) + '\n', 'utf8');
  });
  fs.writeFileSync(path.join(PUB_DIR, 'index.json'), JSON.stringify({ at: new Date().toISOString(), forms: plan.index }, null, 1) + '\n', 'utf8');
  console.log('실림 %d종 (새로 %d · 내림 %d)', plan.index.length, plan.added.length, plan.removed.length);
  if (plan.refused.length) {
    console.log('\n⚠ 안 실은 것 %d종 — 고친 뒤 다시 돌리세요:', plan.refused.length);
    plan.refused.forEach(r => console.log('  %s %s — %s', r.id, r.title, r.why));
  }
}

if (require.main === module) main(process.argv);
module.exports = { approvalsFromRows, publicForm, publishPlan, DOMAIN_FILE };
