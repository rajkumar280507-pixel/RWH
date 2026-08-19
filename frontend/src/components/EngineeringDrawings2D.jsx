import { useState } from "react";

export default function EngineeringDrawings2D({ result }) {
  const [view, setView] = useState("cross_section");

  if (!result) return null;

  const pit = result.pit || {};
  const trench = result.trench || {};
  const isTrench = Boolean(trench.length_m);
  const isInjectionBore = Boolean(result.injection_borewell || result.groundwater_depth_m > 8 || result.hydrologic_soil_group === "C" || result.hydrologic_soil_group === "D");

  const dia = pit.diameter_m || 2.0;
  const depth = pit.depth_m || trench.depth_m || 2.5;
  const width = trench.width_m || 1.0;
  const length = trench.length_m || 12.0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-xs text-slate-200 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="text-accent">📐</span> 2D Technical Engineering CAD Drawings
          </h3>
          <p className="text-[11px] text-slate-400">
            IS 15797:2008 & CGWB Technical Guidelines · Scale 1:50 · Metric (m / mm)
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1">
          <TabBtn id="cross_section" label="Cross Section A-A" active={view} set={setView} />
          <TabBtn id="plan_view" label="Plan View (Top)" active={view} set={setView} />
          <TabBtn id="exploded_filter" label="Filter Stack" active={view} set={setView} />
          <TabBtn id="pipe_layout" label="First Flush & Silt Trap" active={view} set={setView} />
          {isInjectionBore && <TabBtn id="deep_bore" label="Deep Injection Bore" active={view} set={setView} />}
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative flex justify-center overflow-x-auto rounded-lg border border-slate-800 bg-[#070d19] p-4">
        {/* Compass & Scale Overlay */}
        <div className="absolute left-4 top-4 flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-1">
            <span className="font-bold text-amber-400">N</span> ▲
          </div>
          <span>SCALE 1:50</span>
          <span>DIMENSIONS IN METERS</span>
        </div>

        <div className="absolute right-4 top-4 text-right text-[10px] text-slate-500 font-mono">
          <div>PROJECT: RTRWH RECHARGE SYSTEM</div>
          <div className="font-bold text-accent">STRUCTURE: {isTrench ? "RECHARGE TRENCH" : "MEDIA RECHARGE PIT"}</div>
          {isInjectionBore && <div className="text-rose-400 font-semibold">WITH DEEP INJECTION BOREWELL</div>}
        </div>

        {/* View Renderers */}
        {view === "cross_section" && (
          <CrossSectionSvg dia={dia} depth={depth} isTrench={isTrench} width={width} isInjectionBore={isInjectionBore} />
        )}
        {view === "plan_view" && (
          <PlanViewSvg dia={dia} length={length} width={width} isTrench={isTrench} />
        )}
        {view === "exploded_filter" && <ExplodedFilterSvg depth={depth} />}
        {view === "pipe_layout" && <PipeLayoutSvg />}
        {view === "deep_bore" && <DeepBoreSvg depth={depth} gwDepth={result.groundwater_depth_m || 10} />}
      </div>

      {/* Material Specifications & Engineering Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px]">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-accent">Filter Media Layer Specs</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
            <li>• Top (25%): Coarse Sand (1.5–2.0 mm, Porosity ~0.35)</li>
            <li>• Middle (25%): Graded Gravel (5–10 mm, Porosity ~0.40)</li>
            <li>• Bottom (50%): Boulders (50–200 mm, Porosity ~0.45)</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-amber-400">Construction Tolerances</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
            <li>• Pit Excavation side slope 1:0.5 (safe batter)</li>
            <li>• Inspection Chamber masonry: 230mm brickwork</li>
            <li>• Perforated pipe slot width: 3mm at 50mm spacing</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-emerald-400">Regulatory Compliance</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
            <li>• Code: IS 15797:2008 & CGWB RTRWH Code</li>
            <li>• Separation: ≥3.0m above seasonal water table</li>
            <li>• First Flush Diversion: 0.5 mm over catchment</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ id, label, active, set }) {
  return (
    <button
      onClick={() => set(id)}
      className={`rounded px-3 py-1 text-[11px] font-medium transition ${
        active === id ? "bg-accent/20 text-accent border border-accent/30" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SVG Drawing Sub-components (CAD Style)
// ---------------------------------------------------------------------------

function CrossSectionSvg({ dia, depth, isTrench, width, isInjectionBore }) {
  return (
    <svg width="600" height="420" viewBox="0 0 600 420" className="font-mono text-[10px]">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
        <pattern id="sand" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill="#f59e0b" opacity="0.6" />
          <circle cx="6" cy="6" r="0.8" fill="#d97706" opacity="0.6" />
        </pattern>
        <pattern id="gravel" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2" fill="#94a3b8" opacity="0.7" />
          <circle cx="9" cy="9" r="1.5" fill="#64748b" opacity="0.7" />
        </pattern>
      </defs>

      {/* Background Grid */}
      <rect width="600" height="420" fill="url(#grid)" />

      {/* Ground Surface Line */}
      <line x1="40" y1="90" x2="560" y2="90" stroke="#10b981" strokeWidth="2" strokeDasharray="6 3" />
      <text x="50" y="82" fill="#10b981" fontWeight="bold">GL (GROUND LEVEL 0.00m)</text>

      {/* Pit Outer Excavation */}
      <polygon points="170,90 200,340 400,340 430,90" fill="#0f172a" stroke="#334155" strokeWidth="2" />

      {/* Filter Layer 1: Coarse Sand (Top 25%) */}
      <polygon points="173,90 180,150 420,150 427,90" fill="url(#sand)" stroke="#d97706" strokeWidth="1" opacity="0.8" />
      <text x="300" y="125" textAnchor="middle" fill="#fbbf24" fontWeight="bold">COARSE SAND (1.5-2.0mm) — 25%</text>

      {/* Filter Layer 2: Graded Gravel (Middle 25%) */}
      <polygon points="180,150 188,210 412,210 420,150" fill="url(#gravel)" stroke="#64748b" strokeWidth="1" />
      <text x="300" y="185" textAnchor="middle" fill="#cbd5e1" fontWeight="bold">GRADED GRAVEL (5-10mm) — 25%</text>

      {/* Filter Layer 3: Boulders (Bottom 50%) */}
      <polygon points="188,210 200,340 400,340 412,210" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      <text x="300" y="270" textAnchor="middle" fill="#94a3b8" fontWeight="bold">BOULDERS / COARSE AGGREGATE (50-200mm) — 50%</text>

      {/* Deep Injection Borewell (if triggered) */}
      {isInjectionBore && (
        <g>
          <rect x="290" y="220" width="20" height="170" fill="#0284c7" opacity="0.3" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
          <line x1="300" y1="220" x2="300" y2="390" stroke="#38bdf8" strokeWidth="2" />
          <text x="320" y="370" fill="#38bdf8" fontWeight="bold">DEEP SLOTTED BORE (PVC 150mm)</text>
        </g>
      )}

      {/* Inlet Pipe */}
      <rect x="40" y="60" width="160" height="15" fill="#0284c7" rx="3" />
      <text x="70" y="52" fill="#38bdf8">INLET PIPE (110mm PVC)</text>
      <path d="M 190 75 Q 210 80 220 100" fill="none" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow)" />

      {/* Dimension Lines */}
      {/* Depth Dimension */}
      <line x1="460" y1="90" x2="460" y2="340" stroke="#f59e0b" strokeWidth="1.5" />
      <line x1="453" y1="90" x2="467" y2="90" stroke="#f59e0b" strokeWidth="1.5" />
      <line x1="453" y1="340" x2="467" y2="340" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="475" y="220" fill="#f59e0b" fontWeight="bold">DEPTH {depth}m</text>

      {/* Diameter / Width Dimension */}
      <line x1="170" y1="365" x2="430" y2="365" stroke="#2dd4bf" strokeWidth="1.5" />
      <line x1="170" y1="358" x2="170" y2="372" stroke="#2dd4bf" strokeWidth="1.5" />
      <line x1="430" y1="358" x2="430" y2="372" stroke="#2dd4bf" strokeWidth="1.5" />
      <text x="300" y="382" textAnchor="middle" fill="#2dd4bf" fontWeight="bold">
        {isTrench ? `WIDTH ${width}m × LENGTH ${length}m` : `DIAMETER ${dia}m`}
      </text>

      {/* Title block */}
      <text x="300" y="410" textAnchor="middle" fill="#64748b">CROSS SECTION A-A — RECHARGE PIT ELEVATION</text>
    </svg>
  );
}

