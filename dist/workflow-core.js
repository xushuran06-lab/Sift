(function(root){
  'use strict';
  const day = date => new Date(new Date(date).getTime()+8*3600000).toISOString().slice(0,10);
  const words = text => String(text||'').split(/[、，,\n]/).map(s=>s.trim()).filter(Boolean);
  function dateValue(input,reference=new Date()){
    const s=String(input||'').trim(),today=day(reference),year=Number(today.slice(0,4));
    let match=s.match(/(?:(20\d{2})[-年\/])?(\d{1,2})[-月\/](\d{1,2})(?:日)?/),date=null;
    if(match){
      const y=Number(match[1]||year),m=Number(match[2]),d=Number(match[3]);
      const check=new Date(Date.UTC(y,m-1,d));
      if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return {date:null,iso:null,error:'日期无效'};
      date=check.toISOString().slice(0,10);
    }else{
      const relative=s.match(/今天|明天|后天/);
      if(relative)date=new Date(Date.parse(today+'T00:00:00+08:00')+['今天','明天','后天'].indexOf(relative[0])*86400000+8*3600000).toISOString().slice(0,10);
    }
    const time=s.match(/(?:T|\s|日|天|[（(][^）)]*[）)])*(\d{1,2})[:：](\d{2})/);
    if(!date)return {date:null,iso:null,error:s?'未识别明确日期':''};
    if(!time)return {date,iso:null,error:''};
    const h=Number(time[1]),mi=Number(time[2]);
    if(h>23||mi>59)return {date:null,iso:null,error:'时间无效'};
    return {date,iso:new Date(date+'T'+String(h).padStart(2,'0')+':'+time[2]+':00+08:00').toISOString(),error:''};
  }
  function extract(raw,base,reference=new Date()){
    const text=String(raw||'').trim();let out=base(text);
    const type=/作业|提交实验报告|课程报告|课程设计|作业截止/.test(text)?'homework':/填报|领取|缴费|信息采集|提交材料/.test(text)?'notice':null;
    if(out.kind==='noise'&&type){
      out={kind:'opportunity',type,title:(text.match(/[【「]([^】」]+)[】」]/)?.[1]||text.split(/[\n。]/)[0]).slice(0,60),raw:text,location:text.match(/地点\s*[：:]\s*([^\n，。；]+)/)?.[1]||'待确认',eventTime:text.match(/(?:活动时间|时间)\s*[：:]\s*([^\n；]+)/)?.[1]||'待确认',eligibility:text.match(/(?:面向|对象|要求)\s*[：:]\s*([^\n。；]+)/)?.[1]||'待确认',duration:'原文未说明',tags:[],status:/取消|停止|作废/.test(text)?'cancelled':'new',summary:text.slice(0,130)};
      out.fingerprint=out.title.toLowerCase().replace(/[\s，。！!：:“”「」【】\[\]、,.;；？?]/g,'').slice(0,80);
    }
    if(out.kind!=='opportunity')return out;
    const deadlineText=text.match(/(?:报名|提交|完成)?(?:截止(?:时间)?|截至|[dD][dD][lL])\s*[：:]?\s*([^\n。；]+)/)?.[1]||'';
    const parsed=dateValue(deadlineText,reference);
    out.deadline=parsed.iso;out.deadlineDay=parsed.date;out.deadlineText=deadlineText;
    out.actionText=text.match(/(?:报名方式|提交方式|参与方式|报名|提交)\s*[：:]\s*([^\n。；]+)/)?.[1]||(/联系负责人|原群联系/.test(text)?'回原群联系负责人':'待确认');
    out.link=text.match(/https?:\/\/[^\s，。；<>"']+/)?.[0]||null;
    out.uncertain=!parsed.iso||out.location==='待确认';
    return out;
  }
  function relevance(item,prefs={}){
    const text=[item.title,item.raw,item.eligibility].join(' ').toLowerCase();
    const excluded=words(prefs.exclude).find(w=>text.includes(w.toLowerCase()));
    if(excluded)return {match:false,reason:'排除关键词：'+excluded};
    const includes=words(prefs.include),hit=includes.find(w=>text.includes(w.toLowerCase()));
    if(includes.length&&!hit)return {match:false,reason:'未命中关注关键词'};
    const eligibility=String(item.eligibility||'');
    let grades=eligibility.match(/大[一二三四]/g)||[];
    const range=eligibility.match(/大([一二三四])[至到—-]大?([一二三四])/);
    if(range){const all=['大一','大二','大三','大四'];grades=all.slice('一二三四'.indexOf(range[1]),'一二三四'.indexOf(range[2])+1);}
    if(prefs.grade&&grades.length&&!grades.includes(prefs.grade)&&!/全校|不限年级|各年级/.test(item.eligibility))return {match:false,reason:'原文年级条件与设置不符'};
    return {match:true,reason:hit?'命中关键词：'+hit:grades.includes(prefs.grade)?'符合已填年级；其他条件需核对':'来自指定来源；参与条件需核对'};
  }
  function ended(item,now=new Date()){
    return item.status==='cancelled'||(item.deadline?Date.parse(item.deadline)<+new Date(now):item.deadlineDay?item.deadlineDay<day(now):false);
  }
  function calendar(item,now=new Date()){
    if(!item.deadline||!Number.isFinite(Date.parse(item.deadline)))throw Error('请先补全并确认截止日期与时间');
    if(ended(item,now))throw Error('已截止或取消的事项不能设置新的日历提醒');
    const clean=s=>String(s||'').replace(/\r\n?/g,'\n').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const utc=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sift//Campus Tasks//ZH','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+clean(item.id)+'@sift.local','DTSTAMP:'+utc(now),'DTSTART:'+utc(item.deadline),'DTEND:'+utc(Date.parse(item.deadline)+15*60000),'SUMMARY:'+clean('截止：'+item.title),'DESCRIPTION:'+clean('截止事项，非活动开始时间。\n'+(item.actionText||'请回原文确认处理方式')+'\n'+(item.raw||'')),'LOCATION:'+clean(item.location==='待确认'?'':item.location),'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:'+clean(item.title+'将于1小时后截止'),'END:VALARM','END:VEVENT','END:VCALENDAR'];
    // RFC 5545 lines must not exceed 75 UTF-8 octets. Fold without splitting a character.
    return lines.map(line=>{let out='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=char;bytes+=size;}return out;}).join('\r\n')+'\r\n';
  }
  const api={day,words,dateValue,extract,relevance,ended,calendar};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WorkflowCore=api;
})(typeof window!=='undefined'?window:globalThis);
