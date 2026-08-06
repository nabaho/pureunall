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

function isTitleLine(text) {
  const t = String(text || '').trim();
  const bare = t.replace(/\s/g, '');
  if (bare.length < 3 || bare.length > 24) return false;
  if (/[.。]$/.test(t)) return false;                 // 문장은 제목이 아니다
  if (/^제\s*\d+\s*조/.test(bare)) return false;      // 조문 머리
  const spaced = (t.length - bare.length) / bare.length >= 0.5;
  return spaced || TITLE_TAIL.test(bare);
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function splitSegments(html) {
  const src = String(html || '');
  // 문자열의 모든 <p> 앞에서 자르므로 중첩된 <p>도 경계가 된다.
  // hwp2html.py가 <td> 안에 <p>를 만들지 않아(셀 여러 줄은 <br>로 연결, 1×1 레이아웃 표는 최상위 <p>로 펼침) 실무상 안전하다.
  // 다른 변환기를 붙이면 이 가정을 다시 확인해야 한다.
  const parts = src.split(/(?=<p>)/);
  const segs = [];
  let cur = null;
  for (const part of parts) {
    const m = /^<p>([\s\S]*?)<\/p>/.exec(part);
    const text = m ? stripTags(m[1]) : '';
    if (m && isTitleLine(text)) {
      cur = { title: text.replace(/\s/g, ''), html: part, index: segs.length };
      segs.push(cur);
    } else if (cur) {
      cur.html += part;
    } else {
      // 첫 제목 이전의 머리말 — 버리지 않고 보관했다가 첫 조각에 붙인다
      segs._preamble = (segs._preamble || '') + part;
    }
  }
  if (!segs.length) return [{ title: '', html: src, index: 0 }];
  if (segs._preamble) { segs[0].html = segs._preamble + segs[0].html; delete segs._preamble; }
  return segs;
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
//   (d) {{변수}} → 공백. 이미 치환된 자리는 다시 건드리지 않는다(vault).
//       단 "변수 이름처럼 생긴 것"만 보호한다. 예전처럼 {{...}} 아무거나 보호하면
//       {{ 790101-1234567 }} 같은 껍데기가 진짜 주민번호를 통째로 삼켜버린다.
//
// 이 방식 덕분에 예전의 널문자 센티널 vault(치환했다가 되돌리는 방식)가 통째로
// 없어졌다. 되돌리는 단계 자체가 없으므로 입력에 널 문자가 섞여 있어도
// 복원 정규식이 undefined를 뱉는 일이 구조적으로 불가능하다.
const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&nbsp;|&#(?:[xX][0-9a-fA-F]+|\d+);/g;
const VAULT_RE = /\{\{[A-Za-z_가-힣][^{}]{0,63}\}\}/g;

function blanks(n) { return ' '.repeat(n); }

function detectView(src) {
  let v = String(src == null ? '' : src).replace(TAG_RE, m => blanks(m.length));
  v = v.replace(ENTITY_RE, m => {
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
    return ch + blanks(m.length - ch.length);
  });
  return v.replace(VAULT_RE, m => blanks(m.length));
}

// 태그를 아예 지운 '압축 뷰'와 원문 좌표 대응표(map[i] = 원문에서의 위치).
// 공백 뷰는 표 셀이 달라붙는 것을 막아 주지만, 그 대가로 숫자 한가운데를 태그가
// 가르는 경우(790101-1234<b>567</b>)를 놓친다. 압축 뷰는 정확히 그 반대다.
// 그래서 둘 다 본다 — 단 압축 뷰에서는 주민번호 규칙만, 그것도 looksLikeRrn을
// 통과한 것만 인정한다. 셀이 융합돼 생기는 헛매치가 유효한 생년월일·성별자리까지
// 갖출 확률은 낮고, 설령 걸려도 결과는 마스킹이라 안전한 방향이다.
// 계좌·전화 규칙은 압축 뷰에서 돌리지 않는다 — 셀을 가로질러 과잉 삼킬 위험이 크다.
function compactView(src) {
  const s = String(src == null ? '' : src);
  const v = detectView(s);
  const rx = new RegExp(TAG_RE.source, 'g');
  const drop = [];
  let t;
  while ((t = rx.exec(s)) !== null) drop.push([t.index, t.index + t[0].length]);
  let text = '';
  const map = [];
  let di = 0;
  for (let i = 0; i < v.length; i++) {
    while (di < drop.length && i >= drop[di][1]) di++;
    if (di < drop.length && i >= drop[di][0]) continue;   // 태그 안쪽
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
const DASH = '[-\\u2010-\\u2015\\uFF0D]';

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

// 순서가 중요하다. 주민번호(######-#######)는 법인등록번호와 형태가 같고,
// 사업자등록번호(###-##-#####)는 계좌번호 패턴에도 걸린다. 좁은 것부터 먼저 태운다.
// 3번째 원소는 선택적 검증 함수 — 정규식만으로 못 가리는 오탐을 막는다.
const PII_RULES = [
  // 구분자가 있는 주민번호. 대시류 전부 + 공백만으로 갈라진 경우까지 잡는다.
  // 공백 형태는 HWP 표에서 셀이 나뉜 <td>790101</td><td>1234567</td>가
  // detectView에서 공백으로 이어지며 만들어지는, 실무상 가장 흔한 모양이다.
  // 검증 함수를 일부러 달지 않았다 — 991301-1234567처럼 날짜가 깨진 값도
  // 개인정보일 가능성이 높으니 가리는 쪽이 안전하다. 대신 6자리·7자리 숫자가
  // 나란히 놓인 무관한 표를 삼킬 수 있는데, 이 서식들에서 금액은 콤마를 달고
  // 나오므로 실측 위험이 낮다고 보고 미탐보다 오탐을 택한다.
  ['주민등록번호',   new RegExp('\\b\\d{6}(?:\\s*' + DASH + '\\s*|\\s+)[1-8]\\d{6}\\b', 'g'), null],
  // 구분자 없는 13자리. 반드시 검증 함수와 함께 쓴다.
  ['주민등록번호',   /\b\d{13}\b/g, looksLikeRrn],
  ['연락처',         /\b01[016789][-)]?\s?\d{3,4}-?\d{4}\b/g, null],
  ['전화번호',       /\b0\d{1,2}[-)]\s?\d{3,4}-\d{4}\b/g, null],
  ['사업자등록번호', /\b\d{3}-\d{2}-\d{5}\b/g, null],
  // 계좌번호는 은행마다 자릿수가 달라 넓게 잡되,
  //  - 숫자 10자리 이상만 인정하고(날짜 2023-01-15 배제),
  //  - 앞이 연-월- 꼴이면 아예 시작하지 않으며(2023-01-15-001 배제),
  //  - 마지막 마디를 4자리까지 허용한다(카드번호 1234-5678-9012-3456의
  //    끝 네 자리가 잘려 남던 문제).
  ['계좌번호',       /\b(?!(?:19|20)\d{2}-(?:0\d|1[0-2])-)\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,4})?\b/g,
                     s => s.replace(/\D/g, '').length >= 10],
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

// 압축 뷰 보완 패스에서 쓸 주민번호 규칙 — 검증 함수를 강제로 붙인다.
const RRN_STRICT = PII_RULES
  .filter(r => r[0] === '주민등록번호')
  .map(r => [r[0], r[1], looksLikeRrn]);

// 규칙표는 얼려서 내보낸다. 다만 안에 든 RegExp 객체 자체는 얼리지 않는다 —
// g 플래그 정규식을 Object.freeze하면 lastIndex가 read-only가 되어
// .test()도 String.replace()도 TypeError를 던진다. lastIndex 오염 문제는
// findMatches가 정규식을 복제해 쓰는 것으로 이미 막혀 있다.
function deepFreezeRules(rules) { rules.forEach(Object.freeze); return Object.freeze(rules); }
deepFreezeRules(PII_RULES);
deepFreezeRules(SCAN_ONLY_RULES);
deepFreezeRules(RRN_STRICT);

// 원문 좌표의 매치 구간들을 자리표시자로 바꾼다.
function applyMatches(src, ms, make) {
  if (!ms.length) return src;
  let out = '', pos = 0;
  for (const m of ms) {
    if (m.start < pos) continue;   // 앞 매치와 겹치면 건너뛴다
    // 매치 구간에 걸린 태그는 살려서 자리표시자 뒤에 붙인다.
    // 표 셀 경계(</td><td>)나 인라인 태그를 통째로 삼키면 서식 뼈대가 무너진다.
    const tags = (src.slice(m.start, m.end).match(TAG_RE) || []).join('');
    out += src.slice(pos, m.start) + make() + tags;
    pos = m.end;
  }
  return out + src.slice(pos);
}

// 한 규칙을 원문에 적용한다. 매치는 감지용 뷰에서 찾고, 치환은 원문 좌표에 한다.
function applyRule(src, re, ok, make) {
  return applyMatches(src, findMatches(detectView(src), re, ok), make);
}

// 압축 뷰에서 찾아 원문 좌표로 되돌려 적용한다.
function applyRuleCompact(src, re, ok, make) {
  const { text, map } = compactView(src);
  const ms = findMatches(text, re, ok)
    .map(m => ({ start: map[m.start], end: map[m.end - 1] + 1 }));
  return applyMatches(src, ms, make);
}

function anonymize(html, names) {
  let out = String(html || '');
  const hits = {};
  const bump = label => () => {
    hits[label] = (hits[label] || 0) + 1;
    return '{{' + label + '}}';
  };
  for (const [label, re, ok] of PII_RULES) out = applyRule(out, re, ok, bump(label));
  // 태그가 숫자 한가운데를 가른 주민번호 보완 패스.
  // 앞 단계에서 이미 치환된 자리는 {{주민등록번호}}가 되어 vault에 걸리므로
  // 두 번 세거나 두 번 치환되지 않는다.
  for (const [label, re, ok] of RRN_STRICT) out = applyRuleCompact(out, re, ok, bump(label));
  // 인명 치환은 규칙 통과 뒤에 돈다. applyRule이 매번 detectView를 다시 뜨므로
  // 방금 넣은 {{연락처}} 같은 자리표시자도 vault에 들어가 다시 매치되지 않는다
  // (예전에는 인명 '연락처'가 {{연락처}}를 또 먹어 {{{{이름}}}}가 됐다).
  for (const n of (names || [])) {
    if (!n || n.length < 2) continue;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 앞뒤가 한글이면 다른 낱말의 일부다 — '정산'이 '정산금/정산서'를 먹지 않도록.
    const re = new RegExp('(?<![\\uAC00-\\uD7A3])' + esc + '(?![\\uAC00-\\uD7A3])', 'g');
    out = applyRule(out, re, null, bump('이름'));
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
  const byLabel = new Map();
  const entry = (label, kind) => {
    let e = byLabel.get(label);
    if (!e) { e = { label, sample: '', kind, _s: [] }; byLabel.set(label, e); found.push(e); }
    return e;
  };
  const run = (rules, kind) => {
    for (const [label, re, ok] of rules) {
      const ms = findMatches(work, re, ok);
      if (!ms.length) continue;
      const e = entry(label, kind);
      // 찾은 자리는 같은 길이의 공백으로 지운다. 길이를 유지해야 뒤 규칙의
      // \b 앵커와 좌표가 어긋나지 않는다.
      let next = '', pos = 0;
      for (const m of ms) {
        next += work.slice(pos, m.start) + blanks(m.end - m.start);
        pos = m.end;
        e._s.push(m.text.replace(/\s+/g, ' ').trim());
      }
      work = next + work.slice(pos);
    }
  };

  run(PII_RULES, 'redact');          // 지워야 하는 것

  // 압축 뷰 보완 패스 — 태그가 숫자 한가운데를 가른 주민번호.
  // work는 원문과 길이가 1:1이므로, 해당 구간이 이미 공백이면 앞에서 소비된 것.
  {
    const { text, map } = compactView(src);
    for (const [label, re, ok] of RRN_STRICT) {
      for (const m of findMatches(text, re, ok)) {
        const s = map[m.start], e = map[m.end - 1] + 1;
        if (!/\S/.test(work.slice(s, e))) continue;
        entry(label, 'redact')._s.push(m.text.replace(/\s+/g, ' ').trim());
        work = work.slice(0, s) + blanks(e - s) + work.slice(e);
      }
    }
  }

  run(SCAN_ONLY_RULES, 'review');    // 사람이 보고 정할 것
  for (const e of found) { e.sample = [...new Set(e._s)].slice(0, 3).join(' / '); delete e._s; }
  return found;
}

module.exports = { normalizeForHash, formHash, shingles, similarity, clusterByContent,
                   isTitleLine, stripTags, splitSegments, classify,
                   PII_RULES, anonymize, scanPii };
