import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { colors } from "../../src/theme/colors";
import { useAuth } from "../../src/contexts/AuthContext";
import { getCurrencyFromCountry } from "../../src/utils/formatCurrency";
import { Redirect } from "expo-router";

type DepositAnalytics = {
  totals: {
    total_deposited_ugx: number;
    attributed_ugx: number;
    converted_count: number;
    depositors_count: number;
    total_leads: number;
  };
  top_leads: Array<{
    phone: string;
    name: string;
    trait: string | null;
    lifecycle_stage: string;
    deposited_ugx: number;
    attributed_ugx: number;
    assigned_agent: string | null;
  }>;
  top_agents: Array<{
    id: string;
    full_name: string | null;
    email: string;
    total_leads: number;
    conversions: number;
    attributed_ugx: number;
    total_deposited_ugx: number;
  }>;
  monthly_trend: Array<{
    month: string;
    refreshes: number;
    attributed_ugx: number;
  }>;
};

function fmt(n: number, currency: string): string {
  if (n >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

function maskPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return "+" + digits.slice(0, 3) + "•••" + digits.slice(-4);
}

function AgentInitials({ name, email }: { name: string | null; email: string }) {
  const label = (name || email || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <View style={styles.agentAvatar}>
      <Text style={styles.agentAvatarText}>{label}</Text>
    </View>
  );
}

export default function DepositAnalyticsScreen() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"leads" | "agents">("leads");

  if (loading) return null;
  if (!user || (user.role !== "management" && user.role !== "admin")) {
    return <Redirect href="/" />;
  }

  const currency = getCurrencyFromCountry((user as any)?.country || "UG");

  const { data, isLoading, refetch, isRefetching } = useQuery<DepositAnalytics>({
    queryKey: ["deposit-analytics"],
    queryFn: () => api.get<DepositAnalytics>("/reports/deposit-analytics"),
    refetchInterval: 60_000,
  });

  const t = data?.totals;
  const convRate = t && t.total_leads > 0 ? ((t.converted_count / t.total_leads) * 100).toFixed(1) : "0";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand.green} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deposit Analytics</Text>
        <Text style={styles.headerSub}>All-time performance from call efforts</Text>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.brand.green} />
          <Text style={styles.loaderText}>Loading analytics…</Text>
        </View>
      ) : !data ? (
        <View style={styles.emptyBox}>
          <Feather name="bar-chart-2" size={32} color={colors.text.muted} />
          <Text style={styles.emptyText}>No data yet</Text>
          <Text style={styles.emptySubText}>Upload performance files via Recycle Leads to see analytics here.</Text>
        </View>
      ) : (
        <>
          {/* KPI Cards */}
          <View style={styles.kpiGrid}>
            <KpiCard
              icon="trending-up"
              iconColor="#059669"
              bg="#ecfdf5"
              label="Total Deposited"
              value={fmt(t?.total_deposited_ugx ?? 0, currency)}
            />
            <KpiCard
              icon="phone-call"
              iconColor="#2563eb"
              bg="#eff6ff"
              label="Call-Attributed"
              value={fmt(t?.attributed_ugx ?? 0, currency)}
            />
            <KpiCard
              icon="users"
              iconColor="#7c3aed"
              bg="#f5f3ff"
              label="Depositors"
              value={(t?.depositors_count ?? 0).toLocaleString()}
            />
            <KpiCard
              icon="check-circle"
              iconColor="#d97706"
              bg="#fffbeb"
              label="Conversions"
              value={`${(t?.converted_count ?? 0).toLocaleString()} (${convRate}%)`}
            />
          </View>

          {/* Monthly Trend */}
          {data.monthly_trend.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Monthly Trend (last 6 months)</Text>
              <View style={styles.trendList}>
                {data.monthly_trend.map((m) => {
                  const maxVal = Math.max(...data.monthly_trend.map((x) => x.attributed_ugx), 1);
                  const pct = m.attributed_ugx / maxVal;
                  return (
                    <View key={m.month} style={styles.trendRow}>
                      <Text style={styles.trendMonth}>{m.month.slice(5)}/{m.month.slice(0, 4)}</Text>
                      <View style={styles.trendBarWrap}>
                        <View style={[styles.trendBar, { flex: pct, backgroundColor: colors.brand.green }]} />
                        <View style={{ flex: 1 - pct }} />
                      </View>
                      <Text style={styles.trendVal}>{fmt(m.attributed_ugx, currency)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "leads" && styles.tabBtnActive]}
              onPress={() => setTab("leads")} activeOpacity={0.7}
            >
              <Feather name="dollar-sign" size={14} color={tab === "leads" ? "#fff" : colors.text.secondary} />
              <Text style={[styles.tabBtnText, tab === "leads" && styles.tabBtnTextActive]}>Top Depositors</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === "agents" && styles.tabBtnActive]}
              onPress={() => setTab("agents")} activeOpacity={0.7}
            >
              <Feather name="users" size={14} color={tab === "agents" ? "#fff" : colors.text.secondary} />
              <Text style={[styles.tabBtnText, tab === "agents" && styles.tabBtnTextActive]}>Top Agents</Text>
            </TouchableOpacity>
          </View>

          {/* Top Depositing Numbers */}
          {tab === "leads" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top depositing numbers (all time)</Text>
              {data.top_leads.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptySubText}>No deposit data yet. Upload a performance file to begin.</Text>
                </View>
              ) : (
                data.top_leads.map((lead, i) => (
                  <View key={lead.phone} style={styles.leadCard}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.leadInfo}>
                      <Text style={styles.leadPhone}>{maskPhone(lead.phone)}</Text>
                      <View style={styles.leadMeta}>
                        {lead.trait && (
                          <View style={styles.traitChip}>
                            <Text style={styles.traitText}>{lead.trait}</Text>
                          </View>
                        )}
                        {lead.assigned_agent && (
                          <Text style={styles.leadAgent} numberOfLines={1}>
                            <Feather name="user" size={10} color={colors.text.muted} /> {lead.assigned_agent}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.leadAmounts}>
                      <Text style={styles.leadDepositMain}>{fmt(lead.deposited_ugx, currency)}</Text>
                      {lead.attributed_ugx > 0 && (
                        <Text style={styles.leadDepositAttr}>
                          {fmt(lead.attributed_ugx, currency)} attributed
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Top Agents */}
          {tab === "agents" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top agents by attributed deposit value</Text>
              {data.top_agents.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptySubText}>No agent deposit data yet.</Text>
                </View>
              ) : (
                data.top_agents.map((agent, i) => (
                  <View key={agent.id} style={styles.agentCard}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    <AgentInitials name={agent.full_name} email={agent.email} />
                    <View style={styles.agentInfo}>
                      <Text style={styles.agentName} numberOfLines={1}>{agent.full_name || agent.email}</Text>
                      <Text style={styles.agentMeta}>
                        {agent.total_leads} leads · {agent.conversions} converted
                      </Text>
                    </View>
                    <View style={styles.agentAmounts}>
                      <Text style={styles.agentAttr}>{fmt(agent.attributed_ugx, currency)}</Text>
                      <Text style={styles.agentTotal}>{fmt(agent.total_deposited_ugx, currency)} total</Text>
                    </View>
                  </View>
                ))
              )}
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: colors.brand.green }]} />
                <Text style={styles.legendText}>Attributed = deposited after the agent's call</Text>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function KpiCard({ icon, iconColor, bg, label, value }: {
  icon: any; iconColor: string; bg: string; label: string; value: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <View style={[styles.kpiIcon, { backgroundColor: iconColor + "22" }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  header: { padding: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.text.primary },
  headerSub: { fontSize: 13, color: colors.text.secondary, marginTop: 3 },

  loader: { flex: 1, alignItems: "center", justifyContent: "center", padding: 60, gap: 12 },
  loaderText: { fontSize: 13, color: colors.text.muted },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, marginTop: 14 },
  kpiCard: { flex: 1, minWidth: "45%", borderRadius: 12, padding: 14, gap: 6 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text.primary, marginTop: 2 },
  kpiLabel: { fontSize: 11, color: colors.text.secondary, fontWeight: "600" },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  trendList: { backgroundColor: colors.bg.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border.default, gap: 10 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendMonth: { fontSize: 11, fontWeight: "600", color: colors.text.secondary, width: 42 },
  trendBarWrap: { flex: 1, height: 10, flexDirection: "row", borderRadius: 5, overflow: "hidden", backgroundColor: colors.border.default },
  trendBar: { borderRadius: 5 },
  trendVal: { fontSize: 11, fontWeight: "700", color: colors.text.primary, textAlign: "right", minWidth: 80 },

  tabRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 18 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  tabBtnActive: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: colors.text.secondary },
  tabBtnTextActive: { color: "#fff" },

  leadCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border.default, gap: 10 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand.yellow + "44", alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 11, fontWeight: "800", color: colors.brand.dark },
  leadInfo: { flex: 1 },
  leadPhone: { fontSize: 14, fontWeight: "700", color: colors.text.primary, fontFamily: "monospace" },
  leadMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  traitChip: { backgroundColor: "#e0f2fe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  traitText: { fontSize: 10, fontWeight: "700", color: "#0369a1" },
  leadAgent: { fontSize: 10, color: colors.text.muted },
  leadAmounts: { alignItems: "flex-end" },
  leadDepositMain: { fontSize: 14, fontWeight: "800", color: "#047857" },
  leadDepositAttr: { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  agentCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bg.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border.default, gap: 10 },
  agentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  agentAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  agentInfo: { flex: 1 },
  agentName: { fontSize: 14, fontWeight: "700", color: colors.text.primary },
  agentMeta: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  agentAmounts: { alignItems: "flex-end" },
  agentAttr: { fontSize: 14, fontWeight: "800", color: colors.brand.green },
  agentTotal: { fontSize: 10, color: colors.text.muted, marginTop: 2 },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.text.muted },

  emptyBox: { backgroundColor: colors.bg.card, borderRadius: 10, padding: 28, alignItems: "center", borderWidth: 1, borderColor: colors.border.default, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "700", color: colors.text.secondary },
  emptySubText: { fontSize: 12, color: colors.text.muted, textAlign: "center", lineHeight: 17 },
});
