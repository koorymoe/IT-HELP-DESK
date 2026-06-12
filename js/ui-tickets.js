'use strict';
/* ── TICKETS ── */
let _dbt;function debLoad(){clearTimeout(_dbt);_dbt=setTimeout(loadTickets,350);}

async function loadTickets(){
  const q=(document.getElementById('f-q')||{}).value||'';
  const st=(document.getElementById('f-st')||{}).value||'all';
  const pr=(document.getElementById('f-pr')||{}).value||'all';
  const el=document.getElementById('tList');if(!el)return;el.innerHTML=skel(3);
  try{const r=await api('tickets.list',{q,status:st,priority:pr});if(!r||!r.success){toast(r?r.message:'خطأ',true);return;}S.tickets=r.tickets;renderTL(r.tickets,el);}
  catch(e){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>فشل التحميل</h3></div>';}
}
async function loadOverdue(){
  const el=document.getElementById('ovList');el.innerHTML=skel(2);
  try{const r=await api('tickets.list',{overdueOnly:true});if(!r||!r.success)return;
  document.getElementById('ov-sub').textContent=r.tickets.length?r.tickets.length+' بلاغ تجاوز 48 ساعة':'لا توجد بلاغات متأخرة ✅';
  S.tickets=[...S.tickets,...r.tickets.filter(t=>!S.tickets.find(x=>x.id===t.id))];
  el.innerHTML=r.tickets.length?r.tickets.map(t=>tickCard(t)).join(''):'<div class="empty"><i class="fas fa-check-circle" style="color:var(--gr)"></i><h3 style="color:var(--gr-d)">ممتاز! لا توجد بلاغات متأخرة</h3></div>';}catch(e){}
}
async function loadMobTicks(){
  const fEl=document.querySelector('#mb-ticks .dev-chip.selected');
  const st=fEl?fEl.dataset.val:'all';
  const el=document.getElementById('mob-tl');if(!el)return;el.innerHTML=skel(2);
  const colors={'جديدة':'#3b82f6','معينة':'#f59e0b','قيد المعالجة':'#06b6d4','تم حل البلاغ':'#10b981'};
  try{const r=await api('tickets.list',{status:st});if(!r||!r.success)return;
  if(!r.tickets.length){el.innerHTML='<div style="text-align:center;padding:40px;color:var(--sl)"><i class="fas fa-clipboard" style="font-size:32px;opacity:.2;display:block;margin-bottom:10px"></i><div>لا توجد بلاغات</div></div>';return;}
  el.innerHTML=r.tickets.map(t=>`<div class="mob-tc" onclick="openDetail('${esc(t.id)}')" style="cursor:pointer"><div class="mob-tc-l" style="background:${colors[t.status]||'#6366f1'}"></div><div class="mob-tc-body"><div class="mob-tc-tt">${esc(t.problemType)}</div><div class="mob-tc-meta">${esc(t.createdAt)}</div></div><div class="mob-tc-r"><span class="badge" style="background:${colors[t.status]||'#6366f1'}20;color:${colors[t.status]||'#6366f1'};border:1px solid ${colors[t.status]||'#6366f1'}40;font-size:9px">${esc(t.status)}</span><i class="fas fa-chevron-left" style="font-size:10px;color:var(--sl)"></i></div></div>`).join('');}catch(e){}
}
function filterMobTick(el,val){document.querySelectorAll('#mb-ticks .dev-chip').forEach(b=>b.classList.remove('selected'));el.classList.add('selected');el.dataset.val=val;loadMobTicks();}
function renderTL(list,el){if(!list||!list.length){el.innerHTML='<div class="empty"><i class="fas fa-search"></i><h3>لا توجد بلاغات</h3></div>';return;}el.innerHTML=list.map(t=>tickCard(t)).join('');}
function tickCard(t){
  const cl=t.status==='تم حل البلاغ'?'c-cl':t.isOverdue?'c-ov':t.priority==='عاجلة'?'c-ur':t.priority==='عالية'?'c-hi':'';
  const dev=DI[t.deviceId||'']||'⚙️';
  const desc=(t.desc||'').length>110?t.desc.slice(0,110)+'…':(t.desc||'');
  const u=S.user;
  const isIT=u&&['it','tech','admin','it_manager'].includes(u.role);
  const isMgr=u&&['manager','it_manager','admin'].includes(u.role);
  const claimedBadge=t.assignedName?`<span class="assigned-by"><i class="fas fa-user-check"></i>مستلم: ${esc(t.assignedName)}</span>`:'';
  let acts='';
  if(u&&(isIT||isMgr)){
    const canClaim=isIT&&!t.assignedName&&t.status==='جديدة';
    const canAssign=(isIT||isMgr)&&t.status!=='تم حل البلاغ';
    acts=`
    ${canClaim?`<button class="btn btn-s btn-sm" onclick="doClaim('${esc(t.id)}')"><i class="fas fa-hand-pointer"></i>استلام</button>`:''}
    ${isIT?`<button class="btn btn-w btn-sm" onclick="openUpd('${esc(t.id)}')"><i class="fas fa-edit"></i>تحديث</button>`:''}
    ${canAssign?`<button class="btn btn-p btn-sm" onclick="openAsgn('${esc(t.id)}')"><i class="fas fa-user-check"></i>تعيين</button>`:''}
    ${isIT&&t.assignedName?`<button class="btn btn-g btn-sm" onclick="doUnasgn('${esc(t.id)}')"><i class="fas fa-user-minus"></i>إلغاء</button>`:''}`;
  }
  return `<div class="ti ${cl}">
<div class="ti-top">
<div style="flex:1;min-width:0">
<div class="ti-id"><i class="fas fa-hashtag"></i>${esc(t.id)} · ${esc(t.createdAt)}</div>
<div class="ti-ttl">${dev} ${esc(t.problemType)}</div>
<div class="ti-meta"><span><i class="fas fa-building" style="color:var(--in)"></i>${esc(t.requesterDept)}</span><span><i class="fas fa-user" style="color:var(--in)"></i>${esc(t.requesterName)}</span>${claimedBadge}</div>
</div>
<div class="ti-bgs"><span class="badge ${SB[t.status]||'b-op'}">${esc(t.status)}</span><span class="badge ${PB[t.priority]||'b-md'}">${esc(t.priority)}</span>${t.isOverdue?'<span class="badge b-ov"><i class="fas fa-clock"></i>متأخر</span>':''}</div>
</div>
<div class="ti-desc">${esc(desc)}</div>
<div class="ti-acts">
<button class="btn btn-g btn-sm" onclick="openDetail('${esc(t.id)}')"><i class="fas fa-eye"></i>التفاصيل</button>
<button class="btn btn-g btn-sm" onclick="openAttachModal('${esc(t.id)}')"><i class="fas fa-paperclip"></i>مرفق</button>
${acts}
${u&&u.role==='admin'?`<button class="btn btn-d btn-sm" onclick="deleteTicket('${esc(t.id)}')"><i class="fas fa-trash"></i>حذف</button>`:''}
</div>
</div>`;
}
function openDetail(tid){
  const t=S.tickets.find(x=>x.id===tid);if(!t)return;
  const hist=(t.history||[]).map(h=>`<div class="hi"><div class="hd"></div><div><div style="font-size:12px;font-weight:600">${esc(h.action)}</div><div class="ht">${esc(h.by)} · ${esc(h.time)}</div></div></div>`).join('');
  document.getElementById('mTBody').innerHTML=`
<div class="ig">
<div class="ig-i"><label>رقم البلاغ</label><strong style="font-family:monospace">${esc(t.id)}</strong></div>
<div class="ig-i"><label>الحالة</label><span class="badge ${SB[t.status]||'b-op'}">${esc(t.status)}</span></div>
<div class="ig-i"><label>المُبلِّغ</label><strong>${esc(t.requesterName)}</strong></div>
<div class="ig-i"><label>القسم</label><strong>${esc(t.requesterDept)}</strong></div>
<div class="ig-i"><label>نوع المشكلة</label><strong>${esc(t.problemType)}</strong></div>
<div class="ig-i"><label>الأولوية</label><span class="badge ${PB[t.priority]||'b-md'}">${esc(t.priority)}</span></div>
<div class="ig-i"><label>المعالج</label><strong>${esc(t.assignedName)||'غير معين'}</strong></div>
<div class="ig-i"><label>تاريخ الإنشاء</label><strong>${esc(t.createdAt)}</strong></div>
</div>
<div style="margin-bottom:12px"><label>وصف المشكلة</label><p style="background:var(--bg);padding:12px;border-radius:var(--rs);font-size:12px;margin-top:5px;line-height:1.7;border:1px solid var(--border)">${esc(t.desc)}</p></div>
${t.solution?`<div style="margin-bottom:12px"><label>الحل المطبق</label><p style="background:var(--gr-l);border:1px solid #a7f3d0;padding:12px;border-radius:var(--rs);font-size:12px;margin-top:5px">${esc(t.solution)}</p></div>`:''}
${hist?`<div><div class="card-h" style="margin-bottom:8px"><i class="fas fa-history"></i>سجل التاريخ</div>${hist}</div>`:''}`;
  openM('ovTick');
}

/* ── TICKET ACTIONS ── */
async function subITTicket(){const p=document.getElementById('nt-p').value,pri=document.getElementById('nt-pri').value,d=document.getElementById('nt-d').value.trim(),di=document.getElementById('nt-di').value;if(!p||!d){toast('نوع المشكلة والوصف مطلوبان',true);return;}try{const r=await api('tickets.create',{problemType:p,priority:pri,description:d,deviceId:di});if(r&&r.success){toast('✅ '+r.message);cc();['nt-p','nt-d','nt-di'].forEach(id=>document.getElementById(id).value='');goTab('tickets',document.querySelector('[data-t="tickets"]'));}else toast(r?r.message:'خطأ',true);}catch(e){toast('خطأ',true);}}

let _mobImg=null;
function onMobImgSelect(input){const file=input.files[0];if(!file)return;if(file.size>3*1024*1024){toast('حجم الصورة كبير — الحد 3MB',true);input.value='';return;}_mobImg=file;const preview=document.getElementById('mn-img-preview');const thumb=document.getElementById('mn-img-thumb');const name=document.getElementById('mn-img-name');const label=document.getElementById('mn-img-label');if(thumb)thumb.src=URL.createObjectURL(file);if(name)name.textContent=file.name;if(preview)preview.style.display='block';if(label)label.style.borderColor='var(--gr-d)';}
function removeMobImg(){_mobImg=null;document.getElementById('mn-img').value='';document.getElementById('mn-img-preview').style.display='none';document.getElementById('mn-img-label').style.borderColor='';}
async function subMob(){
  const p=document.getElementById('mn-p').value,pri=document.getElementById('mn-pri').value||'متوسطة',d=document.getElementById('mn-d').value.trim(),di=document.getElementById('mn-di').value;
  if(!p){toast('اختر نوع المشكلة',true);return;}if(!d){toast('اكتب وصف المشكلة',true);return;}
  const btn=document.getElementById('mobSubBtn');btn.disabled=true;btn.innerHTML='<span class="spin"></span>إرسال...';
  try{
    const r=await api('tickets.create',{problemType:p,priority:pri,description:d,deviceId:di});
    if(r&&r.success){
      document.getElementById('successTid').textContent='رقم البلاغ: '+r.ticketId;
      if(_mobImg){try{btn.innerHTML='<span class="spin"></span>رفع الصورة...';const b64=await fileToBase64(_mobImg);await api('tickets.attach',{ticketId:r.ticketId,fileName:_mobImg.name,mimeType:_mobImg.type,base64:b64});}catch(e2){}}
      document.getElementById('mobSuccess').classList.add('show');cc();
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ في الإرسال',true);}
  btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i>إرسال البلاغ';
}
function openUpd(tid){S.tid=tid;['upd-st','upd-sol','upd-not'].forEach(id=>document.getElementById(id).value='');openM('ovUpd');}
async function subUpd(){const st=document.getElementById('upd-st').value,sol=document.getElementById('upd-sol').value.trim(),note=document.getElementById('upd-not').value.trim();try{const r=await api('tickets.update',{ticketId:S.tid,status:st,solution:sol,notes:note});if(r&&r.success){toast('✅ '+r.message);closeM('ovUpd');cc();loadTickets();loadDashboard();}else toast(r?r.message:'خطأ',true);}catch(e){toast('خطأ',true);}}

/* ── CLAIM + ASSIGN + HELP ── */
async function doClaim(tid){
  try{
    const r=await api('tickets.claim',{ticketId:tid});
    if(r&&r.success){
      toast('✅ '+r.message);
      try{await api('notifications.broadcastClaim',{ticketId:tid,claimerName:S.user.firstName+' '+S.user.lastName});}catch(e2){}
      cc();loadTickets();loadDashboard();
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function claimFromNotif(tid,btn){
  btn.disabled=true;btn.textContent='...';
  try{
    const r=await api('tickets.claim',{ticketId:tid});
    if(r&&r.success){
      toast('✅ '+r.message);
      const n=S.notifs.find(x=>x.id===tid);if(n)n.assignedName=S.user.firstName;
      renderNP();
      try{await api('notifications.broadcastClaim',{ticketId:tid,claimerName:S.user.firstName+' '+S.user.lastName});}catch(e2){}
      cc();loadTickets();loadDashboard();
      document.getElementById('npanel').classList.remove('open');
    }else{toast(r?r.message:'خطأ',true);btn.disabled=false;btn.innerHTML='<i class="fas fa-hand-pointer"></i> استلام';}
  }catch(e){toast('خطأ',true);btn.disabled=false;btn.innerHTML='<i class="fas fa-hand-pointer"></i> استلام';}
}
async function doUnasgn(tid){if(!confirm('إلغاء تعيين هذا البلاغ؟'))return;try{const r=await api('tickets.unassign',{ticketId:tid});if(r&&r.success){toast('✅ '+r.message);cc();loadTickets();}else toast(r?r.message:'خطأ',true);}catch(e){}}
async function openAsgn(tid){S.tid=tid;const users=S.users.length?S.users:await fetchUsers();const it=users.filter(u=>['it','admin','it_manager','tech'].includes(u.role)&&u.active);document.getElementById('asgn-sl').innerHTML=it.map(u=>`<option value="${esc(u.id)}">${esc(u.firstName)} ${esc(u.lastName)} — ${ROLE_L[u.role]}</option>`).join('');openM('ovAsgn');}
async function subAsgn(){
  const aid=document.getElementById('asgn-sl').value;
  try{
    const r=await api('tickets.assign',{ticketId:S.tid,assigneeId:aid});
    if(r&&r.success){
      toast('✅ '+r.message);closeM('ovAsgn');
      const aname=document.getElementById('asgn-sl').selectedOptions[0]?.textContent.trim();
      try{await api('notifications.broadcastAssign',{ticketId:S.tid,assigneeId:aid,assigneeName:aname});}catch(e2){}
      cc();loadTickets();
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
async function openHelp(tid){S.tid=tid;const users=S.users.length?S.users:await fetchUsers();const others=users.filter(u=>['it','admin','it_manager'].includes(u.role)&&u.id!==S.user.id);document.getElementById('hlp-sl').innerHTML=others.map(u=>`<option value="${esc(u.id)}">${esc(u.firstName)} ${esc(u.lastName)}</option>`).join('');openM('ovHelp');}
async function subHelp(){const hid=document.getElementById('hlp-sl').value,hn=document.getElementById('hlp-not').value.trim();try{const r=await api('tickets.help',{ticketId:S.tid,helperId:hid,helpNotes:hn});if(r&&r.success){toast('✅ '+r.message);closeM('ovHelp');cc();loadTickets();}else toast(r?r.message:'خطأ',true);}catch(e){toast('خطأ',true);}}
function closeMobSuccess(){document.getElementById('mobSuccess').classList.remove('show');document.querySelectorAll('.prob-btn').forEach(b=>b.classList.remove('selected'));document.getElementById('mn-d').value='';document.getElementById('mn-p').value='';removeMobImg();mobTab('mb-home',0);loadUserHome();}

/* ── DESK USER TICKETS ── */
async function loadDeskUserTickets(){
  const st=(document.getElementById('utd-st')||{}).value||'all';
  const el=document.getElementById('desk-user-tlist');if(!el)return;el.innerHTML=skel(2);
  try{const r=await api('tickets.myList');if(!r||!r.success){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>فشل التحميل</h3></div>';return;}
  let tks=r.tickets||[];
  if(st!=='all')tks=tks.filter(t=>t.status===st);
  S.tickets=[...tks,...S.tickets.filter(t=>!tks.find(x=>x.id===t.id))];
  renderTL(tks,el);
  }catch(e){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>فشل التحميل</h3></div>';}
}
let _deskImg=null;
async function onDeskImgSelect(input){
  const file=input.files[0];if(!file)return;
  if(file.size>3*1024*1024){toast('حجم الصورة كبير — الحد 3MB',true);input.value='';return;}
  _deskImg=file;
  const preview=document.getElementById('utd-img-preview');
  if(preview){preview.style.display='block';preview.innerHTML=`<img src="${URL.createObjectURL(file)}" style="max-width:120px;border-radius:8px"/>`;}
}
async function subDeskUserTicket(){
  const p=document.getElementById('utd-p').value,pri=document.getElementById('utd-pri').value,d=document.getElementById('utd-d').value.trim(),di=document.getElementById('utd-di').value;
  if(!p||!d){toast('نوع المشكلة والوصف مطلوبان',true);return;}
  try{
    const payload={problemType:p,priority:pri,description:d,deviceId:di};
    if(_deskImg)payload.imageBase64=await fileToBase64(_deskImg);
    const r=await api('tickets.create',payload);
    if(r&&r.success){
      toast('✅ '+r.message);cc();
      document.getElementById('utd-d').value='';
      const preview=document.getElementById('utd-img-preview');if(preview){preview.style.display='none';preview.innerHTML='';}
      _deskImg=null;
      goTab('myTicketsDesk',document.querySelector('[data-t="myTicketsDesk"]'));
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── TECH TICKET ── */
async function subTechTicket(){
  const p=document.getElementById('tt-p').value,pri=document.getElementById('tt-pri').value,d=document.getElementById('tt-d').value.trim(),di=document.getElementById('tt-di').value;
  if(!p||!d){toast('نوع المشكلة والوصف مطلوبان',true);return;}
  try{
    const r=await api('tickets.create',{problemType:p,priority:pri,description:d,deviceId:di});
    if(r&&r.success){toast('✅ '+r.message);cc();['tt-p','tt-d','tt-di'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── ATTACHMENTS ── */
async function handleFileSelect(input){
  const f=input.files[0];if(!f)return;
  if(f.size>5*1024*1024){toast('الملف كبير جداً (الحد 5MB)',true);return;}
  S.attachFile=await fileToBase64(f);
  S.attachFileName=f.name;S.attachFileMime=f.type;
  const area=document.getElementById('attachPreviewArea');
  if(area)area.innerHTML=`<div style="font-size:12px">✅ ${esc(f.name)}</div>`;
  const btn=document.getElementById('uploadBtn');if(btn)btn.disabled=false;
}
async function submitAttach(){
  if(!S.tid||!S.attachFile){toast('يرجى تحديد ملف',true);return;}
  try{
    const r=await api('tickets.attach',{ticketId:S.tid,base64:S.attachFile,fileName:S.attachFileName,mimeType:S.attachFileMime});
    if(r&&r.success){toast('✅ تم رفع الملف');closeM('ovAttach');S.attachFile=null;S.attachFileName=null;}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}
function openAttachModal(tid){S.tid=tid;S.attachFile=null;S.attachFileName=null;const btn=document.getElementById('uploadBtn');if(btn)btn.disabled=true;const area=document.getElementById('attachPreviewArea');if(area)area.innerHTML='';openM('ovAttach');}

/* ── DELETE TICKET ── */
async function deleteTicket(tid){
  if(!confirm('حذف هذا البلاغ نهائياً؟'))return;
  try{
    const r=await api('tickets.delete',{ticketId:tid});
    if(r&&r.success){toast('✅ تم الحذف');closeM('ovTick');cc();loadTickets();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

/* ── MOBILE PICKERS ── */
function selProb(btn,v){document.getElementById('mn-p').value=v;document.querySelectorAll('.prob-btn').forEach(b=>b.classList.remove('selected'));if(btn)btn.classList.add('selected');}
function selPri(btn,v){
  document.getElementById('mn-pri').value=v;
  document.querySelectorAll('.pri-btn').forEach(b=>{
    b.className=b.className.replace(/\bsel-\S+/g,'').replace(/\bselected\b/g,'').trim();
  });
  if(btn){btn.classList.add('selected');btn.classList.add('sel-'+v);}
}
function selDev(btn,v){document.getElementById('mn-di').value=v;document.querySelectorAll('.dev-chip').forEach(b=>b.classList.remove('selected'));if(btn)btn.classList.add('selected');}
