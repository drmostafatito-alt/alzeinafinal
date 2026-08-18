import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiCheckCircle, FiMessageSquare, FiThumbsUp } from 'react-icons/fi';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'react-toastify';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Rating from '@/components/ui/Rating';
import { Textarea } from '@/components/forms/Input';
import Input from '@/components/forms/Input';
import { reviewService } from '@/services';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/helpers';

export default function ProductReviews({ product }) {
  const { t, lang } = useI18n();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [sort, setSort] = useState('recent');

  const { data } = useQuery({
    queryKey: ['reviews', product._id],
    queryFn: () => reviewService.byProduct(product._id),
    enabled: Boolean(product._id),
  });
  const reviews = data?.data?.reviews || [];

  const mutation = useMutation({
    mutationFn: (payload) => reviewService.create(payload),
    onSuccess: () => {
      toast.success(t('product.reviewSubmitted'));
      setTitle('');
      setComment('');
      setRating(5);
      qc.invalidateQueries({ queryKey: ['reviews', product._id] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!comment.trim()) return toast.error(t('valid.required'));
    mutation.mutate({ productId: product._id, rating, title, comment });
  };

  /**
   * الفرز يتم في المتصفح لأن عدد تقييمات المنتج الواحد صغير عادة،
   * فنتجنّب رحلة إضافية للخادم ونعطي استجابة فورية.
   */
  const sortedReviews = useMemo(() => {
    const list = [...reviews];
    if (sort === 'highest') return list.sort((a, b) => b.rating - a.rating);
    if (sort === 'lowest') return list.sort((a, b) => a.rating - b.rating);
    if (sort === 'helpful') return list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [reviews, sort]);

  // توزيع النجوم
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, percent: reviews.length ? (count / reviews.length) * 100 : 0 };
  });

  const verifiedCount = reviews.filter((r) => r.isVerified).length;

  return (
    <section className="mt-12" id="reviews">
      <h2 className="mb-6 flex items-center gap-2.5 text-xl font-bold text-ink">
        <FiMessageSquare className="text-rose" />
        {t('product.reviews')} ({product.reviewsCount || reviews.length})
      </h2>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <div className="text-center">
            <p className="font-en text-5xl font-bold text-ink">{Number(product.rating || 0).toFixed(1)}</p>
            <Rating value={product.rating} size={18} className="mt-2 justify-center" />
            <p className="mt-2 text-xs text-ink-muted">
              {product.reviewsCount || reviews.length} {t('product.reviews')}
            </p>
            {verifiedCount > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <FiCheckCircle size={12} aria-hidden="true" />
                {t('product.verifiedCount', { n: verifiedCount })}
              </p>
            ) : null}
          </div>

          <div className="mt-6 space-y-2">
            {distribution.map(({ star, count, percent }) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0 text-ink-muted">{star} ★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-blush">
                  <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="w-6 shrink-0 text-end text-ink-muted">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form + list */}
        <div className="space-y-6 lg:col-span-2">
          {user ? (
            <form onSubmit={submit} className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-base font-bold text-ink">{t('product.writeReview')}</h3>
              <div className="mb-4">
                <p className="label">{t('product.rating')}</p>
                <Rating value={rating} interactive onChange={setRating} size={26} />
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                label={t('product.reviewTitle')}
                containerClassName="mb-4"
              />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                label={t('product.reviewComment')}
                required
                rows={4}
                containerClassName="mb-4"
              />
              <Button type="submit" loading={mutation.isPending}>
                {t('product.submitReview')}
              </Button>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-rose/40 bg-blush/40 p-6 text-center">
              <p className="text-sm text-ink-soft">{t('product.loginToReview')}</p>
              <Link to="/login" className="btn-rose btn-sm mt-3 inline-flex">
                {t('nav.login')}
              </Link>
            </div>
          )}

          {reviews.length ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {reviews.length} {t('product.reviews')}
                </p>
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="sr-only">{t('common.sort')}</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="input !w-auto !py-2 !text-xs"
                    aria-label={t('common.sort')}
                  >
                    <option value="recent">{t('product.sortRecent')}</option>
                    <option value="highest">{t('product.sortHighest')}</option>
                    <option value="lowest">{t('product.sortLowest')}</option>
                    <option value="helpful">{t('product.sortHelpful')}</option>
                  </select>
                </label>
              </div>

            <ul className="space-y-4">
              {sortedReviews.map((r) => (
                <li key={r._id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
                  <div className="flex items-start gap-3">
                    <Avatar src={r.user?.avatar} name={r.user?.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-sm font-bold text-ink">{r.user?.name || '—'}</p>
                        <Rating value={r.rating} size={12} />
                        <span className="text-[11px] text-ink-muted">{formatDate(r.createdAt, lang)}</span>
                      </div>
                      {r.isVerified ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <FiCheckCircle size={11} aria-hidden="true" />
                          {t('admin.verifiedPurchase')}
                        </span>
                      ) : null}
                      {r.title ? <p className="mt-1.5 text-sm font-semibold text-ink">{r.title}</p> : null}
                      <p className={cn('mt-1 text-sm leading-relaxed text-ink-soft')}>{r.comment}</p>

                      {/* رد المتجر الرسمي إن وُجد */}
                      {r.reply?.text ? (
                        <div className="mt-3 rounded-xl border-s-2 border-rose bg-blush/40 p-3">
                          <p className="text-[11px] font-bold text-rose">{t('admin.replyToReview')}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.reply.text}</p>
                        </div>
                      ) : null}

                      {/* تصويت "مفيد" — محلي، يُرسل للخادم عند توفّر المسار */}
                      <button
                        type="button"
                        onClick={() => toast.info(t('product.thanksFeedback'))}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-[11px] font-semibold text-ink-muted transition hover:border-rose hover:text-rose"
                      >
                        <FiThumbsUp size={12} aria-hidden="true" />
                        {t('product.helpful')}
                        {r.likes ? ` (${r.likes})` : ''}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            </>
          ) : (
            <EmptyState
              icon={FiMessageSquare}
              title={t('product.noReviews')}
              description={t('product.beFirstReview')}
              compact
              className="rounded-2xl border border-black/5 bg-white"
            />
          )}
        </div>
      </div>
    </section>
  );
}
