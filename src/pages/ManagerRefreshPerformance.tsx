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
  Download, Upload, FileText, TrendingUp, TrendingDown,
  CheckCircle2, DollarSign, Target, History, Info, ArrowRight,
  RefreshCcw, AlertCircle,
} from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type RefreshRow = {
  phone: string;
  deposit_usd: number;
  deposit_local: number;
  total_bets: number;
  last_login_date: string | null;
};

type RefreshResult = {
  matched: number;
  unmatched: number;
  upgraded: number;
  downgraded: number;
  unchanged: number;
  conversions_attributed: number;
  attributed_deposit_ugx: number;
  converted_ids: string[];
  upgraded_ids: string[];
  unmatched_phones: string[];
};

const PLATFORM_COLUMNS: Record<string, string> = {
  'username': 'phone',
  '最后登录时间': 'last_login_date',
  '总票数': 'total_bets',
  '充值金额(美金)': 'deposit_usd',
  '充值金额(本币)': 'deposit_local',
  '分类': 'category',
};

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function excelDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  if (typeof v === "number") return new Date(Math.floor(v - 25569) * 86400000).toISOString();
  return null;
}

export default function ManagerRefreshPerformance() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RefreshRow[]>([]);
  const [preview, setPreview] = useState<RefreshRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [redistributing, setRedistributing] = useState(false);

  useEffect(() => {
    loadHistory();
    loadAgents();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await api.get<any[]>("/leads/import-batches?limit=10");
      setHistory(data.filter((b) => b.batch_type === "performance_refresh"));
    } catch { /* ignore */ }
  };

  const loadAgents = async () => {
    try {
      const data = await api.get<any[]>("/leads/agents-available");
      setAgents(data);
    } catch { /* ignore */ }
  };

  const handleExportPhones = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const base = (import.meta as any).env?.VITE_API_URL || "/api";
      const res = await fetch(`${base}/leads/export-phones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `phones-for-enrichment-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Phone list downloaded — hand it to the tech team");
    } catch (err: any) {
      toast.error(err?.message || "Export failed");
    }
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
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
          json = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = vals[i]; });
            return obj;
          });
        }

        const normalized: RefreshRow[] = json
          .map((row) => {
            const mapped: any = {};
            for (const [k, v] of Object.entries(row)) {
              const out = PLATFORM_COLUMNS[k] || k.toLowerCase();
              mapped[out] = v;
            }
            const phone = String(mapped.phone || mapped.number || "").trim();
            if (!phone) return null;
            return {
              phone,
              deposit_usd: parseNum(mapped.deposit_usd),
              deposit_local: parseNum(mapped.deposit_local),
              total_bets: parseNum(mapped.total_bets),
              last_login_date: excelDate(mapped.last_login_date),
            } as RefreshRow;
          })
          .filter((x): x is RefreshRow => !!x);

        setRows(normalized);
        setPreview(normalized.slice(0, 5));
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse file");
      }
    };
    if (isExcel) reader.readAsArrayBuffer(f);
    else reader.readAsText(f);
  };

  const runRefresh = async () => {
    if (rows.length === 0) { toast.error("Nothing to import"); return; }
    setImporting(true);
    setResult(null);

    try {
      const BATCH = 200;
      const batches = Math.ceil(rows.length / BATCH);
      setProgress({ current: 0, total: batches });

      const acc: RefreshResult = {
        matched: 0, unmatched: 0, upgraded: 0, downgraded: 0, unchanged: 0,
        conversions_attributed: 0, attributed_deposit_ugx: 0,
        converted_ids: [], upgraded_ids: [], unmatched_phones: [],
      };

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const resp = await api.post<RefreshResult>("/leads/import-performance", {
          data: batch,
          source_filename: file?.name,
        });
        acc.matched += resp.matched;
        acc.unmatched += resp.unmatched;
        acc.upgraded += resp.upgraded;
        acc.downgraded += resp.downgraded;
        acc.unchanged += resp.unchanged;
        acc.conversions_attributed += resp.conversions_attributed;
        acc.attributed_deposit_ugx += Number(resp.attributed_deposit_ugx || 0);
        acc.converted_ids.push(...resp.converted_ids);
        acc.upgraded_ids.push(...resp.upgraded_ids);
        acc.unmatched_phones.push(...resp.unmatched_phones.slice(0, 20));
        setProgress({ current: Math.floor(i / BATCH) + 1, total: batches });
      }

      setResult(acc);
      toast.success(`Refreshed ${acc.matched} leads`);
      loadHistory();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Refresh failed");
    } finally {
      setImporting(false);
    }
  };

  const redistributeUpgraded = async () => {
    if (!result || result.upgraded_ids.length === 0) return;
    if (selectedAgents.length === 0) { toast.error("Select agents to receive the upgraded leads"); return; }

    setRedistributing(true);
    try {
      const resp = await api.post<{ total_distributed: number }>("/leads/distribute", {
        agent_ids: selectedAgents,
        lead_ids: result.upgraded_ids,
      });
      toast.success(`Redistributed ${resp.total_distributed} upgraded leads`);
    } catch (err: any) {
      toast.error(err?.message || "Redistribution failed");
    } finally {
      setRedistributing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Refresh Lead Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Re-import platform data for existing leads. The system cross-checks fresh deposits against call dates and auto-attributes conversions to agents.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Export Phone List</CardTitle>
            <CardDescription>
              Download the phone numbers currently in the system. Hand this file to the tech team so they can pull fresh platform data for each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportPhones} variant="outline">
              <Download className="h-4 w-4 mr-2" /> Download phones-for-enrichment.csv
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Upload Enriched File</CardTitle>
            <CardDescription>
              Accepts the same format as a betting-platform export (Chinese headers) or a simple CSV with <code>phone</code>, <code>deposit_usd</code>, <code>deposit_local</code>, <code>total_bets</code>, <code>last_login_date</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="perf-file">CSV or Excel</Label>
              <Input id="perf-file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} disabled={importing} />
            </div>

            {file && rows.length > 0 && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span><strong>{file.name}</strong> — {rows.length} rows</span>
                  <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                </AlertDescription>
              </Alert>
            )}

            {preview.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Preview
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Deposit USD</th>
                        <th className="text-left p-2">Deposit Local</th>
                        <th className="text-left p-2">Bets</th>
                        <th className="text-left p-2">Last Login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono">{r.phone}</td>
                          <td className="p-2">${r.deposit_usd.toLocaleString()}</td>
                          <td className="p-2">{r.deposit_local.toLocaleString()}</td>
                          <td className="p-2">{r.total_bets.toLocaleString()}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {r.last_login_date ? new Date(r.last_login_date).toLocaleDateString() : "—"}
                          </td>
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
            <CardTitle className="text-base">Step 3 — Run Refresh</CardTitle>
            <CardDescription>
              Fresh deposits are attributed to agent calls only when the platform shows activity after the last call date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runRefresh} disabled={!file || rows.length === 0 || importing} size="lg" className="w-full">
              {importing
                ? `Refreshing ${progress.current}/${progress.total} batches…`
                : <><RefreshCcw className="h-4 w-4 mr-2" /> Refresh {rows.length} leads</>}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" /> Refresh Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Attribution headline */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 dark:from-green-950/30 dark:to-emerald-950/30">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-semibold">Call-attributed revenue this cycle</span>
                </div>
                <div className="text-3xl font-bold mt-1 text-green-800 dark:text-green-300">
                  UGX {Math.round(result.attributed_deposit_ugx).toLocaleString()}
                </div>
                <div className="text-xs text-green-700/70 mt-1">
                  From {result.conversions_attributed} lead(s) who deposited AFTER an agent called them.
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Matched" value={result.matched} accent="text-blue-600" icon={<Target className="h-4 w-4" />} />
                <Stat label="Upgraded" value={result.upgraded} accent="text-green-600" icon={<TrendingUp className="h-4 w-4" />} />
                <Stat label="Downgraded" value={result.downgraded} accent="text-red-600" icon={<TrendingDown className="h-4 w-4" />} />
                <Stat label="Unmatched" value={result.unmatched} accent="text-muted-foreground" icon={<AlertCircle className="h-4 w-4" />} />
              </div>

              <Separator />

              {result.upgraded_ids.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" /> Step 4 — Redistribute Upgraded Leads
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.upgraded_ids.length} leads jumped in score. Pick agents to take them over (fair split by score):
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
                        {a.full_name} ({a.assigned_leads || 0})
                      </label>
                    ))}
                  </div>
                  <Button onClick={redistributeUpgraded} disabled={selectedAgents.length === 0 || redistributing} size="sm">
                    {redistributing ? "Redistributing…" : <>Redistribute upgraded leads <ArrowRight className="h-4 w-4 ml-1" /></>}
                  </Button>
                </div>
              )}

              {result.unmatched > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {result.unmatched} phone(s) in the file had no matching lead in the system — they were never imported as leads. Use the "Import New Leads" page for those.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Recent Refreshes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-3 border rounded-md text-sm">
                    <div>
                      <div className="font-medium">{b.source_filename || "Untitled refresh"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()} · {b.user_name}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">{b.updated_count} matched</Badge>
                      {b.converted_count > 0 && <Badge variant="default" className="bg-green-600">{b.converted_count} converted</Badge>}
                      {Number(b.attributed_deposit_ugx) > 0 && (
                        <Badge variant="outline" className="text-green-700">
                          UGX {Math.round(Number(b.attributed_deposit_ugx)).toLocaleString()}
                        </Badge>
                      )}
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
