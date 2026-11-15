import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle, Table } from "../components/ui";
import { Sparkles } from "lucide-react";

export default function Analytics() {
  const [compare, setCompare] = useState<any[]>([]);
  const [dept, setDept] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);

  const onPremiumError = (e: any) => {
    if (e instanceof ApiError && e.status === 403) setLocked(true);
  };

  useEffect(() => {
    api<any[]>("/analytics/campaign-compare").then(setCompare).catch(onPremiumError);
    api<any[]>("/analytics/department-scores").then(setDept).catch(onPremiumError);
    api<any[]>("/analytics/monthly-trends").then(setMonthly).catch(onPremiumError);
    api<any[]>("/analytics/campaigns-over-time").then(setTimeline).catch(() => {});
    api<any[]>("/analytics/top-reports").then(setTop).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Privacy-conscious engagement indicators — no credentials collected
        </p>
      </div>

      {locked && (
        <Card className="border-accent-500/40 bg-accent-500/5">
          <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center">
            <Sparkles className="h-6 w-6 shrink-0 text-accent-500" />
            <div className="flex-1">
              <div className="font-semibold">Advanced analytics are a Premium feature</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upgrade to unlock monthly trends, campaign comparisons and department scores.
              </p>
            </div>
            <Link to="/billing" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600">
              View plans
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Campaign Comparison — Click vs Report Rate</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={12} unit="%" />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={150} />
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="click_rate" name="Click %" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                <Bar dataKey="report_rate" name="Report %" fill="#22c55e" radius={[0, 6, 6, 0]} />
                <Bar dataKey="completion_rate" name="Completion %" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Department Awareness Scores</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dept}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="department" stroke="#64748b" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Bar dataKey="avg_score" name="Avg Score %" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Monthly Security Awareness Trends</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="#38bdf8" name="Opened" dot={false} />
                <Line type="monotone" dataKey="clicked" stroke="#f59e0b" name="Clicked" dot={false} />
                <Line type="monotone" dataKey="reported" stroke="#22c55e" name="Reported" dot={false} />
                <Line type="monotone" dataKey="completed" stroke="#a78bfa" name="Completed" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campaign Performance Over Time</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="sent" name="Sent" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="clicked" name="Clicked" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Campaign Comparison Detail</CardTitle></CardHeader>
          <Table head={["Campaign", "Status", "Total", "Open %", "Click %", "Report %", "Complete %"]}>
            {compare.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
                <td className="px-4 py-3 font-medium max-w-[220px] truncate">{c.name}</td>
                <td className="px-4 py-3 text-sm">{c.status}</td>
                <td className="px-4 py-3 text-sm">{c.total}</td>
                <td className="px-4 py-3 text-sm">{c.open_rate}%</td>
                <td className="px-4 py-3 text-sm">{c.click_rate}%</td>
                <td className="px-4 py-3 text-sm text-emerald-500">{c.report_rate}%</td>
                <td className="px-4 py-3 text-sm">{c.completion_rate}%</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Awareness Scores</CardTitle></CardHeader>
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {top.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500/15 text-xs font-bold text-accent-500">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-slate-400">{p.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{p.score}%</div>
                  <div className="text-xs text-slate-400">{p.trainings} trainings</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
