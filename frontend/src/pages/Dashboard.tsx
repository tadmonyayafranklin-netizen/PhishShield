import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, CheckCircle2, Mail, MousePointerClick, ShieldCheck, Target, Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { DashboardStats } from "../lib/types";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "../components/ui";
import { useAuth } from "../lib/auth";
import { Sparkles } from "lucide-react";

const COLORS = ["#0ea5e9", "#38bdf8", "#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

function StatCard({ icon: Icon, label, value, sub, tone }: any) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4 sm:gap-4 sm:pt-5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-bold sm:text-2xl">{value}</div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">{label}</div>
          {sub && <div className="truncate text-[11px] text-slate-400 sm:text-xs">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [dept, setDept] = useState<any[]>([]);
  const [compare, setCompare] = useState<any[]>([]);

  useEffect(() => {
    api<DashboardStats>("/analytics/dashboard").then(setStats).catch(() => {});
    api<any[]>("/analytics/monthly-trends").then(setMonthly).catch(() => {});
    api<any[]>("/analytics/department-scores").then(setDept).catch(() => {});
    api<any[]>("/analytics/campaign-compare").then(setCompare).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-500">Loading…</div>;

  const pieData = [
    { name: "Completed", value: stats.completed_campaigns },
    { name: "Active", value: stats.active_campaigns },
    { name: "Other", value: Math.max(0, stats.total_campaigns - stats.completed_campaigns - stats.active_campaigns) },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Welcome back, {user?.full_name}. Here's your security awareness overview.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={Users} label="Participants" value={stats.total_participants} tone="bg-sky-500/15 text-sky-500" />
        <StatCard icon={Target} label="Active Campaigns" value={stats.active_campaigns} tone="bg-emerald-500/15 text-emerald-500" />
        <StatCard icon={CheckCircle2} label="Completed Campaigns" value={stats.completed_campaigns} tone="bg-violet-500/15 text-violet-500" />
        <StatCard icon={Mail} label="Emails Sent" value={stats.emails_sent} tone="bg-amber-500/15 text-amber-500" />
        <StatCard icon={MousePointerClick} label="Interactions" value={stats.training_interactions} tone="bg-cyan-500/15 text-cyan-500" />
        <StatCard icon={ShieldCheck} label="Awareness Score" value={`${stats.avg_awareness_score}%`} tone="bg-indigo-500/15 text-indigo-500" />
        <StatCard icon={Activity} label="Completion Rate" value={`${stats.completion_rate}%`} tone="bg-rose-500/15 text-rose-500" />
        <StatCard icon={Target} label="Total Campaigns" value={stats.total_campaigns} tone="bg-slate-500/15 text-slate-500" />
      </div>

      {stats.is_premium === false && user?.role !== "participant" && (
        <Card className="border-accent-500/40 bg-accent-500/5">
          <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center">
            <Sparkles className="h-6 w-6 shrink-0 text-accent-500" />
            <div className="flex-1">
              <div className="font-semibold">You're on the Free plan</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upgrade to Premium for unlimited campaigns, PDF reports and advanced analytics.
              </p>
            </div>
            <Link to="/billing" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600">
              Upgrade
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Engagement Trends</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="delivered" stroke="#0ea5e9" fill="url(#g1)" name="Delivered" />
                <Area type="monotone" dataKey="opened" stroke="#38bdf8" fill="none" name="Opened" />
                <Area type="monotone" dataKey="clicked" stroke="#f59e0b" fill="none" name="Clicked" />
                <Area type="monotone" dataKey="reported" stroke="#22c55e" fill="none" name="Reported" />
                <Area type="monotone" dataKey="completed" stroke="#a78bfa" fill="none" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campaign Status</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Department Awareness Scores</CardTitle></CardHeader>
          <CardContent className="h-64">
            {dept.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No department data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dept} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} />
                  <YAxis type="category" dataKey="department" stroke="#64748b" fontSize={12} width={110} />
                  <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                  <Bar dataKey="avg_score" name="Avg Score" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <Badge tone="blue" className="mt-0.5 shrink-0">{a.action}</Badge>
                  <div className="min-w-0">
                    <div className="truncate">{a.user || "system"} — {a.detail || ""}</div>
                    <div className="text-xs text-slate-400">{new Date(a.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
