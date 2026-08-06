'use strict';
// 서식집 파이프라인 — corpus 레코드 → 서식 레코드 배열
// 순수 함수만 둔다(파일 입출력은 forms_report.js). 그래야 테스트가 붙는다.
const L = require('./forms_lib.js');

// 서식 어휘 — 파일명 끝에 붙어도 인명이 아니다
const NOT_NAME = /^(양식|사본|서식|샘플|예시|최신|원본|수정|초안|참고|복사본|첨부|별지|신청서|확인서|동의서|위임장|진정서|취하서|합의서|계약서|청구서|보고서|계산서)$/;

function collectNames(records) {
  const out = new Set();
  for (const r of records || []) {
    const base = String(r.rel || '').split('/').pop().replace(/\.[^.]+$/, '');
    const m = /[_-]\s*([가-힣]{2,4})\s*$/.exec(base);
    if (m && !NOT_NAME.test(m[1])) out.add(m[1]);
  }
  return [...out];
}

function domainPrefix(domain) {
  return ({ wageArrears: 'wa', laborCommission: 'lc', industrialAccident: 'ia',
            consulting: 'cs', fund: 'fd', bargaining: 'bg' })[domain] || 'ot';
}

function buildForms(records, taxonomy, names) {
  // ① 레코드 → 세그먼트(서식 단위)
  const segs = [];
  for (const r of records || []) {
    if (r.err || !r.html) continue;
    for (const s of L.splitSegments(r.html)) {
      segs.push({ rel: r.rel, mtime: r.mtime || 0, title: s.title,
                  html: s.html, key: r.rel + '#' + s.index,
                  text: L.normalizeForHash(s.html) });
    }
  }

  // ② 군집
  const groups = L.clusterByContent(segs);

  // ③ 군집마다 대표본 → 서식 레코드
  const forms = [];
  const usedIds = new Set();
  for (const g of groups) {
    const { rep, pickedBy } = L.pickRepresentative(g);
    if (!rep) continue;

    const anon = pickedBy === 'anonymized-latest' ? L.anonymize(rep.html, names)
                                                  : { html: rep.html, hits: {} };
    const body = anon.html;
    const cls = L.classify(rep.rel, body, taxonomy);
    const hash = L.formHash(body);

    let id = domainPrefix(cls.domain) + '-' + hash;
    while (usedIds.has(id)) id = id + 'x';
    usedIds.add(id);

    forms.push({
      id,
      title: rep.title || L.stripTags(body).slice(0, 24),
      domain: cls.domain,
      track: cls.track,
      category: cls.category,
      esign: cls.esign,
      signer: cls.signer,
      jurisdiction: cls.jurisdiction,
      vars: L.extractVars(body),
      signFields: cls.signer ? [{ role: cls.signer, label: rep.title || '서명', type: 'sign' }] : [],
      body,
      source: {
        file: rep.rel,
        mtime: rep.mtime,
        segment: +String(rep.key).split('#')[1] || 0,
        hash,
        pickedBy,
        cluster: g.map(x => x.rel),
      },
      review: { status: 'pending', flags: L.flagIssues(body), reviewedBy: '', reviewedAt: '' },
    });
  }
  return forms;
}

module.exports = { collectNames, buildForms, domainPrefix };
