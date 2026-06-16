import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, ActivityIndicator, Modal, TextInput, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "../../src/api/client";

export default function LeadProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [noReplyModalVisible, setNoReplyModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [agentNote, setAgentNote] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [whatsappReason, setWhatsappReason] = useState("VIP Check-in");
  const [suggestedMessage, setSuggestedMessage] = useState("");

  useEffect(() => {
    fetchLeadDetails();
  }, [id]);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      // Fetch lead info
      const leadRes = await api.get<any>(`/leads/${id}`);
      setLead(leadRes);

      // Fetch activity timeline (mocking for now if endpoint doesn't exist, but usually we have it)
      try {
        const activityRes = await api.get<any[]>(`/crm/contacts/${id}/timeline`);
        setActivities(activityRes || []);
      } catch (err) {
        setActivities([]);
      }
    } catch (err) {
      console.log("Failed to fetch lead details", err);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = async () => {
    if (!lead) return;
    const cleanPhone = lead.phone.replace(/\D/g, "");
    const url = `https://wa.me/${cleanPhone}`;
    
    try {
      // Log session start in background
      await api.post("/crm/activities/whatsapp/start", {
        lead_id: lead.id,
        phone_number: lead.phone,
        reason_for_contact: "Direct WhatsApp Contact",
        suggested_message: "",
        final_message: ""
      });
      await Linking.openURL(url);
      fetchLeadDetails();
    } catch (err) {
      console.log("Error opening WhatsApp", err);
    }
  };



  const openPhone = () => {
    if (!lead) return;
    const cleanPhone = lead.phone.replace(/\s+/g, '');
    const ph = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
    Linking.openURL(`tel:${ph}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.errorContainer}>
        <Text>Lead not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#22c55e", marginTop: 10 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.headerAccent} />
          
          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Client Profile</Text>
            <TouchableOpacity style={styles.moreBtn}>
              <Feather name="more-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Profile Card - Compact Redesign */}
          <View style={styles.profileCard}>
            <View style={[styles.profileImage, { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }]}>
              <Feather name="user" size={32} color="#94a3b8" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{lead.name}</Text>
              <View style={styles.badgeRow}>
                {lead.segment === 'vip' && (
                  <View style={styles.vipBadge}>
                    <Feather name="star" size={10} color="#000" />
                    <Text style={styles.vipBadgeText}>VIP</Text>
                  </View>
                )}
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
              <Text style={styles.phoneText}>{lead.phone}</Text>

              {/* Compact detail grid */}
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Last Login</Text>
                  <Text style={styles.detailValue}>{lead.last_login_at ? new Date(lead.last_login_at).toLocaleDateString() : 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Total Dep.</Text>
                  <Text style={styles.detailValue}>{lead.total_deposits ? `${Number(lead.total_deposits).toLocaleString()} UGX` : '0'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={openPhone}>
            <View style={[styles.actionIconBox, { backgroundColor: "#f8fafc" }]}>
              <Feather name="phone" size={20} color="#1e293b" />
            </View>
            <Text style={styles.actionBtnText}>Call Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn} onPress={openWhatsApp}>
            <View style={[styles.actionIconBox, { backgroundColor: "#dcfce7" }]}>
              <Feather name="message-circle" size={20} color="#166534" />
            </View>
            <Text style={styles.actionBtnText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setLogModalVisible(true)}>
            <View style={[styles.actionIconBox, { backgroundColor: "#fef9c3" }]}>
              <Feather name="plus-circle" size={20} color="#854d0e" />
            </View>
            <Text style={styles.actionBtnText}>Log Activity</Text>
          </TouchableOpacity>
        </View>



        {/* Activity Timeline */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={18} color="#64748b" />
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
          </View>
          
          <View style={styles.timeline}>
            {activities.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No activity logged yet. Start by calling or logging a WhatsApp conversation.</Text>
                <View style={styles.emptyStateActions}>
                  <TouchableOpacity style={styles.emptyStateBtn} onPress={openPhone}>
                    <Text style={styles.emptyStateBtnText}>Call Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.emptyStateBtn} onPress={openWhatsApp}>
                    <Text style={styles.emptyStateBtnText}>WhatsApp Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.emptyStateBtn, { backgroundColor: '#f1f5f9' }]} onPress={() => setLogModalVisible(true)}>
                    <Text style={[styles.emptyStateBtnText, { color: '#475569' }]}>Log Activity</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              activities.map((item, index) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, { 
                      backgroundColor: item.activity_type === 'outgoing_call' || item.activity_type === 'incoming_call' ? '#eff6ff' : item.activity_type?.includes('whatsapp') ? '#f0fdf4' : '#fffbeb' 
                    }]}>
                      <Feather 
                        name={item.activity_type?.includes('call') ? 'phone' : item.activity_type?.includes('whatsapp') ? 'message-circle' : 'file-text'} 
                        size={14} 
                        color={item.activity_type?.includes('call') ? '#1e40af' : item.activity_type?.includes('whatsapp') ? '#166534' : '#854d0e'} 
                      />
                    </View>
                    {index !== activities.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineRight}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineTitle}>{item.title}</Text>
                      <Text style={styles.timelineDate}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={styles.timelineNote}>{item.summary}</Text>
                    {item.sentiment && (
                      <View style={[styles.moodBadge, { backgroundColor: item.sentiment === 'positive' ? '#dcfce7' : '#f1f5f9' }]}>
                        <Text style={[styles.moodText, { color: item.sentiment === 'positive' ? '#166534' : '#64748b' }]}>
                          Mood: {item.sentiment}
                        </Text>
                      </View>
                    )}
                    {item.suggested_reply && (
                      <TouchableOpacity style={styles.timelineActionBtn}>
                        <Text style={styles.timelineActionBtnText}>Send Suggested Reply</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>



      {/* Log Activity Modal */}
      <Modal visible={logModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Activity</Text>
            
            {selectedActivity ? (
              <View>
                <TouchableOpacity onPress={() => setSelectedActivity(null)} style={styles.backLink}>
                  <Text style={styles.backLinkText}>← Change Activity Type</Text>
                </TouchableOpacity>
                
                <Text style={styles.inputLabel}>Paste Client Reply (Optional)</Text>
                <TextInput 
                  style={styles.textArea} 
                  multiline 
                  value={pastedText}
                  onChangeText={setPastedText}
                  placeholder="Paste what the client said..."
                />

                <Text style={styles.inputLabel}>Agent Notes</Text>
                <TextInput 
                  style={styles.noteInput} 
                  value={agentNote}
                  onChangeText={setAgentNote}
                  placeholder="e.g. Promised to deposit tonight"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.confirmBtn, aiAnalyzing && { opacity: 0.5 }]} 
                    disabled={aiAnalyzing}
                    onPress={async () => {
                      setAiAnalyzing(true);
                      try {
                        const analysis = await api.post<any>("/crm/activities/analyze", {
                          lead_id: lead.id,
                          pasted_text: pastedText,
                          agent_notes: agentNote,
                          activity_type: selectedActivity
                        });
                        
                        await api.post("/crm/activities/log", {
                          lead_id: lead.id,
                          activity_type: selectedActivity,
                          ...analysis
                        });
                        
                        setLogModalVisible(false);
                        setSelectedActivity(null);
                        setPastedText("");
                        setAgentNote("");
                        fetchLeadDetails();
                      } finally {
                        setAiAnalyzing(false);
                      }
                    }}
                  >
                    <Text style={styles.confirmBtnText}>{aiAnalyzing ? "Analyzing..." : "Analyze & Save"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.activityGrid}>
                {[
                  { id: 'whatsapp_reply', name: 'WhatsApp Reply', icon: 'message-circle' },
                  { id: 'incoming_call', name: 'Incoming Call', icon: 'phone-incoming' },
                  { id: 'outgoing_call', name: 'Outgoing Call', icon: 'phone-outgoing' },
                  { id: 'no_reply', name: 'No Reply', icon: 'slash' },
                  { id: 'manual_note', name: 'Manual Note', icon: 'file-text' }
                ].map(act => (
                  <TouchableOpacity 
                    key={act.id} 
                    style={styles.activityBox}
                    onPress={() => setSelectedActivity(act.id)}
                  >
                    <Feather name={act.icon as any} size={24} color="#064e3b" />
                    <Text style={styles.activityBoxText}>{act.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setLogModalVisible(false)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffef0", // Premium light yellow background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    position: 'relative',
    backgroundColor: "#064e3b",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 15,
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#064e3b",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 5,
    backgroundColor: 'transparent',
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    marginBottom: 10,
  },
  profileInfo: {
    marginLeft: 15,
    flex: 1,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  vipBadge: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vipBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  phoneText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 15,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiInsightCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderLeftWidth: 6,
    borderLeftColor: '#22c55e',
  },
  aiInsightText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '500',
  },
  aiTag: {
    marginTop: 12,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  timeline: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 16,
  },
  timelineLeft: {
    alignItems: 'center',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 24,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  timelineDate: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  timelineNote: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  timelineAmount: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
    marginTop: 2,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  detailItem: {
    width: '50%',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginTop: 1,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateActions: {
    width: '100%',
    gap: 10,
  },
  emptyStateBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reasonChipActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#fff',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#1e293b',
  },
  noteInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#064e3b',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  activityBox: {
    width: '46%',
    backgroundColor: '#f0fdf4',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  activityBoxText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#064e3b',
  },
  backLink: {
    marginBottom: 16,
  },
  backLinkText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 14,
  },
  moodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timelineActionBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    alignSelf: 'flex-start',
  },
  timelineActionBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  }
});
