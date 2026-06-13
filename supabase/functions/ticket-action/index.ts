// Supabase Edge Function: ticket-action
// Handles clickable email actions: claim ticket, resolve/unresolve, manager assign.
// Deploy with: supabase functions deploy ticket-action
// Uses the auto-injected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://koorymoe.github.io/IT-HELP-DESK/";
const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
const NOTIFY_FROM = Deno.env.get("NOTIFY_FROM_EMAIL") || `IT Help Desk <${GMAIL_USER}>`;

const IT_ROLES = ["it", "it_manager", "admin", "tech"];

function page(title: string, body: string, ok = true) {
  return new Response(
    `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px}
      .card{max-width:480px;width:100%;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,.08);overflow:hidden}
      .head{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:22px;text-align:center;color:#fff;font-weight:700;font-size:18px}
      .body{padding:24px;text-align:center}
      .icon{font-size:40px;margin-bottom:10px}
      .msg{font-size:15px;color:${ok ? "#1e293b" : "#b91c1c"};line-height:1.8;margin-bottom:18px}
      a.btn{display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;margin:6px}
      a.btn.green{background:#10b981}
      a.btn.red{background:#ef4444}
      .item{display:block;padding:12px 16px;margin:6px 0;background:#f8fafc;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;border:1px solid #e2e8f0}
      .item:hover{background:#eef2ff}
    </style></head>
    <body><div class="card"><div class="head">🛠️ IT Help Desk</div><div class="body">${body}</div></div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline" } },
  );
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function sendEmail(to: string | string[], subject: string, message: string) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const html = `
<div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#0f172a;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.35);border:1px solid #334155">
    <div style="background:linear-gradient(135deg,#6366f1,#0f172a);padding:24px;text-align:center">
      <div style="font-size:32px;margin-bottom:6px">🛠️</div>
      <div style="color:#fff;font-size:18px;font-weight:700">IT Help Desk</div>
    </div>
    <div style="padding:24px">
      <div style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px">${subject}</div>
      <div style="font-size:14px;line-height:1.8;color:#cbd5e1;background:#0f172a;border-right:4px solid #6366f1;padding:14px 16px;border-radius:8px">${message}</div>
      <div style="margin-top:24px;text-align:center">
        <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px">فتح النظام</a>
      </div>
    </div>
    <div style="background:#0f172a;text-align:center;padding:14px;font-size:12px;color:#64748b;border-top:1px solid #1e293b">إشعار تلقائي من نظام IT Help Desk</div>
  </div>
</div>`;
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });
    await client.send({ from: NOTIFY_FROM, to: Array.isArray(to) ? to : [to], subject, html, content: "auto" });
    await client.close();
  } catch (_e) { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const ticketId = url.searchParams.get("ticket") || "";
  const email = url.searchParams.get("email") || "";

  if (!ticketId) return page("خطأ", `<div class="icon">⚠️</div><div class="msg">رابط غير صالح</div>`, false);

  // load ticket
  const tRes = await rest(`tickets?id=eq.${ticketId}&select=*`);
  const tickets = await tRes.json();
  const ticket = tickets && tickets[0];
  if (!ticket) return page("خطأ", `<div class="icon">⚠️</div><div class="msg">البلاغ غير موجود</div>`, false);

  // load acting user by email
  let actor: any = null;
  if (email) {
    const uRes = await rest(`users?email=eq.${encodeURIComponent(email)}&select=id,name,email,role`);
    const users = await uRes.json();
    actor = users && users[0];
  }

  if (action === "claim") {
    if (!actor) return page("خطأ", `<div class="icon">⚠️</div><div class="msg">تعذر التحقق من هويتك</div>`, false);
    if (ticket.assigned_id && ticket.assigned_id !== actor.id) {
      return page("تم الاستلام مسبقاً", `<div class="icon">ℹ️</div><div class="msg">هذا البلاغ تم استلامه مسبقاً من قبل <b>${ticket.assigned_name || ""}</b></div><a class="btn" href="${APP_URL}">فتح النظام</a>`, false);
    }
    if (!ticket.assigned_id) {
      const patchRes = await rest(`tickets?id=eq.${ticketId}&assigned_id=is.null`, {
        method: "PATCH",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify({ assigned_id: actor.id, assigned_name: actor.name, status: "قيد المعالجة" }),
      });
      const updated = await patchRes.json();
      if (!updated || !updated.length) {
        return page("تم الاستلام مسبقاً", `<div class="icon">ℹ️</div><div class="msg">عذراً، تم استلام هذا البلاغ من قبل موظف آخر قبلك</div><a class="btn" href="${APP_URL}">فتح النظام</a>`, false);
      }
      // notify other IT staff that this ticket was claimed
      const othersRes = await rest(`users?role=in.(${IT_ROLES.join(",")})&select=id`);
      const others = await othersRes.json();
      const rows = (others || [])
        .filter((u: any) => u.id !== actor.id)
        .map((u: any) => ({ user_id: u.id, ticket_id: ticketId, message: `تم استلام البلاغ "${ticket.title || ticketId}" من قبل ${actor.name}` }));
      if (rows.length) await rest(`notifications`, { method: "POST", body: JSON.stringify(rows) });
    } else {
      await rest(`tickets?id=eq.${ticketId}`, { method: "PATCH", body: JSON.stringify({ status: "قيد المعالجة" }) });
    }
    const resolveLink = `${SUPABASE_URL}/functions/v1/ticket-action?action=resolve&ticket=${ticketId}&email=${encodeURIComponent(email)}`;
    const unresolveLink = `${SUPABASE_URL}/functions/v1/ticket-action?action=unresolve&ticket=${ticketId}&email=${encodeURIComponent(email)}`;
    return page("تم الاستلام", `<div class="icon">✅</div><div class="msg">تم استلام البلاغ بنجاح بواسطة <b>${actor.name}</b><br>عند إنجاز المهمة اختر الحالة المناسبة:</div>
      <a class="btn green" href="${resolveLink}">تم الحل</a>
      <a class="btn red" href="${unresolveLink}">لم يتم الحل</a>`);
  }

  if (action === "resolve" || action === "unresolve") {
    if (!actor) return page("خطأ", `<div class="icon">⚠️</div><div class="msg">تعذر التحقق من هويتك</div>`, false);
    if (ticket.assigned_id !== actor.id) {
      return page("غير مخوّل", `<div class="icon">⚠️</div><div class="msg">هذا البلاغ غير مُعيَّن لك</div>`, false);
    }
    const newStatus = action === "resolve" ? "تم حل البلاغ" : "قيد المعالجة";
    const body: any = { status: newStatus };
    if (action === "resolve") body.solved_at = new Date().toISOString();
    await rest(`tickets?id=eq.${ticketId}`, { method: "PATCH", body: JSON.stringify(body) });
    return page("تم التحديث", `<div class="icon">${action === "resolve" ? "🎉" : "🔄"}</div><div class="msg">تم تحديث حالة البلاغ إلى: <b>${newStatus}</b></div><a class="btn" href="${APP_URL}">فتح النظام</a>`);
  }

  if (action === "assignlist") {
    const sRes = await rest(`users?role=in.(${IT_ROLES.join(",")})&active=eq.true&select=id,name`);
    const staff = await sRes.json();
    const items = (staff || []).map((s: any) =>
      `<a class="item" href="${SUPABASE_URL}/functions/v1/ticket-action?action=assign&ticket=${ticketId}&staff=${s.id}&email=${encodeURIComponent(email)}">${s.name}</a>`
    ).join("");
    return page("تعيين البلاغ", `<div class="icon">👤</div><div class="msg">اختر الموظف المسؤول عن هذا البلاغ:</div>${items || '<div class="msg">لا يوجد موظفون</div>'}`);
  }

  if (action === "assign") {
    const staffId = url.searchParams.get("staff") || "";
    const sRes = await rest(`users?id=eq.${staffId}&select=id,name,email`);
    const staffArr = await sRes.json();
    const staff = staffArr && staffArr[0];
    if (!staff) return page("خطأ", `<div class="icon">⚠️</div><div class="msg">الموظف غير موجود</div>`, false);

    await rest(`tickets?id=eq.${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ assigned_id: staff.id, assigned_name: staff.name, status: "معينة" }),
    });

    // in-app notifications
    const otherRes = await rest(`users?role=in.(${IT_ROLES.join(",")})&select=id`);
    const others = await otherRes.json();
    const rows = (others || [])
      .filter((u: any) => u.id !== staff.id)
      .map((u: any) => ({ user_id: u.id, ticket_id: ticketId, message: `تم تعيين ${staff.name} للبلاغ ${ticket.title || ticketId}` }));
    rows.push({ user_id: staff.id, ticket_id: ticketId, message: `تم تعيينك للبلاغ: ${ticket.title || ticketId}` });
    if (rows.length) await rest(`notifications`, { method: "POST", body: JSON.stringify(rows) });

    // email the assigned staff member
    if (staff.email) {
      await sendEmail(staff.email, "تم تعيينك لبلاغ جديد", `تم تعيينك لمعالجة البلاغ: <b>${ticket.title || ""}</b><br>الوصف: ${ticket.desc || ""}<br><br><a href="${SUPABASE_URL}/functions/v1/ticket-action?action=claim&ticket=${ticketId}&email=${encodeURIComponent(staff.email)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;margin-top:10px">بدء المعالجة</a>`);
    }

    return page("تم التعيين", `<div class="icon">✅</div><div class="msg">تم تعيين البلاغ إلى <b>${staff.name}</b> بنجاح</div><a class="btn" href="${APP_URL}">فتح النظام</a>`);
  }

  return page("خطأ", `<div class="icon">⚠️</div><div class="msg">إجراء غير معروف</div>`, false);
});
