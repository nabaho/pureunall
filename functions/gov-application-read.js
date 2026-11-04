'use strict';
/* 공개 공고 읽기 전용. 기존 수집 대상의 HTTPS 호스트만 허용하며 로그인·쿠키·첨부 전송을 하지 않는다. */
const https = require('node:https');
const dns = require('node:dns').promises;
const { BlockList, isIP } = require('node:net');
const Watch = require('./recruit-watch');
const HOSTS = new Set(Watch.BOARDS.map(b => new URL(b.url).hostname).concat([
  'www.bizinfo.go.kr','bizinfo.go.kr','www.g2b.go.kr','www.alio.go.kr','job.alio.go.kr','www.chungnam.go.kr'
]));
const blocked = new BlockList();
['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.168.0.0/16','198.18.0.0/15','224.0.0.0/4','240.0.0.0/4'].forEach(x => { const [ip,bits]=x.split('/'); blocked.addSubnet(ip,Number(bits),'ipv4'); });
function publicIp(ip){return isIP(ip)===4&&!blocked.check(ip,'ipv4');}
function allowed(value){try{const u=new URL(value);return u.protocol==='https:'&&(!u.port||u.port==='443')&&!u.username&&!u.password&&HOSTS.has(u.hostname)&&!/\/(?:login|logout|admin|member)(?:[/.?]|$)/i.test(u.pathname)?u:null;}catch(e){return null;}}
async function getPage(value,redirects=0,fileMode=false){
  const u=allowed(value);if(!u)throw new Error('자동 읽기 대상이 아닙니다. 공개 공고문을 파일로 올려 주세요');
  const ips=await dns.lookup(u.hostname,{all:true,family:4});if(!ips.length||ips.some(x=>!publicIp(x.address)))throw new Error('공개 공고 주소만 읽을 수 있습니다');
  return new Promise((resolve,reject)=>{
    const req=https.get(u,{headers:{'User-Agent':Watch.UA,Accept:'text/html'},ca:Watch.caList(),lookup:(host,opts,cb)=>opts.all?cb(null,[{address:ips[0].address,family:4}]):cb(null,ips[0].address,4)},res=>{
      if(res.statusCode>=300&&res.statusCode<400){res.resume();if(redirects>=3)return reject(new Error('공고 이동이 너무 많습니다'));let next;try{next=new URL(res.headers.location,u).href;}catch(e){return reject(new Error('공고 이동 주소를 확인하세요'));}getPage(next,redirects+1,fileMode).then(resolve,reject);return;}
      if(res.statusCode!==200){res.resume();return reject(new Error('공고 서버 응답 '+res.statusCode+' · 공고문을 올려 주세요'));}
      if(!(fileMode?/application\/(?:pdf|octet-stream|zip|x-hwp|hwp|haansoft|vnd\.)/i:/text\/html|application\/xhtml/i).test(res.headers['content-type']||'')){res.resume();return reject(new Error('본문이 HTML이 아닙니다. 공고문 파일을 올려 주세요'));}
      let size=0;const chunks=[];res.on('data',b=>{size+=b.length;if(size>(fileMode?8:3)*1024*1024){req.destroy(new Error('공고 본문이 너무 큽니다'));return;}chunks.push(b);});res.on('error',reject);res.on('end',()=>resolve({bytes:Buffer.concat(chunks),url:u.href,type:res.headers['content-type'],disposition:res.headers['content-disposition']||''}));
    });req.setTimeout(15000,()=>req.destroy(new Error('공고 서버 응답이 늦습니다. 파일을 올려 주세요')));req.on('error',reject);
  });
}
function parse(html,url){
  const files=[],re=/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=re.exec(html))){const name=Watch.clean(m[2]).trim();let href='';try{href=new URL(m[1].replace(/&amp;/g,'&'),url).href;}catch(e){}if(!allowed(href)||!(/\.(?:hwp|hwpx|pdf|docx|zip)(?:[?#]|$)/i.test(href)||/다운로드|첨부|\.hwpx?|\.pdf|\.docx|\.zip/i.test(name)))continue;if(!files.some(f=>f.url===href))files.push({name:name.slice(0,200)||'첨부파일',url:href});if(files.length>=30)break;}
  const text=Watch.clean(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<\/(?:p|div|li|tr|h\d)>|<br\s*\/?>/gi,'\uE000')).replace(/\uE000/g,'\n').slice(0,60000);
  if(text.replace(/\s/g,'').length<30)throw new Error('공고 본문을 읽지 못했습니다. 그림 공고는 원본을 확인해 주세요');
  return {text,files,url};
}
async function read(url){const r=await getPage(url);const html=Watch.decode(r.bytes,r.type);return parse(html,r.url);}
async function readFile(url){const r=await getPage(url,0,true);return {base64:r.bytes.toString('base64'),contentType:r.type};}
module.exports={readFile,HOSTS,publicIp,allowed,parse,read};
