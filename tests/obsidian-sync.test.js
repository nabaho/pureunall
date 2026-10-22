/* 옵시디언 자동 정리(tools/obsidian-sync)가 지켜야 할 «규칙» 을 못 박는다.
   ① 민감정보는 가린다  ② 도구 결과·생각은 안 옮긴다  ③ 원본을 안 건드린다
   ④ 저장소 안 보관함은 거절한다  ⑤ 다시 돌려도 중복이 안 쌓이고, 손글씨·위키는 안 덮는다
   실행: node --test tests/obsidian-sync.test.js
   ⚠ 아래 숫자·이메일은 전부 지어낸 것이다(실제 사람·업체 자료 아님). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const L = require(path.join(root, 'tools/obsidian-sync/lib.js'));
const SYNC = path.join(root, 'tools/obsidian-sync/sync.js');

/* 가릴 값은 «규칙 자체» 다 — 6자리-7자리 꼴이 주민번호라는 것이 규칙이라 값을 박는다. */
const FAKE = { // 검사고정-허용: 가림 규칙을 확인하려면 규칙에 걸리는 꼴의 지어낸 값이 있어야 한다
  rrn: '900101-1234567', biz: '123-45-67890', mobile: '010-1234-5678', tel: '02-123-4567',
  acct: '110-123-456789', mail: 'hong@example.com', key: 'sk-' + 'a'.repeat(30)
};

test('민감정보는 모두 가려진다', () => {
  const out = L.maskSensitive(Object.values(FAKE).join(' / ') + ' / password=hunter2hunter2');
  Object.values(FAKE).forEach((v) => assert.ok(!out.includes(v), v + ' 가 남았다: ' + out));
  assert.ok(!/hunter2/.test(out), '비밀번호 값이 남았다');
  ['[주민번호]', '[사업자번호]', '[전화]', '[계좌]', '[이메일]', '[토큰]'].forEach((t) => assert.ok(out.includes(t), t + ' 표시가 없다'));
});

test('멀쩡한 숫자(날짜·건수·금액)는 건드리지 않는다', () => {
  const s = '2026-10-18 에 322건, 금액 1,234,567원, 제60조, v2.1.302';
  assert.equal(L.maskSensitive(s), s);
});

test('클로드 코드: 사람·AI 글만 남고 도구 결과·생각·하위 에이전트·안내문은 빠진다', () => {
  const rows = [
    { type: 'user', sessionId: 's1', cwd: '/x/pureunall', timestamp: '2026-10-18T01:00:00Z', message: { role: 'user', content: '연차 계산 고쳐줘 <system-reminder>내부안내</system-reminder>' } },
    { type: 'assistant', timestamp: '2026-10-18T01:00:05Z', message: { role: 'assistant', content: [
      { type: 'thinking', thinking: '비밀 생각' }, { type: 'text', text: '확인하겠습니다.' }, { type: 'tool_use', name: 'Bash', input: {} }] } },
    { type: 'user', timestamp: '2026-10-18T01:00:06Z', message: { role: 'user', content: [{ type: 'tool_result', content: '파일내용 ' + FAKE.rrn }] } },
    { type: 'assistant', isSidechain: true, timestamp: '2026-10-18T01:00:07Z', message: { role: 'assistant', content: [{ type: 'text', text: '곁가지' }] } },
    { type: 'ai-title', aiTitle: '연차 계산 수정', sessionId: 's1' }
  ].map((r) => JSON.stringify(r)).join('\n') + '\n{"type":"user","mess'; /* 쓰는 중 잘린 마지막 줄 */
  const s = L.parseClaudeSession(rows);
  assert.equal(s.title, '연차 계산 수정');
  assert.equal(s.project, 'pureunall');
  assert.equal(s.tools, 1);
  assert.deepEqual(s.turns.map((t) => t.role), ['user', 'assistant']);
  const note = L.renderNote(s);
  ['비밀 생각', '곁가지', '내부안내', FAKE.rrn, '파일내용'].forEach((x) => assert.ok(!note.includes(x), x + ' 가 노트에 들어갔다'));
  assert.ok(note.includes('masked: true'));
});

test('챗지피티 내보내기: 현재 가지만 펴고 숨은 메시지는 뺀다', () => {
  const mk = (id, parent, role, text, extra) => [id, { parent, message: { author: { role }, content: { parts: [text] }, create_time: 1760000000, metadata: extra || {} } }];
  const conv = [{
    conversation_id: 'abc12345-x', title: '해고 절차', create_time: 1760000000, update_time: 1760000100, current_node: 'n3',
    mapping: Object.fromEntries([
      ['root', { parent: null, message: null }],
      mk('n1', 'root', 'user', '질문'), mk('n2', 'n1', 'system', '시스템', { is_visually_hidden_from_conversation: true }),
      mk('n3', 'n2', 'assistant', '답'), mk('side', 'n1', 'assistant', '버려진 가지')
    ])
  }];
  const [s] = L.parseChatGPTExport(conv);
  assert.deepEqual(s.turns.map((t) => t.text), ['질문', '답']);
  assert.equal(s.source, 'chatgpt');
});

