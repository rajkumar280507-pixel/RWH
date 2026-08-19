const TONES = {
  accent: { border: "border-accent/30", text: "text-accent", glow: "bg-accent/5" },
  blue: { border: "border-accent-blue/30", text: "text-accent-blue", glow: "bg-accent-blue/5" },
  amber: { border: "border-amber-400/30", text: "text-amber-300", glow: "bg-amber-400/5" },
  rose: { border: "border-rose-400/30", text: "text-rose-300", glow: "bg-rose-400/5" },
  purple: { border: "border-purple-400/30", text: "text-purple-300", glow: "bg-purple-400/5" },
  slate: { border: "border-slate-700", text: "text-slate-300", glow: "bg-slate-500/5" },
};

export default function StatCard({ label, value, unit, tone = "accent", subtext, loading = false, icon }) {
  const t = TONES[tone] ?? TONES.accent;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${t.border} bg-panel/70 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-opacity-60 hover:shadow-md`}
    >
      <div className={`pointer-events-none absolute inset-0 ${t.glow}`} />
      <div className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
          {icon && (
            <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-slate-950/40 text-xs ${t.text}`}>
              {icon}
            </span>
          )}
        </div>
        {loading ? (
          <span className="h-7 w-20 animate-pulse rounded bg-slate-700/50" />
        ) : (
          <span className="text-2xl font-semibold leading-none text-slate-50">
            {value ?? <span className="text-slate-600">—</span>}
            {unit && value != null && <span className={`ml-1 text-sm font-normal ${t.text}`}>{unit}</span>}
          </span>
        )}
        {subtext && <span className="text-[10px] text-slate-500">{subtext}</span>}
      </div>
    </div>
  );
}
