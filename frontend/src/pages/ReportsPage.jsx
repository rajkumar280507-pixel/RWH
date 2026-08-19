import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import { deleteDesign, getDesign, getDesigns } from "../services/api.js";

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
      subtitle="Every RWH design saved from the design module, with its full engineering breakdown."
      actions={
        detail.data && (
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface transition hover:brightness-110"
          >
            Print / Save PDF
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-panel/50 p-4 print:hidden">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">
            Saved designs ({designs.data?.length ?? 0})
          </h3>
          {designs.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
          {designs.data?.length === 0 && (
            <div className="text-xs text-slate-500">
              No designs saved yet. Create one in the RWH Design module and it will appear here.
            </div>
          )}
          <ul className="max-h-[560px] space-y-2 overflow-y-auto">
            {(designs.data ?? []).map((d) => (
              <li
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`group relative cursor-pointer rounded-lg border p-3 pr-8 text-xs transition ${
                  selectedId === d.id
                    ? "border-accent/50 bg-accent/10"
                    : "border-slate-800 hover:bg-slate-800/50"
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
                  className="absolute right-2 top-2 rounded p-1 text-slate-600 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100 disabled:opacity-50"
                >
                  {removeDesign.isPending && removeDesign.variables === d.id ? "…" : "🗑"}
                </button>
                <div className="font-semibold text-slate-200">
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
            <ReportDetail data={detail.data} />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-panel/40 p-6 text-sm text-slate-500">
              Select a design to view its full report.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ReportDetail({ data }) {
  const { design, pits, trenches, borewells, filter_media } = data;

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-panel/50 p-5 print:border-none print:bg-white print:text-black">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-base font-semibold text-slate-100 print:text-black">
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
          <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-200 print:text-rose-800">
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
    <div className="rounded-lg border border-slate-800 bg-surface/60 p-2 print:border-gray-300 print:bg-white">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-sm text-slate-100 print:text-black">{value}</div>
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
          <tr key={i} className="border-t border-slate-800">
            {r.map((c, j) => (
              <td key={j} className="py-1">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="border-t border-slate-700 font-semibold text-slate-200 print:text-black">
            {footer.map((c, i) => (
              <td key={i} className="py-2">{c}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
