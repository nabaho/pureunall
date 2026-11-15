'use strict';
/* 뉴스레터 판례·행정해석·법령 — 국가법령정보센터 «공개 쪽»에서 읽는다 (2026-11-16 대표 「남은거 모두해라」)
   ═══════════════════════════════════════════════════════════════════════════
   법제처 DRF 가 공개 열쇠(OC=test)를 거절해(2026-10-09 무렵부터) 판례·행정해석·법령 소식·AI 교정 조문이 모두 막혔다.
   새 열쇠는 서버 IP 등록이 필요한데 클라우드 함수는 나가는 IP 가 고정이 아니다 → 열쇠 없이 열리는 사람용 쪽을 읽는다.
   아래 표본은 2026-11-16 실측한 쪽 모양을 줄인 것이다(판결문·법령해석은 저작권 대상이 아니다 — 저작권법 제7조).

   ■ 이 검사가 지키는 «규칙»
     ① 목록 — 한 줄에서 번호·사건명·법원·선고일·사건번호를 읽고, 미리보기 줄·검색어 강조는 섞지 않는다
     ② 한 건 — 공개 쪽을 «예전 XML 칸 모양»으로 바꿔, 한건읽기·편지 칸·전문 보기가 예전과 같은 결과를 낸다
     ③ 모양을 못 알아보면 «빈손» — 지어내지 않는다(모으개가 빈손을 «못 읽음»으로 세어 탈로 남긴다)
     ④ 법령 소식(브리핑)도 공개 쪽 — 링크는 우리가 숫자 번호로 짓는다
     ⑤ 뉴스레터 서버 길에는 거절되는 문(DRF·OC=test)을 부르는 곳이 남지 않는다
     ⑥ 모으개 밑감(homepage/newsBrief·newsDocs·newsPrec)은 서버만 쓴다 — 직원 쓰기를 닫는다
     ⑦ 자동화 점검 화면·포털 경고판은 «숫자로 시작하는 열쇠(회차)»만 읽는다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const NP = require('../functions/news-prec.js');
const NF = require('../functions/news-full.js');
const B = require('../functions/news-brief.js');
const { stripJs } = require('./strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), 'utf8').replace(/\r\n/g, '\n');

/* ── 표본 (2026-11-16 실측 모양) ── */
const 판례목록 = '<tbody><tr><td class="tNone" rowspan="2">1</td>'
  + '<td class="tit"> <a href="javascript:void(0);" onclick="precView(\'622111\',\'Y\');return false;"> 단체교섭청구의소[도급인이 사내하청업체 소속 근로자들이 속한 노동조합에 대하여 단체교섭의무를 부담하는지 문제 된 사건] <span> [대법원 2026. 5. 21. 선고 2018다296229 전원합의체 판결]</span> </a> </td></tr>'
  + '<tr><td class="tit"> <a href="javascript:void(0);" onclick="precView(\'622111\',\'Y\');return false;"> <p class="tx"> [1] 미리보기 줄 …</p> </a> </td></tr>'
  + '<tr><td class="tNone" rowspan="2">2</td>'
  + '<td class="tit"> <a href="javascript:void(0);" onclick="precView(\'605067\',\'Y\');return false;"> <strong class="tbl_tx_type"><strong class="tbl_tx_type">부당</strong><strong class="tbl_tx_type">해고</strong></strong>구제재심판정취소[금전보상명령신청의 구제이익 존부가 문제된 사건] <span> [대법원 2025. 3. 13. 선고 2024두54683 판결]</span> </a> </td></tr>'
  + '<tr><td class="tNone" rowspan="2">3</td>'
  + '<td class="tit"> <a href="javascript:void(0);" onclick="precView(\'622235\',\'Y\');return false;"> 징벌적손해배상 <span> [수원고등법원 2025. 12. 17. 선고 2025나11545 판결 : 확정]</span> </a> </td></tr></tbody>';

