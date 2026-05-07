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
import { leadDisplayName } from "../../src/utils/leadDisplayName";
import { computeCooldown } from "../../src/utils/cooldown";
import { getCurrencyFromPhone } from "../../src/utils/formatCurrency";

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
    const cleanPhone = lead.phone.replace(/\s+/g, '');
    const phoneNumber = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
    Linking.openURL(`tel:${phoneNumber}`);
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
        status: disposition,
        duration_seconds: 0,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        notes: notes || null,
        campaign_id: lead.campaign_id || null,
      });

      await api.patch(`/leads/${lead.id}`, {
        status: disposition,
        last_activity: disposition,
        last_contact_at: new Date().toISOString(),
        ...(disposition === "interested" ? { lifecycle_stage: "interested" } : {}),
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

  const currency = lead ? getCurrencyFromPhone(lead.phone) : 'UGX';

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
      <Stack.Screen options={{ headerShown: true, title: leadDisplayName(lead.phone), headerStyle: { backgroundColor: colors.bg.card, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border.default }, headerTintColor: colors.text.primary, headerTitleStyle: { fontWeight: "700" } }} />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarLg}><Text style={styles.avatarText}>{leadDisplayName(lead.phone)[0].toUpperCase()}</Text></View>
          <Text style={styles.name}>{leadDisplayName(lead.phone)}</Text>
          <Text style={styles.phone}>{maskPhone(lead.phone)}</Text>
          <View style={styles.badges}>
            <StatusBadge label={lead.status || lead.last_activity || "unassigned"} />
            <StatusBadge label={lead.segment || "general"} />
            <StatusBadge label={lead.priority} />
          </View>
        </View>

        {(() => {
          const cd = computeCooldown(lead.last_contact_at, lead.last_activity || lead.status);
          if (cd.severity === "none") return null;
          return (
            <View style={[styles.cooldownBanner, { backgroundColor: cd.bg, borderColor: cd.color }]}>
              <Feather
                name={cd.severity === "strong" ? "alert-octagon" : cd.severity === "mild" ? "clock" : "check-circle"}
                size={14}
                color={cd.color}
              />
              <Text style={[styles.cooldownText, { color: cd.color }]}>{cd.message}</Text>
            </View>
          );
        })()}

        <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
          <Feather name="phone-outgoing" size={18} color="#fff" />
          <Text style={styles.callText}>Call {leadDisplayName(lead.phone)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logButton} onPress={() => setShowOutcome(true)} activeOpacity={0.8}>
          <Feather name="edit-3" size={16} color={colors.brand.green} />
          <Text style={styles.logText}>Log Call Outcome</Text>
        </TouchableOpacity>

        {/* ===== BETTING INTEL CARD ===== */}
        {(lead.trait || lead.lead_score != null || lead.lifetime_value != null || lead.betting_patterns != null || lead.deposit_count != null) ? (
          <>
            {/* Derive display tier from trait or lead_score */}
            {(() => {
              const score = lead.lead_score ?? lead.score ?? 0;
              const tier = lead.trait || (
                score >= 70 ? 'High Staker' :
                score >= 40 ? 'Medium Staker' :
                score >= 20 ? 'Frequent Bettor' :
                (lead.deposit_count ?? 0) > 0 ? 'Low Staker' : 'Dormant'
              );
              const tierColors: Record<string, { bg: string; border: string; iconBg: string; icon: string; iconColor: string; textColor: string }> = {
                'High Staker':    { bg: '#fef2f2', border: '#fecaca', iconBg: '#fee2e2', icon: 'award',      iconColor: '#dc2626', textColor: '#991b1b' },
                'Medium Staker':  { bg: '#fffbeb', border: '#fde68a', iconBg: '#fef3c7', icon: 'trending-up', iconColor: '#d97706', textColor: '#92400e' },
                'Frequent Bettor':{ bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', icon: 'activity',   iconColor: '#2563eb', textColor: '#1e40af' },
                'Dormant':        { bg: '#f9fafb', border: '#e5e7eb', iconBg: '#f3f4f6', icon: 'moon',       iconColor: '#6b7280', textColor: '#374151' },
                'Low Staker':     { bg: '#ecfdf5', border: '#a7f3d0', iconBg: '#dcfce7', icon: 'user',       iconColor: '#059669', textColor: '#065f46' },
              };
              const tc = tierColors[tier] || tierColors['Low Staker'];
              return (
                <View style={[styles.tierBanner, { backgroundColor: tc.bg, borderColor: tc.border }]}>
                  <View style={[styles.tierIcon, { backgroundColor: tc.iconBg }]}>
                    <Feather name={tc.icon as any} size={18} color={tc.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierTitle, { color: tc.textColor }]}>{tier}</Text>
                    <Text style={styles.tierSub}>
                      {lead.preferred_product ? `${lead.preferred_product} player` : lead.segment?.toUpperCase()} · Score {lead.lead_score ?? lead.score ?? '—'}/100
                    </Text>
                  </View>
                  {(lead.lead_score ?? lead.score) != null && (
                    <View style={[styles.scoreRing, {
                      borderColor: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444',
                    }]}>
                      <Text style={[styles.scoreNum, {
                        color: score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626',
                      }]}>{score}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Key Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {lead.betting_patterns?.deposit_usd ? `$${Number(lead.betting_patterns.deposit_usd).toLocaleString(undefined, {maximumFractionDigits: 0})}` : '—'}
                </Text>
                <Text style={styles.statLabel}>Deposited</Text>
              </View>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>
                  {lead.deposit_count ? Number(lead.deposit_count).toLocaleString() : '—'}
                </Text>
                <Text style={styles.statLabel}>Total Bets</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {lead.last_bet_date ? (() => {
                    const d = Math.floor((Date.now() - new Date(lead.last_bet_date).getTime()) / 86400000);
                    return d === 0 ? 'Today' : d < 30 ? `${d}d ago` : `${Math.floor(d/30)}mo ago`;
                  })() : '—'}
                </Text>
                <Text style={styles.statLabel}>Last Active</Text>
              </View>
            </View>

            {/* What They Play */}
            {lead.betting_patterns && (lead.betting_patterns.sports_bets > 0 || lead.betting_patterns.game_bets > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What They Play</Text>
                {lead.betting_patterns.sports_bets > 0 && (
                  <View style={styles.barRow}>
                    <View style={styles.barLabel}>
                      <Feather name="target" size={12} color="#059669" />
                      <Text style={styles.barLabelText}>Sports</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(100, Math.round((lead.betting_patterns.sports_bets / (lead.deposit_count || 1)) * 100))}%`, backgroundColor: '#10b981' }]} />
                    </View>
                    <Text style={styles.barCount}>{Number(lead.betting_patterns.sports_bets).toLocaleString()}</Text>
                  </View>
                )}
                {lead.betting_patterns.game_bets > 0 && (
                  <View style={styles.barRow}>
                    <View style={styles.barLabel}>
                      <Feather name="monitor" size={12} color="#6366f1" />
                      <Text style={styles.barLabelText}>Casino</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(100, Math.round((lead.betting_patterns.game_bets / (lead.deposit_count || 1)) * 100))}%`, backgroundColor: '#6366f1' }]} />
                    </View>
                    <Text style={styles.barCount}>{Number(lead.betting_patterns.game_bets).toLocaleString()}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Financial Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Financial Summary</Text>
              <InfoRow label={`Deposits (${currency})`} value={lead.lifetime_value ? `${currency} ${Number(lead.lifetime_value).toLocaleString()}` : '—'} />
              <InfoRow label="Deposits (USD)" value={lead.betting_patterns?.deposit_usd ? `$${Number(lead.betting_patterns.deposit_usd).toLocaleString()}` : '—'} />
              {(lead.betting_patterns?.total_bet_amount ?? 0) > 0 && (
                <InfoRow label="Total Wagered" value={`${currency} ${Number(lead.betting_patterns!.total_bet_amount).toLocaleString()}`} />
              )}
              {(lead.betting_patterns?.total_ggr ?? 0) > 0 && (
                <InfoRow label="GGR" value={`${currency} ${Number(lead.betting_patterns!.total_ggr).toLocaleString()}`} />
              )}
              <InfoRow label="Last Login" value={lead.last_bet_date ? new Date(lead.last_bet_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '—'} last />
            </View>
          </>
        ) : (
          /* Fallback for leads without betting data */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lead Info</Text>
            <InfoRow label="Segment" value={lead.segment || "—"} />
            <InfoRow label="Priority" value={lead.priority} />
            <InfoRow label="Score" value={lead.score?.toString() || "—"} />
            <InfoRow label="Last Deposit" value={lead.last_deposit_ugx ? `${currency} ${lead.last_deposit_ugx.toLocaleString()}` : "—"} last />
          </View>
        )}

        {/* Campaign & Assignment */}
        {(lead.campaign_name || lead.campaign || lead.next_action) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignment</Text>
            {(lead.campaign_name || lead.campaign) && (
              <InfoRow label="Campaign" value={lead.campaign_name || lead.campaign || "—"} />
            )}
            {lead.next_action && (
              <>
                <InfoRow label="AI Strategy" value={lead.next_action} />
                {lead.next_action_due && (
                  <InfoRow label="Due" value={new Date(lead.next_action_due).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                )}
              </>
            )}
            {lead.last_activity && lead.last_activity !== 'unassigned' && (
              <InfoRow label="Last Disposition" value={lead.last_activity.replace(/_/g, ' ')} last />
            )}
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
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{leadDisplayName(lead.phone)[0]}</Text>
              </View>
              <View>
                <Text style={m.leadContextName}>{leadDisplayName(lead.phone)}</Text>
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
                  <Feather name="trending-up" size={12} color={colors.status.success} /> Promised Deposit ({currency})
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
  cooldownBanner: { marginHorizontal: 20, marginTop: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  cooldownText: { fontSize: 12, fontWeight: "600", flex: 1 },
  callButton: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 16, borderRadius: 8, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  callText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  logButton: { backgroundColor: colors.bg.card, marginHorizontal: 20, marginTop: 8, borderRadius: 8, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.brand.green },
  logText: { color: colors.brand.green, fontSize: 14, fontWeight: "700" },
  // Tier banner
  tierBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginTop: 16, borderRadius: 12, padding: 14, borderWidth: 1 },
  tierIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tierTitle: { fontSize: 16, fontWeight: "800" },
  tierSub: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  scoreRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg.card },
  scoreNum: { fontSize: 16, fontWeight: "800" },

  // Stats grid
  statsGrid: { flexDirection: "row", marginHorizontal: 20, marginTop: 12, backgroundColor: colors.bg.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default, overflow: "hidden" },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border.default },
  statValue: { fontSize: 16, fontWeight: "800", color: colors.text.primary },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 },

  // Bar chart rows
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  barLabel: { flexDirection: "row", alignItems: "center", gap: 6, width: 70 },
  barLabelText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  barTrack: { flex: 1, height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barCount: { fontSize: 12, fontWeight: "700", color: colors.text.primary, width: 50, textAlign: "right" },
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
