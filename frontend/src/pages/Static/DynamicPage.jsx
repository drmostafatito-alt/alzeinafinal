import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiChevronDown } from 'react-icons/fi';
import PageHeader from '@/components/common/PageHeader';
import { PageSpinner } from '@/components/ui/Spinner';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';
import NotFound from '@/pages/NotFound';

/** يعرض أي صفحة محتوى ينشئها المدير من لوحة الإدارة */
export default function DynamicPage() {
  const { slug } = useParams();
  const { lang } = useI18n();
  const [open, setOpen] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => client.get(`/storefront/pages/${slug}`).then((r) => r.data),
    retry: 1
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data?.data?.page) return <NotFound />;

  const page = data.data.page;
  const title = (lang === 'ar' ? page.title : page.titleEn) || page.title;
  const content = (lang === 'ar' ? page.content : page.contentEn) || page.content;
  const hasFaqs = page.faqs?.length > 0;
  const hasSections = page.sections?.length > 0;

  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: title }]} />

      <div className="container-x py-8">
        <div className="mx-auto max-w-3xl space-y-3">
          {content ? (
            <div
              className="prose-rtl rounded-2xl border border-black/5 bg-white p-6 text-sm leading-loose text-ink-soft shadow-soft"
              // المحتوى يُنظَّف على الخادم قبل التخزين (xssGuard)
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : null}

          {hasSections
            ? page.sections.map((sec, i) => {
                const heading = (lang === 'ar' ? sec.heading : sec.headingEn) || sec.heading;
                const body = (lang === 'ar' ? sec.body : sec.bodyEn) || sec.body;
                return (
                  <section key={heading + i} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
                    <h2 className="mb-3 text-base font-bold text-ink">
                      <span className="font-en me-2 text-rose">{String(i + 1).padStart(2, '0')}</span>
                      {heading}
                    </h2>
                    <p className="whitespace-pre-line text-sm leading-loose text-ink-soft">{body}</p>
                  </section>
                );
              })
            : null}

          {hasFaqs
            ? page.faqs.map((f, i) => {
                const q = (lang === 'ar' ? f.question : f.questionEn) || f.question;
                const a = (lang === 'ar' ? f.answer : f.answerEn) || f.answer;
                return (
                  <div key={q + i} className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft">
                    <button
                      type="button"
                      onClick={() => setOpen(open === i ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-start"
                    >
                      <span className="text-sm font-bold text-ink">{q}</span>
                      <FiChevronDown
                        size={18}
                        className={cn('shrink-0 text-rose transition-transform', open === i && 'rotate-180')}
                      />
                    </button>
                    {open === i ? (
                      <p className="whitespace-pre-line border-t border-black/5 p-5 text-sm leading-loose text-ink-soft">
                        {a}
                      </p>
                    ) : null}
                  </div>
                );
              })
            : null}

          {!content && !hasSections && !hasFaqs ? (
            <p className="rounded-2xl bg-white p-10 text-center text-sm text-ink-muted shadow-soft">—</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
