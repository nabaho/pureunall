/* 경력관리 «발송 대기» — 판정·채우기·상태 전이·비슷한 서류 정책 (대표 지시 2026-11-05)
   ⚠ 합성 자료만 쓴다 — 실제 기관·사람·금액을 넣지 않는다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../js/kcareer-sendq.js');
const Stamp = require('../js/kcareer-hwpstamp.js');

const RULE = { id: 'r-test', org: '가나다복지협회', senders: ['rule@example.test'], subjectAny: ['지급확인서', '서명 및 회신'],
  attachAll: ['지급확인서', '동의서'], kind: '개인정보 동의서' };

/* 한 줄짜리 문단 */
const P = (t) => '<hp:p id="0"><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray></hp:p>';
function form(o) {
  o = o || {};
  const consent = '□ 동의       □ 동의하지 않음';
  return '<hs:sec>'
    + P(o.title || '지급확인서 및 개인정보 수집 이용 동의서')
    + P('(사)' + (o.org || '가나다복지협회') + '는 아래와 같이 수집합니다')
    + P('* 교육일 : 2030. 1. 2.(수) 10:00~12:00') + P('* 교육기관 : 라마바복지관')
    + P('* 강사비 지급 내역 : ' + (o.gross || '100,000') + '원(1급 기준, 2h)')
    + P(' -원천세(8.8%) : ' + (o.tax || '8,800') + '원, 실지급액 : ' + (o.net || '91,200') + '원')
    + P('[수집/이용항목] ' + (o.items || '성명, 주민등록번호, 주소, 입금계좌'))
    + P(o.extra || '')
    + P(consent) + (o.noSecond ? '' : P(consent)) + (o.third ? P(consent) : '')
    + P(o.sign || '확   인 :          (서명)')
    + P(o.date || ' 2030년    월     일 ')
    + '</hs:sec>';
}

test('메일 맞춤 — 보낸 사람·첨부·제목이 모두 맞아야 «known»', () => {
  const m = Q.matchMail({ from: '담당 <rule@example.test>', subject: '[가나다] 지급확인서 서명 및 회신 요청', atts: ['지급확인서 및 개인정보활용동의서(교육).hwp'] }, [RULE]);
  assert.equal(m.level, 'known'); assert.equal(m.rule.id, 'r-test'); assert.match(m.att, /지급확인서/);
});
test('메일 맞춤 — 주소가 다르면 «similar» 이고 까닭을 말한다(자동으로 채우지 않는다)', () => {
  const m = Q.matchMail({ from: 'x@other.test', subject: '지급확인서 회신', atts: ['지급확인서 동의서.hwpx'] }, [RULE]);
  assert.equal(m.level, 'similar'); assert.ok(m.why.some((w) => /등록된 기관이 아닙니다/.test(w)));
});
test('메일 맞춤 — 관계없는 메일은 none · 한글 파일이 아닌 첨부는 안 본다', () => {
  assert.equal(Q.matchMail({ from: 'rule@example.test', subject: '안내', atts: ['a.pdf'] }, [RULE]).level, 'none');
  assert.equal(Q.matchMail({ from: 'rule@example.test', subject: '지급확인서', atts: ['지급확인서 동의서.pdf'] }, [RULE]).level, 'similar', '제목만 맞음 — 첨부가 없으니 known 이 아니다');
});
test('주소 뽑기 — 이름 <주소> · 대문자', () => {
  assert.equal(Q.addrOf('김 <A@B.test>'), 'a@b.test'); assert.equal(Q.addrOf('c@d.test'), 'c@d.test'); assert.equal(Q.addrOf('없음'), '');
});

