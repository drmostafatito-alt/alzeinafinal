import { motion } from 'framer-motion';
import { FiAward, FiHeart, FiPackage, FiUsers } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/common/PageHeader';
import { useI18n } from '@/i18n';

export default function About() {
  const { t, lang } = useI18n();

  const stats = [
    { icon: FiUsers, value: '12,400+', label: lang === 'ar' ? 'عميلة سعيدة' : 'Happy customers' },
    { icon: FiPackage, value: '850+', label: lang === 'ar' ? 'منتج أصلي' : 'Authentic products' },
    { icon: FiAward, value: '30+', label: lang === 'ar' ? 'ماركة عالمية' : 'Global brands' },
    { icon: FiHeart, value: '4.9/5', label: lang === 'ar' ? 'تقييم العملاء' : 'Customer rating' },
  ];

  const values =
    lang === 'ar'
      ? [
          { title: 'الأصالة أولاً', text: 'كل منتج في الزينة يأتي من الوكيل المعتمد مباشرة، بضمان أصالة كامل.' },
          { title: 'أسعار عادلة', text: 'نؤمن أن العناية بالجمال حق للجميع، لذلك نحرص على أفضل الأسعار الممكنة.' },
          { title: 'خبرة نثق بها', text: 'فريقنا من خبراء التجميل يختار ويراجع كل منتج قبل عرضه في المتجر.' },
          { title: 'خدمة تهتم', text: 'دعم على مدار الساعة وسياسة إرجاع مرنة لأن راحتك تهمنا.' },
        ]
      : [
          { title: 'Authenticity first', text: 'Every product comes straight from the authorized distributor with a full guarantee.' },
          { title: 'Fair pricing', text: 'Beauty care is for everyone, so we work hard to keep prices accessible.' },
          { title: 'Expertise you trust', text: 'Our beauty experts curate and review every product before it goes live.' },
          { title: 'Service that cares', text: 'Round-the-clock support and a flexible returns policy — your comfort matters.' },
        ];

  return (
    <>
      <PageHeader title={t('about.title')} breadcrumbs={[{ label: t('about.title') }]} />

      <div className="container-x py-8">
        {/* Hero */}
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl font-bold text-ink md:text-3xl">
              {lang === 'ar' ? 'جمالك يبدأ من هنا' : 'Where your beauty begins'}
            </h2>
            <p className="mt-4 text-sm leading-loose text-ink-soft">{t('footer.aboutText')}</p>
            <p className="mt-4 text-sm leading-loose text-ink-soft">
              {lang === 'ar'
                ? 'بدأت الزينة كحلم صغير في القاهرة عام 2022، برغبة في تقديم منتجات تجميل أصلية بأسعار عادلة لكل امرأة في مصر. اليوم نخدم آلاف العميلات في كل المحافظات، ونحرص على أن تصل كل طلبية بنفس العناية التي بدأنا بها.'
                : 'Al Zeina started as a small dream in Cairo back in 2022, with a wish to offer authentic beauty products at fair prices to every woman in Egypt. Today we serve thousands of customers across all governorates, and every order still ships with the same care we started with.'}
            </p>
            <Button to="/shop" className="mt-6">
              {t('cart.startShopping')}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl shadow-card"
          >
            <img src="https://picsum.photos/seed/alzeina-about/900/700" alt="" className="h-full w-full object-cover" />
          </motion.div>
        </div>

        {/* Stats */}
        <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-soft"
            >
              <Icon className="mx-auto mb-3 text-rose" size={26} />
              <p className="font-en text-2xl font-bold text-ink">{value}</p>
              <p className="mt-1 text-xs text-ink-muted">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Values */}
        <div className="mt-14">
          <h2 className="mb-6 text-xl font-bold text-ink">{lang === 'ar' ? 'قيمنا' : 'Our values'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft"
              >
                <span className="font-en text-sm font-bold text-rose">0{i + 1}</span>
                <h3 className="mt-2 text-base font-bold text-ink">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{v.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
