import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Map, Droplets, FileText, TrendingUp, Search } from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle.jsx";
import CommandPalette from "../components/ui/CommandPalette.jsx";
import Breadcrumbs from "../components/ui/Breadcrumbs.jsx";
import { useUiStore } from "../store/uiStore.js";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, hint: "Live overview" },
  { label: "GIS Map", to: "/gis-map", icon: Map, hint: "Station network" },
  { label: "RWH Design", to: "/rwh-design", icon: Droplets, hint: "Design a structure" },
  { label: "Reports", to: "/reports", icon: FileText, hint: "Saved designs" },
  { label: "Predictions", to: "/predictions", icon: TrendingUp, hint: "Forecast trends" },
];

export default function DashboardLayout({ children, title, subtitle, actions }) {
  const location = useLocation();
  const currentPage = NAV_ITEMS.find((i) => i.to === location.pathname);
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? navigator.userAgent);

  const breadcrumbItems = [
    { label: "RWH-DSS", href: "/" },
    ...(currentPage && currentPage.to !== "/" ? [{ label: currentPage.label }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface transition-colors dark:bg-surface">
      <header className="sticky top-0 z-[500] flex h-14 items-center justify-between border-b border-slate-800 bg-panel/90 px-3 backdrop-blur print:hidden dark:border-slate-800 dark:bg-panel/90 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-blue text-sm font-bold text-slate-950 shadow sm:h-9 sm:w-9 sm:text-base">
            💧
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-bold tracking-tight text-slate-50 sm:text-base">RWH-DSS</span>
            <span className="hidden truncate text-[10px] text-slate-500 sm:inline">
              Rooftop Rainwater Harvesting Decision Support System
            </span>
          </div>
          {currentPage && (
            <>
              <span className="hidden h-5 w-px bg-slate-700 md:inline-block" />
              <span className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
                <currentPage.icon size={14} className="text-accent" />
                {currentPage.label}
              </span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={openCommandPalette}
            className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-panel/60 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 dark:border-slate-800 dark:bg-panel/60 sm:flex"
            title="Open command palette"
          >
            <Search size={13} />
            <span>Search…</span>
            <kbd className="ml-1 rounded border border-slate-700 px-1 text-[10px] text-slate-500">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-panel/60 text-slate-400 transition hover:border-slate-700 hover:text-slate-200 dark:border-slate-800 dark:bg-panel/60 sm:hidden"
            title="Open command palette"
            aria-label="Open command palette"
          >
            <Search size={14} />
          </button>

          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 sm:gap-2 sm:px-3 sm:text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
            <span className="hidden sm:inline">CGWB · NWDP Live Telemetry</span>
            <span className="sm:hidden">Live</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-800 bg-panel/30 p-3 dark:border-slate-800 dark:bg-panel/30 md:flex print:hidden">
          <span className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Navigation
          </span>
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} {...item} active={location.pathname === item.to} />
          ))}
          <div className="mt-auto rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5 text-[10px] leading-relaxed text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/40">
            Engineering defaults follow CGWB / CPHEEO practice. All outputs require
            site-specific verification before construction.
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {(title || actions) && (
            <div className="flex flex-col gap-3 border-b border-slate-800/60 bg-panel/20 px-3 py-3 print:hidden dark:border-slate-800/60 dark:bg-panel/20 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-4">
              <div className="min-w-0">
                <Breadcrumbs items={breadcrumbItems} className="mb-1.5" />
                {title && <h1 className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">{title}</h1>}
                {subtitle && <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-slate-500">{subtitle}</p>}
              </div>
              {actions}
            </div>
          )}
          <div className="mx-auto max-w-[1600px] p-3 sm:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar — sidebar is hidden below md, so this is the only nav on phones/tablets */}
      <nav className="fixed bottom-0 left-0 right-0 z-[500] flex border-t border-slate-800 bg-panel/95 backdrop-blur print:hidden dark:border-slate-800 dark:bg-panel/95 md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-accent" : "text-slate-500"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette />
    </div>
  );
}

function NavItem({ label, to, icon: Icon, hint, active }) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition ${
        active
          ? "bg-accent/15 text-accent font-semibold"
          : "text-slate-400 hover:bg-panel/60 hover:text-slate-200"
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
      <div className="flex items-center gap-2.5">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${active ? "bg-accent/15" : "opacity-80"}`}>
          <Icon size={14} />
        </span>
        <span>{label}</span>
      </div>
      <span className="text-[10px] text-slate-600 group-hover:text-slate-400">{hint}</span>
    </Link>
  );
}
