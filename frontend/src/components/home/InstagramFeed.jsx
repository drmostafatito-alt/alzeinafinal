import { FiHeart, FiInstagram } from 'react-icons/fi';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import { useInstagramFeed } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';

import SmartImage from '@/components/ui/SmartImage';

/**
 * العنوان والوصف يأتيان من قاعدة البيانات (بانى الصفحة الرئيسية).
 * القيم الفارغة ترجع للترجمة الافتراضية، فلا ينكسر أي تثبيت قائم.
 */
export default function InstagramFeed({ title, subtitle } = {}) {
  const { t } = useI18n();
  const { settings } = useConfig();
  const { posts, isLoading } = useInstagramFeed();

  if (isLoading || !posts.length) return null;

  return (
    <section className="section">
      <div className="container-x">
        <SectionHeader
          title={title || t('home.instagram.title')}
          /* كان "@alzeina.beauty" مكتوباً في الكود — أي متجر آخر يعرض حساب غيره */
          subtitle={subtitle || settings.social?.instagram || t('home.instagram.subtitle')}
          align="center"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 lg:gap-3">
          {posts.map((post, i) => (
            <motion.a
              key={post._id}
              href={post.link}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="group relative aspect-square overflow-hidden rounded-xl bg-blush"
            >
              <SmartImage
                src={post.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/55 px-3 opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100">
                <FiInstagram className="text-white" size={20} />
                {post.caption ? (
                  <span className="clamp-2 text-center text-[11px] font-medium text-white">
                    {post.caption}
                  </span>
                ) : null}
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition hover:bg-rose"
          >
            <FiInstagram size={16} />
            {t('home.instagram.subtitle')}
          </a>
        </div>
      </div>
    </section>
  );
}
