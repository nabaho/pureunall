'use strict';
// 서식집 — 순수 판단 로직 (Node 전용, 외부 의존 없음)
// 실행 스크립트(forms_report.js)와 테스트가 공유한다.
const crypto = require('crypto');

// ── 정규화 ──
// 태그·엔티티를 지우고 숫자를 #로 뭉갠다. 날짜·금액만 다른 같은 서식을 한 군집으로 묶기 위함.
function normalizeForHash(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function formHash(html) {
  return crypto.createHash('md5').update(normalizeForHash(html)).digest('hex').slice(0, 10);
}

// ── 유사도 (3-gram 어절 shingle의 자카드 계수) ──
function shingles(text, k) {
  k = k || 3;
  const w = String(text || '').split(/\s+/).filter(Boolean);
  const s = new Set();
  if (w.length < k) { if (w.length) s.add(w.join(' ')); return s; }
  for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' '));
  return s;
}

// 이미 생성된 shingle 집합에 대한 자카드 계수 계산 (내부용)
function jaccardSets(A, B) {
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function similarity(a, b) {
  const A = shingles(a), B = shingles(b);
  return jaccardSets(A, B);
}

// ── 군집 ──
// 1차: 정규화 해시로 완전동일 묶음. 2차: 묶음 대표끼리 유사도로 병합.
// 각 묶음 대표의 shingle 집합을 미리 생성한 후 쌍별 자카드 계수로 비교.
// shingle 재계산을 피함으로써 O(n²) 비교 성능 최적화.
function clusterByContent(items, threshold) {
  const th = threshold == null ? 0.85 : threshold;
  const byHash = new Map();
  for (const it of items) {
    const h = crypto.createHash('md5').update(String(it.text || '')).digest('hex');
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(it);
  }
  const groups = [...byHash.values()];
  const repShingles = groups.map(g => shingles(g[0].text));
  const merged = [];
  const used = new Array(groups.length).fill(false);
  for (let i = 0; i < groups.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let bucket = groups[i].slice();
    for (let j = i + 1; j < groups.length; j++) {
      if (used[j]) continue;
      if (jaccardSets(repShingles[i], repShingles[j]) >= th) {
        used[j] = true;
        bucket = bucket.concat(groups[j]);
      }
    }
    merged.push(bucket);
  }
  return merged;
}

// ── 세그먼트 분할 ──
// 한 HWP에 서식이 여러 개 들어 있다(예: 위임약정서+위임장+취하서+동의서+CMS).
// 경계는 중앙 제목줄. 자간을 벌린 제목(위 임 장)과 서식 어미로 끝나는 제목을 모두 잡는다.
const TITLE_TAIL = /(위임장|위임계약서|약정서|동의서|신청서|청구서|진정서|취하서|확인서|확인원|신고서|계산서|보고서|합의서|경위서|의견서|보정서|각서|서약서|확약서|명세서|증명서|선정서|위임약정서|고지확인서)$/;

// ── 제목 판정에서 '자간'만 믿으면 안 되는 이유 ──
// 한글 서식은 **기입란 라벨**도 칸을 맞추려고 자간을 벌린다(주 소 :, 성 명 :,
// 년 월 일). 모양만 보면 벌려 쓴 제목(위 임 장)과 구별되지 않는다. 실측 70건에서
// 자간 규칙 단독으로 189개 제목줄이 잡혔고 그중 태반이 라벨·상용구였다
// (서식 144종 / 문서 70건). 그래서 세 가지를 더 본다.
//   ① 콜론 — 콜론으로 끝나면 기입란 라벨이지 제목이 아니다.
//   ② 상용구 사전 — 서식마다 되풀이되는 머리말(년월일·첨부서류·신청취지…).
//   ③ 본문 유무 — 진짜 서식은 제목 아래에 내용이 있다(splitSegments에서 판정).
// TITLE_TAIL(서식 어미)은 지금까지처럼 강한 양성 신호로 남긴다.

// 상용구·기입란 라벨. 장식(글머리표·번호·괄호)을 걷어낸 알맹이로 비교한다.
// TITLE_TAIL의 어미와 겹치는 낱말은 넣지 않는다 — 넣으면 진짜 서식을 잃는다.
const BOILERPLATE = new RegExp('^(?:' + [
  // 머리말·구획
  '년월일', '년', '월', '일', '다음', '아래', '이상', '끝', '목차', '서언', '전문',
  '첨부서류', '첨부자료', '첨부', '별첨', '별첨자료', '붙임', '참고자료', '입증방법',
  '입증자료', '관계법령', '근거법령', '유의사항', '작성요령', '기재요령',
  // 신청·청구 문서의 고정 소제목
  '신청취지', '신청이유', '신청원인', '청구취지', '청구원인', '청구이유',
  '진정취지', '진정이유', '고소취지', '고소이유', '신청내용', '청구내용',
  '당사자표시', '당사자', '사건표시', '사건개요', '사실관계',
  // 기입란 라벨
  '주소', '자택주소', '현주소', '소재지', '사업장소재지', '성명', '이름', '생년월일',
  '주민등록번호', '연락처', '전화', '전화번호', '휴대전화', '이메일', '직위', '직책',
  '대표자', '담당자', '수신자', '발신자', '수신', '발신', '참조', '제목', '일시',
  '장소', '금액', '합계', '소계', '총액', '단가', '수량', '비고', '기타', '기타사항',
  '인지대', '송달료', '수령내역', '지급내역', '체불내역', '근무기간', '재직기간',
  // 당사자 라벨
  '위임자', '수임자', '위임인', '수임인', '신청인', '피신청인', '청구인', '피청구인',
  '진정인', '피진정인', '채권자', '채무자', '근로자', '사업주', '사용자', '대리인',
].join('|') + ')$');

// 한글 음절·자모, 한자, 라틴 문자는 정상. 그 밖의 '글자'가 섞이면 HWP→HTML 변환
// 잔재로 본다. (소스에 낯선 글자를 직접 박지 않으려고 \u 표기로 적는다.)
const NATIVE_LETTER = [
  '\\uAC00-\\uD7A3',   // 한글 음절
  '\\u1100-\\u11FF',   // 한글 자모
  '\\u3131-\\u318E',   // 한글 호환 자모
  '\\u4E00-\\u9FFF',   // 한자
  '\\uF900-\\uFAFF',   // 한자 호환
  'A-Za-z',
].join('');
const FOREIGN_LETTER = new RegExp('(?![' + NATIVE_LETTER + '])\\p{L}', 'u');

// 제목 후보에서 장식(번호·글머리표·괄호류)을 걷어낸 알맹이.
// '20년월일'·'--다음--'·'□위임자'·'【첨부자료】'가 모두 상용구 사전에 걸리게 한다.
function titleCore(bare) {
  return bare.replace(/^[^가-힣A-Za-z]+/, '').replace(/[^가-힣A-Za-z]+$/, '');
}

// 0 = 제목 아님, 1 = 약한 제목(자간으로만 추정), 2 = 강한 제목(서식 어미).
// 약한 제목은 splitSegments에서 본문 길이 검사를 한 번 더 통과해야 서식이 된다.
function titleRank(text) {
  const t = String(text || '').trim();
  const bare = t.replace(/\s/g, '');
  if (bare.length < 3 || bare.length > 24) return 0;
  if (/[.。]$/.test(t)) return 0;                 // 문장은 제목이 아니다
  if (/^제\s*\d+\s*조/.test(bare)) return 0;      // 조문 머리
  // 장/절/관/편 머리 — 조문과 같은 문서 구조 표지일 뿐 서식 제목이 아니다.
  // 취업규칙류 문서는 자간을 벌린 "제1장총칙"·"제3장복무" 같은 장절 제목이
  // 수십 개 들어 있는데, 이게 각각 제목줄로 잡혀 한 문서가 장절 수만큼
  // 과분할됐다(실측 6,848건에서 "제1장총칙" 484회 등 상위 '제목' 태반이
  // 장절 표제였다). 장/절/관/편 표제가 TITLE_TAIL 어미(위임장 등)로 끝나는
  // 경우는 실무상 없으므로 TITLE_TAIL 검사보다 앞에 두어도 진짜 서식을
  // 잃지 않는다 — "제3호서식"·"별지 제3호의2서식…" 처럼 '제'로 시작하지 않는
  // 진짜 서식명은 이 규칙에 걸리지 않는다.
  if (/^제\s*\d+\s*[장절관편]/.test(bare)) return 0;
  if (/[:：]$/.test(bare)) return 0;              // 콜론으로 끝나면 기입란 라벨
  if (BOILERPLATE.test(titleCore(bare))) return 0;
  if (TITLE_TAIL.test(bare)) return 2;
  // 순번 글머리 — 동그라미 숫자(①…⑳ 등)와 아라비아 숫자 목록("1." "1)")은
  // 조문 하위의 목록 항목 표지다(예: "②임금계산기간및지급일등"은 취업규칙
  // 조문 속 하위 항목이지 서식 제목이 아니다). 다만 위 TITLE_TAIL 검사를
  // 이미 통과했다면(강한 서식 어미) 여기 도달하지 않는다 — 한 문서에 여러
  // 서식을 "1.위임장 2.확인서"처럼 번호로 나열해 놓은 사례가 있어, 서식
  // 어미가 있는 줄까지 번호 때문에 지워버리면 안 되기 때문이다. TITLE_TAIL
  // 이 없는데 번호로 시작하면 목록 항목으로 보고 걸러낸다.
  if (/^[①-⑳➀-➓]/.test(bare) || /^[0-9]+[.)]/.test(bare)) return 0;
  // 어미가 약한데 줄 안에 콜론까지 있으면 라벨이다('- 성 명 : 대표 (☎ )').
  if (/[:：]/.test(bare)) return 0;
  // HWP 제어문자가 글자로 새어 나온 잔재(금 ÈĀ 원 송 달 료). 한글·라틴 문자가
  // 아닌 '글자'가 섞여 있으면 사람이 붙인 제목이 아니다. 기호(※ ■ ☐ ․)는
  // \p{L}이 아니므로 여기에 걸리지 않는다.
  if (FOREIGN_LETTER.test(bare)) return 0;
  const spaced = (t.length - bare.length) / bare.length >= 0.5;
  return spaced ? 1 : 0;
}

