import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Droplets,
  FileText,
  TrendingUp,
  SunMoon,
  Search,
} from "lucide-react";
import { useUiStore } from "../../store/uiStore.js";

function buildCommands({ navigate, toggleTheme }) {
  return [
    { id: "dashboard", label: "Dashboard", hint: "Live overview", icon: LayoutDashboard, run: () => navigate("/") },
    { id: "gis-map", label: "GIS Map", hint: "Station network", icon: Map, run: () => navigate("/gis-map") },
    { id: "rwh-design", label: "RWH Design", hint: "Design a structure", icon: Droplets, run: () => navigate("/rwh-design") },
    { id: "reports", label: "Reports", hint: "Saved designs", icon: FileText, run: () => navigate("/reports") },
    { id: "predictions", label: "Predictions", hint: "Forecast trends", icon: TrendingUp, run: () => navigate("/predictions") },
    { id: "toggle-theme", label: "Toggle theme", hint: "Switch dark / light", icon: SunMoon, run: () => toggleTheme() },
  ];
}

/**
 * Ctrl+K (Cmd+K on Mac) activated command palette. Global keydown listener
 * lives here so it works from any page once <CommandPalette /> is mounted
 * once at the layout root.
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const openPalette = useUiStore((s) => s.openCommandPalette);
  const closePalette = useUiStore((s) => s.closeCommandPalette);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const commands = useMemo(() => buildCommands({ navigate, toggleTheme }), [navigate, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Global Ctrl/Cmd+K toggle + Escape close.
  useEffect(() => {
    function onKeyDown(e) {
      const isK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === "Escape") {
        closePalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette, closePalette]);

  // Reset transient state whenever the palette opens, and autofocus the input.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function activate(index) {
    const cmd = filtered[index];
    if (!cmd) return;
    cmd.run();
    closePalette();
  }

  function onInputKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(activeIndex);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-start justify-center bg-slate-950/60 px-4 pt-[12vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={closePalette}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="glass-panel w-full max-w-lg overflow-hidden rounded-xl shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-800/80 px-4 py-3">
              <Search size={16} className="shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Jump to a page or run an action…"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <kbd className="hidden shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
                Esc
              </kbd>
            </div>

            <ul className="max-h-80 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-slate-500">No matches.</li>
              )}
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon;
                const active = i === activeIndex;
                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => activate(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        active ? "bg-accent/15 text-slate-100" : "text-slate-300 hover:bg-panel/60"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-accent" : "text-slate-500"} />
                      <span className="flex-1">{cmd.label}</span>
                      <span className="text-[11px] text-slate-500">{cmd.hint}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
