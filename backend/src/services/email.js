/**
 * طبقة إرسال البريد الإلكتروني — قابلة للتبديل حسب البيئة (بلا أي أسرار في الكود).
 *
 * كل الإعدادات تأتي من Environment Variables / Secrets حصراً:
 *   EMAIL_PROVIDER      = mailpit | resend | mailchannels | console
 *                        (Production الافتراضي resend — لا يستخدم Mailpit إلا إذا ضُبط صراحة)
 *   EMAIL_FROM          = noreply@alzeina.com
 *   EMAIL_FROM_NAME     = AL ZEINA
 *   EMAIL_REPLY_TO      = support@alzeina.com (اختياري — Reply-To للرسائل)
 *   RESET_LINK_BASE_URL = https://your-store.pages.dev (أساس رابط إعادة التعيين — إلزامي في الإنتاج)
 *   RESEND_API_KEY      = (Secret) مفتاح Resend — للإنتاج فقط، عبر wrangler secret put
 *   EMAIL_MAILPIT_URL   = http://127.0.0.1:8025 (تطوير محلي فقط، لا يُستخدم إطلاقاً ما لم يُضبط provider=mailpit)
 *
 * mailpit      → التقاط محلي للرسائل (Development فقط) — لا يرسل شيئاً خارج الجهاز.
 * resend       → الإنتاج: HTTP API بخطة مجانية (100 رسالة/يوم، 3000/شهر). Workers-compatible (fetch فقط).
 * mailchannels → إنتاج مجاني عبر شراكة Cloudflare Workers (يتطلب دومين معتمد + سجلات DNS).
 * console      → تطوير بلا Mailpit: تسجيل to/from/subject فقط في سجلات الـWorker.
 *                ⚠️ لا يُطبع الرابط أو أي توكن في السجلات إطلاقاً.
 */

const MAILPIT_DEFAULT_URL = 'http://127.0.0.1:8025';

/**
 * اختيار المزوّد — فصل واضح بين البيئات:
 * - قيمة صريحة في EMAIL_PROVIDER تفوز دائماً (قرار المشغّل).
 * - الإنتاج بلا قيمة صريحة → resend (مزوّد حقيقي، لا localhost ولا Mailpit).
 * - غير الإنتاج بلا قيمة صريحة → mailpit (تطوير محلي فقط).
 */
