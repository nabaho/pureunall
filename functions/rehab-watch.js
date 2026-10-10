/* 회생광고 — 법원 회생·파산 공고에서 «법인회생 포괄적 금지명령» 기업을 매일 모은다 (2026-10-10).
   대표 지시 「법인회생이 발생하면 재기지원컨설팅으로 연결 … 포괄금지명령 나온 기업만 모아서 홍보물」
   → 방식 결정 「추천대로」 = 사람이 고르고(승인) «우편»으로 보낸다. 이 모듈은 «모으기»만 한다.

   ★ 출처: 대법원 회생·파산 공고(ssgo.scourt.go.kr) — 서울회생법원 누리집 공고 화면이 이것을 끼워 쓴다.
     한 곳에서 전국 15개 회생 관할 법원을 본다. robots.txt 에 이 경로는 막혀 있지 않다.
   ⚠ «읽기만» 한다. 법원 하나에 목록 몇 쪽 + 해당 건 상세 하나씩. 요청 사이를 띄운다.
   ⚠ 남기는 것은 공고에 실린 «회사명·주소·사건 정보»뿐이다(법인 = 공개 공고).
     대표자·주민번호·대리인 이름은 받지 않는다 — 상세 응답에 있어도 버린다.
   ⚠ 포괄적 금지명령 = 채무자회생법 제45조. 회생 신청 직후(개시 결정 전) 단계다.
   ⚠ 이메일로 보내는 기능은 여기 없다 — 정보통신망법 제50조(광고성 정보 사전 동의).

   ★ 2026-10-10 사건 «진행 단계»를 더했다 — 같은 사건의 다른 공고(개시결정·인가·폐지…)를 같은 목록에서
     함께 읽어 events 로 남기고, 가장 앞선 단계를 stage 로 낸다. 아직 금지명령 단계인 곳이 영업 1순위다. */

const BASE = "https://ssgo.scourt.go.kr";
const LIST = BASE + "/ssgo/ssgo930/selectRhblBnkpPbancLst.on";
const VIEW = BASE + "/ssgo/ssgo930/selectBfCsPbancPviewInf.on";
const HOME = BASE + "/ssgo/ssgo930/rhblBnkp.on";
const UA = "Mozilla/5.0 (compatible; pureun-labor rehab-notice reader)";

/* 회생·파산 관할 법원 — 공고 화면(SSGO931M01)의 지역 목록 그대로 */
const COURTS = {
  "000221": "서울회생법원", "000214": "의정부지방법원", "000240": "인천지방법원",
  "000260": "춘천지방법원", "000261": "춘천지방법원 강릉지원", "000249": "수원회생법원",
  "000291": "대전회생법원", "000270": "청주지방법원", "000520": "전주지방법원",
  "000420": "창원지방법원", "000321": "대구회생법원", "000543": "광주회생법원",
  "000443": "부산회생법원", "000411": "울산지방법원", "000530": "제주지방법원",
};
const TASK_CORP_REHAB = "4";        // 업무구분 — 1 개인회생 · 2 개인파산 · 3 일반회생 · 4 법인회생 · 5 법인파산
const TARGET = "포괄적 금지명령";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;               // 법원 하나에 최대 1,000건 — 서울이 한 달에 300건 안팎이라 넉넉하다

/* 사건 진행 단계 — 숫자가 클수록 앞서 있다. 폐지·기각은 «끝난 일»이라 따로 둔다. */
const STAGES = ["금지명령", "개시", "인가", "종결", "폐지·기각"];

function clean(v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); }
function ymd(s) { s = clean(s).replace(/\D/g, ""); return s.length === 8 ? s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6) : ""; }

function listBody(cortCd, pageNo) {
  return {
    dma_search: { taskDvs: TASK_CORP_REHAB, srchType: "pstgBgng", cortCd, pstgDvs: "999",
      csYr: "", csDvsCd: "", csSrno: "", csNo: "", debtrNm: "", jdbnCd: "" },
    dma_pageInfo: { pageNo, pageSize: PAGE_SIZE, bfPageNo: "", startRowNo: (pageNo - 1) * PAGE_SIZE + 1,
      totalCnt: 0, totalYn: "Y" },
  };
}
function viewBody(row) {
  return { dma_popupSearch: { cortCd: row.cortCd, csNo: row.csNo, inetPbancDvsCd: row.inetPbancDvsCd,
    inetPbancSeq: String(row.inetPbancSeq), taskDvs: TASK_CORP_REHAB } };
}
function isTarget(row) { return clean(row && row.pbancTitlNm).indexOf(TARGET) >= 0; }

