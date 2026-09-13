"use strict";
/* 홈페이지 «고치기» — 서버가 우리 회사 홈페이지 관리자로 들어가 그 자리에서 고친다.
   ═══════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-13: 「붙여넣기 전혀 안 하고 싶다. 그냥 니가 들어가서 고쳐라.」

   ── 2026-08-30 에 이 길을 한 번 접었던 까닭과, 무엇이 달라졌나 ───────────
   그때 접은 까닭은 하나였다:
     「서버가 경력사항만 보내고 숨은 칸(content)을 빠뜨리면 **사진이 지워진 채**
      저장된다. 오류도 안 나고 우리 화면엔 「같음」으로 뜬다.」
   그 걱정은 «경력사항만 보내는 서버»에 대한 것이다. 이 파일은 그렇게 안 한다 —
     ① 관리자로 들어가 **고치는 화면을 그대로 받아 온다**(사진·확인표·첨부 목록 전부).
     ② 받아 온 칸 가운데 **우리가 이름을 아는 칸만** 갈아 끼운다.
     ③ 나머지는 **받은 그대로 도로 보낸다.**
   ①②③ 이면 사진이 날아갈 길이 없다. 단추가 하던 일을 서버가 할 뿐이다.

   ── 그래도 한 줄로 못 믿는다. 그래서 자물쇠를 둔다 ────────────────────
   기계가 「괜찮겠지」 하고 보내면 사진 한 장이 조용히 사라진다. 그러니
   **보내기 전에 스스로 막는다**(막을까). 하나라도 어긋나면 아무것도 안 보낸다.
   ⚠ 이 자물쇠를 풀거나 「--force」 같은 옆길을 내지 말 것. 이것이 전부다.

   ★ 비밀번호는 이 저장소에 없다. 대표님이 당신 터미널에서 한 번 넣으신다:
       firebase functions:secrets:set HOME_ADMIN_ID
       firebase functions:secrets:set HOME_ADMIN_PW
     내가 그 값을 보지 않는다. 서버만 읽는다. */

const ORIGIN = "https://xn--o80bs5mdnbm0bf80anms.kr";
const 브라우저표시 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) pureun-erp-homepage";

/* 고치는 화면 주소 — 글 번호 하나. 다른 게시판은 안 연다. */
const BOARD = "people_board";
function 고치는주소(srl) {
  const n = Number(srl);
  if (!Number.isInteger(n) || n <= 0) return null;
  return ORIGIN + "/index.php?mid=" + BOARD + "&act=dispBoardWrite&document_srl=" + n;
}

/* 로그인 화면 — 손님이 게시판을 열면 403 과 함께 «로그인 칸»이 같이 온다.
   그 화면을 그대로 받아 아이디·비밀번호 둘만 채워 도로 보낸다. */
function 로그인화면주소() { return ORIGIN + "/index.php?mid=" + BOARD; }
function 로그인보내는곳() { return ORIGIN + "/index.php?act=procMemberLogin"; }

/* ── 우리가 «이름을 아는» 칸 ───────────────────────────────────────────
   ⚠ 이름을 짐작하지 않는다. 경력사항만 정찰로 이름을 안다(extra_vars4).
     나머지는 화면에 «보이는 이름표»로 찾는다 — 못 찾으면 그 칸은 안 건드린다.
     짐작해서 쓰면 경력이 「메인 설명」 자리에 들어간다. */
const 경력칸 = "extra_vars4";
const 이름표로찾을것 = ["직책1", "직책2", "메인 설명"];

/* 절대로 갈아 끼우지 않는 칸 — 받은 그대로 되돌려 보낸다.
   content 안에 얼굴 사진이 들어 있고, file_srl 들이 첨부를 붙들고 있다. */
const 손대지말것 = ["content", "file_srl_list", "uploaded_files", "document_srl",
  "mid", "act", "module", "page", "_rx_csrf_token", "xe_validator_id"];

/* ── 화면 읽기 ─────────────────────────────────────────────────────── */

