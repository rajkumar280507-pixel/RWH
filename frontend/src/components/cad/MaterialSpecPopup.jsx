import { AnimatePresence, motion } from "framer-motion";
import { X, BookOpen } from "lucide-react";
import { resolveMaterialKey } from "../../lib/materialPatterns.jsx";

/**
 * Static reference specifications per filter-media material, keyed by the
 * same 7 pattern categories as materialPatterns.jsx. Content is hand-written
 * reference text, not backend data — numbers here are kept consistent with
 * what `rwh_design_engine.py`'s own `calculation_sheet` cites (IS 15797 /
 * CGWB first-flush practice, CGWB Master Plan for Artificial Recharge) so
 * this popup never contradicts the engine's own working.
 */
const MATERIAL_SPECS = {
  sand: {
    title: "Coarse Sand — Filter Layer 1 (Top)",
    plain: "This is the top layer of sand. It catches dirt, leaves and grit so cleaner water moves down to the next layer.",
    standard: "IS 15797:2008 — Guidelines for Rainwater Harvesting & Artificial Recharge",
    sizeRange: "1.5 – 2.0 mm effective particle size",
    porosity: "~0.35 (typical for clean coarse sand)",
    thickness: "Top 25% of structure depth",
    purpose:
      "Primary polishing filter — strains fine silt, organic debris and suspended solids out of first-flush-treated runoff before it reaches the coarser media below. This is the layer that clogs first and is the serviceable element of the stack.",
    maintenance: "Scrape and wash the top ~50 mm quarterly, or after any visibly turbid storm event; full replacement typically every 2–3 years.",
  },
  gravel: {
    title: "Graded Gravel — Filter Layer 2 (Middle)",
    plain: "A middle layer of small stones. It stops the sand above from washing down into the big stones below, while still letting water flow through easily.",
    standard: "IS 15797:2008 & CGWB Master Plan for Artificial Recharge",
    sizeRange: "5 – 10 mm graded aggregate",
    porosity: "~0.40",
    thickness: "Middle 25% of structure depth",
    purpose:
      "Intermediate drainage buffer between the fine sand filter above and the coarse storage/infiltration layer below; prevents fine sand from migrating into and blinding the boulder layer while maintaining a high hydraulic conductivity path.",
    maintenance: "Inspect bi-annually during the desilting chamber service; re-lay only if excavated for a deeper repair.",
  },
  aggregate: {
    title: "Coarse Aggregate / Boulders — Filter Layer 3 (Base)",
    plain: "Large stones at the bottom. The big gaps between them hold a lot of water temporarily and let it soak into the ground below.",
    standard: "IS 15797:2008 & CGWB Master Plan for Artificial Recharge",
    sizeRange: "50 – 200 mm, clean and durable (free of fines)",
    porosity: "~0.45 (highest void ratio in the stack)",
    thickness: "Bottom 50% of structure depth",
    purpose:
      "Bulk storage volume and structural support — the high void ratio maximises temporary storage between storm events and keeps the infiltration surface at the base of the pit/trench open and free-draining.",
    maintenance: "Excavate, wash and re-lay approximately every 3 years, or sooner if the time-to-empty figure on the Hydraulics tab trends upward.",
  },
  rock: {
    title: "In-situ Rock / Hard Strata",
    plain: "Solid natural rock that the drill or dig ran into on-site — not something that gets built or placed.",
    standard: "CGWB hydrogeological siting guidance",
    sizeRange: "Site-specific — confirmed by bore log / geotechnical investigation",
    porosity: "Highly variable — fracture-flow dependent, not intergranular",
    thickness: "Encountered stratum, not a placed layer",
    purpose:
      "Where drilling encounters hard rock (relevant to the deep injection borewell), casing and screen intervals must be set opposite identified water-bearing fracture zones only — see the injection borewell notes on the Structure Specs tab.",
    maintenance: "Not applicable — natural formation, not a maintained component.",
  },
  clay: {
    title: "Native Clayey Soil",
    plain: "Sticky, dense natural soil found at this site. Water soaks through clay very slowly, which is why a pit alone may not be enough here.",
    standard: "USDA/NRCS hydrologic soil classification (as used for HSG C/D determination)",
    sizeRange: "< 0.002 mm clay fraction dominant",
    porosity: "Low effective (drainable) porosity despite high total porosity",
    thickness: "In-situ — not part of the constructed filter stack",
    purpose:
      "Low permeability soils (HSG C/D) trigger the injection-borewell recommendation on this design, because gravity infiltration through a shallow pit/trench alone is unlikely to be effective — see the trigger reason on the Structure Specs tab.",
    maintenance: "Not applicable.",
  },
  water: {
    title: "Recharge / Infiltration Water",
    plain: "The rainwater itself, shown as it travels down through the layers on its way to join the groundwater below.",
    standard: "CGWB Master Plan for Artificial Recharge to Groundwater",
    sizeRange: "—",
    porosity: "—",
    thickness: "—",
    purpose:
      "Represents harvested roof runoff, post first-flush diversion and desilting, as it percolates through the filter stack into the surrounding soil / aquifer. Expected water-table rise is estimated on the Hydraulics tab using an assumed specific yield — replace with a pumping-test value for a real submission.",
    maintenance: "Not applicable.",
  },
  concrete: {
    title: "RCC Cover Slab / Brick Masonry Lining",
    plain: "The concrete/brick parts that hold everything together — the collar around the rim, the footing at the base, and any chamber walls or cover.",
    standard: "Standard RCC/masonry construction practice per BOQ item",
    sizeRange: "230 mm brickwork (chamber walls); RCC perforated cover slab per structure",
    porosity: "—",
    thickness: "Per structural design, see BOQ tab",
    purpose:
      "Provides a safe, load-bearing, inspectable cover over the structure and lines the inspection/desilting chamber. The perforated cover slab allows air venting while preventing debris ingress and accidental fall hazards.",
    maintenance: "Inspect for cracking annually; keep inspection chamber cover accessible and unobstructed.",
  },
  topsoil: {
    title: "Topsoil",
    plain: "The loose, dark, organic-rich soil right at the surface — the first layer rainwater meets on its way down. Shown here as a typical regional profile, not a measured value for this exact site.",
    standard: "Illustrative regional soil profile (not site-investigated)",
    sizeRange: "Fine, organic-rich, loosely packed",
    porosity: "Moderate — variable with organic content",
    thickness: "Typically the top ~0.2–0.5 m",
    purpose:
      "Supports vegetation and lets some water soak in near the surface, but is not part of the built filter stack — it's shown for context in the illustrative soil profile column.",
    maintenance: "Not applicable — natural surface layer.",
  },
  weatheredRock: {
    title: "Weathered Rock",
    plain: "Rock that has partly broken down over time into looser, crumblier material — somewhere between soil and solid rock. Shown as a typical regional layer, not measured at this exact site.",
    standard: "Illustrative regional soil profile (not site-investigated)",
    sizeRange: "Variable — partly decomposed rock fragments",
    porosity: "Moderate — more permeable than solid rock, less than soil",
    thickness: "Site-variable, shown schematically here",
    purpose: "A transition zone between soil above and solid rock below — water moves through it more easily than through solid bedrock.",
    maintenance: "Not applicable — natural formation.",
  },
  fracturedRock: {
    title: "Fractured Rock",
    plain: "Solid rock, cracked through by natural fractures — the deepest layer shown, close to where the water table typically sits. Shown as a typical regional layer, not measured at this exact site.",
    standard: "Illustrative regional soil profile (not site-investigated)",
    sizeRange: "Solid rock mass with fracture network",
    porosity: "Low intergranular — water moves mainly through the fracture cracks, not the rock itself",
    thickness: "Site-variable, shown schematically here",
    purpose: "Water reaching this depth moves along fracture planes rather than soaking through the rock itself — this is usually near or below the water table.",
    maintenance: "Not applicable — natural formation.",
  },
};