function isTitleLine(text) {
  return titleRank(text) > 0;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

// 제목 아래 본문의 최소 길이(태그를 걷어낸 글자 수).
// 강한 제목은 "본문이 아예 없는가"만 본다 — 표 한 칸짜리 서식도 있기 때문에 낮게 잡는다.
// 약한 제목(자간만으로 추정)은 문서 한 장 분량의 본문을 요구한다. 라벨 아래에는
// 다음 라벨까지의 몇 글자밖에 없고, 진짜 서식 본문은 그보다 한 자릿수 이상 길다.
const MIN_BODY_STRONG = 1;
const MIN_BODY_WEAK = 120;

// 표 «밖»의 문단(<p …>) 앞에서만 자른다.
// ⚠★ 2026-10-04 실측 — hwp2html.py 가 가운데맞춤·줄간격을 되살리면서(2c2b30b8) 문단이 <p style="…"> 로 나온다.
//   예전 잣대(맨 <p> 만)로는 6,942조각 중 261개만 제목을 찾았다(서식 3,501종 중 제목 113종).
//   또 칸 안 문단을 <p> 로 내는 문서가 88건 생겨, 표 안에서 자르면 서식이 칸 한가운데서 갈린다.
//   그래서 «속성이 붙은 <p>»도 받고, 표(<table>) 안의 <p> 에서는 자르지 않는다.
function topLevelParts(src) {
  const cuts = [];
  let depth = 0, m;
  const re = /<(\/?)(table|p)\b[^>]*>/gi;
  while ((m = re.exec(src))) {
    const tag = m[2].toLowerCase();
    if (tag === 'table') { depth += m[1] ? -1 : 1; if (depth < 0) depth = 0; continue; }
    if (!m[1] && depth === 0 && m.index > 0) cuts.push(m.index);
  }
  const parts = [];
  let at = 0;
  cuts.forEach(c => { parts.push(src.slice(at, c)); at = c; });
  parts.push(src.slice(at));
  return parts.filter(p => p !== '');
}
const P_HEAD = /^<p\b[^>]*>([\s\S]*?)<\/p>/i;

function splitSegments(html) {
  const src = String(html || '');
  const parts = topLevelParts(src);
  const raw = [];
  let cur = null;
  let preamble = '';
  for (const part of parts) {
    const m = P_HEAD.exec(part);
    const rank = m ? titleRank(stripTags(m[1])) : 0;
    if (rank) {
      cur = { title: stripTags(m[1]).replace(/\s/g, ''), html: part, rank };
      raw.push(cur);
    } else if (cur) {
      cur.html += part;
    } else {
      // 첫 제목 이전의 머리말 — 버리지 않고 보관했다가 첫 조각에 붙인다
      preamble += part;
    }
  }
  if (!raw.length) return [{ title: '', html: src, index: 0 }];

  // 본문이 부실한 조각은 서식이 아니다 — 앞 조각에 되돌려 붙인다.
  // "제목처럼 생겼는가"를 더 정교하게 맞히려 애쓰는 대신, 잘라 놓고 결과를 보고
  // 무르는 방식이라 어떤 낱말이 제목인지 알아맞힐 필요가 없다.
  const segs = [];
  for (const s of raw) {
    const body = stripTags(s.html.replace(P_HEAD, ''));
    if (body.length >= (s.rank >= 2 ? MIN_BODY_STRONG : MIN_BODY_WEAK)) { segs.push(s); continue; }
    if (segs.length) { segs[segs.length - 1].html += s.html; continue; }
    // 앞에 붙일 조각이 없다. 약한 제목이면 머리말로 흘려보내고,
    // 강한 제목이면 서식을 잃지 않도록 그대로 살린다.
    if (s.rank >= 2) segs.push(s); else preamble += s.html;
  }
  if (!segs.length) return [{ title: '', html: src, index: 0 }];
  segs[0].html = preamble + segs[0].html;
  return segs.map((s, i) => ({ title: s.title, html: s.html, index: i }));
}

// ── 분류 ──
const CATEGORY_RULES = [
  ['mandate',       /위임장|위임약정|약정서|선임신고|수임|선정서/],
  ['consent',       /개인정보|동의서|자동이체|CMS|계좌/i],
  ['wageGuarantee', /체당금|대지급금|도산등사실|지급청구서/],
  ['complaint',     /진정서|진정신고|취하서|고소장|확인원|발급신청서/],
  ['civil',         /지급명령|배당요구|채권계산|가압류|보정서|변론기일|이의신청|소장|준비서면/],
  ['settlement',    /합의서|확약서|각서/],
];

// 관할 지청 — 사무소가 실제로 쓰는 곳만 둔다. 새 지청은 여기에 추가.
const JURISDICTIONS = ['천안', '평택', '보령', '아산', '서산', '대전', '청주', '홍성'];

const SIGN_WORKER   = /위임인|진정인|신청인|청구인|근로자|취하인|동의자|본\s*인/;
const SIGN_EMPLOYER = /사업주|사용자|대표이사|회사|법인/;
const SIGN_MARK     = /\(\s*인\s*\)|㊞|서\s*명|날인|자필/;

function classify(relPath, html, taxonomy) {
  const rel = String(relPath || '');
  const text = stripTags(html);
  const hay = rel + ' ' + text.slice(0, 400);

  const hits = (taxonomy.tracks || []).filter(t => new RegExp(t.re).test(rel));
  const track = hits.map(t => t.name);

  let domain = 'other';
  if (hits.length) {
    const count = {};
    for (const h of hits) count[h.domain] = (count[h.domain] || 0) + 1;
    domain = Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b))[0];
  }

  let category = 'internal';
  for (const [name, re] of CATEGORY_RULES) { if (re.test(hay)) { category = name; break; } }

  const hasMark = SIGN_MARK.test(text);
  let signer = null;
  if (hasMark) signer = SIGN_WORKER.test(text) ? 'worker'
                      : SIGN_EMPLOYER.test(text) ? 'employer' : null;

  const esign = signer === 'worker' &&
    ['mandate', 'consent', 'complaint', 'wageGuarantee', 'civil', 'settlement'].includes(category);

  let jurisdiction = null;
  for (const j of JURISDICTIONS) { if (rel.includes(j)) { jurisdiction = j; break; } }

  return { domain, track, category, esign, signer, jurisdiction };
}

