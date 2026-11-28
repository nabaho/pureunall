/* 푸른 지식백과(pu-wiki.html) 휴대폰 화면 전수점검용 합성 자료 — 실존 고객사·실명 없음 */
'use strict';

const NOW = Date.UTC(2026, 10, 28, 2, 0, 0);

function art(id, order, o) {
  return Object.assign({
    id,
    entityType: 'WikiArticle',
    schemaVersion: 3,
    contractVersion: 1,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'P001',
    updatedBy: 'P001',
    order,
    category: '임금·퇴직·체불',
    summary: '',
    body: '## 1. 점검 항목\n- 점검용 합성 본문입니다.',
    laws: ['근로기준법 제23조'],
    wikiTopics: ['임금'],
    apps: ['pbox'],
    obsidianNote: '사내배포_지식백과/점검문서.md'
  }, o);
}

function rev(id, articleId, o) {
  return Object.assign({
    id,
    articleId,
    entityType: 'WikiReview',
    schemaVersion: 3,
    contractVersion: 1,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'P001',
    updatedBy: 'P001',
    kind: 'verify',
    status: 'active',
    actorSid: 'P001',
    articleRev: 1,
    checkedLawNote: '2026-11 현행 법령 대조',
    note: '내용 및 조문 일치 확인',
    resolvedBySid: '',
    resolvedAt: 0,
    resolutionNote: ''
  }, o);
}

module.exports = {
  data: {
    data: {
      user_dir: {
        P001: { sid: 'P001', name: '점검노무사', roleTitle: '공인노무사' },
        P002: { sid: 'P002', name: '점검매니저', roleTitle: '실장' }
      }
    },
    puwiki: {
      articles: {
        'pw-a': art('pw-a', 10, {
          title: '점검 통상임금·포괄임금 산정 및 대지급금 실무 기준 — 긴 제목이 휴대폰에서 잘리지 않는지 확인',
          summary: '정기성·일률성·소정근로 대가성 판단 및 금품청산 14일 원칙 점검',
          laws: ['근로기준법 제2조', '근로기준법 제36조', '임금채권보장법 제7조'],
          wikiTopics: ['임금', '최저임금'],
          apps: ['erp', 'payroll', 'pbox']
        }),
        'pw-b': art('pw-b', 20, {
          title: '점검 직장 내 괴롭힘 객관조사 8단계 및 보호조치 실무',
          category: '괴롭힘·성희롱 조사',
          laws: ['근로기준법 제76조의2', '근로기준법 제76조의3'],
          wikiTopics: ['직장 내 괴롭힘'],
          apps: ['harass', 'pbox']
        }),
        'pw-c': art('pw-c', 30, {
          title: '점검 지운 문서 예시',
          _deleted: true,
          deletedAt: NOW,
          deletedBy: 'P001'
        })
      },
      reviews: {
        'pw-a': {
          'rv-1': rev('rv-1', 'pw-a', { kind: 'verify', actorSid: 'P001', note: '현행 근로기준법·대법원 판례 대조 완료' })
        },
        'pw-b': {
          'fl-1': rev('fl-1', 'pw-b', {
            kind: 'flag',
            status: 'open',
            actorSid: 'P002',
            note: '과태료 조문 번호 표기 재확인 요청 — 긴 신고 문장이 폰 표에서 잘 접히는지 확인'
          })
        }
      }
    }
  },
  views: [
    { name: 'read', run: async (p) => { await p.evaluate(() => openReadModal('pw-a')); }, back: async (p) => { await p.evaluate(() => closeModal()); } },
    { name: 'flags', run: async (p) => { await p.evaluate(() => setTab('flags')); }, back: async (p) => { await p.evaluate(() => setTab('wiki')); } },
    { name: 'ref', run: async (p) => { await p.evaluate(() => setTab('ref')); }, back: async (p) => { await p.evaluate(() => setTab('wiki')); } },
    { name: 'manage', run: async (p) => { await p.evaluate(() => setTab('manage')); }, back: async (p) => { await p.evaluate(() => setTab('wiki')); } },
    { name: 'edit', run: async (p) => { await p.evaluate(() => openEditModal(null)); }, back: async (p) => { await p.evaluate(() => closeModal()); } }
  ]
};
