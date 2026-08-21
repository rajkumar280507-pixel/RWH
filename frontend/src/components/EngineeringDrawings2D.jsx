import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  worldToSvg,
  computeScale,
  dimensionLine,
  leaderLine,
  flowArrow,
  northArrow,
  titleBlock,
  scaleBar,
} from "../lib/cadGeometry.js";
import MaterialPatternDefs, { materialFill, PATTERN_IDS } from "../lib/materialPatterns.jsx";
import PitTypeSwitcher, { defaultStructureView } from "./cad/PitTypeSwitcher.jsx";
import MaterialSpecPopup from "./cad/MaterialSpecPopup.jsx";
import CustomPitControls from "./cad/CustomPitControls.jsx";
import { defaultCustomPit, clampCustomPit, STANDARD_FILTER_STACK } from "../lib/customPitQuantities.js";

const n = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
const today = () => new Date().toISOString().slice(0, 10);

// Structural/annotation ink for the CAD sheet — dimension lines, leader
// lines, borders and labels all use this near-black rather than a theme
// color, matching real drafting-sheet convention ("black dimensions" on
// white paper). Material fills and flow-direction arrows stay colored
// separately since color is meaningful information there (what the material
// is / which way water is moving), not just decoration.
const INK = "#1a1a1a";
const INK_MUTED = "#52606d";

// One honest, plain-English sentence per tab, shown above the drawing so a
// first-time, non-technical viewer knows what they're looking at before
// they try to parse any of the annotations.
const VIEW_CAPTIONS = {
  cross_section:
    "This is a vertical slice through the recharge pit, as if it were cut in half — it shows how deep and wide the pit is, and the layers of sand, gravel and stone inside that clean rainwater as it soaks down toward the groundwater.",
  plan_view:
    "This is a bird's-eye view of the pit, looking straight down from above — it shows the shape and footprint of the structure as you'd see it marked out on the ground.",
  exploded_filter:
    "This pulls the filter layers apart so you can see, one at a time, what each layer of sand, gravel and stone does to clean the water before it enters the soil.",
  pipe_layout:
    "This traces the path rainwater takes from your roof: down the pipe, through a first-flush unit that throws away the dirtiest first bit of rain, through a silt trap that catches grit, and into the recharge structure.",
  deep_bore:
    "This shows a deep injection borewell — used only when the shallow soil can't absorb water fast enough on its own, so water is guided down a slotted pipe closer to the water table.",
};

function customGeometry(customPit) {
  const p = clampCustomPit(customPit);
  if (p.shape === "rectangular") {
    return {
      kind: "rectangular",
      widthM: p.widthM,
      lengthM: p.lengthM,
      depthM: p.depthM,
      freeboardM: p.freeboardM,
      source: "custom",
      note: "User-entered dimensions — a sketch tool, not an independently engineered structure or BOQ.",
      label: `CUSTOM RECTANGULAR PIT — ${n(p.lengthM, 2)}m × ${n(p.widthM, 2)}m`,
    };
  }
  return {
    kind: "circular",
    diameterM: p.diameterM,
    depthM: p.depthM,
    freeboardM: p.freeboardM,
    source: "custom",
    note: "User-entered dimensions — a sketch tool, not an independently engineered structure or BOQ.",
    label: `CUSTOM CIRCULAR PIT — Ø${n(p.diameterM, 2)}m`,
  };
}

