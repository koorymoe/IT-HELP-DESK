'use strict';
/* ── MANUAL ── */
let manSteps=[];
async function loadManualTab(devName){
  const el=document.getElementById('manualList');if(!el)return;
  el.innerHTML='<div class="skel skel-c"></div>';
  try{
    const r=await api('manual.list');
    if(!r||!r.success){el.innerHTML='<p style="opacity:.5;text-align:center">لا يوجد دليل</p>';return;}
    renderManualList((r.entries||[]).filter(i=>!devName||i.device===devName));
  }catch(e){el.innerHTML='<p style="color:red">خطأ</p>';}
}
function switchDeskDev(btn,name){
  document.querySelectorAll('#deskDevTabs .dev-tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  loadManualTab(name||'');
}
function renderManualList(items){
  const el=document.getElementById('manualList');if(!el)return;
  const isAdmin=S.user&&['admin','it_manager'].includes(S.user.role);
  const addBtn=document.getElementById('addManualBtn');if(addBtn)addBtn.style.display=isAdmin?'':'none';
  if(!items.length){el.innerHTML='<p style="opacity:.5;text-align:center;padding:32px">لا يوجد بعد</p>';return;}
  const devLabel={'desktop':'🖥️ الحاسبة','laptop':'💻 لابتوب','printer':'🖨️ طابعة','network':'🌐 شبكة','phone':'📱 هاتف','other':'🔧 أخرى'};
  el.innerHTML=items.map(i=>`
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:12px">
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--pu-l);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.3rem">
        ${esc(i.icon||'📘')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <strong style="font-size:1rem">${esc(i.title)}</strong>
          ${i.device?`<span style="font-size:.72rem;background:var(--pu-l);color:var(--pu);padding:2px 8px;border-radius:20px;font-weight:700">${devLabel[i.device]||esc(i.device)}</span>`:''}
        </div>
        ${i.desc?`<p style="margin:0 0 10px;opacity:.65;font-size:.85rem">${esc(i.desc)}</p>`:''}
        ${i.steps&&i.steps.length?`<ol style="margin:0;padding-right:20px;padding-left:0">${i.steps.map(s=>`<li style="opacity:.8;font-size:.88rem;margin-bottom:6px;line-height:1.6">${esc(s)}</li>`).join('')}</ol>`:''}
      </div>
      ${isAdmin?`<div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-sm btn-danger" onclick="deleteManual('${esc(i.id)}')" title="حذف"><i class="fas fa-trash"></i></button>
      </div>`:''}
    </div>
  </div>`).join('');
}
function addStep(){
  manSteps.push('');
  renderStepsList();
}
function removeStep(i){manSteps.splice(i,1);renderStepsList();}
function updateStep(i,val){manSteps[i]=val;}
function renderStepsList(){
  const el=document.getElementById('stepsList');if(!el)return;
  el.innerHTML=manSteps.map((s,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <span style="font-size:.85rem">${i+1}.</span>
    <input class="step-inp" value="${esc(s)}" oninput="updateStep(${i},this.value)" style="flex:1"/>
    <button class="btn-sm btn-danger" type="button" onclick="removeStep(${i})"><i class="fas fa-times"></i></button>
  </div>`).join('');
}
function pickManualIcon(btn,ic){
  document.getElementById('mm-icon').value=ic;
  document.querySelectorAll('#ovAddManual .dev-chip').forEach(b=>b.classList.toggle('selected',b===btn));
}
function openManualModal(){
  document.getElementById('mm-id').value='';
  document.getElementById('mm-device').value='desktop';
  document.getElementById('mm-prob').value='';
  document.getElementById('mm-title').value='';
  document.getElementById('mm-desc').value='';
  document.getElementById('mm-icon').value='💻';
  document.getElementById('manualModalTitle').textContent='إضافة دليل';
  manSteps=[];renderStepsList();openM('ovAddManual');
}
async function subManual(e){
  if(e&&e.preventDefault)e.preventDefault();
  const title=document.getElementById('mm-title').value.trim();
  const deviceType=document.getElementById('mm-device').value;
  const desc=document.getElementById('mm-desc').value.trim();
  const icon=document.getElementById('mm-icon').value;
  const steps=manSteps.filter(s=>s&&s.trim());
  if(!title){toast('أدخل العنوان',true);return;}
  try{
    const r=await api('manual.add',{title,deviceType,desc,steps,icon});
    if(r&&r.success){toast('✅ تمت الإضافة');closeM('ovAddManual');manSteps=[];loadManualTab('');}
    else toast(r?r.message:'خطأ',true);
  }catch(err){toast('خطأ',true);}
}
async function deleteManual(id){
  if(!confirm('حذف هذا الدليل؟'))return;
  try{
    const r=await api('manual.delete',{id});
    if(r&&r.success){toast('✅ تم الحذف');loadManualTab('');}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── MOBILE MANUAL ── */
function openMobManual(){mobTab('mb-manual',1);loadMobManual('');}
function switchMobDev(btn,name){
  document.querySelectorAll('#mobManualDevRow .dev-chip').forEach(b=>b.classList.remove('selected'));
  if(btn)btn.classList.add('selected');
  loadMobManual(name||'');
}
async function loadMobManual(devName){
  const el=document.getElementById('mobManualList');if(!el)return;
  el.innerHTML='<div class="skel skel-c"></div>';
  try{
    const r=await api('manual.list');
    if(!r||!r.success){el.innerHTML='<p style="opacity:.5;text-align:center">لا يوجد محتوى</p>';return;}
    const items=(r.entries||[]).filter(i=>!devName||i.device===devName);
    if(!items.length){el.innerHTML='<p style="opacity:.5;text-align:center;padding:32px">لا يوجد محتوى لهذا الجهاز</p>';return;}
    el.innerHTML=items.map(i=>`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:1.2rem">${esc(i.icon||'📘')}</span>
        <strong style="font-size:.95rem">${esc(i.title)}</strong>
      </div>
      ${i.desc?`<p style="margin:0 0 8px;opacity:.65;font-size:.85rem">${esc(i.desc)}</p>`:''}
      ${i.steps&&i.steps.length?`<ol style="margin:0;padding-right:20px;padding-left:0">${i.steps.map(s=>`<li style="opacity:.8;font-size:.85rem;margin-bottom:5px;line-height:1.6">${esc(s)}</li>`).join('')}</ol>`:''}
    </div>`).join('');
  }catch(e){el.innerHTML='<p style="color:red">خطأ</p>';}
}
