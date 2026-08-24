import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  worldToSvg,
  computeScale,
  dimensionLine,
  leaderLine,
  northArrow,
  titleBlock,
  scaleBar,
} from "../../lib/cadGeometry.js";
import { TANK_MATERIALS, TANK_FREEBOARD_M } from "../../lib/waterDemand.js";

// Self-contained drafting kit, deliberately duplicated (not imported) from
// EngineeringDrawings2D.jsx — that file is the existing recharge-pit CAD and
// is explicitly off-limits to touch, so this stays fully independent rather
// than risk it.
const INK = "#1a1a1a";
const INK_MUTED = "#52606d";
const today = () => new Date().toISOString().slice(0, 10);
const n = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));

function ShapeRenderer({ shapes }) {
  return (
    <>
      {shapes.map((s, i) => {
        switch (s.type) {
          case "line":
            return (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke || "currentColor"} strokeWidth={s.strokeWidth ?? 1} strokeDasharray={s.dash} opacity={s.opacity} markerStart={s.markerStart} markerEnd={s.markerEnd} />
            );
          case "rect":
            return (
              <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.strokeWidth} rx={s.rx} opacity={s.opacity} strokeDasharray={s.dash} />
            );
          case "circle":
            return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.strokeWidth} opacity={s.opacity} />;
          case "polygon":
            return <polygon key={i} points={s.points} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.strokeWidth} opacity={s.opacity} />;
          case "text":
            return (
              <text key={i} x={s.x} y={s.y} textAnchor={s.anchor || "start"} fontSize={s.size || 10} fontWeight={s.weight || 400} fill={s.fill || "currentColor"}>
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

function CadDefs() {
  return (
    <defs>
      <marker id="tank-arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
      </marker>
      <marker id="tank-arrow-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M6,0 L0,3 L6,6 Z" fill={INK} />
      </marker>
      <marker id="tank-arrow-leader" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
      </marker>
      <pattern id="tank-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="1" />
      </pattern>
      <pattern id="tank-water" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#38bdf8" opacity="0.25" />
        <path d="M0,5 Q2.5,3 5,5 T10,5" fill="none" stroke="#0ea5e9" strokeWidth="0.6" opacity="0.6" />
      </pattern>
      <pattern id="tank-concrete" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

function ChromeOverlay({ width, height, drawingTitle, scalePxPerM, showNorth = false }) {
  const na = showNorth ? northArrow({ x: 30, y: 40 }, 22) : null;
  const sb = scaleBar({ x: 20, y: height - 34 }, scalePxPerM, 3, scalePxPerM > 40 ? 0.5 : 1);
  const tbWidth = Math.min(220, width * 0.4);
  const tbHeight = 48;
  const tbX = width - tbWidth - 10;
  const tbY = height - tbHeight - 10;
  const tb = titleBlock({
    x: tbX,
    y: tbY,
    width: tbWidth,
    height: tbHeight,
    projectName: "RTRWH System",
    drawingTitle,
    scale: `1px = ${scalePxPerM > 0 ? n(1 / scalePxPerM, 3) : "—"}m`,
    date: today(),
    drawnBy: "RWH-DSS Engine",
  });
  return (
    <>
      {na && (
        <g style={{ color: INK }}>
          <ShapeRenderer shapes={na.shapes} />
        </g>
      )}
      <g style={{ color: INK_MUTED }}>
        <ShapeRenderer shapes={sb.shapes} />
      </g>
      <g style={{ color: INK }}>
        <ShapeRenderer shapes={tb.shapes} />
      </g>
    </>
  );
}

function markerize(dim) {
  // dimensionLine()/leaderLine() reference the recharge-pit drawing's marker
  // ids — swap them for this component's own local marker ids so arrowheads
  // actually resolve inside this standalone <svg>.
  dim.shapes.forEach((s) => {
    if (s.markerStart) s.markerStart = "url(#tank-arrow-start)";
    if (s.markerEnd) s.markerEnd = s.markerEnd.includes("leader") ? "url(#tank-arrow-leader)" : "url(#tank-arrow-end)";
  });
  return dim;
}

/**
 * Cross-section elevation of the storage tank sized in WaterDemandTab: wall,
 * water fill up to the design level, freeboard, inlet/overflow/washout/vent
 * pipes, and a foundation slab. Circular tanks are drawn in elevation
 * (diameter as width); rectangular/underground tanks use length as width.
 */
function TankCrossSectionSvg({ tank, materialCode }) {
  const SVG_W = 560;
  const SVG_H = 400;
  const mat = TANK_MATERIALS.find((m) => m.code === materialCode) ?? TANK_MATERIALS[0];
  const wallM = mat.wallThicknessM;

  const isCircular = tank.shape === "circular";
  const widthM = isCircular ? tank.diameterM : tank.lengthM;
  const heightM = tank.heightM;
  const totalHeightM = heightM + TANK_FREEBOARD_M;

  const drawTop = 50;
  const drawBottom = SVG_H - 130;
  const scale = computeScale({ width: widthM + wallM * 2, height: totalHeightM }, { width: SVG_W - 140, height: drawBottom - drawTop }, 20);
  const origin = { x: SVG_W / 2, y: drawBottom };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, svgHeight: SVG_H, flipY: true });

  const halfW = widthM / 2;
  const wallPx = wallM * scale;

  const outerTL = w2s(-halfW - wallM, totalHeightM);
  const outerBR = w2s(halfW + wallM, 0);
  const waterTL = w2s(-halfW, heightM);
  const waterBR = w2s(halfW, 0);

  const foundationH = 12;
  const foundationY = outerBR.y;

  const dimHeight = markerize(dimensionLine(w2s(-halfW - wallM, 0), w2s(-halfW - wallM, totalHeightM), -30, `${n(totalHeightM)}m`));
  const dimWater = markerize(dimensionLine(w2s(halfW + wallM, 0), w2s(halfW + wallM, heightM), 30, `${n(heightM)}m water`));
  const dimWidth = markerize(dimensionLine(w2s(-halfW - wallM, totalHeightM), w2s(halfW + wallM, totalHeightM), -18, `${n(widthM)}m ${isCircular ? "Ø" : "L"}`));

  const inletLeader = markerize(leaderLine({ x: 40, y: drawTop + 10 }, w2s(-halfW, heightM - 0.05), "INLET PIPE", "#0ea5e9"));
  const overflowLeader = markerize(leaderLine({ x: SVG_W - 40, y: drawTop + 10 }, w2s(halfW, heightM), "OVERFLOW", "#f59e0b"));
  const vent = markerize(leaderLine({ x: 40, y: drawTop - 10 }, w2s(-halfW * 0.4, totalHeightM), "VENT PIPE", "#64748b"));
  const washout = markerize(leaderLine({ x: SVG_W - 40, y: foundationY + foundationH + 30 }, w2s(halfW * 0.5, 0.02), "WASHOUT / DRAIN", "#ef4444"));
  const pump = markerize(leaderLine({ x: 40, y: foundationY + foundationH + 30 }, w2s(-halfW, 0.15), "PUMP OUTLET", "#22c55e"));

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#tank-grid)" />

      {/* Foundation slab */}
      <rect x={outerTL.x - 10} y={foundationY} width={outerBR.x - outerTL.x + 20} height={foundationH} fill="url(#tank-concrete)" stroke={INK} strokeWidth="1" />
      <text x={SVG_W / 2} y={foundationY + foundationH + 12} textAnchor="middle" fontSize="7.5" fill={INK_MUTED}>
        PCC FOUNDATION (100mm) — level, compacted base
      </text>

      {/* Tank wall (outer) */}
      <rect x={outerTL.x} y={outerTL.y} width={outerBR.x - outerTL.x} height={outerBR.y - outerTL.y} fill="#e2e8f0" stroke={INK} strokeWidth="1.5" />
      {/* Water fill (inner, up to design water level) */}
      <rect x={waterTL.x} y={waterTL.y} width={waterBR.x - waterTL.x} height={waterBR.y - waterTL.y} fill="url(#tank-water)" stroke="#0ea5e9" strokeWidth="1" />
      {/* Freeboard air gap label */}
      <text x={SVG_W / 2} y={outerTL.y + 12} textAnchor="middle" fontSize="7.5" fill={INK_MUTED}>
        FREEBOARD {n(TANK_FREEBOARD_M)}m
      </text>
      <text x={SVG_W / 2} y={(waterTL.y + waterBR.y) / 2} textAnchor="middle" fontSize="8" fontWeight="700" fill="#0369a1">
        WATER
      </text>

      <g style={{ color: INK }}>
        <ShapeRenderer shapes={dimHeight.shapes} />
        <ShapeRenderer shapes={dimWater.shapes} />
        <ShapeRenderer shapes={dimWidth.shapes} />
      </g>
      <ShapeRenderer shapes={inletLeader.shapes} />
      <ShapeRenderer shapes={overflowLeader.shapes} />
      <ShapeRenderer shapes={vent.shapes} />
      <ShapeRenderer shapes={washout.shapes} />
      <ShapeRenderer shapes={pump.shapes} />

      <text x={outerTL.x + 4} y={(outerTL.y + outerBR.y) / 2} fontSize="7" fill={INK_MUTED} transform={`rotate(-90 ${outerTL.x + 4} ${(outerTL.y + outerBR.y) / 2})`}>
        WALL {Math.round(wallM * 1000)}mm ({mat.label})
      </text>

      <ChromeOverlay width={SVG_W} height={SVG_H} drawingTitle={`CROSS SECTION — ${tank.label}`} scalePxPerM={scale} />
    </svg>
  );
}

/** Top view: circular tank as a dimensioned circle with a manhole cover;
 * rectangular/underground tank as a dimensioned rectangle. */
function TankTopViewSvg({ tank }) {
  const SVG_W = 520;
  const SVG_H = 380;
  const isCircular = tank.shape === "circular";
  const widthM = isCircular ? tank.diameterM : tank.lengthM;
  const depthM = isCircular ? tank.diameterM : tank.widthM;

  const drawArea = { width: SVG_W - 140, height: SVG_H - 130 };
  const scale = computeScale({ width: widthM, height: depthM }, drawArea, 20);
  const origin = { x: SVG_W / 2, y: SVG_H / 2 - 20 };
  const w2s = (x, y) => worldToSvg({ x, y }, { scale, origin, svgHeight: SVG_H, flipY: true });

  const halfW = (widthM * scale) / 2;
  const halfD = (depthM * scale) / 2;
  const manholeR = Math.min(halfW, halfD) * 0.22;

  const dimW = markerize(dimensionLine({ x: origin.x - halfW, y: origin.y + halfD + 14 }, { x: origin.x + halfW, y: origin.y + halfD + 14 }, 16, `${n(widthM)}m`));
  const dimD = markerize(dimensionLine({ x: origin.x + halfW + 14, y: origin.y - halfD }, { x: origin.x + halfW + 14, y: origin.y + halfD }, 16, `${n(depthM)}m`));

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="font-mono text-[10px]">
      <CadDefs />
      <rect width={SVG_W} height={SVG_H} fill="url(#tank-grid)" />

      {isCircular ? (
        <circle cx={origin.x} cy={origin.y} r={halfW} fill="#e2e8f0" stroke={INK} strokeWidth="1.5" />
      ) : (
        <rect x={origin.x - halfW} y={origin.y - halfD} width={halfW * 2} height={halfD * 2} fill="#e2e8f0" stroke={INK} strokeWidth="1.5" />
      )}
      <circle cx={origin.x} cy={origin.y} r={manholeR} fill="none" stroke={INK} strokeWidth="1.25" strokeDasharray="3 2" />
      <text x={origin.x} y={origin.y + 3} textAnchor="middle" fontSize="7" fill={INK_MUTED}>
        MANHOLE
      </text>

      <g style={{ color: INK }}>
        <ShapeRenderer shapes={dimW.shapes} />
        <ShapeRenderer shapes={dimD.shapes} />
      </g>

      <ChromeOverlay width={SVG_W} height={SVG_H} drawingTitle={`TOP VIEW — ${tank.label}`} scalePxPerM={scale} showNorth />
    </svg>
  );
}

/**
 * Storage Tank CAD — additive drawing view for the tank sized in
 * WaterDemandTab. Entirely self-contained (own defs/shape-renderer) so it
 * never touches EngineeringDrawings2D.jsx, the existing recharge-pit CAD.
 */
export default function StorageTankCAD({ tank, materialCode }) {
  const [view, setView] = useState("cross_section");

  if (!tank) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-sm dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <h4 className="text-sm font-bold text-slate-900">📐 Storage Tank — Engineering Drawing</h4>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <TabBtn id="cross_section" label="Cross Section" active={view} set={setView} />
          <TabBtn id="top_view" label="Top View" active={view} set={setView} />
        </div>
      </div>

      <div className="cad-sheet relative flex justify-center overflow-x-auto rounded-lg border border-slate-300 bg-[#FAFAFA] p-3">
        {view === "cross_section" ? (
          <TankCrossSectionSvg tank={tank} materialCode={materialCode} />
        ) : (
          <TankTopViewSvg tank={tank} />
        )}
      </div>

      <p className="flex items-start gap-1.5 rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-500">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Generated from the sizing above for planning/discussion — not a certified structural drawing. Have it
        reviewed by a licensed civil engineer before construction.
      </p>
    </div>
  );
}

function TabBtn({ id, label, active, set }) {
  return (
    <button
      type="button"
      onClick={() => set(id)}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
        active === id ? "bg-white text-accent shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
