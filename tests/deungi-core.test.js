/* 푸른등기 계산(js/pu-deungi-core.js) — 지어낸 법인으로 «규칙»을 본다 (2026-11-14)
   ⚠ 사람·주소·번호는 모두 지어낸 것이다(공개 저장소). 주민번호 뒷자리는 «뻔한 가짜»(1234567·2234567)만 쓴다.
   무엇을 못 박나: 지분 양도 금액이 사라지거나 생기지 않는다 · 대표사원이 없어지면 막는다 · 정관이 안 바뀌면 인가 서류를 빼고
   · 기한은 인가증 받은 날부터 2주일 · 3개월 지난 증명서를 알린다 · 주민번호 뒷자리는 «받은 것»만 서류에 들어간다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-deungi-core.js');

function 법인() {
  return {
    firm: { name: '가나 노무법인', regNo: '000000', hq: '점검도 점검시 점검로 1, 3층', hqCharter: '점검도 점검시', court: '점검지방법원 등기과', authority: '점검지방고용노동청장' },
    members: [
      { id: 'm1', name: '점검대표', birth: '700101', addr: '점검시 가로 1', invest: { cash: 15000000 }, rep: true },
      { id: 'm2', name: '점검노무', birth: '800101', addr: '점검시 나로 2', invest: { cash: 15000000 }, rep: true },
      { id: 'm3', name: '점검사원', birth: '900101', addr: '점검시 다로 3', invest: { labor: true } },
    ],
    branches: [
      { id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검시 가지로 1', no: 1 },
      { id: 'b3', name: '나무분사무소', alias: '나무지사', addr: '점검시 나무로 3', no: 3 },
    ],
  };
}
function 건(changes, extra) {
  return Object.assign({ id: 'DG-T1', title: '시험 등기', meeting: { date: '2026-11-20', time: '10:00' }, changes }, extra || {});
}
const 현금합 = (ms) => ms.reduce((s, m) => s + C.normInvest(m.invest).cash, 0);

test('★ 퇴사 사원 지분을 양도하면 출자 현금 합계가 그대로다 — 사라지거나 생기지 않는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { cash: 0 } },
    { id: 'l', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'new:j', amount: 10000000 }, { member: 'm1', amount: 5000000 }] } },
  ]));
  assert.deepEqual(a.errors, []);
  assert.equal(현금합(a.members), 현금합(법인().members), '양도 전후 현금 출자 합계가 달라졌다');
  assert.ok(a.left.some((m) => m.id === 'm2'), '퇴사 사원이 퇴사 목록에 없다');
  assert.ok(!a.members.some((m) => m.id === 'm2'), '퇴사 사원이 남아 있다');
  assert.ok(a.events.some((e) => e.type === 'repOut' && e.byLeave), '대표사원이 퇴사하면 대표사원 퇴임이 저절로 들어가야 한다');
  assert.ok(a.events.some((e) => e.type === 'share' && e.member === 'm1'), '지분을 양수한 기존 사원의 출자 변경이 등기할 사항에 없다');
});

test('양도 금액 합계가 출자금과 다르면 서류를 만들지 않는다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'l', type: 'leave', member: 'm1', share: { mode: 'transfer', to: [{ member: 'm2', amount: 1000 }] } }]));
  assert.ok(a.errors.length >= 1);
});

test('★ 변경 뒤 대표사원이 한 명도 없으면 막는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'o1', type: 'repOut', member: 'm1' }, { id: 'o2', type: 'repOut', member: 'm2' },
  ]));
  assert.ok(a.errors.some((e) => /대표사원/.test(e)));
});

test('사원이 2명 아래로 줄거나 사무소보다 적으면 경고한다(공인노무사법 사원 요건)', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'l1', type: 'leave', member: 'm3' },
    { id: 'l2', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'm1', amount: 15000000 }] } },
  ]));
  assert.ok(a.warnings.some((w) => /제7조의3/.test(w)), '사원 2명 요건 경고가 없다');
  assert.ok(a.warnings.some((w) => /제7조의7/.test(w)), '사무소마다 사원 상근 경고가 없다');
});

/* 2026-11-14 고침: 이 법인 정관은 제5·6조에 «대표사원 : 이름», 제13조에 대표사원 이름을 적는다(2026. 7. 22. 개정 정관 대조).
   그래서 대표사원만 바뀌어도 정관이 바뀌고 인가가 필요하다 — 예전 검사(«정관은 그대로»)는 실제 정관과 어긋났다. */
