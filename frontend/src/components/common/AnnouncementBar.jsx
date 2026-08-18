import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';

/**
 * شريط الإعلانات العلوي — Continuous Infinite Marquee.
 *
 * البيانات من لوحة الإدارة (D1 → /storefront/config) حصراً: النصوص،
 * الأيقونات، الروابط، الألوان، حجم الخط، السرعة، التفعيل.
 *
 * كيف تتحقق حركة لا نهائية بلا فجوة ولا قفزة (سبب مشكلة "النص الثابت" سابقاً):
 *
 *   viewport (overflow hidden)
 *     → track (مجموعتان متطابقتان تماماً)
 *         → group A  ← الرسائل مكررة `repeat` مرة حتى يتجاوز عرضها الشاشة
 *         → group B  ← نسخة مطابقة (aria-hidden)
 *
 *   الـ animation تزيح الـ track بمقدار عرض مجموعة واحدة بالضبط (50% من
 *   عرضه) ثم تعيد الدورة؛ ولأن B تطابق A بكسلاً-ببكسل تكون نهاية الدورة
 *   مطابقة بصرياً لبدايتها = loop سلس بلا snap.
 *
 *   شرط عدم ظهور فراغ: عرض المجموعة الواحدة ≥ عرض الشاشة. النسخة السابقة
 *   كانت تكرر الرسائل مرتين فقط (مجموعة أضيق من الشاشة) فظهر فراغ ثم قفزة.
 *   هنا نقيس فعلياً ونرفع `repeat` تلقائياً (مع ResizeObserver لتغير المقاس).
 *
 * الاتجاه: RTL يتحرك من اليمين إلى اليسار، LTR من اليسار إلى اليمين.
 * الـ keyframes تُختار من dir الخاص بالشريط نفسه (وليس html) حتى لا يحدث
 * تعارض عندما يخالف إعداد الأدمن اتجاه الصفحة — وكان هذا سبب فجوات LTR.
 *
 * السرعة: ثابتة بالبكسل/الثانية (slow/normal/fast من الإعدادات) فتبقى
 * الحركة متجانسة مهما طال المحتوى؛ `speedSeconds` القديمة تظل مدعومة
 * كمدة صريحة للدورة الكاملة.
 *
 * قرار منتج: لا إيقاف عند hover، ولا تجميد لتفضيل "تقليل الحركة"
 * في نظام التشغيل (كان يجمّد الشريط على اللابتوبات فقط بينما يبقى
 * الهاتف متحركاً). الشريط يتحرك دائماً على كل الأجهزة — التجاوز
 * المقابل موجود في premium.css.
 */

const SPEED_PX_PER_SEC = { slow: 38, normal: 60, fast: 95 };
const MAX_REPEAT = 30;

