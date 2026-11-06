(function(root){
  'use strict';
  const modes={both:'机会 + 摘要',opportunities:'仅机会提醒',summary:'仅内容摘要'};
  function migrate(state,known){
    if(state.sourcePolicyVersion!==1){
      // The old demo enabled every example by default; that is not user consent.
      if(!state.enabled||known.every(s=>state.enabled.includes(s.id)))state.enabled=[];
      state.sourcePolicyVersion=1;
    }
    state.customSources=Array.isArray(state.customSources)?state.customSources:[];
    state.sourceModes=state.sourceModes||{};
    state.sourceSummaries=Array.isArray(state.sourceSummaries)?state.sourceSummaries:[];
    return state;
  }
  function allows(state,sources,id,kind){
    if(!sources.some(s=>s.id===id)||!state.enabled.includes(id))return false;
    const mode=state.sourceModes[id]||'both';
    return !!modes[mode]&&(mode==='both'||mode===kind);
  }
  function process(state,sources,id,raw,analyze){
    if(!allows(state,sources,id,'summary')&&!allows(state,sources,id,'opportunities'))return {kind:'blocked'};
    const text=String(raw||'').trim().slice(0,4000);
    if(!text)return {kind:'empty'};
    let summary=null,opportunity=null;
    if(allows(state,sources,id,'summary')){
      const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
      const selected=[...new Set(lines)].slice(0,4);
      summary={title:(lines[0].replace(/^【|】$/g,'')||'导入内容').slice(0,60),summary:selected.join('；').slice(0,320),evidence:text};
    }
    if(allows(state,sources,id,'opportunities'))opportunity=analyze(text);
    return {kind:'accepted',summary,opportunity};
  }
  const api={modes,migrate,allows,process};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ScopeCore=api;
})(typeof window!=='undefined'?window:globalThis);
