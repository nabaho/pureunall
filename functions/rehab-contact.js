/* 회생광고 — 회사 연락처 자동 찾기 (2026-10-10).
   대표 지시 「주소가 있으면 기업 홈페이지 등을 직접 찾아서 연락처·메일·팩스를 정렬해서 볼 수 있게」.

   ■ 길
     ① 네이버 지역(업체) 검색 — 회사명으로 찾아 «주소가 맞는» 업체의 홈페이지·전화를 받는다.
     ② 못 찾으면 네이버 웹문서 검색 — 제목·요약에 회사명과 주소가 함께 나오는 것만 홈페이지로 친다.
     ③ 홈페이지 첫 화면과 「문의·회사소개·오시는 길」 쪽을 읽어 전화·팩스·메일을 뽑는다.
   ■ 지키는 것
     · «회사가 공개한 연락처»만 모은다(홈페이지·업체 등록 정보). 개인 SNS·블로그는 홈페이지로 안 친다.
     · 이름이 같은 남의 회사가 걸리지 않게 «주소까지 맞거나 홈페이지에 회사명이 있을 때만» 홈페이지로 확정한다.
     · 못 찾은 것은 못 찾았다고 남긴다(status:'none') — 비워 두지 않고, 7일 뒤에 다시 본다.
     · 내부망·IP 주소·file: 은 읽지 않는다(safeUrl) — 검색 결과가 서버를 엉뚱한 곳으로 보내지 못하게.
   ⚠ 이 모듈은 «찾기»만 한다. 보내는 일은 없다(정보통신망법 제50조). 연락처를 찾았다고 이메일·문자를 보내지 않는다. */

const M = require("./company-website-match");

const PAGE_TIMEOUT_MS = 8000;
const PAGE_MAX_BYTES = 1500000;
const MAX_CONTACT_PAGES = 2;

/* 홈페이지가 «아닌» 곳 — 구직·기업정보 사이트(참고 링크로만 보여 준다)와 SNS·포털 */
const DIRECTORY_RE = /(saramin|jobkorea|jobplanet|wanted\.co|catch\.co\.kr|thevc|nicebizinfo|nicednb|kreditjob|bizno\.net|teamblind|innoforest|findcompany|companyinfo|cretop|dart\.fss|kind\.krx|opencorporates|incruit|alba|albamon|career\.co\.kr|smes\.go|bizinfo|ok-info|credit|infoseek|jobsarang|work\.go\.kr|worldjob|inthefund|kisline|kiscredit)/i;
const SOCIAL_RE = /(blog\.naver|cafe\.naver|post\.naver|in\.naver|map\.naver|place\.map|m\.place|naver\.me|kakao\.com|daum\.net|tistory|brunch|youtube|youtu\.be|instagram|facebook|twitter|x\.com|linkedin|threads\.net|wikipedia|namu\.wiki|google\.|bing\.com|danawa|11st|gmarket|coupang|smartstore)/i;

function clean(v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); }

/* ─── 주소 안전 ─── 검색 결과가 가리키는 곳이 «공개 웹»일 때만 읽는다 */
function safeUrl(u) {
  let x;
  try { x = new URL(String(u || "").trim()); } catch (e) { return null; }
  if (x.protocol !== "http:" && x.protocol !== "https:") return null;
  if (x.username || x.password) return null;
  const h = x.hostname.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.indexOf(":") >= 0 || /^\[/.test(h)) return null;   // IP 주소는 통째로 막는다
  if (h.indexOf(".") < 0) return null;
  if (x.port && x.port !== "80" && x.port !== "443") return null;
  return x;
}
function hostOf(u) { const x = safeUrl(u); return x ? x.hostname.replace(/^www\./, "") : ""; }
function classifyLink(u) {
  const h = hostOf(u);
  if (!h) return "bad";
  if (SOCIAL_RE.test(h)) return "sns";
  if (DIRECTORY_RE.test(h)) return "dir";
  return "site";
}

/* 게시판·글·검색결과 같은 «쪽»은 회사 홈페이지가 아니다 — 첫 화면(뿌리 주소) 꼴만 홈페이지 후보로 본다.
   예) weseb.com/SJB/m.php?board=facto&no=160347 · cafe/게시판 글 · 순위 게시판 */
