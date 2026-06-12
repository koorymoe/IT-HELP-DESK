'use strict';
/* ── INTERNET USERS ── */

async function loadInternetUsers(){
  const el=document.getElementById('iuTbody');if(!el)return;
  el.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px">'+skel(2)+'</td></tr>';
  try{
    const r=await api('internet.users.list');
    if(!r||!r.success){el.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;opacity:.5">فشل التحميل</td></tr>';return;}
    S.inetUsers=r.users||[];
    renderIUsers(S.inetUsers);
  }catch(e){el.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;opacity:.5">خطأ</td></tr>';}
}

function filterIUsers(){
  const sf=(document.getElementById('iu-q')||{}).value?.trim().toLowerCase()||'';
  renderIUsers((S.inetUsers||[]).filter(u=>!sf||((u.name||'')+(u.username||'')).toLowerCase().includes(sf)));
}

function renderIUsers(users){
  const el=document.getElementById('iuTbody');if(!el)return;
  if(!users.length){el.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;opacity:.5">لا يوجد مستخدمين</td></tr>';return;}
  el.innerHTML=users.map(u=>`<tr>
    <td style="font-family:monospace;font-size:.85rem">${esc(u.empId||'—')}</td>
    <td>${esc(u.name||'—')}</td>
    <td>${esc(u.dept||'—')}</td>
    <td style="font-family:monospace" dir="ltr">${esc(u.username||'—')}</td>
    <td style="font-size:.78rem;opacity:.6">${esc(u.updatedAt||'—')}</td>
    <td><span class="badge" style="background:${u.active?'var(--gr-l)':'var(--re-l)'};color:${u.active?'var(--gr-d)':'#b91c1c'}">${u.active?'نشط':'موقوف'}</span></td>
  </tr>`).join('');
}

async function searchInternetUser(){
  const empId=document.getElementById('iu-search-id').value.trim();
  const el=document.getElementById('iu-search-result');
  if(!empId){toast('ادخل رقم البصمة',true);return;}
  el.innerHTML=skel(1);
  try{
    const r=await api('internet.users.search',{empId});
    if(!r||!r.success){el.innerHTML=`<div class="empty"><i class="fas fa-search"></i><h3>${esc(r?r.message:'غير موجود')}</h3></div>`;return;}
    const iu=r.internetUser;
    el.innerHTML=`<div class="ig" style="margin-top:12px">
      <div class="ig-i"><label>الاسم</label><strong>${esc(r.user.firstName)} ${esc(r.user.lastName)}</strong></div>
      <div class="ig-i"><label>القسم</label><strong>${esc(r.user.dept||'—')}</strong></div>
      <div class="ig-i"><label>يوزر الإنترنت</label><strong style="font-family:monospace" dir="ltr">${iu?esc(iu.username):'غير مُعيَّن'}</strong></div>
    </div>`;
  }catch(e){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>خطأ</h3></div>';}
}

async function subInternetUser(){
  const empId=document.getElementById('iu-eid').value.trim();
  const username=document.getElementById('iu-user').value.trim();
  if(!empId||!username){toast('يرجى ملء جميع الحقول',true);return;}
  try{
    const{data:user}=await sb.from('users').select('*').eq('emp_id',empId).maybeSingle();
    if(!user){toast('الموظف غير موجود',true);return;}
    const{data:iu}=await sb.from('internet_users').select('id').ilike('name',`%${user.name}%`).maybeSingle();
    const r=await api('internet.users.update',{id:iu?iu.id:null,name:user.name,dept:user.dept,username});
    if(r&&r.success){toast('✅ '+r.message);['iu-eid','iu-user'].forEach(id=>document.getElementById(id).value='');loadInternetUsers();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
