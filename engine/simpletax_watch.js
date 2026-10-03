/* 근로소득 간이세액표 개정 감시 — 법제처 법령 API 로 별표2 의 「개정일」만 본다
   ─────────────────────────────────────────────────────────────────────
   왜: 간이세액표는 숫자 API 가 없어 앱에 내장했다(js/pu-simpletax.js). 그러면
       **법이 바뀌었는데 내장 표가 옛것인 채로** 세금이 계산될 위험이 생긴다.
       이 감시기가 매일 법제처의 현행 시행령을 읽어, 별표2 첫 줄의
       「<개정 2026. 2. 27.>」 이 내장 표의 개정일보다 새것이면 알린다.

   어디를 읽나: https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&ID=003956&type=XML
     (소득세법 시행령 현행 전문 — 별표단위마다 별표내용 글자가 들어 있다.
      뉴스 브리핑·판례 읽기와 같은 OC=test 창구다.)
     ⚠ 시행령 자체의 공포일자는 쓰지 않는다. 시행령은 다른 조문 때문에도 1년에
       여러 번 바뀌어(예: 2026.9.30) 그걸 보면 헛알림이 쏟아진다. **별표2 본문의
       개정일**만이 표가 바뀌었다는 뜻이다.

   쓰는 법:
     node engine/simpletax_watch.js                 법제처에서 받아 비교
     node engine/simpletax_watch.js --xml <파일>    받아 둔 XML 로 비교(시험용)
   결과: 한 줄 JSON 을 찍고, GitHub Actions 안이면 GITHUB_OUTPUT 에
         state(same|newer|older) · law_rev · built_rev · pdf 를 적는다.
   끝 코드: 0 = 비교 성공(같든 다르든) · 2 = 읽기 실패(창구·모양이 바뀜 — 사람이 봐야 함) */
'use strict';
const fs = require('fs');
const path = require('path');

const LAW_ID = '003956';    // 소득세법 시행령
const LAW_URL = 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&type=XML&ID=' + LAW_ID;
const LAW_ROOT = 'https://www.law.go.kr';

function cdata(s) {
  return String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}
function tag(block, name) {
  const m = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>').exec(block);
  return m ? cdata(m[1]) : null;
}
function ymd(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/* 별표 머리 「<개정 2024. 2. 29., 2026. 2. 27.>」 에서 가장 늦은 날짜.
   한 꺾쇠 안에 여러 날짜가 올 수 있어 전부 읽고 가장 늦은 것을 쓴다. */
function revisionOf(content) {
  const head = /<\s*(?:개정|신설|전문개정)\s*([^>]*)>/.exec(content);
  if (!head) return null;
  const ds = [];
  const re = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g;
  let m;
  while ((m = re.exec(head[1]))) ds.push(ymd(m[1], m[2], m[3]));
  return ds.length ? ds.sort().pop() : null;
}

/* 시행령 XML 에서 별표2(근로소득 간이세액표) 한 칸을 찾는다.
   번호만 믿지 않고 제목도 본다 — 별표 번호가 밀리면 엉뚱한 표를 보게 된다. */
function parseByl2(xml) {
  const re = /<별표단위[^>]*>([\s\S]*?)<\/별표단위>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const b = m[1];
    const 번호 = tag(b, '별표번호'), 가지 = tag(b, '별표가지번호') || '00';
    const 제목 = tag(b, '별표제목') || '';
    if (번호 !== '0002' || 가지 !== '00' || 제목.indexOf('근로소득 간이세액표') < 0) continue;
    const 내용 = cdata(tag(b, '별표내용') || '').replace(/\s+/g, ' ');
    /* 링크는 알림 글에 그대로 실리므로 법제처 내려받기 꼴만 받는다
       (밖에서 온 글자를 그대로 글·명령에 싣지 않는다). */
    const pdf = tag(b, '별표서식PDF파일링크');
    const pdfOk = /^\/LSW\/flDownload\.do\?flSeq=\d+$/.test(pdf || '');
    return {
      제목: 제목,
      개정: revisionOf(내용),
      pdf: pdfOk ? LAW_ROOT + pdf : null
    };
  }
  return null;
}

/* 내장 표 중 가장 늦은 개정일 */
function builtinRevision(tables) {
  const ds = (tables || []).map(function (t) { return t && t.개정; }).filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : null;
}

/* same = 내장 표가 최신 · newer = 법이 더 새것(표를 갈아야 함) · older = 법제처가 더 옛것(이상) */
function judge(built, law) {
  if (!built || !law) return null;
  if (law === built) return 'same';
  return law > built ? 'newer' : 'older';
}

async function fetchXml() {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(function () { ac.abort(); }, 60000);
      const r = await fetch(LAW_URL, { signal: ac.signal, headers: { 'User-Agent': 'pureun-simpletax-watch/1' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const s = await r.text();
      if (s.indexOf('<별표단위') < 0) throw new Error('별표가 없는 응답(' + s.length + '자)');
      return s;
    } catch (e) {
      last = e;
      await new Promise(function (ok) { setTimeout(ok, 5000 * (i + 1)); });
    }
  }
  throw last;
}

function writeOutput(o) {
  const f = process.env.GITHUB_OUTPUT;
  if (!f) return;
  fs.appendFileSync(f, Object.keys(o).map(function (k) {
    return k + '=' + String(o[k] == null ? '' : o[k]).replace(/[\r\n]/g, ' ');
  }).join('\n') + '\n');
}

async function main() {
  const i = process.argv.indexOf('--xml');
  let xml;
  try {
    xml = (i > 0) ? fs.readFileSync(process.argv[i + 1], 'utf8') : await fetchXml();
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: '법제처에서 받지 못함: ' + (e && e.message || e) }));
    process.exit(2);
  }
  const byl = parseByl2(xml);
  const built = builtinRevision(require(path.join(__dirname, '..', 'js', 'pu-simpletax.js')).tables);
  if (!byl || !byl.개정) {
    console.log(JSON.stringify({ ok: false, error: '별표2 또는 그 개정일을 못 찾음 — 법제처 응답 모양이 바뀌었을 수 있다', built: built }));
    process.exit(2);
  }
  const state = judge(built, byl.개정);
  const out = { ok: true, state: state, law_rev: byl.개정, built_rev: built, pdf: byl.pdf };
  console.log(JSON.stringify(out));
  writeOutput(out);
}

if (require.main === module) main();
module.exports = { parseByl2, revisionOf, builtinRevision, judge, LAW_URL };
