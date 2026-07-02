import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  FlatList,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { CallActivity, Callback } from "../../src/types";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { getCurrencyFromCountry, getCurrencyFromPhone, formatCurrency } from "../../src/utils/formatCurrency";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { COUNTRY_MAP, COUNTRY_OFFSETS } from "../../src/config/countries";

// ─── Types ───────────────────────────────────────────────────────────────────

type PresetKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUtcRangeForLocalDate(dateStr: string, offsetHours: number): DateRange {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0];
  const monthIdx = parts[1] - 1;
  const day = parts[2];

  const start = new Date(Date.UTC(year, monthIdx, day, 0, 0, 0, 0));
  start.setUTCHours(start.getUTCHours() - offsetHours);

  const end = new Date(Date.UTC(year, monthIdx, day, 23, 59, 59, 999));
  end.setUTCHours(end.getUTCHours() - offsetHours);

  return { start, end };
}

function formatUtcAsYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPresetRange(preset: PresetKey, countryCode: string, custom: DateRange): DateRange {
  const offset = COUNTRY_OFFSETS[countryCode] ?? 3;

  const getAgentLocalTime = (d = new Date()) => {
    return new Date(d.getTime() + offset * 60 * 60 * 1000);
  };

  const localNow = getAgentLocalTime();

  switch (preset) {
    case "today": {
      const dateStr = formatUtcAsYmd(localNow);
      return getUtcRangeForLocalDate(dateStr, offset);
    }
    case "yesterday": {
      const yesterday = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = formatUtcAsYmd(yesterday);
      return getUtcRangeForLocalDate(dateStr, offset);
    }
    case "this_week": {
      const day = localNow.getUTCDay();
      const diff = (day + 6) % 7;
      const mon = new Date(localNow.getTime() - diff * 24 * 60 * 60 * 1000);
      
      const startDateStr = formatUtcAsYmd(mon);
      const endDateStr = formatUtcAsYmd(localNow);
      
      const startRange = getUtcRangeForLocalDate(startDateStr, offset);
      const endRange = getUtcRangeForLocalDate(endDateStr, offset);
      return { start: startRange.start, end: endRange.end };
    }
    case "last_week": {
      const day = localNow.getUTCDay();
      const thisMonday = new Date(localNow.getTime() - ((day + 6) % 7) * 24 * 60 * 60 * 1000);
      
      const lastMon = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastSun = new Date(thisMonday.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const startDateStr = formatUtcAsYmd(lastMon);
      const endDateStr = formatUtcAsYmd(lastSun);
      
      const startRange = getUtcRangeForLocalDate(startDateStr, offset);
      const endRange = getUtcRangeForLocalDate(endDateStr, offset);
      return { start: startRange.start, end: endRange.end };
    }
    case "this_month": {
      const firstDay = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1, 0, 0, 0, 0));
      
      const startDateStr = formatUtcAsYmd(firstDay);
      const endDateStr = formatUtcAsYmd(localNow);
      
      const startRange = getUtcRangeForLocalDate(startDateStr, offset);
      const endRange = getUtcRangeForLocalDate(endDateStr, offset);
      return { start: startRange.start, end: endRange.end };
    }
    case "custom":
      return custom;
  }
}