const 판례한건 = '<h1>국가법령정보센터</h1><div id="conTop" class="cont_top conTop"> <h2>퇴직금등</h2> <div class="ct_sub"> <span>[대법원 2026. 9. 3. 선고 2024다206043 판결]</span> </div> </div>'
  + '<div class="pgroup conScroll" id="conScroll02"> <h4 id="sa-625415">【판시사항】</h4> <p class="pty4"><br /> [1] 연차휴가미사용수당을 청구할 수 있는 경우 / 연차휴가를 사용할 권리는 전년도 1년간의 근로를 마친 다음 날 발생하는지 여부<strong>(원칙적 적극)</strong><br />[2] 둘째 판시</p>'
  + ' <h4 id="yo-625415">【판결요지】</h4> <p class="pty4"> [1] <a href="#AJAX" class="link" onclick="javascript:fncLawPop(\'근로기준법\',\'JO\',\'006000\',\'prec\');">근로기준법 제60조 제1항</a>이 규정한 유급 연차휴가는 1년간 80% 이상 출근한 근로자에게 부여되는 것으로 …</p>'
  + ' <h4 id="conLsJo-625415">【참조조문】</h4> <p class="pty4"> [1] <a href="#AJAX" class="link">근로기준법 제60조 제1항</a> <br /></p>'
  + ' <h4 id="conPrec-625415">【참조판례】</h4> <p class="pty4"> [1] 대법원 2017. 5. 17. 선고 2014다232296, 232302 판결(공2017상, 1249)<br /></p> <br />'
  + ' <h4 id="jun-625415">【전문】</h4> <h5>【원고, 상고인 겸 피상고인】</h5><p class="pty4_dep1"> 원고 1 외 5인<br /></p> <h5>【피고, 피상고인 겸 상고인】</h5><p class="pty4_dep1"> 근로복지공단<br /></p>'
  + ' <h5>【원심판결】</h5><p class="pty4_dep1"> 인천지법 2023. 12. 13. 선고 2023나55286 판결</p> <h5>【주 문】</h5><p class="pty4_dep1"> 원심판결 중 연차휴가미사용수당 청구 부분을 파기하고, 이 부분 사건을 인천지방법원에 환송한다.<br /><br /></p>'
  + ' <h5>【이 유】</h5><p class="pty4_dep1"> 상고이유를 판단한다. <br /> 1. 피고의 상고이유에 관한 판단</p> <div style="text-align:center"> 대법관 마용주(재판장) </div>'
  + ' <input type="hidden" id="fPrecSeq" name="fPrecSeq" value="625415" /> </div>';

const 해석목록 = '<tbody><tr> <td class="tNone">1</td> <td class="tit"> <a href="javascript:void(0);" onclick="expcView(\'343227\',\'Y\');return false;"> 민원인 - 평균임금이 통상임금보다 적은 경우 퇴직금 산정 방법(「근로자퇴직급여 보장법」 제8조제1항 등 관련) </a> </td>'
  + ' <td> 법제처 26-0209 </td> <td> 2026. 05. 26 </td> <td> 민원인 </td> </tr>'
  + '<tr> <td class="tNone">2</td> <td class="tit"> <a href="javascript:void(0);" onclick="expcView(\'343337\',\'Y\');return false;"> 민원인 - 공휴일 및 대체공휴일을 대체하여 유급으로 보장하는 특정한 근로일의 구체적 날짜가 서면합의에 포함되어야 하는지(「<strong class="tbl_tx_type">근로기준법</strong>」 제55조제2항 단서 등 관련) </a> </td>'
  + ' <td> 법제처 26-0343 </td> <td> 2026. 06. 16 </td> <td> </td> </tr></tbody>';

