/* pu-deungi-docs.js — 푸른등기: 변경등기 서류를 한글(hwpx)로 만든다 (2026-11-14)
   ■ 서식 모양은 지난 실제 서류를 따른다(저장소 밖): 2024 임시사원총회 회의록·총사원 동의서, 2017 총사원 동의서(지분양수·대표사원 변경)
     ·정관변경 이유서, 2019 정관 변경인가 신청서(시행규칙 별지 제26호서식)·공증용 위임장·등기 위임장, 2011·2013 변경등기신청서·퇴사원·취임승낙서.
   ■ 내용(등기할 사항·정관 조문·필요서류)은 js/pu-deungi-core.js 한 곳에서 온다 — 여기서는 «종이 모양»만 짓는다.
   ■ 조립기 hwpx_gen.js(HWPX) · 서식층 hwpx_doc.js(HWPXDOC) 를 쓴다. node 에서도 돈다(검사).
   ⚠ 주민등록번호 뒷자리는 ctx.rrn(이번에 화면에서 받은 것)에만 있다 — 없으면 «앞자리-_______» 빈칸으로 남겨 손으로 적는다.
   ⚠ «변경등기 신청서»는 법무사 확인용 초안이다 — 실제 신청은 법무사가 등기소 양식(전자신청 포함)으로 한다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var H0 = require('../hwpx_gen.js');
    if (typeof global !== 'undefined' && !global.HWPX) global.HWPX = H0;
    module.exports = factory(H0, require('../hwpx_doc.js'), require('./pu-deungi-core.js'));
  } else root.DeungiDocs = factory(root.HWPX, root.HWPXDOC, root.DeungiCore);
})(typeof self !== 'undefined' ? self : this, function (H, D, C) {
  'use strict';
  if (!H || !D || !C) return null;
  var CP = H.CP, PP = H.PP, BF = H.BF, SZ = H.SZ;

  /* ── 문단 조각 ── */
  function P(t) { return D.body(String(t == null ? '' : t)); }
  function PB(t) { return H.para(String(t), CP.f10b, { paraPr: PP.form }); }
  function CT(t) { return H.para(String(t), CP.f10, { paraPr: PP.center }); }
  function RT(t) { return H.para(String(t), CP.f10, { paraPr: PP.right }); }
  function SP() { return H.spacer(); }
  function NOTE(t) { return D.note(String(t)); }
  function hd(t) { return { t: t, bf: BF.gray, align: 'center', valign: 'center', cp: CP.f10b }; }
  function T(rows, ratios, doc, extra) {
    return H.tablePara(rows, D.cols(ratios, doc), D.tblOpt(Object.assign({ sz: SZ.p10, cp: CP.f10, padY: 200 }, extra || {})));
  }
  function list(items) { return items.map(function (x) { return P(x); }).join(''); }

  /* ── 공통 재료 ── */
  function context(base, caseRaw, rrnMap, today) {
    var b = C.normBase(base), c = C.normCase(caseRaw);
    var rrn = {};
    Object.keys(rrnMap || {}).forEach(function (k) { if (C.backOk(rrnMap[k])) rrn[k] = String(rrnMap[k]); });
    return { base: b, c: c, after: C.applyChanges(b, c), rrn: rrn, today: C.isDate(today) ? today : C.todayIso() };
  }
  function firmName(x) { return x.base.firm.name || '푸른 노무법인'; }
  function md(x) { return C.meetingDate(x.c); }
  function effDate(x) { return x.c.effDate || x.c.dates.approval || x.c.dates.approvalGet || md(x) || x.today; }
  /* 변경 연월일 글 — 날짜를 정하지 않아 총회일로 채운 것은 의사록·동의서에 «정관변경 인가일»로 적는다
     (이 법인 2026 의사록도 입사 날짜를 적지 않았고, 등기는 총회 뒤 날짜로 올라갔다) */
  function onDate(x, e) { return e.dateSrc === 'meeting' && x.after.charterChanged ? '정관변경 인가일' : C.dotDate(e.date); }
  function attendees(x) { return x.base.members; }
  function repsAfter(x) { return x.after.members.filter(function (m) { return m.rep; }); }
  function repNames(x) { var r = repsAfter(x); return r.length ? r.map(function (m) { return m.name; }).join(', ') : '          '; }
  function chairOf(x) {
    var a = attendees(x), id = x.c.meeting.chair;
    return a.filter(function (m) { return m.id === id; })[0] || a.filter(function (m) { return m.rep; })[0] || a[0] || { name: '          ', addr: '' };
  }
  function R(x, m) { return C.rrn(m, x.rrn); }
  function nameOf(x, id) { var m = x.after.byId[id]; return m ? m.name : ''; }
  function sign(role, name, seal) { return RT(role + '    ' + (name || '          ') + '    ' + (seal || '(인)')); }
  function roleBefore(m) { return m.rep ? '대표사원 겸 사원' : '사원'; }
  function shareText(x, m) {
    var s = m.leaveShare || {};
    if (s.mode === 'transfer' && s.to && s.to.length) {
      return '지분 금 ' + C.won(s.cash) + '원 중 ' + s.to.map(function (t) { return '금 ' + C.won(t.amount) + '원을 사원 ' + t.name + '에게'; }).join(', ') + ' 전부 양도';
    }
    if (s.mode === 'refund' && s.cash) return '지분 금 ' + C.won(s.cash) + '원을 정관에 따라 환급받기로';
    if (s.labor && !s.cash) return '노무출자 사원으로 환급할 출자지분 없이';
    return '지분 처리를 따로 정하고';
  }
  function eventsOf(x, type) { return x.after.events.filter(function (e) { return e.type === type; }); }

  /* ── 1. 임시사원총회 의사록 ── */
  function minutes(x) {
    var doc = D.begin('plain'), a = x.after, c = x.c, fn = firmName(x);
    var att = attendees(x), names = att.map(function (m) { return m.name; });
    var chair = chairOf(x), others = att.filter(function (m) { return m.id !== chair.id; }).map(function (m) { return m.name; });
    var agendas = [];
    eventsOf(x, 'join').forEach(function (e) {
      var m = a.byId[e.member];
      agendas.push({ title: '사원 입사 승인의 건(' + m.name + ')', skip: '',
        text: '공인노무사 ' + C.particle(m.name, '을', '를') + ' ' + C.investText(m.invest, 'charter') + ' 출자 사원으로 ' + onDate(x, e) + '자로 입사시키는 것(정관 제19조 — 사원총회 2/3 이상의 의결)' });
    });
    eventsOf(x, 'leave').forEach(function (e) {
      var m = a.byId[e.member];
      agendas.push({ title: '사원 퇴사 승인 및 지분 처리의 건(' + m.name + ')', skip: m.id,
        text: '사원 ' + C.particle(m.name, '이', '가') + ' ' + onDate(x, e) + '자로 퇴사함에 따라 그 퇴사를 승인하고, ' + shareText(x, m) + '하는 것' });
    });
    var ins = eventsOf(x, 'repIn'), outs = eventsOf(x, 'repOut').filter(function (e) { return !e.byLeave; });
    if (ins.length || outs.length) {
      var t = [];
      if (outs.length) t.push(outs.map(function (e) { return '대표사원 ' + nameOf(x, e.member); }).join(', ') + '의 대표사원직 사임을 승인하고');
      if (ins.length) t.push('정관 제13조에 따라 ' + C.particle(ins.map(function (e) { return nameOf(x, e.member); }).join(', '), '을', '를') + ' 대표사원으로 선임하는 것');
      agendas.push({ title: '대표사원 ' + (ins.length ? '선임' : '사임') + '의 건', skip: '', text: t.join(' ').replace(/승인하고$/, '승인하는 것') });
    }
    var addrs = eventsOf(x, 'addr');
    if (addrs.length) agendas.push({ title: '사원 주소 변경의 건', skip: '',
      text: addrs.map(function (e) { var m = a.byId[e.member]; return '사원 ' + m.name + '의 주소를 «' + m.before.addr + '»에서 «' + m.addr + '»(으)로'; }).join(', ') + ' 변경하는 것' });
    ['brAdd', 'brMove', 'brClose'].forEach(function (ty) {
      var evs = eventsOf(x, ty); if (!evs.length) return;
      var lab = { brAdd: '설치', brMove: '이전', brClose: '폐지' }[ty];
      agendas.push({ title: '분사무소 ' + lab + '의 건', skip: '',
        text: evs.map(function (e) {
          var b = a.brById[e.branch];
          if (ty === 'brAdd') return b.addr + '에 ' + b.name + '를 설치';
          if (ty === 'brMove') return b.name + ' 소재지를 «' + b.before.addr + '»에서 «' + b.addr + '»(으)로 이전';
          return b.name + '(' + b.addr + ')를 폐지';
        }).join(', ') + '하는 것' });
    });
    if (a.charterChanged) agendas.push({ title: '정관 변경의 건', skip: '',
      text: '위 의결에 따라 정관 ' + a.arts.map(function (n) { return '제' + n + '조'; }).join('·') + '를 별첨 신·구조문 대비표와 같이 변경하는 것' });

    var body = D.title('임시사원총회 의사록') + SP() +
      P('1. 소집통지일 : ' + C.dotDate(c.dates.notice || md(x))) +
      P('2. 개최장소 : ' + c.meeting.place) +
      P('3. 개최일시 : ' + C.dotDate(md(x)) + ' ' + C.timeKo(c.meeting.time)) +
      P('4. 총사원수 : ' + att.length + '명') +
      P('5. 출석사원수 : ' + att.length + '명') + SP() +
      CT('( 회 의 내 역 )') + SP() +
      PB('1. 임시사원총회 소집 경과 및 의장선출') +
      P(fn + '의 사원인 ' + C.particle(names.join(', '), '이', '가') + ' ' + C.particle(agendas.map(function (g) { return g.title.replace(/의 건.*$/, ''); }).join(', '), '을', '를') +
        ' 의안으로 하여 ' + C.dotDate(md(x)) + ' ' + C.timeKo(c.meeting.time) + '에 ' + c.meeting.place + '에서 임시사원총회를 개최하다.') +
      P('정각에 사회자 ' + C.particle(chair.name, '이', '가') + ' 금일의 총회가 개회정족수에 달하였으므로 회의가 성립됨을 밝히고 회의 진행상 의장을 선임할 것을 구한다.' +
        (others.length ? ' 이에 ' + C.particle(others.join(', '), '이', '가') + ' 사회자인 ' + C.particle(chair.name, '을', '를') + ' 의장으로 권유, ' + C.particle(chair.name, '은', '는') + ' 즉석에서 취임을 승낙하고,' : '') +
        ' 개회를 선언한 후 의안의 심의에 들어가다.') + SP() +
      PB('2. 의사의 경과요령과 의안별 의결의 결과') +
      P('의장은 각 의안별로 안건을 상정, 출석사원의 과반수(정관에서 따로 정한 의안은 그 의결정족수) 찬성을 요건으로 의결할 것임을 밝히다.') + SP();
    agendas.forEach(function (g, i) {
      body += PB('제 ' + (i + 1) + '호 의안 : ' + g.title) +
        P('의장 : ' + g.text + '을 의안으로 제안하고 의결에 붙이다.');
      att.forEach(function (m) {
        body += P('   ' + m.name + ' : ' + (g.skip === m.id ? '특별한 이해관계가 있어 의결권을 행사하지 아니하다.' : '동의하다.'));
      });
      body += P('의장 : ' + (g.skip ? '의결권 있는 ' : '') + '출석사원 전원 찬성으로 ' + g.title.replace(/의 건/, '') + ' 건이 의결되었음을 선포하다.') + SP();
    });
    body += P('이상으로 의안 전부의 심의를 마쳤으므로 의장은 폐회를 선언하다.' + (c.meeting.endTime ? ' (폐회 ' + C.timeKo(c.meeting.endTime) + ')' : '')) + SP() +
      P('위의 의결을 명확히 하기 위하여 의사 참가자가 다음과 같이 기명날인한다.') + SP() +
      CT(C.koDate(md(x))) + SP() + RT(fn);
    att.forEach(function (m) { body += sign(roleBefore(m), m.name); });
    return { key: 'minutes', label: '임시사원총회 의사록', body: body, margin: doc.margin };
  }

  /* ── 2. 총사원 동의서 ── */
  function consent(x) {
    var doc = D.begin('plain'), a = x.after, fn = firmName(x);
    var secs = [];
    var joins = eventsOf(x, 'join');
    if (joins.length) secs.push(['본 회사의 사원을 다음과 같이 입사시킨다.', joins.map(function (e, i) {
      var m = a.byId[e.member];
      var acq = m.acq.length ? ' (사원 ' + m.acq.map(function (q) { return q.fromName + '의 지분 금 ' + C.won(q.amount) + '원 양수'; }).join(', ') + ')' : '';
      var kind = C.normInvest(m.invest).cash > 0 ? C.inKindLines(m.invest) : [];
      return [(i + 1) + ') 사원 ' + m.name + ' (' + R(x, m) + ')', '    출자 : ' + C.investText(m.invest, 'charter') + acq + ', 전부이행']
        .concat(kind.length ? ['    현물재산 : ' + kind.join(', ')] : [])
        .concat(['    주소 : ' + m.addr, '    입사 연월일 : ' + onDate(x, e)]);
    })]);
    var leaves = eventsOf(x, 'leave');
    if (leaves.length) secs.push(['본 회사 사원의 퇴사 및 지분에 관한 사항을 다음과 같이 정한다.', leaves.map(function (e, i) {
      var m = a.byId[e.member], out = [(i + 1) + ') 사원 ' + m.name + ' (' + R(x, m) + ')', '    ' + shareText(x, m) + '하여 퇴사', '    퇴사 연월일 : ' + onDate(x, e)];
      (m.leaveShare.to || []).forEach(function (t) {
        var r = a.byId[t.member];
        if (r && !r.isNew) out.push('    사원 ' + r.name + ' (' + R(x, r) + ') — 사원 ' + m.name + '의 지분 금 ' + C.won(t.amount) + '원을 양수하여 출자금 총액을 금 ' + C.won(C.normInvest(r.invest).cash) + '원으로 변경, 전부이행 (변경 연월일 : ' + onDate(x, e) + ')');
      });
      return out;
    })]);
    var ins = eventsOf(x, 'repIn'), outs = eventsOf(x, 'repOut');
    if (ins.length || outs.length) {
      var rows = [], k = 0;
      outs.forEach(function (e) { var m = a.byId[e.member]; rows.push([(++k) + ') 대표사원직 ' + (e.byLeave ? '퇴임' : '사임') + ' — ' + m.name + ' (' + R(x, m) + ')', '    ' + (e.byLeave ? '퇴임' : '사임') + ' 연월일 : ' + onDate(x, e)]); });
      ins.forEach(function (e) { var m = a.byId[e.member]; rows.push([(++k) + ') 취임한 대표사원 — ' + m.name + ' (' + R(x, m) + ')', '    주소 : ' + m.addr, '    취임 연월일 : ' + onDate(x, e)]); });
      secs.push(['본 회사 정관 제13조 및 총사원의 동의로 대표사원을 다음과 같이 변경한다.', rows]);
    }
    var addrs = eventsOf(x, 'addr');
    if (addrs.length) secs.push(['사원의 주소를 다음과 같이 변경한다.', addrs.map(function (e, i) {
      var m = a.byId[e.member];
      return [(i + 1) + ') 사원 ' + m.name + (m.rep ? '(대표사원)' : ''), '    종전 주소 : ' + m.before.addr, '    변경 주소 : ' + m.addr, '    변경 연월일 : ' + onDate(x, e)];
    })]);
    var brs = a.events.filter(function (e) { return /^br/.test(e.type); });
    if (brs.length) secs.push(['분사무소를 다음과 같이 정한다.', brs.map(function (e, i) {
      var b = a.brById[e.branch];
      if (e.type === 'brAdd') return [(i + 1) + ') 분사무소 설치 — ' + b.name, '    소재지 : ' + b.addr, '    설치 연월일 : ' + onDate(x, e)];
      if (e.type === 'brMove') return [(i + 1) + ') 분사무소 이전 — ' + b.name, '    종전 소재지 : ' + b.before.addr, '    변경된 소재지 : ' + b.addr, '    이전 연월일 : ' + onDate(x, e)];
      return [(i + 1) + ') 분사무소 폐지 — ' + b.name, '    소재지 : ' + b.addr, '    폐지 연월일 : ' + onDate(x, e)];
    })]);
    if (a.charterChanged) {
      var arts = C.articles(a, x.rrn);
      secs.push(['위 사항에 따라 본 회사의 정관 일부를 다음과 같이 변경한다.', a.arts.map(function (n) { return arts[n].neu; })]);
    }
    var body = D.title('총사원 동의서') + SP() + P('총사원 동의에 의하여 다음의 사항을 결의한다.') + SP();
    secs.forEach(function (s, i) {
      body += PB((i + 1) + '. ' + s[0]);
      s[1].forEach(function (lines) { body += list(lines.map(function (l) { return '   ' + l; })); });
      body += SP();
    });
    body += P('위 동의사실을 명확히 하기 위하여 총사원이 이에 기명날인 또는 서명한다.') + SP() + CT(C.dotDate(md(x))) + SP() + RT(fn);
    attendees(x).forEach(function (m) { body += sign(roleBefore(m), m.name); });
    joins.forEach(function (e) { body += sign('입사 사원', a.byId[e.member].name); });
    if (a.charterChanged) body += SP() + NOTE('[별첨] 정관 변경 신·구조문 대비표');
    return { key: 'consent', label: '총사원 동의서', body: body, margin: doc.margin };
  }

  /* ── 3. 신·구조문 대비표 ── */
  function compare(x) {
    var doc = D.begin('plain');
    var rows = [[hd('관련 조항'), hd('개정 전'), hd('개정 후'), hd('비고')]];
    C.compareRows(x.after, x.rrn).forEach(function (r) {
      rows.push([{ t: r.title, valign: 'center' }, r.old.join('\n'), r.neu.join('\n'), { t: r.note, valign: 'center' }]);
    });
    var body = D.title('정관 변경 신·구조문 대비표', firmName(x)) + SP() + T(rows, [0.15, 0.36, 0.36, 0.13], doc) + SP() + CT('< 변경 없는 부분은 현행 정관과 같음 >');
    return { key: 'compare', label: '정관 변경 신·구조문 대비표', body: body, margin: doc.margin };
  }

  /* ── 4. 정관변경 이유서 ── */
  function reason(x) {
    var doc = D.begin('plain'), a = x.after, fn = firmName(x);
    var what = { 3: '주사무소와 분사무소의 소재지', 5: '사원의 성명과 주소', 6: '사원의 출자에 관한 사항', 13: '회사의 대표사원' };
    var items = a.arts.map(function (n) { return what[n]; });
    var body = D.title('정관변경 이유서') + SP() + SP() +
      P(C.particle(fn, '은', '는') + ' ' + C.koDate(md(x)) + ' 임시사원총회(총사원 동의)의 결의로 ' + C.summary(a) + '하기로 함에 따라, ' + C.LAW.charter + '에 규정된 정관의 기재사항 중 ' +
        C.particle(items.join(', '), '이', '가') + ' 변경되어 정관 ' + a.arts.map(function (n) { return '제' + n + '조'; }).join('·') + '를 변경함.') + SP() + SP() +
      CT(C.dotDate(md(x))) + SP() + RT(fn + '    대표사원    ' + repNames(x) + '    (인)');
    return { key: 'reason', label: '정관변경 이유서', body: body, margin: doc.margin };
  }

  /* ── 5. 노무법인 정관 변경인가 신청서 (시행규칙 별지 제26호서식 꼴) ── */
  function apply(x) {
    var doc = D.begin('gov'), a = x.after, f = x.base.firm;
    var reps = repsAfter(x);
    var lic = reps.map(function (m) { return m.licenseNo || ''; }).filter(Boolean).join(', ');
    var changes = [];
    a.arts.forEach(function (n) { changes.push('정관 ' + C.ART_TITLE[n].replace(/【/, '(').replace(/】/, ')') + ' 변경'); });
    var detail = C.summary(a);
    var body = D.formHead('공인노무사법 시행규칙', '별지 제26호서식', '') +
      D.title('노무법인 정관 변경인가 신청서') + SP() +
      D.infoTable([['접수번호', '', '접수일', '']], doc) +
      D.infoTable([['대표자 성명', repNames(x), '등록번호', lic]], doc, { side: '신청인' }) +
      D.infoTable([['명칭', f.name, '인가 번호', f.approvalNo], ['주사무소 소재지', f.hq], ['전화번호', f.phone]], doc, { side: '노무법인' }) +
      D.infoTable([['변경 내용', changes.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') + '\n(' + detail + ')']], doc, { rowH: [4200] }) + SP() +
      P(C.LAW.apply + '에 따라 위와 같이 노무법인 정관 변경인가를 신청합니다.') + SP() +
      D.dateLine(x.c.dates.approvalApply || '') +
      RT('신청인    ' + f.name + '  대표사원  ' + repNames(x) + '    (서명 또는 인)') + SP() +
      D.receiver(f.authority || '          지방고용노동청(지청)장', doc) + SP() +
      D.attachBox(['1. 정관 변경 이유서 1부', '2. 정관 변경안 1부', '3. 정관 변경에 관한 노무법인 사원총회 회의록 사본 1부'], '없음', doc) +
      NOTE('※ 서식은 공인노무사법 시행규칙 별지 제26호서식(같은 규칙 제10조의4) 기준입니다. 제출 전 관할 고용노동관서의 최신 서식과 맞는지 확인하십시오.');
    return { key: 'apply', label: '노무법인 정관 변경인가 신청서', body: body, margin: doc.margin };
  }

  /* ── 6. 변경 정관 ── 정관 본문이 있으면 전문, 없으면 바뀐 조문만 */
  function charter(x) {
    var doc = D.begin('rule'), a = x.after;
    /* 개정 연혁은 총회일 — 이 법인 정관의 «(○. ○. ○. 개정)»은 사원총회 날짜다 */
    var full = x.base.charter ? C.charterFull(x.base.charter, a, x.rrn, md(x)) : null;
    var body;
    if (full && full.text) {
      body = D.fromText(full.text, doc);
      if (full.missing.length) body += SP() + NOTE('※ 정관 본문에서 ' + full.missing.map(function (n) { return '제' + n + '조'; }).join('·') + '를 찾지 못해 바꾸지 못했습니다 — 손으로 고치십시오.');
    } else {
      var arts = C.articles(a, x.rrn), lines = [];
      a.arts.forEach(function (n) { lines = lines.concat(arts[n].neu, ['']); });
      body = D.title('정관(변경 조문)', firmName(x)) + SP() + D.fromText(lines.join('\n'), doc, { noTitle: true }) + SP() +
        NOTE('※ 정관 전문은 «등기 현황» 탭에 정관 본문을 넣어 두면 바뀐 조문을 끼운 전문으로 만들어집니다. 그 전에는 보관 중인 최신 정관에서 위 조문만 바꾸십시오.');
    }
    return { key: 'charter', label: '변경 정관', body: body, margin: doc.margin };
  }

  /* ── 7. 사원(출자자) 명부 ── */
  function roster(x) {
    var doc = D.begin('plain'), a = x.after, f = x.base.firm;
    var total = a.members.reduce(function (s, m) { return s + C.normInvest(m.invest).cash; }, 0);
    var rows = [[hd('성 명'), hd('주민등록번호'), hd('주 소'), hd('출자'), hd('지분율'), hd('지 위'), hd('(인)')]];
    a.members.forEach(function (m) {
      var iv = C.normInvest(m.invest);
      rows.push([{ t: m.name, align: 'center' }, { t: R(x, m), align: 'center' }, m.addr,
        { t: iv.cash ? C.won(iv.cash) + '원' + (iv.inKind ? '\n(현물)' : '') + (iv.labor ? '\n노무출자' : '') : (iv.labor ? '노무출자' : '-'), align: 'right' },
        { t: iv.cash && total ? (Math.round(iv.cash * 10000 / total) / 100).toFixed(2) + '%' : '-', align: 'center' },
        { t: m.rep ? '대표사원' : '사원', align: 'center' }, '']);
    });
    rows.push([{ t: '합 계', colSpan: 3, align: 'center', cp: CP.f10b }, null, null, { t: C.won(total) + '원', align: 'right', cp: CP.f10b }, { t: total ? '100%' : '-', align: 'center' }, '', '']);
    var body = D.title(firmName(x) + ' 사원(출자자) 명부', C.koDate(effDate(x)) + ' 현재') + SP() +
      T(rows, [0.1, 0.17, 0.33, 0.14, 0.08, 0.1, 0.08], doc) + SP() +
      P('위 사원명부는 본사에 비치된 사원명부와 대조하여 틀림이 없음을 증명합니다.') + SP() +
      CT(C.koDate(effDate(x))) + SP() + RT(f.name) + RT(f.hq) + RT('대표사원    ' + repNames(x) + '    (인)') +
      NOTE('※ 지분율은 현금 출자 합계에 대한 비율(소수 셋째 자리에서 반올림)입니다. 노무출자는 지분율을 따로 정하지 않았습니다.');
    return { key: 'roster', label: '사원(출자자) 명부', body: body, margin: doc.margin };
  }

  /* ── 8. 취임승낙서 (대표사원마다 한 쪽) ── */
  function accept(x) {
    var doc = D.begin('plain'), fn = firmName(x), body = '';
    eventsOf(x, 'repIn').forEach(function (e, i) {
      var m = x.after.byId[e.member];
      body += D.title('취 임 승 낙 서', '', { pageBreak: i > 0 }) + SP() + SP() +
        P('본인은 ' + C.koDate(md(x)) + ' ' + fn + ' 임시사원총회(총사원 동의)에서 대표사원으로 선임되었으므로 그 취임을 승낙합니다.') + SP() + SP() +
        CT(C.koDate(md(x))) + SP() + RT('대표사원    ' + m.name + '    (인)') + RT('주민등록번호 : ' + R(x, m)) + RT('주    소 : ' + m.addr) + SP() + SP() +
        PB(fn + ' 귀중');
    });
    return body ? { key: 'accept', label: '취임승낙서', body: body, margin: doc.margin } : null;
  }

  /* ── 9. 대표사원 사임서 ── */
  function resign(x) {
    var doc = D.begin('plain'), fn = firmName(x), body = '';
    eventsOf(x, 'repOut').filter(function (e) { return !e.byLeave; }).forEach(function (e, i) {
      var m = x.after.byId[e.member];
      body += D.title('사  임  서', '', { pageBreak: i > 0 }) + SP() + SP() +
        P('본인은 ' + C.koDate(e.date) + '자로 ' + fn + ' 대표사원직을 사임하고자 하오니 처리하여 주시기 바랍니다. (사원 지위는 유지합니다)') + SP() + SP() +
        CT(C.koDate(e.date)) + SP() + RT('대표사원    ' + m.name + '    (인)') + RT('주민등록번호 : ' + R(x, m)) + RT('주    소 : ' + m.addr) + SP() + SP() +
        PB(fn + ' 귀중');
    });
    return body ? { key: 'resign', label: '대표사원 사임서', body: body, margin: doc.margin } : null;
  }

  /* ── 10. 퇴사원 ── */
  function leaveNote(x) {
    var doc = D.begin('plain'), fn = firmName(x), body = '';
    eventsOf(x, 'leave').forEach(function (e, i) {
      var m = x.after.byId[e.member];
      body += D.title('퇴  사  원', '', { pageBreak: i > 0 }) + SP() +
        D.infoTable([['소    속', fn], ['직    위', '공인노무사(사원' + (m.before && m.before.rep ? ', 대표사원' : '') + ')'], ['성    명', m.name],
          ['주민등록번호', R(x, m)], ['사원 기간', (m.joinDate ? C.dotDate(m.joinDate) : '      .    .    .') + ' ~ ' + C.dotDate(e.date)], ['퇴사 사유', m.leaveReason || '']], doc) + SP() +
        P('상기 본인은 ' + (m.leaveReason || '개인 사정') + '(으)로 ' + C.koDate(e.date) + '부로 ' + fn + ' 사원에서 퇴사하고자 하오니 승인하여 주시기 바랍니다.') + SP() +
        CT(C.koDate(e.date)) + SP() + RT('신청인 : 사원    ' + m.name + '    (인)') + SP() + PB(fn + ' 귀중');
    });
    return body ? { key: 'leaveNote', label: '퇴사원', body: body, margin: doc.margin } : null;
  }

  /* ── 11. 지분 양도·양수 계약서 (초안) ── */
  function transfer(x) {
    var doc = D.begin('plain'), fn = firmName(x), body = '', k = 0;
    eventsOf(x, 'leave').forEach(function (e) {
      var m = x.after.byId[e.member], s = m.leaveShare || {};
      if (s.mode !== 'transfer' || !s.to || !s.to.length) return;
      var tos = s.to.map(function (t) { return x.after.byId[t.member]; });
      body += D.title('지분 양도·양수 계약서', '', { pageBreak: k++ > 0 }) +
        NOTE('※ 초안 — 양도 대금·지급 방법 등 당사자 합의 사항을 채우고 확인한 뒤 날인하십시오.') + SP() +
        P('양도인 사원 ' + m.name + '(이하 «양도인»)과 양수인 ' + tos.map(function (t) { return '사원 ' + t.name; }).join(', ') + '(이하 «양수인»)은 ' + fn + '(이하 «법인»)에 대한 양도인의 출자지분에 관하여 다음과 같이 계약한다.') + SP() +
        PB('제1조(양도 목적물)') + P('양도인은 법인에 대한 자신의 출자지분 금 ' + C.won(s.cash) + '원을 다음과 같이 양수인에게 양도하고, 양수인은 이를 양수한다.') +
        list(s.to.map(function (t, i) { return '   ' + (i + 1) + '. 사원 ' + t.name + ' : 금 ' + C.won(t.amount) + '원'; })) +
        PB('제2조(양도일)') + P('지분 양도일은 ' + C.koDate(e.date) + '로 한다.') +
        PB('제3조(양도 대금)') + P('양도 대금은 금                    원으로 하고, 지급 방법과 시기는 당사자가 따로 정한다.') +
        PB('제4조(효력)') + P('이 계약은 법인 사원총회(총사원 동의)의 승인을 받은 때 효력이 생긴다.') +
        PB('제5조(협력)') + P('양도인은 이 계약에 따른 정관변경 인가 및 변경등기에 필요한 서류의 작성·날인에 협력한다.') + SP() +
        CT(C.koDate(e.date)) + SP() +
        T([[hd('구 분'), hd('성 명'), hd('주민등록번호'), hd('주 소'), hd('(인)')],
          [{ t: '양도인', align: 'center' }, { t: m.name, align: 'center' }, { t: R(x, m), align: 'center' }, m.before ? m.before.addr || m.addr : m.addr, '']]
          .concat(tos.map(function (t) { return [{ t: '양수인', align: 'center' }, { t: t.name, align: 'center' }, { t: R(x, t), align: 'center' }, t.addr, '']; })),
          [0.12, 0.14, 0.2, 0.42, 0.12], doc);
    });
    return body ? { key: 'transfer', label: '지분 양도·양수 계약서', body: body, margin: doc.margin } : null;
  }

  /* ── 12. 위임장(등기신청 대리) ── */
  function poa(x) {
    var doc = D.begin('plain'), f = x.base.firm, ag = x.c.agent;
    var body = D.title('위  임  장') + SP() + PB('(대리인)') +
      D.infoTable([['성    명', ag.name + (ag.office ? ' (' + ag.office + ')' : '')], ['주    소', ag.addr], ['연 락 처', ag.phone]], doc) + SP() +
      P('본 법인은 위 사람을 대리인으로 정하고 다음 사항에 관한 권한을 위임합니다.') + SP() + CT('다    음') + SP() +
      P('1. ' + f.name + '의 ' + (C.purpose(x.after) || '변경등기') + ' 신청서의 작성·제출, 보정 및 취하 등 등기신청에 관한 일체의 권한') +
      P('2. 위 등기에 필요한 등록면허세·등기신청수수료의 납부와 등기사항증명서 등의 발급 신청') + SP() +
      CT(C.koDate(x.c.dates.file || md(x))) + SP() + RT('위임인(신청인)') +
      RT('명    칭 : ' + f.name) + RT('주사무소 : ' + f.hq) + RT('대표사원 : ' + repNames(x) + '    (법인인감)');
    return { key: 'poa', label: '위임장(등기신청 대리)', body: body, margin: doc.margin };
  }

  /* ── 13. 위임장(의사록 공증 촉탁) ── */
  function notaryPoa(x) {
    var doc = D.begin('plain'), proxy = chairOf(x);
    var givers = attendees(x).filter(function (m) { return m.id !== proxy.id; });
    var rows = [[hd('위임인'), hd('성 명'), hd('주 소'), hd('(인감)')]];
    givers.forEach(function (m) { rows.push([{ t: roleBefore(m), align: 'center' }, { t: m.name, align: 'center' }, m.addr, '']); });
    if (!givers.length) rows.push(['', '', '', '']);
    var body = D.title('위  임  장', '(공증용)') + SP() +
      D.infoTable([['성    명', proxy.name], ['주    소', proxy.addr]], doc, { side: '수임인' }) + SP() +
      P('위의 사람을 본인의 대리인으로 정하여 공증인가 ' + (x.c.notary || '                    ') + ' 사무소에서 다음 사서증서의 인증을 촉탁하는 일체의 권한을 위임합니다. (자기대리 및 쌍방대리 행위를 승낙함)') + SP() +
      CT('다    음') + SP() +
      P(C.koDate(md(x)) + '자 ' + firmName(x) + ' 임시사원총회 의사록 및 총사원 동의서를 인증받는 일체의 행위') + SP() +
      CT(C.koDate(x.c.dates.notarize || md(x))) + SP() + T(rows, [0.18, 0.16, 0.5, 0.16], doc, { rowH: [2000].concat(givers.map(function () { return 3000; })) });
    return { key: 'notaryPoa', label: '위임장(공증용)', body: body, margin: doc.margin };
  }

  /* ── 14. 변경등기 신청서 — 직접 신청(기본)이면 제출용, 법무사에게 맡기면 법무사 확인용 초안 (대표 2026-11-15 «법무사 없이 직접») ── */
  function attachList(x) {
    var a = x.after, ev = {}, out = [], self = x.c.filing !== 'agent';
    a.events.forEach(function (e) { ev[e.type] = (ev[e.type] || 0) + 1; });
    out.push('1. 총사원 동의서(임시사원총회 의사록) — 공증인 인증 1통');
    if (a.charterChanged) { out.push('1. 정관변경 인가증 사본 1통'); out.push('1. 정관(변경 후) 1통'); }
    out.push('1. 사원명부 1통');
    if (ev.join) out.push('1. 입사 사원 주민등록표 초본·인감증명서 각 ' + ev.join + '통');
    if (ev.leave) out.push('1. 퇴사원 ' + ev.leave + '통, 퇴사 사원 인감증명서');
    var tr = a.left.filter(function (m) { return m.leaveShare && m.leaveShare.mode === 'transfer' && m.leaveShare.to.length; }).length;
    if (tr) out.push('1. 지분 양도·양수 계약서 ' + tr + '통');
    if (ev.repIn) { out.push('1. 취임승낙서 ' + ev.repIn + '통, 취임 대표사원 인감증명서'); out.push('1. 인감신고서(새 대표사원) ' + ev.repIn + '통'); }
    var rs = a.events.filter(function (e) { return e.type === 'repOut' && !e.byLeave; }).length;
    if (rs) out.push('1. 대표사원 사임서 ' + rs + '통, 사임 대표사원 인감증명서');
    var cp = C.costPlan(a);
    if (cp.alt) out.push('1. 재산출자 이행 증명서 1통');
    if (cp.resOther) out.push('1. 주민등록표 초본(대표사원 취임·주소변경 사원) ' + cp.resOther + '통');
    out.push('1. 등록면허세 영수필 통지서(등기소 통보용)·영수필확인서 각 1통');
    out.push('1. 등기신청수수료 영수필확인서 1통');
    if (!self) out.push('1. 위임장 1통');
    return out;
  }
  function request(x) {
    var doc = D.begin('plain'), a = x.after, f = x.base.firm, ag = x.c.agent, self = x.c.filing !== 'agent';
    var reg = C.regItems(a, x.rrn), cp = C.costPlan(a);
    var rows = [[hd('구 분'), hd('등기할 사항')]];
    reg.forEach(function (r) { rows.push([{ t: r.group, align: 'center', valign: 'center' }, r.lines.join('\n')]); });
    if (reg.length === 0) rows.push(['', '']);
    /* 세액·수수료 — 실제 납부한 영수필확인서 금액으로 고쳐 적는다(이 앱 값은 예상) */
    var taxRows = [[hd('구 분'), hd('금 액'), hd('비 고')]];
    cp.rows.filter(function (r) { return r.kind === 'tax'; }).forEach(function (r) { taxRows.push([r.label.replace(/^등록면허세 — /, '등록면허세 · '), { t: C.won(r.amount) + '원', align: 'right' }, r.payTo]); });
    taxRows.push(['지방교육세', { t: C.won(cp.edu) + '원', align: 'right' }, '등록면허세의 20%']);
    taxRows.push(['등기신청수수료', { t: C.won(cp.nFee * C.FEES.filing.visit) + '원', align: 'right' }, '등기 목적 ' + cp.nFee + '건(방문 신청)']);
    var body = D.title('노무법인 변경등기 신청서', self ? '특수법인 변경등기' : '특수법인 변경등기 · 법무사 확인용 초안') +
      (self ? NOTE('※ 세액·수수료는 예상 금액입니다. 실제 납부한 영수필확인서 금액과 다르면 고쳐 적으십시오.')
        : NOTE('※ 이 신청서는 법무사가 확인할 초안입니다. 실제 신청은 법무사가 등기소 양식(전자신청 포함)으로 합니다.')) + SP() +
      D.infoTable([['명    칭', f.name, '등기번호', f.regNo], ['주사무소', f.hq], ['등기의 목적', C.purpose(a)], ['등기의 사유', C.reason(a)]], doc,
        { rowH: [3120, 3120, 3120, 5200] }) + SP() +
      D.bandTitle('등 기 할 사 항', doc) + T(rows, [0.16, 0.84], doc) + SP() +
      D.bandTitle('세 액 · 수 수 료', doc) + T(taxRows, [0.42, 0.2, 0.38], doc) + SP() +
      D.bandTitle('첨 부 서 면', doc) + list(attachList(x)) + SP() +
      D.dateLine(x.c.dates.file || '') +
      RT('신청인  명    칭 : ' + f.name) + RT('주사무소 : ' + f.hq) + RT('대표사원 : ' + repNames(x) + '    (법인인감)') +
      (self ? '' : RT('대리인 : ' + (ag.name || '          ') + (ag.office ? ' (' + ag.office + ')' : '') + '    (인)')) + SP() +
      PB((f.court || '          등기소') + ' 귀중');
    return { key: 'request', label: self ? '변경등기 신청서' : '변경등기 신청서(초안)', body: body, margin: doc.margin };
  }

  /* ── 15. 변경등기 지연 사유서 ── */
  function delay(x) {
    var doc = D.begin('plain'), a = x.after, f = x.base.firm, c = x.c;
    var dl = C.deadline(a, x.today);
    var body = D.title('변경등기 지연 사유서') + SP() + SP() +
      P(C.particle(f.name, '은', '는') + ' ' + C.koDate(md(x)) + ' 임시사원총회(총사원 동의)의 결의로 ' + C.summary(a) + '하기로 하였습니다.' +
        (c.dates.approvalApply ? ' 그리고 ' + C.koDate(c.dates.approvalApply) + ' ' + (f.authority || '관할 지방고용노동관서') + '에 노무법인 정관 변경인가를 신청하였습니다.' : '')) +
      P((c.dates.approvalGet ? '정관변경 인가증은 ' + C.koDate(c.dates.approvalGet) + '에 받았으나, ' : '') +
        '[지연 사유를 적으십시오]로 변경등기 신청 기간' + (dl && dl.due ? '(' + C.koDate(dl.due) + '까지)' : '') + '을 넘기게 되었습니다.') +
      P('이를 참고하시어 변경등기 신청에 불이익이 없도록 처리하여 주시기 바랍니다.') + SP() +
      P('첨부자료 1. 노무법인 정관 변경인가 신청서 접수증') + P('첨부자료 2. 노무법인 정관 변경인가증') + SP() +
      CT(C.koDate(c.dates.file || x.today)) + SP() + RT(f.name + '    대표사원    ' + repNames(x) + '    (인)') + SP() + PB((f.court || '          등기소') + ' 귀중');
    return { key: 'delay', label: '변경등기 지연 사유서', body: body, margin: doc.margin };
  }

  /* ── 16. 필요서류 확인표 ── */
  var SRC_KO = { '법무사': '법무사 안내', '서류': '이 앱 서류', '지난 서류': '지난 등기', '법령': '법령', '확인 필요': '확인 필요' };
  function checklistDoc(x) {
    var doc = D.begin('plain'), a = x.after, c = x.c;
    var rows = [[hd('확인'), hd('구 분'), hd('서 류'), hd('내용·기한'), hd('근 거')]];
    C.checklist(a).forEach(function (it) {
      var ck = c.checks[it.key] || {};
      var st = C.staleCheck(it, ck, a, x.today);
      var extra = ck.issued ? ' · 발급 ' + ck.issued + (st && st.stale ? ' ⚠ 3개월 지남' : '') : '';
      rows.push([{ t: ck.ok ? '☑' : '☐', align: 'center' }, { t: it.group, align: 'center' }, it.label, it.detail + extra + (ck.note ? ' · ' + ck.note : ''), { t: SRC_KO[it.src] || it.src, align: 'center' }]);
    });
    var dl = C.deadline(a, x.today);
    var body = D.title('필요서류 확인표', c.title + ' · ' + C.koDate(x.today) + ' 기준') + SP() +
      (dl && dl.none ? P('등기 기한 : 없음 — 등기할 사항이 없습니다' + (a.charterChanged ? '(정관변경 인가만)' : '')) : dl && dl.due ? P('등기 기한 : ' + C.koDate(dl.due) + ' (' + dl.basis + ' ' + dl.from + ' + 2주일)') : P('등기 기한 : ' + (a.charterChanged ? '정관변경 인가증을 받은 날부터 2주일' : '변경 연월일부터 2주일'))) +
      NOTE('※ ' + C.DEADLINE_NOTE) + SP() +
      T(rows, [0.06, 0.13, 0.31, 0.38, 0.12], doc, { sz: SZ.p9, cp: CP.f9 }) + SP() +
      NOTE('근거 — 법무사 안내: 법무사 «임원변경 등기신청 시 필요서류»(2025. 2. 14.) · 지난 등기: 지난 변경등기 첨부서면 · 확인 필요: 담당 법무사·노무사 확인 · 등본·인감은 발급일부터 3개월 이내');
    return { key: 'checklist', label: '필요서류 확인표', body: body, margin: doc.margin };
  }

  var MAKERS = { minutes: minutes, consent: consent, compare: compare, reason: reason, apply: apply, charter: charter, roster: roster,
    accept: accept, resign: resign, leaveNote: leaveNote, transfer: transfer, poa: poa, notaryPoa: notaryPoa, request: request,
    delay: delay, checklist: checklistDoc };

  function make(key, x) { var f = MAKERS[key]; return f ? f(x) : null; }
  /* keys 를 안 주면 docPlan 이 «켜 둔» 서류 전부 */
  function build(x, keys) {
    var want = keys || C.docPlan(x.after, { today: x.today }).filter(function (d) { return d.on; }).map(function (d) { return d.key; });
    return want.map(function (k) { return make(k, x); }).filter(function (d) { return d && d.body; });
  }
  /* ★ 줄 배치 캐시(linesegarray)를 빼고 싣는다 (2026-11-14 실측).
     조립기(hwpx_gen.js)는 문단마다 캐시의 세로 자리를 0 부터 다시 적는다. 그래서 여러 줄 문단 뒤에 오는 문단은
     «세로 자리가 줄었다 = 새 쪽»으로 읽혀, 미리보기 엔진(rhwp)이 문단마다 쪽을 넘겼다(문단 5개 → 3쪽).
     캐시를 빼면 엔진이 스스로 배치한다(같은 문서 → 1쪽). 캐시는 OWPML 에서 선택 항목이라 한글도 스스로 배치한다.
     ⚠ 공용 조립기는 고치지 않았다 — 다른 앱 서류가 같은 성질을 갖고 있어 따로 볼 일이다. */
  function noCache(body) { return String(body || '').replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, ''); }
  function fileOne(d) { return H.build([{ body: noCache(d.body), landscape: false, margin: d.margin }]); }
  function filePack(docs) { return H.build(D.pack(docs.map(function (d) { return Object.assign({}, d, { body: noCache(d.body) }); }))); }
  function safe(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60); }
  function fileName(x, d) {
    var day = (md(x) || x.today).replace(/-/g, '');
    return day + '_' + safe(x.c.title) + '_' + safe(d ? d.label : '등기서류_묶음') + '.hwpx';
  }

  return { context: context, make: make, build: build, fileOne: fileOne, filePack: filePack, fileName: fileName, attachList: attachList, KEYS: Object.keys(MAKERS) };
});
