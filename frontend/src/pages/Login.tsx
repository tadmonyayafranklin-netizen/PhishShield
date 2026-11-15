import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Button, Card, CardContent, Input, Field } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-950 p-4">
      <Card className="w-full max-w-md border-navy-700 bg-navy-900">
        <CardContent className="pt-8">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Shield className="h-12 w-12 text-accent-400" />
            <h1 className="text-2xl font-bold text-white">PhishShield</h1>
            <p className="text-sm text-slate-400">Security awareness & phishing simulation platform</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>
            <Field label="Password">
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </Button>
          </form>
          <div className="mt-6 rounded-lg bg-navy-800 p-3 text-xs text-slate-400">
            <div className="font-semibold text-slate-300 mb-1">Demo accounts</div>
            <div>Super admin: admin@phishshield.io / Admin123!</div>
            <div>Org admin: orgadmin@acme.example / OrgAdmin123!</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
