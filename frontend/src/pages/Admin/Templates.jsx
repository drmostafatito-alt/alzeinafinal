import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiEye, FiMail, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ImagePicker from '@/components/admin/ImagePicker';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Textarea } from '@/components/forms/Input';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import client from '@/api/client';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

/** محرّر قوالب الرسائل — البريد الآن، ومُهيّأ لـ SMS/WhatsApp */
export default function AdminTemplates() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'email-templates'],
    queryFn: () => client.get('/admin/email-templates').then((r) => r.data?.data)
  });
  const templates = data?.templates || [];

  const { register, handleSubmit, reset, watch, control } = useForm();
  useEffect(() => {
    if (selected) reset(selected);
  }, [selected, reset]);

  const save = useMutation({
    mutationFn: ({ id, payload }) => client.put(`/admin/email-templates/${id}`, payload),
    onSuccess: (r) => {
      toast.success(t('admin.saved'));
      setSelected(r.data?.data?.template);
      qc.invalidateQueries({ queryKey: ['admin', 'email-templates'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const sendTest = useMutation({
    mutationFn: ({ id, email }) => client.post(`/admin/email-templates/${id}/test`, { email }),
    onSuccess: (r) => toast.success(r.data?.message || t('admin.saved')),
    onError: (e) => toast.error(e?.response?.data?.message || t('common.error'))
  });

  const showPreview = async (tpl) => {
    try {
      const res = await client.get(`/admin/email-templates/${tpl._id}/preview`);
      setPreview({ ...res.data?.data?.preview, name: tpl.name });
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    }
  };

  if (isLoading) {
    return (
      <>
        <AdminPageHeader title={t('admin.templates')} />
        <TableSkeleton rows={6} cols={2} />
      </>
    );
  }

  const variables = watch('variables') || selected?.variables || [];

  return (
    <>
      <AdminPageHeader
        title={t('admin.templates')}
        subtitle={`${templates.filter((x) => x.isActive).length} / ${templates.length} ${t('admin.enabled')}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* قائمة القوالب */}
        <div className="space-y-2 lg:sticky lg:top-24 lg:max-h-[70vh] lg:self-start lg:overflow-y-auto">
          {templates.map((tpl) => (
            <button
              key={tpl._id}
              type="button"
              onClick={() => setSelected(tpl)}
              className={cn(
                'w-full rounded-xl border p-3 text-start transition',
                selected?._id === tpl._id ? 'border-rose bg-blush/40' : 'border-black/5 bg-white hover:border-rose/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="clamp-1 text-sm font-bold text-ink">{lang === 'ar' ? tpl.name : tpl.nameEn || tpl.name}</p>
                  <p className="font-en clamp-1 text-[10px] text-ink-muted">{tpl.key}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!tpl.isActive ? <Badge variant="neutral">{t('common.inactive')}</Badge> : null}
                  {tpl.isSystem ? <Badge variant="blush">{t('admin.system')}</Badge> : null}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* المحرر */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-black/10 bg-white text-sm text-ink-muted">
              <span className="flex flex-col items-center gap-2">
                <FiMail size={26} className="text-rose" />
                {t('admin.selectTemplate')}
              </span>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit((v) => save.mutate({ id: selected._id, payload: v }))}
              className="space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-ink">{lang === 'ar' ? selected.name : selected.nameEn}</h3>
                <div className="flex gap-2">
                  <Button type="button" size="xs" variant="outline" icon={FiEye} onClick={() => showPreview(selected)}>
                    {t('admin.preview')}
                  </Button>
                </div>
              </div>

              {selected.description ? <p className="text-xs text-ink-muted">{selected.description}</p> : null}

              {variables.length ? (
                <div className="rounded-xl bg-cream p-3">
                  <p className="mb-2 text-[11px] font-bold text-ink-muted">{t('admin.availableVars')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${v}}}`);
                          toast.success(t('common.copied'));
                        }}
                        className="font-en rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-rose transition hover:bg-rose hover:text-white"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={`${t('admin.subject')} (AR)`} {...register('subject')} />
                <Input label={`${t('admin.subject')} (EN)`} dir="ltr" {...register('subjectEn')} />
              </div>

              <Textarea label={`${t('admin.message')} (AR)`} rows={7} hint="HTML" {...register('body')} />
              <Textarea label={`${t('admin.message')} (EN)`} rows={4} hint="HTML" {...register('bodyEn')} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t('admin.buttonText')} {...register('buttonText')} />
                <Input label={t('admin.buttonUrl')} dir="ltr" {...register('buttonUrl')} />
              </div>

              {/* المظهر */}
              <div className="rounded-xl bg-cream p-4">
                <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.appearance')}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Controller
                    name="logo"
                    control={control}
                    render={({ field }) => (
                      <ImagePicker
                        label={t('admin.siteLogo')}
                        folder="logo"
                        aspect="aspect-auto"
                        previewSize="h-14 w-24"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Input label={t('admin.headerText')} {...register('headerText')} />
                  <div className="flex items-end gap-2">
                    <Input label={t('admin.colorPrimary')} dir="ltr" containerClassName="flex-1" {...register('primaryColor')} />
                    <input type="color" {...register('primaryColor')} className="mb-0.5 h-11 w-12 cursor-pointer rounded-lg border border-black/10" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Input label={t('admin.colorAccent')} dir="ltr" containerClassName="flex-1" {...register('accentColor')} />
                    <input type="color" {...register('accentColor')} className="mb-0.5 h-11 w-12 cursor-pointer rounded-lg border border-black/10" />
                  </div>
                  <Textarea label={t('admin.footerText')} rows={2} containerClassName="sm:col-span-2" {...register('footerText')} />
                </div>
              </div>

              {/* المُرسِل */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label={t('admin.fromName')} {...register('fromName')} />
                <Input label={t('admin.fromEmail')} type="email" dir="ltr" {...register('fromEmail')} />
                <Input label={t('admin.replyTo')} type="email" dir="ltr" {...register('replyTo')} />
              </div>

              {/* القنوات */}
              <div className="rounded-xl border border-black/5 p-4">
                <p className="mb-3 text-xs font-bold text-ink-muted">{t('admin.channels')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Checkbox label={t('admin.channelEmail')} {...register('channels.email')} />
                  <Checkbox label={t('admin.channelSms')} {...register('channels.sms')} />
                  <Checkbox label={t('admin.channelWhatsapp')} {...register('channels.whatsapp')} />
                  <Checkbox label={t('common.active')} {...register('isActive')} />
                </div>
                <Textarea label={t('admin.smsBody')} rows={2} containerClassName="mt-3" {...register('smsBody')} />
                <Textarea label={t('admin.whatsappBody')} rows={2} containerClassName="mt-3" {...register('whatsappBody')} />
                <p className="mt-2 text-[11px] text-ink-muted">{t('admin.channelsHint')}</p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
                <div className="flex flex-1 gap-2">
                  <Input
                    type="email"
                    dir="ltr"
                    placeholder={t('admin.testEmail')}
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    containerClassName="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    icon={FiSend}
                    loading={sendTest.isPending}
                    onClick={() => testEmail && sendTest.mutate({ id: selected._id, email: testEmail })}
                  >
                    {t('admin.sendTest')}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* معاينة */}
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} size="lg">
        {preview ? (
          <div className="p-6">
            <p className="mb-3 rounded-lg bg-cream p-3 text-sm">
              <span className="text-ink-muted">{t('admin.subject')}: </span>
              <span className="font-bold text-ink">{preview.subject}</span>
            </p>
            <iframe title="preview" srcDoc={preview.html} className="h-[520px] w-full rounded-xl border border-black/10" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