export default function AnnouncementBar() {
  const { settings } = useConfig();
  const { lang } = useI18n();
  const a = settings.announcement || {};

  const shellRef = useRef(null);
  const groupRef = useRef(null);
  const [repeat, setRepeat] = useState(2);
  const [duration, setDuration] = useState(0); // 0 = لم يُقَس بعد

  const messages = useMemo(() => {
    const list = Array.isArray(a.items) ? a.items : [];
    const cleaned = list
      .filter((it) => it && it.enabled !== false)
      .map((it) => ({
        text: (lang === 'ar' ? it.text : it.textEn) || it.text || '',
        icon: it.icon || '✦',
        link: it.link || '',
        linkLabel: (lang === 'ar' ? it.linkLabel : it.linkLabelEn) || it.linkLabel || ''
      }))
      .filter((it) => it.text.trim());
    if (cleaned.length) return cleaned;
    const single = (lang === 'ar' ? a.text : a.textEn) || a.text || '';
    return single.trim()
      ? [{ text: single.trim(), icon: a.icon || '✦', link: a.link || '', linkLabel: (lang === 'ar' ? a.linkLabel : a.linkLabelEn) || a.linkLabel || '' }]
      : [];
  }, [a, lang]);

  const dir = a.direction === 'ltr' || a.direction === 'rtl' ? a.direction : lang === 'ar' ? 'rtl' : 'ltr';
  const pxPerSec = SPEED_PX_PER_SEC[String(a.speed || 'normal').toLowerCase()] || SPEED_PX_PER_SEC.normal;
  const messagesKey = messages.map((m) => `${m.icon}|${m.text}|${m.linkLabel}`).join('~');

  /**
   * القياس الفعلي بعد الرسم:
   * 1) إن كانت المجموعة أضيق من الشاشة → زد التكرار (يتقارب في خطوة واحدة
   *    لأن عرض الرسالة الواحدة ثابت).
   * 2) بعد استقرار التكرار → احسب مدة الدورة من العرض الحقيقي حتى تكون
   *    السرعة ثابتة بالبكسل/الثانية.
   * ResizeObserver يعيد الحساب عند تدوير الجهاز أو تغيير عرض النافذة.
   */
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const group = groupRef.current;
    if (!shell || !group || !messages.length) return undefined;

    const compute = () => {
      const shellW = shell.clientWidth || 1;
      const groupW = group.scrollWidth || 1;
      const unitW = Math.max(1, groupW / repeat); // عرض «طقم الرسائل» الواحد
      const needed = Math.min(MAX_REPEAT, Math.max(2, Math.ceil((shellW * 1.2) / unitW)));
      if (needed > repeat) { setRepeat(needed); return; }
      const explicit = Number(a.speedSeconds);
      const dur = explicit > 0 ? Math.max(8, explicit) : Math.max(12, Math.round(groupW / pxPerSec));
      setDuration((d) => (Math.abs(d - dur) > 0.5 ? dur : d));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(shell);
    /**
     * صمّام أمان: لو تعذّر القياس لأي سبب (متصفح قديم/سباق نادر) لا نترك
     * الشريط paused للأبد — بعد 600ms نشغّله بمدة افتراضية معقولة.
     */
    const failSafe = setTimeout(() => setDuration((d) => (d > 0 ? d : 30)), 600);
    return () => { ro.disconnect(); clearTimeout(failSafe); };
  }, [repeat, messagesKey, messages.length, pxPerSec, a.speedSeconds]);

  if (!a.enabled || !messages.length) return null;

  // [icon] نص [فاصل معيّني] — الفاصل جزء من كل segment فيبقى الإيقاع متصلاً عبر حدود المجموعات
  const renderSegment = (m, key, inertLink) => (
    <span key={key} className="announcement-segment">
      <span className="announcement-icon" aria-hidden="true">{m.icon}</span>
      <span className="announcement-text">{m.text}</span>
      {m.link && m.linkLabel ? (
        inertLink
          ? <span className="announcement-link">{m.linkLabel}</span>
          : <Link to={m.link} className="announcement-link">{m.linkLabel}</Link>
      ) : null}
      <span className="announcement-sep" aria-hidden="true" />
    </span>
  );

  // المجموعة الثانية زخرفية بالكامل: aria-hidden + روابط غير قابلة للتركيز حتى لا يمر التبويب على نسخ مكررة
  const renderGroup = (gi) => {
    const times = repeat;
    const items = [];
    for (let r = 0; r < times; r++) {
      messages.forEach((m, i) => items.push(renderSegment(m, `${gi}-${r}-${i}`, gi > 0)));
    }
    return (
      <div key={gi} ref={gi === 0 ? groupRef : undefined} className="announcement-group" aria-hidden={gi > 0 || undefined}>
        {items}
      </div>
    );
  };

  return (
    <div
      ref={shellRef}
      className="announcement-shell promo-band"
      dir={dir}
      role="region"
      aria-label={messages[0]?.text}
      style={{
        backgroundColor: a.bgColor || undefined,
        color: a.textColor || undefined,
        fontSize: a.fontSize ? `${a.fontSize}px` : undefined,
        ['--marquee-duration']: duration > 0 ? `${duration}s` : undefined,
        // لا حركة قبل أول قياس صحيح حتى لا تُرى قفزة أولى بمدة خاطئة
        ['--marquee-play']: duration > 0 ? 'running' : 'paused'
      }}
    >
      <div className="announcement-track">
        {renderGroup(0)}
        {renderGroup(1)}
      </div>
    </div>
  );
}
