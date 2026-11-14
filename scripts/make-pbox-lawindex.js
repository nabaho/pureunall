#!/usr/bin/env node
/* P박스 대한민국 전 법령 색인 생성기 (legalize-kr/legalize-kr 기반)
 *
 * 국가법령정보센터(law.go.kr) 공개 법령을 미러링한 legalize-kr 저장소의 kr/ 트리를 읽어
 * 대한민국 현행 법률·대통령령(시행령)·총리령·부령(시행규칙) 전체 목록(약 5,700여 편)을
 * 브라우저가 열쇠 없이 즉시 검색할 수 있는 경량 색인(js/pu-pbox-lawindex.js)으로 묶는다.
 *
 * 실행:
 *   node scripts/make-pbox-lawindex.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'pu-pbox-lawindex.js');
const UA = 'pureun-pbox-lawindex/1.0';

/* 노무법인 핵심 우선 동기화·즐겨찾기 법령 카탈로그 (분야 분류 + 띄어쓰기 표제어) */
const PRIORITY_META = {
  '근로기준법': { title: '근로기준법', cat: 'labor_std', dept: '고용노동부', rank: 1 },
  '최저임금법': { title: '최저임금법', cat: 'labor_std', dept: '고용노동부', rank: 2 },
  '근로자퇴직급여보장법': { title: '근로자퇴직급여 보장법', cat: 'labor_std', dept: '고용노동부', rank: 3 },
  '임금채권보장법': { title: '임금채권보장법', cat: 'labor_std', dept: '고용노동부', rank: 4 },
  '기간제및단시간근로자보호등에관한법률': { title: '기간제 및 단시간근로자 보호 등에 관한 법률', cat: 'non_regular', dept: '고용노동부', rank: 5 },
  '파견근로자보호등에관한법률': { title: '파견근로자 보호 등에 관한 법률', cat: 'non_regular', dept: '고용노동부', rank: 6 },
  '남녀고용평등과일ㆍ가정양립지원에관한법률': { title: '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', cat: 'equality', dept: '고용노동부', rank: 7 },
  '고용상연령차별금지및고령자고용촉진에관한법률': { title: '고용상 연령차별금지 및 고령자고용촉진에 관한 법률', cat: 'equality', dept: '고용노동부', rank: 8 },
  '장애인고용촉진및직업재활법': { title: '장애인고용촉진 및 직업재활법', cat: 'equality', dept: '고용노동부', rank: 9 },
  '채용절차의공정화에관한법률': { title: '채용절차의 공정화에 관한 법률', cat: 'labor_std', dept: '고용노동부', rank: 10 },
  '노동조합및노동관계조정법': { title: '노동조합 및 노동관계조정법', cat: 'union', dept: '고용노동부', rank: 11 },
  '근로자참여및협력증진에관한법률': { title: '근로자참여 및 협력증진에 관한 법률', cat: 'union', dept: '고용노동부', rank: 12 },
  '노동위원회법': { title: '노동위원회법', cat: 'union', dept: '고용노동부', rank: 13 },
  '공무원의노동조합설립및운영등에관한법률': { title: '공무원의 노동조합 설립 및 운영 등에 관한 법률', cat: 'union', dept: '고용노동부', rank: 14 },
  '교원의노동조합설립및운영등에관한법률': { title: '교원의 노동조합 설립 및 운영 등에 관한 법률', cat: 'union', dept: '고용노동부', rank: 15 },
  '산업재해보상보험법': { title: '산업재해보상보험법', cat: 'safety_comp', dept: '고용노동부', rank: 16 },
  '산업안전보건법': { title: '산업안전보건법', cat: 'safety_comp', dept: '고용노동부', rank: 17 },
  '중대재해처벌등에관한법률': { title: '중대재해 처벌 등에 관한 법률', cat: 'safety_comp', dept: '법무부·고용노동부', rank: 18 },
  '진폐의예방과진폐근로자의보호등에관한법률': { title: '진폐의 예방과 진폐근로자의 보호 등에 관한 법률', cat: 'safety_comp', dept: '고용노동부', rank: 19 },
  '석면피해구제법': { title: '석면피해구제법', cat: 'safety_comp', dept: '환경부', rank: 20 },
  '어선원및어선재해보상보험법': { title: '어선원 및 어선 재해보상보험법', cat: 'safety_comp', dept: '해양수산부', rank: 21 },
  '고용보험법': { title: '고용보험법', cat: 'social_ins', dept: '고용노동부', rank: 22 },
  '고용보험및산업재해보상보험의보험료징수등에관한법률': { title: '고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률', cat: 'social_ins', dept: '고용노동부', rank: 23 },
  '고용정책기본법': { title: '고용정책 기본법', cat: 'social_ins', dept: '고용노동부', rank: 24 },
  '국민연금법': { title: '국민연금법', cat: 'social_ins', dept: '보건복지부', rank: 25 },
  '국민건강보험법': { title: '국민건강보험법', cat: 'social_ins', dept: '보건복지부', rank: 26 },
  '노인장기요양보험법': { title: '노인장기요양보험법', cat: 'social_ins', dept: '보건복지부', rank: 27 },
  '근로복지기본법': { title: '근로복지기본법', cat: 'labor_std', dept: '고용노동부', rank: 28 },
  '사내근로복지기금법': { title: '사내근로복지기금법', cat: 'labor_std', dept: '고용노동부', rank: 29 },
  '직업안정법': { title: '직업안정법', cat: 'social_ins', dept: '고용노동부', rank: 30 },
  '국민내일배움카드운영규정': { title: '국민 평생 직업능력 개발법', cat: 'social_ins', dept: '고용노동부', rank: 31 },
  '국민평생직업능력개발법': { title: '국민 평생 직업능력 개발법', cat: 'social_ins', dept: '고용노동부', rank: 32 },
  '외국인근로자의고용등에관한법률': { title: '외국인근로자의 고용 등에 관한 법률', cat: 'non_regular', dept: '고용노동부', rank: 33 },
  '가사근로자의고용개선등에관한법률': { title: '가사근로자의 고용개선 등에 관한 법률', cat: 'non_regular', dept: '고용노동부', rank: 34 },
  '선원법': { title: '선원법', cat: 'labor_std', dept: '해양수산부', rank: 35 },
  '공인노무사법': { title: '공인노무사법', cat: 'admin_civil', dept: '고용노동부', rank: 36 },
  '공공기관의운영에관한법률': { title: '공공기관의 운영에 관한 법률', cat: 'admin_civil', dept: '기획재정부', rank: 37 },
  '지방공기업법': { title: '지방공기업법', cat: 'admin_civil', dept: '행정안전부', rank: 38 },
  '국가공무원법': { title: '국가공무원법', cat: 'admin_civil', dept: '인사혁신처', rank: 39 },
  '지방공무원법': { title: '지방공무원법', cat: 'admin_civil', dept: '행정안전부', rank: 40 },
  '민법': { title: '민법', cat: 'admin_civil', dept: '법무부', rank: 41 },
  '상법': { title: '상법', cat: 'admin_civil', dept: '법무부', rank: 42 },
  '민사소송법': { title: '민사소송법', cat: 'admin_civil', dept: '법무부', rank: 43 },
  '행정소송법': { title: '행정소송법', cat: 'admin_civil', dept: '법무부', rank: 44 },
  '행정심판법': { title: '행정심판법', cat: 'admin_civil', dept: '국민권익위원회', rank: 45 },
  '행정절차법': { title: '행정절차법', cat: 'admin_civil', dept: '행정안전부', rank: 46 },
  '개인정보보호법': { title: '개인정보 보호법', cat: 'admin_civil', dept: '개인정보보호위원회', rank: 47 },
  '국가인권위원회법': { title: '국가인권위원회법', cat: 'equality', dept: '국가인권위원회', rank: 48 },
  '채무자회생및파산에관한법률': { title: '채무자 회생 및 파산에 관한 법률', cat: 'admin_civil', dept: '법무부', rank: 49 },
  '신원보증법': { title: '신원보증법', cat: 'admin_civil', dept: '법무부', rank: 50 },
  '소득세법': { title: '소득세법', cat: 'admin_civil', dept: '기획재정부', rank: 51 },
  '국세기본법': { title: '국세기본법', cat: 'admin_civil', dept: '기획재정부', rank: 52 },
  '형법': { title: '형법', cat: 'admin_civil', dept: '법무부', rank: 53 },
  '대한민국헌법': { title: '대한민국헌법', cat: 'admin_civil', dept: '헌법', rank: 54 },
  '예비군법': { title: '예비군법', cat: 'admin_civil', dept: '국방부', rank: 55 },
  '민방위기본법': { title: '민방위기본법', cat: 'admin_civil', dept: '행정안전부', rank: 56 }
};

