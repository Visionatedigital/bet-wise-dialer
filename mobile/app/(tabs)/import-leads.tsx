import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { useAgentsAvailable } from "../../src/hooks/useDistribution";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/theme/colors";
import { formatPhoneForCountry } from "../../src/config/countries";

// Chinese header mappings from the betting-platform export.
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
function classify(depUSD: number, depLocal: number, totalBets: number, lastLogin: Date | null) {
  if (depUSD >= 1000 || depLocal >= 3_500_000)
    return { segment: "vip", priority: "high", trait: "High Staker", score: Math.min(95, 70 + Math.floor(depUSD / 500)) };
  if (depUSD >= 200 || depLocal >= 700_000)
    return { segment: "semi-active", priority: "medium", trait: "Medium Staker", score: Math.min(70, 40 + Math.floor(depUSD / 100)) };
  if (totalBets >= 500) return { segment: "semi-active", priority: "medium", trait: "Frequent Bettor", score: 45 };
  if (lastLogin) {
    const days = Math.floor((Date.now() - lastLogin.getTime()) / 86400000);
    if (days > 60) return { segment: "dormant", priority: "low", trait: "Dormant", score: 15 };
  }
  return {
    segment: depUSD > 50 ? "semi-active" : "dormant",
    priority: depUSD > 50 ? "medium" : "low",
    trait: depUSD > 0 ? "Low Staker" : null,
    score: depUSD > 50 ? 35 : 20,
  };
}

type BuiltLead = {
  phone: string; name: string;
  segment: string; priority: string;
  score: number; lead_score: number; trait: string | null;
  preferred_product: string | null;
  last_deposit_ugx: number; lifetime_value: number;
  deposit_count: number; last_bet_date: string | null;
  betting_patterns: any;
};
type ImportResult = {
  total: number; inserted: number; enriched: number; recycled: number; skipped: number;
  upgraded: number; downgraded: number; distributed: number;
};

