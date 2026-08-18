/**
 * مُنظّف HTML خفيف لمحتوى CMS (صفحات + بلوكات HTML مخصصة).
 * بلا مكتبات خارجية — يكفي لحذف الوسوم والسمات الخطرة قبل التخزين.
 *
 * يسمح بـ: فقرات، عناوين، قوائم، روابط (http/https/mailto/tel وروابط نسبية)،
 * صور، جداول، أسطر فاصلة، وسمات أمان محدودة فقط.
 * يحذف: script/iframe/object/embed/style/form/svg/… ، كل سمات on*،
 * أي رابط javascript: ، وكل سمات style.
 */

const ALLOWED_TAGS = new Set([
  'p','br','b','strong','i','em','u','s','del','ins','mark','small','sub','sup',
  'a','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','code','pre','hr',
  'img','figure','figcaption','span','div','table','thead','tbody','tfoot','tr','td','th','caption',
  'video','source','details','summary'
]);

const ALLOWED_ATTRS = new Set([
  'href','src','alt','title','width','height','target','rel','class','id','dir','lang',
  'colspan','rowspan','controls','poster','loading','start','open'
]);

const SAFE_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

const sanitizeUrl = (v) => {
  const s = String(v || '').trim();
  if (!s) return '';
  if (!SAFE_URL.test(s)) return '';
  if (/^(javascript|data|vbscript):/i.test(s)) return '';
  return s;
};

export function sanitizeHtml(input) {
  if (input === null || input === undefined) return '';
  const s = String(input);
  if (!s) return '';

  let out = '';
  let i = 0;
  const len = s.length;

  const readTagName = (str) => {
    const m = /^\/?([a-zA-Z][a-zA-Z0-9]*)/.exec(str);
    return m ? m[1].toLowerCase() : null;
  };

  while (i < len) {
    const lt = s.indexOf('<', i);
    if (lt === -1) { out += s.slice(i); break; }
    out += s.slice(i, lt);
    const gt = s.indexOf('>', lt);
    if (gt === -1) { out += s.slice(lt).replace(/</g, '&lt;'); break; }

    const raw = s.slice(lt + 1, gt);
    i = gt + 1;

    // تعليق HTML
    if (raw.startsWith('!--')) continue;

    const isClose = raw.startsWith('/');
    const tagName = readTagName(raw);
    if (!tagName || !ALLOWED_TAGS.has(tagName)) continue;

    // استخراج السمات
    const attrStr = raw.slice(raw.indexOf(tagName) + tagName.length);
    const attrs = [];
    const attrRe = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let m;
    let safe = true;
    while ((m = attrRe.exec(attrStr)) !== null) {
      const name = m[1].toLowerCase();
      const val = m[3] ?? m[4] ?? m[5] ?? '';
      if (/^on/i.test(name)) continue; // on*
      if (!ALLOWED_ATTRS.has(name)) continue;
      if (name === 'href' || name === 'src' || name === 'poster') {
        const clean = sanitizeUrl(val);
        if (!clean) { if (name === 'href') safe = false; continue; }
        attrs.push(`${name}="${clean.replace(/"/g, '&quot;')}"`);
        continue;
      }
      if (name === 'rel') { attrs.push('rel="noopener noreferrer"'); continue; }
      if (name === 'style') continue; // نمنع الأنماط المضمنة
      if (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan' || name === 'start') {
        if (!/^\d{1,4}$/.test(val)) continue;
      }
      attrs.push(`${name}="${String(val).replace(/"/g, '&quot;')}"`);
    }

    if (!safe) continue; // رابط غير آمن في الوسم → حذف الوسم كاملاً
    out += `<${isClose ? '/' : ''}${tagName}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  }

  return out;
}
