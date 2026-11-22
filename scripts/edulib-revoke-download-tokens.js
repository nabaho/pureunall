'use strict';
/* 강의자료 원본의 «내려받기 토큰» 지우기 — node scripts/edulib-revoke-download-tokens.js [--apply]   (2026-11-22)

   ■ 왜
   강의자료 앱은 이제 원본을 «로그인 증표»로만 받는다(js/pu-edulib-app.js 의 fetchOriginal — 창고 규칙 isStaff() 를 매번 거친다).
   앱이 쓰지 않는 내려받기 토큰은 남겨 둘 까닭이 없다 — 창고 파일에 붙은 토큰을 지워, 원본으로 가는 길을 «권한 확인» 하나로 모은다.

   ■ 무엇을 하나
   - 기본은 «보기만»: 창고 pureun-erp-hrphotos 의 edulib/ 아래 파일 중 토큰이 붙은 것의 «개수»만 센다. 토큰 값은 출력하지 않는다.
   - --apply: 파일마다 메타데이터의 firebaseStorageDownloadTokens «하나만» 지운다.
     내용(바이트)·이름·다른 메타데이터(originalName·sha256 등)는 그대로다.
     ifGenerationMatch + ifMetagenerationMatch 로 그 사이 바뀌거나 갈아 끼운 파일은 건너뛴다.
     끝나면 다시 세어 «남은 것 0»인지 보여 준다.
   - 자리는 edulib/ 로 못 박는다 — 사진첩·서고 같은 다른 앱의 파일은 건드리지 않는다(그 앱들은 토큰 주소를 아직 쓴다).
   - 판정(어느 파일·무엇을 지우나)은 매일 밤 도는 서버 정리(functions/edulib-token-sweep.js)와 «같은 함수»를 쓴다.
   - 인증: gcloud auth print-access-token (창고 관리 권한이 있는 계정).

   ■ 순서 ⚠
   - 앱 새 판(권한 확인 길)이 «배포된 뒤에» 돌린다. 예전 판 화면을 열어 둔 사람은 원본을 못 연다 — 새로고침하면 된다.
   - 앱에서 새로 올리는 파일에는 파이어베이스가 토큰을 또 붙인다 — 그것은 매일 밤 서버 정리(edulibMailSweep 이 함께 부른다)가 지운다.
   - 사람의 허락을 받고 돌린다 — 살아 있는 창고의 메타데이터를 바꾸는 일이다. */
const { execSync } = require('child_process');
const T = require('../functions/edulib-token-sweep');

const BUCKET = 'pureun-erp-hrphotos';
const PREFIX = T.PREFIX;
const PROJECT = 'pureun-erp';
const KEY = T.KEY;
const API = 'https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o';

/* 판정은 서버 정리와 한 곳 — edulib/{id}/{이름} 꼴만, 토큰이 붙은 것만, 그 열쇠 하나만 */
const isEdulibObject = T.isEdulibObject;
const needsRevoke = T.needsRevoke;
const patchBody = T.patchBody;
function patchUrl(o) {
  const p = T.preconditionsOf(o);
  return API + '/' + encodeURIComponent(o.name) + '?ifGenerationMatch=' + encodeURIComponent(p.ifGenerationMatch) +
    '&ifMetagenerationMatch=' + encodeURIComponent(p.ifMetagenerationMatch) + '&fields=name,metageneration';
}
function listUrl(pageToken) {
  return API + '?prefix=' + encodeURIComponent(PREFIX) + '&maxResults=1000&fields=' + encodeURIComponent('nextPageToken,items(name,generation,metageneration,metadata)') +
    (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
}

let tok = '', tokAt = 0;
function headers(extra) {
  if (!tok || Date.now() - tokAt > 30 * 60e3) { tok = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim(); tokAt = Date.now(); }
  return Object.assign({ Authorization: 'Bearer ' + tok, 'x-goog-user-project': PROJECT }, extra || {});
}
async function listAll() {
  const all = [];
  let page = '';
  do {
    const r = await fetch(listUrl(page), { headers: headers() });
    if (!r.ok) throw new Error('창고 목록을 못 읽었습니다(' + r.status + ')');
    const j = await r.json();
    (j.items || []).forEach((o) => all.push(o));
    page = j.nextPageToken || '';
  } while (page);
  return all;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const all = await listAll();
  const todo = all.filter((o) => needsRevoke(o) && o.generation && o.metageneration);
  console.log('창고 ' + BUCKET + ' · ' + PREFIX + ' 파일 ' + all.length + '개 · 토큰 붙은 것 ' + todo.length + '개');
  if (!apply) { console.log('보기만 했습니다 — 지우려면 --apply'); return; }
  let ok = 0, changed = 0, bad = 0;
  for (const o of todo) {
    const r = await fetch(patchUrl(o), { method: 'PATCH', headers: headers({ 'Content-Type': 'application/json; charset=UTF-8' }), body: JSON.stringify(patchBody()) });
    if (r.ok) ok++;
    else if (r.status === 412) changed++;
    else { bad++; console.log('✗ ' + r.status + ' — 자료 번호 ' + String(o.name).split('/')[1]); }
  }
  const left = (await listAll()).filter(needsRevoke).length;
  console.log('지움 ' + ok + ' · 그 사이 바뀌어 건너뜀 ' + changed + ' · 실패 ' + bad + ' → 다시 세어 보니 토큰 남은 것 ' + left + '개');
  if (bad || left) process.exitCode = 1;
}

if (require.main === module) main().catch((e) => { console.error('멈춤 — ' + String((e && e.message) || e)); process.exit(1); });

module.exports = { BUCKET, PREFIX, KEY, isEdulibObject, needsRevoke, patchBody, patchUrl, listUrl };