test('★ 대표사원이 바뀌면 정관 제5·6조(«대표사원 :» 표시)·제13조(대표사원 이름)가 바뀐다 — 인가 서류를 만들고, 기한은 인가증 받은 날부터', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'r', type: 'repIn', member: 'm3' }]));
  assert.equal(a.charterChanged, true);
  assert.deepEqual(a.arts, [5, 6, 13]);
  const plan = C.docPlan(a, { today: '2026-11-21' });
  ['compare', 'reason', 'apply', 'charter', 'accept'].forEach((k) => assert.equal(plan.find((d) => d.key === k).need, true, k + ' 가 빠졌다'));
  const art = C.articles(a);
  assert.match(art[5].old.join('\n'), /3\. 사원 : 점검사원/);
  assert.match(art[5].neu.join('\n'), /3\. 대표사원 : 점검사원/);
  assert.match(art[5].neu.join('\n'), /1\. 대표사원 : 점검대표/);
  assert.equal(art[13].neu[1], '본 회사의 대표사원은 제5조에서 정한 바와 같이 점검대표, 점검노무, 점검사원으로 한다.');
  assert.deepEqual(C.compareRows(a).map((r) => r.no), [5, 6, 13]);
  assert.equal(C.deadline(a, '2026-11-21').due, '', '인가증 날짜가 없으면 기한을 지어내지 않는다');
  const s = C.applyChanges(법인(), 건([{ id: 'o', type: 'repOut', member: 'm2' }]));
  assert.deepEqual(s.arts, [5, 6, 13], '대표사원 사임도 제5·6·13조를 바꾼다');
  assert.match(C.articles(s)[13].neu[1], /점검대표로 한다\.$/);
});

test('정관 제5·6조 차례 — 같은 건의 입사 사원은 퇴사 사원 자리에, 남는 입사자는 끝에', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'j1', type: 'join', name: '새하나', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } },
    { id: 'j2', type: 'join', name: '새둘', birth: '960101', addr: '점검시 마로 5', invest: { labor: true } },
    { id: 'l', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'm1', amount: 15000000 }] } },
  ]));
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.members.map((m) => m.name), ['점검대표', '새하나', '점검사원', '새둘']);
  assert.match(C.articles(a)[5].neu.join('\n'), /2\. 사원 : 새하나/);
});

test('«로/으로» — 받침 없거나 ㄹ 받침이면 «로»', () => {
  assert.equal(C.particleRo('가나다'), '가나다로');
  assert.equal(C.particleRo('점검별'), '점검별로');
  assert.equal(C.particleRo('점검범'), '점검범으로');
});

test('★ 현물출자 — 정관 제6조는 «현물 ○원»과 «② 현물재산의 종류», 등기할 사항은 «금 ○원 전부이행»', () => {
  const 법 = 법인();
  법.members.push({ id: 'm4', name: '점검현물', birth: '850101', addr: '점검시 마로 5', invest: { cash: 10000000, inKind: '차종 : 점검차 / 연식 : 2000 / 차대번호 : TEST0000' } });
  const nb = C.normBase(법);
  assert.equal(nb.members[3].invest.inKind, '차종 : 점검차 / 연식 : 2000 / 차대번호 : TEST0000', '저장할 때 현물 재산이 사라졌다');
  const a = C.applyChanges(법, 건([{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }]));
  const six = C.articles(a)[6].neu;
  assert.equal(six[1], '① 제2조에 제기한 목적사업을 위한 각 사원의 출자액과 이행할 내역은 다음과 같다.');
  assert.ok(six.indexOf('4. 사원 : 점검현물(850101-_______) 현물 10,000,000원') > 0, six.join('\n'));
  assert.ok(six.indexOf('② 제1항 제4호의 현물재산의 종류는 다음과 같다.') > 0);
  assert.deepEqual(six.slice(-3), ['   차종 : 점검차', '   연식 : 2000', '   차대번호 : TEST0000']);
  const j = C.applyChanges(법인(), 건([{ id: 'j', type: 'join', name: '새현물', birth: '950101', addr: '점검시 라로 4', invest: { cash: 5000000, inKind: '차종 : 점검차' } }]));
  assert.ok(C.regItems(j)[0].lines.indexOf('금 5,000,000원 전부이행') >= 0, '등기할 사항은 현물도 «금 ○원 전부이행»');
  assert.equal(C.nextBase(j, { today: '2026-12-31' }).members.find((m) => m.name === '새현물').invest.inKind, '차종 : 점검차');
  /* 현금 사원만 있으면 ① 를 붙이지 않는다 */
  assert.match(C.articles(C.applyChanges(법인(), 건([{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }])))[6].neu[1], /^제2조에 제기한/);
});

