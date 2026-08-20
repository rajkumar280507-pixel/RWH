import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Simple breadcrumb trail.
 *
 * Props:
 *  - items: [{ label, href? }] — the last item is always rendered as the
 *    current, non-clickable page regardless of whether it has an href.
 */
export default function Breadcrumbs({ items = [], className = "" }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs text-slate-500 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="shrink-0 text-slate-700" />}
              {!isLast && item.href ? (
                <Link to={item.href} className="transition hover:text-slate-300">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-slate-300" : ""} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