export default function EngineeringDrawings2D({ result }) {
  const [view, setView] = useState("cross_section");
  const [structureView, setStructureView] = useState(() => defaultStructureView(result));
  const [inspect, setInspect] = useState(null); // { material, position }
  const [customPit, setCustomPit] = useState(() => defaultCustomPit("circular"));

  const geometry = useMemo(
    () => (structureView === "custom" ? customGeometry(customPit) : deriveStructureGeometry(structureView, result)),
    [structureView, result, customPit]
  );

  if (!result) return null;

  const isInjectionBore = Boolean(result.injection_borewell);
  const filterMedia = result.filter_media || [];
  // Custom sketches always show a sensible filter stack (real data if this
  // design has it, else the standard IS 15797 split) even on the rare design
  // that returns none — the other structure views keep the honest "no filter
  // media data" empty state instead of silently substituting one.
  const drawingFilterMedia = structureView === "custom" ? (filterMedia.length ? filterMedia : STANDARD_FILTER_STACK) : filterMedia;

  const openMaterial = (material, evt) => {
    setInspect({ material, position: { x: evt.clientX, y: evt.clientY } });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-5 text-xs text-slate-700 dark:text-slate-200 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="text-brand">📐</span> Recharge Pit — 2D Engineering Drawing
          </h3>
          <p className="max-w-2xl text-[11px] text-slate-500 dark:text-slate-400">
            A scaled technical drawing of your recharge structure, built to <b>IS 15797:2008</b> (India's
            engineering standard for rainwater harvesting structures) and CGWB guidelines. Dimensions are
            in metres. Click any colored material in the drawing to see, in plain language, what it is and
            what it does.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-1">
          <TabBtn id="cross_section" label="Cross Section A-A" active={view} set={setView} />
          <TabBtn id="plan_view" label="Plan View (Top)" active={view} set={setView} />
          <TabBtn id="exploded_filter" label="Filter Stack" active={view} set={setView} />
          <TabBtn id="pipe_layout" label="First Flush & Silt Trap" active={view} set={setView} />
          {isInjectionBore && <TabBtn id="deep_bore" label="Deep Injection Bore" active={view} set={setView} />}
        </div>
      </div>

      {/* Structure-type switcher (Cross Section / Plan View only — the other
          tabs are single fixed schematics that don't vary by structure type) */}
      {(view === "cross_section" || view === "plan_view") && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PitTypeSwitcher result={result} value={structureView} onChange={setStructureView} />
          {geometry?.source === "variant" && (
            <span className="flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] text-warning">
              <AlertTriangle size={11} className="shrink-0" />
              {geometry.note || "Frontend-only visualization — not an independently engineered structure."}
            </span>
          )}
          {geometry?.source === "custom" && (
            <span className="flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-2.5 py-1 text-[10px] text-info">
              <Info size={11} className="shrink-0" />
              {geometry.note}
            </span>
          )}
        </div>
      )}

      {structureView === "custom" && (view === "cross_section" || view === "plan_view") && (
        <CustomPitControls pit={customPit} onChange={setCustomPit} filterStack={drawingFilterMedia} />
      )}

      {/* Plain-language "what am I looking at" caption for the active tab */}
      {VIEW_CAPTIONS[view] && (
        <p className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
          {VIEW_CAPTIONS[view]}
        </p>
      )}

      {/* SVG Canvas Container — a real engineering drawing sheet is always
          white paper with black ink, so this canvas deliberately does NOT
          follow the app's own light/dark theme toggle (see the `.cad-sheet`
          rule in src/styles/index.css). */}
      <div className="cad-sheet relative flex justify-center overflow-x-auto rounded-lg border border-slate-300 bg-[#FAFAFA] p-4 shadow-inner">
        {view === "cross_section" &&
          (geometry ? (
            <CrossSectionSvg
              geometry={geometry}
              filterMedia={drawingFilterMedia}
              injectionBorewell={structureView === "custom" ? null : result.injection_borewell}
              groundwaterDepthM={result.groundwater_depth_m}
              hydrologicSoilGroup={result.hydrologic_soil_group}
              onMaterialClick={openMaterial}
            />
          ) : (
            <NoDataNotice label="cross section" />
          ))}
        {view === "plan_view" &&
          (geometry ? (
            <PlanViewSvg geometry={geometry} />
          ) : (
            <NoDataNotice label="plan view" />
          ))}
        {view === "exploded_filter" && (
          <ExplodedFilterSvg filterMedia={filterMedia} referenceDepthM={result.pit?.depth_m ?? result.trench?.depth_m ?? 2.5} onMaterialClick={openMaterial} />
        )}
        {view === "pipe_layout" && <PipeLayoutSvg result={result} />}
        {view === "deep_bore" && result.injection_borewell && (
          <DeepBoreSvg
            borewell={result.injection_borewell}
            groundwaterDepthM={result.groundwater_depth_m}
            structureDepthM={result.pit?.depth_m ?? result.trench?.depth_m ?? 2.0}
          />
        )}
      </div>

      {inspect && (
        <MaterialSpecPopup material={inspect.material} position={inspect.position} onClose={() => setInspect(null)} />
      )}

      {/* Material Specifications & Engineering Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px]">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
          <span className="font-bold text-brand">Filter Media Layer Specs</span>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">The layers of sand/gravel/stone that clean the water on its way down.</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-600 dark:text-slate-400">
            {filterMedia.length > 0 ? (
              filterMedia.map((l) => (
                <li key={l.layer_order}>
                  • {l.material} ({l.particle_size_note}, porosity ≈ {n(l.porosity, 2)}) —{" "}
                  {n(l.thickness_fraction * 100, 0)}%
                </li>
              ))
            ) : (
              <li>No filter media data on this design.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
          <span className="font-bold text-amber-600 dark:text-amber-400">Construction Tolerances</span>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">How precisely this needs to be built on site.</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-600 dark:text-slate-400">
            <li>• Pit/trench excavation side slope 1:0.5 (safe, won't collapse inward)</li>
            <li>• Inspection chamber masonry: 230mm brickwork</li>
            <li>• Perforated pipe slot width: 3mm at 50mm spacing</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Regulatory Compliance</span>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">The official rules this design follows.</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-600 dark:text-slate-400">
            <li>• Code: IS 15797:2008 (India's RWH standard) & CGWB RTRWH Code</li>
            <li>• Separation: ≥3.0m above seasonal water table (keeps the structure clear of the water below)</li>
            <li>• First Flush Diversion: {n(0.5, 1)} mm over catchment (the dirtiest first rain is thrown away, not recharged)</li>
          </ul>
        </div>
      </div>

      <p className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-500">
        This drawing is generated automatically from your design inputs for planning and discussion purposes.
        It is <b>not a certified structural drawing</b> — have it reviewed by a licensed civil engineer before
        construction begins.
      </p>
    </div>
  );
}

function TabBtn({ id, label, active, set }) {
  return (
    <button
      onClick={() => set(id)}
      className={`rounded px-3 py-1 text-[11px] font-medium transition ${
        active === id
          ? "bg-brand/10 text-brand border border-brand/30"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function NoDataNotice({ label }) {
  return (
    <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-2 text-center text-slate-500">
      <AlertTriangle size={20} />
      <p className="text-[11px]">
        No dimension data is available to draw a {label} for the selected structure type on this design.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Structure-type geometry derivation
// ---------------------------------------------------------------------------

/**
 * Resolves the abstract PitTypeSwitcher selection into concrete real-world
 * dimensions (metres) to draw. "real" source = taken directly from backend
 * `pit`/`trench`/`injection_borewell` dicts. "variant" source = a
 * frontend-only preset transform of those same backend-computed numbers,
 * always carrying a `note` disclaiming it as non-engineered.
 */
function deriveStructureGeometry(structureView, result) {
  if (!result) return null;
  const pit = result.pit;
  const trench = result.trench;
  const bore = result.injection_borewell;

  switch (structureView) {
    case "circular_pit": {
      if (!pit) return null;
      return {
        kind: "circular",
        diameterM: pit.diameter_m,
        depthM: pit.depth_m,
        freeboardM: pit.freeboard_m ?? 0,
        countLabel: pit.pit_count > 1 ? `${pit.pit_count} nos.` : null,
        source: "real",
        label: `CIRCULAR RECHARGE PIT — Ø${n(pit.diameter_m, 2)}m`,
      };
    }
    case "rectangular_pit": {
      if (!pit) return null;
      const area = (Math.PI / 4) * pit.diameter_m ** 2;
      const side = Math.round(Math.sqrt(area) * 100) / 100;
      return {
        kind: "rectangular",
        widthM: side,
        lengthM: side,
        depthM: pit.depth_m,
        freeboardM: pit.freeboard_m ?? 0,
        source: "variant",
        note: "Equal-area square footprint derived from the computed circular pit's diameter — the engine does not compute rectangular pit geometry independently.",
        label: `RECTANGULAR RECHARGE PIT — ${n(side, 2)}m × ${n(side, 2)}m`,
      };
    }
    case "trench": {
      if (!trench) return null;
      return {
        kind: "trench",
        widthM: trench.width_m,
        // Plan view draws the full trench footprint (all segments end to
        // end); segmentLengthM + segmentCount below drive the divider marks.
        lengthM: trench.total_length_m,
        segmentLengthM: trench.segment_length_m,
        totalLengthM: trench.total_length_m,
        segmentCount: trench.segment_count,
        depthM: trench.depth_m,
        freeboardM: 0,
        source: "real",
        label: `RECHARGE TRENCH — ${n(trench.width_m, 2)}m W × ${n(trench.total_length_m, 1)}m L`,
      };
    }
    case "injection_well": {
      if (!bore) return null;
      return {
        kind: "shaft",
        diameterM: 0.15,
        depthM: bore.conceptual_depth_m,
        freeboardM: 0,
        source: "real",
        label: `DEEP INJECTION BOREWELL — Ø150mm × ${n(bore.conceptual_depth_m, 1)}m`,
      };
    }
    case "percolation_tank": {
      const base = pit || trench;
      if (!base) return null;
      const refVol = pit ? pit.total_volume_m3 : trench.total_volume_m3;
      const depthM = Math.max(0.75, (base.depth_m || 2) * 0.6);
      const diameterM = Math.round(Math.sqrt((4 * refVol) / (Math.PI * depthM)) * 100) / 100;
      return {
        kind: "circular",
        diameterM,
        depthM,
        freeboardM: 0.2,
        source: "variant",
        note: "Shallow, wide preset holding the same total structure volume as the computed pit/trench — the engine does not compute a separate percolation-tank design.",
        label: `PERCOLATION TANK — Ø${n(diameterM, 2)}m × ${n(depthM, 2)}m deep`,
      };
    }
    case "recharge_shaft": {
      if (!pit) return null;
      const diameterM = Math.max(0.45, Math.min(0.9, pit.diameter_m * 0.35));
      const depthM = Math.round(pit.depth_m * 1.6 * 100) / 100;
      return {
        kind: "circular",
        diameterM,
        depthM,
        freeboardM: 0.15,
        source: "variant",
        note: "Narrow, deep preset derived from the computed pit's dimensions — the engine does not compute a separate recharge-shaft design.",
        label: `RECHARGE SHAFT — Ø${n(diameterM, 2)}m × ${n(depthM, 2)}m deep`,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared shape renderer + CAD chrome (defs / north arrow / title block / scale bar)
// ---------------------------------------------------------------------------

function ShapeRenderer({ shapes, onShapeClick }) {
  return (
    <>
      {shapes.map((s, i) => {
        const clickable = typeof s.onClick === "function";
        const commonProps = clickable
          ? {
              onClick: (e) => {
                e.stopPropagation();
                s.onClick(e);
              },
              style: { cursor: "pointer" },
            }
          : undefined;
        switch (s.type) {
          case "line":
            return (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={s.stroke || "currentColor"}
                strokeWidth={s.strokeWidth ?? 1}
                strokeDasharray={s.dash}
                opacity={s.opacity}
                markerStart={s.markerStart}
                markerEnd={s.markerEnd}
              />
            );
          case "polygon":
            return (
              <polygon
                key={i}
                points={s.points}
                fill={s.fill ?? "none"}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                opacity={s.opacity}
                strokeDasharray={s.dash}
                {...commonProps}
              />
            );
          case "rect":
            return (
              <rect
                key={i}
                x={s.x}
                y={s.y}
                width={s.width}
                height={s.height}
                fill={s.fill ?? "none"}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                rx={s.rx}
                opacity={s.opacity}
                strokeDasharray={s.dash}
                {...commonProps}
              />
            );
          case "circle":
            return (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill={s.fill ?? "none"}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                opacity={s.opacity}
                {...commonProps}
              />
            );
          case "text":
            return (
              <text
                key={i}
                x={s.x}
                y={s.y}
                textAnchor={s.anchor || "start"}
                fontSize={s.size || 10}
                fontWeight={s.weight || 400}
                fill={s.fill || "currentColor"}
                transform={s.rotate ? `rotate(${s.rotate} ${s.x} ${s.y})` : undefined}
              >
                {s.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/** Shared `<defs>` block: arrowhead markers + all 7 material patterns. */
function CadDefs() {
  return (
    <defs>
      {/* Dimension/leader arrowheads are black ink, matching the now-black
          dimension/leader lines they terminate (drafting convention keeps
          measurement/annotation marks monochrome; only flow arrows and
          material fills carry meaning through color). */}
      <marker id="cad-arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
      </marker>
      <marker id="cad-arrow-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M6,0 L0,3 L6,6 Z" fill={INK} />
      </marker>
      <marker id="cad-arrow-leader" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
      </marker>
      <marker id="cad-arrow-flow" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="rgb(var(--color-groundwater))" />
      </marker>
      <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="1" />
      </pattern>
      <MaterialPatternDefs />
    </defs>
  );
}

function ChromeOverlay({ width, height, drawingTitle, scalePxPerM, north = { x: 30, y: 40 } }) {
  const na = northArrow(north, 22);
  const sb = scaleBar({ x: 20, y: height - 34 }, scalePxPerM, 3, 1);
  const tbWidth = Math.min(240, width * 0.34);
  const tbHeight = 52;
  const tbX = width - tbWidth - 10;
  const tbY = height - tbHeight - 10;
  const tb = titleBlock({
    x: tbX,
    y: tbY,
    width: tbWidth,
    height: tbHeight,
    drawingTitle,
    scale: `1px = ${scalePxPerM > 0 ? n(1 / scalePxPerM, 3) : "—"}m`,
    date: today(),
    drawnBy: "RWH-DSS Engine",
  });
  // "Engineer stamp" placeholder — a plain text box, deliberately NOT a real
  // seal/signature. It sits directly above the title block so it reads as
  // part of the same sheet, and says outright that this is not a
  // certification, matching the no-cryptographic-signing precedent used
  // elsewhere in the app.
  const stampHeight = 30;
  const stampY = tbY - stampHeight - 4;
  return (
    <>
      <g style={{ color: INK }}>
        <ShapeRenderer shapes={na.shapes} />
      </g>
      <g style={{ color: INK_MUTED }}>
        <ShapeRenderer shapes={sb.shapes} />
      </g>
      <g>
        <rect x={tbX} y={stampY} width={tbWidth} height={stampHeight} fill="rgba(255,255,255,0.92)" stroke={INK} strokeWidth="1" strokeDasharray="3 2" />
        <text x={tbX + tbWidth / 2} y={stampY + 10} textAnchor="middle" fontSize="7" fontWeight="700" fill={INK} letterSpacing="0.4">
          ENGINEER REVIEW REQUIRED
        </text>
        <text x={tbX + tbWidth / 2} y={stampY + 19} textAnchor="middle" fontSize="6.3" fill={INK_MUTED}>
          Review before construction begins —
        </text>
        <text x={tbX + tbWidth / 2} y={stampY + 27} textAnchor="middle" fontSize="6.3" fill={INK_MUTED}>
          not a certified engineering seal
        </text>
      </g>
      <g style={{ color: INK }}>
        <ShapeRenderer shapes={tb.shapes} />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cross Section A-A
// ---------------------------------------------------------------------------

// Illustrative regional soil profile for the stratigraphy column — the
// backend only returns a hydrologic soil group + groundwater depth, not a
// real bore log, so these band fractions are a typical/generic profile, not
// measured data. Order is display order (top to bottom).
const STRATA_BANDS = [
  { key: "topsoil", label: "TOPSOIL", gloss: "loose, dark, organic-rich soil", fraction: 0.08, patternKey: PATTERN_IDS.topsoil, matName: "Topsoil" },
  { key: "clay", label: "CLAY", gloss: "sticky, slow-draining soil", fraction: 0.20, patternKey: PATTERN_IDS.clay, matName: "Native clayey soil" },
  { key: "sand", label: "SAND", gloss: "loose, fast-draining soil", fraction: 0.18, patternKey: PATTERN_IDS.sand, matName: "Coarse sand" },
  { key: "weathered_rock", label: "WEATHERED ROCK", gloss: "partly broken-down rock", fraction: 0.26, patternKey: PATTERN_IDS.weatheredRock, matName: "Weathered rock" },
  { key: "fractured_rock", label: "FRACTURED ROCK", gloss: "solid rock, cracked by fractures", fraction: 0.28, patternKey: PATTERN_IDS.fracturedRock, matName: "Fractured rock" },
];

const HSG_PLAIN = {
  A: "sandy, fast-draining soil",
  B: "moderately fast-draining soil",
  C: "slow-draining, clayey soil",
  D: "very slow-draining, clay-heavy soil",
};

function StratigraphyColumn({ x, colTop, colBottom, width, groundwaterDepthM, hydrologicSoilGroup, onMaterialClick }) {
  const colHeight = colBottom - colTop;
  let cum = 0;
  const bands = STRATA_BANDS.map((b) => {
    const y0 = colTop + cum * colHeight;
    cum += b.fraction;
    const y1 = colTop + cum * colHeight;
    return { ...b, y0, y1 };
  });
  const gwLabel = groundwaterDepthM != null ? `Groundwater ≈ ${n(groundwaterDepthM, 1)} m below ground` : "Groundwater depth not available";

  return (
    <g>
      <text x={x} y={colTop - 22} fontSize="9.5" fontWeight="700" fill={INK}>
        TYPICAL SOIL PROFILE
      </text>
      <text x={x} y={colTop - 10} fontSize="7.5" fill={INK_MUTED}>
        Illustrative — not site-investigated
      </text>
      {bands.map((b) => (
        <g key={b.key} style={{ cursor: "pointer" }} onClick={(e) => onMaterialClick(b.matName, e)}>
          <rect x={x} y={b.y0} width={width} height={Math.max(1, b.y1 - b.y0)} fill={`url(#${b.patternKey})`} stroke={INK} strokeWidth="1" />
          <text x={x + width + 8} y={(b.y0 + b.y1) / 2 - 4} fontSize="8" fontWeight="700" fill={INK}>
            {b.label}
          </text>
          <text x={x + width + 8} y={(b.y0 + b.y1) / 2 + 7} fontSize="7.5" fill={INK_MUTED}>
            {b.gloss}
          </text>
        </g>
      ))}
      <line x1={x - 10} y1={colBottom} x2={x + width + 130} y2={colBottom} stroke="rgb(var(--color-groundwater))" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={x} y={colBottom + 14} fontSize="7.5" fontWeight="700" fill="rgb(var(--color-groundwater))">
        {gwLabel}
      </text>
      {hydrologicSoilGroup && (
        <>
          <text x={x} y={colBottom + 26} fontSize="7.5" fill={INK_MUTED}>
            Soil Group {hydrologicSoilGroup}:
          </text>
          <text x={x} y={colBottom + 37} fontSize="7.5" fill={INK_MUTED}>
            {HSG_PLAIN[hydrologicSoilGroup] || "affects how fast rain soaks in"}
          </text>
        </>
      )}
    </g>
  );
}

function CrossSectionSvg({ geometry, filterMedia, injectionBorewell, groundwaterDepthM, hydrologicSoilGroup, onMaterialClick }) {
  const SVG_W = 920;
  const SVG_H = 580;

  // A drilled injection-bore shaft has no open-cut batter and no filter-media
  // stack (it's a slotted casing + gravel pack, not an excavated pit) —
  // treating it like a battered open-cut pit would try to widen a 150mm
  // casing by the full bore depth (often 10m+), producing a nonsensical
  // drawing, so it's special-cased below.
  const isShaft = geometry.kind === "shaft";

  const widthM = geometry.diameterM ?? geometry.widthM ?? 1.5;
  const depthM = geometry.depthM ?? 2.0;
  const freeboardM = isShaft ? 0 : geometry.freeboardM ?? 0;
  const excavationDepthM = depthM + freeboardM;
  // Side batter 1:0.5 (horizontal : vertical) over the full excavation depth,
  // widening toward the top for a stable open-cut slope. Not applicable to a
  // drilled shaft, which stays a constant-diameter vertical bore.
  const topWidthM = isShaft ? widthM : widthM + excavationDepthM * 1.0;

  const drawTop = 130; // px reserved above for GL label + inlet pipe + inspection chamber
  const drawBottom = SVG_H - 210; // px reserved below for base detail band + dimensions/title block
  const scale = computeScale(
    { width: topWidthM + 1.0, height: excavationDepthM },
    { width: 400, height: drawBottom - drawTop },
    0
  );

  const origin = { x: 250, y: drawTop };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, flipY: false });

  const widthAt = (yM) => topWidthM - (topWidthM - widthM) * (yM / excavationDepthM);

  // Excavation outline (battered trapezoid).
  const topL = w2s(-topWidthM / 2, 0);
  const topR = w2s(topWidthM / 2, 0);
  const botL = w2s(-widthM / 2, excavationDepthM);
  const botR = w2s(widthM / 2, excavationDepthM);
  const excavationPoints = `${topL.x},${topL.y} ${topR.x},${topR.y} ${botR.x},${botR.y} ${botL.x},${botL.y}`;

  // --- Base construction detail (illustrative, drawn below the excavation
  // outline so the design's actual depth_m / filter-media percentages are
  // never altered by it) ---
  const stoneBandTopY = botL.y + 5;
  const stoneBandH = 15;
  const footingBandH = 11;
  const stoneBandBotY = stoneBandTopY + stoneBandH;
  const footingBandBotY = stoneBandBotY + footingBandH;
  const footingOverhangPx = 12;

  // --- Concrete collar at ground level (a raised rim around the pit mouth) ---
  const collarHalfWPx = (topR.x - topL.x) / 2 + 16;
  const collarTopY = topL.y - 9;
  const collarBotY = topL.y + 9;

  // --- Soil stratigraphy column, to the right of the drawing ---
  const stratColX = 640;
  const stratColWidth = 46;
  const stratColTop = drawTop + 6;
  const stratColBottom = SVG_H - 150;

  // Filter media layers (ordered top -> bottom by layer_order), sitting below
  // the freeboard void. Not drawn for a drilled shaft (no filter stack).
  const orderedLayers = isShaft ? [] : [...filterMedia].sort((a, b) => a.layer_order - b.layer_order);
  let cumFrac = 0;
  const layerShapes = orderedLayers.map((layer) => {
    const y0M = freeboardM + cumFrac * depthM;
    cumFrac += layer.thickness_fraction;
    const y1M = freeboardM + cumFrac * depthM;
    const w0 = widthAt(y0M);
    const w1 = widthAt(y1M);
    const pTL = w2s(-w0 / 2, y0M);
    const pTR = w2s(w0 / 2, y0M);
    const pBR = w2s(w1 / 2, y1M);
    const pBL = w2s(-w1 / 2, y1M);
    const points = `${pTL.x},${pTL.y} ${pTR.x},${pTR.y} ${pBR.x},${pBR.y} ${pBL.x},${pBL.y}`;
    const midY = (pTL.y + pBL.y) / 2;
    return { layer, points, midY, thicknessM: layer.thickness_fraction * depthM };
  });

  // Freeboard void (if any).
  const freeboardShape =
    freeboardM > 0
      ? (() => {
          const w0 = widthAt(0);
          const w1 = widthAt(freeboardM);
          const pTL = w2s(-w0 / 2, 0);
          const pTR = w2s(w0 / 2, 0);
          const pBR = w2s(w1 / 2, freeboardM);
          const pBL = w2s(-w1 / 2, freeboardM);
          return `${pTL.x},${pTL.y} ${pTR.x},${pTR.y} ${pBR.x},${pBR.y} ${pBL.x},${pBL.y}`;
        })()
      : null;

  // Dimension lines: depth (right side, vertical), width/diameter (bottom, horizontal).
  // Negative offset: for a downward p1->p2 pair, dimensionLine's perpendicular
  // normal points left (into the excavation) at a positive offset, so a
  // negative offset is what pushes the dimension line out to the right of it.
  // Colored INK (black/charcoal) rather than a theme token — real drafting
  // sheets use black dimension lines, reserving color for materials/flow.
  const dimDepth = dimensionLine(w2s(topWidthM / 2, 0), w2s(topWidthM / 2, excavationDepthM), -34, `${n(excavationDepthM, 2)} m deep`, INK);
  const dimWidth = dimensionLine(botL, botR, 28, geometry.diameterM ? `Ø ${n(widthM, 2)} m` : `${n(widthM, 2)} m wide`, INK);

  // Inlet pipe leader (illustrative entry point at top-left of excavation).
  // Kept deliberately short so it stays on-sheet regardless of which way
  // leaderLine's auto-anchor grows the text (the feature point's x can land
  // anywhere from ~50 to ~310px depending on pit proportions).
  const inletFeature = w2s(-topWidthM / 2 + 0.15, 0.05);
  const inletLabel = { x: 70, y: drawTop - 46 };
  const inletLeader = leaderLine(inletLabel, inletFeature, "RAIN IN", INK);

  // Concrete collar callout — a fixed-position leader (label anchor to the
  // right of anything the collar's edge can reach, see the width-cap note
  // above) rather than text anchored off the collar's own variable edge,
  // which was overflowing the sheet for narrow structures.
  const collarLeaderFrom = { x: 500, y: 58 };
  const collarLeaderTo = { x: origin.x + collarHalfWPx - 4, y: (collarTopY + collarBotY) / 2 };
  const collarLeader = leaderLine(collarLeaderFrom, collarLeaderTo, "CONCRETE COLLAR (raised rim)", INK);

  const groundY = w2s(0, 0).y;

  // Water-flow arrows: short down-pointing arrows through the filter stack,
  // offset from the centerline so they don't collide with the layer-name
  // labels — makes "rain goes in the top, moves down, soaks out the bottom"
  // visually obvious without reading any text.
  const flowXWorld = -Math.min(widthM, topWidthM) * 0.24;
  const flowSegs = [
    [0.06, 0.24],
    [0.36, 0.54],
    [0.66, 0.84],
  ];

  // Inspection chamber (visual language matches the "silt trap" chamber box
  // drawn on the Pipe Layout tab: rounded rect + border + lid bar) — placed
  // above ground near the inlet, with a short connector down to the pit.
  const chamberX = 350;
  const chamberY = 34;
  const chamberW = 92;
  const chamberH = 46;
  const chamberConnectTo = w2s(Math.min(topWidthM / 2 - 0.1, 0.4), 0.02);

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      {/* Ground surface line, spanning the full canvas width */}
      <line x1={20} y1={groundY} x2={SVG_W - 20} y2={groundY} stroke="rgb(var(--color-success))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={26} y={groundY - 8} fill="rgb(var(--color-success))" fontWeight="bold">
        GL — GROUND LEVEL (0.00m)
      </text>

      {/* Concrete collar — a raised rim at the pit mouth so loose soil and
          surface runoff don't wash straight into the structure. */}
      <rect
        x={origin.x - collarHalfWPx}
        y={collarTopY}
        width={collarHalfWPx * 2}
        height={collarBotY - collarTopY}
        fill={materialFill("concrete")}
        stroke={INK}
        strokeWidth="1.25"
      />
      <ShapeRenderer shapes={collarLeader.shapes} />
      <text x={collarLeaderFrom.x} y={collarLeaderFrom.y + 10} fontSize="7.5" fill={INK_MUTED}>
        keeps dirt &amp; runoff out
      </text>

      {/* Excavation outline */}
      <polygon points={excavationPoints} fill="rgb(var(--color-ground) / 0.15)" stroke="rgb(var(--color-ground))" strokeWidth="2" />

      {/* Freeboard void */}
      {freeboardShape && (
        <>
          <polygon points={freeboardShape} fill="rgb(var(--color-recharge-water) / 0.08)" stroke="rgb(var(--color-recharge-water))" strokeWidth="1" strokeDasharray="4 2" />
          <text x={origin.x} y={groundY + (freeboardM * scale) / 2 + 3} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontSize="9">
            FREEBOARD {n(freeboardM, 2)}m (empty space — room for water to rise before overflowing)
          </text>
        </>
      )}

      {/* Filter media layers, real material-pattern fills, click to inspect */}
      {layerShapes.map(({ layer, points, midY }) => (
        <g key={layer.layer_order}>
          <polygon
            points={points}
            fill={materialFill(layer.material)}
            stroke="rgb(var(--color-ground))"
            strokeWidth="1"
            opacity="0.95"
            style={{ cursor: "pointer" }}
            onClick={(e) => onMaterialClick(layer.material, e)}
          />
          <text x={origin.x} y={midY} textAnchor="middle" fill={INK} fontWeight="bold" style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>
            {layer.material.toUpperCase()} — {layer.particle_size_note} ({n(layer.thickness_fraction * 100, 0)}%)
          </text>
        </g>
      ))}

      {/* Water-flow arrows: rain enters at the top and moves straight down
          through the filter layers toward the groundwater below. */}
      {!isShaft &&
        flowSegs.map(([f0, f1], i) => {
          const p0 = w2s(flowXWorld, excavationDepthM * f0);
          const p1 = w2s(flowXWorld, excavationDepthM * f1);
          const seg = flowArrow(p0, p1, { color: "rgb(var(--color-recharge-water))", strokeWidth: 2.5 });
          return <ShapeRenderer key={i} shapes={seg.shapes} />;
        })}

      {/* Drilled shaft: slotted casing + surrounding gravel pack, in place of
          a filter-media stack. */}
      {isShaft && (
        <g>
          <polygon points={excavationPoints} fill={materialFill("gravel")} stroke="rgb(var(--color-groundwater))" strokeWidth="1" opacity="0.5" style={{ cursor: "pointer" }} onClick={(e) => onMaterialClick("Graded gravel", e)} />
          <line x1={origin.x} y1={topL.y} x2={origin.x} y2={botL.y} stroke="rgb(var(--color-groundwater))" strokeWidth="3" strokeDasharray="6 2" />
        </g>
      )}

      {/* Injection borewell cross-reference note — only shown from the other
          structure views (drawn to a different scale on its own "Deep
          Injection Bore" tab); suppressed here since this view already is it. */}
      {injectionBorewell && !isShaft && (
        <g>
          <line x1={origin.x} y1={botL.y} x2={origin.x} y2={botL.y + 22} stroke="rgb(var(--color-info))" strokeWidth="2" strokeDasharray="3 2" markerEnd="url(#cad-arrow-flow)" />
          <text x={origin.x + 8} y={botL.y + 18} fill="rgb(var(--color-info))" fontWeight="bold" fontSize="9">
            DEEP INJECTION BOREWELL BELOW — SEE "DEEP INJECTION BORE" TAB (Ø150mm × {n(injectionBorewell.conceptual_depth_m, 1)}m)
          </text>
        </g>
      )}

      {/* Stone packing bed + footing — illustrative base construction detail
          drawn just below the excavation outline; not counted in / does not
          change the design's actual depth_m or filter-layer percentages
          above. */}
      <g>
        <rect x={botL.x} y={stoneBandTopY} width={botR.x - botL.x} height={stoneBandH} fill={materialFill("rock")} stroke={INK} strokeWidth="1" />
        <text x={botR.x + 8} y={stoneBandTopY + stoneBandH / 2 + 3} fontSize="7.5" fontWeight="700" fill={INK}>
          STONE PACKING
        </text>
        <rect
          x={botL.x - footingOverhangPx}
          y={stoneBandBotY}
          width={botR.x - botL.x + footingOverhangPx * 2}
          height={footingBandH}
          fill={materialFill("concrete")}
          stroke={INK}
          strokeWidth="1"
        />
        <text x={botR.x + footingOverhangPx + 8} y={stoneBandBotY + footingBandH / 2 + 3} fontSize="7.5" fontWeight="700" fill={INK}>
          FOOTING
        </text>
        <text x={botR.x + 8} y={footingBandBotY + 12} fontSize="7" fill={INK_MUTED}>
          typical base detail — illustrative, not to design-depth scale
        </text>
      </g>

      {/* Inspection chamber — same visual language (rounded box + lid bar) as
          the silt trap chamber on the Pipe Layout tab. */}
      <g>
        <line x1={chamberX + chamberW / 2} y1={chamberY + chamberH} x2={chamberConnectTo.x} y2={chamberConnectTo.y} stroke={INK_MUTED} strokeWidth="1.25" strokeDasharray="3 2" />
        <rect x={chamberX} y={chamberY} width={chamberW} height={chamberH} rx="4" fill="rgb(var(--color-info) / 0.10)" stroke="rgb(var(--color-info))" strokeWidth="1.5" />
        <rect x={chamberX + 6} y={chamberY + 5} width={chamberW - 12} height="6" rx="2" fill="rgb(var(--color-info) / 0.35)" stroke="rgb(var(--color-info))" strokeWidth="1" />
        <text x={chamberX + chamberW / 2} y={chamberY + chamberH / 2 + 8} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={INK}>
          INSPECTION
        </text>
        <text x={chamberX + chamberW / 2} y={chamberY + chamberH / 2 + 18} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={INK}>
          CHAMBER
        </text>
        <text x={chamberX + chamberW / 2} y={chamberY - 5} textAnchor="middle" fontSize="7" fill={INK_MUTED}>
          lift the lid to check/clean the pipe
        </text>
      </g>

      {/* Soil stratigraphy column */}
      <StratigraphyColumn
        x={stratColX}
        colTop={stratColTop}
        colBottom={stratColBottom}
        width={stratColWidth}
        groundwaterDepthM={groundwaterDepthM}
        hydrologicSoilGroup={hydrologicSoilGroup}
        onMaterialClick={onMaterialClick}
      />

      {/* Inlet pipe */}
      <g>
        <ShapeRenderer shapes={inletLeader.shapes} />
      </g>

      {/* Dimension lines */}
      <ShapeRenderer shapes={dimDepth.shapes} />
      <ShapeRenderer shapes={dimWidth.shapes} />

      {geometry.countLabel && (
        <text x={origin.x} y={footingBandBotY + 26} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontWeight="bold" fontSize="10">
          {geometry.countLabel}
        </text>
      )}

      <ChromeOverlay width={SVG_W} height={SVG_H} drawingTitle={`CROSS SECTION A-A — ${geometry.label}`} scalePxPerM={scale} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Plan View (Top)
// ---------------------------------------------------------------------------

function PlanViewSvg({ geometry }) {
  const SVG_W = 620;
  const SVG_H = 440;
  const drawTop = 80;
  const drawBottom = SVG_H - 92;

  const isCircular = geometry.kind === "circular" || geometry.kind === "shaft";
  const widthM = geometry.diameterM ?? geometry.widthM ?? 1.5;
  const lengthM = geometry.lengthM ?? geometry.diameterM ?? widthM;

  const scale = computeScale(
    { width: widthM + 1.5, height: lengthM + 1.5 },
    { width: SVG_W - 140, height: drawBottom - drawTop },
    0
  );

  // worldToSvg's flipY mode computes screen_y = svgHeight - origin.y - world_y*scale,
  // so to anchor world (0,0) at the visual center row we need origin.y = svgHeight - centerScreenY.
  const centerScreenY = (drawTop + drawBottom) / 2;
  const origin = { x: SVG_W / 2, y: SVG_H - centerScreenY };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, svgHeight: SVG_H, flipY: true });

  const centerPx = w2s(0, 0);
  const radiusPx = (widthM / 2) * scale;

  const rectTL = w2s(-widthM / 2, lengthM / 2);
  const rectBR = w2s(widthM / 2, -lengthM / 2);

  // A circle only needs one diameter callout; a rectangle/trench footprint
  // needs both its width and length dimensioned. Colored INK (black) per
  // drafting convention — see the note on the cross-section's dimension lines.
  const dimWidth = dimensionLine(
    w2s(-widthM / 2, -lengthM / 2),
    w2s(widthM / 2, -lengthM / 2),
    26,
    isCircular ? `Ø ${n(widthM, 2)} m` : `${n(widthM, 2)} m`,
    INK
  );
  const dimLength = isCircular
    ? null
    : dimensionLine(w2s(widthM / 2, -lengthM / 2), w2s(widthM / 2, lengthM / 2), 26, `${n(lengthM, 2)} m`, INK);

  // Label anchors are pulled in from the canvas edges (rather than sitting
  // right at x=60/SVG_W-60) so the leader text — whichever way leaderLine's
  // auto-anchor grows it — has enough clearance not to run off the sheet;
  // see the equivalent note on the cross-section's inlet/collar leaders.
  const inletLeader = leaderLine({ x: 140, y: origin.y - 60 }, w2s(-widthM / 2, 0), "INLET (rain in)", INK);
  const overflowLeader = leaderLine({ x: SVG_W - 140, y: origin.y - 60 }, w2s(widthM / 2, 0), "OVERFLOW (extra out)", INK);

  // Section mark A-A: a cutting-plane line straight through the plan view,
  // with bold "A" flags at each end — this is what the Cross Section A-A tab
  // actually shows a slice through, so it visually links the two views for
  // a viewer who doesn't already know CAD convention.
  const sectionY = centerPx.y;
  const sectionX1 = 34;
  const sectionX2 = SVG_W - 34;

  const segmentDividers = [];
  if (geometry.kind === "trench" && geometry.segmentCount > 1) {
    const segLenM = geometry.segmentLengthM || lengthM / geometry.segmentCount;
    for (let i = 1; i < geometry.segmentCount; i++) {
      const y = -lengthM / 2 + i * segLenM;
      const a = w2s(-widthM / 2, y);
      const b = w2s(widthM / 2, y);
      segmentDividers.push({ a, b, key: i });
    }
  }

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      {/* Section mark A-A — shows where the Cross Section A-A tab slices
          through this structure. Drawn first so it sits behind the shape. */}
      <g>
        <line x1={sectionX1} y1={sectionY} x2={sectionX2} y2={sectionY} stroke={INK} strokeWidth="1.5" strokeDasharray="10 3 2 3" />
        <line x1={sectionX1} y1={sectionY - 7} x2={sectionX1} y2={sectionY + 7} stroke={INK} strokeWidth="2.5" />
        <line x1={sectionX2} y1={sectionY - 7} x2={sectionX2} y2={sectionY + 7} stroke={INK} strokeWidth="2.5" />
        <text x={sectionX1} y={sectionY - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>
          A
        </text>
        <text x={sectionX2} y={sectionY - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>
          A
        </text>
        <text x={SVG_W / 2} y={sectionY - 12} textAnchor="middle" fontSize="8" fill={INK_MUTED}>
          ↳ this line is what "Cross Section A-A" (other tab) cuts through and shows the inside of
        </text>
      </g>

      {/* Centerlines */}
      <line x1={centerPx.x} y1={drawTop - 10} x2={centerPx.x} y2={drawBottom + 10} stroke="#94a3b8" strokeWidth="1" strokeDasharray="8 4" />

      {isCircular ? (
        <circle cx={centerPx.x} cy={centerPx.y} r={radiusPx} fill="rgb(var(--color-ground) / 0.15)" stroke="rgb(var(--color-recharge-water))" strokeWidth="2.5" />
      ) : (
        <rect
          x={Math.min(rectTL.x, rectBR.x)}
          y={Math.min(rectTL.y, rectBR.y)}
          width={Math.abs(rectBR.x - rectTL.x)}
          height={Math.abs(rectBR.y - rectTL.y)}
          fill="rgb(var(--color-ground) / 0.15)"
          stroke="rgb(var(--color-recharge-water))"
          strokeWidth="2.5"
          rx={geometry.kind === "trench" ? 4 : 2}
        />
      )}

      {segmentDividers.map(({ a, b, key }) => (
        <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(var(--color-recharge-water))" strokeWidth="1" strokeDasharray="4 2" opacity="0.6" />
      ))}

      {/* Inner desilting / inspection chamber (illustrative, ~1/5 of the structure) */}
      <circle cx={centerPx.x} cy={centerPx.y} r={Math.max(14, radiusPx * 0.28)} fill="rgb(var(--color-info) / 0.18)" stroke="rgb(var(--color-info))" strokeWidth="2" />
      <text x={centerPx.x} y={centerPx.y - 1} textAnchor="middle" fill="rgb(var(--color-info))" fontWeight="bold" fontSize="8">
        SILT TRAP
      </text>
      <text x={centerPx.x} y={centerPx.y + 9} textAnchor="middle" fill="rgb(var(--color-info))" fontSize="6.5">
        catches grit
      </text>

      <ShapeRenderer shapes={inletLeader.shapes} />
      <ShapeRenderer shapes={overflowLeader.shapes} />

      <ShapeRenderer shapes={dimWidth.shapes} />
      {dimLength && <ShapeRenderer shapes={dimLength.shapes} />}

      {geometry.segmentCount > 1 && (
        <text x={centerPx.x} y={drawBottom + 30} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontSize="9">
          {geometry.segmentCount} segments × {n(geometry.segmentLengthM, 1)}m (total {n(geometry.totalLengthM, 1)}m)
        </text>
      )}

      <ChromeOverlay width={SVG_W} height={SVG_H} drawingTitle={`PLAN VIEW — ${geometry.label}`} scalePxPerM={scale} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Exploded Filter Stack
// ---------------------------------------------------------------------------

function ExplodedFilterSvg({ filterMedia, referenceDepthM, onMaterialClick }) {
  const SVG_W = 600;
  const SVG_H = 420;

  const ordered = [...filterMedia].sort((a, b) => a.layer_order - b.layer_order);
  const totalHeightPx = SVG_H - 100;
  const gapPx = 18;
  const usableHeightPx = totalHeightPx - gapPx * Math.max(0, ordered.length - 1);

  let y = 40;
  const blocks = ordered.map((layer, i) => {
    const h = Math.max(46, usableHeightPx * layer.thickness_fraction);
    const block = { layer, y, h, x: 70, w: SVG_W - 140 };
    y += h + gapPx;
    return block;
  });

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      {ordered.length > 0 && (
        <>
          <text x={SVG_W / 2} y={26} textAnchor="middle" fontSize="9" fontWeight="700" fill="rgb(var(--color-recharge-water))">
            ▼ RAIN ENTERS HERE
          </text>
        </>
      )}

      {blocks.map((b, i) => (
        <g key={b.layer.layer_order}>
          {i > 0 && (
            <ShapeRenderer
              shapes={
                flowArrow(
                  { x: SVG_W / 2, y: blocks[i - 1].y + blocks[i - 1].h + 2 },
                  { x: SVG_W / 2, y: b.y - 2 },
                  { color: "rgb(var(--color-recharge-water))", strokeWidth: 2 }
                ).shapes
              }
            />
          )}
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={materialFill(b.layer.material)}
            stroke={INK}
            strokeWidth="1.5"
            rx="4"
            style={{ cursor: "pointer" }}
            onClick={(e) => onMaterialClick(b.layer.material, e)}
          />
          <text x={SVG_W / 2} y={b.y + b.h / 2 - 10} textAnchor="middle" fill={INK} fontWeight="bold" style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>
            LAYER {b.layer.layer_order}: {b.layer.material.toUpperCase()} ({b.layer.particle_size_note})
          </text>
          <text x={SVG_W / 2} y={b.y + b.h / 2 + 6} textAnchor="middle" fill={INK} style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>
            {n(b.layer.thickness_fraction * 100, 0)}% of depth ≈ {n(b.layer.thickness_fraction * referenceDepthM, 2)}m · Porosity {n(b.layer.porosity, 2)}
          </text>
          <text x={SVG_W / 2} y={b.y + b.h / 2 + 20} textAnchor="middle" fill={INK_MUTED} style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }}>
            Vol {n(b.layer.volume_m3, 3)} m³ · {n(b.layer.weight_kg, 0)} kg · k = {n(b.layer.hydraulic_conductivity_mm_hr, 0)} mm/hr
          </text>
        </g>
      ))}

      {ordered.length > 0 && (
        <ShapeRenderer
          shapes={
            flowArrow(
              { x: SVG_W / 2, y: blocks[blocks.length - 1].y + blocks[blocks.length - 1].h + 2 },
              { x: SVG_W / 2, y: blocks[blocks.length - 1].y + blocks[blocks.length - 1].h + 18 },
              { color: "rgb(var(--color-groundwater))", strokeWidth: 2 }
            ).shapes
          }
        />
      )}

      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill={INK_MUTED}>
        {ordered.length > 0
          ? "EXPLODED FILTER MEDIA STACK VIEW (IS 15797:2008) — click any layer for its spec sheet"
          : "No filter media data on this design to draw a filter stack."}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// First Flush & Silt Trap Pipe Layout (schematic, real values annotated)
// ---------------------------------------------------------------------------

function PipeLayoutSvg({ result }) {
  const SVG_W = 600;
  const SVG_H = 400;

  const downpipeCount = result.downpipe_count ?? 1;
  const downpipeMm = result.downpipe_diameter_mm ?? 110;
  const mainMm = result.conveyance_pipe_diameter_mm ?? 110;
  const overflowMm = result.overflow_pipe_diameter_mm ?? 110;
  const ffLitres = result.first_flush_volume_l ?? 0;
  const siltM3 = result.desilting_chamber_m3 ?? 0;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      {/* Roof Downpipe */}
      <rect x="60" y="50" width="20" height="170" fill="rgb(var(--color-info))" rx="3" />
      <text x="70" y="38" textAnchor="middle" fill={INK} fontWeight="bold">
        ROOF DOWNPIPE
      </text>
      <text x="70" y="234" textAnchor="middle" fill={INK_MUTED} fontSize="8.5">
        {downpipeCount} × {downpipeMm}mm PVC
      </text>

      {/* First Flush Unit */}
      <rect x="130" y="150" width="72" height="120" fill="rgb(var(--color-sand) / 0.15)" stroke="rgb(var(--color-sand))" strokeWidth="2" rx="4" />
      <text x="166" y="172" textAnchor="middle" fill={INK} fontWeight="bold">
        FIRST FLUSH
      </text>
      <text x="166" y="184" textAnchor="middle" fill={INK_MUTED} fontSize="7">
        throws away dirty
      </text>
      <text x="166" y="194" textAnchor="middle" fill={INK_MUTED} fontSize="7">
        first rain
      </text>
      <text x="166" y="210" textAnchor="middle" fill="#b45309" fontSize="8.5" fontWeight="bold">
        {n(ffLitres, 0)} L diverted
      </text>

      {/* Silt Trap / Inspection Chamber — same box + lid visual language as
          the inspection chamber on the Cross Section tab. */}
      <rect x="262" y="130" width="108" height="140" fill="rgb(var(--color-info) / 0.10)" stroke="rgb(var(--color-info))" strokeWidth="2" rx="4" />
      <rect x="272" y="138" width="88" height="7" rx="2" fill="rgb(var(--color-info) / 0.35)" stroke="rgb(var(--color-info))" strokeWidth="1" />
      <text x="316" y="164" textAnchor="middle" fill={INK} fontWeight="bold">
        SILT TRAP
      </text>
      <text x="316" y="176" textAnchor="middle" fill={INK_MUTED} fontSize="7.5">
        catches grit &amp; sediment
      </text>
      <text x="316" y="196" textAnchor="middle" fill={INK_MUTED} fontSize="8.5">
        Baffle chamber
      </text>
      <text x="316" y="210" textAnchor="middle" fill={INK_MUTED} fontSize="8.5">
        {n(siltM3, 3)} m³ (10-min detention)
      </text>

      {/* Recharge Structure Outlet */}
      <rect x="420" y="150" width="100" height="100" fill="rgb(var(--color-recharge-water) / 0.15)" stroke="rgb(var(--color-groundwater))" strokeWidth="2" rx="4" />
      <text x="470" y="180" textAnchor="middle" fill="rgb(var(--color-groundwater))" fontWeight="bold">
        RECHARGE
      </text>
      <text x="470" y="196" textAnchor="middle" fill="rgb(var(--color-groundwater))" fontWeight="bold">
        STRUCTURE
      </text>
      <text x="470" y="212" textAnchor="middle" fill={INK_MUTED} fontSize="7">
        water soaks into ground
      </text>

      {/* Connecting mains, with flow-direction arrows */}
      <path d="M 80 170 L 130 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <path d="M 202 170 L 262 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <path d="M 370 170 L 420 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <text x="272" y="120" textAnchor="middle" fill={INK_MUTED} fontSize="8.5">
        Collection main {mainMm}mm PVC
      </text>

      {/* Overflow */}
      <path d="M 520 190 L 570 190 L 570 260" stroke="rgb(var(--color-danger))" strokeWidth="2.5" strokeDasharray="5 3" markerEnd="url(#cad-arrow-flow)" />
      <text x="546" y="278" textAnchor="middle" fill="rgb(var(--color-danger))" fontSize="8.5" fontWeight="bold">
        Overflow {overflowMm}mm
      </text>
      <text x="546" y="290" textAnchor="middle" fill={INK_MUTED} fontSize="7">
        extra water → storm drain
      </text>

      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill={INK_MUTED} fontSize="9">
        SCHEMATIC LAYOUT — not to scale; pipe sizes shown are the real computed values
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Deep Injection Bore (real scale vs conceptual depth + groundwater level)
// ---------------------------------------------------------------------------

function DeepBoreSvg({ borewell, groundwaterDepthM, structureDepthM }) {
  const SVG_W = 560;
  const SVG_H = 420;
  const totalDepthM = Math.max(borewell.conceptual_depth_m, groundwaterDepthM + 1, structureDepthM + 1);

  const drawTop = 40;
  const drawBottom = SVG_H - 70;
  const scale = computeScale(totalDepthM, drawBottom - drawTop, 0);
  const origin = { x: SVG_W / 2, y: drawTop };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, flipY: false });

  const casingRadiusPx = 15;
  const chamberTop = w2s(0, 0);
  const chamberBottom = w2s(0, Math.min(structureDepthM, totalDepthM * 0.3));
  const casingBottom = w2s(0, borewell.conceptual_depth_m);
  const gwPoint = w2s(0, groundwaterDepthM);

  const dimDepth = dimensionLine(w2s(1.3, 0), w2s(1.3, borewell.conceptual_depth_m), 0, `${n(borewell.conceptual_depth_m, 1)} m`, INK);

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      <line x1={30} y1={chamberTop.y} x2={SVG_W - 30} y2={chamberTop.y} stroke="rgb(var(--color-success))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={36} y={chamberTop.y - 8} fill="rgb(var(--color-success))" fontWeight="bold">
        GL — GROUND LEVEL (0.00m)
      </text>

      {/* Inspection chamber over the pretreatment structure — same box + lid
          visual language as the other tabs' chambers. */}
      <rect x={origin.x - 45} y={chamberTop.y} width="90" height={Math.max(30, chamberBottom.y - chamberTop.y)} fill="rgb(var(--color-info) / 0.10)" stroke="rgb(var(--color-info))" strokeWidth="2" />
      <rect x={origin.x - 38} y={chamberTop.y + 4} width="76" height="6" rx="2" fill="rgb(var(--color-info) / 0.35)" stroke="rgb(var(--color-info))" strokeWidth="1" />
      <text x={origin.x} y={chamberTop.y + 22} textAnchor="middle" fill={INK} fontWeight="bold" fontSize="9">
        INSPECTION CHAMBER
      </text>
      <text x={origin.x} y={chamberTop.y + 33} textAnchor="middle" fill={INK_MUTED} fontSize="7.5">
        pretreatment before the deep bore
      </text>

      {/* Slotted casing shaft */}
      <rect
        x={origin.x - casingRadiusPx}
        y={chamberBottom.y}
        width={casingRadiusPx * 2}
        height={Math.max(10, casingBottom.y - chamberBottom.y)}
        fill="rgb(var(--color-groundwater) / 0.18)"
        stroke="rgb(var(--color-groundwater))"
        strokeWidth="2"
        strokeDasharray="6 2"
      />
      <text
        x={origin.x + casingRadiusPx + 10}
        y={(chamberBottom.y + casingBottom.y) / 2}
        fill={INK}
        fontWeight="bold"
        fontSize="9"
        transform={`rotate(-90 ${origin.x + casingRadiusPx + 10} ${(chamberBottom.y + casingBottom.y) / 2})`}
      >
        SLOTTED PVC CASING (Ø150mm)
      </text>

      {/* Water table */}
      <line x1={30} y1={gwPoint.y} x2={SVG_W - 30} y2={gwPoint.y} stroke="rgb(var(--color-groundwater))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={36} y={gwPoint.y - 6} fill="rgb(var(--color-groundwater))" fontWeight="bold">
        WATER TABLE — where groundwater sits ({n(groundwaterDepthM, 1)}m below ground)
      </text>

      {/* Gravel pack callout */}
      <text x={origin.x - casingRadiusPx - 8} y={casingBottom.y - 12} textAnchor="end" fill={INK_MUTED} fontSize="8.5">
        Gravel pack (5-10mm) around
      </text>
      <text x={origin.x - casingRadiusPx - 8} y={casingBottom.y} textAnchor="end" fill={INK_MUTED} fontSize="8.5">
        slotted zone
      </text>

      <ShapeRenderer shapes={dimDepth.shapes} />

      <text x={SVG_W / 2} y={SVG_H - 44} textAnchor="middle" fill={INK_MUTED} fontSize="9">
        Why this is needed: {borewell.trigger_reason?.replace(/_/g, " ")}
      </text>
      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill={INK_MUTED} fontSize="9">
        SCHEMATIC (CGWB code) — conceptual depth only, confirm with a real bore log
      </text>
    </svg>
  );
}
