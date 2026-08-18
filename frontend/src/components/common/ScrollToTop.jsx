import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { forceReleaseScrollLock } from '@/hooks';
import { useUIStore } from '@/store/uiStore';

/**
 * يعيد الصفحة لأعلى عند كل تنقل، ويعمل كشبكة أمان أخيرة:
 * يغلق كل الطبقات (سلة/قائمة/بحث/عرض سريع) ويفكّ قفل التمرير.
 * بدون هذا كان أي دروَر مفتوح وقت التنقل يترك الموقع غير قابل للاستخدام.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const closeAll = useUIStore((s) => s.closeAll);

  useEffect(() => {
    closeAll();
    forceReleaseScrollLock();
    window.scrollTo(0, 0);
  }, [pathname, search, closeAll]);

  return null;
}
