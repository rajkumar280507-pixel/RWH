import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "../store/authStore.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const authLoading = useAuthStore((s) => s.authLoading);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const { ok, error: err } = await login(username, password);
    if (ok) {
      setSuccess(true);
      setTimeout(() => navigate("/"), 900);
    } else {
      setError(err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-xl text-white">
            <Droplets size={20} />
          </span>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sign in</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">RWH-DSS Decision Support Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <fieldset disabled={success} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Username
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
              Signed in successfully — taking you to the dashboard…
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading || success}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {(authLoading || success) && <Loader2 size={14} className="animate-spin" />}
            {success ? "Signed in" : "Sign in"}
          </button>
          </fieldset>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          No account?{" "}
          <Link to="/register" className="font-semibold text-accent hover:underline">
            Register
          </Link>
        </p>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Browsing telemetry, the GIS map, and generating a design don't require an account —
          sign in only to save designs under your name, generate PDF reports, or manage saved work.
        </p>
      </div>
    </div>
  );
}