test('★ 변경 연월일 — 그 줄 날짜 → 건의 변경 연월일 → 정관변경 인가일 → 총회일, 총회일로 채우면 경고한다', () => {
  const ch = [{ id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } }];
  const m = C.applyChanges(법인(), 건(ch));
  assert.equal(m.events[0].date, '2026-11-20');
  assert.equal(m.events[0].dateSrc, 'meeting');
  assert.ok(m.warnings.some((w) => /인가일/.test(w)), '총회일로 채웠다는 경고가 없다');
  const ap = C.applyChanges(법인(), 건(ch, { dates: { approval: '2026-12-05' } }));
  assert.equal(ap.events[0].date, '2026-12-05');
  assert.equal(ap.events[0].dateSrc, 'approval');
  assert.ok(!ap.warnings.some((w) => /총회일로 적었습니다/.test(w)));
  const ef = C.applyChanges(법인(), 건(ch, { effDate: '2026-12-10', dates: { approval: '2026-12-05' } }));
  assert.equal(ef.events[0].date, '2026-12-10');
  const own = C.applyChanges(법인(), 건([Object.assign({ date: '2026-11-30' }, ch[0])], { dates: { approval: '2026-12-05' } }));
  assert.equal(own.events[0].date, '2026-11-30');
  assert.equal(C.normCase({ dates: { approval: '2026-12-05', 모르는: '2026-01-01' } }).dates.approval, '2026-12-05');
});

test('정관 본문의 제13조는 대표사원이 바뀐 건에서만 갈아 끼운다', () => {
  const 정관 = ['정 관', '(2001. 01. 01. 제정)', '제3조【사무소의 소재지】', '옛', '제5조【사원의 성명과 주소】', '옛', '제6조【출자의 목적, 가격 및 이행】', '옛',
    '제13조【회사의 대표】', '본 회사의 대표사원은 제5조에서 정한 바와 같이 점검대표, 점검노무로 한다.', '제14조【선임과 임기】', '삭제'].join('\n');
  const r = C.applyChanges(법인(), 건([{ id: 'r', type: 'repIn', member: 'm3' }]));
  const t = C.charterFull(정관, r, null, '2026-11-20');
  assert.deepEqual(t.replaced.sort((p, q) => p - q), [3, 5, 6, 13]);
  assert.match(t.text, /제13조【회사의 대표】\n본 회사의 대표사원은 제5조에서 정한 바와 같이 점검대표, 점검노무, 점검사원으로 한다\.\n제14조/);
  const b = C.applyChanges(법인(), 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }]));
  const u = C.charterFull(정관, b, null, '2026-11-20');
  assert.ok(u.replaced.indexOf(13) < 0);
  assert.match(u.text, /점검대표, 점검노무로 한다\./, '대표사원이 안 바뀌었는데 제13조를 건드렸다');
});

test('등기 완료 반영 — 정관 개정 연혁은 총회일로 적는다(인가증 받은 날이 아니다)', () => {
  const 법 = 법인();
  법.charter = ['정 관', '(2001. 01. 01. 제정)', '제3조【사무소의 소재지】', '옛', '제5조【사원의 성명과 주소】', '옛', '제6조【출자의 목적, 가격 및 이행】', '옛'].join('\n');
  const a = C.applyChanges(법, 건([{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }], { dates: { approvalGet: '2026-12-01' } }));
  const nb = C.nextBase(a, { today: '2026-12-10' });
  assert.match(nb.charter, /\(2026\. 11\. 20\. 개정\)/);
  assert.doesNotMatch(nb.charter, /2026\. 12\. 01\. 개정/);
});

