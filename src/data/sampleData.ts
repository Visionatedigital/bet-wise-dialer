// Sample data for Betsure Uganda Telemarketing Dashboard

export interface Lead {
  id: string;
  name: string;
  phone: string;
  segment: "dormant" | "semi-active" | "vip";
  lastActivity: string;
  lastDepositUgx: number;
  lastBetDate?: string;
  intent?: string;
  score: number;
  tags: string[];
  ownerUserId: string;
  nextAction?: string;
  nextActionDue?: string;
  campaign: string;
  priority: "high" | "medium" | "low";
  slaMinutes: number;
}

export interface Call {
  id: string;
  leadId: string;
  agentId: string;
  campaignId: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  recordingUrl?: string;
  transcript?: string;
  sentiment?: "positive" | "neutral" | "negative";
  intent?: string;
  disposition?: string;
  notes?: string;
  escalated: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  status: "planned" | "live" | "paused" | "done";
  objective: string;
  offer: string;
  scriptVersion: string;
  targetSegment: string;
  startAt: string;
  endAt: string;
  kpis: {
    dials: number;
    connects: number;
    converts: number;
    revenueUgx: number;
  };
}

export interface User {
  id: string;
  name: string;
  role: "agent" | "supervisor" | "admin";
  handle: string;
  status: "online" | "busy" | "offline";
}

// Sample Ugandan names and data
export const sampleLeads: Lead[] = [
  {
    id: "1",
    name: "Sarah Nakamura",
    phone: "+256 701 234567",
    segment: "vip",
    lastActivity: "2 hours ago",
    lastDepositUgx: 250000,
    lastBetDate: "2024-01-15",
    intent: "Bonus eligibility",
    score: 85,
    tags: ["VIP", "Bonus Inquiry"],
    ownerUserId: "agent-1",
    nextAction: "Follow up on bonus",
    nextActionDue: "2024-01-20 14:00",
    campaign: "VIP Retention Q1",
    priority: "high",
    slaMinutes: 45
  },
  {
    id: "2", 
    name: "James Okello",
    phone: "+256 702 345678",
    segment: "semi-active",
    lastActivity: "5 days ago",
    lastDepositUgx: 150000,
    lastBetDate: "2024-01-10",
    intent: "Payment support",
    score: 72,
    tags: ["Payment Issue", "Mobile Money"],
    ownerUserId: "agent-1",
    campaign: "Reactivation Campaign",
    priority: "medium",
    slaMinutes: 25
  },
  {
    id: "3",
    name: "Grace Namukasa",
    phone: "+256 703 456789", 
    segment: "dormant",
    lastActivity: "3 weeks ago",
    lastDepositUgx: 75000,
    intent: "Win-back offer",
    score: 45,
    tags: ["Dormant", "Win-back"],
    ownerUserId: "agent-2",
    campaign: "Win-back January",
    priority: "low",
    slaMinutes: 15
  },
  {
    id: "4",
    name: "Moses Katongole", 
    phone: "+256 704 567890",
    segment: "vip",
    lastActivity: "1 day ago",
    lastDepositUgx: 500000,
    lastBetDate: "2024-01-18",
    intent: "Account upgrade",
    score: 92,
    tags: ["VIP", "High Value", "Account Upgrade"],
    ownerUserId: "agent-1",
    nextAction: "Upgrade consultation",
    nextActionDue: "2024-01-21 10:00",
    campaign: "VIP Retention Q1",
    priority: "high",
    slaMinutes: 65
  },
  {
    id: "5",
    name: "Betty Nassuna",
    phone: "+256 705 678901",
    segment: "semi-active", 
    lastActivity: "1 week ago",
    lastDepositUgx: 200000,
    lastBetDate: "2024-01-12",
    intent: "Technical support",
    score: 58,
    tags: ["Technical Issue", "App Support"],
    ownerUserId: "agent-2",
    campaign: "Support Follow-up",
    priority: "medium",
    slaMinutes: 35
  }
];

export const sampleCampaigns: Campaign[] = [
  {
    id: "camp-1",
    name: "VIP Retention Q1",
    status: "live",
    objective: "Retain high-value customers",
    offer: "150% deposit bonus up to UGX 1M",
    scriptVersion: "v2.1",
    targetSegment: "VIP",
    startAt: "2024-01-01",
    endAt: "2024-03-31",
    kpis: {
      dials: 245,
      connects: 156,
      converts: 89,
      revenueUgx: 12500000
    }
  },
  {
    id: "camp-2",
    name: "Reactivation Campaign",
    status: "live",
    objective: "Re-engage semi-active users",
    offer: "Free bets worth UGX 50K",
    scriptVersion: "v1.3",
    targetSegment: "Semi-active",
    startAt: "2024-01-15",
    endAt: "2024-02-15", 
    kpis: {
      dials: 567,
      connects: 234,
      converts: 98,
      revenueUgx: 4200000
    }
  },
  {
    id: "camp-3",
    name: "Win-back January",
    status: "live",
    objective: "Win back dormant users",
    offer: "200% first deposit bonus",
    scriptVersion: "v1.1",
    targetSegment: "Dormant",
    startAt: "2024-01-01",
    endAt: "2024-01-31",
    kpis: {
      dials: 1234,
      connects: 445,
      converts: 67,
      revenueUgx: 2100000
    }
  }
];

export const sampleUsers: User[] = [
  {
    id: "agent-1",
    name: "Robert Ssemakula",
    role: "agent",
    handle: "@robert.s",
    status: "online"
  },
  {
    id: "agent-2", 
    name: "Caroline Auma",
    role: "agent",
    handle: "@caroline.a",
    status: "busy"
  },
  {
    id: "supervisor-1",
    name: "David Mugisha",
    role: "supervisor", 
    handle: "@david.m",
    status: "online"
  },
  {
    id: "admin-1",
    name: "Patricia Nalwoga",
    role: "admin",
    handle: "@patricia.n", 
    status: "online"
  }
];

export const sampleCalls: Call[] = [
  {
    id: "call-1",
    leadId: "1",
    agentId: "agent-1",
    campaignId: "camp-1",
    startedAt: "2024-01-19 09:15:00",
    endedAt: "2024-01-19 09:22:30",
    durationSeconds: 450,
    sentiment: "positive",
    intent: "Bonus inquiry",
    disposition: "interested",
    notes: "Customer interested in VIP bonus. Will deposit this weekend.",
    escalated: false
  },
  {
    id: "call-2",
    leadId: "2", 
    agentId: "agent-1",
    campaignId: "camp-2",
    startedAt: "2024-01-19 10:30:00",
    endedAt: "2024-01-19 10:35:15",
    durationSeconds: 315,
    sentiment: "neutral",
    intent: "Payment support",
    disposition: "callback",
    notes: "Customer needs help with Mobile Money deposit. Scheduled callback for Monday.",
    escalated: false
  },
  {
    id: "call-3",
    leadId: "4",
    agentId: "agent-1", 
    campaignId: "camp-1",
    startedAt: "2024-01-19 11:45:00",
    endedAt: "2024-01-19 11:58:20",
    durationSeconds: 800,
    sentiment: "positive",
    intent: "Account upgrade",
    disposition: "converted",
    notes: "Customer upgraded to premium account. Deposited UGX 750K immediately.",
    escalated: false
  }
];

// Utility functions for UGX formatting
export const formatUGX = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Timezone utilities for Kampala time
export const formatKampalaTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};