test('하루 목록: 표시 바깥의 손글씨는 보존하고 안쪽만 다시 쓴다', () => {
  const e = (t) => [{ source: 'codex', project: 'p', title: t, start: '2026-10-18T01:00:00Z', link: 'raw/sessions/codex/x' }];
  const first = L.upsertDaily('', '2026-10-18', L.renderDailyBlock('2026-10-18', e('첫째')));
  const edited = first.replace('# 2026-10-18', '# 2026-10-18\n\n내 손글씨 메모');
  const again = L.upsertDaily(edited, '2026-10-18', L.renderDailyBlock('2026-10-18', e('둘째')));
  assert.ok(again.includes('내 손글씨 메모'));
  assert.ok(again.includes('둘째') && !again.includes('첫째'));
  assert.equal(again.split(L.DAILY_BEGIN).length, 2, '표시 블록이 둘로 늘었다');
});

test('보관함이 저장소 안이면 거절한다', () => {
  const { assertVaultSafe } = require(SYNC);
  assert.throws(() => assertVaultSafe(path.join(root, 'docs', 'vault')), /저장소 안/);
  assert.throws(() => assertVaultSafe(''), /보관함 위치/);
  assert.doesNotThrow(() => assertVaultSafe(path.join(os.tmpdir(), 'some-vault')));
});

