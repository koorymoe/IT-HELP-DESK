// Supabase Edge Function: notify-email
// Sends a professional email notification via Resend.
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
    const actions = body.actions || ""; // pre-built HTML for action buttons
    const accent = body.accent || "#6366f1"; // accent color (e.g. priority color)
    const badge = body.badge || ""; // small label, e.g. priority name

    if (!to) {
      return new Response(
        JSON.stringify({ error: "to is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const from = Deno.env.get("NOTIFY_FROM_EMAIL") || "IT Help Desk <onboarding@resend.dev>";

    const badgeHtml = badge
      ? `<span style="display:inline-block;background:${accent}1a;color:${accent};font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;border:1px solid ${accent}40;margin-bottom:10px">${badge}</span>`
      : "";

    const html = `
<div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#0f172a;padding:28px 16px">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:#1e293b;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.35);border:1px solid #334155">
      <div style="background:linear-gradient(135deg,${accent},#0f172a);padding:28px 24px;text-align:center;position:relative">
        <div style="font-size:36px;margin-bottom:8px">🛠️</div>
        <div style="color:#fff;font-size:19px;font-weight:800;letter-spacing:.3px">IT Help Desk</div>
        <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:4px">نظام الدعم الفني</div>
      </div>
      <div style="padding:28px 24px">
        ${badgeHtml ? `<div>${badgeHtml}</div>` : ""}
        <div style="font-size:17px;font-weight:800;color:#f1f5f9;margin:10px 0 14px;line-height:1.5">${subject}</div>
        <div style="font-size:14px;line-height:2;color:#cbd5e1;background:#0f172a;border-right:4px solid ${accent};padding:16px 18px;border-radius:10px">${message}</div>
        ${actions ? `<div style="margin-top:22px">${actions}</div>` : ""}
      </div>
      <div style="background:#0f172a;text-align:center;padding:16px;font-size:11px;color:#64748b;border-top:1px solid #1e293b">
        إشعار تلقائي من نظام IT Help Desk &mdash; لا حاجة للرد على هذا البريد
      </div>
    </div>
    <div style="text-align:center;color:#475569;font-size:11px;margin-top:14px">© IT Help Desk</div>
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
