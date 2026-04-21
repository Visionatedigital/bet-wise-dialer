import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTodayMetrics } from "../../src/hooks/useMetrics";
import { usePendingCallbacks } from "../../src/hooks/useCallbacks";
import { useRecentCalls } from "../../src/hooks/useRecentCalls";
import { useUsers } from "../../src/hooks/useUsers";
import { KpiCard } from "../../src/components/KpiCard";
import { colors } from "../../src/theme/colors";
import { leadDisplayName } from "../../src/utils/leadDisplayName";

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || "";
  return "***" + phone.replace(/[^0-9]/g, "").slice(-4);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  connected: { bg: "#dcfce7", text: "#166534", label: "Connected" },
  converted: { bg: "#dcfce7", text: "#166534", label: "Converted" },
  interested: { bg: "#dcfce7", text: "#166534", label: "Interested" },
  no_answer: { bg: "#fef3c7", text: "#92400e", label: "No Answer" },
  unreachable: { bg: "#fee2e2", text: "#991b1b", label: "Unreachable" },
  not_interested: { bg: "#f3f4f6", text: "#374151", label: "Not Interested" },
};

const ROLE_COLORS: Record<string, string> = {
  agent: colors.brand.green,
  management: "#6366f1",
  admin: "#f59e0b",
};

