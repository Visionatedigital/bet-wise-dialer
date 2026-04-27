import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTodayMetrics, useTeamMetrics } from "../../src/hooks/useMetrics";
import { usePendingCallbacks } from "../../src/hooks/useCallbacks";
import { useRecentCalls } from "../../src/hooks/useRecentCalls";
import { useNewLeads, useCooldownDueLeads } from "../../src/hooks/useLeads";
import { useAgentsAvailable } from "../../src/hooks/useDistribution";
import { KpiCard } from "../../src/components/KpiCard";
import { colors } from "../../src/theme/colors";
import { leadDisplayName } from "../../src/utils/leadDisplayName";
import { FloatingAssistant } from "../../src/components/FloatingAssistant";

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

function ManagerDashboard() {
  const router = useRouter();
  const { data: agents, refetch: refetchAgents } = useAgentsAvailable();
  const { data: teamData, refetch: refetchTeam } = useTeamMetrics();
  const totals = teamData?.totals;
  const metricsByAgent = teamData?.byAgent ?? [];

  const activeAgents = agents?.filter((a) => a.status === "online").length ?? 0;

  const refetchAll = () => {
    refetchAgents();
    refetchTeam();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={colors.brand.green} />}
    >
      {/* Team KPIs */}
      <Text style={styles.sectionTitle}>Team Performance Today</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="Calls" value={totals?.calls_made ?? 0} color={colors.brand.green} />
        <KpiCard label="Connects" value={totals?.connects ?? 0} color={colors.status.success} />
        <KpiCard label="Converts" value={totals?.conversions ?? 0} color={colors.status.info} />
      </View>

      {/* Agent Overview */}
      <View style={styles.agentSection}>
        <View style={styles.agentSectionHeader}>
          <View style={styles.rowGap6}>
            <Feather name="users" size={14} color={colors.text.secondary} />
            <Text style={styles.sectionTitleInline}>Agent Overview</Text>
          </View>
          <View style={styles.rowGap6}>
            <View style={styles.onlineDot} />
            <Text style={styles.agentsCount}>{activeAgents} online · {agents?.length ?? 0} total</Text>
          </View>
        </View>

        {!agents || agents.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="user-x" size={22} color={colors.text.muted} />
            <Text style={styles.emptyText}>No agents in your country yet</Text>
            <Text style={styles.emptySubText}>Approve agents to see them here</Text>
          </View>
        ) : (
          agents.map((agent) => {
            const initials = (agent.full_name || agent.email || "?")
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            const isOnline = agent.status === "online";
            const agentMetrics = metricsByAgent.find((m) => m.user_id === agent.id);
            const callsToday = agentMetrics?.calls_made ?? 0;
            const connectsToday = agentMetrics?.connects ?? 0;
            const connectRate =
              callsToday > 0 ? Math.round((connectsToday / callsToday) * 100) : 0;

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
                <View style={[styles.agentAvatar, isOnline && styles.agentAvatarOnline]}>
                  {agent.avatar_url ? (
                    <Image source={{ uri: agent.avatar_url }} style={styles.agentAvatarImg} />
                  ) : (
                    <Text style={styles.agentAvatarText}>{initials}</Text>
                  )}
                  <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
                </View>
                <View style={styles.agentInfo}>
                  <Text style={styles.agentName}>{agent.full_name || agent.email}</Text>
                  <Text style={styles.agentEmail} numberOfLines={1}>{agent.email}</Text>
                </View>
                <View style={styles.agentStats}>
                  <View style={styles.agentStat}>
                    <Text style={styles.agentStatValue}>{callsToday}</Text>
                    <Text style={styles.agentStatLabel}>Calls</Text>
                  </View>
                  <View style={styles.agentStatDivider} />
                  <View style={styles.agentStat}>
                    <Text style={[styles.agentStatValue, connectRate >= 30 && { color: colors.status.success }]}>
                      {connectRate}%
                    </Text>
                    <Text style={styles.agentStatLabel}>Rate</Text>
                  </View>
                  <View style={styles.agentStatDivider} />
                  <View style={styles.agentStat}>
                    <Text style={styles.agentStatValue}>{agent.assigned_leads}</Text>
                    <Text style={styles.agentStatLabel}>Leads</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={colors.text.muted} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/distribute")} activeOpacity={0.8}>
            <Feather name="shuffle" size={20} color={colors.brand.dark} />
            <Text style={styles.quickBtnText}>Distribute</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/import-leads")} activeOpacity={0.8}>
            <Feather name="upload-cloud" size={20} color={colors.brand.dark} />
            <Text style={styles.quickBtnText}>Import Leads</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/refresh-performance")} activeOpacity={0.8}>
            <Feather name="refresh-ccw" size={20} color={colors.brand.dark} />
            <Text style={styles.quickBtnText}>Refresh Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/approve-agents")} activeOpacity={0.8}>
            <Feather name="user-check" size={20} color={colors.brand.dark} />
            <Text style={styles.quickBtnText}>Approve Agents</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function AgentDashboard() {
  const { data: metrics, refetch, isLoading } = useTodayMetrics();
  const { data: callbacks } = usePendingCallbacks();
  const { data: recentCalls } = useRecentCalls();
  const { data: newLeads } = useNewLeads(10);
  const { data: cooldownLeads } = useCooldownDueLeads(10);
  const router = useRouter();

  const overdueCount = callbacks?.filter((c) => new Date(c.scheduled_for) < new Date()).length || 0;
  const dueCallbackCount = callbacks?.filter((c) => {
    const d = new Date(c.scheduled_for);
    const eod = new Date(); eod.setHours(23, 59, 59, 999);
    return d <= eod;
  }).length || 0;
  const totalQueue = (newLeads?.length || 0) + dueCallbackCount + (cooldownLeads?.length || 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.brand.green} />}
    >
      {/* KPIs */}
      <Text style={styles.sectionTitle}>Today's Performance</Text>
      <View style={styles.kpiRow}>
        <KpiCard label="Calls" value={metrics?.calls_made ?? 0} color={colors.brand.green} />
        <KpiCard label="Connects" value={metrics?.connects ?? 0} color={colors.status.success} />
        <KpiCard label="Converts" value={metrics?.conversions ?? 0} color={colors.status.info} />
      </View>

      {/* Start Calling */}
      <TouchableOpacity style={styles.startButton} onPress={() => router.push("/(tabs)/leads")} activeOpacity={0.8}>
        <Feather name="phone-outgoing" size={22} color="#fff" />
        <View>
          <Text style={styles.startText}>Start Calling</Text>
          <Text style={styles.startSub}>View your assigned leads</Text>
        </View>
      </TouchableOpacity>

      {/* Call Queue */}
      {totalQueue > 0 && (
        <View style={styles.queueSection}>
          <View style={styles.queueHeader}>
            <View style={styles.rowGap6}>
              <Feather name="phone-call" size={14} color={colors.text.secondary} />
              <Text style={styles.sectionTitleInline}>Call Queue</Text>
            </View>
            <View style={styles.queueTotalBadge}>
              <Text style={styles.queueTotalText}>{totalQueue}</Text>
            </View>
          </View>

          {(newLeads?.length ?? 0) > 0 && (
            <TouchableOpacity style={styles.queueRow} onPress={() => router.push("/(tabs)/leads")} activeOpacity={0.7}>
              <View style={[styles.queueIcon, { backgroundColor: "#eff6ff" }]}>
                <Feather name="user-plus" size={14} color="#1d4ed8" />
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueLabel}>New Leads</Text>
                <Text style={styles.queueSub}>Freshly assigned to you</Text>
              </View>
              <View style={[styles.queueBadge, { backgroundColor: "#dbeafe" }]}>
                <Text style={[styles.queueBadgeText, { color: "#1d4ed8" }]}>{newLeads!.length}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}

          {dueCallbackCount > 0 && (
            <TouchableOpacity style={styles.queueRow} onPress={() => router.push("/(tabs)/callbacks")} activeOpacity={0.7}>
              <View style={[styles.queueIcon, { backgroundColor: "#fee2e2" }]}>
                <Feather name="phone-call" size={14} color="#dc2626" />
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueLabel}>Callbacks Due</Text>
                <Text style={styles.queueSub}>{overdueCount > 0 ? `${overdueCount} overdue` : "Scheduled today"}</Text>
              </View>
              <View style={[styles.queueBadge, { backgroundColor: "#fee2e2" }]}>
                <Text style={[styles.queueBadgeText, { color: "#dc2626" }]}>{dueCallbackCount}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}

          {(cooldownLeads?.length ?? 0) > 0 && (
            <TouchableOpacity style={styles.queueRow} onPress={() => router.push("/(tabs)/leads")} activeOpacity={0.7}>
              <View style={[styles.queueIcon, { backgroundColor: "#ecfdf5" }]}>
                <Feather name="clock" size={14} color="#16a34a" />
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueLabel}>Ready to Call</Text>
                <Text style={styles.queueSub}>Cooldown period ended</Text>
              </View>
              <View style={[styles.queueBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.queueBadgeText, { color: "#16a34a" }]}>{cooldownLeads!.length}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <View style={styles.rowGap6}>
            <Feather name="activity" size={14} color={colors.text.secondary} />
            <Text style={styles.sectionTitleInline}>Recent Activity</Text>
          </View>
          {recentCalls && recentCalls.length > 0 && (
            <Text style={styles.activityCount}>{recentCalls.length} calls</Text>
          )}
        </View>

        {!recentCalls || recentCalls.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="phone-off" size={20} color={colors.text.muted} />
            <Text style={styles.emptyText}>No recent calls</Text>
            <Text style={styles.emptySubText}>Your call activity will appear here</Text>
          </View>
        ) : (
          recentCalls.slice(0, 8).map((call, i) => {
            const statusStyle = STATUS_STYLE[call.status] || STATUS_STYLE.connected;
            return (
              <View key={call.id || i} style={[styles.activityCard, i === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: statusStyle.bg }]}>
                    <Feather
                      name={
                        call.status === "connected" || call.status === "interested"
                          ? "phone-incoming"
                          : call.status === "no_answer"
                          ? "phone-missed"
                          : "phone-off"
                      }
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
                  {new Date(cb.scheduled_for).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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

export default function HomeScreen() {
  const { user } = useAuth();
  const isManager = user?.role === "management" || user?.role === "admin";

  return (
    <View style={{ flex: 1 }}>
      {/* Greeting bar visible on both views */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetText}>
            Hello, {user?.full_name?.split(" ")[0] || (isManager ? "Manager" : "Agent")}
          </Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </Text>
        </View>
        {isManager ? (
          <View style={[styles.statusPill, { backgroundColor: "#ede9fe" }]}>
            <Feather name="briefcase" size={12} color="#7c3aed" />
            <Text style={[styles.statusText, { color: "#7c3aed" }]}>Manager</Text>
          </View>
        ) : (
          <View style={styles.statusPill}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        )}
      </View>
      {isManager ? <ManagerDashboard /> : <AgentDashboard />}
      {/* Floating AI assistant — only for managers */}
      {isManager && <FloatingAssistant managerName={user?.full_name} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg.dashboard,
  },
  greeting: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 16 },
  greetText: { fontSize: 22, fontWeight: "700", color: colors.text.primary },
  dateText: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.bg.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.status.success },
  statusText: { fontSize: 12, color: colors.brand.green, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.text.secondary, paddingHorizontal: 20, marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionTitleInline: { fontSize: 12, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiRow: { flexDirection: "row", paddingHorizontal: 16 },
  rowGap6: { flexDirection: "row", alignItems: "center", gap: 6 },

  // Manager: Agent section
  agentSection: { marginHorizontal: 20, marginTop: 20 },
  agentSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  agentsCount: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 10,
  },
  agentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  agentAvatarOnline: { backgroundColor: "#16a34a" },
  agentAvatarImg: { width: "100%", height: "100%", borderRadius: 21 },
  agentAvatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  statusDot: { position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.bg.card },
  statusDotOnline: { backgroundColor: "#22c55e" },
  statusDotOffline: { backgroundColor: "#9ca3af" },
  agentInfo: { flex: 1, minWidth: 0 },
  agentName: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  agentEmail: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  agentStats: { flexDirection: "row", alignItems: "center", gap: 6 },
  agentStat: { alignItems: "center", minWidth: 30 },
  agentStatValue: { fontSize: 14, fontWeight: "700", color: colors.text.primary },
  agentStatLabel: { fontSize: 9, color: colors.text.muted, fontWeight: "600", textTransform: "uppercase" },
  agentStatDivider: { width: 1, height: 20, backgroundColor: colors.border.default },

  // Quick actions (manager)
  quickActions: { marginHorizontal: 20, marginTop: 4 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickBtn: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  quickBtnText: { fontSize: 13, fontWeight: "600", color: colors.brand.dark },

  // Agent: Start Calling
  startButton: { backgroundColor: colors.brand.green, marginHorizontal: 20, marginTop: 20, borderRadius: 8, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  startText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  startSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },

  // Empty states
  emptyBox: { backgroundColor: colors.bg.card, borderRadius: 8, padding: 24, alignItems: "center", borderWidth: 1, borderColor: colors.border.default },
  emptyText: { fontSize: 14, color: colors.text.secondary, fontWeight: "600", marginTop: 8 },
  emptySubText: { fontSize: 12, color: colors.text.muted, marginTop: 2 },

  // Call queue
  queueSection: { marginHorizontal: 20, marginTop: 20, backgroundColor: colors.bg.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border.default, overflow: "hidden" },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  queueTotalBadge: { backgroundColor: colors.brand.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  queueTotalText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  queueRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.border.default },
  queueIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  queueInfo: { flex: 1 },
  queueLabel: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  queueSub: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  queueBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  queueBadgeText: { fontSize: 12, fontWeight: "800" },

  // Recent activity
  activitySection: { marginHorizontal: 20, marginTop: 20 },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  activityCount: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },
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
