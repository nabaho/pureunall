'use strict';
// 검토 산출물 생성 — 엑셀 검토표 + HTML 검토 페이지
// 실행: node tools/forms_report.js   (입력 _forms_out/corpus.jsonl)
const fs = require('fs');
const path = require('path');
const L = require('./forms_lib.js');
const P = require('./forms_pipeline.js');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '_forms_out');

const DOMAIN_LABEL = {
  wageArrears: '임금체불', laborCommission: '노동위원회', industrialAccident: '산재',
  consulting: '컨설팅', fund: '기금', bargaining: '교섭', other: '기타',
};

// ── '중복' 열은 그대로 두고 판본 수로 읽는다 ──
// 서식을 제목(서식 유형)으로 묶은 뒤로 한 행은 한 서식 유형이고, 그 아래 판본이
// 여러 벌 쌓인다. 판본 수 = source.cluster.length(= 판본이 나온 서로 다른 원본
// 파일 수)이고, 이는 '중복' 열이 이미 담고 있던 바로 그 수다. 같은 수를 담는
// 열을 하나 더 만들면 노무사가 둘을 비교하다가 뜻을 헷갈린다. 그래서 열을
// 새로 만들지 않고 이 열을 재사용한다 — 노무사는 이 열이 큰 행에서
// '판본이 여러 벌 쌓인 서식 유형'을 바로 알아본다.
const HEADERS = ['승인', '육안확인', '도메인', '서식명', '분류', '전자서명', '서명자',
                 '관할', '트랙', '변수', '플래그', '중복', '대표본 경로', '본문 미리보기'];
const RATIOS  = [0.4, 0.5, 0.8, 2.2, 0.8, 0.6, 0.6, 0.5, 1.4, 2.0, 1.0, 0.5, 3.6, 4.0];

// ── 검토 순서 ──
// 제목이 검출된 서식이 앞, 미검출이 뒤(의뢰인 결정). 미검출 서식은 사람이 제목을
// 붙여 주기 전에는 목록에서 이름으로 찾을 수 없는 미완성 항목이라, 검토 가능한
// 목록 사이에 섞이면 노무사의 진도를 끊는다. 뒤에 따로 모아 두면 '이름 붙이기'라는
// 다른 종류의 작업으로 한꺼번에 처리할 수 있다.
// 각 덩어리 안에서는 도메인 → 서식명 순 — 같은 도메인의 서식이 붙어 있어야
// 비슷한 서식을 잇달아 보며 판단할 수 있다. 마지막 id 비교는 동점 처리용이라
// 같은 corpus면 순서가 항상 같다.
// 승인 순서 (설계 2026-08-06 법인 서식집 §6 「승인 순서」) — 노무사가 이 차례로 검토한다.
// 예전에는 도메인 이름 가나다순이라 임금체불이 교섭·기금·산재 뒤에 섰다(대표 「서식집 노무사 검토한다」 2026-10-04).
const DOMAIN_ORDER = ['wageArrears', 'laborCommission', 'industrialAccident', 'consulting', 'fund', 'bargaining', 'other'];
function domainRank(d) { const i = DOMAIN_ORDER.indexOf(d); return i < 0 ? DOMAIN_ORDER.length : i; }

function sortForReview(forms) {
  const label = f => DOMAIN_LABEL[f.domain] || f.domain || '';
  return (forms || []).slice().sort((a, b) =>
    (a.titleDetected ? 0 : 1) - (b.titleDetected ? 0 : 1) ||
    domainRank(a.domain) - domainRank(b.domain) ||
    label(a).localeCompare(label(b), 'ko') ||
    String(a.title || '').localeCompare(String(b.title || ''), 'ko') ||
    String(a.id || '').localeCompare(String(b.id || '')));
}

function reviewRows(forms) {
  const rows = sortForReview(forms).map(f => [
    '',                                                   // 승인 — 노무사가 O/X 기입
    f.source.pickedBy === 'anonymized-latest' ? 'O' : '',  // 육안확인 필요
    DOMAIN_LABEL[f.domain] || f.domain,
    // 제목 미검출 — 표 안에 있던 제목은 세그먼트 분할이 못 찾는다.
    // buildForms가 이미 title을 본문 앞 24자로 채워 넣으므로 title이 비는 일은
    // 없다 — titleDetected로 실제 검출 여부를 봐야 한다. 사람이 직접 제목을
    // 달아야 하므로 표시로 구분한다.
    f.titleDetected ? f.title : '(제목 미검출) ' + f.title,
    f.category,
    f.esign ? 'O' : '',
    f.signer || '',
    f.jurisdiction || '',
    (f.track || []).join(', '),
    (f.vars || []).map(v => v.key).join(', '),
    (f.review.flags || []).join(', '),
    (f.source.cluster || []).length,
    f.source.file,
    L.stripTags(f.body).slice(0, 200),
  ]);
  return { headers: HEADERS.slice(), colRatios: RATIOS.slice(), rows };
}