test('필요서류 확인표 — 법무사 안내(2026. 6.)대로: 사원 전원 인감증명서 1통, 취임 사원 주민등록표 초본', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } }]));
  const list = C.checklist(a);
  const by = (k) => list.find((x) => x.key === k);
  assert.equal(by('memberCerts').label, '사원 전원 인감증명서 각 1통');
  const res = list.find((x) => /^newResident:/.test(x.key));
  assert.equal(res.src, '법무사');
  assert.match(res.label, /주민등록표 초본 1통/);
  assert.equal(list.find((x) => /^newCert:/.test(x.key)).src, '법무사');
  assert.match(by('corpCert').detail, /법인인감카드/);
});

test('★ 정관이 바뀌면 기한은 «인가증 받은 날 + 2주일» — 지나면 지연 사유서가 서류에 들어간다', () => {
  const ch = [{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }];
  const a1 = C.applyChanges(법인(), 건(ch));
  assert.equal(a1.charterChanged, true);
  assert.equal(C.deadline(a1, '2026-11-21').due, '', '인가증 날짜가 없으면 기한을 지어내지 않는다');
  const a2 = C.applyChanges(법인(), 건(ch, { dates: { approvalGet: '2026-12-01' } }));
  const d2 = C.deadline(a2, '2026-12-20');
  assert.equal(d2.due, C.addDays('2026-12-01', C.DEADLINE_DAYS));
  assert.equal(d2.overdue, true);
  assert.equal(C.docPlan(a2, { today: '2026-12-20' }).find((d) => d.key === 'delay').need, true);
  assert.equal(C.docPlan(a2, { today: '2026-12-02' }).find((d) => d.key === 'delay').need, false);
});

test('신·구조문 대비표는 실제로 글이 바뀐 조문만 싣고, 새 분사무소는 비어 있는 호(«삭제»)부터 채운다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }]));
  const rows = C.compareRows(a);
  assert.deepEqual(rows.map((r) => r.no), [3]);
  assert.match(rows[0].old.join('\n'), /2\. - 삭 제 -/);
  assert.match(rows[0].neu.join('\n'), /2\. 다리지사는 점검시 다리로 7에 둔다\./);
  assert.doesNotMatch(rows[0].neu.join('\n'), /삭 제/);
  /* 빈 호가 없으면 끝에 붙인다 */
  const 꽉 = 법인(); 꽉.branches[1].no = 2;
  const rows2 = C.compareRows(C.applyChanges(꽉, 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }])));
  assert.match(rows2[0].neu.join('\n'), /3\. 다리지사는/);
  assert.ok(rows2[0].neu.length > rows2[0].old.length, '새 분사무소 줄이 늘지 않았다');
});

test('★ 분사무소를 폐지해도 정관 제3조의 번호는 «삭제»로 남는다(번호를 당기지 않는다)', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'x', type: 'brClose', branch: 'b1' }]));
  const neu = C.articles(a)[3].neu.join('\n');
  assert.match(neu, /1\. - 삭 제 -/);
  assert.match(neu, /3\. 나무지사/);
});

test('★ 주민번호 뒷자리는 «받은 것»만 들어간다 — 안 받으면 빈칸, 등기부 미리보기는 가린다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'r', type: 'repIn', member: 'm3' }]));
  const masked = JSON.stringify(C.regItems(a));
  assert.doesNotMatch(masked, /\d{6}-\d{7}/, '번호를 받지 않았는데 뒷자리가 나왔다');
  const full = JSON.stringify(C.regItems(a, { m3: '1234567' }));
  assert.match(full, /900101-1234567/);
  assert.match(C.articles(a)[5].neu.join('\n'), /700101-_______/, '받지 않은 뒷자리는 손으로 적을 빈칸이어야 한다');
});

test('★ 등기 건·현황을 정리하면 주민번호 뒷자리·모르는 칸이 남지 않는다', () => {
  const b = C.normBase({ members: [{ id: 'm1', name: '점검', birth: '700101-1234567', addr: 'x', rrnBack: '1234567' }] });
  assert.equal(b.members[0].birth, '700101');
  assert.ok(!('rrnBack' in b.members[0]));
  const c = C.normCase({ id: 'DG-1', rrn: { m1: '1234567' }, changes: [{ id: 'j', type: 'join', name: '새', birth: '9501011234567', rrnBack: '1234567' }] });
  assert.ok(!('rrn' in c));
  assert.equal(c.changes[0].birth, '950101');
  assert.doesNotMatch(JSON.stringify(c), /1234567/);
});

