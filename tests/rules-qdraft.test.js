/* 📝 질문으로 바로 작성 — 표준취업규칙(2026)을 답으로 채우고 골라 «제정안» 한 권을 짓고, 곧바로 92항목 검토
   대표 지시 2026-10-07 「대한민국에서 … 취업규칙시스템 모두 검토하고 … 완벽히 자동화가 되고 있는 프로그램이 있으면
   이를 벤치마킹하고 유사하게 변경 사용가능하게 해라」. 조사 기록은 status/2026-10-07-rules-benchmark-qdraft.md.
   회사 이름은 가짜만.

   ■ 지키는 규칙
     ① 표준 원문의 빈칸만 채운다 — 회사·수습·근로시간(18세 미만 포함)·휴게·지급일·정년·수당·창립기념일·하기휴가·교대
     ② 안 쓰는 선택 조는 빼고 번호를 다시 매긴다 — 이 규칙의 조 인용만 새 번호로, 법령 인용은 그대로
     ③ 퇴직급여 갈래(30명 이하 · 퇴직금)는 답으로 하나만 남는다 — 「<…>」 안내 줄이 안 남는다
     ④ 위법이 되는 답은 받지 않는다(정년 60 미만 · 휴게 1시간 미만 · 8시간이 아닌 근로시간)
     ⑤ 못 채운 빈칸은 숨기지 않는다 — 「100일」의 00 은 빈칸이 아니다
     ⑥ 화면 — ＋ 신규가 질문 창을 열고, 지은 것은 «제정»으로 넣기·검토·보관까지 간다
        (번호는 처음부터 · 기준일은 시행일 · 서류는 「제정」 · 부칙은 한 줄+단서 · 준비된 개정 문안만 바로 반영)
   실행: node --test tests/rules-qdraft.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const D = require('../js/pu-rules-draft.js');
const STD = (() => { const g = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'std_2026.js'), 'utf8') + '\nwindow.STD_2026=STD_2026;')(g); return g.STD_2026; })();
const RAW = fs.readFileSync(path.join(ROOT, 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
const 기본 = { company: '주식회사 가나상사', size: 23, effective: '2026-11-01' };
const 조 = (t, title) => { const m = new RegExp('^제(\\d+)조\\(' + title.replace(/[()]/g, '\\$&') + '\\)[^\\n]*(?:\\n(?!제\\d+조\\(|제\\s*\\d+\\s*[장절]|부\\s*칙)[^\\n]*)*', 'm').exec(t); return m ? { no: +m[1], text: m[0] } : null; };

test('① 빈칸을 답으로 채운다', () => {
  const r = D.build(STD, Object.assign({}, 기본, { allowances: '직책수당, 자격수당', founding: '3월 2일', payDay: 10, probation: 2, retireAge: 62 }));
  assert.equal(r.ok, true, (r.why || []).join(' / '));
  const t = r.text;
  assert.match(조(t, '목적').text, /주식회사 가나상사 사원의/);
  assert.match(조(t, '수습기간').text, /2개월간을 수습기간/);
  assert.match(조(t, '근로시간').text, /09:00부터 18:00까지 8시간.*09:00부터 17:00까지 7시간/s, '★ 18세 미만 7시간의 종업이 틀렸다');
  assert.match(조(t, '휴게').text, /12:00부터 13:00까지/);
  assert.match(조(t, '임금의 계산 및 지급방법').text, /해당 월의 10일/);
  assert.match(조(t, '정년').text, /만62세/);
  assert.match(조(t, '임금의 구성항목').text, /기본급 및 직책수당, 자격수당과 .*기본급, 직책수당, 자격수당 등으로/s);
  assert.match(조(t, '유급휴일').text, /창립기념일인 3월 2일은 유급휴일/);
  assert.match(t, /부 칙\n제1조\(시행일\) 이 규칙은 2026년 11월 1일부터 시행한다\./);
  assert.equal(r.leftovers.length, 0, '빈칸이 남았다: ' + r.leftovers.join(', '));
  const b = D.build(STD, 기본).text;
  assert.match(조(b, '임금의 구성항목').text, /임금은 기본급과 연장/, '수당이 없는데 「○○수당」이 남았다');
  assert.match(조(b, '유급휴일').text, /③ 노동절\(5월 1일\)은 유급휴일로 한다\./);
});

test('② 안 쓰는 조는 빼고 다시 매긴다 — 이 규칙의 인용만 새 번호, 법령 인용은 그대로', () => {
  const r = D.build(STD, 기본);
  const t = r.text;
  assert.deepEqual(r.dropped.map((d) => d.title), ['교대근로', '탄력적 근로시간제', '선택적 근로시간제', '간주근로시간제', '재량근로', '하기휴가', '상여금 지급']);
  ['교대근로', '탄력적 근로시간제', '하기휴가', '상여금 지급'].forEach((x) => assert.equal(조(t, x), null, x + ' 가 남았다'));
  const nos = [...t.split('부 칙')[0].matchAll(/^제(\d+)조\(/gm)].map((m) => +m[1]);
  assert.deepEqual(nos, nos.map((_, i) => i + 1), '★ 번호가 1부터 이어지지 않는다');
  const 휴일 = 조(t, '유급휴일').no, 근로 = 조(t, '근로시간').no;
  assert.match(조(t, '근로시간').text, new RegExp('제' + 휴일 + '조제1항에 따른 유급주휴일'), '★ 옮겨 간 조를 옛 번호로 가리킨다');
  assert.match(조(t, '휴게').text, new RegExp('제' + 근로 + '조제3항의 근로시간'));
  assert.match(t, /｢근로기준법｣ 제2조제1항제6호/, '★ 법령 인용(근로기준법 제2조)까지 바꿨다');
  assert.match(t, /동법 시행령 제14조/);
  assert.equal(r.warnings.length, 0, r.warnings.join(' / '));
  const s = D.build(STD, Object.assign({}, 기본, { shift: '3조2교대', shiftScope: '생산직 사원', summer: '7월 1일~8월 31일', probation: 0 }));
  assert.match(조(s.text, '교대근로').text, /생산직 사원의 근무형태는 3조2교대로 한다\./);
  assert.match(조(s.text, '하기휴가').text, /7월 1일부터 8월 31일까지/);
  assert.equal(조(s.text, '수습기간'), null, '수습 0개월인데 수습 조가 남았다');
});

test('③ 퇴직급여 갈래는 하나만 — 안내 줄이 안 남는다', () => {
  const 큰 = D.build(STD, Object.assign({}, 기본, { size: 50 })).text;
  const 작은 = D.build(STD, 기본).text;
  const 퇴직금 = D.build(STD, Object.assign({}, 기본, { retirement: 'severance' })).text;
  [큰, 작은, 퇴직금].forEach((t) => {
    assert.ok(!/^[<＜]/m.test(t), '★ 「<…>」 안내 줄이 문서에 남았다');
    assert.equal((t.match(/^제\d+조\(퇴직급여제도의 설정\)/gm) || []).length, 1, '퇴직급여 조가 하나가 아니다');
  });
  assert.ok(!/중소기업퇴직연금기금제도 중/.test(조(큰, '퇴직급여제도의 설정').text), '30명 넘는데 중소기업퇴직연금기금이 들었다');
  assert.match(조(작은, '퇴직급여제도의 설정').text, /중소기업퇴직연금기금제도 중 하나 이상/);
  assert.match(조(작은, '중도인출').text, /제23조의13/);
  assert.match(조(퇴직금, '퇴직급여제도의 설정').text, /퇴직금을 지급한다/);
  assert.ok(조(퇴직금, '중간정산') && !조(퇴직금, '중도인출'), '퇴직금인데 중도인출이 남았다');
});

test('④ 위법이 되는 답은 안 받는다', () => {
  const v = (o) => D.validate(Object.assign({}, 기본, o));
  assert.equal(v({ retireAge: 59 }).ok, false, '★ 정년 59세를 받았다');
  assert.equal(v({ breakStart: '12:00', breakEnd: '12:30', end: '17:30' }).ok, false, '★ 휴게 30분을 받았다');
  assert.equal(v({ end: '19:00' }).ok, false, '★ 9시간 근로를 받았다');
  assert.equal(v({ company: ' ' }).ok, false);
  assert.equal(v({ summer: '여름' }).ok, false);
  assert.equal(D.build(STD, { company: '', size: 10 }).ok, false);
  assert.equal(v({}).ok, true);
});

test('⑤ 못 채운 빈칸은 알린다 — 「100일」은 빈칸이 아니다', () => {
  const r = D.build(STD, Object.assign({}, 기본, { flex: { elastic: true }, bonus: true, effective: '' }));
  assert.ok(r.leftovers.some((x) => /탄력적 근로시간제/.test(x)), '탄력제 빈칸을 안 알린다');
  assert.ok(r.leftovers.some((x) => /상여금/.test(x)));
  assert.ok(r.leftovers.indexOf('부칙 제1조(시행일)') >= 0, '시행일 빈칸을 안 알린다(부칙인 줄 알게)');
  assert.ok(!r.leftovers.some((x) => /임산부의 보호/.test(x)), '★ 「100일」을 빈칸으로 셌다');
  const w = D.build(STD, Object.assign({}, 기본, { term: '직원' })).text;
  assert.ok(!/사원/.test(w) && /직원/.test(w), '부르는 말이 다 안 바뀌었다');
});

test('⑥ 화면 — ＋ 신규가 질문 창 · 제정으로 넣기·검토·보관', () => {
  assert.match(RAW, /<script src="js\/pu-rules-draft\.js\?v=\d+"><\/script>/);
  assert.match(RAW, /id="ov-qdraft"/);
  const nw = RAW.slice(RAW.indexOf('$("dash-new").addEventListener("click"'), RAW.indexOf('$("qd-old")'));
  assert.match(nw, /\$\("ov-qdraft"\)\.classList\.add\("on"\)/, '＋ 신규가 질문 창을 안 연다');
  assert.ok(!/prompt\(/.test(nw), '＋ 신규가 아직 이름만 묻는다');
  const td = RAW.slice(RAW.indexOf('async function takeDraft('), RAW.indexOf('function qdAutoAdopt('));
  assert.match(td, /\(제정안\)\.txt/, '제정 표시(파일 이름)가 없다');
  assert.match(td, /REV_MODE="full"/, '★ 새 한 권인데 가지번호로 매긴다');
  assert.match(td, /\$\("asof"\)\.value=ans\.effective\|\|todayKST\(\)/, '기준일이 시행일이 아니다');
  assert.ok(td.indexOf('REV_MODE="full"') < td.indexOf('run();') && td.indexOf('run();') < td.indexOf('autoSaveArchive('), '넣기→검토→보관 순서가 아니다');
  const ad = RAW.slice(RAW.indexOf('function qdAutoAdopt('), RAW.indexOf('function qdAutoAdopt(') + 700);
  assert.match(ad, /if\(!TPL_BY_RULE\[f\.rule\.id\]\)return;/, '★ 문안 없는 지적까지 반영한다');
  assert.match(ad, /if\(!it\|\|it\.decision\)return;/, '이미 내린 결정을 덮는다');
  assert.match(RAW, /function isEnact\(\)\{ return !!\(LAST&&\/\\\(제정안\\\)\//);
  assert.ok((RAW.match(/revKindWord\(\)/g) || []).length >= 5, '서류의 말이 「제정」으로 안 바뀐다');
  assert.match(RAW, /if\(isEnact\(\)\)return \{lines:\[\],entry:"이 규칙은 "/, '제정 부칙이 아니다');
  assert.match(RAW, /if\(\$\("asof"\)\)\$\("asof"\)\.value=todayKST\(\);/, '기준일이 아직 2026-07-21 에서 시작한다');
});

/* ── 단시간 근로자용 (대표 「추천대로」 2026-10-07) — 표준 「단시간 근로자용」은 조 번호가 다르다(제목으로 찾는다) ── */
const 단 = Object.assign({}, 기본, { kind: 'short', shortDays: '월, 수, 금', shortStart: '09:00', shortEnd: '14:00', shortBreakStart: '12:00', shortBreakEnd: '12:30' });

