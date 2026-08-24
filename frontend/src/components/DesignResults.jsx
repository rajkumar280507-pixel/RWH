import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  PencilRuler,
  Building,
  Waves,
  Receipt,
  Wrench,
  Printer,
  AlertTriangle,
  Satellite,
  PenLine,
  FileText,
  Loader2,
  Download,
  Box,
  Droplets,
  IndianRupee,
  Ruler,
  Shovel,
} from "lucide-react";
import EmptyState from "./ui/EmptyState.jsx";
import EngineeringDrawings2D from "./EngineeringDrawings2D.jsx";
import RechargeStructureScene from "./three/RechargeStructureScene.jsx";
import QuantityTakeoffPanel from "./cad/QuantityTakeoffPanel.jsx";
import WaterDemandTab from "./water/WaterDemandTab.jsx";
import { generateReport, downloadReportUrl } from "../services/api.js";

// Serializes the currently-rendered CAD <svg> (whichever view tab is active)
// into a self-contained base64 data URL the backend can embed directly as an
// <img src=...> in the PDF report — a real captured drawing, not a null
// placeholder.
function svgToDataUrl(container) {
  const svg = container?.querySelector("svg");
  if (!svg) return null;
  let markup = new XMLSerializer().serializeToString(svg);
  if (!markup.includes('xmlns="http://www.w3.org/2000/svg"')) {
    markup = markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const encoded = btoa(unescape(encodeURIComponent(markup)));
  return `data:image/svg+xml;base64,${encoded}`;
}

const n = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);

const TABS = [
  { id: "drawings_2d", label: "2D CAD Drawings (Animated)", icon: PencilRuler },
  { id: "summary", label: "Hydraulic Capacity", icon: LayoutGrid },
  { id: "water_demand", label: "Water Demand & Storage", icon: Droplets },
];

