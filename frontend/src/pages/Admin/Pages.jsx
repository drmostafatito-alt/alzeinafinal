import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { FiExternalLink, FiPlus, FiTrash2 } from 'react-icons/fi';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DataTable from '@/components/admin/DataTable';
import AdvancedFields from '@/components/admin/AdvancedFields';
import Input, { Checkbox, Textarea } from '@/components/forms/Input';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import RowActions from '@/components/admin/RowActions';
import { useAdminResource } from '@/hooks/useAdminResource';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { slugify } from '@/utils/format';

const pageService = {
  list: () => client.get('/admin/pages').then((r) => ({ data: r.data.data })),
  create: (payload) => client.post('/admin/pages', payload).then((r) => ({ data: r.data.data })),
  update: (id, payload) => client.put(`/admin/pages/${id}`, payload).then((r) => ({ data: r.data.data })),
  remove: (id) => client.delete(`/admin/pages/${id}`).then((r) => ({ data: r.data.data }))
};

/** محرّر صفحات المحتوى: من نحن، السياسات، الأسئلة الشائعة، وأي صفحة جديدة */
export default function AdminPages() {
  const { t, lang } = useI18n();
  const res = useAdminResource('pages', pageService, 'pages');

  const { register, handleSubmit, reset, control, watch } = useForm({
    defaultValues: { sections: [], faqs: [] }
  });
  const sections = useFieldArray({ control, name: 'sections' });
  const faqs = useFieldArray({ control, name: 'faqs' });

  useEffect(() => {
    if (!res.modalOpen) return;
    reset(
      res.editing || {
        slug: '',
        title: '',
        titleEn: '',
        content: '',
        contentEn: '',
        sections: [],
        faqs: [],
        showInFooter: true,
        isActive: true,
        order: (res.items?.length || 0) + 1
      }
    );
  }, [res.modalOpen, res.editing, reset, res.items]);

  const title = watch('title');

  const columns = [
    {
      key: 'title',
      header: t('common.name'),
      render: (p) => (
        <div className="min-w-0">
          <p className="clamp-1 text-sm font-semibold text-ink">{lang === 'ar' ? p.title : p.titleEn || p.title}</p>
          <p className="font-en text-[11px] text-ink-muted">/page/{p.slug}</p>
        </div>
      )
    },
    {
      key: 'sections',
      header: t('common.description'),
      render: (p) => (
        <span className="text-xs text-ink-muted">
          {p.sections?.length ? `${p.sections.length} ${t('admin.order')}` : ''}
          {p.faqs?.length ? ` · ${p.faqs.length} FAQ` : ''}
          {!p.sections?.length && !p.faqs?.length && p.content ? 'HTML' : ''}
        </span>
      ),
      hideOnMobile: true
    },
    {
      key: 'showInFooter',
      header: 'Footer',
      render: (p) => <Badge variant={p.showInFooter ? 'blush' : 'neutral'}>{p.showInFooter ? '✓' : '—'}</Badge>,
      hideOnMobile: true
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (p) => (
        <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? t('common.active') : t('common.inactive')}</Badge>
      )
    }
  ];

  return (
    <>
      <AdminPageHeader title={t('admin.pages')} subtitle={`${res.items.length}`}>
        <Button onClick={res.openCreate} icon={FiPlus} size="sm">
          {t('common.add')}
        </Button>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        data={res.items}
        loading={res.isLoading}
        searchKeys={['title', 'slug']}
        actions={(row) => (
          <RowActions
            onEdit={() => res.openEdit(row)}
            onDelete={() => res.setDeleting(row._id)}
            extra={
              <a
                href={`/page/${row.slug}`}
                target="_blank"
                rel="noreferrer"
                className="grid h-8 w-8 place-items-center rounded-lg border border-black/10 text-ink-muted transition hover:border-ink hover:text-ink"
                title={t('common.view')}
              >
                <FiExternalLink size={14} />
              </a>
            }
          />
        )}
      />

      <Modal open={res.modalOpen} onClose={res.closeModal} title={t('admin.pages')} size="lg">
        <form
          onSubmit={handleSubmit((v) => res.save({ ...v, slug: v.slug || slugify(v.titleEn || v.title) }))}
          className="space-y-5 p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={`${t('common.name')} (AR)`} required {...register('title', { required: true })} />
            <Input label={`${t('common.name')} (EN)`} dir="ltr" {...register('titleEn')} />
            <Input label={t('admin.order')} type="number" {...register('order')} />
          </div>
          {/* الرابط مخفي افتراضياً — يُولَّد تلقائياً من الاسم */}
          <AdvancedFields className="mt-2">
            <Input label={t('a7.slugLabel')} dir="ltr" hint={t('a6.slugHint')} {...register('slug')} />
          </AdvancedFields>


          <Textarea label={`${t('common.description')} (AR)`} rows={4} hint="HTML" {...register('content')} />
          <Textarea label={`${t('common.description')} (EN)`} rows={3} hint="HTML" {...register('contentEn')} />

          {/* أقسام مرقّمة */}
          <div className="rounded-xl bg-cream p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-ink">{t('admin.order')}</p>
              <Button type="button" size="xs" variant="outline" icon={FiPlus} onClick={() => sections.append({ heading: '', body: '' })}>
                {t('common.add')}
              </Button>
            </div>
            <div className="space-y-3">
              {sections.fields.map((f, i) => (
                <div key={f.id} className="rounded-lg border border-black/10 bg-white p-3">
                  <div className="flex gap-2">
                    <Input containerClassName="flex-1" placeholder={t('common.name')} {...register(`sections.${i}.heading`)} />
                    <button
                      type="button"
                      onClick={() => sections.remove(i)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                  <Textarea rows={2} containerClassName="mt-2" placeholder={t('common.description')} {...register(`sections.${i}.body`)} />
                </div>
              ))}
            </div>
          </div>

          {/* أسئلة شائعة */}
          <div className="rounded-xl bg-cream p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-ink">FAQ</p>
              <Button type="button" size="xs" variant="outline" icon={FiPlus} onClick={() => faqs.append({ question: '', answer: '' })}>
                {t('common.add')}
              </Button>
            </div>
            <div className="space-y-3">
              {faqs.fields.map((f, i) => (
                <div key={f.id} className="rounded-lg border border-black/10 bg-white p-3">
                  <div className="flex gap-2">
                    <Input containerClassName="flex-1" placeholder="?" {...register(`faqs.${i}.question`)} />
                    <button
                      type="button"
                      onClick={() => faqs.remove(i)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-600 transition hover:bg-red-50"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                  <Textarea rows={2} containerClassName="mt-2" {...register(`faqs.${i}.answer`)} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Meta title" {...register('metaTitle')} />
            <Input label="Meta description" {...register('metaDescription')} />
          </div>

          <div className="flex gap-6">
            <Checkbox label="Footer" {...register('showInFooter')} />
            <Checkbox label={t('common.active')} {...register('isActive')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={res.saving} className="flex-1">
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={res.closeModal}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(res.deleting)}
        onClose={() => res.setDeleting(null)}
        onConfirm={res.confirmDelete}
        title={t('admin.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
