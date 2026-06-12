'use strict';
const ROLE_L={user:'موظف',it:'فريق IT',tech:'فني صيانة',manager:'مراقب',it_manager:'مسؤول IT',admin:'أدمن'};
const ROLE_IC={user:'fa-user',it:'fa-laptop-code',tech:'fa-wrench',manager:'fa-eye',it_manager:'fa-star',admin:'fa-crown'};
const ROLE_CL={user:'role-user',it:'role-it',tech:'role-it',manager:'role-manager',it_manager:'role-it_manager',admin:'role-admin'};
const SB={'جديدة':'b-op','معينة':'b-as','قيد المعالجة':'b-pr','تم حل البلاغ':'b-cl'};
const PB={'عاجلة':'b-ur','عالية':'b-hi','متوسطة':'b-md','منخفضة':'b-lo'};
const DI={laptop:'💻',desktop:'🖥️',printer:'🖨️',phone:'📱',network:'🌐',server:'🗄️',other:'🔧','':'⚙️'};
const DEVICE_LABELS={desktop:'الحاسبة',laptop:'اللابتوب',printer:'الطابعة',network:'الشبكة',phone:'الهاتف',other:'جهاز آخر'};
const MAX_AI=7;
const OVERDUE_HOURS=48;
let DEPTS=[];
const S={token:null,user:null,tickets:[],users:[],tid:null,charts:{},notifs:[],lastCheck:null,poll:null,pwUid:null};
const AI={desk:{conv:[],device:'',busy:false,count:0,sys:''},mob:{conv:[],device:'',busy:false,count:0,sys:''}};

/* ── CACHE ── */
function gc(k){const r=localStorage.getItem('hd_'+k);if(!r)return null;try{const{d,t,ttl}=JSON.parse(r);if(Date.now()-t>ttl*1000){localStorage.removeItem('hd_'+k);return null;}return d;}catch(e){return null;}}
function sc(k,d,ttl){try{localStorage.setItem('hd_'+k,JSON.stringify({d,t:Date.now(),ttl}));}catch(e){}}
function cc(k){if(k)localStorage.removeItem('hd_'+k);else Object.keys(localStorage).filter(x=>x.startsWith('hd_')).forEach(x=>localStorage.removeItem(x));}

function esc(v){if(v==null)return'';return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);}
function tpw(i,e){const el=document.getElementById(i),ic=document.getElementById(e);el.type=el.type==='password'?'text':'password';ic.className='fas '+(el.type==='password'?'fa-eye':'fa-eye-slash');}

function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');}

/* ── NAV ── */
const TAB_IC={dashboard:'fa-chart-line',tickets:'fa-clipboard-list',overdue:'fa-clock',reports:'fa-chart-pie',newTicket:'fa-plus-circle',users:'fa-users',newUser:'fa-user-plus','view-guidelines':'fa-shield-alt','view-manual':'fa-book','ai-desk':'fa-robot',depts:'fa-building',devices:'fa-laptop-medical','internet-users':'fa-wifi','tech-stats':'fa-chart-bar','tech-ticket':'fa-plus-circle'};
const TAB_TX={dashboard:'لوحة التحكم',tickets:'البلاغات',overdue:'المتأخرة',reports:'التقارير',newTicket:'بلاغ جديد',users:'الموظفون',newUser:'موظف جديد','view-guidelines':'التوجيهات','view-manual':'كتيب التعليمات','ai-desk':'المساعد الذكي',depts:'الأقسام',devices:'إدارة الأجهزة','internet-users':'يوزرات الإنترنت','tech-stats':'إنجازاتي','tech-ticket':'إرسال بلاغ'};
function goTab(name,btn){
  document.querySelectorAll('.tab').forEach(t=>t.style.display='none');
  document.querySelectorAll('.sb-i').forEach(b=>b.classList.remove('active'));
  const tab=document.getElementById('tab-'+name);if(tab)tab.style.display='block';
  if(btn)btn.classList.add('active');
  const pt=document.getElementById('pgTitle');
  if(pt)pt.innerHTML=`<i class="fas ${TAB_IC[name]||'fa-circle'}"></i>${TAB_TX[name]||''}`;
  const L={dashboard:loadDashboard,tickets:loadTickets,overdue:loadOverdue,reports:loadReports,users:loadUsers,depts:loadDepts,devices:loadDevices,'internet-users':loadInternetUsers,'view-guidelines':loadGuidelinesTab,'view-manual':()=>loadManualTab(''),'ai-desk':()=>{},'tech-stats':loadTechStats,'tech-ticket':()=>{},userHome:loadDeskUserHome,myTicketsDesk:loadDeskUserTickets,newTicketDesk:()=>{}};
  if(L[name])L[name]();
}
function mobTab(id,idx){
  document.querySelectorAll('.mb-tab').forEach(t=>t.style.display='none');
  const el=document.getElementById(id);if(el)el.style.display='block';
  document.querySelectorAll('.mob-bni').forEach((b,i)=>b.classList.toggle('active',i===idx));
  const fab=document.querySelector('.mob-fab');if(fab)fab.style.display=(id==='mb-new')?'none':'flex';
}

/* ── UTILITY ── */
function animN(el){if(!el)return;el.classList.remove('anim-in');void el.offsetWidth;el.classList.add('anim-in');}
function skel(n,label){return Array(n).fill(`<div class="skel-row"><div class="skel" style="height:18px;width:60%;margin-bottom:8px"></div><div class="skel" style="height:14px;width:40%"></div></div>`).join('');}
function openM(id){const el=document.getElementById(id);if(el){el.style.display='flex';el.classList.add('open');el.classList.add('show');document.body.style.overflow='hidden';}}
function closeM(id){const el=document.getElementById(id);if(el){el.style.display='none';el.classList.remove('open');el.classList.remove('show');document.body.style.overflow='';}}
let _toastT;
function toast(msg,err=false){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.className='toast show'+(err?' err':'');
  clearTimeout(_toastT);_toastT=setTimeout(()=>t.classList.remove('show'),3500);
}
function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>res(e.target.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}
let _charts={};
function mkChart(id,type,labels,data,colors,label){
  const el=document.getElementById(id);if(!el)return;
  if(_charts[id]){_charts[id].destroy();delete _charts[id];}
  try{
    const showLegend=type==='pie'||type==='doughnut';
    _charts[id]=new Chart(el,{
      type,
      data:{labels,datasets:[{label:label||'',data,backgroundColor:colors,borderColor:type==='line'?colors[0]:'transparent',fill:type==='line',tension:.4,borderWidth:2}]},
      options:{responsive:true,plugins:{legend:{display:showLegend,position:'bottom',labels:{font:{family:'Cairo'},color:'#94a3b8'}}},scales:type==='line'||type==='bar'?{x:{ticks:{color:'#94a3b8',font:{family:'Cairo'}}},y:{ticks:{color:'#94a3b8',font:{family:'Cairo'}}}}:{}}
    });
  }catch(e){}
}

/* compute isOverdue: non-closed tickets older than OVERDUE_HOURS */
function computeOverdue(t){
  if(t.status==='تم حل البلاغ')return false;
  if(!t.createdAt)return false;
  const created=new Date(t.createdAt);
  if(isNaN(created.getTime()))return false;
  return (Date.now()-created.getTime())>OVERDUE_HOURS*3600*1000;
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded',()=>{
  checkSession();
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.getElementById('loginPage').classList.contains('active'))doLogin();});
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(regs=>{
      regs.forEach(r=>r.unregister());
    });
    if(window.caches&&caches.keys){
      caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
    }
  }
});
