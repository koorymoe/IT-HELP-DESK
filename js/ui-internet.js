'use strict';
/* ── INTERNET USERS ── */

async function loadInternetUsers(){
  const el=document.getElementById('iuTbody');if(!el)return;
  el.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px">'+skel(2)+'</td></tr>';
  try{
    const r=await api('internet.users.list');
    if(!r||!r.success){el.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;opacity:.5">فشل التحميل</td></tr>';return;}
    S.inetUsers=r.users||[];
    renderIUsers(S.inetUsers);
  }catch(e){el.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;opacity:.5">خطأ</td></tr>';}
  const devCard=document.getElementById('devUserCard');
  if(devCard){
    if(['admin','it_manager'].includes(S.user?.role)){devCard.style.display='';loadDeviceUsernames();}
    else devCard.style.display='none';
  }
}

/* ── DEVICE-USERNAME MAPPING (admin) ── */
async function loadDeviceUsernames(){
  const tb=document.getElementById('duTbody');if(!tb)return;
  tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px">'+skel(2)+'</td></tr>';
  try{
    const r=await api('device.username.list');
    if(!r||!r.success){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px;opacity:.5">فشل التحميل</td></tr>';return;}
    S.devUsers=r.items||[];
    renderDeviceUsernames(S.devUsers);
  }catch(e){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px;opacity:.5">خطأ</td></tr>';}
}
function filterDeviceUsernames(){
  const sf=(document.getElementById('du-q')||{}).value?.trim().toLowerCase()||'';
  const net=(document.getElementById('du-net-filter')||{}).value||'';
  const status=(document.getElementById('du-status-filter')||{}).value||'';
  renderDeviceUsernames((S.devUsers||[]).filter(d=>{
    if(net&&d.networkLabel!==net)return false;
    if(status==='new'&&d.assignedTo)return false;
    if(status==='used'&&!d.assignedTo)return false;
    return !sf||((d.username||'')+(d.deviceId||'')+(d.assignedTo||'')+(d.networkLabel||'')).toLowerCase().includes(sf);
  }));
}
function renderDeviceUsernames(items){
  const tb=document.getElementById('duTbody');if(!tb)return;
  const sel=document.getElementById('du-net-filter');
  if(sel&&!sel.dataset.filled){
    const nets=[...new Set((S.devUsers||[]).map(d=>d.networkLabel).filter(Boolean))].sort();
    sel.innerHTML='<option value="">كل الشبكات</option>'+nets.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sel.dataset.filled='1';
  }
  if(!items.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px;opacity:.5">لا توجد بيانات</td></tr>';return;}
  tb.innerHTML=items.map(d=>`<tr>
    <td>${esc(d.networkLabel)}</td>
    <td style="font-family:monospace">${esc(d.deviceId)}</td>
    <td style="font-family:monospace">${esc(d.username)}</td>
    <td style="font-family:monospace">${esc(d.password||'—')}</td>
    <td><input value="${esc(d.notes||'')}" placeholder="ملاحظة..." style="width:100%;padding:4px 6px;font-size:11px" onchange="updateDeviceUsernameNotes('${esc(d.id)}',this.value)"/></td>
    <td>${d.assignedTo?`<span class="badge" style="background:var(--gr-l);color:var(--gr-d)">مستخدم: ${esc(d.assignedTo)}</span>`:'<span class="badge" style="background:var(--in-l);color:var(--in)">متاح</span>'}</td>
    <td style="white-space:nowrap">
      ${!d.assignedTo?`<button class="btn-sm" onclick="assignDeviceUsername('${esc(d.id)}')" title="تعيين لموظف"><i class="fas fa-user-plus"></i></button>`:''}
      <button class="btn-sm btn-danger" onclick="delDeviceUsername('${esc(d.id)}')"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}
async function updateDeviceUsernameNotes(id,notes){
  try{
    const r=await api('device.username.update',{id,notes:notes.trim()});
    if(r&&r.success){toast('✅ تم الحفظ');const it=(S.devUsers||[]).find(d=>d.id===id);if(it)it.notes=notes.trim();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function addDeviceUsername(){
  const net=(document.getElementById('du-net')||{}).value?.trim()||'';
  const dev=(document.getElementById('du-dev')||{}).value?.trim()||'';
  const usr=(document.getElementById('du-user')||{}).value?.trim()||'';
  const pass=(document.getElementById('du-pass')||{}).value?.trim()||'';
  const notes=(document.getElementById('du-notes')||{}).value?.trim()||'';
  if(!net||!dev||!usr){toast('يرجى تعبئة الشبكة ورقم الجهاز واليوزر',true);return;}
  try{
    const r=await api('device.username.add',{networkLabel:net,deviceId:dev,username:usr,password:pass,notes});
    if(r&&r.success){toast('✅ '+r.message);['du-net','du-dev','du-user','du-pass','du-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});loadDeviceUsernames();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function delDeviceUsername(id){
  if(!confirm('حذف هذا الربط؟'))return;
  try{
    const r=await api('device.username.delete',{id});
    if(r&&r.success){toast('✅ تم الحذف');loadDeviceUsernames();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function assignDeviceUsername(rowId){
  const empId=prompt('أدخل رقم البصمة (Employee ID) للموظف المراد تعيينه:');
  if(!empId)return;
  try{
    const users=S.users.length?S.users:await fetchUsers();
    const u=users.find(x=>String(x.empId).trim()===empId.trim());
    if(!u){toast('لا يوجد موظف بهذا رقم البصمة',true);return;}
    const r=await api('device.username.assign',{deviceRowId:rowId,userId:u.id});
    if(r&&r.success){toast('✅ '+r.message);loadDeviceUsernames();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

function filterIUsers(){
  const sf=(document.getElementById('iu-q')||{}).value?.trim().toLowerCase()||'';
  renderIUsers((S.inetUsers||[]).filter(u=>!sf||((u.name||'')+(u.username||'')+(u.empId||'')+(u.networkLabel||'')).toLowerCase().includes(sf)));
}

function renderIUsers(users){
  const el=document.getElementById('iuTbody');if(!el)return;
  if(!users.length){el.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;opacity:.5">لا يوجد مستخدمين</td></tr>';return;}
  el.innerHTML=users.map(u=>`<tr>
    <td style="font-family:monospace;font-size:.85rem">${esc(u.empId||'—')}</td>
    <td>${esc(u.name||'—')}</td>
    <td>${esc(u.dept||'—')}</td>
    <td style="font-family:monospace" dir="ltr">${esc(u.networkLabel||'—')}</td>
    <td style="font-family:monospace" dir="ltr">${esc(u.username||'—')}</td>
    <td style="font-size:.78rem;opacity:.6">${esc(u.updatedAt||'—')}</td>
    <td>
      <span class="badge" style="background:${u.active?'var(--gr-l)':'var(--re-l)'};color:${u.active?'var(--gr-d)':'#b91c1c'}">${u.active?'نشط':'موقوف'}</span>
      <button class="btn-sm btn-danger" onclick="deleteIUser('${esc(u.id)}')" title="حذف"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}

async function deleteIUser(id){
  if(!confirm('حذف هذا الحساب؟'))return;
  try{
    const r=await api('internet.users.delete',{id});
    if(r&&r.success){toast('✅ '+r.message);loadInternetUsers();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

async function searchInternetUser(){
  const empId=document.getElementById('iu-search-id').value.trim();
  const el=document.getElementById('iu-search-result');
  if(!empId){toast('ادخل رقم البصمة',true);return;}
  el.innerHTML=skel(1);
  try{
    const r=await api('internet.users.search',{empId});
    if(!r||!r.success){el.innerHTML=`<div class="empty"><i class="fas fa-search"></i><h3>${esc(r?r.message:'غير موجود')}</h3></div>`;return;}
    const list=r.internetUsers||[];
    const accountsHtml=list.length
      ? list.map(iu=>`<div class="ig-i"><label>${esc(iu.network_label||'حساب')}</label><strong style="font-family:monospace" dir="ltr">${esc(iu.username||'—')}</strong></div>`).join('')
      : `<div class="ig-i"><label>يوزر الإنترنت</label><strong>غير مُعيَّن</strong></div>`;
    el.innerHTML=`<div class="ig" style="margin-top:12px">
      <div class="ig-i"><label>الاسم</label><strong>${esc(r.user.firstName)} ${esc(r.user.lastName)}</strong></div>
      <div class="ig-i"><label>القسم</label><strong>${esc(r.user.dept||'—')}</strong></div>
      ${accountsHtml}
    </div>`;
  }catch(e){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>خطأ</h3></div>';}
}

async function subInternetUser(){
  const empId=document.getElementById('iu-eid').value.trim();
  const username=document.getElementById('iu-user').value.trim();
  const networkLabel=(document.getElementById('iu-net')||{}).value?.trim()||'';
  if(!empId||!username){toast('يرجى ملء جميع الحقول',true);return;}
  try{
    const{data:user}=await sb.from('users').select('*').eq('emp_id',empId).maybeSingle();
    if(!user){toast('الموظف غير موجود',true);return;}
    const r=await api('internet.users.update',{empId,name:user.name,dept:user.dept,networkLabel,username});
    if(r&&r.success){toast('✅ '+r.message);['iu-eid','iu-user','iu-net'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});loadInternetUsers();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
