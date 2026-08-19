import { Hono } from 'hono';
import { signJwt, hashPassword, verifyPassword, randomToken, sha256Hex, needsRehash } from '../lib/crypto.js';
import { first, run, all, hydrate } from '../lib/db.js';
import { created, fail, nowIso, parseJson, stringify, uuid } from '../lib/response.js';
import { protect, sanitize } from '../middleware/auth.js';
import { sendEmail, resetPasswordEmail } from '../services/email.js';

const app = new Hono();
const TTL = { short: 86400, long: 30*86400 };
const isProd = (c) => (c.env.ENVIRONMENT || 'development') === 'production';
function jwtSecret(c) {
  const secret = c.env.JWT_SECRET;
  if (isProd(c) && (!secret || secret.length < 16)) throw new Error('JWT_SECRET is not configured');
  return secret || 'dev-secret-change-me';
}

function publicUser(u) { return sanitize({ ...u }); }

async function audit(c, action, success, user, message) {
  await run(c.env.DB.prepare(`INSERT INTO audit_logs(id,userId,userName,userEmail,userRole,action,entity,success,status,message,ip,userAgent,path,method,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uuid(), user?.id || null, user?.name || '', user?.email || '', user?.role || '', action, 'auth', success ? 1 : 0, success ? 200 : 401, message || '', c.req.header('cf-connecting-ip') || '', c.req.header('user-agent') || '', c.req.path, c.req.method, nowIso()));
}

/**
 * سياسة كلمة المرور الموحّدة (مطابقة لواجهة المستخدم):
 * 8 أحرف على الأقل، تشمل حروفاً وأرقاماً، وبحد أقصى 128 (حماية من إدخالات ضخمة لـPBKDF2).
 * ترجع رسالة الخطأ أو null إن كانت صالحة.
 */
function validatePasswordPolicy(password) {
  const p = String(password || '');
  if (p.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
  if (p.length > 128) return 'كلمة المرور طويلة جداً (الحد الأقصى 128 حرفاً).';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'كلمة المرور يجب أن تشمل حروفاً وأرقاماً معاً.';
  return null;
}

/* حماية معدل طلبات استعادة كلمة المرور لكل IP (في الذاكرة — لكل عازل Worker).
   الحماية الأساسية في الإنتاج تتم عبر قواعد Rate Limiting في لوحة Cloudflare. */
const forgotAttempts = new Map();

async function login(c, staffOnly = false) {
  const { email, password, remember } = await c.req.json().catch(() => ({}));
  const normalized = String(email||'').trim().toLowerCase();
  const invalid = { status:'error', message:'البريد الإلكتروني أو كلمة المرور غير صحيحة', messageEn:'Invalid email or password' };
  const user = await first(c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalized));
  if (!user) return c.json(invalid, 401);
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return c.json({ status:'error', message:`تم قفل الحساب مؤقتاً. حاولي بعد ${Math.ceil((new Date(user.lockedUntil)-new Date())/60000)} دقيقة.` }, 429);
  if (!user.isActive) return c.json({ status:'error', message:'هذا الحساب معطّل.', messageEn:'This account is disabled.' }, 403);
  if (!user.passwordHash) return c.json({ status:'error', message:'هذا الحساب مسجّل عبر حساب اجتماعي.' }, 401);
  const match = await verifyPassword(password, user.passwordHash);
  if (!match) {
    const attempts = (user.failedLoginAttempts || 0)+1;
    const max = Number(c.env.LOGIN_MAX_ATTEMPTS || 8), mins = Number(c.env.LOGIN_LOCK_MINUTES || 15);
    const locked = attempts >= max ? new Date(Date.now()+mins*60000).toISOString() : user.lockedUntil;
    await run(c.env.DB.prepare('UPDATE users SET failedLoginAttempts=?, lockedUntil=? WHERE id=?').bind(attempts >= max ? 0 : attempts, locked, user.id));
    await audit(c,'login-failed',false,user,'failed'); return c.json(invalid,401);
  }
  if (staffOnly && !['admin','moderator'].includes(user.role)) return c.json(invalid,403);
  const now = nowIso();
  /* Rehash-on-success: upgrade a verifiable hash that is not at the current
     PBKDF2 iteration count. Runs only after verifyPassword() succeeded, so an
     unverifiable legacy hash (iterations above the Workers cap) is never
     touched here. Best-effort: a re-hash failure must not fail the login. */
  if (needsRehash(user.passwordHash)) {
    try {
      await run(c.env.DB.prepare('UPDATE users SET passwordHash=?, updatedAt=? WHERE id=?').bind(await hashPassword(password), now, user.id));
    } catch { /* ignore — never block a successful login on a rehash error */ }
  }
  await run(c.env.DB.prepare('UPDATE users SET failedLoginAttempts=0, lockedUntil=NULL, lastLogin=?, lastActivityAt=?, sessionsValidFrom=? WHERE id=?').bind(now, now, user.sessionsValidFrom || now, user.id));
  const fresh = { ...user, lastLogin: now, lastActivityAt: now, failedLoginAttempts:0, lockedUntil:null };
  const sv = Math.floor(new Date(user.sessionsValidFrom || now).getTime()/1000);
  const token = await signJwt({ id:user.id, role:user.role, sv }, jwtSecret(c), remember ? TTL.long : TTL.short);
  await audit(c,'login',true,fresh,staffOnly?'admin':'store');
  return c.json({ status:'success', message:'تم تسجيل الدخول بنجاح', data:{ user:publicUser(fresh), token } });
}

app.post('/register', async c => {
  const body = await c.req.json().catch(()=>({}));
  const email = String(body.email||'').trim().toLowerCase();
  if (!body.name || !email || !body.password) return fail(c,'بيانات التسجيل غير مكتملة',400);
  /* سياسة كلمة المرور الموحّدة — كانت الواجهة ترفض الضعيفة والخادم يقبلها: الآن متطابقان */
  const policy = validatePasswordPolicy(body.password);
  if (policy) return fail(c, policy, 400);
  const exists = await first(c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email));
  if (exists) return c.json({ status:'error', message:'هذا البريد الإلكتروني مسجّل بالفعل.', messageEn:'This email is already registered.', field:'email' },409);
  const id = uuid(), now = nowIso(), name = String(body.name).trim();
  const parts = name.split(/\s+/);
  const hash = await hashPassword(body.password);
  await run(c.env.DB.prepare(`INSERT INTO users(id,name,firstName,lastName,email,passwordHash,phone,role,staffRole,isActive,authProvider,sessionsValidFrom,lastActivityAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,name,parts.shift()||'',parts.join(' '),email,hash,body.phone||'','user','',1,'local',now,now,now,now));
  const user = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id));
  const token = await signJwt({id,role:'user',sv:Math.floor(new Date(now).getTime()/1000)},jwtSecret(c),TTL.short);
  await audit(c,'register',true,user,'customer');
  return created(c,{user:publicUser(user),token},'تم إنشاء حسابك بنجاح');
});
app.post('/login', c => login(c,false));
app.post('/admin/login', c => login(c,true));
app.post('/logout', protect, async c => { const u=c.get('user'); const now=new Date(Date.now()+1000).toISOString(); await run(c.env.DB.prepare('UPDATE users SET sessionsValidFrom=? WHERE id=?').bind(now,u.id)); return c.json({ status:'success', message:'تم تسجيل الخروج' }); });
app.get('/me', protect, async c => {
  const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id));
  const addresses = await all(c.env.DB.prepare('SELECT * FROM addresses WHERE userId=? ORDER BY isDefault DESC, createdAt DESC').bind(u.id));
  const wish = await all(c.env.DB.prepare('SELECT p.* FROM wishlist w JOIN products p ON p.id=w.productId WHERE w.userId=?').bind(u.id));
  u.addresses = addresses; u.wishlist = wish;
  return c.json({ status:'success', data:{ user:publicUser(u) } });
});
app.put('/me', protect, async c => {
  const body = await c.req.json(); const u = c.get('user'); const name=String(body.name||u.name).trim(); const parts=name.split(/\s+/); const firstName=parts.shift()||u.firstName; const lastName=parts.join(' ')||u.lastName;
  await run(c.env.DB.prepare('UPDATE users SET name=?,firstName=?,lastName=?,phone=?,gender=?,avatar=?,updatedAt=? WHERE id=?').bind(name,firstName,lastName,body.phone??u.phone,body.gender??u.gender,body.avatar??u.avatar,nowIso(),u.id));
  const fresh = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id)); return c.json({status:'success',data:{user:publicUser(fresh)}});
});
app.put('/change-password', protect, async c => {
  const { currentPassword, newPassword } = await c.req.json(); const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id));
  if (!await verifyPassword(currentPassword,u.passwordHash)) return fail(c,'كلمة المرور الحالية غير صحيحة',400);
  const policy = validatePasswordPolicy(newPassword);
  if (policy) return fail(c, policy, 400);
  const hash = await hashPassword(newPassword); const validFrom=new Date(Date.now()+1000).toISOString();
  await run(c.env.DB.prepare('UPDATE users SET passwordHash=?, sessionsValidFrom=?, updatedAt=? WHERE id=?').bind(hash,validFrom,nowIso(),u.id));
  return c.json({status:'success',message:'تم تغيير كلمة المرور'});
});
app.post('/forgot-password', async c => {
  const email = String((await c.req.json().catch(() => ({}))).email || '').trim().toLowerCase();
  const GENERIC = 'إذا كان البريد مسجلاً فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.';
  if (!email) return c.json({ status: 'success', message: GENERIC });

  /* ---------- حماية من الإغراق: حد أقصى للطلبات لكل IP (نافذة منزلقة) ---------- */
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local';
  const rateMax = Number(c.env.FORGOT_RATE_MAX || 5);
  const rateWindowMs = Number(c.env.FORGOT_RATE_WINDOW_MINUTES || 15) * 60 * 1000;
  const nowMs = Date.now();
  const entry = forgotAttempts.get(ip);
  if (entry && nowMs < entry.resetAt) {
    if (entry.count >= rateMax) {
      return c.json({ status: 'error', message: 'عدد كبير من الطلبات. يرجى المحاولة لاحقاً.', messageEn: 'Too many requests. Please try again later.' }, 429);
    }
    entry.count += 1;
  } else {
    forgotAttempts.set(ip, { count: 1, resetAt: nowMs + rateWindowMs });
  }
  // تنظيف خفيف للخريطة حتى لا تكبر بلا حدود
  if (forgotAttempts.size > 500) {
    for (const [k, v] of forgotAttempts) if (nowMs >= v.resetAt) forgotAttempts.delete(k);
  }

  const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email));
  if (u) {
    const ttlMinutes = Math.min(1440, Math.max(5, Number(c.env.RESET_TOKEN_TTL_MINUTES || 60)));
    const hasActiveToken = u.resetPasswordToken && u.resetPasswordExpires && new Date(u.resetPasswordExpires).getTime() > Date.now();
    if (!hasActiveToken) {
      /* أساس رابط إعادة التعيين — إلزامي من الإعدادات في الإنتاج:
         لا يجوز أبداً أن يصل للمستخدم رابط localhost من بيئة Production. */
      const isProdEnv = String(c.env.ENVIRONMENT || 'development') === 'production';
      let base = String(c.env.RESET_LINK_BASE_URL || c.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
      if (!base && !isProdEnv) base = 'http://localhost:3000'; // تطوير محلي فقط
      if (!base) {
        await audit(c, 'forgot-password-requested', true, u, 'email-failed:reset-link-base-url-missing');
        console.error('[auth] RESET_LINK_BASE_URL is not configured — password reset email was NOT sent (production requires an explicit base URL).');
      } else {
        /* التوكن الخام لا يُخزَّن أبداً — يُخزَّن SHA-256 فقط، والرابط في البريد يحمل التوكن الخام */
        const token = randomToken(24);
        const tokenHash = await sha256Hex(token);
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
        await run(c.env.DB.prepare('UPDATE users SET resetPasswordToken=?, resetPasswordExpires=?, updatedAt=? WHERE id=?')
          .bind(tokenHash, expiresAt, nowIso(), u.id));

        const resetLink = `${base}/reset-password?token=${encodeURIComponent(token)}`;
        const mail = resetPasswordEmail({ to: u.email, resetLink, minutes: ttlMinutes });
        const sent = await sendEmail(c.env, mail);
        await audit(c, 'forgot-password-requested', true, u, sent.ok ? `sent:${sent.provider}` : `email-failed:${sent.provider}:${sent.error || ''}`);
        if (!sent.ok) console.error('[auth] reset email failed:', sent.provider, sent.error);
      }
    } else {
      /* يوجد توكن نشط — لا نرسل رسالة جديدة (منع الإغراق)، نفس الاستجابة العامة تماماً */
      await audit(c, 'forgot-password-cooldown', true, u, 'active token exists');
    }
  }
  // استجابة موحّدة سواء وُجد البريد أم لا — لا Email Enumeration
  return c.json({ status: 'success', message: GENERIC });
});