function 따옴표떼기(s) {
  const t = String(s == null ? "" : s).trim();
  if ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'")) {
    return t.slice(1, -1);
  }
  return t;
}

function 속성(태그, 이름) {
  const m = new RegExp("\\s" + 이름 + "\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)", "i").exec(태그);
  return m ? 따옴표떼기(m[1]) : "";
}

/* &amp; 같은 것을 되돌린다 — 안 되돌리면 사진 주소가 깨진 채 저장된다 */
function 글자되돌리기(s) {
  return String(s == null ? "" : s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&");            /* ⚠ 맨 뒤여야 한다 — 먼저 하면 &amp;lt; 가 < 가 된다 */
}

/* ── 확인표(CSRF) ──────────────────────────────────────────────────────
   ★ 2026-09-13 정찰로 알아낸 것 — 라이믹스는 확인표를 «숨은 칸»에 안 넣는다.
     쪽 머리의 <meta name="csrf-token" content="…"> 에 붙여 두고, 보낼 때
     X-CSRF-Token 머리글로 받는다. 숨은 칸 `_rx_csrf_token` 만 찾으면
     **로그인이 멀쩡해도 「확인표가 없습니다」로 막힌다** — 첫 시도에 그랬다. */
function 확인표뽑기(html) {
  const 본문 = String(html || "");
  const m = /<meta[^>]+name=["']csrf-token["'][^>]*>/i.exec(본문);
  if (m) {
    const v = /content\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    if (v && v[1]) return v[1];
  }
  /* 판이 바뀌어 숨은 칸으로 돌아올 수도 있다 — 그때도 찾는다 */
  const h = /<input[^>]+name=["']_rx_csrf_token["'][^>]*>/i.exec(본문);
  if (h) {
    const v = /value\s*=\s*["']([^"']*)["']/i.exec(h[0]);
    if (v && v[1]) return v[1];
  }
  return "";
}

/* <form> 한 덩이만 떼어 온다 — 쪽에는 찾기 칸·댓글 칸도 함께 있어서,
   쪽 전체를 긁으면 로그인과 상관없는 칸이 섞여 들어간다. */
function 폼떼기(html, 표시) {
  const 본문 = String(html || "");
  const re = /<form\b[\s\S]*?<\/form>/gi;
  let m;
  while ((m = re.exec(본문))) { if (m[0].indexOf(표시) >= 0) return m[0]; }
  return "";
}

/* 고치는 화면 한 장에서 «보낼 칸»을 전부 긁는다.
   input·textarea·select 를 다 본다. 하나라도 빠뜨리면 그 칸이 빈 채로 저장된다. */
function 칸읽기(html) {
  const 본문 = String(html || "");
  const 칸 = {};
  const 여럿 = {};   /* 같은 이름이 여러 번 나오는 칸(체크상자 따위) */

  /* input */
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(본문))) {
    const 태그 = m[0];
    const 이름 = 속성(태그, "name");
    if (!이름) continue;
    const 종류 = (속성(태그, "type") || "text").toLowerCase();
    if (종류 === "submit" || 종류 === "button" || 종류 === "image" || 종류 === "file") continue;
    if (종류 === "checkbox" || 종류 === "radio") {
      /* 켜진 것만 보낸다 — 브라우저가 하는 것과 같다 */
      if (!/\schecked\b/i.test(태그)) continue;
    }
    const 값 = 글자되돌리기(속성(태그, "value"));
    if (Object.prototype.hasOwnProperty.call(칸, 이름)) {
      (여럿[이름] = 여럿[이름] || [칸[이름]]).push(값);
    }
    칸[이름] = 값;
  }

  /* textarea */
  const tre = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  while ((m = tre.exec(본문))) {
    const 이름 = 속성("<t " + m[1] + ">", "name");
    if (!이름) continue;
    칸[이름] = 글자되돌리기(m[2]);
  }

  /* select — 골라진 것 하나 */
  const sre = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = sre.exec(본문))) {
    const 이름 = 속성("<s " + m[1] + ">", "name");
    if (!이름) continue;
    const 안 = m[2];
    const ore = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let o, 고름 = null, 첫째 = null;
    while ((o = ore.exec(안))) {
      const 태그 = "<o " + o[1] + ">";
      const 값 = 속성(태그, "value") || 글자되돌리기(o[2]).trim();
      if (첫째 === null) 첫째 = 값;
      if (/\sselected\b/i.test(태그)) 고름 = 값;
    }
    칸[이름] = 고름 === null ? (첫째 === null ? "" : 첫째) : 고름;
  }

  return { 칸: 칸, 여럿: 여럿, 확인표: 확인표뽑기(본문) };
}

