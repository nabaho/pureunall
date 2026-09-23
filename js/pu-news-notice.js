/* 안내문 — 뉴스레터가 «아닌» 한 건 집중 편지를 짓는 층 (대표 지시 2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   「뉴스레터 이외에 비정기적인 자료를 푸른노무법인 이름으로 뉴스레터가 아닌 내용으로
    집중해서 확인하라는 의미로 보내고 싶은데 이부분도 반영해라」
   대표 결정(목업을 보시고): 그대로 · ✅ 확인 단추는 «뺀다» · 문의는 «사업장별 담당 노무사».

   ■ 뉴스레터와 무엇이 다른가 — 받는 분이 «한눈에» 달리 읽어야 한다
     · 꼭지·차림표·영문 딱지가 없다. 한 건만.
     · 남색 띠와 「확인 요청」 딱지 — 뉴스레터(갈색)와 색부터 다르다.
     · 맨 위에 「이것만 확인해 주십시오」 상자, 기한은 붉은 글씨.
     · 제목이 「[푸른노무법인 안내] …」 — 받은편지함에서 뉴스레터와 섞이지 않는다.

   ■ 같은 것 — 보내는 줄·수신거부·(광고) 잣대는 뉴스레터 것을 «그대로» 쓴다
     (functions/mail-bulk · Core.광고표기필요한가). 두 벌이면 한쪽만 고쳐진다.

   ⚠⚠ {담당문의} 는 «발송기가» 통마다 바꿔 넣는 자리다(mail-bulk buildQueue).
     여기서 채우지 않는다. 미리 보기·시험은 부르는 쪽이 채운다.
   ⚠⚠ 사람이 쓴 글의 중괄호 { } 는 «막는다». 발송기는 {무엇} 꼴을 모두 자리로 읽어
     비워 버린다 — 「{주의}」라고 쓰면 그 글자가 편지에서 사라진다. */

