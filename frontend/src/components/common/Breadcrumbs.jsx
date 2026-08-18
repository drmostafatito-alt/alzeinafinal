import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiHome } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

export default function Breadcrumbs({ items = [], className }) {
  const { t, isRTL } = useI18n();
  const Sep = isRTL ? FiChevronLeft : FiChevronRight;

  return (
    <nav className={cn('flex flex-wrap items-center gap-1.5 text-xs text-ink-muted', className)} aria-label="breadcrumb">
      <Link to="/" className="flex items-center gap-1 transition hover:text-rose">
        <FiHome size={13} />
        {t('nav.home')}
      </Link>
      {items.map((item, i) => (
        <span key={item.label + i} className="flex items-center gap-1.5">
          <Sep size={12} className="opacity-50" />
          {item.to && i < items.length - 1 ? (
            <Link to={item.to} className="transition hover:text-rose">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
