import { verifyJwt } from '../lib/crypto.js';
import { first } from '../lib/db.js';
import { resolveStaffRole } from './permissions.js';

const isProd = (env) => (env.ENVIRONMENT || 'development') === 'production';
const getJwtSecret = (c) => {
  const secret = c.env.JWT_SECRET;
  if (isProd(c.env) && (!secret || secret.length < 16)) throw new Error('JWT_SECRET is not configured');
  return secret || 'dev-secret-change-me';
};

const sanitize = (u) => {
  if (!u) return u;
  delete u.passwordHash; delete u.resetPasswordToken; delete u.resetPasswordExpires; delete u.sessionsValidFrom; delete u.failedLoginAttempts; delete u.lockedUntil;
  u._id = u.id;
  return u;
};

export async function loadUser(c, next) {
  let token;
  const auth = c.req.header('authorization') || c.req.header('Authorization');
  if (auth?.startsWith('Bearer')) token = auth.split(' ')[1];
  if (!token) token = c.req.query('token');
  if (token) {
    const payload = await verifyJwt(token, getJwtSecret(c));
    if (payload) {
      const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.id));
      if (u && u.isActive) {
        const validFrom = Math.floor(new Date(u.sessionsValidFrom || 0).getTime()/1000);
        if (payload.sv === undefined || payload.sv >= validFrom) c.set('user', sanitize(u));
      }
    }
  }
  await next();
}

export const protect = async (c, next) => {
  if (!c.get('user')) return c.json({ status:'error', message:'غير مصرح به. يرجى تسجيل الدخول.' }, 401);
  await next();
};
export const optionalAuth = loadUser;
export const admin = async (c, next) => {
  if (c.get('user')?.role !== 'admin') return c.json({ status:'error', message:'غير مصرح به. صلاحيات المدير مطلوبة.' }, 403);
  await next();
};
export const adminOrModerator = async (c, next) => {
  if (!['admin','moderator'].includes(c.get('user')?.role)) return c.json({ status:'error', message:'غير مصرح به. صلاحيات المدير أو المشرف مطلوبة.' }, 403);
  await next();
};
export const staffOnly = async (c, next) => { await protect(c, async () => { if (!['admin','moderator'].includes(c.get('user')?.role)) return c.json({ status:'error', message:'البريد الإلكتروني أو كلمة المرور غير صحيحة', messageEn:'Invalid email or password' }, 403); await next(); }); };

export { sanitize, resolveStaffRole };
