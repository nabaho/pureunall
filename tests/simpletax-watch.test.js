/* 간이세액표 개정 감시 — engine/simpletax_watch.js · simpletax-watch.yml · 화면 경고
   왜 검사하는가: 간이세액표는 앱에 내장돼 있어서, 법이 바뀌었는데 아무도 모르면
   소득세가 조용히 옛 표로 계산된다. 감시기가 「별표2 개정일」을 제대로 읽는지,
   헛알림(시행령의 다른 조문 개정)에 속지 않는지, 화면이 경고를 띄우는지 **돌려서** 본다.
   실행: node tests/simpletax-watch.test.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'engine', 'simpletax_watch.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name + ' (=' + want + ')', got === want, '실제 ' + got);
}
function section(t) { console.log('\n── ' + t + ' ──'); }

/* 법제처 lawService(target=law) 응답의 모양을 줄여 옮긴 것 — 실제 응답(2026-10-03)에서
   별표단위 · 별표번호 · 별표가지번호 · 별표제목 · 별표내용 · 별표서식PDF파일링크 칸을 그대로 땄다. */
function unit(no, sub, title, head, pdf) {
  return '<별표단위 별표키="' + no + sub + 'E"><별표번호>' + no + '</별표번호><별표가지번호>' + sub +
    '</별표가지번호><별표구분>별표</별표구분><별표제목><![CDATA[' + title + ']]></별표제목>' +
    '<별표서식PDF파일링크>' + pdf + '</별표서식PDF파일링크>' +
    '<별표내용><![CDATA[■ 소득세법 시행령 [별표 ' + Number(no) + '] ' + head + ']]> <![CDATA[ ]]>' +
    '<![CDATA[ ' + title + ' ]]></별표내용></별표단위>';
}
const XML = '<법령><기본정보><공포일자>20260930</공포일자></기본정보><별표>' +
  unit('0001', '00', '근로소득공제표', '<개정 2019. 2. 12.>', '/LSW/flDownload.do?flSeq=1') +
  unit('0002', '00', '근로소득 간이세액표(제189조제1항 관련)', '<개정 2026. 2. 27.>', '/LSW/flDownload.do?flSeq=169813489') +
  unit('0003', '00', '연금소득 간이세액표(제189조제2항 관련)', '<개정 2023. 2. 28.>', '/LSW/flDownload.do?flSeq=3') +
  '</별표></법령>';

section('별표2 찾기 — 번호와 제목을 둘 다 본다');
const b = W.parseByl2(XML);
ok('별표2 를 찾았다', !!b);
eq('별표2 개정일', b && b.개정, '2026-02-27');
ok('★ 시행령 공포일자(2026-09-30)에 속지 않는다 — 다른 조문 개정은 표 개정이 아니다', b && b.개정 !== '2026-09-30');
eq('PDF 링크', b && b.pdf, 'https://www.law.go.kr/LSW/flDownload.do?flSeq=169813489');
eq('연금소득 간이세액표(별표3)를 잘못 집지 않는다', W.parseByl2(XML.replace('근로소득 간이세액표(제189조제1항', '무엇(')), null);
eq('별표2 의2(가지번호 01)는 별표2 가 아니다',
  W.parseByl2(unit('0002', '01', '근로소득 간이세액표 부표', '<신설 2027. 1. 1.>', '/LSW/flDownload.do?flSeq=9')), null);
eq('별표가 없으면 null', W.parseByl2('<법령></법령>'), null);
eq('밖에서 온 링크가 법제처 내려받기 꼴이 아니면 싣지 않는다',
  W.parseByl2(XML.replace('/LSW/flDownload.do?flSeq=169813489', 'https://evil.example/x')).pdf, null);

section('개정일 읽기 — 꺾쇠 안 여러 날짜');
eq('한 날짜', W.revisionOf('■ [별표 2] <개정 2026. 2. 27.> 근로'), '2026-02-27');
eq('여러 날짜면 가장 늦은 것', W.revisionOf('[별표 2] <개정 2024. 2. 29., 2026. 2. 27.>'), '2026-02-27');
eq('신설도 읽는다', W.revisionOf('[별표 3의4] <신설 2017. 12. 29.>'), '2017-12-29');
eq('머리가 없으면 null', W.revisionOf('근로소득 간이세액표'), null);

section('비교 — 내장 표 대 법제처');
const ST = require(path.join(ROOT, 'js', 'pu-simpletax.js'));
eq('내장 표 개정일', W.builtinRevision(ST.tables), '2026-02-27');
eq('여러 표면 가장 늦은 개정', W.builtinRevision([{ 개정: '2024-02-29' }, { 개정: '2026-02-27' }]), '2026-02-27');
eq('같으면 same', W.judge('2026-02-27', '2026-02-27'), 'same');
eq('★ 법이 새것이면 newer(알림)', W.judge('2026-02-27', '2027-02-26'), 'newer');
eq('법제처가 옛것이면 older', W.judge('2027-02-26', '2026-02-27'), 'older');
eq('못 읽었으면 판단하지 않는다', W.judge('2026-02-27', null), null);
eq('법제처 창구는 소득세법 시행령(003956)', /ID=003956/.test(W.LAW_URL), true);

