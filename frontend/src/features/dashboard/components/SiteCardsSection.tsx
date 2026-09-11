// Dashboard restoration, Slice M: self-fetching section, same pattern as
// DashboardMapWeather -- the caller just drops it in. No "view all"
// tile: sites have no dedicated list/detail page to open (they only
// ever surface on the map), unlike the vendored dashboard's projects
// section which linked to a real /projects page.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listSites } from '../api';
import { SiteCard } from './SiteCard';

export function SiteCardsSection() {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['dashboard-sites'],
    queryFn: () => listSites(),
    staleTime: 60_000,
  });

  const sites = data?.items ?? [];
  if (sites.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-content-primary">
        {t('dashboard.sites_section_title', { defaultValue: 'Sites' })}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
      </div>
    </div>
  );
}
