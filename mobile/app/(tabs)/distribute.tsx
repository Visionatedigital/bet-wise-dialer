import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useDistributionStats, useAgentsAvailable } from "../../src/hooks/useDistribution";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/theme/colors";

function parseCSVNumbers(text: string): string[] {
  // Handle CSV with headers or plain number lists
  const lines = text.split(/[\r\n]+/).filter((l) => l.trim());
  const numbers: string[] = [];

  for (const line of lines) {
    // Split by comma, semicolon, or tab
    const parts = line.split(/[,;\t]/);
    for (const part of parts) {
      const cleaned = part.replace(/[^0-9+]/g, "").trim();
      if (cleaned.length >= 7) {
        numbers.push(cleaned);
      }
    }
  }

  return [...new Set(numbers)];
}

export default function DistributeScreen() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDistributionStats();
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useAgentsAvailable();
  const queryClient = useQueryClient();
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [distributing, setDistributing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);

  const isLoading = statsLoading || agentsLoading;

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!agents) return;
    if (selectedAgents.length === agents.length) {
      setSelectedAgents([]);
    } else {
      setSelectedAgents(agents.map((a) => a.id));
    }
  };

  const handlePickCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "text/comma-separated-values", "application/csv", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.uri) return;

      const content = await FileSystem.readAsStringAsync(file.uri);
      const numbers = parseCSVNumbers(content);

      if (numbers.length === 0) {
        Alert.alert("No Numbers Found", "Could not find valid phone numbers in the file. Make sure numbers are at least 7 digits.");
        return;
      }

      setParsedNumbers(numbers);
      Alert.alert(
        "Numbers Found",
        `Found ${numbers.length} unique phone numbers in "${file.name}". Select agents below and tap "Upload & Distribute" to import them.`
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to read file");
    }
  };

  const handleUploadAndDistribute = async () => {
    if (parsedNumbers.length === 0) {
      Alert.alert("No File", "Please pick a CSV file first.");
      return;
    }
    if (selectedAgents.length === 0) {
      Alert.alert("Select Agents", "Please select at least one agent to distribute the numbers to.");
      return;
    }

    Alert.alert(
      "Upload & Distribute",
      `Import ${parsedNumbers.length} numbers and distribute evenly to ${selectedAgents.length} agent${selectedAgents.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload",
          onPress: async () => {
            setUploading(true);
            try {
              const res = await api.post<{ message: string; imported: number; duplicates: number; distributed: number }>(
                "/leads/import-csv",
                { numbers: parsedNumbers, distribute_to: selectedAgents }
              );
              queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
              queryClient.invalidateQueries({ queryKey: ["agents-available"] });
              queryClient.invalidateQueries({ queryKey: ["leads"] });
              setParsedNumbers([]);
              Alert.alert("Done", `${res.message}\n\n${res.duplicates > 0 ? `${res.duplicates} duplicates skipped.` : ""}`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Import failed");
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const handleDistributeExisting = () => {
    if (!stats || stats.unassigned_leads === 0) {
      Alert.alert("No Leads", "There are no unassigned leads to distribute.");
      return;
    }
    if (selectedAgents.length === 0) {
      Alert.alert("Select Agents", "Please select at least one agent.");
      return;
    }

    Alert.alert(
      "Distribute Existing",
      `Distribute ${stats.unassigned_leads} unassigned leads evenly across ${selectedAgents.length} agent${selectedAgents.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Distribute",
          onPress: async () => {
            setDistributing(true);
            try {
              const res = await api.post<{ message: string }>("/leads/distribute", {
                agent_ids: selectedAgents,
              });
              queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
              queryClient.invalidateQueries({ queryKey: ["agents-available"] });
              queryClient.invalidateQueries({ queryKey: ["leads"] });
              Alert.alert("Done", res.message);
              setSelectedAgents([]);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Distribution failed");
            } finally {
              setDistributing(false);
            }
          },
        },
      ]
    );
  };

  const handleUnassignAll = () => {
    Alert.alert("Unassign All", "This will remove all lead assignments. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unassign All",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/leads/unassign-all");
            queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
            queryClient.invalidateQueries({ queryKey: ["agents-available"] });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            Alert.alert("Done", "All leads have been unassigned.");
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to unassign");
          }
        },
      },
    ]);
  };

  const refetchAll = () => {
    refetchStats();
    refetchAgents();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.green} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={colors.brand.green} />}
    >
      {/* Stats overview */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.total_leads ?? 0}</Text>
          <Text style={styles.statLabel}>Total Leads</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statValue, { color: colors.brand.green }]}>{stats?.unassigned_leads ?? 0}</Text>
          <Text style={styles.statLabel}>Unassigned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{agents?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Agents</Text>
        </View>
      </View>

      {/* CSV Upload Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import Numbers from CSV</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickCSV} activeOpacity={0.7}>
          <Feather name="upload" size={20} color={colors.brand.green} />
          <View>
            <Text style={styles.uploadBtnTitle}>Pick CSV File</Text>
            <Text style={styles.uploadBtnSub}>CSV, TXT with phone numbers</Text>
          </View>
        </TouchableOpacity>
        {parsedNumbers.length > 0 && (
          <View style={styles.parsedBanner}>
            <Feather name="check-circle" size={16} color={colors.status.success} />
            <Text style={styles.parsedText}>
              {parsedNumbers.length} numbers ready to import
            </Text>
            <TouchableOpacity onPress={() => setParsedNumbers([])}>
              <Feather name="x" size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Current distribution */}
      {stats && stats.agents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Distribution</Text>
          {stats.agents.map((a) => (
            <View key={a.id} style={styles.distRow}>
              <View style={styles.distAvatar}>
                <Text style={styles.distAvatarText}>{(a.full_name || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.distName}>{a.full_name || "Agent"}</Text>
                <Text style={styles.distMeta}>{a.lead_count} leads</Text>
              </View>
              <View style={styles.distBar}>
                <View
                  style={[
                    styles.distBarFill,
                    {
                      width: `${Math.min(100, (parseInt(a.lead_count) / Math.max(1, stats.total_leads)) * 100 * stats.agents.length)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Select agents */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Agents</Text>
          <TouchableOpacity onPress={selectAll}>
            <Text style={styles.selectAllText}>
              {selectedAgents.length === (agents?.length ?? 0) ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
        </View>

        {!agents || agents.length === 0 ? (
          <View style={styles.emptyAgents}>
            <Feather name="users" size={24} color={colors.text.muted} />
            <Text style={styles.emptyText}>No approved agents available</Text>
          </View>
        ) : (
          agents.map((agent) => {
            const selected = selectedAgents.includes(agent.id);
            return (
              <TouchableOpacity
                key={agent.id}
                style={[styles.agentRow, selected && styles.agentRowSelected]}
                onPress={() => toggleAgent(agent.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Feather name="check" size={12} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agentName}>{agent.full_name || agent.email}</Text>
                  <Text style={styles.agentMeta}>{agent.assigned_leads} leads assigned</Text>
                </View>
                <View style={[styles.onlineIndicator, agent.status === "online" && styles.onlineActive]} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {/* Upload & Distribute (CSV) */}
        {parsedNumbers.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryBtn, (uploading || selectedAgents.length === 0) && { opacity: 0.5 }]}
            onPress={handleUploadAndDistribute}
            disabled={uploading || selectedAgents.length === 0}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="upload-cloud" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Upload & Distribute {parsedNumbers.length} Numbers
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Distribute existing unassigned */}
        {(stats?.unassigned_leads ?? 0) > 0 && (
          <TouchableOpacity
            style={[styles.distributeBtn, (distributing || selectedAgents.length === 0) && { opacity: 0.5 }]}
            onPress={handleDistributeExisting}
            disabled={distributing || selectedAgents.length === 0}
            activeOpacity={0.8}
          >
            {distributing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="shuffle" size={16} color="#fff" />
                <Text style={styles.distributeBtnText}>
                  Distribute {stats?.unassigned_leads ?? 0} Unassigned Leads
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.unassignBtn} onPress={handleUnassignAll} activeOpacity={0.8}>
          <Feather name="rotate-ccw" size={14} color={colors.status.error} />
          <Text style={styles.unassignBtnText}>Unassign All Leads</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  statCardHighlight: { borderColor: colors.brand.green, borderWidth: 1.5 },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text.primary },
  statLabel: { fontSize: 11, color: colors.text.muted, fontWeight: "600", marginTop: 2, textTransform: "uppercase" },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  selectAllText: { fontSize: 13, color: colors.brand.green, fontWeight: "600" },

  // Upload
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.bg.card, padding: 18, borderRadius: 10, borderWidth: 1.5, borderColor: colors.brand.green, borderStyle: "dashed" },
  uploadBtnTitle: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  uploadBtnSub: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  parsedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#dcfce7", padding: 12, borderRadius: 8, marginTop: 10 },
  parsedText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#166534" },

  // Distribution
  distRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  distAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  distAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  distName: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  distMeta: { fontSize: 11, color: colors.text.muted },
  distBar: { width: 60, height: 6, backgroundColor: colors.border.default, borderRadius: 3, overflow: "hidden" },
  distBarFill: { height: "100%", backgroundColor: colors.brand.green, borderRadius: 3 },
  emptyAgents: { alignItems: "center", padding: 24, backgroundColor: colors.bg.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border.default },
  emptyText: { fontSize: 13, color: colors.text.muted, marginTop: 8 },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.bg.card, padding: 14, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: colors.border.default },
  agentRowSelected: { borderColor: colors.brand.green, backgroundColor: "#f0fdf4" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border.default, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },
  agentName: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  agentMeta: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  onlineIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border.default },
  onlineActive: { backgroundColor: colors.status.success },
  actions: { paddingHorizontal: 16, marginTop: 24, gap: 10 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand.dark, paddingVertical: 15, borderRadius: 8 },
  primaryBtnText: { color: colors.brand.yellow, fontSize: 15, fontWeight: "700" },
  distributeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand.green, paddingVertical: 15, borderRadius: 8 },
  distributeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  unassignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fee2e2", paddingVertical: 12, borderRadius: 8 },
  unassignBtnText: { color: colors.status.error, fontWeight: "600", fontSize: 13 },
});
