import { parseJson } from './response.js';

const BOOLEAN_FIELDS = new Set(['isActive','isFeatured','isBestSeller','isNewArrival','freeShipping','requiresProof','requiresReference','isRead','resolved','revoked','trackInventory','showSocial','showCountdown','allowAdminBypass','codEnabled','enabled','showPoweredBy','guestTickets','customerDownload','refundShipping','autoApprove','autoRestock','excludeDiscounted']);

export const hydrate = (row) => {
  if (!row) return row;
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && k.endsWith('Json')) { out[k] = parseJson(v, v); }
    if (BOOLEAN_FIELDS.has(k)) out[k] = Boolean(v);
  }
  if (out._id === undefined && out.id) out._id = out.id;
  for (const key of Object.keys(out)) { if (key === '_id') continue; if (out[key] !== null && !['id','_id','createdAt','updatedAt','userId','productId','orderId'].includes(key) && typeof out[key] === 'number' && /^(?:is|has|can|cod|requires|free|allow|show|enable|track|showSocial|allowAdmin|guest|auto|enabled|active|visible|published|isRead|resolved|revoked)$/i.test(key)) out[key]=Boolean(out[key]); }
  return out;
};

export const all = async (stmt) => (await stmt.all()).results.map(hydrate);
export const first = async (stmt) => hydrate(await stmt.first());
export const run = async (stmt) => { const r = await stmt.run(); return r; };

export const buildWhere = (allowed, query = {}) => {
  const clauses = [];
  const params = {};
  for (const [key, def] of Object.entries(allowed)) {
    if (query[key] === undefined || query[key] === '') continue;
    const col = def.col || key;
    let val = query[key];
    if (def.type === 'bool') val = val === true || val === 'true' || val === '1' ? 1 : 0;
    if (def.type === 'like') { clauses.push(`${col} LIKE @${key}`); params[key] = `%${val}%`; }
    else if (def.type === 'in') { clauses.push(`${col} IN (${val.map((_,i)=>`@${key}${i}`).join(',')})`); val.forEach((x,i)=>params[`${key}${i}`]=x); }
    else if (def.type === 'min') { clauses.push(`${col} >= @${key}`); params[key] = val; }
    else if (def.type === 'max') { clauses.push(`${col} <= @${key}`); params[key] = val; }
    else { clauses.push(`${col} = @${key}`); params[key] = val; }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

export const paginateQuery = (query, defaultLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};
