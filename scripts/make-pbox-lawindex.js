#!/usr/bin/env node
/* P박스 대한민국 전 법령 색인 생성기 (legalize-kr/legalize-kr 기반)
 *
 * 국가법령정보센터(law.go.kr) 공개 법령을 미러링한 legalize-kr 저장소의 kr/ 트리를 읽어
 * 대한민국 현행 법률·대통령령(시행령)·총리령·부령(시행규칙) 전체 목록(약 5,700여 편)을
 * 브라우저가 열쇠 없이 즉시 검색할 수 있는 경량 색인(js/pu-pbox-lawindex.js)으로 묶는다.
 *
 * 실행:
 *   node scripts/make-pbox-lawindex.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'pu-pbox-lawindex.js');
const UA = 'pureun-pbox-lawindex/1.0';

/* 노무법인 핵심 우선 동기화·즐겨찾기 법령 카탈로그 (분야 분류 + 띄어쓰기 표제어) */
const PRIORITY_META = {
  "근로기준법": {
    "title": "근로기준법",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 1
  },
  "최저임금법": {
    "title": "최저임금법",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 2
  },
  "근로자퇴직급여보장법": {
    "title": "근로자퇴직급여 보장법",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 3
  },
  "임금채권보장법": {
    "title": "임금채권보장법",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 4
  },
  "채용절차의공정화에관한법률": {
    "title": "채용절차의 공정화에 관한 법률",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 5
  },
  "근로복지기본법": {
    "title": "근로복지기본법",
    "cat": "labor_std",
    "dept": "고용노동부",
    "rank": 6
  },
  "공휴일에관한법률": {
    "title": "공휴일에 관한 법률",
    "cat": "labor_std",
    "dept": "인사혁신처",
    "rank": 7
  },
  "관공서의공휴일에관한규정": {
    "title": "관공서의 공휴일에 관한 규정",
    "cat": "labor_std",
    "dept": "인사혁신처",
    "rank": 8
  },
  "노동조합및노동관계조정법": {
    "title": "노동조합 및 노동관계조정법",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 9
  },
  "근로자참여및협력증진에관한법률": {
    "title": "근로자참여 및 협력증진에 관한 법률",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 10
  },
  "노동위원회법": {
    "title": "노동위원회법",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 11
  },
  "경제사회노동위원회법": {
    "title": "경제사회노동위원회법",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 12
  },
  "공무원의노동조합설립및운영등에관한법률": {
    "title": "공무원의 노동조합 설립 및 운영 등에 관한 법률",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 13
  },
  "교원의노동조합설립및운영등에관한법률": {
    "title": "교원의 노동조합 설립 및 운영 등에 관한 법률",
    "cat": "union",
    "dept": "고용노동부",
    "rank": 14
  },
  "공무원직장협의회의설립ㆍ운영에관한법률": {
    "title": "공무원직장협의회의 설립ㆍ운영에 관한 법률",
    "cat": "union",
    "dept": "행정안전부·인사혁신처",
    "rank": 15
  },
  "교원지위향상을위한교섭ㆍ협의에관한규정": {
    "title": "교원지위향상을 위한 교섭ㆍ협의에 관한 규정",
    "cat": "union",
    "dept": "교육부",
    "rank": 16
  },
  "산업재해보상보험법": {
    "title": "산업재해보상보험법",
    "cat": "safety_comp",
    "dept": "고용노동부",
    "rank": 17
  },
  "산업안전보건법": {
    "title": "산업안전보건법",
    "cat": "safety_comp",
    "dept": "고용노동부",
    "rank": 18
  },
  "중대재해처벌등에관한법률": {
    "title": "중대재해 처벌 등에 관한 법률",
    "cat": "safety_comp",
    "dept": "법무부·고용노동부",
    "rank": 19
  },
  "진폐의예방과진폐근로자의보호등에관한법률": {
    "title": "진폐의 예방과 진폐근로자의 보호 등에 관한 법률",
    "cat": "safety_comp",
    "dept": "고용노동부",
    "rank": 20
  },
  "석면피해구제법": {
    "title": "석면피해구제법",
    "cat": "safety_comp",
    "dept": "환경부",
    "rank": 21
  },
  "어선원및어선재해보상보험법": {
    "title": "어선원 및 어선 재해보상보험법",
    "cat": "safety_comp",
    "dept": "해양수산부",
    "rank": 22
  },
  "어선안전조업및어선원의안전ㆍ보건증진등에관한법률": {
    "title": "어선안전조업 및 어선원의 안전ㆍ보건 증진 등에 관한 법률",
    "cat": "safety_comp",
    "dept": "해양수산부",
    "rank": 23
  },
  "한국산업안전보건공단법": {
    "title": "한국산업안전보건공단법",
    "cat": "safety_comp",
    "dept": "고용노동부",
    "rank": 24
  },
  "광산안전법": {
    "title": "광산안전법",
    "cat": "safety_comp",
    "dept": "산업통상자원부",
    "rank": 25
  },
  "남녀고용평등과일ㆍ가정양립지원에관한법률": {
    "title": "남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률",
    "cat": "equality",
    "dept": "고용노동부",
    "rank": 26
  },
  "고용상연령차별금지및고령자고용촉진에관한법률": {
    "title": "고용상 연령차별금지 및 고령자고용촉진에 관한 법률",
    "cat": "equality",
    "dept": "고용노동부",
    "rank": 27
  },
  "장애인고용촉진및직업재활법": {
    "title": "장애인고용촉진 및 직업재활법",
    "cat": "equality",
    "dept": "고용노동부",
    "rank": 28
  },
  "장애인차별금지및권리구제등에관한법률": {
    "title": "장애인차별금지 및 권리구제 등에 관한 법률",
    "cat": "equality",
    "dept": "보건복지부",
    "rank": 29
  },
  "국가인권위원회법": {
    "title": "국가인권위원회법",
    "cat": "equality",
    "dept": "국가인권위원회",
    "rank": 30
  },
  "양성평등기본법": {
    "title": "양성평등기본법",
    "cat": "equality",
    "dept": "여성가족부",
    "rank": 31
  },
  "성폭력방지및피해자보호등에관한법률": {
    "title": "성폭력방지 및 피해자보호 등에 관한 법률",
    "cat": "equality",
    "dept": "여성가족부",
    "rank": 32
  },
  "스토킹범죄의처벌등에관한법률": {
    "title": "스토킹범죄의 처벌 등에 관한 법률",
    "cat": "equality",
    "dept": "법무부",
    "rank": 33
  },
  "여성의경제활동촉진과경력단절예방법": {
    "title": "여성의 경제활동 촉진과 경력단절 예방법",
    "cat": "equality",
    "dept": "여성가족부·고용노동부",
    "rank": 34
  },
  "기간제및단시간근로자보호등에관한법률": {
    "title": "기간제 및 단시간근로자 보호 등에 관한 법률",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 35
  },
  "파견근로자보호등에관한법률": {
    "title": "파견근로자 보호 등에 관한 법률",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 36
  },
  "외국인근로자의고용등에관한법률": {
    "title": "외국인근로자의 고용 등에 관한 법률",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 37
  },
  "출입국관리법": {
    "title": "출입국관리법",
    "cat": "non_regular",
    "dept": "법무부",
    "rank": 38
  },
  "재외동포의출입국과법적지위에관한법률": {
    "title": "재외동포의 출입국과 법적 지위에 관한 법률",
    "cat": "non_regular",
    "dept": "법무부",
    "rank": 39
  },
  "가사근로자의고용개선등에관한법률": {
    "title": "가사근로자의 고용개선 등에 관한 법률",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 40
  },
  "선원법": {
    "title": "선원법",
    "cat": "non_regular",
    "dept": "해양수산부",
    "rank": 41
  },
  "건설근로자의고용개선등에관한법률": {
    "title": "건설근로자의 고용개선 등에 관한 법률",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 42
  },
  "건설산업기본법": {
    "title": "건설산업기본법",
    "cat": "non_regular",
    "dept": "국토교통부",
    "rank": 43
  },
  "예술인복지법": {
    "title": "예술인 복지법",
    "cat": "non_regular",
    "dept": "문화체육관광부",
    "rank": 44
  },
  "예술인의지위와권리의보장에관한법률": {
    "title": "예술인의 지위와 권리의 보장에 관한 법률",
    "cat": "non_regular",
    "dept": "문화체육관광부",
    "rank": 45
  },
  "생활물류서비스산업발전법": {
    "title": "생활물류서비스산업발전법",
    "cat": "non_regular",
    "dept": "국토교통부",
    "rank": 46
  },
  "화물자동차운수사업법": {
    "title": "화물자동차 운수사업법",
    "cat": "non_regular",
    "dept": "국토교통부",
    "rank": 47
  },
  "여객자동차운수사업법": {
    "title": "여객자동차 운수사업법",
    "cat": "non_regular",
    "dept": "국토교통부",
    "rank": 48
  },
  "경비업법": {
    "title": "경비업법",
    "cat": "non_regular",
    "dept": "경찰청",
    "rank": 49
  },
  "주한미군소속한국인근로자의지원을위한특별법": {
    "title": "주한미군 소속 한국인근로자의 지원을 위한 특별법",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 50
  },
  "청년고용촉진특별법": {
    "title": "청년고용촉진 특별법",
    "cat": "non_regular",
    "dept": "고용노동부",
    "rank": 51
  },
  "고용보험법": {
    "title": "고용보험법",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 52
  },
  "고용보험및산업재해보상보험의보험료징수등에관한법률": {
    "title": "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 53
  },
  "고용정책기본법": {
    "title": "고용정책 기본법",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 54
  },
  "구직자취업촉진및생활안정지원에관한법률": {
    "title": "구직자 취업촉진 및 생활안정지원에 관한 법률",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 55
  },
  "국민연금법": {
    "title": "국민연금법",
    "cat": "social_ins",
    "dept": "보건복지부",
    "rank": 56
  },
  "국민건강보험법": {
    "title": "국민건강보험법",
    "cat": "social_ins",
    "dept": "보건복지부",
    "rank": 57
  },
  "노인장기요양보험법": {
    "title": "노인장기요양보험법",
    "cat": "social_ins",
    "dept": "보건복지부",
    "rank": 58
  },
  "국민연금과직역연금의연계에관한법률": {
    "title": "국민연금과 직역연금의 연계에 관한 법률",
    "cat": "social_ins",
    "dept": "보건복지부",
    "rank": 59
  },
  "직업안정법": {
    "title": "직업안정법",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 60
  },
  "국민평생직업능력개발법": {
    "title": "국민 평생 직업능력 개발법",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 61
  },
  "국가기술자격법": {
    "title": "국가기술자격법",
    "cat": "social_ins",
    "dept": "고용노동부",
    "rank": 62
  },
  "국가공무원법": {
    "title": "국가공무원법",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 63
  },
  "지방공무원법": {
    "title": "지방공무원법",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 64
  },
  "공무원재해보상법": {
    "title": "공무원재해보상법",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 65
  },
  "공무원연금법": {
    "title": "공무원연금법",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 66
  },
  "공무원보수규정": {
    "title": "공무원보수규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 67
  },
  "공무원수당등에관한규정": {
    "title": "공무원수당 등에 관한 규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 68
  },
  "공무원징계령": {
    "title": "공무원징계령",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 69
  },
  "국가공무원복무규정": {
    "title": "국가공무원 복무규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 70
  },
  "공무원임용령": {
    "title": "공무원임용령",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 71
  },
  "공무원고충처리규정": {
    "title": "공무원고충처리규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 72
  },
  "공무원성과평가등에관한규정": {
    "title": "공무원 성과평가 등에 관한 규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 73
  },
  "공무원행동강령": {
    "title": "공무원 행동강령",
    "cat": "public_mil",
    "dept": "국민권익위원회",
    "rank": 74
  },
  "국가공무원명예퇴직수당등지급규정": {
    "title": "국가공무원 명예퇴직수당 등 지급규정",
    "cat": "public_mil",
    "dept": "인사혁신처",
    "rank": 75
  },
  "지방공무원보수규정": {
    "title": "지방공무원 보수규정",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 76
  },
  "지방공무원수당등에관한규정": {
    "title": "지방공무원 수당 등에 관한 규정",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 77
  },
  "지방공무원복무규정": {
    "title": "지방공무원 복무규정",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 78
  },
  "지방공무원임용령": {
    "title": "지방공무원 임용령",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 79
  },
  "지방공무원징계및소청규정": {
    "title": "지방공무원 징계 및 소청규정",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 80
  },
  "외무공무원법": {
    "title": "외무공무원법",
    "cat": "public_mil",
    "dept": "외교부",
    "rank": 81
  },
  "국가정보원직원법": {
    "title": "국가정보원직원법",
    "cat": "public_mil",
    "dept": "국가정보원",
    "rank": 82
  },
  "군인사법": {
    "title": "군인사법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 83
  },
  "군인의지위및복무에관한기본법": {
    "title": "군인의 지위 및 복무에 관한 기본법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 84
  },
  "군인보수법": {
    "title": "군인보수법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 85
  },
  "군인재해보상법": {
    "title": "군인재해보상법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 86
  },
  "군인연금법": {
    "title": "군인연금법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 87
  },
  "군무원인사법": {
    "title": "군무원인사법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 88
  },
  "병역법": {
    "title": "병역법",
    "cat": "public_mil",
    "dept": "병무청·국방부",
    "rank": 89
  },
  "군형법": {
    "title": "군형법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 90
  },
  "군사법원법": {
    "title": "군사법원법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 91
  },
  "제대군인지원에관한법률": {
    "title": "제대군인지원에 관한 법률",
    "cat": "public_mil",
    "dept": "국가보훈부",
    "rank": 92
  },
  "국가유공자등예우및지원에관한법률": {
    "title": "국가유공자 등 예우 및 지원에 관한 법률",
    "cat": "public_mil",
    "dept": "국가보훈부",
    "rank": 93
  },
  "보훈보상대상자지원에관한법률": {
    "title": "보훈보상대상자 지원에 관한 법률",
    "cat": "public_mil",
    "dept": "국가보훈부",
    "rank": 94
  },
  "예비군법": {
    "title": "예비군법",
    "cat": "public_mil",
    "dept": "국방부",
    "rank": 95
  },
  "민방위기본법": {
    "title": "민방위기본법",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 96
  },
  "교육공무원법": {
    "title": "교육공무원법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 97
  },
  "교육공무원징계령": {
    "title": "교육공무원징계령",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 98
  },
  "교육공무원임용령": {
    "title": "교육공무원임용령",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 99
  },
  "교원의지위향상및교육활동보호를위한특별법": {
    "title": "교원의 지위 향상 및 교육활동 보호를 위한 특별법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 100
  },
  "교원소청에관한규정": {
    "title": "교원소청에 관한 규정",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 101
  },
  "사립학교법": {
    "title": "사립학교법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 102
  },
  "사립학교교직원연금법": {
    "title": "사립학교교직원 연금법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 103
  },
  "고등교육법": {
    "title": "고등교육법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 104
  },
  "초ㆍ중등교육법": {
    "title": "초ㆍ중등교육법",
    "cat": "public_mil",
    "dept": "교육부",
    "rank": 105
  },
  "경찰공무원법": {
    "title": "경찰공무원법",
    "cat": "public_mil",
    "dept": "경찰청",
    "rank": 106
  },
  "경찰공무원징계령": {
    "title": "경찰공무원 징계령",
    "cat": "public_mil",
    "dept": "경찰청",
    "rank": 107
  },
  "경찰공무원복무규정": {
    "title": "경찰공무원 복무규정",
    "cat": "public_mil",
    "dept": "경찰청",
    "rank": 108
  },
  "경찰공무원보건안전및복지기본법": {
    "title": "경찰공무원 보건안전 및 복지 기본법",
    "cat": "public_mil",
    "dept": "경찰청",
    "rank": 109
  },
  "소방공무원법": {
    "title": "소방공무원법",
    "cat": "public_mil",
    "dept": "소방청",
    "rank": 110
  },
  "소방공무원징계령": {
    "title": "소방공무원 징계령",
    "cat": "public_mil",
    "dept": "소방청",
    "rank": 111
  },
  "소방공무원복무규정": {
    "title": "소방공무원 복무규정",
    "cat": "public_mil",
    "dept": "소방청",
    "rank": 112
  },
  "소방공무원보건안전및복지기본법": {
    "title": "소방공무원 보건안전 및 복지 기본법",
    "cat": "public_mil",
    "dept": "소방청",
    "rank": 113
  },
  "해양경찰법": {
    "title": "해양경찰법",
    "cat": "public_mil",
    "dept": "해양경찰청",
    "rank": 114
  },
  "청원경찰법": {
    "title": "청원경찰법",
    "cat": "public_mil",
    "dept": "경찰청",
    "rank": 115
  },
  "공공기관의운영에관한법률": {
    "title": "공공기관의 운영에 관한 법률",
    "cat": "public_mil",
    "dept": "기획재정부",
    "rank": 116
  },
  "지방공기업법": {
    "title": "지방공기업법",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 117
  },
  "지방자치단체출자ㆍ출연기관의운영에관한법률": {
    "title": "지방자치단체 출자ㆍ출연기관의 운영에 관한 법률",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 118
  },
  "공무직위원회설치및운영에관한법률": {
    "title": "공무직위원회 설치 및 운영에 관한 법률",
    "cat": "public_mil",
    "dept": "고용노동부",
    "rank": 119
  },
  "지방자치법": {
    "title": "지방자치법",
    "cat": "public_mil",
    "dept": "행정안전부",
    "rank": 120
  },
  "공인노무사법": {
    "title": "공인노무사법",
    "cat": "admin_civil",
    "dept": "고용노동부",
    "rank": 121
  },
  "민법": {
    "title": "민법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 122
  },
  "상법": {
    "title": "상법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 123
  },
  "민사소송법": {
    "title": "민사소송법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 124
  },
  "민사집행법": {
    "title": "민사집행법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 125
  },
  "공탁법": {
    "title": "공탁법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 126
  },
  "신원보증법": {
    "title": "신원보증법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 127
  },
  "채무자회생및파산에관한법률": {
    "title": "채무자 회생 및 파산에 관한 법률",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 128
  },
  "행정소송법": {
    "title": "행정소송법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 129
  },
  "행정심판법": {
    "title": "행정심판법",
    "cat": "admin_civil",
    "dept": "국민권익위원회",
    "rank": 130
  },
  "행정절차법": {
    "title": "행정절차법",
    "cat": "admin_civil",
    "dept": "행정안전부",
    "rank": 131
  },
  "행정기본법": {
    "title": "행정기본법",
    "cat": "admin_civil",
    "dept": "법제처",
    "rank": 132
  },
  "국가배상법": {
    "title": "국가배상법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 133
  },
  "개인정보보호법": {
    "title": "개인정보 보호법",
    "cat": "admin_civil",
    "dept": "개인정보보호위원회",
    "rank": 134
  },
  "위치정보의보호및이용등에관한법률": {
    "title": "위치정보의 보호 및 이용 등에 관한 법률",
    "cat": "admin_civil",
    "dept": "방송통신위원회",
    "rank": 135
  },
  "통신비밀보호법": {
    "title": "통신비밀보호법",
    "cat": "admin_civil",
    "dept": "법무부·과학기술정보통신부",
    "rank": 136
  },
  "정보통신망이용촉진및정보보호등에관한법률": {
    "title": "정보통신망 이용촉진 및 정보보호 등에 관한 법률",
    "cat": "admin_civil",
    "dept": "과학기술정보통신부·방송통신위원회",
    "rank": 137
  },
  "부정경쟁방지및영업비밀보호에관한법률": {
    "title": "부정경쟁방지 및 영업비밀보호에 관한 법률",
    "cat": "admin_civil",
    "dept": "특허청",
    "rank": 138
  },
  "발명진흥법": {
    "title": "발명진흥법",
    "cat": "admin_civil",
    "dept": "특허청",
    "rank": 139
  },
  "저작권법": {
    "title": "저작권법",
    "cat": "admin_civil",
    "dept": "문화체육관광부",
    "rank": 140
  },
  "하도급거래공정화에관한법률": {
    "title": "하도급거래 공정화에 관한 법률",
    "cat": "admin_civil",
    "dept": "공정거래위원회",
    "rank": 141
  },
  "독점규제및공정거래에관한법률": {
    "title": "독점규제 및 공정거래에 관한 법률",
    "cat": "admin_civil",
    "dept": "공정거래위원회",
    "rank": 142
  },
  "대리점거래의공정화에관한법률": {
    "title": "대리점거래의 공정화에 관한 법률",
    "cat": "admin_civil",
    "dept": "공정거래위원회",
    "rank": 143
  },
  "가맹사업거래의공정화에관한법률": {
    "title": "가맹사업거래의 공정화에 관한 법률",
    "cat": "admin_civil",
    "dept": "공정거래위원회",
    "rank": 144
  },
  "소득세법": {
    "title": "소득세법",
    "cat": "admin_civil",
    "dept": "기획재정부",
    "rank": 145
  },
  "법인세법": {
    "title": "법인세법",
    "cat": "admin_civil",
    "dept": "기획재정부",
    "rank": 146
  },
  "조세특례제한법": {
    "title": "조세특례제한법",
    "cat": "admin_civil",
    "dept": "기획재정부",
    "rank": 147
  },
  "국세기본법": {
    "title": "국세기본법",
    "cat": "admin_civil",
    "dept": "기획재정부",
    "rank": 148
  },
  "상속세및증여세법": {
    "title": "상속세 및 증여세법",
    "cat": "admin_civil",
    "dept": "기획재정부",
    "rank": 149
  },
  "공익신고자보호법": {
    "title": "공익신고자 보호법",
    "cat": "admin_civil",
    "dept": "국민권익위원회",
    "rank": 150
  },
  "부패방지및국민권익위원회의설치와운영에관한법률": {
    "title": "부패방지 및 국민권익위원회의 설치와 운영에 관한 법률",
    "cat": "admin_civil",
    "dept": "국민권익위원회",
    "rank": 151
  },
  "부정청탁및금품등수수의금지에관한법률": {
    "title": "부정청탁 및 금품등 수수의 금지에 관한 법률",
    "cat": "admin_civil",
    "dept": "국민권익위원회",
    "rank": 152
  },
  "공직자의이해충돌방지법": {
    "title": "공직자의 이해충돌 방지법",
    "cat": "admin_civil",
    "dept": "국민권익위원회",
    "rank": 153
  },
  "형법": {
    "title": "형법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 154
  },
  "형사소송법": {
    "title": "형사소송법",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 155
  },
  "형의실효등에관한법률": {
    "title": "형의 실효 등에 관한 법률",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 156
  },
  "특정경제범죄가중처벌등에관한법률": {
    "title": "특정경제범죄 가중처벌 등에 관한 법률",
    "cat": "admin_civil",
    "dept": "법무부",
    "rank": 157
  },
  "대한민국헌법": {
    "title": "대한민국헌법",
    "cat": "admin_civil",
    "dept": "헌법",
    "rank": 158
  }
};