test('끝에서 끝까지: 만들고 · 다시 돌려도 안 늘고 · 바뀐 것만 갱신하고 · 위키·원본은 안 덮는다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-sync-'));
  const claude = path.join(tmp, 'claude', 'proj'); fs.mkdirSync(claude, { recursive: true });
  const vault = path.join(tmp, 'vault');
  const src = path.join(claude, 'sess-0001.jsonl');
  const line = (o) => JSON.stringify(o) + '\n';
  const base = line({ type: 'user', sessionId: 'sess-0001', cwd: '/w/demo', timestamp: '2026-10-18T01:00:00Z', message: { role: 'user', content: '첫 질문 ' + FAKE.mobile } }) +
    line({ type: 'assistant', timestamp: '2026-10-18T01:00:03Z', message: { role: 'assistant', content: [{ type: 'text', text: '답변' }] } });
  fs.writeFileSync(src, base);
  const run = (extra) => spawnSync(process.execPath, [SYNC, '--vault', vault, '--claude-dir', path.join(tmp, 'claude'), '--codex-dir', path.join(tmp, 'none')].concat(extra || []), { encoding: 'utf8' });
  const rawFiles = () => fs.readdirSync(path.join(vault, 'raw/sessions/claude-code'));

  const r1 = run();
  assert.equal(r1.status, 0, r1.stderr);
  assert.equal(rawFiles().length, 1);
  const note = fs.readFileSync(path.join(vault, 'raw/sessions/claude-code', rawFiles()[0]), 'utf8');
  assert.ok(!note.includes(FAKE.mobile), '전화번호가 노트에 남았다');
  ['CLAUDE.md', 'AGENTS.md', 'wiki/index.md', 'wiki/log.md', 'wiki/_pending.md'].forEach((f) => assert.ok(fs.existsSync(path.join(vault, f)), f + ' 가 없다'));
  assert.ok(fs.readFileSync(path.join(vault, 'wiki/_pending.md'), 'utf8').includes('[['), '대기 목록이 비었다');

  /* 위키를 사람이 고쳐 두면 다음 실행이 덮지 않는다 */
  fs.appendFileSync(path.join(vault, 'wiki/index.md'), '\n내가 쓴 색인\n');
  const r2 = run();
  assert.match(r2.stdout, /그대로 1/);
  assert.equal(rawFiles().length, 1, '다시 돌렸더니 노트가 늘었다');
  assert.ok(fs.readFileSync(path.join(vault, 'wiki/index.md'), 'utf8').includes('내가 쓴 색인'));

  /* 대화가 이어지면 «같은 파일» 이 갱신된다 */
  fs.appendFileSync(src, line({ type: 'user', timestamp: '2026-10-18T01:05:00Z', message: { role: 'user', content: '이어서 질문' } }));
  const r3 = run();
  assert.match(r3.stdout, /갱신 1/);
  assert.equal(rawFiles().length, 1);
  assert.ok(fs.readFileSync(path.join(vault, 'raw/sessions/claude-code', rawFiles()[0]), 'utf8').includes('이어서 질문'));

  /* 정리 끝 표시(log 의 ingest 줄)가 있으면 대기 목록에서 빠진다 */
  const rel = 'raw/sessions/claude-code/' + rawFiles()[0];
  fs.appendFileSync(path.join(vault, 'wiki/log.md'), '\n## [2026-10-18] ingest | ' + rel + '\n');
  run();
  assert.ok(!fs.readFileSync(path.join(vault, 'wiki/_pending.md'), 'utf8').includes(rawFiles()[0].replace(/\.md$/, '')));

  /* 이알피 단추가 만든 raw/erp 노트는 하루 목록과 위키 대기 목록에 함께 잡힌다 */
  fs.mkdirSync(path.join(vault, 'raw/erp'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'raw/erp/2026-10-18 이알피 요약.md'), '---\nsource: 푸른이알피\ncreated: 2026-10-18\n---\n# 요약\n');
  run();
  assert.ok(fs.readFileSync(path.join(vault, 'daily/2026-10-18.md'), 'utf8').includes('raw/erp/2026-10-18 이알피 요약'), '하루 목록에 이알피 요약이 없다');
  assert.ok(fs.readFileSync(path.join(vault, 'wiki/_pending.md'), 'utf8').includes('raw/erp/2026-10-18 이알피 요약'), '대기 목록에 이알피 요약이 없다');

  /* 원본은 그대로다 */
  assert.ok(fs.readFileSync(src, 'utf8').includes(FAKE.mobile));
  /* 모의 실행은 아무것도 안 쓴다 */
  const dry = path.join(tmp, 'vault2');
  const rd = spawnSync(process.execPath, [SYNC, '--vault', dry, '--claude-dir', path.join(tmp, 'claude'), '--codex-dir', path.join(tmp, 'none'), '--dry-run'], { encoding: 'utf8' });
  assert.equal(rd.status, 0, rd.stderr);
  assert.ok(!fs.existsSync(dry), '모의 실행인데 보관함이 생겼다');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('대표가 자기 위키 규칙(schema.md)을 갖고 있으면 우리 틀을 끼워 넣지 않고, 출처로 적힌 원자료는 대기에서 빠진다', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-own-'));
  const vault = path.join(tmp, 'vault'); const claude = path.join(tmp, 'claude', 'p');
  fs.mkdirSync(path.join(vault, 'wiki/sources'), { recursive: true }); fs.mkdirSync(claude, { recursive: true });
  fs.writeFileSync(path.join(vault, 'schema.md'), '# Wiki Schema\n');
  fs.writeFileSync(path.join(vault, 'wiki/log.md'), '내 기록\n');
  const line = (o) => JSON.stringify(o) + '\n';
  fs.writeFileSync(path.join(claude, 'sess-own1.jsonl'),
    line({ type: 'user', sessionId: 'sess-own1', cwd: '/w/demo', timestamp: '2026-10-18T01:00:00Z', message: { role: 'user', content: '질문' } }) +
    line({ type: 'assistant', timestamp: '2026-10-18T01:00:03Z', message: { role: 'assistant', content: [{ type: 'text', text: '답' }] } }));
  const run = () => spawnSync(process.execPath, [SYNC, '--vault', vault, '--claude-dir', path.join(tmp, 'claude'), '--codex-dir', path.join(tmp, 'none')], { encoding: 'utf8' });
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  ['CLAUDE.md', 'AGENTS.md', 'wiki/index.md', 'wiki/projects'].forEach((f) => assert.ok(!fs.existsSync(path.join(vault, f)), f + ' 를 남의 규칙 옆에 끼워 넣었다'));
  assert.equal(fs.readFileSync(path.join(vault, 'wiki/log.md'), 'utf8'), '내 기록\n', '남의 기록(log)에 끼어 썼다');
  assert.ok(fs.readdirSync(path.join(vault, 'raw/sessions/claude-code')).length === 1);
  const note = fs.readdirSync(path.join(vault, 'raw/sessions/claude-code'))[0].replace(/\.md$/, '');
  assert.ok(fs.readFileSync(path.join(vault, 'wiki/_pending.md'), 'utf8').includes(note));
  /* 대표 규칙대로 «출처» 칸에 적으면 대기에서 빠진다 */
  fs.writeFileSync(path.join(vault, 'wiki/sources/요약.md'), '출처: [[' + note + ']]\n');
  run();
  assert.ok(!fs.readFileSync(path.join(vault, 'wiki/_pending.md'), 'utf8').includes(note));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('자동 실행 등록: 인자 조립이 맞고, 저장소 안 보관함은 거절한다', () => {
  const A = require(path.join(root, 'tools/obsidian-sync/auto.js'));
  const a = A.parse(['--vault', path.join(os.tmpdir(), 'v'), '--every', '15']);
  const args = A.createArgs(a, 'node');
  assert.equal(args[0], '/Create');
  assert.equal(args[args.indexOf('/MO') + 1], '15');
  const tr = args[args.indexOf('/TR') + 1];
  assert.match(tr, /sync\.js"\s+--vault\s+"/, '실행 명령이 sync.js --vault 꼴이 아니다');
  assert.deepEqual(A.removeArgs().slice(0, 1), ['/Delete']);
  assert.throws(() => A.parse(['--vault', path.join(root, 'docs')]), /저장소 안/);
  assert.throws(() => A.parse(['--vault', path.join(os.tmpdir(), 'v'), '--every', '1']), /5~1440/);
  assert.doesNotThrow(() => A.parse(['--remove']));
});
