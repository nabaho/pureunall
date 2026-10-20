/* 푸른 메일 → 옵시디언 «기업별·사람별·담당자별» 정리가 지켜야 할 규칙 (js/pu-mail-obsidian.js)
   ① 링크가 «실제 파일»로 이어진다 — 한 글자만 어긋나도 옵시디언 그래프가 조용히 끊긴다
   ② 본문·첨부 파일은 안 담고 «이름»만 담는다(대표 선택)  ③ 표 한 칸은 한 줄
   ④ 주민번호 지우개가 없으면 «하나도 쓰기 전에» 멈춘다  ⑤ 우리 쪽 주소는 상대가 아니다
   ⑥ 메일함 화면의 받아 둔 줄(_mbMsgs)을 안 건드리고, 총괄관리자 단추에만 달린다
   실행: node --test tests/mail-obsidian.test.js
   ⚠ 아래 이름·주소는 전부 지어낸 것이다(example.test). 실제 고객 자료 아님. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require(path.join(root, 'js/pu-mail-obsidian.js'));
const PM = globalThis.PuMailObsidian;
const CARDS = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

const D = (s) => new Date(s + 'T03:00:00Z').getTime();
const OWN = 'office@pureun.test';
const internal = (a) => /@pureun\.test$/.test(a);
const BOOK = {                 /* 이 화면이 «이미 아는 것»을 흉내 낸 표 */
  'kim@alpha.test': { co: '알파상사', owner: '박담당', subs: ['이부담'] },
  'lee@alpha.test': { co: '알파상사', owner: '박담당', subs: ['이부담'] },
  'choi@beta.test': { co: '베타/상사: 2호', owner: '', subs: [] }
};
const resolve = (a) => BOOK[a] || {};
const rows = [
  { d: D('2026-10-20'), s: '참여기업 모집 | 관련', e: 'kim@alpha.test', f: '김대리', t: OWN, a: 2, an: ['설명회.pdf', '계획(안).hwpx'], folder: '받은메일함' },
  { d: D('2026-10-21'), s: '답장드립니다', e: OWN, f: '푸른', t: 'kim@alpha.test,lee@alpha.test', tn: '김대리', a: 0, folder: '보낸메일함' },
  { d: D('2026-10-22'), s: '문의', e: 'choi@beta.test', f: '최팀장', t: OWN, a: 0, folder: '받은메일함' },
  { d: D('2026-10-23'), s: '광고', e: 'ad@spam.test', f: '광고', t: OWN, a: 0, folder: '받은메일함' },
  { d: D('2026-10-24'), s: '내부 공지', e: 'staff@pureun.test', f: '직원', t: OWN, a: 0, folder: '받은메일함' },
  /* 같은 메일이 두 폴더에 — 한 통으로 센다 */
  { d: D('2026-10-20'), s: '참여기업 모집 | 관련', e: 'kim@alpha.test', f: '김대리', t: OWN, a: 2, an: ['설명회.pdf', '계획(안).hwpx'], folder: '보관' }
];
const out = PM.build(rows, { isInternal: internal, resolve, now: D('2026-10-25') });
const F = out.files;
const keys = Object.keys(F);
const by = (dir) => keys.filter((k) => k.startsWith('메일/' + dir + '/'));

test('기업·사람·담당자 장이 갈라져 나온다', () => {
  assert.ok(by('기업').length >= 2, '기업 장이 없다');
  assert.ok(by('사람').length >= 2, '사람 장이 없다');
  assert.ok(by('담당자').length >= 1, '담당자 장이 없다');
  assert.ok(F['메일/개요.md'], '개요가 없다');
  const alpha = F[by('기업').find((k) => /알파상사/.test(k))];
  assert.match(alpha, /박담당/);
  assert.match(alpha, /이부담/, '부담당이 빠졌다');
  assert.match(alpha, /김대리/);
});

test('같은 메일이 두 폴더에 있어도 한 통이고, 우리 쪽끼리 오간 것은 상대 없이 센다', () => {
  assert.equal(out.stats.total, 5, '중복 한 통이 안 걷혔다');
  assert.equal(out.stats.internalOnly, 1);
});

test('① 모든 [[링크]]는 실제로 만든 파일을 가리킨다', () => {
  const have = new Set(keys.map((k) => k.replace(/\.md$/, '').toLowerCase()));
  let n = 0;
  keys.forEach((k) => {
    (F[k].match(/\[\[[^\]]+\]\]/g) || []).forEach((l) => {
      n++;
      const target = l.slice(2, -2).split('|')[0].toLowerCase();
      assert.ok(have.has(target), k + ' 의 ' + l + ' 가 가리키는 파일이 없다');
    });
  });
  assert.ok(n >= 6, '링크가 너무 적다 — 그래프가 안 이어진다');
});

