import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readStorage, writeStorage } from '@/utils/helpers';

export * from './useProducts';

/** debounce لأي قيمة */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** localStorage state */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => readStorage(key, initial));
  const set = useCallback(
    (v) => {
      const next = typeof v === 'function' ? v(readStorage(key, initial)) : v;
      writeStorage(key, next);
      setValue(next);
    },
    [key, initial]
  );
  return [value, set];
}

/** إغلاق عند الضغط خارج العنصر */
export function useClickOutside(handler) {
  const ref = useRef(null);
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);
  return ref;
}

/** مفتاح Escape */
export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && handler(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handler, active]);
}

/**
 * منع تمرير الصفحة (للمودالات والدروَر).
 *
 * يستخدم عدّاد مرجعي (reference counting) لأن أكثر من طبقة قد تكون مفتوحة
 * في نفس الوقت (قائمة الجوال + سلة التسوق مثلاً). بدون العدّاد كانت الطبقة
 * الثانية تحفظ "hidden" كقيمة أصلية ثم تعيدها عند إغلاقها، فيبقى تمرير
 * الصفحة متجمداً للأبد حتى بعد إغلاق كل الطبقات.
 *
 * كما نعوّض عرض شريط التمرير حتى لا "تقفز" الصفحة عند الفتح والإغلاق.
 */
let scrollLockCount = 0;
let scrollLockPrevOverflow = '';
let scrollLockPrevPadding = '';

const acquireScrollLock = () => {
  if (scrollLockCount === 0) {
    const { body } = document;
    scrollLockPrevOverflow = body.style.overflow;
    scrollLockPrevPadding = body.style.paddingInlineEnd;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingInlineEnd = `${gap}px`;
  }
  scrollLockCount += 1;
};

const releaseScrollLock = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    const { body } = document;
    body.style.overflow = scrollLockPrevOverflow;
    body.style.paddingInlineEnd = scrollLockPrevPadding;
  }
};

/** يفكّ أي قفل عالق — يُستدعى عند تغيير المسار كشبكة أمان */
export const forceReleaseScrollLock = () => {
  scrollLockCount = 0;
  document.body.style.overflow = '';
  document.body.style.paddingInlineEnd = '';
};

export function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    acquireScrollLock();
    return releaseScrollLock;
  }, [locked]);
}

/** التمرير لأعلى عند تغيير المسار */
export function useScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
}

/** هل تم تمرير الصفحة لمسافة معينة */
export function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** استعلام media query */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** عدّاد تنازلي */
export function useCountdown(targetDate) {
  const calc = useCallback(() => {
    /* بلا تاريخ هدف لا يوجد عدّاد — نعيد حالة منتهية بدل NaN */
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, isExpired: true };
    const diff = new Date(targetDate).getTime() - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, isExpired: true };
    }
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff / 3600000) % 24),
      minutes: Math.floor((diff / 60000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      finished: false,
      /** اسم مرادف أوضح — finished يبقى للتوافق مع الأكواد القائمة */
      isExpired: false,
    };
  }, [targetDate]);

  const [time, setTime] = useState(calc);
  useEffect(() => {
    setTime(calc());
    /* لا نشغّل مؤقتاً كل ثانية بلا داعٍ عندما لا يوجد عدّاد أصلاً */
    if (!targetDate) return undefined;
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc, targetDate]);
  return time;
}

/** عناصر شوهدت مؤخراً */
export function useRecentlyViewed() {
  const [items, setItems] = useLocalStorage('alzeina_recent', []);
  const add = useCallback(
    (product) => {
      if (!product) return;
      const id = product._id || product.id;
      setItems((prev) => {
        const filtered = (prev || []).filter((p) => (p._id || p.id) !== id);
        return [
          {
            _id: id,
            slug: product.slug,
            name: product.name,
            nameEn: product.nameEn,
            mainImage: product.mainImage,
            price: product.price,
            oldPrice: product.oldPrice,
            discount: product.discount,
            rating: product.rating,
            reviewsCount: product.reviewsCount,
            stock: product.stock,
            brand: product.brand,
          },
          ...filtered,
        ].slice(0, 10);
      });
    },
    [setItems]
  );
  return { items: items || [], add, clear: () => setItems([]) };
}

/** عمليات بحث سابقة */
export function useRecentSearches() {
  const [items, setItems] = useLocalStorage('alzeina_recent_searches', []);
  const add = useCallback(
    (term) => {
      const t = term?.trim();
      if (!t) return;
      setItems((prev) => [t, ...(prev || []).filter((x) => x !== t)].slice(0, 8));
    },
    [setItems]
  );
  return { items: items || [], add, clear: () => setItems([]) };
}

/** الكشف عن ظهور عنصر في الشاشة */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold: 0.15, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);
  return [ref, inView];
}
