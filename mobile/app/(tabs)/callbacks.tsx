import React from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePendingCallbacks } from "../../src/hooks/useCallbacks";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";
import { leadDisplayName } from "../../src/utils/leadDisplayName";

export default function CallbacksScreen() {
  const { data: callbacks, isLoading, refetch } = usePendingCallbacks();
  const queryClient = useQueryClient();

  const markDone = async (id: string) => {
    try {
      await api.patch(`/callbacks/${id}`, { status: "completed" });
      queryClient.invalidateQueries({ queryKey: ["callbacks"] });
    } catch { Alert.alert("Error", "Failed to update callback"); }
  };

  const isOverdue = (date: string) => new Date(date) < new Date();

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.brand.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={callbacks}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.brand.green} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 80 }}>
              <Feather name="check-circle" size={40} color={colors.status.success} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, color: colors.text.secondary, fontWeight: "600" }}>No pending callbacks</Text>
              <Text style={{ fontSize: 13, color: colors.text.muted, marginTop: 4 }}>You're all caught up</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, isOverdue(item.scheduled_for) && styles.cardOverdue]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{leadDisplayName(item.phone_number)}</Text>
                  <Text style={[styles.time, isOverdue(item.scheduled_for) && { color: colors.status.error }]}>
                    {isOverdue(item.scheduled_for) ? "OVERDUE — " : ""}
                    {new Date(item.scheduled_for).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={() => { const ph = item.phone_number.startsWith("+") ? item.phone_number : `+${item.phone_number}`; Linking.openURL(`tel:${ph}`); }}>
                  <Text style={styles.callBtnText}><Feather name="phone" size={13} color="#fff" /> Call</Text>
                </TouchableOpacity>
              </View>
              {item.notes && <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>}
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => Alert.alert("Mark as Done", `Complete callback for ${leadDisplayName(item.phone_number)}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Done", onPress: () => markDone(item.id) },
                ])}
              >
                <Text style={styles.doneBtnText}>Mark Completed</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  card: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border.default, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: colors.status.error },
  row: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  time: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  callBtn: { backgroundColor: colors.brand.green, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  callBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  notes: { fontSize: 13, color: colors.text.secondary, marginTop: 8 },
  doneBtn: { marginTop: 12, paddingVertical: 8, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border.default },
  doneBtnText: { color: colors.brand.green, fontWeight: "600", fontSize: 13 },
});