test('파일 이름에 금지문자가 없고, 대소문자만 다른 이름도 겹치지 않는다', () => {
  keys.forEach((k) => assert.ok(!/[\\:*?"<>|#^[\]]/.test(k.split('/').slice(1).join('/').replace(/\.md$/, '')), '금지문자: ' + k));
  assert.equal(new Set(keys.map((k) => k.toLowerCase())).size, keys.length);
  const two = PM.build([
    { d: 1, s: 'a', e: 'x@one.test', f: 'X', t: OWN }, { d: 2, s: 'b', e: 'y@two.test', f: 'Y', t: OWN }
  ], { isInternal: internal, resolve: (a) => ({ co: a.startsWith('x') ? 'Acme' : 'ACME', owner: '' }) });
  const cos = Object.keys(two.files).filter((k) => k.startsWith('메일/기업/'));
  assert.equal(new Set(cos.map((k) => k.toLowerCase())).size, cos.length, '대소문자만 다른 두 업체가 한 파일로 겹쳤다');
});

test('② 본문·첨부 파일은 없고 첨부 «이름»만 있다', () => {
  const all = keys.map((k) => F[k]).join('\n');
  assert.match(all, /설명회\.pdf/);
  assert.ok(!keys.some((k) => !/\.md$/.test(k)), '마크다운 말고 다른 파일이 나왔다');
});

test('③ 표 한 칸은 한 줄 — 제목의 | 와 줄바꿈이 표를 깨지 않는다', () => {
  const alpha = F[by('기업').find((k) => /알파상사/.test(k))];
  const line = alpha.split('\n').find((l) => /참여기업 모집/.test(l));
  assert.ok(line, '제목 줄이 없다');
  assert.equal(line.split(' | ').length, 6, '표 칸 수가 어긋났다: ' + line);
  const multi = PM.build([{ d: 1, s: '줄\n바꿈\t탭', e: 'q@alpha.test', f: '큐', t: OWN }], { isInternal: internal, resolve });
  Object.values(multi.files).forEach((t) => t.split('\n').filter((l) => l.startsWith('| ')).forEach((l) => assert.ok(/\|$/.test(l.trim()))));
});

test('업체를 못 찾은 주소는 «업체 미확인»에 모으고 한두 통짜리는 사람 장을 안 만든다', () => {
  assert.ok(keys.some((k) => k.includes('업체 미확인')));
  assert.ok(!by('사람').some((k) => /ad@spam\.test/.test(k)), '광고 한 통에 사람 장이 생겼다');
  const many = PM.build([1, 2, 3].map((i) => ({ d: i, s: 's' + i, e: 'z@unknown.test', f: '제로', t: OWN })), { isInternal: internal, resolve });
  assert.ok(Object.keys(many.files).some((k) => k.startsWith('메일/사람/') && k.includes('z@unknown.test')), '3통 오간 주소는 사람 장이 있어야 한다');
});

test('베타상사는 담당자가 없어 «담당 미지정» 장으로 간다', () => {
  assert.ok(by('담당자').some((k) => k.includes('담당 미지정')));
});

test('④ 주민번호 지우개가 없으면 하나도 쓰기 전에 멈춘다', async () => {
  const writes = [];
  const fakeDir = { getDirectoryHandle: async () => fakeDir, getFileHandle: async () => ({ createWritable: async () => ({ write: async (t) => writes.push(t), close: async () => {} }) }) };
  delete globalThis.PuRrnMask;
  await assert.rejects(() => PM.writeFiles(fakeDir, { '메일/a.md': '본문' }), /지우개/);
  assert.equal(writes.length, 0);
  /* 지우개가 있으면 나가는 글자가 그것을 지난다 */
  globalThis.PuRrnMask = { maskRrnInText: (t) => ({ text: String(t).replace(/\d{6}-\d{7}/g, '[주민번호]') }) };
  await PM.writeFiles(fakeDir, { '메일/a.md': '제목 900101-1234567' });
  assert.deepEqual(writes, ['제목 [주민번호]']);
  delete globalThis.PuRrnMask;
});

test('⑤ 화면 연결 — 스크립트가 실려 있고(지우개 포함) 단추는 총괄관리자에게만, 받아 둔 줄은 안 건드린다', () => {
  assert.match(CARDS, /<script src="js\/pu-rrn-mask\.js\?v=\d+"><\/script>/);
  assert.match(CARDS, /<script src="js\/pu-mail-obsidian\.js\?v=\d+"><\/script>/);
  assert.match(CARDS, /state\.isAdmin \? row\('🪨 옵시디언으로 내보내기'/, '단추가 총괄관리자 조건 밖에 있다');
  const a = CARDS.indexOf('function mbObsExport(){');
  assert.ok(a > 0, '내보내기 함수가 없다');
  const body = CARDS.slice(a, CARDS.indexOf('function mailSetHtml(){'));
  assert.ok(/if\(!state\.isAdmin\)/.test(body), '함수 안에서 총괄관리자를 다시 안 본다');
  /* 폴더 고르기는 «누른 순간» 안에서 — 읽기보다 앞이어야 브라우저가 허락한다 */
  assert.ok(body.indexOf('PM.pickVault()') > 0 && body.indexOf('PM.pickVault()') < body.indexOf('mbObsReadAll()'), '폴더 고르기가 메일 읽기보다 뒤에 있다');
  const glue = CARDS.slice(CARDS.indexOf('let _mbObsBusy'), CARDS.indexOf('function mailSetHtml(){'));
  assert.ok(!/_mbMsgs\s*\[[^\]]+\]\s*=[^=]/.test(glue), '내보내기가 화면이 받아 둔 줄(_mbMsgs)을 바꾼다');
  assert.ok(!/\)\.(set|update|remove)\(/.test(glue), '내보내기가 서버에 쓴다 — 읽기만 해야 한다');
});
