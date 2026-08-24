// Restoring Field Reports, Slice S: re-scoped to sites + crew, not the
// vendored page's project_id (27 references throughout). No templates,
// no approval lifecycle, no signature pad -- just real reports with
// workforce/equipment derived live from timeclock/telemetry data at
// read time (see src/domain/fieldReports.ts on the backend).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, ClipboardList, Loader2, Truck, Users } from 'lucide-react';
import { PageHeader, Button } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib/api';
import { useToastStore } from '@/stores/useToastStore';
import { listSites } from '@/features/dashboard/api';
import { listFieldReports, getFieldReport, createFieldReport, type FieldReportSummary } from './api';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function NewReportForm() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { data: sitesData } = useQuery({ queryKey: ['dashboard-sites'], queryFn: () => listSites() });
  const sites = sitesData?.items ?? [];

  const [siteId, setSiteId] = useState('');
  const [reportDate, setReportDate] = useState(todayDateString());
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => createFieldReport({ site_id: siteId, report_date: reportDate, notes: notes.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      setNotes('');
      addToast({ type: 'success', title: t('field_reports.created', { defaultValue: 'Report saved' }) });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: t('field_reports.create_failed', { defaultValue: 'Could not save report' }), message: getErrorMessage(err) });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (siteId && reportDate && notes.trim()) mutation.mutate();
      }}
      className="rounded-xl border border-border-light bg-surface-elevated p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-content-primary">{t('field_reports.new_title', { defaultValue: 'New field report' })}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-content-secondary">
          <span>{t('field_reports.site', { defaultValue: 'Site' })}</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            required
            className="w-full rounded-md border border-border-light bg-surface-primary px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              {t('field_reports.select_site', { defaultValue: 'Select a site…' })}
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-content-secondary">
          <span>{t('field_reports.date', { defaultValue: 'Date' })}</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            required
            className="w-full rounded-md border border-border-light px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-content-secondary">
        <span>{t('field_reports.notes', { defaultValue: 'Notes' })}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required
          rows={3}
          placeholder={t('field_reports.notes_placeholder', { defaultValue: "What happened on site today?" }) ?? ''}
          className="w-full rounded-md border border-border-light px-2 py-1.5 text-sm"
        />
      </label>
      <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending} icon={mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : undefined}>
        {t('common.save', { defaultValue: 'Save' })}
      </Button>
    </form>
  );
}

function ReportRow({ report }: { report: FieldReportSummary }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useQuery({
    queryKey: ['field-report-detail', report.id],
    queryFn: () => getFieldReport(report.id),
    enabled: expanded,
  });

  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-content-primary">{report.site_name}</span>
            <span className="text-2xs text-content-tertiary">{report.report_date}</span>
          </div>
          <p className="mt-1 truncate text-xs text-content-secondary">{report.notes}</p>
        </div>
        {expanded ? <ChevronUp size={14} className="shrink-0 text-content-tertiary" /> : <ChevronDown size={14} className="shrink-0 text-content-tertiary" />}
      </button>
      {expanded && (
        <div className="border-t border-border-light px-4 py-3">
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-surface-secondary" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-content-secondary">
                  <Users size={13} />
                  {t('field_reports.workforce', { defaultValue: 'Workforce (clocked in that day)' })}
                </div>
                {detail && detail.workforce.length > 0 ? (
                  <ul className="space-y-0.5 text-xs text-content-primary">
                    {detail.workforce.map((w) => (
                      <li key={w.crew_member_id}>{w.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-content-quaternary">{t('field_reports.no_workforce', { defaultValue: 'No one clocked in at this site that day.' })}</p>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-content-secondary">
                  <Truck size={13} />
                  {t('field_reports.equipment', { defaultValue: 'Equipment (on site that day)' })}
                </div>
                {detail && detail.equipment.length > 0 ? (
                  <ul className="space-y-0.5 text-xs text-content-primary">
                    {detail.equipment.map((e) => (
                      <li key={e.vehicle_id}>{e.plate}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-2xs text-content-quaternary">{t('field_reports.no_equipment', { defaultValue: 'No vehicle telemetry near this site that day.' })}</p>
                )}
              </div>
              {detail?.author_name && (
                <p className="text-2xs text-content-quaternary sm:col-span-2">
                  {t('field_reports.authored_by', { defaultValue: 'Logged by {{name}}', name: detail.author_name })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldReportsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['field-reports'], queryFn: () => listFieldReports(), retry: false });
  const reports = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader
        srTitle={t('nav.field_reports', { defaultValue: 'Field Reports' })}
        subtitle={t('field_reports.subtitle', { defaultValue: 'Daily site notes, with workforce and equipment derived from real timeclock and telemetry data.' })}
      />

      <NewReportForm />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border-light bg-surface-secondary" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border-light bg-surface-elevated p-8 text-center">
          <ClipboardList size={24} className="mx-auto mb-2 text-content-quaternary" />
          <p className="text-sm font-medium text-content-secondary">{t('field_reports.empty_title', { defaultValue: 'No field reports yet' })}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}

export default FieldReportsPage;
