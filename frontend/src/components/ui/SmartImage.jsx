import { useEffect, useState } from 'react';
import { FALLBACK_IMG } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';
import { cn } from '@/utils/helpers';

/**
 * صورة موحّدة لكل الموقع.
 *
 * تحلّ ثلاث مشاكل كانت متكررة:
 * 1) الصور المخزّنة كمسار نسبي (/uploads/…) تُحوَّل لرابط صحيح تلقائياً.
 * 2) المصدر الفارغ كان يعرض أيقونة "صورة مكسورة" لأن onError لا يعمل
 *    إلا عند فشل التحميل — الآن نعرض البديل فوراً.
 * 3) التحميل الكسول وأبعاد ثابتة لتقليل انزياح التخطيط (CLS).
 */
export default function SmartImage({
  src,
  alt = '',
  className,
  wrapperClassName,
  loading = 'lazy',
  fallback = FALLBACK_IMG,
  ...props
}) {
  const resolved = mediaUrl(src);
  const [current, setCurrent] = useState(resolved || fallback);

  // تحديث المصدر عند تغيّر الخاصية (تبديل صورة المنتج مثلاً)
  useEffect(() => {
    setCurrent(mediaUrl(src) || fallback);
  }, [src, fallback]);

  return (
    <img
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
      className={cn(className, wrapperClassName)}
      {...props}
    />
  );
}