export default function ImportLeadsScreen() {
  const { user } = useAuth();
  const country = (user as any)?.country || "UG";
  const { data: agents, refetch: refetchAgents } = useAgentsAvailable();
  const queryClient = useQueryClient();

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BuiltLead[]>([]);
  const [preview, setPreview] = useState<BuiltLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [distributing, setDistributing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const data = await api.get<any[]>("/leads/import-batches?limit=5");
      setHistory(data.filter((b) => b.batch_type === "new_leads"));
    } catch { /* ignore */ }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["*/*"], copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      if (!file.uri) return;

      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const isCsv = /\.csv$/i.test(file.name);
      if (!isExcel && !isCsv) {
        Alert.alert("Wrong file type", "Upload a .csv, .xlsx or .xls file");
        return;
      }

      let json: any[] = [];
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

      const built: BuiltLead[] = json.map((row) => {
        const mapped: any = {};
        for (const [k, v] of Object.entries(row)) {
          const out = PLATFORM_COLUMNS[k] || k.toLowerCase();
          mapped[out] = v;
        }
        const rawPhone = String(mapped.phone || mapped.number || mapped.phoneNumber || mapped.username || "").trim();
        if (!rawPhone) return null;
        const phone = formatPhoneForCountry(rawPhone, country);
        if (phone.replace(/\D/g, "").length < 10) return null;

        const deposit_usd = parseNum(mapped.deposit_usd);
        const deposit_local = parseNum(mapped.deposit_local);
        const total_bets = parseNum(mapped.total_bets);
        const last_login = excelDate(mapped.last_login);
        const { segment, priority, trait, score } = classify(deposit_usd, deposit_local, total_bets, last_login);

        const cat = String(mapped.category || "");
        const preferred_product =
          cat.includes("体育") ? "Sports" :
          cat.includes("游戏") ? "Gaming" :
          cat.includes("彩票") ? "Lottery" :
          parseNum(mapped.sports_bets) > parseNum(mapped.game_bets) ? "Sports" :
          parseNum(mapped.game_bets) > 0 ? "Gaming" : null;

        return {
          phone,
          name: mapped.name || `User ${rawPhone.replace(/\D/g, "").slice(-4)}`,
          segment, priority, score, lead_score: score, trait,
          preferred_product,
          last_deposit_ugx: deposit_local || Math.round(deposit_usd * 3700),
          lifetime_value: deposit_local || Math.round(deposit_usd * 3700),
          deposit_count: total_bets,
          last_bet_date: last_login ? last_login.toISOString().split("T")[0] : null,
          betting_patterns: {
            deposit_usd, deposit_local, total_bets,
            sports_bets: parseNum(mapped.sports_bets),
            game_bets: parseNum(mapped.game_bets),
            total_ggr: parseNum(mapped.total_ggr),
            total_bet_amount: parseNum(mapped.total_bet_amount),
            last_login: last_login?.toISOString() || null,
            platform_category: cat,
          },
        } as BuiltLead;
      }).filter((x): x is BuiltLead => !!x);

      setFileName(file.name);
      setRows(built);
      setPreview(built.slice(0, 3));
      setResult(null);

      Alert.alert("File loaded", `${built.length} valid rows parsed from ${file.name}`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err?.message || "Failed to parse file");
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      const BATCH = 100;
      const batches = Math.ceil(rows.length / BATCH);
      setProgress({ current: 0, total: batches });

      const acc: ImportResult = { total: 0, inserted: 0, enriched: 0, recycled: 0, skipped: 0, upgraded: 0, downgraded: 0, distributed: 0 };

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const resp = await api.post<ImportResult>("/leads/import-csv", {
          leads: batch, source_filename: fileName,
        });
        acc.total += resp.total;
        acc.inserted += resp.inserted;
        acc.enriched += resp.enriched;
        acc.recycled += resp.recycled;
        acc.skipped += resp.skipped;
        acc.upgraded += resp.upgraded;
        acc.downgraded += resp.downgraded;
        acc.distributed += resp.distributed;
        setProgress({ current: Math.floor(i / BATCH) + 1, total: batches });
      }

      setResult(acc);
      queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
      queryClient.invalidateQueries({ queryKey: ["agents-available"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      loadHistory();
    } catch (err: any) {
      Alert.alert("Import failed", err?.message || "Unknown error");
    } finally {
      setImporting(false);
    }
  };

  const distribute = async () => {
    if (selectedAgents.length === 0) {
      Alert.alert("Pick agents", "Select at least one agent to distribute to.");
      return;
    }
    setDistributing(true);
    try {
      const resp = await api.post<{ total_distributed: number }>("/leads/distribute", {
        agent_ids: selectedAgents,
      });
      Alert.alert("Distributed", `${resp.total_distributed} leads distributed fairly across ${selectedAgents.length} agent(s).`);
      setResult((r) => r ? { ...r, distributed: r.distributed + resp.total_distributed } : r);
      queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
      queryClient.invalidateQueries({ queryKey: ["agents-available"] });
      refetchAgents();
    } catch (err: any) {
      Alert.alert("Distribution failed", err?.message || "Unknown error");
    } finally {
      setDistributing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadHistory} tintColor={colors.brand.green} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Import New Leads</Text>
        <Text style={styles.introSub}>
          Duplicates are merged smartly — active leads are only enriched, dead leads past 30 days are recycled.
        </Text>
      </View>

      {/* Step 1: pick file */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Pick File</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickFile} activeOpacity={0.7} disabled={importing}>
          <Feather name="upload" size={22} color={colors.brand.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadBtnTitle}>{fileName || "Tap to pick CSV/Excel"}</Text>
            <Text style={styles.uploadBtnSub}>
              {rows.length > 0 ? `${rows.length} rows parsed` : "Betting platform export or generic CSV"}
            </Text>
          </View>
        </TouchableOpacity>

        {preview.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewHeader}>Preview</Text>
            {preview.map((p, i) => (
              <View key={i} style={styles.previewRow}>
                <Text style={styles.previewPhone}>{p.phone}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.previewTrait}>{p.trait || "—"}</Text>
                  <Text style={styles.previewMeta}>
                    ${p.betting_patterns?.deposit_usd?.toLocaleString() || 0} · {p.betting_patterns?.total_bets?.toLocaleString() || 0} bets
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Step 2: run import */}
      {rows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Run Import</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, importing && { opacity: 0.5 }]}
            onPress={runImport}
            disabled={importing}
            activeOpacity={0.8}
          >
            {importing ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Importing {progress.current}/{progress.total}…
                </Text>
              </>
            ) : (
              <>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Import {rows.length} rows</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Step 3: results */}
      {result && (
        <View style={styles.section}>
          <View style={styles.resultHeader}>
            <Feather name="check-circle" size={16} color={colors.status.success} />
            <Text style={styles.resultHeaderText}>Import complete</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatTile label="New" value={result.inserted} color="#2563eb" icon="user-plus" />
            <StatTile label="Enriched" value={result.enriched} color="#d97706" icon="refresh-ccw" />
            <StatTile label="Recycled" value={result.recycled} color="#7c3aed" icon="rotate-ccw" />
            <StatTile label="Skipped" value={result.skipped} color={colors.text.muted} icon="alert-circle" />
          </View>

          {(result.upgraded > 0 || result.downgraded > 0) && (
            <View style={styles.scoreRow}>
              {result.upgraded > 0 && (
                <View style={[styles.scoreChip, { backgroundColor: "#dcfce7" }]}>
                  <Feather name="trending-up" size={12} color="#166534" />
                  <Text style={[styles.scoreChipText, { color: "#166534" }]}>
                    {result.upgraded} score upgrade{result.upgraded !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
              {result.downgraded > 0 && (
                <View style={[styles.scoreChip, { backgroundColor: "#fee2e2" }]}>
                  <Feather name="trending-down" size={12} color="#991b1b" />
                  <Text style={[styles.scoreChipText, { color: "#991b1b" }]}>
                    {result.downgraded} downgrade{result.downgraded !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
          )}

          {(result.inserted + result.recycled) > 0 && (
            <View style={styles.distributeSection}>
              <Text style={styles.sectionTitle}>
                Distribute {result.inserted + result.recycled} fresh leads
              </Text>
              <View style={styles.agentList}>
                {(agents || []).map((a) => {
                  const selected = selectedAgents.includes(a.id);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.agentChip, selected && styles.agentChipSelected]}
                      onPress={() => toggleAgent(a.id)}
                      activeOpacity={0.7}
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
                style={[styles.distributeBtn, (distributing || selectedAgents.length === 0) && { opacity: 0.5 }]}
                onPress={distribute}
                disabled={distributing || selectedAgents.length === 0}
                activeOpacity={0.8}
              >
                {distributing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="shuffle" size={14} color="#fff" />
                    <Text style={styles.distributeBtnText}>
                      Distribute fairly
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Recent imports */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent imports</Text>
          {history.map((b) => (
            <View key={b.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {b.source_filename || "Untitled import"}
                </Text>
                <Text style={styles.historyMeta}>
                  {new Date(b.created_at).toLocaleString()}
                </Text>
              </View>
              <View style={styles.historyStats}>
                <Text style={styles.historyStatText}>+{b.new_count}</Text>
                <Text style={styles.historySep}>·</Text>
                <Text style={styles.historyStatText}>{b.updated_count} enriched</Text>
                {b.recycled_count > 0 && (
                  <>
                    <Text style={styles.historySep}>·</Text>
                    <Text style={styles.historyStatText}>{b.recycled_count} recycled</Text>
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

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statTile: { flex: 1, minWidth: "22%", backgroundColor: colors.bg.card, padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  statTileValue: { fontSize: 18, fontWeight: "800", color: colors.text.primary, marginTop: 4 },
  statTileLabel: { fontSize: 10, color: colors.text.muted, fontWeight: "600", marginTop: 1 },

  scoreRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  scoreChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  scoreChipText: { fontSize: 12, fontWeight: "600" },

  distributeSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border.default },
  agentList: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  agentChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  agentChipSelected: { backgroundColor: "#f0fdf4", borderColor: colors.brand.green },
  agentChipText: { fontSize: 12, fontWeight: "600", color: colors.text.primary },
  checkbox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border.default, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },

  distributeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand.green, paddingVertical: 13, borderRadius: 10 },
  distributeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  historyRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, padding: 12, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border.default },
  historyTitle: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  historyMeta: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  historyStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  historyStatText: { fontSize: 11, fontWeight: "600", color: colors.text.secondary },
  historySep: { fontSize: 11, color: colors.border.default },
});
