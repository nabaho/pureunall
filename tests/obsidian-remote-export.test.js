/* 클라우드 방(☁) 기록 → 노트 → 보관함 (tools/obsidian-sync/remote-export.js · sync.js --inbox)
   지키는 규칙: ① 사람·AI 글만(하위 에이전트·생각·도구 결과 제외) ② 민감정보 가림 ③ 쪽을 나눠 받아도 겹침 없이 이어짐
   ④ 이미 옮긴 방은 계획에서 빠지고, 갱신되면 다시 든다 ⑤ PC 에서 도는 방(bridge)은 뺀다 ⑥ 전달함 → 보관함이 멱등
   실행: node --test tests/obsidian-remote-export.test.js   ⚠ 아래 자료는 전부 지어낸 것 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const L = require(path.join(root, 'tools/obsidian-sync/lib.js'));
const EXPORT = path.join(root, 'tools/obsidian-sync/remote-export.js');
const SYNC = path.join(root, 'tools/obsidian-sync/sync.js');

const ev = (n, kind, content, extra) => ({
  created_at: '2026-10-20T0' + n + ':00:00Z',
  [kind]: { uuid: 'u' + n + kind, internal_anthropic_catchall: Object.assign({ message: { role: kind, content } }, extra || {}) }
});
const FAKE_PHONE = '010-1234-5678'; // 검사고정-허용: 가림 규칙을 보려면 규칙에 걸리는 꼴의 지어낸 값이 있어야 한다

test('원격 사건: 사람·AI 글만 남고 하위 에이전트·생각·도구 결과는 빠진다, 겹친 쪽은 한 번만', () => {
  const events = [
    ev(1, 'user', '연차 계산 고쳐줘 ' + FAKE_PHONE),
    ev(6, 'user', 'Another Claude session sent a message:\n<agent-message from="a1">보고</agent-message>'),
    ev(2, 'assistant', [{ type: 'thinking', thinking: '비밀 생각' }, { type: 'text', text: '확인하겠습니다.' }, { type: 'tool_use', name: 'Bash' }]),
    ev(3, 'user', [{ type: 'tool_result', content: '도구결과' }]),
    ev(4, 'assistant', [{ type: 'text', text: '곁가지 말' }], { agent_id: 'a1' }),
    ev(5, 'assistant', [{ type: 'text', text: '고쳤습니다.' }]),
    ev(2, 'assistant', [{ type: 'text', text: '확인하겠습니다.' }])          /* 쪽 경계에서 겹친 같은 사건 */
  ];
  const s = L.parseRemoteEvents(events, { id: 'session_abc12345', title: '연차 방', created_at: '2026-10-20T01:00:00Z', updated_at: '2026-10-20T05:00:00Z' });
  assert.deepEqual(s.turns.map((t) => t.text.slice(0, 6)), ['연차 계산 ', '확인하겠습니', '고쳤습니다.']);
  assert.equal(s.tools, 1);
  const note = L.renderNote(s);
  ['비밀 생각', '곁가지 말', '도구결과', FAKE_PHONE].forEach((x) => assert.ok(!note.includes(x), x + ' 가 노트에 들어갔다'));
  assert.match(note, /source: claude-cloud/);
});

test('JSON 꺼내기: 앞뒤 안내 글과 글자 속 괄호가 있어도 읽는다', () => {
  assert.deepEqual(L.extractJson('<안내 글> {"a":"x}y{","b":{"c":1}} 뒷글'), { a: 'x}y{', b: { c: 1 } });
  assert.equal(L.extractJson('JSON 없음'), null);
});

