import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Users, RefreshCcw,
  UserPlus, History, ArrowRight, Info,
} from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectCountryFromPhone, formatPhoneForCountry } from "@/config/countries";
import * as XLSX from "xlsx";

// Column names from the betting-platform export (Chinese headers).
const PLATFORM_COLUMNS: Record<string, string> = {
  'username': 'phone',
  '最后登录时间': 'last_login',
  '分类': 'category',
  '总票数': 'total_bets',
  '体育票数': 'sports_bets',
  '游戏票数': 'game_bets',
  '充值金额(美金)': 'deposit_usd',
  '充值金额(本币)': 'deposit_local',
  '投注总金额': 'total_bet_amount',
  '总ggr': 'total_ggr',
};

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function excelDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v === "number") return new Date(Math.floor(v - 25569) * 86400000);
  return null;
}

function classify(deposit_usd: number, deposit_local: number, total_bets: number, last_login: Date | null) {
  if (deposit_usd >= 1000 || deposit_local >= 3_500_000)
    return { segment: "vip", priority: "high", trait: "High Staker", score: Math.min(95, 70 + Math.floor(deposit_usd / 500)) };
  if (deposit_usd >= 200 || deposit_local >= 700_000)
    return { segment: "semi-active", priority: "medium", trait: "Medium Staker", score: Math.min(70, 40 + Math.floor(deposit_usd / 100)) };
  if (total_bets >= 500)
    return { segment: "semi-active", priority: "medium", trait: "Frequent Bettor", score: 45 };
  if (last_login) {
    const days = Math.floor((Date.now() - last_login.getTime()) / 86400000);
    if (days > 60) return { segment: "dormant", priority: "low", trait: "Dormant", score: 15 };
  }
  return {
    segment: deposit_usd > 50 ? "semi-active" : "dormant",
    priority: deposit_usd > 50 ? "medium" : "low",
    trait: deposit_usd > 0 ? "Low Staker" : null,
    score: deposit_usd > 50 ? 35 : 20,
  };
}

type BuiltLead = {
  phone: string;
  name: string;
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
  betting_patterns: any;
};

type ImportResult = {
  total: number;
  inserted: number;
  enriched: number;
  recycled: number;
  skipped: number;
  upgraded: number;
  downgraded: number;
  distributed: number;
  skipped_detail?: { phone: string; reason: string }[];
};

