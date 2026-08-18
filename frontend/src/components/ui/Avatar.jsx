import { useEffect, useState } from 'react';
import { FiUser } from 'react-icons/fi';
import { cn } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';

/**
 * صورة المستخدم مع بديل آمن:
 * لو لم توجد صورة أو فشل تحميلها (رابط قديم/محذوف) نعرض أيقونة بدل صورة مكسورة.
 */
export default function Avatar({ src, name, size = 40, className, iconClassName }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (!src || failed) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-blush font-bold text-rose',
          className,
          iconClassName
        )}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-label={name || 'avatar'}
      >
        {initials || <FiUser size={size * 0.5} />}
      </span>
    );
  }

  return (
    <img
      src={mediaUrl(src)}
      alt={name || ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  );
}
