import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Droplets,
  FileText,
  TrendingUp,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Header from "../components/Header.jsx";
import CommandPalette from "../components/ui/CommandPalette.jsx";
import Breadcrumbs from "../components/ui/Breadcrumbs.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useUiStore } from "../store/uiStore.js";
import { useLiveSocket } from "../hooks/useLiveSocket.js";
import { useClock } from "../hooks/useClock.js";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, hint: "Live overview" },
  { label: "GIS Map", to: "/gis-map", icon: Map, hint: "Station network" },
  { label: "Recharge Design", to: "/rwh-design", icon: Droplets, hint: "Design a structure" },
  { label: "Reports", to: "/reports", icon: FileText, hint: "Saved designs" },
  { label: "Predictions", to: "/predictions", icon: TrendingUp, hint: "Forecast trends" },
];

export default function DashboardLayout({ children, title, subtitle, actions, contentClassName }) {
  const location = useLocation();
  const currentPage = NAV_ITEMS.find((i) => i.to === location.pathname);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const breadcrumbItems = [
    { label: "RWH-DSS", href: "/" },
    ...(currentPage && currentPage.to !== "/" ? [{ label: currentPage.label }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface transition-colors">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Light, white nav rail against the light workspace — a clean
            SaaS-dashboard pattern (blue active-state pill + left accent bar)
            rather than a dark navy rail. Collapsible between an icon-only
            w-16 rail and the full w-56 rail; state persisted via
            uiStore.sidebarCollapsed. */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-200 bg-panel transition-[width] duration-200 ease-out md:flex print:hidden ${
            sidebarCollapsed ? "w-16" : "w-56"
          }`}
        >
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-3">
            {!sidebarCollapsed && (
              <span className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Navigation
              </span>
            )}
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.label}
                {...item}
                active={location.pathname === item.to}
                collapsed={sidebarCollapsed}
              />
            ))}
          </div>

          {!sidebarCollapsed && (
            <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-brand to-brandCyan px-3.5 py-3 text-[10px] leading-relaxed text-white/90 shadow-sm">
              <div className="mb-1 text-[11px] font-semibold text-white">Engineering defaults</div>
              Follows CGWB / CPHEEO practice. All outputs require site-specific verification
              before construction.
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            className="flex items-center justify-center gap-2 border-t border-slate-200 py-3 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span className="text-[11px] font-medium">Collapse</span>
              </>
            )}
          </button>
        </aside>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {(title || actions) && (
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-panel/20 px-3 py-1.5 print:hidden dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-2">
              <div className="min-w-0">
                <Breadcrumbs items={breadcrumbItems} className="mb-0.5" />
                {title && (
                  <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-base">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-0.5 max-w-3xl text-[11px] leading-tight text-slate-500">{subtitle}</p>
                )}
              </div>
              {actions}
            </div>
          )}
          <div className={contentClassName ?? "mx-auto max-w-[1800px] p-2 sm:p-3"}>{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar — sidebar is hidden below md, so this is the only nav on phones/tablets */}
      <nav className="fixed bottom-0 left-0 right-0 z-[500] flex border-t border-slate-200 bg-panel/95 backdrop-blur print:hidden dark:border-slate-800 md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-brand" : "text-slate-500"
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

function NavItem({ label, to, icon: Icon, hint, active, collapsed }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="group relative"
    >
      {active && (
        <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
      )}
      <Link
        to={to}
        className={`flex items-center rounded-xl py-2.5 text-[13px] font-medium transition ${
          collapsed ? "justify-center px-0" : "gap-2.5 px-3"
        } ${
          active ? "bg-brand/10 text-brand" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-brand text-white shadow-sm" : "opacity-80"
          }`}
        >
          <Icon size={15} />
        </span>
        {!collapsed && <span>{label}</span>}
      </Link>

      {/* Hover tooltip — only needed in icon-only (collapsed) mode, since the
          label is already visible when expanded. CSS-only group-hover,
          matching the lightweight animation style already used elsewhere. */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 z-[600] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
          {label}
          <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{hint}</span>
        </div>
      )}
    </motion.div>
  );
}

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="glass-panel absolute right-0 top-full z-[600] mt-2 w-72 overflow-hidden rounded-xl shadow-2xl"
          >
            <div className="border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-800/60 dark:text-slate-200">
              Notifications
            </div>
            {/* Visual-only — there is no backend notification feed. Being
                upfront about that here rather than fabricating one. */}
            <EmptyState
              icon={<Bell size={16} />}
              title="No new notifications"
              description="There's no live notification feed wired up yet — this panel is a placeholder for now."
              className="border-none bg-transparent px-4 py-6"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