function PlanViewSvg({ dia, length, width, isTrench }) {
  return (
    <svg width="550" height="380" viewBox="0 0 550 380" className="font-mono text-[10px]">
      <rect width="550" height="380" fill="#070d19" />
      
      {/* Center Grid Lines */}
      <line x1="275" y1="30" x2="275" y2="330" stroke="#334155" strokeWidth="1" strokeDasharray="8 4" />
      <line x1="50" y1="180" x2="500" y2="180" stroke="#334155" strokeWidth="1" strokeDasharray="8 4" />

      {isTrench ? (
        <rect x="120" y="120" width="310" height="120" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2.5" rx="6" />
      ) : (
        <circle cx="275" cy="180" r="110" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2.5" />
      )}

      {/* Inner Chamber */}
      <circle cx="275" cy="180" r="30" fill="#1e293b" stroke="#0284c7" strokeWidth="2" />
      <text x="275" y="184" textAnchor="middle" fill="#38bdf8" fontWeight="bold">SILT TRAP</text>

      {/* Inlet & Overflow Pipe Layout */}
      <line x1="60" y1="180" x2="245" y2="180" stroke="#38bdf8" strokeWidth="3" />
      <text x="110" y="170" fill="#38bdf8">INLET PIPE (PVC 110mm)</text>

      <line x1="305" y1="180" x2="490" y2="180" stroke="#f43f5e" strokeWidth="3" strokeDasharray="4 2" />
      <text x="410" y="170" fill="#f43f5e">OVERFLOW TO DRAIN</text>

      {/* Plan Dimensions */}
      <text x="275" y="320" textAnchor="middle" fill="#2dd4bf" fontWeight="bold">
        {isTrench ? `TRENCH PLAN: ${width}m WIDE × ${length}m LONG` : `CIRCULAR RECHARGE PIT: Ø ${dia}m`}
      </text>
      <text x="275" y="360" textAnchor="middle" fill="#64748b">TOP PLAN VIEW — SITE LAYOUT & PIPE CONNECTIONS</text>
    </svg>
  );
}

