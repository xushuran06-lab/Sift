'use strict';
// Included only in the APK, never in the hosted website.
let siftNativePort=null;
let siftSharedText='';
// WebView downloads use the system document picker, including .ics reminders.
download=function(name,content,mime){
  if(!siftNativePort){toast('导出尚未准备好，请稍后重试。');return;}
  if(!['text/calendar','text/markdown','application/json'].includes(mime)||content.length>8*1024*1024){toast('导出格式或大小不支持');return;}
  siftNativePort.postMessage(JSON.stringify({action:'export',name,content,mime}));
};
window.addEventListener('message',event=>{
  if(location.origin!=='https://appassets.androidplatform.net'||event.data!=='sift-native'||event.ports.length!==1||siftNativePort)return;
  siftNativePort=event.ports[0];
  siftNativePort.onmessage=message=>{
    try{
      const data=JSON.parse(message.data);
      if(data.type!=='shared-text'||typeof data.text!=='string')return;
      siftSharedText=data.text.slice(0,4000);
      const text=siftSharedText.trim();
      if(/^https?:\/\/[^\s]+$/i.test(text)){
        capture('link');$('#capture-form input[name="url"]').value=text;siftSharedText='';
        toast('已填入链接；请补充标题。当前不会抓取正文。');return;
      }
      if(state.enabled.length)simulation();
      else{page='sources';render();toast('分享文字已暂存。先选来源，再点「导入消息」。');}
    }catch{toast('分享内容读取失败，请手动粘贴。');}
  };
  siftNativePort.start();
  siftNativePort.postMessage(JSON.stringify({action:'ready'}));
});
const simulationBeforeAndroid=simulation;
simulation=function(){simulationBeforeAndroid();const field=$('#message-form textarea[name="message"]');if(field&&!$('#modal').hidden&&siftSharedText){field.value=siftSharedText;siftSharedText='';toast('请确认来源，再处理分享内容。');}};
document.addEventListener('click',event=>{
  const control=event.target.closest('[data-action]');
  if(control&&['export','export-digest'].includes(control.dataset.action)){
    event.preventDefault();event.stopImmediatePropagation();
    if(!siftNativePort){toast('导出尚未准备好，请稍后重试。');return;}
    const digest=control.dataset.action==='export-digest';
    const content=digest?'# Sift · 指定来源摘要\n\n'+selectedDigests().map(d=>`## ${d.title}\n\n${d.summary}\n\n来源：${d.source}（${d.label}）`).join('\n\n'):JSON.stringify(state,null,2);
    if(content.length>8*1024*1024){toast('导出内容过大，请先减少图片收藏。');return;}
    siftNativePort.postMessage(JSON.stringify({action:'export',name:digest?'sift-summary.md':'sift-demo-data.json',mime:digest?'text/markdown':'application/json',content}));
    toast('请选择文件保存位置。');return;
  }
  const link=event.target.closest('a[href]');
  if(link){
    let url;try{url=new URL(link.href);}catch{return;}
    if(['https:','http:'].includes(url.protocol)&&url.origin!==location.origin){
      event.preventDefault();event.stopImmediatePropagation();
      if(siftNativePort)siftNativePort.postMessage(JSON.stringify({action:'openUrl',url:url.href}));
      else toast('浏览器入口尚未准备好，请稍后重试。');
    }
  }
},true);
window.siftAndroidBack=function(){
  if(!$('#modal').hidden){if(!processing)closeModal();return true;}
  if(page==='today')return false;
  page=['watch','campus-saved'].includes(page)?'library':page==='sources'?'settings':'today';
  render();window.scrollTo({top:0,behavior:'instant'});return true;
};