const 해석한건 = '<h2>민원인 - 평균임금이 통상임금보다 적은 경우 퇴직금 산정 방법(「근로자퇴직급여 보장법」 제8조제1항 등 관련)</h2> <div class="ct_sub"> <span> [법제처 26-0209, 2026. 5. 26., 민원인] </span> </div>'
  + ' <h4 id="sa">【질의요지】</h4> <p class="pty4"> <a href="#AJAX" class="link">「근로자퇴직급여 보장법」</a> 제8조제1항에 따른 퇴직금을 산정할 때 평균임금이 통상임금보다 적으면 어떻게 하는지?</p>'
  + ' <h4 id="yo">【회답】</h4> <p class="pty4"> 이 사안의 경우, <a href="#AJAX" class="link">「근로기준법」 제2조제2항</a>에 따라 통상임금을 평균임금으로 하여 퇴직금을 산정하여야 합니다.<br /> </p>'
  + ' <h4 id="conLsJo">【이유】</h4> <p class="pty4"> 먼저 「근로기준법」 제2조에서는 평균임금의 산출 방법에 관하여 규정하면서 …</p> <br />'
  + ' <h4 id="expcNotice">【법제처 법령해석의 효력 등에 대한 안내】</h4> <p>안내 글</p>';

const 법령목록 = '<tbody> <tr> <td class="tNone">1</td> <td class="tit"> <a href="javascript:void(0);" onclick="lawInfoPop(\'285279\',\'20260407\',\'21436\', \'20261008\', \'Y\' ,\'0\',\'\',\'\',\'\',\'\'); return false;"> <strong class="tbl_tx_type">근로</strong>기준법 </a> </td>'
  + ' <td class="1">2026. 4. 7.</td> <td class="2"><p>법률</p></td> <td class="3"><p>제21436호</p></td> <td> 2026. 10. 8. </td> <td>일부개정</td> <td><p>고용노동부</p></td> </tr>'
  + ' <tr> <td class="tNone">2</td> <td class="tit"> <a href="javascript:void(0);" onclick="lawInfoPop(\'270551\',\'20250408\',\'35428\', \'20251023\', \'Y\' ,\'0\',\'\',\'\',\'\',\'\'); return false;"> 근로기준법 시행령 </a> </td>'
  + ' <td class="1">2025. 4. 8.</td> <td class="2"><p>대통령령</p></td> <td class="3"><p>제35428호</p></td> <td> 2025. 10. 23. </td> <td>일부개정</td> <td><p>고용노동부</p></td> </tr> </tbody>';

/* ═══ ① 목록 ═══ */

