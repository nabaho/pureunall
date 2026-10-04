'use strict';
/* 기업별 계약서 「✉ 파일 골라 보내기」 (대표 2026-10-04 — 2026-09-23 미뤄 둔 「계약서/견적서 찾아 메일로 보내기」) — 가짜 자료만
   ⓐ 받는 사람 후보: 그 회사 명함(메일 있는 사람) + 대표 메일, 사업자번호 먼저·없으면 이름, 겹침·잘못된 주소 빼기
   ⓑ 보낸 기록 종류·제목·본문 기본값
   ⓒ 문서관리 길: 파일 바이트(🔒 은 서버 길), 메일은 계약서 양식 보내기와 같은 길(mode·send·record)
   ⓓ 화면: 「✉ 보내기」 누르기 전엔 안 나감, 🔒 는 한 번 더 묻기, 18MB, 받는 주소는 기록에 안 넣음 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-office-docs.js'), box);
  return box.PuOfficeDocs;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('ⓐ 받는 사람 후보 — 명함 메일 + 대표 메일, 사업자번호 먼저', () => {
  const D = load();
  const rows = [
    { k: 'erp', c: '가나무역', bz: '123-45-67890', e: 'office@example.com' },
    { k: 'erp', c: '가나상사', bz: '123-45-67899', e: 'wrong@example.com' },
    { k: 'card', c: '(주)가나상사', n: '박담당', ti: '과장', e: 'park@example.com' },
    { k: 'card', c: '가나상사 주식회사', n: '김철수', e: 'PARK@example.com' },
    { k: 'card', c: '가나상사', n: '이영희', e: '메일 아님' },
    { k: 'card', c: '다라산업', n: '남', e: 'other@example.com' }];
  const t = plain(D.mailTargets(rows, '가나상사', '1234567890'));
  assert.strictEqual(t.co.e, 'office@example.com', '사업자번호가 같은 줄을 먼저');
  assert.deepStrictEqual(t.to, [
    { v: 'park@example.com', label: '박담당 과장 · park@example.com', who: '박담당' },
    { v: 'office@example.com', label: '대표 메일 · office@example.com', who: '' }]);
  const byName = plain(D.mailTargets(rows, '가나상사', ''));
  assert.strictEqual(byName.co.e, 'wrong@example.com', '번호가 없으면 이름으로');
  assert.deepStrictEqual(plain(D.mailTargets([], '없는회사', '')), { co: null, to: [] });
});
test('ⓑ 기본값 — 종류·제목·본문', () => {
  const D = load();
  assert.strictEqual(D.sentKindOf(['공동근로복지기금 제안서']), '제안서');
  assert.strictEqual(D.sentKindOf(['자문계약서', 'CMS 신청서']), '계약서');
  assert.strictEqual(D.sentKindOf(['사업자등록증 사본']), '그 밖');
  const one = D.resendMail('가나상사', '박담당', ['자문계약서']);
  assert.strictEqual(one.subject, '[푸른노무법인] 자문계약서 — 가나상사');
  assert.match(one.body, /^박담당님, 안녕하십니까\./);
  assert.match(one.body, /- 자문계약서/);
  const many = D.resendMail('가나상사', '', ['자문계약서', 'CMS 신청서', '위임장']);
  assert.strictEqual(many.subject, '[푸른노무법인] 자문계약서 외 2건 — 가나상사');
  assert.match(many.body, /^담당자님,/);
  assert.strictEqual(D.resendMail('가나상사', '', []).subject, '[푸른노무법인] 서류 — 가나상사', '고른 것이 없을 때 「외 -1건」이 나오면 안 된다');
});
test('ⓒ 문서관리 길 — 🔒 는 서버 길, 메일은 같은 길', () => {
  const html = read('docs-esign.html');
  const a = html.indexOf('async function formFileBytes('), f = html.slice(a, html.indexOf('\n}\n', a));
  assert.match(f, /PuOfficeStore\.isSecret\(rec\)/);
  assert.match(f, /PuOfficeStore\.secretBlob\(fileId\)/);
  assert.match(f, /PuOfficeStore\.fileUrl\(rec\)/);
  assert.match(html, /fileBytes: formFileBytes, mail: \{ mode: formMailMode, send: formMailSend, record: formMailRecord \}/);
});
test('ⓓ 화면 — 누르기 전엔 안 나감, 🔒 한 번 더, 18MB, 받는 주소는 기록에 없음', () => {
  const docs = read('js/pu-office-docs.js');
  const a = docs.indexOf('function openResend('), f = docs.slice(a, docs.indexOf('/* ── 🔗 이알피 업체와 맞추기', a));
  const iClick = f.indexOf("text: '보낼 파일을 고르세요', disabled: true, onclick:"), iSend = f.indexOf('host.mail.send(');
  assert.ok(iClick > 0 && iSend > iClick, '메일은 보내기 단추 안에서만');
  assert.strictEqual((f.match(/host\.mail\.send\(/g) || []).length, 1);
  assert.match(f, /if \(sec\.length && !w\.confirm\(/);
  assert.match(f, /MAX = 18 \* 1024 \* 1024/);
  const rec = f.slice(f.indexOf('host.mail.record('), f.indexOf('host.mail.record(') + 260);
  assert.doesNotMatch(rec, /\bto\b/, '보낸 기록에 받는 주소를 넣지 않는다');
  assert.match(docs, /host\.mail && S\.docs\.length \? el\('button'[^\n]*onclick: openResend/);
});
