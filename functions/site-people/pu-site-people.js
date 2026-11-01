/* 구성원 쪽을 «자료로» 그리는 부품 — 브라우저와 명령줄이 «같은 코드»를 쓴다.
   ═══════════════════════════════════════════════════════════════════════════
   대표 결정 2026-08-31: 홈페이지를 새로 만들고 푸른ERP 에서 고친다.

   ★ 왜 부품으로 뺐나
     같은 일을 화면(푸른ERP)과 명령줄에서 둘 다 해야 한다. 두 벌로 베껴 쓰면
     반드시 갈라진다 — 화면에서 미리 본 것과 실제로 올라가는 것이 달라진다.
     한 벌만 두고 둘이 함께 부른다.

   ★ 어떻게 그리나
     굳힌 쪽의 «첫 카드»를 본으로 삼아 사람 수만큼 찍어 낸다.
     마크업을 새로 쓰지 않으므로 화면이 달라질 자리가 없다.
     (그 증거: 지금 쪽에서 읽어 다시 그리면 글자 하나까지 똑같다 —
      tests/homepage-people.test.js 가 못 박는다.)

   ★ 사진은 «홈페이지 것»을 그대로 이어받는다
     푸른ERP 는 얼굴 사진을 갖고 있지 않다. 글 번호로 짝지어 지금 쪽의 사진을 그대로 쓴다.
     짝이 없으면 그 사람은 «올리지 않고» 알린다 — 사진 없는 카드를 내보내지 않는다. */
