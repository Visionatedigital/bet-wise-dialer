import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import { colors } from "../theme/colors";

export function CrmDashboard() {
  const { user } = useAuth();
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

  const openWhatsApp = (phone: string, name: string, segment: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const msg = segment === 'vip' 
      ? `Hi ${name.split(' ')[0]}, this is your VIP Manager from Bangbet. We have exclusive odds for you this weekend!` 
      : `Hi ${name.split(' ')[0]}, checking in from Bangbet! How has your betting experience been lately?`;
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`);
  };

  const openPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchLeads} tintColor={colors.brand.green} />}
    >
      <Text style={styles.sectionTitle}>Smart CRM Insights</Text>
      
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: colors.brand.green, borderLeftWidth: 4 }]}>
          <Text style={styles.statValue}>{leads.length}</Text>
          <Text style={styles.statLabel}>Total Clients</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: "#f59e0b", borderLeftWidth: 4 }]}>
          <Text style={styles.statValue}>{leads.filter(l => l.segment === 'vip').length}</Text>
          <Text style={styles.statLabel}>VIPs</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Client List</Text>

      {leads.length === 0 && !loading ? (
        <View style={styles.emptyBox}>
          <Feather name="users" size={24} color={colors.text.muted} />
          <Text style={styles.emptyText}>No clients assigned to you yet.</Text>
        </View>
      ) : (
        leads.map((lead) => (
          <View key={lead.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.leadName}>{lead.name}</Text>
                <Text style={styles.leadPhone}>{lead.phone}</Text>
              </View>
              {lead.segment === 'vip' && (
                <View style={styles.vipBadge}>
                  <Feather name="star" size={10} color="#b45309" />
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
            </View>
            
            <View style={styles.insightBox}>
              <Feather name="cpu" size={14} color={colors.brand.green} />
              <Text style={styles.insightText}>
                {lead.segment === 'vip' 
                  ? "High-value client. Recommend a courtesy call to build relationship." 
                  : lead.segment === 'dormant' 
                  ? "Client is dormant. Send a WhatsApp re-engagement message." 
                  : "Active client. Follow up on recent betting activity."}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openPhone(lead.phone)}>
                <Feather name="phone" size={14} color={colors.text.primary} />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={() => openWhatsApp(lead.phone, lead.name, lead.segment)}>
                <Feather name="message-circle" size={14} color="#fff" />
                <Text style={[styles.actionText, { color: "#fff" }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 12, marginHorizontal: 20 },
  statCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: 8, padding: 16, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.text.primary },
  statLabel: { fontSize: 11, color: colors.text.muted, fontWeight: "600", textTransform: "uppercase", marginTop: 4 },
  emptyBox: { backgroundColor: colors.bg.card, marginHorizontal: 20, borderRadius: 8, padding: 30, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  emptyText: { fontSize: 14, color: colors.text.secondary, marginTop: 10 },
  card: { backgroundColor: colors.bg.card, marginHorizontal: 20, marginBottom: 12, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: colors.border.default },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  leadName: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  leadPhone: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  vipBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  vipText: { fontSize: 10, fontWeight: "700", color: "#b45309" },
  insightBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#f0fdf4", padding: 10, borderRadius: 8, marginBottom: 16 },
  insightText: { flex: 1, fontSize: 12, color: "#166534", lineHeight: 18 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: "#f1f5f9" },
  waBtn: { backgroundColor: "#25D366" },
  actionText: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
});
