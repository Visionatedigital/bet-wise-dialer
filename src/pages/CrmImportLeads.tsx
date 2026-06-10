import { useState, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileSpreadsheet, CheckCircle2, ChevronRight,
  Crown, TrendingUp, Zap, Moon, Loader2, X,
  HeartHandshake
} from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectCountryFromPhone, formatPhoneForCountry } from "@/config/countries";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Column mapping ────────────────────────────────────────────────────────────
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

const TIERS: {
  id: Tier;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}[] = [
  { id: "high_staker", label: "High Stakers", description: "VIP Clients", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: Crown },
  { id: "medium_staker", label: "Medium Stakers", description: "Potential VIP", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: TrendingUp },
  { id: "frequent_bettor", label: "Frequent Bettors", description: "Highly Active", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", icon: Zap },
  { id: "low_staker", label: "Low Stakers", description: "Active", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: TrendingUp },
  { id: "dormant", label: "Dormant", description: "Need Re-engagement", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200", icon: Moon },
];

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

function classifyTier(deposit_usd: number, deposit_local: number, total_bets: number, last_login: Date | null) {
  if (deposit_usd >= 1000 || deposit_local >= 3_500_000) return { tier: "high_staker" as Tier, segment: "vip", score: 90 };
  if (deposit_usd >= 200 || deposit_local >= 700_000) return { tier: "medium_staker" as Tier, segment: "semi-active", score: 65 };
  if (total_bets >= 500) return { tier: "frequent_bettor" as Tier, segment: "semi-active", score: 50 };
  if (deposit_usd > 50) return { tier: "low_staker" as Tier, segment: "semi-active", score: 35 };
  if (last_login) {
    const days = Math.floor((Date.now() - last_login.getTime()) / 86400000);
    if (days > 60) return { tier: "dormant" as Tier, segment: "dormant", score: 15 };
  }
  return { tier: "dormant" as Tier, segment: "dormant", score: 20 };
}

function parseRows(json: any[], defaultCountry = 'UG'): any[] {
  const seen = new Set<string>();
  return json
    .map((raw, i) => {
      const r: any = {};
      for (const [k, v] of Object.entries(raw)) r[COL_MAP[k] ?? k.toLowerCase()] = v;
      
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
      const { tier, segment, score } = classifyTier(deposit_usd, deposit_local, total_bets, last_login);

      const cat = String(r.category ?? "");
      const preferred_product = cat.includes("体育") ? "Sports" : cat.includes("游戏") ? "Gaming" : "Sports";

      return {
        id: "lead-" + i + "-" + digits,
        phone,
        name: r.name ?? ("Client " + digits.slice(-4)),
        tier, segment, score, lead_score: score,
        preferred_product,
        last_deposit_ugx: deposit_local || Math.round(deposit_usd * 3700),
        lifetime_value: deposit_local || Math.round(deposit_usd * 3700),
        deposit_count: total_bets,
        last_bet_date: last_login ? last_login.toISOString().split("T")[0] : null,
        betting_patterns: { deposit_usd, deposit_local, total_bets, last_login: last_login?.toISOString() },
      };
    })
    .filter((x): x is any => !!x);
}

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

export default function CrmImportLeads() {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const parsed = parseRows(json, user?.country || 'UG');
        if (parsed.length === 0) { toast.error("No valid phone numbers found"); return; }
        setLeads(parsed);
        setStep(2);
        toast.success("Parsed " + parsed.length + " clients from " + file.name);
      } catch (err) {
        toast.error("Failed to parse file");
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

  const runImport = async () => {
    if (leads.length === 0 || !user) return;
    setImporting(true);
    try {
      const BATCH = 100;
      for (let i = 0; i < leads.length; i += BATCH) {
        const batch = leads.slice(i, i + BATCH).map(l => ({ ...l, user_id: user.id })); // Auto assign to self
        await api.post("/leads/import-csv", { leads: batch, source_filename: fileName });
      }
      toast.success(leads.length + " clients imported to your profile!");
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1); setLeads([]); setFileName(null);
  };

  const byTier = Object.fromEntries(
    TIERS.map(t => [t.id, leads.filter(l => l.tier === t.id)])
  ) as Record<Tier, any[]>;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Import CRM Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your client list to start building relationships.
            </p>
          </div>
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-4 w-4 mr-1" /> Start over
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <StepPill n={1} label="Upload file" active={step === 1} done={step > 1} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <StepPill n={2} label="Review & import" active={step === 2} done={step > 2} />
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <StepPill n={3} label="Done" active={step === 3} done={step === 3} />
        </div>

        {step === 1 && (
          <div
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer",
              dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }} />
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <HeartHandshake className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Drop your client file here</p>
                <p className="text-sm text-muted-foreground mt-1">Supports CSV and Excel (.xlsx / .xls)</p>
              </div>
              <Button size="sm" className="pointer-events-none">
                <Upload className="h-4 w-4 mr-2" /> Choose file
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{leads.length} valid clients parsed</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {TIERS.filter(t => byTier[t.id].length > 0).map(tier => {
                const Icon = tier.icon;
                return (
                  <div key={tier.id} className={cn("rounded-xl border overflow-hidden", tier.border)}>
                    <div className={cn("w-full flex items-center justify-between px-4 py-3 text-left", tier.bg)}>
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-4 w-4", tier.color)} />
                        <span className={cn("font-semibold", tier.color)}>{tier.label}</span>
                        <Badge variant="secondary" className="text-xs">{byTier[tier.id].length} clients</Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <Button size="lg" className="w-full" onClick={runImport} disabled={importing}>
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Import {leads.length} Clients to My Profile</>}
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center py-10">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700">Success!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your clients have been imported and added to your CRM dashboard. You can now start managing relationships.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = "/crm/dashboard"}>
              Go to CRM Dashboard
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
