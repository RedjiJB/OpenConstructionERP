// Dashboard restoration, Slice I: right-side companion to the sites map.
// The vendored version grouped "projects" by city (several projects can
// share one city) and resolved coordinates through a shared geocode
// cache, since a project has no native location. A FieldOps site IS the
// location -- one row per site, using its own real lat/lng directly, no
// grouping or geocoding needed.
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { ProjectWeather } from '@/shared/ui/ProjectWeather/ProjectWeather';
import type { Site } from '../api';

interface DashboardSitesPanelProps {
  sites: Site[];
}

export function DashboardSitesPanel({ sites }: DashboardSitesPanelProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Six sites fill a 3-row, 2-column grid without an inner scrollbar,
  // matching the vendored layout's cap.
  const shown = sites.slice(0, 6);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-surface-elevated/90">
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <span className="text-xs font-semibold text-content-primary">
          {t('dashboard.sites_title', { defaultValue: 'Sites & weather' })}
        </span>
        <span className="text-[10px] tabular-nums text-content-tertiary">{sites.length}</span>
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-hidden p-3">
        {shown.map((site) => {
          const hasCoords = Number.isFinite(site.lat) && Number.isFinite(site.lng);
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => navigate('/map')}
              className="group flex min-w-0 flex-col justify-center gap-2 rounded-lg border border-border-light bg-surface-primary/50 px-3 py-2.5 text-left transition-colors hover:border-oe-blue/40 hover:bg-surface-primary"
            >
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-oe-blue/10 text-oe-blue">
                  <MapPin size={11} />
                </span>
                <span className="truncate text-xs font-semibold text-content-primary" title={site.name}>{site.name}</span>
              </span>
              {hasCoords ? (
                <ProjectWeather
                  lat={site.lat as number}
                  lng={site.lng as number}
                  locale={i18n.language}
                  variant="summary"
                  className="pl-6"
                />
              ) : (
                <span className="pl-6 text-[10px] text-content-quaternary">
                  {t('dashboard.sites_no_location', { defaultValue: 'No location set' })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
