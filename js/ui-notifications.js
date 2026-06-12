'use strict';
/* ── NOTIFICATIONS ── */
const PRI_C={'عاجلة':'b-ur','عالية':'b-hi','متوسطة':'b-md','منخفضة':'b-lo'};
function reqNotifPerm(){if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();}
function showBrNotif(title,body){
  if('Notification' in window&&Notification.permission==='granted'){
    new Notification(title,{body,icon:'https://fonts.gstatic.com/s/i/materialicons/notifications/v4/24px.svg'});
  }
}
let _audioCtx;
function playNotifSound(){
  try{
    _audioCtx=_audioCtx||new(window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==='suspended')_audioCtx.resume();
    const t0=_audioCtx.currentTime;
    [880,1175].forEach((freq,i)=>{
      const o=_audioCtx.createOscillator(),g=_audioCtx.createGain();
      o.type='sine';o.frequency.value=freq;
      o.connect(g);g.connect(_audioCtx.destination);
      const start=t0+i*0.14;
      g.gain.setValueAtTime(0,start);
      g.gain.linearRampToValueAtTime(.35,start+.02);
      g.gain.exponentialRampToValueAtTime(.0001,start+.32);
      o.start(start);o.stop(start+.34);
    });
  }catch(e){}
}
function timeAgo(iso){
  if(!iso)return'';
  const diff=(Date.now()-new Date(iso).getTime())/1000;
  if(diff<60)return'الآن';
  if(diff<3600)return Math.floor(diff/60)+' د';
  if(diff<86400)return Math.floor(diff/3600)+' س';
  return Math.floor(diff/86400)+' يوم';
}
const claimedTickets=new Set();
let _knownNotifIds=null;
async function pollNotifs(){
  if(!S.user||!['it','tech','manager','it_manager','admin'].includes(S.user.role))return;
  try{
    const r=await api('notifications.list');
    if(!r||!r.success)return;
    const prevIds=_knownNotifIds;
    S.notifs=r.notifications||[];
    const curIds=new Set(S.notifs.map(n=>n.notifId));
    if(prevIds){
      const unread=S.notifs.filter(n=>!n.read&&!prevIds.has(n.notifId));
      if(unread.length){
        playNotifSound();
        unread.forEach(n=>showBrNotif('🔔 إشعار جديد',n.message||'لديك إشعار جديد'));
      }
    }
    _knownNotifIds=curIds;
    S.notifs.forEach(n=>{
      if(n.claimedBy&&n.claimedBy!==S.user.id&&!claimedTickets.has(n.id)){
        claimedTickets.add(n.id);
        showBrNotif('تم استلام البلاغ',`${n.claimerName||'موظف IT'} استلم البلاغ ${n.id}`);
      }
    });
    updNB();
    renderNP();
  }catch(e){}
}
function updNB(){
  const el=document.getElementById('nb2');
  if(!el)return;
  const cnt=S.notifs.filter(n=>!n.read).length;
  el.style.display=cnt?'block':'none';
}
function toggleNP(){
  const p=document.getElementById('npanel');
  if(!p)return;
  p.classList.toggle('open');
  if(p.classList.contains('open'))renderNP();
}
function renderNP(){
  const el=document.getElementById('npList');
  if(!el)return;
  if(!S.notifs.length){
    el.innerHTML='<div class="np-empty">لا توجد إشعارات</div>';
    return;
  }
  const canClaim=['it','tech','it_manager','admin'].includes(S.user?.role);
  el.innerHTML=S.notifs.map(n=>{
    const claimed=n.assignedName||n.claimedBy;
    const isMe=n.claimedBy===S.user?.id;
    const claimBtn=canClaim&&!claimed?`<button class="np-claim-btn" onclick="claimFromNotif('${esc(n.id)}',this)"><i class="fas fa-hand-pointer"></i> استلام البلاغ</button>`:'';
    const claimBadge=claimed?`<span class="np-badge${isMe?' me':''}">${isMe?'✅ استلمته أنت':'👤 '+esc(n.claimerName||n.assignedName||'موظف')}</span>`:'';
    return `<div class="np-item${claimed?' claimed':''}${n.read?' read':''}">
      <div class="np-ic${claimed?' claimed':''}"><i class="fas ${claimed?'fa-circle-check':'fa-ticket'}"></i></div>
      <div class="np-content">
        <div class="np-head">
          <span class="np-time">${esc(timeAgo(n.createdAt))}</span>
          ${claimBadge}
        </div>
        <div class="np-body">${esc(n.message||'بلاغ جديد')}</div>
        ${claimBtn?`<div class="np-foot">${claimBtn}</div>`:''}
      </div>
      ${!n.read?'<span class="np-dot"></span>':''}
    </div>`;
  }).join('');
}
function clearNP(){
  S.notifs=[];updNB();renderNP();
  try{api('notifications.markAllRead');}catch(e){}
}