// 차수별 검토 묶음 — 한 번에 3천 종을 다 볼 수 없다. 승인 순서대로 도메인 하나씩 따로 낸다.
// 제목 미검출 서식도 그 도메인 묶음의 맨 뒤에 함께 넣는다(사람이 제목을 붙일 일감).
function reviewBatches(forms) {
  const by = {};
  (forms || []).forEach(f => { (by[f.domain] = by[f.domain] || []).push(f); });
  return Object.keys(by).sort((a, b) => domainRank(a) - domainRank(b) || a.localeCompare(b))
    .map((d, i) => ({ n: i + 1, domain: d, label: DOMAIN_LABEL[d] || d, forms: by[d] }));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function reviewHtml(forms) {
  const list = sortForReview(forms);
  // 미검출이 하나도 없으면 안내 문장 자체를 넣지 않는다 — 없는 표시를 설명해
  // 두면 페이지를 검색하는 사람이 있지도 않은 항목을 찾게 된다.
  const nUntitled = list.filter(f => !f.titleDetected).length;
  const untitledNote = nUntitled
    ? `<br>제목이 검출되지 않은 <b class="untitled">(제목 미검출)</b> ${nUntitled}종은 `
      + '사람이 제목을 붙여야 하는 항목이라 맨 뒤에 따로 모았다.'
    : '';
  const items = list.map((f, i) => `
<section class="form">
  <h2>${i + 1}. ${f.titleDetected ? '' : '<span class="untitled">(제목 미검출)</span> '}${esc(f.title)} <span class="id">${esc(f.id)}</span></h2>
  <dl>
    <dt>도메인</dt><dd>${esc(DOMAIN_LABEL[f.domain] || f.domain)} / ${esc((f.track || []).join(', '))}</dd>
    <dt>분류</dt><dd>${esc(f.category)}${f.esign ? ' · <b>전자서명 대상</b>' : ''}${f.jurisdiction ? ' · 관할 ' + esc(f.jurisdiction) : ''}</dd>
    <dt>변수</dt><dd>${esc((f.vars || []).map(v => v.key).join(', ')) || '-'}</dd>
    <dt>플래그</dt><dd class="flags">${esc((f.review.flags || []).join(', ')) || '-'}</dd>
    <dt>대표본</dt><dd class="src">${esc(f.source.file)}<br><small>선정 ${esc(f.source.pickedBy)} · 중복 ${(f.source.cluster || []).length}건</small></dd>
  </dl>
  <div class="body">${f.body}</div>
</section>`).join('\n');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>서식집 검토 — ${list.length}종</title>
<style>
 body{font:14px/1.7 "맑은 고딕",sans-serif;margin:0;padding:24px;background:#f5f6f8;color:#222}
 h1{font-size:20px;margin:0 0 4px}
 .lead{color:#666;margin:0 0 24px}
 .form{background:#fff;border:1px solid #dde;border-radius:8px;padding:20px;margin:0 0 20px}
 .form h2{font-size:16px;margin:0 0 12px;border-bottom:2px solid #1f3f8f;padding-bottom:8px}
 .id{font-weight:400;color:#999;font-size:12px;font-family:monospace}
 dl{display:grid;grid-template-columns:80px 1fr;gap:4px 12px;margin:0 0 16px;font-size:13px}
 dt{color:#666}
 dd{margin:0}
 .flags{color:#c00;font-weight:700}
 .untitled{color:#c00;font-weight:700}
 .src{font-family:monospace;font-size:12px;word-break:break-all}
 .body{border-top:1px dashed #ccd;padding-top:16px}
 .body table{border-collapse:collapse;width:100%;margin:8px 0}
 .body td{border:1px solid #999;padding:4px 6px;vertical-align:top}
 .body p{margin:4px 0}
</style></head>
<body>
<h1>서식집 검토 — ${list.length}종</h1>
<p class="lead">엑셀 검토표에서 승인열에 O를 준 서식의 문구를 여기서 정독한다.
<b class="flags">플래그가 붙은 서식</b>과 대표본 선정이 <code>anonymized-latest</code>인 서식은 반드시 확인.<br>
한 항목 = 서식 유형 한 종(제목 기준)이고, <b>중복 N건</b>은 그 유형의 판본이 나온 원본 파일 수 = 판본 수다.${untitledNote}</p>
${items}
</body></html>`;
}

function main() {
  const corpusPath = path.join(OUT_DIR, 'corpus.jsonl');
  if (!fs.existsSync(corpusPath)) {
    console.error('corpus.jsonl이 없습니다. 먼저 실행: python tools/forms_corpus.py');
    process.exit(1);
  }
  const records = fs.readFileSync(corpusPath, 'utf8').split('\n').filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  const taxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, 'forms_taxonomy.json'), 'utf8'));

  const names = P.collectNames(records);
  console.log('코퍼스 %d건 / 인명 사전 %d개', records.length, names.length);

  const forms = P.buildForms(records, taxonomy, names);
  const nTitled = forms.filter(f => f.titleDetected).length;
  const nUntitled = forms.length - nTitled;
  console.log('서식 %d종 (제목 검출 %d · 미검출 %d)', forms.length, nTitled, nUntitled);

  // 엑셀
  const XG = require(path.join(ROOT, 'xlsx_gen.js'));
  const t = reviewRows(forms);
  const u8 = XG.build({
    sheet: '서식집', title: '서식집 검토표', sub: '생성 ' + new Date().toISOString().slice(0, 10)
      + ' · 서식 유형 ' + forms.length + '종(제목 ' + nTitled + ' · 미검출 ' + nUntitled + ')'
      + ' / 원본 ' + records.length + '건 · 중복 열 = 판본 수',
    headers: t.headers, colRatios: t.colRatios, rows: t.rows, landscape: true,
  });
  const xlsxPath = path.join(OUT_DIR, '서식집_검토표.xlsx');
  fs.writeFileSync(xlsxPath, Buffer.from(u8));

  // HTML
  const htmlPath = path.join(OUT_DIR, '서식집_검토.html');
  fs.writeFileSync(htmlPath, reviewHtml(forms), 'utf8');

  // 차수별 — 노무사는 1차(임금체불)부터 연다. 전체 파일은 41MB 라 열기도 버겁다.
  const batchPaths = [];
  reviewBatches(forms).forEach(b => {
    const bt = reviewRows(b.forms);
    const nT = b.forms.filter(f => f.titleDetected).length;
    const bx = XG.build({
      sheet: b.label, title: '서식집 검토표 ' + b.n + '차 — ' + b.label,
      sub: '생성 ' + new Date().toISOString().slice(0, 10) + ' · ' + b.forms.length + '종(제목 ' + nT + ' · 미검출 ' + (b.forms.length - nT) + ')'
        + ' · 승인 칸에 O/X',
      headers: bt.headers, colRatios: bt.colRatios, rows: bt.rows, landscape: true,
    });
    const base = '서식집_검토_' + b.n + '차_' + b.label;
    fs.writeFileSync(path.join(OUT_DIR, base + '.xlsx'), Buffer.from(bx));
    fs.writeFileSync(path.join(OUT_DIR, base + '.html'), reviewHtml(b.forms), 'utf8');
    batchPaths.push(base + ' (' + b.forms.length + '종)');
  });

  // 요약
  const byDomain = {};
  forms.forEach(f => (byDomain[f.domain] = (byDomain[f.domain] || 0) + 1));
  console.log('\n=== 도메인별 ===');
  Object.entries(byDomain).sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log('  %s %s', String(n).padStart(5), DOMAIN_LABEL[d] || d));
  // 판본이 많이 쌓인 서식 유형 — 노무사가 어디부터 파고들지 정하는 기준.
  console.log('\n=== 판본 수 상위 15 ===');
  forms.slice().sort((a, b) => b.source.cluster.length - a.source.cluster.length
      || String(a.id).localeCompare(String(b.id)))
    .slice(0, 15)
    .forEach(f => console.log('  %s %s %s', String(f.source.cluster.length).padStart(5),
      (DOMAIN_LABEL[f.domain] || f.domain).padEnd(6), f.titleDetected ? f.title : '(제목 미검출)'));

  const byFlag = {};
  forms.forEach(f => (f.review.flags || []).forEach(x => (byFlag[x] = (byFlag[x] || 0) + 1)));
  console.log('\n=== 플래그별 ===');
  Object.entries(byFlag).sort((a, b) => b[1] - a[1])
    .forEach(([x, n]) => console.log('  %s %s', String(n).padStart(5), x));
  console.log('\n전자서명 대상 %d종 / 육안확인 필요 %d종 / 플래그 %d종',
    forms.filter(f => f.esign).length,
    forms.filter(f => f.source.pickedBy === 'anonymized-latest').length,
    forms.filter(f => f.review.flags.length).length);
  console.log('\n산출물:\n  %s\n  %s', xlsxPath, htmlPath);
  console.log('\n차수별 (승인 순서):\n  ' + batchPaths.join('\n  '));
}

if (require.main === module) main();
module.exports = { reviewRows, reviewHtml, reviewBatches, HEADERS, DOMAIN_LABEL, DOMAIN_ORDER };
