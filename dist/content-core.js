(function(root){
  'use strict';
  const categories={all:'全部内容',tech:'AI 与科技',study:'学习成长',life:'生活灵感',travel:'旅行户外',book:'书籍阅读'};
  function cleanUrl(input){
    const raw=String(input||'').trim();if(!raw)return null;
    try{const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;url.hash='';[...url.searchParams.keys()].filter(k=>/^utm_|^(spm|from|share_source)$/i.test(k)).forEach(k=>url.searchParams.delete(k));return url.href;}catch{return null;}
  }
  function platform(url){if(!url)return '笔记';const h=new URL(url).hostname;if(/(^|\.)bilibili\.com$|^b23\.tv$/.test(h))return '哔哩哔哩';if(/(^|\.)youtube\.com$|^youtu\.be$/.test(h))return 'YouTube';if(h==='mp.weixin.qq.com')return '微信公众号';if(/(^|\.)xiaohongshu\.com$|^xhslink\.com$/.test(h))return '小红书';if(/(^|\.)zhihu\.com$|^zhihu\.link$/.test(h))return '知乎';if(h==='github.com')return 'GitHub';return h.replace(/^www\./,'');}
  function classify(text){if(/AI|人工智能|模型|代码|编程|科技|Agent/i.test(text))return 'tech';if(/保研|学习|科研|课程|考试|英语/.test(text))return 'study';if(/旅行|徒步|户外|路线|风景/.test(text))return 'travel';if(/读书|书籍|阅读|作者/.test(text))return 'book';return 'life';}
  function excerpt(text){return String(text||'').trim().replace(/\s+/g,' ').slice(0,160);}
  function validate(input){
    const url=input.url?cleanUrl(input.url):null;
    if(input.url&&!url)return {error:'请输入完整的 http:// 或 https:// 链接，不支持口令和脚本地址。'};
    const text=String(input.text||'').trim(),title=String(input.title||'').trim().slice(0,100);
    if(!url&&!text&&!input.image)return {error:'请添加链接、笔记正文或图片。'};
    if(!title)return {error:'请给这条收藏起一个标题。'};
    return {value:{title,url,text,summary:String(input.summary||'').trim().slice(0,600)||excerpt(text)||(url?'已保存原链接，正文尚未抓取。可补充摘要与标签。':'图片已保存在本浏览器，尚未执行 OCR。'),platform:input.image?'图片':platform(url),category:categories[input.category]&&input.category!=='all'?input.category:classify(title+' '+text),tags:[...new Set(String(input.tags||'').split(/[,，、#\n]/).map(t=>t.trim()).filter(Boolean))].slice(0,12),image:input.image||null,status:text?'local':url?'link-only':'image-only'}};
  }
  function search(items,{query='',category='all',collection=null,watch=false,trash=false}={}){const q=query.trim().toLowerCase();return items.filter(x=>!!x.deleted===!!trash&&(category==='all'||x.category===category)&&(!collection||(x.collections||[]).includes(collection))&&(!watch||x.watch)&&(!q||[x.title,x.summary,x.text,x.platform,...(x.tags||[])].join(' ').toLowerCase().includes(q)));}
  function migrate(state,seeds){if(!state.brain||!Array.isArray(state.brain.items)){state.brain={items:seeds,collections:[{id:'ai-tools',name:'AI 工具箱',color:'purple'},{id:'growth',name:'成长计划',color:'peach'},{id:'weekend',name:'周末出走',color:'green'}]};}return state;}
  const api={categories,cleanUrl,platform,classify,excerpt,validate,search,migrate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ContentCore=api;
})(typeof window!=='undefined'?window:globalThis);