/* 화면에 «보이는 이름표»로 칸 이름을 찾는다.
   「직책1」·「직책1 *」·「직책1 :」 이 다 같은 이름이다. */
function 이름다듬기(s) {
  return String(s == null ? "" : s)
    .replace(/<[^>]*>/g, "")
    .replace(/[*:：\s\u00a0]+/g, "")
    .trim();
}

function 이름표로칸찾기(html, 보이는이름) {
  const 본문 = String(html || "");
  const 찾을것 = 이름다듬기(보이는이름);
  if (!찾을것) return "";
  /* 표 한 줄(<tr>…</tr>) 안에서 이름표와 칸이 함께 산다 — 캡처의 그 모양이다 */
  const rre = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rre.exec(본문))) {
    const 줄 = m[1];
    const 머리 = /<(th|td|label)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(줄);
    if (!머리) continue;
    if (이름다듬기(머리[2]) !== 찾을것) continue;
    const 칸 = /<(input|textarea|select)\b([^>]*)>/i.exec(줄);
    if (!칸) continue;
    const 이름 = 속성("<x " + 칸[2] + ">", "name");
    /* 숨은 칸·파일 칸에 쓰지 않는다 — 이름표 옆에 있다고 그것이 그 칸은 아니다 */
    const 종류 = (속성("<x " + 칸[2] + ">", "type") || "").toLowerCase();
    if (!이름 || 종류 === "hidden" || 종류 === "file") continue;
    return 이름;
  }
  return "";
}

/* ── 비공개로 내리기 ────────────────────────────────────────────────────
   ★ 내리는 것은 «지우는» 것이 아니다. 잘못 내렸어도 되살릴 수 있어야 한다
     (대표 지시 — 홈페이지 글은 지우지 않는다. 감추기만 한다).
   ⚠ 칸 이름을 짐작하지 않는다. 고르개(select)의 «보이는 글자»가 「비공개」인 것을
     찾는다 — 즐겨찾기 단추(setPrivate)가 하던 것과 똑같은 방식이다.
     하나로 안 좁혀지면 아무것도 하지 않는다. */
