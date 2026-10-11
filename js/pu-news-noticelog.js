/* 안내문 발송 대장 — 화면(뉴스레터 › 안내문 탭의 «지난 안내문»)이 쓰는 순수 도우미
   ═════════════════════════════════════════════════════════════════════════════
   대표 지시(2026-10-11): 「다음메일함에서 비정기적으로 자문사에 안내문을 보낸적이 많이 있다 … 파일이 언제 어떤내용으로
   보냈는지 확인이 되어야 한다」 → 목업 A(안내문별)·B(파일별) → 「추천대로」.

   서버(functions/news-notice-log.js)가 매일 새벽 newsletter/noticeLog/items 에 정리해 두면, 화면은 그것을 «읽어서»
   안내문별 목록 · 파일별 목록 · 칩 · 대장(CSV) 으로 보여 준다. 여기에는 DOM 도 DB 도 없다 — 검사가 그대로 돌려 본다.

   ★ 대장 항목 꼴(서버가 적는 것): { 제목, 날짜, 날짜들[], 시각, 구분, 미리보기, 첨부[], 이름없는첨부, 받는주소수, 한통최대,
     업체[], 명함업체[], 업체미확인, 폴더들[{이름,수}], 메일줄수, 복사본수, 참조[{칸,번호}], 사라짐? }
   ⚠ 받는 «주소»는 대장에 없다 — 여기서도 만들지 않는다(업체 이름·수만).
   ⚠ 실시간DB 는 빈 배열·빈 글자를 안 담는다 — 없는 칸은 «빈 값»으로 읽는다(읽을 때마다 방어). */
