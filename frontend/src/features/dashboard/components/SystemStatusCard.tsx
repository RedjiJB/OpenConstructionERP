// Dashboard restoration, Slice J: was the inline SystemStatus() function
// in the now-deleted DashboardPage.tsx (recovered from git history to
// adapt). The API/database/AI-provider health rows were already fully
// domain-agnostic; only the vector-DB row and the BOQ-modules/
// validation-rules counts are dropped, since this façade has no
// pgvector and no module catalogue to report on. Points at
// GET /api/v1/system/status (src/facade/routes/system.ts) instead of
// the vendored /api/system/status.
//
// Query key is deliberately NOT the vendored ['system-status'] --
// DemoBanner.tsx (mounted globally in AppLayout) already owns that key
// with staleTime: Infinity against the old endpoint, and TanStack Query
// caches by key regardless of which component's queryFn it came from.
// Sharing it here would silently serve DemoBanner's permanently-cached,
// wrong-shaped result instead of ever calling this widget's own queryFn.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Zap, Layers, ShieldCheck } from 'lucide-react';
import { getSystemStatus } from '../api';
import { SUPPORTED_LANGUAGES } from '@/app/i18n';

function StatusDot({ status }: { status: 'connected' | 'healthy' | 'offline' | 'error' | string }) {
  const color =
    status === 'connected' || status === 'healthy'
      ? 'bg-semantic-success'
      : status === 'offline'
        ? 'bg-content-quaternary'
        : 'bg-semantic-error';
  const pulse = status === 'connected' || status === 'healthy';
  return (
    <span className="relative flex h-2 w-2">
      {pulse && <span className={`absolute inset-0 rounded-full ${color} opacity-50 animate-ping`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

export function SystemStatusCard() {
  const { t } = useTranslation();

  const { data: status } = useQuery({
    queryKey: ['facade-system-status'],
    queryFn: () => getSystemStatus(),
    retry: false,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const apiStatus = status?.api?.status ?? 'offline';
  const dbStatus = status?.database?.status ?? 'offline';
  const aiConfigured = status?.ai?.configured ?? false;

  const services = [
    {
      name: t('dashboard.api_server', { defaultValue: 'API Server' }),
      status: apiStatus,
      detail: status?.api?.version ? `v${status.api.version}` : '',
      icon: <Zap size={13} />,
      delay: 400,
    },
    {
      name: t('dashboard.database', { defaultValue: 'Database' }),
      status: dbStatus,
      detail: '',
      icon: <Layers size={13} />,
      delay: 460,
    },
    {
      name: t('dashboard.ai_providers', { defaultValue: 'AI Providers' }),
      status: aiConfigured ? 'connected' : 'offline',
      detail:
        status?.ai?.providers?.filter((p) => p.configured).map((p) => p.name).join(', ') ||
        t('dashboard.not_configured', { defaultValue: 'Not configured' }),
      icon: <ShieldCheck size={13} />,
      delay: 520,
    },
  ];

  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated/90 p-4 animate-card-in">
      <h3 className="mb-3 text-sm font-semibold text-content-primary">
        {t('dashboard.system_status', { defaultValue: 'System status' })}
      </h3>
      <div className="space-y-3">
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center justify-between animate-stagger-in" style={{ animationDelay: `${svc.delay}ms` }}>
            <span className="flex items-center gap-2 text-sm text-content-secondary">
              {svc.icon}
              {svc.name}
            </span>
            <div className="flex items-center gap-2">
              {svc.detail && <span className="text-2xs text-content-quaternary">{svc.detail}</span>}
              <StatusDot status={svc.status} />
            </div>
          </div>
        ))}

        <div className="h-px bg-border-light" />

        <div className="flex items-center justify-between animate-stagger-in" style={{ animationDelay: '580ms' }}>
          <span className="text-sm text-content-secondary">{t('dashboard.languages')}</span>
          <span className="text-sm font-semibold text-content-primary tabular-nums">{SUPPORTED_LANGUAGES.length}</span>
        </div>
      </div>
    </div>
  );
}