test('양식 지문 — 알던 꼴이면 same', () => {
  const c = Q.checkForm(form(), RULE);
  assert.equal(c.verdict, 'same'); assert.deepEqual(c.counts, { consent: 2, sign: 1, date: 1 });
});
test('양식 지문 — 연도가 바뀌어도 same (연도를 박지 않았다)', () => {
  assert.equal(Q.checkForm(form({ date: ' 2041년    월     일 ' }), RULE).verdict, 'same');
});
test('양식 지문 — 동의 칸이 셋이면 changed(채우지 않는다)', () => {
  const c = Q.checkForm(form({ third: true }), RULE);
  assert.equal(c.verdict, 'changed'); assert.ok(c.warn.some((w) => /동의 칸이 3곳/.test(w)));
});
test('양식 지문 — 동의 칸이 하나 빠지면 changed', () => {
  assert.equal(Q.checkForm(form({ noSecond: true }), RULE).verdict, 'changed');
});
test('양식 지문 — 수집 항목이 늘면 changed + 경고(개인정보 범위가 넓어진다)', () => {
  const c = Q.checkForm(form({ items: '성명, 주민등록번호, 주소, 입금계좌, 신분증 사본' }), RULE);
  assert.equal(c.verdict, 'changed'); assert.ok(c.warn.some((w) => /항목이 알던 것과 다릅니다/.test(w))); assert.ok(c.warn.some((w) => /신분증/.test(w)));
});
test('양식 지문 — 기관 이름이 다르면 changed', () => {
  assert.equal(Q.checkForm(form({ org: '마바사복지협회' }), RULE).verdict, 'changed');
});
test('양식 지문 — 전혀 다른 서류는 different', () => {
  assert.equal(Q.checkForm(form({ title: '수당 지급 신청서' }), RULE).verdict, 'different');
});
test('양식 지문 — 이미 채워져 온 서류는 filled(다시 채우지 않는다)', () => {
  assert.equal(Q.checkForm(form({ sign: '확   인 : 홍길동          (서명)' }), RULE).verdict, 'filled');
  const done = form().replace('<hp:t>□ 동의       □ 동의하지 않음</hp:t>', '<hp:t>■ 동의       □ 동의하지 않음</hp:t>');
  assert.equal(Q.checkForm(done, RULE).verdict, 'filled');
});

test('사실 읽기 — 교육일·금액을 뽑고 원천세 셈이 맞으면 경고가 없다', () => {
  const f = Q.facts(form());
  assert.deepEqual(f.pay, { gross: 100000, tax: 8800, net: 91200 });
  assert.match(f.eduDate, /2030\. 1\. 2\./); assert.deepEqual(f.payWarn, []); assert.ok(f.lines.length >= 3);
});
test('금액 검산 — 원천세·실지급액이 어긋나면 경고(막지는 않는다)', () => {
  assert.ok(Q.facts(form({ tax: '9,900' })).payWarn.some((w) => /8\.8%/.test(w)));
  assert.ok(Q.facts(form({ net: '90,000' })).payWarn.some((w) => /실지급액/.test(w)));
  assert.ok(Q.checkPay({ gross: null, tax: null, net: null })[0].match(/읽지 못했습니다/));
});

