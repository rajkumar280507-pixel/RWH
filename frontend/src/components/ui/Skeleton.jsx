/**
 * Reusable loading-skeleton primitive. Sizing is entirely driven by
 * `className` (e.g. "h-4 w-32", "h-24 w-full") so it can stand in for text
 * lines, cards, avatars, chart placeholders, etc.
 */
export default function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-800/60 dark:bg-slate-800/60 ${className}`}
    />
  );
}