// ── 서명란 라벨 ──
// signFields[].label은 "누가 서명하는 자리인가"를 나타내는 캡션이어야 한다.
// 서식 제목(rep.title, 예: '위임약정서')을 그대로 넣으면 문서 제목이 캡션
// 자리에 들어가 버린다 — Phase 1에서 e서명 템플릿을 만들 때 그대로 읽으므로
// 미리 고쳐 둔다. signer('worker'/'employer')와 category로 실제 당사자 호칭을
// 고른다. 매핑에 없는 조합(예: category:'internal')은 무난한 기본값으로 떨어진다.
const SIGNER_ROLE_LABEL = {
  worker: {
    mandate: '위임인', complaint: '진정인', wageGuarantee: '신청인',
    civil: '신청인', consent: '동의자', settlement: '근로자',
  },
  employer: '사업주',
};
function signFieldLabel(signer, category) {
  if (signer === 'employer') return SIGNER_ROLE_LABEL.employer;
  if (signer === 'worker') return SIGNER_ROLE_LABEL.worker[category] || '근로자';
  return '서명';
}

// ── 익명화 / PII ──
//
// 이 두 함수(anonymize·scanPii)가 실사건 원본 17,483건과 GitHub Pages에 공개될
// 정적 서식집 사이의 유일한 자동 방어선이다. 오탐(과다 마스킹)은 서식이 조금
// 상하는 정도지만, 미탐은 곧 개인정보 유출이다. 애매하면 가리는 쪽으로 판단한다.

// ── 감지용 뷰 ──
// 원문과 **길이가 정확히 같은** 사본을 만든다. 길이가 1:1이므로 정규식이 찾은
// 위치를 원문 좌표로 그대로 쓸 수 있고, 그래서 anonymize(원문을 치환)와
// scanPii(검출만)가 문자 그대로 같은 것을 본다 — 두 함수가 어긋나서
// "검출은 되는데 지워지지는 않는" 구멍이 생기지 않는다.
//   (a) 태그 → 같은 길이의 공백. 표 레이아웃(<td>790101</td><td>1234567</td>)에서
//       셀 값이 서로 달라붙어 한 덩어리 숫자가 되는 것을 막고 \b 앵커를 되살린다.
//       stripTags는 태그를 빈 문자열로 지우므로(=값이 붙는다) 여기서 쓰지 않는다.
//       stripTags 자체는 Task 3/4 소비자가 현재 동작에 의존하므로 건드리지 않는다.
//   (b) 숫자 문자 참조(&#45; 등) → 실제 문자 + 남는 자리는 공백.
//       HWP→HTML 변환기가 하이픈을 &#45;로 뱉는 사례가 있다.
//   (c) &nbsp; → 공백.
//   (d) 보이지 않는 문자(소프트 하이픈·제로폭)는 공백으로, 전각 숫자는 ASCII 숫자로.
//   (e) {{변수}} → 공백. 이미 치환된 자리는 다시 건드리지 않는다(vault).
//       단 "변수 이름처럼 생긴 것"만 보호한다. 예전처럼 {{...}} 아무거나 보호하면
//       {{ 790101-1234567 }} 같은 껍데기가 진짜 주민번호를 통째로 삼켜버린다.
//
// 이 방식 덕분에 예전의 널문자 센티널 vault(치환했다가 되돌리는 방식)가 통째로
// 없어졌다. 되돌리는 단계 자체가 없으므로 입력에 널 문자가 섞여 있어도
// 복원 정규식이 undefined를 뱉는 일이 구조적으로 불가능하다.
// 마크업 한 덩어리 = 주석 또는 태그. detectView·compactView·applyMatches가
// 모두 이 하나를 쓴다 — 셋이 "마크업이란 무엇인가"에 대해 다르게 판단하면
// 좌표와 태그 보존이 어긋난다.
// 주석을 먼저 태우는 이유: 안에 '>'가 들어갈 수 있어 <[^>]+>로는 중간에서 잘린다.
const MARKUP_RE = /<!--[\s\S]*?-->|<[^>]+>/g;
const ENTITY_RE = /&nbsp;|&#(?:[xX][0-9a-fA-F]+|\d+);/g;
// 변수 이름 전체 모양을 강제한다. 예전 /\{\{[A-Za-z_가-힣][^{}]{0,63}\}\}/ 는
// 첫 글자만 검사해서 {{주민 790101-1234567}}·{{x790101-1234567}}처럼
// 이름 흉내만 낸 껍데기가 진짜 주민번호를 통째로 삼켰다.
const VAULT_RE = /\{\{[A-Za-z_가-힣][A-Za-z0-9_가-힣]{0,63}\}\}/g;
// 눈에 보이지 않지만 숫자 사이에 끼어 자릿수와 \b 앵커를 깨뜨리는 문자들.
// 소프트 하이픈 U+00AD, 제로폭 U+200B~200D·U+2060, BOM U+FEFF.
// 소스에 보이지 않는 문자를 그대로 박아 넣지 않는다 — 반드시 이스케이프 표기로.
const INVISIBLE_G = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const FULLWIDTH_DIGIT_G = /[\uFF10-\uFF19]/g;

