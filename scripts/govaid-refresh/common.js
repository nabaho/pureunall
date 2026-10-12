/* 정부지원금 정기 조사 — 공용 도구 (대표 지시 2026-10-12 「매년 사업관련 자동 업데이트」 → 「둘다」의 B: 이 PC 정기 조사)
   firebase CLI(이 PC 에 로그인돼 있음)로 운영 RTDB 를 읽고 쓴다. 열쇠·비밀값을 다루지 않는다. */
'use strict';
const path = require('path'), { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const M = require(path.join(REPO, 'js/pu-govaid-match.js'));
const V = require(path.join(REPO, 'js/pu-govaid-view.js'));
const W = require(path.join(REPO, 'js/pu-ontology-write.js'));
/* 사람이 아닌 표식 — 이것으로 남긴 접수 상태만 정기 조사가 고쳐 쓴다(사람 표시는 덮지 않는다) */
const AI_BY = ['AI-조사초안', '자동(기업마당)'];
const ACTOR = 'AI-조사초안';
function fb(args) {
  const env = Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' });
  const win = process.platform === 'win32';
  return execFileSync(win ? 'firebase.cmd' : 'firebase', args.concat(['--project', 'pureun-erp']), { encoding: 'utf8', env, shell: win, maxBuffer: 64 << 20 });
}
function get(p) { return JSON.parse(fb(['database:get', p]) || 'null'); }
function update(p, file) { return fb(['database:update', p, file, '-f']); }
const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
function sources(list, withDate) {
  return M.list(list).filter((s) => s && /^https?:\/\//.test(s.url || '')).slice(0, 6)
    .map((s) => Object.assign({ title: cut(s.title, 200), url: cut(s.url, 500) }, withDate ? { date: cut(s.date, 20) } : { page: cut(s.page, 60) }));
}
module.exports = { REPO, M, V, W, AI_BY, ACTOR, fb, get, update, cut, sources };
