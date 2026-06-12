'use strict';
/* ── NOTIFICATIONS ── */
const PRI_C={'عاجلة':'b-ur','عالية':'b-hi','متوسطة':'b-md','منخفضة':'b-lo'};
function reqNotifPerm(){if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();}
function showBrNotif(title,body){
  if('Notification' in window&&Notification.permission==='granted'){
    new Notification(title,{body,icon:'https://fonts.gstatic.com/s/i/materialicons/notifications/v4/24px.svg'});
  }
}
const claimedTickets=new Set();
async function pollNotifs(){
  if(!S.user||!['it','manager','it_manager','admin'].includes(S.user.role))return;
  try{
    const r=await api('notifications.list');
    if(!r||!r.success)return;
    S.notifs=r.notifications||[];
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
  const canClaim=['it','it_manager','admin'].includes(S.user?.role);
  el.innerHTML=S.notifs.map(n=>{
    const claimed=n.assignedName||n.claimedBy;
    const isMe=n.claimedBy===S.user?.id;
    const claimBtn=canClaim&&!claimed?`<button class="np-claim-btn" onclick="claimFromNotif('${esc(n.id)}',this)"><i class="fas fa-hand-pointer"></i> استلام</button>`:'';
    const claimBadge=claimed?`<span class="np-ic claimed">${isMe?'✅ استلمته':'👤 '+esc(n.claimerName||n.assignedName||'موظف')}</span>`:'';
    return `<div class="np-item${claimed?' claimed':''}${n.read?' read':''}">
      <div class="np-head">
        <span style="font-size:.75rem;opacity:.55;margin-right:auto">${esc(n.id)}</span>
        ${claimBadge}
      </div>
      <div class="np-body">${esc(n.message||'بلاغ جديد')}</div>
      <div class="np-foot">
        ${claimBtn}
      </div>
    </div>`;
  }).join('');
}
function clearNP(){
  S.notifs=[];updNB();renderNP();
  try{api('notifications.markAllRead');}catch(e){}
}