test('정관 본문이 있으면 제3·5·6조만 갈아 끼우고 개정 연혁을 한 줄 더한다', () => {
  const 정관 = ['정 관', '(2001. 01. 01. 제정)', '제1조【명 칭】', '가나', '제3조【사무소의 소재지】', '옛 사무소', '', '제4조【공고방법】', '공고',
    '제 2 장 사원과 출자', '제5조【사원의 성명과 주소】', '옛 사원', '제6조【출자의 목적, 가격 및 이행】', '옛 출자', '제7조【준용법규】', '준용'].join('\n');
  const a = C.applyChanges(법인(), 건([{ id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' }]));
  const r = C.charterFull(정관, a, null, '2026-12-01');
  assert.deepEqual(r.replaced.sort(), [3, 5, 6]);
  assert.doesNotMatch(r.text, /옛 사무소|옛 사원|옛 출자/);
  assert.match(r.text, /제4조【공고방법】\n공고/, '바꾸지 않을 조문이 다쳤다');
  assert.match(r.text, /\(2026\. 12\. 01\. 개정\)/);
  assert.deepEqual(C.charterFull('제1조 명칭', a, null, '').missing, [3, 5, 6]);
});

test('★ 필요서류 — 법무사 안내 줄이 있고, 발급 3개월이 지나면 알린다', () => {
  const c = 건([{ id: 'l', type: 'leave', member: 'm3' }], { dates: { file: '2026-12-10' }, checks: { corpCert: { ok: true, issued: '2026-08-01' } } });
  const a = C.applyChanges(법인(), c);
  const items = C.checklist(a);
  assert.ok(items.filter((x) => x.src === '법무사').length >= 5, '법무사 안내 줄이 모자란다');
  const corp = items.find((x) => x.key === 'corpCert');
  assert.equal(C.staleCheck(corp, a.c.checks.corpCert, a, '2026-12-10').stale, true);
  assert.equal(C.staleCheck(corp, { issued: '2026-11-01' }, a, '2026-12-10').stale, false);
  assert.ok(items.some((x) => x.key === 'leaveCert:m3'), '퇴사 사원 인감증명서 줄이 없다');
  const p = C.checkProgress(a, '2026-12-10');
  assert.equal(p.done, 1); assert.equal(p.stale, 1);
});

test('등기 완료 반영 — 새 사원·분사무소는 영구 id 를 받고, 퇴사·폐지는 빠지고, 기록이 한 줄 는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } },
    { id: 'l', type: 'leave', member: 'm3' }, { id: 'x', type: 'brClose', branch: 'b1' },
  ], { dates: { done: '2026-12-15' } }));
  const nb = C.nextBase(a);
  assert.ok(nb.members.every((m) => !/^new:/.test(m.id)), '새 사원 id 에 new: 가 남았다');
  assert.equal(new Set(nb.members.map((m) => m.id)).size, nb.members.length, '사원 id 가 겹친다');
  assert.ok(!nb.members.some((m) => m.name === '점검사원'));
  assert.ok(!nb.branches.some((x) => x.id === 'b1'));
  assert.equal(nb.history.length, 1);
  assert.equal(nb.asOf, '2026-12-15');
});

test('★ 같은 건에서 함께 퇴사하는 사원·같은 양수인 두 줄은 양수인으로 받지 않는다 — 출자금이 사라지거나 부풀지 않게', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'l1', type: 'leave', member: 'm1', share: { mode: 'transfer', to: [{ member: 'm2', amount: 15000000 }] } },
    { id: 'l2', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'm1', amount: 15000000 }] } },
  ]));
  assert.ok(a.errors.some((e) => /함께 퇴사/.test(e)), '함께 퇴사하는 양수인을 막지 않았다');
  const b = C.applyChanges(법인(), 건([
    { id: 'l', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'm1', amount: 5000000 }, { member: 'm1', amount: 10000000 }] } },
  ]));
  assert.ok(b.errors.some((e) => /두 줄/.test(e)), '같은 양수인 두 줄을 막지 않았다');
});