test('★★★ ① 판례 목록 — 한 줄에서 번호·사건명·법원·선고일·사건번호 · 미리보기 줄과 강조는 섞지 않는다', () => {
  const L = NP.목록읽기(판례목록);
  assert.strictEqual(L.length, 3, '미리보기 줄을 한 건으로 세었거나 줄을 놓쳤다');
  assert.deepStrictEqual(L.map((x) => x.일련번호), ['622111', '605067', '622235']);
  assert.strictEqual(L[0].법원, '대법원');
  assert.strictEqual(L[0].선고일, '2026-05-21');
  assert.strictEqual(L[0].사건번호, '2018다296229', '「전원합의체 판결」이 사건번호에 섞였다');
  assert.match(L[0].판결유형, /전원합의체/);
  assert.match(L[1].사건명, /^부당해고구제재심판정취소\[/, '검색어 강조 태그가 사건명을 끊었다');
  assert.strictEqual(L[2].사건번호, '2025나11545', '「: 확정」이 사건번호에 섞였다');
  assert.strictEqual(L[2].법원, '수원고등법원');
});

test('★★ ① 판결 꼬리 — 결정(…자)도 읽는다 · 번호가 없으면 못 읽은 것', () => {
  assert.deepStrictEqual(NP.판례꼬리풀기('[대법원 2025. 3. 4.자 2024마1234 결정]'),
    { 법원: '대법원', 선고일: '2025-03-04', 사건번호: '2024마1234', 판결유형: '결정' });
  assert.strictEqual(NP.판례꼬리풀기('[대법원 판결]'), null);
  assert.strictEqual(NP.판례꼬리풀기(''), null);
});

test('★★★ ① 해석 목록 — 번호·안건명·안건번호·회신일·질의기관', () => {
  const L = NP.해석목록읽기(해석목록);
  assert.strictEqual(L.length, 2);
  assert.deepStrictEqual(L[0], { 일련번호: '343227', 안건명: '민원인 - 평균임금이 통상임금보다 적은 경우 퇴직금 산정 방법(「근로자퇴직급여 보장법」 제8조제1항 등 관련)',
    안건번호: '26-0209', 회신일: '2026-05-26', 회신기관: '법제처', 질의기관: '민원인' });
  assert.ok(L[1].안건명.indexOf('「근로기준법」 제55조') >= 0, '검색어 강조 태그가 안건명에 남았다');
  /* 이미 모은 것 빼기·같은 물음 거르기는 예전 잣대 그대로 탄다 */
  assert.strictEqual(NP.해석추리기(L, 4)[0].일련번호, '343337', '최근 회신 차례가 아니다');
});

/* ═══ ② 한 건 ═══ */

test('★★★ ② 판례 한 건 — 예전 칸 모양 그대로 → 편지 한 칸', () => {
  const one = NP.한건읽기(판례한건, '625415');
  assert.ok(one, '공개 쪽 한 건을 못 읽었다');
  assert.strictEqual(one.일련번호, '625415');
  assert.strictEqual(one.사건명, '퇴직금등', '쪽 머리(h1 따위)를 사건명으로 집었다');
  assert.strictEqual(one.사건번호, '2024다206043');
  assert.strictEqual(one.선고일, '2026-09-03');
  assert.match(one.판시사항, /^\[1\] 연차휴가미사용수당을 청구할 수 있는 경우/, '판시사항 앞에 빈 줄·태그가 남았다');
  assert.match(one.판시사항, /여부\(원칙적 적극\)\n\[2\] 둘째 판시$/, '꾸밈 태그 자리에 빈칸이 생겼거나 줄을 잃었다');
  assert.match(one.판결요지, /^\[1\] 근로기준법 제60조 제1항이 규정한/);
  assert.strictEqual(one.참조조문, '[1] 근로기준법 제60조 제1항');
  assert.ok(NP.노무판례인가(one));
  const 칸 = NP.판례로만들기(one);
  assert.strictEqual(칸.인용, '대법원 2024다206043 (2026. 9. 3.)');
  assert.strictEqual(칸.링크, 'https://www.law.go.kr/LSW/precInfoP.do?precSeq=625415');
  assert.ok(!/\[1\]/.test(칸.제목), '갈색 상자 머리글에 번호가 남았다');
  /* 번호를 안 주면 숨은 칸에서 찾는다 */
  assert.strictEqual(NP.한건읽기(판례한건).일련번호, '625415');
});

test('★★★ ② 해석 한 건 — 질의요지·회답·이유, 안내 글은 이유에 섞지 않는다', () => {
  const one = NP.해석한건읽기(해석한건, '343227');
  assert.ok(one);
  assert.strictEqual(one.안건번호, '26-0209');
  assert.strictEqual(one.회신일, '2026-05-26');
  assert.strictEqual(one.회신기관, '법제처');
  assert.strictEqual(one.질의기관, '민원인');
  assert.match(one.회답, /^이 사안의 경우, 「근로기준법」 제2조제2항에 따라/);
  assert.ok(one.이유.indexOf('안내 글') < 0, '다음 칸(효력 안내)까지 이유에 붙였다');
  const 칸 = NP.해석으로만들기(one);
  assert.strictEqual(칸.딱지, '[행정해석]');
  assert.strictEqual(칸.제목, '평균임금이 통상임금보다 적은 경우 퇴직금 산정 방법');
  assert.strictEqual(칸.링크, 'https://www.law.go.kr/LSW/expcInfoP.do?expcSeq=343227');
});

test('★★★ ② 전문 보기 — 공개 쪽을 받아 «푸른 양식»으로 편다(주문이 맨 위, 이유는 접힘)', () => {
  const 것 = NF.풀기('prec', 판례한건);
  assert.strictEqual(것.ok, true, '공개 쪽을 못 폈다 — 받는 분이 다시 법제처 쪽으로 넘어간다');
  assert.strictEqual(것.제목, '퇴직금등');
  assert.strictEqual(것.인용, '대법원 2024다206043 (2026. 9. 3.)');
  assert.strictEqual(것.칸들[0].이름, '주문', '결론(주문)이 맨 위가 아니다');
  assert.match(것.칸들[0].글, /파기하고, 이 부분 사건을 인천지방법원에 환송한다/);
  const 이유 = 것.칸들.find((c) => c.이름 === '판결 이유');
  assert.ok(이유 && 이유.접기, '긴 이유가 접혀 있지 않다');
  const 해 = NF.풀기('expc', 해석한건);
  assert.strictEqual(해.ok, true);
  assert.deepStrictEqual(해.칸들.map((c) => c.이름), ['질의요지', '회답', '이유']);
  assert.strictEqual(해.인용, '법제처 26-0209 (2026. 5. 26.)');
  /* 받아 읽는 곳 = 사람이 보는 공개 쪽(열쇠 없음) */
  assert.strictEqual(NF.받을주소('prec', '625415'), NF.법제처주소('prec', '625415'));
});

test('★★ ② 공개 쪽 글자의 꺾쇠·&는 그대로 돌아온다(태그로 먹히지 않는다)', () => {
  const 쪽 = 판례한건.replace('둘째 판시', '둘째 판시 &lt;개정 2020. 3. 31.&gt; A&amp;B');
  assert.match(NP.한건읽기(쪽, '1').판시사항, /둘째 판시 <개정 2020\. 3\. 31\.> A&B$/);
});

/* ═══ ③ 모양을 못 알아보면 빈손 ═══ */

test('★★★ ③ 모양을 못 알아보면 «빈손» — 지어내지 않는다', () => {
  ['', '<html><body>시스템 점검 중입니다</body></html>', '<h2>제목만</h2>', '<p>국가법령정보 공동활용 페이지 접속에 실패하였습니다.</p>']
    .forEach((쪽) => {
      assert.deepStrictEqual(NP.목록읽기(쪽), [], '목록을 지어냈다: ' + 쪽);
      assert.deepStrictEqual(NP.해석목록읽기(쪽), []);
      assert.strictEqual(NP.한건읽기(쪽, '1'), null, '판례 한 건을 지어냈다: ' + 쪽);
      assert.strictEqual(NP.해석한건읽기(쪽, '1'), null);
      assert.strictEqual(NF.풀기('prec', 쪽).ok, false, '전문 보기가 빈 쪽을 폈다');
    });
});

/* ═══ ④ 법령 소식(브리핑) ═══ */

test('★★★ ④ 법령 목록 — 공개 쪽 한 줄을 읽고, 링크는 숫자 번호로 우리가 짓는다', () => {
  const L = B.법령읽기(법령목록);
  assert.strictEqual(L.length, 2);
  assert.deepStrictEqual(L[0], { 이름: '근로기준법', 구분: '법률', 고친결: '일부개정', 공포일: '20260407', 시행일: '20261008',
    부처: '고용노동부', 링크: '/LSW/lsInfoP.do?lsiSeq=285279' });
  assert.strictEqual(B.날짜꼴(L[0].공포일), '2026-04-07');
  assert.match(B.공개법령목록주소('근로', 5), /^https:\/\/www\.law\.go\.kr\/LSW\/lsSc\.do\?[^#]*selSort=20desc[^#]*&query=%EA%B7%BC%EB%A1%9C$/,
    '공포일 내림차순이 아니거나 검색어를 감싸지 않았다');
  assert.ok(!/OC=|\/DRF\//.test(B.공개법령목록주소('근로', 5)));
  assert.deepStrictEqual(B.법령읽기('<p>점검 중</p>'), []);
});

/* ═══ ⑤ 거절되는 문을 더 부르지 않는다 ═══ */

test('★★★ ⑤ 뉴스레터 서버 길에는 DRF·OC=test 를 부르는 곳이 남지 않는다', () => {
  const 서버 = stripJs(읽기('functions/index.js')).replace(/\r\n/g, '\n');
  ['news-prec.js', 'news-full.js', 'news-brief.js', 'news-watch.js'].forEach((f) => {
    const 몸 = stripJs(읽기('functions/' + f));
    assert.ok(!/OC=test|\/DRF\/law(Search|Service)\.do/.test(몸.replace(/거절인가[\s\S]*?\n\}/, '')),
      '★★★ ' + f + ' 가 아직 거절되는 문을 부른다');
  });
  assert.ok(!/OC=test/.test(서버), '★★★ functions/index.js 가 아직 OC=test 로 부른다(판례·법령·조문 가운데 어디)');
  [NP.목록주소('근로', 5), NP.한건주소('1'), NP.해석목록주소('근로', 5), NP.해석한건주소('1')].forEach((u) => {
    assert.match(u, /^https:\/\/www\.law\.go\.kr\/LSW\//, '공개 쪽이 아니다: ' + u);
  });
  assert.strictEqual(NP.한건주소('62a5;x'), 'https://www.law.go.kr/LSW/precInfoP.do?precSeq=625', '번호에 숫자 말고 다른 글자가 끼었다');
  assert.match(NP.목록주소('부당해고', 5), /selSort1=2&selSort2=DESC/, '선고일 내림차순이 아니다 — 새 판례에 차례가 안 온다');
});

/* ═══ ⑥ 모으개 밑감은 서버만 쓴다 ═══ */

test('★★ ⑥ homepage/newsBrief·newsDocs·newsPrec — 쓰기는 총괄관리자(+서버)만, 읽기는 그대로', () => {
  const 규칙 = JSON.parse(읽기('docs/firebase-rules-전체-적용본.json')).rules;
  const 관리자 = 규칙.homepage['.write'];
  ['newsBrief', 'newsDocs', 'newsPrec'].forEach((k) => {
    assert.ok(규칙.homepage[k], '★★ ' + k + ' 가 $part(재직 직원 쓰기)를 탄다 — 「탈」 칸에 아무 글이나 적힌다');
    assert.strictEqual(규칙.homepage[k]['.write'], 관리자, k + ' 쓰기가 총괄관리자보다 넓다');
    assert.ok(!('.read' in 규칙.homepage[k]), k + ' 읽기를 따로 바꿨다(보는 사람은 그대로여야 한다)');
  });
  /* 화면은 그 자리에 쓰지 않는다 — 쓰면 막히므로 그물로 본다 */
  const 화면 = 읽기('pu-news.html');
  assert.ok(!/ref\(['"]homepage\/news(Brief|Docs|Prec)[^'"]*['"]\)\s*\.(set|update|push|remove)\(/.test(화면), '뉴스레터 화면이 모으개 밑감에 쓴다 — 규칙이 막는다');
});

/* ═══ ⑦ 회차 열쇠만 읽는다 ═══ */

test('★★ ⑦ 자동화 점검 화면·포털 경고판 — 숫자로 시작하는 열쇠(회차)만 읽는다', () => {
  const 화면 = 읽기('pu-news.html');
  const 서버 = 읽기('functions/index.js');
  const 화 = /db\.ref\('newsletter\/watch'\)\.orderByKey\(\)\.endAt\('9\\uf8ff'\)\.limitToLast\(\d\)/.test(화면);
  const 서 = /db\.ref\("newsletter\/watch"\)\.orderByKey\(\)\.endAt\("9\\uf8ff"\)\.limitToLast\(\d\)/.test(서버);
  assert.ok(화 && 서, '★★ «현재» 같은 글자 열쇠가 늘면 회차가 읽는 창 밖으로 밀린다(화면 ' + 화 + ' · 서버 ' + 서 + ')');
});
