'use strict';
/* 📑 쪽마다 갈라 저장 · 서류에서 제목 찾기 (대표 지시 2026-09-13)
   ─────────────────────────────────────────────────────────────
   대표 지시: 「저장할 때 제목은 첨부 파일에서 찾아서 제목으로 만들고,
   만약 페이지마다 저장해야 되면 페이지 나누어서 저장하고 제목도 정할 수 있게도 해달라」

   기관 서식 한 덩이에 여러 서류가 들어 있다 —
   「모집공고문, 지원서, 수행계획서, 개인정보 동의서, 평가기준표」가 한 파일이었다.
   쪽마다 갈라 내려면 그 쪽이 «무슨 서류인지» 이름이 있어야 한다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ①★ 첫 줄이 제목이 아니다 — 실측: 첫 줄은 「[붙임 1]」이고 제목은 둘째 줄이다
     ② 제목답지 않은 줄(글머리·번호·날짜·「담당자 :」)은 고르지 않는다
     ③ 못 찾으면 «빈 글자» — 지어내지 않는다
     ④ 한 묶음만 남기면 그 쪽 하나짜리 서류가 된다
     ⑤ 파일 이름으로 쓸 수 없는 글자를 걸러 낸다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const T = require(path.join(R, 'js', 'kcareer-hwpxtidy.js'));
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

function p(t, brk) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="' + (brk ? '1' : '0') + '" columnBreak="0">'
    + '<hp:run charPrIDRef="0"><hp:t>' + (t || '') + '</hp:t></hp:run></hp:p>';
}

/* 대표 서식을 흉내 낸다 — 한 덩이에 서류 넷 */
const 서식 = p('[붙임 1]') + p('가나상사(주) 노무고문 공개모집 공고') + p('1. 모집분야 및 인원')
  + p('[붙임 2]', true) + p('노무고문 지원서') + p('○ 인적사항')
  + p('[붙임 3]', true) + p('※ 6매 이내로 작성할 것') + p('노무고문 수행계획서')
  + p('2026. 09. 13.', true) + p('개인정보 수집·이용 동의서') + p('담당자 :');

test('①★ 첫 줄이 제목이 아니다 — 「[붙임 1]」을 건너뛰고 그다음을 고른다', () => {
  const ps = T.pages(서식);
  assert.equal(ps.length, 4, '쪽 묶음이 넷이어야 합니다');
  assert.equal(ps[0].title, '가나상사(주) 노무고문 공개모집 공고',
    '「[붙임 1]」을 제목으로 골랐습니다: ' + ps[0].title);
  assert.equal(ps[1].title, '노무고문 지원서');
});

test('②★ 글머리·번호·날짜·「… :」 는 제목이 아니다', () => {
  const ps = T.pages(서식);
  assert.equal(ps[2].title, '노무고문 수행계획서',
    '「※ 6매 이내로…」를 제목으로 골랐습니다: ' + ps[2].title);
  assert.equal(ps[3].title, '개인정보 수집·이용 동의서',
    '날짜나 「담당자 :」를 제목으로 골랐습니다: ' + ps[3].title);
  /* 「1. 모집분야 및 인원」도 제목이 아니다 — 첫 묶음의 제목이 그것이면 안 된다 */
  assert.notEqual(ps[0].title, '1. 모집분야 및 인원');
});

test('②-2★ 「제출처 :」처럼 콜론으로 끝나는 줄은 제목이 아니다', () => {
  /* ⚠ 기관 서식은 「신 청 인 :」·「제출처 :」를 맨 위에 두는 일이 잦다.
     걸러 내지 않으면 그것이 서류 이름이 되어 파일이 「제출처 .hwpx」로 나간다. */
  const 콜론먼저 = p('제출처 : ') + p('가나상사 노무고문 지원서');
  assert.equal(T.pages(콜론먼저)[0].title, '가나상사 노무고문 지원서',
    '콜론으로 끝나는 줄을 제목으로 골랐습니다: ' + T.pages(콜론먼저)[0].title);
});

test('②-3★ 「2026년 9월 13일」처럼 날짜만 있는 줄은 제목이 아니다', () => {
  /* ⚠ 「2026. 09. 13.」은 번호 거르개가 잡아 주지만 「2026년 9월 13일」은 안 잡힌다 —
     날짜 거르개가 따로 있어야 하는 까닭이다. */
  const 날짜먼저 = p('2026년 9월 13일') + p('개인정보 수집·이용 동의서');
  assert.equal(T.pages(날짜먼저)[0].title, '개인정보 수집·이용 동의서',
    '날짜를 제목으로 골랐습니다: ' + T.pages(날짜먼저)[0].title);
});

test('③★ 못 찾으면 «빈 글자» — 지어내지 않는다', () => {
  const 없는것 = p('○ 가나') + p('1. 나다') + p('2026. 01. 01.');
  assert.equal(T.pages(없는것)[0].title, '', '없는 제목을 지어냈습니다');
  assert.equal(T.docTitle(없는것), '');
  assert.equal(T.docTitle(''), '');
});

