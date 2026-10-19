# Emergency calls: making them real

The Emergency screen (`src/features/settings/EmergencyCall.tsx`) has three kinds of call.

| What | Works today? | How |
|---|---|---|
| Local emergency numbers (120, 110, 999, 1669 …) | **Yes, real calls** | `tel:` links. The country comes from the user's location (Home → allow location). A second tap is required so a demo can't dial an ambulance by accident. |
| Insurer 24-hour hotlines (Ping An 95511, CPIC 95500, China Life 95519, PICC 95518) | **Yes, real calls** | `tel:` links to the insurers' published service numbers. |
| Talk to the WeWise AI on a phone call | **Needs setup** (below) | `VITE_AI_HOTLINE` and/or `VITE_AI_CALLBACK_URL`. Without them, the in-app AI conversation is a simulation. |

## 1. Test real dialling on your phone

`tel:` links open the phone dialler on a phone (on a laptop they open whatever calling app is installed).

```bash
pnpm dev --host          # prints a Network URL, e.g. http://192.168.1.20:5173
```

Open the Network URL on your phone (same Wi-Fi). Dialling works over plain HTTP.

**Location needs HTTPS** (browsers only allow it on `https://` or `localhost`). To test location on your phone, either deploy (Vercel, Netlify, Cloudflare Pages; all give HTTPS) or use an HTTPS tunnel to your dev server. Otherwise use "Use demo city".

## 2. Option A: an AI phone number the user calls (inbound)

1. Get a phone number from a voice platform and connect it to a voice AI agent that runs the calm-down script and lists emergency contacts.
   - Outside mainland China: e.g. Twilio Programmable Voice (or Vonage) with a speech-to-text → LLM → text-to-speech loop.
   - Mainland China numbers: Alibaba Cloud or Tencent Cloud voice / contact-centre products. A mainland number needs a registered business entity and real-name filing.
2. Put the number in `.env.local`:

   ```bash
   VITE_AI_HOTLINE=+86 400 000 0000
   ```

3. Restart `pnpm dev`. A "Call the WeWise AI line" button appears and dials the number for real.

## 3. Option B: the AI calls the user (outbound, "Call me")

The browser can't place a phone call by itself, so a small backend asks the voice platform to ring the user. Set:

```bash
VITE_AI_CALLBACK_URL=https://your-domain/api/call-me
```

The app sends `POST { phone, lang, city }`. A minimal Node serverless function with Twilio:

```js
// api/call-me.js  (Vercel / Netlify function, Node 18+)
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const SCRIPT = {
  en: { voice: 'Polly.Joanna', language: 'en-US', text: 'This is WeWise. Take a slow breath. If anyone is hurt, hang up and call the local emergency number now. Otherwise, tell me what happened.' },
  zh: { voice: 'Polly.Zhiyu', language: 'cmn-CN', text: '您好，这里是微晓。请先慢慢深呼吸。如果有人受伤，请挂断电话并立即拨打当地急救电话。否则，请告诉我发生了什么。' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN);       // your app's origin only
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { phone, lang } = req.body ?? {};
  const to = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!/^\+\d{8,15}$/.test(to)) return res.status(400).json({ error: 'Use international format, e.g. +8613800000000' });

  const s = SCRIPT[lang === 'zh' ? 'zh' : 'en'];
  const twiml = `<Response><Say voice="${s.voice}" language="${s.language}">${s.text}</Say>`
    + `<Gather input="speech" language="${s.language}" action="${process.env.VOICE_TURN_URL}" /></Response>`;
  await client.calls.create({ to, from: process.env.TWILIO_NUMBER, twiml });
  res.json({ ok: true });
}
```

`VOICE_TURN_URL` is your next endpoint: it receives what the caller said (`SpeechResult`), asks the LLM for the next calm, short reply, and returns more TwiML. For natural back-and-forth, use the platform's real-time streaming voice option instead of `<Gather>`.

## Before going live

- **Never replace emergency services.** The AI must tell the caller to hang up and dial 120/110 (or the local number) if anyone is hurt, and must not delay that call.
- **Stop abuse of "Call me".** Without protection, anyone could make your number ring strangers. Verify the phone number (SMS one-time code), require a signed-in user, and rate-limit per user and per number.
- **Consent and privacy.** Say at the start whether the call is recorded or transcribed. Voice and health details are sensitive personal information under China's PIPL; get explicit consent, keep data in-region, and delete it on a schedule.
- **Costs.** Phone numbers, per-minute calls and speech services are billed by the provider.
