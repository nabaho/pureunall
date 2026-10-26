const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/pu-obsidian.js', 'utf8');
function load(stores = {}, user = { sid: 'P-001', name: '권형하' }) {
  const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
  const window = {
    document, CURRENT_USER: user, location: { href: 'https://example.test/pu-erp.html?sso=1' },
    navigator: {}, localStorage: { getItem() { return null; } }, dbGet(k, d) { return stores[k] ?? d; }
  };
  vm.runInNewContext(source, { window, document, console, Date, encodeURIComponent, setTimeout, clearTimeout });
  return window.PuObsidian;
}

test('로그인 담당자의 진행 업무만 자동으로 모은다', () => {
  const o = load({
    user_accounts: [{ sid: 'P-001', name: '권형하' }, { sid: 'P-002', name: '김보람' }],
    cases: [
      { id: 'a', managerMain: 'P-001', companyName: '대흥중공업', brief: '부당해고 사건 대응', due: '2026-10-01' },
      { id: 'b', managerMain: 'P-002', companyName: '다른 업체', brief: '남의 업무' },
      { id: 'c', managerMain: 'P-001', companyName: '종료 업체', status: 'closed' }
    ]
  });
  const got = o.collect();
  assert.equal(got.tasks.length, 1);
  assert.equal(got.tasks[0].company, '대흥중공업');
  assert.equal(got.tasks[0].summary, '부당해고 사건 대응');
});

test('자동 요약은 업무 수·갈래·가장 가까운 기한을 알려 준다', () => {
  const o = load();
  const text = o.autoSummary({ tasks: [
    { label: '사건', due: '2026-10-02', company: '나중' },
    { label: '자문', due: '2026-09-29', company: '먼저' }
  ] });
  assert.match(text, /진행 업무 2건/);
  assert.match(text, /사건 1건/);
  assert.match(text, /2026-09-29/);
});

test('옵시디언 문서는 연결·할 일·원본 링크를 만들고 민감 필드는 싣지 않는다', () => {
  const o = load();
  const n = o.note({ data: { owner: '권형하', tasks: [{ label: '사건', company: '대흥중공업', summary: '해고 대응', assignee: '권형하', due: '2026-10-01', kind: '부당해고' }] } });
  assert.match(n.body, /\[\[대흥중공업\]\]/);
  assert.match(n.body, /- \[ \] 다음 조치 확인/);
  assert.match(n.body, /푸른이알피 열기/);
  assert.match(n.body, /주민번호·계좌·연락처·첨부파일·문서 본문은 포함하지 않습니다/);
});

test('오늘 문서를 덮어써 중복 문서가 쌓이지 않는다', () => {
  assert.match(source, /obsidian:\/\/new\?/); // 새 메모를 여는 주소(보관함 이름이 앞에 붙어도 된다)
  assert.match(source, /[?&']file=/);
  assert.match(source, /&overwrite=true/);
  assert.match(source, /자동 요약 저장/);
});

/* 2026-09-27 — 떠 있는 단추가 이알피 왼쪽 메뉴 맨 아래 「⚙ 환경설정」을 통째로 덮었다
   (대표 「환경관리가 사라졌다」). 이알피는 메뉴 바닥 한 줄에서 연다. */
test('★★ 이알피에서는 떠 있는 단추를 달지 않는다 — 환경설정을 덮는다', () => {
  const erp = fs.readFileSync('pu-erp.html', 'utf8');
  const flag = erp.indexOf('window.PU_OBSIDIAN_NO_FAB = true');
  const tag = erp.search(/<script src="js\/pu-obsidian\.js\?v=\d+"><\/script>/);
  assert.ok(flag > 0 && tag > flag, '★★ 공용 파일보다 먼저 「단추 달지 말라」를 알려야 합니다 — 늦으면 이미 떠 있습니다');
  assert.match(source, /function mount\(\) \{\s*if \(w\.PU_OBSIDIAN_NO_FAB\) return;/, '★★ 공용 파일이 그 신호를 안 봅니다');
});

test('★★ 이알피 메뉴 바닥에서 연다 — 환경설정 바로 위, 환경설정 권한이 없어도', () => {
  const erp = fs.readFileSync('pu-erp.html', 'utf8');
  const at = erp.indexOf("h('span', { className:'mi-text' }, '옵시디언 자동요약')");
  const env = erp.indexOf("h('span', { className:'mi-text' }, '환경설정')");
  assert.ok(at > 0, '★★ 메뉴에 옵시디언 줄이 없습니다 — 쓸 길이 사라졌습니다');
  assert.ok(env > at && env - at < 800, '★ 옵시디언 줄이 환경설정 바로 위(같은 바닥 줄)에 있지 않습니다');
  assert.ok(erp.slice(at - 600, at).includes('window.PuObsidian.show()'), '★★ 눌러도 창이 안 열립니다');
  assert.ok(erp.includes("(isMenuPermitted(CURRENT_USER, 'env/settings') || window.PuObsidian) && h('div'"),
    '★ 환경설정 권한이 없는 직원에게는 옵시디언 줄도 사라집니다');
});

/* 2026-10-19 — 이알피 업무요약을 «옵시디언 자동 정리» 보관함(tools/obsidian-sync)과 한 보관함으로 합쳤다. */
test('이알피 요약은 AI 기록과 같은 보관함의 raw/erp 로 간다 — 보관함 이름을 주소에 싣는다', () => {
  const o = load();
  const n = o.note({ data: { owner: '권형하', tasks: [] } });
  assert.match(n.file, /^raw\/erp\//, '원자료 자리(raw/erp)가 아닙니다 — 위키 정리 대기 목록에 안 잡힙니다');
  assert.match(o.allNote({ groups: [] }).file, /^raw\/erp\//);
  assert.match(source, /obsidian:\/\/new\?vault=/, '보관함 이름이 없으면 «마지막에 연 보관함» 으로 가 버립니다');
  assert.equal((source.match(/obsidian:\/\/new\?/g) || []).length, 1, '주소 조립이 두 벌로 갈라졌습니다 — noteUri 하나만');
});

test('★ 노트에 사번을 적지 않는다 — 이름을 못 찾은 담당자는 «이름 미확인» (대표 결정 2026-10-25)', () => {
  const o = load({
    user_accounts: [{ sid: 'P-001', name: '권형하' }, { sid: 'P-002' }],
    cases: [{ id: 'a', managerMain: 'P-001', managerSubs: ['P-002'], companyName: '대흥중공업', brief: '해고 대응' }]
  });
  const got = o.collect();
  assert.equal(got.tasks.length, 1);
  assert.ok(!/\b[A-Za-z]-?\d{3}\b/.test(JSON.stringify(got.tasks)), '업무 줄에 사번이 들어갔다');
  const all = o.collectAll();
  assert.ok(all.groups.length >= 2 && all.groups.every((g) => !/\b[A-Za-z]-?\d{3}\b/.test(g.owner)), '담당자 묶음 이름에 사번이 들어갔다');
  assert.ok(!/\b[A-Za-z]-?\d{3}\b/.test(o.allNote(all).body), '담당자별 노트 글에 사번이 나왔다');
  assert.ok(all.groups.some((g) => g.owner === '이름 미확인'));
});