(function (global) {
  'use strict';
  /* ── 아주 작은 마크업 도구 ── */

  /* 여는 태그 자리에서 시작해 «짝이 맞는» 닫는 태그까지의 조각을 돌려준다.
     ★ 정규식으로 <div>…</div> 를 잡으면 안쪽 div 에서 먼저 끊긴다. 깊이를 센다. */
  function 덩어리(html, 시작, 태그) {
    const 열기 = new RegExp('<' + 태그 + '\\b', 'gi');
    const 닫기 = new RegExp('</' + 태그 + '\\s*>', 'gi');
    let i = 시작, 깊이 = 0;
    while (i < html.length) {
      열기.lastIndex = i; 닫기.lastIndex = i;
      const a = 열기.exec(html);
      const b = 닫기.exec(html);
      if (!b) return null;
      if (a && a.index < b.index) { 깊이++; i = a.index + 1; continue; }
      깊이--;
      i = b.index + b[0].length;
      if (깊이 === 0) return html.slice(시작, i);
    }
    return null;
  }

  function 사이글자(조각, 여는표시) {
    const i = 조각.indexOf(여는표시);
    if (i < 0) return '';
    const j = 조각.indexOf('>', i);
    const 안 = 덩어리(조각, i, 여는표시.replace(/^<(\w+).*/, '$1'));
    if (!안) return '';
    return 안.slice(안.indexOf('>', 0) + 1, 안.lastIndexOf('<'));
  }

  function 텍스트(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
  }

  function 감싸기(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── 카드 찾기 ── */
  const 카드시작 = /<div class="bh bh_item item item\d+/g;

  function 카드들(html) {
    const out = [];
    카드시작.lastIndex = 0;
    let m;
    while ((m = 카드시작.exec(html))) {
      const blk = 덩어리(html, m.index, 'div');
      if (!blk) break;
      out.push({ at: m.index, html: blk });
      카드시작.lastIndex = m.index + blk.length;
    }
    return out;
  }

  /* ── 읽기: 지금 쪽 → 자료 ── */
  function 사람읽기(html) {
    return 카드들(html).map(c => {
      const h = c.html;
      const srl = (/data-srl="(\d+)"/.exec(h) || [, ''])[1];
      const 사진 = (/<img[^>]+src="([^"]+)"/.exec(h) || [, ''])[1];
      /* 모달 안의 제목이 이름과 직책1 을 갈라 준다 */
      const 모달 = h.slice(h.indexOf('bh_modal_header'));
      const 제목 = 사이글자(모달.slice(모달.indexOf('<div class="bh_title">')), '<div class="bh_title">');
      const 직책1 = 텍스트((/<span class="pl-5">([\s\S]*?)<\/span>/.exec(제목) || [, ''])[1]);
      /* ★ 직책2(<div class="position">)가 제목 «안»에 들어 있다 — 먼저 걷어내지 않으면
         이름이 「권형하 공인노무사」가 된다. 실제로 여기서 한 번 틀렸다. */
      const 이름 = 텍스트(제목.replace(/<div class="position">[\s\S]*?<\/div>/, '')
                            .replace(/<span class="pl-5">[\s\S]*?<\/span>/, ''));
      const 직책2 = 텍스트((/<div class="position">([\s\S]*?)<\/div>/.exec(모달) || [, ''])[1]);
      const desc = (/<div class="desc">([\s\S]*?)<\/div>\s*<\/div>/.exec(h) || [, ''])[1] || '';
      const 경력 = desc.split(/<br\s*\/?>/i).map(텍스트).filter(Boolean);
      return { srl: srl, 이름: 이름, 직책1: 직책1, 직책2: 직책2, 사진: 사진, 경력: 경력 };
    });
  }

  /* ── 그리기: 자료 → 쪽 ── */
  function 카드그리기(본, 사람, 자리) {
    let h = 본;

    /* 몇 번째 카드인지 — 홈페이지 반죽이 item1·item2… 로 세므로 그대로 이어 준다.
       ★ 나타나는 짬(data-anim-delay)은 «건드리지 않는다». 지금 홈페이지가 정한 값이 있고,
         우리가 멋대로 정하면 카드가 하나씩 늦게 뜨는 등 화면 결이 달라진다. */
    h = h.replace(/(<div class="bh bh_item item item)\d+/, '$1' + (자리 + 1));

    /* 글 번호 — 창을 여닫는 열쇠라 세 자리를 다 갈아 끼운다 */
    h = h.replace(/data-srl="\d+"/g, 'data-srl="' + 사람.srl + '"');
    h = h.replace(/id="bh_modal_\d+"/, 'id="bh_modal_' + 사람.srl + '"');

    /* 얼굴 사진 */
    h = h.replace(/(<img[^>]+src=")[^"]*(")/, '$1' + 사람.사진 + '$2');

    /* 카드에 보이는 이름 — 홈페이지는 «이름+직책1» 을 붙여 찍는다 */
    h = h.replace(/(<div class="bh_title">\s*<a[^>]*>\s*<span class="bh">)[\s\S]*?(<\/span>)/,
      '$1' + 감싸기(사람.이름 + (사람.직책1 || '')) + '$2');

    /* 직책2 — 카드와 창에 한 번씩 */
    h = h.replace(/(<div class="position">)[\s\S]*?(<\/div>)/g, '$1' + 감싸기(사람.직책2) + '$2');

    /* 창 안의 제목 — 이름과 직책1 을 갈라 적는다 */
    h = h.replace(/(<div class="bh_title">\s*<span>)[\s\S]*?(<\/span>\s*<div class="position">)/,
      /* ★ 직책1 이 없어도 빈 칸(<span class="pl-5"></span>)을 그대로 둔다.
         지금 홈페이지가 그렇게 찍는다 — 빼면 «우리가 만든 것»과 «지금 것»이 갈라져,
         똑같은지 견주는 검사가 쓸모없어진다. */
      '$1' + 감싸기(사람.이름)
      + '<span class="pl-5">' + 감싸기(사람.직책1 || '') + '</span>$2');

    /* 경력사항 — 짝을 세어 «그 칸 안쪽»만 갈아 끼운다.
       ★ 정규식으로 …</div></div> 까지 잡으면 안쪽 div 에서 끊겨 닫는 표시가 하나 늘어난다
         (실제로 그렇게 틀렸다 — 늘어난 </div> 하나가 그 아래 화면을 통째로 밀어낸다). */
    const 경력자리 = h.indexOf('<div class="desc">');
    if (경력자리 >= 0) {
      const 칸 = 덩어리(h, 경력자리, 'div');
      if (칸) {
        const 새칸 = '<div class="desc"><div>'
          + 사람.경력.map(감싸기).join('<br />\n') + '</div></div>';
        h = h.slice(0, 경력자리) + 새칸 + h.slice(경력자리 + 칸.length);
      }
    }

    return h;
  }

  function 쪽그리기(html, 사람들) {
    const 카드 = 카드들(html);
    if (!카드.length) throw new Error('본으로 삼을 카드를 찾지 못했습니다');
    const 본 = 카드[0].html;
    const 새것 = 사람들.map((p, i) => 카드그리기(본, p, i)).join('\n\t\t\t\t\t');
    const 처음 = 카드[0].at;
    const 끝 = 카드[카드.length - 1].at + 카드[카드.length - 1].html.length;
    return html.slice(0, 처음) + 새것 + html.slice(끝);
  }
  /* ── 직원인가 (2026-11-01 직원 소개 1단계) ──
     노무사는 사진·경력이 있는 «카드», 직원은 이름·직급 두 칸뿐인 «상자»로 그린다.
     ★ 상자로 가는 사람은 구분을 «직원»으로 저장한 사람(kind:'staff')뿐이다 — 직책에서 짐작하지 않는다.
       직책이 비어 있는 옛 노무사 글을 직원으로 짐작하면, 그 사람이 카드에서 빠지고 직원 줄에 끼어든다.
       화면의 memberKind(직책에서 읽어 내는 «보이는 구분»)와 일부러 다르다. */
  function 직원인가(m) { return String((m || {}).kind || '') === 'staff'; }

  /* 직원 상자 하나 = 그것을 감싼 칸(<div class="lg:col-2_5 col-6">) 통째.
     ★ 상자만 갈아 끼우면 칸이 남거나 모자란다 — 감싼 칸째로 찍어 낸다. */
  function 직원칸들(html) {
    var out = [], i = 0, 표 = '<div class="people_box">';
    while ((i = html.indexOf(표, i)) >= 0) {
      var 칸시작 = html.lastIndexOf('<div', i - 1);
      var blk = 칸시작 >= 0 ? 덩어리(html, 칸시작, 'div') : null;
      if (!blk || 칸시작 + blk.length <= i) break;
      out.push({ at: 칸시작, html: blk });
      i = 칸시작 + blk.length;
    }
    return out;
  }

  function 직원읽기(html) {
    return 직원칸들(html).map(function (c) {
      var 더 = 경력덩어리(c.html);
      var 경력 = [];
      if (더) {
        var 안 = 사이글자(더.html, '<div class="desc">');
        경력 = 안.replace(/^\s*<div>/, '').replace(/<\/div>\s*$/, '').split(/<br\s*\/?>/i).map(텍스트).filter(Boolean);
      }
      return { 이름: 텍스트(사이글자(c.html, '<div class="text1">')),
               직급: 텍스트(사이글자(c.html, '<div class="text2">')),
               경력: 경력 };
    });
  }

  /* ── 직원 경력 창 (대표 승인 2026-11-01 직원 소개 2단계 A안 「눌러서 여는 창」) ──
     ★ 상자 모양·크기는 그대로 두고 «경력 보기 ›» 한 줄과 창 하나를 덧붙인다.
       창은 노무사 카드와 «같은 마크업»(bh_modal)이라 새 사이트 레이아웃 JS(bh_modal_toggle + data-target)가 연다.
     ★ 우리가 붙인 것은 <div class="pu_staff_more"> 한 덩어리 — 다시 그릴 때 이것만 걷고 새로 붙인다.
     ⚠ 경력은 «본인 동의를 받은 직원만» 온다(올릴직원이 거른다). 여기서는 받은 것만 그린다. */
  var 더표 = '<div class="pu_staff_more">';
  function 경력덩어리(칸html) {
    var i = 칸html.indexOf(더표);
    if (i < 0) return null;
    var blk = 덩어리(칸html, i, 'div');
    return blk ? { at: i, html: blk } : null;
  }
  function 경력창(p, 자리) {
    var 표 = 'pu_staff_modal_' + 자리;
    return 더표
      + '<a class="bh_modal_toggle" data-target="' + 표 + '" role="button" tabindex="0"'
      + ' style="display:inline-block;margin-top:6px;font-size:13px;color:#1e40af;cursor:pointer">경력 보기 ›</a>'
      + '<div class="bh bh_modal ' + 표 + '"><div class="bh bh_modal_content" style="max-width: 600px;">'
      + '<div class="bh bh_modal_close"><img src="../widgets/bh_gall_widget/skins/gall_people_sub/img/close.png" alt="close"></div>'
      + '<div class="bh bh_modal_header"><div class="bh_title"><span>' + 감싸기(p.이름) + '<span class="pl-5"></span></span>'
      + '<div class="position">' + 감싸기(p.직급) + '</div></div></div>'
      + '<div class="bh bh_modal_body clearfix"><div class="career_title">경력사항</div>'
      + '<div class="desc"><div>' + p.경력.map(감싸기).join('<br />\n') + '</div></div></div>'
      + '</div><div class="bh bh_modal_dimmed"></div></div></div>';
  }

  /* 첫 상자를 본으로 사람 수만큼 찍어 낸다 — 노무사 카드와 같은 방식이라 모양이 달라질 자리가 없다.
     ⚠ 빈 목록이면 그리지 않는다 — 직원 줄이 통째로 사라진 쪽을 내보내지 않는다. */
  function 직원그리기(html, 직원들) {
    var 칸 = 직원칸들(html);
    if (!칸.length) throw new Error('본으로 삼을 직원 칸을 찾지 못했습니다');
    if (!(직원들 || []).length) throw new Error('그릴 직원이 한 명도 없습니다');
    var 본 = 칸[0].html;
    /* 본에 지난번 경력 창이 붙어 있으면 걷는다 — 안 걷으면 모든 직원에게 첫 사람 경력이 복사된다 */
    var 옛더 = 경력덩어리(본);
    if (옛더) 본 = 본.slice(0, 옛더.at) + 본.slice(옛더.at + 옛더.html.length);
    /* 칸 사이 띄움은 지금 쪽 것을 그대로 쓴다 — 그래야 다시 그려도 글자 하나 안 바뀐다 */
    var 사이 = 칸.length > 1 ? html.slice(칸[0].at + 칸[0].html.length, 칸[1].at) : '\n        ';
    var 새것 = 직원들.map(function (p, i) {
      var 경력 = (p.경력 || []).filter(function (x) { return String(x || '').trim(); });
      return 본.replace(/(<div class="text1">)[\s\S]*?(<\/div>)/, function (_, a, b) { return a + 감싸기(p.이름) + b; })
        .replace(/(<div class="text2">)[\s\S]*?(<\/div>)/, function (_, a, b) {
          return a + 감싸기(p.직급) + b + (경력.length ? 경력창({ 이름: p.이름, 직급: p.직급, 경력: 경력 }, i + 1) : '');
        });
    }).join(사이);
    var 끝 = 칸[칸.length - 1];
    return html.slice(0, 칸[0].at) + 새것 + html.slice(끝.at + 끝.html.length);
  }

  /* 새 사이트에 싣는 경력은 «맨 위 10줄»까지 — 맨 위가 최근이다 (대표 지시 2026-11-01 「최근것 10개 이하로」).
     더 적어 둔 줄은 우리 목록에 남고, 새 사이트에만 안 간다. */
  var 경력한도 = 10;

  /* 경력을 새 사이트에 보여도 되나 — 본인 동의(받은 날)가 적혀 있어야 한다 (대표 승인 2026-11-01).
     ⚠ 동의가 없으면 경력은 우리 목록에만 남고, 새 사이트에는 이름·직급만 간다. */
  function 경력공개(m) {
    var c = (m || {}).careerConsent;
    return !!(c && typeof c === 'object' && String(c.at || '').trim());
  }

  /* 우리 자료 → 올릴 직원. 차례(order)대로, 같으면 열쇠 순. 이름이 빈 줄은 안 그린다. */
  function 차례값(m) {
    var o = (m || {}).order;
    return (o === '' || o == null || !isFinite(Number(o))) ? 1e9 : Number(o);
  }
  /* 화면 목록도 이 잣대로 줄을 세운다 — 목록 차례와 올라가는 차례가 같아야 한다 */
  function 차례견주기(a, b) {
    if (차례값(a) !== 차례값(b)) return 차례값(a) - 차례값(b);
    var ka = String((a || {}).key || ''), kb = String((b || {}).key || '');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }
  function 올릴직원(ours) {
    return (ours || []).filter(function (m) { return 직원인가(m) && String(m.name || '').trim(); })
      .slice().sort(차례견주기)
      .map(function (m) {
        return { 이름: String(m.name).trim(), 직급: String(m.position1 || '').trim(),
                 경력: 경력공개(m)
                   ? (m.careers || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean).slice(0, 경력한도)
                   : [] };
      });
  }

  /* ★ 푸른ERP 자료 + 지금 쪽 → «올릴 자료».
     ERP 에는 사진이 없으므로 글 번호로 짝지어 지금 쪽의 사진을 이어받는다. */
  function 올릴사람(현재쪽, ours) {
    var 지금 = {};
    사람읽기(현재쪽).forEach(function (p) { 지금[p.srl] = p; });
    var 갈것 = [], 못갈것 = [];
    (ours || []).forEach(function (m) {
      /* 직원은 카드가 아니라 상자로 간다(올릴직원) — 여기서 「글 번호 없음」으로 걸지 않는다 */
      if (직원인가(m)) return;
      var srl = String(m.srl == null ? '' : m.srl).trim();
      var 옛 = srl && 지금[srl];
      if (!srl) {
        못갈것.push({ 이름: m.이름 || m.name || '(이름 없음)', why: '홈페이지 글 번호가 없습니다' });
        return;
      }
      if (!옛 || !옛.사진) {
        못갈것.push({ 이름: m.이름 || m.name || srl,
          why: '홈페이지에 이 사람 사진이 없습니다 (글 번호 ' + srl + ')' });
        return;
      }
      갈것.push({
        srl: srl,
        이름: String(m.이름 == null ? (m.name || '') : m.이름),
        직책1: String(m.직책1 == null ? (m.position1 || '') : m.직책1),
        직책2: String(m.직책2 == null ? (m.position2 || '') : m.직책2),
        사진: 옛.사진,
        경력: (m.경력 || m.careers || []).slice()
      });
    });
    return { 갈것: 갈것, 못갈것: 못갈것 };
  }

  global.PuSitePeople = {
    사람읽기: 사람읽기,
    쪽그리기: 쪽그리기,
    올릴사람: 올릴사람,
    직원인가: 직원인가,
    직원읽기: 직원읽기,
    직원그리기: 직원그리기,
    올릴직원: 올릴직원,
    차례견주기: 차례견주기,
    경력공개: 경력공개,
    경력한도: 경력한도,
    카드들: 카드들,
    덩어리: 덩어리
  };
})(typeof window !== 'undefined' ? window : globalThis);
