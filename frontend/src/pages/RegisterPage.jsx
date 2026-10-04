import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "../store/authStore.js";

const ROLES = [
  { value: "civil_engineer", label: "Civil Engineer" },
  { value: "municipal_employee", label: "Municipal Water Dept. Employee" },
  { value: "builder", label: "Builder / Contractor" },
  { value: "consultant", label: "Consultant" },
  { value: "researcher", label: "Researcher" },
  { value: "office_staff", label: "Office Staff" },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const authLoading = useAuthStore((s) => s.authLoading);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    organization: "",
    role: "civil_engineer",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const { ok, error: err } = await register(form);
    if (ok) {
      setSuccess(true);
      setTimeout(() => navigate("/"), 900);
    } else {
      setError(err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-xl text-white">
            <Droplets size={20} />
          </span>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create an account</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">RWH-DSS Decision Support Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <fieldset disabled={success} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Username
              <input
                type="text"
                required
                minLength={3}
                value={form.username}
                onChange={set("username")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Email
              <input
                type="email"
                required
                value={form.email}
                onChange={set("email")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            Password (min. 8 characters)
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Full name (optional)
              <input
                type="text"
                value={form.full_name}
                onChange={set("full_name")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Organization (optional)
              <input
                type="text"
                value={form.organization}
                onChange={set("organization")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
            I am a...
            <select
              value={form.role}
              onChange={set("role")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
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
              Account created — taking you to the dashboard…
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading || success}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {(authLoading || success) && <Loader2 size={14} className="animate-spin" />}
            {success ? "Account created" : "Create account"}
          </button>
          </fieldset>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
