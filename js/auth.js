'use strict';
/* ── AUTH (custom emp_id + password against `users` table) ── */

function splitName(name){
  name=(name||'').trim();
  if(!name)return{firstName:'',lastName:''};
  const parts=name.split(/\s+/);
  return{firstName:parts[0],lastName:parts.slice(1).join(' ')};
}

function mapUserRow(row){
  if(!row)return null;
  const{firstName,lastName}=splitName(row.name);
  return{
    id:row.id,
    empId:row.emp_id,
    firstName,lastName,
    name:row.name,
    role:row.role,
    dept:row.dept,
    department:row.dept,
    email:row.email,
    phone:row.phone,
    active:row.active,
    internet:row.internet,
    lastLogin:row.last_login||null
  };
}

async function doLogin(){
  const empId=document.getElementById('li-id').value.trim();
  const pw=document.getElementById('li-pw').value;
  const errEl=document.getElementById('lgErr'),btn=document.getElementById('lgBtn');
  errEl.style.display='none';
  if(!empId){showE('ادخل رقم البصمة');return;}
  if(!pw){showE('ادخل الرمز السري');return;}
  btn.innerHTML='<span class="spin"></span> جارٍ التحقق...';btn.disabled=true;
  try{
    const{data,error}=await sb.from('users').select('*').eq('emp_id',empId).maybeSingle();
    if(error||!data){showE('بيانات الدخول غير صحيحة');return;}
    if(data.password!==pw){showE('بيانات الدخول غير صحيحة');return;}
    if(data.active===false){showE('الحساب غير مفعل');return;}
    S.user=mapUserRow(data);
    saveSession(S.user);
    enterApp();
  }catch(e){showE('خطأ في الاتصال — حاول مجدداً');}
  finally{btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-left:6px"></i>تسجيل الدخول';btn.disabled=false;}
  function showE(m){errEl.textContent=m;errEl.style.display='block';}
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('loginPage').classList.contains('active'))doLogin();});

function saveSession(user){
  try{localStorage.setItem('hd_user',JSON.stringify(user));}catch(e){}
}
function loadSession(){
  try{const r=localStorage.getItem('hd_user');return r?JSON.parse(r):null;}catch(e){return null;}
}
function clearSession(){
  try{localStorage.removeItem('hd_user');}catch(e){}
}

async function checkSession(){
  const u=loadSession();
  if(!u)return;
  S.user=u;
  enterApp();
}

function doLogout(){
  if(S.poll)clearInterval(S.poll);
  S.user=null;S.tickets=[];S.users=[];S.notifs=[];
  Object.values(S.charts).forEach(c=>{try{c.destroy();}catch(e){}});S.charts={};
  cc();clearSession();showPage('loginPage');
  document.getElementById('li-id').value='';document.getElementById('li-pw').value='';
  document.getElementById('appPage').className='page app';
}

/* ── ENTER APP ── */
function enterApp(){
  const u=S.user,ini=(u.firstName[0]||'')+(u.lastName[0]||'');
  const role=u.role;
  if(role==='user'){
    showPage('appPage');
    document.getElementById('appPage').classList.add('force-mobile-view');
    const av=document.getElementById('mob-av');if(av)av.textContent=ini;
    loadUserHome();mobTab('mb-home',0);
    loadTopbarInternetUser();
    return;
  }
  document.getElementById('sb-av').textContent=ini;
  document.getElementById('sb-n').textContent=u.firstName+' '+u.lastName;
  document.getElementById('sb-r').textContent=ROLE_L[role]||role;
  document.getElementById('tb-av').textContent=ini;
  const isIT=['it','it_manager','admin'].includes(role);
  const isMgr=['manager','it_manager','admin'].includes(role);
  const isAdmin=role==='admin';
  const isStaff=['it','manager','it_manager','admin'].includes(role);
  document.querySelectorAll('.s-staff').forEach(el=>el.style.display=isStaff?'':'none');
  document.querySelectorAll('.s-it').forEach(el=>el.style.display=isIT?'':'none');
  document.querySelectorAll('.s-mgr').forEach(el=>el.style.display=isMgr?'':'none');
  document.querySelectorAll('.s-admin').forEach(el=>el.style.display=isAdmin?'':'none');
  document.querySelectorAll('.opt-admin').forEach(el=>el.style.display=isAdmin?'':'none');
  document.querySelectorAll('.s-tech').forEach(el=>el.style.display=role==='tech'?'':'none');
  const techSec=document.getElementById('techRepairSection');
  if(techSec)techSec.style.display=role==='tech'?'':'none';
  if(isIT){document.getElementById('bellBtn').style.display='';reqNotifPerm();S.lastCheck=new Date().toISOString();S.poll=setInterval(pollNotifs,90000);}
  showPage('appPage');loadDepts();
  loadTopbarInternetUser();
  checkURLParams();
  if(role==='tech'){loadTopbarInternetUser();goTab('tech-stats',document.querySelector('[data-t="tech-stats"]'));return;}
  if(role==='manager'){goTab('tickets',document.querySelector('[data-t="tickets"]'));return;}
  goTab('dashboard',document.querySelector('[data-t="dashboard"]'));
}