test('★ 저장되는 모든 글 칸에서 주민번호 뒷자리를 지운다 — 하이픈 없이 붙여 넣어도, 법인등록번호·전화는 그대로', () => {
  const c = C.normCase({ id: 'DG-9', memo: '번호 7001011234567 와 800101-2234567', checks: { x: { note: '900101 - 1234567' } } });
  assert.doesNotMatch(JSON.stringify(c), /1234567|2234567/);
  const b = C.normBase({ firm: { name: '가나', corpNo: '000000-0000000', phone: '041-000-0000', 모르는칸: '700101-1234567' }, charter: '1. 사원 : 점검(7001011234567)' });
  assert.equal(b.firm.corpNo, '000000-0000000');
  assert.equal(b.firm.phone, '041-000-0000');
  assert.ok(!('모르는칸' in b.firm), '정해 두지 않은 법인 칸이 남았다');
  assert.match(b.charter, /700101-_______/);
});

test('같은 사원을 두 번 퇴사시키거나 이미 나간 사원을 고르면 막는다', () => {
  const a = C.applyChanges(법인(), 건([
    { id: 'l1', type: 'leave', member: 'm3' }, { id: 'l2', type: 'leave', member: 'm3' }, { id: 'ad', type: 'addr', member: 'm3', addr: 'y' },
  ]));
  assert.ok(a.errors.length >= 2);
});

test('날짜 도구 — 달 끝·윤년을 넘겨도 3개월이 맞다', () => {
  assert.equal(C.addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(C.addMonths('2027-11-30', 3), '2028-02-29');
  assert.equal(C.addDays('2026-12-25', 14), '2027-01-08');
  assert.equal(C.isDate('2026-02-30'), false);
});

test('현물 재산만 적고 금액이 0원이면 경고 · 등기의 사유는 정관변경 인가일을 먼저 쓴다', () => {
  const a = C.applyChanges(법인(), 건([{ id: 'j', type: 'join', name: '새현물', birth: '950101', addr: '점검시 라로 4', invest: { cash: 0, labor: true, inKind: '차종 : 점검차' } }]));
  assert.ok(a.warnings.some((w) => /현물 가격\)이 0원/.test(w)), a.warnings.join('\n'));
  const b = C.applyChanges(법인(), 건([{ id: 'a', type: 'addr', member: 'm3', addr: '점검시 새로 9' }], { dates: { approval: '2026-12-05', approvalGet: '2026-12-08' } }));
  assert.match(C.reason(b), /2026년 12월 5일 고용노동부 정관변경 인가를 받음/);
});

/* 2026-11-14 지난 등기 원본 서류 묶음(deungi/archive) — 대표 「지난기록 서식 원본과 자료들 모두 넣어달라」 */
test('원본 서류 종류 짐작 — «정관변경 인가신청서»가 «정관»으로 가지 않는다', () => {
  const 보기 = {
    '1. 노무법인 정관 변경인가 신청서.hwp': 'apply', '정관변경인가증.pdf': 'approval', '서산지사노동부인가증.pdf': 'approval',
    '정관변경이유서.hwp': 'reason', '사원총회 의사록.hwp': 'minutes', '임시사원총회 회의록_240416.pdf': 'minutes',
    '4. 총사원 동의서 (푸른노무법인) (.hwp': 'consent', '2. 정관변경사항 및 정관변경-검토수정안.hwp': 'compare',
    '사원명부.pdf': 'roster', '주주명부_250102.pdf': 'roster', '7. 위임장.hwp': 'poa', '공증용위임장.hwp': 'poa',
    '28(19).합명회사변경등기(상호·목적변경)-지사설립등기.hwp': 'request', '등기부등본.pdf': 'registry', '등기사항증명서_2026-09-10.pdf': 'registry',
    '필요서류 안내.jpg': 'guide', '납부서외.pdf': 'fee', '3. 정 관-2019.7.(지사)-검토수정안.hwp': 'charter', '개정 정관.hwp': 'charter', '사진.jpg': 'etc',
  };
  Object.keys(보기).forEach((n) => assert.equal(C.guessArcKind(n), 보기[n], n));
  assert.equal(C.arcKindLabel('apply'), '정관변경 인가신청서');
  assert.equal(C.arcKindLabel('없는것'), '기타');
});

test('파일 이름 속 날짜 — 여덟 자리·구분 있는 날짜만, 여섯 자리(주민번호 앞자리 꼴)는 읽지 않는다', () => {
  assert.equal(C.arcDateFromName('SCAN_20180828_172128591.pdf'), '2018-08-28');
  assert.equal(C.arcDateFromName('정관변경2012.10.16'), '2012-10-16');
  assert.equal(C.arcDateFromName('등기사항증명서_2026-09-10.pdf'), '2026-09-10');
  assert.equal(C.arcDateFromName('회의록_240416.pdf'), '');
  assert.equal(C.arcDateFromName('정 관 2019.7.(지사).hwp'), '');
  assert.equal(C.arcDateFromName('20191399.pdf'), '');
});