function looksLikePost(u) {
  const x = safeUrl(u);
  if (!x) return true;
  if (x.search) return true;
  const segs = x.pathname.split("/").filter(Boolean);
  if (segs.length > 2) return true;
  if (/\.(php|asp|aspx|jsp|do|cgi)$/i.test(x.pathname) && !/^\/(index|main|home)\./i.test(x.pathname)) return true;
  return /(board|bbs|article|view|notice|post|read|rank)/i.test(x.pathname);
}

/* ─── 전화·팩스 ─── */
const SERVICE_PREFIX = ["1544", "1566", "1577", "1588", "1599", "1600", "1644", "1661", "1666", "1688", "1800", "1899"];

/* 숫자만 보고 «사람이 읽는 꼴»로 — 모르는 길이면 빈 글자 */
function normPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (/^(15|16|18)\d{6}$/.test(d)) return SERVICE_PREFIX.indexOf(d.slice(0, 4)) >= 0 ? d.slice(0, 4) + "-" + d.slice(4) : "";
  if (/^02\d{7,8}$/.test(d)) return d.length === 9 ? d.replace(/^(02)(\d{3})(\d{4})$/, "$1-$2-$3") : d.replace(/^(02)(\d{4})(\d{4})$/, "$1-$2-$3");
  if (/^0(3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/.test(d)) return d.length === 10 ? d.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") : d.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  if (/^01[016-9]\d{7,8}$/.test(d)) return d.length === 10 ? d.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") : d.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  if (/^0[5780]0\d{7,8}$/.test(d)) return d.length === 10 ? d.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") : d.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  return "";
}

/* 글 한 덩어리에서 «라벨이 붙은» 전화·팩스를 뽑는다.
   라벨(전화·TEL·T. / 팩스·FAX·F.)은 번호 바로 앞 16글자 안에서 «가장 뒤에 나온 것»이 이긴다.
   라벨이 없으면 전화 후보(loose)로만 둔다 — 문서 번호·날짜가 섞일 수 있어 확정하지 않는다. */
function findPhones(text) {
  const t = String(text || "");
  const out = { phones: [], faxes: [], loose: [] };
  const add = (list, v) => { if (v && list.indexOf(v) < 0) list.push(v); };
  const re = /(?<![\d-])(0\d{1,2}|1[5-8]\d{2})[\s.)-]*(\d{3,4})?[\s.-]*(\d{4})(?!\d)/g;
  let m;
  while ((m = re.exec(t))) {
    const raw = m[0];
    const num = normPhone(raw);
    if (!num) continue;
    const before = t.slice(Math.max(0, m.index - 16), m.index);
    if (/(사업자|등록번호|법인번호|통신판매|우편번호|계좌)/.test(before)) continue;
    const faxAt = Math.max(before.search(/(fax|팩스(?:번호)?|팩 스)[^a-z가-힣]*$/i), before.search(/(?:^|[^a-z])f\s*[:.：)]\s*$/i));
    const telAt = Math.max(before.search(/(tel|전화(?:번호)?|대표(?:번호|전화)?|문의|고객(?:센터)?|연락처?|phone)[^a-z가-힣]*$/i), before.search(/(?:^|[^a-z])t\s*[:.：)]\s*$/i));
    if (faxAt >= 0 && faxAt >= telAt) add(out.faxes, num);
    else if (telAt >= 0) add(out.phones, num);
    else add(out.loose, num);
  }
  return out;
}

/* ─── 이메일 ─── */
const BAD_MAIL_RE = /(^(example|sample|test|user|username|name|email|mail|your|yourname|id|abc|admin@example)@|example\.|sentry|wixpress|yourdomain|domain\.com|email\.com|test\.com|noreply|no-reply|donotreply|@2x|\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$)/i;
function findEmails(text) {
  const t = String(text || "")
    .replace(/\s*[\[(]\s*(?:at|골뱅이|앳)\s*[\])]\s*/gi, "@").replace(/＠/g, "@").replace(/\s*\[\s*dot\s*\]\s*/gi, ".");
  const out = [];
  (t.match(/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) || []).forEach((e) => {
    const x = e.toLowerCase().replace(/[.]+$/, "");
    if (x.length > 80 || BAD_MAIL_RE.test(x) || out.indexOf(x) >= 0) return;
    out.push(x);
  });
  return out;
}
/* 홈페이지와 같은 도메인의 메일을 앞에 둔다 — 회사 메일일 가능성이 높다 */
function rankEmails(emails, host) {
  const h = String(host || "").toLowerCase();
  const base = h.split(".").slice(-2).join(".");
  const same = (e) => { const d = e.split("@")[1] || ""; return !!h && (d === h || d === base || d.endsWith("." + base)); };
  return (emails || []).map((e, i) => ({ e, i })).sort((a, b) => (same(a.e) ? 0 : 1) - (same(b.e) ? 0 : 1) || a.i - b.i).map((x) => x.e);
}

