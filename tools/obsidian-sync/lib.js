/* 옵시디언 자동 정리 — 순수 함수 모음 (파일·네트워크를 만지지 않는다)

   하는 일: AI 작업 기록(클로드 코드·코덱스·챗지피티 내보내기)을 읽어
            ① 민감정보를 가리고 ② 옵시디언용 마크다운 한 장으로 바꾼다.
   안 하는 일: 원본을 고치거나 지우지 않는다. 도구 실행 결과(파일 내용·명령 출력)와
            «생각» 블록은 옮기지 않는다 — 고객 자료가 가장 많이 섞이는 자리다. */

/* ── 1. 민감정보 가리기 ─────────────────────────────────────────── */
const SECRET_KEYS = 'password|passwd|pwd|secret|token|api[_-]?key|apikey|비밀번호|패스워드|인증키|암호';

function maskSensitive(input) {
  if (typeof input !== 'string' || !input) return '';
  let s = input;
  /* 비밀키 블록·토큰류 — 앞에서 먼저 지운다(뒤의 숫자 규칙이 조각내지 않게) */
  s = s.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[비밀키]');
  s = s.replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{20,}/g, '[토큰]');
  s = s.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[토큰]');
  s = s.replace(/\bAIza[0-9A-Za-z_-]{30,}/g, '[토큰]');
  s = s.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[토큰]');
  s = s.replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, '[토큰]');
  s = s.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [토큰]');
  /* 이름=값 꼴(비밀번호: ••• · API_KEY=•••) — 값만 가린다 */
  s = s.replace(new RegExp('((?:' + SECRET_KEYS + ')["\']?\\s*[:=]\\s*["\']?)([^\\s"\',;]{4,})', 'gi'), '$1[가림]');
  /* 이메일 */
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]');
  /* 주민·외국인등록번호 — 뒷자리 첫 숫자가 1~8 */
  s = s.replace(/(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)/g, '[주민번호]');
  /* 사업자등록번호 000-00-00000 */
  s = s.replace(/(?<![\d-])\d{3}-\d{2}-\d{5}(?![\d-])/g, '[사업자번호]');
  /* 전화 — 휴대폰·지역번호 */
  s = s.replace(/(?<![\d-])01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g, '[전화]');
  s = s.replace(/(?<![\d-])0(?:2|[3-6]\d)[-.\s]\d{3,4}[-.\s]\d{4}(?!\d)/g, '[전화]');
  /* 계좌 — 하이픈으로 끊긴 숫자 덩어리, 합쳐서 10~16자리(날짜 2026-10-18 은 8자리라 안 걸린다) */
  s = s.replace(/(?<![\d-])\d{2,6}(?:-\d{2,8}){1,3}(?![\d-])/g, (m) => {
    const n = m.replace(/-/g, '').length;
    return n >= 10 && n <= 16 ? '[계좌]' : m;
  });
  return s;
}

