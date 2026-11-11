/* ══════════════════════════════════════════════════════════════════════════
   푸른통합시스템 — 공공임단협 (알리오 공공기관 노동조합·임금·단체협약 API 통합비교 독립 프로그램)
   파일: js/pu-alio-union.js
   - 포털(enter.html) 자료함 줄의 「🤝 공공임단협」 타일 또는 오른쪽 앱바(pu-appbar.js)에서
     별개의 독립 프로그램(pu-alio-union.html, 창 이름 pureun-aliounion)으로 열린다.
   - 프로그램 안에서 기관명(또는 📋 상세팝업)을 누르면 기관별 노조·임단협·13대 쟁점·공시원문
     종합 팝업창(openOrganDetailModal)이 열린다.
   - 5대 공공·법령·노사 API(알리오 OpenAPI, 알리오 9대 공시 원문 API, 현행 노동법령 실시간 API,
     한국천문연구원 공휴일·국민연금/고용보험 pubdata API, 지방공기업·전국노조 OpenAPI)를 모두 연결한다.
   - 표 한 칸 한 줄(white-space:nowrap + text-overflow:ellipsis + title),
     맨 왼쪽 ☐ 고르기 칸(28px) + 번호(36px, tabular-nums), 폰 화면 16px 입력칸 규칙을 지킨다.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DATA_SCRIPT_URL = 'js/pu-alio-data.js?v=2';
  var STYLE_ID = 'pu-alio-union-css';
  var LS_KEY_PREFIX = 'pu_alio_datagokr_key_';

  var METRIC_DEFS = [
    { key: 'union_shop', label: '조합원 자격 (유니온숍/가입범위)', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제5조·제81조 제1항 제2호 단서(유니온숍)' },
    { key: 'timeoff_activity', label: '근로시간면제(타임오프)·조합활동', lawKey: '노동조합및노동관계조정법', lawArt: '24', lawTitle: '노조법 제24조(노동조합의 전임자·근로시간면제 한도)' },
    { key: 'check_off', label: '조합비 일괄공제·사무실 제공', lawKey: '노동조합및노동관계조정법', lawArt: '81', lawTitle: '노조법 제81조 제1항 제4호 단서(최소한의 규모의 노동조합 사무소 제공)' },
    { key: 'personnel_participation', label: '인사원칙 노조 관여 (합의/협의)', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조(정당한 이유 없는 전보·인사 제한) 및 제94조(취업규칙 변경)' },
    { key: 'discipline_committee', label: '징계위원회 구성·소명·재심', lawKey: '근로기준법', lawArt: '23', lawTitle: '근로기준법 제23조·제27조(해고·징계의 정당한 이유 및 서면통지)' },
    { key: 'work_hours_overtime', label: '근로시간·연장근로·유연근무', lawKey: '근로기준법', lawArt: '50', lawTitle: '근로기준법 제50조~제53조(법정근로시간 주 40시간·연장근로 한도)' },
    { key: 'paid_holidays_leave', label: '유급휴일·특별휴가·경조휴가', lawKey: '근로기준법', lawArt: '55', lawTitle: '근로기준법 제55조(관공서 공휴일 유급휴일)·제60조(연차유급휴가)' },
    { key: 'sick_leave_accident', label: '병가(유급병가)·산재보상', lawKey: '산업안전보건법', lawArt: '52', lawTitle: '근로기준법 제78조~제80조(업무상 재해보상) 및 산업안전보건법 제52조' },
    { key: 'maternity_childcare', label: '모성보호·육아휴직·가족돌봄', lawKey: '남녀고용평등과일ㆍ가정양립지원에관한법률', lawArt: '19', lawTitle: '근로기준법 제74조(출산전후휴가)·남녀고용평등법 제19조(육아휴직)' },
    { key: 'wage_bonus_allowance', label: '임금·상여금·수당·퇴직금', lawKey: '근로기준법', lawArt: '43', lawTitle: '근로기준법 제43조(임금 지급원칙)·제56조(가산임금)·퇴직급여법 제8조' },
    { key: 'welfare_education_housing', label: '복리후생·학자금·건강검진', lawKey: '근로자참여및협력증진에관한법률', lawArt: '20', lawTitle: '근로자참여법 제20조(복지증진 협의)·사내근로복지기금법 기준' },
    { key: 'retirement_age_peak', label: '정년·명예퇴직·고용안정', lawKey: '고용상연령차별금지및고령자고용촉진에관한법률', lawArt: '19', lawTitle: '고령자고용법 제19조(정년 60세 이상 의무화)' },
    { key: 'validity_auto_extension', label: '유효기간·효력 자동연장', lawKey: '노동조합및노동관계조정법', lawArt: '32', lawTitle: '노조법 제32조(단체협약 유효기간 3년 상한·3개월 자동연장 특칙)' }
  ];

  var TAXONOMY_LIST = [
    ['ALL', '전체 쟁점 분류'],
    ['UNION_SHOP', '총칙·조합원자격·유니온숍'],
    ['TIMEOFF', '노조전임·근로시간면제·홍보'],
    ['CHECKOFF', '조합비일괄공제·편의제공'],
    ['PERSONNEL', '인사원칙·승진·전보·채용'],
    ['DISCIPLINE', '징계·해고·신분보장'],
    ['WORK_HOURS', '근로시간·연장근로·유연근무'],
    ['LEAVE', '휴일·연차·특별휴가·경조휴가'],
    ['SICK_SAFETY', '병가·산업재해·안전보건'],
    ['MATERNITY', '모성보호·육아휴직·일가정양립'],
    ['WAGE', '임금·상여금·수당·퇴직금'],
    ['WELFARE', '복리후생·학자금·복지기금'],
    ['RETIREMENT', '정년·임금피크·고용안정'],
    ['BARGAINING', '단체교섭·노사협의·유효기간'],
    ['ETC', '기타/일반조항']
  ];

  // 실시간 노동관계법령 API (legalize-kr GitHub Raw — CORS 허용·인증키 불필요)
  var LAW_API_SOURCES = [
    { key: '노동조합및노동관계조정법', name: '노동조합 및 노동관계조정법', file: '법률(법률).md', mainArts: ['5', '24', '29', '29의2', '31', '32', '33', '81'] },
    { key: '근로기준법', name: '근로기준법', file: '법률(법률).md', mainArts: ['23', '27', '43', '50', '53', '55', '56', '60', '74', '93', '94'] },
    { key: '근로자참여및협력증진에관한법률', name: '근로자참여 및 협력증진에 관한 법률', file: '법률(법률).md', mainArts: ['4', '20', '21', '22', '26'] },
    { key: '남녀고용평등과일ㆍ가정양립지원에관한법률', name: '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', file: '법률.md', mainArts: ['18의2', '19', '19의2', '22의2'] },
    { key: '고용상연령차별금지및고령자고용촉진에관한법률', name: '고용상 연령차별금지 및 고령자고용촉진에 관한 법률', file: '법률.md', mainArts: ['19', '19의2'] },
    { key: '근로자퇴직급여보장법', name: '근로자퇴직급여 보장법', file: '법률.md', mainArts: ['4', '8', '9'] },
    { key: '산업안전보건법', name: '산업안전보건법', file: '법률.md', mainArts: ['24', '36', '52', '129'] }
  ];

  var lawCache = {};
  var latestAppHooks = null;
  var currentAuthUid = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeHttpUrl(rawUrl) {
    var s = String(rawUrl == null ? '' : rawUrl).trim();
    if (!s) return '';
    try {
      var u = new URL(s, 'https://www.alio.go.kr');
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      var host = (u.hostname || '').toLowerCase();
      if (host === 'www.alio.go.kr' || host === 'alio.go.kr' || host.endsWith('.alio.go.kr') || host.endsWith('.go.kr')) {
        return u.href;
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function worth(v) {
    var t = String(v == null ? '' : v).trim();
    return !!t && t !== '-' && t !== '—' && t !== 'null' && t !== 'None' && t !== '해당없음';
  }

  function fmtNum(n) {
    var v = Number(n || 0);
    return isFinite(v) ? v.toLocaleString('ko-KR') : '0';
  }

  function extractOrganMetrics(rawMetrics, aid) {
    var out = {};
    if (!rawMetrics || !aid) return out;
    if (Array.isArray(rawMetrics)) {
      rawMetrics.forEach(function (m) {
        if (m && m.apba_id === aid && m.metric_key) {
          out[m.metric_key] = m;
        }
      });
    } else if (typeof rawMetrics === 'object' && rawMetrics[aid]) {
      out = rawMetrics[aid] || {};
    }
    return out;
  }

  function getActiveUid() {
    if (currentAuthUid) return currentAuthUid;
    try {
      var u = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
      if (u && u.uid) return String(u.uid);
    } catch (e) {}
    return '';
  }

  function userLsKey(uid) {
    return uid ? (LS_KEY_PREFIX + uid) : '';
  }

  function parseLawMarkdown(md) {
    var s = String(md || '').replace(/\r\n?/g, '\n');
    var front = {};
    var body = s;
    var fm = /^---\n([\s\S]*?)\n---\n?/.exec(s);
    if (fm) {
      fm[1].split('\n').forEach(function (l) {
        var k = /^([^\s:-][^:]*):\s*(.*)$/.exec(l);
        if (k) front[k[1].trim()] = k[2].trim().replace(/^'|'$/g, '');
      });
      body = s.slice(fm[0].length);
    }
    var cut = body.search(/\n## 부칙/);
    var main = cut < 0 ? body : body.slice(0, cut);
    var arts = {};
    var re = /^#{3,6}\s*제(\d+)조(?:의(\d+))?\s*(?:\(([^)\n]*)\))?[^\n]*$/gm;
    var heads = [];
    var m;
    while ((m = re.exec(main))) {
      heads.push({
        at: m.index,
        end: m.index + m[0].length,
        art: m[1] + (m[2] ? '의' + m[2] : ''),
        title: (m[3] || '').trim()
      });
    }
    heads.forEach(function (h, i) {
      var stop = i + 1 < heads.length ? heads[i + 1].at : main.length;
      var seg = main.slice(h.end, stop);
      var nextHead = seg.search(/^#{1,6}\s/m);
      if (nextHead >= 0) seg = seg.slice(0, nextHead);
      var text = seg.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
      arts[h.art] = { no: '제' + h.art + '조', title: h.title, text: text };
    });
    return {
      title: front['제목'] || '',
      promulgated: front['공포일자'] || '',
      effective: front['시행일자'] || '',
      lawNo: front['공포번호'] || '',
      arts: arts
    };
  }

  function fetchLawLive(lawKey, cb) {
    if (lawCache[lawKey]) {
      cb(null, lawCache[lawKey]);
      return;
    }
    var meta = LAW_API_SOURCES.find(function (x) { return x.key === lawKey; }) || LAW_API_SOURCES[0];
    var url = 'https://raw.githubusercontent.com/legalize-kr/legalize-kr/main/kr/' +
      encodeURIComponent(meta.key) + '/' + encodeURIComponent(meta.file);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (md) {
        var parsed = parseLawMarkdown(md);
        parsed.url = url;
        lawCache[lawKey] = parsed;
        cb(null, parsed);
      })
      .catch(function (err) {
        cb(err || new Error('법령 API 호출 실패'), null);
      });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.pau-modal-back{position:fixed;inset:0;z-index:100500;background:rgba(15,23,42,.58);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;}',
      '.pau-modal-box{width:min(1640px,96vw);height:min(940px,92vh);background:#f8fafc;border-radius:16px;box-shadow:0 25px 60px rgba(15,23,42,.42);display:flex;flex-direction:column;overflow:hidden;border:1px solid #cbd5e1;}',
      '.pau-detail-back{position:fixed;inset:0;z-index:100600;background:rgba(15,23,42,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px;}',
      '.pau-detail-box{width:min(1360px,95vw);max-height:90vh;background:#ffffff;border-radius:16px;box-shadow:0 25px 60px rgba(15,23,42,.45);display:flex;flex-direction:column;overflow:hidden;border:1px solid #cbd5e1;}',
      '.pau-detail-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;background:linear-gradient(135deg,#0f172a 0%,#1e40af 100%);color:#ffffff;flex-wrap:wrap;}',
      '.pau-detail-body{padding:16px 18px 22px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;background:#f8fafc;}',
      '.pau-sec-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;}',
      '.pau-sec-tit{font-size:13.5px;font-weight:800;color:#0f172a;margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;}',
      '.pau-root{display:flex;flex-direction:column;height:100%;min-height:0;font-family:"Pretendard","Malgun Gothic",-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;background:#f8fafc;font-size:13px;}',
      '.pau-root *{box-sizing:border-box;}',
      '.pau-hdr{display:flex;align-items:center;gap:10px;padding:12px 18px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#ffffff;flex-wrap:wrap;flex-shrink:0;}',
      '.pau-hdr-ico{font-size:22px;line-height:1;}',
      '.pau-hdr-tit{font-size:16px;font-weight:800;letter-spacing:-.3px;margin-right:4px;}',
      '.pau-hdr-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.pau-badge{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#e2e8f0;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;}',
      '.pau-badge.ok{background:rgba(34,197,94,.22);border-color:rgba(74,222,128,.45);color:#dcfce7;}',
      '.pau-hdr-r{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.pau-who-slot{display:inline-flex;align-items:center;background:#f8fafc;color:#0f172a;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #cbd5e1;}',
      '.pau-who-slot:empty{display:none;}',
      '.pau-btn{cursor:pointer;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#ffffff;padding:6px 11px;border-radius:8px;font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}',
      '.pau-btn:hover{background:rgba(255,255,255,.22);}',
      '.pau-btn.pri{background:#2563eb;border-color:#3b82f6;color:#ffffff;}',
      '.pau-btn.pri:hover{background:#1d4ed8;}',
      '.pau-tabs{display:flex;align-items:center;gap:4px;padding:8px 16px 0;background:#ffffff;border-bottom:1px solid #e2e8f0;flex-shrink:0;overflow-x:auto;}',
      '.pau-tab{cursor:pointer;border:1px solid transparent;border-bottom:2px solid transparent;background:transparent;color:#475569;padding:8px 13px;font-size:13px;font-weight:700;border-radius:8px 8px 0 0;white-space:nowrap;}',
      '.pau-tab:hover{color:#0f172a;background:#f1f5f9;}',
      '.pau-tab.on{color:#1d4ed8;border-bottom-color:#2563eb;background:#eff6ff;}',
      '.pau-body{flex:1;min-height:0;overflow-y:auto;padding:12px 16px 20px;}',
      '.pau-flt{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px;}',
      '.pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;background:#ffffff;color:#1e293b;font-size:12.5px;}',
      '.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password]{min-width:210px;flex:1;max-width:340px;}',
      '.pau-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px;}',
      '.pau-kpi{background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;white-space:nowrap;}',
      '.pau-kpi span{font-size:12px;color:#64748b;}',
      '.pau-kpi b{font-size:16px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;}',
      '.pau-bulk{display:none;align-items:center;gap:8px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:10px;color:#1e40af;font-size:12.5px;font-weight:600;flex-wrap:wrap;}',
      '.pau-bulk.on{display:flex;}',
      '.pau-trunc-note{padding:6px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:8px;color:#92400e;font-size:12px;font-weight:600;}',
      '.pau-tbl-wrap{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:auto;max-height:calc(100vh - 285px);}',
      '.pau-tbl{width:100%;border-collapse:collapse;table-layout:fixed;}',
      '.pau-tbl th,.pau-tbl td{padding:7px 9px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-size:12.5px;}',
      '.pau-tbl th{position:sticky;top:0;z-index:2;background:#f1f5f9;color:#475569;font-weight:700;font-size:12px;}',
      '.pau-tbl tr:hover td{background:#f8fafc;}',
      '.pau-tbl th.c-ck,.pau-tbl td.c-ck{width:28px;text-align:center;padding:0 4px;}',
      '.pau-tbl th.c-no,.pau-tbl td.c-no{width:36px;text-align:right;padding:0 6px;color:#64748b;font-variant-numeric:tabular-nums;}',
      '.pau-tbl td.c-num{text-align:right;font-variant-numeric:tabular-nums;}',
      '.pau-line{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-line > span{overflow:hidden;text-overflow:ellipsis;}',
      '.pau-pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;flex-shrink:0;}',
      '.pau-pill.fktu{background:#eff6ff;border-color:#bfdbfe;color:#1e40af;}',
      '.pau-pill.kctu{background:#fef2f2;border-color:#fecaca;color:#991b1b;}',
      '.pau-pill.multi{background:#fffbeb;border-color:#fde68a;color:#92400e;}',
      '.pau-pill.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534;}',
      '.pau-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.pau-chip{padding:4px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:12px;cursor:pointer;white-space:nowrap;}',
      '.pau-chip.on{background:#1e40af;border-color:#1e40af;color:#ffffff;font-weight:700;}',
      '.pau-sbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px;margin-top:12px;}',
      '.pau-api-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px;}',
      '.pau-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;}',
      '.pau-card.law{background:#f0fdf4;border-color:#86efac;}',
      '.pau-card-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:#0f172a;}',
      '.pau-card-pre{margin:0;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;line-height:1.55;white-space:pre-wrap;max-height:220px;overflow:auto;color:#334155;font-family:inherit;}',
      '.pau-act-btn{cursor:pointer;border:1px solid #cbd5e1;background:#ffffff;color:#1e293b;padding:5px 10px;border-radius:7px;font-size:12px;font-weight:600;white-space:nowrap;}',
      '.pau-act-btn:hover{background:#f1f5f9;border-color:#94a3b8;}',
      '.pau-act-btn.pri{background:#2563eb;border-color:#2563eb;color:#ffffff;}',
      '@media (max-width:768px){',
      '  .pau-modal-back,.pau-detail-back{padding:0;}',
      '  .pau-modal-box,.pau-detail-box{width:100vw;height:100vh;max-height:100vh;border-radius:0;border:0;}',
      '  .pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text],.pau-flt input[type=password],.pau-root input,.pau-root select,.pau-root textarea{font-size:16px!important;height:38px;}',
      '  .pau-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}',
      '  .pau-hdr{padding:10px 12px;}',
      '  .pau-body{padding:10px 10px 24px;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function ensureDataLoaded(cb) {
    if (global.PU_ALIO_DATA) {
      cb(global.PU_ALIO_DATA);
      return;
    }
    var existing = document.querySelector('script[data-pu-alio-data="1"]');
    if (existing) {
      existing.addEventListener('load', function () { cb(global.PU_ALIO_DATA); });
      return;
    }
    var s = document.createElement('script');
    s.src = DATA_SCRIPT_URL;
    s.dataset.puAlioData = '1';
    s.onload = function () { cb(global.PU_ALIO_DATA); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  function downloadCsv(filename, headers, rows) {
    var lines = [headers.map(function (h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(',')];
    rows.forEach(function (r) {
      lines.push(r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  // 포털에 저장된 공공데이터포털(data.go.kr) 인증키(로그인 사용자 UID별 분리) 및 공휴일 공공데이터(pubdata) 자동 탐색
  function discoverPortalApiKeys(cb) {
    var out = { dataKey: '', source: '', holidays: [] };
    var uid = getActiveUid();
    try {
      // 구버전 공용 키가 남아 있으면 즉시 삭제하여 계정 간 공유를 차단한다
      localStorage.removeItem('pu_alio_datagokr_key');
      if (uid) {
        var saved = localStorage.getItem(userLsKey(uid));
        if (saved && saved.trim()) {
          out.dataKey = saved.trim();
          out.source = '계정 전용 저장 열쇠';
        }
      }
    } catch (e) {}

    try {
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.database) {
        var db = firebase.database();
        var yr = new Date().getFullYear();
        db.ref('pubdata/common/holidays/' + yr).once('value').then(function (s) {
          var v = s.val();
          if (v && Array.isArray(v.list)) out.holidays = v.list;
        }).catch(function () {});

        if (uid) {
          db.ref('gov/' + uid + '/key_data').once('value').then(function (snap) {
            var k = snap.val();
            if (k && String(k).trim()) {
              out.dataKey = String(k).trim();
              out.source = '푸른포털 정부사업신청(gov/' + uid.slice(0, 6) + '…) 자동연동';
              try { localStorage.setItem(userLsKey(uid), out.dataKey); } catch (e) {}
            }
            cb(out);
          }).catch(function () { cb(out); });
          return;
        }
      }
    } catch (e) {}
    cb(out);
  }

  // ── 기관별 종합 상세 팝업창 (노조 현황 + 13대 핵심 쟁점 + 공시·규정 원문 내려받기) ──
  var detailModalEl = null;
  var lastDetailTrigger = null;

  function closeOrganDetailModal() {
    if (!detailModalEl) return;
    detailModalEl.remove();
    detailModalEl = null;
    if (global.PuBack && global.PuBack.close) {
      try { global.PuBack.close('pu-alio-organ-detail'); } catch (e) {}
    }
    if (lastDetailTrigger && typeof lastDetailTrigger.focus === 'function') {
      try { lastDetailTrigger.focus(); } catch (e) {}
    }
    lastDetailTrigger = null;
  }

  function openOrganDetailModal(aid) {
    injectStyles();
    ensureDataLoaded(function (data) {
      if (!data) return;
      var prevTrigger = document.activeElement;
      closeOrganDetailModal();
      lastDetailTrigger = prevTrigger;

      var insts = data.institutions || [];
      var unions = data.unions || [];
      var discs = data.disclosures || [];
      var rawMetrics = data.metrics || [];

      var foundInst = insts.find(function (x) { return x.apba_id === aid; });
      var inst = foundInst || { apba_id: aid, name: '미등록 기관 (' + aid + ')', inst_type: '', ministry: '', union_structure: '' };
      var orgUnions = unions.filter(function (u) { return u.apba_id === aid; });
      var orgDiscs = discs.filter(function (d) { return d.aid === aid; });
      var orgMetrics = extractOrganMetrics(rawMetrics, aid);

      detailModalEl = document.createElement('div');
      detailModalEl.className = 'pau-detail-back';
      detailModalEl.id = 'pauOrganDetailModal';

      if (!foundInst && !orgUnions.length && !orgDiscs.length && !Object.keys(orgMetrics).length) {
        detailModalEl.innerHTML = [
          '<div class="pau-detail-box" role="dialog" aria-modal="true" aria-label="기관 정보 없음">',
          '  <div class="pau-detail-hdr"><b>⚠ 요청한 공공기관(' + esc(aid) + ') 정보를 찾을 수 없습니다</b><button type="button" class="pau-btn" data-dact="close">✕ 닫기 (ESC)</button></div>',
          '  <div class="pau-detail-body"><div class="pau-sec-card" style="text-align:center;padding:32px;color:#64748b;">등록된 공공기관 코드가 아니거나 공시 데이터가 없습니다.</div></div>',
          '</div>'
        ].join('');
        document.body.appendChild(detailModalEl);
        var cBtn0 = detailModalEl.querySelector('button[data-dact="close"]');
        if (cBtn0) cBtn0.focus();
        detailModalEl.addEventListener('click', function (ev) {
          if (ev.target === detailModalEl || ev.target.closest('button[data-dact="close"]')) closeOrganDetailModal();
        });
        return;
      }

      var unionRowsHtml = orgUnions.map(function (u, idx) {
        var toParts = [];
        if (Number(u.timeoff_hours || 0) > 0) toParts.push(fmtNum(u.timeoff_hours) + 'h');
        if (Number(u.timeoff_fulltime || 0) > 0) toParts.push('풀' + u.timeoff_fulltime);
        if (Number(u.timeoff_parttime || 0) > 0) toParts.push('파트' + u.timeoff_parttime);
        var toStr = toParts.length ? toParts.join(' · ') : '—';
        var alioLink = u.disclosure_no
          ? '<a href="https://www.alio.go.kr/item/itemReportRight.do?disclosureNo=' + esc(u.disclosure_no) + '" target="_blank" rel="noopener" class="pau-pill ok" style="text-decoration:none;">🔗 ALIO원문</a>'
          : '—';
        return [
          '<tr>',
          '  <td class="c-no">' + (idx + 1) + '</td>',
          '  <td title="' + esc(u.union_name) + '" style="font-weight:700">' + esc(u.union_name) + '</td>',
          '  <td title="' + esc((u.confederation || '') + ' ' + (u.federation || '')) + '">' + esc([u.confederation, u.federation].filter(worth).join(' · ') || '—') + '</td>',
          '  <td title="' + esc(u.bargaining_right || '') + '">' + esc(u.bargaining_right || '—') + '</td>',
          '  <td class="c-num">' + fmtNum(u.eligible_count) + '</td>',
          '  <td class="c-num" style="font-weight:700">' + fmtNum(u.member_total) + '</td>',
          '  <td class="c-num">' + esc(toStr) + '</td>',
          '  <td title="' + esc((u.established_date || '') + ' · ' + (u.chair_term || '')) + '">' + esc([u.established_date, u.chair_term].filter(worth).join(' · ') || '—') + '</td>',
          '  <td title="' + esc(u.scope || '') + '">' + esc(u.scope || '—') + '</td>',
          '  <td>' + alioLink + '</td>',
          '</tr>'
        ].join('');
      }).join('');

      var hasMetrics = Object.keys(orgMetrics).length > 0;
      var metricRowsHtml = hasMetrics ? METRIC_DEFS.map(function (mdef, idx) {
        var cell = orgMetrics[mdef.key] || {};
        var val = cell.val || cell.metric_value || '—';
        var art = cell.art || cell.evidence_article || '—';
        var snip = String(cell.snip || cell.snippet || '').replace(/\s+/g, ' ').trim();
        return [
          '<tr>',
          '  <td class="c-no">' + (idx + 1) + '</td>',
          '  <td title="' + esc(mdef.label) + '" style="font-weight:700;color:#1e40af">' + esc(mdef.label) + '</td>',
          '  <td title="' + esc(val) + '" style="font-weight:600">' + esc(val) + '</td>',
          '  <td title="' + esc(art) + '"><span class="pau-pill fktu">' + esc(art) + '</span></td>',
          '  <td title="' + esc(cell.snip || cell.snippet || '') + '">' + esc(snip || '—') + '</td>',
          '</tr>'
        ].join('');
      }).join('') : '';

      var discRowsHtml = orgDiscs.map(function (d, idx) {
        var kvParts = [];
        Object.keys(d.kv || {}).forEach(function (k) {
          if (k !== '기준일' && k !== '제출일' && worth(d.kv[k])) kvParts.push(k + ': ' + d.kv[k]);
        });
        var kvSummary = kvParts.join(' · ') || '—';
        var reportUrl = d.dno && String(d.dno).indexOf('RULE_') !== 0
          ? '<a href="https://www.alio.go.kr/item/itemReportRight.do?disclosureNo=' + esc(d.dno) + '" target="_blank" rel="noopener" class="pau-pill ok" style="text-decoration:none;margin-right:4px;">🔗 공시원문</a>'
          : '';
        var fileLinks = (d.files || []).map(function (f) {
          var safeHref = safeHttpUrl(f.url);
          if (!safeHref) return '';
          return '<a href="' + esc(safeHref) + '" target="_blank" rel="noopener" class="pau-pill fktu" style="text-decoration:none;margin-right:4px;">⬇ ' + esc(f.name) + '</a>';
        }).join('');
        return [
          '<tr>',
          '  <td class="c-no">' + (idx + 1) + '</td>',
          '  <td title="' + esc(d.cname) + '"><span class="pau-pill">' + esc(d.cname) + '</span></td>',
          '  <td title="' + esc(d.title) + '" style="font-weight:600">' + esc(d.title) + '</td>',
          '  <td>' + esc(d.edate || d.rdate || '—') + '</td>',
          '  <td title="' + esc(kvSummary) + '">' + esc(kvSummary) + '</td>',
          '  <td><div class="pau-line">' + reportUrl + (fileLinks || '<span style="color:#94a3b8">첨부 없음</span>') + '</div></td>',
          '</tr>'
        ].join('');
      }).join('');

      detailModalEl.innerHTML = [
        '<div class="pau-detail-box" role="dialog" aria-modal="true" aria-label="' + esc(inst.name) + ' 임단협 상세 팝업">',
        '  <div class="pau-detail-hdr">',
        '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">',
        '      <span style="font-size:20px;">🏢</span>',
        '      <b style="font-size:16px;">' + esc(inst.name) + ' — 노조·임단협·공시 종합 팝업</b>',
        '      <span class="pau-badge">' + esc(inst.inst_type || '공공기관') + '</span>',
        (worth(inst.ministry) ? '<span class="pau-badge">' + esc(inst.ministry) + '</span>' : ''),
        '      <span class="pau-badge ok">단위노조 ' + orgUnions.length + '개 · 공시/규정 ' + orgDiscs.length + '건</span>',
        '    </div>',
        '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">',
        (hasMetrics ? '<button type="button" class="pau-btn pri" data-dact="add-matrix">⚖️ 13대 쟁점 비교표에 추가</button>' : ''),
        '      <button type="button" class="pau-btn" data-dact="go-tab4">📂 4번 탭에서 보기</button>',
        '      <button type="button" class="pau-btn" data-dact="close">✕ 닫기 (ESC)</button>',
        '    </div>',
        '  </div>',
        '  <div class="pau-detail-body">',
        '    <div class="pau-sec-card">',
        '      <div class="pau-sec-tit"><span>📊 1. 노동조합 가입·상급단체·근로시간면제(타임오프) 현황</span></div>',
        '      <div class="pau-tbl-wrap" style="max-height:220px;">',
        '        <table class="pau-tbl">',
        '          <thead><tr><th class="c-no">№</th><th style="width:180px">노동조합명</th><th style="width:150px">상급단체</th><th style="width:110px">교섭권</th><th style="width:80px" class="c-num">가입대상</th><th style="width:80px" class="c-num">조합원수</th><th style="width:120px" class="c-num">타임오프</th><th style="width:140px">설립일·임기</th><th>가입범위</th><th style="width:95px">ALIO원문</th></tr></thead>',
        '          <tbody>' + (unionRowsHtml || '<tr><td colspan="10" style="text-align:center;color:#64748b;">등록된 노조 현황이 없습니다.</td></tr>') + '</tbody>',
        '        </table>',
        '      </div>',
        '    </div>',
        (hasMetrics ? [
          '    <div class="pau-sec-card">',
          '      <div class="pau-sec-tit"><span>⚖️ 2. 단체협약 13대 핵심 노무 쟁점 분석 결과</span></div>',
          '      <div class="pau-tbl-wrap" style="max-height:280px;">',
          '        <table class="pau-tbl">',
          '          <thead><tr><th class="c-no">№</th><th style="width:210px">핵심 쟁점 항목</th><th style="width:220px">단체협약 핵심 요약</th><th style="width:120px">근거 조문</th><th>조문 원문 발췌 (마우스를 올리면 전문 표시)</th></tr></thead>',
          '          <tbody>' + metricRowsHtml + '</tbody>',
          '        </table>',
          '      </div>',
          '    </div>'
        ].join('') : ''),
        '    <div class="pau-sec-card">',
        '      <div class="pau-sec-tit"><span>📂 ' + (hasMetrics ? '3' : '2') + '. ALIO 노사 수시공시·단체협약·임금협약·별도합의·내부규정 원문 (' + orgDiscs.length + '건)</span></div>',
        '      <div class="pau-tbl-wrap" style="max-height:260px;">',
        '        <table class="pau-tbl">',
        '          <thead><tr><th class="c-no">№</th><th style="width:170px">공시항목</th><th style="width:230px">공시·규정 제목</th><th style="width:105px">체결/개정일</th><th style="width:220px">핵심 요약</th><th>공시원문 · 첨부파일 내려받기 (PDF·HWP)</th></tr></thead>',
        '          <tbody>' + (discRowsHtml || '<tr><td colspan="6" style="text-align:center;color:#64748b;">수시공시·내부규정 내역이 없습니다.</td></tr>') + '</tbody>',
        '        </table>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(detailModalEl);

      var closeBtn = detailModalEl.querySelector('button[data-dact="close"]');
      if (closeBtn) closeBtn.focus();

      detailModalEl.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Tab') return;
        var focusables = detailModalEl.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      });

      detailModalEl.addEventListener('click', function (ev) {
        if (ev.target === detailModalEl) {
          closeOrganDetailModal();
          return;
        }
        var btn = ev.target.closest('button[data-dact]');
        if (!btn) return;
        var act = btn.dataset.dact;
        if (act === 'close') {
          closeOrganDetailModal();
        } else if (act === 'go-tab4' && latestAppHooks) {
          closeOrganDetailModal();
          latestAppHooks.openOrganInTab4(aid);
        } else if (act === 'add-matrix' && latestAppHooks) {
          closeOrganDetailModal();
          latestAppHooks.addOrganToMatrix(aid);
        }
      });

      if (global.PuBack && global.PuBack.open) {
        try { global.PuBack.open('pu-alio-organ-detail', closeOrganDetailModal); } catch (e) {}
      }
    });
  }

  function setAuthUser(u) {
    var nextUid = (u && u.uid) ? String(u.uid) : '';
    var changed = currentAuthUid !== nextUid;
    currentAuthUid = nextUid;
    if (changed && latestAppHooks && typeof latestAppHooks.refreshAuthKey === 'function') {
      latestAppHooks.refreshAuthKey();
    }
  }

  function mount(container, opts) {
    opts = opts || {};
    injectStyles();
    container.innerHTML = '<div class="pau-root"><div style="padding:48px;text-align:center;color:#64748b;font-weight:600;">⏳ 공공임단협(알리오·노동법령·공공데이터 API) 데이터를 불러오는 중입니다...</div></div>';

    ensureDataLoaded(function (data) {
      if (!data) {
        container.innerHTML = '<div class="pau-root"><div style="padding:48px;text-align:center;color:#dc2626;font-weight:700;">데이터 파일(js/pu-alio-data.js)을 불러오지 못했습니다.</div></div>';
        return;
      }
      renderApp(container, data, opts);
    });
  }

  function renderApp(container, data, opts) {
    var insts = data.institutions || [];
    var unions = data.unions || [];
    var discs = data.disclosures || [];
    var rawMetrics = data.metrics || [];
    var articles = data.articles || [];

    var metricsByOrgan = {};
    var metricOrganList = [];
    var seenMetricOrgans = {};

    if (Array.isArray(rawMetrics)) {
      rawMetrics.forEach(function (m) {
        if (!metricsByOrgan[m.apba_id]) metricsByOrgan[m.apba_id] = {};
        metricsByOrgan[m.apba_id][m.metric_key] = m;
        if (!seenMetricOrgans[m.apba_id]) {
          seenMetricOrgans[m.apba_id] = true;
          metricOrganList.push({ apba_id: m.apba_id, name: m.inst_name, inst_type: m.inst_type });
        }
      });
    } else if (rawMetrics && typeof rawMetrics === 'object') {
      Object.keys(rawMetrics).forEach(function (aid) {
        var mobj = rawMetrics[aid] || {};
        metricsByOrgan[aid] = mobj;
        var inst = insts.find(function (x) { return x.apba_id === aid; });
        metricOrganList.push({
          apba_id: aid,
          name: inst ? inst.name : aid,
          inst_type: inst ? inst.inst_type : ''
        });
      });
    }

    var state = {
      tab: 'unions',
      // Tab 1 filters & selection
      uType: 'ALL',
      uConfed: 'ALL',
      uStruct: 'ALL',
      uQuery: '',
      uSelected: {},
      uVisibleRows: [],
      // Tab 2 comparison state
      compOrgans: metricOrganList.slice(0, 6).map(function (o) { return o.apba_id; }),
      compMetricKey: 'personnel_participation',
      mSelected: {},
      // Tab 3 article search state
      aTax: 'ALL',
      aOrgan: 'ALL',
      aQuery: '',
      aSelected: {},
      aVisibleRows: [],
      // Tab 4 organ detail state
      dOrgan: 'ALL',
      dCat: 'ALL',
      dSelected: {},
      // Tab 5 API hub state
      apiDataKey: '',
      apiKeyMasked: true,
      apiKeySource: '확인 중…',
      apiHolidays: [],
      apiLawKey: '노동조합및노동관계조정법',
      apiLawArt: '24',
      apiAlioLiveRows: [],
      apiStatusMsg: ''
    };

    var activeUnionCount = unions.filter(function (u) { return u.union_structure !== '노조없음'; }).length;

    var root = document.createElement('div');
    root.className = 'pau-root';
    root.innerHTML = [
      '<div class="pau-hdr" id="head">',
      '  <div class="pau-hdr-ico">🤝</div>',
      '  <div class="pau-hdr-tit">공공임단협 — 공공기관 노동조합·임금·단체협약 비교분석</div>',
      '  <div class="pau-hdr-badges">',
      '    <span class="pau-badge ok" id="pauApiStatusBadge">🟢 5대 공공·법령 API 연결됨</span>',
      '    <span class="pau-badge">기관 ' + fmtNum(insts.length) + '곳</span>',
      '    <span class="pau-badge">단위노조 ' + fmtNum(activeUnionCount) + '개</span>',
      '    <span class="pau-badge">공시·규정 ' + fmtNum(discs.length) + '건</span>',
      '    <span class="pau-badge">쟁점조문 ' + fmtNum(articles.length) + '개</span>',
      '  </div>',
      '  <div class="pau-hdr-r">',
      '    <span id="who" class="pau-who-slot"></span>',
      '    <button type="button" class="pau-btn pri" data-act="csv">📥 현재 표 엑셀(CSV) 받기</button>',
      '    <button type="button" class="pau-btn" data-act="reload" title="데이터 및 API 상태 새로고침">🔄 새로고침</button>',
      (opts.isModal
        ? '<button type="button" class="pau-btn" data-act="newwin" title="독립 창으로 크게 열기">↗ 새 창으로 크게 열기</button>' +
          '<button type="button" class="pau-btn" data-act="close" title="닫기 (ESC)">✕ 닫기</button>'
        : '<a href="enter.html" class="pau-btn">🏠 포털 홈</a>' +
          '<button type="button" class="pau-btn" id="outBtn" style="display:none" onclick="try{firebase.auth().signOut()}catch(e){}">로그아웃</button>'),
      '  </div>',
      '</div>',
      '<div class="pau-tabs" role="tablist" aria-label="공공임단협 주요 기능 탭">',
      '  <button type="button" role="tab" aria-selected="true" class="pau-tab on" data-tab="unions">📊 1. 전 기관 노조·타임오프 현황</button>',
      '  <button type="button" role="tab" aria-selected="false" class="pau-tab" data-tab="matrix">⚖️ 2. 13대 핵심 쟁점 기관간 비교·원문 대조</button>',
      '  <button type="button" role="tab" aria-selected="false" class="pau-tab" data-tab="articles">🔍 3. 단체협약 조문 통합 검색</button>',
      '  <button type="button" role="tab" aria-selected="false" class="pau-tab" data-tab="detail">📂 4. 기관별 공시·별도합의·내부규정 원문</button>',
      '  <button type="button" role="tab" aria-selected="false" class="pau-tab" data-tab="apihub">🔌 5. 공공·법령 API 실시간 연동 센터</button>',
      '</div>',
      '<div class="pau-body" id="pauBody"></div>'
    ].join('');

    container.innerHTML = '';
    container.appendChild(root);

    try {
      if (!opts.isModal && global.PuWhoami && document.getElementById('who')) {
        global.PuWhoami.mount('#who');
      }
      if (!opts.isModal && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        var outBtnEl = document.getElementById('outBtn');
        if (outBtnEl) outBtnEl.style.display = '';
      }
    } catch (e) {}

    var bodyEl = root.querySelector('#pauBody');

    function syncAuthKeys() {
      discoverPortalApiKeys(function (info) {
        state.apiDataKey = info.dataKey || '';
        state.apiKeySource = info.source || (state.apiDataKey ? '계정 저장 열쇠' : '미입력 (로그인 후 API 탭에서 입력 가능)');
        state.apiHolidays = info.holidays || [];
        if (state.tab === 'apihub') renderApiHubTab();
      });
    }

    latestAppHooks = {
      openOrganInTab4: function (aid) {
        state.dOrgan = aid;
        switchTab('detail');
      },
      addOrganToMatrix: function (aid) {
        if (state.compOrgans.indexOf(aid) < 0 && metricsByOrgan[aid]) {
          state.compOrgans.push(aid);
        }
        switchTab('matrix');
      },
      refreshAuthKey: function () {
        if (!getActiveUid()) {
          state.apiDataKey = '';
          state.apiKeySource = '미로그인';
          if (state.tab === 'apihub') renderApiHubTab();
        } else {
          syncAuthKeys();
        }
      }
    };

    syncAuthKeys();

    root.querySelector('.pau-hdr').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'close' && opts.onClose) opts.onClose();
      else if (act === 'newwin') {
        window.open('pu-alio-union.html?sso=1', 'pureun-aliounion');
      } else if (act === 'csv') {
        exportCurrentTabCsv();
      } else if (act === 'reload') {
        renderCurrentTab();
      }
    });

    root.querySelector('.pau-tabs').addEventListener('click', function (ev) {
      var tabBtn = ev.target.closest('button[data-tab]');
      if (!tabBtn) return;
      switchTab(tabBtn.dataset.tab);
    });

    function switchTab(t) {
      state.tab = t;
      state.uSelected = {};
      state.mSelected = {};
      state.aSelected = {};
      state.dSelected = {};
      root.querySelectorAll('.pau-tab').forEach(function (b) {
        var active = b.dataset.tab === t;
        b.classList.toggle('on', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderCurrentTab();
    }

    function exportCurrentTabCsv() {
      if (state.tab === 'unions') {
        var rows = state.uVisibleRows.map(function (u, i) {
          return [
            i + 1, u.apba_id, u.inst_name, u.inst_type, u.ministry,
            u.union_structure, u.union_name, u.confederation, u.federation,
            u.bargaining_right, u.eligible_count || 0, u.member_total || 0,
            u.timeoff_hours || 0, u.timeoff_fulltime || 0, u.timeoff_parttime || 0,
            u.established_date || '', u.chair_term || '', u.scope || ''
          ];
        });
        downloadCsv('공공임단협_노조가입_타임오프현황.csv',
          ['번호', '기관코드', '기관명', '기관유형', '주무부처', '노조형태', '노동조합명', '총연합단체', '연합단체', '교섭권', '가입대상인원', '총조합원수', '타임오프(시간)', '풀타임(명)', '파트타임(명)', '설립일', '위원장임기', '가입범위'],
          rows);
      } else if (state.tab === 'matrix') {
        var headers = ['번호', '핵심 쟁점 항목'].concat(state.compOrgans.map(function (aid) {
          var found = metricOrganList.find(function (o) { return o.apba_id === aid; });
          return found ? found.name : aid;
        }));
        var mrows = METRIC_DEFS.map(function (mdef, idx) {
          var r = [idx + 1, mdef.label];
          state.compOrgans.forEach(function (aid) {
            var cell = (metricsByOrgan[aid] || {})[mdef.key];
            r.push(cell ? ((cell.metric_value || cell.val || '') + ' (' + (cell.evidence_article || cell.art || '') + ')') : '—');
          });
          return r;
        });
        downloadCsv('공공임단협_13대쟁점_비교매트릭스.csv', headers, mrows);
      } else if (state.tab === 'articles') {
        var arows = state.aVisibleRows.map(function (a, idx) {
          return [idx + 1, a.inst_name, a.taxonomy_name, a.chapter || '', a.article_no, a.article_title || '', a.text || ''];
        });
        downloadCsv('공공임단협_조문검색결과.csv', ['번호', '기관명', '쟁점분류', '장', '조문번호', '조문제목', '조문내용'], arows);
      } else {
        var drows = discs.filter(function (d) {
          if (state.dOrgan !== 'ALL' && d.aid !== state.dOrgan) return false;
          if (state.dCat !== 'ALL' && d.ccode !== state.dCat) return false;
          return true;
        }).map(function (d, idx) {
          return [idx + 1, d.iname, d.cname, d.title, d.edate || '', d.rdate || '', (d.files || []).map(function (f) { return f.name; }).join(' / ')];
        });
        downloadCsv('공공임단협_기관별_노사공시목록.csv', ['번호', '기관명', '공시항목', '제목', '체결/기준일', '등록일', '첨부파일'], drows);
      }
    }

    function renderCurrentTab() {
      if (state.tab === 'unions') renderUnionsTab();
      else if (state.tab === 'matrix') renderMatrixTab();
      else if (state.tab === 'articles') renderArticlesTab();
      else if (state.tab === 'detail') renderDetailTab();
      else if (state.tab === 'apihub') renderApiHubTab();
    }

    // -------------------------------------------------------------------------
    // TAB 1: 전 기관 노조·타임오프 현황
    // -------------------------------------------------------------------------
    function renderUnionsTab() {
      var types = ['ALL'];
      var confeds = ['ALL'];
      unions.forEach(function (u) {
        if (u.inst_type && types.indexOf(u.inst_type) < 0) types.push(u.inst_type);
        if (u.confederation && confeds.indexOf(u.confederation) < 0) confeds.push(u.confederation);
      });

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauUType" aria-label="기관유형 필터">' + types.map(function (t) { return '<option value="' + esc(t) + '"' + (state.uType === t ? ' selected' : '') + '>' + (t === 'ALL' ? '기관유형 전체' : esc(t)) + '</option>'; }).join('') + '</select>',
        '  <select id="pauUConfed" aria-label="상급단체 필터">' + confeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.uConfed === c ? ' selected' : '') + '>' + (c === 'ALL' ? '상급단체 전체' : esc(c)) + '</option>'; }).join('') + '</select>',
        '  <select id="pauUStruct" aria-label="노조형태 필터">',
        '    <option value="ALL"' + (state.uStruct === 'ALL' ? ' selected' : '') + '>노조형태 전체</option>',
        '    <option value="단일노조"' + (state.uStruct === '단일노조' ? ' selected' : '') + '>단일노조</option>',
        '    <option value="복수노조"' + (state.uStruct === '복수노조' ? ' selected' : '') + '>복수노조</option>',
        '    <option value="노조없음"' + (state.uStruct === '노조없음' ? ' selected' : '') + '>노조없음</option>',
        '  </select>',
        '  <input type="search" id="pauUQuery" aria-label="기관명 및 노동조합 검색" placeholder="기관명·노동조합명·주무부처·연맹 검색…" value="' + esc(state.uQuery) + '">',
        '  <span style="font-size:12px;color:#475569;">💡 기관명을 누르면 <b>기관별 노조·임단협·공시 종합 팝업창</b>이 열립니다</span>',
        '</div>',
        '<div class="pau-kpis" id="pauUKpis"></div>',
        '<div class="pau-bulk" id="pauUBulk"></div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauUAllCk" aria-label="현재 목록 전체 선택" title="현재 목록 전체 선택"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:175px">기관명 · 주무부처</th>',
        '        <th style="width:125px">기관유형 · 형태</th>',
        '        <th style="width:190px">노동조합명 · 교섭권</th>',
        '        <th style="width:165px">상급단체 (총연합 · 연맹)</th>',
        '        <th style="width:82px" class="c-num">가입대상</th>',
        '        <th style="width:82px" class="c-num">총조합원</th>',
        '        <th style="width:130px" class="c-num">타임오프 (시간·명)</th>',
        '        <th style="width:145px">설립일 · 위원장임기</th>',
        '        <th>가입범위 · 상세팝업 · ALIO원문</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauUTbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      function filterAndPaint() {
        var q = state.uQuery.trim().toLowerCase();
        state.uVisibleRows = unions.filter(function (u) {
          if (state.uType !== 'ALL' && u.inst_type !== state.uType) return false;
          if (state.uConfed !== 'ALL' && u.confederation !== state.uConfed) return false;
          if (state.uStruct !== 'ALL' && u.union_structure !== state.uStruct) return false;
          if (q) {
            var hay = [u.inst_name, u.union_name, u.ministry, u.federation, u.confederation].join(' ').toLowerCase();
            if (hay.indexOf(q) < 0) return false;
          }
          return true;
        });

        var orgSet = {};
        var totalMembers = 0;
        var toSum = 0, toCnt = 0;
        state.uVisibleRows.forEach(function (u) {
          orgSet[u.apba_id] = true;
          totalMembers += Number(u.member_total || 0);
          if (Number(u.timeoff_hours || 0) > 0) {
            toSum += Number(u.timeoff_hours);
            toCnt++;
          }
        });

        bodyEl.querySelector('#pauUKpis').innerHTML = [
          '<div class="pau-kpi"><span>조회 기관 수</span><b>' + fmtNum(Object.keys(orgSet).length) + '곳</b></div>',
          '<div class="pau-kpi"><span>조회 단위노조</span><b>' + fmtNum(state.uVisibleRows.length) + '개</b></div>',
          '<div class="pau-kpi"><span>총 조합원 합계</span><b>' + fmtNum(totalMembers) + '명</b></div>',
          '<div class="pau-kpi"><span>평균 타임오프</span><b>' + (toCnt ? fmtNum(Math.round(toSum / toCnt)) + '시간' : '—') + '</b></div>'
        ].join('');

        var tbody = bodyEl.querySelector('#pauUTbody');
        if (!state.uVisibleRows.length) {
          tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:30px;color:#64748b;">검색 조건에 맞는 공공기관·노동조합이 없습니다.</td></tr>';
          paintBulkBar();
          return;
        }

        tbody.innerHTML = state.uVisibleRows.map(function (u, idx) {
          var rowKey = u.apba_id + '|' + u.union_name;
          var checked = !!state.uSelected[rowKey];
          var confPillClass = u.confederation === '한국노총' ? 'fktu' : (u.confederation === '민주노총' ? 'kctu' : '');
          var structPill = u.union_structure === '복수노조' ? '<span class="pau-pill multi">복수</span>' : '';
          var bargainBadge = worth(u.bargaining_right) && u.bargaining_right.indexOf('교섭대표') >= 0
            ? '<span class="pau-pill fktu">대표</span>' : '';
          var toParts = [];
          if (Number(u.timeoff_hours || 0) > 0) toParts.push(fmtNum(u.timeoff_hours) + 'h');
          if (Number(u.timeoff_fulltime || 0) > 0) toParts.push('풀' + u.timeoff_fulltime);
          if (Number(u.timeoff_parttime || 0) > 0) toParts.push('파트' + u.timeoff_parttime);
          var toStr = toParts.length ? toParts.join(' · ') : '—';

          var dateParts = [];
          if (worth(u.established_date)) dateParts.push(u.established_date);
          if (worth(u.chair_term)) dateParts.push(u.chair_term);
          var dateStr = dateParts.join(' · ') || '—';

          var fedParts = [];
          if (worth(u.confederation)) fedParts.push(u.confederation);
          if (worth(u.federation)) fedParts.push(u.federation);

          var popupBtn = '<button type="button" class="pau-pill fktu pau-org-lnk" data-aid="' + esc(u.apba_id) + '" style="cursor:pointer;" title="기관 종합 상세 팝업 열기">📋 상세팝업</button>';
          var alioReportLink = u.disclosure_no
            ? '<a href="https://www.alio.go.kr/item/itemReportRight.do?disclosureNo=' + esc(u.disclosure_no) + '" target="_blank" rel="noopener" class="pau-pill ok" style="text-decoration:none;" title="알리오 실시간 공시 원문 열기">🔗 ALIO원문</a>'
            : '';

          return [
            '<tr data-rk="' + esc(rowKey) + '" data-aid="' + esc(u.apba_id) + '">',
            '  <td class="c-ck"><input type="checkbox" class="pau-row-ck" aria-label="' + esc(u.inst_name + ' ' + u.union_name) + ' 선택" data-rk="' + esc(rowKey) + '"' + (checked ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(u.inst_name + (worth(u.ministry) ? ' · ' + u.ministry : '') + ' (클릭 시 기관 종합 팝업)') + '"><div class="pau-line"><a href="#" class="pau-org-lnk" data-aid="' + esc(u.apba_id) + '" style="font-weight:700;color:#1e40af;text-decoration:none">' + esc(u.inst_name) + '</a>' + (worth(u.ministry) ? '<span style="color:#64748b;font-size:11.5px">' + esc(u.ministry) + '</span>' : '') + '</div></td>',
            '  <td title="' + esc(u.inst_type + ' · ' + u.union_structure) + '"><div class="pau-line">' + structPill + '<span>' + esc(u.inst_type) + '</span></div></td>',
            '  <td title="' + esc(u.union_name + (worth(u.bargaining_right) ? ' (' + u.bargaining_right + ')' : '')) + '"><div class="pau-line">' + bargainBadge + '<span style="font-weight:600">' + esc(u.union_name) + '</span></div></td>',
            '  <td title="' + esc(fedParts.join(' · ')) + '"><div class="pau-line">' + (worth(u.confederation) ? '<span class="pau-pill ' + confPillClass + '">' + esc(u.confederation) + '</span>' : '') + (worth(u.federation) ? '<span>' + esc(u.federation) + '</span>' : '<span style="color:#94a3b8">—</span>') + '</div></td>',
            '  <td class="c-num">' + fmtNum(u.eligible_count) + '</td>',
            '  <td class="c-num" style="font-weight:700">' + fmtNum(u.member_total) + '</td>',
            '  <td class="c-num" title="' + esc(toStr) + '">' + esc(toStr) + '</td>',
            '  <td title="' + esc(dateStr) + '">' + esc(dateStr) + '</td>',
            '  <td title="' + esc(u.scope || '') + '"><div class="pau-line">' + popupBtn + alioReportLink + '<span>' + (worth(u.scope) ? esc(u.scope) : '—') + '</span></div></td>',
            '</tr>'
          ].join('');
        }).join('');

        paintBulkBar();
      }

      function paintBulkBar() {
        var keys = Object.keys(state.uSelected).filter(function (k) { return state.uSelected[k]; });
        var bulkEl = bodyEl.querySelector('#pauUBulk');
        if (!keys.length) {
          bulkEl.classList.remove('on');
          bulkEl.innerHTML = '';
          return;
        }
        bulkEl.classList.add('on');
        bulkEl.innerHTML = [
          '<span>☑ ' + keys.length + '건 선택됨</span>',
          '<button type="button" class="pau-btn pri" data-bact="compare">⚖️ 선택 기관 13대 쟁점 비교</button>',
          '<button type="button" class="pau-btn" data-bact="csv">📥 선택 항목 CSV 받기</button>',
          '<button type="button" class="pau-btn" data-bact="clear">선택 해제</button>'
        ].join('');
      }

      bodyEl.querySelector('#pauUType').addEventListener('change', function (e) { state.uType = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUConfed').addEventListener('change', function (e) { state.uConfed = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUStruct').addEventListener('change', function (e) { state.uStruct = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUQuery').addEventListener('input', function (e) { state.uQuery = e.target.value; filterAndPaint(); });

      bodyEl.querySelector('#pauUAllCk').addEventListener('change', function (e) {
        var on = e.target.checked;
        state.uVisibleRows.forEach(function (u) {
          var rk = u.apba_id + '|' + u.union_name;
          if (on) state.uSelected[rk] = true;
          else delete state.uSelected[rk];
        });
        filterAndPaint();
      });

      bodyEl.querySelector('#pauUTbody').addEventListener('change', function (e) {
        if (!e.target.classList.contains('pau-row-ck')) return;
        var rk = e.target.dataset.rk;
        if (e.target.checked) state.uSelected[rk] = true;
        else delete state.uSelected[rk];
        paintBulkBar();
      });

      bodyEl.querySelector('#pauUTbody').addEventListener('click', function (e) {
        var lnk = e.target.closest('.pau-org-lnk');
        if (!lnk) return;
        e.preventDefault();
        openOrganDetailModal(lnk.dataset.aid);
      });

      bodyEl.querySelector('#pauUBulk').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-bact]');
        if (!b) return;
        var act = b.dataset.bact;
        if (act === 'clear') {
          state.uSelected = {};
          filterAndPaint();
        } else if (act === 'compare') {
          var aids = [];
          Object.keys(state.uSelected).forEach(function (rk) {
            var aid = rk.split('|')[0];
            if (aids.indexOf(aid) < 0 && metricsByOrgan[aid]) aids.push(aid);
          });
          if (aids.length) state.compOrgans = aids;
          switchTab('matrix');
        } else if (act === 'csv') {
          var picked = state.uVisibleRows.filter(function (u) { return state.uSelected[u.apba_id + '|' + u.union_name]; });
          var rows = picked.map(function (u, i) {
            return [i + 1, u.apba_id, u.inst_name, u.inst_type, u.ministry, u.union_structure, u.union_name, u.confederation, u.member_total || 0, u.timeoff_hours || 0];
          });
          downloadCsv('공공임단협_선택기관_노조현황.csv', ['번호', '기관코드', '기관명', '기관유형', '주무부처', '노조형태', '노동조합명', '상급단체', '총조합원수', '타임오프(시간)'], rows);
        }
      });

      filterAndPaint();
    }

    // -------------------------------------------------------------------------
    // TAB 2: 13대 핵심 쟁점 기관간 비교 매트릭스 & 현행 법조문 API + 조문 원문 Side-by-Side
    // -------------------------------------------------------------------------
    function renderMatrixTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt" style="flex-direction:column;align-items:stretch;">',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
        '    <b style="font-size:12.5px;color:#0f172a;">📌 비교 대상 공공기관 선택 (클릭하여 추가·제거, 원문 파싱 완료 기관 ' + metricOrganList.length + '곳)</b>',
        '    <div style="display:flex;gap:6px;">',
        '      <button type="button" class="pau-act-btn" id="pauMSelectAll">전체 기관 선택</button>',
        '      <button type="button" class="pau-act-btn" id="pauMSelectTop6">주요 6개 기관만</button>',
        '    </div>',
        '  </div>',
        '  <div class="pau-chips" id="pauMChips" style="margin:6px 0 0;"></div>',
        '</div>',
        '<div class="pau-tbl-wrap" style="max-height:380px;">',
        '  <table class="pau-tbl" id="pauMTbl"></table>',
        '</div>',
        '<div style="margin-top:14px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">',
        '  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">',
        '    <b style="font-size:13.5px;color:#0f172a;">🔍 쟁점별 현행 노동법령 API 조문 vs 기관별 단체협약 원문 Side-by-Side 대조</b>',
        '    <select id="pauMMetricSel" aria-label="대조할 핵심 쟁점 선택" style="height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-weight:700;color:#1e40af;">',
        METRIC_DEFS.map(function (m) {
          return '<option value="' + esc(m.key) + '"' + (state.compMetricKey === m.key ? ' selected' : '') + '>' + esc(m.label) + '</option>';
        }).join(''),
        '    </select>',
        '    <span id="pauMLawBadge" class="pau-pill ok">⚖️ 현행 법령 API 실시간 연동 중</span>',
        '  </div>',
        '  <div class="pau-sbs" id="pauMSbs"></div>',
        '</div>'
      ].join('');

      function getCellVal(cell) { return cell ? (cell.metric_value || cell.val || '') : ''; }
      function getCellArt(cell) { return cell ? (cell.evidence_article || cell.art || '') : ''; }
      function getCellSnip(cell) { return cell ? (cell.snippet || cell.snip || '') : ''; }

      function paintMatrix() {
        var chipsEl = bodyEl.querySelector('#pauMChips');
        chipsEl.innerHTML = metricOrganList.map(function (o) {
          var on = state.compOrgans.indexOf(o.apba_id) >= 0;
          return '<button type="button" class="pau-chip' + (on ? ' on' : '') + '" data-aid="' + esc(o.apba_id) + '">' + esc(o.name) + '</button>';
        }).join('');

        var tbl = bodyEl.querySelector('#pauMTbl');
        var selOrgans = metricOrganList.filter(function (o) { return state.compOrgans.indexOf(o.apba_id) >= 0; });
        var allChecked = METRIC_DEFS.every(function (m) { return !!state.mSelected[m.key]; });

        var thead = [
          '<thead><tr>',
          '  <th class="c-ck"><input type="checkbox" id="pauMAllCk" aria-label="13대 쟁점 전체 선택"' + (allChecked ? ' checked' : '') + '></th>',
          '  <th class="c-no">№</th>',
          '  <th style="width:210px">13대 핵심 노무·단협 쟁점</th>',
          selOrgans.map(function (o) {
            return '<th style="width:210px"><a href="#" class="pau-org-lnk" data-aid="' + esc(o.apba_id) + '" style="color:#1e40af;text-decoration:none;" title="클릭 시 기관 종합 상세 팝업 열기">' + esc(o.name) + ' ↗</a></th>';
          }).join(''),
          '</tr></thead>'
        ].join('');

        var tbody = '<tbody>' + METRIC_DEFS.map(function (mdef, idx) {
          var isFocused = state.compMetricKey === mdef.key;
          var ck = !!state.mSelected[mdef.key];
          return [
            '<tr data-mkey="' + esc(mdef.key) + '" style="cursor:pointer;' + (isFocused ? 'background:#eff6ff;' : '') + '">',
            '  <td class="c-ck"><input type="checkbox" class="pau-m-ck" aria-label="' + esc(mdef.label) + ' 선택" data-mkey="' + esc(mdef.key) + '"' + (ck ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(mdef.label + ' — ' + mdef.lawTitle) + '" style="font-weight:700;color:#1e40af">' + esc(mdef.label) + '</td>',
            selOrgans.map(function (o) {
              var cell = (metricsByOrgan[o.apba_id] || {})[mdef.key];
              var val = getCellVal(cell);
              var art = getCellArt(cell);
              var snip = getCellSnip(cell);
              if (!val) return '<td style="color:#94a3b8">—</td>';
              var fullTxt = val + (art ? ' (' + art + ')' : '');
              return '<td title="' + esc(fullTxt + '\n\n' + snip) + '"><div class="pau-line">' + (art ? '<span class="pau-pill fktu">' + esc(art.split(',')[0]) + '</span>' : '') + '<span>' + esc(val) + '</span></div></td>';
            }).join(''),
            '</tr>'
          ].join('');
        }).join('') + '</tbody>';

        tbl.innerHTML = thead + tbody;
        paintSideBySide(selOrgans);
      }

      function paintSideBySide(selOrgans) {
        var sbsEl = bodyEl.querySelector('#pauMSbs');
        var curDef = METRIC_DEFS.find(function (m) { return m.key === state.compMetricKey; }) || METRIC_DEFS[0];

        var lawCardHtml = [
          '<div class="pau-card law" id="pauMLawCard">',
          '  <div class="pau-card-hd"><span>⚖️ 현행 법령 기준 (실시간 API)</span><span class="pau-pill ok">법제처/legalize-kr</span></div>',
          '  <div style="font-size:12px;font-weight:700;color:#166534;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(curDef.lawTitle) + '">' + esc(curDef.lawTitle) + '</div>',
          '  <pre class="pau-card-pre" id="pauMLawPre">⏳ 현행 법령 API에서 ' + esc(curDef.lawKey) + ' 제' + esc(curDef.lawArt) + '조 원문을 불러오는 중…</pre>',
          '</div>'
        ].join('');

        var organCardsHtml = selOrgans.map(function (o) {
          var cell = (metricsByOrgan[o.apba_id] || {})[state.compMetricKey];
          var val = getCellVal(cell);
          var art = getCellArt(cell);
          var snip = getCellSnip(cell);
          if (!val) {
            return '<div class="pau-card"><div class="pau-card-hd"><span>🏢 ' + esc(o.name) + '</span></div><div style="color:#94a3b8;font-size:12px;">해당 쟁점 조문 없음</div></div>';
          }
          return [
            '<div class="pau-card">',
            '  <div class="pau-card-hd"><a href="#" class="pau-org-lnk" data-aid="' + esc(o.apba_id) + '" style="color:#0f172a;text-decoration:none;">🏢 ' + esc(o.name) + ' 📋</a><span class="pau-pill fktu">' + esc(art) + '</span></div>',
            '  <div style="font-size:12px;font-weight:700;color:#1e40af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(val) + '">요약: ' + esc(val) + '</div>',
            '  <pre class="pau-card-pre">' + esc(snip) + '</pre>',
            '</div>'
          ].join('');
        }).join('');

        sbsEl.innerHTML = lawCardHtml + organCardsHtml;

        fetchLawLive(curDef.lawKey, function (err, lawData) {
          var pre = bodyEl.querySelector('#pauMLawPre');
          if (!pre) return;
          if (err || !lawData) {
            pre.textContent = curDef.lawTitle + ' (오프라인 요약 기준)';
            return;
          }
          var artObj = lawData.arts[curDef.lawArt];
          if (artObj) {
            pre.textContent = '(' + lawData.title + ' · 시행 ' + (lawData.effective || '') + ')\n' +
              artObj.no + (artObj.title ? '(' + artObj.title + ') ' : ' ') + '\n' + artObj.text;
          } else {
            pre.textContent = '(' + lawData.title + ' · 시행 ' + (lawData.effective || '') + ')\n' + curDef.lawTitle;
          }
        });
      }

      bodyEl.querySelector('#pauMChips').addEventListener('click', function (e) {
        var chip = e.target.closest('button[data-aid]');
        if (!chip) return;
        var aid = chip.dataset.aid;
        var i = state.compOrgans.indexOf(aid);
        if (i >= 0) {
          if (state.compOrgans.length > 1) state.compOrgans.splice(i, 1);
        } else {
          state.compOrgans.push(aid);
        }
        paintMatrix();
      });

      bodyEl.querySelector('#pauMSelectAll').addEventListener('click', function () {
        state.compOrgans = metricOrganList.map(function (o) { return o.apba_id; });
        paintMatrix();
      });

      bodyEl.querySelector('#pauMSelectTop6').addEventListener('click', function () {
        state.compOrgans = metricOrganList.slice(0, 6).map(function (o) { return o.apba_id; });
        paintMatrix();
      });

      bodyEl.querySelector('#pauMMetricSel').addEventListener('change', function (e) {
        state.compMetricKey = e.target.value;
        paintMatrix();
      });

      bodyEl.querySelector('#pauMTbl').addEventListener('change', function (e) {
        if (e.target.id === 'pauMAllCk') {
          var on = e.target.checked;
          METRIC_DEFS.forEach(function (m) {
            if (on) state.mSelected[m.key] = true;
            else delete state.mSelected[m.key];
          });
          paintMatrix();
        } else if (e.target.classList.contains('pau-m-ck')) {
          var mk = e.target.dataset.mkey;
          if (e.target.checked) state.mSelected[mk] = true;
          else delete state.mSelected[mk];
        }
      });

      bodyEl.querySelector('#pauMTbl').addEventListener('click', function (e) {
        var orgLnk = e.target.closest('.pau-org-lnk');
        if (orgLnk) {
          e.preventDefault();
          openOrganDetailModal(orgLnk.dataset.aid);
          return;
        }
        if (e.target.tagName === 'INPUT') return;
        var tr = e.target.closest('tr[data-mkey]');
        if (!tr) return;
        state.compMetricKey = tr.dataset.mkey;
        bodyEl.querySelector('#pauMMetricSel').value = state.compMetricKey;
        paintMatrix();
      });

      bodyEl.querySelector('#pauMSbs').addEventListener('click', function (e) {
        var orgLnk = e.target.closest('.pau-org-lnk');
        if (!orgLnk) return;
        e.preventDefault();
        openOrganDetailModal(orgLnk.dataset.aid);
      });

      paintMatrix();
    }

    // -------------------------------------------------------------------------
    // TAB 3: 단체협약 조문 통합 검색
    // -------------------------------------------------------------------------
    function renderArticlesTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauATax" aria-label="쟁점 분류 필터">' + TAXONOMY_LIST.map(function (t) { return '<option value="' + esc(t[0]) + '"' + (state.aTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('') + '</select>',
        '  <select id="pauAOrgan" aria-label="기관 필터"><option value="ALL">파싱 기관 전체</option>' + metricOrganList.map(function (o) { return '<option value="' + esc(o.apba_id) + '"' + (state.aOrgan === o.apba_id ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select>',
        '  <input type="search" id="pauAQuery" aria-label="단체협약 조문 검색어" placeholder="조문 제목·본문 검색 (예: 징계위원회, 유급병가, 합의, 정년, 타임오프)…" value="' + esc(state.aQuery) + '">',
        '</div>',
        '<div id="pauATruncNote"></div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauAAllCk" aria-label="조문 목록 전체 선택"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:150px">기관명</th>',
        '        <th style="width:175px">표준 쟁점 분류</th>',
        '        <th style="width:130px">장 · 조문번호</th>',
        '        <th style="width:180px">조문제목</th>',
        '        <th>조문 원문 내용 (마우스를 올리면 전문 표시)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauATbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      function filterArticles() {
        var q = state.aQuery.trim().toLowerCase();
        state.aVisibleRows = articles.filter(function (a) {
          if (state.aTax !== 'ALL' && a.taxonomy_code !== state.aTax) return false;
          if (state.aOrgan !== 'ALL' && a.apba_id !== state.aOrgan) return false;
          if (q) {
            var hay = [a.inst_name, a.article_no, a.article_title, a.text, a.taxonomy_name].join(' ').toLowerCase();
            if (hay.indexOf(q) < 0) return false;
          }
          return true;
        });

        var noteEl = bodyEl.querySelector('#pauATruncNote');
        if (state.aVisibleRows.length > 300) {
          noteEl.innerHTML = '<div class="pau-trunc-note">📌 검색된 조문 총 ' + fmtNum(state.aVisibleRows.length) + '건 중 화면 속도를 위해 상위 300건을 먼저 표시합니다. 상단 [📥 현재 표 엑셀(CSV) 받기]로 전체 ' + fmtNum(state.aVisibleRows.length) + '건을 모두 내려받을 수 있습니다.</div>';
        } else {
          noteEl.innerHTML = '';
        }

        var tbody = bodyEl.querySelector('#pauATbody');
        if (!state.aVisibleRows.length) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#64748b;">조회된 단체협약 조문이 없습니다. 검색어나 분류를 바꿔 보세요.</td></tr>';
          return;
        }

        var shown = state.aVisibleRows.slice(0, 300);
        tbody.innerHTML = shown.map(function (a, idx) {
          var oneLineText = String(a.text || '').replace(/\s+/g, ' ').trim();
          var ck = !!state.aSelected[idx];
          return [
            '<tr>',
            '  <td class="c-ck"><input type="checkbox" class="pau-a-ck" aria-label="' + esc(a.inst_name + ' ' + a.article_no) + ' 선택" data-idx="' + idx + '"' + (ck ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(a.inst_name) + '"><a href="#" class="pau-org-lnk" data-aid="' + esc(a.apba_id) + '" style="font-weight:700;color:#1e40af;text-decoration:none">' + esc(a.inst_name) + '</a></td>',
            '  <td title="' + esc(a.taxonomy_name) + '"><span class="pau-pill fktu">' + esc(a.taxonomy_name) + '</span></td>',
            '  <td title="' + esc((a.chapter ? a.chapter + ' ' : '') + a.article_no) + '"><div class="pau-line"><span style="font-weight:700;color:#1e40af">' + esc(a.article_no) + '</span>' + (worth(a.chapter) ? '<span style="color:#64748b;font-size:11.5px">' + esc(a.chapter) + '</span>' : '') + '</div></td>',
            '  <td title="' + esc(a.article_title || '') + '" style="font-weight:600">' + (worth(a.article_title) ? esc(a.article_title) : '—') + '</td>',
            '  <td title="' + esc(a.text || '') + '">' + esc(oneLineText) + '</td>',
            '</tr>'
          ].join('');
        }).join('');
      }

      bodyEl.querySelector('#pauATax').addEventListener('change', function (e) { state.aTax = e.target.value; filterArticles(); });
      bodyEl.querySelector('#pauAOrgan').addEventListener('change', function (e) { state.aOrgan = e.target.value; filterArticles(); });
      bodyEl.querySelector('#pauAQuery').addEventListener('input', function (e) { state.aQuery = e.target.value; filterArticles(); });
      bodyEl.querySelector('#pauAAllCk').addEventListener('change', function (e) {
        var on = e.target.checked;
        var limit = Math.min(300, state.aVisibleRows.length);
        for (var i = 0; i < limit; i++) {
          if (on) state.aSelected[i] = true;
          else delete state.aSelected[i];
        }
        filterArticles();
      });
      bodyEl.querySelector('#pauATbody').addEventListener('change', function (e) {
        if (!e.target.classList.contains('pau-a-ck')) return;
        var idx = e.target.dataset.idx;
        if (e.target.checked) state.aSelected[idx] = true;
        else delete state.aSelected[idx];
      });
      bodyEl.querySelector('#pauATbody').addEventListener('click', function (e) {
        var lnk = e.target.closest('.pau-org-lnk');
        if (!lnk) return;
        e.preventDefault();
        openOrganDetailModal(lnk.dataset.aid);
      });

      filterArticles();
    }

    // -------------------------------------------------------------------------
    // TAB 4: 기관별 상세 공시·별도합의·내부규정 원문 내려받기
    // -------------------------------------------------------------------------
    function renderDetailTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauDOrgan" aria-label="공시 조회 기관 선택" style="min-width:260px;font-weight:700;">',
        '    <option value="ALL"' + (state.dOrgan === 'ALL' ? ' selected' : '') + '>공시·규정 수집 기관 전체 보기 (' + fmtNum(discs.length) + '건)</option>',
        insts.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.dOrgan === i.apba_id ? ' selected' : '') + '>' + esc(i.name + ' (' + i.inst_type + ' · ' + i.ministry + ')') + '</option>';
        }).join(''),
        '  </select>',
        '  <select id="pauDCat" aria-label="공시 항목 분류 선택">',
        '    <option value="ALL"' + (state.dCat === 'ALL' ? ' selected' : '') + '>공시항목 전체 (단협·임협·별도합의·내부규정)</option>',
        '    <option value="21026"' + (state.dCat === '21026' ? ' selected' : '') + '>단체협약 정보 (21026)</option>',
        '    <option value="21027"' + (state.dCat === '21027' ? ' selected' : '') + '>임금협약 정보 (21027)</option>',
        '    <option value="63787"' + (state.dCat === '63787' ? ' selected' : '') + '>제도운영 상황 / 타임오프 (63787)</option>',
        '    <option value="63795"' + (state.dCat === '63795' ? ' selected' : '') + '>단체협약상 별도 합의사항 (63795)</option>',
        '    <option value="63796"' + (state.dCat === '63796' ? ' selected' : '') + '>단체협약 외의 별도 합의사항 (63796)</option>',
        '    <option value="21028"' + (state.dCat === '21028' ? ' selected' : '') + '>노사협의회 의결사항 (21028)</option>',
        '    <option value="21025"' + (state.dCat === '21025' ? ' selected' : '') + '>복수노조 교섭창구 단일화 (21025)</option>',
        '    <option value="21110"' + (state.dCat === '21110' ? ' selected' : '') + '>내부규정 - 취업·인사·보수 (21110)</option>',
        '  </select>',
        '</div>',
        '<div id="pauDTruncNote"></div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauDAllCk" aria-label="공시 목록 전체 선택"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:150px">기관명</th>',
        '        <th style="width:175px">공시항목</th>',
        '        <th style="width:230px">공시·규정 제목</th>',
        '        <th style="width:115px">체결일/개정일</th>',
        '        <th style="width:220px">핵심 요약 (노조명·유효기간 등)</th>',
        '        <th>ALIO 원문 API · 첨부파일 내려받기 (PDF·HWP)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauDTbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      var visibleDiscs = [];

      function paintDisclosures() {
        visibleDiscs = discs.filter(function (d) {
          if (state.dOrgan !== 'ALL' && d.aid !== state.dOrgan) return false;
          if (state.dCat !== 'ALL' && d.ccode !== state.dCat) return false;
          return true;
        });

        var noteEl = bodyEl.querySelector('#pauDTruncNote');
        if (visibleDiscs.length > 350) {
          noteEl.innerHTML = '<div class="pau-trunc-note">📌 조회된 공시·규정 총 ' + fmtNum(visibleDiscs.length) + '건 중 상위 350건을 먼저 표시합니다. 상단 [📥 현재 표 엑셀(CSV) 받기]로 전체 ' + fmtNum(visibleDiscs.length) + '건을 내려받을 수 있습니다.</div>';
        } else {
          noteEl.innerHTML = '';
        }

        var tbody = bodyEl.querySelector('#pauDTbody');
        if (!visibleDiscs.length) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#64748b;">조회된 수시공시·내부규정 내역이 없습니다. (전체 보기 또는 공기업·준정부기관을 선택해 보세요)</td></tr>';
          return;
        }

        tbody.innerHTML = visibleDiscs.slice(0, 350).map(function (d, idx) {
          var kvParts = [];
          Object.keys(d.kv || {}).forEach(function (k) {
            if (k !== '기준일' && k !== '제출일' && worth(d.kv[k])) {
              kvParts.push(k + ': ' + d.kv[k]);
            }
          });
          var kvSummary = kvParts.join(' · ') || '—';

          var reportUrl = d.dno && String(d.dno).indexOf('RULE_') !== 0
            ? '<a href="https://www.alio.go.kr/item/itemReportRight.do?disclosureNo=' + esc(d.dno) + '" target="_blank" rel="noopener" class="pau-pill ok" style="text-decoration:none;margin-right:4px;" title="알리오 공시 원문 페이지 열기">🔗 공시원문</a>'
            : '';

          var fileLinks = (d.files || []).map(function (f) {
            var safeHref = safeHttpUrl(f.url);
            if (!safeHref) return '';
            return '<a href="' + esc(safeHref) + '" target="_blank" rel="noopener" class="pau-pill fktu" style="text-decoration:none;margin-right:4px;" title="' + esc(f.name) + ' 내려받기">⬇ ' + esc(f.name) + '</a>';
          }).join('');

          var ck = !!state.dSelected[idx];

          return [
            '<tr>',
            '  <td class="c-ck"><input type="checkbox" class="pau-d-ck" aria-label="' + esc(d.iname + ' ' + d.title) + ' 선택" data-idx="' + idx + '"' + (ck ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(d.iname) + '"><a href="#" class="pau-org-lnk" data-aid="' + esc(d.aid) + '" style="font-weight:700;color:#1e40af;text-decoration:none">' + esc(d.iname) + '</a></td>',
            '  <td title="' + esc(d.cname) + '"><span class="pau-pill">' + esc(d.cname) + '</span></td>',
            '  <td title="' + esc(d.title) + '" style="font-weight:600">' + esc(d.title) + '</td>',
            '  <td title="' + esc(d.edate || d.rdate || '') + '">' + esc(d.edate || d.rdate || '—') + '</td>',
            '  <td title="' + esc(kvSummary) + '">' + esc(kvSummary) + '</td>',
            '  <td><div class="pau-line">' + reportUrl + (fileLinks || '<span style="color:#94a3b8">첨부 없음</span>') + '</div></td>',
            '</tr>'
          ].join('');
        }).join('');
      }

      bodyEl.querySelector('#pauDOrgan').addEventListener('change', function (e) { state.dOrgan = e.target.value; paintDisclosures(); });
      bodyEl.querySelector('#pauDCat').addEventListener('change', function (e) { state.dCat = e.target.value; paintDisclosures(); });
      bodyEl.querySelector('#pauDAllCk').addEventListener('change', function (e) {
        var on = e.target.checked;
        var limit = Math.min(350, visibleDiscs.length);
        for (var i = 0; i < limit; i++) {
          if (on) state.dSelected[i] = true;
          else delete state.dSelected[i];
        }
        paintDisclosures();
      });
      bodyEl.querySelector('#pauDTbody').addEventListener('change', function (e) {
        if (!e.target.classList.contains('pau-d-ck')) return;
        var idx = e.target.dataset.idx;
        if (e.target.checked) state.dSelected[idx] = true;
        else delete state.dSelected[idx];
      });
      bodyEl.querySelector('#pauDTbody').addEventListener('click', function (e) {
        var lnk = e.target.closest('.pau-org-lnk');
        if (!lnk) return;
        e.preventDefault();
        openOrganDetailModal(lnk.dataset.aid);
      });

      paintDisclosures();
    }

    // -------------------------------------------------------------------------
    // TAB 5: 공공·법령 API 실시간 연동 센터 (5대 API 통합 연결·실시간 호출)
    // -------------------------------------------------------------------------
    function renderApiHubTab() {
      var apiRegistry = [
        {
          id: 'alio-portal',
          name: '① 기획재정부 알리오(ALIO) 9대 노사·임단협·내부규정 공시 API',
          endpoint: 'https://www.alio.go.kr/item/itemReportListSusi.json · itemOrganListJung.json · itemBoard21110.do',
          auth: '인증키 불필요 (ALIO 공개 JSON/원문 API)',
          status: '🟢 연결됨 (기관 ' + fmtNum(insts.length) + '곳 · 노조 ' + fmtNum(unions.length) + '개 · 공시/규정 ' + fmtNum(discs.length) + '건 동기화)',
          actionLabel: '📂 수집 공시·원문 보기',
          actionKind: 'go-detail'
        },
        {
          id: 'law-live',
          name: '② 현행 노동관계법령 실시간 조문 API (법제처 원문 / legalize-kr)',
          endpoint: 'https://raw.githubusercontent.com/legalize-kr/legalize-kr/main/kr/{법령명}/법률.md',
          auth: '인증키 불필요 (CORS 전체 허용 · 실시간 마크다운 조문 파싱)',
          status: '🟢 실시간 연결됨 (노동조합법·근로기준법·근로자참여법 등 7대 법령)',
          actionLabel: '▶ 현행 법령 실시간 호출',
          actionKind: 'test-law'
        },
        {
          id: 'alio-openapi',
          name: '③ 공공데이터포털 기획재정부 알리오(ALIO) Open API (data.go.kr)',
          endpoint: 'https://apis.data.go.kr/1051000/recruitment/list',
          auth: state.apiDataKey ? ('🟢 인증키 연동됨 (' + state.apiKeySource + ')') : '⚪ 공공데이터포털 인증키(serviceKey)',
          status: state.apiDataKey ? '🟢 실시간 호출 준비 완료 (CORS 허용)' : '🟡 아래 입력칸에 공공데이터포털 인증키 입력 시 즉시 활성화',
          actionLabel: '▶ ALIO OpenAPI 실시간 호출',
          actionKind: 'test-alio-openapi'
        },
        {
          id: 'pubdata-holidays',
          name: '④ 한국천문연구원 특일(법정공휴일)·국민연금·고용보험 공공데이터 API',
          endpoint: 'pubdata/common/holidays/{연도} · https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService',
          auth: '푸른통합 공용 pubdata 실시간 연동',
          status: state.apiHolidays.length ? ('🟢 연결됨 (올해 법정공휴일 ' + state.apiHolidays.length + '일 수신 완료)') : '🟢 공용 pubdata / 특일 API 연동 준비됨',
          actionLabel: '▶ 공휴일·유급휴일 기준 불러오기',
          actionKind: 'test-holidays'
        },
        {
          id: 'cleaneye-moel',
          name: '⑤ 행정안전부 지방공기업(클린아이)·고용노동부 전국 노동조합 표준데이터 Open API',
          endpoint: 'https://apis.data.go.kr/B551982/openApiUnion · data.go.kr/data/15033827',
          auth: '공공데이터포털 동일 인증키(serviceKey) 사용',
          status: state.apiDataKey ? '🟢 인증키 공유 연결됨' : '⚪ 공공데이터포털 인증키 연동',
          actionLabel: '🔗 공공데이터포털 명세 열기',
          actionKind: 'open-datagokr'
        }
      ];

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <b style="color:#0f172a;">🔑 공공데이터포털(data.go.kr) 통합 인증키:</b>',
        '  <input type="' + (state.apiKeyMasked ? 'password' : 'text') + '" id="pauApiKeyInput" autocomplete="off" aria-label="공공데이터포털 인증키 입력" placeholder="공공데이터포털 일반 인증키(Decoding 또는 Encoding) 입력…" value="' + esc(state.apiDataKey) + '">',
        '  <button type="button" class="pau-act-btn" id="pauApiKeyToggle">' + (state.apiKeyMasked ? '👁 표시' : '🙈 가리기') + '</button>',
        '  <button type="button" class="pau-act-btn pri" id="pauApiKeySave">💾 인증키 저장·연결</button>',
        '  <span style="font-size:12px;color:#475569;">출처: <b>' + esc(state.apiKeySource) + '</b> (로그인 계정별로 안전하게 분리 보관됩니다)</span>',
        '</div>',
        '<div class="pau-tbl-wrap" style="margin-bottom:14px;">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" checked disabled aria-label="API 연결됨"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:290px">연결된 공공·법령·노사 API 명칭</th>',
        '        <th style="width:310px">API 엔드포인트 (Endpoint URL)</th>',
        '        <th style="width:210px">인증 · 연동 방식</th>',
        '        <th style="width:250px">현재 연결 상태</th>',
        '        <th style="width:165px">실시간 실행</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauApiTbody">',
        apiRegistry.map(function (a, i) {
          return [
            '<tr>',
            '  <td class="c-ck"><input type="checkbox" checked aria-label="' + esc(a.name) + ' 선택"></td>',
            '  <td class="c-no">' + (i + 1) + '</td>',
            '  <td title="' + esc(a.name) + '" style="font-weight:700;color:#0f172a">' + esc(a.name) + '</td>',
            '  <td title="' + esc(a.endpoint) + '" style="color:#2563eb;font-family:monospace;font-size:11.5px">' + esc(a.endpoint) + '</td>',
            '  <td title="' + esc(a.auth) + '">' + esc(a.auth) + '</td>',
            '  <td title="' + esc(a.status) + '"><span class="pau-pill ok">' + esc(a.status) + '</span></td>',
            '  <td><button type="button" class="pau-act-btn pri" data-api-act="' + esc(a.actionKind) + '">' + esc(a.actionLabel) + '</button></td>',
            '</tr>'
          ].join('');
        }).join(''),
        '    </tbody>',
        '  </table>',
        '</div>',
        '<div class="pau-api-grid">',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd">',
        '      <span>⚖️ 실시간 노동관계법령 조문 API 조회기</span>',
        '      <span class="pau-pill ok">CORS 무인증 실시간</span>',
        '    </div>',
        '    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;">',
        '      <select id="pauLawSel" aria-label="조회할 노동관계법령 선택" style="height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px;flex:1;">',
        LAW_API_SOURCES.map(function (l) {
          return '<option value="' + esc(l.key) + '"' + (state.apiLawKey === l.key ? ' selected' : '') + '>' + esc(l.name) + '</option>';
        }).join(''),
        '      </select>',
        '      <input type="text" id="pauLawArtInput" aria-label="조문 번호 입력" value="' + esc(state.apiLawArt) + '" placeholder="조 번호 (예: 24, 29의2, 55)" style="width:110px;height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px;">',
        '      <button type="button" class="pau-act-btn pri" id="pauLawFetchBtn">조문 API 조회</button>',
        '    </div>',
        '    <pre class="pau-card-pre" id="pauLawResultPre" style="min-height:180px;">⏳ 법령과 조문 번호를 선택하면 현행 법령 API에서 실시간 조문 원문을 불러옵니다.</pre>',
        '  </div>',
        '  <div class="pau-card">',
        '    <div class="pau-card-hd">',
        '      <span>🏛 공공데이터포털(ALIO OpenAPI · 특일 API) 실시간 응답 모니터</span>',
        '      <span class="pau-pill fktu" id="pauOpenApiCounter">대기 중</span>',
        '    </div>',
        '    <pre class="pau-card-pre" id="pauOpenApiResultPre" style="min-height:218px;">위의 [▶ ALIO OpenAPI 실시간 호출] 또는 [▶ 공휴일·유급휴일 기준 불러오기] 단추를 누르면 실시간 API 응답 결과가 여기에 표시됩니다.</pre>',
        '  </div>',
        '</div>'
      ].join('');

      function runLawQuery() {
        var pre = bodyEl.querySelector('#pauLawResultPre');
        if (!pre) return;
        pre.textContent = '⏳ 현행 법령 API 호출 중 (' + state.apiLawKey + ' 제' + state.apiLawArt + '조)…';
        fetchLawLive(state.apiLawKey, function (err, lawData) {
          if (err || !lawData) {
            pre.textContent = '법령 API 호출 실패: ' + (err && err.message ? err.message : '네트워크 확인 필요');
            return;
          }
          var artNo = String(state.apiLawArt || '').replace(/[^0-9의]/g, '');
          var found = lawData.arts[artNo];
          var metaLine = '✔ API 응답 성공 — (' + lawData.title + ') 공포일자: ' + (lawData.promulgated || '-') + ' · 시행일자: ' + (lawData.effective || '-') + ' · 총 파싱 조문: ' + Object.keys(lawData.arts).length + '개\n' +
            '──────────────────────────────────────────────\n';
          if (found) {
            pre.textContent = metaLine + found.no + (found.title ? '(' + found.title + ')' : '') + '\n\n' + found.text;
          } else {
            var sampleKeys = Object.keys(lawData.arts).slice(0, 15).map(function (k) { return '제' + k + '조'; }).join(', ');
            pre.textContent = metaLine + '제' + artNo + '조를 찾지 못했습니다. 조회 가능 주요 조문: ' + sampleKeys + ' …';
          }
        });
      }

      function runAlioOpenApiTest() {
        var pre = bodyEl.querySelector('#pauOpenApiResultPre');
        var badge = bodyEl.querySelector('#pauOpenApiCounter');
        if (!state.apiDataKey) {
          pre.textContent = '⚠ 상단 「🔑 공공데이터포털(data.go.kr) 통합 인증키」 입력칸에 인증키를 입력한 뒤 [💾 인증키 저장·연결]을 눌러 주세요.\n(푸른포털 정부사업신청 앱에 인증키가 등록되어 있으면 로그인 시 자동으로 불러옵니다.)';
          return;
        }
        var url;
        if (global.GovAlio && typeof global.GovAlio.buildUrl === 'function') {
          url = global.GovAlio.buildUrl({ key: state.apiDataKey, page: 1, rows: 10, ongoingOnly: true });
        } else {
          var enc = /%[0-9A-Fa-f]{2}/.test(state.apiDataKey) ? state.apiDataKey : encodeURIComponent(state.apiDataKey);
          url = 'https://apis.data.go.kr/1051000/recruitment/list?serviceKey=' + enc + '&resultType=json&pageNo=1&numOfRows=10&ongoingYn=Y';
        }
        pre.textContent = '⏳ 기획재정부 알리오(ALIO) Open API (apis.data.go.kr/1051000/recruitment/list) 실시간 호출 중…';
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (json) {
            var items = (json && json.result) || (json && json.data) || [];
            var total = (json && json.totalCount) || items.length || 0;
            if (badge) badge.textContent = '응답 ' + fmtNum(total) + '건';
            var lines = ['✔ 기획재정부 알리오(ALIO) Open API 실시간 응답 성공 (전체 공고 ' + fmtNum(total) + '건 중 최근 10건):', ''];
            items.slice(0, 10).forEach(function (it, idx) {
              var instNm = it.instNm || it.pblntInstNm || '';
              var ttl = it.recrutPbancTtl || it.pbancTtl || '';
              var bgng = it.pbancBgngYmd || '';
              var end = it.pbancEndYmd || '';
              lines.push((idx + 1) + '. (' + instNm + ') ' + ttl + ' (' + bgng + ' ~ ' + end + ')');
            });
            if (!items.length) lines.push(JSON.stringify(json, null, 2).slice(0, 800));
            pre.textContent = lines.join('\n');
          })
          .catch(function (err) {
            pre.textContent = '⚠ ALIO OpenAPI 호출 오류: ' + (err && err.message ? err.message : String(err));
          });
      }

      function runHolidaysTest() {
        var pre = bodyEl.querySelector('#pauOpenApiResultPre');
        var badge = bodyEl.querySelector('#pauOpenApiCounter');
        if (state.apiHolidays && state.apiHolidays.length) {
          if (badge) badge.textContent = state.apiHolidays.length + '일';
          pre.textContent = '✔ 푸른통합 pubdata/common/holidays (한국천문연구원 특일 API) 실시간 연동 결과:\n\n' +
            state.apiHolidays.map(function (h, i) {
              return (i + 1) + '. ' + h.date + ' — ' + h.name + ' (' + (h.kind || '법정공휴일') + ')';
            }).join('\n');
          return;
        }
        pre.textContent = '✔ 근로기준법 제55조 제2항 및 관공서의 공휴일에 관한 규정 기준 유급공휴일:\n' +
          '1. 일요일(주휴일)\n2. 국경일(3·1절, 제헌절, 광복절, 개천절, 한글날)\n3. 1월 1일, 설날 전날·설날·설날 다음날(3일), 추석 전날·추석·추석 다음날(3일)\n4. 부처님오신날, 어린이날, 현충일, 기독탄신일\n5. 공직선거법상 임기만료 선거일 및 대체공휴일, 근로자의 날(5월 1일)';
      }

      bodyEl.querySelector('#pauApiKeyToggle').addEventListener('click', function () {
        state.apiKeyMasked = !state.apiKeyMasked;
        renderApiHubTab();
      });

      bodyEl.querySelector('#pauApiKeySave').addEventListener('click', function () {
        var val = (bodyEl.querySelector('#pauApiKeyInput').value || '').trim();
        var uid = getActiveUid();
        state.apiDataKey = val;
        state.apiKeySource = val ? (uid ? '계정 전용 저장됨' : '현재 세션 임시 적용') : '미입력';
        try {
          if (uid) {
            if (val) localStorage.setItem(userLsKey(uid), val);
            else localStorage.removeItem(userLsKey(uid));
          }
        } catch (e) {}
        renderApiHubTab();
      });

      bodyEl.querySelector('#pauLawFetchBtn').addEventListener('click', function () {
        state.apiLawKey = bodyEl.querySelector('#pauLawSel').value;
        state.apiLawArt = bodyEl.querySelector('#pauLawArtInput').value.trim() || '24';
        runLawQuery();
      });

      bodyEl.querySelector('#pauLawSel').addEventListener('change', function (e) {
        state.apiLawKey = e.target.value;
        var found = LAW_API_SOURCES.find(function (x) { return x.key === state.apiLawKey; });
        if (found && found.mainArts.length) {
          state.apiLawArt = found.mainArts[0];
          bodyEl.querySelector('#pauLawArtInput').value = state.apiLawArt;
        }
        runLawQuery();
      });

      bodyEl.querySelector('#pauApiTbody').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-api-act]');
        if (!btn) return;
        var act = btn.dataset.apiAct;
        if (act === 'go-detail') switchTab('detail');
        else if (act === 'test-law') runLawQuery();
        else if (act === 'test-alio-openapi') runAlioOpenApiTest();
        else if (act === 'test-holidays') runHolidaysTest();
        else if (act === 'open-datagokr') window.open('https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EC%95%8C%EB%A6%AC%EC%98%A4', '_blank', 'noopener');
      });

      runLawQuery();
    }

    renderCurrentTab();
  }

  // ── 레이어 모달 팝업창 열기/닫기 ──
  var modalEl = null;

  function closeModal() {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    if (global.PuBack && global.PuBack.close) {
      try { global.PuBack.close('pu-alio-modal'); } catch (e) {}
    }
  }

  function openModal() {
    injectStyles();
    if (modalEl) {
      modalEl.style.display = 'flex';
      return;
    }
    modalEl = document.createElement('div');
    modalEl.className = 'pau-modal-back';
    modalEl.id = 'puAlioModalBack';
    modalEl.innerHTML = '<div class="pau-modal-box" id="puAlioModalBox" role="dialog" aria-modal="true" aria-label="공공임단협 비교분석"></div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closeModal();
    });

    var box = modalEl.querySelector('#puAlioModalBox');
    mount(box, { isModal: true, onClose: closeModal });

    if (global.PuBack && global.PuBack.open) {
      try { global.PuBack.open('pu-alio-modal', closeModal); } catch (e) {}
    }
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (detailModalEl) closeOrganDetailModal();
      else if (modalEl) closeModal();
    }
  });

  global.PuAlioUnion = {
    openModal: openModal,
    closeModal: closeModal,
    openOrganDetailModal: openOrganDetailModal,
    closeOrganDetailModal: closeOrganDetailModal,
    extractOrganMetrics: extractOrganMetrics,
    safeHttpUrl: safeHttpUrl,
    setAuthUser: setAuthUser,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
