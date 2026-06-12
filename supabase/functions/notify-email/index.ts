// Supabase Edge Function: notify-email
// Sends an email notification via Resend.
// Deploy with: supabase functions deploy notify-email
// Requires secret: RESEND_API_KEY (supabase secrets set RESEND_API_KEY=...)
// Optional secret: NOTIFY_FROM_EMAIL (default: IT Help Desk <onboarding@resend.dev>)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const to = body.to;
    const subject = body.subject || "إشعار من نظام IT Help Desk";
    const message = body.message || "";

    if (!to) {
      return new Response(
        JSON.stringify({ error: "to is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const from = Deno.env.get("NOTIFY_FROM_EMAIL") || "IT Help Desk <onboarding@resend.dev>";

    const html = `
<div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f1f5f9;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center">
      <div style="font-size:32px;margin-bottom:6px">🛠️</div>
      <div style="color:#fff;font-size:18px;font-weight:700">IT Help Desk</div>
    </div>
    <div style="padding:24px">
      <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:12px">${subject}</div>
      <div style="font-size:14px;line-height:1.8;color:#475569;background:#f8fafc;border-right:4px solid #6366f1;padding:14px 16px;border-radius:8px">${message}</div>
      <div style="margin-top:24px;text-align:center">
        <a href="https://koorymoe.github.io/IT-HELP-DESK/" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px">فتح النظام</a>
      </div>
    </div>
    <div style="background:#f8fafc;text-align:center;padding:14px;font-size:12px;color:#94a3b8">إشعار تلقائي من نظام IT Help Desk</div>
  </div>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