export default function HomeScreen() {
  const { user } = useAuth();
  const { data: metrics, refetch, isLoading } = useTodayMetrics();
  const { data: callbacks } = usePendingCallbacks();
  const { data: recentCalls } = useRecentCalls();
  const { data: allUsers } = useUsers();
  const router = useRouter();

  const isManager = user?.role === "management" || user?.role === "admin";
  const agents = allUsers?.filter((u) => u.approved && u.role === "agent") ?? [];
  const overdueCount = callbacks?.filter((c) => new Date(c.scheduled_for) < new Date()).length || 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.brand.green} />}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetText}>Hello, {user?.full_name?.split(" ")[0] || "Agent"}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.onlineDot} />
          <Text style={styles.statusText}>Online</Text>
        </View>
      </View>

      {/* KPIs */}
      <Text style={styles.sectionTitle}>Today's Performance</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="Calls" value={metrics?.calls_made ?? 0} color={colors.brand.green} />
        <KpiCard label="Connects" value={metrics?.connects ?? 0} color={colors.status.success} />
        <KpiCard label="Converts" value={metrics?.conversions ?? 0} color={colors.status.info} />
      </View>

      {/* Manager: Agent cards | Agent: Start Calling */}
      {isManager ? (
        <View style={styles.agentsSection}>
          <View style={styles.agentsSectionHeader}>
            <View style={styles.agentsTitleRow}>
              <Feather name="users" size={14} color={colors.text.secondary} />
              <Text style={styles.sectionTitleInline}>Agents</Text>
            </View>
            <Text style={styles.agentsCount}>{agents.length} active</Text>
          </View>

          {agents.length === 0 ? (
            <View style={styles.emptyAgents}>
              <Feather name="user-x" size={20} color={colors.text.muted} />
              <Text style={styles.emptyAgentsText}>No active agents</Text>
            </View>
          ) : (
            agents.map((agent) => {
              const initials = (agent.full_name || agent.email)
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const roleColor = ROLE_COLORS[agent.role] || colors.brand.green;
              return (
                <TouchableOpacity
                  key={agent.id}
                  style={styles.agentCard}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: `/agent-logs/${agent.id}` as any,
                      params: { agentName: agent.full_name || agent.email },
                    })
                  }
                >
                  <View style={[styles.agentAvatar, { backgroundColor: roleColor }]}>
                    <Text style={styles.agentAvatarText}>{initials}</Text>
                  </View>
                  <View style={styles.agentInfo}>
                    <Text style={styles.agentName}>{agent.full_name || agent.email}</Text>
                    <Text style={styles.agentEmail} numberOfLines={1}>{agent.email}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.text.muted} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.startButton} onPress={() => router.push("/(tabs)/leads")} activeOpacity={0.8}>
          <Feather name="phone-outgoing" size={22} color="#fff" />
          <View>
            <Text style={styles.startText}>Start Calling</Text>
            <Text style={styles.startSub}>View your assigned leads</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <View style={styles.activityTitleRow}>
            <Feather name="activity" size={14} color={colors.text.secondary} />
            <Text style={styles.sectionTitleInline}>Recent Activity</Text>
          </View>
          {recentCalls && recentCalls.length > 0 && (
            <Text style={styles.activityCount}>{recentCalls.length} calls</Text>
          )}
        </View>

        {!recentCalls || recentCalls.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Feather name="phone-off" size={20} color={colors.text.muted} />
            <Text style={styles.emptyActivityText}>No recent calls</Text>
            <Text style={styles.emptyActivitySub}>Your call activity will appear here</Text>
          </View>
        ) : (
          recentCalls.slice(0, 8).map((call, i) => {
            const statusStyle = STATUS_STYLE[call.status] || STATUS_STYLE.connected;
            return (
              <View
                key={call.id || i}
                style={[styles.activityCard, i === 0 && { borderTopWidth: 0 }]}
              >
                <View style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: statusStyle.bg }]}>
                    <Feather
                      name={call.status === "connected" || call.status === "interested" ? "phone-incoming" : call.status === "no_answer" ? "phone-missed" : "phone-off"}
                      size={13}
                      color={statusStyle.text}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName} numberOfLines={1}>
                      {leadDisplayName(call.phone_number)}
                    </Text>
                    <View style={styles.activityMeta}>
                      <Text style={styles.activityPhone}>{maskPhone(call.phone_number)}</Text>
                      <Text style={styles.activityDot}>·</Text>
                      <Text style={styles.activityTime}>{timeAgo(call.created_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusChipText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>
                {call.notes && (
                  <Text style={styles.activityNotes} numberOfLines={1}>{call.notes}</Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Callbacks */}
      {(callbacks?.length ?? 0) > 0 && (
        <View style={styles.cbSection}>
          <View style={styles.cbHeader}>
            <Text style={styles.sectionTitle}>Upcoming Callbacks</Text>
            {overdueCount > 0 && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueText}>{overdueCount} overdue</Text>
              </View>
            )}
          </View>
          {callbacks!.slice(0, 3).map((cb) => (
            <View key={cb.id} style={styles.cbCard}>
              <View style={styles.cbRow}>
                <Text style={styles.cbName}>{leadDisplayName(cb.phone_number)}</Text>
                <Text style={styles.cbTime}>
                  {new Date(cb.scheduled_for).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
              {cb.notes && <Text style={styles.cbNotes} numberOfLines={1}>{cb.notes}</Text>}
            </View>
          ))}
          <TouchableOpacity onPress={() => router.push("/(tabs)/callbacks")} style={styles.seeAll}>
            <Text style={styles.seeAllText}>See all ({callbacks!.length}) →</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  greeting: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 16 },
  greetText: { fontSize: 22, fontWeight: "700", color: colors.text.primary },
  dateText: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bg.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.success },
  statusText: { fontSize: 12, color: colors.brand.green, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.text.secondary, paddingHorizontal: 20, marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitleInline: { fontSize: 12, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiRow: { flexDirection: "row", paddingHorizontal: 16 },

  // Start Calling (agents only)
  startButton: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 20, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  startText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  startSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },

  // Agents section (managers only)
  agentsSection: { marginHorizontal: 20, marginTop: 20 },
  agentsSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  agentsTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  agentsCount: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },
  emptyAgents: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  emptyAgentsText: { fontSize: 14, color: colors.text.secondary, marginTop: 8 },
  agentCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border.default, gap: 12 },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  agentAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  agentInfo: { flex: 1 },
  agentName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  agentEmail: { fontSize: 12, color: colors.text.muted, marginTop: 1 },

  // Recent activity
  activitySection: { marginHorizontal: 20, marginTop: 20 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  activityTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  activityCount: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },
  emptyActivity: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  emptyActivityText: { fontSize: 14, color: colors.text.secondary, fontWeight: "600", marginTop: 8 },
  emptyActivitySub: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  activityCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border.default },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  activityInfo: { flex: 1 },
  activityName: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  activityMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  activityPhone: { fontSize: 12, color: colors.text.muted },
  activityDot: { fontSize: 12, color: colors.text.muted },
  activityTime: { fontSize: 12, color: colors.text.muted },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusChipText: { fontSize: 10, fontWeight: "700" },
  activityNotes: { fontSize: 12, color: colors.text.secondary, marginTop: 4, marginLeft: 42, fontStyle: "italic" },

  // Callbacks
  cbSection: { marginHorizontal: 20, marginTop: 4 },
  cbHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  overdueBadge: { backgroundColor: "#fee2e2", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  overdueText: { color: "#991b1b", fontSize: 11, fontWeight: "700" },
  cbCard: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: colors.border.default },
  cbRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cbName: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  cbTime: { fontSize: 12, color: colors.brand.green, fontWeight: "600" },
  cbNotes: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  seeAll: { paddingVertical: 8, alignItems: "center" },
  seeAllText: { color: colors.brand.green, fontSize: 13, fontWeight: "600" },
});
