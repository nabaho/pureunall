/* 뉴스레터 — 업체 담당자 칸의 «외부 대리인»은 안 보낸다 (대표 지적 2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   메일함에서 «그 회사 일로 메일을 보낸 분»(세무사무실·컨설팅 운영기관)을 업체에 이으면
   업체 담당자 칸에 들어가, 뉴스레터가 그분들을 거래처 사람으로 알고 보내려 했다.
   함께 «짐작이 짐작을 낳던» 길(메일에서 이은 주소가 도메인 근거가 되던 것)도 막는다.
   ⚠ 예시는 가짜다(가나상사·홍길동). */

const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/pu-news-core.js');
const F = require('../js/pu-mail-fill-core.js');

const 곳 = (더) => Object.assign({ id: 'co-1', name: '가나상사', status: 'active', typeCode: '자문',
  primaryContactName: '홍길동', primaryContactEmail: 'hong@gana.example' }, 더 || {});
const 주소들 = (r) => r.줄들.map((x) => x.email);

test('★★ 세무대리인 메일(taxEmail)과 같은 담당자는 안 보내고, 까닭과 함께 따로 돌려준다', () => {
  const r = C.사업장에서명단([곳({ taxEmail: 'tax@dara.example',
    contacts: [{ name: '김세무', email: 'tax@dara.example', addedFrom: 'mail-new' }] })], '자문중');
  assert.ok(주소들(r).indexOf('tax@dara.example') < 0, '세무대리인에게 뉴스레터가 갑니다');
  assert.ok(주소들(r).indexOf('hong@gana.example') >= 0, '그 회사 사람까지 빠졌습니다');
  assert.ok(r.외부대리인.some((x) => x.email === 'tax@dara.example' && x.까닭), '뺀 분이 화면에 안 보입니다');
});

test('★★ 컨설팅 회사 도메인 — 주담당 칸에 올라가 있어도 뺀다, 그 회사 사람이 없으면 «주소 없는 곳»으로', () => {
  const r = C.사업장에서명단([곳({ primaryContactName: '이운영', primaryContactEmail: 'lee@gana-consulting.example',
    contacts: [{ name: '이운영', email: 'lee@gana-consulting.example', addedFrom: 'mail-new', isPrimary: true }] })],
  '자문중', { 대표자도: true });
  assert.strictEqual(r.줄들.length, 0, '운영기관 직원에게 뉴스레터가 갑니다');
  assert.ok(r.주소없는곳.some((x) => x.id === 'co-1'), '그 회사 사람 주소가 없는데 «주소 없는 곳»에 안 뜹니다');
  assert.ok(r.외부대리인.length >= 1);
});

test('★ 이름에 법인·사무소 이름이 있으면 뺀다 — 사람 직함(공인노무사)은 안 본다', () => {
  const r = C.사업장에서명단([곳({ contacts: [
    { name: '가나세무회계', email: 'office@mail.example' },
    { name: '박직원', position: '그룹장 (공인노무사)', email: 'park@gana.example' }] })], '자문중');
  assert.ok(주소들(r).indexOf('office@mail.example') < 0, '세무회계 사무소가 들어갑니다');
  assert.ok(주소들(r).indexOf('park@gana.example') >= 0, '회사 안의 공인노무사 직원까지 뺍니다');
});

test('★ 자문사 «자기»가 컨설팅 회사면 그 회사 사람은 그대로 보낸다', () => {
  const r = C.사업장에서명단([곳({ name: '가나컨설팅(주)', primaryContactEmail: 'hong@gana-consulting.example' })], '자문중');
  assert.ok(주소들(r).indexOf('hong@gana-consulting.example') >= 0, '컨설팅 회사인 자문사 사람을 뺍니다');
  assert.strictEqual(r.외부대리인.length, 0);
});

test('★★ 메일에서 이은 담당자는 도메인 근거가 아니다 — 잘못 이은 한 사람이 동료를 끌고 오지 않는다', () => {
  const 잘못 = { id: 'co-1', name: '가나상사', status: 'active',
    contacts: [{ email: 'lee@dara-ops.example', addedFrom: 'mail-new' }] };
  assert.strictEqual(F.domCo('kim@dara-ops.example', F.domTable([잘못]), () => false), null,
    '메일에서 이은 주소 하나로 같은 도메인 사람이 저절로 그 업체에 붙습니다');
  /* 주담당 칸에 거울로 올라간 주소도 마찬가지다 */
  const 거울 = Object.assign({}, 잘못, { primaryContactEmail: 'lee@dara-ops.example' });
  assert.strictEqual(F.domCo('kim@dara-ops.example', F.domTable([거울]), () => false), null);
  /* 사람이 업체관리에 적은 주소는 그대로 근거다 */
  const 사람 = { id: 'co-2', name: '나라상사', status: 'active', contacts: [{ email: 'a@nara.example' }] };
  assert.strictEqual(F.domCo('b@nara.example', F.domTable([사람]), () => false).id, 'co-2');
});

test('★★ 화면 짐작(mbNewCoOf·mbNewCoHint)도 같은 잣대 — 메일에서 이은 주소를 근거로 안 쓴다', () => {
  const fs = require('fs');
  const app = fs.readFileSync(require('path').join(__dirname, '..', 'pu-cards.html'), 'utf8');
  for (const name of ['function mbNewCoOf(', 'function mbNewCoHint(']) {
    const i = app.indexOf(name);
    assert.ok(i > 0, name + ' 이 없습니다');
    const body = app.slice(i, i + 2500);
    assert.match(body, /addedFrom[\s\S]{0,40}\^mail|\^mail[\s\S]{0,40}addedFrom/, name + ' 가 메일에서 이은 주소도 근거로 씁니다');
  }
});

test('★ 받는 곳 화면이 «뺀 분»을 보여 준다 — 그냥 빠지면 왜 빠졌는지 모른다', () => {
  const fs = require('fs');
  const news = fs.readFileSync(require('path').join(__dirname, '..', 'pu-news.html'), 'utf8');
  assert.match(news, /d\.외부대리인\s*=\s*g\.외부대리인/, '명단셈이 뺀 분을 화면으로 안 넘깁니다');
  assert.match(news, /r\.외부대리인\.map\(/, '받는 곳 화면에 뺀 분 표가 없습니다');
});
