// Lead type definition matching the database schema
export interface Lead {
  id: string;
  name: string;
  phone: string;
  segment: "dormant" | "semi-active" | "vip";
  lastActivity?: string | null;
  lastDepositUgx?: number | null;
  lastBetDate?: string | null;
  intent?: string | null;
  score?: number | null;
  tags?: string[] | null;
  ownerUserId?: string | null;
  user_id?: string | null;
  nextAction?: string | null;
  nextActionDue?: string | null;
  campaign?: string | null;
  campaignId?: string | null;
  priority: "high" | "medium" | "low";
  slaMinutes?: number | null;
  assignedAt?: string | null;
  last_contact_at?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string | null;
}