test('④ 너무 짧거나 너무 긴 줄은 제목이 아니다', () => {
  assert.equal(T.pages(p('가나') + p('다라마바 사아자차'))[0].title, '다라마바 사아자차',
    '두 글자를 제목으로 골랐습니다');
  const 긴줄 = '가'.repeat(70);
  assert.equal(T.pages(p(긴줄) + p('가나상사 지원서'))[0].title, '가나상사 지원서',
    '일흔 글자짜리 문장을 제목으로 골랐습니다');
});

test('⑤ 서류 전체의 제목은 «맨 앞 묶음»의 제목이다', () => {
  assert.equal(T.docTitle(서식), '가나상사(주) 노무고문 공개모집 공고');
});

test('⑥★ 한 묶음만 남기면 그 쪽 하나짜리 서류가 된다', () => {
  const r = T.keepOnly(서식, 1);
  assert.equal(r.refused, false, '「전부 빼기」 빗장에 걸렸습니다');
  assert.equal(T.pages(r.xml).length, 1, '한 묶음만 남아야 합니다');
  assert.ok(r.xml.indexOf('노무고문 지원서') >= 0, '남길 쪽이 사라졌습니다');
  ['공개모집 공고', '수행계획서', '동의서'].forEach((s) => {
    assert.ok(r.xml.indexOf(s) < 0, '「' + s + '」가 남아 있습니다');
  });
});

test('⑦★ 첫 묶음만 남겨도 앞에 빈 쪽이 생기지 않는다', () => {
  const r = T.keepOnly(서식, 0);
  assert.equal(T.pages(r.xml).length, 1);
  const X = require(path.join(R, 'js', 'kcareer-hwpxfill.js'));
  const first = X.tagBlocks(r.xml, 'hp:p')[0];
  assert.ok(/pageBreak="0"/.test(T._openTag(first.text)),
    '맨 앞 문단에 쪽 나누기가 남아 첫 장이 빕니다');
});

test('⑧ 파일 이름으로 못 쓰는 글자를 걸러 낸다', () => {
  assert.equal(T.safeName('가나/나다:라마*바'), '가나 나다 라마 바');
  assert.equal(T.safeName('  가나   상사  '), '가나 상사');
  assert.equal(T.safeName(''), '');
  assert.ok(T.safeName('가'.repeat(200)).length <= 80, '이름이 너무 깁니다');
});

test('⑨ 갈라도 원문은 그대로다 — 되돌릴 수 없는 지우기가 아니다', () => {
  const 전 = 서식;
  T.keepOnly(서식, 2);
  assert.equal(서식, 전, '원문을 고쳤습니다');
});

test('⑩ 화면: 제목을 고칠 수 있고, 구역이 여럿이면 «못 한다»고 말한다', () => {
  assert.match(CODE, /function rhSplitSave\(/, '갈라 저장하는 길이 없습니다');
  assert.match(CODE, /function rhSplitTitle\(/, '제목을 고칠 길이 없습니다');
  assert.match(CODE, /id="tdSplit"/, '갈라 저장 목록 자리가 없습니다');
  const fn = (function cut(s, d) {
    const h = s.indexOf(d); let i = s.indexOf('{', h), n = 0;
    for (; i < s.length; i++) { if (s[i] === '{') n++; else if (s[i] === '}') { n--; if (!n) break; } }
    return s.slice(h, i + 1);
  })(CODE, 'async function rhSplitSave(');
  assert.match(fn, /구역이 여럿/, '구역이 여럿일 때 못 한다고 말하지 않습니다');
  /* ⚠ 화면에서 본 그대로 나가야 한다 — 원본이 아니라 «내보낼 바이트»에서 가른다 */
  assert.match(fn, /await rhComposeBytes\(\)/, '친 값·정리가 안 들어간 채로 갈라집니다');
});

test('⑩-2★ 찾은 제목을 화면 쪽으로 «실어 보낸다» — 안 실으면 제목칸이 통째로 빈다', () => {
  /* ⚠ 2026-09-13 실측: 검사는 모두 녹색인데 화면에서는 넷 다 「못 찾음」이었다.
     쪽 묶음을 화면으로 옮기는 자리에서 title 을 빠뜨렸기 때문이다.
     모듈이 제목을 «찾는 것»과 화면이 그것을 «받는 것»은 다른 일이다. */
  const fn = (function cut(s, d) {
    const h = s.indexOf(d); let i = s.indexOf('{', h), n = 0;
    for (; i < s.length; i++) { if (s[i] === '{') n++; else if (s[i] === '}') { n--; if (!n) break; } }
    return s.slice(h, i + 1);
  })(CODE, 'async function rhTidyPages(');
  assert.match(fn, /title\s*:/, '찾은 제목을 화면으로 안 실어 보냅니다 — 제목칸이 빈 채로 뜹니다');
});

test('⑪ 내보내기 이름도 «서류에서 찾은 제목»을 쓴다 — 못 찾으면 옛 이름으로 물러선다', () => {
  const fn = (function cut(s, d) {
    const h = s.indexOf(d); let i = s.indexOf('{', h), n = 0;
    for (; i < s.length; i++) { if (s[i] === '{') n++; else if (s[i] === '}') { n--; if (!n) break; } }
    return s.slice(h, i + 1);
  })(CODE, 'async function rhHwpOut(');
  assert.match(fn, /rhDocTitle\(\)/, '제목을 안 찾습니다');
  assert.match(fn, /rhCleanName\(/, '못 찾았을 때 물러설 이름이 없습니다');
});
