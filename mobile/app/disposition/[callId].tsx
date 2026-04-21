import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { parseCallbackIntent } from "../../src/utils/parseCallbackIntent";
import { colors } from "../../src/theme/colors";
import { leadDisplayName } from "../../src/utils/leadDisplayName";

const DISPOSITIONS = [
  { value: "interested", label: "Interested", color: colors.status.success, bg: "#dcfce7" },
  { value: "not_interested", label: "Not Interested", color: colors.status.error, bg: "#fee2e2" },
  { value: "no_answer", label: "No Answer", color: "#d97706", bg: "#fef3c7" },
  { value: "unreachable", label: "Unreachable", color: colors.text.secondary, bg: "#f3f4f6" },
  { value: "answered_no_response", label: "Answered-No Response", color: "#7c3aed", bg: "#ede9fe" },
];

export default function DispositionScreen() {
  const params = useLocalSearchParams<{ callId: string; leadId: string; leadName: string; phone: string; campaignId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [scheduleCallback, setScheduleCallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!disposition) { Alert.alert("Required", "Please select a call outcome"); return; }
    setSubmitting(true);
    try {
      await api.post("/call-activities", { phone_number: params.phone, lead_name: params.leadName, call_type: "native_dialer", status: disposition, duration_seconds: 0, deposit_amount: depositAmount ? Number(depositAmount) : null, notes: notes || null, campaign_id: params.campaignId || null });
      if (params.leadId) await api.patch(`/leads/${params.leadId}`, { status: disposition, last_activity: disposition, last_contact_at: new Date().toISOString(), ...(disposition === "interested" ? { lifecycle_stage: "interested" } : {}) });
      const cbIntent = parseCallbackIntent(notes);
      if (scheduleCallback || cbIntent.shouldCreateCallback) {
        const cbDate = cbIntent.callbackDate || new Date(Date.now() + 86400000);
        await api.post("/callbacks", { lead_name: params.leadName, phone_number: params.phone, notes: notes || `Follow up after ${disposition.replace(/_/g, " ")} call`, scheduled_for: cbDate.toISOString() });
      }
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["callbacks"] });
      Alert.alert("Saved", "Call outcome logged successfully", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert("Error", err.message || "Failed to save"); } finally { setSubmitting(false); }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Log Outcome", headerStyle: { backgroundColor: colors.bg.card, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border.default }, headerTintColor: colors.text.primary, headerTitleStyle: { fontWeight: "700" } }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.leadInfo}>
          <View style={styles.leadAvatar}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{leadDisplayName(params.phone)[0].toUpperCase()}</Text></View>
          <Text style={styles.leadName}>{leadDisplayName(params.phone)}</Text>
          <Text style={styles.leadPhone}>{params.phone}</Text>
        </View>

        <Text style={styles.sectionTitle}>Call Outcome *</Text>
        <View style={styles.grid}>
          {DISPOSITIONS.map((d) => (
            <TouchableOpacity key={d.value} style={[styles.dispOption, disposition === d.value && { backgroundColor: d.bg, borderColor: d.color }]} onPress={() => setDisposition(d.value)}>
              <View style={[styles.dispDot, { backgroundColor: disposition === d.value ? d.color : colors.border.default }]} />
              <Text style={[styles.dispText, disposition === d.value && { color: d.color, fontWeight: "700" }]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput style={styles.notesInput} placeholder="Add notes about the call..." placeholderTextColor={colors.text.muted} value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" />

        {disposition === "interested" && (
          <>
            <Text style={styles.sectionTitle}>Promised Deposit (UGX)</Text>
            <TextInput style={styles.input} placeholder="e.g. 50000" placeholderTextColor={colors.text.muted} value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" />
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Schedule Follow-up</Text>
          <Switch value={scheduleCallback} onValueChange={setScheduleCallback} trackColor={{ false: colors.border.default, true: colors.brand.green }} />
        </View>
        {notes && parseCallbackIntent(notes).shouldCreateCallback && !scheduleCallback && (
          <Text style={styles.autoDetect}>↳ Callback auto-detected from notes</Text>
        )}

        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Call Outcome</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  leadInfo: { backgroundColor: colors.bg.card, padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border.default },
  leadAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  leadName: { fontSize: 19, fontWeight: "700", color: colors.text.primary },
  leadPhone: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10 },
  dispOption: { width: "47%", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card, flexDirection: "row", alignItems: "center", gap: 10 },
  dispDot: { width: 12, height: 12, borderRadius: 6 },
  dispText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  notesInput: { backgroundColor: colors.bg.card, marginHorizontal: 20, borderRadius: 8, padding: 14, fontSize: 14, color: colors.text.primary, minHeight: 100, borderWidth: 1, borderColor: colors.border.default },
  input: { backgroundColor: colors.bg.card, marginHorizontal: 20, borderRadius: 8, padding: 14, fontSize: 14, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.default },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.bg.card, marginHorizontal: 20, marginTop: 20, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: colors.border.default },
  switchLabel: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  autoDetect: { fontSize: 12, color: colors.brand.green, paddingHorizontal: 20, marginTop: 6 },
  submitBtn: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 24, borderRadius: 8, paddingVertical: 15, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
