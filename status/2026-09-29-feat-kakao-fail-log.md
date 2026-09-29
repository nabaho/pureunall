# 2026-09-29 · 실패한 카카오 로그인도 로그인 감시에 (feat/kakao-fail-log)

대표 「추천대로」(카카오 보완 ②).

## 바뀐 것 (functions/kakao.js — kakaoLoginFinish)
- 연결 안 된 카카오로 시도 → `login_events/kakao_{회원번호 sha1 16자}` 에 기록(회원번호 원문 안 남김, 알림 없음 — 연결 전 새 직원도 지나는 길).
- 퇴사·휴직 계정이 카카오로 시도 → `login_events/{uid}` 기록 + `systemAlerts/{uid}` 알림 `security-kakao-inactive`(사번·상태). 관리자 「시스템 장애 알림」 에 뜬다(잡음 거르개에 안 걸림 확인).
- 서버가 카카오에 직접 물어 안 실패라 믿을 수 있다 — 화면이 보고하는 비밀번호 실패와 다르다.
- 기록이 실패해도 로그인 응답은 그대로(감시는 문을 막지 않는다).

## ⚠ 배포
서버 함수라 손 배포가 필요하다: `functions:kakaoLoginFinish`.

## 검사
kakao-login 에 4개 추가 · 망가뜨린 4가지 모두 운다 · 관련 751개 통과.
