import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiChevronDown, FiGrid, FiZap } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { useCategories } from '@/hooks';
import { useNavigation } from '@/hooks/useNavigation';
import { useI18n } from '@/i18n';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function Navbar() {
  const { t, lang } = useI18n();
  const { categories } = useCategories();
  const [megaOpen, setMegaOpen] = useState(false);

  /* القائمة تأتي من الإعدادات — راجع hooks/useNavigation */
  const links = useNavigation('desktop');

  const linkClass = ({ isActive }) =>
    cn(
      'relative py-4 text-sm font-semibold transition-colors',
      'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-rose after:transition-transform',
      isActive ? 'text-rose after:scale-x-100' : 'text-ink hover:text-rose hover:after:scale-x-100'
    );

  return (
    <nav className="relative hidden border-b border-black/5 bg-white lg:block">
      <div className="container-x flex items-center gap-7">
        {/* Categories mega menu */}
        <div
          className="relative"
          onMouseEnter={() => setMegaOpen(true)}
          onMouseLeave={() => setMegaOpen(false)}
        >
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 py-4 text-sm font-bold transition',
              megaOpen ? 'text-rose' : 'text-ink hover:text-rose'
            )}
          >
            <FiGrid size={16} />
            {t('nav.categories')}
            <FiChevronDown size={14} className={cn('transition-transform', megaOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {megaOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute start-0 top-full z-50 w-[720px] overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-lift"
              >
                <div className="grid grid-cols-3 gap-3">
                  {categories.map((c) => (
                    <Link
                      key={c._id}
                      to={`/shop?category=${c.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-blush"
                    >
                      <SmartImage
                        src={c.image}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <p className="clamp-1 text-sm font-semibold text-ink transition group-hover:text-rose">
                          {localized(c, lang)}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {c.productCount || 0} {t('categories.products')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/categories"
                  onClick={() => setMegaOpen(false)}
                  className="mt-4 block rounded-xl bg-ink py-2.5 text-center text-xs font-bold text-white transition hover:bg-rose"
                >
                  {t('common.viewAll')}
                </Link>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <span className="h-5 w-px bg-black/10" />

        {links.map((l) => {
          const inner = (
            <span className={cn('flex items-center gap-1.5', l.highlight && 'text-rose')}>
              {l.highlight ? <FiZap size={14} className="fill-rose" /> : null}
              {l.icon ? <span aria-hidden="true">{l.icon}</span> : null}
              {l.label}
            </span>
          );

          /* روابط خارجية: <a> لا NavLink — الراوتر لا يعرف نطاقات أخرى */
          if (l.external) {
            return (
              <a
                key={l.id}
                href={l.to}
                target={l.newTab ? '_blank' : undefined}
                rel={l.newTab ? 'noreferrer noopener' : undefined}
                className="relative py-4 text-sm font-semibold text-ink transition-colors hover:text-rose"
              >
                {inner}
              </a>
            );
          }

          /* قائمة منسدلة عند وجود عناصر فرعية */
          if (l.children?.length) {
            return (
              <div key={l.id} className="group relative">
                <NavLink to={l.to} end={l.end} className={linkClass}>
                  <span className="flex items-center gap-1">
                    {inner}
                    <FiChevronDown size={13} />
                  </span>
                </NavLink>
                <div className="invisible absolute start-0 top-full z-50 min-w-[200px] rounded-xl border border-black/5 bg-white p-1.5 opacity-0 shadow-lift transition group-hover:visible group-hover:opacity-100">
                  {l.children.map((c) => (
                    <Link
                      key={c.id}
                      to={c.to}
                      className="block truncate rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-blush hover:text-rose"
                    >
                      {c.icon ? <span className="me-1.5">{c.icon}</span> : null}
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <NavLink key={l.id} to={l.to} end={l.end} className={linkClass}>
              {inner}
            </NavLink>
          );
        })}

        <span className="ms-auto flex items-center gap-2 py-4 text-xs font-semibold text-ink-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {t('top.support')}
        </span>
      </div>
    </nav>
  );
}
