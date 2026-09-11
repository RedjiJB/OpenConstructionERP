// Sod Boys Field Ops — custom landing page.
//
// Task #156's frontend-pruning pass replaces the vendored DashboardPage
// here rather than adapting it: DashboardPage is built around a
// per-project widget system (KPI strips, BIM coverage, RFI turnaround,
// finance summaries) that assumes a real Projects module this backend
// doesn't have. Adapting it would mean gutting most of its own code:
// simpler and more honest to build a small page of our own that names
// exactly the 8 modules this façade actually backs.
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Bell, Package, Timer, Truck, Users, Wallet, Warehouse, ShieldCheck, Map, MapPin, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/shared/ui';
import { DashboardMapWeather } from '@/features/dashboard/components/DashboardMapWeather';
import { SystemStatusCard } from '@/features/dashboard/components/SystemStatusCard';
import { RecentActivityCard } from '@/features/dashboard/components/RecentActivityCard';
import { InboxCard } from '@/features/dashboard/components/InboxCard';
import { SiteCardsSection } from '@/features/dashboard/components/SiteCardsSection';

interface ModuleCard {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const MODULES: ModuleCard[] = [
  { to: '/equipment', icon: Truck, title: 'Equipment & Fleet', description: 'Vehicles and their latest known location.' },
  { to: '/resources', icon: Users, title: 'Resources & Crew', description: 'Everyone on the crew, at a glance.' },
  { to: '/field-time', icon: Timer, title: 'Field Time', description: "Today's clocked hours, derived from the timeclock." },
  { to: '/site-inventory', icon: Warehouse, title: 'Site Inventory', description: 'Consumables on hand and their stock levels.' },
  { to: '/procurement', icon: Package, title: 'Procurement', description: 'Purchase orders, from draft to fulfilled.' },
  { to: '/payroll', icon: Wallet, title: 'Payroll', description: "This period's hours and pay, reconciled live." },
  { to: '/teams', icon: ShieldCheck, title: 'Teams and visibility', description: 'The crew, grouped.' },
  { to: '/map', icon: Map, title: 'Map', description: 'Crew and equipment, plotted from logged locations.' },
  { to: '/notifications', icon: Bell, title: 'Notifications', description: 'Alerts raised by the exceptions engine.' },
];

// Dashboard restoration, Slice N: real quick actions, not the vendored
// New Project / New Estimate / Quick Start CTAs (all BOQ/estimate
// concepts with no FieldOps equivalent). No "Customize" toggle either --
// that opened a drag/reorder layout editor the user never asked for,
// and it sits too close to the "Customize logo" white-label editor
// already removed by explicit request earlier in this project.
export default function HomePage() {
  const userFullName = useAuthStore((s) => s.userFullName);
  const greetingName = userFullName?.trim() || 'there';
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-[1600px] p-6 sm:p-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">
            Welcome back, {greetingName}
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            Sod Boys Field Ops — the modules below are backed by real crew, equipment and timeclock data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" icon={<MapPin size={16} />} onClick={() => navigate('/map')}>
            Check in
          </Button>
          <Button variant="secondary" size="md" icon={<ShoppingCart size={15} />} onClick={() => navigate('/procurement')}>
            New purchase order
          </Button>
        </div>
      </div>

      <SiteCardsSection />

      {/* Map widget on its own full-width row -- it was previously sharing
          a row with System Status/Inbox in a 2fr/1fr split, which left it
          too narrow once real site counts pushed the weather panel wider,
          causing internal horizontal overflow. */}
      <div className="mb-6">
        <DashboardMapWeather />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SystemStatusCard />
        <InboxCard />
      </div>

      <div className="mb-6">
        <RecentActivityCard />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.map(({ to, icon: Icon, title, description }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-5 transition-colors hover:bg-surface-secondary"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-oe-blue/10 text-oe-blue">
              <Icon size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-content-primary">{title}</div>
              <div className="mt-1 text-xs text-content-secondary">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