function 비공개자리(html) {
  const 본문 = String(html || "");
  const 찾음 = [];
  const sre = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = sre.exec(본문))) {
    const 이름 = 속성("<s " + m[1] + ">", "name");
    if (!이름) continue;
    const ore = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let o;
    while ((o = ore.exec(m[2]))) {
      const 글자 = 이름다듬기(글자되돌리기(o[2]));
      if (글자 === "비공개" || 글자 === "비밀" || 글자 === "비밀글") {
        const 태그 = "<o " + o[1] + ">";
        찾음.push({ 이름: 이름, 값: 속성(태그, "value"), 글자: 글자 });
      }
    }
  }
  if (찾음.length === 1) {
    return { ok: true, 이름: 찾음[0].이름, 값: 찾음[0].값,
             어떻게: "고르개를 「" + 찾음[0].글자 + "」로 바꿉니다" };
  }
  if (찾음.length > 1) {
    return { ok: false, why: "「비공개」를 고를 곳이 " + 찾음.length
      + "군데라 어느 것인지 단정할 수 없습니다" };
  }

  /* ★ 고르개가 없으면 «딸깍 칸»을 본다 — 라이믹스 게시판은 대개 「비밀글」 체크상자다.
       (즐겨찾기 단추 setPrivate 도 같은 차례로 본다. 서버만 고르개까지 보고 멈춰
        있어서 2026-09-13 에 퇴사자가 안 내려갔다.) */
  const 비밀말 = /비공개|비밀글|비밀|secret/i;
  const bre = /<input\b[^>]*>/gi;
  const 이름맞음 = [], 딱지맞음 = [];
  let b;
  while ((b = bre.exec(본문))) {
    const 태그 = b[0];
    if ((속성(태그, "type") || "").toLowerCase() !== "checkbox") continue;
    const 이름 = 속성(태그, "name");
    if (!이름) continue;
    const 것 = { 이름: 이름, 값: 속성(태그, "value") || "Y" };
    /* ① 칸 이름 자체가 말해 주면 그게 가장 확실하다 (is_secret 따위) */
    if (비밀말.test(이름)) { 이름맞음.push(것); continue; }
    /* ② 아니면 «바로 앞» 딱지를 본다. 뒤는 안 본다 — 뒤를 보면 다음 줄의 딱지가
         엉뚱한 칸에 붙는다(2026-09-13 에 「알림」 칸이 그렇게 걸렸다).
       ⚠ 사이에 다른 <input 이 끼어 있으면 그 딱지는 이 칸 것이 아니다. */
    const 앞 = 본문.slice(Math.max(0, b.index - 120), b.index);
    const 끊을곳 = 앞.lastIndexOf("<input");
    const 내딱지 = (끊을곳 >= 0 ? 앞.slice(끊을곳) : 앞).replace(/<[^>]*>/g, " ");
    if (비밀말.test(내딱지)) 딱지맞음.push(것);
  }
  const 딸깍 = 이름맞음.length ? 이름맞음 : 딱지맞음;
  if (딸깍.length === 1) {
    return { ok: true, 이름: 딸깍[0].이름, 값: 딸깍[0].값,
             어떻게: "「비밀글」에 표시합니다" };
  }
  if (딸깍.length > 1) {
    return { ok: false, why: "「비밀글」 칸이 " + 딸깍.length + "군데라 단정할 수 없습니다 ("
      + 딸깍.map(x => x.이름).join(", ") + ")" };
  }

  /* ⚠ 못 찾았으면 «이 화면에 무엇이 있는지»를 함께 돌려준다.
       「못 찾았습니다」 한 줄만 오면 무엇을 고쳐야 할지 알 길이 없다. */
  const 고르개들 = [];
  const s2 = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let q;
  while ((q = s2.exec(본문))) {
    const 이름 = 속성("<s " + q[1] + ">", "name");
    if (!이름) continue;
    const 글자들 = [];
    const o2 = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
    let r;
    while ((r = o2.exec(q[2]))) 글자들.push(이름다듬기(글자되돌리기(r[1])));
    고르개들.push(이름 + "[" + 글자들.slice(0, 6).join("/") + "]");
  }
  const 딸깍이름 = [];
  const b2 = /<input\b[^>]*>/gi;
  let c;
  while ((c = b2.exec(본문))) {
    if ((속성(c[0], "type") || "").toLowerCase() !== "checkbox") continue;
    const n = 속성(c[0], "name");
    if (n) 딸깍이름.push(n);
  }
  return { ok: false,
    why: "이 화면에서 «비공개로 바꾸는 자리»를 찾지 못했습니다"
      + " · 고르개: " + (고르개들.join(", ") || "없음")
      + " · 딸깍: " + (딸깍이름.join(", ") || "없음"),
    고르개들: 고르개들, 딸깍들: 딸깍이름 };
}

/* ── 자물쇠 ────────────────────────────────────────────────────────────
   보내기 전에 스스로 막는다. 하나라도 어긋나면 «아무것도» 안 보낸다.
   ⚠ 여기를 느슨하게 하면 사진이 조용히 사라진다. 2026-08-30 에 이 길을 접은
     까닭이 바로 그것이었다. */
