/* 회생광고 — 금융위원회 «기업기본정보»로 대표자·전화·팩스·홈페이지를 채운다 (2026-10-12).
   대표 「개선작업 해라」 — 법원 공고에는 대표자가 없고(실측: 채무자·재판부·공고 정보뿐) 연락처 찾기도 67곳 중 28곳이라
   공공데이터 승인 목록에 있던 «금융위원회_기업기본정보»(GetCorpBasicInfoService_V2)를 붙인다.

   ■ 길   회사명으로 부른다 → 결과 중 «이름이 같고 시·군·구까지 같은» 곳 하나만 같은 회사로 본다.
   ■ 지키는 것
     · «이름만 같은» 곳은 쓰지 않는다 — 실측에서 이름이 같은 25곳 중 17곳은 다른 지역의 다른 회사였다
       (예: 고양시 회사에 창원시 동명 회사의 대표자가 붙는 사고). 시·군·구가 맞는 곳만 «확인됨».
     · 같은 이름·같은 지역이 둘 이상이고 사업자번호가 서로 다르면 «모호» — 채우지 않는다.
     · 못 찾으면 못 찾았다고 남긴다(status:'none') — 14일 뒤 다시 본다. 호출 자체가 실패하면 «남기지 않는다»(내일 다시).
     · 이름으로 맞춘 결과라 사업자번호는 «참고»일 뿐 관계 열쇠가 아니다(온톨로지 규칙).
   ⚠ 이 모듈은 «찾기»만 한다. 보내는 일은 없다(정보통신망법 제50조). */

const Match = require("./rehab-match");

const URL_BASE = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2";
const SRC = "금융위 기업기본정보";
const NONE_RETRY_DAYS = 14;
const ERROR_RETRY_MS = 864e5;

function clean(v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); }
function digits(v) { return clean(v).replace(/\D/g, ""); }

function itemsOf(json) {
  const it = json && json.response && json.response.body && json.response.body.items && json.response.body.items.item;
  return [].concat(it || []);
}

/* 전화·팩스 — 숫자가 7자리 이상일 때만(빈 값·「-」·「없음」 같은 것은 버린다) */
function phoneOf(v) {
  const s = clean(v);
  return digits(s).length >= 7 ? s : "";
}
/* 홈페이지 — 점이 있고 공백이 없을 때만. 「http://」 가 없으면 붙인다 */
function homeOf(v) {
  const s = clean(v);
  if (!s || /\s/.test(s) || s.indexOf(".") < 0) return "";
  return /^https?:\/\//i.test(s) ? s : "http://" + s;
}

/* 결과 줄 하나 → 저장할 칸 */
function fieldsOf(x) {
  return {
    name: clean(x.corpNm), ceo: clean(x.enpRprFnm), phone: phoneOf(x.enpTlno), fax: phoneOf(x.enpFxno),
    homepage: homeOf(x.enpHmpgUrl), bizNo: digits(x.bzno).length === 10 ? digits(x.bzno) : "",
    address: clean(x.enpBsadr + " " + (x.enpDtadr || "")),
  };
}

/* 공고 한 건 + 부른 결과들 → {status:'found'|'none', why, f?}
   found 는 «이름 같음 + 시·군·구 같음 + 같은 회사 하나» 일 때만. */
function pick(notice, items) {
  const list = items || [];
  const sameName = list.filter((x) => Match.norm(x.corpNm) === Match.norm(notice && notice.debtorName));
  if (!sameName.length) return { status: "none", why: list.length ? "이름이 같은 곳 없음" : "자료 없음" };
  const sameRegion = sameName.filter((x) => Match.sameRegion(notice.address, x.enpBsadr));
  if (!sameRegion.length) return { status: "none", why: "이름은 같으나 지역이 다름(" + sameName.length + "곳)" };
  const keys = [...new Set(sameRegion.map((x) => digits(x.bzno) || clean(x.crno) || clean(x.corpNm)))];
  if (keys.length > 1) return { status: "none", why: "같은 이름·같은 지역이 둘 이상 — 사람이 확인" };
  return { status: "found", why: "", f: fieldsOf(sameRegion[0]) };
}

/* 오늘 부를 공고 — 아직 안 본 곳, 못 찾은 지 14일 지난 곳. 최신 공고부터 cap 곳까지 */
function plan(notices, fsc, nowMs, cap) {
  const all = Object.keys(notices || {}).map((k) => notices[k]).filter((n) => n && n.id && !n._deleted && clean(n.debtorName));
  return all.filter((n) => {
    const r = (fsc || {})[n.id];
    if (!r) return true;
    return r.status === "none" && nowMs - (r.at || 0) > NONE_RETRY_DAYS * 864e5;
  }).sort((a, b) => String(b.noticeDate).localeCompare(String(a.noticeDate))).slice(0, cap || 60);
}

/* 한 곳 부르기 — 호출이 실패하면 throw(저장하지 않아야 내일 다시 본다) */
async function lookup({ notice, key, fetchFn }) {
  const u = URL_BASE + "?serviceKey=" + encodeURIComponent(key) + "&pageNo=1&numOfRows=20&resultType=json&corpNm=" + encodeURIComponent(clean(notice.debtorName));
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("금융위 답 " + res.status);
  const j = await res.json();
  const h = j && j.response && j.response.header;
  if (h && h.resultCode && h.resultCode !== "00") throw new Error("금융위 오류 " + h.resultCode);
  return pick(notice, itemsOf(j));
}

/* 저장할 줄 — rehab_ad/fsc/{공고번호} (서버만 쓴다) */
function record(notice, res, nowMs, extra) {
  const base = Object.assign({ id: notice.id, entityType: "Document", docKind: "rehabFsc", sourceKind: "rehabNotice", sourceId: notice.id,
    status: res.status, src: SRC, at: nowMs, createdAt: nowMs, updatedAt: nowMs, revision: 1 }, extra || {});
  if (res.status === "found") return Object.assign(base, res.f);
  return Object.assign(base, { why: res.why || "" });
}

module.exports = { URL_BASE, SRC, itemsOf, phoneOf, homeOf, pick, plan, lookup, record };
