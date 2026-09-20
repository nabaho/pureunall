/* 판례·행정해석 «전문» 을 그 자리에서 펴 준다 — 판단하는 층 (인터넷을 모른다)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-18:
   「판례 전문보기 클릭하면 이렇게 창으로 넘어간다. 그러면 읽고 보는게 더힘들다.
     전문보기하면 처음화면에서 전문으로 다 내려오게만 만들어야된다.
     캡쳐1 화면에서 모두 보이는것이다 새창으로 안가고」

   ★ 종전에는 「전문 보기 ↗」가 법제처 쪽으로 넘어갔다. 거기는 우리가 만든 쪽이 아니라
     글자가 빽빽하고, 읽던 자리로 돌아오려면 탭을 닫아야 한다. 읽는 흐름이 끊긴다.
   ★ 이제 그 자리에서 «펴서» 보여 준다. 법제처 문(DRF)에서 그때그때 받아 온다.

   ⚠⚠ 판결문·법령해석은 «저작물이 아니다»(저작권법 제7조 제3호·제4호).
     그래서 우리 쪽에 실어도 된다. ★ 뉴스 기사는 «아니다» — 남의 저작물이라
     여기로 가져오면 안 된다(대표 지시 2026-09-08 「그대로 나오게 하면 문제가 된다」).
     이 문은 법제처(prec·expc)만 연다. 다른 곳을 붙이지 말 것.

   ⚠ 여기 담아 두지 «않는다». 회차에 전문을 통째로 넣으면 담아 둔 전문이 몇 배가 되고
     (지금 28KB), 지난 회차는 어차피 못 채운다. 받아 올 때 받는다.
   ⚠ 못 받아 오면 «법제처에서 보기» 링크로 물러선다 — 못 읽는 것보다 낫다. */
'use strict';

const NP = require('./news-prec.js');

/* 열 수 있는 문은 둘뿐이다. 그 밖은 «없는 것»으로 답한다.
   ⚠ 여기를 넓히면 남의 서버로 아무 주소나 부르게 하는 문이 된다(SSRF). */
function 갈래고르기(t) {
  const s = String(t == null ? '' : t).trim();
  return (s === 'prec' || s === 'expc') ? s : '';
}

/* 물음 읽기 — 번호는 «숫자만». 주소를 우리가 짓고, 받은 글자는 안 끼운다. */
function 읽기(q) {
  const o = (q && typeof q === 'object') ? q : {};
  const 갈래 = 갈래고르기(o.t);
  const 번호 = String(o.id == null ? '' : o.id).trim();
  return { 갈래: 갈래, 번호: 번호, ok: !!갈래 && /^\d{1,12}$/.test(번호) };
}

function 받을주소(갈래, 번호) {
  return 갈래 === 'expc' ? NP.해석한건주소(번호) : NP.한건주소(번호);
}
function 법제처주소(갈래, 번호) {
  return 갈래 === 'expc' ? NP.해석보는주소(번호) : NP.보는주소(번호);
}

/* 한 칸의 글자 한도. 판결 전문은 드물게 십만 자가 넘는다 — 그대로 내보내면
   받는 쪽 브라우저가 멎는다. 자르고 «잘렸다»고 밝힌다(숨기면 끝난 줄 안다). */
const 칸한도 = 60000;

function 자르기(s) {
  const t = String(s == null ? '' : s).trim();
  return t.length > 칸한도
    ? { 글: t.slice(0, 칸한도).trim(), 잘림: true }
    : { 글: t, 잘림: false };
}

/* 어느 칸을 어떤 이름으로 보이나 — 판례와 해석례는 담는 칸이 다르다.
   판례: 판시사항·판결요지·참조조문·판례내용(전문)
   해석례: 질의요지(무엇을 물었나)·회답(무엇이라 답했나)·이유 */
const 칸차림 = {
  prec: [['판시사항', '판시사항'], ['판결요지', '판결요지'],
    ['참조조문', '참조조문'], ['판례내용', '판결 전문']],
  expc: [['질의요지', '질의요지'], ['회답', '회답'], ['이유', '이유']]
};