export default function DesignResults({ result }) {
  const [tab, setTab] = useState("drawings_2d");
  const cadSheetRef = useRef(null);

  const generate = useMutation({
    mutationFn: () => {
      const cadDrawingImage = tab === "drawings_2d" ? svgToDataUrl(cadSheetRef.current) : null;
      return generateReport(result.design_id, { cadDrawingImage, snapshot3dImage: null });
    },
  });

  if (!result) {
    return (
      <EmptyState
        icon={<PenLine size={20} />}
        title="Your design will appear here"
        description="Fill in the rooftop catchment and design inputs on the left, then submit — the engineering-grade design populates this panel once generated."
        className="min-h-[480px]"
      />
    );
  }

  const pitLabel = result.pit
    ? `Circular Pit (Ø${n(result.pit.diameter_m, 1)}m × ${n(result.pit.depth_m, 1)}m)`
    : result.trench
    ? `Trench (${n(result.trench.width_m, 1)}m × ${n(result.trench.total_length_m, 1)}m)`
    : "Recharge Structure";

  return (
    <div className="flex flex-col gap-3 print:p-0">
      {/* Sleek Executive KPI Summary Ribbon */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="glass-panel flex flex-col gap-0.5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5">
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Droplets size={12} className="text-sky-500" />
            Annual Water Saved
          </div>
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{n(result.annual_harvest_m3, 1)} m³/yr</span>
        </div>

        <div className="glass-panel flex flex-col gap-0.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Ruler size={12} className="text-emerald-500" />
            Structure Sizing
          </div>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate" title={pitLabel}>
            {pitLabel}
          </span>
        </div>

        <div className="glass-panel flex flex-col gap-0.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Droplets size={12} className="text-amber-500" />
            Groundwater Depth
          </div>
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate">
            {n(result.groundwater_depth_m, 1)} m bgl
          </span>
        </div>

        <div className="glass-panel flex flex-col gap-0.5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5">
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            <Shovel size={12} className="text-purple-500" />
            Excavation Volume
          </div>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{n(result.excavation_volume_m3, 2)} m³</span>
        </div>
      </div>

      {/* Location Telemetry & Report Generator Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          <DataSourceBanner label="Rainfall" source={result.rainfall_source} value={`${n(result.annual_rainfall_mm, 1)} mm/yr`} />
          <DataSourceBanner label="Groundwater" source={result.groundwater_source} value={`${n(result.groundwater_depth_m)} m below ground`} />
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2 print:hidden">
          {result.design_id != null && (
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-panel/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-500/40 hover:text-sky-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              {generate.isSuccess ? "Regenerate Report" : "Generate PDF Report"}
            </button>
          )}
          {generate.isSuccess && (
            <a
              href={downloadReportUrl(result.design_id)}
              className="flex items-center gap-1.5 rounded-xl border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition hover:bg-success/20"
            >
              <Download size={13} /> Download PDF
            </a>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 transition hover:bg-sky-500/20 cursor-pointer"
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      {generate.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-[11px] text-danger">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Failed to generate report: {generate.error?.response?.data?.detail ?? generate.error?.message ?? "unknown error"}
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Drawing & Summary Tabs */}
      <div className="glass-panel flex items-center gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-800 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition cursor-pointer ${
              tab === t.id
                ? "text-sky-600 dark:text-sky-400 font-semibold"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab === t.id && (
              <motion.span
                layoutId="design-results-tab-highlight"
                className="absolute inset-0 rounded-lg bg-sky-500/15"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <t.icon size={13} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {tab === "drawings_2d" && <EngineeringDrawings2D ref={cadSheetRef} result={result} />}
          {tab === "summary" && <HydraulicsTab r={result} />}
          {tab === "water_demand" && <WaterDemandTab result={result} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SummaryTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Catchment & Water Balance">
        <MetricGrid>
          <Metric label="Catchment area" value={n(r.catchment_area_sqm)} unit="m²" />
          <Metric label="Runoff coefficient" value={n(r.runoff_coefficient, 3)} />
          <Metric label="Hydrologic soil group" value={r.hydrologic_soil_group} />
          <Metric label="Permeability" value={n(r.permeability_mm_hr, 1)} unit="mm/hr" />
          <Metric label="Gross annual runoff" value={n(r.gross_annual_runoff_m3)} unit="m³/yr" />
          <Metric label="Net annual harvest" value={n(r.annual_harvest_m3)} unit="m³/yr" highlight />
          <Metric label="Annual recharge target" value={n(r.annual_recharge_target_m3)} unit="m³/yr" highlight />
          <Metric label="Design-storm volume" value={n(r.design_storm_volume_m3, 3)} unit="m³" />
          {r.storage_tank_m3 != null && (
            <Metric label="Storage tank" value={n(r.storage_tank_m3)} unit="m³" />
          )}
          <Metric label="Expected GW rise" value={n(r.expected_gw_rise_m, 3)} unit="m/yr" />
          <Metric label="Excavation" value={n(r.excavation_volume_m3)} unit="m³" />
          <Metric label="Estimated cost" value={inr(r.estimated_cost_inr)} highlight />
        </MetricGrid>
      </Panel>
    </div>
  );
}

function StructureTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      {r.pit && (
        <Panel title={`Recharge Pit${r.pit.pit_count > 1 ? `s — ${r.pit.pit_count} nos.` : ""}`}>
          <MetricGrid>
            <Metric label="Number of pits" value={r.pit.pit_count} />
            <Metric label="Diameter" value={n(r.pit.diameter_m)} unit="m" />
            <Metric label="Effective depth" value={n(r.pit.depth_m)} unit="m" />
            <Metric label="Freeboard" value={n(r.pit.freeboard_m)} unit="m" />
            <Metric label="Volume per pit" value={n(r.pit.single_pit_volume_m3, 3)} unit="m³" />
            <Metric label="Total volume" value={n(r.pit.total_volume_m3, 3)} unit="m³" highlight />
          </MetricGrid>
        </Panel>
      )}

      {r.trench && (
        <Panel title="Recharge Trench">
          <MetricGrid>
            <Metric label="Width" value={n(r.trench.width_m)} unit="m" />
            <Metric label="Depth" value={n(r.trench.depth_m)} unit="m" />
            <Metric label="Total length" value={n(r.trench.total_length_m)} unit="m" />
            <Metric label="Segments" value={`${r.trench.segment_count} × ${n(r.trench.segment_length_m)} m`} />
            <Metric label="Total volume" value={n(r.trench.total_volume_m3, 3)} unit="m³" highlight />
          </MetricGrid>
        </Panel>
      )}

      {r.injection_borewell && (
        <Panel title="Injection Borewell — Conceptual Only" tone="danger">
          <MetricGrid>
            <Metric label="Trigger" value={r.injection_borewell.trigger_reason} />
            <Metric label="Conceptual depth" value={n(r.injection_borewell.conceptual_depth_m, 1)} unit="m" />
          </MetricGrid>
          <div className="mt-3 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div>• {r.injection_borewell.casing_zone_note}</div>
            <div>• {r.injection_borewell.gravel_pack_note}</div>
          </div>
          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[11px] text-danger">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{r.injection_borewell.warning_text}</span>
          </div>
        </Panel>
      )}

      <Panel title="Filter Media Stack">
        <DataTable
          head={["Layer", "Material", "Particle size", "Vol (m³)", "Weight (kg)", "Porosity", "Void ratio", "K (mm/hr)"]}
          rows={r.filter_media.map((l) => [
            l.layer_order,
            l.material,
            l.particle_size_note,
            n(l.volume_m3, 3),
            n(l.weight_kg, 1),
            n(l.porosity, 2),
            n(l.void_ratio, 3),
            n(l.hydraulic_conductivity_mm_hr, 0),
          ])}
        />
        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          Layers listed top to bottom. Coarsest material sits at the base to maintain infiltration
          capacity; the sand layer at top does the filtering and is the serviceable element.
        </p>
      </Panel>
    </div>
  );
}

function HydraulicsTab({ r }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Peak Flow & Pipe Conveyance Sizing">
        <MetricGrid>
          <Metric label="Design intensity" value={n(r.peak_rainfall_intensity_mm_hr, 0)} unit="mm/hr" />
          <Metric label="Peak discharge" value={n(r.peak_discharge_lps, 2)} unit="L/s" highlight />
          <Metric label="Roof Downpipes" value={`${r.downpipe_count} × ${r.downpipe_diameter_mm} mm PVC`} />
          <Metric label="Collection Main" value={`${r.conveyance_pipe_diameter_mm} mm PVC`} />
          <Metric label="Overflow Pipe" value={`${r.overflow_pipe_diameter_mm} mm PVC`} />
        </MetricGrid>
      </Panel>

      <Panel title="Pipeline Water Flow Path — Roof Catchment to Recharge Pit">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300">
            <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] text-white">1</span>
            Roof Catchment ({n(r.catchment_area_sqm)} m²)
          </div>
          <span className="text-slate-400">➔</span>
          <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300">
            <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] text-white">2</span>
            Downpipe ({r.downpipe_count}×{r.downpipe_diameter_mm}mm)
          </div>
          <span className="text-slate-400">➔</span>
          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">3</span>
            First Flush ({n(r.first_flush_volume_l, 0)} L)
          </div>
          <span className="text-slate-400">➔</span>
          <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300">
            <span className="rounded bg-sky-500 px-1.5 py-0.5 text-[10px] text-white">4</span>
            Silt Trap ({n(r.desilting_chamber_m3, 3)} m³)
          </div>
          <span className="text-slate-400">➔</span>
          <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
            <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">5</span>
            Pit Inlet Pipe ➔ Filter Stack ➔ Aquifer
          </div>
        </div>
      </Panel>

      <Panel title="Pretreatment">
        <MetricGrid>
          <Metric label="First-flush volume" value={n(r.first_flush_volume_l, 1)} unit="litres" />
          <Metric label="Desilting chamber" value={n(r.desilting_chamber_m3, 3)} unit="m³" />
        </MetricGrid>
      </Panel>

      <Panel title="Infiltration Performance & Depth Budget">
        <MetricGrid>
          <Metric label="Infiltration capacity" value={n(r.infiltration_rate_m3_per_hr, 3)} unit="m³/hr" />
          <Metric label="Time to empty when full" value={n(r.time_to_empty_hr, 1)} unit="hours" highlight />
          <Metric label="Groundwater Table" value={n(r.groundwater_depth_m, 1)} unit="m bgl" />
          <Metric label="Expected water-table rise" value={n(r.expected_gw_rise_m, 3)} unit="m/yr" highlight />
        </MetricGrid>
        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          The structure must fully drain between storm events to be available for the next one. An
          emptying time beyond roughly 48 hours indicates the base area should be increased or the
          soil's infiltration capacity re-verified by a field percolation test.
        </p>
      </Panel>
    </div>
  );
}