test('끝에서 끝까지: 계획 → 노트 → 전달함 → 보관함, 다시 돌려도 안 늘고 갱신되면 다시 든다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-remote-'));
  const inbox = path.join(tmp, 'inbox'), vault = path.join(tmp, 'vault');
  const wrap = (obj) => '<other-session nonce="x" untrusted="true">\n안내 글\n' + JSON.stringify({ ccr: obj }) + '\n</other-session>';
  const list = (updated) => path.join(tmp, 'list-' + updated + '.txt');
  const metas = (u) => [
    { id: 'session_cloud0001', title: '클라우드 방', updated_at: u, created_at: '2026-10-20T01:00:00Z', environment_kind: 'anthropic_cloud' },
    { id: 'session_bridge001', title: 'PC 방', updated_at: u, created_at: '2026-10-20T01:00:00Z', environment_kind: 'bridge' }
  ];
  fs.writeFileSync(list('a'), wrap({ data: metas('2026-10-20T05:00:00Z') }));
  const page1 = path.join(tmp, 'p1.txt'), page2 = path.join(tmp, 'p2.txt');
  fs.writeFileSync(page1, wrap({ data: [ev(1, 'user', '질문입니다'), ev(2, 'assistant', [{ type: 'text', text: '답입니다' }])] }));
  fs.writeFileSync(page2, wrap({ data: [ev(2, 'assistant', [{ type: 'text', text: '답입니다' }]), ev(3, 'user', '이어서')] }));
  const run = (args) => spawnSync(process.execPath, [EXPORT, '--out', inbox].concat(args), { encoding: 'utf8' });

  const p = run(['--sessions', list('a'), '--plan']);
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /session_cloud0001/);
  assert.ok(!/session_bridge001/.test(p.stdout), 'PC 에서 도는 방(bridge)이 계획에 들었다');

  const x = run(['--sessions', list('a'), '--session', 'session_cloud0001', '--events', page1, '--events', page2]);
  assert.equal(x.status, 0, x.stderr);
  const cloudDir = path.join(inbox, 'raw/sessions/claude-cloud');
  assert.equal(fs.readdirSync(cloudDir).length, 1);
  const note = fs.readFileSync(path.join(cloudDir, fs.readdirSync(cloudDir)[0]), 'utf8');
  assert.equal((note.match(/답입니다/g) || []).length, 1, '겹친 쪽의 같은 말이 두 번 들어갔다');
  assert.ok(note.indexOf('질문입니다') < note.indexOf('답입니다') && note.indexOf('답입니다') < note.indexOf('이어서'), '말 순서가 어긋났다');

  /* 옮긴 방은 계획에서 빠지고, 갱신되면 다시 든다 */
  assert.equal(run(['--sessions', list('a'), '--plan']).stdout.trim(), '');
  fs.writeFileSync(list('b'), wrap({ data: metas('2026-10-21T05:00:00Z') }));
  assert.match(run(['--sessions', list('b'), '--plan']).stdout, /session_cloud0001/);

  /* 보관함으로 — 다시 돌려도 안 늘고, 노트가 바뀌면 같은 파일이 갱신된다 */
  const sy = () => spawnSync(process.execPath, [SYNC, '--vault', vault, '--inbox', inbox, '--claude-dir', path.join(tmp, 'none'), '--codex-dir', path.join(tmp, 'none')], { encoding: 'utf8' });
  const r1 = sy(); assert.equal(r1.status, 0, r1.stderr);
  assert.match(r1.stdout, /전달함\(클라우드 방\): 새로 1/);
  const inVault = () => fs.readdirSync(path.join(vault, 'raw/sessions/claude-cloud'));
  assert.equal(inVault().length, 1);
  assert.match(fs.readFileSync(path.join(vault, 'daily/2026-10-20.md'), 'utf8'), /클로드 클라우드/);
  assert.match(sy().stdout, /그대로 1/);
  fs.appendFileSync(path.join(cloudDir, fs.readdirSync(cloudDir)[0]), '\n덧붙임\n');
  assert.match(sy().stdout, /갱신 1/);
  assert.equal(inVault().length, 1, '갱신했는데 노트가 늘었다');
  fs.rmSync(tmp, { recursive: true, force: true });
});