async function loadTopbarInternetUser(){
  try{
    const r=await api('user.myInfo');
    if(r&&r.success&&r.internetUsers&&r.internetUsers.length){
      const badge=document.getElementById('tb-iuser');
      const val=document.getElementById('tb-iuser-val');
      const txt=r.internetUsers.map(iu=>(iu.network_label?iu.network_label+': ':'')+iu.username).join(' | ');
      if(badge)badge.style.display='flex';
      if(val)val.textContent=txt;
      document.querySelectorAll('.user-internet-badge').forEach(el=>el.textContent=txt);
    }
  }catch(e){}
}

/* ── URL PARAMS (email assign link) ── */
function checkURLParams(){
  try{
    const params=new URLSearchParams(window.location.search);
    const assignTid=params.get('assignTicket');
    if(assignTid&&S.user&&['manager','it_manager','admin'].includes(S.user.role)){
      setTimeout(async()=>{
        S.tid=assignTid;
        const users=S.users.length?S.users:await fetchUsers();
        const it=users.filter(u=>['it','admin','it_manager','tech'].includes(u.role)&&u.active);
        document.getElementById('asgn-sl').innerHTML=it.map(u=>`<option value="${esc(u.id)}">${esc(u.firstName)} ${esc(u.lastName)} — ${ROLE_L[u.role]}</option>`).join('');
        openM('ovAsgn');
      },1500);
    }
  }catch(e){}
}

/* ── MY INFO ── */
const MYINFO_CACHE_KEY='it_helpdesk_myinfo_cache';

function saveMyInfoCache(empId,data){
  try{localStorage.setItem(MYINFO_CACHE_KEY,JSON.stringify({empId,data,ts:Date.now()}));}catch(e){}
}
function loadMyInfoCache(empId){
  try{
    const r=localStorage.getItem(MYINFO_CACHE_KEY);
    if(!r)return null;
    const parsed=JSON.parse(r);
    if(parsed.empId!==empId)return null;
    return parsed;
  }catch(e){return null;}
}
function showOfflineInfoBadge(show){
  const el=document.getElementById('inf-offline-badge');
  if(el)el.style.display=show?'inline-flex':'none';
}

async function loadMyInfo(){
  const u=S.user;if(!u)return;
  const ini=(u.firstName[0]||'')+(u.lastName[0]||'');
  const setT=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—';};
  setT('inf-av',ini);setT('inf-name',u.firstName+' '+u.lastName);setT('inf-role',ROLE_L[u.role]);
  setT('inf-id',u.empId);setT('inf-dept',u.dept);setT('inf-phone',u.phone||'—');
  setT('inf-internet','⏳ جارٍ التحميل...');setT('inf-tickets','—');
  showOfflineInfoBadge(false);
  try{
    const r=await api('user.myInfo');
    if(r&&r.success){
      const list=r.internetUsers||[];
      const txt=list.length
        ? list.map(iu=>'حساب الإنترنت'+(iu.network_label?' ('+iu.network_label+')':'')+': '+iu.username).join(' | ')
        : 'غير مُعيَّن';
      setT('inf-internet',txt);setT('inf-tickets',r.ticketCount||'0');if(r.phone)setT('inf-phone',r.phone);
      saveMyInfoCache(u.empId,{internet:txt,tickets:r.ticketCount||'0',phone:r.phone||u.phone});
    }
    else{setT('inf-internet','غير مُعيَّن');}
  }catch(e){
    const cached=loadMyInfoCache(u.empId);
    if(cached&&cached.data){
      setT('inf-internet',cached.data.internet);
      setT('inf-tickets',cached.data.tickets);
      if(cached.data.phone)setT('inf-phone',cached.data.phone);
      showOfflineInfoBadge(true);
    }else{
      setT('inf-internet','غير متاح');
    }
  }
}
