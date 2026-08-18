import { FiPackage, FiPlus } from 'react-icons/fi';
import EmptyState from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/i18n';

/**
 * ما يظهر في الرئيسية عندما لا يوجد أي منتج منشور.
 *
 * الرسالة تختلف حسب من ينظر — وهذا هو الهدف:
 * • المدير: رسالة تشغيلية + زر مباشر لإضافة أول منتج. الخطوة التالية
 *   واضحة بلا الحاجة لأي دليل.
 * • الزائر: رسالة تسويقية مهذّبة. لا نكشف له أن المتجر "فارغ" بصيغة
 *   تشبه الخطأ التقني، ولا نعرض عليه زر لوحة تحكّم لا يملكه.
 */
export default function StoreEmptyNotice() {
  const { t } = useI18n();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  if (isAdmin) {
    return (
      <section className="section">
        <div className="container-x">
          <EmptyState
            icon={FiPackage}
            title={t('storeEmpty.adminTitle')}
            description={t('storeEmpty.adminDesc')}
            actionLabel={t('storeEmpty.addProduct')}
            actionTo="/admin/products"
            secondaryLabel={t('storeEmpty.openAdmin')}
            secondaryTo="/admin"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container-x">
        <EmptyState
          icon={FiPlus}
          title={t('storeEmpty.visitorTitle')}
          description={t('storeEmpty.visitorDesc')}
        />
      </div>
    </section>
  );
}
