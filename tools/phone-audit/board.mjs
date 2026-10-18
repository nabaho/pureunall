#!/usr/bin/env node
/* 폰 화면 현황판 — docs/폰화면-현황.md 의 «자동» 칸을 다시 만든다
 *
 *   node tools/phone-audit/run.mjs          # 먼저 전수 측정(out/result.json)
 *   node tools/phone-audit/board.mjs        # 그 결과로 현황판 표를 갈아 끼운다
 *
 * ★ 표는 «사실»만 적는다 — 측정 숫자, 그 앱을 지키는 폰 검사 수, 마지막 폰 정리 기록(status/).
 *   판단·남은 일은 현황판의 손으로 쓰는 칸에 사람이 적는다(이 스크립트는 그 칸을 안 건드린다).
 * ⚠ 측정은 지어낸 자료(seeds/)로 한 것이다 — 실제 자료에서는 긴 이름 등으로 달라질 수 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portalApps } from './run.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const BOARD = path.join(root, 'docs', '폰화면-현황.md');
const START = '<!-- 자동:시작 — tools/phone-audit/board.mjs 가 만든다. 손으로 고치지 말 것 -->';
const END = '<!-- 자동:끝 -->';

/* 결과 파일을 «모두» 모은다 — 앱을 나눠 여러 번(동시에) 재면 result-<앱들>.json 으로 갈라진다.
   같은 앱·화면·폭이 여러 파일에 있으면 더 새 파일의 것을 쓴다. */
const outDir = path.join(here, 'out');
const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(f => /^result.*\.json$/.test(f))
  .map(f => path.join(outDir, f)).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs) : [];
if (!files.length) { console.error('먼저 node tools/phone-audit/run.mjs 로 전수 측정을 하십시오'); process.exit(2); }
const byId = new Map();
for (const f of files) for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) byId.set(r.key + '|' + r.view + '|' + r.width, r);
const results = [...byId.values()];
const measuredAt = fs.statSync(files[files.length - 1]).mtime;

const tests = fs.readdirSync(path.join(root, 'tests')).filter(f => /\.test\.js$/.test(f) && /(phone|mobile)/.test(f));
const testSrc = Object.fromEntries(tests.map(f => [f, fs.readFileSync(path.join(root, 'tests', f), 'utf8')]));
const statusDir = path.join(root, 'status');
const notes = fs.readdirSync(statusDir).filter(f => /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f)).sort();
const noteSrc = Object.fromEntries(notes.map(f => [f, fs.readFileSync(path.join(statusDir, f), 'utf8')]));

function cell(rows, w) {
  const r = rows.filter(x => x.width === w);
  if (!r.length) return '—';
  const sum = k => r.reduce((a, x) => a + ((x.m && x.m[k]) || 0), 0);
  const ox = Math.max(...r.map(x => (x.m && x.m.overflowX) || 0));
  const parts = [];
  if (ox) parts.push('옆넘침 ' + ox + 'px');
  [['offscreenN', '화면밖'], ['verticalN', '세로깨짐'], ['squeezedN', '짓눌림'], ['wrapBtnN', '두줄단추'], ['smallTapN', '작은단추'], ['smallInputN', '작은입력']]
    .forEach(([k, label]) => { const n = sum(k); if (n) parts.push(label + ' ' + n); });
  const bad = r.filter(x => x.navErr || (x.m && x.m.gate)).length;
  if (bad) parts.push('⚠못연화면 ' + bad);
  return parts.length ? parts.join(' · ') : '깨끗';
}

/* 양옆 빈자리 — 360px 화면들의 «글 시작·끝 여백 중 큰 쪽»의 가운데 값과 가장 나쁜 값(목표 8~14px) */
function side(rows) {
  const v = rows.filter(x => x.width === 360 && x.m && x.m.sideL != null && x.m.sideR != null).map(x => Math.max(x.m.sideL, x.m.sideR)).sort((a, b) => a - b);
  if (!v.length) return '—';
  return v[Math.floor(v.length / 2)] + 'px (최대 ' + v[v.length - 1] + ')';
}

const lines = [];
lines.push(START);
lines.push('');
lines.push(`측정: ${measuredAt.toISOString().slice(0, 10)} · 폭 360·411px · 화면 수는 첫 화면 + seeds 의 views · 숫자는 그 화면들의 합 · 양옆은 글이 화면 끝에서 떨어진 px(가운데 값, 목표 8~14)`);
lines.push('');
lines.push('| 앱 | 화면 수 | 양옆(360) | 360px | 411px | 폰 검사 | 마지막 폰 정리 기록 |');
lines.push('|---|---|---|---|---|---|---|');
for (const app of portalApps()) {
  const rows = results.filter(x => x.key === app.key);
  const file = app.url.split('?')[0];
  const myTests = tests.filter(f => testSrc[f].includes(file));
  const myNotes = notes.filter(f => noteSrc[f].includes(file) && /폰|모바일|mobile|phone/i.test(noteSrc[f] + f));
  const last = myNotes.length ? myNotes[myNotes.length - 1] : '';
  const views = new Set(rows.map(x => x.view)).size;
  lines.push(`| ${app.name} (\`${app.key}\`) | ${views || '—'} | ${side(rows)} | ${cell(rows, 360)} | ${cell(rows, 411)} | ${myTests.length} | ${last ? '`status/' + last + '`' : '—'} |`);
}
lines.push('');
lines.push(END);

let doc = fs.existsSync(BOARD) ? fs.readFileSync(BOARD, 'utf8') : '';
const a = doc.indexOf(START), b = doc.indexOf(END);
if (a >= 0 && b > a) doc = doc.slice(0, a) + lines.join('\n') + doc.slice(b + END.length);
else doc = (doc ? doc.trimEnd() + '\n\n' : '') + lines.join('\n') + '\n';
fs.writeFileSync(BOARD, doc);
console.log('현황판을 고쳤습니다: ' + path.relative(root, BOARD));