function blanks(n) { return ' '.repeat(n); }

// 길이를 1:1로 유지하면서 (b)(c)(d)를 적용한다. detectView와 markupView가 공유한다.
function foldView(v) {
  v = v.replace(ENTITY_RE, (m, offset, whole) => {
    let ch = ' ';
    if (m.toLowerCase() !== '&nbsp;') {
      const body = m.slice(2, -1);
      const code = (body[0] === 'x' || body[0] === 'X')
        ? parseInt(body.slice(1), 16) : parseInt(body, 10);
      // 제어문자(널 포함)는 공백으로 — 뷰에 널을 만들지 않는다.
      if (Number.isFinite(code) && code >= 32 && code <= 0x10FFFF) {
        try { ch = String.fromCodePoint(code); } catch (_) { ch = ' '; }
      }
    }
    if (ch.length > m.length) ch = ' ';   // 길이가 넘치면 포기하고 공백
    const pad = blanks(m.length - ch.length);
    // 남는 자리를 어느 쪽에 둘지: 풀어낸 글자가 숫자이고 바로 뒤도 숫자면
    // 왼쪽에 몰아서 뒤 숫자와 붙인다(&#55;90101-1234567 → "    790101-…").
    // 그 외에는 오른쪽 — 앞 숫자와 붙어야 하는 경우(123456&#55;)를 지킨다.
    const next = whole[offset + m.length];
    const joinRight = /\d/.test(ch) && next !== undefined && /\d/.test(next);
    return joinRight ? pad + ch : ch + pad;
  });
  return v.replace(INVISIBLE_G, ' ')
          .replace(FULLWIDTH_DIGIT_G, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30));
}

function detectView(src) {
  const v = foldView(String(src == null ? '' : src).replace(MARKUP_RE, m => blanks(m.length)));
  return v.replace(VAULT_RE, m => blanks(m.length));
}

// ── 마크업 내부 뷰 ── (detectView의 정확한 반대)
// 태그 속성값과 주석 본문만 남기고 바깥은 전부 공백. 길이는 역시 1:1이다.
// detectView·compactView가 태그 구간을 통째로 지우기 때문에 alt="790101-1234567"이나
// <!-- 790101-1234567 --> 같은 값은 두 뷰 어디에도 보이지 않는다. 여기서만 보인다.
function markupView(src) {
  const s = String(src == null ? '' : src);
  const out = new Array(s.length).fill(' ');
  const rx = new RegExp(MARKUP_RE.source, 'g');
  let m;
  while ((m = rx.exec(s)) !== null) {
    const isComment = m[0].slice(0, 4) === '<!--';
    const from = m.index + (isComment ? 4 : 1);              // '<!--' / '<' 다음
    const to = m.index + m[0].length - (isComment ? 3 : 1);  // '-->' / '>' 앞
    for (let i = from; i < to; i++) out[i] = s[i];
  }
  return foldView(out.join(''));
}

// 태그와 보이지 않는 문자를 아예 지운 '압축 뷰'와 원문 좌표 대응표
// (map[i] = 원문에서의 위치).
// 공백 뷰는 표 셀이 달라붙는 것을 막아 주지만, 그 대가로 숫자 한가운데를 태그가
// 가르는 경우(790101-1234<b>567</b>)를 놓친다. 압축 뷰는 정확히 그 반대다.
// 제로폭 문자가 숫자 한가운데 낀 경우(790101-123<U+200B>4567)도 같은 계열의
// 미탐이라 여기서 함께 닫는다 — 공백 뷰는 길이를 지켜야 해서 공백으로만 바꿀 수
// 있고, 그러면 자릿수가 여전히 끊긴다.
// 그래서 둘 다 본다 — 단 압축 뷰에서는 COMPACT_RULES만, 그것도 검증 함수를
// 통과한 것만 인정한다. 셀이 융합돼 생기는 헛매치가 유효한 생년월일·성별자리(또는
// 11자리 휴대폰 꼴)까지 갖출 확률은 낮고, 설령 걸려도 결과는 마스킹이라 안전한
// 방향이다. 계좌·유선전화 규칙은 압축 뷰에서 돌리지 않는다 — 자릿수 폭이 넓어
// 셀을 가로질러 과잉 삼킬 위험이 크다.
function compactView(src) {
  const s = String(src == null ? '' : src);
  const v = detectView(s);
  const rx = new RegExp(MARKUP_RE.source, 'g');
  const drop = [];
  let t;
  while ((t = rx.exec(s)) !== null) drop.push([t.index, t.index + t[0].length]);
  const inv = new RegExp(INVISIBLE_G.source);
  let text = '';
  const map = [];
  let di = 0;
  for (let i = 0; i < v.length; i++) {
    while (di < drop.length && i >= drop[di][1]) di++;
    if (di < drop.length && i >= drop[di][0]) continue;   // 태그·주석 안쪽
    if (inv.test(s[i])) continue;                         // 보이지 않는 문자
    map.push(i);
    text += v[i];
  }
  return { text, map };
}