section('감시기를 실제로 돌린다 — 받아 둔 XML 로');
const os = require('os'), cp = require('child_process');
const tmp = path.join(os.tmpdir(), 'st-watch-' + process.pid + '.xml');
const run = function (xml) {
  fs.writeFileSync(tmp, xml);
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'engine', 'simpletax_watch.js'), '--xml', tmp],
    { encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_OUTPUT: '' }) });
  let j = null; try { j = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { }
  return { code: r.status, j: j };
};
const r1 = run(XML);
eq('현행과 같으면 끝 코드 0', r1.code, 0);
eq('현행과 같으면 same', r1.j && r1.j.state, 'same');
const r2 = run(XML.replace('<개정 2026. 2. 27.>', '<개정 2026. 2. 27., 2027. 2. 26.>'));
eq('★ 별표2 가 새로 개정되면 newer', r2.j && r2.j.state, 'newer');
eq('새 개정일을 알린다', r2.j && r2.j.law_rev, '2027-02-26');
const r3 = run('<법령>응답 모양이 바뀜</법령>');
eq('★ 못 읽으면 끝 코드 2(빨간불 — 조용히 지나가지 않는다)', r3.code, 2);
try { fs.unlinkSync(tmp); } catch (e) { }

section('매일 감시 작업 — .github/workflows/simpletax-watch.yml');
const Y = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'simpletax-watch.yml'), 'utf8');
ok('매일 돈다(cron)', /cron:\s*'0 21 \* \* \*'/.test(Y));
ok('손으로도 돌릴 수 있다', /workflow_dispatch:/.test(Y));
ok('알림 글을 쓸 권한만 연다(contents 는 읽기)', /contents:\s*read/.test(Y) && /issues:\s*write/.test(Y));
ok('newer 일 때 알림 글을 연다', /state == 'newer'/.test(Y) && /gh issue create/.test(Y));
ok('같은 개정일 글이 있으면 다시 안 연다', /gh issue list --label simpletax-watch --state open/.test(Y) && /grep -qF/.test(Y));
ok('same 이면 열린 알림 글을 닫는다', /state == 'same'/.test(Y) && /gh issue close/.test(Y));
ok('PR 에서는 알림 글을 건드리지 않는다', (Y.match(/github\.event_name != 'pull_request'/g) || []).length >= 2);
ok('★ 자동 구현(ai-ready)을 걸지 않는다 — 시행일은 사람이 부칙을 보고 넣는다', !/--label\s+ai-ready|label.*ai-ready/.test(Y.replace(/#.*$/gm, '')));
ok('밖에서 온 값을 run 글에 ${{ }} 로 바로 넣지 않는다(env 로 넘긴다)',
  !/run: \|[\s\S]*?\$\{\{\s*steps\.w\.outputs/.test(Y.split('- name:').filter(function (s) { return /run:/.test(s); }).map(function (s) { return s.slice(s.indexOf('run:')); }).join('\n')));
ok('알림 글이 시행일을 사람이 확인하라고 말한다', /부칙에서 시행일 확인/.test(Y));

section('급여관리 화면 경고 — 실제로 돌린다');
const H = fs.readFileSync(path.join(ROOT, 'payroll-os.html'), 'utf8');
const grabFn = function (name) {
  const i = H.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  let d = 0, st = false;
  for (let j = i; j < H.length; j++) {
    if (H[j] === '{') { d++; st = true; }
    else if (H[j] === '}') { d--; if (st && d === 0) return H.slice(i, j + 1); }
  }
  throw new Error('괄호 안 닫힘: ' + name);
};
var TAX_WATCH = { done: true, busy: false, items: [] };
var fetchCalls = 0;
var fetch = function () { fetchCalls++; return new Promise(function () { }); };
var App = { screen: 'cards' };
eval((/var TAX_WATCH_URL = '[^']*';/.exec(H) || ['var TAX_WATCH_URL = "";'])[0]);
eval(grabFn('taxWatchItems'));
eval(grabFn('loadTaxWatch'));
eval(grabFn('taxWatchBanner'));
eq('열린 알림 글이 없으면 경고도 없다', taxWatchBanner(), '');
const items = taxWatchItems([
  { title: '간이세액표 개정 감지 — 별표2 개정 2027-02-26', html_url: 'https://github.com/nabaho/pureunall/issues/1900' },
  { title: 'PR 은 빼야', html_url: 'https://github.com/nabaho/pureunall/issues/1901', pull_request: {} },
  { title: '남의 주소', html_url: 'https://evil.example/issues/1' },
  { title: '<img src=x onerror=alert(1)>', html_url: 'https://github.com/nabaho/pureunall/issues/1902' }
]);
eq('PR·남의 주소는 거른다', items.length, 2);
TAX_WATCH.items = items;
const ban = taxWatchBanner();
ok('★ 열린 알림 글이 있으면 경고가 뜬다', /새로 개정됐습니다/.test(ban) && /옛 표로 계산/.test(ban));
ok('알림 글로 가는 고리가 있다', ban.indexOf('https://github.com/nabaho/pureunall/issues/1900') > -1);
ok('★ 제목의 꺾쇠는 글자로 바뀐다(밖에서 온 글이 화면을 못 고친다)', ban.indexOf('<img') < 0 && ban.indexOf('&lt;img') > -1);
TAX_WATCH = { done: false, busy: false, items: [] };
taxWatchBanner(); taxWatchBanner();
eq('읽기는 한 번만(겹쳐 부르지 않는다 — 요청 한도)', fetchCalls, 1);
ok('설정 카드에 경고 자리가 있다', /h\+=taxWatchBanner\(\)/.test(H));
ok('근태 급여 미리보기에 경고 자리가 있다', /h2 \+= taxWatchBanner\(\)/.test(H));
ok('읽는 곳은 이 저장소의 simpletax-watch 알림 글', /repos\/nabaho\/pureunall\/issues\?labels=simpletax-watch&state=open/.test(H));

console.log('\n════════════════════════════════');
console.log('  통과 ' + pass + ' · 실패 ' + fail);
console.log('════════════════════════════════');
process.exit(fail ? 1 : 0);
