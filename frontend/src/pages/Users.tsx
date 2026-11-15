import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Org, User } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Badge, Button, Card, Field, Input, Modal, Select, Table } from "../components/ui";

const ROLE_TONE: Record<string, any> = { super_admin: "purple", org_admin: "blue", participant: "slate" };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "org_admin", organization_id: "" });

  const load = () => {
    api<User[]>("/users").then(setUsers).catch(() => {});
    if (me?.role === "super_admin") api<Org[]>("/orgs").then(setOrgs).catch(() => {});
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/users", { method: "POST", body: { ...form, organization_id: form.organization_id || me?.organization_id } });
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "org_admin", organization_id: "" });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggle = async (id: string) => {
    await api(`/users/${id}/toggle`, { method: "PATCH" }).catch((e) => alert(e.message));
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users & Permissions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Role-based access control</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add User</Button>
      </div>

      <Card>
        <Table head={["Name", "Email", "Role", "Organization", "Status", "Actions"]}>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
              <td className="px-4 py-3 font-medium">{u.full_name}</td>
              <td className="px-4 py-3 text-sm">{u.email}</td>
              <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role.replace("_", " ")}</Badge></td>
              <td className="px-4 py-3 text-sm">{orgs.find((o) => o.id === u.organization_id)?.name || "—"}</td>
              <td className="px-4 py-3"><Badge tone={u.is_active ? "green" : "red"}>{u.is_active ? "Active" : "Disabled"}</Badge></td>
              <td className="px-4 py-3">
                {u.id !== me?.id && (
                  <Button size="sm" variant="outline" onClick={() => toggle(u.id)}>{u.is_active ? "Disable" : "Enable"}</Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add User">
        <form onSubmit={create} className="space-y-4">
          <Field label="Full name"><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password (min 8 chars)"><Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {me?.role === "super_admin" && <option value="super_admin">Super Admin</option>}
                <option value="org_admin">Organization Admin</option>
                <option value="participant">Participant</option>
              </Select>
            </Field>
            {me?.role === "super_admin" && (
              <Field label="Organization">
                <Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
                  <option value="">Select…</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