/* 머리에 적을 한 줄 — 무엇을 보고 있는지. 없으면 안 적는다(빈 줄을 만들지 않는다). */
function 머리글(갈래, xml) {
  const 뽑 = (t) => NP.뽑기(xml, t);
  if (갈래 === 'expc') {
    return {
      제목: 뽑('안건명'),
      인용: [뽑('해석기관명'), 뽑('안건번호')].filter(Boolean).join(' ')
        + (NP.날짜꼴(뽑('해석일자')) ? ' (' + NP.선고꼴(뽑('해석일자')) + ')' : '')
    };
  }
  return {
    제목: 뽑('사건명'),
    인용: [뽑('법원명'), 뽑('사건번호')].filter(Boolean).join(' ')
      + (NP.날짜꼴(뽑('선고일자')) ? ' (' + NP.선고꼴(뽑('선고일자')) + ')' : '')
  };
}

/* 받아 온 XML 을 «보여 줄 칸들»로 바꾼다.
   ⚠ 빈 칸은 안 만든다 — 이름만 있고 아래가 빈 칸은 「못 받아 왔나」로 읽힌다.
   ⚠ 한 칸도 못 건지면 ok:false — 그때는 법제처 링크로 물러선다. */
function 풀기(갈래, xml) {
  const g = 갈래고르기(갈래);
  if (!g) return { ok: false, 까닭: '갈래' };
  const s = String(xml == null ? '' : xml);
  if (!s.trim()) return { ok: false, 까닭: '빈답' };
  let 잘림 = false;
  const 칸들 = [];
  (칸차림[g] || []).forEach(function (한벌) {
    const 것 = 자르기(NP.뽑기(s, 한벌[0]));
    if (!것.글) return;
    if (것.잘림) 잘림 = true;
    칸들.push({ 이름: 한벌[1], 글: 것.글, 잘림: 것.잘림 });
  });
  if (!칸들.length) return { ok: false, 까닭: '빈답' };
  const 머 = 머리글(g, s);
  return { ok: true, 갈래: g, 제목: 머.제목, 인용: (머.인용 || '').trim(),
    칸들: 칸들, 잘림: 잘림 };
}

const 까닭말 = {
  갈래: '읽을 수 없는 자리입니다.',
  번호: '읽을 수 없는 자리입니다.',
  빈답: '법제처에서 내용을 받지 못했습니다.',
  못받음: '지금 법제처에서 받아 오지 못했습니다.'
};