/* ── 2. 공용 도구 ──────────────────────────────────────────────── */
function oneLine(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/* 파일 이름·링크에 못 쓰는 글자를 걷는다(윈도우 금지 문자 + 옵시디언 링크 기호) */
function slug(s, max) {
  const t = String(s || '').replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (t.length > (max || 50) ? t.slice(0, max || 50).trim() : t) || '제목없음';
}

function dateOf(iso) {
  /* 대표 PC 시간(KST)으로 날짜를 자른다 — UTC 로 자르면 새벽 작업이 전날로 간다 */
  const d = new Date(iso);
  if (isNaN(d)) return '0000-00-00';
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
function hhmm(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(11, 16);
}

const TAG_BLOCK = /<(system-reminder|local-command-stdout|local-command-caveat|command-message|command-args|ide_opened_file|ide_selection)>[\s\S]*?<\/\1>/g;
function cleanText(t) {
  return String(t || '').replace(TAG_BLOCK, '').replace(/<\/?command-name>/g, '').trim();
}

/* 클로드 코드는 content 가 문자열이거나 블록 배열이다. 글 블록만 모은다. */
function textOfBlocks(content) {
  if (typeof content === 'string') return cleanText(content);
  if (!Array.isArray(content)) return '';
  return cleanText(content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n'));
}

function parseJsonl(text) {
  const out = [];
  String(text || '').split('\n').forEach((line) => {
    if (!line.trim()) return;
    try { out.push(JSON.parse(line)); } catch (e) { /* 쓰는 중이라 마지막 줄이 잘린 것 — 건너뛴다 */ }
  });
  return out;
}

/* ── 3. 원본별 읽개 — 모두 같은 모양 {source,id,title,project,start,end,turns,tools} 을 돌려준다 ── */
function baseName(p) { return String(p || '').split(/[\\/]/).filter(Boolean).pop() || ''; }

function parseClaudeSession(text, hintId) {
  const rows = parseJsonl(text);
  const turns = []; let tools = 0, id = hintId || '', cwd = '', start = '', end = '', title = '';
  rows.forEach((r) => {
    if (r.sessionId && !id) id = r.sessionId;
    if (r.cwd && !cwd) cwd = r.cwd;
    if (r.type === 'ai-title' && r.aiTitle) title = r.aiTitle;
    if (r.isSidechain) return; /* 하위 에이전트의 대화는 본 대화에 요약돼 돌아온다 */
    if (r.type !== 'user' && r.type !== 'assistant') return;
    if (r.isMeta || !r.message) return;
    if (r.timestamp) { if (!start) start = r.timestamp; end = r.timestamp; }
    if (r.type === 'assistant' && Array.isArray(r.message.content)) {
      tools += r.message.content.filter((b) => b && b.type === 'tool_use').length;
    }
    const body = textOfBlocks(r.message.content); /* tool_result 는 글 블록이 아니라 자연히 빠진다 */
    if (!body) return;
    turns.push({ role: r.type === 'user' ? 'user' : 'assistant', text: body, at: r.timestamp || '' });
  });
  const firstUser = turns.find((t) => t.role === 'user');
  return { source: 'claude-code', id, title: title || (firstUser ? firstUser.text : ''), project: baseName(cwd), start, end, turns, tools };
}

/* 코덱스 CLI: 줄마다 {timestamp,type,payload}. 모양이 판마다 달라 «아는 것만» 읽는다. */
function parseCodexSession(text, hintId) {
  const rows = parseJsonl(text);
  const turns = []; let id = hintId || '', cwd = '', start = '', end = '', tools = 0;
  rows.forEach((r) => {
    const p = r.payload || r;
    if (r.type === 'session_meta' || p.type === 'session_meta') {
      id = p.id || id; cwd = p.cwd || cwd; start = start || p.timestamp || r.timestamp || '';
      return;
    }
    if (p.type === 'function_call' || p.type === 'local_shell_call') { tools++; return; }
    if (p.type !== 'message' || !(p.role === 'user' || p.role === 'assistant')) return;
    const body = cleanText((Array.isArray(p.content) ? p.content : [])
      .filter((b) => b && typeof b.text === 'string' && /text$/.test(b.type || '')).map((b) => b.text).join('\n'));
    /* 코덱스는 환경 설명(<environment_context>·AGENTS.md 전문)을 사용자 말처럼 넣는다 — 걷는다 */
    if (!body || /^<environment_context>|^# AGENTS\.md instructions/.test(body)) return;
    const at = r.timestamp || '';
    if (at) { if (!start) start = at; end = at; }
    turns.push({ role: p.role, text: body, at });
  });
  const firstUser = turns.find((t) => t.role === 'user');
  return { source: 'codex', id, title: firstUser ? firstUser.text : '', project: baseName(cwd), start, end, turns, tools };
}

/* 챗지피티 «데이터 내보내기» 의 conversations.json — 대화가 나뭇가지(mapping)로 저장돼 있다.
   현재 가지(current_node)에서 뿌리까지 거슬러 올라가 «지금 보이는 대화»만 편다. */
function parseChatGPTExport(json) {
  const list = Array.isArray(json) ? json : [];
  return list.map((c) => {
    const map = c.mapping || {}; const chain = [];
    for (let k = c.current_node, guard = 0; k && map[k] && guard < 10000; k = map[k].parent, guard++) chain.push(map[k]);
    chain.reverse();
    const turns = [];
    chain.forEach((n) => {
      const m = n.message; if (!m || !m.author) return;
      const role = m.author.role;
      if (role !== 'user' && role !== 'assistant') return;
      if (m.metadata && m.metadata.is_visually_hidden_from_conversation) return;
      const parts = (m.content && Array.isArray(m.content.parts)) ? m.content.parts : [];
      const body = cleanText(parts.filter((x) => typeof x === 'string').join('\n'));
      if (!body) return;
      turns.push({ role, text: body, at: m.create_time ? new Date(m.create_time * 1000).toISOString() : '' });
    });
    const t0 = c.create_time ? new Date(c.create_time * 1000).toISOString() : '';
    const t1 = c.update_time ? new Date(c.update_time * 1000).toISOString() : t0;
    return { source: 'chatgpt', id: c.conversation_id || c.id || '', title: c.title || (turns[0] ? turns[0].text : ''), project: '', start: t0, end: t1, turns, tools: 0 };
  });
}

/* ── 4. 마크다운 만들기 ────────────────────────────────────────── */
const MAX_TURN = 6000; /* 한 마디가 너무 길면(붙여넣은 문서 등) 잘라 노트가 터지지 않게 */
const SRC_LABEL = { 'claude-code': '클로드 코드', codex: '코덱스', chatgpt: '챗지피티', erp: '푸른이알피' };

function noteFileName(s) {
  return dateOf(s.start) + ' ' + slug(maskSensitive(oneLine(s.title, 60)), 50) + ' ' + String(s.id).slice(0, 8) + '.md';
}

function renderNote(s) {
  const title = oneLine(maskSensitive(s.title), 80) || '제목없음';
  const tags = ['세션', s.source];
  if (s.project) tags.push('project/' + slug(s.project, 40).replace(/ /g, '-'));
  const fm = [
    '---',
    'source: ' + s.source,
    'session: ' + s.id,
    'date: ' + dateOf(s.start),
    'started: ' + s.start,
    'ended: ' + s.end,
    s.project ? 'project: ' + JSON.stringify(slug(s.project, 40)) : null,
    'turns: ' + s.turns.length,
    s.tools ? 'tool_calls: ' + s.tools : null,
    'masked: true',
    'tags: [' + tags.join(', ') + ']',
    '---'
  ].filter(Boolean).join('\n');
  const body = s.turns.map((t) => {
    let x = maskSensitive(t.text);
    if (x.length > MAX_TURN) x = x.slice(0, MAX_TURN) + '\n…(이하 ' + (x.length - MAX_TURN) + '자 생략)';
    const who = t.role === 'user' ? '🧑 나' : '🤖 ' + (SRC_LABEL[s.source] || 'AI');
    return '**' + who + '**' + (t.at ? ' · ' + hhmm(t.at) : '') + '\n\n' + x;
  }).join('\n\n---\n\n');
  return fm + '\n\n# ' + title + '\n\n' +
    '> 자동 생성 — `tools/obsidian-sync`. 주민번호·계좌·전화·이메일·비밀번호류는 가렸고 도구 실행 결과는 옮기지 않았다.\n' +
    '> **이 파일은 원자료(raw)다 — 고치지 말고 `wiki/` 에 정리한다.**\n\n' + body + '\n';
}

/* 하루치 목록 — 사람이 쓴 부분은 건드리지 않고 표시 사이만 다시 쓴다 */
const DAILY_BEGIN = '<!-- obsidian-sync:begin -->';
const DAILY_END = '<!-- obsidian-sync:end -->';

function renderDailyBlock(date, entries) {
  const rows = entries.slice().sort((a, b) => String(a.start).localeCompare(String(b.start))).map((e) =>
    '- ' + (e.noTime ? '' : hhmm(e.start) + ' · ') + (SRC_LABEL[e.source] || e.source) + (e.project ? ' · ' + e.project : '') +
    ' — [[' + e.link + '|' + oneLine(e.title, 60).replace(/[|[\]]/g, ' ') + ']]');
  return DAILY_BEGIN + '\n## 작업 기록 (' + entries.length + '건)\n\n' + rows.join('\n') + '\n' + DAILY_END;
}

function upsertDaily(existing, date, block) {
  if (!existing) return '---\ndate: ' + date + '\ntags: [daily]\n---\n\n# ' + date + '\n\n' + block + '\n';
  const a = existing.indexOf(DAILY_BEGIN), b = existing.indexOf(DAILY_END);
  if (a >= 0 && b > a) return existing.slice(0, a) + block + existing.slice(b + DAILY_END.length);
  return existing.replace(/\s*$/, '') + '\n\n' + block + '\n';
}

module.exports = {
  maskSensitive, oneLine, slug, dateOf, hhmm, cleanText,
  parseClaudeSession, parseCodexSession, parseChatGPTExport,
  noteFileName, renderNote, renderDailyBlock, upsertDaily, DAILY_BEGIN, DAILY_END
};
