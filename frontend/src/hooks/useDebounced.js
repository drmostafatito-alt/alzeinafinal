import { useEffect, useRef, useState } from 'react';

/**
 * يؤخّر قيمة حتى تتوقف التغييرات — يمنع إطلاق طلب مع كل ضغطة زر.
 * @param {any} value القيمة المتغيّرة
 * @param {number} delay بالمللي ثانية
 */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/**
 * يؤخّر تنفيذ دالة. المرجع ثابت فلا يتسبب في إعادة تصيير.
 */
export function useDebouncedCallback(fn, delay = 350) {
  const timer = useRef(null);
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useRef((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), delay);
  }).current;
}

export default useDebounced;
