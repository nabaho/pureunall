/* 회생광고 — 법원 회생·파산 공고에서 «법인회생 포괄적 금지명령» 기업을 매일 모은다 (2026-10-10).
   대표 지시 「법인회생이 발생하면 재기지원컨설팅으로 연결 … 포괄금지명령 나온 기업만 모아서 홍보물」
   → 방식 결정 「추천대로」 = 사람이 고르고(승인) «우편»으로 보낸다. 이 모듈은 «모으기»만 한다.

   ★ 출처: 대법원 회생·파산 공고(ssgo.scourt.go.kr) — 서울회생법원 누리집 공고 화면이 이것을 끼워 쓴다.
     한 곳에서 전국 15개 회생 관할 법원을 본다. robots.txt 에 이 경로는 막혀 있지 않다.
   ⚠ «읽기만» 한다. 법원 하나에 목록 몇 쪽 + 해당 건 상세 하나씩. 요청 사이를 띄운다.
   ⚠ 남기는 것은 공고에 실린 «회사명·주소·사건 정보»뿐이다(법인 = 공개 공고).
     대표자·주민번호·대리인 이름은 받지 않는다 — 상세 응답에 있어도 버린다.
   ⚠ 포괄적 금지명령 = 채무자회생법 제45조. 회생 신청 직후(개시 결정 전) 단계다.
   ⚠ 이메일로 보내는 기능은 여기 없다 — 정보통신망법 제50조(광고성 정보 사전 동의). */

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
const MAX_PAGES = 5;                // 법원 하나에 최대 500건(서울도 열흘에 100건 안팎)

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

/* 상세 응답에서 «회사 주소»만 꺼낸다 — 다른 칸(대표자·주민번호 등)은 일부러 안 본다 */
function pickDetail(data) {
  const m = (data && data.rtnMap) || {};
  const d = m.btprtDebtrInf || {};
  return {
    caseType: clean((m.csBasInf || {}).csNm),
    zip: clean(d.btprtDlvrZpcd || d.btprtZpcd),
    address: clean(d.btprtDlvrAddr || d.btprtAddr),
  };
}

/* 공고 한 건 → 저장할 레코드(온톨로지 문서). 회사명은 관계 열쇠가 아니라 «보이는 이름»이다(debtorName). */
function toRecord(row, detail, nowMs) {
  const id = noticeKey(row);
  return {
    id, entityType: "Document", docKind: "rehabNotice",
    courtCode: clean(row.cortCd), courtName: COURTS[clean(row.cortCd)] || clean(row.cortCd),
    caseNo: clean(row.csNoNm), division: clean(row.jdbnCdNm),
    caseType: detail.caseType, debtorName: clean(row.btprtNm),
    zip: detail.zip, address: detail.address,
    noticeTitle: clean(row.pbancTitlNm), noticeDate: ymd(row.pbancBgngYmd),
    createdAt: nowMs, updatedAt: nowMs, revision: 1,
  };
}

/* 한 번 돌기 — post(url, body) 는 JSON 을 돌려주는 함수(서버·검사가 각자 넣는다).
   existing: 이미 담긴 notices(키 → 레코드). 이미 있는 사건은 상세를 다시 부르지 않는다. */
async function run({ post, existing = {}, sinceYmd, courts = Object.keys(COURTS), nowMs = Date.now(), wait = () => Promise.resolve() }) {
  const since = clean(sinceYmd).replace(/\D/g, "");
  const out = { checked: 0, found: 0, added: [], errors: [] };
  for (const cort of courts) {
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const j = await post(LIST, listBody(cort, page));
        await wait();
        const rows = (j && j.data && j.data.dlt_pbancLst) || [];
        out.checked += rows.length;
        for (const row of rows) {
          if (clean(row.pbancBgngYmd) < since || !isTarget(row)) continue;
          const key = noticeKey(row);
          if (!key) continue;
          out.found++;
          if (existing[key] || out.added.some((r) => r.id === key)) continue;
          const v = await post(VIEW, viewBody(row));
          await wait();
          out.added.push(toRecord(row, pickDetail(v && v.data), nowMs));
        }
        /* 공고일 내림차순 — 마지막 줄이 기간 밖이면 다음 쪽은 볼 필요가 없다 */
        if (!rows.length || rows.length < PAGE_SIZE || clean(rows[rows.length - 1].pbancBgngYmd) < since) break;
      }
    } catch (e) {
      out.errors.push({ court: cort, why: clean(e && e.message || e).slice(0, 160) });
    }
  }
  return out;
}

/* 저장할 묶음 — 새 공고 + 이번 회차 기록. 한 번의 update 로 담는다. */
function updatesOf(result, today, nowIso) {
  const upd = {};
  result.added.forEach((r) => { upd["notices/" + r.id] = r; });
  upd["runs/" + today] = { at: nowIso, checked: result.checked, found: result.found,
    added: result.added.length, errors: result.errors };
  return upd;
}

module.exports = { BASE, LIST, VIEW, HOME, UA, COURTS, TASK_CORP_REHAB, TARGET,
  listBody, viewBody, isTarget, noticeKey, pickDetail, toRecord, run, updatesOf, ymd };
