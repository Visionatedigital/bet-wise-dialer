import { useState, useCallback, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload, FileSpreadsheet, Users, CheckCircle2, ChevronDown, ChevronRight,
  Crown, TrendingUp, Zap, Moon, ArrowRight, Loader2, X, Trash2, AlertTriangle,
} from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectCountryFromPhone, formatPhoneForCountry } from "@/config/countries";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Column mapping: betting-platform (Chinese) → internal ────────────────────
const COL_MAP: Record<string, string> = {
  username: "phone",
  "最后登录时间": "last_login",
  "分类": "category",
  "总票数": "total_bets",
  "体育票数": "sports_bets",
  "游戏票数": "game_bets",
  "充值金额(美金)": "deposit_usd",
  "充值金额(本币)": "deposit_local",
  "投注总金额": "total_bet_amount",
  "总ggr": "total_ggr",
  "体育ggr": "sports_ggr",
  "游戏ggr": "game_ggr",
  "是否充值": "has_deposited",
};

// ─── Categories ────────────────────────────────────────────────────────────────
type Tier = "high_staker" | "medium_staker" | "frequent_bettor" | "low_staker" | "dormant";

// Status-based categories matching the Manage Leads screen
const STATUS_CATEGORIES = [
  { id: "unassigned", label: "New / Unassigned", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "no_answer", label: "No Answer", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "unreachable", label: "Unreachable", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  { id: "interested", label: "Interested", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  { id: "not_interested", label: "Not Interested", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
  { id: "answered_no_response", label: "No Response", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
] as const;

const TIERS: {
  id: Tier;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}[] = [
  {
    id: "high_staker",
    label: "High Stakers",
    description: "≥ $1,000 deposited or ≥ 3.5M local",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: Crown,
  },
  {
    id: "medium_staker",
    label: "Medium Stakers",
    description: "≥ $200 deposited or ≥ 700K local",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: TrendingUp,
  },
  {
    id: "frequent_bettor",
    label: "Frequent Bettors",
    description: "500+ bets placed",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: Zap,
  },
  {
    id: "low_staker",
    label: "Low Stakers",
    description: "< $200 deposited, active",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: TrendingUp,
  },
  {
    id: "dormant",
    label: "Dormant",
    description: "Inactive 60+ days or no deposits",
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: Moon,
  },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
type ParsedLead = {
  id: string; // client-only key
  phone: string;
  name: string;
  tier: Tier;
  segment: string;
  priority: string;
  score: number;
  lead_score: number;
  trait: string | null;
  preferred_product: string | null;
  last_deposit_ugx: number;
  lifetime_value: number;
  deposit_count: number;
  last_bet_date: string | null;
  betting_patterns: Record<string, any>;
};

type Agent = { id: string; full_name: string; assigned_leads: number };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v === "number") return new Date(Math.floor(v - 25569) * 86400000);
  return null;
}

function classifyTier(deposit_usd: number, deposit_local: number, total_bets: number, last_login: Date | null): {
  tier: Tier; segment: string; priority: string; score: number; trait: string | null;
} {
  if (deposit_usd >= 1000 || deposit_local >= 3_500_000)
    return { tier: "high_staker", segment: "vip", priority: "high", trait: "High Staker", score: Math.min(95, 70 + Math.floor(deposit_usd / 500)) };
  if (deposit_usd >= 200 || deposit_local >= 700_000)
    return { tier: "medium_staker", segment: "semi-active", priority: "medium", trait: "Medium Staker", score: Math.min(70, 40 + Math.floor(deposit_usd / 100)) };
  if (total_bets >= 500)
    return { tier: "frequent_bettor", segment: "semi-active", priority: "medium", trait: "Frequent Bettor", score: 45 };
  if (deposit_usd > 50)
    return { tier: "low_staker", segment: "semi-active", priority: "medium", trait: "Low Staker", score: 35 };
  if (last_login) {
    const days = Math.floor((Date.now() - last_login.getTime()) / 86400000);
    if (days > 60) return { tier: "dormant", segment: "dormant", priority: "low", trait: "Dormant", score: 15 };
  }
  return { tier: "dormant", segment: "dormant", priority: "low", trait: null, score: 20 };
}

function parseRows(json: any[], defaultCountry = 'UG'): ParsedLead[] {
  const seen = new Set<string>();
  return json
    .map((raw, i) => {
      // Normalize column names
      const r: any = {};
      for (const [k, v] of Object.entries(raw)) {
        r[COL_MAP[k] ?? k.toLowerCase()] = v;
      }

      const rawPhone = String(r.phone ?? r.number ?? r.phonenumber ?? r.username ?? "").trim();
      if (!rawPhone) return null;
      const country = detectCountryFromPhone(rawPhone, defaultCountry);
      const phone = formatPhoneForCountry(rawPhone, country);
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) return null;
      if (seen.has(digits)) return null;
      seen.add(digits);

      const deposit_usd = num(r.deposit_usd);
      const deposit_local = num(r.deposit_local);
      const total_bets = num(r.total_bets);
      const last_login = toDate(r.last_login);
      const { tier, segment, priority, trait, score } = classifyTier(deposit_usd, deposit_local, total_bets, last_login);

      const cat = String(r.category ?? "");
      const sports_bets = num(r.sports_bets);
      const game_bets = num(r.game_bets);
      const preferred_product =
        cat.includes("体育") ? "Sports" :
        cat.includes("游戏") ? "Gaming" :
        cat.includes("彩票") ? "Lottery" :
        sports_bets > game_bets ? "Sports" :
        game_bets > 0 ? "Gaming" : null;

      return {
        id: `lead-${i}-${digits}`,
        phone,
        name: r.name ?? `User ${digits.slice(-4)}`,
        tier, segment, priority, score, lead_score: score, trait,
        preferred_product,
        last_deposit_ugx: deposit_local || Math.round(deposit_usd * 3700),
        lifetime_value: deposit_local || Math.round(deposit_usd * 3700),
        deposit_count: total_bets,
        last_bet_date: last_login ? last_login.toISOString().split("T")[0] : null,
        betting_patterns: {
          deposit_usd, deposit_local, total_bets, sports_bets, game_bets,
          total_ggr: num(r.total_ggr), total_bet_amount: num(r.total_bet_amount),
          last_login: last_login?.toISOString() ?? null, platform_category: cat,
        },
      } as ParsedLead;
    })
    .filter((x): x is ParsedLead => !!x);
}

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 text-sm font-medium transition-colors",
      active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40")}>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
        done ? "bg-green-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground/40")}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </span>
      {label}
    </div>
  );
}