(function (global) {
  'use strict';

  var 요일들 = '일월화수목금토';
  var 폴더이름 = { 'Sent Messages': '보낸편지함', 'Drafts': '임시보관함', 'INBOX': '받은편지함', 'Archive': '보관함' };

  /* 실시간DB 는 배열을 «번호 열쇠 객체»로 줄 때도 있다 */
  function 배열로(x) {
    if (!x || typeof x !== 'object') return [];
    if (Array.isArray(x)) return x;
    return Object.keys(x).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return x[k]; });
  }
  function 글(x) { return x == null ? '' : String(x); }
  function 수(x) { var n = Number(x); return isFinite(n) ? n : 0; }

  /* '2026-10-02' → '10-02(금)' (연도까지 «2026-10-02(금)» 은 길게) — 날짜가 이상하면 빈 글자 */
  function 요일말(날짜, 길게) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(글(날짜));
    if (!m) return '';
    var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return '';
    return (길게 ? m[1] + '-' : '') + m[2] + '-' + m[3] + '(' + 요일들.charAt(d.getUTCDay()) + ')';
  }

  /* 목록 딱지용 짧은 구분 이름과 «뜻으로 가른 색»(blue=알림·공문 / amber=확인·제도 / green=인사 / gray=그 밖) */
  var 짧은구분들 = { '공휴일 안내': ['공휴일', 'b'], '명절·새해 인사': ['인사', 'k'], '판결·법령 안내': ['판결·법령', 'a'],
    '지원사업·제도 안내': ['지원·제도', 'a'], '교육·행사 안내': ['교육', 'b'], '기타 안내': ['기타', 'g'] };
  function 짧은구분(구분) { var v = 짧은구분들[글(구분)]; return v ? { 이름: v[0], 색: v[1] } : { 이름: 글(구분) || '안내', 색: 'g' }; }

  /* 맨 앞 «[푸른노무법인] » 머리말은 목록에서는 걷는다(상세 제목에는 그대로) */
  function 짧은제목(제목) { return 글(제목).replace(/^\s*\[푸른노무법인(?:\s*안내)?\]\s*/, '').trim() || 글(제목); }

  /* 열쇠 → 항목을 «목록»으로. 최근 것이 위. 객체가 아닌 값은 건너뛴다 */
  function 목록(항목들) {
    return Object.keys(항목들 || {}).map(function (id) {
      var x = 항목들[id];
      return (x && typeof x === 'object') ? Object.assign({ id: id }, x) : null;
    }).filter(Boolean).sort(function (a, b) {
      return (수(b.시각) - 수(a.시각)) || (글(b.날짜) < 글(a.날짜) ? -1 : 글(b.날짜) > 글(a.날짜) ? 1 : 0);
    });
  }

  /* ── 연도 칩: 전체 · 최근 3개 연도 · «그 이전» — 대표 목업 「전체 23 · 2026 5 · 2025 6 · 2024 7 · 2023 이전 5」 ── */
  function 연도(항목) { return 글(항목.날짜).slice(0, 4); }
  function 연칩(줄들) {
    var 해들 = 줄들.map(연도).filter(function (y) { return /^\d{4}$/.test(y); });
    if (!해들.length) return [{ 키: '', 이름: '전체', 수: 줄들.length }];
    var 최신 = Math.max.apply(null, 해들.map(Number));
    var 칩 = [{ 키: '', 이름: '전체', 수: 줄들.length }];
    [0, 1, 2].forEach(function (i) {
      var y = String(최신 - i);
      var n = 줄들.filter(function (x) { return 연도(x) === y; }).length;
      if (n) 칩.push({ 키: y, 이름: y, 수: n });
    });
    var 이전 = 줄들.filter(function (x) { var y = Number(연도(x)); return y && y < 최신 - 2; }).length;
    if (이전) 칩.push({ 키: '이전', 이름: (최신 - 3) + ' 이전', 수: 이전 });
    return 칩;
  }
  /* 목록 «전체»를 보고 거른다 — «이전»은 (최신 연도 − 3) 이하라서 전체의 최신 연도를 알아야 한다 */
  function 연거르기(줄들, 키) {
    if (!키) return 줄들.slice();
    if (키 !== '이전') return 줄들.filter(function (x) { return 연도(x) === 키; });
    var 해들 = 줄들.map(function (x) { return Number(연도(x)); }).filter(Boolean);
    var 최신 = Math.max.apply(null, 해들);
    return 줄들.filter(function (x) { var y = Number(연도(x)); return y && y < 최신 - 2; });
  }

  /* ── 파일 ── */
  function 확장자(이름) { var m = /\.([A-Za-z0-9]{1,6})$/.exec(글(이름).trim()); return m ? m[1].toLowerCase() : ''; }
  var 종류들 = { pdf: 'PDF', hwp: '한글', hwpx: '한글', xls: '엑셀', xlsx: '엑셀', xlsm: '엑셀', csv: '엑셀', doc: '워드', docx: '워드',
    ppt: '파워포인트', pptx: '파워포인트', jpg: '그림', jpeg: '그림', png: '그림', zip: '압축' };
  var 아이콘들 = { 'PDF': '📕', '한글': '📝', '엑셀': '📊', '워드': '📘', '파워포인트': '📙', '그림': '🖼', '압축': '🗜' };
  function 종류말(확장) { return 종류들[확장] || '기타'; }
  function 아이콘(확장) { return 아이콘들[종류말(확장)] || '📄'; }

  /* 안내문별 → 파일별. 같은 «파일 이름»이 여러 안내문에 붙었으면 한 파일의 «보낸 기록»이 여럿이다.
     이름이 기록에 없는 첨부는 파일로 못 센다(수만 따로) */
  function 파일들(줄들) {
    var 지도 = {};
    줄들.forEach(function (x) {
      var 이름들 = 배열로(x.첨부).map(글).filter(Boolean);
      이름들.forEach(function (이름) {
        var f = 지도[이름] = 지도[이름] || { 이름: 이름, 확장: 확장자(이름), 보냄: [] };
        f.보냄.push({ id: x.id, 날짜: 글(x.날짜), 제목: 글(x.제목), 구분: 글(x.구분), 받는주소수: 수(x.받는주소수),
          미리보기: 글(x.미리보기), 함께: 이름들.filter(function (n) { return n !== 이름; }) });
      });
    });
    return Object.keys(지도).map(function (k) {
      var f = 지도[k];
      f.보냄.sort(function (a, b) { return a.날짜 < b.날짜 ? 1 : a.날짜 > b.날짜 ? -1 : 0; });
      f.횟수 = f.보냄.length; f.마지막 = f.보냄[0].날짜; f.처음 = f.보냄[f.보냄.length - 1].날짜;
      f.종류 = 종류말(f.확장); f.아이콘 = 아이콘(f.확장);
      return f;
    }).sort(function (a, b) { return a.마지막 < b.마지막 ? 1 : a.마지막 > b.마지막 ? -1 : (a.이름 < b.이름 ? -1 : 1); });
  }
  function 이름없는첨부수(줄들) { return 줄들.reduce(function (s, x) { return s + 수(x.이름없는첨부); }, 0); }

  /* 파일 칩 — 전체 · 종류별(PDF·한글·엑셀… 있는 것만) · 여러 번 보낸 것 */
  function 파일칩(파일줄) {
    var 칩 = [{ 키: '', 이름: '전체', 수: 파일줄.length }];
    ['PDF', '한글', '엑셀', '워드', '파워포인트', '그림', '압축', '기타'].forEach(function (k) {
      var n = 파일줄.filter(function (f) { return f.종류 === k; }).length;
      if (n) 칩.push({ 키: k, 이름: k, 수: n });
    });
    var 여럿 = 파일줄.filter(function (f) { return f.횟수 > 1; }).length;
    if (여럿) 칩.push({ 키: '여럿', 이름: '여러 번 보낸 것', 수: 여럿 });
    return 칩;
  }
  function 파일거르기(파일줄, 키) {
    if (!키) return 파일줄.slice();
    if (키 === '여럿') return 파일줄.filter(function (f) { return f.횟수 > 1; });
    return 파일줄.filter(function (f) { return f.종류 === 키; });
  }

  /* ── 받은 곳 / 한계 / 메일함에서 찾기 ── */
  function 받은곳수(항목) { return 배열로(항목.업체).length + 배열로(항목.명함업체).length; }
  function 한계말(항목) {
    var 말 = [];
    if (수(항목.한통최대) >= 8) 말.push('메일 기록에는 한 통에 받는 사람이 8명까지만 남아, 실제로 받은 곳은 더 많을 수 있습니다.');
    if (수(항목.이름없는첨부) > 0) 말.push('첨부 ' + 수(항목.이름없는첨부) + '개는 파일 이름이 기록에 없습니다.');
    if (수(항목.사라짐) > 0) 말.push('다음메일에서는 더 이상 보이지 않습니다 — 이 기록은 그대로 남아 있습니다.');
    return 말;
  }
  function 폴더말(이름) { return 폴더이름[이름] || 글(이름); }
  /* 「메일함에서 찾기」 — 푸른 메일함에 «폴더·번호로 여는 길»이 아직 없어 1차는 안내 + 제목 복사 */
  function 찾기말(항목) {
    var 칸들 = 배열로(항목.폴더들).slice().sort(function (a, b) { return 수(b.수) - 수(a.수); });
    var 첫칸 = 칸들.length ? 폴더말(칸들[0].이름) : '';
    return { 제목: 글(항목.제목), 칸: 첫칸,
      안내: '푸른 메일함' + (첫칸 ? ' › ' + 첫칸 : '') + ' 에서 「' + 글(항목.제목) + '」 를 찾아 열어 보십시오.' };
  }
  function 기록위치(항목) {
    return 배열로(항목.폴더들).map(function (f) { return 폴더말(f.이름) + ' ' + 수(f.수) + '통'; }).join(' · ');
  }

  /* ── 대장(CSV) — 엑셀로 열린다(맨 앞 BOM · 줄바꿈 CRLF). 수식으로 읽힐 글(= + - @)은 앞에 ' 를 붙여 막는다 ── */
  function 칸(v) {
    var s = 글(v).replace(/\r\n|\r/g, '\n');
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /* 엑셀이 한글 CSV 를 UTF-8 로 읽게 하는 맨 앞 표시(BOM) — 눈에 안 보이는 글자를 소스에 박지 않으려고 코드로 만든다 */
  var BOM = String.fromCharCode(0xFEFF);
  function 대장글(줄들) {
    var 머리 = ['번호', '발송일', '구분', '제목', '내용(메일 첫머리)', '첨부 파일', '받은 주소 수', '받은 곳(업체관리 기준)',
      '받은 곳(기업정보함 명함 기준)', '업체 미확인 주소', '발송 기록 위치', '비고'];
    var 몸 = 줄들.slice().sort(function (a, b) { return 글(a.날짜) < 글(b.날짜) ? -1 : 글(a.날짜) > 글(b.날짜) ? 1 : 0; }).map(function (x, i) {
      return [i + 1, 글(x.날짜), 글(x.구분), 글(x.제목), 글(x.미리보기), 배열로(x.첨부).map(글).join('\n'), 수(x.받는주소수),
        배열로(x.업체).map(글).join('\n'), 배열로(x.명함업체).map(글).join('\n'), 수(x.업체미확인), 기록위치(x), 한계말(x).join(' / ')];
    });
    return BOM + [머리].concat(몸).map(function (r) { return r.map(칸).join(','); }).join('\r\n') + '\r\n';
  }

  var API = { 배열로: 배열로, 요일말: 요일말, 짧은제목: 짧은제목, 짧은구분: 짧은구분, 목록: 목록, 연칩: 연칩, 연거르기: 연거르기,
    확장자: 확장자, 종류말: 종류말, 아이콘: 아이콘, 파일들: 파일들, 이름없는첨부수: 이름없는첨부수, 파일칩: 파일칩, 파일거르기: 파일거르기,
    받은곳수: 받은곳수, 한계말: 한계말, 폴더말: 폴더말, 찾기말: 찾기말, 기록위치: 기록위치, 대장글: 대장글 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsNoticeLog = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
