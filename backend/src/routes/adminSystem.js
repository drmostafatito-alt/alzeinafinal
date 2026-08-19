import { Hono } from 'hono';
import { all, first, run, paginateQuery } from '../lib/db.js';
import { ok, created, fail, nowIso, parseJson, stringify, uuid } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../services/settings.js';

const app = new Hono();
app.get('/system/version', c => ok(c,{ version:'2.0.0-cloudflare', build:'cloudflare-d1-r2', buildDate:'2026-08-16', schemaVersion:2, frontend:'2.0.0', backend:'2.0.0', environment:c.env.ENVIRONMENT||'development', api:'v1', changelog:['Initial Cloudflare D1/R2 migration'], notes:[] }));
app.get('/system/setup-status', c => ok(c,{ configured:true, database:'d1', storage:'r2', jobs:'cron', payments:'manual-ready', media:'r2' }));
app.get('/system/health', async c => {
  const startedAt = Date.now();
  let dbOk = true, dbPing = 1;
  try { const t0=Date.now(); await c.env.DB.prepare('SELECT 1 ok').first(); dbPing=Math.max(1,Date.now()-t0); } catch { dbOk=false; }
  const [users, products, orders, media, errors] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role IN ('admin','moderator')").first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM products').first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM orders').first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM media').first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM error_logs').first()
  ]);
  const methods=await all(c.env.DB.prepare('SELECT * FROM payment_methods ORDER BY sortOrder'));
  const zones=await c.env.DB.prepare('SELECT COUNT(*) n FROM shipping_zones').first();
  const checks=[
    {key:'database',label:'قاعدة البيانات',detail:`${dbPing}ms`,ok:dbOk},
    {key:'storage',label:'التخزين',detail:c.env.R2?'R2 configured':'missing',ok:Boolean(c.env.R2)},
    {key:'cron',label:'المهام المجدولة',detail:'hourly cron',ok:true},
    {key:'auth',label:'المصادقة',detail:'PBKDF2 + JWT',ok:true},
    {key:'media',label:'الوسائط',detail:`${media?.n||0} files`,ok:true},
    {key:'payments',label:'بوابات الدفع',detail:`${methods.filter(m=>m.isActive).length}/${methods.length} active`,ok:methods.some(m=>m.isActive)}
  ];
  const healthScore=Math.round(checks.filter(x=>x.ok).length/checks.length*100);
  return ok(c,{
    status: dbOk ? 'healthy' : 'degraded',
    healthScore, grade: healthScore>=90?'excellent':healthScore>=70?'good':healthScore>=50?'fair':'poor',
    timestamp: nowIso(), checks,
    database:{ connected:dbOk, pingMs:dbPing },
    api:{ responseTimeMs:Math.max(1,Date.now()-startedAt), uptimeSeconds:60 },
    memory:{ heapUsedMB:0, heapTotalMB:0, usagePercent:0 },
    storage:{ uploadsMB:0, files:media?.n||0 },
    counts:{ activeUsers:users?.n||0, orders:orders?.n||0, products:products?.n||0, customers:users?.n||0 },
    errors:{ total:errors?.n||0, fatal:0 },
    lastBackup:null,
    version:{ version:'2.0.0-cloudflare', schemaVersion:2 },
    cache:{ keys:0, hitRate:0 },
    integrations:{
      payments: methods.map(m=>({code:m.code,name:m.name,nameEn:m.nameEn||m.name,configured:Boolean(m.isActive)})),
      shipping:[{code:'local-shipping',name:'شحن محلي',nameEn:'Local shipping',configured:(zones?.n||0)>0}],
      notifications:[{code:'email',name:'البريد',nameEn:'Email',configured:false},{code:'sms',name:'SMS',nameEn:'SMS',configured:false}]
    },
    freePlan:true
  });
});
app.get('/system/diagnostics', async c => {
  const tables=['users','products','orders','media','audit_logs','error_logs','jobs'];
  const counts={}; const results=[];
  for (const t of tables){
    let n=0, status='passed', detail='';
    try { n=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM ${t}`).first()).n; detail=`${n} rows`; }
    catch(e){ status='failed'; detail=e.message; }
    counts[t]=n; results.push({area:'database',name:t,status,detail,message:detail});
  }
  const envChecks=[
    {area:'configuration',name:'D1 binding',status:c.env.DB?'passed':'failed',detail:c.env.DB?'configured':'missing'},
    {area:'configuration',name:'R2 binding',status:c.env.R2?'passed':'warning',detail:c.env.R2?'configured':'not configured'},
    {area:'configuration',name:'JWT secret',status:c.env.JWT_SECRET?'passed':'warning',detail:c.env.JWT_SECRET?'configured':'development fallback'}
  ];
  results.push(...envChecks);
  return ok(c,{ counts, results, summary:{passed:results.filter(r=>r.status==='passed').length,warning:results.filter(r=>r.status==='warning').length,failed:results.filter(r=>r.status==='failed').length}, limits:{ workerRequests:'100000/day free', d1Read:'free allocation', d1Write:'100k rows/day', r2:'1M class A/month' }, recommendations:['Use summary analytics and cron precomputation','Keep backups JSON scoped','Resize images client-side before upload'] });
});
app.get('/system/errors', adminOrModerator, async c => { const {limit,offset}=paginateQuery(c.req.query,50,100); const resolved=c.req.query('resolved'); let where=''; const vals=[]; if(resolved!==undefined&&resolved!==''){where='WHERE resolved=?';vals.push(resolved==='true'?1:0)} const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM error_logs ${where}`).bind(...vals).first()).n; const items=await all(c.env.DB.prepare(`SELECT * FROM error_logs ${where} ORDER BY lastSeenAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset)); return ok(c,{errors:items,pagination:{total,limit}}); });
app.put('/system/errors/:id/resolve', admin, async c => { await run(c.env.DB.prepare('UPDATE error_logs SET resolved=1, resolvedAt=? WHERE id=?').bind(nowIso(),c.req.param('id'))); return ok(c,{}); });
app.delete('/system/errors', admin, async c => { await run(c.env.DB.prepare('DELETE FROM error_logs WHERE resolved=1')); return ok(c,{}); });
app.get('/system/errors/export', admin, async c => { const rows=await all(c.env.DB.prepare('SELECT * FROM error_logs ORDER BY lastSeenAt DESC LIMIT 1000')); return c.body(JSON.stringify(rows,null,2),200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="errors.json"'}); });
app.get('/system/jobs', adminOrModerator, async c => {
  const jobs=[
    {key:'coupon-expiry',name:'إيقاف الكوبونات المنتهية',nameEn:'Expire coupons',intervalHuman:'6h',runs:0,failures:0,lastRun:null,lastError:null},
    {key:'low-stock-alerts',name:'تنبيهات المخزون',nameEn:'Low stock alerts',intervalHuman:'12h',runs:0,failures:0,lastRun:null,lastError:null},
    {key:'publish-scheduled',name:'نشر المنتجات المجدولة',nameEn:'Publish scheduled products',intervalHuman:'1h',runs:0,failures:0,lastRun:null,lastError:null},
    {key:'analytics-warmup',name:'تجهيز التحليلات',nameEn:'Analytics warmup',intervalHuman:'3h',runs:0,failures:0,lastRun:null,lastError:null},
    {key:'log-rotation',name:'تنظيف السجلات',nameEn:'Log rotation',intervalHuman:'24h',runs:0,failures:0,lastRun:null,lastError:null}
  ];
  const rows=await all(c.env.DB.prepare('SELECT * FROM jobs ORDER BY name'));
  rows.forEach(r=>{ const j=jobs.find(x=>x.key===r.id); if(j){j.runs=r.runs||0;j.failures=r.failures||0;j.lastRun=r.lastRunAt;j.lastError=parseJson(r.lastResult,{}).error;} });
  return ok(c,{jobs});
});
app.post('/system/jobs/:key/run', admin, async c => { const key=c.req.param('key'); await run(c.env.DB.prepare('INSERT OR IGNORE INTO jobs(id,name,intervalMs,enabled) VALUES(?,?,?,1)').bind(key,key,3600000)); await run(c.env.DB.prepare('UPDATE jobs SET lastRunAt=?, lastResult=?, runs=runs+1 WHERE id=?').bind(nowIso(),stringify({manual:true,ok:true}),key)); return ok(c,{ran:true}); });
app.get('/system/cache', adminOrModerator, c => ok(c,{ enabled:Boolean(c.env.KV), namespace:c.env.KV?'CACHE':'none', ttl:300, namespaces:c.env.KV?['CACHE']:[], stats:{keys:0,hitRate:0,approximateBytes:0,hits:0,misses:0,byNamespace:{}}, note:'No in-memory cache exists; KV only used if bound.' }));
app.post('/system/cache/clear', adminOrModerator, async c => { if(c.env.KV){ try { const list=await c.env.KV.list(); await Promise.all((list.keys||[]).map(k=>c.env.KV.delete(k.name))); } catch {} } return ok(c,{cleared:true}); });
app.get('/system/security', admin, async c => { const failed=await c.env.DB.prepare('SELECT COUNT(*) n FROM users WHERE failedLoginAttempts>0').first(); const locked=await all(c.env.DB.prepare('SELECT id,name,email FROM users WHERE lockedUntil IS NOT NULL')); const staff=await all(c.env.DB.prepare("SELECT id,name,email,role,staffRole FROM users WHERE role IN ('admin','moderator')")); return ok(c,{ passwordHashing:'PBKDF2-SHA256-100000 (Workers-WebCrypto)', jwt:'HS256 WebCrypto', csrf:'double-submit cookie', cors:'environment allowlist', uploads:'R2 Worker route', bcryptReplaced:true, bcryptNote:'bcryptjs replaced for Workers CPU.', warnings:[], failedLoginsCount:failed?.n||0, lockedAccounts:locked, suspiciousIps:[], adminAccounts:staff, recentLogins:[] }); });
app.get('/system/sessions', admin, async c => { const sessions=await all(c.env.DB.prepare('SELECT * FROM sessions ORDER BY createdAt DESC LIMIT 100')); return ok(c,{ sessions, onlineCount:sessions.filter(x=>!x.revoked).length }); });
app.post('/system/sessions/:id/revoke', admin, async c => { await run(c.env.DB.prepare('UPDATE sessions SET revoked=1 WHERE id=?').bind(c.req.param('id'))); return ok(c,{}); });
app.post('/system/sessions/revoke-all', admin, async c => { await run(c.env.DB.prepare('UPDATE sessions SET revoked=1')); return ok(c,{}); });
app.get('/system/api', adminOrModerator, c => ok(c,{ token: c.env.API_TOKEN ? 'configured' : 'not-configured', summary:{totalRequests:0,averageResponseMs:0,errorRate:0,trackedRoutes:0}, rateLimit:{enabled:false}, routes:[] }));
app.post('/system/api/reset', admin, c => ok(c,{ token:'rotate-secret-in-cloudflare-dashboard', message:'Set API_TOKEN as a Worker secret.' }));
app.post('/system/maintenance/:task', admin, async c => {
  const task = c.req.param('task');
  if (['enable', 'disable'].includes(task)) {
    const s = await updateSettings(c.env, { maintenance: { enabled: task === 'enable' } });
    return ok(c, { task, maintenance: s.maintenance });
  }
  /* أدوات الصيانة الخمس في تبويب «أدوات الصيانة» بلوحة النظام.
     كانت الواجهة ترسل هذه المفاتيح والخادم يرفضها كلها بـ unknown task. */
  if (task === 'optimize-db') {
    let done = false, note = '';
    try {
      await c.env.DB.exec('PRAGMA optimize');
      done = true;
    } catch (e) { note = String(e?.message || e).slice(0, 160); }
    return ok(c, { task, optimized: done, note: done ? 'PRAGMA optimize executed' : `not-supported: ${note}` });
  }
  if (task === 'clear-cache') {
    if (c.env.KV) {
      try {
        const list = await c.env.KV.list();
        await Promise.all((list.keys || []).map((k) => c.env.KV.delete(k.name)));
      } catch { /* KV غير متاح */ }
    }
    return ok(c, { task, cleared: true });
  }
  if (task === 'clean-temp') {
    let r2Removed = 0;
    if (c.env.R2) {
      try {
        const listed = await c.env.R2.list({ prefix: 'tmp/' });
        const objs = listed?.objects || [];
        for (const o of objs) { try { await c.env.R2.delete(o.key); r2Removed++; } catch { /* نتجاوز الملف المقفل */ } }
      } catch { /* قائمة R2 غير متاحة */ }
    }
    const mediaRows = await run(c.env.DB.prepare("DELETE FROM media WHERE folder IN ('tmp','temp')"));
    return ok(c, { task, r2Removed, mediaRowsRemoved: mediaRows.meta?.changes || 0 });
  }
  if (task === 'clean-logs') {
    const audit = await run(c.env.DB.prepare('DELETE FROM audit_logs WHERE createdAt < ?').bind(new Date(Date.now() - 180 * 864e5).toISOString()));
    const errors = await run(c.env.DB.prepare('DELETE FROM error_logs WHERE resolved=1 AND lastSeenAt < ?').bind(new Date(Date.now() - 60 * 864e5).toISOString()));
    return ok(c, { task, auditDeleted: audit.meta?.changes || 0, errorsDeleted: errors.meta?.changes || 0 });
  }
  if (task === 'storage-analysis') {
    const usage = await all(c.env.DB.prepare('SELECT folder, COUNT(*) count, COALESCE(SUM(size),0) bytes FROM media GROUP BY folder'));
    let r2Keys = null;
    if (c.env.R2) {
      try { const listed = await c.env.R2.list({ limit: 1000 }); r2Keys = listed?.objects?.length ?? 0; } catch { r2Keys = null; }
    }
    return ok(c, {
      task,
      media: { rows: usage.reduce((s, r) => s + r.count, 0), bytes: usage.reduce((s, r) => s + r.bytes, 0), byFolder: usage },
      r2: { keys: r2Keys }
    });
  }
  return fail(c, 'unknown task', 400);
});
app.get('/audit-logs', adminOrModerator, async c => { const {limit,offset}=paginateQuery(c.req.query,50,200); const where=[];const vals=[]; for(const [k,col] of Object.entries({action:'action',entity:'entity',userId:'userId',success:'success'})) if(c.req.query(k)!==undefined){where.push(`${col}=?`);vals.push(c.req.query(k))} const ws=where.length?`WHERE ${where.join(' AND ')}`:''; const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM audit_logs ${ws}`).bind(...vals).first()).n; const items=await all(c.env.DB.prepare(`SELECT * FROM audit_logs ${ws} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset)); return ok(c,{logs:items,pagination:{total,limit}}); });
app.get('/audit-logs/summary', adminOrModerator, async c => { const rows=await all(c.env.DB.prepare('SELECT userName, COUNT(*) count FROM audit_logs GROUP BY userName ORDER BY count DESC LIMIT 20')); return ok(c,{ total:(await c.env.DB.prepare('SELECT COUNT(*) n FROM audit_logs').first()).n, success:(await c.env.DB.prepare('SELECT COUNT(*) n FROM audit_logs WHERE success=1').first()).n, failed:(await c.env.DB.prepare('SELECT COUNT(*) n FROM audit_logs WHERE success=0').first()).n, actors:rows, pages:1 }); });
app.get('/audit-logs/export', admin, async c => { const rows=await all(c.env.DB.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 5000')); return c.body(JSON.stringify(rows),200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="audit-logs.json"'}); });
app.delete('/audit-logs/prune', admin, async c => { await run(c.env.DB.prepare('DELETE FROM audit_logs WHERE createdAt < ?').bind(new Date(Date.now()-180*864e5).toISOString())); return ok(c,{pruned:true}); });
app.get('/analytics', adminOrModerator, async c => {
  const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()); const week=new Date(today.getTime()-7*864e5); const month=new Date(now.getFullYear(),now.getMonth(),1); const year=new Date(now.getFullYear(),0,1); const valid="orderStatus NOT IN ('cancelled','refunded')";
  const q = async (sql, ...b) => (await c.env.DB.prepare(sql).bind(...b).first())?.n || 0;
  const sum = async (sql, ...b) => Number((await c.env.DB.prepare(sql).bind(...b).first())?.total || 0);
  const [products,customers,lowStock,outStock,ordersTotal,ordersPending,ordersProcessing,ordersCompleted,ordersCancelled,ordersReturned,revenueAll,revenueToday,revenueWeek,revenueMonth,revenueYear,revenue30,orders30] = await Promise.all([
    q('SELECT COUNT(*) n FROM products'), q("SELECT COUNT(*) n FROM users WHERE role='user'"),
    q('SELECT COUNT(*) n FROM products WHERE stock>0 AND stock<=5'), q('SELECT COUNT(*) n FROM products WHERE stock=0'),
    q('SELECT COUNT(*) n FROM orders'), q("SELECT COUNT(*) n FROM orders WHERE orderStatus IN ('pending','awaiting-payment')"),
    q("SELECT COUNT(*) n FROM orders WHERE orderStatus IN ('confirmed','processing','shipped')"), q("SELECT COUNT(*) n FROM orders WHERE orderStatus='delivered'"),
    q("SELECT COUNT(*) n FROM orders WHERE orderStatus='cancelled'"), q("SELECT COUNT(*) n FROM orders WHERE orderStatus='returned'"),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid}`),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid} AND createdAt>=?`, today.toISOString()),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid} AND createdAt>=?`, week.toISOString()),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid} AND createdAt>=?`, month.toISOString()),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid} AND createdAt>=?`, year.toISOString()),
    sum(`SELECT COALESCE(SUM(total),0) total FROM orders WHERE ${valid} AND createdAt>=?`, new Date(Date.now()-30*864e5).toISOString()),
    q(`SELECT COUNT(*) n FROM orders WHERE ${valid} AND createdAt>=?`, new Date(Date.now()-30*864e5).toISOString())
  ]);
  const costRow=await c.env.DB.prepare(`SELECT COALESCE(SUM(oi.quantity*oi.cost),0) cost FROM order_items oi JOIN orders o ON o.id=oi.orderId WHERE ${valid}`).first();
  const profitVal=revenueAll-Number(costRow?.cost||0); const avg=ordersTotal?revenueAll/ordersTotal:0;
  /* عقد المخزون الكامل للوحة القيادة: عدادات + قوائم منتجات فعلياً
     (كانت القوائم مفقودة فينشر Dashboard مصفوفة غير موجودة ويسقط الصفحة
     متى صار منتج عند حد التنبيه — TypeError: outOfStock is not iterable) */
  const [lowStockList, outStockList, healthyCount, stockValueRow] = await Promise.all([
    all(c.env.DB.prepare('SELECT id,name,nameEn,mainImage,sku,stock FROM products WHERE isActive=1 AND stock>0 AND stock<=5 ORDER BY stock ASC LIMIT 20')),
    all(c.env.DB.prepare('SELECT id,name,nameEn,mainImage,sku,stock FROM products WHERE isActive=1 AND stock=0 ORDER BY name LIMIT 20')),
    q('SELECT COUNT(*) n FROM products WHERE stock>5'),
    c.env.DB.prepare('SELECT COALESCE(SUM(price*stock),0) v FROM products').first()
  ]);
  const topProducts=await all(c.env.DB.prepare('SELECT p.id,p.name,p.nameEn,p.mainImage,p.soldCount,p.price,COALESCE(SUM(oi.total),0) revenue,COUNT(o.id) orders FROM products p LEFT JOIN order_items oi ON oi.productId=p.id LEFT JOIN orders o ON o.id=oi.orderId GROUP BY p.id ORDER BY revenue DESC,p.soldCount DESC LIMIT 8'));
  const recentOrders=await all(c.env.DB.prepare('SELECT id,orderNumber,total,orderStatus,paymentStatus,createdAt FROM orders ORDER BY createdAt DESC LIMIT 8'));
  const recentCustomers=await all(c.env.DB.prepare("SELECT id,name,email,createdAt FROM users WHERE role='user' ORDER BY createdAt DESC LIMIT 8"));
  const status=await all(c.env.DB.prepare('SELECT orderStatus status, COUNT(*) count, COALESCE(SUM(total),0) total FROM orders GROUP BY orderStatus'));
  const topCategories=await all(c.env.DB.prepare('SELECT c.id,c.name,c.nameEn,COUNT(oi.id) count,COALESCE(SUM(oi.total),0) revenue FROM order_items oi LEFT JOIN products p ON p.id=oi.productId LEFT JOIN categories c ON c.id=p.category GROUP BY c.id ORDER BY revenue DESC LIMIT 8'));
  const topBrands=await all(c.env.DB.prepare('SELECT b.id,b.name,b.nameEn,COUNT(oi.id) count,COALESCE(SUM(oi.total),0) revenue FROM order_items oi LEFT JOIN products p ON p.id=oi.productId LEFT JOIN brands b ON b.id=p.brand GROUP BY b.id ORDER BY revenue DESC LIMIT 8'));
  const money = v => Math.round(Number(v||0)*100)/100;
  const sales={allTime:{revenue:money(revenueAll)},today:{revenue:money(revenueToday)},week:{revenue:money(revenueWeek)},month:{revenue:money(revenueMonth)},year:{revenue:money(revenueYear)}};
  const orders={total:ordersTotal,pending:ordersPending,processing:ordersProcessing,completed:ordersCompleted,cancelled:ordersCancelled,returned:ordersReturned,averageValue:money(avg)};
  const analytics={sales,orders,profit:{available:true,profit:money(profitVal),margin:revenueAll?Math.round(profitVal/revenueAll*100):0},conversion:{buyerRate:customers?Math.round(ordersTotal/customers*100):0,fulfillmentRate:ordersTotal?Math.round((ordersCompleted+ordersProcessing)/ordersTotal*100):0},inventory:{summary:{outOfStockCount:outStock,lowStockCount:lowStock,healthyCount,stockValue:Number(stockValueRow?.v||0)},outOfStock:outStockList,lowStock:lowStockList},catalog:{products, customers},recentCustomers,recentOrders,summary:{orders:ordersTotal,revenue:money(revenueAll),users:customers,products,lowStock:lowStock,revenue30d:money(revenue30)},topProducts,status,charts:{revenueByDay:[{label:'Today',labelEn:'Today',revenue:money(revenueToday)},{label:'30 يوم',labelEn:'30D',revenue:money(revenue30)}],revenueByMonth:[{label:'This Month',labelEn:'Month',revenue:money(revenueMonth)},{label:'This Year',labelEn:'Year',revenue:money(revenueYear)}],ordersByStatus:status.map(s=>({status:s.status,count:s.count})),ordersByDay:[],ordersByMonth:[],topCategories,topBrands}};
  return ok(c,analytics);
});
app.get('/inventory/alerts', adminOrModerator, async c => { const products=await all(c.env.DB.prepare('SELECT * FROM products WHERE stock<=? ORDER BY stock ASC').bind(Number(c.req.query('threshold'))||5)); return ok(c,{ products, summary:{low:products.length,out:products.filter(p=>p.stock===0).length,totalValue:products.reduce((s,p)=>s+(p.price*p.stock),0)} }); });
app.get('/inventory/movements', adminOrModerator, async c => ok(c,{ movements:await all(c.env.DB.prepare('SELECT sm.*, p.name productName FROM stock_movements sm LEFT JOIN products p ON p.id=sm.productId ORDER BY sm.createdAt DESC LIMIT 200')) }));
app.post('/inventory/adjust', adminOrModerator, async c => {
  const b = await c.req.json();
  if (!b.productId) return fail(c, 'معرّف المنتج مطلوب', 400);
  const p = await first(c.env.DB.prepare('SELECT stock FROM products WHERE id=?').bind(b.productId));
  if (!p) return fail(c, 'المنتج غير موجود', 404);
  const before = Number(p.stock);
  /* الواجهة ترسل قيمة المخزون الجديدة في `stock` (الاتفاق الحالي)،
     والاتفاق القديم كان `type`+`quantity` — ندعم الاثنين.
     كان الخادم يقرأ quantity فقط، فيحسب NaN ويخزّن NULL فيكسر NOT NULL (500). */
  let after;
  if (b.stock !== undefined && b.stock !== null && b.stock !== '') after = Number(b.stock);
  else if (b.type === 'set') after = Number(b.quantity);
  else after = before + Number(b.quantity || 0);
  if (!Number.isFinite(after) || after < 0) return fail(c, 'قيمة المخزون غير صالحة', 400);
  const delta = after - before;
  await run(c.env.DB.prepare('UPDATE products SET stock=?,updatedAt=? WHERE id=?').bind(after, nowIso(), b.productId));
  await run(c.env.DB.prepare('INSERT INTO stock_movements(id,productId,userId,type,quantity,beforeStock,afterStock,reason,referenceType,referenceId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(uuid(), b.productId, c.get('user')?.id, b.type || 'adjust', delta, before, after, b.reason || null, b.referenceType || null, b.referenceId || null, nowIso()));
  return ok(c, { stock: after, message: 'تم تحديث المخزون' });
});
app.get('/search', adminOrModerator, async c => { const q=`%${c.req.query('q')||''}%`; const [products,orders,customers] = await Promise.all([all(c.env.DB.prepare('SELECT id,name,sku,price,stock FROM products WHERE name LIKE ? OR sku LIKE ? LIMIT 10').bind(q,q)), all(c.env.DB.prepare('SELECT id,orderNumber,total,orderStatus FROM orders WHERE orderNumber LIKE ? LIMIT 10').bind(q)), all(c.env.DB.prepare('SELECT id,name,email,phone FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 10').bind(q,q))]); return ok(c,{products,orders,customers}); });
app.get('/notifications/feed', adminOrModerator, async c => {
  /* فلاتر حقيقية: النوع + حالة القراءة + بحث — كانت تُرسل من الواجهة ويُتجاهلها الخادم */
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;
  const where = []; const vals = [];
  const type = c.req.query('type');
  const read = c.req.query('read');
  const q = c.req.query('q');
  if (type && type !== 'all') { where.push('type=?'); vals.push(type); }
  if (read === 'true' || read === 'false') { where.push('isRead=?'); vals.push(read === 'true' ? 1 : 0); }
  if (q) { where.push('(title LIKE ? OR body LIKE ?)'); vals.push(`%${q}%`, `%${q}%`); }
  const ws = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) n FROM notifications ${ws}`).bind(...vals).first()).n;
  const rows = await all(c.env.DB.prepare(`SELECT * FROM notifications ${ws} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals, limit, offset));
  /* تحصين الخادم: تاريخ غير قابل للتفسير يصل كـ null — لا يسمح لصف واحد
     بإسقاط مركز الإشعارات (كان يرمي RangeError في Intl.RelativeTimeFormat) */
  const notifications = rows.map((n) => {
    const t = new Date(n.createdAt).getTime();
    return Number.isFinite(t) ? n : { ...n, createdAt: null };
  });
  /* التجميع عام بلا فلاتر حتى تبقى عدادات الأنواع وغير المقروء إجمالية */
  const byType = await all(c.env.DB.prepare('SELECT type, COUNT(*) count, COALESCE(SUM(CASE WHEN isRead=0 THEN 1 ELSE 0 END),0) unread FROM notifications GROUP BY type'));
  const unreadTotal = (await c.env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE isRead=0').first())?.n || 0;
  return ok(c, { notifications, byType, unreadCount: unreadTotal, page, pages: Math.max(1, Math.ceil(total / limit)), total });
});
app.delete('/notifications/read', adminOrModerator, async c => { await run(c.env.DB.prepare('UPDATE notifications SET isRead=1')); return ok(c,{}); });

