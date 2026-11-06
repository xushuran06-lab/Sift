(function(root){
  'use strict';
  const BASE = new Date('2026-11-03T16:00:00+08:00').getTime();
  const TYPES = { volunteer:'志愿活动', research:'科研实习', lecture:'讲座分享', competition:'竞赛活动' };
  function fingerprint(text){return text.toLowerCase().replace(/[\s，。！!：:“”「」【】\[\]、,.;；？?]/g,'').slice(0,80);}
  function analyze(text){
    const raw=String(text||'').trim();
    if(!raw) return {kind:'empty'};
    const tags=[];
    let type=/志愿|志工/.test(raw)?'volunteer':/科研|研究助理|实习|实验室/.test(raw)?'research':/讲座|分享会|报告会/.test(raw)?'lecture':/竞赛|比赛|黑客松/.test(raw)?'competition':null;
    if(!type) return {kind:'noise',reason:'未匹配演示中的机会类型，保留为普通消息，不触发提醒。'};
    const bracket=raw.match(/[【「]([^】」]+)[】」]/);
    const title=(bracket?bracket[1]:raw.split(/[\n。！!]/)[0]).slice(0,60);
    const deadlineMatch=raw.match(/(?:报名)?(?:截止(?:时间)?|截至)\s*[：:]?\s*((?:20\d{2}年)?\d{1,2}月\d{1,2}日)\s*(\d{1,2}[:：]\d{2})?/);
    let deadline=null;
    if(deadlineMatch){const md=deadlineMatch[1].match(/(\d{1,2})月(\d{1,2})日/),t=(deadlineMatch[2]||'').replace('：',':');if(t){const mo=+md[1],day=+md[2],[h,m]=t.split(':').map(Number),year=+(deadlineMatch[1].match(/20\d{2}/)||['2026'])[0],dt=new Date(Date.UTC(year,mo-1,day,h-8,m));const local=new Date(dt.getTime()+8*3600000);if(local.getUTCFullYear()===year&&local.getUTCMonth()===mo-1&&local.getUTCDate()===day&&h<24&&m<60)deadline=dt.toISOString();}}
    const duration=raw.match(/(?:志愿)?时长\s*[：:]?\s*(\d+(?:\.\d+)?)\s*小时/);
    const location=raw.match(/地点\s*[：:]\s*([^\n，。；;]+)/);
    const event=raw.match(/(?:活动时间|时间)\s*[：:]\s*([^\n；;]+)/);
    const eligible=raw.match(/(?:面向|招募对象|要求)\s*[：:]\s*([^\n。；;]+)/);
    const link=raw.match(/https?:\/\/[^\s，。]+/);
    if(duration)tags.push(duration[1]+' 小时');
    if(/校内|图书馆/.test(raw))tags.push('校内');
    const cancelled=/取消|停止招募|名额已满|报名结束/.test(raw);
    return {kind:'opportunity',title,type,deadline,duration:duration?duration[1]+' 小时':'原文未说明',location:location?location[1]:'待确认',eventTime:event?event[1]:'待确认',eligibility:eligible?eligible[1]:'待确认',link:link?link[0]:null,tags,status:cancelled?'cancelled':'new',uncertain:!deadline||!location,raw,fingerprint:fingerprint(title),summary:raw.replace(/[【「][^】」]+[】」]/,'').trim().slice(0,130)||'查看原文，确认活动安排。'};
  }
  function matches(item,prefs){return (prefs.types||[]).includes(item.type);}
  function ingest(items,item){
    const existing=items.find(x=>x.fingerprint===item.fingerprint);
    if(existing){
      const sources=Array.from(new Set([...(existing.sources||[]),...(item.sources||[])]));
      const changed=item.raw!==existing.raw && /取消|停止招募|名额已满|报名结束|延期|变更|更新/.test(item.raw);
      if(changed){const history=[...(existing.history||[]),{raw:existing.raw,note:'变更前消息'}];return {kind:'updated',item:{...existing,...item,id:existing.id,sources,history,saved:existing.saved,applied:existing.applied},items:items.map(x=>x.id===existing.id?{...existing,...item,id:existing.id,sources,history,saved:existing.saved,applied:existing.applied}:x)};}
      return {kind:'duplicate',item:{...existing,sources},items:items.map(x=>x.id===existing.id?{...x,sources}:x)};
    }
    return {kind:'created',item,items:[item,...items]};
  }
  function hoursUntil(date){return date?(new Date(date).getTime()-BASE)/3600000:null;}
  const api={BASE,TYPES,fingerprint,analyze,matches,ingest,hoursUntil};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RadarCore=api;
})(typeof window!=='undefined'?window:globalThis);
