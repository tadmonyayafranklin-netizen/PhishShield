import { useEffect, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Template } from "../lib/types";
import { Badge, Button, Card, CardContent, Field, Input, Modal, Select, Table, Textarea } from "../components/ui";
import { useAuth } from "../lib/auth";

const DIFF_TONE: Record<string, any> = { beginner: "green", intermediate: "amber", advanced: "red" };

export default function Templates() {
  const { user } = useAuth();
  const canEdit = user?.role !== "participant";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [preview, setPreview] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState("");

  const load = () => api<Template[]>("/templates").then(setTemplates).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/templates", { method: "POST", body: form });
      setOpen(false);
      setForm({});
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggle = async (id: string) => {
    await api(`/templates/${id}/toggle`, { method: "PATCH" }).catch((e) => alert(e.message));
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Simulation Templates</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Authorized educational phishing scenarios — never collect credentials
          </p>
        </div>
        {canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Template</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardContent className="pt-5 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge tone={DIFF_TONE[t.difficulty] || "slate"}>{t.difficulty}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{t.description}</p>
              <div className="mt-3 rounded-lg bg-navy-800/60 p-3 text-xs">
                <span className="font-semibold text-accent-400">Objective: </span>
                <span className="text-slate-300">{t.educational_objective}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="blue">Authorized simulation</Badge>
                <span className="text-xs text-slate-400">Subject: {t.subject}</span>
              </div>
            </CardContent>
            <div className="flex gap-2 border-t border-slate-200 dark:border-navy-700 px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => setPreview(t)}><Eye className="h-3.5 w-3.5" /> Preview</Button>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => toggle(t.id)}>{t.is_active ? "Disable" : "Enable"}</Button>}
            </div>
          </Card>
        ))}
      </div>

      {/* Preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name || ""} wide>
        {preview && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="text-slate-500">Difficulty:</span> <Badge tone={DIFF_TONE[preview.difficulty]}>{preview.difficulty}</Badge></div>
              <div><span className="text-slate-500">Subject:</span> {preview.subject}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Educational objective</div>
              <p className="text-sm">{preview.educational_objective}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Warning signs participants should spot</div>
              <p className="text-sm whitespace-pre-line">{preview.warning_signs}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Simulated email (preview)</div>
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-100 dark:bg-navy-800 p-3 text-xs font-mono">{preview.body}</pre>
            </div>
            <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-300">
              This is an authorized security awareness simulation. It never requests passwords, tokens, or other credentials.
            </div>
          </div>
        )}
      </Modal>

      {/* Create */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Simulation Template" wide>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Difficulty">
              <Select value={form.difficulty || "beginner"} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
          </div>
          <Field label="Subject line"><Input required value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} required value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Educational objective"><Textarea rows={2} required value={form.educational_objective || ""} onChange={(e) => setForm({ ...form, educational_objective: e.target.value })} /></Field>
          <Field label="Email body (use {{name}} and {{token}} placeholders; link example: http://phishshield.local/s/{{token}})">
            <Textarea rows={6} required className="font-mono text-xs" value={form.body || ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Field label="Warning signs (separate with semicolons)"><Input value={form.warning_signs || ""} onChange={(e) => setForm({ ...form, warning_signs: e.target.value })} /></Field>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Template</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
