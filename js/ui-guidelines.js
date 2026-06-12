'use strict';
/* ── GUIDELINES ── */
async function loadGuidelinesTab(){
  const el=document.getElementById('guideList');if(!el)return;
  el.innerHTML='<div class="skel skel-c"></div>';
  try{
    const r=await api('guidelines.list');
    if(!r||!r.success){el.innerHTML='<p style="opacity:.5;text-align:center">لا يوجد إرشادات</p>';return;}
    renderGuideList(r.guidelines||[]);
  }catch(e){el.innerHTML='<p style="color:red">خطأ</p>';}
}
function renderGuideList(items){
  const el=document.getElementById('guideList');if(!el)return;
  const isAdmin=S.user&&['admin','it_manager'].includes(S.user.role);
  const addBtn=document.getElementById('addGuideBtn');if(addBtn)addBtn.style.display=isAdmin?'':'none';
  if(!items.length){el.innerHTML='<p style="opacity:.5;text-align:center;padding:32px">لا يوجد إرشادات بعد</p>';return;}
  el.innerHTML=items.map(i=>`
  <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:12px;display:flex;gap:16px;align-items:flex-start">
    <div style="width:44px;height:44px;border-radius:12px;background:var(--in-l);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.3rem">
      ${esc(i.icon||'⚠️')}
    </div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <strong style="font-size:1rem">${esc(i.title)}</strong>
        <span style="font-size:.72rem;background:var(--am-l);color:var(--am);padding:2px 8px;border-radius:20px;font-weight:700">${esc(i.priority||'مهم')}</span>
      </div>
      <p style="margin:0;opacity:.75;font-size:.88rem;line-height:1.7">${esc(i.content)}</p>
    </div>
    ${isAdmin?`<div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn-sm" onclick='editGuide(${JSON.stringify(i.id)},${JSON.stringify(i.title)},${JSON.stringify(i.content)},${JSON.stringify(i.icon||'')},${JSON.stringify(i.priority||'')})' title="تعديل"><i class="fas fa-edit"></i></button>
      <button class="btn-sm btn-danger" onclick="deleteGuide('${esc(i.id)}')" title="حذف"><i class="fas fa-trash"></i></button>
    </div>`:''}
  </div>`).join('');
}
function editGuide(id,title,content,icon,priority){
  document.getElementById('gm-id').value=id;
  document.getElementById('gm-title').value=title;
  document.getElementById('gm-content').value=content;
  if(icon)pickGuideIcon(document.querySelector(`#ovAddGuide .dev-chip[onclick*="${icon}"]`)||document.querySelector('#ovAddGuide .dev-chip'),icon);
  if(priority)document.getElementById('gm-priority').value=priority;
  document.getElementById('guideModalTitle').textContent='تعديل توجيه';
  openM('ovAddGuide');
}
function openGuideModal(){
  document.getElementById('gm-id').value='';
  document.getElementById('gm-title').value='';
  document.getElementById('gm-content').value='';
  document.getElementById('gm-priority').value='مهم';
  document.getElementById('gm-icon').value='⚠️';
  document.querySelectorAll('#ovAddGuide .dev-chip').forEach((b,i)=>b.classList.toggle('selected',i===0));
  document.getElementById('guideModalTitle').textContent='إضافة توجيه';
  openM('ovAddGuide');
}
function pickGuideIcon(btn,ic){
  document.getElementById('gm-icon').value=ic;
  document.querySelectorAll('#ovAddGuide .dev-chip').forEach(b=>b.classList.toggle('selected',b===btn));
}
async function subGuide(e){
  if(e&&e.preventDefault)e.preventDefault();
  const id=document.getElementById('gm-id').value;
  const title=document.getElementById('gm-title').value.trim(),content=document.getElementById('gm-content').value.trim();
  const icon=(document.getElementById('gm-icon')||{value:'⚠️'}).value||'⚠️';
  const priority=document.getElementById('gm-priority').value;
  if(!title||!content){toast('يرجى ملء جميع الحقول',true);return;}
  try{
    const action=id?'guidelines.update':'guidelines.add';
    const r=await api(action,{id,title,content,icon,priority});
    if(r&&r.success){toast('✅ '+(id?'تم التعديل':'تمت الإضافة'));document.getElementById('gm-id').value='';document.getElementById('guideModalTitle').textContent='إضافة توجيه';closeM('ovAddGuide');loadGuidelinesTab();}
    else toast(r?r.message:'خطأ',true);
  }catch(err){toast('خطأ',true);}
}
async function deleteGuide(id){
  if(!confirm('حذف هذا الإرشاد؟'))return;
  try{
    const r=await api('guidelines.delete',{id});
    if(r&&r.success){toast('✅ تم الحذف');loadGuidelinesTab();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── MOBILE SUPPORT ── */
function openMobGuidelines(){mobTab('mb-guidelines',1);loadMobGuidelines();}
async function loadMobGuidelines(){
  const el=document.getElementById('mobGuideList');if(!el)return;
  el.innerHTML='<div class="skel skel-c"></div>';
  try{
    const r=await api('guidelines.list');
    if(!r||!r.success){el.innerHTML='<p style="opacity:.5;text-align:center">لا يوجد إرشادات</p>';return;}
    const items=r.guidelines||[];
    if(!items.length){el.innerHTML='<p style="opacity:.5;text-align:center;padding:32px">لا يوجد إرشادات بعد</p>';return;}
    el.innerHTML=items.map(i=>`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:1.2rem">${esc(i.icon||'⚠️')}</span>
        <strong style="font-size:.95rem">${esc(i.title)}</strong>
      </div>
      <p style="margin:0;opacity:.75;font-size:.85rem;line-height:1.7">${esc(i.content)}</p>
    </div>`).join('');
  }catch(e){el.innerHTML='<p style="color:red">خطأ</p>';}
}
