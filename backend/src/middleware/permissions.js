import { getSettings } from '../services/settings.js';

export const PERMISSION_KEYS = ['dashboard','products','categories','brands','orders','customers','coupons','banners','media','reviews','returns','support','messages','statistics','payments','shipping','pages','templates','settings','audit','inventory','backup'];
const all = Object.fromEntries(PERMISSION_KEYS.map(k => [k,'full']));
export const DEFAULT_PERMISSIONS = {
  'super-admin': { ...all },
  admin: { ...all, backup:'read' },
  manager: { dashboard:'read', products:'full', categories:'full', brands:'full', orders:'full', customers:'read', coupons:'full', banners:'full', media:'full', reviews:'full', returns:'full', support:'full', messages:'full', statistics:'read', payments:'read', shipping:'full', pages:'read', templates:'none', settings:'none', audit:'read', inventory:'full', backup:'none' },
  editor: { dashboard:'read', products:'full', categories:'full', brands:'full', orders:'none', customers:'none', coupons:'read', banners:'full', media:'full', reviews:'read', returns:'none', support:'none', messages:'none', statistics:'none', payments:'none', shipping:'none', pages:'full', templates:'read', settings:'none', audit:'none', inventory:'read', backup:'none' },
  support: { dashboard:'read', products:'read', categories:'read', brands:'read', orders:'full', customers:'full', coupons:'read', banners:'none', media:'read', reviews:'full', returns:'full', support:'full', messages:'full', statistics:'none', payments:'read', shipping:'read', pages:'none', templates:'none', settings:'none', audit:'none', inventory:'read', backup:'none' }
};
export const ROLE_DEFS = { 'super-admin':{dbRole:'admin',name:'مدير أعلى',nameEn:'Super Admin',locked:true}, admin:{dbRole:'admin',name:'مدير',nameEn:'Admin'}, manager:{dbRole:'moderator',name:'مدير تشغيل',nameEn:'Manager'}, editor:{dbRole:'moderator',name:'محرر',nameEn:'Editor'}, support:{dbRole:'moderator',name:'دعم فني',nameEn:'Support'} };
export const SEGMENT_TO_RESOURCE = { products:'products',categories:'categories',brands:'brands',orders:'orders',users:'customers',customers:'customers',staff:'settings',coupons:'coupons',banners:'banners',media:'media',reviews:'reviews',returns:'returns',support:'support',tickets:'support',messages:'messages',subscribers:'messages',statistics:'statistics',analytics:'statistics',dashboard:'dashboard',payments:'payments','payment-methods':'payments','payment-verifications':'payments',shipping:'shipping','shipping-zones':'shipping','shipping-companies':'shipping',governorates:'shipping',pages:'pages','home-sections':'pages',popups:'pages','flash-sales':'pages',testimonials:'pages','instagram-posts':'pages',templates:'templates','email-templates':'templates',settings:'settings',permissions:'settings','theme-presets':'settings','audit-logs':'audit',inventory:'inventory',backup:'backup',notifications:'dashboard',search:'dashboard',files:'media','branding':'settings','locale':'settings','flags':'settings','plugins':'settings','system':'settings' };

export const resolveStaffRole = (user) => {
  if (!user) return null;
  const superEmail = (process?.env?.ADMIN_EMAIL || 'admin@alzeina.com').toLowerCase();
  if (String(user.email||'').toLowerCase() === superEmail) return 'super-admin';
  if (user.staffRole && ROLE_DEFS[user.staffRole]) return user.staffRole;
  return user.role === 'admin' ? 'admin' : 'manager';
};
export async function permissionsFor(env, staffRole) {
  const base = DEFAULT_PERMISSIONS[staffRole] || DEFAULT_PERMISSIONS.support;
  if (staffRole === 'super-admin') return base;
  try { const s = await getSettings(env); return { ...base, ...(s.permissions?.[staffRole] || {}) }; } catch { return base; }
}
const resourceFromPath = (path) => (String(path).split('?')[0].split('/').filter(Boolean).find(x => SEGMENT_TO_RESOURCE[x]) && SEGMENT_TO_RESOURCE[String(path).split('?')[0].split('/').filter(Boolean).find(x => SEGMENT_TO_RESOURCE[x])]) || null;
const write = m => ['POST','PUT','PATCH','DELETE'].includes(m);
const ALLOWED = ['/account/credentials','/notifications','/search'];

export async function enforcePermissions(c, next) {
  const user = c.get('user');
  if (!user) return next();
  const role = resolveStaffRole(user);
  if (role === 'super-admin') return next();
  const path = c.req.path.replace(/^\/api\/v1\/admin/, '');
  if (ALLOWED.some(p => path.startsWith(p))) return next();
  const resource = resourceFromPath(path);
  if (!resource) return next();
  const perms = await permissionsFor(c.env, role);
  const level = perms[resource] || 'none';
  if (level === 'none') return c.json({ status:'error', message:'ليست لديك صلاحية الوصول لهذا القسم.', data:{resource,role} }, 403);
  if (write(c.req.method) && level !== 'full') return c.json({ status:'error', message:'صلاحيتك على هذا القسم للقراءة فقط.', data:{resource,role,level} }, 403);
  return next();
}
