import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Flag, GraduationCap, Shield, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { Badge, Button, Card, CardContent } from "../components/ui";

interface LandingInfo {
  simulation: boolean;
  authorized: boolean;
  campaign: string;
  template_name: string;
  educational_objective: string;
  warning_signs: string[];
  email_subject: string;
  email_body: string;
  participant_first_name: string;
}

export default function Simulation() {
  const { token } = useParams();
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<LandingInfo>(`/campaigns/public/landing/${token}`, { auth: false })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);

  const sendEvent = async (event_type: string) => {
    if (!token) return;
    await api(`/campaigns/public/landing/${token}/event?event_type=${event_type}`, {
      method: "POST", auth: false,
    }).catch(() => {});
    setDone(event_type);
  };

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-950 p-4">
        <Card className="max-w-md border-navy-700 bg-navy-900">
          <CardContent className="pt-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-3 text-xl font-bold text-white">Simulation Unavailable</h1>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) {
    return <div className="flex min-h-dvh items-center justify-center bg-navy-950 text-slate-400">Loading simulation…</div>;
  }

  return (
    <div className="min-h-dvh bg-navy-950 p-4 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Banner */}
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <Shield className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-300">This is an authorized security awareness simulation</div>
            <p className="text-sm text-amber-200/80 mt-1">
              You clicked a link in a simulated phishing email as part of {info.campaign}. No credentials were requested or collected.
            </p>
          </div>
        </div>

        {/* The simulated email */}
        <Card className="border-navy-700 bg-navy-900">
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500 mb-1">Simulated email that was sent</div>
            <div className="text-sm font-semibold">Subject: {info.email_subject}</div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-navy-800 p-4 text-sm font-sans text-slate-300">{info.email_body}</pre>
          </CardContent>
        </Card>

        {/* Why suspicious */}
        <Card className="border-navy-700 bg-navy-900">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-accent-400" />
              <h2 className="text-lg font-semibold text-white">Why this message was suspicious</h2>
            </div>
            <p className="text-sm text-slate-300">{info.educational_objective}</p>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Warning signs to watch for</div>
              <ul className="space-y-2">
                {info.warning_signs.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-navy-800 p-4 text-sm text-slate-300 space-y-2">
              <div className="font-semibold text-white">How to stay safe next time:</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Never enter passwords or credentials from an email link — go to the official site directly.</li>
                <li>Hover over links to preview the real destination before clicking.</li>
                <li>Verify unexpected requests via a known phone number or official portal.</li>
                <li>Report suspicious messages using your organization's reporting button.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-navy-700 bg-navy-900">
          <CardContent className="pt-5 flex flex-wrap gap-3">
            <Button onClick={() => sendEvent("completed")} disabled={done === "completed"}>
              <CheckCircle2 className="h-4 w-4" /> {done === "completed" ? "Training logged" : "Mark training complete"}
            </Button>
            <Button variant="outline" onClick={() => sendEvent("reported")} disabled={done === "reported"}>
              <Flag className="h-4 w-4" /> {done === "reported" ? "Reported — great job!" : "This was suspicious — report it"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          PhishShield authorized simulation · {info.template_name}
        </p>
      </div>
    </div>
  );
}