test('⑦ 단시간 — 요일·하루·한 주를 채우고, 일반과 같은 규칙으로 빼고 매긴다', () => {
  const r = D.build(STD, 단);
  assert.equal(r.ok, true, (r.why || []).join(' / '));
  const t = r.text;
  assert.match(조(t, '적용범위').text, /주식회사 가나상사\(이하 “회사”라 한다\)에 근무하는 단시간사원에게/, '단시간 원문이 아니다');
  assert.match(조(t, '근로시간').text, /근무일은 월, 수, 금요일로 하고, .*09:00~14:00까지\(4시간 30분\)로 하며, 1주 근로시간은 13시간 30분으로/s);
  assert.match(조(t, '근로시간').text, new RegExp('제' + 조(t, '휴게').no + '조의 휴게시간'), '★ 옮긴 휴게 조를 옛 번호로 가리킨다');
  assert.match(조(t, '휴게').text, /12:00부터 12:30까지/);
  assert.equal(r.leftovers.length, 0, r.leftovers.join(', '));
  assert.ok(!/^[<＜]/m.test(t), '퇴직급여 안내 줄이 남았다');
  const nos = [...t.split('부 칙')[0].matchAll(/^제(\d+)조\(/gm)].map((m) => +m[1]);
  assert.deepEqual(nos, nos.map((_, i) => i + 1));
  assert.ok(r.warnings.some((w) => /15시간 미만\(초단시간\)/.test(w)), '★ 주 13.5시간인데 초단시간을 안 알린다');
});

test('⑧ 단시간 — 위법이 되는 답은 안 받는다', () => {
  const v = (o) => D.validate(Object.assign({}, 단, o));
  assert.equal(v({ shortBreakStart: '', shortBreakEnd: '' }).ok, false, '★ 4시간 넘게 일하는데 휴게 없이 받았다(제54조)');
  assert.equal(v({ shortDays: '월 화 수 목 금', shortStart: '09:00', shortEnd: '18:00', shortBreakStart: '12:00', shortBreakEnd: '13:00' }).ok, false,
    '★ 주 40시간을 단시간으로 받았다(제2조제1항제9호)');
  assert.equal(v({ shortDays: '', }).ok, false);
  assert.equal(v({ shortEnd: '12:00', shortBreakStart: '', shortBreakEnd: '' }).ok, true, '3시간 근무는 휴게 없이 된다');
  const r = D.build(STD, Object.assign({}, 단, { shortEnd: '12:00', shortBreakStart: '', shortBreakEnd: '' }));
  assert.ok(r.leftovers.some((x) => /휴게/.test(x)), '휴게를 안 두는데 휴게 조의 빈칸을 안 알린다');
});

test('⑨ 화면 — 단시간은 «따로» 들인다(사업자번호 없이 · 이름에 단시간근로자)', () => {
  assert.match(RAW, /id="qd-short"/);
  const go = RAW.slice(RAW.indexOf('$("qd-go").addEventListener("click"'), RAW.indexOf('async function takeDraft('));
  assert.match(go, /kind:"short"/);
  assert.match(go, /if\(!rs\.ok\)\{[^}]*return; \}/, '단시간이 틀려도 일반만 짓는다(반쪽)');
  assert.match(go, /const qdShortSite=ans=>ans\.company\+" 단시간근로자";/);
  assert.match(RAW, /await takeDraft\(q\.r,q\.ans,"",qdShortSite\(q\.ans\)\)/, '★ 단시간을 같은 사업자번호로 넣어 일반 규칙을 덮어쓴다');
});
