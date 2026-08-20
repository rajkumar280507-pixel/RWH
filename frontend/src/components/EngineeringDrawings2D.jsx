import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  worldToSvg,
  computeScale,
  dimensionLine,
  leaderLine,
  northArrow,
  titleBlock,
  scaleBar,
} from "../lib/cadGeometry.js";
import MaterialPatternDefs, { materialFill } from "../lib/materialPatterns.jsx";
import PitTypeSwitcher, { defaultStructureView } from "./cad/PitTypeSwitcher.jsx";
import MaterialSpecPopup from "./cad/MaterialSpecPopup.jsx";

const n = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
const today = () => new Date().toISOString().slice(0, 10);

export default function EngineeringDrawings2D({ result }) {
  const [view, setView] = useState("cross_section");
  const [structureView, setStructureView] = useState(() => defaultStructureView(result));
  const [inspect, setInspect] = useState(null); // { material, position }

  const geometry = useMemo(() => deriveStructureGeometry(structureView, result), [structureView, result]);

  if (!result) return null;

  const isInjectionBore = Boolean(result.injection_borewell);
  const filterMedia = result.filter_media || [];

  const openMaterial = (material, evt) => {
    setInspect({ material, position: { x: evt.clientX, y: evt.clientY } });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-xs text-slate-200 shadow-xl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="text-accent">📐</span> 2D Technical Engineering CAD Drawings
          </h3>
          <p className="text-[11px] text-slate-400">
            IS 15797:2008 & CGWB Technical Guidelines · Auto-fit scale · Dimensions in metres · Click any
            material fill for its spec sheet
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
        </div>
      )}

      {/* SVG Canvas Container */}
      <div className="relative flex justify-center overflow-x-auto rounded-lg border border-slate-800 bg-[#070d19] p-4">
        {view === "cross_section" &&
          (geometry ? (
            <CrossSectionSvg
              geometry={geometry}
              filterMedia={filterMedia}
              injectionBorewell={result.injection_borewell}
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-accent">Filter Media Layer Specs</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-amber-400">Construction Tolerances</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
            <li>• Pit/trench excavation side slope 1:0.5 (safe batter)</li>
            <li>• Inspection chamber masonry: 230mm brickwork</li>
            <li>• Perforated pipe slot width: 3mm at 50mm spacing</li>
          </ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <span className="font-bold text-emerald-400">Regulatory Compliance</span>
          <ul className="mt-1.5 flex flex-col gap-1 text-slate-400">
            <li>• Code: IS 15797:2008 & CGWB RTRWH Code</li>
            <li>• Separation: ≥3.0m above seasonal water table</li>
            <li>• First Flush Diversion: {n(0.5, 1)} mm over catchment</li>
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
      <marker id="cad-arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill="rgb(var(--color-recharge-water))" />
      </marker>
      <marker id="cad-arrow-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M6,0 L0,3 L6,6 Z" fill="rgb(var(--color-recharge-water))" />
      </marker>
      <marker id="cad-arrow-leader" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill="rgb(var(--color-sand))" />
      </marker>
      <marker id="cad-arrow-flow" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="rgb(var(--color-groundwater))" />
      </marker>
      <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />
      </pattern>
      <MaterialPatternDefs />
    </defs>
  );
}

function ChromeOverlay({ width, height, drawingTitle, scalePxPerM, north = { x: 30, y: 40 } }) {
  const na = northArrow(north, 22);
  const sb = scaleBar({ x: 20, y: height - 34 }, scalePxPerM, 3, 1);
  const tb = titleBlock({
    x: width - 216,
    y: height - 60,
    width: 206,
    height: 52,
    drawingTitle,
    scale: `1px = ${scalePxPerM > 0 ? n(1 / scalePxPerM, 3) : "—"}m`,
    date: today(),
    drawnBy: "RWH-DSS Design Engine",
  });
  return (
    <>
      <g className="text-amber-400">
        <ShapeRenderer shapes={na.shapes} />
      </g>
      <g className="text-slate-400">
        <ShapeRenderer shapes={sb.shapes} />
      </g>
      <g className="text-slate-500">
        <ShapeRenderer shapes={tb.shapes} />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cross Section A-A
// ---------------------------------------------------------------------------

function CrossSectionSvg({ geometry, filterMedia, injectionBorewell, onMaterialClick }) {
  const SVG_W = 660;
  const SVG_H = 460;

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

  const drawTop = 92; // px reserved above for GL label + inlet pipe
  const drawBottom = SVG_H - 96; // px reserved below for dimensions/title block
  const scale = computeScale(
    { width: topWidthM + 1.0, height: excavationDepthM },
    { width: SVG_W - 140, height: drawBottom - drawTop },
    0
  );

  const origin = { x: SVG_W / 2, y: drawTop };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, flipY: false });

  const widthAt = (yM) => topWidthM - (topWidthM - widthM) * (yM / excavationDepthM);

  // Excavation outline (battered trapezoid).
  const topL = w2s(-topWidthM / 2, 0);
  const topR = w2s(topWidthM / 2, 0);
  const botL = w2s(-widthM / 2, excavationDepthM);
  const botR = w2s(widthM / 2, excavationDepthM);
  const excavationPoints = `${topL.x},${topL.y} ${topR.x},${topR.y} ${botR.x},${botR.y} ${botL.x},${botL.y}`;

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
  const dimDepth = dimensionLine(w2s(topWidthM / 2, 0), w2s(topWidthM / 2, excavationDepthM), -34, `${n(excavationDepthM, 2)} m`);
  const dimWidth = dimensionLine(botL, botR, 28, geometry.diameterM ? `Ø ${n(widthM, 2)} m` : `${n(widthM, 2)} m`);

  // Inlet pipe leader (illustrative entry point at top-left of excavation).
  const inletFeature = w2s(-topWidthM / 2 + 0.15, 0.05);
  const inletLabel = { x: origin.x - 220, y: drawTop - 26 };
  const inletLeader = leaderLine(inletLabel, inletFeature, "INLET PIPE (PVC)");

  const groundY = w2s(0, 0).y;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#cad-grid)" />

      {/* Ground surface line, spanning the full canvas width */}
      <line x1={30} y1={groundY} x2={SVG_W - 30} y2={groundY} stroke="rgb(var(--color-success))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={36} y={groundY - 8} fill="rgb(var(--color-success))" fontWeight="bold">
        GL (GROUND LEVEL 0.00m)
      </text>

      {/* Excavation outline */}
      <polygon points={excavationPoints} fill="rgb(var(--color-ground) / 0.15)" stroke="rgb(var(--color-ground))" strokeWidth="2" />

      {/* Freeboard void */}
      {freeboardShape && (
        <>
          <polygon points={freeboardShape} fill="rgb(var(--color-recharge-water) / 0.08)" stroke="rgb(var(--color-recharge-water))" strokeWidth="1" strokeDasharray="4 2" />
          <text x={origin.x} y={groundY + (freeboardM * scale) / 2 + 3} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontSize="9">
            FREEBOARD {n(freeboardM, 2)}m
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
          <text x={origin.x} y={midY} textAnchor="middle" fill="#f8fafc" fontWeight="bold" style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "#020617", strokeWidth: 3 }}>
            {layer.material.toUpperCase()} — {layer.particle_size_note} ({n(layer.thickness_fraction * 100, 0)}%)
          </text>
        </g>
      ))}

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

      {/* Inlet pipe */}
      <g className="text-recharge-water" style={{ color: "rgb(var(--color-recharge-water))" }}>
        <ShapeRenderer shapes={inletLeader.shapes} />
      </g>

      {/* Dimension lines */}
      <ShapeRenderer shapes={dimDepth.shapes} />
      <ShapeRenderer shapes={dimWidth.shapes} />

      {geometry.countLabel && (
        <text x={origin.x} y={SVG_H - 78} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontWeight="bold" fontSize="10">
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
  const SVG_H = 420;
  const drawTop = 60;
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
  // needs both its width and length dimensioned.
  const dimWidth = dimensionLine(
    w2s(-widthM / 2, -lengthM / 2),
    w2s(widthM / 2, -lengthM / 2),
    26,
    isCircular ? `Ø ${n(widthM, 2)} m` : `${n(widthM, 2)} m`
  );
  const dimLength = isCircular
    ? null
    : dimensionLine(w2s(widthM / 2, -lengthM / 2), w2s(widthM / 2, lengthM / 2), 26, `${n(lengthM, 2)} m`);

  const inletLeader = leaderLine({ x: 60, y: origin.y - 60 }, w2s(-widthM / 2, 0), "INLET PIPE (PVC)");
  const overflowLeader = leaderLine({ x: SVG_W - 60, y: origin.y - 60 }, w2s(widthM / 2, 0), "OVERFLOW TO DRAIN");

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

      {/* Centerlines */}
      <line x1={centerPx.x} y1={drawTop - 10} x2={centerPx.x} y2={drawBottom + 10} stroke="#334155" strokeWidth="1" strokeDasharray="8 4" />
      <line x1={40} y1={centerPx.y} x2={SVG_W - 40} y2={centerPx.y} stroke="#334155" strokeWidth="1" strokeDasharray="8 4" />

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
      <text x={centerPx.x} y={centerPx.y + 3} textAnchor="middle" fill="rgb(var(--color-info))" fontWeight="bold" fontSize="8">
        SILT TRAP
      </text>

      <g style={{ color: "rgb(var(--color-recharge-water))" }}>
        <ShapeRenderer shapes={inletLeader.shapes} />
      </g>
      <g style={{ color: "rgb(var(--color-danger))" }}>
        <ShapeRenderer shapes={overflowLeader.shapes} />
      </g>

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
      <rect width={SVG_W} height={SVG_H} fill="#070d19" />

      {blocks.map((b, i) => (
        <g key={b.layer.layer_order}>
          {i > 0 && (
            <line
              x1={SVG_W / 2}
              y1={blocks[i - 1].y + blocks[i - 1].h}
              x2={SVG_W / 2}
              y2={b.y}
              stroke="rgb(var(--color-recharge-water))"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={materialFill(b.layer.material)}
            stroke="rgb(var(--color-ground))"
            strokeWidth="2"
            rx="4"
            style={{ cursor: "pointer" }}
            onClick={(e) => onMaterialClick(b.layer.material, e)}
          />
          <text x={SVG_W / 2} y={b.y + b.h / 2 - 10} textAnchor="middle" fill="#f8fafc" fontWeight="bold" style={{ pointerEvents: "none" }}>
            LAYER {b.layer.layer_order}: {b.layer.material.toUpperCase()} ({b.layer.particle_size_note})
          </text>
          <text x={SVG_W / 2} y={b.y + b.h / 2 + 6} textAnchor="middle" fill="#cbd5e1" style={{ pointerEvents: "none" }}>
            {n(b.layer.thickness_fraction * 100, 0)}% of depth ≈ {n(b.layer.thickness_fraction * referenceDepthM, 2)}m · Porosity {n(b.layer.porosity, 2)}
          </text>
          <text x={SVG_W / 2} y={b.y + b.h / 2 + 20} textAnchor="middle" fill="#94a3b8" style={{ pointerEvents: "none" }}>
            Vol {n(b.layer.volume_m3, 3)} m³ · {n(b.layer.weight_kg, 0)} kg · k = {n(b.layer.hydraulic_conductivity_mm_hr, 0)} mm/hr
          </text>
        </g>
      ))}

      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill="#64748b">
        EXPLODED FILTER MEDIA STACK VIEW (IS 15797:2008) — click a layer for its spec sheet
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
      <rect width={SVG_W} height={SVG_H} fill="#070d19" />

      {/* Roof Downpipe */}
      <rect x="60" y="50" width="20" height="170" fill="rgb(var(--color-info))" rx="3" />
      <text x="70" y="38" textAnchor="middle" fill="rgb(var(--color-info))">
        ROOF DOWNPIPE
      </text>
      <text x="70" y="234" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
        {downpipeCount} × {downpipeMm}mm PVC
      </text>

      {/* First Flush Unit */}
      <rect x="130" y="150" width="72" height="120" fill="rgb(var(--color-sand) / 0.15)" stroke="rgb(var(--color-sand))" strokeWidth="2" rx="4" />
      <text x="166" y="172" textAnchor="middle" fill="rgb(var(--color-sand))" fontWeight="bold">
        FIRST FLUSH
      </text>
      <text x="166" y="192" textAnchor="middle" fill="#d97706" fontSize="8.5">
        {n(ffLitres, 0)} L diverted
      </text>

      {/* Silt Trap / Inspection Chamber */}
      <rect x="262" y="130" width="108" height="140" fill="rgb(var(--color-ground) / 0.15)" stroke="rgb(var(--color-recharge-water))" strokeWidth="2" rx="4" />
      <text x="316" y="158" textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontWeight="bold">
        SILT TRAP
      </text>
      <text x="316" y="178" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
        Baffle chamber
      </text>
      <text x="316" y="192" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
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

      {/* Connecting mains, with flow-direction arrows */}
      <path d="M 80 170 L 130 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <path d="M 202 170 L 262 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <path d="M 370 170 L 420 170" stroke="rgb(var(--color-info))" strokeWidth="3" markerEnd="url(#cad-arrow-flow)" />
      <text x="272" y="120" textAnchor="middle" fill="#94a3b8" fontSize="8.5">
        Collection main {mainMm}mm PVC
      </text>

      {/* Overflow */}
      <path d="M 520 190 L 570 190 L 570 260" stroke="rgb(var(--color-danger))" strokeWidth="2.5" strokeDasharray="5 3" markerEnd="url(#cad-arrow-flow)" />
      <text x="546" y="280" textAnchor="middle" fill="rgb(var(--color-danger))" fontSize="8.5">
        Overflow {overflowMm}mm → storm drain
      </text>

      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill="#64748b">
        FIRST FLUSH, SILT TRAP & PIPE LAYOUT SCHEMATIC (topological — not to scale; pipe sizes are the actual computed values)
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

  const dimDepth = dimensionLine(w2s(1.3, 0), w2s(1.3, borewell.conceptual_depth_m), 0, `${n(borewell.conceptual_depth_m, 1)} m`);

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="#070d19" />

      <line x1={30} y1={chamberTop.y} x2={SVG_W - 30} y2={chamberTop.y} stroke="rgb(var(--color-success))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={36} y={chamberTop.y - 8} fill="rgb(var(--color-success))" fontWeight="bold">
        GL 0.00m
      </text>

      {/* Inspection chamber over the pretreatment structure */}
      <rect x={origin.x - 45} y={chamberTop.y} width="90" height={Math.max(30, chamberBottom.y - chamberTop.y)} fill="rgb(var(--color-ground) / 0.18)" stroke="rgb(var(--color-recharge-water))" strokeWidth="2" />
      <text x={origin.x} y={chamberTop.y + 18} textAnchor="middle" fill="rgb(var(--color-recharge-water))" fontSize="9">
        INSPECTION CHAMBER / PRETREATMENT
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
      <text x={origin.x + casingRadiusPx + 10} y={(chamberBottom.y + casingBottom.y) / 2} fill="#f8fafc" fontWeight="bold" transform={`rotate(-90 ${origin.x + casingRadiusPx + 10} ${(chamberBottom.y + casingBottom.y) / 2})`}>
        SLOTTED PVC CASING (Ø150mm)
      </text>

      {/* Water table */}
      <line x1={30} y1={gwPoint.y} x2={SVG_W - 30} y2={gwPoint.y} stroke="rgb(var(--color-groundwater))" strokeWidth="2" strokeDasharray="6 3" />
      <text x={36} y={gwPoint.y - 6} fill="rgb(var(--color-groundwater))" fontWeight="bold">
        WATER TABLE ({n(groundwaterDepthM, 1)}m bgl)
      </text>

      {/* Gravel pack callout */}
      <text x={origin.x - casingRadiusPx - 8} y={casingBottom.y - 12} textAnchor="end" fill="rgb(var(--color-gravel))" fontSize="8.5">
        Gravel pack (5-10mm) around
      </text>
      <text x={origin.x - casingRadiusPx - 8} y={casingBottom.y} textAnchor="end" fill="rgb(var(--color-gravel))" fontSize="8.5">
        slotted zone
      </text>

      <ShapeRenderer shapes={dimDepth.shapes} />

      <text x={SVG_W / 2} y={SVG_H - 44} textAnchor="middle" fill="#64748b" fontSize="9">
        Trigger: {borewell.trigger_reason?.replace(/_/g, " ")}
      </text>
      <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle" fill="#64748b">
        DEEP RECHARGE / INJECTION BOREWELL SCHEMATIC (CGWB CODE) — conceptual depth only, finalize from bore log
      </text>
    </svg>
  );
}