function 막을까(읽은것, 글번호) {
  const 칸 = (읽은것 && 읽은것.칸) || {};
  const 걸린것 = [];

  /* ① 로그인이 풀렸으면 고치는 화면이 아니라 로그인 화면이 온다 */
  if (!Object.prototype.hasOwnProperty.call(칸, 경력칸)) {
    걸린것.push("경력사항 칸(" + 경력칸 + ")이 없습니다 — 로그인이 풀렸거나 홈페이지 화면이 바뀌었습니다");
  }
  /* ② 숨은 칸(content)이 없으면 사진을 잃는다. 비어 있어도 안 된다 —
       원래 비어 있었는지 우리가 지운 것인지 여기서는 알 수 없기 때문이다. */
  if (!Object.prototype.hasOwnProperty.call(칸, "content")) {
    걸린것.push("숨은 칸(content)이 안 왔습니다 — 이대로 보내면 얼굴 사진이 지워집니다");
  }
  /* ③ 엉뚱한 글을 고치지 않는다 */
  const 받은번호 = String(칸.document_srl == null ? "" : 칸.document_srl).trim();
  if (받은번호 !== String(글번호)) {
    걸린것.push("글 번호가 다릅니다(부른 것 " + 글번호 + " · 화면 " + (받은번호 || "없음") + ")");
  }
  /* ④ 라이믹스 확인표가 없으면 어차피 저장이 안 된다 — 미리 멈춰 까닭을 알린다.
       ⚠ 확인표는 «숨은 칸»이 아니라 쪽 머리의 <meta name="csrf-token"> 에 있다.
         2026-09-13 첫 시도에서 숨은 칸만 찾다가 멀쩡한 화면을 막았다. */
  const 확인표 = String((읽은것 && 읽은것.확인표) || "")
    || (Object.prototype.hasOwnProperty.call(칸, "_rx_csrf_token") ? String(칸._rx_csrf_token || "") : "");
  if (!확인표) 걸린것.push("확인표가 없습니다 — 관리자로 들어가지 못한 것 같습니다");

  return { ok: 걸린것.length === 0, 걸린것: 걸린것 };
}

/* ── 갈아 끼우기 ───────────────────────────────────────────────────────
   받은 칸을 그대로 두고, «이름을 아는 칸»만 바꾼다.
   고칠것 = { 경력사항: '…', 직책1: '…', 직책2: '…', 메인설명: '…' } (있는 것만) */
function 갈아끼우기(읽은것, 고칠것, html) {
  const 칸 = Object.assign({}, (읽은것 && 읽은것.칸) || {});
  const 바뀐것 = [];
  const 못찾은것 = [];
  const 것 = 고칠것 || {};

  function 넣기(보이는이름, 칸이름, 새값) {
    if (새값 == null) return;                       /* 안 준 것은 안 건드린다 */
    if (!칸이름) { 못찾은것.push(보이는이름); return; }
    if (손대지말것.indexOf(칸이름) >= 0) { 못찾은것.push(보이는이름); return; }
    if (!Object.prototype.hasOwnProperty.call(칸, 칸이름)) { 못찾은것.push(보이는이름); return; }
    const 옛 = String(칸[칸이름] == null ? "" : 칸[칸이름]);
    const 새 = String(새값);
    if (옛 === 새) return;                          /* 같으면 안 보낸다 — 헛 이력이 남는다 */
    칸[칸이름] = 새;
    바뀐것.push({ 이름: 보이는이름, 칸: 칸이름, 옛: 옛, 새: 새 });
  }

  /* 이름은 라이믹스 «제목» 칸이다 — 이것도 짐작이 아니라 아는 이름이다.
     ⚠ 목록 카드에 「홍길동대표」로 붙어 보이는 것은 홈페이지가 «제목 + 직책1» 을
       나란히 그리기 때문이다. 제목에 이름만 써도 직책이 사라지지 않는다. */
  /* 퇴사자 내리기 — 글자를 고치는 것이 아니라 «감추는» 것이다.
     ⚠ 여기서만 칸 이름을 화면에서 찾는다. 못 찾으면 안 건드리고 알린다. */
  if (것.비공개 === true) {
    const 자리 = 비공개자리(html);
    if (!자리.ok) 못찾은것.push("비공개(" + 자리.why + ")");
    else if (String(칸[자리.이름] == null ? "" : 칸[자리.이름]) !== String(자리.값)) {
      바뀐것.push({ 이름: "홈페이지에서", 칸: 자리.이름,
                   옛: "보임", 새: "비공개" });
      칸[자리.이름] = String(자리.값);
    }
  }

  넣기("이름", "title", 것.이름);
  넣기("경력사항", 경력칸, 것.경력사항);
  넣기("직책1", 이름표로칸찾기(html, "직책1"), 것.직책1);
  넣기("직책2", 이름표로칸찾기(html, "직책2"), 것.직책2);
  넣기("메인 설명", 이름표로칸찾기(html, "메인 설명"), 것.메인설명);

  return { 칸: 칸, 바뀐것: 바뀐것, 못찾은것: 못찾은것 };
}

