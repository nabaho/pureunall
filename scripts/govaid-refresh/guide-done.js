/* 연간 안내 자료 — 읽은 결과를 공고에 «읽음» 표시로 남긴다(load-yearly 로 초안을 넣은 «뒤»에 부른다).
   node scripts/govaid-refresh/guide-done.js <결과폴더> [--go]
     · guide-*.json(배열 아님, 자료 하나에 한 파일) — 조사 담당이 쓴 {id, found, note, error, nm?, url?, openDt?} (BRIEF-guide.md)
     · guide-stat.json — load-yearly 가 센 자료마다 {created, known}
   ⚠ govaid/notices/{id}/guideDone 만 쓴다(고용24 안내를 처음 찾았을 때만 그 공고 자리를 새로 만든다). 다른 칸은 건드리지 않는다.
   ⚠ 쓴 뒤 다시 읽어 맞춰 본다. */
'use strict';
const fs = require('fs'), path = require('path');
const { get, update } = require('./common.js');
const G = require('./guide-lib.js');
const dir = process.argv[2], GO = process.argv.includes('--go'), NOW = Date.now();
if (!dir) { console.log('쓰는 법: node guide-done.js <결과폴더> [--go]'); process.exit(1); }
const year = Number(new Date(NOW + 9 * 3600e3).toISOString().slice(0, 4));
const sums = fs.readdirSync(dir).filter((f) => /^guide-.*\.json$/.test(f) && f !== 'guide-stat.json')
  .filter((f) => !/-plan\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((x) => x && !Array.isArray(x));
const statFile = path.join(dir, 'guide-stat.json');
const byGuide = fs.existsSync(statFile) ? JSON.parse(fs.readFileSync(statFile, 'utf8')) : {};
const notices = get('/govaid/notices') || {};
const up = G.doneUpdates(sums, byGuide, notices, NOW, year);
console.log('읽은 자료', sums.length, '· 남길 표시', Object.keys(up).length);
Object.keys(up).forEach((k) => { const d = up[k].guideDone || up[k]; console.log('  ', k, '찾은 사업', d.found, '· 새 초안', d.created, '· 이미 있음', d.known, d.error ? '· 못 읽음: ' + d.error : ''); });
if (!GO || !Object.keys(up).length) { console.log(GO ? '쓸 것이 없습니다' : '마른 돌리기 — 쓰려면 --go'); process.exit(0); }
const file = path.join(dir, 'guide-done-plan.json');
fs.writeFileSync(file, JSON.stringify(up, null, 1));
update('/govaid', file);
const after = get('/govaid/notices') || {};
const ok = Object.keys(up).filter((k) => { const id = k.split('/')[1]; return after[id] && after[id].guideDone && after[id].guideDone.at === NOW; }).length;
console.log('다시 읽음: 쓴', Object.keys(up).length, '중 맞음', ok);
process.exit(ok === Object.keys(up).length ? 0 : 1);
