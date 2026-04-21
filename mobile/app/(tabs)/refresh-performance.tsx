import React, { useState, useEffect, Component } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
// expo-sharing loaded dynamically to avoid module-level crash if native module missing
import { useAgentsAvailable } from "../../src/hooks/useDistribution";
import { api, API_BASE, getToken } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";

// Catches render errors and shows them instead of a blank screen
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.bg.dashboard }}>
          <Feather name="alert-triangle" size={32} color={colors.status.error} />
          <Text style={{ marginTop: 12, fontSize: 15, fontWeight: "700", color: colors.text.primary, textAlign: "center" }}>
            Something went wrong
          </Text>
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.text.muted, textAlign: "center" }}>
            {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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
function excelDateIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
  if (typeof v === "number") return new Date(Math.floor(v - 25569) * 86400000).toISOString();
  return null;
}

type RefreshRow = {
  phone: string; deposit_usd: number; deposit_local: number; total_bets: number; last_login_date: string | null;
};
type RefreshResult = {
  matched: number; unmatched: number;
  upgraded: number; downgraded: number; unchanged: number;
  conversions_attributed: number; attributed_deposit_ugx: number;
  converted_ids: string[]; upgraded_ids: string[]; unmatched_phones: string[];
};

function RefreshPerformanceScreen() {
  const { data: agents, refetch: refetchAgents } = useAgentsAvailable();
  const queryClient = useQueryClient();

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<RefreshRow[]>([]);
  const [preview, setPreview] = useState<RefreshRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [redistributing, setRedistributing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const data = await api.get<any[]>("/leads/import-batches?limit=5");
      setHistory(data.filter((b) => b.batch_type === "performance_refresh"));
    } catch { /* ignore */ }
  };

  const exportPhones = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/leads/export-phones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const csv = await res.text();

      const dest = `${FileSystem.cacheDirectory}phones-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(dest, csv);

      try {
        const Sharing = await import("expo-sharing");
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(dest, { mimeType: "text/csv", dialogTitle: "Send phone list to tech team" });
        } else {
          Alert.alert("Saved", `File saved to:\n${dest}`);
        }
      } catch {
        Alert.alert("Saved", `File saved to:\n${dest}`);
      }
    } catch (err: any) {
      Alert.alert("Export failed", err?.message || "Could not export phones");
    } finally {
      setExporting(false);
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["*/*"], copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets[0];
      if (!file.uri) return;

      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const isCsv = /\.csv$/i.test(file.name);
      if (!isExcel && !isCsv) {
        Alert.alert("Wrong file type", "Upload a .csv, .xlsx or .xls file");
        return;
      }

      let json: any[];
      if (isExcel) {
        const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        const wb = XLSX.read(b64, { type: "base64" });
        json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else {
        const text = await FileSystem.readAsStringAsync(file.uri);
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        json = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = vals[i]; });
          return obj;
        });
      }

      const parsed: RefreshRow[] = json
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
            last_login_date: excelDateIso(mapped.last_login_date),
          } as RefreshRow;
        })
        .filter((x): x is RefreshRow => !!x);

      setFileName(file.name);
      setRows(parsed);
      setPreview(parsed.slice(0, 3));
      setResult(null);

      Alert.alert("File loaded", `${parsed.length} rows parsed from ${file.name}`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to parse file");
    }
  };

  const runRefresh = async () => {
    if (rows.length === 0) return;
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
          data: batch, source_filename: fileName,
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
        setProgress({ current: Math.floor(i / BATCH) + 1, total: batches });
      }

      setResult(acc);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      loadHistory();
    } catch (err: any) {
      Alert.alert("Refresh failed", err?.message || "Unknown error");
    } finally {
      setImporting(false);
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const redistribute = async () => {
    if (!result || result.upgraded_ids.length === 0) return;
    if (selectedAgents.length === 0) {
      Alert.alert("Pick agents", "Select agents to receive the upgraded leads.");
      return;
    }
    setRedistributing(true);
    try {
      const resp = await api.post<{ total_distributed: number }>("/leads/distribute", {
        agent_ids: selectedAgents, lead_ids: result.upgraded_ids,
      });
      Alert.alert("Redistributed", `${resp.total_distributed} upgraded leads reassigned.`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      refetchAgents();
    } catch (err: any) {
      Alert.alert("Redistribution failed", err?.message || "Unknown error");
    } finally {
      setRedistributing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadHistory} tintColor={colors.brand.green} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Refresh Performance</Text>
        <Text style={styles.introSub}>
          Fresh deposits are auto-attributed to agent calls only when platform activity happened after the call.
        </Text>
      </View>

      {/* Step 1: export phones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Export Phone List</Text>
        <TouchableOpacity
          style={[styles.outlineBtn, exporting && { opacity: 0.6 }]}
          onPress={exportPhones} disabled={exporting} activeOpacity={0.7}
        >
          {exporting ? <ActivityIndicator color={colors.brand.green} /> : (
            <>
              <Feather name="download" size={16} color={colors.brand.green} />
              <Text style={styles.outlineBtnText}>Download & share phones.csv</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.helperText}>
          Hand the file to the tech team. They fill in fresh platform data and send it back.
        </Text>
      </View>

      {/* Step 2: upload enriched */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Upload Enriched File</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickFile} activeOpacity={0.7} disabled={importing}>
          <Feather name="upload" size={22} color={colors.brand.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadBtnTitle}>{fileName || "Tap to pick enriched CSV/Excel"}</Text>
            <Text style={styles.uploadBtnSub}>{rows.length > 0 ? `${rows.length} rows parsed` : "From the tech team"}</Text>
          </View>
        </TouchableOpacity>

        {preview.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewHeader}>Preview</Text>
            {preview.map((r, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewPhone}>{r.phone}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.previewTrait}>${r.deposit_usd.toLocaleString()}</Text>
                  <Text style={styles.previewMeta}>{r.total_bets.toLocaleString()} bets</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Step 3: run */}
      {rows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Run Refresh</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, importing && { opacity: 0.5 }]}
            onPress={runRefresh} disabled={importing} activeOpacity={0.8}
          >
            {importing ? (
              <>
                <ActivityIndicator color={colors.brand.yellow} />
                <Text style={styles.primaryBtnText}>Refreshing {progress.current}/{progress.total}…</Text>
              </>
            ) : (
              <>
                <Feather name="refresh-ccw" size={16} color={colors.brand.yellow} />
                <Text style={styles.primaryBtnText}>Refresh {rows.length} leads</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Step 4: results */}
      {result && (
        <View style={styles.section}>
          <View style={styles.resultHeader}>
            <Feather name="check-circle" size={16} color={colors.status.success} />
            <Text style={styles.resultHeaderText}>Refresh complete</Text>
          </View>

          {/* Attribution headline */}
          <View style={styles.attributionCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="dollar-sign" size={16} color="#047857" />
              <Text style={styles.attributionLabel}>Call-attributed revenue</Text>
            </View>
            <Text style={styles.attributionValue}>
              UGX {Math.round(result.attributed_deposit_ugx).toLocaleString()}
            </Text>
            <Text style={styles.attributionSub}>
              {result.conversions_attributed} lead{result.conversions_attributed !== 1 ? "s" : ""} deposited after agent calls
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatTile label="Matched" value={result.matched} color="#2563eb" icon="target" />
            <StatTile label="Upgraded" value={result.upgraded} color="#059669" icon="trending-up" />
            <StatTile label="Downgraded" value={result.downgraded} color="#dc2626" icon="trending-down" />
            <StatTile label="Unmatched" value={result.unmatched} color={colors.text.muted} icon="alert-circle" />
          </View>

          {result.upgraded_ids.length > 0 && (
            <View style={styles.distributeSection}>
              <Text style={styles.sectionTitle}>
                4. Redistribute {result.upgraded_ids.length} upgraded leads
              </Text>
              <View style={styles.agentList}>
                {(agents || []).map((a) => {
                  const selected = selectedAgents.includes(a.id);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.agentChip, selected && styles.agentChipSelected]}
                      onPress={() => toggleAgent(a.id)} activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Feather name="check" size={10} color="#fff" />}
                      </View>
                      <Text style={styles.agentChipText}>
                        {(a.full_name || a.email) as string} ({a.assigned_leads || 0})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.distributeBtn, (redistributing || selectedAgents.length === 0) && { opacity: 0.5 }]}
                onPress={redistribute} disabled={redistributing || selectedAgents.length === 0} activeOpacity={0.8}
              >
                {redistributing ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="shuffle" size={14} color="#fff" />
                    <Text style={styles.distributeBtnText}>Redistribute upgraded leads</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {result.unmatched > 0 && (
            <View style={styles.warnBox}>
              <Feather name="info" size={14} color={colors.text.secondary} />
              <Text style={styles.warnText}>
                {result.unmatched} phone(s) had no matching lead. Import them on the Import Leads screen first.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent refreshes</Text>
          {history.map((b) => (
            <View key={b.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {b.source_filename || "Untitled refresh"}
                </Text>
                <Text style={styles.historyMeta}>{new Date(b.created_at).toLocaleString()}</Text>
              </View>
              <View style={styles.historyStats}>
                <Text style={styles.historyStatText}>{b.updated_count} matched</Text>
                {Number(b.attributed_deposit_ugx) > 0 && (
                  <>
                    <Text style={styles.historySep}>·</Text>
                    <Text style={[styles.historyStatText, { color: "#047857" }]}>
                      UGX {Math.round(Number(b.attributed_deposit_ugx)).toLocaleString()}
                    </Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatTile({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <View style={styles.statTile}>
      <Feather name={icon} size={14} color={color} />
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  intro: { padding: 16, paddingBottom: 0 },
  introTitle: { fontSize: 20, fontWeight: "800", color: colors.text.primary },
  introSub: { fontSize: 12, color: colors.text.secondary, marginTop: 4, lineHeight: 17 },

  section: { marginHorizontal: 16, marginTop: 18 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.bg.card, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: colors.brand.green },
  outlineBtnText: { fontSize: 13, fontWeight: "700", color: colors.brand.green },
  helperText: { fontSize: 11, color: colors.text.muted, marginTop: 8, lineHeight: 15 },

  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.bg.card, padding: 18, borderRadius: 10, borderWidth: 1.5, borderColor: colors.brand.green, borderStyle: "dashed" },
  uploadBtnTitle: { fontSize: 14, fontWeight: "700", color: colors.text.primary },
  uploadBtnSub: { fontSize: 11, color: colors.text.muted, marginTop: 2 },

  previewCard: { backgroundColor: colors.bg.card, borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.border.default },
  previewHeader: { fontSize: 10, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  previewRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border.default },
  previewPhone: { fontSize: 12, fontFamily: "monospace", color: colors.text.primary },
  previewTrait: { fontSize: 12, fontWeight: "600", color: colors.text.primary },
  previewMeta: { fontSize: 11, color: colors.text.muted, marginTop: 1 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand.dark, paddingVertical: 15, borderRadius: 10 },
  primaryBtnText: { color: colors.brand.yellow, fontSize: 14, fontWeight: "700" },

  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  resultHeaderText: { fontSize: 14, fontWeight: "700", color: colors.status.success },

  attributionCard: { backgroundColor: "#ecfdf5", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#a7f3d0" },
  attributionLabel: { fontSize: 12, fontWeight: "700", color: "#047857" },
  attributionValue: { fontSize: 26, fontWeight: "800", color: "#065f46", marginTop: 4 },
  attributionSub: { fontSize: 11, color: "#047857", marginTop: 2 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: { flex: 1, minWidth: "22%", backgroundColor: colors.bg.card, padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  statTileValue: { fontSize: 18, fontWeight: "800", color: colors.text.primary, marginTop: 4 },
  statTileLabel: { fontSize: 10, color: colors.text.muted, fontWeight: "600", marginTop: 1 },

  distributeSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border.default },
  agentList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  agentChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  agentChipSelected: { backgroundColor: "#f0fdf4", borderColor: colors.brand.green },
  agentChipText: { fontSize: 12, fontWeight: "600", color: colors.text.primary },
  checkbox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border.default, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },

  distributeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand.green, paddingVertical: 13, borderRadius: 10 },
  distributeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  warnBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff7ed", padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: "#fed7aa" },
  warnText: { flex: 1, fontSize: 11, color: colors.text.secondary, lineHeight: 15 },

  historyRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border.default },
  historyTitle: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  historyMeta: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  historyStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  historyStatText: { fontSize: 11, fontWeight: "600", color: colors.text.secondary },
  historySep: { fontSize: 11, color: colors.border.default },
});

export default function RefreshPerformanceScreenWrapper() {
  return (
    <ErrorBoundary>
      <RefreshPerformanceScreen />
    </ErrorBoundary>
  );
}
