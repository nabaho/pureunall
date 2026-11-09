/* 리멤버 확장 자동 갱신 — «권한·적용 범위가 넓어지면 자동으로 안 바꾼다» (2026-11-09 Codex 보안 검토)
   갱신기(sync-ext.js)는 GitHub main 의 확장 파일을 받아 바꾼다. 안전장치는 manifest 의 «모양» 비교 —
   예전에는 permissions·host_permissions·content_scripts(matches·js·world)·background 만 견주었다.
   그래서 optional_host_permissions·all_frames·match_about_blank 처럼 «범위를 넓히는 칸»이 늘어도 «같다»고 통과했다.
   이제는 «글자만 바뀌는 칸»(이름·설명·판 번호·툴바 문구)만 빼고 나머지 전부를 견준다 — 새 칸이 생겨도 «달라짐»으로 잡힌다.
   ⚠ 이 시험은 «진짜 manifest 를 조금씩 바꿔» 판정기를 그대로 돌린다 — 가짜 규칙이 아니다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'tools', 'remember-ext');
const sync = require(path.join(DIR, 'sync-ext.js'));
const read = (f) => fs.readFileSync(path.join(DIR, f));

const OLD = read('manifest.json').toString('utf8');
function good() { const o = {}; sync.FILES.forEach((f) => { o[f] = read(f); }); return o; }
function withManifest(mutate) {
  const m = JSON.parse(OLD); mutate(m);
  const f = good(); f['manifest.json'] = Buffer.from(JSON.stringify(m));
  return sync.judge(f, OLD);
}

test('저장소의 지금 manifest 는 자기 자신과 같다 — 처음 설치(옛 것 없음)도 통과한다', () => {
  assert.strictEqual(sync.shape(OLD), sync.shape(OLD));
  assert.strictEqual(withManifest(() => {}).ok, true);
  assert.strictEqual(sync.judge(good(), null).ok, true, '처음 설치는 비교할 옛 것이 없어 통과해야 합니다');
});

test('★★★ «선택 권한»을 늘리면 멈춘다 — optional_host_permissions·optional_permissions 는 범위를 넓힌다', () => {
  assert.strictEqual(withManifest((m) => { m.optional_host_permissions = ['https://*/*']; }).ok, false,
    '★★★ optional_host_permissions 를 추가해도 통과합니다 — 모든 사이트 권한을 요청할 길이 자동으로 열립니다');
  assert.strictEqual(withManifest((m) => { m.optional_permissions = ['cookies']; }).ok, false,
    '★★★ optional_permissions 를 추가해도 통과합니다');
});

test('★★★ 적용 범위를 넓히는 content_scripts 칸이 늘면 멈춘다 — all_frames·match_about_blank·exclude·run_at', () => {
  [['all_frames', true], ['match_about_blank', true], ['match_origin_as_fallback', true], ['exclude_matches', ['https://x.test/*']], ['run_at', 'document_end']]
    .forEach(([k, v]) => {
      assert.strictEqual(withManifest((m) => { m.content_scripts[0][k] = v; }).ok, false,
        '★★★ content_scripts 에 ' + k + ' 를 넣어도 통과합니다');
    });
});

test('★★ 모르는 새 최상위 칸이 생기면 멈춘다 — 허용 목록이 아니라 «제외 목록» 방식', () => {
  ['externally_connectable', 'web_accessible_resources', 'content_security_policy', 'commands', 'declarative_net_request', 'sandbox'].forEach((k) => {
    assert.strictEqual(withManifest((m) => { m[k] = {}; }).ok, false, '★★ 새 칸 ' + k + ' 가 통과합니다 — 사람이 봐야 합니다');
  });
});

test('★★ 기존 칸(permissions·host_permissions·적용 주소·background)이 달라지면 멈춘다 — 예전 동작이 그대로다', () => {
  assert.strictEqual(withManifest((m) => { m.permissions.push('cookies'); }).ok, false);
  assert.strictEqual(withManifest((m) => { m.host_permissions.push('https://*/*'); }).ok, false);
  assert.strictEqual(withManifest((m) => { m.content_scripts[0].matches = ['<all_urls>']; }).ok, false);
  assert.strictEqual(withManifest((m) => { m.content_scripts[0].world = 'ISOLATED'; }).ok, false);
  assert.strictEqual(withManifest((m) => { m.background = { service_worker: 'other.js' }; }).ok, false);
  assert.strictEqual(withManifest((m) => { m.manifest_version = 2; }).ok, false);
});

test('★★ 글자만 바뀌는 칸은 통과한다 — 판 번호·이름·설명·툴바 문구, 배열 순서', () => {
  assert.strictEqual(withManifest((m) => { m.version = '1.0.1'; }).ok, true, '판 번호만 올려도 멈추면 자동 갱신이 안 됩니다');
  assert.strictEqual(withManifest((m) => { m.version_name = '1.0.1 베타'; }).ok, true);
  assert.strictEqual(withManifest((m) => { m.name = '푸른 리멤버 연결 (에고라이트)'; }).ok, true);
  assert.strictEqual(withManifest((m) => { m.description = '바뀐 설명'; }).ok, true);
  assert.strictEqual(withManifest((m) => { m.action.default_title = '다른 툴바 문구'; }).ok, true);
  assert.strictEqual(withManifest((m) => { m.permissions.reverse(); m.host_permissions.reverse(); }).ok, true, '순서만 달라진 것을 달라졌다고 하면 안 됩니다');
});

test('★ 툴바 «문구» 말고 action 의 다른 칸이 바뀌면 멈춘다', () => {
  assert.strictEqual(withManifest((m) => { m.action.default_popup = 'popup.html'; }).ok, false);
});
