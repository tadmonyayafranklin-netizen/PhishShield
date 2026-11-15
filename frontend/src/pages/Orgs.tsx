import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Org } from "../lib/types";
import { Badge, Button, Card, Field, Input, Modal } from "../components/ui";

export default function Orgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "" });

  const load = () => api<Org[]>("/orgs").then(setOrgs).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("/orgs", { method: "POST", body: { name: form.name, domain: form.domain || null } });
    setOpen(false);
    setForm({ name: "", domain: "" });
    load();
  };

  const toggle = async (id: string) => {
    await api(`/orgs/${id}/toggle`, { method: "PATCH" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Platform tenants</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New Organization</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orgs.map((o) => (
          <Card key={o.id}>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15">
                  <Building2 className="h-5 w-5 text-accent-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-xs text-slate-400">{o.domain || "no domain"}</div>
                </div>
                <Badge tone={o.is_active ? "green" : "red"}>{o.is_active ? "Active" : "Disabled"}</Badge>
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => toggle(o.id)}>{o.is_active ? "Disable" : "Enable"}</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Organization">
        <form onSubmit={create} className="space-y-4">
          <Field label="Name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Approved email domain (optional)"><Input placeholder="company.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