// ─── Preview-only collapsible (Step 2) ────────────────────────────────────────
function TierPreview({
  tier, leads,
}: {
  tier: typeof TIERS[number];
  leads: ParsedLead[];
}) {
  const [open, setOpen] = useState(false);
  const Icon = tier.icon;
  return (
    <div className={cn("rounded-xl border overflow-hidden", tier.border)}>
      <button
        className={cn("w-full flex items-center justify-between px-4 py-3 text-left", tier.bg)}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <Icon className={cn("h-4 w-4", tier.color)} />
          <span className={cn("font-semibold", tier.color)}>{tier.label}</span>
          <Badge variant="secondary" className="text-xs">{leads.length} leads</Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">{tier.description}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y max-h-48 overflow-y-auto">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="font-mono text-xs w-36 shrink-0 text-muted-foreground">{lead.phone}</span>
              <span className="flex-1 truncate">{lead.name}</span>
              {lead.preferred_product && (
                <Badge variant="outline" className="text-xs shrink-0">{lead.preferred_product}</Badge>
              )}
              {lead.betting_patterns.deposit_usd > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  ${lead.betting_patterns.deposit_usd.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Category panel (Step 3 — with checkboxes) ────────────────────────────────
function TierPanel({
  tier, leads, selectedIds, onToggle, onSelectAll,
}: {
  tier: typeof TIERS[number];
  leads: ParsedLead[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], check: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const Icon = tier.icon;
  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const someSelected = leads.some(l => selectedIds.has(l.id));

  return (
    <div className={cn("rounded-xl border overflow-hidden", tier.border)}>
      {/* Header */}
      <button
        className={cn("w-full flex items-center justify-between px-4 py-3 text-left", tier.bg)}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? "indeterminate" : undefined}
            onCheckedChange={(v) => {
              onSelectAll(leads.map(l => l.id), !!v);
            }}
            onClick={e => e.stopPropagation()}
            className="border-current"
          />
          <Icon className={cn("h-4 w-4", tier.color)} />
          <span className={cn("font-semibold", tier.color)}>{tier.label}</span>
          <Badge variant="secondary" className="text-xs">{leads.length} leads</Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">{tier.description}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Rows */}
      {open && leads.length > 0 && (
        <div className="divide-y">
          {leads.map(lead => (
            <label
              key={lead.id}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors text-sm",
                selectedIds.has(lead.id) && "bg-primary/5"
              )}
            >
              <Checkbox
                checked={selectedIds.has(lead.id)}
                onCheckedChange={() => onToggle(lead.id)}
              />
              <span className="font-mono text-xs w-32 shrink-0">{lead.phone}</span>
              <span className="flex-1 text-muted-foreground truncate">{lead.name}</span>
              {lead.preferred_product && (
                <Badge variant="outline" className="text-xs shrink-0">{lead.preferred_product}</Badge>
              )}
              {lead.betting_patterns.deposit_usd > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  ${lead.betting_patterns.deposit_usd.toLocaleString()}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function ManagerImportLeads() {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [leads, setLeads] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assigningAgent, setAssigningAgent] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingLeads, setClearingLeads] = useState(false);
  const [clearingStatus, setClearingStatus] = useState<string | null>(null);
  const [showClearByCategory, setShowClearByCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    try {
      const data = await api.get<Agent[]>("/leads/agents-available");
      setAgents(data);
    } catch { /* silent */ }
  };

  const processFile = (file: File) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const isCsv = /\.csv$/i.test(file.name);
    if (!isExcel && !isCsv) { toast.error("Please upload a CSV or Excel (.xlsx/.xls) file"); return; }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let json: any[];
        if (isExcel) {
          const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: "array" });
          json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else {
          const text = ev.target?.result as string;
          const lines = text.split("\n").filter(l => l.trim());
          const headers = lines[0].split(",").map(h => h.trim());
          json = lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim());
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = vals[i]; });
            return obj;
          });
        }

        const parsed = parseRows(json, user?.country || 'UG');
        if (parsed.length === 0) { toast.error("No valid phone numbers found in the file"); return; }
        setLeads(parsed);
        setSelectedIds(new Set());
        setStep(2);
        toast.success(`Parsed ${parsed.length} leads from ${file.name}`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse file — check format");
      }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const runImport = async () => {
    if (leads.length === 0) return;
    setImporting(true);
    try {
      const BATCH = 100;
      for (let i = 0; i < leads.length; i += BATCH) {
        const batch = leads.slice(i, i + BATCH);
        await api.post("/leads/import-csv", { leads: batch, source_filename: fileName });
      }
      toast.success(`${leads.length} leads imported successfully`);
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = (ids: string[], check: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => check ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const assignLeads = async () => {
    if (!assigningAgent || selectedIds.size === 0) return;
    setAssigning(true);
    try {
      const resp = await api.post<{ updated: number }>("/leads/bulk-assign", {
        lead_ids: [...selectedIds],
        agent_id: assigningAgent,
      });
      const agentName = agents.find(a => a.id === assigningAgent)?.full_name ?? "agent";
      toast.success(`${resp.updated} leads assigned to ${agentName}`);
      // Refresh agent load counts
      loadAgents();
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err?.message ?? "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const reset = () => {
    setStep(1); setLeads([]); setFileName(null);
    setSelectedIds(new Set()); setAssigningAgent(null);
  };

  const clearAllLeads = async () => {
    setClearingLeads(true);
    try {
      const result = await api.delete<{ message: string; deleted: number }>("/leads/clear-all");
      toast.success(result.message || "All leads cleared from database");
      reset();
      setShowClearConfirm(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to clear leads");
    } finally {
      setClearingLeads(false);
    }
  };

  const clearByStatus = async (status: string, label: string) => {
    setClearingStatus(status);
    try {
      const result = await api.delete<{ message: string; deleted: number }>("/leads/clear-by-status", { status });
      toast.success(result.message || `"${label}" leads cleared`);
    } catch (err: any) {
      toast.error(err?.message ?? `Failed to clear "${label}" leads`);
    } finally {
      setClearingStatus(null);
    }
  };

  // Group leads by tier
  const byTier = Object.fromEntries(
    TIERS.map(t => [t.id, leads.filter(l => l.tier === t.id)])
  ) as Record<Tier, ParsedLead[]>;

  const totalSelected = selectedIds.size;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Import Leads</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a file, review leads by category, then assign to agents.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Start over
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowClearByCategory(v => !v); setShowClearConfirm(false); }}
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Clear Leads
            </Button>
          </div>
        </div>

        {/* ── Clear panel ─────────────────────────────────────────── */}
        {showClearByCategory && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="font-semibold text-destructive text-sm">Clear Leads</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowClearByCategory(false); setShowClearConfirm(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Per-category buttons */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Clear by call status:</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_CATEGORIES.map(cat => (
                  <Button
                    key={cat.id}
                    variant="outline"
                    size="sm"
                    disabled={clearingStatus === cat.id || !!clearingLeads}
                    onClick={() => clearByStatus(cat.id, cat.label)}
                    className={cn("text-xs", cat.color, cat.border, cat.bg, "hover:opacity-80")}
                  >
                    {clearingStatus === cat.id ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Clearing…</>
                    ) : (
                      <><Trash2 className="h-3 w-3 mr-1" />{cat.label}</>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Divider + clear all */}
            <div className="border-t border-destructive/20 pt-3">
              {!showClearConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={!!clearingStatus || clearingLeads}
                  className="border-destructive text-destructive hover:bg-destructive/10 w-full"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear ALL leads (all statuses)
                </Button>
              ) : (
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-xs text-destructive font-semibold">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)} disabled={clearingLeads}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={clearAllLeads} disabled={clearingLeads}>
                      {clearingLeads ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Clearing…</> : "Yes, delete all"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step pills */}
        <div className="flex items-center gap-4 flex-wrap">
          <StepPill n={1} label="Upload file" active={step === 1} done={step > 1} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <StepPill n={2} label="Review & import" active={step === 2} done={step > 2} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <StepPill n={3} label="Assign to agents" active={step === 3} done={false} />
        </div>

        {/* ── STEP 1: Upload ─────────────────────────────────────────── */}
        {step === 1 && (
          <div
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
              dragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onFileInput}
            />
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Drop your file here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports CSV and Excel (.xlsx / .xls)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Betting platform exports (Chinese headers) are auto-detected
                </p>
              </div>
              <Button size="sm" className="pointer-events-none">
                <Upload className="h-4 w-4 mr-2" /> Choose file
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Review categories & import ────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{leads.length} valid leads parsed</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {TIERS.filter(t => byTier[t.id].length > 0).map(t => (
                  <Badge key={t.id} variant="outline" className={cn("text-xs", t.color)}>
                    {byTier[t.id].length} {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Category panels (display only at this step — no selection yet) */}
            <div className="space-y-3">
              {TIERS.filter(t => byTier[t.id].length > 0).map(tier => (
                <TierPreview key={tier.id} tier={tier} leads={byTier[tier.id]} />
              ))}
            </div>

            {/* Import action */}
            <Button
              size="lg"
              className="w-full"
              onClick={runImport}
              disabled={importing}
            >
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Import {leads.length} Leads</>
              )}
            </Button>
          </div>
        )}

        {/* ── STEP 3: Assign to agents ─────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">{leads.length} leads imported successfully</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Select leads below and assign them to an agent.
                </p>
              </div>
            </div>

            {/* Assign bar — sticky */}
            <div className={cn(
              "sticky top-4 z-10 flex items-center gap-3 p-3 rounded-xl border shadow-md bg-background transition-all",
              totalSelected > 0 ? "border-primary/50 shadow-primary/10" : "border-border"
            )}>
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="flex-1 text-sm bg-transparent outline-none min-w-0"
                value={assigningAgent ?? ""}
                onChange={e => setAssigningAgent(e.target.value || null)}
              >
                <option value="">Select an agent…</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.assigned_leads} leads)
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={assignLeads}
                disabled={!assigningAgent || totalSelected === 0 || assigning}
                className="shrink-0"
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Assign {totalSelected > 0 ? totalSelected : ""} leads <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>

            {/* Leads by category with checkboxes */}
            <div className="space-y-3">
              {TIERS.filter(t => byTier[t.id].length > 0).map(tier => (
                <TierPanel
                  key={tier.id}
                  tier={tier}
                  leads={byTier[tier.id]}
                  selectedIds={selectedIds}
                  onToggle={toggleId}
                  onSelectAll={selectAll}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
