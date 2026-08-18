import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiFacebook,
  FiInstagram,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSend,
  FiTwitter,
  FiYoutube,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Logo from '@/components/ui/Logo';
import { contentService } from '@/services';
import { localizedBrandName } from '@/utils/helpers';
import { useI18n } from '@/i18n';
import { useConfig, useFeature } from '@/config/ConfigProvider';
import { SOCIAL_ICONS } from '@/utils/socialIcons';


export default function Footer() {
  const { t, lang } = useI18n();
  const { settings, pages } = useConfig();
  const wishlistOn = useFeature('wishlist');
  const contact = settings.contact || {};
  const socials = Object.entries(settings.social || {})
    .filter(([key, url]) => url && SOCIAL_ICONS[key])
    .map(([key, url]) => ({ icon: SOCIAL_ICONS[key], href: url, label: key }));
  const brandName = localizedBrandName(settings.siteName, settings.siteNameAr, lang);
  const footerAbout =
    (lang === 'ar' ? settings.footer?.about : settings.footer?.aboutEn) ||
    settings.footer?.about ||
    settings.footer?.aboutEn ||
    t('footer.aboutText');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) return toast.error(t('valid.email'));
    setBusy(true);
    try {
      await contentService.subscribe(email);
      toast.success(t('home.newsletter.success'));
      setEmail('');
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      title: t('footer.quickLinks'),
      links: [
        { to: '/shop', label: t('nav.shop') },
        { to: '/categories', label: t('nav.categories') },
        { to: '/shop?discount=true', label: t('nav.offers') },
        { to: '/shop?sort=newest', label: t('nav.newArrivals') },
        { to: '/shop?sort=bestSeller', label: t('nav.bestSellers') },
      ],
    },
    {
      title: t('footer.customerService'),
      links: [
        { to: '/contact', label: t('footer.contactUs') },
        { to: '/orders', label: t('footer.trackOrder') },
        // صفحات المحتوى تأتي من لوحة الإدارة
        ...(pages || [])
          .filter((p) => p.showInFooter !== false)
          .map((p) => ({ to: `/page/${p.slug}`, label: lang === 'ar' ? p.title : p.titleEn || p.title })),
      ],
    },
    {
      title: t('nav.account'),
      links: [
        { to: '/profile', label: t('nav.profile') },
        { to: '/orders', label: t('nav.orders') },
        /* رابط المفضلة يحترم مفتاح الميزة تماماً كأيقونة الهيدر */
        ...(wishlistOn ? [{ to: '/wishlist', label: t('nav.wishlist') }] : []),
        { to: '/cart', label: t('nav.cart') },
        { to: '/login', label: t('nav.login') },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-ink text-white/70">
      {/* Newsletter strip */}
      {settings.features?.newsletter === false ? null : (
      <div className="border-b border-white/10 bg-gradient-to-l from-rose-700/25 via-ink to-ink">
        <div className="container-x grid gap-6 py-10 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="text-xl font-bold text-white md:text-2xl">{t('home.newsletter.title')}</h3>
            <p className="mt-2 text-sm text-white/60">{t('home.newsletter.subtitle')}</p>
          </div>
          <form onSubmit={subscribe} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('home.newsletter.placeholder')}
              className="h-12 w-full rounded-full border border-white/15 bg-white/5 px-5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-rose focus:bg-white/10"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-rose px-6 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
            >
              <FiSend size={15} />
              <span className="hidden sm:inline">{t('home.newsletter.cta')}</span>
            </button>
          </form>
        </div>
      </div>
      )}

      {/* Main */}
      <div className="container-x grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo variant="light" size="md" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{footerAbout}</p>

          <ul className="mt-6 space-y-3 text-sm">
            {contact.address || contact.addressEn ? (
              <li className="flex items-center gap-3">
                <FiMapPin className="shrink-0 text-rose" size={16} />
                {(lang === 'ar' ? contact.address : contact.addressEn) || contact.address}
              </li>
            ) : null}
            {contact.phone ? (
              <li className="flex items-center gap-3">
                <FiPhone className="shrink-0 text-rose" size={16} />
                <a href={`tel:${contact.phone}`} dir="ltr" className="transition hover:text-rose">
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.email ? (
              <li className="flex items-center gap-3">
                <FiMail className="shrink-0 text-rose" size={16} />
                <a href={`mailto:${contact.email}`} className="transition hover:text-rose">
                  {contact.email}
                </a>
              </li>
            ) : null}
          </ul>

          <div className="mt-6 flex gap-2">
            {socials.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/70 transition hover:border-rose hover:bg-rose hover:text-white"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">{col.title}</h4>
            <ul className="space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.to + l.label}>
                  <Link to={l.to} className="transition hover:text-rose">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-5 text-xs md:flex-row">
          <p className="flex flex-wrap items-center gap-x-2">
            <span>
              {(lang === 'ar' ? settings.footer?.copyright : settings.footer?.copyrightEn) ||
                `© ${new Date().getFullYear()} ${brandName} — ${t('footer.rights')}`}
            </span>
            {/*
              سطر "مدعوم بواسطة" — يتحكم فيه المدير من العلامة البيضاء.
              كانت المفاتيح الثلاثة (showPoweredBy/poweredByText/poweredByUrl)
              محفوظة في الإعدادات بلا أي استخدام، أي إعداد وهمي.
            */}
            {settings.branding?.showPoweredBy && settings.branding?.poweredByText ? (
              settings.branding?.poweredByUrl ? (
                <a
                  href={settings.branding.poweredByUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-white/60 underline-offset-2 transition hover:text-white hover:underline"
                >
                  {settings.branding.poweredByText}
                </a>
              ) : (
                <span className="text-white/60">{settings.branding.poweredByText}</span>
              )
            ) : null}
          </p>

          <div className="flex items-center gap-3">
            <span className="text-white/40">{t('footer.payments')}:</span>
            <div className="flex gap-2">
              {(settings.footer?.paymentIcons || []).map((p) => (
                <span
                  key={p}
                  className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/70"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            {(pages || [])
              .filter((p) => ['privacy-policy', 'terms'].includes(p.slug))
              .map((p) => (
                <Link key={p.slug} to={`/page/${p.slug}`} className="transition hover:text-rose">
                  {lang === 'ar' ? p.title : p.titleEn || p.title}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
