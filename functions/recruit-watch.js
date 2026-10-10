/* 컨설턴트 모집 감시(서버) — 기관 게시판에 «사람을 뽑는» 새 글이 올라오면 남긴다 (2026-10-04)

   대표 결정 2026-10-04: 「기관에 링크 연결해서 공고가 올라오면 캘린더에 올라오게」 →
   「기관 게시판 새 글 자동 감지 서버 — 지금 만든다」.

   ★ 왜 서버인가: 기관 누리집은 다른 화면(브라우저)이 읽어 가는 것을 막아 둔다(CORS).
     그래서 정부사업신청 화면이 직접 못 읽고, 서버가 하루 한 번 대신 읽는다.

   하루 한 번 이렇게 한다(게시판마다):
     ① 목록 첫 쪽만 받는다(한 기관에 한 번 — 기관 서버에 짐을 주지 않는다)
     ② 줄마다 «제목 + 날짜»를 뽑는다(parseRows — 표 <tr> 나 목록 <li> 한 줄)
     ③ 사람을 뽑는 글만 남긴다(isRecruit — 「컨설턴트·전문가·위원 + 모집」, 「결과」는 뺀다)
     ④ 처음 보는 글만 hits 에 더한다(열쇠 = 게시판 + 제목 + 날짜). 있던 글은 건드리지 않는다.

   ⚠ 게시판 주소는 2026-10-04 에 «실제로 줄이 뽑히는 것을 잰» 곳만 넣었다(11곳 → 15곳).
     더한 넷(semas·cepa·sinbo·keli)도 이 파일의 parseRows·isRecruit 로 직접 재어 보았다 —
     충남경제진흥원 「산업·일자리전환 지원센터 컨설턴트 추가 모집」·소진공 「비상임이사 모집」을 잡는다.
     나머지 기관은 첫 화면이 프로그램으로 그려져 이 방법으로 안 읽힌다 —
     화면은 그 기관을 「손으로 확인」으로 밝힌다. 주소를 지어 넣지 말 것.
   ⚠ 이 파일은 공개 저장소다. 대표님의 «지원 이력»은 여기 없다(기관 게시판 주소뿐).
   ⚠ 읽기만 한다 — 기관 누리집에 아무것도 보내지 않는다(로그인·신청 없음). */
'use strict';

const UA = 'Mozilla/5.0 (compatible; pureun-recruit-watch/1.0)';

/* ── 중간 인증서를 «빠뜨리고» 보내는 기관 서버 (2026-10-10 원인 확정) ──
   지방공기업평가원(www.erc.re.kr)은 10-05부터 서버에서만 날마다 실패했다. 까닭 = UNABLE_TO_VERIFY_LEAF_SIGNATURE.
   openssl 실측: 사이트 인증서(*.erc.re.kr) 다음에 중간 인증서 「Sectigo Public Server Authentication CA DV R36」 을 빼고
   뿌리(R46)만 보낸다. 브라우저·윈도는 알아서 받아 채우지만 서버(Node)는 채우지 않고 거절한다.
   → 그 중간 인증서를 «더해서» 검증한다. ⚠ 검증을 끄는 것(rejectUnauthorized:false)이 아니다 — 끄면 가짜 서버도 통과한다.
   출처: 사이트 인증서의 AIA 주소 http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt (공개 자료)
   확인: 사이트 인증서가 이것으로 서명됐고, 이것은 Node 기본 뿌리 「Sectigo … Root R46」 으로 서명됐다. 2036-03-21 까지.
   sha256 8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0 */
const EXTRA_CA = [
  '-----BEGIN CERTIFICATE-----\n' +
  'MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf\n' +
  'MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD\n' +
  'Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw\n' +
  'HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY\n' +
  'MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp\n' +
  'YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B\n' +
  'AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq\n' +
  'RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH\n' +
  '12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja\n' +
  'EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm\n' +
  'M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv\n' +
  '38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB\n' +
  'pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn\n' +
  '2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN\n' +
  'xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk\n' +
  'lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw\n' +
  'DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI\n' +
  'KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw\n' +
  'VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv\n' +
  'UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH\n' +
  'AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp\n' +
  'Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF\n' +
  'BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA\n' +
  'YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8\n' +
  'ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d\n' +
  'q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF\n' +
  'h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH\n' +
  '5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD\n' +
  '4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd\n' +
  'unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536\n' +
  'WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l\n' +
  '7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW\n' +
  'r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh\n' +
  'JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=\n' +
  '-----END CERTIFICATE-----\n'
];
/* 기본 뿌리 + 위의 중간 인증서 — node https 의 ca 에 넘긴다(ca 를 주면 기본 뿌리를 «대신»하므로 둘 다 넣는다) */
function caList() { return require('tls').rootCertificates.concat(EXTRA_CA); }
const MAX_KEEP = 300;           // hits 에 남기는 글 상한 (오래된 것부터 뺀다)
const MAX_AGE_DAYS = 120;       // 이보다 오래된 글은 처음 봐도 안 남긴다(첫날 과거 글 쏟아짐 방지)