function ExplodedFilterSvg({ depth }) {
  return (
    <svg width="550" height="380" viewBox="0 0 550 380" className="font-mono text-[10px]">
      <rect width="550" height="380" fill="#070d19" />

      {/* Layer 1: Coarse Sand */}
      <g transform="translate(100, 30)">
        <rect x="0" y="0" width="350" height="70" fill="#78350f" stroke="#f59e0b" strokeWidth="2" rx="4" />
        <text x="175" y="35" textAnchor="middle" fill="#fbbf24" fontWeight="bold">LAYER 1: COARSE SAND (1.5–2.0 mm) — TOP 25%</text>
        <text x="175" y="52" textAnchor="middle" fill="#d97706">Acts as fine silt & debris filter · Porosity 35%</text>
      </g>

      {/* Connector */}
      <line x1="275" y1="100" x2="275" y2="130" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />

      {/* Layer 2: Graded Gravel */}
      <g transform="translate(100, 130)">
        <rect x="0" y="0" width="350" height="70" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" rx="4" />
        <text x="175" y="35" textAnchor="middle" fill="#e2e8f0" fontWeight="bold">LAYER 2: GRADED GRAVEL (5–10 mm) — MIDDLE 25%</text>
        <text x="175" y="52" textAnchor="middle" fill="#94a3b8">Intermediate drainage buffer · Porosity 40%</text>
      </g>

      {/* Connector */}
      <line x1="275" y1="200" x2="275" y2="230" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 2" />

      {/* Layer 3: Coarse Boulders */}
      <g transform="translate(100, 230)">
        <rect x="0" y="0" width="350" height="90" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" rx="4" />
        <text x="175" y="40" textAnchor="middle" fill="#60a5fa" fontWeight="bold">LAYER 3: BOULDERS / AGGREGATE (50–200 mm) — BOTTOM 50%</text>
        <text x="175" y="60" textAnchor="middle" fill="#3b82f6">High void ratio storage & rapid infiltration · Porosity 45%</text>
      </g>

      <text x="275" y="360" textAnchor="middle" fill="#64748b">EXPLODED FILTER MEDIA STACK VIEW (IS 15797:2008)</text>
    </svg>
  );
}