const FALLBACK_SPEC = {
  title: "Material",
  plain: "No plain-language description is available for this item yet.",
  standard: "IS 15797:2008 & CGWB Technical Guidelines",
  sizeRange: "—",
  porosity: "—",
  thickness: "—",
  purpose: "No detailed reference entry is available for this material label yet.",
  maintenance: "—",
};

/**
 * Click-to-open popup showing static IS 15797 / CGWB reference spec text for
 * a material. `material` is the raw label (e.g. a `filter_media[].material`
 * string); it's normalized against the same 7 pattern keys used for fills.
 *
 * Positioned near `position` ({x, y} in viewport px, e.g. from a click
 * event) when given, otherwise centers itself.
 */
export default function MaterialSpecPopup({ material, position, onClose }) {
  if (!material) return null;
  const key = resolveMaterialKey(material);
  const spec = MATERIAL_SPECS[key] ?? { ...FALLBACK_SPEC, title: material };

  const style = position
    ? { position: "fixed", left: Math.min(position.x + 12, window.innerWidth - 320), top: Math.min(position.y + 12, window.innerHeight - 280) }
    : { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        key="popup"
        role="dialog"
        aria-label={`${spec.title} specification`}
        className="glass-panel z-50 w-72 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-xs shadow-2xl"
        style={style}
        initial={{ opacity: 0, scale: 0.94, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 6 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5">
            <BookOpen size={13} className="mt-0.5 shrink-0 text-brand" />
            <h4 className="text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{spec.title}</h4>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded p-0.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Plain-language summary first — this is what a non-expert reads;
            the technical spec below is supporting detail, not the headline. */}
        <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">{spec.plain}</p>

        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-brand/90">{spec.standard}</p>

          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <SpecRow label="Size range" value={spec.sizeRange} />
            <SpecRow label="Porosity" value={spec.porosity} />
            <SpecRow label="Thickness" value={spec.thickness} />
          </dl>

          <p className="mt-2.5 leading-relaxed text-slate-500 dark:text-slate-400">{spec.purpose}</p>

          <div className="mt-2.5 border-t border-slate-200 dark:border-slate-800 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Maintenance</span>
            <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">{spec.maintenance}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SpecRow({ label, value }) {
  return (
    <div>
      <dt className="text-[9.5px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}
