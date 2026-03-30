import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/theme/colors";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.full_name || user?.email || "?")[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name || "Agent"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Row label="App Version" value="1.0.0 (MVP)" />
        <Row label="Platform" value="Mobile" />
        <Row label="Status" value="Online" valueColor={colors.status.success} last />
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() =>
          Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
          ])
        }
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[rowStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  label: { fontSize: 14, color: colors.text.secondary },
  value: { fontSize: 14, color: colors.text.primary, fontWeight: "500" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  profileCard: { backgroundColor: colors.bg.card, margin: 16, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border.default, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "700", color: colors.text.primary },
  email: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  roleBadge: { backgroundColor: colors.bg.accent, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  roleText: { color: colors.brand.green, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  section: { backgroundColor: colors.bg.card, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border.default },
  logoutBtn: { marginHorizontal: 16, marginTop: 24, borderRadius: 8, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.status.error },
  logoutText: { color: colors.status.error, fontSize: 15, fontWeight: "600" },
});