/* 영구 ID — 법원코드 + 사건번호(숫자). 같은 사건의 공고가 여러 번 나와도 한 줄이다. */
function noticeKey(row) {
  const c = clean(row && row.cortCd).replace(/\D/g, ""), n = clean(row && row.csNo).replace(/\D/g, "");
  return c && n ? "c" + c + "_" + n : "";
}

/* 공고 제목 하나가 가리키는 단계. «연장·변경·기일 지정» 같은 사무 공고는 단계를 올리지 않는다(null). */
function stageOfTitle(title) {
  const t = clean(title);
  if (/폐지|기각|불허|취하/.test(t)) return "폐지·기각";
  if (/종결/.test(t)) return "종결";
  if (/인가/.test(t) && !/불인가/.test(t)) return "인가";
  if (/불인가/.test(t)) return "폐지·기각";
  if (/개시결정|개시 결정/.test(t)) return "개시";
  if (t.indexOf(TARGET) >= 0) return "금지명령";
  return null;
}
/* 사건의 공고 목록 → 가장 앞선 단계. 끝난 일(폐지·기각)이 있으면 그것이 이긴다. */
function stageOfEvents(events) {
  let best = "";
  (events || []).forEach((e) => {
    const s = stageOfTitle(e && e.t);
    if (s && STAGES.indexOf(s) > STAGES.indexOf(best)) best = s;
  });
  return best;
}

/* 상세 응답에서 «회사 주소»만 꺼낸다 — 다른 칸(대표자·주민번호 등)은 일부러 안 본다 */
/* ⚠ 주소가 «둘»이다 (2026-10-10 확인).
     btprtAddr      채무자(회사)의 본점 소재지  ← 안내문을 보낼 곳·홈페이지를 찾을 곳
     btprtDlvrAddr  법원 서류를 받는 «송달주소» — 대리인 법률사무소인 일이 많다(「503호 법률사무소 경청」)
   송달주소를 회사 주소로 쓰면 우편이 변호사 사무실로 가고, 홈페이지도 엉뚱한 지역으로 찾는다.
   송달주소가 다르면 따로 남기고, 거기 «법률사무소 …» 이름이 있으면 대리인(counsel)으로 적어 둔다
   — 같은 사무실이 여러 회사를 맡는 일이 많아 제휴 후보가 된다. */
function counselOf(addr) {
  const m = clean(addr).match(/(?:법무법인|법률사무소|법무사사무소|변호사사무소)\s*[가-힣A-Za-z0-9]+(?:\([가-힣A-Za-z0-9]+\))?/);
  return m ? m[0].replace(/\s+/g, " ") : "";
}
function pickDetail(data) {
  const m = (data && data.rtnMap) || {};
  const d = m.btprtDebtrInf || {};
  const home = clean(d.btprtAddr || ((d.btprtBasAddr || "") + " " + (d.btprtDtlAddr || "")) || d.rgstryBasAddr);
  const dlv = clean(d.btprtDlvrAddr);
  const same = !dlv || dlv.replace(/\s+/g, "") === home.replace(/\s+/g, "");
  return {
    caseType: clean((m.csBasInf || {}).csNm),
    zip: clean(d.btprtZpcd || d.btprtDlvrZpcd),
    address: home || dlv,
    dlvAddress: same ? "" : dlv,
    dlvZip: same ? "" : clean(d.btprtDlvrZpcd),
    counsel: same ? "" : counselOf(dlv),
  };
}