function BoqTab({ r }) {
  return (
    <Panel title="Bill of Quantities">
      <DataTable
        head={["Item", "Unit", "Quantity", "Rate (₹)", "Amount (₹)"]}
        rows={r.boq.map((i) => [
          i.item,
          i.unit,
          n(i.quantity, 2),
          Number(i.unit_rate_inr ?? 0).toLocaleString("en-IN"),
          Number(i.amount_inr ?? 0).toLocaleString("en-IN"),
        ])}
        footer={["Total (indicative)", "", "", "", `₹${Number(r.estimated_cost_inr).toLocaleString("en-IN")}`]}
        alignRight={[2, 3, 4]}
      />
      <p className="mt-3 rounded-lg border border-slate-300 bg-surface/60 p-2.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Rates are illustrative placeholders. Substitute the current state PWD / CPWD Schedule of Rates
        before this figure is used for a tender or budget submission. Quantities exclude contingency,
        labour escalation, and GST.
      </p>
    </Panel>
  );
}

/* ---------- shared presentational pieces ---------- */

function Panel({ title, tone = "accent", children }) {
  const border = tone === "danger" ? "border-danger/30" : "border-slate-200 dark:border-slate-800";
  return (
    <section className={`glass-panel rounded-xl border ${border} bg-panel/50 p-3`}>
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function MetricGrid({ children }) {
  return <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function Metric({ label, value, unit, highlight = false }) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        highlight ? "border-accent/30 bg-accent/5" : "border-slate-200 bg-surface/50 dark:border-slate-800"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function DataTable({ head, rows, footer, alignRight = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr className="border-b border-slate-300 dark:border-slate-700 text-left">
            {head.map((h, i) => (
              <th key={h} className={`py-2 ${alignRight.includes(i) ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200/70 hover:bg-slate-100 dark:border-slate-800/70 dark:hover:bg-slate-800/30">
              {r.map((c, j) => (
                <td key={j} className={`py-2 ${alignRight.includes(j) ? "text-right" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
              {footer.map((c, i) => (
                <td key={i} className={`py-2.5 ${alignRight.includes(i) ? "text-right" : ""}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function DataSourceBanner({ label, source, value }) {
  const live = source?.used;
  return (
    <div className="glass-panel flex items-center justify-between rounded-xl border border-slate-200 bg-panel/40 px-3 py-2 text-xs dark:border-slate-800">
      <div>
        <div className="font-semibold text-slate-900 dark:text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {live ? (
            <span className="flex items-center gap-1 font-medium text-success">
              <Satellite size={11} className="shrink-0" />
              Live {source.kind} telemetry ({source.station_name ?? source.station_code}, {n(source.distance_km, 1)} km)
            </span>
          ) : (
            <span className="font-medium text-warning">Manual / default override</span>
          )}
        </div>
      </div>
      <div className="text-right font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function ConstructionGuideTab({ r }) {
  const isPit = Boolean(r.pit);
  const isTrench = Boolean(r.trench);
  const isBore = Boolean(r.injection_borewell);
  const totalDepth = r.pit?.depth_m || r.trench?.depth_m || 3.0;

  const fSand = r.filter_media?.find((m) => m.material.toLowerCase().includes("sand"));
  const fGravel = r.filter_media?.find((m) => m.material.toLowerCase().includes("gravel"));
  const fAgg = r.filter_media?.find((m) => m.material.toLowerCase().includes("aggregate") || m.material.toLowerCase().includes("boulder"));

  return (
    <div className="flex flex-col gap-4 text-xs">
      <Panel title={`Construction Procedure — ${r.structure_type ? r.structure_type.replace(/_/g, " ").toUpperCase() : "RECHARGE PIT"}`}>
        <ol className="flex flex-col gap-2.5 text-slate-700 dark:text-slate-300 list-decimal pl-4">
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Site Layout & Excavation:</strong> Excavate {isPit ? `pit (${n(r.pit?.diameter_m || 2.0)}m Ø)` : isTrench ? `trench (${n(r.trench?.width_m || 1.0)}m wide × ${n(r.trench?.total_length_m || 6.0)}m long)` : "structure"} to design depth of {n(totalDepth)}m maintaining 1:0.5 safe side slope. Total excavation volume is {n(r.excavation_volume_m3)}m³.
          </li>
          {isBore && (
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Injection Borewell Drilling:</strong> Drill {r.injection_borewell?.casing_diameter_mm || 150}mm Ø borewell down to conceptual depth of {n(r.injection_borewell?.conceptual_depth_m || 15.0)}m. Insert slotted PVC pipe with 3mm intake slots and pack pea gravel around outer annular space.
            </li>
          )}
          {fAgg && (
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Base Filter Layer ({fAgg.material}):</strong> Fill bottom {n((fAgg.thickness_fraction || 0.5) * totalDepth)}m with clean {fAgg.particle_size_note} boulders ({n(fAgg.volume_m3, 2)}m³, {n(fAgg.weight_kg, 0)}kg).
            </li>
          )}
          {fGravel && (
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Middle Filter Layer ({fGravel.material}):</strong> Fill middle {n((fGravel.thickness_fraction || 0.25) * totalDepth)}m with {fGravel.particle_size_note} graded gravel ({n(fGravel.volume_m3, 2)}m³, {n(fGravel.weight_kg, 0)}kg).
            </li>
          )}
          {fSand && (
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Top Filter Layer ({fSand.material}):</strong> Lay top {n((fSand.thickness_fraction || 0.25) * totalDepth)}m with {fSand.particle_size_note} river sand ({n(fSand.volume_m3, 2)}m³, {n(fSand.weight_kg, 0)}kg).
            </li>
          )}
          <li>
            <strong className="text-slate-900 dark:text-slate-100">Inlet Pipe & Pretreatment:</strong> Install {r.downpipe_diameter_mm || 110}mm Ø downpipe and {n(r.first_flush_volume_l, 0)}L first-flush diverter before connecting to the {n(r.desilting_chamber_m3, 2)}m³ silt trap chamber.
          </li>
        </ol>
      </Panel>

      <Panel title="Operation & Maintenance Schedule">
        <DataTable
          head={["Frequency", "Component", "Maintenance Action Required"]}
          rows={[
            ["Pre-Monsoon (Annual)", "Roof Catchment & Gutters", "Clean leaves, dust, and debris. Inspect roof slope and pipe joints."],
            ["Post-Storm Event", "First Flush Diverter", `Flush out first ${n(r.first_flush_volume_l, 0)}L settled silt and debris after every major rainfall.`],
            ["Quarterly", "Top Sand Filter Layer", "Scrape off top 50mm clogged sand, wash with clean water, and replace."],
            ["Bi-Annually", "Desilting Chamber", `De-silt the ${n(r.desilting_chamber_m3, 2)}m³ chamber bottom and check inlet baffle screens.`],
            ["Every 3 Years", "Filter Media Stack", "Remove, wash, and re-lay gravel and boulder filter stack to restore original infiltration rate."],
          ]}
        />
      </Panel>
    </div>
  );
}