const pickProvider = (env) => {
  const configured = String(env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
  const isProd = String(env.ENVIRONMENT || 'development') === 'production';
  return isProd ? 'resend' : 'mailpit';
};

/** يرجع رسالة خطأ وصفية إن كان المزوّد غير مكتمل التهيئة — أو null إن كان جاهزاً */
const providerConfig = (env, provider) => {
  const from = String(env.EMAIL_FROM || 'noreply@alzeina.com').trim();
  const fromName = String(env.EMAIL_FROM_NAME || 'AL ZEINA').trim();
  const replyTo = String(env.EMAIL_REPLY_TO || '').trim() || null;
  if (provider === 'resend') {
    const key = String(env.RESEND_API_KEY || '').trim();
    if (!key) return { error: 'RESEND_API_KEY secret is not configured (set it with: wrangler secret put RESEND_API_KEY)' };
    return { from, fromName, replyTo, key };
  }
  if (provider === 'mailchannels') {
    return { from, fromName, replyTo };
  }
  if (provider === 'mailpit') {
    const url = String(env.EMAIL_MAILPIT_URL || MAILPIT_DEFAULT_URL).trim();
    return { from, fromName, replyTo, url };
  }
  if (provider === 'console') return { from, fromName, replyTo };
  return { error: `unknown EMAIL_PROVIDER: ${provider}` };
};

/**
 * يرسل بريداً عبر المزوّد المحدد في البيئة.
 * @returns {{ok:boolean, provider:string, messageId?:string, error?:string}}
 * لا يرمي استثناءً أبداً — فشل البريد لا يجوز أن يكسر تدفق المصادقة أو يكشف معلومات.
 */
export async function sendEmail(env, { to, subject, html, text }) {
  const provider = pickProvider(env);
  const cfg = providerConfig(env, provider);
  if (cfg.error) return { ok: false, provider, error: cfg.error };

  const payload = {
    from: `${cfg.fromName} <${cfg.from}>`,
    to: String(to || ''),
    subject: String(subject || ''),
    html: String(html || ''),
    text: String(text || '')
  };

  try {
    if (provider === 'console') {
      // تطوير بلا Mailpit — بلا رابط وبلا توكن في السجلات
      console.log(`[email:console] to=${payload.to} subject=${payload.subject}`);
      return { ok: true, provider, messageId: 'console' };
    }

    if (provider === 'mailpit') {
      const res = await fetch(`${cfg.url}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: cfg.from, Name: cfg.fromName },
          To: [{ Email: String(to || '') }],
          Subject: payload.subject,
          HTML: payload.html,
          Text: payload.text
        })
      });
      if (!res.ok) return { ok: false, provider, error: `mailpit ${res.status}` };
      const body = await res.json().catch(() => ({}));
      return { ok: true, provider, messageId: body.ID || null };
    }

    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          from: payload.from,
          to: [String(to || '')],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {})
        })
      });
      if (!res.ok) return { ok: false, provider, error: `resend ${res.status}` };
      const body = await res.json().catch(() => ({}));
      return { ok: true, provider, messageId: body.id || null };
    }

    if (provider === 'mailchannels') {
      const personalization = { to: [{ email: String(to || '') }] };
      if (cfg.replyTo) personalization.reply_to = { email: cfg.replyTo, name: cfg.fromName };
      const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [personalization],
          from: { email: cfg.from, name: cfg.fromName },
          subject: payload.subject,
          content: [{ type: 'text/html', value: payload.html }]
        })
      });
      if (!res.ok) return { ok: false, provider, error: `mailchannels ${res.status}` };
      return { ok: true, provider, messageId: null };
    }

    return { ok: false, provider, error: `unsupported provider ${provider}` };
  } catch (e) {
    return { ok: false, provider, error: String(e?.message || e).slice(0, 200) };
  }
}

/** قالب رسالة إعادة تعيين كلمة المرور (Ar/En داخل رسالة واحدة). */
export function resetPasswordEmail({ to, resetLink, minutes }) {
  const subject = 'إعادة تعيين كلمة المرور — AL ZEINA / Password reset — AL ZEINA';
  const html = `<!doctype html><html dir="rtl" lang="ar"><body style="font-family:Arial,Helvetica,sans-serif;background:#faf7f5;padding:24px;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #eee;padding:32px">
  <h2 style="margin:0 0 12px;color:#111">إعادة تعيين كلمة المرور</h2>
  <p style="line-height:1.7;color:#444">تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في AL ZEINA. اضغطي الزر أدناه لتعيين كلمة مرور جديدة.</p>
  <p style="text-align:center;margin:28px 0"><a href="${resetLink}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold">تعيين كلمة مرور جديدة</a></p>
  <p style="line-height:1.7;color:#666;font-size:13px">الرابط صالح لمدة ${minutes} دقيقة ويُستخدم مرة واحدة فقط. إن لم تطلبي إعادة التعيين فتجاهلي هذه الرسالة — كلمة مرورك لن تتغير.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p dir="ltr" style="text-align:left;line-height:1.7;color:#444">We received a request to reset your AL ZEINA password. Click the button above to set a new password. The link is valid for ${minutes} minutes and can be used only once. If you did not request this, ignore this email.</p>
</div></body></html>`;
  const text = `إعادة تعيين كلمة المرور — AL ZEINA\n\nاضغطي الرابط لتعيين كلمة مرور جديدة (صالح ${minutes} دقيقة، مرة واحدة):\n${resetLink}\n\nإن لم تطلبي ذلك تجاهلي الرسالة.\n\nPassword reset — AL ZEINA\n${resetLink}`;
  return { to, subject, html, text };
}