function formatRangeLabel(range: DateRange): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sMonth = months[range.start.getMonth()];
  const sDay = range.start.getDate();
  const eMonth = months[range.end.getMonth()];
  const eDay = range.end.getDate();
  
  const s = `${sMonth} ${sDay}`;
  const e = `${eMonth} ${eDay}`;
  return s === e ? s : `${s} – ${e}`;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  connected:     { bg: "#dcfce7", text: "#166534", label: "Connected" },
  converted:     { bg: "#dcfce7", text: "#166534", label: "Converted" },
  interested:    { bg: "#dcfce7", text: "#166534", label: "Interested" },
  no_answer:     { bg: "#fef3c7", text: "#92400e", label: "No Answer" },
  unreachable:   { bg: "#fee2e2", text: "#991b1b", label: "Unreachable" },
  not_interested:{ bg: "#f3f4f6", text: "#374151", label: "Not Interested" },
};

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today",      label: "Today" },
  { key: "yesterday",  label: "Yesterday" },
  { key: "this_week",  label: "This Week" },
  { key: "last_week",  label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "custom",     label: "Custom" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentLogsScreen() {
  const { user } = useAuth();
  const { agentId, agentName } = useLocalSearchParams<{ agentId: string; agentName: string }>();

  const [preset, setPreset] = useState<PresetKey>("today");
  const [custom, setCustom] = useState<DateRange>({ start: new Date(), end: new Date() });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [pickingField, setPickingField] = useState<"start" | "end">("start");
  const [tempStart, setTempStart] = useState<Date>(new Date());
  const [tempEnd, setTempEnd]   = useState<Date>(new Date());
  const [exporting, setExporting] = useState(false);

  const { data: agentProfile } = useQuery<any>({
    queryKey: ["agent-profile", agentId],
    queryFn: () => api.get(`/profiles/${agentId}`),
    enabled: !!agentId,
  });

  const agentCountry = agentProfile?.country || user?.country || 'UG';
  const range = getPresetRange(preset, agentCountry, custom);

  const { data: calls, isLoading: callsLoading } = useQuery<CallActivity[]>({
    queryKey: ["agent-calls", agentId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      api.get(`/call-activities?user_id=${agentId}&start_date=${range.start.toISOString()}&end_date=${range.end.toISOString()}&limit=10000`),
    enabled: !!agentId,
    refetchInterval: 30000,
  });

  const { data: callbacks } = useQuery<Callback[]>({
    queryKey: ["agent-callbacks", agentId],
    queryFn: () => api.get(`/callbacks?user_id=${agentId}&limit=5000`),
    enabled: !!agentId,
    refetchInterval: 60000,
  });

  const { data: numbersAssigned = 0 } = useQuery<number>({
    queryKey: ["agent-assigned-leads", agentId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      try {
        const data = await api.get<{ count: number }>(
          `/leads/assigned-count?user_id=${agentId}&since=${encodeURIComponent(range.start.toISOString())}&until=${encodeURIComponent(range.end.toISOString())}`
        );
        return data.count ?? 0;
      } catch {
        // Endpoint not available — fall back to 0 gracefully
        return 0;
      }
    },
    enabled: !!agentId,
    refetchInterval: 60000,
  });

  const callbacksByPhone = React.useMemo(() => {
    const map: Record<string, Callback> = {};
    if (Array.isArray(callbacks)) {
      callbacks.forEach((cb) => { map[cb.phone_number] = cb; });
    }
    return map;
  }, [callbacks]);

  const { totalCalls, connects, conversions } = React.useMemo(() => {
    const total = Array.isArray(calls) ? calls.length : 0;
    if (!Array.isArray(calls)) {
      return { totalCalls: 0, connects: 0, conversions: 0 };
    }
    const conn = calls.filter((c) => ["connected", "converted", "interested", "not_interested", "answered_no_response"].includes(c.status) || (c.duration_seconds || 0) > 0).length;
    const conv = calls.filter((c) => c.status === "converted" || (c.deposit_amount && c.deposit_amount > 0)).length;
    return { totalCalls: total, connects: conn, conversions: conv };
  }, [calls]);

  function openCustomModal() {
    setTempStart(custom.start);
    setTempEnd(custom.end);
    setPickingField("start");
    setShowCustomModal(true);
  }

  function applyCustomRange() {
    const offset = COUNTRY_OFFSETS[agentCountry] ?? 3;
    
    const startDateStr = tempStart.toLocaleDateString('en-CA');
    const endDateStr = (tempEnd < tempStart ? tempStart : tempEnd).toLocaleDateString('en-CA');
    
    const startRange = getUtcRangeForLocalDate(startDateStr, offset);
    const endRange = getUtcRangeForLocalDate(endDateStr, offset);
    
    setCustom({ start: startRange.start, end: endRange.end });
    setPreset("custom");
    setShowCustomModal(false);
  }

  async function handleGenerateReport() {
    if (!calls || calls.length === 0) {
      Alert.alert("No Data", "No call logs found for the selected period.");
      return;
    }
    setExporting(true);
    try {
      const rangeLabel = formatRangeLabel(range);

      // ── Summary sheet: Numbers Assigned + key KPIs ──────────────────────
      const connectRate = totalCalls > 0 ? `${Math.round((connects / totalCalls) * 100)}%` : "0%";
      const summaryHeaders = ["Metric", "Value"];
      const summaryRows = [
        ["Agent", agentName || agentId],
        ["Period", rangeLabel],
        ["Numbers Assigned", numbersAssigned],
        ["Total Calls Made", totalCalls],
        ["Connects", connects],
        ["Connect Rate", connectRate],
        ["Conversions / Deposits", conversions],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);

      // ── Call Log sheet ───────────────────────────────────────────────────
      const headers = ["Phone Number", "Lead Name", "Status", "Notes", "Follow Up", "Follow Up Date", "Follow Up Notes", "Deposit Amount", "Call Time", "Call Date"];

      const rows = calls.map((call) => {
        const cb = callbacksByPhone[call.phone_number];
        return [
          call.phone_number,
          call.lead_name || "",
          STATUS_STYLE[call.status]?.label ?? call.status,
          call.notes || "",
          cb ? "Yes" : "No",
          cb ? formatDate(cb.scheduled_for) : "",
          cb?.notes || "",
          call.deposit_amount ?? "",
          formatTime(call.created_at),
          new Date(call.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      XLSX.utils.book_append_sheet(wb, ws, "Calls");
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      const cleanAgentName = (agentName || "Agent").replace(/[^a-zA-Z0-9]/g, "_");
      const cleanRangeLabel = rangeLabel.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `${cleanAgentName}_Report_${cleanRangeLabel}.xlsx`;
      const uri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
      
      try {
        const Sharing = require("expo-sharing");
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: `${agentName || "Agent"} Report — ${rangeLabel}`,
          });
          return;
        }
      } catch (e) {
        console.warn("expo-sharing is not available, falling back to React Native Share", e);
      }

      // Fallback: React Native built-in Share
      await Share.share({
        title: `${agentName || "Agent"} Report — ${rangeLabel}`,
        url: uri,
      });
    } catch (error) {
      console.error("Export report error:", error);
      Alert.alert("Export Failed", "Could not generate the report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: agentName || "Agent Logs",
          headerStyle: { backgroundColor: colors.bg.card },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { fontWeight: "700" },
          headerRight: () => (
            <TouchableOpacity onPress={handleGenerateReport} disabled={exporting} style={styles.exportBtn}>
              {exporting
                ? <ActivityIndicator size="small" color={colors.brand.green} />
                : <><Feather name="download" size={15} color={colors.brand.green} /><Text style={styles.exportBtnText}>Export</Text></>
              }
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        style={styles.container}
        data={Array.isArray(calls) ? calls : []}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={({ item: call, index }) => {
          const i = index;
          if (!call) return null;
          const s  = STATUS_STYLE[call.status] || { bg: "#f3f4f6", text: "#374151", label: call.status };
          const cb = callbacksByPhone[call.phone_number];
          return (
            <View style={[styles.logCard, i === 0 && { borderTopWidth: 0 }, { marginHorizontal: 20 }]}>
              <View style={styles.logRow}>
                <View style={[styles.logIcon, { backgroundColor: s.bg }]}>
                  <Feather
                    name={["connected","interested"].includes(call.status) ? "phone-incoming" : call.status === "no_answer" ? "phone-missed" : "phone-off"}
                    size={13} color={s.text}
                  />
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logPhone}>{call.phone_number}</Text>
                  {call.lead_name ? <Text style={styles.logName}>{call.lead_name}</Text> : null}
                </View>
                <View style={styles.logRight}>
                  <View style={[styles.statusChip, { backgroundColor: s.bg }]}>
                    <Text style={[styles.statusChipText, { color: s.text }]}>{s.label}</Text>
                  </View>
                  <Text style={styles.logTime}>{formatTime(call.created_at)}</Text>
                </View>
              </View>
              {call.notes ? (
                <View style={styles.notesRow}>
                  <Feather name="message-square" size={11} color={colors.text.muted} />
                  <Text style={styles.notesText}>{call.notes}</Text>
                </View>
              ) : null}
              {call.deposit_amount && call.deposit_amount > 0 ? (
                <View style={styles.depositRow}>
                  <Feather name="trending-up" size={11} color="#10b981" />
                  <Text style={styles.depositText}>Deposit: {formatCurrency(call.deposit_amount, getCurrencyFromPhone(call.phone_number, user?.country || 'UG'))}</Text>
                </View>
              ) : null}
              {cb ? (
                <View style={styles.followUpRow}>
                  <Feather name="calendar" size={11} color="#6366f1" />
                  <Text style={styles.followUpText}>
                    Follow-up: {formatDate(cb.scheduled_for)}{cb.notes ? ` — ${cb.notes}` : ""}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListHeaderComponent={
          <>
            {/* Date range presets */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {PRESETS.map((p) => {
                const active = preset === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => p.key === "custom" ? openCustomModal() : setPreset(p.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active range label */}
            <View style={styles.rangeLabelRow}>
              <Feather name="calendar" size={12} color={colors.text.muted} />
              <Text style={styles.rangeLabel}>{formatRangeLabel(range)}</Text>
            </View>

            {/* KPIs */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: "#2563eb" }]}>{numbersAssigned}</Text>
                <Text style={styles.kpiLabel}>Assigned</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: colors.brand.green }]}>{totalCalls}</Text>
                <Text style={styles.kpiLabel}>Calls</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: "#10b981" }]}>{connects}</Text>
                <Text style={styles.kpiLabel}>Connects</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiValue, { color: "#6366f1" }]}>{conversions}</Text>
                <Text style={styles.kpiLabel}>Deposits</Text>
              </View>
            </View>

            {/* Generate Report */}
            <TouchableOpacity style={styles.reportButton} onPress={handleGenerateReport} disabled={exporting} activeOpacity={0.8}>
              {exporting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="file-text" size={18} color="#fff" />
              }
              <Text style={styles.reportButtonText}>
                {exporting ? "Generating..." : `Generate Report — ${formatRangeLabel(range)}`}
              </Text>
            </TouchableOpacity>

            {/* Call Logs Section Header */}
            <View style={[styles.logsSection, { marginBottom: 10 }]}>
              <View style={styles.logsSectionHeader}>
                <View style={styles.logsTitleRow}>
                  <Feather name="phone" size={14} color={colors.text.secondary} />
                  <Text style={styles.sectionTitleInline}>Call Logs</Text>
                </View>
                {totalCalls > 0 && <Text style={styles.logsCount}>{totalCalls} calls</Text>}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          callsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.brand.green} />
              <Text style={styles.loadingText}>Loading logs...</Text>
            </View>
          ) : (
            <View style={[styles.emptyBox, { marginHorizontal: 20 }]}>
              <Feather name="phone-off" size={22} color={colors.text.muted} />
              <Text style={styles.emptyText}>No calls in this period</Text>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={true}
      />

      {/* Custom date range modal */}
      <Modal visible={showCustomModal} transparent animationType="slide" onRequestClose={() => setShowCustomModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <Feather name="x" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {(["start", "end"] as const).map((field) => {
              const date = field === "start" ? tempStart : tempEnd;
              const setDate = field === "start" ? setTempStart : setTempEnd;
              const label = field === "start" ? "From" : "To";
              return (
                <View key={field} style={styles.dateRow}>
                  <Text style={styles.dateRowLabel}>{label}</Text>
                  <View style={styles.dateStepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); }}
                    >
                      <Feather name="chevron-left" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.dateStepperValue}>
                      {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => {
                        const d = new Date(date);
                        d.setDate(d.getDate() + 1);
                        if (d <= new Date()) setDate(d);
                      }}
                    >
                      <Feather name="chevron-right" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.applyButton} onPress={applyCustomRange}>
              <Text style={styles.applyButtonText}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4 },
  exportBtnText: { color: colors.brand.green, fontSize: 13, fontWeight: "600" },
  sectionTitleInline: { fontSize: 12, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5 },

  // Presets
  presetRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  presetChipActive: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },
  presetChipText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  presetChipTextActive: { color: "#fff" },

  rangeLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 20, marginTop: 6, marginBottom: 2 },
  rangeLabel: { fontSize: 12, color: colors.text.muted },

  // KPIs
  kpiRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 12 },
  kpiCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  kpiValue: { fontSize: 26, fontWeight: "800" },
  kpiLabel: { fontSize: 11, color: colors.text.muted, fontWeight: "600", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },

  reportButton: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 14, borderRadius: 8, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  reportButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Logs
  logsSection: { marginHorizontal: 20, marginTop: 20 },
  logsSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logsTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logsCount: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },
  loadingBox: { padding: 30, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 13, color: colors.text.muted },
  emptyBox: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 30, alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border.default },
  emptyText: { fontSize: 14, color: colors.text.secondary, fontWeight: "600" },

  logCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border.default },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logInfo: { flex: 1 },
  logPhone: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  logName: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  logRight: { alignItems: "flex-end", gap: 3 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusChipText: { fontSize: 10, fontWeight: "700" },
  logTime: { fontSize: 11, color: colors.text.muted },
  notesRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 6, marginLeft: 42 },
  notesText: { fontSize: 12, color: colors.text.secondary, flex: 1, fontStyle: "italic" },
  depositRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, marginLeft: 42 },
  depositText: { fontSize: 12, color: "#10b981", fontWeight: "600" },
  followUpRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 4, marginLeft: 42 },
  followUpText: { fontSize: 12, color: "#6366f1", flex: 1 },

  // Custom date modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text.primary },
  dateRow: { marginBottom: 16 },
  dateRowLabel: { fontSize: 11, fontWeight: "700", color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  dateStepper: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border.default },
  stepBtn: { padding: 12 },
  dateStepperValue: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.text.primary },
  applyButton: { backgroundColor: colors.brand.green, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 8 },
  applyButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