export default function ManagerImportLeads() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BuiltLead[]>([]);
  const [preview, setPreview] = useState<BuiltLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [distributing, setDistributing] = useState(false);

  useEffect(() => {
    loadHistory();
    loadAgents();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.get<any[]>("/leads/import-batches?limit=10");
      setHistory(data.filter((b) => b.batch_type === "new_leads"));
    } catch { /* ignore */ }
  };

  const loadAgents = async () => {
    try {
      const data = await api.get<any[]>("/leads/agents-available");
      setAgents(data);
    } catch { /* ignore */ }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isExcel = f.name.match(/\.(xlsx|xls)$/i);
    const isCsv = f.name.match(/\.csv$/i);
    if (!isExcel && !isCsv) { toast.error("Upload a CSV or Excel file"); return; }
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let json: any[];
        if (isExcel) {
          const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: "array" });
          json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        } else {
          const text = ev.target?.result as string;
          const lines = text.split("\n").filter((l) => l.trim());
          const headers = lines[0].split(",").map((h) => h.trim());
          json = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim());
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = vals[i]; });
            return obj;
          });
        }

        const normalized = json.map((row) => {
          const mapped: any = {};
          for (const [k, v] of Object.entries(row)) {
            const out = PLATFORM_COLUMNS[k] || k.toLowerCase();
            mapped[out] = v;
          }
          return mapped;
        });

        const built: BuiltLead[] = normalized
          .map((r) => {
            const rawPhone = String(r.phone || r.number || r.phoneNumber || r.username || "").trim();
            if (!rawPhone) return null;
            const country = detectCountryFromPhone(rawPhone);
            const phone = formatPhoneForCountry(rawPhone, country);
            if (phone.replace(/\D/g, "").length < 10) return null;

            const deposit_usd = parseNum(r.deposit_usd);
            const deposit_local = parseNum(r.deposit_local);
            const total_bets = parseNum(r.total_bets);
            const last_login = excelDate(r.last_login);
            const { segment, priority, trait, score } = classify(deposit_usd, deposit_local, total_bets, last_login);

            const cat = String(r.category || "");
            const preferred_product =
              cat.includes("体育") ? "Sports" :
              cat.includes("游戏") ? "Gaming" :
              cat.includes("彩票") ? "Lottery" :
              parseNum(r.sports_bets) > parseNum(r.game_bets) ? "Sports" :
              parseNum(r.game_bets) > 0 ? "Gaming" : null;

            return {
              phone,
              name: r.name || `User ${rawPhone.replace(/\D/g, "").slice(-4)}`,
              segment, priority, score, lead_score: score, trait,
              preferred_product,
              last_deposit_ugx: deposit_local || Math.round(deposit_usd * 3700),
              lifetime_value: deposit_local || Math.round(deposit_usd * 3700),
              deposit_count: total_bets,
              last_bet_date: last_login ? last_login.toISOString().split("T")[0] : null,
              betting_patterns: {
                deposit_usd, deposit_local, total_bets,
                sports_bets: parseNum(r.sports_bets),
                game_bets: parseNum(r.game_bets),
                total_ggr: parseNum(r.total_ggr),
                total_bet_amount: parseNum(r.total_bet_amount),
                last_login: last_login?.toISOString() || null,
                platform_category: cat,
              },
            } as BuiltLead;
          })
          .filter((x): x is BuiltLead => !!x);

        setRows(built);
        setPreview(built.slice(0, 5));
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse file");
      }
    };
    if (isExcel) reader.readAsArrayBuffer(f);
    else reader.readAsText(f);
  };

  const runImport = async () => {
    if (rows.length === 0) { toast.error("No rows to import"); return; }
    setImporting(true);
    setResult(null);

    try {
      const BATCH = 100;
      const batches = Math.ceil(rows.length / BATCH);
      setProgress({ current: 0, total: batches });

      const acc: ImportResult = {
        total: 0, inserted: 0, enriched: 0, recycled: 0, skipped: 0,
        upgraded: 0, downgraded: 0, distributed: 0, skipped_detail: [],
      };

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const resp = await api.post<ImportResult>("/leads/import-csv", {
          leads: batch,
          source_filename: file?.name,
        });
        acc.total += resp.total;
        acc.inserted += resp.inserted;
        acc.enriched += resp.enriched;
        acc.recycled += resp.recycled;
        acc.skipped += resp.skipped;
        acc.upgraded += resp.upgraded;
        acc.downgraded += resp.downgraded;
        acc.distributed += resp.distributed;
        if (resp.skipped_detail) acc.skipped_detail!.push(...resp.skipped_detail);
        setProgress({ current: Math.floor(i / BATCH) + 1, total: batches });
      }

      setResult(acc);
      toast.success(`Processed ${acc.total} rows`);
      loadHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const distributeNow = async () => {
    if (selectedAgents.length === 0) { toast.error("Select at least one agent"); return; }
    setDistributing(true);
    try {
      const resp = await api.post<{ total_distributed: number }>("/leads/distribute", {
        agent_ids: selectedAgents,
      });
      toast.success(`Distributed ${resp.total_distributed} leads`);
      setResult((r) => r ? { ...r, distributed: r.distributed + resp.total_distributed } : r);
    } catch (err: any) {
      toast.error(err?.message || "Distribution failed");
    } finally {
      setDistributing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import New Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a betting-platform export. Duplicates are merged intelligently — never blindly skipped.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload File</CardTitle>
            <CardDescription>
              Supports the betting-platform Chinese-header export, or a generic CSV with a <code>phone</code> column.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">CSV or Excel</Label>
              <Input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} disabled={importing} />
            </div>

            {file && rows.length > 0 && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span><strong>{file.name}</strong> — {rows.length} valid rows parsed</span>
                  <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                </AlertDescription>
              </Alert>
            )}

            {preview.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Preview (first 5 rows)
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Deposit USD</th>
                        <th className="text-left p-2">Bets</th>
                        <th className="text-left p-2">Tier</th>
                        <th className="text-left p-2">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono">{r.phone}</td>
                          <td className="p-2">${r.betting_patterns?.deposit_usd?.toLocaleString() || 0}</td>
                          <td className="p-2">{r.betting_patterns?.total_bets?.toLocaleString() || 0}</td>
                          <td className="p-2">
                            {r.trait && <Badge variant="outline">{r.trait}</Badge>}
                          </td>
                          <td className="p-2 text-muted-foreground">{r.preferred_product || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Run Import</CardTitle>
            <CardDescription>
              Each phone is checked against existing leads. Active pipeline leads are only enriched (their disposition is preserved); dead leads past 30 days are recycled; new numbers are inserted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runImport} disabled={!file || rows.length === 0 || importing} size="lg" className="w-full">
              {importing
                ? `Importing ${progress.current}/${progress.total} batches…`
                : <><Upload className="h-4 w-4 mr-2" /> Import {rows.length} rows</>}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" /> Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="New leads" value={result.inserted} icon={<UserPlus className="h-4 w-4" />} accent="text-blue-600" />
                <Stat label="Enriched existing" value={result.enriched} icon={<RefreshCcw className="h-4 w-4" />} accent="text-amber-600" />
                <Stat label="Recycled (dead)" value={result.recycled} icon={<History className="h-4 w-4" />} accent="text-purple-600" />
                <Stat label="Skipped" value={result.skipped} icon={<AlertCircle className="h-4 w-4" />} accent="text-muted-foreground" />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-md dark:bg-green-950/30">
                  <span className="text-green-700 dark:text-green-400">Score upgraded</span>
                  <span className="font-semibold text-green-700 dark:text-green-400">{result.upgraded}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-md dark:bg-red-950/30">
                  <span className="text-red-700 dark:text-red-400">Score downgraded</span>
                  <span className="font-semibold text-red-700 dark:text-red-400">{result.downgraded}</span>
                </div>
              </div>

              {result.skipped_detail && result.skipped_detail.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {result.skipped_detail.length} number(s) were skipped because they were marked dead within the last 30 days.
                  </AlertDescription>
                </Alert>
              )}

              {(result.inserted + result.recycled) > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <div className="font-medium text-sm">3. Distribute to Agents</div>
                    <div className="text-xs text-muted-foreground">
                      {result.inserted + result.recycled} fresh leads are currently unassigned. Pick agents to split between:
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((a) => (
                      <label key={a.id} className={`px-3 py-1.5 rounded-md border text-xs cursor-pointer flex items-center gap-2 ${selectedAgents.includes(a.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedAgents.includes(a.id)}
                          onChange={(e) => setSelectedAgents(e.target.checked
                            ? [...selectedAgents, a.id]
                            : selectedAgents.filter((x) => x !== a.id))}
                        />
                        <Users className="h-3 w-3" /> {a.full_name} ({a.assigned_leads || 0})
                      </label>
                    ))}
                  </div>
                  <Button onClick={distributeNow} disabled={selectedAgents.length === 0 || distributing} variant="default" size="sm">
                    {distributing ? "Distributing…" : <>Distribute fairly <ArrowRight className="h-4 w-4 ml-1" /></>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Recent Imports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 border rounded-md text-sm">
                    <div>
                      <div className="font-medium">{b.source_filename || "Untitled import"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()} · {b.user_name}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">+{b.new_count} new</Badge>
                      <Badge variant="outline">{b.updated_count} enriched</Badge>
                      {b.recycled_count > 0 && <Badge variant="outline">{b.recycled_count} recycled</Badge>}
                      {b.skipped_count > 0 && <Badge variant="secondary">{b.skipped_count} skipped</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="p-3 border rounded-md">
      <div className={`flex items-center gap-2 ${accent}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
