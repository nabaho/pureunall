/**
 * 푸른노무법인 통합 포털(erp.pureunlabor.co.kr) 카카오 로그인 반복 차단 완화 및 폴백 모듈
 * - '접속 정보를 확인해 주세요' / 네트워크 변경 / VPN / access_denied 감지
 * - 외부 브라우저 열기 및 아이디·비밀번호 로그인 전환 경로 제공
 */


export function isKakaoAccessOrNetworkError(errorOrMessage) {
  const text = String(
    typeof errorOrMessage === "object" && errorOrMessage !== null
      ? errorOrMessage.message || errorOrMessage.error_description || errorOrMessage.error || ""
      : errorOrMessage || ""
  )
    .normalize("NFC")
    .trim();


  return [
    "접속 정보를 확인해 주세요",
    "접속 정보",
    "네트워크 정보",
    "VPN",
    "iCloud 비공개 릴레이",
    "access_denied",
    "login_required",
    "network",
  ].some((token) => text.toLowerCase().includes(token.toLowerCase()));
}


export function buildKakaoFallbackState(errorOrMessage, options = {}) {
  const {
    portalUrl = "https://erp.pureunlabor.co.kr",
    idPwSelector = '[data-login-mode="idpw"], #idPwLoginBtn, .idpw-login-btn',
  } = options;


  const blocked = isKakaoAccessOrNetworkError(errorOrMessage);
  return {
    blocked,
    reason: blocked ? "NETWORK_OR_ACCESS_BLOCKED" : "GENERAL_AUTH_ERROR",
    message: blocked
      ? "카카오 로그인 접속이 일시 차단되었습니다. VPN·사설 DNS를 끄거나, [아이디·비밀번호 로그인] 또는 [외부 브라우저 열기]를 이용해 주세요."
      : "로그인 처리 중 오류가 발생했습니다. [아이디·비밀번호 로그인]으로 다시 시도해 주세요.",
    portalUrl,
    idPwSelector,
  };
}


export function triggerIdPwFallback(idPwSelector = '[data-login-mode="idpw"], #idPwLoginBtn, .idpw-login-btn') {
  if (typeof document === "undefined") return false;
  const target = document.querySelector(idPwSelector);
  if (target instanceof HTMLElement) {
    target.click();
    return true;
  }
  return false;
}


export function openInExternalBrowser(url = "https://erp.pureunlabor.co.kr") {
  if (typeof window === "undefined") return false;
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    return Boolean(opened);
  } catch {
    return false;
  }
}