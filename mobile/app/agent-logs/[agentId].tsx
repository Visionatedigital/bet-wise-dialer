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
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { CallActivity, Callback } from "../../src/types";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { getCurrencyFromCountry, getCurrencyFromPhone } from "../../src/utils/formatCurrency";

// ─── Types ───────────────────────────────────────────────────────────────────

type PresetKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getPresetRange(preset: PresetKey, custom: DateRange): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "this_week": {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((day + 6) % 7));
      return { start: startOfDay(mon), end: endOfDay(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - ((day + 6) % 7));
      const lastMon = new Date(thisMonday);
      lastMon.setDate(thisMonday.getDate() - 7);
      const lastSun = new Date(thisMonday);
      lastSun.setDate(thisMonday.getDate() - 1);
      return { start: startOfDay(lastMon), end: endOfDay(lastSun) };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(firstDay), end: endOfDay(now) };
    }
    case "custom":
      return custom;
  }
}

function formatRangeLabel(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = range.start.toLocaleDateString("en-US", opts);
  const e = range.end.toLocaleDateString("en-US", opts);
  return s === e ? s : `${s} – ${e}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
  const [custom, setCustom] = useState<DateRange>({ start: startOfDay(new Date()), end: endOfDay(new Date()) });
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [pickingField, setPickingField] = useState<"start" | "end">("start");
  const [tempStart, setTempStart] = useState<Date>(startOfDay(new Date()));
  const [tempEnd, setTempEnd]   = useState<Date>(endOfDay(new Date()));
  const [exporting, setExporting] = useState(false);

  const range = getPresetRange(preset, custom);

  const { data: calls, isLoading: callsLoading } = useQuery<CallActivity[]>({
    queryKey: ["agent-calls", agentId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      api.get(`/call-activities?user_id=${agentId}&start_date=${range.start.toISOString()}&end_date=${range.end.toISOString()}&limit=500`),
    enabled: !!agentId,
    refetchInterval: 30000,
  });

  const { data: callbacks } = useQuery<Callback[]>({
    queryKey: ["agent-callbacks", agentId],
    queryFn: () => api.get(`/callbacks?user_id=${agentId}&limit=500`),
    enabled: !!agentId,
    refetchInterval: 60000,
  });

  const callbacksByPhone = React.useMemo(() => {
    const map: Record<string, Callback> = {};
    callbacks?.forEach((cb) => { map[cb.phone_number] = cb; });
    return map;
  }, [callbacks]);

  const totalCalls  = calls?.length ?? 0;
  const connects    = calls?.filter((c) => ["connected", "interested", "converted"].includes(c.status)).length ?? 0;
  const conversions = calls?.filter((c) => c.deposit_amount && c.deposit_amount > 0).length ?? 0;

  function openCustomModal() {
    setTempStart(custom.start);
    setTempEnd(custom.end);
    setPickingField("start");
    setShowCustomModal(true);
  }

  function applyCustomRange() {
    const start = startOfDay(tempStart);
    const end   = endOfDay(tempEnd < tempStart ? tempStart : tempEnd);
    setCustom({ start, end });
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
      const headers = ["Phone Number", "Lead Name", "Status", "Notes", "Follow Up", "Follow Up Date", "Follow Up Notes", "Deposit Amount", "Call Time", "Call Date"];

      const escape = (v: any) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const csvLines = [
        `Agent: ${agentName || ""}  |  Period: ${rangeLabel}  |  Total Calls: ${calls.length}`,
        "",
        headers.join(","),
        ...calls.map((call) => {
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
          ].map(escape).join(",");
        }),
      ];

      const csvContent = csvLines.join("\n");
      await Share.share({
        message: csvContent,
        title: `${agentName || "Agent"} Report — ${rangeLabel}`,
      });
    } catch {
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

      <ScrollView style={styles.container}>

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

        {/* Call Logs */}
        <View style={styles.logsSection}>
          <View style={styles.logsSectionHeader}>
            <View style={styles.logsTitleRow}>
              <Feather name="phone" size={14} color={colors.text.secondary} />
              <Text style={styles.sectionTitleInline}>Call Logs</Text>
            </View>
            {totalCalls > 0 && <Text style={styles.logsCount}>{totalCalls} calls</Text>}
          </View>

          {callsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.brand.green} />
              <Text style={styles.loadingText}>Loading logs...</Text>
            </View>
          ) : !calls || calls.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="phone-off" size={22} color={colors.text.muted} />
              <Text style={styles.emptyText}>No calls in this period</Text>
            </View>
          ) : (
            calls.map((call, i) => {
              const s  = STATUS_STYLE[call.status] || { bg: "#f3f4f6", text: "#374151", label: call.status };
              const cb = callbacksByPhone[call.phone_number];
              return (
                <View key={call.id || i} style={[styles.logCard, i === 0 && { borderTopWidth: 0 }]}>
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
                      <Text style={styles.depositText}>Deposit: {getCurrencyFromPhone(call.phone_number) || getCurrencyFromCountry(user?.country || 'UG')} {call.deposit_amount.toLocaleString()}</Text>
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
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

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
