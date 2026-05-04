import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  AppState,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";
import { useLead } from "../../src/hooks/useLeads";
import { useContactTimeline, useLogCall } from "../../src/hooks/useCrm";
import { ContactTimelineEvent } from "../../src/types";

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, isLoading: leadLoading } = useLead(id);
  const { data: timeline, isLoading: timelineLoading } = useContactTimeline(id);
  const logCallMutation = useLogCall();

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [callOutcome, setCallOutcome] = useState("connected");
  const [clientMood, setClientMood] = useState("neutral");
  const [reason, setReason] = useState("retention");
  const [result, setResult] = useState("promised_deposit");
  const [nextAction, setNextAction] = useState("Call Tomorrow");
  const [notes, setNotes] = useState("");

  // Track app state to show log form when returning from dialer
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && logCallMutation.isIdle) {
        // Potentially show log form here if we just initiated a call
        // For simplicity, we'll just trigger it manually via the Call button
      }
    });
    return () => subscription.remove();
  }, []);

  if (leadLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.dark} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text>Contact not found</Text>
      </View>
    );
  }

  const handleCall = () => {
    Linking.openURL(`tel:${lead.phone}`);
    setLogModalVisible(true);
  };

  const submitCallLog = async () => {
    await logCallMutation.mutateAsync({
      contact_id: id,
      phone_number: lead.phone,
      call_outcome: callOutcome,
      client_mood: clientMood,
      reason_for_contact: reason,
      result,
      next_action: nextAction,
      notes,
    });
    setLogModalVisible(false);
    // Reset form
    setNotes("");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: lead.name, headerBackTitle: "Back" }} />
      
      <ScrollView stickyHeaderIndices={[1]}>
        {/* Profile Summary */}
        <View style={styles.profileSummary}>
          <View style={styles.summaryHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{lead.name[0]}</Text>
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{lead.name}</Text>
              <Text style={styles.summaryPhone}>{lead.phone}</Text>
              <View style={styles.summaryTags}>
                <View style={[styles.badge, { backgroundColor: colors.brand.yellow }]}>
                  <Text style={styles.badgeText}>{lead.vip_level || lead.segment}</Text>
                </View>
                {lead.risk_status && (
                   <View style={[styles.badge, { backgroundColor: lead.risk_status === 'At Risk' ? colors.status.error : colors.status.warning }]}>
                    <Text style={[styles.badgeText, { color: '#fff' }]}>{lead.risk_status}</Text>
                   </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatItem label="Total Deposits" value={`UGX ${lead.total_deposits?.toLocaleString() || '0'}`} />
            <StatItem label="Last Deposit" value={lead.last_deposit_at ? new Date(lead.last_deposit_at).toLocaleDateString() : '—'} />
            <StatItem label="Last Login" value={lead.last_login_at ? new Date(lead.last_login_at).toLocaleDateString() : '—'} />
            <StatItem label="Fav Product" value={lead.favourite_game || lead.preferred_product || '—'} />
          </View>
        </View>

        {/* Action Buttons (Sticky) */}
        <View style={styles.actionToolbar}>
          <TouchableOpacity 
            style={[styles.mainActionBtn, { backgroundColor: colors.brand.green }]}
            onPress={handleCall}
          >
            <Feather name="phone" size={20} color="#fff" />
            <Text style={styles.mainActionText}>Call Now</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mainActionBtn, { backgroundColor: '#25D366' }]}
            onPress={() => router.push(`/contacts/${id}/chat`)}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.mainActionText}>WhatsApp Now</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Activity Timeline</Text>
          {timelineLoading ? (
            <ActivityIndicator size="small" color={colors.brand.dark} style={{ marginTop: 20 }} />
          ) : (
            timeline?.map((event: ContactTimelineEvent) => (
              <TimelineItem key={event.id} event={event} />
            ))
          )}
          {(!timeline || timeline.length === 0) && !timelineLoading && (
            <Text style={styles.emptyTimeline}>No recent activity</Text>
          )}
        </View>
      </ScrollView>

      {/* Call Log Modal */}
      <Modal visible={logModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Call Outcome</Text>
              <TouchableOpacity onPress={() => setLogModalVisible(false)}>
                <Feather name="x" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Outcome</Text>
              <View style={styles.pickerRow}>
                {['connected', 'no_answer', 'switched_off', 'wrong_number'].map((opt) => (
                  <TouchableOpacity 
                    key={opt}
                    style={[styles.pickerBtn, callOutcome === opt && styles.activePickerBtn]}
                    onPress={() => setCallOutcome(opt)}
                  >
                    <Text style={[styles.pickerBtnText, callOutcome === opt && styles.activePickerBtnText]}>{opt.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Client Mood</Text>
              <View style={styles.pickerRow}>
                {['positive', 'neutral', 'angry', 'confused'].map((opt) => (
                  <TouchableOpacity 
                    key={opt}
                    style={[styles.pickerBtn, clientMood === opt && styles.activePickerBtn]}
                    onPress={() => setClientMood(opt)}
                  >
                    <Text style={[styles.pickerBtnText, clientMood === opt && styles.activePickerBtnText]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Result</Text>
              <View style={styles.pickerRow}>
                {['converted', 'promised_deposit', 'needs_support', 'not_interested'].map((opt) => (
                  <TouchableOpacity 
                    key={opt}
                    style={[styles.pickerBtn, result === opt && styles.activePickerBtn]}
                    onPress={() => setResult(opt)}
                  >
                    <Text style={[styles.pickerBtnText, result === opt && styles.activePickerBtnText]}>{opt.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Add call notes..."
                value={notes}
                onChangeText={setNotes}
              />

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={submitCallLog}
                disabled={logCallMutation.isPending}
              >
                {logCallMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Log</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function TimelineItem({ event }: { event: ContactTimelineEvent }) {
  const iconName = event.event_type === 'call' ? 'phone' : event.event_type === 'whatsapp' ? 'message-circle' : 'activity';
  const iconColor = event.event_type === 'call' ? colors.brand.green : event.event_type === 'whatsapp' ? '#25D366' : colors.text.secondary;

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLine}>
        <View style={[styles.timelineIcon, { backgroundColor: iconColor + '20' }]}>
          <Feather name={iconName} size={14} color={iconColor} />
        </View>
        <View style={styles.timelineConnector} />
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>{event.title}</Text>
          <Text style={styles.timelineTime}>
            {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.timelineSummary}>{event.summary}</Text>
        {event.outcome && (
          <View style={styles.timelineOutcome}>
            <Text style={styles.outcomeLabel}>Outcome: </Text>
            <Text style={styles.outcomeValue}>{event.outcome}</Text>
          </View>
        )}
        {event.next_action && (
          <View style={styles.timelineNextAction}>
            <Text style={styles.nextActionLabel}>Next Action: </Text>
            <Text style={styles.nextActionValue}>{event.next_action}</Text>
          </View>
        )}
        <Text style={styles.timelineDate}>{new Date(event.created_at).toLocaleDateString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileSummary: { backgroundColor: colors.bg.card, padding: 20, paddingBottom: 25 },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  summaryInfo: { flex: 1 },
  summaryName: { fontSize: 20, fontWeight: "700", color: colors.text.primary },
  summaryPhone: { fontSize: 15, color: colors.text.secondary, marginTop: 2 },
  summaryTags: { flexDirection: "row", gap: 8, marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "800", color: colors.brand.dark },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: 15 },
  statItem: { width: "50%", marginBottom: 12 },
  statLabel: { fontSize: 11, color: colors.text.secondary, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  actionToolbar: { 
    flexDirection: "row", 
    padding: 12, 
    gap: 12, 
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  mainActionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mainActionText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  timelineSection: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text.primary, marginBottom: 20 },
  timelineItem: { flexDirection: "row", marginBottom: 0 },
  timelineLine: { alignItems: "center", width: 40 },
  timelineIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: colors.border.default, marginVertical: -5 },
  timelineContent: { flex: 1, paddingBottom: 25, paddingLeft: 10 },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  timelineTitle: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  timelineTime: { fontSize: 12, color: colors.text.secondary },
  timelineSummary: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
  timelineOutcome: { flexDirection: "row", marginTop: 6 },
  outcomeLabel: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  outcomeValue: { fontSize: 13, color: colors.brand.green, fontWeight: "600" },
  timelineNextAction: { flexDirection: "row", marginTop: 4 },
  nextActionLabel: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  nextActionValue: { fontSize: 13, color: colors.status.info, fontWeight: "600" },
  timelineDate: { fontSize: 11, color: colors.text.muted, marginTop: 8 },
  emptyTimeline: { textAlign: "center", marginTop: 40, color: colors.text.muted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  modalForm: { paddingBottom: 40 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: colors.text.primary, marginBottom: 10, marginTop: 15 },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg.muted, borderWidth: 1, borderColor: colors.border.default },
  activePickerBtn: { backgroundColor: colors.brand.dark, borderColor: colors.brand.dark },
  pickerBtnText: { fontSize: 13, color: colors.text.primary, fontWeight: "500", textTransform: "capitalize" },
  activePickerBtnText: { color: colors.brand.yellow },
  textArea: { backgroundColor: colors.bg.muted, borderRadius: 12, padding: 12, fontSize: 15, color: colors.text.primary, height: 100, textAlignVertical: "top", marginTop: 5 },
  submitBtn: { backgroundColor: colors.brand.green, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 30 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
