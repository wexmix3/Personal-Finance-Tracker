"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Wallet,
  BarChart2,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/spending", label: "Spending", icon: PieChart },
  { href: "/dashboard/budgets", label: "Budgets", icon: Target },
  { href: "/dashboard/net-worth", label: "Net Worth", icon: TrendingUp },
  { href: "/dashboard/investments", label: "Investments", icon: BarChart2 },
  { href: "/dashboard/accounts", label: "Accounts", icon: Wallet },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar-bg flex h-full w-64 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-active))] text-white font-bold text-sm flex-shrink-0">
          $
        </div>
        <span className="sidebar-fg font-semibold tracking-tight">My Finances</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto sidebar-muted hover:sidebar-fg">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "sidebar-active"
                  : "sidebar-muted sidebar-hover"
              }`}
            >
              <Icon size={18} className={active ? "text-white" : ""} />
              <span className={active ? "text-white" : ""}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-4 space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs sidebar-muted truncate">{user?.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm sidebar-muted sidebar-hover transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) router.replace("/login");
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--sidebar-bg))]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--sidebar-active))] border-t-transparent" />
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm">My Finances</span>
        </div>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}