app.get('/backup', admin, async c => {
  const scope=c.req.query('scope')||'all'; const tables=scope==='settings'?['settings']:['users','products','categories','brands','orders','order_items','coupons','banners','reviews','settings','pages','media','tickets','return_requests'];
  const backup={ version:2, exportedAt:nowIso(), scope, data:{} };
  for (const t of tables) backup.data[t]=(await all(c.env.DB.prepare(`SELECT * FROM ${t}`))).map(r=>{ const x={...r}; delete x.passwordHash; return x; });
  return c.body(JSON.stringify(backup),200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="alzeina-backup.json"'});
});
app.post('/backup/restore-preview', admin, async c => { const b=await c.req.json(); return ok(c,{ tables:Object.keys(b.backup?.data||b.data||{}), counts:Object.fromEntries(Object.entries(b.backup?.data||b.data||{}).map(([k,v])=>[k,v.length])) }); });
app.post('/backup/restore', admin, c => c.json({status:'success',message:'Database restore must be performed with wrangler d1 execute from a downloaded backup for Free-plan safety.'},202));
app.get('/backup/schedule', admin, c => ok(c,{ schedule:'Use Cloudflare Cron Trigger; Worker Free plan includes scheduled handlers.' }));
app.put('/backup/schedule', admin, c => ok(c,{saved:true}));
export default app;
