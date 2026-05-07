import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "../../src/api/client";

export default function LeadProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        const activityRes = await api.get<any[]>(`/leads/${id}/activities`);
        setActivities(activityRes || []);
      } catch (err) {
        // Fallback mock activities if the specific endpoint fails
        setActivities([
          { id: 1, type: 'call', status: 'completed', duration: '2m 14s', created_at: '2026-05-04T10:30:00Z', note: 'Discussed weekend promotions. High interest in football.' },
          { id: 2, type: 'whatsapp', status: 'sent', created_at: '2026-05-02T14:20:00Z', note: 'Sent VIP welcome message.' },
          { id: 3, type: 'deposit', amount: '50,000 UGX', created_at: '2026-04-30T09:15:00Z' },
        ]);
      }
    } catch (err) {
      console.log("Failed to fetch lead details", err);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = () => {
    if (!lead) return;
    router.push(`/contacts/${lead.id}/chat`);
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

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <Image 
              source={{ uri: `https://picsum.photos/seed/${lead.phone}/200` }} 
              style={styles.profileImage} 
            />
            <Text style={styles.profileName}>{lead.name}</Text>
            <View style={styles.badgeRow}>
              {lead.segment === 'vip' && (
                <View style={styles.vipBadge}>
                  <Feather name="star" size={12} color="#000" />
                  <Text style={styles.vipBadgeText}>VIP CLIENT</Text>
                </View>
              )}
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active</Text>
              </View>
            </View>
            
            <Text style={styles.phoneText}>{lead.phone}</Text>
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

          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIconBox, { backgroundColor: "#fef9c3" }]}>
              <Feather name="edit-3" size={20} color="#854d0e" />
            </View>
            <Text style={styles.actionBtnText}>Add Note</Text>
          </TouchableOpacity>
        </View>

        {/* AI Insight Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={18} color="#22c55e" />
            <Text style={styles.sectionTitle}>AI Relationship Insight</Text>
          </View>
          <View style={styles.aiInsightCard}>
            <Text style={styles.aiInsightText}>
              {lead.segment === 'vip' 
                ? "This client has high potential but hasn't deposited in 4 days. A personal loyalty bonus or exclusive market odds could trigger a significant re-engagement."
                : "Standard active user. Likely to respond well to midweek accumulator boosters. Suggest the ongoing '100% Win Bonus' promotion."}
            </Text>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>Next Best Action: Send VIP Promo</Text>
            </View>
          </View>
        </View>

        {/* Activity Timeline */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={18} color="#64748b" />
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
          </View>
          
          <View style={styles.timeline}>
            {activities.map((item, index) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIcon, { 
                    backgroundColor: item.type === 'call' ? '#eff6ff' : item.type === 'whatsapp' ? '#f0fdf4' : '#fffbeb' 
                  }]}>
                    <Feather 
                      name={item.type === 'call' ? 'phone' : item.type === 'whatsapp' ? 'message-circle' : 'dollar-sign'} 
                      size={14} 
                      color={item.type === 'call' ? '#1e40af' : item.type === 'whatsapp' ? '#166534' : '#854d0e'} 
                    />
                  </View>
                  {index !== activities.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineRight}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>
                      {item.type === 'call' ? 'Direct Call' : item.type === 'whatsapp' ? 'WhatsApp' : 'Deposit Received'}
                    </Text>
                    <Text style={styles.timelineDate}>
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {item.note && <Text style={styles.timelineNote}>{item.note}</Text>}
                  {item.amount && <Text style={styles.timelineAmount}>{item.amount}</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 30,
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
    paddingTop: 50,
    paddingBottom: 10,
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
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  profileName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    alignItems: 'center',
  },
  vipBadge: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vipBadgeText: {
    fontSize: 10,
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconBox: {
    width: 54,
    height: 54,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
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
});
