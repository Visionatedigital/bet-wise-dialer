import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Linking, Alert, AppState, Modal, TextInput, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLead } from "../../src/hooks/useLeads";
import { StatusBadge } from "../../src/components/StatusBadge";
import { api } from "../../src/api/client";
import { parseCallbackIntent } from "../../src/utils/parseCallbackIntent";
import { colors } from "../../src/theme/colors";

const DISPOSITIONS = [
  { value: "interested", label: "Interested", icon: "thumbs-up" as const, color: "#10b981", bg: "#dcfce7" },
  { value: "not_interested", label: "Not Interested", icon: "thumbs-down" as const, color: "#ef4444", bg: "#fee2e2" },
  { value: "no_answer", label: "No Answer", icon: "phone-missed" as const, color: "#d97706", bg: "#fef3c7" },
  { value: "unreachable", label: "Unreachable", icon: "phone-off" as const, color: "#64748b", bg: "#f3f4f6" },
];

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || "";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: lead, isLoading } = useLead(id!);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Call outcome modal state
  const [showOutcome, setShowOutcome] = useState(false);
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [leadStrength, setLeadStrength] = useState<"hot" | "warm" | "cold">("warm");
  const [scheduleCallback, setScheduleCallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const callPending = useRef(false);

  // Listen for app returning to foreground after call
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && callPending.current) {
        callPending.current = false;
        // Short delay so the app is fully foregrounded
        setTimeout(() => setShowOutcome(true), 400);
      }
    });
    return () => sub.remove();
  }, []);

  const handleCall = () => {
    if (!lead) return;
    callPending.current = true;
    Linking.openURL(`tel:${lead.phone}`);
  };

  const handleSaveOutcome = async () => {
    if (!disposition) {
      Alert.alert("Required", "Please select a call outcome");
      return;
    }
    if (!lead) return;

    setSubmitting(true);
    try {
      // Log call activity
      await api.post("/call-activities", {
        phone_number: lead.phone,
        lead_name: lead.name,
        call_type: "native_dialer",
        status: disposition === "interested" || disposition === "not_interested" ? "connected" : disposition,
        duration_seconds: 0,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        notes: notes || null,
        campaign_id: lead.campaign_id || null,
      });

      // Update lead status (stored in last_activity)
      await api.patch(`/leads/${lead.id}`, {
        last_activity: disposition,
        last_contact_at: new Date().toISOString(),
      });

      // Auto-detect or manual callback
      const cbIntent = parseCallbackIntent(notes);
      if (scheduleCallback || cbIntent.shouldCreateCallback) {
        const cbDate = cbIntent.callbackDate || new Date(Date.now() + 86400000);
        await api.post("/callbacks", {
          lead_name: lead.name,
          phone_number: lead.phone,
          notes: notes || `Follow up - ${disposition.replace(/_/g, " ")}`,
          scheduled_for: cbDate.toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["callbacks"] });
      queryClient.invalidateQueries({ queryKey: ["recent-calls"] });

      setShowOutcome(false);
      resetForm();
      Alert.alert("Saved", "Call outcome logged successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDisposition("");
    setNotes("");
    setDepositAmount("");
    setLeadStrength("warm");
    setScheduleCallback(false);
  };

  if (isLoading || !lead) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Lead", headerStyle: { backgroundColor: colors.bg.card }, headerTintColor: colors.text.primary }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg.dashboard }}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: lead.name, headerStyle: { backgroundColor: colors.bg.card, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border.default }, headerTintColor: colors.text.primary, headerTitleStyle: { fontWeight: "700" } }} />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarLg}><Text style={styles.avatarText}>{lead.name[0].toUpperCase()}</Text></View>
          <Text style={styles.name}>{lead.name}</Text>
          <Text style={styles.phone}>{maskPhone(lead.phone)}</Text>
          <View style={styles.badges}>
            <StatusBadge label={lead.status || lead.last_activity || "unassigned"} />
            <StatusBadge label={lead.segment || "general"} />
            <StatusBadge label={lead.priority} />
          </View>
        </View>

        <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
          <Feather name="phone-outgoing" size={18} color="#fff" />
          <Text style={styles.callText}>Call {lead.name.split(" ")[0]}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logButton} onPress={() => setShowOutcome(true)} activeOpacity={0.8}>
          <Feather name="edit-3" size={16} color={colors.brand.green} />
          <Text style={styles.logText}>Log Call Outcome</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Info</Text>
          <InfoRow label="Campaign" value={lead.campaign_name || lead.campaign || "—"} />
          <InfoRow label="Segment" value={lead.segment || "—"} />
          <InfoRow label="Priority" value={lead.priority} />
          <InfoRow label="Score" value={lead.score?.toString() || "—"} />
          <InfoRow label="Last Deposit" value={lead.last_deposit_ugx ? `UGX ${lead.last_deposit_ugx.toLocaleString()}` : "—"} />
          <InfoRow label="Product" value={lead.preferred_product || lead.intent || "—"} />
          <InfoRow label="Trait" value={lead.trait || "—"} last />
        </View>

        {lead.last_activity && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Activity</Text>
            <Text style={styles.notesText}>{lead.last_activity}</Text>
          </View>
        )}

        {lead.next_action && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Action</Text>
            <Text style={styles.notesText}>{lead.next_action}</Text>
            {lead.next_action_due && <Text style={styles.dueDate}>Due: {new Date(lead.next_action_due).toLocaleDateString()}</Text>}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ===== CALL OUTCOME MODAL ===== */}
      <Modal visible={showOutcome} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={m.header}>
            <TouchableOpacity onPress={() => { setShowOutcome(false); resetForm(); }}>
              <Feather name="x" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={m.headerTitle}>After-Call Summary</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView style={m.body} keyboardShouldPersistTaps="handled">
            {/* Lead context */}
            <View style={m.leadContext}>
              <View style={m.leadContextAvatar}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{lead.name[0]}</Text>
              </View>
              <View>
                <Text style={m.leadContextName}>{lead.name}</Text>
                <Text style={m.leadContextPhone}>{maskPhone(lead.phone)}</Text>
              </View>
            </View>

            {/* Disposition */}
            <Text style={m.label}>
              <Feather name="alert-triangle" size={12} color={colors.status.error} /> Call Disposition *
            </Text>
            <View style={m.dispGrid}>
              {DISPOSITIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[m.dispCard, disposition === d.value && { backgroundColor: d.bg, borderColor: d.color }]}
                  onPress={() => setDisposition(d.value)}
                >
                  <Feather name={d.icon} size={16} color={disposition === d.value ? d.color : colors.text.muted} />
                  <Text style={[m.dispLabel, disposition === d.value && { color: d.color, fontWeight: "700" }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Deposit + Strength if interested */}
            {disposition === "interested" && (
              <>
                <Text style={m.label}>
                  <Feather name="trending-up" size={12} color={colors.status.success} /> Promised Deposit (UGX)
                </Text>
                <TextInput style={m.input} placeholder="e.g. 50000" placeholderTextColor={colors.text.muted} value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" />

                <Text style={m.label}>Lead Strength</Text>
                <View style={m.strengthRow}>
                  {(["hot", "warm", "cold"] as const).map((s) => {
                    const cfg = { hot: { color: "#ef4444", bg: "#fee2e2", label: "Hot" }, warm: { color: "#f59e0b", bg: "#fef3c7", label: "Warm" }, cold: { color: "#3b82f6", bg: "#eff6ff", label: "Cold" } }[s];
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[m.strengthChip, leadStrength === s && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => setLeadStrength(s)}
                      >
                        <View style={[m.strengthDot, { backgroundColor: cfg.color }]} />
                        <Text style={[m.strengthText, leadStrength === s && { color: cfg.color, fontWeight: "700" }]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Notes */}
            <Text style={m.label}>
              <Feather name="edit-3" size={12} color={colors.text.secondary} /> Call Notes
            </Text>
            <TextInput
              style={m.textarea}
              placeholder="Key discussion points, objections handled..."
              placeholderTextColor={colors.text.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Schedule callback */}
            <View style={m.switchRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="calendar" size={14} color={colors.text.secondary} />
                <Text style={m.switchLabel}>Schedule Follow-up</Text>
              </View>
              <Switch
                value={scheduleCallback}
                onValueChange={setScheduleCallback}
                trackColor={{ false: colors.border.default, true: colors.brand.green }}
              />
            </View>
            {notes && parseCallbackIntent(notes).shouldCreateCallback && !scheduleCallback && (
              <Text style={m.autoDetect}>↳ Callback auto-detected from notes</Text>
            )}

            {/* Save */}
            <TouchableOpacity
              style={[m.saveBtn, (!disposition || submitting) && { opacity: 0.5 }]}
              onPress={handleSaveOutcome}
              disabled={!disposition || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#fff" />
                  <Text style={m.saveBtnText}>Save Summary</Text>
                </>
              )}
            </TouchableOpacity>

            {!disposition && (
              <Text style={m.validationMsg}>Please select a call disposition to save</Text>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.default }]}>
      <Text style={{ fontSize: 14, color: colors.text.secondary }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.text.primary, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}

// Lead detail styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  header: { backgroundColor: colors.bg.card, alignItems: "center", paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  avatarLg: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700", color: colors.text.primary },
  phone: { fontSize: 15, color: colors.text.secondary, marginTop: 2 },
  badges: { flexDirection: "row", gap: 8, marginTop: 12 },
  callButton: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 16, borderRadius: 8, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  callText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logButton: { backgroundColor: colors.bg.card, marginHorizontal: 20, marginTop: 8, borderRadius: 8, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.brand.green },
  logText: { color: colors.brand.green, fontSize: 14, fontWeight: "700" },
  section: { backgroundColor: colors.bg.card, marginHorizontal: 20, marginTop: 16, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border.default },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  notesText: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
  dueDate: { fontSize: 12, color: colors.brand.green, fontWeight: "600", marginTop: 6 },
});

// Modal styles
const m = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default, backgroundColor: colors.bg.card },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text.primary },
  body: { flex: 1, backgroundColor: colors.bg.dashboard },
  leadContext: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.bg.card, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  leadContextAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  leadContextName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  leadContextPhone: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text.primary, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  dispGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10 },
  dispCard: { width: "47%", paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.bg.card, flexDirection: "row", alignItems: "center", gap: 10 },
  dispLabel: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  strengthRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10 },
  strengthChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card },
  strengthDot: { width: 8, height: 8, borderRadius: 4 },
  strengthText: { fontSize: 12, fontWeight: "600", color: colors.text.secondary },
  input: { backgroundColor: colors.bg.card, marginHorizontal: 20, borderRadius: 8, padding: 14, fontSize: 14, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default },
  textarea: { backgroundColor: colors.bg.card, marginHorizontal: 20, borderRadius: 8, padding: 14, fontSize: 14, color: colors.text.primary, minHeight: 100, borderWidth: 1, borderColor: colors.border.default },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg.card, marginHorizontal: 20, marginTop: 16, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: colors.border.default },
  switchLabel: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  autoDetect: { fontSize: 12, color: colors.brand.green, paddingHorizontal: 20, marginTop: 6 },
  saveBtn: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 24, borderRadius: 8, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  validationMsg: { fontSize: 12, color: colors.status.error, textAlign: "center", marginTop: 10 },
});