/* 주소에서 «시·도»와 «시·군·구» — 지역 거르개·화면 표시용 */
/* 법원 공고 주소는 「김포시 통진읍 …」처럼 «도 이름 없이» 오는 일이 있다 — 시 이름으로 도를 알아낸다 */
const SIDO_OF_CITY = {
  경기: "수원 성남 의정부 안양 부천 광명 평택 동두천 안산 고양 과천 구리 남양주 오산 시흥 군포 의왕 하남 용인 파주 이천 안성 김포 화성 광주 양주 포천 여주 연천 가평 양평",
  충남: "천안 공주 보령 아산 서산 논산 계룡 당진 금산 부여 서천 청양 홍성 예산 태안",
  충북: "청주 충주 제천 보은 옥천 영동 증평 진천 괴산 음성 단양",
  전북: "전주 군산 익산 정읍 남원 김제 완주 진안 무주 장수 임실 순창 고창 부안",
  전남: "목포 여수 순천 나주 광양 담양 곡성 구례 고흥 보성 화순 장흥 강진 해남 영암 무안 함평 영광 장성 완도 진도 신안",
  경북: "포항 경주 김천 안동 구미 영주 영천 상주 문경 경산 의성 청송 영양 영덕 청도 고령 성주 칠곡 예천 봉화 울진 울릉",
  경남: "창원 진주 통영 사천 김해 밀양 거제 양산 의령 함안 창녕 고성 남해 하동 산청 함양 거창 합천",
  강원: "춘천 원주 강릉 동해 태백 속초 삼척 홍천 횡성 영월 평창 정선 철원 화천 양구 인제 양양",
};
function sidoOfCity(sigungu) {
  const base = clean(sigungu).replace(/(시|군)$/, "");
  const hit = Object.keys(SIDO_OF_CITY).find((k) => SIDO_OF_CITY[k].split(" ").indexOf(base) >= 0);
  return hit || "";
}
function regionOf(address) {
  const a = clean(address);
  const bare = a.match(/^([가-힣]{2,4}(?:시|군))(?:\s|$)/);
  if (bare && !/^(서울|부산|대구|인천|광주|대전|울산|세종|제주)/.test(a)) {
    const sido = sidoOfCity(bare[1]);
    if (sido) return { sido, sigungu: bare[1] };
  }
  /* 긴 이름을 먼저 짧게 줄여 놓고(서울특별시→서울, 경기도→경기) 한 번에 읽는다 */
  const short = [["서울특별시", "서울"], ["부산광역시", "부산"], ["대구광역시", "대구"], ["인천광역시", "인천"], ["광주광역시", "광주"],
    ["대전광역시", "대전"], ["울산광역시", "울산"], ["세종특별자치시", "세종"], ["경기도", "경기"], ["강원특별자치도", "강원"], ["강원도", "강원"],
    ["충청북도", "충북"], ["충청남도", "충남"], ["전북특별자치도", "전북"], ["전라북도", "전북"], ["전라남도", "전남"],
    ["경상북도", "경북"], ["경상남도", "경남"], ["제주특별자치도", "제주"]];
  let b = a;
  for (const [long, sh] of short) if (b.indexOf(long) === 0) { b = sh + b.slice(long.length); break; }
  const m = b.match(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s*([가-힣]+(?:시|군|구))?/);
  if (!m) return { sido: "", sigungu: "" };
  return { sido: m[1], sigungu: m[2] || "" };
}

/* 공고 한 건 → 저장할 레코드(온톨로지 문서). 회사명은 관계 열쇠가 아니라 «보이는 이름»이다(debtorName). */
function toRecord(row, detail, nowMs) {
  const id = noticeKey(row);
  const rg = regionOf(detail.address);
  return {
    id, entityType: "Document", docKind: "rehabNotice",
    courtCode: clean(row.cortCd), courtName: COURTS[clean(row.cortCd)] || clean(row.cortCd),
    caseNo: clean(row.csNoNm), division: clean(row.jdbnCdNm),
    caseType: detail.caseType, debtorName: clean(row.btprtNm),
    zip: detail.zip, address: detail.address, sido: rg.sido, sigungu: rg.sigungu,
    dlvAddress: detail.dlvAddress || "", dlvZip: detail.dlvZip || "", counsel: detail.counsel || "",
    noticeTitle: clean(row.pbancTitlNm), noticeDate: ymd(row.pbancBgngYmd),
    stage: "금지명령", events: [],
    createdAt: nowMs, updatedAt: nowMs, revision: 1,
  };
}

function addEvent(map, key, row) {
  const d = ymd(row.pbancBgngYmd), t = clean(row.pbancTitlNm);
  if (!key || !d || !t) return;
  const list = map[key] || (map[key] = []);
  if (!list.some((e) => e.d === d && e.t === t)) list.push({ d, t });
}
function sortedEvents(list) {
  return (list || []).slice().sort((a, b) => a.d.localeCompare(b.d) || a.t.localeCompare(b.t));
}