// 뷰에서 매치 구간을 모은다. 정규식은 반드시 복제해서 쓴다 —
// PII_RULES의 g 플래그 정규식을 외부 소비자가 .test()로 건드려 lastIndex가
// 오염돼 있어도 여기서는 영향을 받지 않는다.
function findMatches(view, re, ok) {
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out = [];
  let m;
  while ((m = rx.exec(view)) !== null) {
    if (m[0] === '') { rx.lastIndex++; continue; }
    if (!ok || ok(m[0])) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

// 하이픈 자리에 올 수 있는 문자들 — ASCII 하이픈, U+2010~2015 대시류, 전각 하이픈.
// 숫자 문자 참조(&#45; 등)는 detectView가 이미 실제 문자로 풀어놓는다.
const DASH_CHARS = '-\\u2010-\\u2015\\uFF0D';
const DASH = '[' + DASH_CHARS + ']';

// 전화번호 마디 구분자. 대시류·점·닫는 괄호는 앞뒤로 공백을 조금 허용하고,
// 구분자가 아예 없거나 공백 한 칸인 경우도 인정한다.
// 공백은 **한 칸까지만** 허용하는 것이 핵심이다. detectView에서 </td><td>는
// 공백 9칸, <br>은 4칸, </p><p>는 7칸이 되므로 한 칸짜리 허용으로는 셀을
// 가로질러 융합될 수 없다. 셀이 나뉜 전화번호는 압축 뷰 패스가 따로 잡는다.
const PSEP = '(?:\\s{0,3}[' + DASH_CHARS + '.)]\\s{0,3}|\\s?)';
const PSEP_REQ = '(?:\\s{0,3}[' + DASH_CHARS + '.)]\\s{0,3}|\\s)';   // 구분자 생략 불가

// 주민번호 생년월일·성별자리 sanity 검사. 13자리 맨숫자 규칙에 반드시 붙인다.
// (없으면 무관한 13자리 일련번호를 통째로 먹는다.)
// 이 검사를 통과하는 13자리 계좌번호가 가끔 주민등록번호로 잡힐 수 있다 —
// 결과는 어차피 마스킹이므로 유출이 아니라 라벨만 달라질 뿐이고, 그 방향이 안전하다.
function looksLikeRrn(s) {
  const d = s.replace(/\D/g, '');
  if (d.length !== 13) return false;
  const mm = +d.slice(2, 4), dd = +d.slice(4, 6), g = +d[6];
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && g >= 1 && g <= 8;
}

// 휴대폰 sanity 검사. 압축 뷰 패스와 공백으로 갈라진 형태에 붙인다.
// 정확히 11자리이고 01[016789]로 시작해야 한다.
function looksLikePhone(s) {
  const d = s.replace(/\D/g, '');
  return d.length === 11 && /^01[016789]/.test(d);
}

// 순서가 중요하다. 주민번호(######-#######)는 법인등록번호와 형태가 같고,
// 사업자등록번호(###-##-#####)는 계좌번호 패턴에도 걸린다. 좁은 것부터 먼저 태운다.
// 3번째 원소는 선택적 검증 함수 — 정규식만으로 못 가리는 오탐을 막는다.
const PII_RULES = [
  // (1) 대시류로 갈라진 주민번호. 검증 함수를 일부러 달지 않았다 —
  //     991301-1234567처럼 달이 깨진 값도 사람이 손으로 적은 주민번호일
  //     가능성이 높으니 가리는 쪽이 안전하다. 대시가 실제로 찍혀 있으므로
  //     무관한 두 숫자가 우연히 이 꼴이 될 위험은 거의 없다.
  //     앞뒤 경계를 \b가 아니라 (?<!\d)/(?!\d)로 잡는다. \b는 영문자에 붙은
  //     숫자(예: {{x790101-1234567}}의 껍데기 안쪽)를 놓치는데, 자릿수를
  //     넘치게 하는 것은 '숫자'뿐이므로 숫자만 막으면 충분하다.
  ['주민등록번호',   new RegExp('(?<!\\d)\\d{6}\\s*' + DASH + '\\s*[1-8]\\d{6}(?!\\d)', 'g'), null],
  // (2) 공백만으로 갈라진 주민번호. HWP 표에서 셀이 나뉜
  //     <td>790101</td><td>1234567</td>가 detectView에서 공백으로 이어지며
  //     만들어지는, 실무상 가장 흔한 모양이다.
  //     **여기에는 반드시 검증 함수를 단다.** \s+는 길이 제한이 없어서
  //     </td><td> 자리의 공백을 통째로 건너뛰는데, 검증 없이 두면
  //     <td>250000</td><td>1234567</td>(단가·수량)나
  //     <td>202301</td><td>1500000</td>(연월·금액)처럼 서로 무관한 두 셀을
  //     한 덩어리로 잡아 버린다. 그리고 applyMatches는 매치 구간 전체를
  //     자리표시자 하나로 바꾸므로, 두 번째 셀의 값은 '라벨링'되는 게 아니라
  //     **삭제**된다 — 체불금품확인서에서 임금 액수가 소리 없이 사라진다.
  //     (예전 주석은 "금액은 콤마를 달고 나온다"며 이 위험을 넘겼지만,
  //      1,800,000은 그렇더라도 콤마 없는 금액·사번·연월 코드는 아니다.)
  //     남는 오탐: 230115 1800000처럼 mm=01 dd=15 g=1로 구조가 온전한 값은
  //     원리상 구별할 수 없다. 이건 감수한다 — 미탐보다 오탐이 안전하다.
  ['주민등록번호',   /(?<!\d)\d{6}\s+[1-8]\d{6}(?!\d)/g, looksLikeRrn],
  // (3) 구분자 없는 13자리. 반드시 검증 함수와 함께 쓴다.
  ['주민등록번호',   /(?<!\d)\d{13}(?!\d)/g, looksLikeRrn],
  // 휴대폰. 010 1234 5678·010.1234.5678도 평범한 한국식 표기다.
  ['연락처',         new RegExp('\\b01[016789]' + PSEP + '\\d{3,4}' + PSEP + '\\d{4}\\b', 'g'), null],
  // 유선전화. 구분자 생략은 허용하지 않는다 — 0으로 시작하는 8~11자리 숫자를
  // 통째로 삼키게 된다.
  ['전화번호',       new RegExp('\\b0\\d{1,2}' + PSEP_REQ + '\\d{3,4}' + PSEP_REQ + '\\d{4}\\b', 'g'), null],
  ['사업자등록번호', /\b\d{3}-\d{2}-\d{5}\b/g, null],
  // 계좌번호는 은행마다 자릿수가 달라 넓게 잡되,
  //  - 숫자 10자리 이상만 인정하고(날짜 2023-01-15 배제),
  //  - 앞이 연-월- 꼴이면 아예 시작하지 않으며(2023-01-15-001 배제),
  //  - 마지막 마디를 4자리까지 허용한다(카드번호 1234-5678-9012-3456의
  //    끝 네 자리가 잘려 남던 문제).
  ['계좌번호',       /\b(?!(?:19|20)\d{2}-(?:0\d|1[0-2])-)\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,4})?\b/g,
                     s => s.replace(/\D/g, '').length >= 10],
  // 이메일. 맨 뒤에 둔다 — 앞의 숫자 규칙들이 먼저 자기 몫을 가져가야
  // PII_RULES[0]이 주민번호라는 소비자 가정(lastIndex 회귀 테스트)이 유지된다.
  ['이메일',         /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}\b/g, null],
];

