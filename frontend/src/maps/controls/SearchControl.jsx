import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Client-side search over the already-loaded station list (name/code
 * substring match) — no external/paid geocoding API. Selecting a result
 * pans+zooms the main map to that station via the raw Leaflet `Map`
 * instance passed in as `map`.
 */
export default function SearchControl({ stations = [], map, onSelect, className = "" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stations
      .filter((s) => {
        const name = (s.station_name || "").toLowerCase();
        const code = (s.station_code || "").toLowerCase();
        return name.includes(q) || code.includes(q);
      })
      .slice(0, 8);
  }, [query, stations]);

  const goTo = (s) => {
    if (map && s.latitude && s.longitude) {
      map.flyTo([s.latitude, s.longitude], Math.max(map.getZoom(), 11), { duration: 0.75 });
    }
    onSelect?.(s);
    setQuery(s.station_name || s.station_code || "");
    setOpen(false);
  };

  const clear = () => {
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={`glass-panel w-64 rounded-xl border border-slate-200 shadow-lg dark:border-slate-800/70 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search stations…"
          className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto border-t border-slate-200 py-1 dark:border-slate-800/70">
          {results.map((s) => (
            <li key={`${s.kind}-${s.station_id}`}>
              <button
                type="button"
                onClick={() => goTo(s)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{s.station_name || s.station_code}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-500">
                  {s.district || "—"} · {s.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query && results.length === 0 && (
        <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800/70 dark:text-slate-500">
          No stations match "{query}"
        </div>
      )}
    </div>
  );
}
