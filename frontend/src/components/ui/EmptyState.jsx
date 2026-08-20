import { Inbox } from "lucide-react";

/**
 * Centered empty-state placeholder for panels/lists with no data.
 *
 * Props:
 *  - icon: optional custom icon element (defaults to a generic inbox glyph)
 *  - title: short heading (required)
 *  - description: supporting copy (optional)
 *  - action: optional element (e.g. a button) rendered below the text
 */
export default function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-panel/20 px-6 py-10 text-center dark:border-slate-800 dark:bg-panel/20 ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/60 text-slate-400">
        {icon ?? <Inbox size={18} />}
      </div>
      {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
