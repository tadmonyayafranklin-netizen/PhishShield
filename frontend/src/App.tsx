import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import Templates from "./pages/Templates";
import Participants from "./pages/Participants";
import Analytics from "./pages/Analytics";
import Training from "./pages/Training";
import Users from "./pages/Users";
import Orgs from "./pages/Orgs";
import Audit from "./pages/Audit";
import Simulation from "./pages/Simulation";
import Billing from "./pages/Billing";
import BillingReturn from "./pages/BillingReturn";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-dvh items-center justify-center bg-navy-950 text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/sim/:token" element={<Simulation />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<RoleGate roles={["super_admin", "org_admin"]}><Campaigns /></RoleGate>} />
            <Route path="/templates" element={<RoleGate roles={["super_admin", "org_admin"]}><Templates /></RoleGate>} />
            <Route path="/participants" element={<RoleGate roles={["super_admin", "org_admin"]}><Participants /></RoleGate>} />
            <Route path="/analytics" element={<RoleGate roles={["super_admin", "org_admin"]}><Analytics /></RoleGate>} />
            <Route path="/training" element={<Training />} />
            <Route path="/users" element={<RoleGate roles={["super_admin", "org_admin"]}><Users /></RoleGate>} />
            <Route path="/orgs" element={<RoleGate roles={["super_admin"]}><Orgs /></RoleGate>} />
            <Route path="/audit" element={<RoleGate roles={["super_admin", "org_admin"]}><Audit /></RoleGate>} />
            <Route path="/billing" element={<RoleGate roles={["super_admin", "org_admin"]}><Billing /></RoleGate>} />
          </Route>
          <Route path="/billing/return" element={<Protected><BillingReturn /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
