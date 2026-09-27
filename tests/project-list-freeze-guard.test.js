const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const start = src.indexOf('function ProjectManagementShared(props)');
const end = src.indexOf('// ============ 종료관리', start);
const body = src.slice(start, end > start ? end : start + 80000);

if (!body.includes('var _projUserBySid = {}')) throw new Error('담당자 색인이 없습니다.');
if (!body.includes('var _projTypeByCode = {}')) throw new Error('유형 색인이 없습니다.');
if (!body.includes('var ppsS = useState(20)')) throw new Error('기본 표시량 20행이 유지되지 않았습니다.');
if (/users\.find\(function\(u\)\{ return u\.sid===it\.mgrMain/.test(body)) {
  throw new Error('행마다 담당자 전체를 다시 검색하는 느린 경로가 돌아왔습니다.');
}

console.log('project-list-freeze-guard: ok');
