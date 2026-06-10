export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "agent" | "management" | "admin" | "crm";
  approved?: boolean;
  status?: string;
  country?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  segment: string;
  priority: "high" | "medium" | "low";
  status?: string | null;
  last_activity?: string | null;
  last_deposit_ugx?: number | null;
  last_bet_date?: string | null;
  intent?: string | null;
  score?: number | null;
  lead_score?: number | null;
  lifetime_value?: number | null;
  deposit_count?: number | null;
  betting_patterns?: Record<string, any> | null;
  analysis_notes?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  tags?: string[] | null;
  user_id?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  campaign?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  trait?: string | null;
  preferred_product?: string | null;
  last_contact_at?: string | null;
  vip_level?: string | null;
  risk_status?: string | null;
  favourite_game?: string | null;
  last_login_at?: string | null;
  last_deposit_at?: string | null;
  total_deposits?: number | null;
  current_bonus?: number | null;
  preferred_contact_time?: string | null;
  created_at?: string;
  updated_at?: string;
  country?: string | null;
}

export interface CallActivity {
  id: string;
  user_id: string;
  phone_number: string;
  lead_name: string;
  call_type: string;
  status: string;
  duration_seconds: number;
  deposit_amount: number | null;
  notes: string | null;
  campaign_id: string | null;
  created_at: string;
}

export interface Callback {
  id: string;
  user_id: string;
  lead_name: string;
  phone_number: string;
  notes: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
}

export interface DailyMetrics {
  id: string;
  user_id: string;
  date: string;
  calls_made: number;
  connects: number;
  conversions: number;
  total_handle_time_seconds: number;
  total_deposit_value: number;
}

export interface ContactTimelineEvent {
  id: string;
  contact_id: string;
  agent_id?: string;
  event_type: string;
  title: string;
  summary?: string;
  outcome?: string;
  next_action?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CrmCallLog {
  id: string;
  contact_id: string;
  agent_id: string;
  phone_number: string;
  call_outcome: string;
  client_mood?: string;
  reason_for_contact?: string;
  result?: string;
  next_action?: string;
  notes?: string;
  ai_summary?: string;
  created_at: string;
}