test('채우기 — 동의 ■ 두 곳 · 성명 · 날짜가 들어가고 나머지는 그대로', () => {
  const x = Q.fillConsent(form(), { name: '가나다', month: 3, day: 4, rule: RULE });
  assert.equal((x.match(/■ 동의/g) || []).length, 2);
  assert.match(x, /확 {3}인 : 가나다 +\(서명\)/);
  assert.match(x, /2030년 {3}3월 {4}4일/);
  assert.match(x, /\[수집\/이용항목\] 성명, 주민등록번호/);
  assert.equal(Q.checkForm(x, RULE).verdict, 'filled', '채운 뒤에는 «이미 채움»으로 읽힌다 — 두 번 채우지 않는다');
});
test('채우기 — 고친 문단의 줄 위치표만 지운다(안 지우면 한글이 못 연다)', () => {
  const x = Q.fillConsent(form(), { name: '가나다', month: 3, day: 4, rule: RULE });
  const sign = /<hp:p [^>]*>(?:(?!<\/hp:p>)[\s\S])*확 {3}인 :[\s\S]*?<\/hp:p>/.exec(x)[0];
  assert.ok(sign.indexOf('linesegarray') < 0);
  const intact = /<hp:p [^>]*>(?:(?!<\/hp:p>)[\s\S])*수집\/이용항목[\s\S]*?<\/hp:p>/.exec(x)[0];
  assert.ok(intact.indexOf('linesegarray') > 0, '손대지 않은 문단은 그대로');
});
test('채우기 — 같은 양식이 아니면 던진다(code=anchor) — 엉뚱한 곳에 찍지 않는다', () => {
  for (const bad of [form({ third: true }), form({ title: '수당 지급 신청서' }), form({ sign: '확   인 : 홍길동          (서명)' })]) {
    assert.throws(() => Q.fillConsent(bad, { name: '가나다', month: 1, day: 1, rule: RULE }), (e) => e.code === 'anchor');
  }
  assert.throws(() => Q.fillConsent(form(), { name: ' ', month: 1, day: 1, rule: RULE }), (e) => e.code === 'anchor');
});
test('도장 — 서명 자리가 정확히 하나일 때만 찍는다', () => {
  const x = Q.fillConsent(form(), { name: '가나다', month: 1, day: 1, rule: RULE });
  const out = Q.stampSeal(x, Stamp, { imgId: 'image9', px: 200 });
  assert.match(out, /binaryItemIDRef="image9"/);
  assert.throws(() => Q.stampSeal(x + P('확   인 :   (서명)'), Stamp, { imgId: 'image9', px: 200 }), (e) => e.code === 'anchor');
  assert.throws(() => Q.stampSeal('<hs:sec>' + P('내용') + '</hs:sec>', Stamp, { imgId: 'image9', px: 200 }), (e) => e.code === 'anchor');
});
test('날짜 — 한국 시각 기준(UTC 15시 이후는 다음 날)', () => {
  /* 검사고정-허용: 한국은 UTC+9 — 시간대 규칙이다 */
  assert.deepEqual(Q.todayKST(Date.UTC(2030, 0, 1, 14, 59)), { year: 2030, month: 1, day: 1 });
  assert.deepEqual(Q.todayKST(Date.UTC(2030, 0, 1, 15, 0)), { year: 2030, month: 1, day: 2 });
});

test('대기열 — 같은 메일·같은 첨부는 같은 id (두 번 넣어도 한 줄)', () => {
  assert.equal(Q.itemId('k1', 'a.hwp'), Q.itemId('k1', 'a.hwp'));
  assert.notEqual(Q.itemId('k1', 'a.hwp'), Q.itemId('k2', 'a.hwp'));
  assert.notEqual(Q.itemId('k1', 'a.hwp'), Q.itemId('k1', 'b.hwp'));
});
test('대기열 — 새 줄은 온톨로지 기본 칸을 갖는다', () => {
  const it = Q.makeItem({ mailKey: 'k1', attName: 'a.hwp', from: '담당 <rule@example.test>', subject: 'RE: x' });
  assert.equal(it.entityType, 'send_queue'); assert.equal(it.schemaVersion, 1); assert.equal(it.status, 'pending');
  assert.equal(it.replyTo, 'rule@example.test'); assert.ok(it.createdAt && it.updatedAt);
});
test('대기열 — 보내기는 «대기»에서만 · 보낸 것은 다시 못 보낸다', () => {
  const it = Q.makeItem({ mailKey: 'k1', attName: 'a.hwp', from: 'rule@example.test', subject: 's' });
  const sent = Q.transition(it, 'send', Date.UTC(2030, 0, 1), { recordId: 'rec1' });
  assert.equal(sent.status, 'sent'); assert.equal(sent.sentTo, 'rule@example.test'); assert.equal(sent.recordId, 'rec1'); assert.equal(it.status, 'pending', '원본을 바꾸지 않는다');
  assert.throws(() => Q.transition(sent, 'send'), (e) => e.code === 'state');
  assert.throws(() => Q.transition(Q.makeItem({ status: 'review' }), 'send'), (e) => e.code === 'state', '확인 필요에서는 곧장 못 보낸다');
  assert.equal(Q.transition(Q.transition(it, 'hold'), 'resume').status, 'pending');
});
test('답장 내용 — 제목 RE: 한 번 · 첨부 · 받는 곳', () => {
  const it = Q.makeItem({ mailKey: 'k', attName: 'a.hwp', from: 'x <rule@example.test>', subject: 'RE: RE: 지급확인서 회신', org: '가나다복지협회', docName: 'a_서명.hwpx', facts: { eduDate: '2030. 1. 2.(수) 10:00~12:00' } });
  const p = Q.replyPayload(it, { name: '가나다', size: 10, path: 'pucards/mailout/u/f1' });
  assert.equal(p.to, 'rule@example.test'); assert.equal(p.subject, 'RE: 지급확인서 회신');
  assert.equal(p.files.length, 1); assert.equal(p.files[0].path, 'pucards/mailout/u/f1'); assert.match(p.body, /2030\. 1\. 2\./);
});

