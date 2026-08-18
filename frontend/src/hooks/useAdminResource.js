import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useI18n } from '@/i18n';

/**
 * يوفّر كل ما تحتاجه صفحة إدارة: جلب + إنشاء + تعديل + حذف + حالة المودال.
 * @param {string} name مفتاح الكاش (products, categories, ...)
 * @param {object} service كائن به list/create/update/remove
 * @param {string} dataKey مفتاح المصفوفة داخل الاستجابة
 * @param {string[]} relatedKeys مفاتيح كاش إضافية لواجهة المتجر يجب إبطالها
 *        مع هذا المورد (مثل مجموعات الرئيسية featured/newArrivals...)
 */
export function useAdminResource(name, service, dataKey, relatedKeys = []) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const key = ['admin', name];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const query = useQuery({ queryKey: key, queryFn: service.list });
  const items = query.data?.data?.[dataKey || name] || [];

  /**
   * إبطال الكاش بعد أي تعديل.
   *
   * المشكلة التي يعالجها: كان الإبطال يقتصر على ['admin', name]، بينما
   * تقرأ بقية التطبيق القوائم العامة من مفاتيح مختلفة تماماً:
   *   • نموذج المنتج وفلاتر المتجر ← ['categories'] و ['brands']
   * فكان المدير ينشئ قسماً جديداً ثم لا يجده في قائمة الأقسام داخل
   * نموذج المنتج إلا بعد تحديث الصفحة بالكامل — ويبدو الأمر كأن
   * القسم لم يُنشأ أصلاً.
   *
   * نُبطل الآن المفتاح الإداري والمفتاح العام معاً.
   *
   * إضافة لاحقة (إصلاح «المنتج لا يظهر في المتجر»): مجموعات الرئيسية
   * (featured/bestSellers/newArrivals/onSale) ومفاتيح صفحة المنتج
   * تُخزَّن بمفاتيح مستقلة مع staleTime خمس دقائق، فكانت تعرض قوائم
   * قديمة بعد إنشاء/تعديل منتج عند التنقل بنفس التبويب (SPA) — يُمرَّر
   * relatedKeys لإبطالها معاً.
   */
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    // المفتاح العام يحمل نفس اسم المورد (categories, brands, products...)
    qc.invalidateQueries({ queryKey: [name] });
    // مفاتيح واجهة المتجر المرتبطة بهذا المورد (مطابقة بالبادئة)
    for (const k of relatedKeys) qc.invalidateQueries({ queryKey: [k] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => service.create(payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setModalOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => service.update(id, payload),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      setModalOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => service.remove(id),
    onSuccess: () => {
      toast.success(t('admin.deleted'));
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error')),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const save = (payload) => {
    if (editing) updateMutation.mutate({ id: editing._id, payload });
    else createMutation.mutate(payload);
  };

  return {
    items,
    isLoading: query.isLoading,
    refetch: query.refetch,
    invalidate,
    modalOpen,
    editing,
    deleting,
    setDeleting,
    openCreate,
    openEdit,
    closeModal,
    save,
    saving: createMutation.isPending || updateMutation.isPending,
    confirmDelete: () => deleting && deleteMutation.mutate(deleting),
  };
}
