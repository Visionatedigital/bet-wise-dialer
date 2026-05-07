import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme/colors";

export function CrmDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Fallback for custom API client
      const res = await api.get<{ leads: any[] } | any[]>(`/leads?user_id=${user?.id}`);
      
      const data = Array.isArray(res) ? res : (res.leads || []);
      
      // Sort VIPs first
      const formatted = data.sort((a, b) => {
        if (a.segment === 'vip' && b.segment !== 'vip') return -1;
        if (a.segment !== 'vip' && b.segment === 'vip') return 1;
        return (b.score || 0) - (a.score || 0);
      });
      
      setLeads(formatted);
    } catch (err) {
      console.log("Failed to fetch CRM leads", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [user]);

  const openWhatsApp = (id: string) => {
    router.push(`/contacts/${id}/chat`);
  };

  const openPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const ph = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
    Linking.openURL(`tel:${ph}`);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: "#fffef0" }]} // Ultra light company yellow
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchLeads} tintColor="#22c55e" />}
    >
      <View style={{ marginTop: 20 }} />
      
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#166534" }]}>
          <View style={styles.statIconBox}>
            <Feather name="users" size={16} color="#ffffff" />
          </View>
          <Text style={[styles.statValue, { color: "#ffffff" }]}>{leads.length}</Text>
          <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.6)" }]}>Clients</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#FFE600" }]}>
          <View style={[styles.statIconBox, { backgroundColor: "rgba(0,0,0,0.1)" }]}>
            <Feather name="star" size={16} color="#333" />
          </View>
          <Text style={[styles.statValue, { color: "#333" }]}>{leads.filter(l => l.segment === 'vip').length}</Text>
          <Text style={[styles.statLabel, { color: "rgba(0,0,0,0.5)" }]}>VIP Tier</Text>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Prioritized Portfolio</Text>
        <TouchableOpacity onPress={fetchLeads} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={12} color="#22c55e" />
          <Text style={[styles.refreshText, { color: "#22c55e" }]}>Sync</Text>
        </TouchableOpacity>
      </View>

      {leads.length === 0 && !loading ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconCircle}>
            <Feather name="user-plus" size={32} color="#d6d3d1" />
          </View>
          <Text style={styles.emptyTitle}>No clients found</Text>
          <Text style={styles.emptyText}>Import high-value leads to start managing relationships.</Text>
        </View>
      ) : (
        leads.map((lead) => (
          <TouchableOpacity 
            key={lead.id} 
            style={styles.compactCard}
            onPress={() => router.push(`/crm-lead/${lead.id}`)}
          >
            {/* Round Avatar with Status Indicator */}
            <View style={styles.avatarWrapper}>
              <Image 
                source={{ uri: `https://picsum.photos/seed/${lead.phone}/100` }} 
                style={styles.avatar} 
              />
              <View style={[styles.statusIndicator, { backgroundColor: lead.segment === 'vip' ? "#FFE600" : "#22c55e" }]} />
            </View>

            {/* Lead Content */}
            <View style={styles.leadInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.leadName} numberOfLines={1}>{lead.name}</Text>
                {lead.segment === 'vip' && (
                  <View style={styles.vipMiniTag}>
                    <Text style={styles.vipMiniTagText}>VIP</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.activityLabel}>
                Last seen: <Text style={{ fontWeight: '700' }}>{lead.lastActivity || 'Yesterday'}</Text>
              </Text>

              <View style={styles.aiRecommendation}>
                <Feather name="zap" size={10} color="#166534" style={{ marginTop: 2 }} />
                <Text style={styles.aiRecommendationText}>
                  {lead.segment === 'vip' ? "Exclusive VIP courtesy call recommended" : "Re-engage via personalized WhatsApp bonus"}
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity onPress={() => openWhatsApp(lead.id)} style={styles.actionIcon}>
                <Feather name="message-circle" size={18} color="#22c55e" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openPhone(lead.phone)} style={[styles.actionIcon, { marginTop: 10 }]}>
                <Feather name="phone" size={18} color="#475569" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 12, marginHorizontal: 20 },
  statCard: { flex: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  statIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 20, marginTop: 25, marginBottom: 12 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  refreshText: { fontSize: 12, fontWeight: "700", color: "#22c55e" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: 1 },
  emptyBox: { backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 30, padding: 40, alignItems: "center", borderStyle: "dashed", borderWidth: 2, borderColor: "#cbd5e1" },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 },
  
  // Compact Card Styles
  compactCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f1f5f9',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  leadInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 6,
  },
  vipMiniTag: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  vipMiniTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
  },
  activityLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  aiRecommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  aiRecommendationText: {
    flex: 1,
    fontSize: 10,
    color: '#166534',
    fontWeight: '600',
    lineHeight: 14,
  },
  quickActions: {
    marginLeft: 10,
    alignItems: 'center',
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
});
