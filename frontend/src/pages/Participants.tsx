import { useEffect, useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { api, apiDownload } from "../lib/api";
import type { Department, Participant } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, Field, Input, Modal, Select, Table } from "../components/ui";

export default function Participants() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", department_id: "" });
  const [csvText, setCsvText] = useState("");
  const [importDept, setImportDept] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (deptFilter) params.set("department_id", deptFilter);
    api<Participant[]>(`/participants?${params}`).then(setParticipants).catch(() => {});
  };
  useEffect(() => {
    load();
    api<Department[]>("/departments").then(setDepartments).catch(() => {});
  }, [search, deptFilter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/participants", {
        method: "POST",
        body: { ...form, department_id: form.department_id || null, organization_id: user?.organization_id },
      });
      setOpen(false);
      setForm({ email: "", full_name: "", department_id: "" });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const doImport = async () => {
    // parse simple CSV: email,full_name per line (header optional)
    const rows = csvText.split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => {
        const [email, ...rest] = l.split(",");
        return { email: email.trim(), full_name: rest.join(",").trim() || email.trim() };
      })
      .filter((r) => r.email.includes("@") && !r.email.toLowerCase().startsWith("email"));
    const res = await api<{ created: number; skipped: number }>("/participants/import", {
      method: "POST",
      body: { organization_id: user?.organization_id, department_id: importDept || null, rows },
    });
    setMsg(`Imported ${res.created} participants (${res.skipped} skipped)`);
    setCsvText("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this participant?")) return;
    await api(`/participants/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Participants</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{participants.length} enrolled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => apiDownload("/reports/participants.csv", "participants.csv")}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Participant</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-navy-700">
          <Input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="max-w-xs">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <Table head={["Name", "Email", "Department", "Awareness Score", "Trainings", "Joined", ""]}>
          {participants.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
              <td className="px-4 py-3 font-medium">{p.full_name}</td>
              <td className="px-4 py-3 text-sm">{p.email}</td>
              <td className="px-4 py-3 text-sm">{p.department_name || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div className="h-full bg-accent-500" style={{ width: `${p.awareness_score}%` }} />
                  </div>
                  <span className="text-xs font-medium">{p.awareness_score}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{p.trainings_completed}</td>
              <td className="px-4 py-3 text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </td>
            </tr>
          ))}
          {participants.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No participants found</td></tr>
          )}
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Participant">
        <form onSubmit={create} className="space-y-4">
          <Field label="Full name"><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Department">
            <Select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Participants (CSV)">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Paste CSV rows as <code>email,full_name</code> (one per line). Or upload a .csv file.</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) f.text().then(setCsvText);
            }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Choose file</Button>
          <textarea
            className="h-40 w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 p-3 font-mono text-xs"
            placeholder={"ava.chen@acme.example,Ava Chen\nliam.patel@acme.example,Liam Patel"}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <Field label="Assign department (optional)">
            <Select value={importDept} onChange={(e) => setImportDept(e.target.value)}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          {msg && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{msg}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={doImport} disabled={!csvText.trim()}><Upload className="h-4 w-4" /> Import</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