// ── 스캔 전용 규칙 ──
// anonymize는 이 규칙들을 **절대** 적용하지 않는다. scanPii만 보고한다.
// 상세주소는 개인정보보호법상 개인정보이고 위임장·진정서·체불금품확인서에
// 근로자 자택 주소가 실제로 들어 있다. 그런데 같은 패턴에 사무소 주소
// ("충남 천안시 서북구 원두정8길 6, 두정빌딩 3층")와 관할 지청 주소가 걸린다 —
// 이건 서식에 남아 있어야 하는 내용이라 자동 치환하면 서식이 망가진다.
// 그래서 "이 서식에 주소가 있다"고 알리기만 하고, 지울지 말지는 검토하는
// 노무사가 정한다. scanPii 결과의 kind 필드로 구분된다('redact' vs 'review').
// → 소비자 주의: "PII 잔존 0종" 게이트는 반드시
//   scanPii(h).filter(f => f.kind === 'redact') 로 세야 한다. 그냥 .length로 세면
//   사무소 주소가 인쇄된 위임장이 전부 걸려 게이트를 영원히 통과하지 못한다.
// 꼬리는 (?!\s\s)로 공백 2칸 이상(=detectView에서 태그가 지워진 자리) 앞에서 멈춘다.
const SCAN_ONLY_RULES = [
  ['상세주소',
   /(?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s?[가-힣]{1,10}(?:시|군|구)\s?(?:(?!\s\s)[^<{]){4,50}/g,
   null],
];

// 압축 뷰 보완 패스에서 쓸 규칙 — 검증 함수를 **강제로** 붙인다.
// 압축 뷰는 태그를 지워 셀을 붙여 놓으므로, 검증 없는 규칙을 돌리면
// 무관한 셀들이 융합돼 데이터가 지워진다(위 (2)번 규칙과 같은 사고).
// 주민번호는 looksLikeRrn, 휴대폰은 looksLikePhone(정확히 11자리 + 01[016789]).
// 휴대폰 검증은 충분히 좁아서 셀 융합 오탐이 사실상 나오지 않는다 —
// <td>010</td><td>1234</td><td>5678</td>는 잡고, 무관한 숫자 셋은 자릿수에서 걸린다.
const COMPACT_RULES = PII_RULES
  .filter(r => r[0] === '주민등록번호' || r[0] === '연락처')
  .map(r => [r[0], r[1], r[0] === '주민등록번호' ? looksLikeRrn : looksLikePhone]);

// 규칙표는 얼려서 내보낸다. 다만 안에 든 RegExp 객체 자체는 얼리지 않는다 —
// g 플래그 정규식을 Object.freeze하면 lastIndex가 read-only가 되어
// .test()도 String.replace()도 TypeError를 던진다. lastIndex 오염 문제는
// findMatches가 정규식을 복제해 쓰는 것으로 이미 막혀 있다.
function deepFreezeRules(rules) { rules.forEach(Object.freeze); return Object.freeze(rules); }
deepFreezeRules(PII_RULES);
deepFreezeRules(SCAN_ONLY_RULES);
deepFreezeRules(COMPACT_RULES);

// 원문 좌표의 매치 구간들을 자리표시자로 바꾼다.
function applyMatches(src, ms, make) {
  if (!ms.length) return src;
  let out = '', pos = 0;
  for (const m of ms) {
    if (m.start < pos) continue;   // 앞 매치와 겹치면 건너뛴다
    // 매치 구간에 걸린 태그는 살려서 자리표시자 뒤에 붙인다.
    // 표 셀 경계(</td><td>)나 인라인 태그를 통째로 삼키면 서식 뼈대가 무너진다.
    const tags = (src.slice(m.start, m.end).match(MARKUP_RE) || []).join('');
    out += src.slice(pos, m.start) + make() + tags;
    pos = m.end;
  }
  return out + src.slice(pos);
}

// 매치 구간이 엔티티(&#55; · &nbsp;)를 반쪽만 물면 통째로 삼키도록 넓힌다.
// detectView는 엔티티를 '실제 문자 + 남는 자리 공백'으로 펴기 때문에, 그 남는
// 공백 자리에서 매치가 시작·종료되면 원문에는 '&#55' 같은 반토막이 남는다
// (&#55;90101-1234567 → "&#55{{주민등록번호}}"). 개인정보가 새는 건 아니지만
// 서식에 쓰레기가 남으므로 경계를 엔티티 단위로 맞춘다.
function snapToEntities(src, ms) {
  if (!ms.length) return ms;
  const rx = new RegExp(ENTITY_RE.source, 'g');
  const ents = [];
  let e;
  while ((e = rx.exec(src)) !== null) ents.push([e.index, e.index + e[0].length]);
  if (!ents.length) return ms;
  return ms.map(m => {
    let start = m.start, end = m.end;
    for (const [a, b] of ents) {
      if (a < end && b > start) {            // 반쪽이라도 겹치면
        if (a < start) start = a;
        if (b > end) end = b;
      }
    }
    return { start, end };
  });
}

// 한 규칙을 원문에 적용한다. 매치는 감지용 뷰에서 찾고, 치환은 원문 좌표에 한다.
function applyRule(src, re, ok, make) {
  return applyMatches(src, snapToEntities(src, findMatches(detectView(src), re, ok)), make);
}

// 압축 뷰에서 찾아 원문 좌표로 되돌려 적용한다.
function applyRuleCompact(src, re, ok, make) {
  const { text, map } = compactView(src);
  const ms = findMatches(text, re, ok)
    .map(m => ({ start: map[m.start], end: map[m.end - 1] + 1 }));
  return applyMatches(src, snapToEntities(src, ms), make);
}

function anonymize(html, names) {
  let out = String(html || '');
  const hits = {};
  const bump = label => () => {
    hits[label] = (hits[label] || 0) + 1;
    return '{{' + label + '}}';
  };
  for (const [label, re, ok] of PII_RULES) out = applyRule(out, re, ok, bump(label));
  // 태그·제로폭 문자가 숫자 한가운데를 가른 주민번호·휴대폰 보완 패스.
  // 앞 단계에서 이미 치환된 자리는 {{주민등록번호}}가 되어 vault에 걸리므로
  // 두 번 세거나 두 번 치환되지 않는다.
  for (const [label, re, ok] of COMPACT_RULES) out = applyRuleCompact(out, re, ok, bump(label));
  // 인명 치환은 규칙 통과 뒤에 돈다. applyRule이 매번 detectView를 다시 뜨므로
  // 방금 넣은 {{연락처}} 같은 자리표시자도 vault에 들어가 다시 매치되지 않는다
  // (예전에는 인명 '연락처'가 {{연락처}}를 또 먹어 {{{{이름}}}}가 됐다).
  //
  // ── 성능 (알고 남긴 비용) ──
  // applyRule은 규칙마다·이름마다 detectView를 처음부터 다시 뜬다. 아래 압축 뷰
  // 패스는 거기에 더해 compactView(=detectView + 문자마다 map 배열 push)를 또 뜬다.
  // 실측: 90KB 문서 × 이름 200개 기준 187ms → 850ms (약 4.5배).
  // 이름 200개는 최악값이고 실제 서식 한 건의 인명 사전은 훨씬 작다. 17,483건을
  // 한 번 돌리는 배치 작업이라 감수하고 지금은 최적화하지 않는다.
  // (뷰를 캐시하려면 '치환할 때마다 원문이 바뀐다'는 전제가 깨지므로 재진입
  //  안전성을 처음부터 다시 증명해야 한다. 배치가 느려서 문제가 되면 그때
  //  compactView의 map을 Int32Array로 바꾸는 것부터 손대면 된다.)
  for (const n of (names || [])) {
    if (!n || n.length < 2) continue;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 앞뒤가 한글이면 다른 낱말의 일부다 — '정산'이 '정산금/정산서'를 먹지 않도록.
    const re = new RegExp('(?<![\\uAC00-\\uD7A3])' + esc + '(?![\\uAC00-\\uD7A3])', 'g');
    out = applyRule(out, re, null, bump('이름'));
    // 인라인 태그가 이름을 가른 경우(홍<b>길동</b>). 위임장에서 이름은 가장
    // 많이 나오는 개인정보이고, 사전에 실린 정확한 문자열만 찾으므로 셀이
    // 융합돼 헛매치가 날 위험이 사실상 없다 — 그래서 압축 뷰도 함께 본다.
    // 공백 뷰 패스가 먼저 잡은 자리는 {{이름}}이 되어 vault에 걸리므로
    // 두 번 세지 않는다.
    out = applyRuleCompact(out, re, null, bump('이름'));
  }
  return { html: out, hits };
}

function scanPii(html) {
  // anonymize와 똑같은 뷰를 보고, 같은 순서로 '소비'하며 훑는다.
  // 원문에 규칙을 각각 돌리면 010-9999-8888 하나가
  // 연락처·전화번호·계좌번호 셋으로 중복 보고된다.
  // 반환 원소: { label, sample, kind } — kind는 'redact'(anonymize가 지우는 것)
  // 또는 'review'(사람이 보고 정하는 것, 상세주소).
  const src = String(html || '');
  let work = detectView(src);
  const found = [];
  // 라벨만으로 키를 잡으면 같은 라벨이 다른 kind로 두 번 나올 때 먼저 본 kind가
  // 그대로 굳는다. 오늘은 라벨과 kind가 1:1이라 드러나지 않지만, 규칙을 하나
  // 옮기는 순간 조용히 틀린 kind가 나가고 게이트 계산이 어긋난다. 둘 다로 잡는다.
  const byKey = new Map();
  const entry = (label, kind) => {
    const key = kind + ':' + label;
    let e = byKey.get(key);
    if (!e) { e = { label, sample: '', kind, _s: [] }; byKey.set(key, e); found.push(e); }
    return e;
  };
  // 한 뷰를 규칙 순서대로 '소비'하며 훑는다. 찾은 자리는 같은 길이의 공백으로
  // 지운다 — 길이를 유지해야 뒤 규칙의 앵커와 좌표가 어긋나지 않는다.
  const sweep = (view, rules, kind) => {
    let w = view;
    for (const [label, re, ok] of rules) {
      const ms = findMatches(w, re, ok);
      if (!ms.length) continue;
      const e = entry(label, kind);
      let next = '', pos = 0;
      for (const m of ms) {
        next += w.slice(pos, m.start) + blanks(m.end - m.start);
        pos = m.end;
        e._s.push(m.text.replace(/\s+/g, ' ').trim());
      }
      w = next + w.slice(pos);
    }
    return w;
  };

  work = sweep(work, PII_RULES, 'redact');          // 지워야 하는 것

  // 압축 뷰 보완 패스 — 태그·제로폭 문자가 숫자 한가운데를 가른 주민번호·휴대폰.
  // work는 원문과 길이가 1:1이므로, 해당 구간이 이미 공백이면 앞에서 소비된 것.
  {
    const { text, map } = compactView(src);
    for (const [label, re, ok] of COMPACT_RULES) {
      for (const m of findMatches(text, re, ok)) {
        const s = map[m.start], e = map[m.end - 1] + 1;
        if (!/\S/.test(work.slice(s, e))) continue;
        entry(label, 'redact')._s.push(m.text.replace(/\s+/g, ' ').trim());
        work = work.slice(0, s) + blanks(e - s) + work.slice(e);
      }
    }
  }

  // ── 마크업 내부 패스 (검출 전용) ──
  // detectView·compactView는 태그 구간을 통째로 지우므로 alt="790101-1234567",
  // title="010-1234-5678", href="tel:…", <!-- 790101-1234567 --> 안의 값은
  // 두 뷰 어디에도 보이지 않는다. 여기서만 본다.
  //
  // **검출만 하고 anonymize는 마크업을 손대지 않는다.** 근거:
  // 현재 유일한 입력원인 fund-erp/tools/hwp2html.py는 본문 텍스트를 오직 요소
  // 내용으로만 내보내고(esc()를 거쳐 <p>…</p>·<td>…</td>), 속성은 colspan·
  // rowspan과 <col style="width:…%">뿐이며 주석은 아예 만들지 않는다.
  // 즉 실측 위험은 0이고 이 패스는 다른 변환기가 붙었을 때를 위한 이중 방어선이다.
  // 그런 상황에서 속성 안쪽을 자동 치환하면 얻는 것 없이 마크업만 깨질 수 있으므로,
  // kind:'redact'로 보고해 Task 10 게이트를 떨어뜨리고 사람이 보게 하는 쪽을 택했다.
  // (그래서 이 패스가 잡은 것은 "검출되면 반드시 지워진다" 불변식의 예외다.)
  sweep(markupView(src), PII_RULES, 'redact');

  work = sweep(work, SCAN_ONLY_RULES, 'review');    // 사람이 보고 정할 것
  for (const e of found) { e.sample = [...new Set(e._s)].slice(0, 3).join(' / '); delete e._s; }
  return found;
}

// ── 변수 추출 ──
// 기입란 라벨 → 표준 변수명. docs-esign의 submission 필드명과 맞춘다.
// '주소'(개인 주소)의 맨 알맹이 조각 `주\s*소`는 '사업장소재지'의 `사업장\s*주소`
// 안에도 그대로 들어 있어, "사업장 주소" 라벨만 있는 서식에서도 개인 주소가
// 수집됐다고 잘못 표시된다(필수 항목 '주소'가 실제로는 비어 있는데 채워진 것처럼 보임).
// 음의 후방탐색으로 '사업장' 접두를 가진 경우를 bare 조각에서 제외해 복합 라벨
// ('사업장소재지')만 매치하게 한다. LABEL_MAP의 다른 항목들도 같은 유형의 겹침이
// 있는지 확인했다 — 나머지는 서로 다른 키의 복합 라벨 안에 다른 키의 alone 조각이
// 끼어 있는 사례가 없어 손대지 않았다.
const LABEL_MAP = [
  ['이름',           /(성\s*명|이\s*름|근로자\s*명|위임인\s*성명)/],
  ['주민등록번호',   /(주민\s*(등록)?\s*번호|생년월일)/],
  ['주소',           /((?<!사업장\s*)주\s*소|자택\s*주소|현\s*주소)/],
  ['근로자연락처',   /(연\s*락\s*처|휴대\s*전화|전화\s*번호)/],
  ['입금계좌',       /(계좌\s*번호|입금\s*계좌|예\s*금\s*주)/],
  ['회사명',         /(회\s*사\s*명|사업체\s*명|상\s*호)/],
  ['사업장소재지',   /(소\s*재\s*지|사업장\s*주소)/],
];
const REQUIRED_KEYS = new Set(['이름', '주민등록번호', '주소', '근로자연락처']);

// ── {{변수}} 자리표시자의 별칭 ──
// anonymize(PII_RULES)는 검출 목적의 이름(연락처·전화번호·계좌번호)으로
// {{...}}를 새로 박아 넣는데, 이건 LABEL_MAP이 빈 기입란에서 쓰는 표준 키
// (근로자연락처·입금계좌 — docs-esign submission 필드명과 맞춘 것)를 거치지
// 않는다. 그 결과 같은 개념이 원문이 빈 칸이었는지 채워진 값이었는지에 따라
// 서로 다른 키로 잡히고, REQUIRED_KEYS 판정도 어긋난다(예: 근로자연락처는
// required지만 별칭인 연락처·전화번호는 아닌 것으로 보임). PII_RULES의
// 라벨 자체는 scanPii 리포트에도 쓰이므로 건드리지 않고, 여기 ①단계에서
// 수집할 때만 표준 키로 되돌린다.
const VAR_ALIASES = { '연락처': '근로자연락처', '전화번호': '근로자연락처', '계좌번호': '입금계좌' };

function varType(key) {
  if (/일$|일자$/.test(key)) return 'date';
  if (/금$|액$|료$|보수율$/.test(key)) return 'money';
  return 'text';
}

// 빈 기입란 탐지 전용 뷰. stripTags는 태그를 지우고 공백 뭉치를 한 칸으로
// 뭉개므로(Task 3/4/5 소비자가 그 동작에 의존해 stripTags 자체는 건드리지 않는다),
// "라벨 뒤 공백 3칸 이상" 같은 판정에는 쓸 수 없다 — 뭉개지고 나면 살아남는
// 공백 뭉치가 없기 때문이다. 태그를 줄바꿈으로 바꿔 각 문단·셀을 한 줄로 만들고
// 공백은 그대로 둔다. stripTags와 같은 엔티티만 해독한다.
function labelProbeView(s) {
  return String(s || '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractVars(html) {
  const src = String(html || '');
  const keys = [];
  const seen = new Set();
  const push = k => { if (k && !seen.has(k)) { seen.add(k); keys.push(k); } };

  // ① 이미 박혀 있는 {{변수}}
  let m;
  const re = /\{\{([^}]+)\}\}/g;
  while ((m = re.exec(src))) {
    const raw = m[1].trim();
    push(VAR_ALIASES[raw] || raw);
  }

  // ② 빈 기입란 — "라벨 : ____" 또는 "라벨 :" 뒤 공백
  // 콜론 둘레와 공백-뭉치 대안은 줄바꿈을 삼키지 않는 [ \t]만 쓴다 — \s를 쓰면
  // 다음 줄의 라벨이나 콜론까지 이어 붙어 버린다. 줄 끝 판정은 m 플래그의 $로.
  const probeText = labelProbeView(src);
  for (const [key, labelRe] of LABEL_MAP) {
    const probe = new RegExp(labelRe.source + '[ \\t]*[:：][ \\t]*(_{2,}|[ \\t]{3,}|$)', 'm');
    if (probe.test(probeText)) push(key);
  }

  return keys.map(k => ({
    key: k,
    label: k,
    type: varType(k),
    required: REQUIRED_KEYS.has(k),
  }));
}

// ── 플래그 ──
// 2021.10.14 임금채권보장법 개정: 체당금→대지급금, 소액체당금→간이대지급금,
// 일반체당금→도산대지급금. 다만 관서 제출 서식은 원문을 따라야 하므로 치환은
// 노무사 판단 사항이고 여기서는 표시만 한다.
const OLD_TERMS = /체당금/;
const CONSENT_MISMATCH = /회비\s*산출|회원\s*서비스|회원에\s*대한\s*추천/;

function flagIssues(html) {
  const flags = [];
  const text = stripTags(html);
  if (OLD_TERMS.test(text)) flags.push('구법용어');
  if (CONSENT_MISMATCH.test(text)) flags.push('동의서용도불일치');
  // ※ 실행 중 변경(2026-08-06): Task 5의 적대적 리뷰 후 scanPii가
  //    {label, kind, sample}을 돌려주고 kind는 'redact'|'review'다.
  //    주소는 'review' — 법인 자기 주소가 거의 모든 위임장에 있어 자동 치환하면 안 되고
  //    사람이 판단해야 하기 때문이다. 따라서 'PII잔존'은 redact 종류만 센다.
  //    (원래 코드는 scanPii(html).length여서 주소 있는 서식마다 오탐이 뜬다.)
  const pii = scanPii(html);
  if (pii.some(f => f.kind === 'redact')) flags.push('PII잔존');
  if (pii.some(f => f.kind === 'review')) flags.push('주소포함');
  return flags;
}

// ── 대표본 선정 ──
// 빈 양식(밑줄·괄호공백 기입란이 많고 PII가 없는 판본)이 정본으로 가장 안전하다.
// 없으면 최신 사건본을 골라 익명화해 승격한다 — 현행 서식이 사건 폴더에만
// 남아 있는 경우가 많기 때문(설계문서 §3.2).
function blankScore(html) {
  // stripTags는 공백 뭉치를 한 칸으로 뭉개고 끝 공백을 trim하므로
  // "(    )"·":     " 같은 공백-기반 기입란 표시가 살아남지 못한다
  // (\(\s{2,}\)·[:：]\s{3,}가 절대 매치되지 않음 — Task 7 리뷰에서 발견).
  // labelProbeView는 태그만 줄바꿈으로 바꾸고 공백은 원문 그대로 두므로
  // 세 가지 기입란 표시(밑줄·괄호공백·콜론공백)를 모두 잡을 수 있다.
  const text = labelProbeView(html);
  const marks = text.match(/_{2,}|\(\s{2,}\)|[:：]\s{3,}/g);
  return marks ? marks.length : 0;
}

function pickRepresentative(members) {
  const list = (members || []).filter(Boolean);
  if (!list.length) return { rep: null, pickedBy: null };

  // ※ 실행 중 변경(2026-08-06): scanPii는 {label, kind, sample}을 돌려주고
  //    주소는 kind:'review'(자동 치환 대상 아님)다. 'redact' 종류만 '더러움'으로 본다.
  //    원래 코드(scanPii(...).length === 0)를 그대로 두면 주소 있는 서식이 전부
  //    탈락해 pickedBy:'blank'가 사실상 안 나온다 — 실측 70건 중 29건이 주소를 갖는다.
  const hasRedactable = h => scanPii(h).some(f => f.kind === 'redact');
  const clean = list.filter(m => !hasRedactable(m.html) && blankScore(m.html) > 0);
  if (clean.length) {
    clean.sort((a, b) => blankScore(b.html) - blankScore(a.html) || (b.mtime || 0) - (a.mtime || 0));
    return { rep: clean[0], pickedBy: 'blank' };
  }
  const byNew = list.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return { rep: byNew[0], pickedBy: 'anonymized-latest' };
}

module.exports = { normalizeForHash, formHash, shingles, similarity, clusterByContent,
                   isTitleLine, stripTags, splitSegments, classify, signFieldLabel,
                   PII_RULES, anonymize, scanPii, extractVars, flagIssues,
                   blankScore, pickRepresentative };
