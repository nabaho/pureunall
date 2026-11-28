'use strict';
/* 기술보호컨설팅: «컨설팅 수행» 과 «안내·기타(신청 안내 발송·회신)» 를 가르고, 겹치는 화면을 걷어낸다
 * (대표 지시 2026-11-28). 값이 아니라 «규칙»을 못 박는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const Hwpx = require(path.join(ROOT, 'js', 'pu-consult-hwpx.js'));
require(path.join(ROOT, 'js', 'pu-consult-view.js')); // window/globalThis 에 PuConsultView 를 올린다
const View = globalThis.PuConsultView;

test('① 카탈로그: lean 은 12개 앱 공통 기본(대표 지시 2026-11-28 «기술보호 고친 걸 기준으로 전체 일치») · kindSplit 은 기술보호만', () => {
  const tp = Cats.get('techprotect');
  assert.equal(tp.kindSplit, true);
  for (const k of Cats.NEW_APP_KEYS) assert.notEqual(Cats.get(k).lean, false, k + ': lean 을 끈 앱이 있다(공통 기본)');
  for (const k of ['clinic', 'chamber', 'hrconsult', 'evalcomp', 'pubconsult', 'familywork', 'socialent', 'sixthind', 'laboraudit', 'unionneg', 'specialcons']) {
    assert.ok(!Cats.get(k).kindSplit, k + ': 수행/안내 두 탭은 기술보호만(안내 발송 업무가 있는 앱)');
  }
  // 화면 틀은 하나 — 안내·기타 탭은 모든 틀에 «숨김»으로 있고 kindSplit 앱만 엔진이 보인다
  for (const k of Cats.NEW_APP_KEYS) assert.match(read(k + '.html'), /data-tab="guide" hidden>/, k + ': 안내 탭은 틀에 숨김으로');
  assert.match(read('js/pu-consult-view.js'), /gTab\.hidden = !split/);
});

test('② 수행/안내 구분: 사람이 정한 kind 가 먼저, 없으면 출처 꼬리표로 읽을 때만 추정한다', () => {
  const K = View.projectKind;
  assert.equal(K({ kind: 'guide', caseNo: '기술보호-2026-001' }), 'guide', '사람이 정한 값이 이긴다');
  assert.equal(K({ kind: 'other' }), 'other');
  assert.equal(K({ caseNo: '기술보호-2026-001', summaryNote: '[메일] 메일 1통 자동분류' }), 'perf', '사건번호가 있으면 수행');
  assert.equal(K({ summaryNote: '[ERP] ERP 수임(기술보호-2026-016)' }), 'perf');
  assert.equal(K({ summaryNote: '[ERP+로컬] ERP 수임 · 6파일' }), 'perf');
  assert.equal(K({ summaryNote: '[로컬] 2026 통합 기술보호지원반 (9파일)' }), 'perf', '로컬 산출물이 있으면 수행');
  assert.equal(K({ summaryNote: '[메일] 메일 1통 자동분류' }), 'guide', '메일만 있으면 안내·기타');
  assert.equal(K({ summaryNote: '[카톡·문자] 메일 2통 연계' }), 'guide');
  assert.equal(K({ id: 'pr_techprotect_x', summaryNote: '자동 감지 등록 (메일 2 / 톡 0)' }), 'guide');
  assert.equal(K({ id: 'pr_techprotect_y', summaryNote: '현장 방문 일정 협의' }), 'perf', '직접 등록한 건은 수행');
  assert.equal(K(null), 'perf');
});

test('③ 안내 상태: 발송 전 → 회신 대기 → 회신 결과, 기타 자료는 따로', () => {
  const S = View.guideState;
  assert.equal(S({ kind: 'guide' }), 'pre');
  assert.equal(S({ kind: 'guide', guideSentAt: '2026-11-01' }), 'wait');
  for (const r of ['apply', 'othercons', 'hold', 'decline', 'noreply']) {
    assert.equal(S({ kind: 'guide', guideSentAt: '2026-11-01', guideResponse: r }), r);
  }
  assert.equal(S({ kind: 'guide', guideResponse: 'zzz' }), 'pre', '모르는 값은 회신으로 치지 않는다');
  assert.equal(S({ kind: 'other', guideResponse: 'apply' }), 'etc');
});

test('④ 화면: 탭은 수행·안내·후보·진행체크·보고서 — 연도별 자료함·RAG 는 없다', () => {
  const html = read('techprotect.html');
  for (const t of ['projects', 'guide', 'inbox', 'detail', 'report']) {
    assert.ok(new RegExp('data-tab="' + t + '"').test(html), t + ' 탭 없음');
    assert.ok(new RegExp('id="p-' + t + '"').test(html), 'p-' + t + ' 구역 없음');
  }
  assert.ok(!/data-tab="yearly"/.test(html) && !/id="p-yearly"/.test(html), '연도별 자료함이 남아 있다');
  assert.ok(!/pu-consult-rag\.js/.test(html), 'RAG 모듈을 아직 싣는다');
  assert.ok(!/RAG 실무코치|RAG 학습허브/.test(html), 'RAG 단추·링크가 남아 있다');
  for (const id of ['projTrackSel', 'projYrSel', 'reloadBtn', 'scanAllBtn', 'recentDiffBarWrap']) {
    assert.ok(html.indexOf('id="' + id + '"') < 0, id + ': 중복 조절 장치가 남아 있다');
  }
  // 공용 알약 자리는 모든 컨설팅 앱이 갖는다(consult-suite 검사와 같은 규칙)
  assert.match(html, /id="projYrBar"/);
  // 안내 탭 조절 장치
  for (const id of ['guideYrBar', 'guideKpiBox', 'gQ', 'gAddBtn', 'gCsvBtn', 'guideBox', 'nGuide']) {
    assert.ok(html.indexOf('id="' + id + '"') >= 0, id + ' 없음');
  }
});

test('⑤ 화면: <div> 짝이 맞고 main 안이 열리고 닫힌다', () => {
  const html = read('techprotect.html');
  const main = html.slice(html.indexOf('<main id="app"'), html.indexOf('</main>'));
  assert.equal((main.match(/<div[\s>]/g) || []).length, (main.match(/<\/div>/g) || []).length);
  assert.equal((main.match(/<section[\s>]/g) || []).length, (main.match(/<\/section>/g) || []).length);
});

test('⑥ 공용 모듈: lean 일 때만 RAG·변경점 바를 걷는다(다른 앱은 그대로)', () => {
  const v = read('js/pu-consult-view.js');
  assert.match(v, /if \(R && C && !isLean\(\)\)/, 'RAG 색인을 lean 앱에서도 만든다');
  assert.match(v, /if \(isLean\(\)\) \{ el\.innerHTML = ''; return; \}/, '변경점 바를 lean 앱에서도 그린다');
  assert.match(v, /if \(isLean\(\)\) DIFF_HIGHLIGHT = false/, '«변경됨» 테두리를 lean 앱에서도 켠다');
  // 옛 앱 보호: 연도별 자료함 그리기·RAG 코치 열은 코드에 그대로 있어야 한다(다른 앱이 쓴다)
  assert.match(v, /function renderYearlyPane\(\)/);
  assert.match(v, /function renderReportPane\(\)/);
  assert.match(v, /rag\.recommendNextActions/);
});

test('⑦ 등록할 때 구분을 함께 적는다: 후보는 ERP 수임이면 수행·아니면 안내, 직접 등록은 수행', () => {
  const v = read('js/pu-consult-view.js');
  assert.match(v, /rec\.kind = num\(bundle\.erpCount, 0\) > 0 \? 'perf' : 'guide'/);
  assert.match(v, /if \(isSplit\(\)\) rec\.kind = 'perf'/);
});

test('⑧ 일괄 작업은 건수를 묻고(confirm) 한 건씩 «바꾼 칸만» 저장한다 · 화면을 떠나면 고른 것을 비운다', () => {
  const v = read('js/pu-consult-view.js');
  assert.match(v, /global\.confirm\(list\.length \+ '건에/);
  assert.match(v, /saveRecord\('projects\/' \+ pid, pid, Object\.assign\(\{\}, proj, patch\), 'Project', \{ patch: patch \}\)/);
  assert.match(v, /if \(isSplit\(\) && prevTab !== CUR_TAB\) SEL = Object\.create\(null\)/);
  assert.ok(!/delete\s+D\.projects|D\.projects\[[^\]]+\]\s*=\s*null/.test(v), '자료를 지우면 안 된다');
});

test('⑨ 목록 맨 왼쪽은 ☐ + 번호 — 안내 표도 같다', () => {
  const v = read('js/pu-consult-view.js');
  const s = v.indexOf('function renderGuidePane()');
  const e = v.indexOf('/* 사업 레코드에 «바꾼 칸만» 저장', s);
  const g = v.slice(s, e);
  assert.match(g, /<th class="c"><input type="checkbox" data-ckall="guide"/);
  assert.match(g, /<th class="n">№<\/th>/);
  assert.match(g, /<td class="c"><input type="checkbox" data-ck="/);
  assert.match(g, /<td class="n">' \+ \(i \+ 1\) \+ '<\/td>/);
});

test('⑩ DB 규칙: 사업 칸에 구분·안내·회신 칸이 «선택»으로 열려 있다(열두 앱 공통, 기존 칸은 그대로)', () => {
  const src = read('scripts/make-firebase-rules.js');
  for (const f of ['kind:', 'guideSentAt:', 'guideRespondedAt:', 'guideResponse:', 'guideNote:']) {
    assert.ok(src.indexOf('      ' + f) >= 0, f + ' 규칙 없음');
  }
  const applied = JSON.parse(read('docs/rules-paste.json')).rules;
  for (const root of ['scal_techprotect', 'scal_clinic', 'scal_sixthind']) {
    const proj = applied[root].projects.$id;
    for (const f of ['kind', 'guideSentAt', 'guideRespondedAt', 'guideResponse', 'guideNote']) {
      assert.ok(proj[f], root + ' projects.' + f + ' 규칙 없음');
    }
    assert.ok(proj.status && proj.companyName && proj.summaryNote, '기존 칸이 사라졌다');
    const req = proj['.validate'];
    assert.ok(!/guide|kind/.test(req.split('&&').slice(0, 1).join('')), '새 칸을 «필수»로 걸면 옛 자료가 막힌다');
  }
  assert.equal(read('docs/rules-paste.json'), read('docs/firebase-rules-전체-적용본.json'), '붙여넣기용과 적용본이 어긋남');
});

test('⑪ 보고서 원고: 장마다 같은 줄이 되풀이되지 않고, 모르는 값을 0 으로 쓰지 않는다', () => {
  const proj = { id: 'p1', companyName: '(주)점검샘플', year: 2026, trackId: 'tp_basic', stage: 'visit', status: 'active' };
  // 점검 결과를 하나도 안 넣은 상태
  const a = Hwpx.resolveSections('techprotect', proj, {}, [], {});
  const t = (no) => a.sections.find((s) => s.no === no).text;
  assert.ok(t(1).indexOf('상시근로자: 0명') < 0, '근로자수 미입력을 0명으로 적었다');
  assert.ok(t(1).indexOf('[확인 필요]') >= 0, '근로자수 미입력은 [확인 필요] 로 남겨야 한다');
  assert.ok(t(1).indexOf('종합 진행률') < 0, '점검 전인데 진행률 0% 를 찍었다');
  assert.ok(t(2) !== t(3), '2장과 3장이 같은 글이다');
  assert.ok(/아직 입력되지 않았/.test(t(2)) && /아직 입력되지 않았/.test(t(3)));
  // 일부만 점검: 항목이 장 분류에 맞게 갈린다
  const cd = { domain: { tp_chk_1: { status: 'fix', note: '' }, tp_chk_3: { status: 'no', note: '' }, tp_chk_4: { status: 'fix', note: '' } } };
  const b = Hwpx.resolveSections('techprotect', Object.assign({ workerCount: 25 }, proj), cd, [], {});
  const tb = (no) => b.sections.find((s) => s.no === no).text;
  assert.ok(tb(1).indexOf('상시근로자: 25명') >= 0 && tb(1).indexOf('종합 진행률') >= 0);
  assert.ok(tb(2).indexOf('[비밀관리성]') >= 0 && tb(2).indexOf('[경업금지]') < 0, '2장에는 비밀관리성 분류만');
  assert.ok(tb(3).indexOf('[경업금지]') >= 0 && tb(3).indexOf('[비밀관리성]') < 0, '3장에는 인사·계약 분류만');
  assert.ok(tb(4).indexOf('[직무발명]') >= 0, '4장에는 직무발명 분류');
  // 다른 앱(분류 없음): 2·3장이 같은 줄을 되풀이하지 않는다
  const c = Hwpx.resolveSections('clinic', proj, { domain: { cl_chk_1: { status: 'fix' }, cl_chk_2: { status: 'fix' } } }, [], {});
  const clin = Cats.get('clinic');
  if (clin.domainChecks.length >= 2) {
    const c2 = c.sections.find((s) => s.no === 2).text, c3 = c.sections.find((s) => s.no === 3).text;
    const lines = (x) => x.split('\n').filter((l) => /^\d+\. \[/.test(l)).map((l) => l.replace(/^\d+\. /, ''));
    const both = lines(c2).filter((l) => lines(c3).indexOf(l) >= 0);
    assert.equal(both.length, 0, '다른 앱 2·3장에 같은 점검 줄이 되풀이된다: ' + both.join(' / '));
  }
});
