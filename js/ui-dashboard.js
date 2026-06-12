'use strict';
/* ── DASHBOARD & REPORTS & USER HOME ── */

async function loadDashboard(){const c=gc('dashboard');if(c)renderDash(c);try{const r=await api('stats.dashboard');if(r&&r.success){sc('dashboard',r,180);renderDash(r);}}catch(e){}}
function renderDash(r){
  const{stats,byPriority,topProblems,itPerformance}=r;
  const cfg=[{k:'total',l:'إجمالي',ic:'fa-chart-bar',c:'var(--in)',bg:'var(--in-l)'},{k:'open',l:'جديدة',ic:'fa-folder-open',c:'var(--bl)',bg:'var(--bl-l)'},{k:'assigned',l:'معينة',ic:'fa-user-check',c:'#92400e',bg:'var(--am-l)'},{k:'inProgress',l:'قيد المعالجة',ic:'fa-spinner',c:'#155e75',bg:'var(--cy-l)'},{k:'closed',l:'تم الحل',ic:'fa-check-circle',c:'var(--gr-d)',bg:'var(--gr-l)'},{k:'overdue',l:'متأخرة',ic:'fa-exclamation-triangle',c:'#b91c1c',bg:'var(--re-l)'}];
  document.getElementById('d-sg').innerHTML=cfg.map(s=>`<div class="sc" style="--sc:${s.c};--sc-bg:${s.bg}"><div class="sc-ic"><i class="fas ${s.ic}"></i></div><div class="sc-n" id="st-${s.k}">${stats[s.k]||0}</div><div class="sc-l">${s.l}</div></div>`).join('');
  cfg.forEach(s=>animN(document.getElementById('st-'+s.k)));
  const nb=document.getElementById('nb-ov');if(nb&&(stats.overdue||0)>0){nb.textContent=stats.overdue;nb.style.display='';}
  mkChart('cSt','doughnut',['جديدة','معينة','قيد المعالجة','تم الحل'],[stats.open,stats.assigned,stats.inProgress,stats.closed],['#3b82f6','#f59e0b','#06b6d4','#10b981']);
  mkChart('cPr','bar',['عاجلة','عالية','متوسطة','منخفضة'],[byPriority['عاجلة'],byPriority['عالية'],byPriority['متوسطة'],byPriority['منخفضة']],['#ef4444','#f59e0b','#3b82f6','#8b5cf6']);
  if(itPerformance&&itPerformance.length){document.getElementById('d-perf').style.display='';document.querySelector('#perfTbl tbody').innerHTML=itPerformance.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td style="text-align:center">${p.total}</td><td style="text-align:center;color:var(--gr-d)">${p.solved}</td><td style="text-align:center;color:#92400e">${p.open}</td><td style="min-width:90px"><div style="display:flex;align-items:center;gap:5px"><div class="pb"><div class="pbf" style="width:${p.rate}%"></div></div><span style="font-size:9px;color:var(--sl)">${p.rate}%</span></div></td><td style="text-align:center;font-size:11px;color:var(--sl)">${p.avg}h</td></tr>`).join('');}
  if(topProblems&&topProblems.length){const mx=topProblems[0].count;document.getElementById('d-prob').style.display='';document.getElementById('probList').innerHTML=topProblems.map(p=>`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span>${esc(p.name)}</span><span style="color:var(--sl)">${p.count}</span></div><div class="pb" style="height:6px"><div class="pbf" style="width:${Math.round(p.count/mx*100)}%"></div></div></div>`).join('');}
}

/* ── REPORTS ── */
async function loadReports(){const c=gc('dashboard');const src=c||(await api('stats.dashboard').then(r=>r&&r.success?r:null).catch(()=>null));if(!src)return;const{stats,byPriority,itPerformance,daily}=src;mkChart('cSt2','doughnut',['جديدة','معينة','قيد المعالجة','تم الحل'],[stats.open,stats.assigned,stats.inProgress,stats.closed],['#3b82f6','#f59e0b','#06b6d4','#10b981']);mkChart('cPr2','pie',['عاجلة','عالية','متوسطة','منخفضة'],[byPriority['عاجلة'],byPriority['عالية'],byPriority['متوسطة'],byPriority['منخفضة']],['#ef4444','#f59e0b','#3b82f6','#8b5cf6']);if(daily&&daily.length)mkChart('cDy','line',daily.map(d=>d.d),daily.map(d=>d.c),['#6366f1']);if(itPerformance&&itPerformance.length)mkChart('cTm','bar',itPerformance.map(p=>p.name),itPerformance.map(p=>p.solved),['#10b981'],'بلاغات محلولة');const rate=stats.total?Math.round(stats.closed/stats.total*100):0;document.getElementById('r-sum').innerHTML=[{l:'معدل الإنجاز',v:rate+'%',c:'var(--in)',bg:'var(--in-l)',ic:'fa-percentage'},{l:'محلولة',v:stats.closed,c:'var(--gr-d)',bg:'var(--gr-l)',ic:'fa-check-circle'},{l:'متأخرة',v:stats.overdue,c:'#b91c1c',bg:'var(--re-l)',ic:'fa-clock'}].map(s=>`<div class="sc" style="--sc:${s.c};--sc-bg:${s.bg}"><div class="sc-ic"><i class="fas ${s.ic}"></i></div><div class="sc-n">${s.v}</div><div class="sc-l">${s.l}</div></div>`).join('');}

/* ── USER HOME (MOBILE) ── */
async function loadUserHome(){try{const r=await api('stats.user');if(r&&r.success)renderUH(r);}catch(e){}}
function renderUH(r){
  const{stats,recent}=r,u=S.user;
  const av=document.getElementById('mob-av'),gr=document.getElementById('mob-gr'),dp=document.getElementById('mob-dp');
  if(av)av.textContent=(u.firstName[0]||'')+(u.lastName[0]||'');
  if(gr)gr.textContent=u.firstName+' '+u.lastName;
  if(dp)dp.textContent=u.dept;
  const ms=document.getElementById('mob-ms');
  if(ms)ms.innerHTML=[{n:stats.total,l:'الكل',c:'var(--in)'},{n:stats.open,l:'جديدة',c:'var(--bl)'},{n:stats.closed,l:'محلولة',c:'var(--gr-d)'},{n:stats.inProgress,l:'جارية',c:'#155e75'}].map(s=>`<div class="mob-stat"><div class="msn" style="color:${s.c}">${s.n}</div><div class="msl">${s.l}</div></div>`).join('');
  const colors={'جديدة':'#3b82f6','معينة':'#f59e0b','قيد المعالجة':'#06b6d4','تم حل البلاغ':'#10b981'};
  const recEl=document.getElementById('mob-rec');if(!recEl)return;
  if(!recent.length){recEl.innerHTML='<div style="text-align:center;padding:30px;color:var(--sl)"><i class="fas fa-clipboard" style="font-size:32px;opacity:.2;display:block;margin-bottom:10px"></i><div style="font-size:13px;font-weight:600">لا توجد بلاغات بعد</div></div>';return;}
  recEl.innerHTML=recent.map(t=>`<div class="mob-tc"><div class="mob-tc-l" style="background:${colors[t.status]||'#6366f1'}"></div><div class="mob-tc-body"><div class="mob-tc-tt">${esc(t.problemType)}</div><div class="mob-tc-meta">${esc(t.createdAt)}</div></div><div class="mob-tc-r"><span class="badge" style="background:${colors[t.status]||'#6366f1'}20;color:${colors[t.status]||'#6366f1'};border:1px solid ${colors[t.status]||'#6366f1'}40;font-size:9px">${esc(t.status)}</span></div></div>`).join('');
}

/* ── DESK USER HOME ── */
async function loadDeskUserHome(){
  const u=S.user;if(!u)return;
  const ini=(u.firstName[0]||'')+(u.lastName[0]||'');
  const setT=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—';};
  setT('desk-user-av',ini);setT('desk-user-name',u.firstName+' '+u.lastName);setT('desk-user-dept',u.dept);
  try{
    const r=await api('user.myInfo');
    if(r&&r.success){
      const list=r.internetUsers||[];
      setT('desk-user-iuser',list.length?list.map(iu=>(iu.network_label?iu.network_label+': ':'')+iu.username).join(' | '):'غير مُعيَّن');
    }
  }catch(e){}
  try{
    const r=await api('stats.user');
    if(r&&r.success){
      const{stats,recent}=r;
      setT('du-total',stats.total);setT('du-open',stats.open);setT('du-prog',stats.inProgress);setT('du-done',stats.closed);
      const colors={'جديدة':'#3b82f6','معينة':'#f59e0b','قيد المعالجة':'#06b6d4','تم حل البلاغ':'#10b981'};
      const el=document.getElementById('desk-user-tickets');
      if(el){
        if(!recent.length)el.innerHTML='<div class="empty"><i class="fas fa-clipboard"></i><h3>لا توجد بلاغات بعد</h3></div>';
        else el.innerHTML=recent.map(t=>`<div class="mob-tc"><div class="mob-tc-l" style="background:${colors[t.status]||'#6366f1'}"></div><div class="mob-tc-body"><div class="mob-tc-tt">${esc(t.problemType)}</div><div class="mob-tc-meta">${esc(t.createdAt)}</div></div><div class="mob-tc-r"><span class="badge" style="background:${colors[t.status]||'#6366f1'}20;color:${colors[t.status]||'#6366f1'};border:1px solid ${colors[t.status]||'#6366f1'}40;font-size:9px">${esc(t.status)}</span></div></div>`).join('');
      }
    }
  }catch(e){}
}

/* ── TECH STATS ── */
async function loadTechStats(){
  try{
    const r=await api('stats.tech');
    if(!r||!r.success)return;
    const setT=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    setT('ts-fixed',r.solved||0);
    setT('ts-pending',r.pending||0);
  }catch(e){}
}
