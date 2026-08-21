import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Printer, QrCode, Download, Loader2, Trash2, AlertTriangle } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import {
  deleteDesign,
  getDesign,
  getDesigns,
  generateReport,
  getReport,
  downloadReportUrl,
  resolveStaticUrl,
} from "../services/api.js";

const inr = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
const num = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));

export default function ReportsPage() {
  const [selectedId, setSelectedId] = useState(null);
  const queryClient = useQueryClient();

  const designs = useQuery({ queryKey: ["designs"], queryFn: getDesigns });
  const detail = useQuery({
    queryKey: ["design", selectedId],
    queryFn: () => getDesign(selectedId),
    enabled: !!selectedId,
  });

  const removeDesign = useMutation({
    mutationFn: deleteDesign,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["designs"] });
      if (selectedId === deletedId) setSelectedId(null);
    },
  });

  return (
    <DashboardLayout
      title="Reports"
      subtitle="Every RWH design saved from the design module, with its full engineering breakdown and a generated PDF report."
      actions={
        detail.data && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-panel/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:border-accent/40 hover:text-accent print:hidden"
            title="Lightweight browser print — for the full formatted PDF, use Generate PDF Report below"
          >
            <Printer size={13} /> Print / Save PDF
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 bg-panel/50 p-4 print:hidden">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            Saved designs ({designs.data?.length ?? 0})
          </h3>
          {designs.isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {designs.data?.length === 0 && (
            <EmptyState
              icon={<FileText size={18} />}
              title="No designs saved yet"
              description="Create one in the RWH Design module and it will appear here."
            />
          )}
          <ul className="max-h-[560px] space-y-2 overflow-y-auto">
            {(designs.data ?? []).map((d) => (
              <li
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`group relative cursor-pointer rounded-lg border p-3 pr-8 text-xs transition ${
                  selectedId === d.id
                    ? "border-accent/50 bg-accent/10"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <button
                  type="button"
                  title="Delete design"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${d.building_name || `Design #${d.id}`}"? This can't be undone.`)) {
                      removeDesign.mutate(d.id);
                    }
                  }}
                  disabled={removeDesign.isPending && removeDesign.variables === d.id}
                  className="absolute right-2 top-2 rounded p-1 text-slate-600 opacity-0 transition hover:bg-danger/20 hover:text-danger group-hover:opacity-100 disabled:opacity-50"
                >
                  {removeDesign.isPending && removeDesign.variables === d.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {d.building_name || `Design #${d.id}`}
                </div>
                <div className="text-slate-500">
                  {d.structure_type?.replace(/_/g, " ")} · {num(d.catchment_area_sqm, 0)} m²
                  {d.has_injection_borewell ? " · + borewell" : ""}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  <span className="text-accent">{inr(d.estimated_cost_inr)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="xl:col-span-2">
          {detail.data ? (
            <div className="space-y-4">
              <ReportDetail data={detail.data} />
              <ReportGenerationPanel designId={selectedId} />
            </div>
          ) : (
            <EmptyState
              icon={<FileText size={20} />}
              title="Select a design"
              description="Choose a saved design from the list to view its full engineering report and generate a PDF."
              className="min-h-[300px]"
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

/**
 * PDF report generation + QR/download flow.
 *
 * Scope note: this page renders *saved* designs loaded from the database
 * (getDesign(id)), not a live in-progress design session — the 2D CAD
 * drawing and 3D scene components (EngineeringDrawings2D.jsx,
 * RechargeStructureScene.jsx) live only on the design wizard route and are
 * out of scope for this phase to touch. Re-mounting them here just to
 * capture a fresh snapshot image would mean re-deriving CAD/3D geometry
 * for an arbitrary historical design outside the flow they were built for.
 * So the PDF here is generated from the persisted BOQ / structure /
 * calculation-summary data only, honestly, without a live-captured
 * drawing image — the backend route already accepts optional
 * cad_drawing_image/snapshot_3d_image fields so a future "generate report"
 * action added directly to the design wizard (where those components are
 * already mounted and DesignResults already exposes a snapshot button) can
 * pass real captured images without any backend changes.
 */
function ReportGenerationPanel({ designId }) {
  const queryClient = useQueryClient();
  const [preparedByName, setPreparedByName] = useState("");
  const [preparedByDesignation, setPreparedByDesignation] = useState("");
  const [reviewedByName, setReviewedByName] = useState("");
  const [reviewedByDesignation, setReviewedByDesignation] = useState("");

  const report = useQuery({
    queryKey: ["report", designId],
    queryFn: () => getReport(designId),
    enabled: !!designId,
  });

  const generate = useMutation({
    mutationFn: () =>
      generateReport(designId, {
        preparedBy: { name: preparedByName || null, designation: preparedByDesignation || null },
        reviewedBy: { name: reviewedByName || null, designation: reviewedByDesignation || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", designId] });
    },
  });

  const existing = report.data?.report;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-panel rounded-xl border border-slate-200 dark:border-slate-800 bg-panel/50 p-4 print:hidden"
    >
      <div className="mb-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <FileText size={15} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">PDF Engineering Report</h3>
          <p className="text-[10px] text-slate-500">
            Cover page, site &amp; hydrology, structure &amp; BOQ, construction sequence, maintenance
            schedule, decision-support notes, QR verification and a typed sign-off block.
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
          <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Prepared by
          </legend>
          <input
            type="text"
            placeholder="Name"
            value={preparedByName}
            onChange={(e) => setPreparedByName(e.target.value)}
            className="mb-1.5 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-surface/70 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-accent/50 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Designation"
            value={preparedByDesignation}
            onChange={(e) => setPreparedByDesignation(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-surface/70 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-accent/50 focus:outline-none"
          />
        </fieldset>
        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
          <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Reviewed by
          </legend>
          <input
            type="text"
            placeholder="Name"
            value={reviewedByName}
            onChange={(e) => setReviewedByName(e.target.value)}
            className="mb-1.5 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-surface/70 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-accent/50 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Designation"
            value={reviewedByDesignation}
            onChange={(e) => setReviewedByDesignation(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-surface/70 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-accent/50 focus:outline-none"
          />
        </fieldset>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
        These are typed name / designation entries shown on the report's sign-off page — not a
        digital or cryptographic signature; this system has no multi-user authentication to support
        that.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-surface transition hover:brightness-110 disabled:opacity-60"
        >
          {generate.isPending ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Generating…
            </>
          ) : (
            <>
              <FileText size={13} /> {existing ? "Regenerate PDF Report" : "Generate PDF Report"}
            </>
          )}
        </button>

        {existing && (
          <a
            href={downloadReportUrl(designId)}
            className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-4 py-2 text-xs font-semibold text-success transition hover:bg-success/20"
          >
            <Download size={13} /> Download PDF
          </a>
        )}
      </div>

      {generate.isError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-[11px] text-danger">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Failed to generate report: {generate.error?.response?.data?.detail ?? generate.error?.message ?? "unknown error"}
        </div>
      )}

      {existing && (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-200 dark:border-slate-800 pt-3">
          {existing.qr_code_url && (
            <img
              src={resolveStaticUrl(existing.qr_code_url)}
              alt="Report verification QR code"
              className="h-16 w-16 rounded border border-slate-300 dark:border-slate-700 bg-white p-1"
            />
          )}
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <QrCode size={12} /> Verification QR
            </div>
            <div>Last generated {new Date(existing.generated_at).toLocaleString()}</div>
            <div className="text-slate-500">
              Scans to the design record — for reference only, not a document signature.
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ReportDetail({ data }) {
  const { design, pits, trenches, borewells, filter_media, boq } = data;
  const boqTotal = (boq ?? []).reduce((s, i) => s + Number(i.amount_inr ?? 0), 0);

  return (
    <div className="glass-panel space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-panel/50 p-5 print:border-none print:bg-white print:text-black">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 print:text-black">
          Rooftop Rainwater Harvesting Design Report
        </h2>
        <div className="text-xs text-slate-500">
          Design #{design.id} · generated {new Date(design.created_at).toLocaleString()}
        </div>
      </div>

      <Section title="Site &amp; Hydrology">
        <Grid>
          <Field label="Catchment area" value={`${num(design.catchment_area_sqm)} m²`} />
          <Field label="Runoff coefficient" value={num(design.runoff_coefficient, 3)} />
          <Field label="Annual rainfall" value={`${num(design.annual_rainfall_mm, 1)} mm`} />
          <Field label="Groundwater depth" value={`${num(design.groundwater_depth_m)} m`} />
          <Field label="Hydrologic soil group" value={design.hydrologic_soil_group ?? "—"} />
          <Field label="Annual harvest" value={`${num(design.annual_harvest_m3)} m³`} />
          <Field label="Annual recharge" value={`${num(design.annual_recharge_m3)} m³`} />
          <Field label="Structure" value={design.structure_type?.replace(/_/g, " ")} />
        </Grid>
      </Section>

      {pits.length > 0 && (
        <Section title={`Recharge Pit${pits.length > 1 ? `s (${pits.length})` : ""}`}>
          <Grid>
            <Field label="Diameter" value={`${num(pits[0].diameter_m)} m`} />
            <Field label="Depth" value={`${num(pits[0].depth_m)} m`} />
            <Field label="Freeboard" value={`${num(pits[0].freeboard_m)} m`} />
            <Field label="Volume each" value={`${num(pits[0].volume_m3, 3)} m³`} />
            <Field label="Count" value={pits.length} />
            <Field
              label="Total volume"
              value={`${num(pits.reduce((s, p) => s + Number(p.volume_m3), 0), 3)} m³`}
            />
          </Grid>
        </Section>
      )}

      {trenches.map((t) => (
        <Section key={t.id} title="Recharge Trench">
          <Grid>
            <Field label="Width" value={`${num(t.width_m)} m`} />
            <Field label="Depth" value={`${num(t.depth_m)} m`} />
            <Field label="Total length" value={`${num(t.total_length_m)} m`} />
            <Field label="Segments" value={`${t.segment_count} × ${num(t.segment_length_m)} m`} />
            <Field label="Volume" value={`${num(t.volume_m3, 3)} m³`} />
          </Grid>
        </Section>
      ))}

      {borewells.map((b) => (
        <Section key={b.id} title="Injection Borewell (Conceptual)">
          <Grid>
            <Field label="Trigger" value={b.trigger_reason} />
            <Field label="Conceptual depth" value={`${num(b.conceptual_depth_m, 1)} m`} />
          </Grid>
          <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger print:text-rose-800">
            ⚠ {b.warning_text}
          </p>
        </Section>
      ))}

      <Section title="Filter Media">
        <Table
          head={["Layer", "Particle size", "Vol (m³)", "Weight (kg)", "Porosity", "K (mm/hr)"]}
          rows={filter_media.map((l) => [
            l.material,
            l.particle_size_note,
            num(l.volume_m3, 3),
            num(l.weight_kg, 1),
            num(l.porosity, 2),
            num(l.hydraulic_conductivity_mm_hr, 0),
          ])}
        />
      </Section>

      <Section title="Bill of Quantities">
        {boq && boq.length > 0 ? (
          <Table
            head={["Item", "Unit", "Quantity", "Rate (₹)", "Amount (₹)"]}
            rows={boq.map((i) => [i.item, i.unit, num(i.quantity, 3), inr(i.unit_rate_inr), inr(i.amount_inr)])}
            footer={["Total estimated cost", "", "", "", inr(boqTotal)]}
          />
        ) : (
          <p className="text-xs text-slate-500">No BOQ line items recorded for this design.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-accent print:text-black">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>;
}

function Field({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-surface/60 p-2 print:border-gray-300 print:bg-white">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 dark:text-slate-100 print:text-black">{value}</div>
    </div>
  );
}

function Table({ head, rows, footer }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-slate-400">
        <tr className="text-left">
          {head.map((h) => (
            <th key={h} className="py-1">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
            {r.map((c, j) => (
              <td key={j} className="py-1">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="border-t border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 print:text-black">
            {footer.map((c, i) => (
              <td key={i} className="py-2">{c}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
