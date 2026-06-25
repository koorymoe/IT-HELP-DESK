'use strict';
/* ── DEVICES WORKFLOW ── */

const DEV_STAGE_LABEL={checkin:'عند IT',sent_tech:'عند الفني',repaired:'أُنجز — بانتظار IT',received_back:'جاهز للتسليم',delivered:'مُسلَّم'};
const DEV_STAGE_COLOR={checkin:'var(--in)',sent_tech:'var(--am)',repaired:'var(--cy)',received_back:'var(--pu)',delivered:'var(--gr-d)'};

async function loadDevices(){
  const el=document.getElementById('devList');if(!el)return;
  el.innerHTML=skel(3);
  const filter=(document.getElementById('dev-filter')||{}).value||'all';
  try{
    const r=await api('devices.list',{filter});
    if(!r||!r.success){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>فشل التحميل</h3></div>';return;}
    S.devices=r.devices||[];
    renderDevList(S.devices);
  }catch(e){el.innerHTML='<div class="empty"><i class="fas fa-exclamation-circle"></i><h3>خطأ</h3></div>';}
}

async function doCheckin(){
  const tid=document.getElementById('ci-tid').value.trim();
  const tp=document.getElementById('ci-type').value;
  const desc=document.getElementById('ci-desc').value.trim();
  const owner=document.getElementById('ci-owner').value.trim();
  const dept=document.getElementById('ci-dept').value.trim();
  const notes=document.getElementById('ci-notes').value.trim();
  try{
    const r=await api('devices.checkin',{ticketId:tid||null,deviceType:tp,serialNumber:desc,ownerName:owner,dept:dept,issueDescription:notes});
    if(r&&r.success){
      toast('✅ '+r.message);
      ['ci-tid','ci-desc','ci-owner','ci-dept','ci-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      loadDevices();
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

function openSendTech(devId){
  S.did=devId;
  document.getElementById('st-devid').value=devId;
  document.getElementById('st-notes').value='';
  const sl=document.getElementById('st-tech');
  if(sl){
    const techs=(S.users||[]).filter(u=>u.role==='tech'&&u.active);
    sl.innerHTML=techs.map(u=>`<option value="${esc(u.id)}">${esc(u.firstName)} ${esc(u.lastName)}</option>`).join('')||'<option value="">لا يوجد فنيون</option>';
  }
  openM('ovSendTech');
}
async function subSendTech(){
  const devId=document.getElementById('st-devid').value||S.did;
  const techId=document.getElementById('st-tech').value;
  const notes=document.getElementById('st-notes').value.trim();
  try{
    const r=await api('devices.sendToTech',{deviceId:devId,techId,notes});
    if(r&&r.success){toast('✅ '+r.message);closeM('ovSendTech');loadDevices();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

async function subTechRepair(){
  const devId=document.getElementById('tr-devid').value.trim();
  const result=document.getElementById('tr-result').value;
  const work=document.getElementById('tr-work').value.trim();
  const reason=document.getElementById('tr-reason').value.trim();
  const ready=document.getElementById('tr-ready').value;
  if(!devId||!work){toast('رقم الجهاز وتفاصيل العمل مطلوبة',true);return;}
  try{
    const r=await api('devices.repairDone',{deviceId:devId,repairNotes:work+(reason?(' — '+reason):''),result,ready});
    if(r&&r.success){
      toast('✅ '+r.message);
      ['tr-devid','tr-work','tr-reason'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      loadDevices();
    }else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

function openReceiveBack(devId){
  S.did=devId;
  document.getElementById('rb-devid').value=devId;
  document.getElementById('rb-itNotes').value='';
  const d=(S.devices||[]).find(x=>x.id===devId);
  const tr=document.getElementById('rb-techResult');
  if(tr&&d){
    const last=(d.history||[]).slice().reverse().find(h=>h.action==='تمت الصيانة');
    tr.innerHTML=last?`<strong>${esc(last.by||'')}</strong>: ${esc(last.notes||'')}`:'لا توجد تفاصيل صيانة';
  }
  openM('ovReceiveBack');
}
async function subReceiveBack(){
  const devId=document.getElementById('rb-devid').value||S.did;
  const notes=document.getElementById('rb-itNotes').value.trim();
  try{
    const r=await api('devices.receiveBack',{deviceId:devId,notes});
    if(r&&r.success){toast('✅ '+r.message);closeM('ovReceiveBack');loadDevices();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

function openFinalDeliver(devId){
  S.did=devId;
  document.getElementById('fd-devid').value=devId;
  document.getElementById('fd-notes').value='';
  const d=(S.devices||[]).find(x=>x.id===devId);
  const sm=document.getElementById('fd-summary');
  if(sm&&d)sm.innerHTML=`<strong>${esc(d.deviceType)}</strong> — ${esc(d.serialNumber||'')}<br>صاحب الجهاز: ${esc(d.ownerName||'—')}`;
  openM('ovFinalDeliver');
}
async function subFinalDeliver(){
  const devId=document.getElementById('fd-devid').value||S.did;
  const condition=document.getElementById('fd-condition').value;
  const notes=document.getElementById('fd-notes').value.trim();
  try{
    const r=await api('devices.deliver',{deviceId:devId,condition,deliveryNotes:notes});
    if(r&&r.success){toast('✅ '+r.message);closeM('ovFinalDeliver');loadDevices();}
    else toast(r?r.message:'خطأ',true);
  }catch(e){toast('خطأ',true);}
}

function renderDevList(devices){
  const el=document.getElementById('devList');if(!el)return;
  if(!devices.length){el.innerHTML='<div class="empty"><i class="fas fa-laptop-medical"></i><h3>لا يوجد أجهزة</h3></div>';return;}
  const role=S.user?.role;
  el.innerHTML=devices.map(d=>{
    let actions='';
    if(d.stage==='checkin'&&['it','it_manager','admin'].includes(role))
      actions=`<button class="btn btn-w btn-sm" onclick="openSendTech('${esc(d.id)}')"><i class="fas fa-tools"></i>تسليم للفني</button>`;
    else if(d.stage==='repaired'&&['it','it_manager','admin'].includes(role))
      actions=`<button class="btn btn-s btn-sm" onclick="openReceiveBack('${esc(d.id)}')"><i class="fas fa-box-open"></i>استلام من الفني</button>`;
    else if(d.stage==='received_back'&&['it','it_manager','admin'].includes(role))
      actions=`<button class="btn btn-p btn-sm" onclick="openFinalDeliver('${esc(d.id)}')"><i class="fas fa-handshake"></i>تسليم للموظف</button>`;
    return `<div class="ti">
      <div class="ti-top">
        <div style="flex:1;min-width:0">
          <div class="ti-id"><i class="fas fa-hashtag"></i>${esc(d.id)} · ${esc(d.createdAt)}</div>
          <div class="ti-ttl">${DI[d.deviceType]||'🔧'} ${esc(DEVICE_LABELS[d.deviceType]||d.deviceType)}</div>
          <div class="ti-meta"><span><i class="fas fa-user" style="color:var(--in)"></i>${esc(d.ownerName||'—')}</span></div>
        </div>
        <div class="ti-bgs"><span class="badge" style="background:${DEV_STAGE_COLOR[d.stage]||'var(--in)'}22;color:${DEV_STAGE_COLOR[d.stage]||'var(--in)'}">${esc(DEV_STAGE_LABEL[d.stage]||d.status)}</span></div>
      </div>
      <div class="ti-desc">${esc(d.issueDescription||'')}</div>
      <div class="ti-acts">${actions}</div>
    </div>`;
  }).join('');
}
