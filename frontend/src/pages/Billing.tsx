import { useEffect, useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { PaymentOut, SubscriptionOut } from "../lib/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table } from "../components/ui";
import { useAuth } from "../lib/auth";

export default function Billing() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubscriptionOut | null>(null);
  const [payments, setPayments] = useState<PaymentOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api<SubscriptionOut>("/billing/status").then(setSub).catch((e) => setError(e.message));
    api<PaymentOut[]>("/billing/payments").then(setPayments).catch(() => {});
  };

  useEffect(load, []);

  const subscribe = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ transaction_url: string }>("/billing/subscribe", {
        method: "POST",
        body: { plan: "premium" },
      });
      if (res.transaction_url) {
        window.location.href = res.transaction_url;
        return;
      }
      setError("Payment provider did not return a checkout URL");
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Failed to start payment");
    } finally {
      setBusy(false);
    }
  };

  if (!sub) return <div className="text-slate-500">Loading…</div>;

  const premiumPlan = sub.plans.find((p) => p.id === "premium");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Payments are processed securely by PayUnit
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sub.plans.map((plan) => {
          const current = sub.plan === plan.id;
          const isPremium = plan.id === "premium";
          return (
            <Card key={plan.id} className={isPremium && !current ? "border-accent-500/50" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isPremium && <Sparkles className="h-4 w-4 text-accent-500" />}
                  {plan.name}
                  {current && <Badge tone="green">Current plan</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {plan.price === 0 ? "Free" : `${plan.price.toLocaleString()} ${plan.currency}`}
                  {plan.interval_days && <span className="text-sm font-normal text-slate-500"> / {plan.interval_days} days</span>}
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isPremium && sub.is_premium ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Premium active{sub.current_period_end && ` until ${new Date(sub.current_period_end).toLocaleDateString()}`}. Each payment extends your access by {sub.premium_days} days.
                  </div>
                ) : isPremium ? (
                  <Button onClick={subscribe} disabled={busy || !sub.payunit_enabled} className="w-full">
                    <CreditCard className="h-4 w-4" />
                    {busy ? "Redirecting…" : `Upgrade — ${premiumPlan?.price.toLocaleString()} ${sub.currency}`}
                  </Button>
                ) : null}
                {isPremium && !sub.payunit_enabled && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    PayUnit payments are not configured yet. Set PAYUNIT_* environment variables to enable checkout.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments yet.</p>
          ) : (
            <Table head={["Date", "Plan", "Amount", "Transaction", "Status"]}>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm capitalize">{p.plan}</td>
                  <td className="px-4 py-3 text-sm">{p.amount.toLocaleString()} {p.currency}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{p.transaction_id}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "success" ? "green" : p.status === "failed" ? "red" : "amber"}>
                      {p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
