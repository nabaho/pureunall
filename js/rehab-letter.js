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
  /* 사무소 — 전화번호는 천안·서산만 싣는다(세종·대전은 주소 안내만) */
  var OFFICES = [
    { name: '천안본사', tel: '041-556-0035', addr: '충남 천안시 서북구 원두정8길 6, 두정빌딩 301호' },
    { name: '서산지사', tel: '041-429-0123', addr: '충남 서산시 쌍연남1로 37, 1층(썬샤인빌딩)' },
    { name: '세종지사', tel: '', addr: '세종 한누리대로 312, 노불비즈니스타운 502호' },
    { name: '대전지사', tel: '', addr: '대전 서구 둔산서로 79, 2층' }
  ];
  /* 대지급금 한도 — 근로복지공단·고용노동부 안내 기준. 해마다 고시·법이 바뀔 수 있어 한 곳에서만 고친다.
     도산대지급금: 2026.8.20 시행 개정(최종 6개월분, 상한 2,100→3,150만원). 회생절차개시결정이 2026.8.20 이후인 사건에 적용.
     간이대지급금: 임금 등 700만원 + 퇴직급여 700만원, 합계 1,000만원(재직자는 퇴직급여 제외). */
  var LIMIT = { simple: '1,000만원', insolvency: '3,150만원', asOf: '2026.8.20 시행 개정 기준' };
  /* 재기컨설팅 바우처 비용 — 기업이 내는 몫 */
  var COST = {
    basis: '2024년 혁신바우처 지원계획 공고',
    share: 10,          // 기업 자부담 %
    support: 90,        // 정부 지원 %
    exampleFee: 120,    // 예시: 사업정리 노무 컨설팅 120만원
    stamp: '[초안 — 담당 노무사 최종 검토 필요: 대지급금 처리 기간·한도·비용 문구]'
  };
  function shareWon() { return Math.round(COST.exampleFee * COST.share) / 100; }
  function officeLines() {
    return OFFICES.map(function (o) { return o.name + ' ' + o.addr + (o.tel ? ' (전화 ' + o.tel + ')' : ''); });
  }
  function telLine() {
    return OFFICES.filter(function (o) { return o.tel; }).map(function (o) { return o.name.replace('본사', '').replace('지사', '') + ' ' + o.tel; }).join(' · ');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function coName(c) { return String((c && c.debtorName) || '').replace(/\s+/g, ' ').trim(); }

  /* 안내문 한 장 — 회사명이 들어간다. 핵심은 두 가지: ① 대지급금 ② 회사 부담 12만원 */
  function buildLetter(c, opts) {
    opts = opts || {};
    var share = shareWon();
    return '<section class="letter">' +
      '<h1>회생절차 중 근로자 임금, 푸른노무법인이 도와드립니다</h1>' +
      '<p class="to">' + esc(coName(c)) + (c && c.ceoName ? ' ' + esc(c.ceoName) : '') + ' 대표이사님 귀하</p>' +
      '<p>안녕하십니까. ' + esc(FIRM.name) + '입니다. 법원 공고를 보고 회생절차 중 꼭 필요한 두 가지를 간단히 안내드립니다.</p>' +
      '<div class="big"><span class="no">1</span><div><b>임금을 받지 못한 근로자는 «간이대지급금·대지급금»을 법에서 정한 최대 금액까지, 빠르면 1개월 내 받을 수 있게 도와드립니다.</b>' +
      '<div class="max">간이대지급금 최대 <b>' + LIMIT.simple + '</b> · 도산대지급금 최대 <b>' + LIMIT.insolvency + '</b></div>' +
      '<div class="sub">체불임금·퇴직금 등 받을 수 있는 한도를 꼼꼼히 따져 근로복지공단 신청을 처음부터 끝까지 지원합니다. 실제 지급액은 연령·체불액·퇴직 시기에 따라 달라집니다(' + LIMIT.asOf + '). 근거: 임금채권보장법 제7조·제7조의2</div></div></div>' +
      '<div class="big"><span class="no">2</span><div><b>회사는 ' + share + '만원(+부가가치세)만 부담하시면 노무 상담·컨설팅을 받으실 수 있습니다.</b>' +
      '<div class="sub">정부 재기컨설팅 바우처가 ' + COST.support + '%를 지원합니다. ' + esc(FIRM.name) + '은 2026년 재기컨설팅(사업정리) 공급기업입니다.</div></div></div>' +
      '<h2>문의·상담 — 공인노무사가 직접 답해 드립니다</h2>' +
      '<p class="tel">' + esc(telLine()) + ' · ' + esc(FIRM.email) + '</p>' +
      '<table class="off">' + OFFICES.map(function (o) {
        return '<tr><th>' + esc(o.name) + '</th><td>' + esc(o.addr) + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="sign">' + esc(FIRM.name) + ' ' + esc(FIRM.rep) + '</p>' +
      '<p class="foot">비용 예) 노무 컨설팅 ' + COST.exampleFee + '만원 → 기업 자부담 ' + share + '만원 + 부가가치세 ' + share + '만원 (정부 지원 ' + COST.support + '% · 기업 자부담 ' + COST.share + '% + 부가가치세). ' +
      '비율·한도·신청 자격은 해당 연도 공고에 따라 달라질 수 있어 신청 가능 여부와 함께 확인해 드립니다(' + esc(COST.basis) + ' 기준). ' +
      '법원 회생 공고를 보고 보내드리는 1회 안내입니다. 원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다. 일반 정보이며, 구체적 판단은 상담으로 드립니다.' +
      (opts.draft ? ' ' + esc(COST.stamp) : '') + '</p>' +
      '</section>';
  }

  /* 메일 본문(글자 판) — 푸른 메일 쓰기 창에 «본문»으로 넣는다. 같은 내용을 글자로만.
     ⚠ 첨부는 URL 로 넘길 수 없다 — 본문에 안내문 내용이 그대로 들어가므로 첨부 없이도 읽힌다.
     opts.existing — 이미 거래·연결된 곳이면 첫 인사를 달리한다. opts.ceo — 대표자 이름을 알면 「○○○ 대표이사님」 */
  var MAIL_SUBJECT = '[' + FIRM.name + '] 회생절차 중 근로자 임금(대지급금) 및 노무 상담 안내';
  function buildPlainText(c, opts) {
    opts = opts || {};
    var share = shareWon();
    var to = coName(c) + ' ' + (opts.ceo ? opts.ceo + ' ' : '') + '대표이사님께';
    return [
      to, '',
      '안녕하십니까. ' + FIRM.name + '입니다.',
      opts.existing ? '평소 ' + FIRM.name + '과 거래해 주셔서 감사드립니다.' : '',
      '법원 공고를 보고 회생절차 중 꼭 필요한 두 가지를 간단히 안내드립니다.',
      '',
      '1. 임금을 받지 못한 근로자는 「간이대지급금·대지급금」을 법에서 정한 최대 금액까지, 빠르면 1개월 내 받을 수 있게 도와드립니다.',
      '   간이대지급금 최대 ' + LIMIT.simple + ' · 도산대지급금 최대 ' + LIMIT.insolvency + '까지 받을 수 있습니다(실제 지급액은 연령·체불액·퇴직 시기에 따라 달라집니다, ' + LIMIT.asOf + ').',
      '   체불임금·퇴직금 등 받을 수 있는 한도를 꼼꼼히 따져 근로복지공단 신청을 처음부터 끝까지 지원합니다. (임금채권보장법 제7조·제7조의2)',
      '',
      '2. 회사는 ' + share + '만원(+부가가치세)만 부담하시면 노무 상담·컨설팅을 받으실 수 있습니다.',
      '   정부 재기컨설팅 바우처가 ' + COST.support + '%를 지원합니다. ' + FIRM.name + '은 2026년 재기컨설팅(사업정리) 공급기업입니다.',
      '   (예: 노무 컨설팅 ' + COST.exampleFee + '만원 → 기업 자부담 ' + share + '만원 + 부가가치세 ' + share + '만원 [정부 지원 ' + COST.support + '% · 기업 자부담 ' + COST.share + '% + 부가가치세]. 비율·한도·신청 자격은 해당 연도 공고에 따라 달라질 수 있어 신청 가능 여부와 함께 확인해 드립니다. ' + COST.basis + ' 기준)',
      '',
      '문의·상담 — 공인노무사가 직접 답해 드립니다.',
      '전화 ' + telLine() + ' · 이메일 ' + FIRM.email,
      officeLines().map(function (x) { return x.replace(/ \(전화 [^)]*\)/, ''); }).join('\n'),
      FIRM.name + ' ' + FIRM.rep,
      '',
      '※ 법원 회생 공고를 보고 드리는 1회 안내입니다. 원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다.'
    ].filter(function (x, i, a) { return x !== '' || (a[i - 1] !== '' && i > 0); }).join('\n');
  }
  /* 푸른 메일 쓰기 창을 «주소줄로» 채울 때 쓰는 짧은 본문 — 주소줄이 길면(약 8KB) 서버가 거절한다.
     한글은 글자마다 9글자로 늘어나므로 본문을 600자 안팎으로 줄였다. 자세한 안내문은 PDF 로 저장해 첨부한다. */
  function buildMailBody(c, opts) {
    opts = opts || {};
    var share = shareWon();
    return [
      coName(c) + ' ' + (opts.ceo ? opts.ceo + ' ' : '') + '대표이사님께',
      '',
      '안녕하십니까. ' + FIRM.name + '입니다.' + (opts.existing ? ' 평소 거래해 주셔서 감사드립니다.' : ''),
      '법원 공고를 보고 두 가지를 안내드립니다.',
      '1. 임금을 받지 못한 근로자는 간이대지급금·대지급금을 법에서 정한 최대 금액까지, 빠르면 1개월 내 받을 수 있게 도와드립니다(간이대지급금 최대 ' + LIMIT.simple + ', 도산대지급금 최대 ' + LIMIT.insolvency + '; 임금채권보장법 제7조·제7조의2).',
      '2. 회사는 ' + share + '만원(+부가가치세)만 부담하시면 노무 상담·컨설팅을 받으실 수 있습니다(정부 바우처 ' + COST.support + '% 지원, 해당 연도 공고에 따름).',
      '',
      '상담: ' + telLine() + ' / ' + FIRM.email,
      OFFICES.map(function (o) { return o.name + ' ' + o.addr; }).join('\n'),
      FIRM.name + ' ' + FIRM.rep,
      '※ 원하지 않으시면 알려 주십시오 — 다시 보내지 않겠습니다.'
    ].join('\n');
  }
  /* 라벨 한 칸 — 본점 주소로 보낸다(송달주소는 대리인 사무실일 수 있다) */
  function buildLabel(c) {
    return '<div class="lb"><div class="zip">(우) ' + esc((c && c.zip) || '') + '</div>' +
      '<div class="ad">' + esc((c && c.address) || '') + '</div>' +
      '<div class="to">' + esc(coName(c)) + ' 귀중</div><div class="ceo">' + (c && c.ceoName ? '대표이사 ' + esc(c.ceoName) + ' 님 앞' : '대표이사님 앞') + '</div></div>';
  }

  var CSS =
    '@page{size:A4;margin:12mm 16mm}' +
    'body{margin:0;font-family:"Malgun Gothic",sans-serif;color:#1e293b}' +
    '.letter{font-size:11.5pt;line-height:1.5;break-after:page;page-break-after:always}' +
    '.letter:last-child{break-after:auto;page-break-after:auto}' +
    '.letter h1{font-size:19pt;margin:0 0 10pt;color:#1e40af}' +
    '.letter h2{font-size:11.5pt;margin:9pt 0 4pt;color:#1e40af;border-bottom:1px solid #bfdbfe;padding-bottom:2pt}' +
    '.letter p{margin:0 0 4pt}.letter ul{margin:0 0 5pt;padding-left:16pt}.letter li{margin:0 0 2pt}' +
    '.letter .to{font-size:11.5pt;font-weight:bold;margin:0 0 8pt}.letter .law{font-size:8.8pt;color:#475569}' +
    '.letter .box{background:#eff6ff;border:1px solid #bfdbfe;padding:6pt 9pt;margin:5pt 0}' +
    '.letter table.cost{border-collapse:collapse;width:100%;margin:4pt 0 4pt}' +
    '.letter table.cost th,.letter table.cost td{border:1px solid #cbd5e1;padding:2pt 6pt;font-size:9.3pt;text-align:left}' +
    '.letter table.cost th{background:#f8fafc}.letter .sign{margin-top:6pt;text-align:right;font-size:11pt}' +
    '.letter .big{display:flex;gap:10pt;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6pt;padding:10pt 12pt;margin:9pt 0;font-size:13pt;line-height:1.5}' +
    '.letter .big .no{flex:0 0 22pt;height:22pt;border-radius:50%;background:#1e40af;color:#ffffff;text-align:center;font-weight:bold;line-height:22pt;font-size:12pt}' +
    '.letter .big .sub{font-size:10pt;color:#475569;margin-top:3pt;font-weight:normal}' +
    '.letter .max{margin-top:4pt;font-size:12pt;font-weight:bold;color:#1e40af}' +
    '.letter .tel{font-size:13pt;font-weight:bold;margin:2pt 0 6pt}' +
    '.letter table.off{border-collapse:collapse;width:100%}.letter table.off th{width:62pt;text-align:left;font-size:10.5pt;padding:2pt 0;color:#1e40af}.letter table.off td{font-size:10.5pt;padding:2pt 0}' +
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
      (opts && opts.noPrint ? '' : '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>') + '</body></html>';
  }

  return { LIMIT: LIMIT, FIRM: FIRM, OFFICES: OFFICES, COST: COST, MAIL_SUBJECT: MAIL_SUBJECT, buildPlainText: buildPlainText, buildMailBody: buildMailBody, esc: esc, buildLetter: buildLetter, buildLetters: buildLetters, buildLabel: buildLabel,
    buildLabelSheets: buildLabelSheets, buildDocument: buildDocument, CSS: CSS };
});
