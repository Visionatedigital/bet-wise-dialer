import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUsers } from "../../src/hooks/useUsers";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";

type Filter = "pending" | "approved" | "all";

export default function ApproveAgentsScreen() {
  const { data: users, isLoading, refetch } = useUsers();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");

  const filtered = (users || []).filter((u) => {
    if (filter === "pending") return !u.approved;
    if (filter === "approved") return u.approved;
    return true;
  });

  const pendingCount = (users || []).filter((u) => !u.approved).length;

  const handleApprove = async (id: string, name: string) => {
    Alert.alert("Approve Agent", `Approve ${name || "this agent"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            await api.patch(`/users/${id}/approve`, { approved: true });
            queryClient.invalidateQueries({ queryKey: ["users"] });
          } catch {
            Alert.alert("Error", "Failed to approve agent");
          }
        },
      },
    ]);
  };

  const handleReject = async (id: string, name: string) => {
    Alert.alert("Reject Agent", `Reject ${name || "this agent"}? This will remove their account.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/users/${id}`);
            queryClient.invalidateQueries({ queryKey: ["users"] });
          } catch {
            Alert.alert("Error", "Failed to reject agent");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["pending", "approved", "all"] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "pending" ? `Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.brand.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.brand.green} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={filter === "pending" ? "check-circle" : "users"} size={40} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>
                {filter === "pending" ? "No pending requests" : "No agents found"}
              </Text>
              <Text style={styles.emptySub}>
                {filter === "pending" ? "All sign-up requests have been handled" : ""}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, item.approved && styles.avatarApproved]}>
                  <Text style={styles.avatarText}>
                    {(item.full_name || item.email || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.full_name || "No Name"}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                <View style={[styles.statusBadge, item.approved ? styles.approvedBadge : styles.pendingBadge]}>
                  <Text style={[styles.statusText, item.approved ? styles.approvedText : styles.pendingText]}>
                    {item.approved ? "Approved" : "Pending"}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Feather name="shield" size={12} color={colors.text.muted} />
                  <Text style={styles.metaText}>{item.role || "agent"}</Text>
                </View>
                {item.created_at && (
                  <View style={styles.metaItem}>
                    <Feather name="clock" size={12} color={colors.text.muted} />
                    <Text style={styles.metaText}>
                      {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                )}
              </View>

              {!item.approved && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(item.id, item.full_name || item.email)}
                  >
                    <Feather name="check" size={14} color="#fff" />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReject(item.id, item.full_name || item.email)}
                  >
                    <Feather name="x" size={14} color={colors.status.error} />
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  filterTabActive: { backgroundColor: colors.brand.dark, borderColor: colors.brand.dark },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  filterTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyTitle: { fontSize: 16, color: colors.text.secondary, fontWeight: "600", marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.text.muted, marginTop: 4 },
  card: { backgroundColor: colors.bg.card, borderRadius: 10, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border.default },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.text.muted, alignItems: "center", justifyContent: "center" },
  avatarApproved: { backgroundColor: colors.brand.green },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  email: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  approvedBadge: { backgroundColor: "#dcfce7" },
  pendingBadge: { backgroundColor: "#fef3c7" },
  statusText: { fontSize: 11, fontWeight: "700" },
  approvedText: { color: "#166534" },
  pendingText: { color: "#92400e" },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border.default },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.text.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand.green, paddingVertical: 11, borderRadius: 8 },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fee2e2", paddingVertical: 11, borderRadius: 8 },
  rejectBtnText: { color: colors.status.error, fontWeight: "700", fontSize: 13 },
});
