/* rehab-letter.js — 회생광고: 회생기업에 보내는 «우편 안내문» + «우편 라벨» 을 만든다 (2026-10-10).
   대표 지시 「안내문 … 메일에 있다 · 비용 자부담이 있다 이 부분도 안내해야 한다」
   ■ 글만 만든다 — 인쇄 창 열기는 부르는 쪽(rehab-ad.html)이 한다. 그래서 노드에서 그대로 검사한다.
   ■ 이메일·문자로 보내는 글이 아니다 — 광고성 정보를 전자적으로 보내려면 수신자 사전 동의가 필요하다(정보통신망법 제50조).
     우편(서면)은 그 조항의 대상이 아니다. 그래서 안내문 끝에 «원하지 않으시면 알려 달라»는 수신거부 한 줄을 둔다.
   ■ 숫자·조문은 «근거를 밝혀» 적는다:
       · 보조율 90%(기업 자부담 10%) · 부가가치세는 기업 부담 — 2024년 혁신바우처 지원계획 공고(재기컨설팅 바우처)
       · 사업정리 노무 분야 1~2일 60~120만원 — 혁신바우처 플랫폼 「재기 컨설팅 바우처 사업이란?」
       · 조문 4곳은 담당 노무사 최종 검토 대상이다([확인 필요]).
   ⚠ 해마다 공고가 바뀐다 — 안내문에도 «해당 연도 공고에 따른다»고 적는다. 숫자를 고치면 아래 FIRM·COST 한 곳만 고친다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RehabLetter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIRM = {
    name: '푸른노무법인',
    rep: '대표 공인노무사 권형하',
    tel: '041-556-0035',
    email: '370-6@daum.net',
    addr: '충청남도 천안시 서북구 원두정8길 6, 두정빌딩 301호'
  };
  /* 재기컨설팅 바우처 비용 — 기업이 내는 몫 */
  var COST = {
    basis: '2024년 혁신바우처 지원계획 공고',
    share: 10,          // 기업 자부담 %
    support: 90,        // 정부 지원 %
    exampleFee: 120,    // 예시: 사업정리 노무 컨설팅 120만원
    stamp: '[초안 — 담당 노무사 최종 검토 필요]'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function coName(c) { return String((c && c.debtorName) || '').replace(/\s+/g, ' ').trim(); }

  /* 안내문 한 장 — 회사명이 들어간다 */
  function buildLetter(c, opts) {
    opts = opts || {};
    var share = Math.round(COST.exampleFee * COST.share) / 100;
    return '<section class="letter">' +
      '<h1>회생절차를 진행하는 기업을 위한 노무·재기 지원 안내</h1>' +
      '<p class="to">' + esc(coName(c)) + ' 대표이사님 귀하</p>' +
      '<p>안녕하십니까. ' + esc(FIRM.name) + '입니다.<br>' +
      '법원 공고를 통해 귀사가 회생절차를 신청하신 것을 알게 되어, 이 시기에 꼭 챙기셔야 할 <b>근로자 임금·고용 문제</b>와 <b>정부 재기 지원</b>을 안내드립니다.</p>' +
      '<h2>1. 회생 중 꼭 챙겨야 할 노무 사항</h2>' +
      '<ul>' +
      '<li><b>임금·퇴직금은 «공익채권»입니다.</b> 회생절차에 의하지 않고 수시로 갚아야 하므로 지급 계획을 회생계획과 함께 세워야 합니다. <span class="law">채무자회생법 제179조 제1항 제10호·제180조</span></li>' +
      '<li><b>체불 근로자는 「대지급금」을 신청할 수 있습니다.</b> 회생절차개시결정이 지급 사유입니다. <span class="law">임금채권보장법 제7조 제1항</span></li>' +
      '<li><b>인력 조정은 법정 절차를 지켜야 합니다.</b> 경영상 해고는 해고 회피 노력·공정한 대상자 선정·50일 전 근로자대표 통보·협의가 필요하고, 근로조건 불이익 변경은 동의 절차가 필요합니다. <span class="law">근로기준법 제24조·제94조</span></li>' +
      '</ul>' +
      '<h2>2. 정부 지원 — 중소벤처기업진흥공단 「재기컨설팅」</h2>' +
      '<div class="box">위기에 놓인 중소기업에 진로제시(회생조기진입 등)·사업정리·재창업·회생 컨설팅을 정부가 바우처로 지원합니다. ' +
      '<b>' + esc(FIRM.name) + '은 2026년 재기컨설팅(사업정리) 공급기업으로 선정</b>되었습니다(사업정리의 노무 분야 — 임금·고용관계 정리, 근로자 대지급금 안내).</div>' +
      '<table class="cost"><tr><th>프로그램</th><th>정부 지원</th><th>기업 자부담</th></tr>' +
      '<tr><td>진로제시 · 사업정리 · 재창업 컨설팅</td><td>' + COST.support + '%</td><td>' + COST.share + '% + 부가가치세</td></tr>' +
      '<tr><td>회생컨설팅 (자산 50억원 이하 · 간이회생)</td><td>' + COST.support + '%</td><td>' + COST.share + '% + 부가가치세</td></tr>' +
      '<tr><td>회생컨설팅 (자산 50억원 초과)</td><td colspan="2">자산 규모에 따라 차등</td></tr></table>' +
      '<p class="law">예) 사업정리 노무 컨설팅 ' + COST.exampleFee + '만원 → 기업 자부담 ' + share + '만원 + 부가가치세 ' + share + '만원. ' +
      '비율·한도·신청 자격은 해당 연도 공고에 따라 달라질 수 있어, 신청 가능 여부와 함께 확인해 드립니다. (' + esc(COST.basis) + ' 기준)</p>' +
      '<h2>3. ' + esc(FIRM.name) + '이 도와드리는 일</h2>' +
      '<ul><li>임금·퇴직금 지급 계획과 체불 정리 자문 · 근로자 대지급금 신청 지원(도산등사실인정·대지급금 수행 경험)</li>' +
      '<li>회생계획에 맞춘 고용조정 절차 설계 · 사업정리·재창업 단계 노무 정리와 재기컨설팅 연계</li></ul>' +
      '<h2>4. 상담 안내</h2>' +
      '<p>상담을 원하시면 연락 주십시오. 공인노무사가 직접 상담합니다.</p>' +
      '<p><b>' + esc(FIRM.name) + '</b> · 전화 ' + esc(FIRM.tel) + ' · 이메일 ' + esc(FIRM.email) + '<br>' + esc(FIRM.addr) + '</p>' +
      '<p class="sign">' + esc(FIRM.name) + ' ' + esc(FIRM.rep) + '</p>' +
      '<p class="foot">법원 회생 공고를 보고 보내드리는 1회 안내입니다. 원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다. 일반 정보이며, 구체적 판단은 상담으로 드립니다.' +
      (opts.draft ? ' ' + esc(COST.stamp) : '') + '</p>' +
      '</section>';
  }

  /* 라벨 한 칸 — 본점 주소로 보낸다(송달주소는 대리인 사무실일 수 있다) */
  function buildLabel(c) {
    return '<div class="lb"><div class="zip">(우) ' + esc((c && c.zip) || '') + '</div>' +
      '<div class="ad">' + esc((c && c.address) || '') + '</div>' +
      '<div class="to">' + esc(coName(c)) + ' 귀중</div><div class="ceo">대표이사님 앞</div></div>';
  }

  var CSS =
    '@page{size:A4;margin:12mm 16mm}' +
    'body{margin:0;font-family:"Malgun Gothic",sans-serif;color:#1e293b}' +
    '.letter{font-size:9.7pt;line-height:1.36;break-after:page;page-break-after:always}' +
    '.letter:last-child{break-after:auto;page-break-after:auto}' +
    '.letter h1{font-size:16pt;margin:0 0 6pt;color:#1e40af}' +
    '.letter h2{font-size:11.5pt;margin:9pt 0 4pt;color:#1e40af;border-bottom:1px solid #bfdbfe;padding-bottom:2pt}' +
    '.letter p{margin:0 0 4pt}.letter ul{margin:0 0 5pt;padding-left:16pt}.letter li{margin:0 0 2pt}' +
    '.letter .to{font-size:11.5pt;font-weight:bold;margin:0 0 8pt}.letter .law{font-size:8.8pt;color:#475569}' +
    '.letter .box{background:#eff6ff;border:1px solid #bfdbfe;padding:6pt 9pt;margin:5pt 0}' +
    '.letter table.cost{border-collapse:collapse;width:100%;margin:4pt 0 4pt}' +
    '.letter table.cost th,.letter table.cost td{border:1px solid #cbd5e1;padding:2pt 6pt;font-size:9.3pt;text-align:left}' +
    '.letter table.cost th{background:#f8fafc}.letter .sign{margin-top:6pt;text-align:right;font-size:11pt}' +
    '.letter .foot{margin-top:6pt;font-size:8.3pt;color:#64748b;border-top:1px solid #e2e8f0;padding-top:4pt}' +
    '.sheet{display:grid;grid-template-columns:99.1mm 99.1mm;grid-auto-rows:34mm;column-gap:3mm;break-after:page;page-break-after:always}' +
    '.sheet:last-child{break-after:auto;page-break-after:auto}' +
    '.lb{padding:4mm 6mm;overflow:hidden;break-inside:avoid;font-size:10pt}.lb .ad{margin:1mm 0 2mm;line-height:1.35}' +
    '.lb .to{font-size:12pt;font-weight:700}';

  /* 라벨지(A4 한 장 2열×8줄 = 16칸) 쪽으로 나눈다 */
  function buildLabelSheets(list) {
    var out = [], per = 16;
    for (var i = 0; i < list.length; i += per) {
      out.push('<div class="sheet">' + list.slice(i, i + per).map(buildLabel).join('') + '</div>');
    }
    return out.join('');
  }
  function buildLetters(list, opts) { return (list || []).map(function (c) { return buildLetter(c, opts); }).join(''); }

  /* 인쇄 창에 들어갈 문서 한 통 — what: 'letters' | 'labels' | 'both' */
  function buildDocument(list, what, opts) {
    var body = '';
    if (what === 'letters' || what === 'both') body += buildLetters(list, opts);
    if (what === 'labels' || what === 'both') body += buildLabelSheets(list);
    var title = {letters: '안내문', labels: '우편 라벨', both: '안내문과 라벨'}[what] || '인쇄';
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + title + ' ' + (list || []).length + '곳</title>' +
      '<style>' + CSS + '</style></head><body>' + body +
      '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>';
  }

  return { FIRM: FIRM, COST: COST, esc: esc, buildLetter: buildLetter, buildLetters: buildLetters, buildLabel: buildLabel,
    buildLabelSheets: buildLabelSheets, buildDocument: buildDocument, CSS: CSS };
});
