import Breadcrumbs from './Breadcrumbs';

export default function PageHeader({ title, subtitle, breadcrumbs = [], children }) {
  return (
    <div className="border-b border-black/5 bg-gradient-to-b from-blush/60 to-cream">
      <div className="container-x py-8 md:py-10">
        <Breadcrumbs items={breadcrumbs} className="mb-4" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
