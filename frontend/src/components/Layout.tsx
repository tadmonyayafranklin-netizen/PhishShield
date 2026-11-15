import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, BookOpen, Building2, ClipboardList, CreditCard, FileText, LayoutDashboard,
  LogOut, Menu, Moon, Shield, Sun, Target, Users, X,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Badge } from "./ui";
import type { NotificationOut, SubscriptionOut } from "../lib/types";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "org_admin", "participant"] },
  { to: "/campaigns", label: "Campaigns", icon: Target, roles: ["super_admin", "org_admin"] },
  { to: "/templates", label: "Templates", icon: ClipboardList, roles: ["super_admin", "org_admin"] },
  { to: "/participants", label: "Participants", icon: Users, roles: ["super_admin", "org_admin"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["super_admin", "org_admin"] },
  { to: "/training", label: "Training", icon: BookOpen, roles: ["super_admin", "org_admin", "participant"] },
  { to: "/users", label: "Users", icon: Shield, roles: ["super_admin", "org_admin"] },
  { to: "/orgs", label: "Organizations", icon: Building2, roles: ["super_admin"] },
  { to: "/audit", label: "Audit Logs", icon: FileText, roles: ["super_admin", "org_admin"] },
  { to: "/billing", label: "Billing", icon: CreditCard, roles: ["super_admin", "org_admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => !document.documentElement.classList.contains("light"));
  const [notifs, setNotifs] = useState<NotificationOut[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [billing, setBilling] = useState<SubscriptionOut | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifs = () =>
    api<NotificationOut[]>("/notifications").then(setNotifs).catch(() => {});

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, [user?.id]);

  useEffect(() => {
    if (user && user.role !== "participant") {
      api<SubscriptionOut>("/billing/status").then(setBilling).catch(() => {});
    }
  }, [user?.id]);

  // Close notification dropdown on outside click / Escape
  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNotifOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  const unread = notifs.filter((n) => !n.read).length;

  const markRead = (n: NotificationOut) => {
    if (n.read) return;
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
  };

  const markAllRead = () => {
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    api("/notifications/read-all", { method: "POST" }).catch(() => {});
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-navy-700/60">
        <Shield className="h-7 w-7 text-accent-400" />
        <span className="text-lg font-bold tracking-tight text-white">PhishShield</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.filter((n) => user && n.roles.includes(user.role)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-accent-500/15 text-accent-400"
                  : "text-slate-400 hover:bg-navy-800 hover:text-slate-200"
              )
            }
          >
            <n.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-navy-700/60 p-3">
        <div className="px-2 py-1 text-xs text-slate-500">{user?.email}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-navy-800 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 bg-navy-900 lg:block">{sidebar}</aside>
      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-navy-900">{sidebar}</aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-navy-700 dark:bg-navy-900">
          <button className="lg:hidden text-slate-500" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="relative" ref={notifRef}>
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 relative"
              onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotifs(); }}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-900">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 px-4 py-2">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 && <div className="p-4 text-sm text-slate-500">No notifications</div>}
                  {notifs.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markRead(n)}
                      className={clsx(
                        "block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-800 dark:hover:bg-navy-800/60",
                        !n.read && "bg-accent-500/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" />}
                        <span className={clsx("min-w-0 flex-1", !n.read && "pl-0")}>
                          <span className={clsx("block truncate text-sm", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{n.message}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
            {user?.full_name}
            {billing?.is_premium && <Badge tone="purple">Premium</Badge>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
