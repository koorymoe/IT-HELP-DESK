'use strict';
/* ── API LAYER: maps old api(action,data) calls to Supabase queries ── */

/* ---------- push notification helper ---------- */
async function sendPush(userIds,title,message){
  try{
    if(!userIds||!userIds.length)return;
    await sb.functions.invoke('send-push',{body:{userIds,title,message}});
  }catch(e){}
}
async function notifyUsers(userIds,message,ticketId){
  try{
    if(!userIds||!userIds.length)return;
    const rows=userIds.map(uid=>({user_id:uid,ticket_id:ticketId||null,message}));
    await sb.from('notifications').insert(rows);
    sendPush(userIds,'🔔 IT Help Desk',message);
  }catch(e){}
}

/* ---------- email notification helper ---------- */
const TICKET_ACTION_URL=SUPABASE_URL+'/functions/v1/ticket-action';
const APP_URL='https://koorymoe.github.io/IT-HELP-DESK/';
const PRI_COLORS={'عاجلة':'#ef4444','عالية':'#f59e0b','متوسطة':'#3b82f6','منخفضة':'#8b5cf6'};
async function notifyNewTicketByEmail(ticket){
  try{
    const accent=PRI_COLORS[ticket.priority]||'#6366f1';
    const subject='بلاغ جديد: '+(ticket.problemType||'بلاغ');
    const infoCard=`
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;color:#cbd5e1;background:#1e293b;padding:4px 10px;border-radius:8px;border:1px solid #334155"><i>👤</i> ${esc(ticket.requesterName)}</span>
        <span style="font-size:11px;font-weight:700;color:#cbd5e1;background:#1e293b;padding:4px 10px;border-radius:8px;border:1px solid #334155"><i>🏢</i> ${esc(ticket.requesterDept||'—')}</span>
        <span style="font-size:11px;font-weight:700;color:#cbd5e1;background:#1e293b;padding:4px 10px;border-radius:8px;border:1px solid #334155"><i>🔧</i> ${esc(ticket.problemType)}</span>
      </div>
      <div>${esc(ticket.desc)}</div>`;

    const{data:itUsers}=await sb.from('users').select('email').in('role',['it','it_manager','admin','tech']).not('email','is',null);
    for(const u of (itUsers||[])){
      if(!u.email)continue;
      const claimLink=`${TICKET_ACTION_URL}?action=claim&ticket=${ticket.id}&email=${encodeURIComponent(u.email)}`;
      const actions=`<div style="text-align:center">
        <a href="${claimLink}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 36px;border-radius:12px;box-shadow:0 6px 16px rgba(16,185,129,.35)">✅ استلام البلاغ</a>
        <div style="margin-top:10px;font-size:11px;color:#94a3b8">بالضغط، يتم تسجيل البلاغ باسمك مباشرة دون الحاجة لفتح النظام</div>
      </div>`;
      await sb.functions.invoke('notify-email',{body:{to:u.email,subject,message:infoCard,actions,accent,badge:ticket.priority||''}});
    }

    const{data:mgrUsers}=await sb.from('users').select('email').eq('role','manager').not('email','is',null);
    for(const u of (mgrUsers||[])){
      if(!u.email)continue;
      const assignLink=`${TICKET_ACTION_URL}?action=assignlist&ticket=${ticket.id}&email=${encodeURIComponent(u.email)}`;
      const actions=`<div style="text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a href="${assignLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:13px 28px;border-radius:12px;box-shadow:0 6px 16px rgba(99,102,241,.35)">👤 تعيين البلاغ</a>
        <a href="${APP_URL}" style="display:inline-block;background:#0f172a;color:#cbd5e1;text-decoration:none;font-weight:800;font-size:14px;padding:13px 28px;border-radius:12px;border:1px solid #334155">فتح النظام</a>
      </div>`;
      await sb.functions.invoke('notify-email',{body:{to:u.email,subject,message:infoCard,actions,accent,badge:ticket.priority||''}});
    }
  }catch(e){}
}

/* ---------- mapping helpers ---------- */
function ticketRowToObj(t,usersById){
  usersById=usersById||{};
  const assigned=t.assigned_id?usersById[t.assigned_id]:null;
  const requester=t.requester_id?usersById[t.requester_id]:null;
  return{
    id:t.id,
    title:t.title,
    desc:t.desc,
    problemType:t.problem_type,
    priority:t.priority,
    status:t.status,
    requesterId:t.requester_id,
    requesterName:t.requester_name||(requester?(requester.firstName+' '+requester.lastName):''),
    requesterDept:t.requester_dept,
    assignedId:t.assigned_id,
    assignedName:t.assigned_name||(assigned?(assigned.firstName+' '+assigned.lastName):''),
    solution:t.notes,
    notes:t.notes,
    attachments:t.attachments||[],
    history:t.history||[],
    createdAt:t.created_at,
    updatedAt:t.updated_at,
    solvedAt:t.solved_at,
    deviceId:(t.attachments&&t.attachments.deviceId)||t.device_type||'',
    isOverdue:computeOverdue({status:t.status,createdAt:t.created_at})
  };
}