/* 한 번 돌기 — post(url, body) 는 JSON 을 돌려주는 함수(서버·검사가 각자 넣는다).
   existing: 이미 담긴 notices(키 → 레코드). 이미 있는 사건은 상세를 다시 부르지 않고, «새 공고 이력»만 붙인다. */
async function run({ post, existing = {}, sinceYmd, courts = Object.keys(COURTS), nowMs = Date.now(), wait = () => Promise.resolve() }) {
  const since = clean(sinceYmd).replace(/\D/g, "");
  const out = { checked: 0, found: 0, added: [], eventUpdates: {}, errors: [] };
  const events = {};          // 사건 열쇠 → 이번에 본 공고들
  const targets = [];         // 포괄적 금지명령 공고 줄(처음 보는 것만 상세를 부른다)
  for (const cort of courts) {
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const j = await post(LIST, listBody(cort, page));
        await wait();
        const rows = (j && j.data && j.data.dlt_pbancLst) || [];
        out.checked += rows.length;
        for (const row of rows) {
          if (clean(row.pbancBgngYmd) < since) continue;
          const key = noticeKey(row);
          if (!key) continue;
          addEvent(events, key, row);
          if (isTarget(row)) targets.push({ key, row });
        }
        /* 공고일 내림차순 — 마지막 줄이 기간 밖이면 다음 쪽은 볼 필요가 없다 */
        if (!rows.length || rows.length < PAGE_SIZE || clean(rows[rows.length - 1].pbancBgngYmd) < since) break;
      }
    } catch (e) {
      out.errors.push({ court: cort, why: clean(e && e.message || e).slice(0, 160) });
    }
  }
  const seen = {};
  for (const { key, row } of targets) {
    if (seen[key]) continue;
    seen[key] = 1;
    out.found++;
    if (existing[key]) continue;
    try {
      const v = await post(VIEW, viewBody(row));
      await wait();
      const rec = toRecord(row, pickDetail(v && v.data), nowMs);
      rec.events = sortedEvents(events[key]);
      rec.stage = stageOfEvents(rec.events) || "금지명령";
      out.added.push(rec);
    } catch (e) {
      out.errors.push({ court: clean(row.cortCd), why: ("상세 " + clean(e && e.message || e)).slice(0, 160) });
    }
  }
  /* 이미 담긴 사건에 «새로 생긴» 공고(개시결정·인가 …)가 있으면 이력과 단계만 고친다 */
  Object.keys(existing).forEach((key) => {
    const cur = existing[key];
    if (!cur || !events[key]) return;
    const have = Array.isArray(cur.events) ? cur.events : [];
    const merged = sortedEvents(have.concat(events[key].filter((e) => !have.some((h) => h.d === e.d && h.t === e.t))));
    if (merged.length === have.length) return;
    out.eventUpdates[key] = { events: merged, stage: stageOfEvents(merged) || cur.stage || "금지명령" };
  });
  return out;
}

/* 저장할 묶음 — 새 공고 + 사건 이력 갱신 + 이번 회차 기록. 한 번의 update 로 담는다. */
function updatesOf(result, today, nowIso, nowMs) {
  const upd = {};
  result.added.forEach((r) => { upd["notices/" + r.id] = r; });
  Object.keys(result.eventUpdates || {}).forEach((k) => {
    const u = result.eventUpdates[k];
    upd["notices/" + k + "/events"] = u.events;
    upd["notices/" + k + "/stage"] = u.stage;
    if (nowMs) upd["notices/" + k + "/updatedAt"] = nowMs;
  });
  upd["runs/" + today] = { at: nowIso, checked: result.checked, found: result.found,
    added: result.added.length, updated: Object.keys(result.eventUpdates || {}).length, errors: result.errors };
  return upd;
}

module.exports = { BASE, LIST, VIEW, HOME, UA, COURTS, TASK_CORP_REHAB, TARGET, STAGES,
  listBody, viewBody, isTarget, noticeKey, pickDetail, toRecord, run, updatesOf, ymd,
  stageOfTitle, stageOfEvents, regionOf, counselOf };
