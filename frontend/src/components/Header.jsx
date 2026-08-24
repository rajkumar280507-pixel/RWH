import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  User,
  ChevronDown,
  Clock,
  Menu,
  X,
  LogOut,
  Sliders,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useUiStore } from "../store/uiStore.js";
import { useClock } from "../hooks/useClock.js";

export default function Header() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const { time, date } = useClock();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform ?? navigator.userAgent);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-[500] h-18 w-full border-b border-sky-100/60 bg-white/85 px-4 backdrop-blur-xl transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-950/85 sm:h-20 sm:px-6 shadow-sm shadow-sky-500/5 print:hidden">
      <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-4">
        
        {/* ========================================================================= */}
        {/* LEFT SECTION: Logo, Application Name, Subtitle & Platform Badge */}
        {/* ========================================================================= */}
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/" className="group flex items-center gap-3 transition-transform active:scale-95">
            {/* Logo Badge */}
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 p-0.5 shadow-md shadow-sky-500/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-sky-500/40">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white/10 backdrop-blur-sm">
                <span className="text-2xl">💧</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
              </span>
            </div>

            {/* Application Title & Subtitle */}
            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
                  RWH-DSS
                </span>
            
              </div>
              <span className="hidden text-xs font-semibold text-slate-500 dark:text-slate-400 sm:inline-block">
                Rooftop Rainwater Harvesting Decision Support System
              </span>
            </div>
          </Link>

          {/* Platform Badge */}
          <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 md:flex">
            <ShieldCheck size={14} className="text-sky-500" />
            <span>RWH-DSS Platform</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT SECTION: Search, Time, Notifications, User Dropdown */}
        {/* ========================================================================= */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          
          {/* Global Search Button */}
          <button
            type="button"
            onClick={openCommandPalette}
            className="group relative flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2 text-xs text-slate-500 transition-all hover:border-sky-400 hover:bg-white hover:shadow-md hover:shadow-sky-500/5 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:bg-slate-900"
            title="Global Search"
          >
            <Search size={15} className="text-slate-400 group-hover:text-sky-500" />
            <span className="hidden w-44 truncate text-left sm:inline-block md:w-56 lg:w-64 xl:w-72 font-medium">
              Search Project, Village, Taluk, Survey No, Report...
            </span>
          </button>

          {/* Current Date & Time Display */}
          <div className="hidden flex-col items-end leading-tight text-slate-700 dark:text-slate-300 lg:flex">
            <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tabular-nums">
              <Clock size={13} className="text-sky-500" />
              {time || "14:30:15"}
            </div>
            <span className="text-[10.5px] font-medium text-slate-400">{date || "Aug 23, 2026"}</span>
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:border-sky-400 hover:bg-white hover:text-sky-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-white"
              title="Notifications"
            >
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-500 ring-2 ring-white dark:ring-slate-950" />
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="glass-panel absolute right-0 top-full z-[600] mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                      Live Stream
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col gap-2 text-xs">
                    <div className="rounded-xl bg-sky-500/5 p-2.5 border border-sky-500/10">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">Telemetry Sync Complete</div>
                      <div className="text-[11px] text-slate-500">CGWB Dindigul Groundwater station sync succeeded.</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET NAVIGATION DRAWER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-xl lg:hidden dark:border-slate-800 dark:bg-slate-950/95 shadow-xl"
          >
            <div className="flex flex-col gap-3">
              {/* Mobile Search */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openCommandPalette();
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900"
              >
                <Search size={14} className="text-slate-400" />
                <span>Search Project, Village, Taluk...</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function ProfileMenuItem({ icon: Icon, label, tone = "normal" }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
      }`}
    >
      <Icon size={14} className={tone === "danger" ? "text-rose-500" : "text-slate-400"} />
      <span>{label}</span>
    </button>
  );
}