/* 같은 폴더 안에서 본법(법률(법률) > 법률 > 대통령령 > 시행령 > 시행규칙) 차례로 정렬한다.
 * 근로기준법·노조법처럼 1997년 폐지법률이 `법률.md`에 남고 현행법이 `법률(법률).md`에 있는 경우
 * `법률(법률).md`가 반드시 맨 앞에 오게 한다. */
function fileOrderScore(f) {
  if (f === '헌법') return 1;
  if (f === '법률(법률)') return 2;
  if (/^법률\(/.test(f)) return 3;
  if (f === '법률') return 4;
  if (f === '대통령령(대통령령)') return 5;
  if (/^대통령령/.test(f)) return 6;
  if (f === '시행령(대통령령)') return 7;
  if (/^시행령\(/.test(f)) return 8;
  if (f === '시행령') return 9;
  if (/^총리령/.test(f)) return 10;
  if (/^시행규칙\(/.test(f)) return 11;
  if (f === '시행규칙') return 12;
  return 20;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

async function buildIndex() {
  const rootTree = await fetchJson('https://api.github.com/repos/legalize-kr/legalize-kr/git/trees/main');
  const krNode = (rootTree.tree || []).find((t) => t.path === 'kr' && t.type === 'tree');
  if (!krNode) throw new Error('legalize-kr 에서 kr 트리를 찾지 못했습니다');

  const krTree = await fetchJson(krNode.url + '?recursive=1');
  const blobs = (krTree.tree || []).filter((t) => t.type === 'blob' && t.path.endsWith('.md'));

  const byDir = new Map();
  for (const b of blobs) {
    const slash = b.path.indexOf('/');
    if (slash <= 0) continue;
    const dir = b.path.slice(0, slash);
    const base = b.path.slice(slash + 1).replace(/\.md$/, '');
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(base);
  }

  const dirs = [...byDir.keys()].sort((a, b) => {
    const pa = PRIORITY_META[a] ? PRIORITY_META[a].rank : 99999;
    const pb = PRIORITY_META[b] ? PRIORITY_META[b].rank : 99999;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, 'ko');
  });

  const packedLines = [];
  let fileCount = 0;
  for (const dir of dirs) {
    const files = byDir.get(dir).sort((a, b) => {
      const sa = fileOrderScore(a);
      const sb = fileOrderScore(b);
      return sa !== sb ? sa - sb : a.localeCompare(b, 'ko');
    });
    /* `법률(법률)` 과 `법률` 이 둘 다 있는 폴더는 `법률.md` 가 구법 폐지법률(1조짜리)인 경우이므로
       혼동을 막기 위해 현행 `법률(법률)` 을 기본으로 두고 구 폐지법률 표시를 위해 뒤로 보낸다. */
    fileCount += files.length;
    packedLines.push(dir + '|' + files.join(','));
  }

  const snapshotDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const js = [
    '/* P박스 대한민국 국가법령 전수 색인 (scripts/make-pbox-lawindex.js 자동 생성) */',
    '(function(global){',
    "  'use strict';",
    '  var SNAPSHOT_AT = ' + JSON.stringify(snapshotDate) + ';',
    '  var KR_TREE_SHA = ' + JSON.stringify(krNode.sha) + ';',
    '  var TOTAL_FAMILIES = ' + dirs.length + ';',
    '  var TOTAL_FILES = ' + fileCount + ';',
    '  var PRIORITY_META = ' + JSON.stringify(PRIORITY_META, null, 2) + ';',
    '  var PACKED = ' + JSON.stringify(packedLines.join('\n')) + ';',
    '  var PUBLIC_MIL_DIR_RE = /(?:공무원|군인|군무원|군사법원|군형법|병역|제대군인|보훈보상|국가유공자|교원|사립학교|경찰공무원|소방공무원|해양경찰|청원경찰|법원공무원|국회인사|예비군|민방위)/;',
    '  function inferLawCat(dir, meta) {',
    '    if (meta && meta.cat) return meta.cat;',
    '    if (PUBLIC_MIL_DIR_RE.test(dir)) return "public_mil";',
    '    return "general";',
    '  }',
    '  var _parsed = null;',
    '  function list(){',
    '    if (_parsed) return _parsed;',
    '    var rows = PACKED.split("\\n");',
    '    var out = [];',
    '    for (var i = 0; i < rows.length; i++) {',
    '      var line = rows[i];',
    '      if (!line) continue;',
    '      var bar = line.indexOf("|");',
    '      if (bar < 0) continue;',
    '      var dir = line.slice(0, bar);',
    '      var files = line.slice(bar + 1).split(",");',
    '      var hasParenAct = files.indexOf("법률(법률)") >= 0;',
    '      var meta = PRIORITY_META[dir] || null;',
    '      out.push({',
    '        dir: dir,',
    '        title: meta ? meta.title : dir,',
    '        cat: inferLawCat(dir, meta),',
    '        dept: meta ? meta.dept : "",',
    '        priority: meta ? meta.rank : 0,',
    '        files: files,',
    '        primaryFile: files[0] + ".md",',
    '        hasRepealStub: hasParenAct && files.indexOf("법률") >= 0',
    '      });',
    '    }',
    '    _parsed = out;',
    '    return out;',
    '  }',
    '  global.PuPBoxLawIndex = {',
    '    SNAPSHOT_AT: SNAPSHOT_AT,',
    '    KR_TREE_SHA: KR_TREE_SHA,',
    '    TOTAL_FAMILIES: TOTAL_FAMILIES,',
    '    TOTAL_FILES: TOTAL_FILES,',
    '    PRIORITY_META: PRIORITY_META,',
    '    list: list',
    '  };',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');

  fs.writeFileSync(OUT, js, 'utf8');
  console.log('✓ P박스 전 법령 색인 생성 완료:', dirs.length, '개 법령군 ·', fileCount, '개 법령·시행령·시행규칙');
}

if (require.main === module) {
  buildIndex().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildIndex, PRIORITY_META, fileOrderScore };