function PipeLayoutSvg() {
  return (
    <svg width="550" height="380" viewBox="0 0 550 380" className="font-mono text-[10px]">
      <rect width="550" height="380" fill="#070d19" />

      {/* Roof Downpipe */}
      <rect x="60" y="40" width="20" height="180" fill="#0284c7" rx="3" />
      <text x="70" y="30" textAnchor="middle" fill="#38bdf8">ROOF DOWNPIPE</text>

      {/* First Flush Unit */}
      <rect x="120" y="140" width="70" height="120" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" rx="4" />
      <text x="155" y="160" textAnchor="middle" fill="#fbbf24" fontWeight="bold">FIRST FLUSH</text>
      <text x="155" y="180" textAnchor="middle" fill="#d97706">0.5mm Diverter</text>

      {/* Silt Trap / Inspection Chamber */}
      <rect x="250" y="120" width="100" height="140" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" rx="4" />
      <text x="300" y="150" textAnchor="middle" fill="#2dd4bf" fontWeight="bold">SILT TRAP</text>
      <text x="300" y="170" textAnchor="middle" fill="#94a3b8">Baffle Chamber</text>

      {/* Recharge Pit Outlet */}
      <rect x="410" y="140" width="90" height="100" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" rx="4" />
      <text x="455" y="170" textAnchor="middle" fill="#60a5fa" fontWeight="bold">RECHARGE PIT</text>

      {/* Connecting Lines */}
      <path d="M 80 160 L 120 160" stroke="#38bdf8" strokeWidth="3" />
      <path d="M 190 160 L 250 160" stroke="#38bdf8" strokeWidth="3" />
      <path d="M 350 160 L 410 160" stroke="#38bdf8" strokeWidth="3" />

      <text x="275" y="360" textAnchor="middle" fill="#64748b">FIRST FLUSH, SILT TRAP & PIPE LAYOUT SCHEMATIC</text>
    </svg>
  );
}

function DeepBoreSvg({ depth, gwDepth }) {
  return (
    <svg width="550" height="380" viewBox="0 0 550 380" className="font-mono text-[10px]">
      <rect width="550" height="380" fill="#070d19" />

      {/* Surface Seal */}
      <rect x="210" y="40" width="130" height="25" fill="#334155" stroke="#f8fafc" strokeWidth="1.5" />
      <text x="275" y="57" textAnchor="middle" fill="#f8fafc" fontWeight="bold">SANITE SEAL / CONCRETE</text>

      {/* Outer Chamber */}
      <rect x="230" y="65" width="90" height="90" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" />
      <text x="275" y="100" textAnchor="middle" fill="#2dd4bf">INSPECTION CHAMBER</text>

      {/* Deep Bore Casing */}
      <rect x="260" y="155" width="30" height="170" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 2" />
      <text x="275" y="240" textAnchor="middle" fill="#ffffff" fontWeight="bold" transform="rotate(-90 275 240)">
        SLOTTED PVC CASING (150mm Ø)
      </text>

      {/* Water Table Line */}
      <line x1="50" y1="300" x2="500" y2="300" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 3" />
      <text x="60" y="292" fill="#38bdf8" fontWeight="bold">WATER TABLE ({gwDepth}m bgl)</text>

      <text x="275" y="360" textAnchor="middle" fill="#64748b">DEEP RECHARGE / INJECTION BOREWELL SCHEMATIC (CGWB CODE)</text>
    </svg>
  );
}
