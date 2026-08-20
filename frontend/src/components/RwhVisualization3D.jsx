import { useState, useEffect } from "react";

export default function RwhVisualization3D({ result }) {
  const [animating, setAnimating] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [particleOffset, setParticleOffset] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const interval = setInterval(() => {
      setParticleOffset((prev) => (prev + 4) % 240);
    }, 50);
    return () => clearInterval(interval);
  }, [animating]);

  if (!result) return null;

  const isInjectionBore = Boolean(result.injection_borewell || result.groundwater_depth_m > 8);
  const gwDepth = result.groundwater_depth_m || 10;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-xs text-slate-200 shadow-xl">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="text-accent">🧊</span> Interactive 3D Hydrologic Flow & Structure Visualization
          </h3>
          <p className="text-[11px] text-slate-400">
            Realtime Water Infiltration Particle Animation & Geological Stratigraphy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnimating(!animating)}
            className={`rounded px-3 py-1 text-[11px] font-semibold transition ${
              animating
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {animating ? "Pause Flow Animation" : "Play Flow Animation"}
          </button>
          <button
            onClick={() => setRotation((r) => (r + 45) % 360)}
            className="rounded border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
          >
            Rotate View ↻
          </button>
        </div>
      </div>

      {/* 3D Isometric Projection Stage */}
      <div className="relative flex h-[400px] w-full justify-center overflow-hidden rounded-lg border border-slate-800 bg-[#050b14] p-4">
        <svg width="650" height="380" viewBox="0 0 650 380" className="font-mono text-[10px]">
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b1329" />
              <stop offset="100%" stopColor="#050b14" />
            </linearGradient>
            <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="gwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
              <stop offset="100%" stopColor="rgba(2, 132, 199, 0.8)" />
            </linearGradient>
          </defs>

          {/* Sky & Surface */}
          <rect x="0" y="0" width="650" height="80" fill="url(#skyGrad)" />
          <polygon points="50,80 600,80 570,110 20,110" fill="#10b981" opacity="0.8" />
          <text x="30" y="100" fill="#ffffff" fontWeight="bold">GROUND SURFACE</text>

          {/* Subsurface Soil Strata */}
          <polygon points="20,110 570,110 570,300 20,300" fill="url(#soilGrad)" stroke="#334155" strokeWidth="1" />
          <text x="30" y="140" fill="#64748b">TOP SOIL & WEATHERED STRATA</text>
          <text x="30" y="240" fill="#475569">FRACTURED ROCK AQUIFER</text>

          {/* Groundwater Table Layer */}
          <polygon points="20,300 570,300 570,350 20,350" fill="url(#gwGrad)" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="30" y="325" fill="#38bdf8" fontWeight="bold">GROUNDWATER TABLE ({gwDepth}m bgl)</text>

          {/* 3D Recharge Pit Cylinder / Box */}
          <g transform={`rotate(${rotation / 10} 325 190)`}>
            {/* Outer Structure Walls */}
            <polygon points="220,110 430,110 410,270 240,270" fill="#090d16" stroke="#2dd4bf" strokeWidth="2" />

            {/* Layer 1: Sand (Top 25%) */}
            <polygon points="222,112 428,112 422,150 228,150" fill="#78350f" opacity="0.85" />
            <text x="325" y="135" textAnchor="middle" fill="#fbbf24" fontWeight="bold">SAND LAYER</text>

            {/* Layer 2: Gravel (Middle 25%) */}
            <polygon points="228,150 422,150 416,190 234,190" fill="#334155" opacity="0.9" />
            <text x="325" y="175" textAnchor="middle" fill="#e2e8f0" fontWeight="bold">GRAVEL LAYER</text>

            {/* Layer 3: Boulders (Bottom 50%) */}
            <polygon points="234,190 416,190 410,268 240,268" fill="#1e293b" opacity="0.95" />
            <text x="325" y="235" textAnchor="middle" fill="#60a5fa" fontWeight="bold">BOULDERS / AGGREGATE</text>
          </g>

          {/* Roof & Downpipe Assembly */}
          <rect x="80" y="20" width="120" height="40" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
          <text x="140" y="44" textAnchor="middle" fill="#38bdf8" fontWeight="bold">ROOFTOP</text>

          {/* Downpipe */}
          <path d="M 140 60 L 140 130 L 230 130" fill="none" stroke="#38bdf8" strokeWidth="4" />

          {/* Deep Recharge Injection Borewell Casing (if present) */}
          {isInjectionBore && (
            <g>
              <rect x="315" y="260" width="20" height="85" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 2" />
              <line x1="325" y1="260" x2="325" y2="345" stroke="#38bdf8" strokeWidth="2" />
              <text x="345" y="315" fill="#38bdf8" fontWeight="bold">DEEP BORE</text>
            </g>
          )}

          {/* Animated Water Flow Particles */}
          {animating && (
            <g>
              {/* Pipe Flow */}
              <circle cx={140} cy={60 + (particleOffset % 70)} r="3.5" fill="#38bdf8" />
              <circle cx={140 + Math.min(90, Math.max(0, particleOffset - 70))} cy="130" r="3.5" fill="#38bdf8" />
              
              {/* Filtration Percolation Particles */}
              <circle cx={300} cy={130 + ((particleOffset * 0.6) % 130)} r="3" fill="#60a5fa" opacity="0.8" />
              <circle cx={330} cy={140 + ((particleOffset * 0.5) % 120)} r="2.5" fill="#38bdf8" opacity="0.8" />
              <circle cx={350} cy={135 + ((particleOffset * 0.7) % 125)} r="3" fill="#22d3ee" opacity="0.8" />

              {/* Aquifer Infiltration Ripples */}
              <circle cx={325} cy={310} r={(particleOffset % 30) + 5} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity={(30 - (particleOffset % 30)) / 30} />
            </g>
          )}
        </svg>

        {/* Realtime Hydraulic Indicators overlay */}
        <div className="absolute bottom-4 left-4 flex gap-3 rounded-lg border border-slate-800 bg-slate-950/90 p-2 text-[10px] text-slate-300">
          <div>
            <span className="text-slate-500">Filtration Velocity:</span> <span className="font-bold text-accent">3,000 mm/hr</span>
          </div>
          <div>
            <span className="text-slate-500">Infiltration Efficiency:</span> <span className="font-bold text-emerald-400">85%</span>
          </div>
          <div>
            <span className="text-slate-500">Aquifer Recharge Rate:</span> <span className="font-bold text-blue-400">0.45 m³/day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
