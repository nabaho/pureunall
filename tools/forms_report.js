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

const HEADERS = ['승인', '육안확인', '도메인', '서식명', '분류', '전자서명', '서명자',
                 '관할', '트랙', '변수', '플래그', '중복', '대표본 경로', '본문 미리보기'];
const RATIOS  = [0.4, 0.5, 0.8, 2.2, 0.8, 0.6, 0.6, 0.5, 1.4, 2.0, 1.0, 0.5, 3.6, 4.0];

function reviewRows(forms) {
  const rows = (forms || []).map(f => [
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

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function reviewHtml(forms) {
  const list = forms || [];
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
<b class="flags">플래그가 붙은 서식</b>과 대표본 선정이 <code>anonymized-latest</code>인 서식은 반드시 확인.</p>
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
  console.log('서식 %d종', forms.length);

  // 엑셀
  const XG = require(path.join(ROOT, 'xlsx_gen.js'));
  const t = reviewRows(forms);
  const u8 = XG.build({
    sheet: '서식집', title: '서식집 검토표', sub: '생성 ' + new Date().toISOString().slice(0, 10)
      + ' · 서식 ' + forms.length + '종 / 원본 ' + records.length + '건',
    headers: t.headers, colRatios: t.colRatios, rows: t.rows, landscape: true,
  });
  const xlsxPath = path.join(OUT_DIR, '서식집_검토표.xlsx');
  fs.writeFileSync(xlsxPath, Buffer.from(u8));

  // HTML
  const htmlPath = path.join(OUT_DIR, '서식집_검토.html');
  fs.writeFileSync(htmlPath, reviewHtml(forms), 'utf8');

  // 요약
  const byDomain = {};
  forms.forEach(f => (byDomain[f.domain] = (byDomain[f.domain] || 0) + 1));
  console.log('\n=== 도메인별 ===');
  Object.entries(byDomain).sort((a, b) => b[1] - a[1])
    .forEach(([d, n]) => console.log('  %s %s', String(n).padStart(5), DOMAIN_LABEL[d] || d));
  console.log('\n전자서명 대상 %d종 / 육안확인 필요 %d종 / 플래그 %d종',
    forms.filter(f => f.esign).length,
    forms.filter(f => f.source.pickedBy === 'anonymized-latest').length,
    forms.filter(f => f.review.flags.length).length);
  console.log('\n산출물:\n  %s\n  %s', xlsxPath, htmlPath);
}

if (require.main === module) main();
module.exports = { reviewRows, reviewHtml, HEADERS, DOMAIN_LABEL };