/* ══════════════════════════════════════════════════════════════════════════
   ★★★ 「전문 보기」를 «따로 열어도» 법제처 원문이 아니라 우리 양식으로 (대표 지시
     2026-09-20 「판례등 전문보기는 판례정보를 그대로 넣지말고 푸른양식으로 정리해라」)
   ══════════════════════════════════════════════════════════════════════════
   ⚠⚠ news-view.js 가 이미 «그 자리에서 펴는» 손잡이를 갖고 있다(2026-09-18) —
     정상 클릭이면 편지 안에서 펴진다. 그런데 그 손잡이의 href «자체»가 그때까지도
     법제처 원문이었다. 가운데 클릭·Ctrl+클릭·오른쪽 버튼 「새 탭에서 열기」처럼
     click 손잡이를 «거치지 않는» 열기는 그대로 법제처로 간다 — 대표께서 실제로
     그렇게 열어 보시고 겪으신 자리가 이것이다.
   ★ 그래서 손잡이 href 자체를 이 쪽(newsFullPage, functions/index.js)으로 바꾼다.
     정상 클릭은 그대로 편지 안에서 펴지고(안 바뀜), 그 밖의 모든 열기는 이제
     «우리 서버가 지은 이 쪽»이 열린다. 법제처는 이 쪽 맨 아래 한 줄로만 남는다.
   ⚠ 여기 그리는 것도 news-view.js 의 「그 자리에서 펴는」 것과 «같은 정보»(NF.풀기의
     칸들)를 쓴다 — 화면마다 다른 것을 보여 주면 안 된다. 모양만 «온 쪽 하나»로 편다.
   ⚠⚠ 남의 XML 에서 뽑은 글자를 esc() 없이 심으면 안 된다 — 법제처 응답에 태그가
     섞여 오면(실제로 판시사항에 <p> 가 섞여 온 적이 있다) 그대로 심는 순간
     우리 쪽에서 그 글자가 돈다. 반드시 «씻어서» 심는다. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function 줄(s) { return esc(s).replace(/\r?\n/g, '<br>'); }

/* 두 쪽(정상·오류)이 «같은 껍데기»를 쓴다 — 하나만 고치면 반쪽만 우리 얼굴이 된다. */
function _껍데기(제목, 속) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(제목) + '</title>'
    + '<meta name="robots" content="noindex">'
    + '<style>html,body{margin:0;padding:0;background:#e9e7e3;'
    + "font-family:'Malgun Gothic',sans-serif}"
    + '#wrap{max-width:700px;margin:0 auto;background:#fff;padding:26px 24px 30px}'
    + '.mk{font:bold 10px Georgia,\'Times New Roman\',serif;letter-spacing:3px;'
    + 'color:#8a6f57;text-align:center}'
    + '.nm{text-align:center;font-size:19px;font-weight:bold;color:#241a13;'
    + 'letter-spacing:-0.3px;margin-top:6px;padding-bottom:16px;'
    + 'border-bottom:2px solid #241a13}'
    + '.tt{margin-top:18px;font-weight:bold;font-size:16px;line-height:1.5;'
    + 'color:#241a13;word-break:keep-all}'
    + '.ct{margin-top:4px;font-size:12.5px;color:#9a938a}'
    + 'h4{margin:20px 0 6px;font-size:11.5px;letter-spacing:1.5px;color:#8a6f57;'
    + 'font-weight:bold}'
    + '.p{font-size:13.5px;line-height:1.85;color:#33302c;word-break:keep-all}'
    + '.cut{margin-top:8px;font-size:12px;color:#9a938a}'
    + '.src{margin-top:26px;padding-top:14px;border-top:1px solid #e0dcd6;'
    + 'font-size:12px;color:#9a938a}'
    + '.src a{color:#1b3a6b;font-weight:bold;text-decoration:none}'
    + '.err{font-size:13.5px;color:#8a837a;padding:10px 0}'
    + '</style></head><body><div id="wrap">'
    + '<div class="mk">PUREUN LABOR LAW FIRM</div>'
    + '<div class="nm">푸른노무법인</div>'
    + 속 + '</div></body></html>';
}

/* 정상 쪽 — NF.풀기() 가 내준 「것」 하나를 그대로 그린다.
   ⚠ 여기서 다시 법제처를 두드리지 않는다 — 부르는 쪽(functions/index.js)이 이미
     받아 풀어서 넘긴다. 이 함수는 «인터넷을 모른다»(파일 맨 위 규칙). */
function 쪽(것, 법제처) {
  var 제목 = String((것 && 것.제목) || '') || (것 && 것.갈래 === 'expc' ? '행정해석' : '판례');
  var 속 = '<div class="tt">' + esc(제목) + '</div>';
  if (것 && 것.인용) 속 += '<div class="ct">' + esc(것.인용) + '</div>';
  (것 && 것.칸들 || []).forEach(function (k) {
    속 += '<h4>' + esc(k.이름) + '</h4><div class="p">' + 줄(k.글)
      + (k.잘림 ? '<div class="cut">… 너무 길어 여기까지만 보여 드립니다. '
          + '아래 「법제처에서 원문 보기」로 다 보실 수 있습니다.</div>' : '')
      + '</div>';
  });
  속 += '<div class="src"><a href="' + esc(법제처 || '') + '" target="_blank" rel="noopener">'
    + '법제처에서 원문 보기 ↗</a></div>';
  return _껍데기(제목 + ' — 푸른노무법인', 속);
}

/* 못 받아 온 쪽 — «빈 법제처 화면»이 아니라 이것도 우리 얼굴로 낸다. */
function 오류쪽(말, 법제처) {
  var 속 = '<div class="err">' + esc(말 || '내용을 받아 오지 못했습니다.') + '</div>'
    + '<div class="src"><a href="' + esc(법제처 || '') + '" target="_blank" rel="noopener">'
    + '법제처에서 원문 보기 ↗</a></div>';
  return _껍데기('푸른노무법인', 속);
}

module.exports = {
  갈래고르기: 갈래고르기, 읽기: 읽기, 받을주소: 받을주소, 법제처주소: 법제처주소,
  자르기: 자르기, 풀기: 풀기, 머리글: 머리글, 까닭말: 까닭말, 칸한도: 칸한도,
  쪽: 쪽, 오류쪽: 오류쪽
};
