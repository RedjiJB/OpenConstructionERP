// Restoring Settings, Slice Q: a real, small settings page -- not the
// vendored 2320-line multi-domain shell this file used to hold
// (e-invoicing, translation manager, backup/restore, team panel, none
// of which have a fit in this domain). The theme toggle and language
// switcher this fork actually uses already live in the header, so they
// are not duplicated here. Three real sections: profile (read-only),
// AI provider keys (admin-only -- the chat assistant's one genuine,
// already-blocking gap), and self-service password change.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, Check, Loader2, User as UserIcon, KeyRound } from 'lucide-react';
import { PageHeader, Button } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { getProfile, getLlmSettings, updateLlmSettings, changePassword } from './api';

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-content-primary">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function ProfileSection() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['settings-profile'], queryFn: getProfile, retry: false });

  return (
    <SectionCard icon={<UserIcon size={16} className="text-oe-blue" />} title={t('settings.profile', { defaultValue: 'Profile' })}>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-2xs uppercase tracking-wide text-content-tertiary">{t('common.name', { defaultValue: 'Name' })}</dt>
          <dd className="mt-0.5 text-sm text-content-primary">{data?.full_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-content-tertiary">{t('common.email', { defaultValue: 'Email' })}</dt>
          <dd className="mt-0.5 text-sm text-content-primary">{data?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-content-tertiary">{t('common.role', { defaultValue: 'Role' })}</dt>
          <dd className="mt-0.5 text-sm capitalize text-content-primary">{data?.role ?? '—'}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

interface ProviderRowProps {
  label: string;
  configured: boolean | undefined;
  isLoading: boolean;
  isPending: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
}

function ProviderKeyRow({ label, configured, isLoading, isPending, onSave, onClear }: ProviderRowProps) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 space-y-1 text-xs text-content-secondary">
        <span className="flex items-center gap-1.5">
          {label}
          {!isLoading && (
            <span className={`inline-flex items-center gap-1 text-2xs ${configured ? 'text-semantic-success' : 'text-content-quaternary'}`}>
              {configured && <Check size={11} />}
              {configured ? t('settings.configured', { defaultValue: 'Configured' }) : t('settings.not_configured', { defaultValue: 'Not configured' })}
            </span>
          )}
        </span>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={configured ? '••••••••••••' : t('settings.enter_key', { defaultValue: 'Enter API key' }) ?? ''}
          autoComplete="off"
          className="w-full rounded-md border border-border-light px-2 py-1.5 text-sm"
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        disabled={!key || isPending}
        onClick={() => {
          onSave(key);
          setKey('');
        }}
      >
        {t('common.save', { defaultValue: 'Save' })}
      </Button>
      {configured && (
        <Button variant="ghost" size="sm" disabled={isPending} onClick={onClear}>
          {t('common.clear', { defaultValue: 'Clear' })}
        </Button>
      )}
    </div>
  );
}

function LlmProviderSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['settings-llm'], queryFn: getLlmSettings, retry: false });

  const mutation = useMutation({
    mutationFn: (patch: { deepseek_api_key?: string; openai_api_key?: string; anthropic_api_key?: string }) => updateLlmSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings-llm'] });
      void queryClient.invalidateQueries({ queryKey: ['facade-system-status'] });
      addToast({ type: 'success', title: t('settings.llm_saved', { defaultValue: 'Saved' }) });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: t('settings.llm_save_failed', { defaultValue: 'Could not save' }), message: getErrorMessage(err) });
    },
  });

  return (
    <SectionCard icon={<Bot size={16} className="text-oe-blue" />} title={t('settings.ai_providers', { defaultValue: 'AI provider keys' })}>
      <p className="mb-4 text-xs text-content-tertiary">
        {t('settings.ai_providers_hint', { defaultValue: "Powers the chat assistant. Keys are never shown again once saved -- only whether one is configured." })}
      </p>
      <div className="space-y-3">
        <ProviderKeyRow
          label="DeepSeek"
          configured={data?.deepseek_configured}
          isLoading={isLoading}
          isPending={mutation.isPending}
          onSave={(key) => mutation.mutate({ deepseek_api_key: key })}
          onClear={() => mutation.mutate({ deepseek_api_key: '' })}
        />
        <ProviderKeyRow
          label="OpenAI"
          configured={data?.openai_configured}
          isLoading={isLoading}
          isPending={mutation.isPending}
          onSave={(key) => mutation.mutate({ openai_api_key: key })}
          onClear={() => mutation.mutate({ openai_api_key: '' })}
        />
        <ProviderKeyRow
          label="Anthropic"
          configured={data?.anthropic_configured}
          isLoading={isLoading}
          isPending={mutation.isPending}
          onSave={(key) => mutation.mutate({ anthropic_api_key: key })}
          onClear={() => mutation.mutate({ anthropic_api_key: '' })}
        />
      </div>
    </SectionCard>
  );
}

function ChangePasswordSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      addToast({ type: 'success', title: t('settings.password_changed', { defaultValue: 'Password changed' }) });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: t('settings.password_change_failed', { defaultValue: 'Could not change password' }), message: getErrorMessage(err) });
    },
  });

  return (
    <SectionCard icon={<KeyRound size={16} className="text-oe-blue" />} title={t('settings.change_password', { defaultValue: 'Change password' })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <label className="space-y-1 text-xs text-content-secondary">
          <span>{t('settings.current_password', { defaultValue: 'Current password' })}</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-border-light px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs text-content-secondary">
          <span>{t('settings.new_password', { defaultValue: 'New password' })}</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-border-light px-2 py-1.5 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending} icon={mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : undefined}>
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const userRole = useAuthStore((s) => s.userRole);
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader
        srTitle={t('nav.settings', { defaultValue: 'Settings' })}
        subtitle={t('settings.subtitle', { defaultValue: 'Your account and the chat assistant\'s AI provider configuration.' })}
      />
      <ProfileSection />
      {isAdmin && <LlmProviderSection />}
      <ChangePasswordSection />
    </div>
  );
}

export default SettingsPage;
