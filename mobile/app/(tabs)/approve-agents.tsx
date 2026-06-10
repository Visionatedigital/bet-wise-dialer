import React, { useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
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

  // Password modal state
  const [passwordModal, setPasswordModal] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const filtered = (users || []).filter((u) => {
    if (filter === "pending") return !u.approved;
    if (filter === "approved") return u.approved;
    return true;
  });

  const pendingCount = (users || []).filter((u) => !u.approved).length;
  const approvedCount = (users || []).filter((u) => u.approved).length;

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
    Alert.alert("Reject Agent", `Reject ${name || "this agent"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await api.patch(`/users/${id}/reject`, {});
            queryClient.invalidateQueries({ queryKey: ["users"] });
          } catch {
            Alert.alert("Error", "Failed to reject agent");
          }
        },
      },
    ]);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Delete Agent",
      `Permanently delete ${name || "this agent"}'s account? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/users/${id}`);
              queryClient.invalidateQueries({ queryKey: ["users"] });
            } catch {
              Alert.alert("Error", "Failed to delete agent");
            }
          },
        },
      ]
    );
  };

  const openPasswordModal = (id: string, name: string) => {
    setTargetUser({ id, name });
    setNewPassword("");
    setPasswordModal(true);
  };

  const handleChangePassword = async () => {
    if (!targetUser) return;
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post(`/users/${targetUser.id}/reset-password`, { new_password: newPassword });
      Alert.alert("Done", `Password updated for ${targetUser.name}`);
      setPasswordModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filter === "pending" && styles.filterTabActive]}
          onPress={() => setFilter("pending")}
        >
          <Text style={[styles.filterText, filter === "pending" && styles.filterTextActive]}>
            Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "approved" && styles.filterTabActive]}
          onPress={() => setFilter("approved")}
        >
          <Text style={[styles.filterText, filter === "approved" && styles.filterTextActive]}>
            All ({approvedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            Everyone
          </Text>
        </TouchableOpacity>
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
                    {item.approved ? "Active" : "Pending"}
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

              {/* Actions for PENDING agents */}
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

              {/* Actions for APPROVED agents */}
              {item.approved && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.passwordBtn}
                    onPress={() => openPasswordModal(item.id, item.full_name || item.email)}
                  >
                    <Feather name="key" size={14} color="#1d4ed8" />
                    <Text style={styles.passwordBtnText}>Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.id, item.full_name || item.email)}
                  >
                    <Feather name="trash-2" size={14} color="#fff" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Change Password Modal */}
      <Modal
        visible={passwordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSub}>
              Set a new password for{" "}
              <Text style={{ fontWeight: "700" }}>{targetUser?.name}</Text>
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min. 6 characters)"
              placeholderTextColor="#999"
              secureTextEntry={false}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPasswordModal(false)}
                disabled={savingPassword}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (newPassword.length < 6 || savingPassword) && { opacity: 0.5 }]}
                onPress={handleChangePassword}
                disabled={newPassword.length < 6 || savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="key" size={14} color="#fff" />
                    <Text style={styles.confirmBtnText}>Update Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
  },
  filterTabActive: { backgroundColor: colors.brand.dark, borderColor: colors.brand.dark },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  filterTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyTitle: { fontSize: 16, color: colors.text.secondary, fontWeight: "600", marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.text.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.bg.card, borderRadius: 10, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border.default,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.text.muted, alignItems: "center", justifyContent: "center",
  },
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
  metaRow: {
    flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border.default,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.text.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  approveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: colors.brand.green, paddingVertical: 11, borderRadius: 8,
  },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#fee2e2", paddingVertical: 11, borderRadius: 8,
  },
  rejectBtnText: { color: colors.status.error, fontWeight: "700", fontSize: 13 },
  passwordBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#dbeafe", paddingVertical: 11, borderRadius: 8,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  passwordBtnText: { color: "#1d4ed8", fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#ef4444", paddingVertical: 11, borderRadius: 8,
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
    alignSelf: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text.primary, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.text.secondary, marginBottom: 20 },
  modalInput: {
    backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: "#1a1a1a", marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border.default, alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: colors.text.secondary },
  confirmBtn: {
    flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#1d4ed8", paddingVertical: 13, borderRadius: 10,
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