app.get('/password-reset-requirements', c => c.json({
  status: 'success',
  data: { minLength: 8, maxLength: 128, requiresLetter: true, requiresNumber: true, requiresSymbol: false }
}));

app.post('/reset-password', async c => {
  const body = await c.req.json().catch(() => ({}));
  const token = body.token;
  /* توافق عقد الـAPI: الواجهة ترسل newPassword، وأدوات الاختبار القديمة كانت ترسل password */
  const password = body.newPassword || body.password;
  const INVALID = 'رمز إعادة التعيين غير صالح أو منتهي. اطلبي رابطاً جديداً من صفحة استعادة كلمة المرور.';
  if (!String(token || '').trim()) { await audit(c, 'password-reset-failed', false, null, 'missing token'); return fail(c, INVALID, 400); }

  /* سياسة كلمة المرور الموحّدة — نفس سياسة التسجيل */
  const policy = validatePasswordPolicy(password);
  if (policy) return fail(c, policy, 400);

  const tokenHash = await sha256Hex(String(token).trim());
  const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE resetPasswordToken = ?').bind(tokenHash));
  const valid = u && u.resetPasswordExpires && new Date(u.resetPasswordExpires).getTime() > Date.now();
  if (!valid) {
    await audit(c, 'password-reset-failed', false, null, 'invalid or expired token');
    return fail(c, INVALID, 400);
  }

  const hash = await hashPassword(password);
  const validFrom = new Date(Date.now() + 1000).toISOString();
  /* إبطال فوري للتوكن (استخدام لمرة واحدة) + إبطال كل الجلسات القديمة + فك أي قفل */
  await run(c.env.DB.prepare('UPDATE users SET passwordHash=?, resetPasswordToken=NULL, resetPasswordExpires=NULL, sessionsValidFrom=?, failedLoginAttempts=0, lockedUntil=NULL, updatedAt=? WHERE id=?')
    .bind(hash, validFrom, nowIso(), u.id));
  await audit(c, 'password-reset-success', true, u, 'password reset via emailed link');
  return c.json({ status: 'success', message: 'تم إعادة تعيين كلمة المرور بنجاح. سجّلي الدخول بكلمة المرور الجديدة.' });
});
app.get('/providers', c => c.json({status:'success',data:{google:Boolean(c.env.GOOGLE_CLIENT_ID),facebook:Boolean(c.env.FACEBOOK_APP_ID)}}));

export default app;
