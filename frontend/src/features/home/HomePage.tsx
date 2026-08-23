// Sod Boys Field Ops — custom landing page.
//
// Task #156's frontend-pruning pass replaces the vendored DashboardPage
// here rather than adapting it: DashboardPage is built around a
// per-project widget system (KPI strips, BIM coverage, RFI turnaround,
// finance summaries) that assumes a real Projects module this backend
// doesn't have. Adapting it would mean gutting most of its own code:
// simpler and more honest to build a small page of our own that names
// exactly the 8 modules this façade actually backs.
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Bell, Package, Timer, Truck, Users, Wallet, Warehouse, ShieldCheck, Map } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

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

export default function HomePage() {
  const userFullName = useAuthStore((s) => s.userFullName);
  const greetingName = userFullName?.trim() || 'there';

  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-content-primary">
          Welcome back, {greetingName}
        </h1>
        <p className="mt-1 text-sm text-content-secondary">
          Sod Boys Field Ops — the modules below are backed by real crew, equipment and timeclock data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
