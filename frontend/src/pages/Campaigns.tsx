import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Pause, Play, Plus, Send, Square, CheckCircle2 } from "lucide-react";
import { api, apiDownload } from "../lib/api";
import type { Campaign, CampaignStats, Participant, Template } from "../lib/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Modal, Select, Table, Textarea } from "../components/ui";

const STATUS_TONE: Record<string, any> = {
  draft: "slate", scheduled: "blue", active: "green", paused: "amber",
  completed: "purple", cancelled: "red",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", description: "", template_id: "", start_at: "", end_at: "", participant_ids: [] as string[] });
  const [error, setError] = useState("");

  const download = (path: string, filename: string) =>
    apiDownload(path, filename).catch((e) => alert(e?.message || "Download failed"));

  const load = () => {
    api<Campaign[]>("/campaigns").then(setCampaigns).catch(() => {});
  };
  useEffect(() => {
    load();
    api<Template[]>("/templates").then(setTemplates).catch(() => {});
    api<Participant[]>("/participants").then(setParticipants).catch(() => {});
  }, []);

  const openStats = (id: string) => {
    setStatsFor(id);
    api<CampaignStats>(`/campaigns/${id}/stats`).then(setStats).catch(() => {});
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await api(`/campaigns/${id}/status`, { method: "PATCH", body: { status } });
      load();
      if (statsFor === id) openStats(id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const orgId = campaigns[0]?.organization_id || participants[0]?.organization_id;
      await api("/campaigns", {
        method: "POST",
        body: {
          ...form,
          organization_id: orgId,
          start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
          end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        },
      });
      setCreateOpen(false);
      setForm({ name: "", description: "", template_id: "", start_at: "", end_at: "", participant_ids: [] });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const chartData = useMemo(() => stats ? [
    { name: "Delivered", value: stats.delivered },
    { name: "Opened", value: stats.opened },
    { name: "Clicked", value: stats.clicked },
    { name: "Reported", value: stats.reported },
    { name: "Completed", value: stats.completed },
  ] : [], [stats]);

  const statsCampaign = campaigns.find((c) => c.id === statsFor);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Authorized phishing awareness simulations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Campaign</Button>
      </div>

      <Card>
        <Table head={["Name", "Template", "Status", "Participants", "Start", "End", "Actions"]}>
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
              <td className="px-4 py-3">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-400 max-w-xs truncate">{c.description}</div>
              </td>
              <td className="px-4 py-3 text-sm">{c.template_name}</td>
              <td className="px-4 py-3"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
              <td className="px-4 py-3 text-sm">{c.participant_count}</td>
              <td className="px-4 py-3 text-sm">{c.start_at ? new Date(c.start_at).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3 text-sm">{c.end_at ? new Date(c.end_at).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openStats(c.id)}>Stats</Button>
                  {c.status === "draft" && <Button size="sm" onClick={() => setStatus(c.id, "scheduled")}>Schedule</Button>}
                  {c.status === "scheduled" && <Button size="sm" onClick={() => setStatus(c.id, "active")}><Send className="h-3.5 w-3.5" /> Activate</Button>}
                  {c.status === "active" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(c.id, "paused")}><Pause className="h-3.5 w-3.5" /> Pause</Button>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(c.id, "completed")}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
                    </>
                  )}
                  {c.status === "paused" && <Button size="sm" onClick={() => setStatus(c.id, "active")}><Play className="h-3.5 w-3.5" /> Resume</Button>}
                  {["draft", "scheduled", "active", "paused"].includes(c.status) && (
                    <Button size="sm" variant="danger" onClick={() => setStatus(c.id, "cancelled")}><Square className="h-3.5 w-3.5" /> Cancel</Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No campaigns yet</td></tr>
          )}
        </Table>
      </Card>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Campaign" wide>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Simulation template">
              <Select required value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                <option value="">Select template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.difficulty})</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date"><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></Field>
            <Field label="End date"><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></Field>
          </div>
          <Field label={`Participants (${form.participant_ids.length} selected)`}>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-300 dark:border-navy-600 p-2">
              {participants.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-navy-800 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.participant_ids.includes(p.id)}
                    onChange={(e) => setForm({
                      ...form,
                      participant_ids: e.target.checked
                        ? [...form.participant_ids, p.id]
                        : form.participant_ids.filter((x: string) => x !== p.id),
                    })}
                  />
                  {p.full_name} <span className="text-slate-400">— {p.email} ({p.department_name || "no dept"})</span>
                </label>
              ))}
            </div>
          </Field>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create Draft</Button>
          </div>
        </form>
      </Modal>

      {/* Stats modal */}
      <Modal open={!!statsFor} onClose={() => { setStatsFor(null); setStats(null); }} title={statsCampaign?.name || "Campaign Stats"} wide>
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[["Delivered", stats.delivered], ["Opened", stats.opened], ["Clicked", stats.clicked], ["Reported", stats.reported], ["Completed", stats.completed]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-slate-50 dark:bg-navy-800 p-3 text-center">
                  <div className="text-xl font-bold">{v}</div>
                  <div className="text-xs text-slate-500">{l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <div>Open rate: <b>{stats.open_rate}%</b></div>
              <div>Click rate: <b>{stats.click_rate}%</b></div>
              <div>Report rate: <b>{stats.report_rate}%</b></div>
              <div>Completion: <b>{stats.completion_rate}%</b></div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ background: "#0f1f4d", border: "1px solid #16306e", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => download(`/reports/campaign/${statsFor}.csv`, `campaign_${statsFor}.csv`)}>Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => download(`/reports/campaign/${statsFor}.pdf`, `campaign_${statsFor}.pdf`)}>Export PDF</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
