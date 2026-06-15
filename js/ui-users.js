'use strict';
/* ── USERS ── */

async function fetchUsers(){try{const r=await api('users.list');if(r&&r.success){S.users=r.users;return r.users;}return[];}catch(e){return[];}}

async function loadUsers(){
  const u=document.getElementById('uTbody');if(!u)return;
  u.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px">'+skel(3)+'</td></tr>';
  const users=await fetchUsers();
  renderUsers(users);
}

function filterUsers(){
  const sf=(document.getElementById('uQ')||{}).value?.trim().toLowerCase()||'';
  renderUsers(S.users.filter(u=>{
    if(sf&&!((u.firstName+' '+u.lastName+(u.email||'')+(u.empId||'')).toLowerCase().includes(sf)))return false;
    return true;
  }));
}

function renderUsers(users){
  const u=document.getElementById('uTbody');if(!u)return;
  if(!users.length){u.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;opacity:.5">لا يوجد مستخدمون</td></tr>';return;}
  u.innerHTML=users.map(u=>`
  <tr>
    <td style="font-family:monospace;font-size:.85rem">${esc(u.empId||'—')}</td>
    <td><div style="font-weight:600">${esc(u.firstName)} ${esc(u.lastName)}</div><div style="font-size:.78rem;opacity:.6">${esc(u.email||'')}</div></td>
    <td>${esc(u.department||u.dept||'—')}</td>
    <td><span class="badge" style="background:var(--in-l);color:var(--in)">${ROLE_L[u.role]||u.role}</span></td>
    <td><span class="badge" style="background:${u.active?'var(--gr-l)':'var(--re-l)'};color:${u.active?'var(--gr-d)':'#b91c1c'}">${u.active?'نشط':'موقوف'}</span></td>
    <td style="font-size:.78rem;opacity:.6">${u.lastLogin?new Date(u.lastLogin).toLocaleString('ar-IQ',{dateStyle:'short',timeStyle:'short'}):'—'}</td>
    <td>
      <button class="btn-sm" onclick="openPwModal('${esc(u.id)}','${esc(u.firstName)} ${esc(u.lastName)}')" title="تغيير كلمة المرور"><i class="fas fa-key"></i></button>
      <button class="btn-sm" onclick="togUser('${esc(u.id)}',${!u.active})" title="${u.active?'إيقاف':'تفعيل'}"><i class="fas fa-${u.active?'ban':'check'}"></i></button>
      <button class="btn-sm btn-danger" onclick="delUser('${esc(u.id)}')" title="حذف"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}

function onRoleChange(val){
  const r=val||document.getElementById('nu-ro').value;
  const emailRow=document.getElementById('email-row');
  if(emailRow)emailRow.style.display=(r==='user')?'none':'';
}

async function subUser(e){
  if(e&&e.preventDefault)e.preventDefault();
  const fn=(document.getElementById('nu-f')||{value:''}).value.trim();
  const ln=(document.getElementById('nu-l')||{value:''}).value.trim();
  const empId=(document.getElementById('nu-id')||{value:''}).value.trim();
  const ph=(document.getElementById('nu-ph')||{value:''}).value.trim();
  const em=(document.getElementById('nu-em')||{value:''}).value.trim();
  const pw=(document.getElementById('nu-pw')||{value:''}).value;
  const rl=(document.getElementById('nu-ro')||{value:'user'}).value;
  const dp=(document.getElementById('nu-dp')||{value:''}).value.trim();
  const dv=(document.getElementById('nu-dev')||{value:''}).value.trim();
  if(!fn||!ln||!empId||!pw){toast('يرجى ملء جميع الحقول المطلوبة',true);return;}
  try{
    const r=await api('users.create',{firstName:fn,lastName:ln,empId:empId,phone:ph,email:em,password:pw,role:rl,department:dp,deviceId:dv});
    if(r&&r.success){
      toast('✅ '+r.message);
      ['nu-f','nu-l','nu-id','nu-ph','nu-em','nu-pw','nu-dev'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      goTab('users',document.querySelector('[data-t="users"]'));
    }else toast(r?r.message:'خطأ',true);
  }catch(err){toast('خطأ',true);}
}

function openPwModal(uid,name){S.pwUid=uid;const nm=document.getElementById('pwModalName');if(nm)nm.textContent=name;const inp=document.getElementById('pw-new');if(inp)inp.value='';openM('pwModal');}
function closePwModal(){closeM('pwModal');}
async function submitPwReset(){
  const np=document.getElementById('pw-new').value;
  if(!np||np.length<4){toast('كلمة المرور قصيرة جداً',true);return;}
  try{
    const r=await api('users.resetPassword',{userId:S.pwUid,newPassword:np});
    if(r&&r.success){toast('✅ تم تغيير كلمة المرور');closePwModal();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function togUser(uid,active){
  try{
    const r=await api('users.setActive',{userId:uid,active});
    if(r&&r.success){toast('✅ '+r.message);loadUsers();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function delUser(uid){
  if(!confirm('حذف هذا المستخدم نهائياً؟'))return;
  try{
    const r=await api('users.delete',{userId:uid});
    if(r&&r.success){toast('✅ تم الحذف');loadUsers();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── DEPARTMENTS ── */
async function loadDepts(){
  const el=document.getElementById('deptList');
  try{
    const r=await api('departments.list');
    const depts=(r&&r.success)?r.departments||[]:[];
    DEPTS=depts;
    if(el){
      el.innerHTML=depts.length?depts.map(d=>`<div class="guide-card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <span style="flex:1"><i class="fas fa-building" style="margin-left:8px;color:var(--in)"></i>${esc(d.name)}</span>
        <input value="${esc(d.network_label||'')}" placeholder="رمز الشبكة" dir="ltr" style="width:110px;padding:6px 10px;font-size:11px" onchange="saveDeptNetwork('${esc(d.id)}',this.value)"/>
        ${['admin','it_manager'].includes(S.user?.role)?`<button class="btn-sm btn-danger" onclick="deleteDept('${esc(d.id)}')"><i class="fas fa-trash"></i></button>`:''}
      </div>`).join(''):'<p style="opacity:.5;text-align:center;padding:32px">لا يوجد أقسام بعد</p>';
    }
    const nuDp=document.getElementById('nu-dp');
    if(nuDp){nuDp.innerHTML='<option value="">اختر القسم...</option>'+depts.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');}
  }catch(e){if(el)el.innerHTML='<p style="color:red">خطأ</p>';}
}
async function addDept(){
  const inp=document.getElementById('dept-new');
  const name=inp?inp.value.trim():'';
  if(!name){toast('أدخل اسم القسم',true);return;}
  try{
    const r=await api('departments.add',{name});
    if(r&&r.success){toast('✅ تمت الإضافة');if(inp)inp.value='';loadDepts();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function saveDeptNetwork(id,val){
  try{
    const r=await api('departments.update',{id,networkLabel:val.trim()});
    if(r&&r.success){toast('✅ تم الحفظ');loadDepts();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function deleteDept(id){
  if(!confirm('حذف هذا القسم؟'))return;
  try{
    const r=await api('departments.delete',{id});
    if(r&&r.success){toast('✅ تم الحذف');loadDepts();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
