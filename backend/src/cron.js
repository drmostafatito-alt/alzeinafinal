import { nowIso, parseJson, stringify, uuid } from './lib/response.js';
import { all, run, first } from './lib/db.js';

const HOUR = 3600_000;

export async function runScheduledJobs(env) {
  const started = Date.now();
  const now = nowIso();
  const results = {};

  results['coupon-expiry'] = await env.DB.prepare("UPDATE coupons SET isActive=0 WHERE isActive=1 AND endDate < ?").bind(now).run();

  results['publish-scheduled'] = await env.DB.prepare("UPDATE products SET isActive=1,status='published' WHERE status='scheduled' AND publishAt IS NOT NULL AND publishAt <= ?").bind(now).run();

  const featuresRow = await env.DB.prepare("SELECT value FROM settings WHERE key='features'").first();
  const features = parseJson(featuresRow?.value, { lowStockThreshold: 5, inventoryAlerts: true });
  if (features.inventoryAlerts !== false) {
    const low = await all(env.DB.prepare('SELECT id,name,stock FROM products WHERE isActive=1 AND stock <= ? LIMIT 50').bind(Number(features.lowStockThreshold) || 5));
    let alerts = 0;
    for (const p of low) {
      const exists = await first(env.DB.prepare("SELECT id FROM notifications WHERE type='stock' AND refId=? AND createdAt >= ?").bind(p.id, new Date(Date.now() - 24 * HOUR).toISOString()));
      if (!exists) {
        await run(env.DB.prepare('INSERT INTO notifications(id,type,title,body,link,refModel,refId,priority,isRead,data,createdAt) VALUES(?,?,?,?,?,?,?,?,0,?,?)')
          .bind(uuid(), 'stock', p.stock === 0 ? `نفد المخزون: ${p.name}` : `مخزون منخفض: ${p.name}`, `المتبقي ${p.stock} قطعة`, '/admin/inventory', 'Product', p.id, p.stock === 0 ? 'high' : 'normal', '{}', now));
        alerts++;
      }
    }
    results['low-stock-alerts'] = { checked: low.length, alerts };
  }

  // Workers are stateless; there is no in-memory cache to prune and no local upload/tmp directory.
  results['cache-cleanup'] = { pruned: 0, note: 'stateless-worker' };

  // Lightweight daily summary is computed on demand by /admin/analytics; no separate summary table is required for Free operation.
  const since = new Date(Date.now() - 24 * HOUR).toISOString();
  const [orders24h, revenue24h] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE createdAt >= ?').bind(since).first(),
    env.DB.prepare("SELECT COALESCE(SUM(total),0) total FROM orders WHERE createdAt >= ? AND orderStatus NOT IN ('cancelled','refunded')").bind(since).first()
  ]);
  results['analytics-warmup'] = { orders24h: orders24h.n, revenue24h: revenue24h.total, at: now };

  // R2 objects under proofs/tmp can be cleaned if used by future temporary upload flows. Current proof uploads are retained as order records.
  results['temp-cleanup'] = { removed: 0, note: 'no-local-tmp' };

  const audit = await run(env.DB.prepare('DELETE FROM audit_logs WHERE createdAt < ?').bind(new Date(Date.now() - 180 * 24 * HOUR).toISOString()));
  const errors = await run(env.DB.prepare('DELETE FROM error_logs WHERE resolved=1 AND lastSeenAt < ?').bind(new Date(Date.now() - 60 * 24 * HOUR).toISOString()));
  results['log-rotation'] = { auditDeleted: audit.meta?.changes || 0, errorsDeleted: errors.meta?.changes || 0 };

  for (const [key, result] of Object.entries(results)) {
    await run(env.DB.prepare(`INSERT INTO jobs(id,name,intervalMs,enabled,lastRunAt,lastDuration,lastResult,runs,failures)
      VALUES(?,?,3600000,1,?,?,?,1,0)
      ON CONFLICT(id) DO UPDATE SET lastRunAt=excluded.lastRunAt,lastDuration=excluded.lastDuration,lastResult=excluded.lastResult,runs=runs+1`)
      .bind(key, key, now, Date.now() - started, stringify(result)));
  }
  return results;
}