test('★ 비슷한 서류 정책 — 일곱 갈래', () => {
  const known = { level: 'known', why: [] }, similar = { level: 'similar', why: ['보낸 곳이 등록된 기관이 아닙니다'] };
  const same = { verdict: 'same', warn: [] };
  assert.equal(Q.similarPolicy(known, same).action, 'queue');
  assert.equal(Q.similarPolicy(known, { verdict: 'changed', warn: ['동의 칸이 3곳입니다'] }).action, 'review');
  assert.equal(Q.similarPolicy(known, { verdict: 'different', warn: [] }).action, 'review');
  assert.equal(Q.similarPolicy(known, { verdict: 'filled', warn: [] }).action, 'review');
  const s = Q.similarPolicy(similar, same);
  assert.equal(s.action, 'review'); assert.equal(s.learn.type, 'addSender', '다른 기관인데 양식이 같으면 «이 기관도 같은 규칙»을 권한다');
  assert.equal(Q.similarPolicy(known, null).action, 'review', '첨부를 못 읽으면 채우지 않는다');
  assert.equal(Q.similarPolicy({ level: 'none' }, same).action, 'ignore');
  assert.equal(Q.similarPolicy(known, same, { status: 'sent' }).action, 'dup');
  assert.equal(Q.similarPolicy(known, same, { status: 'dismissed' }).action, 'queue', '치운 것은 다시 올릴 수 있다');
});
test('기관 더하기 — 새 사본을 돌려주고 원본·다른 규칙은 그대로', () => {
  const rules = [RULE, { id: 'other', senders: [] }];
  const out = Q.addSender(rules, 'r-test', 'Y <New@Example.test>');
  assert.deepEqual(out[0].senders, ['rule@example.test', 'new@example.test']); assert.deepEqual(RULE.senders, ['rule@example.test']); assert.equal(out[1], rules[1]);
  assert.equal(Q.addSender(rules, 'r-test', 'rule@example.test')[0].senders.length, 1, '같은 주소를 두 번 넣지 않는다');
  assert.equal(Q.addSender(rules, 'r-test', '주소아님'), rules);
});
test('기본 규칙 — 모양만 있고 실제 기관·메일 주소는 없다(저장소는 공개)', () => {
  const r = Q.DEFAULT_RULES[0];
  assert.ok(r.id && r.subjectAny.length && r.attachAll.length && r.kind && Array.isArray(r.senders));
  assert.ok(!/@/.test(JSON.stringify(Q.DEFAULT_RULES)), '코드에 메일 주소를 박지 않는다 — 보낸 곳은 사람이 «이 기관도»로 더한다');
  assert.equal(r.senders.length, 0);
});