/* org 는 js/gov-recruit.js 의 기관 번호와 같다 — 화면이 그 줄에 「🆕」를 붙인다 */
const BOARDS = [
  /* js — 목록 링크가 프로그램(javascript)인 게시판: 그 안의 글 번호로 «본문 주소»를 만든다(GET 으로 열리는 것을 2026-10-05 확인).
     본문이 있어야 접수 기간을 읽는다. ⚠ 열쇠(keyOf)는 주소와 무관하다 — 옛 글이 두 번 들어오지 않는다. */
  { id: 'erc',     org: 'erc',     name: '지방공기업평가원 공지',     url: 'https://www.erc.re.kr/usr/com/prm/BBSList.do?bbsId=BBSMSTR_000000000251&menuNo=3000&upperMenuId=3',
    js: { re: /fn_detail\(\s*'(\d+)'/, url: 'https://www.erc.re.kr/usr/com/prm/BBSDetail.do?bbsId=BBSMSTR_000000000251&nttId={id}&menuNo=3000&upperMenuId=3&bbsTyCode=BBST11&bbsAttrbCode=BBSA01&authFlag=Y&pageIndex=1' } },
  { id: 'seosan',  org: 'seosan',  name: '서산시 공지사항',           url: 'https://www.seosan.go.kr/www/selectBbsNttList.do?bbsNo=97&key=1256' },
  { id: 'kordi',   org: 'kordi',   name: '한국노인인력개발원 알림',   url: 'https://www.kordi.or.kr/content.do?cmsId=91' },
  { id: 'agri6',   org: 'agri6',   name: '농촌융복합(6차산업) 공지',  url: 'https://xn--980b99s59h34f6tl.com/home/board/B0030.cs?m=24' },
  { id: 'lh',      org: 'lh',      name: 'LH 공지·공모',              url: 'https://www.lh.or.kr/menu.es?mid=a10601010000' },
  { id: 'tp',      org: 'tp',      name: '충남테크노파크 알림',       url: 'https://www.ctp.or.kr/community/notice.do' },
  { id: 'hrdk',    org: 'hrdk',    name: 'HRD 전문가 인력풀 신청공고', url: 'https://www.hrd4u.or.kr/expertpool/application/notice/list.do' },
  { id: 'family',  org: 'family',  name: '가족친화 지원사업 알림',    url: 'https://www.ffsb.kr/ffsbbod/bs/boardList.do?boardSeq=1&menuSeq=5190' },
  { id: 'kfcc',    org: 'kfcc',    name: '새마을금고 MG공지',         url: 'https://www.kfcc.co.kr/mgNotice/mgNoticeList.do' },
  { id: 'voucher', org: 'voucher', name: '데이터산업진흥원 알림',     url: 'https://kdata.or.kr/kr/board/notice_01/boardList.do' },
  { id: 'nrc',     org: 'nrc',     name: '경제·인문사회연구회 공지',  url: 'https://www.nrc.re.kr/board.es?mid=a12101000000&bid=0001' },
  { id: 'semas',   org: 'semas',   name: '소상공인시장진흥공단 공지', url: 'https://www.semas.or.kr/web/board/webBoardList.kmdc?bCd=1&pNm=BOA0101',
    js: { re: /fncGoDetail\(\s*'(\d+)'/, url: 'https://www.semas.or.kr/web/board/webBoardView.kmdc?bCd=1&b_idx={id}&pNm=BOA0101' } },
  { id: 'cepa',    org: 'cepa',    name: '충남경제진흥원 공지',       url: 'https://www.cepa.or.kr/notice/notice.do?pm=6&ms=32' },
  /* 목록 머리에 오래된 «고정 공지»가 먼저 온다 — 새 글은 그 아래에 있다(그래도 첫 쪽 안이다) */
  { id: 'sinbo',   org: 'sinbo',   name: '충남신용보증재단 공지',     url: 'https://www.cnsinbo.co.kr/boardCnts/list.do?boardID=134&m=030101&s=cnsinbo' },
  { id: 'keli',    org: 'keli',    name: '한국고용노동교육원 공지',   url: 'https://www.keli.kr/home/cmmn/bbs/228/list.do' },
  /* 노사발전재단 — 사업공고/모집 목록은 화면 안 «틀(iframe)» 이 따로 불러온다. 서버는 그 틀 주소를 읽고,
     사람은 바깥 화면(page)으로 보낸다(틀 주소만 열면 머리·메뉴 없는 맨 목록이 뜬다). */
  { id: 'nosa',    org: 'nosa',    name: '노사발전재단 사업공고/모집', url: 'https://www.nosa.or.kr/board/bltnMngr?boardId=nosa05&',
    page: 'https://www.nosa.or.kr/portal/nosa/FoundNews/bizNotice' },
  /* ★ 공인노무사회 일반 공지 — 노사발전재단 컨설턴트 모집(일터혁신·공무직·공공부문 고용개선·고용구조개선·
     노동전환)은 재단 게시판이 아니라 «공문»으로 와서 여기 실린다(대표님 서류 폴더의 공문0157·0229 가 그것).
     실측 2026-10-04: 2015~2026 150건 중 사람 뽑는 글 37건. ⚠ 회원 공지(/bbs/news)는 로그인이 있어야 해 안 읽는다.
     ⚠ 여러 기관 글이 섞인 게시판이라 org 를 비우고 제목으로 정한다(ORG_HINTS). */
  { id: 'kcplaa',  org: '',        name: '공인노무사회 공지(기관 모집 공문)', url: 'https://www.kcplaa.or.kr/bbs/notice/list', ai: true },
  /* ★ 공인노무사회 «회원» 공지 — 로그인해야 보인다(대표 지시 2026-10-04 「회원 공지 진행」).
     2024년 3월 뒤 일반 공지에 모집 공문이 뜸해져, 회원 공지로 옮겼는지 보려고 더했다.
     ⚠ 로그인은 뉴스레터가 쓰는 서버 비밀값(ILABOR_ID·ILABOR_PW)을 빌린다 — 코드는 값을 못 본다.
     ⚠ login 이 붙은 게시판은 부르는 쪽이 «로그인한 그릇»으로 읽는다(makeFetcher). 로그인이 안 되면
       이 게시판만 오류로 남기고 나머지는 그대로 돈다. */
  { id: 'kcplaa_m', org: '',      name: '공인노무사회 회원 공지(로그인)', url: 'https://www.kcplaa.or.kr/bbs/news/list', login: 'kcplaa', ai: true },
  /* ★ 공인노무사회 «채용 정보» (대표 지시 2026-10-04 「공인노무사회에서 컨설턴트 모집 또는 고문 자문 노무사 모집등 공고도 수집」)
     로그인 없이 읽힌다. 기관이 노무사에게 «맡기는» 글(외부 조사자 선임·고문·자문)이 여기에도 올라온다.
     ⚠ 대부분은 노무법인의 직원·수습 채용이라 일반 잣대(isRecruit)를 쓰면 「노무사 모집」이 다 걸린다 —
       그래서 전용 잣대(rule:'kcplaa' → isKcplaa)를 쓴다. 실측: 「직장 내 괴롭힘 사건 외부 조사자 선임 공고」를 잡고
       노무법인 채용 10여 건을 거른다. */
  { id: 'kcplaa_job', org: 'kcplaa', name: '공인노무사회 채용 정보', url: 'https://www.kcplaa.or.kr/worker/list?scd=1', rule: 'kcplaa' }
];

/* 여러 기관 글이 섞인 게시판(org 가 빈 것)에서 제목으로 기관을 정한다.
   ⚠ 찾는 말은 js/gov-recruit.js 의 같은 기관과 «글자 하나까지» 같아야 한다 — 다르면 화면의 🆕 가 엉뚱한 줄에 붙는다.
     functions/recruit-watch.test.js 가 두 쪽 source 를 맞대 본다. 기관을 더할 때도 거기서 그대로 옮긴다. */
const ORG_HINTS = [
  ['nosa', /노사발전|고용구조개선|일터혁신|근무혁신|공무직\s*노사|공공부문\s*고용개선|노사협의회\s*구축|고용차별/],
  ['hrdk', /NCS|공정채용|산업인력공단|HRD\s*전문가/]
];
function orgHint(title) {
  const t = String(title || '');
  for (const [id, re] of ORG_HINTS) if (re.test(t)) return id;
  return '';
}

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
const DATE = /(20\d{2})\s?[.\-\/년]\s?(\d{1,2})\s?[.\-\/월]\s?(\d{1,2})/;
function pad(n) { return String(n).padStart(2, '0'); }
const FILE_NAME = /\.(pdf|hwpx?|xlsx?|docx?|pptx?|jpe?g|png|gif|zip)\s*$/i;
const FILE_LINK = /href\s*=\s*["'][^"']*(?:cmd=down|filedown|fileMngr|download)/i;
/* ⚠ 제목 앞뒤에 «잠깐 붙는 딱지»는 뗀다 — 「새글」(LH)·「[모집중]」(신보)·「NEW」는 며칠 뒤 사라지거나 바뀐다.
     제목이 글의 열쇠(keyOf)에 들어가므로, 떼지 않으면 딱지가 바뀔 때 같은 글이 «새 글»로 또 들어온다. */
function stripTag(t) {
  let x = String(t || ''), prev;
  do {
    prev = x;
    x = x.replace(/^(?:새\s*글|NEW|HOT|N)\s+/i, '')
      .replace(/^\[(?:모집\s*중|모집\s*마감|마감|접수\s*중|진행\s*중|종료|공지)\]\s*/, '')
      .replace(/\s+(?:NEW|N|새\s*글)$/i, '')
      .replace(/\s*[\[(](?:모집\s*중|모집\s*마감|마감|접수\s*중|진행\s*중|종료)[\])]$/, '').trim();
  } while (x !== prev);
  return x;
}

/* 목록 한 쪽 → [{title, date:'YYYY-MM-DD', href}]
   ⚠ 줄 = 표 한 줄(<tr>) 또는 목록 한 칸(<li>). 날짜가 없는 줄(머리줄·메뉴)은 버린다.
   ⚠ 제목 = 그 줄 안 링크 글자 중 «가장 긴 것» — 번호·첨부 아이콘 링크를 피한다.
   ⚠ href 가 javascript: 이면 비운다(서버가 열 주소가 아니다 — 화면은 게시판 주소로 보낸다). */
function parseRows(html, base, board) {
  const out = [], seen = {};
  const blocks = String(html || '').match(/<tr[\s>][\s\S]*?<\/tr>|<li[\s>][\s\S]*?<\/li>/gi) || [];
  blocks.forEach((b) => {
    const d = DATE.exec(clean(b)); if (!d) return;
    const mo = +d[2], da = +d[3]; if (mo < 1 || mo > 12 || da < 1 || da > 31) return;
    /* ⚠ 첨부 파일 링크는 제목이 아니다 — 노사발전재단은 줄마다 첨부 목록이 붙고 그 이름이 제목보다 길다
       (실측: 제목 대신 「붙임. …명단.xlsx」를 잡았다). 파일이 아닌 링크가 «하나도 없을 때만» 파일 이름을 쓴다. */
    let best = null, bestFile = null;
    for (const m of b.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const t = stripTag(clean(m[2]).replace(/^제목\s+/, ''));
      if (t.length < 6 || t.length > 160) continue;
      const file = FILE_NAME.test(t) || FILE_LINK.test(m[1]);
      if (file) { if (!bestFile || t.length > bestFile.t.length) bestFile = { t, attrs: m[1] }; continue; }
      if (!best || t.length > best.t.length) best = { t, attrs: m[1] };
    }
    best = best || bestFile;
    if (!best) return;
    let href = '';
    const h = /href\s*=\s*["']([^"']*)["']/i.exec(best.attrs);
    if (h && h[1] && !/^\s*(javascript:|#)/i.test(h[1])) { try { href = new URL(h[1].replace(/&amp;/g, '&'), base).href; } catch (e) { href = ''; } }
    if (!href && board && board.js) { const j = board.js.re.exec(best.attrs); if (j) href = board.js.url.replace('{id}', j[1]); }
    const date = d[1] + '-' + pad(mo) + '-' + pad(da);
    const k = best.t + '|' + date; if (seen[k]) return; seen[k] = 1;
    out.push({ title: best.t, date, href });
  });
  return out;
}

/* 사람을 뽑는 글인가 — «누구를»(컨설턴트·전문가·위원…) + «뽑는다»(모집·공모·위촉…) 둘 다 있어야 한다.
   ⚠ 「입주기업 모집」·「행복주택 모집」·「공모전」은 사람을 뽑는 글이 아니다(실측 잡음).
   ⚠ 「결과·명단·합격·개최」는 이미 끝난 글이다 — 「원장후보자심사위원회 개최결과」(실측)를 거른다. */
/* ⚠ 「이사」는 «위촉직·비상임·사외» 이사만 — 맨 「이사」는 「이사회」·「이사장」까지 걸린다.
     대표님은 진흥원·사회서비스원 이사에도 지원하셨다(실측: 「위촉직이사 모집 공고」를 놓쳤었다). */
const WHO = /컨설턴트|전문가|전문위원|자문위원|평가위원|심사위원|외부위원|운영위원|조정위원|인력\s*풀|인력풀|\bpool\b|강사|멘토|현장\s*코치|코칭|외부\s*연구진|연구진|자문단|지원단|상담위원|노무사|위촉직\s*이사|비상임\s*이사|사외\s*이사|임원/i;
const PICK = /모집|공모|선발|위촉|등록|구성|신청|추천|초빙/;
/* ⚠ 「규정 개정 안내」 — 「등록심사위원회」의 «심사위원»·«등록»이 걸려 모집 글로 들어왔다(2026-10-09 실측) */
const DONE = /결과|명단|합격|발표|개최|선정\s*안내|최종\s*선정|공모전|규정\s*개정|개정\s*안내/;
/* ⚠ 배우러 오는 사람·자리 채우는 사람을 모으는 글 — 공인노무사회 공지에 많다(실측: 「고용노사관계 전문가과정
     교육생 모집」·「국제심포지엄 참가신청」·「위험성평가 컨설팅 전문가과정 강좌 신청 독려」). */
const LEARN = /교육생|수강생|참가\s*신청|참석자|심포지엄|세미나|강좌|양성\s*과정|전문가\s*과정|기본\s*과정|시상|자격증|서식/;
function isRecruit(title) {
  const t = String(title || '');
  return WHO.test(t) && PICK.test(t) && !DONE.test(t) && !LEARN.test(t);
}

/* 공인노무사회 «채용 정보» 잣대 — 노무사에게 «맡기는» 글만(고문·자문·위원·외부 조사자·컨설턴트·강사).
   ⚠ 노무법인·사무소의 직원·수습 채용, 공무원 채용시험(임기제·경력경쟁)은 뺀다 — 대표 법인이 «뽑히는» 쪽이 아니다. */
const KC_WHO = /고문|자문|외부\s*조사|조사자|조사위원|위원|컨설턴트|전문가|강사|인력\s*풀|\bpool\b|멘토|코치|지원단|자문단/i;
const KC_PICK = /모집|선임|위촉|추천|공모|초빙|구함|모십니다|구인/;
const KC_NOT = /노무법인|노무사무소|법률사무소|노동법률|인사노무컨설팅|수습|직원|직무보조|채용시험|경력경쟁|임기제|결과|명단|개최|교육\s*안내/;
function isKcplaa(title) {
  const t = String(title || '');
  return KC_WHO.test(t) && KC_PICK.test(t) && !KC_NOT.test(t);
}
/* 지금 잣대가 «일부러 빼는» 말이 든 제목 — 이미 들어온 글을 지울 때만 쓴다.
   ⚠ 「안 맞는 것」 전부가 아니라 «빼는 말»에 걸린 것만 — 찾는 말(WHO·PICK)이 바뀌었다고 옛 글을 통째로 지우지 않는다. */
function noise(board, title) { const t = String(title || ''); return board && board.rule === 'kcplaa' ? KC_NOT.test(t) : (DONE.test(t) || LEARN.test(t)); }
/* 게시판마다 잣대를 고른다 — rule 이 없으면 일반 잣대 */
function pass(board, title) { return board && board.rule === 'kcplaa' ? isKcplaa(title) : isRecruit(title); }

function keyOf(board, row) {
  /* RTDB 열쇠에 못 쓰는 글자를 피한다 — 짧은 지문으로 */
  const s = board + '|' + row.title + '|' + row.date;
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return board + '_' + row.date.replace(/-/g, '') + '_' + h.toString(36);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

/* ── 접수 기간 읽기 (대표 지시 2026-10-05 「서류에 기간이 있다 — 날짜가 지났는지 반드시 표시」) ──
   text: 공고 본문(또는 제목·메일 제목), post: 'YYYY-MM-DD'(올린 날 — 해가 빠진 날짜의 해를 정한다)
   → { from, to, rolling } 또는 null(못 찾음).
   ⚠ 「접수·신청·모집·제출·응모·공모·추천·원서」 + 「기간·기한·마감·일정·일시」 라벨 뒤만 본다 —
     본문의 사업기간·위촉기간·임기·교육기간을 마감으로 읽으면 «지났다/안 지났다»가 거짓이 된다.
   ⚠ 라벨이 없을 때 「~03.27 까지」 꼴은 «짧은 글»(제목·메일 제목, 200자 이하)에서만 — 긴 본문에서는 엉뚱한 날짜가 걸린다.
   ⚠ 「채용 시 마감·수시·상시·ASAP·선착순」은 rolling(사람이 정해지면 끝) — 날짜를 지어내지 않는다.
   ⚠ 이 함수는 서버(functions/recruit-watch.js)와 화면(js/gov-recruit.js)에 «글자까지 같이» 있다 — 검사가 맞댄다. */
var PER_D = '(?:(20\\d{2})\\s*[.\\-\\/년]\\s*)?(\\d{1,2})\\s*[.\\-\\/월]\\s*(\\d{1,2})\\s*일?\\.?(?:\\s*\\(\\s*[월화수목금토일]\\s*\\))?(?:\\s*\\d{1,2}\\s*[:시]\\s*\\d{0,2}\\s*분?)?';
var PER_LABEL = /(?:접수|신청|모집|제출|응모|공모|추천|원서)\s*(?:기간|기한|마감일?|일정|일시)/g;
var PER_RANGE = new RegExp(PER_D + '\\s*(?:[~∼～〜]|\\s-\\s|부터)\\s*' + PER_D);
var PER_ONE = new RegExp(PER_D);
var PER_ROLL = /^[\s:：\-]*(?:채용\s*시|수시|상시|ASAP|선착순|소진\s*시|충원\s*시)/i;
var PER_NOT = /(?:사업|위촉|활동|계약|운영|교육|임기|근무|과업|용역|행사)\s*(?:기간|일정)[^가-힣]{0,20}$/;
var PER_SHORT = new RegExp('[~∼～〜]\\s*' + PER_D + '|' + PER_D + '\\s*까지');
var PER_UNTIL = new RegExp(PER_D + '\\s*까지[\\s\\S]{0,40}?(?:제출|신청|접수|회신|추천|송부|발송|응모|보내)');
function perPad(n) { return (n < 10 ? '0' : '') + n; }
function perDay(y, m, d) {
  m = Number(m); d = Number(d);
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31) || !y) return '';
  return y + '-' + perPad(m) + '-' + perPad(d);
}
function perShift(ymd, post) {   /* 해가 없던 날짜 — 올린 날보다 한참 앞이면 다음 해 */
  if (!ymd || !post) return ymd;
  return (Date.parse(ymd) < Date.parse(post) - 31 * 864e5) ? (Number(ymd.slice(0, 4)) + 1) + ymd.slice(4) : ymd;
}
function periodOf(text, post) {
  var t = String(text == null ? '' : text).replace(/\s+/g, ' ');
  post = /^\d{4}-\d{2}-\d{2}$/.test(String(post || '')) ? String(post) : '';
  var baseY = post ? Number(post.slice(0, 4)) : 0, m, win;
  PER_LABEL.lastIndex = 0;
  while ((m = PER_LABEL.exec(t))) {
    win = t.slice(m.index + m[0].length, m.index + m[0].length + 90);
    if (PER_ROLL.test(win)) return { from: '', to: '', rolling: true };
    var r = win.match(PER_RANGE);
    if (r && r.index < 25) {
      var fy = r[1] ? Number(r[1]) : baseY, from = perDay(fy, r[2], r[3]);
      var ty = r[4] ? Number(r[4]) : fy, to = perDay(ty, r[5], r[6]);
      if (!r[1]) from = perShift(from, post);
      if (from && to && to < from && !r[4]) to = (Number(to.slice(0, 4)) + 1) + to.slice(4);
      if (to) return { from: from, to: to, rolling: false };
    }
    var one = win.match(PER_ONE);
    if (one && one.index < 25) {
      var d1 = perDay(one[1] ? Number(one[1]) : baseY, one[2], one[3]);
      if (!one[1]) d1 = perShift(d1, post);
      if (d1) return { from: '', to: d1, rolling: false };
    }
  }
  if (t.length <= 200) {
    var s = t.match(PER_SHORT);
    if (s && !PER_NOT.test(t.slice(Math.max(0, s.index - 30), s.index))) {
      var y = s[1] || s[4], mo = s[2] || s[5], da = s[3] || s[6];
      var d2 = perDay(y ? Number(y) : baseY, mo, da);
      if (!y) d2 = perShift(d2, post);
      if (d2) return { from: '', to: d2, rolling: false };
    }
  }
  /* 라벨 없이 「2026. 10. 15.(수)까지 이메일로 제출」 — 공문 문장 꼴. ⚠ 「까지」 뒤 40자 안에 «내는» 말이 있어야 한다 */
  var u = t.match(PER_UNTIL);
  if (u && !PER_NOT.test(t.slice(Math.max(0, u.index - 30), u.index))) {
    var d3 = perDay(u[1] ? Number(u[1]) : baseY, u[2], u[3]);
    if (!u[1]) d3 = perShift(d3, post);
    if (d3) return { from: '', to: d3, rolling: false };
  }
  return null;
}

/* 본문을 열어 볼 수 있는 글인가 — 목록 주소로 돌려 둔 글(javascript 링크였던 것)은 본문이 없다 */
/* ── 필요서류 읽기 (대표 지시 2026-10-05 「필요서류 ↔ 갖고 있는 서류」, 설계 3절) ──
   본문의 「제출서류·구비서류·신청서류·접수서류·응모서류·필요서류」 단락에서 서류 종류를 뽑는다 → ['apply','resume',…] 또는 null(단락 없음).
   ⚠ 종류 낱말은 화면 js/gov-submit.js 의 KINDS 와 «글자까지 같다» — 검사가 맞댄다(내기 전 점검과 같은 말을 써야 서로 견준다).
   ⚠ 단락은 다음 단락(접수 방법·기간·선정 절차·문의·유의 사항 …)이나 □ 에서 끊는다 — 뒤의 개인정보 안내 글을 «동의서»로 읽지 않게. */
const DOC_KINDS = [
  { k: 'consent', re: /개인\s*정보[\s\S]{0,12}(?:동의|수집|이용)|동의서/ },
  { k: 'apply',   re: /지원\s*서|신청\s*서|응모\s*서|참가\s*신청/ },
  { k: 'career',  re: /경력\s*증명|재직\s*증명|경력\s*확인/ },
  { k: 'resume',  re: /이력\s*서|프로필|profile|경력\s*기술/i },
  { k: 'license', re: /자격\s*증|자격\s*수첩|노무사\s*등록|합격\s*증|등록\s*증/ },
  { k: 'perf',    re: /실적\s*증명|수행\s*실적|참여\s*확인|실적\s*확인/ },
  { k: 'degree',  re: /졸업\s*증명|학위\s*증명|학위\s*기/ },
  { k: 'biz',     re: /사업자\s*등록/ },
  { k: 'plan',    re: /계획\s*서|제안\s*서/ }
];
const DOC_LABEL = /(?:제출|구비|신청|접수|응모|필요|증빙)\s*서류/g;
const DOC_END = /□|■|(?:접수|제출|신청)\s*(?:방법|기간|기한|처|장소)|선정\s*(?:방법|절차|기준)|심사\s*(?:방법|기준)|평가\s*(?:방법|기준)|문의\s*처?|유의\s*사항|기타\s*사항|붙임|첨부\s*파일/;
function docsOf(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ');
  const out = []; let m, found = false;
  DOC_LABEL.lastIndex = 0;
  while ((m = DOC_LABEL.exec(t))) {
    found = true;
    let win = t.slice(m.index + m[0].length, m.index + m[0].length + 500);
    const e = DOC_END.exec(win.slice(5));   // 라벨 바로 뒤 몇 글자는 건너뛴다(「제출서류 및 제출방법」 같은 제목 줄)
    if (e) win = win.slice(0, e.index + 5);
    DOC_KINDS.forEach((d) => { if (d.re.test(win) && out.indexOf(d.k) < 0) out.push(d.k); });
  }
  if (!found) return null;
  return DOC_KINDS.map((d) => d.k).filter((k) => out.indexOf(k) >= 0);   // 차례는 KINDS 차례로
}

/* 본문에 «제출서류» 단락이 없을 때 — 첨부 파일 «이름»에서 낼 서식을 읽는다(2026-10-05 실측: 충남경제진흥원은
   본문엔 단락이 없고 첨부에 「신청서 및 개인정보 수집·이용 동의서.hwp」가 있다).
   ⚠ 공고문 자체(공고·안내·모집공고·요강)는 낼 서식이 아니다 — 그 이름의 파일은 건너뛴다. 파일 이름(확장자 있는 것)만 본다. */
const ATTACH = /첨부(?:\s*파일)?\s*[|:：]/;
const FILE_RE = /[^|,]{2,120}?\.(?:hwpx?|docx?|pdf|xlsx?|zip)/gi;   // ⚠ 「·」로 끊지 않는다 — 제목 안에 「산업·일자리」가 있다
function docsFromAttach(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ');
  const m = ATTACH.exec(t); if (!m) return [];
  const win = t.slice(m.index + m[0].length, m.index + m[0].length + 600);
  const out = [];
  (win.match(FILE_RE) || []).forEach((f) => {
    if (/공고|안내|요강|공문|결과/.test(f) && !/신청서|지원서|동의서|이력서|계획서|증명/.test(f)) return;
    DOC_KINDS.forEach((d) => { if (d.re.test(f) && out.indexOf(d.k) < 0) out.push(d.k); });
  });
  return DOC_KINDS.map((d) => d.k).filter((k) => out.indexOf(k) >= 0);
}

/* ── 공문이 «그림»인 게시판 — AI 로 마감일을 짚는다 (대표 지시 2026-10-09 「진행해라」) ──
   공인노무사회 공지(일반·회원)는 본문이 공문 사진(jpg)이고 내용은 압축 첨부에 있다 — 글자 규칙(periodOf)이 읽을 글이 없다.
   실측 2026-10-09: 회원 공지 11건이 모두 「기간 모름」 · 일반 공지 본문 = <img> 둘 + .zip 하나.
   ⚠ ai 가 붙은 게시판만 · 글자 규칙이 못 찾았을 때만 · 하루 LIMITS.aiMax 건까지 — AI 는 돈이 든다.
   ⚠ AI 는 «날짜를 짚기만» 한다. 받은 답은 aiPerOf 가 걸러서(꼴·올린 날 앞뒤) 맞지 않으면 버린다 — 지어낸 날짜를 마감으로 쓰지 않는다.
   ⚠ 한 번 물어본 글은 per.aiTried 를 남겨 날마다 다시 묻지 않는다(답을 못 받은 날 — 한도·고장 — 은 남기지 않아 다음 날 다시). */
const IMG_MAX = 3, IMG_BYTES = 3 * 1024 * 1024;
function imagesOf(html, base) {
  const s = String(html || ''), out = [];
  const i = s.search(/id\s*=\s*["']editor["']|class\s*=\s*["'][^"']*txt-box/i);
  if (i < 0) return out;
  let host = ''; try { host = new URL(base).host; } catch (_) { return out; }
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi, part = s.slice(i, i + 20000); let m;
  while ((m = re.exec(part)) && out.length < IMG_MAX) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), base); } catch (_) { continue; }
    if (u.protocol !== 'https:' || u.host !== host) continue;   // ⚠ 남의 서버 그림은 안 받는다
    if (!/\.(jpe?g|png|gif|webp)$/i.test(u.pathname)) continue;
    if (out.indexOf(u.href) < 0) out.push(u.href);
  }
  return out;
}
function mimeOf(u) { return /\.png$/i.test(u) ? 'image/png' : /\.gif$/i.test(u) ? 'image/gif' : /\.webp$/i.test(u) ? 'image/webp' : 'image/jpeg'; }
/* 화면 머리(메뉴)는 빼고 제목부터 3,000자 */
function bodyOf(txt, title) {
  const t = String(txt || ''), k = String(title || '').slice(0, 12);
  const i = k ? Math.max(0, t.indexOf(k)) : 0;
  return t.slice(i, i + 3000);
}
function aiAsk(title, post, text) {
  return '아래는 공고 게시글(제목·본문·공문 사진)입니다. 이 공고의 «접수·신청·추천·제출 마감일»만 찾아 주세요.\n' +
    '사업 기간·위촉 기간·임기·교육 일정·행사 날짜는 마감이 아닙니다. 마감일이 없으면 지어내지 말고 to 를 비우세요.\n' +
    '「수시·상시·채용 시 마감·선착순」이면 rolling 을 true 로 하세요.\n' +
    '답은 JSON 한 줄만: {"from":"YYYY-MM-DD 또는 빈칸","to":"YYYY-MM-DD 또는 빈칸","rolling":false}\n' +
    '제목: ' + String(title || '') + '\n올린 날: ' + String(post || '') + '\n본문:\n' + String(text || '').slice(0, 3000);
}
function aiDay(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z')) &&
    new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
}
function aiPerOf(reply, post) {
  const j = String(reply == null ? '' : reply).match(/\{[\s\S]*?\}/); if (!j) return null;
  let o; try { o = JSON.parse(j[0]); } catch (_) { return null; }
  if (!o || typeof o !== 'object') return null;
  if (o.rolling === true && !o.to) return { from: '', to: '', rolling: true, by: 'ai' };
  if (!aiDay(o.to)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(post || ''))) {
    const gap = daysBetween(post, o.to);
    if (gap < -7 || gap > 180) return null;   // ⚠ 올린 날보다 한참 앞이거나 반년 넘게 뒤 — 마감이 아닌 날짜를 짚었다
  }
  return { from: aiDay(o.from) && o.from <= o.to ? o.from : '', to: o.to, rolling: false, by: 'ai' };
}

function hasDetail(h, b) {
  const u = String(h && h.href || '');
  return /^https:\/\//.test(u) && !!b && u !== b.url && u !== b.page;
}

/* 시간 셈 — 서버는 5분(300초)에 끊긴다. 끊기면 «그날 읽은 것을 하나도 못 남긴다»(쓰기가 맨 끝에 있다).
   ⚠ 그래서 ①몇 곳씩 함께 읽고 ②한 게시판이 오래 붙잡지 못하게 하고 ③전체 마감을 넘기면 남은 곳은
     «못 읽음»으로 적고 끝낸다 — 읽은 만큼은 반드시 남는다(검토 2026-10-04). */
const LIMITS = { together: 4, boardMs: 45000, totalMs: 200000, detailMs: 20000, detailMax: 14, aiMax: 6, aiMs: 40000, aiAgeDays: 60 };
function 늦으면(ms, why) {
  let t; const p = new Promise((_, no) => { t = setTimeout(() => no(new Error(why)), Math.max(0, ms)); });
  return { p, stop: () => clearTimeout(t) };
}

/* 한 번 돈다. fetchText(url, board) → Promise<string>. 네트워크는 부르는 쪽이 준다(검사에선 가짜) */
async function run(o) {
  const boards = o.boards || BOARDS, have = o.existing || {}, today = o.today, nowIso = o.nowIso || '';
  const now = o.now || Date.now, t0 = now();
  const together = Math.max(1, o.together || LIMITS.together);
  const boardMs = o.boardMs || LIMITS.boardMs, totalMs = o.totalMs || LIMITS.totalMs;
  const per = boards.map(() => ({ hits: [], error: null, count: undefined }));
  let next = 0;
  async function 일꾼() {
    while (next < boards.length) {
      const i = next++;
      const left = totalMs - (now() - t0);
      if (left <= 0) { per[i].error = '시간이 모자라 이번엔 못 읽었습니다(다음 날 다시 읽습니다)'; continue; }
      const 시계 = 늦으면(Math.min(boardMs, left), Math.min(boardMs, left) >= boardMs
        ? '너무 오래 걸려 그만 읽었습니다(' + Math.round(boardMs / 1000) + '초)'
        : '시간이 모자라 중간에 그만 읽었습니다');
      /* ⚠ 결과는 «제때 끝났을 때만» 받아 담는다 — 시간이 지나 그만둔 게시판이 나중에 끝나도 아무 데도 못 쓴다 */
      try { per[i] = await Promise.race([한곳(boards[i]), 시계.p]); }
      catch (e) { per[i] = { hits: [], error: String(e && e.message || e).slice(0, 120), count: undefined }; }
      finally { 시계.stop(); }
    }
  }
  async function 한곳(b) {
    const out = { hits: [], error: null, count: undefined, fix: {} };
    {
      const html = await o.fetchText(b.url, b);
      const rows = parseRows(html, b.url, b);
      out.count = rows.length;
      if (!rows.length) { out.error = '줄을 하나도 못 뽑았습니다(게시판 모양이 바뀌었을 수 있음)'; return out; }
      rows.forEach((r) => {
        if (!pass(b, r.title)) return;
        if (today && daysBetween(r.date, today) > MAX_AGE_DAYS) return;
        const key = keyOf(b.id, r);
        if (have[key]) {
          if (r.href && r.href !== have[key].href && !hasDetail(have[key], b) && hasDetail({ href: r.href }, b)) out.fix[key] = r.href;
          return;
        }
        const h = { key, board: b.id, org: b.org || orgHint(r.title), boardName: b.name, title: r.title, date: r.date,
          href: r.href || b.page || b.url, at: nowIso };
        const tp = periodOf(r.title, r.date);   // 제목에 「~03.27까지」가 있으면 우선 그것(본문을 열면 덮는다)
        if (tp) h.per = tp;
        out.hits.push(h);
      });
    }
    return out;
  }
  await Promise.all(Array.from({ length: Math.min(together, boards.length) }, 일꾼));
  /* ⚠ 모으는 차례는 «게시판 차례» 그대로 — 함께 읽어도 결과가 날마다 같아야 한다 */
  const hits = [], errors = [], counts = {}, fixes = {};
  boards.forEach((b, i) => {
    Object.assign(fixes, per[i].fix || {});
    if (per[i].count !== undefined) counts[b.id] = per[i].count;
    /* 이름·주소도 함께 — 화면이 「어느 게시판을 직접 열어야 하나」를 말할 수 있게 */
    if (per[i].error) errors.push({ board: b.id, why: per[i].error, name: b.name || b.id, url: b.page || b.url });
    else per[i].hits.forEach((h) => hits.push(h));   // (오류 난 곳은 글이 비어 있지만 한 번 더 막아 둔다)
  });
  /* ── 본문 열어 «접수 기간» 붙이기 (대표 지시 2026-10-05 「기간 표시해서 날짜가 지났는지 반드시」) ──
     ⚠ o.details 일 때만(서버가 켠다) · 새 글 먼저, 남는 자리에 «아직 기간을 안 본» 옛 글을 하루 몇 건씩 메운다.
     ⚠ 목록 시간 셈과 같은 전체 마감 안에서만 — 남은 시간이 없으면 그만둔다(다음 날 다시).
     ⚠ 본문에서 못 찾으면 { none: true } 를 남겨 날마다 다시 열지 않는다(제목에서 찾은 것은 그대로 둔다). */
  const byId = {}; boards.forEach((b) => { byId[b.id] = b; });
  /* 지금 잣대로 안 맞는 옛 글은 뺀다 — 잣대를 고치면 이미 들어온 잡음도 나가야 한다(2026-10-09 「규정 개정안내」).
     ⚠ 이번에 읽은 게시판의 글만 — 다른 판(검사·옛 판)의 글은 건드리지 않는다. */
  const drops = {};
  Object.keys(have).forEach((k) => { const x = have[k] || {}, b = byId[x.board]; if (b && x.title && noise(b, x.title)) drops[k] = true; });
  const pers = {}, docs = {};
  let aiUsed = 0;
  if (o.details) {
    const max = o.detailMax || LIMITS.detailMax, dms = o.detailMs || LIMITS.detailMs;
    const aiMax = o.aiMax == null ? LIMITS.aiMax : o.aiMax, aiMs = o.aiMs || LIMITS.aiMs;
    /* 아직 AI 에게 안 물어본 «기간 모름» 글 — ai 게시판이고 두 달 안에 올라온 것만 */
    const 다시AI = (x) => !!(o.ai && x.per && x.per.none && !x.per.aiTried && byId[x.board] && byId[x.board].ai &&
      (!today || daysBetween(x.date || '', today) <= LIMITS.aiAgeDays));
    const todo = hits.filter((h) => hasDetail(h, byId[h.board])).map((h) => ({ h, fresh: true }));
    Object.keys(have).forEach((k) => {
      if (drops[k]) return;
      const x = Object.assign({}, have[k] || {}, fixes[k] ? { href: fixes[k] } : {});
      if (x.per && (x.per.to || x.per.rolling || x.per.none) && (x.docs || x.docsNone) && !다시AI(x)) return;   // 기간·서류 둘 다 본 글만 건너뛴다
      if (hasDetail(Object.assign({ key: k }, x), byId[x.board])) todo.push({ h: Object.assign({ key: k }, x), fresh: false });
    });
    const list = todo.slice(0, max);
    let j = 0;
    const 읽개 = async () => {
      while (j < list.length) {
        const it = list[j++], b = byId[it.h.board];
        const left = totalMs - (now() - t0);
        if (left <= 1000) return;
        const 시계 = 늦으면(Math.min(dms, left), '본문을 늦게 줘 그만 읽었습니다');
        let got = null, ds = null, html = '', txt = '', aiTried = false;
        try { html = await Promise.race([o.fetchText(it.h.href, b), 시계.p]); txt = clean(html); got = periodOf(txt, it.h.date); ds = docsOf(txt); if (!ds || !ds.length) { const a = docsFromAttach(txt); if (a.length) ds = Object.assign(a, { fromAttach: true }); } }
        catch (e) { continue; }   // 못 열면 다음 날 다시
        finally { 시계.stop(); }
        /* 글자 규칙이 못 찾았고 공문이 그림인 게시판 — AI 에게 마감일만 묻는다 */
        if (!got && b && b.ai && o.ai && aiUsed < aiMax && !(it.h.per && (it.h.per.to || it.h.per.rolling))) {
          const imgs = imagesOf(html, it.h.href), body = bodyOf(txt, it.h.title);
          const left2 = totalMs - (now() - t0);
          if ((imgs.length || body.length > 300) && left2 > 5000) {
            aiUsed++;
            const 시계2 = 늦으면(Math.min(aiMs, left2), 'AI 가 늦게 답해 그만두었습니다');
            try {
              const parts = [{ text: aiAsk(it.h.title, it.h.date, body) }];
              for (const u of imgs) {
                try { const by = await Promise.race([o.fetchText(u, b, true), 시계2.p]); if (by && by.length && by.length <= IMG_BYTES) parts.push({ inline_data: { mime_type: mimeOf(u), data: Buffer.from(by).toString('base64') } }); }
                catch (_) { /* 그림 하나 못 받아도 나머지로 */ }
              }
              const reply = await Promise.race([o.ai(parts), 시계2.p]);
              aiTried = true;   // ⚠ 답을 «받았을 때만» — 한도·고장이면 다음 날 다시 묻는다
              got = aiPerOf(reply, it.h.date);
            } catch (_) { /* 한도·고장·늦음 — 이번엔 넘어간다 */ }
            finally { 시계2.stop(); }
          }
        }
        const v = got || (it.h.per && it.h.per.to ? it.h.per : (aiTried ? { none: true, aiTried: true } : { none: true }));
        /* ⚠ 빈 배열은 RTDB 가 안 담는다 — 「못 찾음」은 docsNone 으로 남겨 날마다 다시 열지 않는다 */
        const dv = ds && ds.length ? (ds.fromAttach ? { docs: ds.slice(), docsFrom: 'attach' } : { docs: ds }) : { docsNone: true };
        if (it.fresh) { it.h.per = v; Object.assign(it.h, dv); } else { pers[it.h.key] = v; docs[it.h.key] = dv; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(together, list.length) }, 읽개));
  }
  return { hits, errors, counts, pers, docs, fixes, drops, ai: aiUsed, checked: boards.length, ms: now() - t0 };
}

/* 게시판에 맞는 «읽는 손»을 고른다 — login 이 붙은 게시판만 로그인한 손으로.
   o.plain(url) → 글자 · o.login() → 로그인한 손(fetch(url) → 글자) · 로그인은 «한 번만» 한다.
   ⚠ 로그인이 실패하면 그 실패를 기억해 같은 날 다시 두드리지 않는다(남의 서버에 비밀번호를 거듭 보내지 않는다). */
function makeFetcher(o) {
  let 손 = null;
  /* raw — 바이트(Uint8Array)로 달라는 것(공문 그림을 AI 에게 보낼 때) */
  return async function fetchText(url, board, raw) {
    if (!board || !board.login) return o.plain(url, raw);
    if (!손) 손 = Promise.resolve().then(() => o.login(board.login));
    const h = await 손;
    return h(url, raw);
  };
}

/* 처음 한 번만 — 로그인 게시판을 여러 쪽 읽어 «모집 공문이 정말 거기 오는가»를 남긴다(대표 확인용).
   pages 쪽까지 읽고, 줄 수·사람 뽑는 글(제목·날짜·기관)을 돌려준다. 120일 제한 없이 본다. */
async function probeBoard(o) {
  const b = o.board, pages = o.pages || 5, rows = [];
  let read = 0;
  for (let p = 1; p <= pages; p++) {
    const url = b.url + (b.url.indexOf('?') >= 0 ? '&' : '?') + 'page=' + p;
    const got = parseRows(await o.fetchText(url, b), url, b);
    if (!got.length) break;
    if (rows.length && got[0].title === rows[0].title && got[0].date === rows[0].date) break;   // 쪽이 안 넘어간다
    read = p; got.forEach((r) => rows.push(r));
  }
  const recruit = rows.filter((r) => pass(b, r.title))
    .map((r) => ({ date: r.date, title: r.title, org: b.org || orgHint(r.title) }));
  return { board: b.id, pages: read, rows: rows.length,
    from: rows.length ? rows[rows.length - 1].date : '', to: rows.length ? rows[0].date : '',
    recruit: recruit.slice(0, 40) };
}

/* RTDB 에 쓸 것 — 새 글만 더하고, 넘치면 «오래된 것부터» 지운다(있던 글을 고치지 않는다) */
/* o.fails — 지금까지 «며칠째 못 읽는» 게시판(gov_watch/fails) · o.today — 서울 날짜.
   ⚠ 하루 실패로는 다음 날 다시 읽으면 되지만, 여러 날 이어지면 사람이 «직접 열어» 봐야 한다(지방공기업평가원 2026-10-05~).
     그래서 처음 못 읽은 날(since)·이어진 날 수(n)를 남기고, 다시 읽히면 지운다. 이번에 안 읽은 게시판은 건드리지 않는다. */
function updatesOf(result, existing, nowIso, o) {
  const upd = {};
  o = o || {};
  result.hits.forEach((h) => { upd['hits/' + h.key] = h; });
  const all = Object.keys(existing || {}).map((k) => ({ k, d: (existing[k] && existing[k].date) || '' }))
    .concat(result.hits.map((h) => ({ k: h.key, d: h.date })));
  if (all.length > MAX_KEEP) {
    all.sort((a, b) => a.d.localeCompare(b.d));
    all.slice(0, all.length - MAX_KEEP).forEach((x) => { upd['hits/' + x.k] = null; });
  }
  /* 지금 잣대로 안 맞는 옛 글을 뺀다 */
  Object.keys(result.drops || {}).forEach((k) => { if (existing && existing[k]) upd['hits/' + k] = null; });
  /* 옛 글에 붙인 기간 — ⚠ 같은 쓰기에서 지우는 글(null)에는 안 붙인다(RTDB 는 부모·자식을 한 번에 못 쓴다) */
  Object.keys(result.fixes || {}).forEach((k) => { if (upd['hits/' + k] !== null && existing && existing[k]) upd['hits/' + k + '/href'] = result.fixes[k]; });
  Object.keys(result.docs || {}).forEach((k) => {
    if (upd['hits/' + k] === null || !existing || !existing[k]) return;
    const d = result.docs[k];
    if (d.docs) { upd['hits/' + k + '/docs'] = d.docs; if (d.docsFrom) upd['hits/' + k + '/docsFrom'] = d.docsFrom; }
    else upd['hits/' + k + '/docsNone'] = true;
  });
  Object.keys(result.pers || {}).forEach((k) => { if (upd['hits/' + k] !== null && existing && existing[k]) upd['hits/' + k + '/per'] = result.pers[k]; });
  upd.last = { at: nowIso, checked: result.checked, added: result.hits.length,
    errors: result.errors, counts: result.counts };
  if (result.ai) upd.last.ai = result.ai;   // AI 에게 물은 건수(돈)
  if (o.today) {
    const fails = o.fails || {}, bad = {};
    (result.errors || []).forEach((e) => {
      bad[e.board] = true;
      const p = fails[e.board] || {};
      upd['fails/' + e.board] = { since: p.since || o.today, n: (p.last === o.today ? (p.n || 1) : (p.n || 0) + 1), last: o.today,
        why: String(e.why || '').slice(0, 160), name: e.name || p.name || e.board, url: e.url || p.url || '' };
    });
    Object.keys(result.counts || {}).forEach((b) => { if (!bad[b] && fails[b]) upd['fails/' + b] = null; });
  }
  const 뺀 = Object.keys(result.drops || {}).filter((k) => existing && existing[k]).length;
  if (뺀) upd.last.dropped = 뺀;
  return upd;
}

/* 바이트 → 글자. 옛 게시판은 euc-kr 이다(meta 에 적혀 있다) */
function decode(buf, contentType) {
  const head = Buffer.from(buf).subarray(0, 4000).toString('latin1');
  const euc = /euc-kr|ks_c_5601/i.test(String(contentType || '')) || /charset\s*=\s*["']?(euc-kr|ks_c_5601)/i.test(head);
  return new TextDecoder(euc ? 'euc-kr' : 'utf-8').decode(buf);
}

module.exports = { EXTRA_CA, caList, imagesOf, aiPerOf, aiAsk, bodyOf, docsOf, docsFromAttach, DOC_KINDS, periodOf, hasDetail, LIMITS, UA, BOARDS, ORG_HINTS, orgHint, makeFetcher, probeBoard, MAX_KEEP, MAX_AGE_DAYS, parseRows, isRecruit, isKcplaa, pass, keyOf, run, updatesOf, decode, clean };