/* 보낼 몸통 — 받은 칸을 하나도 빠뜨리지 않고 싣는다 */
function 몸통(칸, 여럿) {
  const p = new URLSearchParams();
  Object.keys(칸 || {}).forEach((k) => {
    const 여러값 = (여럿 || {})[k];
    if (Array.isArray(여러값)) { 여러값.forEach((v) => p.append(k, String(v == null ? "" : v))); return; }
    p.append(k, String(칸[k] == null ? "" : 칸[k]));
  });
  return p.toString();
}

/* 저장하는 곳 — 라이믹스는 act 를 바꿔 같은 자리로 보낸다 */
function 보낼주소() { return ORIGIN + "/index.php"; }
function 저장할act() { return "procBoardInsertDocument"; }

/* ── 로그인 몸통 ───────────────────────────────────────────────────────
   ⚠ 아이디·비밀번호만 보내면 안 들어가진다. 라이믹스는 로그인 칸에 함께 붙여 둔
     ruleset·mid·돌아갈 주소·xe_validator_id 를 «다 같이» 받아야 한다
     (2026-09-13 정찰). 그래서 짐작해 만들지 않고 «받은 칸을 그대로» 쓰고
     아이디·비밀번호 둘만 채운다 — 고치기와 같은 방식이다. */
function 로그인몸통(로그인쪽, 아이디, 암호) {
  const 폼 = 폼떼기(로그인쪽, "procMemberLogin");
  const 읽은것 = 칸읽기(폼 || 로그인쪽);
  const 칸 = Object.assign({}, 읽은것.칸);
  /* 이 화면이 로그인 칸이 맞나 — 아니면 짐작으로 밀어 넣지 않는다 */
  const 있나 = Object.prototype.hasOwnProperty.call(칸, "user_id")
    && Object.prototype.hasOwnProperty.call(칸, "password");
  if (!있나) return { ok: false, why: "로그인 칸을 찾지 못했습니다(홈페이지 화면이 바뀐 듯합니다)" };
  칸.user_id = String(아이디 == null ? "" : 아이디);
  칸.password = String(암호 == null ? "" : 암호);
  칸.module = "member";
  칸.act = "procMemberLogin";
  const 확인표 = 확인표뽑기(로그인쪽);
  if (확인표) 칸._rx_csrf_token = 확인표;
  return { ok: true, 몸통: 몸통(칸, 읽은것.여럿), 확인표: 확인표,
           칸이름들: Object.keys(칸).filter((k) => k !== "password") };
}

module.exports = {
  ORIGIN, BOARD, 브라우저표시,
  고치는주소, 보낼주소, 저장할act, 로그인화면주소, 로그인보내는곳,
  경력칸, 이름표로찾을것, 손대지말것,
  칸읽기, 이름표로칸찾기, 이름다듬기, 글자되돌리기, 확인표뽑기, 폼떼기, 비공개자리,
  막을까, 갈아끼우기, 몸통, 로그인몸통
};