/* ── 보낸 곳 빼기 (2026-11-08 「규칙 빼기 단추」) — 더하는 길만 있으면 잘못 더한 것이 영영 남는다 ── */
test('보낸 곳 빼기 — 고른 규칙의 고른 주소만 빠지고, 새 사본을 돌려준다', () => {
  const two = Object.assign({}, RULE, { senders: ['rule@example.test', 'wrong@example.test'] });
  const other = { id: 'other', senders: ['wrong@example.test'] };
  const rules = [two, other];
  const out = Q.removeSenders(rules, [{ ruleId: 'r-test', email: 'wrong@example.test' }]);
  assert.deepEqual(out[0].senders, ['rule@example.test']);
  assert.deepEqual(two.senders, ['rule@example.test', 'wrong@example.test'], '원본 규칙은 그대로');
  assert.equal(out[1], other, '다른 규칙의 같은 주소는 건드리지 않는다');
  assert.equal(out[0].id, 'r-test'); assert.deepEqual(out[0].attachAll, RULE.attachAll, '규칙의 나머지 칸은 그대로');
});
test('보낸 곳 빼기 — 대소문자·«이름 <주소>» 꼴도 같은 주소로 본다 · 여럿을 한 번에', () => {
  const r = Object.assign({}, RULE, { senders: ['a@example.test', 'b@example.test', 'c@example.test'] });
  const out = Q.removeSenders([r], [{ ruleId: 'r-test', email: '가 <A@Example.TEST>' }, { ruleId: 'r-test', email: 'c@example.test' }]);
  assert.deepEqual(out[0].senders, ['b@example.test']);
});
test('보낸 곳 빼기 — 뺄 것이 없으면 같은 배열을 돌려준다(저장을 건너뛸 수 있게)', () => {
  const rules = [RULE];
  assert.equal(Q.removeSenders(rules, []), rules);
  assert.equal(Q.removeSenders(rules, [{ ruleId: 'r-test', email: 'none@example.test' }]), rules);
  assert.equal(Q.removeSenders(rules, [{ ruleId: 'other', email: 'rule@example.test' }]), rules, '규칙이 다르면 빼지 않는다');
  assert.equal(Q.removeSenders(rules, [{ ruleId: 'r-test', email: '주소아님' }]), rules);
  assert.equal(Q.removeSenders(rules, null), rules);
});
test('보낸 곳을 다 빼도 규칙(양식 지문)은 남는다 — 같은 곳이 다시 보내면 «확인 필요 + 이 기관도»', () => {
  const out = Q.removeSenders([RULE], [{ ruleId: 'r-test', email: 'rule@example.test' }]);
  assert.equal(out.length, 1); assert.deepEqual(out[0].senders, []);
  const mail = { from: 'rule@example.test', subject: '지급확인서 서명 및 회신', atts: ['지급확인서 및 동의서.hwpx'] };
  assert.equal(Q.matchMail(mail, [RULE]).level, 'known', '빼기 전에는 알던 곳');
  const m = Q.matchMail(mail, out);
  assert.equal(m.level, 'similar', '뺀 뒤에는 알던 곳이 아니다');
  assert.equal(Q.similarPolicy(m, { verdict: 'same', warn: [] }).learn.type, 'addSender', '다시 더하는 길이 열려 있다');
  assert.deepEqual(Q.addSender(out, 'r-test', 'rule@example.test')[0].senders, ['rule@example.test'], '더하기 ↔ 빼기가 맞물린다');
});
test('규칙 화면 줄 — 규칙 이름·주소와 «대기·보류» 중인 건수만 센다', () => {
  const r = Object.assign({}, RULE, { label: '점검 서류', senders: ['rule@example.test', 'b@example.test'] });
  const it = (status, from, ruleId) => ({ status, from, replyTo: Q.addrOf(from), ruleId: ruleId || 'r-test' });
  const items = [it('pending', '가 <Rule@example.test>'), it('hold', 'rule@example.test'), it('sent', 'rule@example.test'),
    it('review', 'rule@example.test'), it('dismissed', 'rule@example.test'), it('pending', 'rule@example.test', 'other')];
  const rows = Q.senderRows([r], items);
  assert.deepEqual(rows.map((x) => x.email), ['rule@example.test', 'b@example.test']);
  assert.equal(rows[0].label, '점검 서류'); assert.equal(rows[0].ruleId, 'r-test');
  assert.equal(rows[0].waiting, 2, '대기·보류만 센다 — 보낸 것·확인 필요·치운 것·다른 규칙은 빼고');
  assert.equal(rows[1].waiting, 0);
  assert.deepEqual(Q.senderRows(Q.DEFAULT_RULES, items), [], '기본 규칙에는 보낸 곳이 없다');
});
