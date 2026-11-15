import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { SubscriptionOut } from "../lib/types";
import { Card, CardContent } from "../components/ui";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirming your payment…");
  const attempts = useRef(0);

  useEffect(() => {
    const ref = params.get("ref");
    let cancelled = false;

    const poll = async () => {
      try {
        await api("/billing/refresh", { method: "POST" });
        const sub = await api<SubscriptionOut>("/billing/status");
        if (cancelled) return;
        if (sub.is_premium) {
          setMessage("Payment confirmed — Premium activated!");
          setTimeout(() => navigate("/billing"), 1500);
          return;
        }
      } catch {}
      attempts.current += 1;
      if (attempts.current >= 10) {
        setMessage("Payment is still being processed. It will activate automatically once PayUnit confirms — check Billing later.");
        setTimeout(() => navigate("/billing"), 4000);
        return;
      }
      setTimeout(poll, 3000);
    };

    poll();
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <div className="flex h-dvh items-center justify-center bg-navy-950 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent-500 border-t-transparent" />
          <h1 className="text-lg font-semibold">Payment status</h1>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
