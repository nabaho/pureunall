/* 재무관리 폰 — «표를 카드로» (대표 2026-10-25
   「재무관리 대시보드 하나씩 클릭해서 폰화면에서 UI 이상한 거 모두 찾아라 — 메인 탭 모두 수정해라」)

   ★ 무엇이 어긋났나 — 재무 화면의 표는 열이 6~12개다. 폰(≤640px)에는 열을 놓을 폭이 없어
     오른쪽 열(매출건수·세금계산서·주담당·등급·할 일 …)이 «옆으로 미는 상자» 안에 숨었다.
     화면마다 열이 달라 하나씩 카드로 다시 짜면 한 곳만 고쳐진다(그래서 같은 문제가 되풀이됐다).
   ★ 고침 — 표를 «한 번만» 풀어 준다. 이 파일은 표마다 머리글을 칸에 «이름표(data-l)»로 달고,
     폰 폭에 들어가는지 재서 ①들어가면 글자·여백만 줄이고(fit) ②안 들어가면 줄마다 카드(card)로 접는다.
     카드가 되면 CSS(css/pu-erp.css «표를 카드로»)가 이름표를 칸 위에 작게 보여 준다.
   ⚠ 표 안의 내용·클릭·입력은 건드리지 않는다 — 속성(data-pt·data-l)과 클래스(pt-w·pt-no)만 단다.
     그래서 DOM 이 바뀌어도 «다시 달기만» 하면 되고, 원본 표는 늘 그대로다.
   ⚠ 재무관리(body[data-erp-group=fin])의 폰에서만 돈다. 넓은 화면·다른 앱은 하나도 안 바뀐다.
   ⚠ 자기 카드 배치가 따로 있는 거래내역 표(.ld-tb·.ld-xt)는 건드리지 않는다. */
(function(){
  'use strict';
  if(window.__puFinPhone) return;
  window.__puFinPhone = { scans:0 };
  var MQ = window.matchMedia ? window.matchMedia('(max-width:640px)') : null;
  var timer = 0;

  function active(){
    return !!(MQ && MQ.matches && document.body && document.body.getAttribute('data-erp-group') === 'fin');
  }
  /* 머리글 글자 — 정렬 화살표·보이지 않는 글자를 걷는다 */
  function clean(t){
    return String(t == null ? '' : t).replace(/[↕⇅⇵▲▼▴▾↑↓⬆⬇]/g, '').replace(/\s+/g, ' ').trim();
  }
  /* 칸 번호 → 머리글. 머리줄이 여럿(거르는 줄이 따로 있는 표)이면 «th 가 가장 많은 줄» 이 이름표 줄이다 */
  function labelsOf(table){
    var head = table.tHead;
    if(!head || !head.rows.length) return null;
    var best = null, bestN = 0;
    for(var i = 0; i < head.rows.length; i++){
      var n = head.rows[i].querySelectorAll('th').length;
      if(n > bestN){ bestN = n; best = head.rows[i]; }
    }
    if(!best || bestN < 3) return null;
    var out = [];
    for(var j = 0; j < best.cells.length; j++){
      var c = best.cells[j], span = c.colSpan || 1, t = clean(c.textContent);
      for(var k = 0; k < span; k++) out.push(k === 0 ? t : '');
    }
    return out;
  }
  function mark(table, labels){
    var rows = [];
    for(var b = 0; b < table.tBodies.length; b++) for(var r = 0; r < table.tBodies[b].rows.length; r++) rows.push(table.tBodies[b].rows[r]);
    var real = 0;
    rows.forEach(function(tr){
      var cells = tr.cells;
      if(cells.length === 1 && (cells[0].colSpan || 1) > 1) return;      // 「없습니다」 한 줄
      real++;
      var col = 0;
      for(var i = 0; i < cells.length; i++){
        var td = cells[i], lab = labels[col] || '';
        if(td.getAttribute('data-l') !== lab) td.setAttribute('data-l', lab);
        var txt = (td.textContent || '').trim();
        var wide = txt.length > 12 || td.querySelector('input,select,textarea,button');
        td.classList.toggle('pt-w', !!wide);
        td.classList.toggle('pt-no', (lab === '#' || lab === '번호' || lab === '') && /^\d{1,4}$/.test(txt));
        td.classList.toggle('pt-idx', lab === '#' || lab === '번호');      // fit2 에서 접는 «번호» 칸
        col += td.colSpan || 1;
      }
    });
    return real;
  }
  function overflows(table){
    var box = table.parentElement;
    if(!box) return false;
    return table.offsetWidth > box.clientWidth + 1;
  }
  function one(table){
    if(table.closest('.ld-tb,.ld-xt') || table.hasAttribute('data-pt-skip')) return;
    var labels = labelsOf(table);
    if(!labels) return;
    var n = mark(table, labels);
    Array.prototype.forEach.call(table.tHead.querySelectorAll('th'), function(th){
      var t = clean(th.textContent); th.classList.toggle('pt-idx', t === '#' || t === '번호');
    });
    var sig = n + '|' + labels.join('|') + '|' + (table.parentElement ? table.parentElement.clientWidth : 0);
    if(table.__ptSig === sig) return;
    table.__ptSig = sig;
    /* 줄이 없으면(「없습니다」 한 줄) 머리글 줄은 보일 까닭이 없다 — 좁은 폭에서 잘린 머리글만 남는다 */
    if(!n){ table.setAttribute('data-pt', 'empty'); return; }
    var cols = labels.filter(function(l){ return l !== ''; }).length;
    /* 달 열(1월~12월)이 여섯 개 이상 = 칸마다 눌러 쓰는 «달력표» — 카드로 접으면 눌러 쓰는 칸이 흩어진다.
       옆으로 밀게 두되 이름 칸을 왼쪽에 붙박이로(.pt-key) */
    var months = labels.filter(function(l){ return /^\d{1,2}월$/.test(l); }).length;
    if(months >= 6){
      var keyAt = -1;
      for(var q = 0; q < labels.length; q++){ if(['', '#', '번호', '☐'].indexOf(labels[q]) < 0){ keyAt = q; break; } }
      Array.prototype.forEach.call(table.querySelectorAll('tr'), function(tr){
        for(var z = 0; z < tr.cells.length; z++) tr.cells[z].classList.toggle('pt-key', z === keyAt);
      });
      table.setAttribute('data-pt', 'matrix');
      return;
    }
    if(cols >= 9){ table.setAttribute('data-pt', 'card'); return; }
    /* ① 글자·여백만 줄여 본다 → ② 번호 칸까지 접어 본다(체크칸이 있는 «고르는 표»는 번호를 접지 않는다) → ③ 카드 */
    table.setAttribute('data-pt', 'fit');
    if(!overflows(table)) return;
    if(!table.querySelector('input[type=checkbox]')){
      table.setAttribute('data-pt', 'fit2');
      if(!overflows(table)) return;
    }
    table.setAttribute('data-pt', 'card');
  }
  function scan(){
    timer = 0;
    if(!active()) return;
    window.__puFinPhone.scans++;
    var tables = document.querySelectorAll('main table');
    for(var i = 0; i < tables.length; i++){ try{ one(tables[i]); }catch(e){} }
  }
  function schedule(){
    if(timer) return;
    timer = setTimeout(scan, 50);
  }
  function start(){
    try{ new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true }); }catch(e){}
    window.addEventListener('resize', schedule);
    if(MQ && MQ.addEventListener) MQ.addEventListener('change', schedule);
    schedule();
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.__puFinPhone.scan = scan;
})();