/* 같은 폴더 안에서 본법(법률(법률) > 법률 > 대통령령 > 시행령 > 시행규칙) 차례로 정렬한다.
 * 근로기준법·노조법처럼 1997년 폐지법률이 `법률.md`에 남고 현행법이 `법률(법률).md`에 있는 경우
 * `법률(법률).md`가 반드시 맨 앞에 오게 한다. */
function fileOrderScore(f) {
  if (f === '헌법') return 1;
  if (f === '법률(법률)') return 2;
  if (/^법률\(/.test(f)) return 3;
  if (f === '법률') return 4;
  if (f === '대통령령(대통령령)') return 5;
  if (/^대통령령/.test(f)) return 6;
  if (f === '시행령(대통령령)') return 7;
  if (/^시행령\(/.test(f)) return 8;
  if (f === '시행령') return 9;
  if (/^총리령/.test(f)) return 10;
  if (/^시행규칙\(/.test(f)) return 11;
  if (f === '시행규칙') return 12;
  return 20;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

async function buildIndex() {
  const rootTree = await fetchJson('https://api.github.com/repos/legalize-kr/legalize-kr/git/trees/main');
  const krNode = (rootTree.tree || []).find((t) => t.path === 'kr' && t.type === 'tree');
  if (!krNode) throw new Error('legalize-kr 에서 kr 트리를 찾지 못했습니다');

  const krTree = await fetchJson(krNode.url + '?recursive=1');
  const blobs = (krTree.tree || []).filter((t) => t.type === 'blob' && t.path.endsWith('.md'));

  const byDir = new Map();
  for (const b of blobs) {
    const slash = b.path.indexOf('/');
    if (slash <= 0) continue;
    const dir = b.path.slice(0, slash);
    const base = b.path.slice(slash + 1).replace(/\.md$/, '');
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(base);
  }

  const dirs = [...byDir.keys()].sort((a, b) => {
    const pa = PRIORITY_META[a] ? PRIORITY_META[a].rank : 99999;
    const pb = PRIORITY_META[b] ? PRIORITY_META[b].rank : 99999;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, 'ko');
  });

  const packedLines = [];
  let fileCount = 0;
  for (const dir of dirs) {
    const files = byDir.get(dir).sort((a, b) => {
      const sa = fileOrderScore(a);
      const sb = fileOrderScore(b);
      return sa !== sb ? sa - sb : a.localeCompare(b, 'ko');
    });
    /* `법률(법률)` 과 `법률` 이 둘 다 있는 폴더는 `법률.md` 가 구법 폐지법률(1조짜리)인 경우이므로
       혼동을 막기 위해 현행 `법률(법률)` 을 기본으로 두고 구 폐지법률 표시를 위해 뒤로 보낸다. */
    fileCount += files.length;
    packedLines.push(dir + '|' + files.join(','));
  }

  const snapshotDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const js = [
    '/* P박스 대한민국 국가법령 전수 색인 (scripts/make-pbox-lawindex.js 자동 생성) */',
    '(function(global){',
    "  'use strict';",
    '  var SNAPSHOT_AT = ' + JSON.stringify(snapshotDate) + ';',
    '  var KR_TREE_SHA = ' + JSON.stringify(krNode.sha) + ';',
    '  var TOTAL_FAMILIES = ' + dirs.length + ';',
    '  var TOTAL_FILES = ' + fileCount + ';',
    '  var PRIORITY_META = ' + JSON.stringify(PRIORITY_META, null, 2) + ';',
    '  var PACKED = ' + JSON.stringify(packedLines.join('\n')) + ';',
    '  var _parsed = null;',
    '  function list(){',
    '    if (_parsed) return _parsed;',
    '    var rows = PACKED.split("\\n");',
    '    var out = [];',
    '    for (var i = 0; i < rows.length; i++) {',
    '      var line = rows[i];',
    '      if (!line) continue;',
    '      var bar = line.indexOf("|");',
    '      if (bar < 0) continue;',
    '      var dir = line.slice(0, bar);',
    '      var files = line.slice(bar + 1).split(",");',
    '      var hasParenAct = files.indexOf("법률(법률)") >= 0;',
    '      var meta = PRIORITY_META[dir] || null;',
    '      out.push({',
    '        dir: dir,',
    '        title: meta ? meta.title : dir,',
    '        cat: meta ? meta.cat : "general",',
    '        dept: meta ? meta.dept : "",',
    '        priority: meta ? meta.rank : 0,',
    '        files: files,',
    '        primaryFile: files[0] + ".md",',
    '        hasRepealStub: hasParenAct && files.indexOf("법률") >= 0',
    '      });',
    '    }',
    '    _parsed = out;',
    '    return out;',
    '  }',
    '  global.PuPBoxLawIndex = {',
    '    SNAPSHOT_AT: SNAPSHOT_AT,',
    '    KR_TREE_SHA: KR_TREE_SHA,',
    '    TOTAL_FAMILIES: TOTAL_FAMILIES,',
    '    TOTAL_FILES: TOTAL_FILES,',
    '    PRIORITY_META: PRIORITY_META,',
    '    list: list',
    '  };',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');

  fs.writeFileSync(OUT, js, 'utf8');
  console.log('✓ P박스 전 법령 색인 생성 완료:', dirs.length, '개 법령군 ·', fileCount, '개 법령·시행령·시행규칙');
}

if (require.main === module) {
  buildIndex().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildIndex, PRIORITY_META, fileOrderScore };
