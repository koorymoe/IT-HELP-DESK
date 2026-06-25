'use strict';
/* ── AI CHAT ── */
let aiKnowledge=[];
async function fetchITKnowledge(){
  try{const r=await api('knowledge.list');if(r&&r.success)aiKnowledge=r.items||[];}catch(e){}
}
function buildAISystem(){
  const base=`أنت مساعد IT ذكي. تساعد المستخدمين في حل مشاكل الحاسوب والشبكة والطابعات وغيرها. أجب باللغة العربية بشكل مختصر وواضح.`;
  if(!aiKnowledge.length)return base;
  const kb=aiKnowledge.slice(0,20).map(i=>`مشكلة: ${i.problem}\nحل: ${i.solution}`).join('\n---\n');
  return base+'\n\nقاعدة المعرفة:\n'+kb;
}
const AI_IDS={desk:{msgs:'deskAiMsgs',inp:'deskAiInp',send:'deskAiSend',dots:'deskAiDots',limitBar:'deskAiLimitBar',devSel:'deskAiDevSel'},mob:{msgs:'mobAiMsgs',inp:'mobAiInp',send:'mobAiSend',dots:'mobAiDots',limitBar:'mobAiLimitBar',devSel:'mobAiDevSel'}};
function pickAIDev(btn,name,ctx){
  ctx=ctx||'desk';
  AI[ctx].device=name;
  const sel=document.getElementById(AI_IDS[ctx].devSel);
  if(sel)sel.querySelectorAll('.ai-dev-chip').forEach(b=>b.classList.toggle('selected',b===btn));
  const inp=document.getElementById(AI_IDS[ctx].inp),send=document.getElementById(AI_IDS[ctx].send);
  if(inp)inp.disabled=false;if(send)send.disabled=false;
  appendAIMsg(ctx,'assistant','👋 سأساعدك في مشاكل '+name+'. ما المشكلة التي تواجهها؟');
}
function appendAIMsg(ctx,role,text){
  ctx=ctx||'desk';
  const c=document.getElementById(AI_IDS[ctx]?AI_IDS[ctx].msgs:'deskAiMsgs');if(!c)return;
  const d=document.createElement('div');
  d.className='ai-msg '+(role==='user'?'user':'sys');
  d.innerHTML=esc(text).replace(/\n/g,'<br>');
  c.appendChild(d);c.scrollTop=c.scrollHeight;
}
function updateAIDots(ctx){
  ctx=ctx||'desk';
  const ids=AI_IDS[ctx]||AI_IDS.desk;
  const bar=document.getElementById(ids.limitBar),dots=document.getElementById(ids.dots);
  if(!bar||!dots)return;
  const used=AI[ctx].count||0;
  const remain=Math.max(0,MAX_AI-used);
  bar.style.display=used>0?'flex':'none';
  dots.innerHTML=Array(MAX_AI).fill(0).map((_,i)=>`<span class="ai-limit-dot${i<remain?' active':''}"></span>`).join('');
}
async function sendAIMsg(ctx){
  ctx=ctx||'desk';
  const ids=AI_IDS[ctx]||AI_IDS.desk;
  const inp=document.getElementById(ids.inp);if(!inp)return;
  const msg=inp.value.trim();if(!msg)return;
  const st=AI[ctx];
  if(st.conv.filter(m=>m.role==='user').length>=MAX_AI){toast('وصلت للحد الأقصى ('+MAX_AI+' رسائل). ابدأ محادثة جديدة.',true);return;}
  if(st.busy)return;
  inp.value='';appendAIMsg(ctx,'user',msg);
  st.conv.push({role:'user',content:msg});
  st.count=(st.count||0)+1;
  updateAIDots(ctx);
  st.busy=true;
  try{
    const r=await api('ai.chat',{messages:st.conv,device:st.device});
    const reply=r&&r.success&&r.reply?r.reply:'عذراً، لم أتمكن من معالجة طلبك.';
    appendAIMsg(ctx,'assistant',reply);
    st.conv.push({role:'assistant',content:reply});
  }catch(e){appendAIMsg(ctx,'assistant','حدث خطأ. حاول مرة أخرى.');}
  st.busy=false;
}
function resetAI(ctx){
  ctx=ctx||'desk';
  const ids=AI_IDS[ctx]||AI_IDS.desk;
  AI[ctx]={conv:[],device:'',busy:false,count:0,sys:''};
  const c=document.getElementById(ids.msgs);if(c)c.innerHTML='';
  const sel=document.getElementById(ids.devSel);
  if(sel)sel.querySelectorAll('.ai-dev-chip').forEach(b=>b.classList.remove('selected'));
  const inp=document.getElementById(ids.inp),send=document.getElementById(ids.send);
  if(inp)inp.disabled=true;if(send)send.disabled=true;
  const bar=document.getElementById(ids.limitBar);if(bar)bar.style.display='none';
  appendAIMsg(ctx,'assistant','👋 اختر نوع الجهاز أعلاه للبدء');
}
function openMobAI(){mobTab('mb-ai',1);resetAI('mob');fetchITKnowledge();}