(function (global) {
  'use strict';

  var Core = (typeof require === 'function' && typeof module === 'object')
    ? require('./pu-news-core.js') : global.PuNewsCore;
  var Tpl = (typeof require === 'function' && typeof module === 'object')
    ? require('./pu-news-tpl.js') : global.PuNewsTpl;

  /* 색은 편지 층의 것을 빌린다 — 팔레트를 두 벌 두지 않는다 */
  var 색 = (Tpl && Tpl.색) || {};
  var 남 = 색.남색 || '#1b3a6b';
  var 짙 = 색.짙은갈 || '#241a13';
  var 글색 = 색.글 || '#33302c';
  var 흐림 = 색.흐린글 || '#9a938a';
  var 줄색 = 색.줄 || '#e0dcd6';
  var 표지테 = 색.표지테 || '#d9d2c8';
  var 붉음 = '#b0413e';
  var 옅은남 = '#f4f6fa';
  var 폰트 = "'Malgun Gothic',sans-serif";
  var 넓이 = (Tpl && Tpl.넓이) || 700;

  /* 발송기가 통마다 바꿔 넣는 자리 — 이름을 한 곳에만 적는다 */
  var 담당자리 = '{담당문의}';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      /* ★ 중괄호를 막는다 — 서식에서는 글자 그대로 보이고, 발송기는 자리로 못 읽는다 */
      .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  }
  /* 평문 몫의 중괄호 막기 — 평문은 엔티티가 안 먹으므로 «전각» 괄호로 바꾼다 */
  function 평글(s) {
    return String(s == null ? '' : s).replace(/\{/g, '｛').replace(/\}/g, '｝');
  }
  function 여러줄(s) { return esc(s).replace(/\r\n|\r|\n/g, '<br>'); }

  function 요점고르기(요점) {
    var 목 = Array.isArray(요점) ? 요점 : String(요점 == null ? '' : 요점).split(/\r\n|\r|\n/);
    return 목.map(function (x) { return String(x == null ? '' : x).replace(/^\s*(?:[①-⑳]|\d+[.)]|[-·•])\s*/, '').trim(); })
      .filter(Boolean).slice(0, 8);
  }
  var 동그라미 = '①②③④⑤⑥⑦⑧';

  /* 기한 — 「2026-09-30」 → 「9월 30일(수)」. 꼴이 틀리면 «안 쓴다»(지어내지 않는다) */
  function 기한글(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
    if (!m) return '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(d.getTime()) || d.getUTCDate() !== +m[3]) return '';
    return (+m[2]) + '월 ' + (+m[3]) + '일(' + '일월화수목금토'.charAt(d.getUTCDay()) + ')';
  }
  function 날짜글(ms) {
    var d = new Date(Number(ms) || Date.now());
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  /* 첨부 — 누를 수 있는 주소만. 이름은 «보이는 글자»일 뿐이다. */
  function 첨부고르기(첨부) {
    return (Array.isArray(첨부) ? 첨부 : []).map(function (x) {
      var o = x || {};
      var u = String(o.주소 == null ? '' : o.주소).trim();
      if (!/^https:\/\//i.test(u)) return null;
      return { 이름: String(o.이름 == null ? '' : o.이름).trim().slice(0, 80) || '자료', 주소: u,
        크기: Number(o.크기) || 0 };
    }).filter(Boolean).slice(0, 10);
  }
  function 크기말(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + 'KB';
    return (Math.round(n / 1024 / 1024 * 10) / 10) + 'MB';
  }

  function 제목짓기(안내, 옵션) {
    var o = 옵션 || {};
    /* ⚠ 메일 제목도 발송기가 {무엇} 을 자리로 읽는다 — 평문처럼 막는다 */
    var t = 평글(String((안내 || {}).제목 == null ? '' : 안내.제목).replace(/[\r\n]+/g, ' ').trim());
    var 기 = 기한글((안내 || {}).기한);
    var s = '[' + ((o.설정 && o.설정.회사이름) || '푸른노무법인') + ' 안내] ' + t
      + (기 ? ' — ' + 기 + '까지 확인 부탁드립니다' : ' — 확인 부탁드립니다');
    return (Core && Core.광고표기필요한가 && Core.광고표기필요한가(o.범위 || '자문중', o.더한것))
      ? '(광고) ' + s : s;
  }

  /* 편지 한 통. 실을 것이 없으면 null — 빈 안내문은 안 만든다. */
  function 안내짓기(안내, 설정, 옵션) {
    var x = 안내 || {};
    var s = 설정 || {};
    var o = 옵션 || {};
    var 제목 = String(x.제목 == null ? '' : x.제목).replace(/[\r\n]+/g, ' ').trim();
    var 요점 = 요점고르기(x.요점);
    var 본문 = String(x.본문 == null ? '' : x.본문).trim();
    if (!제목 || (!요점.length && !본문)) return null;
    var 기 = 기한글(x.기한);
    var 첨부 = 첨부고르기(x.첨부);
    var 회사 = s.회사이름 || '푸른노무법인';
    var 전화 = s.전화 || '041-556-0035';
    var 광고 = !!(Core && Core.광고표기필요한가 && Core.광고표기필요한가(o.범위 || '자문중', o.더한것));
    var 거부주소 = String(s.수신거부주소 || s.회신주소 || '').trim();

    var 칸 = function (안, 위) {
      return '<tr><td style="padding:' + (위 == null ? 18 : 위) + 'px 28px 0 28px;">' + 안 + '</td></tr>';
    };

    var 요점칸 = '';
    if (요점.length || 기) {
      요점칸 = 칸('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
        + ' style="background-color:' + 옅은남 + ';border-left:4px solid ' + 남 + ';">'
        + '<tr><td style="padding:16px 20px;font-family:' + 폰트 + ';">'
        + (요점.length
          ? '<div style="font-size:13px;font-weight:bold;color:' + 남 + ';">이것만 확인해 주십시오</div>'
            + '<div style="height:8px;line-height:8px;font-size:1px;">&nbsp;</div>'
            + '<div style="font-size:14.5px;line-height:1.9;color:' + 글색 + ';">'
            + 요점.map(function (t, i) { return 동그라미.charAt(i) + ' ' + esc(t); }).join('<br>')
            + '</div>'
          : '')
        + (기 ? '<div style="height:' + (요점.length ? 10 : 0) + 'px;line-height:1px;font-size:1px;">&nbsp;</div>'
            + '<div style="font-size:13px;font-weight:bold;color:' + 붉음 + ';">회신 기한: ' + esc(기) + '까지</div>'
          : '')
        + '</td></tr></table>');
    }

    var 첨부칸 = 첨부.length
      ? 칸('<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:0;">'
        + 첨부.map(function (a) {
          return '<a href="' + esc(a.주소) + '" target="_blank" rel="noopener"'
            + ' style="display:inline-block;margin:0 8px 8px 0;border:1px solid ' + 표지테 + ';'
            + 'padding:10px 16px;font-size:13.5px;font-weight:bold;color:' + 짙 + ';text-decoration:none;'
            + 'font-family:' + 폰트 + ';">⬇ ' + esc(a.이름)
            + (a.크기 ? ' <span style="font-weight:normal;color:' + 흐림 + ';">· ' + 크기말(a.크기) + '</span>' : '')
            + '</a>';
        }).join('') + '</td></tr></table>', 18)
      : '';

    var 서식 =
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
      + ' style="background-color:' + (색.바탕 || '#e9e7e3') + ';"><tr><td align="center" style="padding:0;">'
      + '<table role="presentation" width="' + 넓이 + '" cellpadding="0" cellspacing="0" border="0"'
      + ' style="width:' + 넓이 + 'px;background-color:#ffffff;">'
      /* 남색 띠 — 뉴스레터(갈색 겹줄)와 «첫눈에» 다르게 */
      + '<tr><td style="height:6px;line-height:6px;font-size:1px;background-color:' + 남 + ';">&nbsp;</td></tr>'
      + '<tr><td style="padding:20px 28px 0 28px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td style="font-size:17px;font-weight:bold;color:' + 짙 + ';letter-spacing:-0.4px;font-family:' + 폰트 + ';">'
      + esc(회사) + '</td>'
      + '<td align="right"><span style="display:inline-block;background-color:' + 남 + ';color:#ffffff;'
      + 'font-size:12px;font-weight:bold;padding:5px 12px;letter-spacing:1px;font-family:' + 폰트 + ';">확인 요청</span></td>'
      + '</tr></table></td></tr>'
      + 칸('<div style="font-size:12.5px;color:' + 흐림 + ';font-family:' + 폰트 + ';">'
        + esc(날짜글(o.날짜)) + ' · ' + esc(x.대상 || '자문 사업장 안내') + '</div>'
        + '<div style="height:8px;line-height:8px;font-size:1px;">&nbsp;</div>'
        + '<div style="font-size:24px;font-weight:bold;color:' + 짙 + ';line-height:1.4;letter-spacing:-0.6px;'
        + 'font-family:' + 폰트 + ';">' + esc(제목) + '</div>', 22)
      + 요점칸
      + (본문 ? 칸('<div style="font-size:14px;line-height:1.9;color:' + 글색 + ';font-family:' + 폰트 + ';">'
        + 여러줄(본문) + '</div>') : '')
      + 첨부칸
      /* 문의 — {담당문의} 는 발송기가 통마다 「담당 ○○○ 노무사 · 」 또는 빈 글자로 바꾼다 */
      + 칸('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
        + ' style="border-top:1px solid ' + 줄색 + ';"><tr><td style="padding:14px 0;font-size:13px;'
        + 'line-height:1.8;color:#5b5249;font-family:' + 폰트 + ';">'
        + '문의 · ' + 담당자리 + esc(회사) + ' T.' + esc(전화)
        + ' · 이 메일에 바로 답장하셔도 됩니다</td></tr></table>', 22)
      + '<tr><td style="padding:10px 28px 24px 28px;font-size:11.5px;line-height:1.7;color:#b3aca3;'
      + 'font-family:' + 폰트 + ';">'
      + (광고 ? '이 메일은 <b>광고성 정보</b>가 포함될 수 있습니다. 수신에 동의하신 분께 보내 드립니다. '
             : '이 메일은 ' + esc(회사) + '과 자문 관계에 있는 곳에 보내 드리는 업무 안내입니다. ')
      + (거부주소
        ? '받지 않으시려면 이 메일에 <a href="mailto:' + esc(거부주소) + '?subject='
          + encodeURIComponent('안내문 수신거부') + '" style="color:#8a837a;">회신</a>해 주십시오.'
        : '받지 않으시려면 이 메일에 회신해 주십시오.')
      + '</td></tr>'
      + '</table></td></tr></table>';

    /* 평문 몫 — 서식을 못 읽는 프로그램에게. ⚠ 서식과 «같은 것»을 싣는다. */
    var 줄 = [];
    줄.push('[' + 회사 + ' 안내 · 확인 요청]');
    줄.push(평글(제목));
    줄.push('');
    if (요점.length) {
      줄.push('이것만 확인해 주십시오');
      요점.forEach(function (t, i) { 줄.push(동그라미.charAt(i) + ' ' + 평글(t)); });
    }
    if (기) 줄.push('회신 기한: ' + 기 + '까지');
    if (요점.length || 기) 줄.push('');
    if (본문) { 줄.push(평글(본문)); 줄.push(''); }
    if (첨부.length) {
      줄.push('자료');
      첨부.forEach(function (a) { 줄.push('· ' + 평글(a.이름) + ' — ' + a.주소); });
      줄.push('');
    }
    줄.push('문의 · ' + 담당자리 + 회사 + ' T.' + 전화 + ' · 이 메일에 바로 답장하셔도 됩니다');
    줄.push('---');
    줄.push((광고 ? '(광고) 광고성 정보가 포함될 수 있습니다. ' : '자문 관계에 있는 곳에 보내 드리는 업무 안내입니다. ')
      + '받지 않으시려면 이 메일에 회신해 주십시오.');

    return {
      제목: 제목짓기(x, { 설정: s, 범위: o.범위, 더한것: o.더한것 }),
      서식: 서식,
      본문: 줄.join('\n'),
      첨부수: 첨부.length
    };
  }

  /* 미리 보기·시험 — 발송기가 할 일(담당 끼우기)을 «같은 꼴»로 대신 한다.
     ⚠ 발송기(mail-bulk buildQueue 담당문의)와 글자가 같아야 시험이 시험이다. */
  function 담당채우기(글, 담당) {
    var n = String(담당 == null ? '' : 담당).replace(/[<>&"'{}\r\n]/g, '').trim();
    return String(글 == null ? '' : 글).split(담당자리).join(n ? '담당 ' + n + ' · ' : '');
  }

  var API = { 안내짓기: 안내짓기, 담당채우기: 담당채우기, 담당자리: 담당자리,
    요점고르기: 요점고르기, 기한글: 기한글, 첨부고르기: 첨부고르기 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsNotice = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
