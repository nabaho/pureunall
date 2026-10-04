'use strict';
/* 설정 › 「자료 자동 가져오기」 (대표 지시 2026-10-04 「이부분 내가 안받고 자동으로 가지고 오게해라」
   → 목업 → 「1 접어두고 2 빼라」)

   ■ 이 검사가 지키는 «규칙»
     ① 오른쪽은 «자동» 한 상자 — 언제 · 마지막 결과를 보인다(단추가 앞에 나서지 않는다)
     ② 손 단추는 «접어 둔» 칸 안에만 — 지우지는 않는다(급할 때)
     ③ 개발용 「엿보기」 단추는 없다
     ④ 날짜는 «서울» 날로 견준다 — UTC 오늘() 로 견주면 아침 9시 전에 «어제»가 «막힘»으로 보인다
     ⑤ 서버가 못 가져온 날은 «탈»을 남기고, 가져온 날은 지운다 — 줄이 ⚠ 를 거짓 없이 보인다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs, stripComments } = require('./strip-comments.js');
/* ⚠ 줄끝을 \n 하나로 — 저장소는 CRLF, CI 는 LF 다. 함수 끝(\n}\n)을 찾는 셈이 둘 다에서 돌게 */
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 설정본 = (/function 설정화면\(\)\{[\s\S]*?\n\}/.exec(화면) || [''])[0];
const 함수 = (이름) => { const i = 화면.indexOf('function ' + 이름 + '('); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };

test('① 오른쪽은 «자동» 한 상자 — 현황 줄이 먼저, 손 단추는 그 아래 접힌 칸', () => {
  const i자동 = 설정본.indexOf('자료 자동 가져오기');
  const i줄 = 설정본.indexOf('${자동현황줄()}');
  const i접 = 설정본.indexOf('<details class="fold">', i자동);
  assert.ok(i자동 > 0 && i줄 > i자동 && i접 > i줄, '현황 줄이 접힌 칸보다 먼저가 아니다');
  /* ② 손 단추는 접힌 칸 «안»에만 */
  const 접 = 설정본.slice(i접, 설정본.indexOf('</details>', i접));
  ['자료가져오기(true)', '자료가져오기(false)', "노무사회가져오기('list')", "노무사회가져오기('full')"].forEach((b) => {
    assert.ok(접.indexOf(b) >= 0, b + ' 가 접힌 칸에 없다 — 지웠거나 밖에 나왔다');
    assert.strictEqual(설정본.split(b).length - 1, 1, b + ' 가 접힌 칸 밖에도 있다');
  });
});

test('③ 「엿보기」 단추는 없다', () => {
  assert.ok(설정본.indexOf("노무사회가져오기('peek')") < 0);
  assert.ok(!/🔍 엿보기/.test(설정본));
});

test('④ 현황 — 서울 날로 견주고, 막힘·제때·첫 회를 가른다', () => {
  const 짐 = { App: {}, Intl, Date, Number, String, esc: (s) => String(s == null ? '' : s), setTimeout: () => 0, $: () => null };
  vm.createContext(짐);
  vm.runInContext(함수('서울날') + '\n' + 함수('자동현황줄'), 짐);
  const 오늘 = vm.runInContext('서울날()', 짐);
  짐.App.자동현황 = {
    뉴스: { 날: 오늘, 수: 9 }, 자료: { 날: '2026-01-01', 수: 0 },
    판례: { 날: 오늘, 수: 6, 쌓: 14, 탈: '법제처 응답 없음' }, 노무: {} };
  const h = vm.runInContext('자동현황줄()', 짐);
  const 줄 = (이름) => h.split('</div>').find((r) => r.indexOf(이름) >= 0) || '';
  assert.match(줄('신문 기사'), /class="ok">✓ 오늘/);
  assert.match(줄('고용노동부'), /class="warn">⚠ 마지막/, '오래된 날을 정상으로 보인다');
  assert.match(줄('판례'), /class="warn">⚠ 막힘/, '탈이 있는데 정상으로 보인다');
  assert.match(줄('공인노무사회'), /첫 회 기다림/);
  짐.App.자동현황.노무 = { 자동때: Date.now(), 자동탈: '로그인이 풀렸습니다' };
  const h2 = vm.runInContext('자동현황줄()', 짐);
  assert.match(h2.split('</div>').find((r) => r.indexOf('공인노무사회') >= 0), /⚠ 막힘[\s\S]*로그인이 풀렸습니다/);
  assert.ok(!/오늘\(\)/.test(함수('자동현황줄')), 'UTC 오늘() 로 견준다 — 아침 9시 전에 어제가 막힘으로 보인다');
});

test('⑤ 서버 — 못 가져오면 «탈»을 남기고, 가져오면 지운다', () => {
  const 모으기 = 서버.slice(서버.indexOf('async function 뉴스모으기한번'), 서버.indexOf('\n}\n', 서버.indexOf('async function 뉴스모으기한번')));
  assert.match(모으기, /탈: String\(e\.message \|\| e\)/);
  assert.match(모으기, /탈: null/);
  const 자판 = 서버.slice(서버.indexOf('async function 자료판례모아담기'), 서버.indexOf('\nexports.', 서버.indexOf('async function 자료판례모아담기')));
  assert.match(자판, /homepage\/newsDocs"\)\.update\(\{ 탈: 셈\.자료탈/);
  assert.match(자판, /homepage\/newsPrec"\)\.update\(\{ 탈: 셈\.판례탈/);
  assert.strictEqual((자판.match(/탈: null/g) || []).length, 2, '가져온 날에 탈을 안 지운다 — 한 번 막히면 영영 ⚠');
});