function nowHistoryEntry(action,by){
  return{action,by,time:new Date().toLocaleString('ar-EG')};
}

let _usersCache=null,_usersCacheT=0;
async function getUsersById(){
  if(_usersCache&&Date.now()-_usersCacheT<30000)return _usersCache;
  const{data}=await sb.from('users').select('id,name,emp_id,role,dept');
  const map={};
  (data||[]).forEach(u=>{const{firstName,lastName}=splitName(u.name);map[u.id]={firstName,lastName,empId:u.emp_id,role:u.role,dept:u.dept};});
  _usersCache=map;_usersCacheT=Date.now();
  return map;
}

/* ---------- API implementations ---------- */
const API={

  /* AUTH (handled mostly in auth.js, but keep for compat) */
  'auth.login':async()=>({success:false,message:'use direct login'}),
  'auth.check':async()=>({success:!!S.user,user:S.user}),

  /* ---------- TICKETS ---------- */
  'tickets.list':async(data)=>{
    data=data||{};
    let q=sb.from('tickets').select('id,title,desc,problem_type,priority,status,requester_id,requester_name,requester_dept,assigned_id,assigned_name,notes,history,created_at,updated_at,solved_at').order('created_at',{ascending:false}).limit(200);
    if(data.status&&data.status!=='all')q=q.eq('status',data.status);
    if(data.priority&&data.priority!=='all')q=q.eq('priority',data.priority);
    const{data:rows,error}=await q;
    if(error)return{success:false,message:error.message};
    const usersById=await getUsersById();
    let tickets=(rows||[]).map(t=>ticketRowToObj(t,usersById));
    if(data.q){
      const ql=data.q.toLowerCase();
      tickets=tickets.filter(t=>(t.desc||'').toLowerCase().includes(ql)||(t.problemType||'').toLowerCase().includes(ql)||(t.requesterName||'').toLowerCase().includes(ql)||(t.id||'').toLowerCase().includes(ql));
    }
    if(data.overdueOnly)tickets=tickets.filter(t=>t.isOverdue);
    return{success:true,tickets};
  },

  'tickets.myList':async()=>{
    if(!S.user)return{success:false,message:'غير مسجل دخول'};
    const{data:rows,error}=await sb.from('tickets').select('id,title,desc,problem_type,priority,status,requester_id,requester_name,requester_dept,assigned_id,assigned_name,notes,history,created_at,updated_at,solved_at').eq('requester_id',S.user.id).order('created_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    const usersById=await getUsersById();
    return{success:true,tickets:(rows||[]).map(t=>ticketRowToObj(t,usersById))};
  },

  'tickets.create':async(data)=>{
    data=data||{};
    if(!S.user)return{success:false,message:'غير مسجل دخول'};
    const desc=data.description||data.desc||data.problem||'';
    const problemType=data.problemType||data.problem||'';
    const row={
      title:problemType||'بلاغ جديد',
      desc:desc,
      problem_type:problemType,
      priority:data.priority||'متوسطة',
      status:'جديدة',
      requester_id:S.user.id,
      requester_name:S.user.firstName+' '+S.user.lastName,
      requester_dept:S.user.dept,
      attachments:data.deviceId?{deviceId:data.deviceId}:[],
      history:[nowHistoryEntry('تم إنشاء البلاغ',S.user.firstName+' '+S.user.lastName)]
    };
    const{data:inserted,error}=await sb.from('tickets').insert(row).select().single();
    if(error)return{success:false,message:error.message};
    if(data.imageBase64){
      try{await API['tickets.attach']({ticketId:inserted.id,base64:data.imageBase64,fileName:'image.png'});}catch(e){}
    }
    notifyNewTicketByEmail({id:inserted.id,problemType,desc,priority:row.priority,requesterName:S.user.firstName+' '+S.user.lastName,requesterDept:S.user.dept});
    const{data:notifyTargets}=await sb.from('users').select('id').in('role',['it','it_manager','admin','tech','manager']);
    notifyUsers((notifyTargets||[]).map(u=>u.id),`بلاغ جديد: ${problemType||'بلاغ'} من ${S.user.firstName} ${S.user.lastName}`,inserted.id);
    return{success:true,message:'تم إرسال البلاغ بنجاح',ticketId:inserted.id};
  },

  'tickets.update':async(data)=>{
    data=data||{};
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const upd={updated_at:new Date().toISOString()};
    const hist=cur.history||[];
    if(data.status){upd.status=data.status;hist.push(nowHistoryEntry('تغيير الحالة إلى '+data.status,S.user?(S.user.firstName+' '+S.user.lastName):''));if(data.status==='تم حل البلاغ')upd.solved_at=new Date().toISOString();}
    if(data.solution!==undefined&&data.solution!==''){upd.notes=data.solution;hist.push(nowHistoryEntry('تم تسجيل حل: '+data.solution,S.user?(S.user.firstName+' '+S.user.lastName):''));}
    else if(data.notes!==undefined&&data.notes!==''){upd.notes=data.notes;}
    upd.history=hist;
    const{error}=await sb.from('tickets').update(upd).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تحديث البلاغ'};
  },

  'tickets.claim':async(data)=>{
    if(!S.user)return{success:false,message:'غير مسجل دخول'};
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const hist=cur.history||[];
    hist.push(nowHistoryEntry('تم استلام البلاغ',S.user.firstName+' '+S.user.lastName));
    const{error}=await sb.from('tickets').update({
      assigned_id:S.user.id,assigned_name:S.user.firstName+' '+S.user.lastName,
      status:cur.status==='جديدة'?'معينة':cur.status,history:hist,updated_at:new Date().toISOString()
    }).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم استلام البلاغ'};
  },

  'tickets.assign':async(data)=>{
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const{data:u,error:e2}=await sb.from('users').select('*').eq('id',data.assigneeId).single();
    if(e2||!u)return{success:false,message:'المستخدم غير موجود'};
    const{firstName,lastName}=splitName(u.name);
    const hist=cur.history||[];
    hist.push(nowHistoryEntry('تم التعيين إلى '+firstName+' '+lastName,S.user?(S.user.firstName+' '+S.user.lastName):''));
    const{error}=await sb.from('tickets').update({
      assigned_id:u.id,assigned_name:firstName+' '+lastName,
      status:cur.status==='جديدة'?'معينة':cur.status,history:hist,updated_at:new Date().toISOString()
    }).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم التعيين'};
  },

  'tickets.unassign':async(data)=>{
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const hist=cur.history||[];
    hist.push(nowHistoryEntry('تم إلغاء التعيين',S.user?(S.user.firstName+' '+S.user.lastName):''));
    const{error}=await sb.from('tickets').update({assigned_id:null,assigned_name:null,status:'جديدة',history:hist,updated_at:new Date().toISOString()}).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم إلغاء التعيين'};
  },

  'tickets.help':async(data)=>{
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const hist=cur.history||[];
    hist.push(nowHistoryEntry('طلب مساعدة: '+(data.helpNotes||''),S.user?(S.user.firstName+' '+S.user.lastName):''));
    const{error}=await sb.from('tickets').update({history:hist,updated_at:new Date().toISOString()}).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    // notify the helper
    if(data.helperId){
      try{await sb.from('notifications').insert({user_id:data.helperId,ticket_id:data.ticketId,message:'طلب مساعدة في البلاغ '+data.ticketId});}catch(e){}
    }
    return{success:true,message:'تم إرسال طلب المساعدة'};
  },

  'tickets.attach':async(data)=>{
    const{data:cur,error:e1}=await sb.from('tickets').select('*').eq('id',data.ticketId).single();
    if(e1||!cur)return{success:false,message:'البلاغ غير موجود'};
    const atts=Array.isArray(cur.attachments)?cur.attachments:[];
    atts.push({fileName:data.fileName,mimeType:data.mimeType,base64:data.base64||data.fileBase64,addedAt:new Date().toISOString()});
    const{error}=await sb.from('tickets').update({attachments:atts,updated_at:new Date().toISOString()}).eq('id',data.ticketId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم رفع المرفق'};
  },

  'tickets.delete':async(data)=>{
    try{await sb.from('notifications').delete().eq('ticket_id',data.ticketId);}catch(e){}
    const{error}=await sb.from('tickets').delete().eq('id',data.ticketId);
    if(error){
      if(error.message.includes('foreign key')){
        await sb.rpc('delete_ticket_cascade',{tid:data.ticketId}).catch(()=>{});
        const{error:e2}=await sb.from('tickets').delete().eq('id',data.ticketId);
        if(e2)return{success:false,message:e2.message};
      }else return{success:false,message:error.message};
    }
    return{success:true,message:'تم الحذف'};
  },

  /* ---------- USERS ---------- */
  'users.list':async()=>{
    const{data:rows,error}=await sb.from('users').select('*').order('created_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    return{success:true,users:(rows||[]).map(mapUserRow)};
  },

  'users.create':async(data)=>{
    data=data||{};
    const fullName=(data.firstName||'')+' '+(data.lastName||'');
    const row={
      emp_id:data.empId,password:data.password,name:fullName.trim(),
      role:data.role||'user',dept:data.department||null,
      email:data.email||null,phone:data.phone||null,active:true
    };
    const{error}=await sb.from('users').insert(row);
    if(error)return{success:false,message:error.message};
    const deviceId=(data.deviceId||'').trim();
    let dev=null;
    if(deviceId){
      const{data:d1}=await sb.from('device_usernames').select('*').eq('device_id',deviceId).maybeSingle();
      dev=d1;
    }
    if(!dev){
      const norm=s=>(s||'').replace(/\s+/g,' ').trim();
      const fn=norm(fullName);
      const{data:allDev}=await sb.from('device_usernames').select('*');
      if(allDev)dev=allDev.find(r=>{
        const did=norm(r.device_id);
        if(!did||/^احتياطي/.test(did))return false;
        if(did===fn)return true;
        if(did.includes(fn)||fn.includes(did))return true;
        const fParts=fn.split(' '),dParts=did.split(' ');
        if(fParts.length>=2&&dParts.length>=2&&fParts[0]===dParts[0]&&fParts[1]===dParts[1])return true;
        if(did.replace(/\s/g,'')===fn.replace(/\s/g,''))return true;
        return false;
      })||null;
    }
    if(dev){
      const{data:already}=await sb.from('internet_users').select('id').eq('username',dev.username).eq('network_label',dev.network_label).maybeSingle();
      if(!already){
        await sb.from('internet_users').insert({
          emp_id:data.empId,name:fullName.trim(),dept:data.department||null,network_label:dev.network_label,
          username:dev.username,password:dev.password,device_id:dev.device_id,notes:dev.notes,updated_at:new Date().toISOString()
        });
        return{success:true,message:'تم إنشاء الحساب وتعيين يوزر الإنترنت تلقائياً: '+dev.username};
      }
    }else if(deviceId){
      return{success:true,message:'تم إنشاء الحساب، لكن رقم الجهاز غير موجود بقائمة الأجهزة'};
    }
    return{success:true,message:'تم إنشاء الحساب'};
  },

  'users.resetPassword':async(data)=>{
    const{error}=await sb.from('users').update({password:data.newPassword}).eq('id',data.userId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تغيير كلمة المرور'};
  },

  'users.setActive':async(data)=>{
    const{error}=await sb.from('users').update({active:data.active}).eq('id',data.userId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:data.active?'تم التفعيل':'تم الإيقاف'};
  },

  'users.delete':async(data)=>{
    await sb.from('tickets').update({assigned_id:null}).eq('assigned_id',data.userId);
    await sb.from('notifications').delete().eq('user_id',data.userId);
    await sb.from('push_subscriptions').delete().eq('user_id',data.userId);
    const{error}=await sb.from('users').delete().eq('id',data.userId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },

  /* ---------- DEPARTMENTS ---------- */
  'departments.list':async()=>{
    const{data:rows,error}=await sb.from('departments').select('*').order('name');
    if(error)return{success:false,message:error.message};
    return{success:true,departments:rows||[]};
  },
  'departments.add':async(data)=>{
    const{error}=await sb.from('departments').insert({name:data.name});
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تمت الإضافة'};
  },
  'departments.delete':async(data)=>{
    const{error}=await sb.from('departments').delete().eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },
  'departments.update':async(data)=>{
    const{error}=await sb.from('departments').update({network_label:data.networkLabel||null}).eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحفظ'};
  },

  /* ---------- DEVICE USERNAME MAPPING ---------- */
  'device.username.list':async()=>{
    const{data:rows,error}=await sb.from('device_usernames').select('*').order('network_label');
    if(error)return{success:false,message:error.message};
    const{data:used}=await sb.from('internet_users').select('device_id,name,emp_id').not('device_id','is',null);
    const usedMap={};
    (used||[]).forEach(u=>{if(u.device_id)usedMap[u.device_id]={name:u.name,empId:u.emp_id};});
    return{success:true,items:(rows||[]).map(r=>{
      const linked=usedMap[r.device_id];
      const isSpare=/^احتياطي/.test(r.device_id||'');
      return{
        id:r.id,networkLabel:r.network_label,deviceId:r.device_id,username:r.username,password:r.password,notes:r.notes,
        assignedTo:linked?linked.name:(isSpare?null:r.device_id)
      };
    })};
  },
  'device.username.add':async(data)=>{
    const{error}=await sb.from('device_usernames').insert({network_label:data.networkLabel,device_id:data.deviceId,username:data.username,password:data.password||null,notes:data.notes||null});
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تمت الإضافة'};
  },
  'device.username.update':async(data)=>{
    const{error}=await sb.from('device_usernames').update({notes:data.notes||null}).eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحفظ'};
  },
  'device.username.delete':async(data)=>{
    const{error}=await sb.from('device_usernames').delete().eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },
  'device.username.lookup':async(data)=>{
    const q=(data.query||'').trim();
    if(!q)return{success:false,message:'أدخل رقم الجهاز أو اسم الموظف'};
    const norm=s=>(s||'').replace(/\s+/g,' ').trim();
    const qn=norm(q);
    const{data:rows}=await sb.from('device_usernames').select('*');
    if(!rows||!rows.length)return{success:false,message:'لا توجد بيانات'};
    const matches=rows.filter(r=>{
      const did=norm(r.device_id);
      if(!did)return false;
      if(did===qn)return true;
      if(did.includes(qn)||qn.includes(did))return true;
      const qParts=qn.split(' ').filter(Boolean);
      const dParts=did.split(' ').filter(Boolean);
      if(qParts.length>=2&&dParts.length>=2&&qParts[0]===dParts[0]&&qParts[1]===dParts[1])return true;
      const didNoSpace=did.replace(/\s/g,'');
      const qNoSpace=qn.replace(/\s/g,'');
      if(didNoSpace===qNoSpace||didNoSpace.includes(qNoSpace)||qNoSpace.includes(didNoSpace))return true;
      return false;
    });
    if(!matches.length)return{success:false,message:'لا توجد نتيجة بهذا الاسم/الرقم'};
    return{success:true,items:matches};
  },
  'admin.assign.internet':async(data)=>{
    const empId=(data.empId||'').trim();
    const devId=data.deviceUsernameId;
    if(!empId||!devId)return{success:false,message:'بيانات ناقصة'};
    const{data:u}=await sb.from('users').select('emp_id,name,dept').eq('emp_id',empId).maybeSingle();
    if(!u)return{success:false,message:'الموظف غير موجود'};
    const{data:dev}=await sb.from('device_usernames').select('*').eq('id',devId).maybeSingle();
    if(!dev)return{success:false,message:'الجهاز غير موجود'};
    const{data:already}=await sb.from('internet_users').select('id').eq('emp_id',empId).eq('username',dev.username).eq('network_label',dev.network_label).maybeSingle();
    if(already)return{success:false,message:'هذا اليوزر مضاف مسبقاً لهذا الموظف'};
    const{error}=await sb.from('internet_users').insert({emp_id:u.emp_id,name:u.name,dept:u.dept,network_label:dev.network_label,username:dev.username,password:dev.password,device_id:dev.device_id,notes:dev.notes,updated_at:new Date().toISOString()});
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تعيين اليوزر للموظف: '+dev.username};
  },
  'device.username.assign':async(data)=>{
    const{data:dev}=await sb.from('device_usernames').select('*').eq('id',data.deviceRowId).maybeSingle();
    if(!dev)return{success:false,message:'اليوزر غير موجود'};
    const{data:u}=await sb.from('users').select('emp_id,name,dept').eq('id',data.userId).maybeSingle();
    if(!u||!u.emp_id)return{success:false,message:'رقم البصمة غير موجود لهذا الموظف'};
    const{error}=await sb.from('internet_users').insert({
      emp_id:u.emp_id,name:u.name,dept:u.dept,network_label:dev.network_label,
      username:dev.username,password:dev.password,device_id:dev.device_id,notes:dev.notes,updated_at:new Date().toISOString()
    });
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تعيين اليوزر للموظف'};
  },

  /* ---------- SELF-SERVICE ADD INTERNET USERNAME ---------- */
  'internet.myAdd':async(data)=>{
    if(!S.user)return{success:false,message:'غير مسجل'};
    const{data:u}=await sb.from('users').select('emp_id,name,dept').eq('id',S.user.id).single();
    if(!u||!u.emp_id)return{success:false,message:'رقم البصمة غير موجود لحسابك'};
    let networkLabel=data.networkLabel||'',username=(data.username||'').trim(),password=null,deviceId=null,notes=null;
    if(data.kind==='device'){
      const{data:row}=await sb.from('device_usernames').select('*').eq('device_id',(data.deviceId||'').trim()).maybeSingle();
      if(!row)return{success:false,message:'رقم الجهاز غير موجود بقائمة الأجهزة'};
      networkLabel=row.network_label;username=row.username;password=row.password;deviceId=row.device_id;notes=row.notes;
    }
    if(!username)return{success:false,message:'يرجى إدخال اليوزر'};
    const{error}=await sb.from('internet_users').insert({emp_id:u.emp_id,name:u.name,dept:u.dept,network_label:networkLabel,username,password,device_id:deviceId,notes,updated_at:new Date().toISOString()});
    if(error)return{success:false,message:error.message};
    return{success:true,username,password,networkLabel,message:'تمت الإضافة بنجاح'};
  },

  /* ---------- DEVICES ---------- */
  'devices.list':async(data)=>{
    data=data||{};
    let q=sb.from('devices').select('*').order('created_at',{ascending:false});
    const{data:rows,error}=await q;
    if(error)return{success:false,message:error.message};
    let devices=(rows||[]).map(d=>({
      id:d.id,ticketId:d.ticket_id,deviceType:d.device_type,
      stage:mapDeviceStage(d.status),
      status:d.status,
      serialNumber:(d.notes||'').split('—')[1]?.trim()||(d.notes||''),
      ownerName:(d.history&&d.history[0]&&d.history[0].owner)||'',
      issueDescription:d.notes||'',
      notes:d.notes,history:d.history||[],
      createdAt:d.created_at,updatedAt:d.updated_at
    }));
    if(data.filter&&data.filter!=='all')devices=devices.filter(d=>d.status===data.filter);
    return{success:true,devices};
  },

  'devices.checkin':async(data)=>{
    if(!S.user)return{success:false,message:'غير مسجل دخول'};
    const row={
      ticket_id:data.ticketId||null,
      device_type:data.deviceType||'other',
      status:'عند IT',
      notes:[data.serialNumber||data.desc,data.ownerName,data.dept,data.issueDescription||data.notes].filter(Boolean).join(' — '),
      checked_in_by:S.user.id,
      history:[{action:'استلام من الموظف',by:S.user.firstName+' '+S.user.lastName,time:new Date().toLocaleString('ar-EG'),owner:data.ownerName||data.owner}]
    };
    const{error}=await sb.from('devices').insert(row);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تسجيل استلام الجهاز'};
  },

  'devices.sendToTech':async(data)=>{
    const{data:cur,error:e1}=await sb.from('devices').select('*').eq('id',data.deviceId).single();
    if(e1||!cur)return{success:false,message:'الجهاز غير موجود'};
    const hist=cur.history||[];
    hist.push({action:'تسليم للفني',by:S.user?(S.user.firstName+' '+S.user.lastName):'',time:new Date().toLocaleString('ar-EG'),notes:data.notes});
    const{error}=await sb.from('devices').update({status:'عند الفني',sent_to_tech:data.techId||null,history:hist,updated_at:new Date().toISOString()}).eq('id',data.deviceId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم إرسال الجهاز للفني'};
  },

  'devices.repairDone':async(data)=>{
    const{data:cur,error:e1}=await sb.from('devices').select('*').eq('id',data.deviceId).single();
    if(e1||!cur)return{success:false,message:'الجهاز غير موجود'};
    const hist=cur.history||[];
    hist.push({action:'تمت الصيانة',by:S.user?(S.user.firstName+' '+S.user.lastName):'',time:new Date().toLocaleString('ar-EG'),notes:data.repairNotes||data.work,result:data.result,ready:data.ready});
    const newStatus=data.ready==='no'?'بانتظار قطع غيار':'أُنجز — بانتظار IT';
    const{error}=await sb.from('devices').update({status:newStatus,history:hist,updated_at:new Date().toISOString()}).eq('id',data.deviceId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تسجيل إتمام الإصلاح'};
  },

  'devices.receiveBack':async(data)=>{
    const{data:cur,error:e1}=await sb.from('devices').select('*').eq('id',data.deviceId).single();
    if(e1||!cur)return{success:false,message:'الجهاز غير موجود'};
    const hist=cur.history||[];
    hist.push({action:'استلام من الفني',by:S.user?(S.user.firstName+' '+S.user.lastName):'',time:new Date().toLocaleString('ar-EG'),notes:data.notes});
    const{error}=await sb.from('devices').update({status:'جاهز للتسليم',history:hist,updated_at:new Date().toISOString()}).eq('id',data.deviceId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم استلام الجهاز من الفني'};
  },

  'devices.deliver':async(data)=>{
    const{data:cur,error:e1}=await sb.from('devices').select('*').eq('id',data.deviceId).single();
    if(e1||!cur)return{success:false,message:'الجهاز غير موجود'};
    const hist=cur.history||[];
    hist.push({action:'تسليم للموظف',by:S.user?(S.user.firstName+' '+S.user.lastName):'',time:new Date().toLocaleString('ar-EG'),notes:data.deliveryNotes,condition:data.condition});
    const{error}=await sb.from('devices').update({status:'مُسلَّم',history:hist,updated_at:new Date().toISOString()}).eq('id',data.deviceId);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم تسليم الجهاز للموظف'};
  },

  /* ---------- INTERNET USERS ---------- */
  'internet.users.list':async()=>{
    const{data:rows,error}=await sb.from('internet_users').select('*').order('updated_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    return{success:true,users:(rows||[]).map(u=>({
      id:u.id,empId:u.emp_id,name:u.name,dept:u.dept,networkLabel:u.network_label,username:u.username,quota:u.quota,
      active:u.active!==false,updatedAt:u.updated_at
    }))};
  },
  'internet.users.update':async(data)=>{
    const upd={name:data.name,dept:data.dept,emp_id:data.empId,network_label:data.networkLabel,username:data.username,updated_at:new Date().toISOString()};
    if(data.password!==undefined)upd.password=data.password;
    if(data.quota!==undefined)upd.notes=String(data.quota);
    if(data.active!==undefined)upd.active=data.active;
    let q;
    if(data.id)q=sb.from('internet_users').update(upd).eq('id',data.id);
    else q=sb.from('internet_users').insert(upd);
    const{error}=await q;
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم التحديث'};
  },
  'internet.users.delete':async(data)=>{
    const{error}=await sb.from('internet_users').delete().eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },
  'internet.users.search':async(data)=>{
    const empId=data.empId||'';
    const{data:user}=await sb.from('users').select('*').eq('emp_id',empId).maybeSingle();
    if(!user)return{success:false,message:'الموظف غير موجود'};
    const{data:rows}=await sb.from('internet_users').select('*').eq('emp_id',empId);
    return{success:true,user:mapUserRow(user),internetUsers:rows||[]};
  },

  /* ---------- NOTIFICATIONS ---------- */
  'notifications.list':async()=>{
    if(!S.user)return{success:false,message:'غير مسجل دخول'};
    const{data:rows,error}=await sb.from('notifications').select('*').eq('user_id',S.user.id).order('created_at',{ascending:false}).limit(30);
    if(error)return{success:false,message:error.message};
    return{success:true,notifications:(rows||[]).map(n=>({id:n.ticket_id||n.id,notifId:n.id,message:n.message,read:n.read,createdAt:n.created_at}))};
  },
  'notifications.markAllRead':async()=>{
    if(!S.user)return{success:false};
    const{error}=await sb.from('notifications').update({read:true}).eq('user_id',S.user.id).eq('read',false);
    if(error)return{success:false,message:error.message};
    return{success:true};
  },
  'notifications.broadcastClaim':async(data)=>{
    // notify other IT staff that a ticket was claimed
    const{data:itUsers}=await sb.from('users').select('id').in('role',['it','it_manager','admin','tech']);
    const ids=(itUsers||[]).filter(u=>u.id!==S.user.id).map(u=>u.id);
    notifyUsers(ids,(data.claimerName||'')+' استلم البلاغ '+data.ticketId,data.ticketId);
    return{success:true};
  },
  'notifications.broadcastAssign':async(data)=>{
    // notify the assigned staff member + other IT staff
    const{data:itUsers}=await sb.from('users').select('id').in('role',['it','it_manager','admin','tech']);
    const otherIds=(itUsers||[]).map(u=>u.id).filter(id=>id!==data.assigneeId);
    if(data.assigneeId)notifyUsers([data.assigneeId],`تم تعيينك للبلاغ ${data.ticketId}`,data.ticketId);
    notifyUsers(otherIds,`تم تعيين ${data.assigneeName||'موظف'} للبلاغ ${data.ticketId}`,data.ticketId);
    return{success:true};
  },

  /* ---------- GUIDELINES ---------- */
  'guidelines.list':async()=>{
    const{data:rows,error}=await sb.from('guidelines').select('*').order('created_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    return{success:true,guidelines:rows||[]};
  },
  'guidelines.add':async(data)=>{
    const{error}=await sb.from('guidelines').insert({title:data.title,content:data.content,icon:data.icon,priority:data.priority});
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تمت الإضافة'};
  },
  'guidelines.update':async(data)=>{
    const{error}=await sb.from('guidelines').update({title:data.title,content:data.content,icon:data.icon,priority:data.priority}).eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم التعديل'};
  },
  'guidelines.delete':async(data)=>{
    const{error}=await sb.from('guidelines').delete().eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },

  /* ---------- MANUAL ---------- */
  'manual.list':async()=>{
    const{data:rows,error}=await sb.from('manual_entries').select('*').order('created_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    return{success:true,entries:(rows||[]).map(m=>{
      let content={};
      try{content=JSON.parse(m.content||'{}');}catch(e){content={};}
      return{id:m.id,device:m.device_type,title:m.title,desc:content.desc||'',steps:content.steps||[],icon:content.icon||'fas fa-book',createdAt:m.created_at};
    })};
  },
  'manual.add':async(data)=>{
    const content=JSON.stringify({desc:data.desc||'',steps:data.steps||[],icon:data.icon||'fas fa-book'});
    const{error}=await sb.from('manual_entries').insert({device_type:data.deviceType,title:data.title,content});
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تمت الإضافة'};
  },
  'manual.delete':async(data)=>{
    const{error}=await sb.from('manual_entries').delete().eq('id',data.id);
    if(error)return{success:false,message:error.message};
    return{success:true,message:'تم الحذف'};
  },

  /* ---------- KNOWLEDGE ---------- */
  'knowledge.list':async()=>{
    const{data:rows,error}=await sb.from('knowledge').select('*').order('created_at',{ascending:false}).limit(50);
    if(error)return{success:false,message:error.message};
    return{success:true,items:(rows||[]).map(k=>({id:k.id,problem:k.topic,solution:k.content}))};
  },

  /* ---------- AI CHAT ---------- */
  'ai.chat':async(data)=>{
    try{
      const{data:res,error}=await sb.functions.invoke('ai-chat',{body:{messages:(data&&data.messages)||[],device:data&&data.device}});
      if(error)return{success:false,message:error.message||'خطأ في المساعد الذكي'};
      return{success:true,reply:res&&res.reply};
    }catch(e){return{success:false,message:'خطأ في الاتصال بالمساعد الذكي'};}
  },

  /* ---------- USER INFO ---------- */
  'user.myInfo':async()=>{
    if(!S.user)return{success:false};
    const{data:u}=await sb.from('users').select('*').eq('id',S.user.id).single();
    const{count}=await sb.from('tickets').select('id',{count:'exact',head:true}).eq('requester_id',S.user.id);
    let internetUsers=[];
    if(u&&u.emp_id){
      const{data:rows}=await sb.from('internet_users').select('id,network_label,username,password,device_id,dept').eq('emp_id',u.emp_id);
      internetUsers=rows||[];
    }
    let networkLabel='';
    if(u&&u.dept){
      const{data:d}=await sb.from('departments').select('network_label').eq('name',u.dept).maybeSingle();
      networkLabel=(d&&d.network_label)||'';
    }
    return{success:true,internetUsers,internetUser:internetUsers[0]?internetUsers[0].username:null,phone:u?u.phone:null,ticketCount:count||0,networkLabel};
  },

  'stats.periods':async()=>{
    const{data:rows,error}=await sb.from('tickets').select('status,created_at');
    if(error)return{success:false,message:error.message};
    const tickets=rows||[];
    const now=new Date();
    const todayStr=now.toISOString().slice(0,10);
    const monthStr=now.toISOString().slice(0,7);
    const mk=()=>({total:0,resolved:0,unresolved:0});
    const day=mk(),month=mk(),overall=mk();
    tickets.forEach(t=>{
      const solved=t.status==='تم حل البلاغ';
      const d=(t.created_at||'').slice(0,10),m=(t.created_at||'').slice(0,7);
      overall.total++;solved?overall.resolved++:overall.unresolved++;
      if(m===monthStr){month.total++;solved?month.resolved++:month.unresolved++;}
      if(d===todayStr){day.total++;solved?day.resolved++:day.unresolved++;}
    });
    const rate=p=>p.total?Math.round(p.resolved/p.total*100):0;
    day.rate=rate(day);month.rate=rate(month);overall.rate=rate(overall);
    return{success:true,day,month,overall};
  },

  /* ---------- STATS ---------- */
  'stats.dashboard':async()=>{
    const{data:rows,error}=await sb.from('tickets').select('*');
    if(error)return{success:false,message:error.message};
    const tickets=rows||[];
    const stats={total:tickets.length,open:0,assigned:0,inProgress:0,closed:0,overdue:0};
    const byPriority={'عاجلة':0,'عالية':0,'متوسطة':0,'منخفضة':0};
    const probCount={};
    const perfMap={};
    tickets.forEach(t=>{
      if(t.status==='جديدة')stats.open++;
      else if(t.status==='معينة')stats.assigned++;
      else if(t.status==='قيد المعالجة')stats.inProgress++;
      else if(t.status==='تم حل البلاغ')stats.closed++;
      if(computeOverdue({status:t.status,createdAt:t.created_at}))stats.overdue++;
      if(t.priority)byPriority[t.priority]=(byPriority[t.priority]||0)+1;
      if(t.problem_type)probCount[t.problem_type]=(probCount[t.problem_type]||0)+1;
      if(t.assigned_name){
        perfMap[t.assigned_name]=perfMap[t.assigned_name]||{name:t.assigned_name,total:0,solved:0,open:0,times:[]};
        perfMap[t.assigned_name].total++;
        if(t.status==='تم حل البلاغ'){
          perfMap[t.assigned_name].solved++;
          if(t.solved_at&&t.created_at)perfMap[t.assigned_name].times.push((new Date(t.solved_at)-new Date(t.created_at))/3600000);
        }else perfMap[t.assigned_name].open++;
      }
    });
    const itPerformance=Object.values(perfMap).map(p=>({
      name:p.name,total:p.total,solved:p.solved,open:p.open,
      rate:p.total?Math.round(p.solved/p.total*100):0,
      avg:p.times.length?Math.round(p.times.reduce((a,b)=>a+b,0)/p.times.length):0
    }));
    const topProblems=Object.entries(probCount).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,5);
    // daily counts for last 14 days
    const dayMap={};
    tickets.forEach(t=>{
      if(!t.created_at)return;
      const d=t.created_at.slice(0,10);
      dayMap[d]=(dayMap[d]||0)+1;
    });
    const daily=Object.entries(dayMap).sort((a,b)=>a[0]<b[0]?-1:1).slice(-14).map(([d,c])=>({d,c}));
    return{success:true,stats,byPriority,topProblems,itPerformance,daily};
  },

  'stats.user':async()=>{
    if(!S.user)return{success:false};
    const{data:rows,error}=await sb.from('tickets').select('id,title,desc,problem_type,priority,status,requester_id,requester_name,requester_dept,assigned_id,assigned_name,notes,history,created_at,updated_at,solved_at').eq('requester_id',S.user.id).order('created_at',{ascending:false});
    if(error)return{success:false,message:error.message};
    const tickets=rows||[];
    const stats={total:tickets.length,open:0,closed:0,inProgress:0};
    tickets.forEach(t=>{
      if(t.status==='جديدة')stats.open++;
      else if(t.status==='تم حل البلاغ')stats.closed++;
      else if(t.status==='قيد المعالجة')stats.inProgress++;
    });
    const recent=tickets.slice(0,5).map(t=>({problemType:t.problem_type,status:t.status,createdAt:t.created_at}));
    return{success:true,stats,recent};
  },

  'stats.reset':async()=>{
    if(!S.user||S.user.role!=='admin')return{success:false,message:'غير مخوّل'};
    const{error:nErr}=await sb.from('notifications').delete().not('ticket_id','is',null);
    if(nErr)return{success:false,message:nErr.message};
    const{error}=await sb.from('tickets').delete().not('id','is',null);
    if(error)return{success:false,message:error.message};
    cc('dashboard');
    return{success:true};
  },

  'stats.tech':async()=>{
    if(!S.user)return{success:false};
    const{data:rows,error}=await sb.from('devices').select('*').eq('sent_to_tech',S.user.id);
    if(error)return{success:false,message:error.message};
    const devices=rows||[];
    const solved=devices.filter(d=>d.status==='أُنجز — بانتظار IT'||d.status==='جاهز للتسليم'||d.status==='مُسلَّم').length;
    const pending=devices.filter(d=>d.status==='عند الفني').length;
    return{success:true,solved,pending,avgTime:'—'};
  }
};

function mapDeviceStage(status){
  const map={'عند IT':'checkin','عند الفني':'sent_tech','بانتظار قطع غيار':'sent_tech','أُنجز — بانتظار IT':'repaired','جاهز للتسليم':'received_back','مُسلَّم':'delivered'};
  return map[status]||'checkin';
}

async function api(action,data){
  if(API[action])return API[action](data);
  return Promise.reject('unknown action: '+action);
}
