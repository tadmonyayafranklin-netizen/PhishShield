export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "org_admin" | "participant";
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Org { id: string; name: string; domain: string | null; is_active: boolean; created_at: string }
export interface Department { id: string; name: string; organization_id: string }
export interface Participant {
  id: string; email: string; full_name: string; department_id: string | null;
  department_name: string | null; organization_id: string; awareness_score: number;
  trainings_completed: number; created_at: string;
}
export interface Template {
  id: string; name: string; description: string; difficulty: string;
  educational_objective: string; subject: string; body: string; warning_signs: string;
  lesson_module_id: string | null; is_active: boolean; is_authorized_simulation: boolean;
  created_at: string;
}
export interface Campaign {
  id: string; name: string; description: string; organization_id: string;
  template_id: string; template_name: string | null; status: string;
  start_at: string | null; end_at: string | null; scheduled_at: string | null;
  participant_count: number; created_at: string;
}
export interface CampaignStats {
  campaign_id: string; name: string; status: string; total_participants: number;
  delivered: number; opened: number; clicked: number; reported: number; completed: number;
  open_rate: number; click_rate: number; report_rate: number; completion_rate: number;
}
export interface Module {
  id: string; title: string; description: string; category: string;
  content: string; duration_minutes: number; organization_id: string | null; created_at: string;
}
export interface Quiz {
  id: string; module_id: string; title: string;
  questions: { id: string; question: string; options: string[] }[];
  passing_score: number;
}
export interface QuizResult {
  id: string; quiz_id: string; participant_id: string; score: number; passed: boolean; created_at: string;
}
export interface NotificationOut {
  id: string; title: string; message: string; kind: string; read: boolean; created_at: string;
}
export interface AuditLog {
  id: string; user_email: string | null; action: string; detail: string;
  ip_address: string | null; created_at: string;
}
export interface Plan {
  id: string; name: string; price: number; currency: string;
  interval_days: number | null; features: string[];
}
export interface SubscriptionOut {
  plan: string; status: string; is_premium: boolean;
  current_period_end: string | null; currency: string;
  premium_price: number; premium_days: number; payunit_enabled: boolean;
  plans: Plan[];
}
export interface PaymentOut {
  id: string; plan: string; amount: number; currency: string;
  transaction_id: string; provider_reference: string | null; status: string;
  failure_reason: string | null; created_at: string; paid_at: string | null;
}
export interface DashboardStats {
  total_participants: number; active_campaigns: number; completed_campaigns: number;
  total_campaigns: number; emails_sent: number; training_interactions: number;
  avg_awareness_score: number; completion_rate: number; is_premium: boolean;
  recent_activity: { id: string; action: string; user: string | null; detail: string; at: string }[];
}