/* ─── 쪽 읽기 ─── */
function decodeEntities(s) {
  return String(s || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
/* HTML → 사람이 읽는 글. tel:·mailto: 링크는 «글로 옮겨» 둔다(번호가 링크에만 있는 쪽이 많다). */
function htmlToText(html) {
  return decodeEntities(String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*href\s*=\s*["']tel:([^"']+)["'][^>]*>/gi, " 전화 $1 ")
    .replace(/<a\b[^>]*href\s*=\s*["']mailto:([^"'?]+)[^"']*["'][^>]*>/gi, " $1 ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d|dd|dt)>/gi, " \n ").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\r\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
}
/* 「문의·회사소개·오시는 길」 쪽으로 가는 같은 사이트 링크 */
function contactLinks(html, baseUrl) {
  const base = safeUrl(baseUrl);
  if (!base) return [];
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const label = htmlToText(m[1] + " " + m[2]);
    if (!/(contact|about|company|intro|location|map|찾아오|오시는|연락|문의|회사\s*소개|기업\s*소개|회사\s*안내|고객센터|인사말|ceo|회사개요)/i.test(label)) continue;
    let u;
    try { u = new URL(m[1].trim(), base); } catch (e) { continue; }
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (/\.(pdf|jpe?g|png|gif|zip|hwp|docx?|xlsx?|pptx?|mp4)(\?|$)/i.test(u.pathname)) continue;
    const href = u.toString();
    if (href !== base.toString() && out.indexOf(href) < 0) out.push(href);
    if (out.length >= 6) break;
  }
  return out;
}
/* 글자 깨짐 방지 — 응답 헤더·meta 에서 문자셋을 읽어 푼다(옛 한국 사이트는 EUC-KR 이 많다) */
function decodeBody(bytes, contentType) {
  const head = Buffer.from(bytes.slice(0, 4096)).toString("latin1");
  const cs = (/charset=([\w-]+)/i.exec(contentType || "") || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1] || "utf-8";
  try { return new TextDecoder(/ks_?c|euc-?kr|cp949|ms949/i.test(cs) ? "euc-kr" : cs).decode(bytes); }
  catch (e) { return new TextDecoder("utf-8").decode(bytes); }
}
/* 실제 서버에서 쓰는 쪽 읽기 — 리다이렉트는 «한 번씩 다시 검사하며» 세 번까지 */
async function fetchPage(url, { fetchFn = fetch, timeoutMs = PAGE_TIMEOUT_MS } = {}) {
  let cur = safeUrl(url);
  for (let hop = 0; cur && hop < 4; hop++) {
    const r = await fetchFn(cur.toString(), { redirect: "manual", signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; pureun-labor contact-reader)", Accept: "text/html,*/*;q=0.5", "Accept-Language": "ko-KR,ko;q=0.9" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { cur = safeUrl(new URL(r.headers.get("location"), cur).toString()); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const ct = r.headers.get("content-type") || "";
    if (ct && !/text\/html|application\/xhtml|text\/plain/i.test(ct)) throw new Error("HTML 이 아님");
    const bytes = new Uint8Array(await r.arrayBuffer()).slice(0, PAGE_MAX_BYTES);
    return { url: cur.toString(), html: decodeBody(bytes, ct) };
  }
  throw new Error("주소를 읽을 수 없음");
}

/* ─── 대표자 ─── 홈페이지 글에서 「대표이사 홍길동」「대표자 : 홍길동」꼴만 읽는다.
   ⚠ 법원 공고에는 대표자가 없다(금지명령·개시결정 공고 본문이 비어 있다 — 2026-10-10 확인). 홈페이지 표기가 «있을 때만» 적는다.
   ⚠ 「대표이사 인사말」「대표 전화」 같은 말이 이름으로 읽히지 않게 — 성씨로 시작하는 2~4글자만 받고, 흔한 낱말은 뺀다. */
const SURNAMES = "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부가갈감견계골공곡궁";
const CEO_STOP = /^(인사말|소개|메시지|이사|전화|번호|연락처|주소|이름|성명|대표|사장|회장|님|명의|직인|취급|관리|사업|등록|소재|본점|업무|보유|제품|서비스|이메일|팩스|사무|모집|채용|문의|안내|환영|말씀|이력|약력)/;
function findCeo(text) {
  const t = String(text || "");
  const re = /(?:대표\s*이사|대표\s*자명?|대표\s*원장|대표\s*[:：]|CEO|C\.E\.O|대\s*표)\s*[:：]?\s*([가-힣]{2,4})(?![가-힣])/g;
  let m;
  while ((m = re.exec(t))) {
    const n = m[1];
    if (SURNAMES.indexOf(n[0]) < 0 || CEO_STOP.test(n)) continue;
    return n;
  }
  return "";
}
/* ─── 이름 맞추기 ─── */
function coreName(name) {
  return clean(String(name || "").replace(/\((주|유|사|재|합)\)|㈜|주식회사|유한회사|유한책임회사|합자회사|합명회사/g, " "));
}

/* ─── 주소 열쇠 ─── 「서울특별시 서초구」와 「서울 서초구」를 같은 곳으로 읽게, 도·광역시 이름은 빼고
   «시·군·구» 이름 하나만 쓴다(수원시 영통구 → 수원시, 서울 서초구 → 서초구, 경기 광주시 → 광주시). */
function addrKey(address) {
  const toks = String(address || "").match(/[가-힣]{1,6}(?:특별자치시|특별시|광역시|특별자치도|도|시|군|구)(?=[\s,]|$)/g) || [];
  const hit = toks.find((x) => !/(특별자치시|특별시|광역시|특별자치도|도)$/.test(x));
  return hit || "";
}
function addrHas(text, address) {
  const k = addrKey(address);
  return !!k && String(text || "").replace(/\s+/g, "").indexOf(k) >= 0;
}

/* ─── 검색 공급자 ─── lookup 은 «어느 검색이든» 같은 모양만 받는다.
     local(q)  → [{ title, address, roadAddress, phone, link }]   업체(지도) 검색
     web(q)    → [{ title, link, snippet }]                       웹문서 검색
   ★ 카카오: 서버에 이미 있는 KAKAO_REST_KEY(카카오 로그인용) 하나로 다음 웹검색·카카오맵 업체검색을 부른다.
     새로 신청할 것이 없다. 카카오맵이 이 앱에 «켜져 있지 않으면» 403 이 오고, 그러면 웹검색만으로 이어 간다.
   ★ 네이버: 열쇠(NAVER_SEARCH_*)를 신청하는 날을 위해 같은 모양으로 둔다(지금은 서버에 열쇠가 없다).
   ⚠ 열쇠는 요청 머리글에만 넣고 오류 글에 안 싣는다. */
function kakaoProviders({ key, fetchFn = fetch, timeoutMs = 10000 }) {
  async function get(path, q, size) {
    const r = await fetchFn("https://dapi.kakao.com" + path + "?" + new URLSearchParams({ query: q, size: String(size) }).toString(),
      { headers: { Authorization: "KakaoAK " + key }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) { const e = new Error("카카오 검색 " + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  return {
    name: "kakao",
    local: async (q) => (((await get("/v2/local/search/keyword.json", q, 8)).documents) || []).map((d) => ({
      title: M.stripTags(d.place_name), link: d.place_url || "", address: d.address_name || "", roadAddress: d.road_address_name || "",
      phone: normPhone(d.phone), snippet: d.category_name || "" })),
    web: async (q) => (((await get("/v2/search/web", q, 10)).documents) || []).map((d) => ({
      title: M.stripTags(d.title), link: d.url || "", snippet: M.stripTags(d.contents) })),
  };
}
function naverProviders({ id, secret, fetchFn = fetch, timeoutMs = 10000 }) {
  async function get(kind, q) {
    const r = await fetchFn("https://naverapihub.apigw.ntruss.com/search/v1/" + kind + "?" + new URLSearchParams({ query: q, display: "5" }).toString(),
      { headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) { const e = new Error("네이버 검색 " + r.status); e.status = r.status; throw e; }
    return (await r.json()).items || [];
  }
  return {
    name: "naver",
    local: async (q) => (await get("local", q)).map((it) => ({ title: M.stripTags(it.title), link: it.link || "", address: M.stripTags(it.address),
      roadAddress: M.stripTags(it.roadAddress), phone: normPhone(it.telephone), snippet: "" })),
    web: async (q) => (await get("webkr", q)).map((it) => ({ title: M.stripTags(it.title), link: it.link || "", snippet: M.stripTags(it.description) })),
  };
}

/* ─── 찾기 ───
   providers = { local, web }(둘 다 없어도 된다) · hint = { homepage } — 사람이 알려 준 홈페이지(검색을 건너뛰고 읽기만)
   getPage(url) → { url, html }
   반환: { status, confidence, homepage, phone, fax, email, phones, faxes, emails, refs, sources, note, checkedAt }
   확신: high = 업체·웹검색에서 «이름과 주소가 함께» 맞음 · medium = 홈페이지 안에 회사명이 있음 · low 는 버린다 */
async function lookup({ name, address, providers = {}, hint = {}, getPage, nowMs = Date.now(), wait = () => Promise.resolve() }) {
  const out = { status: "none", confidence: "", homepage: "", phone: "", fax: "", email: "", phones: [], faxes: [], emails: [],
    refs: [], sources: [], note: "", ceo: "", checkedAt: nowMs };
  const core = coreName(name);
  if (M.normName(name).length < 2) { out.note = "회사명이 짧아 찾지 않음"; return out; }
  const key = addrKey(address);
  const phones = [], faxes = [], mails = [], refs = [], note = [];
  const addUniq = (list, v) => { if (v && list.indexOf(v) < 0) list.push(v); };
  const addRef = (type, title, url) => { if (url && !refs.some((r) => r.url === url) && refs.length < 5) refs.push({ type, title: clean(title).slice(0, 60), url }); };
  const nameOk = (text) => M.nameIn(text, name);
  let home = "", conf = "", fromWeb = false;
  const webPhones = [], webFaxes = [];   // 웹검색 조각글에서 얻은 번호 — 홈페이지가 확인되지 않으면 함께 버린다

  if (hint.homepage && classifyLink(hint.homepage) === "site") { home = hint.homepage; conf = "low"; out.sources.push("알려 준 홈페이지"); }

  /* ① 업체(지도) 검색 — 이름과 «시·군·구»가 맞는 업체의 전화(와 홈페이지) */
  if (!home && providers.local) {
    for (const q of [core, key ? core + " " + key : ""].filter(Boolean)) {
      let list = [];
      try { list = await providers.local(q); } catch (e) { note.push("업체검색 실패" + (e && e.status ? "(" + e.status + ")" : "")); break; }
      await wait();
      const hit = (list || []).find((c) => nameOk(c.title) && (!key || addrHas((c.roadAddress || "") + " " + (c.address || ""), address)));
      if (hit) {
        if (hit.phone) { addUniq(phones, hit.phone); out.sources.push("업체검색 전화"); }
        const k = classifyLink(hit.link);
        if (k === "site") { home = hit.link; conf = "high"; out.sources.push("업체검색 홈페이지"); }
        else if (k === "sns") addRef("map", hit.title, hit.link);
        break;
      }
    }
  }

  /* ② 웹문서 검색 — 홈페이지를 못 찾았을 때만 */
  if (!home && providers.web) {
    let list = [];
    try { list = await providers.web("\"" + core + "\" " + (key ? key + " " : "") + "홈페이지"); } catch (e) { note.push("웹검색 실패" + (e && e.status ? "(" + e.status + ")" : "")); }
    await wait();
    (list || []).forEach((c) => { const k = classifyLink(c.link); if ((k === "dir" || k === "sns") && nameOk(c.title)) addRef(k, c.title, c.link); });
    const hit = (list || []).find((c) => classifyLink(c.link) === "site" && !looksLikePost(c.link) && nameOk(c.title + " " + c.snippet) && (!key || addrHas(c.title + " " + c.snippet, address)));
    if (hit) {
      home = hit.link; conf = "high"; fromWeb = true; out.sources.push("웹검색");
      const sp = findPhones(hit.snippet);
      sp.phones.concat(sp.loose).slice(0, 1).forEach((p) => { webPhones.push(p); addUniq(phones, p); });
      sp.faxes.forEach((p) => { webFaxes.push(p); addUniq(faxes, p); });
    } else {
      /* 주소는 안 맞아도 «사이트 제목에 회사명이 있는» 첫 후보는 홈페이지 «후보»로 읽어 본다 — 읽고 나서 쪽 안에 회사명이 있어야 확정한다 */
      const soft = (list || []).find((c) => classifyLink(c.link) === "site" && !looksLikePost(c.link) && nameOk(c.title));
      if (soft) { home = soft.link; conf = "low"; }
    }
  }

  /* ③ 홈페이지를 읽는다 */
  if (home && getPage) {
    try {
      const first = await getPage(home);
      const pages = [first], seen = [first.url];
      for (const link of contactLinks(first.html, first.url).slice(0, MAX_CONTACT_PAGES)) {
        if (seen.indexOf(link) >= 0) continue;
        try { await wait(); const p = await getPage(link); pages.push(p); seen.push(p.url); } catch (e) { /* 한 쪽이 안 열려도 계속 */ }
      }
      const text = pages.map((p) => htmlToText(p.html)).join("\n");
      if ((conf === "low" || fromWeb) && !nameOk(text)) {
        home = ""; note.push("홈페이지 후보에 회사명이 없어 버림");
        webPhones.forEach((p) => { const i = phones.indexOf(p); if (i >= 0) phones.splice(i, 1); });
        webFaxes.forEach((p) => { const i = faxes.indexOf(p); if (i >= 0) faxes.splice(i, 1); });
      }
      else {
        /* 후보(웹검색 소프트·알려 준 홈페이지)는 «회사명 + 소재지»가 쪽에 함께 있어야 medium 이다.
           회사명만 있고 시·군·구가 없으면 이사했거나 동명 회사일 수 있다 — 남기되 low 로 표시해 사람이 확인하게 한다. */
        if (conf === "low") {
          if (!key || addrHas(text, address)) conf = "medium";
          else note.push("홈페이지의 주소가 공고 주소(" + key + ")와 달라 같은 회사인지 확인 필요");
        }
        const ph = findPhones(text);
        ph.phones.forEach((p) => addUniq(phones, p));
        ph.faxes.forEach((p) => addUniq(faxes, p));
        if (!ph.phones.length && !phones.length) ph.loose.slice(0, 2).forEach((p) => addUniq(phones, p));
        rankEmails(findEmails(pages.map((p) => p.html).join("\n") + "\n" + text), hostOf(home)).slice(0, 4).forEach((e) => addUniq(mails, e));
        out.ceo = findCeo(text);
        out.sources.push("홈페이지 읽음 " + pages.length + "쪽");
      }
    } catch (e) {
      note.push("홈페이지 열기 실패(" + clean(e && e.message).slice(0, 40) + ")");
      if (fromWeb) conf = "low";   // 열어 보지 못했으면 «확인된» 홈페이지가 아니다
    }
  }

  out.homepage = home && safeUrl(home) ? safeUrl(home).toString() : "";
  out.confidence = out.homepage ? conf : (phones.length ? "medium" : "");
  out.phones = phones.slice(0, 4); out.faxes = faxes.slice(0, 3); out.emails = mails.slice(0, 4);
  out.phone = out.phones[0] || ""; out.fax = out.faxes[0] || ""; out.email = out.emails[0] || "";
  out.refs = refs;
  out.status = (out.phone || out.fax || out.email) ? "found" : (out.homepage || refs.length ? "partial" : "none");
  out.note = note.join(" · ");
  return out;
}

module.exports = { safeUrl, hostOf, classifyLink, looksLikePost, normPhone, findPhones, findEmails, rankEmails, htmlToText, contactLinks,
  decodeBody, fetchPage, coreName, findCeo, addrKey, addrHas, kakaoProviders, naverProviders, lookup, PAGE_TIMEOUT_MS };