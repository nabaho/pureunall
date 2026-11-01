'use strict';
/* 기업규정집 — 분류(취업규칙 · 노사협의회 · 단체협약)와 각 서식 갈래 검사 (2026-11-01 대표 지시)
   ★ 지키는 규칙:
     ① 취업규칙 서식 갈래(규칙본문·신구대조표·신고서·동의서·의견청취·기타)는 기존 그대로 둔다.
     ② 노사협의회와 단체협약은 분류(set)를 가르고, 각 서식(본문·신구대조표·회의록·위원·고충·합의·교섭·신고서·기타)을 따로 관리한다.
     ③ 노사협의회·단체협약 서류는 취업규칙 회차(companyGroups 기본값)·🏢 사업장 셈에 섞이지 않는다.
     ④ 푸른메일함 수집기(rules-collect-pick, rules-collect)는 노사협의회·단체협약 메일과 옛 보류 PDF 도 다시 읽는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/rules-v2/lib-set.js');
const O = require('../js/rules-v2/lib-order.js');
const Sites = require('../js/rules-v2/lib-sites.js');
const V = require('../js/rules-v2/view-library.js');
const P = require('../functions/rules-collect-pick.js');
const C = require('../functions/rules-collect.js');

test('① 취업규칙 서식 갈래는 기존 그대로이고, 노사협의회·단체협약은 각자 서식 갈래를 갖는다', () => {
  assert.deepEqual(S.SETS, ['취업규칙', '노사협의회', '단체협약']);
  assert.deepEqual(S.kindsFor('취업규칙'), ['규칙본문', '신구대조표', '신고서', '동의서', '의견청취', '기타']);
  assert.ok(S.kindsFor('노사협의회').includes('노사협의회'));
  assert.ok(S.kindsFor('노사협의회').includes('회의록'));
  assert.ok(S.kindsFor('노사협의회').includes('위원·고충'));
  assert.ok(S.kindsFor('단체협약').includes('단체협약'));
  assert.ok(S.kindsFor('단체협약').includes('합의·교섭'));
});

test('② 노사협의회·단체협약의 각 서식(신구대조표·신고서·회의록·위원·합의)을 바르게 분류한다', () => {
  const check = (name, kind0, subj) => {
    const doc = { name, kind: kind0 || '규칙본문', mail: { subject: subj || '' } };
    return [S.setOf(doc), S.kindOf(doc)];
  };
  assert.deepEqual(check('가나상사_취업규칙(안).hwp', '규칙본문'), ['취업규칙', '규칙본문']);
  assert.deepEqual(check('노사협의회 운영규정.hwp', '규칙본문'), ['노사협의회', '노사협의회']);
  assert.deepEqual(check('노사협의회규정 변경비교표.hwp', '신구대조표'), ['노사협의회', '신구대조표']);
  assert.deepEqual(check('노사협의회 규정변경내역서_2024.11.27.hwp', '규칙본문'), ['노사협의회', '신구대조표']);
  assert.deepEqual(check('노사협의회규정 제출서.pdf', '규칙본문'), ['노사협의회', '신고서']);
  assert.deepEqual(check('노사협의회 회의록(위원교체).hwp', '기타'), ['노사협의회', '회의록']);
  assert.deepEqual(check('근로자위원 선출 투표용지.hwp', '기타'), ['노사협의회', '위원·고충']);
  assert.deepEqual(check('2026년 단체협약서.hwp', '기타'), ['단체협약', '단체협약']);
  assert.deepEqual(check('2024년 단체협약 요구안 비교표.hwp', '신구대조표'), ['단체협약', '신구대조표']);
  assert.deepEqual(check('단체교섭 합의서.hwp', '기타'), ['단체협약', '합의·교섭']);
  // 메일 제목으로 노사협의회 신고서를 알아본다
  assert.deepEqual(check('변경신고서.hwp', '신고서', '[푸른노무법인] 가나상사 노사협의회 규정 변경신고서 송부'), ['노사협의회', '신고서']);
});

test('② 사람이 고친 분류(setFix)·갈래(kindFix)가 자동 판정을 이긴다', () => {
  const doc = { name: '규정.hwp', kind: '규칙본문' };
  assert.equal(S.setOf(doc, { setFix: '노사협의회' }), '노사협의회');
  assert.equal(S.kindOf(doc, { setFix: '노사협의회' }), '노사협의회');
  assert.equal(S.setOf(doc, { kindFix: '회의록' }), '노사협의회');
  assert.equal(S.kindOf(doc, { kindFix: '회의록' }), '회의록');
});

test('③ 노사협의회·단체협약 서류는 취업규칙 회차·🏢 사업장 셈에 섞이지 않는다', () => {
  const docs = {
    r1: { id: 'r1', name: '가나_취업규칙.hwp', kind: '규칙본문', status: '담김', dir: '보냄', mail: { date: 1000 } },
    n1: { id: 'n1', name: '가나_노사협의회규정.hwp', kind: '규칙본문', status: '담김', dir: '보냄', mail: { date: 2000 } },
    d1: { id: 'd1', name: '가나_단체협약서.hwp', kind: '단체협약', status: '담김', dir: '보냄', mail: { date: 3000 } }
  };
  const human = {
    r1: { companyId: 'co1', companyLinkStatus: 'linked' },
    n1: { companyId: 'co1', companyLinkStatus: 'linked' },
    d1: { companyId: 'co1', companyLinkStatus: 'linked' }
  };
  const items = O.merge(docs, human);
  const gRules = O.companyGroups(items, {});
  assert.equal(gRules.length, 1);
  assert.deepEqual(gRules[0].rows.map((v) => v.item.id), ['r1'], '취업규칙 회차에는 취업규칙만');

  const gNosa = O.companyGroups(items, {}, '노사협의회');
  assert.equal(gNosa.length, 1);
  assert.deepEqual(gNosa[0].rows.map((v) => v.item.id), ['n1'], '노사협의회 회차에는 노사협의회만');

  const siteRows = Sites.model({ docs, human, rounds: {} }, [{ id: 'co1', name: '가나상사' }]);
  assert.equal(siteRows[0].linked, 1, '🏢 사업장 서류 수는 취업규칙만 센다');
});

test('② 📥 모은 자료 화면에서 분류(취업규칙·노사협의회·단체협약)별로 거르고 옆 칸에서 분류·갈래를 고칠 수 있다', () => {
  const docs = {
    r1: { id: 'r1', name: '가나_취업규칙.hwp', kind: '규칙본문', status: '담김', dir: '받음', mail: { key: '1', date: 1000, subject: '취업규칙' } },
    n1: { id: 'n1', name: '가나_노사협의회_회의록.hwp', kind: '회의록', status: '담김', dir: '받음', mail: { key: '2', date: 2000, subject: '노사협의회' } }
  };
  const stAll = { data: { docs, human: {}, rounds: {} }, view: 'mail', filt: {}, picked: new Set(), sel: 'n1', companies: [] };
  const fltHtml = V.filterHtml(stAll);
  assert.match(fltHtml, /data-act="set" data-v="취업규칙"/);
  assert.match(fltHtml, /data-act="set" data-v="노사협의회"/);
  assert.match(fltHtml, /data-act="set" data-v="단체협약"/);

  const stNosa = Object.assign({}, stAll, { filt: { set: '노사협의회' } });
  const tblNosa = V.tableHtml(stNosa);
  assert.match(tblNosa, /가나_노사협의회_회의록\.hwp/);
  assert.doesNotMatch(tblNosa, /가나_취업규칙\.hwp/);

  const side = V.sideHtml(stAll, '회의록 본문');
  assert.match(side, /data-role="set"/);
  assert.match(side, /data-role="kind"/);
  assert.match(side, /회의록/);
});

test('④ 푸른메일함 수집기는 노사협의회·단체협약 메일을 고르고, 옛 보류 PDF 도 다시 읽기 대상에 넣는다', () => {
  assert.equal(P.isRulesMail({ s: '노사협의회 규정 검토 요청', p: '', a: 0 }), true);
  assert.equal(P.isRulesMail({ s: '2026년 단체협약 체결본 송부', p: '', a: 0 }), true);
  assert.equal(P.isRulesMail({ s: '임금협약서 검토', p: '', a: 0 }), true);
  assert.equal(P.setOf('2026년 단체협약서.pdf', ''), '단체협약');
  assert.equal(P.kindOf('2026년 단체협약서.pdf', ''), '단체협약');
  assert.equal(P.kindOf('노사협의회 회의록.hwp', ''), '회의록');
  assert.equal(P.kindOf('근로자위원 선출 투표용지.hwp', ''), '위원·고충');
  assert.ok(C.NO_TEXT_KINDS['위원·고충'], '위원·고충 서류는 근로자 이름이 들어 글·파일을 담지 않는다');

  // 옛 회차가 kind:'기타' + PDF_HOLD.OLD 로 보류해 둔 단체협약·노사협의회 PDF 도 pdfTargets 가 다시 집는다
  const targets = C.pdfTargets({
    rd_danche: {
      id: 'rd_danche', name: '서산시시설관리공단 단체협약서.pdf', kind: '기타',
      status: '보류', holdWhy: C.PDF_HOLD.OLD, sha: 'a'.repeat(64),
      dir: '받음', mail: { src: 'pop3', box: '', key: 'm1', subject: '단체협약서' }
    },
    rd_nosa: {
      id: 'rd_nosa', name: '노사협의회 최종.pdf', kind: '기타',
      status: '보류', holdWhy: C.PDF_HOLD.OLD, sha: 'b'.repeat(64),
      dir: '받음', mail: { src: 'pop3', box: '', key: 'm2', subject: '노사협의회' }
    },
    rd_hwp_nosa: {
      id: 'rd_hwp_nosa', name: '노사협의회(0513).hwp', kind: '기타',
      status: '보류', holdWhy: C.NO_TEXT_KINDS['기타'], sha: 'c'.repeat(64),
      dir: '받음', mail: { src: 'pop3', box: '', key: 'm3', subject: '노사협의회' }
    }
  });
  assert.ok(targets.length >= 3, '옛 보류 PDF 와 옛 기타로 보류됐던 노사협의회·단체협약 한글 파일도 다시 읽기 대상에 넣는다');
});

test('⑤ 사업장별 순서(companyTable)에서도 3분류 칩과 본문 판(현행·1판·★최종본)을 관리하고, 🏢 사업장 오른쪽 상세창에 다른 규정집(노사협의회·단체협약)을 함께 보여준다', () => {
  const SitesView = require('../js/rules-v2/view-sites.js');
  const docs = {
    r1: { id: 'r1', name: '가나_취업규칙.hwp', kind: '규칙본문', status: '담김', dir: '받음', mail: { key: '1', date: 1000, subject: '취업규칙' } },
    n0: { id: 'n0', name: '가나_노사협의회규정_초안.hwp', kind: '노사협의회', status: '담김', dir: '받음', mail: { key: '2', date: 2000, subject: '노사협의회' } },
    n1: { id: 'n1', name: '가나_노사협의회규정_최종.hwp', kind: '노사협의회', status: '담김', dir: '보냄', mail: { key: '3', date: 3000, subject: '노사협의회' } },
    nm: { id: 'nm', name: '가나_노사협의회_회의록.hwp', kind: '회의록', status: '담김', dir: '받음', mail: { key: '4', date: 3500, subject: '노사협의회' } },
    d1: { id: 'd1', name: '가나_단체협약서.hwp', kind: '단체협약', status: '담김', dir: '보냄', mail: { key: '5', date: 4000, subject: '단체협약' } }
  };
  const human = {};
  Object.keys(docs).forEach((k) => { human[k] = { companyId: 'co1', companyLinkStatus: 'linked' }; });
  const rounds = { 'co1_노사협의회_r197001': { finalDocId: 'n1', finalBy: '홍길동', finalAt: 3100 } };
  const cos = [{ id: 'co1', name: '가나상사', status: 'active', employmentInsuredCount: 35 }];

  // 📥 모은 자료 › 사업장별 순서에서 노사협의회 선택 시
  const stCoNosa = { data: { docs, human, rounds }, view: 'company', filt: { set: '노사협의회' }, picked: new Set(), sel: '', companies: cos };
  const flt = V.filterHtml(stCoNosa);
  assert.match(flt, /data-act="set" data-v="노사협의회"/, '사업장별 순서에서도 3분류 칩이 보인다');
  const coTbl = V.tableHtml(stCoNosa);
  assert.match(coTbl, /규정 본문/);
  assert.match(coTbl, /회의록/);
  assert.match(coTbl, /파일 \(규정 본문만\)/);
  assert.match(coTbl, /data-set="노사협의회"/);
  assert.match(coTbl, /★ 최종본/);

  // 🏢 사업장 오른쪽 상세창에 노사협의회·단체협약 보유 자료 표시
  const rows = Sites.model({ docs, human, rounds }, cos);
  assert.ok(rows[0].otherSets['노사협의회'].length >= 2);
  assert.ok(rows[0].otherSets['단체협약'].length >= 1);
  const side = SitesView.sideHtml({ data: { docs, human, rounds }, companies: cos, sites: { sel: 'co1' } }, rows[0]);
  assert.match(side, /이 사업장의 다른 규정집/);
  assert.match(side, /🤝 노사협의회/);
  assert.match(side, /📜 단체협약/);
  assert.match(side, /data-act="siteSetLib" data-set="노사협의회"/);

  // ⑥ 🏢 사업장 표에 규칙·노사·단협 체크항목(siteSetSel)이 표시되고, 클릭 시 현재 규정 본문을 바로 확인할 수 있다
  const listH = SitesView.listHtml({ data: { docs, human, rounds }, companies: cos, sites: { sel: 'co1', set: '노사협의회' } }, rows);
  assert.match(listH, /data-act="siteSetSel" data-co="co1" data-set="취업규칙"/);
  assert.match(listH, /data-act="siteSetSel" data-co="co1" data-set="노사협의회"/);
  assert.match(listH, /data-act="siteSetSel" data-co="co1" data-set="단체협약"/);

  const sideNosa = SitesView.sideHtml({
    data: { docs, human, rounds }, companies: cos,
    sites: { sel: 'co1', set: '노사협의회' },
    siteText: { id: 'n1', body: '제1조(목적) 본 노사협의회 규정은...' }
  }, rows[0]);
  assert.match(sideNosa, /📖 현재 노사협의회 규정/);
  assert.match(sideNosa, /가나_노사협의회규정_최종\.hwp/);
  assert.match(sideNosa, /제1조\(목적\) 본 노사협의회 규정은/);
});
