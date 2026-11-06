const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const events={},nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:''});return nodes.get(id);};
const sent=[],port={start(){},postMessage(text){sent.push(JSON.parse(text));}};
const ctx=vm.createContext({URL,JSON,console,location:{origin:'https://appassets.androidplatform.net'},document:{addEventListener:(type,fn)=>events['doc-'+type]=fn},state:{enabled:[],example:'kept'},selectedDigests:()=>[{title:'Allowed',summary:'selected only',source:'a',label:'local'}],$:node,toast:()=>{},render:()=>{},page:'today',processing:false,capture:()=>{},simulation:()=>{node('#modal').hidden=false;},download:()=>{},closeModal:()=>{node('#modal').hidden=true;}});
ctx.window=ctx;ctx.addEventListener=(type,fn)=>events[type]=fn;ctx.scrollTo=()=>{};
vm.runInContext(fs.readFileSync('android/web/android.js','utf8'),ctx);
events.message({data:'other',ports:[port]});assert.equal(sent.length,0);
events.message({data:'sift-native',ports:[port]});assert.equal(sent[0].action,'ready');
const raw='【测试分享】\n<script>throw new Error("must remain text")</script>';
port.onmessage({data:JSON.stringify({type:'shared-text',text:raw})});assert.equal(ctx.page,'sources');
vm.runInContext("state.enabled=['chosen'];simulation()",ctx);assert.equal(node('#message-form textarea[name="message"]').value,raw);
port.onmessage({data:JSON.stringify({type:'shared-text',text:'https://example.com/article'})});assert.equal(node('#capture-form input[name="url"]').value,'https://example.com/article');
function click(action){let stopped=false;events['doc-click']({target:{closest:s=>s==='[data-action]'?{dataset:{action}}:null},preventDefault(){},stopImmediatePropagation(){stopped=true;}});assert.ok(stopped);}
click('export');assert.equal(sent.at(-1).mime,'application/json');assert.equal(JSON.parse(sent.at(-1).content).example,'kept');
click('export-digest');assert.equal(sent.at(-1).mime,'text/markdown');assert.match(sent.at(-1).content,/Allowed/);
node('#modal').hidden=false;assert.equal(ctx.siftAndroidBack(),true);assert.equal(node('#modal').hidden,true);
ctx.page='sources';assert.equal(ctx.siftAndroidBack(),true);assert.equal(ctx.page,'settings');ctx.page='today';assert.equal(ctx.siftAndroidBack(),false);
console.log('PASS: Android bridge handshake, shared text remains inert, explicit source selection, shared-link capture, native exports and back navigation.');

vm.runInContext("download('test.ics','BEGIN:VCALENDAR\\r\\nEND:VCALENDAR','text/calendar')",ctx);assert.equal(sent.at(-1).mime,'text/calendar');assert.equal(sent.at(-1).name,'test.ics');
