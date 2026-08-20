export default function SyncPanel({ runs = [], liveEvent, connected }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-panel/60 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Recent Synchronization</h3>
        <span className={`text-xs flex items-center gap-1 ${connected ? "text-emerald-400" : "text-rose-400"}`}>
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
          {connected ? "Live" : "Disconnected"}
        </span>
      </div>

      {liveEvent && (
        <div className="text-xs text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
          {liveEvent.type === "sync_progress" &&
            `Syncing ${liveEvent.source}: ${liveEvent.upserted}/${liveEvent.fetched} upserted (offset ${liveEvent.offset}/${liveEvent.total})`}
          {liveEvent.type === "sync_complete" &&
            `${liveEvent.source} sync ${liveEvent.status}: ${liveEvent.records_upserted} upserted, ${liveEvent.records_failed} failed`}
        </div>
      )}

      <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
        {runs.map((run) => (
          <li key={run.id} className="text-xs flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="uppercase text-slate-400 mr-2">{run.source}</span>
              <span
                className={
                  run.status === "success"
                    ? "text-emerald-400"
                    : run.status === "failed"
                      ? "text-rose-400"
                      : "text-amber-300"
                }
              >
                {run.status}
              </span>
            </div>
            <div className="text-slate-500">
              {run.records_upserted} upserted · {new Date(run.started_at).toLocaleTimeString()}
            </div>
          </li>
        ))}
        {runs.length === 0 && <li className="text-xs text-slate-500">No sync runs yet.</li>}
      </ul>
    </div>
  );
}
