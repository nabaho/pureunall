"use strict";
// 홈페이지에서 읽어도 되는 쪽만 가린다. 이 파일은 읽기 대상을 정하는 유일한 자리다.

const ORIGIN = "https://xn--o80bs5mdnbm0bf80anms.kr";

/* ★ 관리 대상 «목록»은 이제 자료(homepage/config/pages)에 있다.
   목록을 이 파일에 박아 두면 홈페이지에 쪽을 새로 만들 때마다 함수를 다시 배포해야 했다.
   그래서 여기서는 «이름 규칙»으로 가린다 — 목록을 여는 것이지 아무 주소나 여는 것이 아니다.
   아래 ALLOWED 는 통합시스템이 처음부터 관리해 온 기본 8쪽(+people)이다. 이제 허용 판정에는
   쓰지 않지만, 자료가 비어 있을 때 화면이 보여주는 기본값과 같아야 해서 근거로 남긴다. */
const ALLOWED = [
  "people",   // 구성원 소개
  "greeting", // 인사말
  "inquiry",  // 오시는길
  "work1", "work2", "work3", "work4", "work5a", "work5b" // 주요업무
];

/* 쪽 이름 규칙 — 영문 소문자·숫자·밑줄 30자까지.
   이 규칙 하나로 다른 서버 주소(`https://…`)·상위 이동(`../`)·빗금(`//`)·물음표·인코딩(`%2f`)이
   모두 걸러진다. 규칙을 느슨하게 하면(점·빗금·대문자 허용) 그 통로가 다시 열린다. */
const NAME_RE = /^[a-z0-9_]{1,30}$/;

/* ★ 이름 규칙만으로는 «관리자 주소»가 통과한다(admin 은 영문 소문자다).
   관리자·설치·자료 폴더는 이름 규칙과 무관하게 막는다. 읽기 전용 함수라도 관리자 화면을
   서버가 대신 두드리게 만들 이유가 없다. */
const BLOCKED = [
  "admin", "administrator", "rhymix", "index",
  "install", "config", "files", "common", "modules", "addons", "layouts", "widgets",
  "login", "logout", "member"
];

function homepageUrl(path) {
  if (typeof path !== "string") return null;
  const key = path.replace(/^\/+/, "");
  if (!NAME_RE.test(key)) return null;
  if (BLOCKED.includes(key)) return null;
  return ORIGIN + "/" + key;
}

/* ★★ 옛 홈페이지를 접었다 — 대표 결정 2026-11-15 「푸른노무법인.kr 더이상 연장 안한다」(2026-11-27 만료).
   true 면 서버는 옛 사이트에 «아무 요청도» 보내지 않는다 — 읽기(readHomepage)·고치기(homepageWrite)·
   자동 연결(homepageAuto·매달)의 관리자 로그인까지 전부(functions/index.js 의 홈부르기·홈로그인 맨 앞).
   ⚠ 왜 «요청 자체»를 막나: 만료된 도메인을 남이 다시 등록하면, 우리 서버가 그쪽으로 관리자 아이디·비밀번호를
     보내게 된다. 실패를 기다리지 않고 «보내기 전에» 멈춘다.
   ⚠ 새 사이트(nabaho/pureun-site · pureunlabor.co.kr) 일은 이 스위치와 무관하다 — 매달 새 사이트 재게시는 그대로 돈다.
     (homepage/auto/config.off 로 끄지 말 것 — 그 스위치는 새 사이트 재게시까지 함께 멈춘다.)
   ⚠ 되살린다면 이 한 줄과 화면(pu-home.html 의 OLD_SITE_OFF)을 «함께» false 로. */
const OLD_SITE_CLOSED = true;
const OLD_SITE_CLOSED_MSG = "옛 홈페이지(푸른노무법인.kr)는 2026-11-27 로 접었습니다 — "
  + "홈페이지(pureunlabor.co.kr)는 홈페이지 화면의 「저장하고 반영」으로 고칩니다.";

module.exports = { ORIGIN, ALLOWED, BLOCKED, NAME_RE, homepageUrl, OLD_SITE_CLOSED, OLD_SITE_CLOSED_MSG };
