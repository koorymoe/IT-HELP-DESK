# Supabase Edge Functions

## ai-chat

Proxies AI chat requests from the IT Help Desk frontend to the Anthropic API
(model `claude-sonnet-4-20250514`).

### 1. Set the Anthropic API key secret

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Deploy the function

```bash
supabase functions deploy ai-chat
```

### Request format

```json
{
  "messages": [
    { "role": "user", "content": "الطابعة لا تطبع" }
  ],
  "device": "printer"
}
```

### Response format

```json
{ "reply": "تحقق من توصيل الكابل..." }
```

The frontend calls this function via `supabase.functions.invoke('ai-chat', { body: data })`
from `js/api.js` (`ai.chat` action).
