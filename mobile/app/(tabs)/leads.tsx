import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useLeads } from "../../src/hooks/useLeads";
import { colors } from "../../src/theme/colors";
import { leadDisplayName } from "../../src/utils/leadDisplayName";

// Matches desktop KANBAN_COLUMNS exactly
const CATEGORIES = [
  { id: "unassigned", title: "New", bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  { id: "no_answer", title: "No Answer", bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  { id: "unreachable", title: "Unreachable", bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", dot: "#ef4444" },
  { id: "interested", title: "Interested", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", dot: "#10b981" },
  { id: "not_interested", title: "Not Interested", bg: "#f8fafc", text: "#475569", border: "#e2e8f0", dot: "#94a3b8" },
  { id: "answered_no_response", title: "No Response", bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff", dot: "#a855f7" },
];

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || "";
  return "***" + phone.replace(/[^0-9]/g, "").slice(-4);
}

export default function LeadsScreen() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { data: leads, isLoading, refetch } = useLeads();
  const router = useRouter();

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    CATEGORIES.forEach((c) => (groups[c.id] = []));
    (leads || []).forEach((lead) => {
      let status = lead.status?.toLowerCase() || "unassigned";
      if (status === "" || status === "pending") status = "unassigned";
      if (status === "called_no_answer") status = "no_answer";
      if (groups[status]) groups[status].push(lead);
      else groups["unassigned"].push(lead);
    });
    return groups;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!activeCategory) return [];
    let list = grouped[activeCategory] || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) => leadDisplayName(l.phone).toLowerCase().includes(q) || l.phone?.includes(q)
      );
    }
    return list;
  }, [grouped, activeCategory, search]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg.dashboard }}>
        <ActivityIndicator size="large" color={colors.brand.green} />
      </View>
    );
  }

  // Category tiles view
  if (!activeCategory) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryHeader}>
          <Text style={styles.totalText}>
            {leads?.length || 0} Total Leads
          </Text>
        </View>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.brand.green} />
          }
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const count = grouped[item.id]?.length || 0;
            return (
              <TouchableOpacity
                style={[styles.categoryCard, { backgroundColor: item.bg, borderColor: item.border }]}
                onPress={() => setActiveCategory(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: item.dot }]} />
                  <Text style={[styles.categoryTitle, { color: item.text }]}>
                    {item.title}
                  </Text>
                </View>
                <View style={styles.categoryRight}>
                  <View style={[styles.countBadge, { backgroundColor: "rgba(255,255,255,0.6)" }]}>
                    <Text style={[styles.countText, { color: item.text }]}>
                      {count}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={item.text} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // Lead list within a category
  const cat = CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <View style={styles.container}>
      {/* Back header */}
      <TouchableOpacity
        style={[styles.backHeader, { backgroundColor: cat.bg, borderBottomColor: cat.border }]}
        onPress={() => { setActiveCategory(null); setSearch(""); }}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={18} color={cat.text} />
        <View style={[styles.categoryDot, { backgroundColor: cat.dot }]} />
        <Text style={[styles.backTitle, { color: cat.text }]}>{cat.title}</Text>
        <View style={[styles.countBadge, { backgroundColor: "rgba(255,255,255,0.6)" }]}>
          <Text style={[styles.countText, { color: cat.text }]}>
            {grouped[cat.id]?.length || 0}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.text.muted} style={{ position: "absolute", left: 28, top: 23, zIndex: 1 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Lead list */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(l) => l.id}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.brand.green} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Feather name="inbox" size={36} color={colors.text.muted} />
            <Text style={{ color: colors.text.secondary, fontSize: 15, fontWeight: "600", marginTop: 12 }}>
              No leads in this category
            </Text>
          </View>
        }
        renderItem={({ item: lead }) => (
          <TouchableOpacity
            style={[styles.leadCard, { backgroundColor: cat.bg + "80", borderColor: cat.border }]}
            onPress={() => router.push(`/leads/${lead.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.leadRow}>
              <View style={styles.leadInfo}>
                <View style={styles.leadNameRow}>
                  <View style={[styles.priorityDot, {
                    backgroundColor: lead.priority === "high" ? "#ef4444" : lead.priority === "medium" ? "#f59e0b" : "#10b981"
                  }]} />
                  <Text style={styles.leadName} numberOfLines={1}>{leadDisplayName(lead.phone)}</Text>
                </View>
                <View style={styles.leadMeta}>
                  <Feather name="phone" size={11} color={colors.text.muted} />
                  <Text style={styles.leadPhone}>{maskPhone(lead.phone)}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.text.muted} />
            </View>

            {/* Tags row */}
            <View style={styles.tagsRow}>
              {lead.segment && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{lead.segment?.toUpperCase()}</Text>
                </View>
              )}
              {lead.trait && (
                <View style={[styles.tag, {
                  backgroundColor: lead.trait === 'High Staker' ? '#fee2e2' : lead.trait === 'Medium Staker' ? '#fef3c7' : lead.trait === 'Frequent Bettor' ? '#dbeafe' : lead.trait === 'Dormant' ? '#f3f4f6' : '#dcfce7',
                  borderColor: lead.trait === 'High Staker' ? '#fecaca' : lead.trait === 'Medium Staker' ? '#fde68a' : lead.trait === 'Frequent Bettor' ? '#bfdbfe' : lead.trait === 'Dormant' ? '#e5e7eb' : '#bbf7d0',
                }]}>
                  <Text style={[styles.tagText, {
                    color: lead.trait === 'High Staker' ? '#991b1b' : lead.trait === 'Medium Staker' ? '#92400e' : lead.trait === 'Frequent Bettor' ? '#1e40af' : lead.trait === 'Dormant' ? '#6b7280' : '#166534',
                  }]}>{lead.trait}</Text>
                </View>
              )}
              {lead.preferred_product && (
                <View style={[styles.tag, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                  <Text style={[styles.tagText, { color: "#1d4ed8" }]}>
                    {lead.preferred_product === 'Sports' ? '⚽ ' : lead.preferred_product === 'Gaming' ? '🎮 ' : ''}{lead.preferred_product}
                  </Text>
                </View>
              )}
            </View>

            {/* Quick stats row */}
            {(lead.betting_patterns?.deposit_usd > 0 || lead.deposit_count > 0 || lead.last_bet_date) && (
              <View style={styles.depositRow}>
                {lead.betting_patterns?.deposit_usd > 0 && (
                  <>
                    <Feather name="dollar-sign" size={10} color={colors.text.muted} />
                    <Text style={styles.depositText}>
                      ${Number(lead.betting_patterns.deposit_usd).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </Text>
                  </>
                )}
                {lead.deposit_count != null && lead.deposit_count > 0 && (
                  <>
                    <Text style={styles.depositDot}>·</Text>
                    <Text style={styles.depositText}>{lead.deposit_count.toLocaleString()} bets</Text>
                  </>
                )}
                {lead.last_bet_date && (
                  <>
                    <Text style={styles.depositDot}>·</Text>
                    <Feather name="clock" size={10} color={colors.text.muted} />
                    <Text style={styles.depositText}>
                      {(() => {
                        const d = Math.floor((Date.now() - new Date(lead.last_bet_date).getTime()) / 86400000);
                        return d === 0 ? 'Today' : d < 30 ? `${d}d ago` : `${Math.floor(d/30)}mo ago`;
                      })()}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* AI Strategy / Last Note */}
            {(lead.next_action || lead.last_activity) && (
              <View style={styles.noteBox}>
                {lead.next_action && (
                  <View style={styles.noteRow}>
                    <Feather name="zap" size={10} color={colors.status.info} />
                    <Text style={styles.noteLabel}>AI Strategy</Text>
                    <Text style={styles.noteText} numberOfLines={1}>"{lead.next_action}"</Text>
                  </View>
                )}
                {lead.last_activity && lead.last_activity !== "Never" && (
                  <View style={styles.noteRow}>
                    <Feather name="message-square" size={10} color={colors.text.muted} />
                    <Text style={styles.noteLabel}>Note</Text>
                    <Text style={styles.noteText} numberOfLines={1}>{lead.last_activity}</Text>
                  </View>
                )}
              </View>
            )}

            {lead.next_action_due && (
              <View style={styles.dueRow}>
                <Feather name="calendar" size={11} color={colors.text.muted} />
                <Text style={styles.dueText}>
                  {new Date(lead.next_action_due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },

  // Summary
  summaryHeader: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  totalText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },

  // Category tiles
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryTitle: { fontSize: 15, fontWeight: "700" },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: "800" },

  // Back header
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backTitle: { fontSize: 16, fontWeight: "700", flex: 1 },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchInput: {
    backgroundColor: colors.bg.card,
    borderRadius: 8,
    paddingLeft: 38,
    paddingRight: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },

  // Lead cards
  leadCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  leadRow: { flexDirection: "row", alignItems: "center" },
  leadInfo: { flex: 1 },
  leadNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  leadName: { fontSize: 14, fontWeight: "700", color: colors.text.primary },
  leadMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, marginLeft: 16 },
  leadPhone: { fontSize: 12, color: colors.text.secondary, fontWeight: "500" },

  // Tags
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tagText: { fontSize: 9, fontWeight: "700", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.3 },

  // Deposit info
  depositRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingLeft: 2 },
  depositText: { fontSize: 11, color: colors.text.secondary, fontWeight: "500" },
  depositDot: { fontSize: 11, color: colors.text.muted },

  // Note box
  noteBox: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  noteLabel: { fontSize: 9, fontWeight: "800", color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  noteText: { fontSize: 10, color: colors.text.secondary, fontStyle: "italic", flex: 1 },

  // Due date
  dueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.04)" },
  dueText: { fontSize: 11, color: colors.text.muted },
});
