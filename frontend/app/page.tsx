"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Shield,
  BarChart2,
  Target,
  RefreshCw,
  Lock,
  CheckCircle2,
  ArrowRight,
  PieChart,
} from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Net Worth Tracking",
    desc: "See your complete financial picture in one place. Assets, liabilities, and 90-day history — updated automatically.",
  },
  {
    icon: RefreshCw,
    title: "Automatic Sync",
    desc: "Connect your bank accounts via Plaid. Transactions sync every 6 hours so your data is always current.",
  },
  {
    icon: PieChart,
    title: "Spending Insights",
    desc: "Understand exactly where your money goes each month with automatic categorization and visual breakdowns.",
  },
  {
    icon: Target,
    title: "Budget Tracking",
    desc: "Set spending limits by category and track progress in real time. No more end-of-month surprises.",
  },
  {
    icon: BarChart2,
    title: "Investment Overview",
    desc: "Track your investment accounts alongside checking and savings for a complete portfolio view.",
  },
  {
    icon: Shield,
    title: "Bank-Level Security",
    desc: "Your credentials never touch our servers. Plaid connects to your bank — we only receive read-only data.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Connect your accounts",
    desc: "Use our secure Plaid integration to connect any U.S. bank, credit card, or investment account in under two minutes.",
  },
  {
    num: "02",
    title: "Data syncs automatically",
    desc: "Transactions, balances, and investment values refresh every 6 hours. Nothing to export or manually update.",
  },
  {
    num: "03",
    title: "Get the full picture",
    desc: "Your dashboard shows net worth, spending by category, budgets, and trends — always up to date.",
  },
];

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && token) router.replace("/dashboard");
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "hsl(222 47% 11%)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm flex-shrink-0">
              $
            </div>
            <span className="font-semibold text-foreground tracking-tight text-sm">
              Personal Finance Tracker
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login?tab=register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "hsl(222 47% 11%)" }}
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: "hsl(251 70% 58%)" }}
          />
          <div
            className="absolute bottom-0 right-0 h-64 w-64 rounded-full opacity-10 blur-3xl"
            style={{ background: "hsl(142 71% 45%)" }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="lg:max-w-[52%]">
            {/* Trust badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <Lock size={11} className="text-emerald-400" />
              <span className="text-xs text-slate-300">
                Secured by Plaid · 256-bit encryption
              </span>
            </div>

            <h1
              className="mb-6 font-display text-5xl font-extrabold leading-[1.08] tracking-tight text-white lg:text-6xl"
            >
              Your complete<br />
              <span style={{ color: "hsl(251 70% 78%)" }}>
                financial picture,
              </span>
              <br />
              always current.
            </h1>

            <p className="mb-8 max-w-lg text-lg leading-relaxed text-slate-400">
              Connect your bank accounts, credit cards, and investments.
              Personal Finance Tracker syncs everything automatically so you
              always know exactly where you stand.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login?tab=register"
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white transition-all hover:scale-[1.03] active:scale-100"
                style={{
                  background: "hsl(251 70% 58%)",
                  boxShadow: "0 4px 24px hsla(251,70%,58%,0.45)",
                }}
              >
                Get started — it&apos;s free
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-white/40 hover:text-white"
              >
                Sign in
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              No credit card required · Connect in under 2 minutes
            </p>
          </div>

          {/* Dashboard mockup — desktop only */}
          <div className="mt-16 hidden lg:block lg:absolute lg:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:w-[400px]">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-b bg-slate-50 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-3 divide-x text-center">
            {[
              { value: "10,000+", label: "Supported institutions" },
              { value: "Free", label: "No subscription fees" },
              { value: "Read-only", label: "We never move your money" },
            ].map(({ value, label }) => (
              <div key={label} className="px-6 py-2">
                <p className="font-display text-2xl font-bold text-foreground">
                  {value}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
              Everything you need
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
              All your finances in one dashboard
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Stop logging into five different apps. Personal Finance Tracker
              gives you a single source of truth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border bg-white p-6 transition-transform hover:-translate-y-0.5"
                style={{
                  boxShadow:
                    "0 2px 16px hsla(222,47%,11%,0.06), 0 1px 4px hsla(222,47%,11%,0.04)",
                }}
              >
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "hsl(251 70% 95%)" }}
                >
                  <Icon size={18} style={{ color: "hsl(251 70% 50%)" }} />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
              Simple setup
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {STEPS.map(({ num, title, desc }, i) => (
              <div key={num} className="relative text-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-7 hidden h-px w-[calc(100%-1rem)] bg-slate-200 md:block" />
                )}
                <div
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl font-display text-lg font-extrabold text-white"
                  style={{
                    background: "hsl(251 70% 58%)",
                    boxShadow: "0 4px 16px hsla(251,70%,58%,0.35)",
                  }}
                >
                  {num}
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section
        className="px-6 py-24"
        style={{ background: "hsl(222 47% 11%)" }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "hsl(251 70% 78%)" }}
            >
              Security first
            </p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-white">
              Your data stays yours
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-400">
              We use the same infrastructure trusted by thousands of financial
              applications worldwide.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Plaid-powered",
                desc: "Your bank credentials go directly to Plaid — never our servers. We receive read-only transaction data only.",
              },
              {
                icon: Lock,
                title: "Encrypted at rest",
                desc: "All stored data is encrypted with AES-256. Access tokens are separately encrypted with a Fernet key.",
              },
              {
                icon: CheckCircle2,
                title: "Read-only access",
                desc: "We cannot initiate transfers or make changes to your accounts — ever. Viewing data only, always.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-6"
                style={{
                  background: "hsla(222,47%,17%,1)",
                  border: "1px solid hsla(222,47%,24%,1)",
                }}
              >
                <Icon
                  size={20}
                  className="mb-4"
                  style={{ color: "hsl(251 70% 78%)" }}
                />
                <h3 className="mb-2 font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 py-28 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-foreground mb-4">
            Know your numbers.
          </h2>
          <p className="text-muted-foreground mb-8">
            Connect your accounts in two minutes and see your complete financial
            picture — for free.
          </p>
          <Link
            href="/login?tab=register"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white shadow-lg transition-all hover:scale-[1.03] active:scale-100"
            style={{
              background: "hsl(251 70% 58%)",
              boxShadow: "0 4px 24px hsla(251,70%,58%,0.4)",
            }}
          >
            Get started free
            <ArrowRight size={16} />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card · No subscription
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="px-6 py-10"
        style={{ background: "hsl(222 47% 11%)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-white font-bold text-xs flex-shrink-0">
              $
            </div>
            <span className="text-sm font-medium text-slate-300">
              Personal Finance Tracker
            </span>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} · All rights reserved
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Sign in
            </Link>
            <Link
              href="/login?tab=register"
              className="text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        background: "hsl(220 20% 97%)",
        border: "1px solid hsl(220 13% 88%)",
        boxShadow:
          "0 32px 64px hsla(222,47%,4%,0.55), 0 8px 24px hsla(222,47%,4%,0.3)",
        transform: "perspective(1000px) rotateY(-6deg) rotateX(3deg)",
        transformOrigin: "center center",
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-1.5 px-3 py-2.5"
        style={{ background: "hsl(222 47% 14%)" }}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <div
          className="ml-2 flex-1 rounded px-2 py-0.5 text-center text-xs"
          style={{
            background: "hsla(222,47%,20%,1)",
            color: "hsl(215 20% 55%)",
          }}
        >
          app.financetracker.com/dashboard
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Net worth card */}
        <div
          className="rounded-xl bg-white p-3"
          style={{ boxShadow: "0 1px 8px hsla(222,47%,11%,0.08)" }}
        >
          <p className="text-xs font-medium text-slate-500">Net Worth</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900">$142,830</p>
          <div className="mt-2 flex gap-5">
            <div>
              <p className="text-xs text-slate-400">Assets</p>
              <p className="text-sm font-semibold text-emerald-600">$168,450</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Liabilities</p>
              <p className="text-sm font-semibold text-rose-500">$25,620</p>
            </div>
          </div>
          {/* Sparkline */}
          <svg
            viewBox="0 0 200 36"
            className="mt-3 h-7 w-full"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(251,70%,58%)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(251,70%,58%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 30 L25 27 L55 24 L85 21 L115 18 L145 13 L175 8 L200 4"
              stroke="hsl(251,70%,58%)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M0 30 L25 27 L55 24 L85 21 L115 18 L145 13 L175 8 L200 4 L200 36 L0 36 Z"
              fill="url(#sg)"
            />
          </svg>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Income", value: "$7,200", color: "text-emerald-600" },
            { label: "Spent", value: "$3,840", color: "text-slate-800" },
            { label: "Saved", value: "47%", color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-lg bg-white p-2 text-center"
              style={{ boxShadow: "0 1px 4px hsla(222,47%,11%,0.06)" }}
            >
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`mt-0.5 text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Recent transactions */}
        <div
          className="rounded-xl bg-white p-3"
          style={{ boxShadow: "0 1px 8px hsla(222,47%,11%,0.08)" }}
        >
          <p className="mb-2.5 text-xs font-semibold text-slate-700">
            Recent Transactions
          </p>
          {[
            { name: "Whole Foods", cat: "Groceries", amount: "-$84.20" },
            { name: "Netflix", cat: "Entertainment", amount: "-$15.99" },
            {
              name: "Payroll",
              cat: "Income",
              amount: "+$3,600",
              positive: true,
            },
          ].map(({ name, cat, amount, positive }) => (
            <div
              key={name}
              className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
            >
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: "hsl(251 70% 95%)",
                  color: "hsl(251 70% 50%)",
                }}
              >
                {name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">
                  {name}
                </p>
                <p className="text-xs text-slate-400">{cat}</p>
              </div>
              <p
                className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-slate-700"}`}
              >
                {amount}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