test('★ 묶음 정리 — 파일 줄 열쇠는 파일 번호와 같아야 하고, 글 칸의 주민번호 뒷자리는 지운다', () => {
  const a = C.normArchive({ id: 'ARtest01', title: '점검 등기 700101-1234567', at: '2019-07-30', summary: '사원 1명 입사 800101 2234567',
    files: {
      ok_file_id_0001: { fileId: 'ok_file_id_0001', name: '동의서 700101-1234567.hwp', kind: 'consent', date: '2019-07-30', masked: true, addedAt: 5 },
      bad: { fileId: 'bad', name: '짧은 번호', kind: 'etc' },
      mismatch_key_0001: { fileId: 'other_file_id_01', name: '열쇠가 다름', kind: 'etc' },
      weird_kind_00001: { fileId: 'weird_kind_00001', name: '모르는 종류', kind: 'nope', date: '2019-02-30' },
    } });
  assert.equal(a.entityType, 'DeungiArchive');
  assert.deepEqual(Object.keys(a.files).sort(), ['ok_file_id_0001', 'weird_kind_00001']);
  assert.doesNotMatch(JSON.stringify(a), /1234567|2234567/);
  assert.equal(a.files.weird_kind_00001.kind, 'etc');
  assert.equal(a.files.weird_kind_00001.date, '');
  assert.equal(a.files.ok_file_id_0001.masked, true);
  assert.equal(C.normArchive({ id: 'a/b' }).id, '', '열쇠에 쓸 수 없는 글자');
});

test('묶음 차례는 날짜 늦은 것부터(날짜 없는 것은 끝), 파일은 서류 종류 차례', () => {
  const rows = C.archiveList({
    ARold00001: { id: 'ARold00001', title: '옛 등기', at: '2017-12-06' },
    ARnone0001: { id: 'ARnone0001', title: '날짜 모름' },
    ARnew00001: { id: 'ARnew00001', title: '새 등기', at: '2026-09-03', files: {
      file_b_00001: { fileId: 'file_b_00001', name: '위임장.hwp', kind: 'poa' },
      file_a_00001: { fileId: 'file_a_00001', name: '정관.hwp', kind: 'charter' } } },
  });
  assert.deepEqual(rows.map((r) => r.id), ['ARnew00001', 'ARold00001', 'ARnone0001']);
  assert.deepEqual(C.arcFiles(rows[0]).map((f) => f.kind), ['charter', 'poa']);
});

test('새로 올린 파일 한 줄 — 종류·날짜를 이름으로 짐작하고, 이름에 «가림»이 있으면 가린 사본 표시', () => {
  const e = C.arcFileEntry('push_key_000001', '2019-07-30_총사원 동의서_주민번호가림.hwp', 9);
  assert.deepEqual(e, { fileId: 'push_key_000001', name: '2019-07-30_총사원 동의서_주민번호가림.hwp', kind: 'consent', date: '2019-07-30', note: '', masked: true, addedAt: 9 });
  assert.equal(C.arcFileEntry('x', '정관.hwp'), null, '파일 번호 꼴이 아니면 만들지 않는다');
  assert.equal(C.arcFileEntry('push_key_000002', '정관.hwp').masked, false);
});

test('★ 주민번호 지우개 — 파일 이름에 흔한 밑줄·점·물결로 이어도 지운다(보안 재검토 2026-11-14)', () => {
  ['시험_900101_1234567.pdf', '시험 900101.1234567.hwp', '900101~2234567', '900101 - 1234567', '9001011234567'].forEach((s) => {
    assert.doesNotMatch(C.str(s), /1234567|2234567/, s);
  });
  /* 날짜·전화·사업자번호·법인등록번호는 그대로 */
  ['2019.07.15', '041-556-0035', '312-81-52792', '161571-0000304'].forEach((s) => assert.equal(C.str(s), s));
  const e = C.arcFileEntry('push_key_000003', '동의서_900101_1234567.hwp');
  assert.doesNotMatch(e.name, /1234567/);
});
