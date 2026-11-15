import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { api, apiDownload } from "../lib/api";
import type { AuditLog } from "../lib/types";
import { Badge, Button, Card, Input, Table } from "../components/ui";

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [email, setEmail] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (email) params.set("user_email", email);
    api<AuditLog[]>(`/audit?${params}`).then(setLogs).catch(() => {});
  };
  useEffect(load, [action, email]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Administrative activity trail</p>
        </div>
        <Button variant="outline" onClick={() => apiDownload("/audit/export", "audit_log.csv")}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Filter by action…" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <Input className="max-w-xs" placeholder="Filter by user email…" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Table head={["Timestamp", "User", "Action", "Detail", "IP"]}>
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/50">
              <td className="px-4 py-3 text-sm whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm">{l.user_email || "system"}</td>
              <td className="px-4 py-3"><Badge tone="blue">{l.action}</Badge></td>
              <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate font-mono">{l.detail}</td>
              <td className="px-4 py-3 text-xs text-slate-400">{l.ip_address || "—"}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No audit entries</td></tr>}
        </Table>
      </Card>
    </div>
  );
}
